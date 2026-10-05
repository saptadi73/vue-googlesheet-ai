<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import AppNavLink from './AppNavLink.vue'
import type { NavigationGroup } from '@/lib/navigation'

const props = defineProps<{ groups: NavigationGroup[]; open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const desktopQuery = window.matchMedia('(min-width: 1024px)')
const desktop = ref(desktopQuery.matches)
const container = ref<HTMLElement>()

async function syncDialog() {
  await nextTick()
  const dialog = container.value
  if (!(dialog instanceof HTMLDialogElement)) return
  if (props.open && !dialog.open) dialog.showModal()
  else if (!props.open && dialog.open) dialog.close()
}
function onResize() {
  desktop.value = desktopQuery.matches
  emit('close')
}
function trapFocus(event: KeyboardEvent) {
  if (desktop.value || event.key !== 'Tab') return
  const controls = container.value?.querySelectorAll<HTMLElement>('button, a[href]')
  if (!controls?.length) return
  const first = controls[0]!
  const last = controls[controls.length - 1]!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
watch([() => props.open, desktop], syncDialog)
watch(
  () => props.open && !desktop.value,
  (open) => {
    document.body.classList.toggle('app-drawer-open', open)
  },
)
onMounted(() => {
  desktopQuery.addEventListener('change', onResize)
  void syncDialog()
})
onBeforeUnmount(() => {
  desktopQuery.removeEventListener('change', onResize)
  document.body.classList.remove('app-drawer-open')
})
</script>

<template>
  <component
    :is="desktop ? 'aside' : 'dialog'"
    id="operational-sidebar"
    ref="container"
    class="app-sidebar"
    :class="{ 'app-sidebar-drawer': !desktop }"
    aria-label="Menu operasional"
    @cancel.prevent="emit('close')"
    @close="emit('close')"
    @click.self="!desktop && emit('close')"
    @keydown="trapFocus"
  >
    <div class="app-sidebar-inner">
      <div class="app-sidebar-heading">
        <div>
          <strong>Workspace</strong>
          <span>Google Sheet AI</span>
        </div>
        <button
          v-if="!desktop"
          type="button"
          aria-label="Tutup menu operasional"
          @click="emit('close')"
        >
          <X :size="20" aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="Operasional">
        <section v-for="group in groups" :key="group.label" class="app-nav-group">
          <h2>{{ group.label }}</h2>
          <AppNavLink
            v-for="item in group.items"
            :key="item.to"
            :item="item"
            @click="emit('close')"
          />
        </section>
      </nav>
      <div class="app-sidebar-footer">Workspace data &amp; analitik</div>
    </div>
  </component>
</template>
