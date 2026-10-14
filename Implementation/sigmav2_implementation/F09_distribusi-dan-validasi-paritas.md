# F09 - Distribusi aset dan validasi paritas CLI/MCP, chain lama/baru

Tanggal: 15 Oktober 2026
Status: DIEKSEKUSI 15 Oktober 2026 (F09a-F09d). O-1 sampai O-9 disetujui Director sesuai rekomendasi. Perubahan kode master belum di-commit; host dan ketiga proyek nyata sudah berstatus `current`. Hasil pada bagian 8.
Urutan: fokus terakhir pada urutan yang diterima Director (F17 → F10 → F12 → F18 → F09).
Basis: repositori master, branch `main`, HEAD 79231bb (F18 ter-commit dan di-push), 15 Oktober 2026.

## 1. Tujuan dan batas

Tujuan: membawa keadaan master (F01 sampai F18) ke `~/.sigma`, skill terpasang pada semua target, dan proyek nyata, tanpa kehilangan pekerjaan lokal, serta memverifikasi paritas CLI/MCP dan pembacaan chain lama dan baru.

Batas: setiap langkah yang menulis ke `~/.sigma`, direktori skill, atau proyek nyata dijalankan atas instruksi eksplisit Director per langkah. Dokumen ini tidak mengotorisasi satu pun.

## 2. Fakta terverifikasi

### 2.1 Host `~/.sigma`

| Fakta | Nilai |
|---|---|
| `cli_version` pada `sigma.config.json` | 1.0.0, dipasang 12 September 2026, tanpa stempel F12 |
| Berkas governance/rules/templates/bridge berbeda dari master | 18 |
| Dari yang berbeda: identik dengan versi lama yang pernah di-commit | 18 (tidak ada edit lokal) |
| Berkas di host yang tidak lagi ada di master | 4 template HUMAN (`DIR-INTENT-HUMAN`, `DIR-CLOSE-HUMAN`, `PLAN-EXEC-HUMAN`, `HUMAN-FIDELITY-LEDGER`), sisa F14 |
| `notion.credentials.json` | masih ada di `~/.sigma/` (isi tidak dibaca). Handoff 7 Oktober menyatakan kredensial dicabut dan dihapus |
| Cadangan sebelumnya | satu, 18 September 2026 |

### 2.2 Skill terpasang

| Target | Terpasang | Berbeda dari master | Berkas usang tanpa padanan di master |
|---|---|---|---|
| Claude Code (`~/.claude/commands`) | ya | 9, semua versi lama | `checkpoint.md`, `cso.md` |
| Codex (`~/.codex/skills`) | ya | 12 | `checkpoint/`, `cso/` |
| Reasonix (`~/.reasonix/skills`) | ya | 9 | `checkpoint.md`, `cso.md` |
| Antigravity (`~/.gemini/config/skills`) | ya | 12 | tidak ada |
| opencode (`~/.config/opencode`) | direktori ada (`AGENTS.md`, `opencode.jsonc`, `package.json`) | skill/command/plugin **belum pernah dipasang** | - |

Seluruh 42 selisih adalah versi lama yang pernah di-commit; tidak ada edit lokal. Entri `sigma-mcp` sudah ada pada konfigurasi Codex, Antigravity, dan Reasonix.

### 2.3 Proyek nyata (tiga)

| Proyek | Chain | Lifecycle / numbering | Draft terbuka | Pohon kerja Git | Mailbox |
|---|---|---|---|---|---|
| swm_standalone_v2 | v1 (BUILD) | `legacy_lock`, `legacy_offset` | EXEC v0.1 | bersih | 14 pesan, 1 UNREAD; migrasi **berhasil** pada gladi |
| KLHK_JasaLingkunganHidup | v1-v6 (v1 CLOSED) | `legacy_lock`, `legacy_offset` | EXEC v1.7, v3.4, v3.11, v4.4 | 6 path berubah | 368 pesan, 8 UNREAD; **1 berkas yatim** |
| CanopySense | v1-v5 | `legacy_lock`, `legacy_offset` | INTENT v1 (DRAFT), PLAN v4.6 | 1 path tak terlacak, cabang `feat/sembawa-stl-gcc-pilot` | 85 pesan terindeks, 6 UNREAD; **156 berkas yatim** |

