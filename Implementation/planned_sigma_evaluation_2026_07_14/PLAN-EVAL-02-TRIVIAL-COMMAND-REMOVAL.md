# PLAN-EVAL-02 — Penghapusan Command Trivial & Redundan (`gitignore generate`, `sigma sync *`)

**Sumber**: `Discussion/sigma-system-evaluation-2026-07-14.md` (Topik 4 — kategori "Evaluate to be removed" & keluarga `sigma sync`)
**Tanggal**: 2026-07-14
**Status**: DRAFT FOR REVIEW
**Urutan eksekusi**: 2 dari 8 (lihat `README.md` di folder ini)
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN, tidak punya otoritas lock/gate Sigma.

---

## Objective

Menghapus command yang sudah disepakati Director sebagai redundan/tidak
esensial dengan risiko teknis paling rendah di seluruh antrian evaluasi:
`gitignore generate` dan keluarga `sigma sync` (`sync progress`, `sync
roadmap`). Tidak satu pun menyentuh gate/lock chain — murni penghapusan
command dan dead code pendukungnya.

---

## Bagian A — `gitignore generate`

**Alasan Director**: Trivial, hampir tidak dipakai — cukup tambah folder
`Sigma/` ke `.gitignore` manual.

**Catatan risiko**: Aman dihapus — command ini murni print ke stdout, tidak
menyentuh state/gate apapun.

### Task Breakdown — Bagian A
- [x] Cari dan hapus command `gitignore generate` di source (`src/commands/`).
- [x] Hapus registrasinya di `src/cli.ts`.
- [x] Hapus test terkait (grep `gitignore` di folder `test/`) — tidak ditemukan test khusus untuk command ini, tidak ada yang perlu dihapus.
- [x] Update README.md/SIGMA_PROTOCOL.md yang menyebut `sigma gitignore generate`.

---

## Bagian B — Keluarga `sigma sync` (`sync progress`, `sync roadmap`)

### Latar Belakang Teknis (sudah diverifikasi dari kode)

