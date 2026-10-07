# E03 - Review: EXEC template, DEV rules, DEV skill, DEV memory

Tanggal: 7 Oktober 2026
Status: DIEKSEKUSI (7 Oktober 2026), commit 0b2b8ca di `main`. Seluruh butir bagian 4 disetujui Director, termasuk teks C-5 draf kedua. Hasil: template EXEC schema 3, validator dan test, DEV-RULE (isi dan urutan, lampiran [E03_lampiran_keterlacakan-dev-rule.md](E03_lampiran_keterlacakan-dev-rule.md)), FMN-RULE F-1, skill DEV (4 target), memory DEV; satu build, `npm test` 72 file dan 956 test lulus. Bagian 8 di bawah adalah catatan serah terima sebelum eksekusi dan tidak lagi mencerminkan keadaan kerja.
Dasar: handoff sesi E02 (target berikutnya: DEV-RULE, skill, memory, dan EXEC template v2), keputusan desain 28 September §5.3, §3, §4, [F00](F00_indeks-dan-register.md) bagian 5 (T-19, T-25) dan [F11](F11_writing-style-rules.md). Pola kerja mengikuti [E01](E01_rencana-eksekusi-arc-dan-intent.md) dan [E02](E02_review-plan-template-dan-fmn.md).
Label: **TERKUNCI** (keputusan Director), **TERVERIFIKASI** (diperiksa pada berkas), **REKOMENDASI** (asisten, belum keputusan).

## 1. Cakupan

Dikerjakan: DEV-EXEC template (master) beserta validator dan test; DEV-RULE (master); skill DEV di empat target; role memory DEV; penyesuaian rujukan nama section EXEC di FMN-RULE (butir F-1).
Tidak dikerjakan: status APPROVED, pesan CONTRACT_CHANGE_REQUEST, pengikatan revisi PLAN pada EXEC, otorisasi gabungan "approve dan bangun" (F04); nama file, marker, dan `type=DEV_EXEC` (F10); AUD-RULE, Constitution, Protocol (ditahan); proyeksi HUMAN (PLAN-EXEC-HUMAN-TEMPLATE, Fidelity Ledger); sinkronisasi ke `~/.sigma` dan proyek (F09).

## 2. Fakta terverifikasi

