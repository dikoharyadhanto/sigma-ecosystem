# PLAN-EVAL-03 — Migration Algorithm & JLH Cutover

**Sumber**: [DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md) (Konsolidasi Lanjutan bagian 13, "Implikasi ke migrasi JLH"; "Langkah Berikutnya")
**Tanggal**: 2026-07-17
**Status**: DRAFT — ringkas, belum didetailkan. Prioritas #3 — bukti nyata bahwa PLAN-EVAL-01 bekerja di project sungguhan.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

Algoritma migrasi satu-kali dari `Sigma/progress.json` lama (skema nested
single-file) ke skema multi-file baru (`Sigma/progress-v1.json` +
`Sigma/activate_status.json`) hasil PLAN-EVAL-01. **JLH
(`KLHK_JasaLingkunganHidup`) dikonfirmasi Director sebagai target migrasi
pertama** — dipakai sebagai uji coba nyata begitu implementasi siap.

## Scope

- Baca `progress.json` lama, tulis ulang jadi `progress-v1.json` (data
  intent/roadmap/close saat ini jadi objek tunggal; plan/exec tetap array
  dipindah apa adanya) + buat `activate_status.json` menunjuk ke chain itu.
- Guard pra-migrasi: tolak jalan kalau working tree git untuk `Sigma/`
  belum bersih (belum di-commit) — pengganti backup, sesuai keputusan
  PLAN-EVAL-02. Rollback = `git checkout`, bukan restore file `.bak`.
- Verifikasi hasil migrasi terhadap project JLH secara langsung sebagai
  acceptance test nyata (bukan cuma unit test sintetis).
- Tidak ada migrasi paksa/otomatis untuk project lain — opt-in/dipicu
  command, konsisten dengan preferensi Director soal migrasi bertahap
  (lihat pola serupa di PLAN-EVAL-01 folder `_07_17`, Isu Terbuka #4).

## Dependency

- **PLAN-EVAL-01** (wajib) — skema tujuan migrasi belum ada tanpa ini.
- **PLAN-EVAL-02** (wajib untuk pola rollback) — guard git-clean-tree
  menggantikan backup file yang tadinya jadi bagian algoritma migrasi.

## Di luar scope

- Redefinisi Gate 1.5/lifecycle Roadmap-Close (PLAN-EVAL-04) — migrasi ini
  cuma memindahkan bentuk data, tidak mengubah aturan gate.
- Keputusan eksplisit menjalankan `sigma intent supersede --v v1` di JLH
  (state historis Intent v1 JLH sudah `SUPERSEDED` dari fix PLAN-EVAL-01
  folder `_07_17`) — di luar cakupan command migrasi storage ini, tetap
  wewenang Director terpisah.

## Risiko

- Project JLH adalah data produksi nyata — kesalahan migrasi berdampak
  langsung. Mitigasi: guard git-clean-tree + verifikasi manual `git diff`
  sebelum dan sesudah, dijalankan Director/AI dengan hati-hati, bukan
  otomatis tanpa review.
