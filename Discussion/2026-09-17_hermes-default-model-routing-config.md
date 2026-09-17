# HERMES — Default Model Routing Config (catatan historis diskusi)

- **Tanggal:** 2026-09-17
- **Status:** **Snapshot diskusi — bukan file live.** Semua `[OPEN]` di bawah sudah diselesaikan pada tanggal yang sama; hasil akhirnya dipindah ke file operatif `2026-09-17_hermes-model-routing-config.yaml`. Director memutuskan format live memakai YAML (bukan Markdown) karena preview Markdown tidak bisa diedit langsung sementara raw source-nya merepotkan. **Mulai file YAML itu ada, jangan edit file ini lagi** — nilai routing yang berlaku ada di YAML; file ini dipertahankan sebagai rekam jejak alasan di balik tiap keputusan.
- **Asal:** Hasil diskusi lanjutan atas `2026-09-17_proposal-hermes-director-model-routing-checkpoint.md`.

Aturan **kapan sesi DEV boleh/harus berakhir** (dan karenanya kapan model boleh dipertimbangkan ulang) **tidak diulang di file ini** — itu berlaku dari `2026-09-15_proposal-hermes-specialist-session-lifecycle-and-memo-policy.md` §5–§6. Ringkasnya: model tetap sama sepanjang satu sesi/mandat DEV aktif, effort yang bervariasi mengikuti kelas D dan aktivitas; sesi baru (dan model boleh berbeda) hanya dipicu oleh sinyal konkret — scope selesai, blocker material, dua kali gagal diagnosis/fix tanpa kemajuan, perlu ubah scope/plan/API/schema, atau handoff ke role lain (termasuk pre-build/post-build review FMN).

---

## Routing per role dan scope

*(Kolom Provider/Model/Effort diisi Director. Baris dan sub-scope mengikuti struktur yang sudah disepakati — `2026-09-16_proposal-anthropic-model-role-mapping-cost-balance.md` §4–§5.)*

### ARC — beda model antar sesi (per sub-scope, masing-masing sudah sesi terpisah secara alami) — provider Anthropic

| Sub-scope | Provider | Model | Effort | Catatan |
|---|---|---|---|---|
| 1. Interview + draft DIR-INTENT | Anthropic | Claude Opus 5 | high | |
| 2. Revisi intent pasca-audit | Anthropic | Claude Sonnet 5 | medium | |
| 3. Closure scoring | Anthropic | Claude Sonnet 5 | high | Gating decision — salah skor lebih mahal dari effort tambahan. |
| 4. Amandemen proses | Anthropic | Claude Sonnet 5 | medium | Sesi baru terpisah dari FMN/DEV yang berjalan (fase implementasi+amendment). `[OPEN]` — apakah selalu medium terlepas dari besar-kecilnya amandemen, atau bisa naik ke high untuk amandemen besar (mirip closure scoring)? |

### FMN — beda model antar sesi (per sub-scope) — provider DeepSeek

| Sub-scope | Provider | Model | Effort | Catatan |
|---|---|---|---|---|
| 1. Draft FMN-PLAN | DeepSeek | DeepSeek Flash | high | |
| 2. Revisi plan pasca-audit | DeepSeek | DeepSeek Flash | medium | |
| 3. Review DEV-EXEC (pre-build & post-build) | DeepSeek | DeepSeek Flash | medium | Pre-build dan post-build sama-sama medium. |

### DEV — satu model per sesi/mandat aktif; effort bervariasi per sub-scope — provider Anthropic

| Sub-scope | Provider | Model | Effort | Catatan |
|---|---|---|---|---|
| 1. Draft rencana implementasi | Anthropic | Claude Sonnet 5 | high | |
| 2. Eksekusi + testing/verifikasi | Anthropic | Claude Sonnet 5 | high | Digabung sengaja (2026-09-17) — keduanya lazim satu sesi tanpa handoff di antaranya, tidak boleh diinterupsi hanya untuk ganti model di tengah jalan. |
| 3. Fix bug/gap | Anthropic | Claude Sonnet 5 | medium | Umumnya terjadi setelah post-build review FMN — sejalan dengan trigger "handoff ke role lain" (sesi baru, scope sudah lebih sempit). |

**Eskalasi (diselesaikan 2026-09-17):** Sonnet 5 adalah default di semua sub-scope di atas — bukan karena D3 tidak ada, tapi karena Opus 5 sebagai *default* akan cepat menguras usage limit, sementara secara frekuensi mayoritas kerja DEV cukup terlayani Sonnet 5 `high`. Opus 5 tetap dipakai untuk kasus kompleks/berat (D3) — tapi sebagai **eskalasi sadar**, bukan baseline. Titik eskalasi mengikuti sinyal sesi yang sudah disepakati: teridentifikasi berat sejak awal (mis. saat draft rencana implementasi atau pre-build review FMN sudah menandai kompleksitas tinggi), atau ditemukan di tengah jalan lewat circuit breaker (dua kali gagal fix tanpa kemajuan → sesi baru → boleh naik ke Opus 5 di sesi itu).

Fallback DEV (saat Sonnet 5 tidak tersedia sama sekali, bukan soal eskalasi kompleksitas): sebisa mungkin dihindari lari ke provider lain; bila terpaksa, ikuti urutan di bagian Fallback Chain di bawah.

### AUD — provider OpenAI via OpenCode Zen; sama untuk kedua mode

| Mode | Provider | Model | Effort | Catatan |
|---|---|---|---|---|
| Critic (review output DEV) | OpenAI (OpenCode Zen) | GPT-Terra-5.6 | high | |
| Verificator | OpenAI (OpenCode Zen) | GPT-Terra-5.6 | high | |

**Catatan (diselesaikan 2026-09-17):** Terra (workhorse-tier, bukan Sol/peak-tier) dipilih sengaja untuk AUD karena jalur ini lewat OpenCode Zen = API berbayar per token, dan Sol dikhawatirkan mahal untuk pemakaian rutin. Bila Director sedang punya Codex subscription aktif, AUD bisa diarahkan ke Codex CLI dengan model setara Sol tanpa kekhawatiran biaya (tercakup subscription, bukan metered API) — ini bukan aturan otomatis, cukup Director edit baris di atas secara manual saat kondisi itu berlaku, sesuai prinsip satu file/satu rujukan (§1 proposal checkpoint).

---

## Fallback chain

*(Opsional — diisi Director bila ingin urutan preferensi eksplisit per role saat default tidak tersedia. Kosong berarti HERMES selalu kembali bertanya ke Director, tanpa urutan otomatis.)*

| Role | Urutan fallback |
|---|---|
| ARC | |
| FMN | |
| DEV | |
| AUD | |

---

## Referensi (tidak diduplikasi di sini)

- Mekanisme baca file ini, batas peringatan HERMES, dan sinyal limit/gangguan/status subscription: `2026-09-17_proposal-hermes-director-model-routing-checkpoint.md` §1–§6.
- Aturan sesi/circuit breaker DEV: `2026-09-15_proposal-hermes-specialist-session-lifecycle-and-memo-policy.md` §5–§6, §9.
- Struktur sub-scope per role dan logika right-sizing: `2026-09-16_proposal-anthropic-model-role-mapping-cost-balance.md` (dan proposal setara untuk provider lain).
