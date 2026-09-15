# Implementation Plans — Sigma ↔ Hermes Integration

**Status folder ini:** kumpulan **draft plan** untuk review Director. Tidak ada satu pun yang IMPLEMENTED. Tidak ada eksekusi kode sampai Director menyetujui plan yang relevan secara eksplisit.

**Rantai dokumen:**

```
Discussion/2026-09-12_research-hermes-agent-integration.md
Discussion/2026-09-12_design-hermes-sigma-project-scoped-governance.md
Discussion/2026-09-12_proposal-hermes-inherited-role-behavior-persona-memory.md
Discussion/2026-09-12_proposal-hermes-security-boundaries.md
        │  (desain/prinsip)
        ▼
Discussion/2026-09-15_proposal-hermes-sigma-integration-setup-guide.md
        │  (guide teknis, ditulis Hermes, dikoreksi Claude 2026-09-15)
        ▼
Implementation/hermes/*.md   ← folder ini (plan konkret per fase, untuk direview lalu dieksekusi)
```

## Kenapa hanya Phase 0 dan Phase 1 yang punya plan detail

Guide (`2026-09-15_proposal-hermes-sigma-integration-setup-guide.md` §7) menyebut lima fase. Folder ini baru berisi plan rinci untuk **Phase 0** dan **Phase 1** karena keduanya adalah satu-satunya fase yang:

1. Tidak bergantung pada keputusan Director yang masih terbuka di dokumen desain manapun, dan
2. Cakupannya bisa ditentukan sepenuhnya dari kondisi yang sudah terverifikasi (source code Sigma, binary Hermes yang terinstal).

Phase 2–4 **sengaja belum** dibuatkan plan teknis rinci — membuatnya sekarang berarti menebak keputusan yang belum Director putuskan (lihat daftar di bawah), yang melanggar prinsip "jangan berasumsi tanpa konfirmasi". Ringkasannya:

| Fase | Isi (ringkas dari guide §7) | Kenapa belum di-plan rinci |
| :--- | :--- | :--- |
| **Phase 0** | MCP read-only lab | ✅ Ada plan: `PLAN-IMPL-HERMES-PHASE0-MCP-ORIENTATION-20260915.md` |
| **Phase 1** | Skills + project binding | ✅ Ada plan: `PLAN-IMPL-HERMES-PHASE1-SKILLS-AND-BINDING-20260915.md` |
| **Phase 2** | DEV sandbox (Docker/worktree) | Menunggu: versi Hermes yang di-pin, dan `hermes config check` real terhadap key sandbox (`terminal.*`, `container_*`) yang riset 2026-09-12 sendiri tandai perlu diverifikasi ulang per versi |
| **Phase 3** | Mailbox dispatcher + Telegram | Menunggu: desain claim/lease mailbox (`UNREAD → CLAIMED → READ`) belum ada — ini perubahan skema Sigma yang butuh keputusan Director tersendiri, bukan sekadar wiring; juga menunggu keputusan channel Director-facing (§10 dokumen design, belum dijawab) |
| **Phase 4** | Delegasi Claude Code / Codex via Hermes | Menunggu: Phase 2–3 selesai dan stabil (dispatcher harus ada dulu sebelum delegasi bertingkat masuk akal) |

Saat Director siap memutuskan salah satu dari Phase 2–4, minta plan detailnya dibuat terpisah — jangan diasumsikan dari dokumen ini.

## Prasyarat lintas-fase yang masih terbuka

Kedua plan (`Phase 0` dan `Phase 1`) sama-sama menunggu jawaban dua hal ini sebelum eksekusi dimulai:

1. **Profile Hermes mana yang dipakai untuk lab** — profile `default` yang sudah tersambung DeepSeek, atau profile baru khusus Sigma (rekomendasi: baru, demi isolasi, sesuai `2026-09-12_proposal-hermes-security-boundaries.md` §5.1).
2. **Proyek mana yang jadi lab.** `sigma-ecosystem` (repo ini) **bukan kandidat** — ia adalah source Sigma sendiri, bukan proyek yang dikelola Sigma (tidak ada `Sigma/progress-v<N>.json` chain aktif, tidak ada `.sigma-identity.json`). Perlu proyek terpisah yang sudah `sigma project start`.

## Diagram

`ROADMAP.md` — peta visual (Mermaid) fase pengembangan Phase 0–4 plus urutan konfigurasi Hermes yang dipasangkan dengan langkah testing-nya, dengan status warna berdasarkan kondisi mesin yang sudah diverifikasi 2026-09-15.

## Cara membaca dua plan yang sudah ada

- Baca `PLAN-IMPL-HERMES-PHASE0-MCP-ORIENTATION-20260915.md` dulu — nol perubahan kode Sigma, murni konfigurasi Hermes + verifikasi. Hasilnya (nama tool MCP sebenarnya) jadi prasyarat input Phase 1.
- `PLAN-IMPL-HERMES-PHASE1-SKILLS-AND-BINDING-20260915.md` berisi perubahan kode nyata di `src/commands/setup.ts` dan `src/utils/detect.ts`, plus temuan baru yang tidak ada di guide asli (bridge file `AGENTS.md` yang ternyata Codex-branded, bukan netral — lihat §3 di plan tersebut).

Setiap plan punya bagian "Keputusan Director yang masih terbuka" di bagian akhir — itu yang perlu dijawab sebelum saya mulai coding.
