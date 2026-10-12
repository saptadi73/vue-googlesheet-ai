# Implementasi review konfigurasi ETL

Wizard Vue dan round-trip XLSX tersedia untuk parameter yang sudah didukung runtime ETL. AI menghasilkan draft; pengguna menyesuaikan konfigurasi, menjawab pertanyaan, memvalidasi, lalu mengajukan review. Approver berbeda menyetujui konfigurasi. Jika admin mengaktifkan aturan persetujuan tayang, pemeriksa IT dan satu approver dari setiap unit terkait juga harus menyetujui revisi yang sama sebelum deployment. Detail fitur master, taxonomy, dan import terbaru mengikuti [API Reference](API_REFERENCE.md) serta panduan masing-masing.

## Menjalankan

1. Jalankan migrasi pada database aplikasi yang dituju setelah meninjau konfigurasi koneksinya. Migrasi `b8r1e4o7v0x3` memerlukan PostgreSQL >=16 untuk role terpisah; admin memberi role runtime TO DDL dengan INHERIT FALSE, SET TRUE. Gunakan ALEMBIC_DATABASE_URL untuk koneksi admin tanpa mengganti DATABASE_URL operasional. Migrasi `9c32a61d740e` menambahkan kolom JSONB `review_state` pada `platform.configuration_version`, tanpa mengubah tabel data ETL. Migrasi ini sudah diuji pada database test terpisah; penerapan pada database aplikasi/production dilakukan saat rollout.

   ```powershell
   .\venv\Scripts\python.exe -m alembic upgrade head
   ```

2. Jalankan backend, Redis, dan worker sesuai [panduan implementasi](IMPLEMENTASI.md). Profiling, rekomendasi AI, deployment, dan sync berjalan sebagai job. Status QUEUED terus-menerus berarti worker perlu diperiksa. Validasi draft, export, dan import-preview dijalankan melalui API.
3. Di direktori frontend (`D:\projek\vue-googlesheet-ai` pada lingkungan ini), gunakan `npm.cmd run dev`. Pastikan `VITE_API_ORIGIN`, `VITE_API_BASE_PATH`, dan CORS backend sesuai. Buka aplikasi; seluruh route privat akan diarahkan ke `/login`.
4. Login dengan tenant dan akun aplikasi. Router membuka landing sesuai role atau tujuan internal yang diizinkan. Access token berada di memori; refresh token di `sessionStorage` memulihkan sesi saat reload tab yang sama. Logout, sesi dicabut, atau refresh gagal kembali ke `/login`.
5. Pilih sumber/tab, atau hubungkan Google Sheet baru yang sudah dibagikan ke service account. Jalankan rekomendasi AI setelah profiling selesai. Buka draft yang dihasilkan.
6. Periksa identitas, mapping kolom, cleansing berurutan, kualitas data, strategi pemuatan, dimensi, metrik, dan role akses. Simpan perubahan, periksa dry-run, isi checklist seluruh bagian/kolom, lalu **Ajukan review**.
7. Gunakan akun `TECHNICAL_APPROVER` atau admin berbeda untuk membuka konfigurasi yang sama, memeriksa hasil, dan menyetujui. Admin dapat membuat user melalui `/register` dan mengatur role/status melalui `/admin/users`.
8. Jika aturan siap tayang aktif pada sumber, akun IT dan approver bernama tiap unit membuka `/release-approvals`. IT melengkapi checklist skema/mapping, kualitas data, dan keamanan/akses. Semua kelompok menyetujui revisi konfigurasi serta snapshot review yang sama; statusnya tampil pada review konfigurasi.
9. Setelah status siap tayang, **Deploy konfigurasi**, tunggu job SUCCEEDED, lalu jalankan sinkronisasi dengan akun editor. Approval dan deployment tidak langsung memuat data. Penolakan memerlukan versi konfigurasi baru atau revisi aturan yang diaudit. Sumber tanpa aturan rilis tetap memakai review konfigurasi biasa; rollback versi lama juga diperiksa terhadap aturan rilis saat ini. Review batch import tetap terpisah.

