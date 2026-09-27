# Status frontend kontrol akses yurisdiksi BE-16

Fondasi BE-16 tahap 1 sudah tersedia. Registry, assignment bertanggal, revoke, histori,
dan effective access role + assignment dapat dikelola dari halaman Administrasi.
Tahap 2 juga menyediakan registry permission bundle dan grant/revoke bertanggal.
Tahap 3 menyediakan pembuatan policy/binding, submit, approve/revoke, dan preview keputusan.
Form policy ALLOW dengan aksi EXPORT kini menawarkan izin ekspor eksplisit (default mati).
Preview membedakan hasil diizinkan/ditolak dan izin ekspor; hasil lama dibersihkan saat
parameter evaluasi, akun, assignment, grant, atau policy berubah. Respons preview yang
datang terlambat diabaikan. Tes browser BE16 mencakup kedua hasil ekspor dan pencabutan
assignment setelah preview. Preview sendiri tidak mengizinkan unduhan: backend kini
menegakkan evaluator SOURCE hanya untuk DataProduct dari sumber BE16 yang diaktifkan.
Binding policy baru memilih resource tenant aktif dari `/access/resources`, bukan kode
teks bebas. Pencarian menggunakan kode; hasil kosong membatalkan pilihan lama. Endpoint
binding backend tetap memeriksa resource saat disimpan, sedangkan binding lama perlu
ditinjau sebelum enforcement diaktifkan.
Workspace menampilkan `access_status` pada sumber terpilih dan memperlakukan respons
backend lama tanpa field itu sebagai perlu policy. Indikator ini belum mengunci tombol
query/export; backend menegakkan jalur DataProduct BE16, tetapi legacy null-metadata
masih melalui kontrol lama. Status sumber `POLICY_APPROVED` bukan izin otomatis user.
Form pendaftaran sumber kini meminta unit pemilik, domain bisnis, yurisdiksi, PURPOSE,
owner, steward, dan sensitivitas. Scope dipilih dari assignment aktif pengguna; PURPOSE
dan kandidat owner/steward berasal dari `/access/registration-options`. Backend tetap
memeriksa ulang setiap ID pada POST jika assignment berubah. Admin dapat membuat atribut
PURPOSE di registry akses. Policy template dan approval policy sumber tetap terbuka.
Workspace kini juga dapat mengisi/memperbaiki metadata sumber terpilih lewat PATCH
ber-revision. Setelah berhasil, respons sumber memperbarui status/revision dan tetap
memerlukan review policy; konflik 409 mempertahankan input yang belum disimpan.
Admin yang berbeda dari editor metadata dapat memuat konteks review tenant-scoped,
melihat label atribut serta owner/steward, lalu memilih approve/reject dengan alasan
baku. Scope invalid menahan approve tetapi tetap dapat ditolak. Hasil review dan
alasan tampil pada sumber terpilih; approval metadata tidak membuka akses data.
Admin dapat memilih policy SOURCE approved dari daftar server dan mengaktifkan sumber
setelah review metadata. Dashboard/Chat hanya memakai katalog yang dikembalikan backend;
produk baru berstatus pending tidak ditawarkan. Aktivasi tidak berarti semua user dapat
membaca: evaluator backend memeriksa assignment/policy per aksi pada setiap permintaan.
Daftar policy sumber hanya memuat ALLOW yang mensyaratkan unit, domain, dan yurisdiksi
metadata sumber. Sensitivitas HIGH belum otomatis menerapkan masking.
Sumber legacy masih mengikuti kontrol lama; row/column masking, policy template, dan
enforcement semua jalur tetap memerlukan tahap berikutnya.

- [~] Registrasi sumber meminta unit pemilik, business domain/category, owner, steward,
  yurisdiksi, sensitivitas, dan purpose dari registry backend; policy template belum tersedia.
- [x] Selector hanya menampilkan scope dalam assignment aktif pengguna; backend tetap
  memvalidasi semua ID dan menjadi sumber keputusan final.
- [~] Tampilkan status `ACCESS_POLICY_REQUIRED` dan blokir query/export sampai policy
  approved pada produk sumber dengan metadata; legacy dan jalur non-DataProduct belum.
- [x] Tambahkan administrasi assignment pengguna dengan effective dating, multi-scope,
  expiry, revoke, revision conflict, dan audit context.
- [~] Perluas halaman User Management untuk lifecycle akun, role sistem, permission
  bundle/business role, assignment, delegasi admin, revoke sesi, dan status approval.
  Role/aktif-nonaktif, bundle, assignment dan revoke tersedia; suspended/delegasi belum.
- [x] Implementasikan bagian permission bundle tahap 2: pilih aksi baku, buat registry,
  grant/revoke bertanggal, alasan wajib, self-change guard, dan effective action gabungan.
- [~] Tambahkan tampilan `Effective access` per pengguna yang menjelaskan hasil role,
  assignment, policy allow/deny, masking, dan expiry; role/assignment/grant serta
  preview per resource tersedia, penjelasan gabungan dan masking belum.
- [x] Tampilkan effective access tahap 1 berupa role, aksi dasar, assignment aktif, dimensi,
  dan expiry; perluas komponen yang sama saat policy allow/deny dan masking tersedia.
- [~] Cegah kombinasi separation-of-duties pada form dan tetap tampilkan penolakan backend
  bila state berubah atau request langsung mencoba melewati validasi UI. Guard diri sendiri
  pada grant/review sumber tersedia; aturan SoD/delegasi lengkap belum.
- [x] Tambahkan lifecycle policy draft/review/approve/revoke serta preview capability
  terhadap contoh pengguna/resource sebelum approval.
- [ ] Tambahkan access request sementara, alasan bisnis, expiry, delegasi, approval, dan
  status permintaan tanpa memberikan akses secara optimistis.
- [ ] Semua halaman memakai capability response untuk tombol, tetapi tetap menangani
  403/404 backend dan tidak menganggap kontrol tampilan sebagai keamanan.
- [ ] Terapkan render kolom `VISIBLE`/`MASKED`/`HIDDEN` secara konsisten pada tabel,
  grafik, filter, tooltip, preview, lineage, error, download, dan export.
- [~] Dashboard/Chat hanya menawarkan produk, field, relationship, template, dan contoh
  yang dikembalikan katalog terotorisasi; filter produk tersedia, field/masking belum.
- [~] Bersihkan state/cache lokal saat assignment/policy revision berubah, sesi dirotasi,
  akses dicabut, atau akun diganti. State akun dan preview admin dibersihkan; invalidasi
  semua hasil/cache lintas halaman belum diverifikasi.
- [~] Uji direct URL, stale response lintas akun, deny override, expiry/revoke, hierarchy,
  multi-assignment, row scope, masking, export, join, dan AI clarification dengan mock API.
  Skenario administrasi, aktivasi dan produk pending tersedia; matriks lengkap belum.
- [x] Tambahkan browser test tahap 1 untuk membuat registry, memberi assignment, melihat
  effective access, dan revoke; matriks enforcement lengkap tetap menunggu evaluator.

Kontrak backend dan urutan rollout ada di
`../../fastapi-googlesheet-ai/docs/ACCESS_JURISDICTION_BE16.md`.