- **`sync progress`** ([sync.ts:148-204](../../src/commands/sync.ts#L148-L204)) — migrasi schema lama→baru: remap enum lama `BUILDING/TESTING/COMPLETED` → `DRAFT`, hapus field `cso` legacy dari root `progress.json` (dikonfirmasi field ini sudah tidak ada sama sekali di schema `ProgressJson` saat ini), tambah `plan.pending` kalau hilang.
- **`sync roadmap`** ([sync.ts:208-279](../../src/commands/sync.ts#L208-L279)) — bootstrap ROADMAP freeform lama jadi format CLI-managed, scrape judul stage dari file FMN-PLAN, lalu memanggil `render()` di baris terakhir. `generateRoadmapFromPlans()` ([sync.ts:37-144](../../src/commands/sync.ts#L37-L144)) punya **template ROADMAP hardcode terpisah** di dalam `sync.ts` (struktur 6-section lama) — otomatis usang setelah PLAN-EVAL-03 (restrukturisasi ke 3 section).
- Kedua command **bukan redundan secara teknis** dengan `doctor`/`render` — beda kelas masalah (migrasi struktur lama, bukan rekonsiliasi state current). Tapi Director menilai tidak diperlukan lagi — project lama yang butuh migrasi ini dianggap risiko yang diterima secara sadar.

### Keputusan (dari sesi evaluasi)

Kedua command **dihapus**, beserta seluruh sistem pendukung yang bergantung
padanya. Project lama (progress.json dengan enum state usang, atau ROADMAP
freeform tanpa H2 convention) tidak lagi punya jalur migrasi otomatis —
Director menerima risiko ini secara sadar.

### Task Breakdown — Bagian B

- [x] Hapus `src/commands/sync.ts` — kedua subcommand (`progress`, `roadmap`) adalah satu-satunya isi command ini, jadi seluruh command `sync` beserta file-nya bisa dihapus penuh.
- [x] Hapus registrasi `import { syncCommand } from './commands/sync'` dan `program.addCommand(syncCommand())` di `src/cli.ts:18` dan `src/cli.ts:45`.
- [x] Pastikan dead code berikut ikut terhapus (satu file dengan command, tidak perlu langkah terpisah): `runSyncProgress`, `runSyncRoadmap`, `generateRoadmapFromPlans`, `extractStageTitleFromPlan`.
- [x] Tinjau `test/roadmap-migration.test.ts` — **diverifikasi tidak menguji `sync roadmap`** (hanya menguji `src/utils/roadmap.ts` dan `docCheck.ts`, tidak menyentuh `sync.ts` sama sekali); asumsi plan ini keliru — dibiarkan tidak berubah.
- [x] Update README.md/SIGMA_PROTOCOL.md yang menyebut `sigma sync progress`/`sigma sync roadmap`.

---

## Dependency Catatan

Tidak ada dependency mengikat ke PLAN-EVAL-03 (restrukturisasi roadmap) meski
`sync roadmap` memanggil `render()` — karena `sync.ts` dihapus total di sini,
urutan relatif terhadap PLAN-EVAL-03 tidak memengaruhi hasil akhir. Boleh
dikerjakan sebelum atau sesudah PLAN-EVAL-03.

---

## Risiko

- Tidak ada jalur migrasi otomatis tersisa untuk project lama dengan schema/ROADMAP usang setelah command ini dihapus — sudah diterima sadar oleh Director, cukup dicatat ulang di release notes bila ada.
- Pastikan tidak ada command lain yang mengimpor fungsi dari `sync.ts` sebelum menghapus filenya (cek dengan grep `from './sync'` / `from '../commands/sync'`).

---

## Draft Acceptance Criteria

- [x] `sigma gitignore generate` tidak lagi terdaftar di CLI.
- [x] `sigma sync progress` dan `sigma sync roadmap` tidak lagi terdaftar di CLI.
- [x] `src/commands/sync.ts` terhapus dari repo.
- [x] Tidak ada import dangling ke `sync.ts` atau `gitignore.ts` di file manapun.
- [x] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini — **catatan**: 7 test pre-existing gagal (5 file: `chain-gate`, `gate-enforcement`, `intent-lock`, `plan-activate`, `progress-hardening`) sudah gagal identik di baseline sebelum PLAN-EVAL-02 disentuh (diverifikasi via `git stash` + rerun), tidak terkait perubahan plan ini. Lihat Implementation Walkthrough.
- [x] README.md/SIGMA_PROTOCOL.md sudah diperbarui, tidak lagi menyebut command yang dihapus di tahap ini.

**Status**: DONE — 2026-07-14

---

## Implementation Walkthrough

**Dikerjakan**: 2026-07-14, Professional Mode (AI pengembang/teknisi sigma).
**Approval**: Explicit Director approval diberikan setelah 3 open question dijawab (lihat di bawah).

### Open Questions yang muncul saat studi plan (dijawab Director sebelum eksekusi)

Studi teknis sebelum implementasi menemukan gap antara task breakdown plan ini
dan kondisi aktual source code — tiga titik referensi ke `gitignore`/`sync`
yang tidak disebut di plan, plus satu asumsi task breakdown yang keliru:

1. **Scope tambahan tidak tercakup plan** — ditemukan 3 referensi dead code/dead
   doc yang tidak disebut task breakdown:
   - `src/utils/mcp.ts` — `'sigma sync'` di array `SIGMA_SHELL_ALLOWED` (dipakai
     `sigma setup memory --reasonix` untuk generate shell allowlist Reasonix).
   - `src/engine/progress.ts` — `ops.push('gitignore generate')` di dalam
     `getNextValidOperations()`, yang memberi saran command berikutnya untuk
     `sigma project status` dan `sigma session bootstrap`.
   - `Sigma/SIGMA-OPERATION-REGISTRY.json` — 3 entry operation (`gitignore_generate`,
     `sync_progress`, `sync_roadmap`). Dikonfirmasi file ini adalah bundle template
     yang di-copy `sigma project sync`/`sigma setup` ke project baru — **bukan**
     auto-generated; script `scripts/refresh-registries.js` (`npm run refresh-registries`)
     hanya MENAMBAH operation baru ke registry, tidak pernah menghapus entry stale
     (hanya melaporkan sebagai "review manually").
   → **Keputusan Director**: bersihkan ketiganya sebagai bagian dari scope plan ini.

2. **Asumsi task breakdown Bagian B keliru** — `test/roadmap-migration.test.ts`
   diklaim "kemungkinan menguji perilaku `sync roadmap`". Diverifikasi salah:
   test ini hanya menguji `migrateRoadmapCoreProcessFlowContent`/`renderRoadmapFile`
   dari `src/utils/roadmap.ts` dan `validateSigmaDocFile` dari `docCheck.ts` —
   tidak menyentuh `sync.ts` sama sekali. Tidak ada test file khusus untuk
   `sync`/`gitignore` commands ditemukan di folder `test/` sama sekali.
   → **Keputusan Director**: biarkan test file ini tidak disentuh.

3. **Build artifact `dist/`** — ter-track di git dan sudah termodifikasi sebelum
   sesi ini dimulai.
   → **Keputusan Director**: jalankan `npm run build` di akhir sebagai bagian dari task.

### Perubahan aktual (di luar apa yang tertulis literal di task breakdown awal)

Selain seluruh task breakdown Bagian A dan B di atas, perubahan berikut
dilakukan sebagai hasil open question #1:

- `src/utils/mcp.ts` — hapus `'sigma sync'` dari `SIGMA_SHELL_ALLOWED`.
- `src/engine/progress.ts` — hapus `ops.push('gitignore generate')` dari `getNextValidOperations()`.
- `Sigma/SIGMA-OPERATION-REGISTRY.json` — hapus 3 operation entry (`gitignore_generate`,
  `sync_progress`, `sync_roadmap`), hapus domain `"gitignore"` dari array `domains`
  (domain `"sync"` **dipertahankan** karena masih dipakai `project_sync`, yaitu
  `sigma project sync` — fitur doctrine sync yang berbeda dan tidak dihapus),
  `total_operations` disesuaikan 62 → 59.
- `Sigma/SIGMA_PROTOCOL.md` — Section 16 (CLI Command Surface): hapus baris domain
  `sync` dan `gitignore`. Tambah entri changelog v0.4 mencatat perubahan ini.
- `README.md` — hapus 2 baris command reference (`sync progress`/`sync roadmap`);
  rewrite section "Updating Sigma — Backward Compatibility for Registered Projects":
  migration sequence dipangkas dari 6 langkah jadi 4 (langkah `sync progress`/
  `sync roadmap` dihapus, sisanya di-renumber), tabel "What each command does"
  disesuaikan, ditambah catatan eksplisit bahwa tidak ada lagi jalur migrasi
  otomatis untuk project lama dengan schema/ROADMAP usang (risiko yang sudah
  diterima sadar oleh Director — lihat bagian Risiko di atas).

### Verifikasi

- `npm run build` — sukses tanpa error TypeScript.
- Dist stale (`dist/commands/gitignore.*`, `dist/commands/sync.*`) dihapus manual
  karena `tsc` (non-incremental, tanpa `--build`) tidak membersihkan output file
  yang sourcenya sudah dihapus.
- `npm test` — 105 passed, 7 failed (5 file: `chain-gate.test.ts`,
  `gate-enforcement.test.ts`, `intent-lock.test.ts`, `plan-activate.test.ts`,
  `progress-hardening.test.ts`). Dikonfirmasi **pre-existing** via `git stash`
  (stash seluruh perubahan PLAN-EVAL-02, rebuild, rerun test di baseline commit
  `f428d68`) — hasil gagal identik persis (jumlah, nama test, pesan error terkait
  `--title` option dan gate ordering) baik sebelum maupun sesudah perubahan plan
  ini. Tidak terkait penghapusan `gitignore`/`sync`; di luar scope plan ini.
- Grep akhir: tidak ada dangling import ke `commands/sync` atau `commands/gitignore`
  di `src/`; tidak ada sisa referensi `sigma sync`/`sigma gitignore` di README.md
  atau SIGMA_PROTOCOL.md selain catatan penjelasan penghapusan yang sengaja ditulis.
  Referensi historis di `Implementation/*.md` dan `Discussion/*.md` (dokumen
  planning/diskusi masa lalu) sengaja tidak diubah — itu catatan historis, bukan
  dokumentasi CLI aktif.
