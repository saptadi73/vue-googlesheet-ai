import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
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
    { path: '/account', component: () => import('@/views/AccountView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
