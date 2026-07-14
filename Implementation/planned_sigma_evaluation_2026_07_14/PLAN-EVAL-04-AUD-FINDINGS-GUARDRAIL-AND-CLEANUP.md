# PLAN-EVAL-04 — Pelonggaran Guardrail AUD Findings & Penghapusan Command Family `appendAuditFindings`

**Sumber**: `Discussion/sigma-system-evaluation-2026-07-14.md` (Topik 2, Topik 3)
**Tanggal**: 2026-07-14
**Status**: Bagian A, B, C, D, E — IMPLEMENTED (2026-07-14, `npm test` lulus 20 file/122 test).
**Urutan eksekusi**: 4 dari 8 (lihat `README.md` di folder ini)
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN, tidak punya otoritas lock/gate Sigma. Bagian C ditambahkan setelah sesi diskusi lanjutan pasca-implementasi Bagian A/B — bukan bagian dari Topik 2/3 sumber asli, murni ide baru dari Director.

---

## Objective

Menggabungkan dua topik yang secara eksplisit beririsan: pelonggaran guardrail
penulisan section "AUD Findings" (Topik 2) dan penghapusan 4 command
`appendAuditFindings` (Topik 3). Guardrail baru di template harus tersedia
lebih dulu sebelum satu-satunya jalur lama (command CLI) dihapus, supaya tidak
ada gap di mana Director kehilangan cara sah mengisi section ini.

---

## Bagian A — Pelonggaran Guardrail "AUD Findings"

### Latar Belakang

- Section "AUD Findings" di DIR-INTENT dan FMN-PLAN cenderung kosong atau
  cepat basi — root cause: AUD yang dipakai Director biasanya AI pasif
  eksternal (Claude web, ChatGPT web), hasil auditnya di-copy-paste manual
  oleh Director, bukan role agentic ber-CLI.
