<script setup lang="ts">
import { computed, ref } from 'vue'
import VueApexCharts from 'vue3-apexcharts/core'
import 'apexcharts/bar'
import 'apexcharts/line'
import 'apexcharts/features/legend'
import 'apexcharts/features/toolbar'
import type { ApexOptions } from 'apexcharts'

const props = defineProps<{
  rows: Record<string, unknown>[]
  categoryField: string
  series: { field: string; name: string }[]
}>()
const chartStyle = ref<'bar' | 'combo'>('bar')
const categories = computed(() => props.rows.map((row) => String(row[props.categoryField] ?? 'Total')))
const chartSeries = computed(() =>
  props.series.map((item, index) => ({
    name: item.name,
    type: chartStyle.value === 'combo' && index > 0 ? 'line' : 'column',
    data: props.rows.map((row) => Number(row[item.field] ?? 0)),
  })),
)
const options = computed<ApexOptions>(() => ({
  chart: { type: 'line', toolbar: { show: true }, fontFamily: 'Inter Variable, sans-serif' },
  colors: ['#059669', '#2563eb', '#d97706', '#7c3aed'],
  stroke: { width: chartStyle.value === 'combo' ? [0, ...props.series.slice(1).map(() => 3)] : [0] },
  xaxis: { categories: categories.value, title: { text: 'Periode / kategori' } },
  yaxis: [{ title: { text: 'Nilai' } }],
  legend: { position: 'bottom' },
  dataLabels: { enabled: false },
}))
</script>

<template>
  <section class="panel multi-query-chart">
    <div class="toolbar">
      <h3>Visualisasi gabungan</h3>
      <label>Jenis grafik
        <select v-model="chartStyle">
          <option value="bar">Multi bar</option>
          <option value="combo">Bar + line</option>
        </select>
      </label>
    </div>
    <VueApexCharts type="line" height="360" :options="options" :series="chartSeries" />
  </section>
</template>

<style scoped>
.multi-query-chart { margin-top: 18px; }
.multi-query-chart h3 { margin: 0; }
.multi-query-chart label { display: flex; align-items: center; gap: 8px; }
@media (max-width: 640px) { .multi-query-chart .toolbar { align-items: flex-start; flex-direction: column; } }
</style>
