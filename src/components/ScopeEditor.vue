<script setup lang="ts">
import { computed, ref, watch } from 'vue'
const model = defineModel<Record<string, Record<string, unknown[]>>>({ required: true })
const entries = ref<{ product: string; field: string; values: string }[]>([])
const message = ref('')
const applied = ref('')
const pending = computed(() => JSON.stringify(entries.value) !== applied.value)
const emit = defineEmits<{ pending: [value: boolean] }>()
watch(pending, (value) => emit('pending', value), { immediate: true, flush: 'sync' })
watch(
  model,
  (value) => {
    entries.value = Object.entries(value).flatMap(([product, fields]) =>
      Object.entries(fields).map(([field, values]) => ({
        product,
        field,
        values: values.map((v) => JSON.stringify(v)).join('\n'),
      })),
    )
    applied.value = JSON.stringify(entries.value)
    message.value = ''
  },
  { immediate: true },
)
function apply() {
  try {
    const result: Record<string, Record<string, unknown[]>> = Object.create(null)
    for (const item of entries.value) {
      if (!item.product.trim() || !item.field.trim())
        throw new Error('Isi produk dan dimensi pada setiap batasan.')
      const values = item.values
        .split('\n')
        .filter((v) => v.trim())
        .map((text) => {
          try {
            const value: unknown = JSON.parse(text)
            if (value !== null && typeof value === 'object') throw new Error()
            return value
          } catch {
            return text
          }
        })
      const product = item.product.trim(),
        field = item.field.trim()
      result[product] ??= Object.create(null) as Record<string, unknown[]>
      if (Object.hasOwn(result[product]!, field))
        throw new Error('Produk dan dimensi yang sama tidak boleh diulang.')
      result[product]![field] = values
    }
    model.value = result
    message.value = 'Batasan telah diterapkan ke form. Simpan pengguna untuk mengirim perubahan.'
  } catch (e) {
    message.value = e instanceof Error ? e.message : 'Batasan tidak valid.'
  }
}
</script>
<template>
  <div>
    <p class="muted">
      Tanpa batasan berarti seluruh baris yang diizinkan role. Daftar nilai kosong pada sebuah
      dimensi berarti tidak ada baris yang diizinkan. Angka/boolean dibaca sesuai tipe; gunakan
      tanda kutip untuk kode teks seperti "001".
    </p>
    <div v-for="(entry, index) in entries" :key="index" class="card-row grid">
      <label>Kode produk<input v-model="entry.product" /></label
      ><label>Dimensi<input v-model="entry.field" /></label
      ><label>Nilai yang diizinkan (satu per baris)<textarea v-model="entry.values" /></label
      ><button type="button" @click="entries.splice(index, 1)">Hapus batasan</button>
    </div>
    <div class="toolbar">
      <button type="button" @click="entries.push({ product: '', field: '', values: '' })">
        Tambah batasan baris</button
      ><button type="button" @click="apply">Terapkan batasan ke form</button>
    </div>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="pending" class="notice">
      Ada batasan yang belum diterapkan. Terapkan ke form sebelum menyimpan pengguna.
    </p>
    <details>
      <summary>Batasan yang akan dikirim saat disimpan</summary>
      <pre>{{ JSON.stringify(model, null, 2) }}</pre>
    </details>
  </div>
</template>
