# E03 - Lampiran: keterlacakan DEV-RULE (edit isi dan penyusunan ulang urutan)

Tanggal: 7 Oktober 2026

Status: hasil W3. Dua langkah terpisah: (1) edit isi, (2) penyusunan ulang urutan dengan kerangka yang disetujui Director (7 Oktober 2026). Pembanding keterlacakan: DEV-RULE pada HEAD 326841d (785 baris, 33 paragraf MUST dan 24 paragraf "must" huruf kecil).

## 1. Verifikasi penyusunan ulang (langkah 2)

- Jumlah baris: 780 sebelum dan 782 sesudah. Dua baris tambahan adalah judul section baru "EXEC Documentation Rules" dan baris kosong pengiringnya.
- Perbandingan multiset baris tak kosong (tanpa pemisah `---`), 467 sebelum dan 468 sesudah. Selisih seluruhnya terjelaskan:
  - 11 judul diberi nomor baru (Core Responsibilities 1-5 dan EXEC Documentation Rules 1-6);
  - 1 judul section baru "EXEC Documentation Rules";
  - 2 rujukan yang bergantung pada urutan diperbarui: "(§2 below)" menjadi "(§Freedom of Method under Core Responsibilities)" dan "see Change Evidence under Core Responsibilities" menjadi "see Change Evidence under EXEC Documentation Rules".
  - Tidak ada baris isi lain yang berbeda.
- Paragraf yang memuat MUST: 40 sebelum dan 40 sesudah, multiset identik. Paragraf "must" huruf kecil: 24 dan 24; satu paragraf berbeda, yaitu paragraf dengan rujukan "§2 below" di atas.
- Rujukan arah ("above", "below") diperiksa terhadap urutan baru. Seluruhnya berada di dalam section yang sama kecuali "Escalation Path below" pada Technical Research; Escalation Path tetap berada di bawahnya.
- Keterbatasan: pemeriksaan ini membuktikan teks tidak berubah dan tidak hilang. Koherensi alur bacaan tetap penilaian Director.

## 2. Pemetaan section

| Urutan baru | Section | Urutan lama |
|---|---|---|
| 1 | Role | 1 |
| 2 | Core Responsibilities: 1 Implementation Execution, 2 Implementation Reference Sources, 3 Freedom of Method, 4 Technical Objection Duty, 5 Human-Readable Code & Governance Terminology Boundary (termasuk Code Style Rules) | 2 (butir 1, 1b, 2, 3, 9) |
| 3 | Key Rules & Constraints | 3 |
| 4 | Behavioral Standards (termasuk Writing Style Rules) | 7 |
| 5 | Role Stance Requirement | 8 |
| 6 | Role Activation | 6 |
| 7 | EXEC Documentation Rules: 1 EXEC Documentation, 2 Technical Research, 3 Build Result, 4 Deviations, Issues, and Limitations, 5 Developer Verification, 6 Change Evidence | 2 (butir 4, 1c, 5, 6, 7, 8) dan "Git Awareness & Evidence" (digabung, bagian lama dihapus) |
| 8 | Interaction With Other Roles | 4 |
| 9 | Escalation Path | 5 |
| 10 | CLI Operation Policy | 9 |
| 11 | Inter-Role Communication Protocol | 10 |
| 12 | Mandatory Message Triggers | 11 |
| 13 | Final Doctrine | 12 |

## 3. Tabel keterlacakan MUST

Status: **identik** (teks sama), **nama** (hanya sebutan artefak: FMN-PLAN, DIR-INTENT, DEV-EXEC menjadi PLAN, INTENT, EXEC, dan nama section), **diubah** (isi berubah, dengan alasan), **digabung** (duplikat dipadukan tanpa kehilangan kewajiban).

