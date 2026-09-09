# Tindak lanjut review frontend

## Blocker approval import dua akun

Diverifikasi 9 September 2026 melalui OpenAPI backend lokal dan pembacaan kode
`app/api/v1/import_reviews.py` serta `app/services/import_review_service.py`.

- POST `/import-reviews/{id}/preview` memiliki dependency EDIT_ROLES.
- GET detail hanya mengembalikan record review dan dependencies_current. Checkpoint
  menyimpan hash/revisi/blocker preview, tetapi tidak changes atau period_closures.
- POST approve menerima revision_no dan comment, tanpa token preview.
- Frontend tidak boleh membuka izin editor kepada reviewer, membawa data preview
  melalui storage browser lintas akun, atau meminta persetujuan tanpa isi perubahan.

Karena itu approval TECHNICAL_APPROVER masih diblokir dengan penjelasan di UI.
Belum ada request ke endpoint baru yang diasumsikan tersedia.

## Kontrak backend yang diperlukan (usulan, belum diimplementasikan)

Sediakan pembacaan preview untuk reviewer, misalnya GET `/import-reviews/{id}/preview`.
Respons perlu memuat revision_no, preview_hash, snapshot_id/hash, target, changes,
summary, period_closures, mode close_open_periods, blockers dan can_approve.
Jangan memerlukan token apply pada UI reviewer. Terapkan otorisasi tenant, masking
dan izin field periode untuk pengguna yang membaca; jangan memakai masking editor.

Pembacaan harus menolak preview stale tanpa diam-diam mengganti rencana. Approval
perlu mengikat hash yang benar-benar dilihat reviewer, selain revision_no, agar
preview baru pada revisi batch sama tidak mengganti isi yang sedang disetujui.
Tetap enforce separation of duties di backend. Editor kemudian memuat ulang state
dan memperoleh/menggunakan token apply yang cocok dengan rencana approved.

Setelah kontrak tersedia, acceptance wajib memakai DATA_STEWARD dan
TECHNICAL_APPROVER berbeda, termasuk refresh browser, penggantian akun, perubahan
target, akses field sensitif, dan penutupan periode.

## Perubahan frontend yang sudah tersedia

- Validasi parameter BE12 sebelum PATCH, mempertahankan string decimal dan field lain.
- Normalisasi field opsional kosong menjadi null; 0, false dan default string tetap.
- Error polling terlihat dan pemulihan melalui muat ulang eksplisit.
- Perlindungan beforeunload pada draft versi taxonomy.
- Saran kemiripan taxonomy dengan pilihan eksplisit dan pertanyaan manual berbasis
  UUID staging/mapping/nilai yang diverifikasi backend.
- Teks binding master mengikuti alur storage dan batch import.

Pengujian browser menggunakan mock API. Pembacaan OpenAPI/kode backend bukan
pengujian integrasi terautentikasi atau bukti deployment produksi.
