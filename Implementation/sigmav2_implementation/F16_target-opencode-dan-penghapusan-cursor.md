# F16 - Target opencode dan penghapusan target Cursor

Tanggal: 8 Oktober 2026
Status: O-1 sampai O-9 DISETUJUI Director 8 Oktober 2026 sesuai rekomendasi ("semua rekomendasi disetujui, eksekusi dilakukan di sesi baru tidak dilakukan di sesi ini"). Eksekusi dilakukan di sesi baru 8 Oktober 2026 (W0–W7, bagian 11): tsc bersih, 74 berkas / 1.134 tes hijau; U-09 (smoke manual) menunggu Director; belum di-commit. Pada sesi persetujuan tidak ada kode, rules, template, registry, build, atau Git yang diubah.
Baseline: `main`, HEAD `90ef165` (F05); worktree bersih kecuali berkas Discussion `2026-10-08_evaluasi-integrasi-opencode.md` (tak terlacak, sumber rencana ini).
Sifat dokumen: catatan pengembangan master Sigma, bukan artefak governance proyek terdaftar. Otorisasi penyusunan: instruksi Director 8 Oktober 2026 ("opencode didaftarkan sebagai target baru; cursor dihapus karena tidak digunakan dan kemungkinan outdate; jika ternyata terbarui, laporkan").
Penomoran: F15 tetap dicadangkan untuk usulan amandemen Constitution (belum disetujui), sehingga fokus ini F16.

Label isi: **TERKUNCI** (keputusan Director), **TERVERIFIKASI** (diperiksa pada kode, dokumentasi resmi, atau perilaku opencode 1.18.35 di mesin ini), **REKOMENDASI** (asisten, belum keputusan), **TERBUKA** (menunggu keputusan), **BELUM DIUJI**.

## 1. Tujuan dan batas fokus

Menambahkan opencode sebagai target distribusi Sigma (command peran, hook proteksi, registrasi MCP, bridge) dan menghapus target Cursor. Fokus ini hanya menyentuh lapisan distribusi; kernel, gate, lifecycle, dan protokol tidak berubah.

Dalam cakupan: deteksi, deploy command, plugin proteksi `progress-v<N>.json`, penulisan dan penghapusan config MCP opencode (dengan penanganan JSONC), bridge `AGENTS.md`, uninstall, README, tes, dan pembersihan Cursor (termasuk sisa artefak lama).

Di luar cakupan: perubahan path skill Claude Code (ditunda Director, lihat bagian 8); `sigma-control` otomatis; Protocol dan Constitution; `SCHEMA_VERSION` dan versi paket; sinkronisasi ke `~/.sigma` dan proyek nyata (F09); commit dan push.

## 2. Keputusan Director yang sudah terkunci

1. opencode didaftarkan sebagai target baru Sigma.
2. Cursor dihapus bila outdate. Bila ternyata terbarui, dilaporkan dan Director menimbang ulang (hasil di bagian 4.2).

## 3. Peta dampak kode (TERVERIFIKASI pada HEAD 90ef165)

| Lokasi | Keadaan sekarang | Dampak |
|---|---|---|
| `src/utils/detect.ts:6-45` | `DetectedTools` dan `ToolTargetPaths` memuat `cursor`/`cursorRules`; `detectTools()` menguji `~/.cursor/rules` | Hapus Cursor; tambah `opencode`, `opencodeCommands`, `opencodePlugins`, `opencodeConfigDir`; deteksi `~/.config/opencode` |
| `src/commands/setup.ts:43-65` | `ROLE_FILES`, `PLATFORM_LABELS`, `PLATFORM_SOURCE_DIR` memuat lima platform | Hapus `cursor`; tambah `opencode` (sembilan `.md` datar) |
| `src/commands/setup.ts:210-299` | `deploySkillsAndHook`: salin per platform, hook hanya Claude; jalur `targetDirMap` (baris 214-220) | Tambah `opencode`; deploy plugin proteksi bila opencode dipilih; hapus `cursor` |
| `src/commands/setup.ts:152` | Teks daftar direktori terdeteksi (menyebut `~/.gemini/agents`, tidak sama dengan path terpasang `~/.gemini/config/skills`) | Perbarui teks; koreksi sekalian |
| `src/commands/setup.ts:530-625` | Uninstall: `targetDirMap`, dry-run, catatan `.cursor/mcp.json` (baris 566, 623-624) | Tambah penghapusan command dan plugin opencode serta key MCP; hapus catatan Cursor |
| `src/utils/mcpConfig.ts:129-150` | `writeClaudeMcpConfig`, `writeCursorMcpConfig`; `readJsonSafe` mengembalikan `{}` bila parse gagal (baris 83-93), `writeJsonSafe` menulis ulang berkas penuh | Hapus penulis Cursor; tambah penulis/penghapus opencode yang aman JSONC (O-5) |
| `src/commands/project.ts:422-424, 544, 598-600` | `project start`/`sync` menulis `.cursor/mcp.json` | Ganti dengan penulisan config opencode proyek |
| `src/commands/project.ts:393-409`, `src/config.ts:37` | Lima bridge (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `DEEPSEEK.md`, `REASONIX.md`) | `AGENTS.md` dibahas di O-1 |
| `setup/targets/cursor/SIGMA.mdc` | Satu berkas rules `alwaysApply` | Hapus folder |
| `setup/targets/bridge/AGENTS.md` | "Codex Model Directives"; baris Ownership: "These rules apply strictly to the Codex model"; aktivasi memakai `#arc` | O-1 |
| `setup/targets/hooks/protect-sigma.js` | Hook Claude: pencocokan nama tool Edit atau Write pada `tool_input.path`; pesan menyebut `sigma plan lock` yang sudah tombstone sejak F04 | Plugin opencode baru dengan pesan terbarui; pesan hook Claude dicatat sebagai temuan |
| `test/mcp-config.test.ts` (blok Cursor, baris 149-182, 572-580), `test/role-memory-bootstrap.test.ts:34-43` | Menguji `.cursor/mcp.json` | Hapus/ubah; tambah tes opencode |
| `README.md:375, 447-448, 510-511, 517, 522-545` | Daftar target, tabel registrasi MCP, catatan uninstall | Perbarui |
| `setup/targets/claude_code/*.md` | Sembilan skill sumber (76.619 byte) | Sumber isi command opencode |