Seluruhnya: tanpa `lifecycle_model` dan `versioning_scheme` (dibaca sebagai legacy dengan peringatan), tanpa stempel versi, mailbox format lama, tanpa workspace `dev/`, tanpa `CHANGE-RECORD.md`, role memory `unversioned`. Selisih aset terhadap host semuanya versi lama yang pernah di-commit, kecuali `AGENTS.md` bridge milik KLHK (suntingan lokal).

### 2.4 Hasil baca saja dan gladi bersih

- **Paritas baca (TERVERIFIKASI):** `sigma_get_orientation` dan `sigma_doctor` (report-only) membaca ketiga proyek tanpa galat. Status pohon Git dan berkas `Sigma/` tidak berubah. Hasil: `legacy_lock`, `legacy_offset`, `mailbox: migration_required`.
- **Gladi bersih** pada salinan (`setup update` lalu `project sync --confirm` dengan seluruh token, lalu `doctor --migrate-mailbox`):

| Langkah | swm | KLHK | CanopySense |
|---|---|---|---|
| `setup update` (host) | berhasil, stempel host tertulis | - | - |
| `project sync --confirm` | berhasil, stempel proyek tertulis (hash sama pada ketiganya) | berhasil | berhasil |
| `doctor --migrate-mailbox` | **berhasil** | **ditolak**: 1 berkas yatim | **ditolak**: 156 berkas yatim |
| `check` draft lama dengan template baru (INTENT schema 4, PLAN dan EXEC schema 2) | lolos | lolos | tidak dijalankan |
| `doctor --migrate-lifecycle --dry-run` | menawarkan konversi, butuh review baseline | sama | tidak dijalankan |

## 3. Temuan yang menghalangi atau berbahaya

| ID | Temuan | Dampak |
|---|---|---|
| H1 | Sync sebelum `setup update` menyalin aset host yang usang ke proyek | Urutan wajib: host dahulu |
| H2 | `setup update` menimpa tetapi tidak menghapus; `project sync` membaca daftar berkas dari `~/.sigma/templates/` | Empat template HUMAN usang ikut disalin ke proyek (terbukti pada gladi swm) |
| H3 | `checkpoint` dan `cso` terpasang pada tiga target dan tidak pernah dibersihkan | Skill usang mengacu ke CSO yang sudah dihapus |
| H4 | Berkas pesan yatim memblokir `--migrate-mailbox` (keputusan F03 O-6/O-7: menolak). Selama belum bermigrasi, `sigma send` dan `memo write` ditolak | KLHK dan CanopySense **sudah tidak dapat mengirim pesan saat ini**, terlepas dari sinkronisasi |
| H5 | File bridge proyek (`CLAUDE.md`, `AGENTS.md`, dan lain-lain) tidak termasuk himpunan terkelola `project sync` | Bridge proyek tetap memuat teks lama (nama berprefix, "PLAN is LOCKED"); KLHK punya suntingan lokal pada `AGENTS.md` |
| H6 | `setup update` pertama kali akan memasang command dan plugin opencode serta hook ke `~/.config/opencode` | Efek samping baru pada konfigurasi opencode Director; smoke test F16 U-09 belum pernah dijalankan |
| H7 | `SIGMA_VERSION` masih 2.0.0 sementara CHANGELOG `Unreleased` mencakup F01 sampai F18 | Deteksi usang tetap bekerja lewat hash, tetapi stempel membawa versi yang tidak membedakan keadaan |
| H8 | Draft EXEC terbuka pada KLHK (4), swm (1), CanopySense (PLAN v4.6) | Sinkronisasi mengganti rules/templates di bawah pekerjaan berjalan; validasi lolos pada gladi, tetapi isi rule berubah |

## 4. Rencana tahap

| Tahap | Isi | Pelaksana |
|---|---|---|
| F09a | Perubahan kode kecil pada master: daftar aset pensiun pada `setup update` (O-1), laporan berkas host di luar bundel, bridge dalam himpunan sync (O-5), opsi adopsi berkas yatim (O-4), kenaikan versi (O-7). Build, tes, commit | Saya, atas persetujuan |
| F09b | `sigma setup update` pada host ini, termasuk skill semua target. Pratinjau jalur lebih dulu | Director, atau saya atas instruksi per langkah |
| F09c | Per proyek berurutan: swm, KLHK, CanopySense. `project sync`, `sync --confirm` dengan token, `doctor --migrate-mailbox`. Pohon kerja proyek sudah di-commit lebih dulu | Director |
| F09d | Verifikasi: `doctor --check-assets` tanpa selisih, status versi `current`, `session bootstrap` per proyek, tes penuh | Saya |

