# Diskusi Sigma — Sistem Closure, PRODUCT REVIEW, Skoring, dan Sinkronisasi Lanjutan

**Tanggal:** 15 Oktober 2026
**Jenis:** Peta kerja diskusi lanjutan. Setiap butir diputuskan satu per satu oleh Director.
**Status:** Bahan pembahasan. **Bukan** keputusan, persetujuan implementasi, atau perubahan rule, template, atau kode.
**Pendahulu:**
- `DISKUSI_SIGMA_INTENT_CLOSE_PER_SEKSI_2026-10-15.md` (Seksi 1–2 selesai dan diimplementasikan; Seksi 3–7 sebagai bahan asal).
- `DISKUSI_SIGMA_INTENT_STRATEGIS_2026-10-15.md`.

## Cara memakai dokumen ini

- Butir **[Director]** adalah pernyataan Director. **[Verifikasi]** berasal dari pembacaan rule, template, atau kode. **[Inferensi]** adalah penilaian asisten yang belum diputuskan.
- Satu butir dibahas sampai selesai sebelum butir berikutnya dibuka.
- Dokumen Sigma ditulis dalam bahasa Inggris; prosa diskusi ini diterjemahkan saat masuk rule atau template, tidak disalin.
- Batas cakupan [Director, 15 Oktober 2026]: perubahan dibatasi pada ARC, CLOSE, INTENT, dan sistem Sigma yang beririsan dengannya. `AUD-RULE.md` dan `FMN-RULE.md` diizinkan untuk selaras istilah. Perubahan pada PLAN, EXEC, `DEV-RULE.md`, dan kode plan/exec disampaikan dahulu kepada Director.
- Tidak ada perubahan rule sebelum template yang menjadi acuannya final (aturan yang sama dengan tahap 1).

---

## 1. Titik awal

### 1.1 Sudah diputuskan dan diimplementasikan (tahap 1, disetujui Director 15 Oktober 2026)

- Definisi INTENT sebagai mandat strategis; jalur perubahan T1/T2/T3; indikator kualitas "amandemen jarang".
- Template INTENT schema 6 (Core Requirements, Evidence Required, Constraints, Scope sebagai batas mandat, dimensi mutu khusus domain).
- Model path ARC pada aktivasi: diskusi biasa, pengecekan INTENT saat ini, evaluasi produk akhir; INTENT baru bukan path yang ditawarkan kecuali INTENT pertama proyek.
- Perubahan pada `ARC-RULE.md`, `arc-memory.json`, lima skill ARC, tiga berkas bridge, `SIGMA_PROTOCOL.md` §5.1, `cloneDraftService.ts`, dan tiga berkas tes.

### 1.2 Sudah diputuskan sebagai prinsip, belum diimplementasikan

| Butir | Keputusan | Sumber |
|---|---|---|
| Definisi CLOSE | Laporan penutup satu mandat, mirip README produk; memuat keputusan Director menutup atau tidak; merujuk PRODUCT REVIEW; tidak memuat hasil pengujian | Seksi 4 |
| Gate `close new` | Gate 3 (tidak berubah; PLAN/EXEC `SUPERSEDED` tidak memblokir) **dan** PRODUCT REVIEW lengkap; Gate 3.5 digantikan | Seksi 4, 4a |
| PRODUCT REVIEW | Artefak baru; satu per INTENT; versi mengikuti versi INTENT; tanpa mekanisme status; hanya verdict yang berubah; dibuat atas pernyataan eksplisit Director bahwa produk akhir sudah jadi | Seksi 4a |
| Bagian ARC dan AUD | ARC: standar, metode (bebas), hasil, verdict. AUD: advisory, target audit = produk akhir, akses hanya sesuai pemberian Director | Seksi 4a |
| Kewajiban ARC | Menjawab setiap standar INTENT dengan verdict dan dasar bukti; kewajiban membaca seluruh PLAN+EXEC dicabut; bukti proses boleh dipakai (M3) | Seksi 5.2 |
| Sumber baris review | Desired Outcome and Acceptance (1), Core Requirements (1 per REQ), Quality Standards (1 per dimensi bukan N/A), Project Failure (1 bila memuat hal baru) | Seksi 2, D2 |
| Skoring | **Sementara (a):** band turunan otomatis dari verdict PRODUCT REVIEW, bukan gate; rincian ditunda | Seksi 7.5 |
| Kewajiban memeriksa seluruh artefak | Dicabut; metode ARC bebas | Seksi 5.2 |

### 1.3 Asumsi kondisi saat ini [Director, 15 Oktober 2026]

Perubahan sistem skoring, PRODUCT REVIEW, dan closure belum dilakukan dan belum didiskusikan detail. Konsekuensinya, repo saat ini memuat INTENT baru berdampingan dengan sistem CLOSE lama. Bagian 2 mendata kondisi itu.

---

## 2. Keadaan antara (verifikasi 15 Oktober 2026)

