# Frontend pertanyaan batch import BE-06

Frontend menambahkan dukungan endpoint pertanyaan BE-06 pada halaman
`/import-reviews/:id` untuk batch yang sudah dibuat. Implementasi mengikuti
`IMPORT_QUESTIONS_BE06.md` dan `IMPORT_REVIEW_BE05.md`.

- Daftar pertanyaan dimuat dari `GET /import-reviews/{review_id}/questions` dengan filter
  `status`, `category`, `offset`, dan `limit=50`; daftar memakai `has_more` dan tidak menampilkan total.
- Setiap pertanyaan ditampilkan dengan data aman (`source_row`, `source_column`,
  `target_column`, `prompt`, `category`, `mandatory`, `decisions`).
- Untuk pertanyaan **OPEN**, editor dapat memilih aksi sesuai `allowed_actions`,
  menulis `reason`, `corrected_value`, atau memilih `candidate` lalu mengirim
  `POST /import-reviews/{review_id}/questions/{question_id}/answer`.
- Frontend tidak menampilkan raw values dan tidak menulis ulang sheet target.
- `master_proposal` dikirim sebagai JSON pada aksi `PROPOSE_MASTER`.
- Jika jawaban menghasilkan `stale=true`, frontend memuat ulang batch dan menyuruh user
  membuat batch baru bila dependency sudah berubah.
- Untuk status `PENDING_APPROVAL`, Technical Approver dapat menyelesaikan proposal
  lewat `POST /import-reviews/{review_id}/questions/{question_id}/resolve-master-proposal`.
- Kemampuan lain pada batch tetap sama: lihat checkpoint, temuan, cancel, revalidate, resume.
- Semua aksi tetap memakai `revision_no` dari data terbaru untuk mencegah conflict
  versi; transaksi lain tetap diproses lewat endpoint BE-05 tanpa loop auto-retry.
