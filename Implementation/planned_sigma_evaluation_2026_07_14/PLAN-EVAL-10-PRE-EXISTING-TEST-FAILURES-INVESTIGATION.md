# PLAN-EVAL-10 — Investigasi & Perbaikan 7 Kegagalan Test Pre-Existing

**Sumber**: Ditemukan pertama kali saat implementasi `PLAN-EVAL-01`, dikonfirmasi ulang
saat implementasi `PLAN-EVAL-03` — bukan berasal dari 7+1 topik
`Discussion/sigma-system-evaluation-2026-07-14.md`.
**Tanggal investigasi**: 2026-07-14
**Tanggal implementasi**: 2026-07-14
**Status**: IMPLEMENTED — investigasi awal (di bawah) ditulis sebagai proposal murni;
Director kemudian mengotorisasi eksekusi langsung di Professional Mode (bukan FMN/DEV
governance flow). Lihat "Implementation Walkthrough" di bagian akhir dokumen untuk
rincian eksekusi dan bukti verifikasi.
**Urutan eksekusi**: Tidak terikat urutan #1–#9 di `README.md` folder ini — berdiri
sendiri, murni memperbaiki test, tidak menyentuh perilaku CLI produksi.
**Catatan**: Dokumen investigasi disusun Professional Mode. Bukan FMN-PLAN, tidak
punya otoritas lock/gate Sigma. Bagian investigasi asli di bawah dipertahankan apa
adanya sebagai catatan sejarah keputusan; perubahan status implementasi dicatat di
bagian akhir dokumen ini, bukan dengan menulis ulang analisis di atas.

---

## Latar Belakang

Sejak `npm test` pertama kali dijalankan ulang di `PLAN-EVAL-01` (2026-07-14), selalu
ada **7 test gagal dari 114 total** — jumlah dan identitas kegagalannya konsisten
persis sama di dua sesi implementasi berbeda (`PLAN-EVAL-01`, `PLAN-EVAL-03`), masing-
masing diverifikasi lewat `git stash` (kegagalan tetap identik di HEAD sebelum
perubahan sesi berjalan). Ini membuktikan ketujuh kegagalan ini **tidak terkait**
dengan pekerjaan kedua plan tersebut — murni drift test terhadap perilaku CLI yang
sudah berubah sebelumnya, tapi belum pernah diinvestigasi akar masalahnya sampai
dokumen ini dibuat.

Daftar lengkap 7 test yang gagal (`npm test`, kondisi HEAD saat ini):

| # | File | Test |
|---|---|---|
| 1 | `test/chain-gate.test.ts` | `sigma plan new is blocked when INTENT is not locked (gate_1_open false)` |
| 2 | `test/gate-enforcement.test.ts` | `sigma plan new fails when Gate 1 is blocked (no locked INTENT)` |
| 3 | `test/plan-activate.test.ts` | `reports Gate 1.5 before any draft-queue concern when no ACTIVE ROADMAP exists` |
| 4 | `test/plan-activate.test.ts` | `gate-first error points to roadmap activation flow` |
| 5 | `test/plan-activate.test.ts` | `after activation, sigma plan lock locks the activated version` |
| 6 | `test/intent-lock.test.ts` | `sigma intent lock transitions INTENT from DRAFT to LOCKED in progress.json` |
| 7 | `test/progress-hardening.test.ts` | `allows a new draft intent while prior locked artifacts keep gates open` |

Kabar baiknya: investigasi ini menemukan bahwa **ketujuhnya berasal dari hanya 2 akar
masalah**, dan keduanya adalah **drift test fixture**, bukan bug di kode produksi.
CLI berperilaku benar di kedua kasus; test-nya yang belum diperbarui mengikuti
pengerasan (hardening) perilaku CLI yang terjadi setelah test ditulis.

---

## Root Cause A — `--title`/`--focus` Wajib, Test Tidak Menyertakannya (4 test)

### Test Terdampak

- #1 `test/chain-gate.test.ts:10-18`
- #2 `test/gate-enforcement.test.ts:10-18`
- #3 `test/plan-activate.test.ts:59-68`
- #4 `test/plan-activate.test.ts:70-78`

### Bukti

Keempatnya memanggil `runCli('plan new', ...)` **tanpa** flag `--title`/`--focus`,
lalu berharap melihat pesan gate-check tertentu di `stderr` (mis. `/GATE 1 BLOCKED/i`,
`/Gate 1\.5 blocked/i`, `/sigma roadmap new/i`).

