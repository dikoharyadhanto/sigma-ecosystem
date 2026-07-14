# PLAN-EVAL-11 — Unified `sigma {domain} check` Requirement Visibility & New Lock Requirement Gates (EXEC, CLOSE)

**Sumber**: Sesi diskusi lanjutan pasca-PLAN-EVAL-04 (2026-07-14) — bukan bagian
dari 7+1 topik sesi evaluasi awal manapun. Muncul dari pertanyaan Director
tentang bagaimana AI mengetahui syarat lock sebuah dokumen, yang mengungkap
gap discoverability di `sigma {domain} check`.
**Tanggal**: 2026-07-14
**Status**: DECISIONS LOCKED (2026-07-14) — seluruh Isu Terbuka sudah diputuskan
Director (lihat "Isu Terbuka / Perlu Keputusan Director" untuk hasil final,
dan Bagian A.5 untuk satu invariant tambahan yang muncul dari diskusi
Director↔AUD pasca-draf). Belum diimplementasi — implementasi kode baru boleh
dimulai setelah Director memberi otorisasi eksplisit terpisah dari persetujuan
keputusan desain di dokumen ini.
**Urutan eksekusi**: Independen — bisa dikerjakan kapan saja setelah
PLAN-EVAL-04 selesai (Bagian A plan ini bergantung pada `enforceVerdictGate`/
`enforceFinalChecklistGate` yang sudah dibangun di PLAN-EVAL-04 Bagian C/E).
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan
FMN-PLAN, tidak punya otoritas lock/gate Sigma. Beberapa bagian di bawah
sengaja tidak menuliskan keputusan akhir — mengikuti prinsip yang sama
dengan `ARC-RULE.md` ("jangan menciptakan requirement yang belum disepakati
Director"), diterapkan pada Professional Mode di sesi ini.

---

## Objective

Menyatukan pengalaman `sigma {domain} check` di seluruh 5 domain
(intent/plan/roadmap/exec/close) supaya requirement gate — bukan cuma cek
struktural marker — langsung terlihat sebagai daftar satisfied/unsatisfied,
dan merancang gate isi-konten baru untuk `exec` (DEV-EXEC) dan `close`
(DIR-CLOSE) yang saat ini belum punya sama sekali, meniru pola yang sudah
terbukti bekerja di `intent`/`plan` (PLAN-EVAL-04 Bagian C/E).

## Latar Belakang Umum

- `intent` dan `plan` sudah punya gate isi-konten sejak PLAN-EVAL-04
  (`enforceVerdictGate`, `enforceFinalChecklistGate` — khusus intent) —
  tapi gate-gate ini **hanya aktif di `lock`**, tidak pernah di `check`,
  sehingga satu-satunya cara "preview" kesiapan adalah benar-benar mencoba
  `lock` (aman karena tidak mengubah state saat gagal, tapi tidak intuitif
  untuk tujuan preview).
- `roadmap`, `exec`, `close` tidak punya gate isi-konten sama sekali —
  `check` di ketiga domain ini murni cek struktural (marker ada, heading H2
  ada, urutan section benar).
- Riset untuk plan ini menemukan: `exec` dan `close` **sudah** punya
  struktur checkbox verdict yang natural untuk dijadikan gate, tapi belum
  pernah divalidasi CLI sama sekali:
  - `DEV-EXEC` §15 "FMN Post-Build Review — Advisory Verdict"
    (READY_FOR_LOCK / NEEDS_DEV_UPDATE / REVISION_REQUIRED /
    COMPLETE_WITH_RISK / OTHER) — namanya sendiri ("READY_FOR_LOCK")
    mengisyaratkan ini seharusnya syarat `exec lock`, tapi saat ini
    `exec lock` bisa berhasil walau section ini kosong sama sekali.
  - `DIR-CLOSE` §1 "Closure Decision" (CLOSE_ACCEPTED /
    CLOSE_ACCEPTED_WITH_LIMITATIONS / DO_NOT_CLOSE / OPEN_NEW_PLAN /
    UPDATE_CURRENT_EXEC / OTHER) — lebih mencolok lagi: verdict
    "DO_NOT_CLOSE" bisa tercentang, dan `sigma close lock` tetap akan
    berhasil, sepenuhnya mengabaikan keputusan yang sudah ditulis di
    dokumen itu sendiri.
- `roadmap` tidak punya standalone lock command (auto-lock sebagai efek
  samping `sigma close lock`) dan tidak punya struktur checkbox/verdict apa
  pun — kandidat gate isi-konten kemungkinan tidak ada (lihat Bagian D).

---

## Bagian A — Unified Check Reporting Format

### Latar Belakang

- `SigmaDocCheckReport` (`src/utils/docCheck.ts`) saat ini hanya berisi flat
  `errors`/`warnings`/`passes` string array — cukup untuk mencetak laporan
  bebas, tapi tidak dirancang untuk ditampilkan sebagai checklist ✓/✗ yang
  jelas per item requirement.
- `intent check`/`plan check` tidak menjalankan `enforceVerdictGate`/
  `enforceFinalChecklistGate` sama sekali — hanya `lock` yang
  mengaktifkannya (keputusan desain PLAN-EVAL-04 supaya `intent new`/
  `plan new` tidak langsung gagal begitu draft baru dibuat).

### Keputusan Director (2026-07-14)

- `check` **tidak pernah mengubah exit code / `report.ok`**. Identitas
  `check` yang disepakati: *"check tidak pernah membuat keputusan; check
  hanya memperlihatkan keputusan apa saja yang masih harus dipenuhi
  sebelum lock."* `check` = observasi (read), `lock` = commit (mutasi
  runtime state). Lihat A.5 untuk kontrak formal antara keduanya.
