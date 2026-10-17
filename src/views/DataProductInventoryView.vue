<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Eye, FileSpreadsheet, PanelsTopLeft, FilePenLine } from '@lucide/vue'
import EtlShell from '@/components/EtlShell.vue'
import PagedDataTable from '@/components/ui/PagedDataTable.vue'
import ProductMetadata from '@/components/ProductMetadata.vue'
import { call, editRoles, reviewRoles, user } from '@/lib/etl'
import type { Product, ProductInventory } from '@/lib/catalog'
import { getApiErrorMessage } from '@/lib/api'
import type { JoinRelationship } from '@/lib/governance'

const rows = ref<ProductInventory[]>([])
const relationships = ref<JoinRelationship[]>([])
const search = ref('')
const offset = ref(0)
const limit = 20
const busy = ref(false)
const error = ref('')
const detail = ref<ProductInventory | null>(null)
const detailDialog = ref<HTMLDialogElement | null>(null)
let detailTrigger: HTMLButtonElement | null = null
async function showDetails(row: Record<string, unknown>, event: MouseEvent) {
  const item = rows.value.find((item) => item.id === row.id)
  if (!item) return
  detailTrigger = event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null
  detail.value = item
  await nextTick()
  detailDialog.value?.showModal()
}
function closeDetails() {
  detailDialog.value?.close()
  detail.value = null
  detailTrigger?.focus()
  detailTrigger = null
}
watch(() => user.value?.id, closeDetails)
const columns = [
  { key: 'product', label: 'Data product' },
  { key: 'semantic', label: 'Semantic / versi ETL' },
  { key: 'recommendations', label: 'Peluang peningkatan' },
  { key: 'update_status', label: 'Pembaruan / terakhir dimuat' },
  { key: 'actions', label: 'Tindakan' },
]

const filtered = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  if (!term) return rows.value
  return rows.value.filter((item) => [
    item.name, item.code, item.description, item.source_name, item.source_code,
    item.sheet_name, item.database_table, item.semantic_view,
    ...item.columns.flatMap((column) => [column.target_column, column.business_name, column.source_column]),
    ...item.dimensions,
    ...item.metrics.flatMap((metric) => [metric.code, metric.label, metric.description, ...(metric.synonyms || [])]),
  ].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(term)))
})
const pageRows = computed(() => filtered.value.slice(offset.value, offset.value + limit))

watch(search, () => { offset.value = 0 })

async function load() {
  closeDetails()
  busy.value = true
  error.value = ''
  try {
    const [inventory, approvedJoins] = await Promise.all([
      call<ProductInventory[]>('GET', '/semantic/data-product-inventory'),
      call<JoinRelationship[]>('GET', '/semantic/join-relationships'),
    ])
    rows.value = inventory
    relationships.value = approvedJoins
  } catch (cause) {
    error.value = getApiErrorMessage(cause)
  } finally {
    busy.value = false
  }
}

function recommendations(item: ProductInventory) {
  const suggestions: string[] = []
  if (!item.description?.trim()) suggestions.push('Tambahkan deskripsi bisnis dataset.')
  const undocumented = item.columns.filter((column) => !column.business_name?.trim())
  if (undocumented.length) suggestions.push(`${undocumented.length} kolom perlu nama bisnis yang jelas.`)
  const numericColumns = item.columns.filter((column) => ['smallint', 'int', 'integer', 'bigint', 'numeric', 'decimal', 'real', 'double precision'].includes(column.target_type))
  const metricColumns = new Set(item.metrics.map((metric) => metric.column))
  if (numericColumns.some((column) => !metricColumns.has(column.target_column))) suggestions.push('Ada kolom numerik yang belum tercatat sebagai metrik. Pastikan tab ini NON_MASTER; bila ya, minta operator menjalankan backfill semantic. Master dan kolom sensitif dikecualikan. Tinjau unit dan agregasi setelahnya.')
  if (item.metrics.some((metric) => !metric.description?.trim())) suggestions.push('Lengkapi definisi atau rumus bisnis metrik.')
  if (item.metrics.some((metric) => !metric.synonyms?.length)) suggestions.push('Tambahkan sinonim istilah yang biasa dipakai pengguna.')
  if (!item.dimensions.length) suggestions.push('Tinjau dimensi untuk filter dan pengelompokan analitik.')
  if (item.metrics.length && !item.dimensions.length) suggestions.push('Metrik belum memiliki dimensi untuk pemotongan analisis.')
  const hasApprovedJoin = relationships.value.some((relationship) =>
    relationship.left_product_code === item.code || relationship.right_product_code === item.code,
  )
  if (rows.value.length > 1 && !hasApprovedJoin) suggestions.push('Jika perlu analisis gabungan, tinjau relasi dan kardinalitas join dengan product lain.')
  return suggestions
}