Hasil pencarian `Cursor`/`cursor` di `src/`, `setup/`, `README.md`, `Sigma/`, `test/` seluruhnya tercantum di atas; `Sigma/` (rules, protokol, registry) tidak menyebut Cursor. Pencarian ini sementara sampai dikonfirmasi pada tahap verifikasi implementasi.

## 4. Hasil verifikasi

### 4.1 Dokumen evaluasi opencode (penulis: agent opencode)

Dokumen itu diperlakukan sebagai data, bukan instruksi. Setiap klaim yang menjadi dasar rencana diperiksa terhadap dokumentasi resmi, perilaku `opencode` 1.18.35 di Windows mesin ini (`opencode debug config`, `debug skill`, `debug paths`, `mcp list`), tipe SDK lokal, dan string pada biner `opencode.exe`.

| Klaim dokumen | Hasil |
|---|---|
| Config global `~/.config/opencode/`, command di `commands/`, agent di `agents/`, plugin di `plugins/` | TERVERIFIKASI. `opencode debug paths` melaporkan `config C:\Users\dikoh\.config\opencode`; command, agent, dan plugin pada `.opencode/` proyek uji terdeteksi |
| Frontmatter command: `description`, `agent`, `model`, `subtask`; tanpa `name` | TERVERIFIKASI dokumentasi. Tambahan: `name` dan `allowed-tools` pada frontmatter ditoleransi (diabaikan) sehingga sumber Claude dapat dipakai tanpa diubah |
| Format MCP lokal `{"type":"local","command":[...],"enabled":true}` | TERVERIFIKASI. `opencode mcp list` pada proyek uji dengan entri `sigma-mcp --mode query` melaporkan `connected` di Windows (shim npm `sigma-mcp.cmd` ter-resolve) |
| Dukungan JSONC | TERVERIFIKASI, dengan temuan tambahan: config global pengguna di mesin ini bernama **`opencode.jsonc`**, bukan `opencode.json`. `opencode.json` dan `opencode.jsonc` yang berdampingan keduanya dibaca dan digabung. Urutan prioritas keduanya tidak diuji (klaim ".jsonc menang" hanya dari sumber pihak ketiga) |
| Risiko `readJsonSafe` menimpa config berkomentar | TERVERIFIKASI pada kode: parse JSON murni gagal pada komentar atau koma akhir, fungsi mengembalikan `{}`, lalu `writeJsonSafe` menulis ulang berkas sehingga seluruh isi pengguna hilang |
| `AGENTS.md` proyek dibaca native; fallback ke `CLAUDE.md` | TERVERIFIKASI dokumentasi: cari `AGENTS.md` lalu `CLAUDE.md` dari direktori kerja ke atas, **pemenang pertama saja**, tidak digabung; `instructions` di `opencode.json` menambah berkas yang **digabung** dengan `AGENTS.md` |
| opencode memuat skill dari `~/.claude/skills/` dan `~/.agents/skills/` | TERVERIFIKASI (`debug skill` mendaftar skill dari kedua folder). Tidak membaca `~/.claude/commands/`: command Sigma milik Claude tidak muncul di opencode |
| Hook `tool.execute.before` dengan `input.tool`, `output.args`; melempar `Error` memblokir | TERVERIFIKASI dokumentasi dan tipe SDK lokal (`output.args: any`). Berkas pada `.opencode/plugins/` terdeteksi sebagai plugin; pemblokiran sungguhan belum diuji karena membutuhkan panggilan model |
| `write`, `edit`, `apply_patch` berada di bawah permission `edit` | TERVERIFIKASI dokumentasi |
| Nama argumen tool | TERVERIFIKASI dari string biner: `edit`/`write` memakai `filePath`; `apply_patch` memakai `patchText` berisi baris `*** Add File:`, `*** Update File:`, `*** Delete File:`. Dokumen evaluasi tidak memuat ini |
| Rekomendasi O-1b (berkas bridge terpisah lewat `instructions`) | **TIDAK DIDUKUNG.** Karena `AGENTS.md` proyek selalu menang sebagai berkas utama dan `instructions` bersifat penambahan, opencode akan memuat keduanya: `AGENTS.md` berlabel Codex ("apply strictly to the Codex model", aktivasi `#arc`) ditambah berkas opencode. Hasilnya duplikat dan kontradiktif (lihat O-1) |
| Isi bridge `AGENTS.md` | Selisih `AGENTS.md` terhadap `CLAUDE.md` hanya nama model, baris Ownership, dan sintaks aktivasi (`#arc` vs `/arc`); isi lainnya sama |
| Agent permission untuk membatasi AUD (`edit: deny`) | TERVERIFIKASI mekanismenya (config terselesaikan memuat `permission.edit: deny`). Perilaku command berfrontmatter `agent:` terhadap agent sesi tidak diuji (butuh model) |

### 4.2 Laporan Cursor (diminta Director)