- Istilah yang dipakai di UI/laporan: **"Lock Requirements"** / **"Lock
  Readiness"** — bukan sekadar "Requirements" — supaya tidak bercampur
  makna dengan checkbox verdict individual (mis. `CLOSE_ACCEPTED` itu
  sendiri bukan requirement, itu *outcome* dari sebuah requirement
  "verdict recorded and in an allowed category").
- Final Validation Checklist (intent) dan gate serupa lainnya harus
  direstrukturisasi supaya tampil **per-item** (`✓ Scope Defined` /
  `✗ Execution Direction`), bukan satu pesan agregat seperti
  implementasi saat ini (`docCheck.ts` baris ~386-390 menghasilkan satu
  string `"3 item(s) not checked: X | Y | Z"`). Ini scope tambahan di
  luar draf task awal — effort lebih besar dari perkiraan semula, tapi
  disetujui Director supaya UX cocok dengan mockup di bawah.

### Contoh UX Target (disetujui Director)

```
sigma intent check

Structural Validation
────────────────────────
✓ Document structure
✓ Required sections
✓ Section order

Lock Requirements
────────────────────────
✓ Director Verdict
✓ Intent Core
✗ Scope Defined
✓ Success Criteria
✗ Execution Direction
✓ Risk Appetite

Result
Document is structurally valid.
Intent is NOT READY FOR LOCK (2 requirements unsatisfied).
```

### Task Breakdown — Bagian A — IMPLEMENTED (2026-07-14)

- [x] Tambah field terstruktur baru pada `SigmaDocCheckReport`:
  `requirements: SigmaDocRequirement[]` (`{ label, satisfied, scope: 'lock'
  | 'conditional' }`), diisi oleh gate isi-konten (verdict AUD intent/plan,
  Final Validation Checklist + Quality Bar intent, gate baru exec/close) —
  terpisah dari `errors`/`warnings`/`passes`. `report.ok` tetap murni dari
  `errors[]` — tidak pernah dari `requirements[]`.
- [x] Restrukturisasi parsing Final Validation Checklist — setiap baris
  checklist §13.1 dan setiap dimensi tabel Quality Bar §4 sekarang
  menghasilkan satu entri `requirements[]` sendiri, bukan satu pesan
  agregat. Item §13.2 "Conditional Requirement" sengaja tidak dimasukkan
  ke `requirements[]` sama sekali — template sendiri menyatakan
  `sigma intent lock` tidak mengevaluasinya.
- [x] Update `printSigmaDocReport()` — cetak section baru "Lock
  Requirements" dengan format checklist jelas (`✓ Label` / `✗ Label`),
  plus baris ringkasan "Document is structurally valid and all Lock
  Requirements are satisfied." / "NOT READY FOR LOCK (N requirement(s)
  unsatisfied)."
- [x] Semua gate isi-konten (AUD verdict, Final Checklist, exec verdict,
  close verdict + §9) sekarang **selalu** dievaluasi oleh
  `validateSigmaDocFile` — opsi `enforceVerdictGate`/
  `enforceFinalChecklistGate` (dan rencana `enforceExecVerdictGate`/
  `enforceCloseVerdictGate`) dihapus total, bukan sekadar di-default ke
  `true`. `check` dan `lock` di kelima domain memanggil
  `validateSigmaDocFile(absPath, domain)` dengan signature identik — tidak
  ada cara lagi untuk keduanya menghasilkan opsi berbeda, invariant A.5
  terjaga secara struktural, bukan karena disiplin manual.
- [x] `npm test` lulus.

### A.5 — Invariant Baru: Lock Validation Equivalence

Muncul dari diskusi lanjutan Director↔AUD pasca-draf awal plan ini.
Disepakati sebagai invariant wajib, bukan sekadar preferensi UX.

> **Lock Validation Equivalence**: Setiap lock requirement yang
> dievaluasi oleh `sigma {domain} lock` HARUS terlihat lewat
> `sigma {domain} check`. Dokumen yang melaporkan seluruh lock
> requirement sebagai satisfied TIDAK BOLEH gagal lock karena
> requirement yang sama itu.

Dua jenis kegagalan lock dibedakan secara eksplisit:

- **Jenis A — Requirement Failure** (dilarang terjadi jika check sudah
  hijau): `check` bilang semua requirement satisfied, lalu `lock` gagal
  karena requirement yang sama. Ini bug, bukan behavior yang sah.
- **Jenis B — Runtime Failure** (sah, di luar invariant): kegagalan
  lock karena state berubah setelah check dijalankan — lifecycle bukan
  DRAFT lagi, artifact sudah di-supersede, gate 2/3 chain berubah, race
  condition. Pengecekan ini sudah secara alami terpisah dari
  `validateSigmaDocFile` (ada di command handler, contoh:
  `intent.ts` baris ~84 "Active DIR-INTENT is not in DRAFT state") —
  jangan digabung ke dalam `requirements[]`, karena requirement harus
  stabil antara waktu check dan waktu lock; state lifecycle sengaja
  tidak stabil.

