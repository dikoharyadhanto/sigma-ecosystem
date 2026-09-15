# Sigma MCP Implementation

Folder ini berisi plan canonical untuk menjadikan Sigma MCP sebagai interface governance terstruktur bagi seluruh consumer AI—Sigma AI roles (ARC/FMN/DEV/AUD), orchestrator seperti Hermes, dan client MCP lain—tanpa menjadikan runtime/model sebagai sumber authority.

## Status

| Dokumen | Status |
|---|---|
| `PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` | APPROVED (Batch 1) — Director menyetujui eksekusi 2026-09-15; keputusan Q1–Q6 tercatat di §21.1 |
| `SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md` | Stage 0 deliverable — klasifikasi 59 operasi registry |
| `RESULT-IMPL-SIGMA-MCP-BATCH1-20260915.md` | Batch 1 + review Codex — Gate 0.5/B1 REOPENED, perbaikan R-01…R-09 selesai, R-05 menunggu keputusan Director |

## Urutan eksekusi

1. **Batch 1:** Stage 0 + Stage A + Stage B1 — inventory, contract/binding hardening, effective policy, dan bounded artifact query.
2. Review hasil Batch 1 terhadap test contract dan compatibility consumer.
3. **Batch 2:** Stage C — bounded command pilot, hanya setelah hasil Batch 1 diterima Director.
4. Review mutation, idempotency, concurrency, dan audit evidence.
5. **Batch 3:** Stage D — governance transition pilot, hanya setelah approval primitive dan keputusan Director dikonfirmasi.
6. Stage E menambah registry parity secara inkremental; bukan blanket exposure seluruh operasi.

Perintah “implementasikan plan” tanpa perluasan scope eksplisit berarti **Batch 1 saja**. Control/write tool tidak boleh diaktifkan sebagai efek samping Batch 1.

## Relasi Hermes

Hermes adalah consumer/integration fixture pertama, bukan owner kontrak MCP. Evidence Phase 0 dan policy profile Hermes tetap berada di `../hermes/`; implementasi inti, contract, dan test consumer-neutral berada di folder ini.
