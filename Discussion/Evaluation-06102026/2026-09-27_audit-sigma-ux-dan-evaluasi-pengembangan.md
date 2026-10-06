# Audit Sigma Ecosystem — Evaluasi Pengembangan dari Perspektif Pengguna (Director)

- **Tanggal:** 2026-09-27
- **Status:** Dokumen advisory (bukan artefak governance Sigma). Bahan masukan untuk DIR-INTENT pengembangan berikutnya — tidak mengotorisasi eksekusi apa pun.
- **Basis versi:** `sigma-ecosystem` v1.0.0, commit `d4555a3` (branch `claude/sigma-ecosystem-audit-ux-epfyi3`).
- **Pemicu:** Keluhan Director selama mengoperasikan Sigma secara manual (integrasi Hermes belum tuntas):
  1. **K1** — Pemakaian sangat melelahkan dari sisi human experience.
  2. **K2** — Proses penyusunan dokumen lama.
  3. **K3** — Dokumen yang dihasilkan *miss intent*, tetapi sudah terlanjur di-lock sehingga proses harus diulang.

### Konvensi label

| Label | Arti |
| :--- | :--- |
| **[FAKTA]** | Terverifikasi langsung dari source code / dokumen repo, dengan rujukan file. |
| **[INFERENSI]** | Kesimpulan saya dari fakta; masuk akal tetapi belum diuji terhadap sesi pemakaian nyata. |
| **[LAPORAN DIRECTOR]** | Keluhan yang Director sampaikan; diterima sebagai data pengalaman, tidak saya verifikasi independen. |
| **[REKOMENDASI]** | Usulan saya; menunggu keputusan Director. |

---

## 1. Ringkasan Eksekutif

1. **Secara teknis, repo sehat.** [FAKTA] `tsc --noEmit` bersih; 49 file test / 487 test lulus (`npx vitest run`, 2026-09-27). Gate, lock, amendment, dan mailbox punya cakupan test yang baik.
2. **Masalah utama bukan di kode, melainkan di desain interaksi.** [INFERENSI] Sigma dioptimalkan agar dokumen dapat dibaca dan divalidasi oleh AI dan CLI (penanda struktur, checkbox, ID formal). Sigma belum dioptimalkan untuk beban kognitif Director. Ketiga keluhan (K1–K3) berakar pada hal yang sama.
3. **Akar K3 (miss intent lalu lock) bisa ditunjuk secara spesifik:**
   - [FAKTA] Validasi sebelum ratify (`sigma intent check` / `ratify`) hanya memeriksa **kelengkapan bentuk**: marker section, checkbox, verdict AUD, dan Quality Bar bukan placeholder (`src/utils/docCheck.ts`). Tidak ada langkah yang memverifikasi bahwa **Director membaca dan mengonfirmasi makna** dokumen.
   - [FAKTA] Tampilan yang ramah manusia (`DIR-INTENT-HUMAN`) baru dapat dibuat **setelah** RATIFIED (`src/commands/intent.ts:175` — `humanize requires RATIFIED`). Akibatnya, sebelum lock Director justru meninjau dokumen paling teknis: 14 section, sekitar 23 KB, 553 baris template.
   - [FAKTA] Membuat versi baru setelah supersede **selalu dimulai dari template kosong** (`copyTemplateToArtifact('DIR-INTENT-TEMPLATE.md', …)` di `src/commands/intent.ts:113`; pola yang sama untuk FMN-PLAN di `src/commands/plan.ts`). Tidak ada opsi `--from <versi>`, sehingga "mengulang" berarti menyusun ulang dari nol, bukan merevisi.
4. **Hermes tidak menyelesaikan K3.** [INFERENSI] Hermes mengotomasi *siapa yang menjalankan perintah*. Hermes tidak menyelesaikan *apakah intent sudah benar sebelum dikunci*. Kalau diotomasi sebelum mekanisme konvergensi intent diperbaiki, dokumen yang miss intent hanya akan terproduksi lebih cepat.
5. **Rekomendasi inti** (detail di §6), diurutkan dari dampak tertinggi per biaya:
   - **R1 — Intent Brief + Echo-back sebelum draft penuh**: Director cukup mengonfirmasi 1 halaman dalam bahasanya sendiri, bukan 14 section.
   - **R2 — Clone saat mengulang** (`intent new --from`, `plan new --from`): mengulang menjadi revisi, bukan menulis ulang.
   - **R3 — Lock Review Card**: saat lock, CLI menyajikan ringkasan "apa yang Anda kunci" dalam bahasa manusia, lalu konfirmasi diberikan terhadap kartu itu.
   - **R4 — Template bertingkat (Lite/Full)** dan pengisian progresif: section yang tidak relevan tidak perlu diisi.
   - **R5 — `sigma audit pack`**: memangkas pekerjaan Director menyalin berkas ke auditor eksternal.
   - **R6 — Approval Queue** (Blueprint Phase 1): prasyarat yang sama-sama dibutuhkan UX manual maupun Hermes.

