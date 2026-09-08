# Frontend batch review import BE05

Frontend menyediakan `/import-reviews` untuk membuat dan mencari batch, serta
`/import-reviews/:id` untuk memantau detail batch. Implementasi mengikuti
`API_REFERENCE.md` dan `IMPORT_REVIEW_BE05.md`.

- Create memakai `source_sheet_id`; tab NON_MASTER wajib memilih konfigurasi
  APPROVED/ACTIVE, sedangkan tab MASTER tidak mengirim `configuration_id` dan
  mengandalkan binding approved.
- Detail memuat snapshot hash, klasifikasi, dependency, revision/generation, checkpoint,
  jumlah temuan dan job. Temuan dipaginasi dan tidak menampilkan nilai sel mentah.
- Polling hanya berjalan pada VALIDATING dan AI_REVIEWING, berhenti pada NEEDS_INPUT,
  FAILED, STALE_REVIEW, CANCELLED atau SUCCEEDED. Berhenti polling tidak membatalkan job.
- Cancel, revalidate dan resume memakai revision terbaru dari detail. Tidak ada retry
  otomatis mutation atau loop resume; revalidate hanya tersedia untuk FAILED/STALE_REVIEW
  dan resume hanya untuk NEEDS_INPUT.
- `AI_REVIEW_NOT_IMPLEMENTED`, `IMPORT_INPUT_PENDING`, serta `execution_ready=false`
  ditampilkan sebagai batas capability BE05. SUCCEEDED pada tahap ini bukan bukti apply
  atau load ke target.
- List memakai status, offset dan limit 50 dengan `has_more`; tidak menampilkan total
  fiktif. Akses mengikuti role E/S backend dan tenant scope.

Batch memakai snapshot yang sudah tersimpan. Profiling ulang atau perubahan dependency
tidak mengubah batch lama secara diam-diam; buat batch baru bila diperlukan. Frontend
tidak mengirim raw cell values, tidak memanggil AI, tidak menulis trusted/master, dan
tidak menjalankan migrasi `5ab90e816eee`.
