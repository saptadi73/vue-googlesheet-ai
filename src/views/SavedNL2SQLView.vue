<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import DataTable from '@/components/DataTable.vue'
import PagedDataTable from '@/components/ui/PagedDataTable.vue'
import MultiQueryChart from '@/components/charts/MultiQueryChart.vue'
import { api, type ApiEnvelope, getApiErrorMessage } from '@/lib/api'
import { user } from '@/lib/etl'
import { useTask } from '@/lib/tasks'

interface SavedCommand {
  id: string
  created_at: string
  name: string
  description: string
  question: string
  data_product_code: string
  plan: { dimensions?: string[]; metrics?: string[]; time_grain?: string }
  sql_preview: string
  run_count: number
  last_run_at: string | null
}
interface QueryResult {
  command: SavedCommand
  rows: Record<string, unknown>[]
  meta: Record<string, unknown>
}
const columns = [
  { key: 'select', label: 'Bandingkan' },
  { key: 'name', label: 'Nama perintah' },
  { key: 'product', label: 'Data product' },
  { key: 'question', label: 'Pertanyaan NL2SQL' },
  { key: 'usage', label: 'Pemakaian' },
  { key: 'actions', label: 'Tindakan' },
]
const { busy, error, notice, run } = useTask()
const items = ref<SavedCommand[]>([])
const search = ref('')
const offset = ref(0)
const limit = 20
const total = ref(0)
const loading = ref(false)
const selectedIds = ref<string[]>([])
const selectedCommands = reactive<Record<string, SavedCommand>>({})
const results = ref<QueryResult[]>([])
const activeResult = ref<QueryResult | null>(null)
const comparisonFields = reactive<Record<string, { dimension: string; metric: string }>>({})
const editTarget = ref<SavedCommand | null>(null)
const editName = ref('')
const editDescription = ref('')
const editDialog = ref<HTMLDialogElement | null>(null)
const chartSeries = ref<{ field: string; name: string }[]>([])
let generation = 0
let loadSequence = 0
let debounce: ReturnType<typeof setTimeout> | undefined

async function load() {
  const epoch = generation
  const sequence = ++loadSequence
  loading.value = true
  try {
    const response = await api.get<ApiEnvelope<{ items: SavedCommand[]; total: number }>>(
      '/nl2sql/saved-commands', { params: { q: search.value, offset: offset.value, limit } },
    )
    if (epoch !== generation || sequence !== loadSequence) return
    items.value = response.data.data.items
    total.value = response.data.data.total
    for (const command of items.value) if (selectedIds.value.includes(command.id)) selectedCommands[command.id] = command
  } finally {
    if (epoch === generation && sequence === loadSequence) loading.value = false
  }
}
function searchChanged(value: string) {
  search.value = value
  offset.value = 0
  clearTimeout(debounce)
  debounce = setTimeout(() => void load().catch((e) => (error.value = getApiErrorMessage(e))), 250)
}
watch(offset, () => void load().catch((e) => (error.value = getApiErrorMessage(e))))
watch(() => user.value?.id, () => {
  generation++
  items.value = []
  selectedIds.value = []
  for (const id of Object.keys(selectedCommands)) delete selectedCommands[id]
  results.value = []
  void load().catch((e) => (error.value = getApiErrorMessage(e)))
}, { immediate: true })
onBeforeUnmount(() => { generation++; clearTimeout(debounce) })

