# PLAN-IMPL — Sigma Humanize Operation

**Sumber**: Lanjutan diskusi evaluasi `feat/notion-integration` pada sesi ini (2026-08-16) — akar masalah "artefak Sigma AI-readable, sulit dibaca manusia", dicontohkan langsung dari `/home/dikoharyadhanto/Documents/Works/Projects/CanopySense/Sigma/` (38 versi `DEV-EXEC`, 15–74KB per file). Revisi 2 memasukkan hasil konsultasi Director dengan ChatGPT mode AUD (opini arsitektur + diskusi struktur dokumen) dan keputusan lanjutan Director.
**Tanggal**: 2026-08-16 · **Revisi 6**
**Status**: **Fase 1–8 selesai dan teruji** (eksekusi 2026-08-19, branch `feat/sigma-humanize-operation` dari `feat/notion-integration-v2`, 10 commit, dipush ke GitHub). 55 test baru, 391 total, tanpa regresi. Fase 9 (perluasan skill `/humanize` ke tool lain) sengaja belum disentuh — menunggu izin eksplisit Director, sesuai arahan awal. Revisi 6 sebelumnya menutup lima closure requirement dari audit eksternal ChatGPT mode AUD (§0.3): CR-01 lifecycle deadlock, CR-02 fidelity coverage, CR-03 klaim stale-Notion, CR-04 spec-vs-vehicle, CR-05 pemisahan human-facing vs provenance — kini terverifikasi lewat implementasi nyata, bukan cuma dokumen (10 test regresi CR-01 membuktikan `intent ratify`/`exec lock` tidak pernah diblokir gate humanize). Implementasi juga menemukan dan memperbaiki dua celah baru yang tidak terlihat sampai kode nyata ditulis: judul halaman Notion yang bocor istilah Sigma (§7), dan `collectHumanPushTargets` yang akan push-ulang artefak SUPERSEDED (§4).
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma — meskipun isinya *mengusulkan* perubahan pada mekanisme gate Sigma sendiri.
**Hubungan dengan plan lain**: `PLAN-IMPL-NOTION-REMOTE-GOVERNANCE-INTEGRATION-V2-20260816` **selesai diimplementasikan** (Fase 1–5, ter-commit di `feat/notion-integration-v2`), direvisi khusus supaya primitif sync-nya (`syncArtifactToNotion`/`fetchArtifactFromNotion`, D-04/D-05/D-06) generik dan siap dipakai plan ini tanpa rework mesin. Plan ini **adalah konsumen v2**, bukan sebaliknya. Path sumber di §2.1 mengikuti struktur folder baru dari `PLAN-IMPL-SIGMA-ARTIFACT-FOLDER-RENAME-20260816` (`Sigma/charter/`, `Sigma/contract/`, `Sigma/roadmap/`, `Sigma/evidence/`, `Sigma/human/`) — plan itu tidak perlu selesai lebih dulu untuk Fase 1–3 plan ini dimulai, tapi command `humanize` final harus konsisten dengan folder mana pun yang sudah aktif saat Fase 3 digarap.
**Branch**: `feat/sigma-humanize-operation`, dibuat dari `feat/notion-integration-v2` (bukan `main`, sesuai eksekusi 2026-08-19) — alasan "dari main" di draf sebelumnya sudah tidak berlaku: v2 saat itu masih PENDING (risiko batal), sekarang sudah selesai diimplementasikan dan stabil. Fase 4/5c/6 di sini butuh primitif `syncArtifactToNotion`/`fetchArtifactFromNotion` yang cuma ada di v2 — bercabang dari v2 menghindari menulis ulang mesin sync yang sudah ada. `main` tidak disentuh, tidak ada merge tanpa izin eksplisit Director.

---

## 0. Kerangka arsitektur (hasil diskusi dengan ChatGPT mode AUD)

Director mengonsultasikan draft Revisi 1 plan ini ke ChatGPT mode AUD. Poin yang disetujui dan dijadikan prinsip mengikat untuk seluruh plan ini:

- **Sigma artifact tetap satu-satunya source of truth.** Humanize adalah *projection/translation layer*, bukan artefak governance kedua. Kalau Human doc bilang "Intent saat ini adalah X" tapi sumber aslinya Y, X tidak pernah boleh mengubah Y.
- **Notion bukan database governance** — cuma ruang baca manusia yang mencerminkan (bukan menggantikan) state Sigma.
- **AI melakukan semantic humanization; sistem (Sigma CLI) menentukan apa yang boleh dianggap state resmi.** Pembagian ini konsisten dengan model role Sigma yang sudah ada (AI menafsirkan dalam batas rule file, CLI menegakkan gate/lock).
- **Risiko terbesar plan ini bukan soal transport (sudah ditangani solid oleh v2), tapi soal kesetiaan makna** ("apakah AI menerjemahkan artifact secara faithful tanpa mengubah maknanya"). Lihat §2.3 untuk invariant dan mekanisme konkretnya.

---

## 0.3 Audit eksternal (ChatGPT mode AUD) — verdict REJECT_RECOMMENDED, lima closure requirement

Sebelum Revisi 6, ketiga plan (Notion v2, Humanize, Folder Rename) diaudit sebagai satu architectural change set oleh Director bersama ChatGPT mode AUD, dengan `SIGMA_CONSTITUTION`/`SIGMA_PROTOCOL` sebagai baseline. Verdict: `PASS_WITH_RISK` untuk Notion v2 dan Folder Rename, **`REJECT_RECOMMENDED` untuk Humanize dan untuk inter-plan architecture** — bukan karena arah arsitekturnya salah, tapi karena dua kontradiksi mekanis:

- **CR-01 (blocking)** — deadlock siklik: §2.1 (versi sebelum revisi ini) mewajibkan source RATIFIED/LOCKED sebelum humanize boleh jalan, sementara §3.4 menjadikan humanize+push sebagai syarat lock/ratify itu sendiri → `RATIFY → HUMANIZE → RATIFY`. Diverifikasi nyata, bukan salah baca — dua aturan yang masing-masing masuk akal sendiri-sendiri tidak pernah dicek interaksinya. Ditutup di §2.1/§3.4 (lihat di bawah).
- **CR-02 (blocking)** — "Preserved From Source" (versi sebelum revisi ini) adalah self-attestation oleh AI yang sama yang melakukan kompresi, bukan bukti yang bisa direview independen; dan bahkan dengan kutipan verbatim, belum ada jaminan **cakupan** (item source yang tidak disebut sama sekali di section fidelity bisa jadi sengaja di-Compress/Omit, atau terlupakan — dua itu tidak bisa dibedakan). Ditutup di §2.3.
- **CR-03 (required correction)** — klaim §2.5 "Notion tidak boleh menyimpan dokumen usang" overclaim dibanding mekanisme sebenarnya (rekonsiliasi cuma saat push berikutnya, bukan langsung saat supersede). Ditutup di §2.5.
- **CR-04 (required clarification)** — skill `/humanize` mencampur "spesifikasi normatif" dengan "implementasi khusus Claude Code" jadi satu file, padahal Humanize adalah pipeline governance-facing yang seharusnya tidak implisit bergantung pada satu tool AI. Ditutup di §2.8.
- **CR-05 (required architectural clarification)** — tension antara "human doc dilarang total istilah Sigma" (§2.6) dan kebutuhan fidelity evidence yang harus merujuk ID/section sumber (yang notabene istilah Sigma). Ditutup di §2.3, dipisah jadi file terpisah yang tidak pernah dipublikasikan.

Model referensi yang disepakati dari audit ini, dipertahankan sebagai baseline arsitektur (tidak berubah dari desain yang sudah ada, cuma dikonfirmasi eksplisit): `Sigma canonical artifact` → (**controlled projection** — di titik inilah fidelity mechanism berada) → `Human artifact (*-HUMAN)` → (publication/mirror) → `Notion (human-facing UI)`. Authority selalu di lapisan paling atas; human artifact tidak pernah jadi authority baru; Notion adalah **publication surface**, bukan governance state.

**Status setelah Revisi 6**: kelima closure requirement ditutup di bawah. Director memutuskan tidak diperlukan siklus re-audit formal tambahan terhadap mekanisme plan — draf tiga template human (§7) yang akan direview bersama ChatGPT-AUD selanjutnya adalah level detail berikutnya (redaksi/gaya), bukan pengujian ulang lima closure requirement ini.

---

## 1. Masalah yang diselesaikan

Artefak Sigma (`DIR-INTENT`, `FMN-PLAN`, `DEV-EXEC`) sengaja ditulis rinci dan berstruktur formal (ID requirement, tabel risk register, checklist evidence, blok "Audit Status" per section) — itu benar untuk kebutuhan validasi CLI dan audit AI. Tapi itu membuatnya nyaris tidak terbaca bagi manusia yang cuma ingin tahu "proyek ini sedang di titik apa, keputusan besarnya apa". Bukti konkret: `CanopySense/Sigma/build/` punya 38 versi `DEV-EXEC` (15–74KB tiap file) dan puluhan `FMN-PLAN` — volume yang tidak realistis dibaca manusia dalam format aslinya.

Solusi yang disepakati: bukan mengubah format artefak asli (itu tetap AI-readable, tetap satu-satunya artefak yang immutable/berwenang untuk validasi gate), tapi menambahkan **operasi baru** yang menghasilkan versi human-readable terpisah dari versi RATIFIED/LOCKED, dan versi human ini yang didorong ke Notion sebagai satu-satunya isi yang manusia baca di sana.

---

## 2. Konsep Inti

### 2.1 Tiga tipe dokumen human — mengikuti pasangan versi PLAN↔EXEC yang sudah ada di kode, plus DIR-CLOSE

