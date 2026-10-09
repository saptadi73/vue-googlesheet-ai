<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import EtlShell from '@/components/EtlShell.vue'
import FormActionRow from '@/components/ui/FormActionRow.vue'
import PagedDataTable from '@/components/ui/PagedDataTable.vue'
import { api, type ApiEnvelope } from '@/lib/api'
import { call, editRoles, reviewRoles, user, type Config, type Sheet, type Source } from '@/lib/etl'
import { createImportReview, type ImportReview } from '@/lib/importReviews'
import { useTask } from '@/lib/tasks'
const router = useRouter(),
  { busy, error, run } = useTask()
const readable = computed(() => [...editRoles, ...reviewRoles].includes(user.value?.role || ''))
const editor = computed(() => editRoles.includes(user.value?.role || ''))
type TrackedSource = Source & {
  discovery_status: string
  profiling_status: string
  configuration_status: string
  it_approval_status: string
  database_status: string
  sheets: { id: string; name: string; enabled: boolean; is_present: boolean; dataset_kind: string | null }[]
}
const sources = ref<TrackedSource[]>([]),
  sheets = ref<Sheet[]>([]),
  configs = ref<Config[]>([]),
  reviews = ref<ImportReview[]>([])
const selectedSource = ref<TrackedSource | null>(null)
const sourceSearch = ref('')
const sourceTotal = ref(0)
const sourceOffset = ref(0)
const sourceLimit = 25
const sourceId = ref(''),
  sheetId = ref(''),
  configId = ref(''),
  status = ref('')
const offset = ref(0),
  hasMore = ref(false)
