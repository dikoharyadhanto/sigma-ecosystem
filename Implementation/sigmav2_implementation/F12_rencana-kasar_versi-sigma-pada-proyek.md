# F12 - Versi Sigma pada identitas proyek dan peringatan "outdated"

Tanggal: 7 Oktober 2026 (rencana kasar); detail disusun 15 Oktober 2026
Status: DIIMPLEMENTASIKAN pada master 15 Oktober 2026 (belum di-commit). O-1 sampai O-9 disetujui Director sesuai rekomendasi; otorisasi eksekusi diberikan Director. Hasil dan batas pada bagian 11. Distribusi ke `~/.sigma` dan proyek tetap F09 dan tindakan Director.
Urutan: setelah F10 (ter-commit f223c00), sebelum finalisasi Protocol/keputusan review Constitution dan F09.
Basis pemeriksaan: repositori master Sigma, branch `main`, HEAD f223c00, pemeriksaan baca saja 15 Oktober 2026.
Sumber: permintaan Director 7 Oktober 2026. Butir T-20 sampai T-24 ada di [F00](F00_indeks-dan-register.md) bagian 5.
Nama berkas dipertahankan agar tautan di F00 tidak putus.

## 1. Tujuan dan batas

Tujuan (TERKUNCI, permintaan Director):

1. Identitas proyek mencatat versi Sigma yang diterapkan pada proyek tersebut.
2. Bila versi Sigma yang terpasang berbeda dengan versi proyek, operasi Sigma di dalam proyek menampilkan peringatan bahwa proyek usang dan harus disinkronkan.

Di luar batas F12: sinkronisasi nyata ke `~/.sigma` atau proyek (F09), perubahan Constitution, perubahan Protocol (dicatat pada bagian 8, diterapkan pada tahap akhir), perubahan `SCHEMA_VERSION`.

## 2. Fakta terverifikasi (15 Oktober 2026, HEAD f223c00)

Koreksi terhadap rencana kasar 7 Oktober, ditandai **[BERUBAH]**:

- **[BERUBAH]** `package.json` dan `SIGMA_VERSION` ([config.ts:4](../../src/config.ts)) sama-sama `2.0.0`. Rencana kasar menyebut 1.0.0. Dua salinan nilai ini dipelihara manual; belum ada tes yang memastikan keduanya sama.
- CHANGELOG bagian `[Unreleased]` memuat banyak perubahan (F08, F10, F17, dan lain-lain) di bawah versi `2.0.0` yang sama. Versi semver saja tidak membedakan keadaan aset, sehingga alasan T-20 (stempel kedua berupa hash isi) tetap berlaku.
- Identitas proyek `.sigma-identity.json`: `schema_version`, `project_id`, `project_name`, `registered`, `logs_created_at`, ditambah catatan workspace DEV ([project.ts:155-215](../../src/commands/project.ts)). Ditulis oleh `writeProjectIdentity` dengan read-merge-write; field yang tidak dimiliki fungsi itu bertahan. Dipanggil dari `project start` (baris 369) dan `project register` (baris 633). `project sync` tidak menyentuh identitas.
- `schema_version` identitas adalah `SCHEMA_VERSION` 1.2.0, versi skema data, bukan versi produk.
- Sisi global: `~/.sigma/sigma.config.json` memuat `schema_version`, `cli_version`, `installed_at`. Dibuat hanya bila belum ada (`setup install`, [setup.ts:156-162](../../src/commands/setup.ts)); `setup update` hanya menimpa `cli_version` (baris 487-493). Paket CLI hidup lewat symlink, sehingga `cli_version` di berkas global dapat tertinggal dari paket.
- **[BERUBAH]** `project sync` sudah tidak menimpa tanpa pembanding. F01 menambahkan pratinjau per berkas, status `SAME/MISSING/DIFF/UNSAFE`, token `--accept` per berkas DIFF, dan cadangan sebelum penggantian ([assetConsistency.ts](../../src/services/assetConsistency.ts), [project.ts:542-570](../../src/commands/project.ts)). Tahap 6 rencana kasar (cadangan otomatis) sudah terpenuhi dan dihapus dari F12.
- **[BERUBAH]** Hook lintas-perintah sudah ada: `program.hook('preAction', ...)` di [cli.ts:88](../../src/cli.ts) untuk log operasi, dengan `commandPath()` untuk nama perintah. F12 menambah hook di tempat yang sama, bukan menciptakan mekanisme baru.
- Pembanding hash sudah ada dan dapat dipakai ulang: `sha256File`, `managedProjectAssets(projectRoot)` (sumber host + bundel master → target proyek), `masterToHost()`, `inspectAsset`, dan `inspectAssetDrift` (laporan baca saja untuk `doctor --check-assets`). Sebagian sumber `managedProjectAssets` berasal dari `~/.sigma` (rules, templates, governance) dan sebagian dari bundel master (registry, role-memory).
- `findProjectRoot()` melempar galat di luar proyek; hook harus menangkapnya (pola yang sama dipakai `appendOperationLogEntry`).
- Saluran peringatan MCP sudah ada: `buildBootstrapView().compatibilityWarnings` ([bootstrapView.ts:55-59](../../src/session/bootstrapView.ts)) dipakai oleh `sigma session bootstrap` dan dikembalikan oleh `sigma_get_orientation` sebagai `compatibility_warnings`. Peringatan versi dapat masuk lewat saluran ini tanpa bidang respons baru.
- Semua teks keluaran CLI/MCP yang ada berbahasa Inggris; peringatan baru mengikutinya.

