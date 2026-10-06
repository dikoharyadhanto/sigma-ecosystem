# Sigma v2 — Keputusan Desain dan Inventaris Perombakan (Langkah 1)

- **Tanggal:** 2026-09-28 (revisi 3: penambahan D-11; O-01 s.d. O-10 diputuskan menjadi D-12 s.d. D-21; penambahan D-22 perintah `sigma note`)
- **Status:** Dokumen advisory untuk review Director. Ini bukan artefak governance Sigma dan tidak mengotorisasi eksekusi apa pun.
- **Basis:** `sigma-ecosystem` v1.0.0, commit `d4555a3`.
- **Kelanjutan dari:** `2026-09-27_audit-sigma-ux-dan-evaluasi-pengembangan.md` (sudah dikirim ke Director).
- **Penamaan:** dokumen ini memakai nama artefak v2 (INTENT, PLAN, EXEC, CLOSE — lihat D-11 dan §2.5). Nama lama (DIR-INTENT, FMN-PLAN, DEV-EXEC, DIR-CLOSE) hanya dipakai saat merujuk file, section, atau kode yang ada sekarang.
- **Isi:** (1) catatan keputusan yang sudah Director ambil dalam diskusi 27–28 September; (2) model status, versi, dan kerja sama FMN–DEV yang baru; (3) inventaris section template dan klaster rules beserta tindakannya; (4) dampak ke kode; (5) keputusan tambahan D-12 s.d. D-21; (6) track terpisah perintah `sigma note` (D-22, §12). Tidak ada keputusan desain yang masih terbuka.

### Konvensi label

| Label | Arti |
| :--- | :--- |
| **[FAKTA]** | Terverifikasi dari source code atau dokumen repo, dengan rujukan. |
| **[KEPUTUSAN]** | Sudah diputuskan Director secara eksplisit dalam diskusi. |
| **[USULAN]** | Usulan saya; belum diputuskan. |
| **[INFERENSI]** | Kesimpulan saya; belum diuji di pemakaian nyata. |

### Koreksi atas pernyataan saya sebelumnya

Dalam diskusi, saya menyebut ROADMAP "tidak punya status lock". **Pernyataan itu keliru.** [FAKTA] `SIGMA_PROTOCOL.md` §5.6 sudah mendefinisikan state ROADMAP `DRAFT → LOCKED`, dan `sigma close lock` otomatis mengunci ROADMAP yang masih DRAFT. Yang benar: ROADMAP memang tidak punya *perintah* lock tersendiri, dan perilaku yang Director inginkan (ROADMAP terkunci saat close di-lock) **sudah berjalan**. Tidak perlu perubahan untuk bagian ini.

---

## 1. Catatan Keputusan Director

| ID | Keputusan | Asal |
| :--- | :--- | :--- |
| D-01 | Perombakan dilakukan di level **dokumen (template) dan rules**. Kernel (gate, chain, mailbox, MCP) dipertahankan, hanya disesuaikan seperlunya untuk D-03 s.d. D-11. Tidak membuat repo baru. | Diskusi 28-09 |
| D-02 | **Gaya bahasa humanize menjadi gaya utama** semua artefak Sigma. Section redundan dipangkas; yang tersisa hanya yang benar-benar penting. | Diskusi 28-09 |
| D-03 | **Penomoran versi:** intent `vN` → plan `vN.x` → exec `vN.x`. Contoh: intent v2 → plan v2.1 → exec v2.1. Angka depan menunjukkan intent; angka belakang adalah nomor implementasi di dalam chain itu. Hanya berlaku untuk chain baru; chain lama tidak dinomori ulang. | Diskusi 28-09 |
| D-04 | **INTENT tidak berubah:** `DRAFT → RATIFIED`, perubahan lewat mekanisme amandemen yang sudah ada, karena intent menyentuh tingkat desain. | Diskusi 28-09 |
| D-05 | **Plan dan exec:** `DRAFT → APPROVED`. Saat exec di-APPROVE, pasangan plan+exec dengan nomor yang sama **otomatis menjadi LOCKED**. LOCKED berarti implementasi tersebut tuntas dan tidak bisa diubah lagi. | Diskusi 28-09 |
| D-06 | **ROADMAP** tetap terbuka selama chain berjalan dan menjadi LOCKED saat `close lock`. Ini sudah perilaku yang berjalan sekarang (lihat koreksi di atas). | Diskusi 28-09 |
| D-07 | **Pemilik plan hanya FMN.** Setelah plan APPROVED, FMN hanya boleh mengubah kontrak pada dua checkpoint: *FMN Pre-Build Review* dan *FMN Post-Build Review*. Di luar itu, perubahan hanya boleh dengan otorisasi eksplisit Director. | Diskusi 28-09 |
| D-08 | **Setiap perubahan kontrak setelah APPROVED wajib diberitahukan FMN ke DEV** lewat `sigma send`. **DEV boleh mengajukan permintaan perubahan kontrak ke FMN** disertai justifikasi (target tidak tercapai, terlalu berat, dan sebagainya). Plan dan exec adalah kontrak kerja sama FMN dan DEV; Director adalah pembaca dan pemberi persetujuan. | Diskusi 28-09 |
| D-09 | **Persetujuan perubahan kontrak dikumpulkan** dan diberikan Director saat meng-APPROVE exec. Kartu persetujuan menampilkan semua perubahan. **Pengecualian:** perubahan yang *melonggarkan* kriteria penerimaan atau kontrak uji harus disetujui Director saat itu juga, sebelum DEV melanjutkan. | Diskusi 28-09 (opsi B) |
| D-10 | **Pengaman pendukung:** (a) exec mencatat revisi plan yang menjadi acuannya, dan exec tidak bisa di-APPROVE bila acuannya bukan revisi plan terbaru; (b) plan mencatat revisi intent yang menjadi acuannya; (c) amandemen intent mewajibkan peninjauan ulang pasangan yang masih APPROVED, sedangkan pasangan LOCKED tidak tersentuh (non-retroaktif); (d) tabel riwayat amandemen dikeluarkan dari dokumen intent ke log, dan di dokumen cukup satu baris "Amandemen terakhir"; (e) beberapa plan APPROVED boleh berjalan paralel, dengan satu plan tetap punya tepat satu exec. | Diskusi 28-09 |
| D-11 | **Prefix nama role dihapus dari nama artefak:** DIR-INTENT → **INTENT**, FMN-PLAN → **PLAN**, DEV-EXEC → **EXEC**, DIR-CLOSE → **CLOSE**; ROADMAP tetap. Pemilik dokumen ditulis satu baris di header, bukan di nama. Dikerjakan dalam rilis v2 yang sama (satu kali perubahan skema). | Diskusi 28-09 |
| D-12 s.d. D-21 | Sepuluh keputusan tambahan (dulu O-01 s.d. O-10), seluruhnya sesuai rekomendasi — rinciannya di §10 | Diskusi 28-09 |
| D-22 | **Perintah baru `sigma note new` dan `sigma note list`** untuk catatan bebas di `Sigma/notes/`, dengan penamaan otomatis `NOTE-YYMMDDHHMM-<judul>.md`. Dikerjakan sebagai **track terpisah, rilis 1.1.0**, tidak menunggu v2. Spesifikasi di §12 | Diskusi 28-09 |

