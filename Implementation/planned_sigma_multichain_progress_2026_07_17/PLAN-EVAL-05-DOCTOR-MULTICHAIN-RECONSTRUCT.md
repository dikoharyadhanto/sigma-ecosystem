# PLAN-EVAL-05 — Doctor Multi-Chain (`--all-versions`) & Reconstruct

**Sumber**: [DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md) (Konsolidasi Lanjutan bagian 4 & 9)
**Tanggal**: 2026-07-17
**Status**: DRAFT — ringkas, belum didetailkan. Prioritas #5 — tooling pemulihan, tidak memblokir alur kerja harian seperti PLAN-EVAL-04.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

`sigma doctor` **satu-satunya** command yang butuh flag lintas-chain, karena
tugasnya (`runDoctorReconciliation`) adalah **memperbaiki**, bukan cuma
**menampilkan** (beda dari `sigma intent list` yang murni display). Semua
command mutasi lain sengaja tidak diberi flag lintas-chain — akan melanggar
isolasi total antar-chain kalau dipaksakan.

## Scope

- `sigma doctor` (default) — tetap memperbaiki `progress-v<active>.json`
  saja, sama prinsipnya dengan hari ini, cuma target file berubah.
- `sigma doctor --all-versions` — ulangi reconciliation yang sama untuk
  setiap `progress-v*.json` yang ada, tanpa mengubah `active_chain`. Bisa
  dikombinasikan dengan `--reconstruct`.
- `sigma doctor --reconstruct` — 3 mode:
  - tanpa flag: rekonstruksi chain **aktif** saja.
  - `--v <versi>`: rekonstruksi **satu** chain spesifik (scan artifact yang
    match pola major version itu).
  - `--all-versions`: rekonstruksi **semua** chain yang ditemukan di disk.
- Reuse `runDoctorReconciliation(data, overrides)` yang sudah ada — fungsi
  ini cuma menerima satu objek `ProgressJson`, tidak tahu soal "chain", jadi
  `--all-versions` cukup loop pemanggilan, tidak perlu menulis ulang logika
  reconciliation.
- **Keputusan yang perlu diambil di plan-eval ini** (satu-satunya open item
  tersisa dari DISCUSSION doc): perilaku `doctor` terhadap file chain yatim
  (file `progress-v*.json` ada tapi tidak ditunjuk `activate_status.json`
  mana pun, atau sebaliknya) — auto-adopt vs cuma dilaporkan.
- `--reconstruct`/`--all-versions` boleh membangun ulang **file chain** dari
  artifact di disk, tapi **tidak boleh menebak** `active_chain` — itu murni
  wewenang `sigma intent activate --v <x>` (independen, sudah diputuskan di
  PLAN-EVAL-01).

## Dependency

- **PLAN-EVAL-01** (wajib) — butuh file layout `progress-v*.json` +
  `activate_status.json` sudah ada.

## Di luar scope

- Perubahan invarian ACTIVE/auto-default itu sendiri — sudah final di
  PLAN-EVAL-01, plan-eval ini cuma memakainya.

## Risiko

- `reconstructProgress()` yang sudah ada bekerja lewat scan regex per
  domain terhadap artifact disk — perlu verifikasi pola regex tetap akurat
  saat dijalankan berulang lintas banyak chain sekaligus (bukan cuma
  sekali untuk satu file seperti hari ini).
