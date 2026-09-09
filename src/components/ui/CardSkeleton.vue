<script setup lang="ts">
import Skeleton from './Skeleton.vue'
withDefaults(defineProps<{ rows?: number }>(), { rows: 3 })
</script>

<template>
  <section class="card">
    <div class="card-head">
      <div class="card-head-text">
        <Skeleton width="40%" height="20px" />
        <Skeleton width="60%" height="13px" />
      </div>
    </div>
    <div class="card-body">
      <Skeleton variant="text" :lines="rows" height="13px" />
    </div>
  </section>
</template>
