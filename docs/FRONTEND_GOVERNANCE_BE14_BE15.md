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
`revision_no` terbaru. Relationship berstatus APPROVED belum mengaktifkan query join;
halaman mempertahankan pesan bahwa compiler masih single-product.

## AI task policy BE-15

Frontend memanggil:

- `GET /ai-task-policies`
- `POST /ai-task-policies`
- `POST /ai-task-policies/{id}/approve`
- `POST /ai-task-policies/{id}/reject`

Purpose menentukan prompt terdaftar:

| Purpose | Prompt version |
|---|---|
| `ETL_CONFIG` | `etl_configuration_v1.md` |
| `TAXONOMY_RECOMMEND` | `taxonomy_recommend_v1.md` |
| `NL2SQL` | `nl2sql_v1.md` |

Model aktif wajib ada pada `allowed_models`; backend tetap memeriksa allowlist server.
Frontend tidak menyediakan field API key dan tidak menyimpan secret dalam policy.

## Role dan batas implementasi

- Join relationship dapat dikelola `PLATFORM_ADMIN` atau `DATA_STEWARD`, mengikuti
  dependency `DATA_ROLES` backend.
- AI policy dibuat oleh role editor dan diputuskan role reviewer sesuai endpoint backend.
- Trigger, budget, fallback, jadwal, watermark, retention, notifikasi, dan query compiler
  multi-product belum tersedia sehingga tidak ditampilkan sebagai fitur aktif.

## Verifikasi

- Unit frontend: **54 tes lulus**.
- Browser frontend: **58 tes lulus**.
- Build production dan `vue-tsc --build` lulus.
- Tes browser menggunakan mock API dan tidak menggantikan acceptance provider atau
  deployment production.
