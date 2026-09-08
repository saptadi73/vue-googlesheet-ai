<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { call, type Config, type ETL, type Profile } from '@/lib/etl'
import { useTask } from '@/lib/tasks'
const props = defineProps<{ sheetId: string; profile: Profile }>()
const router = useRouter()
const { busy, error, run } = useTask()
const form = ref({ name: '', grain: '', table: '', code: '', strategy: 'APPEND' })
async function create() {
  const used = new Set<string>()
  const columns = props.profile.profile_json.columns.map((column) => {
    let base = column.normalized_name.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (!/^[a-z]/.test(base)) base = `col_${base}`
    base = base.slice(0, 55)
    let name = base,
      index = 2
    while (used.has(name)) name = `${base}_${index++}`
    used.add(name)
    return {
      source_column: column.source_column,
      target_column: name,
      target_type: 'text',
      business_name: column.source_column,
      nullable: true,
      is_business_key: false,
      is_primary_key: false,
      transformation_codes: [],
      pii_classification: column.pii_suspected ? 'HIGH' : 'NONE',
      confidence: 1,
      reason: 'Mapping awal manual; periksa tipe, key, sensitivitas, dan transformasi.',
    }
  })
  const configuration: ETL = {
    schema_version: '1.0',
    dataset_business_name: form.value.name,
    dataset_description: '',
    grain: form.value.grain,
    target_schema: 'trusted',
    target_table: form.value.table,
    load_strategy: form.value.strategy,
    columns,
    data_quality_rules: [],
    semantic: {
      code: form.value.code,
      dimensions: [],
      metrics: [],
      allowed_roles: ['PLATFORM_ADMIN', 'DATA_STEWARD', 'ANALYST', 'VIEWER'],
    },
    unresolved_questions: [],
    overall_confidence: 1,
  }
  const result = await call<Config>('POST', '/configurations', {
    source_sheet_id: props.sheetId,
    configuration,
  })
  await router.push(`/configurations/${result.id}/review`)
}
</script>
<template>
  <details>
    <summary>Buat draft manual tanpa AI</summary>
    <p class="muted">
      Kolom diinisialisasi sebagai teks. Periksa tipe, key, cleansing, dan analitik pada wizard.
      Untuk UPSERT, tentukan key lalu ubah strategi di wizard sebelum approval.
    </p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <form @submit.prevent="run(create)">
      <fieldset :disabled="busy">
        <div class="grid">
          <label>Nama dataset<input v-model="form.name" required maxlength="200" /></label
          ><label
            >Grain / arti satu baris<input v-model="form.grain" required maxlength="500" /></label
          ><label
            >Nama dasar tabel<input
              v-model="form.table"
              required
              pattern="[a-z][a-z0-9_]*"
              maxlength="30" /></label
          ><label
            >Kode produk analitik<input
              v-model="form.code"
              required
              pattern="[A-Za-z][A-Za-z0-9_]*"
              maxlength="63" /></label
          ><label
            >Strategi awal<select v-model="form.strategy">
              <option>APPEND</option>
              <option>FULL_REFRESH</option>
            </select></label
          >
        </div>
        <button class="primary">Buat draft &amp; buka review</button>
      </fieldset>
    </form>
  </details>
</template>