**Enforcement mechanism (wajib, bukan opsional)** — supaya invariant ini
tidak bergantung pada disiplin manual dan berpotensi diam-diam drift:

1. Satu fungsi evaluator (`validateSigmaDocFile` yang diperluas, atau
   fungsi baru `evaluateLockRequirements` yang dipanggil dari
   dalamnya) — **tidak ada logic gate versi check dan versi lock yang
   terpisah**.
2. `check` dan `lock` memanggil evaluator ini dengan opsi gate yang
   identik — tidak ada lagi `enforceVerdictGate: true` hanya di jalur
   lock.
3. `lock()` command tidak menulis ulang logic pass/fail sendiri — dia
   cukup membaca `report.requirements` dan gagal jika ada entri
   `satisfied: false`.
4. Tambahkan test eksplisit yang menegakkan invariant secara otomatis:
   untuk setiap domain, fixture dokumen yang lolos seluruh
   `requirements[]` pada `check` HARUS berhasil di `lock()` (kecuali
   sengaja disimulasikan Jenis B — mis. mengubah lifecycle state di
   antara check dan lock dalam test).

---

## Bagian B — DEV-EXEC Lock Requirement Gate (`exec lock`)

### Latar Belakang

- `DEV-EXEC` §15 "FMN Post-Build Review — Advisory Verdict" — 5 opsi
  (READY_FOR_LOCK / NEEDS_DEV_UPDATE / REVISION_REQUIRED /
  COMPLETE_WITH_RISK / OTHER) — sudah diisi FMN sesuai `FMN-RULE.md`
  ("Post-Build Test Review"), tapi `exec lock` tidak memvalidasi checkbox
  ini sama sekali. FMN bisa mencentang REVISION_REQUIRED (yang secara
  semantik berarti "belum siap") dan `sigma exec lock` tetap berhasil.
- §2 "DEV Readiness Status" dan §14 "DEV Completion Statement" juga punya
  checkbox verdict, tapi keduanya di linimasa sebelum/di tengah proses
  (bukan gate akhir sebelum lock) — kandidat lebih lemah dibanding §15 yang
  eksplisit bernama "Advisory Verdict" dengan opsi "READY_FOR_LOCK".

### Keputusan Director (2026-07-14)

