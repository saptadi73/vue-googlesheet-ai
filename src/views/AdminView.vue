<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import DataTable from '@/components/DataTable.vue'
import ScopeEditor from '@/components/ScopeEditor.vue'
import {
  call,
  copy,
  roles,
  user,
  type AccessAttribute,
  type AccessDecision,
  type AccessKind,
  type AccessAction,
  type AccessPolicy,
  type EffectiveAccess,
  type PermissionBundle,
  type PermissionGrant,
  type User,
  type UserAssignment,
} from '@/lib/etl'
import { useTask } from '@/lib/tasks'
import type { Row } from '@/lib/catalog'
const { busy, error, notice, run } = useTask()
const allowed = computed(() => user.value?.role === 'PLATFORM_ADMIN')
const createScopePending = ref(false),
  editScopePending = ref(false)
const users = ref<User[]>([]),
  events = ref<Row[]>([]),
  usage = ref<Row[]>([]),
  byUser = ref<Row[]>([]),
  attributes = ref<AccessAttribute[]>([]),
  assignments = ref<UserAssignment[]>([]),
  permissionBundles = ref<PermissionBundle[]>([]),
  permissionGrants = ref<PermissionGrant[]>([]),
  accessPolicies = ref<AccessPolicy[]>([]),
  policyResources = ref<{ code: string; name: string; status: string }[]>([]),
  accessDecision = ref<AccessDecision | null>(null),
  effectiveAccess = ref<EffectiveAccess | null>(null)
const accessKinds: AccessKind[] = ['DEPARTMENT', 'BUSINESS_DOMAIN', 'JURISDICTION', 'CLEARANCE', 'PURPOSE']
const accessActions: AccessAction[] = [
  'DISCOVER',
  'READ',
  'QUERY',
  'EXPORT',
  'EDIT',
  'APPROVE',
  'OPERATE',
  'ADMIN',
]
const offset = ref(0),
  auditOffset = ref(0),
  selected = ref<User | null>(null)
