# PLAN-EVAL-03 — Migration Algorithm & JLH Cutover

**Sumber**: [DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md) (Konsolidasi Lanjutan bagian 13, "Implikasi ke migrasi JLH"; "Langkah Berikutnya")
**Tanggal**: 2026-07-17 (draf awal) — didetailkan 2026-07-18, Professional Mode, terhadap kode nyata `src/engine/chain.ts` **dan** data produksi nyata `i:\Works\Project\KLHK_JasaLingkunganHidup\Sigma\progress.json` (dibaca langsung, bukan asumsi).
**Status**: **SELESAI (2026-07-18)** — diimplementasikan dan dijalankan terhadap project JLH nyata atas approval eksplisit Director. `scripts/migrate-legacy-progress.js` ditulis sesuai §10.4, di-dry-run lalu dijalankan `--confirm` terhadap `i:\Works\Project\KLHK_JasaLingkunganHidup`. Satu penyesuaian ditemukan saat review dry-run (di luar §10.2 awal): Director mengoreksi `exec v1.1` (chain v2) semestinya `DRAFT`, bukan `LOCKED` seperti tercatat di data lama — ditangani lewat flag baru `--force-exec-state`/`--force-plan-state` (§10.4, ditambahkan saat implementasi). Hasil akhir diverifikasi penuh terhadap JLH lewat `sigma project status`, `session bootstrap`, `intent list`, `plan check`, `close status`/`close check --v v1`, `doctor --all-versions` — semua sesuai ekspektasi §10.6 (lihat "Ringkasan eksekusi" di bawah). Dependency (PLAN-EVAL-01, 02, 05, 06) sudah selesai sebelumnya; [PLAN-EVAL-07](./PLAN-EVAL-07-RECONSTRUCT-METADATA-PRESERVATION.md) (temuan terkait, root cause exec/plan v1 ter-DRAFT di data lama) sudah selesai diimplementasikan lebih dulu. **`git add`/`git commit` di project JLH tetap wewenang Director** — skrip migrasi ini sengaja tidak pernah men-commit apa pun (lihat §10.4).

### Ringkasan eksekusi (2026-07-18)

- `scripts/migrate-legacy-progress.js` (baru) — membaca `Sigma/progress.json`
  lama, membangun `ChainState` per major version, menulis
  `progress-v<N>.json` + `activate_status.json` lewat `writeChain()`/
  `writeActivateStatus()` dari `dist/engine/chain.js` (bukan menulis JSON
  manual). Flag final: `--dry-run` (default)/`--confirm`,
  `--treat-locked=<versions>`/`--treat-superseded=<versions>` (wajib untuk
  setiap entry `SUPERSEDED`/`INACTIVE` di data lama — skrip menolak jalan
  tanpa itu, tidak ada default otomatis), dan **baru ditambahkan saat
  implementasi** (tidak ada di draf §10.4 awal): `--force-plan-state=`/
  `--force-exec-state=<version>=<STATE>` — override state satu entry
  spesifik yang tidak sesuai kenyataan (dipakai untuk `exec v1.1` JLH, lihat
  di bawah). `package.json` mendapat script `migrate-legacy`.
- Dijalankan: `node scripts/migrate-legacy-progress.js
  "i:\Works\Project\KLHK_JasaLingkunganHidup" --treat-locked=v1
  --force-exec-state=v1.1=DRAFT --dry-run`, direview Director (cocok persis
  §10.2), lalu diulang dengan `--confirm`.
- Hasil ditulis: `Sigma/progress-v1.json` (intent/roadmap/plan/exec/close
  semua `LOCKED`, gates `true/true/true`, lifecycle `CLOSED`),
  `Sigma/progress-v2.json` (intent `LOCKED`, roadmap `DRAFT`, plan `v1.1`
  `LOCKED`, **exec `v1.1` `DRAFT`** — koreksi Director, gate_3 karenanya
  `false`, lifecycle `BUILD`), `Sigma/activate_status.json` (`active_chain:
  "v2"`). `Sigma/progress.json` lama dibiarkan utuh, tidak disentuh.
