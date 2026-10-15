<script setup lang="ts">
import guide from '@/content/masterBindingGuide.json'
</script>

<template>
  <div class="master-binding-guide">
    <p>{{ guide.intro }}</p>
    <p class="binding-important">
      Urutan: Registry master → approval definisi → storage → binding tab → approval binding → batch
      import → Preview → approval → Apply → Record kanonis.
    </p>
    <div class="binding-types">
      <article v-for="item in guide.differences" :key="item.name">
        <h3>{{ item.name }}</h3>
        <p>{{ item.purpose }}</p>
        <p class="muted">{{ item.example }}</p>
      </article>
    </div>
    <details>
      <summary>Prasyarat sebelum binding</summary>
      <ul>
        <li v-for="item in guide.prerequisites" :key="item">{{ item }}</li>
      </ul>
    </details>
    <ol class="binding-steps">
      <li v-for="(step, index) in guide.steps" :key="step.title">
        <h3>{{ index + 1 }}. {{ step.title }}</h3>
        <p class="muted">{{ step.where }} · {{ step.actor }}</p>
        <ul>
          <li v-for="action in step.actions" :key="action">{{ action }}</li>
        </ul>
        <p class="binding-result"><strong>Hasil sebelum lanjut:</strong> {{ step.result }}</p>
      </li>
    </ol>
    <details>
      <summary>{{ guide.example.title }} dan Sheet BISNIS / is_active</summary>
      <p>{{ guide.example.description }}</p>
      <div class="binding-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Header sumber</th>
              <th>Field master / tipe</th>
              <th>Aturan</th>
              <th>Contoh</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in guide.example.rows" :key="row.target">
              <td>{{ row.source }}</td>
              <td>{{ row.target }} · {{ row.type }}</td>
              <td>{{ row.rule }}</td>
              <td>{{ row.value }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>{{ guide.example.existing_sheet }}</p>
    </details>
    <details>
      <summary>Binding kolom referensi pada tab NON_MASTER</summary>
      <ol>
        <li v-for="step in guide.reference_steps" :key="step">{{ step }}</li>
      </ol>
      <p>{{ guide.reference_configuration_help }}</p>
    </details>
    <details>
      <summary>Jika binding atau pemuatan belum bisa dilanjutkan</summary>
      <article v-for="item in guide.troubleshooting" :key="item.symptom" class="binding-trouble">
        <h3>{{ item.symptom }}</h3>
        <p>{{ item.cause }}</p>
        <p><strong>Tindakan:</strong> {{ item.action }}</p>
      </article>
    </details>
    <details>
      <summary>Checklist selesai</summary>
      <ul>
        <li v-for="item in guide.completion" :key="item">{{ item }}</li>
      </ul>
      <p>
        Record master diperiksa di Storage &amp; record master. Data product di Katalog data
        membutuhkan konfigurasi semantic dan akses tersendiri.
      </p>
    </details>
    <p><a href="/guides/PANDUAN_BINDING_MASTER.md" download>Unduh panduan binding master</a></p>
  </div>
</template>

<style scoped>
.master-binding-guide {
  display: grid;
  gap: 1rem;
  min-width: 0;
}
.master-binding-guide p,
.master-binding-guide h3 {
  margin: 0;
}
.binding-types {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}
.binding-types article,
.binding-steps > li,
.binding-trouble {
  display: grid;
  gap: 0.55rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 1rem;
}
.binding-steps {
  display: grid;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.binding-important,
.binding-result {
  padding: 0.75rem;
  background: var(--surface-muted, #eef6f2);
  border-radius: 8px;
}
ul,
ol {
  padding-left: 1.3rem;
}
li + li {
  margin-top: 0.45rem;
}
.binding-steps > li + li {
  margin-top: 0;
}
.binding-table-scroll {
  overflow-x: auto;
  margin: 0.75rem 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 460px;
}
th,
td {
  text-align: left;
  padding: 0.6rem;
  border-bottom: 1px solid var(--line);
}
summary {
  cursor: pointer;
  font-weight: 600;
}
details > p,
details > article {
  margin-top: 0.75rem;
}
@media (max-width: 640px) {
  .binding-types {
    grid-template-columns: 1fr;
  }
}
</style>
