<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import VueApexCharts from 'vue3-apexcharts/core'
import 'apexcharts/area'
import 'apexcharts/bar'
import 'apexcharts/column'
import 'apexcharts/donut'
import 'apexcharts/heatmap'
import 'apexcharts/line'
import 'apexcharts/pie'
import 'apexcharts/scatter'
import 'apexcharts/features/exports'
import 'apexcharts/features/legend'
import 'apexcharts/features/toolbar'
import type { ApexOptions } from 'apexcharts'
import type { VisualizationSpec, VisualizationType } from '@/lib/catalog'

const props = defineProps<{
  rows: Record<string, unknown>[]
  visualization?: VisualizationSpec | null
}>()
const emit = defineEmits<{ change: [spec: VisualizationSpec] }>()
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
const chartType = ref<VisualizationType>('bar'),
  primaryMetric = ref(''),
  secondaryMetric = ref(''),
  xField = ref(''),
  yField = ref(''),
  title = ref('')
let initializing = false

const availableTypes = computed<VisualizationType[]>(() => {
  const result: VisualizationType[] = ['table']
  if (numeric.value.length) result.push('kpi')
  if (numeric.value.length && labels.value.length)
    result.push('bar', 'line', 'area', 'pie', 'donut')
  if (numeric.value.length >= 2 && labels.value.length) result.push('combo')
  if (numeric.value.length >= 2) result.push('scatter')
  if (numeric.value.length && labels.value.length >= 2) result.push('heatmap')
  return result
})
function inferredType(): VisualizationType {
  if (props.rows.length === 1 && numeric.value.length) return 'kpi'
  if (labels.value.some((field) => /date|time|month|year|tanggal|bulan|tahun/i.test(field)))
    return 'line'
  return numeric.value.length && labels.value.length ? 'bar' : 'table'
}
function loadControls() {
  initializing = true
  const current = props.visualization
  chartType.value =
    current && availableTypes.value.includes(current.type) ? current.type : inferredType()
  primaryMetric.value = current?.series[0]?.field || numeric.value[0] || ''
  secondaryMetric.value = current?.series[1]?.field || numeric.value[1] || numeric.value[0] || ''
  xField.value = current?.x_field || labels.value[0] || ''
  yField.value = current?.y_field || labels.value[1] || ''
  title.value = current?.title || ''
  queueMicrotask(() => (initializing = false))
}
watch(() => [props.rows, props.visualization], loadControls, { immediate: true, deep: true })

const spec = computed<VisualizationSpec>(() => {
  const type = chartType.value
  if (type === 'table')
    return { type, title: title.value, x_field: null, y_field: null, series: [] }
  const series: VisualizationSpec['series'] = [
    {
      field: primaryMetric.value,
      type: type === 'line' ? 'line' : type === 'area' ? 'area' : 'bar',
      axis: 'left',
    },
  ]
  if (type === 'combo') series.push({ field: secondaryMetric.value, type: 'line', axis: 'right' })
  if (type === 'scatter') series.push({ field: secondaryMetric.value, type: 'line', axis: 'left' })
  return {
    type,
    title: title.value,
    x_field: ['kpi', 'scatter'].includes(type) ? null : xField.value,
    y_field: type === 'heatmap' ? yField.value : null,
    series,
  }
})
watch([chartType, primaryMetric, secondaryMetric, xField, yField, title], () => {
  if (!initializing) emit('change', spec.value)
})

