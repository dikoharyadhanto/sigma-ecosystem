# Proposal — Pemetaan Model Anthropic per AI Role (Balance Performance–Cost)

- **Tanggal:** 2026-09-16
- **Status:** Draft untuk review Director; bukan artefak governance Sigma dan bukan otorisasi implementasi.
- **Tujuan:** Menetapkan kecenderungan model Anthropic (Claude) per role Sigma (ARC/FMN/DEV/AUD) dan per sub-scope-nya yang *right-sized* — cukup andal untuk mandat role-nya tanpa over-tier/over-effort yang membengkakkan biaya token, dan tanpa menurunkan kualitas.
- **Konteks:** Diskusi Director ↔ Hermes, lanjutan dari `2026-09-16_proposal-openai-model-role-mapping-cost-balance.md`. Pemetaan spesifik provider Anthropic dengan logika sub-scope yang sama.
- **Bahasa:** Indonesia (istilah teknis/command tetap English).

---

## 1. Lini Claude aktif (snapshot September 2026)

Sumber: dokumentasi resmi Anthropic / Claude Code + cek silang pricing (snapshot 2026-09). **Lanskap berubah cepat — verifikasi ulang terhadap dashboard API sebelum difinalkan sebagai mapping produksi.**

| Model | ID | Input / Output per 1M | Context | Posisi |
|---|---|---|---|---|
| **Claude Fable 5.1** | `claude-fable-5-1` | $10 / $50 | 1M | Flagship tertinggi (long-horizon) |
| **Claude Opus 5** | `claude-opus-5` | $5 / $25 | 1M | Frontier kerja profesional |
| **Claude Sonnet 5** | `claude-sonnet-5` | $2 / $10 (per proposal awal); **klaim kenaikan ke $3/$15 per 1 Sep 2026 BELUM TERVERIFIKASI — konflik dengan sumber pihak ketiga yang menyatakan $2/$10 dipermanenkan, bukan naik. Cek ulang ke pricing page resmi Anthropic sebelum difinalkan.** | 1M | Workhorse seimbang; near-Opus coding di harga lebih rendah |
| **Claude Haiku 4.5** | `claude-haiku-4-5-20251001` | $1 / $5 | 200K | Cepat/hemat, near-frontier untuk klasifikasi |

Fakta struktural:

- **Opus 5 (24 Juli 2026) menyamai/mengalahkan Fable 5.1 di sebagian besar benchmark dengan harga lebih rendah.** Fable 5.1 hanya layak untuk long-horizon agent yang berjalan berhari-hari, bukan workhorse.
- **Status harga Sonnet 5 per 1 Sep 2026 masih perlu verifikasi resmi** — lihat catatan di tabel di atas.
- Effort ladder: `low / medium / high / xhigh / max` (5 level). Default `high` pada sebagian besar model.
- **Opus 4.7+ dan Fable 5 memakai *adaptive thinking* yang selalu aktif** (alokasi thinking token otomatis berdasarkan kompleksitas) — artinya effort pada model ini berperilaku berbeda dari fixed-budget model.

---

## 2. Struktur biaya per role (identik dengan file OpenAI)

Biaya = harga × volume × reasoning effort. Volume antar-role tidak simetris; "balance" tidak berarti meratakan semua role ke model tengah.

| Role | Volume | Beban token dominan | Implikasi |
|---|---|---|---|
| **DEV** | Tinggi, kontinu | Input besar (codebase) + output kode | Mendominasi total spend |
| **FMN** | Menengah | Output dokumen panjang | Sedang |
| **ARC** | Rendah | Reasoning + riset | Murah secara absolut |
| **AUD** | Rendah + input dibatasi isolasi | Reasoning per token tinggi, volume kecil | Murah by design |

---

## 3. Kerangka right-sizing (konsisten dengan file OpenAI)

- **Model tier** = ceiling kemampuan (langkah tersulit sub-scope).
- **Reasoning effort** = dial variabel per tugas; reasoning token dibebankan sebagai output.
- **Context discipline** = input token (terbesar untuk DEV); prompt caching (cache read ~0.1× input).