1. Template saat ini: `schema=2`, 18 section, 470 baris. Validator ([docCheck.ts](../../src/utils/docCheck.ts) baris 285-331) mewajibkan 17 section; `TECHNICAL_RESEARCH` opsional; urutan section diperiksa. Satu-satunya syarat lock berbasis isi: tepat satu verdict pada `FMN_POST_BUILD_REVIEW` (`evaluateExecVerdictGate`, baris 684-712), tidak bergantung pada verdict yang dipilih.
2. Pemilihan spesifikasi per schema sudah ada untuk INTENT dan PLAN (`resolveDocSpec`, baris 350-357). EXEC dapat memakai pola yang sama; schema 2 tetap divalidasi spesifikasi lama.
3. ID section EXEC dipakai oleh `docCheck.ts`, `test/helpers.ts` (fixture `validExecDoc`, memakai `schema=1`), `test/doc-check-optional-sections.test.ts`, dan `test/reconstruct.test.ts`. Penyalinan template di [execDraftService.ts](../../src/services/execDraftService.ts) baris 152. `reconstruct.ts` hanya memetakan domain ke tipe `DEV_EXEC`.
4. Tidak ada kode yang membaca status kesiapan DEV (`CLEAR` / `NEED_CLARIFICATION`) maupun verdict pre-build FMN (`CLEARED_TO_BUILD`, dan sebagainya). Keduanya hanya dibaca oleh AI role melalui DEV-RULE Trigger 1 dan 2. Jadi isi kotak tersebut dapat diubah tanpa menyentuh validator, tetapi tidak ada penegakan otomatis.
5. Tabel hasil AC dan tabel "Test Contract Result" (`TC-001`) pada EXEC template baris 372-382 sudah tidak sesuai dengan PLAN schema 3, yang menggabungkan keduanya menjadi satu tabel `AC-xxx` (E02 A-2). Syarat urutan: PLAN schema 3 tidak boleh masuk `~/.sigma/templates` sebelum EXEC v2 dan DEV-RULE berubah (F00 T-19).
6. DEV-RULE: 785 baris. Rujukan nomor section EXEC: "Section 3" (baris 59), "Sections 5-12" (baris 741). Daftar isi EXEC di bagian 4 (baris 130-144) memakai nama section lama. Rujukan ke dokumen desain internal yang tidak dapat diikuti pembaca rules: "PLAN-IMPL-MULTIDRAFT-LOCK §9.2, Director directive 2026-08-12" (baris 61, 554). Prosedur Technical Research ada dua kali dengan isi yang sama: DEV-RULE bagian 1c dan EXEC template baris 60-84.
7. DEV-RULE memuat Git duplikat: bagian 8 "Git Diff Evidence" (baris 233-267) dan bagian "Git Awareness & Evidence" (baris 571-589). Daftar perintah git hanya ada di bagian kedua.
8. Template memuat "Deviation Update Checklist" (enam butir, baris 250-256) yang belum ada di DEV-RULE. Desain 28 September §5.3 menetapkan checklist ini pindah ke DEV-RULE.
9. Daftar "DEV should report in EXEC" dari PLAN sudah dibandingkan dengan DEV-RULE pada E02 dan seluruh butir tercakup; tidak ada tambahan ke DEV-RULE ([lampiran E02](E02_lampiran_keterlacakan-fmn-rule.md) baris 94). Butir A-4(b) E02 selesai tanpa pekerjaan DEV-RULE.
10. FMN-RULE merujuk nama section EXEC pada baris 106 (Director Observation Report & Minor Requests), 551 dan 561 (DEV Pre-Build Assessment), 573 dan 578 (FMN Post-Build Review). Rujukan ini berubah bila nama section berubah.
11. Skill DEV: 118 baris di tiga target (codex, reasonix, antigravity) dan 124 baris di claude_code. Perbedaan hanya bagian "Director-Facing Communication Rules": claude_code memuat subbagian Onboarding opener dan First-mention ordering; tiga target lain memuat satu tabel label. Tidak ada Writing Style Rules pada skill maupun rules DEV.
12. Memory DEV: `source_rule_version: "unversioned"`, `memory_updated_at: 2026-09-12`. Butir role-specific memakai nama FMN-PLAN dan DEV-EXEC.
13. Dokumen diskusi 6 Oktober mencatat EXEC LOCKED yang masih memuat tabel placeholder ([diskusi](../../Discussion/Evaluation-06102026/diskusi_rencana_perubahan_sigma_v2.md) bagian "Status dokumen dan kebersihan isi"). Validator tidak memeriksa placeholder pada EXEC. Penyebab dan waktu kejadian belum ditelusuri.
14. **Konflik sumber (dilaporkan, tidak diselesaikan sepihak).** Desain §5.3 menulis Git / Change Evidence "Otomatis (`sigma git evidence`)". Kode: `sigma git evidence` hanya menampilkan branch, commit, berkas berubah, dan ringkasan diff, bersifat read-only ([git.ts](../../src/commands/git.ts) baris 13-14). Perintah itu tidak menulis ke EXEC. Judul §5.3 menyebut "7 section + ringkasan", sedangkan tabelnya memuat enam section bernomor, ringkasan, dan Riset Teknis opsional sebagai 1a. Usulan di bawah mengikuti isi tabel.

## 3. Usulan struktur EXEC schema 3 (REKOMENDASI)

Mengikuti §5.3, dengan nama section berbahasa Inggris dan tanpa nomor seperti INTENT schema 5 dan PLAN schema 3. Penanda `type=DEV_EXEC` tetap.

| No | Section (ID validator) | Status | Asal (section lama) |
|---|---|---|---|
| 1 | Director Summary (`DIRECTOR_SUMMARY`) | wajib | 8 (What Was Implemented) dan 15 (Completion Summary) digabung ke ringkasan; 18 dipindah ke atas |
| 2 | Implementation Plan (`IMPLEMENTATION_PLAN`) | wajib | 1, 2, 4, 5, 6 digabung. Berisi: Source Alignment, Plan Assessment, Questions & Concerns, Readiness Status, Approach, Files / Components, Key Technical Decisions |
| 3 | Technical Research (`TECHNICAL_RESEARCH`) | opsional | 3; petunjuk prosedural dihapus (sudah di DEV-RULE) |
| 4 | FMN Pre-Build Review (`FMN_PRE_BUILD_REVIEW`) | wajib | 7; Checkpoint 1 |
| 5 | Build Result and Verification (`BUILD_RESULT_AND_VERIFICATION`) | wajib | 8, 10, 11, 12, 15 (status): What Was Implemented, How It Works, perubahan dependensi, verifikasi, bukti perubahan, status DEV |
| 6 | Deviations, Issues, and Limitations (`DEVIATIONS_ISSUES_LIMITATIONS`) | wajib | 9, 13, 14 dalam satu tabel dengan kolom Type |
| 7 | FMN Post-Build Review (`FMN_POST_BUILD_REVIEW`) | wajib | 16; Checkpoint 2; satu tabel AC |
| 8 | Director Observation Report & Minor Requests (`DIRECTOR_OBSERVATION_REPORT_MINOR_REQUESTS`) | wajib | 17; ID tidak berubah |

