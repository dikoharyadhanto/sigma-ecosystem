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
  new`, sama seperti `plan new` ([plan.ts:72-73](../../src/commands/plan.ts#L72-L73)).
- File baru **`Sigma/design/intent-history.md`** — 100% auto-render, nol
  bagian manual (lebih sederhana dari `renderRoadmapFile()`, tidak perlu
  delimiter `SIGMA:RENDER:START/END`, cukup timpa seluruh file tiap kali).
  Tidak butuh file template artifact.
- Bentuk kolom: `| Version | Title | Focus | Status | Reason |` — sama pola
  dengan Stage Overview ROADMAP.
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

## Dependency

- **PLAN-EVAL-01** (wajib) — `intent new`/`lock`/`supersede`/`activate`
  harus sudah beroperasi di model chain baru.
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
