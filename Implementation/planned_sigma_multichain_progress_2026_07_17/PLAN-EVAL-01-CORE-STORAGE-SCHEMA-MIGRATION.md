# PLAN-EVAL-01 — Core Storage & Schema Migration (Opsi C Foundation)

**Sumber**: [DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md)
**Tanggal**: 2026-07-17
**Status**: DRAFT — ringkas, belum didetailkan. Prioritas #1 (fondasi, blocking semua plan-eval lain di folder ini).
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

Ganti storage `Sigma/progress.json` tunggal (nested per-domain) dengan model
per-chain, analog `refs/heads/<branch>` + `HEAD` di Git:

```text
Sigma/activate_status.json  ← BARU, cuma { active_chain }
Sigma/progress-v1.json      ← ChainState v1
Sigma/progress-v2.json      ← ChainState v2, dst.
```

Nama `progress.json` pensiun total — tidak dipakai lagi untuk manifest
maupun file chain.

## Scope

- `intent`/`roadmap`/`close` jadi objek tunggal per chain (bukan array
  `versions`). `plan`/`exec` **tetap** array multi-versi — tidak berubah.
- Layer resolusi baru: setiap command baca `activate_status.json` dulu untuk
  tahu `progress-v<N>.json` mana yang aktif, sebelum baca/tulis state.
- Invarian "tepat satu chain ACTIVE": kalau `active_chain` tidak valid
  (kosong/menunjuk chain tak ada), auto-default ke Intent tertinggi yang
  belum `SUPERSEDED` — bukan hard-stop.
- Fold `sigma progress *` (tidak pernah dibuat) → seluruhnya jadi
  `sigma intent new` (auto-create + auto-activate chain baru),
  `sigma intent activate --v <versi>`, `sigma intent list` (diperluas jadi
  projection lintas-chain, bukan cache).
- Rewrite ~104 call site array→objek di 9 file command
  (`session.ts`, `close.ts`, `project.ts`, `intent.ts`, `override.ts`,
  `plan.ts`, `doctor.ts`, `exec.ts`, `roadmap.ts`) + 53 panggilan
  `readProgress`/`writeProgress`.
- `SUPERSEDED` chain terminal permanen (kebal `intent activate`), tapi
  tetap tinggal di `Sigma/` selamanya (tidak dipindah ke arsip terpisah).
- Urutan tulis `intent new`: tulis file chain baru dulu, baru update
  `activate_status.json` terakhir (aman kalau proses mati di tengah).
- `sigma intent activate` tidak butuh `--director-confirm` (mengandalkan
  default-ke-terbaru + visibility wajib di `session bootstrap`, bukan
  friksi otorisasi).

## Di luar scope (didorong ke plan-eval lain)

- Migrasi data lama & JLH cutover → PLAN-EVAL-03.
- Auto-backup removal → PLAN-EVAL-02 (independen, tidak wajib selesai dulu).
- `doctor --all-versions`/`--reconstruct` 3 mode → PLAN-EVAL-05.
- Redefinisi Gate 1.5 & lifecycle Roadmap/Close → PLAN-EVAL-04.
- `intent-history.md` auto-render → PLAN-EVAL-06.

## Risiko yang sudah diketahui

- Skala rewrite besar (160 test kemungkinan kena), tapi **tidak lebih besar**
  dari Opsi B yang sudah dianalisis di DISCUSSION doc — bukan proyek yang
  bertambah besar karena pilih Opsi C.
- Tidak bisa dites bermakna dalam keadaan "separuh migrasi" — harus dikunci
  sebagai satu unit koheren.
