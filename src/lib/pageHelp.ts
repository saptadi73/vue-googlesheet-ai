export interface PageHelpContent {
  title: string
  purpose: string
  steps: string[]
  notes?: string[]
  examples?: Array<{ label: string; value: string }>
}

interface PageHelpEntry extends PageHelpContent {
  matches: (path: string) => boolean
}

const exact = (expected: string) => (path: string) => path === expected
const pattern = (expression: RegExp) => (path: string) => expression.test(path)

const entries: PageHelpEntry[] = [
  {
    matches: exact('/guide'),
    title: 'Panduan umum awal sampai akhir',
    purpose:
      'Menjelaskan prosedur lengkap dari persiapan akses dan Google Sheet sampai data tampil di dashboard dan chart.',
    steps: [
      'Mulai dari bagian Sebelum mulai dan pastikan akun, role, service account, serta metadata bisnis tersedia.',
      'Ikuti tahap 1–10 secara berurutan; tahap master dan taxonomy dijalankan sesuai kebutuhan dataset.',
      'Gunakan kriteria Selesai jika pada setiap tahap sebelum melanjutkan.',
      'Jika data belum muncul, ikuti checklist troubleshooting di bagian akhir halaman.',
    ],
    notes: [
      'Tautan tahap yang tidak sesuai role akan diarahkan ke halaman yang diizinkan untuk akun Anda.',
      'Untuk sumber yang sudah terdaftar, ikuti bagian perubahan kolom dan periode; jangan mengulang pendaftaran.',
    ],
  },
  {
    matches: exact('/login'),
    title: 'Masuk ke aplikasi',
    purpose: 'Membuka sesi aman menggunakan akun yang dibuat administrator tenant.',
    steps: [
      'Pastikan kode tenant sesuai organisasi Anda.',
      'Masukkan username atau email dan password.',
      'Pilih Masuk. Sistem akan membuka halaman yang sesuai dengan role akun.',
    ],
    notes: ['Hubungi administrator bila akun belum tersedia atau akses ditolak.'],
  },
  {
    matches: exact('/dashboard'),
    title: 'Dashboard dan pencarian data',
    purpose:
      'Mencari data dengan bahasa alami atau menyusun query katalog, lalu melihat hasil sebagai tabel dan chart.',
    steps: [
      'Tulis pertanyaan pada Tanyakan data dengan bahasa alami. Pilihan ruang data boleh dikosongkan.',
      'Jika sistem meminta klarifikasi, lengkapi periode, produk, lokasi, atau ukuran yang dimaksud.',
      'Tinjau tabel dan pilih bentuk chart yang paling sesuai.',
      'Gunakan Susun query dari katalog bila Anda ingin memilih dimensi, metrik, filter, dan join secara manual.',
      'Admin/steward dapat memakai Edit metadata bisnis produk pada katalog untuk nama/deskripsi produk serta unit/sinonim metrik. Mapping, dimensi, dan definisi agregasi metrik diubah melalui draft ETL; relationship melalui Governance.',
    ],
    notes: [
      'Hasil hanya memakai produk data dan field yang diizinkan untuk akun Anda.',
      'Filter tanggal memerlukan tanggal eksplisit yang valid. Label w1/w2 atau januari tanpa tahun dan kalender minggu tidak cukup untuk menentukan periode; jangan mengarang tanggal.',
      'Agregat periode tidak otomatis menjadi transaksi harian. Analisis overlap periode dan expression perhitungan bebas belum didukung oleh editor ini.',
    ],
    examples: [
      { label: 'Pertanyaan penjualan', value: 'Tampilkan total penjualan per cabang bulan ini.' },
      {
        label: 'Pertanyaan tren',
        value: 'Bandingkan total penjualan per bulan di Jawa Timur tahun ini.',
      },
    ],
  },
  {
    matches: exact('/chat'),
    title: 'Chat data',
    purpose: 'Menjelajahi data melalui pertanyaan bahasa alami berbasis NL2SQL.',
    steps: [
      'Pilih ruang data bila sudah mengetahui sumber analisis; biarkan kosong agar sistem menentukan.',
      'Tulis pertanyaan lengkap, termasuk ukuran, dimensi, dan periode bila relevan.',
      'Jawab klarifikasi atau pilih kandidat template bila diminta.',
      'Tinjau tabel, chart, detail request, lalu kirim feedback bila hasil perlu diperbaiki.',
    ],
    examples: [
      { label: 'Pertanyaan lengkap', value: 'Tampilkan total penjualan per cabang bulan ini.' },
    ],
    notes: [
      'Label w1/w2 atau januari saja bukan tanggal transaksi. Lengkapi tahun dan batas periode sesuai kalender minggu yang disepakati; jangan menebak tanggal dari label.',
      'Join hanya memakai relationship approved yang diizinkan; SQL dan expression bebas tidak tersedia.',
    ],
  },
  {
    matches: exact('/sources'),
    title: 'Sumber dan progres pemrosesan',
    purpose:
      'Mencari semua sumber yang terdaftar dan menelusuri progres discovery, profiling, konfigurasi atau binding master, pemuatan data, serta penanggung jawabnya.',
    steps: [
      'Cari sumber berdasarkan nama, kode, atau spreadsheet; gunakan pagination untuk menelusuri daftar.',
      'Periksa status per tahap dan nama Data Owner/Data Steward untuk mengetahui tindak lanjut yang diperlukan.',
      'Pilih Buka sumber untuk melanjutkan proses pada sumber tersebut di Workspace ETL.',
      'Tekan ikon tanda tanya untuk petunjuk tahap. Lihat detail berikon mata membuka modal kode, keterangan, nomor baris asli Google Sheet pada snapshot dan kolom temuan.',
      'Pilih Riwayat untuk meninjau kronologi aktivitas, pelaku, hasil, dan error setiap percobaan job.',
      'Untuk konfigurasi owner-managed yang sudah ACTIVE dan lolos pemeriksaan akses, pemilik dapat memakai Sync manual. Jika masih ada blocker atau workflow legacy, ikuti status yang tampil.',
      'Admin dapat meninjau sumber duplikat, memilih sumber utama, lalu Unlink entri yang tidak dipakai setelah memastikan tidak ada relasi yang menghalangi.',
      'Aktifkan tampilan sumber unlink bila perlu memulihkan riwayat, lalu gunakan Pulihkan setelah dua konfirmasi.',
    ],
    notes: [
      'Sumber yang gagal profiling atau konfigurasi tetap terdaftar. Perbaiki tahap yang gagal; jangan daftarkan ulang spreadsheet.',
      'Perubahan file dipantau berkala. Jika terdeteksi, sistem mengubah status, mencatat actor Sistem, lalu menjalankan discovery dan profiling. Notifikasi di Job & ETL membuka sumber/tracking terkait; review lama tetap stale sampai draft divalidasi dan diajukan ulang. Polling tidak menunjukkan identitas editor Google Sheets.',
      'Jika header baru atau berubah nama, edit Google Sheet lalu jalankan Profiling ulang pada sumber dan tab yang sama. Muat ulang tampilan bukan pembacaan ulang Sheet.',
      'Unlink menyimpan riwayat dan menghapus entri dari daftar aktif. Unlink memerlukan alasan dan dua konfirmasi; pemulihan juga meminta dua konfirmasi.',
      'Status tracking menjelaskan progres, bukan hak akses. Binding master approved belum berarti record sudah dimuat; periksa batch import dan apply.',
      'Menunggu tindakan (NEEDS_INPUT) berarti pemuatan berhenti, bukan worker berjalan. Audit trail menyimpan ringkasan lokasi tanpa nilai mentah; membuka detail tidak menyetujui atau menjalankan sync.',
      'Untuk jalur master, jadwal, atau batch, gunakan aksi yang ditampilkan pada halaman masing-masing. Periksa SUCCEEDED dan Baris dimuat per tab, bukan hanya job induk.',
    ],
  },
  {
    matches: exact('/workspace'),
    title: 'Workspace konfigurasi ETL',
    purpose:
      'Menghubungkan Google Sheet, membaca struktur tab, membuat konfigurasi ETL, dan mengelola metadata akses sumber.',
    steps: [
      'Sebelum onboarding, baca Format Google Sheet ideal pada Bantuan: header, grain/key, master, metrik dan waktu/periode wajib untuk data periodik serta waktu pengambilan.',
      'Hubungkan spreadsheet baru dengan nama, URL/ID, pemilik, domain, yurisdiksi, purpose, dan sensitivitas.',
      'Bagikan spreadsheet kepada service account backend sebagai Viewer sebelum profiling.',
      'Tekan Hubungkan & profiling sekali; baca status di dekat tombol dan buka monitor job bila discovery masih berjalan atau gagal.',
      'Saat membuka sumber, gunakan tabel Tahap proses setiap tab untuk membandingkan discovery, profiling, klasifikasi, konfigurasi, dan database. Pilih tab hanya untuk melanjutkan langkahnya; tab berstatus Dikecualikan tidak ikut sinkronisasi.',
      'Tidak semua tab perlu diproses. Biarkan tab yang bukan bagian dari dataset tetap Dikecualikan; aktifkan hanya tab yang memang disetujui untuk dikelola.',
      'Di bagian bawah Workspace, tabel hasil ETL menampilkan output aktif beserta tautan spreadsheet/tab sumber. Perbaiki nilai/header di Google Sheet lalu Profiling ulang pada sumber yang sama dan buat draft mapping terbaru. Pemilik menyelesaikan validasi dan deploy pada owner workflow; konfigurasi legacy mengikuti review yang ditampilkan. Perubahan struktur target dipreview dan dikonfirmasi sebelum deploy.',
      'Jika tab dihapus dari spreadsheet, Muat ulang data tersimpan hanya memperbarui tampilan aplikasi. Tekan Temukan tab untuk memeriksa Google Sheet; tab yang hilang akan dinonaktifkan dan dikeluarkan dari pilihan. Riwayat tetap tersimpan. Setelah tab dipulihkan dan discovery dijalankan, aktifkan kembali tab secara manual bila ingin memprosesnya.',
      'Pilih sumber dan tab, lalu konfirmasi klasifikasi MASTER atau NON_MASTER.',
      'Buat draft manual atau minta rekomendasi AI, kemudian buka halaman review konfigurasi.',
      'Approval awal sumber memeriksa daftar dan klasifikasi tab saat registrasi. Setelah sumber lolos pemeriksaan itu, pemilik mengelola konfigurasi dan deployment tanpa approval konfigurasi berulang pada owner workflow.',
      'Tabel hasil ETL memakai pencarian dan pagination seperti katalog. Data product/kode, semantic/versi, sumber/tab dan status/baris/waktu pemuatan digabung; buka Tabel database untuk melihat nama fisik lengkap. Ikon tindakan membuka Sheet, sumber dan revisi konfigurasi; Lihat detail menjelaskan blocker.',
      'Setelah konfigurasi owner-managed ACTIVE dan akses mengizinkan, pemilik dapat menjalankan Sync manual. Lihat detail berikon mata menampilkan alasan berhenti, baris asli Sheet dan kolom; Buka Google Sheet/Buka sumber memudahkan perbaikan.',
    ],
    notes: [
      'Kode sumber dan seluruh UUID dibuat atau dipilih otomatis oleh sistem.',
      'Dropdown unit, domain, dan yurisdiksi hanya memuat assignment aktif akun pendaftar. Membuat atribut di Administrasi belum otomatis menugaskannya ke pengguna.',
      'Jika pilihan kosong, minta admin lain memberikan assignment kepada akun Anda di Administrasi → Pengguna, lalu tekan Muat ulang pilihan. Admin tidak dapat memberikan assignment untuk akunnya sendiri.',
      'Jika sumber lama tidak muncul pada pilihan, buka menu Sumber & tracking, cari sumber, lalu pilih Buka sumber. Pilihan Workspace hanya memuat sebagian daftar.',
      'Jika sumber sudah terdaftar tetapi discovery/profiling gagal, jangan daftarkan Sheet yang sama lagi. Buka monitor job dan perbaiki tahap yang gagal.',
      'Untuk duplikat, admin memilih sumber utama, mengisi alasan, lalu menjalankan Unlink dengan dua konfirmasi. Riwayat tetap tersimpan dan admin dapat memulihkan entri dengan dua konfirmasi. Unlink ditolak bila masih ada konfigurasi, data turunan, dependensi, atau job aktif.',
      'Adapter Google Sheets hanya membaca. Header baru/rename harus diprofilkan ulang; source_column harus persis header profil terbaru. Profil drift membuat konfigurasi lama stale.',
      'Konfigurasi approved, active, atau rejected immutable: Clone untuk perbaikan menjadi draft baru. Jika clone gagal karena header lama sudah dihapus/rename, buat draft manual/AI baru dari profil terbaru.',
      'Kolom baru start_date/end_date: profiling ulang, map target date, lalu tambahkan parse_date_id dan pilih Format nilai tanggal = Serial Google Sheets pada Cleansing jika nilai berupa angka serial Sheets. Pola tanggal boleh kosong untuk serial; tipe date saja tidak mengubah angka menjadi tanggal.',
      'Jaga nama tabel tujuan bila ini revisi dataset yang sama. Mengganti nama tabel tidak menghindari migrasi view semantic. Cocokkan versi/ID konfigurasi dengan payload job DEPLOY, bukan URL draft lama; baca /guide#review-ulang-tanggal.',
      'Range, baris header/awal data, dan enabled tab dengan konfigurasi aktif terkunci (CONFIGURATION_CONFLICT). Jangan mencoba melewati penguncian; perubahan memerlukan penanganan lifecycle/migrasi yang direview.',
      'Sync manual membaca/profiling sebelum validasi dan pemuatan; bukan cara memperbaiki mapping lama. NEEDS_INPUT berarti Menunggu tindakan, bukan proses aktif. Master/jadwal/batch biasa tetap preview/approval/Apply.',
    ],
    examples: [
      { label: 'Nama sumber', value: 'Penjualan Cabang Jawa Timur' },
      {
        label: 'Deskripsi',
        value: 'Transaksi penjualan harian per cabang untuk analisis bulanan.',
      },
      {
        label: 'Unit · domain · yurisdiksi',
        value: 'Departemen Keuangan · Penjualan · Jawa Timur',
      },
      {
        label: 'Purpose · sensitivitas',
        value: 'Analitik Manajemen · LOW bila sesuai klasifikasi data',
      },
    ],
  },
  {
    matches: exact('/data-catalog'),
    title: 'Katalog tabel hasil ETL',
    purpose:
      'Melihat semua Data Product aktif yang dapat diakses, asal spreadsheet/tab, metadata semantic, dan peluang perbaikan untuk analitik/NL2SQL.',
    steps: [
      'Cari berdasarkan nama atau kode data product, nama sumber, tab, nama tabel, kolom, dimensi, atau metrik.',
      'Klik ikon mata pada Data product untuk melihat sumber/tab, tabel database, view semantic dan deskripsi di modal. Buka Google Sheet dari kolom Tindakan untuk memeriksa data asal.',
      'Semantic dan versi ETL ditampilkan dalam satu kolom. Status pembaruan, profil terakhir, waktu konfigurasi aktif dan data dimuat juga digabung agar Peluang peningkatan lebih luas.',
      'Gunakan peluang peningkatan sebagai checklist: deskripsi dataset, nama bisnis kolom, dimensi, metrik, deskripsi metrik, sinonim, dan relasi antardataset bila dibutuhkan.',
      'Ubah data/header di Google Sheet dan Profiling ulang sumber yang sama. Untuk mapping, dimensi, dan definisi metrik, clone konfigurasi immutable atau buat draft baru bila header lama hilang, lalu review. Nama/deskripsi produk serta unit/sinonim metrik dapat diedit admin/steward di katalog Dashboard; Governance mengelola relationship dan policy AI.',
    ],
    notes: [
      'Saran metadata bersifat pemeriksaan kelengkapan, bukan AI yang mengubah konfigurasi secara otomatis.',
      'Relasi join bersifat opsional; buat hanya jika ada kebutuhan analitik lintas dataset dan kolom kunci serta kardinalitasnya sudah dipastikan.',
      'Katalog hanya menampilkan Data Product aktif yang memang dapat ditemukan oleh akun Anda.',
      'Perubahan target NON_MASTER ditampilkan pada Preview perubahan schema. Pemilik memeriksa rencana sebelum validasi dan deploy; worker hanya menjalankan perubahan yang aman. Rename/drop fisik, key dan dependency tidak aman tetap diblokir.',
    ],
  },
  {
    matches: pattern(/^\/configurations\/[^/]+\/review$/),
    title: 'Verifikasi konfigurasi ETL',
    purpose:
      'Memeriksa mapping kolom, pembersihan data, kualitas, tabel tujuan, dan kesiapan deploy.',
    steps: [
      'Periksa identitas sumber dan fingerprint profil yang menjadi dasar draft.',
      'Gunakan nama file dan tab mengisi saran identitas tanpa menyimpan/menimpa otomatis. Nama bisnis mempertahankan tanda baca valid (200 karakter); kode diawali huruf, memakai ASCII/angka/underscore (63 karakter). Profiling ulang menangkap nama file asli; profil lama memakai nama sumber.',
      'Tinjau setiap mapping kolom, tipe target, transformasi, dan klasifikasi sensitivitas.',
      'Lengkapi aturan kualitas, business key, strategi load, metrik, dan visualisasi.',
      'Jalankan validasi dan perbaiki blocker yang ditampilkan. Pada konfigurasi owner-managed, checklist persetujuan tidak diperlukan.',
      'Setelah validasi siap, pemilik menekan Deploy. Approval konfigurasi dan approval tayang rutin tidak diperlukan pada workflow owner-managed.',
      'Setelah deploy berhasil, jalankan Sync data dan periksa status serta jumlah baris yang dimuat.',
      'Konfigurasi lama mungkin masih meminta checklist dan reviewer; ikuti status pada halaman tersebut.',
    ],
    notes: [
      'Gunakan ikon bantuan di samping setiap tahap wizard untuk melihat tujuan, urutan kerja, dan contoh khusus tahap tersebut.',
      'Perubahan yang belum disimpan dapat hilang saat meninggalkan halaman.',
      'Approval awal registrasi sumber/tab berbeda dari approval konfigurasi legacy. Perubahan sumber atau snapshot dapat membuat profiling dan bukti validasi perlu diperbarui.',
      'source_column harus persis header profil. Tambah/rename header di Google Sheet lalu Profiling ulang sumber yang sama; Muat ulang review tidak menggantikan profiling.',
      'Approved, active, dan rejected tidak dapat diedit; clone ke draft baru. Jika header lama sudah hilang dan clone gagal, buat draft baru dari profil terbaru.',
      'Preview perubahan schema menampilkan kolom/tipe/nullability/key lama dan baru, dampak view/dependency, operasi, validasi dan blocker. Konfirmasi preview sebelum validasi/deploy; backend mengikat pemeriksaan pada fingerprint schema/data. Worker mendukung nullable baru (record lama null), tipe pada tabel kosong, dan bigint serial menjadi date dengan parse_date_id serta Format nilai tanggal = Serial Google Sheets pada kondisi aman. Tidak menghapus record atau memakai DROP CASCADE.',
      'Text/varchar mendapat trim otomatis sebelum DQ/AI/load. Spasi tepi dibuang; spasi tengah dan nol depan tetap. Spasi saja menjadi NULL jika boleh kosong, kolom wajib tetap error.',
      'Untuk start_date/end_date, target date tetap membutuhkan parse_date_id pada Cleansing bila sumber adalah angka serial Sheets, misalnya 46023 menjadi 2026-01-01. Pola tanggal kosong untuk serial; text tanggal memakai pola strptime sesuai sumber. TYPE_OR_NULL_ERROR: periksa kolom dan baris asli, jangan menghapus data atau menandai nullable untuk menutupi format salah.',
      'SCHEMA_MIGRATION_STALE: muat preview baru pada draft dan validasi ulang; SCHEMA_REVIEW_REQUIRED: selesaikan bukti schema yang diminta; SCHEMA_MIGRATION_BLOCKED: selesaikan blocker. Nama view mengikuti ID tab, bukan nama tabel; perpindahan/proyeksi juga direview. Cocokkan configuration_id job DEPLOY dengan revisi yang divalidasi; /guide#review-ulang-tanggal.',
      'Kegagalan dalam transaksi migrasi membatalkan DDL/konversi. Aktivasi, audit sukses dan status job ikut transaksi DDL; gagal sebelum commit mempertahankan kondisi sebelumnya. Audit gagal tersedia setelah rollback; retry memeriksa fingerprint review.',
      'Transaksi memakai tanggal kejadian nyata; agregat w1/w2/januari perlu tahun dan batas periode yang disepakati. Validasi memeriksa data dan konfigurasi; preview schema tetap perlu diperiksa sebelum deploy.',
    ],
  },
  {
    matches: exact('/masters'),
    title: 'Registry master',
    purpose:
      'Mencari, membuat, dan mengelola definisi data master yang menjadi rujukan dataset lain.',
    steps: [
      'Cari master berdasarkan kode, nama, atau alias.',
      'Buka master untuk meninjau schema dan policy, atau pilih Buat master baru.',
      'Gunakan dependency plan untuk melihat urutan pemuatan dan kemungkinan siklus.',
      'Buka Storage setelah definisi approved untuk menyiapkan tabel dan meninjau record.',
    ],
  },
  {
    matches: exact('/masters/new'),
    title: 'Definisi master baru',
    purpose:
      'Mendefinisikan schema, business key, label, sensitivitas, dan policy lifecycle sebuah master.',
    steps: [
      'Isi kode bisnis, nama, deskripsi, field, dan tipe data.',
      'Pilih business key yang tidak boleh kosong serta field label.',
      'Atur policy record baru, konflik sumber, dan masa berlaku bila diperlukan.',
      'Preview kandidat master serupa, tinjau semuanya, lalu simpan dan ajukan review.',
    ],
    examples: [
      { label: 'Kode · nama master', value: 'cabang · Master Cabang' },
      { label: 'Business key', value: 'kode_cabang (teks, wajib)' },
      { label: 'Field label', value: 'nama_cabang (teks)' },
    ],
  },
  {
    matches: pattern(/^\/masters\/[^/]+\/storage$/),
    title: 'Storage dan record master',
    purpose: 'Menyiapkan tabel fisik master serta mencari record yang telah dimuat.',
    steps: [
      'Tinjau storage plan dan DDL yang akan diterapkan.',
      'Reviewer mengonfirmasi dan menjalankan deploy storage.',
      'Cari record menggunakan nilai bisnis atau filter periode.',
      'Pada Sumber master terikat, pastikan tab Siap diimpor lalu tekan Buat batch review/import dengan akun editor.',
      'Selesaikan temuan batch, Preview, approval reviewer berbeda, lalu Apply. Periksa hasil di Record kanonis; binding approved belum memuat record.',
    ],
    notes: [
      'Field nullable baru dapat ditambahkan melalui approval definisi lalu redeploy storage; record lama bernilai null. Tinjau dan approve ulang binding sebelum import.',
      'Jika storage sudah ada atau pernah dideploy, field wajib baru, business key, tipe, rename/drop, atau perubahan nullability memerlukan migrasi yang direview (MASTER_SCHEMA_MIGRATION_REQUIRED); jangan hapus/buat ulang tabel. Sebelum storage pertama, koreksi definisi dapat direview dan disetujui reviewer berbeda.',
    ],
  },
  {
    matches: pattern(/^\/masters\/[^/]+$/),
    title: 'Review definisi master',
    purpose: 'Memeriksa dan merevisi definisi master sebelum digunakan sebagai rujukan.',
    steps: [
      'Tinjau field, business key, label, sensitivitas, dan policy.',
      'Preview kandidat serupa setiap kali definisi berubah.',
      'Simpan draft, submit review, lalu lakukan approve atau reject dengan catatan.',
      'Setelah approved, lanjutkan ke Storage dan binding sumber.',
    ],
    notes: [
      'Untuk field nullable baru: revisi dan approve definisi, redeploy storage, lalu review binding. Record lama tetap null sampai pemuatan yang disetujui.',
      'Jika storage sudah ada atau pernah dideploy, field wajib baru, key, tipe, rename/drop, dan perubahan nullability perlu migrasi yang direview. Jika storage belum dibuat dan belum pernah dideploy, koreksi definisi dapat diajukan dan disetujui reviewer berbeda; binding lama perlu review ulang.',
    ],
  },
  {
    matches: pattern(/^\/sources\/[^/]+\/sheets\/[^/]+\/master-binding$/),
    title: 'Binding sumber ke master',
    purpose: 'Memetakan kolom tab sumber ke field master approved.',
    steps: [
      'Pastikan tab MASTER terkonfirmasi, profil terbaru tersedia, definisi master aktif/tervalidasi dan storage siap. Ikuti panduan khusus di /guide#binding-master.',
      'Pilih Master tujuan pada versi approved terbaru; petakan field wajib, business key dan label ke header sumber yang benar.',
      'Tinjau transformasi dan tipe, lalu tekan Simpan binding & dry-run. Owner workflow mengesahkan binding lewat validasi; workflow legacy menyimpan DRAFT.',
      'Periksa hasil dry-run dan kesiapan storage. Jika snapshot, tipe, field wajib, atau business key tidak cocok, binding tetap tertahan dan tidak dapat diimpor.',
      'Saat binding dan storage siap, buka Storage & record master → Sumber master terikat → Buat batch review/import. Pemilik Apply setelah preview valid pada owner workflow; legacy mengikuti review yang tampil.',
    ],
  },
  {
    matches: pattern(/^\/sources\/[^/]+\/sheets\/[^/]+\/column-bindings$/),
    title: 'Binding kolom referensi master',
    purpose:
      'Menghubungkan kolom dataset dinamis ke record master sebagai referensi yang tervalidasi.',
    steps: [
      'Tekan Muat rekomendasi untuk melihat kandidat hasil kemiripan nama header dengan field master aktif yang sudah approved.',
      'Periksa nama master, field, tipe, penanda business key, tingkat kecocokan, dan alasan kandidat. Gunakan kandidat sebagai awal pemetaan, bukan persetujuan otomatis.',
      'Pilih kolom sumber yang membawa kode rujukan dan field master yang menyimpan nilai yang sama. Utamakan field unik dan stabil, biasanya business key; UUID internal tidak perlu dimasukkan ke Sheet.',
      'Pilih cardinality dan centang Referensi wajib ada bila setiap baris harus memiliki rujukan.',
      'Simpan binding sebagai draft dan minta reviewer menyetujuinya.',
      'Buat batch import setelah binding approved. Nilai yang tidak ditemukan atau ambigu perlu diselesaikan pada review import.',
    ],
    notes: [
      'Skor hanya membandingkan nama setelah normalisasi ejaan umum dan padanan Indonesia/Inggris. Sistem tidak membaca nilai data untuk membuktikan hubungan; cocokkan contoh nilai sumber dengan record master.',
      'Satu binding mencari berdasarkan satu field master. Jika business key master gabungan, siapkan satu kode rujukan unik yang tersedia di sumber; field yang tidak unik dapat menghasilkan kecocokan ambigu.',
      'Untuk NON_MASTER, gunakan batch tab NON_MASTER dengan konfigurasi approved/active dan mapping referensi target UUID yang sesuai; binding kolom tidak mengubahnya menjadi tab MASTER. Memuat record rujukan baru ke master adalah batch terpisah pada tab MASTER.',
    ],
    examples: [
      { label: 'Kolom sumber', value: 'Kode Produk · SKU-001' },
      { label: 'Master tujuan', value: 'Master Produk · approved dan aktif' },
      { label: 'Field master', value: 'product_code · berisi SKU-001 dan nilainya unik' },
      { label: 'Cardinality', value: 'MANY_TO_ONE · banyak transaksi boleh merujuk satu produk' },
    ],
  },
  {
    matches: pattern(/^\/sources\/[^/]+\/sheets\/[^/]+\/taxonomy-bindings$/),
    title: 'Binding kolom taxonomy',
    purpose: 'Menghubungkan nilai sebuah kolom ke taxonomy approved agar kategori konsisten.',
    steps: [
      'Pilih taxonomy dan versi approved.',
      'Pilih kolom sumber dan tentukan apakah nilainya wajib.',
      'Simpan binding draft, lalu submit untuk approval.',
      'Nilai ambigu atau tidak dikenal akan ditanyakan pada review batch.',
    ],
    examples: [
      { label: 'Kolom sumber', value: 'Jenis Biaya' },
      { label: 'Taxonomy', value: 'jenis_biaya yang sudah approved' },
      { label: 'Nilai wajib', value: 'Centang bila hanya term taxonomy yang boleh dipakai.' },
    ],
  },
  {
    matches: exact('/taxonomies'),
    title: 'Registry taxonomy',
    purpose: 'Mengelola daftar kategori, sinonim, hierarki, versi, dan resolusi nilai.',
    steps: [
      'Buat taxonomy dengan kode bisnis dan nama yang jelas.',
      'Tambahkan term, label, alias, dan parent bila memiliki hierarki.',
      'Tinjau versi lalu approve agar taxonomy dapat dipakai binding.',
      'Gunakan resolver atau saran AI untuk menguji nilai sumber terhadap term.',
    ],
    examples: [
      { label: 'Kode · nama taxonomy', value: 'jenis_biaya · Jenis Biaya' },
      { label: 'Kode · label term', value: 'operasional · Biaya Operasional' },
      { label: 'Parent · alias', value: 'Root · OPEX dan biaya rutin (satu alias per baris)' },
      { label: 'Term kedua', value: 'investasi · Biaya Investasi · alias CAPEX' },
    ],
  },
  {
    matches: exact('/governance'),
    title: 'Semantic join dan kebijakan AI',
    purpose:
      'Mengelola relationship antarproduk data serta model, prompt, dan assignment AI yang diizinkan.',
    steps: [
      'Buat relationship hanya dari produk dan kolom yang memang memiliki hubungan bisnis.',
      'Validasi cardinality dan risiko agregasi, lalu submit untuk approval.',
      'Kelola policy AI sebagai draft, pilih model/prompt dari allowlist, lalu approve dengan reviewer berbeda.',
      'Gunakan assignment untuk mengikat policy ke NL2SQL, ETL configuration, atau rekomendasi taxonomy.',
    ],
  },
  {
    matches: exact('/import-reviews'),
    title: 'Review batch import',
    purpose: 'Membuat dan memantau batch yang akan memuat snapshot sumber ke target terpercaya.',
    steps: [
      'Cari sumber di tabel; status menunjukkan discovery, profiling, konfigurasi/binding, approval awal sumber, dan pemuatan. Approval IT pada tracking adalah pemeriksaan registrasi sumber/tab, bukan approval konfigurasi berulang.',
      'Pilih tab yang sudah diklasifikasikan. NON_MASTER memerlukan konfigurasi yang sesuai; MASTER memakai binding master bila jalur itu tersedia untuk tab tersebut.',
      'Gunakan batch untuk melihat snapshot, preview, atau menyelesaikan temuan/konflik yang memerlukan tindakan. Untuk NON_MASTER owner-managed yang sudah active, sync langsung dapat dilakukan dari Workspace/Sumber bila status mengizinkan.',
      'Buka detail batch untuk memeriksa blocker, dependency, pertanyaan, serta pesan kegagalan terakhir. Perbaiki sumber atau konfigurasi lalu buat batch baru jika snapshot lama sudah stale.',
      'Pada batch owner-managed, pemilik mengikuti aksi validasi dan apply yang ditampilkan; batch legacy mengikuti review/approval yang tercantum. Approval rutin konfigurasi dan release kedua tidak berlaku pada workflow owner-managed.',
      'Apply hanya setelah preview dan seluruh blocker sesuai. Memuat ulang halaman tidak menjalankan ulang batch.',
    ],
  },
  {
    matches: pattern(/^\/import-reviews\/[^/]+$/),
    title: 'Detail batch import',
    purpose:
      'Memeriksa temuan, referensi, pertanyaan, preview, dan pemuatan batch sesuai jalur owner-managed atau legacy.',
    steps: [
      'Periksa status batch, dependency, dan daftar temuan.',
      'NEEDS_INPUT berarti Menunggu tindakan. Modal Lihat detail pada tracking/audit menunjukkan baris asli Sheet termasuk header, kolom dan keterangan; nomor baris dapat bergeser jika Sheet diedit setelah snapshot.',
      'Jawab pertanyaan wajib atau resolve referensi menggunakan master approved.',
      'Gunakan resume/revalidate sesuai status dan blocker. Jika profil, konfigurasi, binding, atau versi master berubah, gunakan batch baru dengan dependency terbaru; revalidate tidak mengganti dependency batch lama.',
      'Buat preview dan periksa seluruh perubahan.',
      'Pada owner workflow, pemilik apply setelah preview valid dan blocker selesai. Jalur legacy masih dapat meminta reviewer; ikuti status dan tombol yang aktif pada batch.',
      'Temuan AI boleh Konfirmasi nilai asli sah dengan alasan wajib setelah verifikasi pemilik data, bukan bypass teknis/PII. Batch sync langsung siap dapat dilanjutkan dengan Sync manual kembali; jawaban saja belum memuat record.',
    ],
    notes: [
      'Jangan approve bila target, staging, atau dependency sudah berubah.',
      'SOURCE_CORRECTION pada review memperbaiki staging batch, bukan Google Sheet. Untuk perbaikan permanen, edit sumber lalu Profiling ulang dan buat batch baru.',
    ],
  },
  {
    matches: exact('/jobs'),
    title: 'Job dan riwayat ETL',
    purpose:
      'Memantau pekerjaan background, event progres, jadwal sumber, retry, pause, dan resume.',
    steps: [
      'Pilih Pantau pada job untuk melihat progres dan event terbaru.',
      'Gunakan retry hanya setelah penyebab kegagalan diperbaiki.',
      'Atur preset jadwal dan dependency upstream pada sumber yang dipilih.',
      'Pause jadwal saat sumber sedang diperbaiki, lalu resume setelah siap.',
    ],
  },
  {
    matches: exact('/quality'),
    title: 'Masalah dan karantina data',
    purpose:
      'Meninjau baris yang gagal aturan kualitas, mencatat resolusi, dan menjalankan pemrosesan ulang.',
    steps: [
      'Pilih sumber atau muat daftar masalah terbaru.',
      'Baca kode masalah dan konteks yang aman ditampilkan.',
      'Isi catatan resolusi sebelum menandai masalah selesai.',
      'Jalankan reprocess setelah data sumber atau konfigurasi diperbaiki.',
    ],
  },
  {
    matches: exact('/admin'),
    title: 'Administrasi tenant',
    purpose:
      'Mengelola atribut akses, assignment, permission bundle, policy, audit, dan penggunaan AI.',
    steps: [
      'Buat atribut organisasi seperti departemen, domain, yurisdiksi, clearance, dan purpose.',
      'Berikan assignment unit/departemen, domain bisnis, dan yurisdiksi wilayah kepada akun pendaftar yang sama, dengan masa berlaku yang tepat.',
      'Untuk akses lintas unit, pilih setiap unit yang diizinkan pada Akses multi-unit; unit induk tidak otomatis membuka bawahan.',
      'Pilih sumber dan tunjuk reviewer metadata, konfigurasi, serta batch import secara terpisah.',
      'Atur pemeriksa IT dan setiap unit yang harus menyetujui revisi sebelum data tayang; pilih akun berbeda untuk tiap kelompok.',
      'Buat policy resource sebagai draft, submit, lalu approve menggunakan admin yang berbeda.',
      'Gunakan Preview keputusan untuk menguji akses sebelum rollout.',
      'Tinjau audit dan penggunaan AI secara berkala.',
    ],
    examples: [
      { label: 'DEPARTMENT', value: 'keuangan · Departemen Keuangan' },
      { label: 'BUSINESS_DOMAIN', value: 'penjualan · Penjualan' },
      { label: 'JURISDICTION', value: 'jatim · Jawa Timur' },
      {
        label: 'PURPOSE · CLEARANCE',
        value: 'analitik_manajemen · Analitik Manajemen; internal · Internal',
      },
      {
        label: 'Akses multi-unit',
        value: 'Penjualan Malang dan Penjualan Surabaya dipilih untuk satu manajer.',
      },
      {
        label: 'Pendaftaran sumber',
        value:
          'Centang unit di Berikan unit; pilih domain dan yurisdiksi pada form Atribut untuk akun yang akan login.',
      },
      {
        label: 'Approver per sumber',
        value: 'Manajer A: metadata/konfigurasi; Manajer B: batch import.',
      },
      {
        label: 'Persetujuan tayang',
        value:
          'Sumber gabungan: IT, Penjualan Malang, dan Keuangan; satu akun berbeda per kelompok.',
      },
    ],
  },
  {
    matches: exact('/release-approvals'),
    title: 'Persetujuan sebelum tayang',
    purpose:
      'Mencatat pemeriksaan IT dan persetujuan unit terkait untuk revisi konfigurasi yang akan live.',
    steps: [
      'Halaman ini menangani konfigurasi legacy atau gate rilis lama yang masih muncul pada akun Anda. Workflow owner-managed yang sudah tervalidasi tidak memerlukan approval konfigurasi/rilis berulang.',
      'Jika ada baris, cari sumber, produk, revisi, dan kelompok reviewer lalu buka ringkasannya. Periksa apakah baris memang legacy dan masih berstatus menunggu pada revisi yang sama.',
      'Untuk item legacy yang ditugaskan, periksa konfigurasi, hasil validasi, sumber, dan checklist kelompok yang menjadi tanggung jawab Anda sebelum memberi keputusan.',
      'Jika tidak ada item, tidak perlu membuat approval di sini. Approval awal sumber/tab dilakukan pada proses registrasi sumber; sesudah itu pemilik melanjutkan ETL owner-managed melalui Workspace.',
      'Jika owner-managed masih tertahan oleh halaman ini, periksa status workflow konfigurasi serta pesan blocker. Jangan membuat keputusan release sebagai pengganti validasi, deploy, atau sinkronisasi pemilik.',
    ],
    examples: [
      {
        label: 'Lintas unit',
        value: 'Hanya konfigurasi legacy yang masih memerlukan keputusan kelompok IT/unit pada revisi yang sama.',
      },
    ],
    notes: [
      'Halaman ini kompatibilitas untuk gate konfigurasi/rilis legacy. Periksa petunjuk owner workflow pada Workspace sebelum meminta approver bertindak.',
      'Keputusan legacy tetap terikat revisi/snapshot; perubahan dapat membatalkan keputusan. Approval tidak memberi akses query data.',
      'Persetujuan tayang tidak memuat data. Deploy dan sync owner-managed dijalankan pemilik setelah pemeriksaan teknis lulus.',
    ],
  },
  {
    matches: exact('/admin/users'),
    title: 'Pengaturan akun dan role',
    purpose: 'Mencari pengguna, mengubah role/status, dan meninjau batasan baris akun.',
    steps: [
      'Cari dan pilih akun yang akan dikelola.',
      'Periksa role, status aktif, serta row scope.',
      'Simpan perubahan; token lama pengguna akan dicabut bila pengaturan keamanan berubah.',
      'Gunakan Registrasi pengguna untuk membuat akun baru.',
    ],
  },
  {
    matches: (path) => path === '/register' || path === '/admin/users/new',
    title: 'Registrasi pengguna',
    purpose: 'Membuat akun baru pada tenant aktif dan menetapkan role awalnya.',
    steps: [
      'Isi username/email, nama lengkap, dan password awal minimal 12 karakter.',
      'Pilih role awal sesuai tanggung jawab pengguna.',
      'Atur batasan baris bila akses perlu dibatasi.',
      'Daftarkan pengguna dan sampaikan kredensial awal melalui kanal yang aman.',
    ],
    notes: ['Pengguna baru tidak dapat memilih role sendiri.'],
  },
  {
    matches: exact('/account'),
    title: 'Akun saya',
    purpose: 'Melihat identitas sesi dan mengganti password akun sendiri.',
    steps: [
      'Masukkan password saat ini.',
      'Masukkan dan ulangi password baru minimal 12 karakter.',
      'Pilih Ubah password, lalu masuk kembali menggunakan password baru.',
    ],
    notes: ['Perubahan password mencabut seluruh token dan sesi akun.'],
  },
  {
    matches: exact('/access-requests'),
    title: 'Permintaan akses sementara',
    purpose:
      'Meminta, menyetujui, menolak, mencabut, dan meninjau akses yang memiliki masa berlaku.',
    steps: [
      'Pilih target akses, atribut atau permission, serta periode yang diperlukan.',
      'Jelaskan alasan bisnis dan kirim permintaan.',
      'Reviewer memeriksa scope dan masa berlaku sebelum approve atau reject.',
      'Pantau histori; batalkan permintaan yang tidak lagi diperlukan atau cabut akses aktif.',
    ],
    examples: [
      {
        label: 'Alasan bisnis',
        value: 'Memerlukan laporan penjualan Jawa Timur untuk evaluasi bulanan.',
      },
    ],
  },
  {
    matches: exact('/'),
    title: 'Beranda',
    purpose: 'Melihat ringkasan aktivitas dan membuka fungsi utama sesuai role akun.',
    steps: [
      'Gunakan menu operasional untuk berpindah ke Dashboard, Chat data, Workspace, atau halaman lain.',
      'Periksa ringkasan aktivitas dan status sistem yang tersedia.',
      'Mulai dari Dashboard bila tujuan Anda adalah mencari atau menganalisis data.',
    ],
  },
]

const fallback: PageHelpContent = {
  title: 'Bantuan halaman',
  purpose: 'Gunakan halaman ini sesuai akses dan proses kerja yang tersedia untuk akun Anda.',
  steps: [
    'Baca judul, penjelasan, dan pesan status pada bagian atas halaman.',
    'Lengkapi field wajib yang ditandai oleh browser.',
    'Tinjau hasil sebelum menjalankan tindakan approval, deploy, atau apply.',
    'Hubungi administrator atau data steward bila pilihan yang dibutuhkan tidak tersedia.',
  ],
}

export function getPageHelp(path: string): PageHelpContent {
  return entries.find((entry) => entry.matches(path)) || fallback
}
