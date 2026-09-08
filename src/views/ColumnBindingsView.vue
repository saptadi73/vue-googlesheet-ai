<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import EtlShell from '@/components/EtlShell.vue'
import { call, editRoles, reviewRoles, user, type Profile, type Sheet } from '@/lib/etl'
import { type ColumnBinding, type Master } from '@/lib/masters'
import { useTask } from '@/lib/tasks'

const route = useRoute()
const { busy, error, notice, run } = useTask()
const sourceId = computed(() => String(route.params.sourceId))
const sheetId = computed(() => String(route.params.sheetId))
const sheet = ref<Sheet | null>(null)
const profile = ref<Profile | null>(null)
const bindings = ref<ColumnBinding[]>([])
const masters = ref<Master[]>([])
const master = ref<Master | null>(null)
const sourceColumn = ref('')
const masterId = ref('')
const masterField = ref('')
const masterVersion = ref(0)
const required = ref(false)
const normalization = ref('TRIM_CASEFOLD')
const cardinality = ref<ColumnBinding['cardinality']>('MANY_TO_ONE')
const comment = ref('')

const editor = computed(() => editRoles.includes(user.value?.role || ''))
const reviewer = computed(() => reviewRoles.includes(user.value?.role || ''))
const headers = computed(
  () => profile.value?.profile_json.columns.map((column) => column.source_column) || [],
)
const fields = computed(() => master.value?.approved_definition_json?.fields || [])
const existing = computed(() =>
  bindings.value.find((binding) => binding.source_column === sourceColumn.value),
)
const selectedMasterReady = computed(
  () =>
    master.value?.is_active &&
    master.value.status === 'APPROVED' &&
    masterVersion.value === master.value.approved_version,
)

function resetForm() {
  sourceColumn.value = ''
  masterId.value = ''
  master.value = null
  masterField.value = ''
  masterVersion.value = 0
  required.value = false
  normalization.value = 'TRIM_CASEFOLD'
  cardinality.value = 'MANY_TO_ONE'
}

async function loadMasters() {
  masters.value = await call<Master[]>('GET', '/master-definitions?offset=0&limit=100')
}

async function selectMaster() {
  master.value = null
  masterField.value = ''
  masterVersion.value = 0
  if (!masterId.value) return
  const selected = masterId.value
  const value = await call<Master>('GET', `/master-definitions/${selected}`)
  if (selected !== masterId.value) return
  master.value = value
  masterVersion.value = value.approved_version
}

async function load() {
  const requested = sheetId.value
  const result = await Promise.all([
    call<Sheet[]>('GET', `/sources/${sourceId.value}/sheets`),
    call<Profile[]>('GET', `/sources/${sourceId.value}/profiling-runs`),
    call<ColumnBinding[]>('GET', `/source-sheets/${requested}/column-bindings`),
    loadMasters(),
  ])
  if (requested !== sheetId.value) return
  sheet.value = result[0].find((item) => item.id === requested) || null
  if (!sheet.value) throw new Error('Tab tidak berada pada sumber yang dipilih.')
  profile.value =
    result[1]
      .filter((item) => item.source_sheet_id === requested)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null
  bindings.value = result[2]
  resetForm()
}

async function edit(binding: ColumnBinding) {
  sourceColumn.value = binding.source_column
  masterId.value = binding.master_definition_id
  required.value = binding.required
  normalization.value = binding.normalization
  cardinality.value = binding.cardinality
  await selectMaster()
  if (masterId.value === binding.master_definition_id) masterField.value = binding.master_field
}

async function save() {
  if (!headers.value.includes(sourceColumn.value))
    throw new Error('Pilih header dari profil terbaru.')
  if (!selectedMasterReady.value || !masterField.value)
    throw new Error('Pilih master approved aktif dan field tujuan.')
  await call<ColumnBinding>('PUT', `/source-sheets/${sheetId.value}/column-bindings`, {
    revision_no: existing.value?.revision_no ?? 0,
    source_column: sourceColumn.value,
    master_definition_id: masterId.value,
    master_field: masterField.value,
    master_version: masterVersion.value,
    required: required.value,
    normalization: normalization.value,
    cardinality: cardinality.value,
  })
  notice.value = 'Binding kolom disimpan sebagai draft dan menunggu keputusan reviewer.'
  await load()
}

