# Google Sheet AI — Vue frontend

Frontend Vue 3 + TypeScript untuk backend `../fastapi-googlesheet-ai`, mengikuti
[API Reference](docs/API_REFERENCE.md) dan [panduan review ETL](docs/PANDUAN_REVIEW_ETL.md).

## Menjalankan

Node.js `^22.18.0 || >=24.12.0` diperlukan (setup ini menggunakan 24.18.0).

```powershell
npm.cmd ci
npm.cmd run dev
```

Buka http://localhost:5173. Gunakan `npm.cmd` jika execution policy PowerShell memblokir `npm.ps1`.
Default backend: `http://127.0.0.1:8000`. Untuk menggantinya, salin `.env.example` ke
`.env.local`, sesuaikan nilainya, lalu restart Vite.

```powershell
npm.cmd run build
npm.cmd run preview
npm.cmd run format
npm.cmd test
npm.cmd run test:e2e
```

Build menjalankan type-check dan bundling production. Versi terkunci di `package-lock.json`.
Tes browser menggunakan Microsoft Edge lokal, port 5174, dan API mock; tidak mengakses
Google/OpenAI atau mengubah data backend. Tutup proses lain yang memakai port 5174 sebelum pengujian.

## Halaman aplikasi

| Route                                                | Fitur                                                                                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/masters`                                           | Registry master, kandidat duplikat, draft, submission dan approval                                                    |
| `/masters/:id/storage`                               | Preview/deploy storage dan pencarian record kanonis dengan masking PII                                                |
| `/import-reviews`                                    | Membuat dan menelusuri batch review import                                                                            |
| `/import-reviews/:id`                                | Detail batch, pertanyaan, preview, approval, apply, cancel, revalidate, dan resume                                    |
| `/masters/new`                                       | Definisi master baru dengan policy eksplisit                                                                          |
| `/masters/:id`                                       | Edit definisi, review dan snapshot approved                                                                           |
| `/sources/:sourceId/sheets/:sheetId/master-binding`  | Mapping master dari profil, dry-run dan approval binding                                                              |
| `/sources/:sourceId/sheets/:sheetId/column-bindings` | Binding kolom sumber ke referensi master, review dan approval                                                         |
| `/workspace`                                         | Registrasi sumber, klasifikasi MASTER/NON_MASTER per tab, jadwal UTC, profil dan draft manual/AI                      |
| `/configurations/:id/review`                         | Wizard ETL, jawaban pertanyaan, dry-run, checklist, approval, Excel preview/apply, artifact/diff, deployment/rollback |
| `/jobs?job=UUID`                                     | Polling terbatas dua menit dan dapat dilanjutkan, retry FAILED, jadwal sumber, ETL run, error dan lineage             |
| `/quality`                                           | Daftar issue, resolve dengan catatan, karantina dan reprocess                                                         |
| `/dashboard`                                         | Katalog, query dengan filter/pengurutan, grafik, CSV halaman hasil, laporan, template dan akses produk                |
| `/chat`                                              | NL2SQL, klarifikasi lengkap, feedback, detail request dan promosi template                                            |
| `/admin`                                             | Buat/atur pengguna dan row scope, audit, estimasi penggunaan AI                                                       |
| `/account`                                           | Ubah password dan login ulang                                                                                         |

Login tersedia di halaman yang memerlukan sesi. Menu dan pemuatan data mengikuti role;
otorisasi akhir tetap diperiksa backend. Analyst/viewer dapat masuk langsung melalui `/dashboard`.

## Stack

| Kebutuhan       | Library / konfigurasi                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| Styling         | Tailwind CSS 4 + `@tailwindcss/vite`, tema CSS di `src/assets/main.css`               |
| PostCSS         | Dependency eksplisit, `postcss.config.js` untuk plugin tambahan                       |
| Ikon            | `@lucide/vue`, import per komponen                                                    |
| Font            | `@fontsource-variable/inter`, variable font disajikan lokal                           |
| Grafik          | `apexcharts` + `vue3-apexcharts`, contoh di `src/components/charts/ActivityChart.vue` |
| API             | Axios, helper di `src/lib/api.ts`                                                     |
| Routing / state | Vue Router dan Pinia                                                                  |
| Format          | Prettier + `prettier-plugin-tailwindcss` untuk pengurutan class                       |

Tailwind memakai plugin Vite sesuai [dokumentasi resmi](https://tailwindcss.com/docs/installation/using-vite).
Tema memakai `@theme`. PostCSS tidak menjalankan Tailwind lagi; Tailwind 4 menangani import dan vendor
prefix sehingga Autoprefixer tidak diperlukan. Referensi lainnya:
[Lucide Vue](https://lucide.dev/guide/vue),
[Fontsource](https://fontsource.org/docs/getting-started/install),
[ApexCharts Vue 3](https://github.com/apexcharts/vue3-apexcharts).

## Kontrak backend

Setup mengacu pada README, `app/main.py`, dan schema backend lokal.

- Prefix API `/api/v1`; envelope JSON `{ status, data, meta, errors }`.
- Login `POST /api/v1/auth/login` dengan JSON `{ tenant_code, username, password }`.
- Login memasang kedua token melalui `setSession(tokens)`. Token hanya berada di memori;
  reload penuh memerlukan login ulang. Refresh satu kali bersama untuk request 401 yang bersamaan,
  menyimpan pasangan token hasil rotasi. Gagal refresh menghapus sesi. Respons dari sesi lama diabaikan.
- Logout/change-password mencabut seluruh token akun sesuai kontrak backend.
  `clearSession()` menghapus token dan state pengguna lokal.
- Contoh request: `api.get<ApiEnvelope<T>>('/sources')`; envelope ada di `response.data`.
- Gunakan `getApiErrorMessage(error)` untuk pesan error backend/network.
- Tombol **Periksa koneksi** memanggil `/health/live` tanpa token, di luar prefix API.
  Liveness tidak membuktikan kesiapan PostgreSQL, Redis, atau autentikasi.
- Proxy development meneruskan `/api` dan `/health` ke `API_PROXY_TARGET`.
  Port 5173 tetap sesuai default CORS backend `http://localhost:5173`.

Grafik halaman utama tetap demonstrasi berlabel. Grafik `/dashboard` menggunakan hasil query API.
Form query tidak mengirim SQL bebas. Ekspor mengikuti limit/offset/scope dari query yang ditampilkan,
bukan seluruh dataset. Tidak ada retry otomatis mutation timeout atau query AI.

Storage BE04: [Frontend storage master](docs/FRONTEND_BE04.md).

Implementasi BE02/BE03: [Klasifikasi dan registry master BE02/BE03](docs/FRONTEND_BE02_BE03.md).

Panduan cakupan, batasan, dan rollout: [Implementasi frontend](docs/IMPLEMENTASI_FRONTEND.md).

## Production

Proxy Vite hanya berlaku saat development. Untuk production/preview, sediakan reverse proxy `/api`
dan `/health`, atau isi `VITE_API_ORIGIN=https://api.example.com` sebelum build dan izinkan origin frontend
pada CORS backend. Hosting SPA perlu fallback ke `index.html` untuk route Vue Router.
`VITE_API_BASE_PATH` default `/api/v1` dan harus diawali `/`.

Variabel `VITE_*` dapat dibaca browser. Kredensial Google/OpenAI, JWT secret, dan database tetap di backend.
