# Proposal — Baseline OpenCode Zen untuk Hermes dan Sigma AI Roles

- **Tanggal:** 2026-09-16
- **Status:** Draft baseline untuk review Director; bukan otorisasi konfigurasi atau eksekusi.
- **Tujuan:** Menetapkan routing awal model OpenCode Zen yang menyeimbangkan kualitas, biaya, dan redundansi provider untuk Hermes serta AI role Sigma.
- **Prinsip:** Maksimal tiga model per kategori. Pilihan model adalah *default/alternative/escalation*, bukan izin memakai tiga model dalam satu task.
- **Catatan revisi (2026-09-16, hasil review Director):** default AUD dipindah ke DeepSeek V4 Pro dan ditambah aturan independensi family auditor terhadap model penulis artefak; tier AUD critic mengikuti tier output yang direview; effort DEV mengikuti kelas D1/D2, bukan flat `high`; harga MiniMax M3 dan kolom cached read ditambahkan ke §2; aturan revalidasi deprecation ditambahkan ke §5; scope keluarga model dan URL sumber dikoreksi; §3.2 direstrukturisasi menjadi mapping per jenis task (default, alternatif default, planning, review, execution, debugging/testing).

---

## 1. Premis dan batas

OpenCode Zen adalah gateway model dengan daftar model/provider yang dikurasi OpenCode untuk bekerja baik dengan OpenCode. Klaim tersebut terutama relevan bagi coding agent; ia **bukan** bukti bahwa setiap model setara untuk research, audit, atau keputusan governance. Karena itu, mapping ARC dan AUD bersifat baseline pilot dengan quality gate yang lebih ketat.

Keluarga Claude, GPT, dan Gemini yang tersedia melalui Zen tidak dipetakan di dokumen ini karena tercakup dalam proposal mapping vendor masing-masing. Dokumen ini hanya memetakan keluarga DeepSeek, GLM, Kimi, dan MiniMax.

DeepSeek API langsung dipertahankan sebagai provider terpisah. Model DeepSeek melalui Zen dan DeepSeek API langsung bukan redundansi penuh: keduanya dapat memiliki ketergantungan upstream yang sama. Untuk failover yang bermakna, pindahkan ke keluarga model lain, bukan sekadar endpoint Zen lain dengan model DeepSeek yang sama.

Model gratis tidak dipakai untuk source code, rahasia, data pribadi, atau artefak keputusan. Semua task tetap tunduk pada scope, otorisasi, dan aturan destructive action; model murah tidak mengubah kewenangan Hermes.

---

## 2. Harga rujukan Zen dan prinsip effort

Harga berikut per 1M token (snapshot 2026-09-16):

| Model | Input | Output | Cached read |
|---|---|---|---|
| DeepSeek V4 Flash | $0.14 | $0.28 | $0.028 |
| DeepSeek V4 Pro | $1.74 | $3.48 | $0.145 |
| GLM 5.3 Flash | $0.15 | $0.50 | $0.03 |
| GLM 5.3 | $1.40 | $4.40 | $0.26 |
| Kimi K2.7 Code | $0.95 | $4.00 | $0.19 |
| Kimi K3 | $3.00 | $15.00 | $0.30 |
| MiniMax M3 | $0.30 | $1.20 | $0.06 |

Harga, availability, dan cache rate harus dibaca ulang dari endpoint/dashboard Zen saat implementasi.

- `low`: tindakan atau transformasi sempit dan mudah diverifikasi.
- `medium`: default untuk kerja mandiri dengan beberapa langkah dan tool use terbatas.
- `high`: perencanaan, coding, debugging, review, atau keputusan dengan banyak constraint.
- `xhigh`: hanya riset/verifikasi sulit atau deadlock debugging yang sudah memenuhi trigger eskalasi.

Effort bukan pengganti tier model dan bukan bukti kualitas. Effort dinaikkan hanya bila test contract, kompleksitas, atau pilot menunjukkan kebutuhan.

Label effort dalam tabel adalah **target intensitas berpikir**, bukan jaminan parameter API yang identik. Variant dan parameter reasoning bersifat model/provider-specific di OpenCode. Sebelum mengaktifkan baseline, Hermes wajib membaca metadata melalui `opencode models`; bila variant yang diminta tidak tersedia, gunakan variant terdekat yang didukung dan catat deviasinya. Jangan meneruskan `reasoningEffort` secara buta karena provider dapat menolaknya atau mengabaikannya.

---

## 3. Hermes menurut lingkungan kerja

