<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import EtlShell from '@/components/EtlShell.vue'
import DataTable from '@/components/DataTable.vue'
import { call, editRoles, reviewRoles, user } from '@/lib/etl'
import {
  answerImportReviewQuestion,
  type Finding,
  type ImportQuestion,
  type ImportQuestionAction,
  type ImportQuestionActionResponse,
  type ImportQuestionCategory,
  type ImportQuestionDecision,
  type ImportQuestionResolve,
  listImportReviewQuestions,
  resolveImportReviewMasterProposal,
  type ImportReview,
} from '@/lib/importReviews'
import { useTask } from '@/lib/tasks'
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
  questionCategory = ref('')
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
const canEdit = computed(() => editRoles.includes(user.value?.role || ''))
const canReview = computed(() => reviewRoles.includes(user.value?.role || ''))
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
]
const terminal = ['NEEDS_INPUT', 'FAILED', 'STALE_REVIEW', 'CANCELLED', 'SUCCEEDED', 'APPROVED']
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
  if (!question.allowed_actions.includes(current.action)) current.action = defaultAction
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
function buildAnswerPayload(question: ImportQuestion): ImportQuestionDecision {
  const draft = questionDrafts.value[question.id]
  if (!draft || !draft.action) throw new Error('Pilih tindakan dahulu.')
  const payload: ImportQuestionDecision = { revision_no: question.revision_no, action: draft.action }
  if (draft.action === 'APPLY_CORRECTION') {
    if (!draft.correctedValue.trim()) throw new Error('Nilai koreksi wajib diisi.')
    payload.corrected_value = normalizeCorrectionValue(draft.correctedValue)
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
    payload.selected_candidate_id = draft.selectedCandidateId.trim()
  } else if (draft.action === 'KEEP_ORIGINAL') {
    if (question.mandatory) throw new Error('KEEP_ORIGINAL tidak tersedia untuk pertanyaan wajib.')
  }
  if (requiresReason(draft.action)) payload.reason = draft.reason.trim()
  return payload
}
function applyQuestionResponse(response: ImportQuestionActionResponse) {
  review.value = response.review
  if (response.question) {
    const index = questions.value.findIndex((item) => item.id === response.question.id)
    if (index >= 0) questions.value[index] = response.question
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
  const epoch = generation
  const result = await call<ImportReview>('GET', `/import-reviews/${id.value}`)
  if (epoch !== generation) return
  review.value = result
  await Promise.all([loadFindings(), loadQuestions()])
  if (epoch === generation && !terminal.includes(result.status))
    timer = setTimeout(() => void poll(epoch), 3000)
}
async function poll(epoch: number) {
  if (epoch !== generation) return
  const result = await call<ImportReview>('GET', `/import-reviews/${id.value}`)
  if (epoch !== generation) return
  review.value = result
  if (!terminal.includes(result.status)) {
    timer = setTimeout(() => void poll(epoch), 3000)
    return
  }
  await Promise.all([loadFindings(), loadQuestions()])
}
async function action(kind: 'cancel' | 'revalidate' | 'resume') {
  if (!review.value) return
  const result = await call<ImportReview>('POST', `/import-reviews/${id.value}/${kind}`, {
    revision_no: review.value.revision_no,
    comment: comment.value.trim(),
  })
  review.value = result
  notice.value = `Aksi ${kind} diterima. Periksa status batch terbaru.`
  await Promise.all([loadFindings(), loadQuestions()])
}
watch(
  [id, user],
  () => {
    review.value = null
    findings.value = []
    questions.value = []
    questionDrafts.value = {}
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
    <template v-if="review"
      ><section class="panel">
        <h2>{{ review.status }} Â· {{ review.dataset_kind }}</h2>
        <p>{{ review.id }} Â· revisi {{ review.revision_no }} Â· generasi {{ review.generation }}</p>
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
      </section>
      <section class="panel">
        <h2>Pertanyaan batch</h2>
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
        <article v-for="question in questions" :key="question.id" class="card-row">
          <h3>{{ question.category }} Â· {{ question.status }} Â· baris {{ question.source_row || 'â€”' }}</h3>
          <p>
            {{ question.prompt }}
          </p>
          <p>
            Kolom {{ question.source_column || 'â€”' }} â‡’ {{ question.target_column || 'â€”' }} Â·
            {{ question.mandatory ? 'Wajib' : 'Opsional' }}
            {{ question.decisions.length ? ` Â· keputusan: ${question.decisions.length}` : '' }}
          </p>
          <template v-if="question.status === 'OPEN' && canEdit">
            <label
              >Tindakan<select v-model="questionDrafts[question.id].action" :disabled="busy">
                <option v-for="action in question.allowed_actions" :key="action">{{ action }}</option>
              </select></label
            >
            <label v-if="questionDrafts[question.id].action === 'APPLY_CORRECTION'"
              >Nilai koreksi<input
                v-model="questionDrafts[question.id].correctedValue"
                placeholder="321 atau \"abc\""
                :disabled="busy"
              />
            </label>
            <label v-if="questionDrafts[question.id].action === 'SELECT_RECORD'"
              >Pilih kandidat<select
                v-model="questionDrafts[question.id].selectedCandidateId"
                :disabled="busy"
              >
                <option value="">Pilih kandidat</option>
                <option
                  v-for="candidate in question.candidates"
                  :key="candidate.id"
                  :value="candidate.id"
                >
                  {{ (candidate.label as string) || candidate.id }}
                </option>
              </select></label
            >
            <label v-if="requiresReason(questionDrafts[question.id].action)"
              >Alasan<textarea
                v-model="questionDrafts[question.id].reason"
                maxlength="2000"
                :disabled="busy"
              /></label
            >
            <label v-if="questionDrafts[question.id].action === 'PROPOSE_MASTER'"
              >Master proposal (JSON)<textarea
                v-model="questionDrafts[question.id].masterProposalText"
                maxlength="4000"
                placeholder='{"code":"kode_master","name":"Nama"}'
                :disabled="busy"
              /></label
            >
            <div class="toolbar">
              <button
                class="primary"
                :disabled="busy"
                @click="run(() => answerQuestion(question))"
              >
                Simpan jawaban
              </button>
            </div>
          </template>
          <template v-else-if="question.status === 'PENDING_APPROVAL' && canReview">
            <label
              >Master definition approved (ID)<input
                v-model="questionDrafts[question.id].proposedMasterDefinitionId"
                placeholder="UUID master definition"
                :disabled="busy"
              /></label
            >
            <button class="primary" :disabled="busy" @click="run(() => resolveProposal(question))">
              Selesaikan proposal master
            </button>
          </template>
          <div v-else>
            <pre>{{ JSON.stringify(question.decisions, null, 2) }}</pre>
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
