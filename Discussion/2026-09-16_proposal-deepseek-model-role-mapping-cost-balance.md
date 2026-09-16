# Proposal — Pemetaan Model DeepSeek per AI Role (Balance Performance–Cost)

- **Tanggal:** 2026-09-16
- **Status:** Draft untuk review Director; bukan artefak governance Sigma dan bukan otorisasi implementasi.
- **Tujuan:** Menetapkan kecenderungan model DeepSeek per role Sigma (ARC/FMN/DEV/AUD) dan per sub-scope-nya yang *right-sized* — cukup andal tanpa over-tier/over-effort, dan tanpa menurunkan kualitas.
- **Konteks:** Diskusi Director ↔ Hermes, lanjutan dari file OpenAI dan Anthropic. Director menetapkan baseline kerja: **dua model nominal (V4 Pro = peak, V4 Flash = workhorse)** dengan **effort dua level (`medium` / `high`)**.
- **Bahasa:** Indonesia (istilah teknis/command tetap English).

---

## 1. Lini DeepSeek (snapshot September 2026)

Sumber: dokumentasi/model card DeepSeek + cek silang (snapshot 2026-09). **Lanskap berubah cepat — verifikasi ulang terhadap dashboard API sebelum difinalkan.**

| Model | Param (total/aktif) | Harga (per 1M) | Status faktual |
|---|---|---|---|
| **V4.1 Flash** | 552B / 16B | ~$0.30 / $1.20 | Flagship de facto (10 Sep 2026); unggul di agentic coding |
| **V4 Pro** | 1.6T / 49B | ~$0.66 / $1.98 | Phase-out — sejak 14 Sep 2026, nama `deepseek-v4-pro` dilayani V4.1 Flash sampai V4.1-Pro rilis |

Fakta struktural: DeepSeek praktis kolaps menjadi satu model (V4.1 Flash), dengan V4-Pro di phase-out. Harga ~1/10–1/30 frontier Barat.

---

## 2. Baseline kerja yang ditetapkan Director

Atas arahan Director (2026-09-16), pemetaan ini memakai **dua model nominal** dan **dua level effort** untuk konsistensi lintas-provider:

| Tingkat | DeepSeek | Paralel OpenAI | Paralel Anthropic |
|---|---|---|---|
| Workhorse | **V4 Flash** | Terra | Sonnet 5 |
| Peak | **V4 Pro** | Sol | Opus 5 |

Effort hanya dua level: **`medium`** (default, tugas prosedural/terikat) dan **`high`** (hard reasoning).

> **Catatan tiering nominal:** pemetaan **Pro > Flash** di sini mengikuti konvensi penamaan, bukan urutan benchmark faktual — kenyataannya V4.1 Flash ≥ Pro pada agentic coding, dan Pro sedang phase-out. Baseline ini dipakai agar tabel lintas-provider konsisten; bukan klaim bahwa Pro lebih kuat dari Flash.

---

## 3. Struktur biaya per role (identik lintas-provider)

Biaya = harga × volume × effort. Volume antar-role tidak simetris; "balance" tidak berarti meratakan semua role ke model tengah.

| Role | Volume | Beban token dominan | Implikasi |
|---|---|---|---|
| **DEV** | Tinggi, kontinu | Input besar (codebase) + output kode | Mendominasi total spend |
| **FMN** | Menengah | Output dokumen panjang | Sedang |
| **ARC** | Rendah | Reasoning + riset | Murah secara absolut |
| **AUD** | Rendah + input dibatasi isolasi | Reasoning per token tinggi, volume kecil | Murah by design |

---

## 4. Sub-scope kerja per role

Sama dengan file OpenAI/Anthropic: ARC 3 sub-scope; AUD 2 mode; FMN 3 sub-scope; DEV 4 sub-scope (rencana implementasi, eksekusi, fix bug/gap, testing).

---

## 5. Distribusi per sub-scope