---

## 2. Cakupan dan Metode Audit

**Yang diperiksa:**

- Source CLI dan MCP: `src/` (±12.400 baris TypeScript), terutama `commands/intent.ts`, `commands/plan.ts`, `utils/docCheck.ts`, `engine/chain.ts`.
- Doktrin dan template: `Sigma/SIGMA_PROTOCOL.md`, `Sigma/rules/*-RULE.md`, `Sigma/templates/*`.
- Skill yang di-deploy: `setup/targets/**` (Claude Code, Codex, Reasonix, Antigravity).
- Dokumen desain: `Discussion/*`, `Implementation/*`, termasuk `Implementation/hermes/*`.
- Build dan test suite (dijalankan).

**Batasan (penting untuk menilai bobot temuan):**

- Saya **tidak** mengamati sesi pemakaian nyata dan tidak punya akses ke proyek yang dikelola Sigma (folder `Sigma/` proyek, `operations.jsonl`, riwayat supersede). Klaim tentang *seberapa sering* atau *seberapa lama* sesuatu terjadi di lapangan berstatus [INFERENSI] atau [LAPORAN DIRECTOR].
- Satu-satunya studi kasus lapangan yang terdokumentasi di repo adalah CanopySense (`Discussion/2026-08-11_0021_Intent-evaluation-sigma.md`).
- Beberapa rujukan internal (mis. `PLAN-EVAL-04-PETITION-ADMISSION-REVIEW.md`) **belum ditemukan** di repo. Kemungkinan berkas itu ada di catatan informal yang di-ignore, jadi statusnya "belum ditemukan", bukan "tidak ada".

---

## 3. Kondisi Repo Saat Ini

| Aspek | Temuan | Label |
| :--- | :--- | :--- |
| Versi | 1.0.0 stabil (`CHANGELOG.md`, 2026-09-12) | FAKTA |
| Kesehatan build | `tsc` bersih; 487/487 test lulus | FAKTA |
| Ukuran doktrin | Rules + protocol + constitution + templates ±376 KB teks. ARC-RULE 44,6 KB, AUD-RULE 41,5 KB, PROTOCOL 58 KB | FAKTA |
| Ukuran template artefak | DIR-INTENT 553 baris / 14 section; DEV-EXEC 470 baris / 18 section; FMN-PLAN 287 baris / 10 section; DIR-CLOSE 296 baris / 9 section + 3 appendix | FAKTA |
| Duplikasi skill | Setiap skill role ditulis ulang untuk 4 target (claude_code, codex, reasonix, antigravity) ± bridge file. Konsistensi dijaga dengan test paritas (`humanize-detail-level-parity.test.ts`), tetapi hanya untuk humanize | FAKTA |
| `dist/` ikut di-commit | 165 dari 397 file yang di-track adalah output build | FAKTA |
| Integrasi Hermes | Baru ada plan Phase 0 (MCP read-only) dan Phase 1 (skills + binding). Phase 2–4 belum di-plan; keputusan prasyarat (profile lab, proyek lab) masih terbuka (`Implementation/hermes/README.md`) | FAKTA |
| Autonomy Blueprint | Approval Queue, Evidence Engine, dan Dispatcher (`Discussion/SIGMA-AUTONOMY-BLUEPRINT-20260728.md`) belum diimplementasi. Di `src/` belum ditemukan `sigma request`/`sigma approve`/`exec verify` | FAKTA |
| Periodic Intent Re-evaluation | Sudah disepakati sebagai arah desain (`Discussion/2026-08-11_0115…` §4) tetapi belum ditemukan implementasinya di `src/` | FAKTA |

**Drift dokumen kecil yang ditemukan** [FAKTA]:

- `Sigma/rules/ARC-RULE.md:599` dan deskripsi opsi `--title` di `src/commands/intent.ts:77` masih merujuk `Sigma/design/intent-history.md`, padahal folder `design/` sudah dipensiunkan dan diganti `Sigma/charter/` (`CHANGELOG.md`; `src/engine/reconstruct.ts:191`).
- ARC-RULE §Closure Evaluation dan Mandatory Trigger 2 merujuk `PLAN-EVAL-04-PETITION-ADMISSION-REVIEW.md` ("same folder") sebagai "not yet executed". Berkas itu belum ditemukan di repo, padahal §Petition sudah ditulis lengkap di ARC-RULE yang sama. Rujukan ini tampaknya usang.

Relevansinya dengan UX: rule file adalah system prompt AI. Rujukan yang salah menambah kebingungan AI dan menambah pertanyaan balik ke Director. Blueprint Phase 0 (`sigma doctor --docs`) sudah mengusulkan pemeriksa otomatis untuk ini.