| No | Kewajiban (ringkas) | Section baru | Status |
|---|---|---|---|
| 1 | Baca PLAN terkunci sebelum implementasi material | Core Responsibilities 1 | nama |
| 2 | DEV MUST understand (daftar) | Core Responsibilities 1 | diubah: daftar mengikuti PLAN schema 3 (key output, work order, acceptance criteria dan test contract, constraints for DEV); "DEV handoff instructions" dihapus karena bukan section PLAN schema 3 |
| 3 | Implementasi hanya dalam cakupan PLAN | Core Responsibilities 1 | nama |
| 4 | Tidak menciptakan kebutuhan produk baru | Core Responsibilities 1 | identik |
| 5 | Tidak menebak versi artefak | Core Responsibilities 2 | identik |
| 6 | Menjaga penilaian teknis independen | Core Responsibilities 4 | identik |
| 7 | Menandai tugas yang bermasalah (daftar) | Core Responsibilities 4 | nama (daftar: "inconsistent with PLAN") |
| 8 | Mendokumentasikan pekerjaan di EXEC | EXEC Documentation Rules 1 | nama |
| 9 | Mengisi Director Summary | EXEC Documentation Rules 1 | diubah: nama section; ditambah "lima kalimat paling banyak, bahasa biasa, tanpa ID" (E03 A-8) |
| 10 | Tidak memuat metadata runtime | EXEC Documentation Rules 1 | identik |
| 11 | Menjelaskan apa yang diimplementasikan dan cara kerjanya | EXEC Documentation Rules 3 | diubah: dirujuk ke section Build Result and Verification; Main Flow dan Important Logic menjadi subbagian opsional (A-4); kewajiban inti tidak berubah |
| 12 | Mencatat setiap deviasi dari PLAN | EXEC Documentation Rules 4 | diubah: nama section baru; issue dan limitation dicatat pada tabel yang sama (A-6) |
| 13 | Tidak menyembunyikan deviasi | EXEC Documentation Rules 4 | identik |
| 14 | Mencatat perintah, hasil, bukti verifikasi | EXEC Documentation Rules 5 | identik |
| 15 | Memeriksa kondisi Git sebelum dan sesudah perubahan material | EXEC Documentation Rules 6 | identik |
| 16 | Mencatat bukti perubahan di EXEC | EXEC Documentation Rules 6 | nama ("Git Diff Evidence" menjadi "Change Evidence") |
| 17 | Proyek tanpa Git: `N/A` dan jejak alternatif | EXEC Documentation Rules 6 | nama ("Git / Change Evidence" menjadi "Change Evidence") |
| 18 | Tidak menjalankan `git commit`, `git push`, atau pull request | EXEC Documentation Rules 6 | diubah: kalimat pengingat "setelah EXEC disetujui dan dikunci, ingatkan Director commit dan push" dipindah dari "Git Awareness & Evidence" |
| 19 | Menulis kode yang dapat dibaca manusia | Core Responsibilities 5 | diubah: merujuk Code Style Rules di bawahnya (C-5) |
| 20 | Tidak membocorkan terminologi governance ke kode produk | Core Responsibilities 5 | identik |
| 21 | Tidak mengubah berkas sebelum Director mengotorisasi | Key Rules 7 | identik |
| 22 | Menyatakan ulang otorisasi sebelum mutasi pertama | Key Rules 7 | identik |
| 23 | Eskalasi (daftar kondisi) | Escalation Path | nama (daftar: "PLAN is missing or not locked", "requires new PLAN") |
| 24 | Memverifikasi pasangan PLAN/EXEC yang dikerjakan | Role Activation | diubah: rujukan dokumen desain internal dihapus (C-1 butir 3); aturan tidak berubah |
| 25 | Tidak memulai implementasi sebelum review FMN dan persetujuan Director | Role Activation | identik |
| 26 | Memeriksa kondisi Git saat perubahan material ("Git Awareness & Evidence") | EXEC Documentation Rules 6 | digabung ke butir 15 |
| 27 | Tidak commit atau push ("Git Awareness & Evidence") | EXEC Documentation Rules 6 | digabung ke butir 18 |
| 28 | Tidak menjalankan perintah kelas Approval tanpa persetujuan | CLI Operation Policy | identik |
| 29 | Menjalankan `sigma exec check` sebelum merekomendasikan lock | CLI Operation Policy | identik |
| 30 | Pesan antarperan lewat `sigma send` | Inter-Role Communication Protocol | identik |
| 31 | Trigger 1: kirim pesan ke FMN bila NEED_CLARIFICATION | Mandatory Message Triggers | diubah: kondisi memakai "Readiness Status" pada Implementation Plan (C-1 butir 7) |
| 32 | Trigger 2: minta review pra-build bila CLEAR | Mandatory Message Triggers | diubah: kondisi memakai "Implementation Plan" dan "Readiness Status" (C-1 butir 7) |
| 33 | Trigger 3: minta review pasca-build | Mandatory Message Triggers | diubah: "Sections 5-12" diganti nama section baru (C-1 butir 7) |

