# PLAN-EVAL-03 — Restrukturisasi Sistem ROADMAP (Template 6→3 Section + Konsolidasi Subcommand)

**Sumber**: `Discussion/sigma-system-evaluation-2026-07-14.md` (Topik 1, Topik 4 — keluarga `sigma roadmap`)
**Tanggal**: 2026-07-14
**Status**: IMPLEMENTED (2026-07-14) — Bagian A dan Bagian B selesai dikerjakan dan diverifikasi. Lihat "Implementation Walkthrough" di akhir dokumen.
**Urutan eksekusi**: 3 dari 8 (lihat `README.md` di folder ini)
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN, tidak punya otoritas lock/gate Sigma.

---

## Objective

Menyatukan dua topik yang secara teknis satu akar mekanisme: restrukturisasi
template ROADMAP dari 6 section jadi 3 section (Topik 1), dan konsolidasi
keluarga command `sigma roadmap` dari 7 subcommand jadi 5 (Topik 4). Keduanya
tidak bisa dipisah karena perubahan sumber data Stage Overview (dari parsing
teks H2 ke baca langsung `progress.json`) adalah pekerjaan yang sama persis.

---

## Bagian A — Restrukturisasi Template ROADMAP (6 → 3 Section)

### Keputusan Struktur Final

| Section lama | Keputusan |
|---|---|
| 1. Roadmap Purpose | **Diganti** → "Overview": manual, ditulis FMN, maks ±5 kalimat. Isi: arah besar implementasi, output akhir, cara singkat mencapainya. |
| 2. Source Intent Alignment | **Dihapus** — sudah terwakili di Section 1 tiap FMN-PLAN. |
| 3. Stage Overview (tabel) | **Dipertahankan** — satu-satunya representasi ringkasan stage, sepenuhnya otomatis via `sigma roadmap render`. |
| 4. Core Process Flow | **Dipertahankan**, disederhanakan jadi **hanya diagram Mermaid**, tanpa narasi teks. Manual, diedit ulang saat ada perubahan signifikan. |
| 5. Stage Details (blok teks H2/H3 per stage) | **Dihapus total**. Tidak ada lagi field manual (Focus, Main Output, Main Tasks, Explicit Non-Scope, Dependency/Gate, Risk/Watch-Out). Data judul+focus cukup hidup di tabel Stage Overview, disuplai lewat flag `--title`/`--focus` saat `sigma plan new`. |
| 6. FMN Roadmap Notes | **Dihapus** — rawan outdate, tidak esensial. |

**Hasil akhir**: ROADMAP hanya punya 3 section: Overview (teks singkat manual) +
Core Process Flow (diagram Mermaid manual) + Stage Overview (tabel,
full-otomatis).

**Ide yang ditolak** (dicatat supaya tidak diusulkan ulang tanpa konteks):
Auto-generate section penting dari FMN-PLAN ke ROADMAP (mis. ringkasan
Acceptance Criteria/risiko) — ditolak karena mengembalikan ROADMAP jadi padat
(hanya bedanya diisi otomatis) dan menciptakan coupling struktural baru
(perubahan template FMN-PLAN ke depan jadi terikat menjaga kontrak ekstraksi
ke ROADMAP).

### Task Breakdown — Bagian A