Delapan section (tujuh wajib dan satu opsional) menggantikan delapan belas. Section 3 dipisah menjadi section sendiri agar validator tetap mengenalinya (butir A-3).

## 4. Butir keputusan

**Jawaban Director, 7 Oktober 2026:** seluruh butir A-1 sampai A-10, B-1 sampai B-4, C-1 sampai C-5, D-1, E-1, F-1, F-2, G-1, dan G-2 DISETUJUI sesuai rekomendasi. Kolom "Jawaban" pada butir-butir itu tidak diisi satu per satu; pernyataan ini yang berlaku. C-5: teks draf kedua disetujui (bahasa pesan error dan log dikeluarkan dari cakupan; lihat C-5).

Setiap butir: pertanyaan, opsi, rekomendasi. Kolom jawaban diisi Director.

### A. EXEC template

**A-1. Struktur section.** Opsi: (a) struktur bagian 3; (b) struktur bagian 3 tanpa penggabungan Deviations/Issues/Limitations (tiga section tetap terpisah); (c) pertahankan 18 section dan hanya pindahkan ringkasan ke atas.
Rekomendasi: (a). Alasannya: §5.3 sudah disetujui sebagai arah desain; penggabungan menghilangkan duplikasi (kolom Impact dan Resolution muncul di tiga tabel).
Jawaban:

**A-2. Section Implementation Plan.** Menggabungkan enam section pra-build. Subbagian lama "Rationale" dan "Alternatives Considered" tumpang tindih dengan kolom Rationale dan Trade-Off pada Key Technical Decisions. Opsi: (a) hapus keduanya; alternatif yang ditolak dicatat di kolom Trade-Off / Risk; (b) pertahankan Alternatives Considered sebagai tabel; (c) pertahankan keduanya.
Rekomendasi: (a). Alasannya: informasi yang sama tidak ditulis dua kali (Writing Style Rules butir 2 dan 3).
Subbagian lain yang dipertahankan: Plan Assessment (tabel item, penilaian, status Clear/Unclear), Questions & Concerns, Readiness Status (`CLEAR`, `NEED_CLARIFICATION`, `OTHER`), karena DEV-RULE Trigger 1 dan 2 bergantung padanya (fakta 4).
Jawaban:

**A-3. Technical Research.** Desain menulisnya sebagai sub-bagian 1a. Opsi: (a) section opsional sendiri dengan marker `TECHNICAL_RESEARCH` (urutan setelah Implementation Plan); (b) subbagian tanpa marker di dalam Implementation Plan; (c) pertahankan seperti sekarang (nomor 3, sebelum approach).
Rekomendasi: (a). Alasannya: validator tetap dapat memeriksa urutan dan mengenali section; pengaturan lama (opsional, tanpa gate, tanpa review AI role) tidak berubah. Petunjuk prosedural 25 baris dihapus dari template karena DEV-RULE 1c memuat isi yang sama.
Jawaban:

**A-4. Build Result and Verification.** Isi: What Was Implemented, How It Works, tabel verifikasi (Build/Unit/Integration/Manual smoke), tabel Dependency / Environment Changes (atau satu kalimat bila tidak ada), tabel Change Evidence, dan status DEV (`IMPLEMENTED`, `PARTIALLY_IMPLEMENTED`, `BLOCKED`, `NEEDS_FMN_REVIEW`, `OTHER`). Opsi untuk walkthrough: (a) tinggalkan "Main Flow" dan "Important Logic / Abstractions" sebagai subbagian opsional; (b) pertahankan seluruhnya; (c) hapus keduanya dan andalkan How It Works.
Rekomendasi: (a). Alasannya: alur utama berguna untuk perubahan non-sepele dan tidak perlu untuk perubahan kecil; DEV-RULE bagian 5 tetap mewajibkan penjelasan konkret.
Jawaban:

**A-5. Change Evidence.** Fakta 14: bukti Git tidak otomatis masuk ke EXEC. Opsi: (a) tabel tetap diisi DEV dengan keluaran `sigma git evidence` (aturan DEV-RULE tidak berubah); (b) tulis di template bahwa bukti otomatis, dan ubah kode agar `sigma git evidence` menulis ke EXEC (di luar cakupan E03, perlu rencana kode sendiri).
Rekomendasi: (a). Alasannya: (b) mengubah perilaku CLI dan tidak diminta pada keputusan §5.3 sebagai tugas implementasi; template tidak boleh menyatakan perilaku yang belum ada. Desain §5.3 dicatat sebagai belum terpenuhi sampai ada keputusan terpisah.
Jawaban:

