# PLAN-EVAL-05 — Doctor Multi-Chain (`--all-versions`) & Reconstruct

**Sumber**: [DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md) (Konsolidasi Lanjutan bagian 4 & 9)
**Tanggal**: 2026-07-17
**Status**: DRAFT — ringkas, belum didetailkan. Prioritas #5 — tooling pemulihan, tidak memblokir alur kerja harian seperti PLAN-EVAL-04.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

`sigma doctor` **satu-satunya** command yang butuh flag lintas-chain, karena
tugasnya (`runDoctorReconciliation`) adalah **memperbaiki**, bukan cuma
**menampilkan** (beda dari `sigma intent list` yang murni display). Semua
command mutasi lain sengaja tidak diberi flag lintas-chain — akan melanggar
isolasi total antar-chain kalau dipaksakan.

## KOREKSI PENTING (2026-07-17) — scope plan-eval ini lebih besar dari draf awal

PLAN-EVAL-01 (Fase 4, 2026-07-17) sudah memigrasikan **mode default**
`sigma doctor` ke `chain.ts` sepenuhnya — tapi secara sadar **TIDAK**
menyentuh `--reconstruct` sama sekali, dengan alasan yang mengubah gambaran
scope plan-eval ini:

> `discoverArtifacts()` (di `reconstruct.ts`) pada dasarnya memindai SEMUA
> `DIR-INTENT-v*.md` yang ada di disk sekaligus, berpotensi lintas major
> version — pengelompokan itu **sudah** merupakan pekerjaan multi-chain
> PLAN-EVAL-05 sendiri, tidak ada versi "satu-chain-saja" yang lebih kecil
> untuk dipisah dengan aman.

Konsekuensi konkret untuk scope plan-eval ini, dibanding draf awal di bawah:

1. **Baris "Reuse `runDoctorReconciliation(data, overrides)` yang sudah ada"
   di scope asli sudah TIDAK BERLAKU** — versi `progress.ts` yang dimaksud
   baris itu **sudah dihapus** (PLAN-EVAL-01 Fase 5, progress.ts dirampingkan
   dari 1313 baris jadi ~250, cuma menyisakan yang dipakai jalur legacy
   `--reconstruct`). Yang ada sekarang adalah `runDoctorReconciliation` versi
   `chain.ts` (menerima `ChainState`, dipakai `doctor` mode default) — **ini
   yang harus dipakai/di-loop untuk `--all-versions`**, bukan versi lama.
2. **`--reconstruct` (ketiga mode-nya) belum tersentuh sama sekali** —
   `src/engine/reconstruct.ts` (`discoverArtifacts`/`buildReconstructedProgress`)
   dan handler `runReconstruct()` di `src/commands/doctor.ts` masih 100% di
   jalur lama (`ProgressJson`). Plan-eval ini harus memigrasikan **keduanya**
   ke `ChainState` sebelum bisa menambahkan 3-mode + `--all-versions` di
   atasnya — ini pekerjaan riil, bukan sekadar "tambah flag di kode yang
   sudah ada".
3. **Payoff langsung**: begitu `--reconstruct` selesai dimigrasikan ke
   `chain.ts`, `src/engine/progress.ts` **bisa dihapus total** —
   PLAN-EVAL-01 Fase 5 eksplisit menyatakan ini sebagai satu-satunya
   penghalang penghapusan penuh. Plan-eval ini adalah kunci penutup migrasi
   storage secara keseluruhan, bukan cuma fitur tambahan.
