<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EtlShell from '@/components/EtlShell.vue'
import { call, user, type AccessRequest, type AccessRequestOptions } from '@/lib/etl'
import { useTask } from '@/lib/tasks'

const { busy, error, notice, run } = useTask()
const options = ref<AccessRequestOptions>({
  attributes: [],
  permission_bundles: [],
  requestable_users: [],
  max_duration_days: 366,
})
const mine = ref<AccessRequest[]>([])
const pending = ref<AccessRequest[]>([])
const notes = ref<Record<string, string>>({})
const isAdmin = computed(() => user.value?.role === 'PLATFORM_ADMIN')

function localDate(daysFromNow: number) {
  const value = new Date()
  value.setDate(value.getDate() + daysFromNow)
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset())
  return value.toISOString().slice(0, 16)
}

function emptyForm() {
  return {
    subject_user_id: user.value?.id || '',
    request_type: 'ATTRIBUTE' as 'ATTRIBUTE' | 'PERMISSION_BUNDLE',
    target_id: '',
    valid_from: localDate(1),
    valid_to: localDate(31),
    business_reason: '',
  }
}

const form = ref(emptyForm())
const targets = computed(() =>
  form.value.request_type === 'ATTRIBUTE'
    ? options.value.attributes
    : options.value.permission_bundles,
)

async function load() {
  const requests: Promise<unknown>[] = [
    call<AccessRequestOptions>('GET', '/access/request-options').then((value) => {
      options.value = value
      if (!form.value.subject_user_id) form.value.subject_user_id = user.value?.id || ''
    }),
    call<AccessRequest[]>('GET', '/access/requests/mine').then((value) => {
      mine.value = value
    }),
  ]
  if (isAdmin.value) {
    requests.push(
      call<AccessRequest[]>('GET', '/access/requests?status=PENDING').then((value) => {
        pending.value = value
      }),
    )
  }
  await Promise.all(requests)
}

async function createRequest() {
  const payload: Record<string, unknown> = {
    request_type: form.value.request_type,
    subject_user_id: form.value.subject_user_id,
    valid_from: new Date(form.value.valid_from).toISOString(),
    valid_to: new Date(form.value.valid_to).toISOString(),
    business_reason: form.value.business_reason,
  }
  payload[form.value.request_type === 'ATTRIBUTE' ? 'attribute_id' : 'bundle_id'] =
    form.value.target_id
  const created = await call<AccessRequest>('POST', '/access/requests', payload)
  mine.value = [created, ...mine.value]
  if (isAdmin.value) pending.value = [created, ...pending.value]
  form.value = emptyForm()
  notice.value = 'Permintaan akses diajukan dan belum memberikan akses sebelum disetujui.'
}

async function transition(item: AccessRequest, action: 'approve' | 'reject' | 'cancel' | 'revoke') {
  const updated = await call<AccessRequest>('POST', `/access/requests/${item.id}/${action}`, {
    revision: item.revision,
    note: notes.value[item.id] || '',
  })
  mine.value = mine.value.map((request) => (request.id === updated.id ? updated : request))
  pending.value = pending.value.filter((request) => request.id !== updated.id)
  notes.value[item.id] = ''
  const labels = {
    approve: 'disetujui',
    reject: 'ditolak',
    cancel: 'dibatalkan',
    revoke: 'dicabut',
  }
  notice.value = `Permintaan akses berhasil ${labels[action]}.`
}

function targetLabel(item: AccessRequest) {
  if (item.attribute)
    return `${item.attribute.kind} · ${item.attribute.code} · ${item.attribute.label}`
  if (item.bundle) return `Permission bundle · ${item.bundle.code} · ${item.bundle.label}`
  return 'Target tidak tersedia'
}

function period(item: AccessRequest) {
  return `${new Date(item.valid_from).toLocaleString()} – ${new Date(item.valid_to).toLocaleString()}`
}

watch(
  user,
  (account) => {
    mine.value = []
    pending.value = []
    if (account) void run(load)
  },
  { immediate: true },
)
watch(
  () => form.value.request_type,
  () => {
    form.value.target_id = ''
  },
)
</script>