| Area | Kondisi saat ini | Ketegangan dengan keputusan |
|---|---|---|
| Gate 3.5 dan `sigma intent score` | Berlaku: `SIGMA_PROTOCOL.md` §Gate 3.5 (`:358`), `README.md:100`, `:534`, registry (`hasGate35Score`, `:785`; operasi `intent_score`, `:1888`) | Keputusan menggantikannya dengan PRODUCT REVIEW |
| Jalur 3 ARC "evaluasi produk akhir" | Merujuk §Closure Evaluation yang masih mewajibkan pembacaan INTENT, ROADMAP, setiap pasangan PLAN+EXEC, dan kode untuk skor | Bertentangan dengan 5.2 (kewajiban dicabut) |
| Template CLOSE (schema 2) §4 | Tabel Intent Satisfaction memakai unsur INTENT lama: Primary objective, Desired Outcome, Success criteria, Scope boundary, Trade-off, Primary failure concern | Tidak sejajar dengan INTENT baru (Success Threshold, Evidence Required, Core Requirements, Quality Standards); dan penilaian per butir seharusnya berada di PRODUCT REVIEW, bukan CLOSE |
| Trigger 2 (ARC menilai ulang dan memberi pesan ke FMN tiap pasangan LOCKED) | Berlaku di ARC-RULE | Butir 5.3 dan 7.3 masih terbuka |
| Petition / Admission Review | Berlaku; `FMN-RULE.md:418`, `:640` menyebut sengketa "ARC Satisfaction Score" | Terikat skor; berubah bila otoritas skor berubah |
| PRODUCT REVIEW | **Tidak ada**: tanpa template, perintah, entri registry, atau nama berkas | Perlu dirancang (Bagian 3A) |
| `AUD-RULE.md` | `:466`, `:482` menyebut "measurement method" (field INTENT sudah menjadi Evidence Required); `:626-656` CLOSE Audit Focus mengaudit skor dan Petition; format audit produk akhir sudah ada (`:770`) | Istilah dan fokus audit CLOSE perlu diselaraskan |
| `README.md:741` | Kloning "schema 5 to 5" | Basi terhadap kode (5→6) |
| Aset host | `~/.sigma/templates/DIR-INTENT-TEMPLATE.md` berbeda dari repo (versi lama) | Perlu `sigma setup update` dan `project sync`; keputusan terpisah |
| `CHANGELOG.md` | Belum memuat template schema 6 dan perubahan ARC | Dicatat saat rilis |

Dampak praktis keadaan antara [Inferensi]: ARC yang aktif memakai INTENT baru, tetapi bila Director memilih path 3, ARC masih menjalankan prosedur lama (baca seluruh chain, skor, Gate 3.5). Itu perilaku yang sudah Anda putuskan untuk dihapus, jadi jendela ketidakkonsistenan ini sebaiknya pendek.

---

## 3. Butir diskusi dan urutan yang disarankan

**Urutan [Inferensi]:** 3A → 3B → 3C → 3D → 3E.
Alasan: set verdict dan arti "lengkap" (3A) menentukan band turunan (3B) dan gate. Mekanisme biaya (3C) dan template CLOSE (3D) mengikuti. Sinkronisasi rule, skill, dan memory (3E) terakhir karena merujuk bentuk final semuanya.

### 3A. Rincian PRODUCT REVIEW (lanjutan Seksi 4a)

**Tujuan:** merancang artefak PRODUCT REVIEW secukupnya agar dapat dipakai, tanpa mekanisme berat.

**Butir yang belum diputuskan (dari Seksi 4a dan masukan eksternal):**

| # | Pertanyaan | Rekomendasi awal [Inferensi] |
|---|---|---|
| A.1 | Arti "lengkap" (syarat `close new`) dan set verdict per baris (M5a) | Lengkap = setiap baris sumber punya verdict; set: *Satisfied / Partially / Not satisfied / Not verified*; kelengkapan tidak menyiratkan rekomendasi menutup |
| A.2 | Status kewajiban bagian AUD (M5b) | Mengikuti §11 protokol: opsional secara default; wajib bila proyek ditandai *risk-sensitive*; pola `SKIP_FOR_AUDIT` dengan instruksi Director verbatim |
| A.3 | Pengikatan identitas produk yang dinilai dan deteksi review basi (M5c) | Berjangkar pada identitas produk (commit, build, atau hash), bukan hanya penguncian pasangan PLAN/EXEC; peringatan, bukan blokir |
| A.4 | Penamaan, registrasi untuk `--related-artifact`, cascade `intent supersede` | Mengikuti konvensi artefak yang ada (`PRODUCT-REVIEW-vN.md`) |
| A.5 | Perintah scaffold dan kelas otoritasnya | Draft/Operational untuk scaffold; pernyataan "produk sudah jadi" tetap dari Director secara percakapan |
| A.6 | Penyimpanan bukti biner (tangkapan layar, rekaman penjelajahan AUD) | Rujukan berkas, bukan penyisipan ke dokumen; belum dirancang |
| A.7 | Urutan penulisan agar review ARC dan AUD saling buta | ARC menyelesaikan bagiannya sebelum mentranskripsikan hasil AUD |
| A.8 | Pengikatan hash PRODUCT REVIEW saat `close lock` | Ikut pola hash yang sudah ada untuk artefak LOCKED |
| A.9 | Nasib `intent-history.md` dan field skor di `progress-v<N>.json` terhadap band turunan | Lihat 3B |

**Syarat keberhasilan desain [M4, Valid]:** total pekerjaan penutupan mandat **berkurang**. Daftar yang digantikan perlu disusun: Closure Evaluation (baca seluruh chain), tier proses Score Methodology, Gate 3.5, Trigger 2 (bila diputuskan), isi evaluatif CLOSE §4 sampai §6, dan Petition/Admission Review bila skor tidak lagi otoritas ARC.

### 3B. Skoring (lanjutan Seksi 7)

**Tujuan:** menetapkan nasib `sigma intent score`, band, dan artefak pendukungnya di bawah keputusan sementara (a).

**Cakupan kode [Verifikasi awal, belum dibaca satu per satu]:** 13 berkas `src/` (`commands/intent.ts`, `commands/close.ts`, `engine/chain.ts`, `engine/reconstruct.ts`, `utils/docCheck.ts`, `utils/intentHistory.ts`, `services/intentScoreService.ts`, `services/closeNewService.ts`, `mcp/policy.ts`, `mcp/control/index.ts`, `mcp/control/tools/prepareIntentScore.ts`, `commitIntentScore.ts`, `preparePlanLock.ts`), 4 berkas `test/`, dan dokumen `ARC-RULE.md`, `FMN-RULE.md`, `SIGMA_PROTOCOL.md`, `arc-memory.json`, registry.

