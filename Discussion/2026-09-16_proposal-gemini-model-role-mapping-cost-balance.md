# Baseline & Pemetaan Model Gemini untuk Hermes dan AI Roles Sigma (Balance Performance–Cost)

- **Tanggal:** 2026-09-16 (Diperbarui pasca-review Director & Antigravity)
- **Status:** Baseline draft disetujui Director; acuan konfigurasi routing model Gemini untuk Hermes dan AI Roles Sigma (ARC/FMN/DEV/AUD).
- **Tujuan:** Menetapkan kecenderungan model Gemini per role Sigma dan sub-scope kerjanya yang *right-sized* — memanfaatkan keunggulan faktual (Flash = agentic coding & kecepatan, Pro = reasoning, 2M context, & Search grounding) secara hemat tanpa over-tier/over-effort, dan tetap menyediakan jalur eskalasi yang andal.
- **Konteks:** Melengkapi portofolio pemetaan provider Sigma (OpenAI, Anthropic, DeepSeek, OpenCode Zen).
- **Bahasa:** Indonesia (istilah teknis/command tetap English).

---

## 1. Lini Gemini aktif (snapshot September 2026)

Sumber: halaman pricing resmi `ai.google.dev` + dokumentasi Antigravity CLI (snapshot 2026-09). **Lanskap berubah cepat — verifikasi ulang terhadap dashboard API sebelum deployment produksi.**

| Model | Harga (per 1M token) | Karakteristik & Kekuatan Nyata | Batas / Caveat |
|---|---|---|---|
| **Gemini 3.1 Pro** | $2 / $12 (≤200K context)<br>$4 / $18 (>200K context) | Flagship reasoning, GPQA 94.3, sintesis dokumen kompleks, **konteks 2M token** | Biaya input/output naik 2× lipat jika >200K; butuh disiplin context envelope |
| **Gemini 3.7/3.8 Flash** | $0.375 / $1.875 (promo s/d 31 Des 2026, lalu $0.75 / $3.75) | **Agentic coding leader** — 289 tok/s, latensi rendah, unggul di Terminal-Bench & tool-use loops | Bukan pengganti reasoning mendalam untuk restrukturisasi arsitektur D3 |
| **Gemini 3.x Flash-Lite** | $0.15 / $1.25 | Sangat hemat, throughput tinggi untuk tugas mekanis/volume besar | Di luar mandat keputusan substantif governance/kode |

Fakta struktural & runtime:

1. **Flash memimpin eksekusi agentic loop:** Kecepatan token (289 tok/s) dan optimasi tool calling membuat Flash sangat efektif untuk loop iteratif coding, tetapi tugas arsitektural kompleks tetap membutuhkan kedalaman penalaran Pro.
2. **Version pinning wajib:** Lini Flash beriterasi cepat (3.5 → 3.6 → 3.7 → 3.8). Kunci versi eksplisit (baseline: `gemini-3.8-flash`), jangan gunakan alias mengambang (`gemini-flash`).
3. **Antigravity CLI (`agy`) & Native Search Grounding:** CLI resmi Antigravity berjalan default pada Flash-tier dengan kemampuan native **Google Search grounding**, yang menjadi pembeda utama dibanding model offline murni.

---

## 2. Struktur biaya per role (konsisten lintas-provider)

Biaya = harga token × volume interaksi × effort reasoning. Volume antar-role tidak simetris:

| Role | Volume Kerja | Beban Token Dominan | Implikasi Biaya |
|---|---|---|---|
| **DEV** | Tinggi, kontinu | Input besar (codebase) + output kode | **Mendominasi total spend** — efisiensi terbesar ada di sini |
| **FMN** | Menengah | Output dokumen rencana terstruktur | Sedang |
| **ARC** | Rendah (fase awal & closure) | Reasoning abstrak + riset intent | Murah secara absolut |
| **AUD** | Rendah + input terisolasi | Reasoning verifikasi tinggi, volume kecil | Murah by design |

Prinsip: ARC dan AUD dapat memanfaatkan model flagship (Pro) karena frekuensi panggilannya kecil; sedangkan DEV wajib memaksimalkan Flash untuk efisiensi volume, dengan Pro sebagai fallback eskalasi terukur.

---

## 3. Hermes menurut lingkungan kerja

Sebelum masuk ke peran AI spesialis Sigma, berikut aturan penggunaan model saat Hermes berjalan di environment Gemini:

| Lingkungan | Model Gemini | Effort | Cakupan Tugas & Batasan |
|---|---|---|---|
| **Hermes Global** | **Flash-Lite** / **Flash** | `low` – `medium` | Q&A umum, observasi OS/perangkat, pembacaan log, formatting, administrasi non-destruktif. |
| **Project Non-Sigma** | **Flash** | `medium` – `high` | Task coding mandiri ringan/menengah. Eskalasi ke Pro jika terjadi kebuntuan logika 2 kali berturut-turut. |
| **Project Terdaftar Sigma** | *(Sesuai Role)* | *(Sesuai Role)* | Hermes bertindak murni sebagai **orkestrator/dispatcher**; tidak mengeksekusi sendiri dan merutekan tugas ke mandat ARC/FMN/DEV/AUD sesuai matriks di bawah. |

---

## 4. Sub-scope kerja AI Roles Sigma

Sesuai taksonomi governance Sigma ([OpenAI §4](2026-09-16_proposal-openai-model-role-mapping-cost-balance.md#L60-L66)):
- **ARC (4 sub-scope):** (1) Interview & draft `DIR-INTENT`; (2) Research mode (comprehensive research); (3) Revisi intent pasca-audit; (4) Closure scoring.
- **AUD (2 mode):** (1) Critic / Auditor mode (konsistensi & logika); (2) Verificator mode (validasi kebenaran sumber primer).
- **FMN (3 sub-scope):** (1) Menyusun `FMN-PLAN`; (2) Revisi plan pasca-audit; (3) Review pre/post-build `DEV-EXEC`.
- **DEV (4 sub-scope):** (1) Draft rencana implementasi; (2) Eksekusi; (3) Fix bug/gap; (4) Testing/verifikasi.

---

## 5. Distribusi model per sub-scope (Matriks Rekomendasi)

### ARC — model bervariasi per fase
| Sub-scope | Model | Effort / Mode | Rasional |
|---|---|---|---|
| 1. Interview + draft `DIR-INTENT` | **Gemini 3.1 Pro** | `high` | Menangkap nuansa sovereign vs challengeable, koherensi constraint tingkat tinggi. |
| 2. Research mode (Comprehensive) | **Gemini 3.1 Pro + Search grounding** | `high` (max thinking) | Sintesis multi-sumber eksternal dengan grounding live search Google (kebutuhan Source Tier ARC-RULE). |
| 3. Revisi intent pasca-audit | **Gemini 3.8 Flash** | `medium` | Penyesuaian terarah atas temuan audit konkret. |
| 4. Closure scoring | **Gemini 3.8 Flash** | `medium` (default) / `high` | Verifikasi kepatuhan rubrik; naik ke `high` bila ada deviasi material atau risiko gating tinggi. |

### AUD — model adaptif terhadap kelas risiko
| Sub-scope | Model | Effort / Mode | Rasional |
|---|---|---|---|
| 1. Auditor (Critic) mode | **Gemini 3.8 Flash** (D1/D2)<br>**Gemini 3.1 Pro** (D3) | `high` | Meninjau konsistensi & celah logis. Tingkat model mengikuti kelas DEV yang direview agar critic tidak lebih lemah dari implementor pada kasus berisiko tinggi. |
| 2. Verificator mode | **Gemini 3.1 Pro + Search grounding** | `high` (max thinking) | Memverifikasi kebenaran klaim teknis, URL rujukan, CVE, dan dokumentasi primer. Edge unik Gemini. |

### FMN — workhorse terstruktur
| Sub-scope | Model | Effort | Rasional |
|---|---|---|---|
| 1. Draft `FMN-PLAN` | **Gemini 3.8 Flash** | `medium` | Menerjemahkan intent terkunci menjadi workstream; hemat dan patuh skema. |
| 2. Revisi plan pasca-audit | **Gemini 3.8 Flash** | `medium` | Perbaikan terarah berdasarkan finding auditor. |
| 3. Review `DEV-EXEC` | **Gemini 3.8 Flash** | `medium` | Pengecekan konsistensi kontrak sebelum dan sesudah eksekusi. |

### DEV — Flash sebagai default, Pro sebagai jalur eskalasi terukur
| Sub-scope | Model (Kelas D) | Effort | Rasional & Kebijakan Eskalasi |
|---|---|---|---|
| 1. Draft rencana implementasi | **Flash** (D1/D2)<br>**Flash** (D3 default) / **Pro** (D3 hybrid) | `medium` (D1)<br>`high` (D2/D3) | D1/D2 cukup Flash. Pada D3 dengan arsitektur multi-modul kompleks, Pro dapat dipakai untuk drafting rencana (pola hybrid). |
| 2. Eksekusi kode | **Gemini 3.8 Flash** | `high` | Memanfaatkan kecepatan 289 tok/s dan keunggulan agentic tool-use. |
| 3. Fix bug & gap | **Flash** (default) → **Eskalasi ke Pro** | `medium` (trivial)<br>`high` (debug) | Default di Flash. **Trigger Eskalasi:** Jika 2 upaya perbaikan substantif gagal memenuhi test contract, eskalasi sesi ke **Pro `high`**. |
| 4. Testing & verifikasi | **Gemini 3.8 Flash** | `medium` | Eksekusi test suite, analisis keluaran error, dan pencatatan evidence. |

*Klasifikasi D1–D4 mengacu pada `2026-09-15_proposal-hermes-specialist-session-lifecycle-and-memo-policy.md` §9.*

---

## 6. Sebaran ringkas (Role vs Model Tier)

| Model Tier | Memikul Tanggung Jawab Utama | Porsi Volume |
|---|---|---|
| **Gemini 3.8 Flash** | Seluruh FMN, ARC revisi/scoring, AUD critic (D1/D2), seluruh DEV D1/D2, eksekusi awal DEV D3 | **~85% volume token** (workhorse utama) |
| **Gemini 3.1 Pro** | ARC interview, ARC research mode, AUD verificator, AUD critic (D3), eskalasi DEV D3 | **~15% volume token** (puncak penalaran & grounding) |
| **Flash-Lite** | Sub-tugas mekanis (formatting dokumen, render template, transkripsi mentah) | Task pendukung non-governance |

---

## 7. Keunggulan teknis Gemini untuk Sigma & Pedoman Penggunaan

1. **Google Search Grounding (Edge Utama AUD & ARC):**
   - Bukan sekadar browsing web generik; grounding Gemini langsung mengaitkan klaim dengan indeks Google.
   - **Aturan Bukti Sigma (Evidence Rule):** Hasil grounding wajib mencantumkan URL primer terverifikasi dan dimasukkan ke dalam lampiran evidence (`AUD-REPORT` atau `DIR-INTENT`). Dilarang menerima klaim tanpa rujukan domain resmi.
2. **Konteks 2M Token di Pro:**
   - Sangat berguna saat ARC menyerap seluruh riwayat proyek, backlog, dan dokumentasi arsitektur dalam satu turn.
   - **Caveat Disiplin Biaya:** Melewati batas 200K token melipatgandakan tarif per-token ($2 → $4 input). Konsep *task envelope* dan *prompt caching* tetap wajib ditegakkan; jangan memasukkan codebase utuh secara serampangan.
3. **Throughput Eksekusi Agentic Flash:**
   - Latensi per turn yang sangat rendah memungkinkan loop *edit-compile-test* DEV berjalan cepat tanpa menguras kesabaran operator atau menghabiskan batas timeout proses.

---

## 8. Strategi akses ARC $0 cost: Google AI Studio vs Gemini Web Chat

Karena peran ARC dirancang beroperasi dengan frekuensi dan volume rendah (hanya pada perumusan `DIR-INTENT`, riset mendalam, dan closure scoring), Director memutuskan **tidak menambah langganan berbayar (Google AI Premium / Gemini Advanced ~$20/bln)** mengingat anggaran bulanan sudah dialokasikan untuk Claude Pro, Codex, DeepSeek API, dan OpenCode Zen.

Untuk menjalankan ARC secara optimal tanpa biaya tambahan ($0 marginal cost), perbandingan antarmuka kerja resmi Google adalah sebagai berikut:

| Kebutuhan ARC Sigma | Gemini Web Chat (`gemini.google.com` Free) | Google AI Studio (`aistudio.google.com` Free) |
|---|---|---|
| **Akses Model Gemini Pro** | ❌ Tidak tersedia (hanya Flash; Pro dikunci di $20/bln) | **Tersedia GRATIS** (Gemini 3.1 Pro / 2.5 Pro) |
| **System Instructions (Mandat ARC)** | ❌ Tidak ada (fitur Gems terkunci di tier berbayar) | **Ada & Persisten** di setiap sesi chat |
| **Kontrol Parameter (Temperature)** | ❌ Otomatis / chatty (tidak bisa diatur) | **Bisa disetel rendah (0.0 – 0.3)** untuk penalaran deterministik |
| **Kapasitas Konteks** | Terpangkas pendek (~32K token) | **Penuh (Hingga 2 Juta Token)** |
| **Google Search Grounding** | Otomatis tanpa kontrol pengguna | **Toggle manual on/off** dengan inspeksi sitasi |
| **Transparansi Token** | ❌ Tidak ada indikator | **Token count bar real-time** |

### 8.1 Rekomendasi Alur Kerja ARC di Google AI Studio
1. **Pilih Model Pro:** Pilih model `gemini-3.1-pro` (atau versi Pro stabil terbaru) pada panel model sebelah kanan.
2. **Setel System Instructions:** Masukkan batasan formal Sigma, format `DIR-INTENT`, dan instruksi pemisahan arahan sovereign vs challengeable.
3. **Turunkan Temperature:** Setel ke `0.2` agar keluaran ARC bersifat presisi, logis, tidak berbunga-bunga, dan patuh skema.
4. **Unggah Dokumen Konteks:** Manfaatkan jendela konteks 2M token untuk menyertakan seluruh dokumen acuan arsitektur atau log diskusi sebelumnya.
5. **Aktifkan Search Grounding:** Nyalakan fitur Google Search tool saat masuk ke sub-scope *Research Mode* untuk memvalidasi sumber primer.

### 8.2 Batasan & Protokol Data Governance (Sigma Rule)
Pada Free Tier (baik di AI Studio maupun web chat), Google berhak meninjau prompt secara anonim untuk evaluasi dan penyempurnaan model. Oleh karena itu, Director dan operator wajib mematuhi aturan keamanan berikut:
- **Dilarang memasukkan rahasia material:** Jangan mengunggah API key, kredensial produksi, PII (data pribadi pengguna), atau proprietary source code internal sensitif ke dalam sesi Free Tier.
- **Ruang lingkup yang diizinkan:** Formulasi konsep arsitektur, spesifikasi fungsional, pemilihan pustaka/teknologi terbuka, dan batasan logika sistem sepenuhnya sah dan aman dijalankan pada Free Tier.

---

## 9. Konsistensi lintas-provider (Posisi Gemini dalam Ekosistem)

| Fungsi | OpenAI | Anthropic | DeepSeek | Gemini |
|---|---|---|---|---|
| **Workhorse Utama** | Terra | Sonnet 5 | V4 Flash | **Gemini 3.8 Flash** |
| **Puncak Reasoning** | Sol | Opus 5 | V4 Pro (nominal) | **Gemini 3.1 Pro** |
| **Puncak Eksekusi Coding** | Terra / Sol | Sonnet 5 / Opus 5 | V4.1 Flash | **Gemini 3.8 Flash** |
| **Edge Spesialis Unik** | Reasoning `xhigh` | Native `opusplan` & subagent routing | Biaya super murah | **Native Search Grounding & 2M Context** |

---

## 10. Resolusi keputusan Director (Baseline Terkunci)

1. **Kebijakan DEV-D3 (Flash vs Pro):**
   - **Keputusan:** Mengadopsi model **Hybrid & Escalation**. Flash `high` tetap menjadi default eksekusi untuk menghemat biaya. Namun, Pro `high` dibuka sebagai jalur eskalasi resmi ketika menghadapi hambatan arsitektur atau jika 2 kali perbaikan bug gagal pada test contract.
2. **Perluasan Mandat Gemini:**
   - **Keputusan:** Gemini resmi disahkan sebagai kandidat kuat untuk **ARC + AUD-Verificator**, memanfaatkan keunggulan unik Search Grounding.
3. **Versi Pinning:**
   - **Keputusan:** Pinning ke `gemini-3.8-flash` dan `gemini-3.1-pro`.
4. **Modalitas Akses ARC ($0 Marginal Cost):**
   - **Keputusan:** Menggunakan **Google AI Studio (Free Tier)** sebagai antarmuka primer peran ARC guna mendapatkan model Pro dan Search Grounding tanpa beban biaya langganan baru ($20/bln dihindari), dengan kepatuhan terhadap batasan Data Governance.
5. **Circuit Breaker:**
   - Maksimal 2 kali kegagalan test berturut-turut tanpa kemajuan pada Flash sebelum Hermes wajib menghentikan sesi atau mengelevasi ke Pro / meminta memo sesuai lifecycle policy.

---

## 11. Batas proposal

Dokumen ini adalah baseline arsitektural pemilihan model dan alokasi effort. Harga promo Flash ($0.375/$1.875) berlaku hingga 31 Desember 2026 sebelum disesuaikan ke tarif standar ($0.75/$3.75). Integrasi aktual tunduk pada ketersediaan API key, subscription aktif, serta pembatasan kuota rate-limit per tier akun.
