<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import { call, editRoles, reviewRoles, user, type Source } from '@/lib/etl'
import type { Product } from '@/lib/catalog'
import type { Taxonomy } from '@/lib/taxonomies'
import {
  promptByPurpose,
  type AIPurpose,
  type AITaskPolicy,
  type AITaskPolicyVersion,
  type JoinRelationship,
} from '@/lib/governance'
import { useTask } from '@/lib/tasks'

const { busy, error, notice, run } = useTask()
const products = ref<Product[]>([])
const sources = ref<Source[]>([])
const taxonomies = ref<Taxonomy[]>([])
const relationships = ref<JoinRelationship[]>([])
const policies = ref<AITaskPolicy[]>([])
const policyHistoryId = ref('')
const policyVersions = ref<AITaskPolicyVersion[]>([])
const selectedRelationship = ref<JoinRelationship | null>(null)
const selectedPolicy = ref<AITaskPolicy | null>(null)
const joinForm = ref(blankJoin())
const aiForm = ref(blankPolicy())
const allowedModelsText = ref('')
const comment = ref('')

const allowed = computed(() => [...editRoles, ...reviewRoles].includes(user.value?.role || ''))
const joinAdmin = computed(() =>
  ['PLATFORM_ADMIN', 'DATA_STEWARD'].includes(user.value?.role || ''),
)
const policyEditor = computed(() => editRoles.includes(user.value?.role || ''))
const policyReviewer = computed(() => reviewRoles.includes(user.value?.role || ''))

