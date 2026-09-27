# BE14 tahap 1: metadata bisnis produk

PATCH `/api/v1/semantic/data-products/{product_id}` tetap untuk PLATFORM_ADMIN dan
DATA_STEWARD, memakai lookup tenant dan row lock existing. Payload tambahan:

```json
{
  "name": "Penjualan cabang",
  "description": "Nilai penjualan setelah retur",
  "expected_version": 3
}
```

`name` opsional, 1..200 karakter, di-trim dan tidak boleh blank/null.
`description` opsional, maksimal 4000 karakter; string kosong menghapus deskripsi,
null ditolak. Pengiriman salah satu field metadata mewajibkan `expected_version`
integer positif. Schema invalid menghasilkan 422. Field omitted tidak diubah.
Request lama yang hanya mengubah allowed_roles/status tetap kompatibel; client baru
dapat mengirim expected_version untuk pemeriksaan konflik pada update tersebut juga.

Backend membandingkan versi setelah lock. Mismatch menghasilkan
`PRODUCT_VERSION_CONFLICT` (409), tanpa perubahan atau audit sukses. Frontend
mempertahankan edit lokal, menahan submit ulang, dan menyediakan reload eksplisit.
Sukses mengembalikan DataProduct, menaikkan version dan mencatat nama field yang
diubah serta versi semantic baru di audit. expected_version tidak disimpan.

Template existing dengan semantic_version lama akan menghasilkan TEMPLATE_STALE
sampai divalidasi dan diaktifkan ulang. Cache query memakai versi produk existing.
Perubahan ini tidak mengubah SQL, dimensi, metrik, tenant scope, row scope atau PII.
Deployment konfigurasi berikutnya tetap mengisi nama/deskripsi dari konfigurasi ETL;
edit katalog ini bukan override permanen terhadap konfigurasi sumber.

Frontend: Dashboard → pilih produk → Edit metadata bisnis produk. Hanya role data
yang melihat editor. Request lama frontend tetap kompatibel; editor baru memerlukan
backend tahap ini terlebih dahulu. Tidak ada migrasi database.

Tahap 1 belum mencakup unit/sinonim (ditambahkan pada tahap 2 di bawah), default periode, approval metrik, expression AST,
template berparameter, atau join multi-product. BE14 masih berlangsung.
Tes service/schema dan browser memakai mock; bukan bukti konkurensi PostgreSQL nyata.

## Tahap 2: unit dan sinonim metrik

Endpoint PATCH yang sama menerima `metric_metadata`, daftar 1..100 edit berdasarkan
kode metrik existing. expected_version wajib. Contoh:

```json
{
  "expected_version": 4,
  "metric_metadata": [
    { "code": "net_sales", "unit": "IDR", "synonyms": ["Pendapatan bersih", "Net revenue"] }
  ]
}
```

Setiap entri wajib menyertakan unit atau synonyms. Unit nullable maksimal 40 karakter,
di-trim; kosong/null menghapus unit. Synonyms maksimal 20 string nonblank, masing-masing
100 karakter; whitespace dinormalisasi dan duplikasi case-insensitive ditolak.
`synonyms: []` menghapus sinonim. Field omitted dipertahankan. Kode entri tidak boleh
berulang. Column, aggregation, expression, dan kode metrik tidak dapat diedit lewat
payload ini. Unknown code menghasilkan METRIC_NOT_FOUND (422). Sinonim yang sama
dengan kode/label/sinonim metrik lain dalam produk menghasilkan METRIC_SYNONYM_CONFLICT
(422). Seluruh validasi selesai sebelum metadata produk dimutasi.

Metadata tersimpan pada JSON metrics existing, tanpa migrasi. Respons katalog produk
dan `/semantic/metrics` menampilkan unit/synonyms; konteks katalog NL2SQL existing ikut
memuatnya. Tidak ada pemilihan metrik otomatis berdasarkan sinonim: QueryPlan tetap
menerima kode metrik resmi saja. Unit merupakan label, bukan konversi nilai/currency.
Query compiler mengizinkan metadata synonyms tanpa mengubah perhitungan atau scope.

