# RESULT-IMPL — Perbaikan non-atomic write (chain.ts / controlStore.ts / canonicalWrite.ts)

**Tanggal**: 2026-09-16
**Sumber**: Temuan Codex, `RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md` §21.9, ditutup di §23.5 sebagai "item plan tersendiri sebelum Stage E menambah primitive baru yang bergantung pada asumsi atomic write di chain.ts." Dirujuk ulang di `RESULT-IMPL-SIGMA-MCP-STAGE-D-20260915.md` §19.6/§21.3 tanpa remediasi tambahan.
**Perintah Director**: "putuskan soal chain.ts dulu karena itu fondasi" — dikerjakan sebelum Stage E dimulai, sesuai keputusan cakupan Director (chain.ts **dan** controlStore.ts, lihat di bawah).
**Status**: Ditutup untuk implementasi. Menunggu review independen Codex (belum di-declare "PASS" oleh implementer).

## 1. Temuan asal

`writeChain()` dan `writeActivateStatus()` (`src/engine/chain.ts`) memakai idiom `fs.writeJsonSync(tmp, ...); fs.moveSync(tmp, dest, { overwrite: true })` dari fs-extra. `fs-extra`'s `move-sync.js` mengimplementasikan `overwrite:true` sebagai `removeSync(dest)` **lalu** `rename()` — dua syscall terpisah, bukan atomic replace tunggal. Reproduksi empiris dua-thread pada §21.9 mengukur ~55% pembacaan konkuren melihat file target hilang total selama jendela tulis.

## 2. Cakupan fix (keputusan Director, klarifikasi 2026-09-16)

Diperluas dari dua fungsi yang disebut literal menjadi seluruh keluarga call site dengan idiom identik, karena root cause-nya sama persis dan fix-nya satu baris per titik:

| File | Fungsi/lokasi | Peran |
|---|---|---|
| `src/engine/chain.ts` | `writeActivateStatus()` | Pointer `active_chain` |
| `src/engine/chain.ts` | `writeChain()` | File `progress-vN.json` |
| `src/engine/controlStore.ts` | `writeJsonAtomic()` (private helper) | Idempotency record, operation ticket, approval record |
| `src/engine/controlStore.ts` | migration marker write (`appendAuditEntry`) | Migrasi audit log legacy JSONL sekali jalan |
| `src/engine/controlStore.ts` | audit projection write (`appendAuditEntry`) | `Sigma/.mcp-control/audit.jsonl` |
| `src/engine/controlStore.ts` | `restoreSnapshots()` (transaction rollback) | Restore before-image saat rollback transaksi |
| `src/mcp/control/canonicalWrite.ts` | `writeCanonicalArtifactFile()` | Isi artifact DRAFT (dipakai `sigma_update_artifact_draft`, dan akan dipakai `sigma_create_plan_draft`) |

`src/commands/plan.ts:304` (`fs.moveSync(oldAbsPath, newAbsPath)`, tanpa `overwrite:true`, dipakai `plan promote` untuk memindahkan file pending ke path final) diperiksa dan **sengaja tidak diubah** — bukan idiom tmp+overwrite, melainkan rename murni ke path yang belum ada.

## 3. Deviasi dari rencana — temuan Windows EPERM (baru, ditemukan selama implementasi)

Rencana awal (mengikuti saran Codex di §21.9) adalah mengganti `fs.moveSync(tmp, dest, {overwrite:true})` dengan `fs.renameSync(tmp, dest)` langsung — tanpa dependency baru. Saat menulis test regresi (busy-loop reader vs. writer, metodologi identik §21.9), fix naif ini **gagal** pada Windows dengan `EPERM: operation not permitted, rename ...` setiap kali dijalankan di bawah kontensi.

**Analisis akar penyebab**: `fs-extra` memakai `graceful-fs`, yang men-patch `fs.rename` (versi callback/async) di Windows untuk retry otomatis pada `EACCES`/`EPERM`/`EBUSY` (`node_modules/graceful-fs/polyfills.js`). Tetapi retry itu **hanya** dipicu bila `stat(dest)` gagal dengan `ENOENT` (destination belum ada) — persis kebalikan dari kasus kita, di mana destination **sudah ada** dan justru sedang ditimpa (overwrite). Untuk kasus overwrite, patch itu langsung menyerah pada percobaan pertama. `graceful-fs` juga tidak pernah men-patch varian **sync** (`renameSync`) sama sekali — hanya versi callback. Jadi `fs.renameSync` polos, di Windows, di bawah kontensi baca konkuren pada file yang sedang ditimpa, tidak punya jaring pengaman sama sekali.

