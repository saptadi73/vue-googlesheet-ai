<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { call, editRoles, user } from '@/lib/etl'
import type { Column, Metric } from '@/lib/etl'
import type { Product } from '@/lib/catalog'
import { useTask } from '@/lib/tasks'

type ColumnEdit = { target_column: string; business_name: string; description: string; synonyms: string }
type MetricEdit = { code: string; label: string; column: string; aggregation: string; description: string; unit: string; synonyms: string }
const props = defineProps<{ product: Product; disabled?: boolean }>()
const emit = defineEmits<{ saved: [product: Product]; reload: [] }>()
const { busy, error, notice, run } = useTask()
const name = ref(''), description = ref(''), conflict = ref(false)
const dimensions = ref<string[]>([])
const columnEdits = ref<ColumnEdit[]>([])
const metricEdits = ref<MetricEdit[]>([])
const manager = computed(() => editRoles.includes(user.value?.role || ''))
const publicColumns = computed(() => props.product.columns.filter((column) => ['NONE', 'LOW'].includes(column.pii_classification)))
const numericTypes = ['smallint', 'integer', 'bigint', 'numeric', 'decimal', 'real', 'double precision']
const aggregations = ['sum', 'avg', 'min', 'max', 'count', 'count_distinct']
const dimensionsChanged = computed(() => JSON.stringify([...dimensions.value].sort()) !== JSON.stringify([...(props.product.dimensions || [])].sort()))
function terms(value?: string[]) { return (value || []).join('\n') }
function parseTerms(value: string) { return value.split('\n').map((term) => term.trim().replace(/\s+/g, ' ')).filter(Boolean) }
function columnChanges() {
  return columnEdits.value.flatMap((edit) => {
    const original = props.product.columns.find((column) => column.target_column === edit.target_column)
    const synonyms = parseTerms(edit.synonyms)
    if (!original || edit.business_name === (original.business_name || '') && edit.description === (original.description || '') && JSON.stringify(synonyms) === JSON.stringify(original.synonyms || [])) return []
    return [{ target_column: edit.target_column, business_name: edit.business_name, description: edit.description, synonyms }]
  })
}
function metricPayload(): Metric[] {
  return metricEdits.value.map((metric) => ({
    code: metric.code.trim(), label: metric.label.trim(), column: metric.column,
    aggregation: metric.aggregation, description: metric.description.trim(),
    unit: metric.unit.trim() || null, synonyms: parseTerms(metric.synonyms),
  }))
}
function metricChanges() { return JSON.stringify(metricPayload()) !== JSON.stringify((props.product.metrics || []).map((metric) => ({
  code: metric.code, label: metric.label || '', column: metric.column, aggregation: metric.aggregation,
  description: metric.description || '', unit: metric.unit || null, synonyms: metric.synonyms || [],
}))) }
const metricsChanged = computed(metricChanges)
const dirty = computed(() => name.value !== props.product.name || description.value !== props.product.description || dimensionsChanged.value || columnChanges().length > 0 || metricsChanged.value)
let generation = 0
watch([() => props.product, user], () => {
  ++generation
  name.value = props.product.name
  description.value = props.product.description || ''
  dimensions.value = [...(props.product.dimensions || [])]
  columnEdits.value = publicColumns.value.map((column: Column) => ({
    target_column: column.target_column, business_name: column.business_name || '',
    description: column.description || '', synonyms: terms(column.synonyms),
  }))
  metricEdits.value = (props.product.metrics || []).map((metric: Metric) => ({
    code: metric.code, label: metric.label || '', column: metric.column, aggregation: metric.aggregation,
    description: metric.description || '', unit: metric.unit || '', synonyms: terms(metric.synonyms),
  }))
  conflict.value = false
}, { immediate: true })
onBeforeUnmount(() => { ++generation })
function addMetric() {
  const index = metricEdits.value.length + 1
  metricEdits.value.push({ code: `metric_${index}`, label: '', column: publicColumns.value.find((column) => numericTypes.includes(column.target_type))?.target_column || publicColumns.value[0]?.target_column || '', aggregation: 'sum', description: '', unit: '', synonyms: '' })
}
async function save() {
  if (!manager.value || !dirty.value || conflict.value || props.disabled) return
  if (!name.value.trim()) throw new Error('Nama bisnis produk wajib diisi.')
  if (new Set(dimensions.value).size !== dimensions.value.length) throw new Error('Dimensi tidak boleh berulang.')
  const metrics = metricPayload()
  const metricCodes = new Set<string>()
  for (const metric of metrics) {
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(metric.code)) throw new Error(`Kode metrik ${metric.code || '(kosong)'} harus huruf kecil, angka, dan garis bawah.`)
    if (metricCodes.has(metric.code)) throw new Error(`Kode metrik ${metric.code} berulang.`)
    metricCodes.add(metric.code)
    if (!publicColumns.value.some((column) => column.target_column === metric.column)) throw new Error(`Kolom metrik ${metric.code} tidak tersedia atau sensitif.`)
    if (['sum', 'avg'].includes(metric.aggregation) && !numericTypes.includes(publicColumns.value.find((column) => column.target_column === metric.column)?.target_type || '')) throw new Error(`Agregasi ${metric.aggregation} hanya boleh memakai kolom numerik.`)
    const synonyms = metric.synonyms || []
    if (synonyms.length > 20 || synonyms.some((term) => term.length > 100) || new Set(synonyms.map((term) => term.toLocaleLowerCase())).size !== synonyms.length) throw new Error(`Sinonim metrik ${metric.code} harus unik; maksimal 20 istilah, 100 karakter per istilah.`)
  }
  for (const edit of columnEdits.value) {
    const synonyms = parseTerms(edit.synonyms)
    if (synonyms.length > 20 || synonyms.some((term) => term.length > 100) || new Set(synonyms.map((term) => term.toLocaleLowerCase())).size !== synonyms.length) throw new Error(`Sinonim kolom ${edit.target_column} harus unik; maksimal 20 istilah, 100 karakter per istilah.`)
  }
  const epoch = generation
  const column_metadata = columnChanges()
  let updated: Product
  try {
    updated = await call<Product>('PATCH', `/semantic/data-products/${props.product.id}`, {
      expected_version: props.product.version,
      ...(name.value !== props.product.name ? { name: name.value.trim() } : {}),
      ...(description.value !== (props.product.description || '') ? { description: description.value } : {}),
      ...(dimensionsChanged.value ? { dimensions: dimensions.value } : {}),
      ...(metricsChanged.value ? { metric_definitions: metrics } : {}),
      ...(column_metadata.length ? { column_metadata } : {}),
    })
  } catch (failure) {
    if (axios.isAxiosError(failure) && failure.response?.status === 409 && failure.response.data?.errors?.some((item: { code?: string }) => item.code === 'PRODUCT_VERSION_CONFLICT')) {
      conflict.value = true
      return
    }
    throw failure
  }
  if (epoch !== generation) return
  emit('saved', updated)
  notice.value = 'Metadata katalog tersimpan tanpa menjalankan ulang ETL atau memuat ulang data.'
}
</script>
<template>
  <details v-if="manager" class="product-metadata-editor">
    <summary>Edit metadata semantik untuk NL2SQL</summary>
    <p>Perubahan ini hanya memperbarui katalog; tidak menjalankan ulang ETL. Tentukan arti dan agregasi dengan benar sebelum menyimpan.</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="notice" role="status" class="success">{{ notice }}</p>
    <p v-if="conflict" role="alert" class="error">Versi metadata berubah di server. Muat ulang sebelum menyimpan lagi.</p>
    <form @submit.prevent="run(save)">
      <fieldset :disabled="busy || disabled">
        <label>Nama bisnis produk<input v-model="name" required maxlength="200" /></label>
        <label>Deskripsi bisnis produk<textarea v-model="description" maxlength="4000" placeholder="Isi data, arti bisnis, cakupan periode, dan satu baris mewakili apa" /></label>
        <section>
          <h3>Arti kolom</h3>
          <p>Lengkapi nama, penjelasan, dan istilah lain yang digunakan steward. Kolom sensitif tidak dapat diedit di sini.</p>
          <div v-for="column in columnEdits" :key="column.target_column" class="metadata-card">
            <strong>{{ column.target_column }}</strong><small>{{ publicColumns.find((item) => item.target_column === column.target_column)?.source_column }} ? {{ publicColumns.find((item) => item.target_column === column.target_column)?.target_type }}</small>
            <label>Nama bisnis<input v-model="column.business_name" maxlength="200" :aria-label="`Nama bisnis ${column.target_column}`" /></label>
            <label>Deskripsi kolom<textarea v-model="column.description" maxlength="1000" :aria-label="`Deskripsi kolom ${column.target_column}`" /></label>
            <label>Sinonim (satu per baris)<textarea v-model="column.synonyms" :aria-label="`Sinonim kolom ${column.target_column}`" placeholder="Contoh: cabang, unit kerja" /></label>
          </div>
        </section>
        <section>
          <h3>Dimensi untuk filter dan pengelompokan</h3>
          <label v-for="column in publicColumns" :key="column.target_column" class="check">
            <input v-model="dimensions" type="checkbox" :value="column.target_column" />{{ column.business_name || column.target_column }} ? {{ column.target_column }}
          </label>
        </section>
        <section>
          <h3>Metrik untuk perhitungan</h3>
          <p>SUM/AVG hanya untuk angka. Persentase umumnya tidak dijumlahkan; tentukan rumus bisnis yang tepat.</p>
          <div v-for="(metric, index) in metricEdits" :key="index" class="metadata-card">
            <div class="metric-grid">
              <label>Kode metrik<input v-model="metric.code" required pattern="[a-z][a-z0-9_]*" maxlength="63" :aria-label="`Kode metrik baris ${index + 1}`" /></label>
              <label>Nama tampil<input v-model="metric.label" maxlength="200" :aria-label="`Nama metrik baris ${index + 1}`" /></label>
              <label>Kolom sumber<select v-model="metric.column" :aria-label="`Kolom metrik baris ${index + 1}`"><option v-for="column in publicColumns" :key="column.target_column" :value="column.target_column">{{ column.business_name || column.target_column }} ? {{ column.target_column }}</option></select></label>
              <label>Agregasi<select v-model="metric.aggregation" :aria-label="`Agregasi metrik baris ${index + 1}`"><option v-for="aggregation in aggregations" :key="aggregation" :value="aggregation">{{ aggregation }}</option></select></label>
              <label>Satuan<input v-model="metric.unit" maxlength="40" :aria-label="`Satuan metrik baris ${index + 1}`" placeholder="IDR, kg, orang" /></label>
            </div>
            <label>Deskripsi metrik<textarea v-model="metric.description" maxlength="1000" :aria-label="`Deskripsi metrik baris ${index + 1}`" placeholder="Jelaskan definisi dan aturan hitung" /></label>
            <label>Sinonim metrik (satu per baris)<textarea v-model="metric.synonyms" :aria-label="`Sinonim metrik baris ${index + 1}`" placeholder="Contoh: penjualan bersih, total revenue" /></label>
            <button type="button" @click="metricEdits.splice(index, 1)">Hapus metrik</button>
          </div>
          <button type="button" @click="addMetric">Tambah metrik</button>
        </section>
        <button :disabled="!dirty || !name.trim() || conflict">Simpan metadata katalog</button>
      </fieldset>
      <button v-if="conflict" type="button" @click="emit('reload')">Muat ulang metadata / batalkan edit lokal</button>
    </form>
  </details>
</template>
<style scoped>
.product-metadata-editor { margin-top: 20px; padding-top: 16px; border-top: 1px solid #dce8e2; }
.product-metadata-editor section { margin: 18px 0; }
.metadata-card { border: 1px solid #dce8e2; border-radius: 10px; padding: 12px; margin: 10px 0; }
.metadata-card small { display: block; color: #62796c; margin: 4px 0 10px; }
.metadata-card label, .product-metadata-editor form > fieldset > label { display: block; margin: 8px 0; }
.metadata-card input, .metadata-card select, .metadata-card textarea, .product-metadata-editor input, .product-metadata-editor textarea { display: block; width: 100%; }
.metric-grid { display: grid; grid-template-columns: repeat(3, minmax(150px, 1fr)); gap: 10px; }
.check { display: inline-flex; align-items: center; gap: 8px; margin: 6px 14px 6px 0; }
.check input { width: auto; }
@media (max-width: 700px) { .metric-grid { grid-template-columns: 1fr; } }
</style>