**Keputusan yang digantikan:** usulan saya sebelumnya bahwa "plan hanya boleh direvisi selama exec belum dimulai" **tidak berlaku**. Penggantinya adalah D-07: plan boleh direvisi sampai pasangan LOCKED, tetapi hanya pada dua checkpoint.

---

## 2. Model Status dan Versi Baru

### 2.1 Siklus hidup satu chain

```text
Intent v2      : DRAFT ──(Director ratify)──► RATIFIED ──(amandemen, bila perlu)──► RATIFIED rev N
                                                  │
ROADMAP v2     : DRAFT (terbuka) ─────────────────┼──────────────────────────────► LOCKED saat close lock
                                                  │
Plan v2.1      : DRAFT ──(Director approve)──► APPROVED ─┐  (FMN boleh ubah di 2 checkpoint)
Exec v2.1      : DRAFT ────────────────(Director approve)┴──► plan v2.1 + exec v2.1 = LOCKED (tuntas)
Plan/Exec v2.2 : … (paralel boleh)
                                                  │
Close v2       : DRAFT ──(Director close lock)──► LOCKED  → ROADMAP ikut LOCKED
```

### 2.2 Perbandingan state

| Artefak | Sekarang [FAKTA] | Sigma v2 |
| :--- | :--- | :--- |
| INTENT (dulu DIR-INTENT) | DRAFT → RATIFIED → INACTIVE/SUPERSEDED | **Tetap** (D-04) |
| ROADMAP | DRAFT → LOCKED (otomatis saat close lock) / SUPERSEDED | **Tetap** (D-06) |
| PLAN (dulu FMN-PLAN) | DRAFT → LOCKED / SUPERSEDED | DRAFT → **APPROVED** → LOCKED (otomatis bersama exec) / SUPERSEDED |
| EXEC (dulu DEV-EXEC) | DRAFT → LOCKED / SUPERSEDED | DRAFT → **APPROVED ≡ LOCKED** (approve exec langsung mengunci pasangan) / SUPERSEDED |
| CLOSE (dulu DIR-CLOSE) | DRAFT → LOCKED | **Tetap** |

### 2.3 Penomoran

| Hal | Sekarang [FAKTA] | Sigma v2 |
| :--- | :--- | :--- |
| Plan pertama di intent v2 | `v1.1` (plan major = intent major − 1, `src/engine/chain.ts:1113`) | `v2.1` |
| Exec | Sama dengan plan (`chain.ts:1131`) | Tetap sama dengan plan |
| Plan dibatalkan (superseded) | Nomor tidak dipakai ulang | Tetap |
| Revisi isi plan/intent tanpa ganti nomor | Tidak ada konsep revisi | **Baru:** nomor revisi (`rev N`) naik setiap perubahan yang disahkan; dicatat di `progress-v<N>.json`, bukan di nama file |

### 2.4 Perubahan gate

| Gate | Sekarang [FAKTA, `SIGMA_PROTOCOL.md` §7] | Sigma v2 |
| :--- | :--- | :--- |
| Gate 1 | ROADMAP butuh intent RATIFIED | Tetap |
| Gate 1.5 | Plan butuh ROADMAP ada | Tetap |
| Gate 2 | `exec new` butuh plan **LOCKED** | `exec new` butuh plan **APPROVED** |
| Gate 3 | `close new` butuh tidak ada DRAFT, dan setiap plan LOCKED punya tepat satu exec LOCKED | `close new` butuh setiap plan yang tidak superseded sudah **LOCKED bersama exec-nya**, dan tidak ada DRAFT/APPROVED tersisa |
| Gate 3.5 | Skor ARC ≥ 50 | Tetap |
| **Baru — Gate approve exec** | — | Exec tidak bisa di-APPROVE bila: (a) acuannya bukan revisi plan terbaru; (b) ada revisi plan setelah APPROVED tanpa pemberitahuan ke DEV di mailbox; (c) ada perubahan bertanda *pelonggaran* yang belum disetujui Director |


### 2.5 Penamaan artefak (D-11)