---

## 4. Temuan per Keluhan

### 4.1 K3 — "Miss intent, tapi sudah terlanjur lock, harus mengulang"

Keluhan ini saya bahas lebih dulu karena paling mahal: kerugiannya berlipat ke K1 dan K2.

#### T3.1 — Gerbang ratify memvalidasi bentuk, bukan makna [FAKTA]

`validateSigmaDocFile` (`src/utils/docCheck.ts`) memeriksa:

- marker section lengkap dan urut;
- tepat satu verdict AUD dicentang (atau `SKIP_FOR_AUDIT` dengan instruksi verbatim);
- 15 checkbox pada §13.1 Ratify Requirement tercentang;
- tabel Quality Bar bukan placeholder.

Seluruh checkbox §13.1 **dapat dicentang oleh ARC sendiri**. Tidak ada artefak yang merekam bahwa *Director telah membaca dan menyetujui pernyataan intent dalam bahasanya sendiri*. Persetujuan Director hanya berupa kalimat di chat ("approved", "lock it"), yang tidak menempel pada isi tertentu.

**Implikasi** [INFERENSI]: status "Eligible" memberi rasa aman palsu. Dokumen yang secara bentuk lengkap bisa lolos ratify meskipun maknanya bergeser dari yang Director maksud. Ini persis pola K3.

#### T3.2 — Permukaan review sebelum lock adalah yang paling tidak ramah manusia [FAKTA]

- Proyeksi manusia (`DIR-INTENT-HUMAN`, `PLAN-EXEC-HUMAN`, `DIR-CLOSE-HUMAN`) hanya bisa dibuat untuk artefak yang sudah RATIFIED/LOCKED (`src/commands/intent.ts:175`). Tujuannya adalah publikasi ke Notion atau pembaca eksternal, bukan sebagai alat review Director.
- Skill `/humanize` secara eksplisit **dilarang** diterapkan ke artefak sumber (`setup/targets/claude_code/humanize.md`, §Out Of Scope).
- "Director's Summary" pada FMN-PLAN (§10) dan DEV-EXEC (§18) diletakkan di **akhir** dokumen dan diisi paling akhir (`FMN-RULE.md:309`).

**Implikasi** [INFERENSI]: pada satu-satunya momen ketika koreksi masih murah (sebelum lock), Director harus membaca format yang ditulis untuk mesin. Kelelahan membaca menurunkan ketelitian review, sehingga miss intent lolos.

#### T3.3 — Mengulang = menulis ulang dari kosong [FAKTA]

- `sigma intent new` selalu menyalin template kosong ke `DIR-INTENT-v<N+1>.md` (`src/commands/intent.ts:113`).
- `sigma plan new` sama (`src/commands/plan.ts`, cabang pending dan normal).
- Tidak ada `--from`, `--clone`, atau mekanisme *carry-over* isi versi sebelumnya.

**Implikasi** [INFERENSI]: biaya koreksi setelah lock ≈ biaya penyusunan awal. Ini menjelaskan mengapa "harus mengulang" terasa sangat berat, padahal biasanya yang perlu diubah hanya sebagian kecil.

#### T3.4 — Lock adalah satu-satunya primitif komitmen; tidak ada status "hampir final" [FAKTA]

State DIR-INTENT: `DRAFT → RATIFIED → INACTIVE → SUPERSEDED`. Amendment (`sigma intent amendment`) sudah ada, tetapi:

- hanya untuk konten bertier *Operationalization*;
- butuh klasifikasi ARC dan otorisasi Director;
- tidak berlaku untuk FMN-PLAN, yang sepenuhnya immutable setelah lock untuk §1–8 (`FMN-PLAN-TEMPLATE.md` header "Post-Lock Rule").

**Implikasi** [INFERENSI]: pengguna hanya punya dua pilihan, yaitu "masih draft" atau "terkunci permanen". Tidak ada langkah konfirmasi ringan di antaranya, misalnya status *confirmed-intent* yang murah dibatalkan dalam jendela waktu tertentu.

#### T3.5 — Batas "maksimal 2 revisi per section" dapat mendorong lock prematur [FAKTA + INFERENSI]

[FAKTA] Doktrin umum role: *"revisions are limited to 2 per artifact section … Director finality controls"* (`ARC-RULE.md` baris 11 dan §Role Stance Requirement; pola yang sama di FMN-RULE).

[INFERENSI] Aturan ini dimaksudkan untuk mencegah debat tanpa akhir. Namun dalam fase *konvergensi intent*, dua putaran revisi sering tidak cukup. Tekanan implisitnya adalah "sudahi dan lock", padahal pemahaman belum konvergen. Aturan ini perlu dibedakan antara *debat posisi* (wajar dibatasi) dan *iterasi klarifikasi intent* (sebaiknya tidak dibatasi dengan angka yang sama).

