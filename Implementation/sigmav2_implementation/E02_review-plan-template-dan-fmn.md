# E02 - Review: PLAN template, FMN rules, FMN skill, FMN memory

Tanggal: 7 Oktober 2026
Status: seluruh butir bagian 4 DISETUJUI Director (7 Oktober 2026). E01B selesai dan di-commit (c16095f). Dieksekusi 7 Oktober 2026, belum di-commit: W1 template PLAN schema 3, W2 validator dan test, W3 FMN-RULE (edit isi) dan B-5 (AUD-RULE, Verdict Selection Criteria), W4 skill FMN (4 target), W5 memory FMN, W6 satu build dan `npm test` (71 file, 940 test lulus). Penyusunan ulang urutan FMN-RULE (B-3) selesai sesuai kerangka yang disetujui Director; keterlacakan di [lampiran](E02_lampiran_keterlacakan-fmn-rule.md). Commit per kelompok (E-2) mengikuti instruksi Director setelah seluruh pekerjaan E02 selesai.
Dasar: persetujuan Director 7 Oktober 2026 atas rencana E02 (butir 1-5), keputusan desain 28 September §5.2, §3, §4, dan [F00](F00_indeks-dan-register.md) bagian 7-8.
Label: **TERKUNCI** (keputusan Director), **TERVERIFIKASI** (diperiksa pada berkas), **REKOMENDASI** (asisten, belum keputusan).

## 1. Cakupan

Dikerjakan: FMN-PLAN template (master) beserta validator dan test; FMN-RULE (master); skill FMN di empat target; role memory FMN.
Tidak dikerjakan: status APPROVED, pesan CONTRACT_CHANGE, dan pengikatan revisi (F04); amandemen Git (F05); nama file, marker, dan `type=FMN_PLAN` (F10); EXEC template dan DEV-RULE (sesi DEV); AUD-RULE, Constitution, Protocol (ditahan); sinkronisasi ke `~/.sigma` dan proyek (F09).

## 2. Fakta terverifikasi

1. Template saat ini: `schema=2`, 10 section, 287 baris. Validator (`docCheck.ts` baris 216-249) mewajibkan 9 section; `PRE_REQUIREMENT` opsional. Urutan section diperiksa. Verdict AUD dan `SKIP_FOR_AUDIT` diperiksa berdasarkan isi (baris 83, 426-436).
2. Pemilihan spesifikasi per schema sudah ada untuk INTENT (`resolveDocSpec`, `INTENT_SPEC_V5`). Pola yang sama dapat dipakai untuk PLAN.
3. ID section PLAN dipakai hanya oleh `docCheck.ts`, `test/doc-check-optional-sections.test.ts`, `test/helpers.ts`, dan `test/reconstruct.test.ts`.
4. EXEC template memuat tabel hasil AC (`AC-001`) dan tabel "Test Contract Result" (`TC-001`) (DEV-EXEC-TEMPLATE baris 376-382). DEV-RULE merujuk "locked Pre-Build Test Contract" (baris 771). `fidelityCoverage.ts` baris 129 mengenali pola ID `TASK-`, `AC-`, `TC-`, `OBS-`, `REQ-`.
5. FMN-RULE memuat sisa model dua lapis di baris 37, 164, 166, dan rujukan "Section 14" di baris 297. Rujukan nomor section PLAN tersebar di baris 245-309.
6. INTENT template lama (sebelum E01) memuat §11.2 "FMN Must Produce" dan §11.3 "FMN Must Preserve Quality Bar". Keduanya sudah dihapus dari INTENT schema 5 dan **tidak ada di FMN-RULE** (grep "Quality Bar" di FMN-RULE hanya menemukan "Preserve DEV freedom"). Isi §11.2 juga meminta bagian "Post-Build Test Report", "Implementation Report", dan "Evidence Summary" di PLAN, padahal FMN-RULE baris 308 menyatakan FMN tidak menulis konten pasca-build di PLAN. Kontradiksi ini sudah ada sebelum E01.
7. **Temuan baru dari E01.** INTENT schema 5 menulis "Verdict meanings are in AUD-RULE". AUD-RULE hanya memuat tabel satu baris per verdict (baris 685-695). Kriteria pemilihan verdict yang ditambahkan pada rilis 1.0.0 (kondisi PASS_WITH_RISK, kewajiban audit ulang pada REVISE, syarat REJECT_RECOMMENDED, batas putaran revisi) ada di FMN-PLAN template (baris 228-234) tetapi sudah hilang dari INTENT template. Rujukan itu tidak terpenuhi. Perbaikannya ada di AUD-RULE (ditahan); lihat butir B-5.
8. FMN-PLAN-TEMPLATE menyebut "DIR-INTENT Section 14 (Amendment History)" di bagian Protocol Overrides; nomor section tidak berlaku pada INTENT schema 5.
9. Skill FMN identik di tiga target (118 baris: codex, reasonix, antigravity) dan 124 baris di claude_code. Memory FMN: `source_rule_version: "unversioned"`, `memory_updated_at: 2026-09-12`.

