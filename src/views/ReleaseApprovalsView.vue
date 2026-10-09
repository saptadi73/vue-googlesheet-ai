<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import PagedDataTable from '@/components/ui/PagedDataTable.vue'
import { call, user } from '@/lib/etl'
import { useTask } from '@/lib/tasks'

type Group = {
  key: string
  label: string
  unit_id: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  decided_by: string | null
  decided_at: string | null
  comment: string | null
  can_decide: boolean
}
type ReleaseItem = {
  configuration_id: string
  source_id: string
  source_name: string
  version_no: number
  status: string
  configuration_revision: number
  ready: boolean
  summary: { name: string; description: string; product_code: string; columns: { name: string; type: string }[]; metrics: string[] }
  groups: Group[]
}
const { busy, error, notice, run } = useTask()
const items = ref<ReleaseItem[]>([])
const search = ref('')
const offset = ref(0)
const limit = 25
const selectedItemId = ref('')
const selected = ref('')
const comment = ref('')
const truncated = ref(false)
const technicalChecks = ref({ schema_and_mapping: false, data_quality: false, security_and_access: false })
const columns = [
  { key: 'source', label: 'Sumber' },
  { key: 'product', label: 'Data product / revisi' },
  { key: 'approval_status', label: 'Status persetujuan' },
  { key: 'readiness', label: 'Status tayang' },
  { key: 'action', label: 'Tindakan' },
]
const filteredItems = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  if (!term) return items.value
  return items.value.filter((item) => [
    item.source_name, item.source_id, item.summary.name, item.summary.product_code,
    item.summary.description, item.status, String(item.version_no), String(item.configuration_revision),
    ...item.groups.flatMap((group) => [group.label, group.key, group.status]),
  ].some((value) => String(value || '').toLocaleLowerCase().includes(term)))
})
const pageItems = computed(() => filteredItems.value.slice(offset.value, offset.value + limit))
const tableRows = computed(() => pageItems.value.map((item) => ({
  ...item,
  approval_status: item.groups.map((group) => `${group.label}: ${group.status}`).join(' · '),
  readiness: item.ready ? 'Siap deploy' : 'Menunggu persetujuan',
})) as unknown as Record<string, unknown>[])
const selectedItem = computed(() => items.value.find((item) => item.configuration_id === selectedItemId.value) || null)

async function load() {
  const all: ReleaseItem[] = []
  const pageLimit = 100
  truncated.value = false
  for (let page = 0; page < 200; page += 1) {
    const batch = await call<ReleaseItem[]>('GET', `/release-approvals/inbox?offset=${page * pageLimit}&limit=${pageLimit}`)
    all.push(...batch)
    if (batch.length < pageLimit) break
    if (page === 199) truncated.value = true
  }
  items.value = all
  if (selectedItemId.value && !all.some((item) => item.configuration_id === selectedItemId.value)) selectedItemId.value = ''
}
async function decide(item: ReleaseItem, group: Group, decision: 'APPROVE' | 'REJECT') {
  if (!comment.value.trim()) throw new Error('Isi catatan keputusan terlebih dahulu.')
  if (group.key === 'TECHNICAL' && decision === 'APPROVE' && !Object.values(technicalChecks.value).every(Boolean))
    throw new Error('Lengkapi pemeriksaan teknis sebelum menyetujui.')
  await call('POST', `/release-approvals/configurations/${item.configuration_id}/decisions`, {
    revision_no: item.configuration_revision,
    group_type: group.key === 'TECHNICAL' ? 'TECHNICAL' : 'UNIT',
    unit_id: group.unit_id,
    decision,
    comment: comment.value.trim(),
    technical_checks: group.key === 'TECHNICAL' && decision === 'APPROVE' ? technicalChecks.value : null,
  })
  selected.value = ''
  comment.value = ''
  technicalChecks.value = { schema_and_mapping: false, data_quality: false, security_and_access: false }
  await load()
  notice.value = decision === 'APPROVE' ? 'Persetujuan rilis dicatat.' : 'Penolakan rilis dicatat.'
}
watch(search, () => { offset.value = 0 })
watch(user, () => {
  offset.value = 0
  items.value = []
  selectedItemId.value = ''
  if (user.value) void run(load)
}, { immediate: true })
</script>

