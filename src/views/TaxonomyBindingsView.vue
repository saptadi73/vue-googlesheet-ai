<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import EtlShell from '@/components/EtlShell.vue'
import { call, editRoles, reviewRoles, user, type Profile, type Sheet } from '@/lib/etl'
import type { Taxonomy, TaxonomyColumnBinding } from '@/lib/taxonomies'
import { useTask } from '@/lib/tasks'

const route = useRoute()
const { busy, error, notice, run } = useTask()
const sourceId = computed(() => String(route.params.sourceId))
const sheetId = computed(() => String(route.params.sheetId))
const sheet = ref<Sheet | null>(null)
const profile = ref<Profile | null>(null)
const taxonomies = ref<Taxonomy[]>([])
const bindings = ref<TaxonomyColumnBinding[]>([])
const sourceColumn = ref('')
const taxonomyId = ref('')
const required = ref(false)
const normalization = ref('TRIM_CASEFOLD')
const comment = ref('')

const editor = computed(() => editRoles.includes(user.value?.role || ''))
const reviewer = computed(() => reviewRoles.includes(user.value?.role || ''))
const headers = computed(
  () => profile.value?.profile_json.columns.map((column) => column.source_column) || [],
)
const selectedTaxonomy = computed(
  () => taxonomies.value.find((item) => item.id === taxonomyId.value) || null,
)
const existing = computed(
  () => bindings.value.find((binding) => binding.source_column === sourceColumn.value) || null,
)
const selectedTaxonomyReady = computed(
  () => selectedTaxonomy.value?.status === 'APPROVED' && selectedTaxonomy.value.is_active,
)

function resetForm() {
  sourceColumn.value = ''
  taxonomyId.value = ''
  required.value = false
  normalization.value = 'TRIM_CASEFOLD'
}

async function load() {
  const requested = sheetId.value
  const result = await Promise.all([
    call<Sheet[]>('GET', `/sources/${sourceId.value}/sheets`),
    call<Profile[]>('GET', `/sources/${sourceId.value}/profiling-runs`),
    call<Taxonomy[]>('GET', '/taxonomies'),
    call<TaxonomyColumnBinding[]>('GET', `/taxonomies/source-sheets/${requested}/column-bindings`),
  ])
  if (requested !== sheetId.value) return
  sheet.value = result[0].find((item) => item.id === requested) || null
  if (!sheet.value) throw new Error('Tab tidak berada pada sumber yang dipilih.')
  profile.value =
    result[1]
      .filter((item) => item.source_sheet_id === requested)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null
  taxonomies.value = result[2]
  bindings.value = result[3]
  resetForm()
}

function edit(binding: TaxonomyColumnBinding) {
  sourceColumn.value = binding.source_column
  taxonomyId.value = binding.taxonomy_id
  required.value = binding.required
  normalization.value = binding.normalization
}

function taxonomyLabel(binding: TaxonomyColumnBinding) {
  return (
    taxonomies.value.find((taxonomy) => taxonomy.id === binding.taxonomy_id)?.code ||
    binding.taxonomy_id
  )
}

async function save() {
  if (!headers.value.includes(sourceColumn.value)) {
    throw new Error('Pilih header dari profil terbaru.')
  }
  if (!selectedTaxonomyReady.value || !selectedTaxonomy.value) {
    throw new Error('Pilih taxonomy yang aktif dan sudah disetujui.')
  }
  await call<TaxonomyColumnBinding>(
    'PUT',
    `/taxonomies/source-sheets/${sheetId.value}/column-bindings`,
    {
      source_column: sourceColumn.value,
      taxonomy_id: selectedTaxonomy.value.id,
      taxonomy_version: selectedTaxonomy.value.version,
      required: required.value,
      normalization: normalization.value,
      revision_no: existing.value?.revision_no ?? 0,
    },
  )
  notice.value = 'Binding taxonomy disimpan sebagai draft dan menunggu keputusan reviewer.'
  await load()
}

