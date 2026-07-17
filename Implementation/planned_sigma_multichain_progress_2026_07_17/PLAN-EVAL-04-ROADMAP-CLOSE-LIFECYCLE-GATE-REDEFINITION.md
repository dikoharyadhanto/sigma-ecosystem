# PLAN-EVAL-04 — Roadmap/Close Lifecycle & Gate 1.5 Redefinition

**Sumber**: [DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md) (Konsolidasi Lanjutan bagian 8; Isu Terbuka Baru lanjutan #8)
**Tanggal**: 2026-07-17
**Status**: DRAFT — ringkas, belum didetailkan. Prioritas #4 — tanpa ini, Gate 1.5 rusak secara harfiah begitu PLAN-EVAL-01 live.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

Di dunia 1:1 per-chain, model `ACTIVE`/`INACTIVE` Roadmap (arbitrase
kompetisi antar-roadmap) tidak relevan lagi — tidak ada lagi yang perlu
diarbitrase karena satu chain hanya punya satu Roadmap.

## Scope

- Roadmap & Close tetap 3 state (`DRAFT`/`LOCKED`/`SUPERSEDED`) — bukan
  disederhanakan jadi 2.
- **Hapus command `sigma roadmap lock`** (tidak pernah ada) dan model
  `ACTIVE`/`INACTIVE` — Roadmap selalu `DRAFT` sepanjang chain berjalan
  (dashboard hidup, terus di-render ulang), baru **otomatis** jadi
  `LOCKED` sebagai efek samping saat `sigma close lock` berhasil.
- Close tetap punya command `lock` eksplisit — tidak berubah.
- `SUPERSEDED` untuk Roadmap maupun Close selalu otomatis (cascade dari
  `intent supersede --director-confirm`), tidak pernah manual. Chain yang
  ditinggalkan sebelum close: Roadmap lompat `DRAFT → SUPERSEDED` langsung.
- **Redefinisi Gate 1.5**: dari "ROADMAP harus `ACTIVE`"
  ([plan.ts:106-110](../../src/commands/plan.ts#L106-L110)) jadi "Roadmap
  untuk chain ini sudah dibuat (ada) dan belum `SUPERSEDED`" — begitu
  `sigma roadmap new` sukses sekali, Gate 1.5 terbuka permanen sampai chain
  berakhir.
- Tinjau ulang gate/hubungan lain yang mungkin diam-diam mengasumsikan
  hubungan lintas Intent major version (Isu Terbuka #8 — sengaja
  dideferred sampai plan-eval ini benar-benar dikerjakan, ditinjau
  per-scope, bukan audit menyeluruh di muka).

## Dependency

- **PLAN-EVAL-01** (wajib) — butuh model objek tunggal per chain sudah ada.

## Di luar scope

- Perubahan storage/file layout — sudah selesai di PLAN-EVAL-01.
- Migrasi data project existing (JLH) — PLAN-EVAL-03.

## Risiko

- Perubahan Gate 1.5 mengubah perilaku `plan new`/`plan lock` yang sudah
  berjalan hari ini — perlu regression test eksplisit untuk memastikan
  chain lama (pasca-migrasi) tidak tiba-tiba ter-block atau ter-unblock
  secara tidak sengaja.
- Isu Terbuka #8 (tinjauan menyeluruh) berisiko "ditemukan lagi" gate lain
  yang bermasalah saat implementasi — perlu dianggarkan waktu ekstra untuk
  investigasi, bukan cuma coding.
