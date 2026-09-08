<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import EtlShell from '@/components/EtlShell.vue'
import { call, editRoles, reviewRoles, user, type Config, type Sheet, type Source } from '@/lib/etl'
import { createImportReview, type ImportReview } from '@/lib/importReviews'
import { useTask } from '@/lib/tasks'
const router = useRouter(),
  { busy, error, run } = useTask()
const readable = computed(() => [...editRoles, ...reviewRoles].includes(user.value?.role || ''))
const editor = computed(() => editRoles.includes(user.value?.role || ''))
const sources = ref<Source[]>([]),
  sheets = ref<Sheet[]>([]),
  configs = ref<Config[]>([]),
  reviews = ref<ImportReview[]>([])
const sourceId = ref(''),
  sheetId = ref(''),
  configId = ref(''),
  status = ref('')
const offset = ref(0),
  hasMore = ref(false)
const selectedSheet = computed(() => sheets.value.find((s) => s.id === sheetId.value) || null)
async function loadSources() {
  sources.value = await call<Source[]>('GET', '/sources?offset=0&limit=100')
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
      <form class="toolbar" @submit.prevent="run(create)">
        <label
          >Sumber<select v-model="sourceId" required>
            <option value="">Pilih sumber</option>
            <option v-for="s in sources" :key="s.id" :value="s.id">
              {{ s.name }} ({{ s.source_code }})
            </option>
          </select></label
        ><label
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
        <p v-else-if="selectedSheet?.dataset_kind === 'MASTER'" class="muted">
          MASTER memakai binding approved; configuration_id tidak dikirim.
        </p>
        <p v-else-if="sheetId" class="notice">Konfirmasi klasifikasi tab sebelum membuat batch.</p>
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