## 3. Usulan struktur PLAN schema 3 (REKOMENDASI)

Mengikuti §5.2 dokumen 28 September, dengan nama section berbahasa Inggris seperti INTENT schema 5 dan penanda `type=FMN_PLAN` tetap.

| No | Section (ID validator) | Status | Asal |
|---|---|---|---|
| 1 | Director Summary (`DIRECTOR_SUMMARY`) | wajib | Section 10 lama, dipindah ke atas |
| 2 | Source Alignment (`SOURCE_ALIGNMENT`) | wajib | Section 1 lama, diringkas |
| 3 | Objective (`OBJECTIVE`) | wajib | Baru; "Build Objective" lama dipromosikan (keputusan Director, opsi B) |
| 4 | Requirement (`REQUIREMENT`) | opsional | 2.1 + 2.2 digabung dan dirumuskan ulang (A-3); Ownership pindah ke FMN-RULE |
| 5 | Key Output (`KEY_OUTPUT`) | wajib | Baru (A-3) |
| 6 | Work Order (`WORK_ORDER`) | wajib | Section 3 lama, hanya tabel tugas |
| 7 | Acceptance Criteria and Test Contract (`ACCEPTANCE_AND_TEST_CONTRACT`) | wajib | Section 4 + 7 lama digabung |
| 8 | Constraints for DEV (`CONSTRAINTS_FOR_DEV`) | wajib | Section 5 + 8 lama digabung; "DEV should report" dihapus |
| 9 | Work Outside Intent (`WORK_OUTSIDE_INTENT`) | opsional | Section 6 lama |
| 10 | Contract Changes (`CONTRACT_CHANGES`) | opsional | Baru (D-08, D-09); lihat A-6 |
| 11 | AUD Notes (`AUD_NOTES`) | wajib | Section 9 lama |

Objective: 1-3 kalimat dalam bahasa biasa tanpa ID dan tanpa daftar tugas. Objective ditulis pertama dan menjadi jangkar uji Key Output dan uji Requirement di FMN-RULE: sebuah keluaran adalah Key Output hanya bila tertulis di tujuan kontrak, kontrak dianggap gagal tanpanya, dan ia tidak ada hanya untuk membuktikan atau memungkinkan keluaran lain.

Perubahan atas §5.2: (1) Requirement dan Key Output menggantikan tabel Prasyarat (A-3); (2) Objective menjadi section sendiri; (3) Director's Summary menjadi section pertama bernomor 1 di antara section wajib, tanpa "Section 0", karena INTENT schema 5 memakai heading tanpa nomor.

## 4. Butir keputusan

Setiap butir: pertanyaan, opsi, rekomendasi. Kolom jawaban diisi Director.

### A. PLAN template

