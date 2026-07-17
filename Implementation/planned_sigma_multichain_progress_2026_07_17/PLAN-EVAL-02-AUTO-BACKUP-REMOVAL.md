# PLAN-EVAL-02 — Auto-Backup Mechanism Removal

**Sumber**: [DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md) (Konsolidasi Lanjutan bagian 13)
**Tanggal**: 2026-07-17
**Status**: DRAFT — detail implementasi final sudah disusun di bawah (Professional Mode, verifikasi langsung terhadap kode nyata `src/`). **Belum diimplementasikan** — menunggu approval eksplisit Director sebelum eksekusi kode.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

Director menolak pola "backup dulu sebelum operasi berisiko" secara umum —
dalam praktiknya berujung jadi dump file yang tidak pernah direstore.
Artifact Sigma sudah ter-*track* git, jadi safety net sebenarnya sudah
gratis lewat `git diff`/`git checkout --`.

**Klarifikasi final Director (2026-07-17)**: safety net git yang jadi
justifikasi keputusan ini **tidak bergantung pada remote/GitHub sama
sekali** — cukup local commit history. Yang penting diselamatkan bukan
"sistem backup Sigma" itu sendiri (Director eksplisit tidak peduli soal
itu), tapi Sigma artifact (histori pencatatan progress project) —
dan itu sudah otomatis aman selama artifact-nya ada & ter-*commit* secara
lokal, terlepas dari backup mekanis apa pun. Konsekuensinya: **tidak perlu
guard/warning/blocking pengganti apa pun** — penghapusan murni, tanpa
mekanisme replacement. (Draf sebelumnya sempat mengusulkan guard
git-clean-tree dengan flag `--force` sebagai pengganti; usulan itu
**ditolak eksplisit** oleh Director pada ronde ini — dicatat di bawah
sebagai riwayat keputusan, bukan untuk diimplementasikan.)

**Keputusan**: tidak boleh ada operasi Sigma manapun yang menjalankan backup
artifact apa pun — termasuk mekanisme yang **sudah ada hari ini**, bukan
cuma untuk fitur baru. **Tidak ada penggantinya** — murni penghapusan.

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
- **Tidak ada guard/replacement mekanisme apa pun** — bukan git-clean-tree
  check, bukan warning, bukan flag `--force`. Murni penghapusan kode.
  Rollback tetap bisa lewat `git checkout`/`git diff` biasa selama Director
  sendiri sudah men-*commit* Sigma artifact secara rutin — itu tanggung
  jawab kebiasaan kerja Director, bukan sesuatu yang CLI perlu tegakkan.

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
  `progress.json` lama. **Tidak lagi relevan** setelah keputusan "tanpa
  guard" — dicatat di draf sebelumnya sebagai pertimbangan untuk guard
  git-clean-tree, sekarang gugur bersama penolakan guard itu sendiri.

## Di luar scope

- Tidak menyentuh `Sigma/logs/operations.jsonl` (log operasi, bukan
  backup — [feedback-no-auto-backup memory]).
- Tidak menyentuh mekanisme apa pun di luar `project.ts`/`doctor.ts` yang
  teridentifikasi di DISCUSSION doc + temuan PLAN-EVAL-01 di atas.
  **Verifikasi 2026-07-17**: ada mekanisme backup keempat di kode,
  `setup.ts:304-317` (`sigma setup install`/`update` — backup
  `~/.sigma/{templates,rules,governance,bridge}` ke
  `~/.sigma/backups/<timestamp>/` sebelum overwrite). Ini **sengaja tidak
  disentuh** — target-nya `~/.sigma/` (instalasi global CLI di luar
  project), bukan artifact project yang ter-*track* git per-project seperti
  yang jadi justifikasi Director (`~/.sigma/` sendiri biasanya bukan repo
  git). Beda kategori dari 3 mekanisme di atas, dicatat di sini eksplisit
  supaya jelas ini keputusan sadar, bukan terlewat.
