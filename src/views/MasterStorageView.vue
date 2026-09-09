<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import EtlShell from '@/components/EtlShell.vue'
import DataTable from '@/components/DataTable.vue'
import { call, user, editRoles, reviewRoles } from '@/lib/etl'
import { useTask } from '@/lib/tasks'
import type { Master } from '@/lib/masters'
import axios from 'axios'

interface StoragePlan {
  target: string
  master_version: number
  revision_no: number
  ddl: string
  schema_policy: string
  execution_ready: false
}
interface RecordsPage {
  items: Record<string, unknown>[]
  has_more: boolean
  masked_fields: string[]
}
const route = useRoute()
const id = computed(() => String(route.params.id))
const reviewer = computed(() => reviewRoles.includes(user.value?.role || ''))
const reader = computed(() => [...editRoles, ...reviewRoles].includes(user.value?.role || ''))
const { busy, error, notice, run } = useTask()
const plan = ref<StoragePlan | null>(null)
const records = ref<RecordsPage | null>(null)
const master = ref<Master | null>(null)
const asOf = ref('')
const periodType = computed(() => {
  const definition = master.value?.approved_definition_json
  const period = definition?.policy.effective_dating
  return period ? definition?.fields.find((field) => field.name === period.valid_from_column)?.type : undefined
})
const search = ref(''),
  recordId = ref(''),
  activeOnly = ref(true),
  offset = ref(0)
const applied = ref({ search: '', recordId: '', activeOnly: true, asOf: '' })
const comment = ref(''),
  confirmed = ref(false)
let generation = 0
const base = () => `/master-definitions/${encodeURIComponent(id.value)}`
async function loadPlan() {
  const current = generation
  plan.value = null
  confirmed.value = false
  const result = await call<StoragePlan>('GET', `${base()}/storage-plan`)
  if (current === generation) plan.value = result
}
async function loadRecords(next = 0, apply = false) {
  const current = generation
  if (apply)
    applied.value = {
      search: search.value,
      recordId: recordId.value.trim(),
      activeOnly: activeOnly.value,
      asOf: periodType.value ? asOf.value : '',
    }
  const filters = applied.value
  const params = new URLSearchParams({
    search: filters.search,
    offset: String(next),
    limit: '50',
    active_only: String(filters.activeOnly),
  })
  if (filters.recordId) params.set('record_id', filters.recordId)
  if (filters.asOf) params.set('as_of', filters.asOf.length === 16 ? `${filters.asOf}:00` : filters.asOf)
  records.value = null
  let result: RecordsPage
  try {
    result = await call<RecordsPage>('GET', `${base()}/records?${params}`)
  } catch (error) {
    if (current === generation && axios.isAxiosError(error) &&
      error.response?.data?.errors?.some((issue: { code: string }) => issue.code === 'MASTER_EFFECTIVE_DATING_REQUIRED')) {
      master.value = null
      asOf.value = ''
      applied.value.asOf = ''
    }
    throw error
  }
  if (current === generation) {
    records.value = result
    offset.value = next
  }
}
async function deploy() {
  if (!reviewer.value || !plan.value || !confirmed.value) return
  const current = generation
  const revision = plan.value.revision_no
  confirmed.value = false
  records.value = null
  // Consume the reviewed plan even on failure: refresh before an explicit retry.
  plan.value = null
  const result = await call<{ storage_ready: boolean; execution_ready: false }>(
    'POST',
    `${base()}/deploy-storage`,
    { revision_no: revision, comment: comment.value.trim() },
  )
  if (current !== generation) return
  notice.value = result.storage_ready
    ? 'Storage siap. Lanjutkan import melalui halaman Batch import.'
    : 'Periksa kesiapan storage kembali.'
  await loadPlan()
  if (current === generation) await loadRecords(0)
}
let pendingLoad = false
function initialize() {
  if (!pendingLoad || busy.value || !reader.value) return
  pendingLoad = false
  const current = generation
  void run(async () => {
    const definition = await call<Master>('GET', base())
    if (current !== generation) return
    master.value = definition
    await loadPlan()
    if (current === generation && plan.value) await loadRecords()
  })
}
watch(
  [id, user],
  () => {
    ++generation
    plan.value = null
    records.value = null
    confirmed.value = false
    comment.value = ''
    search.value = ''
    master.value = null
    asOf.value = ''
    recordId.value = ''
    activeOnly.value = true
    offset.value = 0
    applied.value = { search: '', recordId: '', activeOnly: true, asOf: '' }
    pendingLoad = true
    initialize()
  },
  { immediate: true },
)
watch(busy, () => initialize())
onBeforeUnmount(() => {
  ++generation
  pendingLoad = false
})
</script>

