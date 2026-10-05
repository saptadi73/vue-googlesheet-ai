<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Bot, Send, Trash2, X } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { getApiErrorMessage } from '@/lib/api'
import { user } from '@/lib/etl'
import { askHelp, type HelpAnswer } from '@/lib/help'

interface Message {
  id: number
  kind: 'user' | 'assistant'
  text: string
  answer?: HelpAnswer
}

const route = useRoute()
const open = ref(false)
const question = ref('')
const loading = ref(false)
const error = ref('')
const messages = ref<Message[]>([])
const trigger = ref<HTMLButtonElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)
let sequence = 0

const starterQuestions = [
  'Bagaimana alur dari Google Sheet sampai dashboard?',
  'Mengapa data saya belum muncul di dashboard?',
  'Kapan saya perlu membuat master data?',
]

async function show() {
  open.value = true
  await nextTick()
  input.value?.focus()
}

async function close() {
  open.value = false
  await nextTick()
  trigger.value?.focus()
}

async function submit(value = question.value) {
  const text = value.trim()
  if (!text || loading.value) return
  question.value = ''
  error.value = ''
  messages.value.push({ id: ++sequence, kind: 'user', text })
  loading.value = true
  try {
    const answer = await askHelp(text, route.path)
    messages.value.push({ id: ++sequence, kind: 'assistant', text: answer.answer, answer })
  } catch (failure) {
    error.value = getApiErrorMessage(failure)
  } finally {
    loading.value = false
    await nextTick()
    input.value?.focus()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (open.value && event.key === 'Escape') void close()
}

watch(user, (current) => {
  if (!current) {
    open.value = false
    messages.value = []
  }
})
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <button
    v-if="user"
    ref="trigger"
    type="button"
    class="ai-help-trigger"
    aria-label="Tanya asisten AI"
    :aria-expanded="open"
    aria-controls="ai-help-dialog"
    @click="show"
  >
    <Bot :size="20" aria-hidden="true" />
    <span>Tanya AI</span>
  </button>

  <Teleport to="body">
    <section
      v-if="open && user"
      id="ai-help-dialog"
      class="ai-help-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-help-title"
    >
      <header>
        <div>
          <p>ASISTEN PENGGUNA</p>
          <h2 id="ai-help-title">Tanya Google Sheet AI</h2>
        </div>
        <button type="button" aria-label="Tutup asisten" @click="close"><X :size="20" /></button>
      </header>

      <div class="ai-help-messages" aria-live="polite">
        <div v-if="!messages.length" class="ai-help-welcome">
          <Bot :size="30" aria-hidden="true" />
          <strong>Apa yang ingin Anda ketahui?</strong>
          <p>Saya menjawab berdasarkan panduan aplikasi dan halaman yang sedang dibuka.</p>
          <button v-for="item in starterQuestions" :key="item" type="button" @click="submit(item)">
            {{ item }}
          </button>
        </div>

        <article
          v-for="message in messages"
          :key="message.id"
          :class="['ai-help-message', message.kind]"
        >
          <strong>{{ message.kind === 'user' ? 'Anda' : 'Asisten AI' }}</strong>
          <p>{{ message.text }}</p>
          <div v-if="message.answer?.citations.length" class="ai-help-sources">
            <span>Sumber:</span>
            <span v-for="citation in message.answer.citations" :key="citation.article_id">
              {{ citation.title }}
            </span>
          </div>
          <div v-if="message.answer?.suggested_questions.length" class="ai-help-suggestions">
            <button
              v-for="suggestion in message.answer.suggested_questions"
              :key="suggestion"
              type="button"
              @click="submit(suggestion)"
            >
              {{ suggestion }}
            </button>
          </div>
        </article>
        <p v-if="loading" class="ai-help-loading">Sedang mencari panduan yang sesuai…</p>
        <p v-if="error" class="ai-help-error" role="alert">{{ error }}</p>
      </div>

      <form @submit.prevent="submit()">
        <label for="ai-help-question">Pertanyaan</label>
        <textarea
          id="ai-help-question"
          ref="input"
          v-model="question"
          rows="3"
          maxlength="2000"
          placeholder="Contoh: mengapa batch import saya belum bisa di-apply?"
          :disabled="loading"
          @keydown.ctrl.enter.prevent="submit()"
        />
        <small>Jangan masukkan password, token, API key, atau data pribadi.</small>
        <div>
          <button
            type="button"
            class="ai-help-clear"
            :disabled="!messages.length || loading"
            @click="messages = []"
          >
            <Trash2 :size="16" /> Bersihkan
          </button>
          <button
            type="submit"
            class="ai-help-send"
            :disabled="loading || question.trim().length < 3"
          >
            <Send :size="16" /> Kirim
          </button>
        </div>
      </form>
    </section>
  </Teleport>
</template>

<style scoped>
.ai-help-trigger {
  position: fixed;
  right: 1.25rem;
  bottom: 4.75rem;
  z-index: 80;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.75rem;
  padding: 0.65rem 0.9rem;
  border: 1px solid #0f766e;
  border-radius: 999px;
  background: #fff;
  color: #0f766e;
  font: inherit;
  font-weight: 750;
  box-shadow: 0 8px 24px rgb(15 23 42 / 0.18);
  cursor: pointer;
}
.ai-help-trigger:hover,
.ai-help-trigger:focus-visible {
  outline: 3px solid rgb(20 184 166 / 0.25);
  outline-offset: 2px;
}
.ai-help-panel {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 240;
  display: grid;
  grid-template-rows: auto minmax(12rem, 1fr) auto;
  width: min(28rem, calc(100vw - 2rem));
  height: min(43rem, calc(100vh - 2rem));
  overflow: hidden;
  border: 1px solid #cbd5e1;
  border-radius: 1rem;
  background: #fff;
  color: #0f172a;
  box-shadow: 0 24px 64px rgb(15 23 42 / 0.3);
}
.ai-help-panel header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.15rem;
  background: #065f46;
  color: #fff;
}
.ai-help-panel header p {
  margin: 0 0 0.2rem;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}