| Role | Sub-scope | Model | Effort |
|---|---|---|---|
| **ARC** | 1. Interview + draft intent | **Pro** | `high` |
| | 2. Revisi pasca-audit | **Flash** | `medium` |
| | 3. Scoring closure | **Flash** | `medium` |
| **AUD** | 1. Critic | **Flash** | `high` |
| | 2. Verificator | **Pro** | `high` |
| **FMN** | 1. Draft plan | **Flash** | `medium` |
| | 2. Revisi pasca-audit | **Flash** | `medium` |
| | 3. Review DEV-EXEC | **Flash** | `medium` |
| **DEV** | 1. Draft rencana implementasi | Flash (D1/D2) / Pro (D3) | `medium` (D1) / `high` (D2/D3) |
| | 2. Eksekusi | Flash (D1/D2) / Pro (D3) | `high` |
| | 3. Fix bug/gap | Flash (D1/D2) / Pro (D3) | `medium` (trivial) / `high` (debug) |
| | 4. Testing | Flash | `medium` |

Klasifikasi D1–D4 mengacu pada `2026-09-15_proposal-hermes-specialist-session-lifecycle-and-memo-policy.md` §9.

---

## 6. Sebaran ringkas

| Model | Memikul | Frekuensi |
|---|---|---|
| **Flash** | FMN (3), ARC scoring+revisi, AUD critic, DEV D1/D2 | Workhorse mayoritas |
| **Pro** | ARC interview, AUD verificator, DEV D3 | Puncak reasoning (jarang) |

| Effort | Berlaku |
|---|---|
| `medium` | Default — FMN semua, ARC scoring/revisi, DEV D1/testing |
| `high` | Hard reasoning — ARC interview, AUD critic, AUD verificator, DEV eksekusi/debug/D3 |

---

## 7. Caveat jujur

1. **Tiering nominal** — lihat §2. Pro > Flash adalah konvensi penamaan, bukan urutan kekuatan benchmark.
2. **Phase-out Pro** — `deepseek-v4-pro` kini alias ke V4.1 Flash. Bila baseline "Pro = peak" harus dipertahankan jangka panjang, perlu keputusan saat V4.1-Pro rilis (atau ganti nama model peak).
3. **Effort `medium`** — cache Hermes (`reasoning_caps.json`) hanya mendaftar `high`/`xhigh` untuk `deepseek-v4-pro`; Director mengonfirmasi `medium` aktif di layar. Selisih ini perlu diverifikasi ulang saat implementasi (bisa jadi cache stale atau ada pemetaan provider yang belum tercatat).
4. **Knowledge-depth** — baik Flash maupun Pro tertinggal frontier Barat (~3–6 bulan per paper DeepSeek) pada raw reasoning + world-knowledge. Implikasinya: DeepSeek cocok untuk ARC/FMN/DEV-rutin; **bukan AUD Verificator** (butuh grounding pengetahuan-dunia) **dan bukan DEV-D3** (long-horizon tersulit). Ini konsisten dengan pemetaan Sigma yang sudah ada (DeepSeek = ARC/FMN).

---

## 8. Keputusan Director yang masih terbuka

1. Apakah "Pro = peak" tetap dipertahankan setelah V4.1-Pro rilis, atau peak diganti nama model barunya?
2. Verifikasi selisih `medium` (config vs `reasoning_caps.json`) saat implementasi.
3. Budget keras per task (circuit breaker) per role.
4. Validasi empiris — pilot kecil per sub-scope sebelum effort difinalkan.

---

## 9. Batas proposal

Kolom model + effort adalah *kecenderungan*, bukan konfigurasi final; verifikasi ulang terhadap dashboard API saat implementasi. Baseline dua-model bersifat nominal (lihat §2). Belum menyentuh subscription aktif maupun routing per role — ditanyakan ke Director saat akan dipakai nyata. Belum mencakup perbandingan lintas-provider terkonsolidasi.
