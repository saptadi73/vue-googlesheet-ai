<script setup lang="ts">
import { defineAsyncComponent, ref, watch, onBeforeUnmount } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import DataTable from '@/components/DataTable.vue'
import QueryRequestDetail from '@/components/QueryRequestDetail.vue'
import { api, type ApiEnvelope } from '@/lib/api'
import { call, user } from '@/lib/etl'
import { type Product, type Row, type VisualizationSpec } from '@/lib/catalog'
import { useTask } from '@/lib/tasks'
const { busy, error, notice, run } = useTask()
const ResultChart = defineAsyncComponent(() => import('@/components/charts/ResultChart.vue'))
const products = ref<Product[]>([]),
  question = ref(''),
  code = ref(''),
  clarificationId = ref('')
const messages = ref<
  { question: string; rows: Row[]; meta: Record<string, unknown>; feedback: string }[]
>([])
const savedCode = ref('')
let generation = 0
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
interface TemplateCandidate {
  code: string
  data_product_code: string
}
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
  messages.value.push({
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
    savedCode.value = ''
    messages.value = []
    products.value = []
    question.value = ''
    code.value = ''
    clarificationId.value = ''
    if (user.value)
      void run(async () => {
        products.value = await call<Product[]>('GET', '/data-products')
      })
  },
  { immediate: true },
)
</script>
<template>
  <EtlShell
    ><p class="eyebrow">ANALISIS BAHASA NATURAL</p>
    <h1>Chat data</h1>
    <p class="muted">
      Pertanyaan memakai katalog yang diizinkan untuk akun Anda. Riwayat hanya tersimpan selama
      halaman ini terbuka.
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <section v-for="(message, index) in messages" :key="index" class="panel">
      <h2>{{ message.question }}</h2>
      <p v-if="message.meta.clarification_required" class="notice">{{ message.meta.question }}</p>
      <div
        v-if="
          message.meta.clarification_required && String(message.meta.query_id) === clarificationId
        "
      >
        <button
          v-for="candidate in candidates(message.meta)"
          :key="candidate.code"
          type="button"
          :disabled="busy"
          @click="chooseTemplate(candidate, message.question)"
        >
          Pilih template {{ candidate.code }} / {{ candidate.data_product_code }}
        </button>
        <p v-if="message.meta.template_candidates_more">
          Hanya 20 kandidat pertama ditampilkan. Pilih produk atau perjelas pertanyaan untuk
          mempersempit hasil.
        </p>
      </div>
      <template v-if="!message.meta.clarification_required"
        ><ResultChart
          v-if="message.rows.length"
          :rows="message.rows"
          :visualization="visualization(message.meta)"
          @change="message.meta.visualization = $event"
        /><DataTable :rows="message.rows" />
        <p class="muted">
          {{ message.meta.route }} · cache {{ message.meta.cached ? 'ya' : 'tidak' }} · AI dipanggil
          {{ message.meta.openai_called ? 'ya' : 'tidak' }}
        </p></template
      >
      <p class="muted">Request {{ message.meta.query_id }}</p>
      <QueryRequestDetail v-if="message.meta.query_id" :id="String(message.meta.query_id)" />
      <form
        v-if="message.meta.query_id"
        @submit.prevent="
          run(async () => {
            await call('POST', `/nl2sql/requests/${message.meta.query_id}/feedback`, {
              feedback: message.feedback,
            })
            notice = 'Umpan balik tersimpan.'
          })
        "
      >
        <label>Umpan balik<textarea v-model="message.feedback" required maxlength="1000" /></label
        ><button :disabled="busy">Kirim umpan balik</button>
      </form>
    </section>
    <form class="panel" @submit.prevent="run(ask)">
      <fieldset :disabled="busy">
        <label
          >Produk data<select v-model="code">
            <option value="">Biarkan sistem menentukan</option>
            <option v-for="p in products" :key="p.id" :value="p.code">
              {{ p.name }} · {{ p.code }}
            </option>
          </select></label
        >
        <p v-if="savedCode" class="notice">
          Template dipilih: {{ savedCode }}. Kirim klarifikasi untuk menjalankan. Mengubah
          pertanyaan atau produk membatalkan pilihan.
        </p>
        <p v-if="clarificationId" class="notice">
          Tulis ulang pertanyaan lengkap beserta detail yang diminta. Jawaban klarifikasi membuat
          request baru.
        </p>
        <label
          >{{ clarificationId ? 'Pertanyaan yang diperjelas' : 'Pertanyaan Anda'
          }}<textarea v-model="question" required minlength="3" maxlength="2000" rows="4" />
        </label>
        <div class="toolbar">
          <button class="primary">
            {{
              busy
                ? 'Memproses pertanyaan…'
                : clarificationId
                  ? 'Kirim klarifikasi'
                  : 'Tanyakan data'
            }}</button
          ><button
            v-if="clarificationId"
            type="button"
            @click="
              () => {
                savedCode = ''
                clarificationId = ''
                question = ''
              }
            "
          >
            Mulai pertanyaan baru
          </button>
        </div>
      </fieldset>
    </form>
  </EtlShell>
</template>