**Opsi 1 — Verdict-agnostic.** `exec lock` hanya mensyaratkan tepat satu
checkbox tercentang di §15, apa pun isinya (termasuk REVISION_REQUIRED).
Alasan Director: FMN adalah advisory, bukan approval authority — kalau
REVISION_REQUIRED secara teknis memblokir `exec lock`, FMN secara de
facto berubah jadi veto authority, bertentangan dengan `FMN-RULE.md`
baris 172-178 ("FMN MUST NOT approve runtime state... only
Director-approved Sigma CLI operations mutate runtime state"). Yang
penting: tepat satu verdict tercatat dan terlihat Director lewat
`check` (lihat Bagian A) — kalau Director tetap ingin lock walau
verdict-nya REVISION_REQUIRED, itu hak Director.

Opsi 2 (verdict-aware) ditolak — dicatat di sini untuk jejak keputusan,
bukan untuk diimplementasikan.

### Task Breakdown — Bagian B — IMPLEMENTED (2026-07-14)

- [x] Perluas `docCheck.ts` — fungsi `evaluateExecVerdictGate`, scoped ke
  section `FMN_POST_BUILD_REVIEW`, sub-bagian "Advisory Verdict". Gate ini
  **verdict-agnostic**: satu checkbox tercentang dari lima opsi
  (READY_FOR_LOCK / NEEDS_DEV_UPDATE / REVISION_REQUIRED /
  COMPLETE_WITH_RISK / OTHER), isi checkbox tidak memengaruhi hasil gate.
  Implementasi aktual tidak memakai boolean option seperti draf awal
  (`enforceExecVerdictGate: true/false`) — gate ini selalu dievaluasi
  tanpa syarat oleh `validateSigmaDocFile`, konsisten dengan Lock
  Validation Equivalence (A.5): tidak ada cara untuk memanggil evaluator
  dengan opsi berbeda antara check dan lock, karena tidak ada opsi sama
  sekali lagi.
- [x] Wire ke `sigma exec check` dan `sigma exec lock` — otomatis aktif di
  keduanya tanpa perubahan wiring di `exec.ts` (kedua command sudah
  memanggil `validateSigmaDocFile(absPath, 'exec')` tanpa opsi sejak
  semula; `ensureSigmaDocEligible` di `exec lock` sudah menegakkan
  `requirements[]`).
- [x] Tidak perlu update `FMN-RULE.md` — tidak ada perubahan konsekuensi
  teknis dari isi verdict FMN, hanya syarat "verdict tercatat".
- [x] Test: `test/exec-close-verdict-gates.test.ts` — `exec lock` gagal saat
  0/>1 checkbox tercentang di §15; berhasil untuk verdict apa pun
  (termasuk REVISION_REQUIRED, diuji eksplisit) selama tepat satu
  tercentang. Diverifikasi juga secara live end-to-end (CLI manual run).
- [x] `npm test` lulus (133/133).

---

## Bagian C — DIR-CLOSE Lock Requirement Gate (`close lock`)

### Latar Belakang

- `DIR-CLOSE` §1 "Closure Decision" — 6 opsi (CLOSE_ACCEPTED /
  CLOSE_ACCEPTED_WITH_LIMITATIONS / DO_NOT_CLOSE / OPEN_NEW_PLAN /
  UPDATE_CURRENT_EXEC / OTHER) — temuan paling mencolok di plan ini: opsi
  "DO_NOT_CLOSE" secara eksplisit berarti "jangan tutup", tapi
  `sigma close lock` saat ini tidak peduli isi checkbox ini sama sekali.
- Domain ini paling jelas membutuhkan gate **verdict-aware** (bukan
  verdict-agnostic) — karena DO_NOT_CLOSE/OPEN_NEW_PLAN/UPDATE_CURRENT_EXEC
  secara harfiah berarti proyek tidak seharusnya di-lock sebagai closed.
  Kalau gate dibuat verdict-agnostic, `close lock` bisa "berhasil menutup
  proyek" padahal dokumennya sendiri bilang "jangan ditutup" — governance
  failure nyata, bukan sekadar preferensi desain.
- §9 "Final Director Decision" (Reason, Accepted Limitations, Required
  Follow-Up, Closure Sentence) — semua field naratif `[...]` — kandidat
  tambahan untuk gate "tidak boleh placeholder", mirip pola Quality Bar
  PLAN-EVAL-04 Bagian E.

### Keputusan Director (2026-07-14)

**Verdict-aware, disetujui penuh** — berbeda dari Bagian B. Alasan
Director: pemilik verdict §1 adalah Director sendiri (bukan advisory
role), dan pemilik authority `close lock` juga Director. Kalau Director
mencentang DO_NOT_CLOSE lalu `sigma close lock` tetap berhasil, itu CLI
mengabaikan keputusan Director sendiri — kontradiksi, bukan soal
advisory-vs-authority seperti Bagian B.

1. `close lock` hanya berhasil jika checkbox tercentang di §1 adalah
   CLOSE_ACCEPTED atau CLOSE_ACCEPTED_WITH_LIMITATIONS. Verdict lain —
   DO_NOT_CLOSE, OPEN_NEW_PLAN, UPDATE_CURRENT_EXEC, **dan OTHER**
   (OTHER diperlakukan sebagai golongan "belum siap"/memblokir, bukan
   otomatis dianggap verdict positif) — memblokir lock secara teknis.
2. §9 "Final Director Decision" juga ikut digate: field "Reason" dan
   "Closure Sentence" minimal tidak boleh kosong/placeholder (pola sama
   dengan Quality Bar PLAN-EVAL-04 Bagian E).

### Task Breakdown — Bagian C — IMPLEMENTED (2026-07-14)

- [x] Perluas `docCheck.ts` — fungsi `evaluateCloseVerdictGate`,
  verdict-aware terhadap §1 Closure Decision. Verdict "boleh lock":
  CLOSE_ACCEPTED, CLOSE_ACCEPTED_WITH_LIMITATIONS. Verdict "memblokir":
  DO_NOT_CLOSE, OPEN_NEW_PLAN, UPDATE_CURRENT_EXEC, OTHER. Sama seperti
  Bagian B, tidak memakai boolean option — selalu dievaluasi tanpa
  syarat (Lock Validation Equivalence, A.5).
- [x] Tambahkan fungsi `evaluateFinalDirectorDecisionGate` — cek §9 Final
  Director Decision, field "Reason" dan "Closure Sentence" tidak boleh
  placeholder (baris pertama isi setelah heading berupa `[...]`).
- [x] Wire ke `sigma close check` dan `sigma close lock` — otomatis aktif
  di keduanya tanpa perubahan wiring di `close.ts` (pola sama dengan
  Bagian B).
- [x] Ditinjau `Sigma/rules/AUD-RULE.md` §4 "DIR-CLOSE Audit" — doktrin
  "No evidence, no closure" adalah checklist kualitas naratif/evidence
  milik AUD (advisory), sepenuhnya ortogonal terhadap gate teknis CLI
  baru ini (checkbox verdict + non-placeholder §9). Tidak ada kontradiksi
  kalimat, tidak perlu perubahan di `AUD-RULE.md`.
- [x] Test: `test/exec-close-verdict-gates.test.ts` — `close lock` gagal
  saat verdict §1 termasuk golongan "jangan tutup" (DO_NOT_CLOSE dan
  OTHER diuji eksplisit); gagal saat Reason atau Closure Sentence §9
  masih placeholder (diuji terpisah); berhasil saat verdict
  CLOSE_ACCEPTED atau CLOSE_ACCEPTED_WITH_LIMITATIONS dan §9 terisi.
  Diverifikasi juga secara live end-to-end (CLI manual run, termasuk
  Close Lock Preflight dan auto-lock ROADMAP).
- [x] `npm test` lulus (133/133).

---

## Bagian D — ROADMAP: Keputusan Non-Scope

### Latar Belakang

- ROADMAP tidak punya standalone lock command — auto-locked sebagai efek
  samping `sigma close lock`.
- Isi ROADMAP (Overview prosa bebas, Core Process Flow diagram manual,
  Stage Overview auto-rendered dari `progress.json`) tidak punya struktur
  checkbox/verdict apa pun yang bisa dijadikan gate isi-konten.

### Keputusan Director (2026-07-14) — Dikonfirmasi

ROADMAP **tidak** mendapat gate isi-konten baru di plan ini. `sigma
roadmap check` tetap murni struktural seperti sekarang, hanya ikut
mendapat manfaat dari format laporan Bagian A (kalau ada bagian
struktural yang relevan ditampilkan lebih rapi) tanpa requirement
checklist tambahan.

---

## Isu Terbuka / Perlu Keputusan Director — SEMUA DIPUTUSKAN (2026-07-14)

1. **Bagian A** — **Diputuskan**: `check` (semua domain) ikut menjalankan
   seluruh gate isi-konten untuk preview, ditampilkan sebagai section
   "Lock Requirements" terpisah dari status pass/fail struktural. `check`
   **tidak** mengubah exit code — `report.ok` tetap murni struktural.
   Tambahan keputusan pasca-diskusi AUD: lihat invariant **Lock Validation
   Equivalence** di Bagian A.5 (check dan lock wajib memakai satu
   evaluator yang sama, bukan dua logic gate terpisah).
2. **Bagian B** — **Diputuskan**: verdict-agnostic (opsi 1). FMN adalah
   advisory, bukan approval authority — verdict-aware akan membuat FMN
   secara de facto jadi veto authority, bertentangan dengan `FMN-RULE.md`.
3. **Bagian C** — **Diputuskan**: verdict-aware. Verdict "boleh lock":
   CLOSE_ACCEPTED, CLOSE_ACCEPTED_WITH_LIMITATIONS. Verdict "memblokir":
   DO_NOT_CLOSE, OPEN_NEW_PLAN, UPDATE_CURRENT_EXEC, OTHER. §9 Final
   Director Decision juga digate (Reason & Closure Sentence tidak boleh
   placeholder). Alasan pembeda dari Bagian B: pemilik verdict §1 adalah
   Director sendiri, bukan advisory role — verdict-aware di sini menegakkan
   konsistensi Director terhadap keputusannya sendiri, bukan membiarkan
   role advisory membatasi authority Director.
4. **Bagian D** — **Dikonfirmasi**: ROADMAP tetap di luar scope plan ini.

---

## Dependency Catatan

- Bagian A adalah fondasi teknis (format pelaporan terstruktur) yang
  dipakai Bagian B dan C — sebaiknya dikerjakan lebih dulu.
- Bagian B dan C independen satu sama lain — bisa dikerjakan dalam urutan
  apa pun setelah Bagian A selesai.
- Bagian D tidak bergantung ke apa pun — murni keputusan "tidak
  dikerjakan", bisa diputuskan kapan saja.

---

## Risiko

- **Kontradiksi doktrin advisory-only — RESOLVED**: Diputuskan
  verdict-agnostic untuk Bagian B (FMN tetap advisory murni, tidak jadi
  veto authority) dan verdict-aware untuk Bagian C (verdict §1 dimiliki
  Director sendiri, jadi menegakkan konsistensi Director terhadap
  keputusannya sendiri — bukan role advisory yang membatasi authority
  Director). Pembedaan ini menjaga `FMN-RULE.md` tetap konsisten tanpa
  mengorbankan tujuan Bagian C. Lihat Isu Terbuka #2/#3 untuk detail.
- **Lock Validation Equivalence drift** (risiko baru, dari diskusi
  pasca-draf): Kalau `check` dan `lock` diimplementasikan sebagai dua
  blok logic gate terpisah yang "kebetulan" identik saat ini, invariant
  A.5 bisa diam-diam retak di perubahan berikutnya — `check` tetap
  hijau tapi `lock` gagal. Mitigasi wajib: satu evaluator dipanggil dari
  kedua command (bukan dua implementasi paralel), plus test eksplisit
  yang menegakkan invariant ini (lihat A.5 poin 4).
- Restrukturisasi `SigmaDocCheckReport` (Bagian A) menyentuh kode yang
  dipakai oleh seluruh 5 domain, dan sekarang juga mengubah `check`
  untuk selalu menjalankan gate isi-konten (sebelumnya hanya `lock`) —
  perlu dipastikan tidak meregresi laporan `errors`/`warnings`/`passes`
  yang sudah ada dan dites di `test/doc-check.test.ts` serta test lain
  yang memeriksa output `printSigmaDocReport()`, dan memastikan
  `report.ok`/exit code `check` tidak ikut berubah akibat gate baru ini.
- Restrukturisasi Final Validation Checklist ke per-item (bukan agregat)
  adalah scope tambahan di luar draf awal — effort lebih besar dari
  perkiraan semula pada task breakdown asli Bagian A.

---

## Acceptance Criteria — ALL MET (implemented 2026-07-14)

### Bagian A

- [x] `SigmaDocCheckReport` punya field `requirements` terstruktur, terpisah dari `errors`/`warnings`/`passes`.
- [x] `report.ok` (exit code `check`) tetap murni dihitung dari `errors[]` — tidak berubah akibat `requirements[]`.
- [x] `printSigmaDocReport()` mencetak section "Lock Requirements" dengan checklist ✓/✗ per item, plus ringkasan READY/NOT READY FOR LOCK.
- [x] Final Validation Checklist (dan gate checklist per-item lain yang relevan) menghasilkan satu entri `requirements[]` per baris, bukan satu pesan agregat.
- [x] `check` dan `lock` (semua 5 domain) memanggil evaluator gate yang sama tanpa opsi apa pun (Lock Validation Equivalence, A.5) — lebih ketat dari draf awal ("opsi identik"), opsi dihapus total.
- [x] Ada test yang menegakkan invariant A.5 (`test/exec-close-verdict-gates.test.ts`, describe block "Lock Validation Equivalence"): dokumen yang lolos seluruh `requirements[]` di `check` tidak pernah gagal `lock` karena requirement yang sama.
- [x] `npm test` lulus (133/133) — 4 assertion di `test/doc-check.test.ts` sengaja disesuaikan dengan format laporan baru (per-item ✓/✗), sisanya tidak diubah.

### Bagian B

- [x] `sigma exec check`/`sigma exec lock` menegakkan gate verdict-agnostic terhadap DEV-EXEC §15 Advisory Verdict (tepat satu checkbox tercentang, isi tidak dinilai). Diverifikasi live: REVISION_REQUIRED tetap lolos lock.
- [x] `npm test` lulus.

### Bagian C

- [x] `sigma close check`/`sigma close lock` menegakkan gate verdict-aware terhadap DIR-CLOSE §1 (CLOSE_ACCEPTED/CLOSE_ACCEPTED_WITH_LIMITATIONS lolos; DO_NOT_CLOSE/OPEN_NEW_PLAN/UPDATE_CURRENT_EXEC/OTHER memblokir). Diverifikasi live: DO_NOT_CLOSE diblokir, CLOSE_ACCEPTED berhasil.
- [x] §9 Final Director Decision (Reason, Closure Sentence) digate — tidak boleh placeholder.
- [x] `npm test` lulus.

### Bagian D

- [x] Dikonfirmasi Director: ROADMAP tetap di luar scope plan ini. Diverifikasi live: `roadmap check` tidak menampilkan section "Lock Requirements" sama sekali.

---

## Implementation Walkthrough (2026-07-14)

### Ringkasan

Diimplementasikan penuh oleh Professional Mode setelah otorisasi eksplisit
Director. Urutan kerja: Bagian A (fondasi) → Bagian B → Bagian C, sesuai
Dependency Catatan di atas. Total: 3 file kode diubah, 1 file kode baru
sengaja *tidak* diubah (lihat di bawah), 1 file test baru, 2 file test
diubah, `npm test` 133/133 lulus, diverifikasi live lewat CLI manual run
di luar lingkungan test.

### Apa yang Dibangun

**Bagian A — fondasi `docCheck.ts`.** `SigmaDocCheckReport` mendapat field
baru `requirements: SigmaDocRequirement[]` (`{ label, satisfied, scope }`),
terpisah total dari `errors`/`warnings`/`passes` yang tetap murni
struktural. Setiap gate isi-konten yang sebelumnya hidup di balik opsi
boolean (`enforceVerdictGate`, `enforceFinalChecklistGate`) direfaktor
jadi fungsi evaluator berdiri sendiri (`evaluateAudVerdictGate`,
`evaluateFinalChecklistGate`) yang **selalu** dipanggil oleh
`validateSigmaDocFile` — tidak ada lagi opsi sama sekali, bukan sekadar
di-default `true`.

**Bagian B — gate baru untuk EXEC.** `evaluateExecVerdictGate` mengecek
section `FMN_POST_BUILD_REVIEW` (DEV-EXEC §15) — tepat satu dari lima
checkbox (READY_FOR_LOCK/NEEDS_DEV_UPDATE/REVISION_REQUIRED/
COMPLETE_WITH_RISK/OTHER) harus tercentang. Verdict-agnostic murni: isi
checkbox tidak pernah memengaruhi hasil `satisfied`.

**Bagian C — gate baru untuk CLOSE.** Dua fungsi baru:
`evaluateCloseVerdictGate` (verdict-aware terhadap DIR-CLOSE §1 —
CLOSE_ACCEPTED/CLOSE_ACCEPTED_WITH_LIMITATIONS lolos, empat lainnya
termasuk OTHER memblokir) dan `evaluateFinalDirectorDecisionGate`
(§9 — "Reason" dan "Closure Sentence" tidak boleh baris placeholder
`[...]`, dideteksi dengan mengambil baris non-kosong pertama setelah
masing-masing heading H3 dan mencocokkan pola `^\[.*\]$`).

### Keputusan Implementasi Kunci: Menghapus Opsi, Bukan Men-default-kannya

Draf task awal (lihat Task Breakdown asli sebelum diedit) membayangkan
opsi baru `enforceExecVerdictGate`/`enforceCloseVerdictGate` yang di-set
`true` di kedua pemanggilan check dan lock. Saat implementasi, pendekatan
itu diganti dengan menghapus parameter opsi dari `validateSigmaDocFile`
sepenuhnya — signature-nya sekarang `validateSigmaDocFile(absPath,
domain)`, titik. Alasannya langsung dari invariant Lock Validation
Equivalence (A.5): kalau opsi masih ada sebagai parameter (walau
defaultnya `true`), tetap ada *kemungkinan* struktural bagi seseorang di
masa depan memanggilnya dengan opsi berbeda antara check dan lock. Dengan
opsi dihapus total, kemungkinan itu tidak ada lagi secara sintaksis — Lock
Validation Equivalence jadi dijamin oleh compiler, bukan oleh disiplin
code review.

Konsekuensi praktis dari keputusan ini: `src/commands/exec.ts` dan
`src/commands/close.ts` **tidak disentuh sama sekali**. Kedua command
sudah memanggil `validateSigmaDocFile(absPath, domain)` tanpa opsi dan
sudah memakai `ensureSigmaDocEligible()` di jalur lock sejak sebelum plan
ini — begitu gate baru ditambahkan ke evaluator inti, keduanya otomatis
ikut menegakkannya tanpa satu baris pun diubah di command layer.

### Main Flow

1. `validateSigmaDocFile(absPath, domain)` parse marker struktural seperti
   sebelumnya (tidak berubah) → hasil ke `errors`/`warnings`/`passes`.
2. Setelah itu, tanpa syarat: `evaluateAudVerdictGate` (intent + plan),
   lalu `if (domain === 'intent') evaluateFinalChecklistGate`, lalu
   `if (domain === 'exec') evaluateExecVerdictGate`, lalu
   `if (domain === 'close') { evaluateCloseVerdictGate;
   evaluateFinalDirectorDecisionGate }` — semua menulis ke array
   `requirements` yang sama.
3. `report.ok` dihitung dari `errors.length === 0` saja — tidak pernah
   menyentuh `requirements`.
4. `printSigmaDocReport()` mencetak dua blok terpisah: "Structural
   Validation" (format lama, tidak berubah) lalu "Lock Requirements"
   (baru, satu baris `✓`/`✗` per item), diikuti baris `Result:` (murni
   struktural) dan `Lock readiness:` (struktural DAN semua requirement
   satisfied).
5. `ensureSigmaDocEligible(report, command)` — dipanggil hanya dari
   `lock` — melempar error kalau `!report.ok` (pesan lama, tidak
   berubah) ATAU kalau ada `requirements` yang `satisfied: false` (pesan
   baru, mendaftar tiap requirement yang belum terpenuhi).

### Detail Non-Trivial

- **Item §13.2 "Conditional Requirement" sengaja dikecualikan total** dari
  `requirements[]`, bukan dimasukkan dengan `scope: 'conditional'`.
  Template sendiri menyatakan eksplisit "`sigma intent lock` does not
  evaluate them" — memasukkannya ke `requirements[]` (bahkan sebagai
  item non-blocking) akan bertentangan dengan kalimat itu dan membuat
  Director bingung kenapa ada `✗` yang tidak pernah relevan untuk lock.