const form = ref({
  username: '',
  full_name: '',
  password: '',
  role: 'VIEWER',
  row_scope: {} as Record<string, Record<string, unknown[]>>,
})
const edit = ref({
  role: 'VIEWER',
  is_active: true,
  row_scope: {} as Record<string, Record<string, unknown[]>>,
})
const attributeForm = ref({ kind: 'DEPARTMENT' as AccessKind, code: '', label: '', parent_id: '' })
const assignmentForm = ref({ attribute_id: '', valid_from: '', valid_to: '', note: '' })
const bundleForm = ref({ code: '', label: '', description: '', actions: [] as AccessAction[] })
const permissionForm = ref({ bundle_id: '', valid_from: '', valid_to: '', note: '' })
const policyResourceSearch = ref('')
const policyForm = ref({
  code: '',
  label: '',
  effect: 'ALLOW' as 'ALLOW' | 'DENY',
  actions: [] as AccessAction[],
  export_allowed: false,
  required_attribute_ids: [] as string[],
  resource_type: 'DATA_PRODUCT' as 'DATA_PRODUCT' | 'SOURCE' | 'MASTER' | 'TAXONOMY',
  resource_id: '',
})
const evaluationForm = ref({
  action: 'QUERY' as AccessAction,
  resource_type: 'DATA_PRODUCT' as 'DATA_PRODUCT' | 'SOURCE' | 'MASTER' | 'TAXONOMY',
  resource_id: '',
})
let evaluationVersion = 0
function invalidateAccessDecision() {
  evaluationVersion++
  accessDecision.value = null
}
async function loadUsers() {
  users.value = await call<User[]>('GET', `/users?offset=${offset.value}&limit=25`)
}
async function loadAttributes() {
  attributes.value = await call<AccessAttribute[]>(
    'GET',
    '/access/attributes?include_inactive=true',
  )
}
async function createAttribute() {
  await call('POST', '/access/attributes', {
    kind: attributeForm.value.kind,
    code: attributeForm.value.code,
    label: attributeForm.value.label,
    parent_id: attributeForm.value.parent_id || null,
    attribute_data: {},
  })
  attributeForm.value = { kind: 'DEPARTMENT', code: '', label: '', parent_id: '' }
  await loadAttributes()
  notice.value = 'Atribut akses dibuat.'
}
async function loadPermissionBundles() {
  permissionBundles.value = await call<PermissionBundle[]>(
    'GET',
    '/access/permission-bundles?include_inactive=true',
  )
}
async function createPermissionBundle() {
  await call('POST', '/access/permission-bundles', bundleForm.value)
  bundleForm.value = { code: '', label: '', description: '', actions: [] }
  await loadPermissionBundles()
  notice.value = 'Permission bundle dibuat.'
}
async function loadAccessPolicies() {
  accessPolicies.value = await call<AccessPolicy[]>('GET', '/access/policies?include_revoked=true')
}
async function loadPolicyResources() {
  const resourceType = policyForm.value.resource_type
  const search = policyResourceSearch.value.trim()
  const accountId = user.value?.id
  const resources = await call<{ code: string; name: string; status: string }[]>(
    'GET',
    `/access/resources?resource_type=${resourceType}&search=${encodeURIComponent(search)}`,
  )
  if (user.value?.id === accountId && policyForm.value.resource_type === resourceType && policyResourceSearch.value.trim() === search) {
    policyResources.value = resources
    if (!resources.some((resource) => resource.code === policyForm.value.resource_id)) {
      policyForm.value.resource_id = ''
    }
  }
}
async function createAccessPolicy() {
  const policy = await call<AccessPolicy>('POST', '/access/policies', {
    code: policyForm.value.code,
    label: policyForm.value.label,
    effect: policyForm.value.effect,
    actions: policyForm.value.actions,
    required_attribute_ids: policyForm.value.required_attribute_ids,
    row_scope: {},
    column_rules: {},
    export_allowed:
      policyForm.value.effect === 'ALLOW' &&
      policyForm.value.actions.includes('EXPORT') &&
      policyForm.value.export_allowed,
  })
  await call('POST', `/access/policies/${policy.id}/bindings`, {
    resource_type: policyForm.value.resource_type,
    resource_id: policyForm.value.resource_id,
  })
  invalidateAccessDecision()
  policyForm.value = {
    code: '',
    label: '',
    effect: 'ALLOW',
    actions: [],
    export_allowed: false,
    required_attribute_ids: [],
    resource_type: 'DATA_PRODUCT',
    resource_id: '',
  }
  await loadAccessPolicies()
  notice.value = 'Policy DRAFT dan binding resource dibuat.'
}
async function transitionPolicy(policy: AccessPolicy, action: 'submit' | 'approve' | 'revoke') {
  await call('POST', `/access/policies/${policy.id}/${action}`, {
    revision: policy.revision,
    note: `${action} melalui administrasi akses`,
  })
  invalidateAccessDecision()
  await loadAccessPolicies()
  notice.value = `Policy berhasil ${action}.`
}
async function evaluatePolicy() {
  invalidateAccessDecision()
  const version = evaluationVersion
  const decision = await call<AccessDecision>('POST', '/access/evaluate', {
    user_id: selected.value?.id || undefined,
    ...evaluationForm.value,
  })
  if (version === evaluationVersion) accessDecision.value = decision
}
async function loadUserAccess(userId: string) {
  const [history, grants, effective] = await Promise.all([
    call<UserAssignment[]>('GET', `/access/users/${userId}/assignments?include_inactive=true`),
    call<PermissionGrant[]>(
      'GET',
      `/access/users/${userId}/permission-grants?include_inactive=true`,
    ),
    call<EffectiveAccess>('GET', `/access/users/${userId}/effective`),
  ])
  if (selected.value?.id !== userId) return
  assignments.value = history
  permissionGrants.value = grants
  effectiveAccess.value = effective
}
async function grantAssignment() {
  if (!selected.value) return
  const payload: Record<string, unknown> = {
    attribute_id: assignmentForm.value.attribute_id,
    note: assignmentForm.value.note,
  }
  if (assignmentForm.value.valid_from)
    payload.valid_from = new Date(assignmentForm.value.valid_from).toISOString()
  if (assignmentForm.value.valid_to)
    payload.valid_to = new Date(assignmentForm.value.valid_to).toISOString()
  await call('POST', `/access/users/${selected.value.id}/assignments`, payload)
  invalidateAccessDecision()
  assignmentForm.value = { attribute_id: '', valid_from: '', valid_to: '', note: '' }
  await loadUserAccess(selected.value.id)
  notice.value = 'Assignment yurisdiksi diberikan.'
}
async function revokeAssignment(item: UserAssignment) {
  if (!selected.value) return
  await call('POST', `/access/assignments/${item.id}/revoke`, {
    revision: item.revision,
    note: 'Dicabut melalui administrasi pengguna',
  })
  invalidateAccessDecision()
  await loadUserAccess(selected.value.id)
  notice.value = 'Assignment dicabut dan sesi pengguna direset.'
}
async function grantPermission() {
  if (!selected.value) return
  const payload: Record<string, unknown> = {
    bundle_id: permissionForm.value.bundle_id,
    note: permissionForm.value.note,
  }
  if (permissionForm.value.valid_from)
    payload.valid_from = new Date(permissionForm.value.valid_from).toISOString()
  if (permissionForm.value.valid_to)
    payload.valid_to = new Date(permissionForm.value.valid_to).toISOString()
  await call('POST', `/access/users/${selected.value.id}/permission-grants`, payload)
  invalidateAccessDecision()
  permissionForm.value = { bundle_id: '', valid_from: '', valid_to: '', note: '' }
  await loadUserAccess(selected.value.id)
  notice.value = 'Permission bundle diberikan dan sesi pengguna direset.'
}
async function revokePermission(item: PermissionGrant) {
  if (!selected.value) return
  await call('POST', `/access/permission-grants/${item.id}/revoke`, {
    revision: item.revision,
    note: 'Dicabut melalui administrasi pengguna',
  })
  invalidateAccessDecision()
  await loadUserAccess(selected.value.id)
  notice.value = 'Permission bundle dicabut dan sesi pengguna direset.'
}
async function loadAudit() {
  events.value = await call<Row[]>(
    'GET',
    `/admin/audit-events?offset=${auditOffset.value}&limit=25`,
  )
}
async function loadUsage() {
  const result = await Promise.all([
    call<Row[]>('GET', '/admin/ai-usage/summary'),
    call<Row[]>('GET', '/admin/ai-usage/by-user'),
  ])
  usage.value = result[0]
  byUser.value = result[1]
}
async function create() {
  if (createScopePending.value)
    throw new Error('Terapkan batasan baris ke form sebelum menyimpan pengguna.')
  await call('POST', '/users', form.value)
  form.value = { username: '', full_name: '', password: '', role: 'VIEWER', row_scope: {} }
  await loadUsers()
  notice.value = 'Pengguna dibuat pada tenant aktif.'
}
function select(item: User) {
  selected.value = item
  edit.value = {
    role: item.role,
    is_active: item.is_active ?? true,
    row_scope: copy(item.row_scope || {}),
  }
  assignments.value = []
  permissionGrants.value = []
  effectiveAccess.value = null
  invalidateAccessDecision()
  assignmentForm.value = { attribute_id: '', valid_from: '', valid_to: '', note: '' }
  permissionForm.value = { bundle_id: '', valid_from: '', valid_to: '', note: '' }
  void run(() => loadUserAccess(item.id))
}
async function save() {
  if (editScopePending.value)
    throw new Error('Terapkan batasan baris ke form sebelum menyimpan pengguna.')
  await call('PATCH', `/users/${selected.value?.id}`, edit.value)
  invalidateAccessDecision()
  selected.value = null
  await loadUsers()
  notice.value = 'Pengaturan tersimpan. Token lama pengguna tersebut telah dicabut.'
}
watch(
  user,
  () => {
    users.value = []
    events.value = []
    usage.value = []
    byUser.value = []
    attributes.value = []
    assignments.value = []
    permissionBundles.value = []
    permissionGrants.value = []
    accessPolicies.value = []
    policyResources.value = []
    policyResourceSearch.value = ''
    invalidateAccessDecision()
    effectiveAccess.value = null
    selected.value = null
    offset.value = 0
    auditOffset.value = 0
    form.value = { username: '', full_name: '', password: '', role: 'VIEWER', row_scope: {} }
    if (allowed.value)
      void run(async () => {
        await loadUsers()
        await loadAttributes()
        await loadPermissionBundles()
        await loadAccessPolicies()
        await loadPolicyResources()
        await loadAudit()
        await loadUsage()
      })
  },
  { immediate: true },
)
watch(evaluationForm, invalidateAccessDecision, { deep: true })
watch(() => policyForm.value.resource_type, () => {
  policyForm.value.resource_id = ''
  policyResourceSearch.value = ''
  policyResources.value = []
  if (allowed.value) void run(loadPolicyResources)
})
</script>
<template>
  <EtlShell
    ><p class="eyebrow">TENANT AKTIF</p>
    <h1>Administrasi</h1>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <section class="panel">
      <h2>Pengguna</h2>
      <div class="toolbar">
        <button :disabled="busy" @click="run(loadUsers)">Muat ulang pengguna</button
        ><button
          :disabled="busy || offset === 0"
          @click="
            run(async () => {
              offset -= 25
              await loadUsers()
            })
          "
        >
          Sebelumnya</button
        ><button
          :disabled="busy || users.length < 25"
          @click="
            run(async () => {
              offset += 25
              await loadUsers()
            })
          "
        >
          Berikutnya
        </button>
      </div>
      <div v-for="item in users" :key="item.id" class="toolbar">
        <strong>{{ item.username }}</strong
        ><span>{{ item.role }} · {{ item.is_active ? 'Aktif' : 'Nonaktif' }}</span
        ><button :disabled="busy" @click="select(item)">Atur akses</button>
      </div>
      <form v-if="selected" class="card-row" @submit.prevent="run(save)">
        <h3>Akses {{ selected.username }}</h3>
        <p class="notice">
          Perubahan mencabut semua token pengguna tersebut. Row scope diganti secara keseluruhan.
        </p>
        <fieldset :disabled="busy">
          <label
            >Role<select v-model="edit.role" :disabled="selected.id === user?.id">
              <option v-for="role in roles" :key="role">{{ role }}</option>
            </select></label
          ><label class="check"
            ><input
              v-model="edit.is_active"
              type="checkbox"
              :disabled="selected.id === user?.id"
            />Pengguna aktif</label
          ><ScopeEditor v-model="edit.row_scope" @pending="editScopePending = $event" /><button
            class="primary"
            :disabled="editScopePending"
          >
            Simpan akses pengguna</button
          ><button type="button" @click="selected = null">Tutup</button>
        </fieldset>
      </form>
      <details>
        <summary>Buat pengguna</summary>
        <form @submit.prevent="run(create)">
          <fieldset :disabled="busy">
            <div class="grid">
              <label
                >Username<input
                  v-model="form.username"
                  required
                  minlength="3"
                  maxlength="100"
                  pattern="[a-zA-Z0-9_.@\-]+"
                  autocomplete="off" /></label
              ><label>Nama lengkap<input v-model="form.full_name" maxlength="200" /></label
              ><label
                >Password awal<input
                  v-model="form.password"
                  required
                  type="password"
                  minlength="12"
                  maxlength="256"
                  autocomplete="new-password" /></label
              ><label
                >Role<select v-model="form.role">
                  <option v-for="role in roles" :key="role">{{ role }}</option>
                </select></label
              >
            </div>
            <ScopeEditor v-model="form.row_scope" @pending="createScopePending = $event" /><button
              class="primary"
              :disabled="createScopePending"
            >
              Buat pengguna
            </button>
          </fieldset>
        </form>
      </details>
    </section>
    <section class="panel">
      <h2>Registry akses</h2>
      <p class="muted">
        Kelola departemen, domain bisnis, yurisdiksi wilayah, dan tingkat clearance tenant aktif.
      </p>
      <form class="grid" @submit.prevent="run(createAttribute)">
        <label
          >Jenis<select v-model="attributeForm.kind">
            <option v-for="kind in accessKinds" :key="kind">{{ kind }}</option>
          </select></label
        ><label
          >Kode<input
            v-model="attributeForm.code"
            required
            maxlength="80"
            pattern="[A-Za-z0-9_.\-]+" /></label
        ><label>Nama<input v-model="attributeForm.label" required maxlength="200" /></label
        ><label
          >Induk opsional<select v-model="attributeForm.parent_id">
            <option value="">Tanpa induk</option>
            <option
              v-for="item in attributes.filter(
                (candidate) => candidate.kind === attributeForm.kind && candidate.is_active,
              )"
              :key="item.id"
              :value="item.id"
            >
              {{ item.code }} · {{ item.label }}
            </option>
          </select></label
        ><button class="primary" :disabled="busy">Tambah atribut</button>
      </form>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Jenis</th>
              <th>Kode</th>
              <th>Nama</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in attributes" :key="item.id">
              <td>{{ item.kind }}</td>
              <td>{{ item.code }}</td>
              <td>{{ item.label }}</td>
              <td>{{ item.is_active ? 'Aktif' : 'Nonaktif' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel">
      <h2>Permission bundle</h2>
      <p class="muted">
        Bundle mengelompokkan aksi. Cakupan data tetap berasal dari assignment dan policy.
      </p>
      <form @submit.prevent="run(createPermissionBundle)">
        <div class="grid">
          <label
            >Kode bundle<input
              v-model="bundleForm.code"
              required
              maxlength="80"
              pattern="[A-Za-z0-9_.\-]+"
          /></label>
          <label>Nama bundle<input v-model="bundleForm.label" required maxlength="200" /></label>
          <label>Deskripsi<input v-model="bundleForm.description" maxlength="500" /></label>
        </div>
        <div class="toolbar">
          <label v-for="action in accessActions" :key="action" class="check">
            <input v-model="bundleForm.actions" type="checkbox" :value="action" />{{ action }}
          </label>
        </div>
        <button class="primary" :disabled="busy || bundleForm.actions.length === 0">
          Tambah bundle
        </button>
      </form>
      <div v-for="bundle in permissionBundles" :key="bundle.id" class="toolbar">
        <strong>{{ bundle.code }} · {{ bundle.label }}</strong>
        <span>{{ bundle.actions.join(', ') }} · {{ bundle.is_active ? 'Aktif' : 'Nonaktif' }}</span>
      </div>
    </section>
    <section v-if="selected" class="panel">
      <h2>Yurisdiksi {{ selected.username }}</h2>
      <form class="grid" @submit.prevent="run(grantAssignment)">
        <label
          >Atribut<select v-model="assignmentForm.attribute_id" required>
            <option value="" disabled>Pilih atribut</option>
            <option
              v-for="item in attributes.filter((candidate) => candidate.is_active)"
              :key="item.id"
              :value="item.id"
            >
              {{ item.kind }} · {{ item.code }} · {{ item.label }}
            </option>
          </select></label
        ><label
          >Berlaku mulai<input v-model="assignmentForm.valid_from" type="datetime-local" /></label
        ><label
          >Berlaku sampai<input v-model="assignmentForm.valid_to" type="datetime-local" /></label
        ><label>Catatan<input v-model="assignmentForm.note" maxlength="500" /></label
        ><button class="primary" :disabled="busy">Berikan assignment</button>
      </form>
      <div v-for="item in assignments" :key="item.id" class="toolbar">
        <strong>{{ item.attribute.kind }} · {{ item.attribute.code }}</strong>
        <span
          >{{ item.status }} · {{ new Date(item.valid_from).toLocaleString() }} →
          {{ item.valid_to ? new Date(item.valid_to).toLocaleString() : 'tanpa batas' }}</span
        >
        <button
          v-if="item.status === 'ACTIVE'"
          :disabled="busy"
          @click="run(() => revokeAssignment(item))"
        >
          Cabut
        </button>
      </div>
      <h3>Akses efektif saat ini</h3>
      <p v-if="effectiveAccess" class="notice">
        Role {{ effectiveAccess.user.role }} · aksi
        {{ effectiveAccess.actions.join(', ') || 'tidak ada' }}
      </p>
      <div v-if="effectiveAccess" class="toolbar">
        <span v-for="(codes, kind) in effectiveAccess.dimensions" :key="kind" class="tag">
          {{ kind }}: {{ codes?.join(', ') }}
        </span>
      </div>
      <h3>Permission bundle</h3>
      <p v-if="selected.id === user?.id" class="notice">
        Permission milik sendiri harus diberikan atau dicabut oleh admin lain.
      </p>
      <form class="grid" @submit.prevent="run(grantPermission)">
        <label
          >Bundle<select
            v-model="permissionForm.bundle_id"
            required
            :disabled="selected.id === user?.id"
          >
            <option value="" disabled>Pilih permission bundle</option>
            <option
              v-for="bundle in permissionBundles.filter((candidate) => candidate.is_active)"
              :key="bundle.id"
              :value="bundle.id"
            >
              {{ bundle.code }} · {{ bundle.actions.join(', ') }}
            </option>
          </select></label
        ><label
          >Berlaku mulai<input v-model="permissionForm.valid_from" type="datetime-local" /></label
        ><label
          >Berlaku sampai<input v-model="permissionForm.valid_to" type="datetime-local" /></label
        ><label
          >Alasan pemberian<input v-model="permissionForm.note" required maxlength="500" /></label
        ><button class="primary" :disabled="busy || selected.id === user?.id">
          Berikan permission
        </button>
      </form>
      <div v-for="grant in permissionGrants" :key="grant.id" class="toolbar">
        <strong>{{ grant.bundle.code }}</strong>
        <span>{{ grant.status }} · {{ grant.bundle.actions.join(', ') }}</span>
        <button
          v-if="grant.status === 'ACTIVE'"
          :disabled="busy || selected.id === user?.id"
          @click="run(() => revokePermission(grant))"
        >
          Cabut permission
        </button>
      </div>
    </section>
    <section class="panel">
      <h2>Access policy</h2>
      <p class="muted">
        Policy baru selalu DRAFT. Pembuat policy tidak dapat menyetujui policy miliknya sendiri.
      </p>
      <form @submit.prevent="run(createAccessPolicy)">
        <div class="grid">
          <label>Kode policy<input v-model="policyForm.code" required maxlength="80" /></label>
          <label>Nama policy<input v-model="policyForm.label" required maxlength="200" /></label>
          <label
            >Efek<select v-model="policyForm.effect">
              <option>ALLOW</option>
              <option>DENY</option>
            </select></label
          >
          <label
            >Jenis resource<select v-model="policyForm.resource_type">
              <option>DATA_PRODUCT</option>
              <option>SOURCE</option>
              <option>MASTER</option>
              <option>TAXONOMY</option>
            </select></label
          >
          <label
            >Resource<select v-model="policyForm.resource_id" required>
              <option value="" disabled>Pilih resource</option>
              <option v-for="resource in policyResources" :key="resource.code" :value="resource.code">
                {{ resource.code }} · {{ resource.name }} ({{ resource.status }})
              </option>
            </select></label>
        </div>
        <div class="toolbar">
          <label>Cari kode resource<input v-model="policyResourceSearch" maxlength="63" /></label>
          <button type="button" :disabled="busy" @click="run(loadPolicyResources)">Cari resource</button>
        </div>
        <div class="toolbar">
          <label v-for="action in accessActions" :key="`policy-${action}`" class="check">
            <input v-model="policyForm.actions" type="checkbox" :value="action" />{{ action }}
          </label>
        </div>
        <label v-if="policyForm.effect === 'ALLOW' && policyForm.actions.includes('EXPORT')" class="check">
          <input v-model="policyForm.export_allowed" type="checkbox" />Izinkan ekspor data
        </label>
        <p>Atribut subject wajib:</p>
        <div class="toolbar">
          <label
            v-for="attribute in attributes.filter((item) => item.is_active)"
            :key="attribute.id"
            class="check"
          >
            <input
              v-model="policyForm.required_attribute_ids"
              type="checkbox"
              :value="attribute.id"
            />
            {{ attribute.kind }} · {{ attribute.code }}
          </label>
        </div>
        <button class="primary" :disabled="busy || policyForm.actions.length === 0">
          Buat policy DRAFT
        </button>
      </form>
      <div v-for="policy in accessPolicies" :key="policy.id" class="card-row">
        <strong>{{ policy.code }} · {{ policy.effect }} · {{ policy.status }}</strong>
        <p>{{ policy.actions.join(', ') }} · revision {{ policy.revision }}</p>
        <div class="toolbar">
          <button
            v-if="policy.status === 'DRAFT'"
            :disabled="busy"
            @click="run(() => transitionPolicy(policy, 'submit'))"
          >
            Submit review
          </button>
          <button
            v-if="policy.status === 'IN_REVIEW'"
            :disabled="busy"
            @click="run(() => transitionPolicy(policy, 'approve'))"
          >
            Approve policy
          </button>
          <button
            v-if="policy.status === 'APPROVED'"
            :disabled="busy"
            @click="run(() => transitionPolicy(policy, 'revoke'))"
          >
            Revoke policy
          </button>
        </div>
      </div>
      <h3>Preview keputusan</h3>
      <form class="grid" @submit.prevent="run(evaluatePolicy)">
        <label
          >Aksi evaluasi<select v-model="evaluationForm.action">
            <option v-for="action in accessActions" :key="action">{{ action }}</option>
          </select></label
        ><label
          >Jenis resource evaluasi<select v-model="evaluationForm.resource_type">
            <option>DATA_PRODUCT</option>
            <option>SOURCE</option>
            <option>MASTER</option>
            <option>TAXONOMY</option>
          </select></label
        ><label
          >ID/kode resource evaluasi<input v-model="evaluationForm.resource_id" required /></label
        ><button class="primary" :disabled="busy">
          Evaluasi {{ selected ? selected.username : 'akun sendiri' }}
        </button>
      </form>
      <template v-if="accessDecision">
        <p role="status">{{ accessDecision.allowed ? 'Diizinkan' : 'Ditolak' }} · {{ accessDecision.reason_code }}</p>
        <p v-if="evaluationForm.action === 'EXPORT'" role="status">
          Ekspor {{ accessDecision.export_allowed ? 'diizinkan' : 'tidak diizinkan' }}
        </p>
        <pre>{{ JSON.stringify(accessDecision, null, 2) }}</pre>
      </template>
    </section>
    <section class="panel">
      <h2>Penggunaan AI</h2>
      <p class="muted">
        Ringkasan tenant aktif, tanpa filter periode. Biaya merupakan estimasi; nilai — berarti
        belum tersedia, bukan nol.
      </p>
      <button :disabled="busy" @click="run(loadUsage)">Muat ulang penggunaan</button
      ><DataTable :rows="usage" />
      <h3>Per pengguna</h3>
      <DataTable :rows="byUser" />
    </section>
    <section class="panel">
      <h2>Audit aktivitas</h2>
      <DataTable :rows="events" />
      <div class="toolbar">
        <button :disabled="busy" @click="run(loadAudit)">Muat ulang audit</button
        ><button
          :disabled="busy || auditOffset === 0"
          @click="
            run(async () => {
              auditOffset -= 25
              await loadAudit()
            })
          "
        >
          Audit sebelumnya</button
        ><button
          :disabled="busy || events.length < 25"
          @click="
            run(async () => {
              auditOffset += 25
              await loadAudit()
            })
          "
        >
          Audit berikutnya
        </button>
      </div>
    </section>
  </EtlShell>
</template>