| Sekarang | v2 | Contoh file | Marker section |
| :--- | :--- | :--- | :--- |
| DIR-INTENT | **INTENT** | `Sigma/charter/INTENT-v2.md` | `SIGMA:INTENT:SECTION:…` |
| FMN-PLAN | **PLAN** | `Sigma/contract/PLAN-v2.1.md` | `SIGMA:PLAN:SECTION:…` |
| DEV-EXEC | **EXEC** | `Sigma/evidence/EXEC-v2.1.md` | `SIGMA:EXEC:SECTION:…` |
| DIR-CLOSE | **CLOSE** | `Sigma/close/CLOSE-v2.md` | `SIGMA:CLOSE:SECTION:…` |
| ROADMAP | tetap | `Sigma/roadmap/ROADMAP-v2.md` | tetap |

Header setiap artefak memuat satu baris kepemilikan, mis. "Pemilik: FMN · Disetujui oleh: Director".

**Pengaman:**

- **Tabrakan nama dengan file proyek.** [FAKTA] `src/commands/scan.ts:14` mengenali artefak dari prefix nama file (`/^FMN-PLAN-/`, dst.). Pola generik `^PLAN-` bisa salah menangkap file proyek seperti `PLAN-migration.md`. Karena itu: akhiran versi wajib (`^PLAN-v\d+\.\d+\.md$`), dan artefak hanya dikenali di dalam folder `Sigma/`.
- **Ambiguitas kata "plan" dalam percakapan.** Di rules dan dokumen, artefak selalu ditulis huruf kapital beserta versinya, mis. "PLAN v2.1".
- **Proyek lama tetap terbaca.** [FAKTA] `src/engine/reconstruct.ts:64-68` sudah membaca dua nama folder sekaligus (`charter`/`design`, `contract`/`build`) sejak penggantian nama folder. Pola yang sama dipakai untuk nama file, `SIGMA:DOC type=`, dan marker section: v2 membaca nama lama dan nama baru.
- **Skala** [FAKTA, jumlah kemunculan nama lama]: `src/` ±300, `test/` ±470, `Sigma/` ±720, `setup/` ±350. Teks di `Sigma/` dan `setup/` ditulis ulang karena D-01, jadi biaya tambahannya kecil; kode dan test bersifat mekanis tetapi menyentuh regex dan pengecekan tipe dokumen.

---

## 3. Kerja Sama FMN–DEV (Aturan Kontrak)

### 3.1 Aturan

1. FMN adalah satu-satunya pemilik dan penyunting plan. DEV tidak pernah mengedit plan.
2. Setelah plan APPROVED, FMN hanya boleh mengubah kontrak pada:
   - **Checkpoint 1 — FMN Pre-Build Review** (sekarang DEV-EXEC §7), sebelum DEV mulai membangun;
   - **Checkpoint 2 — FMN Post-Build Review** (sekarang DEV-EXEC §16), setelah DEV melapor selesai;
   - di luar dua titik itu, hanya dengan otorisasi eksplisit Director.
3. Setiap perubahan kontrak **wajib** diberitahukan ke DEV lewat `sigma send` (jenis pesan baru, mis. `CONTRACT_CHANGE`).
4. DEV boleh mengajukan permintaan perubahan ke FMN (jenis pesan baru, mis. `CONTRACT_CHANGE_REQUEST`) dengan justifikasi. FMN memutuskan: terima, tolak dengan alasan, atau eskalasi ke Director.
5. Ketidaksepakatan FMN–DEV diputuskan Director.
6. Perubahan yang ternyata menyentuh intent tidak diselesaikan di plan. Jalurnya Amendment Request ke ARC (sudah ada, `ARC-RULE.md` §Amendment Request).
7. Perubahan yang **melonggarkan** kriteria penerimaan atau kontrak uji (menurunkan ambang, menghapus uji, mengganti bukti dengan yang lebih lemah) wajib ditandai *pelonggaran*. FMN wajib meminta persetujuan Director sebelum DEV melanjutkan (D-09).

### 3.2 Catatan perubahan kontrak di plan

Satu tabel ringkas (section baru di plan), biasanya 0–3 baris:

| No | Checkpoint | Yang berubah | Alasan | Diminta oleh | Pelonggaran? | Disetujui Director |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Pre-build | AC-003: ambang p95 dari 200 ms menjadi 300 ms | Batas API pihak ketiga | DEV | Ya | 2026-10-02 |

Tabel ini ikut terkunci bersama pasangan plan+exec dan menjadi catatan final.

### 3.3 Pengaman yang bisa ditegakkan CLI [INFERENSI tentang kelayakan]

- **Deteksi perubahan plan setelah APPROVED** memakai hash. [FAKTA] Mekanismenya sudah ada untuk intent (`certifyIntentDoc` / `isIntentDocUncertified`, `chain.ts:1174-1190`) dan tinggal dipakai ulang untuk plan.
- **Pencocokan revisi plan dengan pesan `CONTRACT_CHANGE`** di mailbox.
- **Yang tidak bisa ditegakkan CLI:** menilai *apakah* suatu perubahan termasuk pelonggaran (butuh penilaian makna) dan *siapa* yang mengedit (role adalah identitas prompt, bukan identitas terverifikasi). Keduanya tetap doktrin di rules, dengan Director sebagai pemeriksa akhir lewat tabel §3.2.

---

## 4. Prinsip Penulisan Dokumen Sigma v2

Mengacu D-02, dan menggantikan `SIGMA_PROTOCOL.md` §16B yang saat ini menyatakan FMN-PLAN dan DEV-EXEC adalah "AI-operational; dense formatting acceptable" [FAKTA].

