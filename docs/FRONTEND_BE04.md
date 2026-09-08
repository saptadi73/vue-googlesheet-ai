# Frontend storage master BE04

Halaman `/masters/:id/storage` tersedia dari registry dan detail definisi master
aktif yang mempunyai versi approved. Implementasi mengikuti `API_REFERENCE.md`,
`REGISTRY_MASTER_BE03.md`, `STORAGE_MASTER_BE04.md` dan service backend lokal.

- GET storage-plan menampilkan versi approved, revisi registry dan kebijakan schema.
  Detail teknis memuat target serta DDL target lengkap, bukan diff ALTER.
- Platform Admin/Technical Approver dapat meninjau rencana, menambahkan komentar,
  lalu POST deploy-storage menggunakan revisi dari rencana tersebut. Deployment
  tidak mensyaratkan akun berbeda dari editor karena kontrak BE04 tidak mensyaratkannya.
- Setelah percobaan deploy, rencana dianggap sudah digunakan. Konflik/timeout tidak
  mengulang mutation otomatis; pengguna memuat ulang rencana sebelum mencoba lagi.
- GET records mendukung search maksimal 200 karakter, UUID record, active_only dan
  pagination 50 record. Tombol berikutnya memakai has_more; tidak membuat total fiktif.
  Pagination mempertahankan filter yang sudah diterapkan walaupun input sedang diedit.
- Data ditampilkan sesuai respons backend, mempertahankan string leading zero dan
  null. Daftar masked_fields menjelaskan placeholder `***`; frontend tidak membuka
  field sensitif atau mencoba pencarian alternatif untuk melewati masking.
- Role baca mengikuti S. Viewer/Analyst tidak memuat endpoint metadata ini.
  Respons lama diabaikan ketika akun/route berubah atau komponen ditutup.
- Error storage required/stale mengarahkan deployment oleh reviewer; schema migration
  required mengarahkan penanganan backend tanpa drop, recreate, atau retry otomatis.

Storage siap tidak berarti record telah diimpor. Import data dilakukan melalui batch import:
preview, approval, lalu apply. Tidak ada tombol insert, edit, merge, deactivate atau delete
record langsung dari halaman storage karena BE04 belum menyediakan API publik untuk operasi itu.

Verifikasi mencakup build production/type-check, 16 unit test dan tiga tes browser
BE04 di samping 12 tes workflow sebelumnya. Tes browser memakai mock API untuk
deployment dengan revisi terkini, konflik, role, masking, leading zero dan pagination.
Tidak ada deployment storage, DDL atau perubahan data pada backend aplikasi yang
dijalankan oleh pekerjaan frontend ini. Integrasi dengan backend hidup tetap perlu
diverifikasi pada lingkungan rollout.
