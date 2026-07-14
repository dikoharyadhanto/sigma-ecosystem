# PLAN-EVAL-08 — Final Pass `sigma setup` & Pembersihan `~/.sigma/` Global

**Sumber**: `Discussion/sigma-system-evaluation-2026-07-14.md` (Topik 6, Topik 7)
**Tanggal**: 2026-07-14
**Status**: DRAFT FOR REVIEW
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

## Bagian A — Final Pass `sigma setup install`/`update`

### Cakupan yang Sudah Teridentifikasi

- `ROLE_FILES` map ([setup.ts:38-44](../../src/commands/setup.ts#L38-L44)) — entri `checkpoint`/`cso` untuk tiap platform perlu dihapus (konsekuensi PLAN-EVAL-05, CSO dihapus total).
- Step E & E2 Reasonix/Antigravity MCP config ([setup.ts:226-248](../../src/commands/setup.ts#L226-L248)) — dihapus (konsekuensi PLAN-EVAL-07, MCP dihapus total).
- Refactor skill+hook deployment jadi shared function `install`↔`update` (keputusan `install` vs `update` dari sesi evaluasi — lihat sub-bagian di bawah).
- **Belum diputuskan saat sesi evaluasi**: apakah Reasonix/Antigravity tetap dipertahankan sebagai **platform tujuan deploy skill file** (urusan terpisah dari MCP) — putuskan di awal tahap ini sebelum lanjut.
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

- [ ] Putuskan status Reasonix/Antigravity sebagai platform tujuan deploy skill (terpisah dari urusan MCP) — konfirmasi ke Director, catat keputusannya di sini sebelum lanjut.
- [ ] Hapus entri `checkpoint`/`cso` dari `ROLE_FILES` map ([setup.ts:38-44](../../src/commands/setup.ts#L38-L44)) untuk tiap platform.
- [ ] Hapus Step E ("Reasonix MCP config") dan Step E2 ("Antigravity MCP config") di `runInstall()` ([setup.ts:226-248](../../src/commands/setup.ts#L226-L248)).
- [x] **Sudah selesai lebih awal** (follow-up PLAN-EVAL-07, sesi yang sama, dikonfirmasi Director): `runMemorySetup()`/`sigma setup memory` dihapus total dari `setup.ts` — dikonfirmasi tidak ada consumer yang pernah membaca `memory_sigma.jsonl` sama sekali (satu-satunya jalur akses teoretis, MCP `server-memory`, sudah dihapus di PLAN-EVAL-07 utama). Ikut dihapus: `GLOBAL_MEMORY_FILE` (`config.ts`), `setup/sigma-memory-seed.jsonl`, wrapper orphan `scripts/mcp-run-memory.js`, entry `setup_memory` di `Sigma/SIGMA-OPERATION-REGISTRY.json`, dan section "Memory Isolation"/"Advanced: reseed ecosystem memory" di README.md serta 10 file bridge (root + template). Tidak ada sisa kerja untuk sub-item ini di Bagian A.
- [ ] Refactor logika deteksi tool + deploy skill (Step B-D di [setup.ts:144-224](../../src/commands/setup.ts#L144-L224)) dan deploy hook (`deployHook()`, [setup.ts:263-321](../../src/commands/setup.ts#L263-L321)) dari `runInstall()` jadi fungsi bersama yang bisa dipanggil juga dari `runUpdate()`.
- [ ] Tentukan perilaku `update` untuk pemilihan tool: auto-redeploy ke seluruh tool yang terdeteksi/sebelumnya terkonfigurasi (tanpa prompt checkbox interaktif seperti `install`), karena `update` tidak perlu gate konfirmasi "Reinstall?" — hanya refresh konten.
- [ ] Hapus catatan "skill files... NOT redeployed" di pesan sukses `runUpdate()`, sesuaikan dengan perilaku baru.
- [ ] Update README.md/SIGMA_PROTOCOL.md yang menjelaskan `sigma setup update`.

---

## Bagian B — Evaluasi Tujuan `~/.sigma/` Global, Isolasi Project, Mekanisme Uninstall

### Temuan Teknis (sudah diverifikasi dari kode)

`~/.sigma/` ditemukan punya 7 fungsi berbeda dalam satu folder: (1) sumber
template/rule live semua project, (2) sumber `project sync`, (3) registry
lintas-project (`projects.json`), (4) metadata instalasi CLI, (5) memory
ekosistem (`memory_sigma.jsonl`), (6) bridge stubs (template `CLAUDE.md`/dst.),
(7) hook `protect-sigma.js`.

### Keputusan per Bagian

1. **Registry lintas-project (`~/.sigma/projects.json`, `sigma project register`) — dihapus.** Director menilai tidak penting.

2. **Memory ekosistem (`~/.sigma/memory_sigma.jsonl`) — sudah dihapus total** (follow-up PLAN-EVAL-07, sesi yang sama, dikonfirmasi Director). Awalnya diperkirakan cukup "jadi orphan, dibereskan sebagai bagian perbaikan bridge template" — setelah recek ulang, dikonfirmasi tidak ada satu pun consumer yang pernah membaca file ini (bahkan sebelum PLAN-EVAL-07: satu-satunya jalur akses teoretis adalah MCP `server-memory`, yang env `MEMORY_FILE_PATH`-nya hanya di-wire lewat adapter Reasonix/Antigravity yang sudah dihapus). Keputusan final: hapus mekanisme seluruhnya (bukan sekadar dibersihkan referensinya), lihat catatan Bagian A di atas untuk cakupan lengkap.

3. **Bridge stubs — diperbaiki total, bukan dihapus.** Template `setup/targets/bridge/{CLAUDE,GEMINI,AGENTS,DEEPSEEK,REASONIX}.md` adalah master template file instruksi AI per-project, isinya nyaris identik `CLAUDE.md` project ini. Ditemukan usang (section MCP Tooling/Memory Isolation menyebut fitur yang sudah dihapus, tabel CLI-Managed Files menyebut `sigma refresh` yang dangling, kalimat "`sigma memory --<role>` after CLI support lands" padahal command itu sudah ada). **Bug terpisah ditemukan**: `sigma project start` ([project.ts:243-250](../../src/commands/project.ts#L243-L250)) **tidak memakai template bridge ini sama sekali** — hanya menulis placeholder kosong, sehingga template lengkap ini terputus (orphaned) dari alur pembuatan project.

4. **Kekhawatiran kontaminasi ke setup AI tool global** — diinvestigasi lewat grep menyeluruh:
   - **Aman**: penulisan `CLAUDE.md`/`GEMINI.md`/`AGENTS.md` project selalu ke path project-local, tidak pernah menyentuh file global. Deploy skill ke `~/.claude/commands/` bersifat menambah file baru, tidak menimpa yang sudah ada.
   - **Titik nyata**: `deployHook()` ([setup.ts:263-321](../../src/commands/setup.ts#L263-L321)) mem-patch `~/.claude/settings.json` (file global) untuk hook `protect-sigma.js` yang berjalan di **semua** sesi Claude Code di mesin. Logika hook sudah aman/ter-scope oleh path-matching (`Sigma[\/\\]progress\.json$`) — **tidak perlu diperketat lagi**. Masalah sebenarnya: **tidak ada mekanisme uninstall** untuk membersihkan patch ini.

5. **Mekanisme uninstall — baru disadari belum ada, disepakati ditambahkan.**

### Task Breakdown — Bagian B

**Tahap B.1 — Registry**
- [ ] Hapus `GLOBAL_PROJECTS_FILE`/`registerRoadmapDraft`-related registry code dan command `sigma project register` di `src/commands/project.ts`.

**Tahap B.2 — Memory Ekosistem**
- [x] **Sudah selesai** (follow-up PLAN-EVAL-07, sesi yang sama). Referensi `memory_sigma.jsonl`/seed logic (`seedMemoryFile`, `GLOBAL_MEMORY_FILE`, command `sigma setup memory` beserta opsi `--reseed`) dihapus total dari `setup.ts`/`config.ts` — bukan hanya "referensi", mekanismenya dihapus penuh karena dikonfirmasi tidak ada consumer sama sekali. Lihat catatan Bagian B poin 2 di atas.

**Tahap B.3 — Bridge Template**
- [ ] Tulis ulang isi `setup/targets/bridge/{CLAUDE,GEMINI,AGENTS,DEEPSEEK,REASONIX}.md`: ~~hapus section MCP Tooling, Memory Isolation~~ **sudah selesai** (PLAN-EVAL-07 utama + follow-up, sesi yang sama) — sisa kerja: perbaiki tabel CLI-Managed Files (hapus `sigma refresh`), perbaiki kalimat `sigma memory` yang sudah tidak "akan datang".
- [ ] Ubah `sigma project start` ([project.ts:243-250](../../src/commands/project.ts#L243-L250)) agar copy dari `~/.sigma/bridge/{file}` (dengan bundle fallback, pola sama seperti `resolveTemplate()`) alih-alih menulis placeholder kosong hardcode.

**Tahap B.4 — Mekanisme Uninstall**
- [ ] Tambahkan command baru `sigma setup uninstall` (nama final ditentukan saat implementasi): hapus `~/.sigma/` (templates/rules/governance/bridge/sigma.config.json), hapus file skill yang di-deploy ke tiap AI tool (`~/.claude/commands/*`, `~/.codex/skills/*`, dst.), hapus entry hook `protect-sigma.js` di `~/.claude/settings.json` secara surgical (idempotent removal, mirror dari logic idempotent addition di `deployHook()` — hanya entry milik Sigma, bukan seluruh file settings.json).
- [ ] Pastikan uninstall **tidak menyentuh** folder `Sigma/` di project manapun — project lokal tetap utuh 100% di disk. Satu-satunya konsekuensi: command `sigma` berhenti berfungsi.

**Tahap B.5 — Dokumentasi**
- [ ] Update README.md/SIGMA_PROTOCOL.md yang menjelaskan struktur `~/.sigma/` dan tambahkan dokumentasi `sigma setup uninstall`.

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
- Perubahan `sigma project start` untuk memakai bridge template asli
  (Tahap B.3) mengubah isi file `CLAUDE.md`/dst. yang dihasilkan untuk project
  baru — pastikan tidak merusak project yang sudah ada (perubahan ini hanya
  memengaruhi project yang dibuat setelah patch, bukan retroaktif).

---

## Draft Acceptance Criteria

- [ ] `ROLE_FILES` map tidak lagi memiliki entri `checkpoint`/`cso`.
- [ ] `runInstall()` tidak lagi memiliki Step E/E2 (Reasonix/Antigravity MCP config).
- [ ] `runUpdate()` melakukan deploy skill + hook yang setara `runInstall()` (minus prompt interaktif "Reinstall?").
- [ ] `sigma project register` tidak lagi terdaftar di CLI; `~/.sigma/projects.json` tidak lagi di-seed.
- [ ] Seed logic `memory_sigma.jsonl` tidak lagi dipanggil dari `setup.ts`.
- [ ] Template `setup/targets/bridge/*.md` sudah diperbarui (tanpa referensi CSO/MCP/dangling `sigma refresh`) dan benar-benar dipakai oleh `sigma project start` (bukan placeholder kosong).
- [ ] `sigma setup uninstall` tersedia, menghapus `~/.sigma/`, skill file terdeploy, dan entry hook di `~/.claude/settings.json` secara surgical, tanpa menyentuh folder `Sigma/` project manapun.
- [ ] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini.
- [ ] README.md/SIGMA_PROTOCOL.md mencerminkan seluruh state akhir sistem setelah PLAN-EVAL-01 s/d 08 selesai.