1. **Semua artefak ditulis untuk manusia terlebih dulu.** Tidak ada lagi pembagian "artefak manusia" dan "artefak mesin".
2. **Ringkasan untuk Director selalu di bagian paling atas**, maksimal 5 kalimat, bebas jargon dan ID. Sekarang ringkasan ini ada di akhir FMN-PLAN (§10) dan DEV-EXEC (§18) [FAKTA].
3. **Diadopsi dari `/humanize`:** bahasa awam, satu gagasan per kalimat, tanpa pengulangan, dan tidak menciptakan kepastian palsu.
4. **Tidak diadopsi dari `/humanize`:** izin *Compress/Infer/Omit*. Angka ambang, hal yang tidak dikerjakan, batasan wajib, dan verdict ditulis persis.
5. **Struktur mesin dibuat minimal:** marker section tetap (dibutuhkan `docCheck`), ID formal tetap (`REQ-001`, `AC-001`, dan sejenisnya), tabel hanya bila isinya memang tabel.
6. **Instruksi pengisian tidak ditulis di template.** Blockquote panjang di tiap section dipindah ke rules role yang mengisinya. Template hanya memuat judul, satu baris petunjuk, dan tempat isian.
7. **Isi yang sama di setiap proyek (boilerplate) dihapus dari template** dan dipindah ke rules atau protocol.
8. **Yang bisa dihasilkan otomatis tidak ditulis manual**, misalnya bukti git (`sigma git evidence`), status plan di ROADMAP, dan riwayat amandemen.

---

## 5. Inventaris Section Template

Tindakan: **Tetap** · **Gabung** (ke section lain) · **Pindah** (ke rules/protocol) · **Hapus** · **Otomatis** (dihasilkan CLI) · **Opsional** (hanya bila relevan).

### 5.1 INTENT — dulu DIR-INTENT (14 section → 9 section + ringkasan)

| Section sekarang [FAKTA] | Tindakan | Section v2 |
| :--- | :--- | :--- |
| — | **Baru** | 0. Ringkasan untuk Director (≤ 5 kalimat) + contoh uji batas (3 termasuk / 3 tidak termasuk, dalam bentuk skenario) |
| 1.1 Objective, 1.2 Problem, 1.3 Target User, 1.5 Primary Value | Gabung | 1. Tujuan dan Masalah |
| 1.4 Desired Outcome + 3.1–3.3 Concrete Outcome, Threshold, Measurement | Gabung (template lama sendiri menyebut 3.1 harus mengukur 1.4) | 2. Hasil yang Diharapkan dan Cara Mengukurnya |
| 1.6 Tier Definitions | Pindah ke ARC-RULE; kolom Tier tetap di tabel | — |
| 2. Comprehensive Research | Opsional (hanya bila NEEDED) | 8. Riset |
| 3.4 Minimum Viable Evidence (sama di setiap proyek) | Pindah ke protocol | — |
| 4. Quality Bar (+4.1 notes) | Tetap, diringkas (divalidasi CLI) | 4. Standar Kualitas |
| 4.2 Quality Trade-offs + 5. Strategic Trade-offs | Gabung | 5. Prioritas dan Batasan |
| 6.1 In Scope | Tetap | 3. Ruang Lingkup — Dikerjakan |
| 6.2 Out of Scope + 6.3 Non-Goals | Gabung | 3. Ruang Lingkup — Tidak Dikerjakan |
| 6.4 Why This Boundary Matters | Gabung ke kolom alasan | — |
| 7. Constraints, 8.1 Tech Stack, 8.2 Architecture, 8.4 Rejected Approaches, 11.4 DEV Must Not | Gabung jadi satu tabel dengan kolom tingkat keterikatan | 5. Prioritas dan Batasan |
| 8.3 Solution Assumptions + 10. Risk (10.1–10.4) | Gabung | 6. Asumsi dan Risiko (termasuk satu kalimat "proyek dianggap gagal bila …") |
| 9. Functional Requirements | Tetap, format diringkas | 7. Kebutuhan Fungsional |
| 11.1 Execution Focus | Tetap | 7a. Arahan untuk FMN (bagian dari section 7 atau berdiri sendiri; diputuskan saat pilot) |
| 11.2, 11.3 checklist FMN (sama di setiap proyek) | Pindah ke FMN-RULE | — |
| 12. AUD Findings (+ kriteria verdict panjang) | Tetap diringkas; kriteria verdict pindah ke AUD-RULE | 9. Catatan AUD |
| 13. Final Validation Checklist (15 checkbox) | Hapus; CLI memeriksa isi section secara langsung | — |
| 14. Amendment History | Otomatis ke log (D-10d); satu baris "Amandemen terakhir" di header | — |

Perkiraan panjang template: dari 553 baris menjadi sekitar 150–200 baris [INFERENSI; dipastikan saat pilot].

### 5.2 PLAN — dulu FMN-PLAN (10 section → 8 section + ringkasan)

| Section sekarang [FAKTA] | Tindakan | Section v2 |
| :--- | :--- | :--- |
| 10. Director's Summary | Pindah ke atas | 0. Ringkasan untuk Director |
| 1. Source Alignment | Diringkas; tambah revisi intent acuan (D-10b) | 1. Acuan (intent vN rev r, tahap ROADMAP) |
| 2.1 Sigma Artefact Requirement + 2.2 Output Requirement (+2.3 Ownership) | Gabung jadi satu tabel; Ownership pindah ke FMN-RULE; opsional | 2. Prasyarat |
| 3. Work Order / Task Plan | Tetap | 3. Pekerjaan |
| 4. Acceptance Criteria + 7. Pre-Build Test Contract | Gabung: satu tabel `AC-xxx` berisi kriteria, cara uji, hasil yang diharapkan, bukti, dan kolom opsional "perintah uji" untuk Evidence Engine nanti | 4. Kriteria Penerimaan dan Kontrak Uji |
| 5. Implementation Constraints + 8. DEV Handoff (must / must not) | Gabung | 5. Batasan untuk DEV |
| 8. "DEV should report in DEV-EXEC" (sama di setiap proyek) | Pindah ke DEV-RULE | — |
| 6. Protocol Overrides & Expansions | Tetap, opsional | 6. Pekerjaan di Luar Intent |
| — | **Baru** (D-08, D-09) | 7. Perubahan Kontrak (tabel §3.2) |
| 9. AUD Findings (+ kriteria verdict panjang) | Tetap diringkas; kriteria pindah ke AUD-RULE | 8. Catatan AUD |

