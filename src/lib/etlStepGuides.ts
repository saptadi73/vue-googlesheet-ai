export interface EtlStepGuide {
  title: string
  purpose: string
  instructions: string[]
  example: string
}

const guides: EtlStepGuide[] = [
  {
    title: '1. Identitas dataset',
    purpose: 'Jelaskan isi data dan arti satu baris agar sistem dan pengguna memahami tabel ini.',
    instructions: [
      'Isi nama, deskripsi singkat, dan arti satu baris (grain). Kode produk data boleh memakai saran otomatis.',
      'Contoh grain: satu baris per transaksi per produk.',
    ],
    example: 'Nama: Penjualan Cabang · Grain: satu baris per transaksi per produk.',
  },
  {
    title: '2. Kolom dan sensitivitas',
    purpose: 'Cocokkan kolom Sheet dengan nama dan tipe data yang mudah dipakai.',
    instructions: [
      'Periksa nama kolom dan tipe data. Petakan kolom yang berguna; hapus mapping yang memang tidak perlu.',
      'Tandai key hanya jika nilainya stabil dan unik. Key untuk UPSERT harus terisi pada setiap baris.',
      'Jika kolom merujuk data master, pilih master aktif dan field kode/nama untuk pencocokan. Isi Sheet tetap teks; identitas relasi disiapkan otomatis. Periksa hasil validasi untuk nilai yang tidak ditemukan atau ambigu.',
      'Untuk melepas relasi, klik Hapus relasi atau pilih Tidak berelasi dengan master. Simpan draft, validasi dan deploy; kode/nama sumber dan record master tetap tersedia.',
      'Atur sensitivitas sesuai isi kolom. Informasi pribadi atau rahasia tidak boleh dibuka untuk analitik umum.',
    ],
    example: 'Kode Produk → product_code (text, wajib); Harga → price (numeric).',
  },
  {
    title: '3. Cleansing',
    purpose: 'Rapikan nilai yang tidak konsisten sebelum data dimuat.',
    instructions: [
      'Tambahkan aturan hanya bila data sumber memang perlu dibersihkan; teks otomatis membuang spasi di awal dan akhir.',
      'Gunakan format tanggal atau angka yang sesuai dengan isi Sheet, lalu periksa hasil dry-run.',
      'Jika masalah berasal dari isi Sheet, perbaiki Sheet dan profiling ulang sebelum mengubah konfigurasi.',
    ],
    example: 'Kode dengan spasi tepi dapat dirapikan otomatis; nol di depan kode tetap dipertahankan.',
  },
  {
    title: '4. Kualitas data',
    purpose: 'Pilih pemeriksaan untuk nilai yang penting bagi bisnis.',
    instructions: [
      'Mulai dari pemeriksaan sederhana: kolom wajib, rentang angka, atau daftar nilai yang sah.',
      'Gunakan WARN untuk memberi catatan; REJECT_ROW atau STOP_BATCH hanya bila data yang salah tidak boleh dimuat.',
      'Tipe, kolom wajib, dan key tetap diperiksa otomatis.',
    ],
    example: 'Harga minimal 0; nilai kosong boleh diperingatkan atau ditolak sesuai kebutuhan.',
  },
  {
    title: '5. Pemuatan',
    purpose: 'Pilih cara data baru memperbarui tabel.',
    instructions: [
      'APPEND menambah baris, UPSERT memperbarui baris berdasarkan key, dan FULL_REFRESH mengganti seluruh isi tabel.',
      'Pilih FULL_REFRESH hanya jika Sheet berisi seluruh data yang harus ada di tabel. Sistem memvalidasi data sebelum mengganti isi lama.',
      'Jika preview schema menunjukkan perubahan, baca rencana dan blocker sebelum melanjutkan.',
    ],
    example: 'Daftar produk lengkap: FULL_REFRESH; transaksi baru harian: APPEND; koreksi transaksi dengan ID: UPSERT.',
  },
  {
    title: '6. Analitik dan akses',
    purpose: 'Pilih kolom yang membantu pencarian, pengelompokan, dan perhitungan.',
    instructions: [
      'Pilih dimensi untuk dikelompokkan dan metrik yang memiliki arti bisnis, seperti total penjualan.',
      'Akses baca/query default mengikuti domain dan unit bisnis yang sama. Batas yurisdiksi atau department khusus perlu policy yang sesuai.',
      'Role tetap harus memiliki kemampuan baca/query; akses ekspor dan penolakan policy tetap diperiksa terpisah.',
    ],
    example: 'Dimensi: bulan dan cabang; metrik: total penjualan dalam rupiah.',
  },
  {
    title: '7. Validasi dan langkah berikutnya',
    purpose: 'Pastikan konfigurasi cocok dengan sumber terbaru sebelum mengaktifkan tabel.',
    instructions: [
      'Jalankan validasi. Jika ada blocker, buka keterangannya dan perbaiki sumber atau mapping yang disebut.',
      'Jika sumber berubah, profiling ulang lalu validasi draft terhadap hasil terbaru.',
      'Ikuti tindakan yang ditampilkan aplikasi setelah validasi lulus.',
      'Setelah deploy berhasil, jalankan sync untuk memuat data. Periksa status job dan jumlah baris yang dimuat.',
    ],
    example: 'Validasi siap → Deploy → tunggu sukses → Sync data.',
  },
]

const ownerFinalGuide: EtlStepGuide = {
  ...guides[6]!,
  title: '7. Validasi dan deploy',
  instructions: [
    'Tekan Validasi & siapkan deploy. Sistem memeriksa sumber terbaru, mapping, kualitas data, akses, dan schema.',
    'Jika ada blocker, ikuti pesan yang tampil. Perbaiki sumber atau mapping lalu jalankan validasi lagi.',
    'Saat status siap, tekan Deploy. Tidak perlu mengajukan approval konfigurasi atau approval tayang rutin.',
    'Setelah deploy berhasil, jalankan Sync data dan periksa status serta jumlah baris yang dimuat.',
  ],
}

const legacyFinalGuide: EtlStepGuide = {
  ...guides[6]!,
  title: '7. Validasi dan review',
  instructions: [
    'Jalankan validasi dan perbaiki blocker yang ditampilkan.',
    'Periksa preview schema, lalu centang bagian dan mapping yang sudah Anda tinjau.',
    'Ajukan review. Approver lain perlu menyetujui konfigurasi sebelum deploy.',
    'Setelah deploy berhasil, jalankan Sync data dan periksa status serta jumlah baris yang dimuat.',
  ],
}

export function getEtlStepGuide(index: number, ownerManaged: boolean): EtlStepGuide | null {
  if (!Number.isInteger(index) || index < 0 || index >= guides.length) return null
  if (index === 6) return ownerManaged ? ownerFinalGuide : legacyFinalGuide
  return guides[index]!
}
