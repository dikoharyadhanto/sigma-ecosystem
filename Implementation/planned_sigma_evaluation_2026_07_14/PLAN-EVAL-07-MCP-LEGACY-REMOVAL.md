# PLAN-EVAL-07 — Pembersihan Total Legacy MCP (Model Context Protocol)

**Sumber**: `Discussion/sigma-system-evaluation-2026-07-14.md` (Topik 5)
**Tanggal**: 2026-07-14
**Status**: DRAFT FOR REVIEW
**Urutan eksekusi**: 7 dari 8 (lihat `README.md` di folder ini)
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN, tidak punya otoritas lock/gate Sigma.

---

## Objective

Menghapus seluruh dukungan MCP bawaan dari Sigma — Reasonix, Antigravity/Gemini,
dan `sequential-thinking` — sehingga setup versi baru tidak lagi punya
dependency `npx`/MCP apapun yang perlu terpasang otomatis. Plan ini **tidak**
mencakup perubahan di `src/commands/setup.ts` (Step E/E2, `runMemorySetup`) —
bagian itu sengaja dideferensiasi ke **PLAN-EVAL-08** karena `setup` adalah
topik yang dikerjakan paling akhir.

---

## Latar Belakang

Asumsi awal Director ("semua MCP kecuali sequential-thinking sudah dihapus di
versi sekarang") **dikoreksi** oleh temuan teknis: dukungan multi-tool MCP
belum dihapus — masih lengkap ada dan aktif.

### Temuan Teknis (sudah diverifikasi dari kode)

- `writeReasonixMcpConfig()` dan `writeGeminiMcpConfig()` ([mcp.ts:56-237](../../src/utils/mcp.ts#L56-L237)) — konfigurasi MCP khusus Reasonix (termasuk wrapper script `mcp-run-sigma-memory.js`, format `SIGMA_SHELL_ALLOWED`) dan Antigravity (format protobuf `$typeName`). Dipanggil aktif dari `setup install` (Step E/E2) dan `setup memory --reasonix`/`--gemini`.
- Bonus temuan: `SIGMA_SHELL_ALLOWED` ([mcp.ts:133-156](../../src/utils/mcp.ts#L133-L156)) berisi entri `'sigma sync'`, `'sigma override'` (dihapus di plan lain), dan **`'sigma refresh'`** — command yang disebut di `CLAUDE.md` project ini tapi **tidak ada implementasinya sama sekali** — dangling reference murni.
- `sequential-thinking` dikonfirmasi **tidak terpakai sama sekali** sepanjang sesi evaluasi meski tugasnya persis kategori yang menurut `CLAUDE.md` seharusnya memicu pemakaiannya. Alasan: reasoning multi-langkah sudah native pada model, MCP ini cuma membungkus kemampuan yang sudah ada tanpa menambah kapasitas.

---

## Keputusan (Final)

**Hapus MCP total — tidak ada MCP bawaan tersisa sama sekali.** Mencakup:
1. Seluruh dukungan Reasonix MCP (`writeReasonixMcpConfig`, wrapper script `mcp-run-sigma-memory.js`, `SIGMA_SHELL_ALLOWED`).
2. Seluruh dukungan Antigravity/Gemini MCP (`writeGeminiMcpConfig`).
3. `sequential-thinking` — dihapus total, termasuk dari `.mcp.json`/`.vscode/mcp.json` bawaan project baru.

**Scope boundary (klarifikasi, ditambahkan saat review plan)**: "MCP total" di atas artinya seluruh *client config* MCP eksternal legacy (Reasonix/Antigravity/sequential-thinking) yang dibungkus `src/utils/mcp.ts`. Ini **bukan** pernyataan arah anti-MCP secara umum untuk Sigma. `Implementation/planned_mcp_dev/PLAN-MCP-1.md` (rencana membangun `sigma-mcp` server native, membungkus engine Sigma sendiri) tetap valid sebagai next future plan — sengaja ditunda sampai core Sigma stabil pasca seluruh seri evaluasi ini selesai, dan sengaja **tidak** melanjutkan sisa kode `mcp.ts` yang dihapus di sini (dimulai dari nol). Konfirmasi Director: penghapusan legacy MCP sekarang tidak terpengaruh dan tidak perlu menunggu keputusan soal PLAN-MCP-1.

---

## Task Breakdown

**Tahap 1 — Hapus Modul MCP**
- [ ] Hapus total `src/utils/mcp.ts` — tentukan saat implementasi apakah file dihapus penuh atau disisakan kerangka kosong untuk kompatibilitas import (rekomendasi: hapus penuh, verifikasi lewat grep tidak ada caller tersisa sebelum menghapus).
- [ ] Hapus pemanggilan `writeMcpJson`/`writeVscodeMcpJson` di `src/commands/project.ts:257-265` (penulisan `.mcp.json`/`.vscode/mcp.json` saat `project start`).
- [ ] Hapus `scripts/mcp-run-sequential-thinking.js` — ditemukan saat pendalaman plan ini: file orphan, tidak direferensikan dari `package.json` (bin/scripts) maupun caller manapun di codebase. Sisa eksperimen wrapper lama, bukan dipakai `mcp.ts` (yang memanggil `npx` langsung, bukan script ini). Verifikasi ulang lewat grep sebelum hapus.
- [ ] Update `test/role-memory-bootstrap.test.ts:34-35` — test ini `fs.readJsonSync('.mcp.json')` lalu assert `mcpServers['sequential-thinking']` truthy. Setelah Tahap 1 (project.ts tidak lagi menulis `.mcp.json`), baris 34 akan `ENOENT` sebelum assert-nya sendiri sempat jalan. Sesuaikan test (hapus assertion `.mcp.json`, atau assert file tidak ada) sebagai bagian dari unit kerja ini, bukan modifikasi tak tercatat.

**Tahap 2 — Bersihkan Konfigurasi Project Baru**
- [ ] Pastikan template project baru (`project start`) tidak lagi men-generate `.mcp.json`/`.vscode/mcp.json` berisi `sequential-thinking`.
- [ ] Hapus file `.mcp.json` bawaan di repo `sigma-ecosystem` ini sendiri jika masih berisi konfigurasi `sequential-thinking` legacy (cek `i:/Works/Project/sigma-ecosystem/.mcp.json`).

**Tahap 3 — Bersihkan Section "MCP Tooling" di Bridge Files**
- [ ] Section "MCP Tooling" (Sequential thinking) ternyata ada di **6 file**, bukan cuma `CLAUDE.md` project ini — ditemukan saat pendalaman plan ini via grep menyeluruh:
  - Root project (di-generate/di-maintain manual): `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`.
  - Template sumber bawaan (dipakai `project start`/`setup update`): `setup/targets/bridge/CLAUDE.md`, `setup/targets/bridge/GEMINI.md`, `setup/targets/bridge/AGENTS.md`.
  - `DEEPSEEK.md`/`REASONIX.md` (root maupun template) tidak punya section ini — tidak perlu disentuh.
- [ ] Hapus section "MCP Tooling" di keenam file di atas.

**Tahap 4 — Dangling Reference**
- [ ] `'sigma refresh'` di `SIGMA_SHELL_ALLOWED` otomatis terhapus bersama seluruh array ini di Tahap 1 — verifikasi tidak ada referensi lain ke `sigma refresh` yang tersisa di dokumen (dangling reference ini sebelumnya sudah ada terlepas dari MCP, pastikan tidak lolos tanpa catatan).

**Tahap 5 — Cleanup Opsional**
- [ ] Pertimbangkan mekanisme cleanup wrapper script `~/.sigma/mcp-run-sigma-memory.js` dari instalasi lama (opsional, dicatat sebagai pertimbangan bukan keharusan — instalasi baru sudah tidak akan menulis file ini lagi setelah Tahap 1).

**Tahap 6 — Dokumentasi**
- [ ] Update `README.md`/`Sigma/SIGMA_PROTOCOL.md` yang menyebut MCP/sequential-thinking/Reasonix/Antigravity MCP config. Titik yang sudah teridentifikasi di `README.md` (verifikasi tidak ada titik lain yang lolos): section "Optional: Configure MCP memory" ([README.md:205-212](../../README.md#L205-L212)), baris tabel command `sigma setup memory` ([README.md:522](../../README.md#L522)), section "Memory & MCP" ([README.md:589-644](../../README.md#L589-L644)).

**Tahap 7 — Tinjau `detectTools()`**
- [ ] Tinjau apakah `detectTools()`/`targetPaths()` di `src/utils/detect.ts` masih relevan dipertahankan untuk keperluan lain (deploy skill file per platform) meski bagian MCP-nya dihapus — skill deployment (arc.md/fmn.md/dst.) tetap perlu deteksi tool, terpisah dari urusan MCP. **Jangan hapus fungsi ini** kecuali dipastikan tidak dipakai jalur skill deployment.

---

## Yang Sengaja Tidak Dikerjakan di Plan Ini (Deferred ke PLAN-EVAL-08)

- Step E ("Reasonix MCP config") dan Step E2 ("Antigravity MCP config") di `runInstall()` ([setup.ts:226-248](../../src/commands/setup.ts#L226-L248)).
- `runMemorySetup()`/`sigma setup memory` di `setup.ts:406-478` — opsi `--reasonix`, `--gemini`, `--vscode`, `--print` terkait MCP.
- Seed logic `memory_sigma.jsonl` (`seedMemoryFile`, `GLOBAL_MEMORY_FILE`) — terkait erat dengan Topik 7 (dibahas di PLAN-EVAL-08).

Alasan deferral: seluruh item di atas ada di `src/commands/setup.ts`, dan
dokumen sumber eksplisit menyatakan `sigma setup` final pass dikerjakan
paling akhir agar mencerminkan state akhir sistem, bukan state parsial.

---

## Dependency Catatan

- **PLAN-EVAL-08 bergantung pada plan ini** — Step E/E2 dan `runMemorySetup`
  di `setup.ts` hanya jadi orphan/aman dihapus setelah `src/utils/mcp.ts` dan
  seluruh caller-nya di luar `setup.ts` sudah tuntas dihapus di sini.
- Tidak ada dependency masuk dari plan lain.

---

## Risiko

- `src/utils/mcp.ts` dipanggil dari `setup.ts` (Step E/E2, `runMemorySetup`) —
  penghapusan modul di Tahap 1 akan membuat `setup.ts` gagal build sampai
  PLAN-EVAL-08 dikerjakan. Mitigasi: pastikan Tahap 1-6 plan ini di-commit
  sebagai satu unit kerja yang **juga** menghapus/menstub pemanggilan di
  `setup.ts` secukupnya agar build tidak rusak di antara PLAN-EVAL-07 dan
  PLAN-EVAL-08 (stub minimal, bukan implementasi penuh final pass — final
  pass tetap di PLAN-EVAL-08).
- Project yang sudah pernah menjalankan `setup memory --reasonix`/`--gemini`
  akan punya file konfigurasi MCP lama tersisa di disk yang tidak lagi
  ter-refresh — tidak ada mekanisme cleanup otomatis (lihat Tahap 5, opsional).

---

## Draft Acceptance Criteria

- [x] `src/utils/mcp.ts` tidak lagi ada (dihapus penuh sesuai rekomendasi Tahap 1).
- [x] `project start` tidak lagi menulis `.mcp.json`/`.vscode/mcp.json` berisi `sequential-thinking`.
- [x] `CLAUDE.md` project ini tidak lagi memuat section "MCP Tooling" (plus GEMINI.md/AGENTS.md root + 3 template bridge — cakupan diperluas dari temuan Tahap 3).
- [x] Tidak ada dangling reference ke `sigma refresh` yang lolos tanpa catatan (dilacak eksplisit ke PLAN-EVAL-08).
- [x] `setup.ts` tetap bisa di-build (tidak ada import rusak ke `mcp.ts`) — stub minimal Tahap 1 diterapkan, lalu dihapus total di follow-up (lihat di bawah).
- [x] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini.
- [x] README.md/SIGMA_PROTOCOL.md tidak lagi menyebut MCP/Reasonix/Antigravity/sequential-thinking sebagai fitur aktif.

Status: **Tahap 1-7 selesai diimplementasikan** (build + `npm test` 131/131 lulus). Lihat "Follow-up" di bawah untuk kerja tambahan yang dilakukan di sesi yang sama, di luar cakupan Task Breakdown asli.

---

## Follow-up — Penghapusan Total Memory Ekosistem (`memory_sigma.jsonl`)

Dilakukan di sesi yang sama, **setelah** Tahap 1-7 selesai dan Director meminta
recek ulang status `sigma-memory-seed.jsonl`. Bukan bagian dari Task Breakdown
asli di atas — didokumentasikan di sini karena mekanismenya (stub minimal
`sigma setup memory --reseed` di Tahap 1) langsung terkait.

**Temuan**: setelah Tahap 1 menghapus `writeReasonixMcpConfig`/`writeGeminiMcpConfig`
(satu-satunya jalur yang pernah men-set env `MEMORY_FILE_PATH` untuk MCP tool
`server-memory`), `~/.sigma/memory_sigma.jsonl` kehilangan **satu-satunya
consumer yang pernah membacanya**. Grep menyeluruh mengonfirmasi: tidak ada
command lain di `src/` yang membaca file ini — sistem yang benar-benar aktif
adalah role memory (`sigma memory --arc/--fmn/--dev/--aud`, baca
`Sigma/role-memory/*.json`), sepenuhnya independen dan tidak terdampak.

**Keputusan Director**: hapus mekanisme `memory_sigma.jsonl` total sekarang,
bukan menunggu PLAN-EVAL-08.

**Dihapus**:
- `runMemorySetup()`, `seedMemoryFile()`, command `sigma setup memory` (`setup.ts`).
- `GLOBAL_MEMORY_FILE` (`config.ts`).
- `setup/sigma-memory-seed.jsonl`.
- Orphan wrapper `scripts/mcp-run-memory.js` (ditemukan saat penelusuran — sama sifatnya dengan `mcp-run-sequential-thinking.js` yang sudah dihapus di Tahap 1, sebelumnya tidak terlacak grep karena nama file berbeda).
- Entry operation `setup_memory` di `Sigma/SIGMA-OPERATION-REGISTRY.json` (`total_operations` 56→55), plus kalimat usang di deskripsi `setup_install`.
- Section "Memory Isolation" di 10 file bridge (root: CLAUDE/GEMINI/AGENTS/DEEPSEEK/REASONIX.md; template: `setup/targets/bridge/{sama}.md`) — untuk CLAUDE/GEMINI/AGENTS varian template, konten non-MCP (`decisions.jsonl`/`sigma send`/`sigma inbox`) dipertahankan di bawah heading baru "Project Memory".
- Section "Memory reseed (optional)" dan "Advanced: reseed ecosystem memory" di README.md; heading "## Ecosystem Memory" diganti "## State Integrity" (isi sisa bukan lagi tentang memory).
- Baris tabel `sigma setup memory` di README.md dan `Sigma/SIGMA_PROTOCOL.md`.

**Verifikasi**: build + `npm test` 131/131 lulus ulang setelah follow-up ini.

**Dampak ke PLAN-EVAL-08**: Tahap A (baris `runMemorySetup`) dan Tahap B.2
(Memory Ekosistem) sudah selesai — ditandai di dokumen PLAN-EVAL-08. Tahap
B.3 (Bridge Template) sebagian selesai (section MCP Tooling/Memory Isolation);
sisa kerja (tabel CLI-Managed Files, kalimat `sigma memory`) tetap di
PLAN-EVAL-08.
