<script setup lang="ts">
import { RouterView } from 'vue-router'
import AiHelp from '@/components/AiHelp.vue'
import PageHelp from '@/components/PageHelp.vue'
import GlobalLoadingIndicator from '@/components/ui/GlobalLoadingIndicator.vue'
</script>

<template>
  <RouterView />
  <AiHelp />
  <PageHelp />
  <GlobalLoadingIndicator />
</template>