### 5.3 EXEC — dulu DEV-EXEC (18 section → 7 section + ringkasan)

| Section sekarang [FAKTA] | Tindakan | Section v2 |
| :--- | :--- | :--- |
| 8. What Was Implemented, 15. Completion Summary, 18. Director's Summary | Gabung dan pindah ke atas | 0. Ringkasan untuk Director |
| 1. Source Plan Alignment, 2. DEV Pre-Build Assessment, 4. Implementation Approach, 5. Files To Change, 6. Key Technical Decisions | Gabung | 1. Rencana Implementasi (acuan plan vN.x rev r, pemahaman, pertanyaan, pendekatan, file, keputusan teknis, status kesiapan) |
| 3. Technical Research | Opsional, sub-bagian dari section 1 | 1a. Riset Teknis |
| 7. FMN Pre-Build Review | Tetap — **Checkpoint 1** | 2. Tinjauan FMN Sebelum Membangun |
| 8. Walkthrough (How It Works, Main Flow, Logic), 10. Dependency Changes, 11. Developer Verification | Gabung | 3. Hasil dan Verifikasi DEV |
| 12. Git / Change Evidence | Otomatis (`sigma git evidence`) | bagian dari section 3 |
| 9. Deviations, 13. Issues, 14. Known Limitations (+ Deviation Update Checklist) | Gabung jadi satu tabel dengan kolom "jenis"; checklist pindah ke DEV-RULE | 4. Penyimpangan, Masalah, dan Batasan |
| 15. DEV Advisory Status | Gabung jadi satu baris status di section 3 | — |
| 16. FMN Post-Build Review | Tetap — **Checkpoint 2**; verdict `READY_FOR_LOCK` diganti `READY_FOR_APPROVAL` | 5. Tinjauan FMN Setelah Membangun |
| 17. Director Observation & Minor Requests | Tetap | 6. Temuan dan Permintaan Director |

### 5.4 CLOSE — dulu DIR-CLOSE (9 section + 3 lampiran → 5 section + lampiran opsional)

| Section sekarang [FAKTA] | Tindakan | Section v2 |
| :--- | :--- | :--- |
| 1. Closure Decision + 9. Final Director Decision | Gabung | 1. Keputusan Penutupan (verdict, satu paragraf, kalimat penutup) |
| 2. Human Project Story + 3. Delivered State | Gabung | 2. Perjalanan dan Hasil |
| 4. Intent Satisfaction | Tetap | 3. Kesesuaian dengan Intent |
| 5. Evidence Map | Tetap, tingkat klaster | 4. Bukti |
| 6. Limitations/Deviations + 8. New Intent Boundary | Gabung | 5. Batasan dan Pekerjaan untuk Intent Berikutnya |
| 7. Operational Handoff | Opsional | Lampiran |
| Lampiran A–C | Opsional (tetap) | Lampiran |

### 5.5 ROADMAP

Sudah ringkas (84 baris) [FAKTA]. Cukup disesuaikan dengan penomoran baru (D-03) dan gaya bahasa (D-02). "Planned Stage" tetap opsional.

---

## 6. Inventaris Rules dan Doktrin

**Skala** [FAKTA, hitungan kalimat berisi "must/MUST"]: ARC-RULE 62, AUD-RULE 83, DEV-RULE 65, FMN-RULE 65, PROTOCOL 27, CONSTITUTION 18. Total sekitar 320 aturan.

**Batasan dokumen ini:** inventaris di bawah dibuat pada **tingkat klaster**. Pemetaan per kalimat (setiap MUST → dipertahankan di mana) dibuat saat penulisan ulang, dalam bentuk tabel keterlacakan, supaya tidak ada aturan yang hilang tanpa keputusan.

### 6.1 Struktur rules v2 [USULAN]

| File v2 | Isi | Menggantikan |
| :--- | :--- | :--- |
| `COMMON-RULE.md` (baru) | Doktrin umum 11 butir, bahasa otorisasi Director, kelas perintah CLI, protokol pesan antar-role, penulisan temuan AUD, prinsip penulisan (§4) | Bagian yang ditulis ulang di setiap rule role, PROTOCOL §4.0, §16A, §16C, §16E |
| `ARC-RULE.md`, `FMN-RULE.md`, `DEV-RULE.md`, `AUD-RULE.md` | Struktur seragam: Peran · Yang boleh · Yang tidak boleh · Titik keputusan Director · Pesan wajib · Perintah CLI · Cara mengisi artefak miliknya | Rule sekarang (28–44 KB per file) |
| `SIGMA_PROTOCOL.md` | Spesifikasi referensi: state, gate, artefak, folder. Tanpa pengulangan isi rules | PROTOCOL sekarang (58 KB) |
| `SIGMA_CONSTITUTION.md` | Prinsip dasar, singkat | Tetap, dipangkas (D-20) |
| Skill 4 target | Dihasilkan dari satu sumber | Skill yang ditulis manual 4 kali |

Target ukuran per rule role: sekitar 10–15 KB [USULAN, untuk diuji].

### 6.2 Klaster per rule

**ARC-RULE**