<template>
  <EtlShell>
    <p class="eyebrow">PERSETUJUAN RILIS DATA</p>
    <h1>Persetujuan sebelum tayang</h1>
    <p class="muted">Cari sumber atau data product, lalu pilih revisi untuk memeriksa keputusan IT dan unit terkait. Daftar hanya menampilkan konfigurasi yang ditugaskan kepada akun Anda.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <section class="panel">
      <div class="toolbar">
        <h2>Daftar konfigurasi menunggu keputusan</h2>
        <button :disabled="busy" @click="run(load)">Muat ulang</button>
      </div>
      <p v-if="truncated" class="notice">Daftar sangat panjang dan dibatasi 20.000 konfigurasi. Gunakan pencarian atau minta filter tambahan dari admin.</p>
      <PagedDataTable
        :rows="tableRows"
        :columns="columns"
        :total="filteredItems.length"
        :offset="offset"
        :limit="limit"
        :search="search"
        :loading="busy"
        empty-text="Tidak ada konfigurasi yang cocok atau belum ada penugasan approval untuk akun Anda."
        @update:search="search = $event"
        @page="offset = $event"
      >
        <template #cell-source="{ row }">
          <strong>{{ row.source_name }}</strong><small class="muted block">{{ row.source_id }}</small>
        </template>
        <template #cell-product="{ row }">
          <span>{{ row.name }}</span><small class="muted block">{{ row.product_code || 'Kode belum ditetapkan' }} · v{{ row.version_no }} · revisi {{ row.configuration_revision }}</small>
        </template>
        <template #cell-readiness="{ row }">
          <span>{{ row.readiness }}</span><small class="muted block">{{ row.status }}</small>
        </template>
        <template #cell-action="{ row }">
          <button type="button" :class="selectedItemId === row.configuration_id ? 'primary' : ''" @click="selectedItemId = String(row.configuration_id); selected = ''; comment = ''">
            {{ selectedItemId === row.configuration_id ? 'Dipilih' : 'Periksa' }}
          </button>
        </template>
      </PagedDataTable>
    </section>

    <section v-if="selectedItem" class="panel">
      <h2>{{ selectedItem.summary.name }} · versi {{ selectedItem.version_no }}</h2>
      <p v-if="selectedItem.status === 'SUPERSEDED'" class="notice">Versi lama; persetujuan ini diperlukan bila hendak rollback.</p>
      <p class="muted">Sumber: {{ selectedItem.source_name }} · Kode produk: {{ selectedItem.summary.product_code || 'Belum ditetapkan' }}</p>
      <p>{{ selectedItem.summary.description }}</p>
      <p><strong>Kolom:</strong> {{ selectedItem.summary.columns.map((column) => `${column.name} (${column.type})`).join(', ') || 'Belum tersedia' }}</p>
      <p v-if="selectedItem.summary.metrics.length"><strong>Metrik:</strong> {{ selectedItem.summary.metrics.join(', ') }}</p>
      <p :class="selectedItem.ready ? 'success' : 'notice'">{{ selectedItem.ready ? 'Semua persetujuan lengkap; siap deploy.' : 'Menunggu persetujuan lengkap.' }}</p>
      <div v-for="group in selectedItem.groups" :key="group.key" class="card-row">
        <div class="toolbar">
          <strong>{{ group.label }}</strong><span>{{ group.status }}</span>
          <span v-if="group.decided_at" class="muted">{{ new Date(group.decided_at).toLocaleString('id-ID') }}</span>
        </div>
        <p v-if="group.comment" class="muted">Catatan: {{ group.comment }}</p>
        <button v-if="group.can_decide" :disabled="busy" @click="selected = `${selectedItem.configuration_id}:${group.key}`; comment = ''; technicalChecks = { schema_and_mapping: false, data_quality: false, security_and_access: false }">Beri keputusan</button>
        <div v-if="selected === `${selectedItem.configuration_id}:${group.key}`">
          <div v-if="group.key === 'TECHNICAL'">
            <p class="muted">Checklist pemeriksaan teknis wajib lengkap sebelum menyetujui.</p>
            <label class="check"><input v-model="technicalChecks.schema_and_mapping" type="checkbox" />Skema dan mapping telah diperiksa</label>
            <label class="check"><input v-model="technicalChecks.data_quality" type="checkbox" />Hasil validasi dan kualitas data telah diperiksa</label>
            <label class="check"><input v-model="technicalChecks.security_and_access" type="checkbox" />Keamanan dan akses data telah diperiksa</label>
          </div>
          <label>Catatan pemeriksaan<textarea v-model="comment" maxlength="500" rows="3" required /></label>
          <div class="toolbar">
            <button class="primary" :disabled="busy || !comment.trim() || (group.key === 'TECHNICAL' && !Object.values(technicalChecks).every(Boolean))" @click="run(() => decide(selectedItem!, group, 'APPROVE'))">Setujui</button>
            <button :disabled="busy || !comment.trim()" @click="run(() => decide(selectedItem!, group, 'REJECT'))">Tolak</button>
            <button :disabled="busy" @click="selected = ''">Batal</button>
          </div>
        </div>
      </div>
    </section>
  </EtlShell>
</template>
