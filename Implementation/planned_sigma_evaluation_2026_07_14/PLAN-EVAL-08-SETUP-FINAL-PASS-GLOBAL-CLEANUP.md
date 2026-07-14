# PLAN-EVAL-08 — Final Pass `sigma setup` & Pembersihan `~/.sigma/` Global

**Sumber**: `Discussion/sigma-system-evaluation-2026-07-14.md` (Topik 6, Topik 7)
**Tanggal**: 2026-07-14
**Status**: IMPLEMENTED (2026-07-14, Professional Mode) — lihat "Implementation Walkthrough" di akhir dokumen
**Urutan eksekusi**: 8 dari 8 — **DIKERJAKAN PALING AKHIR, SETELAH PLAN-EVAL-01 s/d 07 SELESAI**
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN, tidak punya otoritas lock/gate Sigma.

---

## Kenapa Dokumen Ini Dikerjakan Paling Akhir

`sigma setup install`/`update` menyentuh hampir seluruh keputusan yang sudah
dibuat sepanjang sesi evaluasi (CSO, MCP, roadmap, config bahasa, sync, dll).
Mengevaluasi/mengeksekusinya lebih awal berisiko tidak lengkap — dokumen
sumber eksplisit menunda topik ini ("Topik 6") sebagai meta-topik yang
sengaja dieksekusi di akhir, menyatu dengan Topik 7 (tujuan `~/.sigma/`
global, isolasi project, mekanisme uninstall) karena keduanya saling terkait
langsung.

**Prasyarat**: PLAN-EVAL-01 s/d PLAN-EVAL-07 harus sudah selesai diimplementasikan
sebelum memulai dokumen ini, supaya `setup` yang diperbarui benar-benar
mencerminkan state akhir sistem, bukan state parsial.

---

## Keputusan Sesi Diskusi (Professional Mode, 2026-07-14)

Sebelum implementasi dimulai, dokumen ini di-review ulang terhadap state kode
aktual (bukan cuma asumsi sesi evaluasi). Temuan dan keputusan tambahan:

1. **Dua item Bagian A ternyata sudah selesai lebih dulu**, bukan cuma
   diasumsikan — sudah diverifikasi langsung dari kode: entri
   `checkpoint`/`cso` di `ROLE_FILES` map sudah tidak ada (terhapus lewat
   commit `208a560`, follow-up PLAN-EVAL-05), dan Step E/E2 MCP config sudah
   tidak ada di `runInstall()` (terhapus lewat commit `9107168`, PLAN-EVAL-07).
   Checklist di bawah disesuaikan jadi `[x]`.
2. **Reasonix/Antigravity sebagai platform tujuan deploy skill — dipertahankan.**
   Keputusan Director: tetap dipertahankan penuh (ROLE_FILES, PLATFORM_LABELS,
   PLATFORM_SOURCE_DIR tidak berubah untuk kedua platform ini). Urusan ini
   terbukti terpisah bersih dari MCP yang sudah dihapus — tidak ada perubahan
   diperlukan.
