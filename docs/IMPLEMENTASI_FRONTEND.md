# Implementasi frontend — 26 September 2026

Implementasi mengacu pada `API_REFERENCE.md`, `PANDUAN_REVIEW_ETL.md`, dan kontrak backend lokal.
Snapshot `docs/api/SCHEMAS.md`, `PAYLOADS.json`, dan `openapi.json` sudah disertakan.
Klasifikasi tab BE02 serta registry dan binding master BE03 sudah tersedia; lihat
[implementasi BE02/BE03](FRONTEND_BE02_BE03.md). Storage dan pencarian record BE04 tersedia melalui `/masters/:id/storage`; lihat
[frontend BE04](FRONTEND_BE04.md). Import review, preview/approval/apply master,
resolver referensi, dependency plan, pemeriksaan orphan, dan deployment FK tersedia
melalui halaman batch, master, serta binding terkait.

Binding kolom referensi master tersedia dari Workspace ETL melalui tautan **Atur
referensi master**. Editor membuat draft per header sumber terhadap field master
approved; reviewer menyetujui atau menolak draft dengan revision terbaru.

Registry master menyediakan pemeriksaan read-only dependency dan orphan untuk binding
referensi yang telah approved. Hasil menampilkan target relasi, nilai orphan terbatas,
dan blocker runtime sebelum reviewer memutuskan deploy foreign key.

Reviewer dapat memasang foreign key setelah pemeriksaan orphan sukses dan tidak ada
siklus dependency. Konfirmasi eksplisit di UI diperlukan sebelum request deploy.

Workspace menyediakan batch sync review per sumber dan preview migrasi MASTER yang
read-only. Editor konfigurasi memuat katalog parameter BE12 dan hanya mengirim
parameter yang ditandai backend sebagai supported.

Halaman `/taxonomies` mengelola registry taxonomy BE13: editor dapat membuat draft
dan menambahkan term bertingkat, sedangkan reviewer dapat menyetujui taxonomy dan
menerbitkan versi baru. Resolver, validasi nilai, rekomendasi deterministic/AI,
mapping kolom, rule `in_taxonomy`, dan pertanyaan taxonomy pada batch sudah diekspos.

Binding taxonomy per kolom tersedia melalui Workspace ETL. Editor hanya dapat memilih
taxonomy yang aktif dan `APPROVED`, menyimpan draft dengan `revision_no` terbaru, lalu
reviewer menyetujui atau menolak draft tersebut.

Batch review import BE05 tersedia melalui `/import-reviews`; detail implementasi ada di
[frontend BE05](FRONTEND_BE05.md).
Pertanyaan terstruktur, koreksi staging, dan proposal master awal pada batch diimplementasikan
di endpoint/detail batch sesuai [frontend BE06](FRONTEND_BE06.md).
Preview/apply batch dari kontrak terbaru juga tersedia pada halaman detail batch:
frontend membuat preview revision terbaru, reviewer menyetujui, lalu editor menjalankan
apply dengan `preview_token` yang sama.

Detail batch menampilkan evidence BE10 dari checkpoint: coverage review AI, jumlah baris
direview, daftar field yang dimasking, dan metadata model/prompt tanpa menampilkan nilai PII.

Editor konfigurasi BE12 mendukung parameter transform statis `prefix`, `suffix`, dan
`replace`. Parameter terikat operasi, maksimal 500 karakter, hanya untuk target text/varchar,
dan ikut payload konfigurasi serta round-trip workbook backend. Expression bebas tetap ditolak.

Halaman `/governance` mengelola registry join relationship BE14 dan AI task policy BE15.
Join relationship mendukung create/edit/approve/reject, revision, product/column,
cardinality, join type, dan duplicate policy. Dashboard dapat memilih relationship
APPROVED, dimensi/metrik produk sekunder qualified, lalu mengirim path structured query.
AI policy mendukung create/edit DRAFT/approve/reject untuk purpose, prompt terdaftar,
model aktif, allowlist dan fallback model, batas konteks, budget harian policy,
optimistic revision, serta scope DataProduct untuk NL2SQL.
API key tetap berasal dari environment dan tidak pernah dikirim atau ditampilkan frontend.

## Perilaku penting

- **Sesi:** login JSON lalu `/auth/me`; access/refresh token dalam memori. Request 401 berbagi satu
  refresh, memakai kedua token baru, dan diulang satu kali. 403/422/429, timeout mutation, dan
  kegagalan query AI tidak otomatis diulang. Akun berubah membatalkan pemakaian respons sesi sebelumnya.
- **Role:** menu dan request awal memakai kelompok hak S/E/R/D/A dari reference. Halaman yang tidak
  diizinkan menampilkan pesan akses ditolak. Backend tetap sumber otorisasi, termasuk product allowlist.
- **Sumber:** kode lowercase, deskripsi, credential reference, cron UTC, pengaturan tab dan profil sesuai
  `source_sheet_id`. Perubahan tab mengharuskan profiling ulang. Konfigurasi aktif mengunci tab.
- **Draft manual:** mapping dibuat dari header profil dengan tipe awal text. PII terindikasi dimulai HIGH;
  pengguna memeriksa mapping/tipe/sensitivitas/key di wizard. APPEND/FULL_REFRESH tersedia sebagai
  strategi awal; UPSERT dipilih di wizard setelah key ditentukan. Pembuatan draft tidak memuat data.