#### T3.6 — Drift baru terdeteksi di akhir [FAKTA]

Kasus CanopySense: drift terjadi di 38 slot versi dan baru terlihat saat Closure Evaluation, 48 hari melewati tenggat (`Discussion/2026-08-11_0021…` §1). Mekanisme *Periodic Intent Re-evaluation* sudah disepakati tetapi belum diimplementasi (§3 tabel di atas).

---

### 4.2 K2 — "Prosesnya lama di penyusunan dokumen"

#### T2.1 — Volume isian wajib tidak proporsional terhadap ukuran pekerjaan [FAKTA + INFERENSI]

[FAKTA] DIR-INTENT memaksa semua 14 section beserta 15 checkbox ratify, termasuk tabel Quality Bar 4 dimensi × 3 kolom, Strategic Trade-Offs, Risk Register, dan Execution Direction for FMN. README sendiri memosisikan Sigma untuk "solo builders, small teams, prototypes, MVPs".

[INFERENSI] Untuk pekerjaan kecil, sebagian besar section menjadi "N/A" yang tetap harus ditulis dan dibaca. Tidak ada profil *lite* atau *fast-track*. Ide "micro-chain" baru ada sebagai horizon Phase 5 di Autonomy Blueprint.

#### T2.2 — Satu chain = banyak dokumen berat berurutan [FAKTA]

Satu siklus minimum: DIR-INTENT → ROADMAP (wajib, Gate 1.5) → FMN-PLAN → DEV-EXEC (18 section) → skor ARC → DIR-CLOSE. Setiap FMN-PLAN tambahan menambah sepasang PLAN + EXEC.

Perkiraan titik keputusan Director untuk satu chain dengan *N* pasangan plan/exec [INFERENSI, dihitung dari CLI Operation Policy tiap role]:

| Jenis keputusan | Jumlah |
| :--- | :--- |
| Ratify intent | 1 |
| Lock plan | N |
| Lock exec | N |
| Keputusan AUD (audit atau `SKIP_FOR_AUDIT` verbatim) pada intent dan tiap plan | N + 1 |
| Komit skor ARC (butuh frasa khusus "catat skor") | ≥ 1 |
| Close lock | 1 |
| **Total minimum** | **≈ 3N + 4 keputusan eksplisit**, belum termasuk putaran revisi dan pergantian sesi |

Untuk N = 5, hasilnya sekitar 19 keputusan eksplisit, masing-masing mensyaratkan Director membaca dokumen panjang.

#### T2.3 — Director menjadi "kurir" antar-role dan antar-vendor [FAKTA]

- **Role immutability**: satu sesi = satu role. Berganti role berarti membuka sesi baru (`setup/targets/claude_code/arc.md`, §Role Immutability).
- **AUD Isolation Policy**: AUD hanya boleh meninjau materi yang Director tempel atau otorisasi secara eksplisit, dan dilarang membaca repo, `progress`, maupun MCP (`AUD-RULE.md` §External Auditor Isolation Policy). Untuk Comprehensive Research, ARC wajib meminta Director mengotorisasi `reference-list.md` sebagai Evidence Package.
- Verdict AUD harus ditranskripsikan ulang oleh ARC/FMN ke section §12/§9.

[INFERENSI] Dalam operasi manual, ini berarti Director berulang kali menyalin berkas ke vendor lain, menyalin balik hasilnya, dan membuka sesi baru. Pekerjaan logistik ini tidak menambah nilai keputusan, tetapi memakan waktu dan energi. Kontribusinya ke K2 dan K1 besar.

#### T2.4 — Aturan tambahan menambah putaran tanya-jawab [FAKTA]

Contoh:

- ARC wajib berhenti saat aktivasi dan bertanya "intent baru atau evaluasi closure?" (`ARC-RULE.md` §Role Activation).
- Komit skor butuh frasa khusus, bukan sekadar "approved" (§ARC Satisfaction Score).
- `SKIP_FOR_AUDIT` butuh instruksi verbatim.
- Kata-kata ambigu ("okay", "looks good", "continue") ditolak sebagai otorisasi.

Setiap aturan masuk akal secara terpisah. [INFERENSI] Akumulasinya menghasilkan banyak interupsi kecil per sesi.

---

### 4.3 K1 — "Sangat melelahkan dari sisi human experience"

K1 sebagian besar merupakan efek gabungan K2 dan K3. Faktor tambahan:

#### T1.1 — Beban kognitif doktrin tinggi, termasuk bagi AI [FAKTA + INFERENSI]

[FAKTA] ARC-RULE saja 44 KB. Rule menyuruh role *tidak* membaca protokol penuh saat aktivasi, tetapi rule itu sendiri sudah sangat panjang.

