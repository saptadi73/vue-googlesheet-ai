# Status frontend kontrol akses yurisdiksi BE-16

## Multi-unit dan approver per sumber

Pada **Administrasi → Akses pengguna**, admin dapat mencentang beberapa unit departemen
sekaligus dan menyimpan assignment dalam satu permintaan. Unit induk tidak otomatis memberi
akses ke unit bawahan; pilih semua unit yang diizinkan. Data baru terlihat bila policy
sumber/produk, domain, dan yurisdiksi juga cocok.

Pada **Administrasi → Approver per sumber data**, admin memilih sumber lalu memilih akun
reviewer aktif secara terpisah untuk metadata sumber, konfigurasi ETL, dan batch import.
Daftar yang sudah disimpan berlaku pada keputusan berikutnya; daftar kosong menahan keputusan
jenis tersebut. Akun reviewer harus ber-role PLATFORM_ADMIN atau TECHNICAL_APPROVER dan
tidak boleh menyetujui pekerjaan sendiri. Penunjukan tidak memberi hak membaca data.
Reviewer teknis dapat membuka panel review metadata pada Workspace ETL; aktivasi policy
sumber tetap dilakukan admin.

Fondasi BE-16 tahap 1 sudah tersedia. Registry, assignment bertanggal, revoke, histori,
dan effective access role + assignment dapat dikelola dari halaman Administrasi.
`/login` menjadi satu-satunya route publik. Router menahan seluruh komponen privat sebelum
sesi tersedia, mempertahankan redirect internal yang aman, dan mengalihkan route yang tidak
sesuai role ke landing resmi. Admin masuk ke `/admin`, owner/steward ke `/workspace`,
approver ke `/import-reviews`, serta analyst/viewer ke `/dashboard`. Logout atau kegagalan
refresh menghapus state sesi dan kembali ke login. Registrasi akun tersedia di `/register` dan
`/admin/users/new`, termasuk password awal, role, serta row scope. Halaman `/admin/users`
menyediakan daftar akun, status aktif, role, dan row scope. Ketiga operasi administrasi
tetap memakai endpoint backend tenant-scoped dan hanya ditampilkan kepada
`PLATFORM_ADMIN`; tidak ada self-registration publik. Admin awal berasal dari seed backend
dan selanjutnya dapat membuat admin kedua untuk memenuhi separation of duties.
Tahap 2 juga menyediakan registry permission bundle dan grant/revoke bertanggal.
Tahap 3 menyediakan pembuatan policy/binding, submit, approve/revoke, dan preview keputusan.
Form policy ALLOW dengan aksi EXPORT kini menawarkan izin ekspor eksplisit (default mati).
Preview membedakan hasil diizinkan/ditolak dan izin ekspor; hasil lama dibersihkan saat
parameter evaluasi, akun, assignment, grant, atau policy berubah. Respons preview yang
datang terlambat diabaikan. Tes browser BE16 mencakup kedua hasil ekspor dan pencabutan
assignment setelah preview. Preview sendiri tidak mengizinkan unduhan: backend kini
menegakkan evaluator SOURCE hanya untuk DataProduct dari sumber BE16 yang diaktifkan.
Preview juga menampilkan pasangan policy ID/revision yang menghasilkan keputusan, sehingga
admin dapat membedakan policy lama dari revisi terbaru saat melakukan review.
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
melihat produk: evaluator DATA_PRODUCT mewarisi binding SOURCE induknya dan menggabungkan
binding DATA_PRODUCT langsung bila tersedia. Explicit deny dari kedua scope tetap menang.
melihat produk: evaluator DATA_PRODUCT mewarisi binding SOURCE induknya dan menggabungkan
binding DATA_PRODUCT langsung bila tersedia. Explicit deny dari kedua scope tetap menang.
membaca: evaluator backend memeriksa assignment/policy per aksi pada setiap permintaan.
Daftar policy sumber hanya memuat ALLOW yang mensyaratkan unit, domain, dan yurisdiksi
metadata sumber. Sensitivitas HIGH belum otomatis menerapkan masking.
Sumber legacy masih mengikuti kontrol lama. Query BE16 kini menerapkan row scope,
default-hidden untuk PII MEDIUM/HIGH, dan placeholder kolom masked dari backend;
metadata katalog juga sudah disanitasi sebelum dikirim ke Dashboard/Chat; perlindungan lineage/error/preview/export,
detail/error/lineage ETL sumber BE16 kini ditahan oleh backend saat policy SOURCE tidak cocok;
perlindungan lineage/error/preview/export non-ETL,
policy template, serta enforcement semua jalur tetap memerlukan tahap berikutnya. Cache query backend memakai
token version dan policy revision SOURCE; frontend tidak menyimpan hasil query lintas
perubahan otorisasi sebagai sumber keputusan baru.
Dashboard menandai kolom/metric dengan `access_visibility: MASKED` dan menampilkan
placeholder backend tanpa mencoba membuka nilai asli. Field yang dihapus dari katalog
tidak ditawarkan sebagai dimension, metric, filter, atau sort.

