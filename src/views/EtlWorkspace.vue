<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import EtlShell from '@/components/EtlShell.vue'
import {
  call,
  user,
  editRoles,
  reviewRoles,
  type Source,
  type Sheet,
  type Config,
  type Job,
  type Profile,
  type AccessAttribute,
  type AccessKind,
  type SourceAccessMetadata,
} from '@/lib/etl'
import ManualDraft from '@/components/ManualDraft.vue'
import SheetClassification from '@/components/SheetClassification.vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import { sourceBlockers } from '@/lib/classification'
import { getApiErrorMessage } from '@/lib/api'
const sources = ref<Source[]>([]),
  sheets = ref<Sheet[]>([]),
  configs = ref<Config[]>([])
const sourceId = ref(''),
  sheetId = ref(''),
  error = ref(''),
  notice = ref(''),
  busy = ref(false),
  job = ref<Job | null>(null)
const offset = ref(0)
const route = useRoute()
function emptyAccessMetadata() {
  return {
    owner_unit_id: '', business_domain_id: '', jurisdiction_id: '', purpose_id: '',
    data_owner_user_id: '', data_steward_user_id: '', sensitivity: '',
  }
}
const registration = ref({
  name: '',
  spreadsheet_url: '',
  description: '',
  sync_schedule: '',
  access_metadata: emptyAccessMetadata(),
})
type RegistrationCheck = { registered: boolean; owned_by_me: boolean; source_id: string | null; source_name: string | null }
const registrationCheck = ref<RegistrationCheck | null>(null)
const registrationChecking = ref(false)
const registrationBusy = ref(false)
const registrationError = ref('')
const registrationMessage = ref('')
const registrationJobId = ref('')
const registrationSourceId = ref('')
const registrationReused = ref(false)
const registrationDuplicateIds = ref<string[]>([])
const metadataEdit = ref(emptyAccessMetadata())
type ReviewContext = {
  source_id: string
  can_decide: boolean
  access_revision: number
  review_status: 'PENDING' | 'APPROVED' | 'REJECTED'
  attributes: Record<string, { code: string; label: string; is_active: boolean } | null>
  people: Record<string, { username: string; is_active: boolean } | null>
  sensitivity: string | null
}
const reviewContext = ref<ReviewContext | null>(null)
const policyOptions = ref<{ id: string; code: string; label: string; actions: string[] }[] | null>(null)
const selectedPolicyId = ref('')
const rejectReason = ref<'SCOPE_MISMATCH' | 'OWNER_UNCONFIRMED' | 'OTHER'>('SCOPE_MISMATCH')
const reviewAttributes = [
  { key: 'owner_unit_id', label: 'Unit pemilik' },
  { key: 'business_domain_id', label: 'Domain bisnis' },
  { key: 'jurisdiction_id', label: 'Yurisdiksi' },
  { key: 'purpose_id', label: 'Purpose' },
]
const reviewPeople = [
  { key: 'data_owner_user_id', label: 'Data owner' },
  { key: 'data_steward_user_id', label: 'Data steward' },
]
type RegistrationOptions = {
  scopes: AccessAttribute[]
  purposes: AccessAttribute[]
  people: { id: string; username: string; role: string }[]
  sensitivities: string[]
}
const registrationOptions = ref<RegistrationOptions | null>(null)
const registrationOptionsLoading = ref(false)
const registrationOptionsError = ref('')
function scopeOptions(kind: AccessKind) {
  return registrationOptions.value?.scopes.filter((scope) => scope.kind === kind) || []
}
const missingRegistrationScopes = computed(() => [
  ['DEPARTMENT', 'unit/departemen'],
  ['BUSINESS_DOMAIN', 'domain bisnis'],
  ['JURISDICTION', 'yurisdiksi'],
].filter(([kind]) => !scopeOptions(kind as AccessKind).length).map(([, label]) => label))
const registrationReady = computed(() => Boolean(
  registrationOptions.value && !missingRegistrationScopes.value.length &&
  registrationOptions.value.purposes.length && registrationOptions.value.people.length &&
  registrationOptions.value.sensitivities.length,
))
const profiles = ref<Profile[]>([])
const syncReviews = ref<unknown[] | null>(null)
const migrationPreview = ref<Record<string, unknown> | null>(null)
const selectedSource = computed(() => sources.value.find((source) => source.id === sourceId.value))
const selectedSheet = computed(() => sheets.value.find((s) => s.id === sheetId.value))
const sourceOptions = computed(() =>
  sources.value.map((source) => ({
    value: source.id,
    label: `${source.name} · ${source.status}`,
  })),
)
const sheetOptions = computed(() =>
  sheets.value.map((sheet) => ({
    value: sheet.id,
    label: `${sheet.sheet_name}${sheet.last_fingerprint ? '' : ' (perlu profiling)'}`,
  })),
)
const currentProfile = computed(
  () =>
    profiles.value
      .filter((p) => p.source_sheet_id === sheetId.value)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0],
)
const sheetSettings = ref({ range_a1: '', header_row: 1, data_start_row: 2, enabled: true })
const watermarkSettings = ref({
  source_column: null as string | null,
  kind: null as Sheet['watermark_kind'],
})
watch(selectedSheet, (sheet) => {
  if (sheet) {
    sheetSettings.value = {
      range_a1: sheet.range_a1,
      header_row: sheet.header_row,
      data_start_row: sheet.data_start_row,
      enabled: sheet.enabled,
    }
    watermarkSettings.value = {
      source_column: sheet.watermark_source_column,
      kind: sheet.watermark_kind,
    }
  }
})
watch(selectedSource, (source) => {
  reviewContext.value = null
  policyOptions.value = null
  selectedPolicyId.value = ''
  metadataEdit.value = source?.access_metadata
    ? { ...source.access_metadata }
    : emptyAccessMetadata()
})
const canRead = computed(() => [...editRoles, ...reviewRoles].includes(user.value?.role || ''))
const blockers = computed(() => (sourceId.value ? sourceBlockers(sheets.value) : []))
const canEdit = computed(() => !!user.value && editRoles.includes(user.value.role))
const canDecideReview = computed(() => Boolean(
  reviewContext.value?.can_decide && selectedSource.value?.access_metadata &&
  selectedSource.value.access_review_status === 'PENDING' &&
  reviewContext.value.access_revision === selectedSource.value.access_revision &&
  selectedSource.value.access_metadata_editor_id !== user.value?.id,
))
const canApproveReview = computed(() => Boolean(
  canDecideReview.value && reviewContext.value &&
  Object.values(reviewContext.value.attributes).every((item) => item?.is_active) &&
  Object.values(reviewContext.value.people).every((item) => item?.is_active),
))
let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0
let pollDeadline = 0
async function run(action: () => Promise<void>) {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await action()
  } catch (e) {
    error.value = getApiErrorMessage(e)
  } finally {
    busy.value = false
  }
}
async function changePage(delta: number) {
  offset.value += delta
  await run(load)
}
async function load() {
  const nextSources = await call<Source[]>('GET', `/sources?offset=${offset.value}&limit=50`)
  sources.value = nextSources
}
async function openDuplicateSource(id: string) {
  if (!sources.value.some((source) => source.id === id)) {
    const source = await call<Source>('GET', `/sources/${id}`)
    sources.value = [source, ...sources.value]
  }
  sourceId.value = id
  await selectSource()
}
async function loadRegistrationOptions() {
  const accountId = user.value?.id
  registrationOptionsLoading.value = true
  registrationOptionsError.value = ''
  try {
    const options = await call<RegistrationOptions>('GET', '/access/registration-options')
    if (user.value?.id === accountId) registrationOptions.value = options
  } catch (cause) {
    if (user.value?.id === accountId) {
      registrationOptions.value = null
      registrationOptionsError.value = getApiErrorMessage(cause)
    }
  } finally {
    if (user.value?.id === accountId) registrationOptionsLoading.value = false
  }
}
async function saveAccessMetadata() {
  const source = selectedSource.value
  const accountId = user.value?.id
  if (!source || source.access_revision === undefined) return
  const updated = await call<Source>('PATCH', `/sources/${source.id}/access-metadata`, {
    revision_no: source.access_revision,
    access_metadata: metadataEdit.value as SourceAccessMetadata,
  })
  if (sourceId.value !== source.id || user.value?.id !== accountId) return
  sources.value = sources.value.map((item) => item.id === updated.id ? { ...item, ...updated } : item)
  notice.value = 'Metadata akses sumber tersimpan. Policy akses perlu ditinjau.'
}
async function loadReviewContext() {
  const source = selectedSource.value
  const accountId = user.value?.id
  if (!source) return
  const context = await call<ReviewContext>('GET', `/sources/${source.id}/access-review-context`)
  if (sourceId.value === source.id && user.value?.id === accountId &&
      selectedSource.value?.access_revision === context.access_revision) {
    reviewContext.value = context
  }
}
async function decideReview(decision: 'APPROVE' | 'REJECT') {
  const source = selectedSource.value
  const accountId = user.value?.id
  if (!source || !canDecideReview.value) return
  const updated = await call<Source>('POST', `/sources/${source.id}/access-review`, {
    revision_no: source.access_revision,
    decision,
    reason: decision === 'APPROVE' ? 'METADATA_VERIFIED' : rejectReason.value,
  })
  if (sourceId.value !== source.id || user.value?.id !== accountId) return
  sources.value = sources.value.map((item) => item.id === updated.id ? { ...item, ...updated } : item)
  notice.value = 'Review metadata tersimpan. Akses data tetap memerlukan policy.'
}
async function loadPolicyOptions() {
  const source = selectedSource.value
  const accountId = user.value?.id
  if (!source) return
  const options = await call<{ id: string; code: string; label: string; actions: string[] }[]>(
    'GET', `/sources/${source.id}/access-policy-options`,
  )
  if (sourceId.value === source.id && user.value?.id === accountId &&
      selectedSource.value?.access_revision === source.access_revision) {
    policyOptions.value = options
    selectedPolicyId.value = ''
  }
}
async function activateSourceAccess() {
  const source = selectedSource.value
  const accountId = user.value?.id
  if (!source || source.access_revision === undefined || !selectedPolicyId.value) return
  const updated = await call<Source>('POST', `/sources/${source.id}/access-activate`, {
    revision_no: source.access_revision,
    policy_id: selectedPolicyId.value,
  })
  if (sourceId.value !== source.id || user.value?.id !== accountId) return
  sources.value = sources.value.map((item) => item.id === updated.id ? { ...item, ...updated } : item)
  notice.value = 'Policy sumber aktif. Izin pengguna tetap diperiksa pada setiap akses data.'
}
async function selectSource() {
  sheetId.value = ''
  configs.value = []
  sheets.value = []
  profiles.value = []
  if (sourceId.value) {
    const results = await Promise.all([
      call<Sheet[]>('GET', `/sources/${sourceId.value}/sheets`),
      call<Profile[]>('GET', `/sources/${sourceId.value}/profiling-runs`),
    ])
    sheets.value = results[0]
    profiles.value = results[1]
  }
}
async function loadConfigs() {
  configs.value = sheetId.value
    ? await call<Config[]>('GET', `/source-sheets/${sheetId.value}/configurations`)
    : []
}
async function updateSheet() {
  await call('PATCH', `/source-sheets/${sheetId.value}`, sheetSettings.value)
  sheets.value = await call<Sheet[]>('GET', `/sources/${sourceId.value}/sheets`)
  profiles.value = []
}
async function updateWatermark() {
  if (!selectedSheet.value) return
  const enabled = Boolean(watermarkSettings.value.source_column)
  await call('PATCH', `/source-sheets/${sheetId.value}/watermark`, {
    revision_no: selectedSheet.value.watermark_revision,
    source_column: enabled ? watermarkSettings.value.source_column : null,
    kind: enabled ? watermarkSettings.value.kind : null,
  })
  sheets.value = await call<Sheet[]>('GET', `/sources/${sourceId.value}/sheets`)
  notice.value = 'Incremental watermark diperbarui dan nilainya direset.'
}
async function syncReview() {
  const result = await call<{ reviews: unknown[] }>(
    'POST',
    `/sources/${sourceId.value}/sync-review`,
  )
  syncReviews.value = result.reviews
  notice.value =
    'Batch review dibuat untuk tab yang siap. Periksa item BLOCKED sebelum melanjutkan.'
}
async function loadMigrationPreview() {
  migrationPreview.value = await call<Record<string, unknown>>(
    'GET',
    `/sources/${sourceId.value}/master-migration-preview`,
  )
  notice.value = 'Preview migrasi master dimuat. Tidak ada perubahan data yang dilakukan.'
}
async function poll(id: string, epoch: number) {
  if (epoch !== generation || !user.value) return
  try {
    const result = await call<Job>('GET', `/jobs/${id}`)
    if (epoch !== generation) return
    job.value = result
    if (id === registrationJobId.value) {
      if (result.status === 'FAILED') {
        registrationError.value = `Sumber sudah terdaftar, tetapi discovery gagal: ${result.error_code || 'JOB_FAILED'} ${result.error_message || ''}. Periksa monitor job; jangan daftarkan Sheet yang sama lagi.`
      } else if (result.status === 'SUCCEEDED') {
        registrationMessage.value = registrationReused.value
          ? 'Spreadsheet ini sudah terhubung dan discovery selesai. Sumber lama dipilih kembali; lanjutkan dari tab yang tersedia.'
          : 'Sumber berhasil didaftarkan dan discovery selesai. Pilih sumber serta tab di bawah untuk melanjutkan.'
      } else {
        registrationMessage.value = `Sumber sudah terdaftar. Job discovery ${result.status.toLowerCase()}; pantau statusnya tanpa mengulang pendaftaran.`
      }
    }
    if (['QUEUED', 'RUNNING'].includes(result.status) && Date.now() < pollDeadline)
      timer = setTimeout(() => void poll(id, epoch), 2500)
    else if (['QUEUED', 'RUNNING'].includes(result.status))
      {
        error.value = 'Batas pemantauan tercapai. Buka monitor job untuk melanjutkan; jangan ulangi enqueue.'
        if (id === registrationJobId.value) registrationError.value = error.value
      }
    else {
      await load()
      const refreshedSourceId = result.source_id || sourceId.value
      if (refreshedSourceId) {
        sourceId.value = refreshedSourceId
        await selectSource()
      }
      await loadConfigs()
    }
  } catch (e) {
    error.value = getApiErrorMessage(e)
    if (id === registrationJobId.value) registrationError.value = `Sumber sudah terdaftar, tetapi status job tidak dapat dimuat: ${error.value}. Periksa monitor job sebelum mencoba lagi.`
  }
}
async function checkRegistration(): Promise<RegistrationCheck | null> {
  const url = registration.value.spreadsheet_url.trim()
  if (!url) { registrationCheck.value = null; return null }
  registrationChecking.value = true
  try {
    const result = await call<RegistrationCheck>('GET', `/sources/registration-check?spreadsheet_url=${encodeURIComponent(url)}`)
    if (registration.value.spreadsheet_url.trim() === url) registrationCheck.value = result
    return result
  } catch (cause) {
    registrationError.value = getApiErrorMessage(cause)
    return null
  } finally {
    registrationChecking.value = false
  }
}
watch(() => registration.value.spreadsheet_url, () => { registrationCheck.value = null })
async function submitRegistration() {
  if (registrationBusy.value || registrationJobId.value || !registrationReady.value) return
  registrationBusy.value = true
  registrationError.value = ''
  registrationMessage.value = 'Memeriksa apakah Spreadsheet sudah terdaftar...'
  try {
    const checked = await checkRegistration()
    if (!checked) { registrationMessage.value = ''; return }
    if (checked.registered) {
      if (checked.owned_by_me && checked.source_id) {
        await openDuplicateSource(checked.source_id)
        registrationMessage.value = `Spreadsheet sudah terdaftar sebagai ${checked.source_name}. Sumber yang ada telah dibuka.`
      } else {
        registrationError.value = 'Spreadsheet sudah terdaftar oleh pengguna lain di tenant ini. Hubungi admin untuk memakai sumber yang ada.'
        registrationMessage.value = ''
      }
      return
    }
    registrationMessage.value = 'Mengirim pendaftaran sumber...'
    const result = await call<{ job_id: string; source: Source; already_registered: boolean; duplicate_source_ids: string[] }>('POST', '/sources/google-sheets', {
      ...registration.value,
      sync_schedule: registration.value.sync_schedule.trim() || null,
    })
    registrationSourceId.value = result.source.id
    registrationReused.value = result.already_registered
    registrationDuplicateIds.value = result.duplicate_source_ids
    registrationJobId.value = result.job_id
    sourceId.value = result.source.id
    sources.value = [result.source, ...sources.value.filter((item) => item.id !== result.source.id)]
    registrationMessage.value = result.already_registered
      ? 'Spreadsheet ini sudah terhubung. Sumber yang ada dipilih kembali; tidak ada sumber atau job discovery baru yang dibuat.'
      : 'Sumber sudah terdaftar. Menunggu hasil discovery dari worker; jangan tekan Hubungkan lagi.'
    job.value = { id: result.job_id, status: 'QUEUED', kind: 'DISCOVER', source_id: result.source.id }
    clearTimeout(timer)
    generation++
    pollDeadline = Date.now() + 120_000
    await poll(result.job_id, generation)
  } catch (cause) {
    registrationError.value = `Pendaftaran belum dikonfirmasi: ${getApiErrorMessage(cause)}. Periksa daftar sumber sebelum mencoba lagi.`
    registrationMessage.value = ''
  } finally {
    registrationBusy.value = false
  }
}
async function enqueue(path: string, body?: unknown) {
  const result = await call<{ job_id: string; source?: Source }>('POST', path, body)
  if (result.source) sourceId.value = result.source.id
  clearTimeout(timer)
  generation++
  pollDeadline = Date.now() + 120_000
  await poll(result.job_id, generation)
}
watch(
  user,
  async () => {
    generation++
    clearTimeout(timer)
    sources.value = []
    sheets.value = []
    configs.value = []
    sourceId.value = ''
    sheetId.value = ''
    job.value = null
    profiles.value = []
    syncReviews.value = null
    migrationPreview.value = null
    registrationOptions.value = null
    registrationCheck.value = null
    registrationOptionsLoading.value = false
    registrationOptionsError.value = ''
    reviewContext.value = null
    policyOptions.value = null
    selectedPolicyId.value = ''
    rejectReason.value = 'SCOPE_MISMATCH'
    registration.value.access_metadata = emptyAccessMetadata()
    registrationBusy.value = false
    registrationError.value = ''
    registrationMessage.value = ''
    registrationJobId.value = ''
    registrationSourceId.value = ''
    registrationReused.value = false
    registrationDuplicateIds.value = []
    offset.value = 0
    if (canRead.value) await run(async () => {
      await Promise.all([load(), ...(canEdit.value ? [loadRegistrationOptions()] : [])])
      const requestedSourceId = typeof route.query.source_id === 'string' ? route.query.source_id : ''
      if (requestedSourceId) {
        let requestedSource = sources.value.find((source) => source.id === requestedSourceId)
        if (!requestedSource) {
          requestedSource = await call<Source>('GET', `/sources/${requestedSourceId}`)
          sources.value = [requestedSource, ...sources.value]
        }
        sourceId.value = requestedSource.id
        await selectSource()
      }
    })
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  generation++
  clearTimeout(timer)
})
</script>
<template>
  <EtlShell>
    <p class="eyebrow">DARI SPREADSHEET KE DATA TERVALIDASI</p>
    <h1>Workspace konfigurasi ETL</h1>
    <p class="muted">
      Kelola profiling, konfigurasi manual, review, dan pemuatan untuk sumber yang dipilih.
    </p>
    <p><RouterLink to="/sources">Kembali ke daftar sumber &amp; tracking</RouterLink></p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="notice" role="status" class="success">{{ notice }}</p>
    <details v-if="canEdit" class="panel">
      <summary>Hubungkan Google Sheet baru</summary>
      <form @submit.prevent="submitRegistration" @invalid.capture="registrationError = 'Lengkapi semua field wajib sebelum menghubungkan Sheet.'">
        <div class="grid">
          <label>Nama sumber<input v-model="registration.name" required maxlength="200" /></label>
          <label>URL spreadsheet<input v-model="registration.spreadsheet_url" required @blur="checkRegistration" /></label>
        </div>
        <div class="grid">
          <label>Deskripsi<textarea v-model="registration.description" maxlength="2000" /></label>
          <label
            >Jadwal otomatis<select v-model="registration.sync_schedule">
              <option value="">Tanpa jadwal</option>
              <option value="0 * * * *">Setiap jam</option>
              <option value="0 */6 * * *">Setiap 6 jam</option>
              <option value="0 0 * * *">Setiap hari pukul 00.00 UTC</option>
              <option value="0 0 * * 1">Setiap Senin pukul 00.00 UTC</option>
            </select></label
          >
        </div>
        <p class="muted">
          Kode sumber, UUID, dan referensi kredensial dibuat atau ditentukan otomatis oleh sistem.
        </p>
        <p v-if="registrationChecking" role="status" class="notice">Memeriksa Spreadsheet yang sudah terdaftar...</p>
        <p v-if="registrationCheck?.registered" role="alert" class="notice">
          {{ registrationCheck.owned_by_me
            ? `Spreadsheet ini sudah terdaftar sebagai ${registrationCheck.source_name}. Gunakan sumber yang ada.`
            : 'Spreadsheet ini sudah terdaftar oleh pengguna lain. Hubungi admin sebelum mendaftar ulang.' }}
          <button v-if="registrationCheck.source_id" type="button" @click="run(() => openDuplicateSource(registrationCheck!.source_id!))">Buka sumber</button>
        </p>
        <p v-if="registrationOptionsLoading" role="status" class="notice">Memuat pilihan metadata sumber...</p>
        <p v-if="registrationOptionsError" role="alert" class="error">
          Pilihan metadata gagal dimuat: {{ registrationOptionsError }}
        </p>
        <div v-if="registrationOptions && missingRegistrationScopes.length" role="status" class="notice">
          Belum ada assignment aktif untuk {{ missingRegistrationScopes.join(', ') }} pada akun login
          <strong>{{ user?.username }}</strong>.
          Atribut yang sudah dibuat di Administrasi tidak otomatis muncul di sini. Admin lain perlu
          memberikan assignment pada akun pendaftar, lalu muat ulang pilihan. Assignment untuk
          akun admin sendiri juga harus diberikan oleh admin lain.
          <RouterLink v-if="user?.role === 'PLATFORM_ADMIN'" to="/admin/users">Kelola assignment pengguna</RouterLink>
        </div>
        <p v-if="registrationOptions && !registrationOptions.purposes.length" role="status" class="notice">
          Purpose aktif belum tersedia di tenant ini. Minta admin membuatnya di Administrasi.
        </p>
        <p v-if="registrationOptions && !registrationOptions.people.length" role="status" class="notice">
          Data owner/steward aktif belum tersedia. Minta admin memeriksa akun pengguna.
        </p>
        <button type="button" :disabled="registrationOptionsLoading || busy" @click="loadRegistrationOptions">
          Muat ulang pilihan
        </button>
        <div class="grid">
          <label>Unit pemilik<select v-model="registration.access_metadata.owner_unit_id" required>
            <option value="" disabled>Pilih unit</option>
            <option v-for="scope in scopeOptions('DEPARTMENT')" :key="scope.id" :value="scope.id">
              {{ scope.code }} · {{ scope.label }}
            </option>
          </select></label>
          <label>Domain bisnis<select v-model="registration.access_metadata.business_domain_id" required>
            <option value="" disabled>Pilih domain</option>
            <option v-for="scope in scopeOptions('BUSINESS_DOMAIN')" :key="scope.id" :value="scope.id">
              {{ scope.code }} · {{ scope.label }}
            </option>
          </select></label>
          <label>Yurisdiksi<select v-model="registration.access_metadata.jurisdiction_id" required>
            <option value="" disabled>Pilih yurisdiksi</option>
            <option v-for="scope in scopeOptions('JURISDICTION')" :key="scope.id" :value="scope.id">
              {{ scope.code }} · {{ scope.label }}
            </option>
          </select></label>
          <label>Purpose<select v-model="registration.access_metadata.purpose_id" required>
            <option value="" disabled>Pilih purpose</option>
            <option v-for="purpose in registrationOptions?.purposes || []" :key="purpose.id" :value="purpose.id">
              {{ purpose.code }} · {{ purpose.label }}
            </option>
          </select></label>
          <label>Data owner<select v-model="registration.access_metadata.data_owner_user_id" required>
            <option value="" disabled>Pilih owner</option>
            <option v-for="person in registrationOptions?.people || []" :key="person.id" :value="person.id">
              {{ person.username }} · {{ person.role }}
            </option>
          </select></label>
          <label>Data steward<select v-model="registration.access_metadata.data_steward_user_id" required>
            <option value="" disabled>Pilih steward</option>
            <option v-for="person in registrationOptions?.people || []" :key="person.id" :value="person.id">
              {{ person.username }} · {{ person.role }}
            </option>
          </select></label>
          <label>Sensitivitas<select v-model="registration.access_metadata.sensitivity" required>
            <option value="" disabled>Pilih sensitivitas</option>
            <option v-for="level in registrationOptions?.sensitivities || []" :key="level" :value="level">
              {{ level }}
            </option>
          </select></label>
        </div>
        <p class="muted">
          Bagikan spreadsheet ke email service account backend dengan akses Viewer sebelum
          menghubungkan.
        </p>
        <button class="primary" :disabled="busy || registrationBusy || !!registrationJobId || !registrationReady">
          {{ registrationBusy ? 'Menghubungkan...' : registrationCheck?.registered ? 'Gunakan sumber yang ada' : 'Hubungkan & profiling' }}
        </button>
        <p v-if="registrationMessage" role="status" class="notice">{{ registrationMessage }}</p>
        <p v-if="registrationError" role="alert" class="error">{{ registrationError }}</p>
        <p v-if="registrationDuplicateIds.length" class="muted">
          Ada {{ registrationDuplicateIds.length }} sumber lama lain untuk Spreadsheet ini. Gunakan sumber yang dipilih dan minta admin meninjau duplikatnya.
        </p>
        <p v-if="registrationJobId" class="muted">
          <RouterLink :to="{ path: '/jobs', query: { job: registrationJobId } }">Buka monitor job discovery</RouterLink>
          <span v-if="registrationSourceId"> · Sumber sudah tercatat di sistem.</span>
        </p>
      </form>
    </details>
    <section class="panel">
      <h2>Pilih sumber dan tab</h2>
      <div class="grid">
        <label>
          Sumber
          <SearchableSelect
            v-model="sourceId"
            :options="sourceOptions"
            placeholder="Pilih sumber"
            :disabled="busy"
            @change="run(selectSource)"
          />
        </label>
        <label>
          Tab Google Sheet
          <SearchableSelect
            v-model="sheetId"
            :options="sheetOptions"
            placeholder="Pilih tab"
            :disabled="busy"
            @change="run(loadConfigs)"
          />
        </label>
      </div>
      <p v-if="selectedSource" role="status">
        Status akses: {{ selectedSource.access_status === 'POLICY_APPROVED' ? 'Policy approved' : 'Perlu policy akses' }}
      </p>
      <p v-if="selectedSource?.access_metadata && selectedSource.access_status !== 'POLICY_APPROVED'" class="notice" role="status">
        Produk data sumber ini belum tersedia sampai policy akses disetujui.
      </p>
      <p v-if="selectedSource" role="status">
        Review metadata: {{ selectedSource.access_review_status || 'PENDING' }}
        <span v-if="selectedSource.access_review_reason"> · {{ selectedSource.access_review_reason }}</span>
      </p>
      <div class="toolbar">
        <button :disabled="busy || offset === 0" @click="changePage(-50)">Sumber sebelumnya</button
        ><button :disabled="busy || sources.length < 50" @click="changePage(50)">
          Sumber berikutnya
        </button>
        <button
          :disabled="busy"
          @click="
            run(async () => {
              await load()
              await selectSource()
            })
          "
        >
          Muat ulang
        </button>
        <button
          v-if="canEdit"
          :disabled="busy || !sourceId"
          @click="run(() => enqueue(`/sources/${sourceId}/discover`))"
        >
          Temukan tab
        </button>
        <button
          v-if="canEdit"
          :disabled="busy || !sourceId"
          @click="run(() => enqueue(`/sources/${sourceId}/profile`))"
        >
          Profiling ulang
        </button>
        <button
          v-if="canEdit"
          class="primary"
          :disabled="busy || !sourceId"
          @click="run(syncReview)"
        >
          Buat batch sync review
        </button>
        <button v-if="sourceId" :disabled="busy" @click="run(loadMigrationPreview)">
          Preview migrasi master
        </button>
      </div>
    </section>
    <section v-if="selectedSource && canEdit" class="panel">
      <h2>Metadata akses sumber</h2>
      <form @submit.prevent="run(saveAccessMetadata)">
        <div class="grid">
          <label>Unit pemilik sumber<select v-model="metadataEdit.owner_unit_id" required>
            <option value="" disabled>Pilih unit</option>
            <option v-for="scope in scopeOptions('DEPARTMENT')" :key="scope.id" :value="scope.id">
              {{ scope.code }} · {{ scope.label }}
            </option>
          </select></label>
          <label>Domain bisnis sumber<select v-model="metadataEdit.business_domain_id" required>
            <option value="" disabled>Pilih domain</option>
            <option v-for="scope in scopeOptions('BUSINESS_DOMAIN')" :key="scope.id" :value="scope.id">
              {{ scope.code }} · {{ scope.label }}
            </option>
          </select></label>
          <label>Yurisdiksi sumber<select v-model="metadataEdit.jurisdiction_id" required>
            <option value="" disabled>Pilih yurisdiksi</option>
            <option v-for="scope in scopeOptions('JURISDICTION')" :key="scope.id" :value="scope.id">
              {{ scope.code }} · {{ scope.label }}
            </option>
          </select></label>
          <label>Purpose sumber<select v-model="metadataEdit.purpose_id" required>
            <option value="" disabled>Pilih purpose</option>
            <option v-for="purpose in registrationOptions?.purposes || []" :key="purpose.id" :value="purpose.id">
              {{ purpose.code }} · {{ purpose.label }}
            </option>
          </select></label>
          <label>Data owner sumber<select v-model="metadataEdit.data_owner_user_id" required>
            <option value="" disabled>Pilih owner</option>
            <option v-for="person in registrationOptions?.people || []" :key="person.id" :value="person.id">
              {{ person.username }} · {{ person.role }}
            </option>
          </select></label>
          <label>Data steward sumber<select v-model="metadataEdit.data_steward_user_id" required>
            <option value="" disabled>Pilih steward</option>
            <option v-for="person in registrationOptions?.people || []" :key="person.id" :value="person.id">
              {{ person.username }} · {{ person.role }}
            </option>
          </select></label>
          <label>Sensitivitas sumber<select v-model="metadataEdit.sensitivity" required>
            <option value="" disabled>Pilih sensitivitas</option>
            <option v-for="level in registrationOptions?.sensitivities || []" :key="level" :value="level">
              {{ level }}
            </option>
          </select></label>
        </div>
        <button class="primary" :disabled="busy || !registrationOptions || selectedSource.access_revision === undefined">
          Simpan metadata akses
        </button>
      </form>
    </section>
    <section v-if="selectedSource && reviewRoles.includes(user?.role || '')" class="panel">
      <h2>Review metadata sumber</h2>
      <button :disabled="busy" @click="run(loadReviewContext)">Tinjau metadata</button>
      <template v-if="reviewContext">
        <dl class="grid">
          <div v-for="item in reviewAttributes" :key="item.key">
            <dt>{{ item.label }}</dt>
            <dd>{{ reviewContext.attributes[item.key]?.code || 'Tidak tersedia' }} · {{ reviewContext.attributes[item.key]?.label || 'Tidak tersedia' }}</dd>
          </div>
          <div v-for="item in reviewPeople" :key="item.key">
            <dt>{{ item.label }}</dt>
            <dd>{{ reviewContext.people[item.key]?.username || 'Tidak tersedia' }}</dd>
          </div>
          <div><dt>Sensitivitas</dt><dd>{{ reviewContext.sensitivity || 'Tidak tersedia' }}</dd></div>
        </dl>
        <div class="toolbar">
          <button class="primary" :disabled="busy || !canApproveReview" @click="run(() => decideReview('APPROVE'))">
            Setujui metadata
          </button>
          <label>Alasan penolakan<select v-model="rejectReason">
            <option value="SCOPE_MISMATCH">Scope tidak sesuai</option>
            <option value="OWNER_UNCONFIRMED">Owner belum dikonfirmasi</option>
            <option value="OTHER">Alasan lain</option>
          </select></label>
          <button :disabled="busy || !canDecideReview" @click="run(() => decideReview('REJECT'))">
            Tolak metadata
          </button>
        </div>
      </template>
      <div v-if="user?.role === 'PLATFORM_ADMIN' && selectedSource.access_review_status === 'APPROVED' && selectedSource.access_status !== 'POLICY_APPROVED'" class="toolbar">
        <button :disabled="busy" @click="run(loadPolicyOptions)">Muat policy SOURCE</button>
        <label v-if="policyOptions">Policy sumber<select v-model="selectedPolicyId">
          <option value="">Pilih policy approved</option>
          <option v-for="policy in policyOptions" :key="policy.id" :value="policy.id">
            {{ policy.code }} · {{ policy.label }}
          </option>
        </select></label>
        <button class="primary" :disabled="busy || !selectedPolicyId || selectedSource.access_metadata_editor_id === user?.id"
          @click="run(activateSourceAccess)">Aktifkan policy sumber</button>
      </div>
    </section>
    <section v-if="sourceId" class="panel">
      <h2>Kesiapan klasifikasi sumber</h2>
      <p v-for="blocker in blockers" :key="blocker" class="notice">{{ blocker }}</p>
      <p v-if="!blockers.length" class="success">
        Semua tab enabled telah dikonfirmasi NON_MASTER. Prasyarat data/approval tetap diperiksa
        server.
      </p>
    </section>
    <section v-if="syncReviews || migrationPreview" class="panel">
      <h2>Hasil batch dan migrasi</h2>
      <details v-if="syncReviews" open>
        <summary>Batch sync review</summary>
        <pre>{{ JSON.stringify(syncReviews, null, 2) }}</pre>
      </details>
      <details v-if="migrationPreview" open>
        <summary>Preview migrasi MASTER</summary>
        <pre>{{ JSON.stringify(migrationPreview, null, 2) }}</pre>
      </details>
    </section>
    <SheetClassification
      v-if="selectedSheet"
      :key="sheetId"
      :sheet-id="sheetId"
      :source-id="sourceId"
      :active="!!selectedSheet.active_configuration_id"
      :disabled="busy"
      @changed="
        run(async () => {
          sheets = await call<Sheet[]>('GET', `/sources/${sourceId}/sheets`)
          await loadConfigs()
        })
      "
    />
    <section v-if="selectedSheet" class="panel">
      <h2>Profil &amp; pengaturan tab</h2>
      <RouterLink
        v-if="selectedSheet.enabled && selectedSheet.last_fingerprint"
        class="button"
        to="/import-reviews"
        >Buat review batch import</RouterLink
      >
      <RouterLink
        v-if="selectedSheet.enabled && selectedSheet.last_fingerprint"
        class="button"
        :to="`/sources/${sourceId}/sheets/${selectedSheet.id}/column-bindings`"
        >Atur referensi master</RouterLink
      >
      <RouterLink
        v-if="selectedSheet.enabled && selectedSheet.last_fingerprint"
        class="button"
        :to="`/sources/${sourceId}/sheets/${selectedSheet.id}/taxonomy-bindings`"
        >Atur binding taxonomy</RouterLink
      >
      <p v-if="!selectedSheet.last_fingerprint" class="notice">
        Tab memerlukan profiling sebelum pembuatan draft.
      </p>
      <details v-if="canEdit">
        <summary>Pengaturan pembacaan Sheet</summary>
        <form @submit.prevent="run(updateSheet)">
          <fieldset :disabled="busy || !!selectedSheet.active_configuration_id">
            <div class="grid">
              <label
                >Range A1<input
                  v-model="sheetSettings.range_a1"
                  required
                  pattern="[A-Z]+(?:1)?:[A-Z]+[0-9]*" /></label
              ><label
                >Baris header<input
                  v-model.number="sheetSettings.header_row"
                  type="number"
                  min="1"
                  max="100"
                  required /></label
              ><label
                >Awal data<input
                  v-model.number="sheetSettings.data_start_row"
                  type="number"
                  :min="sheetSettings.header_row + 1"
                  max="1000"
                  required /></label
              ><label class="check"
                ><input v-model="sheetSettings.enabled" type="checkbox" />Tab aktif</label
              >
            </div>
            <button>Simpan pengaturan tab</button>
          </fieldset>
        </form>
        <p class="muted">
          Pengaturan tidak dapat diubah jika sudah ada konfigurasi aktif. Setelah perubahan,
          jalankan profiling ulang.
        </p>
      </details>
      <details v-if="canEdit && currentProfile">
        <summary>Incremental watermark</summary>
        <form @submit.prevent="run(updateWatermark)">
          <div class="grid">
            <label
              >Kolom watermark<select v-model="watermarkSettings.source_column">
                <option :value="null">Nonaktif</option>
                <option
                  v-for="column in currentProfile.profile_json.columns"
                  :key="column.source_column"
                  :value="column.source_column"
                >
                  {{ column.source_column }}
                </option>
              </select></label
            >
            <label
              >Jenis watermark<select
                v-model="watermarkSettings.kind"
                :required="Boolean(watermarkSettings.source_column)"
                :disabled="!watermarkSettings.source_column"
              >
                <option :value="null" disabled>Pilih jenis</option>
                <option>INTEGER</option>
                <option>DECIMAL</option>
                <option>DATE</option>
                <option>DATETIME</option>
              </select></label
            >
          </div>
          <p class="muted">
            Nilai tersimpan: {{ selectedSheet.watermark_value || 'belum ada' }}. Hanya nilai yang
            lebih besar diproses; watermark maju setelah load/apply sukses.
          </p>
          <button :disabled="busy">Simpan watermark</button>
        </form>
      </details>
      <template v-if="currentProfile"
        ><p>
          {{ currentProfile.profile_json.row_count }} baris · {{ currentProfile.created_at }} ·
          {{ currentProfile.status }}
        </p>
        <p v-for="warning in currentProfile.profile_json.warnings" :key="warning" class="notice">
          {{ warning }}
        </p>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Kolom sumber</th>
                <th>Tipe perkiraan</th>
                <th>Rasio kosong</th>
                <th>Rasio distinct</th>
                <th>Indikasi PII</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="column in currentProfile.profile_json.columns" :key="column.source_column">
                <td>{{ column.source_column }}</td>
                <td>{{ column.inferred_type }}</td>
                <td>{{ column.null_ratio }}</td>
                <td>{{ column.distinct_ratio }}</td>
                <td>{{ column.pii_suspected ? 'Perlu diperiksa' : 'Tidak terdeteksi' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted">
          Sampel profil disamarkan oleh backend. Profil yang ditampilkan sesuai tab terpilih.
        </p></template
      >
      <ManualDraft
        v-if="canEdit && selectedSheet.last_fingerprint && selectedSheet.enabled && currentProfile"
        :key="sheetId"
        :sheet-id="sheetId"
        :profile="currentProfile"
      />
    </section>
    <section v-if="job" class="panel" aria-live="polite">
      <h2>Proses: {{ job.status }}</h2>
      <p>{{ job.id }}</p>
      <RouterLink class="button" :to="{ path: '/jobs', query: { job: job.id } }"
        >Buka monitor job</RouterLink
      >
      <p v-if="job.status === 'QUEUED'" class="notice">
        Menunggu worker backend. Proses akan diperbarui otomatis.
      </p>
      <p v-if="job.status === 'FAILED'" class="error">
        {{ job.error_code }} {{ job.error_message || 'Proses gagal. Periksa detail job backend.' }}
      </p>
      <details v-if="job.result">
        <summary>Hasil proses</summary>
        <pre>{{ JSON.stringify(job.result, null, 2) }}</pre>
      </details>
    </section>
    <section class="panel">
      <h2>Versi konfigurasi</h2>
      <p v-if="!configs.length" class="muted">
        Pilih tab. Jika belum ada draft, jalankan rekomendasi AI setelah profiling selesai.
      </p>
      <div v-for="c in configs" :key="c.id" class="card-row toolbar">
        <strong>{{ c.configuration_json.dataset_business_name }}</strong
        ><span>v{{ c.version_no }} · revisi {{ c.revision_no }}</span
        ><span class="tag">{{ c.status }}</span
        ><RouterLink class="button primary" :to="`/configurations/${c.id}/review`"
          >Buka review</RouterLink
        >
      </div>
    </section>
  </EtlShell>
</template>