Konfigurasi APPROVED/ACTIVE/REJECTED tidak dapat diedit langsung, termasuk versi lama tanpa bukti review. Bila perlu perbaikan, clone menjadi draft, validasi, submit, dan approve. Jika clone gagal karena header sumber lama sudah dihapus/rename, buat draft manual/AI baru dari profil terbaru. Runtime sync konfigurasi yang sudah ACTIVE tidak memerlukan checklist ulang untuk setiap sync. Rollback konfigurasi memeriksa snapshot yang disetujui; perubahan data dapat mengharuskan draft baru. Rollback bukan pemulihan data historis.

## Mengubah kolom Sheet dan schema existing

1. Edit nilai atau tambah/rename header langsung di Google Sheet; adapter hanya membaca.
   Buka sumber/tab yang sama dan pilih **Profiling ulang**. Jangan mendaftarkan ulang.
   Muat ulang data tersimpan/review hanya menyegarkan tampilan, bukan membaca ulang Sheet.
2. Gunakan `source_column` persis dari header profil terbaru. Profil drift membuat konfigurasi
   lama stale. Tinjau ulang mapping, binding master/taxonomy, tipe, nullability, key, DQ, dan
   semantic pada draft terbaru sebelum validasi terhadap snapshot.
3. Target NON_MASTER memakai preview schema pada **Validasi & persetujuan**. Periksa operasi,
   record lama, contoh tanggal dan blocker, lalu centang konfirmasi schema sebelum submit.
   Worker menjalankan perubahan aman saat deploy setelah approval fingerprint schema/data.
4. Range, header/awal data, dan enabled tab dengan konfigurasi aktif terkunci
   (`CONFIGURATION_CONFLICT`). Jangan mencoba melewati penguncian; perubahan perlu
   penanganan lifecycle/migrasi yang direview.
5. Sync review memprofilkan sumber lalu membuat batch; mapping stale tidak otomatis diperbaiki.
   Batch import biasa memakai snapshot tersimpan. Jika dependency profil/config/binding berubah,
   buat batch baru; revalidate tidak mengganti dependency batch lama. Koreksi staging pada
   pertanyaan batch tidak menulis balik ke Sheet.
6. Master mendukung field nullable baru melalui approval definisi, redeploy storage, dan review
   binding; record lama bernilai null. Field wajib baru, key, tipe, rename/drop, atau perubahan
   nullability memerlukan migrasi yang direview. Jangan menghapus dan membuat ulang tabel.

## Tanggal kejadian dan agregat periode

- Transaksi/kejadian memakai tanggal kejadian nyata. ISO atau tanggal eksplisit dengan format
  `parse_date_id` dan pola strptime sesuai sumber dapat diterima setelah validasi snapshot; tidak wajib sel native date Sheets.
- Agregat mingguan/bulanan tetap ber-grain periode. Sediakan batas awal/akhir, tahun eksplisit,
  dan kalender minggu yang disepakati. `w1`, `w2`, atau `januari` saja bukan tanggal lengkap.
  Jangan mengarang tanggal transaksi dari label; tanggal acuan periode harus dijelaskan sebagai acuan.
- Editor tidak menyediakan expression bebas atau analisis overlap periode untuk agregat.
  Siapkan nilai eksplisit di sumber dan gunakan transformasi/filter yang didukung. Validasi overlap
  effective dating master adalah fitur tersendiri, bukan dukungan query overlap agregat.

## Review ulang kolom start_date/end_date

1. Tambahkan tanggal lengkap di Sheet dan profiling ulang sumber/tab yang sama.
   Clone konfigurasi immutable jika header lama masih ada; jika tidak, buat draft
   dari profil terbaru. Draft manual tidak menyalin seluruh target/aturan versi lama.
2. Periksa target tabel dan grain. Untuk revisi dataset yang sama, pertahankan nama
   target lama kecuali perpindahan tabel memang direncanakan dan direview.
3. Map kedua kolom ke `date`. Angka serial Sheets memerlukan `parse_date_id` pada
   **Cleansing**: `46023` menjadi `2026-01-01`, `46053` menjadi `2026-01-31`.
   Pola tanggal boleh kosong untuk serial; text tanggal memakai pola strptime
   sesuai sumber. Mengganti tipe saja tidak mengubah angka menjadi tanggal.
4. Simpan draft, Dry-run ulang, baca kolom dan baris asli `TYPE_OR_NULL_ERROR`.
   Jangan nullable/hapus record untuk menutupi format salah. Lengkapi checklist,
   submit dan minta reviewer berbeda menyetujui snapshot/revisi yang sama.