function toggleSelection(id: string) {
  if (selectedIds.value.includes(id)) selectedIds.value = selectedIds.value.filter((item) => item !== id)
  else if (selectedIds.value.length < 4) {
    const command = items.value.find((item) => item.id === id)
    if (command) {
      selectedCommands[id] = command
      selectedIds.value = [...selectedIds.value, id]
    }
  }
  else error.value = 'Pilih maksimal 4 perintah untuk dibandingkan.'
}
async function runCommand(command: SavedCommand) {
  const response = await api.post<ApiEnvelope<Record<string, unknown>[]>>(`/nl2sql/saved-commands/${command.id}/run`)
  activeResult.value = { command, rows: response.data.data, meta: response.data.meta }
  results.value = []
  notice.value = `“${command.name}” dijalankan tanpa memanggil AI.`
  await load()
}
async function runComparison() {
  if (selectedIds.value.length < 2) throw new Error('Pilih setidaknya dua perintah.')
  const commands = selectedIds.value.map((id) => selectedCommands[id]).filter((item): item is SavedCommand => !!item)
  const output: QueryResult[] = []
  for (const command of commands) {
    const response = await api.post<ApiEnvelope<Record<string, unknown>[]>>(`/nl2sql/saved-commands/${command.id}/run`)
    output.push({ command, rows: response.data.data, meta: response.data.meta })
  }
  results.value = output
  activeResult.value = null
  for (const result of output) {
    const fields = result.rows[0] ? Object.keys(result.rows[0]) : []
    const metrics = result.command.plan.metrics?.filter((field) => fields.includes(field)) || []
    const metric = metrics[0] || fields.find((field) => result.rows.some((row) => typeof row[field] === 'number')) || ''
    const dimension = result.command.plan.dimensions?.find((field) => fields.includes(field)) || fields.find((field) => field !== metric) || ''
    comparisonFields[result.command.id] = { dimension, metric }
  }
  notice.value = 'Semua perintah terpilih dijalankan ulang tanpa AI. Periksa kesesuaian periode dan satuan sebelum membandingkan.'
  await load()
}
function numericFields(result: QueryResult) {
  const fields = Object.keys(result.rows[0] || {})
  const planMetrics = result.command.plan.metrics || []
  const knownMetrics = planMetrics.filter((field) => fields.includes(field))
  return knownMetrics.length ? knownMetrics : fields.filter((field) => result.rows.some((row) => typeof row[field] === 'number'))
}
function setComparisonField(id: string, key: 'dimension' | 'metric', value: string) {
  const current = comparisonFields[id] || { dimension: '', metric: '' }
  comparisonFields[id] = { ...current, [key]: value }
}
function dimensionFields(result: QueryResult) {
  const fields = Object.keys(result.rows[0] || {})
  const known = (result.command.plan.dimensions || []).filter((field) => fields.includes(field))
  return known.length ? known : fields.filter((field) => !numericFields(result).includes(field))
}
const mergedRows = computed(() => {
  const merged = new Map<string, Record<string, unknown>>()
  for (const result of results.value) {
    const chosen = comparisonFields[result.command.id]
    if (!chosen?.metric) continue
    const seriesField = `${result.command.id}_${chosen.metric}`
    for (const row of result.rows) {
      const rawKey = chosen.dimension ? row[chosen.dimension] : 'Total'
      const key = String(rawKey ?? '—')
      const target = merged.get(key) || { period: key }
      target[seriesField] = row[chosen.metric]
      merged.set(key, target)
    }
  }
  return [...merged.values()]
})
const compareSeries = computed(() => results.value.flatMap((result) => {
  const chosen = comparisonFields[result.command.id]
  return chosen?.metric ? [{ field: `${result.command.id}_${chosen.metric}`, name: `${result.command.name} · ${chosen.metric}` }] : []
}))
function openEdit(command: SavedCommand) {
  editTarget.value = command
  editName.value = command.name
  editDescription.value = command.description
  editDialog.value?.showModal()
}
async function saveEdit() {
  if (!editTarget.value) return
  await api.patch(`/nl2sql/saved-commands/${editTarget.value.id}`, { name: editName.value, description: editDescription.value })
  editDialog.value?.close()
  notice.value = 'Nama dan deskripsi perintah diperbarui.'
  await load()
}
async function deleteCommand(command: SavedCommand) {
  if (!window.confirm(`Hapus perintah “${command.name}”? Query aslinya tidak dihapus.`)) return
  await api.delete(`/nl2sql/saved-commands/${command.id}`)
  selectedIds.value = selectedIds.value.filter((id) => id !== command.id)
  delete selectedCommands[command.id]
  notice.value = 'Perintah tersimpan dihapus.'
  await load()
}
function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Belum pernah'
}
const canCompare = computed(() => selectedIds.value.length >= 2 && !busy.value)
</script>