Halaman `/access-requests` tersedia bagi seluruh akun aktif. Pengguna memilih atribut
yurisdiksi atau permission bundle, periode, dan alasan bisnis. `PLATFORM_ADMIN` juga dapat
memilih pengguna aktif lain sebagai penerima akses. Request tetap `PENDING` sampai admin
lain menyetujui. Halaman yang sama menampilkan histori pemohon/penerima, cancel, revoke,
serta antrean keputusan untuk `PLATFORM_ADMIN`. Tombol approval request sendiri
dinonaktifkan dan backend tetap menegakkan separation of duties. Notifikasi reviewer
ditampilkan pada inbox Jobs hanya kepada admin penerima dan menyediakan tautan langsung
ke halaman Access Requests. Approve, reject, atau cancel menyelesaikan notifikasi terkait.

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
  Role/aktif-nonaktif, bundle, assignment, revoke, serta delegasi access request tersedia;
  status suspended dan approval assignment berisiko belum.
- [x] Sediakan halaman khusus login, registrasi internal, dan pengaturan role/status/row
      scope. Router menolak direct route anonim sebelum komponen dimuat dan mengalihkan role
      yang tidak cocok ke landing resminya; backend tetap menjadi otorisasi akhir.
- [x] Implementasikan bagian permission bundle tahap 2: pilih aksi baku, buat registry,
      grant/revoke bertanggal, alasan wajib, self-change guard, dan effective action gabungan.
- [x] Terapkan self-change guard assignment di UI dan backend: admin tidak dapat memberi
      atau mencabut assignment yurisdiksinya sendiri; admin lain tetap dapat mengelola assignment.
- [~] Tambahkan tampilan `Effective access` per pengguna yang menjelaskan hasil role,
  assignment, policy allow/deny, masking, dan expiry; role/assignment/grant serta
  preview per resource tersedia, penjelasan gabungan dan masking belum.
- [x] Tampilkan effective access tahap 1 berupa role, aksi dasar, assignment aktif, dimensi,
      dan expiry; perluas komponen yang sama saat policy allow/deny dan masking tersedia.
- [~] Cegah kombinasi separation-of-duties pada form dan tetap tampilkan penolakan backend
  bila state berubah atau request langsung mencoba melewati validasi UI. Guard diri sendiri
  pada grant/review sumber dan approval request delegasi tersedia; matriks konflik berisiko
  lengkap belum.
- [x] Tambahkan lifecycle policy draft/review/approve/revoke serta preview capability
      terhadap contoh pengguna/resource sebelum approval.
- [x] Tambahkan access request sementara, alasan bisnis, expiry, delegasi, approval, dan
      status permintaan tanpa memberikan akses secara optimistis. Request atribut/bundle,
      delegasi admin, approval admin kedua, reject/cancel/revoke, dan histori tersedia;
      inbox reviewer terarah juga tersedia.
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
      effective access, dan revoke; test juga memastikan grant/revoke assignment akun admin
      sendiri disabled; matriks enforcement lengkap tetap menunggu evaluator.

Kontrak backend dan urutan rollout ada di
`../../fastapi-googlesheet-ai/docs/ACCESS_JURISDICTION_BE16.md`.

### Gate persetujuan sebelum tayang

Pada Administrasi, admin memilih sumber lalu membuka **Muat aturan siap tayang**.
Pilih pemeriksa IT dari akun aktif ber-role technical approver/admin. Tambahkan setiap
unit bisnis terkait dan akun bernama yang memiliki assignment aktif pada unit tersebut.
Setiap kelompok memakai akun yang berbeda; UI mencegah pemilihan ulang akun pada
kelompok lain dan backend mengulangi validasinya.
Simpan aturan untuk mengaktifkan gate pada rilis konfigurasi berikutnya. Form memakai
nama akun/unit; ID internal hanya dikirim aplikasi ke backend. Perubahan aturan
membuat keputusan lama tidak berlaku untuk revisi kebijakan terbaru.

Menu **Persetujuan tayang** tersedia bagi akun login, termasuk approver unit ber-role
VIEWER. Inbox hanya memuat konfigurasi approved yang ditugaskan. Tinjau ringkasan
produk, kolom, metrik, dan catatan, lalu pilih kelompok yang berwenang untuk memberi
keputusan. IT dan setiap unit terkait harus menyetujui revisi yang sama. Halaman review
IT meminta checklist skema/mapping, kualitas data, dan keamanan/akses sebelum approval.
Halaman review ETL menampilkan status kelompok dan menonaktifkan tombol deploy saat gate belum siap;
backend tetap menolak bypass API/worker. Penolakan menahan rilis sampai versi baru
dibuat atau aturan direvisi oleh admin. Batch import berikutnya masih memakai approval
batch existing, belum gate lintas-unit per batch. Rollback ke konfigurasi lama juga
memerlukan keputusan yang sesuai dengan aturan rilis saat ini.

### Kontrak SoD assignment

Form Administrasi menonaktifkan grant/revoke assignment ketika akun yang dipilih adalah
akun admin yang sedang login. Ini hanya pencegahan UX; backend tetap menjadi sumber
keputusan dan mengembalikan `422 SELF_ACCESS_CHANGE` bila request langsung mencoba
memberi atau mencabut assignment diri sendiri. Error ini tidak boleh di-retry otomatis.
