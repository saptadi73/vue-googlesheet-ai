<script setup lang="ts">
import { ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
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
const offset = ref(0)
const selected = ref('')
const comment = ref('')
const technicalChecks = ref({ schema_and_mapping: false, data_quality: false, security_and_access: false })

async function load() {
  items.value = await call<ReleaseItem[]>('GET', `/release-approvals/inbox?offset=${offset.value}&limit=50`)
}
async function changePage(direction: -1 | 1) {
  offset.value = Math.max(0, offset.value + direction * 50)
  selected.value = ''
  await load()
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
watch(user, () => {
  offset.value = 0
  items.value = []
  if (user.value) void run(load)
}, { immediate: true })
</script>

<template>
  <EtlShell>
    <p class="eyebrow">PERSETUJUAN RILIS DATA</p>
    <h1>Persetujuan sebelum tayang</h1>
    <p class="muted">Periksa ringkasan data dan catatan teknis/bisnis. Pemeriksa IT dan setiap unit terkait harus menyetujui revisi yang sama sebelum deploy.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <div class="toolbar">
      <button :disabled="busy" @click="run(load)">Muat ulang</button>
      <button :disabled="busy || offset === 0" @click="run(() => changePage(-1))">Sebelumnya</button>
      <button :disabled="busy || items.length < 50" @click="run(() => changePage(1))">Berikutnya</button>
    </div>
    <p v-if="!items.length && !busy" class="notice">Belum ada konfigurasi approved yang menunggu persetujuan Anda.</p>
    <section v-for="item in items" :key="item.configuration_id" class="panel">
      <h2>{{ item.summary.name }} · versi {{ item.version_no }}</h2>
      <p v-if="item.status === 'SUPERSEDED'" class="notice">Versi lama; persetujuan ini diperlukan bila hendak rollback.</p>
      <p class="muted">Sumber: {{ item.source_name }} · Kode produk: {{ item.summary.product_code || 'Belum ditetapkan' }}</p>
      <p>{{ item.summary.description }}</p>
      <p><strong>Kolom:</strong> {{ item.summary.columns.map((column) => `${column.name} (${column.type})`).join(', ') || 'Belum tersedia' }}</p>
      <p v-if="item.summary.metrics.length"><strong>Metrik:</strong> {{ item.summary.metrics.join(', ') }}</p>
      <p :class="item.ready ? 'success' : 'notice'">{{ item.ready ? 'Semua persetujuan lengkap; siap deploy.' : 'Menunggu persetujuan lengkap.' }}</p>
      <div v-for="group in item.groups" :key="group.key" class="card-row">
        <div class="toolbar">
          <strong>{{ group.label }}</strong><span>{{ group.status }}</span>
          <span v-if="group.decided_at" class="muted">{{ new Date(group.decided_at).toLocaleString('id-ID') }}</span>
        </div>
        <p v-if="group.comment" class="muted">Catatan: {{ group.comment }}</p>
        <button v-if="group.can_decide" :disabled="busy" @click="selected = `${item.configuration_id}:${group.key}`; comment = ''; technicalChecks = { schema_and_mapping: false, data_quality: false, security_and_access: false }">Beri keputusan</button>
        <div v-if="selected === `${item.configuration_id}:${group.key}`">
          <div v-if="group.key === 'TECHNICAL'">
            <p class="muted">Checklist pemeriksaan teknis wajib lengkap sebelum menyetujui.</p>
            <label class="check"><input v-model="technicalChecks.schema_and_mapping" type="checkbox" />Skema dan mapping telah diperiksa</label>
            <label class="check"><input v-model="technicalChecks.data_quality" type="checkbox" />Hasil validasi dan kualitas data telah diperiksa</label>
            <label class="check"><input v-model="technicalChecks.security_and_access" type="checkbox" />Keamanan dan akses data telah diperiksa</label>
          </div>
          <label>Catatan pemeriksaan<textarea v-model="comment" maxlength="500" rows="3" required /></label>
          <div class="toolbar">
            <button class="primary" :disabled="busy || !comment.trim() || (group.key === 'TECHNICAL' && !Object.values(technicalChecks).every(Boolean))" @click="run(() => decide(item, group, 'APPROVE'))">Setujui</button>
            <button :disabled="busy || !comment.trim()" @click="run(() => decide(item, group, 'REJECT'))">Tolak</button>
            <button :disabled="busy" @click="selected = ''">Batal</button>
          </div>
        </div>
      </div>
    </section>
  </EtlShell>
</template>