**A-1. Struktur section.** Opsi: (a) struktur bagian 3 (11 section, dengan Objective sebagai section sendiri sesuai keputusan Director); (b) struktur bagian 3 tanpa Contract Changes sampai F04 selesai; (c) pertahankan 10 section dan hanya pindah ringkasan ke atas.
Rekomendasi: (a). Butir ini mencakup keputusan Director tanggal 7 Oktober (section Contract Changes opsional, tanpa validasi isi).
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**A-2. Gabungan Acceptance Criteria dan Test Contract.** §5.2 menetapkan satu tabel `AC-xxx` berisi kriteria, cara uji, hasil yang diharapkan, dan bukti. Dampak terverifikasi (fakta 4): EXEC template schema lama punya tabel `TC-xxx` terpisah, dan DEV-RULE merujuk "Pre-Build Test Contract". Opsi: (a) satu tabel `AC-xxx`; setiap kriteria yang butuh beberapa uji dipecah menjadi beberapa baris AC; (b) satu tabel `AC-xxx` dengan kolom "Tests" yang memuat daftar `TC-xxx` bernomor; (c) tetap dua tabel.
Rekomendasi: (a). Alasan: pemetaan 1:1 antara kriteria dan uji, yang oleh EVALUASI-SIGMA bagian 5 dinilai sebagai bagian paling bernilai, terjamin oleh struktur dan tidak lagi perlu diperiksa manual. Konsekuensi: PLAN schema 3 hanya dapat disinkronkan bersama EXEC template v2 dan perubahan DEV-RULE (sesi DEV); sebelum itu PLAN schema 3 tidak boleh masuk `~/.sigma/templates`. Saya catat sebagai syarat urutan di F00 (T-19).
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**A-3. Requirement dan Key Output. KEPUTUSAN DIRECTOR (7 Oktober 2026, sebagian; lihat butir terbuka).**

*Requirement* (menggantikan 2.1 Sigma Artefact Requirement dan 2.2 Output Requirement): file kunci yang menjadi rujukan atau dibutuhkan agar kontrak ini dapat dipenuhi. Tidak ada dikotomi artefak Sigma dan bukan; FMN boleh memasukkan artefak Sigma bila penting, dan boleh file lain.

| Kolom | Isi |
|---|---|
| No | Nomor urut |
| Item | Path file atau artefak (satu item per baris) |
| Role | `Reference` atau `Input` |
| Why Matters | 1-2 kalimat: seberapa parah kontrak tidak dapat dieksekusi bila item ini tidak ada |
| Status | `AVAILABLE` atau `NOT_YET_AVAILABLE` |

Status `DRAFT/LOCKED/SUPERSEDED` tidak dipakai karena dapat dicek langsung lewat operasi Sigma. FMN-RULE menyatakan bahwa `AVAILABLE` hanya berarti item ada dan dapat dibaca, bukan bahwa item benar, final, atau LOCKED.

*Key Output*: keluaran akhir kunci yang dihasilkan bila kontrak terpenuhi.

| Kolom | Isi |
|---|---|
| No | Nomor urut |
| Output | Nama keluaran |
| Category | `Creation` (menghasilkan sesuatu yang baru), `Modification` (memperbaiki keluaran pekerjaan sebelumnya), atau `Report` (laporan pengujian atau pengecekan tertentu). Satu baris satu kategori |
| Description | Satu kalimat |
| Location | Folder dan nama lokasi penyimpanan; untuk keluaran berupa kumpulan file (misalnya source code model) cukup folder dan namanya |

Alasan Director: lokasi dan nama keluaran sering ditentukan sendiri oleh DEV; kolom Location membuat keduanya menjadi bagian kontrak. Kolom "Verified by" tidak dipakai karena redundan dengan section kontrak uji.

Pengaman terhadap file pendukung (Director: FMN tidak boleh memasukkan file pendukung): kolom Why Matters, dan uji seleksi di FMN-RULE: item masuk Requirement hanya bila kontrak tidak dapat dipenuhi atau diverifikasi tanpanya; item masuk Key Output hanya bila berupa keluaran akhir yang akan dicari Director. File antara, log, dan file pendukung masuk ke Work Order atau Constraints. Kolom "Expected Output" pada tabel tugas tetap untuk keluaran per tugas; Key Output hanya keluaran akhir kontrak (pembedaan ditulis di FMN-RULE). Lokasi keluaran adalah hasil kontrak, bukan metode, sehingga bukan pelanggaran "preserve DEV freedom of method"; pengecualian ini ditulis eksplisit. FMN-RULE juga menyatakan bahwa setiap Key Output harus dapat diverifikasi oleh sedikitnya satu AC (aturan, bukan kolom).

Aturan kategori (ditulis di FMN-RULE): `Modification` mencantumkan di Location path file atau folder yang diubah, dan item yang sama ada di Requirement dengan Role `Input`. `Report` adalah laporan yang menjadi hasil kontrak; DEV-EXEC tidak dicantumkan karena selalu ada.