[INFERENSI] Semakin panjang instruksi, semakin besar variasi kepatuhan antar-vendor (Gemini, ChatGPT, Claude, DeepSeek disarankan di README). Director lalu menanggung biaya koreksi perilaku AI yang tidak konsisten.

#### T1.2 — Director tidak punya satu "layar kendali" [FAKTA]

`/report` bersifat chat-only dan per sesi. Tidak ada satu tempat untuk melihat semua yang sedang menunggu keputusan Director. Approval Queue (`sigma approvals`) di Blueprint belum dibuat.

#### T1.3 — Bahasa dan istilah internal bocor ke Director [INFERENSI]

Istilah seperti Gate 1.5, Gate 3.5, Sovereign/Operationalization, Verificator Mode, Petition/Admission Review, `PASS_WITH_RISK`, dan band skor harus dipahami Director untuk mengambil keputusan. Proyeksi manusia yang menyembunyikan istilah ini ada, tetapi baru muncul setelah lock (T3.2).

---

## 5. Analisis Akar Masalah (Sintesis)

[INFERENSI — ini kerangka interpretasi saya, bukan fakta]

```text
Desain saat ini:                        Dampak ke Director:
───────────────────────────────         ─────────────────────────────────────
Draft penuh dulu (14 section)    ──▶    Review dokumen panjang berformat mesin
  ↓                                        ↓ (lelah → review dangkal)
Validasi = kelengkapan bentuk    ──▶    "Eligible" ≠ "sesuai maksud saya"
  ↓
Lock (permanen)                  ──▶    Miss intent baru ketahuan di hilir
  ↓
Koreksi = versi baru dari kosong ──▶    Mengulang seluruh penyusunan (K2 ×2)
```

Ada tiga prinsip yang dilanggar oleh urutan ini:

1. **Konvergensi sebelum elaborasi.** Makna harus disepakati dalam bentuk ringkas *sebelum* diurai menjadi 14 section. Saat ini urutannya terbalik: elaborasi dulu, konfirmasi makna lewat membaca hasil elaborasi.
2. **Konfirmasi harus terikat pada isi yang dikonfirmasi.** "Lock it" di chat tidak terikat pada apa pun yang dapat diperiksa ulang. Blueprint Autonomy §2 prinsip 2 sudah mengidentifikasi hal serupa: *"Approval is state, not conversation."*
3. **Biaya koreksi harus sebanding dengan besar koreksi.** Mengubah satu klausul tidak semestinya menuntut penyusunan ulang seluruh dokumen.

**Posisi saya tentang tujuan vs metode.** Tujuan Sigma (Director memegang kendali intent, jejak bukti terjaga, AI tidak menyimpang) tidak saya persoalkan; itu wilayah Director. Yang saya kritik adalah **metode**: di mana dan bagaimana konfirmasi dilakukan, serta biaya koreksinya. Rekomendasi di bawah dirancang untuk mempertahankan semua jaminan governance yang ada (immutability, non-retroactivity, audit trail).

---

## 6. Rekomendasi Solusi (Perspektif Pengguna)

Urutan disusun berdasarkan dampak ke K1–K3 dibagi estimasi biaya. Estimasi biaya bersifat kasar [INFERENSI].

### R1 — Intent Brief + Echo-back sebelum draft penuh (sasaran: K3, K2) — PRIORITAS 1

**Masalah yang diselesaikan:** T3.1, T3.2, T2.1.

**Bentuk usulan:**

1. Tambahkan artefak ringan `INTENT-BRIEF` (≤ 1 halaman) sebagai langkah pertama ARC, berisi:
   - **Kata-kata Director, verbatim** (kutipan permintaan asli).
   - **Pernyataan ulang ARC** dalam 5–7 kalimat bahasa awam: apa yang dibangun, untuk siapa, dan seperti apa kondisi "berhasil".
   - **Contoh uji batas**: 3 hal yang *termasuk* dan 3 hal yang *tidak termasuk*, dalam bentuk skenario konkret, bukan kategori abstrak. Contoh: "Pengguna bisa mendaftar sendiri? → TIDAK".
   - **Daftar asumsi** yang ARC buat, masing-masing untuk dikonfirmasi atau dikoreksi.
2. Director mengonfirmasi brief. CLI merekam hash brief dan waktu konfirmasi (mis. `sigma intent brief confirm`).
3. DIR-INTENT penuh diturunkan dari brief. `sigma intent ratify` mensyaratkan brief terkonfirmasi, dan (opsional) menampilkan brief di sebelah ringkasan DIR-INTENT untuk dicek konsistensinya.

