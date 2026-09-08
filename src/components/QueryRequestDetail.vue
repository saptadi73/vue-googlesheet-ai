<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { call, roles, user } from '@/lib/etl'
import { useTask } from '@/lib/tasks'
import type { QueryPlan } from '@/lib/catalog'
const props = defineProps<{ id: string }>()
const { busy, error, notice, run } = useTask()
const log = ref<{
  status: string
  route: string
  plan: { data_product_code?: string; plan?: QueryPlan }
  feedback?: string
} | null>(null)
const code = ref(''),
  examples = ref(''),
  allowedRoles = ref(['PLATFORM_ADMIN', 'DATA_STEWARD', 'ANALYST', 'VIEWER'])
const manager = computed(() => ['PLATFORM_ADMIN', 'DATA_STEWARD'].includes(user.value?.role || ''))
async function promote() {
  if (!log.value?.plan.plan || !log.value.plan.data_product_code)
    throw new Error('Plan sukses belum tersedia.')
  await call('POST', `/nl2sql/requests/${props.id}/promote`, {
    code: code.value,
    data_product_code: log.value.plan.data_product_code,
    plan: log.value.plan.plan,
    examples: examples.value.split('\n').filter(Boolean),
    allowed_roles: allowedRoles.value,
  })
  notice.value = 'Template dibuat sebagai DRAFT. Validasi dan aktifkan melalui Dashboard.'
}
watch(
  () => props.id,
  () => {
    log.value = null
    code.value = ''
    examples.value = ''
  },
)
</script>
<template>
  <details>
    <summary>Detail request &amp; template</summary>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <button
      :disabled="busy"
      @click="
        run(async () => {
          log = await call('GET', `/nl2sql/requests/${id}`)
        })
      "
    >
      Muat detail request
    </button>
    <div v-if="log">
      <p>{{ log.status }} · {{ log.route }}</p>
      <pre>{{ JSON.stringify(log.plan, null, 2) }}</pre>
      <form
        v-if="manager && log.status === 'SUCCEEDED' && log.plan.plan"
        @submit.prevent="run(promote)"
      >
        <fieldset :disabled="busy">
          <p class="muted">Template memakai plan yang persis tersimpan pada request ini.</p>
          <label
            >Kode template<input
              v-model="code"
              required
              pattern="[A-Za-z][A-Za-z0-9_]*"
              maxlength="63" /></label
          ><label>Contoh pertanyaan (satu per baris)<textarea v-model="examples" /></label
          ><label v-for="role in roles" :key="role" class="check"
            ><input v-model="allowedRoles" type="checkbox" :value="role" />{{ role }}</label
          ><button>Simpan sebagai draft template</button>
        </fieldset>
      </form>
    </div>
  </details>
</template>