- `FMN-PLAN-TEMPLATE.md` Section 7 ([FMN-PLAN-TEMPLATE.md:108-109](../../Sigma/templates/FMN-PLAN-TEMPLATE.md#L108-L109)) melarang eksplisit tanpa pengecualian: *"FMN and DEV must not write in this section."*
- `appendAuditFindings()` ([artifacts.ts:22-26](../../src/utils/artifacts.ts#L22-L26)) menghasilkan blok generik identik untuk DIR-INTENT dan FMN-PLAN — **tanpa field Verdict/checkbox sama sekali**. Checkbox verdict terstruktur (PASS/PASS_WITH_RISK/REVISE/REJECT_RECOMMENDED/PROMOTE_TO_HEAVIER_PROCESS/OTHER) hanya ada di template statis awal DIR-INTENT Section 12.2 — ronde audit berikutnya via CLI tidak membawa checkbox ini, kemungkinan akar nyata kenapa "audit lama tercatat, ronde baru tidak".

### Keputusan (dari sesi evaluasi)

1. Guardrail "FMN and DEV must not write in this section" **dilonggarkan**
   menjadi: **ARC dan FMN boleh** mengisi/menulis section AUD Findings (di
   DIR-INTENT maupun FMN-PLAN), dengan sumber sah salah satu dari: (a) pesan
   `sigma message`/mailbox langsung dari AUD, atau (b) Director menyampaikan
   hasil audit di sesi chat.
2. **DEV tetap tidak diberi akses** — cakupan pelonggaran hanya ARC dan FMN.
3. Konten narasi (Findings/Major Findings) **boleh berupa interpretasi**
   ARC/FMN terhadap hasil audit — tidak wajib verbatim copy-paste.
4. **Verdict tidak boleh diubah** oleh ARC/FMN — harus persis seperti yang
   disampaikan AUD. Guardrail tertulis di template, bukan validasi teknis baru.
5. Format checkbox verdict **disamakan** antara DIR-INTENT dan FMN-PLAN —
   FMN-PLAN mengikuti struktur checkbox yang sudah ada di DIR-INTENT Section
   12.2.
6. Perbaikan checkbox verdict berlaku di **dua tempat**: template statis awal,
   dan fungsi `appendAuditFindings()` — supaya setiap ronde audit baru
   konsisten menyertakan checkbox verdict yang sama.

### Task Breakdown — Bagian A

- [x] Update `Sigma/templates/FMN-PLAN-TEMPLATE.md` Section 7: tambahkan struktur checkbox verdict identik dengan DIR-INTENT Section 12.2; revisi kalimat guardrail dari larangan total menjadi carve-out ARC/FMN.
- [x] Update `Sigma/templates/DIR-INTENT-TEMPLATE.md` Section 12: tambahkan kalimat guardrail eksplisit (checkbox verdict tidak boleh diubah ARC, narasi boleh interpretasi).
- [x] ~~Update `appendAuditFindings()` di `src/utils/artifacts.ts`~~ — Director memilih one-pass (lihat Keputusan Sequencing di bawah), langkah ini dilewati, langsung ke penghapusan fungsi di Bagian B.
- [x] Update `Sigma/rules/FMN-RULE.md` dan `Sigma/rules/ARC-RULE.md`: subsection baru "AUD Findings Section Authorization" — ARC/FMN boleh mengisi, sumber sah (`sigma send`/`sigma inbox` mailbox AUD, atau relay Director di chat), verdict tidak boleh diubah, narasi boleh interpretasi.

**Keputusan Sequencing (dikonfirmasi Director)**: Bagian A dan Bagian B
dikerjakan sekaligus dalam satu pass, tanpa jeda rilis — langkah opsional
"update `appendAuditFindings()` dengan checkbox sebelum dihapus" dilewati
karena fungsinya toh dihapus total di Bagian B pada sesi yang sama.

**Temuan tambahan saat implementasi** (di luar task breakdown asli, dikerjakan
karena relevan langsung dengan tujuan "tidak ada command mati/dangling
reference"):
- 4 file `setup/targets/*/aud.md` / `SKILL.md` (claude_code, reasonix,
  antigravity, codex) menyebut `sigma plan audit` sebagai contoh command —
  diperbaiki ke `sigma git evidence`.
- `Sigma/SIGMA_PROTOCOL.md` §16 CLI Command Surface: deskripsi domain
  `intent`/`plan`/`exec`/`close` masih menyebut `review`/`audit` sebagai
  action yang tersedia — diperbaiki.
- `src/engine/progress.ts` fungsi `getNextValidOperations()` masih
  menyarankan `intent review` sebagai next-valid-operation — dihapus (dead
  suggestion setelah command-nya tidak ada).

### Implementation Walkthrough — Bagian A

| File | Perubahan |
| :--- | :--- |
| `Sigma/templates/DIR-INTENT-TEMPLATE.md` | Section 12 header: tambah callout "Who may write this section" (sumber sah: `sigma send`/`sigma inbox` mailbox AUD, atau relay Director di chat) dan "Verdict integrity" (checkbox tidak boleh diubah, narasi boleh interpretasi), ditempatkan sebelum §12.1. |
| `Sigma/templates/FMN-PLAN-TEMPLATE.md` | Section 7: kalimat guardrail lama ("FMN and DEV must not write in this section") diganti carve-out ARC/FMN + callout yang sama seperti DIR-INTENT. Ditambah subsection baru §7.1 "AUD Advisory Verdict" — checkbox list (PASS/PASS_WITH_RISK/REVISE/REJECT_RECOMMENDED/PROMOTE_TO_HEAVIER_PROCESS/OTHER) + Major Findings + Recommended Director Action, identik struktur DIR-INTENT §12.2. |
| `Sigma/rules/ARC-RULE.md` | Subsection baru "AUD Findings Section Authorization" (setelah "DIR-INTENT Creation Rules"). Baris `sigma intent review` dihapus dari tabel CLI Operation Policy; kalimat kelas operasi disesuaikan jadi "Draft/Operational" saja (kelas Advisory sudah tidak relevan bagi ARC). |
| `Sigma/rules/FMN-RULE.md` | Subsection baru "AUD Findings Section Authorization" (setelah "FMN-PLAN Creation Rules"). Baris `sigma plan audit`/`exec audit`/`close audit` dihapus dari tabel CLI Operation Policy; kalimat kelas operasi disesuaikan sama seperti ARC-RULE.md. |

**Koreksi mid-implementasi**: draf awal saya sempat memakai istilah "sigma message" (ikut penyebutan longgar di notulen diskusi) untuk merujuk jalur mailbox AUD di keempat file di atas plus `SIGMA_PROTOCOL.md`. Dikoreksi ke nama command sebenarnya, `sigma send`/`sigma inbox`, setelah verifikasi tidak ada command bernama `sigma message` di codebase (`src/commands/inbox.ts` yang benar-benar ada).

---

## Bagian B — Penghapusan Command Family `appendAuditFindings`

### Latar Belakang

Empat command identik mekanismenya, semua memanggil `appendAuditFindings()`
yang sama ([artifacts.ts:22-26](../../src/utils/artifacts.ts#L22-L26)) — murni
append teks, tidak menyentuh lock/gate state (`assertProgressCanMutate` hanya
cek mutability):

| Command | File | Artefak target |
| :--- | :--- | :--- |
| `sigma intent review` | [intent.ts:75](../../src/commands/intent.ts#L75) | DIR-INTENT |
| `sigma plan audit` | [plan.ts:151](../../src/commands/plan.ts#L151) | FMN-PLAN |
| `sigma exec audit` | [exec.ts:124](../../src/commands/exec.ts#L124) | DEV-EXEC |
| `sigma close audit` | [close.ts:120](../../src/commands/close.ts#L120) | DIR-CLOSE |

**Penilaian risiko**: rendah — tidak berdampak ke gate chain/lock integrity.
Nilai yang hilang hanya kenyamanan (auto header + timestamp), sudah
tergantikan oleh Bagian A (ARC/FMN boleh menulis section langsung).

### Keputusan

Hapus **keempat command** sekaligus — bukan hanya yang dibahas awal (`intent
review`, `plan audit`) — untuk menjaga konsistensi keluarga command, karena
mekanismenya identik dan sama-sama redundan setelah Bagian A.

### Task Breakdown — Bagian B

- [x] Hapus subcommand `review` di `src/commands/intent.ts`.
- [x] Hapus subcommand `audit` di `src/commands/plan.ts`.
- [x] Hapus subcommand `audit` di `src/commands/exec.ts`.
- [x] Hapus subcommand `audit` di `src/commands/close.ts`.
- [x] Hapus fungsi `appendAuditFindings()` di `src/utils/artifacts.ts` (dead code setelah ke-4 caller dihapus).
- [x] Update test `test/command-helper-regression.test.ts:32` — blok test `intent review` dihapus seluruhnya (bukan disesuaikan, karena mekanismenya hilang total).
- [x] Update `README.md` — hapus baris tabel command (`plan audit`, `exec audit`, `close audit`). `intent review` dikonfirmasi tidak terdaftar di tabel README.
- [x] Update `Sigma/SIGMA_PROTOCOL.md` — tabel "Invocation commands" §15 diganti paragraf pengganti (jalur manual write ARC/FMN); kelas "Advisory" **dihapus** dari tabel "Command Authority Classes" (keputusan Director: tidak dipertahankan sebagai kategori kosong).
- [x] Review manual `Sigma/rules/ARC-RULE.md`, `AUD-RULE.md`, `FMN-RULE.md` — baris tabel CLI Operation Policy yang mengarah ke command terhapus sudah dibersihkan; `AUD-RULE.md` contoh command `sigma plan audit` diganti `sigma git evidence`.
- [x] Review `Sigma/role-memory/aud-memory.json` — dicek, tidak ada referensi ke command yang dihapus, tidak perlu perubahan.

### Implementation Walkthrough — Bagian B

| File | Perubahan |
| :--- | :--- |
| `src/utils/artifacts.ts` | Fungsi `appendAuditFindings()` dihapus total (dead code setelah ke-4 caller-nya dihapus). |
| `src/commands/intent.ts` | Subcommand `review` dihapus. Import `appendAuditFindings` dihapus dari `../utils/artifacts`; import `fs` (sudah tidak dipakai di file ini setelah subcommand dihapus) juga dihapus. |
| `src/commands/plan.ts` | Subcommand `audit` dihapus. Import `appendAuditFindings` dihapus (import `fs` tetap dipertahankan — masih dipakai di `promote`/`supersede`). |
| `src/commands/exec.ts` | Subcommand `audit` dihapus. Import `appendAuditFindings` dihapus (import `fs` tetap dipertahankan — masih dipakai di `new`). |
| `src/commands/close.ts` | Subcommand `audit` dihapus. Import `appendAuditFindings` dihapus (import `fs` tetap dipertahankan — masih dipakai di `new` untuk stale-intent ack note). |
| `src/engine/progress.ts` | `getNextValidOperations()`: blok `ops.push('intent review')` dihapus (dead suggestion, tidak ada test yang bergantung padanya). |
| `test/command-helper-regression.test.ts` | Test `'audit helper preserves advisory append content'` (menguji `intent review`) dihapus seluruhnya — bukan disesuaikan, karena mekanismenya hilang total. Test `'template helper preserves intent new output...'` dipertahankan apa adanya. |
| `README.md` | 3 baris tabel command dihapus: `plan audit`, `exec audit`, `close audit`. (`intent review` dikonfirmasi tidak pernah terdaftar di tabel README, hanya di SIGMA_PROTOCOL.) |
| `Sigma/SIGMA_PROTOCOL.md` | §15: tabel "Invocation commands" diganti paragraf "Recording AUD Findings" (jalur manual write ARC/FMN). §16A "Command Authority Classes": baris kelas "Advisory" dihapus total (keputusan Director — tidak dipertahankan sebagai kategori kosong). §16 "CLI Command Surface": deskripsi domain `intent`/`plan`/`exec`/`close` — `review`/`audit` dihapus dari daftar action. |
| `Sigma/rules/AUD-RULE.md` | CLI Operation Policy: `sigma plan audit` dihapus dari daftar contoh command yang boleh direkomendasikan AUD (sisa: `session bootstrap`, `project status`, `git evidence`). |
| `setup/targets/claude_code/aud.md`, `setup/targets/reasonix/aud.md`, `setup/targets/antigravity/sigma-aud/SKILL.md`, `setup/targets/codex/aud/SKILL.md` | Baris contoh command `sigma plan audit` diganti `sigma git evidence` (temuan tambahan — 4 salinan platform-spesifik AUD-RULE.md yang tidak tercakup di task breakdown asli maupun PLAN-EVAL-08, dikonfirmasi Director untuk dimasukkan ke scope PLAN-EVAL-04 ini). |

**Evidence**:
- `npm run build` (tsc) — bersih, tanpa error.
- `npm test` — 20 file test, 113 test, seluruhnya PASS, tidak ada regresi.
- Verifikasi grep menyeluruh (`src/`, `Sigma/`, `setup/`, `test/`, `README.md`) mengonfirmasi tidak ada sisa referensi ke `appendAuditFindings`, `intent review`, `plan audit`, `exec audit`, `close audit` di luar `dist/` (build artifact, regenerated) dan dokumen historis `Discussion/`/`Implementation/` (catatan diskusi, sengaja tidak diubah — bukan spec aktif).

---

## Bagian C — `SKIP_FOR_AUDIT` Verdict Gate (INTENT & PLAN Lock Only)

**Sumber**: Sesi diskusi lanjutan pasca-implementasi Bagian A/B (2026-07-14).
Bukan bagian dari Topik 2/3 sumber asli — ide baru dari Director untuk
menutup celah "section AUD Findings kosong/basi" secara struktural, tanpa
melanggar doktrin AUD advisory-only.

### Latar Belakang

- Bagian A melonggarkan guardrail supaya ARC/FMN boleh mengisi section AUD
  Findings, tapi tidak ada yang memaksa section itu benar-benar terisi
  sebelum lock — root cause asli (section kosong/basi) masih bisa terjadi.
- Menjadikan checkbox verdict sebagai gate lock murni (mis. "harus PASS baru
  boleh lock") akan bertentangan dengan doktrin inti: AUD tidak boleh
  menjadi gatekeeper runtime, dan AUD *optional by default* (`SIGMA_PROTOCOL.md`
  §15 — hanya mandatory jika proyek ditandai risk-sensitive).
- Solusi yang disepakati: tambahkan opsi verdict baru `SKIP_FOR_AUDIT` yang
  merepresentasikan **keputusan Director**, bukan verdict AUD. Gate hanya
  menegakkan bahwa *sebuah keputusan Director sudah direkam* — bukan
  menegakkan bahwa audit tertentu terjadi.

### Keputusan (dari sesi diskusi)

1. Tambahkan opsi checkbox baru `SKIP_FOR_AUDIT` ke daftar verdict yang sudah
   ada di DIR-INTENT §12.2 dan FMN-PLAN §7.1 (lokasi dan pengisi sama —
   ARC/FMN, tidak ada struktur/section terpisah).
2. Tambahkan field "Director Instruction (verbatim)" tepat di bawah opsi
   `SKIP_FOR_AUDIT`, diisi ARC/FMN dengan transkrip kata-kata Director apa
   adanya (bukan parafrase) — ini jadi jejak bukti bahwa approval memang
   diberikan.
3. Gate diterapkan dua lapis, hanya pada `sigma intent lock` dan
   `sigma plan lock`:
   - **Lapis 1**: tepat satu checkbox tercentang di antara seluruh opsi
     verdict (PASS/PASS_WITH_RISK/REVISE/REJECT_RECOMMENDED/
     PROMOTE_TO_HEAVIER_PROCESS/OTHER/SKIP_FOR_AUDIT). Nol tercentang atau
     lebih dari satu tercentang → lock gagal.
   - **Lapis 2**: jika checkbox yang tercentang adalah `SKIP_FOR_AUDIT`,
     field "Director Instruction (verbatim)" tidak boleh kosong atau berupa
     placeholder `[...]` → jika kosong, lock gagal.
4. Aturan prosedural (bukan penegakan teknis, sama seperti pola
   `--ack-stale-intent` yang sudah ada): ARC/FMN **dilarang** mencentang
   `SKIP_FOR_AUDIT` tanpa instruksi eksplisit Director di sesi yang sama.
   Jika section masih kosong dan lock diinginkan, ARC/FMN wajib bertanya ke
   Director dulu — mau audit AUD sungguhan, atau approve skip untuk siklus
   lock ini. Ini berlaku juga di proyek risk-sensitive — tidak perlu
   larangan teknis terpisah karena eskalasi ke Director sudah wajib di
   kedua jalur.
5. `SKIP_FOR_AUDIT` **tidak** ditambahkan ke daftar kanonik "Advisory
   Verdicts" di `AUD-RULE.md` — itu bukan keluaran AUD, murni keputusan
   Director yang direkam di checkbox artefak.
6. **Scope dikonfirmasi Director**: hanya `sigma intent lock` dan
   `sigma plan lock`. Sudah dicek — tidak ada template lain (DEV-EXEC,
   DIR-CLOSE, ROADMAP, CSO) yang punya section AUD Findings/verdict
   berstruktur checkbox seperti di DIR-INTENT/FMN-PLAN, jadi tidak ada
   section lain yang perlu diperluas atau dihapus.

### Task Breakdown — Bagian C

- [x] Tambahkan opsi `SKIP_FOR_AUDIT` + field "Director Instruction
  (verbatim): [...]" ke checkbox list `Sigma/templates/DIR-INTENT-TEMPLATE.md`
  §12.2.
- [x] Tambahkan opsi `SKIP_FOR_AUDIT` + field "Director Instruction
  (verbatim): [...]" ke checkbox list `Sigma/templates/FMN-PLAN-TEMPLATE.md`
  §7.1 (identik dengan DIR-INTENT).
- [x] Perluas `validateSigmaDocFile()` di `src/utils/docCheck.ts`: dalam
  section verdict (12.2 untuk domain intent, 7.1 untuk domain plan), hitung
  checkbox tercentang — wajib tepat 1, error jika 0 atau >1.
- [x] Tambahkan pengecekan lapis kedua di validator yang sama: jika checkbox
  tercentang adalah `SKIP_FOR_AUDIT`, pastikan field "Director Instruction
  (verbatim)" terisi (bukan kosong, bukan placeholder `[...]`) — error jika
  tidak.
- [x] Pastikan error baru ini otomatis memblokir `sigma intent lock` /
  `sigma plan lock` lewat mekanisme `ensureSigmaDocEligible()` yang sudah
  ada — tidak perlu call-site baru, gate diaktifkan lewat parameter opsional
  baru `{ enforceVerdictGate: true }` yang hanya dipasang di `lock`.
- [x] Update `Sigma/rules/ARC-RULE.md` dan `Sigma/rules/FMN-RULE.md`
  subsection "AUD Findings Section Authorization" (ditambahkan di Bagian
  A): tambahkan larangan eksplisit mencentang `SKIP_FOR_AUDIT` tanpa
  instruksi Director eksplisit di sesi yang sama, dan kewajiban eskalasi
  (tanya Director: audit sungguhan atau approve skip) ketika section kosong
  dan lock diinginkan.
- [x] Tambahkan/sesuaikan test: `intent lock`/`plan lock` gagal saat nol
  checkbox tercentang; gagal saat lebih dari satu tercentang; gagal saat
  `SKIP_FOR_AUDIT` tercentang tapi field verbatim kosong; berhasil saat
  `SKIP_FOR_AUDIT` tercentang dengan field verbatim terisi; berhasil saat
  verdict AUD asli (mis. PASS) tercentang.
- [x] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja
  disesuaikan di tahap ini.

### Implementation Walkthrough — Bagian C

| File | Perubahan |
| :--- | :--- |
| `Sigma/templates/DIR-INTENT-TEMPLATE.md` | §12.2: tambah opsi checkbox `SKIP_FOR_AUDIT` + field "Director Instruction (verbatim)" tepat di bawah daftar checkbox verdict, sebelum "Major Findings". |
| `Sigma/templates/FMN-PLAN-TEMPLATE.md` | §7.1: tambahan identik seperti DIR-INTENT. |
| `src/utils/docCheck.ts` | Tambah `SigmaDocCheckOptions` (`enforceVerdictGate?: boolean`), `VERDICT_SECTION_ID` (map domain→section id: intent→`AUD_FINDINGS_ADVISORY_ONLY`, plan→`AUD_FINDINGS`), `VERDICT_CHECKBOX_LABELS` (set 7 label). `validateSigmaDocFile()` menerima parameter `options` baru (default `{}`, backward compatible — semua caller lama tidak perlu berubah). Saat `enforceVerdictGate` true: cari marker section verdict, tentukan batas akhir section (marker berikutnya atau akhir file), hitung baris checkbox `- [x] LABEL` yang tercentang dalam rentang itu — tepat 1 wajib (0 atau >1 → error), dan jika `SKIP_FOR_AUDIT` yang tercentang, cari baris "Director Instruction (verbatim): ..." dan pastikan tidak kosong/placeholder `[...]`. |
| `src/commands/intent.ts` | `lock` command: `validateSigmaDocFile(absPath, 'intent', { enforceVerdictGate: true })`. |
| `src/commands/plan.ts` | `lock` command: `validateSigmaDocFile(absPath, 'plan', { enforceVerdictGate: true })`. |
| `Sigma/rules/ARC-RULE.md` | Subsection "AUD Findings Section Authorization": tambah larangan mencentang `SKIP_FOR_AUDIT` tanpa instruksi Director eksplisit di sesi yang sama + kewajiban eskalasi (tanya Director: audit sungguhan atau approve skip) + instruksi transkrip verbatim ke field terkait. |
| `Sigma/rules/FMN-RULE.md` | Tambahan identik seperti ARC-RULE.md. |
| `test/helpers.ts` | `validIntentDoc()`/`validPlanDoc()`: tambah baris `- [x] PASS` di section AUD Findings — menjaga 3 test lock-sukses yang sudah ada (`intent-lock.test.ts`, `progress-hardening.test.ts`, `plan-activate.test.ts`) tetap lulus di bawah gate baru, tanpa perlu mengubah test itu sendiri. |
| `test/doc-check.test.ts` | Describe block baru "AUD Advisory Verdict gate (intent lock / plan lock only)" — 4 test: gagal 0 tercentang, gagal >1 tercentang, gagal SKIP_FOR_AUDIT tanpa verbatim, berhasil SKIP_FOR_AUDIT dengan verbatim terisi. |
| `test/plan-activate.test.ts` | Describe block baru "AUD Advisory Verdict gate on plan lock" — 2 test: gagal 0 tercentang, berhasil SKIP_FOR_AUDIT dengan verbatim terisi. |

**Keputusan desain penting (ditemukan saat implementasi, tidak eksplisit di
task breakdown asli)**: gate ini **hanya** aktif di `lock`, bukan di
`new`/`check`/`promote`. Alasannya: dokumen baru dari template selalu punya
seluruh checkbox verdict dalam keadaan belum tercentang (memang begitu
seharusnya sebuah template kosong) — kalau gate diterapkan universal ke
seluruh pemanggilan `validateSigmaDocFile()`, maka `sigma intent new`/`sigma
plan new` sendiri akan langsung gagal tepat setelah membuat draft baru.
Parameter `options.enforceVerdictGate` dibuat opt-in (default off) persis
untuk menghindari ini, dan hanya diaktifkan di call-site `lock`.

**Evidence**: `npm run build` bersih. `npm test` — 20 file, **119 test**
(naik dari 113 — 6 test baru), seluruhnya PASS.

### Risiko — Bagian C

- Gate ini murni memaksa *ada keputusan tercatat*, bukan memvalidasi bahwa
  audit sungguhan terjadi atau bahwa Director benar-benar memberi instruksi
  itu — penegakan "tidak boleh mencentang tanpa izin Director" tetap
  bergantung pada kepatuhan ARC/FMN terhadap rule file (perilaku), bukan
  sesuatu yang bisa diverifikasi CLI secara kriptografis. Ini pola yang sama
  seperti `--ack-stale-intent` yang sudah diterima di sistem, bukan celah
  baru.
- Jika Director nanti ingin gate serupa di `exec lock`/`close lock`, itu
  butuh membangun struktur checkbox verdict dari nol di DEV-EXEC/DIR-CLOSE
  (belum ada sama sekali saat ini) — bukan perluasan kecil, direkomendasikan
  jadi topik/plan terpisah, bukan menyusup ke Bagian C ini.

---

## Bagian D — Role-Memory Update: AUD Send-to-Role & ARC/FMN Reply Capability

**Sumber**: Sesi diskusi lanjutan pasca-Bagian C (2026-07-14). Ide baru dari
Director, bukan bagian dari Topik 2/3 sumber asli.

### Latar Belakang

- `AUD-RULE.md` "Mandatory Message Triggers" **sudah** mewajibkan AUD
  mengirim `sigma send` ke ARC setelah mengaudit DIR-INTENT (Trigger 1), dan
  ke FMN setelah mengaudit FMN-PLAN (Trigger 2) — tapi kewajiban ini ditulis
  tanpa pengecualian, padahal AUD sering kali adalah AI eksternal pasif
  (Claude web, Gemini web, ChatGPT web) yang **tidak punya akses tool/CLI
  Sigma sama sekali** — secara teknis mustahil menjalankan `sigma send`.
  Root cause yang sama seperti yang melatarbelakangi Bagian A (Topik 2).
- Role-memory (`Sigma/role-memory/*.json`) saat ini merangkum kewajiban ini
  secara longgar (`aud-memory.json`: *"Send findings to ARC for intent
  review or FMN for plan review when Sigma messaging rules require it"*) —
  tidak eksplisit soal wajib/tidak, tidak eksplisit soal pengecualian AUD
  tanpa akses CLI, dan tidak menyebut kemampuan ARC/FMN membalas.
- `arc-memory.json`/`fmn-memory.json` belum punya poin eksplisit tentang
  membalas hasil audit yang diterima lewat `sigma send`/inbox.

### Keputusan (dari sesi diskusi)

1. **AUD** (role-memory `aud-memory.json`): AUD **wajib** mengirim hasil
   audit lewat `sigma send` ke AI role terkait, tergantung target dokumen
   yang diaudit — audit DIR-INTENT → kirim ke ARC, audit FMN-PLAN → kirim
   ke FMN (sesuai Trigger 1/2 yang sudah ada di `AUD-RULE.md`).
2. **Pengecualian eksplisit**: kewajiban ini **tidak berlaku** jika AUD
   dijalankan sebagai AI yang tidak punya akses operasi `sigma send` —
   misalnya AUD berupa AI web pasif eksternal (Claude web, Gemini web,
   ChatGPT web, dll). Untuk kasus ini, jalur yang berlaku adalah Director
   merelay hasil audit secara manual di chat (pathway yang sudah dibuat di
   Bagian A).
3. **ARC & FMN** (role-memory `arc-memory.json` dan `fmn-memory.json`,
   masing-masing satu poin baru setara): setiap menerima hasil audit lewat
   `sigma send`/inbox, ARC/FMN boleh mengirim balasan lewat `sigma send`
   yang mencakup persetujuan, keberatan, keraguan, atau ketidaksetujuan apa
   pun terhadap hasil audit tersebut.

### Task Breakdown — Bagian D

- [x] Update `Sigma/role-memory/aud-memory.json` — perkuat poin
  "Send findings to ARC for intent review or FMN for plan review..." jadi
  eksplisit wajib + pemetaan target (INTENT→ARC, PLAN→FMN) + pengecualian
  AUD tanpa akses `sigma send` (AI web eksternal pasif → Director relay
  manual, pathway Bagian A).
- [x] Update `Sigma/role-memory/arc-memory.json` — tambah poin baru: ARC
  boleh membalas hasil audit yang diterima lewat `sigma send`/inbox dengan
  persetujuan/keberatan/keraguan/ketidaksetujuan lewat `sigma send`.
- [x] Update `Sigma/role-memory/fmn-memory.json` — tambah poin setara untuk
  FMN.
- [x] **Dikonfirmasi Director**: selaraskan `Sigma/rules/AUD-RULE.md`
  "Mandatory Message Triggers" (Trigger 1 & 2) dengan pengecualian yang sama
  — saat ini Trigger 1/2 mewajibkan `sigma send` tanpa pengecualian sama
  sekali, sehingga tanpa penyelarasan ini rule file otoritatif tetap
  mewajibkan sesuatu yang secara teknis mustahil dipenuhi AUD tanpa akses
  CLI (`aud-memory.json` sendiri menyatakan "Reminder only... Role rules...
  override this file" — jadi rule file harus jadi sumber kebenaran yang
  konsisten, bukan memory yang mendahului rule).
- [x] Konfirmasi: tidak ada perubahan diperlukan di `Sigma/role-memory/dev-memory.json`
  (DEV bukan pengirim maupun penerima dalam alur pesan audit ini).
- [x] `npm test` lulus (role-memory JSON dites di
  `test/role-memory-bootstrap.test.ts` — pastikan tidak ada regresi format).

### Implementation Walkthrough — Bagian D

| File | Perubahan |
| :--- | :--- |
| `Sigma/role-memory/aud-memory.json` | Poin "Send findings to ARC for intent review or FMN for plan review when Sigma messaging rules require it" diganti jadi eksplisit wajib + pemetaan target + pengecualian AI web eksternal pasif. `memory_updated_at` → `2026-07-14`. |
| `Sigma/role-memory/arc-memory.json` | Poin baru ditambahkan setelah "After AUD reviews intent, defend valid ARC reasoning...": ARC boleh membalas hasil audit via `sigma send` (persetujuan/keberatan/keraguan/ketidaksetujuan). `memory_updated_at` → `2026-07-14`. |
| `Sigma/role-memory/fmn-memory.json` | Poin setara ditambahkan setelah "Treat AUD notes and reference files as advisory input...". `memory_updated_at` → `2026-07-14`. |
| `Sigma/rules/AUD-RULE.md` | Subsection "Mandatory Message Triggers": tambah paragraf "Exception" persis setelah kalimat pembuka — berlaku untuk Trigger 1 & 2 sekaligus (tidak diduplikasi per-trigger), menyatakan AUD tanpa akses `sigma send` dikecualikan dan jalur fallback-nya adalah Director relay manual. |
| `Sigma/role-memory/dev-memory.json` | Tidak diubah — dikonfirmasi tidak relevan dengan alur pesan audit ini. |

**Evidence**: Validitas JSON ketiga file (`aud-memory.json`, `arc-memory.json`,
`fmn-memory.json`) dicek via `node -e "JSON.parse(...)"` — semua valid.
`test/role-memory-bootstrap.test.ts` (10 test) dan full `npm test` (20 file,
119 test) dijalankan ulang setelah perubahan — seluruhnya PASS, tidak ada
regresi format.

### Risiko — Bagian D

- Poin baru ini murni konten reminder/rule tertulis — sama seperti Bagian A,
  penegakannya bergantung kepatuhan role terhadap instruksi tertulis, bukan
  validasi teknis CLI.

---

## Bagian E — Final Validation Checklist Restructuring (Lock Requirement / Conditional Requirement)

**Sumber**: Sesi diskusi lanjutan pasca-Bagian D (2026-07-14), termasuk audit
AUD (Critic Mode, verdict PASS_WITH_RISK) yang mengoreksi satu keputusan
klasifikasi awal Professional Mode. Bukan bagian dari Topik 2/3 sumber asli.

### Latar Belakang

- DIR-INTENT §13 "Final Validation Checklist" berisi 17 checkbox datar tanpa
  pembedaan kelas — semua diperlakukan setara meski secara semantik berbeda
  (ada yang selalu berlaku, ada yang kondisional pada status Comprehensive
  Research).
- `docCheck.ts` saat ini hanya memvalidasi section `FINAL_VALIDATION_CHECKLIST`
  secara struktural (marker + heading H2 ada) — **tidak pernah** mengecek isi
  checkbox. Kalimat "Complete this checklist before running `sigma intent
  lock`" murni konvensi tekstual, tidak ditegakkan CLI sama sekali.
- Professional Mode awalnya mengusulkan 3 kategori (Mandatory/Optional/
  Conditional) dengan item 6–9 (Quality Bar: Security/UX Trust/UI/
  Performance-Cost) masuk Optional — alasannya keliru: item ini sudah punya
  escape hatch bawaan "or explicitly marked not applicable," jadi
  menjadikannya Optional justru membiarkan ambiguitas antara "memang N/A"
  vs "lupa diisi", bukan mengurangi kekakuan.
- Director meminta audit atas keputusan desain ini. AUD (Critic Mode)
  mengoreksi: item 6–9 seharusnya **Mandatory**, tervalidasi terhadap isi
  Section 4 (tabel Quality Bar) langsung — bukan checkbox ringkasan di §13.
  Director menyetujui koreksi ini.
- Konsekuensi: setelah 6–9 dipindah, kategori "Optional" jadi kosong (0 item)
  — dihapus sepenuhnya, konsisten dengan preseden Bagian B (kelas "Advisory"
  yang kosong juga dihapus, bukan dipertahankan sebagai placeholder).
- Penamaan direvisi dari Mandatory/Optional/Conditional menjadi **Lock
  Requirement** dan **Conditional Requirement** (usulan AUD, disetujui
  Director) — "Optional" berpotensi terbaca "boleh diabaikan sepenuhnya,"
  padahal makna yang dimaksud (untuk kategori yang sekarang sudah kosong)
  adalah "lock tetap boleh, tapi kualitas intent turun."

### Keputusan (dari sesi diskusi + audit AUD)

1. Section 13 direstrukturisasi jadi dua sub-heading eksplisit: **"Lock
   Requirement"** dan **"Conditional Requirement"** — bukan daftar datar
   tanpa label seperti sekarang.
2. **Lock Requirement** — 15 item, SEMUA harus terpenuhi sebelum `sigma
   intent lock` berhasil (AND logic — beda dari gate AUD Verdict Bagian C
   yang pilih tepat satu dari beberapa opsi):
   - 11 item hanya bisa divalidasi lewat checkbox §13 itu sendiri (tidak ada
     lokasi sumber terstruktur lain untuk dicek — kontennya prosa bebas):
     Intent Core jelas, Scope in/out eksplisit, Success criteria
     measurable, FMN diinstruksikan preserve Quality Bar, Constraints/
     preferences dipisah, Technical choices ditandai auditable means,
     Execution direction untuk FMN ada, Risk appetite dinyatakan, Primary
     failure concern dinyatakan, Evidence requirement dinyatakan, Director
     verdict direkam.
   - 4 item (Security/UX Trust/UI-Packaging/Performance-Cost) divalidasi
     terhadap **isi Section 4** — baris tabel tidak boleh masih berisi
     placeholder instruksional template, harus berisi standar nyata atau
     "N/A" eksplisit.
3. **Conditional Requirement** — 2 item (Comprehensive Research subsections,
   AUD Verificator Mode review/Director accept-risk) — tidak pernah jadi
   syarat gate, hanya relevan secara informasional ketika §2.1 Status =
   NEEDED.
4. Tidak ada kategori "Optional"/"Quality Recommendation" — sudah diputuskan
   kosong sejak awal, tidak dibuat sebagai placeholder.
5. Gate ini hanya berlaku untuk `sigma intent lock`. FMN-PLAN tidak punya
   section setara "Final Validation Checklist" (sudah dicek saat Bagian C —
   tidak ada), jadi tidak ada perubahan di `plan lock`.

### Task Breakdown — Bagian E

- [x] Restrukturisasi `Sigma/templates/DIR-INTENT-TEMPLATE.md` Section 13:
  pisahkan 17 item jadi dua sub-heading "### 13.1 Lock Requirement" dan
  "### 13.2 Conditional Requirement", pertahankan urutan asli item di
  masing-masing kelompok.
- [x] Perluas `validateSigmaDocFile()` di `src/utils/docCheck.ts` — opsi
  baru (mis. `enforceFinalChecklistGate`, terpisah dari
  `enforceVerdictGate` karena mekanismenya beda: AND-semua, bukan pilih-
  satu): 11 item non-Quality-Bar harus tercentang semua (error per item
  yang kosong); 4 item Quality Bar divalidasi terhadap baris tabel Section
  4 — pastikan tidak ada sel "Minimum Standard For This Intent" yang masih
  berupa placeholder instruksional template atau kosong (harus diisi
  standar nyata atau "N/A").
- [x] **Catatan teknis**: placeholder di Section 4 berbeda konvensi dari
  `[...]` yang dipakai di section lain — Section 4 memakai teks instruksional
  dalam kurung siku (mis. `[What must be true for this to be safe enough?]`).
  Deteksi "belum diisi" perlu logika berbeda dari cek `[...]` literal yang
  dipakai di gate Bagian C — perlu diselesaikan saat implementasi, bukan
  sekadar reuse regex yang sama.
- [x] Wire gate baru ini ke `sigma intent lock` saja (bukan `new`/`check`),
  alasan sama seperti Bagian C — dokumen baru dari template pasti kosong.
- [x] Update `Sigma/rules/ARC-RULE.md` — **satu kalimat saja** (bukan
  subsection baru seperti "AUD Findings Section Authorization" di Bagian A):
  "ARC MUST complete the Lock Requirement checklist in Section 13 before
  recommending `sigma intent lock`." Ditempatkan di dekat "DIR-INTENT
  Creation Rules" yang sudah ada. Keputusan Director: cukup satu kalimat
  ringan, gate CLI yang jadi penegakan utama — bukan rule file panjang.
- [x] Update `test/helpers.ts` `validIntentDoc()` — isi Section 13 (Lock
  Requirement tercentang semua) dan Section 4 (4 baris Quality Bar terisi
  standar nyata/N/A, bukan placeholder) — diperlukan supaya test lock-sukses
  yang sudah ada (`intent-lock.test.ts`, `progress-hardening.test.ts`) tetap
  lulus di bawah gate baru ini, sama seperti penyesuaian yang dilakukan di
  Bagian C.
- [x] Tambahkan test: `intent lock` gagal kalau satu saja item Lock
  Requirement (checkbox §13) kosong; gagal kalau salah satu baris Quality
  Bar Section 4 masih placeholder; berhasil kalau semua Lock Requirement
  terpenuhi dan Section 4 terisi lengkap (standar nyata atau N/A);
  Conditional Requirement tidak memengaruhi hasil lock sama sekali baik
  terisi maupun tidak.
- [x] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja
  disesuaikan di tahap ini.

### Implementation Walkthrough — Bagian E

| File | Perubahan |
| :--- | :--- |
| `Sigma/templates/DIR-INTENT-TEMPLATE.md` | Section 13 direstrukturisasi: "### 13.1 Lock Requirement" (15 item, urutan asli dipertahankan) dan "### 13.2 Conditional Requirement" (2 item, dengan catatan eksplisit "not a lock gate"). Marker `<!-- SIGMA:DIR_INTENT:SECTION:FINAL_VALIDATION_CHECKLIST -->` dan H2 heading "## 13. Final Validation Checklist" tidak diubah — tetap terdeteksi normal oleh `requiredSections` check yang sudah ada. |
| `src/utils/docCheck.ts` | Tambah `enforceFinalChecklistGate?: boolean` di `SigmaDocCheckOptions`; konstanta `FINAL_CHECKLIST_SECTION_ID`, `QUALITY_BAR_SECTION_ID`, `CONDITIONAL_REQUIREMENT_HEADING` (regex heading §13.2), `QUALITY_BAR_CHECKLIST_PHRASES` (4 frasa untuk mengecualikan item Quality Bar dari cek checkbox biasa), `QUALITY_BAR_DIMENSIONS` (4 nama dimensi untuk match baris tabel). Blok baru di `validateSigmaDocFile()` (hanya jalan jika `domain === 'intent'`): (a) scan baris checkbox dari marker `FINAL_VALIDATION_CHECKLIST` sampai heading §13.2 (atau akhir section jika heading tidak ditemukan) — exclude 4 baris Quality Bar dari cek, semua sisanya wajib `[x]`; (b) scan baris tabel di section `QUALITY_BAR` — cocokkan baris berdasar nama dimensi, cek kolom "Minimum Standard" tidak masih berbentuk `[...]` instruksional. |
| `src/commands/intent.ts` | `lock` command: `validateSigmaDocFile(absPath, 'intent', { enforceVerdictGate: true, enforceFinalChecklistGate: true })` — kedua gate (Bagian C + E) aktif bersamaan di titik lock yang sama. |
| `Sigma/rules/ARC-RULE.md` | Satu kalimat ditambahkan di "DIR-INTENT Creation Rules": "ARC MUST complete the Lock Requirement checklist in Section 13 before recommending `sigma intent lock`." — tanpa subsection baru, sesuai keputusan Director. |
| `test/helpers.ts` | `validIntentDoc()`: Section 4 (QUALITY_BAR) diisi tabel lengkap 4 baris dengan "N/A" (bukan `Test quality bar.` polos); Section 13 direstrukturisasi jadi §13.1 (15 item, semua `[x]`) dan §13.2 (2 item, sengaja dibiarkan `[ ]` — memverifikasi Conditional Requirement memang tidak pernah dicek). |
| `test/doc-check.test.ts` | Describe block baru "Final Validation Checklist gate (intent lock only)" — 3 test: gagal saat satu item Lock Requirement (checkbox §13) tidak tercentang; gagal saat satu baris Quality Bar Section 4 masih placeholder; berhasil saat semua lengkap sekaligus memverifikasi Conditional Requirement yang sengaja dibiarkan kosong tidak menghalangi lock. |

**Evidence**: `npm run build` bersih. `npm test` — 20 file, **122 test** (naik
dari 119 — 3 test baru), seluruhnya PASS. Ketiga test lock-sukses lama
(`intent-lock.test.ts`, `progress-hardening.test.ts`, dan 4 test AUD
Advisory Verdict Bagian C di `doc-check.test.ts`) tetap lulus tanpa
modifikasi tambahan di luar pembaruan `validIntentDoc()` — mengonfirmasi
kedua gate (Bagian C dan Bagian E) hidup berdampingan tanpa konflik pada
titik lock yang sama.

### Risiko — Bagian E

- Dari 15 item Lock Requirement, 11 di antaranya hanya bisa digate lewat
  checkbox §13 sendiri (self-report) — risiko "checklist theater" yang sama
  seperti dibahas AUD tetap ada untuk ke-11 item ini (mencentang tidak
  membuktikan kontennya benar-benar memadai). Hanya 4 item Quality Bar yang
  mendapat validasi lebih kuat (terhadap isi Section 4 langsung). Ini
  asimetri yang disadari, bukan cacat implementasi.
- Restrukturisasi Section 13 mengubah section marker/heading — perlu
  dipastikan `requiredSections` di `docCheck.ts` (`FINAL_VALIDATION_CHECKLIST`)
  tetap terdeteksi dengan H2 heading yang benar setelah section dipecah jadi
  dua sub-heading H3.

---

## Dependency Catatan

- Bagian A harus selesai (minimal revisi template) sebelum Bagian B
  dieksekusi — supaya tidak ada gap di mana Director kehilangan jalur sah
  mengisi AUD Findings. **(Sudah terpenuhi — Bagian A & B selesai bersamaan.)**
- Setelah Bagian B selesai, **satu-satunya jalur** mengisi AUD Findings adalah
  menulis manual ke file oleh ARC/FMN sesuai guardrail baru Bagian A.
- Bagian C bergantung penuh pada struktur checkbox verdict yang dibuat
  Bagian A (DIR-INTENT §12.2, FMN-PLAN §7.1) — tidak bisa dikerjakan sebelum
  Bagian A selesai. Karena Bagian A sudah selesai, Bagian C bisa langsung
  dieksekusi begitu Director approve, tanpa dependency tambahan yang
  menunggu.

---

## Risiko

- Jika Bagian B dikerjakan sebelum Bagian A tuntas, Director kehilangan
  kedua jalur (command lama dihapus, guardrail baru belum ada) — urutan di
  atas wajib diikuti.
- Perubahan `ARC-RULE.md`/`FMN-RULE.md` perlu ditinjau agar tidak ada instruksi
  yang saling kontradiksi (mis. rule lama masih bilang "jangan tulis section
  ini" di satu tempat, sementara bagian lain sudah bilang boleh).

---

## Draft Acceptance Criteria

### Bagian A & B — IMPLEMENTED

- [x] `FMN-PLAN-TEMPLATE.md` dan `DIR-INTENT-TEMPLATE.md` punya struktur checkbox verdict yang identik.
- [x] `FMN-RULE.md`/`ARC-RULE.md` mengizinkan ARC/FMN menulis AUD Findings dengan sumber sah yang jelas, DEV tetap tidak diizinkan.
- [x] `sigma intent review`, `sigma plan audit`, `sigma exec audit`, `sigma close audit` tidak lagi terdaftar di CLI.
- [x] `appendAuditFindings()` tidak lagi ada di `src/utils/artifacts.ts`.
- [x] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini (20 file, 113 test, PASS).
- [x] README.md/SIGMA_PROTOCOL.md tidak lagi menyebut ke-4 command yang dihapus.

### Bagian C — IMPLEMENTED

- [x] DIR-INTENT §12.2 dan FMN-PLAN §7.1 punya opsi `SKIP_FOR_AUDIT` + field "Director Instruction (verbatim)", identik di kedua template.
- [x] `sigma intent lock` dan `sigma plan lock` gagal jika checkbox verdict yang tercentang bukan tepat satu (0 atau >1).
- [x] `sigma intent lock` dan `sigma plan lock` gagal jika `SKIP_FOR_AUDIT` tercentang tapi field "Director Instruction (verbatim)" kosong/placeholder.
- [x] `ARC-RULE.md`/`FMN-RULE.md` melarang ARC/FMN mencentang `SKIP_FOR_AUDIT` tanpa instruksi Director eksplisit di sesi yang sama.
- [x] `sigma exec lock`/`sigma close lock` tidak terpengaruh — scope gate ini murni intent + plan (gate diaktifkan lewat parameter opt-in, tidak menyentuh domain lain).
- [x] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini (20 file, 119 test, PASS).

### Bagian D — IMPLEMENTED

- [x] `aud-memory.json` menyatakan wajib (bukan kondisional longgar) kirim hasil audit via `sigma send` dengan pemetaan target (INTENT→ARC, PLAN→FMN), plus pengecualian eksplisit untuk AUD tanpa akses `sigma send`.
- [x] `arc-memory.json` dan `fmn-memory.json` masing-masing punya poin baru: boleh membalas hasil audit via `sigma send` dengan persetujuan/keberatan/keraguan/ketidaksetujuan.
- [x] `AUD-RULE.md` Mandatory Message Triggers (Trigger 1 & 2) sudah diselaraskan dengan pengecualian yang sama (dikonfirmasi Director).
- [x] `npm test` lulus, termasuk `test/role-memory-bootstrap.test.ts`.

### Bagian E — IMPLEMENTED

- [x] DIR-INTENT §13 punya dua sub-heading eksplisit: "Lock Requirement" (15 item) dan "Conditional Requirement" (2 item).
- [x] `sigma intent lock` gagal jika satu saja dari 11 item Lock Requirement (checkbox §13) tidak tercentang.
- [x] `sigma intent lock` gagal jika salah satu dari 4 baris Quality Bar Section 4 masih placeholder (bukan standar nyata atau "N/A").
- [x] Conditional Requirement (2 item) tidak memengaruhi hasil lock sama sekali.
- [x] `ARC-RULE.md` menugaskan eksplisit kepemilikan Section 13 ke ARC.
- [x] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini (20 file, 122 test, PASS).
