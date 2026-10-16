<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import catalog from '@/content/analyticsExamples.json'

const query = ref('')
const searchId = useId()
const examples = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return catalog.examples.filter((example) =>
    JSON.stringify(example).toLocaleLowerCase().includes(search),
  )
})
</script>

<template>
  <div class="analytics-examples">
    <p>
      Semua data dan target adalah fiktif untuk latihan. Setiap Excel berisi master rujukan, data,
      kamus kolom, rencana ETL dan action plan yang menunjuk record temuan. Verifikasi target,
      sampel dan hipotesis sebelum menerapkannya pada bisnis.
    </p>
    <a class="download-button" :href="catalog.bundle_url" download
      >Unduh paket 5 contoh Excel + CSV + mapping (ZIP)</a
    >
    <label :for="searchId">Cari contoh Excel</label>
    <input
      :id="searchId"
      v-model="query"
      type="search"
      placeholder="Contoh: keluhan, ATL/BTL, kepuasan, competitiveness, KPI"
    />
    <p role="status">
      Menampilkan {{ examples.length }} dari {{ catalog.examples.length }} contoh.
    </p>
    <article v-for="example in examples" :key="example.id" class="example-card">
      <h3>{{ example.title }}</h3>
      <p>{{ example.description }}</p>
      <a class="download-button" :href="example.download_url" download
        >Unduh Excel — {{ example.title }}</a
      >
      <details>
        <summary>Tab, grain dan key contoh</summary>
        <ul>
          <li v-for="sheet in example.sheets" :key="sheet.name">
            <strong>{{ sheet.name }}</strong> ({{ sheet.role }}, {{ sheet.rows }} record):
            {{ sheet.grain }}. Key: {{ sheet.business_key }}.
          </li>
        </ul>
      </details>
      <p><strong>Batas interpretasi:</strong> {{ example.caution }}</p>
      <details>
        <summary>Pertanyaan analitik yang dapat direview</summary>
        <ul>
          <li v-for="question in example.questions" :key="question">{{ question }}</li>
        </ul>
      </details>
    </article>
    <p v-if="!examples.length">Tidak ada contoh yang cocok. Coba kata lain.</p>
    <details class="import-instructions">
      <summary>Cara memakai Excel / Google Sheets</summary>
      <ol>
        <li>
          Unduh file dan buat salinan. Baca BACA_DULU, Kamus_Data dan Rencana_ETL; jangan menimpa
          sumber production dengan data contoh.
        </li>
        <li>
          Upload Excel ke Google Drive lalu buka/konversi sebagai Google Sheets. Recalculasi formula
          dan cek nilai, jumlah record, penyebut serta tanggal sebelum onboarding.
        </li>
        <li>
          Master_* mengikuti Registry master dan dimuat sekali jika identik antar-file. Tab
          data/rekap/Action_Plan adalah NON_MASTER. Tab petunjuk Dikecualikan dari ETL.
        </li>
        <li>
          Tanggal contoh berupa teks ISO: target date, parse_date_id, format TEXT dan pola %Y-%m-%d.
          Timestamp ber-offset dipetakan ke timestamptz. CSV dalam ZIP berisi nilai contoh, bukan
          formula.
        </li>
        <li>
          Mapping JSON adalah saran draft. Verifikasi key, tipe, DQ, referensi, dimensi/metrik dan
          hak akses; ikuti review, approval, deploy serta sync aplikasi.
        </li>
        <li>
          Baseline action plan dibekukan pada periode bukti; UNVERIFIED adalah hipotesis dan
          follow-up kosong berarti belum dievaluasi. Aplikasi tidak menetapkan tindakan bisnis yang
          pasti benar secara otomatis.
        </li>
        <li>
          Setiap Excel memuat Formula_Analitik dan Aturan_Action_Plan. Tandai kedua tab kontrol
          Dikecualikan dari ETL. Impor aturan melalui API analytics-rules/import-sheet setelah
          produk data aktif; contoh query ada di BACA_DULU dan folder rules dalam ZIP.
        </li>
        <li>
          Preview dan validasi pengelola diperlukan sebelum evaluasi. 50% ditulis 0.50 pada
          RATIO. Formula kosong atau penyebut nol tidak memicu tindakan. Hasil berupa usulan
          PROPOSED dengan bukti angka; perubahan tab kontrol atau semantic memerlukan review ulang.
        </li>
      </ol>
      <p>
        Alur aturan saat ini menggunakan API; wizard ETL dan chat AI belum menjalankannya otomatis.
        <a href="/examples/analytics/PANDUAN_ATURAN_ANALITIK.md" download
          >Unduh panduan aturan dan formula</a
        >
      </p>
    </details>
  </div>
</template>

<style scoped>
.analytics-examples {
  display: grid;
  gap: 0.85rem;
  min-width: 0;
}
p,
h3 {
  margin: 0;
}
input {
  width: 100%;
  box-sizing: border-box;
}
.download-button {
  display: inline-flex;
  width: fit-content;
  padding: 0.65rem 0.85rem;
  border: 1px solid #047857;
  border-radius: 0.5rem;
  color: #065f46;
  font-weight: 600;
  text-decoration: none;
  overflow-wrap: anywhere;
}
.example-card {
  display: grid;
  gap: 0.8rem;
  border: 1px solid #d5e4df;
  border-radius: 0.65rem;
  padding: 1rem;
}
summary {
  cursor: pointer;
  color: #234c3e;
  font-weight: 600;
}
li + li {
  margin-top: 0.5rem;
}
ul,
ol {
  padding-left: 1.3rem;
}
</style>