5. Periksa Preview perubahan schema dan konfirmasi. Nullable baru didukung (record lama null);
   tipe boleh berubah pada tabel kosong. Pada tabel berisi data, bigint serial menjadi date
   didukung dengan parse_date_id, pilihan Format nilai tanggal = Serial Google Sheets dan seluruh nilai valid. View mengikuti ID tab; perpindahan
   target/proyeksi ikut direview. Worker menjaga ACL/data dan memperbarui hash tanpa CASCADE.
6. DDL, view, konversi, hash, aktivasi konfigurasi, audit sukses dan status job SUCCEEDED berada dalam satu transaksi. Kegagalan sebelum commit mempertahankan schema/data serta konfigurasi aktif sebelumnya. Audit kegagalan dan alasan UI dicatat setelah rollback; retry memeriksa fingerprint review kembali.
   Perubahan di luar aplikasi tetap meminta review ulang meskipun target sudah cocok.
   Rename/drop fisik, key,
   kolom wajib baru pada tabel berisi data/dependency tidak aman tetap diblokir.
   SCHEMA_MIGRATION_STALE meminta preview/review baru; SCHEMA_REVIEW_REQUIRED meminta
   clone/review versi lama tanpa bukti schema; SCHEMA_MIGRATION_BLOCKED meminta penyelesaian blocker.
   Cocokkan configuration_id job dengan versi APPROVED. Deploy sukses belum memuat data:
   lanjutkan sync sesuai gate. Job FAILED lama tetap riwayat. Master tetap alur storage terpisah.

API `submit-review` menerima `reviewed_schema_fingerprint` (64 karakter hex) dari
`validation.deployment_plan.migration.fingerprint`. Wajib bila operasi bukan sekadar
CREATE_TABLE. Bukti tersimpan pada `review_state.schema_migration`; preview ulang pada approval
dan deploy menolak schema/data berubah sejak review. Dry-run/approval tidak mengubah target.

Bantuan tersedia pada `/guide#review-ulang-tanggal`, helper Workspace/review,
serta ikon bantuan langkah Cleansing, Pemuatan, dan Validasi.

## Kontrak API review

Semua path relatif terhadap `/api/v1`. Respons JSON dibungkus `{status, data, meta, errors}` sebagaimana [API Reference](API_REFERENCE.md). Editor adalah PLATFORM_ADMIN, DATA_STEWARD, atau SOURCE_OWNER. Pembaca konfigurasi juga mencakup TECHNICAL_APPROVER.

`GET /configurations/{id}/review` mengembalikan:

```json
{
  "configuration": {
    "id": "UUID",
    "revision_no": 1,
    "status": "AI_DRAFT",
    "configuration_json": {},
    "review_state": {}
  },
  "source": { "id": "UUID", "name": "Penjualan" },
  "sheet": { "id": "UUID", "sheet_name": "Sales" },
  "profile": { "columns": [] },
  "validation": {
    "valid": true,
    "snapshot_id": "UUID",
    "snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "sample_rows_valid": 3,
    "sample_rows_invalid": 0,
    "row_previews": [
      { "source_row": 2, "before": { "ID": "001" }, "after": { "transaction_id": "001" } }
    ],
    "issues": [],
    "warnings": [],
    "unresolved_questions": [],
    "deployment_plan": {}
  },
  "capabilities": {
    "review_sections": ["identity", "columns", "cleansing", "quality", "load", "semantic"],
    "editable_template_tabs": [],
    "unsupported": [],
    "max_workbook_bytes": 2000000,
    "preview_expiry_minutes": 15
  }
}
```

Contoh record/kolom/plan/capabilities disingkat; struktur konfigurasi lengkap ada di [PAYLOADS.json](api/PAYLOADS.json). Jika dry-run melempar error domain, review tetap mengembalikan form dengan `validation: {valid:false, errors:[{code,message}]}` agar pengguna dapat memperbaikinya. Endpoint `/validate` sendiri tetap dapat mengembalikan HTTP 422/409. Preview menampilkan maksimal 10 baris valid dan 50 baris bermasalah, tanpa nilai mentah baris bermasalah. Nilai MEDIUM/HIGH atau kolom dengan indikasi PII dari profil disamarkan pada before/after. Validasi memeriksa seluruh snapshot tersimpan.

