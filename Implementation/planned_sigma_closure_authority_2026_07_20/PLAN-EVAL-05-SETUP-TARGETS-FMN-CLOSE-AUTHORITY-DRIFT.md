# PLAN-EVAL-05 — Setup Targets: FMN Close-Authority Drift Fix

**Sumber**: Ditemukan saat verifikasi eksekusi PLAN-EVAL-02 (2026-07-20), di
luar scope diskusi sumber manapun — bukan berasal dari
`Discussion/closure-authority-and-arc-scoring-proposal-20260720.md`.
**Tanggal**: 2026-07-20
**Status**: DRAFT — belum dieksekusi, menunggu otorisasi eksplisit Director.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan
FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

`PLAN-EVAL-01-ARC-CLOSE-CLI-AUTHORITY-MIGRATION.md` (EXECUTED 2026-07-20)
mencabut wewenang CLI `sigma close check`/`close lock` dari FMN dan
memindahkannya ke ARC. Perubahan itu benar dan lengkap di file kanonik
(`Sigma/rules/FMN-RULE.md`, `Sigma/rules/ARC-RULE.md`,
`Sigma/SIGMA_PROTOCOL.md`) — sudah diverifikasi lewat `git show cdea1a0`.

Yang **terlewat**: salinan ringkas rule file per-platform di `setup/targets/`
(dipakai Claude Code, Codex, Antigravity, Reasonix untuk memuat instruksi
role tanpa membaca `Sigma/rules/*.md` penuh) tidak ikut diupdate untuk sisi
FMN-nya. Sisi ARC-nya **sudah** diupdate (7 file, lihat commit `cdea1a0`).

Akibatnya: FMN yang berjalan lewat salah satu dari 4 platform di bawah masih
menerima instruksi eksplisit bahwa `sigma close lock`/`close check` adalah
bagian dari alur kerjanya — bertentangan langsung dengan
`Sigma/rules/FMN-RULE.md` kanonik dan dengan wewenang ARC yang sudah berlaku.
Ini murni rule-text, tidak menyentuh kode `src/`.

---

## 1. Verifikasi cakupan (sudah dilakukan, bukan asumsi)

Diverifikasi lewat `grep -n "close check|close lock|close new"` ke seluruh
`setup/targets/`, lalu setiap match dibaca dengan konteksnya untuk
membedakan **klaim wewenang FMN yang salah** dari **teks generik yang tetap
benar tanpa perubahan**:

- **Bug nyata (4 file, satu kalimat identik di tiap file)** — bagian "Pre-lock
  verification" dalam salinan ringkas `fmn.md`/`SKILL.md`, menyebut
  `close lock`/`close check` sejajar dengan `plan lock`/`exec lock` seolah
  keduanya sama-sama wewenang FMN:
  - `setup/targets/claude_code/fmn.md:89`
  - `setup/targets/codex/fmn/SKILL.md:83`
  - `setup/targets/antigravity/sigma-fmn/SKILL.md:83`
  - `setup/targets/reasonix/fmn.md:83`
- **Bukan bug — diverifikasi generik, tidak perlu diubah**:
  - `setup/targets/bridge/{AGENTS,CLAUDE,GEMINI,DEEPSEEK}.md` — kalimat
    "Pre-Lock Verification" di sana adalah aturan role-agnostic (berlaku ke
    role manapun yang sedang aktif menjalankan lock), bukan klaim wewenang
    FMN. Tidak salah, tidak perlu disentuh.
  - `setup/targets/bridge/REASONIX.md:25-42` — daftar whitelist command
    role-agnostic yang sama (satu file mencakup semua role via
    `DEEPSEEK.md`), bukan tabel spesifik-FMN. Tidak salah.
  - `setup/targets/cursor/SIGMA.mdc:42` — tabel Gate generik (Gate 3 →
    `sigma close new`), tidak diasosiasikan ke role manapun. Tidak salah.
  - `setup/targets/*/report.md` / `report/SKILL.md` — `close lock` muncul di
    daftar "Forbidden Operations" milik skill `/report` sendiri (berlaku ke
    semua role, memang seharusnya melarang lock apapun selama `/report`
    berjalan). Tidak salah.

