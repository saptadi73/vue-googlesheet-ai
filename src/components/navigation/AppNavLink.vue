<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { activeNavigationPath, type NavigationItem } from '@/lib/navigation'

const props = defineProps<{ item: NavigationItem }>()
const route = useRoute()
const active = computed(() => activeNavigationPath(route.path) === props.item.to)
</script>

<template>
  <RouterLink
    :to="item.to"
    class="app-nav-link"
    :class="{ 'is-active': active }"
    :aria-current="active ? 'page' : undefined"
  >
    <component :is="item.icon" :size="18" aria-hidden="true" />
    <span>{{ item.label }}</span>
  </RouterLink>
</template>

<style scoped>
.app-nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 9px;
  color: var(--muted);
  font-weight: 500;
  white-space: nowrap;
  text-decoration: none;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.app-nav-link:hover {
  color: var(--brand-dark);
  background: #f0f7f3;
}
.app-nav-link.is-active {
  color: var(--brand-dark);
  background: #e5f4ec;
  font-weight: 650;
  box-shadow: inset 3px 0 var(--brand);
}
.app-nav-link svg {
  flex-shrink: 0;
}
</style>
