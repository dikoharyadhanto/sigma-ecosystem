# Implementation Plans — Sigma ↔ Hermes Integration

**Status folder ini:** Phase 0 **IMPLEMENTED / PASS** pada 2026-09-15; plan lintas-fase Sigma MCP Query/Command Plane dan Phase 1 masih DRAFT untuk review Director. Tidak ada perubahan kode Sigma pada Phase 0.

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

## Plan yang tersedia

| Plan | Status | Fungsi |
|---|---|---|
| Phase 0 — MCP Orientation | IMPLEMENTED / PASS | Membuktikan enam query MCP, non-mutation, dan environment isolation |
| Sigma MCP Query/Command Plane | DRAFT | Plan platform consumer-neutral di `../sigma-mcp/`; Gate 0.5 binding/contract, query expansion, bounded write, dan governance transition |
| Phase 1 — Skills + Project Binding | DRAFT | Behaviour skills Hermes, bridge, dan binding workflow lab |

## Kenapa Phase 2–4 belum punya plan detail

Guide (`2026-09-15_proposal-hermes-sigma-integration-setup-guide.md` §7) menyebut lima fase. Folder ini berisi plan rinci untuk **Phase 0**, plan lintas-fase MCP, dan **Phase 1**. Plan MCP tidak menggantikan plan Phase 2–4; ia menentukan boundary interface yang dipakai oleh fase-fase tersebut.

1. Phase 0 merupakan eksperimen read-only yang batasnya dapat ditentukan dari binary Hermes dan source Sigma yang sudah tersedia; keputusan lab dasarnya sudah dijawab Director.
2. Phase 1 adalah consumer langsung evidence Phase 0 dan perubahan kodenya sudah dapat dipetakan, walaupun belum boleh difinalkan sebelum evidence serta keputusan teknis Phase 1 tersedia.

Phase 2–4 **sengaja belum** dibuatkan plan teknis rinci — membuatnya sekarang berarti menebak keputusan yang belum Director putuskan (lihat daftar di bawah), yang melanggar prinsip "jangan berasumsi tanpa konfirmasi". Keputusan dasar Phase 0 sendiri sudah dijawab Director pada 2026-09-15; Phase 1 tetap menunggu hasil empiris Phase 0 dan keputusan teknisnya sendiri. Ringkasannya:

| Fase | Isi (ringkas dari guide §7) | Kenapa belum di-plan rinci |
| :--- | :--- | :--- |
| **Phase 0** | MCP read-only lab | ✅ IMPLEMENTED / PASS — plan dan `RESULT-HERMES-PHASE0-MCP-ORIENTATION-20260915.md` |
| **Gate 0.5** | MCP binding + contract hardening | ✅ Ada dalam `../sigma-mcp/PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md`; wajib sebelum gateway diberi capability Sigma, multi-project/control MCP, tetapi tidak memblokir skill lab Phase 1 |
| **Phase 1** | Skills + project binding | ✅ Ada plan: `PLAN-IMPL-HERMES-PHASE1-SKILLS-AND-BINDING-20260915.md` |
| **Phase 2** | DEV sandbox (Docker/worktree) | Menunggu: versi Hermes yang di-pin, dan `hermes config check` real terhadap key sandbox (`terminal.*`, `container_*`) yang riset 2026-09-12 sendiri tandai perlu diverifikasi ulang per versi |
| **Phase 3** | Mailbox dispatcher + Telegram | Menunggu: desain claim/lease mailbox (`UNREAD → CLAIMED → READ`) belum ada — ini perubahan skema Sigma yang butuh keputusan Director tersendiri, bukan sekadar wiring; juga menunggu keputusan channel Director-facing (§10 dokumen design, belum dijawab) |
| **Phase 4** | Delegasi Claude Code / Codex via Hermes | Menunggu: Phase 2–3 selesai dan stabil (dispatcher harus ada dulu sebelum delegasi bertingkat masuk akal) |

Saat Director siap memutuskan salah satu dari Phase 2–4, minta plan detailnya dibuat terpisah — jangan diasumsikan dari dokumen ini.

## Baseline lab yang sudah diputuskan

Director menyetujui baseline berikut pada 2026-09-15:

1. Gunakan profile baru terisolasi bernama **`sigma-lab`**, bukan profile personal `default`.
2. Gunakan proyek Sigma disposable baru tanpa secret/data produksi. `sigma-ecosystem` tetap bukan proyek lab.
3. Pisahkan Slack dari Gate 0 MCP; gateway berjalan sebagai track paralel dengan test contract tersendiri.

Phase 0 tidak memiliki open question Director dan sudah selesai. Evidence Phase 0 tersedia; Phase 1 tetap menunggu keputusan pada §8 plan Phase 1.

## Diagram

`ROADMAP.md` — peta visual (Mermaid) fase pengembangan Phase 0–4 plus urutan konfigurasi Hermes yang dipasangkan dengan langkah testing-nya, dengan status warna berdasarkan kondisi mesin yang sudah diverifikasi 2026-09-15.

## Cara membaca plan yang sudah ada

- Baca `PLAN-IMPL-HERMES-PHASE0-MCP-ORIENTATION-20260915.md` dulu — nol perubahan kode Sigma, murni konfigurasi Hermes + verifikasi. Hasilnya (nama tool MCP sebenarnya) jadi prasyarat input Phase 1.
- Baca `../sigma-mcp/PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` untuk arah platform MCP seluruh AI role/orchestrator. Increment A adalah Gate 0.5 Hermes; bounded write dan governance transition tetap gated serta disabled by default.
- `PLAN-IMPL-HERMES-PHASE1-SKILLS-AND-BINDING-20260915.md` berisi perubahan kode nyata di `src/commands/setup.ts` dan `src/utils/detect.ts`, plus temuan baru yang tidak ada di guide asli (bridge file `AGENTS.md` yang ternyata Codex-branded, bukan netral — lihat §3 di plan tersebut).

Setiap plan punya bagian "Keputusan Director yang masih terbuka" di bagian akhir — itu yang perlu dijawab sebelum saya mulai coding.
