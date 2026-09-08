<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EtlShell from '@/components/EtlShell.vue'
import DataTable from '@/components/DataTable.vue'
import { call, user, editRoles, reviewRoles, type Job } from '@/lib/etl'
import { useTask } from '@/lib/tasks'
import type { Row } from '@/lib/catalog'
const { busy, error, notice, run } = useTask()
const route = useRoute(),
  router = useRouter()
const jobs = ref<Job[]>([]),
  sources = ref<Row[]>([]),
  runs = ref<Row[]>([])
const offset = ref(0),
  runOffset = ref(0),
  selected = ref<Job | null>(null),
  jobId = ref('')
const runDetail = ref<Row | null>(null),
  runErrors = ref<Row[]>([]),
  lineage = ref<Row | null>(null),
  lineageOffset = ref(0)
const monitoring = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0
const canRead = computed(() => [...editRoles, ...reviewRoles].includes(user.value?.role || ''))
const editor = computed(() => editRoles.includes(user.value?.role || ''))
const retryAllowed = computed(
  () =>
    selected.value?.status === 'FAILED' &&
    (['DEPLOY', 'ROLLBACK'].includes(selected.value.kind || '') ? reviewRoles : editRoles).includes(
      user.value?.role || '',
    ),
)
function stop() {
  generation++
  clearTimeout(timer)
  monitoring.value = false
}
async function load() {
  const result = await Promise.all([
    call<Job[]>('GET', `/jobs?offset=${offset.value}&limit=25`),
    call<Row[]>('GET', '/etl-jobs'),
    call<Row[]>('GET', `/etl-runs?offset=${runOffset.value}&limit=25`),
  ])
  jobs.value = result[0]
  sources.value = result[1]
  runs.value = result[2]
}
async function monitor(id: string) {
  stop()
  selected.value = null
  jobId.value = id
  await router.replace({ query: { job: id } })
  const epoch = generation,
    deadline = Date.now() + 120_000
  monitoring.value = true
  async function poll() {
    if (epoch !== generation) return
    try {
      const result = await call<Job>('GET', `/jobs/${encodeURIComponent(id)}`)
      if (epoch !== generation) return
      selected.value = result
      if (!['QUEUED', 'RUNNING'].includes(result.status)) {
        monitoring.value = false
        await load()
        return
      }
      if (Date.now() >= deadline) {
        monitoring.value = false
        notice.value =
          'Batas pemantauan dua menit tercapai. Job tetap berjalan; lanjutkan memantau dengan ID yang sama.'
        return
      }
      timer = setTimeout(() => {
        void poll().catch((e) => {
          if (epoch === generation)
            error.value = e instanceof Error ? e.message : 'Pemantauan gagal.'
        })
      }, 3000)
    } catch (e) {
      monitoring.value = false
      throw e
    }
  }
  await poll()
}
async function enqueue(path: string) {
  const result = await call<{ job_id: string }>('POST', path)
  await monitor(result.job_id)
}
async function detail(id: string) {
  lineageOffset.value = 0
  const result = await Promise.all([
    call<Row>('GET', `/etl-runs/${id}`),
    call<Row[]>('GET', `/etl-runs/${id}/errors`),
    call<Row>('GET', `/etl-runs/${id}/lineage?offset=0&limit=50`),
  ])
  runDetail.value = result[0]
  runErrors.value = result[1]
  lineage.value = result[2]
}
async function lineagePage(delta: number) {
  const next = Math.max(0, lineageOffset.value + delta)
  const result = await call<Row>(
    'GET',
    `/etl-runs/${runDetail.value?.id}/lineage?offset=${next}&limit=50`,
  )
  lineage.value = result
  lineageOffset.value = next
}
watch(
  user,
  () => {
    stop()
    jobs.value = []
    sources.value = []
    runs.value = []
    selected.value = null
    runDetail.value = null
    runErrors.value = []
    lineage.value = null
    offset.value = 0
    runOffset.value = 0
    if (canRead.value)
      void run(async () => {
        await load()
        if (typeof route.query.job === 'string') await monitor(route.query.job)
      })
  },
  { immediate: true },
)
onBeforeUnmount(stop)
</script>
<template>
  <EtlShell
    ><p class="eyebrow">OPERASIONAL</p>
    <h1>Job &amp; riwayat ETL</h1>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <section class="panel">
      <h2>Pantau job</h2>
      <form class="toolbar" @submit.prevent="run(() => monitor(jobId))">
        <label>ID job<input v-model="jobId" required /></label
        ><button :disabled="busy || monitoring">Pantau / lanjutkan</button
        ><button v-if="monitoring" type="button" @click="stop">Berhenti memantau</button>
      </form>
      <p class="muted">Berhenti memantau tidak membatalkan pekerjaan di backend.</p>
      <div v-if="selected" aria-live="polite">
        <h3>{{ selected.kind }} · {{ selected.status }}</h3>
        <p>{{ selected.id }}</p>
        <p v-if="selected.status === 'QUEUED'" class="notice">
          Menunggu worker backend. API aktif tidak berarti antrean sedang diproses.
        </p>
        <p v-if="selected.status === 'FAILED'" class="error">
          {{ selected.error_code }}: {{ selected.error_message }}
        </p>
        <pre v-if="selected.result">{{ JSON.stringify(selected.result, null, 2) }}</pre>
        <p v-if="selected.status === 'SUCCEEDED'" class="muted">
          Periksa hasil setiap tab: CHANGE_DETECTED atau SKIPPED_DUPLICATE tidak berarti data baru
          berhasil dimuat.
        </p>
        <RouterLink
          v-if="
            selected.result &&
            typeof selected.result === 'object' &&
            'configuration_id' in selected.result
          "
          class="button"
          :to="`/configurations/${selected.result.configuration_id}/review`"
          >Buka konfigurasi</RouterLink
        ><button
          v-if="retryAllowed"
          :disabled="busy"
          @click="run(() => enqueue(`/jobs/${selected!.id}/retry`))"
        >
          Retry job gagal
        </button>
      </div>
    </section>
    <section class="panel">
      <h2>Daftar job</h2>
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
          :disabled="busy || jobs.length < 25"
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
      <p v-if="!jobs.length">Belum ada job pada halaman ini.</p>
      <div v-for="job in jobs" :key="job.id" class="toolbar">
        <span class="tag">{{ job.status }}</span
        ><span>{{ job.kind }} · {{ job.created_at }}</span
        ><button :disabled="busy" @click="run(() => monitor(job.id))">{{ job.id }}</button>
      </div>
    </section>
    <section class="panel">
      <h2>Jadwal sumber</h2>
      <p class="muted">
        Daftar dibatasi maksimal 100 sumber. Pause menghentikan jadwal/sync berikutnya, bukan job
        yang sedang berjalan.
      </p>
      <div v-for="source in sources" :key="String(source.id)" class="card-row">
        <h3>{{ source.name }}</h3>
        <p>
          {{ source.sync_schedule || 'Tanpa jadwal' }} · {{ source.paused ? 'Dijeda' : 'Aktif' }} ·
          cron UTC
        </p>
        <div v-if="editor" class="toolbar">
          <button
            :disabled="busy || Boolean(source.paused)"
            @click="run(() => enqueue(`/etl-jobs/${source.id}/run`))"
          >
            Jalankan sync</button
          ><button
            :disabled="busy"
            @click="
              run(async () => {
                await call('POST', `/etl-jobs/${source.id}/${source.paused ? 'resume' : 'pause'}`)
                await load()
              })
            "
          >
            {{ source.paused ? 'Lanjutkan jadwal' : 'Jeda sumber' }}
          </button>
        </div>
      </div>
    </section>
    <section class="panel">
      <h2>Riwayat pemuatan</h2>
      <DataTable :rows="runs" />
      <div class="toolbar">
        <button
          :disabled="busy || runOffset === 0"
          @click="
            run(async () => {
              runOffset -= 25
              await load()
            })
          "
        >
          Run sebelumnya</button
        ><button
          :disabled="busy || runs.length < 25"
          @click="
            run(async () => {
              runOffset += 25
              await load()
            })
          "
        >
          Run berikutnya
        </button>
      </div>
      <label
        >Detail run<select
          :disabled="busy"
          @change="run(() => detail(($event.target as HTMLSelectElement).value))"
        >
          <option value="" disabled selected>Pilih run</option>
          <option v-for="item in runs" :key="String(item.id)" :value="String(item.id)">
            {{ item.id }} · {{ item.status }}
          </option>
        </select></label
      >
      <template v-if="runDetail"
        ><h3>Hasil run</h3>
        <DataTable :rows="[runDetail]" />
        <h3>Masalah baris (maksimal 100)</h3>
        <DataTable :rows="runErrors" />
        <h3>Lineage</h3>
        <pre>{{ JSON.stringify(lineage, null, 2) }}</pre>
        <div class="toolbar">
          <button :disabled="busy || lineageOffset === 0" @click="run(() => lineagePage(-50))">
            Baris sebelumnya</button
          ><button
            :disabled="
              busy || !Array.isArray(lineage?.source_rows) || lineage.source_rows.length < 50
            "
            @click="run(() => lineagePage(50))"
          >
            Baris berikutnya
          </button>
        </div></template
      >
    </section>
  </EtlShell>
</template>
