# PLAN-EVAL-06 — `--title`/`--focus` Wajib + `intent-history.md` Auto-Render

**Sumber**: [DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md) (Konsolidasi Lanjutan bagian 5)
**Tanggal**: 2026-07-17
**Status**: DRAFT — ringkas, belum didetailkan. Prioritas #6 — paling kecil & paling terisolasi di antara 6 plan-eval ini.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

Samakan `sigma intent new` dengan pola `sigma plan new`/`plan promote` yang
sudah mewajibkan `--title`/`--focus`, supaya `sigma intent list` bisa
menampilkan ringkasan tiap chain tanpa perlu membuka `DIR-INTENT-vX.md`
penuh — plus dokumen ringkasan lintas-chain baru yang 100% auto-render.

## Scope

- `--title`/`--focus` jadi **wajib** (`requiredOption`) di `sigma intent
  new`, sama seperti `plan new` ([plan.ts:81-82](../../src/commands/plan.ts#L81-L82)).
  **Catatan**: `sigma intent new` **belum** mewajibkan `--title`/`--focus`
  hari ini (dicek terhadap `src/commands/intent.ts` hasil PLAN-EVAL-01 —
  command `new` cuma punya `--yes`) — jadi ini genuinely pekerjaan baru
  plan-eval ini, bukan sesuatu yang keburu terpasang oleh PLAN-EVAL-01.
- File baru **`Sigma/design/intent-history.md`** — 100% auto-render, nol
  bagian manual (lebih sederhana dari `renderRoadmapFile()`, tidak perlu
  delimiter `SIGMA:RENDER:START/END`, cukup timpa seluruh file tiap kali).
  Tidak butuh file template artifact.
- Bentuk kolom: `| Version | Title | Focus | Status | Reason |` — sama pola
  dengan Stage Overview ROADMAP. **Catatan mapping data**: `Reason` untuk
  baris SUPERSEDED sekarang datang dari `chain.intent.supersede_reason`
  (field ini masih ada di skema final `ChainState`, PLAN-EVAL-01 §3.4 —
  yang dijatuhkan cuma `superseded_by`, bukan `supersede_reason`).
- **4 titik pemicu render ulang penuh** (wajib eksplisit):
  - `sigma intent new` — baris baru (DRAFT)
  - `sigma intent lock` — status → LOCKED
  - `sigma intent supersede` — status → SUPERSEDED + reason
  - `sigma intent activate --v` — pointer chain aktif berubah
- Jaring pengaman: `sigma doctor` (termasuk `--all-versions`, PLAN-EVAL-05)
  juga meregenerasi `intent-history.md` dari nol setiap dijalankan — supaya
  kalau satu titik pemicu lupa terpasang, `doctor` tetap bisa memulihkan.
- **Hindari istilah "roadmap"** untuk file/tampilan ini — sudah disepakati
  di ronde audit AUD (`FMN-ROADMAP` sudah punya makna established).

## Update penting (2026-07-17) — dependency ke-4 sempat hilang, sekarang sudah ada

Titik pemicu keempat, **`sigma intent activate --v`**, sempat jadi risiko
nyata untuk plan-eval ini: command itu bagian dari command surface yang
sudah diputuskan DISCUSSION doc sejak awal, tapi **ternyata tidak
diimplementasikan** selama PLAN-EVAL-01 Fase 2 (murni kelalaian saat
implementasi, ditemukan lewat audit cross-reference dokumen plan-eval,
bukan lewat testing). **Sudah diperbaiki** (2026-07-17, sebelum dokumen ini
diperbarui) — `sigma intent activate --v <chain>` sekarang ada di
`src/commands/intent.ts`, tanpa `--director-confirm` (sesuai DISCUSSION
§"Konsolidasi Lanjutan" bagian 6), menolak chain `SUPERSEDED`. Plan-eval ini
**aman mengasumsikan command ini ada** — tapi kalau saat plan-eval ini
benar-benar dikerjakan ternyata command itu hilang lagi/berubah signature,
itu regresi yang perlu dilaporkan, bukan diasumsikan sudah pasti stabil.

## Dependency

- **PLAN-EVAL-01** (wajib, sudah selesai) — `intent new`/`lock`/`supersede`/
  `activate` sudah beroperasi di model chain baru, termasuk `activate` yang
  sempat tertinggal (lihat "Update penting" di atas).
- Disarankan setelah **PLAN-EVAL-05** (doctor) selesai, supaya titik
  self-heal di `doctor` bisa langsung diintegrasikan sekaligus — tapi tidak
  strictly blocking, bisa juga dikerjakan sebelum #5 dengan self-heal
  ditambahkan belakangan sebagai follow-up kecil.

## Di luar scope

- Command ketiga terpisah untuk data yang sama — eksplisit ditolak di
  ronde audit AUD ("Intent Evolution sebagai layer baru").

## Risiko

- Kecil. Risiko utama: salah satu dari 4 titik pemicu lupa dikaitkan saat
  implementasi — dimitigasi oleh jaring pengaman `doctor`, tapi tetap perlu
  test eksplisit untuk tiap titik pemicu supaya tidak baru ketahuan lewat
  `doctor` di kemudian hari.