| # | Pertanyaan | Rekomendasi awal [Inferensi] |
|---|---|---|
| B.1 | Bentuk band turunan (nama, ambang) dan siapa yang menghitung | Nama band dipertahankan; dihitung otomatis dari verdict, tanpa angka; menghapus ritual frasa otorisasi komit |
| B.2 | Apa yang terjadi pada `sigma intent score` | Dihapus atau menjadi pembacaan turunan; putuskan setelah 3A |
| B.3 | Trigger 2 (7.3 dan 5.3) | Dihapus sebagai kewajiban; opsional atas permintaan Director atau FMN |
| B.4 | Data skor historis di `progress-v<N>.json` pada proyek berjalan (7.4) | Dibiarkan sebagai catatan historis; tidak ditulis ulang |
| B.5 | Petition / Admission Review bila skor bukan lagi otoritas ARC | Putuskan bersama B.2; jalur keluar Petition (`ARC-RULE` §Mandatory exit paths) disesuaikan; `FMN-RULE.md:418`, `:640` mengikuti |

### 3C. Sistem agar CLOSE murah (lanjutan Seksi 5)

| # | Pertanyaan | Rekomendasi awal [Inferensi] |
|---|---|---|
| C.1 | Otomasi opsional: CLI membuat draf PRODUCT REVIEW terisi dari butir INTENT | Layak karena sumber baris sudah ditetapkan (Seksi 2, D2); ditunda sampai 3A selesai karena menyentuh kode |
| C.2 | Aturan baca ARC pada path 3 | Satu kalimat di rule: kewajiban hasil, bukan cakupan; "Not verified" sah |
| C.3 | Kriteria "pekerjaan penutupan berkurang" sebagai uji penerimaan desain | Adopsi (M4) |

### 3D. Template CLOSE (lanjutan Seksi 6)

| # | Pertanyaan | Rekomendasi awal [Inferensi] |
|---|---|---|
| D.1 | Bagian wajib dan opsional | Wajib: ringkasan bentuk akhir produk, rujukan ke PRODUCT REVIEW, keputusan Director, keterbatasan yang diterima. Lainnya opsional. Penilaian per butir tidak berada di CLOSE |
| D.2 | Handoff operasional dipertahankan? | Dipertahankan sebagai bagian opsional |
| D.3 | Kenaikan schema CLOSE (6.3) | Putuskan setelah inventarisasi kontrak mesin CLOSE di `docCheck.ts` (kriteria sama dengan 2.5: ID marker, urutan, subjudul yang diregex) |
| D.4 | Opsi keputusan CLOSE: `OPEN_NEW_PLAN` dan `UPDATE_CURRENT_EXEC` (4.2) | Dikeluarkan; keduanya adalah "tidak ditutup" dan cukup `DO_NOT_CLOSE` dengan alasan |

### 3E. Sinkronisasi rule, skill, memory, dan sistem (lanjutan Seksi 3)

| Artefak | Perubahan yang diperlukan |
|---|---|
| `ARC-RULE.md` | §Closure Evaluation, §ARC Satisfaction Score Methodology, §Petition / Admission Review, Trigger 2, `:445`-an jalur keluar Petition; drift Petition ("not yet executed", `PLAN-EVAL-04`) |
| `arc-memory.json` | Entri evaluasi dan skor (mis. langkah "ask approval for running sigma intent score") |
| Skill ARC (5 target) | Bagian evaluasi dan skor, bila ada |
| `AUD-RULE.md` | `:466`, `:482`; CLOSE Audit Focus `:626-656`; pola bagian AUD pada PRODUCT REVIEW |
| `FMN-RULE.md` | `:418`, `:640` (hanya bila otoritas skor berubah) |
| `SIGMA_PROTOCOL.md` | §Gate 3.5, deskripsi CLOSE (`:85`), peran ARC (`:119`), artefak baru, §11 AUD |
| `README.md` | `:100`, `:534`, `:741` |
| `SIGMA-OPERATION-REGISTRY.json` | Gate 3.5, `intent_score`, operasi PRODUCT REVIEW |
| `Implementation/sigmav2_implementation/E01_lampiran_keterlacakan-arc-rule.md` | Kemungkinan perlu diperbarui; belum dibaca |
| `CHANGELOG.md`, aset host | Catatan rilis; `sigma setup update` dan `project sync` |

---

## 3F. Arah skoring dan gate (pernyataan Director, 15 Oktober 2026)

**[Director]** Sistem skoring **dihapus total**. Syarat `sigma close new` hanya satu: verdict pada PRODUCT REVIEW terisi dan diterima.

- `close new` membaca tiga verdict langsung dari dokumen PRODUCT REVIEW: (1) verdict **Director**, diisi dengan bantuan ARC, dengan catatan opsional yang ditulis ARC dari penyampaian Director lewat percakapan; (2) verdict **ARC** dari hasil pengujian ARC terhadap produk akhir; (3) verdict **AUD**, hanya bila `SKIP_FOR_AUDIT` tidak dicentang. Bila dicentang, hanya verdict Director dan ARC yang diperlukan.
- Skala verdict sama dengan advisory AUD: `PASS`, `PASS_WITH_RISK`, `REVISE`, `REJECT_RECOMMENDED`, dengan catatan perbaikan yang dibaca FMN.
- Hanya `PASS` dan `PASS_WITH_RISK` yang diterima.
- Mekanisme Petition dihilangkan; aturannya tidak ada lagi. Menyentuh `FMN-RULE.md` dan `AUD-RULE.md` sedikit.
- `sigma close check`: bila PRODUCT REVIEW belum dibuat, melaporkan bahwa CLOSE tidak dapat dibuat karena PRODUCT REVIEW tidak ada; bila ada, memeriksa syarat verdict.

**Status:** arah diterima sebagai pernyataan Director; keputusan D1–D7 tercatat di Bagian 3G.

**Menggantikan butir lama:** 7.5 (band turunan, sementara (a)); 5.3 dan 7.3 (Trigger 2); 4.2 (opsi `OPEN_NEW_PLAN` dan `UPDATE_CURRENT_EXEC`, karena verdict `REVISE` dan `REJECT_RECOMMENDED` menjadi jalurnya); A.1 sebagian (set verdict per baris tidak lagi menjadi gate).

**Verifikasi [15 Oktober 2026]:**

