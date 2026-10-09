<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { CircleCheck, CircleHelp, CircleMinus, CircleX, FileText, Trash2 } from '@lucide/vue'
import { api, type ApiEnvelope } from '@/lib/api'
import { call, type Source } from '@/lib/etl'
import PagedDataTable from '@/components/ui/PagedDataTable.vue'

const props = defineProps<{ canManage?: boolean }>()
const emit = defineEmits<{ openSource: [source: Source] }>()
type TrackedSource = Source & {
  discovery_status: string
  profiling_status: string
  configuration_status: string
  database_status: string
  access_review_status: string
  last_failures: Record<string, StageFailure>
  owner_name?: string | null
  steward_name: string | null
  registered_by?: string | null
  sheets: { id: string; name: string; enabled: boolean; is_present: boolean; presence_status: 'PRESENT' | 'MISSING'; rows_loaded: number; profiling_status: string; configuration_status: string; database_status: string; last_failures: Record<string, StageFailure> }[]
}
type StageFailure = { stage: string; status: string; code?: string | null; message?: string | null; occurred_at?: string | null; job_kind?: string }
type StageKey = 'discovery' | 'profiling' | 'configuration' | 'database'
type HistoryEvent = { id: string; occurred_at: string; stage: string; status: string; event: string; summary: string; actor_name?: string | null; error_code?: string | null; error_message?: string | null; details?: Record<string, unknown> }
const rows = ref<TrackedSource[]>([])
const total = ref(0)
const offset = ref(0)
const limit = 25
const search = ref('')
const includeUnlinked = ref(true)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const unlinkTarget = ref<Source | null>(null)
const canonicalId = ref('')
const reason = ref('')
const deleteTarget = ref<Source | null>(null)
const deleteReason = ref('')
const deleteCode = ref('')
const deletePreview = ref<{ can_delete: boolean; blockers: string[]; will_delete: Record<string, number> } | null>(null)
const canonicalOptions = ref<Source[]>([])
const columns = [
  { key: 'name', label: 'Nama sumber' },
  { key: 'spreadsheet_link', label: 'Google Sheet' },
  { key: 'source_identity', label: 'Identitas sumber' },
  { key: 'sheet_summary', label: 'Tab' },
  { key: 'discovery_label', label: 'Discovery' },
  { key: 'profiling_label', label: 'Profiling' },
  { key: 'configuration_label', label: 'Konfigurasi' },
  { key: 'database_label', label: 'Database' },
  { key: 'responsibility_details', label: 'Penanggung jawab' },
  { key: 'access_review_status', label: 'Review akses' },
  { key: 'link_status', label: 'Status link' },
  { key: 'created_at', label: 'Terdaftar' },
  { key: 'actions', label: 'Tindakan' },
]
const stageGuides: Record<StageKey, { title: string; steps: string[] }> = {
  discovery: { title: 'Discovery: menemukan tab Google Sheet', steps: ['Pastikan URL spreadsheet benar dan file sudah dibagikan ke service account backend sebagai Viewer.', 'Pilih sumber di Workspace ETL lalu tekan Temukan tab atau jalankan Hubungkan & profiling untuk sumber baru.', 'Tunggu job selesai. Jika gagal, buka monitor job dan tindak lanjuti pesan/kode error sebelum mencoba lagi.'] },
  profiling: { title: 'Profiling: membaca header dan contoh struktur data', steps: ['Pilih sumber dan tab di Workspace ETL setelah discovery menemukan tab.', 'Pastikan baris header benar, setiap nama kolom terisi, dan tidak ada header yang sama setelah normalisasi.', 'Tekan Profiling ulang. Periksa pesan kegagalan terakhir; ubah pengaturan header/range bila perlu, lalu jalankan ulang.'] },
  configuration: { title: 'Konfigurasi atau binding master', steps: ['Konfirmasi klasifikasi tab sebagai MASTER atau NON_MASTER.', 'Untuk data biasa, buat draft manual dan petakan kolom sumber ke field target. Untuk MASTER, pilih master approved lalu petakan field wajib.', 'Validasi, simpan, ajukan review, dan tunggu approval yang diwajibkan. Periksa error terakhir atau buka halaman konfigurasi/binding dari Workspace.'] },
  database: { title: 'Pemuatan data ke database', steps: ['Pastikan konfigurasi aktif atau binding master sudah approved dan dependency siap.', 'Buat batch import, selesaikan pertanyaan dan temuan, lalu tinjau preview.', 'Minta approval dan jalankan Apply. Pantau job dan error terakhir; binding atau konfigurasi saja belum memuat record.'] },
}
const stageModal = ref<{ source?: TrackedSource; stage: StageKey } | null>(null)
const historySource = ref<TrackedSource | null>(null)
const historyEvents = ref<HistoryEvent[]>([])
const historyLoading = ref(false)
const historyError = ref('')
const historyOffset = ref(0)
const historyTotal = ref(0)
const historyLimit = 50
const detailModal = ref<{ title: string; value?: string; source?: TrackedSource; kind: 'text' | 'tabs' | 'identity' | 'responsibility' } | null>(null)
const activeCanonicalOptions = computed(() => canonicalOptions.value.filter((item) =>
  !item.unlinked_at && item.spreadsheet_id === unlinkTarget.value?.spreadsheet_id && item.id !== unlinkTarget.value?.id,
))
const tableRows = computed(() => rows.value.map((source) => ({
  ...source,
  spreadsheet_link: source.spreadsheet_id ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(source.spreadsheet_id)}/edit` : '',
  source_identity: '',
  responsibility_details: '',
  sheet_summary: source.sheets.length
    ? `${source.sheets.filter((sheet) => sheet.is_present).length} ditemukan · ${source.sheets.filter((sheet) => !sheet.is_present).length} hilang`
    : '0 tab',
  discovery_label: statusLabel(source.discovery_status),
  profiling_label: statusLabel(source.profiling_status),
  configuration_label: statusLabel(source.configuration_status),
  database_label: statusLabel(source.database_status),
  link_status: source.unlinked_at ? `UNLINKED → ${source.unlinked_to_source_id || '—'}` : 'TERHUBUNG',
  actions: '',
})))
let searchTimer: ReturnType<typeof setTimeout> | undefined

async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await api.get<ApiEnvelope<TrackedSource[]>>('/sources/tracking', {
      params: { offset: offset.value, limit, search: search.value.trim(), include_unlinked: includeUnlinked.value },
    })
    rows.value = response.data.data
    total.value = Number(response.data.meta.total || 0)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Daftar sumber gagal dimuat.'
  } finally {
    loading.value = false
  }
}
function statusLabel(value: string) {
  const labels: Record<string, string> = {
    SUCCEEDED: 'Berhasil', SUCCEEDED_WITH_WARNINGS: 'Berhasil · ada peringatan',
    ACTIVE: 'Aktif', APPROVED: 'Disetujui', READY_FOR_APPROVAL: 'Menunggu approval',
    NOT_STARTED: 'Belum dimulai', FAILED: 'Gagal', NEEDS_REVIEW: 'Perlu review',
    QUEUED: 'Dalam antrean', RUNNING: 'Sedang berjalan', STARTED: 'Sedang berjalan',
    RECORDED: 'Tercatat',
    AI_FAILED: 'Rekomendasi AI gagal', PROFILE_FAILED: 'Profiling gagal',
    ACCESS_POLICY_REQUIRED: 'Menunggu policy akses', PENDING: 'Menunggu review',
    REJECTED: 'Ditolak', IN_PROGRESS: 'Belum lengkap', BINDING_READY: 'Binding siap',
    BINDING_REVIEW: 'Menunggu binding',
  }
  return labels[value] || value || 'Belum dimulai'
}
function statusKind(value: unknown): 'success' | 'failure' | 'pending' | 'neutral' {
  const normalized = String(value || '').toUpperCase()
  if (['SUCCEEDED', 'SUCCEEDED_WITH_WARNINGS', 'ACTIVE', 'APPROVED', 'CONFIRMED', 'BINDING_READY', 'TERHUBUNG'].includes(normalized)) return 'success'
  if (['FAILED', 'PROFILE_FAILED', 'AI_FAILED', 'REJECTED', 'UNLINKED', 'ERROR'].includes(normalized) || normalized.endsWith('_FAILED')) return 'failure'
  if (['QUEUED', 'RUNNING', 'STARTED', 'IN_PROGRESS', 'PENDING', 'NEEDS_REVIEW', 'READY_FOR_APPROVAL', 'ACCESS_POLICY_REQUIRED', 'BINDING_REVIEW', 'NOT_STARTED', ''].includes(normalized)) return 'pending'
  return 'neutral'
}
function showSourceDetail(row: Record<string, unknown>) {
  const source = rows.value.find((item) => item.id === String(row.id))
  if (!source) return
  detailModal.value = {
    title: `Identitas sumber · ${source.name}`,
    source,
    kind: 'identity',
  }
}
function showResponsibility(row: Record<string, unknown>) {
  const source = rows.value.find((item) => item.id === String(row.id))
  if (source) detailModal.value = { title: `Penanggung jawab · ${source.name}`, source, kind: 'responsibility' }
}
function showTabs(row: Record<string, unknown>) {
  const source = rows.value.find((item) => item.id === String(row.id))
  if (source) detailModal.value = { title: `Daftar tab · ${source.name}`, source, kind: 'tabs' }
}
function openStageHelp(stage: StageKey, row?: Record<string, unknown>) {
  const source = row ? rows.value.find((item) => item.id === String(row.id)) : undefined
  stageModal.value = { source, stage }
}
function stageFailure(row: Record<string, unknown>, stage: StageKey): StageFailure | undefined {
  return (row.last_failures as Record<string, StageFailure> | undefined)?.[stage]
}
function stageStatus(source: TrackedSource, stage: StageKey) {
  const key: Record<StageKey, keyof TrackedSource> = {
    discovery: 'discovery_status', profiling: 'profiling_status',
    configuration: 'configuration_status', database: 'database_status',
  }
  return statusLabel(String(source[key[stage]] || 'NOT_STARTED'))
}
function openStageFailure(stage: StageKey, row: Record<string, unknown>) {
  openStageHelp(stage, row)
}
async function showHistory(row: Record<string, unknown>) {
  const source = rows.value.find((item) => item.id === String(row.id))
  if (!source) return
  historySource.value = source
  historyEvents.value = []
  historyOffset.value = 0
  historyTotal.value = 0
  historyError.value = ''
  await loadHistory(true)
}
async function loadHistory(reset = false) {
  if (!historySource.value) return
  historyLoading.value = true
  historyError.value = ''
  try {
    const offsetValue = reset ? 0 : historyOffset.value
    const response = await api.get<ApiEnvelope<HistoryEvent[]>>(`/sources/${historySource.value.id}/history`, {
      params: { offset: offsetValue, limit: historyLimit },
    })
    historyEvents.value = reset ? response.data.data : [...historyEvents.value, ...response.data.data]
    historyOffset.value = historyEvents.value.length
    historyTotal.value = Number(response.data.meta.total || 0)
  } catch (cause) {
    historyError.value = cause instanceof Error ? cause.message : 'Riwayat sumber gagal dimuat.'
  } finally { historyLoading.value = false }
}
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { offset.value = 0; void load() }, 250)
})
watch(includeUnlinked, () => { offset.value = 0; void load() })
onMounted(load)

async function startUnlink(source: Source) {
  unlinkTarget.value = source
  canonicalId.value = ''
  reason.value = ''
  canonicalOptions.value = []
  error.value = ''
  try {
    const response = await api.get<ApiEnvelope<Source[]>>('/sources', {
      params: { offset: 0, limit: 100, search: source.spreadsheet_id, include_unlinked: false },
    })
    canonicalOptions.value = response.data.data
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Daftar sumber utama gagal dimuat.'
  }
}
async function unlink() {
  if (!unlinkTarget.value || !canonicalId.value || !reason.value.trim()) return
  const canonical = activeCanonicalOptions.value.find((item) => item.id === canonicalId.value)
  if (!window.confirm(`Konfirmasi 1 dari 2: unlink sumber ${unlinkTarget.value.name} dan arahkan ke ${canonical?.name || 'sumber utama'}? Riwayat tetap tersimpan.`)) return
  if (!window.confirm(`Konfirmasi 2 dari 2: tindakan ini akan mengeluarkan ${unlinkTarget.value.name} dari daftar sumber aktif. Lanjutkan dengan alasan: “${reason.value.trim()}”?`)) return
  loading.value = true
  error.value = ''
  try {
    await call('POST', `/sources/${unlinkTarget.value.id}/unlink`, { canonical_source_id: canonicalId.value, reason: reason.value.trim() })
    notice.value = `Sumber ${unlinkTarget.value.name} berhasil di-unlink. Riwayat dan data tetap tersimpan.`
    unlinkTarget.value = null
    await load()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unlink sumber gagal.'
  } finally { loading.value = false }
}
async function restore(source: Source) {
  if (!window.confirm(`Konfirmasi 1 dari 2: pulihkan link sumber ${source.name}?`)) return
  if (!window.confirm(`Konfirmasi 2 dari 2: ${source.name} akan kembali muncul pada daftar sumber aktif. Lanjutkan?`)) return
  loading.value = true
  error.value = ''
  try {
    await call('POST', `/sources/${source.id}/restore`)
    notice.value = `Link sumber ${source.name} dipulihkan.`
    await load()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Pemulihan sumber gagal.'
  } finally { loading.value = false }
}
function startUnlinkRow(row: Record<string, unknown>) {
  const source = rows.value.find((item) => item.id === String(row.id))
  if (source) void startUnlink(source)
}
async function startDelete(source: Source) {
  deleteTarget.value = source
  deleteReason.value = ''
  deleteCode.value = ''
  deletePreview.value = null
  error.value = ''
  try {
    const response = await api.get<ApiEnvelope<NonNullable<typeof deletePreview.value>>>(`/sources/${source.id}/delete-preview`)
    deletePreview.value = response.data.data
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Pemeriksaan penghapusan gagal.'
  }
}
function startDeleteRow(row: Record<string, unknown>) {
  const source = rows.value.find((item) => item.id === String(row.id))
  if (source) void startDelete(source)
}
async function permanentlyDelete() {
  if (!deleteTarget.value || !deletePreview.value?.can_delete || !deleteReason.value.trim()) return
  const target = deleteTarget.value
  if (!window.confirm(`Konfirmasi 1 dari 2: hapus permanen sumber ${target.name} beserta tab, hasil profiling, dan job terminalnya?`)) return
  if (!window.confirm(`Konfirmasi 2 dari 2: data ini tidak dapat dipulihkan. Lanjutkan menghapus ${target.source_code}?`)) return
  loading.value = true
  error.value = ''
  try {
    await call('DELETE', `/sources/${target.id}`, { confirm_source_code: deleteCode.value.trim(), reason: deleteReason.value.trim() })
    notice.value = `Sumber ${target.name} dan artefak setup yang diizinkan berhasil dihapus. Catatan audit penghapusan tetap disimpan.`
    deleteTarget.value = null
    await load()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Penghapusan sumber gagal.'
  } finally { loading.value = false }
}
function openSourceRow(row: Record<string, unknown>) {
  const source = rows.value.find((item) => item.id === String(row.id))
  if (source && !source.unlinked_at) emit('openSource', source)
}
function restoreRow(row: Record<string, unknown>) {
  const source = rows.value.find((item) => item.id === String(row.id))
  if (source) void restore(source)
}
</script>

<template>
  <section class="panel source-registry">
    <h2>Daftar sumber terdaftar</h2>
    <p class="muted">Cari sumber berdasarkan nama, kode, atau ID Spreadsheet. Link yang di-unlink tetap tersimpan dan dapat dipulihkan oleh admin.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <label class="source-registry__toggle"><input v-model="includeUnlinked" type="checkbox" /> Tampilkan sumber yang sudah di-unlink</label>
    <PagedDataTable
      :rows="tableRows"
      :columns="columns"
      :total="total"
      :offset="offset"
      :limit="limit"
      :search="search"
      :loading="loading"
      empty-text="Sumber tidak ditemukan. Periksa kata pencarian atau filter status."
      @update:search="search = $event"
      @page="offset = $event; load()"
    >
      <template #cell-spreadsheet_link="{ row }">
        <a v-if="row.spreadsheet_link" class="spreadsheet-link" :href="String(row.spreadsheet_link)" target="_blank" rel="noopener noreferrer" :aria-label="`Buka Google Sheet ${row.name} di tab baru`" :title="`Buka Google Sheet ${row.name}`">Buka Sheet</a>
        <span v-else class="muted">—</span>
      </template>
      <template #cell-source_identity="{ row }">
        <button class="icon-button" type="button" :aria-label="`Lihat kode sumber dan ID Spreadsheet ${row.name}`" title="Lihat identitas sumber" @click="showSourceDetail(row)"><FileText :size="16" aria-hidden="true" /></button>
      </template>
      <template #cell-responsibility_details="{ row }">
        <button class="icon-button" type="button" :aria-label="`Lihat data owner, steward, dan pendaftar ${row.name}`" title="Lihat penanggung jawab sumber" @click="showResponsibility(row)"><FileText :size="16" aria-hidden="true" /></button>
      </template>
      <template #cell-sheet_summary="{ row, value }">
        <span class="source-value"><span>{{ value }}</span><button class="icon-button" type="button" :aria-label="`Lihat daftar tab ${row.name}`" title="Lihat tab dan statusnya" @click="showTabs(row)"><FileText :size="16" aria-hidden="true" /></button></span>
      </template>
      <template #header-discovery_label="{ column }">
        <span class="table-header-help">{{ column.label }}<button class="icon-button help-icon" type="button" aria-label="Petunjuk discovery" title="Petunjuk discovery" @click="openStageHelp('discovery')"><CircleHelp :size="16" /></button></span>
      </template>
      <template #header-profiling_label="{ column }">
        <span class="table-header-help">{{ column.label }}<button class="icon-button help-icon" type="button" aria-label="Petunjuk profiling" title="Petunjuk profiling" @click="openStageHelp('profiling')"><CircleHelp :size="16" /></button></span>
      </template>
      <template #header-configuration_label="{ column }">
        <span class="table-header-help">{{ column.label }}<button class="icon-button help-icon" type="button" aria-label="Petunjuk konfigurasi" title="Petunjuk konfigurasi" @click="openStageHelp('configuration')"><CircleHelp :size="16" /></button></span>
      </template>
      <template #header-database_label="{ column }">
        <span class="table-header-help">{{ column.label }}<button class="icon-button help-icon" type="button" aria-label="Petunjuk pemuatan" title="Petunjuk pemuatan" @click="openStageHelp('database')"><CircleHelp :size="16" /></button></span>
      </template>
      <template #cell-discovery_label="{ row, value }">
        <span class="stage-cell"><span class="status-symbol" :class="`status-symbol--${statusKind(row.discovery_status)}`" :title="String(value)" :aria-label="String(value)"><CircleCheck v-if="statusKind(row.discovery_status) === 'success'" :size="17"/><CircleX v-else-if="statusKind(row.discovery_status) === 'failure'" :size="17"/><CircleMinus v-else :size="17"/><span class="sr-only">{{ value }}</span></span><button v-if="stageFailure(row, 'discovery')" class="icon-button failure-icon" type="button" :aria-label="`Kegagalan discovery terakhir ${row.name}`" title="Lihat kegagalan terakhir" @click="openStageFailure('discovery', row)"><FileText :size="16"/></button></span>
      </template>
      <template #cell-profiling_label="{ row, value }">
        <span class="stage-cell"><span class="status-symbol" :class="`status-symbol--${statusKind(row.profiling_status)}`" :title="String(value)" :aria-label="String(value)"><CircleCheck v-if="statusKind(row.profiling_status) === 'success'" :size="17"/><CircleX v-else-if="statusKind(row.profiling_status) === 'failure'" :size="17"/><CircleMinus v-else :size="17"/><span class="sr-only">{{ value }}</span></span><button v-if="stageFailure(row, 'profiling')" class="icon-button failure-icon" type="button" :aria-label="`Kegagalan profiling terakhir ${row.name}`" title="Lihat kegagalan terakhir" @click="openStageFailure('profiling', row)"><FileText :size="16"/></button></span>
      </template>
      <template #cell-configuration_label="{ row, value }">
        <span class="stage-cell"><span class="status-symbol" :class="`status-symbol--${statusKind(row.configuration_status)}`" :title="String(value)" :aria-label="String(value)"><CircleCheck v-if="statusKind(row.configuration_status) === 'success'" :size="17"/><CircleX v-else-if="statusKind(row.configuration_status) === 'failure'" :size="17"/><CircleMinus v-else :size="17"/><span class="sr-only">{{ value }}</span></span><button v-if="stageFailure(row, 'configuration')" class="icon-button failure-icon" type="button" :aria-label="`Kegagalan konfigurasi terakhir ${row.name}`" title="Lihat kegagalan terakhir" @click="openStageFailure('configuration', row)"><FileText :size="16"/></button></span>
      </template>
      <template #cell-database_label="{ row, value }">
        <span class="stage-cell"><span class="status-symbol" :class="`status-symbol--${statusKind(row.database_status)}`" :title="String(value)" :aria-label="String(value)"><CircleCheck v-if="statusKind(row.database_status) === 'success'" :size="17"/><CircleX v-else-if="statusKind(row.database_status) === 'failure'" :size="17"/><CircleMinus v-else :size="17"/><span class="sr-only">{{ value }}</span></span><button v-if="stageFailure(row, 'database')" class="icon-button failure-icon" type="button" :aria-label="`Kegagalan pemuatan terakhir ${row.name}`" title="Lihat kegagalan terakhir" @click="openStageFailure('database', row)"><FileText :size="16"/></button></span>
      </template>
      <template #cell-created_at="{ value }">{{ value ? new Date(String(value)).toLocaleString('id-ID') : '—' }}</template>
      <template #cell-link_status="{ row }"><span class="source-value"><span class="status-symbol" :class="`status-symbol--${row.unlinked_at ? 'failure' : 'success'}`" :title="row.unlinked_at ? 'Unlinked' : 'Terhubung'"><CircleX v-if="row.unlinked_at" :size="17"/><CircleCheck v-else :size="17"/></span><button v-if="row.unlinked_at && row.unlinked_to_source_id" class="icon-button" type="button" aria-label="Lihat sumber tujuan link" title="Lihat ID sumber tujuan" @click="detailModal = { title: 'ID sumber tujuan', value: String(row.unlinked_to_source_id), kind: 'text' }"><FileText :size="16"/></button></span></template>
      <template #cell-actions="{ row }">
        <button type="button" :disabled="Boolean(row.unlinked_at)" @click="openSourceRow(row)">Buka</button>
        <button class="icon-button" type="button" :aria-label="`Buka audit trail ${row.name}`" title="Audit trail" @click="showHistory(row)"><FileText :size="17"/><span class="sr-only">Riwayat</span></button>
        <button v-if="row.unlinked_at && canManage" type="button" :disabled="loading" @click="restoreRow(row)">Pulihkan</button>
        <button v-else-if="!row.unlinked_at && canManage" type="button" :disabled="loading" @click="startUnlinkRow(row)">Unlink</button>
        <button v-if="canManage" class="icon-button danger-icon" type="button" :disabled="loading" :aria-label="`Hapus permanen sumber ${row.name}`" title="Hapus sumber setup yang gagal" @click="startDeleteRow(row)"><Trash2 :size="17"/></button>
        <span v-else class="muted">—</span>
      </template>
    </PagedDataTable>
    <form v-if="unlinkTarget" class="source-registry__unlink" @submit.prevent="unlink">
      <h3>Unlink {{ unlinkTarget.name }}</h3>
      <p class="muted">Sumber dipertahankan untuk audit. Jika masih digunakan oleh konfigurasi, job, atau data turunan, backend akan menolak unlink.</p>
      <label>Sumber utama pengganti<select v-model="canonicalId" required>
        <option value="" disabled>Pilih sumber aktif untuk Spreadsheet yang sama</option>
        <option v-for="item in activeCanonicalOptions" :key="item.id" :value="item.id">{{ item.name }} ({{ item.source_code }})</option>
      </select></label>
      <label>Alasan unlink<input v-model="reason" required maxlength="500" placeholder="Contoh: sumber terdaftar dua kali" /></label>
      <div class="toolbar"><button class="primary" :disabled="loading || !activeCanonicalOptions.length">Konfirmasi unlink</button><button type="button" :disabled="loading" @click="unlinkTarget = null">Batal</button></div>
      <p v-if="!activeCanonicalOptions.length" class="error">Tidak ada sumber aktif lain untuk dijadikan sumber utama. Sumber ini tidak dapat di-unlink sendiri.</p>
    </form>
    <form v-if="deleteTarget" class="source-registry__unlink source-registry__delete" @submit.prevent="permanentlyDelete">
      <h3>Hapus permanen {{ deleteTarget.name }}</h3>
      <p class="muted">Untuk membersihkan sumber setup yang gagal. Penghapusan hanya diizinkan jika belum ada konfigurasi, snapshot, ETL, data product, binding, review import, atau job aktif. Catatan audit penghapusan tetap disimpan.</p>
      <p v-if="!deletePreview" class="muted">Memeriksa dampak penghapusan…</p>
      <div v-else>
        <p v-if="deletePreview.can_delete" class="success">Aman untuk dihapus. Yang akan dihapus: {{ deletePreview.will_delete.tabs }} tab, {{ deletePreview.will_delete.profiling_runs }} hasil profiling, dan {{ deletePreview.will_delete.terminal_jobs }} job selesai/gagal.</p>
        <div v-else class="error"><strong>Belum dapat dihapus:</strong><ul><li v-for="blocker in deletePreview.blockers" :key="blocker">{{ blocker }}</li></ul>Gunakan unlink atau pertahankan sumber sampai data turunannya ditangani.</div>
      </div>
      <label>Ketik kode sumber <strong>{{ deleteTarget.source_code }}</strong> untuk konfirmasi<input v-model="deleteCode" required maxlength="63" autocomplete="off" /></label>
      <label>Alasan penghapusan<input v-model="deleteReason" required minlength="3" maxlength="500" placeholder="Contoh: registrasi gagal, akan didaftarkan ulang" /></label>
      <div class="toolbar"><button class="danger" :disabled="loading || !deletePreview?.can_delete || deleteCode.trim() !== deleteTarget.source_code || deleteReason.trim().length < 3">Hapus permanen</button><button type="button" :disabled="loading" @click="deleteTarget = null">Batal</button></div>
    </form>
    <div v-if="stageModal" class="source-modal-backdrop" role="presentation" @click.self="stageModal = null">
      <section class="source-modal" role="dialog" aria-modal="true" :aria-labelledby="`stage-help-${stageModal.stage}`">
        <button class="source-modal__close" type="button" aria-label="Tutup petunjuk" @click="stageModal = null">×</button>
        <h2 :id="`stage-help-${stageModal.stage}`">{{ stageGuides[stageModal.stage].title }}</h2>
        <p v-if="stageModal.source"><strong>{{ stageModal.source.name }}</strong> · Status: {{ stageStatus(stageModal.source, stageModal.stage) }}</p>
        <p v-else class="muted">Petunjuk umum untuk semua sumber.</p>
        <ol><li v-for="step in stageGuides[stageModal.stage].steps" :key="step">{{ step }}</li></ol>
        <div v-if="stageModal.source && stageFailure(stageModal.source as unknown as Record<string, unknown>, stageModal.stage)" class="stage-failure" role="alert">
          <h3>Kegagalan terakhir</h3>
          <p><strong>{{ stageFailure(stageModal.source as unknown as Record<string, unknown>, stageModal.stage)?.code || 'GAGAL' }}</strong> · {{ stageFailure(stageModal.source as unknown as Record<string, unknown>, stageModal.stage)?.message || 'Tidak ada keterangan kegagalan.' }}</p>
          <small v-if="stageFailure(stageModal.source as unknown as Record<string, unknown>, stageModal.stage)?.occurred_at">{{ new Date(stageFailure(stageModal.source as unknown as Record<string, unknown>, stageModal.stage)!.occurred_at!).toLocaleString('id-ID') }}</small>
        </div>
        <button type="button" @click="stageModal = null">Mengerti</button>
      </section>
    </div>
    <div v-if="historySource" class="source-modal-backdrop" role="presentation" @click.self="historySource = null">
      <section class="source-modal source-history" role="dialog" aria-modal="true" aria-labelledby="source-history-title">
        <button class="source-modal__close" type="button" aria-label="Tutup riwayat" @click="historySource = null">×</button>
        <h2 id="source-history-title">Riwayat proses · {{ historySource.name }}</h2>
        <p class="muted">Audit trail aktivitas sumber, perubahan, dan percobaan pemrosesan.</p>
        <p v-if="historyError" class="error" role="alert">{{ historyError }}</p>
        <p v-if="historyLoading && !historyEvents.length">Memuat riwayat…</p>
        <ol v-else class="history-list">
          <li v-for="item in historyEvents" :key="item.id">
            <strong>{{ item.summary }}</strong> · {{ item.stage }} · {{ statusLabel(item.status) }}
            <div>{{ new Date(item.occurred_at).toLocaleString('id-ID') }}<span v-if="item.actor_name"> · oleh {{ item.actor_name }}</span></div>
            <p v-if="item.error_code || item.error_message" class="stage-failure"><strong>{{ item.error_code || 'GAGAL' }}</strong><span v-if="item.error_message"> · {{ item.error_message }}</span></p>
            <p v-if="item.details?.reason" class="muted">Alasan: {{ item.details.reason }}</p>
          </li>
          <li v-if="!historyEvents.length && !historyLoading">Belum ada riwayat aktivitas.</li>
        </ol>
        <button v-if="historyEvents.length < historyTotal" type="button" :disabled="historyLoading" @click="loadHistory()">{{ historyLoading ? 'Memuat…' : 'Muat riwayat lebih lama' }}</button>
        <button type="button" @click="historySource = null">Tutup</button>
      </section>
    </div>
    <div v-if="detailModal" class="source-modal-backdrop" role="presentation" @click.self="detailModal = null">
      <section class="source-modal source-detail" role="dialog" aria-modal="true" aria-labelledby="source-detail-title">
        <button class="source-modal__close" type="button" aria-label="Tutup detail" @click="detailModal = null">×</button>
        <h2 id="source-detail-title">{{ detailModal.title }}</h2>
        <code v-if="detailModal.kind === 'text'" class="full-source-value">{{ detailModal.value }}</code>
        <dl v-else-if="detailModal.kind === 'identity' && detailModal.source" class="identity-details">
          <dt>Kode sumber</dt><dd><code>{{ detailModal.source.source_code }}</code></dd>
          <dt>ID Spreadsheet</dt><dd><code>{{ detailModal.source.spreadsheet_id }}</code></dd>
        </dl>
        <dl v-else-if="detailModal.kind === 'responsibility' && detailModal.source" class="identity-details">
          <dt>Data owner</dt><dd>{{ detailModal.source.owner_name || 'Belum ditetapkan' }}</dd>
          <dt>Data steward</dt><dd>{{ detailModal.source.steward_name || 'Belum ditetapkan' }}</dd>
          <dt>Didaftarkan oleh</dt><dd>{{ detailModal.source.registered_by || 'Tidak tercatat' }}</dd>
        </dl>
        <ol v-else-if="detailModal.source?.sheets.length" class="tab-list">
          <li v-for="sheet in detailModal.source.sheets" :key="sheet.id">
            <strong>{{ sheet.name }}</strong><span v-if="!sheet.is_present" class="muted"> · tidak ditemukan di spreadsheet</span><span v-else-if="!sheet.enabled" class="muted"> · nonaktif</span>
            <small>Profil: {{ statusLabel(sheet.profiling_status) }} · Konfigurasi: {{ statusLabel(sheet.configuration_status) }} · Database: {{ statusLabel(sheet.database_status) }}</small>
            <p v-for="failure in Object.values(sheet.last_failures || {})" :key="`${failure.stage}-${failure.occurred_at}`" class="stage-failure"><strong>{{ failure.code || 'GAGAL' }}</strong> · {{ failure.message || 'Tidak ada keterangan.' }}</p>
          </li>
        </ol>
        <p v-else class="muted">Tab belum ditemukan. Jalankan discovery dari Workspace ETL.</p>
        <button type="button" @click="detailModal = null">Tutup</button>
      </section>
    </div>
  </section>
</template>

<style scoped>
.source-registry__toggle { display: inline-flex; align-items: center; gap: 8px; margin: 8px 0 14px; }
.source-registry__unlink { display: grid; gap: 12px; margin-top: 20px; padding: 16px; border: 1px solid #b9cec3; border-radius: 10px; }
.source-registry__unlink label { display: grid; gap: 6px; }
.source-registry__delete { border-color: #e4a7a0; }
.source-registry__delete .success { color: #116b42; }
.source-registry__delete .danger { color: #fff; background: #b42318; border-color: #b42318; }
.danger-icon { color: #b42318; }
.spreadsheet-link { color: #087443; font-weight: 600; white-space: nowrap; }
.spreadsheet-link:hover { color: #065f36; text-decoration-thickness: 2px; }
.icon-button { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; padding: 3px; border: 1px solid #c7d8d0; border-radius: 7px; background: #fff; color: #075d48; vertical-align: middle; }
.source-value, .stage-cell { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.source-value code { max-width: 110px; overflow: hidden; text-overflow: ellipsis; }
.stage-cell { gap: 5px; }
.table-header-help { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.status-symbol { display: inline-flex; align-items: center; }
.status-symbol--success { color: #13804a; }
.status-symbol--failure { color: #b42318; }
.status-symbol--pending { color: #a16207; }
.status-symbol--neutral { color: #60716a; }
.help-icon { color: #075d48; }
.failure-icon { color: #a32118; border-color: #e6a29c; background: #fff1ef; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.source-modal-backdrop { position: fixed; z-index: 1000; inset: 0; display: grid; place-items: center; padding: 20px; background: rgb(8 28 24 / 50%); }
.source-modal { position: relative; width: min(680px, 100%); max-height: min(85vh, 900px); overflow: auto; padding: 26px; border: 1px solid #c7d8d0; border-radius: 16px; background: #fff; box-shadow: 0 20px 60px rgb(0 0 0 / 22%); }
.source-modal__close { position: absolute; top: 12px; right: 12px; font-size: 20px; }
.source-modal ol { padding-left: 22px; }
.source-modal li { margin: 10px 0; }
.source-history { width: min(900px, 100%); }
.full-source-value { display: block; margin: 18px 0; padding: 14px; overflow-wrap: anywhere; border-radius: 8px; background: #f1f6f3; font-size: 1rem; }
.identity-details { display: grid; grid-template-columns: minmax(130px, max-content) minmax(0, 1fr); gap: 12px 16px; margin: 18px 0; }
.identity-details dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
.tab-list { padding-left: 22px; }
.tab-list li { margin: 12px 0; }
.tab-list small { display: block; margin-top: 4px; color: #5d7169; }
.history-list { padding-left: 22px; }
.history-list > li { padding: 12px 0; border-bottom: 1px solid #dce8e2; }
.history-list > li > div { color: #5d7169; font-size: .9em; }
.stage-failure { padding: 10px 12px; border-left: 3px solid #cf463d; border-radius: 5px; background: #fff2f0; color: #8b1e19; }
</style>