Frontend menyediakan input unit dan sinonim per metrik di editor metadata produk.
Hanya metrik yang berubah dikirim, tanpa column/aggregation. Label unit/sinonim juga
terlihat di katalog dashboard untuk pengguna berizin. Konflik versi memakai recovery
tahap 1. Metadata ini ikut diganti dari konfigurasi ketika redeploy ETL, sehingga
belum menjadi override permanen atau lifecycle approval metrik.

Verifikasi tahap 2: 36 tes backend schema/service/query lulus. Tes browser memakai
mock untuk payload, duplicate input, penghapusan, serta akses viewer; provider NL2SQL
dan konkurensi PostgreSQL nyata belum diverifikasi.

Verifikasi frontend 26 September 2026 menambahkan regression browser untuk konfigurasi
multi-metrik dan memastikan metadata unit/sinonim tetap tampil setelah PATCH.

Editor unit/sinonim tahap 2 hanya pada katalog produk; parameter konfigurasi ETL dan
workbook belum diperluas untuk menyimpan metadata tersebut.

## Tahap 3: null handling metrik melalui konfigurasi ETL

`configuration.semantic.metrics[].null_handling` menerima `PRESERVE` (default) atau
`ZERO_RESULT`. Pilihan disimpan lewat PATCH konfigurasi lengkap dan melewati alur
validasi, review/approval serta deployment existing sebelum memengaruhi produk aktif.
Endpoint metadata produk tahap 2 tidak menerima field ini.

PRESERVE mempertahankan perilaku SQL: SUM/AVG/MIN/MAX dari input seluruhnya null atau
tanpa baris menghasilkan null, COUNT tetap 0. ZERO_RESULT membungkus hasil agregat
dengan COALESCE(aggregate(column), 0). Input null tidak diubah menjadi 0 sebelum AVG.
Hanya hasil numeric yang diperbolehkan: sum/avg/min/max atas integer/bigint/numeric,
atau count/count_distinct atas tipe kolom yang didukung. MIN/MAX teks/tanggal dengan
ZERO_RESULT ditolak schema; catalog invalid ditolak SEMANTIC_METRIC_INVALID (422).
GROUP BY tidak menciptakan kelompok yang tidak punya baris. Filter tenant/row scope,
sorting, pagination, dan limit tetap dipakai. Tidak ada SQL atau expression bebas.

Frontend: Konfigurasi ETL → Analitik & akses → Hasil agregat null. Validasi frontend
menahan konfigurasi hasil nonnumeric; backend tetap sumber validasi. Konfigurasi dan
katalog lama tanpa field ini mempertahankan perilaku PRESERVE. Parameter catalog
menandai semantic.metrics.null_handling supported. Tidak ada migrasi database.

Pada tahap 3, workbook belum menyediakan sel editable null handling (editor tersedia mulai tahap 4 di bawah). Export/import lama mempertahankan
policy konfigurasi server untuk kode metrik yang sama; kode baru/yang diganti memakai
PRESERVE. Pengguna mengatur policy melalui editor konfigurasi lalu menyimpan draft
sebelum export XLSX. Perubahan kolom/agregasi di workbook tetap divalidasi terhadap policy.

Tes compiler menjalankan SQL terstruktur di SQLite terisolasi dan memeriksa guard SQL
PostgreSQL, termasuk null/empty, AVG, tenant/row scope dan default lama. Ini bukan bukti
eksekusi atau konkurensi PostgreSQL nyata. Expression AST, default periode, approval
registry metrik terpisah, dan join masih terbuka.

Bukti tahap 3: 42 tes schema/service/query, 12 tes workbook, 3 tes browser mock,
build/type-check frontend, Ruff pada file perubahan, dan exporter --check 152 operasi
lulus. Tidak ada migrasi/deployment atau integrasi provider nyata yang dijalankan.

## Tahap 4: editor null handling di XLSX

