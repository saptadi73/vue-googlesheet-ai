<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { call, editRoles, reviewRoles, user } from '@/lib/etl'
import {
  diffVersionTerms,
  validateVersionTerms,
  versionTerms,
  type Taxonomy,
  type TaxonomyVersion,
  type VersionTerm,
} from '@/lib/taxonomies'
import { useTask } from '@/lib/tasks'
import DataTable from './DataTable.vue'

const props = defineProps<{ taxonomy: Taxonomy; currentTerms: VersionTerm[] }>()
const emit = defineEmits<{ published: []; editing: [value: boolean] }>()
const { busy, error, notice, run } = useTask()
const items = ref<TaxonomyVersion[]>([]),
  more = ref(false),
  offset = ref(0)
const selected = ref<TaxonomyVersion | null>(null)
const terms = ref<VersionTerm[]>([])
const comment = ref('')
const editor = computed(() => editRoles.includes(user.value?.role || ''))
const reviewer = computed(() => reviewRoles.includes(user.value?.role || ''))
const editable = computed(
  () => editor.value && props.taxonomy.is_active && selected.value?.status === 'DRAFT',
)
const changes = computed(() =>
  diffVersionTerms(
    selected.value ? versionTerms(selected.value.definition_json.terms) : [],
    terms.value,
  ),
)
const dirty = computed(() => changes.value.length > 0)
watch([dirty, busy], () => emit('editing', dirty.value || busy.value))
watch(dirty, () => {
  reviewed.value = false
})
onBeforeRouteLeave(
  () => !dirty.value || window.confirm('Perubahan versi belum disimpan. Tinggalkan halaman ini?'),
)
function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
const publicationChanges = computed(() =>
  diffVersionTerms(versionTerms(props.currentTerms), terms.value),
)
const reviewed = ref(false)
const knownIds = computed(
  () => new Set(selected.value?.definition_json.terms.map((term) => term.id)),
)

