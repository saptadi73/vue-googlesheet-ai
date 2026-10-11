<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { call, type Column, type Config, type ETL, type Profile } from '@/lib/etl'
import { useTask } from '@/lib/tasks'
import { normalizeProductCode, suggestDatasetIdentity } from '@/lib/datasetIdentity'

const props = defineProps<{ sheetId: string; profile: Profile; sourceName: string; sheetName: string }>()
const router = useRouter()
const { busy, error, run } = useTask()
type LoadTemplate = 'APPEND' | 'FULL_REFRESH' | 'UPSERT'
type DraftColumn = Pick<Column, 'source_column' | 'target_column' | 'target_type' | 'business_name' | 'nullable' | 'is_business_key' | 'pii_classification'>
const form = ref({ name: '', grain: '', table: '', code: '', template: 'APPEND' as LoadTemplate })
const columns = ref<DraftColumn[]>([])
const notice = ref('')
function normalizeIdentityCode() {
  const before = form.value.code
  form.value.code = normalizeProductCode(before)
  if (before !== form.value.code) notice.value = `Kode analitik dirapikan otomatis menjadi ${form.value.code}.`
}
const identity = computed(() => suggestDatasetIdentity(
  props.profile.profile_json.spreadsheet_title || props.sourceName, props.sheetName,
))
function useSourceIdentity() {
  form.value.name = identity.value.businessName
  form.value.code = identity.value.code
}
function slug(value: string, fallback: string) {
  let result = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (!result || !/^[a-z]/.test(result)) result = `${fallback}_${result || 'data'}`
  return result.slice(0, 55)
}
function mapType(value: string) {
  const type = value.toLowerCase()
  if (type.includes('int')) return 'bigint'
  if (type.includes('decimal') || type.includes('numeric') || type.includes('float') || type.includes('double')) return 'numeric'
  if (type.includes('bool')) return 'boolean'
  if (type === 'date') return 'date'
  if (type.includes('time')) return 'timestamp'
  return 'text'
}
function resetFromProfile() {
  const profileName = props.sheetName
  const table = slug(profileName, 'dataset').slice(0, 30).replace(/_+$/, '')
  form.value = { name: identity.value.businessName, grain: `Satu baris per ${profileName}`, table, code: identity.value.code, template: 'APPEND' }
  const used = new Set<string>()
  columns.value = props.profile.profile_json.columns.map((column) => {
    const base = slug(column.normalized_name || column.source_column, 'col').slice(0, 55)
    let target = base; let index = 2
    while (used.has(target)) target = `${base}_${index++}`
    used.add(target)
    return { source_column: column.source_column, target_column: target, target_type: mapType(column.inferred_type), business_name: column.source_column, nullable: column.null_ratio > 0, is_business_key: /(^|_)(id|code|kode|nomor|no)($|_)/i.test(column.source_column) && column.null_ratio === 0, pii_classification: column.pii_suspected ? 'HIGH' : 'NONE' }
  })
}
resetFromProfile()
const keyColumns = computed(() => columns.value.filter((column) => column.is_business_key))
function fullColumn(column: DraftColumn): Column {
  return { ...column, is_primary_key: column.is_business_key, transformation_codes: [], transform_parameters: [], confidence: 1, reason: 'Pemetaan manual dari hasil profiling; periksa sebelum review.', numeric_precision: null, numeric_scale: null, varchar_length: null, date_format: null, number_locale: null, source_timezone: null, unit_conversion: null, currency_conversion: null }
}
async function create() {
  notice.value = ''
  normalizeIdentityCode()
  if (!columns.value.length) throw new Error('Profil belum memiliki kolom untuk dipetakan.')
  if (form.value.template === 'UPSERT' && !keyColumns.value.length) throw new Error('Template upsert memerlukan minimal satu business key.')
  if (keyColumns.value.some((column) => column.nullable)) throw new Error('Business key tidak boleh nullable.')
  const configuration: ETL = {
    schema_version: '1.0', dataset_business_name: form.value.name, dataset_description: 'Konfigurasi dibuat dengan template manual dari hasil profiling.', grain: form.value.grain, target_schema: 'trusted', target_table: form.value.table, load_strategy: form.value.template, append_duplicate_policy: form.value.template === 'APPEND' ? 'SKIP_IDENTICAL' : null, columns: columns.value.map(fullColumn), data_quality_rules: [],
    semantic: { code: form.value.code, dimensions: columns.value.filter((column) => column.pii_classification === 'NONE').slice(0, 8).map((column) => column.target_column), metrics: [], allowed_roles: ['PLATFORM_ADMIN', 'DATA_STEWARD', 'ANALYST', 'VIEWER'] },
    unresolved_questions: ['Periksa tipe data, business key, sensitivitas, dan aturan kualitas sebelum approval.'], overall_confidence: 1,
  }
  const result = await call<Config>('POST', '/configurations', { source_sheet_id: props.sheetId, configuration })
  await router.push(`/configurations/${result.id}/review`)
}
</script>