3. **Temuan baru (tidak tercakup analisis 7-fungsi `~/.sigma/` sesi evaluasi)**:
   `~/.sigma/projects.json` ternyata juga dipakai sebagai fallback identitas
   oleh `sigma doctor --reconstruct` ([doctor.ts:77-96](../../src/commands/doctor.ts#L77-L96))
   saat `progress.json` tidak terbaca dan Director tidak memberi `--id`/`--name`
   manual. Keputusan Bagian B.1 direvisi untuk mengakomodasi ini — lihat
   sub-bagian "Desain `.sigma-identity.json`" di Bagian B.
4. **`sigma project start` deploy 5 bridge file, bukan 3.** Setelah Tahap B.3
   diperbaiki agar copy dari `~/.sigma/bridge/{file}` asli, kelima
   `BRIDGE_STUBS` (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `DEEPSEEK.md`,
   `REASONIX.md`) dideploy ke project baru — bukan cuma 3 seperti sekarang.
5. **Root `CLAUDE.md` project ini ikut diperbaiki sekalian** — punya frasa
   stale yang sama persis dengan bridge template (tabel `sigma refresh`
   dangling, kalimat `sigma memory --<role>` "after CLI support lands" padahal
   command itu sudah nyata ada). Di luar cakupan resmi plan tapi disatukan
   dalam PR yang sama untuk menghindari sumber stale yang tertinggal.

---

## Bagian A — Final Pass `sigma setup install`/`update`

### Cakupan yang Sudah Teridentifikasi

- `ROLE_FILES` map ([setup.ts:36-40](../../src/commands/setup.ts#L36-L40)) — entri `checkpoint`/`cso` untuk tiap platform. **Sudah selesai** (lihat Keputusan Sesi Diskusi #1).
- Step E & E2 Reasonix/Antigravity MCP config. **Sudah selesai** (lihat Keputusan Sesi Diskusi #1).
- Refactor skill+hook deployment jadi shared function `install`↔`update` (keputusan `install` vs `update` dari sesi evaluasi — lihat sub-bagian di bawah).
- **Sudah diputuskan** (lihat Keputusan Sesi Diskusi #2): Reasonix/Antigravity tetap dipertahankan sebagai platform tujuan deploy skill file — tidak ada perubahan.
- `sigma.config.json` global (`~/.sigma/`, di-seed `install`) dikonfirmasi **tidak terdampak** perubahan field bahasa (PLAN-EVAL-06 mengubah `Sigma/project.config.json`, file berbeda) — tidak perlu diubah di sini.

### Keputusan `install` vs `update` (dari sesi evaluasi, sudah final)

**Temuan teknis**: keduanya tidak redundan, tapi ada gap desain:
- `install` ([setup.ts:64-259](../../src/commands/setup.ts#L64-L259)): copy templates/rules/governance/bridge, seed `projects.json`/`sigma.config.json`, deteksi AI tool + deploy skill file, deploy hook `protect-sigma.js`.
- `update` ([setup.ts:325-393](../../src/commands/setup.ts#L325-L393)): backup `~/.sigma/` lama, copy templates/rules/governance/bridge, update `cli_version`. **Secara eksplisit TIDAK redeploy file skill maupun hook.**
- Akibatnya Director harus jalankan keduanya bersamaan tiap kali ada perbaikan skill — kebiasaan yang rasional, bukan sia-sia, hanya pembagian tugas command yang tidak match kebutuhan nyata.

**Keputusan**:
1. Kedua command **tetap dipertahankan terpisah** — `install` = first-time setup, `update` = sudah terpasang, butuh refresh.
2. `update` **diperluas** agar juga deploy file skill + hook (yang saat ini eksklusif `install`) — supaya `update` saja sudah cukup untuk kondisi "sudah install, mau update".

### Task Breakdown — Bagian A

- [x] **Sudah diputuskan** (sesi ini): Reasonix/Antigravity dipertahankan sebagai platform tujuan deploy skill — tidak ada perubahan kode diperlukan.
- [x] **Sudah selesai lebih awal**: entri `checkpoint`/`cso` sudah tidak ada di `ROLE_FILES` map (`setup.ts:36-40`) — terhapus lewat commit `208a560`.
- [x] **Sudah selesai lebih awal**: Step E ("Reasonix MCP config") dan Step E2 ("Antigravity MCP config") sudah tidak ada di `runInstall()` — terhapus lewat commit `9107168`.
- [x] **Sudah selesai lebih awal** (follow-up PLAN-EVAL-07, sesi yang sama, dikonfirmasi Director): `runMemorySetup()`/`sigma setup memory` dihapus total dari `setup.ts` — dikonfirmasi tidak ada consumer yang pernah membaca `memory_sigma.jsonl` sama sekali (satu-satunya jalur akses teoretis, MCP `server-memory`, sudah dihapus di PLAN-EVAL-07 utama). Ikut dihapus: `GLOBAL_MEMORY_FILE` (`config.ts`), `setup/sigma-memory-seed.jsonl`, wrapper orphan `scripts/mcp-run-memory.js`, entry `setup_memory` di `Sigma/SIGMA-OPERATION-REGISTRY.json`, dan section "Memory Isolation"/"Advanced: reseed ecosystem memory" di README.md serta 10 file bridge (root + template). Tidak ada sisa kerja untuk sub-item ini di Bagian A.
- [x] Refactor logika deteksi tool + deploy skill (Step B-D di `setup.ts`) dan deploy hook (`deployHook()`) dari `runInstall()` jadi fungsi bersama `deploySkillsAndHook()`, dipanggil dari `runInstall()` dan `runUpdate()`.
- [x] `update` sekarang auto-redeploy ke seluruh tool yang terdeteksi (tanpa prompt checkbox interaktif) — tidak butuh gate "Reinstall?" karena hanya refresh konten.
- [x] Catatan "skill files... NOT redeployed" dihapus dari pesan sukses `runUpdate()`.
- [x] README.md diupdate (SIGMA_PROTOCOL.md dicek — tidak ada referensi `setup install`/`update`/registry di file itu, tidak ada yang perlu diubah).

---

## Bagian B — Evaluasi Tujuan `~/.sigma/` Global, Isolasi Project, Mekanisme Uninstall

### Temuan Teknis (sudah diverifikasi dari kode)

`~/.sigma/` ditemukan punya 7 fungsi berbeda dalam satu folder: (1) sumber
template/rule live semua project, (2) sumber `project sync`, (3) registry
lintas-project (`projects.json`), (4) metadata instalasi CLI, (5) memory
ekosistem (`memory_sigma.jsonl`), (6) bridge stubs (template `CLAUDE.md`/dst.),
(7) hook `protect-sigma.js`.

### Keputusan per Bagian

1. **Registry lintas-project (`~/.sigma/projects.json`) — dihapus.** Director menilai tidak penting sebagai fungsi cross-project bookkeeping.
   **Revisi (sesi ini)**: registry global-nya dihapus total, tapi command
   `sigma project register` **tidak ikut dihapus** — direpurpose jadi tool
   repair/harvest untuk `.sigma-identity.json` lokal per-project (lihat
   sub-bagian "Desain `.sigma-identity.json`" di bawah). Alasan: registry
   global ternyata dipakai `sigma doctor --reconstruct` sebagai fallback
   identitas ([doctor.ts:77-96](../../src/commands/doctor.ts#L77-L96)) — temuan
   yang tidak tercakup analisis 7-fungsi awal. Registry global cross-project
   memang rapuh untuk kebutuhan ini (tidak ikut kalau project di-copy/clone ke
   mesin lain); file identity lokal yang ikut ter-commit ke git menyelesaikan
   kebutuhan yang sama dengan lebih robust, tanpa mempertahankan state global.

### Desain `.sigma-identity.json`

- **Lokasi**: root project (sejajar `CLAUDE.md`/`.git`, **bukan** di dalam
  `Sigma/`) — supaya recovery-nya tidak bergantung pada folder yang sama yang
  mungkin sedang korup.
- **Isi**: `{ "schema_version": "1.0.0", "project_id": "...", "project_name": "...", "registered": true }`.
  `registered` selalu `true` di setiap penulisan — bukan sekadar "file ada =
  terdaftar", tapi field eksplisit yang bisa dibaca langsung.
- **Ditulis oleh**:
  - `sigma project start` — sekali, saat project dibuat, bersamaan dengan `progress.json`.
  - `sigma project register` (repurposed) — repair/harvest tool. Membaca
    `Sigma/progress.json` (kalau valid) untuk sumber `project_id`/`project_name`,
    lalu menulis ulang `.sigma-identity.json`. Kalau `progress.json` juga
    tidak terbaca, minta `--id`/`--name` manual (pola sama dengan
    `doctor --reconstruct`). Berguna untuk: (a) memperbaiki file identity yang
    hilang/corrupt secara tidak sengaja, (b) backfill project lama yang dibuat
    sebelum fitur ini ada.
- **Dibaca oleh**: `resolveProjectIdentity()` di `doctor.ts`, sebagai fallback
  tier kedua. Urutan fallback baru: `Sigma/progress.json` → `.sigma-identity.json`
  → `--id`/`--name` manual (baris lookup ke registry global dihapus total).

2. **Memory ekosistem (`~/.sigma/memory_sigma.jsonl`) — sudah dihapus total** (follow-up PLAN-EVAL-07, sesi yang sama, dikonfirmasi Director). Awalnya diperkirakan cukup "jadi orphan, dibereskan sebagai bagian perbaikan bridge template" — setelah recek ulang, dikonfirmasi tidak ada satu pun consumer yang pernah membaca file ini (bahkan sebelum PLAN-EVAL-07: satu-satunya jalur akses teoretis adalah MCP `server-memory`, yang env `MEMORY_FILE_PATH`-nya hanya di-wire lewat adapter Reasonix/Antigravity yang sudah dihapus). Keputusan final: hapus mekanisme seluruhnya (bukan sekadar dibersihkan referensinya), lihat catatan Bagian A di atas untuk cakupan lengkap.

3. **Bridge stubs — diperbaiki total, bukan dihapus.** Template `setup/targets/bridge/{CLAUDE,GEMINI,AGENTS,DEEPSEEK,REASONIX}.md` adalah master template file instruksi AI per-project, isinya nyaris identik `CLAUDE.md` project ini. Ditemukan usang (section MCP Tooling/Memory Isolation menyebut fitur yang sudah dihapus, tabel CLI-Managed Files menyebut `sigma refresh` yang dangling, kalimat "`sigma memory --<role>` after CLI support lands" padahal command itu sudah ada). **Bug terpisah ditemukan**: `sigma project start` ([project.ts:243-250](../../src/commands/project.ts#L243-L250)) **tidak memakai template bridge ini sama sekali** — hanya menulis placeholder kosong, sehingga template lengkap ini terputus (orphaned) dari alur pembuatan project.

4. **Kekhawatiran kontaminasi ke setup AI tool global** — diinvestigasi lewat grep menyeluruh:
   - **Aman**: penulisan `CLAUDE.md`/`GEMINI.md`/`AGENTS.md` project selalu ke path project-local, tidak pernah menyentuh file global. Deploy skill ke `~/.claude/commands/` bersifat menambah file baru, tidak menimpa yang sudah ada.
   - **Titik nyata**: `deployHook()` ([setup.ts:263-321](../../src/commands/setup.ts#L263-L321)) mem-patch `~/.claude/settings.json` (file global) untuk hook `protect-sigma.js` yang berjalan di **semua** sesi Claude Code di mesin. Logika hook sudah aman/ter-scope oleh path-matching (`Sigma[\/\\]progress\.json$`) — **tidak perlu diperketat lagi**. Masalah sebenarnya: **tidak ada mekanisme uninstall** untuk membersihkan patch ini.

5. **Mekanisme uninstall — baru disadari belum ada, disepakati ditambahkan.**

### Task Breakdown — Bagian B

**Tahap B.1 — Registry & Identity File**
- [x] Hapus `GLOBAL_PROJECTS_FILE` (`~/.sigma/projects.json`) dari `src/config.ts`, seed-nya di `runInstall()`, dan `registerProjectEntry()`/pemanggilnya di `src/commands/project.ts`.
- [x] Tambahkan penulisan `.sigma-identity.json` di `runStart()` (`project.ts`), bersamaan dengan `progress.json`.
- [x] Repurpose `runRegister()`/`sigma project register` jadi repair/harvest tool untuk `.sigma-identity.json`, memakai `findSigmaProjectRoot()` (bukan `findProjectRoot()`) supaya tetap bisa jalan walau `progress.json` sendiri yang rusak.
- [x] Ubah `resolveProjectIdentity()` di `doctor.ts`: fallback lookup `GLOBAL_PROJECTS_FILE` diganti baca `.sigma-identity.json` di project root.
- [x] `test/helpers.ts` dibersihkan dari seed `projects.json` fixture lama.

**Tahap B.2 — Memory Ekosistem**
- [x] **Sudah selesai** (follow-up PLAN-EVAL-07, sesi yang sama). Referensi `memory_sigma.jsonl`/seed logic (`seedMemoryFile`, `GLOBAL_MEMORY_FILE`, command `sigma setup memory` beserta opsi `--reseed`) dihapus total dari `setup.ts`/`config.ts` — bukan hanya "referensi", mekanismenya dihapus penuh karena dikonfirmasi tidak ada consumer sama sekali. Lihat catatan Bagian B poin 2 di atas.

**Tahap B.3 — Bridge Template**
- [x] `CLAUDE.md`/`GEMINI.md`/`AGENTS.md` (bridge template): tabel CLI-Managed Files diperbaiki (`sigma refresh` → `sigma project sync --confirm`), kalimat `sigma memory --<role>` "after CLI support lands" diperbaiki jadi menyebut flag nyata (`--arc`/`--fmn`/`--dev`/`--aud`). `DEEPSEEK.md` dicek — tidak punya masalah yang sama (struktur berbeda, tidak ada tabel `sigma refresh`).
- [x] **Temuan tambahan saat implementasi (di luar 2 masalah yang direncanakan, diperbaiki sekalian karena satu kategori — command CLI yang tidak nyata ada)**: `REASONIX.md` menyebut `sigma project list` dan `sigma project reset` di "Sigma Shell Whitelist" — keduanya diverifikasi **tidak ada** sebagai command CLI nyata (`project.ts` hanya punya `start`/`status`/`sync`/`register`). Kedua baris dihapus dari whitelist.
- [x] Root `CLAUDE.md` project ini diperbaiki dengan frasa stale yang sama (tabel `sigma refresh`, kalimat `sigma memory --<role>`).
- [x] `sigma project start` diubah agar copy dari `~/.sigma/bridge/{file}` (bundle fallback via `resolveBridgeTemplate()`, pola sama seperti `resolveTemplate()`) alih-alih menulis placeholder kosong hardcode. Deploy ke 5 file (`BRIDGE_STUBS`, dipindah jadi shared constant di `config.ts`). Flag `--overwrite-bridge` mencakup kelima file.

**Tahap B.4 — Mekanisme Uninstall**

Prinsip desain (disepakati sesi ini, wajib dipatuhi implementasi):
1. **Global-only by construction**: `runUninstall()` tidak boleh memanggil `findProjectRoot()`/`process.cwd()`/apa pun yang me-resolve path relatif ke project-local (`Sigma/`, `.sigma-identity.json`, bridge file root). Semua path yang disentuh murni turunan `os.homedir()`. Ini menjamin folder project di level manapun (bukan cuma `Sigma/`) tidak pernah tersentuh — bukan by convention, tapi karena kode-nya secara struktural tidak pernah resolve path semacam itu.
2. **Surgical, bukan sapu bersih pada folder tool**: skill file dihapus file-per-file sesuai daftar persis `ROLE_FILES` per platform — tidak pernah `rmdir`/hapus folder tool (`~/.claude/commands/`, dst.) itu sendiri, supaya skill lain milik user yang tidak berkaitan dengan Sigma tidak ikut terhapus.
3. **Tanpa leftover di level global**: `~/.sigma/` dihapus sebagai satu folder utuh (termasuk `backups/` bekas `update`, bukan pilih-pilih sub-file). Cek keberadaan skill file per-platform (bukan cuma platform yang terdeteksi saat ini) supaya skill di tool yang sudah tidak terdeteksi lagi tetap ikut dibersihkan. Untuk `~/.claude/settings.json`: hapus entry hook Sigma, lalu bersihkan wadah kosong yang ditinggalkan (`hooks` array kosong pada matcher → hapus matcher; `PreToolUse` kosong → hapus key; `hooks` kosong → hapus key) — tapi file `settings.json` dan entry/key lain di dalamnya tidak disentuh.
4. **Idempotent**: dijalankan saat belum ada instalasi → no-op informatif, bukan error.

- [x] Command baru `sigma setup uninstall` ditambahkan, mengikuti 4 prinsip desain di atas.
- [x] Output ringkasan uninstall (mirror gaya log per-item `install`/`update`) — dry-run mode default, `--confirm` untuk apply.
- [x] Diverifikasi lewat smoke test manual (lihat Implementation Walkthrough) bahwa uninstall tidak menyentuh apa pun di level local project.

**Tahap B.5 — Dokumentasi**
- [x] README.md diupdate: tabel command reference (`setup uninstall`, `project register`), section baru "Removing Sigma — `sigma setup uninstall`", "What is preserved" ikut menyebut `.sigma-identity.json`, heading "Registered Projects" diubah jadi "Existing Projects". SIGMA_PROTOCOL.md dicek via grep — tidak ada referensi `~/.sigma/`/registry/`sigma refresh` sama sekali di file itu, tidak ada yang perlu diubah.
- [x] Deskripsi `operation_id: project_register` di `Sigma/SIGMA-OPERATION-REGISTRY.json` ditulis ulang total untuk perilaku repair/harvest `.sigma-identity.json`. Entry baru `setup_uninstall` ditambahkan. `project_start` dan `setup_install`/`setup_update` diupdate (hapus referensi `projects.json`, tambah field skill/hook deployment). `total_operations` di-update 55 → 56.

---

## Dependency Catatan

- **Bergantung penuh pada PLAN-EVAL-05 (CSO) dan PLAN-EVAL-07 (MCP)** — Bagian A dan B.2 di atas menghapus kode yang hanya aman dihapus setelah kedua plan tersebut tuntas.
- Tidak ada plan lain yang bergantung pada dokumen ini — ini adalah titik akhir seluruh rangkaian implementasi evaluasi 14 Juli 2026.

---

## Risiko

- Ini adalah plan dengan cakupan gabungan terluas (menyentuh hampir semua
  keputusan topik lain) — risiko regresi tertinggi di seluruh rangkaian.
  Rekomendasi: jalankan `npm test` penuh setelah setiap sub-tahap (A, B.1,
  B.2, B.3, B.4), bukan hanya di akhir.
- `sigma setup uninstall` adalah command destruktif baru — pastikan ada
  konfirmasi eksplisit (`--confirm` atau setara) sebelum menghapus `~/.sigma/`
  dan mem-patch `~/.claude/settings.json`, konsisten dengan pola
  "Director Authorization Language" di `CLAUDE.md`.
- Risiko tertinggi di command ini adalah **blast radius yang salah arah**:
  operasi destruktif yang seharusnya global-only tidak sengaja menyentuh file
  di level project (data Director yang sedang aktif dikerjakan) atau file
  milik tool lain yang bukan milik Sigma. Mitigasi: 4 prinsip desain di Tahap
  B.4 (global-only by construction, surgical per-file, no leftover, idempotent)
  bersifat wajib, bukan opsional — review implementasi terhadap keempatnya
  sebelum command ini dianggap selesai.
- Perubahan `sigma project start` untuk memakai bridge template asli
  (Tahap B.3) mengubah isi file `CLAUDE.md`/dst. yang dihasilkan untuk project
  baru — pastikan tidak merusak project yang sudah ada (perubahan ini hanya
  memengaruhi project yang dibuat setelah patch, bukan retroaktif).

---

## Draft Acceptance Criteria

- [x] `ROLE_FILES` map tidak lagi memiliki entri `checkpoint`/`cso`. **(sudah terverifikasi di kode saat ini)**
- [x] `runInstall()` tidak lagi memiliki Step E/E2 (Reasonix/Antigravity MCP config). **(sudah terverifikasi di kode saat ini)**
- [x] `runUpdate()` melakukan deploy skill + hook yang setara `runInstall()` (minus prompt interaktif "Reinstall?").
- [x] `~/.sigma/projects.json` tidak lagi di-seed dan `GLOBAL_PROJECTS_FILE` dihapus dari `config.ts`. `sigma project register` **tetap terdaftar di CLI** tapi direpurpose jadi repair/harvest tool untuk `.sigma-identity.json` lokal (bukan lagi menulis ke registry global).
- [x] `sigma project start` menulis `.sigma-identity.json` di root project (`project_id`, `project_name`, `registered: true`) bersamaan dengan `progress.json`.
- [x] `resolveProjectIdentity()` di `doctor.ts` memakai `.sigma-identity.json` sebagai fallback kedua (bukan lagi `~/.sigma/projects.json`) sebelum jatuh ke `--id`/`--name` manual.
- [x] Seed logic `memory_sigma.jsonl` tidak lagi dipanggil dari `setup.ts` (diverifikasi — sudah tidak ada sejak sebelum sesi ini).
- [x] Template `setup/targets/bridge/*.md` **dan** root `CLAUDE.md` project ini sudah diperbarui (tanpa referensi CSO/MCP/dangling `sigma refresh`, tanpa frasa "after CLI support lands" untuk `sigma memory`) dan benar-benar dipakai oleh `sigma project start` (5 file: CLAUDE/GEMINI/AGENTS/DEEPSEEK/REASONIX, bukan placeholder kosong).
- [x] `sigma setup uninstall` tersedia, menghapus `~/.sigma/`, skill file terdeploy, dan entry hook di `~/.claude/settings.json` secara surgical, tanpa menyentuh folder `Sigma/` project manapun atau `.sigma-identity.json` di root project manapun. Diverifikasi lewat smoke test manual, bukan cuma review kode.
- [x] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini (131/131 test, 21 file, tidak ada test yang di-skip atau dihapus).
- [x] README.md mencerminkan state akhir sistem setelah PLAN-EVAL-01 s/d 08 selesai, termasuk struktur `.sigma-identity.json` dan perilaku baru `sigma project register`. SIGMA_PROTOCOL.md diverifikasi tidak punya referensi yang perlu diubah (grep kosong).

---

## Implementation Walkthrough

**Dikerjakan**: 2026-07-14, Professional Mode, setelah approval eksplisit Director atas seluruh keputusan di "Keputusan Sesi Diskusi" di atas.

### File yang diubah

**Kode (`src/`)**
- `src/config.ts` — hapus `GLOBAL_PROJECTS_FILE`; tambah `PROJECT_IDENTITY_FILE` (`.sigma-identity.json`) dan `BRIDGE_STUBS` (shared constant, dipindah dari `setup.ts` supaya bisa dipakai `project.ts` juga tanpa cross-import antar command module).
- `src/commands/setup.ts` — hapus seed `projects.json`; refactor Step B-D + hook deploy dari `runInstall()` jadi fungsi bersama `deploySkillsAndHook()` dipanggil dari `runInstall()` dan `runUpdate()`; `runUpdate()` sekarang auto-redeploy skill+hook ke semua tool terdeteksi tanpa prompt; tambah `sigma setup uninstall` (global-only by construction, surgical per-file, no-leftover cleanup termasuk empty-container cleanup di `settings.json`, idempotent).
- `src/commands/project.ts` — hapus `registerProjectEntry()`/interface registry lama; tambah `writeProjectIdentity()` dipanggil dari `runStart()`; tambah `resolveBridgeTemplate()` (pola sama `resolveTemplate()` di `utils/artifacts.ts`) dan ganti blok bridge-stub-kosong jadi copy 5 file asli dari `~/.sigma/bridge/` (bundle fallback); repurpose `runRegister()` jadi repair/harvest tool berbasis `findSigmaProjectRoot()` (bukan `findProjectRoot()`, supaya tetap jalan walau `progress.json` sendiri yang rusak).
- `src/commands/doctor.ts` — `resolveProjectIdentity()`: fallback tier kedua diganti dari baca registry global jadi baca `.sigma-identity.json` project-local.
- `test/helpers.ts` — hapus seed `projects.json` dari fixture `setupTestEnv()`.

**Konten (bukan kode)**
- `setup/targets/bridge/{CLAUDE,GEMINI,AGENTS}.md` — tabel CLI-Managed Files (`sigma refresh` → `sigma project sync --confirm`), kalimat `sigma memory` diperbaiki.
- `setup/targets/bridge/REASONIX.md` — hapus 2 baris command phantom (`sigma project list`, `sigma project reset`) dari Shell Whitelist, ditemukan saat verifikasi silang dengan `project.ts` (temuan tambahan, di luar 2 masalah yang direncanakan, sub-bagian di bawah).
- `setup/targets/bridge/DEEPSEEK.md` — dicek, tidak ada masalah yang sama, tidak diubah.
- `CLAUDE.md` (root project ini) — frasa stale yang sama dengan bridge template diperbaiki.
- `README.md` — tabel command reference (`setup uninstall`, `project register`), section baru "Removing Sigma", "What is preserved" ikut `.sigma-identity.json`, heading "Registered Projects" → "Existing Projects".
- `Sigma/SIGMA-OPERATION-REGISTRY.json` — `project_start`, `project_register`, `setup_install`, `setup_update` ditulis ulang; entry baru `setup_uninstall`; `total_operations` 55 → 56.

### Temuan tambahan di luar rencana awal (diputuskan sendiri, transparan di sini untuk Director review)

1. **`REASONIX.md` phantom commands** (`sigma project list`, `sigma project reset`) — ditemukan saat memperbaiki file yang sama untuk masalah `sigma refresh`/`sigma memory`. Kategori masalah identik (instruksi AI menyebut command yang tidak nyata ada di CLI), jadi diperbaiki sekalian alih-alih dibiarkan. Perubahan reversibel, tanpa risiko runtime.
2. **`Sigma/SIGMA-OPERATION-REGISTRY.json` juga punya entry `project_reset` yang phantom** (operation lengkap dengan constraints/gating, bukan cuma satu baris) — **TIDAK diperbaiki**, di luar scope karena memutuskan apakah `project reset` pernah direncanakan/dibatalkan adalah keputusan terpisah yang lebih besar dari sekadar typo teks. Direkomendasikan sebagai temuan terpisah untuk Director — jalankan `scripts/refresh-registries.js` (dev tool yang sudah ada, didesain persis untuk diff CLI vs registry) untuk audit menyeluruh entry yang phantom/orphan di luar sesi ini.

### Verifikasi

- `npx tsc --noEmit` — bersih di setiap sub-tahap (A, B.1, B.3, B.4, B.5).
- `npm run build` — sukses.
- `npm test` — **131/131 test lulus, 21 file test**, tanpa modifikasi assertion apa pun (hanya fixture `test/helpers.ts` yang disederhanakan, tidak ada test case yang diubah/dihapus).
- **Smoke test manual** (tidak ada test otomatis untuk `setup.ts`/`project.ts` CLI flow sebelum sesi ini) — dijalankan di `HOME` terisolasi (`/tmp/sigma-smoke`), mencakup:
  - `setup install --yes` → `~/.sigma/` bersih, tidak ada `projects.json`, `bridge/` punya 5 file.
  - `project start` → `.sigma-identity.json` ditulis benar, 5 bridge file ditulis dari template.
  - `doctor --reconstruct` tanpa `progress.json`/`.sigma-identity.json` → gagal dengan pesan `--id`/`--name` yang jelas; dengan `.sigma-identity.json` saja (tanpa `progress.json`) → berhasil reconstruct memakai fallback tier kedua.
  - `project register` → memperbaiki `.sigma-identity.json` yang dihapus, sumber dari `progress.json`.
  - `setup update` → redeploy skill+hook otomatis ke tool yang baru terdeteksi, tanpa prompt.
  - `setup uninstall` (dry-run lalu `--confirm`) → menghapus persis file milik Sigma, file skill tak-terkait (`my-other-skill.md`) di folder AI tool yang sama **selamat**, `settings.json` dibersihkan total jadi `{}` (bukan cuma hook entry-nya, wadah kosongnya juga), project lokal (`Sigma/`, `.sigma-identity.json`, bridge files) **100% utuh** setelahnya, dan run kedua idempotent (melapor "Nothing to uninstall").
