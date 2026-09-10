<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import EtlShell from '@/components/EtlShell.vue'
import DataTable from '@/components/DataTable.vue'
import { call, editRoles, reviewRoles, user } from '@/lib/etl'
import {
  answerImportReviewQuestion,
  applyImportReview,
  approveImportReview,
  type Finding,
  type ImportQuestion,
  type ImportQuestionAction,
  type ImportQuestionActionResponse,
  type ImportQuestionCategory,
  type ImportQuestionDecision,
  type ImportQuestionResolve,
  type ImportReviewPreview,
  listImportReviewQuestions,
  previewImportReview,
  readImportReviewPreview,
  resolveImportReference,
  type ImportReferenceResolveResult,
  resolveImportReviewMasterProposal,
  type ImportReview,
} from '@/lib/importReviews'
import { useTask } from '@/lib/tasks'
import { getApiErrorMessage } from '@/lib/api'
import axios from 'axios'
import type { Master } from '@/lib/masters'
import type { TaxonomyResolution } from '@/lib/taxonomies'
import TaxonomyAISuggestions from '@/components/TaxonomyAISuggestions.vue'
const master = ref<Master | null>(null)
const pollingFailed = ref(false)
const taxonomyQuestion = ref({
  taxonomyId: '',
  stagingRowId: '',
  sourceColumn: '',
  targetColumn: '',
  value: '',
})
async function createTaxonomyQuestion() {
  if (
    !review.value ||
    !canEdit.value ||
    !['NEEDS_INPUT', 'FAILED'].includes(review.value.status) ||
    review.value.dependencies_current === false
  )
    return
  const draft = taxonomyQuestion.value
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (
    !uuid.test(draft.taxonomyId) ||
    !uuid.test(draft.stagingRowId) ||
    !draft.targetColumn.trim() ||
    !draft.value.trim()
  )
    throw new Error('Isi UUID taxonomy/staging, kolom target, dan nilai staging terkini.')
  preview.value = null
  const result = await call<ImportQuestion | { created: false; resolution: TaxonomyResolution }>(
    'POST',
    `/taxonomies/${draft.taxonomyId}/ambiguity-question`,
    {
      import_review_id: id.value,
      staging_row_id: draft.stagingRowId,
      target_column: draft.targetColumn.trim(),
      value: draft.value,
      ...(draft.sourceColumn.trim() ? { source_column: draft.sourceColumn.trim() } : {}),
    },
  )
  await load()
  notice.value =
    'created' in result && result.created === false
      ? `Nilai sudah teresolusi (${result.resolution.status}); tidak ada pertanyaan baru.`
      : 'Pertanyaan taxonomy tersedia. Daftar dan revisi batch sudah diperbarui; lanjutkan dengan jawaban pengguna.'
}
const closeOpenPeriods = ref(false)
const closureEligible = computed(() => {
  const policy = master.value?.approved_definition_json?.policy
  return (
    review.value?.dataset_kind === 'MASTER' &&
    !!policy?.effective_dating &&
    policy.new_record_policy === 'PROPOSE_INSERT'
  )
})
const closureRows = computed(() =>
  (preview.value?.period_closures || []).map((closure) => ({ ...closure })),
)
watch(closeOpenPeriods, () => {
  preview.value = null
})
const route = useRoute(),
  id = computed(() => String(route.params.id)),
  { busy, error, notice, run } = useTask()
const review = ref<ImportReview | null>(null),
  findings = ref<Finding[]>([]),
  findingsMore = ref(false),
  findingOffset = ref(0),
  questions = ref<ImportQuestion[]>([]),
  questionsMore = ref(false),
  questionOffset = ref(0),
  questionStatus = ref(''),
  questionCategory = ref(''),
  preview = ref<ImportReviewPreview | null>(null),
  appliedRows = ref<number | null>(null),
  appliedPeriods = ref<number | null>(null),
  referenceMasterId = ref(''),
  referenceValue = ref(''),
  referenceQuestionId = ref(''),
  referenceResult = ref<ImportReferenceResolveResult | null>(null)
interface QuestionAnswerDraft {
  action: ImportQuestionAction | ''
  correctedValue: string
  reason: string
  selectedCandidateId: string
  masterProposalText: string
  proposedMasterDefinitionId: string
}
const comment = ref(''),
  questionDrafts = ref<Record<string, QuestionAnswerDraft>>({})