<template>
  <EtlShell>
    <RouterLink :to="`/masters/${id}`">← Definisi master</RouterLink>
    <h1>Storage &amp; record master</h1>
    <p class="notice">
      Storage siap tidak berarti import berhasil. Jalankan preview, approval, dan apply melalui
      halaman Batch import.
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <section class="panel">
      <h2>Rencana storage</h2>
      <button :disabled="busy" @click="run(loadPlan)">Muat ulang rencana</button>
      <template v-if="plan">
        <p>Versi approved {{ plan.master_version }} · revisi registry {{ plan.revision_no }}</p>
        <p>
          Schema identik atau penambahan field nullable dapat diterapkan. Perubahan key, tipe,
          nullability, penghapusan dan field wajib memerlukan migrasi khusus.
        </p>
        <details>
          <summary>Detail teknis rencana</summary>
          <p>Target: {{ plan.target }} · {{ plan.schema_policy }}</p>
          <p>
            DDL ini menggambarkan target lengkap, bukan diff ALTER. Membaca rencana tidak membuat
            tabel.
          </p>
          <pre class="scroll">{{ plan.ddl }}</pre>
        </details>
        <form v-if="reviewer" @submit.prevent="run(deploy)">
          <label
            >Catatan deployment<textarea v-model="comment" :disabled="busy" maxlength="2000" />
          </label>
          <label
            ><input v-model="confirmed" type="checkbox" :disabled="busy" />Saya telah meninjau
            rencana versi approved ini.</label
          >
          <button class="primary" :disabled="busy || !confirmed">Deploy storage</button>
        </form>
        <p v-else class="muted">
          Deployment hanya tersedia bagi Platform Admin dan Technical Approver.
        </p>
      </template>
    </section>
    <section class="panel">
      <h2>Record kanonis</h2>
      <form class="toolbar" @submit.prevent="run(() => loadRecords(0, true))">
        <label>Cari business key atau label<input v-model="search" maxlength="200" /></label>
        <label
          >UUID record<input
            v-model="recordId"
            pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
        /></label>
        <label><input v-model="activeOnly" type="checkbox" />Hanya record aktif</label>
        <label v-if="periodType">Berlaku pada
          <input v-model="asOf" :type="periodType === 'date' ? 'date' : periodType === 'timestamp' ? 'datetime-local' : 'text'"
            step="1" maxlength="64" :disabled="busy"
            :placeholder="periodType === 'timestamptz' ? '2026-02-01T12:00:00+07:00' : ''" />
        </label>
        <button :disabled="busy">Cari record</button>
      </form>
      <p v-if="periodType" class="muted">Kosongkan tanggal untuk seluruh riwayat. Awal inklusif, akhir eksklusif.
        Status aktif terpisah dari masa berlaku. Pencarian tidak memilih record atau FK otomatis.
        <template v-if="periodType === 'timestamptz'">Gunakan ISO dengan detik dan offset eksplisit (contoh +07:00); zona browser tidak diasumsikan.</template>
      </p>
      <p v-if="busy" role="status">Memuat…</p>
      <template v-if="records">
        <p v-if="records.masked_fields.length" class="notice">
          Field disamarkan oleh backend: {{ records.masked_fields.join(', ') }}. Nilai *** pada
          field tersebut adalah placeholder, termasuk untuk null.
        </p>
        <p v-if="!records.items.length">
          Tidak ada record untuk filter ini. Storage kosong tidak membuktikan import telah
          dilakukan.
        </p>
        <DataTable v-else :rows="records.items" />
        <div class="toolbar">
          <button
            :disabled="busy || offset === 0"
            @click="run(() => loadRecords(Math.max(0, offset - 50)))"
          >
            Record sebelumnya
          </button>
          <button
            :disabled="busy || !records.has_more"
            @click="run(() => loadRecords(offset + 50))"
          >
            Record berikutnya
          </button>
        </div>
        <p class="muted">
          Offset {{ offset }}, maksimal 50 record. Urutan UUID stabil; data dapat berubah
          antarhalaman. Pencarian hanya memakai field yang boleh dilihat akun ini.
        </p>
      </template>
    </section>
  </EtlShell>
</template>
