<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { call, user, type Job, type ProcessAttention } from '@/lib/etl'
import ProcessAttentionButton from '@/components/ProcessAttentionButton.vue'
import { getApiErrorMessage } from '@/lib/api'

const props = defineProps<{ sourceId: string; sourceName: string }>()
const emit = defineEmits<{ completed: [] }>()
interface Batch {
  id?: string
  source_sheet_id: string
  sheet_name: string
  status: string
  code?: string
  message?: string
  finding_count?: number
  attention?: ProcessAttention | null
  checkpoint?: { rows_valid?: number; rows_applied?: number; ai_coverage?: string; blocking_codes?: string[]; auto_load_error?: string }
}
interface SyncResult { reviews: Batch[] }
function isSyncResult(value: unknown): value is SyncResult {
  return typeof value === 'object' && value !== null && 'reviews' in value &&
    Array.isArray(value.reviews) && value.reviews.every((item: unknown) =>
      typeof item === 'object' && item !== null &&
      'status' in item && typeof item.status === 'string' &&
      'source_sheet_id' in item && typeof item.source_sheet_id === 'string' &&
      'sheet_name' in item && typeof item.sheet_name === 'string' &&
      (item.status === 'BLOCKED' || ('id' in item && typeof item.id === 'string')),
    )
}
const confirming = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const job = ref<Job | null>(null)
const batches = ref<Batch[]>([])
const panel = ref<HTMLElement | null>(null)
const running = computed(() =>
  busy.value || (job.value && ['QUEUED', 'RUNNING'].includes(job.value.status)) ||
  batches.value.some((batch) => ['VALIDATING', 'AI_REVIEWING', 'APPLYING'].includes(batch.status)),
)
let timer: ReturnType<typeof setTimeout> | undefined
let epoch = 0
let deadline = 0
let completed = false

async function openConfirmation() {
  if (!running.value) confirming.value = true
  await nextTick()
  panel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
defineExpose({ openConfirmation })

function stop() {
  if (timer) clearTimeout(timer)
  timer = undefined
}
async function monitor(current: number) {
  if (!job.value || current !== epoch) return
  stop()
  try {
    const result = await call<Job>('GET', `/jobs/${job.value.id}`)
    if (current !== epoch) return
    job.value = result
    let pending = ['QUEUED', 'RUNNING'].includes(result.status)
    if (result.status === 'FAILED') {
      throw new Error(`${result.error_code || 'SYNC_FAILED'}: ${result.error_message || 'Sync gagal. Buka monitor job untuk rincian.'}`)
    }
    if (result.status === 'SUCCEEDED') {
      if (!isSyncResult(result.result)) throw new Error('Hasil sync tidak lengkap; buka monitor job.')
      const updated = await Promise.all(result.result.reviews.map(async (batch) => {
        if (!batch.id) return batch
        const detail = await call<Omit<Batch, 'sheet_name'>>('GET', `/import-reviews/${batch.id}`)
        return { ...detail, sheet_name: batch.sheet_name }
      }))
      if (current !== epoch) return
      batches.value = updated
      pending = updated.some((batch) => ['VALIDATING', 'AI_REVIEWING', 'APPLYING'].includes(batch.status))
      if (!pending && !completed) {
        completed = true
        const loaded = updated.filter((batch) => batch.status === 'SUCCEEDED').length
        notice.value = `Sync selesai: ${loaded} tab berhasil dimuat. Tab dengan blocker belum dimuat; buka hasil batch untuk rinciannya.`
        emit('completed')
      }
    }
    if (pending && Date.now() < deadline) timer = setTimeout(() => void monitor(current), 3000)
    else if (pending) error.value = 'Batas pemantauan 10 menit tercapai. Muat ulang hasil atau buka monitor job; jangan buat sync duplikat.'
  } catch (cause) {
    if (current === epoch) error.value = getApiErrorMessage(cause)
  }
}
async function start() {
  if (running.value) return
  const current = ++epoch
  stop()
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const queued = await call<{ job_id: string; status: string }>('POST', `/sources/${props.sourceId}/sync-review/start`)
    if (current !== epoch) return
    job.value = { id: queued.job_id, status: queued.status }
    batches.value = []
    confirming.value = false
    completed = false
    deadline = Date.now() + 600_000
    await monitor(current)
  } catch (cause) {
    if (current === epoch) error.value = getApiErrorMessage(cause)
  } finally {
    if (current === epoch) busy.value = false
  }
}
function refresh() {
  error.value = ''
  deadline = Date.now() + 600_000
  void monitor(epoch)
}
watch(() => [props.sourceId, user.value?.id], () => {
  ++epoch
  stop()
  job.value = null
  batches.value = []
  error.value = ''
  notice.value = ''
  confirming.value = false
  busy.value = false
})
onBeforeUnmount(() => { ++epoch; stop() })
</script>