Kewajiban MUST baru pada DEV-RULE setelah E03 (tidak ada padanan lama):
- EXEC Documentation Rules 3: DEV MUST mencatat lokasi setiap Key Output PLAN pada Key Output Locations (A-10).
- Core Responsibilities 5, Code Style Rules: sebuah perubahan keterbacaan MUST NOT mengubah perilaku yang diwajibkan, melemahkan validasi, menyembunyikan efek samping, atau membuat kegagalan kurang eksplisit (C-5).

Hasil pemeriksaan: seluruh 33 paragraf MUST lama memiliki padanan; tidak ada yang dihapus.

## 4. Tabel keterlacakan "must" huruf kecil

| No | Kewajiban (ringkas) | Section baru | Status |
|---|---|---|---|
| 1 | Setiap entri Technical Research berakhir pada keputusan | EXEC Documentation Rules 2 | diubah: dipindah; ditambah sumber yang diutamakan dan rujukan silang Implication dari template (C-1 butir 4) |
| 2 | Tidak melanjutkan diam-diam melewati ambiguitas | Core Responsibilities 4 | identik |
| 3 | Tidak menulis ulang kontrak build tanpa instruksi Director | Key Rules 1 | identik |
| 4 | Eskalasi bila implementasi mengungkap ambiguitas strategis | Key Rules 2 | identik |
| 5 | Tidak menambal ambiguitas strategis dengan kode | Key Rules 2 | identik |
| 6 | Implementasi terhadap kontrak pengujian | Key Rules 4 | diubah: "pre-build test contract in FMN-PLAN" menjadi "acceptance criteria and test contract in the PLAN" (C-1 butir 6) |
| 7 | Tidak mendefinisikan ulang keberhasilan setelah coding | Key Rules 4 | identik |
| 8 | Menandai kriteria uji yang salah atau tidak realistis | Key Rules 4 | identik |
| 9 | Tidak menaruh kode sumber di `Sigma/` | Key Rules 5 | identik |
| 10 | Menunggu FMN dan otorisasi ulang bila NEED_CLARIFICATION | Key Rules 7 | diubah: "DEV Pre-Build Assessment status" menjadi "Readiness Status" |
| 11 | Bertanya bila otorisasi tidak jelas | Key Rules 7 | identik |
| 12 | Bertanya ke FMN atau Director bila PLAN tidak jelas | Interaction With Other Roles | nama |
| 13 | FMN membuka atau merevisi plan bila kontrak berubah | Interaction With Other Roles | identik |
| 14 | Sumber terpilih runtime (pasangan PLAN/EXEC) | Role Activation | nama |
| 15 | Warm Context Skip tetap memverifikasi pasangan | Role Activation | identik |
| 16 | Penilaian independen | Role Stance Requirement | identik |
| 17 | Menolak implementasi bila cakupan tidak jelas | Role Stance Requirement | nama |
| 18 | Disiplin AI role bersama | Role Stance Requirement | identik |
| 19 | Meminta persetujuan untuk perintah kelas Approval | CLI Operation Policy | identik |
| 20 | Isi pesan Trigger 1 | Mandatory Message Triggers | identik (butir berisi nama EXEC dan PLAN) |
| 21 | Tidak memulai kode sebelum FMN menjawab dan Director mengotorisasi ulang | Mandatory Message Triggers | identik |
| 22 | Isi pesan Trigger 2 | Mandatory Message Triggers | identik (butir berisi nama EXEC dan istilah Implementation Plan) |
| 23 | Isi pesan Trigger 3 | Mandatory Message Triggers | identik (butir berisi nama EXEC dan istilah DEV Status) |
| 24 | Tidak menunggu perintah Director untuk mengirim pesan Trigger 3 | Mandatory Message Triggers | identik |

