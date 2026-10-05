<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown } from '@lucide/vue'

defineProps<{ label: string }>()
const menu = ref<HTMLDetailsElement>()
const route = useRoute()

function close(restoreFocus = false) {
  if (!menu.value?.open) return
  menu.value.open = false
  if (restoreFocus) menu.value.querySelector('summary')?.focus()
}
function onPointer(event: PointerEvent) {
  if (event.target instanceof Node && !menu.value?.contains(event.target)) close()
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') close(true)
}
watch(
  () => route.fullPath,
  () => close(),
)
onMounted(() => document.addEventListener('pointerdown', onPointer))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointer))
</script>

<template>
  <details ref="menu" class="app-menu-dropdown" @keydown="onKey">
    <summary :aria-label="label">
      <slot name="trigger">{{ label }}</slot>
      <ChevronDown :size="14" aria-hidden="true" />
    </summary>
    <div class="app-menu-panel" @click="close()">
      <slot />
    </div>
  </details>
</template>