function updateMetadata(product: Product) {
  const index = rows.value.findIndex((item) => item.id === product.id)
  if (index < 0) return
  const updated = { ...rows.value[index]!, ...product }
  rows.value[index] = updated
  detail.value = updated
}
function openSheet(item: ProductInventory) {
  return `${item.spreadsheet_url}#gid=${item.sheet_id}`
}
function workspacePath(row: Record<string, unknown>) {
  return { path: '/workspace', query: { source_id: String(row.source_id || '') } }
}
const canOpenWorkspace = computed(() => user.value && [...editRoles, ...reviewRoles].includes(user.value.role))
function dateLabel(value: unknown) {
  return typeof value === 'string' && value ? new Date(value).toLocaleString('id-ID') : 'Belum tercatat'
}

onMounted(load)
</script>

<template>
  <EtlShell>
    <p class="eyebrow">KATALOG OUTPUT ANALITIK</p>
    <h1>Katalog data</h1>
    <p class="muted">Semua data product hasil ETL aktif yang dapat Anda akses, beserta tabel database, semantic metadata, dan sumber asalnya. Gunakan daftar ini untuk menemukan celah metadata atau merencanakan penambahan data.</p>
    <div class="catalog-summary">
      <div><strong>{{ rows.length }}</strong><span>data product aktif</span></div>
      <div><strong>{{ rows.filter((item) => !item.description?.trim()).length }}</strong><span>tanpa deskripsi</span></div>
      <div><strong>{{ rows.filter((item) => recommendations(item).length).length }}</strong><span>perlu tinjauan semantic</span></div>
    </div>
    <section class="panel">
      <div class="catalog-heading">
        <div>
          <h2>Daftar tabel hasil ETL</h2>
          <p class="muted">Klik ikon mata pada Data product untuk melihat sumber/tab, tabel database dan deskripsi. Buka Google Sheet tepat pada tab asal atau lanjutkan perbaikan di Workspace. Status pembaruan berasal dari proses/profil tersimpan, bukan pemantauan langsung Google Sheet. Selama revisi diproses, versi aktif terakhir tetap ditampilkan jika masih dapat diakses.</p>
        </div>
        <button type="button" :disabled="busy" @click="load">Muat ulang</button>
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <PagedDataTable
        class="catalog-table"
        :rows="pageRows as unknown as Record<string, unknown>[]"
        :columns="columns"
        :total="filtered.length"
        :offset="offset"
        :limit="limit"
        :search="search"
        :loading="busy"
        empty-text="Belum ada tabel ETL aktif yang tersedia untuk akun ini."
        @update:search="search = $event"
        @page="offset = $event"
      >
        <template #cell-product="{ row }">
          <div class="catalog-product">
            <strong>{{ row.name }}</strong>
            <button type="button" class="catalog-view" :aria-label="`Lihat detail produk ${row.name}`" :title="`Lihat sumber, tabel dan deskripsi ${row.name}`" @click="showDetails(row, $event)"><Eye :size="18" aria-hidden="true" /></button>
          </div>
          <small class="catalog-subline">{{ row.code }}</small>
        </template>
        <template #cell-semantic="{ row }">
          <span>{{ (row.dimensions as string[]).length }} dimensi · {{ (row.metrics as ProductInventory['metrics']).length }} metrik</span>
          <small class="catalog-subline">{{ (row.dimensions as string[]).slice(0, 4).join(', ') || 'Belum ada dimensi' }}</small>
          <small class="catalog-subline">ETL v{{ row.configuration_version }} · Semantic v{{ row.version }} · refresh {{ row.freshness_version }}</small>
        </template>
        <template #cell-recommendations="{ row }">
          <ul v-if="recommendations(row as unknown as ProductInventory).length" class="catalog-recommendations">
            <li v-for="suggestion in recommendations(row as unknown as ProductInventory)" :key="suggestion">{{ suggestion }}</li>
          </ul>
          <span v-else class="catalog-complete">Metadata utama sudah terisi</span>
        </template>
        <template #cell-update_status="{ row }">
          <strong>{{ row.update_status === 'UPDATING' ? 'Sedang diperbarui' : 'Aktif' }}</strong>
          <small class="catalog-subline">{{ row.update_reason }}</small>
          <small class="catalog-subline">Profil terakhir: {{ dateLabel(row.last_profiled_at) }}</small>
          <small class="catalog-subline">Terakhir aktif / dimuat: {{ dateLabel(row.last_active_at) }}</small>
          <small class="catalog-subline">Konfigurasi aktif: {{ dateLabel(row.last_activated_at) }}</small>
          <small class="catalog-subline">Data dimuat: {{ row.last_loaded_at ? dateLabel(row.last_loaded_at) : 'Belum dimuat' }}</small>
        </template>
        <template #cell-actions="{ row }">
          <div class="catalog-actions">
            <div class="catalog-shortcuts">
              <a class="button catalog-icon-link" :href="openSheet(row as unknown as ProductInventory)" target="_blank" rel="noopener noreferrer" aria-label="Buka Google Sheet" title="Buka Google Sheet"><FileSpreadsheet :size="20" aria-hidden="true" /></a>
              <RouterLink v-if="canOpenWorkspace" class="button catalog-icon-link" :to="workspacePath(row)" aria-label="Buka sumber di Workspace" title="Buka sumber di Workspace"><PanelsTopLeft :size="20" aria-hidden="true" /></RouterLink>
              <RouterLink v-if="canOpenWorkspace" class="button catalog-icon-link" :to="`/configurations/${row.configuration_id}/review`" aria-label="Revisi ETL" title="Revisi ETL"><FilePenLine :size="20" aria-hidden="true" /></RouterLink>
            </div>
            <RouterLink v-if="user?.role === 'PLATFORM_ADMIN'" to="/governance">Atur semantic</RouterLink>
          </div>
        </template>
      </PagedDataTable>
      <dialog v-if="detail" ref="detailDialog" class="catalog-detail" :aria-label="`Detail produk ${detail.name}`" @cancel.prevent="closeDetails" @keydown.esc.prevent.stop="closeDetails" @click="(event) => { if (event.target === detailDialog) closeDetails() }">
        <header><h2>Detail produk · {{ detail.name }}</h2><button type="button" aria-label="Tutup detail produk" @click="closeDetails">Tutup</button></header>
        <dl>
          <dt>Kode produk</dt><dd>{{ detail.code }}</dd>
          <dt>Sumber</dt><dd><a :href="openSheet(detail)" target="_blank" rel="noopener noreferrer">{{ detail.source_name }}</a><small class="catalog-subline">{{ detail.source_code }}</small></dd>
          <dt>Tab Google Sheet</dt><dd>{{ detail.sheet_name }} · gid {{ detail.sheet_id }}</dd>
          <dt>Tabel database</dt><dd><code>{{ detail.database_schema }}.{{ detail.database_table }}</code></dd>
          <dt>View semantic</dt><dd><code>{{ detail.semantic_view }}</code></dd>
          <dt>Deskripsi</dt><dd>{{ detail.description || 'Belum diisi' }}</dd>
        </dl>
        <p class="muted">Editor di bawah hanya memperbarui metadata katalog; tabel database dan data ETL tidak dimuat ulang.</p>
        <ProductMetadata v-if="canOpenWorkspace" :product="detail" @saved="updateMetadata" @reload="load" />
      </dialog>
      <div class="catalog-guidance notice">
        Jika tabel dan isi datanya sudah benar, buka detail produk dan gunakan Edit metadata semantik
        untuk NL2SQL. Perbaiki deskripsi produk/kolom, nama bisnis, sinonim, dimensi, unit, dan definisi
        metrik di sana tanpa profiling, konfigurasi ETL, atau reload. Kolom numerik publik NON_MASTER
        semestinya sudah menjadi metrik awal; produk lama yang belum memilikinya perlu backfill semantic oleh operator. Jika nilai di Google Sheet berubah,
        sync untuk memperbarui data target. Jika header/struktur, mapping, tipe, transformasi, atau
        aturan kualitas perlu diubah, lanjutkan di Workspace ETL; perubahan header/struktur perlu
        discovery dan profiling ulang sebelum revisi ETL. Governance mengelola relationship dan policy
        AI. Relationship join hanya dibuat bila dibutuhkan dan kunci serta kardinalitasnya sudah diverifikasi.
      </div>
    </section>
  </EtlShell>
