<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import guide from '@/content/googleSheetFormat.json'

const query = ref('')
const searchId = useId()
const sections = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return guide.sections.filter((section) =>
    JSON.stringify(section).toLocaleLowerCase().includes(search),
  )
})
</script>

<template>
  <div class="sheet-format-guide">
    <p>{{ guide.intro }}</p>
    <label :for="searchId">Cari panduan format Google Sheet</label>
    <input
      :id="searchId"
      v-model="query"
      type="search"
      placeholder="Contoh: periode, business key, presisi, action plan"
    />
    <p role="status">Menampilkan {{ sections.length }} dari {{ guide.sections.length }} bagian.</p>
    <details v-for="section in sections" :key="section.id" :open="Boolean(query.trim())">
      <summary>{{ section.title }}</summary>
      <div class="guide-section-content">
        <template v-for="(block, index) in section.blocks" :key="index">
          <p v-if="'text' in block">{{ block.text }}</p>
          <ul v-else-if="'items' in block">
            <li v-for="item in block.items" :key="item">{{ item }}</li>
          </ul>
          <div
            v-else-if="'headers' in block"
            class="sheet-table-scroll"
            tabindex="0"
            role="region"
            :aria-label="`Tabel ${section.title}`"
          >
            <table>
              <thead>
                <tr>
                  <th v-for="header in block.headers" :key="header" scope="col">{{ header }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, rowIndex) in block.rows" :key="rowIndex">
                  <td v-for="(value, colIndex) in row" :key="colIndex">{{ value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </details>
    <p v-if="!sections.length">
      Tidak ada bagian yang cocok. Coba kata lain, misalnya waktu atau kualitas.
    </p>
  </div>
</template>

<style scoped>
.sheet-format-guide {
  display: grid;
  gap: 0.85rem;
  min-width: 0;
}
.sheet-format-guide p {
  margin: 0;
}
input {
  width: 100%;
  box-sizing: border-box;
}
details {
  border: 1px solid #d5e4df;
  border-radius: 0.6rem;
  min-width: 0;
}
summary {
  cursor: pointer;
  padding: 0.85rem;
  font-weight: 600;
  color: #234c3e;
}
.guide-section-content {
  display: grid;
  gap: 0.8rem;
  padding: 0 0.85rem 0.85rem;
  line-height: 1.65;
}
ul {
  margin: 0;
  padding-left: 1.2rem;
}
li + li {
  margin-top: 0.7rem;
}
.sheet-table-scroll {
  max-width: 100%;
  overflow-x: auto;
}
table {
  width: 100%;
  min-width: 36rem;
  border-collapse: collapse;
}
th,
td {
  padding: 0.7rem;
  border-bottom: 1px solid #d5e4df;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
  min-width: 7rem;
}
th {
  background: #f0f8f4;
  color: #234c3e;
}
</style>
