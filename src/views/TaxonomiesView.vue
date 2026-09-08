<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import { call, editRoles, reviewRoles, user } from '@/lib/etl'
import { useTask } from '@/lib/tasks'
import type { Taxonomy, TaxonomyTerm } from '@/lib/taxonomies'

const { busy, error, notice, run } = useTask()
const taxonomies = ref<Taxonomy[]>([])
const terms = ref<TaxonomyTerm[]>([])
const selectedId = ref('')
const taxonomyForm = ref({ code: '', name: '' })
const termForm = ref({ code: '', label: '', parent_id: '', aliases: '' })
const editor = computed(() => editRoles.includes(user.value?.role || ''))
const reviewer = computed(() => reviewRoles.includes(user.value?.role || ''))
const selected = computed(
  () => taxonomies.value.find((item) => item.id === selectedId.value) || null,
)

async function load() {
  taxonomies.value = await call<Taxonomy[]>('GET', '/taxonomies')
  if (selectedId.value && !taxonomies.value.some((item) => item.id === selectedId.value)) {
    selectedId.value = ''
    terms.value = []
  }
}
async function loadTerms() {
  terms.value = selectedId.value
    ? await call<TaxonomyTerm[]>('GET', `/taxonomies/${selectedId.value}/terms`)
    : []
}
async function createTaxonomy() {
  const created = await call<Taxonomy>('POST', '/taxonomies', {
    code: taxonomyForm.value.code.trim(),
    name: taxonomyForm.value.name.trim(),
  })
  taxonomyForm.value = { code: '', name: '' }
  await load()
  selectedId.value = created.id
  notice.value = 'Taxonomy draft dibuat.'
}
async function createTerm() {
  if (!selectedId.value) return
  await call<TaxonomyTerm>('POST', `/taxonomies/${selectedId.value}/terms`, {
    code: termForm.value.code.trim(),
    label: termForm.value.label.trim(),
    parent_id: termForm.value.parent_id || null,
    aliases: termForm.value.aliases
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
  })
  termForm.value = { code: '', label: '', parent_id: '', aliases: '' }
  await loadTerms()
  notice.value = 'Term taxonomy ditambahkan.'
}
async function approve() {
  if (!selectedId.value) return
  await call<Taxonomy>('POST', `/taxonomies/${selectedId.value}/approve`)
  await load()
  notice.value = 'Taxonomy disetujui dan versi bertambah.'
}
watch(
  user,
  () => {
    taxonomies.value = []
    terms.value = []
    selectedId.value = ''
    if ([...editRoles, ...reviewRoles].includes(user.value?.role || '')) void run(load)
  },
  { immediate: true },
)
watch(selectedId, () => {
  if (user.value) void run(loadTerms)
})
</script>
<template>
  <EtlShell>
    <p class="eyebrow">TAXONOMY</p>
    <h1>Registry taxonomy</h1>
    <p class="muted">
      Registry dan term hierarkis tersedia. Binding domain, mapping otomatis, dan DQ taxonomy belum
      tersedia.
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <form v-if="editor" class="panel toolbar" @submit.prevent="run(createTaxonomy)">
      <label
        >Kode<input v-model="taxonomyForm.code" required pattern="[a-z][a-z0-9_]*" maxlength="63"
      /></label>
      <label>Nama<input v-model="taxonomyForm.name" required maxlength="200" /></label>
      <button class="primary" :disabled="busy">Buat taxonomy</button>
    </form>
    <section class="panel">
      <h2>Taxonomy tersedia</h2>
      <p v-if="!taxonomies.length" class="muted">Belum ada taxonomy.</p>
      <button
        v-for="item in taxonomies"
        :key="item.id"
        :class="selectedId === item.id ? 'primary' : ''"
        :disabled="busy"
        @click="selectedId = item.id"
      >
        {{ item.code }} / v{{ item.version }} / {{ item.status }}
      </button>
    </section>
    <section v-if="selected" class="panel">
      <h2>{{ selected.name }}</h2>
      <p>{{ selected.code }} / versi {{ selected.version }} / {{ selected.status }}</p>
      <button
        v-if="reviewer && selected.status === 'DRAFT'"
        class="primary"
        :disabled="busy"
        @click="run(approve)"
      >
        Setujui taxonomy
      </button>
      <form v-if="editor" class="panel" @submit.prevent="run(createTerm)">
        <h3>Tambah term</h3>
        <div class="grid">
          <label
            >Kode<input v-model="termForm.code" required pattern="[a-z][a-z0-9_]*" maxlength="63"
          /></label>
          <label>Label<input v-model="termForm.label" required maxlength="200" /></label>
          <label
            >Parent<select v-model="termForm.parent_id">
              <option value="">Root</option>
              <option v-for="term in terms" :key="term.id" :value="term.id">
                {{ term.label }}
              </option>
            </select></label
          >
        </div>
        <label>Alias (satu per baris)<textarea v-model="termForm.aliases" /></label>
        <button :disabled="busy">Tambah term</button>
      </form>
      <article v-for="term in terms" :key="term.id" class="card-row">
        <h3>{{ term.label }} / {{ term.code }}</h3>
        <p>Parent: {{ term.parent_id || 'root' }} / Alias: {{ term.aliases.join(', ') || '-' }}</p>
      </article>
    </section>
  </EtlShell>
</template>
