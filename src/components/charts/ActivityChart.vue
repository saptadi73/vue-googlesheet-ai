<script setup lang="ts">
import type { ApexOptions } from 'apexcharts'
import VueApexCharts from 'vue3-apexcharts/core'
import 'apexcharts/area'
import 'apexcharts/features/keyboard'

const options: ApexOptions = {
  chart: { type: 'area', toolbar: { show: false }, fontFamily: 'Inter Variable, sans-serif' },
  colors: ['#059669'],
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 3 },
  fill: { type: 'gradient', gradient: { opacityFrom: 0.25, opacityTo: 0.02 } },
  xaxis: { categories: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] },
  yaxis: { min: 0, title: { text: 'Baris' } },
  grid: { borderColor: '#e2e8f0' },
}
const series = [{ name: 'Baris diproses (contoh)', data: [120, 185, 160, 280, 240, 340, 410] }]
</script>

<template>
  <VueApexCharts type="area" height="300" :options="options" :series="series" />
</template>