Draft awal (Revisi 1) mengusulkan 3 template 1:1 dengan 3 artefak (`intent`/`plan`/`exec`). **Direvisi**: `FMN-PLAN` dan `DEV-EXEC` digabung jadi satu dokumen human per pasangan versi, karena keduanya **sudah dijamin satu kesatuan versi oleh kode**, bukan asumsi desain — `nextExecVersion()` di [`src/engine/chain.ts:1051-1053`](../src/engine/chain.ts#L1051-L1053) secara literal `return planVersionRef`. Menggabungkan keduanya tidak memaksakan struktur baru; ia mengikuti invariant yang sudah nyata. `DIR-CLOSE` ditambahkan belakangan (Revisi 4) sebagai tipe ketiga — lihat alasannya di bawah.

| Command | Sumber (harus RATIFIED/LOCKED) | Output | Cakupan |
| :--- | :--- | :--- | :--- |
| `sigma intent humanize` | `Sigma/charter/DIR-INTENT-v<N>.md` (+ diagram `ROADMAP-v<N>.md` dari `Sigma/roadmap/`) | `Sigma/human/DIR-INTENT-HUMAN-v<N>.md` | 1 per chain |
| `sigma exec humanize` | `Sigma/contract/FMN-PLAN-v<N>.md` **+** `Sigma/evidence/DEV-EXEC-v<N>.md` (pasangan versi yang sama) | `Sigma/human/PLAN-EXEC-HUMAN-v<N>.md` | 1 per pasangan versi PLAN+EXEC |
| `sigma close humanize` | `Sigma/close/DIR-CLOSE-v<N>.md` | `Sigma/human/DIR-CLOSE-HUMAN-v<N>.md` | 1 per chain |

`sigma plan humanize` sebagai command terpisah **dihapus** dari desain — diserap `exec humanize`, karena EXEC selalu locked setelah PLAN pasangannya, jadi itu titik alami di mana kedua dokumen sudah lengkap untuk digabung.

Kenapa bukan satu dokumen tunggal untuk seluruh proyek (opsi yang sempat dipertimbangkan dari saran ChatGPT-AUD): merangkum puluhan iterasi `DEV-EXEC` (38 di CanopySense) jadi satu narasi tunggal adalah tugas rekonsiliasi lintas-versi yang berat dan meningkatkan risiko semantic drift — justru risiko yang paling ingin dihindari (§2.3). Menggabungkan hanya PLAN+EXEC yang memang sudah dipasangkan sistem tetap mengecilkan jumlah dokumen secara berarti, tanpa memperluas cakupan rekonsiliasi per operasi humanize.

**Kenapa `DIR-CLOSE-HUMAN` ditambahkan**: closure adalah momen yang paling mungkin benar-benar dibagikan ke pihak luar — laporan akhir proyek ke klien/stakeholder. Sumbernya sendiri sudah dekat dengan naratif manusia — section 2 `DIR-CLOSE` literally bernama "Human Project Story". Konsekuensinya pekerjaan humanize untuk tipe ini jauh lebih ringan dari `PLAN-EXEC-HUMAN`: lebih banyak Preserve, lebih sedikit Compress/Rephrase — sebagian besar cuma substitusi terminologi (§2.6) dan pemadatan bagian yang masih formal (Evidence Map, checklist Final Director Decision). Tapi `DIR-CLOSE` sendiri **tetap tidak boleh disentuh langsung** oleh skill `/humanize` — filenya tetap punya marker struktural dan status lock yang divalidasi CLI, terlepas dari seberapa manusiawi prosanya. Sama seperti `DIR-INTENT`/`FMN-PLAN`/`DEV-EXEC`/`ROADMAP`, humanize selalu menghasilkan dokumen terpisah, tidak pernah mengedit sumbernya.

**Siapa yang menjalankan**: `sigma intent humanize` — ARC (pemilik intent). `sigma exec humanize` — biasanya **FMN** (pemilik PLAN asli dan pereview post-build EXEC, sehingga sudah punya konteks penuh atas keduanya di titik itu), tapi **tidak dikunci** ke satu role secara teknis di CLI — DEV juga boleh menjalankannya. `sigma close humanize` — ARC atau Director langsung (pemilik keputusan closure), belum dikunci final, lihat §6.

Humanize **tidak bisa dijalankan terhadap DRAFT** — hanya terhadap sumber yang sudah RATIFIED/LOCKED, mencegah dokumen human dibuat dari intent/plan/close yang masih bisa berubah.

**Konsekuensi urutan (CR-01, lihat §3.4)**: karena humanize butuh sumber RATIFIED/LOCKED, humanize **tidak pernah** bisa jadi syarat untuk RATIFIED/LOCKED itu sendiri — itu akan membuat command menghasilkan prasyaratnya sendiri. `intent ratify`/`exec lock` sendiri karena itu **tidak pernah** dicek terhadap status humanize. Gate wajib (kalau `notion_humanize_gate.enabled`) dicek di command yang membuka kerja *berikutnya* dari sumber yang sudah RATIFIED/LOCKED, bukan di command yang menghasilkan status itu — detail lengkap di §3.4.

### 2.2 Cakupan konten — overview + sovereign layer saja, technical layer dibuang

Keputusan Director: human doc **tidak** memuat seluruh isi artefak asli, hanya:

- **Overview** — ringkasan naratif singkat.
- **Sovereign layer** — Intent Core, Success Definition, Scope Boundary, Risk Appetite/Primary Failure Concern, Strategic Trade-Offs. Ini persis bagian yang sudah ditandai sendiri di template `DIR-INTENT` sebagai domain Director (bukan "auditable means").
- **Diagram ROADMAP** (Stage Overview yang sudah di-generate `sigma roadmap render`) — digabung ke `DIR-INTENT-HUMAN`, bukan jadi dokumen human terpisah untuk ROADMAP.

**Technical/architecture layer dibuang secara default** (§6 `Technical & Architecture Direction` di `DIR-INTENT`, dan detail implementasi teknis di `DEV-EXEC`) — alasan Director: bagian ini paling rawan berubah/kena amendemen, dan template sumbernya sendiri sudah menandainya "auditable means — not sovereign intent", jadi membuangnya dari human view bukan kehilangan informasi sovereign apa pun.

**Batas pengecualian** (memperjelas instruksi Director "kalau ada yang bisa masuk dipersilahkan"): technical content boleh masuk **hanya kalau ia scope/risk-relevant** (mis. "tidak mendukung macOS" — redaksinya teknis tapi substansinya batas scope), **bukan** kalau ia murni pilihan implementasi (mis. "pakai PostgreSQL vs MySQL"). Aturan ini dipakai bersama tiga kelas di §2.3.

### 2.3 Invariant kesetiaan makna — wajib, bukan sekadar prinsip

Disepakati dari diskusi dengan ChatGPT-AUD, dijadikan invariant mengikat:

> **Humanize boleh menyederhanakan representasi, tapi tidak boleh diam-diam mengubah, bertentangan dengan, atau mengarang makna otoritatif dari sumbernya.**

Tiga kelas perlakuan konten:

| Kelas | Contoh | Perlakuan |
| :--- | :--- | :--- |
| **Preserve** | keputusan, constraint, status, scope, risiko, kesimpulan evidence | Dipertahankan, boleh diringkas redaksi tapi substansi tidak berubah |
| **Compress** | detail implementasi berulang, reasoning verbose, metadata mekanis | Boleh dipadatkan bebas |
| **Omit with indication** | detail yang sengaja tidak ditampilkan karena bukan untuk pembaca manusia | Ditandai eksplisit sebagai "tidak ditampilkan", bukan dihilangkan tanpa jejak |

**Contoh konkret risiko yang harus dicegah** (dari diskusi ChatGPT-AUD): constraint asli `CON-007: IDCloudHost deployment is mandatory. GCP is explicitly prohibited.` tidak boleh menyusut jadi kalimat kabur seperti "Deployment menggunakan cloud infrastructure yang sesuai kebutuhan proyek" — secara bahasa terlihat baik, tapi constraint materialnya hilang total.

**Mekanisme penegakan — direvisi (CR-02, audit ChatGPT-AUD)**: versi sebelumnya ("Preserved From Source" diisi bebas oleh AI yang sama yang mengompresi) adalah self-attestation, bukan bukti yang bisa direview independen — dan bahkan dengan kutipan literal, tidak menjawab pertanyaan cakupan: item source yang tidak disebut sama sekali di section itu bisa jadi sengaja di-Compress/Omit, atau terlupakan, dan dua kondisi itu tidak bisa dibedakan hanya dari daftar yang AI pilih sendiri. Diganti dua lapis:

1. **Kutipan verbatim wajib untuk kelas Preserve.** Bukan parafrase — redaksi asli disalin apa adanya. Contoh: `CON-007 preserved: "IDCloudHost deployment is mandatory. GCP is explicitly prohibited."` — bukan "constraint deployment dipertahankan".
2. **Coverage check deterministik, bukan cuma daftar pilihan AI.** Setiap item material di source wajib disebut **minimal sekali** di section fidelity human doc, apa pun klasifikasinya (Preserve dengan kutipan / Compress dengan catatan / Omit dengan alasan) — berlaku untuk **semua** konten material, bukan cuma yang berID formal (koreksi dari audit eksternal terhadap `DIR-INTENT-HUMAN-TEMPLATE.md`: draf pertama cuma menandai section yang ditampilkan, diam soal yang dibuang — HR-01). Fungsi `checkFidelityCoverage(sourceContent, humanContent): string[]` menegakkan dua kelas:
   - **ID berstruktur**: `CON-*`, `RR-*`, `REQ-*`, `ASM-*`, **dan `SC-*`/`OS-*`/`NG-*`** (ID Scope Boundary — sempat tidak masuk daftar, celah yang sama dengan yang ditemukan di templatenya) — parse dari tabel terstruktur source, cross-check kemunculan di ledger.
   - **Dimensi bernama tetap, tanpa ID**: empat baris Quality Bar (Security / UX Trust / UI-Product Packaging / Performance-Cost, `DIR-INTENT` §4) — dicek by name, bukan pattern ID, karena bentuknya bukan tabel ber-ID. Diperlakukan setara: wajib disebut di ledger, tidak boleh diam-diam hilang.

   Kembalikan daftar item yang sama sekali tidak disebut (kosong kalau lengkap). Deterministik, sama semangatnya dengan `scanForSigmaTerminology` (§2.7) — membuktikan **tidak ada yang terlewat tanpa jejak**, bukan membuktikan tiap klasifikasi itu benar (itu tetap keputusan AI/reviewer, di luar jangkauan mekanisme deterministik — full semantic diff disepakati bersama ChatGPT-AUD sebagai over-engineering untuk masalah ini).

Section ini di human doc diberi nama **"Source Fidelity Ledger"** (dari "Preserved From Source" — nama lama menyiratkan cuma mencatat yang dipertahankan, padahal sekarang wajib menjelaskan **semua** ID, termasuk yang dibuang).

**Pemisahan human-facing vs provenance (CR-05, audit ChatGPT-AUD)**: Source Fidelity Ledger secara struktural berisi ID dan istilah Sigma (`CON-007`, referensi section `FMN-PLAN §4`, dst.) — itu bertentangan langsung dengan larangan total istilah Sigma di human doc (§2.6). Resolusinya: Ledger **bukan bagian dari dokumen yang dipublikasikan**. Disimpan sebagai file companion terpisah, tidak pernah di-push ke Notion dan tidak kena scan bebas-terminologi (§2.6/§2.7) — karena isinya memang untuk reviewer internal, bukan pembaca eksternal:

- `Sigma/human/DIR-INTENT-HUMAN-v<N>.md` — dokumen yang dipublikasikan, 100% bebas istilah Sigma.
- `Sigma/human/DIR-INTENT-HUMAN-v<N>.fidelity.md` — Source Fidelity Ledger, boleh penuh istilah/ID Sigma, **tidak pernah** dibaca oleh `syncArtifactToNotion`/pipeline push. Pola sama untuk `PLAN-EXEC-HUMAN`/`DIR-CLOSE-HUMAN`.

Push (§2.7) cuma membaca file utama; `checkFidelityCoverage()` membaca kedua file (source asli + file `.fidelity.md`) sebelum push diizinkan jalan.

### 2.4 PLAN-EXEC-HUMAN — daftar section, direvisi (audit eksternal, dua pass)

**Draf sebelumnya cacat dan sudah diperbaiki.** Audit eksternal dua-pass menemukan: (Pass 1) seluruh sepuluh sitasi section di tabel ini bergeser konsisten +1 terhadap `FMN-PLAN-TEMPLATE.md`/`DEV-EXEC-TEMPLATE.md` yang sebenarnya (section baru disisipkan di sumber — `Pre-requirement`, `Technical Research` — setelah tabel ini ditulis, tidak pernah diverifikasi ulang), satu sitasi (`§7 Dependency`) tidak pernah ada dengan nama itu sama sekali, "Verification & Status" mencampur dua vocabulary verdict berbeda (status self-report DEV vs verdict independen FMN) tanpa aturan rekonsiliasi, dan "Observation Report" diam soal apakah tiap temuan itu **sudah diperbaiki atau belum** — bukan cuma memuat komplainnya. (Pass 2, UX) urutan sepuluh section membenam status di posisi ke-6 dari 10, padahal itu jawaban paling dicari pembaca; `Input Data Requirement` di posisi 2 memutus alur naratif; empat section "masalah" berturutan (Deviation/Issues/Known Limitation) tidak punya sinyal mana yang material. Kedua pass diterima penuh — detail verifikasi di §7.2.

Section sekarang, urutan direstrukturisasi (identitas tiap section dipertahankan, cuma urutan/penggabungan yang berubah — bukan menghapus apa pun yang sudah dikunci):

| # | Section human | Diambil dari mana (dikoreksi) | Kelas |
| :--- | :--- | :--- | :--- |
| 1 | **Overview** | `FMN-PLAN` §10 Director's Summary + `DEV-EXEC` §18 Director's Summary — bagian overview-nya saja. **Wajib menyatakan status pakai vocabulary 3-kata yang sama dengan section 2** (delivered/partially delivered/not yet delivered), supaya Overview dan Status tidak bisa diam-diam berbeda cerita | Preserve (disatukan, tidak ditulis ulang dari nol) |
| 2 | **Status** *(pindah dari posisi 6, sebelumnya "Verification & Status")* | `DEV-EXEC` §11 Developer Verification + §15 DEV Completion Statement (self-report DEV) + §16 FMN Post-Build Review verdict (verdict independen FMN). **Aturan rekonsiliasi eksplisit** (menutup celah yang ditemukan audit): kalau §16 sudah terisi, **verdict FMN yang menang** — `READY_FOR_LOCK`→Implemented, `NEEDS_DEV_UPDATE`/`REVISION_REQUIRED`→Not Yet Implemented, `COMPLETE_WITH_RISK`→Partially Implemented. Kalau §16 belum terisi, pakai status self-report DEV (§15) sebagai fallback, **dan Fidelity Ledger wajib mencatat bahwa ini fallback, belum direview independen** — tidak boleh diam | **Preserve** — jawaban langsung "apakah ini beres", tidak boleh kabur |
| 3 | **What Was Asked** *(gabungan Work Order + Acceptance Criteria, dua sub-bagian eksplisit supaya tidak jadi restatement yang sama)* | `FMN-PLAN` §3 Work Order/Task Plan ("the ask" — satu kalimat) + §4 Acceptance Criteria ("how success was checked" — hanya kondisi yang bisa dicek, bukan mengulang §3 dengan kata lain) | Preserve — versi taktis dari Success Definition di level chain |
| 4 | **What Was Built** *(sebelumnya "Implementation Approach")* | `DEV-EXEC` §4 Implementation Approach — "apa yang dibangun/diubah" + rationale. **Bukan** "Implementation Walkthrough" (How It Works/Main Flow) — itu mechanism-level, tetap dibuang per §2.2 | Compress, sub-bagian teknis tunduk aturan scope/risk-relevant §2.2 |
| 5 | **What Had To Be True First** *(pindah dari posisi 2 ke sini — sesudah pembaca tahu tujuan & hasil, prasyarat baru terasa relevan, bukan menyela)* | `FMN-PLAN` §5 Implementation Constraints + §2.2 Output Requirement — kebutuhan data/input sebagai prasyarat kerja | Compress. **Catatan cakupan**: §5 Implementation Constraints tidak punya kolom ID di source — `checkFidelityCoverage()` tidak bisa mem-parsing baris ini secara mekanis (lihat §7.2 poin 4); cakupannya bergantung sepenuhnya pada review manual lewat Ledger, bukan gerbang otomatis |
| 6 | **Open Items** *(konsolidasi Deviation + Issues Encountered + Known Limitation jadi satu section, tiga sub-heading — pembaca yang mau lihat "apa yang belum sempurna" baca satu section, bukan tiga)* | `DEV-EXEC` §9 Deviations From FMN-PLAN, §13 Issues Encountered, §14 Known Limitations / Technical Debt | **Preserve** untuk Deviation dan Known Limitation (substansi tidak boleh dilunakkan); Compress untuk Issues Encountered (masalah signifikan tetap disebutkan) |
| 7 | **Feedback From Testing** *(rename dari "Observation Report" — nama lama terdengar seperti artefak QA internal, lolos scanner terminologi mekanis tapi tetap melanggar tujuan §2.6: pembaca awam harus paham tanpa hambatan)* | `DEV-EXEC` §17 — **ketiga sub-bagiannya**: Observation Report, Minor Requests, **dan DEV Implementation Follow-up** (status resolusi tiap item: Fixed/Explained/Accepted/Deferred) — draf sebelumnya cuma mengambil komplainnya, diam soal apakah sudah diperbaiki, itu pelanggaran HR-01 (§2.3) sendiri | **Preserve** — suara Director sendiri yang sudah tercatat, tidak boleh disentuh apalagi dibuang; status resolusi tiap item wajib ikut, bukan cuma temuannya |

Satu baris status singkat langsung di bawah judul dokumen (mis. "Status: Partially delivered") direkomendasikan sebagai tambahan template, independen dari urutan section — menjawab masalah "status tersembunyi" bahkan sebelum pembaca mulai baca section manapun.

**Dibuang total** (prosedural/AI-oriented, tidak menambah pemahaman manusia atas hasil): Source Alignment, DEV Pre-Build Assessment, Technical Research, FMN Pre-Build Review (checkpoint sebelum eksekusi — tidak relevan begitu siklus selesai), Protocol Overrides & Expansions, Git/Change Evidence, Files/Components To Change, AUD Findings (default omit; naik jadi Preserve kalau verdict-nya bukan PASS bersih — itu sinyal risiko, bukan detail prosedural).

"Evidence layer" yang tadinya jadi pertanyaan terbuka **terjawab lewat section #2 (Status)** — bukan section terpisah, cukup dipadatkan ke level kesimpulan (lulus/gagal, apa yang terbukti), bukan transkrip command mentah.

### 2.5 Dokumen superseded hilang dari Notion — lewat rekonsiliasi saat push berikutnya, bukan langsung (CR-03, audit ChatGPT-AUD)

**Klaim direvisi**: kalimat sebelumnya ("Notion tidak boleh menyimpan dokumen usang") overclaim dibanding mekanisme yang sebenarnya dibangun. Yang benar-benar dijamin: **Notion direkonsiliasi ke state chain terkini setiap kali `push` dijalankan** — bukan seketika saat sumbernya berstatus SUPERSEDED. Ada jendela waktu yang sah di mana Notion masih menampilkan dokumen human dari versi yang sudah SUPERSEDED secara lokal, sampai push berikutnya terjadi. Ini bukan bug — **eventual reconciliation on next push** memang guarantee yang dipilih, bukan immediate removal, karena immediate removal butuh hook otomatis di `intent supersede`/`plan supersede` yang berarti command governance inti dapat dependency network — melanggar prinsip yang sudah dikunci di plan v2 §1. Kalau jendela stale ini tidak bisa diterima Director untuk kasus tertentu, satu-satunya jalan adalah menjalankan `sigma notion push` manual segera setelah supersede — bukan menunggu mekanisme otomatis.

Begitu sumber sebuah versi berstatus SUPERSEDED (lewat `sigma intent supersede`/`sigma plan supersede`) **dan** push berikutnya dijalankan, halaman human-nya di Notion ikut dihapus. Sigma tetap satu-satunya pemegang riwayat lengkap (lokal), Notion cuma mencerminkan yang aktif per titik push terakhir.

**Bukan** diimplementasikan sebagai hook otomatis di dalam `intent supersede`/`plan supersede` — itu akan melanggar prinsip yang sudah dikunci di plan v2 (§1 plan v2: command governance inti tidak boleh punya dependency network). Sebagai gantinya: **rekonsiliasi setiap kali `push` dijalankan**. Setiap eksekusi push (baik lewat `sigma notion push` maupun alur `exec humanize` yang mendorong ke Notion) membandingkan versi yang sekarang LOCKED/aktif di chain terhadap daftar halaman yang ada di Notion (pakai listing parent-page dari D-06, plan v2), lalu menghapus halaman yang sumbernya sudah SUPERSEDED. Triggernya tetap langkah eksplisit operator, bukan efek samping tersembunyi — konsisten dengan "AI operator jalankan push setelah event penting."

Ini scope kerja baru (cross-reference state chain vs isi Notion), dicatat di Fase implementasi (§4).

### 2.6 Larangan terminologi Sigma — invariant kedua, berlaku untuk kedua tipe human artifact

Keputusan Director, ditekankan eksplisit: **human artifact dilarang keras menyebut atau memakai terminologi Sigma apa pun.** Alasannya bukan cuma soal enak dibaca — dokumen ini juga dipakai untuk dibagikan ke pihak luar (bukan cuma dibaca Director sendiri), dan Director tidak mau harus membuat versi alternatif terpisah setiap kali mau mengirim representasi manusia dari sebuah artefak Sigma. Jadi dokumennya harus lepas total dari konteks Sigma — pembaca yang tidak tahu apa itu Sigma harus bisa memahami dokumen ini tanpa hambatan.

Berlaku untuk **kedua** tipe human artifact (`DIR-INTENT-HUMAN` dan `PLAN-EXEC-HUMAN`), bukan cuma yang gabungan.

**Sumber daftar istilah — dua file, bukan tabel statis di dokumen ini** (keputusan Director, sesi lanjutan 2026-08-16):

- `Sigma/rules/sigma_terminology.default.json` — **bundled**, terisi otomatis begitu `sigma project start`/`sigma project sync` dijalankan, persis seperti `ARC-RULE.md`/`FMN-RULE.md` dkk. di folder yang sama. Isinya kosakata Sigma baku yang kita tetapkan, contoh starter (final tetap tabel di bawah, cuma dipindah tempat penyimpanannya):

  | Istilah Sigma | Padanan human |
  | :--- | :--- |
  | `DIR-INTENT` | "Project Brief" / "Goals" |
  | `FMN-PLAN` | "Plan" |
  | `DEV-EXEC` | "Execution Report" / "Delivery" |
  | `RATIFIED` / `LOCKED` | "Approved" / "Finalized" |
  | `DRAFT` | "In Progress" |
  | `Gate 1` / `Gate 2` / `Gate 3` | dihilangkan total — status mesin, tidak ada padanan manusia yang perlu; tersirat dari section Verification & Status |
  | Nama role (`ARC`/`FMN`/`DEV`/`AUD`) | dihilangkan, atau diganti fungsi generik ("reviewer", "team") kalau memang perlu disebut |
  | kata "Sigma" itu sendiri | tidak muncul di manapun dalam isi dokumen |
  | `chain_version`, `progress-v<N>.json`, istilah state-machine internal lain | dihilangkan total |

  Karena bundled dan disinkron ulang tiap `project sync`, file ini **tidak boleh diedit manual di project** — perubahan pada daftar baku dilakukan di sumber bundle (repo `sigma-ecosystem`), bukan per-proyek.

- `Sigma/sigma_terminology.custom.json` — **project-local**, sengaja **di luar** `Sigma/rules/` supaya `project sync` tidak pernah menyentuhnya. Mulai kosong. Director menambah istilah cukup minta AI ("tambahkan kata X ke daftar terminologi") — AI edit langsung filenya, **tanpa command CLI khusus**, karena ini daftar kata biasa, bukan state governance yang butuh lock/gate/Director Authorization Language.

Scanner (§2.7) membaca gabungan (union) kedua file, tidak peduli sumbernya default atau custom — satu mekanisme, dua sumber data.

**Soal false-positive** (istilah pendek seperti `AUD`/`DEV` yang punya makna lain di luar konteks Sigma): keputusan Director — tidak perlu matcher pintar/semantic. Ini gate yang selalu direview, bukan silent auto-reject; kalau kena false-positive, perbaikannya cukup reword baris yang kena, bukan bangun disambiguation. Matcher tetap word-boundary sederhana (deterministik, bukan penilaian AI, sesuai §2.7), tidak lebih dari itu.

Nama file lokal (`PLAN-EXEC-HUMAN-v1.1.md`) boleh tetap pakai istilah Sigma — itu housekeeping CLI, tidak pernah dilihat orang luar. Tapi **judul halaman di Notion** (yang saat ini masih pakai pola `"{artifactType} - {version}"` dari plan v2) harus diganti jadi sesuatu yang langsung bisa dipahami orang luar begitu Humanize aktif — dicatat sebagai item implementasi di §4 Fase 6.

### 2.7 Auto-scan wajib saat push — penegakan mekanis, bukan checklist saja

Keputusan Director: **push ke Notion untuk human artifact wajib melalui pemindaian otomatis terhadap daftar istilah §2.6.** Kalau terdeteksi satu kata pun terminologi Sigma, push **digagalkan** — bukan warning, gagal total, dokumen tidak terkirim ke Notion.

Konsekuensi berantai (direvisi mengikuti CR-01, lihat §3.4): gagal-scan → gagal-push → requirement "human projection tersedia" tidak terpenuhi → transisi lifecycle berikutnya (bukan lock/ratify artefak itu sendiri) terblokir mekanis. Ini mengubah aturan "tanpa istilah Sigma" dari sekadar checklist self-review (§2.3, masih bisa lolos kalau AI-nya lalai) jadi gerbang mekanis yang tidak bisa dilewati tanpa benar-benar membersihkan dokumennya.

Pipeline pre-push untuk human artifact sekarang tiga tahap, bukan satu, **urutan ini mengikat**:

0. **`stripTemplateInstructions(content): { cleaned: string; strippedLines: number }`** — hapus setiap baris yang diawali `>` (blockquote markdown) sebelum tahap manapun lain jalan. Aman secara struktural, bukan cocok-kata: keempat template human (§7) sengaja menulis seluruh instruksi sebagai blockquote dan seluruh konten asli sebagai paragraf biasa di bawah placeholder `[...]` — jadi `>` di dokumen manapun yang dihasilkan dari template ini pasti sisa instruksi, tidak pernah konten sungguhan. **Wajib jalan duluan**: instruksi template sendiri penuh istilah Sigma (sengaja diizinkan karena tidak pernah terbit) — kalau scanner terminologi jalan sebelum stripping, setiap dokumen baru akan selalu gagal gara-gara instruksinya sendiri. CLI mencetak ringkasan singkat (mis. `Stripped 9 instructional line(s) from DIR-INTENT-HUMAN-v1.md before push.`) — transparan, bukan diam-diam.
1. `scanForSigmaTerminology()`, terhadap hasil stripping — nol istilah Sigma di dokumen yang dipublikasikan.
2. `checkFidelityCoverage()` (§2.3, CR-02), terhadap hasil stripping — nol ID/dimensi source yang tidak tercatat di Source Fidelity Ledger.

**Aturan mengikat untuk template human ke depan**: sintaks blockquote (`>`) di keempat template ini dicadangkan eksklusif untuk instruksi AI-facing. Kalau ada kebutuhan legit menulis blockquote sebagai konten yang benar-benar dipublikasikan (mis. kutipan), itu tidak boleh pakai `>` — harus format lain (mis. italic atau paragraf biasa dengan atribusi inline) supaya tidak ikut terhapus stripping.

**Desain teknis** (mengikuti pola layering plan v2 — primitif generik tidak boleh tahu soal semantik human-artifact):

- Scanner baru, mis. `scanForSigmaTerminology(content: string, terminology: string[]): string[]` — mengembalikan daftar istilah yang ditemukan (kosong kalau bersih). Deterministik (word-boundary string-match terhadap gabungan `sigma_terminology.default.json` + `.custom.json`, §2.6), bukan penilaian AI — supaya tidak bisa "dinegosiasikan" oleh interpretasi. Daftar istilah jadi parameter, bukan hardcoded di fungsi — supaya fungsi yang sama dipakai ulang oleh command mandiri `sigma scan` (§2.10), bukan cuma jalur push.
- Dipanggil di titik **sebelum** memanggil primitif `syncArtifactToNotion` (plan v2), khusus untuk jalur push human artifact — **bukan** untuk push Governance Dashboard/Chain State (dua itu memang Sigma-facing by design, tidak kena aturan ini).
- Pesan gagal harus spesifik: sebutkan persis istilah apa yang ditemukan (dan idealnya lokasi/baris), supaya AI yang menjalankan humanize tahu persis apa yang harus diperbaiki sebelum coba lagi.
- Checklist "Preserved From Source" di §2.3 tetap dipertahankan sebagai lapisan pertama (self-review saat menulis) — auto-scan di §2.7 adalah lapisan kedua yang mekanis dan tidak bisa dilewati, bukan pengganti.

### 2.8 Skill `/humanize` — sudah ditulis, saat ini Claude Code saja

Aturan gaya penulisan yang dipakai baik oleh pipeline ini maupun secara umum (dokumen apa pun, bukan cuma artefak Sigma) sudah ditulis sebagai skill terpisah: [`setup/targets/claude_code/humanize.md`](../setup/targets/claude_code/humanize.md). Sudah melalui dua putaran review Director + ChatGPT mode AUD. Isinya: filosofi "write for a human" (bukan "write like a human"), invariant "jangan mengarang kepastian" (paling mengikat, di atas semua rule gaya), kerangka Preserve/Compress/Rephrase/Infer, 8 rule penulisan (passive-voice-preferred, larangan pola "X bukan Y", larangan artificial completeness, decision-first writing, istilah teknis dipertahankan kalau material, larangan parenthetical, penulisan efektif, larangan terminologi Sigma), dan section "Relationship to Sigma Humanize Operation" yang menyatakan eksplisit: pipeline ini **wajib** memakai skill ini untuk setiap dokumen yang akan di-push ke Notion, dan dokumen itu tambahan melewati auto-scan mekanis (§2.7) sebelum push.

**Status saat ini: cuma ada untuk Claude Code** (`setup/targets/claude_code/humanize.md`), dan **belum di-deploy** (belum tersalin ke `~/.claude/commands/`, belum bisa dipanggil `/humanize` di luar sesi ini) dan **belum terdaftar** di pipeline `sigma setup install`/`update` (`ROLE_FILES` di `src/commands/setup.ts` belum punya entri `humanize`). Perluasan ke AI tool lain (Codex, Reasonix, Antigravity, Cursor) dan wiring ke deployment pipeline **dicatat sebagai kerja terpisah di Fase 9 (§4)** — belum dieksekusi, ditulis dulu di plan sesuai arahan Director.

**Klarifikasi spec-vs-vehicle (CR-04, audit ChatGPT-AUD)**: karena Humanize adalah pipeline governance-facing (hasilnya jadi Lock Requirement, §3.4), aturan tulisannya tidak boleh implisit bergantung pada satu tool AI tertentu. Ditetapkan eksplisit: **section "Writing Rules" (dan seluruh isi normatif lain) di `humanize.md` adalah spesifikasi, bukan properti Claude Code.** File `setup/targets/claude_code/humanize.md` itu sendiri — termasuk format frontmatter dan sintaks aktivasi `/humanize`-nya — adalah **satu implementation vehicle** dari spesifikasi itu, bukan definisinya. Begitu Fase 9 jalan, port ke `setup/targets/codex/`, `reasonix/`, dll. mengadaptasi rule normatif yang sama ke konvensi tiap tool, bukan menulis rule baru dari nol. Fase 9 tetap boleh ditunda (tidak jadi prerequisite Fase 1–8) — yang berubah cuma kejelasan bahwa isi normatifnya sudah portable secara desain, meski baru satu vehicle yang ada saat ini.

### 2.9 `Sigma/notes/` — wajib pakai skill `/humanize`, tapi bukan gate lock

Folder barunya sendiri dikunci lokasinya di `PLAN-IMPL-SIGMA-ARTIFACT-FOLDER-RENAME-20260816` §2.1. Aturan kontennya dikunci di sini:

- **Wajib memakai skill `/humanize`** untuk gaya penulisan — sama seperti `DIR-INTENT-HUMAN`/`PLAN-EXEC-HUMAN`. **Bukan** Lock Requirement — tidak memblokir `intent ratify`/`exec lock`, tidak masuk daftar cek `sigma {domain} check`. Notes tetap harus jadi tempat catat cepat, bukan birokrasi tambahan; itu sifat yang justru jadi alasan folder ini ada.
- **Larangan referensi satu arah**: notes **tidak boleh** merujuk apa pun ke artefak Sigma (nama artefak, versi, state RATIFIED/LOCKED, dll. — daftar sama seperti §2.6). Artefak Sigma (termasuk versi human-nya) **boleh** merujuk ke notes — mis. dokumen human yang sudah memangkas detail teknis (§2.2) bisa menaruh pointer "lihat catatan X untuk detail lengkap" tanpa perlu meng-inline semuanya. Arah ini disengaja: melindungi sifat notes yang bisa dibagikan bebas ke pihak luar tanpa membocorkan struktur internal Sigma.
- **Penegakan**: memakai ulang `scanForSigmaTerminology()` yang sama dari §2.7 — bukan mekanisme baru. Bedanya dari `PLAN-EXEC-HUMAN`: scan ini jalan **saat notes akan di-push** (lihat poin berikut), bukan sebagai syarat lock artefak lain.
- **Push ke Notion: opsional, bukan default otomatis.** Notes bisa didorong ke Notion lewat jalur yang sama dengan human artifact (primitif generik `syncArtifactToNotion` dari plan v2), tapi cuma kalau Director secara eksplisit memintanya — konsisten dengan prinsip manual-only yang sudah dikunci di plan v2 §1. Tidak ada reconcile-on-push (§2.5) untuk notes — itu mekanisme khusus status SUPERSEDED yang cuma berlaku untuk artefak governance berversi; notes tidak punya siklus lock/supersede.

**Integrasi otomatis, transparan ke Director tanpa perlu diminta**: `sigma intent humanize` dan `sigma exec humanize` dirancang terintegrasi dengan skill `/humanize` — bukan opsi terpisah yang AI harus ingat sendiri untuk dipakai. Setiap kali salah satu command ini dijalankan, output CLI-nya menyertakan pesan eksplisit yang mengonfirmasi ke Director bahwa skill `/humanize` sedang dibaca dan diterapkan secara otomatis, mis.:

```text
Reading /humanize writing rules (setup/targets/claude_code/humanize.md)...
Drafting Sigma/human/DIR-INTENT-HUMAN-v1.md using /humanize style rules.
```

Director tidak perlu tahu detail bahwa skill ini ada atau memanggilnya sendiri — cukup melihat konfirmasinya muncul tiap kali humanize dijalankan. Ini dicatat sebagai bagian dari Fase 3 (§4, command `humanize`), bukan fase terpisah.

### 2.10 `sigma scan --file <path>` — command mandiri, terpisah dari gate push

Keputusan Director (sesi lanjutan 2026-08-16): scanner terminologi (§2.7) berguna lebih luas dari sekadar gerbang otomatis sebelum push — Director butuh cara memeriksa source code atau dokumen markdown apa pun secara manual sebelum dibagikan/dipublikasikan ke luar, terlepas dari alur Notion sama sekali.

- **Command baru, top-level**: `sigma scan --file <path>` — bukan di bawah `notion` atau `humanize`, karena use case-nya lebih luas dari kedua pipeline itu (bisa dijalankan ke file apa pun: source code, README, catatan, dll., bukan cuma dokumen yang menuju Notion).
- **Read-only, informational** — tidak menyentuh gate, lock, atau state chain apa pun. Memanggil `scanForSigmaTerminology()` yang sama dari §2.7, dengan daftar istilah gabungan dari §2.6.
- **Output terminal ringkas, detail ditulis ke log** — daftar lengkap (istilah + nomor baris + cuplikan) tidak dicetak ke terminal supaya tidak kepanjangan; ditulis ke `Sigma/logs/<timestamp>_terminology-scan.log` (folder `Sigma/logs/` sudah jadi konvensi bundled, dipakai `operations.jsonl` — bukan folder baru). Terminal cuma menampilkan jumlah temuan dan ke mana hasil lengkapnya disimpan:

  ```text
  $ sigma scan --file src/notes/architecture-overview.md
  2 term(s) detected. Full report: Sigma/logs/20260816-194512_terminology-scan.log
  ```

  Isi file log (contoh `Sigma/logs/20260816-194512_terminology-scan.log`):

  ```text
  Sigma terminology scan — src/notes/architecture-overview.md
  Scanned at: 2026-08-16T19:45:12.000Z

    Line 12: "...setelah DIR-INTENT diratifikasi, tim..."
             ^ DIR-INTENT
    Line 47: "...menunggu Gate 2 terbuka sebelum..."
             ^ Gate 2

  2 term(s) found. Review and reword before sharing this file externally.
  ```

  Kalau bersih, tidak ada file log yang ditulis (tidak ada isi yang berguna disimpan) — terminal langsung: `No Sigma terminology detected in <file>.`

- **Dikecualikan total dari file artefak Sigma sendiri**: `DIR-INTENT-*.md`, `FMN-PLAN-*.md`, `DEV-EXEC-*.md`, `ROADMAP-*.md`, `DIR-CLOSE-*.md` — dicocokkan lewat pola nama file, sama seperti daftar "Out Of Scope" yang sudah didefinisikan skill `/humanize` ([`setup/targets/claude_code/humanize.md`](../setup/targets/claude_code/humanize.md), section "Out Of Scope: Sigma Artifact Files Themselves"). File-file ini **wajar dan sengaja** penuh istilah Sigma — itu memang fungsinya. Kalau `--file` menunjuk salah satu dari pola ini, command berhenti dengan pesan eksplisit, bukan diam-diam mengembalikan hasil kosong yang bisa disalahartikan sebagai "sudah bersih":

  ```text
  Skipped: DIR-INTENT-v2.md is a Sigma artifact file — it is expected to
  contain Sigma terminology by design. `sigma scan` does not apply to
  DIR-INTENT/FMN-PLAN/DEV-EXEC/ROADMAP/DIR-CLOSE source artifacts.
  ```

  Pengecualian ini berdasarkan pola nama file, independen dari struktur folder mana pun yang sedang aktif (`Sigma/design/` lama atau `Sigma/charter/` dkk. dari `PLAN-IMPL-SIGMA-ARTIFACT-FOLDER-RENAME-20260816`) — tidak bergantung plan itu selesai duluan.

- **Scope saat ini: satu file per invocation** (`--file <path>`). Scan direktori/glob (`--dir`) dicatat sebagai kemungkinan perluasan, tidak dikerjakan di Fase 1 rilis ini kecuali diminta Director.

---

## 3. Konfigurasi `notion_humanize_gate.enabled`

Nama field final — sebelumnya sempat bertabrakan nama dengan `notion.enabled` milik plan v2, sudah diselaraskan di sini.

### 3.1 Trigger & default

- Ditanyakan sebagai pilihan **wajib dijawab** saat `sigma project start` (bukan opsional/skippable).
- Default: **ON**.
- Fallback otomatis ke **OFF** kalau CLI tidak bisa mendeteksi API Notion tersedia (mis. tidak ada token/koneksi terverifikasi) pada saat itu — proyek tetap bisa dibuat, tidak diblokir oleh ketidaktersediaan Notion.
- Tersimpan di `Sigma/project.config.json` sebagai `notion_humanize_gate.enabled` — sengaja berbeda nama dari `notion.enabled` milik plan v2 (soal token/koneksi terkonfigurasi) supaya tidak tertukar.

### 3.2 Bisa diubah di tengah proyek — dengan pagar

Disetujui Director: **boleh diubah**, dengan syarat:

- Bukan lewat edit `Sigma/project.config.json` manual (file ini tetap CLI-managed, konsisten dengan aturan project).
- Lewat command eksplisit dengan Director Authorization Language, mis. `sigma notion enable --director-confirm` / `sigma notion disable --director-confirm --reason "..."` — pola yang sama dengan command approval-class/risk-acknowledgment lain di proyek ini.
- **Tidak retroaktif.** State berlaku dari titik toggle ke depan. Artefak yang sudah locked+humanized sebelum toggle tetap sah apa adanya; tidak ada tuntutan menulis ulang sejarah.
- Setiap toggle otomatis tercatat di `Sigma/logs/operations.jsonl` (mekanisme yang sudah berjalan otomatis untuk semua CLI invocation) — cukup sebagai jejak audit, tidak perlu mekanisme lock/cooldown tambahan.

### 3.3 Cakupan: proyek baru saja

Gate ini **tidak retroaktif untuk proyek yang sudah ada** (mis. CanopySense) — hanya berlaku untuk proyek yang dibuat setelah fitur ini rilis dan menjawab `notion_humanize_gate.enabled = true` saat `project start`. Ini pilihan Director untuk menjaga biaya migrasi tetap murah.

### 3.4 Gate — wajib, tapi dicek di transisi berikutnya, bukan di lock itu sendiri (direvisi, CR-01)

**Desain sebelumnya keliru dan sudah dikoreksi.** Versi sebelum Revisi 6 menjadikan humanize+push sebagai syarat untuk `intent ratify`/`exec lock` itu sendiri — sementara §2.1 mewajibkan sumber sudah RATIFIED/LOCKED sebelum humanize boleh jalan. Itu deadlock siklik (`RATIFY → HUMANIZE → RATIFY`), ditemukan lewat audit eksternal ChatGPT-AUD, bukan cuma masalah kalimat. Invariant yang harus dijaga ke depan: **tidak boleh ada command yang menghasilkan prasyaratnya sendiri sekaligus diwajibkan oleh prasyarat itu.**

**Desain baru**: `intent ratify` dan `exec lock` **tidak pernah** dicek terhadap status humanize — keduanya jalan seperti sebelum plan ini ada. Requirement humanize+push dicek di command yang membuka kerja *berikutnya*, terpisah dari command yang menghasilkan sumbernya:

| Sumber jadi RATIFIED/LOCKED lewat... | Requirement humanize dicek di... | Diblokir sampai... |
| :--- | :--- | :--- |
| `sigma intent ratify` | `sigma plan new` (memulai FMN-PLAN dari intent ini) | `sigma intent humanize` untuk intent ini sudah jalan **dan** ter-push |
| `sigma exec lock` | `sigma plan new` (iterasi berikut) **dan** `sigma close new` (mulai closure) — dua-duanya mengecek EXEC LOCKED terbaru | `sigma exec humanize` untuk pasangan PLAN+EXEC ini sudah jalan **dan** ter-push |

Alurnya persis seperti yang digambarkan audit: **source eligible → ratify/lock → humanize + push → transisi berikutnya butuh human projection.** Tidak ada siklus, karena command yang mem-produce RATIFIED/LOCKED (`ratify`/`lock`) dan command yang men-dependensi-kan human projection (`plan new`/`close new`) adalah dua command yang berbeda, dan yang kedua secara desain selalu terjadi setelah yang pertama — tidak pernah sebelum atau bersamaan.

Berbeda dari config bahasa (`document_language` dkk.) yang sifatnya longgar/preferensi: kalau `notion_humanize_gate.enabled = true`, requirement ini **wajib mekanis** — `sigma plan check`/`sigma close check` (dan kalau relevan `sigma plan new`/`sigma close new` langsung) melaporkan Not Eligible/berhenti kalau belum terpenuhi. Kalau `false`, gate ini tidak berlaku sama sekali — bukan soft-warning, benar-benar tidak dicek.

Cakupan wajibnya **tetap hanya di titik lock final** (`intent ratify`, `exec lock`) sebagai sumbernya — bukan tiap draft iterasi. Yang berubah cuma **di mana** kewajiban itu ditegakkan, bukan **kapan** sumbernya harus RATIFIED/LOCKED.

---

## 4. Fase Implementasi (usulan)

| Fase | Isi | Status |
| :--- | :--- | :--- |
| **1 — Skema & config** | Field `notion_humanize_gate.enabled` di `project.config.json`; prompt wajib di `project start`; command `notion enable/disable --director-confirm` | ✅ Selesai (`8703d34`, branch `feat/sigma-humanize-operation`) |
| **2 — Struktur artefak human** | Konvensi penamaan/lokasi file — `Sigma/human/` (dikunci, lihat §6 poin 2 dan `PLAN-IMPL-SIGMA-ARTIFACT-FOLDER-RENAME-20260816`, belum dieksekusi terpisah — command Fase 3 akan pakai `Sigma/human/` langsung); extension `chain.ts`/`progress-v<N>.json` untuk melacak state humanize — `HumanArtifactState` di `SingleIntentState`, `ArtifactVersion` (exec), `SingleCloseState`, `SCHEMA_VERSION` 1.1.0→1.2.0 | ✅ Selesai (`b29edee`) |
| **3 — Command `humanize`** | `sigma intent humanize`, `sigma exec humanize` (menggabungkan PLAN+EXEC), `sigma close humanize` — scaffold dari sumber RATIFIED/LOCKED, guard menolak jalan kalau sumber masih DRAFT; menghasilkan **dua file**: dokumen human (dipublikasikan) + `.fidelity.md` companion (Source Fidelity Ledger, lokal-only — CR-05, §2.3); output CLI otomatis mengonfirmasi pembacaan skill `/humanize` (§2.8); guard `--force` untuk mencegah timpa proyeksi yang sudah ada | ✅ Selesai (`7f5b888`, 10 test) |
| **4 — Push orchestration** | `pushAllHumanArtifacts()` (`engine/humanizePush.ts`) — collect → strip → scan terminologi → cek coverage → `syncArtifactToNotion`, wired ke `sigma notion push` sebelum dashboard/state/purge. `reconcileSupersededHumanArtifacts()` — scan **semua chain di disk** (bukan cuma aktif — `intent supersede --v` sering menarget chain non-aktif), arsipkan halaman Notion yang sumbernya SUPERSEDED. Turut memperbaiki bug: `collectHumanPushTargets` sebelumnya push ulang artefak SUPERSEDED yang masih punya `.human` — sekarang dikecualikan | ✅ Selesai (`6c6bf5a`) |
| **5 — Terminology registry & scanner** | `Sigma/rules/sigma_terminology.default.json` (bundled, disinkron `project sync`) + `Sigma/sigma_terminology.custom.json` (project-local, di luar `rules/`, diedit langsung oleh AI atas permintaan Director — §2.6); `scanForSigmaTerminology(content, terminology)` generik menerima daftar gabungan; wired ke jalur push human artifact sebelum `syncArtifactToNotion`; pesan gagal spesifik-per-istilah | ✅ Selesai (`c7813c8`) |
| **5b — `sigma scan --file`** | Command top-level mandiri (§2.10), read-only, pakai scanner yang sama dari Fase 5; guard pengecualian file artefak Sigma (pola nama file, sama seperti "Out Of Scope" skill `/humanize`) | ✅ Selesai (`c7813c8`) |
| **5a — Template instruction stripping** | `stripTemplateInstructions(content)` — hapus baris blockquote (`>`) sebelum tahap lain jalan (§2.7 tahap 0); wajib paling duluan di pipeline pre-push | ✅ Selesai (`c7813c8`) |
| **5c — Fidelity coverage checker (CR-02, mekanisme diperbaiki §7.4)** | `checkFidelityCoverage(sourceContent, humanContent, idPatterns): string[]` — dua mode, bukan satu. **Mode ID**: pola per tipe dokumen sumber — DIR-INTENT: `CON-*`/`RR-*`/`REQ-*`/`ASM-*`/`SC-*`/`OS-*`/`NG-*` + 4 dimensi Quality Bar bernama tetap; FMN-PLAN+DEV-EXEC: `TASK-*`/`AC-*`/`TC-*`/`OBS-*`/`REQ-*` (namespace `REQ-*` dari Minor Requests `DEV-EXEC` §17, disambiguasi dari file asalnya — beda arti dari `REQ-*` DIR-INTENT). **Mode rekonsiliasi baris** (baru — menutup celah `DIR-CLOSE` yang nol ID sama sekali di seluruh templatenya, dan sebagian `FMN-PLAN` Implementation Constraints): untuk tabel tanpa kolom ID, hitung baris di source, wajib jumlah sama di Ledger yang mereferensikan `<Nama Tabel> #<nomor>` (kolom Ledger sekarang `Source Reference`, bukan `Source ID`). **Tidak ada lagi tabel yang lolos tanpa dicek** — sebelumnya tabel tanpa ID cuma didokumentasikan sebagai batasan (`checkFidelityCoverage` diam soal itu, coverage box jadi vacuously true); sekarang keduanya (ID dan baris) benar-benar diverifikasi. Wired sebagai tahap ketiga sebelum push, setelah stripping (5a) dan scanner terminologi (§2.7) | ✅ Selesai (`9db1276`) |
| **6 — Gate enforcement (direvisi, CR-01)** | `sigma plan check`/`sigma plan new` (untuk intent) dan `sigma close check`/`sigma close new` **plus** `sigma plan new` iterasi berikut (untuk exec) diperluas: kalau `notion_humanize_gate.enabled`, requirement baru "Human version generated & pushed to Notion" untuk sumber RATIFIED/LOCKED yang relevan — **bukan** di `intent ratify`/`exec lock` itu sendiri (lihat §3.4). Otomatis terblokir kalau Fase 5/5c gagal-scan/gagal-coverage | ✅ Selesai (`cdc2cc1`, 10 test regresi CR-01) |
| **7 — Template & style rule** | 3 template (`DIR-INTENT-HUMAN`, `PLAN-EXEC-HUMAN`, `DIR-CLOSE-HUMAN`) + Fidelity Ledger, lewat dua putaran audit eksternal; gaya penulisan mengikuti skill `/humanize` (§2.8). Judul halaman Notion diganti human-friendly (`computeHumanNotionTitle()`, mis. `"{Project Name} — Project Brief (v1)"`) — celah nyata ditemukan saat implementasi: judul lama `"DIR-INTENT-HUMAN - v1"` bocor istilah Sigma karena judul halaman tidak pernah ikut discan | ✅ Selesai (`4669554`) |
| **8 — Test & dokumentasi** | Guard DRAFT-source ✅, gate block/unblock di `plan new`/`close new` ✅ (10 test CR-01), scanner terminologi + coverage checker ✅ (24 test), reconcile-on-push ✅ (9 test), judul Notion bebas-terminologi ✅ (2 test). `SIGMA_PROTOCOL.md` §16/§16A/§16B diperbarui + `SIGMA-OPERATION-REGISTRY.json`/`SIGMA-REGISTRY.json` dapat entri baru. **Celah diketahui, tidak disentuh**: domain `notion` sendiri (dari plan v2) tidak pernah terdaftar di operation registry — pra-existing, di luar cakupan plan ini. Non-retroaktif toggle tidak punya test khusus (cuma prinsip di §3.2) | ✅ Selesai (`8b641ef`) — 55 test baru total, 391 keseluruhan |
| **9 — Perluasan skill `/humanize` ke tool lain** | Disalin/diadaptasi ke `codex/` (`#humanize`), `reasonix/` (identik claude_code), `antigravity/` (`sigma-humanize`) — `cursor/` sengaja dilewati, `SIGMA.mdc` tidak membawa skill opsional lain (`/report` dkk. juga tidak ada di sana, konsisten). Terdaftar di `ROLE_FILES`, dideploy nyata lewat `sigma setup update` ke lingkungan asli (bukan cuma scratch) — dikonfirmasi harness sendiri langsung mendaftarkan `/humanize` sebagai skill tersedia | ✅ Selesai (`8c0ed7f`), izin eksplisit Director diberikan 2026-08-19 |

Urutan Fase 1–6 (mekanisme CLI, gate, config, reconcile, scanner) bisa dikerjakan sekarang; Fase 7 (template) sudah tidak menunggu apa-apa lagi secara struktural (daftar section terkunci di §2.4) — cuma menunggu detail redaksi/gaya final dari kolaborasi ChatGPT-AUD. Fase 9 sengaja ditahan terpisah dari Fase 1–8 — perluasan skill itu keputusan mandiri yang tidak menghalangi progres bagian lain plan ini.

---

## 5. Dependensi ke plan Notion v2 — TERSELESAIKAN

Plan Notion v2 **selesai diimplementasikan** (Fase 1–5, commit `65760f5` dan `a0cb556` di `feat/notion-integration-v2`). Primitif `syncArtifactToNotion`/`fetchArtifactFromNotion` sudah generik dan siap dipakai Fase 3/4/5 plan ini tanpa perubahan mesin sync.

---

## 7. Draf Template Human (Revisi 6) — siap dikirim ke ChatGPT-AUD untuk review

Empat file baru ditulis di `Sigma/templates/`, mengikuti konvensi penamaan bundled template yang sudah ada (`<TYPE>-TEMPLATE.md`). Ini draf pertama — belum final, disiapkan sebagai bahan diskusi Director dengan ChatGPT mode AUD, bukan hasil akhir.

Prinsip desain yang sama dipakai di keempatnya:

- Instruksi (blockquote `>`) boleh menyebut istilah Sigma bebas — itu panduan untuk AI yang mengisi template, tidak pernah ikut terbit. Konten aktual di area placeholder `[...]` harus nol istilah Sigma (§2.6), diperiksa mekanis oleh `scanForSigmaTerminology()` sebelum push. **`>` dicadangkan eksklusif untuk instruksi** — dihapus mekanis oleh `stripTemplateInstructions()` sebelum push (§2.7 tahap 0); konten yang benar-benar dipublikasikan tidak boleh pernah ditulis sebagai blockquote.
- Tiap section instruksinya menyebut eksplisit section sumber mana yang dipetakan, dan kelasnya (Preserve/Compress/Omit, §2.3).
- Ditulis mengikuti aturan gaya skill `/humanize` (§2.8) — passive voice, tanpa "X bukan Y", decision-first, tanpa parenthetical, dst.

### 7.1 `DIR-INTENT-HUMAN-TEMPLATE.md` — Draf v2, direvisi setelah audit eksternal

**Draf v1 dipetakan dari referensi yang salah** — instance proyek lama (`CanopySense/Sigma/design/DIR-INTENT-v1.md`, schema lawas) alih-alih sumber kanonis sebenarnya di repo ini (`Sigma/templates/DIR-INTENT-TEMPLATE.md`, schema=4, 14 section, bukan 12). Audit eksternal ChatGPT-AUD menemukan ini lewat gejalanya (Quality Bar dan tiering Sovereign/Operationalization hilang total), diverifikasi langsung ke source setelahnya — keduanya memang ada di kanonis dan bahkan lebih mengikat dari dugaan awal (Quality Bar adalah **hard ratify gate** di §13.1 template asli, bukan sekadar konten penting). Verdict audit: `REVISE`, tiga required revision (HR-01/02/03) — semua diterima dan diterapkan di draf v2 ini.

Section, memakai aturan cakupan §2.2 (Overview + Sovereign layer + diagram ROADMAP) yang sekarang diperjelas dengan **coverage rule eksplisit** (HR-01): setiap item material di source harus direpresentasikan, dilebur ke section yang relevan, atau dicatat Omit dengan alasan di Fidelity Ledger — tidak boleh diam:

| # | Section human | Dari mana | Kelas |
| :--- | :--- | :--- | :--- |
| 1 | Overview | §1.1–1.5 Intent Core, dipadatkan jadi narasi | Preserve |
| 2 | Goals | §3 Success Definition | Preserve |
| 2a | Goals → Minimum Acceptable Standard | §4 Quality Bar (HR-02) — dilebur sebagai sub-bagian Goals, bukan section baru; dimensi yang tidak dimasukkan wajib tercatat Omit di Ledger | Preserve per dimensi yang material |
| 3 | Scope | §6 Scope Boundary + constraint Non-negotiable dari §7 yang secara substansi jadi batas scope + Functional Requirement §9 bertier **Sovereign** yang materially mengubah janji proyek (HR-03) | Preserve |
| 4 | Priorities | §5 Strategic Trade-Offs | Preserve (sudah naratif by design) |
| 5 | Main Risk | §10.1, 10.2, 10.4 Risk & Failure Definition, + "Must Not Happen" dari Quality Bar §4 yang belum tercakup di atas | Preserve |
| 6 | Plan Overview | Diagram Stage Overview dari `ROADMAP-v<N>.md`, + komitmen material (bukan checklist proses) dari Execution Direction for FMN §11.1/11.4 (Finding 4) | Compress untuk roadmap; Preserve untuk komitmen material yang ditemukan |
| 7 | Independent Review Notes | §12 AUD Findings | Default Omit, naik jadi Preserve kalau verdict bukan PASS bersih |

**Dibuang secara default** (murni proses/mekanisme, tanpa komitmen material di dalamnya): §2 Comprehensive Research, §7 Constraints & Preferences yang non-scope-defining, §8 Technical & Architecture Direction, §9 Functional Requirements bertier **Operationalization**, §11.2/§11.3 (checklist FMN — bukan §11.1/§11.4, lihat baris 6 di atas), §13 Final Validation Checklist, §14 Amendment History.

**Temuan tambahan saat verifikasi ulang** (di luar cakupan template ini, dicatat untuk kesadaran Director): `FMN-PLAN-TEMPLATE.md` §1 Source Alignment tidak punya bullet eksplisit "Quality Bar preserved" walau `DIR-INTENT` §11.3 mewajibkan FMN-PLAN membawanya — kemungkinan celah di template kanonis itu sendiri, belum disentuh. Ini juga berarti `PLAN-EXEC-HUMAN-TEMPLATE.md` berpotensi punya masalah HR-02 yang sama begitu diaudit.

### 7.2 `PLAN-EXEC-HUMAN-TEMPLATE.md` — Draf v2, direvisi setelah audit dua-pass

**Draf v1 punya sitasi section yang salah di seluruh baris** — diverifikasi manual, dikonfirmasi: semua sitasi bergeser +1 terhadap `FMN-PLAN-TEMPLATE.md`/`DEV-EXEC-TEMPLATE.md` yang sebenarnya (persis pola kesalahan yang sama dengan `DIR-INTENT-HUMAN` draf v1 — bekerja dari peta section yang tidak diverifikasi ulang ke source terkini), plus satu sitasi (`FMN-PLAN §7 Dependency`) yang sama sekali tidak ada. Contoh `CON-007` yang dipakai berulang untuk menjustifikasi CR-02 juga ternyata tidak cocok struktur — tabel sumbernya (`Implementation Constraints`) tidak punya kolom ID sama sekali.

Dua defect logika juga ditemukan: "Verification & Status" mencampur dua vocabulary verdict (self-report DEV vs verdict independen FMN) tanpa aturan siapa menang kalau beda; "Observation Report" cuma mengambil temuannya, diam soal status resolusi tiap item — pelanggaran langsung terhadap HR-01 (§2.3) yang saya tulis sendiri dua revisi sebelumnya.

Audit pass kedua (perspektif pembaca, menguji dengan mengisi template pakai contoh fiktif dan membacanya sebagai pembaca dingin) menemukan masalah urutan: status (yang paling dicari pembaca) terkubur di posisi 6 dari 10; prasyarat kerja di posisi 2 memutus alur naratif tepat setelah Overview; empat section "masalah" berturutan tanpa sinyal mana yang material.

Semua diterima dan diperbaiki — pemetaan terkoreksi + restrukturisasi lengkap ada di §2.4 (direvisi). Section sekarang 7 heading (dari 10), beberapa dengan sub-bagian, tidak ada identitas section yang hilang — cuma digabung/dipindah posisi.

### 7.3 `DIR-CLOSE-HUMAN-TEMPLATE.md` — Draf v2, direvisi setelah audit

**Draf v1 punya tiga cacat struktural**, ditemukan audit eksternal, semua dikonfirmasi terhadap `DIR-CLOSE-TEMPLATE.md`:

1. **"What's Next" diam-diam membuang setengah sub-section sumbernya.** §8 New Intent Boundary di source punya 6 sub-bagian; instruksi draf v1 cuma menangkap 2. Yang hilang termasuk **"Do Not Carry Forward As Hidden Debt"** — sub-bagian yang secara spesifik dirancang mencegah pembaca salah mengira "sengaja di luar scope selamanya" sebagai "sekadar ditunda". Membuangnya menghidupkan lagi ambiguitas yang sub-bagian itu dibuat untuk menutup — kegagalan false-closure/false-completeness yang tepat.
2. **Template mengasumsikan closure diterima, padahal source tidak menjamin itu.** §1 Closure Decision di source punya 6 opsi, cuma 2 di antaranya benar-benar "diterima" (`CLOSE_ACCEPTED`/`CLOSE_ACCEPTED_WITH_LIMITATIONS`) — sisanya (`DO_NOT_CLOSE`, `OPEN_NEW_PLAN`, `UPDATE_CURRENT_EXEC`) itu non-closure. Gate humanize (§2.1) cuma mengecek status lock, bukan nilai Decision — jadi `sigma close humanize` bisa saja dijalankan terhadap `DIR-CLOSE` yang LOCKED tapi Decision-nya `DO_NOT_CLOSE`. Judul "Closing Summary" dan section "Closure Statement" draf v1 salah merepresentasikan kasus itu lewat strukturnya sendiri, bukan lewat kesalahan konten.
3. **Tidak ada penanda keputusan yang dipaksa eksplisit** — beda dari `PLAN-EXEC-HUMAN`'s Status (checkbox wajib), di sini Decision (6 opsi) + Closure Confidence (3 level) cuma dilebur ke prosa bebas di Overview, tanpa pagar struktural terhadap pelunakan.

Dipetakan ulang dari `DIR-CLOSE-TEMPLATE.md` (9 section + 3 appendix). Delapan section:

| # | Section human | Dari mana | Kelas |
| :--- | :--- | :--- | :--- |
| 0 | **Badge keputusan** (baris tunggal di bawah judul) | §1 Closure Decision, dipetakan ke istilah manusia: `CLOSE_ACCEPTED`→"Closed", `CLOSE_ACCEPTED_WITH_LIMITATIONS`→"Closed with limitations", `DO_NOT_CLOSE`→"Not closed", `OPEN_NEW_PLAN`/`UPDATE_CURRENT_EXEC`→"Not closed — [alasan singkat]" | **Preserve, dipaksa eksplisit** — pola sama dengan badge Status di `PLAN-EXEC-HUMAN` §2.4, menutup Finding 3 |
| 1 | Overview | §1 One-Paragraph Closure Statement + inti §2 (mulai/berakhir). **Wajib pakai vocabulary yang sama dengan badge** — tidak boleh berbeda cerita | Preserve |
| 2 | Project Story | §2 Human Project Story, seluruhnya | Preserve (sudah naratif by design, minim rephrase) |
| 3 | What Was Delivered | §3 Delivered State (primary value, capability map, outcome utama) | Preserve untuk outcome; Compress untuk capability map |
| 4 | Did It Meet the Goal | §4, drop tabel ID-heavy, pertahankan Plain-Language Satisfaction Statement | Preserve statement, Compress tabel jadi prosa |
| 5 | Known Limitations | §6 Known Limitations and Accepted Risks | Preserve — risk-relevant |
| 6 | What's Next — dipecah dua bagian eksplisit (menutup Finding 1) | **"Coming Later"**: §8 Not Delivered/Deferred + Work That Must Move To A New Intent + Why This Is New Intent Work. **"Deliberately Out of Scope"**: §8 Explicit Non-Scope Preserved + Do Not Carry Forward As Hidden Debt — pembaca harus bisa bedakan "akan datang" dari "sengaja tidak pernah", bukan digabung jadi satu daftar ambigu | Preserve, kedua bagian |
| 7 | Closure Statement | §9 Final Director Decision — Reason + Closure Sentence. **Kalau badge di atas bukan "Closed"/"Closed with limitations"**, section ini reframe jadi status/next-step statement, bukan pura-pura closure terjadi | Preserve — suara Director sendiri, tidak boleh dilunakkan |

**Dibuang total**: §5 Evidence Map (audit/artifact-trail, prosedural), Appendix A/B/C (audit trail murni). §7 Operational Handoff dibuang default **dengan pengecekan eksplisit** (menutup Finding 4 — draf v1 cuma mencatat pengecualian di plan tapi templatenya sendiri tidak pernah menyuruh AI mengecek): instruksi template sekarang secara eksplisit meminta AI membaca Security/Access Notes sebelum membuang seluruh §7, bukan cuma catatan di dokumen plan yang tidak pernah dieksekusi.

### 7.4 `HUMAN-FIDELITY-LEDGER-TEMPLATE.md` — Draf v2, mekanisme coverage diperbaiki (bukan cuma templatenya)

**Cacat yang ditemukan lebih dalam dari sekadar template**: audit memverifikasi seluruh tabel di `DIR-CLOSE-TEMPLATE.md` (Delivered Capability Map, Intent Satisfaction, Known Limitations, Deviations, Evidence Map, ketiga Appendix) — **tidak satu pun punya kolom ID**. `checkFidelityCoverage()` seperti dispesifikasikan sebelumnya (parse ID `CON-*`/dst.) tidak akan menemukan apa pun untuk tipe dokumen ini — coverage check jadi *vacuously true*: nol ID diwajibkan, nol ID ada, kotak tercentang, padahal tidak ada yang benar-benar diverifikasi. Itu lebih berbahaya dari tidak ada mekanisme sama sekali, karena terlihat seperti sudah diaudit padahal tidak. Masalah sama juga sebagian berlaku untuk `PLAN-EXEC-HUMAN` (`Implementation Constraints` tanpa ID, §2.4 baris 5).

**Perbaikan mekanisme** (bukan cuma dokumentasi batasan seperti revisi sebelumnya — sekarang benar-benar menutup celahnya):

- Kolom Ledger `Source ID` diganti **`Source Reference`**, menerima dua bentuk: ID formal (`CON-007`) **atau** fallback `<Nama Tabel> #<nomor baris>` (mis. `Known Limitations #2`) untuk tabel tanpa ID.
- `checkFidelityCoverage()` dapat mode kedua untuk tabel tanpa ID: **rekonsiliasi jumlah baris** — hitung baris di tiap tabel bernama di source, wajib ada jumlah entri yang sama di Ledger yang mereferensikan nama tabel itu (via fallback reference di atas). Ini tetap deterministik (menghitung baris itu mekanis) walau tidak bisa memverifikasi baris mana cocok dengan kutipan mana secara otomatis — kombinasi dengan kewajiban kutipan verbatim tetap memberi reviewer manusia sesuatu nyata untuk dicek silang.
- **Tidak ada lagi tabel yang "tidak tercakup dalam diam".** Tiap tabel bersumber, ber-ID atau tidak, sekarang punya jalur coverage yang jelas — kalau memang jumlah baris source dan Ledger tidak cocok, gagal terdeteksi, sama seperti ID yang hilang.

Satu struktur companion dipakai ketiga tipe (CR-02/CR-05, §2.3) — bentuknya tetap sama (referensi source, klasifikasi, kutipan verbatim/catatan/alasan), cuma kolom kuncinya sekarang menerima ID maupun fallback baris. File dihasilkan berpasangan dengan tiap dokumen human (`<TYPE>-HUMAN-v<N>.fidelity.md`), tidak pernah ikut terbit ke Notion.

---

## 6. Pertanyaan Terbuka / Menunggu Input

0. ~~CR-01 s.d. CR-05 (audit ChatGPT-AUD, §0.3)~~ — **ditutup di Revisi 6** (§2.1, §2.3, §2.5, §2.7, §2.8, §3.4, §4). Director memutuskan tidak perlu re-audit formal lagi terhadap mekanisme plan.
1. **Redaksi & gaya final template** — daftar section terkunci untuk `PLAN-EXEC-HUMAN` (§2.4) dan sekarang juga `DIR-INTENT-HUMAN`/`DIR-CLOSE-HUMAN` (§7). **Draf pertama tiga template + Fidelity Ledger sudah ditulis** (§7) — disiapkan untuk dikirim Director ke ChatGPT mode AUD untuk direview. Redaksi/gaya finalnya menunggu hasil review itu.
1b. ~~Daftar section `DIR-CLOSE-HUMAN`~~ — **terjawab**, lihat §7.3 (7 section, dipetakan dari `DIR-CLOSE-TEMPLATE.md` dengan metodologi §2.3 yang sama).
1c. **Siapa yang menjalankan `sigma close humanize`** — diusulkan ARC atau Director langsung di §2.1, belum dikunci final.
2. ~~Lokasi penyimpanan file human~~ — **terjawab**, `Sigma/human/`, folder terpisah di root (bukan nested di dalam folder tiap artefak). Dikunci bersamaan dengan `PLAN-IMPL-SIGMA-ARTIFACT-FOLDER-RENAME-20260816`, yang juga mengganti `Sigma/design/` → `Sigma/charter/` dan memecah `Sigma/build/` jadi `Sigma/contract/` (PLAN), `Sigma/roadmap/`, `Sigma/evidence/` (EXEC).
3. ~~Daftar istilah terlarang §2.6~~ — **mekanismenya terjawab**: dua file (`sigma_terminology.default.json` bundled + `.custom.json` project-local, diedit langsung oleh AI atas permintaan). Isi persis daftar default masih bisa diperluas begitu template konkret mulai ditulis — itu tinggal edit data, bukan lagi keputusan arsitektur terbuka.
4. ~~Isi `PLAN-EXEC-HUMAN`~~ — **terjawab**, lihat §2.4 (10 section, dipetakan dari sumber dengan metodologi §2.3).
5. ~~Siapa yang menjalankan humanize~~ — **terjawab**, lihat §2.1 (ARC untuk intent, FMN biasanya untuk exec/plan gabungan, DEV boleh juga, tidak dikunci teknis).
6. ~~Nama field config~~ — **terjawab**, `notion_humanize_gate.enabled`, lihat §3.
7. ~~Risiko pergeseran makna~~ — **punya mekanisme konkret**, lihat §2.3 (invariant + tiga kelas + checklist fidelity di template).
8. ~~Terminologi Sigma di human artifact~~ — **terjawab**, lihat §2.6 (larangan + daftar istilah) dan §2.7 (auto-scan wajib saat push, gerbang mekanis ke Lock Requirement).