- `sigma close check` **sudah ada**, tetapi memvalidasi struktur dokumen CLOSE yang sudah ada (`close.ts:123-138`, `validateSigmaDocFile(..., 'close')`). Syarat pembuatan (Gate 3, Gate 3.5) dievaluasi oleh `assertCloseNewEligible` di `closeNewService.ts`, dan hanya muncul saat `close new` gagal.
- Mekanisme verdict berbasis centang dengan instruksi verbatim untuk skip sudah ada untuk AUD pada INTENT dan PLAN (`evaluateAudVerdictGate`, `docCheck.ts:499`) dan dapat dipakai ulang.
- Referensi Petition di luar ARC-RULE: `AUD-RULE.md:648-652`, `FMN-RULE.md:418`, `:640`, deskripsi CLI `intent.ts:259`, komentar `intentGit.ts:44`, deskripsi registry `:3429`. Kecocokan "Petition" pada skill humanize adalah kata "repetition" (bukan rujukan).
- Berkas skor/Gate 3.5 (hitungan awal): `src/commands/close.ts`, `commands/intent.ts`, `engine/chain.ts`, `engine/reconstruct.ts`, `mcp/control/index.ts`, `commitIntentScore.ts`, `prepareIntentScore.ts`, `commitCloseNew.ts`, `services/closeNewService.ts`, `services/intentScoreService.ts`, `utils/intentHistory.ts`; tes `control-w2-batch.test.ts`, `helpers.ts`; dokumen `ARC-RULE.md`, `FMN-RULE.md`, `SIGMA_PROTOCOL.md`, `README.md`, `arc-memory.json`, registry.

## 3G. Keputusan D1–D7 (Director, 15 Oktober 2026)

| # | Keputusan |
|---|---|
| D1 | Opsi lama (`DO_NOT_CLOSE`, `OPEN_NEW_PLAN`, `UPDATE_CURRENT_EXEC`) tidak bermakna lagi. Keputusan lama bersifat rekomendasi implisit; `REVISE` tegas: apa pun caranya diperbaiki, baru berubah menjadi `PASS` atau `PASS_WITH_RISK`. |
| Status CLOSE | Hanya `DRAFT` dan selesai (nama `LOCKED` dipertahankan). **Tanpa gate yang menghalangi** `close lock`: longgarkan atau hilangkan syaratnya, karena gate sudah berada sebelum `close new`. `LOCKED` hanyalah stempel bahwa INTENT telah selesai. |
| `close check` | Dipindahkan ke **sebelum** CLOSE dibuat; fungsinya berubah dari pemeriksaan struktur menjadi pemeriksaan syarat CLOSE dapat dibuat (D5). |
| D2 | Blok verdict Director memuat instruksi Director verbatim; tanpa `--director-confirm`. |
| Urutan | ARC lebih dulu, lalu AUD (bila `SKIP_FOR_AUDIT` tidak dicentang), terakhir Director. |
| D3 | Nilai verdict AUD ikut dihitung. AUD diberi ruang terlibat dan wajib disediakan standar verdict sebagai standar kerjanya. `SKIP_FOR_AUDIT` tetap dapat dipilih pada akhirnya. |
| D4 | Seluruh verdict yang diperlukan harus `PASS` atau `PASS_WITH_RISK`; bila salah satu tidak, closure gagal. Pada putaran berikutnya hanya pihak yang belum lulus yang menilai; verdict `PASS` atau `PASS_WITH_RISK` **tidak diubah lagi** demi efisiensi. Contoh: ARC `PASS`, AUD `REVISE`, Director `PASS` → FMN membaca catatan dan membuat kontrak perbaikan → putaran berikutnya hanya AUD yang memeriksa. |
| D5 | `close check` dijalankan sebelum pembuatan CLOSE. |
| D6 | Catatan perbaikan append-only. |
| D7 | Tidak ada override terhadap verdict ARC. |

**Keputusan E1–E4 (Director, 15 Oktober 2026):**

| # | Keputusan |
|---|---|
| E1 | **Ditolak:** tidak ada pengikatan identitas produk dan tidak ada peringatan. Efisiensi didahulukan: ARC yang sudah `PASS` dibebaskan dari pengecekan perubahan terbaru; yang meninjau perbaikan adalah AUD. Pelacakan identitas produk (M5c, A.3) tidak dipakai. |
| E2 | **Ditolak:** verdict `PASS` atau `PASS_WITH_RISK` berlaku **permanen**, tanpa revisi dan tanpa mekanisme buka kembali. Bila ditemukan hal yang perlu diperbaiki, Director diberi tahu atau pesan dikirim ke FMN; dibuka atau tidaknya adalah otoritas Director. |
| E3 | **Diubah:** semua pihak **tetap menilai** pada putaran 1, apa pun hasil pihak sebelumnya. AUD memakai hasil penilaian ARC sebagai referensi audit baseline dan penanda bahwa itu sudah dilakukan, sehingga AUD dapat menilai dari sudut pandang atau aspek lain. **Klarifikasi Director:** independensi bukan hanya larangan menyatakan persetujuan, tetapi juga ketidaksetujuan, keraguan, dan persetujuan atas review pihak lain; tidak ada hak menghakimi hasil review pihak lain. Masing-masing memiliki cara dan sudut pandang sendiri: **AUD** sebagai pengguna independen yang melihat produk dan merespons sendiri; **ARC** dari sudut pandang konsistensi dengan standar INTENT yang tertulis, dengan akses eksplorasi dan verifikasi lebih bebas; **Director** sebagai pemilik proyek, lebih fleksibel dan cenderung subjektif terhadap intent utama terhadap realita produk akhir, dan dapat memberi `PASS` tanpa catatan apa pun bila puas. |
| E4 | **Disetujui:** centang keputusan (Closure Decision) **dihapus dari CLOSE**. Keterbatasan yang diterima diambil dari catatan `PASS_WITH_RISK`. Detail template CLOSE di 3D. |

**Verifikasi tambahan [15 Oktober 2026]:**

