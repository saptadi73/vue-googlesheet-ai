# Implementasi frontend — 8 September 2026

Implementasi mengacu pada `API_REFERENCE.md`, `PANDUAN_REVIEW_ETL.md`, dan kontrak backend lokal.
Snapshot `docs/api/SCHEMAS.md`, `PAYLOADS.json`, dan `openapi.json` sudah disertakan.
Klasifikasi tab BE02 serta registry dan binding master BE03 sudah tersedia; lihat
[implementasi BE02/BE03](FRONTEND_BE02_BE03.md). Eksekusi data master dan relasi FK otomatis
belum tersedia pada runtime backend saat ini.

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
- **Kualitas data:** resolve hanya menyimpan catatan; reprocess terpisah dan memakai Sheet terkini.
  Raw quarantine hanya pada admin/data steward. Daftar memakai pagination yang tersedia; tidak membuat total fiktif.
- **Query:** dimensi/metrik dari katalog, filter AND, tipe scalar/list/null, urutan field output, time grain,
  limit/offset. Nilai null ditampilkan sebagai — dan tidak diubah menjadi nol. CSV mengekspor halaman query
  yang ditampilkan; mengubah pilihan membatalkan tombol export sampai query dijalankan lagi.
- **Grafik:** bar chart dari hasil API, memilih dimensi/metrik, maksimal 50 baris yang sudah dimuat.
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

Unit test menguji race refresh, rotasi token, stale response saat akun berubah, kegagalan refresh,
non-retry mutation, dan error download JSON. Tes browser menggunakan Edge headless dan mock API untuk
query/grafik/role, klarifikasi, draft/revision/submission/approver berbeda, conflict, Excel preview/apply,
job gagal/retry, admin/row scope/resolve, dan draft manual. Tidak ada kredensial atau data aplikasi nyata
di fixture. Hasil mock tidak membuktikan kesiapan integrasi Google, OpenAI, database, worker, atau CORS produksi.

Backend perlu dijalankan di origin yang dikonfigurasi. Migration `9c32a61d740e` dari panduan review harus
diterapkan oleh proses rollout backend sebelum memakai review_state. Implementasi ini tidak menjalankan
migrasi atau mengubah backend/database. Frontend default memakai proxy Vite ke `127.0.0.1:8000`.
Untuk production ikuti reverse proxy/CORS pada README.
