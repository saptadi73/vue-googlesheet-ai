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

Halaman **Batch import** memakai tabel pencarian sumber dan menampilkan status discovery,
profiling, konfigurasi/binding, approval IT, dan database sebelum sumber dipilih. Setelah memilih
sumber, pilih tab yang memang akan dimuat dan konfigurasi active/approved yang sesuai. Halaman
**Persetujuan tayang** menampilkan konfigurasi yang ditugaskan ke approver dalam tabel yang dapat
dicari menurut sumber, produk, status, revisi, dan kelompok approval; pilih baris untuk membuka
ringkasan keputusan. Keduanya memakai komponen reusable `PagedDataTable` untuk pencarian dan
pagination.

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
dilengkapi. Perbaiki nilai/header di Google Sheet lalu Profiling ulang pada sumber yang sama;
ubah mapping, tipe, transformasi, dimensi, atau definisi metrik melalui draft ETL.
Admin/steward dapat mengubah nama/deskripsi produk serta unit/sinonim metrik melalui
**Edit metadata bisnis produk** di katalog Dashboard. Governance mengelola relationship dan
policy AI, bukan editor dimensi/metrik. Buat relasi antardataset hanya
setelah kunci dan kardinalitas diverifikasi. Saran katalog tidak mengubah data secara otomatis.

Admin juga dapat memilih ikon **Hapus permanen** untuk membersihkan registrasi setup gagal.
Preview menunjukkan tab, hasil profiling, dan job terminal yang akan dihapus. Tindakan hanya
diizinkan jika sumber belum memiliki konfigurasi atau data operasional, binding, review import,
dependensi, policy terkait, atau job aktif. Admin mengetik kode sumber, mengisi alasan, lalu
melewati dua konfirmasi. Data yang dibersihkan tidak bisa dipulihkan; audit penghapusannya
tetap dicatat. Jika pemeriksaan menyebut blocker, jangan mencari cara memaksa hapus: selesaikan
relasinya atau gunakan unlink hanya untuk duplikat yang tepat.

## Perubahan sumber, konfigurasi, dan periode

Bantuan Workspace, review ETL, katalog, tahap tracking, dan panduan umum menjelaskan:

- Adapter hanya membaca Google Sheet. Edit nilai atau tambah/rename header di Sheet, kemudian
  **Profiling ulang** sumber/tab yang sama; jangan registrasi ulang. Muat ulang tampilan hanya
  membaca data tersimpan. Sumber unlink dipulihkan melalui **Pulihkan**, bukan pendaftaran baru.
- `source_column` harus persis header profil terbaru. Profil drift membuat konfigurasi lama
  stale. APPROVED/ACTIVE/REJECTED immutable: clone ke draft baru; jika clone gagal karena header
  lama hilang/rename, buat draft manual/AI baru dari profil terbaru.
- Target fisik NON_MASTER existing memakai `CREATE_ONLY_OR_IDENTICAL`. Tambah/rename kolom,
  perubahan tipe atau nullability ditolak `SCHEMA_CHANGE_UNSAFE`; perlu migrasi manual yang
  direview. Approval/deploy atau FULL_REFRESH tidak otomatis memigrasikan schema.
- PATCH range, header/awal data, dan enabled tab dengan konfigurasi aktif ditolak
  `CONFIGURATION_CONFLICT`; jangan mencoba melewati penguncian.
- Sync review memprofilkan sumber lalu membuat batch, bukan memperbaiki mapping stale.
  Batch import biasa memakai snapshot tersimpan. Dependency baru memerlukan batch baru;
  revalidate tidak mengganti dependency batch lama. Koreksi staging tidak menulis balik Sheet.
- Master mendukung field nullable baru melalui approval definisi, redeploy storage, dan review
  binding; record lama bernilai null. Field wajib baru, key, tipe, rename/drop, serta perubahan
  nullability memerlukan migrasi yang direview, bukan hapus/buat ulang tabel.