- `close lock` saat ini menjalankan `ensureSigmaDocEligible` terhadap dokumen CLOSE (`close.ts:67-122`), termasuk syarat "Closure Decision verdict permits lock" (`docCheck.ts:834-862`; hanya `CLOSE_ACCEPTED` dan `CLOSE_ACCEPTED_WITH_LIMITATIONS` yang mengizinkan). Itu yang akan dilonggarkan. Efek samping `close lock` (ROADMAP ikut `LOCKED`, lifecycle `CLOSED`) tidak diubah.
- `AUD-RULE.md` sudah memiliki "Advisory Verdicts" dan "Verdict Selection Criteria" (`:658-701`), tetapi kriteria itu ditulis untuk INTENT dan PLAN, dan format telaah produk akhir memakai set berbeda (`PASS / PASS_WITH_RISK / REVISE / DO_NOT_CLOSE`, `:775`). Perlu diselaraskan agar PRODUCT REVIEW memakai empat nilai yang sama.

## 3H. Daftar perubahan (DISETUJUI Director, 15 Oktober 2026)

**Persetujuan [Director, 15 Oktober 2026: "setuju semua yang menunggu"]:** draf template PRODUCT REVIEW (lima section, termasuk klarifikasi E3, baris risiko, dan Review Request); daftar perubahan 3H beserta urutan eksekusi, D2 (pertanyaan `PASS_WITH_RISK` sebagai aturan percakapan), dan D3 (R1 otoritas Director, R2 klaim FMN bukan bukti, R3 `--related-artifact`); catatan keadaan akhir risiko di CLOSE. E4 disetujui sebelumnya.

**Status:** disetujui; rencana eksekusi per berkas disusun sebelum ada berkas Sigma yang diubah. Draf template: `Discussion/DRAFT_PRODUCT-REVIEW-TEMPLATE_2026-10-15.md`. Hitungan kode berbasis pencarian simbol; dibaca satu per satu pada tahap rencana.

### A. Artefak baru PRODUCT REVIEW

| Berkas / komponen | Perubahan |
|---|---|
| `Sigma/templates/PRODUCT-REVIEW-TEMPLATE.md` | Baru, schema 1 (lima section: Product Under Review, Review Request, ARC Review, AUD Review, Director Review) |
| `src/utils/docCheck.ts` | Domain `review` baru: spec section, urutan, dan evaluasi verdict (memakai ulang pola `evaluateAudVerdictGate` dan `scanTickedLabels`): tepat satu centang per blok; `SKIP_FOR_AUDIT` dengan instruksi verbatim; instruksi verbatim pada blok Director |
| `src/commands/review.ts` (baru) | `sigma review new` (ARC, Draft/Operational; syarat: INTENT RATIFIED) dan `sigma review check` (read-only; struktur dan status verdict) |
| `src/engine/chain.ts`, penamaan artefak | Catatan registrasi artefak tanpa field status (versi, berkas, waktu); nama `Sigma/review/PRODUCT-REVIEW-vN.md`; agar dapat menjadi `--related-artifact` |
| Registry dan cascade | Entri operasi `review_new`, `review_check`; `intent supersede` ikut men-supersede PRODUCT REVIEW; `test/registry-sync.test.ts` memeriksa kesinkronan |

### B. CLOSE dan gate

| Berkas / komponen | Perubahan |
|---|---|
| `src/services/closeNewService.ts` (`assertCloseNewEligible`) | Gate 3.5 diganti: PRODUCT REVIEW ada; verdict ARC, AUD (bila tidak di-skip), dan Director semuanya `PASS` atau `PASS_WITH_RISK`; pesan galat per kondisi |
| `src/commands/close.ts` (`close check`) | Fungsi berubah: tanpa CLOSE, melaporkan syarat pembuatan memakai fungsi yang sama dengan `close new` (non-throwing); pesan "closure tidak dapat dibuat karena PRODUCT REVIEW tidak ada" bila berkas belum ada |
| `src/commands/close.ts` (`close lock`) | Tanpa gate isi: `ensureSigmaDocEligible` dihapus; hasil validasi struktur hanya peringatan; persetujuan Director dan efek samping (ROADMAP `LOCKED`, lifecycle `CLOSED`) tidak berubah |
| `src/utils/docCheck.ts` (spec CLOSE) | Syarat lock "Closure Decision verdict permits lock" dan syarat isi lain tidak lagi memblokir |
| `src/mcp/control/tools/commitCloseNew.ts`, `prepareIntentScore` terkait | Mengikuti `assertCloseNewEligible` |

### C. Penghapusan skoring (hitungan awal)

| Berkas | Perubahan |
|---|---|
| `src/commands/intent.ts` | Hapus perintah `intent score`; deskripsi yang menyebut Petition (`:259`) disesuaikan |
| `src/services/intentScoreService.ts` | Dihapus |
| `src/mcp/control/tools/prepareIntentScore.ts`, `commitIntentScore.ts`, `mcp/control/index.ts`, `mcp/policy.ts` | Dihapus / registrasi dicabut |
| `src/engine/chain.ts` | Hapus `arcScoreBand`, `hasGate35Score`, `recordArcScore`; field `arc_score*` dipertahankan sebagai catatan historis (dibiarkan, tidak ditulis atau dibaca) |
| `src/engine/reconstruct.ts`, `src/utils/intentHistory.ts` | Hapus rujukan skor dan render skor |
| `src/engine/intentGit.ts` | Komentar `:44` (Petition) |
| `Sigma/SIGMA-OPERATION-REGISTRY.json` | Hapus `intent_score`; ubah `close_new`, `close_check`, `close_lock`; deskripsi `:3429` |
| Tes | `test/control-w2-batch.test.ts`, `test/helpers.ts` (dan kemungkinan `mcp-tools.test.ts`, `progress-hardening.test.ts`); tes baru: dokumen review, `close check` pra-pembuatan, `close lock` longgar, gate `close new` |

### D. Rule, protokol, dan dokumen

