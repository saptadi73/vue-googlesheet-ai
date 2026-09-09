<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { call, editRoles, user } from '@/lib/etl'
import { useTask } from '@/lib/tasks'
import type { Taxonomy } from '@/lib/taxonomies'

const props = defineProps<{
  taxonomyId?: string
  taxonomyVersion?: number
  values?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ confirm: [code: string] }>()
interface AISuggestions {
  taxonomy_id: string
  taxonomy_version: number
  recommendation_kind: 'GENERATIVE'
  ai_response_id: string
  ai_model: string
  prompt_version: string
  recommendations: Array<{
    input_index: number
    value: string
    requires_confirmation: true
    candidates: Array<{ term: { id: string; code: string; label: string }; confidence: number }>
  }>
}
const { busy, error, run } = useTask()
const editor = computed(() => editRoles.includes(user.value?.role || ''))
const taxonomies = ref<Taxonomy[]>([])
const selectedId = ref('')
const input = ref('')
const limit = ref(3)
const result = ref<AISuggestions | null>(null)
const confirmed = ref('')
const taxonomyId = computed(() => props.taxonomyId || selectedId.value)
const version = computed(
  () => props.taxonomyVersion ?? taxonomies.value.find((t) => t.id === selectedId.value)?.version,
)
let epoch = 0
watch(
  [() => props.taxonomyId, () => props.taxonomyVersion, () => props.values, user],
  () => {
    epoch++
    result.value = null
    confirmed.value = ''
    input.value = props.values ?? ''
    selectedId.value = ''
    taxonomies.value = []
  },
  { immediate: true },
)
watch([input, limit, selectedId], () => {
  epoch++
  result.value = null
  confirmed.value = ''
})
async function loadTaxonomies() {
  result.value = null
  const current = ++epoch
  const list = await call<Taxonomy[]>('GET', '/taxonomies')
  if (current === epoch)
    taxonomies.value = list.filter((t) => t.status === 'APPROVED' && t.is_active)
}
async function request() {
  result.value = null
  confirmed.value = ''
  if (!editor.value || props.disabled) return
  const values = input.value.split('\n')
  if (!taxonomyId.value || !version.value)
    throw new Error('Pilih taxonomy approved aktif dan versinya.')
  if (values.length > 50 || values.some((v) => !v.trim() || v.length > 500))
    throw new Error('Isi 1..50 nilai nonblank, maksimal 500 karakter per nilai.')
  if (!Number.isInteger(limit.value) || limit.value < 1 || limit.value > 10)
    throw new Error('Jumlah kandidat harus 1..10.')
  const current = ++epoch
  const response = await call<AISuggestions>(
    'POST',
    `/taxonomies/${taxonomyId.value}/recommend-terms-ai`,
    {
      taxonomy_version: version.value,
      values,
      limit: limit.value,
    },
  )
  if (current === epoch) result.value = response
}
function confirm(code: string) {
  if (!editor.value || busy.value || props.disabled || !result.value) return
  confirmed.value = code
  emit('confirm', code)
}
</script>
<template>
  <section v-if="editor" class="card-row">
    <h3>Saran taxonomy AI</h3>
    <p>
      Permintaan mengirim nilai kategori yang Anda isi dan term taxonomy aktif ke penyedia AI. Isi
      hanya nilai yang ingin dimintakan saran.
    </p>
    <template v-if="!taxonomyId || !props.taxonomyId">
      <button type="button" :disabled="busy || disabled" @click="run(loadTaxonomies)">
        Muat taxonomy untuk saran AI
      </button>
      <label
        >Taxonomy untuk saran AI<select v-model="selectedId" :disabled="busy || disabled">
          <option value="">Pilih taxonomy kolom ini</option>
          <option v-for="t in taxonomies" :key="t.id" :value="t.id">
            {{ t.name }} / versi {{ t.version }}
          </option>
        </select></label
      >
    </template>
    <p v-if="version">Versi taxonomy: {{ version }}</p>
    <label
      >Nilai untuk saran AI (satu per baris)<textarea
        v-model="input"
        :disabled="busy || disabled"
      />
    </label>
    <label
      >Jumlah kandidat AI<input
        v-model.number="limit"
        type="number"
        min="1"
        max="10"
        :disabled="busy || disabled"
    /></label>
    <button type="button" :disabled="busy || disabled" @click="run(request)">Minta saran AI</button>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <template v-if="result">
      <p>
        {{ result.recommendation_kind }} / model {{ result.ai_model }} / prompt
        {{ result.prompt_version }}
      </p>
      <p>
        Confidence adalah estimasi model, bukan probabilitas terkalibrasi. Konfirmasi pilihan
        sebelum menggunakan kode.
      </p>
      <article v-for="item in result.recommendations" :key="item.input_index">
        <h4>Input {{ item.input_index }}: {{ item.value }}</h4>
        <p v-if="!item.candidates.length">Tidak ada saran yang didukung.</p>
        <div v-for="candidate in item.candidates" :key="candidate.term.id">
          {{ candidate.term.label }} / {{ candidate.term.code }} / confidence
          {{ candidate.confidence }}
          <button type="button" :disabled="busy || disabled" @click="confirm(candidate.term.code)">
            Konfirmasi kode {{ candidate.term.code }}
          </button>
        </div>
      </article>
    </template>
    <p v-if="confirmed" role="status">
      Kode {{ confirmed }} dipilih. Tinjau nilai sebelum menyimpan; saran tidak memberikan approval.
    </p>
  </section>
</template>