`PATCH /configurations/{id}` menerima objek konfigurasi lengkap, bukan patch per field:

```json
{
  "revision_no": 1,
  "configuration": { "...": "Gunakan objek ETLConfiguration lengkap" },
  "question_answers": { "Apakah ID unik?": "Ya, ID adalah nomor transaksi unik." }
}
```

Setiap pertanyaan yang dihapus dari `unresolved_questions` wajib mempunyai jawaban nonkosong maksimal 2.000 karakter. Key jawaban adalah teks pertanyaan persis, bukan ID baru. Sesuaikan parameter bisnis pada konfigurasi; jawaban teks tidak otomatis mengubah mapping. Jawaban disimpan di `review_state.answers` bersama user_id dan waktu. PATCH menaikkan revision dan membatalkan submission sebelumnya.

`POST /configurations/{id}/submit-review` kini **wajib mempunyai body**:

```json
{
  "revision_no": 2,
  "snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "reviewed_columns": ["transaction_id", "transaction_date", "branch_name", "net_amount"],
  "reviewed_sections": ["identity", "columns", "cleansing", "quality", "load", "semantic"]
}
```

Gunakan hash dari dry-run terbaru dan nama target seluruh kolom konfigurasi. Server memvalidasi ulang, memeriksa revisi/hash/checklist, menaikkan revision, serta menyimpan submitted_by/at, submitted_revision, snapshot_id/hash, dan checklist di `review_state`. Respons adalah Configuration terbaru. Approve memakai revision dari respons tersebut dan ditolak jika submission tidak tersedia atau snapshot berubah. Kontrol ini memastikan keterkaitan review; checklist tidak membuktikan kebenaran keputusan bisnis pengguna.

## Excel: export, preview, apply

1. Simpan draft lalu `POST /configurations/{id}/export` dengan `{"format":"XLSX"}`. Download artifact menggunakan endpoint download berautentikasi.
2. Workbook mempertahankan 14 tab template, menambah **14 Review** untuk identitas/jawaban dan tab metadata tersembunyi. Contoh data template dibersihkan. Sel kuning dapat diedit; sel referensi dan parameter yang belum didukung dilindungi. Jangan mengganti nama tab atau menambahkan kolom/tab. Penambahan/penghapusan mapping kolom dilakukan melalui form.
3. Isi input dengan nilai literal. Formula pada input, macro, dan external links ditolak. Gunakan enum API: misalnya `numeric`, bukan `numeric(18,2)`. Pengaturan type/null/key pada tab 02 menjadi sumber referensi tab 06.
4. Unggah file maksimal **2.000.000 byte** sebagai base64 JSON:

   ```json
   { "content_base64": "BASE64_DARI_BYTE_FILE_XLSX" }
   ```

   Kirim ke `POST /configurations/{id}/workbook-preview`. Ini hanya pemeriksaan, **tidak menyimpan konfigurasi dan tidak memberi approval**.

5. Respons sukses preview dalam `data`:

   ```json
   {
     "can_apply": true,
     "revision_no": 2,
     "configuration": { "...": "Konfigurasi lengkap hasil parsing" },
     "question_answers": {},
     "diff": { "dataset_business_name": { "before": "Sales", "after": "Penjualan" } },
     "validation": { "valid": true, "snapshot_hash": "HASH", "...": "Hasil dry-run lengkap" },
     "errors": [],
     "preview_token": "TOKEN_BERTANDA_TANGAN"
   }
   ```

   Kesalahan sel mengembalikan `can_apply:false`, `configuration:null`, `preview_token:null`, dan `errors:[{location,message}]`, misalnya `04 Taxonomy Mapping!C5`. Identitas/revision workbook tidak cocok memakai HTTP 409. `can_apply:true` berarti konfigurasi dapat disimpan sebagai draft; approval tetap mensyaratkan `validation.valid:true`. Pertanyaan atau baris REJECT_ROW yang tersisa dapat diperbaiki setelah draft disimpan; STOP_BATCH/REQUIRE_REVIEW yang menghentikan validasi membuat preview tidak dapat diterapkan.