**Mengapa efektif:** koreksi intent terjadi di dokumen 1 halaman, bukan 14 section. Contoh uji batas adalah alat paling efektif untuk menangkap salah paham scope, dan kasus CanopySense adalah salah paham scope (self-registration, raster, multi-tenant).

**Biaya:** sedang. Perlu template baru, 1–2 subcommand, validasi di `docCheck`, dan perubahan ARC-RULE/skill.
**Risiko:** menambah satu langkah. Mitigasinya, brief *menggantikan* sebagian interview panjang, bukan menambahinya.

### R2 — Clone saat mengulang: `--from <versi>` (sasaran: K3, K2) — PRIORITAS 1 (quick win)

**Masalah yang diselesaikan:** T3.3.

**Bentuk usulan:**

- `sigma intent new --from v<N>`: salin isi DIR-INTENT versi sebelumnya (bukan template kosong), reset §12 AUD verdict dan checkbox §13, lalu tambahkan catatan "diturunkan dari v<N>".
- `sigma plan new --from v<X.Y>`: sama untuk FMN-PLAN yang di-supersede.
- `sigma intent diff v<N> v<N+1>` / `sigma plan diff`: ringkasan perbedaan untuk direview Director dan AUD. AUD cukup mengaudit delta, bukan dokumen penuh.

**Mengapa efektif:** mengulang berubah dari "tulis ulang" menjadi "revisi terarah". Immutability versi lama tetap utuh karena ini salinan ke versi baru, bukan edit in-place.

**Biaya:** rendah. `copyTemplateToArtifact` sudah ada; cukup tambah jalur salin dari file artefak dan reset section tertentu. Estimasi 1–2 hari kerja termasuk test.
**Risiko:** isi lama terbawa tanpa ditinjau ulang. Mitigasinya, reset paksa checklist §13 dan verdict AUD agar review tetap terjadi.

### R3 — Lock Review Card (sasaran: K3, K1) — PRIORITAS 2

**Masalah yang diselesaikan:** T3.1, T3.2, T1.3.

**Bentuk usulan:**

- `sigma intent check` / `plan check` menghasilkan **kartu review** yang dirender dari dokumen dalam bahasa awam, tanpa istilah internal:
  - "Anda akan mengunci: …" (5–10 komitmen utama)
  - "Yang secara eksplisit TIDAK dikerjakan: …"
  - "Asumsi yang belum diverifikasi: …"
  - "Berubah dibanding versi sebelumnya: …" (bila ada `--from`)
- `ratify` / `lock` mencatat **hash kartu** yang Director konfirmasi. Dengan begitu persetujuan menempel pada isi, bukan kalimat chat.
- Ini sekaligus menggeser sebagian fungsi `/humanize` ke **sebelum** lock sebagai alat review internal, terpisah dari proyeksi publikasi Notion yang tetap setelah lock.

**Biaya:** sedang. Ekstraksi field bisa deterministik dari marker yang sudah ada (ID `SC-`, `OS-`, `NG-`, `ASM-`, `REQ-`), tanpa LLM.
**Risiko:** kartu terlalu ringkas sehingga detail penting tidak tampak. Mitigasinya, kartu menautkan ID ke section sumber.

### R4 — Template bertingkat (Lite / Full) dan pengisian progresif (sasaran: K2, K1) — PRIORITAS 2

**Masalah yang diselesaikan:** T2.1, T2.2.

**Bentuk usulan:**

- `sigma intent new --profile lite|full`.
- **Lite** berisi: Intent Core (§1), Success Definition (§3), Scope Boundary (§6), Quality Bar ringkas (satu baris per dimensi, boleh "N/A"), dan Execution Direction (§11). Section lain dianggap *opsional*, sehingga `docCheck` tidak mewajibkannya dan tidak mewajibkan checkbox terkait.
- Section Operationalization boleh dilengkapi belakangan lewat Amendment. Mekanismenya sudah ada dan sesuai doktrin "Ratification establishes the governing intent; it does not freeze its operationalization."
- Pertimbangkan ROADMAP opsional untuk chain Lite: 1 plan tanpa stage, sehingga Gate 1.5 dilewati otomatis.

**Biaya:** sedang. `DOC_SPECS` di `docCheck.ts` sudah punya konsep `optionalSections`, jadi dasarnya sudah ada.
**Risiko:** Lite dipakai untuk pekerjaan yang semestinya Full. Mitigasinya, ARC wajib menyatakan alasan pemilihan profil, dan AUD boleh menantangnya.

### R5 — `sigma audit pack` / `sigma audit record` (sasaran: K2, K1) — PRIORITAS 2 (quick win)

**Masalah yang diselesaikan:** T2.3.

**Bentuk usulan:**