- Verifikasi end-to-end terhadap JLH nyata: `sigma project status` (chain
  v2, BUILD, tidak lagi error "Not inside a Sigma project"), `sigma session
  bootstrap` (Active Chain: v2 tampil menonjol), `sigma intent list` (v1
  LOCKED/CLOSED, v2 LOCKED/BUILD), `sigma close check --v v1` (**"Lock
  readiness: Eligible with warnings"** — dokumen `DIR-CLOSE-v1.md` memang
  genuinely siap di-lock, verdict `CLOSE_ACCEPTED`, mengonfirmasi ulang
  independen bahwa keputusan Director soal v1 "genuinely closed" akurat,
  bukan cuma klaim verbal), `sigma close status` (chain v2 — "No active
  CLOSE", benar), `sigma doctor --all-versions` (kedua chain "Runtime
  state: VALID", nol marker invalid), `Sigma/design/intent-history.md`
  ter-regenerasi otomatis oleh `doctor` (2 baris, v1 LOCKED, v2 LOCKED,
  title/focus level-intent "TBD" — memang tidak pernah tercatat, sesuai
  ekspektasi §10.2). `git status` di JLH menunjukkan 4 file baru
  (`activate_status.json`, `progress-v1.json`, `progress-v2.json`,
  `intent-history.md`) — belum di-commit, menunggu Director.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

Algoritma migrasi satu-kali dari `Sigma/progress.json` lama (skema nested
single-file) ke skema multi-file baru (`Sigma/progress-v1.json` +
`Sigma/activate_status.json`) hasil PLAN-EVAL-01. **JLH
(`KLHK_JasaLingkunganHidup`) dikonfirmasi Director sebagai target migrasi
pertama** — dipakai sebagai uji coba nyata begitu implementasi siap.

## Scope

- Baca `progress.json` lama, tulis ulang jadi `progress-v1.json` (data
  intent/roadmap/close saat ini jadi objek tunggal; plan/exec tetap array
  dipindah apa adanya) + buat `activate_status.json` menunjuk ke chain itu.
- **KOREKSI (ditemukan 2026-07-18, saat menyusun §10)**: baris ini sebelumnya
  mengusulkan guard git-clean-tree sebagai "pengganti backup, sesuai
  keputusan PLAN-EVAL-02" — itu merujuk draf **awal** PLAN-EVAL-02, bukan
  keputusan finalnya. PLAN-EVAL-02 yang sudah final (dan sudah
  **diimplementasikan** di kode, lihat §6) secara eksplisit **menolak** guard
  git-clean-tree sebagai kebijakan umum ("tidak perlu dibuat warning atau
  mekanisme block" — lihat dokumen itu, bagian "Di luar scope"). Tidak ada
  backup pengganti apa pun untuk operasi Sigma manapun, termasuk migrasi ini.
  Rollback tetap `git checkout`/`git diff` murni berdasar kebiasaan commit
  Director sendiri (tanggung jawab Director, bukan sesuatu yang CLI
  tegakkan) — bukan lagi hard guard yang diberlakukan skrip migrasi. Detail
  keputusan preflight pengganti (bukan guard git, tapi `--dry-run` +
  `--confirm` mengikuti konvensi Sigma yang sudah ada) ada di §10.5.
- Verifikasi hasil migrasi terhadap project JLH secara langsung sebagai
  acceptance test nyata (bukan cuma unit test sintetis).
- Tidak ada migrasi paksa/otomatis untuk project lain — opt-in/dipicu
  command, konsisten dengan preferensi Director soal migrasi bertahap
  (lihat pola serupa di PLAN-EVAL-01 folder `_07_17`, Isu Terbuka #4).

## Bentuk skema tujuan yang sudah final (dari implementasi PLAN-EVAL-01, 2026-07-17 — bukan tebakan lagi)

Algoritma migrasi harus menghasilkan `ChainState` persis sesuai bentuk di
`src/engine/chain.ts` (fungsi pembantu yang bisa dipakai langsung, bukan
menulis literal JSON manual: `createInitialChain()`, `writeChain()`,
`writeActivateStatus()`). Detail yang **berbeda dari asumsi awal** di baris
pertama scope di atas ("intent/roadmap/close jadi objek tunggal... plan/exec
dipindah apa adanya"):

- **`intent.state` lama bisa `INACTIVE`, tapi `IntentState` baru cuma
  `'DRAFT' | 'LOCKED' | 'SUPERSEDED'`** (PLAN-EVAL-01 §3.4 — INACTIVE
  dihapus total, konsekuensi struktural, bukan pilihan). Setiap entry
  `INACTIVE` di array `intent.versions` lama harus dipetakan ulang: kalau
  entry itu tidak pernah punya `supersede_reason` tercatat di mana pun
  (INACTIVE murni karena didemosi otomatis saat intent baru di-lock, bukan
  karena disupersede eksplisit) → jadi chain terpisah dengan
  `intent.state = 'LOCKED'` (bukan didemosi — di dunia chain terpisah tidak
  ada lagi "yang didemosi", setiap chain berdiri sendiri). Kalau memang
  pernah ada indikasi supersede (jarang di data lama, karena `intent
  supersede` baru ada belakangan) → `SUPERSEDED`. **Ini keputusan mapping
  yang perlu diverifikasi manual per-entry terhadap JLH, bukan aturan
  mekanis buta** — perilaku historis JLH sebelum PLAN-EVAL-01 tidak
  membedakan keduanya secara eksplisit dalam data.
- **`roadmap.state` lama bisa `ACTIVE`/`INACTIVE`, `RoadmapState` baru cuma
  `'DRAFT' | 'LOCKED' | 'SUPERSEDED'`** (PLAN-EVAL-01 §3.5). Karena 1:1
  per-chain, `ACTIVE`/`INACTIVE` (arbitrase kompetisi antar-roadmap) tidak
  berlaku lagi — mapping: `ACTIVE`/`INACTIVE` tanpa `supersede_reason` →
  `DRAFT` (belum di-lock lewat cascade `close lock`); kalau chain itu sudah
  closed (ada DIR-CLOSE LOCKED terkait) → `LOCKED`.
- **Field yang hilang total dari skema baru, jangan ikut dipindahkan**:
  `superseded_by` (di intent/roadmap/close — PLAN-EVAL-01 §3.2/§3.4, isolasi
  total artinya tidak ada pointer ke chain lain yang disimpan), dan
  `intent_version_ref` khusus di roadmap/close (selalu sama dengan
  `chain.intent.version` sendiri sekarang, redundan). `plan.intent_version_ref`
  dan `exec.plan_version_ref` **tetap ada** (plan/exec tidak berubah bentuk).
- **Field baru wajib ada**: `chain_version` (match nama file
  `progress-v<N>.json`), `schema_version` (level `ChainState`, bukan cuma
  level project).
- `project_id`/`project_name` **tidak ikut ke `ChainState`** — tetap hanya
  di `.sigma-identity.json` (sudah ada hari ini, tidak berubah).

## Konsekuensi `findProjectRoot()` — wajib ditangani migrasi (PLAN-EVAL-01 Fase 5, 2026-07-17)

`findProjectRoot()` sekarang menjangkar pada `Sigma/activate_status.json`,
**bukan lagi** `Sigma/progress.json` — proyek yang hanya punya `progress.json`
lama (belum pernah dimigrasikan) **tidak lagi dikenali CLI sama sekali**,
gagal dengan "Not inside a Sigma project" walau folder valid. Ini bukan bug,
memang disengaja (lihat PLAN-EVAL-01 §3.6/Fase 5) — tapi konsekuensinya
langsung untuk plan-eval ini: **migrasi WAJIB membuat `activate_status.json`
sebagai bagian dari transaksinya**, bukan opsional/langkah terpisah — tanpa
itu, project JLH pasca-"migrasi setengah jalan" (kalau proses mati di
tengah) jadi tidak bisa diakses `sigma` command apa pun sampai file itu ada.

## Interaksi dengan `doctor --reconstruct` yang masih di jalur lama (temuan PLAN-EVAL-01 Fase 4)

`doctor --reconstruct` (belum dimigrasikan, tetap scope PLAN-EVAL-05) masih
menulis ulang `Sigma/progress.json` dari nol setiap dijalankan (lewat
`reconstructProgress()`+`writeProgress()`, path lama). Kalau Director/AI
menjalankan `sigma doctor --reconstruct` pada project JLH **setelah**
migrasi ini selesai, itu akan **menghidupkan kembali** `progress.json` lama
(dengan isi hasil scan artifact, bukan isi sebelum migrasi) berdampingan
dengan `progress-v1.json` yang baru — membingungkan meski tidak merusak apa
pun (progress.json memang sudah jadi file mati, tidak dibaca command lain
manapun). **Rekomendasi**: dokumentasikan ini sebagai catatan operasional
untuk Director, atau pertimbangkan menghapus `Sigma/progress.json` lama
begitu migrasi sukses diverifikasi (bukan restore — cuma pembersihan, git
tetap jadi safety net kalau ternyata dibutuhkan lagi, sesuai prinsip
PLAN-EVAL-02).

## Dependency

Dicek langsung terhadap kode nyata 2026-07-18 — **keempatnya sudah selesai**,
plan-eval ini tidak diblokir apa pun secara teknis lagi:

- **PLAN-EVAL-01** (Core Storage & Schema Migration) — **SELESAI**. Skema
  tujuan (`ChainState`/`ActivateStatus`, `src/engine/chain.ts`) sudah final
  dan sudah dipakai seluruh command CLI hari ini. `src/engine/progress.ts`
  (skema lama) sudah **dihapus total** dari repo (dicek: file tidak ada lagi
  di `src/engine/`) — lebih maju dari status "sebagian, terblokir
  PLAN-EVAL-05" yang tercatat di dokumen PLAN-EVAL-01 itu sendiri, karena
  PLAN-EVAL-05 (di bawah) sudah menyelesaikan pemblokirnya.
- **PLAN-EVAL-02** (Auto-Backup Removal) — **SELESAI** (dicek: `backupFile()`
  tidak ada lagi di `src/`, commit `2c80be4` "refactor: remove backup
  functionality from project and doctor commands"). Dokumen PLAN-EVAL-02
  sendiri belum diperbarui status headernya (masih tertulis DRAFT/menunggu
  approval) — itu dokumentasi yang basi, bukan indikasi kode belum jalan;
  tidak perlu diperbaiki di sini, dicatat saja supaya tidak membingungkan
  kalau dibaca ulang nanti. **Konsekuensi untuk plan ini**: tidak ada lagi
  mekanisme backup apa pun untuk ditiru/diperluas — lihat koreksi guard di
  atas dan §10.5.
- **PLAN-EVAL-05** (Doctor Multi-Chain & Reconstruct) — **SELESAI
  (2026-07-18)**, `npm test` 199/199. Ini yang tadinya memblokir penghapusan
  total `progress.ts` di PLAN-EVAL-01 — sudah tidak lagi jadi isu.
- **PLAN-EVAL-06** (`--title`/`--focus` wajib + `intent-history.md`
  auto-render) — **SELESAI (IMPLEMENTED)**, `npm test` 211/211. Relevan di
  sini karena `intent.title`/`intent.focus` sekarang field opsional yang
  valid di `SingleIntentState` — migrasi **boleh** (tidak wajib) mengisi
  keduanya dari kolom historis JLH kalau ada; JLH hari ini tidak
  menyimpannya di level intent (lihat §10.2), jadi keduanya cukup
  dikosongkan (`undefined`, tidak ditulis sama sekali — konsisten dengan
  `createInitialChain()` yang juga hanya menulis field ini kalau truthy).

## Di luar scope

- Redefinisi Gate 1.5/lifecycle Roadmap-Close — **sudah selesai di
  PLAN-EVAL-01 sendiri** (bukan PLAN-EVAL-04 lagi — lihat koreksi di
  dokumen PLAN-EVAL-04). Migrasi data ini cuma memindahkan bentuk data ke
  skema yang sudah final tersebut, tidak mengubah aturan gate lebih jauh.
- Keputusan eksplisit menjalankan `sigma intent supersede --v v1` di JLH
  (state historis Intent v1 JLH sudah `SUPERSEDED` dari fix PLAN-EVAL-01
  folder `_07_17`) — di luar cakupan command migrasi storage ini, tetap
  wewenang Director terpisah.
- Migrasi `doctor --reconstruct` itu sendiri — PLAN-EVAL-05.

## §10 Rencana Implementasi Detail (2026-07-18)

Disusun terhadap kode nyata `src/engine/chain.ts` (fungsi yang benar-benar
dipakai: `chainFilePath`, `activateStatusPath`, `listChainVersions`,
`writeChain`, `writeActivateStatus`, `validateChainSemantics`,
`createInitialChain`) **dan** data produksi nyata JLH — dibaca langsung dari
`i:\Works\Project\KLHK_JasaLingkunganHidup\Sigma\progress.json`, bukan contoh
sintetis. Struktur file JLH lain yang dicek untuk cross-reference:
`Sigma/design/{DIR-INTENT-v1,DIR-INTENT-v2}.md`,
`Sigma/build/{FMN-PLAN-v0.1,v0.2,v0.3,v1.1;DEV-EXEC-v0.1,v0.2,v0.3,v1.1;ROADMAP-v1,v2}.md`,
`Sigma/close/DIR-CLOSE-v1.md`, `.sigma-identity.json` (`project_id: "JLH"`),
dan `git status`/`git log` project JLH (working tree bersih, sudah sinkron
`origin/main` — dikonfirmasi Director juga di pesan permintaan ini).

### 10.1 Ringkasan temuan kunci (baru, di luar draf awal §"Bentuk skema tujuan")

**KOREKSI BESAR (2026-07-18, dikonfirmasi Director langsung)**: draf
pertama §10 ini (disusun sebelum dikonfirmasi ke Director) sempat
mengusulkan chain v1 di-cascade-SUPERSEDE seluruh domainnya, berdasar
asumsi bahwa `intent v1 SUPERSEDED` di data lama mencerminkan keputusan
nyata. **Itu salah** — Director mengonfirmasi dua hal penting yang
mengubah kesimpulan §10.1–§10.3 secara material:

1. **`intent v1` men jadi `SUPERSEDED` di data lama adalah efek OTOMATIS
   sistem Sigma versi lama** ("previous sigma system always make previous
   intent version superseded if new higher intent version detected") —
   **bukan** keputusan Director untuk membatalkan/mengganti v1 dengan v2.
   v1 dan v2 adalah dua chain yang **masing-masing valid dan selesai
   sendiri-sendiri** (analog dua branch Git yang sama-sama di-merge, bukan
   satu menggantikan yang lain) — v2 **tidak membatalkan** v1.
2. **Plan/Exec `v0.1/v0.2/v0.3` di bawah v1 aslinya semua benar-benar
   `LOCKED`** (pekerjaan nyata yang sudah selesai) — statusnya berubah
   jadi `DRAFT` tanpa `title`/`focus` sebagai efek samping `sigma doctor
   --reconstruct` yang pernah dijalankan terhadap project JLH. Ini
   **dikonfirmasi sebagai bug nyata dan masih ada di kode hari ini** —
   lihat [PLAN-EVAL-07](./PLAN-EVAL-07-RECONSTRUCT-METADATA-PRESERVATION.md)
   (disusun terpisah 2026-07-18): `buildReconstructedChains()`
   ([reconstruct.ts:290-312](../../src/engine/reconstruct.ts#L290-L312))
   punya cabang "grup ambigu" (>1 PLAN/EXEC di major yang sama) yang
   **selalu** memaksa semua entry jadi `DRAFT` tanpa `title`/`focus` —
   persis kondisi 3 pasang plan/exec JLH di bawah v1 — **tanpa pernah
   membaca `progress-v<N>.json` lama untuk memverifikasi apakah state yang
   sudah ada sebenarnya masih valid**. PLAN-EVAL-07 memperbaiki akar
   masalah ini di kode (independen dari plan-eval ini); di sini cukup
   dicatat bahwa migrasi JLH **memperlakukan riwayat asli** (semua
   `LOCKED`), bukan state hasil reconstruct yang sudah rusak.

Kesimpulan mapping chain v1 yang benar (menggantikan seluruh isi §10.1
poin 1–3 draf sebelumnya):

1. **`intent v1` → `LOCKED`** (bukan `SUPERSEDED`) — koreksi atas bug
   auto-supersede sistem lama. Tidak perlu `supersede_reason` sintetis
   sama sekali (poin ini gugur, lihat §10.3 revisi). `locked_at` disalin
   dari `updated_at` data lama (`2026-07-15T07:30:58.425Z`) karena
   `locked_at` asli tidak tercatat di entry `SUPERSEDED` lama (field itu
   cuma ada untuk entry `LOCKED`/aktif — begitu status berubah field
   `locked_at` sebelumnya tidak ikut disalin oleh sistem lama).
2. **`roadmap v1` → `LOCKED`** (bukan `INACTIVE`/`SUPERSEDED`) — chain v1
   genuinely closed, roadmap ikut ter-lock lewat cascade `close lock`
   yang sama seperti perilaku hari ini (`close.ts` sudah memanggil
   `lockActiveRoadmap()`, PLAN-EVAL-01 §3.5).
3. **`close v1` → `LOCKED`** (bukan `DRAFT`) — "sudah ada closure" per
   konfirmasi Director; `DIR-CLOSE-v1.md` merepresentasikan closure yang
   genuinely selesai, cuma bookkeeping-nya (state tracker) yang tidak
   pernah di-lock secara resmi lewat command, atau ter-reset oleh bug
   PLAN-EVAL-07 di atas.
4. **`plan v0.1/v0.2/v0.3` dan `exec v0.1/v0.2/v0.3` (chain v1) → semua
   `LOCKED`** (bukan `DRAFT`, bukan `SUPERSEDED`) — riwayat asli sebelum
   ter-reset bug reconstruct. `plan.active_version`/`exec.active_version`
   di-set ke versi tertinggi (`v0.3` untuk keduanya), konsisten dengan
   pola `sortByMajorMinor(...).pop()` yang sudah dipakai `reconstruct.ts`
   sendiri untuk menentukan "yang mana yang aktif" ketika semua entry
   valid. `exec.plan_version_ref` yang di data lama tidak pernah terisi
   untuk `v0.1/v0.2/v0.3` (field itu kosong total di ketiganya) —
   diisi ulang secara masuk akal dengan pasangan versi yang sama
   (`exec v0.1 → plan_version_ref: "v0.1"`, dst.), sebagai rekonstruksi
   niat asli, bukan tebakan sembarangan (konsisten dengan pola
   penomoran plan/exec 1:1 yang berlaku di semua chain lain).
   **`title`/`focus` untuk keenam entry ini permanen hilang** — tidak
   tercatat di manapun yang bisa dibaca lagi (bukan di `progress.json`
   lama, bukan di isi dokumen `FMN-PLAN-v0.x.md` — dicek langsung, tidak
   ada blok title/focus di badan dokumennya). Migrasi membiarkan field
   ini kosong (`undefined`), didokumentasikan sebagai **known permanent
   data loss**, bukan sesuatu yang bisa diperbaiki skrip migrasi ini
   (lihat juga PLAN-EVAL-07 "Di luar scope").
5. **`gates` chain v1 dihitung ulang** dari state final di atas (bukan
   disalin dari nilai global lama yang mewakili v2) — dengan intent/plan/
   exec/close semuanya `LOCKED` dan rantai referensi bersih
   (`exec.plan_version_ref` cocok `plan.intent_version_ref` cocok
   `chain.intent.version`), `hasCleanGate3Chain()` menghasilkan `true` —
   gate chain v1 akhirnya `true/true/true`, mencerminkan "pekerjaan v1
   memang selesai", bukan `false/false/false` seperti draf sebelumnya
   yang keliru menganggap chain ini mati.
6. **`stale_intent`** (field yang tidak ada padanan di `ChainState`, ada
   di 6 entry plan/exec v1) tetap **dijatuhkan** saat migrasi — bukan
   karena chain-nya "mati" (kesimpulan lama, sudah gugur), tapi karena
   field itu memang tidak berarti apa pun lagi begitu setiap chain
   berdiri sendiri (isolasi struktural sudah menggantikan kebutuhan flag
   ini, terlepas dari status LOCKED/SUPERSEDED chain-nya).
7. **`runtime_invalid`** tetap dampak dari draf sebelumnya (di-reset
   `{ markers: [], last_doctor_run_at: null }` untuk semua chain, tanpa
   kecuali) — kesimpulan ini **tidak berubah** oleh koreksi di atas, tetap
   berlaku sama untuk v1 maupun v2.

### 10.2 Data JLH sekarang → target migrasi (tabel konkret, bukan skema abstrak)

**Direvisi mengikuti koreksi §10.1** (chain v1 adalah chain selesai
berdiri sendiri, bukan chain yang dibatalkan v2):

| Chain | Sumber (`progress.json` lama) | Target (`progress-v<N>.json`) |
| --- | --- | --- |
| **v1** | `intent.versions[0]`: `SUPERSEDED`, `superseded_by: "v2"` (efek bug auto-supersede sistem lama, §10.1) | `intent`: **`LOCKED`** (bukan `SUPERSEDED`). `locked_at`/`superseded_by` tidak ikut — `locked_at` dibackfill dari `updated_at` lama. |
| **v1** | `roadmap.versions[0]` (`ROADMAP-v1.md`): `INACTIVE` | `roadmap`: **`LOCKED`** (chain v1 genuinely closed — cascade `close lock`) |
| **v1** | `plan.versions[0..2]` (`FMN-PLAN-v0.1/0.2/0.3.md`): `DRAFT`, `stale_intent: true` (efek bug `--reconstruct`, lihat PLAN-EVAL-07) | `plan.versions`: ketiganya **`LOCKED`** (riwayat asli sebelum ter-reset); `active_version = "v0.3"`, `active_state = "LOCKED"`; `stale_intent` dijatuhkan; `title`/`focus` tidak terisi (hilang permanen, tidak bisa dipulihkan) |
| **v1** | `exec.versions[0..2]` (`DEV-EXEC-v0.1/0.2/0.3.md`): `DRAFT`, `stale_intent: true`, tanpa `plan_version_ref` | `exec.versions`: ketiganya **`LOCKED`**; `active_version = "v0.3"`, `active_state = "LOCKED"`; `plan_version_ref` diisi ulang 1:1 (`v0.1↔v0.1`, dst.); `stale_intent` dijatuhkan |
| **v1** | `close.versions[0]` (`DIR-CLOSE-v1.md`): `DRAFT` | `close`: **`LOCKED`** ("sudah ada closure" per konfirmasi Director) |
| **v1** | `gates` (global, milik v2) | dihitung ulang dari isi chain v1 → `{ gate_1_open: true, gate_2_open: true, gate_3_satisfied: true }` (rantai referensi bersih, chain v1 memang selesai) |
| **v2** | `intent.versions[1]`: `LOCKED` | `intent`: `LOCKED` (disalin, `locked_at` dipertahankan) |
| **v2** | `roadmap.versions[1]` (`ROADMAP-v2.md`): `ACTIVE` | `roadmap`: **`DRAFT`** (aturan umum: ACTIVE tanpa cascade-close → DRAFT; chain v2 belum di-close) |
| **v2** | `plan.versions[3]` (`FMN-PLAN-v1.1.md`): `LOCKED`, `intent_version_ref: "v2"` | `plan.versions`: `LOCKED` (disalin apa adanya — chain aktif, bukan target cascade); `active_version = "v1.1"` |
| **v2** | `exec.versions[3]` (`DEV-EXEC-v1.1.md`): `LOCKED`, `plan_version_ref: "v1.1"` | `exec.versions`: `LOCKED` (disalin apa adanya); `active_version = "v1.1"` |
| **v2** | tidak ada entry close untuk v2 | `close: null` |
| **v2** | `gates` (global) `true/true/true` | dihitung ulang dari isi chain v2 → tetap `true/true/true` (diverifikasi manual §10.6) |
| (manifest) | `intent.active_version: "v2"` (global) | `activate_status.json`: `{ "active_chain": "v2" }` |

Tidak ada field `title`/`focus` di level `intent` pada data lama JLH (field
itu baru ada di level `plan`, PLAN-EVAL-06 belum ada saat intent v1/v2 JLH
dibuat) — `SingleIntentState.title`/`.focus` untuk kedua chain dibiarkan
tidak diisi (`undefined`, tidak ditulis field-nya sama sekali, konsisten
dengan `createInitialChain()`). `Sigma/design/intent-history.md`
(PLAN-EVAL-06) **tidak** ikut dibuat/diisi oleh skrip migrasi ini —
dibiarkan kosong/tidak ada sampai `sigma doctor` (self-healing render
ulang, sudah menjangkau kasus ini per PLAN-EVAL-06) atau `intent activate`
berikutnya yang menuliskannya secara alami.

### 10.3 Aturan mapping umum (generalisasi di luar kasus spesifik JLH)

**Direvisi mengikuti koreksi §10.1** — poin 2 draf sebelumnya (cascade-
SUPERSEDE otomatis untuk chain yang `intent.state`-nya `SUPERSEDED`)
**dihapus sepenuhnya**. Alasan: `SUPERSEDED` di data lama tidak bisa
dipercaya begitu saja sebagai keputusan asli — sistem Sigma versi lama
memberi label ini secara **otomatis** setiap kali intent versi lebih
tinggi terdeteksi, terlepas apakah itu benar-benar dimaksudkan sebagai
pembatalan atau bukan (§10.1). Skrip migrasi generik **tidak boleh**
mengotomatisasi keputusan "apakah SUPERSEDED ini asli atau bug" — ini
persis kelas keputusan yang wajib ditinjau manual, sama seperti mapping
`INACTIVE` yang sudah diakui ambigu sejak draf pertama dokumen ini.

Skrip migrasi ditulis **generik** (bisa dipakai proyek lama lain di masa
depan, walau eksekusi nyata sesi ini hanya untuk JLH — sesuai prinsip
opt-in per-project yang sudah disepakati). Urutan aturan, diterapkan
per-intent-major-version (satu grup = satu chain target):

1. **`intent.state` lama**:
   - `LOCKED` → `LOCKED` (salin `locked_at`; kalau hilang di data lama,
     backfill dari `updated_at` dan catat di ringkasan output skrip sebagai
     peringatan non-fatal).
   - `SUPERSEDED` → **skrip TIDAK mengasumsikan otomatis**. Cetak entry ini
     di ringkasan `--dry-run` dengan flag jelas ("SUPERSEDED in legacy
     data — confirm this reflects a real Director decision, not the old
     auto-supersede-on-newer-intent behavior") dan **minta Director
     memilih eksplisit** salah satu: (a) pertahankan `SUPERSEDED` (kalau
     memang keputusan asli — perlu `supersede_reason`, disintesis dari
     `superseded_by` kalau tidak tercatat, dengan kalimat yang mengaku
     eksplisit sebagai rekonstruksi bukan alasan asli), atau (b) perlakukan
     sebagai `LOCKED` berdiri sendiri (kasus JLH v1 — bug sistem lama).
     **Tidak ada default otomatis** untuk cabang ini — untuk JLH sendiri,
     Director sudah menjawab eksplisit: opsi (b), lihat §10.1/§10.2.
   - `INACTIVE` → sama seperti `SUPERSEDED` di atas, tidak diotomatisasi:
     minta konfirmasi eksplisit apakah ini demosi otomatis biasa (→
     `LOCKED`, berdiri sendiri) atau ada bekas indikasi supersede nyata (→
     `SUPERSEDED`, dengan alasan). Tidak muncul di data JLH, tapi aturan
     ini tetap ditulis untuk migrasi proyek lain di masa depan.
2. **`roadmap`/`plan`/`exec`/`close` mengikuti status akhir `intent` hasil
   langkah 1 di atas** — **bukan** disalin buta dari state lama-nya
   sendiri, karena (kasus JLH v1, PLAN-EVAL-07) state lama pada domain
   ini sendiri bisa juga sudah rusak akibat bug `--reconstruct` yang
   independen dari status intent:
   - Kalau intent hasil langkah 1 `LOCKED` **dan** Director mengonfirmasi
     chain ini genuinely selesai/closed (seperti JLH v1) → `roadmap`/
     `close` → `LOCKED`; `plan.versions`/`exec.versions` → `LOCKED` semua
     (bukan disalin apa adanya dari state `DRAFT` yang mungkin sudah
     rusak) dengan `active_version` di-set ke versi tertinggi tiap
     tracker; `exec.plan_version_ref` yang kosong di data lama diisi
     ulang 1:1 berdasar versi yang sama (`v0.1↔v0.1`, dst.) sebagai
     rekonstruksi niat, bukan tebakan sembarangan.
   - Kalau intent hasil langkah 1 `LOCKED` dan chain ini **masih berjalan
     aktif** (belum closed, seperti JLH v2) → `roadmap` lama `ACTIVE`/
     `INACTIVE` tanpa `supersede_reason` → `DRAFT` (belum pernah
     di-`close lock`); `plan.versions`/`exec.versions` → disalin apa
     adanya (state, `*_ref`, `title`/`focus` kalau ada dipertahankan,
     `active_version`/`active_state` disalin apa adanya — chain hidup,
     nilai lama memang masih valid); `close` → disalin apa adanya kalau
     ada entry yang `version`-nya cocok `chain_version` ini, kalau tidak
     ada → `null`.
   - Kalau intent hasil langkah 1 `SUPERSEDED` (Director eksplisit memilih
     opsi (a) di langkah 1) → cascade-SUPERSEDE seluruh domain di bawahnya
     (`plan.active_version`/`exec.active_version` → `null`), persis efek
     `supersedeIntentVersion()` (`chain.ts:956-992`) — kasus ini **tidak
     terjadi di JLH**, tapi tetap ditulis untuk migrasi proyek lain nanti.
   - **Setiap kali skrip menemukan entry DRAFT di bawah major yang
     `intent`-nya berakhir `LOCKED`/genuinely-selesai** (pola JLH v1),
     tampilkan peringatan eksplisit di `--dry-run` yang merujuk kemungkinan
     bug PLAN-EVAL-07 (`--reconstruct` mereset state) — supaya Director
     bisa mengenali pola yang sama di proyek lain, bukan cuma di JLH.
3. **`gates`**: **selalu dihitung ulang** dari isi `ChainState` hasil
   migrasi lewat `hasActiveLockedIntent()`/`hasCleanGate2Chain()`/
   `hasCleanGate3Chain()` — tidak pernah disalin dari nilai global lama.
4. **`runtime_invalid`**: selalu di-reset `{ markers: [], last_doctor_run_at:
   null }` untuk semua chain, tanpa kecuali.
5. **`schema_version`**: `SCHEMA_VERSION` dari `src/config.ts` ("1.0.0" hari
   ini — sudah sama dengan nilai lama JLH, jadi bukan bump versi, cuma
   penegasan). **`chain_version`**: sama dengan `intent.version` grup ini.

### 10.4 Mekanisme delivery — skrip standalone, BUKAN command CLI baru

Konsisten dengan prinsip yang sudah disepakati di DISCUSSION doc ("tidak
ada command/namespace baru sama sekali untuk seluruh fitur multi-chain")
dan sifat operasi ini (sekali jalan per-project, bukan operasi rutin):
**tidak** menambah subcommand `sigma` baru (bukan `sigma project
migrate-legacy`, bukan `sigma doctor --migrate`). Preseden yang sudah ada
di repo untuk pola ini: `scripts/refresh-registries.js` — skrip dev-only,
dijalankan manual lewat `node scripts/...`, memuat build hasil `dist/`,
bukan lewat `sigma` binary.

**Rencana**: `scripts/migrate-legacy-progress.js` —

- Load `dist/engine/chain.js` (butuh `npm run build` dulu, sama seperti
  prasyarat `refresh-registries.js`) untuk fungsi
  `chainFilePath`/`activateStatusPath`/`writeChain`/`writeActivateStatus`/
  `listChainVersions` yang sudah teruji lewat `chain-engine.test.ts` —
  **tidak** menulis ulang logika path/atomic-write sendiri.
- Argumen: path project target (wajib, tidak ada default — mencegah
  migrasi tidak sengaja terhadap project yang salah). Baca
  `Sigma/progress.json` lama dengan `fs.readJsonSync` langsung (bukan lewat
  fungsi apa pun dari `progress.ts` — file itu **sudah tidak ada** di repo).
- Flag `--dry-run` (default kalau tidak ada flag lain diberikan — aman
  secara default, harus eksplisit untuk menulis): cetak seluruh
  `ChainState` hasil resolusi tiap chain (JSON `console.log`, format sama
  seperti isi file yang akan ditulis) + `activate_status.json` target, **tanpa
  menulis apa pun ke disk**. Director/AI wajib review output ini dulu
  sebelum lanjut.
- Flag `--confirm` (wajib untuk benar-benar menulis — pola yang sudah
  established di command Sigma lain untuk operasi konsekuensial, bukan
  mekanisme baru): tanpa ini, skrip berhenti di mode `--dry-run` walau
  tidak diminta eksplisit.
- Preflight informational (bukan hard block — lihat koreksi guard di atas):
  cetak `git status --porcelain -- Sigma` untuk project target sebagai
  peringatan kalau ada perubahan belum ter-*commit*; **tidak menghentikan
  proses**, sekadar informasi supaya Director tahu apa yang bisa
  di-`git checkout` kalau terjadi kesalahan.
- Urutan tulis: setiap `progress-v<N>.json` (ascending) dulu lewat
  `writeChain()`, **baru** `activate_status.json` terakhir lewat
  `writeActivateStatus()` — generalisasi urutan DISCUSSION §11 untuk N
  chain, bukan cuma 1.
- Setelah menulis, panggil `validateChainSemantics()` untuk **setiap** chain
  yang baru ditulis sebelum melaporkan sukses — kalau ada yang gagal
  validasi, laporkan chain mana yang gagal dan alasan spesifiknya (pesan
  error `validateChainSemantics` sudah cukup deskriptif, lihat
  `chain.ts:466-468`), **tapi tidak roll back otomatis** (tidak ada
  mekanisme itu, sesuai prinsip PLAN-EVAL-02) — Director menyelesaikannya
  manual lewat `git checkout -- Sigma/` kalau ini terjadi.
- `Sigma/progress.json` lama **tidak dihapus/direname** oleh skrip — tetap
  ada sebagai file mati (perilaku existing yang sudah dicatat draf awal
  dokumen ini soal interaksi `doctor --reconstruct`, tidak berubah).
  Director boleh menghapusnya manual sendiri belakangan setelah migrasi
  diverifikasi, kapan pun dirasa aman.
- Tambahkan entri di `package.json` `scripts`: `"migrate-legacy":
  "node scripts/migrate-legacy-progress.js"` (argumen path + flag lewat
  `npm run migrate-legacy -- <path> --dry-run`, sama pola dengan
  `refresh-registries`/`refresh-registries:dry`).

### 10.5 Preflight & keamanan — ringkasan keputusan (menjawab koreksi guard di atas)

- **Tidak ada guard git-clean-tree yang memblokir eksekusi** — ditolak
  Director secara final di PLAN-EVAL-02, berlaku juga di sini (bukan
  pengecualian).
- **Tidak ada backup file otomatis** — konsisten PLAN-EVAL-02.
- Satu-satunya "pengganti keamanan": `--dry-run` sebagai default (harus
  eksplisit `--confirm` untuk menulis), print informasi git status
  (non-blocking), dan validasi pasca-tulis (`validateChainSemantics()`)
  yang melaporkan tapi tidak mem-block/roll-back. Ini **bukan** mekanisme
  baru yang butuh sign-off arsitektur — semuanya pola yang sudah dipakai
  command Sigma lain (`--confirm`, `--dry-run` di `project sync`, validasi
  yang melempar pesan deskriptif).

### 10.6 Verifikasi — acceptance test nyata terhadap JLH (bukan unit test sintetis)

Sesuai scope asli dokumen ini ("Verifikasi hasil migrasi terhadap project
JLH secara langsung"). Urutan setelah implementasi skrip selesai dan
disetujui untuk dieksekusi:

1. `npm run build` di `sigma-ecosystem` (memastikan `dist/` terbaru dan
   `sigma` global yang sudah di-reinstall Director memakai kode yang sama).
2. `node scripts/migrate-legacy-progress.js "i:\Works\Project\KLHK_JasaLingkunganHidup" --dry-run`
   — review manual output terhadap tabel §10.2 baris demi baris.
3. Kalau sesuai, jalankan ulang dengan `--confirm`.
4. `cd` ke project JLH, jalankan berurutan, semuanya harus exit 0 dan
   hasilnya dicocokkan manual ke tabel §10.2:
   - `sigma project status` — harus melaporkan lifecycle **chain v2**
     (`BUILD`), bukan error "Not inside a Sigma project".
   - `sigma session bootstrap` — harus menampilkan `Active Chain: v2`
     menonjol (PLAN-EVAL-01 Fase 4).
   - `sigma intent list` — harus menampilkan 2 baris: v1 `LOCKED`, v2
     `LOCKED` (**bukan** v1 `SUPERSEDED` — koreksi §10.1).
   - `sigma plan list`/`sigma exec list --v v1` — harus menampilkan `v0.1`/
     `v0.2`/`v0.3` semuanya `LOCKED` (bukan `DRAFT`). `sigma plan list`/
     `sigma exec list` (chain aktif v2, tanpa `--v`) — harus menampilkan
     hanya `v1.1` `LOCKED` (versi v0.x tidak boleh muncul di sini — ada di
     `progress-v1.json`, chain berbeda).
   - `sigma close check --v v1` — harus melaporkan `DIR-CLOSE v1` `LOCKED`.
     `sigma close status` (chain aktif v2) — harus melaporkan "No
     DIR-CLOSE draft" (chain v2 belum pernah membuat DIR-CLOSE-nya
     sendiri).
   - `sigma doctor --all-versions` — harus melaporkan **kedua** chain
     bersih dengan gate `true/true/true` (chain v1 genuinely selesai, chain
     v2 sedang berjalan aktif) dan tidak ada marker invalid baru, dan
     meregenerasi `Sigma/design/intent-history.md` (PLAN-EVAL-06
     self-healing) dengan 2 baris, keduanya `LOCKED`.
5. `git diff`/`git status` di project JLH — review manual seluruh isi
   `progress-v1.json`/`progress-v2.json`/`activate_status.json` yang baru
   sebagai untracked files, **commit manual oleh Director** setelah puas
   (skrip ini sendiri tidak melakukan commit apa pun — operasi git tetap
   wewenang Director, konsisten dengan seluruh command Sigma lain yang
   tidak pernah memanggil `git commit` sendiri).

### 10.7 Urutan eksekusi implementasi (kalau disetujui)

1. Tulis `scripts/migrate-legacy-progress.js` (§10.4) — termasuk seluruh
   aturan mapping §10.3.
2. Tambah entri `package.json` `scripts`.
3. `npm run build`.
4. Jalankan `--dry-run` terhadap JLH, tempel outputnya untuk direview
   Director sebelum lanjut ke langkah 5 (checkpoint eksplisit, bukan
   otomatis lanjut).
5. Setelah Director mengonfirmasi output dry-run benar → jalankan
   `--confirm` terhadap JLH.
6. Jalankan seluruh langkah verifikasi §10.6 poin 4–5.
7. Laporkan hasil akhir ke Director (termasuk isi `git diff` lengkap untuk
   direview sebelum Director men-commit sendiri).

### 10.8 Titik keputusan — status setelah konfirmasi Director (2026-07-18)

Ketiga titik keputusan draf sebelumnya sudah dijawab Director langsung:

1. ~~Cascade-SUPERSEDE plan/exec/close/roadmap untuk chain v1~~ —
   **DIJAWAB, dan mengubah kesimpulan**: bukan cascade-SUPERSEDE.
   Director mengonfirmasi chain v1 genuinely `LOCKED`+closed berdiri
   sendiri (bukan dibatalkan v2) — lihat koreksi besar §10.1/§10.2/§10.3.
   Ini bukan sekadar "disetujui apa adanya", tapi memperbaiki kesalahan
   asumsi draf pertama §10 (yang sempat salah membaca `SUPERSEDED` di data
   lama sebagai keputusan asli, padahal itu bug auto-supersede sistem
   lama).
2. ~~Supersede_reason sintetis untuk intent v1~~ — **GUGUR**, tidak
   diperlukan lagi karena intent v1 sekarang dipetakan ke `LOCKED`, bukan
   `SUPERSEDED` (poin 1).
3. ~~`--dry-run` default + `--confirm`, tanpa guard git-clean-tree~~ —
   **DIJAWAB: cukup, tanpa guard tambahan.** Director memilih opsi
   "Cukup, tanpa guard git" — §10.4/§10.5 berlaku sebagai final, tidak
   ada mekanisme keamanan tambahan yang perlu ditambahkan.

**Temuan baru dari proses konfirmasi ini** (di luar 3 poin di atas,
muncul saat menelusuri kenapa v0.1/v0.2/v0.3 berstatus DRAFT): Director
mengonfirmasi root cause-nya adalah bug nyata di `sigma doctor
--reconstruct` (grup ambigu PLAN/EXEC memaksa semua jadi DRAFT +
membuang title/focus, tanpa pernah membaca file chain lama untuk
memverifikasi apakah state itu sebenarnya masih valid). Ini dicatat dan
didetailkan penuh sebagai **plan-eval terpisah**:
[PLAN-EVAL-07 — `--reconstruct` Metadata Loss & Ambiguous-Pairing Data
Destruction](./PLAN-EVAL-07-RECONSTRUCT-METADATA-PRESERVATION.md) —
independen secara teknis dari migrasi JLH ini (menyentuh
`src/engine/reconstruct.ts`, bukan skrip migrasi baru). **SELESAI
diimplementasikan (2026-07-18)**, `npm test` 214/214 — lihat dokumen itu
untuk ringkasan eksekusi. Tidak mengubah apa pun di rencana migrasi JLH
di dokumen ini (skrip migrasi §10.4 membaca `Sigma/progress.json` lama
langsung, tidak lewat `--reconstruct`), dicatat di sini murni supaya
riwayat penemuannya tetap tertaut.

Dengan ketiga titik ini terjawab, **PLAN-EVAL-03 sekarang siap
diimplementasikan** menunggu approval eksplisit Director untuk mulai
coding (§10.7).

---

## Risiko

- Project JLH adalah data produksi nyata — kesalahan migrasi berdampak
  langsung. Mitigasi (diperbarui, lihat §10.5 — **bukan** lagi guard
  git-clean-tree): `--dry-run` default + `--confirm` wajib untuk menulis +
  validasi pasca-tulis + verifikasi manual `git diff` sebelum Director
  men-commit, dijalankan dengan hati-hati per langkah §10.7, bukan otomatis
  tanpa checkpoint review.
- Keputusan mapping `SUPERSEDED`/`INACTIVE` di data lama **tidak boleh
  diotomatisasi buta** (§10.3, direvisi) — data lama bisa mencerminkan bug
  auto-supersede sistem versi lama, bukan keputusan Director asli (kasus
  nyata JLH v1). Skrip migrasi generik wajib berhenti dan minta konfirmasi
  eksplisit setiap kali menemukan entry ini pada proyek lain di masa
  depan — tidak ada default otomatis yang aman untuk kasus ini. **Untuk
  JLH sendiri, sudah tidak ambigu** — sudah dikonfirmasi Director langsung
  (§10.1/§10.8): v1 `LOCKED`, bukan `SUPERSEDED`.
- **Sumber data lama itu sendiri bisa sudah tidak akurat** akibat bug
  `sigma doctor --reconstruct` yang berjalan sebelumnya (plan/exec v1 JLH
  ter-reset ke `DRAFT` tanpa title/focus, riwayat aslinya `LOCKED`) — lihat
  [PLAN-EVAL-07](./PLAN-EVAL-07-RECONSTRUCT-METADATA-PRESERVATION.md).
  Migrasi JLH memakai riwayat yang **dikonfirmasi Director**, bukan state
  mentah di file, tapi ini jadi peringatan umum: skrip migrasi untuk
  proyek lain di masa depan tidak boleh mempercayai `progress.json`
  lama 100% sebagai kebenaran mutlak kalau proyek itu pernah menjalankan
  `--reconstruct` sebelum PLAN-EVAL-07 selesai — perlu tinjauan manual
  serupa.
- Kalau migrasi berhenti di tengah (mati sebelum `activate_status.json`
  tertulis), project JLH untuk sementara tidak dikenali `findProjectRoot()`
  sama sekali — recovery: chain file yang sudah sempat ditulis tetap valid
  di disk, tinggal jalankan ulang skrip (idempotent terhadap file yang
  sudah benar) atau `git checkout -- Sigma/` untuk mulai ulang dari nol
  kalau ingin bersih total.
- Ketiga titik keputusan §10.8 **sudah dikonfirmasi Director** (2026-07-18)
  — plan-eval ini tidak lagi diblokir sign-off apa pun, tinggal menunggu
  approval eksplisit untuk mulai coding (§10.7).
