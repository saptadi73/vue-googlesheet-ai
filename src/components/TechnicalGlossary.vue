<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import glossary from '@/content/technicalGlossary.json'

const query = ref('')
const searchId = useId()
const rows = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  const exact = glossary.find((row) =>
    [row.term, ...row.aliases].some((term) => term.toLocaleLowerCase() === search),
  )
  if (exact) return [exact]
  return glossary.filter((row) =>
    [row.term, row.meaning, row.example, ...row.aliases].some((value) =>
      value.toLocaleLowerCase().includes(search),
    ),
  )
})
</script>

<template>
  <div class="technical-glossary">
    <p>
      Bayangkan Google Sheet sebagai buku pencatatan bisnis. Tabel ini menjelaskan istilah dengan
      bahasa sederhana dan contoh keluhan pelanggan atau rekap KPI.
    </p>
    <label :for="searchId">Cari istilah teknis, arti, atau contoh</label>
    <input
      :id="searchId"
      v-model="query"
      type="search"
      placeholder="Contoh: grain, taxonomy, kunci bisnis, periode"
    />
    <p role="status">Menampilkan {{ rows.length }} dari {{ glossary.length }} istilah.</p>
    <div
      v-if="rows.length"
      class="glossary-scroll"
      tabindex="0"
      role="region"
      aria-label="Tabel istilah teknis"
    >
      <table>
        <thead>
          <tr>
            <th scope="col">Istilah</th>
            <th scope="col">Arti sederhana</th>
            <th scope="col">Contoh bisnis</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <th scope="row">{{ row.term }}</th>
            <td>{{ row.meaning }}</td>
            <td>{{ row.example }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else>Tidak ada istilah yang cocok. Coba kata lain, misalnya master atau waktu.</p>
    <p>
      Contoh: satu baris rekap per unit, indikator dan bulan adalah grain. Gabungan unit + indikator
      + periode dapat menjadi business key. Unit dan periode menjadi dimensi; target/realisasi
      menjadi metrik. UPSERT memperbarui koreksi dengan key sama; APPEND tanpa key yang tepat bisa
      membuat hitungan berlipat.
    </p>
  </div>
</template>

<style scoped>
.technical-glossary {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
}
p {
  margin: 0;
}
input {
  width: 100%;
  box-sizing: border-box;
}
.glossary-scroll {
  overflow-x: auto;
  max-width: 100%;
}
table {
  width: 100%;
  min-width: 40rem;
  table-layout: fixed;
  border-collapse: collapse;
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
thead th:first-child {
  width: 22%;
}
thead th:nth-child(2) {
  width: 35%;
}
</style>
