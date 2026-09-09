<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
withDefaults(defineProps<{ label?: string; size?: number }>(), { size: 16 })
</script>

<template>
  <span class="spinner" role="status" :aria-label="label || 'Memuat'">
    <LoaderCircle :size="size" class="spinner-icon" /><span v-if="label">{{ label }}</span>
  </span>
</template>
