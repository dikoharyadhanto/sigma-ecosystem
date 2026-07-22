# PLAN-EVAL-03 — Wiring Instalasi & Registrasi `sigma-mcp` ke AI Client

**Sumber**: Sesi Professional Mode 2026-07-22 — kelanjutan audit MCP.
Director: "saya mau mcp server sigma full ready termasuk plan-eval terkait
pemasangan setup sigma, edit readme dll."
**Tanggal**: 2026-07-22
**Status**: KEPUTUSAN LENGKAP — 7/7 keputusan tercatat Director (5 awal
2026-07-22 + 2 konfirmasi pasca-riset + 1 tambahan uninstall cleanup
2026-07-22). Siap eksekusi. Riset format untuk **kelima platform**
(`RISET-INSTALASI-MCP-CLIENT-2026-07-22.md`, diperluas mencakup Cursor di
sesi lanjutan tanggal yang sama) sudah diserap ke plan ini (lihat "Riset
Format Terverifikasi", "Arsitektur Trigger").
**Catatan**: Disusun Professional Mode. Bukan FMN-PLAN Sigma; tidak punya
otoritas lock/gate Sigma.
**Berpasangan dengan**: `PLAN-EVAL-02-GOVERNANCE-DOC-PROPAGATION.md` — plan
itu menutup dokumentasi/rule; plan ini menutup **wiring kode instalasi**
(sengaja dipisah di §Di luar scope PLAN-EVAL-02 karena profil risikonya beda:
perubahan kode vs perubahan redaksional).
**Riset rujukan**: `RISET-INSTALASI-MCP-CLIENT-2026-07-22.md` (folder ini) —
riset format konkret untuk **kelima platform**: Claude Code, Codex CLI,
Reasonix, Antigravity, dan Cursor (ditambahkan di sesi lanjutan tanggal yang
sama). Menggantikan seluruh asumsi "belum terverifikasi" di draft plan ini
sebelumnya. Satu catatan reliabilitas: sumber Cursor bukan dokumentasi resmi
(halaman resmi client-rendered, fetch gagal) — ditriangulasi dari beberapa
sumber pihak ketiga yang sepakat soal format file, tapi berbeda soal detail
UI dan angka batas tool. Lihat §Riset Format Terverifikasi.

---

## ⚠️ Baca dulu — ini bersinggungan langsung dengan keputusan Director 8 hari lalu

`Implementation/planned_sigma_evaluation_2026_07_14/PLAN-EVAL-07-MCP-LEGACY-REMOVAL.md`
(2026-07-14, **Tahap 1-7 sudah diimplementasikan, `npm test` 131/131 lulus**)
menghapus **total** seluruh penulisan config MCP otomatis dari `sigma project
start`/`sigma setup install`: `.mcp.json`, `.vscode/mcp.json`,
`writeReasonixMcpConfig`, `writeGeminiMcpConfig`, seluruh `src/utils/mcp.ts`.
Verifikasi hari ini mengonfirmasi itu masih bersih — nol kode MCP di
`src/commands/project.ts`, tidak ada `.mcp.json` di root repo ini.

**Plan ini secara harfiah mengusulkan menulis ulang `.mcp.json` saat `project
start`** — persis mekanisme yang dihapus PLAN-EVAL-07. Sebelum melanjutkan,
penting dipahami *kenapa* ini bukan sekadar membalikkan keputusan itu:

| | PLAN-EVAL-07 (dihapus) | PLAN-EVAL-03 (diusulkan) |
|---|---|---|
| Yang dikonfigurasi | MCP server **pihak ketiga**: `sequential-thinking` (`npx`), wrapper Reasonix, format protobuf Antigravity | MCP server **native milik Sigma sendiri**: `sigma-mcp`, bin entry yang sudah ada di `package.json` paket ini |
| Alasan dihapus | `sequential-thinking` **terkonfirmasi tidak terpakai** sepanjang evaluasi; menambah dependency `npx` yang tak perlu; Reasonix/Antigravity format rumit dan rapuh (protobuf `$typeName`, wrapper script) | — |
| Prinsip Director tercatat di PLAN-EVAL-07 | "MCP total" = *client config pihak ketiga legacy*, **bukan pernyataan arah anti-MCP secara umum** — PLAN-MCP-1 (server native) eksplisit dinyatakan tetap valid, sengaja ditunda, sengaja **dimulai dari nol**, tidak melanjutkan sisa `mcp.ts` | Konsisten dengan prinsip itu: `sigma-mcp` sudah dibangun dari nol di `src/mcp/` (PLAN-EVAL-01/PLAN-IMPL-01), sama sekali tidak menyentuh atau membangkitkan kembali `mcp.ts` yang dihapus |

Kesimpulan: plan ini **konsisten** dengan keputusan PLAN-EVAL-07 sepanjang
dibatasi ketat ke registrasi `sigma-mcp` sendiri — bukan membuka pintu balik
untuk MCP pihak ketiga apa pun. Batasan ini dijadikan Prinsip Desain di bawah
dan wajib dijaga selama implementasi.

**Keputusan Director (2026-07-22)**: dikonfirmasi — PLAN-EVAL-07 dianggap
**usang** untuk bagian penulisan config MCP; plan ini menulis ulang mekanisme
itu dari awal. Bagian ⚠️ di atas dipertahankan sebagai konteks historis, tidak
lagi sebagai batasan yang mengikat. Lihat "Keputusan Director Tercatat" §1.

---

## Riset Format Terverifikasi

`RISET-INSTALASI-MCP-CLIENT-2026-07-22.md` (folder ini) — web search +
fetch dokumentasi resmi tiap client, tanggal riset 2026-07-22. Ringkasan
field yang relevan untuk `sigma-mcp` (server stdio murni, tanpa env var
wajib):

| Platform | File config | Format | Sifat file |
|---|---|---|---|
| Claude Code | `.mcp.json` (project root) | JSON `mcpServers` | **Project-scoped**, git-shareable |
| Reasonix | (baca `.mcp.json` yang sama, otomatis) | — | **Free ride** — nol kode tambahan |
| Cursor | `.cursor/mcp.json` (project) — format **identik** `.mcp.json` | JSON `mcpServers` | **Project-scoped** — file terpisah, isi bisa disalin persis dari `.mcp.json` |
| Codex CLI | `~/.codex/config.toml` (global) *atau* `.codex/config.toml` (project, **trusted-only**) | TOML `[mcp_servers.sigma]` | Dua opsi — lihat §Arsitektur Trigger |
| Antigravity | `~/.gemini/config/mcp_config.json` | JSON `mcpServers` | **Global/shared** — satu file untuk semua proyek di mesin itu, bukan per-proyek |

Reliabilitas sumber tidak seragam: Claude Code/Codex/Reasonix/Antigravity
dari dokumentasi resmi. **Cursor dari sumber pihak ketiga** — halaman resmi
`docs.cursor.com/context/mcp` client-rendered, fetch langsung gagal.
Beberapa sumber independen sepakat soal lokasi file & format (`mcpServers`,
sama persis Claude Code), tapi berbeda soal detail UI (nama menu berubah
antar versi) dan batas jumlah tool gabungan (40 vs 80 — tidak relevan untuk
5 tool `sigma-mcp` saat ini). Bagian format/lokasi file dipakai untuk plan
ini karena konsisten lintas sumber; detail UI diabaikan (implementasi lewat
tulis-file langsung, bukan lewat menu).

Field yang dibutuhkan sama secara konsep di semua platform: `command` +
`args` (untuk `sigma-mcp`: `"command": "sigma-mcp"`, tanpa `args`, sesuai
keputusan Director "asumsikan global" — lihat §Keputusan Director Tercatat
butir 4). Yang beda cuma wadah (JSON vs TOML) dan lokasi file.

---

## Arsitektur Trigger: Project-Scoped vs Global-Scoped

Ini jawaban langsung untuk pertanyaan Director "harus dilakukan otomatis
saat `sigma setup` atau `sigma project sync`, saya tidak tahu kapan
tepatnya". Jawabannya **tidak tunggal** — tergantung sifat file config tiap
platform (kolom "Sifat file" di tabel atas):

- **File yang inherently project-scoped** (`.mcp.json`/`.cursor/mcp.json`
  — beda isi wajar antar proyek, git-shareable ke rekan tim) → ditulis di
  **`sigma project start`** (proyek baru) dan **`sigma project sync`**
  (proyek existing). Ini mencakup **Claude Code + Reasonix + Cursor** — dua
  file (`.mcp.json`, `.cursor/mcp.json`) dengan isi identik, tiga platform
  (Reasonix baca `.mcp.json` langsung, tidak butuh file sendiri).
- **File yang inherently global/shared** (`~/.gemini/config/mcp_config.json`
  — satu file untuk *semua* proyek Sigma di mesin itu, menulisnya ulang di
  setiap `project start` cuma mengulang upsert yang sama tanpa manfaat
  tambahan) → ditulis di **`sigma setup install`** (sekali) dan
  **`sigma setup update`** (refresh) — pola yang **persis sama** dengan cara
  `detectTools()`/`targetPaths()` sudah mendeploy skill file ke
  `~/.claude/commands/`, `~/.codex/skills/`, dll. hari ini. Ini mencakup
  **Antigravity**.
- **Codex CLI ada di kedua opsi** (global `~/.codex/config.toml` vs project
  `.codex/config.toml`) — project-scope dilaporkan **trusted-only**, artinya
  ada gerbang "trust" yang perilakunya tidak dikonfirmasi riset ini (apakah
  config diam-diam tidak terbaca untuk proyek yang belum ditandai trusted).
  **Rekomendasi**: pilih **global** (`~/.codex/config.toml`, trigger `setup
  install`/`update`) untuk menghindari kegagalan senyap itu — konsisten
  dengan pola Antigravity. Trade-off: kehilangan git-shareability project
  scope yang dimiliki `.mcp.json`. Ini keputusan desain, bukan fakta
  terverifikasi — tercatat di §Keputusan Director Tercatat sebagai
  rekomendasi yang perlu dikonfirmasi/dikoreksi Director.
- **Cwd bukan masalah untuk kedua pola.** Baik project-scoped maupun
  global-scoped, `command: "sigma-mcp"` (bare, resolvable via `PATH`) tidak
  membawa `cwd` eksplisit — client-lah yang menentukan working directory
  subprocess saat spawn (lazimnya = root workspace/proyek yang sedang
  dibuka). Ini asumsi yang **belum diverifikasi lewat pengujian nyata**
  (lihat Catatan Risiko) — bukan gagal-verifikasi seperti Cursor, tapi
  perilaku runtime yang perlu dicek manual sebelum Stage 2 dianggap selesai:
  buka dua proyek Sigma berbeda di client yang sama, konfirmasi
  `sigma_get_state` melapor proyek yang benar untuk masing-masing.
- **Isi `.mcp.json` melayani tiga platform sekaligus** (Claude Code +
  Reasonix + Cursor, dua file dengan konten identik) — temuan riset ini
  menyederhanakan Stage 2: hanya **4 fungsi tulis-config** yang benar-benar
  perlu diimplementasi (`.mcp.json`, `.cursor/mcp.json`,
  `~/.codex/config.toml`, `~/.gemini/config/mcp_config.json`), bukan 5 —
  dan dua di antaranya (`.mcp.json`/`.cursor/mcp.json`) berbagi payload
  JSON yang sama, cukup satu fungsi `buildMcpJsonPayload()` dipanggil dua
  kali dengan path tujuan berbeda.

---

## Inti

`sigma-mcp` sudah jadi dan teruji (lihat PLAN-EVAL-02), tapi tidak ada jalur
otomatis yang mendaftarkannya ke AI client. Director/pengguna harus tahu
sendiri format `.mcp.json` dan menuliskannya manual. Plan ini merancang jalur
`sigma project start` (dan `sigma project sync` untuk proyek existing) supaya
otomatis menulis config registrasi `sigma-mcp` — **hanya `sigma-mcp`, tidak
ada server lain** — plus bagian README yang menjelaskannya.

---

## Problem Statement

- Tidak ada onboarding: pengguna baru menjalankan `sigma project start` dan
  tidak mendapat apa pun yang membuat `sigma-mcp` langsung terlihat oleh AI
  client mereka.
- Format registrasi MCP **berbeda per platform**. **Update**: sudah
  diverifikasi ulang untuk kelima platform (Claude Code, Codex CLI,
  Reasonix, Antigravity, Cursor) lewat `RISET-INSTALASI-MCP-CLIENT-2026-07-22.md`
  (lihat §Riset Format Terverifikasi) — tidak lagi berdasar asumsi dari
  `mcp.ts` lama yang sudah dihapus.
- ~~README (`npm install -g sigma-cli`...) tidak punya section MCP~~ —
  **selesai** di eksekusi `PLAN-EVAL-02` (2026-07-22): section MCP baru
  ditambahkan, dan nama paket dicek — `npm view` mengonfirmasi `sigma-cli`
  **tidak pernah published dengan isi ini** (404, sisa nama package lama tak
  terkait yang di-unpublish 2023) sementara `sigma-ecosystem` juga belum
  published sama sekali. `package.json` `"name": "sigma-ecosystem"` tetap
  sumber kebenaran — README diperbaiki ke nama itu di 5 titik. Catatan:
  paket ini tampaknya **belum pernah dipublish ke npm registry publik**
  sama sekali di bawah nama manapun — di luar scope plan ini, tapi Director
  perlu tahu instruksi `npm install -g sigma-ecosystem` di README belum
  tentu berfungsi hari ini sampai publish pertama dilakukan.

---

## Prinsip Desain (batasan keras plan ini)

| Prinsip | Batasan konkret |
|---|---|
| **Native-only, tidak membangkitkan legacy** | Wiring ini HANYA mendaftarkan `sigma-mcp` milik paket ini sendiri. Dilarang keras menambahkan kembali `sequential-thinking`, wrapper Reasonix, atau format protobuf Antigravity yang sudah sengaja dihapus PLAN-EVAL-07. |
| Verifikasi format, jangan asumsikan | Format config MCP tiap platform harus diverifikasi ulang terhadap dokumentasi/perilaku platform saat ini sebelum coding — **status**: selesai untuk kelima platform (Claude Code/Codex/Reasonix/Antigravity/Cursor) via riset 2026-07-22. Cursor bersumber dari pihak ketiga (bukan dokumentasi resmi) — format/lokasi file dipakai karena konsisten lintas sumber, detail UI diabaikan (lihat §Riset Format Terverifikasi). |
| Idempoten & tidak merusak edit manual pengguna | Kalau file config (project atau global) sudah ada dan berisi entri lain (server MCP milik pengguna sendiri, bukan Sigma), penulisan wiring ini harus **merge** per-key, bukan overwrite penuh file — berlaku untuk JSON (`.mcp.json`, `.cursor/mcp.json`, `mcp_config.json`) maupun TOML (`config.toml`). |
| Semua platform di increment pertama (**keputusan Director**) | Cakupan: Claude Code, Codex CLI, Antigravity, Reasonix, Cursor — kelima platform, sekaligus. Tidak ada lagi platform yang dikecualikan increment ini setelah riset Cursor selesai. |
| File project-scoped vs global-scoped punya trigger berbeda | Lihat §Arsitektur Trigger — bukan satu command tunggal untuk semua platform, tapi dipilih berdasarkan sifat file config tiap platform. |
| `sigma-mcp` harus resolvable | Config yang ditulis harus mengasumsikan cara instalasi yang benar-benar berlaku (global install `-g` vs `npx`) — jangan menulis `"command": "sigma-mcp"` kalau instalasi pengguna belum tentu taruh binary itu di `PATH`. |

---

## Temuan Audit Tambahan (dasar plan ini)

- `src/commands/project.ts` — dikonfirmasi nol kode MCP (bersih pasca
  PLAN-EVAL-07); tidak ada fungsi `writeMcpJson`/`writeVscodeMcpJson` tersisa
  untuk di-reuse maupun dijadikan referensi bug lama.
- Root repo ini sendiri tidak punya `.mcp.json` — konsisten dengan Tahap 2
  PLAN-EVAL-07.
- `src/utils/detect.ts` (`detectTools()`/`targetPaths()`) **masih ada dan
  aktif** (dipakai jalur deploy skill `arc.md`/`fmn.md`/dst., sengaja
  dipertahankan per Tahap 7 PLAN-EVAL-07). Infrastruktur deteksi platform ini
  bisa dipakai ulang untuk menentukan platform mana yang perlu ditulisi
  config MCP — tidak perlu dibangun dari nol.
- `src/mcp/shared.ts` `resolveRoot()` memakai `findProjectRoot()` (walk-up
  dari cwd, mekanisme sama seperti CLI `sigma`) — mengonfirmasi
  `.mcp.json` **project-root-scoped** (bukan config global) adalah desain
  yang benar: proses `sigma-mcp` yang dijalankan client dari cwd project akan
  otomatis menemukan `Sigma/progress-v<N>.json` proyek yang benar.
- `test/role-memory-bootstrap.test.ts:41` saat ini menegaskan `.mcp.json`
  **tidak ada** setelah `project start`
  (`expect(fs.existsSync(...)).toBe(false)`). Plan ini akan membalik
  assertion itu — perubahan test yang harus tercatat eksplisit, bukan
  modifikasi diam-diam (pola yang sama seperti disyaratkan Tahap 1
  PLAN-EVAL-07 dulu untuk perubahan searah sebaliknya).

---

## Scope

### Dalam scope

- **Stage 1** — Freeze 4 fungsi tulis-config berdasarkan riset yang sudah
  ada (lihat §Riset Format Terverifikasi, §Arsitektur Trigger): `.mcp.json`
  dan `.cursor/mcp.json` (Claude Code + Reasonix + Cursor, payload JSON
  sama), `~/.codex/config.toml` (Codex, global — lihat rekomendasi di
  §Arsitektur Trigger), `~/.gemini/config/mcp_config.json` (Antigravity,
  global). Putuskan library TOML (lihat Task Breakdown Stage 1 — dependency
  baru, perlu persetujuan Director sebelum `npm install`).
- **Stage 2** — Implementasi `.mcp.json` dan `.cursor/mcp.json` di jalur
  **project-scoped**: `sigma project start` (proyek baru) + `sigma project
  sync` (proyek existing). Merge-aware, per file.
- **Stage 3** — Implementasi `~/.codex/config.toml` +
  `~/.gemini/config/mcp_config.json` di jalur **global-scoped**:
  `sigma setup install` (sekali) + `sigma setup update` (refresh),
  memakai pola yang sama dengan `detectTools()`/`targetPaths()` yang sudah
  mendeploy skill file hari ini. Merge-aware per key.
- **Stage 4** — Command string: **`"command": "sigma-mcp"`** (bare, asumsi
  global install, keputusan Director butir 4). Tidak ada logika fallback
  `npx`. CLI warn (bukan error fatal) di `setup install`/`project start`
  kalau `sigma-mcp` tidak resolvable di `PATH` saat itu.
- **Stage 5** — Update test `role-memory-bootstrap.test.ts` (assertion
  `.mcp.json` tidak ada → dibalik) + test baru untuk ketiga fungsi tulis
  config (merge-aware, idempoten, tidak menghapus entri pengguna lain).
- **Stage 6** — README: revisi section MCP dari `PLAN-EVAL-02` supaya tidak
  lagi menyuruh pendaftaran manual sebagai langkah utama untuk keempat
  platform yang sudah diotomasi (Claude Code, Codex, Antigravity, Reasonix)
  — Cursor tetap manual karena masih gap.
- **Stage 7** — Verifikasi manual perilaku cwd-inheritance untuk registrasi
  global (Codex, Antigravity) — lihat §Arsitektur Trigger poin cwd. Wajib
  sebelum Stage 3 dianggap selesai untuk kedua platform itu.
- **Stage 8** — Uninstall cleanup: `sigma setup uninstall` harus
  **menghapus entri `sigma`** dari keempat file config MCP yang ditulisnya
  (`.mcp.json` project-scoped tidak bisa dibersihkan oleh uninstall karena
  per-proyek — lihat §Task Breakdown Stage 8). Tujuan: mencegah leftover
  entri `sigma-mcp` yang tidak bisa di-start setelah sigma di-uninstall
  (binary hilang, config masih ada → AI client terus mencoba spawn
  `sigma-mcp`, gagal diam-diam atau error).

### Di luar scope (untuk increment ini)

- Apa pun yang menghidupkan kembali `sequential-thinking`, wrapper Reasonix,
  atau format protobuf Antigravity — dilarang total per §Prinsip Desain.
- Detail UI Cursor (nama menu Settings, dsb.) — implementasi lewat
  tulis-file langsung ke `.cursor/mcp.json`, tidak lewat menu, jadi detail
  UI yang tidak konsisten antar sumber riset tidak relevan untuk plan ini.
- Codex CLI **project-scoped** (`.codex/config.toml`) sebagai opsi kedua —
  rekomendasi plan ini adalah global saja (lihat §Arsitektur Trigger); kalau
  Director lebih memilih project-scope demi git-shareability, itu jadi
  perubahan scope yang perlu dicatat ulang, bukan default diam-diam.

---

## Task Breakdown

### Stage 1 — Freeze Modul & Dependency

- Modul baru (nama disarankan tidak memakai nama `mcp.ts` lama untuk
  menghindari kerancuan dengan modul yang sudah dihapus PLAN-EVAL-07) berisi
  4 fungsi tulis + 2 fungsi hapus:
  - **Tulis**: `writeClaudeMcpConfig` (JSON, `.mcp.json`),
    `writeCursorMcpConfig` (JSON, `.cursor/mcp.json` — reuse payload builder
    yang sama dengan `writeClaudeMcpConfig`, path tujuan beda),
    `writeCodexMcpConfig` (TOML, `~/.codex/config.toml`),
    `writeAntigravityMcpConfig` (JSON, `~/.gemini/config/mcp_config.json`).
  - **Hapus**: `removeCodexMcpConfig` (hapus key `sigma` dari TOML global),
    `removeAntigravityMcpConfig` (hapus key `sigma` dari JSON global). Kedua
    fungsi hapus ini dipanggil oleh `sigma setup uninstall` (Stage 8).
- **Dependency baru**: JSON pakai `fs-extra` yang sudah ada (nol dependency
  baru). TOML butuh library parser/serializer — **`smol-toml` atau
  `@iarna/toml`** karena `.codex/config.toml` bisa berisi setting Codex lain
  milik pengguna — string manipulation manual berisiko merusaknya.
  **Disetujui Director 2026-07-22** (lihat Keputusan Director butir 6) —
  tambahkan ke `package.json` sebelum coding Stage 2-3.

### Stage 2 — Implementasi `.mcp.json` & `.cursor/mcp.json` (project-scoped)

- Tambahkan `writeClaudeMcpConfig()` dan `writeCursorMcpConfig()` ke jalur
  `sigma project start` (proyek baru) dan `sigma project sync` (proyek
  existing, command yang sudah ada — **keputusan Director**, tidak ada
  command baru).
- Merge-aware per file: baca file existing kalau ada, tambah/replace hanya
  key `sigma`, simpan entri MCP server lain milik pengguna apa adanya.
  Kedua file independen — `.cursor/mcp.json` tidak ada bukan berarti
  `.mcp.json` gagal ditulis atau sebaliknya.

### Stage 3 — Implementasi Codex + Antigravity (global-scoped)

- Tambahkan `writeCodexMcpConfig()` + `writeAntigravityMcpConfig()` ke jalur
  `sigma setup install` (sekali) dan `sigma setup update` (refresh) —
  lokasi kode berdekatan dengan `detectTools()`/`targetPaths()` yang sudah
  mendeploy skill file, reuse deteksi platform yang sama (`fs.existsSync`
  terhadap `~/.codex/`, `~/.gemini/`).
- Merge-aware per key, sama seperti Stage 2.
- Verifikasi manual cwd-inheritance (§Arsitektur Trigger) sebelum stage ini
  ditutup untuk kedua platform.

### Stage 4 — `command` Resolution

- **Keputusan Director**: `"command": "sigma-mcp"` bare, asumsi global
  install. Tidak ada logika fallback `npx`.
- Tambahkan pengecekan `sigma-mcp` resolvable di `PATH` sebelum menulis
  config (di `project start`/`sync` dan `setup install`/`update`) — kalau
  tidak resolvable, tulis config tetap (biar siap begitu diinstall global),
  tapi tampilkan warning eksplisit ke pengguna saat itu juga.

### Stage 5 — Test

- Update `test/role-memory-bootstrap.test.ts:41` (balik assertion) +
  tambah test baru per fungsi tulis-config: merge-aware tidak menghapus
  entri MCP server pihak ketiga yang sudah ada milik pengguna, idempoten
  (jalankan dua kali, hasil sama), format valid (JSON parse / TOML parse
  balik ke struktur yang benar).

### Stage 6 — README

- Revisi section MCP dari `PLAN-EVAL-02` (yang mendokumentasikan cara
  manual) supaya tidak lagi menyuruh pendaftaran manual sebagai langkah
  utama untuk kelima platform (Claude Code, Cursor, Codex, Antigravity,
  Reasonix) — semuanya sudah otomatis setelah plan ini selesai.

### Stage 7 — Verifikasi Manual cwd-Inheritance

- Buka dua proyek Sigma berbeda di client yang sama (minimal Claude Code;
  Codex/Antigravity kalau tersedia), konfirmasi `sigma_get_state` melapor
  proyek yang benar untuk masing-masing — bukan silang atau "no active
  project" yang salah.

### Stage 8 — Uninstall Cleanup

**Konteks**: `sigma-mcp` tidak berguna kalau sigma sudah di-uninstall —
binary `sigma-mcp` hilang dari `PATH`, tapi entri config di AI client masih
ada. Client akan terus mencoba spawn `sigma-mcp`, gagal setiap sesi (error
diam-diam atau spawn error). Ini sampah yang perlu dibersihkan.

**Cakupan cleanup**:

| Config | Command pembersih | Cara hapus |
|---|---|---|
| `~/.codex/config.toml` | `sigma setup uninstall` | Hapus key `[mcp_servers.sigma]` — TOML merge-delete, sisa file utuh |
| `~/.gemini/config/mcp_config.json` | `sigma setup uninstall` | Hapus key `sigma` dari `mcpServers` — JSON merge-delete, sisa file utuh |
| `.mcp.json` (project root) | **Tidak bisa** — per-proyek, jumlah proyek tidak diketahui saat uninstall | Fallback: beri pesan ke pengguna saat `setup uninstall` selesai |
| `.cursor/mcp.json` (project root) | **Tidak bisa** — sama, per-proyek | Fallback: sama |

**Detail implementasi**:

- `sigma setup uninstall` panggil `removeCodexMcpConfig()` dan
  `removeAntigravityMcpConfig()` setelah langkah cleanup lain yang sudah
  ada (skill files, dll.) — di blok yang sama, bukan command terpisah.
- Kedua fungsi hapus: baca file → hapus key `sigma` → tulis ulang. Kalau
  file tidak ada atau key tidak ada: no-op (tidak error).
- Setelah cleanup global selesai, `setup uninstall` **cetak pesan**
  menginformasikan pengguna bahwa `.mcp.json` dan `.cursor/mcp.json` di
  masing-masing proyek Sigma **tidak bisa dibersihkan otomatis** dan perlu
  dihapus/diedit manual kalau sigma tidak akan dipakai lagi.
- **Test**: `removeCodexMcpConfig` dan `removeAntigravityMcpConfig` ditest
  untuk: file ada + key ada (hapus key, sisa file utuh), file ada + key
  tidak ada (no-op), file tidak ada (no-op). Idempotensi: jalankan dua
  kali, hasil sama.

---

## Catatan Risiko

- **Optik "membalikkan keputusan Director."** Walau secara prinsip berbeda
  (native vs pihak ketiga), penulisan ulang `.mcp.json` otomatis akan
  *terlihat* seperti membalikkan PLAN-EVAL-07 kalau tidak dijelaskan
  konteksnya. Mitigasi: bagian ⚠️ di atas wajib tetap ada di draft final
  plan ini sampai Director eksplisit mengonfirmasi paham bedanya.
- **Overwrite config pengguna.** Kalau implementasi tidak benar-benar
  merge-aware, `project start` bisa menghapus server MCP pihak ketiga yang
  sudah dikonfigurasi pengguna sendiri di proyek itu — regresi UX yang jauh
  lebih buruk daripada tidak menulis apa pun.
- **Asumsi format usang** — **teratasi** untuk kelima platform lewat riset
  2026-07-22 (bukan lagi menyalin `mcp.ts` yang sudah dihapus).
- **Reliabilitas sumber Cursor lebih rendah dari platform lain.** Empat
  platform lain bersumber dari dokumentasi resmi; Cursor dari beberapa
  sumber pihak ketiga (dokumentasi resmi client-rendered, fetch gagal).
  Format file (`mcpServers`, lokasi `.cursor/mcp.json`) konsisten di semua
  sumber yang ditemukan — dipakai untuk implementasi. Detail yang **tidak**
  konsisten (nama menu UI, batas jumlah tool 40 vs 80) sengaja tidak
  dipakai (lihat §Di luar scope). Kalau implementasi nyata menemukan format
  file berbeda dari yang direset, ini akan gagal jelas (JSON tidak terbaca
  Cursor) — bukan gagal senyap.
- **Batas jumlah tool gabungan Cursor** (~40-80 menurut sumber yang
  berbeda-beda) — tidak relevan untuk 5 tool `sigma-mcp` saat ini, tapi
  perlu diingat kalau kelak `sigma_read_artifact`/`sigma_get_role_memory`/dll.
  (Layer 1 lanjutan atau Layer 2/3) ditambah sambil MCP server lain juga
  aktif di proyek yang sama.
- **Dependency TOML baru** — `.codex/config.toml`/`~/.codex/config.toml`
  bisa berisi setting Codex lain milik pengguna di luar `[mcp_servers]`.
  String manipulation manual (regex/replace) berisiko merusak struktur TOML
  yang valid. Perlu library TOML asli (`smol-toml`/`@iarna/toml`) dan
  persetujuan Director sebelum `npm install` (lihat Task Breakdown Stage 1).
- **Trust-gating Codex project-scope tidak terverifikasi.** Riset melaporkan
  `.codex/config.toml` project-scoped "trusted-only" tanpa detail perilaku
  saat proyek belum trusted (config diam-diam diabaikan? error? prompt?).
  Rekomendasi plan ini (global-scope untuk Codex) menghindari risiko ini
  sepenuhnya — tapi kalau Director nanti memilih project-scope demi
  git-shareability, perilaku trust-gating ini wajib diverifikasi dulu
  sebelum implementasi, bukan diasumsikan aman.
- **Cwd-inheritance untuk registrasi global belum diuji nyata.** Asumsi
  bahwa client (Codex, Antigravity) men-spawn `sigma-mcp` dengan cwd =
  workspace yang sedang dibuka masuk akal secara desain MCP umum, tapi
  belum ada bukti langsung untuk kedua client ini. Kalau asumsi salah,
  registrasi global akan selalu resolve ke satu proyek yang salah (atau
  "no active project") untuk semua proyek Sigma di mesin itu — regresi
  serius yang baru kelihatan saat dipakai nyata, bukan saat coding. Mitigasi:
  Stage 7 (verifikasi manual) wajib, bukan opsional.
- **`sigma-mcp` tidak resolvable.** **Keputusan Director**: asumsikan
  global, jadi ini bukan lagi hal yang perlu dicegah di Stage 2 — tapi kalau
  pengguna install lokal/non-standar, `"command": "sigma-mcp"` akan gagal
  start server di sisi client. Risiko diterima Director, tapi CLI tetap
  sebaiknya mendeteksi kasus ini saat `project start`/`sync` (mis. cek
  `sigma-mcp` resolvable di `PATH` sebelum menulis config, warn kalau tidak)
  supaya kegagalannya terlihat saat setup, bukan diam-diam gagal di client
  nanti.

---

## Draft Acceptance Criteria

- [ ] `.mcp.json` dan `.cursor/mcp.json` yang ditulis `project start`/
      `project sync` **hanya** berisi entri `sigma` — nol referensi ke
      server pihak ketiga apa pun.
- [ ] `~/.codex/config.toml` dan `~/.gemini/config/mcp_config.json` yang
      ditulis `setup install`/`setup update` **hanya** menambah/upsert key
      `sigma` — sisa konten file (setting lain milik pengguna) utuh.
- [ ] Penulisan merge-aware di keempat fungsi: entri MCP server lain milik
      pengguna tidak terhapus/tertimpa, diverifikasi lewat test idempotensi
      (jalankan dua kali, hasil sama) dan test non-destruktif (file berisi
      entri lain sebelum ditulis, entri itu masih ada sesudahnya).
- [ ] `test/role-memory-bootstrap.test.ts` diupdate eksplisit (bukan
      modifikasi diam-diam) untuk mencerminkan perilaku baru.
- [ ] Verifikasi manual Stage 7: dua proyek Sigma berbeda, `sigma_get_state`
      melapor proyek yang benar di masing-masing, untuk Claude Code minimal
      (Cursor/Codex/Antigravity kalau tersedia saat verifikasi).
- [ ] README punya instruksi yang konsisten dengan perilaku otomatis untuk
      kelima platform (Claude Code, Cursor, Codex, Antigravity, Reasonix).
- [ ] `npm test` penuh lulus (termasuk test yang sengaja disesuaikan,
      tercatat eksplisit di acceptance criteria — bukan modifikasi tak
      terlacak).
- [ ] **Uninstall cleanup (Stage 8)**: `sigma setup uninstall` menghapus key
      `sigma` dari `~/.codex/config.toml` dan
      `~/.gemini/config/mcp_config.json` — sisa konten file utuh, tidak ada
      data pengguna lain yang ikut terhapus.
- [ ] `sigma setup uninstall` mencetak pesan yang menginformasikan pengguna
      bahwa `.mcp.json` dan `.cursor/mcp.json` di proyek-proyek Sigma tidak
      dibersihkan otomatis (perlu manual).
- [ ] Test fungsi hapus (no-op kalau file/key tidak ada, merge-delete kalau
      ada, idempoten).

---

## Keputusan Director Tercatat

Diputuskan Director 2026-07-22, 5 dari 5 pertanyaan terjawab:

1. **Pemahaman PLAN-EVAL-07** — **dikonfirmasi**: kerangka batasan (native
   `sigma-mcp` saja, tidak membangkitkan legacy pihak ketiga) tidak perlu
   diperketat lebih jauh. Director secara eksplisit menyatakan
   **PLAN-EVAL-07 dianggap usang** untuk bagian penulisan config MCP —
   plan ini menulis ulang mekanisme itu dari awal. Bagian ⚠️ di atas tetap
   dipertahankan sebagai catatan sejarah/konteks (kenapa mekanisme lama
   dihapus, kenapa yang baru ini beda), bukan sebagai batasan yang masih
   mengikat implementasi.
2. **Cakupan platform increment pertama** — **semua platform** diriset dan
   diimplementasi sekaligus, bukan Claude Code dulu. **Update pasca-riset
   2026-07-22 (final)**: `RISET-INSTALASI-MCP-CLIENT-2026-07-22.md` diperluas
   di sesi lanjutan tanggal yang sama untuk mencakup Cursor — kelima
   platform (Claude Code, Codex CLI, Antigravity, Reasonix, Cursor) kini
   punya format terverifikasi. "Semua platform" berarti 5 dari 5.
3. **Proyek existing (Stage 3)** — **`sigma project sync`** (command yang
   sudah ada). Tidak ada command baru. Digabung dengan `sigma project start`
   untuk proyek baru — dua command project-level yang sudah ada menutup
   seluruh siklus (baru + existing), tanpa permukaan CLI baru.
4. **Strategi `command` (Stage 4)** — **asumsikan global**. `"command":
   "sigma-mcp"` mengandalkan `PATH`, tidak ada fallback `npx`. CLI tetap
   perlu warn saat `project start`/`sync` kalau `sigma-mcp` tidak resolvable
   (lihat Catatan Risiko) supaya kegagalan terlihat saat setup.
5. **Nama paket README** — **selesai**, dieksekusi sebagai bagian follow-up
   `PLAN-EVAL-02` (2026-07-22): `package.json` `"name": "sigma-ecosystem"`
   dikonfirmasi sebagai sumber kebenaran, README diperbaiki di 5 titik
   (`sigma-cli` → `sigma-ecosystem`). Temuan tambahan: `npm view` terhadap
   registry publik menunjukkan **kedua nama itu (`sigma-ecosystem` dan
   `sigma-cli`) tidak published** hari ini — `sigma-cli` sempat ada tapi
   di-unpublish 2023 (paket lama tak terkait), `sigma-ecosystem` belum
   pernah dipublish sama sekali. Instruksi `npm install -g sigma-ecosystem`
   di README karena itu belum tentu berfungsi sampai publish pertama
   dilakukan — di luar scope plan ini, tapi Director perlu tahu.

Semua 5 pertanyaan awal terjawab.

6. **Codex CLI: global dikonfirmasi** — **dikonfirmasi Director 2026-07-22**:
   pilih `~/.codex/config.toml` (global) untuk Codex, bukan
   `.codex/config.toml` (project-trusted-only). Alasan: menghindari
   ketidakpastian perilaku "trusted-only" yang tidak terverifikasi. Trade-off
   kehilangan git-shareability diterima.

7. **Dependency TOML baru disetujui** — **disetujui Director 2026-07-22**:
   gunakan `smol-toml` atau `@iarna/toml` untuk parsing/serialization
   `~/.codex/config.toml`. Library dipilih saat Stage 1 (bandingkan size,
   ESM/CJS compatibility, maintenance status), `npm install` dijalankan
   setelah pilihan diputuskan.

8. **Uninstall cleanup (tambahan Director 2026-07-22)**: `sigma setup
   uninstall` **wajib membersihkan** entri `sigma` dari config MCP global
   yang ditulisnya (`~/.codex/config.toml`, `~/.gemini/config/mcp_config.json`)
   — binary `sigma-mcp` tidak ada setelah uninstall, entri config yang
   tersisa akan menyebabkan AI client terus gagal spawn server. Config
   project-scoped (`.mcp.json`, `.cursor/mcp.json`) tidak bisa dibersihkan
   otomatis (per-proyek, tidak diketahui saat uninstall) — diganti pesan
   informasi ke pengguna. Lihat §Task Breakdown Stage 8 untuk detail
   implementasi.

---

## Status Eksekusi

Semua 8 keputusan tercatat. Plan siap eksekusi. Urutan stage:
Stage 1 (freeze + dependency) → Stage 2 (project-scoped JSON) →
Stage 3 (global-scoped JSON+TOML) → Stage 4 (command resolution) →
Stage 5 (test) → Stage 6 (README) → Stage 7 (manual verify) →
Stage 8 (uninstall cleanup + test).