Jawaban Director (7 Oktober 2026), mengikuti rekomendasi: (1) peringatan validator (tidak memblokir) bila satu tabel melebihi 5 baris; (2) Key Output wajib, dengan satu baris "Tidak ada keluaran berupa file" bila hasilnya perubahan perilaku. Kolom Category ditambahkan atas permintaan Director.
Jawaban: DIJAWAB (lihat di atas)

**A-4. Constraints for DEV.** Tabel Constraint/Source/DEV Freedom dipertahankan, ditambah dua daftar "DEV must" dan "DEV must not". Daftar "DEV should report in DEV-EXEC" dihapus karena sama di setiap proyek; DEV-RULE sudah memuat daftar laporan (baris 169 dan 560). Opsi: (a) hapus daftar dari template tanpa menambah apa pun ke DEV-RULE; (b) hapus dan pindahkan butir yang belum ada di DEV-RULE (sesi DEV).
Rekomendasi: (b). Pada E02 saya hanya membandingkan dan melaporkan butir yang belum tercakup; penambahan ke DEV-RULE menunggu sesi DEV.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**A-5. Work Outside Intent.** Kolom Item, Justification, Status, Notes dipertahankan. Kosakata status `NOTED`, `AMENDMENT_REQUESTED`, `AMENDMENT_RATIFIED` dan rujukan "Section 14 / `AMD-NNN`" bergantung pada model amandemen yang diganti F05. Opsi: (a) pertahankan kosakata sekarang; rujukan menjadi "Amendment History" tanpa nomor; (b) ubah kosakata sekarang.
Rekomendasi: (a). Kosakata baru perlu dirancang bersama F05.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**A-6. Contract Changes.** Tabel opsional dengan kolom: No, Checkpoint, What changed, Reason, Requested by, Loosening?, Director approval (§3.2). Template memuat tabel dan satu baris petunjuk. Aturan checkpoint, pesan CONTRACT_CHANGE, dan persetujuan pelonggaran ditulis di FMN-RULE setelah F04 ditutup; pada E02 FMN-RULE hanya menyatakan bahwa tabel ini ada dan opsional. Opsi: (a) sesuai rekomendasi; (b) tabel dan aturan ditulis penuh sekarang.
Rekomendasi: (a). Aturan yang merujuk status APPROVED dan jenis pesan yang belum ada di CLI akan menyesatkan FMN.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**A-7. AUD Notes dan kriteria verdict.** Kotak verdict, `SKIP_FOR_AUDIT`, dan field "Director Instruction (verbatim)" tidak berubah karena divalidasi kode. Kriteria pemilihan verdict (fakta 7) adalah bagian panjang di template. Opsi: (a) pertahankan di PLAN template sampai AUD-RULE memuatnya, lalu ganti dengan rujukan; (b) ganti dengan rujukan sekarang seperti INTENT schema 5, dan kriteria dipindahkan ke AUD-RULE pada saat yang sama.
Rekomendasi: (a). Menghapus kriteria sebelum AUD-RULE memuatnya mengulang celah yang sudah terjadi di INTENT. Keputusan AUD-RULE ada di butir B-5.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**A-8. Isi Director Summary.** §4 dokumen 28 September: maksimal 5 kalimat, tanpa jargon dan ID, di bagian atas. Subbagian "Open Question / Unclear Decision" lama: (a) dihapus, pertanyaan terbuka masuk ke kalimat ringkasan atau pesan ke Director; (b) dipertahankan sebagai baris opsional di bawah ringkasan.
Rekomendasi: (b). Alasannya, keputusan yang belum jelas harus terlihat sebelum approve, dan tempatnya tetap di awal dokumen.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**A-9. Validator.** `docCheck.ts`: spesifikasi PLAN dipilih menurut `schema` (2 tetap tanpa perubahan, 3 memakai spesifikasi baru). Persyaratan lock schema 3: verdict AUD terisi (logika yang ada), Director Summary terisi, dan Source Alignment mencantumkan versi INTENT. Opsi untuk pemeriksaan tambahan: (a) hanya tiga hal itu; (b) ditambah peringatan (tidak memblokir) bila ada AC tanpa kolom Test Method atau Expected Result terisi.
Rekomendasi: (b). Peringatan murah dan menjaga disiplin kontrak uji; tidak memblokir sehingga tidak menjadi gerbang baru.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