## 3. Model tiga lapis

```text
master (paket CLI, symlink; SIGMA_VERSION + bundel Sigma/ dan setup/)
   |  sigma setup update
host (~/.sigma: governance, rules, templates, bridge, sigma.config.json)
   |  sigma project sync --confirm
proyek (Sigma/, .sigma-identity.json)
```

Dua tingkat kedaluwarsa (T-21):

| Tingkat | Kondisi | Langkah yang benar |
|---|---|---|
| L1 host usang | hash set host-managed pada stempel host berbeda dari hash bundel master saat ini | `sigma setup update` |
| L2 proyek usang | hash pada stempel proyek berbeda dari hash set sumber proyek saat ini, atau stempel tidak ada | `sigma project sync` (pratinjau), lalu `--confirm` dengan token |

Urutan evaluasi: L1 lebih dulu. Bila host usang, menyarankan `project sync` menyalin aset usang ke proyek; itu persis hazard T-19. Maka L1 menekan L2 sampai host diperbarui.

## 4. Spesifikasi perilaku

### 4.1 Stempel

Identitas proyek menambah satu objek (nama tentatif):

```json
"sigma_applied": { "sigma_version": "2.0.0", "assets_hash": "sha256:...", "synced_at": "<ISO>" }
```

`sigma.config.json` global menambah `assets_hash` dan `synced_at` (field `cli_version` dipertahankan).

`assets_hash` = SHA-256 atas daftar terurut `label + NUL + sha256(isi)` dari pasangan aset terkelola pada sisi yang dibandingkan: untuk host, pasangan `masterToHost()`; untuk proyek, pasangan `managedProjectAssets()`. Label mencegah dua berkas bertukar isi menghasilkan hash sama.

### 4.2 Kapan stempel ditulis

Satu helper `stampIfCurrent(projectRoot)`: hitung pasangan aset, **tulis stempel hanya bila seluruh pasangan berstatus SAME**. Stempel dengan demikian benar menurut konstruksi: ia menyatakan "pada `synced_at`, seluruh aset terkelola identik dengan sumbernya".

- `project start`, `project register`, `project sync --confirm` memanggil helper setelah operasinya selesai. `sync --confirm` memanggilnya juga bila tidak ada perubahan (proyek lama yang sudah identik mendapat stempel tanpa perlu doctor).
- DIFF yang tidak diterima membuat helper tidak menulis; stempel lama (atau ketiadaannya) tetap, dan laporan sisa DIFF tetap dicetak oleh sync.
- `setup install/update` menulis stempel host (hash atas `masterToHost()` setelah penyalinan).
- `sigma doctor` dan `doctor --check-assets` tetap baca saja; `--check-assets` ditambah baris status versi.

### 4.3 Peringatan

- CLI: hook `preAction` mencetak **satu baris ke stderr** bila berada di dalam proyek dan salah satu tingkat berlaku. Contoh: `Sigma: ~/.sigma is behind the installed CLI (2.0.0). Run: sigma setup update` dan `Sigma: this project was last synced at an unknown or older asset version. Run: sigma project sync`.
- Dikecualikan: `setup *`, `project sync|register|start`, `doctor`, bantuan/`--version`, dan `session bootstrap` (yang memakai `compatibilityWarnings`, lihat berikut agar tidak ganda). Di luar proyek: tidak ada keluaran, tidak ada galat.
- MCP: peringatan masuk `compatibilityWarnings` pada `buildBootstrapView`, sehingga `sigma session bootstrap` dan `sigma_get_orientation` mendapatkannya dari satu titik. `sigma_get_orientation` ditambah objek `version_status` terstruktur (tingkat, versi proyek, versi terpasang) agar agen tidak perlu mengurai teks.
- Proyek tanpa stempel dianggap "versi tidak diketahui" (T-24) dan memakai pesan L2.

