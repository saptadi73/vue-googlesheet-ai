<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import PagedDataTable from '@/components/ui/PagedDataTable.vue'
import { call } from '@/lib/etl'
import type { ProductInventory } from '@/lib/catalog'
import { getApiErrorMessage } from '@/lib/api'
import type { JoinRelationship } from '@/lib/governance'

const rows = ref<ProductInventory[]>([])
const relationships = ref<JoinRelationship[]>([])
const search = ref('')
const offset = ref(0)
const limit = 20
const busy = ref(false)
const error = ref('')
const columns = [
  { key: 'product', label: 'Data product' },
  { key: 'source', label: 'Sumber dan tab' },
  { key: 'database_table', label: 'Tabel database' },
  { key: 'description', label: 'Deskripsi' },
  { key: 'semantic', label: 'Semantic tersedia' },
  { key: 'recommendations', label: 'Peluang peningkatan' },
  { key: 'configuration_version', label: 'Versi ETL' },
  { key: 'actions', label: 'Tindakan' },
]

const filtered = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  if (!term) return rows.value
  return rows.value.filter((item) => [
    item.name, item.code, item.description, item.source_name, item.source_code,
    item.sheet_name, item.database_table, item.semantic_view,
    ...item.columns.flatMap((column) => [column.target_column, column.business_name, column.source_column]),
    ...item.dimensions,
    ...item.metrics.flatMap((metric) => [metric.code, metric.label, metric.description, ...(metric.synonyms || [])]),
  ].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(term)))
})
const pageRows = computed(() => filtered.value.slice(offset.value, offset.value + limit))

watch(search, () => { offset.value = 0 })

async function load() {
  busy.value = true
  error.value = ''
  try {
    const [inventory, approvedJoins] = await Promise.all([
      call<ProductInventory[]>('GET', '/semantic/data-product-inventory'),
      call<JoinRelationship[]>('GET', '/semantic/join-relationships'),
    ])
    rows.value = inventory
    relationships.value = approvedJoins
  } catch (cause) {
    error.value = getApiErrorMessage(cause)
  } finally {
    busy.value = false
  }
}

function recommendations(item: ProductInventory) {
  const suggestions: string[] = []
  if (!item.description?.trim()) suggestions.push('Tambahkan deskripsi bisnis dataset.')
  const undocumented = item.columns.filter((column) => !column.business_name?.trim())
  if (undocumented.length) suggestions.push(`${undocumented.length} kolom perlu nama bisnis yang jelas.`)
  const numericColumns = item.columns.filter((column) => ['smallint', 'integer', 'bigint', 'numeric', 'decimal', 'real', 'double precision'].includes(column.target_type))
  if (numericColumns.length && !item.metrics.length) suggestions.push('Tinjau apakah kolom numerik perlu didefinisikan sebagai metrik.')
  if (item.metrics.some((metric) => !metric.description?.trim())) suggestions.push('Lengkapi definisi atau rumus bisnis metrik.')
  if (item.metrics.some((metric) => !metric.synonyms?.length)) suggestions.push('Tambahkan sinonim istilah yang biasa dipakai pengguna.')
  if (!item.dimensions.length) suggestions.push('Tinjau dimensi untuk filter dan pengelompokan analitik.')
  if (item.metrics.length && !item.dimensions.length) suggestions.push('Metrik belum memiliki dimensi untuk pemotongan analisis.')
  const hasApprovedJoin = relationships.value.some((relationship) =>
    relationship.left_product_code === item.code || relationship.right_product_code === item.code,
  )
  if (rows.value.length > 1 && !hasApprovedJoin) suggestions.push('Jika perlu analisis gabungan, tinjau relasi dan kardinalitas join dengan product lain.')
  return suggestions
}

function openSheet(item: ProductInventory) {
  return `${item.spreadsheet_url}#gid=${item.sheet_id}`
}
function workspacePath(row: Record<string, unknown>) {
  return { path: '/workspace', query: { source_id: String(row.source_id || '') } }
}

onMounted(load)
</script>

