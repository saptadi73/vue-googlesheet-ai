<script setup lang="ts">
import { ArrowRight, CheckCircle2 } from '@lucide/vue'
import EtlShell from '@/components/EtlShell.vue'
import ErrorResponseTable from '@/components/ErrorResponseTable.vue'
import GoogleSheetFormatGuide from '@/components/GoogleSheetFormatGuide.vue'
import TechnicalGlossary from '@/components/TechnicalGlossary.vue'
import AnalyticsExamples from '@/components/AnalyticsExamples.vue'
import MasterBindingGuide from '@/components/MasterBindingGuide.vue'

const stages = [
  {
    number: 1,
    title: 'Siapkan organisasi, akun, dan akses',
    owner: 'PLATFORM_ADMIN',
    to: '/admin',
    action: 'Buka Administrasi',
    purpose:
      'Menentukan siapa yang boleh mendaftarkan, mereview, mengoperasikan, dan membaca data.',
    steps: [
      'Buat akun sekaligus ajukan rekomendasi unit, domain, yurisdiksi dan paket izin dari form Registrasi. Masa akses 366 hari sejak pengajuan.',
      'Buat atribut departemen, domain bisnis, yurisdiksi, purpose, dan clearance.',
      'Admin lain memilih seluruh permintaan akun tersebut dan menyetujuinya sekaligus di Permintaan akses.',
      'Siapkan policy akses resource; gunakan Preview keputusan sebelum approval.',
      'Untuk katalog, pilih policy SOURCE ALLOW dengan DISCOVER/READ/QUERY dan atribut unit/domain/yurisdiksi sumber. Semua atribut wajib harus menjadi assignment aktif pembaca.',
      'Policy organisasi dibuat sekali dan disetujui admin lain; gunakan kembali untuk akun/sumber dengan scope yang sama. Approver konfigurasi dapat sekaligus menyetujui metadata serta mengaktifkan policy APPROVED melalui approval gabungan. ETL ACTIVE saja tidak berarti data sudah dimuat.',
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
    purpose:
      'Menghubungkan spreadsheet, menemukan tab, dan mengambil profil data tanpa menulis ke Google Sheet.',
    steps: [
      'Bagikan spreadsheet ke email service account backend sebagai Viewer.',
      'Isi nama sumber dan URL/ID spreadsheet.',
      'Pilih unit pemilik, domain, yurisdiksi, purpose, data owner, data steward, dan sensitivitas.',
      'Gunakan halaman Sumber & tracking untuk mencari sumber dan melihat status tiap tahap. Pilih Buka sumber, lalu lanjutkan Hubungkan & profiling di Workspace ETL.',
      'Jika sumber sudah terdaftar, gunakan sumber yang sama. Untuk sumber unlink, admin memilih Pulihkan dengan dua konfirmasi, bukan mendaftarkan ulang.',
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
    purpose:
      'Menentukan bagaimana kolom sumber dibersihkan, divalidasi, dimuat, dan diterbitkan sebagai produk data.',
    steps: [
      'Pilih tab lalu gunakan template konfigurasi manual. Sistem mengisi kandidat nama, tipe, dan key dari hasil profiling; Anda tetap memeriksa dan mengubahnya sebelum review.',
      'Periksa mapping kolom, tipe target, transformasi, nullability, dan sensitivitas.',
      'Atur business key, strategi load, aturan kualitas, periode efektif, dan parameter incremental bila diperlukan.',
      'Lengkapi nama produk data, dimensi, metrik, sinonim, unit, serta visualisasi default.',
      'Jalankan validasi dan simpan seluruh perubahan.',
      'source_column harus persis header profil terbaru. Konfigurasi approved/active/rejected immutable: clone ke draft baru; bila header lama hilang dan clone gagal, buat draft baru dari profil terbaru.',
    ],
    done: 'Konfigurasi valid tanpa blocker dan siap disubmit untuk review.',
  },
  {
    number: 7,
    title: 'Review, approve, dan deploy',
    owner: 'TECHNICAL_APPROVER lalu editor',
    to: '/workspace',
    action: 'Buka konfigurasi',
    purpose:
      'Memastikan konfigurasi aman dan disetujui sebelum membuat target atau menjalankan pemuatan.',
    steps: [
      'Editor submit konfigurasi setelah preview dan checklist lengkap.',
      'Approver yang berbeda memeriksa diff, DQ, sensitivitas, target, dan semantic metadata.',
      'Approver membaca ringkasan metadata dan memilih policy SOURCE APPROVED, lalu menyetujui konfigurasi dan akses dalam satu transaksi. Jika ada blocker, tidak ada approval sebagian; baca helper approval gabungan.',
      'Jika aturan siap tayang aktif, IT dan setiap unit terkait menyetujui revisi yang sama di Persetujuan tayang.',
      'Setelah semua persetujuan lengkap, editor menjalankan deploy dan mengaktifkan konfigurasi.',
      'Tidak perlu kembali ke approval metadata satu per satu setelah approval gabungan berhasil. Jika metadata diubah lagi, akses dicabut dan perlu approval gabungan baru atau jalur review metadata admin yang tetap tersedia.',
    ],
    done: 'Konfigurasi ACTIVE, target/semantic view tersedia, dan produk data lolos kebijakan akses.',
  },
  {
    number: 8,
    title: 'Sync manual dan pemuatan data',
    owner: 'Editor; approver untuk batch biasa/master',
    to: '/sources',
    action: 'Buka Sumber & tracking',
    purpose:
      'Memuat data valid sesuai konfigurasi aktif yang disetujui, tanpa approval batch tambahan pada sync langsung NON_MASTER.',
    steps: [
      'Gunakan Sync manual per sumber di Sumber & tracking atau Workspace. Konfirmasi pembacaan/biaya AI, pantau job dan hasil per tab; tidak perlu menunggu jadwal mingguan.',
      'NON_MASTER ACTIVE dengan approval reviewer berbeda, akses POLICY_APPROVED dan rilis siap langsung dimuat jika validasi teknis, AI dan preview konflik lolos.',
      'Periksa status serta Baris dimuat per tab. Job sync induk berhasil belum membuktikan semua tab sudah dimuat.',
      'Menunggu tindakan berarti berhenti. Tekan Lihat detail berikon mata untuk kode, keterangan, nomor baris asli Sheet dan kolom. Selesaikan temuan dengan verifikasi pemilik data.',
      'Setelah batch sync langsung siap tanpa blocker, Sync manual kembali dapat melanjutkan pemuatan. Jika snapshot/dependency berubah, gunakan batch terbaru; revalidate tidak mengganti dependency lama.',
      'Master, FULL_REFRESH, jadwal dan batch biasa tidak memakai jalur langsung. Batch biasa/master tetap preview, approval reviewer, lalu Apply.',
    ],
    done: 'Batch per tab SUCCEEDED; Baris dimuat dan waktu pemuatan tersedia.',
  },
  {
    number: 9,
    title: 'Pantau job dan kualitas data',
    owner: 'DATA_STEWARD / operator',
    to: '/jobs',
    action: 'Buka Job & ETL',
    purpose:
      'Memastikan proses berjalan stabil dan masalah data diselesaikan sebelum dipakai pengguna.',
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

const workflowTransitionNotice =
  'Rancangan penyederhanaan sedang ditinjau. Saat ini aplikasi masih dapat meminta review metadata sumber, review konfigurasi, approval rilis, approval batch, serta approval master/binding. Ikuti status dan blocker yang tampil di aplikasi sampai rollout perubahan diumumkan.'
</script>

<template>
  <EtlShell>
    <p class="eyebrow">PANDUAN UMUM</p>
    <h1>Dari Google Sheet sampai dashboard</h1>
    <section id="akses-akun" class="panel">
      <h2>Akses akun baru: satu pengajuan, satu tinjauan bersama</h2>
      <ol>
        <li>
          Admin mengisi akun dan role di Registrasi, memilih unit, domain, yurisdiksi serta paket
          izin yang benar-benar diperlukan. Isi alasan bisnis; masa akses rekomendasi 366 hari sejak
          pengajuan, bukan sejak disetujui.
        </li>
        <li>
          Akun serta semua permintaan akses disimpan bersama. Jika target tidak valid, semuanya
          dibatalkan; tidak ada akun setengah jadi. Permintaan PENDING belum memberi assignment atau
          izin.
        </li>
        <li>
          Admin lain membuka Permintaan akses, memilih seluruh rekomendasi untuk akun tersebut,
          memeriksa scope, periode, alasan, lalu Setujui permintaan terpilih. Jangan memilih akses
          user lain yang tidak ikut diperiksa. Jika satu permintaan stale, kedaluwarsa, atau tumpang
          tindih, seluruh persetujuan dibatalkan. Muat ulang dan perbaiki penyebabnya.
        </li>
        <li>
          Policy APPROVED organisasi digunakan kembali jika atribut akun memenuhi seluruh syarat.
          Tidak perlu membuat policy baru setiap membuat akun. Sumber tetap harus terikat policy
          yang berlaku dan metadata sudah disetujui. DENY tetap mengalahkan ALLOW; EXPORT/ADMIN
          tidak diberikan otomatis.
        </li>
      </ol>
      <p>
        Jika dropdown kosong, admin perlu membuat atribut/paket izin terlebih dahulu. Role
        menentukan tugas di aplikasi, bukan akses otomatis ke seluruh data. Akses berakhir setelah
        periodenya habis dan perlu pengajuan/tinjauan baru.
      </p>
      <RouterLink class="button" to="/access-requests">Buka permintaan akses</RouterLink>
    </section>
    <section id="approval-gabungan" class="panel">
      <h2>Helper lengkap: mengapa approval gabungan belum bisa disetujui?</h2>
      <p>
        Approval gabungan mencakup konfigurasi ETL, review metadata sumber, serta aktivasi akses
        menggunakan policy SOURCE ALLOW yang sudah APPROVED. Approver harus berwenang untuk
        konfigurasi sumber tersebut, bukan editor metadata dan bukan pembuat/perubahan terakhir
        konfigurasi. Ini satu transaksi: gagal satu syarat berarti tidak ada approval sebagian.
      </p>
      <dl>
        <dt>Metadata belum lengkap atau penanggung jawab tidak aktif</dt>
        <dd>
          Buka sumber di Workspace. Editor mengisi unit, domain, yurisdiksi, purpose, owner,
          steward, sensitivitas. Editor harus mempunyai assignment scope yang aktif; owner/steward
          juga harus aktif pada tenant yang sama. Reviewer membaca ringkasan, bukan menekan Simpan
          metadata karena tindakan itu menjadikannya editor terakhir. Admin dapat membenahi
          assignment lewat pengelolaan akun.
        </dd>
        <dt>Anda pembuat konfigurasi atau editor metadata</dt>
        <dd>
          Gunakan akun TECHNICAL_APPROVER atau PLATFORM_ADMIN lain yang memang berwenang. Jika
          approver sumber sudah ditunjuk, ia harus ada di daftar approver konfigurasi. Jangan
          mengubah role atau impersonate akun untuk melewati maker–checker.
        </dd>
        <dt>Metadata ditolak</dt>
        <dd>
          Editor memperbaiki metadata melalui Workspace sampai kembali PENDING, lalu approver memuat
          ulang ringkasan. Status REJECTED tidak otomatis menjadi APPROVED hanya karena konfigurasi
          disetujui.
        </dd>
        <dt>Policy APPROVED belum tersedia atau tidak cocok</dt>
        <dd>
          Admin menyiapkan SOURCE ALLOW, mengikat kode sumber, memasukkan ketiga atribut
          unit/domain/yurisdiksi sumber dan tindakan DISCOVER serta QUERY (READ disarankan untuk
          penggunaan katalog). Admin lain menyetujui policy. Pastikan masa berlaku belum berakhir
          dan policy tidak dicabut. Kontrol baris/kolom pada policy SOURCE belum didukung untuk
          aktivasi; pilih policy yang memang sesuai, bukan melonggarkan scope agar lolos. Jika ada
          beberapa policy cocok, approver memilih secara eksplisit. DENY dan pembatasan pembaca
          tetap diperiksa saat membaca data.
        </dd>
        <dt>Revisi metadata, konfigurasi, snapshot, atau klasifikasi berubah</dt>
        <dd>
          Muat ulang ringkasan approval dan konfigurasi. Jalankan validasi/profiling sesuai
          kebutuhan, selesaikan pertanyaan DQ, cek seluruh mapping/section, ajukan ulang review.
          Persetujuan memakai revision dan snapshot yang benar-benar diperiksa; tidak boleh memakai
          data lama dari browser.
        </dd>
        <dt>Gate siap tayang belum lengkap</dt>
        <dd>
          Persetujuan IT dan setiap unit yang diwajibkan tetap berlaku. Buka Persetujuan tayang dan
          selesaikan keputusan terhadap revisi yang sama. Master/jadwal/batch biasa tetap approval
          batch; sync langsung NON_MASTER valid menggunakan approval konfigurasi aktif.
        </dd>
      </dl>
      <p>
        Jika ringkasan gagal dimuat, baca pesan error, periksa kewenangan approver lalu Muat ulang
        ringkasan approval. Jika tombol masih nonaktif, selesaikan blocker. Setelah berhasil, tidak
        perlu approval metadata terpisah lagi. Deploy mengaktifkan konfigurasi; Sync manual langsung
        memuat NON_MASTER valid tanpa approval batch tambahan. Master/batch biasa tetap melalui
        preview, approval dan Apply.
      </p>
      <div class="toolbar">
        <RouterLink class="button" to="/workspace">Buka Workspace</RouterLink
        ><RouterLink class="button" to="/release-approvals">Persetujuan tayang</RouterLink>
      </div>
    </section>
    <section id="sync-manual" class="panel">
      <h2>Sync manual dan status katalog</h2>
      <p>
        Untuk temuan AI, nilai asli yang sudah diverifikasi sah dapat dikonfirmasi melalui
        Konfirmasi nilai asli sah dengan alasan wajib yang diaudit. Error teknis tidak dapat
        dilewati. Setelah semua blocker selesai dan cakupan AI lengkap, Sync manual kembali dapat
        memuat batch NON_MASTER siap sesuai konfigurasi aktif. Batch biasa/master tetap preview,
        approval reviewer terpisah dan Apply. Menjawab temuan saja belum memuat data. Dugaan data
        pribadi atau salah mapping harus diverifikasi pemilik data, bukan diterima otomatis.
      </p>
      <p>
        Data yang terlihat di Sheet belum tentu sudah dimuat. Tekan Sync manual lalu Jalankan sync
        sekarang untuk langsung memuat tab NON_MASTER yang lolos validasi teknis, pemeriksaan AI,
        dan preview konflik, berdasarkan konfigurasi ACTIVE yang telah disetujui reviewer terpisah.
        Konfigurasi dan akses/rilis sumber harus tetap berlaku. Tidak meminta approval batch ulang
        untuk data yang lolos. Master, perubahan konfigurasi, konflik, atau dugaan keamanan/PII
        berhenti tanpa pemuatan.
      </p>
      <p>
        Tabel hasil ETL aktif menyediakan Buka Google Sheet ke tab asal, Buka sumber ke pengaturan
        tab, dan Sync manual data. Sync berlaku untuk seluruh tab yang siap. Konfirmasi menyetujui
        perubahan database dan biaya AI; Muat ulang hasil hanya memantau. Batch lama tanpa keputusan
        pengguna dapat diperiksa ulang terhadap konfigurasi aktif jika seluruh blocker berasal dari
        AI. Jadwal otomatis dan batch review biasa tetap memakai preview, approval, Apply.
      </p>
      <p>
        Menunggu tindakan berarti proses berhenti pada temuan, bukan worker masih berjalan. Tombol
        Lihat detail berikon mata pada tracking, tabel hasil ETL, dan audit trail membuka modal
        berisi keterangan, kode penghambat, nomor baris asli Google Sheet saat snapshot dibaca
        (termasuk header), kolom temuan, serta tautan batch untuk tindak lanjut. Ringkasan audit
        menyimpan maksimal 20 lokasi tanpa isi nilai; daftar pertanyaan dapat dimuat bertahap.
        Membuka modal tidak menyetujui temuan atau menjalankan sync. Riwayat kegagalan lama tetap
        tersedia dan tidak berarti pemuatan terbaru gagal.
      </p>
      <ul>
        <li>
          BLOCKED: prasyarat tab belum siap, misalnya konfigurasi/binding belum disetujui atau tab
          hilang. Pesan per tab menjelaskan apa yang perlu diperbaiki; tab lain yang siap tetap
          dibuatkan batch.
        </li>
        <li>
          NEEDS_INPUT / Menunggu tindakan: pemuatan berhenti pada pertanyaan/temuan, bukan masih
          berjalan. Lihat detail dan selesaikan tindakan; sync langsung dapat dilanjutkan ketika
          siap.
        </li>
        <li>
          SUCCEEDED berarti pemuatan selesai. Batch biasa/master tetap memerlukan preview, approval
          dan Apply; sync langsung NON_MASTER memakai approval konfigurasi aktif dan menerapkan
          otomatis hanya bila seluruh pemeriksaan lolos.
        </li>
        <li>
          FAILED: perbaiki penyebab teknis terlebih dahulu; Revalidate batch gagal tanpa membuat
          batch duplikat. Resume hanya sesudah blocker NEEDS_INPUT selesai.
        </li>
        <li>
          Proses yang masih berjalan menolak enqueue sync baru. Muat ulang hasil tidak mengulang
          pembacaan Sheet atau membuat batch. Batas pemantauan 10 menit bukan pembatalan job;
          lanjutkan di monitor job.
        </li>
      </ul>
      <p>
        Katalog mempertahankan versi aktif terakhir yang masih dapat diakses. Sedang diperbarui
        menandai job, revisi konfigurasi, drift struktur, perubahan snapshot atau batch yang belum
        selesai. Timestamp konfigurasi aktif berasal dari audit deployment; Data dimuat dari ETL
        atau import yang berhasil. Perubahan Google Sheet hanya diketahui setelah profiling/sync,
        bukan live push. Saat metadata akses berubah, policy dicabut atau hak pembaca berakhir, data
        boleh hilang dari katalog sampai izin kembali valid; status katalog tidak boleh melewati
        kontrol akses.
      </p>
      <RouterLink class="button" to="/sources">Buka sumber &amp; tracking</RouterLink>
    </section>
    <p class="guide-intro">
      Ikuti tahapan berikut secara berurutan untuk membawa spreadsheet menjadi data yang
      tervalidasi, dapat diakses sesuai kewenangan, dan siap ditampilkan sebagai tabel atau chart.
    </p>

    <aside class="info-banner" role="note">{{ workflowTransitionNotice }}</aside>

    <section class="panel guide-prerequisites">
      <h2>Sebelum mulai</h2>
      <ul>
        <li>Pastikan akun dan role Anda sudah dibuat oleh PLATFORM_ADMIN.</li>
        <li>Siapkan URL/ID Google Sheet dan izin berbagi untuk service account backend.</li>
        <li>
          Tentukan data owner, data steward, unit, domain bisnis, yurisdiksi, purpose, dan
          sensitivitas.
        </li>
        <li>
          Siapkan approver berbeda untuk tindakan yang membutuhkan pemisahan editor dan reviewer.
        </li>
      </ul>
    </section>

    <nav class="panel guide-quick-links" aria-label="Jalur cepat panduan">
      <h2>Jalur cepat</h2>
      <div class="toolbar">
        <a href="#stage-1">Administrasi &amp; akses</a>
        <a href="#stage-2">Onboarding Google Sheet</a>
        <a href="#stage-4">Master &amp; taxonomy</a>
        <a href="#binding-master">Binding master langkah demi langkah</a>
        <a href="#stage-6">Konfigurasi &amp; import</a>
        <a href="#stage-10">Dashboard &amp; chart</a>
        <a href="#error-responses">Tabel error response</a>
        <a href="#format-google-sheet">Format Google Sheet ideal</a>
        <a href="#istilah-teknis">Istilah teknis</a>
        <a href="#contoh-excel">Contoh Excel</a>
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
      <h2>Mengubah kolom sumber atau konfigurasi existing</h2>
      <ol>
        <li>
          Edit nilai, tambah kolom, atau rename header langsung di Google Sheet. Adapter aplikasi
          hanya membaca, tidak menulis balik ke Sheet.
        </li>
        <li>
          Buka sumber dan tab yang sama di Workspace, lalu pilih Profiling ulang. Jangan
          mendaftarkan ulang sumber; Muat ulang data tersimpan hanya menyegarkan tampilan.
        </li>
        <li>
          Gunakan header persis dari profil terbaru sebagai source_column. Profil drift membuat
          konfigurasi lama stale. Clone konfigurasi approved/active/rejected menjadi draft; bila
          clone gagal karena header lama hilang, buat draft manual/AI baru.
        </li>
        <li>
          Untuk target NON_MASTER, periksa Preview perubahan schema di langkah Validasi &amp;
          persetujuan: operasi, jumlah record lama, contoh tanggal dan blocker. Centang konfirmasi
          schema sebelum submit; approval mengikat fingerprint schema/data. Worker memigrasikan
          perubahan aman saat deploy, bukan saat dry-run atau approval.
        </li>
        <li>
          Range, header/awal data, dan enabled pada tab dengan konfigurasi aktif terkunci
          (CONFIGURATION_CONFLICT). Jangan mencoba melewati penguncian; minta penanganan
          lifecycle/migrasi yang direview.
        </li>
        <li>
          Untuk master, field nullable baru perlu approval definisi, redeploy storage, serta review
          binding; record lama bernilai null. Field wajib baru, key, tipe, rename/drop, atau
          perubahan nullability memerlukan migrasi yang direview, bukan hapus/buat ulang tabel.
        </li>
        <li>
          Sync review memprofilkan sumber lalu membuat batch, bukan memperbaiki mapping stale.
          Periksa profil, draft, validasi snapshot, approval, dan kesiapan target sebelum batch baru
          diproses.
        </li>
      </ol>
    </section>

    <section class="panel guide-troubleshooting">
      <h2>Tanggal transaksi dan label periode w1/w2/januari</h2>
      <ul>
        <li>
          Untuk transaksi atau kejadian, simpan tanggal kejadian nyata. Nilai ISO seperti 2026-01-06
          atau tanggal eksplisit yang cocok dengan parse_date_id dan pola strptime dapat dipakai;
          tidak wajib berupa sel native date Google Sheets. Periksa hasil parsing pada validasi
          snapshot.
        </li>
        <li>
          Untuk agregat mingguan/bulanan, pertahankan grain periode. Sediakan tahun eksplisit dan
          batas awal/akhir periode sesuai kalender minggu yang disepakati. Label w1/w2 atau januari
          saja tidak menentukan tahun atau tanggal.
        </li>
        <li>
          Jangan mengarang tanggal transaksi dengan memilih tanggal 1 atau Senin dari label. Jika
          bisnis memilih tanggal acuan periode, dokumentasikan sebagai tanggal acuan, bukan tanggal
          setiap transaksi.
        </li>
        <li>
          Batas periode membantu pemodelan, tetapi editor/query saat ini tidak menyediakan analisis
          overlap periode atau expression perhitungan bebas. Siapkan nilai eksplisit di sumber dan
          gunakan mapping/transformasi serta filter tanggal yang memang didukung.
        </li>
      </ul>
    </section>

    <section id="review-ulang-tanggal" class="panel guide-troubleshooting">
      <h2>Review ulang: kolom baru start_date dan end_date</h2>
      <ol>
        <li>
          Tambahkan tanggal lengkap di Google Sheet, lalu Profiling ulang sumber/tab yang sama.
          Clone versi approved/active ke draft bila header lama masih ada; jika tidak, buat draft
          dari profil terbaru. Jangan registrasi ulang sumber.
        </li>
        <li>
          Periksa identitas, grain, dan nama tabel tujuan. Revisi dataset yang sama sebaiknya
          mempertahankan target lama kecuali perpindahan tabel memang direncanakan dan direview.
          Draft manual baru bukan salinan seluruh konfigurasi lama.
        </li>
        <li>
          Text/varchar mendapat trim otomatis sebelum transformasi, validasi dan pemuatan. Contoh: "
          KAN Jabung " menjadi "KAN Jabung"; spasi tengah dan nol depan tetap. Spasi saja menjadi
          NULL jika boleh kosong; kolom wajib tetap error. AI tidak menilai [REDACTED] sebagai nilai
          rusak, dan duplikat dibuktikan dari data asli. Sync manual dapat memeriksa ulang batch
          yang tertahan hanya oleh AI tanpa keputusan pengguna.
        </li>
        <li>
          Pada Kolom, map start_date/end_date ke tipe date. Pada Cleansing, tambahkan parse_date_id
          dan pilih Format nilai tanggal = Serial Google Sheets untuk setiap kolom yang berisi angka
          serial Sheets: 46023 menjadi 2026-01-01 dan 46053 menjadi 2026-01-31. Pola tanggal boleh
          kosong untuk serial; text tanggal memakai pola strptime sesuai sumber.
        </li>
        <li>
          Simpan draft lalu Dry-run ulang. TYPE_OR_NULL_ERROR menunjukkan konversi atau nilai wajib
          bermasalah; baca kolom dan baris asli pada temuan. Jangan menghapus baris atau
          mengaktifkan nullable hanya untuk menutupi format salah. Isi checklist bagian/kolom lalu
          Ajukan review setelah tidak ada blocker.
        </li>
        <li>
          Periksa dan konfirmasi preview schema sebelum Ajukan review. Nullable baru didukung
          (record lama null), perubahan tipe pada tabel kosong, serta bigint serial menjadi date
          pada tabel berisi data dengan parse_date_id, pilihan Format nilai tanggal = Serial Google
          Sheets dan semua nilai lama valid. View mengikuti ID tab; perpindahan/proyeksi juga
          direview.
        </li>
        <li>
          Worker menjaga record lama/ACL, memperbarui hash untuk APPEND dan membatalkan seluruh
          DDL/view/konversi jika transaksi migrasi gagal, tanpa CASCADE. Aktivasi, audit sukses dan
          status job ikut transaksi DDL; gagal sebelum commit mempertahankan kondisi sebelumnya.
          Audit gagal tersedia setelah rollback; retry memeriksa fingerprint review. Rename/drop
          fisik, perubahan key, kolom wajib baru pada tabel berisi data/dependency tidak aman tetap
          diblokir. SCHEMA_MIGRATION_STALE meminta preview/review baru; SCHEMA_REVIEW_REQUIRED
          meminta clone/review versi lama tanpa bukti schema. Cocokkan configuration_id job dengan
          versi APPROVED, bukan URL draft lama.
        </li>
        <li>
          Deploy SUCCEEDED menyiapkan schema dan produk, belum memuat data. Jalankan Sync manual
          untuk NON_MASTER yang memenuhi syarat dan periksa baris dimuat per tab. Job FAILED lama
          tetap menjadi riwayat, bukan status percobaan baru.
        </li>
      </ol>
    </section>

    <section class="panel guide-troubleshooting">
      <h2>Jika data belum muncul di dashboard</h2>
      <ol>
        <li>Periksa job terakhir pada Job &amp; ETL dan pastikan statusnya sukses.</li>
        <li>
          Periksa Batch import: tidak boleh ada pertanyaan wajib, dependency stale, atau apply
          tertunda.
        </li>
        <li>Periksa konfigurasi: harus approved, deployed, dan active.</li>
        <li>
          Jika gate siap tayang aktif, periksa status IT serta setiap unit terkait di Persetujuan
          tayang.
        </li>
        <li>
          Periksa metadata serta policy SOURCE: produk mungkin ditahan oleh yurisdiksi atau akses.
        </li>
        <li>Periksa definisi dimensi/metrik dan freshness produk pada Dashboard.</li>
        <li>Perjelas pertanyaan NL2SQL dengan nama ukuran, dimensi, dan periode.</li>
      </ol>
      <div class="toolbar">
        <RouterLink class="button" to="/jobs">Periksa job</RouterLink>
        <RouterLink class="button" to="/import-reviews">Periksa batch</RouterLink>
        <RouterLink class="button primary" to="/dashboard">Coba dashboard</RouterLink>
      </div>
    </section>
    <section id="binding-master" class="panel guide-troubleshooting">
      <h2>Panduan khusus binding master</h2>
      <MasterBindingGuide />
    </section>
    <section id="contoh-excel" class="panel guide-troubleshooting">
      <h2>Contoh Excel untuk analitik dan action plan</h2>
      <AnalyticsExamples />
    </section>
    <section id="istilah-teknis" class="panel guide-troubleshooting">
      <h2>Istilah teknis dalam bahasa sederhana</h2>
      <TechnicalGlossary />
    </section>
    <section id="format-google-sheet" class="panel guide-troubleshooting">
      <h2>Format Google Sheet ideal</h2>
      <GoogleSheetFormatGuide />
    </section>
    <section id="error-responses" class="panel guide-troubleshooting">
      <h2>Tabel error response</h2>
      <p>
        Catat kode, ID job, sumber/tab dan versi konfigurasi. Kode keputusan akses, temuan validasi
        dan blocker batch juga tercakup; tidak semuanya merupakan error HTTP.
      </p>
      <ErrorResponseTable />
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