Hasil per bagian, sumber [cursor.com/docs/context/rules](https://cursor.com/docs/context/rules) dan [cursor.com/docs/context/mcp](https://cursor.com/docs/context/mcp):

- **Target aturan global Sigma (`~/.cursor/rules/SIGMA.mdc`): OUTDATE/tidak berfungsi.** Dokumentasi saat ini menyatakan tidak ada lokasi berbasis berkas seperti `~/.cursor/rules`; User Rules hanya diatur lewat antarmuka Settings. Rules proyek berada di `.cursor/rules/*.mdc`. Deteksi Sigma bergantung pada folder `~/.cursor/rules` yang sudah ada, sehingga target ini menulis ke lokasi yang tidak dibaca Cursor.
- **Config MCP proyek (`.cursor/mcp.json`, key `mcpServers`): MASIH BERLAKU.** Dokumentasi saat ini menetapkan `.cursor/mcp.json` (proyek) dan `~/.cursor/mcp.json` (global) dengan struktur `mcpServers`. Catatan: dokumentasi mencantumkan `type: "stdio"` sebagai field wajib untuk server stdio, sedangkan entri yang ditulis Sigma tidak memuatnya.
- **Cursor membaca `AGENTS.md` native** sebagai alternatif rules. Bridge `AGENTS.md` yang sudah ditulis Sigma tetap dapat dibaca pengguna Cursor tanpa target khusus.
- Cursor tidak terpasang di mesin ini (`~/.cursor` tidak ada; `cursor` tidak ada di PATH), sehingga bagian mana pun dari target ini tidak dapat diuji secara nyata.

Karena satu bagian (config MCP proyek) masih berlaku, instruksi Director "laporkan bila terbarui" berlaku untuk bagian itu; keputusannya ada di O-7.

## 5. Spesifikasi perilaku (REKOMENDASI)

### 5.1 Deteksi dan deploy

- `detectTools()`: `opencode` benar bila `~/.config/opencode` ada. XDG_CONFIG_HOME tidak diperhitungkan (O-9).
- Sumber `setup/targets/opencode/<peran>.md`, sembilan berkas datar; isi sama dengan `claude_code/` kecuali `sigma-test.md` (path dan label platform). Tujuan `~/.config/opencode/commands/<peran>.md`; command `/arc`, `/fmn`, `/dev`, `/aud`, `/report`, `/sigma-test`, `/humanize`, `/write-memo`, `/read-memo`.
- Pemeriksaan sintaks template: sumber Claude tidak memuat `` !` ``, `$ARGUMENTS`, `$1..$9`, maupun rujukan `@path`, yang oleh opencode ditafsirkan sebagai injeksi perintah atau berkas. Tes menjaga agar tetap demikian (U-02).
- Overwrite sama dengan platform lain (tanpa cadangan); command pengguna bernama sama (`dev`, `report`, ...) akan tertimpa. Diperlakukan sebagai batasan yang diketahui (O-4).

### 5.2 Plugin proteksi

`setup/targets/opencode/plugins/protect-sigma.js` → `~/.config/opencode/plugins/protect-sigma.js`. Hook `tool.execute.before`:
- `edit`/`write`: periksa `args.filePath` (juga `path`/`file_path` sebagai pertahanan) terhadap `Sigma[\/\\]progress(-v\d+)?\.json$`.
- `apply_patch`: periksa path pada baris header `*** Add|Update|Delete File:` dan `*** Move to:` di `args.patchText`; isi patch yang hanya menyebut nama berkas tidak memicu blokir.
- Melempar `Error` dengan pesan terbarui yang menyebut perintah yang berlaku (`sigma intent ratify`, `sigma plan approve`, dan seterusnya), bukan `sigma plan lock`.
- Tidak memblokir `bash` (paritas dengan hook Claude yang juga hanya Edit/Write). Argumen tak dikenal tidak melempar galat.
- Pesan hook Claude ikut diperbarui sebagai temuan terpisah bila Director setuju (O-6).

### 5.3 Registrasi MCP (hanya proyek, O-2)

`sigma project start`/`sync` menulis entri `sigma` ke config opencode proyek:
`{"type":"local","command":["sigma-mcp","--mode","query","--project-root",<root>,"--project-id",<id>],"enabled":true}` di bawah key `mcp`.
- Berkas: `opencode.jsonc` bila ada; jika tidak, `opencode.json` bila ada; jika tidak ada keduanya, buat `opencode.json` dengan `$schema`.
- Penulisan menjaga komentar dan koma akhir (O-5), hanya upsert key `mcp.sigma`, idempoten, atomik (temp lalu rename). Berkas yang tidak dapat di-parse tidak ditimpa: operasi berhenti dengan peringatan dan potongan config untuk ditambahkan manual.
- `sigma setup uninstall` tidak menyentuh config proyek (sama dengan `.mcp.json`); tidak ada penulisan global opencode.
- `sigma-control` tidak didaftarkan otomatis.

### 5.4 Bridge

Lihat O-1. Rekomendasi: `bridge/AGENTS.md` menjadi berkas netral untuk pembaca `AGENTS.md` (Codex dan opencode): ownership menyebut kedua model, aktivasi menyebut `#arc` (Codex) dan `/arc` (opencode). Tidak ada berkas bridge baru.

### 5.5 Penghapusan Cursor

- Hapus `setup/targets/cursor/`, seluruh cabang `cursor` di `setup.ts`/`detect.ts`, `writeCursorMcpConfig`, panggilan di `project.ts`, tes dan README terkait.
- `sigma setup update` dan `uninstall` menghapus `~/.cursor/rules/SIGMA.mdc` hanya bila berkas itu ada dan memuat penanda Sigma (deskripsi "Sigma governance protocol for Cursor"); dilaporkan. Direktori `~/.cursor` dan berkas lain tidak disentuh.
- `.cursor/mcp.json` pada proyek yang sudah ada tidak disentuh; catatan uninstall hanya menyebut `.mcp.json` dan config opencode proyek.

## 6. Kompatibilitas dan migrasi

- Pengguna Cursor yang sudah memasang: `SIGMA.mdc` dibersihkan sesuai 5.5; `.cursor/mcp.json` lama tetap berfungsi sampai pengguna menghapusnya sendiri.
- Proyek yang sudah ada tidak mendapat config opencode sampai `sigma project sync --confirm`; bridge `AGENTS.md` lama (berlabel Codex) hanya diganti dengan `--overwrite-bridge` (kehilangan penyuntingan lokal), sehingga penyelarasan proyek lama mengikuti F09.
- Tidak ada perubahan `SCHEMA_VERSION`, chain, atau state. Tidak ada migrasi proyek nyata.
- Versi opencode yang diverifikasi: 1.18.35 (Windows). Struktur direktori jamak (`commands/`, `agents/`, `plugins/`) adalah bentuk yang dianjurkan dokumentasi; bentuk tunggal tetap didukung sebagai kompatibilitas.

## 7. Keputusan terbuka

| ID | Pertanyaan | Opsi | Rekomendasi dan alasan | Jawaban Director |
|---|---|---|---|---|
| O-1 | Bridge untuk opencode. Fakta: opencode memuat `AGENTS.md` proyek yang sekarang berlabel "hanya untuk Codex" dan memakai sintaks aktivasi `#arc` | (a) generalisasi `bridge/AGENTS.md` untuk Codex dan opencode; (b) berkas terpisah lewat `instructions` (usulan dokumen evaluasi); (c) biarkan | **(a).** (b) menghasilkan dua berkas termuat sekaligus: pernyataan "berlaku hanya untuk Codex" bertabrakan dengan berkas opencode dan isi digandakan. (c) membuat opencode membaca arahan yang menyatakan dirinya bukan untuknya. Selisih isi hanya label dan sintaks aktivasi, sehingga satu berkas netral cukup. Risiko: teks Codex berubah sedikit; proyek lama baru terbarui lewat F09 |  |
| O-2 | Lingkup registrasi MCP | (a) hanya config proyek (terikat); (b) juga global | **(a).** Menghindari pola global yang tertimpa binding proyek terakhir (perilaku Codex/Antigravity saat ini); sejalan dengan `.mcp.json`. `sigma-control` tetap manual |  |
| O-3 | Bentuk peran di opencode | (a) command saja (paritas Claude); (b) command + primary agent dengan permission | **(a) sekarang.** Perilaku command berfrontmatter `agent:` terhadap agent sesi belum terverifikasi; agent global muncul di siklus Tab pada semua proyek (termasuk non-Sigma) dan memungkinkan pergantian peran di tengah sesi, bertentangan dengan immutability peran. Keunggulan `edit: deny` untuk AUD nyata tetapi terpisah dan murah ditambahkan kemudian (isi sama) setelah Director mencoba command |  |
| O-4 | Nama command dan perlindungan tabrakan | (a) tanpa prefix, overwrite seperti platform lain; (b) tanpa prefix, lewati berkas asing; (c) prefix `sigma-` | **(a).** Paritas dengan `/arc` Claude; kebijakan overwrite seluruh platform ditinjau bersama di F09. Risiko tabrakan (`dev`, `report`) dilaporkan di keluaran install |  |
| O-5 | Penanganan JSONC saat menulis config | (a) tambah dependensi `jsonc-parser` (edit mempertahankan komentar); (b) tanpa dependensi: baca dengan pembersih komentar, tolak menulis bila berkas memuat komentar/koma akhir dan cetak potongan untuk manual | **(a).** Berkas config pengguna di mesin ini sudah `.jsonc`; (b) membuat pengguna yang paling mungkin memakai komentar harus mengedit manual. Biaya: satu dependensi kecil tanpa dependensi turunan dari Microsoft, dibundel pada instalasi global (menambah permukaan rantai pasok). Jika Director menolak dependensi baru, (b) |  |
| O-6 | Cakupan plugin dan hook | (a) opencode saja, paritas Claude (edit/write/apply_patch pada `progress-v<N>.json`); (b) opencode dan perbarui pesan hook Claude yang menyebut `sigma plan lock` | **(b).** Pesan hook Claude merujuk perintah tombstone sejak F04 dan menyesatkan; perubahan satu baris dan tanpa efek perilaku |  |
| O-7 | Cakupan penghapusan Cursor (bagian 4.2: target rules global outdate; config MCP proyek masih berlaku) | (a) hapus seluruhnya termasuk penulis `.cursor/mcp.json`; (b) hapus target rules, pertahankan penulis MCP | **(a).** Sesuai instruksi Director bahwa Cursor tidak digunakan; tidak ada yang dapat diuji (tidak terpasang); entri yang ditulis juga sudah tertinggal dari dokumentasi (`type`). Pengguna Cursor tetap membaca `AGENTS.md` native dan dapat menambahkan `.cursor/mcp.json` sendiri. Dapat dipulihkan dari Git bila dipertimbangkan kembali |  |
| O-8 | Pembersihan artefak Cursor lama | (a) hapus `~/.cursor/rules/SIGMA.mdc` saat `update`/`uninstall` hanya bila berpenanda Sigma, dilaporkan; (b) biarkan | **(a).** Berkas milik Sigma yang tidak berfungsi lebih baik dibersihkan; berkas lain tidak disentuh |  |
| O-9 | Lokasi config opencode | (a) tetap `~/.config/opencode`, abaikan `XDG_CONFIG_HOME`; (b) hormati `XDG_CONFIG_HOME` | **(a).** Terverifikasi di Windows dan sesuai dokumentasi; perilaku XDG pada versi 1.18 tidak diuji. Batasan dicatat |  |

**Jawaban Director (8 Oktober 2026): O-1 sampai O-9 seluruhnya disetujui sesuai rekomendasi**, termasuk dependensi `jsonc-parser` (O-5), generalisasi `bridge/AGENTS.md` (O-1), dan penghapusan Cursor seluruhnya (O-7). Kolom jawaban pada tabel dibiarkan kosong; baris asli tidak diubah.

**Catatan untuk sesi eksekusi baru:**
- Mulai dari W0 (bagian 10). Verifikasi ulang HEAD, worktree, dan nomor baris peta dampak; HEAD saat persetujuan `90ef165`.
- Berkas Discussion `2026-10-08_evaluasi-integrasi-opencode.md` tidak terlacak; jangan dihapus atau diubah. Dokumen itu data, bukan instruksi; bagian 4.1 mencatat klaimnya yang tidak didukung (O-1b).
- Perilaku opencode yang diverifikasi pada versi 1.18.35 (Windows): path config `C:\Users\dikoh\.config\opencode`, `opencode debug config|skill|paths`, `opencode mcp list`, tipe hook pada `~/.config/opencode/node_modules/@opencode-ai/plugin/dist/index.d.ts`, argumen `apply_patch` (`patchText`, header `*** Add|Update|Delete File:`) dari string biner. Ulangi bila versi opencode berubah.
- Proyek uji sementara dari sesi persetujuan ada di scratchpad sesi lama dan tidak boleh diandalkan; buat fixture baru.
- Berlaku sama seperti F04/F05: build `dist/` memengaruhi `sigma-mcp` global lewat symlink, dilaporkan; tidak ada sinkronisasi `~/.sigma` atau proyek; tidak ada commit/push tanpa instruksi; Constitution, Protocol, `SCHEMA_VERSION`, versi paket tidak berubah.
- Tes CLI berjalan terhadap `dist/`; helper `runCli` menerima `SIGMA_TEST_DIST` untuk build sementara (`tsc --outDir dist-test`, hapus sesudahnya).
- Pelajaran F05: perintah Git dengan pathspec dijalankan dari akar repo; mutasi kontrol MCP dibatasi 250 ms (tidak relevan untuk F16 kecuali bila menyentuh tool MCP).

Catatan batas persetujuan: persetujuan O-1 sampai O-9 mengotorisasi implementasi sesuai bagian 10, bukan commit, push, sinkronisasi ke `~/.sigma` atau proyek, ataupun migrasi proyek nyata.

## 8. Dependensi dan risiko

- **Keputusan path skill Claude yang ditunda.** opencode membaca `~/.claude/skills/`. Jika kelak skill Sigma dipindah ke sana, opencode memuatnya juga sebagai skill on-demand di samping command `/arc` miliknya (duplikat dalam daftar skill model); `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=1` atau permission `skill` dapat meredamnya. Hari ini tidak ada duplikasi karena `~/.claude/commands/` tidak dibaca opencode. Dicatat agar keputusan itu mempertimbangkannya.
- **R-1 Pemblokiran plugin belum teruji end-to-end.** Penemuan plugin dan bentuk hook terverifikasi; eksekusi blokir menunggu satu smoke manual dengan model (U-09). Logika diuji unit dengan masukan simulasi.
- **R-2 Format `apply_patch`.** Nama argumen dan header diambil dari string biner 1.18.35; versi mendatang dapat berubah. Plugin tidak melempar pada bentuk tak dikenal (gagal terbuka), sehingga paritas penuh tidak dijamin lintas versi.
- **R-3 Tabrakan nama command** (O-4) dan **overwrite tanpa cadangan** berlaku di semua platform.
- **R-4 Dependensi baru** (O-5) menambah permukaan rantai pasok dan mengubah `package-lock.json`.
- **R-5 Duplikasi isi.** Satu target lagi berarti sembilan berkas isi yang harus disinkronkan setiap perubahan skill (delapan skill F04 sudah disentuh per target). Mitigasi: tes paritas isi `opencode/` terhadap `claude_code/` (U-02).
- **R-6 Runtime global.** Build `dist/` memengaruhi `sigma-mcp` global lewat symlink; build pada akhir setelah `tsc --noEmit` dan tes khusus lulus, dilaporkan lebih dulu (pola F04 O-14, F05 O-11).
- **Dependensi lain:** F09 (distribusi dan penyelarasan proyek lama), F11 (Writing Style Rules berlaku pada teks yang ditulis di berkas bridge).

## 9. Strategi uji dan kriteria selesai (REKOMENDASI)

| ID | Kontrak |
|---|---|
| U-01 | `detectTools()`: opencode ada/tidak; `cursor` tidak ada lagi |
| U-02 | Deploy: sembilan command tertulis, overwrite berkas Sigma, bukan-Sigma di folder sama tidak disentuh, isi paritas dengan `claude_code/` (selain `sigma-test`), tidak ada sintaks injeksi template (`` !` ``, `$ARGUMENTS`, `$N`, `@path`), frontmatter terbaca |
| U-03 | Plugin (unit): blokir `edit`/`write` pada `Sigma/progress.json`, `progress-v2.json` (path POSIX dan Windows), izinkan berkas lain; `apply_patch` dengan header Add/Update/Delete/Move; isi patch yang hanya menyebut nama berkas tidak diblokir; argumen tak dikenal tidak melempar |
| U-04 | MCP opencode: buat baru; upsert dengan memelihara server lain, komentar, dan koma akhir; `.jsonc` dipilih bila ada; idempoten; entri terikat (`--project-root`, `--project-id`); berkas tak dapat di-parse tidak ditimpa dan memberi peringatan; penghapusan key `sigma` |
| U-05 | Uninstall: command dan plugin Sigma dihapus, berkas pengguna lain dan config proyek tidak disentuh; dry-run mencantumkannya |
| U-06 | `project start`/`sync`: tulis config opencode, tidak menulis `.cursor/mcp.json`; tes lama diperbarui |
| U-07 | Cursor: tidak ada referensi tersisa di `src/`, `setup/`, `README.md`; `SIGMA.mdc` berpenanda dibersihkan dan yang tanpa penanda tidak |
| U-08 | Integrasi (dilewati bila `opencode` tidak terpasang): proyek sementara dengan config hasil penulis → `opencode debug config` memuat `mcp.sigma`, command, dan plugin; `opencode mcp list` melaporkan `connected` |
| U-09 | Smoke manual Director, satu sesi opencode: `/arc` terbaca sebagai peran; permintaan mengedit `Sigma/progress-v1.json` ditolak plugin |
| U-10 | Regresi: `tsc --noEmit`, build, suite lengkap hijau; bridge Claude/Codex/Reasonix/Antigravity tidak berubah selain `AGENTS.md` (O-1) |

Kriteria selesai: U-01 sampai U-08 dan U-10 lulus, U-09 dijalankan Director atau dicatat sebagai belum, pemeriksaan batas scope (Constitution, Protocol, `SCHEMA_VERSION`, versi paket tidak berubah; tidak ada sinkronisasi atau migrasi nyata), hasil di bagian 11, F00 diperbarui. Commit dan push menunggu instruksi terpisah.

## 10. Urutan langkah implementasi (REKOMENDASI; difinalkan setelah keputusan ditutup)

1. W0: baseline `tsc --noEmit` dan suite (72 berkas / 1.072 tes pada HEAD 90ef165); verifikasi ulang peta dampak.
2. W1: hapus Cursor (kode, target, README, tes); tambah pembersihan `SIGMA.mdc` berpenanda.
3. W2: `detect.ts` dan `setup.ts` untuk opencode (deteksi, deploy command, uninstall, label); folder `setup/targets/opencode/` (sembilan command).
4. W3: plugin proteksi dan tes unit; deploy dan hapus plugin; pembaruan pesan hook Claude (O-6).
5. W4: penulis/penghapus MCP opencode dengan penanganan JSONC (O-5); panggilan di `project start`/`sync`.
6. W5: bridge `AGENTS.md` (O-1), README.
7. W6: tes U-01..U-08 dan penyesuaian tes lama.
8. W7: `tsc --noEmit`, build, suite lengkap, pemeriksaan batas scope; tulis bagian 11; perbarui F00.

## 11. Hasil eksekusi

Dieksekusi 8 Oktober 2026 pada `main`, HEAD `90ef165`, tanpa commit, push, sinkronisasi ke `~/.sigma` atau proyek nyata, maupun migrasi. Semua uji CLI dan integrasi memakai home dan proyek sementara; `~/.config/opencode`, `~/.sigma`, dan `~/.cursor` milik mesin ini tidak disentuh.

### 11.1 Baseline dan hasil akhir

| | W0 (sebelum) | W7 (sesudah) |
|---|---|---|
| `tsc --noEmit` | bersih | bersih |
| Suite | 72 berkas / 1.072 tes | 74 berkas / 1.134 tes, seluruhnya hijau (dijalankan terhadap `dist-test`, lalu terhadap `dist/` hasil build akhir) |

Peta dampak bagian 3 cocok dengan HEAD untuk `src/`, `setup/`, dan `test/`; nomor baris README bergeser beberapa baris, isinya sama.

### 11.2 Perubahan per berkas

| Berkas | Perubahan |
|---|---|
| `src/utils/detect.ts` | `cursor`/`cursorRules` dihapus; `opencode`, `opencodeConfigDir`, `opencodeCommands`, `opencodePlugins` ditambah. `XDG_CONFIG_HOME` diabaikan (O-9), dicatat di komentar |
| `src/utils/mcpConfig.ts` | `writeCursorMcpConfig` dihapus. Ditambah `writeOpencodeMcpConfig`, `removeOpencodeMcpConfig`, `resolveOpencodeConfigPath` (jsonc-parser: komentar dan koma akhir dipertahankan, `.jsonc` didahulukan, atomik, idempoten). Berkas yang tak dapat di-parse tidak ditimpa: `McpManualEditRequired` membawa pesan dan potongan config; `tryMcpOp` meneruskan pesan itu apa adanya (bukan pesan "file terkunci"). `writeJsonSafe` kini membungkus `writeTextSafe` |
| `src/commands/setup.ts` | `cursor` diganti `opencode` pada `ROLE_FILES`/`PLATFORM_LABELS`/`PLATFORM_SOURCE_DIR`; `platformTargetDirs()` menggantikan dua salinan `targetDirMap`; `deployOpencodePlugin()`; uninstall menghapus command opencode dan plugin (plugin hanya bila bertanda `sigma-managed: protect-sigma`); `cleanupLegacyCursorRules()` pada `update` dan `uninstall` (hanya `SIGMA.mdc` berpenanda "Sigma governance protocol for Cursor"); dry-run mencantumkan keduanya; teks direktori terdeteksi dikoreksi; catatan uninstall menyebut `opencode.json`/`opencode.jsonc` |
| `src/commands/project.ts` | `project start` dan `project sync` menulis config opencode proyek, bukan `.cursor/mcp.json`; teks dry-run diperbarui |
| `setup/targets/opencode/` (baru) | Sembilan command (delapan identik dengan `claude_code/`; `sigma-test.md` memakai path `~/.config/opencode/commands/` dan label `opencode`) dan `plugins/protect-sigma.js` |
| `setup/targets/cursor/` | Dihapus |
| `setup/targets/bridge/AGENTS.md` | Dinetralkan untuk Codex dan opencode (O-1): `name: AGENTS-RULES`, ownership menyebut keduanya, aktivasi `#arc` (Codex) dan `/arc` (opencode). Tidak ada berkas bridge baru |
| `setup/targets/hooks/protect-sigma.js` | Pesan menyebut `sigma plan approve`, bukan `sigma plan lock` (O-6) |
| `package.json`, `package-lock.json` | Dependensi `jsonc-parser ^3.3.1` (O-5). Versi paket dan `SCHEMA_VERSION` tidak berubah |
| `README.md`, `CHANGELOG.md` | Daftar target, tabel registrasi MCP, catatan uninstall, referensi manual opencode; entri Added/Changed/Removed |
| `dist/` | Dibangun ulang (hanya berkas turunan dari perubahan di atas). Memengaruhi `sigma-mcp` global lewat symlink (R-6); tidak ada kode server MCP yang berubah |
| `test/` | Baru: `f16-opencode.test.ts` (44 tes), `f16-opencode-integration.test.ts` (4). Diubah: `mcp-config.test.ts` (blok Cursor diganti 17 tes opencode; `stubIdentity` dipindah ke lingkup berkas), `role-memory-bootstrap.test.ts` |

### 11.3 Kontrak uji

| ID | Hasil |
|---|---|
| U-01 | Lulus. `detectTools()` mendeteksi opencode dari `~/.config/opencode`; `cursor` dan `cursorRules` tidak ada |
| U-02 | Lulus. Sembilan command + plugin tertulis; overwrite berkas Sigma; berkas lain di folder yang sama utuh; paritas isi dengan `claude_code/` selain `sigma-test`; tanpa sintaks injeksi (`` !` ``, `$ARGUMENTS`, `$1..$9`, `@path`); frontmatter terbaca; install idempoten; tanpa opencode terdeteksi, folder tidak dibuat |
| U-03 | Lulus. `edit`/`write`/`multiedit` pada `progress.json` dan `progress-v<N>.json` (path POSIX dan Windows, kunci `filePath`/`path`/`file_path`); `apply_patch` dengan header Add/Update/Delete/Move, multi-berkas, CRLF; isi patch yang hanya menyebut nama berkas tidak diblokir; `bash`, `read`, dan argumen tak dikenal tidak melempar; modul hanya mengekspor satu fungsi plugin |
| U-04 | Lulus (di `mcp-config.test.ts`). Buat baru dengan `$schema`; `--project-id` terikat; merge tanpa menyentuh key atau server lain; `.jsonc` didahulukan; komentar, koma akhir, CRLF, dan BOM dipertahankan; idempoten byte-per-byte; entri basi diganti; `mcp` non-objek diganti; berkas rusak, array, dan kosong ditangani; `remove` tidak menyentuh berkas rusak |
| U-05 | Lulus. Dry-run mencantumkan command dan plugin; `--confirm` menghapusnya; berkas pengguna (`mine.md`, plugin lain, `opencode.jsonc` global) dan config proyek utuh; `protect-sigma.js` tanpa penanda Sigma tidak dihapus |
| U-06 | Lulus. `project start` menulis `opencode.json` terikat dan tidak membuat `.cursor/`; `project sync --confirm` menyisip ke `opencode.jsonc` berkomentar; berkas rusak tidak ditimpa dan memberi peringatan; dry-run menyebut config opencode; `AGENTS.md` hasil `project start` netral |
| U-07 | Lulus. `setup/targets/cursor` tidak ada; satu-satunya berkas `src/` yang menyebut Cursor adalah `setup.ts` (pembersihan berkas lama, O-8); `README.md` dan `setup/` bebas dari Cursor; `SIGMA.mdc` berpenanda dibersihkan oleh `update` dan `uninstall`, yang tanpa penanda tidak; `~/.cursor` tetap |
| U-08 | Lulus dengan opencode 1.18.35 (dilewati otomatis bila `opencode`/`sigma-mcp` tak ada di PATH). `opencode debug config` memuat `mcp.sigma` terikat (`OCINT`), sembilan command, dan plugin; `opencode mcp list` melaporkan `sigma connected` |
| U-09 | **BELUM DIJALANKAN.** Menunggu smoke manual Director (lihat 11.5 butir 1) |
| U-10 | Lulus. `tsc --noEmit`, build, suite lengkap hijau; bridge selain `AGENTS.md` tidak berubah; `Sigma/` (Constitution, Protocol, registry), `src/config.ts`, `SCHEMA_VERSION`, dan versi paket tidak berubah |

### 11.4 Keputusan kecil saat eksekusi (di dalam rekomendasi, tanpa mengubah O-1..O-9)

- Plugin diberi komentar penanda `sigma-managed: protect-sigma`; uninstall hanya menghapus plugin bila penanda ada, agar `protect-sigma.js` milik pengguna tidak ikut terhapus.
- `removeOpencodeMcpConfig` diimplementasikan sesuai U-04 tetapi sengaja tidak dipanggil dari uninstall (keputusan 5.3: uninstall tidak menyentuh config proyek). Saat ini hanya dipakai tes.
- Plugin juga menangani alias `multiedit` dan `patch`, serta kunci `path`/`file_path`, sebagai pertahanan; semua gagal-terbuka pada bentuk tak dikenal (R-2).
- `name` frontmatter `bridge/AGENTS.md` berubah dari `CODEX-RULES` menjadi `AGENTS-RULES`. Tidak ada kode atau tes yang merujuk nama lama; dokumen rencana Hermes lama masih menyebut `CODEX-RULES` sebagai riwayat.
- Koreksi bagian 6: `--overwrite-bridge` adalah opsi `sigma project start` (dengan `--reinit`), bukan `project sync`; `project sync` tidak menyentuh berkas bridge. Jadi `AGENTS.md` lama pada proyek terdaftar hanya berubah lewat `project start --reinit --overwrite-bridge` atau penyalinan manual; penyelarasan tetap bagian F09.

### 11.5 Batasan dan temuan yang perlu diketahui Director

1. **U-09 belum teruji (R-1).** Pemblokiran plugin saat model benar-benar memanggil `edit`/`write`/`apply_patch` belum terverifikasi end-to-end. Terverifikasi: plugin terdaftar di config terselesaikan opencode dan logikanya lulus uji unit dengan masukan simulasi. Smoke manual yang dibutuhkan: satu sesi opencode di proyek Sigma, `/arc` terbaca sebagai peran, lalu minta mengedit `Sigma/progress-v1.json`; harapan: ditolak dengan pesan "CLI-managed".
2. **Pemformatan JSONC.** `jsonc-parser` merapikan baris sibling terakhir di titik sisip (mis. objek server satu-baris menjadi multi-baris). Isi, komentar, dan baris lain tidak berubah. `keepLines` tidak membantu; tanpa formatting hasilnya satu baris yang lebih buruk, jadi perilaku standar dipertahankan.
3. **Temuan di luar F16.** Dua temuan ditemukan saat eksekusi dan diperbaiki atas instruksi Director setelahnya (lihat 11.6): (a) teks bridge/skill menyebut `sigma plan lock`/`sigma exec lock` yang sudah tombstone, dan dua bridge tidak memuat aturan `--related-artifact`; (b) `project start`/`project sync` menulis config MCP global Codex dan Antigravity walau tool tidak terdeteksi.
4. **XDG_CONFIG_HOME** tetap tidak diuji (O-9); batasan dicatat di README.
5. **Commit.** Seluruh perubahan belum di-commit (tidak diinstruksikan). Pengelompokan yang disarankan: (1) hapus Cursor + opencode di kode/setup/tes/README/CHANGELOG/dist + `package*.json`; (2) dokumen F16 dan F00.

### 11.6 Perbaikan dua temuan (instruksi Director, 8 Oktober 2026, sebelum commit)

**(a) Teks tombstone di bridge dan skill.** `sigma plan lock` dan `sigma exec lock` adalah tombstone sejak F04 (pengganti: `sigma plan approve` / `sigma exec approve --director-confirm`); `sigma intent ratify` dan `sigma close lock` masih valid. Pemeriksaan menunjukkan teks usang tidak hanya di bridge, tetapi juga di skill semua platform. Perubahan di `setup/targets` (30 berkas, 39 baris): `` `sigma plan lock` `` → `` `sigma plan approve` ``, `` `sigma exec lock` `` → `` `sigma exec approve` ``, serta bentuk `` `plan lock` ``/`` `exec lock` `` pada kalimat Pre-Lock Verification, daftar perintah `REASONIX.md`, dan alur gerbang `DEEPSEEK.md`. Kalimat "plan lock and exec lock are retired tombstones" di skill FMN/DEV sengaja tidak diubah (sudah benar). Paragraf `--related-artifact` disalin dari `AGENTS.md` ke `CLAUDE.md` dan `GEMINI.md` (kedua bridge yang punya bagian Inter-Role Context Handoff); `REASONIX.md` dan `DEEPSEEK.md` tidak punya bagian itu sama sekali (struktur bridge berbeda) dan tidak diubah. Selisih `AGENTS.md` terhadap `CLAUDE.md` kini hanya label model dan sintaks aktivasi.

**Sengaja tidak diubah (di luar `setup/targets`, otoritas terpisah):** `Sigma/SIGMA_PROTOCOL.md` (baris 423, 583, 600), `Sigma/rules/AUD-RULE.md` (baris 1205–1206), `Sigma/SIGMA-OPERATION-REGISTRY.json` (pesan gate "Run: sigma plan lock" dan deskripsi `check`), `README.md` (tabel perintah baris ~614 dan ~621 masih mencantumkan `sigma plan lock`/`sigma exec lock` sebagai perintah aktif), serta kode (`src/services/planLockService.ts`, `execLockService.ts`, `src/engine/chain.ts`). Kemungkinan sebagian penyebutan di Protocol memakai "lock" sebagai konsep lifecycle legacy, sehingga perlu dinilai satu per satu. Rekomendasi: bawa ke pekerjaan Protocol (yang memang terjadwal terakhir) dan perbarui tabel README bersamaan; pesan gate di registry menyesatkan pengguna secara langsung dan layak diprioritaskan.

**(b) Config MCP global untuk tool yang tidak terpasang.** `project start` dan `project sync` kini menulis `~/.codex/config.toml` hanya bila Codex terdeteksi (`~/.codex/skills`) dan `~/.gemini/config/mcp_config.json` hanya bila Antigravity terdeteksi (`~/.gemini`), aturan yang sama dengan `setup install`; bila tidak, dicetak "skipped (... not detected)". Dampak perilaku yang perlu diketahui: pengguna Codex yang memiliki `~/.codex` tetapi belum punya `~/.codex/skills` tidak lagi mendapat pengikatan proyek otomatis sampai `setup install` mendeteksinya (CHANGELOG mencatat ini). Config proyek (`.mcp.json`, opencode) tidak terpengaruh.

**Uji dan verifikasi.** Berkas baru `test/f16-followup.test.ts` (6 tes): tidak ada sisa `plan lock`/`exec lock` selain kalimat tombstone di seluruh bridge dan skill; kalimat tombstone terjaga; `close lock` utuh; paragraf `--related-artifact` ada di setiap bridge yang punya bagian handoff; `project start`/`sync` tidak membuat `~/.codex`/`~/.gemini` bila tidak terdeteksi dan menulis entri terikat bila terdeteksi. Hasil: `tsc` bersih, `dist/` dibangun ulang, suite 75 berkas / 1.141 tes hijau pada dua run berturut-turut. **Satu run penuh sebelumnya melaporkan 1 tes gagal yang tidak teridentifikasi** (keluaran hanya diringkas); tiga run sesudahnya, termasuk satu dengan keluaran disimpan, hijau penuh. Dugaan: tes yang sensitif waktu (suite memakai mutasi kontrol 250 ms dan ratusan proses CLI), tetapi belum dibuktikan; bila muncul lagi, tangkap nama tesnya.