**A-6. Deviations, Issues, and Limitations.** Opsi: (a) satu tabel dengan kolom `No | Type | Item | Cause / Reason | Impact / Residual Risk | Resolution / Follow-Up | Needs FMN Review?`, Type bernilai `Deviation`, `Issue`, atau `Limitation`; satu kalimat bila tidak ada; (b) tiga tabel kecil di bawah satu section.
Rekomendasi: (a). Alasannya: sesuai §5.3. Konsekuensi: kolom generik; `Needs FMN Review?` hanya relevan untuk Deviation dan diisi `N/A` pada baris lain. Deviation Update Checklist dipindah ke DEV-RULE (fakta 8).
Jawaban:

**A-7. FMN Post-Build Review dan satu tabel AC.** Tabel AC Verification dan tabel Test Contract Result digabung: `AC ID | Expected Result (PLAN) | Actual Result and Evidence | Status` dengan Status `PASS`, `FAIL`, `PARTIAL`, `NOT_RUN`. Alasannya: PLAN schema 3 memuat satu baris per AC dan test (fakta 5). Kotak verdict lima nilai tidak berubah.
Rekomendasi: setuju. Pergantian nama verdict `READY_FOR_LOCK` menjadi `READY_FOR_APPROVAL` (§5.3) ditunda ke F04 (butir B-3).
Jawaban:

**A-8. Director Summary.** Sama dengan PLAN schema 3: lima kalimat paling banyak, tanpa ID, di bagian atas, diisi terakhir (disarankan setelah FMN Post-Build Review); subbagian opsional "Open Question / Unclear Decision" dipertahankan; "Open Risks / Next Actions" lama digabung ke ringkasan atau subbagian opsional tersebut.
Rekomendasi: setuju, konsisten dengan E02 A-8.
Jawaban:

**A-9. Director Observation Report & Minor Requests.** Isi tidak berubah. Perubahan: tabel contoh tidak aktif; bagian yang tidak berlaku berisi satu kalimat pernyataan (fakta 13). DEV Implementation Follow-up dipertahankan.
Rekomendasi: setuju.
Jawaban:

**A-10. Lokasi keluaran dilaporkan di EXEC (ditambahkan 7 Oktober 2026 setelah kolom Location dihapus dari Key Output PLAN).** Build Result and Verification memuat pemetaan "Key Output No → path hasil" (di mana tiap keluaran berada). Tabel Files / Components To Change pada Implementation Plan memuat path yang akan dibuat atau diubah sebelum build, sehingga lokasi terlihat pada Checkpoint 1. Opsi: (a) tabel pemetaan terpisah di Build Result; (b) kolom "Output" tambahan pada tabel Files / Components To Change; (c) tidak ada tabel khusus.
Rekomendasi: (a). Alasannya: Key Output adalah hasil akhir kontrak sedangkan tabel Files memuat semua berkas yang disentuh, sehingga pemetaan Key Output ke lokasi tidak dapat diturunkan dari tabel Files tanpa tebakan.
Jawaban:

### B. Validator dan test

**B-1. Spesifikasi schema 3.** `docCheck.ts`: `EXEC_SPEC_V3` dipilih bila `schema >= 3`; schema 2 tetap memakai spesifikasi lama tanpa perubahan. Fixture `validExecDoc` (schema 1) tetap lolos.
Rekomendasi: setuju.
Jawaban:

**B-2. Syarat lock dan peringatan schema 3.** Syarat lock yang ada: tepat satu verdict FMN Post-Build. Opsi tambahan: (a) hanya verdict yang ada; (b) tambah syarat lock "Director Summary terisi" (sama dengan PLAN dan INTENT) dan peringatan (tidak memblokir) bila sisa placeholder `[...]` ditemukan pada section wajib dan bila Implementation Plan tidak menyebut versi PLAN; (c) seperti (b) tetapi versi PLAN menjadi syarat lock.
Rekomendasi: (b). Alasannya: Summary terisi konsisten dengan dua artefak lain; peringatan placeholder menjawab temuan fakta 13 tanpa menjadi gerbang baru; versi PLAN sudah ditentukan CLI melalui pasangan nomor, dan pengikatan revisi sebenarnya adalah F04, sehingga syarat lock berbasis teks tidak memberi nilai independen. Risiko (b): `[...]` dapat muncul sah dalam isi (misalnya contoh kode); karena hanya peringatan, dampaknya terbatas.
Jawaban:

**B-3. Kosakata lock.** Verdict `READY_FOR_LOCK`, "before lock", dan perintah `exec lock` dalam template dan rules ditulis sesuai CLI saat ini. Opsi: (a) biarkan sampai F04 dan daftarkan pada T-25; (b) ganti sekarang.
Rekomendasi: (a). Alasannya: makna APPROVED, penyetuju, dan titik checkpoint ditetapkan F04; mengganti sekarang menciptakan istilah tanpa mekanisme (keputusan Director pada T-25 untuk PLAN berlaku sama).
Jawaban:

**B-4. Pemeriksaan silang EXEC terhadap PLAN.** Mis. setiap AC pada PLAN muncul pada tabel FMN Post-Build Review. Memerlukan pembacaan dua dokumen oleh validator, yaitu kemampuan baru. Opsi: (a) tidak dikerjakan di E03; dicatat untuk F04/F08; (b) peringatan sekarang.
Rekomendasi: (a). Alasannya: validator lintas dokumen belum ada dan memerlukan desain pemasangan PLAN dan EXEC yang dibahas di F04 (acuan revisi).
Jawaban:

### C. DEV-RULE

**C-1. Edit isi.** Daftar perubahan:
1. Nama artefak dalam prose: INTENT, PLAN, EXEC, CLOSE (mengikuti E01, E02 B-4, T-16); ID gate dan nama file lama disebut apa adanya.
2. Rujukan nomor section diganti nama section: "Section 3" (baris 59), "Sections 5-12" (baris 741); daftar isi EXEC di bagian 4 mengikuti struktur baru.
3. Rujukan ke dokumen desain internal "PLAN-IMPL-MULTIDRAFT-LOCK ..." dihapus dari teks rules (fakta 6); aturannya tetap.
4. Bagian 1c Technical Research menjadi satu-satunya tempat prosedur riset (fakta 6).
5. Deviation Update Checklist dari template ditambahkan ke bagian Deviations (fakta 8).
6. "locked Pre-Build Test Contract" (baris 771) dan "pre-build test contract" menjadi "acceptance criteria and test contract in the PLAN".
7. Pesan Trigger 2 dan 3: "Sections 5-12" dan daftar "pre-build planning sections" mengikuti nama baru.
8. Writing Style Rules (F11) pada `Behavioral Standards`, teks identik dengan ARC-RULE dan FMN-RULE (berlaku untuk EXEC).
9. Duplikasi Git (fakta 7): opsi (a) gabungkan "Git Awareness & Evidence" ke bagian 8 (satu tempat, daftar perintah dipertahankan); (b) biarkan dua bagian.
Rekomendasi: butir 1-8 setuju; butir 9 pilih (a). Alasannya: satu aturan Git berada di satu tempat; tidak ada MUST yang hilang, dibuktikan pada tabel keterlacakan.
Jawaban:

**C-2. Perilaku v2 yang ditunda ke F04.** Tidak ditulis di DEV-RULE pada E03: jalur `CONTRACT_CHANGE_REQUEST` dengan justifikasi, trigger baru, larangan melanjutkan pekerjaan terdampak pelonggaran sebelum Director menyetujui, dan otorisasi gabungan "approve dan bangun" (D-16). DEV-RULE hanya mempertahankan aturan eskalasi dan otorisasi yang berlaku sekarang. Alasannya sama dengan E02 A-6: aturan yang merujuk status dan jenis pesan yang belum ada di CLI menyesatkan DEV.
Rekomendasi: setuju.
Jawaban:

**C-3. Penyusunan ulang urutan.** Metode E01 dan E02: edit isi dahulu; penyusunan ulang sebagai langkah terpisah dengan kerangka urutan untuk persetujuan, verifikasi multiset baris, dan tabel keterlacakan setiap MUST dan MUST NOT. Opsi: (a) sesuai metode; (b) hanya edit isi.
Rekomendasi: (a). Kerangka usulan (diajukan ulang setelah edit isi selesai, dapat berubah): Role; Core Responsibilities (implementasi, sumber rujukan, freedom of method, technical objection, batas terminologi governance); Key Rules & Constraints; Behavioral Standards (termasuk Writing Style Rules) dan Role Stance Requirement; Role Activation; EXEC Documentation Rules (dokumentasi, Technical Research, walkthrough, deviasi, verifikasi, bukti Git); Interaction With Other Roles; Escalation Path; CLI Operation Policy; Inter-Role Communication Protocol dan Mandatory Message Triggers; Final Doctrine. Urutan sekarang menaruh Behavioral Standards dan Role Stance setelah Git Awareness, jauh dari Role.
Jawaban:

**C-4. Versi aturan.** Tidak ada penomoran versi di DEV-RULE (T-18 menunggu F01). Opsi: tidak diubah.
Rekomendasi: tidak diubah.
Jawaban:

**C-5. Code Style Rules pada DEV-RULE (ditambahkan 7 Oktober 2026).** Sumber: dokumen "Human-Reviewable Code Writing Style" hasil diskusi Director dengan AI lain (pendapat, tidak diverifikasi sebagai standar). Keputusan Director (TERKUNCI): (1) dimasukkan ke DEV-RULE dalam versi ringkas; (2) bahasa Inggris sebagai bawaan untuk komentar kode; (3) kode selalu diasumsikan dibaca manusia; FMN-RULE tidak berubah karena AI lebih fleksibel memahami; (4) masuk E03.
Aturan tidak berlaku sebagai Writing Style Rules F11 (F11 menyangkut dokumen, bukan kode); namanya "Code Style Rules" agar tidak tertukar.
Penempatan: subbagian di bagian "Human-Readable Code & Governance Terminology Boundary" (Core Responsibilities butir 9). Butir umum yang tumpang tindih di bagian itu ("DEV SHOULD prefer...", panduan komentar) digantikan; batas terminologi governance, contoh buruk dan baik, pengecualian, dan doktrin tidak diubah. Skill DEV (D-1) dan memory DEV (E-1) masing-masing mendapat satu butir pengingat singkat yang merujuk DEV-RULE, bukan salinan teks.
Hal yang dihapus dari sumber: contoh khusus domain dan bahasa (`estate`, `scene`, `COG export`, Python); pengulangan antara §3, §19, §20; §17 (pertanyaan reviewability) diringkas menjadi satu kalimat penutup; §18 (non-goals) dihapus.
Pembatasan yang ditulis eksplisit: urutan prioritas memuat rantai otoritas Sigma (instruksi Director, INTENT, dan batasan PLAN di atas aturan gaya).
Revisi 7 Oktober 2026: Director menilai draf 12 butir terlalu penuh untuk DEV-RULE. Draf kedua di bawah memuat 7 butir dan menggantikan draf pertama. Dihapus dari draf pertama: docstring (masuk butir 2 secara umum), konstanta, penamaan test, log, dan kalimat penutup reviewability. Bahasa pesan error dan log adalah standar UX; penilaiannya ada pada kontrak (Quality Standards pada INTENT dan Acceptance Criteria pada PLAN), bukan pada aturan gaya kode, sehingga tidak diatur di sini (keputusan Director).
Usulan teks, draf kedua (bahasa Inggris, sesuai bahasa rules):

> ### Code Style Rules
>
> Write code for human readers. Precedence: Director instructions, INTENT, and PLAN constraints; then correctness and security; then the project's conventions and formatter; then these rules. A readability change MUST NOT change required behavior, weaken validation, hide a side effect, or make a failure less explicit.
>
> 1. Names state intent and use the domain's own terms, one term per concept. Avoid generic names and invented abbreviations.
> 2. Write comments in English unless the project convention or the PLAN says otherwise. A comment states what the code cannot show: rationale, constraint, invariant, trade-off, or workaround. A comment contains no Sigma terminology: no role names, artifact names, artifact or task IDs, versions, or gate and lock vocabulary. Update or remove a comment in the same change that invalidates it.
> 3. Keep functions and control flow easy to follow. Extract code only for a meaningful operation, real duplication, or a test boundary. Use guard clauses, and keep side effects and mutation visible.
> 4. Add an abstraction only for a domain concept, a boundary, an external system, or real duplication. Do not add speculative interfaces, wrappers, or generic helpers.
> 5. Errors fail explicitly and carry context, without secrets. Do not catch broad exceptions and do not remove validation at a trust boundary.
> 6. Follow the project's existing conventions and formatter. Existing code is evidence of convention, not proof of correctness.
> 7. Avoid patterns typical of AI-generated code: comments on obvious code, excessive docstrings, defensive checks without a defined failure model, speculative abstraction, repeated logging, and refactoring unrelated to the task.

Tambahan Director (7 Oktober 2026, TERKUNCI): komentar tidak boleh memuat terminologi Sigma apa pun. Pengecualian (DISETUJUI, sesuai rekomendasi): istilah Sigma boleh menjadi nama dalam kode bila produknya Sigma; komentar tidak pernah memuat rujukan ke artefak, ID, atau versi. Aturan berlaku untuk kode baru; komentar lama di kode Sigma (contoh: [docCheck.ts](../../src/utils/docCheck.ts)) tidak ditulis ulang.
Rekomendasi: setuju dengan draf kedua.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), arah dan teks draf kedua.