| Klaster [FAKTA: heading di ARC-RULE] | Tindakan |
| :--- | :--- |
| Core Responsibilities (ekstraksi intent, Sovereign vs Challengeable, koherensi, klarifikasi) | Tetap, diringkas |
| Key Rules (tidak menulis kode, tidak membuat plan/exec, tidak menimpa intent, AUD bukan otoritas, jaga kesederhanaan) | Tetap, diringkas |
| Research Mode (termasuk tingkatan sumber) | Tetap; detail tingkatan sumber pindah ke lampiran referensi |
| DIR-INTENT Creation Rules | Tulis ulang sesuai template v2 (§5.1), termasuk definisi tier yang dipindah dari template |
| AUD Findings Authorization | Pindah ke COMMON |
| Petition / Admission Review | Tetap, diringkas |
| Amendment Request | Tetap; tambah: amandemen memicu peninjauan pasangan yang masih APPROVED (D-10c) |
| Role Activation | Tetap, diringkas |
| Closure Evaluation + Satisfaction Score | Tetap, diringkas |
| Frasa komit skor ("catat skor") | Tetap (D-18) |
| CLI Operation Policy, Director Convenience | Bagian umum pindah ke COMMON; daftar perintah ARC tetap |
| Mandatory Triggers 1–2 | Tetap; Trigger 2 disesuaikan: dipicu saat pasangan menjadi LOCKED |

**FMN-RULE**

| Klaster | Tindakan |
| :--- | :--- |
| Build contract, test contract, DEV handoff, post-build review, observasi Director | Tetap; AC dan TC digabung (§5.2) |
| Tidak menulis kode, tidak menimpa intent (sadar tier), tidak menyetujui state, tidak menerima AUD mentah-mentah, menjaga kebebasan metode DEV | Tetap, diringkas |
| ROADMAP wajib | Tetap |
| FMN-PLAN Creation Rules | Tulis ulang sesuai template v2; menerima checklist 11.2/11.3 dari DIR-INTENT |
| **Baru:** Aturan perubahan kontrak | §3.1 butir 1–7 |
| Trigger 1 "setelah plan lock" | Ubah menjadi "setelah plan APPROVED" |
| Trigger 2 revisi exec | Tetap |
| **Baru:** Trigger 3 | Pemberitahuan `CONTRACT_CHANGE` ke DEV setiap perubahan kontrak |
| **Baru:** Respons atas `CONTRACT_CHANGE_REQUEST` dari DEV | Wajib dijawab: terima, tolak dengan alasan, atau eskalasi |

**DEV-RULE**

| Klaster | Tindakan |
| :--- | :--- |
| Implementasi, sumber rujukan, kebebasan metode | Tetap |
| Technical Objection Duty | Tetap; tambah jalur `CONTRACT_CHANGE_REQUEST` dengan justifikasi |
| Dokumentasi DEV-EXEC, walkthrough, deviasi, verifikasi, bukti git | Tulis ulang sesuai template v2 (§5.3); menerima "DEV should report" dari FMN-PLAN |
| Batas terminologi governance dalam kode (§9) | Tetap |
| Larangan (tidak mengubah plan/intent, tidak menyetujui sendiri, tidak melewati kontrak uji, menjaga pemisahan) | Tetap; tambah: tidak melanjutkan pekerjaan yang terdampak pelonggaran sebelum Director menyetujui |
| #7 Otorisasi Director sebelum mulai coding | Tetap; boleh diberikan sekaligus saat approve plan (D-16) |
| Triggers 1–3 | Tetap; tambah trigger permintaan perubahan kontrak |

**AUD-RULE**

| Klaster | Tindakan |
| :--- | :--- |
| Doktrin advisory, penilaian independen, tujuan vs rute, tidak menafsir liar | Tetap, diringkas |
| Mode (Critic, Verificator, Brutal Human-Proxy) | Tetap |
| Quality Bar Awareness | Tetap |
| Aturan audit per artefak | Tulis ulang mengikuti section v2 |
| Advisory Verdicts | Tetap; **menerima kriteria verdict yang dipindah dari template** |
| Format output | Tetap, diringkas |
| External Auditor Isolation | Tetap |
| Triggers | Tetap |

### 6.3 SIGMA_PROTOCOL

| Bagian [FAKTA: heading] | Tindakan |
| :--- | :--- |
| §3 Lifecycle, §5 Artifact Definitions | Tulis ulang untuk state APPROVED/LOCKED (§2) dan penomoran (D-03) |
| §5.1.1 Sovereign vs Operationalization | Tetap |
| §7 Gate Rules | Tulis ulang Gate 2 dan 3; tambah gate approve exec (§2.4) |
| §4.0 Common Role Doctrine, §16A CLI Operator Model, §16C Authorization Language, §16E Messaging | Pindah ke COMMON-RULE |
| §16B Human-Readable vs AI-Operational | Tulis ulang: semua artefak human-first (§4) |
| §16B External-Facing Projections (Humanize Operation) | Hapus; `notion push` memakai dokumen sumber (D-13) |
| §14–15 Audit Doctrine, AUD Activation | Tetap, diringkas |
| §16D Language Preference | Tetap |

---

## 7. Dampak ke Kode

Daftar ini adalah **perkiraan** dari pembacaan kode [INFERENSI dengan rujukan FAKTA]. Rincian pasti dibuat di dokumen PLAN-IMPL.