## 5. Keputusan terbuka

| ID | Pertanyaan | Rekomendasi dan alasan | Jawaban |
|---|---|---|---|
| O-1 | Cara membersihkan berkas pensiun (template HUMAN, skill `cso` dan `checkpoint`) | Daftar eksplisit aset pensiun yang dihapus oleh `setup update` dengan laporan, mengikuti preseden `cleanupLegacyCursorRules`. Bukan prune umum: template tambahan Director di host tidak boleh hilang. Hasilnya berlaku pada semua mesin | TERBUKA |
| O-2 | `notion.credentials.json` | Hapus berkas (rahasia yang sudah dicabut tidak punya fungsi dan kode Notion sudah dihapus F14). Perlu persetujuan eksplisit karena menghapus berkas rahasia; isi tidak akan saya baca | TERBUKA |
| O-3 | Edit lokal pada `~/.sigma` dan skill | Tidak ada (terverifikasi). `setup update` aman; cadangan otomatis tetap dibuat | TERBUKA |
| O-4 | Berkas pesan yatim (KLHK 1, CanopySense 156) | Tambahkan mode adopsi pada migrasi: berkas yang metadatanya dapat diurai (ID, from, to, type) didaftarkan ke konteks `LEGACY` berstatus READ, dengan pratinjau dan `--director-confirm`. Berkas tidak dapat diurai atau ID ganda tetap menolak. Alternatif: Director memindahkan berkas secara manual, kurang aman untuk 156 berkas. Ini mengubah keputusan F03 (menolak), jadi perlu persetujuan | TERBUKA |
| O-5 | Bridge proyek (H5) | Masukkan bridge ke himpunan sync; per berkas sudah dijaga token, sehingga suntingan lokal KLHK tidak tertimpa tanpa keputusan | TERBUKA |
| O-6 | Migrasi lifecycle (`legacy_lock` → `paired_approval`) | Tidak dilakukan sekarang. Alur legacy terbukti terbaca dan lolos `check`; konversi mengubah PLAN LOCKED menjadi APPROVED dan memerlukan review baseline per chain. Lakukan per chain atas keputusan Director | TERBUKA |
| O-7 | Kenaikan versi sebelum distribusi | Naikkan ke 2.1.0 saat commit F09a, dan potong entri CHANGELOG. Alasan: stempel yang ditulis saat distribusi membawa versi yang bermakna. Perubahan: `package.json`, `src/config.ts`, tes kesetaraan sudah ada | TERBUKA |
| O-8 | opencode (H6) | Terima pemasangan pertama (dapat dihapus lewat `setup uninstall`), dengan daftar jalur yang tepat ditampilkan lebih dulu, dan jalankan smoke test U-09 sesudahnya. Alternatif: tunda opencode sampai U-09 | TERBUKA |
| O-9 | Urutan proyek dan syarat | swm, KLHK, CanopySense. Syarat: pekerjaan lokal proyek di-commit lebih dulu oleh Director. Sync tidak membuat commit di proyek | TERBUKA |

## 6. Strategi verifikasi dan kriteria selesai

1. F09a: `tsc` bersih, suite penuh hijau, tes baru untuk daftar aset pensiun, adopsi yatim (preflight, idempoten, gagal pada metadata rusak), dan bridge pada sync dengan token.
2. Gladi bersih ulang pada salinan setelah F09a sebelum menyentuh host.
3. F09b: sesudahnya `sigma doctor --check-assets` tanpa selisih master-host dan master-installed, serta tidak ada `cso`/`checkpoint`/HUMAN.
4. F09c: per proyek `doctor --check-assets` tanpa selisih, `session bootstrap` tanpa peringatan versi, `sigma inbox check` bersih, dan `git status` proyek hanya memuat perubahan terkelola.
5. Kriteria selesai: tiga proyek dan host berstatus `current`; mailbox dapat dipakai; tidak ada perubahan pada artefak LOCKED atau chain (diverifikasi dengan hash `progress-v*.json` dan berkas artefak sebelum dan sesudah).

