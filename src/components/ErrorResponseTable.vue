<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import errors from '@/content/errorResponses.json'

const search = ref('')
const searchId = useId()
const kinds: Record<string, string> = {
  error: 'Error API / job',
  finding: 'Temuan validasi',
  checkpoint: 'Blocker batch',
  access: 'Alasan keputusan akses',
  legacy: 'Error alur lama',
}
const rows = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  const exact = errors.find((row) => row.code.toLocaleLowerCase() === query)
  if (exact) return [exact]
  return errors.filter((row) =>
    [row.code, row.cause, row.action, kinds[row.kind]].some((value) =>
      value?.toLocaleLowerCase().includes(query),
    ),
  )
})
</script>

<template>
  <div class="error-reference">
    <label :for="searchId">Cari kode error, penyebab, atau tindakan</label>
    <input
      :id="searchId"
      v-model="search"
      type="search"
      placeholder="Contoh: REVIEW_STALE, discovery, akses"
    />
    <p class="muted">
      Penyebab berikut adalah kemungkinan. Baca detail dan monitor job untuk memastikan kasusnya.
      Muat ulang halaman hanya membaca status.
    </p>
    <p role="status">Menampilkan {{ rows.length }} dari {{ errors.length }} kode / respons.</p>
    <div
      v-if="rows.length"
      class="error-table-scroll"
      tabindex="0"
      role="region"
      aria-label="Tabel error response"
    >
      <table>
        <thead>
          <tr>
            <th scope="col">Kode / respons</th>
            <th scope="col">Kemungkinan penyebab</th>
            <th scope="col">Tindakan yang dilakukan</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.code">
            <th scope="row">
              <code>{{ row.code }}</code
              ><small>{{ kinds[row.kind] }}</small>
            </th>
            <td>{{ row.cause }}</td>
            <td>{{ row.action }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else>
      Tidak ada kode yang cocok. Coba kata lain atau catat ID job untuk pemeriksaan administrator.
    </p>
  </div>
</template>

<style scoped>
.error-reference {
  display: grid;
  gap: 0.65rem;
  min-width: 0;
}
.error-reference p {
  margin: 0;
}
.error-reference input {
  width: 100%;
  box-sizing: border-box;
}
.error-table-scroll {
  overflow-x: auto;
  max-width: 100%;
}
table {
  width: 100%;
  min-width: 42rem;
  border-collapse: collapse;
  table-layout: fixed;
}
th,
td {
  padding: 0.75rem;
  border-bottom: 1px solid #d5e4df;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}
thead th {
  background: #f0f8f4;
  color: #234c3e;
}
th:first-child {
  width: 26%;
}
th:nth-child(2) {
  width: 29%;
}
tbody th {
  font-weight: 600;
}
small {
  display: block;
  margin-top: 0.35rem;
  font-weight: 400;
  color: #536c62;
}
.muted {
  color: #536c62;
}
</style>
