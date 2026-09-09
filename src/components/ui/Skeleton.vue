<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'text' | 'block' | 'circle'
    width?: string
    height?: string
    lines?: number
  }>(),
  { variant: 'text', width: '100%', height: '', lines: 1 },
)
</script>

<template>
  <span
    v-if="variant !== 'text' || lines <= 1"
    class="skeleton"
    :class="`skeleton-${variant}`"
    :style="{ width, height: height || undefined }"
  />
  <span v-else class="skeleton-lines">
    <span
      v-for="i in lines"
      :key="i"
      class="skeleton skeleton-text"
      :style="{ width: i === lines ? '65%' : width }"
    />
  </span>
</template>
