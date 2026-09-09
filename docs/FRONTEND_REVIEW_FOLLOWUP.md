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
