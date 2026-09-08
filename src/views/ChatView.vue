<script setup lang="ts">
import { ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import DataTable from '@/components/DataTable.vue'
import QueryRequestDetail from '@/components/QueryRequestDetail.vue'
import { api, type ApiEnvelope } from '@/lib/api'
import { call, user } from '@/lib/etl'
import { type Product, type Row } from '@/lib/catalog'
import { useTask } from '@/lib/tasks'
const { busy, error, notice, run } = useTask()
const products = ref<Product[]>([]),
  question = ref(''),
  code = ref(''),
  clarificationId = ref('')
const messages = ref<
  { question: string; rows: Row[]; meta: Record<string, unknown>; feedback: string }[]
>([])
async function ask() {
  const text = question.value.trim()
  if (text.length < 3) throw new Error('Pertanyaan minimal 3 karakter.')
  const path = clarificationId.value
    ? `/nl2sql/clarifications/${clarificationId.value}`
    : '/nl2sql/query'
  const response = await api.post<ApiEnvelope<Row[]>>(
    path,
    { question: text, data_product_code: code.value || null },
    { timeout: 90_000 },
  )
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
      <template v-else
        ><DataTable :rows="message.rows" />
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
