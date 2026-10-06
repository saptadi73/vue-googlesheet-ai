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

Bagian Administrasi juga menjelaskan multi-unit eksplisit dan penunjukan approver per sumber.
User memilih nama unit dan reviewer dari daftar; UUID tetap dikelola sistem. Unit induk
tidak otomatis memberi akses ke bawahan, dan penunjukan reviewer tidak membuka data.

Halaman **Persetujuan tayang** menampilkan konfigurasi approved yang ditugaskan kepada
pengguna. IT dan setiap unit terkait mencatat keputusan serta alasan pada revisi yang
sama. Bantuan kontekstual menjelaskan bahwa keputusan bisnis memerlukan assignment
unit aktif, sedangkan status siap deploy baru muncul setelah seluruh kelompok setuju.
Pemeriksa IT wajib melengkapi checklist skema/mapping, kualitas data, dan keamanan/akses
sebelum menekan Setujui.

Jika deploy atau rollback tertahan, tanyakan status tiap kelompok di **Persetujuan tayang**.
Perubahan revisi konfigurasi, snapshot review, atau aturan rilis membuat keputusan lama
tidak berlaku. Penolakan memerlukan versi konfigurasi baru atau revisi aturan yang
diaudit. Persetujuan tayang berbeda dari review batch import dan tidak otomatis
memberikan akses membaca data.

