<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import ScopeEditor from '@/components/ScopeEditor.vue'
import { call, roles, type User, type AccessRequest, type AccessRequestOptions, type AccessKind } from '@/lib/etl'
import { useTask } from '@/lib/tasks'

const { busy, error, notice, run } = useTask()
const scopePending = ref(false)
const createdUser = ref<(User & { access_requests?: AccessRequest[] }) | null>(null)
const form = ref(emptyForm())
const requestAccess = ref(true)
const options = ref<AccessRequestOptions | null>(null)
const access = ref({ unit: '', domain: '', jurisdiction: '', bundles: [] as string[], reason: '' })
const hasScopeOptions = computed(() =>
  ['DEPARTMENT', 'BUSINESS_DOMAIN', 'JURISDICTION'].every((kind) =>
    options.value?.attributes.some((attribute) => attribute.kind === kind),
  ),
)
function attributes(kind: AccessKind) {
  return options.value?.attributes.filter((attribute) => attribute.kind === kind) || []
}
async function loadOptions() {
  options.value = await call<AccessRequestOptions>('GET', '/access/request-options')
}

function emptyForm() {
  return {
    username: '',
    full_name: '',
    password: '',
    role: 'VIEWER',
    row_scope: {} as Record<string, Record<string, unknown[]>>,
  }
}

async function createUser() {
  if (scopePending.value) throw new Error('Terapkan batasan baris sebelum menyimpan pengguna.')
  createdUser.value = await call<User & { access_requests?: AccessRequest[] }>('POST', '/users', {
    ...form.value,
    initial_access: requestAccess.value ? {
      attribute_ids: [access.value.unit, access.value.domain, access.value.jurisdiction],
      bundle_ids: access.value.bundles,
      business_reason: access.value.reason,
    } : null,
  })
  form.value = emptyForm()
  access.value = { unit: '', domain: '', jurisdiction: '', bundles: [], reason: '' }
  const requested = createdUser.value.access_requests?.length || 0
  notice.value = `Pengguna ${createdUser.value.username} berhasil didaftarkan.${requested ? ` ${requested} rekomendasi akses diajukan sekaligus untuk 366 hari; menunggu persetujuan admin lain.` : ' Belum ada permintaan akses.'}`
}
onMounted(() => void run(loadOptions))
</script>

<template>
  <EtlShell>
    <p class="eyebrow">ADMINISTRASI PENGGUNA</p>
    <h1>Registrasi pengguna</h1>
    <p>Buat akun pada tenant aktif. Pengguna tidak dapat mendaftar atau memilih role sendiri.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <section class="panel">
      <form @submit.prevent="run(createUser)">
        <fieldset :disabled="busy">
          <div class="grid">
            <label
              >Username atau email<input
                v-model.trim="form.username"
                required
                minlength="3"
                maxlength="100"
                pattern="[a-zA-Z0-9_.@\-]+"
                autocomplete="off"
            /></label>
            <label
              >Nama lengkap<input v-model.trim="form.full_name" maxlength="200" autocomplete="off"
            /></label>
            <label
              >Password awal<input
                v-model="form.password"
                required
                type="password"
                minlength="12"
                maxlength="256"
                autocomplete="new-password"
            /></label>
            <label
              >Role awal<select v-model="form.role">
                <option v-for="role in roles" :key="role">{{ role }}</option>
              </select></label
            >
          </div>
          <ScopeEditor v-model="form.row_scope" @pending="scopePending = $event" />
          <h2>Rekomendasi akses akun baru</h2>
          <label class="check"><input v-model="requestAccess" type="checkbox" />Ajukan akses bersama registrasi akun</label>
          <p class="muted">Akun dan permintaan dibuat dalam satu transaksi. Admin lain dapat menyetujui semua pilihan sekaligus di Permintaan akses. Policy APPROVED yang cocok digunakan kembali; tidak perlu membuat policy untuk setiap akun.</p>
          <template v-if="requestAccess">
            <p v-if="!hasScopeOptions" class="notice" role="status">Unit, domain, atau yurisdiksi belum tersedia. Admin perlu menyiapkan atribut organisasi terlebih dahulu.</p>
            <button type="button" @click="run(loadOptions)">Muat ulang rekomendasi akses</button>
            <div class="grid">
              <label>Unit akun baru<select v-model="access.unit" required><option value="">Pilih unit</option><option v-for="item in attributes('DEPARTMENT')" :key="item.id" :value="item.id">{{ item.code }} · {{ item.label }}</option></select></label>
              <label>Domain akun baru<select v-model="access.domain" required><option value="">Pilih domain</option><option v-for="item in attributes('BUSINESS_DOMAIN')" :key="item.id" :value="item.id">{{ item.code }} · {{ item.label }}</option></select></label>
              <label>Yurisdiksi akun baru<select v-model="access.jurisdiction" required><option value="">Pilih yurisdiksi</option><option v-for="item in attributes('JURISDICTION')" :key="item.id" :value="item.id">{{ item.code }} · {{ item.label }}</option></select></label>
            </div>
            <p>Masa akses: 366 hari sejak pengajuan. Role tidak otomatis memberikan akses ke semua sumber.</p>
            <fieldset>
              <legend>Paket izin tambahan (opsional; pilih sesuai tugas)</legend>
              <label v-for="item in options?.permission_bundles || []" :key="item.id" class="check">
                <input v-model="access.bundles" type="checkbox" :value="item.id" />{{ item.label }} · {{ item.actions.join(', ') }}
              </label>
              <p v-if="!options?.permission_bundles.length" class="muted">Tidak ada paket izin tambahan. Atribut dan policy tetap diperiksa.</p>
            </fieldset>
            <label>Alasan rekomendasi akses<textarea v-model.trim="access.reason" required minlength="10" maxlength="1000" /></label>
          </template>
          <RouterLink to="/guide#akses-akun">Helper: cara akses akun baru dan policy digunakan kembali</RouterLink>
          <div class="toolbar">
            <button class="primary" :disabled="scopePending || (requestAccess && !hasScopeOptions)">Daftarkan pengguna</button>
            <RouterLink class="button" to="/admin/users">Kelola pengguna</RouterLink>
            <RouterLink class="button" to="/access-requests">Tinjau permintaan akses</RouterLink>
          </div>
        </fieldset>
      </form>
    </section>
  </EtlShell>
</template>
