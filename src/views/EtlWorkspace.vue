<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import {
  call,
  user,
  editRoles,
  reviewRoles,
  type Source,
  type Sheet,
  type Config,
  type Job,
  type Profile,
} from '@/lib/etl'
import ManualDraft from '@/components/ManualDraft.vue'
import SheetClassification from '@/components/SheetClassification.vue'
import { sourceBlockers } from '@/lib/classification'
import { getApiErrorMessage } from '@/lib/api'
const sources = ref<Source[]>([]),
  sheets = ref<Sheet[]>([]),
  configs = ref<Config[]>([])
const sourceId = ref(''),
  sheetId = ref(''),
  error = ref(''),
  notice = ref(''),
  busy = ref(false),
  job = ref<Job | null>(null)
const offset = ref(0)
const registration = ref({
  source_code: '',
  name: '',
  spreadsheet_url: '',
  description: '',
  credential_ref: 'default',
  sync_schedule: '',
})
const profiles = ref<Profile[]>([])
const syncReviews = ref<unknown[] | null>(null)
const migrationPreview = ref<Record<string, unknown> | null>(null)
const selectedSheet = computed(() => sheets.value.find((s) => s.id === sheetId.value))
const currentProfile = computed(
  () =>
    profiles.value
      .filter((p) => p.source_sheet_id === sheetId.value)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0],
)
const sheetSettings = ref({ range_a1: '', header_row: 1, data_start_row: 2, enabled: true })
watch(selectedSheet, (sheet) => {
  if (sheet)
    sheetSettings.value = {
      range_a1: sheet.range_a1,
      header_row: sheet.header_row,
      data_start_row: sheet.data_start_row,
      enabled: sheet.enabled,
    }
})
const canRead = computed(() => [...editRoles, ...reviewRoles].includes(user.value?.role || ''))
const blockers = computed(() => (sourceId.value ? sourceBlockers(sheets.value) : []))
const canEdit = computed(() => !!user.value && editRoles.includes(user.value.role))
let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0
let pollDeadline = 0
async function run(action: () => Promise<void>) {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await action()
  } catch (e) {
    error.value = getApiErrorMessage(e)
  } finally {
    busy.value = false
  }
}
async function changePage(delta: number) {
  offset.value += delta
  await run(load)
}
async function load() {
  sources.value = await call<Source[]>('GET', `/sources?offset=${offset.value}&limit=50`)
}
async function selectSource() {
  sheetId.value = ''
  configs.value = []
  sheets.value = []
  profiles.value = []
  if (sourceId.value) {
    const results = await Promise.all([
      call<Sheet[]>('GET', `/sources/${sourceId.value}/sheets`),
      call<Profile[]>('GET', `/sources/${sourceId.value}/profiling-runs`),
    ])
    sheets.value = results[0]
    profiles.value = results[1]
  }
}
async function loadConfigs() {
  configs.value = sheetId.value
    ? await call<Config[]>('GET', `/source-sheets/${sheetId.value}/configurations`)
    : []
}
async function updateSheet() {
  await call('PATCH', `/source-sheets/${sheetId.value}`, sheetSettings.value)
  sheets.value = await call<Sheet[]>('GET', `/sources/${sourceId.value}/sheets`)
  profiles.value = []
}
async function syncReview() {
  const result = await call<{ reviews: unknown[] }>(
    'POST',
    `/sources/${sourceId.value}/sync-review`,
  )
  syncReviews.value = result.reviews
  notice.value =
    'Batch review dibuat untuk tab yang siap. Periksa item BLOCKED sebelum melanjutkan.'
}
async function loadMigrationPreview() {
  migrationPreview.value = await call<Record<string, unknown>>(
    'GET',
    `/sources/${sourceId.value}/master-migration-preview`,
  )
  notice.value = 'Preview migrasi master dimuat. Tidak ada perubahan data yang dilakukan.'
}
async function poll(id: string, epoch: number) {
  if (epoch !== generation || !user.value) return
  try {
    const result = await call<Job>('GET', `/jobs/${id}`)
    if (epoch !== generation) return
    job.value = result
    if (['QUEUED', 'RUNNING'].includes(result.status) && Date.now() < pollDeadline)
      timer = setTimeout(() => void poll(id, epoch), 2500)
    else if (['QUEUED', 'RUNNING'].includes(result.status))
      error.value =
        'Batas pemantauan tercapai. Buka monitor job untuk melanjutkan; jangan ulangi enqueue.'
    else {
      await load()
      if (sourceId.value)
        sheets.value = await call<Sheet[]>('GET', `/sources/${sourceId.value}/sheets`)
      if (sourceId.value)
        profiles.value = await call<Profile[]>('GET', `/sources/${sourceId.value}/profiling-runs`)
      await loadConfigs()
    }
  } catch (e) {
    error.value = getApiErrorMessage(e)
  }
}
async function enqueue(path: string, body?: unknown) {
  const result = await call<{ job_id: string; source?: Source }>('POST', path, body)
  if (result.source) sourceId.value = result.source.id
  clearTimeout(timer)
  generation++
  pollDeadline = Date.now() + 120_000
  await poll(result.job_id, generation)
}
watch(
  user,
  () => {
    generation++
    clearTimeout(timer)
    sources.value = []
    sheets.value = []
    configs.value = []
    sourceId.value = ''
    sheetId.value = ''
    job.value = null
    profiles.value = []
    syncReviews.value = null
    migrationPreview.value = null
    offset.value = 0
    if (canRead.value) void run(load)
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  generation++
  clearTimeout(timer)
})
</script>
<template>
  <EtlShell>
    <p class="eyebrow">DARI SPREADSHEET KE DATA TERVALIDASI</p>
    <h1>Workspace konfigurasi ETL</h1>
    <p class="muted">
      Hubungkan sumber, minta rekomendasi AI, lalu periksa dan ajukan konfigurasi sebelum
      menjalankan ETL.
    </p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="notice" role="status" class="success">{{ notice }}</p>
    <details v-if="canEdit" class="panel">
      <summary>Hubungkan Google Sheet baru</summary>
      <form
        @submit.prevent="
          run(() =>
            enqueue('/sources/google-sheets', {
              ...registration,
              sync_schedule: registration.sync_schedule.trim() || null,
            }),
          )
        "
      >
        <div class="grid">
          <label
            >Kode sumber<input
              v-model="registration.source_code"
              required
              pattern="[a-z][a-z0-9_]*"
              maxlength="63"
          /></label>
          <label>Nama sumber<input v-model="registration.name" required maxlength="200" /></label
          ><label
            >URL / ID spreadsheet<input v-model="registration.spreadsheet_url" required
          /></label>
        </div>
        <div class="grid">
          <label>Deskripsi<textarea v-model="registration.description" maxlength="2000" /></label
          ><label
            >Referensi kredensial backend<input
              v-model="registration.credential_ref"
              required /></label
          ><label
            >Jadwal cron UTC (opsional)<input
              v-model="registration.sync_schedule"
              placeholder="0 */6 * * *"
          /></label>
        </div>
        <p class="muted">
          Bagikan spreadsheet ke email service account backend dengan akses Viewer sebelum
          menghubungkan.
        </p>
        <button class="primary" :disabled="busy">Hubungkan &amp; profiling</button>
      </form>
    </details>
    <section class="panel">
      <h2>Pilih sumber dan tab</h2>
      <div class="grid">
        <label
          >Sumber<select v-model="sourceId" :disabled="busy" @change="run(selectSource)">
            <option value="">Pilih sumber</option>
            <option v-for="s in sources" :key="s.id" :value="s.id">
              {{ s.name }} · {{ s.status }}
            </option>
          </select></label
        >
        <label
          >Tab Google Sheet<select v-model="sheetId" :disabled="busy" @change="run(loadConfigs)">
            <option value="">Pilih tab</option>
            <option v-for="s in sheets" :key="s.id" :value="s.id">
              {{ s.sheet_name }} {{ s.last_fingerprint ? '' : '(perlu profiling)' }}
            </option>
          </select></label
        >
      </div>
      <div class="toolbar">
        <button :disabled="busy || offset === 0" @click="changePage(-50)">Sumber sebelumnya</button
        ><button :disabled="busy || sources.length < 50" @click="changePage(50)">
          Sumber berikutnya
        </button>
        <button
          :disabled="busy"
          @click="
            run(async () => {
              await load()
              await selectSource()
            })
          "
        >
          Muat ulang
        </button>
        <button
          v-if="canEdit"
          :disabled="busy || !sourceId"
          @click="run(() => enqueue(`/sources/${sourceId}/discover`))"
        >
          Temukan tab
        </button>
        <button
          v-if="canEdit"
          :disabled="busy || !sourceId"
          @click="run(() => enqueue(`/sources/${sourceId}/profile`))"
        >
          Profiling ulang
        </button>
        <button
          v-if="canEdit"
          class="primary"
          :disabled="busy || !sourceId"
          @click="run(syncReview)"
        >
          Buat batch sync review
        </button>
        <button v-if="sourceId" :disabled="busy" @click="run(loadMigrationPreview)">
          Preview migrasi master
        </button>
        <button
          v-if="canEdit"
          class="primary"
          :disabled="busy || !sheetId || !selectedSheet?.last_fingerprint || !selectedSheet.enabled"
          @click="
            run(() =>
              enqueue(`/sources/${sourceId}/ai-configurations`, { source_sheet_id: sheetId }),
            )
          "
        >
          Rekomendasikan konfigurasi AI
        </button>
      </div>
    </section>
    <section v-if="sourceId" class="panel">
      <h2>Kesiapan klasifikasi sumber</h2>
      <p v-for="blocker in blockers" :key="blocker" class="notice">{{ blocker }}</p>
      <p v-if="!blockers.length" class="success">
        Semua tab enabled telah dikonfirmasi NON_MASTER. Prasyarat data/approval tetap diperiksa
        server.
      </p>
    </section>
    <section v-if="syncReviews || migrationPreview" class="panel">
      <h2>Hasil batch dan migrasi</h2>
      <details v-if="syncReviews" open>
        <summary>Batch sync review</summary>
        <pre>{{ JSON.stringify(syncReviews, null, 2) }}</pre>
      </details>
      <details v-if="migrationPreview" open>
        <summary>Preview migrasi MASTER</summary>
        <pre>{{ JSON.stringify(migrationPreview, null, 2) }}</pre>
      </details>
    </section>
    <SheetClassification
      v-if="selectedSheet"
      :key="sheetId"
      :sheet-id="sheetId"
      :source-id="sourceId"
      :active="!!selectedSheet.active_configuration_id"
      :disabled="busy"
      @changed="
        run(async () => {
          sheets = await call<Sheet[]>('GET', `/sources/${sourceId}/sheets`)
          await loadConfigs()
        })
      "
    />
    <section v-if="selectedSheet" class="panel">
      <h2>Profil &amp; pengaturan tab</h2>
      <RouterLink
        v-if="selectedSheet.enabled && selectedSheet.last_fingerprint"
        class="button"
        to="/import-reviews"
        >Buat review batch import</RouterLink
      >
      <RouterLink
        v-if="selectedSheet.enabled && selectedSheet.last_fingerprint"
        class="button"
        :to="`/sources/${sourceId}/sheets/${selectedSheet.id}/column-bindings`"
        >Atur referensi master</RouterLink
      >
      <p v-if="!selectedSheet.last_fingerprint" class="notice">
        Tab memerlukan profiling sebelum pembuatan draft.
      </p>
      <details v-if="canEdit">
        <summary>Pengaturan pembacaan Sheet</summary>
        <form @submit.prevent="run(updateSheet)">
          <fieldset :disabled="busy || !!selectedSheet.active_configuration_id">
            <div class="grid">
              <label
                >Range A1<input
                  v-model="sheetSettings.range_a1"
                  required
                  pattern="[A-Z]+(?:1)?:[A-Z]+[0-9]*" /></label
              ><label
                >Baris header<input
                  v-model.number="sheetSettings.header_row"
                  type="number"
                  min="1"
                  max="100"
                  required /></label
              ><label
                >Awal data<input
                  v-model.number="sheetSettings.data_start_row"
                  type="number"
                  :min="sheetSettings.header_row + 1"
                  max="1000"
                  required /></label
              ><label class="check"
                ><input v-model="sheetSettings.enabled" type="checkbox" />Tab aktif</label
              >
            </div>
            <button>Simpan pengaturan tab</button>
          </fieldset>
        </form>
        <p class="muted">
          Pengaturan tidak dapat diubah jika sudah ada konfigurasi aktif. Setelah perubahan,
          jalankan profiling ulang.
        </p>
      </details>
      <template v-if="currentProfile"
        ><p>
          {{ currentProfile.profile_json.row_count }} baris · {{ currentProfile.created_at }} ·
          {{ currentProfile.status }}
        </p>
        <p v-for="warning in currentProfile.profile_json.warnings" :key="warning" class="notice">
          {{ warning }}
        </p>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Kolom sumber</th>
                <th>Tipe perkiraan</th>
                <th>Rasio kosong</th>
                <th>Rasio distinct</th>
                <th>Indikasi PII</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="column in currentProfile.profile_json.columns" :key="column.source_column">
                <td>{{ column.source_column }}</td>
                <td>{{ column.inferred_type }}</td>
                <td>{{ column.null_ratio }}</td>
                <td>{{ column.distinct_ratio }}</td>
                <td>{{ column.pii_suspected ? 'Perlu diperiksa' : 'Tidak terdeteksi' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted">
          Sampel profil disamarkan oleh backend. Profil yang ditampilkan sesuai tab terpilih.
        </p></template
      >
      <ManualDraft
        v-if="canEdit && selectedSheet.last_fingerprint && selectedSheet.enabled && currentProfile"
        :key="sheetId"
        :sheet-id="sheetId"
        :profile="currentProfile"
      />
    </section>
    <section v-if="job" class="panel" aria-live="polite">
      <h2>Proses: {{ job.status }}</h2>
      <p>{{ job.id }}</p>
      <RouterLink class="button" :to="{ path: '/jobs', query: { job: job.id } }"
        >Buka monitor job</RouterLink
      >
      <p v-if="job.status === 'QUEUED'" class="notice">
        Menunggu worker backend. Proses akan diperbarui otomatis.
      </p>
      <p v-if="job.status === 'FAILED'" class="error">
        {{ job.error_code }} {{ job.error_message || 'Proses gagal. Periksa detail job backend.' }}
      </p>
      <details v-if="job.result">
        <summary>Hasil proses</summary>
        <pre>{{ JSON.stringify(job.result, null, 2) }}</pre>
      </details>
    </section>
    <section class="panel">
      <h2>Versi konfigurasi</h2>
      <p v-if="!configs.length" class="muted">
        Pilih tab. Jika belum ada draft, jalankan rekomendasi AI setelah profiling selesai.
      </p>
      <div v-for="c in configs" :key="c.id" class="card-row toolbar">
        <strong>{{ c.configuration_json.dataset_business_name }}</strong
        ><span>v{{ c.version_no }} · revisi {{ c.revision_no }}</span
        ><span class="tag">{{ c.status }}</span
        ><RouterLink class="button primary" :to="`/configurations/${c.id}/review`"
          >Buka review</RouterLink
        >
      </div>
    </section>
  </EtlShell>
</template>