- **`scope: 'conditional'` yang benar-benar dipakai** hanya satu kasus:
  requirement "Director Instruction (verbatim) recorded for
  SKIP_FOR_AUDIT" — entri ini hanya ditambahkan ke array sama sekali
  kalau verdict SKIP_FOR_AUDIT yang tercentang. Kalau verdict lain yang
  dipilih, entri ini tidak muncul di `requirements[]` — bukan muncul
  dengan `satisfied: true` secara otomatis.
- **Restrukturisasi Final Validation Checklist ke per-item** ternyata
  scope lebih besar dari draf awal (dicatat eksplisit di keputusan
  Director untuk Isu Terbuka tambahan) — parsing checkbox individual
  §13.1 dan parsing tabel Quality Bar §4 per-dimensi masing-masing
  menghasilkan entri `requirements[]` sendiri, bukan satu pesan agregat
  seperti implementasi lama.

### Testing Walkthrough

- `npm run build` (tsc) harus dijalankan manual sebelum `npx vitest run`
  — `package.json`'s `"test"` script TIDAK me-rebuild otomatis, dan
  `test/helpers.ts` menjalankan CLI lewat `dist/cli.js` yang sudah
  di-compile, bukan source TypeScript langsung. Baris pertama percobaan
  test run tanpa build ulang lolos "palsu" (hijau) karena diam-diam
  menguji build lama — ditemukan dan dikoreksi sebelum melanjutkan.