- **Review:** PATCH konfigurasi utuh memakai revision; pertanyaan yang diselesaikan mengirim teks jawaban
  dengan key pertanyaan asli. Checklist direset saat draft berubah. Submission mengirim snapshot hash,
  seluruh bagian dan nama kolom target. Approver memakai revision terbaru, berbeda dari editor terakhir.
  Conflict mempertahankan edit lokal dan memberi arahan reload. Pindah halaman/reload memperingatkan
  bila draft belum disimpan.
- **Workbook:** export berautentikasi; preview base64 dengan batas ukuran; apply mengirim kandidat dan
  token persis dari preview. Preview tidak menyimpan atau menyetujui. Error unduhan Blob JSON ditampilkan.
- **Versi:** perbandingan hanya versi dari tab yang sama, ekspor JSON/YAML/XLSX, daftar artifact.
  Rollback hanya SUPERSEDED, memakai job; tidak memulihkan data historis.
- **Monitoring:** jeda polling setelah respons, berhenti saat terminal/unmount/logout, batas dua menit,
  route menyimpan job ID untuk melanjutkan. Berhenti memantau bukan cancel job. FAILED dari HTTP 200
  ditampilkan sebagai kegagalan job; hasil per tab tetap terlihat. Retry eksplisit dan disesuaikan role jenis job.
  Editor jadwal source mendukung cron, timezone IANA, optimistic revision, serta policy antre/lewati saat job aktif.
  Workspace menyediakan editor incremental watermark per tab dari kolom profil dan menampilkan nilai terakhir.
  Jobs menampilkan statistik status serta inbox persisten untuk NEEDS_INPUT/FAILED. Acknowledge
  teraudit menghapus item dari inbox aktif tanpa mengubah status atau me-retry resource.
- **Kualitas data:** resolve hanya menyimpan catatan; reprocess terpisah dan memakai Sheet terkini.
  Raw quarantine hanya pada admin/data steward. Daftar memakai pagination yang tersedia; tidak membuat total fiktif.
- **Query:** dimensi/metrik dari katalog, filter AND, tipe scalar/list/null, urutan field output, time grain,
  limit/offset. Nilai null ditampilkan sebagai — dan tidak diubah menjadi nol. CSV mengekspor halaman query
  yang ditampilkan; mengubah pilihan membatalkan tombol export sampai query dijalankan lagi. Relationship
  APPROVED dapat dipilih dari produk utama; field produk sekunder memakai `PRODUCT.field`.
- **Grafik:** renderer tervalidasi untuk table, KPI, bar, line, area, pie/donut, combo,
  scatter, dan heatmap pada Dashboard/Chat. Override manual tidak mengubah SQL/cache dan
  renderer membatasi data yang digambar.
- **Template:** create DRAFT, validate, activate, run ACTIVE, edit allowlist/status produk. Produk SUSPENDED
  hilang dari katalog aktif sesuai kontrak. Tidak ada edit/delete template yang tidak didukung API.
- **Chat:** timeout 90 detik. `meta.clarification_required` ditangani sebelum empty state. Klarifikasi
  mengirim QuestionRequest lengkap dan menyimpan percakapan lokal. Feedback, detail request milik pengguna,
  dan promosi memakai plan log yang identik; hasil promosi tetap DRAFT. Tidak membuat daftar riwayat server
  karena endpoint daftar NL2SQL tidak tersedia.
- **Admin:** buat user, update role/is_active/row_scope. Row scope diganti utuh dan harus diterapkan pada
  form sebelum simpan. Role/aktif diri sendiri dikunci. Summary AI tenant tanpa tanggal atau klaim lintas
  tenant; estimasi null tidak dianggap nol. Password change meminta login ulang.

## Menjalankan dan verifikasi

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
```

Unit test juga menguji klasifikasi, evidence review dan mapping master. Empat skenario browser BE02/BE03
melengkapi delapan skenario workflow sebelumnya.

Verifikasi frontend 27 September 2026: 54 unit test dan 62 skenario browser lulus.
Regresi terarah notifikasi operasional dan source schedule lulus. Regression BE12/BE14/BE15
mencakup transform parameter statis, lifecycle join relationship dan AI task policy tanpa API key.
Regression BE15 Governance juga memeriksa payload batas konteks, budget harian, dan
pergantian model utama/fallback saat edit. Regression BE14/workbook
mencakup metadata metrik, periode default, filter metrik, null handling, dan round-trip workbook pada
konfigurasi dengan lebih dari satu metrik. Regression join memeriksa relationship APPROVED, field qualified,
dan payload QueryPlan. Selector test menargetkan metrik yang diuji secara eksplisit;
ini tidak mengubah payload atau perilaku runtime.

Unit test menguji race refresh, rotasi token, stale response saat akun berubah, kegagalan refresh,
non-retry mutation, dan error download JSON. Tes browser menggunakan Edge headless dan mock API untuk
query/grafik/role, klarifikasi, draft/revision/submission/approver berbeda, conflict, Excel preview/apply,
job gagal/retry, admin/row scope/resolve, dan draft manual. Tidak ada kredensial atau data aplikasi nyata
di fixture. Hasil mock tidak membuktikan kesiapan integrasi Google, OpenAI, database, worker, atau CORS produksi.

Backend perlu dijalankan di origin yang dikonfigurasi. Migration `9c32a61d740e` dari panduan review harus
diterapkan oleh proses rollout backend sebelum memakai review_state. Implementasi ini tidak menjalankan
migrasi atau mengubah backend/database. Frontend default memakai proxy Vite ke `127.0.0.1:8000`.
Untuk production ikuti reverse proxy/CORS pada README.
