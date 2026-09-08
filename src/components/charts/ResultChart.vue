<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import VueApexCharts from 'vue3-apexcharts/core'
import 'apexcharts/bar'
import type { ApexOptions } from 'apexcharts'
const props = defineProps<{ rows: Record<string, unknown>[] }>()
const numeric = computed(() =>
  Object.keys(props.rows[0] || {}).filter(
    (key) =>
      props.rows.some((row) => typeof row[key] === 'number') &&
      props.rows.every((row) => row[key] == null || typeof row[key] === 'number'),
  ),
)
const labels = computed(() =>
  Object.keys(props.rows[0] || {}).filter((key) => !numeric.value.includes(key)),
)
const metric = ref(''),
  dimension = ref('')
watch(
  () => props.rows,
  () => {
    metric.value = numeric.value[0] || ''
    dimension.value = labels.value[0] || ''
  },
  { immediate: true },
)
const series = computed(() => [
  {
    name: metric.value,
    data: props.rows.slice(0, 50).map((row) => row[metric.value] as number | null),
  },
])
const options = computed<ApexOptions>(() => ({
  chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Inter Variable, sans-serif' },
  colors: ['#059669'],
  dataLabels: { enabled: false },
  xaxis: {
    categories: props.rows
      .slice(0, 50)
      .map((row, i) => (dimension.value ? String(row[dimension.value] ?? '—') : String(i + 1))),
  },
}))
</script>
<template>
  <details v-if="numeric.length">
    <summary>Visualisasi hasil</summary>
    <div class="grid">
      <label
        >Metrik<select v-model="metric">
          <option v-for="key in numeric" :key="key">{{ key }}</option>
        </select></label
      ><label
        >Label<select v-model="dimension">
          <option value="">Nomor baris</option>
          <option v-for="key in labels" :key="key">{{ key }}</option>
        </select></label
      >
    </div>
    <p class="muted">Grafik menampilkan maksimal 50 baris dari halaman hasil.</p>
    <VueApexCharts type="bar" height="320" :options="options" :series="series" />
  </details>
</template>