6. Setelah pengguna menerima diff, kirim **persis** kandidat dari preview ke `POST /configurations/{id}/workbook-apply`:

   ```json
   {
     "revision_no": 2,
     "configuration": { "...": "Objek lengkap dari preview" },
     "question_answers": {},
     "preview_token": "TOKEN_DARI_PREVIEW"
   }
   ```

   Respons adalah Configuration draft revisi berikutnya. Token berlaku 15 menit, terikat pengguna/tenant, konfigurasi asal, revisi, snapshot, dan kandidat. Mengubah kandidat atau memakai ulang token setelah apply ditolak. Impor tidak menjalankan DDL, deploy, atau sync. Checklist harus diperiksa kembali setelah apply.

Identitas export berlaku 7 hari. Perubahan draft, isi snapshot, atau JWT secret membatalkan workbook/preview lama; unduh atau preview ulang. Ekspor dibatasi 100 kolom, 1.000 langkah cleansing, 100 aturan kualitas, 200 metrik, dan 100 pertanyaan. Sel di luar kapasitas, identitas referensi, dan parameter unsupported ditolak jika diubah; tidak diam-diam diabaikan. Array dimensi/role dan nilai aturan di Excel mengikuti JSON, sedangkan form menyediakan pilihan tanpa JSON.

Status `Tidak` pada cleansing atau `Nonaktif` pada aturan kualitas/metrik berarti menghapus aturan tersebut dari kandidat runtime. Baris nonaktif tidak disimpan sebagai arsip konfigurasi dan tidak muncul pada export berikutnya; periksa bagian diff sebelum menerima perubahan.

## Error yang perlu ditangani frontend

| Kode                                            | HTTP | Tindakan                                                              |
| ----------------------------------------------- | ---- | --------------------------------------------------------------------- |
| CONFIGURATION_CONFLICT / WORKBOOK_STALE         | 409  | Muat ulang draft; unduh workbook terbaru                              |
| WORKBOOK_PREVIEW_STALE / WORKBOOK_TOKEN_INVALID | 409  | Preview ulang dengan akun dan draft yang sama                         |
| REVIEW_REQUIRED                                 | 409  | Ajukan review revision terbaru                                        |
| REVIEW_STALE                                    | 409  | Profiling/validasi ulang; untuk approved, clone dan review draft baru |
| REVIEW_INCOMPLETE                               | 422  | Lengkapi checklist semua bagian dan kolom                             |
| QUESTION_ANSWER_REQUIRED / QUESTION_INVALID     | 422  | Cocokkan pertanyaan dan isi jawaban                                   |
| WORKBOOK_INVALID / WORKBOOK_STRUCTURE           | 422  | Gunakan XLSX export aplikasi yang utuh                                |
| SEPARATE_APPROVER_REQUIRED                      | 403  | Gunakan approver berbeda                                              |
| RELEASE_APPROVAL_REQUIRED                       | 409  | Periksa status IT dan setiap unit di Persetujuan tayang sebelum deploy/rollback |
| RELEASE_REJECTED                                | 409  | Buat versi konfigurasi baru atau minta admin meninjau aturan rilis |
| RELEASE_POLICY_STALE / RELEASE_CONFIGURATION_STALE | 409 | Muat ulang aturan/status dan gunakan revisi konfigurasi terbaru |

## Verifikasi pengembangan

- Unit test workbook: round-trip konfigurasi, identitas/revisi, sel unsupported, formula input, jawaban pertanyaan.
- Integration test pada database `_test`: preview tanpa mutasi, apply bertoken, perubahan kandidat/replay ditolak, isolasi tenant/role, gate submission, dan perubahan data sebelum deployment.
- Regression suite ETL: approve/deploy, sync/idempotency, rollback, permission, query tetap diuji.
- Frontend: `npm run build` menjalankan TypeScript dan build Vite. OpenAI dan Google pada integration test memakai mock; konfigurasi/integrasi akun nyata tetap harus diuji pada lingkungan tujuan.
- Hasil verifikasi implementasi: 63 pengujian backend lulus. Smoke test Edge headless dengan API mock juga lulus untuk login, edit/simpan draft, checklist, submit, dan approval akun berbeda tanpa exception JavaScript. Pengujian browser ini tidak mengakses data aplikasi nyata.
- `scripts/export_api_reference.py --check` memeriksa 89 operasi serta seluruh contoh payload terhadap schema runtime.

