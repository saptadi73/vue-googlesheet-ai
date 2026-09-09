<script setup lang="ts">
import { ref } from 'vue'
import { call, type Column } from '@/lib/etl'
import type { Taxonomy, TaxonomyColumnBinding } from '@/lib/taxonomies'
import { useTask } from '@/lib/tasks'

const props = defineProps<{ column: Column; sheetId: string; sourceId: string }>()
const emit = defineEmits<{
  change: [
    value: {
      taxonomy_id: string | null
      taxonomy_version: number | null
      taxonomy_required: boolean
    },
  ]
}>()
const { busy, error, run } = useTask()
const binding = ref<TaxonomyColumnBinding | null>(null)
async function useBinding() {
  binding.value = null
  const [bindings, taxonomies] = await Promise.all([
    call<TaxonomyColumnBinding[]>(
      'GET',
      `/taxonomies/source-sheets/${props.sheetId}/column-bindings`,
    ),
    call<Taxonomy[]>('GET', '/taxonomies'),
  ])
  const current = bindings.find((item) => item.source_column === props.column.source_column)
  const taxonomy = taxonomies.find((item) => item.id === current?.taxonomy_id)
  if (
    !current ||
    current.status !== 'APPROVED' ||
    !taxonomy?.is_active ||
    taxonomy.status !== 'APPROVED' ||
    taxonomy.version !== current.taxonomy_version
  )
    throw new Error('Simpan dan approve binding ke versi taxonomy aktif terlebih dahulu.')
  if (!['text', 'varchar'].includes(props.column.target_type))
    throw new Error('Taxonomy hanya untuk text/varchar.')
  binding.value = current
  emit('change', {
    taxonomy_id: current.taxonomy_id,
    taxonomy_version: current.taxonomy_version,
    taxonomy_required: current.required,
  })
}
</script>
<template>
  <details>
    <summary>Mapping taxonomy</summary>
    <p v-if="column.taxonomy_id">
      Taxonomy {{ column.taxonomy_id }} / versi {{ column.taxonomy_version }} /
      {{ column.taxonomy_required ? 'wajib' : 'opsional' }}
    </p>
    <p v-else>Belum ada referensi taxonomy.</p>
    <p>
      Gunakan referensi dari binding approved untuk header ini. Optional membolehkan kosong, tetapi
      nilai asing atau ambigu tetap ditolak.
    </p>
    <RouterLink :to="`/sources/${sourceId}/sheets/${sheetId}/taxonomy-bindings`"
      >Kelola binding taxonomy</RouterLink
    >
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="binding">
      Binding revisi {{ binding.revision_no }} / reviewer {{ binding.approved_by }} /
      {{ binding.approved_at }}
    </p>
    <div class="toolbar">
      <button
        type="button"
        :disabled="busy || !['text', 'varchar'].includes(column.target_type)"
        @click="run(useBinding)"
      >
        Gunakan binding approved
      </button>
      <button
        type="button"
        :disabled="busy || !column.taxonomy_id"
        @click="
          emit('change', { taxonomy_id: null, taxonomy_version: null, taxonomy_required: false })
        "
      >
        Hapus referensi taxonomy
      </button>
    </div>
    <p>
      Penghapusan referensi konfigurasi tidak menghapus binding registry. Sesuaikan rule in_taxonomy
      sebelum menyimpan.
    </p>
  </details>
</template>