### B. FMN-RULE

**B-1. Hapus model dua lapis.** Baris 37, 164, 166, 297 ditulis ulang: FMN tidak menambah persyaratan di luar INTENT yang berlaku; ketidakjelasan atau kebutuhan perubahan INTENT dieskalasi ke Director atau ARC melalui jalur Amendment Request yang ada. Rujukan "Section 14" menjadi "Amendment History". Tidak ada pengganti konsep tier.
Rekomendasi: setuju (konsisten dengan keputusan penghapusan tier). Opsi lain: tidak ada.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**B-2. Standar kualitas dan Guidance for FMN (direvisi setelah keputusan Director menghapus Guidance for FMN, lihat E01B).** FMN-RULE memuat satu aturan bersyarat: "FMN reads the INTENT before drafting a PLAN. If the INTENT states a quality standard that applies, each such standard becomes an acceptance criterion in the PLAN. A standard marked N/A creates no obligation." Tidak ada section, kolom, atau validator baru di PLAN. Kewajiban membaca Guidance for FMN dihapus karena section itu dihapus dari INTENT. Butir "Post-Build Test Report / Implementation Report / Evidence Summary" tidak dihidupkan kembali karena bertentangan dengan FMN-RULE baris 308. Pengisian kekosongan fakta 6 dilakukan oleh aturan bersyarat ini.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), dalam bentuk aturan bersyarat di atas.

**B-3. Penyusunan ulang urutan.** Mengikuti metode E01: edit isi dulu; penyusunan ulang urutan sebagai langkah terpisah dengan kerangka urutan baru untuk persetujuan dan tabel keterlacakan setiap MUST dan MUST NOT. FMN-RULE memuat 631 baris dan hanya sebagian kecil kewajibannya berubah. Opsi: (a) sesuai metode E01; (b) tanpa penyusunan ulang, hanya edit isi.
Rekomendasi: (a), dengan kerangka diajukan setelah edit isi selesai. Bagian "FMN-PLAN Creation Rules" (baris 243-324) paling berdampak karena memuat rujukan nomor section dan penjelasan template yang dipindahkan dari template.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**B-4. Nomor section dan prefix role.** Rujukan nomor ke template diganti rujukan nama section (keputusan Director no. 3). Nama artefak: INTENT, PLAN, EXEC, CLOSE dalam teks rules, mengikuti E01 dan T-16; ID gate dan nama file lama yang masih berlaku di proyek lama disebut apa adanya.
Rekomendasi: setuju.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**B-5. Kriteria verdict (butir fakta 7).** Lokasinya AUD-RULE, yang termasuk F01 ditahan. Opsi: (a) pada E02, kriteria pemilihan verdict dipulihkan ke AUD-RULE bagian "Verdict Meanings" sebagai tambahan terbatas (tanpa mengubah bagian lain); (b) hanya dicatat sebagai butir F01 dan INTENT schema 5 menyatakan rujukan yang belum terpenuhi sampai F01; (c) PLAN template (A-7a) dan INTENT template dipulihkan memuat kriteria sampai F01.
Rekomendasi: (a). Rujukan yang tidak terpenuhi berlaku di INTENT schema 5 dan akan berlaku pula di PLAN; tambahan terbatas tidak mendahului review AUD-RULE oleh Director karena teksnya diambil dari template yang sudah berlaku sejak 1.0.0. Butuh persetujuan Director karena AUD-RULE ditahan.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**B-6. Writing Style Rules (F11).** Teks F11 bagian 4 ditambahkan pada `Behavioral Standards`, berlaku untuk PLAN dan bagian ROADMAP yang disunting manual. Teks identik dengan ARC-RULE.
Rekomendasi: setuju (TERKUNCI di F11).
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**B-7. Standar perilaku "avoid unnecessary governance ceremony" (butir 9).** ARC-RULE menghapus butir serupa ("preserve Sigma simplicity"). Opsi: (a) hapus dari FMN-RULE; (b) pertahankan.
Rekomendasi: (a), konsisten dengan ARC-RULE batch A; frasa ini tidak memiliki konsekuensi yang dapat diuji.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