### D. Skill DEV (empat target)

**D-1.** Tambah Writing Style Rules (teks sama dengan rules), tanpa mengubah bagian lain. Pada skill terdapat "Operates only after FMN-PLAN is LOCKED" dan tabel label manusia (DIR-INTENT dan sebagainya): tetap sampai F04 dan F10 (keputusan E01 dan E02). Perbedaan claude_code (Onboarding opener, First-mention ordering) adalah isi, bukan format, sehingga tidak disamakan. Penempatan sama dengan skill FMN: setelah bagian Role Rules, sebelum CLI-Managed Files.
Rekomendasi: setuju.
Jawaban:

### E. Memory DEV

**E-1.** Tambahan: satu butir pengingat Writing Style Rules (bentuk seperti fmn-memory) dan `memory_updated_at`. Perbaikan sebutan: butir "Study the locked FMN-PLAN" dan "DEV-EXEC" menjadi PLAN dan EXEC bila FMN memory sudah memakai nama yang sama (fmn-memory masih memakai "PLAN" dan "DEV-EXEC" pada satu butir; saya samakan dengan hasil akhir DEV-RULE dan laporkan perbedaannya). `source_rule_version` tetap `unversioned` (E02 D-2).
Rekomendasi: setuju.
Jawaban:

### F. Lintas dokumen

**F-1. Rujukan nama section EXEC di FMN-RULE.** Baris 106, 551, 561, 573, 578 (fakta 10) disesuaikan dengan nama section baru; hanya penggantian nama, tanpa perubahan kewajiban. Opsi: (a) ubah sekarang pada E03; (b) catat sebagai butir sinkronisasi dan biarkan.
Rekomendasi: (a). Alasannya: FMN-RULE baru diedit dan disepakati; membiarkan rujukan ke section yang tidak ada mengulang celah "rujukan tidak terpenuhi" yang sudah ditemukan pada INTENT.
Jawaban:

**F-2. Butir yang dicatat, tidak dikerjakan.** (1) SIGMA_PROTOCOL tabel section EXEC (baris 270-300) dan rujukan "Section 13/14/17" pada baris 151-182 sudah usang terhadap template saat ini (ditahan; pemilik: review Protocol). (2) AUD-RULE: periksa ada tidaknya rujukan ke section EXEC lama saat F01. (3) PLAN-EXEC-HUMAN-TEMPLATE memetakan section EXEC lama; proyeksi HUMAN dihapus oleh keputusan desain terpisah, bukan oleh E03. (4) F00 T-25: tambah daftar kosakata lock EXEC (verdict `READY_FOR_LOCK`, header "before lock", perintah `exec lock` pada template, DEV-RULE, skill, memory, validator).
Rekomendasi: setuju. T-19 diperbarui: syarat urutan PLAN schema 3 terhadap EXEC v2 dan DEV-RULE terpenuhi pada master setelah E03; yang tersisa adalah sinkronisasi (F09).
Jawaban:

### G. Urutan dan commit

**G-1.** Urutan kerja setelah jawaban: W1 template EXEC schema 3; W2 validator dan test (spesifikasi schema 3, fixture, test schema 2 tetap lolos); W3 DEV-RULE (isi, lalu susun ulang, tabel keterlacakan) dan FMN-RULE F-1; W4 skill (empat target); W5 memory; W6 pemeriksaan paritas teks, satu build, satu `npm test`. Build hanya di W6 karena `dist/` dilacak Git dan sigma-mcp terpasang lewat symlink global.
**G-2.** Commit atas instruksi Director, per kelompok: (1) template, kode, test; (2) DEV-RULE dan FMN-RULE F-1 dengan lampiran keterlacakan; (3) skill dan memory. Dokumen F00 dan E03 ikut kelompok pertama atau terpisah sesuai arahan.
Rekomendasi: setuju.
Jawaban:

## 5. Risiko

