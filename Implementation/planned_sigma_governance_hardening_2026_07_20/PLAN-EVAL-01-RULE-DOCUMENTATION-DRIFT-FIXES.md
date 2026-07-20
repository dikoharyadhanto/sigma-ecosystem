# PLAN-EVAL-01 — Rule/Documentation Drift Fixes

**Sumber**: [../../Discussion/sigma-bug-report-20260720-131540.md](../../Discussion/sigma-bug-report-20260720-131540.md), hasil penyaringan Group A/B/C bersama Director, dan verifikasi tambahan langsung ke kode.
**Tanggal**: 2026-07-20
**Status**: **EXECUTED** (2026-07-20, atas otorisasi eksplisit Director — "saya mengikuti rekomendasi anda, silahkan jalankan eksekusi plan eval 01"). Semua item A.1–A.8 dieksekusi termasuk perluasan scope A.3 ke DEV/FMN/ARC (disetujui Director). `npm run build && npm test` hijau penuh (214/214 test, 26/26 file).
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

### Temuan tambahan selama eksekusi (di luar 8 item asli)

- **A.2 diperluas**: dua drift baru ditemukan saat eksekusi (tidak ada di
  tabel awal) — `DEV-RULE.md` baris "summary of the implementation approach
  (Section 2)" seharusnya merujuk Implementation Approach (bukan Section 2 =
  DEV Pre-Build Assessment), dan sub-nomor "### 7.1 AUD Advisory Verdict" di
  `FMN-PLAN-TEMPLATE.md` yang tidak ikut bergeser saat A.5 menyisipkan
  section baru — keduanya sudah diperbaiki.
- **Bug laten tidak terkait plan ini, ditemukan & diperbaiki saat verifikasi
  test**: `dist/utils/docCheck.js` yang ter-*commit* di HEAD (`13ad887`)
  ternyata **stale** — `src/utils/docCheck.ts` sudah punya
  `DIRECTORS_SUMMARY` di `requiredSections` untuk domain `exec`, tapi
  `dist/` yang ter-*commit* tidak pernah di-*rebuild* ulang sehingga
  requirement itu tidak pernah benar-benar aktif. `npm run build` di
  eksekusi ini "menyingkap" bug laten tersebut, yang lalu terbukti fixture
  `validExecDoc()` di `test/helpers.ts` juga belum pernah menyertakan
  marker `DIRECTORS_SUMMARY` — diperbaiki bersamaan (di luar scope 8 item
  asli, tapi diperlukan agar `npm test` hijau).
- Rujukan nomor section `DIR-INTENT`/`AUD-RULE.md` di `ARC-RULE.md` (baris
  242, 259, 308, 327-328) belum diverifikasi terhadap `DIR-INTENT-TEMPLATE.md`
  nyata — masih di luar scope, audit sejenis A.2 masih perlu dilakukan
  terpisah untuk ARC/DIR-INTENT.

### A.9 — Additional request: ARC-RULE.md CLI policy self-contradiction (2026-07-20, atas permintaan Director)

