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

Jika dropdown pendaftaran sumber kosong, bantuan Workspace menjelaskan bahwa
unit, domain bisnis, dan yurisdiksi harus menjadi assignment aktif akun pendaftar.
Membuat atribut di registry tidak otomatis memberi assignment; admin lain perlu
menugaskannya di Administrasi → Pengguna. Setelah itu tekan **Muat ulang pilihan**.
Pesan gagal memuat pilihan berarti request API bermasalah, bukan bukti assignment kosong.

Halaman **Sumber & tracking** menyediakan pencarian dan pagination atas daftar sumber lengkap,
status discovery/profiling/configuration atau binding master/pemuatan, serta Data Owner dan Data
Steward. Bantuan halaman ini mengarahkan pengguna untuk membuka sumber dari tabel. Jika sumber
tidak tampak pada dropdown Workspace, cari di halaman tersebut; jangan mendaftarkannya ulang.
Sumber dengan kegagalan tahap tetap tercatat. Admin dapat melakukan unlink duplikat dengan alasan
dan dua konfirmasi, atau menampilkan dan memulihkan sumber unlink dengan dua konfirmasi. Riwayat
tetap disimpan; status progres bukan bukti akses dan binding master belum membuktikan data dimuat.
Pada header tiap kolom tahap, ikon bantuan menampilkan petunjuk operasional. Ikon status pada
baris merangkum hasil dengan centang/silang/minus, dan ikon laporan membuka keterangan kegagalan
terakhir. Ikon laporan di kolom tindakan membuka audit trail bertanggal, nama pelaku, hasil job,
dan error. Satu ikon pada kolom identitas sumber membuka kode sumber dan ID Spreadsheet bersama;
kolom penanggung jawab membuka Data Owner, Data Steward, dan pendaftar bersama dalam satu modal.
Daftar tab juga dapat dibuka melalui ikon detail agar tabel mudah dipindai.
Riwayat merupakan catatan aktivitas append-only; status terbaru tetap ditampilkan pada daftar
tracking.

Halaman **Katalog data** di sidebar menampilkan Data Product aktif lintas sumber dengan pencarian
dan pagination. Setiap baris menghubungkan nama/deskripsi, tabel fisik, semantic view, versi ETL,
dimensi/metrik, serta Google Sheet dan tab asal. Gunakan rekomendasi kelengkapan sebagai checklist
untuk menemukan deskripsi, nama bisnis kolom, dimensi, definisi metrik, atau sinonim yang perlu
dilengkapi. Perbaiki nilai/header di Google Sheet; ubah mapping, tipe, transformasi, atau struktur
melalui revisi ETL; kelola deskripsi dan semantic melalui Governance. Buat relasi antardataset hanya
setelah kunci dan kardinalitas diverifikasi. Saran katalog tidak mengubah data secara otomatis.

Admin juga dapat memilih ikon **Hapus permanen** untuk membersihkan registrasi setup gagal.
Preview menunjukkan tab, hasil profiling, dan job terminal yang akan dihapus. Tindakan hanya
diizinkan jika sumber belum memiliki konfigurasi atau data operasional, binding, review import,
dependensi, policy terkait, atau job aktif. Admin mengetik kode sumber, mengisi alasan, lalu
melewati dua konfirmasi. Data yang dibersihkan tidak bisa dipulihkan; audit penghapusannya
tetap dicatat. Jika pemeriksaan menyebut blocker, jangan mencari cara memaksa hapus: selesaikan
relasinya atau gunakan unlink hanya untuk duplikat yang tepat.

