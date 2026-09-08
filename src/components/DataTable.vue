<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ rows: Record<string, unknown>[] }>()
const columns = computed(() => [...new Set(props.rows.flatMap(Object.keys))])
function display(value: unknown) {
  if (value === null || value === undefined) return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
</script>
<template>
  <p v-if="!rows.length" class="muted">Belum ada data untuk pilihan ini.</p>
  <div v-else class="scroll">
    <table>
      <thead>
        <tr>
          <th v-for="column in columns" :key="column">{{ column }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="index">
          <td v-for="column in columns" :key="column">{{ display(row[column]) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