### 4.4 Kasus tepi

| Kasus | Perilaku |
|---|---|
| `sigma.config.json` hilang atau tanpa stempel host | L1 "unknown"; langkah `sigma setup update` |
| Identitas proyek rusak/tidak terbaca | tanpa peringatan versi; galat identitas ditangani jalur yang ada |
| Aset proyek diedit manual sesudah sinkronisasi | stempel tetap lama; peringatan versi tidak muncul. Penyimpangan lokal tampak lewat `doctor --check-assets` (batas O-2) |
| Sinkronisasi parsial (sebagian DIFF ditolak) | stempel tidak ditulis; peringatan tetap |
| Perintah gagal sebelum hook | tanpa peringatan; hook hanya berjalan sebelum aksi |
| Hash gagal dihitung (berkas sumber hilang) | peringatan dilewati dengan diam; tidak boleh menggagalkan perintah |

## 5. Peta dampak kode

| Berkas | Perubahan |
|---|---|
| `src/services/assetConsistency.ts` | fungsi `computeAssetsHash(pairs)`, `stampIfCurrent`, `evaluateVersionStatus(projectRoot)` (mengembalikan tingkat + versi) |
| `src/commands/project.ts` | `start`, `register`, `runSync`: panggil `stampIfCurrent`; `ProjectIdentity` bertambah `sigma_applied?`; pratinjau sync menyebut bahwa stempel akan ditulis |
| `src/commands/setup.ts` | `install` dan `update` menulis stempel host; seed config memuat `assets_hash`, `synced_at` |
| `src/cli.ts` | hook `preAction` kedua (atau perluasan yang ada) untuk peringatan; daftar pengecualian |
| `src/session/bootstrapView.ts` | tambah peringatan versi ke `compatibilityWarnings` dan keluarkan `versionStatus` |
| `src/mcp/tools/orientation.ts` | tambah `version_status` |
| `src/commands/doctor.ts` | `--check-assets` melaporkan status versi (baca saja) |
| `test/f12-version-stamp.test.ts` (baru) | lihat bagian 7 |
| `README.md` | alur setup update, project sync, arti peringatan |
| `dist/` | build; dilacak Git; berdampak ke sigma-mcp seluruh host |

## 6. Keputusan terbuka

Format: pertanyaan, rekomendasi dan alasan, jawaban Director. Butir T-20 sampai T-24 di F00 menjadi dasar; O-3 menyimpang dari T-24 dan disorot.

