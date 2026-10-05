<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EtlShell from '@/components/EtlShell.vue'
import DataTable from '@/components/DataTable.vue'
import {
  call,
  user,
  editRoles,
  reviewRoles,
  type Job,
  type OperationalNotification,
  type OperationalSummary,
  type Source,
} from '@/lib/etl'
import { useTask } from '@/lib/tasks'
import type { Row } from '@/lib/catalog'
import { ensureSourceReady } from '@/lib/classification'
import { streamJsonEvents } from '@/lib/api'
const { busy, error, notice, run } = useTask()
const route = useRoute(),
  router = useRouter()
const jobs = ref<Job[]>([]),
  sources = ref<Source[]>([]),
  runs = ref<Row[]>([]),
  notifications = ref<OperationalNotification[]>([]),
  summary = ref<OperationalSummary | null>(null)
const offset = ref(0),
  runOffset = ref(0),
  selected = ref<Job | null>(null),
  jobId = ref('')
const runDetail = ref<Row | null>(null),
  runErrors = ref<Row[]>([]),
  lineage = ref<Row | null>(null),
  lineageOffset = ref(0)
const monitoring = ref(false)
const editingSchedule = ref<Source | null>(null)
const scheduleForm = ref({
  sync_schedule: '',
  schedule_timezone: 'UTC',
  concurrency_policy: 'QUEUE_LATEST' as Source['concurrency_policy'],
  dependency_source_ids: [] as string[],
})
let timer: ReturnType<typeof setTimeout> | undefined
let streamController: AbortController | undefined
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
  streamController?.abort()
  streamController = undefined
  monitoring.value = false
}
async function load() {
  const result = await Promise.all([
    call<Job[]>('GET', `/jobs?offset=${offset.value}&limit=25`),
    call<Source[]>('GET', '/etl-jobs'),
    call<Row[]>('GET', `/etl-runs?offset=${runOffset.value}&limit=25`),
    call<OperationalSummary>('GET', '/operations/summary'),
    call<OperationalNotification[]>(
      'GET',
      '/notifications?unacknowledged_only=true&offset=0&limit=50',
    ),
  ])
  jobs.value = result[0]
  sources.value = result[1]
  runs.value = result[2]
  summary.value = result[3]
  notifications.value = result[4]
}
async function acknowledge(notification: OperationalNotification) {
  await call('POST', `/notifications/${notification.id}/acknowledge`)
  notice.value = 'Notifikasi diakui dan audit tersimpan.'
  await load()
}
function editSchedule(source: Source) {
  editingSchedule.value = source
  scheduleForm.value = {
    sync_schedule: source.sync_schedule || '',
    schedule_timezone: source.schedule_timezone,
    concurrency_policy: source.concurrency_policy,
    dependency_source_ids: [...source.dependency_source_ids],
  }
}
async function saveSchedule() {
  if (!editingSchedule.value) return
  await call<Source>('PATCH', `/sources/${editingSchedule.value.id}/schedule`, {
    revision_no: editingSchedule.value.schedule_revision,
    sync_schedule: scheduleForm.value.sync_schedule.trim() || null,
    schedule_timezone: scheduleForm.value.schedule_timezone.trim(),
    concurrency_policy: scheduleForm.value.concurrency_policy,
    dependency_source_ids: scheduleForm.value.dependency_source_ids,
  })
  editingSchedule.value = null
  notice.value = 'Jadwal sumber diperbarui.'
  await load()
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
  streamController = new AbortController()
  let terminalReceived = false
  try {
    await streamJsonEvents<Job>(
      `/jobs/${encodeURIComponent(id)}/events`,
      async (event, result) => {
        if (epoch !== generation || event === 'timeout' || event === 'error') return
        selected.value = result
        if (event === 'complete') {
          terminalReceived = true
          monitoring.value = false
          await load()
        }
      },
      streamController.signal,
    )
    if (epoch === generation && !terminalReceived) await poll()
  } catch (failure) {
    if (epoch !== generation || (failure instanceof DOMException && failure.name === 'AbortError'))
      return
    await poll()
  } finally {
    if (epoch === generation) streamController = undefined
  }
}
async function enqueue(path: string) {
  if (path.startsWith('/etl-jobs/') && path.endsWith('/run'))
    await ensureSourceReady(path.split('/')[2]!)
  if (path.endsWith('/retry') && selected.value?.kind === 'ETL' && selected.value.source_id)
    await ensureSourceReady(selected.value.source_id)
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
    notifications.value = []
    summary.value = null
    selected.value = null
    runDetail.value = null
    runErrors.value = []
    lineage.value = null
    editingSchedule.value = null
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
      <h2>Ringkasan proses</h2>
      <div v-if="summary" class="card-row">
        <p>
          Job antre: <strong>{{ summary.jobs.QUEUED || 0 }}</strong> &middot; berjalan:
          <strong>{{ summary.jobs.RUNNING || 0 }}</strong> &middot; gagal:
          <strong>{{ summary.jobs.FAILED || 0 }}</strong>
        </p>
        <p>
          Batch perlu input: <strong>{{ summary.import_reviews.NEEDS_INPUT || 0 }}</strong> &middot;
          notifikasi belum diakui: <strong>{{ summary.unacknowledged_notifications }}</strong>
        </p>
      </div>
    </section>
    <section class="panel">
      <h2>Notifikasi operasional</h2>
      <p v-if="!notifications.length">Tidak ada notifikasi yang perlu ditindaklanjuti.</p>
      <article v-for="notification in notifications" :key="notification.id" class="card-row">
        <p>
          <span class="tag">{{ notification.severity }}</span>
          <strong>{{ notification.title }}</strong>
        </p>
        <p>{{ notification.message }}</p>
        <p class="muted">{{ notification.kind }} &middot; {{ notification.created_at }}</p>
        <div class="toolbar">
          <RouterLink
            v-if="notification.resource_type === 'IMPORT_REVIEW'"
            class="button"
            :to="`/import-reviews/${notification.resource_id}`"
            >Buka batch import</RouterLink
          >
          <RouterLink
            v-if="notification.resource_type === 'ACCESS_REQUEST'"
            class="button"
            to="/access-requests"
            >Tinjau permintaan akses</RouterLink
          >
          <button
            v-if="notification.resource_type === 'JOB'"
            :disabled="busy"
            @click="run(() => monitor(notification.resource_id))"
          >
            Pantau job
          </button>
          <button :disabled="busy" @click="run(() => acknowledge(notification))">
            Tandai sudah dibaca
          </button>
        </div>
      </article>
    </section>
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
          {{ source.sync_schedule || 'Tanpa jadwal' }} &middot;
          {{ source.paused ? 'Dijeda' : 'Aktif' }} &middot; {{ source.schedule_timezone }} &middot;
          {{ source.concurrency_policy }} &middot; revisi {{ source.schedule_revision }}
        </p>
        <p class="muted">
          Dependency:
          {{
            source.dependency_source_ids.length
              ? source.dependency_source_ids.join(', ')
              : 'tidak ada'
          }}
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
          <button :disabled="busy" @click="editSchedule(source)">Edit jadwal</button>
        </div>
        <form
          v-if="editingSchedule?.id === source.id"
          class="grid"
          @submit.prevent="run(saveSchedule)"
        >
          <label
            >Cron lima field<input v-model="scheduleForm.sync_schedule" placeholder="0 7 * * 1-5"
          /></label>
          <label
            >Timezone IANA<input
              v-model="scheduleForm.schedule_timezone"
              required
              list="schedule-timezones"
          /></label>
          <datalist id="schedule-timezones">
            <option value="UTC" />
            <option value="Asia/Jakarta" />
            <option value="Asia/Bangkok" />
          </datalist>
          <label
            >Saat job masih berjalan<select v-model="scheduleForm.concurrency_policy">
              <option value="QUEUE_LATEST">Jalankan sekali setelah job selesai</option>
              <option value="SKIP_IF_RUNNING">Lewati jadwal ini</option>
            </select></label
          >
          <label
            >Dependency upstream<select v-model="scheduleForm.dependency_source_ids" multiple>
              <option
                v-for="candidate in sources.filter((item) => item.id !== source.id)"
                :key="candidate.id"
                :value="candidate.id"
              >
                {{ candidate.name }} ({{ candidate.source_code }})
              </option>
            </select></label
          >
          <div class="toolbar">
            <button class="primary" :disabled="busy">Simpan jadwal</button>
            <button type="button" :disabled="busy" @click="editingSchedule = null">Batal</button>
          </div>
        </form>
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