Kesimpulan: perbaikan yang genuinely dibutuhkan **hanya** 4 file di atas,
masing-masing satu kalimat.

---

## 2. Perbaikan yang diusulkan

### 2.1 Fix wajib — 4 file `fmn.md`/`SKILL.md`

Kalimat saat ini (identik di keempat file, hanya nomor baris berbeda):

> Before presenting the approval prompt below for `sigma plan lock`,
> `sigma exec lock`, or `sigma close lock`, run the matching check command
> first (`sigma plan check`, `sigma exec check`, or `sigma close check`).
> Only present the approval prompt once check reports `Lock readiness:
> Eligible` (or `Eligible with warnings`) for the artifact being locked. If
> check reports `Not eligible`, resolve the unsatisfied Lock Requirements
> shown in its output before asking the Director to approve lock.

Diganti jadi (mengikuti pola pengurangan yang sama persis seperti diff
`Sigma/rules/FMN-RULE.md` di commit `cdea1a0`):

> Before presenting the approval prompt below for `sigma plan lock` or
> `sigma exec lock`, run the matching check command first (`sigma plan
> check` or `sigma exec check`). Only present the approval prompt once check
> reports `Lock readiness: Eligible` (or `Eligible with warnings`) for the
> artifact being locked. If check reports `Not eligible`, resolve the
> unsatisfied Lock Requirements shown in its output before asking the
> Director to approve lock. Closure (`sigma close check`/`close lock`) is
> ARC's CLI responsibility, not FMN's — do not run or prompt for these.

Terapkan identik ke:
- `setup/targets/claude_code/fmn.md:89`
- `setup/targets/codex/fmn/SKILL.md:83`
- `setup/targets/antigravity/sigma-fmn/SKILL.md:83`
- `setup/targets/reasonix/fmn.md:83`

### 2.2 Fix opsional — kesenjangan simetris di 4 file `arc.md`/`SKILL.md`

Ditemukan sebagai efek samping verifikasi, **bukan** bagian dari temuan Q2
awal, dicatat untuk kelengkapan: salinan ringkas `arc.md`/`SKILL.md`
(`claude_code/arc.md:92-94`, dan padanannya di codex/antigravity/reasonix)
juga **belum** diberi kalimat pre-lock-verification untuk `close lock`/
`close check` — beda arah dari bug 2.1 (bukan klaim salah, murni informasi
yang belum ditambahkan). Saat ini hanya menyebut `sigma intent lock`/
`sigma intent check`. `Sigma/rules/ARC-RULE.md` kanonik sudah benar
(mencakup `close lock`/`close check` di §CLI Operation Policy), jadi ini
bukan gap yang membahayakan — ARC yang membaca rule file penuh tetap dapat
info yang benar. Hanya relevan kalau salinan ringkas `arc.md` dimaksudkan
sebagai pengganti penuh, bukan ringkasan. **Diserahkan ke Director**: apakah
ditambahkan sekarang bersamaan dengan 2.1, atau dibiarkan (rule kanonik
tetap jadi sumber kebenaran).

---

## Yang **tidak berubah**

- Tidak ada perubahan ke `src/`, `Sigma/rules/*.md`, atau
  `Sigma/SIGMA_PROTOCOL.md` — semuanya sudah benar sejak PLAN-EVAL-01.
- Tidak ada perubahan ke file `bridge/`, `cursor/SIGMA.mdc`, atau
  `report.md`/`report/SKILL.md` — sudah diverifikasi generik/benar.

## Langkah selanjutnya

Bukan untuk dieksekusi langsung. Menunggu otorisasi eksplisit Director untuk
mulai edit — termasuk keputusan soal 2.2 (opsional) sebelum atau terpisah
dari 2.1 (wajib).
