# F12 - Versi Sigma pada identitas proyek dan peringatan "outdated" (rencana kasar)

Tanggal: 7 Oktober 2026
Status: RENCANA KASAR. Detail disusun saat F12 mulai dikerjakan. Belum ada kode, konfigurasi, atau state yang diubah.
Sumber: permintaan Director 7 Oktober 2026. Keputusan terbuka T-20 sampai T-24 ada di [F00](F00_indeks-dan-register.md) bagian 5.

## 1. Tujuan

1. Identitas proyek mencatat versi Sigma yang diterapkan pada proyek tersebut.
2. Bila versi Sigma yang terpasang di perangkat berbeda dengan versi proyek, setiap operasi Sigma di dalam proyek menampilkan peringatan bahwa proyek sudah usang dan harus disinkronkan.

## 2. Fakta terverifikasi (read-only, 7 Oktober 2026)

- Identitas proyek adalah `.sigma-identity.json` di root proyek: `schema_version`, `project_id`, `project_name`, `registered: true`, `logs_created_at` ([project.ts](../../src/commands/project.ts) baris 149-199). `schema_version` adalah versi skema data (1.2.0), bukan versi produk. Tidak ada bidang versi Sigma yang diterapkan.
- Sisi global: `~/.sigma/sigma.config.json` memuat `cli_version` dan `installed_at`, diisi oleh `sigma setup install/update`. Paket CLI hidup lewat symlink, sehingga dapat lebih baru daripada isi `~/.sigma`.
- Perintah yang ada: `sigma project sync [--confirm]` (dry-run tanpa `--confirm`), `sigma setup update`, `sigma project register`, `sigma doctor`. Nama yang benar adalah `sigma project sync`, bukan `sigma sync`.
- `runSync` menimpa rules, templates, registry, role-memory, dan konfigurasi MCP tanpa perbandingan versi atau isi (`overwrite: true`).
- [cli.ts](../../src/cli.ts) hanya memasang subperintah; belum ada hook lintas-perintah. Commander mendukung hook `preAction`.
- `package.json` masih versi 1.0.0 walaupun CHANGELOG memuat banyak perubahan di bagian Unreleased.

## 3. Rencana kasar

| Tahap | Isi | Catatan |
|---|---|---|
| 1 | Putuskan T-20 sampai T-24 | Rekomendasi tercatat di F00 |
| 2 | Stempel pada identitas proyek (`sigma_version`, `assets_hash`, `synced_at`) dan pada `sigma.config.json` global; kompatibel dengan identitas lama tanpa stempel | Perubahan bentuk berkas; `schema_version` identitas dipertimbangkan naik |
| 3 | `sigma setup install/update` menulis stempel global; `sigma project start/sync --confirm/register` menulis stempel proyek | Menyentuh `setup.ts` dan `project.ts` |
| 4 | Hook peringatan lintas-perintah (`preAction`) pada CLI: satu baris ke stderr, menyebut perintah yang benar sesuai tingkat kedaluwarsa, tidak muncul di luar proyek | Perintah `setup`, `project sync/register/start`, `doctor`, dan bantuan dikecualikan |
| 5 | Peringatan di sigma-mcp: bidang peringatan pada respons orientasi dan status | Berkaitan dengan paritas CLI/MCP di F09 |
| 6 | `sigma project sync`: cadangan otomatis dan laporan berkas yang berubah sebelum menimpa | Menjawab T-23 dan T-18 |
| 7 | `sigma doctor`: mengisi stempel pada proyek lama setelah sinkronisasi berhasil; melaporkan status versi | T-24 |
| 8 | Test: stempel ditulis dan dibaca, peringatan muncul/tidak muncul sesuai kondisi, proyek tanpa stempel, perintah yang dikecualikan, sinkronisasi dengan cadangan | |
| 9 | Dokumentasi: README, protocol (perintah dan alur sinkronisasi), skill/orientasi bila menyebut sinkronisasi | Terkoordinasi dengan F09 |

## 4. Dependensi dan catatan

- Berkaitan dengan F09 (sinkronisasi ke proyek) dan T-18/T-19 (versi aturan, syarat urutan sinkronisasi). F09 sebaiknya memakai stempel F12 sebagai dasar deteksi, bukan membuat mekanisme terpisah.
- Perubahan kode di sini ikut disiplin build: setiap build mengubah perilaku sigma-mcp di seluruh host.
- Peringatan pada setiap operasi menambah teks pada konteks sesi AI. Satu baris singkat dan stderr dipilih untuk membatasi dampak.
