# Asisten AI pengguna

Komponen global `src/components/AiHelp.vue` tersedia setelah login pada semua halaman. Pertanyaan
dikirim bersama route aktif ke `POST /api/v1/help/ask`. UI menampilkan jawaban sebagai teks aman,
judul sumber knowledge base, saran pertanyaan lanjutan, loading, dan pesan pemulihan dari API.

Riwayat hanya berada di memori browser dan dibersihkan ketika sesi berakhir atau pengguna memilih
**Bersihkan**. Frontend tidak mengirim DOM halaman, token, role, tenant, maupun riwayat percakapan;
backend mengambil identitas dari bearer token dan menerapkan pembatasan artikel. Pengguna diingatkan
untuk tidak memasukkan password, token, API key, atau data pribadi.

Tombol **Bantuan** pada halaman Taxonomy, Administrasi, Workspace ETL, Master, binding taxonomy,
Dashboard, Chat data, dan Permintaan akses menampilkan bagian **Contoh pengisian**. Contoh fiktif
ini diambil dari `docs/CONTOH_ISIAN_APLIKASI.md` di repository backend dan disimpan sebagai konten
statis di `src/lib/pageHelp.ts` agar tetap tersedia tanpa panggilan AI. Asisten **Tanya AI** dapat
menjawab pertanyaan lebih bebas menggunakan artikel knowledge base yang sama.

