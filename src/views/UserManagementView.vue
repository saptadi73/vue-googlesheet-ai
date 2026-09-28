<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import ScopeEditor from '@/components/ScopeEditor.vue'
import { call, copy, roles, user, type User } from '@/lib/etl'
import { useTask } from '@/lib/tasks'

const { busy, error, notice, run } = useTask()
const users = ref<User[]>([])
const selected = ref<User | null>(null)
const offset = ref(0)
const scopePending = ref(false)
const edit = ref({
  role: 'VIEWER',
  is_active: true,
  row_scope: {} as Record<string, Record<string, unknown[]>>,
})
const isCurrentUser = computed(() => selected.value?.id === user.value?.id)

async function loadUsers() {
  users.value = await call<User[]>('GET', `/users?offset=${offset.value}&limit=25`)
}

function selectUser(item: User) {
  selected.value = item
  edit.value = {
    role: item.role,
    is_active: item.is_active ?? true,
    row_scope: copy(item.row_scope || {}),
  }
  notice.value = ''
}

async function saveUser() {
  if (!selected.value) return
  if (scopePending.value) throw new Error('Terapkan batasan baris sebelum menyimpan pengguna.')
  const updated = await call<User>('PATCH', `/users/${selected.value.id}`, edit.value)
  users.value = users.value.map((item) => (item.id === updated.id ? updated : item))
  selected.value = updated
  notice.value = `Akses ${updated.username} diperbarui; seluruh token lamanya telah dicabut.`
}

async function previousPage() {
  offset.value = Math.max(0, offset.value - 25)
  selected.value = null
  await loadUsers()
}

async function nextPage() {
  offset.value += 25
  selected.value = null
  await loadUsers()
}

watch(
  user,
  (account) => {
    users.value = []
    selected.value = null
    offset.value = 0
    if (account?.role === 'PLATFORM_ADMIN') void run(loadUsers)
  },
  { immediate: true },
)
</script>

<template>
  <EtlShell>
    <p class="eyebrow">ADMINISTRASI PENGGUNA</p>
    <h1>Pengaturan akun dan role</h1>
    <p>Kelola status akun, role sistem, dan batasan baris pengguna dalam tenant aktif.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <section class="panel">
      <div class="toolbar">
        <RouterLink class="button primary" to="/register">Registrasi pengguna</RouterLink>
        <button :disabled="busy" @click="run(loadUsers)">Muat ulang</button>
        <button :disabled="busy || offset === 0" @click="run(previousPage)">Sebelumnya</button>
        <button :disabled="busy || users.length < 25" @click="run(nextPage)">Berikutnya</button>
      </div>
      <div v-for="item in users" :key="item.id" class="toolbar">
        <strong>{{ item.full_name || item.username }}</strong>
        <span
          >{{ item.username }} · {{ item.role }} · {{ item.is_active ? 'Aktif' : 'Nonaktif' }}</span
        >
        <button :disabled="busy" @click="selectUser(item)">Atur role</button>
      </div>
      <p v-if="!busy && users.length === 0" class="muted">Belum ada pengguna pada halaman ini.</p>
    </section>
    <section v-if="selected" class="panel">
      <h2>Akses {{ selected.username }}</h2>
      <p class="notice">
        Penyimpanan perubahan mencabut seluruh token pengguna. Admin tidak dapat menurunkan role
        atau menonaktifkan akunnya sendiri.
      </p>
      <form @submit.prevent="run(saveUser)">
        <fieldset :disabled="busy">
          <div class="grid">
            <label
              >Role<select v-model="edit.role" :disabled="isCurrentUser">
                <option v-for="role in roles" :key="role">{{ role }}</option>
              </select></label
            >
            <label class="check"
              ><input v-model="edit.is_active" type="checkbox" :disabled="isCurrentUser" />Akun
              aktif</label
            >
          </div>
          <ScopeEditor v-model="edit.row_scope" @pending="scopePending = $event" />
          <div class="toolbar">
            <button class="primary" :disabled="scopePending">Simpan pengaturan role</button>
            <button type="button" @click="selected = null">Tutup</button>
          </div>
        </fieldset>
      </form>
    </section>
  </EtlShell>
</template>