- `sigma audit pack --target intent|plan --v <ver>`: membundel Audit Target + Director Reference + Evidence Package (mis. `reference-list.md` bila Comprehensive Research NEEDED) + prompt AUD siap tempel, menjadi **satu file** (md/zip). Isolasi AUD tetap terjaga karena Director yang memilih dan mengirim paket, sesuai doktrin "AUD audits the evidence package".
- `sigma audit record --file <respon>`: menempelkan respons AUD ke section §12/§9 secara terstruktur, termasuk verdict, sehingga ARC/FMN tidak perlu menyalin ulang secara manual. Aturan integritas verdict tetap berlaku.

**Biaya:** rendah–sedang.
**Nilai:** langsung terasa pada operasi manual *sekarang*, dan nantinya menjadi antarmuka yang dipakai Hermes/dispatcher.

### R6 — Approval Queue (Blueprint Phase 1) (sasaran: K1) — PRIORITAS 3

**Masalah yang diselesaikan:** T1.2, dan sebagian T2.3.

Sudah dirancang rinci di `Discussion/SIGMA-AUTONOMY-BLUEPRINT-20260728.md` §4.1. Saya menambahkan dua catatan:

1. Setiap request sebaiknya membawa **Lock Review Card (R3)**, bukan hanya laporan `check`.
2. Ini prasyarat untuk Hermes Phase 3 (dispatcher). Karena itu saya menyarankan Approval Queue dikerjakan **sebelum** Hermes Phase 2–4, bukan paralel.

### R7 — Periodic Intent Checkpoint ringan (sasaran: K3) — PRIORITAS 3

**Masalah yang diselesaikan:** T3.6.

Implementasikan desain yang sudah disepakati (`Discussion/2026-08-11_0115…` §4), dalam bentuk minimal:

- Setiap *k* plan LOCKED (dapat dikonfigurasi, default 5), `sigma plan new` meminta **konfirmasi Intent Brief (R1)**: "Apakah brief ini masih mewakili maksud Anda? Ya / Perlu amendment / Perlu intent baru."
- Dengan R1, checkpoint menjadi murah, cukup membaca 1 halaman, dan tidak lagi membutuhkan re-evaluasi ARC penuh.

### R8 — Pisahkan batas "debat" dari batas "iterasi klarifikasi" (sasaran: K3) — PRIORITAS 3 (perubahan doktrin)

**Masalah yang diselesaikan:** T3.5.

Ubah doktrin umum role:

- Batas 2 putaran berlaku untuk **posisi atau perdebatan**.
- Iterasi **klarifikasi intent** selama fase DRAFT tidak dibatasi angka. Yang membatasinya adalah Director, yang bisa memutuskan "cukup, lanjut".

**Biaya:** sangat rendah (edit rules dan skill di 4 target).

### R9 — Instrumentasi: ukur sebelum dan sesudah (pendukung semua R) — PRIORITAS 2

Tanpa data, perbaikan UX hanya bisa dinilai dari rasa. Usulan: `sigma report cycle` (sudah ada sebagai ide di Blueprint Phase 5) yang mengolah `operations.jsonl` menjadi:

- waktu dari `intent new` sampai `ratify`, dan dari `plan new` sampai `lock`;
- jumlah supersede per chain dan alasannya;
- jumlah putaran AUD per artefak.

Metrik ini menjadi *success criteria* yang terukur untuk DIR-INTENT pengembangan R1–R5.

### R10 — Higiene repo (non-UX, biaya rendah) — PRIORITAS 4

- Perbaiki rujukan usang: `Sigma/design/intent-history.md` → `Sigma/charter/…` (ARC-RULE:599, `intent.ts:77`), dan rujukan `PLAN-EVAL-04-…`.
- Realisasikan Blueprint Phase 0 (`sigma doctor --docs`) untuk mencegah drift rule, karena rule adalah system prompt.
- Pertimbangkan generator tunggal untuk skill 4 target (satu sumber, dirender per target) agar perubahan doktrin (mis. R8) cukup ditulis sekali.
- Pertimbangkan tidak meng-commit `dist/` (build di `prepare`/`prepublishOnly`). Ini keputusan distribusi, jadi saya tandai sebagai opsi, bukan temuan cacat.

---

## 7. Keterkaitan dengan Integrasi Hermes

[Penilaian independen saya — INFERENSI]

| Aspek | Hermes membantu? | Catatan |
| :--- | :--- | :--- |
| Director menjalankan perintah CLI / membuka sesi per role (T2.3 sebagian) | **Ya** | Inilah nilai utama Hermes Phase 1–3 |
| Menyalin berkas ke AUD vendor lain (T2.3) | Sebagian | Tetap butuh paket evidence yang terdefinisi, yaitu R5 |
| Dokumen panjang untuk direview (T2.1, T3.2) | **Tidak** | Hermes tidak mengubah template maupun permukaan review |
| Miss intent sebelum lock (T3.1) | **Tidak**, dan berisiko memperburuk | Otomasi mempercepat produksi dokumen; jika konvergensi intent belum diperbaiki, jumlah dokumen miss intent per satuan waktu bisa naik |
| Biaya mengulang (T3.3) | **Tidak** | Perlu R2 |