<template>
  <EtlShell>
    <p class="eyebrow">KATALOG OUTPUT ANALITIK</p>
    <h1>Katalog data</h1>
    <p class="muted">Semua data product hasil ETL aktif yang dapat Anda akses, beserta tabel database, semantic metadata, dan sumber asalnya. Gunakan daftar ini untuk menemukan celah metadata atau merencanakan penambahan data.</p>
    <div class="catalog-summary">
      <div><strong>{{ rows.length }}</strong><span>data product aktif</span></div>
      <div><strong>{{ rows.filter((item) => !item.description?.trim()).length }}</strong><span>tanpa deskripsi</span></div>
      <div><strong>{{ rows.filter((item) => recommendations(item).length).length }}</strong><span>perlu tinjauan semantic</span></div>
    </div>
    <section class="panel">
      <div class="catalog-heading">
        <div>
          <h2>Daftar tabel hasil ETL</h2>
          <p class="muted">Tautan sumber membuka spreadsheet tepat pada tab asal. Kolom saran adalah pemeriksaan kelengkapan metadata, bukan perubahan otomatis.</p>
        </div>
        <button type="button" :disabled="busy" @click="load">Muat ulang</button>
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <PagedDataTable
        :rows="pageRows as unknown as Record<string, unknown>[]"
        :columns="columns"
        :total="filtered.length"
        :offset="offset"
        :limit="limit"
        :search="search"
        :loading="busy"
        empty-text="Belum ada tabel ETL aktif yang tersedia untuk akun ini."
        @update:search="search = $event"
        @page="offset = $event"
      >
        <template #cell-product="{ row }">
          <strong>{{ row.name }}</strong><small class="catalog-subline">{{ row.code }}</small>
        </template>
        <template #cell-source="{ row }">
          <a :href="openSheet(row as unknown as ProductInventory)" target="_blank" rel="noopener noreferrer">{{ row.source_name }}</a>
          <small class="catalog-subline">{{ row.sheet_name }} · gid {{ row.sheet_id }}</small>
        </template>
        <template #cell-database_table="{ row }">
          <code>{{ row.database_schema }}.{{ row.database_table }}</code>
          <small class="catalog-subline">View: {{ row.semantic_view }}</small>
        </template>
        <template #cell-description="{ row }">
          <span>{{ row.description || 'Belum diisi' }}</span>
        </template>
        <template #cell-semantic="{ row }">
          <span>{{ (row.dimensions as string[]).length }} dimensi · {{ (row.metrics as ProductInventory['metrics']).length }} metrik</span>
          <small class="catalog-subline">{{ (row.dimensions as string[]).slice(0, 4).join(', ') || 'Belum ada dimensi' }}</small>
        </template>
        <template #cell-recommendations="{ row }">
          <ul v-if="recommendations(row as unknown as ProductInventory).length" class="catalog-recommendations">
            <li v-for="suggestion in recommendations(row as unknown as ProductInventory)" :key="suggestion">{{ suggestion }}</li>
          </ul>
          <span v-else class="catalog-complete">Metadata utama sudah terisi</span>
        </template>
        <template #cell-configuration_version="{ row }">
          <span>v{{ row.configuration_version }}</span>
          <small class="catalog-subline">Semantic v{{ row.version }} · refresh {{ row.freshness_version }}</small>
        </template>
        <template #cell-actions="{ row }">
          <div class="catalog-actions">
            <RouterLink :to="`/configurations/${row.configuration_id}/review`">Revisi ETL</RouterLink>
            <RouterLink to="/governance">Atur semantic</RouterLink>
            <RouterLink :to="workspacePath(row)">Buka sumber</RouterLink>
          </div>
        </template>
      </PagedDataTable>
      <div class="catalog-guidance notice">
        Benahi nilai dan header yang keliru di Google Sheet. Ubah tipe, mapping, transformasi, dan aturan kualitas melalui revisi ETL. Ubah deskripsi, dimensi, metrik, dan sinonim di semantic catalog. Penambahan relasi antardataset dilakukan setelah kolom kunci dan kardinalitasnya dipastikan.
      </div>
    </section>
  </EtlShell>
</template>

<style scoped>
.catalog-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
.catalog-summary > div { display: flex; flex-direction: column; gap: 4px; padding: 16px; border: 1px solid #dce8e2; border-radius: 12px; background: #fff; }
.catalog-summary strong { font-size: 24px; color: #087443; }
.catalog-summary span, .catalog-subline { color: #62796c; font-size: 12px; }
.catalog-subline { display: block; margin-top: 4px; }
.catalog-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
.catalog-heading h2, .catalog-heading p { margin-top: 0; }
.catalog-recommendations { margin: 0; padding-left: 18px; }
.catalog-complete { color: #087443; }
.catalog-actions { display: flex; flex-direction: column; gap: 6px; white-space: nowrap; }
.catalog-guidance { margin-top: 16px; }
code { overflow-wrap: anywhere; }
@media (max-width: 700px) { .catalog-summary { grid-template-columns: 1fr; } .catalog-heading { flex-direction: column; } }
</style>
