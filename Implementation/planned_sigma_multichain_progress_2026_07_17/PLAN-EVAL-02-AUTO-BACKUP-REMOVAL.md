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
  `backupFile(progressPath, logsDir)` ([project.ts:156](../../src/commands/project.ts#L156)).
- `sigma project sync` — hapus direktori
  `Sigma/logs/sync-backup-<timestamp>/` ([project.ts:408](../../src/commands/project.ts#L408)).
- **Mekanisme ketiga, ditemukan PLAN-EVAL-01 Fase 4 (2026-07-17), tidak ada
  di DISCUSSION doc asli** — `sigma doctor --reconstruct` juga membackup
  `progress.json` lama sebelum menimpanya:
  `reconstruct-backup-<timestamp>.json` di `Sigma/logs/`
  ([doctor.ts:126](../../src/commands/doctor.ts#L126)). PLAN-EVAL-01 sengaja
  tidak menghapusnya (di luar scope-nya), tapi mencatatnya eksplisit di sini
  supaya tidak lolos audit — **update baris di atas: hapus 3 mekanisme,
  bukan 2**.
- Ganti dengan guard: operasi berisiko menolak/memperingatkan jalan kalau
  working tree git untuk `Sigma/` belum bersih (belum di-commit). Rollback
  jadi `git checkout`, bukan restore dari `.bak`.

## Catatan konteks dari PLAN-EVAL-01 (2026-07-17, agar plan-eval ini tidak perlu menemukan ulang)

- **`doctor.ts`'s `--reconstruct` handler dan seluruh `reconstruct.ts` masih
  100% di jalur lama** (`ProgressJson`/`progress.ts`) — PLAN-EVAL-01 tidak
  memigrasikannya sama sekali (itu scope PLAN-EVAL-05, lihat dokumen itu).
  Artinya baris `doctor.ts:126` di atas **masih ada persis seperti
  sekarang** sampai PLAN-EVAL-05 benar-benar mengerjakan migrasinya — plan-eval
  ini (02) boleh menghapus baris backup itu duluan tanpa menunggu
  PLAN-EVAL-05, karena letaknya independen dari isi algoritma reconstruct
  itu sendiri (cuma soal ada-tidaknya backup, bukan soal format data).
- `progress.ts` sudah dirampingkan drastis oleh PLAN-EVAL-01 (dari 1313 baris
  jadi ~250) — HANYA menyisakan yang dipakai jalur legacy `--reconstruct`.
  Import `backupFile` di `project.ts:37` **tidak dipakai fungsi lain**
  selain 2 baris yang dihapus plan-eval ini — begitu keduanya hilang,
  import itu ikut jadi dead code, hapus juga.
- `sigma project start` sekarang juga menulis `Sigma/activate_status.json`
  (PLAN-EVAL-01 Fase 4) di titik yang sama persis dengan penulisan
  `progress.json` lama — pastikan guard git-clean-tree yang menggantikan
  backup di `--reinit` mempertimbangkan file baru ini juga kalau relevan
  (tidak wajib, tapi periksa saat implementasi).

## Di luar scope

- Tidak menyentuh `Sigma/logs/operations.jsonl` (log operasi, bukan
  backup — [feedback-no-auto-backup memory]).
- Tidak menyentuh mekanisme apa pun di luar `project.ts`/`doctor.ts` yang
  teridentifikasi di DISCUSSION doc + temuan PLAN-EVAL-01 di atas.
- Migrasi `--reconstruct` itu sendiri ke `chain.ts` — PLAN-EVAL-05.

## Kenapa dipisah dari PLAN-EVAL-01

Sepenuhnya independen secara teknis dari storage multi-chain — bisa
dikerjakan lebih dulu, bersamaan, atau setelahnya tanpa saling blocking.
Ditaruh di urutan #2 murni karena PLAN-EVAL-03 (migrasi JLH) butuh
kebijakan "no backup, git-clean-tree guard" ini sudah diputuskan dulu.

## Risiko

Kecil — mengurangi kode, bukan menambah. Risiko utama cuma memastikan tidak
ada test yang masih mengasumsikan file backup dibuat.