Tapi `sigma plan new` ([plan.ts:72-73](../../src/commands/plan.ts#L72-L73)) mendeklarasikan
`--title`/`--focus` sebagai `.requiredOption()` Commander.js. Commander memvalidasi
`requiredOption` **sebelum** `.action()` handler dipanggil — jadi seluruh logika gate
(`GATE 1 BLOCKED`, `Gate 1.5 blocked`, dst.) di dalam `.action()` **tidak pernah
tereksekusi**. CLI berhenti lebih dulu dengan pesan Commander sendiri:

```
error: required option '--title <title>' not specified
```

Exit code tetap `1` (jadi assertion `exitCode` lolos di beberapa kasus), tapi assertion
pada isi `stderr` gagal karena pesannya bukan yang diharapkan test.

### Kronologi Drift

`--title`/`--focus` menjadi wajib di `plan new` sebagai bagian dari fitur penulisan
metadata stage ke ROADMAP (`assertRequiredStageMetadata`, `registerPlanDraft`) — sudah
ada sebelum sesi evaluasi 14 Juli 2026 dimulai. Keempat test ini ditulis untuk
memverifikasi **urutan pengecekan gate** (`GATE 1` → `Gate 1.5` → dst.), sebuah concern
yang sepenuhnya independen dari keberadaan `--title`/`--focus`. Saat flag itu dibuat
wajib, tidak ada yang memperbarui pemanggilan `runCli('plan new', ...)` di keempat test
ini untuk menyertakannya — sehingga sejak saat itu, keempatnya diam-diam berhenti
menguji apa yang mereka klaim uji (gate ordering), dan malah selalu gagal di titik yang
sama sekali berbeda (validasi flag Commander).

### Dampak

- **Bukan bug produksi.** Perilaku CLI (menolak tanpa `--title`/`--focus`, menolak tanpa
  gate terbuka) keduanya benar dan disengaja.
- **Blind spot nyata di test suite**: urutan gate (`GATE 1` sebelum `Gate 1.5` sebelum
  draft-queue) **tidak lagi benar-benar diverifikasi otomatis** sejak drift ini
  terjadi — assertion-nya gagal di tempat yang salah, bukan gagal karena urutan gate
  berubah. Kalau suatu saat urutan gate benar-benar rusak (regresi), keempat test ini
  tidak akan menangkapnya — mereka sudah gagal duluan karena alasan lain.

### Rencana Perbaikan (Proposal, Belum Dieksekusi)

Tambahkan `--title "..." --focus "..."` ke setiap pemanggilan `runCli('plan new', ...)`
di keempat test ini (nilai apa saja yang valid, karena bukan itu yang diuji), sehingga
eksekusi kembali sampai ke titik gate-check yang sebenarnya ingin diverifikasi. Tidak
ada perubahan di kode produksi — murni perbaikan test fixture.

---

## Root Cause B — Validasi Struktur Dokumen Sebelum Lock, Fixture Stub Tidak Valid (3 test)

### Test Terdampak

- #5 `test/plan-activate.test.ts:122-145` (bagian `sigma plan lock`)
- #6 `test/intent-lock.test.ts:11-35`
- #7 `test/progress-hardening.test.ts:75-92`

### Bukti

Ketiganya menulis file artefak stub minimal secara manual, contoh:

```ts
// test/intent-lock.test.ts:17
fs.writeFileSync(intentFile, '# DIR-INTENT v1\n\n## Director Notes\n\nTest intent.\n');
```

```ts
// test/plan-activate.test.ts:132
fs.writeFileSync(planFile, '# FMN-PLAN v1.2\n\nTest plan.\n');
```

Isi stub ini tidak memiliki marker `<!-- SIGMA:DOC type=... schema=... -->` maupun
marker section (`SIGMA:{TYPE}:SECTION:...`) apa pun.

Tapi `sigma intent lock` ([intent.ts:109-112](../../src/commands/intent.ts#L109-L112))
dan `sigma plan lock` ([plan.ts:180-183](../../src/commands/plan.ts#L180-L183)) sama-sama
menjalankan `validateSigmaDocFile()` + `ensureSigmaDocEligible()` sebagai gerbang
sebelum mengunci — dan stub minimal ini pasti gagal validasi (`Missing document
marker`, `Missing required section marker: ...`). `ensureSigmaDocEligible` melempar
error, CLI keluar dengan exit code `1`, padahal ketiga test mengharapkan `0`.

Test #7 (`progress-hardening.test.ts`) sekilas berbeda konteks (soal stale-intent
propagation saat re-lock intent baru), tapi akar kegagalannya sama persis: file stub
`DIR-INTENT-v2.md` yang ditulis manual juga tidak punya marker yang diperlukan.

### Kronologi Drift

`validateSigmaDocFile`/`ensureSigmaDocEligible` sebagai gerbang wajib sebelum
`intent lock`/`plan lock` adalah pengerasan yang ditambahkan setelah ketiga test ini
ditulis. Saat itu, menulis file stub apa pun sudah cukup untuk lolos `lock` karena
belum ada pengecekan struktur. Setelah gerbang validasi ditambahkan, ketiga fixture
stub ini tidak pernah diperbarui untuk menyertakan marker yang sekarang diwajibkan.

### Dampak

- **Bukan bug produksi.** Menolak lock atas dokumen yang strukturnya tidak valid
  adalah perilaku yang disengaja dan diinginkan (mencegah lock atas draft yang belum
  lengkap).
- **Blind spot serupa Root Cause A**: assertion pasca-lock (mis. `intent.active_state`
  berubah jadi `LOCKED`, `stale_intent` ter-propagate ke plan/exec) tidak pernah
  benar-benar tereksekusi karena `lock` sudah gagal duluan di validasi struktur.

### Rencana Perbaikan (Proposal, Belum Dieksekusi)

Ganti isi stub di ketiga test dengan konten yang valid secara struktural — opsi
termudah dan paling konsisten dengan pola yang sudah dipakai di test lain
(`doc-check.test.ts`, `command-helper-regression.test.ts`): pakai
`copyTemplateToArtifact()`/template asli lalu isi minimal, atau tulis literal string
yang menyertakan `<!-- SIGMA:DOC type=... schema=1 -->` plus seluruh marker section
wajib sesuai `DOC_SPECS` di `src/utils/docCheck.ts` (`INTENT_CORE`, ... untuk intent;
`SOURCE_ALIGNMENT`, ... untuk plan). Tidak ada perubahan di kode produksi — murni
perbaikan test fixture.

---

## Kenapa Ini Tidak Diperbaiki di `PLAN-EVAL-01`/`PLAN-EVAL-03`

Kedua plan tersebut secara eksplisit membatasi "npm test lulus tanpa modifikasi di luar
test yang memang sengaja disesuaikan di tahap ini" — memperbaiki ketujuh test ini akan
menjadi scope creep di luar objective masing-masing plan (restrukturisasi
`doctor`/`override`/`reset` di #01; restrukturisasi ROADMAP di #03). Keduanya memilih
memverifikasi lewat `git stash` bahwa kegagalan bersifat pre-existing, mencatatnya di
Acceptance Criteria, lalu melanjutkan — pendekatan yang benar untuk menjaga plan tetap
fokus, tapi berarti akar masalahnya belum pernah didokumentasikan sampai sekarang.

---

## Rekomendasi Keputusan untuk Director

1. **Setujui perbaikan test fixture** seperti diuraikan di kedua "Rencana Perbaikan" di
   atas — murni perbaikan test, tanpa risiko terhadap perilaku CLI produksi. Estimasi
   kecil (4 baris tambahan flag untuk Root Cause A; 3 stub string diperluas untuk Root
   Cause B).
2. **Tentukan siapa yang mengerjakan** — bisa jadi PLAN-EVAL implementasi tersendiri
   (nomor berikutnya setelah #09) begitu disetujui, atau digabung sebagai kredit
   "pembersihan test" di iterasi implementasi lain yang sudah berjalan.
3. **Setelah diperbaiki**, jalankan ulang `npm test` dan pastikan hasilnya
   **114 passed / 0 failed** — jika masih ada kegagalan setelah fixture diperbaiki,
   berarti ada regresi nyata di urutan gate atau logika stale-intent yang selama ini
   tertutupi oleh drift ini, dan itu baru menjadi bug produksi sungguhan yang perlu
   plan perbaikan terpisah.

---

## Draft Acceptance Criteria (Untuk Plan Perbaikan di Masa Depan, Jika Disetujui)

- [x] `test/chain-gate.test.ts`, `test/gate-enforcement.test.ts`, `test/plan-activate.test.ts`
      (2 test gate-ordering) menyertakan `--title`/`--focus` di setiap pemanggilan
      `plan new` yang dimaksudkan untuk menguji gate-check, bukan validasi flag.
- [x] `test/intent-lock.test.ts`, `test/progress-hardening.test.ts`, dan
      `test/plan-activate.test.ts` (test `plan lock` setelah `activate`) memakai
      fixture stub yang lolos `validateSigmaDocFile` untuk domain terkait.
- [x] `npm test` → 114 passed / 0 failed.
- [x] Tidak ada perubahan di luar file test yang disebut di atas — dokumen ini murni
      investigasi, perbaikan hanya menyentuh test.

---

## Implementation Walkthrough

**Dieksekusi oleh**: Claude (Professional Mode — AI pengembang/teknisi sigma-cli),
atas otorisasi langsung Director di sesi ini. Bukan alur governance FMN/DEV — tidak
ada FMN-PLAN atau DEV-EXEC yang dibuat/dikunci untuk perbaikan ini, sesuai sifat
perbaikan yang murni menyentuh test fixture, bukan perilaku CLI produksi.

### Root Cause A — Tambah `--title`/`--focus` ke Pemanggilan `plan new`

File yang diubah:

- `test/chain-gate.test.ts` — test `sigma plan new is blocked when INTENT is not
  locked (gate_1_open false)`: pemanggilan `runCli('plan new', ...)` menjadi
  `runCli('plan new --title "Test Stage" --focus "Test focus"', ...)`.
- `test/gate-enforcement.test.ts` — test `sigma plan new fails when Gate 1 is
  blocked (no locked INTENT)`: perubahan sama.
- `test/plan-activate.test.ts` — dua test gate-ordering (`reports Gate 1.5 before
  any draft-queue concern...` dan `gate-first error points to roadmap activation
  flow`): perubahan sama pada kedua pemanggilan `plan new`.

Nilai `--title`/`--focus` yang dipakai adalah string placeholder (`"Test Stage"` /
`"Test focus"`) karena keempat test ini memang tidak menguji isi flag tersebut —
sesuai analisis Root Cause A di atas, mereka menguji urutan gate-check. Test
`sigma plan new succeeds when Gate 1 is open (INTENT LOCKED)` di
`gate-enforcement.test.ts` **sengaja tidak disentuh**: test itu sudah lolos (bukan
bagian dari 7 kegagalan) dan tetap di luar cakupan Acceptance Criteria di atas.

### Root Cause B — Fixture Stub Valid Secara Struktur

Menambahkan dua helper baru di `test/helpers.ts` — `validIntentDoc(version)` dan
`validPlanDoc(version)` — yang menghasilkan konten literal berisi marker dokumen
(`<!-- SIGMA:DOC type=... schema=... -->`) dan seluruh marker section wajib sesuai
`DOC_SPECS` di `src/utils/docCheck.ts` (13 section untuk `DIR_INTENT`, 7 section
untuk `FMN_PLAN`), masing-masing diikuti heading H2, agar lolos
`validateSigmaDocFile`/`ensureSigmaDocEligible`. Referensi format marker diambil
dari `Sigma/templates/DIR-INTENT-TEMPLATE.md` dan
`Sigma/templates/FMN-PLAN-TEMPLATE.md`.

File yang diubah:

- `test/helpers.ts` — tambah `validIntentDoc()` dan `validPlanDoc()`.
- `test/intent-lock.test.ts` — test `sigma intent lock transitions INTENT from
  DRAFT to LOCKED...`: stub `DIR-INTENT-v1.md` manual diganti `validIntentDoc('v1')`.
- `test/progress-hardening.test.ts` — test `allows a new draft intent while prior
  locked artifacts keep gates open`: stub `DIR-INTENT-v2.md` manual diganti
  `validIntentDoc('v2')`.
- `test/plan-activate.test.ts` — test `after activation, sigma plan lock locks the
  activated version`: stub `FMN-PLAN-v1.2.md` manual diganti `validPlanDoc('v1.2')`.

Helper dipusatkan di `test/helpers.ts` (bukan diulang literal per file) agar
konsisten dengan pola helper lain yang sudah ada di file yang sama
(`makeProgressWith*`), dan supaya perubahan format marker di masa depan (mis.
`DOC_SPECS` bertambah section) hanya perlu diperbarui di satu tempat.

### Verifikasi

```
npm test
Test Files  20 passed (20)
     Tests  114 passed (114)
```

Seluruh 114 test lulus, termasuk ketujuh test yang sebelumnya gagal. Tidak ada
perubahan di luar `test/helpers.ts` dan lima file test yang disebut di atas — tidak
ada perubahan pada `src/` atau `dist/` untuk perbaikan ini.

**Catatan type-check tidak terkait**: saat menambahkan helper baru di
`test/helpers.ts`, editor melaporkan pre-existing TypeScript diagnostics (error
`TS2322`) di fungsi `makeProgressWith*` yang sudah ada sebelumnya (tidak disentuh
perbaikan ini) — dikonfirmasi lewat `git stash` bahwa diagnostics tersebut sudah
ada sebelum perubahan sesi ini. Tidak memblokir `npm test` (vitest tidak menjalankan
type-check strict pada test file). Di luar cakupan dokumen ini; layak dicatat sebagai
temuan terpisah bila Director ingin ditindaklanjuti.
