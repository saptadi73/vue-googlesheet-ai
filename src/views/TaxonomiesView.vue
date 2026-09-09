<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import { call, editRoles, reviewRoles, user } from '@/lib/etl'
import { useTask } from '@/lib/tasks'
import type {
  Taxonomy,
  TaxonomyTerm,
  TaxonomyResolution,
  TaxonomyRecommendations,
} from '@/lib/taxonomies'
import TaxonomyVersions from '@/components/TaxonomyVersions.vue'
import TaxonomyAISuggestions from '@/components/TaxonomyAISuggestions.vue'
import DataTable from '@/components/DataTable.vue'

const { busy, error, notice, run } = useTask()
const taxonomies = ref<Taxonomy[]>([])
const terms = ref<TaxonomyTerm[]>([])
const selectedId = ref('')
const versionEditing = ref(false)
const taxonomyForm = ref({ code: '', name: '' })
const termForm = ref({ code: '', label: '', parent_id: '', aliases: '' })
const resolveValue = ref(''),
  valuesText = ref('')
const resolution = ref<TaxonomyResolution | null>(null)
const validation = ref<{ valid: boolean; [key: string]: unknown } | null>(null)
const recommendations = ref<TaxonomyRecommendations | null>(null)
const recommendationLimit = ref(3)
async function recommend() {
  recommendations.value = null
  const values = valuesText.value.split('\n')
  if (!valuesText.value.trim() || values.length > 500)
    throw new Error('Isi 1..500 nilai, satu per baris.')
  if (
    !Number.isInteger(recommendationLimit.value) ||
    recommendationLimit.value < 1 ||
    recommendationLimit.value > 10
  )
    throw new Error('Jumlah kandidat harus 1..10.')
  recommendations.value = await call<TaxonomyRecommendations>(
    'POST',
    `/taxonomies/${selectedId.value}/recommend-terms`,
    { values, limit: recommendationLimit.value },
  )
}
async function inspectRecommendation(code: string) {
  resolveValue.value = code
  await resolve()
}
async function resolve() {
  resolution.value = null
  resolution.value = await call<TaxonomyResolution>(
    'POST',
    `/taxonomies/${selectedId.value}/resolve-term`,
    { value: resolveValue.value },
  )
}
async function validateValues() {
  validation.value = null
  validation.value = await call('POST', `/taxonomies/${selectedId.value}/validate-values`, {
    taxonomy_version: selected.value?.version,
    values: valuesText.value.split('\n'),
  })
}
async function refreshSelected() {
  recommendations.value = null
  await load()
  await loadTerms()
}
const editor = computed(() => editRoles.includes(user.value?.role || ''))
const reviewer = computed(() => reviewRoles.includes(user.value?.role || ''))
const selected = computed(
  () => taxonomies.value.find((item) => item.id === selectedId.value) || null,
)

