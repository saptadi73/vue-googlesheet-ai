<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LogOut, Menu, UserCog } from '@lucide/vue'
import { logout, user } from '@/lib/etl'
import { getApiErrorMessage } from '@/lib/api'
import AppLogo from '@/components/ui/AppLogo.vue'
import Spinner from '@/components/ui/Spinner.vue'
import AppNavLink from '@/components/navigation/AppNavLink.vue'
import AppMenuDropdown from '@/components/navigation/AppMenuDropdown.vue'
import AppSidebar from '@/components/navigation/AppSidebar.vue'
import {
  accountNavigation,
  administrationNavigation,
  operationalNavigation,
  type NavigationItem,
} from '@/lib/navigation'
import '@/assets/etl.css'
import '@/assets/navigation.css'
const router = useRouter()
const route = useRoute()
const sidebarOpen = ref(false)
function allowed(item: NavigationItem) {
  return (
    !!user.value &&
    router.resolve(item.to).matched.every((record) => {
      const roles = record.meta.roles
      return !Array.isArray(roles) || roles.includes(user.value!.role)
    })
  )
}
const groups = computed(() =>
  operationalNavigation
    .map((group) => ({ ...group, items: group.items.filter(allowed) }))
    .filter((group) => group.items.length),
)
const administration = computed(() => administrationNavigation.filter(allowed))
const account = computed(() => accountNavigation.filter(allowed))
watch(
  () => route.fullPath,
  () => {
    sidebarOpen.value = false
  },
)
const busy = ref(false),
  error = ref('')
async function signOut() {
  busy.value = true
  error.value = ''
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
  <div class="etl app-shell">
    <a class="app-skip-link" href="#main-content">Lewati navigasi</a>
    <header class="app-navbar">
      <button
        type="button"
        class="app-sidebar-toggle"
        aria-label="Buka menu operasional"
        aria-controls="operational-sidebar"
        :aria-expanded="sidebarOpen"
        @click="sidebarOpen = true"
      >
        <Menu :size="20" aria-hidden="true" />
      </button>
      <RouterLink to="/" class="app-brand"
        ><AppLogo :size="30" /><span>Google Sheet AI</span></RouterLink
      >
      <nav aria-label="Administrasi dan akun" class="app-navbar-menu">
        <div class="app-navbar-links">
          <AppNavLink v-for="item in [...administration, ...account]" :key="item.to" :item="item" />
        </div>
        <AppMenuDropdown
          v-if="administration.length"
          label="Menu administrasi"
          class="app-compact-menu"
        >
          <template #trigger
            ><UserCog :size="18" aria-hidden="true" /><span class="app-menu-label"
              >Administrasi</span
            ></template
          >
          <AppNavLink v-for="item in administration" :key="item.to" :item="item" />
        </AppMenuDropdown>
        <AppMenuDropdown v-if="user" label="Menu akun">
          <template #trigger>
            <span class="app-user-avatar" aria-hidden="true">{{
              user.username.charAt(0).toUpperCase()
            }}</span>
            <span class="app-user-name">{{ user.username }}</span>
          </template>
          <div class="app-user-details">
            <strong>{{ user.full_name || user.username }}</strong
            ><span>{{ user.username }}</span
            ><small>{{ user.role }}</small>
          </div>
          <div class="app-compact-account">
            <AppNavLink v-for="item in account" :key="item.to" :item="item" />
          </div>
        </AppMenuDropdown>
      </nav>
      <button
        v-if="user"
        class="app-sign-out"
        :disabled="busy"
        aria-label="Keluar / ganti akun"
        @click="signOut"
      >
        <Spinner v-if="busy" :size="16" /><LogOut v-else :size="16" aria-hidden="true" />
        <span>Keluar / ganti akun</span>
      </button>
    </header>
    <AppSidebar :groups="groups" :open="sidebarOpen" @close="sidebarOpen = false" />
    <div class="app-content">
      <main id="main-content" tabindex="-1">
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
  </div>
</template>