async function decide(binding: ColumnBinding, decision: 'approve' | 'reject') {
  await call<ColumnBinding>('POST', `/column-bindings/${binding.id}/${decision}`, {
    revision_no: binding.revision_no,
    comment: comment.value.trim(),
  })
  notice.value = `Binding kolom ${decision === 'approve' ? 'disetujui' : 'ditolak'}.`
  await load()
}

watch(
  [sheetId, user],
  () => {
    sheet.value = null
    profile.value = null
    bindings.value = []
    masters.value = []
    resetForm()
    comment.value = ''
    if ([...editRoles, ...reviewRoles].includes(user.value?.role || '')) void run(load)
  },
  { immediate: true },
)
</script>

<template>
  <EtlShell>
    <RouterLink to="/workspace">← Workspace ETL</RouterLink>
    <h1>Binding kolom referensi master</h1>
    <p v-if="sheet">Tab {{ sheet.sheet_name }}</p>
    <p class="muted">
      Binding ini menyatakan kolom sumber yang merujuk record master. Ia tidak memuat atau mengubah
      data sumber.
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>

    <section class="panel">
      <h2>Binding tersimpan</h2>
      <p v-if="!bindings.length" class="muted">Belum ada binding kolom untuk tab ini.</p>
      <article v-for="binding in bindings" :key="binding.id" class="card-row">
        <h3>{{ binding.source_column }} → {{ binding.master_field }}</h3>
        <p>
          {{ binding.status }} · master {{ binding.master_definition_id }} v{{
            binding.master_version
          }}
          · {{ binding.required ? 'wajib' : 'opsional' }} · {{ binding.normalization }} ·
          {{ binding.cardinality }}
        </p>
        <div class="toolbar">
          <button v-if="editor" :disabled="busy" @click="run(() => edit(binding))">Edit</button>
          <template v-if="reviewer && binding.status === 'DRAFT'">
            <button
              class="primary"
              :disabled="busy || binding.created_by === user?.id"
              @click="run(() => decide(binding, 'approve'))"
            >
              Setujui
            </button>
            <button :disabled="busy" @click="run(() => decide(binding, 'reject'))">Tolak</button>
          </template>
        </div>
      </article>
    </section>

    <form v-if="editor" class="panel" @submit.prevent="run(save)">
      <h2>{{ existing ? 'Perbarui binding kolom' : 'Tambah binding kolom' }}</h2>
      <p v-if="!profile" class="notice">
        Profiling tab diperlukan agar header sumber dapat dipilih.
      </p>
      <fieldset :disabled="busy || !profile">
        <div class="grid">
          <label
            >Kolom sumber<select v-model="sourceColumn" required>
              <option value="" disabled>Pilih header</option>
              <option v-for="header in headers" :key="header" :value="header">{{ header }}</option>
            </select></label
          >
          <label
            >Master tujuan<select v-model="masterId" required @change="run(selectMaster)">
              <option value="" disabled>Pilih master approved</option>
              <option
                v-for="item in masters"
                :key="item.id"
                :value="item.id"
                :disabled="!item.is_active || item.status !== 'APPROVED'"
              >
                {{ item.code }} · v{{ item.approved_version }} · {{ item.status }}
              </option>
            </select></label
          >
          <label
            >Field master<select v-model="masterField" required :disabled="!selectedMasterReady">
              <option value="" disabled>Pilih field</option>
              <option v-for="field in fields" :key="field.name" :value="field.name">
                {{ field.name }} · {{ field.type }}
              </option>
            </select></label
          >
          <label
            >Normalisasi<select v-model="normalization">
              <option value="TRIM_CASEFOLD">TRIM_CASEFOLD</option>
            </select></label
          >
          <label
            >Kardinalitas<select v-model="cardinality">
              <option value="MANY_TO_ONE">MANY_TO_ONE</option>
              <option value="ONE_TO_ONE">ONE_TO_ONE</option>
            </select></label
          >
        </div>
        <label class="check"><input v-model="required" type="checkbox" />Referensi wajib ada</label>
        <button class="primary" :disabled="!selectedMasterReady || !masterField">
          Simpan draft binding
        </button>
      </fieldset>
    </form>

    <section
      v-if="reviewer && bindings.some((binding) => binding.status === 'DRAFT')"
      class="panel"
    >
      <h2>Catatan keputusan</h2>
      <label
        >Catatan reviewer<textarea v-model="comment" maxlength="2000" :disabled="busy" />
      </label>
    </section>
  </EtlShell>
</template>
