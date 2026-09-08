<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { call, user, editRoles, reviewRoles, type SheetClassification } from '@/lib/etl'
import { useTask } from '@/lib/tasks'
const props = defineProps<{
  sheetId: string
  sourceId: string
  disabled?: boolean
  active?: boolean
}>()
const emit = defineEmits<{ changed: [classification: SheetClassification] }>()
const { busy, error, notice, run } = useTask()
const classification = ref<SheetClassification | null>(null)
const choice = ref<'' | 'MASTER' | 'NON_MASTER'>('')
const editor = computed(() => editRoles.includes(user.value?.role || ''))
async function load() {
  const id = props.sheetId
  const result = await call<SheetClassification>('GET', `/source-sheets/${id}/classification`)
  if (id !== props.sheetId) return
  classification.value = result
  choice.value = result.dataset_kind || ''
}
async function save() {
  if (!choice.value || !classification.value) throw new Error('Pilih jenis tab secara eksplisit.')
  const result = await call<SheetClassification>(
    'PUT',
    `/source-sheets/${props.sheetId}/classification`,
    { revision_no: classification.value.revision_no, dataset_kind: choice.value },
  )
  classification.value = result
  choice.value = result.dataset_kind || ''
  notice.value =
    'Klasifikasi tersimpan. Bukti review sebelumnya perlu diperiksa terhadap revisi terbaru.'
  emit('changed', result)
}
watch(
  [() => props.sheetId, user],
  () => {
    classification.value = null
    choice.value = ''
    if (props.sheetId && [...editRoles, ...reviewRoles].includes(user.value?.role || ''))
      void run(load)
  },
  { immediate: true },
)
</script>
<template>
  <section class="panel">
    <h2>Klasifikasi tab</h2>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <p class="muted">
      Pilih berdasarkan fungsi bisnis tab. Profiling, draft, dan dry-run tetap tersedia sebelum
      klasifikasi.
    </p>
    <button
      :disabled="busy || disabled"
      @click="
        run(async () => {
          await load()
          if (classification) emit('changed', classification)
        })
      "
    >
      Muat ulang klasifikasi</button
    ><template v-if="classification"
      ><p>{{ classification.status }} · revisi klasifikasi {{ classification.revision_no }}</p>
      <p v-if="classification.confirmed_at" class="muted">
        Dikonfirmasi oleh {{ classification.confirmed_by }} pada {{ classification.confirmed_at }}
      </p>
      <p v-if="classification.blocking_reason" class="notice">
        {{ classification.blocking_reason.code }}: {{ classification.blocking_reason.message }}
      </p>
      <p v-else class="success">
        Gate klasifikasi terpenuhi. Validasi data, approval, dan konfigurasi aktif tetap diperlukan.
      </p>
      <form @submit.prevent="run(save)">
        <fieldset :disabled="busy || disabled || !editor">
          <label
            >Jenis tab<select v-model="choice" required>
              <option value="" disabled>Pilih MASTER atau NON_MASTER</option>
              <option value="MASTER" :disabled="active">
                MASTER — data referensi/identitas baku
              </option>
              <option value="NON_MASTER">NON_MASTER — transaksi atau kejadian</option>
            </select></label
          >
          <p v-if="active" class="notice">
            Target aktif tidak dapat dialihkan ke MASTER tanpa migrasi. Jangan memilih NON_MASTER
            untuk melewati gate jika tab sebenarnya master.
          </p>
          <button class="primary" :disabled="!choice">Konfirmasi klasifikasi</button>
        </fieldset>
      </form>
      <RouterLink
        v-if="classification.dataset_kind === 'MASTER'"
        class="button"
        :to="`/sources/${sourceId}/sheets/${sheetId}/master-binding`"
        >Atur binding master</RouterLink
      ></template
    >
  </section>
</template>
