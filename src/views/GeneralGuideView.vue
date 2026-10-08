<script setup lang="ts">
import { ArrowRight, CheckCircle2 } from '@lucide/vue'
import EtlShell from '@/components/EtlShell.vue'

const stages = [
  {
    number: 1,
    title: 'Siapkan organisasi, akun, dan akses',
    owner: 'PLATFORM_ADMIN',
    to: '/admin',
    action: 'Buka Administrasi',
    purpose: 'Menentukan siapa yang boleh mendaftarkan, mereview, mengoperasikan, dan membaca data.',
    steps: [
      'Buat akun pengguna dan tetapkan role sesuai tugasnya.',
      'Buat atribut departemen, domain bisnis, yurisdiksi, purpose, dan clearance.',
      'Berikan assignment serta permission bundle dengan masa berlaku yang sesuai.',
      'Siapkan policy akses resource; gunakan Preview keputusan sebelum approval.',
      'Untuk sumber yang memerlukan gate rilis, tunjuk pemeriksa IT dan approver setiap unit terkait.',
    ],
    done: 'Admin, source owner/data steward, approver, dan pengguna analitik dapat login dengan akses yang tepat.',
  },
  {
    number: 2,
    title: 'Daftarkan Google Sheet',
    owner: 'SOURCE_OWNER / DATA_STEWARD',
    to: '/sources',
    action: 'Buka Sumber & tracking',
    purpose: 'Menghubungkan spreadsheet, menemukan tab, dan mengambil profil data tanpa menulis ke Google Sheet.',
    steps: [
      'Bagikan spreadsheet ke email service account backend sebagai Viewer.',
      'Isi nama sumber dan URL/ID spreadsheet.',
      'Pilih unit pemilik, domain, yurisdiksi, purpose, data owner, data steward, dan sensitivitas.',
      'Gunakan halaman Sumber & tracking untuk mencari sumber dan melihat status tiap tahap. Pilih Buka sumber, lalu lanjutkan Hubungkan & profiling di Workspace ETL.',
    ],
    done: 'Sumber terdaftar, daftar tab muncul, dan profil header/tipe data tersedia.',
  },
  {
    number: 3,
    title: 'Klasifikasikan setiap tab',
    owner: 'SOURCE_OWNER / DATA_STEWARD',
    to: '/workspace',
    action: 'Kembali ke Workspace',
    purpose: 'Menentukan apakah tab merupakan data master atau data transaksi/dinamis.',
    steps: [
      'Pilih sumber dan tab yang sudah ditemukan.',
      'Pilih MASTER untuk data rujukan stabil seperti produk, cabang, pelanggan, atau unit.',
      'Pilih NON_MASTER untuk transaksi, aktivitas, saldo, pengukuran, atau data yang sering berubah.',
      'Konfirmasi klasifikasi dan periksa ulang bila fingerprint/schema sumber berubah.',
    ],
    done: 'Setiap tab yang akan diproses berstatus klasifikasi terkonfirmasi.',
  },
  {
    number: 4,
    title: 'Siapkan master data bila diperlukan',
    owner: 'DATA_STEWARD + TECHNICAL_APPROVER',
    to: '/masters',
    action: 'Buka Registry master',
    purpose: 'Membuat sumber rujukan baku dan identitas record stabil untuk relasi antardataset.',
    steps: [
      'Buat definisi master: field, tipe, business key, label, sensitivitas, dan policy perubahan.',
      'Preview kandidat serupa agar tidak membuat master duplikat.',
      'Submit dan approve definisi menggunakan reviewer berbeda.',
      'Deploy storage master, lalu buat binding tab MASTER ke definisi tersebut.',
      'Untuk dataset lain, buat binding kolom referensi ke field master approved.',
    ],
    done: 'Definisi dan binding approved, storage siap, serta record master dapat dimuat dan dicari.',
    optional: true,
  },
  {
    number: 5,
    title: 'Siapkan taxonomy untuk kategori baku',
    owner: 'DATA_STEWARD + TECHNICAL_APPROVER',
    to: '/taxonomies',
    action: 'Buka Registry taxonomy',
    purpose: 'Menyeragamkan kode kategori, label, sinonim, dan hierarki yang muncul dalam data.',
    steps: [
      'Buat taxonomy dan tambahkan term beserta kode, label, alias, dan parent.',
      'Tinjau versi dan approve taxonomy.',
      'Buat binding kolom taxonomy pada tab sumber.',
      'Uji nilai menggunakan resolver atau saran AI; nilai ambigu tetap membutuhkan keputusan pengguna.',
    ],
    done: 'Taxonomy dan binding approved; nilai sumber dapat diselesaikan ke kode term yang konsisten.',
    optional: true,
  },
  {
    number: 6,
    title: 'Buat dan verifikasi konfigurasi ETL',
    owner: 'SOURCE_OWNER / DATA_STEWARD',
    to: '/workspace',
    action: 'Buat konfigurasi',
    purpose: 'Menentukan bagaimana kolom sumber dibersihkan, divalidasi, dimuat, dan diterbitkan sebagai produk data.',
    steps: [
      'Pilih tab lalu gunakan template konfigurasi manual. Sistem mengisi kandidat nama, tipe, dan key dari hasil profiling; Anda tetap memeriksa dan mengubahnya sebelum review.',
      'Periksa mapping kolom, tipe target, transformasi, nullability, dan sensitivitas.',
      'Atur business key, strategi load, aturan kualitas, periode efektif, dan parameter incremental bila diperlukan.',
      'Lengkapi nama produk data, dimensi, metrik, sinonim, unit, serta visualisasi default.',
      'Jalankan validasi dan simpan seluruh perubahan.',
    ],
    done: 'Konfigurasi valid tanpa blocker dan siap disubmit untuk review.',
  },
  {
    number: 7,
    title: 'Review, approve, dan deploy',
    owner: 'TECHNICAL_APPROVER lalu editor',
    to: '/workspace',
    action: 'Buka konfigurasi',
    purpose: 'Memastikan konfigurasi aman dan disetujui sebelum membuat target atau menjalankan pemuatan.',
    steps: [
      'Editor submit konfigurasi setelah preview dan checklist lengkap.',
      'Approver yang berbeda memeriksa diff, DQ, sensitivitas, target, dan semantic metadata.',
      'Approver memilih approve atau reject dengan catatan yang jelas.',
      'Jika aturan siap tayang aktif, IT dan setiap unit terkait menyetujui revisi yang sama di Persetujuan tayang.',
      'Setelah semua persetujuan lengkap, editor menjalankan deploy dan mengaktifkan konfigurasi.',
      'Untuk sumber ber-policy, selesaikan review metadata dan aktifkan policy SOURCE approved.',
    ],
    done: 'Konfigurasi ACTIVE, target/semantic view tersedia, dan produk data lolos kebijakan akses.',
  },
  {
    number: 8,
    title: 'Jalankan dan setujui batch import',
    owner: 'Editor + approver',
    to: '/import-reviews',
    action: 'Buka Batch import',
    purpose: 'Memindahkan snapshot ke target melalui staging, temuan, pertanyaan, preview, dan approval.',
    steps: [
      'Buat batch untuk sumber, tab, dan konfigurasi active.',
      'Tunggu staging serta pemeriksaan kualitas selesai.',
      'Selesaikan pertanyaan taxonomy, referensi master, duplicate key, atau koreksi sumber.',
      'Revalidate bila dependency berubah, lalu buat preview perubahan.',
      'Approver menyetujui preview; editor menjalankan apply.',
    ],
    done: 'Batch berstatus SUCCEEDED dan jumlah record hasil sesuai preview yang disetujui.',
  },
  {
    number: 9,
    title: 'Pantau job dan kualitas data',
    owner: 'DATA_STEWARD / operator',
    to: '/jobs',
    action: 'Buka Job & ETL',
    purpose: 'Memastikan proses berjalan stabil dan masalah data diselesaikan sebelum dipakai pengguna.',
    steps: [
      'Pantau progres dan event job; retry hanya setelah penyebab gagal diperbaiki.',
      'Atur jadwal, dependency upstream, dan watermark incremental bila diperlukan.',
      'Buka Kualitas data untuk meninjau karantina dan mencatat resolusi.',
      'Reprocess setelah data sumber atau konfigurasi diperbaiki.',
    ],
    done: 'Job terakhir sukses, tidak ada blocker kualitas terbuka, dan freshness produk data meningkat.',
  },
  {
    number: 10,
    title: 'Tampilkan data di dashboard dan chart',
    owner: 'ANALYST / VIEWER',
    to: '/dashboard',
    action: 'Buka Dashboard',
    purpose: 'Mengubah data yang sudah dipercaya menjadi jawaban, tabel, dan visualisasi.',
    steps: [
      'Tulis pertanyaan bahasa alami, misalnya “tampilkan penjualan per cabang bulan ini”.',
      'Pilih ruang data bila diperlukan atau biarkan sistem menentukannya.',
      'Jawab klarifikasi bila produk, periode, atau ukuran masih ambigu.',
      'Tinjau tabel hasil dan pilih chart: bar, line, area, pie, donut, combo, scatter, heatmap, KPI, atau table.',
      'Gunakan query builder untuk kontrol eksplisit atas dimensi, metrik, filter, sort, dan join approved.',
    ],
    done: 'Data tampil dengan angka yang dapat ditelusuri ke produk, konfigurasi, dan sumber approved.',
  },
]
</script>

