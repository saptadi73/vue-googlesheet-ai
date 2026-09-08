<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import DataTable from '@/components/DataTable.vue'
import { api, downloadFile, type ApiEnvelope } from '@/lib/api'
import { call, user, roles } from '@/lib/etl'
import { emptyPlan, type Product, type QueryPlan, type Row, type SavedQuery } from '@/lib/catalog'
import { useTask } from '@/lib/tasks'
const ResultChart = defineAsyncComponent(() => import('@/components/charts/ResultChart.vue'))
const { busy, error, notice, run } = useTask()
const products = ref<Product[]>([]),
  templates = ref<SavedQuery[]>([]),
  code = ref('')
const product = computed(() => products.value.find((p) => p.code === code.value))
const manager = computed(() => ['PLATFORM_ADMIN', 'DATA_STEWARD'].includes(user.value?.role || ''))
const plan = ref(emptyPlan()),
  rows = ref<Row[]>([]),
  meta = ref<Record<string, unknown>>({})
const filters = ref<
  { field: string; operator: string; value: string; end: string; type: string }[]
>([])
const sortField = ref(''),
  sortDirection = ref('asc')
const templateForm = ref({
  code: '',
  examples: '',
  allowed_roles: ['PLATFORM_ADMIN', 'DATA_STEWARD', 'ANALYST', 'VIEWER'],
})
const access = ref<string[]>([]),
  productStatus = ref('ACTIVE')
const report = ref('sales/summary'),
  startDate = ref(''),
  endDate = ref('')
