<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import DataTable from '@/components/DataTable.vue'
import { call, user, editRoles, reviewRoles } from '@/lib/etl'
import { useTask } from '@/lib/tasks'
import type { Master, MasterDependencyPlan, ReferenceOrphanResult } from '@/lib/masters'
const { busy, error, notice, run } = useTask()
const search = ref(''),
  offset = ref(0),
  masters = ref<Master[]>([]),
  dependencyPlan = ref<MasterDependencyPlan | null>(null),
  orphanResult = ref<ReferenceOrphanResult | null>(null)
const canRead = computed(() => [...editRoles, ...reviewRoles].includes(user.value?.role || ''))
const editor = computed(() => editRoles.includes(user.value?.role || ''))
const dependencyRows = computed(
  () => (dependencyPlan.value?.edges || []) as Record<string, unknown>[],
)
const orphanRows = computed(
  () =>
    (orphanResult.value?.items || []).map((item) => ({
      ...item,
      orphan_values: item.orphan_values?.join(', ') || '',
    })) as Record<string, unknown>[],
)
async function load(next = 0) {
  const result = await call<Master[]>(
    'GET',
    `/master-definitions?search=${encodeURIComponent(search.value)}&offset=${next}&limit=50`,
  )
  masters.value = result
  offset.value = next
}
async function loadReferenceChecks() {
  const result = await Promise.all([
    call<MasterDependencyPlan>('GET', '/master-definitions/dependency-plan'),
    call<ReferenceOrphanResult>('GET', '/master-definitions/reference-orphans'),
  ])
  dependencyPlan.value = result[0]
  orphanResult.value = result[1]
  notice.value = 'Rencana dependency dan pemeriksaan orphan telah dimuat.'
}
watch(
  user,
  () => {
    masters.value = []
    dependencyPlan.value = null
    orphanResult.value = null
    offset.value = 0
    search.value = ''
    if (canRead.value) void run(() => load())
  },
  { immediate: true },
)
</script>
<template>
  <EtlShell
    ><p class="eyebrow">REGISTRY MASTER</p>
    <h1>Definisi master</h1>
    <p class="notice">
      Registry menyimpan definisi dan binding. Storage dan pencarian record tersedia; pemuatan data
      master dilakukan melalui batch review import.
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <section class="panel">
      <form class="toolbar" @submit.prevent="run(() => load())">
        <label>Cari kode, nama, atau alias<input v-model="search" /></label
        ><button :disabled="busy">Cari master</button
        ><RouterLink v-if="editor" class="button primary" to="/masters/new"
          >Buat definisi master</RouterLink
        >
      </form>
      <p v-if="busy" role="status">Memuat registry…</p>
      <p v-else-if="!masters.length">Tidak ada definisi pada halaman ini.</p>
      <article v-for="master in masters" :key="master.id" class="card-row">
        <h2>{{ master.name }} · {{ master.code }}</h2>
        <p>
          {{ master.status }} · revisi {{ master.revision_no }} · versi approved
          {{ master.approved_version }} · {{ master.is_active ? 'Aktif' : 'Nonaktif' }}
        </p>
        <p v-if="master.approved_definition_json" class="muted">
          Nama approved: {{ master.approved_definition_json.name }}
        </p>
        <RouterLink class="button" :to="`/masters/${master.id}`"
          >Buka definisi {{ master.code }}</RouterLink
        >
        <RouterLink
          v-if="master.is_active && master.approved_version > 0"
          class="button"
          :to="`/masters/${master.id}/storage`"
          >Storage &amp; record {{ master.code }}</RouterLink
        >
      </article>
      <div class="toolbar">
        <button :disabled="busy || offset === 0" @click="run(() => load(Math.max(0, offset - 50)))">
          Master sebelumnya</button
        ><button :disabled="busy || masters.length < 50" @click="run(() => load(offset + 50))">
          Master berikutnya
        </button>
      </div>
      <p class="muted">Halaman maksimal 50 definisi; bukan total seluruh registry.</p>
    </section>
    <section class="panel">
      <h2>Dependency dan referensi master</h2>
      <p class="muted">
        Pemeriksaan ini hanya membaca binding yang sudah APPROVED. Hasil tidak membuat foreign key
        atau mengubah data.
      </p>
      <button :disabled="busy" @click="run(loadReferenceChecks)">
        Periksa dependency dan orphan
      </button>
      <template v-if="dependencyPlan">
        <p :class="dependencyPlan.execution_ready ? 'success' : 'notice'">
          {{
            dependencyPlan.execution_ready
              ? 'Rencana siap dieksekusi'
              : 'Rencana belum siap dieksekusi'
          }}
          {{ dependencyPlan.blocking_reason ? ` · ${dependencyPlan.blocking_reason}` : '' }}
          {{ dependencyPlan.has_cycle ? ' · siklus terdeteksi' : '' }}
        </p>
        <DataTable :rows="dependencyRows" />
      </template>
      <template v-if="orphanResult">
        <p :class="orphanResult.execution_ready ? 'success' : 'notice'">
          {{
            orphanResult.execution_ready
              ? 'Tidak ada orphan pada binding yang diperiksa'
              : 'Ada referensi yang perlu ditinjau'
          }}
        </p>
        <DataTable :rows="orphanRows" />
      </template></section
  ></EtlShell>
</template>