<template>
  <section ref="panel" class="card-row" aria-live="polite">
    <h3>Sync manual · {{ sourceName }}</h3>
    <p>Sync membaca data terbaru dan langsung memuat tab NON_MASTER yang lolos validasi terhadap konfigurasi aktif yang sudah disetujui. Perubahan konfigurasi, konflik, atau temuan keamanan/PII menghentikan pemuatan tab tersebut.</p>
    <button class="primary" :disabled="running" @click="openConfirmation">Sync manual</button>
    <div v-if="confirming" class="notice">
      <p>Jalankan sync seluruh tab yang siap pada sumber ini? Data yang lolos validasi akan langsung dimuat ke database berdasarkan konfigurasi aktif yang sudah disetujui. Pemeriksaan AI dapat memakai kuota/biaya. Tidak mengubah Google Sheet; tab dengan blocker tidak dimuat.</p>
      <button :disabled="busy" @click="start">Jalankan sync sekarang</button>
      <button :disabled="busy" @click="confirming = false">Batal sync</button>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <div v-if="job" class="toolbar">
      <span>Proses sync: {{ job.status }}</span>
      <RouterLink :to="{ path: '/jobs', query: { job: job.id } }">Buka monitor sync</RouterLink>
      <button :disabled="busy" @click="refresh">Muat ulang hasil sync</button>
    </div>
    <ul v-if="batches.length">
      <li v-for="batch in batches" :key="batch.source_sheet_id">
        <strong>{{ batch.sheet_name }}</strong> · {{ batch.status === 'NEEDS_INPUT' ? 'Menunggu tindakan' : batch.status }}
        <span v-if="batch.checkpoint?.rows_valid !== undefined"> · {{ batch.checkpoint.rows_valid }} baris valid</span>
        <span v-if="batch.status === 'SUCCEEDED' && batch.checkpoint?.rows_applied !== undefined"> · {{ batch.checkpoint.rows_applied }} baris dimuat</span>
        <span v-if="batch.checkpoint?.ai_coverage"> · cakupan AI {{ batch.checkpoint.ai_coverage }}</span>
        <span v-if="batch.finding_count"> · {{ batch.finding_count }} temuan</span>
        <span v-if="batch.code"> · {{ batch.code }}: {{ batch.message }}</span>
        <span v-if="batch.checkpoint?.blocking_codes?.length"> · {{ batch.checkpoint.blocking_codes.join(', ') }}</span>
        <span v-if="batch.checkpoint?.auto_load_error"> · {{ batch.checkpoint.auto_load_error }}</span>
        <ProcessAttentionButton v-if="batch.attention || batch.status === 'BLOCKED'" :attention="batch.attention || { status: batch.status, blocking_codes: batch.code ? [batch.code] : [], message: batch.message || 'Tab belum dapat dimuat.' }" :label="batch.sheet_name" />
        <RouterLink v-if="batch.id" :to="`/import-reviews/${batch.id}`"> Buka hasil review</RouterLink>
      </li>
    </ul>
    <RouterLink to="/guide#sync-manual">Helper: sync, temuan, approval, dan pemuatan data</RouterLink>
  </section>
</template>