**Rekomendasi urutan:**

1. **R2 + R8 + R10**: quick win, bisa segera, tanpa menunggu keputusan besar.
2. **R1 + R3**: inti perbaikan K3; butuh satu DIR-INTENT pengembangan.
3. **R5 + R9**.
4. **Hermes Phase 0–1**: bisa berjalan paralel dengan langkah 1–3 karena read-only atau hanya binding skill.
5. **R4 + R6 + R7**.
6. **Hermes Phase 2–4**, di atas fondasi yang sudah menangani konvergensi intent dan approval-as-state.

Alasan urutan ini: Blueprint prinsip 6 menyatakan setiap fase harus bernilai sendiri ketika semua hal lain masih manual. R1–R5 memenuhi prinsip itu, karena langsung meringankan operasi manual Director hari ini.

---

## 8. Keputusan yang Dibutuhkan dari Director

| # | Pertanyaan | Rekomendasi saya | Alasan singkat |
| :--- | :--- | :--- | :--- |
| D1 | Apakah Intent Brief (R1) dijadikan **wajib** sebelum ratify, atau opsional? | **Wajib**, dengan brief sangat pendek | Jika opsional, brief akan dilewati justru saat Director lelah, padahal saat itulah brief paling dibutuhkan |
| D2 | Apakah persetujuan lock diikat ke hash Lock Review Card (R3)? | **Ya** | Menutup celah "approved di chat tidak terikat isi"; sejalan dengan prinsip "approval is state" di Blueprint |
| D3 | Profil Lite (R4): boleh melewati ROADMAP/Gate 1.5? | **Ya, untuk chain dengan 1 plan** | ROADMAP untuk satu stage murni overhead |
| D4 | Urutan: perbaikan UX (R1–R5) sebelum Hermes Phase 2+? | **Ya** | Lihat §7: Hermes tidak menyelesaikan K3 dan berisiko memperbesarnya |
| D5 | Perubahan doktrin batas revisi (R8) | **Setuju dipisah** | Mencegah tekanan lock prematur tanpa membuka debat tak berujung |
| D6 | Mulai dari mana? | **R2 (`--from`) sebagai chain pertama** | Biaya paling rendah, dampak langsung pada rasa "harus mengulang dari nol", dan dapat dipakai untuk menguji R9 |

Sesuai Blueprint §8, setiap rekomendasi yang disetujui sebaiknya dijalankan sebagai chain Sigma sendiri: ARC → DIR-INTENT → FMN → DEV.

---

## 9. Lampiran — Rujukan Bukti Utama

| Temuan | Rujukan |
| :--- | :--- |
| Ratify hanya validasi bentuk | `src/utils/docCheck.ts` (requirements: verdict, checklist §13.1, Quality Bar); `src/commands/intent.ts:132-157` |
| Humanize hanya setelah RATIFIED | `src/commands/intent.ts:164-210` |
| `/humanize` dilarang pada artefak sumber | `setup/targets/claude_code/humanize.md` §Out Of Scope |
| Versi baru dari template kosong | `src/commands/intent.ts:113`; `src/commands/plan.ts` (`copyTemplateToArtifact('FMN-PLAN-TEMPLATE.md', …)`) |
| Supersede plan tanpa carry-over | `src/commands/plan.ts:226-262` |
| Batas 2 revisi | `Sigma/rules/ARC-RULE.md` (Common Role Doctrine; Role Stance Requirement); `Sigma/rules/FMN-RULE.md:11` |
| AUD isolation | `Sigma/rules/AUD-RULE.md` §External Auditor Isolation Policy |
| Director's Summary di akhir | `Sigma/templates/FMN-PLAN-TEMPLATE.md` §10; `Sigma/rules/FMN-RULE.md:309` |
| Drift terdeteksi terlambat (CanopySense) | `Discussion/2026-08-11_0021_Intent-evaluation-sigma.md` §1–2 |
| Periodic re-evaluation belum diimplementasi | `Discussion/2026-08-11_0115_Intent-taxonomy-and-amendment-model.md` §4; tidak ditemukan di `src/` |
| Approval Queue / Evidence Engine belum ada | `Discussion/SIGMA-AUTONOMY-BLUEPRINT-20260728.md` §4; tidak ditemukan di `src/` |
| Status Hermes | `Implementation/hermes/README.md`, `Implementation/hermes/ROADMAP.md` |
| Rujukan folder usang | `Sigma/rules/ARC-RULE.md:599`; `src/commands/intent.ts:77` vs `src/engine/reconstruct.ts:191` |