| ID | Pertanyaan | Rekomendasi | Jawaban Director |
|---|---|---|---|
| O-1 | Pembanding versi: dua nilai `sigma_version` + `assets_hash` (T-20)? | Ya. Versi saja tidak cukup (bagian 2: banyak perubahan di bawah 2.0.0). Tambah tes yang memastikan `package.json` dan `SIGMA_VERSION` sama, karena keduanya dipelihara manual | DISETUJUI sesuai rekomendasi (Director, 15 Oktober 2026) |
| O-2 | Dasar deteksi usang: (A) membandingkan stempel dengan hash sumber, atau (B) drift langsung tiap operasi (`inspectAssetDrift`)? | A. Murah, deterministik, sesuai permintaan "versi pada identitas". B lebih jujur terhadap penyimpangan lokal tetapi menandai proyek yang sengaja menolak DIFF sebagai usang selamanya, dan lebih berat. Batas A (edit manual setelah sync tidak terdeteksi oleh peringatan) diterima; `doctor --check-assets` tetap menjadi sumber kebenaran | DISETUJUI sesuai rekomendasi (Director, 15 Oktober 2026) |
| O-3 | Siapa menulis stempel proyek? F00 T-24 merekomendasikan `sigma doctor`. | `stampIfCurrent` dipanggil oleh `start`, `register`, dan `sync --confirm`, hanya saat seluruh aset SAME; `doctor` tetap baca saja. Alasan: doctor default saat ini diagnosis; membuatnya menulis state menyamarkan batas baca-saja `--check-assets` dan menambah jalur penulisan identitas tanpa gerbang. Proyek lama cukup menjalankan `sync --confirm` sekali. **Menyimpang dari T-24; perlu keputusan eksplisit.** | DISETUJUI sesuai rekomendasi (Director, 15 Oktober 2026) |
| O-4 | Bentuk penyimpanan dan versi skema | Objek `sigma_applied` pada identitas dan dua field pada `sigma.config.json`; aditif; **`SCHEMA_VERSION` tidak dinaikkan** (kenaikan dilarang tanpa instruksi Director dan tidak diperlukan: pembaca lama mengabaikan field asing) | DISETUJUI sesuai rekomendasi (Director, 15 Oktober 2026) |
| O-5 | Dua tingkat dan prioritas (T-21): L1 menekan L2? | Ya, dengan pesan yang menyebut perintah yang benar. Menyarankan `project sync` saat host usang melanggar syarat urutan T-19 | DISETUJUI sesuai rekomendasi (Director, 15 Oktober 2026) |
| O-6 | Cakupan CLI (T-22): satu baris stderr, kecuali daftar pengecualian bagian 4.3; `session bootstrap` lewat `compatibilityWarnings`; tanpa saklar mematikan | Ya. Satu baris dan stderr membatasi tambahan konteks sesi AI. Saklar ditunda sampai ada keluhan nyata | DISETUJUI sesuai rekomendasi (Director, 15 Oktober 2026) |
| O-7 | MCP: peringatan lewat `compatibility_warnings` ditambah objek terstruktur `version_status` pada orientasi; `sigma_get_state` tidak diubah | Ya. Satu titik implementasi bersama CLI; paritas lanjutan menjadi bagian F09 | DISETUJUI sesuai rekomendasi (Director, 15 Oktober 2026) |
| O-8 | Dampak peluncuran: begitu build F12 dipakai, setiap proyek nyata menampilkan peringatan "tidak diketahui" sampai Director menjalankan `setup update` lalu `project sync --confirm` per proyek | Diterima sebagai perilaku yang dimaksud (T-24). Tidak ada penulisan otomatis ke proyek; distribusi tetap F09 dan tindakan Director | DISETUJUI sesuai rekomendasi (Director, 15 Oktober 2026) |
| O-9 | Perubahan Protocol dan dokumentasi | README diperbarui di F12; perubahan Protocol dicatat pada bagian 8 dan diterapkan pada tahap Protocol akhir (aturan kerja Director) | DISETUJUI sesuai rekomendasi (Director, 15 Oktober 2026) |

## 7. Strategi uji dan kriteria selesai

Berkas baru `test/f12-version-stamp.test.ts` (memakai `setupTestEnv`, `runCli`, `HOME` sementara; tanpa menyentuh `~/.sigma` nyata):

1. `computeAssetsHash` stabil terhadap urutan, berubah bila satu byte atau satu label berubah.
2. `project start` menulis `sigma_applied` ketika aset identik; `register` pada identitas lama menambah stempel hanya bila SAME.
3. `sync` dry-run tidak menulis; `sync --confirm` menulis stempel; DIFF yang tidak diterima tidak menulis stempel; sync tanpa perubahan pada proyek lama menulis stempel.
4. `setup update` menulis stempel host; `cli_version` tetap diperbarui.
5. Peringatan L1, L2, dan "tidak diketahui" muncul pada perintah biasa (stderr, satu baris); L1 menekan L2; tidak muncul pada perintah yang dikecualikan dan di luar proyek.
6. `session bootstrap` dan `sigma_get_orientation` memuat peringatan dan `version_status`; tidak ganda dengan hook.
7. Kegagalan hash (sumber hilang) tidak menggagalkan perintah.
8. `package.json` version sama dengan `SIGMA_VERSION`.
9. Regresi: `operation-log`, `f01-asset-consistency`, `mcp-tools`, `session` lulus tanpa perubahan.

Kriteria selesai: `tsc` bersih, suite penuh hijau (baseline 80 berkas / 1.278 tes), `dist/` dibangun dan dilaporkan sebelum commit, hasil dan batas dicatat di dokumen ini (bagian 9).

## 8. Butir perubahan Protocol (dicatat, belum diterapkan)

1. Perintah `sigma project sync --confirm` menulis stempel versi bila seluruh aset terkelola identik.
2. Arti dan tindak lanjut dua tingkat peringatan (L1/L2) serta urutan `setup update` sebelum `project sync`.
3. Bidang `sigma_applied` pada identitas proyek dan `assets_hash`/`synced_at` pada `sigma.config.json`.

## 9. Risiko dan dependensi

