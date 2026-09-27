# Frontend statistik dan notifikasi operasional BE-15

Halaman `/jobs` memuat `GET /operations/summary` bersama daftar job, sumber, riwayat
ETL, dan `GET /notifications?unacknowledged_only=true&offset=0&limit=50`.

Ringkasan menampilkan job antre/berjalan/gagal, batch yang memerlukan input, dan jumlah
notifikasi belum diakui. Kartu notifikasi menyediakan:

- tautan `Buka batch import` untuk resource `IMPORT_REVIEW`;
- aksi `Pantau job` untuk resource `JOB`; dan
- `Tandai sudah dibaca`, yang memanggil
  `POST /notifications/{notification_id}/acknowledge` lalu memuat ulang summary/inbox.

Acknowledge bukan penyelesaian masalah dan tidak menjalankan retry. UI tetap memakai
aksi retry, jawaban pertanyaan, atau resume yang sesuai pada resource aslinya. Inbox
tidak menampilkan raw data, prompt, atau nilai PII.

Browser regression `operations-notifications.spec.ts` memeriksa summary, tampilan event,
request acknowledge, audit notice, dan hilangnya item dari inbox mock setelah diakui.