| Komponen | Perubahan |
| :--- | :--- |
| `src/engine/chain.ts` | State `APPROVED` untuk plan/exec; `nextPlanVersion` tanpa "−1" untuk chain baru; nomor revisi; penguncian pasangan otomatis; hash plan; Gate 2 dan 3 |
| `src/commands/plan.ts`, `exec.ts` | Perintah `approve` menggantikan `lock` (dengan tombstone seperti `intent lock` di `intent.ts:218`); pemeriksaan gate approve exec |
| `src/commands/send.ts`, `engine/mailbox.ts` | Jenis pesan `CONTRACT_CHANGE` dan `CONTRACT_CHANGE_REQUEST` |
| `src/utils/docCheck.ts` | `DOC_SPECS` skema v2 (section, urutan, label verdict, Quality Bar); tetap menerima skema v1 |
| `src/utils/amendmentHistory.ts`, `commands/intent.ts` | Render riwayat amandemen tidak lagi ke dokumen; satu baris header |
| `src/utils/roadmap.ts` | Status APPROVED/LOCKED di Stage Overview |
| `src/engine/humanizePush.ts`, `fidelityCoverage.ts`, `terminologyScanner.ts`, `notionService.ts` | Proyeksi `*-HUMAN` dan Fidelity Ledger dihapus; `notion push` memakai dokumen sumber (D-13) |
| `src/mcp/tools/*` | State dan gate baru di output orientasi |
| `src/engine/reconstruct.ts`, `commands/doctor.ts` | Memahami state dan skema v2 |
| `src/commands/scan.ts`, `src/engine/reconstruct.ts`, `src/utils/artifacts.ts`, nama template di `Sigma/templates/` | Nama file dan tipe dokumen baru (D-11), tetap membaca nama lama |
| `Sigma/SIGMA-OPERATION-REGISTRY.json`, `SIGMA-REGISTRY.json` | Perintah dan state baru |
| `test/*` | Test gate, lock, versi, dan doc-check diperbarui; test baru untuk pasangan LOCKED, revisi, pemberitahuan kontrak, dan dua skema |

---

## 8. Kompatibilitas Proyek Lama

[KEPUTUSAN D-12]

- Setiap chain menyimpan versi skemanya. Chain lama tetap berperilaku v1: `LOCKED` untuk plan/exec dan penomoran "−1".
- Template v1 tetap divalidasi dengan aturan v1 (`docCheck` dua skema). Template sudah membawa penanda `schema=` [FAKTA].
- Migrasi opsional, dipilih Director per chain:
  - plan LOCKED + exec LOCKED → pasangan LOCKED;
  - plan LOCKED + exec belum selesai → plan APPROVED.
- Chain lama tidak dinomori ulang (D-03).

---

## 9. Risiko

| Risiko | Mitigasi |
| :--- | :--- |
| Aturan penting hilang saat rules ditulis ulang | Tabel keterlacakan per kalimat MUST (§6) |
| Gaya humanize mengurangi presisi kontrak | Prinsip §4 butir 4: angka, larangan, dan verdict ditulis persis |
| Pelonggaran standar lewat permintaan "terlalu berat" | Penandaan pelonggaran + persetujuan Director saat itu juga (D-09); AUD boleh memeriksa tabel perubahan kontrak |
| Penilaian "pelonggaran" tidak bisa ditegakkan CLI | Doktrin di FMN/DEV-RULE; Director memeriksa tabel §3.2 sebelum approve exec |
| Biaya merawat dua skema | Skema v1 dibekukan (hanya perbaikan bug); v2 menjadi default proyek baru |
| Template baru ternyata kurang memadai untuk FMN/DEV | Pilot satu INTENT nyata sebelum implementasi penuh (§11) |

---

## 10. Keputusan Tambahan (dulu O-01 s.d. O-10)

Director memutuskan seluruh butir sesuai rekomendasi pada 28-09. Tidak ada keputusan desain yang masih terbuka.

| ID | Dulu | Keputusan | Alasan singkat |
| :--- | :--- | :--- | :--- |
| D-12 | O-01 | Proyek lama tetap didukung: dua skema, tanpa migrasi paksa; migrasi dipilih Director per chain (§8) | Proyek yang berjalan tidak rusak |
| D-13 | O-02 | Dokumen turunan `*-HUMAN` dan Fidelity Ledger dihapus; `notion push` memakai dokumen sumber | Setelah D-02, proyeksi terpisah menjadi duplikasi |
| D-14 | O-03 | Bahasa dokumen mengikuti konfigurasi bahasa yang sudah ada (default Indonesia); ID formal (`REQ-001`, `AC-001`, dan sejenisnya) tetap bahasa Inggris | Mekanismenya sudah ada (`sigma config`, PROTOCOL §16D) |
| D-15 | O-04 | Intent Brief tidak menjadi artefak terpisah; menjadi **section 0 INTENT** (ringkasan untuk Director + contoh uji batas 3 termasuk / 3 tidak termasuk) yang **wajib terisi** sebelum ratify | Manfaat konfirmasi makna tanpa menambah artefak |
| D-16 | O-05 | Otorisasi "mulai coding" tetap ada, tetapi boleh diberikan sekaligus saat approve plan dalam satu kalimat ("approve dan langsung bangun") | Satu interupsi berkurang, titik kendali tetap |
| D-17 | O-06 | Perintah `sigma plan approve` / `sigma exec approve`; `plan lock` / `exec lock` dihapus dengan pesan tombstone | Istilah perintah sama dengan status |
| D-18 | O-07 | Frasa khusus komit skor ("catat skor") dan instruksi verbatim `SKIP_FOR_AUDIT` dipertahankan | Jarang terjadi dan melindungi keputusan yang tidak bisa dibatalkan |
| D-19 | O-08 | Batas "2 putaran" hanya berlaku untuk debat posisi; iterasi klarifikasi intent selama DRAFT tidak dibatasi angka, Director yang memutuskan "cukup" | Mencegah tekanan lock prematur |
| D-20 | O-09 | CONSTITUTION dipertahankan sebagai dokumen prinsip singkat, terpisah dari PROTOCOL, dan dipangkas | Prinsip dan spesifikasi berbeda fungsi |
| D-21 | O-10 | Profil Lite **ditunda**; dinilai ulang setelah template v2 dipilot | Template v2 sudah memangkas banyak; keputusan Lite butuh data |