function blankJoin() {
  return {
    code: '',
    left_product_code: '',
    left_column: '',
    right_product_code: '',
    right_column: '',
    cardinality: 'MANY_TO_ONE' as JoinRelationship['cardinality'],
    join_type: 'LEFT' as JoinRelationship['join_type'],
    duplicate_policy: 'REJECT_AMBIGUOUS' as JoinRelationship['duplicate_policy'],
  }
}
function blankPolicy(): {
  code: string
  purpose: AIPurpose
  prompt_version: string
  model: string
  data_product_code: string | null
  data_source_id: string | null
  taxonomy_id: string | null
  max_context_chars: number
  daily_budget_usd: number | null
  fallback_model: string | null
} {
  const purpose: AIPurpose = 'ETL_CONFIG'
  return {
    code: '',
    purpose,
    prompt_version: promptByPurpose[purpose],
    model: '',
    data_product_code: null,
    data_source_id: null,
    taxonomy_id: null,
    max_context_chars: 200_000,
    daily_budget_usd: null,
    fallback_model: null,
  }
}
function columnsFor(code: string) {
  return (
    products.value
      .find((product) => product.code === code)
      ?.columns.map((column) => column.target_column)
      .filter(Boolean) || []
  )
}
function selectLeftProduct() {
  joinForm.value.left_column = columnsFor(joinForm.value.left_product_code)[0] || ''
}
function selectRightProduct() {
  joinForm.value.right_column = columnsFor(joinForm.value.right_product_code)[0] || ''
}
function selectPurpose() {
  aiForm.value.prompt_version = promptByPurpose[aiForm.value.purpose]
  if (aiForm.value.purpose !== 'NL2SQL') aiForm.value.data_product_code = null
  if (aiForm.value.purpose !== 'ETL_CONFIG') aiForm.value.data_source_id = null
  if (aiForm.value.purpose !== 'TAXONOMY_RECOMMEND') aiForm.value.taxonomy_id = null
}
function policyScope(item: AITaskPolicy) {
  if (item.data_product_code) return item.data_product_code
  if (item.data_source_id)
    return (
      sources.value.find((source) => source.id === item.data_source_id)?.source_code ||
      item.data_source_id
    )
  if (item.taxonomy_id)
    return (
      taxonomies.value.find((taxonomy) => taxonomy.id === item.taxonomy_id)?.code ||
      item.taxonomy_id
    )
  return 'global untuk purpose'
}
function editRelationship(item: JoinRelationship) {
  selectedRelationship.value = item
  joinForm.value = {
    code: item.code,
    left_product_code: item.left_product_code,
    left_column: item.left_column,
    right_product_code: item.right_product_code,
    right_column: item.right_column,
    cardinality: item.cardinality,
    join_type: item.join_type,
    duplicate_policy: item.duplicate_policy,
  }
}
function resetJoin() {
  selectedRelationship.value = null
  joinForm.value = blankJoin()
}
function editPolicy(item: AITaskPolicy) {
  selectedPolicy.value = item
  aiForm.value = {
    code: item.code,
    purpose: item.purpose,
    prompt_version: item.prompt_version,
    model: item.model,
    data_product_code: item.data_product_code,
    data_source_id: item.data_source_id,
    taxonomy_id: item.taxonomy_id,
    max_context_chars: item.max_context_chars,
    daily_budget_usd: item.daily_budget_usd,
    fallback_model: item.fallback_model,
  }
  allowedModelsText.value = item.allowed_models.join('\n')
}
function resetPolicy() {
  selectedPolicy.value = null
  aiForm.value = blankPolicy()
  allowedModelsText.value = ''
}
async function load() {
  const result = await Promise.all([
    call<Product[]>('GET', '/semantic/data-products'),
    call<Source[]>('GET', '/sources'),
    call<Taxonomy[]>('GET', '/taxonomies'),
    call<JoinRelationship[]>('GET', '/semantic/join-relationships'),
    call<AITaskPolicy[]>('GET', '/ai-task-policies'),
  ])
  products.value = result[0]
  sources.value = result[1]
  taxonomies.value = result[2]
  relationships.value = result[3]
  policies.value = result[4]
}
async function saveRelationship() {
  if (joinForm.value.left_product_code === joinForm.value.right_product_code)
    throw new Error('Relationship harus memakai dua produk berbeda.')
  const body = { ...joinForm.value }
  if (selectedRelationship.value)
    await call<JoinRelationship>(
      'PATCH',
      `/semantic/join-relationships/${selectedRelationship.value.id}`,
      { ...body, code: undefined, revision_no: selectedRelationship.value.revision_no },
    )
  else await call<JoinRelationship>('POST', '/semantic/join-relationships', body)
  notice.value = 'Draft relationship tersimpan.'
  resetJoin()
  await load()
}
async function decideRelationship(item: JoinRelationship, action: 'approve' | 'reject') {
  await call<JoinRelationship>('POST', `/semantic/join-relationships/${item.id}/${action}`, {
    revision_no: item.revision_no,
  })
  notice.value = `Relationship ${action === 'approve' ? 'disetujui' : 'ditolak'}.`
  await load()
}
async function savePolicy() {
  const allowedModels = allowedModelsText.value
    .split('\n')
    .map((value) => value.trim())
    .filter((value, index, all) => value && all.indexOf(value) === index)
  if (!allowedModels.includes(aiForm.value.model.trim()))
    throw new Error('Model aktif harus tercantum pada allowlist policy.')
  const fallbackModel = aiForm.value.fallback_model?.trim() || null
  if (fallbackModel === aiForm.value.model.trim())
    throw new Error('Fallback model harus berbeda dari model aktif.')
  if (fallbackModel && !allowedModels.includes(fallbackModel))
    throw new Error('Fallback model harus tercantum pada allowlist policy.')
  const body = {
    ...aiForm.value,
    code: aiForm.value.code.trim(),
    model: aiForm.value.model.trim(),
    allowed_models: allowedModels,
    daily_budget_usd: aiForm.value.daily_budget_usd || null,
    fallback_model: fallbackModel,
  }
  if (selectedPolicy.value)
    await call<AITaskPolicy>('PATCH', `/ai-task-policies/${selectedPolicy.value.id}`, {
      ...body,
      revision_no: selectedPolicy.value.revision_no,
    })
  else await call<AITaskPolicy>('POST', '/ai-task-policies', body)
  resetPolicy()
  notice.value = 'AI task policy disimpan sebagai draft tanpa API key.'
  await load()
}
async function decidePolicy(item: AITaskPolicy, action: 'approve' | 'reject') {
  await call<AITaskPolicy>('POST', `/ai-task-policies/${item.id}/${action}`, {
    revision_no: item.revision_no,
    comment: comment.value.trim(),
  })
  notice.value = `AI task policy ${action === 'approve' ? 'disetujui' : 'ditolak'}.`
  comment.value = ''
  await load()
}
async function loadPolicyVersions(item: AITaskPolicy) {
  if (policyHistoryId.value === item.id) {
    policyHistoryId.value = ''
    policyVersions.value = []
    return
  }
  policyHistoryId.value = item.id
  policyVersions.value = await call<AITaskPolicyVersion[]>(
    'GET',
    `/ai-task-policies/${item.id}/versions?offset=0&limit=50`,
  )
}