<template>
  <EtlShell>
    <p class="eyebrow">PANDUAN UMUM</p>
    <h1>Dari Google Sheet sampai dashboard</h1>
    <p class="guide-intro">
      Ikuti tahapan berikut secara berurutan untuk membawa spreadsheet menjadi data yang tervalidasi,
      dapat diakses sesuai kewenangan, dan siap ditampilkan sebagai tabel atau chart.
    </p>

    <section class="panel guide-prerequisites">
      <h2>Sebelum mulai</h2>
      <ul>
        <li>Pastikan akun dan role Anda sudah dibuat oleh PLATFORM_ADMIN.</li>
        <li>Siapkan URL/ID Google Sheet dan izin berbagi untuk service account backend.</li>
        <li>Tentukan data owner, data steward, unit, domain bisnis, yurisdiksi, purpose, dan sensitivitas.</li>
        <li>Siapkan approver berbeda untuk tindakan yang membutuhkan pemisahan editor dan reviewer.</li>
      </ul>
    </section>

    <nav class="panel guide-quick-links" aria-label="Jalur cepat panduan">
      <h2>Jalur cepat</h2>
      <div class="toolbar">
        <a href="#stage-1">Administrasi &amp; akses</a>
        <a href="#stage-2">Onboarding Google Sheet</a>
        <a href="#stage-4">Master &amp; taxonomy</a>
        <a href="#stage-6">Konfigurasi &amp; import</a>
        <a href="#stage-10">Dashboard &amp; chart</a>
      </div>
    </nav>

    <section class="guide-flow" aria-label="Tahapan implementasi data">
      <article
        v-for="stage in stages"
        :id="`stage-${stage.number}`"
        :key="stage.number"
        class="panel guide-stage"
      >
        <div class="guide-stage-number" aria-hidden="true">{{ stage.number }}</div>
        <div class="guide-stage-content">
          <div class="guide-stage-heading">
            <div>
              <p class="eyebrow">
                TAHAP {{ stage.number }} · {{ stage.owner }}
                <span v-if="stage.optional"> · SESUAI KEBUTUHAN</span>
              </p>
              <h2>{{ stage.title }}</h2>
            </div>
            <RouterLink class="button" :to="stage.to">
              {{ stage.action }} <ArrowRight :size="15" aria-hidden="true" />
            </RouterLink>
          </div>
          <p>{{ stage.purpose }}</p>
          <ol>
            <li v-for="step in stage.steps" :key="step">{{ step }}</li>
          </ol>
          <p class="guide-done">
            <CheckCircle2 :size="19" aria-hidden="true" />
            <span><strong>Selesai jika:</strong> {{ stage.done }}</span>
          </p>
        </div>
      </article>
    </section>

    <section class="panel guide-troubleshooting">
      <h2>Jika data belum muncul di dashboard</h2>
      <ol>
        <li>Periksa job terakhir pada Job &amp; ETL dan pastikan statusnya sukses.</li>
        <li>Periksa Batch import: tidak boleh ada pertanyaan wajib, dependency stale, atau apply tertunda.</li>
        <li>Periksa konfigurasi: harus approved, deployed, dan active.</li>
        <li>Jika gate siap tayang aktif, periksa status IT serta setiap unit terkait di Persetujuan tayang.</li>
        <li>Periksa metadata serta policy SOURCE: produk mungkin ditahan oleh yurisdiksi atau akses.</li>
        <li>Periksa definisi dimensi/metrik dan freshness produk pada Dashboard.</li>
        <li>Perjelas pertanyaan NL2SQL dengan nama ukuran, dimensi, dan periode.</li>
      </ol>
      <div class="toolbar">
        <RouterLink class="button" to="/jobs">Periksa job</RouterLink>
        <RouterLink class="button" to="/import-reviews">Periksa batch</RouterLink>
        <RouterLink class="button primary" to="/dashboard">Coba dashboard</RouterLink>
      </div>
    </section>
  </EtlShell>
