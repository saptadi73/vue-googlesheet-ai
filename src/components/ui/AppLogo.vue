<script setup lang="ts">
import appIconUrl from '@/assets/images/google-ai-icon.jpg'

withDefaults(defineProps<{ size?: number }>(), { size: 32 })
</script>

<template>
  <img
    class="app-logo"
    :src="appIconUrl"
    :width="size"
    :height="size"
    alt=""
    aria-hidden="true"
    decoding="async"
  />
</template>

<style scoped>
.app-logo {
  display: block;
  flex: 0 0 auto;
  aspect-ratio: 1;
  border-radius: 22%;
  object-fit: cover;
  box-shadow: 0 1px 2px rgb(15 23 42 / 18%);
}
</style>