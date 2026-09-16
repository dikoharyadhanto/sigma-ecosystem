# Proposal — Pemetaan Model OpenAI per AI Role (Balance Performance–Cost)

- **Tanggal:** 2026-09-16
- **Status:** Draft untuk review Director; bukan artefak governance Sigma dan bukan otorisasi implementasi.
- **Tujuan:** Menetapkan kecenderungan model OpenAI per role Sigma (ARC/FMN/DEV/AUD) dan per sub-scope-nya yang *right-sized* — cukup andal untuk mandat role-nya tanpa over-tier/over-effort yang membengkakkan biaya token, dan tanpa menurunkan kualitas (performance).
- **Konteks:** Diskusi Director ↔ Hermes. Pemetaan spesifik provider OpenAI terlebih dahulu, dengan pertimbangan balance performance–cost dan pemecahan sub-scope kerja tiap role.
- **Bahasa:** Indonesia (istilah teknis/command tetap English).

---

## 1. Lini model OpenAI yang relevan (snapshot September 2026)

Sumber: katalog resmi `developers.openai.com` (snapshot 2026-09). **Lanskap berubah cepat — verifikasi ulang terhadap dashboard API sebelum difinalkan sebagai mapping produksi.**

| Model | ID | Input / Output (per 1M tok, short ctx) | Posisi |
|---|---|---|---|
| **GPT-6 Astra** | `gpt-6-astra` | $10 / $50 | Flagship tertinggi: reasoning + coding kompleks |
| **GPT-5.6 Sol** | `gpt-5.6-sol` | $4 / $20 | Flagship kerja profesional |
| **GPT-5.6 Terra** | `gpt-5.6-terra` | $2 / $12 | Seimbang kecerdasan/biaya |
| **GPT-5.6 Luna** | `gpt-5.6-luna` | $0.20 / $1.20 | Hemat, volume tinggi |

Fakta struktural yang mengubah peta lama:

- Lini model Codex (`gpt-5.x-codex`, `codex-mini-latest`) dan o-series (`o3`, `o4-mini`) **sudah deprecation/superseded** — reasoning kini disatukan ke lini utama `GPT-5.6`.
- Codex CLI kini berjalan di lini utama (`gpt-5.4`/`gpt-5.6`), bukan lagi model `codex-*` terpisah.
- OpenAI menandai reasoning effort `xhigh` untuk *"security and code review, deeper research"* — persis kebutuhan AUD Verificator dan ARC Research Mode.

---

## 2. Struktur biaya per role (bukan sekadar harga)

Biaya token = harga × volume × reasoning effort. Volume antar-role tidak simetris, sehingga "balance" tidak berarti meratakan semua role ke model tengah.

| Role | Volume kerja | Beban token dominan | Implikasi biaya |
|---|---|---|---|
| **DEV** | Tinggi, kontinu | Input besar (baca codebase berulang) + output kode | **Mendominasi total spend** — right-sizing di sini = ROI terbesar |
| **FMN** | Menengah (sekali per plan) | Output dokumen panjang | Sedang |
| **ARC** | Rendah (awal + closure) | Reasoning + riset | Murah secara absolut (jarang jalan) |
| **AUD** | Rendah + input dibatasi policy isolasi | Reasoning per token tinggi, volume kecil | **Murah by design** |

Konsekuensi: ARC dan AUD bisa memakai model kuat dengan murah karena volumenya kecil; DEV justru butuh disiplin biaya paling ketat karena volumenya besar.

---

## 3. Kerangka right-sizing (tiga knob terpisah)

- **Model tier** = ceiling kemampuan (langkah tersulit yang harus bisa dikerjakan sub-scope itu secara andal).
- **Reasoning effort** = dial variabel per tugas (`low/medium/high/xhigh`); reasoning token dibebankan sebagai output dan tidak terlihat.
- **Context discipline** = input token (terbesar untuk DEV); prompt caching memberi diskon ~90% input berulang.

Dua koreksi struktural:

1. **Tier dan effort adalah dial gabungan, bukan kolom independen.** "Terra+`high`" vs "Sol+`medium`" pada tugas terikat bisa setara kualitasnya dengan biaya beda. Pemetaan harus divalidasi sebagai *pasangan* (tier, effort), bukan dipilih per-kolom.
2. **"Terendah yang andal" ditentukan empiris, bukan a priori.** Kolom effort di bawah adalah titik awal untuk diuji per kelas tugas, bukan dogma. Jalankan pilot kecil per sub-scope, ukur akurasi vs biaya, baru kunci.

Nuansa mekanis: cache bergantung pada kecocokan prefix, model, dan mekanisme API; **jangan mengasumsikan cache dapat dipakai lintas-model atau bahwa setiap sesi pasti kehilangan cache**. Pertahankan prefix stabil dan ukur `cached_input_tokens` pada pilot. Sub-scope ARC/FMN/AUD yang terpisah boleh memakai tier berbeda. DEV hidup dalam loop ketat, sehingga default-nya **satu model per sesi (kelas D)**; effort dapat dinaikkan atau diturunkan bila API/harness mendukungnya tanpa menulis ulang prefix.