const selectedSheet = computed(() => sheets.value.find((s) => s.id === sheetId.value) || null)
const sourceTableRows = computed(() => sources.value as unknown as Record<string, unknown>[])
let sourceSearchTimer: ReturnType<typeof setTimeout> | undefined
const sourceColumns = [
  { key: 'source', label: 'Sumber' },
  { key: 'discovery_status', label: 'Discovery' },
  { key: 'profiling_status', label: 'Profiling' },
  { key: 'configuration_status', label: 'Konfigurasi / binding' },
  { key: 'it_approval_status', label: 'Approval IT' },
  { key: 'database_status', label: 'Database' },
  { key: 'select', label: 'Pilih' },
]
async function loadSources() {
  const response = await api.get<ApiEnvelope<TrackedSource[]>>('/sources/tracking', {
    params: { offset: sourceOffset.value, limit: sourceLimit, search: sourceSearch.value.trim(), include_unlinked: false },
  })
  sources.value = response.data.data
  sourceTotal.value = Number(response.data.meta.total || 0)
}
async function loadSheets() {
  sheets.value = sourceId.value
    ? await call<Sheet[]>('GET', `/sources/${sourceId.value}/sheets`)
    : []
}
async function loadConfigs() {
  configs.value = sheetId.value
    ? await call<Config[]>('GET', `/source-sheets/${sheetId.value}/configurations`)
    : []
}
async function loadReviews(next = 0) {
  const q = new URLSearchParams({ offset: String(next), limit: '50' })
  if (status.value) q.set('status', status.value)
  const result = await call<{ items: ImportReview[]; has_more: boolean }>(
    'GET',
    `/import-reviews?${q}`,
  )
  reviews.value = result.items
  hasMore.value = result.has_more
  offset.value = next
}
async function create() {
  if (!sheetId.value) return
  const result = await createImportReview(
    sheetId.value,
    selectedSheet.value?.dataset_kind === 'NON_MASTER' ? configId.value : undefined,
  )
  await router.push(`/import-reviews/${result.review.id}`)
}
watch(
  user,
  () => {
    sources.value = []
    selectedSource.value = null
    sourceTotal.value = 0
    sourceOffset.value = 0
    sheets.value = []
    configs.value = []
    reviews.value = []
    if (readable.value)
      void run(async () => {
        await loadSources()
        await loadReviews()
      })
  },
  { immediate: true },
)
watch(sourceId, () => {
  sheetId.value = ''
  configId.value = ''
  void run(loadSheets)
})
watch(sourceSearch, () => {
  clearTimeout(sourceSearchTimer)
  sourceSearchTimer = setTimeout(() => {
    sourceOffset.value = 0
    void run(loadSources)
  }, 250)
})
watch(sheetId, () => {
  configId.value = ''
  void run(loadConfigs)
})
</script>
<template>
  <EtlShell
    ><p class="eyebrow">IMPORT REVIEW</p>
    <h1>Review batch import</h1>
    <p class="notice">
      Batch memakai snapshot tersimpan. Setelah blocker selesai, gunakan preview, approval, lalu
      apply dari detail batch.
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <section v-if="editor" class="panel">
      <h2>Buat batch review</h2>
      <p class="muted">Cari dan pilih sumber pada daftar. Status tiap tahap membantu memastikan sumber siap diproses.</p>
      <PagedDataTable
        :rows="sourceTableRows"
        :columns="sourceColumns"
        :total="sourceTotal"
        :offset="sourceOffset"
        :limit="sourceLimit"
        :search="sourceSearch"
        :loading="busy"
        empty-text="Sumber tidak ditemukan. Periksa kata pencarian atau status tahapnya."
        @update:search="sourceSearch = $event"
        @page="sourceOffset = $event; run(loadSources)"
      >
        <template #cell-source="{ row }">
          <strong>{{ row.name }}</strong><small class="muted block">{{ row.source_code }}</small>
        </template>
        <template #cell-discovery_status="{ row }">{{ row.discovery_status }}</template>
        <template #cell-profiling_status="{ row }">{{ row.profiling_status }}</template>
        <template #cell-configuration_status="{ row }">{{ row.configuration_status }}</template>
        <template #cell-it_approval_status="{ row }">{{ row.it_approval_status }}</template>
        <template #cell-database_status="{ row }">{{ row.database_status }}</template>
        <template #cell-select="{ row }">
          <button type="button" :class="sourceId === row.id ? 'primary' : ''" :disabled="busy" @click="selectedSource = row as unknown as TrackedSource; sourceId = String(row.id)">
            {{ sourceId === row.id ? 'Dipilih' : 'Pilih sumber' }}
          </button>
        </template>
      </PagedDataTable>
      <p v-if="selectedSource" class="notice">Sumber terpilih: <strong>{{ selectedSource.name }}</strong> · {{ selectedSource.source_code }}</p>
      <form class="batch-create-form" @submit.prevent="run(create)">
        <FormActionRow>
          <label
            >Tab<select v-model="sheetId" required>
              <option value="">Pilih tab</option>
              <option v-for="s in sheets.filter((s) => s.enabled)" :key="s.id" :value="s.id">
                {{ s.sheet_name }} · {{ s.dataset_kind || 'belum diklasifikasi' }}
              </option>
            </select></label
          ><label v-if="selectedSheet?.dataset_kind === 'NON_MASTER'"
            >Konfigurasi approved/active<select v-model="configId">
              <option value="">Pilih konfigurasi</option>
              <option
                v-for="c in configs.filter((c) => ['APPROVED', 'ACTIVE'].includes(c.status))"
                :key="c.id"
                :value="c.id"
              >
                {{ c.configuration_json.dataset_business_name }} · revisi {{ c.revision_no }}
              </option>
            </select></label
          >
          <template #actions>
            <button
              class="primary"
              :disabled="
                busy ||
                !selectedSheet?.dataset_kind ||
                (selectedSheet?.dataset_kind === 'NON_MASTER' && !configId)
              "
            >
              Buat batch
            </button>
          </template>
        </FormActionRow>
        <p v-if="selectedSheet?.dataset_kind === 'MASTER'" class="muted batch-create-hint">
          MASTER memakai binding approved; configuration_id tidak dikirim.
        </p>
        <p
          v-else-if="sheetId && selectedSheet?.dataset_kind !== 'NON_MASTER'"
          class="notice batch-create-hint"
        >
          Konfirmasi klasifikasi tab sebelum membuat batch.
        </p>
      </form>
    </section>
    <section class="panel">
      <div class="toolbar">
        <h2>Batch tersimpan</h2>
        <select v-model="status" @change="run(() => loadReviews())">
          <option value="">Semua status</option>
          <option
            v-for="s in [
              'VALIDATING',
              'AI_REVIEWING',
              'NEEDS_INPUT',
              'FAILED',
              'STALE_REVIEW',
              'CANCELLED',
              'READY_FOR_APPROVAL',
              'APPROVED',
              'APPLYING',
              'SUCCEEDED',
            ]"
            :key="s"
          >
            {{ s }}
          </option></select
        ><button :disabled="busy" @click="run(() => loadReviews())">Muat ulang</button>
      </div>
      <p v-if="!reviews.length">Belum ada batch pada halaman ini.</p>
      <article v-for="r in reviews" :key="r.id" class="card-row">
        <h3>{{ r.dataset_kind }} · {{ r.status }}</h3>
        <p>
          {{ r.id }} · revisi {{ r.revision_no }} · temuan {{ r.finding_count }} ·
          {{ r.execution_ready ? 'siap' : 'belum siap' }}
        </p>
        <RouterLink class="button" :to="`/import-reviews/${r.id}`">Buka detail batch</RouterLink>
      </article>
      <div class="toolbar">
        <button
          :disabled="busy || offset === 0"
          @click="run(() => loadReviews(Math.max(0, offset - 50)))"
        >
          Sebelumnya</button
        ><button :disabled="busy || !hasMore" @click="run(() => loadReviews(offset + 50))">
          Berikutnya
        </button>
      </div>
    </section></EtlShell
  >
</template>
