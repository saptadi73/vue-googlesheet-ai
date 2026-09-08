<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import EtlShell from '@/components/EtlShell.vue'
import SheetClassificationForm from '@/components/SheetClassification.vue'
import {
  call,
  user,
  editRoles,
  reviewRoles,
  transforms,
  type Profile,
  type Sheet,
  type SheetClassification,
} from '@/lib/etl'
import { bindingColumns, type Master, type BindingDetail } from '@/lib/masters'
import { useTask } from '@/lib/tasks'
const route = useRoute()
const { busy, error, notice, run } = useTask()
const sheetId = computed(() => String(route.params.sheetId)),
  sourceId = computed(() => String(route.params.sourceId))
const sheet = ref<Sheet | null>(null),
  classification = ref<SheetClassification | null>(null),
  detail = ref<BindingDetail | null>(null),
  profile = ref<Profile | null>(null)
const search = ref(''),
  offset = ref(0),
  masters = ref<Master[]>([]),
  masterId = ref(''),
  master = ref<Master | null>(null),
  version = ref(0)
const mapping = ref<Record<string, { source: string; transforms: string[] }>>({}),
  baseline = ref(''),
  comment = ref('')
const editor = computed(() => editRoles.includes(user.value?.role || '')),
  reviewer = computed(() => reviewRoles.includes(user.value?.role || ''))
