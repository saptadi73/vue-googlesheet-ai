<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'info' }>(), {
  tone: 'neutral',
})
</script>

<template>
  <span class="badge" :class="`badge-${tone}`"><slot /></span>
</template>