## 11. Langkah Berikutnya

1. ~~Director memutuskan O-01 s.d. O-10.~~ Selesai 28-09 (D-12 s.d. D-21).
2. **Pilot template:** saya menyusun template INTENT v2, lalu menerapkannya pada satu DIR-INTENT nyata yang sudah ada dari Director (mis. yang pernah miss intent). Ukuran keberhasilan: waktu review Director, dan apakah FMN bisa menyusun plan tanpa menebak.
3. Bila pilot berhasil: template PLAN, EXEC, dan CLOSE v2 disusun dengan pola yang sama.
4. **Dokumen PLAN-IMPL:** rincian perubahan kode (§7), tabel keterlacakan rules (§6), dan strategi test. Dokumen ini dijalankan sebagai chain Sigma sendiri.
5. Implementasi bertahap, dirilis sebagai `sigma-ecosystem` 2.0.0.

Tidak ada langkah yang dieksekusi sebelum Director memberi persetujuan eksplisit.

---

## 12. Track Terpisah — Perintah `sigma note` (Rilis 1.1.0)

**Status:** spesifikasi sudah diputuskan (D-22); **belum diimplementasikan**. Implementasi menunggu persetujuan eksplisit Director.

### 12.1 Latar belakang [FAKTA]

- Folder `Sigma/notes/` sudah dibuat otomatis oleh `sigma project start` (`src/config.ts:68`, `SUBFOLDERS`).
- Skill `/write-memo` sudah membuat file bebas di folder itu tanpa aturan penamaan (`setup/targets/claude_code/write-memo.md:34-36`).
- Belum ada perintah untuk membuat atau mendaftar catatan. Semakin banyak catatan, semakin sulit dicari.

### 12.2 Keputusan rinci (seluruhnya sesuai rekomendasi, 28-09)

| No | Keputusan |
| :--- | :--- |
| N-1 | Judul di nama file diubah otomatis: huruf kecil, spasi dan karakter selain huruf/angka menjadi tanda hubung, tanda hubung ganda dirapatkan, maksimal ±60 karakter. Aman untuk Windows. Judul asli tetap disimpan di dalam file |
| N-2 | Isi awal file berupa judul asli dan tanggal dibuat, bukan file benar-benar kosong |
| N-3 | `sigma note list --search <kata>` disertakan sejak awal |
| N-4 | Dikerjakan sekarang sebagai rilis 1.1.0, terpisah dari v2 |
| N-5 | Pengiriman hasil: file patch dulu selama akses push GitHub dari sesi ini masih ditolak (403); push ke branch bila akses sudah diperbaiki |

### 12.3 Spesifikasi

**Penamaan file**

```text
Sigma/notes/NOTE-<YYMMDDHHMM>-<judul-slug>.md
contoh: Sigma/notes/NOTE-2609281530-evaluasi-alur-sigma.md
```

- `YYMMDDHHMM` memakai jam lokal. Urutan abjad nama file sama dengan urutan waktu.
- Bila nama yang sama sudah ada (judul sama pada menit yang sama), file berikutnya diberi akhiran `-2`, `-3`, dan seterusnya.
- Bila judul menghasilkan slug kosong (mis. hanya simbol), perintah menolak dengan pesan error yang jelas.

**Isi awal file**

```markdown
# <Judul asli persis seperti diketik>

Dibuat: 2026-09-28 15:30
```

**Perintah**

| Perintah | Perilaku |
| :--- | :--- |
| `sigma note new --title "<judul>"` | Membuat file sesuai format; mencetak path file. `--title` wajib |
| `sigma note list` | Mendaftar semua catatan, terbaru di atas: tanggal, judul, nama file |
| `sigma note list --search <kata>` | Menyaring berdasarkan judul (tidak peka huruf besar-kecil) |

**Prinsip**

- **Tanpa file indeks.** `list` membaca isi folder secara langsung, sehingga tidak ada data yang bisa tidak sinkron.
- **Judul untuk `list`** diambil dari baris `# ...` pertama di dalam file. Bila tidak ada, dipakai nama file.
- **Catatan lama dengan nama bebas** tetap ikut tampil; tanggalnya diambil dari waktu modifikasi file dan ditandai sebagai catatan lama.
- **Kelas perintah Draft/Operational:** tidak butuh persetujuan Director, tidak masuk chain atau `progress-v<N>.json`, tidak terpengaruh lock.
- **Penamaan `NOTE` sudah mengikuti gaya D-11** (tanpa prefix role), sehingga tidak perlu diubah lagi saat v2.
- **Di luar cakupan 1.1.0:** pencarian di dalam isi catatan (full-text), tag, dan tautan ke artefak. Dinilai ulang setelah dipakai.

### 12.4 Perkiraan perubahan [INFERENSI]

| Komponen | Perubahan |
| :--- | :--- |
| `src/commands/note.ts` (baru) | Perintah `new` dan `list` |
| `src/cli.ts` | Mendaftarkan perintah `note` |
| `setup/targets/*/write-memo*` (4 target) | Memakai `sigma note new` saat membuat catatan |
| `Sigma/SIGMA-OPERATION-REGISTRY.json` | Entri perintah baru (lewat `npm run refresh-registries`) |
| `README.md`, `SIGMA_PROTOCOL.md` §16, `CHANGELOG.md` | Dokumentasi perintah dan catatan rilis 1.1.0 |
| `test/note.test.ts` (baru) | Format nama, slug aman Windows, tabrakan nama, slug kosong, urutan list, `--search`, catatan lama |