| Risiko | Mitigasi |
|---|---|
| Stempel dianggap bukti kebenaran padahal berkas diedit sesudah sync | batas dinyatakan (O-2, bagian 4.4); `doctor --check-assets` sebagai sumber kebenaran; teks peringatan menyebut "last synced", bukan "identical" |
| Hook menambah biaya dan teks pada setiap operasi | hash dua set kecil (puluhan berkas) per proses; satu baris stderr; pengecualian daftar tetap |
| Build mengubah perilaku `sigma-mcp` di seluruh host (symlink, `dist/` dilacak) | build dilaporkan dahulu; commit hanya atas instruksi Director |
| Peringatan mendorong distribusi tanpa klasifikasi drift (T-23) | pesan L2 mengarah ke pratinjau `sigma project sync` (tanpa `--confirm`), bukan langsung menimpa |
| Ketergantungan F09 | F09 memakai stempel F12 sebagai dasar deteksi, bukan mekanisme terpisah; syarat urutan T-19 tetap berlaku |

## 10. Urutan langkah implementasi (setelah O-1 sampai O-9 ditutup)

| Gelombang | Isi |
|---|---|
| W0 | baseline: `git status`, suite penuh, `tsc` |
| W1 | `computeAssetsHash`, `stampIfCurrent`, `evaluateVersionStatus` + tes unit |
| W2 | stempel pada `setup install/update`, `project start/register/sync` + tes |
| W3 | hook `preAction` dan pengecualian + tes |
| W4 | `compatibilityWarnings`, `version_status` MCP, `doctor --check-assets` + tes |
| W5 | README, catatan Protocol, build `dist/`, suite penuh, catat hasil pada bagian 9 dokumen ini dan F00 |

## 11. Hasil eksekusi (15 Oktober 2026)

Dieksekusi W0-W5 sesuai bagian 10 pada master. Belum di-commit; tidak ada push.

| Gelombang | Hasil |
|---|---|
| W0 | Baseline HEAD f223c00: `tsc` bersih, 80 berkas / 1.278 tes hijau |
| W1 | [assetConsistency.ts](../../src/services/assetConsistency.ts): `computeAssetsHash`, `stampProjectIfCurrent`, `stampHostIfCurrent`, `evaluateVersionStatus` (mengembalikan `null` bila status tidak dapat ditentukan; tidak pernah melempar) |
| W2 | `setup install/update` menulis stempel host; `project start/register/sync --confirm` menulis `sigma_applied`; dry run `sync` menyebut stempel; penulisan atomik tmp+rename |
| W3 | Hook `preAction` kedua di [cli.ts](../../src/cli.ts): satu baris stderr; pengecualian `setup`, `doctor`, `project start/register/sync`, `session bootstrap`; di luar proyek senyap |
| W4 | `buildBootstrapView` menambah `versionStatus` dan memasukkan pesan ke `compatibilityWarnings`; `sigma_get_orientation` menambah `version_status`; `doctor --check-assets` melaporkan status versi (baca saja) |
| W5 | README (bagian migrasi dan stempel), CHANGELOG, `dist/` dibangun; `tsc` bersih; suite penuh 81 berkas / 1.296 tes hijau (+1 berkas, +18 tes) |

Catatan eksekusi dan batas:

- Dua tes lama di [chain-numbering.test.ts](../../test/chain-numbering.test.ts) menegaskan isi persis `compatibilityWarnings`. Karena pesan versi berbagi saluran itu (O-7) dan bergantung pada keadaan `~/.sigma` mesin, tes tersebut kini menyaring pesan berawalan `Sigma:`. Ini perubahan tes, bukan perubahan perilaku penomoran.
- Peringatan hanya melihat stempel. Edit manual pada berkas proyek setelah sinkronisasi tidak memicu peringatan (O-2, diterima); `doctor --check-assets` menampilkannya.
- Pembanding memakai `sigma_version` ATAU `assets_hash`: kenaikan `SIGMA_VERSION` tanpa perubahan aset tetap menandai usang sampai `setup update` / `project sync --confirm` dijalankan sekali.
- Semua tes memakai `HOME` dan proyek sementara; `~/.sigma` nyata tidak dibaca atau ditulis oleh eksekusi ini.
- `dist/` dibangun dan terpasang lewat symlink: `sigma-mcp` di host ini sudah memuat perilaku baru. `~/.sigma` nyata belum berstempel, sehingga setiap proyek nyata menampilkan peringatan "global installation ... no version stamp" sampai Director menjalankan `sigma setup update`, lalu `sigma project sync --confirm` per proyek (O-8).
- Butir Protocol pada bagian 8 belum diterapkan (tahap Protocol akhir).
