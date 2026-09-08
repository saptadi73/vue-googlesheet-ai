<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import EtlShell from '@/components/EtlShell.vue'
import DataTable from '@/components/DataTable.vue'
import { call, editRoles, user } from '@/lib/etl'
import { type Finding, type ImportReview } from '@/lib/importReviews'
import { useTask } from '@/lib/tasks'
const route = useRoute(),
  id = computed(() => String(route.params.id)),
  { busy, error, notice, run } = useTask()
const review = ref<ImportReview | null>(null),
  findings = ref<Finding[]>([]),
  findingsMore = ref(false),
  findingOffset = ref(0),
  comment = ref('')
const findingRows = computed(() => findings.value as Record<string, unknown>[])
const canEdit = computed(() => editRoles.includes(user.value?.role || ''))
let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0
const terminal = ['NEEDS_INPUT', 'FAILED', 'STALE_REVIEW', 'CANCELLED', 'SUCCEEDED', 'APPROVED']
function stop() {
  ++generation
  if (timer) clearTimeout(timer)
}
async function loadFindings(next = 0) {
  const result = await call<{ items: Finding[]; has_more: boolean }>(
    'GET',
    `/import-reviews/${id.value}/findings?offset=${next}&limit=50`,
  )
  findings.value = result.items
  findingsMore.value = result.has_more
  findingOffset.value = next
}
async function load() {
  stop()
  const epoch = generation
  const result = await call<ImportReview>('GET', `/import-reviews/${id.value}`)
  if (epoch !== generation) return
  review.value = result
  await loadFindings()
  if (epoch === generation && !terminal.includes(result.status))
    timer = setTimeout(() => void poll(epoch), 3000)
}
async function poll(epoch: number) {
  if (epoch !== generation) return
  const result = await call<ImportReview>('GET', `/import-reviews/${id.value}`)
  if (epoch !== generation) return
  review.value = result
  if (!terminal.includes(result.status)) timer = setTimeout(() => void poll(epoch), 3000)
  else await loadFindings()
}
async function action(kind: 'cancel' | 'revalidate' | 'resume') {
  if (!review.value) return
  const result = await call<ImportReview>('POST', `/import-reviews/${id.value}/${kind}`, {
    revision_no: review.value.revision_no,
    comment: comment.value.trim(),
  })
  review.value = result
  notice.value = `Aksi ${kind} diterima. Periksa status batch terbaru.`
  await loadFindings()
}
watch(
  [id, user],
  () => {
    review.value = null
    findings.value = []
    if (user.value) void run(load)
  },
  { immediate: true },
)
onBeforeUnmount(stop)
</script>
<template>
  <EtlShell
    ><RouterLink to="/import-reviews">← Daftar batch</RouterLink>
    <h1>Detail batch import</h1>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <template v-if="review"
      ><section class="panel">
        <h2>{{ review.status }} · {{ review.dataset_kind }}</h2>
        <p>{{ review.id }} · revisi {{ review.revision_no }} · generasi {{ review.generation }}</p>
        <p>
          Snapshot {{ review.snapshot_hash }} · dependency
          {{ review.dependencies_current === false ? 'berubah' : 'terkini' }}
        </p>
        <p v-if="review.configuration_id">
          Konfigurasi {{ review.configuration_id }} · revisi {{ review.configuration_revision }}
        </p>
        <p v-if="review.master_id">
          Master {{ review.master_id }} · versi {{ review.master_version }}
        </p>
        <p v-if="review.checkpoint.blocking_codes?.length" class="error">
          Blocker: {{ review.checkpoint.blocking_codes.join(', ') }}
        </p>
        <p>
          Baris valid {{ review.checkpoint.rows_valid ?? '—' }} · invalid
          {{ review.checkpoint.rows_invalid ?? '—' }} · warning
          {{ review.checkpoint.warning_count ?? 0 }} · AI {{ review.checkpoint.ai_coverage || '—' }}
        </p>
        <p v-if="review.status === 'SUCCEEDED'" class="notice">
          Job selesai, tetapi BE-05 belum melakukan apply ke target.
        </p>
        <label v-if="canEdit"
          >Catatan aksi<textarea v-model="comment" maxlength="2000" :disabled="busy" />
        </label>
        <div v-if="canEdit" class="toolbar">
          <button
            :disabled="
              busy || ['CANCELLED', 'SUCCEEDED', 'APPLYING', 'APPROVED'].includes(review.status)
            "
            @click="run(() => action('cancel'))"
          >
            Batalkan batch</button
          ><button
            :disabled="busy || !['FAILED', 'STALE_REVIEW'].includes(review.status)"
            @click="run(() => action('revalidate'))"
          >
            Revalidate</button
          ><button
            :disabled="busy || review.status !== 'NEEDS_INPUT'"
            @click="run(() => action('resume'))"
          >
            Resume
          </button>
        </div>
      </section>
      <section class="panel">
        <h2>Temuan ({{ review.finding_count }})</h2>
        <p class="muted">Nilai sel mentah tidak ditampilkan.</p>
        <DataTable :rows="findingRows" />
        <div class="toolbar">
          <button
            :disabled="busy || findingOffset === 0"
            @click="run(() => loadFindings(Math.max(0, findingOffset - 50)))"
          >
            Sebelumnya</button
          ><button
            :disabled="busy || !findingsMore"
            @click="run(() => loadFindings(findingOffset + 50))"
          >
            Berikutnya
          </button>
        </div>
      </section></template
    >
    <p v-else-if="busy" role="status">Memuat batch…</p></EtlShell
  >
</template>
