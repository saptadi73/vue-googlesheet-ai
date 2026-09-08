<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import { call, user, editRoles, reviewRoles } from '@/lib/etl'
import { useTask } from '@/lib/tasks'
import type { Master } from '@/lib/masters'
const { busy, error, run } = useTask()
const search = ref(''),
  offset = ref(0),
  masters = ref<Master[]>([])
const canRead = computed(() => [...editRoles, ...reviewRoles].includes(user.value?.role || ''))
const editor = computed(() => editRoles.includes(user.value?.role || ''))
async function load(next = 0) {
  const result = await call<Master[]>(
    'GET',
    `/master-definitions?search=${encodeURIComponent(search.value)}&offset=${next}&limit=50`,
  )
  masters.value = result
  offset.value = next
}
watch(
  user,
  () => {
    masters.value = []
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
      Registry menyimpan definisi dan binding. Penyimpanan serta pemuatan record master kanonis
      belum tersedia.
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
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
      </article>
      <div class="toolbar">
        <button :disabled="busy || offset === 0" @click="run(() => load(Math.max(0, offset - 50)))">
          Master sebelumnya</button
        ><button :disabled="busy || masters.length < 50" @click="run(() => load(offset + 50))">
          Master berikutnya
        </button>
      </div>
      <p class="muted">Halaman maksimal 50 definisi; bukan total seluruh registry.</p>
    </section></EtlShell
  >
</template>