**Temuan**: §Role Activation ("ARC MUST NOT run `sigma session bootstrap`...
by default") tampak berkontradiksi dengan §CLI Operation Policy (tabel
mencantumkan `sigma session bootstrap` sebagai command yang "ARC may
execute without Director approval").

**Diagnosis setelah dibaca ulang penuh**: bukan kontradiksi keras — baris
setelah tabel (§CLI Operation Policy) sudah menyatakan "Read-only commands
are capability, not default activation steps," yang secara substansi
sejalan dengan §Role Activation. Masalahnya murni **kejelasan/urutan
baca**: pembaca yang berhenti di judul tabel ("may execute without Director
approval") sebelum sampai ke catatan syarat di bawahnya bisa salah
menyimpulkan itu izin tanpa syarat.

**Perbaikan** (dieksekusi 2026-07-20): dua sisipan silang-rujuk —
1. §Role Activation sekarang eksplisit menunjuk balik ke §CLI Operation
   Policy ("these are capability, not default activation steps").
2. Catatan syarat di bawah tabel §CLI Operation Policy sekarang menyebut
   `sigma session bootstrap` secara eksplisit by name dan menegaskan
   pembatasannya cocok dengan §Role Activation di atas.

Tidak mengubah perilaku (masih "tidak boleh dijalankan default saat
aktivasi") — murni menghilangkan ruang salah baca antara dua section yang
sebelumnya berdiri sendiri-sendiri tanpa saling rujuk.

---

## Inti

Delapan perbaikan teks/dokumentasi yang lolos filter "nyata dan berdampak,
bukan cuma murah" (lihat README §Group C untuk yang gugur filter ini). Semua
sudah diverifikasi langsung ke `Sigma/rules/*.md`, `Sigma/templates/*.md`,
`Sigma/SIGMA_PROTOCOL.md`, `setup/targets/bridge/CLAUDE.md`,
`setup/targets/claude_code/aud.md`, dan `src/utils/docCheck.ts` — bukan
asumsi dari isi laporan.

Hanya A.5 yang menyentuh kode (`docCheck.ts`, satu penambahan section ID).
Sisanya murni edit teks di file `.md`.

---

## Scope

### A.1 — Frasa CLI usang di bridge stub CLAUDE.md

**Lokasi**: `setup/targets/bridge/CLAUDE.md:118-120`

**Temuan tambahan penting**: file ini adalah sumber kanonik yang di-*ship*
ke setiap project baru (lihat `BRIDGE_STUBS` di `src/config.ts:19` dan
pemakaiannya di `src/commands/setup.ts:117`). Membandingkan tiga salinan:

| Salinan | Status frasa "after CLI support lands" |
|---|---|
| `setup/targets/bridge/CLAUDE.md` (sumber kanonik/shipped) | **Masih ada** — belum diperbaiki |
| `i:\Works\Project\sigma-ecosystem\CLAUDE.md` (project ini) | Sudah tidak ada — sudah diperbaiki manual di titik entah kapan, tanpa tercatat di plan mana pun |
| `C:\Users\dikoh\.claude\CLAUDE.md` (global, di luar repo) | **Masih ada** — di luar scope git repo ini |

Ini contoh nyata dari masalah yang sedang diperbaiki: bahkan fix untuk
"tidak ada sumber kanonik tunggal" ini sendiri sudah drift 3 arah sebelum
sempat diperbaiki secara sadar.

**Perubahan**:

```diff
- (`Sigma/role-memory/{role}-memory.json`; after CLI support lands,
- `sigma memory --<role>`), then follow the matching role rule file.
+ (`Sigma/role-memory/{role}-memory.json`, or run
+ `sigma memory --<role>`), then follow the matching role rule file. If the
+ role-memory file lookup fails, verify with the exact case shown above
+ before concluding memory is unavailable — do not assume unavailability
+ from a single failed guess.
```

**Status**: `C:\Users\dikoh\.claude\CLAUDE.md` (di luar working tree
`sigma-ecosystem`, tidak bisa "diimplementasikan" lewat plan proyek ini)
**sudah diperbaiki** (2026-07-20, atas otorisasi eksplisit Director saat
review plan ini, dieksekusi terpisah dari eksekusi plan repo). Perubahan
persis mengikuti diff di atas. `setup/targets/bridge/CLAUDE.md` (sumber
kanonik/shipped) juga sudah diperbaiki.

**Perluasan (2026-07-20, atas permintaan Director untuk memverifikasi
bridge stub lain)**: audit awal hanya memeriksa `CLAUDE.md` — ternyata
`GEMINI.md` dan `AGENTS.md` punya frasa usang yang **identik**, baik versi
kanonik/shipped (`setup/targets/bridge/GEMINI.md`,
`setup/targets/bridge/AGENTS.md`) maupun instance di root project ini
(`GEMINI.md`, `AGENTS.md`). Keempatnya sudah diperbaiki dengan diff yang
sama persis. `setup/targets/bridge/DEEPSEEK.md` dan
`setup/targets/bridge/REASONIX.md` **sengaja tidak disentuh** — ditulis
dengan gaya berbeda dan tidak pernah membuat klaim "belum tersedia" soal
`sigma memory --<role>` sama sekali, jadi tidak mengandung bug yang sama.
Diverifikasi ulang dengan `grep -r "after CLI support lands"` ke seluruh
repo: nol kemunculan di file operatif, sisa kemunculan hanya di dokumen
Discussion/Implementation (catatan historis, bukan instruksi aktif).

---

### A.2 — Drift referensi nomor section (DEV-RULE.md, FMN-RULE.md)

**Masalah struktural** (bukan cuma satu typo — lihat README untuk daftar
lengkap 5 titik drift yang ditemukan, 3 di antaranya belum pernah dilaporkan
sebelumnya).

**Pendekatan perbaikan (dikonfirmasi Director, 2026-07-20)**: bukan cuma
mengoreksi angka satu-satu (itu akan drift lagi di penambahan section
berikutnya), tapi mengganti pola rujukan sepenuhnya ke **nama section saja,
nomor dihapus** dari prosa rule. Nama section stabil; nomor bergeser setiap
kali ada penyisipan/penambahan section baru (persis seperti yang terjadi di
A.5 di bawah).

**Titik yang diperbaiki**:

| File:baris | Sebelum | Sesudah |
|---|---|---|
| `DEV-RULE.md:413` | "Sections 1–4 (pre-build planning)" | "the DEV pre-build planning sections (Source Plan Alignment through Key Technical Decisions)" |
| `DEV-RULE.md:413`, `:425`, `:638`, `:640`, `:656`, `:666`, `:683` | "Section 1b (Pre-Build Assessment)" / "Section 1b" | "the DEV Pre-Build Assessment section" |
| `DEV-RULE.md:696` | "DEV advisory status (Section 12)" | "DEV advisory status (DEV Completion Statement section)" |
| `DEV-RULE.md:699`, `:712` | "Section 13" / "DEV-EXEC Section 13 (FMN Review)" | "the FMN Post-Build Review section" |
| `FMN-RULE.md:104` | "DEV-EXEC Section 15 (Director Observation Testing Report)" | "the Director Observation Report & Minor Requests section" |
| `FMN-RULE.md:510`, `:520` | "Section 1b (Pre-Build Assessment)" / "Sections 1–4" | sama pola seperti baris DEV-RULE.md di atas |
| `FMN-RULE.md:532`, `:537` | "DEV-EXEC Section 13" / "Section 13" | "the FMN Post-Build Review section" |

**Tidak diubah** (dipastikan bukan drift): `DEV-RULE.md:601` ("see Section 8
— Git Diff Evidence") merujuk ke section internal `DEV-RULE.md` sendiri
(judulnya sendiri adalah "### 8. Git Diff Evidence" di file yang sama),
bukan ke DEV-EXEC. `FMN-RULE.md` baris 246–253 (daftar "Section 1: Source
Alignment" dst. untuk FMN-PLAN) **sudah cocok** dengan
`FMN-PLAN-TEMPLATE.md` — tidak perlu diubah.

**Di luar scope plan ini, dicatat sebagai temuan**: `ARC-RULE.md:242,259,308,327,328`
merujuk nomor section `DIR-INTENT`/`AUD-RULE.md`. Belum diverifikasi
terhadap `DIR-INTENT-TEMPLATE.md` nyata pada plan ini (di luar scope waktu
penyusunan) — **perlu audit serupa terpisah** sebelum diasumsikan konsisten.

---

### A.3 — Gap izin `sigma memory`/`sigma send` untuk AUD

**Lokasi**: `Sigma/rules/AUD-RULE.md` §CLI Operation Policy (sekitar baris
1003-1018), dan `setup/targets/claude_code/aud.md` §CLI Operation Policy
(baris 70-84) + §Role Activation (baris 86-90).

**Verifikasi**: baik rule kanonik maupun skill file **sama-sama tidak
menyebut** `sigma memory` atau `sigma send` di §CLI Operation Policy —
padahal §Role Activation (skill) dan §Mandatory Message Triggers (rule)
mewajibkan/mengasumsikan keduanya boleh dijalankan tanpa otorisasi
per-command.

**Perubahan** — tambahkan baris eksplisit di `AUD-RULE.md` §CLI Operation
Policy (sumber kanonik):

```markdown
### Exemptions from per-command authorization

Two commands are exempt from the "Director must explicitly authorize each
command" rule above, because they do not discover new evidence beyond what
this rule already assumes AUD has:

- `sigma memory --aud` — read-only, scoped to AUD's own role memory. Run
  once at role activation without asking.
- `sigma send --from aud ...` — the only channel Mandatory Message Triggers
  (below) are allowed to use. Run only to fulfill a Mandatory Message
  Trigger, never to initiate unrelated communication.

All other commands remain gated behind explicit per-command Director
authorization, regardless of whether they are read-only or destructive.
```

Lalu di `setup/targets/claude_code/aud.md`, ganti §CLI Operation Policy agar
merujuk balik ke `AUD-RULE.md` alih-alih menyatakan ulang versi ringkas yang
berbeda cakupan — konsisten dengan pola "satu sumber kanonik, yang lain
rujuk balik" yang sudah dipakai untuk §Role Rules (baris 92-95 file yang
sama sudah melakukan ini untuk topik lain).

---

### A.4 — Nilai `--type`/`--action` hilang dari contoh Mandatory Message Trigger

**Lokasi**: `Sigma/rules/DEV-RULE.md` Trigger 1 (baris 638-663), Trigger 2
(664-687), Trigger 3 (689-715). Enum tervalidasi di `src/config.ts:48,51`
(`VALID_MESSAGE_TYPES`, `VALID_ACTIONS`).

**Disetujui Director (2026-07-20)** — mapping di bawah final, tidak ada
revisi:

| Trigger | `--type` | `--action` | Alasan |
|---|---|---|---|
| Trigger 1 (DEV minta klarifikasi) | `QUESTION` | `RESPOND` | DEV mengajukan pertanyaan, minta FMN merespons. |
| Trigger 2 (DEV minta pre-build review) | `CHECK` | `REVIEW` | DEV meminta pemeriksaan sebelum lanjut. |
| Trigger 3 (DEV minta post-build review) | `CHECK` | `REVIEW` | Sama seperti Trigger 2, konteks pasca-build. |

Contoh command di tiap trigger ditambah `--type <VALUE> --action <VALUE>`
sesuai tabel. Terapkan pola yang sama ke Trigger 1/2 di `AUD-RULE.md`
(baris 1079-1131, kirim temuan audit ke ARC/FMN) — usulan: `--type NOTE
--action REVIEW` (AUD memberi tahu hasil, minta ARC/FMN meninjau).

---

### A.5 — Slot "Protocol Overrides & Expansions" di FMN-PLAN

**Masalah**: persetujuan ekspansi scope di luar rencana awal (mis. Area H)
tidak punya tempat eksplisit — berakhir diselipkan ke tabel Constraints.

**Posisi (dikonfirmasi Director, 2026-07-20)**: **setelah Implementation
Constraints**, bukan sebelum AUD Findings seperti usulan awal saya — secara
konsep override/ekspansi scope satu keluarga dengan Constraints (sama-sama
soal batasan/penyesuaian scope), dan lebih mudah ditemukan FMN saat menyusun
rencana ketimbang menunggu di bagian akhir dekat AUD/Director.

Urutan baru FMN-PLAN lengkap setelah perubahan ini:

| # | Section | Perubahan |
|---|---|---|
| 1 | Source Alignment | tetap |
| 2 | Work Order / Task Plan | tetap |
| 3 | Acceptance Criteria | tetap |
| 4 | Implementation Constraints | tetap |
| 5 | **Protocol Overrides & Expansions** | **baru** |
| 6 | Pre-Build Test Contract | was 5 |
| 7 | DEV Handoff Instructions | was 6 |
| 8 | AUD Findings | was 7 |
| 9 | Director's Summary | was 8 |

**Perubahan**:

1. `Sigma/templates/FMN-PLAN-TEMPLATE.md` — sisipkan section baru sebagai
   Section 5 (setelah Implementation Constraints, sebelum Pre-Build Test
   Contract), dengan marker
   `<!-- SIGMA:FMN_PLAN:SECTION:PROTOCOL_OVERRIDES_EXPANSIONS -->`, mengikuti
   pola persis section `DIRECTORS_SUMMARY` yang baru ditambahkan commit
   `13ad887` (tabel: Item | Justifikasi | Disetujui Oleh | Tanggal). Perbarui
   nomor `##` pada 4 section setelahnya (Pre-Build Test Contract dst. sesuai
   tabel di atas).
2. `Sigma/rules/FMN-RULE.md` — tambahkan deskripsi section baru ini,
   mengikuti pola persis bagaimana "Section 8: Director's Summary"
   dideskripsikan (baris 253-256). Perbarui daftar section (baris 246-253)
   mengikuti urutan baru di tabel atas — daftar ini adalah daftar isi
   definitif dokumen jadi tetap memakai nomor (beda kasus dari A.2, yang
   soal rujukan tersebar di prosa). Untuk rujukan nomor section FMN-PLAN
   yang tersebar di luar daftar isi ini (mis. baris 275-276 "AUD Findings
   (Section 7)" dan "DIR-INTENT (Section 12)"), terapkan pola sama seperti
   A.2: ganti ke nama section, bukan angka, supaya penyisipan ini tidak
   langsung menimbulkan drift baru dengan pola yang sama yang baru saja
   diperbaiki.
3. `src/utils/docCheck.ts` — tambahkan `'PROTOCOL_OVERRIDES_EXPANSIONS'` ke
   `DOC_SPECS.plan.requiredSections` (baris 144-153), tepat setelah
   `IMPLEMENTATION_CONSTRAINTS` dan sebelum `PRE_BUILD_TEST_CONTRACT`.
4. Test: perbarui fixture FMN-PLAN yang dipakai `test/doc-check.test.ts`
   (dan test lock-gate terkait plan, jika ada fixture terpisah) untuk
   menyertakan marker baru — ikuti pola persis yang dipakai saat
   `DIRECTORS_SUMMARY` ditambahkan (commit `13ad887`, tidak ada test khusus
   baru ditambahkan saat itu — cukup pastikan fixture full-document tetap
   lolos `sigma plan check`). Jalankan `npm test` penuh untuk verifikasi
   tidak ada regresi.

---

### A.6 — Instruksi Asset ID Tracker untuk FMN

**Lokasi**: `Sigma/rules/FMN-RULE.md`, dekat §penomoran task/AC/TC (mis.
dekat baris 225 area referensi Source Alignment) atau di §Role Activation.

**Perubahan** — tambahkan satu paragraf:

```markdown
Before assigning any new artifact ID (TASK-, AC-, TC-, RQ-, or similar
numbered identifier), FMN MUST check the highest ID already minted for
that prefix in the prior locked FMN-PLAN version(s) or via `sigma roadmap
list` — do not assume numbering starts fresh. Colliding with an
already-minted ID from a prior version is a defect, not a style choice.
```

Ini instruksi teks murni (tidak menyentuh kode) — solusi otomatis penuh
(injeksi highest-ID ke `SIGMA-REGISTRY.json`) sengaja **tidak** masuk plan
ini, dicatat sebagai kandidat backlog terpisah kalau masalah ini terbukti
berulang setelah instruksi teks ini berjalan.

---

### A.7 — Klarifikasi otorisasi mid-build + panduan default Test-Contract-conflict

**Lokasi**: `Sigma/rules/DEV-RULE.md` §7 (Key Rules & Constraints, dekat
baris 411-429) dan §General Message Policy (baris 717-719).

**Perubahan 1** — tambahkan setelah baris 425:

```markdown
Director authorization to begin implementation remains valid across a
pause for FMN escalation (Trigger 1) and DEV's subsequent resumption —
DEV does not need to ask the Director to re-authorize solely because work
paused for FMN's response. Re-authorization is required only if FMN's
response reveals a scope change beyond the original FMN-PLAN.
```

**Perubahan 2** — tambahkan di §General Message Policy:

```markdown
When DEV discovers, mid-build, that a locked Pre-Build Test Contract
conflicts with observed reality, DEV should default to pausing
implementation and escalating to FMN before continuing — unless the
conflict is clearly non-blocking for the remaining work. This is guidance,
not a new mandatory trigger class; DEV retains discretion on message
shape.
```

(Menggantikan usulan "Mid-Build Material Finding" trigger baru yang
ditolak Director — lihat README §Group C poin 2.)

---

### A.8 — Doktrin baru: hasil negatif bersifat provisional

**Lokasi**: `Sigma/SIGMA_PROTOCOL.md` §4.0 Common Role Doctrine (baris
78-100) — sumber kanonik yang sudah eksplisit menyatakan "role rule files
reference this section" (baris 80). **Satu tempat saja** yang perlu diedit;
4 file rule tidak perlu disalin ulang.

**Perubahan** — tambahkan sebagai prinsip ke-11:

```markdown
11. **Negative results are provisional** — A failed search, an assumed
    command limitation, or a single reading of another document's prose
    about its own state must be treated as provisional, not fact, until
    confirmed through at least one independent check (a case-variant
    search, `--help` on the command in question, a directory listing, or
    the relevant authoritative read-only CLI command). Report "not found
    yet" to the Director, never "does not exist," until that confirmation
    happens.
```

Ini prinsip paling penting hasil diskusi (baik dari laporan asli maupun
analisis ChatGPT) — akar dari 5 dari 7 insiden individual yang tercatat di
bug report (AUD §2.1-2.3, DEV §7.1, FMN §13.1).

---

## Rencana test

- A.1, A.2, A.3, A.4, A.6, A.7, A.8: murni edit teks `.md`, tidak ada test
  otomatis yang menyentuh isi prosa rule file — verifikasi lewat re-read
  manual + `grep -n "Section [0-9]"` ulang di `Sigma/rules/` untuk
  memastikan tidak ada sisa drift yang terlewat.
- A.5: satu-satunya perubahan kode. Wajib `npm run build && npm test`
  penuh setelah perubahan `docCheck.ts` + fixture, pastikan seluruh test
  lama tetap hijau plus fixture FMN-PLAN yang diperbarui lolos `sigma plan
  check`.

## Risiko & mitigasi

- Risiko utama: A.2 dan A.5 saling beririsan (A.5 menyisipkan section baru
  yang menggeser nomor AUD Findings/Director's Summary FMN-PLAN,
  persis pola drift yang sedang diperbaiki A.2). Mitigasi: kerjakan A.2
  dulu sebagai prinsip (ganti rujukan ke nama, bukan angka) sebelum A.5
  dieksekusi, supaya penyisipan section baru di A.5 tidak menciptakan drift
  baru dengan pola yang sama.
- A.1 bagian global CLAUDE.md ada di luar repo — risiko lupa disinkronkan.
  Mitigasi: dicatat eksplisit sebagai item terpisah untuk Director, bukan
  diasumsikan otomatis ikut ter-fix.
- A.4 nilai `--type`/`--action` adalah usulan, bukan konvensi established —
  risiko Director/FMN tidak setuju dengan pemetaan yang diusulkan. Mitigasi:
  sudah ditandai eksplisit sebagai "usulan, perlu konfirmasi" di dokumen ini.

## Langkah selanjutnya

Menunggu review dan approval eksplisit Director per item (bisa disetujui
sebagian — item-item ini independen satu sama lain kecuali catatan urutan
A.2→A.5 di atas).