- EXEC schema 2 dan schema 3 hidup berdampingan di proyek (template proyek adalah salinan lokal). Pencegahan: validator memilih spesifikasi per schema dan test schema 2 tetap hijau.
- Rules yang ditulis sebelum F04 dapat menyebut perilaku yang belum ada. Pembatasan: butir C-2 dan B-3.
- Penyusunan ulang DEV-RULE dapat mengubah makna tanpa terdeteksi. Pemisahan langkah, verifikasi multiset baris, dan tabel keterlacakan MUST dan MUST NOT mengurangi risiko; koherensi alur bacaan tetap penilaian Director (keterbatasan yang sama dengan E02).
- Perubahan master tidak berlaku di sesi AI atau proyek sampai F09. PLAN schema 3 tidak boleh disinkronkan sebelum E03 selesai (T-19) dan tidak boleh disinkronkan tanpa EXEC v2.
- Build memengaruhi perilaku `sigma-mcp` di seluruh host; build hanya di W6.

## 6. Kriteria selesai

1. Template EXEC schema 3 lolos validator baru; EXEC schema 2 lama tetap lolos (test).
2. Setiap MUST dan MUST NOT lama DEV-RULE memiliki padanan atau alasan penghapusan pada tabel keterlacakan; tidak ada nomor section EXEC dan rujukan dokumen desain internal tersisa di DEV-RULE.
3. Teks Writing Style Rules identik di DEV-RULE, empat skill DEV, dan memory (pemeriksaan teks), dan identik dengan FMN-RULE dan skill FMN.
3a. Code Style Rules (C-5) ada di DEV-RULE; skill dan memory DEV memuat pengingat satu butir yang merujuk DEV-RULE; batas terminologi governance di DEV-RULE tidak berubah.
4. Rujukan nama section EXEC di FMN-RULE sesuai template baru.
5. `npm test` hijau setelah build tunggal; hasil dilaporkan apa adanya.

## 7. Aturan tambahan dari diskusi review (7 Oktober 2026, TERKUNCI)

1. Key Output PLAN tidak memiliki kolom Location; lokasi hasil dilaporkan di EXEC (A-10).
2. Code Style Rules pada DEV-RULE memakai teks draf kedua C-5; komentar kode berbahasa Inggris, tanpa terminologi Sigma; pesan error dan log di luar cakupan (standar UX, dinilai lewat kontrak).
3. Boundary workspace DEV (folder `dev/`, `sigma dev create-workspace`, `sigma dev status`) tidak termasuk E03. Dikerjakan sebagai fokus terpisah (F13) setelah E03 selesai; keputusan desainnya tersimpan di memory sesi `dev-workspace-boundary-design-2026-10-07`. E03 tidak boleh menulis aturan boundary itu ke DEV-RULE.

## 8. Catatan serah terima untuk sesi eksekusi

Keputusan Director (7 Oktober 2026): E03 dieksekusi di sesi baru. Sesi review tidak mengeksekusi apa pun dari E03.

Keadaan kerja saat serah terima (branch `main`, HEAD b0efd1a, tidak ada commit baru dari sesi review):
- Belum di-commit: revisi penghapusan kolom Location pada Key Output (`Sigma/templates/FMN-PLAN-TEMPLATE.md`, `Sigma/rules/FMN-RULE.md`) dan catatan revisinya (`E02_review-plan-template-dan-fmn.md`, `E02_lampiran_keterlacakan-fmn-rule.md`). Kelompok commit ini terpisah dari E03 dan hanya dilakukan atas instruksi Director.
- Belum dilacak Git: dokumen ini.
- Tiga file test dokumen lulus setelah revisi Location (38 test). `npm test` penuh belum dijalankan setelah revisi itu; dijalankan pada W6.

Urutan eksekusi (G-1): W1 template EXEC schema 3; W2 validator dan test; W3 DEV-RULE (isi, kerangka urutan untuk persetujuan, penyusunan ulang, tabel keterlacakan) dan FMN-RULE F-1; W4 skill DEV (4 target); W5 memory DEV; W6 paritas teks, satu build, satu `npm test`. Build dilaporkan ke Director sebelum dijalankan (sigma-mcp terpasang lewat symlink global; `dist/` dilacak Git).

Hal yang tetap berlaku dari sesi E01 dan E02:
- Kerangka urutan baru DEV-RULE diajukan ke Director setelah edit isi selesai (C-3), bukan sebelumnya.
- Dilarang: menyinkronkan ke `~/.sigma/templates` atau proyek (F09); mengubah AUD-RULE, Constitution, Protocol.
- Perubahan F00 yang menjadi bagian eksekusi E03 (F-2): T-25 diperluas dengan kosakata lock EXEC; T-19 diperbarui; baris E03 pada tabel fokus.
- Writing Style Rules F11 ditambahkan pada DEV-RULE, skill DEV, dan memory DEV dengan teks identik dengan FMN-RULE.
- Commit hanya atas instruksi Director, per kelompok (G-2): template/kode/test; DEV-RULE dan FMN-RULE beserta lampiran; skill dan memory.
