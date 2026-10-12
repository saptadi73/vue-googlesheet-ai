<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { formatDefaultScalar, parseDefaultScalar } from '@/lib/defaultScalar'
import { normalizeProductCode, suggestDatasetIdentity } from '@/lib/datasetIdentity'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import EtlShell from '@/components/EtlShell.vue'
import ConfigurationHistory from '@/components/ConfigurationHistory.vue'
import SheetClassification from '@/components/SheetClassification.vue'
import TaxonomyMapping from '@/components/TaxonomyMapping.vue'
import { validateTaxonomyConfiguration } from '@/lib/taxonomies'
import {
  normalizeConfiguration,
  configurationIssues,
  type ConfigurationIssue,
} from '@/lib/configurationValidation'
import Card from '@/components/ui/Card.vue'
import Modal from '@/components/ui/Modal.vue'
import Spinner from '@/components/ui/Spinner.vue'
import CardSkeleton from '@/components/ui/CardSkeleton.vue'
import {
  CircleCheck,
  CircleHelp,
  CircleX,
  Copy,
  Download,
  GitBranch,
  RefreshCw,
  Rocket,
  Save,
  Upload,
} from '@lucide/vue'
import { classificationEvidenceMatches } from '@/lib/classification'
import { buildEtlStepProgress } from '@/lib/etlProgress'
import { getEtlStepGuide } from '@/lib/etlStepGuides'
import { downloadFile, getApiErrorMessage } from '@/lib/api'
import {
  call,
  copy,
  currencies,
  dqFormats,
  dqSeverities,
  editRoles,
  numberLocales,
  qualityRules,
  reviewRoles,
  roles,
  roundings,
  sections,
  sectionLabels,
  transforms,
  types,
  units,
  user,
  type Column,
  type ETL,
  type Quality,
  type Review,
  type Preview,
  type Config,
  type Job,
  type Metric,
  type MetricFilter,
  type TransformParameter,
  type Validation,
  type ConfigurationAccessReview,
} from '@/lib/etl'
const route = useRoute(),
  router = useRouter()
const details = ref<Review | null>(null),
  draft = ref<ETL | null>(null),
  preview = ref<Preview | null>(null),
  parameterCatalog = ref<{
    schema_version: string
    parameters: Array<Record<string, unknown>>
    operations: Array<Record<string, unknown>>
    capabilities: Record<string, unknown>
  } | null>(null)
const releaseStatus = ref<{ configured: boolean; ready: boolean; groups: { key: string; label: string; status: string }[] } | null>(null)
const error = ref(''),
  notice = ref(''),
  busy = ref(false),
  step = ref(0),
  helpStep = ref<number | null>(null),
  comment = ref('')
const ownerWorkflow = computed(() => {
  const result = details.value
  if (!result?.owner_workflow_enabled) return false
  return result.configuration.review_state?.owner_managed === true ||
    ['AI_DRAFT', 'NEEDS_REVIEW'].includes(result.configuration.status)
})
const finalStepLabel = computed(() => ownerWorkflow.value ? 'Validasi & deploy' : 'Validasi & persetujuan')
const activeStepGuide = computed(() => {
  if (helpStep.value === null) return null
  return getEtlStepGuide(helpStep.value, ownerWorkflow.value)
})
const schemaReviewed = ref(false)
const schemaMigration = computed(() => details.value?.validation.deployment_plan?.migration)
function schemaChangeLabel(change: string) {
  return ({ ADDED: 'Kolom tambahan', REMOVED: 'Kolom dihapus', TYPE: 'Tipe', NULLABILITY: 'Nullability', KEY: 'Key' } as Record<string, string>)[change] || change
}
function schemaKeysLabel(keys: string[][]) {
  return keys.map(key => key.filter(name => !name.startsWith('_')).join(', ')).filter(Boolean).join(' / ') || 'Identitas record otomatis'
}
const schemaReviewStale = computed(() => !isMasterTab.value && record.value?.status === 'NEEDS_REVIEW' &&
  schemaMigration.value &&
  (record.value.review_state?.schema_migration || schemaMigration.value.requires_migration) &&
  record.value.review_state?.schema_migration?.fingerprint !== schemaMigration.value.fingerprint)
const suggestedIdentity = computed(() => details.value ? suggestDatasetIdentity(
  details.value.profile?.spreadsheet_title || details.value.source.name,
  details.value.sheet.sheet_name,
) : null)
const codeNormalizationNotice = ref('')
function normalizeIdentityCode() {
  if (!draft.value || !canEdit.value) return
  const before = draft.value.semantic.code
  const after = normalizeProductCode(before)
  if (after !== before) {
    draft.value.semantic.code = after
    codeNormalizationNotice.value = `Kode produk data dirapikan otomatis menjadi ${after}. Nama bisnis tidak diubah.`
  }
}
function useSourceIdentity() {
  if (!draft.value || !suggestedIdentity.value) return
  draft.value.dataset_business_name = suggestedIdentity.value.businessName
  draft.value.semantic.code = suggestedIdentity.value.code
  notice.value = 'Nama bisnis dan kode diisi dari nama file/sumber dan tab. Periksa lalu simpan draft; belum ada perubahan tersimpan.'
}
const fieldIssues = ref<ConfigurationIssue[]>([])
const defaultInputs = ref(new Map<Quality, string>())
const hasInvalidDefaults = computed(
  () => draft.value?.data_quality_rules.some((q) => !!defaultValueError(q)) ?? false,
)
function defaultValueError(q: Quality) {
  const result = parseDefaultScalar(defaultValueText(q))
  return result.valid ? '' : result.error
}
const answers = ref<Record<string, string>>({}),
  resolved = ref<string[]>([])
const checkedColumns = ref<string[]>([]),
  checkedSections = ref<string[]>([]),
  job = ref<Job | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0