Workbook export terbaru mengaktifkan tab **11 Metric Definitions**, kolom **M**
(`null_handling`), baris 5..204. Pilih PRESERVE atau ZERO_RESULT; sel kosong pada
format baru berarti PRESERVE. ZERO_RESULT tetap dibatasi hasil numerik dan melalui
validasi konfigurasi. Tab 12/13, expression bebas, serta approval Excel tetap tidak aktif.

Export menyertakan marker `metric_null_editor=1` dalam token bertanda tangan.
Workbook lama tanpa marker tetap mempertahankan policy konfigurasi berdasarkan
kode metrik. Kolom M yang diisi pada workbook lama ditolak dengan arahan mengunduh
format terbaru. Header saja tidak mengaktifkan fitur. Formula/error Excel, enum
asing, tipe nonnumeric, serta sel M pada baris tanpa definisi lengkap ditolak.

Frontend memakai alur download ? upload preview ? tinjau diff ? simpan draft.
Payload apply tetap memakai configuration dan preview_token dari preview yang sama;
tidak mengirim approval/deployment otomatis. Panduan kolom M tampil di panel Excel.
Untuk mengedit field ini, unduh workbook baru dari backend tahap 4 terlebih dahulu.
Tidak ada perubahan endpoint, payload apply, atau migrasi database.

Verifikasi tahap 4: 4 tes backend terarah (termasuk round-trip XLSX serialized dan
kompatibilitas lama), 2 tes browser mock, build/type-check, Ruff, serta pemeriksaan
152 operasi API lulus. Tes browser tidak menjalankan backend atau provider nyata.

## Tahap 5: klarifikasi template yang ambigu

Jika pertanyaan cocok persis setelah normalisasi dengan lebih dari satu contoh
query template ACTIVE, backend mengembalikan klarifikasi tanpa memanggil AI atau
mengeksekusi query. Pencarian dilakukan di database, dengan tenant scope, status
ACTIVE dan izin role pada template serta produk. Tidak dibatasi daftar awal 1000
registry template. Hasil diurutkan menurut kode, maksimal 20 kandidat:

```json
{
  "data": [],
  "meta": {
    "query_id": "uuid",
    "clarification_required": true,
    "question": "Pilih template yang dimaksud.",
    "route": "CLARIFICATION",
    "openai_called": false,
    "template_candidates": [
      { "code": "daily_sales", "data_product_code": "SALES" },
      { "code": "monthly_sales", "data_product_code": "SALES" }
    ],
    "template_candidates_more": false
  }
}
```

`template_candidates_more=true` berarti daftar dipotong; pilih produk atau perjelas
pertanyaan. Kandidat hanya memuat kode template/produk, tanpa plan, examples atau data.
Policy tahap ini selalu meminta pilihan, belum mendukung prioritas otomatis.

Frontend Chat menampilkan tombol pilihan. Memilih mengisi pertanyaan asli, produk dan
saved_query_code; belum mengirim query. Tombol Kirim klarifikasi mengirim QuestionRequest
lengkap ke `/nl2sql/clarifications/{query_id}`. Perubahan pertanyaan/produk membuang
pilihan template; response baru/sesi baru juga membuang pilihan. Klarifikasi generik
existing tetap bekerja tanpa saved_query_code.

Pilihan eksplisit diperiksa ulang lewat saved-query lookup: template/produk harus
masih aktif dan diizinkan, semantic_version harus current. TEMPLATE_STALE tetap
memerlukan validasi/aktivasi ulang; kandidat bukan jaminan kesiapan eksekusi. Jika
saved_query_code dan data_product_code berbeda produk, respons
SAVED_QUERY_PRODUCT_MISMATCH (422), tanpa eksekusi. Satu template cocok tetap memakai
INTENT_TEMPLATE; tidak ada kecocokan tetap mengikuti alur AI existing.