### 3.1 Hermes global

Scope: diskusi umum, observasi OS/perangkat, diagnosis ringan, formatting, dan administrasi non-destruktif.

| Prioritas | Model Zen | Effort default | Pakai untuk | Batas |
|---|---|---|---|---|
| Default hemat | DeepSeek V4 Flash | `low` | tanya-jawab umum, status/cache device, formatting, ekstraksi sederhana | naik ke `medium` bila perlu tool atau diagnosis multi-langkah |
| Alternatif hemat | GLM 5.3 Flash | `low` | tugas umum terikat instruksi, ringkasan, klasifikasi | jangan menjadi satu-satunya dasar keputusan teknis material |
| Kualitas | MiniMax M3 | `medium` | diagnosis ringan yang perlu koherensi lebih tinggi atau multi-file kecil | tetap minta persetujuan sebelum delete/uninstall/cleanup material |

### 3.2 Project non-Sigma

Scope: project tidak terdaftar Sigma, kompleksitas terbatas, dan Hermes dapat mengelolanya sendiri.

| Jenis task | Model rekomendasi | Effort | Catatan dan trigger naik |
|---|---|---|---|
| Default | DeepSeek V4 Pro | `medium` | workhorse implementasi dan kerja umum; naik kelas bila konflik desain atau dua upaya perbaikan substantif gagal |
| Alternatif default | GLM 5.3 | `medium` | failover family, atau bila kualitas test contract default tidak tercapai |
| Planning | GLM 5.3 | `medium` | draft dan revisi plan kecil; plan teknis multi-modul naik ke Kimi K2.7 Code `high` |
| Review | GLM 5.3 | `medium` | review dokumen teknis dan diff; bila eksekutor bukan DeepSeek, reviewer beralih ke DeepSeek V4 Pro agar reviewer tetap beda family dari eksekutor |
| Execution | DeepSeek V4 Pro | `medium` (D1) / `high` (D2) | coding agent task ber-context besar atau refactor terbatas naik ke Kimi K2.7 Code `high` |
| Debugging/testing | DeepSeek V4 Pro | `high` | bug sulit atau dua upaya perbaikan gagal → Kimi K2.7 Code `high`; hentikan bila scope menjadi D4/material |

DeepSeek API langsung dapat menjadi default biaya untuk DeepSeek V4 Pro/Flash jika telemetry kualitas dan latency setara atau lebih baik daripada Zen. Zen dipilih ketika variasi model atau failover keluarga model memberi nilai lebih besar daripada tambahan gateway.

### 3.3 Project terdaftar Sigma

Hermes hanya mengorkestrasi. Ia tidak menggantikan ARC, FMN, DEV, atau AUD, dan tidak boleh merutekan D4 (intent/plan konflik atau belum terkunci) ke model yang lebih mahal sebagai jalan pintas. Mapping role berikut hanya aktif setelah role dan artefak masukannya sah.

---

## 4. Baseline Zen per Sigma AI role

### ARC — intent, research, closure

| Prioritas | Model Zen | Effort | Sub-scope |
|---|---|---|---|
| Default | GLM 5.3 | `high` | interview terstruktur, draft/revisi DIR-INTENT |
| Alternatif | DeepSeek V4 Pro | `high` | konsistensi constraint dan revisi berbasis temuan audit |
| Eskalasi | Kimi K3 | `xhigh` | comprehensive research atau intent multi-constraint yang gagal memenuhi gate koherensi |

Research mode wajib memakai tools/sumber primer, mencatat URL dan keterbatasan. Bila evidence tidak dapat diverifikasi, hasilnya provisional—bukan dasar closure.

### AUD — critic dan verificator

| Prioritas | Model Zen | Effort | Sub-scope |
|---|---|---|---|
| Default | DeepSeek V4 Pro | `high` | critic: konsistensi plan/intent dan kontradiksi |
| Alternatif | GLM 5.3 | `high` | audit terikat terhadap test contract atau evidence yang tersedia |
| Eskalasi | Kimi K3 | `xhigh` + tools | verificator multi-sumber atau konflik evidence yang belum selesai |

Tidak ada model Zen yang diberi asumsi “benar” untuk verificator. Audit harus membedakan klaim, sumber primer, inferensi, dan area yang belum terverifikasi.