const limitedRows = computed(() => props.rows.slice(0, 100))
const categories = computed(() =>
  limitedRows.value.map((row, index) => String(row[xField.value] ?? index + 1)),
)
const standardSeries = computed(() => {
  if (chartType.value === 'scatter')
    return [
      {
        name: secondaryMetric.value,
        data: limitedRows.value.map((row) => [
          row[primaryMetric.value],
          row[secondaryMetric.value],
        ]),
      },
    ]
  if (chartType.value === 'heatmap') {
    const groups = new Map<string, Array<{ x: string; y: number | null }>>()
    for (const row of limitedRows.value) {
      const name = String(row[yField.value] ?? '—'),
        data = groups.get(name) || []
      data.push({
        x: String(row[xField.value] ?? '—'),
        y: row[primaryMetric.value] as number | null,
      })
      groups.set(name, data)
    }
    return [...groups].map(([name, data]) => ({ name, data }))
  }
  const fields =
    chartType.value === 'combo'
      ? [primaryMetric.value, secondaryMetric.value]
      : [primaryMetric.value]
  return fields.map((field, index) => ({
    name: field,
    ...(chartType.value === 'combo' ? { type: index ? 'line' : 'column' } : {}),
    data: limitedRows.value.map((row) => row[field] as number | null),
  }))
})
const apexType = computed<'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'heatmap'>(() => {
  if (chartType.value === 'combo') return 'line'
  if (['table', 'kpi'].includes(chartType.value)) return 'bar'
  return chartType.value as 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'heatmap'
})
const options = computed<ApexOptions>(() => ({
  chart: {
    type: apexType.value as 'bar',
    toolbar: { show: true },
    fontFamily: 'Inter Variable, sans-serif',
  },
  title: { text: title.value || undefined },
  colors: ['#059669', '#2563eb', '#d97706', '#7c3aed'],
  dataLabels: { enabled: ['pie', 'donut'].includes(chartType.value) },
  ...(['pie', 'donut'].includes(chartType.value) ? { labels: categories.value } : {}),
  ...(!['pie', 'donut', 'scatter', 'heatmap'].includes(chartType.value)
    ? { xaxis: { categories: categories.value } }
    : {}),
  ...(chartType.value === 'combo'
    ? {
        yaxis: [
          { title: { text: primaryMetric.value } },
          { opposite: true, title: { text: secondaryMetric.value } },
        ],
      }
    : {}),
}))
const pieSeries = computed(() =>
  limitedRows.value.map((row) => Number(row[primaryMetric.value] ?? 0)),
)
</script>

<template>
  <details v-if="numeric.length">
    <summary>Visualisasi hasil</summary>
    <div class="grid">
      <label
        >Jenis grafik<select v-model="chartType">
          <option v-for="item in availableTypes" :key="item" :value="item">{{ item }}</option>
        </select></label
      >
      <label>Judul<input v-model="title" maxlength="200" /></label>
      <label v-if="chartType !== 'table'"
        >Metrik utama<select v-model="primaryMetric">
          <option v-for="field in numeric" :key="field">{{ field }}</option>
        </select></label
      >
      <label v-if="['combo', 'scatter'].includes(chartType)"
        >Metrik kedua<select v-model="secondaryMetric">
          <option v-for="field in numeric" :key="field">{{ field }}</option>
        </select></label
      >
      <label v-if="!['table', 'kpi', 'scatter'].includes(chartType)"
        >Dimensi X<select v-model="xField">
          <option v-for="field in labels" :key="field">{{ field }}</option>
        </select></label
      >
      <label v-if="chartType === 'heatmap'"
        >Dimensi Y<select v-model="yField">
          <option v-for="field in labels" :key="field">{{ field }}</option>
        </select></label
      >
    </div>
    <p class="muted">
      Grafik memakai maksimal 100 baris dari halaman hasil. Tabel hasil tetap menjadi sumber detail.
    </p>
    <div v-if="chartType === 'kpi'" class="panel">
      <p class="eyebrow">{{ title || primaryMetric }}</p>
      <h2>{{ rows[0]?.[primaryMetric] ?? '—' }}</h2>
    </div>
    <p v-else-if="chartType === 'table'" class="notice">
      Gunakan tabel hasil di bawah untuk tampilan ini.
    </p>
    <VueApexCharts
      v-else
      :key="chartType"
      :type="apexType"
      height="360"
      :options="options"
      :series="['pie', 'donut'].includes(chartType) ? pieSeries : standardSeries"
    />
  </details>
</template>