- Migrasi `--reconstruct` itu sendiri ke `chain.ts` — PLAN-EVAL-05.
- **Guard git-clean-tree (`src/utils/git.ts`, flag `--force`)** — diusulkan
  di draf sebelumnya, **ditolak eksplisit Director** pada ronde final
  (2026-07-17): "tidak perlu dibuat warning atau mekanisme block". Tidak
  jadi bagian implementasi plan-eval ini sama sekali.

## Kenapa dipisah dari PLAN-EVAL-01

Sepenuhnya independen secara teknis dari storage multi-chain — bisa
dikerjakan lebih dulu, bersamaan, atau setelahnya tanpa saling blocking.
Ditaruh di urutan #2 murni karena PLAN-EVAL-03 (migrasi JLH) butuh
kebijakan "no backup" ini sudah diputuskan dulu.

---

## Rencana Implementasi Detail (2026-07-17, final)

Disusun setelah membaca ulang `project.ts`, `doctor.ts`, `utils/fs.ts`, dan
seluruh test suite (`test/*.ts`) yang menyentuh ketiga mekanisme di atas.
Semua nomor baris dan nama fungsi di bawah sudah diverifikasi terhadap
kode nyata pada tanggal ini, bukan asumsi. **Tidak ada mekanisme
pengganti** — setiap perubahan di bawah adalah penghapusan murni.

### 1. Perubahan `src/utils/fs.ts`

