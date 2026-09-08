<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import DataTable from '@/components/DataTable.vue'
import { call, user, type Source } from '@/lib/etl'
import { useTask } from '@/lib/tasks'
import type { Row } from '@/lib/catalog'
const { busy, error, notice, run } = useTask()
const allowed = computed(() => ['PLATFORM_ADMIN', 'DATA_STEWARD'].includes(user.value?.role || ''))
const issues = ref<Row[]>([]),
  sources = ref<Source[]>([]),
  raw = ref<Row[]>([]),
  notes = ref<Record<string, string>>({})
const offset = ref(0),
  rawOffset = ref(0),
  sourceOffset = ref(0),
  sourceId = ref(''),
  jobId = ref('')
async function load() {
  issues.value = await call<Row[]>('GET', `/data-quality/issues?offset=${offset.value}&limit=25`)
}
async function sourcePage(delta: number) {
  sourceOffset.value = Math.max(0, sourceOffset.value + delta)
  sources.value = await call<Source[]>('GET', `/sources?offset=${sourceOffset.value}&limit=100`)
}
async function quarantine(delta = 0) {
  rawOffset.value = Math.max(0, rawOffset.value + delta)
  raw.value = await call<Row[]>(
    'GET',
    `/quarantine/${sourceId.value}/rows?offset=${rawOffset.value}&limit=25`,
  )
}
async function resolve(issue: Row) {
  const resolution = notes.value[String(issue.id)]?.trim()
  if (!resolution) throw new Error('Isi catatan penyelesaian.')
  await call('POST', `/data-quality/issues/${issue.id}/resolve`, { resolution })
  await load()
  if (sourceId.value && raw.value.length) await quarantine()
  notice.value = 'Catatan tersimpan. Perubahan data dan reprocess adalah langkah terpisah.'
}
watch(sourceId, () => {
  raw.value = []
  rawOffset.value = 0
  jobId.value = ''
})
watch(
  user,
  () => {
    issues.value = []
    sources.value = []
    raw.value = []
    notes.value = {}
    sourceId.value = ''
    offset.value = 0
    rawOffset.value = 0
    sourceOffset.value = 0
    if (allowed.value)
      void run(async () => {
        await load()
        await sourcePage(0)
      })
  },
  { immediate: true },
)
</script>
<template>
  <EtlShell
    ><p class="eyebrow">KONTROL KUALITAS</p>
    <h1>Masalah &amp; karantina data</h1>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <section class="panel">
      <h2>Masalah data</h2>
      <p class="notice">
        Perbaiki data di Google Sheets terlebih dahulu. Resolve menyimpan catatan; tidak memperbaiki
        atau memuat ulang data secara otomatis.
      </p>
      <div class="toolbar">
        <button :disabled="busy" @click="run(load)">Muat ulang</button
        ><button
          :disabled="busy || offset === 0"
          @click="
            run(async () => {
              offset -= 25
              await load()
            })
          "
        >
          Sebelumnya</button
        ><button
          :disabled="busy || issues.length < 25"
          @click="
            run(async () => {
              offset += 25
              await load()
            })
          "
        >
          Berikutnya
        </button>
      </div>
      <p v-if="!issues.length">Tidak ada masalah pada halaman ini.</p>
      <article v-for="issue in issues" :key="String(issue.id)" class="card-row">
        <h3>Baris {{ issue.source_row }} · {{ issue.status }}</h3>
        <p class="muted">Sumber {{ issue.source_id }}</p>
        <pre>{{ JSON.stringify(issue.errors, null, 2) }}</pre>
        <p v-if="issue.resolution">{{ issue.resolution }}</p>
        <form v-if="issue.status !== 'RESOLVED'" @submit.prevent="run(() => resolve(issue))">
          <label
            >Catatan penyelesaian<textarea
              v-model="notes[String(issue.id)]"
              required
              maxlength="2000"
            /></label
          ><button :disabled="busy">Tandai selesai</button>
        </form>
      </article>
    </section>
    <section class="panel">
      <h2>Karantina sumber</h2>
      <label
        >Sumber<select v-model="sourceId" :disabled="busy">
          <option value="">Pilih sumber</option>
          <option v-for="source in sources" :key="source.id" :value="source.id">
            {{ source.name }}
          </option>
        </select></label
      >
      <div class="toolbar">
        <button :disabled="busy || sourceOffset === 0" @click="run(() => sourcePage(-100))">
          Sumber sebelumnya</button
        ><button :disabled="busy || sources.length < 100" @click="run(() => sourcePage(100))">
          Sumber berikutnya</button
        ><button :disabled="busy || !sourceId" @click="run(() => quarantine())">
          Tampilkan baris karantina
        </button>
      </div>
      <DataTable :rows="raw" />
      <div v-if="raw.length || rawOffset" class="toolbar">
        <button :disabled="busy || rawOffset === 0" @click="run(() => quarantine(-25))">
          Baris sebelumnya</button
        ><button :disabled="busy || raw.length < 25" @click="run(() => quarantine(25))">
          Baris berikutnya
        </button>
      </div>
      <p class="muted">
        Reprocess membaca ulang Sheet dengan konfigurasi aktif. Data yang sama dapat menghasilkan
        SKIPPED_DUPLICATE; histori masalah tetap tersimpan.
      </p>
      <button
        :disabled="busy || !sourceId"
        @click="
          run(async () => {
            const result = await call<{ job_id: string }>(
              'POST',
              `/quarantine/${sourceId}/reprocess`,
            )
            jobId = result.job_id
          })
        "
      >
        Jalankan reprocess</button
      ><RouterLink v-if="jobId" class="button" :to="{ path: '/jobs', query: { job: jobId } }"
        >Pantau job {{ jobId }}</RouterLink
      >
    </section>
  </EtlShell>
</template>
