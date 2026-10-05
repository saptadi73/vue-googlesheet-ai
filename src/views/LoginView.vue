<script setup lang="ts">
import { computed, ref } from 'vue'
import { LogIn } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import AppLogo from '@/components/ui/AppLogo.vue'
import Spinner from '@/components/ui/Spinner.vue'
import { getApiErrorMessage } from '@/lib/api'
import { landingPathForRole, safeInternalPath } from '@/lib/access'
import { login, user } from '@/lib/etl'
import '@/assets/etl.css'

const route = useRoute()
const router = useRouter()
const credentials = ref({ tenant_code: 'default', username: '', password: '' })
const busy = ref(false)
const error = ref('')
const destination = computed(() => {
  const fallback = landingPathForRole(user.value?.role)
  const requested = safeInternalPath(route.query.redirect)
  if (!requested || !user.value) return fallback
  const resolved = router.resolve(requested)
  const allowed =
    resolved.name !== 'login' &&
    resolved.matched.length > 0 &&
    resolved.matched.every((record) => {
      const allowedRoles = record.meta.roles
      return !Array.isArray(allowedRoles) || allowedRoles.includes(user.value!.role)
    })
  return allowed ? requested : fallback
})

async function signIn() {
  busy.value = true
  error.value = ''
  try {
    await login(credentials.value)
    credentials.value.password = ''
    await router.replace(destination.value)
  } catch (exception) {
    error.value = getApiErrorMessage(exception)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="etl">
    <header class="etl-header">
      <RouterLink to="/"><AppLogo :size="24" />Google Sheet AI</RouterLink>
    </header>
    <main>
      <section v-if="user" class="panel login">
        <p class="eyebrow">SESI AKTIF</p>
        <h1>Anda sudah masuk</h1>
        <p>{{ user.full_name || user.username }} · {{ user.role }}</p>
        <RouterLink class="button primary" :to="destination">Lanjutkan</RouterLink>
      </section>
      <form v-else class="panel login" @submit.prevent="signIn">
        <p class="eyebrow">AKSES AMAN</p>
        <h1>Masuk ke Google Sheet AI</h1>
        <p>Gunakan akun yang didaftarkan administrator tenant.</p>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <fieldset :disabled="busy">
          <label
            >Tenant<input
              v-model.trim="credentials.tenant_code"
              required
              autocomplete="organization"
          /></label>
          <label
            >Username<input v-model.trim="credentials.username" required autocomplete="username"
          /></label>
          <label
            >Password<input
              v-model="credentials.password"
              required
              type="password"
              autocomplete="current-password"
          /></label>
          <button class="primary" :disabled="busy">
            <Spinner v-if="busy" :size="14" label="Menghubungkan…" />
            <LogIn v-else class="icon" :size="14" />
            <span>Masuk</span>
          </button>
        </fieldset>
      </form>
    </main>
  </div>
</template>