const outputFields = computed(() => [...plan.value.dimensions, ...plan.value.metrics])
const lastQuery = ref<{ code: string; plan: QueryPlan } | null>(null)
function requestPlan(): QueryPlan {
  if (!product.value) throw new Error('Pilih produk data.')
  if (!Number.isInteger(plan.value.limit) || plan.value.limit < 1 || plan.value.limit > 1000)
    throw new Error('Batas baris harus angka bulat 1–1000.')
  if (sortField.value && !outputFields.value.includes(sortField.value))
    throw new Error('Pilih ulang field pengurutan dari output query.')
  function scalar(value: string, type: string): unknown {
    if (type === 'null') return null
    if (type === 'number') {
      if (!value.trim() || !Number.isFinite(Number(value)))
        throw new Error('Nilai filter angka tidak valid.')
      return Number(value)
    }
    if (type === 'boolean') {
      if (!['true', 'false'].includes(value)) throw new Error('Isi boolean dengan true atau false.')
      return value === 'true'
    }
    return value
  }
  return {
    ...plan.value,
    metrics: [...plan.value.metrics],
    dimensions: [...plan.value.dimensions],
    filters: filters.value.map((f) => {
      if (!f.field || (f.type === 'null' && f.operator !== 'eq'))
        throw new Error('Lengkapi filter. Nilai null hanya mendukung eq.')
      const value =
        f.operator === 'between'
          ? [scalar(f.value, f.type), scalar(f.end, f.type)]
          : f.operator === 'in'
            ? f.value
                .split('\n')
                .filter((v) => v.trim())
                .map((v) => scalar(v, f.type))
            : scalar(f.value, f.type)
      if (Array.isArray(value) && (!value.length || value.length > 100))
        throw new Error('Filter in memerlukan 1–100 nilai.')
      return { field: f.field, operator: f.operator, value }
    }),
    sort: sortField.value ? [{ field: sortField.value, direction: sortDirection.value }] : [],
  }
}
async function load() {
  const results = await Promise.all([
    call<Product[]>('GET', '/data-products'),
    call<SavedQuery[]>('GET', '/semantic/query-templates'),
  ])
  products.value = results[0]
  templates.value = results[1]
}
async function query(offset = 0) {
  rows.value = []
  meta.value = {}
  lastQuery.value = null
  const payload = requestPlan()
  payload.offset = offset
  const result = await api.post<ApiEnvelope<Row[]>>(
    `/data-products/${encodeURIComponent(code.value)}/query`,
    payload,
  )
  rows.value = result.data.data
  meta.value = result.data.meta
  plan.value.offset = offset
  lastQuery.value = { code: code.value, plan: payload }
}
async function exportRows() {
  if (!lastQuery.value) throw new Error('Jalankan query terlebih dahulu.')
  await downloadFile(
    `/data-products/${encodeURIComponent(lastQuery.value.code)}/export`,
    'data-export.csv',
    lastQuery.value.plan,
  )
}
async function saveTemplate() {
  await call('POST', '/semantic/query-templates', {
    code: templateForm.value.code,
    data_product_code: code.value,
    plan: requestPlan(),
    examples: templateForm.value.examples.split('\n').filter(Boolean),
    allowed_roles: templateForm.value.allowed_roles,
  })
  await load()
  notice.value = 'Template tersimpan sebagai DRAFT. Validasi dan aktifkan sebelum digunakan.'
}
async function runTemplate(template: SavedQuery) {
  rows.value = []
  meta.value = {}
  lastQuery.value = null
  const result = await api.post<ApiEnvelope<Row[]>>(
    `/saved-queries/${encodeURIComponent(template.code)}/run`,
  )
  rows.value = result.data.data
  meta.value = result.data.meta
}
async function reportQuery() {
  if (
    report.value.startsWith('sales/') &&
    (!startDate.value || !endDate.value || endDate.value < startDate.value)
  )
    throw new Error('Isi rentang tanggal laporan yang valid.')
  rows.value = []
  meta.value = {}
  lastQuery.value = null
  const response = await api.get<ApiEnvelope<Row[] | Record<string, number>>>(
    `/reports/${report.value}`,
    {
      params: report.value.startsWith('sales/')
        ? { start_date: startDate.value, end_date: endDate.value }
        : undefined,
    },
  )
  rows.value = Array.isArray(response.data.data)
    ? response.data.data
    : Object.entries(response.data.data).map(([status, count]) => ({ status, count }))
  meta.value = response.data.meta
}
watch(code, () => {
  plan.value = emptyPlan()
  filters.value = []
  sortField.value = ''
  rows.value = []
  meta.value = {}
  lastQuery.value = null
  access.value = [...(product.value?.allowed_roles || [])]
  productStatus.value = product.value?.status || 'ACTIVE'
})
watch(
  [plan, filters, sortField, sortDirection],
  () => {
    lastQuery.value = null
  },
  { deep: true, flush: 'sync' },
)
watch(
  user,
  () => {
    products.value = []
    templates.value = []
    rows.value = []
    meta.value = {}
    code.value = ''
    lastQuery.value = null
    templateForm.value = {
      code: '',
      examples: '',
      allowed_roles: ['PLATFORM_ADMIN', 'DATA_STEWARD', 'ANALYST', 'VIEWER'],
    }
    startDate.value = ''
    endDate.value = ''
    report.value = 'sales/summary'
    access.value = []
    if (user.value) void run(load)
  },
  { immediate: true },
)
</script>
<template>
  <EtlShell>
    <p class="eyebrow">ANALITIK</p>
    <h1>Dashboard data</h1>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <p v-if="busy" role="status">Memproses…</p>
    <section class="panel">
      <h2>Susun query dari katalog</h2>
      <button :disabled="busy" @click="run(load)">Muat ulang katalog</button>
      <p v-if="!products.length" class="notice">
        Belum ada produk aktif yang diizinkan untuk akun ini. Selesaikan deployment dan sinkronisasi
        sumber terlebih dahulu.
      </p>
      <fieldset :disabled="busy">
        <label
          >Produk data<select v-model="code">
            <option value="">Pilih produk</option>
            <option v-for="p in products" :key="p.id" :value="p.code">
              {{ p.name }} · {{ p.code }}
            </option>
          </select></label
        >
        <template v-if="product">
          <p>{{ product.description }}</p>
          <p class="muted">
            Versi {{ product.version }} · pembaruan data {{ product.freshness_version }}
          </p>
          <div class="grid">
            <div>
              <h3>Dimensi</h3>
              <label v-for="dimension in product.dimensions" :key="dimension" class="check"
                ><input
                  v-model="plan.dimensions"
                  type="checkbox"
                  :value="dimension"
                  :disabled="plan.dimensions.length >= 20 && !plan.dimensions.includes(dimension)"
                />{{ dimension }}</label
              >
            </div>
            <div>
              <h3>Metrik</h3>
              <label v-for="metric in product.metrics" :key="metric.code" class="check"
                ><input
                  v-model="plan.metrics"
                  type="checkbox"
                  :value="metric.code"
                  :disabled="plan.metrics.length >= 20 && !plan.metrics.includes(metric.code)"
                />{{ metric.label || metric.code }}</label
              >
            </div>
          </div>
          <h3>Filter (semua kondisi harus sesuai)</h3>
          <div v-for="(filter, index) in filters" :key="index" class="card-row grid">
            <label
              >Dimensi<select v-model="filter.field">
                <option v-for="d in product.dimensions" :key="d">{{ d }}</option>
              </select></label
            >
            <label
              >Operator<select v-model="filter.operator">
                <option v-for="op in ['eq', 'in', 'between', 'gte', 'lte', 'gt', 'lt']" :key="op">
                  {{ op }}
                </option>
              </select></label
            >
            <label
              >Tipe nilai<select v-model="filter.type">
                <option value="text">Teks / tanggal</option>
                <option value="number">Angka</option>
                <option value="boolean">Boolean</option>
                <option value="null">Null</option>
              </select></label
            >
            <label v-if="filter.type !== 'null'"
              >{{ filter.operator === 'in' ? 'Nilai (satu per baris)' : 'Nilai / batas awal'
              }}<textarea v-model="filter.value" rows="2" />
            </label>
            <label v-if="filter.operator === 'between'"
              >Batas akhir<input v-model="filter.end" /></label
            ><button @click="filters.splice(index, 1)">Hapus filter</button>
          </div>
          <button
            :disabled="filters.length >= 20 || !product.dimensions.length"
            @click="
              filters.push({
                field: product.dimensions[0] || '',
                operator: 'eq',
                value: '',
                end: '',
                type: 'text',
              })
            "
          >
            Tambah filter
          </button>
          <div class="grid">
            <label
              >Kelompok waktu<select v-model="plan.time_grain">
                <option
                  v-for="grain in ['none', 'day', 'week', 'month', 'quarter', 'year']"
                  :key="grain"
                >
                  {{ grain }}
                </option>
              </select></label
            >
            <label
              >Urutkan<select v-model="sortField">
                <option value="">Tanpa pengurutan</option>
                <option v-for="field in outputFields" :key="field">{{ field }}</option>
              </select></label
            >
            <label
              >Arah<select v-model="sortDirection">
                <option>asc</option>
                <option>desc</option>
              </select></label
            ><label
              >Batas baris<input v-model.number="plan.limit" type="number" min="1" max="1000"
            /></label>
          </div>
          <button class="primary" @click="run(() => query())">Jalankan query</button>
        </template>
      </fieldset>
    </section>
    <section class="panel">
      <h2>Hasil</h2>
      <DataTable :rows="rows" />
      <p class="muted">
        {{ rows.length }} baris pada hasil ini; bukan jumlah keseluruhan. Nilai kosong ditampilkan
        sebagai —.
      </p>
      <p v-if="meta.query_source">
        Sumber: {{ meta.query_source }} · cache: {{ meta.cached ? 'ya' : 'tidak' }}
      </p>
      <ResultChart v-if="rows.length" :rows="rows" />
      <div v-if="lastQuery" class="toolbar">
        <button
          :disabled="busy || lastQuery.plan.offset === 0"
          @click="run(() => query(Math.max(0, plan.offset - plan.limit)))"
        >
          Sebelumnya</button
        ><button
          :disabled="
            busy || rows.length < lastQuery.plan.limit || plan.offset + plan.limit > 100000
          "
          @click="run(() => query(plan.offset + plan.limit))"
        >
          Berikutnya</button
        ><button :disabled="busy" @click="run(exportRows)">Ekspor halaman CSV</button>
      </div>
    </section>
    <section class="panel">
      <h2>Laporan operasional</h2>
      <form @submit.prevent="run(reportQuery)">
        <fieldset :disabled="busy">
          <div class="grid">
            <label
              >Laporan<select v-model="report">
                <option value="sales/summary">Ringkasan penjualan</option>
                <option value="sales/by-branch">Penjualan per cabang</option>
                <option value="sales/trend">Tren penjualan</option>
                <option value="inventory/stock-position">Posisi stok</option>
                <option v-if="manager" value="data-quality/summary">Kualitas data</option>
              </select></label
            ><label v-if="report.startsWith('sales/')"
              >Mulai<input v-model="startDate" type="date" required /></label
            ><label v-if="report.startsWith('sales/')"
              >Sampai<input v-model="endDate" type="date" :min="startDate" required
            /></label>
          </div>
          <p class="muted">
            Laporan memerlukan katalog SALES/INVENTORY yang sesuai. Hasil terbatas pada limit
            backend.
          </p>
          <button>Tampilkan laporan</button>
        </fieldset>
      </form>
    </section>
    <section class="panel">
      <h2>Query tersimpan</h2>
      <p v-if="!templates.length">Belum ada template yang dapat diakses.</p>
      <div v-for="t in templates" :key="t.id" class="toolbar">
        <strong>{{ t.code }}</strong
        ><span class="tag">{{ t.status }}</span
        ><button :disabled="busy || t.status !== 'ACTIVE'" @click="run(() => runTemplate(t))">
          Jalankan</button
        ><template v-if="manager"
          ><button
            :disabled="busy"
            @click="
              run(async () => {
                await call('POST', `/semantic/query-templates/${t.id}/validate`)
                await load()
              })
            "
          >
            Validasi</button
          ><button
            :disabled="busy || t.status !== 'VALIDATED'"
            @click="
              run(async () => {
                await call('POST', `/semantic/query-templates/${t.id}/activate`)
                await load()
              })
            "
          >
            Aktifkan
          </button></template
        >
      </div>
      <details v-if="manager && product">
        <summary>Simpan query saat ini sebagai template</summary>
        <form @submit.prevent="run(saveTemplate)">
          <fieldset :disabled="busy">
            <label
              >Kode template<input
                v-model="templateForm.code"
                required
                pattern="[a-zA-Z][a-zA-Z0-9_]*"
                maxlength="63" /></label
            ><label
              >Contoh pertanyaan (satu per baris)<textarea v-model="templateForm.examples" /></label
            ><label v-for="role in roles" :key="role" class="check"
              ><input v-model="templateForm.allowed_roles" type="checkbox" :value="role" />{{
                role
              }}</label
            ><button>Simpan draft template</button>
          </fieldset>
        </form>
      </details>
    </section>
    <details v-if="manager && product" class="panel">
      <summary>Akses produk analitik</summary>
      <p class="notice">
        Perubahan akses/status menaikkan versi produk dan dapat membuat template perlu divalidasi
        ulang. Produk suspended tidak muncul di katalog aktif.
      </p>
      <fieldset :disabled="busy">
        <label v-for="role in roles" :key="role" class="check"
          ><input v-model="access" type="checkbox" :value="role" />{{ role }}</label
        ><label
          >Status<select v-model="productStatus">
            <option>ACTIVE</option>
            <option>SUSPENDED</option>
          </select></label
        ><button
          @click="
            run(async () => {
              await call('PATCH', `/semantic/data-products/${product!.id}`, {
                allowed_roles: access,
                status: productStatus,
              })
              code = ''
              await load()
              notice = 'Pengaturan produk tersimpan.'
            })
          "
        >
          Simpan akses produk
        </button>
      </fieldset>
    </details>
  </EtlShell>
</template>