- Hapus fungsi `backupFile()` ([fs.ts:18-27](../../src/utils/fs.ts#L18-L27))
  sepenuhnya. Diverifikasi: satu-satunya pemanggil adalah
  `project.ts:156` (dihapus di langkah berikutnya) — begitu itu hilang,
  fungsi ini dead code.

### 2. Perubahan `src/commands/project.ts`

- Hapus `backupFile` dari import di baris 37 (sisakan `ensureDir`,
  `fileExists`, `findProjectRoot`).
- **`runStart` (reinit branch, [project.ts:148-158](../../src/commands/project.ts#L148-L158))**:
  hapus
  ```ts
  ensureDir(logsDir);
  const backed = backupFile(progressPath, logsDir);
  warn(`Existing progress.json backed up to: ${backed}`);
  ```
  tanpa penggantinya — blok `if (fileExists(progressPath)) { if (!opts.reinit) { error(...) } }`
  tetap ada (guard "harus pakai --reinit" itu bukan bagian dari mekanisme
  backup, tetap dipertahankan), hanya 3 baris backup di dalamnya yang
  hilang. Variabel `logsDir` di baris 146 jadi tidak terpakai lagi di
  manapun dalam `runStart` (satu-satunya pemakaian lain adalah `SUBFOLDERS`
  loop yang sudah membuat `Sigma/logs/` sendiri, dan
  `ensureOperationsLog()` yang menghitung path log-nya sendiri) — hapus
  deklarasinya juga.
- Update deskripsi opsi `--reinit` (baris 521, saat ini
  *"Re-initialize an existing Sigma project (backs up progress.json)"*)
  jadi *"Re-initialize an existing Sigma project"* — hapus klaim backup
  yang sudah tidak benar.
- **`runSync` ([project.ts:375-459](../../src/commands/project.ts#L375-L459))**:
  hapus seluruh blok backup, tanpa penggantinya:
  - Baris 406-409 (`timestamp`/`backupDir`/`ensureDir(backupDir)`).
  - Setiap `fs.copySync(f.dest/dest, path.join(backupDir, ...))` mirror-copy
    sebelum overwrite (5 titik: pasangan constitution/protocol di loop
    `filesToSync`, `rules/`, `SIGMA-OPERATION-REGISTRY.json`,
    `SIGMA-REGISTRY.json`, `role-memory/`).
  - Baris 458 (`console.log(\`  Backup saved to: ${backupDir}\`)`).
  Sisa logika (dry-run di atasnya, loop overwrite file, ringkasan
  `updated[]` di akhir) tidak berubah. Variabel `logsDir` (baris 378) jadi
  tidak terpakai lagi setelah `backupDir` hilang — hapus.

### 3. Perubahan `src/commands/doctor.ts`

- **`runReconstruct` ([doctor.ts:117-129](../../src/commands/doctor.ts#L117-L129))**:
  hapus blok
  ```ts
  if (fs.existsSync(progressPath)) {
    const logsDir = path.join(projectRoot, PROJECT_SIGMA_DIR, 'logs');
    ensureDir(logsDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(logsDir, `reconstruct-backup-${timestamp}.json`);
    fs.copySync(progressPath, backupPath);
    console.log(`Existing progress.json backed up to: ${path.relative(projectRoot, backupPath)}`);
  }
  ```
  seluruhnya, tanpa penggantinya. `reconstructProgress()`/`writeProgress()`
  di baris setelahnya tidak berubah.
- Import `ensureDir` dari `../utils/fs` (baris 7) jadi tidak terpakai
  setelah blok di atas hilang (satu-satunya pemakaian) — hapus dari
  import, sisakan `findProjectRoot`.

### 4. Rencana test

**Test yang sudah ada, wajib disesuaikan** (satu-satunya yang perlu
berubah — sudah diverifikasi lewat pencarian, tidak ada test lain yang
menyentuh `--reinit` atau `project sync` sama sekali hari ini):

- [test/reconstruct.test.ts:83-100](../../test/reconstruct.test.ts#L83-L100)
  (`'recovers project identity from --id/--name and backs up an unreadable
  progress.json'`) — assertion `toMatch(/backed up to/i)` dan pengecekan
  file `reconstruct-backup-*` di `logsDir` **dihapus**. Ganti dengan:
  - Judul test diperbarui (tidak lagi menyebut "backs up").
  - Assertion exit 0 + `project_id`/`project_name` benar tetap
    dipertahankan (bagian yang diuji bukan backup-nya, tapi kemampuan
    recovery identity dari progress.json yang rusak).
  - Assertion baru: `fs.readdirSync(logsDir)` **tidak** mengandung file apa
    pun berpola `*-backup-*` — bukti positif mekanisme benar-benar hilang,
    bukan cuma tidak dicek.
- Verifikasi seluruh test lain yang memanggil `project start --confirm`
  (`lifecycle-hardening.test.ts`, `reference-list.test.ts`,
  `role-memory-bootstrap.test.ts`) **tidak terpengaruh** — sudah diperiksa:
  ketiganya memakai `project start --confirm` tanpa `--reinit` pada
  project yang belum ada `progress.json` sebelumnya, jalur yang diubah di
  atas sama sekali tidak tereksekusi di sana.

Tidak ada test baru yang perlu ditulis — tanpa guard/flag baru, tidak ada
perilaku baru untuk diuji. Cakupan test sebelum & sesudah perubahan ini
seharusnya identik kecuali satu test di atas.

### 5. Urutan eksekusi implementasi (fase)

1. `src/utils/fs.ts` — hapus `backupFile()`.
2. `src/commands/doctor.ts` — hapus blok backup `--reconstruct` + import
   `ensureDir` yang jadi dead code.
3. `src/commands/project.ts` — hapus import `backupFile`, blok backup
   `--reinit`, blok backup `sync`, variabel `logsDir` yang jadi dead code
   di kedua fungsi, update deskripsi opsi `--reinit`.
4. Perbarui `test/reconstruct.test.ts` (§4).
5. `npm run build && npm test` penuh — pastikan seluruh test lama (160+)
   tetap hijau, termasuk satu test yang diperbarui.

### 6. Risiko & mitigasi

- Kecil — murni pengurangan kode, tidak ada logika baru yang bisa salah.
  Risiko satu-satunya: memastikan tidak ada test lain yang diam-diam
  mengasumsikan file backup dibuat — **sudah diverifikasi lewat pencarian
  menyeluruh** (`backupFile`, `backup`, `reinit`, `sync-backup`,
  `reconstruct-backup` di seluruh `test/`), hasilnya hanya satu titik
  (§4 di atas).
- Tidak ada risiko dari sisi guard/warning karena memang tidak ada yang
  ditambahkan.

---

## Langkah selanjutnya

Plan ini sekarang final dan siap dieksekusi menunggu approval eksplisit
Director — tidak ada lagi keputusan desain terbuka (guard git-clean-tree
sudah ditolak dan dihapus dari rencana).