async function decide(binding: TaxonomyColumnBinding, decision: 'approve' | 'reject') {
  await call<TaxonomyColumnBinding>(
    'POST',
    `/taxonomies/column-bindings/${binding.id}/${decision}`,
    { revision_no: binding.revision_no, comment: comment.value.trim() },
  )
  notice.value = `Binding taxonomy ${decision === 'approve' ? 'disetujui' : 'ditolak'}.`
  await load()
}

watch(
  [sheetId, user],
  () => {
    sheet.value = null
    profile.value = null
    taxonomies.value = []
    bindings.value = []
    resetForm()
    comment.value = ''
    if ([...editRoles, ...reviewRoles].includes(user.value?.role || '')) void run(load)
  },
  { immediate: true },
)
</script>

<template>
  <EtlShell>
    <RouterLink to="/workspace">Kembali ke Workspace ETL</RouterLink>
    <h1>Binding kolom taxonomy</h1>
    <p v-if="sheet">Tab {{ sheet.sheet_name }}</p>
    <p class="muted">
      Binding membatasi nilai kolom pada term taxonomy versi approved. Perubahan selalu kembali
      menjadi draft untuk ditinjau reviewer.
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>

    <section class="panel">
      <h2>Binding tersimpan</h2>
      <button :disabled="busy" @click="run(load)">Muat ulang binding dan versi aktif</button>
      <p v-if="!bindings.length" class="muted">Belum ada binding taxonomy untuk tab ini.</p>
      <article v-for="binding in bindings" :key="binding.id" class="card-row">
        <h3>{{ binding.source_column }}</h3>
        <p>
          {{ binding.status }} / taxonomy {{ taxonomyLabel(binding) }} v{{
            binding.taxonomy_version
          }}
          / {{ binding.required ? 'wajib' : 'opsional' }} / {{ binding.normalization }}
        </p>
        <p
          v-if="
            taxonomies.find((item) => item.id === binding.taxonomy_id)?.version !==
            binding.taxonomy_version
          "
          class="notice"
        >
          Versi binding sudah berbeda dari versi aktif. Perbarui binding dan konfigurasi, approve
          ulang, lalu gunakan batch baru.
        </p>
        <p>
          Revisi {{ binding.revision_no }} / reviewer {{ binding.approved_by || '-' }} /
          {{ binding.approved_at || '-' }}
        </p>
        <div class="toolbar">
          <button v-if="editor" :disabled="busy" @click="edit(binding)">Edit</button>
          <template v-if="reviewer && binding.status === 'DRAFT'">
            <button class="primary" :disabled="busy" @click="run(() => decide(binding, 'approve'))">
              Setujui
            </button>
            <button :disabled="busy" @click="run(() => decide(binding, 'reject'))">Tolak</button>
          </template>
        </div>
      </article>
    </section>

    <form v-if="editor" class="panel" @submit.prevent="run(save)">
      <h2>{{ existing ? 'Perbarui binding taxonomy' : 'Tambah binding taxonomy' }}</h2>
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
            >Taxonomy<select v-model="taxonomyId" required>
              <option value="" disabled>Pilih taxonomy approved</option>
              <option
                v-for="taxonomy in taxonomies"
                :key="taxonomy.id"
                :value="taxonomy.id"
                :disabled="taxonomy.status !== 'APPROVED' || !taxonomy.is_active"
              >
                {{ taxonomy.code }} / v{{ taxonomy.version }} / {{ taxonomy.status }}
              </option>
            </select></label
          >
          <label
            >Normalisasi<select v-model="normalization">
              <option value="TRIM_CASEFOLD">TRIM_CASEFOLD</option>
            </select></label
          >
        </div>
        <label class="check"
          ><input v-model="required" type="checkbox" />Nilai wajib ada pada taxonomy</label
        >
        <button class="primary" :disabled="!selectedTaxonomyReady">Simpan draft binding</button>
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