async function history(next = 0) {
  const page = await call<{ items: TaxonomyVersion[]; has_more: boolean }>(
    'GET',
    `/taxonomies/${props.taxonomy.id}/versions?offset=${next}&limit=50`,
  )
  items.value = page.items
  more.value = page.has_more
  offset.value = next
}
function setVersion(version: TaxonomyVersion) {
  selected.value = version
  terms.value = versionTerms(version.definition_json.terms)
  reviewed.value = false
}
async function open(id: string) {
  if (dirty.value)
    throw new Error('Simpan perubahan atau batalkan edit sebelum membuka snapshot lain.')
  setVersion(await call<TaxonomyVersion>('GET', `/taxonomies/versions/${id}`))
}
async function create() {
  if (dirty.value) throw new Error('Simpan perubahan draft terlebih dahulu.')
  const result = await call<TaxonomyVersion>('POST', `/taxonomies/${props.taxonomy.id}/versions`, {
    base_version: props.taxonomy.version,
  })
  await open(result.id)
  await history()
}
function add() {
  terms.value.push({
    id: crypto.randomUUID(),
    code: '',
    label: '',
    parent_id: null,
    aliases: [],
    is_active: true,
  })
}
async function save() {
  if (!selected.value || !editable.value) return
  validateVersionTerms(terms.value, selected.value.definition_json.terms)
  const id = selected.value.id
  await call('PUT', `/taxonomies/versions/${id}`, {
    revision_no: selected.value.revision_no,
    terms: versionTerms(terms.value),
  })
  setVersion(await call<TaxonomyVersion>('GET', `/taxonomies/versions/${id}`))
  await history(offset.value)
  notice.value = 'Seluruh term draft tersimpan. Tinjau snapshot sebelum publikasi.'
}
async function publish() {
  if (!selected.value || dirty.value || !reviewed.value) return
  const id = selected.value.id
  reviewed.value = false
  await call('POST', `/taxonomies/versions/${id}/approve`, {
    revision_no: selected.value.revision_no,
    comment: comment.value.trim(),
  })
  setVersion(await call<TaxonomyVersion>('GET', `/taxonomies/versions/${id}`))
  await history()
  notice.value =
    'Versi dipublikasikan. Perbarui binding dan konfigurasi ke versi aktif, approve ulang, lalu gunakan batch baru.'
  emit('published')
}
</script>
<template>
  <section class="panel">
    <h3>Versi taxonomy</h3>
    <p>
      Snapshot terbit immutable. Term yang dihilangkan akan dinonaktifkan; UUID dan kode term lama
      tetap. Publikasi membuat binding versi lama perlu diperbarui.
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <div class="toolbar">
      <button :disabled="busy" @click="run(() => history())">Muat riwayat versi</button>
      <button
        v-if="editor && taxonomy.is_active && taxonomy.status === 'APPROVED'"
        :disabled="busy || dirty"
        @click="run(create)"
      >
        Buat draft versi berikutnya
      </button>
    </div>
    <button
      v-for="item in items"
      :key="item.id"
      :disabled="busy || dirty"
      @click="run(() => open(item.id))"
    >
      Versi {{ item.version }} / {{ item.status }} / revisi {{ item.revision_no }}
    </button>
    <div v-if="items.length" class="toolbar">
      <button
        :disabled="busy || offset === 0"
        @click="run(() => history(Math.max(0, offset - 50)))"
      >
        Versi sebelumnya
      </button>
      <button :disabled="busy || !more" @click="run(() => history(offset + 50))">
        Versi berikutnya
      </button>
    </div>
    <template v-if="selected">
      <h4>
        Snapshot {{ selected.version }} / {{ selected.status }} / revisi {{ selected.revision_no }}
      </h4>
      <p>
        Base version {{ selected.base_version }} / reviewer {{ selected.approved_by || '-' }} /
        {{ selected.approved_at || '-' }}
      </p>
      <button
        :disabled="busy"
        @click="
          run(async () =>
            setVersion(await call<TaxonomyVersion>('GET', `/taxonomies/versions/${selected!.id}`)),
          )
        "
      >
        Muat ulang snapshot / batalkan edit lokal
      </button>
      <fieldset :disabled="busy || !editable">
        <article v-for="(term, index) in terms" :key="term.id" class="card-row">
          <p>UUID {{ term.id }}</p>
          <div class="grid">
            <label
              >Kode term<input v-model="term.code" :disabled="knownIds.has(term.id)" required
            /></label>
            <label>Label term<input v-model="term.label" required /></label>
            <label
              >Parent term<select v-model="term.parent_id">
                <option :value="null">Root</option>
                <option
                  v-for="parent in terms.filter((item) => item.id !== term.id)"
                  :key="parent.id"
                  :value="parent.id"
                >
                  {{ parent.label || parent.code }}
                </option>
              </select></label
            >
          </div>
          <label
            >Alias term (satu per baris)<textarea
              :value="term.aliases.join('\n')"
              @input="
                term.aliases = ($event.target as HTMLTextAreaElement).value
                  .split('\n')
                  .map((alias) => alias.trim())
                  .filter(Boolean)
              "
            />
          </label>
          <label><input v-model="term.is_active" type="checkbox" />Term aktif</label>
          <button @click="terms.splice(index, 1)">Hilangkan term dari versi</button>
        </article>
        <button @click="add">Tambah term versi</button>
      </fieldset>
      <template v-if="dirty"
        ><h4>Perubahan yang akan disimpan</h4>
        <DataTable :rows="changes"
      /></template>
      <button v-if="editable" :disabled="busy || !dirty" @click="run(save)">
        Simpan seluruh term draft
      </button>
      <template v-if="reviewer && taxonomy.is_active && selected.status === 'DRAFT'">
        <h4>Perubahan terhadap registry aktif</h4>
        <DataTable :rows="publicationChanges" />
        <label
          >Catatan publikasi<textarea v-model="comment" maxlength="2000" :disabled="busy" />
        </label>
        <label
          ><input v-model="reviewed" type="checkbox" :disabled="busy || dirty" />Saya telah meninjau
          snapshot draft ini</label
        >
        <button :disabled="busy || dirty || !reviewed" @click="run(publish)">
          Publikasikan versi taxonomy
        </button>
      </template>
    </template>
  </section>
</template>