### Review perubahan schema NON_MASTER

Langkah 7 menampilkan `deployment_plan.migration.comparison`: kolom lama/baru beserta tipe dan nullability, key sebelum/sesudah, target/proyeksi view dan dependency. Operasi, jumlah record lama, contoh konversi dan blocker tersedia sebelum submit/approval/deploy. Reviewer menyetujui schema dan mapping pada revisi serta fingerprint schema/data yang sama. Perubahan setelah review meminta review ulang (`SCHEMA_MIGRATION_STALE`).

Untuk `bigint menjadi date` pada tabel berisi data, pilih **Format nilai tanggal = Serial Google Sheets** (`date_input_format: "GOOGLE_SHEETS_SERIAL"`) bersama `parse_date_id`. Tipe bigint atau angka dalam rentang valid saja tidak membuktikan bahwa nilainya tanggal. Konfirmasi makna sumber melalui mapping; backend memeriksa seluruh nilai non-null dan menampilkan `validation.checked`, `convertible`, `invalid`, serta contoh. Nilai di luar rentang 1..2958465 menghentikan migrasi. Mode serial eksplisit menolak text, pecahan dan nilai non-finite; mode `TEXT` memakai pola strptime dan menolak angka. Default null mempertahankan parser konfigurasi lama, tetapi tidak mengizinkan migrasi berisiko tanpa deklarasi format. Workbook menyimpan pilihan ini di `02 Struktur Kolom`, kolom AD.

Worker mendukung kolom nullable baru dan perubahan tipe pada tabel kosong. View yang perlu dibuat ulang mempertahankan ACL/komentar; dependency yang tidak aman, rename/drop fisik, perubahan key dan backfill wajib diblokir. DDL, view, konversi, hash, aktivasi konfigurasi, audit sukses dan status job SUCCEEDED berada dalam satu transaksi. Kegagalan sebelum commit mempertahankan schema/data serta konfigurasi aktif sebelumnya. Audit kegagalan dan alasan UI dicatat setelah rollback; retry memeriksa fingerprint review kembali.

`DATABASE_RETRY_REQUIRED`: database sibuk/timeout/konflik; tunggu lalu retry. `DATABASE_PERMISSION_DENIED`: admin memeriksa role DDL, ownership dan izin SET ke role aplikasi. Catat ID job; jangan mengubah SQL atau menghapus data untuk melewati blocker. Migrasi platform saat rollout berbeda dari perubahan schema dataset melalui aplikasi.

Verifikasi 11 Oktober 2026: 497 pengujian backend tanpa integrasi (di luar workbook), 20 alur integrasi schema dan 12 tes PostgreSQL lulus. Round-trip workbook juga lulus. Frontend: 117 unit dan 15 browser test dengan API mock lulus; type-check/build statis berhasil. Export/check kontrak memeriksa 234 operasi. Tes rollback mencakup kegagalan aktivasi dan status job, dengan role runtime/DDL terpisah.

Tabel hasil ETL di Workspace mengikuti katalog: pencarian/pagination, lima kolom ringkas (produk, semantic/versi, sumber/tab, pemuatan, tindakan). Nama tabel fisik lengkap tersedia melalui Tabel database. Ikon tindakan mempertahankan akses Sheet/sumber/revisi dan Lihat detail untuk blocker; tombol Sync manual data tetap di atas tabel.


### Cleansing text otomatis dan bukti temuan AI

Kolom `text` dan `varchar` selalu mendapat `trim` otomatis pada nilai sumber sebelum transformasi tambahan, validasi DQ/key, pemeriksaan AI, dan pemuatan. `"  KAN  Jabung  "` menjadi `"KAN  Jabung"`: spasi di tengah, huruf, dan nol depan tetap dipertahankan. Nilai berisi spasi saja menjadi kosong/NULL; nullable mengizinkannya, kolom wajib tetap menghasilkan TYPE_OR_NULL_ERROR. Transformasi tambahan seperti normalize_whitespace, prefix/suffix, atau koreksi ejaan perlu aturan yang direview; trim dasar tidak perlu ditambahkan satu per satu. Nilai sumber di Sheet tidak ditulis ulang.

