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
- [ ] Cari dan hapus command `gitignore generate` di source (`src/commands/`).
- [ ] Hapus registrasinya di `src/cli.ts`.
- [ ] Hapus test terkait (grep `gitignore` di folder `test/`).
- [ ] Update README.md/SIGMA_PROTOCOL.md yang menyebut `sigma gitignore generate`.

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

- [ ] Hapus `src/commands/sync.ts` — kedua subcommand (`progress`, `roadmap`) adalah satu-satunya isi command ini, jadi seluruh command `sync` beserta file-nya bisa dihapus penuh.
- [ ] Hapus registrasi `import { syncCommand } from './commands/sync'` dan `program.addCommand(syncCommand())` di `src/cli.ts:18` dan `src/cli.ts:45`.
- [ ] Pastikan dead code berikut ikut terhapus (satu file dengan command, tidak perlu langkah terpisah): `runSyncProgress`, `runSyncRoadmap`, `generateRoadmapFromPlans`, `extractStageTitleFromPlan`.
- [ ] Tinjau `test/roadmap-migration.test.ts` — kemungkinan menguji perilaku `sync roadmap`; hapus atau sesuaikan.
- [ ] Update README.md/SIGMA_PROTOCOL.md yang menyebut `sigma sync progress`/`sigma sync roadmap`.

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

- [ ] `sigma gitignore generate` tidak lagi terdaftar di CLI.
- [ ] `sigma sync progress` dan `sigma sync roadmap` tidak lagi terdaftar di CLI.
- [ ] `src/commands/sync.ts` terhapus dari repo.
- [ ] Tidak ada import dangling ke `sync.ts` atau `gitignore.ts` di file manapun.
- [ ] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini.
- [ ] README.md/SIGMA_PROTOCOL.md sudah diperbarui, tidak lagi menyebut command yang dihapus di tahap ini.