Auditor tidak boleh berasal dari family yang sama dengan model penulis artefak yang diaudit. Karena default ARC adalah GLM 5.3, default AUD adalah DeepSeek V4 Pro; bila ARC memakai alternatif DeepSeek V4 Pro, AUD beralih ke GLM 5.3. Tier AUD critic mengikuti tier output yang direview: untuk output DEV D1/D2 gunakan tabel di atas; untuk output D3 atau fallback Zen pengganti Codex/Claude, critic naik ke Kimi K3 agar tidak secara sistematis lebih lemah dari implementor yang direview.

### FMN — plan dan review DEV-EXEC

| Prioritas | Model Zen | Effort | Sub-scope |
|---|---|---|---|
| Default | GLM 5.3 | `medium` | draft dan revisi FMN-PLAN terikat DIR-INTENT |
| Alternatif | DeepSeek V4 Pro | `medium` | review konsistensi test contract dan DEV-EXEC |
| Eskalasi | Kimi K2.7 Code | `high` | plan teknis multi-modul atau konflik implementasi-kontrak |

### DEV — eksekusi dan testing

| Prioritas | Model Zen | Effort | Sub-scope |
|---|---|---|---|
| Default | DeepSeek V4 Pro | `medium` (D1) / `high` (D2) | D1/D2 implementasi, perbaikan bug, testing |
| Alternatif | Kimi K2.7 Code | `high` | coding agent task, refactor terbatas, debugging lebih sulit |
| Eskalasi | GLM 5.3 | `high` | second opinion untuk desain/code review atau saat dua upaya model utama gagal |

Untuk DEV D3 material/long-horizon, Zen bukan default pengganti Codex/Claude. Bila fallback Zen dipakai karena limit/absennya subscription, Hermes wajib mencatat downgrade, mempersempit scope, dan menjalankan test contract lengkap sebelum handoff.

---

## 5. Aturan routing dan circuit breaker

1. **Pilih satu model per sesi eksekusi.** Jangan mengganti model di tengah loop hanya untuk eksperimen; lakukan handoff eksplisit dengan ringkasan state dan alasan.
2. **Eskalasi dalam kategori hanya bila:** test contract gagal setelah dua perbaikan substantif, terjadi konflik teknis/material, atau evidence masih ambigu setelah pemeriksaan primer.
3. **Ganti keluarga model untuk failover:** DeepSeek langsung/Zen DeepSeek → GLM atau Kimi; jangan menganggap endpoint berbeda sebagai provider yang benar-benar independen.
4. **Budget per task:** tetapkan hard cap biaya total, input/cached-input/output token, tool call, dan durasi. Saat cap tercapai, Hermes berhenti dan melaporkan state, evidence, serta biaya.
5. **Data policy:** whitelist hanya model berbayar yang disetujui untuk artefak internal. Blocklist semua model gratis dan model contributor/training dari scope sensitif.
6. **D4 tidak dieskalasi:** intent atau plan yang belum terkunci kembali ke ARC/FMN, bukan ke Kimi K3 atau model mahal lain.
7. **Revalidasi deprecation:** Zen mempensiunkan model dalam skala bulan. Bila model dalam baseline ini masuk daftar deprecated, slot tersebut tidak valid sampai Hermes mengusulkan pengganti dari family yang sama dan Director menyetujuinya.

---

## 6. Pilot sebelum penguncian baseline

Pilot minimum per kategori menggunakan task representatif yang sama pada maksimal tiga kandidat model. Catat:

- keberhasilan test contract dan jumlah rework;
- biaya input, cached input, output/reasoning, dan tool call;
- latency/durasi;
- kualitas handoff, kepatuhan scope, serta error kritis;
- provider/model ID, effort, dan alasan eskalasi.

Model dinyatakan default hanya bila kualitasnya memenuhi ambang kategori dan biaya total per task lebih baik dari alternatif, bukan sekadar harga token yang lebih rendah.

---

## 7. Keputusan Director yang masih terbuka

1. Apakah model berbayar Zen diizinkan untuk artefak internal, atau hanya source code non-sensitif?
2. Berapa hard cap awal per task untuk global, non-Sigma, dan Sigma?
3. Apakah DeepSeek API langsung dijadikan primary untuk task hemat, atau hanya fallback di luar Zen?
4. Ambang pilot apa yang wajib dipenuhi sebelum Zen dipakai untuk ARC/AUD dan DEV D3?

## 8. Sumber

- OpenCode Zen: https://opencode.ai/docs/zen
- Daftar model dan metadata machine-readable Zen: https://opencode.ai/zen/v1/models
- Provider configuration OpenCode: https://opencode.ai/docs/providers
