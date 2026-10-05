<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import DataTable from '@/components/DataTable.vue'
import QueryRequestDetail from '@/components/QueryRequestDetail.vue'
import { api, type ApiEnvelope } from '@/lib/api'
import { call, user } from '@/lib/etl'
import { type Product, type Row, type VisualizationSpec } from '@/lib/catalog'
import { useTask } from '@/lib/tasks'

const { busy, error, notice, run } = useTask()
const ResultChart = defineAsyncComponent(() => import('@/components/charts/ResultChart.vue'))
const products = ref<Product[]>([])
const question = ref('')
const code = ref('')
const clarificationId = ref('')
const savedCode = ref('')
const messages = ref<
  { question: string; rows: Row[]; meta: Record<string, unknown>; feedback: string }[]
>([])
const examples = [
  'Tampilkan total penjualan per cabang bulan ini',
  'Bandingkan penjualan dan jumlah transaksi per bulan',
  'Tampilkan 10 produk dengan penjualan tertinggi',
]
let generation = 0

interface TemplateCandidate {
  code: string
  data_product_code: string
}

onBeforeUnmount(() => {
  ++generation
})
watch(
  [question, code],
  () => {
    savedCode.value = ''
  },
  { flush: 'sync' },
)
function candidates(meta: Record<string, unknown>): TemplateCandidate[] {
  return Array.isArray(meta.template_candidates)
    ? meta.template_candidates
        .filter(
          (item): item is TemplateCandidate =>
            !!item && typeof item.code === 'string' && typeof item.data_product_code === 'string',
        )
        .slice(0, 20)
    : []
}
function chooseTemplate(candidate: TemplateCandidate, originalQuestion: string) {
  question.value = originalQuestion
  code.value = candidate.data_product_code
  savedCode.value = candidate.code
}
function visualization(meta: Record<string, unknown>) {
  return (meta.visualization || null) as VisualizationSpec | null
}
function useExample(example: string) {
  clarificationId.value = ''
  savedCode.value = ''
  question.value = example
}
function resetConversation() {
  clarificationId.value = ''
  savedCode.value = ''
  question.value = ''
}
async function ask() {
  const epoch = generation
  const text = question.value.trim()
  if (text.length < 3) throw new Error('Pertanyaan minimal 3 karakter.')
  const path = clarificationId.value
    ? `/nl2sql/clarifications/${clarificationId.value}`
    : '/nl2sql/query'
  const response = await api.post<ApiEnvelope<Row[]>>(
    path,
    {
      question: text,
      data_product_code: code.value || null,
      ...(savedCode.value ? { saved_query_code: savedCode.value } : {}),
    },
    { timeout: 90_000 },
  )
  if (epoch !== generation) return
  savedCode.value = ''
  messages.value.unshift({
    question: text,
    rows: response.data.data,
    meta: response.data.meta,
    feedback: '',
  })
  clarificationId.value = response.data.meta.clarification_required
    ? String(response.data.meta.query_id)
    : ''
  question.value = ''
}
watch(
  user,
  () => {
    ++generation
    products.value = []
    messages.value = []
    code.value = ''
    resetConversation()
    if (user.value)
      void run(async () => {
        products.value = await call<Product[]>('GET', '/data-products')
      })
  },
  { immediate: true },
)
</script>

<template>
  <div class="natural-language-search">
    <p class="muted">
      Tulis pertanyaan seperti percakapan biasa. Sistem hanya memakai produk data dan field yang
      diizinkan untuk akun Anda, lalu menyusun query aman dan visualisasi yang sesuai.
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <form class="card-row" @submit.prevent="run(ask)">
      <fieldset :disabled="busy">
        <label>
          Ruang data (opsional)
          <select v-model="code">
            <option value="">Biarkan sistem menentukan</option>
            <option v-for="product in products" :key="product.id" :value="product.code">
              {{ product.name }} · {{ product.code }}
            </option>
          </select>
        </label>
        <p v-if="savedCode" class="notice">
          Template dipilih: {{ savedCode }}. Kirim pertanyaan untuk menjalankannya.
        </p>
        <p v-if="clarificationId" class="notice">
          Lengkapi pertanyaan dengan detail yang diminta pada hasil terakhir.
        </p>
        <label>
          {{ clarificationId ? 'Pertanyaan yang diperjelas' : 'Pertanyaan Anda' }}
          <textarea
            v-model="question"
            required
            minlength="3"
            maxlength="2000"
            rows="4"
            placeholder="Contoh: tampilkan tren penjualan per bulan untuk tahun ini"
          />
        </label>
        <div class="toolbar">
          <button class="primary">
            {{
              busy
                ? 'Menganalisis data…'
                : clarificationId
                  ? 'Kirim klarifikasi'
                  : 'Tanyakan data'
            }}
          </button>
          <button v-if="clarificationId" type="button" @click="resetConversation">
            Mulai pertanyaan baru
          </button>
        </div>
        <div class="toolbar" aria-label="Contoh pertanyaan">
          <button
            v-for="example in examples"
            :key="example"
            type="button"
            :disabled="busy"
            @click="useExample(example)"
          >
            {{ example }}
          </button>
        </div>
      </fieldset>
    </form>

    <article v-for="(message, index) in messages" :key="index" class="panel">
      <h3>{{ message.question }}</h3>
      <p v-if="message.meta.clarification_required" class="notice">
        {{ message.meta.question }}
      </p>
      <div
        v-if="
          message.meta.clarification_required && String(message.meta.query_id) === clarificationId
        "
        class="toolbar"
      >
        <button
          v-for="candidate in candidates(message.meta)"
          :key="candidate.code"
          type="button"
          :disabled="busy"
          @click="chooseTemplate(candidate, message.question)"
        >
          Pilih {{ candidate.code }} · {{ candidate.data_product_code }}
        </button>
        <p v-if="message.meta.template_candidates_more" class="muted">
          Hanya 20 kandidat pertama ditampilkan. Pilih ruang data atau perjelas pertanyaan.
        </p>
      </div>
      <template v-if="!message.meta.clarification_required">
        <ResultChart
          v-if="message.rows.length"
          :rows="message.rows"
          :visualization="visualization(message.meta)"
          @change="message.meta.visualization = $event"
        />
        <DataTable :rows="message.rows" />
        <p v-if="!message.rows.length" class="notice">Query berhasil tanpa baris hasil.</p>
        <p class="muted">
          {{ message.meta.route || 'NL2SQL' }} · cache
          {{ message.meta.cached ? 'ya' : 'tidak' }} · AI
          {{ message.meta.openai_called ? 'dipanggil' : 'tidak dipanggil' }}
        </p>
      </template>
      <details v-if="message.meta.query_id">
        <summary>Detail dan umpan balik</summary>
        <QueryRequestDetail :id="String(message.meta.query_id)" />
        <form
          @submit.prevent="
            run(async () => {
              await call('POST', `/nl2sql/requests/${message.meta.query_id}/feedback`, {
                feedback: message.feedback,
              })
              notice = 'Umpan balik tersimpan.'
            })
          "
        >
          <label>
            Umpan balik
            <textarea v-model="message.feedback" required maxlength="1000" />
          </label>
          <button :disabled="busy">Kirim umpan balik</button>
        </form>
      </details>
    </article>
  </div>
</template>