let pollDeadline = 0
const configId = computed(() => String(route.params.id))
const base = computed(() => `/configurations/${configId.value}`)
const record = computed(() => details.value?.configuration)
const isMasterTab = computed(() => details.value?.classification.dataset_kind === 'MASTER')
const masterBindingPath = computed(() =>
  record.value
    ? `/sources/${record.value.source_id}/sheets/${record.value.source_sheet_id}/master-binding`
    : '/etl',
)
const isDraft = computed(
  () => !!record.value && ['AI_DRAFT', 'NEEDS_REVIEW'].includes(record.value.status),
)
const editor = computed(() => !!user.value && editRoles.includes(user.value.role))
const canEdit = computed(() => editor.value && isDraft.value)
const reviewer = computed(() => !!user.value && reviewRoles.includes(user.value.role))
const canRollbackOwnerManaged = computed(() => {
  const actor = user.value
  const metadata = details.value?.source.access_metadata
  if (!actor || !details.value?.configuration.review_state?.owner_managed) return false
  if (actor.role === 'PLATFORM_ADMIN') return true
  return (
    editRoles.includes(actor.role) &&
    [metadata?.data_owner_user_id, metadata?.data_steward_user_id].includes(actor.id)
  )
})
const dirty = computed(
  () =>
    !!draft.value &&
    (hasInvalidDefaults.value ||
      JSON.stringify(draft.value) !== JSON.stringify(record.value?.configuration_json) ||
      resolved.value.length > 0 ||
      Object.values(answers.value).some(Boolean)),
)
const submitted = computed(
  () =>
    record.value?.review_state?.submitted_revision === record.value?.revision_no &&
    evidenceReady.value,
)
const evidenceReady = computed(
  () =>
    !!record.value && classificationEvidenceMatches(record.value, details.value?.classification),
)
const ready = computed(
  () =>
    !dirty.value &&
    details.value?.validation.ready_for_review === true &&
    !!details.value.validation.snapshot_hash &&
    (ownerWorkflow.value || (checkedColumns.value.length === draft.value?.columns.length && checkedSections.value.length === sections.length)) &&
    (!schemaMigration.value?.operations.some(op => op.action !== 'CREATE_TABLE') || schemaReviewed.value),
)
const submitBlockers = computed(() => {
  if (!details.value || !draft.value) return ['Konfigurasi belum selesai dimuat.']
  const blockers: string[] = []
  if (dirty.value) blockers.push('Simpan perubahan draft terlebih dahulu.')
  if (schemaMigration.value?.operations.some(op => op.action !== 'CREATE_TABLE') && !schemaReviewed.value)
    blockers.push('Periksa dan konfirmasi rencana perubahan schema.')
  if (details.value.validation.ready_for_review !== true)
    blockers.push('Dry-run belum lulus atau masih ada pertanyaan/temuan yang wajib diselesaikan.')
  if (!details.value.validation.snapshot_hash)
    blockers.push('Snapshot belum tersedia; jalankan dry-run ulang.')
  if (!ownerWorkflow.value && checkedSections.value.length !== sections.length)
    blockers.push(`Periksa dan centang seluruh bagian (${checkedSections.value.length}/${sections.length}).`)
  if (!ownerWorkflow.value && checkedColumns.value.length !== draft.value.columns.length)
    blockers.push(`Periksa dan centang seluruh mapping kolom (${checkedColumns.value.length}/${draft.value.columns.length}).`)
  return blockers
})
const stepProgress = computed(() => buildEtlStepProgress({
  labels: sectionLabels,
  finalLabel: finalStepLabel.value,
  sectionKeys: sections,
  checkedSections: checkedSections.value,
  activeStep: step.value,
  dirty: dirty.value,
  validationReady: ready.value,
  submitted: submitted.value,
  ownerWorkflow: ownerWorkflow.value,
  active: record.value?.status === 'ACTIVE',
  jobStatus: job.value?.status,
}))
const finalStepProgress = computed(() => stepProgress.value[6] || {
  label: finalStepLabel.value,
  state: 'PENDING',
  status: 'Belum siap',
})
const progressMessage = computed(() => {
  if (job.value?.status === 'FAILED') return `Gagal terakhir: ${job.value.error_code || job.value.status}${job.value.error_message ? ` — ${job.value.error_message}` : ''}`
  if (error.value) return `Gagal terakhir: ${error.value}`
  if (dirty.value) return 'Perubahan draft belum disimpan. Simpan lalu jalankan dry-run agar hasil pemeriksaan sesuai revisi terbaru.'
  if (submitted.value) return ownerWorkflow.value
    ? 'Validasi pemilik tersimpan untuk revisi ini. Lanjutkan deploy jika konfigurasi sudah siap.'
    : 'Revisi sudah diajukan. Pantau keputusan di halaman Persetujuan tayang.'
  if (submitBlockers.value.length) return `Tindakan berikutnya: ${submitBlockers.value[0]}`
  if (record.value?.status === 'ACTIVE') return 'Konfigurasi aktif. Gunakan kontrol deploy atau sync untuk pekerjaan berikutnya.'
  return ownerWorkflow.value
    ? 'Pemeriksaan lengkap. Simpan validasi pemilik, lalu deploy jika status konfigurasi sudah siap.'
    : 'Pemeriksaan lengkap. Ajukan revisi untuk ditinjau.'
})
const appendPolicyAvailable = computed(
  () =>
    draft.value?.load_strategy === 'APPEND' &&
    !draft.value.columns.some((column) => column.is_business_key || column.is_primary_key),
)
const publicColumns = computed(
  () => draft.value?.columns.filter((c) => ['NONE', 'LOW'].includes(c.pii_classification)) || [],
)
const temporalDimensions = computed(() =>
  publicColumns.value.filter(
    (column) =>
      draft.value?.semantic.dimensions.includes(column.target_column) &&
      ['date', 'timestamp', 'timestamptz'].includes(column.target_type),
  ),
)
const unusedHeaders = computed(
  () =>
    details.value?.profile?.columns.filter(
      (c) => !draft.value?.columns.some((x) => x.source_column === c.source_column),
    ) || [],
)
const selectedHeader = ref('')
const rollbackAcknowledged = ref(false)
const decisionModal = ref<'approve' | 'reject' | null>(null)
const accessReview = ref<ConfigurationAccessReview | null>(null)
const accessPolicyId = ref('')
const accessBlockers = computed(() => {
  const context = accessReview.value
  if (!context) return ['Metadata akses belum dimuat. Muat ulang ringkasan approval.']
  const blockers: string[] = []
  if (context.reviewer_is_editor) blockers.push('Anda editor terakhir metadata. Gunakan approver lain yang berwenang.')
  if (context.review_status === 'REJECTED') blockers.push('Metadata ditolak. Editor perlu memperbaiki metadata di Workspace terlebih dahulu.')
  if (Object.values(context.attributes).some((item) => !item?.is_active) ||
      Object.values(context.people).some((item) => !item?.is_active) || !context.sensitivity)
    blockers.push('Metadata wajib belum lengkap atau atribut/penanggung jawab tidak aktif. Perbaiki melalui Workspace.')
  if (!context.policies.length) blockers.push('Belum ada policy SOURCE ALLOW APPROVED yang berlaku dan cocok. Admin perlu melengkapi binding sumber serta unit, domain, yurisdiksi pada policy.')
  if (context.policies.length && !accessPolicyId.value) blockers.push('Pilih policy yang akan digunakan untuk mengaktifkan akses.')
  return blockers
})
async function loadAccessReview() {
  const current = generation
  accessReview.value = null
  accessPolicyId.value = ''
  const result = await call<ConfigurationAccessReview>('GET', `${base.value}/access-review`)
  if (current !== generation || decisionModal.value !== 'approve') return
  accessReview.value = result
  if (result.policies.length === 1) accessPolicyId.value = result.policies[0]!.id
}
async function openDecision(action: 'approve' | 'reject') {
  comment.value = ''
  decisionModal.value = action
  if (action === 'approve') await run(loadAccessReview)
}
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
async function load() {
  const epoch = generation
  const [result, catalog] = await Promise.all([
    call<Review>('GET', `${base.value}/review`),
    call<typeof parameterCatalog.value>('GET', '/configurations/parameter-catalog'),
  ])
  if (epoch !== generation) return
  const config = result.configuration
  const pendingOwnerPath = result.owner_workflow_enabled &&
    (config.review_state?.owner_managed === true || ['AI_DRAFT', 'NEEDS_REVIEW'].includes(config.status))
  const releaseRequired = !pendingOwnerPath &&
    (!result.owner_workflow_enabled || ['APPROVED', 'ACTIVE', 'SUPERSEDED'].includes(config.status))
  const release = releaseRequired
    ? await call<typeof releaseStatus.value>('GET', `/release-approvals/configurations/${configId.value}`)
    : null
  if (epoch !== generation) return
  details.value = result
  parameterCatalog.value = catalog
  releaseStatus.value = release
  defaultInputs.value.clear()
  draft.value = copy(result.configuration.configuration_json)
  answers.value = {}
  resolved.value = []
  preview.value = null
  checkedColumns.value = []
  checkedSections.value = []
  schemaReviewed.value = false
  fieldIssues.value = []
}
function payload() {
  if (!draft.value || !record.value) throw new Error('Draft belum tersedia.')
  normalizeIdentityCode()
  if (hasInvalidDefaults.value)
    throw new Error('Perbaiki default value yang tidak valid sebelum menyimpan.')
  const configuration = normalizeConfiguration(draft.value),
    question_answers: Record<string, string> = {}
  fieldIssues.value = configurationIssues(configuration)
  if (fieldIssues.value.length) throw new Error('Perbaiki parameter konfigurasi sebelum menyimpan.')
  validateTaxonomyConfiguration(configuration)
  for (const q of resolved.value) {
    const answer = answers.value[q]?.trim()
    if (!answer) throw new Error(`Isi jawaban: ${q}`)
    question_answers[q] = answer
  }
  if (
    Object.keys(answers.value).some((q) => answers.value[q]?.trim() && !resolved.value.includes(q))
  )
    throw new Error('Tandai pertanyaan yang sudah dijawab sebagai selesai sebelum menyimpan.')
  configuration.unresolved_questions = configuration.unresolved_questions.filter(
    (q) => !resolved.value.includes(q),
  )
  if (
    configuration.load_strategy !== 'APPEND' ||
    configuration.columns.some((column) => column.is_business_key || column.is_primary_key)
  ) {
    delete configuration.append_duplicate_policy
  }
  return { revision_no: record.value.revision_no, configuration, question_answers }
}
async function save() {
  await call('PATCH', base.value, payload())
  await load()
  notice.value = ownerWorkflow.value
    ? 'Draft tersimpan. Jalankan validasi untuk memeriksa snapshot, kualitas, akses, dan schema.'
    : 'Draft tersimpan. Periksa hasil validasi dan checklist review.'
}
async function validate() {
  if (dirty.value) throw new Error('Simpan perubahan sebelum dry-run.')
  await load()
  if (!details.value) return
  details.value.validation = { valid: false, ready_for_review: false }
  details.value.validation = await call<Validation>('POST', `${base.value}/validate`)
  notice.value = ownerWorkflow.value
    ? 'Validasi diperbarui terhadap snapshot profiling terakhir. Selesaikan blocker yang ditampilkan.'
    : 'Validasi diperbarui terhadap snapshot profiling terakhir. Periksa kembali checklist review.'
}
async function submit() {
  if (!ready.value || !record.value) throw new Error(ownerWorkflow.value ? 'Selesaikan blocker validasi terlebih dahulu.' : 'Lengkapi pemeriksaan semua bagian dan kolom.')
  const result = await call<Config>('POST', `${base.value}/submit-review`, {
    revision_no: record.value.revision_no,
    snapshot_hash: details.value?.validation.snapshot_hash,
    reviewed_columns: checkedColumns.value,
    reviewed_sections: checkedSections.value,
    reviewed_schema_fingerprint: schemaReviewed.value ? schemaMigration.value?.fingerprint : undefined,
  })
  await load()
  notice.value = result.status === 'APPROVED'
    ? 'Konfigurasi lolos validasi dan disetujui oleh pemilik. Anda dapat melanjutkan ke deploy.'
    : 'Review diajukan. Akun approver yang berbeda dapat memeriksa dan menyetujuinya.'
}
async function decision(action: 'approve' | 'reject') {
  if (dirty.value) throw new Error('Simpan atau muat ulang perubahan terlebih dahulu.')
  if (action === 'approve' && schemaReviewStale.value)
    throw new Error('Rencana schema berubah atau belum direview. Editor perlu mengajukan review ulang.')
  if (action === 'approve' && (accessBlockers.value.length || !accessReview.value))
    throw new Error('Approval gabungan belum dapat dilakukan. Selesaikan blocker dan baca helper.')
  await call('POST', `${base.value}/${action}`, {
    revision_no: record.value?.revision_no,
    comment: comment.value,
    ...(action === 'approve' && accessReview.value ? {
      source_access: { revision_no: accessReview.value.access_revision, policy_id: accessPolicyId.value },
    } : {}),
  })
  await load()
  notice.value =
    action === 'approve'
      ? 'Konfigurasi dan metadata disetujui; akses sumber aktif melalui policy terpilih. Deploy lalu Sync manual tetap diperlukan untuk memuat data. Gate siap tayang tetap berlaku.'
      : 'Konfigurasi ditolak. Clone untuk membuat perbaikan.'
  decisionModal.value = null
}
async function clone() {
  const c = await call<Config>('POST', `${base.value}/clone`)
  await router.push(`/configurations/${c.id}/review`)
}
async function poll(id: string, epoch: number) {
  if (epoch !== generation || !user.value) return
  try {
    const result = await call<Job>('GET', `/jobs/${id}`)
    if (epoch !== generation) return
    job.value = result
    if (['QUEUED', 'RUNNING'].includes(result.status) && Date.now() < pollDeadline)
      timer = setTimeout(() => void poll(id, epoch), 2500)
    else if (['QUEUED', 'RUNNING'].includes(result.status))
      notice.value = 'Batas pemantauan tercapai. Buka monitor job untuk melanjutkan.'
    else if (dirty.value)
      notice.value = 'Job selesai. Simpan atau buang perubahan sebelum memuat hasil terbaru.'
    else await load()
  } catch (e) {
    error.value = getApiErrorMessage(e)
  }
}
async function queue(path: string) {
  const result = await call<{ job_id: string }>('POST', path)
  clearTimeout(timer)
  pollDeadline = Date.now() + 120_000
  await poll(result.job_id, generation)
}
async function syncReview() {
  if (!record.value) return
  const result = await call<{ reviews: unknown[] }>(
    'POST',
    `/sources/${record.value.source_id}/sync-review`,
  )
  notice.value = `Batch review dibuat untuk ${result.reviews.length} tab. Lanjutkan dari halaman batch import.`
  await router.push('/import-reviews')
}
async function download() {
  if (dirty.value) throw new Error('Simpan draft sebelum mengunduh Excel.')
  const a = await call<{ id: string; file_name: string }>('POST', `${base.value}/export`, {
    format: 'XLSX',
  })
  await downloadFile(`${base.value}/artifacts/${a.id}/download`, a.file_name)
}
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file) return
  await run(async () => {
    preview.value = null
    if (dirty.value) throw new Error('Simpan atau muat ulang draft sebelum mengimpor Excel.')
    if (file.size > (details.value?.capabilities.max_workbook_bytes || 2_000_000))
      throw new Error('File maksimal 2 MB.')
    const encoded = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('File tidak dapat dibaca.'))
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
      reader.readAsDataURL(file)
    })
    preview.value = await call<Preview>('POST', `${base.value}/workbook-preview`, {
      content_base64: encoded,
    })
  })
}
async function applyWorkbook() {
  if (
    !preview.value?.can_apply ||
    !preview.value.configuration ||
    !preview.value.preview_token ||
    dirty.value
  )
    throw new Error('Lakukan preview ulang sebelum menerapkan perubahan.')
  const p = preview.value
  preview.value = null
  await call('POST', `${base.value}/workbook-apply`, {
    revision_no: p.revision_no,
    configuration: p.configuration,
    question_answers: p.question_answers,
    preview_token: p.preview_token,
  })
  await load()
  notice.value =
    'Perubahan Excel disimpan sebagai draft. Verifikasi dan ajukan review untuk persetujuan.'
}
function addColumn() {
  if (!selectedHeader.value || !draft.value) return
  const name = selectedHeader.value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  draft.value.columns.push({
    source_column: selectedHeader.value,
    target_column: /^[a-z]/.test(name) ? name.slice(0, 63) : `col_${name}`.slice(0, 63),
    target_type: 'text',
    business_name: selectedHeader.value,
    nullable: true,
    is_primary_key: false,
    is_business_key: false,
    transformation_codes: [],
    transform_parameters: [],
    pii_classification: 'NONE',
    confidence: 1,
    reason: 'Ditambahkan pengguna; periksa tipe dan sensitivitas data.',
    numeric_precision: null,
    numeric_scale: null,
    varchar_length: null,
    date_format: null,
    date_input_format: null,
    number_locale: null,
    source_timezone: null,
    unit_conversion: null,
    currency_conversion: null,
  })
  selectedHeader.value = ''
}
function addQuality() {
  draft.value?.data_quality_rules.push({
    column: draft.value.columns[0]?.target_column || '',
    rule: 'not_null',
    value: null,
    action_on_fail: 'REJECT_ROW',
    severity: 'ERROR',
    owner: null,
    threshold_percent: null,
    max_age_days: null,
    default_value: null,
  })
}
function qualityValue(q: Quality, event: Event) {
  const value = (event.target as HTMLInputElement).value
  q.value =
    q.rule === 'allowed_values'
      ? value.split('\n').filter(Boolean)
      : value === ''
        ? null
        : Number(value)
}
function defaultValueInput(q: Quality, event: Event) {
  const text = (event.target as HTMLInputElement).value
  defaultInputs.value.set(q, text)
  const result = parseDefaultScalar(text)
  if (result.valid) q.default_value = result.value
}
function defaultValueText(q: Quality) {
  return defaultInputs.value.get(q) ?? formatDefaultScalar(q.default_value)
}
function metricSynonymsInput(metric: Metric, event: Event) {
  metric.synonyms = (event.target as HTMLTextAreaElement).value
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
}
function metricPeriodDimension(metric: Metric, event: Event) {
  const dimension = (event.target as HTMLSelectElement).value
  metric.default_period = dimension ? { dimension, days: metric.default_period?.days || 30 } : null
}
function metricFilterText(value: MetricFilter['value']) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}
function metricFilterValue(filter: MetricFilter, event: Event) {
  const text = (event.target as HTMLInputElement).value
  try {
    const parsed: unknown = JSON.parse(text)
    filter.value =
      typeof parsed === 'string' ||
      typeof parsed === 'number' ||
      typeof parsed === 'boolean' ||
      (Array.isArray(parsed) && parsed.every((item) => ['string', 'number'].includes(typeof item)))
        ? (parsed as MetricFilter['value'])
        : text
  } catch {
    filter.value = text
  }
}
function addMetricFilter(metric: Metric) {
  metric.filters ||= []
  metric.filters.push({
    field: publicColumns.value[0]?.target_column || '',
    operator: 'eq',
    value: '',
  })
}
function setConversion(c: Column, kind: 'none' | 'unit' | 'currency') {
  c.unit_conversion =
    kind === 'unit'
      ? {
          from_unit: 'KG',
          to_unit: 'G',
          factor: '1000',
          output_scale: 2,
          rounding: 'HALF_UP',
          on_error: 'REJECT_ROW',
        }
      : null
  c.currency_conversion =
    kind === 'currency'
      ? {
          from_currency: 'USD',
          to_currency: 'IDR',
          rate: '1',
          rate_date: new Date().toISOString().slice(0, 10),
          rate_reference: '',
          output_scale: 2,
          rounding: 'HALF_UP',
          on_error: 'REJECT_ROW',
        }
      : null
}
function conversionKind(c: Column) {
  return c.unit_conversion ? 'unit' : c.currency_conversion ? 'currency' : 'none'
}
const parameterizedTransforms = ['prefix', 'suffix', 'replace'] as const
type ParameterizedTransform = (typeof parameterizedTransforms)[number]
function syncTransformParameters(c: Column) {
  c.transform_parameters ||= []
  c.transform_parameters = c.transform_parameters.filter((item) =>
    c.transformation_codes.includes(item.operation),
  )
  for (const operation of parameterizedTransforms) {
    if (
      c.transformation_codes.includes(operation) &&
      !c.transform_parameters.some((item) => item.operation === operation)
    )
      c.transform_parameters.push({
        operation,
        value: '',
        replacement: operation === 'replace' ? '' : null,
      })
  }
}
function activeParameterizedTransforms(c: Column) {
  return parameterizedTransforms.filter((operation) => c.transformation_codes.includes(operation))
}
function transformParameter(c: Column, operation: ParameterizedTransform): TransformParameter {
  return c.transform_parameters!.find((item) => item.operation === operation)!
}
function removeTransform(c: Column, index: number) {
  c.transformation_codes.splice(index, 1)
  syncTransformParameters(c)
}
watch(
  draft,
  () => {
    checkedColumns.value = []
    checkedSections.value = []
    preview.value = null
  },
  { deep: true },
)
watch(
  resolved,
  () => {
    checkedColumns.value = []
    checkedSections.value = []
  },
  { deep: true },
)
watch(
  [user, configId],
  () => {
    generation++
    clearTimeout(timer)
    details.value = null
    fieldIssues.value = []
    defaultInputs.value.clear()
    draft.value = null
    preview.value = null
    job.value = null
    rollbackAcknowledged.value = false
    if (user.value && [...editRoles, ...reviewRoles].includes(user.value.role)) void run(load)
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  generation++
  clearTimeout(timer)
  window.removeEventListener('beforeunload', beforeUnload)
})
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
window.addEventListener('beforeunload', beforeUnload)
function confirmLeave() {
  return !dirty.value || window.confirm('Perubahan draft belum disimpan. Tinggalkan halaman ini?')
}
onBeforeRouteLeave(confirmLeave)
onBeforeRouteUpdate(confirmLeave)
</script>