async function load() {
  taxonomies.value = await call<Taxonomy[]>('GET', '/taxonomies')
  if (selectedId.value && !taxonomies.value.some((item) => item.id === selectedId.value)) {
    selectedId.value = ''
    versionEditing.value = false
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
  await loadTerms()
  notice.value = 'Taxonomy draft dibuat.'
}
async function createTerm() {
  if (!selectedId.value || selected.value?.status !== 'DRAFT' || !selected.value.is_active) return
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
  notice.value = `Taxonomy disetujui. Versi aktif: ${selected.value?.version}.`
}
watch(
  user,
  () => {
    taxonomies.value = []
    terms.value = []
    selectedId.value = ''
    versionEditing.value = false
    if ([...editRoles, ...reviewRoles].includes(user.value?.role || '')) void run(load)
  },
  { immediate: true },
)
watch(selectedId, () => {
  terms.value = []
  resolution.value = null
  validation.value = null
  recommendations.value = null
  termForm.value = { code: '', label: '', parent_id: '', aliases: '' }
  if (user.value) void run(loadTerms)
})
</script>
<template>
  <EtlShell>
    <p class="eyebrow">TAXONOMY</p>
    <h1>Registry taxonomy</h1>
    <p class="muted">
      Kelola kategori, hierarki, versi, dan binding kolom. Nilai valid dinormalisasi ke kode term.
      Kandidat resolver memerlukan keputusan pengguna. Halaman ini menyediakan saran kemiripan teks.
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <form v-if="editor" class="panel toolbar" @submit.prevent="run(createTaxonomy)">
      <label
        >Kode<input v-model="taxonomyForm.code" required pattern="[a-z][a-z0-9_]*" maxlength="63"
      /></label>
      <label>Nama<input v-model="taxonomyForm.name" required maxlength="200" /></label>
      <button class="primary" :disabled="busy || versionEditing">Buat taxonomy</button>
    </form>
    <section class="panel">
      <h2>Taxonomy tersedia</h2>
      <p class="muted">Daftar menampilkan maksimal 100 taxonomy.</p>
      <button :disabled="busy || versionEditing" @click="run(refreshSelected)">
        Muat ulang taxonomy aktif
      </button>
      <p v-if="!taxonomies.length" class="muted">Belum ada taxonomy.</p>
      <button
        v-for="item in taxonomies"
        :key="item.id"
        :class="selectedId === item.id ? 'primary' : ''"
        :disabled="busy || versionEditing"
        @click="selectedId = item.id"
      >
        {{ item.code }} / v{{ item.version }} / {{ item.status }}
      </button>
    </section>
    <section v-if="selected" class="panel">
      <h2>{{ selected.name }}</h2>
      <p>{{ selected.code }} / versi {{ selected.version }} / {{ selected.status }}</p>
      <p v-if="selected.approved_by">
        Reviewer {{ selected.approved_by }} / {{ selected.approved_at }}
      </p>
      <button
        v-if="reviewer && selected.status === 'DRAFT' && selected.is_active"
        class="primary"
        :disabled="busy"
        @click="run(approve)"
      >
        Setujui taxonomy
      </button>
      <form
        v-if="editor && selected.status === 'DRAFT' && selected.is_active"
        class="panel"
        @submit.prevent="run(createTerm)"
      >
        <h3>Tambah term</h3>
        <div class="grid">
          <label
            >Kode<input v-model="termForm.code" required pattern="[a-z][a-z0-9_]*" maxlength="63"
          /></label>
          <label>Label<input v-model="termForm.label" required maxlength="200" /></label>
          <label
            >Parent<select v-model="termForm.parent_id">
              <option value="">Root</option>
              <option
                v-for="term in terms.filter((item) => item.is_active)"
                :key="term.id"
                :value="term.id"
              >
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
        <p>{{ term.is_active ? 'Aktif' : 'Nonaktif' }}</p>
        <p>Parent: {{ term.parent_id || 'root' }} / Alias: {{ term.aliases.join(', ') || '-' }}</p>
      </article>
      <section v-if="selected.status === 'APPROVED' && selected.is_active" class="panel">
        <TaxonomyAISuggestions
          :taxonomy-id="selected.id"
          :taxonomy-version="selected.version"
          :values="valuesText"
          :disabled="busy"
          @confirm="(code) => run(() => inspectRecommendation(code))"
        />
        <h3>Resolver dan pemeriksaan nilai</h3>
        <form @submit.prevent="run(resolve)">
          <label>Nilai taxonomy<input v-model="resolveValue" required /></label
          ><button :disabled="busy">Cari term</button>
        </form>
        <template v-if="resolution">
          <p>
            {{ resolution.status }} /
            {{ resolution.requires_question ? 'Memerlukan keputusan pengguna' : 'Kecocokan exact' }}
          </p>
          <DataTable
            :rows="
              (resolution.term ? [resolution.term] : resolution.candidates || []).map((term) => ({
                ...term,
              }))
            "
          />
          <p v-if="resolution.requires_question">
            Kandidat tidak dipilih otomatis. Untuk batch import, jawab pertanyaan yang disediakan
            worker.
          </p>
        </template>
        <form @submit.prevent="run(validateValues)">
          <label>Nilai untuk validasi (satu per baris)<textarea v-model="valuesText" /></label
          ><button :disabled="busy">Validasi nilai taxonomy</button>
        </form>
        <form @submit.prevent="run(recommend)">
          <p>
            Saran kemiripan teks memakai daftar nilai di atas. Pilihan harus dikonfirmasi dan tidak
            mengubah konfigurasi atau staging.
          </p>
          <label
            >Jumlah kandidat per nilai<input
              v-model.number="recommendationLimit"
              type="number"
              min="1"
              max="10"
          /></label>
          <button :disabled="busy">Cari saran kemiripan</button>
        </form>
        <template v-if="recommendations">
          <p>Taxonomy versi {{ recommendations.taxonomy_version }}</p>
          <article
            v-for="(item, index) in recommendations.recommendations"
            :key="index"
            class="card-row"
          >
            <h4>Nilai: {{ item.value }}</h4>
            <p v-if="item.requires_confirmation">Memerlukan konfirmasi pengguna.</p>
            <p v-if="!item.candidates.length">Tidak ada kandidat.</p>
            <div v-for="candidate in item.candidates" :key="candidate.term.id">
              {{ candidate.term.label }} / {{ candidate.term.code }} / skor
              {{ candidate.confidence }}
              <button
                :disabled="busy || !candidate.term.is_active"
                @click="run(() => inspectRecommendation(candidate.term.code))"
              >
                Periksa kode {{ candidate.term.code }}
              </button>
            </div>
          </article>
        </template>
        <template v-if="validation"
          ><p :class="validation.valid ? 'notice' : 'error'">
            {{ validation.valid ? 'Nilai valid' : 'Nilai belum valid' }}
          </p>
          <pre>{{ JSON.stringify(validation, null, 2) }}</pre>
        </template>
      </section>
      <TaxonomyVersions
        v-if="selected.status === 'APPROVED'"
        :key="selected.id"
        :taxonomy="selected"
        :current-terms="terms"
        @published="run(refreshSelected)"
        @editing="versionEditing = $event"
      />
    </section>
  </EtlShell>
</template>