4. **Mekanisme backup ketiga** (ditemukan PLAN-EVAL-01 Fase 4, dicatat di
   PLAN-EVAL-02): `runReconstruct()` di `doctor.ts` membackup
   `progress.json` lama ke `reconstruct-backup-<timestamp>.json`
   ([doctor.ts:126](../../src/commands/doctor.ts#L126)) sebelum menimpanya.
   PLAN-EVAL-02 kemungkinan sudah menghapus baris ini duluan (independen,
   tidak saling blocking) — kalau belum, plan-eval ini yang menghapusnya
   sekalian saat memigrasikan handler ini ke `chain.ts`.

## Scope

- `sigma doctor` (default) — **SUDAH SELESAI oleh PLAN-EVAL-01**, tidak
  perlu dikerjakan ulang. Memperbaiki `progress-v<active>.json` lewat
  `runDoctorReconciliation()` versi `chain.ts`.
- **Migrasi `reconstruct.ts` + `runReconstruct()` ke `ChainState`** (baru,
  lihat "Koreksi Penting" di atas) — pekerjaan inti plan-eval ini sekarang.
  `discoverArtifacts()` sendiri (scan regex artifact di disk) kemungkinan
  besar tetap reusable apa adanya (tidak tahu apa-apa soal `ProgressJson`
  vs `ChainState`, cuma mengembalikan `FoundArtifact[]` per domain) —
  yang perlu ditulis ulang adalah `buildReconstructedProgress()` supaya
  mengelompokkan hasil scan per major version dan membangun **satu
  `ChainState` per kelompok**, bukan satu `ProgressJson` gabungan.
- `sigma doctor --all-versions` — ulangi `runDoctorReconciliation()`
  (`chain.ts`) untuk setiap `progress-v*.json` yang ada, tanpa mengubah
  `active_chain`. Bisa dikombinasikan dengan `--reconstruct`.
- `sigma doctor --reconstruct` — 3 mode:
  - tanpa flag: rekonstruksi chain **aktif** saja.
  - `--v <versi>`: rekonstruksi **satu** chain spesifik (scan artifact yang
    match pola major version itu).
  - `--all-versions`: rekonstruksi **semua** chain yang ditemukan di disk.
- **Keputusan yang perlu diambil di plan-eval ini** (satu-satunya open item
  tersisa dari DISCUSSION doc): perilaku `doctor` terhadap file chain yatim
  (file `progress-v*.json` ada tapi tidak ditunjuk `activate_status.json`
  mana pun, atau sebaliknya) — auto-adopt vs cuma dilaporkan.
- `--reconstruct`/`--all-versions` boleh membangun ulang **file chain** dari
  artifact di disk, tapi **tidak boleh menebak** `active_chain` — itu murni
  wewenang `sigma intent activate --v <x>` (sudah ada, diimplementasikan
  PLAN-EVAL-01 termasuk koreksi command yang sempat tertinggal di Fase 2).
- Setelah migrasi ini selesai dan diverifikasi: **hapus `src/engine/progress.ts`
  sepenuhnya** (types `ProgressJson` dkk., `readOverrides`/`writeProgress`/
  `createInitialProgress` versi lama, `hasActiveLockedIntent`/
  `hasCleanGate2Chain`/`hasCleanGate3Chain` versi lama) — penyelesaian Fase 5
  PLAN-EVAL-01 yang tertunda. Cek juga `src/commands/project.ts`'s
  `createInitialProgress` call (menulis `progress.json` legacy stub di
  `project start`) — begitu tidak ada lagi yang membaca file itu sama sekali
  (termasuk `--reconstruct` yang sudah dimigrasikan), pertimbangkan apakah
  `project start` masih perlu menulis stub itu sama sekali.

## Dependency

- **PLAN-EVAL-01** (wajib, sudah selesai) — butuh file layout
  `progress-v*.json` + `activate_status.json` + seluruh domain function
  `chain.ts` sudah ada.
- **PLAN-EVAL-02** (disarankan selesai duluan, tidak wajib) — kalau belum,
  plan-eval ini yang menghapus baris backup ketiga di `doctor.ts` sekalian.

## Di luar scope

- Perubahan invarian ACTIVE/auto-default itu sendiri — sudah final di
  PLAN-EVAL-01, plan-eval ini cuma memakainya.
- `sigma intent activate` — sudah ada, PLAN-EVAL-01.

## Risiko

- `discoverArtifacts()`/scan regex per domain yang sudah ada perlu
  diverifikasi tetap akurat saat dijalankan berulang lintas banyak chain
  sekaligus (bukan cuma sekali untuk satu file seperti hari ini) — risiko
  ini masih berlaku seperti draf awal.
- **Baru, lebih besar dari perkiraan draf awal**: migrasi
  `buildReconstructedProgress()` ke `ChainState` adalah rewrite riil
  (mengelompokkan per major version, bukan cuma ganti tipe parameter) —
  anggarkan waktu setara PLAN-EVAL-01 Fase 1 (fungsi domain), bukan cuma
  "tambah flag ke command yang sudah jalan".
- Payoff besar (hapus `progress.ts` total) berarti kesalahan di plan-eval
  ini langsung menghambat penutupan migrasi storage keseluruhan — perlu
  test coverage yang ketat sebelum menghapus jalur lama.