| Berkas | Perubahan |
|---|---|
| `ARC-RULE.md` | Hapus §Petition / Admission Review dan jalur keluarnya, §ARC Satisfaction Score Methodology, Trigger 2, Gate 3.5; tulis ulang §Closure Evaluation menjadi evaluasi produk akhir (PRODUCT REVIEW), kriteria verdict ARC, putaran, independensi dari AUD, urutan, penulisan verdict Director secara verbatim |
| `AUD-RULE.md` | Kriteria pemilihan verdict diperluas ke PRODUCT REVIEW; set pada format produk akhir (`:775`) diselaraskan; pemakaian bagian ARC sebagai baseline tanpa menyatakan persetujuan; hapus audit konsistensi Petition (`:648-652`); CLOSE Audit Focus ditulis ulang; istilah `:466`, `:482` |
| `FMN-RULE.md` | Hapus `:418`, `:640`; tambah kewajiban membaca "Required corrections" PRODUCT REVIEW dan membuat kontrak perbaikan |
| `DEV-RULE.md` | Tidak ada perubahan |
| `SIGMA_PROTOCOL.md` | Gate 3.5 dihapus, gate `close new` = Gate 3 + PRODUCT REVIEW; artefak baru; deskripsi CLOSE (`:85`) dan peran ARC (`:119`); tabel perintah dan kelas persetujuan; §11 AUD |
| `README.md` | `:100`, `:534`, `:741`; perintah `review` |
| `arc-memory.json`, skill ARC (5 target), berkas bridge | Entri evaluasi dan skor diganti |
| Template CLOSE (3D) | Centang Closure Decision **dihapus** (E4); bagian evaluatif §4 sampai §6 dihapus atau diringkas; keputusan schema CLOSE setelah inventarisasi kontrak mesin |
| `E01_lampiran_keterlacakan-arc-rule.md`, `CHANGELOG.md`, aset host | Pembaruan dan distribusi |

### D2. Tambahan Director (15 Oktober 2026): PASS_WITH_RISK sebelum CLOSE dibuat

**[Director]** Setelah `close check` lolos dan sebelum CLOSE dibuat, bila ada verdict `PASS_WITH_RISK`, ARC menanyakan kepada Director: lanjut membuat CLOSE, atau kembali ke FMN untuk melengkapi risiko tersebut. Dampaknya catatan risiko mendapat kesempatan diperbaiki, **tanpa mengubah apa pun pada PRODUCT REVIEW** (verdict tetap).

| Komponen | Usulan asisten [belum disetujui] |
|---|---|
| Sifat | Aturan percakapan di `ARC-RULE.md` (ARC menjalankan `close check` sebelum `close new`), bukan gate kode; `close check` mencantumkan pihak ber-`PASS_WITH_RISK` dan catatan risikonya pada keluaran |
| Jalur "kembali ke FMN" | Pesan `sigma send` ARC ke FMN dengan `--related-artifact` ke PRODUCT REVIEW, berisi risiko; FMN membuat PLAN perbaikan lewat alur biasa; Gate 3 berlaku lagi; PRODUCT REVIEW tidak disentuh |
| Tempat risiko ditulis | Baris "Risks left as they are" pada blok temuan ARC, AUD, dan Director (draf template diperbarui) |
| Pertanyaan berulang | ARC menanyakannya setiap kali CLOSE akan dibuat dan masih ada `PASS_WITH_RISK`; keputusan tetap pada Director |
| CLOSE | Karena PRODUCT REVIEW tidak berubah, keadaan akhir risiko (diperbaiki atau tetap) dinyatakan di CLOSE; dibahas di 3D |

### D3. Pertimbangan Director (15 Oktober 2026): section pembuka "Review Request"

**[Director, sedang mempertimbangkan]** Satu section **di atas ARC Review** berisi poin-poin mengapa produk dianggap hampir selesai. Dikirim dari FMN ke ARC lewat `sigma send` sebagai permohonan proses PRODUCT REVIEW, dan ditulis ARC sebagai pembuka. Section yang sama berfungsi sebagai **tindak lanjut hasil perbaikan** berdasar verdict terakhir pada putaran berikutnya.

Draf template diperbarui (section ke-3 dari lima: Product Under Review, Review Request, ARC Review, AUD Review, Director Review).

| Komponen | Usulan asisten [belum disetujui] |
|---|---|
| Penulis | ARC menyalin dari pesan FMN (pola yang sama dengan bagian AUD); DEV tidak menulis |
| Status isi | Klaim FMN, bukan bukti; ARC, AUD, dan Director menilai produk secara independen |
| Isi putaran 1 | Dasar permohonan (pasangan PLAN/EXEC LOCKED dan rujukan bukti), standar yang diyakini terpenuhi (ID atau nama), keterbatasan yang diketahui |
| Isi putaran berikutnya | Perbaikan yang dilakukan sebagai tanggapan atas "required corrections" verdict terakhir, per butir, dengan rujukan PLAN dan EXEC; bahan bagi pihak yang meninjau ulang (mis. AUD) |
| Format | Append-only: blok `FMN - Round <N>` |
| Pemicu **[DISETUJUI Director, 15 Oktober 2026]** | Otoritas tetap Director. FMN **dapat merekomendasikan** produk akhir ditinjau ARC; bila Director menyetujui, FMN mengirim pesan permohonan ke ARC berisi justifikasi mengapa ini waktu yang tepat. Latar: pada Sigma v1 FMN terlalu cepat menyodorkan rekomendasi closure hanya karena gate terbuka, sehingga bersifat prematur dan formalitas; definisi CLOSE yang baru mensyaratkan produk akhir yang dapat ditinjau |
| Isi `FMN-RULE.md` yang diusulkan | (1) FMN boleh merekomendasikan review produk akhir (bukan merekomendasikan closure); (2) rekomendasi memerlukan justifikasi bahwa produk akhir ada dalam bentuk yang dapat ditinjau dan mengapa sekarang; gate terbuka saja bukan justifikasi; (3) FMN mengirim permohonan hanya setelah Director menyetujui; (4) pada putaran berikutnya FMN menanggapi "required corrections" per butir. Ikut diselaraskan: `:353` ("ARC's Periodic Re-evaluation" tidak lagi ada; catatan `NOTED` dapat dibaca ARC sebagai bukti pada product review), `:416`, `:418`, `:629` ("too weak to support closure" menjadi "to support a final product review"), `:640` |
| `--related-artifact` | Putaran 1: `INTENT-vN` (PRODUCT REVIEW belum ada); putaran berikutnya: `PRODUCT-REVIEW-vN` |
| Dampak rule | `FMN-RULE.md`: kewajiban mengirim permohonan dan tanggapan perbaikan (hanya pesan; penutupan tetap tanggung jawab ARC); `ARC-RULE.md`: menyalin apa adanya dan memperlakukan klaim sebagai belum terverifikasi |

