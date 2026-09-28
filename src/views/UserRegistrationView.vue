<script setup lang="ts">
import { ref } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import ScopeEditor from '@/components/ScopeEditor.vue'
import { call, roles, type User } from '@/lib/etl'
import { useTask } from '@/lib/tasks'

const { busy, error, notice, run } = useTask()
const scopePending = ref(false)
const createdUser = ref<User | null>(null)
const form = ref(emptyForm())

function emptyForm() {
  return {
    username: '',
    full_name: '',
    password: '',
    role: 'VIEWER',
    row_scope: {} as Record<string, Record<string, unknown[]>>,
  }
}

async function createUser() {
  if (scopePending.value) throw new Error('Terapkan batasan baris sebelum menyimpan pengguna.')
  createdUser.value = await call<User>('POST', '/users', form.value)
  form.value = emptyForm()
  notice.value = `Pengguna ${createdUser.value.username} berhasil didaftarkan.`
}
</script>

<template>
  <EtlShell>
    <p class="eyebrow">ADMINISTRASI PENGGUNA</p>
    <h1>Registrasi pengguna</h1>
    <p>Buat akun pada tenant aktif. Pengguna tidak dapat mendaftar atau memilih role sendiri.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <section class="panel">
      <form @submit.prevent="run(createUser)">
        <fieldset :disabled="busy">
          <div class="grid">
            <label
              >Username atau email<input
                v-model.trim="form.username"
                required
                minlength="3"
                maxlength="100"
                pattern="[a-zA-Z0-9_.@\-]+"
                autocomplete="off"
            /></label>
            <label
              >Nama lengkap<input v-model.trim="form.full_name" maxlength="200" autocomplete="off"
            /></label>
            <label
              >Password awal<input
                v-model="form.password"
                required
                type="password"
                minlength="12"
                maxlength="256"
                autocomplete="new-password"
            /></label>
            <label
              >Role awal<select v-model="form.role">
                <option v-for="role in roles" :key="role">{{ role }}</option>
              </select></label
            >
          </div>
          <ScopeEditor v-model="form.row_scope" @pending="scopePending = $event" />
          <div class="toolbar">
            <button class="primary" :disabled="scopePending">Daftarkan pengguna</button>
            <RouterLink class="button" to="/admin/users">Kelola pengguna</RouterLink>
          </div>
        </fieldset>
      </form>
    </section>
  </EtlShell>
</template>