Tiga prinsip yang sama:

1. **Tier × effort adalah dial gabungan**, bukan kolom independen — divalidasi sebagai pasangan.
2. **"Terendah yang andal" ditentukan empiris**, bukan a priori — kolom effort di bawah adalah titik awal uji.
3. **Ganti model murah antar-sesi, mahal dalam satu sesi** (prompt cache reset) — sub-scope ARC/FMN/AUD beda model; DEV satu model per sesi (kelas D), effort yang bervariasi.

---

## 4. Sub-scope kerja per role

Sama dengan file OpenAI §4: ARC 3 sub-scope; AUD 2 mode; FMN 3 sub-scope; DEV 4 sub-scope (rencana implementasi, eksekusi, fix bug/gap, testing).

---

## 5. Distribusi model per sub-scope

### ARC — beda model per sesi
| Sub-scope | Model | Effort |
|---|---|---|
| 1. Interview + draft DIR-INTENT | **Opus 5** | `high` |
| 2. Revisi intent pasca-audit | **Sonnet 5** | `medium` |
| 3. Closure scoring | **Sonnet 5** | `high` (revisi — gating decision, bukan revisi biasa; salah skor lebih mahal daripada effort tambahan) |

### AUD — beda model per mode
| Sub-scope | Model | Effort |
|---|---|---|
| 1. Auditor (Critic) mode | **Mengikuti tier DEV yang direview** — Sonnet 5 untuk output D1/D2, Opus 5 untuk output D3 (revisi — critic tidak boleh secara sistematis lebih lemah dari yang direview pada kasus berisiko tinggi) | `high` |
| 2. Verificator mode | **Opus 5** | `xhigh` + tools |

### FMN — beda model per sesi
| Sub-scope | Model | Effort |
|---|---|---|
| 1. Draft FMN-PLAN | **Sonnet 5** | `medium` |
| 2. Revisi plan pasca-audit | **Sonnet 5** | `medium` |
| 3. Review DEV-EXEC (pre + post build) | **Sonnet 5** | `medium` |

### DEV — satu model per sesi (kelas D), effort bervariasi
| Sub-scope | Model (kelas D) | Effort |
|---|---|---|
| 1. Draft rencana implementasi | Sonnet 5 (D1/D2) / Opus 5 (D3) | `medium` (D1) / `high` (D2/D3) |
| 2. Eksekusi | Sonnet 5 (D1/D2) / Opus 5 (D3) | `medium` (D1) / `high` (D2) / `high`–`xhigh` (D3) — **revisi: effort mengikuti kelas, bukan flat `high` untuk semua kelas** |
| 3. Fix bug/gap | *sama dgn sesi* | `medium` (trivial) / `high`–`xhigh` (debug sulit) |
| 4. Testing/verifikasi | *sama dgn sesi* | `medium` (jalankan+rekam) / `low` (transkripsi) |

Klasifikasi D1–D4 mengacu pada `2026-09-15_proposal-hermes-specialist-session-lifecycle-and-memo-policy.md` §9.

---

## 6. Sebaran ringkas (siapa memikul apa)

| Model | Memikul | Frekuensi |
|---|---|---|
| **Sonnet 5** | FMN (3 scope), ARC revisi, ARC closure scoring, AUD critic (saat review D1/D2), DEV D1/D2 | **Mayoritas volume** — workhorse |
| **Opus 5** | ARC interview+draft, AUD critic (saat review D3), AUD verificator, DEV D3 | Puncak reasoning (jarang, bernilai tinggi) |
| **Fable 5.1** | Eskalasi: D3 long-horizon, verifikasi multi-sumber berat | Sangat jarang, gated |
| **Haiku 4.5** | *Tidak ada sub-scope role yang layak* — hanya sub-tugas mekanis (klasifikasi, transkripsi, render template) | Di luar mandat role |

