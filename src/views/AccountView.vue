<script setup lang="ts">
import { ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import { call, user } from '@/lib/etl'
import { clearSession } from '@/lib/api'
import { useTask } from '@/lib/tasks'
const { busy, error, run } = useTask()
const current = ref(''),
  password = ref(''),
  repeated = ref('')
watch(user, () => {
  current.value = ''
  password.value = ''
  repeated.value = ''
})
async function changePassword() {
  if (password.value !== repeated.value) throw new Error('Konfirmasi password tidak sama.')
  await call('POST', '/auth/change-password', {
    current_password: current.value,
    new_password: password.value,
  })
  clearSession()
}
</script>
<template>
  <EtlShell
    ><h1>Akun saya</h1>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <section class="panel">
      <p>{{ user?.full_name || user?.username }} · {{ user?.role }}</p>
      <p class="notice">
        Mengubah password mencabut seluruh token akun. Masuk kembali dengan password baru setelah
        berhasil.
      </p>
      <form @submit.prevent="run(changePassword)">
        <fieldset :disabled="busy">
          <label
            >Password saat ini<input
              v-model="current"
              type="password"
              required
              autocomplete="current-password" /></label
          ><label
            >Password baru<input
              v-model="password"
              type="password"
              required
              minlength="12"
              maxlength="256"
              autocomplete="new-password" /></label
          ><label
            >Ulangi password baru<input
              v-model="repeated"
              type="password"
              required
              minlength="12"
              maxlength="256"
              autocomplete="new-password" /></label
          ><button class="primary">Ubah password</button>
        </fieldset>
      </form>
    </section></EtlShell
  >
</template>
