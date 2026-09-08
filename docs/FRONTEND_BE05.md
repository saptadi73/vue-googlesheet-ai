# Frontend batch review import BE-05

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
  ditampilkan sebagai batas capability tahap review. Setelah blocker selesai, frontend
  dapat menjalankan preview, approval reviewer, dan apply.
- Evidence BE10 pada checkpoint menampilkan coverage, jumlah baris yang direview, daftar
  field yang disamarkan, dan metadata model/prompt. Nilai field MEDIUM/HIGH tidak ditampilkan;
  backend mengirimkannya ke AI sebagai `[REDACTED]`.
- List memakai status, offset dan limit 50 dengan `has_more`; tidak menampilkan total
  fiktif. Akses mengikuti role E/S backend dan tenant scope.
- Detail batch menampilkan pertanyaan dari BE06 untuk jawaban manual dan resolve proposal
  master melalui endpoint yang sama; nilai koreksi masih hanya staging batch.
- Pertanyaan yang dijawab tidak mengirim raw values, tidak menulis ke master/trusted target,
  dan tidak menjalankan AI.
- Preview/apply BE07 tersedia dari detail batch. Preview mengirim `revision_no` dan
  menyimpan `preview_token`; approval mengirim revision dan komentar reviewer; apply
  mengirim token preview yang sama serta revision batch terbaru.
- Resolve reference memakai `master_definition_id` dan nilai business key untuk mencari
  record kanonis. Jika user memilih pertanyaan staging yang terbuka, hasil EXACT dapat
  mengisi target column dengan record ID master; frontend kemudian membatalkan preview
  sebelumnya dan meminta preview baru.

Batch memakai snapshot yang sudah tersimpan. Profiling ulang atau perubahan dependency
tidak mengubah batch lama secara diam-diam; buat batch baru bila diperlukan. Frontend
tidak mengirim raw cell values, tidak memanggil AI langsung, tidak menulis Google Sheet, dan
tidak menjalankan migrasi `5ab90e816eee`.

Lihat detail implementasi BE06: [FRONTEND_BE06.md](FRONTEND_BE06.md).
