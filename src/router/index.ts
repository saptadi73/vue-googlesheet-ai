import { createRouter, createWebHistory } from 'vue-router'
import { onSessionCleared } from '@/lib/api'
import { landingPathForRole, safeInternalPath } from '@/lib/access'
import { user } from '@/lib/etl'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    {
      path: '/login',
      name: 'login',
      meta: { public: true },
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/workspace',
      name: 'etl-workspace',
      meta: { roles: ['PLATFORM_ADMIN', 'SOURCE_OWNER', 'DATA_STEWARD', 'TECHNICAL_APPROVER'] },
      component: () => import('@/views/EtlWorkspace.vue'),
    },
    {
      path: '/configurations/:id/review',
      name: 'etl-review',
      meta: { roles: ['PLATFORM_ADMIN', 'SOURCE_OWNER', 'DATA_STEWARD', 'TECHNICAL_APPROVER'] },
      component: () => import('@/views/EtlReview.vue'),
    },
    { path: '/dashboard', component: () => import('@/views/DashboardView.vue') },
    { path: '/release-approvals', component: () => import('@/views/ReleaseApprovalsView.vue') },
    {
      path: '/guide',
      name: 'general-guide',
      meta: { public: true, publicWhenAuthenticated: true },
      component: () => import('@/views/GeneralGuideView.vue'),
    },
    {
      path: '/masters',
      component: () => import('@/views/MastersView.vue'),
      meta: { roles: ['PLATFORM_ADMIN', 'SOURCE_OWNER', 'DATA_STEWARD', 'TECHNICAL_APPROVER'] },
    },
    {
      path: '/taxonomies',
      component: () => import('@/views/TaxonomiesView.vue'),
      meta: { roles: ['PLATFORM_ADMIN', 'SOURCE_OWNER', 'DATA_STEWARD', 'TECHNICAL_APPROVER'] },
    },
    {
      path: '/governance',
      component: () => import('@/views/GovernanceView.vue'),
      meta: { roles: ['PLATFORM_ADMIN', 'SOURCE_OWNER', 'DATA_STEWARD', 'TECHNICAL_APPROVER'] },
    },
    {
      path: '/import-reviews',
      component: () => import('@/views/ImportReviewsView.vue'),
      meta: { roles: ['PLATFORM_ADMIN', 'SOURCE_OWNER', 'DATA_STEWARD', 'TECHNICAL_APPROVER'] },
    },
    {
      path: '/import-reviews/:id',
      component: () => import('@/views/ImportReviewDetailView.vue'),
      meta: { roles: ['PLATFORM_ADMIN', 'SOURCE_OWNER', 'DATA_STEWARD', 'TECHNICAL_APPROVER'] },
    },
    {
      path: '/masters/new',
      component: () => import('@/views/MasterDefinitionView.vue'),
      meta: { roles: ['PLATFORM_ADMIN', 'SOURCE_OWNER', 'DATA_STEWARD'] },
    },
    {
      path: '/masters/:id/storage',
      component: () => import('@/views/MasterStorageView.vue'),
      meta: { roles: ['PLATFORM_ADMIN', 'SOURCE_OWNER', 'DATA_STEWARD', 'TECHNICAL_APPROVER'] },
    },
    {
      path: '/masters/:id',
      component: () => import('@/views/MasterDefinitionView.vue'),
      meta: { roles: ['PLATFORM_ADMIN', 'SOURCE_OWNER', 'DATA_STEWARD', 'TECHNICAL_APPROVER'] },
    },
    {
      path: '/sources/:sourceId/sheets/:sheetId/master-binding',
      component: () => import('@/views/MasterBindingView.vue'),
      meta: { roles: ['PLATFORM_ADMIN', 'SOURCE_OWNER', 'DATA_STEWARD', 'TECHNICAL_APPROVER'] },
    },
    {
      path: '/sources/:sourceId/sheets/:sheetId/column-bindings',
      component: () => import('@/views/ColumnBindingsView.vue'),
      meta: { roles: ['PLATFORM_ADMIN', 'SOURCE_OWNER', 'DATA_STEWARD', 'TECHNICAL_APPROVER'] },
    },
    {
      path: '/sources/:sourceId/sheets/:sheetId/taxonomy-bindings',
      component: () => import('@/views/TaxonomyBindingsView.vue'),
      meta: { roles: ['PLATFORM_ADMIN', 'SOURCE_OWNER', 'DATA_STEWARD', 'TECHNICAL_APPROVER'] },
    },
    { path: '/chat', component: () => import('@/views/ChatView.vue') },
    {
      path: '/jobs',
      component: () => import('@/views/JobsView.vue'),
      meta: { roles: ['PLATFORM_ADMIN', 'SOURCE_OWNER', 'DATA_STEWARD', 'TECHNICAL_APPROVER'] },
    },
    {
      path: '/quality',
      component: () => import('@/views/QualityView.vue'),
      meta: { roles: ['PLATFORM_ADMIN', 'DATA_STEWARD'] },
    },
    {
      path: '/admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { roles: ['PLATFORM_ADMIN'] },
    },
    {
      path: '/admin/users',
      name: 'user-management',
      component: () => import('@/views/UserManagementView.vue'),
      meta: { roles: ['PLATFORM_ADMIN'] },
    },
    {
      path: '/register',
      alias: '/admin/users/new',
      name: 'user-registration',
      component: () => import('@/views/UserRegistrationView.vue'),
      meta: { roles: ['PLATFORM_ADMIN'] },
    },
    { path: '/account', component: () => import('@/views/AccountView.vue') },
    {
      path: '/access-requests',
      name: 'access-requests',
      component: () => import('@/views/AccessRequestsView.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

function roleAllowed(path: string, role: string) {
  const resolved = router.resolve(path)
  if (resolved.name === 'login' || !resolved.matched.length) return false
  return resolved.matched.every((route) => {
    const roles = route.meta.roles
    return !Array.isArray(roles) || roles.includes(role)
  })
}

router.beforeEach((to) => {
  if (to.meta.public) {
    if (!user.value || to.meta.publicWhenAuthenticated) return true
    const requested = safeInternalPath(to.query.redirect)
    return requested && roleAllowed(requested, user.value.role)
      ? requested
      : landingPathForRole(user.value.role)
  }

  if (!user.value) {
    return {
      name: 'login',
      query: to.path === '/' ? {} : { redirect: to.fullPath },
    }
  }

  if (to.path === '/') return landingPathForRole(user.value.role)
  if (!roleAllowed(to.fullPath, user.value.role)) return landingPathForRole(user.value.role)
  return true
})

onSessionCleared(() => {
  const current = router.currentRoute.value
  if (current.name === 'login') return
  void router.replace({
    name: 'login',
    query: current.path === '/' ? {} : { redirect: current.fullPath },
  })
})

export default router
