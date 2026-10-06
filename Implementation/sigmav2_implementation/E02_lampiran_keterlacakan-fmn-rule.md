# E02 - Lampiran: keterlacakan FMN-RULE (edit isi dan penyusunan ulang urutan)

Tanggal: 7 Oktober 2026

Status: hasil W3. Dua langkah terpisah: (1) edit isi, (2) penyusunan ulang urutan dengan kerangka yang disetujui Director. Sesudah keduanya, satu butir dipulihkan (O21, bagian 3).

## 1. Verifikasi penyusunan ulang (langkah 2)

- Jumlah baris sebelum dan sesudah penyusunan ulang: 630 dan 630. Perbandingan multiset baris (tanpa baris kosong dan pemisah `---`): tidak ada baris yang berbeda.
- Paragraf yang memuat MUST atau MUST NOT: 35 sebelum dan 35 sesudah, seluruhnya identik.
- Rujukan arah ("above", "below", "triggers above", "tests below") diperiksa terhadap urutan baru; seluruhnya berada di dalam section yang sama dan tetap benar.
- Keterbatasan: pemeriksaan ini membuktikan teks tidak berubah dan tidak hilang. Koherensi alur bacaan tetap penilaian Director.

## 2. Pemetaan section

| Urutan baru | Section | Urutan lama |
|---|---|---|
| 1 | Role | 1 |
| 2 | Core Responsibilities | 2 |
| 3 | Key Rules & Constraints | 3 |
| 4 | Behavioral Standards (termasuk Writing Style Rules) | 11 |
| 5 | Role Stance Requirement | 12 |
| 6 | Role Activation | 9 |
| 7 | Mandatory: ROADMAP as Staging Requirement | 4 |
| 8 | PLAN Creation Rules | 5 |
| 9 | AUD Findings Section Authorization | 6 |
| 10 | Interaction With Other Roles | 7 |
| 11 | Git Awareness | 10 |
| 12 | CLI Operation Policy | 13 |
| 13 | Inter-Role Communication Protocol | 14 |
| 14 | Mandatory Message Triggers | 15 |
| 15 | Escalation Path | 8 |
| 16 | Final Doctrine | 16 |

## 3. Tabel keterlacakan MUST dan MUST NOT

Pembanding: FMN-RULE pada HEAD sebelum E02 (35 paragraf). Status: **identik** (teks sama), **nama** (hanya sebutan artefak: DIR-INTENT, FMN-PLAN, DEV-EXEC menjadi INTENT, PLAN, EXEC), **diubah** (isi berubah, dengan alasan).