**Tahap A.1 — Sumber Data Baru**
- [x] Ubah `generateStageOverview()` ([roadmap.ts:41](../../src/utils/roadmap.ts#L41)) agar sumber datanya bukan lagi `parseStages()` yang membaca teks H2 dari file, melainkan baca langsung dari `progress.json` per-plan version (title/focus/status).
  - Signature berubah jadi `generateStageOverview(data, roadmapVersion)`. Filter memakai `intent_version_ref` tiap plan version dicocokkan ke major version ROADMAP (`parseMajorVersion`), bukan aritmatika `PLAN major = INTENT major − 1` — karena versi ROADMAP secara desain sama dengan major INTENT, sedangkan major PLAN sendiri punya offset berbeda. `renderRoadmapFile()` menentukan `roadmapVersion` otomatis dari entry `roadmap.versions` yang berstatus ACTIVE di `data`, jadi seluruh caller lama (`plan.ts`, `roadmap.ts`) tidak perlu diubah pemanggilannya.
- [x] Pastikan flag `--title`/`--focus` di `sigma plan new` menulis data ini ke `progress.json` (cek `src/commands/plan.ts`), karena ini jadi satu-satunya sumber data judul+focus setelah Stage Details dihapus.
  - Sudah berjalan sebelum plan ini (via `registerPlanDraft`/`promotePendingPlan`/`updatePlanMetadata`) — tidak ada perubahan diperlukan di titik ini, hanya diverifikasi.
- [x] Hapus `STAGE_STUB_TEMPLATE()` ([roadmap.ts:236](../../src/utils/roadmap.ts#L236)) dan mekanisme append blok teks stage: `appendRoadmapSectionStub`, `updateStageMetadata` — tidak lagi menulis blok H2/H3 penuh.
  - Turut dihapus: `parseStages`, `StageEntry`, `planStateForStage` (sudah tidak terpakai sama sekali setelah `render`/`list` pindah sumber data — bukan cuma stub/migration helper yang disebut eksplisit di task ini).

**Tahap A.2 — Template**
- [x] Revisi `Sigma/templates/ROADMAP-TEMPLATE.md`: hapus section 1, 2, 5, 6 lama; ganti section 1 jadi "Overview" (manual, ≤5 kalimat); sederhanakan Core Process Flow jadi Mermaid-only; pertahankan Stage Overview sebagai tabel auto-managed.
  - Urutan final section (keputusan Director saat implementasi): Overview → Core Process Flow → Stage Overview — mengikuti urutan literal kalimat Objective, bukan urutan fisik template lama (Stage Overview sebelumnya ada di posisi tengah).
- [x] Revisi `Sigma/rules/FMN-RULE.md` bagian "Mandatory: ROADMAP as Staging Requirement" dan "H2 Stage Section Rules" — sesuaikan dengan struktur baru (tidak ada lagi kewajiban menulis blok H2 per-stage).
  - "H2 Stage Section Rules" diganti jadi "Stage Overview Rules" (4 butir, tanpa referensi H3 body per-stage yang sudah tidak ada).

---

## Bagian B — Konsolidasi Keluarga `sigma roadmap` (7 → 5 Subcommand)

### Temuan Teknis

Ditemukan 3 command tumpang tindih, semuanya memanggil `parseStages()` yang sama:
- `render` ([roadmap.ts:201-220](../../src/commands/roadmap.ts#L201-L220)) — regenerate tabel Stage Overview, tulis ke file.
- `reconcile` ([roadmap.ts:224-321](../../src/commands/roadmap.ts#L224-L321)) — bandingkan `parseStages()` vs `progress.json` dua arah; `--fix` memanggil fungsi render yang sama persis ([roadmap.ts:300](../../src/commands/roadmap.ts#L300)) — jadi `reconcile --fix` sudah menelan `render` di dalamnya.
- `list` ([roadmap.ts:325-390](../../src/commands/roadmap.ts#L325-L390)) — `parseStages()` lagi, hasilnya nyaris identik dengan tabel Stage Overview, bedanya dicetak ke layar bukan ditulis ke file.

Root cause redundansi `reconcile`: dulu ada 2 sumber data terpisah (teks H2 di
file ROADMAP vs entry plan di `progress.json`) yang bisa tidak sinkron.
Setelah Bagian A selesai (Stage Details dihapus, tabel langsung bersumber dari
`progress.json`), tidak ada lagi dua sisi yang perlu direkonsiliasi.

`migrate-core-flow` juga dicek: tidak ada file ROADMAP aktif di repo dengan
konten legacy "Phase Dependencies" (hanya jejak di registry, bukan konten
nyata). Hasil migrasinya pun format Core Process Flow versi **lama**
(prosa/Mermaid opsional) — bukan versi baru hasil Bagian A (Mermaid-only) —
jadi command ini menargetkan format yang sudah usang dua kali lipat. Migrasi
manual (backup file lama, drop template baru, isi ulang) sudah sepenuhnya
kompatibel dengan `render` tanpa tool migrasi apapun.

### Keputusan

- `reconcile` **dihapus**, fungsinya digabung ke `render` (regenerate tabel langsung dari `progress.json`, tanpa perlu cek mismatch/flag `--fix` karena secara struktural tidak mungkin lagi tidak sinkron).
- `migrate-core-flow` **dihapus** — pendekatan manual konvensional sudah cukup.
- `list` **dipertahankan terpisah** — tetap command read-only tersendiri, tapi sumber datanya diupdate mengikuti perubahan Bagian A.1.
- `check` (validasi struktur/marker), `new`, `activate` **tidak termasuk** konsolidasi ini — tujuannya berbeda/murni lifecycle.
- **Hasil akhir**: keluarga `roadmap` dari 7 subcommand → **5 subcommand** (`new`, `check`, `activate`, `render`, `list`).

### Task Breakdown — Bagian B

- [x] Hapus `cmd.command('reconcile')` di `src/commands/roadmap.ts` ([roadmap.ts:224-321](../../src/commands/roadmap.ts#L224-L321)).
- [x] Hapus `cmd.command('migrate-core-flow')` ([roadmap.ts:126-144](../../src/commands/roadmap.ts#L126-L144)) dan fungsi pendukungnya di `src/utils/roadmap.ts`: `migrateRoadmapCoreProcessFlowFile`, `migrateRoadmapCoreProcessFlowContent`, `extractLegacyPhaseDependenciesBody`, `normalizeLegacyPhaseDependenciesBody`, `buildCoreProcessFlowSection`, `ensureMarkerBeforeHeading`, `normalizedLegacyMessage`.
- [x] Update `list` ([roadmap.ts:325-390](../../src/commands/roadmap.ts#L325-L390)) agar sumber datanya sama dengan `render` (langsung dari `progress.json`, bukan `parseStages()` dari file) — konsisten dengan Bagian A.1.
  - Ditambah helper baru `getStagePlansForRoadmap(data, roadmapVersion)` di `src/utils/roadmap.ts`, dipakai bersama oleh `generateStageOverview()` (untuk `render`) dan command `list` — satu fungsi filter, dua pemakai, menghindari duplikasi logika filter major version.
- [x] Update README.md/SIGMA_PROTOCOL.md yang menyebut `sigma roadmap reconcile` dan `sigma roadmap migrate-core-flow`.
  - Turut diperbarui (ditemukan saat implementasi, di luar dua command literal yang disebut task ini): baris tabel command `sigma roadmap check` yang sebelumnya tidak pernah terdaftar di README meski sudah ada di CLI; paragraf "Reconcile invariant" dan kalimat "Each ROADMAP H2 stage section..." di `SIGMA_PROTOCOL.md`; entri changelog v0.5 ditambahkan di `SIGMA_PROTOCOL.md` mengikuti konvensi v0.3/v0.4 yang sudah ada.

---

## Dependency Catatan

- Bagian A dan B harus dikerjakan dalam satu tahap yang sama (tidak bisa
  dipisah ke plan lain) — perubahan sumber data (`parseStages()` →
  `progress.json`) di Bagian A.1 adalah prasyarat langsung Bagian B.
- Tidak ada dependency masuk dari PLAN-EVAL-02 (trivial removal) — lihat
  catatan dependency di dokumen tersebut.

---

## Risiko

- `parseStages()` saat ini masih dipakai beberapa command (`render`, `list`,
  yang lama `reconcile`) — pastikan seluruh caller diupdate serentak ke sumber
  data baru, jangan sisakan satu command yang masih baca dari teks H2 sementara
  yang lain sudah baca dari `progress.json` (akan menciptakan inkonsistensi
  baru, persis masalah yang coba dihilangkan topik ini).
- Project lama dengan ROADMAP masih format 6-section/teks H2 tidak lagi punya
  jalur migrasi otomatis (`migrate-core-flow` dihapus) — konsisten dengan
  keputusan PLAN-EVAL-02 soal `sync roadmap`, risiko diterima sadar oleh
  Director.

---

## Draft Acceptance Criteria

- [x] `Sigma/templates/ROADMAP-TEMPLATE.md` hanya berisi 3 section: Overview, Core Process Flow (Mermaid-only), Stage Overview.
- [x] `sigma roadmap render` menghasilkan tabel Stage Overview dari `progress.json`, bukan parsing teks H2 file.
- [x] `sigma roadmap list` konsisten dengan hasil `render` (sumber data sama).
- [x] `sigma roadmap reconcile` dan `sigma roadmap migrate-core-flow` tidak lagi terdaftar di CLI.
- [x] `FMN-RULE.md` tidak lagi mewajibkan penulisan blok H2 Stage Details.
- [x] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini. — 107 passed / 7 failed; 7 kegagalan itu sudah dikonfirmasi pre-existing (identik sebelum dan sesudah perubahan sesi ini, diverifikasi lewat `git stash` + re-run). Lihat `PLAN-EVAL-10` untuk investigasi akar masalahnya.

---

## Implementation Walkthrough

**Dikerjakan**: 2026-07-14, Professional Mode (bukan DEV role Sigma — plan ini tidak melalui gate Sigma).

### Files Changed

| File | Perubahan |
|:--- |:--- |
| [src/utils/roadmap.ts](../../src/utils/roadmap.ts) | Ditulis ulang. `generateStageOverview()` baca dari `progress.json` via helper baru `getStagePlansForRoadmap()`; `renderRoadmapFile()` menentukan roadmap ACTIVE dari `data` sendiri (signature caller tidak berubah). Dihapus: `parseStages`, `StageEntry`, `planStateForStage`, `STAGE_STUB_TEMPLATE`, `appendRoadmapSectionStub`, `updateStageMetadata`, seluruh fungsi migrasi `migrateRoadmapCoreProcessFlow*`. |
| [src/commands/roadmap.ts](../../src/commands/roadmap.ts) | Hapus subcommand `reconcile` dan `migrate-core-flow`; `list` dipindah ke `getStagePlansForRoadmap()`; import `fs` tidak lagi diperlukan. |
| [src/commands/plan.ts](../../src/commands/plan.ts) | `new`/`promote`/`update` tidak lagi memanggil `appendRoadmapSectionStub`/`updateStageMetadata` (sudah dihapus) — hanya `renderRoadmapFile()` setelah `writeProgress()`. Pesan console yang menyebut "appended"/"FMN needs to update the content in the Roadmap" disesuaikan jadi "Stage Overview regenerated". Help text `--title`/`--focus` diperbarui (tidak lagi menyebut "stage heading"/"plan breakdown" yang sudah tidak ada). |
| [src/utils/docCheck.ts](../../src/utils/docCheck.ts) | **Di luar task breakdown tertulis, wajib diperbaiki agar validator tidak menolak template baru.** `DOC_SPECS.roadmap.requiredSections` diganti dari 6 marker lama ke `[OVERVIEW, CORE_PROCESS_FLOW, STAGE_OVERVIEW]`; 2 baris hint legacy yang menyarankan `sigma roadmap migrate-core-flow` dihapus. |
| [Sigma/templates/ROADMAP-TEMPLATE.md](../../Sigma/templates/ROADMAP-TEMPLATE.md) | Ditulis ulang ke 3 section sesuai keputusan urutan Overview → Core Process Flow → Stage Overview. |
| [Sigma/rules/FMN-RULE.md](../../Sigma/rules/FMN-RULE.md) | "H2 Stage Section Rules" → "Stage Overview Rules"; referensi H2/H3 per-stage dihapus. |
| [README.md](../../README.md) | Tabel command `roadmap`: baris `reconcile` dihapus, baris `check` (sebelumnya tidak terdaftar) ditambahkan, deskripsi `render`/`list` disesuaikan. |
| [Sigma/SIGMA_PROTOCOL.md](../../Sigma/SIGMA_PROTOCOL.md) | Paragraf ROADMAP artifact + "Reconcile invariant" ditulis ulang tanpa konsep H2/reconcile; baris CLI Command Surface (Section 16) diperbarui; entri changelog v0.5 ditambahkan. |
| [Sigma/SIGMA-OPERATION-REGISTRY.json](../../Sigma/SIGMA-OPERATION-REGISTRY.json) | **Di luar task breakdown tertulis.** Entri `roadmap_reconcile` dan `roadmap_migrate-core-flow` dihapus manual setelah `npm run refresh-registries:dry` mengonfirmasi keduanya tidak lagi terdeteksi di CLI (script ini hanya menambah stub baru, tidak menghapus otomatis — lihat "Keputusan Desain Kunci" di bawah). `total_operations` disesuaikan 59 → 57. |
| [test/roadmap-migration.test.ts](../../test/roadmap-migration.test.ts) | **Dihapus.** Seluruh isinya menguji fungsi migrasi yang sudah dihapus dan format 6-section lama. |
| [test/roadmap-stage-overview.test.ts](../../test/roadmap-stage-overview.test.ts) | **Baru.** 5 test: validator menerima format 3-section baru, validator menolak format 6-section lama, `render` mengisi baris dari `progress.json`, `render` memfilter plan version di luar major INTENT ROADMAP aktif, `render` tetap membersihkan blok legacy `plan-breakdown`. |

### Keputusan Desain Kunci

1. **Urutan section final**: Overview → Core Process Flow → Stage Overview — dipilih eksplisit oleh Director saat sesi implementasi (mengikuti urutan literal kalimat Objective plan), bukan mempertahankan urutan fisik template lama.
2. **`generateStageOverview()` tidak menerima parameter `roadmapVersion` dari caller** — `renderRoadmapFile()` menentukannya sendiri dari entry ACTIVE di `data.roadmap.versions`. Ini menghindari perubahan signature di seluruh caller (`plan.ts`, `roadmap.ts`) karena satu-satunya ROADMAP yang pernah di-render memang selalu yang ACTIVE.
3. **Join plan→roadmap pakai `intent_version_ref`, bukan aritmatika major PLAN** — versi ROADMAP = major INTENT secara desain (`roadmap.ts` command `new`), sedangkan major PLAN punya offset `INTENT major − 1` (`nextPlanVersion` di `progress.ts`) untuk alasan historis yang tidak berkaitan dengan topik ini. Memakai `intent_version_ref` menghindari asumsi keliru soal hubungan numerik plan↔roadmap.
4. **`SIGMA-OPERATION-REGISTRY.json` diedit manual, bukan lewat `sigma refresh`** — asumsi awal (di percakapan sebelum implementasi) keliru: tidak ada command `sigma refresh`. Mekanisme sesungguhnya adalah `npm run refresh-registries[:dry]` ([scripts/refresh-registries.js](../../scripts/refresh-registries.js)), yang **hanya menambah stub operasi baru** dan sekadar melaporkan (bukan menghapus) operation_id yang sudah tidak terdeteksi di CLI. Karena itu, entri `roadmap_reconcile`/`roadmap_migrate-core-flow` dihapus manual dari JSON setelah dikonfirmasi via dry-run; 2 entri stale lain yang ikut terdeteksi (`project_reset`, `memory_show`) sengaja tidak disentuh karena di luar scope plan ini.

### Verifikasi

- `npm run build` bersih.
- Live smoke test manual (bukan hanya unit test) di project scratch terisolasi (`HOME` diarahkan ke temp dir tanpa `~/.sigma/templates` lama): `roadmap new` → `plan new --title/--focus` → `plan update --title` → `plan new --pending` → `plan promote --title/--focus`, tabel Stage Overview diverifikasi ter-render otomatis dan benar di setiap langkah (termasuk memastikan `--pending` **tidak** menyentuh ROADMAP sampai di-promote).
- Full suite: **107 passed / 7 failed**. 7 kegagalan diverifikasi pre-existing lewat `git stash` (test dijalankan ulang di HEAD sebelum perubahan sesi ini, hasil gagal identik) — sudah didokumentasikan sejak `PLAN-EVAL-01`, sekarang diinvestigasi akar masalahnya secara terpisah di `PLAN-EVAL-10` (investigasi murni, tanpa implementasi).

### Keterbatasan yang Diketahui (untuk follow-up jika diperlukan)

- Project lama dengan ROADMAP format 6-section/teks H2 tidak punya jalur migrasi otomatis (risiko yang sudah dicatat & diterima di atas).
- 2 entri stale `project_reset`/`memory_show` di `SIGMA-OPERATION-REGISTRY.json` dibiarkan apa adanya — di luar scope plan ini, perlu plan terpisah jika Director ingin dibersihkan.
