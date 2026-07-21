# PLAN-EVAL-01 — Gate 3.5 & Reconstruct Test Suite Debt

**Sumber**: Ditemukan saat verifikasi keamanan (`npx tsc --noEmit` + `npx vitest run`) setelah eksekusi
`Implementation/planned_sigma_closure_authority_2026_07_20/PLAN-EVAL-05-SETUP-TARGETS-FMN-CLOSE-AUTHORITY-DRIFT.md` —
di luar scope diskusi sumber manapun.
**Tanggal**: 2026-07-21
**Status**: **EXECUTED (2026-07-21)**. Director mengikuti kedua rekomendasi
plan ini (Opsi A untuk §1, Opsi B untuk §2). Diverifikasi: `tsc --noEmit`
bersih, `npm run build` sukses, `npx vitest run` → **215/215 test lulus**
(214 lama + 1 test baru untuk kasus tabel 7-kolom di §2).
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan
FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

3 dari 214 test gagal di `npx vitest run` (211 lulus). Diverifikasi lewat
`git stash` bahwa ketiganya **sudah gagal sebelum sesi ini menyentuh apa
pun** — bukan regresi dari `PLAN-EVAL-03/04/05` (closure authority folder)
atau dari bump versi `0.9.0` → `0.10.0`. Root cause keduanya sudah
ditelusuri sampai baris kode, bukan dugaan:

1. **`test/lifecycle-hardening.test.ts`** (2 test gagal) — Gate 3.5 (ARC
   Satisfaction Score, `PLAN-EVAL-02-GATE-3-5-ARC-SATISFACTION-SCORE.md`)
   memblokir `sigma close new` kalau `chain.intent.arc_score` belum
   direkam. Fixture `makeChainWithLockedExec()` (`test/helpers.ts:204-219`)
   tidak pernah mengisi field itu, jadi kedua test `close new` yang
   memakainya sekarang menerima exit code `1`, bukan `0` yang diasumsikan
   test lama (ditulis sebelum Gate 3.5 ada).
2. **`test/intent-history.test.ts`** (1 test gagal) — `doctor --reconstruct`
   test menulis `intent-history.md` dengan tabel **5-kolom lama**
   (`| Version | Title | Focus | Status | Reason |`). Parser
   `readIntentHistoryMetadata()` (`src/engine/reconstruct.ts:174-190`)
   menaikkan ambang minimum kolom ke `cells.length < 8` sejak PLAN-EVAL-02
   (tabel sekarang 7 kolom: `+ Score + Notes`). Baris 5-kolom sekarang
   selalu di bawah ambang → di-skip parser → title/focus recovery gagal.

Kedua akar masalah lahir dari `PLAN-EVAL-02` (dieksekusi 2026-07-20) —
schema/gate/parser-nya berubah, test suite tidak ikut diupdate.

---

## 1. Fix — `test/lifecycle-hardening.test.ts` (2 test)

### Constraint yang harus diperiksa dulu (bukan diasumsikan)

`makeChainWithLockedExec()` dipakai di **6 file test**, bukan cuma
`lifecycle-hardening.test.ts`:

- `test/doctor-invalid.test.ts:134`
- `test/progress-hardening.test.ts:98`
- `test/lifecycle-hardening.test.ts:37,50,62` (3 pemanggilan, cuma 2 yang
  gagal — `it('sigma session bootstrap ...')` di baris 37 tidak memanggil
  `close new`, jadi tidak terpengaruh Gate 3.5)
- `test/intent-supersede.test.ts:156`
- `test/intent-reopen.test.ts:19`
- `test/role-memory-bootstrap.test.ts:119,161`

Mengubah helper bersama secara default (misal menambah `arc_score: 80` ke
`makeChainWithLockedExec()`) berisiko mengubah state chain di 5 file test
lain yang tidak diverifikasi di sini — beberapa mungkin sengaja menguji
state **tanpa** `arc_score` (mis. `doctor-invalid.test.ts` yang namanya
menyiratkan pengujian state tidak lengkap/rusak).

### Opsi perbaikan

- **Opsi A (direkomendasikan)** — jangan ubah helper bersama. Tambahkan
  langkah eksplisit di kedua test yang gagal (`lifecycle-hardening.test.ts`
  baris ~50 dan ~62) yang menulis `arc_score` ke chain sebelum memanggil
  `close new` — baik lewat parameter opsional baru pada
  `makeChainWithLockedExec()` (mis. `makeChainWithLockedExec(version,
  planExecVersion, { arcScore: 80 })`, default `undefined` = perilaku lama
  tidak berubah untuk 5 file test lain), atau lewat mutasi objek chain hasil
  fixture sebelum `writeChainFixture()`. Blast radius minimal, hanya
  menyentuh 2 test yang memang menguji `close new`.
