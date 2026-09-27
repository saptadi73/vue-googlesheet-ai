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
Policy DRAFT dapat dipilih kembali untuk edit penuh memakai `revision_no` terbaru.
Frontend tidak menyediakan field API key dan tidak menyimpan secret dalam policy.

Form juga mengelola `max_context_chars`, `daily_budget_usd`, dan `fallback_model`.
Fallback opsional wajib berbeda dari model aktif dan tercantum dalam allowlist policy.
Daftar policy menampilkan ketiga kontrol agar reviewer dapat memeriksa batas runtime
sebelum approval. Error batas konteks dan budget policy memiliki arahan pemulihan tanpa
retry otomatis.

Purpose `NL2SQL` menampilkan pilihan DataProduct. Nilai kosong berarti policy global;
produk tertentu membuat assignment scoped yang diprioritaskan backend sebelum fallback
global. Purpose ETL dan taxonomy tidak menampilkan scope produk.

## Role dan batas implementasi

- Join relationship dapat dikelola `PLATFORM_ADMIN` atau `DATA_STEWARD`, mengikuti
  dependency `DATA_ROLES` backend.
- AI policy dibuat oleh role editor dan diputuskan role reviewer sesuai endpoint backend.
- Trigger sumber, masking khusus task, retention, dan editor workbook relationship belum
  tersedia. Jadwal/watermark dikelola dari Workspace/Jobs; statistik proses dan notifikasi
  persisten tersedia pada Jobs. Discovery join NL2SQL memakai graph
  APPROVED dari backend dan tetap melalui compiler yang sama.

## Verifikasi

- Unit frontend: **54 tes lulus**.
- Browser frontend: **62 skenario lulus**, termasuk regression notifikasi
  operasional, source schedule, Governance, dan multi-product.
- `vue-tsc --build` dan regresi browser Governance untuk kontrol runtime lulus.
- Tes browser menggunakan mock API dan tidak menggantikan acceptance provider atau
  deployment production.