</template>

<style scoped>
.catalog-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
.catalog-summary > div { display: flex; flex-direction: column; gap: 4px; padding: 16px; border: 1px solid #dce8e2; border-radius: 12px; background: #fff; }
.catalog-summary strong { font-size: 24px; color: #087443; }
.catalog-summary span, .catalog-subline { color: #62796c; font-size: 12px; }
.catalog-subline { display: block; margin-top: 4px; }
.catalog-product { display: flex; align-items: flex-start; gap: 8px; }
.catalog-product strong { flex: 1; min-width: 0; }
.catalog-view { display: inline-flex; flex-shrink: 0; padding: 6px; }
.catalog-table :deep(table) { table-layout: fixed; min-width: 1040px; width: 100%; }
.catalog-table :deep(th:nth-child(1)), .catalog-table :deep(td:nth-child(1)) { width: 19%; }
.catalog-table :deep(th:nth-child(2)), .catalog-table :deep(td:nth-child(2)) { width: 18%; }
.catalog-table :deep(th:nth-child(3)), .catalog-table :deep(td:nth-child(3)) { width: 28%; }
.catalog-table :deep(th:nth-child(4)), .catalog-table :deep(td:nth-child(4)) { width: 20%; }
.catalog-table :deep(th:nth-child(5)), .catalog-table :deep(td:nth-child(5)) { width: 15%; }
.catalog-table :deep(td) { overflow-wrap: anywhere; vertical-align: top; }
.catalog-detail { width: min(760px, calc(100vw - 32px)); max-height: 85vh; overflow: auto; padding: 24px; border: 1px solid #dce8e2; border-radius: 12px; }
.catalog-detail::backdrop { background: rgb(15 23 42 / 55%); }
.catalog-detail header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.catalog-detail h2 { margin-top: 0; }
.catalog-detail dl { display: grid; grid-template-columns: minmax(100px, 150px) minmax(0, 1fr); gap: 12px 16px; }
.catalog-detail dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.catalog-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
.catalog-heading h2, .catalog-heading p { margin-top: 0; }
.catalog-recommendations { margin: 0; padding-left: 18px; }
.catalog-complete { color: #087443; }
.catalog-actions { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.catalog-actions .button { white-space: normal; max-width: 100%; }
.catalog-shortcuts { display: flex; flex-wrap: wrap; gap: 6px; }
.catalog-icon-link { display: inline-flex; align-items: center; justify-content: center; min-width: 40px; min-height: 40px; padding: 8px; }
.catalog-guidance { margin-top: 16px; }
code { overflow-wrap: anywhere; }
@media (max-width: 700px) { .catalog-summary { grid-template-columns: 1fr; } .catalog-heading { flex-direction: column; } }
</style>