## 7. Risiko

| Risiko | Mitigasi |
|---|---|
| Sync menimpa suntingan proyek | Token per berkas dan cadangan; bridge KLHK dilindungi token |
| Migrasi mailbox mereset UNREAD menjadi READ (8 pada KLHK, 6 pada Canopy, 1 pada swm) | Dinyatakan di pratinjau; Director membaca pesan UNREAD lebih dulu atau menerima reset |
| Adopsi yatim salah mengklasifikasikan berkas | Hanya berkas yang dapat diurai penuh, konteks LEGACY, READ, pratinjau wajib |
| CLI sudah live lewat symlink | Perubahan perilaku sudah berlaku; F09 tidak menambah risiko baru, hanya menutup drift |
| Draft terbuka berjalan di bawah rules baru | Gladi bersih lolos; Director dapat menunda proyek yang sedang sprint |

## 8. Hasil eksekusi (15 Oktober 2026)

| Tahap | Hasil |
|---|---|
| F09a | Kode master: adopsi berkas yatim (`doctor --migrate-mailbox --adopt-orphans`), pembersihan aset pensiun pada `setup install/update`, laporan berkas host di luar bundel, bridge dalam `project sync` (token per berkas, di luar stempel), versi 2.1.0. Tes: `f09-distribution.test.ts` (11 kasus) dan `registry-sync.test.ts`; suite penuh 83 berkas / 1.309 tes hijau; `tsc` bersih; `dist/` dibangun |
| Gladi bersih | Dua putaran pada salinan dengan `HOME` sementara. Putaran kedua menemukan format pesan paling awal pada CanopySense (kolom `From Role`/`To Role`, tipe `REPLY`/`REQUEST`, lampiran berupa teks bebas). Pengurai diperluas secara konservatif dan diuji; seluruh 156 berkas yatim dapat diadopsi |
| F09b | `sigma setup update` pada host. Cadangan sebelum eksekusi: `scratchpad/host-backup-pre-f09` dan `~/.sigma/backups/2026-10-14T19-18-57-728Z`. 5 target skill diperbarui (9 skill per target), command dan plugin opencode dipasang untuk pertama kali, 4 template HUMAN dan skill `cso`/`checkpoint` dihapus (6 jalur), `notion.credentials.json` dihapus. `doctor --check-assets`: 84 pasangan, 0 selisih; stempel host 2.1.0 |
| F09c | swm, KLHK, CanopySense berurutan: `project sync --confirm` dengan seluruh token (18/24/17 penggantian), stempel proyek 2.1.0, `CHANGE-RECORD.md` kosong dibuat, migrasi mailbox berhasil (14, 369, 241 pesan; UNREAD direset READ: 1, 8, 6; yatim diadopsi: 0, 1, 156). Cadangan sync: `~/.local/share/sigma/sync-backups/` |
| F09d | Per proyek: `doctor --check-assets` 131 pasangan, 0 selisih, status `current`; `inbox check` 0 kegagalan; hash `progress-v*.json` dan seluruh artefak (7, 81, 108 berkas) tidak berubah; orientasi MCP: `mailbox: ready`, `version_status: current`; lifecycle tetap `legacy_lock` dan numbering `legacy_offset` (O-6) |

Batas dan yang belum:

- **Perubahan kode F09a belum di-commit.** Aset yang didistribusikan (Protocol, rules, templates, skill) sama dengan yang sudah di-commit di F18; hanya kode, tes, registry, README, CHANGELOG, dan `dist/` yang menunggu commit.
- **Pohon kerja proyek** berubah sesuai sinkronisasi dan migrasi; Director meng-commit sendiri. Pada KLHK pesan yang dipindah ke `LEGACY` tampak sebagai penghapusan dan penambahan berkas.
- **Smoke test opencode (F16 U-09)** belum dijalankan; hanya Director yang dapat menjalankannya.
- **Sesi AI yang sedang terbuka** masih memuat teks skill lama sampai dimulai ulang.
- **Migrasi lifecycle** tidak dilakukan (O-6); ketiga chain tetap `legacy_lock`.
- **Pesan UNREAD yang direset** disimpan pada indeks sebagai `migration.original_status` per entri.
