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
    ],
    notes: ['Hasil hanya memakai produk data dan field yang diizinkan untuk akun Anda.'],
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
  },
  {
    matches: exact('/workspace'),
    title: 'Workspace konfigurasi ETL',
    purpose:
      'Menghubungkan Google Sheet, membaca struktur tab, membuat konfigurasi ETL, dan mengelola metadata akses sumber.',
    steps: [
      'Hubungkan spreadsheet baru dengan nama, URL/ID, pemilik, domain, yurisdiksi, purpose, dan sensitivitas.',
      'Bagikan spreadsheet kepada service account backend sebagai Viewer sebelum profiling.',
      'Pilih sumber dan tab, lalu konfirmasi klasifikasi MASTER atau NON_MASTER.',
      'Buat draft manual atau minta rekomendasi AI, kemudian buka halaman review konfigurasi.',
    ],
    notes: ['Kode sumber dan seluruh UUID dibuat atau dipilih otomatis oleh sistem.'],
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
    matches: pattern(/^\/configurations\/[^/]+\/review$/),
    title: 'Verifikasi konfigurasi ETL',
    purpose:
      'Memeriksa mapping kolom, transformasi, aturan kualitas, target, semantic metadata, dan lifecycle approval konfigurasi.',
    steps: [
      'Periksa identitas sumber dan fingerprint profil yang menjadi dasar draft.',
      'Tinjau setiap mapping kolom, tipe target, transformasi, dan klasifikasi sensitivitas.',
      'Lengkapi aturan kualitas, business key, strategi load, metrik, dan visualisasi.',
      'Validasi konfigurasi, simpan revisi, lalu submit untuk reviewer.',
      'Reviewer menyetujui; bila gate rilis aktif, IT dan setiap unit terkait juga menyetujui revisi yang sama sebelum deploy.',
    ],
    notes: ['Perubahan yang belum disimpan dapat hilang saat meninggalkan halaman.'],
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
      'Gunakan Batch import untuk menambah atau memperbarui record; halaman ini tidak melewati proses approval.',
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
  },
  {
    matches: pattern(/^\/sources\/[^/]+\/sheets\/[^/]+\/master-binding$/),
    title: 'Binding sumber ke master',
    purpose: 'Memetakan kolom tab sumber ke field master approved.',
    steps: [
      'Pilih master tujuan yang sesuai dengan isi tab.',
      'Petakan setiap field wajib ke header sumber.',
      'Tinjau transformasi dan hasil validasi mapping.',
      'Simpan draft binding, lalu submit dan approve sebelum menjalankan import.',
    ],
  },
  {
    matches: pattern(/^\/sources\/[^/]+\/sheets\/[^/]+\/column-bindings$/),
    title: 'Binding kolom referensi master',
    purpose:
      'Menghubungkan kolom dataset dinamis ke record master sebagai referensi yang tervalidasi.',
    steps: [
      'Muat rekomendasi untuk melihat kandidat master dan field yang mirip.',
      'Pilih master, versi, field tujuan, cardinality, dan aturan wajib.',
      'Simpan binding sebagai draft dan minta reviewer menyetujuinya.',
      'Buat batch baru setelah binding berubah agar dependency tidak stale.',
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
      'Pilih sumber, tab, dan konfigurasi active/approved.',
      'Buat batch import dan tunggu proses staging serta pemeriksaan.',
      'Buka detail batch untuk menyelesaikan temuan dan pertanyaan.',
      'Jalankan preview, approval, lalu apply setelah seluruh blocker selesai.',
    ],
  },
  {
    matches: pattern(/^\/import-reviews\/[^/]+$/),
    title: 'Detail batch import',
    purpose:
      'Menyelesaikan temuan, referensi, pertanyaan, preview, approval, dan apply sebuah batch.',
    steps: [
      'Periksa status batch, dependency, dan daftar temuan.',
      'Jawab pertanyaan wajib atau resolve referensi menggunakan master approved.',
      'Resume atau revalidate bila dependency berubah.',
      'Buat preview dan periksa seluruh perubahan.',
      'Reviewer melakukan approval; editor menjalankan apply menggunakan preview yang sama.',
    ],
    notes: ['Jangan approve bila target, staging, atau dependency sudah berubah.'],
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
      'Berikan assignment serta permission bundle kepada pengguna dengan masa berlaku yang tepat.',
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
        label: 'Approver per sumber',
        value: 'Manajer A: metadata/konfigurasi; Manajer B: batch import.',
      },
      {
        label: 'Persetujuan tayang',
        value: 'Sumber gabungan: IT, Penjualan Malang, dan Keuangan; satu akun berbeda per kelompok.',
      },
    ],
  },
  {
    matches: exact('/release-approvals'),
    title: 'Persetujuan sebelum tayang',
    purpose: 'Mencatat pemeriksaan IT dan persetujuan unit terkait untuk revisi konfigurasi yang akan live.',
    steps: [
      'Buka konfigurasi approved yang masuk ke daftar Anda.',
      'Periksa nama produk, kolom, metrik, dan konteks sumber; pemeriksa IT juga meninjau hasil validasi konfigurasi.',
      'Pilih kelompok yang menjadi tanggung jawab Anda. Pemeriksa IT melengkapi checklist skema, kualitas, dan keamanan; isi catatan, lalu setujui atau tolak.',
      'Deploy atau rollback baru dapat dilakukan setelah IT dan setiap unit terkait berstatus approved pada revisi yang sama.',
    ],
    examples: [{ label: 'Lintas unit', value: 'IT, Penjualan Malang, dan Keuangan masing-masing menyetujui revisi yang sama.' }],
    notes: [
      'Assignment unit dan penunjukan nama approver keduanya diperlukan; approval tidak memberi akses query data.',
      'Jika revisi, snapshot review, atau aturan rilis berubah, keputusan lama tidak berlaku. Penolakan meminta versi baru atau peninjauan aturan oleh admin.',
      'Review batch import dilakukan terpisah setelah konfigurasi aktif.',
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
