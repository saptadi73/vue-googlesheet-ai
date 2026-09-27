# Frontend jadwal source BE-15

Halaman `/jobs` menampilkan cron, timezone, concurrency policy, dan revision setiap
source. Role editor dapat membuka form **Edit jadwal** dan mengirim:

```http
PATCH /api/v1/sources/{source_id}/schedule
```

Form menerima cron lima field kosong/terisi, timezone IANA, serta:

- `QUEUE_LATEST`: jalankan satu kali setelah job aktif selesai.
- `SKIP_IF_RUNNING`: lewati occurrence bila job masih aktif.

Selector multi-upstream mengirim `dependency_source_ids`. Backend menolak self-reference,
source lintas tenant, dan siklus. Downstream menunggu seluruh upstream sukses dengan
hasil yang lebih baru; frontend tidak menganggap pemilihan dependency sebagai bukti job
upstream sudah siap.

Payload selalu membawa `revision_no` terakhir. `SOURCE_SCHEDULE_CONFLICT` meminta
pengguna memuat ulang sebelum menyimpan ulang. Pause/resume tetap merupakan aksi
terpisah dan tidak mengubah konfigurasi jadwal.

Browser regression memeriksa payload timezone, concurrency policy, dependency, dan revision;
type-check memastikan response DataSource memuat seluruh field scheduler.
