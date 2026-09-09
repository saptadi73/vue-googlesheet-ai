<script setup lang="ts">
import { watch } from 'vue'
const props = defineProps<{ open: boolean; title?: string; wide?: boolean }>()
const emit = defineEmits<{ close: [] }>()
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}
watch(
  () => props.open,
  (open) => {
    if (open) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
      <div
        class="modal"
        :class="{ 'modal-wide': wide }"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <header class="modal-head">
          <h2 v-if="title">{{ title }}</h2>
          <slot name="title" />
          <button type="button" class="modal-close" aria-label="Tutup" @click="emit('close')">
            ✕
          </button>
        </header>
        <div class="modal-body"><slot /></div>
        <footer v-if="$slots.footer" class="modal-footer"><slot name="footer" /></footer>
      </div>
    </div>
  </Teleport>
</template>
