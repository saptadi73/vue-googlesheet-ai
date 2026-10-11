<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Eye } from '@lucide/vue'
import { call, user, type ProcessAttention } from '@/lib/etl'
import { getApiErrorMessage } from '@/lib/api'
import type { ImportQuestion } from '@/lib/importReviews'

const props = defineProps<{ attention: ProcessAttention; label: string }>()
const dialog = ref<HTMLDialogElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const opened = ref(false)
const questions = ref<ImportQuestion[]>([])
const loading = ref(false)
const error = ref('')
const hasMore = ref(false)
let epoch = 0

function close() {
  const wasOpen = opened.value
  epoch++
  loading.value = false
  dialog.value?.close()
  opened.value = false
  if (wasOpen) trigger.value?.focus()
}
async function loadMore() {
  const reviewId = props.attention.review_id
  if (!reviewId || loading.value) return
  const requestEpoch = epoch
  loading.value = true
  error.value = ''
  try {
    const result = await call<{ items: ImportQuestion[]; has_more: boolean }>(
      'GET', `/import-reviews/${reviewId}/questions?status=OPEN&offset=${questions.value.length}&limit=50`,
    )
    if (requestEpoch !== epoch) return
    questions.value.push(...result.items)
    hasMore.value = result.has_more
  } catch (cause) {
    if (requestEpoch === epoch) error.value = getApiErrorMessage(cause)
  } finally {
    if (requestEpoch === epoch) loading.value = false
  }
}
async function open() {
  epoch++
  questions.value = []
  error.value = ''
  hasMore.value = false
  opened.value = true
  await nextTick()
  dialog.value?.showModal()
  await loadMore()
}
watch(() => props.attention, close)
watch(() => user.value?.id, close)
onBeforeUnmount(() => { epoch++ })
</script>

<template>
  <button ref="trigger" type="button" class="attention-button" :aria-label="`Lihat detail ${label}`" @click="open">
    <Eye :size="17" aria-hidden="true" /><span>Lihat detail</span>
  </button>
  <dialog v-if="opened" ref="dialog" class="attention-dialog" :aria-label="`Detail proses ${label}`" @cancel.prevent="close" @click="(event) => { if (event.target === dialog) close() }">
    <header><h2>Detail proses · {{ label }}</h2><button type="button" aria-label="Tutup detail proses" @click="close">Tutup</button></header>
    <p class="attention-summary" role="status">{{ attention.message }}</p>
    <dl>
      <dt>Status</dt><dd>{{ attention.status === 'NEEDS_INPUT' ? 'Menunggu tindakan — bukan sedang berjalan' : attention.status }}</dd>
      <dt v-if="attention.blocking_codes.length">Kode penghambat</dt><dd v-if="attention.blocking_codes.length">{{ attention.blocking_codes.join(', ') }}</dd>
      <dt v-if="attention.ai_coverage">Cakupan AI</dt><dd v-if="attention.ai_coverage">{{ attention.ai_coverage }}</dd>
      <dt v-if="attention.affected_row_count">Baris dengan temuan</dt><dd v-if="attention.affected_row_count">{{ attention.affected_row_count }} baris</dd>
    </dl>
    <details v-if="attention.locations?.length" open>
      <summary>Lokasi temuan yang tercatat</summary>
      <ul><li v-for="(location, index) in attention.locations" :key="index">Baris {{ location.source_row }}<span v-if="location.target_column"> · Kolom {{ location.target_column }}</span></li></ul>
      <p v-if="attention.has_more_locations">Ringkasan menampilkan 20 lokasi pertama. Detail pertanyaan di bawah dapat dimuat bertahap.</p>
    </details>
    <p v-if="attention.blocking_codes.includes('AI_REVIEW_ISSUES')">Temuan AI masih perlu diverifikasi, bukan kepastian bahwa data salah. Jika ada dugaan nama orang pada kolom non-PII, periksa mapping dan klasifikasi data pribadi sebelum melanjutkan.</p>
    <p v-if="error" class="error" role="alert">{{ error }} <button type="button" :disabled="loading" @click="loadMore">Coba lagi</button></p>
    <p v-if="loading">Memuat detail temuan…</p>
    <ol class="attention-findings">
      <li v-for="question in questions" :key="question.id">
        <strong>Baris {{ question.source_row ?? '—' }} · Kolom {{ question.target_column || question.source_column || '—' }}</strong>
        <p>{{ question.review_message || question.prompt }}</p>
      </li>
    </ol>
    <p v-if="questions.length" class="muted">Nomor baris mengacu pada baris asli Google Sheet saat snapshot dibaca, termasuk baris header. Jika Sheet sudah diedit atau disisipkan baris, periksa snapshot dan jalankan validasi ulang.</p>
    <button v-if="hasMore" type="button" :disabled="loading" @click="loadMore">Muat temuan berikutnya</button>
    <p v-if="attention.review_id && !loading && !error && !questions.length">Tidak ada pertanyaan terbuka. Periksa kode penghambat atau riwayat keputusan pada batch.</p>
    <RouterLink v-if="attention.review_id" class="button" :to="`/import-reviews/${attention.review_id}`" @click="close">Buka batch untuk tindak lanjut</RouterLink>
    <p class="muted">Membuka detail tidak menyetujui temuan dan tidak menjalankan sync.</p>
  </dialog>
</template>

<style scoped>
.attention-button { display: inline-flex; align-items: center; gap: 6px; color: #92400e; border: 1px solid #d97706; background: #fffbeb; white-space: nowrap; }
.attention-dialog { width: min(760px, calc(100vw - 32px)); max-height: 85vh; overflow: auto; padding: 24px; border: 1px solid #d97706; border-radius: 12px; }
.attention-dialog::backdrop { background: rgb(15 23 42 / 55%); }
.attention-dialog header { display: flex; justify-content: space-between; align-items: start; gap: 16px; }
.attention-dialog h2 { margin-top: 0; }
.attention-summary { border-left: 4px solid #d97706; background: #fffbeb; padding: 12px; color: #78350f; }
.attention-dialog dl { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; }
.attention-dialog dd { margin: 0; overflow-wrap: anywhere; }
.attention-findings li { padding: 8px; border-bottom: 1px solid #e2e8f0; }
.attention-findings p { overflow-wrap: anywhere; }
</style>