### E. Urutan eksekusi yang diusulkan

1. Template dan rule (ARC-RULE, AUD-RULE, FMN-RULE, protokol, README, memory, skill, bridge).
2. Kode: dokumen review, `review new` dan `review check`, gate `close new`, `close check`, `close lock`.
3. Penghapusan skoring dan tes.
4. Build `dist/`, seluruh `vitest`, validasi template.
5. Distribusi aset host (keputusan terpisah).

### Konsekuensi yang diterima Director

- Tidak ada deteksi review basi: verdict yang sudah `PASS` atau `PASS_WITH_RISK` berlaku untuk produk akhir sampai penutupan, terlepas dari perbaikan setelahnya (E1, E2).
- Verdict ARC yang `REVISE` tidak dapat dilewati Director (D7).
- Pemilik verdict tidak dapat membuka kembali verdictnya sendiri; pembukaan hanya melalui Director dan FMN (E2).

## 3I. Rencana eksekusi per berkas (DISETUJUI dan DIEKSEKUSI, 15 Oktober 2026)

**Status:** disetujui Director ("saya menyetujui semua rekomendasi anda"; template CLOSE diserahkan kepada asisten selama CLOSE adalah laporan penutup yang menjawab: produk apa, siapa pengguna, objective utama, fitur utama, limitasi, standar kualitas, cara mengoperasikan (opsional), dan dokumentasi teknis). **Diimplementasikan 15 Oktober 2026**; belum di-commit dan belum didistribusikan.

**Hasil implementasi:** template PRODUCT REVIEW (lima section) dan CLOSE schema 3 terpasang; `docCheck.ts` (domain `review`, gerbang tiga verdict, spec CLOSE v3); `sigma review new|check`; `close new`, `close check` (pra-pembuatan), `close lock` (tanpa gate isi, CLI dan MCP); `PRODUCT-REVIEW-vN` dikenali sistem pesan; skor, Gate 3.5 skor, Trigger 2 skor, dan Petition dihapus; ARC-RULE, AUD-RULE, FMN-RULE, memory ketiganya, skill ARC, bridge, protokol, README, CHANGELOG, dan registry diselaraskan. Verifikasi: build bersih; seluruh `vitest` lulus (84 berkas, 1322 tes).

**Belum dikerjakan:** `Implementation/sigmav2_implementation/E01_lampiran_keterlacakan-arc-rule.md` (lampiran keterlacakan lama); distribusi aset host (`sigma setup update`, `sigma project sync`); commit.

(Rencana asli di bawah dipertahankan sebagai catatan.)

### Temuan inventarisasi yang mengubah rencana

| # | Temuan [Verifikasi] | Akibat |
|---|---|---|
| 1 | `close lock` divalidasi di **tiga** jalur: CLI (`close.ts`), `closeLockService.ts:66-68`, dan `prepareCloseLock.ts:65-67` (MCP) | Ketiganya dilonggarkan bersama agar tidak tidak sejajar |
| 2 | Spec CLOSE (`docCheck.ts:396-411`) mewajibkan sembilan section; syarat lock hanyalah `Closure Decision` (dicentang dan diizinkan) serta `Reason` dan `Closure Sentence` pada `FINAL_DIRECTOR_DECISION` (`:834-899`) | Template CLOSE baru memerlukan **schema 3** dan spec baru; dokumen schema 2 tetap valid lewat spec lama |
| 3 | `intent-history.md` memuat kolom Score dan Notes, dan `reconstruct.ts:314-335` mem-parse baris 7 kolom | Render diubah; parser menerima baris lama (7 kolom) dan baru (5 kolom) |
| 4 | Referensi `--related-artifact` dikenali lewat regex `INTENT|ROADMAP|PLAN|EXEC|CLOSE` di `mailboxContext.ts:116,124,150` | `PRODUCT-REVIEW-vN` ditambahkan di mesin pesan (sistem bersama semua peran) |
| 5 | `test/f01-asset-consistency.test.ts` mengikat hash `fmn-memory.json` dan `aud-memory.json` ke `FMN-RULE.md` dan `AUD-RULE.md` | Mengedit kedua rule mewajibkan memperbarui `source_rule_version` kedua memory |
| 6 | Tujuh rujukan `§Closure Evaluation` pada skill ARC, berkas bridge, dan memory | Bagian diganti nama; rujukan diperbarui |
| 7 | Tidak ditemukan rujukan skor atau Petition pada skill FMN, AUD, DEV; kecocokan pada skill humanize adalah kata "repetition" | Tidak ada perubahan skill selain ARC |

### Fase