watch(
  user,
  () => {
    products.value = []
    sources.value = []
    taxonomies.value = []
    relationships.value = []
    policies.value = []
    policyHistoryId.value = ''
    policyVersions.value = []
    resetJoin()
    resetPolicy()
    comment.value = ''
    if (allowed.value) void run(load)
  },
  { immediate: true },
)
</script>

<template>
  <EtlShell>
    <p class="eyebrow">GOVERNANCE</p>
    <h1>Semantic join &amp; kebijakan AI</h1>
    <p class="muted">
      Relationship APPROVED dapat dipilih pada Dashboard untuk structured query multi-product.
      Backend tetap memeriksa arah path, akses produk, tenant dan row scope, PII, serta risiko
      agregasi.
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>

    <section class="panel">
      <h2>Registry join relationship</h2>
      <button :disabled="busy" @click="run(load)">Muat ulang governance</button>
      <p v-if="!relationships.length" class="muted">Belum ada relationship.</p>
      <article v-for="item in relationships" :key="item.id" class="card-row">
        <h3>
          {{ item.code }} <span class="tag">{{ item.status }}</span>
        </h3>
        <p>
          {{ item.left_product_code }}.{{ item.left_column }} {{ item.join_type }}
          {{ item.right_product_code }}.{{ item.right_column }} · {{ item.cardinality }} ·
          {{ item.duplicate_policy }} · revisi {{ item.revision_no }}
        </p>
        <div class="toolbar">
          <button
            v-if="joinAdmin && item.status === 'DRAFT'"
            :disabled="busy"
            @click="editRelationship(item)"
          >
            Edit relationship
          </button>
          <button
            v-if="joinAdmin && item.status === 'DRAFT'"
            class="primary"
            :disabled="busy"
            @click="run(() => decideRelationship(item, 'approve'))"
          >
            Setujui relationship
          </button>
          <button
            v-if="joinAdmin && item.status === 'DRAFT'"
            :disabled="busy"
            @click="run(() => decideRelationship(item, 'reject'))"
          >
            Tolak relationship
          </button>
        </div>
      </article>
    </section>

    <form v-if="joinAdmin" class="panel" @submit.prevent="run(saveRelationship)">
      <h2>{{ selectedRelationship ? 'Edit draft relationship' : 'Buat relationship' }}</h2>
      <fieldset :disabled="busy">
        <div class="grid">
          <label
            >Kode relationship<input
              v-model="joinForm.code"
              required
              maxlength="63"
              pattern="[a-z][a-z0-9_]*"
              :disabled="!!selectedRelationship"
          /></label>
          <label
            >Produk kiri<select
              v-model="joinForm.left_product_code"
              required
              @change="selectLeftProduct"
            >
              <option value="" disabled>Pilih produk</option>
              <option v-for="product in products" :key="product.id" :value="product.code">
                {{ product.code }} · {{ product.name }}
              </option>
            </select></label
          >
          <label
            >Kolom kiri<select v-model="joinForm.left_column" required>
              <option value="" disabled>Pilih kolom</option>
              <option v-for="column in columnsFor(joinForm.left_product_code)" :key="column">
                {{ column }}
              </option>
            </select></label
          >
          <label
            >Produk kanan<select
              v-model="joinForm.right_product_code"
              required
              @change="selectRightProduct"
            >
              <option value="" disabled>Pilih produk</option>
              <option v-for="product in products" :key="product.id" :value="product.code">
                {{ product.code }} · {{ product.name }}
              </option>
            </select></label
          >
          <label
            >Kolom kanan<select v-model="joinForm.right_column" required>
              <option value="" disabled>Pilih kolom</option>
              <option v-for="column in columnsFor(joinForm.right_product_code)" :key="column">
                {{ column }}
              </option>
            </select></label
          >
          <label
            >Kardinalitas<select v-model="joinForm.cardinality">
              <option>ONE_TO_ONE</option>
              <option>MANY_TO_ONE</option>
              <option>ONE_TO_MANY</option>
            </select></label
          >
          <label
            >Jenis join<select v-model="joinForm.join_type">
              <option>LEFT</option>
              <option>INNER</option>
            </select></label
          >
          <label
            >Kebijakan duplikat<select v-model="joinForm.duplicate_policy">
              <option>REJECT_AMBIGUOUS</option>
              <option>AGGREGATE_RIGHT</option>
            </select></label
          >
        </div>
        <div class="toolbar">
          <button class="primary">Simpan draft relationship</button>
          <button v-if="selectedRelationship" type="button" @click="resetJoin">Batal edit</button>
        </div>
      </fieldset>
    </form>

    <section class="panel">
      <h2>AI task policy</h2>
      <p class="muted">
        Policy hanya memilih purpose, prompt yang terdaftar, dan model allowlist server. API key
        tetap berasal dari environment dan tidak pernah ditampilkan di halaman ini.
      </p>
      <p v-if="!policies.length" class="muted">Belum ada AI task policy.</p>
      <article v-for="item in policies" :key="item.id" class="card-row">
        <h3>
          {{ item.code }} <span class="tag">{{ item.status }}</span>
        </h3>
        <p>
          {{ item.purpose }} · {{ item.prompt_version }} · model {{ item.model }} · revisi
          {{ item.revision_no }}
        </p>
        <p class="muted">Scope dataset: {{ policyScope(item) }}</p>
        <p class="muted">Allowlist: {{ item.allowed_models.join(', ') }}</p>
        <p class="muted">
          Batas konteks: {{ item.max_context_chars.toLocaleString('id-ID') }} karakter &middot;
          budget harian:
          {{
            item.daily_budget_usd === null ? 'tanpa batas policy' : `$${item.daily_budget_usd}`
          }}
          &middot; fallback: {{ item.fallback_model || 'tidak ada' }}
        </p>
        <button :disabled="busy" @click="run(() => loadPolicyVersions(item))">
          {{ policyHistoryId === item.id ? 'Tutup riwayat' : 'Lihat riwayat versi' }}
        </button>
        <ol v-if="policyHistoryId === item.id" class="card-row">
          <li v-for="version in policyVersions" :key="version.id">
            Revisi {{ version.revision_no }} · {{ version.action }} ·
            {{ version.snapshot_json.status }} · {{ version.snapshot_json.model }} ·
            {{ version.created_at }}
          </li>
          <li v-if="!policyVersions.length">Riwayat versi belum tersedia.</li>
        </ol>
        <button
          v-if="policyEditor && item.status === 'DRAFT'"
          :disabled="busy"
          @click="editPolicy(item)"
        >
          Edit AI policy
        </button>
        <div v-if="policyReviewer && item.status === 'DRAFT'" class="toolbar">
          <button
            class="primary"
            :disabled="busy"
            @click="run(() => decidePolicy(item, 'approve'))"
          >
            Setujui AI policy
          </button>
          <button :disabled="busy" @click="run(() => decidePolicy(item, 'reject'))">
            Tolak AI policy
          </button>
        </div>
      </article>
      <label v-if="policyReviewer && policies.some((item) => item.status === 'DRAFT')"
        >Catatan keputusan<textarea v-model="comment" maxlength="2000" />
      </label>
    </section>

    <form v-if="policyEditor" class="panel" @submit.prevent="run(savePolicy)">
      <h2>{{ selectedPolicy ? 'Edit AI task policy' : 'Buat AI task policy' }}</h2>
      <fieldset :disabled="busy">
        <div class="grid">
          <label
            >Kode policy<input
              v-model="aiForm.code"
              required
              maxlength="63"
              pattern="[a-z][a-z0-9_]*"
          /></label>
          <label
            >Purpose<select v-model="aiForm.purpose" @change="selectPurpose">
              <option>ETL_CONFIG</option>
              <option>TAXONOMY_RECOMMEND</option>
              <option>NL2SQL</option>
              <option>USER_HELP</option>
            </select></label
          >
          <label>Prompt version<input v-model="aiForm.prompt_version" readonly /></label>
          <label>Model aktif<input v-model="aiForm.model" required maxlength="100" /></label>
          <label
            >Fallback model<input
              v-model="aiForm.fallback_model"
              maxlength="100"
              placeholder="Opsional; harus ada di allowlist"
          /></label>
          <label
            >Batas konteks (karakter)<input
              v-model.number="aiForm.max_context_chars"
              type="number"
              min="1000"
              max="2000000"
              required
          /></label>
          <label
            >Budget harian policy (USD)<input
              v-model.number="aiForm.daily_budget_usd"
              type="number"
              min="0.01"
              max="1000000"
              step="0.01"
              placeholder="Opsional"
          /></label>
          <label v-if="aiForm.purpose === 'NL2SQL'"
            >Data product<select v-model="aiForm.data_product_code">
              <option :value="null">Global untuk NL2SQL</option>
              <option v-for="product in products" :key="product.id" :value="product.code">
                {{ product.code }} · {{ product.name }}
              </option>
            </select></label
          >
          <label v-if="aiForm.purpose === 'ETL_CONFIG'"
            >Source dataset<select v-model="aiForm.data_source_id">
              <option :value="null">Global untuk ETL_CONFIG</option>
              <option v-for="source in sources" :key="source.id" :value="source.id">
                {{ source.source_code }} · {{ source.name }}
              </option>
            </select></label
          >
          <label v-if="aiForm.purpose === 'TAXONOMY_RECOMMEND'"
            >Taxonomy<select id="policy-taxonomy" v-model="aiForm.taxonomy_id">
              <option :value="null">Global untuk TAXONOMY_RECOMMEND</option>
              <option
                v-for="taxonomy in taxonomies.filter(
                  (item) => item.status === 'APPROVED' && item.is_active,
                )"
                :key="taxonomy.id"
                :value="taxonomy.id"
              >
                {{ taxonomy.code }} · {{ taxonomy.name }}
              </option>
            </select></label
          >
        </div>
        <label
          >Model yang diizinkan (satu per baris)<textarea
            v-model="allowedModelsText"
            required
            placeholder="gpt-5.1"
          />
        </label>
        <p class="muted">
          Semua model dalam daftar harus ada pada allowlist server. Backend memeriksa ulang saat
          simpan dan persetujuan.
        </p>
        <div class="toolbar">
          <button class="primary">Simpan draft AI policy</button>
          <button v-if="selectedPolicy" type="button" @click="resetPolicy">
            Batal edit policy
          </button>
        </div>
      </fieldset>
    </form>
  </EtlShell>
</template>