const approved = computed(() => master.value?.approved_definition_json)
const selectionReady = computed(
  () =>
    master.value?.is_active && !!approved.value && version.value === master.value.approved_version,
)
const draftState = computed(() =>
  JSON.stringify({ masterId: masterId.value, version: version.value, mapping: mapping.value }),
)
const dirty = computed(() => !!baseline.value && draftState.value !== baseline.value)
const headers = computed(
  () => profile.value?.profile_json.columns.map((c) => c.source_column) || [],
)
const approvalReady = computed(
  () =>
    !dirty.value &&
    detail.value?.binding?.status === 'DRAFT' &&
    detail.value.validation?.valid === true &&
    detail.value.binding.created_by !== user.value?.id &&
    detail.value.binding.classification_revision === classification.value?.revision_no &&
    detail.value.binding.master_version === master.value?.approved_version &&
    master.value?.is_active &&
    detail.value.validation.snapshot_hash === detail.value.binding.snapshot_hash,
)
async function searchMasters(next = 0) {
  masters.value = await call<Master[]>(
    'GET',
    `/master-definitions?search=${encodeURIComponent(search.value)}&offset=${next}&limit=50`,
  )
  offset.value = next
}
async function selectMaster() {
  const selected = masterId.value
  master.value = null
  version.value = 0
  mapping.value = {}
  if (!selected) return
  const result = await call<Master>('GET', `/master-definitions/${selected}`)
  if (selected !== masterId.value) return
  master.value = result
  version.value = result.approved_version
  for (const field of result.approved_definition_json?.fields || [])
    mapping.value[field.name] = { source: '', transforms: [] }
}
async function load() {
  const requested = sheetId.value
  const result = await Promise.all([
    call<Sheet[]>('GET', `/sources/${sourceId.value}/sheets`),
    call<Profile[]>('GET', `/sources/${sourceId.value}/profiling-runs`),
    call<SheetClassification>('GET', `/source-sheets/${requested}/classification`),
    call<BindingDetail>('GET', `/source-sheets/${requested}/master-binding`),
  ])
  if (requested !== sheetId.value) return
  sheet.value = result[0].find((s) => s.id === requested) || null
  if (!sheet.value) throw new Error('Tab tidak berada pada sumber yang dipilih.')
  profile.value =
    result[1]
      .filter((p) => p.source_sheet_id === requested)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null
  classification.value = result[2]
  detail.value = result[3]
  mapping.value = {}
  master.value = null
  masterId.value = ''
  version.value = 0
  if (detail.value.binding) {
    const binding = detail.value.binding
    masterId.value = binding.master_definition_id
    const value = await call<Master>('GET', `/master-definitions/${binding.master_definition_id}`)
    if (requested !== sheetId.value) return
    master.value = value
    version.value = binding.master_version
    for (const column of binding.columns_json)
      mapping.value[column.target_column] = {
        source: column.source_column,
        transforms: [...column.transformation_codes],
      }
    for (const field of value.approved_definition_json?.fields || [])
      mapping.value[field.name] ??= { source: '', transforms: [] }
  }
  baseline.value = draftState.value
  await searchMasters()
}
async function save() {
  if (
    !selectionReady.value ||
    !approved.value ||
    !classification.value ||
    classification.value.dataset_kind !== 'MASTER' ||
    classification.value.status !== 'CONFIRMED'
  )
    throw new Error('Konfirmasi MASTER dan pilih versi approved aktif terbaru.')
  const columns = bindingColumns(approved.value, mapping.value)
  if (columns.some((c) => !headers.value.includes(c.source_column)))
    throw new Error('Header mapping tidak sesuai profil. Pilih ulang atau jalankan profiling.')
  await call('PUT', `/source-sheets/${sheetId.value}/master-binding`, {
    revision_no: detail.value?.binding?.revision_no ?? 0,
    master_definition_id: masterId.value,
    master_version: version.value,
    classification_revision: classification.value.revision_no,
    columns,
  })
  await load()
  notice.value =
    'Binding disimpan sebagai DRAFT. Periksa dry-run dan minta approver berbeda; data belum dimuat.'
}
async function decision(name: 'approve' | 'reject') {
  if (!detail.value?.binding || dirty.value)
    throw new Error('Simpan atau muat ulang binding sebelum keputusan.')
  await call('POST', `/source-sheets/${sheetId.value}/master-binding/${name}`, {
    revision_no: detail.value.binding.revision_no,
    comment: comment.value,
  })
  await load()
  notice.value = 'Keputusan binding tersimpan. Runtime master tetap belum tersedia.'
}
watch(
  [sheetId, user],
  () => {
    sheet.value = null
    classification.value = null
    detail.value = null
    profile.value = null
    master.value = null
    masterId.value = ''
    version.value = 0
    mapping.value = {}
    baseline.value = ''
    comment.value = ''
    search.value = ''
    masters.value = []
    if ([...editRoles, ...reviewRoles].includes(user.value?.role || '')) void run(load)
  },
  { immediate: true },
)
async function reload() {
  if (!dirty.value || window.confirm('Buang perubahan mapping dan muat ulang?')) await load()
}
function canLeave() {
  return !dirty.value || window.confirm('Perubahan binding belum disimpan. Tinggalkan halaman ini?')
}
onBeforeRouteLeave(canLeave)
onBeforeRouteUpdate(canLeave)
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>
<template>
  <EtlShell
    ><RouterLink to="/workspace">← Workspace ETL</RouterLink>
    <h1>Binding sumber ke master</h1>
    <p v-if="sheet">Tab {{ sheet.sheet_name }}</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <p v-if="busy" role="status">Memproses…</p>
    <p class="notice">
      Metadata binding tidak memberi izin pemuatan. MASTER_RUNTIME_PENDING tetap berlaku setelah
      approval.
    </p>
    <SheetClassificationForm
      v-if="sheet"
      :key="sheetId"
      :sheet-id="sheetId"
      :source-id="sourceId"
      :active="!!sheet.active_configuration_id"
      :disabled="busy || dirty"
      @changed="run(load)"
    />
    <section v-if="detail" class="panel">
      <h2>Status binding</h2>
      <p>
        {{ detail.binding?.status || 'Belum ada binding' }} · revisi binding
        {{ detail.binding?.revision_no ?? 0 }} · revisi klasifikasi
        {{ classification?.revision_no }}
      </p>
      <p :class="detail.metadata_ready ? 'success' : 'notice'">
        {{ detail.metadata_ready ? 'Metadata siap' : 'Metadata belum siap' }} ·
        {{ detail.blocking_reason }}
      </p>
      <p v-if="dirty" class="notice">Perubahan binding belum disimpan.</p>
      <button :disabled="busy" @click="run(reload)">Muat ulang binding</button>
    </section>
    <section v-if="sheet" class="panel">
      <h2>Pilih versi master approved</h2>
      <form class="toolbar" @submit.prevent="run(() => searchMasters())">
        <label>Cari master<input v-model="search" :disabled="busy" /></label
        ><button :disabled="busy">Cari registry</button
        ><RouterLink class="button" to="/masters">Buka registry</RouterLink>
      </form>
      <fieldset :disabled="busy || !editor">
        <label
          >Master tujuan<select v-model="masterId" @change="run(selectMaster)">
            <option value="">Pilih master</option>
            <option v-if="master && !masters.some((m) => m.id === master!.id)" :value="master.id">
              {{ master.code }}
            </option>
            <option
              v-for="item in masters"
              :key="item.id"
              :value="item.id"
              :disabled="!item.is_active || !item.approved_definition_json"
            >
              {{ item.code }} · approved v{{ item.approved_version }} · {{ item.status }}
            </option>
          </select></label
        >
      </fieldset>
      <div class="toolbar">
        <button :disabled="busy || offset === 0" @click="run(() => searchMasters(offset - 50))">
          Master sebelumnya</button
        ><button
          :disabled="busy || masters.length < 50"
          @click="run(() => searchMasters(offset + 50))"
        >
          Master berikutnya
        </button>
      </div>
      <template v-if="master"
        ><p>
          {{ approved?.name || master.name }} · versi dipilih {{ version }} · approved terbaru
          {{ master.approved_version }}
        </p>
        <p v-if="!selectionReady" class="notice">
          Versi master tidak tersedia atau stale. Pilih ulang versi approved terbaru dan periksa
          seluruh mapping.
        </p>
        <button
          v-if="editor && approved && master.is_active && version !== master.approved_version"
          :disabled="busy"
          @click="version = master.approved_version"
        >
          Gunakan versi approved terbaru untuk review ulang</button
        ><RouterLink class="button" :to="`/masters/${master.id}`"
          >Periksa definisi master</RouterLink
        ></template
      >
    </section>
    <form v-if="approved" class="panel" @submit.prevent="run(save)">
      <h2>Mapping terhadap snapshot approved</h2>
      <p class="muted">
        Tipe, nullability, PII, dan business key mengikuti field master. Primary key dikelola
        server.
      </p>
      <p v-if="!profile" class="notice">
        Profiling diperlukan. Jalankan profiling melalui Workspace ETL terlebih dahulu.
      </p>
      <fieldset :disabled="busy || !editor">
        <div v-for="field in approved.fields" :key="field.name" class="card-row">
          <h3>{{ field.name }}</h3>
          <p>
            {{ field.type }} · {{ field.pii_classification }} ·
            {{
              !field.nullable ||
              approved.business_key.includes(field.name) ||
              approved.label_field === field.name
                ? 'Mapping wajib'
                : 'Opsional'
            }}{{ approved.business_key.includes(field.name) ? ' · business key' : '' }}
          </p>
          <label
            >Header sumber untuk {{ field.name
            }}<select v-if="mapping[field.name]" v-model="mapping[field.name]!.source">
              <option value="">Tidak dipetakan</option>
              <option
                v-if="mapping[field.name]!.source && !headers.includes(mapping[field.name]!.source)"
                :value="mapping[field.name]!.source"
              >
                {{ mapping[field.name]!.source }} (tidak ada di profil)
              </option>
              <option v-for="header in headers" :key="header">{{ header }}</option>
            </select></label
          ><template v-if="mapping[field.name]"
            ><div
              v-for="(_, index) in mapping[field.name]!.transforms"
              :key="index"
              class="toolbar"
            >
              <label
                >Transformasi {{ index + 1
                }}<select v-model="mapping[field.name]!.transforms[index]">
                  <option v-for="transform in transforms" :key="transform">{{ transform }}</option>
                </select></label
              ><button
                type="button"
                :disabled="index === 0"
                @click="
                  mapping[field.name]!.transforms.splice(
                    index - 1,
                    0,
                    mapping[field.name]!.transforms.splice(index, 1)[0]!,
                  )
                "
              >
                Naik</button
              ><button type="button" @click="mapping[field.name]!.transforms.splice(index, 1)">
                Hapus langkah
              </button>
            </div>
            <button
              type="button"
              :disabled="mapping[field.name]!.transforms.length >= 10"
              @click="mapping[field.name]!.transforms.push('trim')"
            >
              Tambah transformasi {{ field.name }}
            </button></template
          >
        </div>
        <button
          class="primary"
          :disabled="
            !selectionReady ||
            !profile ||
            classification?.dataset_kind !== 'MASTER' ||
            classification.status !== 'CONFIRMED'
          "
        >
          Simpan binding &amp; dry-run
        </button>
      </fieldset>
    </form>
    <section v-if="detail?.validation" class="panel">
      <h2>Dry-run binding tersimpan</h2>
      <p v-if="dirty" class="notice">
        Hasil ini untuk binding tersimpan. Simpan perubahan untuk memperoleh hasil baru.
      </p>
      <p :class="detail.validation.valid ? 'success' : 'error'">
        {{ detail.validation.valid ? 'Data lolos validasi' : 'Perlu perbaikan' }} ·
        {{ detail.validation.sample_rows_valid ?? 0 }} baris valid ·
        {{ detail.validation.sample_rows_invalid ?? 0 }} bermasalah
      </p>
      <p v-for="(issue, index) in detail.validation.errors" :key="index" class="error">
        {{ issue.message }}
      </p>
      <pre v-if="detail.validation.issues?.length">{{
        JSON.stringify(detail.validation.issues, null, 2)
      }}</pre>
      <details v-if="detail.validation.row_previews?.length">
        <summary>Preview data yang sudah disamarkan</summary>
        <pre>{{ JSON.stringify(detail.validation.row_previews, null, 2) }}</pre>
      </details>
    </section>
    <section v-if="reviewer && detail?.binding?.status === 'DRAFT'" class="panel">
      <h2>Keputusan binding</h2>
      <p class="muted">
        Approver harus berbeda dari editor. Snapshot, versi master, dan klasifikasi diperiksa ulang
        oleh server.
      </p>
      <label
        >Catatan keputusan binding<textarea v-model="comment" maxlength="2000" :disabled="busy" />
      </label>
      <div class="toolbar">
        <button
          class="primary"
          :disabled="busy || !approvalReady"
          @click="run(() => decision('approve'))"
        >
          Setujui binding</button
        ><button :disabled="busy || dirty" @click="run(() => decision('reject'))">
          Tolak binding
        </button>
      </div>
    </section>
  </EtlShell>
</template>