<template>
  <details open>
    <summary>Buat konfigurasi manual dengan template</summary>
    <p class="muted">Template mengisi nama, tipe, dan kandidat key dari hasil profiling. Periksa setiap kolom sebelum menyimpan; proses ini tidak memakai AI dan tetap melewati review serta approval.</p>
    <p class="muted">Nama bisnis dan kode diisi dari {{ profile.profile_json.spreadsheet_title ? 'nama file Google Sheet pada profiling' : 'nama sumber terdaftar (profil lama; profiling ulang untuk nama file asli)' }} + tab. Kode memakai huruf, angka dan underscore, diawali huruf, maksimal 63 karakter. Isian dapat diedit; profil yang dimuat ulang tidak menimpa isian.</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="notice" class="notice">{{ notice }}</p>
    <form @submit.prevent="run(create)">
      <fieldset :disabled="busy">
        <button type="button" @click="useSourceIdentity">Gunakan nama file dan tab</button>
        <div class="grid">
          <label>Nama dataset<input v-model="form.name" required maxlength="200" /></label>
          <label>Grain / arti satu baris<input v-model="form.grain" required maxlength="500" /></label>
          <label>Nama tabel tujuan<input v-model="form.table" required pattern="[a-z][a-z0-9_]*" maxlength="30" /></label>
          <label>Kode analitik<input v-model="form.code" @blur="normalizeIdentityCode" required pattern="[A-Za-z][A-Za-z0-9_]*" /></label>
          <label>Template pemuatan<select v-model="form.template"><option value="APPEND">Append — tambah baris baru</option><option value="FULL_REFRESH">Full refresh — ganti isi tabel</option><option value="UPSERT">Upsert — perbarui berdasarkan business key</option></select></label>
        </div>
        <p class="muted">APPEND cocok untuk log/transaksi dengan identitas yang sesuai. FULL_REFRESH cocok untuk snapshot lengkap. UPSERT wajib memiliki key unik dan tidak nullable. Tab MASTER memakai binding master dan batch import, bukan draft ETL NON_MASTER ini.</p>
        <div class="manual-columns">
          <h3>Pemetaan kolom</h3>
          <p class="muted">Pilih tipe tujuan, tandai business key untuk UPSERT, dan tandai data sensitif agar akses dapat dibatasi.</p>
          <div v-for="column in columns" :key="column.source_column" class="manual-column">
            <strong>{{ column.source_column }}</strong>
            <label>Nama tujuan<input v-model="column.target_column" required pattern="[a-z][a-z0-9_]*" /></label>
            <label>Tipe tujuan<select v-model="column.target_type"><option v-for="type in ['text', 'bigint', 'numeric', 'boolean', 'date', 'timestamp', 'timestamptz']" :key="type" :value="type">{{ type }}</option></select></label>
            <label>PII/sensitivitas<select v-model="column.pii_classification"><option value="NONE">Tidak sensitif</option><option value="LOW">Rendah</option><option value="MEDIUM">Sedang</option><option value="HIGH">Tinggi</option></select></label>
            <label class="check"><input v-model="column.nullable" type="checkbox" /> Boleh kosong</label>
            <label class="check"><input v-model="column.is_business_key" type="checkbox" /> Business key</label>
          </div>
        </div>
        <button class="primary">Buat draft manual &amp; buka review</button>
      </fieldset>
    </form>
  </details>
</template>