- 4 assertion di `test/doc-check.test.ts` diupdate untuk mencocokkan
  format laporan baru (per-item `✓`/`✗` menggantikan pesan agregat lama).
  7 assertion lain di file yang sama tidak diubah sama sekali — pesan
  warning untuk kasus AUD verdict (0 checked / >1 checked / SKIP_FOR_AUDIT
  kosong) sengaja dipertahankan identik di implementasi baru supaya tidak
  perlu diubah.
- File test baru `test/exec-close-verdict-gates.test.ts` (11 test) dan
  fixture baru di `test/helpers.ts` (`validExecDoc`, `validCloseDoc`,
  `makeProgressWithDraftExec`, `makeProgressWithDraftClose`) — termasuk
  dua test eksplisit untuk invariant Lock Validation Equivalence (A.5):
  satu membuktikan `check` dan `lock` melaporkan requirement unsatisfied
  yang sama persis untuk dokumen yang sama, satu lagi membuktikan dokumen
  yang `check`-nya melaporkan "semua Lock Requirements satisfied" tidak
  pernah gagal `lock` karena requirement.
- **Verifikasi live di luar test harness**: proyek scratch dibuat dengan
  `sigma project start`, lalu dijalankan penuh intent → plan → exec →
  close secara manual lewat CLI (bukan lewat `runCli()` test helper),
  termasuk kasus FMN mencentang REVISION_REQUIRED di DEV-EXEC §15 (tetap
  berhasil `exec lock` — verdict-agnostic terbukti) dan Director
  mencentang DO_NOT_CLOSE di DIR-CLOSE §1 (memblokir `close lock` —
  verdict-aware terbukti), lalu diperbaiki ke CLOSE_ACCEPTED dengan §9
  terisi (berhasil, termasuk Close Lock Preflight dan auto-lock ROADMAP).
