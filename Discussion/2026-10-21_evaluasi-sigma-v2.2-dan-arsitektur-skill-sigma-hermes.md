# Evaluasi Sistem Sigma v2.2.0 & Arsitektur Integrasi Hermes (Zero-Core-Mutation)

**Tanggal:** 2026-10-21
**Konteks:** Diskusi informal evaluasi ekosistem Sigma v2.2.0 dibanding pola *prompting* umum, manajemen *trade-off* operasional Director, analisis divergensi branch `origin/hermes-integration`, dan perumusan arsitektur baru integrasi Hermes berbasis *additive context skill* (`sigma-hermes`).
**Status:** Catatan diskusi & pertimbangan desain (*non-normative discussion record*).

---

## 1. Bedah Arsitektur Sigma v2.2.0 vs. Workflow AI Umum

Mayoritas pengguna AI mengandalkan *conversational/vibe prompting*, *single-file rules* (`.cursorrules` / `CLAUDE.md` tunggal untuk semua tahap), atau *autonomous agent swarms* tanpa batas otoritas formal. Sigma mengambil pendekatan berbeda: **Constitutional Cognitive Operating System** dengan tiga lapis pertahanan:

1. **Lapisan Normatif (`SIGMA_CONSTITUTION.md` & `<ROLE>-RULE.md`):** Hierarki otoritas mutlak (`CONSTITUTION → INTENT → PROTOCOL → RULES → PLAN`).
2. **Lapisan Operasional (4 Peran Imutabel per Sesi):** Pemisahan kekuasaan antara `ARC` (mandat strategis), `FMN` (kontrak rencana & tes), `DEV` (implementasi terisolasi), dan `AUD` (auditor eksternal pasif).
3. **Lapisan Deterministik (Sigma CLI & MCP):** Penegakan *gates*, *state machine*, *hash-binding*, dan proteksi file (`progress-v<N>.json`) secara terprogram.

### 1.1 Keunggulan Utama Sigma

* **Imunitas terhadap *Self-Grading Bias* & *Sycophancy*:**
  * Pemisahan peran per sesi mencegah satu sesi AI membuat rencana, menulis kode, lalu melonggarkan kriteria kelulusannya sendiri.
  * Desain `AUD` sebagai *passive external auditor* (*"audits what is submitted, not what it can discover"*) mencegah bias konfirmasi akibat membaca kode sumber yang sudah terlanjur ditulis.
* **Pemisahan *Transient Cognition* vs. *Persistent Authority*:**
  * Obrolan sesi bersifat sementara dan tidak memiliki otoritas hukum. Kebenaran proyek dipegang oleh artefak yang diratifikasi/disetujui dan *runtime state* CLI, didukung *artifact-bound messaging* (`sigma send --related-artifact`) dan memori lintas-sesi (`sigma memo`).
* **Ketahanan Lintas-Vendor (*Vendor & Tool Agnosticism*):**
  * Karena kebenaran operasional berada di CLI dan MCP (`sigma-mcp`, `sigma-control`), berbagai vendor model/IDE (Claude, Gemini, OpenCode, Codex, DeepSeek) dapat bergantian mengoperasikan proyek yang sama tanpa kehilangan konteks.
* **Perlindungan terhadap *Premature Implementation* & *Scope Creep*:**
  * `INTENT` Schema 6 mengunci mandat strategis atas produk akhir (*final product*), bukan daftar fitur teknis. Perubahan pasca-ratifikasi terklasifikasi jelas ke **T1** (taktis di level `ROADMAP`/`PLAN`), **T2** (amandemen `INTENT` via Git/Snapshot baseline), dan **T3** (mandat baru).
* **Sabuk Pengaman Otoritas Manusia (*Human-in-the-Loop Enforcement*):**
  * Bahasa ambigu (*"okay"*, *"noted"*, *"makes sense"*) tidak sah untuk perintah berisiko; eksekusi mutasi otoritas membutuhkan konfirmasi eksplisit Director (`--director-confirm` / permukaan lokal `sigma control`).

---

## 2. Kekurangan, *Trade-Off*, dan Mitigasi Operasional Director