<template>
  <EtlShell>
    <p class="eyebrow">KOMANDO NL2SQL TANPA BIAYA AI ULANG</p>
    <h1>Perintah tersimpan</h1>
    <p class="muted">Simpan pertanyaan NL2SQL yang berhasil. Menjalankan perintah tersimpan akan menyusun ulang query dari plan yang aman dan tetap memeriksa akses, batas biaya, dan batas baris—tanpa meminta AI lagi.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <section class="panel">
      <h2>Koleksi perintah</h2>
      <p class="muted">Pilih 2–4 perintah untuk membandingkan hasil lintas data product. Untuk grafik yang tepat, samakan rentang tanggal, grain waktu, definisi metrik, dan satuan.</p>
      <PagedDataTable :rows="items as unknown as Record<string, unknown>[]" :columns="columns" :total="total" :offset="offset" :limit="limit" :search="search" :loading="loading" empty-text="Belum ada perintah tersimpan. Simpan dari hasil Chat data." @update:search="searchChanged" @page="offset = $event">
        <template #cell-select="{ row }">
          <input type="checkbox" :checked="selectedIds.includes(String(row.id))" :disabled="busy || (!selectedIds.includes(String(row.id)) && selectedIds.length >= 4)" :aria-label="`Pilih ${row.name} untuk perbandingan`" @change="toggleSelection(String(row.id))" />
        </template>
        <template #cell-name="{ row }"><strong>{{ row.name }}</strong><p v-if="row.description" class="muted">{{ row.description }}</p></template>
        <template #cell-product="{ row }">{{ row.data_product_code }}</template>
        <template #cell-question="{ row }"><span class="question-cell">{{ row.question }}</span></template>
        <template #cell-usage="{ row }">{{ row.run_count }} kali<br /><small>Terakhir: {{ displayDate(row.last_run_at as string | null) }}</small></template>
        <template #cell-actions="{ row }">
          <div class="toolbar action-buttons">
            <button type="button" :disabled="busy" @click="run(() => runCommand(row as unknown as SavedCommand))">Jalankan</button>
            <button type="button" :disabled="busy" @click="openEdit(row as unknown as SavedCommand)">Ubah</button>
            <button type="button" class="danger" :disabled="busy" @click="run(() => deleteCommand(row as unknown as SavedCommand))">Hapus</button>
          </div>
        </template>
      </PagedDataTable>
      <button class="primary" type="button" :disabled="!canCompare" @click="run(runComparison)">Jalankan perbandingan ({{ selectedIds.length }})</button>
    </section>

    <section v-if="activeResult" class="panel">
      <h2>Hasil: {{ activeResult.command.name }}</h2>
      <p class="muted">Sumber: {{ activeResult.command.data_product_code }} · AI dipanggil: tidak · {{ activeResult.rows.length }} baris</p>
      <DataTable :rows="activeResult.rows" />
    </section>

    <section v-if="results.length" class="panel">
      <h2>Bandingkan beberapa data product</h2>
      <p class="notice">Hasil dijajarkan berdasarkan nilai kategori yang dipilih. Pastikan format periode identik (misalnya YYYY-MM), serta metrik memiliki arti dan satuan yang sebanding. Sistem menjalankan query terpisah dengan akses masing-masing; ini bukan SQL join antar tabel.</p>
      <div v-for="result in results" :key="result.command.id" class="compare-settings">
        <h3>{{ result.command.name }} · {{ result.command.data_product_code }}</h3>
        <p class="muted">Grain tersimpan: {{ result.command.plan.time_grain || 'tidak ditentukan' }} · {{ result.rows.length }} baris</p>
        <div class="compare-controls">
          <label>Kategori / periode
            <select :value="comparisonFields[result.command.id]?.dimension || ''" @change="setComparisonField(result.command.id, 'dimension', ($event.target as HTMLSelectElement).value)">
              <option value="">Satu total</option>
              <option v-for="field in dimensionFields(result)" :key="field" :value="field">{{ field }}</option>
            </select>
          </label>
          <label>Metrik
            <select :value="comparisonFields[result.command.id]?.metric || ''" @change="setComparisonField(result.command.id, 'metric', ($event.target as HTMLSelectElement).value)">
              <option v-for="field in numericFields(result)" :key="field" :value="field">{{ field }}</option>
            </select>
          </label>
        </div>
      </div>
      <MultiQueryChart v-if="compareSeries.length" :rows="mergedRows" category-field="period" :series="compareSeries" />
      <h3>Tabel gabungan</h3>
      <DataTable :rows="mergedRows" />
      <details class="sql-details"><summary>Periksa SQL yang tersimpan</summary>
        <article v-for="result in results" :key="result.command.id"><h4>{{ result.command.name }}</h4><pre>{{ result.command.sql_preview }}</pre></article>
      </details>
    </section>

    <dialog ref="editDialog" class="edit-dialog" @close="editTarget = null">
      <form method="dialog" @submit.prevent="run(saveEdit)">
        <h2>Ubah perintah tersimpan</h2>
        <label>Nama<input v-model="editName" required maxlength="200" /></label>
        <label>Deskripsi<textarea v-model="editDescription" maxlength="2000" rows="3" /></label>
        <p class="muted">Pertanyaan asal dan SQL/plan tidak dapat diedit di sini. Ubah pertanyaan melalui Chat data dan simpan sebagai perintah baru.</p>
        <div class="toolbar"><button type="button" @click="editDialog?.close()">Batal</button><button class="primary" type="submit" :disabled="busy">Simpan</button></div>
      </form>
    </dialog>
  </EtlShell>
</template>

<style scoped>
.question-cell { display: inline-block; max-width: 280px; white-space: normal; }
.action-buttons { flex-wrap: wrap; }
.compare-settings { border-top: 1px solid var(--border, #dce7e1); padding: 12px 0; }
.compare-settings h3 { margin-bottom: 4px; }
.compare-controls { display: flex; gap: 16px; flex-wrap: wrap; }
.compare-controls label { min-width: min(280px, 100%); }
.sql-details pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f6f8f7; padding: 12px; border-radius: 8px; }
.edit-dialog { width: min(560px, calc(100% - 32px)); border: 1px solid #cbd8d1; border-radius: 16px; padding: 24px; }
.edit-dialog::backdrop { background: #08251f66; }
.edit-dialog form { display: grid; gap: 14px; }
.edit-dialog h2 { margin: 0; }
.edit-dialog .toolbar { justify-content: flex-end; }
</style>