<template>
  <EtlShell>
    <p class="eyebrow">BE-16 · EFFECTIVE ACCESS</p>
    <h1>Permintaan akses sementara</h1>
    <p>Akses baru aktif setelah disetujui admin lain dan berakhir sesuai periode yang diminta.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>

    <section class="panel">
      <h2>Ajukan permintaan</h2>
      <form @submit.prevent="run(createRequest)">
        <fieldset :disabled="busy">
          <div class="grid">
            <label v-if="isAdmin"
              >Pengguna tujuan<select v-model="form.subject_user_id" required>
                <option value="">Pilih pengguna</option>
                <option
                  v-for="account in options.requestable_users"
                  :key="account.id"
                  :value="account.id"
                >
                  {{ account.full_name || account.username }} · {{ account.role }}
                </option>
              </select></label
            >
            <label
              >Jenis akses<select v-model="form.request_type">
                <option value="ATTRIBUTE">Atribut yurisdiksi</option>
                <option value="PERMISSION_BUNDLE">Permission bundle</option>
              </select></label
            >
            <label
              >Target<select v-model="form.target_id" required>
                <option value="">Pilih target</option>
                <option v-for="item in targets" :key="item.id" :value="item.id">
                  {{
                    'kind' in item
                      ? `${item.kind} · ${item.code} · ${item.label}`
                      : `${item.code} · ${item.label}`
                  }}
                </option>
              </select></label
            >
            <label>Mulai<input v-model="form.valid_from" type="datetime-local" required /></label>
            <label>Berakhir<input v-model="form.valid_to" type="datetime-local" required /></label>
          </div>
          <label
            >Alasan bisnis<textarea
              v-model.trim="form.business_reason"
              required
              minlength="10"
              maxlength="1000"
            />
          </label>
          <button class="primary">Ajukan akses</button>
        </fieldset>
      </form>
    </section>

    <section class="panel">
      <div class="toolbar">
        <h2>Permintaan saya</h2>
        <button :disabled="busy" @click="run(load)">Muat ulang</button>
      </div>
      <article v-for="item in mine" :key="item.id" class="card-row">
        <strong>{{ targetLabel(item) }}</strong>
        <p>
          Untuk {{ item.subject_user.full_name || item.subject_user.username }}
          <template v-if="item.requester_id !== item.subject_user_id">
            · diajukan {{ item.requester.full_name || item.requester.username }}
          </template>
        </p>
        <p>{{ item.status }} · {{ period(item) }}</p>
        <p>{{ item.business_reason }}</p>
        <p v-if="item.decision_note" class="muted">Keputusan: {{ item.decision_note }}</p>
        <label v-if="item.status === 'APPROVED'"
          >Alasan pencabutan<textarea v-model.trim="notes[item.id]" minlength="3" maxlength="500" />
        </label>
        <div class="toolbar">
          <button
            v-if="item.status === 'PENDING'"
            :disabled="busy"
            @click="run(() => transition(item, 'cancel'))"
          >
            Batalkan
          </button>
          <button
            v-if="item.status === 'APPROVED'"
            :disabled="busy || (notes[item.id] || '').length < 3"
            @click="run(() => transition(item, 'revoke'))"
          >
            Cabut akses
          </button>
        </div>
      </article>
      <p v-if="!busy && mine.length === 0" class="muted">Belum ada permintaan akses.</p>
    </section>

    <section v-if="isAdmin" class="panel">
      <h2>Menunggu keputusan admin</h2>
      <article v-for="item in pending" :key="item.id" class="card-row">
        <strong
          >{{ item.subject_user.full_name || item.subject_user.username }} ·
          {{ targetLabel(item) }}</strong
        >
        <p v-if="item.requester_id !== item.subject_user_id">
          Diajukan oleh {{ item.requester.full_name || item.requester.username }}.
        </p>
        <p>{{ period(item) }}</p>
        <p>{{ item.business_reason }}</p>
        <label>Catatan keputusan<textarea v-model.trim="notes[item.id]" maxlength="500" /></label>
        <div class="toolbar">
          <button
            class="primary"
            :disabled="busy || item.requester_id === user?.id"
            @click="run(() => transition(item, 'approve'))"
          >
            Setujui
          </button>
          <button
            :disabled="busy || item.requester_id === user?.id || (notes[item.id] || '').length < 3"
            @click="run(() => transition(item, 'reject'))"
          >
            Tolak
          </button>
        </div>
        <p v-if="item.requester_id === user?.id" class="notice">
          Permintaan sendiri harus diputuskan admin lain.
        </p>
      </article>
      <p v-if="!busy && pending.length === 0" class="muted">Tidak ada permintaan yang menunggu.</p>
    </section>
  </EtlShell>
</template>