.ai-help-panel h2 {
  margin: 0;
  font-size: 1.15rem;
}
.ai-help-panel header button {
  align-self: center;
  border: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
}
.ai-help-messages {
  display: grid;
  align-content: start;
  gap: 0.85rem;
  overflow-y: auto;
  padding: 1rem;
  background: #f8fafc;
}
.ai-help-welcome {
  display: grid;
  gap: 0.6rem;
  justify-items: start;
  padding: 0.4rem;
}
.ai-help-welcome p,
.ai-help-message p {
  margin: 0;
  line-height: 1.55;
  white-space: pre-wrap;
}
.ai-help-welcome button,
.ai-help-suggestions button {
  border: 1px solid #a7f3d0;
  border-radius: 0.55rem;
  background: #ecfdf5;
  color: #065f46;
  padding: 0.55rem 0.7rem;
  text-align: left;
  cursor: pointer;
}
.ai-help-message {
  display: grid;
  gap: 0.45rem;
  max-width: 94%;
  padding: 0.8rem;
  border-radius: 0.75rem;
  background: #fff;
  box-shadow: 0 1px 3px rgb(15 23 42 / 0.1);
}
.ai-help-message.user {
  justify-self: end;
  background: #dcfce7;
}
.ai-help-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  color: #475569;
  font-size: 0.78rem;
}
.ai-help-sources span:not(:first-child) {
  padding: 0.15rem 0.4rem;
  border-radius: 999px;
  background: #e2e8f0;
}
.ai-help-suggestions {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.25rem;
}
.ai-help-loading {
  color: #047857;
}
.ai-help-error {
  padding: 0.7rem;
  border-left: 4px solid #dc2626;
  background: #fef2f2;
  color: #991b1b;
}
.ai-help-panel form {
  display: grid;
  gap: 0.45rem;
  padding: 0.9rem 1rem;
  border-top: 1px solid #dbe5e1;
}
.ai-help-panel form label {
  font-weight: 700;
}
.ai-help-panel textarea {
  resize: vertical;
  min-height: 4rem;
  border: 1px solid #94a3b8;
  border-radius: 0.55rem;
  padding: 0.6rem;
  font: inherit;
}
.ai-help-panel form small {
  color: #64748b;
}
.ai-help-panel form > div {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}
.ai-help-panel form button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.35rem;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.ai-help-clear {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #475569;
}
.ai-help-send {
  border: 1px solid #047857;
  background: #047857;
  color: #fff;
}
.ai-help-panel button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
@media (max-width: 640px) {
  .ai-help-trigger {
    right: 0.8rem;
    bottom: 4.2rem;
  }
  .ai-help-trigger span {
    display: none;
  }
  .ai-help-panel {
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    border-radius: 0;
  }
}
</style>
