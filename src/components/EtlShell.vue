<script setup lang="ts">
import { ref } from 'vue'
import {
  Briefcase,
  Database,
  FileStack,
  GitBranch,
  LayoutDashboard,
  ListTree,
  LogOut,
  MessageSquare,
  Settings2,
  ShieldCheck,
  User,
  UserCog,
  UserPlus,
  Users,
  KeyRound,
} from '@lucide/vue'
import { logout, user, editRoles, reviewRoles } from '@/lib/etl'
import { getApiErrorMessage } from '@/lib/api'
import AppLogo from '@/components/ui/AppLogo.vue'
import Spinner from '@/components/ui/Spinner.vue'
import '@/assets/etl.css'
const busy = ref(false),
  error = ref('')
async function signOut() {
  busy.value = true
  try {
    await logout()
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
      <RouterLink to="/"><AppLogo :size="24" />Google Sheet AI</RouterLink
      ><RouterLink v-if="user && [...editRoles, ...reviewRoles].includes(user.role)" to="/workspace"
        ><Briefcase class="icon" :size="16" />Workspace ETL</RouterLink
      >
      <RouterLink v-if="user" to="/dashboard"
        ><LayoutDashboard class="icon" :size="16" />Dashboard</RouterLink
      >
      <RouterLink v-if="user && [...editRoles, ...reviewRoles].includes(user.role)" to="/masters"
        ><Database class="icon" :size="16" />Registry master</RouterLink
      >
      <RouterLink v-if="user && [...editRoles, ...reviewRoles].includes(user.role)" to="/taxonomies"
        ><ListTree class="icon" :size="16" />Taxonomy</RouterLink
      >
      <RouterLink v-if="user && [...editRoles, ...reviewRoles].includes(user.role)" to="/governance"
        ><Settings2 class="icon" :size="16" />Governance</RouterLink
      >
      <RouterLink
        v-if="user && [...editRoles, ...reviewRoles].includes(user.role)"
        to="/import-reviews"
        ><FileStack class="icon" :size="16" />Batch import</RouterLink
      >
      <RouterLink v-if="user" to="/chat"
        ><MessageSquare class="icon" :size="16" />Chat data</RouterLink
      >
      <RouterLink v-if="user && [...editRoles, ...reviewRoles].includes(user.role)" to="/jobs"
        ><GitBranch class="icon" :size="16" />Job &amp; ETL</RouterLink
      >
      <RouterLink
        v-if="user && ['PLATFORM_ADMIN', 'DATA_STEWARD'].includes(user.role)"
        to="/quality"
        ><ShieldCheck class="icon" :size="16" />Kualitas data</RouterLink
      >
      <RouterLink v-if="user?.role === 'PLATFORM_ADMIN'" to="/admin"
        ><UserCog class="icon" :size="16" />Administrasi</RouterLink
      >
      <RouterLink v-if="user?.role === 'PLATFORM_ADMIN'" to="/admin/users"
        ><Users class="icon" :size="16" />Pengguna</RouterLink
      >
      <RouterLink v-if="user?.role === 'PLATFORM_ADMIN'" to="/register"
        ><UserPlus class="icon" :size="16" />Registrasi</RouterLink
      >
      <RouterLink v-if="user" to="/account"><User class="icon" :size="16" />Akun</RouterLink>
      <RouterLink v-if="user" to="/access-requests"
        ><KeyRound class="icon" :size="16" />Permintaan akses</RouterLink
      >
      <span v-if="user">{{ user.username }} · {{ user.role }}</span
      ><button v-if="user" :disabled="busy" @click="signOut">
        <Spinner v-if="busy" :size="14" /><LogOut v-else class="icon" :size="14" />Keluar / ganti
        akun
      </button>
    </header>
    <main>
      <p v-if="error" role="alert" class="error toast">{{ error }}</p>
      <p
        v-if="user && Array.isArray($route.meta.roles) && !$route.meta.roles.includes(user.role)"
        class="notice"
      >
        Akun ini tidak memiliki akses ke halaman ini. Buka Dashboard atau Chat data.
      </p>
      <slot v-else />
    </main>
  </div>
</template>