### C. Skill FMN (4 target)

**C-1.** Tambahan Writing Style Rules (teks sama dengan rules). Perbaikan sebutan yang bertentangan dengan rules baru dilaporkan lebih dulu; tabel label manusia (DIR-INTENT dan sebagainya) tetap sampai F10 (keputusan Director pada E01).
Rekomendasi: setuju. Skill claude_code berbeda 6 baris dari tiga target lain; saya periksa penyebabnya dan menyamakan bila hanya perbedaan format.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

### D. Memory FMN

**D-1.** Tambahan: pengingat singkat Writing Style Rules (seperti ARC memory), perbaikan sebutan usang pada butir role-specific ("non-scope" dan sejenisnya bila ada), dan `memory_updated_at`.
**D-2.** `source_rule_version`: T-18 mengunci bahwa nilainya bukan `unversioned`, tetapi bentuknya (semver per rule atau hash isi) belum diputuskan. Opsi: (a) biarkan `unversioned` sampai F01 memutuskan bentuk; (b) pakai tanggal revisi rule sementara.
Rekomendasi: (a). Mengisi nilai sebelum bentuknya diputuskan menciptakan format yang harus diganti.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

### E. Urutan dan commit

**E-1.** Urutan kerja setelah jawaban: W1 template, W2 validator dan test, W3 FMN-RULE (isi, lalu susun ulang), W4 skill, W5 memory, W6 paritas, satu build, satu `npm test`. Build hanya di W6 (symlink global).
**E-2.** Commit per kelompok atas instruksi Director: (1) template dan kode dan test; (2) FMN-RULE; (3) skill dan memory; dokumen F00/E02 ikut kelompok pertama atau terpisah sesuai arahan.

## 5. Risiko

- PLAN schema 3 dan EXEC template schema lama tidak kompatibel pada tabel Test Contract (A-2). Pencegahannya adalah syarat urutan sinkronisasi (T-19), bukan perubahan kode.
- Rules yang ditulis sebelum F04 dapat menyebut perilaku yang belum ada. Pembatasan: FMN-RULE hanya menyatakan keberadaan Contract Changes (A-6).
- B-5 menyentuh AUD-RULE yang ditahan; tidak dikerjakan tanpa persetujuan eksplisit.
- Build memengaruhi perilaku `sigma-mcp` di seluruh host; build hanya di W6.

## 6. Kriteria selesai

1. Template schema 3 lolos validator baru; PLAN schema 2 lama tetap lolos (test).
2. FMN-RULE tanpa sebutan tier, nomor section ke template, dan rujukan "Section 14"; setiap MUST/MUST NOT lama punya padanan atau alasan penghapusan di tabel keterlacakan.
3. Teks Writing Style Rules identik di FMN-RULE, empat skill, dan memory (pemeriksaan teks).
4. `npm test` hijau setelah build tunggal; hasil dilaporkan apa adanya.

## 7. Aturan tambahan dari diskusi review (7 Oktober 2026, TERKUNCI)

Ditulis di FMN-RULE pada W3:
1. Requirement dan Key Output memuat hanya item kunci. Item masuk Requirement bila kontrak tidak dapat dipenuhi atau diverifikasi tanpanya; item masuk Key Output bila tertulis di Objective dan kontrak dianggap gagal tanpanya. File pendukung dan keluaran antara masuk Work Order atau Constraints.
2. Status Requirement hanya `AVAILABLE` / `NOT_YET_AVAILABLE`; `AVAILABLE` berarti item ada dan dapat dibaca, bukan benar, final, atau LOCKED.
3. Setiap Key Output dapat diverifikasi oleh sedikitnya satu AC. `Modification` mencantumkan path yang diubah dan item yang sama ada di Requirement dengan Role `Input`. `Report` adalah laporan yang menjadi hasil kontrak; DEV-EXEC tidak dicantumkan.
4. Location pada Key Output adalah hasil kontrak, bukan metode; pengecualian dari "preserve DEV freedom of method".
5. Objective ditulis pertama, 1-3 kalimat tanpa ID dan tanpa daftar tugas.
6. Peringatan validator (tidak memblokir) bila satu tabel Requirement atau Key Output lebih dari 5 baris; Key Output wajib.