- **False alarm yang ditemukan dan diselesaikan selama verifikasi live**:
  percobaan manual pertama memakai `$HOME` asli operator (bukan `$HOME`
  terisolasi seperti test harness), dan `sigma intent new` mengambil
  template dari `~/.sigma/templates/DIR-INTENT-TEMPLATE.md` — instalasi
  global lama yang mendahului fitur SKIP_FOR_AUDIT dan struktur §13.1/
  §13.2 di repo ini (`resolveTemplate()` di `src/utils/artifacts.ts`
  memprioritaskan `GLOBAL_TEMPLATES_DIR` di atas template bundled repo).
  Ini sempat terlihat seperti bug (item §13.2 ikut ter-gate), tapi setelah
  diverifikasi dengan `$HOME` bersih (`sigma setup install` di direktori
  temp baru), perilakunya benar. Bukan regresi kode — murni staleness
  lingkungan pengujian milik operator, dicatat di sini supaya tidak
  membingungkan pembaca log implementasi di masa depan.

### Rollout ke Instruksi Governance AI Role (permintaan Director susulan,
sama sesi)

Setelah Bagian A membuat `check` benar-benar merepresentasikan kesiapan
lock ("Lock Readiness dashboard"), Director meminta audit menyeluruh
terhadap seluruh rule file, role memory, dan skill per role, untuk
memastikan setiap instruksi AI yang merekomendasikan/menjalankan
`sigma {domain} lock` juga diinstruksikan menjalankan
`sigma {domain} check` lebih dulu. 28 file diperbarui secara konsisten:

- `Sigma/rules/{ARC,FMN,DEV}-RULE.md` — tabel "Commands ... Read-only"
  menambahkan `{domain} check`; kalimat "MUST NOT run ... until Director
  gives explicit approval" mendapat kalimat susulan yang mewajibkan
  `check` dijalankan dan `Lock readiness: Eligible` dikonfirmasi lebih
  dulu. `AUD-RULE.md` sengaja tidak disentuh — AUD tidak pernah
  merekomendasikan atau menjalankan lock sama sekali.
- `Sigma/role-memory/{arc,fmn,dev}-memory.json` — satu entri
  `role_specific` baru per file dengan instruksi yang sama secara
  ringkas. `aud-memory.json` tidak disentuh untuk alasan yang sama.
- `Sigma/SIGMA_PROTOCOL.md` §16A "CLI Operator Model" — sumber doktrin
  master: tabel Command Authority Classes menambahkan lima command
  `{domain} check` ke kelas Read-only, dan subsection baru "Pre-Lock
  Verification Rule" ditambahkan sebelum "Director Convenience Rule".
- Skill file `arc`/`fmn`/`dev` di keempat platform bundle
  (`setup/targets/{claude_code,reasonix,codex,antigravity}`) — subsection
  baru "Pre-lock verification (required)" ditambahkan tepat sebelum
  "Approval prompt format" di tiap file (12 file, konten identik per
  role lintas platform, diverifikasi dengan `diff` tidak ada divergensi
  baru selain perbedaan `name:` frontmatter yang memang sudah ada
  sebelumnya untuk antigravity). Skill `aud`/`checkpoint`/`cso`/`report`
  tidak disentuh — tidak satu pun punya alur rekomendasi lock.
- File bridge root-level dan template (`CLAUDE.md`, `AGENTS.md`,
  `GEMINI.md`, `DEEPSEEK.md`, `REASONIX.md` di root proyek, dan
  duplikatnya di `setup/targets/bridge/`) — pola "Pre-Lock Verification"
  yang sama ditambahkan ke section CLI Operator Model masing-masing;
  `REASONIX.md`/`DEEPSEEK.md`-nya Reasonix punya struktur "Sigma Shell
  Whitelist" tersendiri (bukan tabel authority class), jadi lima command
  `{domain} check` ditambahkan langsung ke whitelist itu.

Perubahan rollout ini murni dokumentasi/instruksi (Markdown + JSON) — tidak
menyentuh kode `src/`, tidak memerlukan `npm run build` ulang, dan tidak
mengubah perilaku CLI itu sendiri. Efeknya baru terasa saat AI role
membaca ulang file-file ini di sesi berikutnya (untuk deployment
`setup/targets/*` ke proyek lain, efeknya baru aktif setelah Director
menjalankan `sigma setup install`/`sigma setup sync` ulang di proyek
tujuan — di luar scope sesi ini).

### Ringkasan File Berubah

- Kode: `src/utils/docCheck.ts` (restrukturisasi besar — lihat A.5),
  `src/commands/intent.ts` & `src/commands/plan.ts` (hapus opsi gate,
  tidak lagi diperlukan). `src/commands/exec.ts` & `src/commands/close.ts`
  sengaja tidak diubah (lihat "Keputusan Implementasi Kunci" di atas).
- Test baru: `test/exec-close-verdict-gates.test.ts` (11 test). Test
  diubah: `test/doc-check.test.ts` (4 assertion). Fixture baru di
  `test/helpers.ts`: `validExecDoc`, `validCloseDoc`,
  `makeProgressWithDraftExec`, `makeProgressWithDraftClose`.
- `npm test`: 133/133 lulus (21 file test).
- Governance rollout: 28 file rules/memory/skill/bridge diperbarui
  (rincian di subsection "Rollout" di atas).