- **Opsi B** — ubah `makeChainWithLockedExec()` agar selalu menyertakan
  `arc_score` tinggi secara default. Lebih sedikit baris diubah, tapi
  butuh verifikasi manual ke 5 file test lain dulu untuk memastikan tidak
  ada assertion yang bergantung pada `arc_score` kosong. **Belum
  diverifikasi di plan ini** — kalau Director memilih opsi ini, verifikasi
  itu jadi langkah wajib sebelum eksekusi, bukan asumsi.

Skor yang dipakai di kedua opsi: `80` (band `SATISFIED_RECOMMENDED`,
`arcScoreBand()`) — dipilih supaya test jelas melewati ambang `>= 50`
dengan margin, bukan nilai perbatasan yang rapuh terhadap perubahan ambang
di masa depan.

---

## 2. Fix — `test/intent-history.test.ts` (1 test)

Ini bukan cuma soal memperbaiki satu baris test — ada keputusan desain
nyata yang perlu Director putuskan dulu, karena dua fix di bawah punya
konsekuensi user-facing yang berbeda.

### Opsi A (mekanis) — update fixture test ke tabel 7-kolom

Ganti literal tabel di test (`test/intent-history.test.ts:186`) dari:

```
| Version | Title | Focus | Status | Reason |
| :--- | :--- | :--- | :--- | :--- |
| v1 | Recovered Title | Recovered Focus | DRAFT | — |
```

jadi 7 kolom (`+ Score + Notes`), mengikuti format
`generateIntentHistoryContent()` saat ini. Test kembali hijau, tapi **tidak
menjawab pertanyaan nyata**: proyek yang punya `intent-history.md`
peninggalan sebelum PLAN-EVAL-02 (masih 5 kolom) sekarang kehilangan
kemampuan `doctor --reconstruct` memulihkan title/focus dari file lama itu
— regresi backward-compatibility yang senyap, tidak pernah didiskusikan
eksplisit saat PLAN-EVAL-02 mengubah ambang di `reconstruct.ts:181`.

### Opsi B (lebih dalam) — `reconstruct.ts` menerima 5 kolom DAN 7 kolom

Ubah `readIntentHistoryMetadata()` supaya `cells.length >= 6` (tabel lama)
atau `cells.length >= 8` (tabel baru) sama-sama diterima, sama-sama
diekstrak title/focus-nya (kolom Score/Notes tidak relevan buat recovery
ini, jadi kehadirannya opsional). Mempertahankan backward-compatibility
`doctor --reconstruct` untuk proyek pre-PLAN-EVAL-02. Test kemudian
memverifikasi **kedua** bentuk tabel (5-kolom lama dan 7-kolom baru), bukan
cuma satu.

**Rekomendasi plan ini**: Opsi B — kegagalan recovery yang senyap untuk
proyek lama adalah cacat backward-compatibility nyata, bukan cuma test
debt, dan `doctor --reconstruct` secara eksplisit adalah command untuk
skenario "state proyek rusak/hilang" — justru saat itu (proyek lama, file
konfigurasi mungkin belum lengkap) yang paling butuh recovery bekerja.
**Ini rekomendasi, bukan keputusan** — perlu konfirmasi Director sebelum
ditulis final ke kode.

---

## Yang **tidak berubah**

- Tidak ada perubahan ke Gate 3.5 atau skema `arc_score` itu sendiri
  (`PLAN-EVAL-02`) — plan ini murni menyesuaikan test suite dan (kalau
  Opsi B dipilih) memperluas kompatibilitas parser, bukan mengubah
  perilaku gate.
- 211 test yang sudah lulus tidak disentuh.

## Langkah selanjutnya

**Selesai.** Director memilih rekomendasi plan untuk kedua open item (Opsi
A §1, Opsi B §2) dan memberi otorisasi eksplisit 2026-07-21.

- §1: `test/helpers.ts` — `makeChainWithLockedExec()` mendapat parameter
  opsional ketiga `arcScore` (default `undefined`, tidak mengubah 5 call
  site lain). Kedua test `close new` di `lifecycle-hardening.test.ts`
  dipanggil dengan `arcScore = 80`.
- §2: `src/engine/reconstruct.ts` — ambang `readIntentHistoryMetadata()`
  dikembalikan ke `cells.length < 6` (bukan dinaikkan ke `< 8`), menerima
  baik tabel 5-kolom lama maupun 7-kolom saat ini — keduanya cukup untuk
  memulihkan title/focus. Test lama di-rename untuk memperjelas ini kasus
  legacy, plus satu test baru untuk kasus tabel 7-kolom saat ini.

Diverifikasi: `tsc --noEmit` bersih, `npm run build` sukses, `npx vitest
run` → 215/215 lulus (214 lama + 1 baru).