const findingRows = computed(() => findings.value as Record<string, unknown>[])
const previewRows = computed(() => (preview.value?.changes || []) as Record<string, unknown>[])
const referenceRows = computed(() => {
  if (!referenceResult.value) return []
  if (referenceResult.value.record) return [referenceResult.value.record]
  return referenceResult.value.candidates || []
})
const acceptSourceConflicts = ref(false)
watch(
  preview,
  () => {
    acceptSourceConflicts.value = false
  },
  { flush: 'sync' },
)
const referenceSourceColumn = ref('')
const referenceStagingRowId = ref('')
const referenceTargetColumn = ref('')
const canWriteReference = computed(
  () =>
    canEdit.value &&
    !!review.value &&
    ['NEEDS_INPUT', 'READY_FOR_APPROVAL', 'FAILED'].includes(review.value.status) &&
    review.value.dependencies_current !== false,
)
watch(referenceQuestionId, () => {
  const target = referenceTargets.value.find(
    (question) => question.id === referenceQuestionId.value,
  )
  referenceStagingRowId.value = target?.staging_row_id || ''
  referenceTargetColumn.value = target?.target_column || ''
  if (target?.source_column) referenceSourceColumn.value = target.source_column
})
watch(
  [
    referenceMasterId,
    referenceValue,
    referenceSourceColumn,
    referenceStagingRowId,
    referenceTargetColumn,
  ],
  () => {
    referenceResult.value = null
  },
)
const aiMetadata = computed(() => review.value?.checkpoint.ai_metadata || [])
const referenceTargets = computed(() =>
  questions.value.filter(
    (question) => question.staging_row_id && question.target_column && question.status === 'OPEN',
  ),
)
const questionItems = computed(() =>
  questions.value.map((question) => {
    initDraft(question)
    return { question, draft: questionDrafts.value[question.id] as QuestionAnswerDraft }
  }),
)
const canEdit = computed(() => editRoles.includes(user.value?.role || ''))
const canReview = computed(() => reviewRoles.includes(user.value?.role || ''))
watch(canWriteReference, (allowed) => {
  if (!allowed) {
    referenceQuestionId.value = ''
    referenceStagingRowId.value = ''
    referenceTargetColumn.value = ''
  }
})
const canPreview = computed(
  () =>
    canEdit.value &&
    !!review.value &&
    ['READY_FOR_APPROVAL', 'APPROVED'].includes(review.value.status) &&
    !(review.value.checkpoint.blocking_codes || []).length &&
    review.value.dependencies_current !== false,
)
const canApprove = computed(
  () =>
    canReview.value &&
    !!review.value &&
    !!preview.value?.preview_hash &&
    preview.value.can_approve &&
    !preview.value.blocking_codes?.length &&
    (!preview.value.requires_source_confirmation ||
      (acceptSourceConflicts.value && !!comment.value.trim())) &&
    preview.value.review.revision_no === review.value.revision_no &&
    review.value.dependencies_current !== false &&
    review.value.status === 'READY_FOR_APPROVAL',
)
const canApply = computed(
  () =>
    canEdit.value &&
    !!review.value &&
    !!preview.value?.preview_token &&
    !preview.value.read_only &&
    !preview.value.blocking_codes?.length &&
    review.value.dependencies_current !== false &&
    review.value.status === 'APPROVED',
)
const questionStatusItems: Array<'' | ImportQuestion['status']> = [
  '',
  'OPEN',
  'ANSWERED',
  'PENDING_APPROVAL',
  'CANCELLED',
]
const questionCategoryItems: Array<'' | ImportQuestionCategory> = [
  '',
  'DATA_QUALITY',
  'DUPLICATE_KEY',
  'DATA_QUALITY_WARNING',
  'CONFIGURATION',
  'AI_REVIEW',
  'TAXONOMY_AMBIGUOUS',
  'TAXONOMY_INVALID',
]
const terminal = [
  'NEEDS_INPUT',
  'FAILED',
  'STALE_REVIEW',
  'CANCELLED',
  'SUCCEEDED',
  'APPROVED',
  'READY_FOR_APPROVAL',
]
let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0
function stop() {
  ++generation
  if (timer) clearTimeout(timer)
}
function initDraft(question: ImportQuestion) {
  const current = questionDrafts.value[question.id]
  const defaultAction = question.allowed_actions[0] ?? ''
  if (!current) {
    questionDrafts.value[question.id] = {
      action: defaultAction,
      correctedValue: '',
      reason: '',
      selectedCandidateId: '',
      masterProposalText: '',
      proposedMasterDefinitionId: question.proposed_master_definition_id || '',
    }
    return
  }
  if (current.action && !question.allowed_actions.includes(current.action)) {
    current.action = defaultAction
  }
  if (!current.proposedMasterDefinitionId) {
    current.proposedMasterDefinitionId = question.proposed_master_definition_id || ''
  }
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
async function loadQuestions(next = 0) {
  const result = await listImportReviewQuestions(
    id.value,
    questionStatus.value,
    questionCategory.value,
    next,
    50,
  )
  questions.value = result.items
  questionsMore.value = result.has_more
  questionOffset.value = next
  for (const question of result.items) initDraft(question)
}
function normalizeCorrectionValue(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}
function requiresReason(action: ImportQuestionAction | '') {
  return action === 'CORRECT_SOURCE' || action === 'PROPOSE_MASTER'
}
function candidateLabel(candidate: Record<string, unknown>) {
  return typeof candidate.label === 'string' && candidate.label
    ? candidate.label
    : String(candidate.id)
}
function buildAnswerPayload(question: ImportQuestion): ImportQuestionDecision {
  const draft = questionDrafts.value[question.id]
  if (!draft || !draft.action) throw new Error('Pilih tindakan dahulu.')
  if (!question.allowed_actions.includes(draft.action))
    throw new Error('Tindakan tidak lagi tersedia; muat ulang pertanyaan.')
  const payload: ImportQuestionDecision = {
    revision_no: question.revision_no,
    action: draft.action,
  }
  if (draft.action === 'APPLY_CORRECTION') {
    if (!draft.correctedValue.trim()) throw new Error('Nilai koreksi wajib diisi.')
    payload.corrected_value = question.category.startsWith('TAXONOMY_')
      ? draft.correctedValue.trim()
      : normalizeCorrectionValue(draft.correctedValue)
  } else if (draft.action === 'PROPOSE_MASTER') {
    if (!draft.reason.trim()) throw new Error('Alasan usulan master wajib diisi.')
    payload.reason = draft.reason.trim()
    if (!draft.masterProposalText.trim()) throw new Error('Payload master proposal wajib diisi.')
    try {
      payload.master_proposal = JSON.parse(draft.masterProposalText.trim())
    } catch {
      throw new Error('Master proposal harus JSON yang valid.')
    }
  } else if (draft.action === 'CORRECT_SOURCE') {
    if (!draft.reason.trim()) throw new Error('Alasan koreksi sumber wajib diisi.')
    payload.reason = draft.reason.trim()
  } else if (draft.action === 'SELECT_RECORD') {
    if (!draft.selectedCandidateId.trim()) throw new Error('Pilih kandidat yang sesuai.')
    if (!question.candidates.some((item) => item.id === draft.selectedCandidateId))
      throw new Error('Pilih kandidat dari respons pertanyaan terbaru.')
    payload.selected_candidate_id = draft.selectedCandidateId.trim()
  } else if (draft.action === 'KEEP_ORIGINAL') {
    if (question.mandatory) throw new Error('KEEP_ORIGINAL tidak tersedia untuk pertanyaan wajib.')
  }
  if (requiresReason(draft.action)) payload.reason = draft.reason.trim()
  return payload
}
function applyQuestionResponse(response: ImportQuestionActionResponse) {
  review.value = response.review
  preview.value = null
  appliedRows.value = null
  const updated = response.question
  if (updated) {
    const index = questions.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) questions.value[index] = updated
  }
}
async function answerQuestion(question: ImportQuestion) {
  const response = await answerImportReviewQuestion(
    id.value,
    question.id,
    buildAnswerPayload(question),
  )
  if (response.stale) {
    notice.value = 'Batch menjadi stale karena dependency berubah. Muat ulang batch.'
    await load()
    return
  }
  applyQuestionResponse(response)
  await loadFindings()
  await loadQuestions(questionOffset.value)
}
async function resolveProposal(question: ImportQuestion) {
  const draft = questionDrafts.value[question.id]
  const payload: ImportQuestionResolve = {
    revision_no: question.revision_no,
    master_definition_id: (draft?.proposedMasterDefinitionId || '').trim(),
  }
  if (!payload.master_definition_id) throw new Error('Pilih master definition yang disetujui.')
  const response = await resolveImportReviewMasterProposal(id.value, question.id, payload)
  if (response.stale) {
    notice.value = 'Batch menjadi stale setelah status proposal. Muat ulang batch.'
    await load()
    return
  }
  applyQuestionResponse(response)
  await loadFindings()
  await loadQuestions(questionOffset.value)
}
async function load() {
  stop()
  pollingFailed.value = false
  preview.value = null
  const epoch = generation
  const result = await call<ImportReview>('GET', `/import-reviews/${id.value}`)
  if (epoch !== generation) return
  review.value = result
  preview.value = null
  appliedRows.value = null
  closeOpenPeriods.value = result.checkpoint.close_open_periods ?? false
  appliedPeriods.value = null
  master.value = null
  if (result.dataset_kind === 'MASTER' && result.master_id) {
    const definition = await call<Master>('GET', `/master-definitions/${result.master_id}`)
    if (epoch !== generation) return
    master.value = definition
  }
  await Promise.all([loadFindings(), loadQuestions()])
  if (epoch === generation && !terminal.includes(result.status))
    timer = setTimeout(() => void poll(epoch), 3000)
}
async function poll(epoch: number) {
  if (epoch !== generation) return
  try {
    const result = await call<ImportReview>('GET', `/import-reviews/${id.value}`)
    if (epoch !== generation) return
    review.value = result
    if (!terminal.includes(result.status)) {
      timer = setTimeout(() => void poll(epoch), 3000)
      return
    }
    await Promise.all([loadFindings(), loadQuestions()])
  } catch (failure) {
    if (epoch !== generation || axios.isCancel(failure)) return
    stop()
    preview.value = null
    pollingFailed.value = true
    error.value = getApiErrorMessage(failure)
  }
}
async function action(kind: 'cancel' | 'revalidate' | 'resume') {
  if (!review.value) return
  if (
    kind === 'resume' &&
    (review.value.status !== 'NEEDS_INPUT' || review.value.checkpoint.blocking_codes?.length)
  )
    throw new Error('Selesaikan blocker sebelum resume batch.')
  stop()
  preview.value = null
  const result = await call<ImportReview>('POST', `/import-reviews/${id.value}/${kind}`, {
    revision_no: review.value.revision_no,
    comment: comment.value.trim(),
  })
  review.value = result
  preview.value = null
  appliedRows.value = null
  notice.value = `Aksi ${kind} diterima. Periksa status batch terbaru.`
  await load()
}
async function previewBatch() {
  if (!review.value || !canPreview.value) return
  preview.value = null
  const epoch = generation
  const mode =
    review.value.status === 'APPROVED'
      ? (review.value.checkpoint.close_open_periods ?? false)
      : closureEligible.value && closeOpenPeriods.value
  const result = await previewImportReview(id.value, review.value.revision_no, mode)
  if (epoch !== generation) return
  preview.value = result
  review.value = preview.value.review
  appliedRows.value = null
  notice.value = 'Preview batch siap ditinjau.'
}
async function readPreview() {
  if (!review.value || !(canEdit.value || canReview.value)) return
  preview.value = null
  const epoch = generation
  const result = await readImportReviewPreview(id.value)
  if (epoch !== generation) return
  review.value = result.review
  preview.value = result
  notice.value = 'Preview editor dimuat untuk ditinjau. Tidak ada token apply yang diterbitkan.'
}
async function approveBatch() {
  if (!canApprove.value || !preview.value) return
  try {
    review.value = await approveImportReview(
      id.value,
      preview.value.review.revision_no,
      comment.value,
      preview.value.preview_hash,
      !!preview.value.requires_source_confirmation && acceptSourceConflicts.value,
    )
    preview.value.can_approve = false
  } catch (error) {
    preview.value = null
    throw error
  }
  notice.value = 'Preview batch disetujui. Editor dapat menjalankan apply dengan token yang sama.'
}
async function applyBatch() {
  if (!review.value || !preview.value) return
  const token = preview.value.preview_token
  if (!canApply.value || !token) return
  preview.value = null
  const result = await applyImportReview(id.value, review.value.revision_no, token)
  review.value = result.review
  appliedRows.value = result.rows_applied
  appliedPeriods.value = result.periods_closed ?? 0
  notice.value = `Apply selesai. ${result.rows_applied} baris ditulis, ${result.periods_closed ?? 0} periode ditutup.`
  await Promise.all([loadFindings(), loadQuestions()])
}
async function resolveReference() {
  if (!review.value || !(canEdit.value || canReview.value)) return
  const writing = !!referenceStagingRowId.value.trim() || !!referenceTargetColumn.value.trim()
  if (writing && !canWriteReference.value)
    throw new Error('Penulisan referensi tidak tersedia pada role/status batch ini.')
  referenceResult.value = null
  preview.value = null
  const epoch = generation
  const result = await resolveImportReference(
    id.value,
    review.value.revision_no,
    referenceMasterId.value.trim(),
    referenceValue.value,
    referenceSourceColumn.value,
    referenceStagingRowId.value.trim() || undefined,
    referenceTargetColumn.value.trim() || undefined,
  )
  if (epoch !== generation) return
  if (result.staging_updated) {
    preview.value = null
    appliedRows.value = null
    if (result.revision_no !== undefined) review.value.revision_no = result.revision_no
    await load()
    notice.value =
      'Referensi staging diperbarui. Revisi batch dimuat ulang; selesaikan pertanyaan wajib lalu buat preview baru.'
  }
  referenceResult.value = result
}
watch(
  [id, user],
  () => {
    stop()
    review.value = null
    master.value = null
    closeOpenPeriods.value = false
    appliedPeriods.value = null
    findings.value = []
    questions.value = []
    questionDrafts.value = {}
    taxonomyQuestion.value = {
      taxonomyId: '',
      stagingRowId: '',
      sourceColumn: '',
      targetColumn: '',
      value: '',
    }
    pollingFailed.value = false
    preview.value = null
    appliedRows.value = null
    referenceQuestionId.value = ''
    referenceSourceColumn.value = ''
    referenceStagingRowId.value = ''
    referenceTargetColumn.value = ''
    referenceResult.value = null
    if (user.value) void run(load)
  },
  { immediate: true },
)
onBeforeUnmount(stop)
</script>
<template>
  <EtlShell
    ><RouterLink to="/import-reviews">â† Daftar batch</RouterLink>
    <h1>Detail batch import</h1>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <p v-if="pollingFailed" class="notice">
      Pemantauan berhenti karena request gagal. Muat ulang status untuk melanjutkan; tidak ada
      mutation yang diulang otomatis.
    </p>
    <button v-if="user" :disabled="busy" @click="run(load)">Muat ulang status batch</button>
    <template v-if="review"
      ><section class="panel">
        <h2>{{ review.status }} Â· {{ review.dataset_kind }}</h2>
        <p>
          {{ review.id }} Â· revisi {{ review.revision_no }} Â· generasi {{ review.generation }}
        </p>
        <p>
          Snapshot {{ review.snapshot_hash }} Â· dependency
          {{ review.dependencies_current === false ? 'berubah' : 'terkini' }}
        </p>
        <p v-if="review.configuration_id">
          Konfigurasi {{ review.configuration_id }} Â· revisi {{ review.configuration_revision }}
        </p>
        <p v-if="review.master_id">
          Master {{ review.master_id }} Â· versi {{ review.master_version }}
        </p>
        <p v-if="review.checkpoint.blocking_codes?.length" class="error">
          Blocker: {{ review.checkpoint.blocking_codes.join(', ') }}
        </p>
        <p>
          Baris valid {{ review.checkpoint.rows_valid ?? 'â€”' }} Â· invalid
          {{ review.checkpoint.rows_invalid ?? 'â€”' }} Â· warning
          {{ review.checkpoint.warning_count ?? 0 }} Â· AI
          {{ review.checkpoint.ai_coverage || 'â€”' }}
        </p>
        <section v-if="review.checkpoint.ai_coverage" class="card-row">
          <h3>Evidence review AI</h3>
          <p>
            Coverage {{ review.checkpoint.ai_coverage }} ·
            {{ review.checkpoint.ai_reviewed_rows?.length || 0 }} baris direview
          </p>
          <p class="muted">
            Field disamarkan: {{ review.checkpoint.ai_masked_fields?.join(', ') || 'tidak ada' }}
          </p>
          <details v-if="aiMetadata.length">
            <summary>Metadata model dan prompt</summary>
            <pre>{{ JSON.stringify(aiMetadata, null, 2) }}</pre>
          </details>
        </section>
        <p v-if="review.status === 'SUCCEEDED'" class="notice">
          Batch sudah selesai diaplikasikan ke target trusted.
          {{ appliedRows ?? review.checkpoint.rows_applied ?? 'Belum tersedia hitungan' }} baris
          ditulis. {{ appliedPeriods ?? review.checkpoint.periods_closed ?? 0 }} periode ditutup.
        </p>
        <label v-if="canEdit || canReview"
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
            :disabled="
              busy ||
              !['FAILED', 'STALE_REVIEW', 'READY_FOR_APPROVAL', 'APPROVED'].includes(review.status)
            "
            @click="run(() => action('revalidate'))"
          >
            Revalidate</button
          ><button
            :disabled="
              busy || review.status !== 'NEEDS_INPUT' || !!review.checkpoint.blocking_codes?.length
            "
            @click="run(() => action('resume'))"
          >
            Resume
          </button>
        </div>
        <p v-if="['READY_FOR_APPROVAL', 'APPROVED'].includes(review.status)" class="muted">
          Revalidate mencabut approval dan preview lama. Tunggu validasi selesai, lalu preview dan
          approve ulang.
        </p>
      </section>
      <section class="panel">
        <h2>Preview dan apply</h2>
        <p v-if="canReview && !canEdit" class="notice">
          Baca preview editor sebelum menyetujui batch.
        </p>
        <label v-if="closureEligible"
          ><input
            v-model="closeOpenPeriods"
            type="checkbox"
            :disabled="busy || !canPreview || review.status === 'APPROVED'"
          />
          Usulkan penutupan periode terbuka untuk batch ini
        </label>
        <p v-if="closureEligible" class="muted">
          Periode lama ditutup pada awal versi baru melalui approval. Gunakan sumber delta versi
          baru dengan interval yang tidak overlap. Untuk mengganti rencana yang sudah approved,
          jalankan Revalidate.
        </p>
        <p class="muted">
          Preview mengikat snapshot dan revision batch. Jika batch berubah, buat preview baru.
        </p>
        <p class="muted">
          Baris valid dan jumlah kandidat preview bukan jumlah penulisan aktual. UNCHANGED dan KEEP
          tidak menambah baris ditulis; gunakan hasil apply. DUPLICATE harus diselesaikan sebelum
          approval.
        </p>
        <p
          v-if="
            review.dataset_kind === 'MASTER' &&
            !master?.approved_definition_json?.policy?.effective_dating
          "
          class="muted"
        >
          UPDATE mempertahankan UUID dan menaikkan revisi record. UNCHANGED mempertahankan revisi
          dan lineage; record yang tidak ada dalam batch tetap disimpan. Jika target atau staging
          berubah setelah approval, jalankan Revalidate, preview dan approval ulang.
        </p>
        <div class="toolbar">
          <button
            v-if="canEdit || canReview"
            :disabled="busy || !['READY_FOR_APPROVAL', 'APPROVED'].includes(review.status)"
            @click="run(readPreview)"
          >
            Baca preview editor
          </button>
          <button class="primary" :disabled="busy || !canPreview" @click="run(previewBatch)">
            Buat preview</button
          ><button :disabled="busy || !canApprove" @click="run(approveBatch)">
            Approve preview</button
          ><button :disabled="busy || !canApply" @click="run(applyBatch)">Apply batch</button>
        </div>
        <template v-if="preview">
          <p v-if="preview.read_only">
            Preview baca saja; token apply hanya tersedia dari preview editor.
          </p>
          <p v-if="preview.masked_fields?.length">
            Field disamarkan: {{ preview.masked_fields.join(', ') }}
          </p>
          <p>
            Target {{ preview.target }} · hash {{ preview.preview_hash }} ·
            {{ preview.can_approve ? 'siap approval' : 'belum siap approval' }}
          </p>
          <pre>{{ JSON.stringify(preview.summary, null, 2) }}</pre>
          <p v-if="preview.blocking_codes?.length" class="error">
            Blocker preview: {{ preview.blocking_codes.join(', ') }}. Seluruh batch ditahan.
          </p>
          <p v-if="review.dataset_kind === 'MASTER'" class="muted">
            INSERT_PROPOSED adalah usulan record baru yang ikut disetujui bersama batch. INVALID dan
            KEY_CONFLICT menahan seluruh batch; konfirmasi tidak mengabaikan policy master.
          </p>
          <section v-if="preview.requires_source_confirmation">
            <h3>Konflik sumber</h3>
            <DataTable :rows="preview.source_conflicts || []" />
            <p>Konfirmasi mencakup seluruh konflik, termasuk CLOSE_PERIOD, pada preview ini.</p>
            <label v-if="canReview" class="check">
              <input
                v-model="acceptSourceConflicts"
                type="checkbox"
                :disabled="busy || review.status !== 'READY_FOR_APPROVAL'"
              />
              Saya menyetujui seluruh konflik sumber pada preview ini
            </label>
            <p>Isi Catatan aksi dengan alasan pemilihan sumber sebelum approval.</p>
          </section>
          <DataTable :rows="previewRows" />
          <h3>Penutupan periode: {{ closureRows.length }}</h3>
          <p>
            Penutupan terpisah dari jumlah baris kandidat; nilai berikut mengikuti preview backend.
          </p>
          <DataTable v-if="closureRows.length" :rows="closureRows" />
        </template>
        <form v-if="canEdit || canReview" class="toolbar" @submit.prevent="run(resolveReference)">
          <label
            >Kolom sumber referensi<input v-model="referenceSourceColumn" required :disabled="busy"
          /></label>
          <label
            >Master ID<input
              v-model="referenceMasterId"
              required
              placeholder="UUID master definition"
              :disabled="busy"
          /></label>
          <label
            >Value<input
              v-model="referenceValue"
              maxlength="500"
              placeholder="Nilai field binding; kosong untuk referensi opsional"
              :disabled="busy"
          /></label>
          <label
            >Isi staging (opsional)<select
              v-model="referenceQuestionId"
              :disabled="busy || !canWriteReference"
            >
              <option value="">Hanya cari reference</option>
              <option v-for="question in referenceTargets" :key="question.id" :value="question.id">
                Baris {{ question.source_row || '?' }} · {{ question.target_column }}
              </option>
            </select></label
          >
          <template v-if="canWriteReference">
            <label
              >UUID staging referensi<input v-model="referenceStagingRowId" :disabled="busy"
            /></label>
            <label
              >Kolom target referensi<input v-model="referenceTargetColumn" :disabled="busy"
            /></label>
          </template>
          <button :disabled="busy || !review">Resolve reference</button>
        </form>
        <p class="muted">
          Resolver memakai binding tab/kolom approved dan target konfigurasi UUID. Kosongkan
          pasangan staging/target untuk pencarian saja. Perubahan alias atau master memerlukan batch
          baru berdasarkan dependency terbaru; Revalidate tidak mengganti dependency batch lama.
        </p>
        <template v-if="referenceResult">
          <p>Reference {{ referenceResult.status }} · master {{ referenceResult.master_id }}</p>
          <p v-if="referenceResult.staging_updated" class="success">
            Nilai staging diperbarui (UUID untuk EXACT/ALIAS, null untuk EMPTY). Pertanyaan wajib
            tetap harus diselesaikan.
          </p>
          <p
            v-if="
              referenceResult.requires_question ||
              ['CANDIDATE', 'AMBIGUOUS', 'NOT_FOUND'].includes(referenceResult.status)
            "
            class="notice"
          >
            Selesaikan melalui pertanyaan batch. Kandidat tidak dipilih atau ditulis otomatis.
          </p>
          <DataTable :rows="referenceRows" />
        </template>
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
      </section>
      <section class="panel">
        <h2>Pertanyaan batch</h2>
        <details
          v-if="
            canEdit &&
            ['NEEDS_INPUT', 'FAILED'].includes(review.status) &&
            review.dependencies_current !== false
          "
        >
          <summary>Buat pertanyaan taxonomy manual</summary>
          <p>
            Untuk staging yang sudah diketahui: UUID baris, mapping taxonomy, dan nilai harus cocok
            dengan batch ini. Backend memverifikasi semuanya; pertanyaan otomatis worker tetap
            tersedia di bawah.
          </p>
          <form @submit.prevent="run(createTaxonomyQuestion)">
            <fieldset :disabled="busy">
              <label
                >UUID taxonomy<input v-model="taxonomyQuestion.taxonomyId" required maxlength="36"
              /></label>
              <label
                >UUID baris staging<input
                  v-model="taxonomyQuestion.stagingRowId"
                  required
                  maxlength="36"
              /></label>
              <label
                >Kolom target taxonomy<input
                  v-model="taxonomyQuestion.targetColumn"
                  required
                  maxlength="63"
              /></label>
              <label
                >Header sumber taxonomy (opsional)<input
                  v-model="taxonomyQuestion.sourceColumn"
                  maxlength="63"
              /></label>
              <label
                >Nilai staging terkini<input
                  v-model="taxonomyQuestion.value"
                  required
                  maxlength="500"
              /></label>
              <button>Buat atau muat pertanyaan taxonomy</button>
            </fieldset>
          </form>
        </details>
        <div class="toolbar">
          <select v-model="questionStatus" @change="run(() => loadQuestions(0))">
            <option v-for="status in questionStatusItems" :key="status">
              {{ status || 'Semua status' }}
            </option></select
          ><select v-model="questionCategory" @change="run(() => loadQuestions(0))">
            <option v-for="category in questionCategoryItems" :key="category">
              {{ category || 'Semua kategori' }}
            </option></select
          ><button :disabled="busy" @click="run(() => loadQuestions(0))">Muat ulang</button>
        </div>
        <p v-if="!questions.length" class="muted">Belum ada pertanyaan untuk batch ini.</p>
        <article v-for="item in questionItems" :key="item.question.id" class="card-row">
          <h3>
            {{ item.question.category }} � {{ item.question.status }} � baris
            {{ item.question.source_row || '�' }}
          </h3>
          <p>{{ item.question.prompt }}</p>
          <p>
            Kolom {{ item.question.source_column || '�' }} =>
            {{ item.question.target_column || '�' }} �
            {{ item.question.mandatory ? 'Wajib' : 'Opsional' }}
            {{
              item.question.decisions.length
                ? ` � keputusan: ${item.question.decisions.length}`
                : ''
            }}
          </p>
          <template
            v-if="
              item.question.status === 'OPEN' &&
              canEdit &&
              ['NEEDS_INPUT', 'FAILED'].includes(review.status)
            "
          >
            <p v-if="item.question.category.startsWith('TAXONOMY_')" class="muted">
              Pilihan UUID kandidat disimpan sebagai kode term oleh backend. Koreksi taxonomy adalah
              teks. CORRECT_SOURCE hanya mencatat keputusan; perbaiki sumber lalu gunakan snapshot
              dan batch baru.
            </p>
            <label
              >Tindakan<select v-model="item.draft.action" :disabled="busy">
                <option
                  v-for="action in item.question.allowed_actions"
                  :key="action"
                  :disabled="item.question.mandatory && action === 'KEEP_ORIGINAL'"
                >
                  {{ action }}
                </option>
              </select></label
            >
            <TaxonomyAISuggestions
              v-if="
                item.question.category === 'TAXONOMY_INVALID' &&
                item.question.allowed_actions.includes('APPLY_CORRECTION') &&
                review.dependencies_current !== false
              "
              :key="`${item.question.id}:${item.question.revision_no}`"
              :disabled="busy"
              @confirm="
                (code) => {
                  item.draft.action = 'APPLY_CORRECTION'
                  item.draft.correctedValue = code
                }
              "
            />
            <label v-if="item.draft.action === 'APPLY_CORRECTION'"
              >Nilai koreksi<input
                v-model="item.draft.correctedValue"
                :placeholder="
                  item.question.category.startsWith('TAXONOMY_')
                    ? 'Kode, label, atau alias taxonomy'
                    : '321 atau teks'
                "
                :disabled="busy"
              />
            </label>
            <label v-if="item.draft.action === 'SELECT_RECORD'"
              >Pilih kandidat<select v-model="item.draft.selectedCandidateId" :disabled="busy">
                <option value="">Pilih kandidat</option>
                <option
                  v-for="candidate in item.question.candidates"
                  :key="candidate.id"
                  :value="candidate.id"
                >
                  {{ candidateLabel(candidate) }}
                </option>
              </select></label
            >
            <label v-if="requiresReason(item.draft.action)"
              >Alasan<textarea v-model="item.draft.reason" maxlength="2000" :disabled="busy" />
            </label>
            <label v-if="item.draft.action === 'PROPOSE_MASTER'"
              >Master proposal (JSON)<textarea
                v-model="item.draft.masterProposalText"
                maxlength="4000"
                placeholder='{"code":"kode_master","name":"Nama"}'
                :disabled="busy"
              />
            </label>
            <div class="toolbar">
              <button
                class="primary"
                :disabled="busy"
                @click="run(() => answerQuestion(item.question))"
              >
                Simpan jawaban
              </button>
            </div>
          </template>
          <template v-else-if="item.question.status === 'PENDING_APPROVAL' && canReview">
            <label
              >Master definition approved (ID)<input
                v-model="item.draft.proposedMasterDefinitionId"
                placeholder="UUID master definition"
                :disabled="busy"
            /></label>
            <button
              class="primary"
              :disabled="busy"
              @click="run(() => resolveProposal(item.question))"
            >
              Selesaikan proposal master
            </button>
          </template>
          <div v-else>
            <pre>{{ JSON.stringify(item.question.decisions, null, 2) }}</pre>
          </div>
        </article>
        <div class="toolbar">
          <button
            :disabled="busy || questionOffset === 0"
            @click="run(() => loadQuestions(Math.max(0, questionOffset - 50)))"
          >
            Sebelumnya</button
          ><button
            :disabled="busy || !questionsMore"
            @click="run(() => loadQuestions(questionOffset + 50))"
          >
            Berikutnya
          </button>
        </div>
      </section></template
    >
    <p v-else-if="busy" role="status">Memuat batchâ€¦</p></EtlShell
  >
</template>