---

## 4. Sub-scope kerja per role

- **ARC — 4 sub-scope:** (1) interview + penyusunan DIR-INTENT; (2) research mode — hanya saat intent mengaktifkan comprehensive research; (3) memperbaiki intent berdasarkan hasil audit; (4) menilai kelayakan implementasi dengan scoring untuk syarat close.
- **AUD — 2 mode (aktif sesuai kebutuhan):** (1) auditor mode — mengaudit konsistensi, kesalahan, dan konsekuensi logis suatu plan/intent; (2) verificator mode — hanya aktif jika intent mengaktifkan comprehensive research; mengaudit kebenaran sumber yang dikutip sebagai dasar pengetahuan.
- **FMN — 3 sub-scope:** (1) menyusun FMN-PLAN; (2) memperbaiki plan berdasarkan audit; (3) memeriksa pekerjaan DEV di DEV-EXEC (pre-build review dan post-build review) untuk mengecek konsistensi kontrak.
- **DEV — 4 sub-scope:** (1) menyusun rencana implementasi; (2) melakukan eksekusi; (3) memperbaiki bug dan gap yang ditemukan; (4) melakukan pengujian/testing (biasanya satu paket saat eksekusi).

---

## 5. Distribusi model per sub-scope

### ARC — model boleh beda per sesi
| Sub-scope | Model | Effort | Rasional |
|---|---|---|---|
| 1. Interview + draft DIR-INTENT | **Sol** | `high` | Langkah tersulit ARC: klasifikasi sovereign/challengeable + koherensi + operasionalisasi outcome |
| 2. Research mode | **Sol** | `xhigh` + tools | Hanya bila comprehensive research diaktifkan oleh intent; gunakan sumber primer bila tersedia, rekam URL/kutipan/keterbatasan, dan jangan menyimpulkan di luar evidence |
| 3. Revisi intent pasca-audit | **Terra** | `medium` | Revisi terarah atas temuan konkret |
| 4. Closure scoring | **Terra** | `medium` | Prosedural (band eksplisit); yang diuji kesetiaan prosedur, bukan kedalaman |
### AUD — model boleh beda per mode
| Sub-scope | Model | Effort | Rasional |
|---|---|---|---|
| 1. Auditor (Critic) mode | **Terra** | `high` | Konsistensi + kesalahan logis; "jangan meleset" = eksploratif, tapi artefak terbatas |
| 2. Verificator mode | **Sol** | `xhigh` + tools | Satu-satunya sub-scope yang butuh grounding sumber primer |

### FMN — model boleh beda per sesi
| Sub-scope | Model | Effort | Rasional |
|---|---|---|---|
| 1. Draft FMN-PLAN | **Terra** | `medium` | Terjemahan intent terkunci; `high` hanya plan multi-workstream |
| 2. Revisi plan pasca-audit | **Terra** | `medium` | Revisi terarah |
| 3. Review DEV-EXEC (pre + post build) | **Terra** | `medium` | Cek konsistensi kontrak, terikat |

### DEV — satu model per sesi (kelas D), effort yang bervariasi
| Sub-scope | Model (dari kelas D) | Effort |
|---|---|---|
| 1. Draft rencana implementasi | Terra (D1/D2) / Sol (D3) | `medium` (D1) / `high` (D2/D3) |
| 2. Eksekusi | Terra (D1/D2) / Sol (D3) | `high` |
| 3. Fix bug/gap | *sama dengan sesi* | `medium` (trivial) / `high`–`xhigh` (debug sulit) |
| 4. Testing/verifikasi | *sama dengan sesi* | `medium` (jalankan+rekam); `low` (transkripsi murni) |

Klasifikasi D1–D4 untuk DEV mengacu pada `2026-09-15_proposal-hermes-specialist-session-lifecycle-and-memo-policy.md` §9: D1 rutin → Terra; D2 sedang → Terra; D3 kompleks/material → Sol; D4 tidak jelas/konflik → jangan aktifkan DEV.

---

## 6. Prinsip effort (kenapa tidak `high` merata)

Effort menambah reasoning token yang ditagihkan sebagai output. Besar kenaikan token, biaya, dan kualitas **bukan konstanta**; estimasi seperti rasio 3–10× harus diperlakukan sebagai hipotesis sampai diukur pada workload Sigma. Secara operasional, effort lebih tinggi diprioritaskan untuk penalaran multi-langkah eksploratif serta klasifikasi/verifikasi sulit; manfaatnya pada tugas prosedural, revisi terarah, cek konsistensi terikat, transkripsi, atau rekam hasil harus dibuktikan oleh pilot.

Maka `high` merata berisiko membayar reasoning token tanpa kenaikan kualitas yang sebanding. Prinsip: **default effort adalah yang terendah yang terbukti andal per sub-scope; naik hanya saat sinyal tugas atau hasil evaluasi membutuhkannya.**