| Tantangan / Kekurangan | Realitas di Lapangan | Mitigasi & Solusi di Ekosistem Sigma |
| :--- | :--- | :--- |
| **1. *Ceremonial Overhead* pada Tugas Kecil** | Siklus penuh (`INTENT → ROADMAP → PLAN → EXEC → PRODUCT REVIEW → CLOSE`) terlalu berat untuk tugas sederhana, eksplorasi awal, atau *bugfix* kecil. | **Default / Professional Mode (Flexible Mode):** Jangan mengaktifkan *role* Sigma apa pun (`/arc`, `/fmn`, `/dev`, `/aud`). Sistem otomatis berjalan di luar birokrasi artefak Sigma, namun tetap memegang prinsip dasar *Plan → Explicit Approval → Build*. |
| **2. Beban Operasional Manual & Keraguan Triase Director** | Director bertindak sebagai router manusia antar-sesi dan terkadang ragu apakah suatu pekerjaan memerlukan kedalaman pembuktian Sigma atau cukup *Professional Mode*. | **Jangka Pendek:** Gunakan matriks triase 3 pertanyaan (Kebutuhan Konteks Lintas-Sesi, *Blast Radius*, dan Perubahan Invarian Inti).<br>**Jangka Menengah:** Delegasi orkestrasi mekanis ke **Hermes**. |
| **3. Ketergantungan pada Kualitas & Disiplin Model** | Sigma tidak cocok dijalankan pada model kelas ringan/*free-tier* (seperti Flash, Haiku, atau model kecil lainnya) karena tingginya risiko *instruction-following decay*. | Gunakan model dengan tingkat **kedisiplinan prosedural tinggi dan daya kritis kuat** (tidak harus yang paling mahal/jenius, karena kualitas akhir didongkrak oleh mekanisme verifikasi dan audit silang lintas-*role*). |

### Matriks Triase Cepat Director (Sigma Mode vs. Professional Mode)
Sebelum memulai pekerjaan, tanyakan 3 hal:
1. Apakah pekerjaan ini memakan >1–2 sesi obrolan dan butuh jejak keputusan jangka panjang?
2. Jika AI mengambil jalan pintas tersembunyi, apakah biaya perbaikannya nanti sangat mahal (*high blast radius*)?
3. Apakah pekerjaan ini mengubah perilaku inti (*core contract/invariant*) dari produk?

* **Semua TIDAK** → Gunakan **Professional Mode** tanpa ragu.
* **Minimal satu YA** → Aktifkan **Sigma Mode** (biaya waktu pembuktian adalah premi asuransi yang sepadan).

---

## 3. Mengapa Sigma v2.2.0 Menutup Celah Fundamental Versi Sebelumnya

Penundaan integrasi Hermes selama evaluasi Sigma v2.1 dan v2.2 justru menguntungkan karena fondasi Sigma kini telah menyelesaikan masalah-masalah struktural yang dulunya sering memicu friksi:

1. **Resolusi Deadlock `PLAN` (`paired_approval` & `plan revise`):**
   * Dulu (`legacy_lock`), `PLAN` yang sudah di-*lock* namun butuh penyesuaian teknis di tengah implementasi mengharuskan pembuatan `PLAN` baru dan *supersede* rencana lama.
   * Kini di `paired_approval`, `PLAN` berstatus `APPROVED` selama fase kerja dan baru `LOCKED` berpasangan dengan `EXEC` saat selesai. Revisi kontrak di tengah jalan ditangani secara terkendali melalui `CONTRACT_CHANGE_REQUEST` (`DEV` → `FMN`), `sigma plan revise`, dan `sigma exec acknowledge-plan`.
2. **Resolusi Kekakuan `INTENT` (Schema 6 & Klasifikasi T1/T2/T3):**
   * `INTENT` dibersihkan dari daftar fitur/teknologi sehingga perubahan metode implementasi di tengah jalan (T1) tidak lagi memaksa amandemen `INTENT`.
3. **Resolusi *Git Noise* & Portabilitas Mesin (`gitignore_sigma` & `.sigma-identity.json`):**
   * Secara default (`git.gitignore_sigma: true`), seluruh file operasional `/Sigma/`, *bridge files*, dan konfigurasi MCP diabaikan oleh Git sehingga riwayat *commit* produk tetap bersih.
   * Hanya `.sigma-identity.json` (beserta `origin_machine`) yang dilacak Git, dilengkapi guardrail `[SIGMA BLOCKED — MISSING LOCAL SIGMA FILES]` untuk mencegah divergensi *state* antar-mesin dan mendukung *Snapshot Mode* untuk amandemen `INTENT`.
4. **Stabilitas *Hash* Lintas-Platform:**
   * Normalisasi CRLF/LF pada perhitungan SHA-256 dokumen memastikan tiket persetujuan dan *source review* tidak rusak akibat perbedaan sistem operasi.

---

## 4. Status Branch `origin/hermes-integration` Saat Ini

Berdasarkan pemeriksaan riwayat Git terhadap `main` (v2.2.0):
* **Infrastruktur MCP Sudah Berada di `main`:** Pekerjaan fondasi dari branch Hermes (Phase 0, Gate 0.5, hingga server `sigma-mcp` dan `sigma-control` dengan 92 operasi, *capability manifest*, serta tiket revisi) **sudah masuk dan jauh lebih matang di branch `main`**.
* **Branch `origin/hermes-integration` Sudah Usang (Tertinggal 48 Commit):**
  * Masih mengasumsikan nama artefak ber-prefix (`DIR-INTENT-`, `FMN-PLAN-`, `DEV-EXEC-`).
  * Masih mengacu pada perintah dan layanan yang sudah dihapus di v2.2 (`plan lock`, `exec lock`, `intent score`, `humanizeService`).
  * Rencana Phase 2 (Docker + `git worktree` baru) dan Phase 3 (skema mailbox `CLAIMED`) di branch lama berpotensi bentrok dengan aturan baru `gitignore_sigma` (guardrail `.sigma-identity.json`), isolasi `dev/` workspace (F13), serta struktur mailbox per-INTENT (F03).
* **Rekomendasi Git:** Jangan melakukan `git merge` atau `git rebase` langsung dari `origin/hermes-integration` ke `main`. Saat pengerjaan Hermes dimulai kembali, buat branch baru dari `main` terkini dan ekstrak hanya dokumen diskusi/referensi desain yang masih relevan (seperti pemetaan *model-routing* dan *remote approval channel*).

---

## 5. Prinsip Arsitektur Baru Integrasi Hermes: *Zero-Core-Mutation* & Skill `sigma-hermes`

Untuk memastikan pengerjaan Hermes **tidak mengganggu kestabilan Sigma v2.2.0** dan dapat dikerjakan kapan saja tanpa menyentuh mesin inti Sigma, disepakati prinsip desain berikut:

### 5.1 Prinsip Dasar: Hermes Menyesuaikan Diri ke Sigma
* **Tidak ada perubahan kode atau aturan pada sistem inti Sigma.** Sigma diperlakukan sebagai *black-box governance runtime* yang sudah final.
* Hermes beroperasi murni sebagai **klien eksternal / *orchestrator*** di atas antarmuka CLI `sigma`, `sigma-mcp`, dan `sigma-control` yang sudah ada di v2.2.0.
* Bahkan kelima *bridge files* (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `REASONIX.md`, `DEEPSEEK.md`) dan keempat file aturan (`<ROLE>-RULE.md`) **tidak perlu diedit**.

### 5.2 Konsep Skill Baru: `sigma-hermes` (*Interlocutor / Channel Context Skill*)
Sebagai ganti mengedit *rules* atau *bridge files*, integrasi dilakukan secara aditif dengan menambahkan satu *skill* khusus bernama **`sigma-hermes`**.

Saat Hermes memanggil sebuah sesi AI Role (misalnya mengaktifkan `/fmn` atau `/dev`), Hermes juga mengaktifkan skill **`sigma-hermes`** sebagai penanda konteks percakapan:

```text
[Sesi AI Role] = [Role Skill: sigma-arc | sigma-fmn | sigma-dev | sigma-aud]
               + [Context Skill: sigma-hermes]
```

#### Isi dan Fungsi Utama di Dalam `sigma-hermes/SKILL.md`:
1. **Pengenalan Lawan Bicara (*Interlocutor Identity*):**
   * Memberi tahu AI Role yang sedang aktif bahwa lawan bicara langsung di sesi ini adalah **Hermes** (sistem orkestrator/kurir delegasi), **bukan Director secara langsung**.
   * AI Role menyapa lawan bicaranya dengan sebutan **"Hermes"** (atau nama panggilan yang ditentukan), bukan "Director".
2. **Peran & Fungsi Hermes:**
   * Menjelaskan bahwa Hermes bertugas menjalankan orkestrasi sesi, meneruskan pesan/instruksi operasional, mengumpulkan laporan status, dan mengantarkan draf atau *approval prompt* antara AI Role dan Director.
3. **Imutabilitas Perilaku Role (*Zero Behavioral Drift*):**
   * AI Role **tidak mengubah sifat, kewajiban verifikasi, cara kerja CLI/MCP, maupun batas wewenangnya sedikit pun**. Semua prosedur di `<ROLE>-RULE.md` tetap berlaku 100%.
   * Saat suatu langkah membutuhkan keputusan atau persetujuan Director (seperti menyerahkan blok *Approval Prompt* atau melaporkan *Gate Block*), AI Role menyampaikannya kepada Hermes untuk diteruskan kepada Director (contoh: *"Hermes, pemeriksaan `sigma plan check` telah Eligible. Silakan teruskan blok persetujuan berikut kepada Director..."*).
4. **Batas Otoritas (*Messenger != Constitutional Executive*):**
   * Menegaskan kembali doktrin Sigma bahwa **otoritas tertinggi tetap berada di tangan Director**.
   * Hermes memiliki wewenang untuk meminta operasi *read-only*, orientasi, dan pembuatan draf sesuai batas Role aktif, namun tidak menggantikan otoritas Director untuk perintah penguncian/persetujuan (`ratify`, `approve`, `loosening`, `override`, `supersede`), yang tetap wajib melalui mekanisme otorisasi Director yang sah di Sigma v2.2.

### 5.3 Keuntungan Arsitektur `sigma-hermes` Skill
* **Zero Token Overhead saat Operasi Manual:** Ketika Director bekerja langsung tanpa Hermes, skill `sigma-hermes` tidak diaktifkan sehingga konteks AI tetap ringkas dan murni.
* **Zero Sync Friction:** Tidak mengubah hash aset proyek (`Sigma/rules/` atau *bridge files*), sehingga tidak memaksa `sigma project sync` pada proyek-proyek yang sudah berjalan.
* **Modular & Pluggable:** Director dapat berpindah-pindah antara mode langsung (berbicara sendiri dengan AI Role) dan mode terdelegasi (melalui Hermes) pada proyek yang sama kapan saja tanpa konflik *state*.