Tidak ada migrasi atau endpoint baru. Periode relatif, parameter template, prioritas,
expression AST, dan join multi-product masih terbuka. Tes service/SQL compilation dan
browser menggunakan mock; bukan bukti integrasi PostgreSQL/provider nyata.

## Tahap 6: metadata metrik reviewed

Editor Konfigurasi ETL pada langkah Analitik & akses menyimpan `description`, `unit`,
dan `synonyms` bersama definisi metrik. Sinonim diisi satu per baris. Frontend
menormalisasi whitespace dan menahan duplikasi atau istilah yang mengidentifikasi
metrik lain sebelum PATCH. Setelah deployment, metadata menjadi bagian katalog produk.

Workbook baru memakai tab 11 kolom C untuk definisi bisnis, D untuk sinonim dalam
array JSON, K untuk unit, dan M untuk null handling. Workbook lama mempertahankan
metadata server serta perlu diunduh ulang sebelum kolom baru dapat diedit. Semua hasil
upload tetap melalui preview, simpan draft, review, dan approval aplikasi.

## Tahap 7: default periode metrik

Editor metrik menerima dimensi tanggal dan jumlah hari default 1..3660. Dimension wajib
temporal, publik, dan termasuk semantic dimensions. Backend menerapkan periode menurut
tanggal UTC hanya bila query belum memfilter dimension itu; konflik default beberapa
metrik meminta filter tanggal eksplisit. Respons query mengirim
`meta.default_period_applied` ketika default dipakai.

Workbook terbaru memakai tab 11 kolom I untuk dimension tanggal dan J untuk integer
jumlah hari. Workbook lama mempertahankan nilai server dan harus diunduh ulang sebelum
I/J dapat diedit. Perubahan tetap melewati preview, review, dan approval.

## Tahap 8: filter tetap metrik

Editor metrik mendukung maksimal 10 filter berisi kolom publik, operator allowlist, dan
nilai bertipe. String dapat ditulis langsung; angka/boolean memakai JSON scalar, sedangkan
`in` dan `between` memakai array JSON. Filter diterapkan hanya di dalam agregat metrik;
scope akun dan filter query utama tetap berlaku.

Workbook baru memakai tab 11 kolom H sebagai array JSON filter. Workbook lama
mempertahankan nilai server dan perlu diunduh ulang sebelum H dapat diedit. Tidak ada
input SQL mentah atau expression bebas.

## Tahap 9: visualisasi dinamis

QueryPlan dapat membawa spec tervalidasi untuk table, KPI, bar, line, area, pie, donut,
combo line/bar, scatter, dan heatmap. Series wajib memakai metric output dan axis wajib
memakai dimension output. Backend menolak opsi library atau script bebas dan mengirim
spec yang diterima melalui `meta.visualization`.

Dashboard dan Chat memuat renderer yang sama. Pengguna dapat mengganti jenis, metric,
dimension, judul, dan sumbu kedua sesuai bentuk hasil. Grafik memakai maksimal 100
baris dari halaman hasil; tabel tetap tersedia. Perubahan chart tidak menjalankan ulang
SQL dan spec dapat disimpan bersama saved query template.

## Tahap 10: structured query multi-product

Dashboard memuat `/semantic/join-relationships` dan menawarkan relationship APPROVED
secara bertahap dari produk utama selama kedua produk ada dalam katalog akses pengguna.
Pilihan dikirim melalui `QueryPlan.join_relationships`; dimensi, metrik,
filter, dan sort produk sekunder memakai `PRODUCT.field`.

Ketika relationship dilepas, field sekundernya dibersihkan dari plan. Saved plan lama
tanpa field join dinormalisasi ke array kosong. Error path, relationship stale, PII,
agregasi ambigu, dan default period memiliki arahan pemulihan di client. Backend tetap
menjadi sumber pemeriksaan akses, tenant/row scope, dan cardinality. Backend juga dapat
memberikan graph relationship APPROVED yang aman kepada NL2SQL AI; Chat memakai hasil
dan metadata query existing tanpa kontrol join tambahan. Editor workbook tab 13 belum tersedia.
