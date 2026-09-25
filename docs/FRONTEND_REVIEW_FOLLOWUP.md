# Tindak lanjut review frontend

Kontrak terbaru API_REFERENCE.md dan FRONTEND_BE13.md telah menyediakan GET preview
reviewer dan saran taxonomy generatif. Blocker kontrak approval dua akun sebelumnya
sudah ditangani di frontend.

## Approval dua akun

- Editor membuat POST preview; reviewer memilih Baca preview editor (GET).
- UI menampilkan changes, summary, period_closures dan masked_fields dari backend.
- Approve mengirim review.revision_no dan preview_hash dari respons preview yang sama.
- GET tidak memberikan token apply. Editor memuat status terbaru dan membuat POST
  preview untuk memperoleh token bagi rencana approved yang masih sama.
- Preview dibuang saat reload, perubahan akun/rute, atau kegagalan approval/pembacaan.
  Preview required/stale mengarahkan pengguna membuat ulang atau revalidate.

## Saran AI taxonomy

- Tombol eksplisit pada registry dan pertanyaan TAXONOMY_INVALID.
- Input dibatasi 50 nilai nonblank, 500 karakter per nilai dan 1..10 kandidat.
- Versi taxonomy dikirim; model, prompt, jenis generatif, input index dan confidence tampil.
- Konfirmasi kode mengisi koreksi; Simpan jawaban tetap aksi terpisah APPLY_CORRECTION.
- SELECT_RECORD tetap terbatas pada kandidat pertanyaan. Tidak ada fallback AI otomatis.
- Error provider, stale dan limit ditampilkan; tidak dianggap hasil sukses kosong.

Pengujian browser menggunakan mock API. Kredensial/kualitas provider, masking aktual,
otorisasi tenant dan deployment backend tetap memerlukan pengujian integrasi lingkungan tujuan.

## Default DQ bertipe (BE12)

- Input default memakai JSON scalar secara eksplisit. `null` atau input kosong
  menonaktifkan default; `""` adalah string kosong. `"0"`, `"false"`, dan `"null"`
  tetap string setelah simpan dan muat ulang.
- Array, object, JSON rusak, angka non-finite dan integer di luar batas aman JavaScript
  ditolak sebelum request simpan. Gunakan string untuk angka besar/presisi exact.
- Input yang belum valid menahan simpan, dry-run, dan submission; pesan muncul di
  field terkait. Menghapus rule juga menghapus blocker field tersebut.
- Tes unit memeriksa parsing/round-trip scalar; tes browser memeriksa payload PATCH,
  reload dan pemulihan input. Pengujian browser menggunakan mock API.

## Pemulihan draft versi BE13

Konflik revision, versi dasar stale, atau snapshot immutable menahan simpan/publikasi
ulang tanpa membuang edit lokal. Muat ulang snapshot untuk mengambil revision aktual
dan meninjau kembali; tidak ada retry mutation otomatis. Draft dengan base_version
berbeda dari registry aktif tidak dapat disimpan atau dipublikasikan.
Konfirmasi publikasi direset ketika diff registry atau versi aktif berubah. Respons
snapshot/mutation dari sesi atau komponen lama tidak mengisi state baru.
Tes browser memakai mock API; otorisasi dan konkurensi PostgreSQL tetap diuji di backend.