| No | Kewajiban (ringkas) | Section baru | Status |
|---|---|---|---|
| O1 | FMN MUST read the locked INTENT before creating or revising PLAN | Core Responsibilities | nama; ditambah satu kalimat aturan Quality Standards bersyarat (B-2) |
| O2 | MUST translate the intent into ... | Core Responsibilities | identik; daftar butirnya diganti nama section PLAN schema 3 |
| O3 | MUST ensure tasks are clear, bounded, testable, ... | Core Responsibilities | identik |
| O4 | MUST NOT invent requirements beyond ratified INTENT | Core Responsibilities | diubah (B-1): penjelasan lapisan Sovereign/Operationalization dan "Section 14" dihapus; larangan dan jalur Amendment Request dipertahankan |
| O5 | MUST define test behavior, method, expected result, evidence | Core Responsibilities | identik |
| O6 | MUST NOT allow success criteria to be invented after implementation | Core Responsibilities | identik |
| O7 | MUST NOT dictate low-level coding style | Core Responsibilities | identik |
| O8 | MUST distinguish bugs, misunderstandings, mismatches, limitations | Core Responsibilities | identik |
| O9 | MUST NOT write implementation code | Key Rules & Constraints | identik |
| O10 | MUST decline and respond when asked to implement | Key Rules & Constraints | identik |
| O11 | MUST then send the implementation request to DEV | Key Rules & Constraints | identik; contoh subjek pesan memakai nama baru |
| O12 | MUST NOT override INTENT | Key Rules & Constraints | diubah (B-1): paragraf dua lapis ditulis ulang tanpa tier; larangan, kewajiban bertanya, dan jalur Amendment Request dipertahankan |
| O13 | MUST NOT silently reinterpret Director intent | Key Rules & Constraints | identik |
| O14 | MUST NOT approve runtime state | Key Rules & Constraints | identik |
| O15 | MUST NOT blindly accept AUD criticism | Key Rules & Constraints | identik |
| O16 | MUST preserve DEV freedom of method | Key Rules & Constraints | identik; pengecualian Location Key Output ditulis di PLAN Creation Rules (N3) |
| O17 | MUST create a ROADMAP before any PLAN | Mandatory: ROADMAP as Staging | nama |
| O18 | MUST reference the source stage in PLAN | Mandatory: ROADMAP as Staging | diubah: "Section 1 (Source Alignment)" menjadi nama section; ditambah baris versi INTENT (syarat lock A-9) |
| O19 | MUST fill Protocol Overrides & Expansions when work is outside INTENT | PLAN Creation Rules | diubah (A-5): menjadi "Work Outside Intent"; kosakata status dipertahankan; bila tidak ada, section dihapus (opsional) |
| O20 | MUST check highest minted ID before assigning a new one | PLAN Creation Rules | diubah: prefix `TC-` dan `RQ-` dihapus (TC digabung ke AC, A-2) |
| O21 | Post-build content tidak ditulis di PLAN; MUST fill Director's Summary | PLAN Creation Rules | dipecah: larangan konten pasca-build dipertahankan; kewajiban mengisi Director Summary dipertahankan (dipulihkan setelah pemeriksaan ini) |
| O22 | MUST NOT include runtime metadata | PLAN Creation Rules | identik |
| O23 | MUST transcribe the verdict exactly | AUD Findings Section Authorization | identik |
| O24 | MUST NOT check SKIP_FOR_AUDIT without instruction | AUD Findings Section Authorization | nama ("AUD Notes section") |
| O25 | DEV MUST NOT write in this section | AUD Findings Section Authorization | identik |
| O26 | MUST escalate when ... | Escalation Path | identik; butir "INTENT is missing" memakai nama baru |
| O27 | MUST stop and brief the Director after orientation | Role Activation | identik |
| O28 | MUST NOT create, promote, or lock a plan before Director selects direction | Role Activation | identik |
| O29 | Multiple open DRAFT plans: MUST NOT pick silently; MUST surface list | Role Activation | identik |
| O30 | MUST NOT commit, push, or open PR without instruction | Git Awareness | identik |
| O31 | MUST NOT run approval commands without approval | CLI Operation Policy | identik |
| O32 | MUST run check before recommending lock | CLI Operation Policy | identik |
| O33 | Inter-role messages MUST use `sigma send` | Inter-Role Communication Protocol | identik |
| O34 | MUST send message to DEV after plan lock | Mandatory Message Triggers | nama (subjek pesan `PLAN-v{X.Y} LOCKED - Open EXEC`) |
| O35 | MUST send revision brief to DEV | Mandatory Message Triggers | nama |

Kewajiban baru (tidak ada padanan lama), seluruhnya dari keputusan Director 7 Oktober 2026:

| No | Kewajiban | Section | Dasar |
|---|---|---|---|
| N1 | Setiap Key Output MUST dapat diverifikasi oleh sedikitnya satu AC | PLAN Creation Rules | E02 bagian 7 butir 3 |
| N2 | Item masuk Requirement hanya bila kontrak tidak dapat dipenuhi atau diverifikasi tanpanya; item masuk Key Output hanya bila disebut di Objective dan kontrak gagal tanpanya | PLAN Creation Rules | E02 bagian 7 butir 1 |
| N3 | Location Key Output adalah hasil kontrak dan menjadi pengecualian dari kebebasan metode DEV | PLAN Creation Rules | E02 bagian 7 butir 4 |
| N4 | Objective ditulis pertama; 1-3 kalimat, tanpa ID dan tanpa daftar tugas | PLAN Creation Rules | E02 bagian 7 butir 5 |
| N5 | Aturan Quality Standards bersyarat | Core Responsibilities | B-2 |
| N6 | Writing Style Rules (4 butir) | Behavioral Standards | B-6 |

## 4. Penghapusan tanpa kewajiban MUST

- Model dua lapis (Sovereign/Operationalization), rujukan `SIGMA_PROTOCOL.md` §5.1.1 dan "Section 14": dihapus (B-1).
- Butir Behavioral Standards "avoid unnecessary governance ceremony": dihapus (B-7); butir 10 menjadi 9.
- Bagian Pre-requirement (dua subtabel, Ownership): digantikan Requirement; aturan "DEV reads, does not write" dipertahankan.
- Daftar "DEV should report in EXEC" di template: dibandingkan dengan DEV-RULE (A-4b). Setiap butir sudah tercakup: pre-build assessment (DEV Pre-Build Assessment), implementation approach, deviations (Deviations From PLAN), changed files (Git Change Evidence), known issues (Issues Encountered, Known Limitations), evidence summary (Developer Verification dan Git Change Evidence). Tidak ada tambahan ke DEV-RULE.

## 5. Memory FMN

Butir "run `sigma close check` sebelum merekomendasikan `close lock`" dihapus dari `fmn-memory.json` karena bertentangan dengan FMN-RULE (closure adalah tanggung jawab ARC).
