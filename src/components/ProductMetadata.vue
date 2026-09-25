<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { call, user } from '@/lib/etl'
import type { Product } from '@/lib/catalog'
import { useTask } from '@/lib/tasks'

const props = defineProps<{ product: Product; disabled?: boolean }>()
const emit = defineEmits<{ saved: [product: Product]; reload: [] }>()
const { busy, error, notice, run } = useTask()
const name = ref(''),
  description = ref(''),
  conflict = ref(false)
const metricEdits = ref<Array<{ code: string; unit: string; synonyms: string }>>([])
function metricChanges() {
  return metricEdits.value.flatMap((edit) => {
    const original = props.product.metrics.find((metric) => metric.code === edit.code)
    const synonyms = edit.synonyms
      .split('\n')
      .map((value) => value.trim().replace(/\s+/g, ' '))
      .filter(Boolean)
    const unit = edit.unit.trim() || null
    return unit !== (original?.unit ?? null) ||
      JSON.stringify(synonyms) !== JSON.stringify(original?.synonyms ?? [])
      ? [{ code: edit.code, unit, synonyms }]
      : []
  })
}
const manager = computed(() => ['PLATFORM_ADMIN', 'DATA_STEWARD'].includes(user.value?.role || ''))
const dirty = computed(
  () =>
    name.value !== props.product.name ||
    description.value !== props.product.description ||
    metricChanges().length > 0,
)
let generation = 0
watch(
  [() => props.product, user],
  () => {
    ++generation
    name.value = props.product.name
    description.value = props.product.description
    metricEdits.value = props.product.metrics.map((metric) => ({
      code: metric.code,
      unit: metric.unit ?? '',
      synonyms: (metric.synonyms ?? []).join('\n'),
    }))
    conflict.value = false
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  ++generation
})
async function save() {
  if (!manager.value || !dirty.value || conflict.value || props.disabled) return
  if (!name.value.trim()) throw new Error('Nama bisnis produk wajib diisi.')
  const metrics = metricChanges()
  if (
    metrics.some(
      (metric) =>
        metric.synonyms.length > 20 ||
        metric.synonyms.some((value) => value.length > 100) ||
        new Set(metric.synonyms.map((value) => value.toLowerCase())).size !==
          metric.synonyms.length,
    )
  )
    throw new Error('Maksimal 20 sinonim unik per metrik, masing-masing 100 karakter.')
  const epoch = generation
  try {
    const updated = await call<Product>('PATCH', `/semantic/data-products/${props.product.id}`, {
      name: name.value.trim(),
      description: description.value,
      expected_version: props.product.version,
      ...(metrics.length ? { metric_metadata: metrics } : {}),
    })
    if (epoch !== generation) return
    emit('saved', updated)
    notice.value =
      'Metadata tersimpan. Validasi dan aktifkan ulang template yang memakai versi semantic lama.'
  } catch (failure) {
    if (
      epoch === generation &&
      axios.isAxiosError(failure) &&
      failure.response?.data?.errors?.some(
        (issue: { code: string }) => issue.code === 'PRODUCT_VERSION_CONFLICT',
      )
    )
      conflict.value = true
    throw failure
  }
}
</script>
<template>
  <details v-if="manager">
    <summary>Edit metadata bisnis produk</summary>
    <p>Perubahan menaikkan versi semantic. Template lama perlu divalidasi dan diaktifkan ulang.</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="notice" role="status" class="success">{{ notice }}</p>
    <p v-if="conflict" class="error">
      Produk berubah di server. Edit lokal dipertahankan. Salin edit yang diperlukan sebelum memuat
      ulang katalog.
    </p>
    <form @submit.prevent="run(save)">
      <fieldset :disabled="busy || disabled">
        <label>Nama bisnis produk<input v-model="name" required maxlength="200" /></label>
        <label>Deskripsi bisnis produk<textarea v-model="description" maxlength="4000" /></label>
        <section v-if="metricEdits.length">
          <h3>Unit dan sinonim metrik</h3>
          <p>
            Unit hanya label; tidak mengonversi nilai. Sinonim membantu mengenali metrik. Query
            tetap memakai kode metrik resmi.
          </p>
          <div v-for="metric in metricEdits" :key="metric.code" class="card-row">
            <p>Kode metrik: {{ metric.code }}</p>
            <label
              >Unit {{ metric.code
              }}<input v-model="metric.unit" maxlength="40" placeholder="Contoh: IDR, kg, orang"
            /></label>
            <label
              >Sinonim {{ metric.code }} (satu per baris)<textarea v-model="metric.synonyms" />
            </label>
          </div>
        </section>
        <button :disabled="!dirty || conflict || !name.trim()">Simpan metadata produk</button>
        <button v-if="conflict" type="button" @click="emit('reload')">
          Muat ulang metadata / batalkan edit lokal
        </button>
      </fieldset>
    </form>
  </details>
</template>