**Fix**: helper baru `atomicReplaceFileSync(tmpPath, destPath)` di `src/utils/fs.ts` — memanggil `fs.renameSync` (atomic replace OS-level asli), dengan retry loop sendiri (bukan dependency baru) pada `EPERM`/`EACCES`/`EBUSY`, budget total 5 detik, jeda antar percobaan 5ms via `Atomics.wait` (sleep sinkron asli, bukan busy-spin CPU — meniru rasional komentar `graceful-fs` sendiri soal starvation scheduler Windows). Semua tujuh titik di §2 sekarang memanggil helper ini, bukan `fs.renameSync` langsung.

Ini bukan penyimpangan cakupan (masih persis file yang sama, masih tanpa dependency baru), tetapi penyimpangan dari solusi literal yang disarankan Codex — solusi naif itu benar secara POSIX tetapi tidak reliable di Windows di bawah kontensi nyata, dan proyek ini berjalan di Windows sebagai environment pengembangan utama.

## 4. Test dan evidence

**Baru**: `test/atomic-write-regression.test.ts` (4 test) + helper `test/helpers/existsBusyLoop.worker.mjs` — worker thread nyata (bukan simulasi dalam satu call stack) melakukan busy-loop `fs.existsSync()` pada file target selama writer di thread utama menimpa file itu berulang kali selama ~1.2 detik, menghitung `reads`/`misses`.

| Target | Reads (representatif) | Misses sebelum fix (idiom lama, diverifikasi manual) | Misses sesudah fix |
|---|---|---|---|
| `writeChain()` → `progress-v1.json` | ~28.000+ | 28.192 | **0** |
| `writeActivateStatus()` → `activate_status.json` | ~27.000+ | 27.250 | **0** |
| `writeTicket()` → `.mcp-control/tickets/*.json` (mewakili `writeJsonAtomic`) | puluhan ribu | tidak diukur terpisah (idiom identik ke `writeChain`) | **0** |
| `writeCanonicalArtifactFile()` → `Sigma/charter/DIR-INTENT-v1.md` | puluhan ribu | tidak diukur terpisah (idiom identik) | **0** |

Verifikasi "sebelum fix" dilakukan dengan mengembalikan sementara `writeChain`/`writeActivateStatus` ke `fs.moveSync(tmp, dest, {overwrite:true})`, menjalankan test tersebut (gagal dengan miss count di atas), lalu mengembalikan ke fix — membuktikan test benar-benar mendeteksi regresi, bukan lolos secara trivial.

**Regresi penuh**:
- `npm run build` — bersih.
- `npm test` — **54 file / 622 test PASS** (naik dari baseline 53 file/618 test sebelum perubahan ini; delta murni dari file test baru, tidak ada test yang hilang atau berubah perilaku).

## 5. Risiko residual

- Retry budget 5 detik adalah nilai pilot, bukan hasil tuning terhadap beban produksi nyata — dipilih untuk menutupi jendela kontensi realistis (AV/indexer Windows umumnya melepas lock dalam puluhan-ratusan ms) tanpa membuat command Sigma menggantung lama saat lock benar-benar macet. Bila retry habis, error asli (`EPERM`/dll.) tetap dilempar ke pemanggil — tidak ada silent failure baru yang diperkenalkan.
- `atomicReplaceFileSync` tidak menangani kasus lintas-filesystem (`EXDEV`) karena semua tmp path di seluruh call site berada di direktori yang sama dengan destination-nya (`${dest}.tmp...`) — properti yang sudah ada sebelum fix ini, tidak berubah.
- Fix ini menutup temuan §21.9 untuk ketujuh titik di §2. Tidak ada scan otomatis yang mencegah titik baru memakai idiom lama di masa depan (tidak ada test statis/guard) — dipertimbangkan out of scope untuk perbaikan sempit ini, bisa jadi item Stage E/lint-rule terpisah bila dianggap perlu oleh Director/Codex.

## 6. File yang berubah

- `src/utils/fs.ts` — `atomicReplaceFileSync()` baru.
- `src/engine/chain.ts` — `writeChain()`, `writeActivateStatus()` memakai helper baru.
- `src/engine/controlStore.ts` — `writeJsonAtomic()`, migration marker write, audit projection write, `restoreSnapshots()` memakai helper baru.
- `src/mcp/control/canonicalWrite.ts` — `writeCanonicalArtifactFile()` memakai helper baru.
- `test/atomic-write-regression.test.ts` — baru.
- `test/helpers/existsBusyLoop.worker.mjs` — baru.
- `dist/**` — hasil build ulang (`tsc`), tidak diedit manual.

Working tree tidak di-commit oleh implementer — menunggu keputusan Director/Codex.