Catatan baris 20, 22, dan 23: paragraf pembukanya ("Message must include:") sama persis, sedangkan daftar butir di bawahnya mengikuti perubahan nama (C-1 butir 1 dan 7).

## 5. Perubahan isi yang bukan MUST (ringkasan)

| Perubahan | Lokasi baru | Dasar |
|---|---|---|
| Nama artefak dalam prose menjadi PLAN, INTENT, EXEC, CLOSE; daftar istilah governance beserta contoh buruk-baik tidak diubah | seluruh dokumen | C-1 butir 1, C-5 |
| Rujukan nomor section EXEC diganti nama section; "Sections 5-12" dan daftar section EXEC di bagian dokumentasi mengikuti struktur baru | EXEC Documentation Rules 1; Mandatory Message Triggers | C-1 butir 2 dan 7 |
| Rujukan "PLAN-IMPL-MULTIDRAFT-LOCK ..." dihapus (dua tempat) | EXEC Documentation Rules 2; Role Activation | C-1 butir 3 |
| Technical Research menjadi satu-satunya tempat prosedur riset | EXEC Documentation Rules 2 | C-1 butir 4, A-3 |
| Deviation Update Checklist dari template ditambahkan, nama section disesuaikan | EXEC Documentation Rules 4 | C-1 butir 5, A-6 |
| "locked Pre-Build Test Contract" menjadi "acceptance criteria and test contract in the PLAN" | Mandatory Message Triggers (General Message Policy) | C-1 butir 6 |
| Writing Style Rules (teks identik dengan ARC-RULE, FMN-RULE, dan skill FMN) | Behavioral Standards | C-1 butir 8, F11 |
| "Git Awareness & Evidence" digabung ke Change Evidence; daftar perintah Git dipertahankan | EXEC Documentation Rules 6 | C-1 butir 9 (a) |
| Code Style Rules (draf kedua, tujuh butir) menggantikan butir umum "DEV SHOULD prefer" dan panduan komentar; ditambah kalimat "berlaku untuk kode baru dan yang diubah" dan klausa pada Exception bahwa komentar tidak merujuk artefak, ID, atau versi | Core Responsibilities 5 | C-5 beserta tambahan Director |
| Nama section pada Role dan Behavioral Standards ("Git Diff Evidence" menjadi "change evidence") | Role; Behavioral Standards | C-1 butir 1 dan 2 |

Tidak diubah menurut keputusan E03: batas terminologi governance (daftar istilah, contoh, pengecualian, doktrin) kecuali klausa Exception di atas; Key Rule 5 (boundary `dev/` menjadi bagian F13); aturan Trigger, otorisasi, dan eskalasi di luar perubahan nama.

## 6. Perubahan lintas dokumen pada E03

| Berkas | Perubahan |
|---|---|
| FMN-RULE | F-1: tiga baris pada Trigger 1 (instruksi membuka EXEC, pengingat, isi pesan) memakai "Implementation Plan" dan "Readiness Status". Baris lain yang disebut di E03 (rujukan Director Observation Report & Minor Requests dan FMN Post-Build Review) tidak berubah karena nama section tetap sama. |
| fmn-memory | Satu butir: "open DEV-EXEC" menjadi "open EXEC" (permintaan Director, 7 Oktober 2026). |
| dev-memory | Nama artefak mengikuti DEV-RULE; dua butir pengingat baru (Writing Style Rules dan Code Style Rules); `memory_updated_at` 2026-10-07. |
| Skill DEV (4 target) | Writing Style Rules (identik) dan satu bagian pengingat Code Style Rules; bagian lain tidak diubah. |
| F00 | T-25 diperluas dengan kosakata lock EXEC. |
