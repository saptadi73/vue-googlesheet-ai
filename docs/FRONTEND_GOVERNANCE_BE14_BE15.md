# Frontend Governance BE-14 dan BE-15

Implementasi aktif berada pada route `/governance` dan memakai endpoint relatif
terhadap `/api/v1`.

## Join relationship BE-14

Frontend memanggil:

- `GET /semantic/data-products`
- `GET /semantic/join-relationships`
- `POST /semantic/join-relationships`
- `PATCH /semantic/join-relationships/{id}`
- `POST /semantic/join-relationships/{id}/approve`
- `POST /semantic/join-relationships/{id}/reject`

Form memilih dua produk aktif dan kolom dari metadata produk. Payload mencakup
`cardinality`, `join_type`, dan `duplicate_policy`. Edit dan keputusan selalu memakai
`revision_no` terbaru. Relationship berstatus APPROVED tersedia pada Dashboard bila
arahnya dimulai dari produk utama dan kedua produk dapat diakses. Dashboard mengirim
kode relationship pada `QueryPlan.join_relationships`; field sekunder menggunakan
`PRODUCT.field`.

## AI task policy BE-15

Frontend memanggil:

- `GET /ai-task-policies`
- `GET /ai-task-policies/{id}/versions?offset=0&limit=50`
- `POST /ai-task-policies`
- `PATCH /ai-task-policies/{id}`
- `POST /ai-task-policies/{id}/approve`
- `POST /ai-task-policies/{id}/reject`

Purpose menentukan prompt terdaftar:

| Purpose | Prompt version |
|---|---|
| `ETL_CONFIG` | `etl_configuration_v1.md` |
| `TAXONOMY_RECOMMEND` | `taxonomy_recommend_v1.md` |
| `NL2SQL` | `nl2sql_v1.md` |

Model aktif wajib ada pada `allowed_models`; backend tetap memeriksa allowlist server.
Semua model di `allowed_models` juga harus termasuk allowlist server. Governance
menampilkan batas ini sebelum submit; create/edit dan approval memvalidasinya kembali di
backend. Approval turut memeriksa mapping prompt dan konsistensi model/fallback tersimpan.
Policy DRAFT dapat dipilih kembali untuk edit penuh memakai `revision_no` terbaru.
Tombol riwayat per policy menampilkan baseline serta snapshot CREATED/UPDATED/APPROVED/
REJECTED, dengan revision terbaru lebih dahulu. Snapshot tidak memuat API key.
Frontend tidak menyediakan field API key dan tidak menyimpan secret dalam policy.

Form juga mengelola `max_context_chars`, `daily_budget_usd`, dan `fallback_model`.
Fallback opsional wajib berbeda dari model aktif dan tercantum dalam allowlist policy.
Daftar policy menampilkan ketiga kontrol agar reviewer dapat memeriksa batas runtime
sebelum approval. Error batas konteks dan budget policy memiliki arahan pemulihan tanpa
retry otomatis.

Purpose `NL2SQL` menampilkan pilihan DataProduct. Nilai kosong berarti policy global;
produk tertentu membuat assignment scoped yang diprioritaskan backend sebelum fallback
global. `ETL_CONFIG` dapat diikat ke source tenant; `TAXONOMY_RECOMMEND` dapat diikat
ke taxonomy aktif APPROVED. Ketiganya juga mendukung policy global per purpose.

## Role dan batas implementasi

- Join relationship dapat dikelola `PLATFORM_ADMIN` atau `DATA_STEWARD`, mengikuti
  dependency `DATA_ROLES` backend.
- AI policy dibuat oleh role editor dan diputuskan role reviewer sesuai endpoint backend.
- Riwayat versi policy hanya menampilkan snapshot yang dikembalikan endpoint tenant-scoped;
  revision sebelum baseline migrasi tidak direkonstruksi.
- Trigger sumber, masking khusus task, retention, serta
  import workbook tab 07/08 belum tersedia. Jadwal/watermark dikelola dari Workspace/Jobs;
  statistik proses dan notifikasi persisten tersedia pada Jobs. Discovery join NL2SQL memakai graph
  APPROVED dari backend dan tetap melalui compiler yang sama.

## Verifikasi

- Verifikasi 30 September 2026: **54 unit test** dan **73 skenario browser** lulus;
  `vue-tsc --build` serta build production lulus. Governance browser test memeriksa
  create/edit/approval AI policy dan batas allowlist model.
- Browser memakai mock API; hasilnya tidak menggantikan acceptance provider atau
  deployment production. Retention, trigger/masking khusus task, dan import tab 07/08
  tetap belum diimplementasikan.
