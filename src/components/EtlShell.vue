<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login, logout, user, editRoles, reviewRoles } from '@/lib/etl'
import { getApiErrorMessage } from '@/lib/api'
import '@/assets/etl.css'
const router = useRouter()
const credentials = ref({ tenant_code: '', username: '', password: '' })
const busy = ref(false),
  error = ref('')
async function signIn() {
  busy.value = true
  error.value = ''
  try {
    await login(credentials.value)
    credentials.value.password = ''
  } catch (e) {
    error.value = getApiErrorMessage(e)
  } finally {
    busy.value = false
  }
}
async function signOut() {
  busy.value = true
  try {
    await logout()
    await router.push('/workspace')
  } catch (e) {
    error.value = getApiErrorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div class="etl">
    <header class="etl-header">
      <RouterLink to="/">Google Sheet AI</RouterLink
      ><RouterLink v-if="user && [...editRoles, ...reviewRoles].includes(user.role)" to="/workspace"
        >Workspace ETL</RouterLink
      >
      <RouterLink v-if="user" to="/dashboard">Dashboard</RouterLink>
      <RouterLink v-if="user" to="/chat">Chat data</RouterLink>
      <RouterLink v-if="user && [...editRoles, ...reviewRoles].includes(user.role)" to="/jobs"
        >Job &amp; ETL</RouterLink
      >
      <RouterLink
        v-if="user && ['PLATFORM_ADMIN', 'DATA_STEWARD'].includes(user.role)"
        to="/quality"
        >Kualitas data</RouterLink
      >
      <RouterLink v-if="user?.role === 'PLATFORM_ADMIN'" to="/admin">Administrasi</RouterLink>
      <RouterLink v-if="user" to="/account">Akun</RouterLink>
      <span v-if="user">{{ user.username }} · {{ user.role }}</span
      ><button v-if="user" :disabled="busy" @click="signOut">Keluar / ganti akun</button>
    </header>
    <main>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <form v-if="!user" class="panel login" @submit.prevent="signIn">
        <p class="eyebrow">WORKSPACE ETL</p>
        <h1>Masuk untuk memeriksa data</h1>
        <p>Gunakan akun aplikasi. Persetujuan dilakukan oleh akun approver yang berbeda.</p>
        <label
          >Tenant<input v-model="credentials.tenant_code" required autocomplete="organization"
        /></label>
        <label
          >Username<input v-model="credentials.username" required autocomplete="username"
        /></label>
        <label
          >Password<input
            v-model="credentials.password"
            required
            type="password"
            autocomplete="current-password"
        /></label>
        <button class="primary" :disabled="busy">{{ busy ? 'Menghubungkan…' : 'Masuk' }}</button>
      </form>
      <p
        v-else-if="Array.isArray($route.meta.roles) && !$route.meta.roles.includes(user.role)"
        class="notice"
      >
        Akun ini tidak memiliki akses ke halaman ini. Buka Dashboard atau Chat data.
      </p>
      <slot v-else />
    </main>
  </div>
</template>