</template>

<style scoped>
.guide-intro {
  max-width: 72ch;
  font-size: 1.05rem;
  line-height: 1.7;
}
.guide-prerequisites ul,
.guide-troubleshooting ol,
.guide-stage ol {
  display: grid;
  gap: 0.55rem;
  line-height: 1.55;
}
.guide-quick-links a {
  color: #047857;
  font-weight: 700;
}
.guide-flow {
  display: grid;
  gap: 1rem;
}
.guide-stage {
  position: relative;
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  gap: 1rem;
  scroll-margin-top: 1rem;
}
.guide-stage-number {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 999px;
  background: #047857;
  color: #fff;
  font-size: 1.1rem;
  font-weight: 800;
}
.guide-stage-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.guide-stage-heading h2 {
  margin-top: 0;
}
.guide-stage-heading .button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.35rem;
}
.guide-done {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  margin-bottom: 0;
  padding: 0.8rem 1rem;
  border-radius: 0.65rem;
  background: #ecfdf5;
  color: #065f46;
}
.guide-done svg {
  flex: 0 0 auto;
  margin-top: 0.15rem;
}
@media (max-width: 700px) {
  .guide-stage {
    grid-template-columns: 1fr;
  }
  .guide-stage-heading {
    display: grid;
  }
  .guide-stage-heading .button {
    width: fit-content;
  }
}
</style>
