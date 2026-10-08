<script setup lang="ts">
export type TableColumn = { key: string; label: string }
defineProps<{
  rows: Record<string, unknown>[]
  columns: TableColumn[]
  total: number
  offset: number
  limit: number
  search: string
  loading?: boolean
  emptyText?: string
}>()
const emit = defineEmits<{
  'update:search': [value: string]
  page: [offset: number]
}>()
function display(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
</script>

<template>
  <div class="paged-table">
    <label class="paged-table__search">Cari data
      <input :value="search" type="search" placeholder="Ketik kata kunci" @input="emit('update:search', ($event.target as HTMLInputElement).value)" />
    </label>
    <div class="scroll">
      <table>
        <thead><tr><th v-for="column in columns" :key="column.key"><slot :name="`header-${column.key}`" :column="column">{{ column.label }}</slot></th></tr></thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="String(row.id ?? index)">
            <td v-for="column in columns" :key="column.key">
              <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">{{ display(row[column.key]) }}</slot>
            </td>
          </tr>
          <tr v-if="!rows.length"><td :colspan="columns.length" class="muted">{{ loading ? 'Memuat data…' : (emptyText || 'Tidak ada data yang cocok.') }}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="paged-table__footer">
      <span>Menampilkan {{ total ? offset + 1 : 0 }}–{{ Math.min(offset + rows.length, total) }} dari {{ total }}</span>
      <div class="toolbar">
        <button type="button" :disabled="loading || offset <= 0" @click="emit('page', Math.max(0, offset - limit))">Sebelumnya</button>
        <button type="button" :disabled="loading || offset + limit >= total" @click="emit('page', offset + limit)">Berikutnya</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.paged-table__search { display: block; max-width: 420px; margin-bottom: 12px; }
.paged-table__footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; }
@media (max-width: 640px) { .paged-table__footer { align-items: flex-start; flex-direction: column; } }
</style>
