# Frontend incremental watermark BE-15

Workspace menampilkan panel **Incremental watermark** setelah profil tab tersedia.
Editor memilih kolom profil dan kind `INTEGER`, `DECIMAL`, `DATE`, atau `DATETIME`, lalu
mengirim `revision_no` terbaru ke `PATCH /source-sheets/{sheet_id}/watermark`.

Memilih **Nonaktif** mengirim kolom dan kind null. Backend mereset nilai ketika
konfigurasi berubah. UI menampilkan nilai tersimpan dan menjelaskan bahwa hanya nilai
lebih besar yang diproses serta watermark baru maju setelah load/apply sukses.

Conflict revision/stale, kolom hilang, tipe nilai salah, dan strategi FULL_REFRESH
memiliki recovery message khusus. Browser regression memeriksa payload tanpa membuat
klaim bahwa mock menjalankan transaksi database.