**Catatan revisi (hasil review Director + Claude, 2026-09-16):** AUD critic tidak lagi flat Sonnet 5 — tier mengikuti tier DEV yang direview, agar critic tidak secara sistematis lebih lemah dari yang direview pada kasus berisiko tinggi (D3). ARC closure scoring dinaikkan ke effort `high` karena bersifat gating decision. Effort DEV eksekusi mengikuti kelas D1/D2/D3, bukan flat `high` untuk semua — praktik lama (selalu Sonnet 5 `high` tanpa memandang kelas) over-provisioned untuk D1 dan under-provisioned (dari sisi tier) untuk D3.

---

## 7. Pemetaan paralel OpenAI ↔ Anthropic (konsistensi internal)

Struktur distribusi identik; yang berubah hanya nama model. Ini uji konsistensi lintas-provider.

| OpenAI | Anthropic | Fungsi |
|---|---|---|
| Luna | Haiku 4.5 | Sub-tugas mekanis |
| Terra | Sonnet 5 | Workhorse mayoritas |
| Sol | Opus 5 | Puncak reasoning |
| Astra | Fable 5.1 | Eskalasi langka |

---

## 8. Keunggulan native Claude Code (relevan langsung untuk Sigma)

DEV spesialis Sigma dijalankan via Claude Code, dan Claude Code sudah punya mekanisme native yang menerapkan pola right-sizing ini:

1. **`opusplan`** — alias hybrid: Opus saat *plan mode*, Sonnet saat *eksekusi*. Persis pola "ceiling kuat saat menyusun rencana, workhorse murah saat mengeksekusi" untuk DEV.
2. **Subagent model routing** — frontmatter `model` + `effort` per subagent (`haiku`/`sonnet`/`opus`), mencegah subagent mewarisi model flagship sesi utama (sumber biaya diam-diam).
3. **`advisor` tool** — model lebih kuat meninjau di titik keputusan (sebelum commit, saat error berulang, sebelum selesai), bukan di setiap turn — analog native untuk review AUD/FMN.

---

## 9. Anti-pattern "overpower"

1. Effort `high`/`xhigh` pada tugas yang sudah jelas — reasoning token tak terlihat.
2. Feeding codebase penuh berulang tanpa cache — gunakan task envelope + caching.
3. Ganti model di tengah sesi DEV — cache reset.
4. Menaikkan tier "biar aman" alih-alih menaikkan effort — salah knob.
5. **Subagent mewarisi model flagship** — set `CLAUDE_CODE_SUBAGENT_MODEL` / frontmatter `model` per subagent.

---

## 10. Keputusan Director yang masih terbuka

1. Ambang D1/D2/D3 untuk DEV (pemisah Sonnet/Opus/Fable).
2. Default effort per sub-scope (mayoritas `medium`, `high` di tiga sub-scope, `xhigh` di tiga puncak).
3. Budget keras per task (circuit breaker) per role.
4. Validasi empiris — pilot kecil per sub-scope sebelum effort difinalkan.
5. Pemanfaatan fitur native (`opusplan`, subagent routing, `advisor`) — dipakai sebagai default atau diuji dulu?

---

## 11. Batas proposal & caveat

- Kolom model + effort adalah *kecenderungan*, bukan konfigurasi final; verifikasi ulang terhadap dashboard/versi CLI saat implementasi.
- **Klaim kenaikan harga Sonnet 5 ke $3/$15 per 1 Sep 2026 belum terverifikasi terhadap sumber resmi Anthropic** (lihat §1) — jangan dipakai sebagai dasar kalkulasi budget sebelum dicek ulang.
- **Perbandingan biaya lintas-provider belum apple-to-apple.** Claude 4.7+ memakai tokenizer baru (~30% lebih banyak token untuk teks sama vs Sonnet 4.6 dan sebelumnya) — per-token price tidak bisa dibandingkan langsung dengan OpenAI tanpa koreksi. Ini dicatat untuk perbandingan lintas-provider nanti.
- `opusplan`/`advisor`/subagent-routing adalah fitur bergerak cepat (butuh versi Claude Code tertentu; sebagian belum tersedia di Bedrock/Vertex/Foundry).
- Belum menyentuh subscription aktif maupun routing per role — ditanyakan ke Director saat akan dipakai nyata.