<template>
  <EtlShell>
    <RouterLink to="/workspace">← Daftar sumber</RouterLink>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <ul v-if="fieldIssues.length" class="error" aria-label="Kesalahan parameter konfigurasi">
      <li v-for="issue in fieldIssues" :key="issue.field + issue.message">
        {{ issue.field }}: {{ issue.message }}
      </li>
    </ul>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <details v-if="parameterCatalog" class="panel">
      <summary>Parameter runtime dan capability (BE12)</summary>
      <p class="muted">
        Parameter bertanda supported=false hanya didokumentasikan dan tidak dikirim oleh editor.
      </p>
      <pre>{{ JSON.stringify(parameterCatalog, null, 2) }}</pre>
    </details>
    <p v-if="busy" aria-live="polite"><Spinner label="Memproses…" /></p>
    <template v-if="busy && !details">
      <CardSkeleton :rows="2" />
      <CardSkeleton :rows="4" />
      <CardSkeleton :rows="3" />
    </template>
    <template v-if="details && draft && record">
      <p class="eyebrow">{{ details.source.name }} / {{ details.sheet.sheet_name }}</p>
      <h1>Verifikasi konfigurasi ETL</h1>
      <div class="toolbar">
        <span class="tag">{{ record.status }}</span
        ><span>Versi {{ record.version_no }} · revisi {{ record.revision_no }}</span
        ><span class="muted">Kelengkapan draft {{ Math.round(draft.overall_confidence * 100) }}%</span
        ><span v-if="dirty" class="tag">Perubahan belum disimpan</span>
      </div>
      <p v-if="isMasterTab" class="notice">
        Tab ini diklasifikasikan sebagai MASTER. Ajukan review definisi master melalui Registry master,
        bukan review konfigurasi ETL. Untuk pemuatan record, atur dan minta persetujuan binding di
        <RouterLink :to="masterBindingPath">halaman binding master</RouterLink>, lalu lanjutkan dari
        Storage &amp; record master.
      </p>
      <p v-else class="notice">
        Periksa mapping dan aturan kualitas, jawab pertanyaan yang tersisa, lalu jalankan dry-run. Persetujuan mengacu pada
        revisi dan snapshot yang diperiksa.
      </p>
      <div v-if="!isMasterTab && !ready" class="notice" role="status">
        <strong>Review belum dapat diajukan:</strong>
        <ul>
          <li v-for="blocker in submitBlockers" :key="blocker">{{ blocker }}</li>
        </ul>
      </div>
      <details>
        <summary>Parameter template yang belum didukung</summary>
        <p v-for="item in details.capabilities.unsupported" :key="item">• {{ item }}</p>
        <p>
          Sel referensi dan parameter tersebut dilindungi pada Excel. Klasifikasi master dan
          pembuatan relasi otomatis belum dijalankan oleh alur ini.
        </p>
      </details>
      <SheetClassification
        :key="record.source_sheet_id"
        :sheet-id="record.source_sheet_id"
        :source-id="record.source_id"
        :active="!!details.sheet.active_configuration_id"
        :disabled="busy || dirty"
        @changed="run(load)"
      />
      <p
        v-if="!evidenceReady && ['NEEDS_REVIEW', 'APPROVED', 'SUPERSEDED'].includes(record.status)"
        class="notice"
      >
        Bukti klasifikasi tidak sesuai revisi terbaru. Untuk draft, periksa ulang lalu ajukan
        review. Untuk versi approved/superseded, clone ke draft sebelum review ulang. Jika header
        lama sudah hilang dan clone gagal, buat draft baru dari profil terbaru di Workspace.
      </p>
      <p class="notice etl-progress-message" role="status" aria-live="polite">{{ progressMessage }}</p>
      <nav class="steps" aria-label="Tahapan review">
        <div v-for="(progress, i) in stepProgress.slice(0, 6)" :key="progress.label" class="step-control">
          <button
            class="step-tab"
            :class="[{ active: step === i }, `step-${progress.state.toLowerCase()}`]"
            :aria-current="step === i ? 'step' : undefined"
            :aria-label="`Langkah ${i + 1}, ${progress.label}: ${progress.status}`"
            :title="progress.status"
            @click="step = i"
          >
            {{ i + 1 }}. {{ progress.label }}
            <span class="step-status" aria-hidden="true">
              {{ progress.state === 'CHECKED' || progress.state === 'DONE' ? '✓' : progress.state === 'STALE' || progress.state === 'FAILED' ? '!' : progress.state === 'READY' || progress.state === 'SUBMITTED' ? '●' : '○' }}
            </span>
          </button>
          <button class="step-help" type="button" :aria-label="`Petunjuk langkah ${i + 1}: ${progress.label}`" :title="`Petunjuk ${progress.label}`" @click="helpStep = i">
            <CircleHelp :size="16" aria-hidden="true" />
          </button>
        </div>
        <div class="step-control">
          <button
            class="step-tab"
            :class="[{ active: step === 6 }, `step-${finalStepProgress.state.toLowerCase()}`]"
            :aria-current="step === 6 ? 'step' : undefined"
            :aria-label="`Langkah 7, ${finalStepLabel}: ${finalStepProgress.status}`"
            :title="finalStepProgress.status"
            @click="step = 6"
          >
            7. {{ finalStepLabel }}
            <span class="step-status" aria-hidden="true">
              {{ finalStepProgress.state === 'DONE' ? '✓' : finalStepProgress.state === 'FAILED' || finalStepProgress.state === 'STALE' ? '!' : finalStepProgress.state === 'READY' || finalStepProgress.state === 'SUBMITTED' ? '●' : '○' }}
            </span>
          </button>
          <button class="step-help" type="button" :aria-label="`Petunjuk langkah 7: ${finalStepLabel}`" :title="`Petunjuk ${finalStepLabel}`" @click="helpStep = 6">
            <CircleHelp :size="16" aria-hidden="true" />
          </button>
        </div>
      </nav>
      <fieldset :disabled="!canEdit || busy" class="panel" v-show="step < 6">
        <template v-if="step === 0"
          ><h2>Identitas dataset</h2>
          <div class="grid">
            <label
              >Nama bisnis<input
                v-model="draft.dataset_business_name"
                maxlength="200"
                required /></label
            ><label>Kode produk data<input v-model="draft.semantic.code" required @blur="normalizeIdentityCode" pattern="[A-Za-z][A-Za-z0-9_]*" /></label>
          </div>
          <p class="muted">Nama bisnis menerima tanda baca dan maksimal 200 karakter. Kode produk data hanya huruf ASCII, angka dan underscore, diawali huruf, maksimal 63 karakter. Kode tidak valid dirapikan otomatis saat selesai mengisi atau menyimpan; kode valid tetap dipertahankan.</p>
          <p v-if="codeNormalizationNotice" role="status" class="notice">{{ codeNormalizationNotice }}</p>
          <p v-if="suggestedIdentity" class="muted">Saran dari {{ details?.profile?.spreadsheet_title ? 'nama file Google Sheet pada profiling' : 'nama sumber terdaftar (profil lama; profiling ulang untuk nama file asli)' }} + tab: {{ suggestedIdentity.businessName }} · {{ suggestedIdentity.code }}</p>
          <button type="button" @click="useSourceIdentity">Gunakan nama file dan tab</button>
          <label
            >Deskripsi<textarea
              v-model="draft.dataset_description"
              rows="3"
              maxlength="2000"
            /></label
          ><label
            >Makna satu baris / grain<textarea
              v-model="draft.grain"
              rows="2"
              maxlength="500"
              placeholder="Contoh: satu baris per transaksi per produk"
            />
          </label>
        </template>
        <template v-if="step === 1"
          ><h2>Pemetaan kolom &amp; sensitivitas</h2>
          <p class="muted">
            Primary/business key wajib tidak nullable. Data MEDIUM/HIGH disembunyikan dari produk
            analitik. Perubahan nama kolom perlu disesuaikan pada aturan kualitas dan metrik.
          </p>
          <div v-for="(c, i) in draft.columns" :key="i" class="card-row">
            <h3>
              {{ c.source_column }} <span class="tag">{{ Math.round(c.confidence * 100) }}%</span>
            </h3>
            <p class="muted">{{ c.reason }}</p>
            <div class="grid">
              <label>Nama bisnis<input v-model="c.business_name" /></label
              ><label>Kolom database<input v-model="c.target_column" maxlength="63" /></label
              ><label
                >Tipe<select v-model="c.target_type">
                  <option v-for="t in types" :key="t">{{ t }}</option>
                </select></label
              ><label
                >Sensitivitas<select v-model="c.pii_classification">
                  <option v-for="p in ['NONE', 'LOW', 'MEDIUM', 'HIGH']" :key="p">{{ p }}</option>
                </select></label
              >
            </div>
            <div class="toolbar">
              <label class="check"><input type="checkbox" v-model="c.nullable" />Boleh kosong</label
              ><label class="check"
                ><input type="checkbox" v-model="c.is_business_key" />Business key</label
              ><label class="check"
                ><input type="checkbox" v-model="c.is_primary_key" />Primary key</label
              ><button
                class="danger"
                :disabled="draft.columns.length === 1"
                @click="draft.columns.splice(i, 1)"
              >
                Hapus mapping
              </button>
            </div>
            <label>Catatan / alasan<textarea v-model="c.reason" rows="2" /></label>
            <TaxonomyMapping
              :column="c"
              :sheet-id="record!.source_sheet_id"
              :source-id="record!.source_id"
              @change="Object.assign(c, $event)"
            />
            <details>
              <summary>Parameter tipe &amp; presisi (BE-12)</summary>
              <div class="grid">
                <label v-if="c.target_type === 'numeric' || c.numeric_precision != null"
                  >Precision<input
                    type="number"
                    min="1"
                    max="100"
                    :value="c.numeric_precision"
                    @change="
                      c.numeric_precision =
                        ($event.target as HTMLInputElement).value === ''
                          ? null
                          : Number(($event.target as HTMLInputElement).value)
                    "
                /></label>
                <label v-if="c.target_type === 'numeric' || c.numeric_scale != null"
                  >Scale<input
                    type="number"
                    min="0"
                    max="50"
                    :value="c.numeric_scale"
                    @change="
                      c.numeric_scale =
                        ($event.target as HTMLInputElement).value === ''
                          ? null
                          : Number(($event.target as HTMLInputElement).value)
                    "
                /></label>
                <label
                  v-if="
                    c.target_type === 'text' ||
                    c.target_type === 'varchar' ||
                    c.varchar_length != null
                  "
                  >Panjang varchar<input
                    type="number"
                    min="1"
                    max="10485760"
                    :value="c.varchar_length"
                    @change="
                      c.varchar_length =
                        ($event.target as HTMLInputElement).value === ''
                          ? null
                          : Number(($event.target as HTMLInputElement).value)
                    "
                /></label>
                <label
                  v-if="
                    c.target_type === 'date' ||
                    c.date_format != null ||
                    c.transformation_codes.includes('parse_date_id')
                  "
                  >Pola tanggal (strptime)<input
                    v-model="c.date_format"
                    maxlength="40"
                    placeholder="%d/%m/%Y"
                /></label>

                <label
                  v-if="
                    c.target_type === 'numeric' ||
                    c.number_locale != null ||
                    c.transformation_codes.includes('parse_decimal_id')
                  "
                  >Locale angka<select
                    :value="c.number_locale || ''"
                    @change="c.number_locale = ($event.target as HTMLSelectElement).value || null"
                  >
                    <option value="">(tidak diatur)</option>
                    <option v-for="l in numberLocales" :key="l">{{ l }}</option>
                  </select></label
                >
                <label v-if="c.target_type === 'timestamptz' || c.source_timezone != null"
                  >Timezone sumber (IANA)<input
                    v-model="c.source_timezone"
                    maxlength="100"
                    placeholder="Asia/Jakarta"
                /></label>
              </div>
              <p class="muted">
                Kosongkan field yang tidak dipakai. Precision/scale/varchar hanya berlaku untuk tipe
                kolom yang sesuai; date_format dan number_locale memerlukan transform parse_date_id
                / parse_decimal_id pada kolom ini.
              </p>
              <template
                v-if="c.target_type === 'numeric' || c.unit_conversion || c.currency_conversion"
              >
                <h4>Konversi satuan/kurs</h4>
                <label
                  >Jenis konversi<select
                    :value="conversionKind(c)"
                    @change="
                      setConversion(
                        c,
                        ($event.target as HTMLSelectElement).value as 'none' | 'unit' | 'currency',
                      )
                    "
                  >
                    <option value="none">Tidak ada</option>
                    <option value="unit">Satuan</option>
                    <option value="currency">Mata uang</option>
                  </select></label
                >
                <div v-if="c.unit_conversion" class="grid">
                  <label
                    >Dari<select v-model="c.unit_conversion.from_unit">
                      <option v-for="u in units" :key="u">{{ u }}</option>
                    </select></label
                  ><label
                    >Ke<select v-model="c.unit_conversion.to_unit">
                      <option v-for="u in units" :key="u">{{ u }}</option>
                    </select></label
                  ><label
                    >Faktor<input v-model="c.unit_conversion.factor" placeholder="1000" /></label
                  ><label
                    >Skala output<input
                      type="number"
                      min="0"
                      max="50"
                      v-model.number="c.unit_conversion.output_scale"
                  /></label>
                  <label
                    >Pembulatan<select v-model="c.unit_conversion.rounding">
                      <option v-for="r in roundings" :key="r">{{ r }}</option>
                    </select></label
                  >
                </div>
                <div v-if="c.currency_conversion" class="grid">
                  <label
                    >Dari<select v-model="c.currency_conversion.from_currency">
                      <option v-for="cur in currencies" :key="cur">{{ cur }}</option>
                    </select></label
                  ><label
                    >Ke<select v-model="c.currency_conversion.to_currency">
                      <option v-for="cur in currencies" :key="cur">{{ cur }}</option>
                    </select></label
                  ><label>Kurs (string desimal)<input v-model="c.currency_conversion.rate" /></label
                  ><label
                    >Tanggal kurs<input type="date" v-model="c.currency_conversion.rate_date"
                  /></label>
                  <label
                    >Referensi kurs<input
                      v-model="c.currency_conversion.rate_reference"
                      maxlength="500"
                  /></label>
                  <label
                    >Skala output<input
                      type="number"
                      min="0"
                      max="50"
                      v-model.number="c.currency_conversion.output_scale"
                  /></label>
                  <label
                    >Pembulatan<select v-model="c.currency_conversion.rounding">
                      <option v-for="r in roundings" :key="r">{{ r }}</option>
                    </select></label
                  >
                </div>
                <p v-if="c.unit_conversion || c.currency_conversion" class="muted">
                  Kirim faktor/kurs sebagai string agar presisi desimal tidak hilang. on_error
                  selalu REJECT_ROW.
                </p>
              </template>
            </details>
          </div>
          <div v-if="unusedHeaders.length" class="toolbar">
            <select v-model="selectedHeader" aria-label="Header untuk ditambahkan">
              <option value="">Pilih header tambahan</option>
              <option v-for="h in unusedHeaders" :key="h.source_column">
                {{ h.source_column }}
              </option></select
            ><button :disabled="!selectedHeader || draft.columns.length >= 100" @click="addColumn">
              Tambah mapping
            </button>
          </div>
        </template>
        <template v-if="step === 2"
          ><h2>Urutan cleansing</h2>
          <p class="muted">
            Text/varchar mendapat trim otomatis sebelum transformasi dan validasi: spasi tepi dibuang, spasi tengah dan nol depan tetap. Nilai berisi spasi saja menjadi NULL jika boleh kosong; kolom wajib tetap error. Transformasi tambahan berjalan dari atas ke bawah. Tidak ada koreksi ejaan
            otomatis tanpa aturan yang disetujui.
          </p>
          <div v-for="(c, index) in draft.columns" :key="index" class="card-row">
            <h3>{{ c.source_column }} → {{ c.target_column }}</h3>
                <label v-if="c.target_type === 'date' || c.date_input_format != null"
                  >Format nilai tanggal<select v-model="c.date_input_format">
                    <option :value="null">Belum dinyatakan (konfigurasi lama)</option>
                    <option value="TEXT">Tanggal teks, mengikuti pola tanggal</option>
                    <option value="GOOGLE_SHEETS_SERIAL">Angka serial tanggal Google Sheets</option>
                  </select>
                  <span class="muted">Gunakan parse_date_id sesuai format yang dipilih. Untuk konversi bigint lama ke date, pilih angka serial secara eksplisit setelah memeriksa arti dan contoh nilainya. Angka ID atau tahun bukan tanggal serial.</span>
                </label>
            <div v-for="(_, i) in c.transformation_codes" :key="i" class="toolbar">
              <span>{{ i + 1 }}.</span
              ><select
                v-model="c.transformation_codes[i]"
                :aria-label="`Transformasi ${c.source_column} urutan ${i + 1}`"
                @change="syncTransformParameters(c)"
              >
                <option v-for="t in transforms" :key="t">{{ t }}</option></select
              ><button
                :disabled="i === 0"
                @click="
                  c.transformation_codes.splice(i - 1, 0, c.transformation_codes.splice(i, 1)[0]!)
                "
              >
                Naik</button
              ><button
                :disabled="i === c.transformation_codes.length - 1"
                @click="
                  c.transformation_codes.splice(i + 1, 0, c.transformation_codes.splice(i, 1)[0]!)
                "
              >
                Turun</button
              ><button @click="removeTransform(c, i)">Hapus</button>
            </div>
            <button
              :disabled="c.transformation_codes.length >= 10"
              @click="c.transformation_codes.push('trim')"
            >
              Tambah langkah
            </button>
            <div
              v-for="operation in activeParameterizedTransforms(c)"
              :key="operation"
              class="card-row"
            >
              <h4>Parameter {{ operation }}</h4>
              <p class="muted">
                Nilai statis ini dijalankan mengikuti urutan transformasi di atas.
              </p>
              <label v-if="operation === 'replace'"
                >Teks yang dicari<input
                  v-model="transformParameter(c, operation).value"
                  :aria-label="`Nilai ${operation} ${c.source_column}`"
                  maxlength="500"
              /></label>
              <label v-else
                >Nilai {{ operation
                }}<input
                  v-model="transformParameter(c, operation).value"
                  :aria-label="`Nilai ${operation} ${c.source_column}`"
                  maxlength="500"
              /></label>
              <label v-if="operation === 'replace'"
                >Teks pengganti<input
                  v-model="transformParameter(c, operation).replacement"
                  :aria-label="`Replacement ${c.source_column}`"
                  maxlength="500"
              /></label>
            </div>
          </div>
        </template>
        <template v-if="step === 3"
          ><h2>Aturan kualitas data</h2>
          <p v-if="!draft.data_quality_rules.length">
            Belum ada aturan tambahan. Pemeriksaan tipe, nullability, dan key tetap dijalankan.
          </p>
          <p class="muted">
            Rule in_taxonomy mengikuti mapping dan binding approved. Value harus null; action WARN
            tidak tersedia. REQUIRE_REVIEW membuat pertanyaan pada worker import.
          </p>
          <div v-for="(q, i) in draft.data_quality_rules" :key="i" class="card-row">
            <div class="grid">
              <label
                >Kolom<select v-model="q.column">
                  <option v-for="c in draft.columns" :key="c.target_column">
                    {{ c.target_column }}
                  </option>
                </select></label
              >
              <label
                >Aturan<select
                  v-model="q.rule"
                  @change="
                    q.value = q.rule === 'allowed_values' ? [] : q.rule === 'format' ? 'UUID' : null
                  "
                >
                  <option v-for="r in qualityRules" :key="r">
                    {{ r }}
                  </option>
                </select></label
              >
              <label v-if="q.rule === 'min' || q.rule === 'max'"
                >Batas angka<input
                  type="number"
                  step="any"
                  :value="q.value"
                  @input="qualityValue(q, $event)"
              /></label>
              <label v-if="q.rule === 'allowed_values'"
                >Nilai yang diizinkan (satu per baris)<textarea
                  :value="Array.isArray(q.value) ? q.value.join('\n') : ''"
                  @input="qualityValue(q, $event)"
                />
              </label>
              <label v-if="q.rule === 'format'"
                >Format<select v-model="q.value">
                  <option v-for="f in dqFormats" :key="f">{{ f }}</option>
                </select></label
              >
              <label v-if="q.rule === 'max_age_days'"
                >Umur maksimum (hari)<input
                  type="number"
                  min="0"
                  max="36500"
                  v-model.number="q.max_age_days"
              /></label>
              <label
                >Jika gagal<select v-model="q.action_on_fail">
                  <option
                    v-for="a in ['REJECT_ROW', 'WARN', 'STOP_BATCH', 'REQUIRE_REVIEW']"
                    :key="a"
                    :disabled="q.rule === 'in_taxonomy' && a === 'WARN'"
                  >
                    {{ a }}
                  </option>
                </select></label
              >
              <label
                >Severity<select v-model="q.severity">
                  <option v-for="s in dqSeverities" :key="s">{{ s }}</option>
                </select></label
              >
              <label
                >Owner<input v-model="q.owner" maxlength="100" placeholder="(opsional)"
              /></label>
              <label
                >Threshold gagal (%)<input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  :value="q.threshold_percent"
                  @change="
                    q.threshold_percent =
                      ($event.target as HTMLInputElement).value === ''
                        ? null
                        : Number(($event.target as HTMLInputElement).value)
                  "
              /></label>
              <label
                >Default value (JSON scalar)<input
                  aria-label="Default value (JSON scalar)"
                  :value="defaultValueText(q)"
                  :aria-invalid="!!defaultValueError(q)"
                  :aria-describedby="`default-help-${i}`"
                  @input="defaultValueInput(q, $event)"
                  placeholder='0, false, "teks", null'
                /><span :id="`default-help-${i}`" :class="defaultValueError(q) ? 'error' : 'muted'">
                  {{
                    defaultValueError(q) ||
                    'Kosong atau null menonaktifkan default. Gunakan tanda kutip untuk teks, termasuk "0", "false", dan string kosong "".'
                  }}
                </span></label
              >
            </div>
            <button class="danger" @click="draft.data_quality_rules.splice(i, 1)">
              Hapus aturan
            </button>
          </div>
          <button :disabled="draft.data_quality_rules.length >= 100" @click="addQuality">
            Tambah aturan
          </button>
        </template>
        <template v-if="step === 4"
          ><h2>Target &amp; strategi pemuatan</h2>
          <div class="grid">
            <label>Schema<input :value="draft.target_schema" disabled /></label
            ><label
              >Nama dasar tabel<input
                v-model="draft.target_table"
                maxlength="30"
                pattern="[a-z][a-z0-9_]*" /></label
            ><label
              >Strategi<select v-model="draft.load_strategy">
                <option>UPSERT</option>
                <option>APPEND</option>
                <option>FULL_REFRESH</option>
              </select></label
            ><label v-if="appendPolicyAvailable"
              >Duplikat identik saat APPEND<select v-model="draft.append_duplicate_policy">
                <option :value="null">SKIP_IDENTICAL (default)</option>
                <option v-if="draft.append_duplicate_policy === undefined" :value="undefined">
                  SKIP_IDENTICAL (belum diatur)
                </option>
                <option value="SKIP_IDENTICAL">SKIP_IDENTICAL</option>
                <option value="REJECT_IDENTICAL">REJECT_IDENTICAL</option>
              </select></label
            >
          </div>
          <p v-if="draft.load_strategy === 'UPSERT'" class="notice">
            Baris dengan key yang sama diperbarui; key baru ditambahkan. Pastikan business key
            stabil dan unik.
          </p>
          <p v-else-if="draft.load_strategy === 'APPEND'" class="notice">
            Baris ditambahkan pada pemuatan berikutnya. Pastikan strategi sesuai dengan sumber
            snapshot agar data tidak berulang.
          </p>
          <p v-if="appendPolicyAvailable" class="notice">
            Tanpa key, identitas baris memakai hash seluruh nilai bisnis setelah transform/cast.
            SKIP melewati baris identik; REJECT menghentikan batch dan membatalkan seluruh
            penulisan. Kejadian bisnis dengan nilai identik memerlukan ID event berbeda jika
            keduanya harus disimpan. KEEP_ALL belum tersedia; jangan membuat ID acak saat retry.
          </p>
          <p v-if="appendPolicyAvailable" class="notice">
            Dry-run hanya memeriksa duplikat dalam snapshot setelah DQ, tanpa membaca target.
            Warning APPEND_IDENTICAL_SKIPPED tetap menghitung baris staging sebagai valid. Gunakan
            preview batch untuk memeriksa target: INSERT untuk hash baru, UNCHANGED untuk duplikat
            SKIP, dan DUPLICATE yang menahan approval pada REJECT. Nilai before kosong karena
            pemeriksaan memakai hash. SKIP dapat menulis lebih sedikit baris daripada preview jika
            target berubah; hitungan aktual tersedia pada hasil apply.
          </p>
          <p
            v-else-if="draft.load_strategy === 'APPEND' && draft.append_duplicate_policy"
            class="notice"
          >
            Policy duplikat hanya berlaku untuk APPEND tanpa business key atau primary key dan akan
            dihapus saat disimpan.
          </p>
          <p v-if="draft.load_strategy === 'FULL_REFRESH'" class="notice">
            Isi target diganti saat pemuatan berhasil. Pastikan spreadsheet berisi seluruh data yang
            ingin dipertahankan.
          </p>
        </template>
        <template v-if="step === 5"
          ><h2>Dimensi, metrik &amp; akses</h2>
          <h3>Dimensi</h3>
          <div class="toolbar">
            <label v-for="c in publicColumns" :key="c.target_column" class="check"
              ><input
                type="checkbox"
                v-model="draft.semantic.dimensions"
                :value="c.target_column"
              />{{ c.target_column }}</label
            >
          </div>
          <h3>Metrik</h3>
          <div v-for="(m, i) in draft.semantic.metrics" :key="i" class="card-row">
            <div class="grid">
              <label>Kode metrik<input v-model="m.code" /></label
              ><label>Label<input v-model="m.label" maxlength="200" /></label
              ><label
                >Kolom<select v-model="m.column">
                  <option v-for="c in publicColumns" :key="c.target_column">
                    {{ c.target_column }}
                  </option>
                </select></label
              ><label
                >Agregasi<select v-model="m.aggregation">
                  <option
                    v-for="a in ['sum', 'count', 'avg', 'min', 'max', 'count_distinct']"
                    :key="a"
                  >
                    {{ a }}
                  </option>
                </select></label
              >
            </div>
            <label
              >Definisi bisnis<textarea
                v-model="m.description"
                rows="2"
                maxlength="1000"
                placeholder="Contoh: total nilai transaksi setelah diskon"
              />
            </label>
            <div class="grid">
              <label
                >Unit<input v-model="m.unit" maxlength="40" placeholder="IDR, KG, persen" /></label
              ><label
                >Sinonim, satu per baris<textarea
                  :value="(m.synonyms || []).join('\n')"
                  rows="3"
                  placeholder="Pendapatan bersih&#10;Net revenue"
                  @input="metricSynonymsInput(m, $event)"
                />
              </label>
            </div>
            <div class="grid">
              <label
                >Dimensi periode default<select
                  :value="m.default_period?.dimension || ''"
                  @change="metricPeriodDimension(m, $event)"
                >
                  <option value="">Tanpa periode default</option>
                  <option v-for="column in temporalDimensions" :key="column.target_column">
                    {{ column.target_column }}
                  </option>
                </select></label
              ><label v-if="m.default_period"
                >Jumlah hari default<input
                  v-model.number="m.default_period.days"
                  type="number"
                  min="1"
                  max="3660"
              /></label>
            </div>
            <p v-if="m.default_period" class="muted">
              Dihitung menurut tanggal UTC dan hanya diterapkan saat dimensi ini belum memiliki
              filter eksplisit.
            </p>
            <h4>Filter tetap metrik</h4>
            <div v-for="(filter, filterIndex) in m.filters || []" :key="filterIndex" class="grid">
              <label
                >Kolom filter<select v-model="filter.field">
                  <option v-for="column in publicColumns" :key="column.target_column">
                    {{ column.target_column }}
                  </option>
                </select></label
              ><label
                >Operator filter<select v-model="filter.operator">
                  <option
                    v-for="operator in ['eq', 'in', 'between', 'gte', 'lte', 'gt', 'lt']"
                    :key="operator"
                  >
                    {{ operator }}
                  </option>
                </select></label
              ><label
                >Nilai filter<input
                  :value="metricFilterText(filter.value)"
                  placeholder='Jakarta atau ["A","B"]'
                  @input="metricFilterValue(filter, $event)"
              /></label>
              <button class="danger" @click="m.filters?.splice(filterIndex, 1)">
                Hapus filter
              </button>
            </div>
            <button
              :disabled="(m.filters?.length || 0) >= 10 || !publicColumns.length"
              @click="addMetricFilter(m)"
            >
              Tambah filter metrik
            </button>
            <label
              >Hasil agregat null
              <select
                :value="m.null_handling || 'PRESERVE'"
                @change="
                  m.null_handling = ($event.target as HTMLSelectElement).value as
                    'PRESERVE' | 'ZERO_RESULT'
                "
              >
                <option value="PRESERVE">Pertahankan null</option>
                <option value="ZERO_RESULT">Tampilkan 0 untuk hasil numerik</option>
              </select>
            </label>
            <p class="muted">
              ZERO_RESULT mengganti hasil agregat null dengan 0. Baris null tetap diabaikan saat
              AVG; tidak membuat kelompok data yang hilang. Perubahan berlaku setelah review dan
              deployment konfigurasi.
            </p>
            <button class="danger" @click="draft.semantic.metrics.splice(i, 1)">
              Hapus metrik
            </button>
          </div>
          <button
            @click="
              draft.semantic.metrics.push({
                code: '',
                label: '',
                description: '',
                synonyms: [],
                unit: null,
                default_period: null,
                filters: [],
                column: publicColumns[0]?.target_column || '',
                aggregation: 'count',
                null_handling: 'PRESERVE',
              })
            "
          >
            Tambah metrik
          </button>
          <h3>Akun yang dapat mengakses produk analitik</h3>
          <div class="toolbar">
            <label v-for="r in roles" :key="r" class="check"
              ><input type="checkbox" v-model="draft.semantic.allowed_roles" :value="r" />{{
                r
              }}</label
            >
          </div>
        </template>
      </fieldset>
      <section v-if="step === 6" class="panel">
        <section v-if="isMasterTab" class="notice" aria-label="Langkah persetujuan master">
          <h2>Persetujuan tab MASTER</h2>
          <p>Review konfigurasi ETL ini tidak dapat digunakan untuk menyetujui atau memuat tab MASTER.
            Periksa dan ajukan definisi di Registry master, lalu gunakan akun approver berbeda untuk
            menyetujui definisi dan menyiapkan storage. Setelah itu, simpan mapping dan dry-run binding,
            minta persetujuan binding, lalu lanjutkan preview, approval dan apply Batch import master.</p>
          <div class="toolbar">
            <RouterLink to="/masters">Buka Registry master</RouterLink>
            <RouterLink :to="masterBindingPath">Buka binding master tab ini</RouterLink>
            <RouterLink to="/guide#binding-master">Panduan binding master</RouterLink>
          </div>
        </section>
        <section v-else-if="schemaMigration" aria-label="Preview perubahan schema">
          <h2>Preview perubahan schema database</h2>
          <p>{{ schemaMigration.rows_existing }} record lama · {{ schemaMigration.allowed ? 'Rencana dapat dijalankan setelah review.' : 'Rencana ditahan; selesaikan blocker.' }}</p>
          <p class="muted">Worker memeriksa ulang rencana yang disetujui, mengubah tabel/view dalam transaksi, menjaga grant dan menghitung ulang hash record bila bentuk data berubah. Tidak menghapus kolom atau memakai DROP CASCADE.</p>
          <section v-if="schemaMigration.comparison" aria-label="Perbandingan schema lama dan baru">
            <h3>Schema lama dan baru</h3>
            <div class="scroll"><table>
              <thead><tr><th>Kolom</th><th>Tipe lama</th><th>Tipe baru</th><th>Kosong sebelumnya</th><th>Kosong setelah perubahan</th><th>Perubahan</th></tr></thead>
              <tbody><tr v-for="column in schemaMigration.comparison.columns" :key="column.column">
                <td>{{ column.column }}</td><td>{{ column.before?.type || 'Belum ada' }}</td><td>{{ column.after?.type || 'Dihapus' }}</td>
                <td>{{ column.before == null ? '—' : column.before.nullable ? 'Boleh' : 'Tidak boleh' }}</td>
                <td>{{ column.after == null ? '—' : column.after.nullable ? 'Boleh' : 'Tidak boleh' }}</td>
                <td>{{ column.changes.map(schemaChangeLabel).join(', ') || 'Tetap' }}</td>
              </tr></tbody>
            </table></div>
            <p><strong>Key lama:</strong> {{ schemaKeysLabel(schemaMigration.comparison.keys.before) }}. <strong>Key baru:</strong> {{ schemaKeysLabel(schemaMigration.comparison.keys.after) }}.</p>
            <h3>Dampak view analitik</h3>
            <p>Target lama: {{ schemaMigration.comparison.view.before_target.join(', ') || 'Belum ada' }}. Target baru: {{ schemaMigration.comparison.view.after_target }}.</p>
            <p>Kolom lama: {{ schemaMigration.comparison.view.before_columns.filter(c => !c.name.startsWith('_')).map(c => `${c.name} (${c.type})`).join(', ') || 'Belum ada' }}.</p>
            <p>Kolom baru: {{ schemaMigration.comparison.view.after_columns.filter(c => !c.name.startsWith('_')).map(c => `${c.name} (${c.type})`).join(', ') }}.</p>
            <p>{{ schemaMigration.comparison.view.recreate ? 'View perlu dibuat ulang; izin akses dipertahankan.' : 'View diperiksa dan disesuaikan dalam transaksi yang sama.' }}</p>
            <p>Dependency: {{ schemaMigration.comparison.view.dependencies.join(', ') || 'Tidak ada view turunan' }}.</p>
          </section>
          <ul>
            <li v-for="(op, i) in schemaMigration.operations" :key="i">
              {{ op.action }} · {{ op.column }}
              <template v-if="op.from"> · {{ op.from }} → {{ op.type }}</template>
              <template v-else-if="op.type"> · {{ op.type }}</template>
              <template v-if="op.nullable !== undefined"> · {{ op.nullable ? 'boleh kosong' : 'wajib' }}</template>
              <strong v-if="op.conversion"> · Angka serial Google Sheets → tanggal (asal 1899-12-30). Pastikan arti kolom memang tanggal serial.</strong>
              <span v-if="op.validation"> · {{ op.validation.checked }} nilai diperiksa, {{ op.validation.convertible }} dapat dikonversi, {{ op.validation.invalid }} tidak valid. {{ op.validation.declared ? 'Format serial dinyatakan eksplisit.' : 'Format serial belum dinyatakan; perubahan diblokir.' }}</span>
              <span v-for="example in op.examples || []" :key="example.before"> · {{ example.before }} → {{ example.after }}</span>
            </li>
          </ul>
          <p v-for="(blocker, i) in schemaMigration.blockers" :key="i" class="error" role="alert">{{ blocker }}</p>
          <label v-if="canEdit && schemaMigration.operations.some(op => op.action !== 'CREATE_TABLE')" class="check">
            <input v-model="schemaReviewed" type="checkbox" :disabled="busy || dirty || !schemaMigration.allowed" />
            Saya sudah memeriksa perubahan schema dan arti konversi tanggal serial.
          </label>
          <p v-if="record?.review_state?.schema_migration" class="muted">Rencana perubahan schema tersimpan dalam bukti pengajuan review revisi ini.</p>
          <p v-if="schemaReviewStale" class="error" role="alert">Rencana schema berubah atau belum diperiksa. Periksa preview terbaru dan simpan validasi ulang sebelum deploy.</p>
          <details v-if="record?.review_state?.schema_migration">
            <summary>Bukti rencana schema yang diajukan</summary>
            <pre>{{ JSON.stringify(record.review_state.schema_migration, null, 2) }}</pre>
          </details>
        </section>
        <h2>Hasil dry-run</h2>
        <p :class="details.validation.valid ? 'success' : 'error'">
          {{
            details.validation.valid
              ? 'Snapshot lolos validasi.'
              : 'Masih ada pertanyaan atau kesalahan yang perlu diselesaikan.'
          }}
          {{ details.validation.sample_rows_valid ?? 0 }} baris valid ·
          {{ details.validation.sample_rows_invalid ?? 0 }} baris bermasalah.
        </p>
        <p v-for="(e, i) in details.validation.errors" :key="i" class="error">{{ e.message }}</p>
        <p class="muted">
          Hasil berasal dari snapshot profiling terakhir; data sensitif disamarkan. Deployment juga
          memeriksa apakah isi Google Sheet berubah sejak review.
        </p>
        <div class="scroll">
          <table v-if="details.validation.row_previews?.length">
            <thead>
              <tr>
                <th>Baris</th>
                <th>Sebelum</th>
                <th>Sesudah</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in details.validation.row_previews" :key="r.source_row">
                <td>{{ r.source_row }}</td>
                <td>
                  <div v-for="(v, k) in r.before" :key="k">
                    <b>{{ k }}:</b> {{ v ?? '∅' }}
                  </div>
                </td>
                <td>
                  <div v-for="(v, k) in r.after" :key="k">
                    <b>{{ k }}:</b> {{ v ?? '∅' }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <details
          v-if="details.validation.issues?.length || details.validation.warnings?.length"
          open
        >
          <summary>Temuan validasi</summary>
          <pre>{{
            JSON.stringify(
              { issues: details.validation.issues, warnings: details.validation.warnings },
              null,
              2,
            )
          }}</pre>
        </details>
        <details v-if="!isMasterTab">
          <summary>Rencana tabel &amp; view</summary>
          <pre>{{ JSON.stringify(details.validation.deployment_plan, null, 2) }}</pre>
        </details>
        <fieldset v-if="!isMasterTab" :disabled="!canEdit || dirty || busy">
          <h3>{{ ownerWorkflow ? 'Validasi konfigurasi' : 'Pernyataan verifikasi' }}</h3>
          <p class="muted">
            {{ ownerWorkflow
              ? 'Sistem memeriksa konfigurasi terhadap snapshot sumber, aturan kualitas, key, akses, dan rencana schema. Tidak perlu checklist persetujuan berulang.'
              : 'Centang setelah memeriksa setiap bagian dan kolom. Perubahan draft membatalkan checklist ini.' }}
          </p>
          <div v-if="!ownerWorkflow" class="grid">
            <div>
              <label v-for="(s, i) in sections" :key="s" class="check"
                ><input type="checkbox" v-model="checkedSections" :value="s" />{{
                  sectionLabels[i]
                }}
                sudah diperiksa</label
              >
            </div>
            <div>
              <label v-for="c in draft.columns" :key="c.source_column" class="check"
                ><input type="checkbox" v-model="checkedColumns" :value="c.target_column" />{{
                  c.source_column
                }}
                → {{ c.target_column }}</label
              >
            </div>
          </div>
          <button class="primary" :disabled="!ready" @click="run(submit)">
            {{ ownerWorkflow ? 'Validasi & siapkan deploy' : `Ajukan review revisi ${record.revision_no}` }}
          </button>
        </fieldset>
        <p v-if="submitted && !isMasterTab" class="success">
          {{ ownerWorkflow ? 'Validasi pemilik tersimpan. Lanjutkan ke Deploy setelah status siap.' : 'Revisi ini sudah diajukan untuk review.' }}
        </p>
        <div v-if="!isMasterTab && reviewer && record.status === 'NEEDS_REVIEW'" class="card-row">
          <h3>Keputusan approver</h3>
          <p class="muted">
            Periksa seluruh tahapan dan hasil dry-run sebelum memberikan keputusan.
          </p>
          <p v-if="record.created_by === user?.id" class="notice">
            Gunakan akun approver berbeda untuk menyetujui draft ini.
          </p>
          <div class="toolbar">
            <button
              class="primary"
              :disabled="
                busy ||
                dirty ||
                !submitted ||
                schemaReviewStale ||
                !details.validation.ready_for_review ||
                record.created_by === user?.id
              "
              @click="openDecision('approve')"
            >
              Setujui konfigurasi</button
            ><button :disabled="busy || dirty" @click="openDecision('reject')">
              Tolak konfigurasi
            </button>
          </div>
        </div>
      </section>
      <Modal
        :open="decisionModal !== null"
        :title="decisionModal === 'approve' ? 'Approval konfigurasi dan akses sumber' : 'Tolak konfigurasi'"
        @close="decisionModal = null"
      >
        <p class="muted">
          {{
            decisionModal === 'approve'
              ? 'Satu persetujuan untuk konfigurasi, metadata akses, dan aktivasi policy sumber. Seluruh syarat diperiksa dalam satu transaksi; jika ada blocker, tidak ada approval sebagian. Deploy dan pemuatan data tetap terpisah.'
              : 'Konfigurasi rejected tidak dapat diedit. Clone ke draft; jika header lama hilang dan clone gagal, buat draft baru dari profil terbaru.'
          }}
        </p>
        <template v-if="decisionModal === 'approve'">
          <button type="button" :disabled="busy" @click="run(loadAccessReview)">Muat ulang ringkasan approval</button>
          <dl v-if="accessReview">
            <template v-for="(item, field) in accessReview.attributes" :key="field"><dt>{{ field }}</dt><dd>{{ item ? `${item.code} · ${item.label}` : 'Belum diisi' }}</dd></template>
            <template v-for="(item, field) in accessReview.people" :key="field"><dt>{{ field }}</dt><dd>{{ item?.username || 'Belum diisi' }}</dd></template>
            <dt>Sensitivitas</dt><dd>{{ accessReview.sensitivity || 'Belum diisi' }}</dd>
          </dl>
          <label>Policy akses pada approval<select v-model="accessPolicyId" :disabled="busy">
            <option value="">Pilih policy APPROVED</option>
            <option v-for="policy in accessReview?.policies || []" :key="policy.id" :value="policy.id">{{ policy.code }} · {{ policy.label }}</option>
          </select></label>
          <div v-if="accessBlockers.length" class="notice" role="status">
            <strong>Belum dapat disetujui:</strong><ul><li v-for="blocker in accessBlockers" :key="blocker">{{ blocker }}</li></ul>
          </div>
          <div class="toolbar">
            <RouterLink class="button" to="/guide#approval-gabungan" target="_blank">Helper lengkap: mengapa approval belum bisa disetujui</RouterLink>
            <RouterLink v-if="details" class="button" :to="{ path: '/workspace', query: { source_id: details.source.id } }" target="_blank">Buka metadata sumber di Workspace</RouterLink>
          </div>
        </template>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <label>Catatan keputusan<textarea v-model="comment" maxlength="2000" rows="4" /></label>
        <template #footer>
          <button :disabled="busy" @click="decisionModal = null">Batal</button>
          <button
            :class="{ primary: decisionModal === 'approve' }"
            :disabled="busy || (decisionModal === 'approve' && accessBlockers.length > 0)"
            @click="run(() => decision(decisionModal as 'approve' | 'reject'))"
          >
            <Spinner v-if="busy" :size="14" /><CircleCheck
              v-else-if="decisionModal === 'approve'"
              class="icon"
              :size="14"
            /><CircleX v-else class="icon" :size="14" />
            {{ decisionModal === 'approve' ? 'Konfirmasi setuju' : 'Konfirmasi tolak' }}
          </button>
        </template>
      </Modal>
      <Modal
        :open="activeStepGuide !== null"
        :title="activeStepGuide?.title"
        @close="helpStep = null"
      >
        <p>{{ activeStepGuide?.purpose }}</p>
        <h3>Yang perlu dilakukan</h3>
        <ol class="step-help-list">
          <li v-for="instruction in activeStepGuide?.instructions" :key="instruction">{{ instruction }}</li>
        </ol>
        <p v-if="activeStepGuide?.example" class="notice"><strong>Contoh:</strong> {{ activeStepGuide.example }}</p>
        <template #footer>
          <button type="button" @click="helpStep = null">Mengerti</button>
        </template>
      </Modal>
      <Card
        v-if="
          draft.unresolved_questions.length ||
          Object.keys(record.review_state?.answers || {}).length
        "
        title="Pertanyaan & klarifikasi"
      >
        <fieldset :disabled="!canEdit || busy">
          <div v-for="q in draft.unresolved_questions" :key="q" class="question">
            <label
              >{{ q
              }}<textarea
                v-model="answers[q]"
                maxlength="2000"
                placeholder="Jelaskan keputusan bisnis Anda"
              /></label
            ><label class="check"
              ><input
                type="checkbox"
                v-model="resolved"
                :value="q"
                :disabled="!answers[q]?.trim()"
              />Selesai — perubahan konfigurasi terkait sudah saya sesuaikan</label
            >
          </div>
        </fieldset>
        <details v-if="Object.keys(record.review_state?.answers || {}).length">
          <summary>Jawaban tersimpan</summary>
          <p v-for="(a, q) in record.review_state.answers" :key="q">
            <strong>{{ q }}</strong
            ><br />{{ a.answer }}
          </p>
        </details>
      </Card>
      <details class="panel">
        <summary>Review melalui Excel (opsional)</summary>
        <p>
          Unduh draft terbaru, edit sel kuning, lalu unggah untuk melihat perubahan. Impor menyimpan
          draft dan tetap memerlukan verifikasi serta persetujuan aplikasi.
        </p>
        <p>
          Mapping taxonomy ada di tab 04 (U/V/W); simpan dan approve binding registry lebih dahulu.
          Rule in_taxonomy ada di tab 05. Metadata metrik ada di tab 11: C definisi bisnis, D
          sinonim array JSON, H filter JSON, I dimensi tanggal, J jumlah hari default, K unit, dan M
          null handling PRESERVE/ZERO_RESULT. Policy APPEND tanpa key ada di 14 Review!B8. Gunakan
          workbook terbaru dari backend; sel identitas dan normalisasi tetap dilindungi.
        </p>
        <div class="toolbar">
          <button :disabled="busy || dirty" @click="run(download)">
            <Download class="icon" :size="14" />Unduh template terisi (.xlsx)</button
          ><label v-if="canEdit"
            ><span class="toolbar"><Upload class="icon" :size="14" />Unggah untuk preview</span
            ><input type="file" accept=".xlsx" :disabled="busy || dirty" @change="importFile"
          /></label>
        </div>
        <div v-if="preview">
          <p v-for="(e, i) in preview.errors" :key="i" class="error">
            {{ e.location }}: {{ e.message }}
          </p>
          <p v-if="preview.can_apply" class="notice">
            Preview siap disimpan sebagai draft.
            {{
              preview.validation?.valid
                ? 'Dry-run lolos.'
                : 'Masih diperlukan perbaikan atau jawaban sebelum approval.'
            }}
          </p>
          <p v-if="preview.can_apply && !Object.keys(preview.diff).length">
            Tidak ada perubahan konfigurasi.
          </p>
          <details v-for="(change, key) in preview.diff" :key="key" open>
            <summary>{{ key }}</summary>
            <div class="grid">
              <div>
                <b>Sebelum</b>
                <pre>{{ JSON.stringify(change.before, null, 2) }}</pre>
              </div>
              <div>
                <b>Sesudah</b>
                <pre>{{ JSON.stringify(change.after, null, 2) }}</pre>
              </div>
            </div>
          </details>
          <p v-for="(answer, q) in preview.question_answers" :key="q">{{ q }}: {{ answer }}</p>
          <button
            class="primary"
            :disabled="busy || dirty || !preview.can_apply"
            @click="run(applyWorkbook)"
          >
            Terima perubahan Excel ke draft
          </button>
        </div>
      </details>
      <ConfigurationHistory :config="record" :disabled="busy || dirty" />
      <Card v-if="((reviewer && !record.review_state?.owner_managed) || canRollbackOwnerManaged) &&
        record.status === 'SUPERSEDED'" title="Rollback konfigurasi">
        <p class="notice">
          Mengaktifkan versi ini mengganti konfigurasi aktif. Ini tidak memulihkan data historis.
          Snapshot yang disetujui akan diperiksa ulang. Pada konfigurasi owner-managed, aksi ini hanya dapat dilakukan data owner, steward terdaftar, atau Platform Admin.
        </p>
        <label class="check"
          ><input v-model="rollbackAcknowledged" type="checkbox" :disabled="busy" />Saya sudah
          memeriksa versi yang akan diaktifkan kembali.</label
        ><button
          :disabled="busy || !rollbackAcknowledged || !evidenceReady || (!record.review_state?.owner_managed && releaseStatus?.configured && !releaseStatus.ready)"
          @click="run(() => queue(`${base}/rollback`))"
        >
          Antrekan rollback versi ini
        </button>
      </Card>
      <Card v-if="job" :title="`Proses: ${job.status}`">
        <p>{{ job.id }}</p>
        <RouterLink class="button" :to="{ path: '/jobs', query: { job: job.id } }"
          >Buka monitor job</RouterLink
        >
        <p v-if="job.status === 'QUEUED'" class="notice">Menunggu worker backend.</p>
        <p v-if="job.status === 'FAILED'" class="error">
          {{ job.error_code }} {{ job.error_message }}
        </p>
        <details v-if="job.result">
          <summary>Hasil proses</summary>
          <pre>{{ JSON.stringify(job.result, null, 2) }}</pre>
        </details>
      </Card>
      <Card v-if="!record.review_state?.owner_managed && releaseStatus?.configured && ['APPROVED', 'ACTIVE', 'SUPERSEDED'].includes(record.status)" title="Persetujuan siap tayang">
        <p :class="releaseStatus.ready ? 'success' : 'notice'">{{ releaseStatus.ready ? 'Semua persetujuan IT dan unit terkait lengkap.' : 'Deployment menunggu persetujuan IT dan unit terkait.' }}</p>
        <div v-for="group in releaseStatus.groups" :key="group.key" class="toolbar"><strong>{{ group.label }}</strong><span>{{ group.status }}</span></div>
        <RouterLink class="button" to="/release-approvals">Buka kotak masuk persetujuan</RouterLink>
      </Card>
      <div class="toolbar sticky-actions">
        <button v-if="step > 0" @click="step--">Sebelumnya</button
        ><button v-if="step < 6" @click="step++">Berikutnya</button
        ><button
          v-if="canEdit"
          class="primary"
          :disabled="busy || !dirty || hasInvalidDefaults"
          @click="run(save)"
        >
          <Spinner v-if="busy" :size="14" /><Save v-else class="icon" :size="14" />Simpan draft</button
        ><button :disabled="busy || dirty" @click="run(validate)">
          <RefreshCw class="icon" :size="14" />Dry-run ulang
        </button>
        <button v-if="dirty" :disabled="busy" @click="run(load)">
          Buang perubahan &amp; muat ulang
        </button>
        <button v-if="editor && !isDraft" :disabled="busy" @click="run(clone)">
          <Copy class="icon" :size="14" />Clone untuk perbaikan
        </button>
        <button
          v-if="(reviewer || (editor && record.review_state?.owner_managed)) && record.status === 'APPROVED'"
          class="primary"
          :disabled="busy || !evidenceReady || (!record.review_state?.owner_managed && releaseStatus?.configured && !releaseStatus.ready)"
          @click="run(() => queue(`${base}/deploy`))"
        >
          <Rocket class="icon" :size="14" />Deploy konfigurasi
        </button>
        <button
          v-if="editor && record.status === 'ACTIVE'"
          class="primary"
          :disabled="busy"
          @click="run(syncReview)"
        >
          <GitBranch class="icon" :size="14" />Buat batch sync review
        </button>
      </div>
    </template>
  </EtlShell>
</template>
