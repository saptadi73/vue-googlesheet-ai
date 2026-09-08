# Frontend BE02/BE03

Implementasi mengikuti API backend lokal dan snapshot dokumen di folder ini. Dokumen
backend mencatat tahapan implementasi backend; halaman ini menjelaskan cakupan Vue.

## Klasifikasi tab

- Workspace dan halaman review menyediakan pilihan eksplisit MASTER/NON_MASTER,
  status, revision, konfirmator, waktu konfirmasi dan alasan blokir.
- PUT memakai revision klasifikasi terkini, terpisah dari revision konfigurasi.
  Konflik meminta pengguna memuat ulang; tidak ada retry mutation otomatis.
- Submit dan approve mengikuti `ready_for_review`, bukan hanya `valid`.
  Deploy/rollback memerlukan evidence review yang cocok dengan kind dan revision
  klasifikasi. Perubahan klasifikasi mereset checklist; review stale perlu diulang.
- Run sumber, retry ETL dan reprocess memeriksa seluruh tab enabled sebelum POST.
  Tab belum dikonfirmasi dan MASTER yang runtime-nya belum tersedia memblokir run.
  Backend tetap melakukan pemeriksaan akhir.

## Registry master

`/masters` menampilkan registry dengan pencarian dan pagination. `/masters/new` serta
`/masters/:id` menyediakan field, business key, label, alias, policy import, authority
dan effective dating sesuai kontrak BE03. DatasetPolicy BE01 tidak dikirim sebagai
payload konfigurasi ETL.

Preview kandidat tidak menyimpan master. Setiap kandidat perlu ditinjau eksplisit
dengan alasan sebelum penyimpanan; perubahan payload membatalkan hasil preview.
Create, edit, submit, approve, reject dan deactivate memakai state/revision backend.
Approve memerlukan akun berbeda dari editor dan submitter. Working draft dan snapshot
approved ditampilkan terpisah; edit draft tidak menggantikan snapshot approved.

## Binding master

Tautan dari klasifikasi MASTER membuka
`/sources/:sourceId/sheets/:sheetId/master-binding`. Pilihan master harus aktif dan
memiliki versi approved. Target mapping berasal dari `approved_definition_json`,
bukan working draft. Header sumber berasal dari profil tab dan dipilih manual.
Tipe, nullability, PII dan business key mengikuti definisi approved; primary key
tidak dibuat oleh frontend. Transform dapat ditambah, dihapus dan diurutkan.

Save memakai revision binding (0 untuk binding pertama), versi master dan revision
klasifikasi. Halaman menampilkan hasil dry-run, error dan preview baris. Approver
harus berbeda dari editor; approval membutuhkan validasi dan evidence terkini.
Versi approved baru harus dipilih eksplisit untuk review ulang binding lama.

`metadata_ready` ditampilkan terpisah dari `execution_ready`. Binding approved belum
mengaktifkan load master: `MASTER_RUNTIME_PENDING` tetap memblokir eksekusi sampai
backend menyediakan runtime tahap berikutnya.

## Binding kolom referensi

Workspace ETL menyediakan tautan **Atur referensi master** untuk setiap tab yang
sudah diprofilkan. Halaman `/sources/:sourceId/sheets/:sheetId/column-bindings`
memuat binding yang ada dan membuat atau memperbarui satu binding per header sumber.
Editor memilih header hasil profil, master yang aktif dan APPROVED, field dari snapshot
approved, apakah referensi wajib, normalisasi `TRIM_CASEFOLD`, dan kardinalitas.

Penyimpanan memakai `revision_no` binding yang sedang diedit (atau 0 saat membuat).
Reviewer dapat menyetujui atau menolak draft; tombol approval dinonaktifkan untuk
pembuat binding yang sama. Konflik revisi dan field master yang sudah tidak valid
menampilkan arahan untuk memuat ulang. Binding referensi hanya metadata dan tidak
menulis data master atau sumber.

Registry master dapat memuat rencana dependency dari binding yang sudah APPROVED dan
pemeriksaan orphan. Tabel menampilkan target relasi, status setiap binding, alasan
blocker, serta nilai orphan terbatas dari backend. Pemeriksaan ini read-only;
`execution_ready=false` bukan kegagalan request.

## Verifikasi dan rollout

- 16 unit test: sesi/API, blocker klasifikasi, kecocokan evidence dan mapping master.
- 12 tes browser dengan mock API: delapan workflow sebelumnya dan empat skenario
  klasifikasi, evidence stale, review kandidat/lifecycle master, serta approval binding
  yang memakai snapshot approved meskipun working draft berbeda.
- Build production menjalankan Vue/TypeScript check dan Vite bundling.

Tes mock tidak membuktikan integrasi dengan backend hidup, database, worker, Google
atau OpenAI. Implementasi frontend ini tidak menjalankan migrasi dan tidak mengubah
data backend. Pastikan migrasi BE02/BE03 diterapkan melalui proses rollout backend.
Development menggunakan proxy Vite; production memerlukan reverse proxy atau origin
API/CORS yang sesuai, termasuk metode PUT.
