<script setup lang="ts">
defineProps<{ title?: string; subtitle?: string; tight?: boolean }>()
</script>

<template>
  <section class="card" :class="{ 'card-tight': tight }">
    <header v-if="title || subtitle || $slots.title || $slots.actions" class="card-head">
      <div class="card-head-text">
        <h2 v-if="title">{{ title }}</h2>
        <slot name="title" />
        <p v-if="subtitle" class="muted">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="card-actions"><slot name="actions" /></div>
    </header>
    <div class="card-body"><slot /></div>
    <footer v-if="$slots.footer" class="card-footer"><slot name="footer" /></footer>
  </section>
</template>
