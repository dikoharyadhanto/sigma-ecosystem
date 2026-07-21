# Indeks Plan Implementasi — Test Suite Debt (Gate 3.5 + Reconstruct)

**Disusun**: 2026-07-21, Professional Mode (AI teknisi/pengembang Sigma).
**Sumber**: Ditemukan saat verifikasi keamanan (`tsc --noEmit` + `vitest run`) menjelang
penutupan `Implementation/planned_sigma_closure_authority_2026_07_20/` — bukan bagian dari
diskusi sumber folder itu, murni test-suite debt yang tertinggal dari `PLAN-EVAL-02` di
sana (Gate 3.5 ARC Satisfaction Score + tabel `intent-history.md` 7-kolom).
**Status**: Dokumen di folder ini adalah plan implementasi biasa yang disusun dalam
Professional Mode. Bukan FMN-PLAN Sigma dan tidak memiliki otoritas lock/gate Sigma.
**Belum ada satu baris kode pun yang diubah** — folder ini murni draf untuk direview
Director.

**Status per 2026-07-21**: **EXECUTED**. Director mengikuti kedua rekomendasi plan (Opsi A
§1, Opsi B §2) dan memberi otorisasi eksplisit. Diverifikasi `tsc --noEmit` bersih, `npm
run build` sukses, `npx vitest run` → 215/215 lulus.

Tidak berhubungan dengan folder `planned_sigma_closure_authority_2026_07_20` atau folder
`planned_sigma_*` lain — topik test-debt murni, ditemukan insidental saat verifikasi,
bukan direncanakan sejak awal sesi manapun.

---

## Isi

| # | Dokumen | Ringkasan | Dependency |
|---|---|---|---|
| 1 | [PLAN-EVAL-01-GATE35-AND-RECONSTRUCT-TEST-DEBT.md](PLAN-EVAL-01-GATE35-AND-RECONSTRUCT-TEST-DEBT.md) — **EXECUTED (2026-07-21)** | Perbaiki 3 test gagal (dari 214) yang sudah pre-existing sebelum sesi ini: 2 di `lifecycle-hardening.test.ts` (fixture belum mengisi `arc_score`, Gate 3.5 memblokir `close new`), 1 di `intent-history.test.ts` (fixture tabel 5-kolom lama, parser sekarang butuh 7-kolom). `src/engine/reconstruct.ts` diperluas menerima kedua bentuk tabel (backward-compatible), bukan cuma migrasi test ke format baru. | Tidak ada — independen secara teknis dari folder lain, murni memperbaiki debt dari `PLAN-EVAL-02` di folder `closure_authority`. |

---

## Open items — RESOLVED (2026-07-21)

- ~~**§1**: ubah `makeChainWithLockedExec()` (dipakai 6 file test) secara default, atau
  tambahkan `arc_score` secara scoped hanya ke 2 test yang gagal~~ — Director memilih
  Opsi A (scoped): parameter opsional `arcScore` ditambahkan ke fixture, default
  `undefined`, 5 call site lain tidak berubah.
- ~~**§2**: perbaiki test secara mekanis ke tabel 7-kolom saja, atau perluas parser
  `reconstruct.ts` menerima kedua bentuk tabel~~ — Director memilih Opsi B: ambang
  `readIntentHistoryMetadata()` dikembalikan ke `cells.length < 6`, `doctor --reconstruct`
  tetap bekerja untuk proyek dengan `intent-history.md` 5-kolom peninggalan.
