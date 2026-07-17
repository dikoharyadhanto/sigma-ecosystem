# PLAN-EVAL-02 — Auto-Backup Mechanism Removal

**Sumber**: [DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md) (Konsolidasi Lanjutan bagian 13)
**Tanggal**: 2026-07-17
**Status**: DRAFT — ringkas, belum didetailkan. Prioritas #2 — independen dari multi-chain, bisa jalan kapan saja, tapi ditaruh sebelum PLAN-EVAL-03 karena jadi prasyarat konseptual pola rollback migrasi.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

Director menolak pola "backup dulu sebelum operasi berisiko" secara umum —
dalam praktiknya berujung jadi dump file yang tidak pernah direstore.
Artifact Sigma sudah ter-*track* git, jadi safety net sebenarnya sudah
gratis lewat `git diff`/`git checkout --`.

**Keputusan**: tidak boleh ada operasi Sigma manapun yang menjalankan backup
artifact apa pun — termasuk mekanisme yang **sudah ada hari ini**, bukan
cuma untuk fitur baru.

## Scope

- `sigma project start --reinit` — hapus langkah
  `backupFile(progressPath, logsDir)` ([project.ts:145-157](../../src/commands/project.ts#L145-L157)).
- `sigma project sync` — hapus direktori
  `Sigma/logs/sync-backup-<timestamp>/` ([project.ts:404](../../src/commands/project.ts#L404)).
- Ganti dengan guard: operasi berisiko menolak/memperingatkan jalan kalau
  working tree git untuk `Sigma/` belum bersih (belum di-commit). Rollback
  jadi `git checkout`, bukan restore dari `.bak`.

## Di luar scope

- Tidak menyentuh `Sigma/logs/operations.jsonl` (log operasi, bukan
  backup — [feedback-no-auto-backup memory]).
- Tidak menyentuh mekanisme apa pun di luar `project.ts` yang teridentifikasi
  di DISCUSSION doc.

## Kenapa dipisah dari PLAN-EVAL-01

Sepenuhnya independen secara teknis dari storage multi-chain — bisa
dikerjakan lebih dulu, bersamaan, atau setelahnya tanpa saling blocking.
Ditaruh di urutan #2 murni karena PLAN-EVAL-03 (migrasi JLH) butuh
kebijakan "no backup, git-clean-tree guard" ini sudah diputuskan dulu.

## Risiko

Kecil — mengurangi kode, bukan menambah. Risiko utama cuma memastikan tidak
ada test yang masih mengasumsikan file backup dibuat.