| Fase | Berkas | Perubahan |
|---|---|---|
| **P1 Dokumen** | `Sigma/templates/PRODUCT-REVIEW-TEMPLATE.md` (baru) | Dari draf yang disetujui |
| | `Sigma/templates/DIR-CLOSE-TEMPLATE.md` | Schema 3 (usulan di bawah) |
| | `ARC-RULE.md` | Hapus §Petition / Admission Review dan jalur keluarnya, Score Methodology, Trigger 2, Gate 3.5; ganti §Closure Evaluation menjadi §Final Product Evaluation (kriteria verdict ARC, putaran, independensi, penyalinan verdict AUD dan Director apa adanya, pertanyaan `PASS_WITH_RISK` sebelum `close new`, `close check` sebelum `close new`); perbaiki drift Petition |
| | `AUD-RULE.md` | Kriteria verdict untuk PRODUCT REVIEW; set `:775` diselaraskan; baseline dari bagian ARC tanpa menyatakan persetujuan; hapus `:648-652`; CLOSE Audit Focus; `:466`, `:482` |
| | `FMN-RULE.md` | Bagian rekomendasi review produk akhir; `:353`, `:416`, `:418`, `:629`, `:640` |
| | `arc-memory.json`, `fmn-memory.json`, `aud-memory.json` | Entri disesuaikan; `source_rule_version` dihitung ulang |
| | Skill ARC (5 target), bridge (3 berkas) | Rujukan §Final Product Evaluation dan langkah aktivasi |
| | `SIGMA_PROTOCOL.md`, `README.md`, `CHANGELOG.md` | Gate 3.5 dihapus; gate `close new`; artefak PRODUCT REVIEW; perintah |
| **P2 Kode** | `src/utils/docCheck.ts` | Domain `review` (spec, urutan, gerbang verdict tiga blok, `SKIP_FOR_AUDIT` verbatim); spec CLOSE schema 3; `resolveDocSpec` |
| | `src/engine/artifactNames.ts`, `src/engine/mailboxContext.ts` | Domain dan referensi `PRODUCT-REVIEW-vN` |
| | `src/commands/review.ts` (baru), `src/cli.ts` | `sigma review new`, `sigma review check` |
| | `src/services/closeNewService.ts`, `src/commands/close.ts`, `commitCloseNew.ts` | Gerbang baru; `close check` pra-pembuatan; keluaran risiko `PASS_WITH_RISK` |
| | `src/commands/close.ts`, `closeLockService.ts`, `prepareCloseLock.ts` | `close lock` tanpa gate isi |
| **P3 Skor** | `intent.ts`, `intentScoreService.ts` (hapus), `prepareIntentScore.ts` dan `commitIntentScore.ts` (hapus), `mcp/control/index.ts`, `mcp/policy.ts`, `chain.ts`, `reconstruct.ts`, `intentHistory.ts`, registry | Seperti 3H bagian C |
| **P4 Tes dan verifikasi** | `control-w2-batch.test.ts`, `helpers.ts` (+ terkait), tes baru | Build, seluruh `vitest`, validasi template, `git diff --stat` |

### Usulan CLOSE schema 3 (perlu persetujuan; bagian 3D belum dibahas rinci)

| Section (ID marker) | Isi | Asal |
|---|---|---|
| `FINAL_PRODUCT` | Bentuk akhir produk, untuk siapa, cara memakai dan mengakses (mirip README) | Menggantikan `DELIVERED_STATE` |
| `PRODUCT_REVIEW_REFERENCE` | Versi PRODUCT REVIEW dan nilai verdict ketiga pihak; tanpa hasil pengujian | Baru |
| `LIMITATIONS_AS_OF_CLOSURE` | Keterbatasan dan risiko yang diterima beserta keadaan akhirnya saat penutupan (boleh mengoreksi catatan di PRODUCT REVIEW) | Menggantikan `LIMITATIONS_DEVIATIONS_CORRECTIONS` |
| `BUILD_REFERENCE` | Daftar pasangan PLAN dan EXEC LOCKED yang mendukung penutupan | Meringkas `EVIDENCE_MAP` |
| `OPERATIONAL_HANDOFF_NOTES` | Catatan serah-terima (boleh "None") | Dipertahankan |
| `NEW_INTENT_BOUNDARY` | Tujuan lanjutan yang menjadi INTENT baru (boleh "None") | Dipertahankan |
| `CLOSING_STATEMENT` | Satu kalimat Director; tidak diwajibkan isinya | Menggantikan `FINAL_DIRECTOR_DECISION` |

Dihapus: `CLOSURE_DECISION` (E4), `HUMAN_PROJECT_STORY`, `INTENT_SATISFACTION`, `EVIDENCE_MAP`. Tidak ada gerbang isi pada `close lock`.

### Konsekuensi di luar daftar 3H yang perlu persetujuan

| # | Konsekuensi |
|---|---|
| X1 | Template CLOSE schema 3 (usulan di atas) |
| X2 | Registrasi PRODUCT REVIEW berbasis berkas, tanpa field baru pada chain; `artifactNames.ts` dan `mailboxContext.ts` (sistem pesan bersama) ikut berubah |
| X3 | Render `intent-history.md` kehilangan kolom Score dan Notes; parser menerima format lama |
| X4 | `fmn-memory.json` dan `aud-memory.json` diperbarui (hash dan entri terkait) |
| X5 | §Closure Evaluation diganti nama; rujukan pada skill, bridge, dan memory diperbarui |
| X6 | MCP: `closeLockService.ts` dan `prepareCloseLock.ts` dilonggarkan; tool skor dicabut |
| X7 | Distribusi aset host (`sigma setup update`, `project sync`) **tidak** termasuk |

---

## 4. Pertanyaan pembuka yang disarankan

**Mulai dari A.1:** arti "lengkap" dan set verdict PRODUCT REVIEW (termasuk M5a). Alasannya: gate `close new`, band turunan (3B), dan baris yang dihitung ARC semuanya bergantung padanya, dan keputusan ini tidak menyentuh kode.

---

## 5. Masukan eksternal yang terbawa (ChatGPT, 15 Oktober 2026)

| # | Masukan | Status |
|---|---|---|
| M4 | PRODUCT REVIEW harus menggantikan pemeriksaan lama, bukan menambah lapisan | Valid; dijadikan syarat keberhasilan desain (3A) |
| M5a | "Lengkap" ≠ produk memenuhi mandat | Valid; A.1 |
| M5b | AUD opsional berdasar kebijakan risiko; pola skip verbatim | Valid; A.2 |
| M5c | Identitas produk yang dinilai harus terikat | Sebagian valid; A.3 |
| M10 | Jangan merancang mekanisme penutupan sebelum bentuk INTENT final | Terpenuhi: INTENT schema 6 sudah dipasang |

---

## Catatan batas bukti

- Keadaan antara (Bagian 2) berasal dari pembacaan dan pencarian kata kunci pada 15 Oktober 2026; cakupan kode skor belum dibaca satu per satu.
- Belum dibaca: kontrak mesin CLOSE di `docCheck.ts`, isi `E01_lampiran_keterlacakan-arc-rule.md`, dan bagian Closure Evaluation serta Score Methodology secara utuh sejak edit tahap 1.
- Dokumen ini tidak mengubah rule, template, kode, atau state proyek apa pun.
