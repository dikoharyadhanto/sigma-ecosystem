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

---

## Task Breakdown

**Tahap 1 — Hapus Modul MCP**
- [ ] Hapus total `src/utils/mcp.ts` — tentukan saat implementasi apakah file dihapus penuh atau disisakan kerangka kosong untuk kompatibilitas import (rekomendasi: hapus penuh, verifikasi lewat grep tidak ada caller tersisa sebelum menghapus).
- [ ] Hapus pemanggilan `writeMcpJson`/`writeVscodeMcpJson` di `src/commands/project.ts:257-265` (penulisan `.mcp.json`/`.vscode/mcp.json` saat `project start`).

**Tahap 2 — Bersihkan Konfigurasi Project Baru**
- [ ] Pastikan template project baru (`project start`) tidak lagi men-generate `.mcp.json`/`.vscode/mcp.json` berisi `sequential-thinking`.
- [ ] Hapus file `.mcp.json` bawaan di repo `sigma-ecosystem` ini sendiri jika masih berisi konfigurasi `sequential-thinking` legacy (cek `i:/Works/Project/sigma-ecosystem/.mcp.json`).

**Tahap 3 — Bersihkan `CLAUDE.md` Project Ini**
- [ ] Hapus section "MCP Tooling" (Sequential thinking) di `CLAUDE.md` project ini.

**Tahap 4 — Dangling Reference**
- [ ] `'sigma refresh'` di `SIGMA_SHELL_ALLOWED` otomatis terhapus bersama seluruh array ini di Tahap 1 — verifikasi tidak ada referensi lain ke `sigma refresh` yang tersisa di dokumen (dangling reference ini sebelumnya sudah ada terlepas dari MCP, pastikan tidak lolos tanpa catatan).

**Tahap 5 — Cleanup Opsional**
- [ ] Pertimbangkan mekanisme cleanup wrapper script `~/.sigma/mcp-run-sigma-memory.js` dari instalasi lama (opsional, dicatat sebagai pertimbangan bukan keharusan — instalasi baru sudah tidak akan menulis file ini lagi setelah Tahap 1).

**Tahap 6 — Dokumentasi**
- [ ] Update `README.md`/`Sigma/SIGMA_PROTOCOL.md` yang menyebut MCP/sequential-thinking/Reasonix/Antigravity MCP config.

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

- [ ] `src/utils/mcp.ts` tidak lagi ada (atau sudah dikosongkan sesuai keputusan Tahap 1).
- [ ] `project start` tidak lagi menulis `.mcp.json`/`.vscode/mcp.json` berisi `sequential-thinking`.
- [ ] `CLAUDE.md` project ini tidak lagi memuat section "MCP Tooling".
- [ ] Tidak ada dangling reference ke `sigma refresh` yang lolos tanpa catatan.
- [ ] `setup.ts` tetap bisa di-build (tidak ada import rusak ke `mcp.ts`) meski final pass isinya baru selesai di PLAN-EVAL-08.
- [ ] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini.
- [ ] README.md/SIGMA_PROTOCOL.md tidak lagi menyebut MCP/Reasonix/Antigravity/sequential-thinking sebagai fitur aktif.