`high` hanya bertahan di tiga tempat yang membenarkannya: **ARC interview, AUD critic, DEV eksekusi**. `xhigh` hanya di tiga puncak: **ARC research mode, AUD verificator, DEV debug/security**. Selebihnya `medium`.

---

## 7. Sebaran ringkas (siapa memikul apa)

| Model | Memikul | Frekuensi |
|---|---|---|
| **Terra** | FMN (3 sub-scope), ARC scoring, ARC revisi, AUD critic, DEV D1/D2 | **Mayoritas volume** — workhorse |
| **Sol** | ARC interview+draft, AUD verificator, DEV D3 | Puncak reasoning (jarang, bernilai tinggi) |
| **Astra** | Eskalasi: intent multi-konstrain, verifikasi multi-sumber berat, D3 long-horizon | Sangat jarang, gated |
| **Luna** | *Tidak ada sub-scope role yang layak* — hanya sub-tugas mekanis Hermes (render template, transkripsi test report, formatting) | Di luar mandat role |

---

## 8. Routing berbasis hasil dan circuit breaker

Klasifikasi awal adalah default, bukan vonis kualitas. Eskalasi harus dicatat bersama alasannya dan hanya dilakukan bila salah satu trigger berikut terpenuhi:

- **Terra → Sol:** test contract gagal setelah dua upaya perbaikan yang substantif, terdapat konflik arsitektural/material yang belum terselesaikan, atau output gagal memenuhi kriteria evidence/koherensi role.
- **Sol → Astra:** pekerjaan D3 long-horizon dengan dependency atau constraint berlapis, verifikasi multi-sumber yang tetap ambigu setelah penelusuran primer, atau risiko keamanan material yang memerlukan review mendalam.
- **Tidak ada eskalasi:** D4 atau intent/plan yang konflik/tidak jelas tetap dikembalikan ke ARC/FMN; model yang lebih kuat bukan pengganti keputusan yang belum terkunci.

Setiap task memiliki circuit breaker: batas biaya total (token input, cached input, output/reasoning, dan tool call), batas jumlah tool call, serta aturan compaction/ringkasan context. Ketika batas tercapai, hentikan pekerjaan, rekam evidence dan biaya, lalu minta keputusan Director untuk melanjutkan, mempersempit scope, atau mengubah tier.

## 9. Anti-pattern "overpower" yang harus dicegah
1. **Effort `high`/`xhigh` pada tugas yang sudah jelas** — reasoning token tak terlihat meledak tanpa kenaikan kualitas. Default effort harus yang terendah yang andal, naik hanya saat tugas memang butuh.
2. **Feeding codebase penuh berulang tanpa cache** — input token DEV yang dominan; gunakan caching + context minimum (task envelope). Ini sudah prinsip desain Sigma, kini juga prinsip biaya.
3. **Cache-write premium** — re-prompt yang membuyarkan prefix/cache dapat memboroskan biaya; khususnya jangan ganti model di tengah sesi DEV tanpa alasan routing yang tercatat.
4. **Menaikkan tier "biar aman" alih-alih menaikkan effort** — tier = ceiling, effort = dial. Salah memilih knob ini yang biasanya jadi sumber biaya tinggi.

---

## 10. Keputusan Director yang masih terbuka

1. Ambang klasifikasi D1/D2/D3 untuk DEV — dipakai sebagai pemisah Terra/Sol/Astra seperti di atas?
2. Default effort per sub-scope — usulan di §5 (mayoritas `medium`, `high` di tiga sub-scope, `xhigh` di tiga puncak) diterima, atau disesuaikan?
3. Budget keras per task (circuit breaker) — model tier jadi *default*, budget adalah *hard cap*. Nilai awal per role untuk token **dan tool call** berapa?
4. Validasi empiris — disetujui menjalankan pilot kecil per sub-scope untuk mengukur kualitas terhadap test contract, rework/escalation rate, input/cached-input/output-reasoning token, tool call, biaya total, dan durasi sebelum effort difinalkan?

---

## 11. Batas proposal ini

Dokumen ini menetapkan *kecenderungan* pemilihan model + effort per sub-scope, bukan konfigurasi final. Nama model, harga, ketersediaan per akun, biaya tool, dan perilaku cache harus diverifikasi ulang terhadap dashboard/API telemetry saat implementasi. Kolom effort adalah titik awal untuk validasi empiris, bukan ketetapan. Luna bukan default untuk keputusan substantif ARC/FMN/DEV/AUD, tetapi dapat dipakai untuk sub-tugas deterministik yang dapat diverifikasi (misalnya rendering template, transkripsi test report, atau formatting), dengan review model utama bila hasilnya memengaruhi artefak keputusan. Belum menyentuh pertanyaan subscription aktif maupun routing per role — sesuai konvensi Sigma, itu ditanyakan ke Director saat akan dipakai nyata, tidak diinferensikan dari CLI/env. Belum mencakup perbandingan lintas-provider (Anthropic/DeepSeek/Gemini).