Transaksi memakai tanggal kejadian nyata. ISO atau tanggal eksplisit dengan format `date_parse`
terpilih dapat diterima setelah validasi snapshot; tidak wajib sel native date Sheets.
Agregat mingguan/bulanan tetap memiliki grain periode: sediakan batas awal/akhir, tahun eksplisit,
dan kalender minggu yang disepakati. `w1`, `w2`, atau `januari` saja tidak menentukan tanggal;
jangan mengarang tanggal transaksi atau mengklaim analisis overlap periode/expression bebas
sudah tersedia. Pertanyaan awal Tanya AI menyertakan dua topik perubahan kolom dan label periode;
jawaban AI tetap berasal dari knowledge base backend, bukan konten statis frontend.

### Review perubahan schema NON_MASTER

Langkah 7 menampilkan `deployment_plan.migration.comparison`: kolom lama/baru beserta tipe dan nullability, key sebelum/sesudah, target/proyeksi view dan dependency. Operasi, jumlah record lama, contoh konversi dan blocker tersedia sebelum submit/approval/deploy. Reviewer menyetujui schema dan mapping pada revisi serta fingerprint schema/data yang sama. Perubahan setelah review meminta review ulang (`SCHEMA_MIGRATION_STALE`).

Untuk `bigint menjadi date` pada tabel berisi data, pilih **Format nilai tanggal = Serial Google Sheets** (`date_input_format: "GOOGLE_SHEETS_SERIAL"`) bersama `parse_date_id`. Tipe bigint atau angka dalam rentang valid saja tidak membuktikan bahwa nilainya tanggal. Konfirmasi makna sumber melalui mapping; backend memeriksa seluruh nilai non-null dan menampilkan `validation.checked`, `convertible`, `invalid`, serta contoh. Nilai di luar rentang 1..2958465 menghentikan migrasi. Mode serial eksplisit menolak text, pecahan dan nilai non-finite; mode `TEXT` memakai pola strptime dan menolak angka. Default null mempertahankan parser konfigurasi lama, tetapi tidak mengizinkan migrasi berisiko tanpa deklarasi format. Workbook menyimpan pilihan ini di `02 Struktur Kolom`, kolom AD.

Worker mendukung kolom nullable baru dan perubahan tipe pada tabel kosong. View yang perlu dibuat ulang mempertahankan ACL/komentar; dependency yang tidak aman, rename/drop fisik, perubahan key dan backfill wajib diblokir. DDL, view, konversi, hash, aktivasi konfigurasi, audit sukses dan status job SUCCEEDED berada dalam satu transaksi. Kegagalan sebelum commit mempertahankan schema/data serta konfigurasi aktif sebelumnya. Audit kegagalan dan alasan UI dicatat setelah rollback; retry memeriksa fingerprint review kembali.

`DATABASE_RETRY_REQUIRED`: database sibuk/timeout/konflik; tunggu lalu retry. `DATABASE_PERMISSION_DENIED`: admin memeriksa role DDL, ownership dan izin SET ke role aplikasi. Catat ID job; jangan mengubah SQL atau menghapus data untuk melewati blocker. Migrasi platform saat rollout berbeda dari perubahan schema dataset melalui aplikasi.


### Tabel error response

Lihat [Error response: kemungkinan penyebab dan tindakan](ERROR_RESPONSES.md). Tabel mencakup error sumber, review/deploy schema, validasi/import, akses katalog serta layanan database/AI. Di aplikasi: **Bantuan > Tabel error response** atau **Panduan lengkap > Tabel error response**; gunakan pencarian kode. Alasan keputusan akses dan blocker batch dibedakan dari error HTTP.


### Format Google Sheet ideal untuk analitik dan action plan

Baca [Panduan lengkap format Google Sheet](PANDUAN_FORMAT_GOOGLE_SHEET.md): penamaan file/tab dan produk, header tabular, grain/key, master/taxonomy, tipe/satuan/presisi, waktu/periode wajib untuk data periodik, metrik, kualitas, provenance, action plan berbasis bukti dan contoh tabel. Di aplikasi buka **Bantuan > Format Google Sheet ideal** atau **Panduan lengkap > Format Google Sheet ideal**. Waktu kejadian/pengukuran, periode data dan waktu pengambilan dibedakan; tanggal sync bukan pengganti waktu bisnis. Definisi metrik dan tindakan tetap perlu review, bukan asumsi otomatis dari nama kolom.
