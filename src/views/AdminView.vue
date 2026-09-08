<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import DataTable from '@/components/DataTable.vue'
import ScopeEditor from '@/components/ScopeEditor.vue'
import { call, copy, roles, user, type User } from '@/lib/etl'
import { useTask } from '@/lib/tasks'
import type { Row } from '@/lib/catalog'
const { busy, error, notice, run } = useTask()
const allowed = computed(() => user.value?.role === 'PLATFORM_ADMIN')
const createScopePending = ref(false),
  editScopePending = ref(false)
const users = ref<User[]>([]),
  events = ref<Row[]>([]),
  usage = ref<Row[]>([]),
  byUser = ref<Row[]>([])
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
async function loadUsers() {
  users.value = await call<User[]>('GET', `/users?offset=${offset.value}&limit=25`)
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
}
async function save() {
  if (editScopePending.value)
    throw new Error('Terapkan batasan baris ke form sebelum menyimpan pengguna.')
  await call('PATCH', `/users/${selected.value?.id}`, edit.value)
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
    selected.value = null
    offset.value = 0
    auditOffset.value = 0
    form.value = { username: '', full_name: '', password: '', role: 'VIEWER', row_scope: {} }
    if (allowed.value)
      void run(async () => {
        await loadUsers()
        await loadAudit()
        await loadUsage()
      })
  },
  { immediate: true },
)
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