AI tidak boleh menganggap `[REDACTED]` sebagai data rusak atau menyimpulkan duplikat dari nilai yang disamarkan. Temuan duplikat memakai `issue_kind=EXACT_DUPLICATE` dan `related_source_row`; server membandingkan seluruh data asli di staging. Temuan pada nilai tersembunyi atau duplikat yang tidak terbukti dicatat sebagai temuan yang diabaikan pada checkpoint/audit tanpa membocorkan nilai. Masalah nyata pada kolom terbuka, dugaan PII, dan coverage tidak lengkap tetap menghentikan batch.

Sync manual pada konfigurasi NON_MASTER aktif yang telah disetujui dapat memeriksa ulang batch NEEDS_INPUT dengan blocker AI saja dan seluruh pertanyaan masih terbuka tanpa keputusan pengguna. Worker mengulang cleansing/validasi lalu review AI, mempertahankan identitas staging dan audit pertanyaan lama. Batch dengan keputusan, blocker teknis, konflik, atau gate akses/rilis belum selesai tidak dilompati. Muat ulang halaman tidak menjalankan sync.


### Tabel error response

Lihat [Error response: kemungkinan penyebab dan tindakan](ERROR_RESPONSES.md). Tabel mencakup error sumber, review/deploy schema, validasi/import, akses katalog serta layanan database/AI. Di aplikasi: **Bantuan > Tabel error response** atau **Panduan lengkap > Tabel error response**; gunakan pencarian kode. Alasan keputusan akses dan blocker batch dibedakan dari error HTTP.


### Format Google Sheet ideal untuk analitik dan action plan

Baca [Panduan lengkap format Google Sheet](PANDUAN_FORMAT_GOOGLE_SHEET.md): penamaan file/tab dan produk, header tabular, grain/key, master/taxonomy, tipe/satuan/presisi, waktu/periode wajib untuk data periodik, metrik, kualitas, provenance, action plan berbasis bukti dan contoh tabel. Di aplikasi buka **Bantuan > Format Google Sheet ideal** atau **Panduan lengkap > Format Google Sheet ideal**. Waktu kejadian/pengukuran, periode data dan waktu pengambilan dibedakan; tanggal sync bukan pengganti waktu bisnis. Definisi metrik dan tindakan tetap perlu review, bukan asumsi otomatis dari nama kolom.


### Istilah teknis untuk pengguna non teknis

[Tabel istilah teknis dalam bahasa sederhana](ISTILAH_TEKNIS.md) menjelaskan grain, business/primary key, master, taxonomy, mapping, tipe, nullable, dimensi/metrik, snapshot, ETL, periode, waktu pengambilan serta proses pemuatan dengan contoh bisnis. Buka **Bantuan > Istilah teknis dalam bahasa sederhana** atau **Panduan lengkap > Istilah teknis dalam bahasa sederhana**; cari istilah, arti atau contoh.


### Lima contoh Excel untuk analitik dan action plan

Lihat [Contoh data analitik](CONTOH_DATA_ANALITIK.md): keluhan pelanggan, sebaran marketing ATL/BTL, kepuasan berbasis produk, competitiveness harga/layanan dan plan/goal/KPI. File dapat diunduh dari **Bantuan > Contoh Excel untuk analitik dan action plan** atau **Panduan lengkap > Contoh Excel**. Data fiktif dilengkapi master, waktu/periode, kamus, rencana ETL, formula dan baseline tindakan; target/bobot/hipotesis tetap perlu verifikasi bisnis.

## Formula analitik dan aturan action plan

Lima contoh Excel memuat Formula_Analitik dan Aturan_Action_Plan. Kedua tab kontrol Dikecualikan dari ETL; produk data utamanya harus ACTIVE. Backend menerima impor melalui API analytics-rules/import-sheet, menyediakan preview, approval reviewer berbeda, evaluate berbasis metrik yang diizinkan dan REVOKE untuk menghentikan aturan. Hasil berupa usulan PROPOSED dengan bukti angka, periode dan versi; unit, sampel serta hipotesis diperiksa manusia. Workflow aturan saat ini melalui API, belum terhubung otomatis ke wizard ETL atau chat AI.

Lihat [panduan aturan dan formula](PANDUAN_ATURAN_ANALITIK.md) serta [lima template Excel](CONTOH_DATA_ANALITIK.md).
