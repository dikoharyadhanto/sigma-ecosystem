# PLAN-EVAL-03 — Restrukturisasi Sistem ROADMAP (Template 6→3 Section + Konsolidasi Subcommand)

**Sumber**: `Discussion/sigma-system-evaluation-2026-07-14.md` (Topik 1, Topik 4 — keluarga `sigma roadmap`)
**Tanggal**: 2026-07-14
**Status**: DRAFT FOR REVIEW
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
- [ ] Ubah `generateStageOverview()` ([roadmap.ts:41](../../src/utils/roadmap.ts#L41)) agar sumber datanya bukan lagi `parseStages()` yang membaca teks H2 dari file, melainkan baca langsung dari `progress.json` per-plan version (title/focus/status).
- [ ] Pastikan flag `--title`/`--focus` di `sigma plan new` menulis data ini ke `progress.json` (cek `src/commands/plan.ts`), karena ini jadi satu-satunya sumber data judul+focus setelah Stage Details dihapus.
- [ ] Hapus `STAGE_STUB_TEMPLATE()` ([roadmap.ts:236](../../src/utils/roadmap.ts#L236)) dan mekanisme append blok teks stage: `appendRoadmapSectionStub`, `updateStageMetadata` — tidak lagi menulis blok H2/H3 penuh.

**Tahap A.2 — Template**
- [ ] Revisi `Sigma/templates/ROADMAP-TEMPLATE.md`: hapus section 1, 2, 5, 6 lama; ganti section 1 jadi "Overview" (manual, ≤5 kalimat); sederhanakan Core Process Flow jadi Mermaid-only; pertahankan Stage Overview sebagai tabel auto-managed.
- [ ] Revisi `Sigma/rules/FMN-RULE.md` bagian "Mandatory: ROADMAP as Staging Requirement" dan "H2 Stage Section Rules" — sesuaikan dengan struktur baru (tidak ada lagi kewajiban menulis blok H2 per-stage).

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

- [ ] Hapus `cmd.command('reconcile')` di `src/commands/roadmap.ts` ([roadmap.ts:224-321](../../src/commands/roadmap.ts#L224-L321)).
- [ ] Hapus `cmd.command('migrate-core-flow')` ([roadmap.ts:126-144](../../src/commands/roadmap.ts#L126-L144)) dan fungsi pendukungnya di `src/utils/roadmap.ts`: `migrateRoadmapCoreProcessFlowFile`, `migrateRoadmapCoreProcessFlowContent`, `extractLegacyPhaseDependenciesBody`, `normalizeLegacyPhaseDependenciesBody`, `buildCoreProcessFlowSection`, `ensureMarkerBeforeHeading`, `normalizedLegacyMessage`.
- [ ] Update `list` ([roadmap.ts:325-390](../../src/commands/roadmap.ts#L325-L390)) agar sumber datanya sama dengan `render` (langsung dari `progress.json`, bukan `parseStages()` dari file) — konsisten dengan Bagian A.1.
- [ ] Update README.md/SIGMA_PROTOCOL.md yang menyebut `sigma roadmap reconcile` dan `sigma roadmap migrate-core-flow`.

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

- [ ] `Sigma/templates/ROADMAP-TEMPLATE.md` hanya berisi 3 section: Overview, Core Process Flow (Mermaid-only), Stage Overview.
- [ ] `sigma roadmap render` menghasilkan tabel Stage Overview dari `progress.json`, bukan parsing teks H2 file.
- [ ] `sigma roadmap list` konsisten dengan hasil `render` (sumber data sama).
- [ ] `sigma roadmap reconcile` dan `sigma roadmap migrate-core-flow` tidak lagi terdaftar di CLI.
- [ ] `FMN-RULE.md` tidak lagi mewajibkan penulisan blok H2 Stage Details.
- [ ] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini.
