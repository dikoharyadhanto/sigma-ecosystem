# PLAN-EVAL-07 — `--reconstruct` Metadata Loss & Ambiguous-Pairing Data Destruction

**Sumber**: Ditemukan 2026-07-18, Professional Mode, saat menyusun detail
migrasi JLH (PLAN-EVAL-03 §10). Director mengonfirmasi riwayat nyata: JLH
punya 3 `FMN-PLAN`/`DEV-EXEC` pasangan (`v0.1`/`v0.2`/`v0.3`) yang **aslinya
semua `LOCKED`**, tapi berubah jadi `DRAFT` tanpa `title`/`focus` setelah
`sigma doctor --reconstruct` pernah dijalankan terhadap project itu — dugaan
Director bahwa ini gap desain, dikonfirmasi benar dengan membaca langsung
`src/engine/reconstruct.ts`.
**Tanggal**: 2026-07-18
**Status**: **SELESAI (2026-07-18)** — diimplementasikan penuh atas approval eksplisit Director. `npm run build` bersih, `npm test` **214/214 (26 file)** — 211 lama + 3 baru (`test/reconstruct.test.ts`, describe block "PLAN-EVAL-07 metadata preservation"), nol regresi pada suite lama.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan
FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

### Ringkasan eksekusi (2026-07-18)

- `src/engine/reconstruct.ts`: ditambah `readExistingChain()` (baca +
  `validateChainSemantics()` file `progress-v<N>.json` lama, `null` kalau
  hilang/tak-terparse/tak-valid — fallback identik dengan perilaku lama),
  `referencedFileSet()`/`sameFileSet()`/`normalizeSlashes()` (predikat
  "artifact set persis sama"), `extractPlanMetadata()` (peta title/focus
  per versi PLAN dari chain lama). `buildReconstructedChains()` sekarang
  menerima `projectRoot` sebagai parameter pertama; di dalam loop per-major,
  kalau `existingChain` valid **dan** artifact set persis sama dengan yang
  ditemukan di disk → `chain.roadmap`/`plan`/`exec`/`close` disalin utuh
  dari file lama (bukan dibangun ulang) — cabang ROADMAP/PLAN+EXEC/CLOSE
  lama dilewati total untuk chain ini. Kalau tidak (file hilang/korup, atau
  artifact set berubah) → jalur blind-rebuild lama tetap berjalan **persis
  sama**, hanya title/focus PLAN yang tetap di-merge dari `existingPlanMetadata`
  kalau chain lama itu masih valid (independen dari kondisi wholesale-trust).
  `reconstructAllChains()` diperbarui meneruskan `projectRoot`.
- `test/reconstruct.test.ts`: 3 test baru menutupi ketiga jalur (wholesale
  trust penuh; title/focus tetap pulih walau fallback ambigu tetap terjadi
  karena artifact set berubah; fallback penuh ke blind-rebuild saat file
  lama korup) — dijalankan lewat `runCli()` (subprocess nyata `node
  dist/cli.js`, bukan mock), jadi ini juga berfungsi sebagai verifikasi
  end-to-end, bukan cuma unit test.
- **Bug ditemukan & diperbaiki selama implementasi**: perbandingan `file`
  path awalnya gagal di Windows karena `path.join()` menghasilkan separator
  native (`\`) sedangkan fixture test memakai literal forward-slash —
  diperbaiki dengan menormalisasi kedua sisi perbandingan
  (`normalizeSlashes()`) sebelum dibandingkan, bukan mengandalkan test
  fixture mengikuti konvensi tertentu.

---

## Inti

`sigma doctor --reconstruct` (PLAN-EVAL-05, `src/engine/reconstruct.ts`)
membangun ulang `progress-v<N>.json` **murni dari file artifact di disk**
(nama file + isi dokumen), dengan sengaja **tidak pernah membaca** file
`progress-v<N>.json` yang sedang ditimpanya sendiri sebagai sumber data —
filosofi ini benar untuk kasus file itu memang **hilang/korup** (tidak ada
apa pun yang bisa dipercaya darinya). Tapi filosofi yang sama diterapkan
buta juga saat file lama itu **sehat/valid** dan Director menjalankan
`--reconstruct` untuk alasan lain (mis. sinkronisasi rutin, atau — kasus
nyata JLH — akibat efek samping proses lain) — dalam kasus ini,
`--reconstruct` **menghancurkan** data yang sebenarnya masih valid dan bisa
dipercaya:

1. **`title`/`focus` PLAN hilang total, setiap kali, tanpa kecuali** —
   bukan cuma kasus ambigu. Dikonfirmasi baca kode: `buildReconstructedChains()`
   ([reconstruct.ts:264-312](../../src/engine/reconstruct.ts#L264-L312))
   membangun `ArtifactVersion` untuk plan di **kedua** cabang (pairing
   bersih 1:1 maupun grup ambigu) tanpa pernah men-set `.title`/`.focus` —
   field itu tidak pernah muncul di objek yang dibangun sama sekali. Ini
   berbeda dari INTENT, yang sudah punya jalur pemulihan
   (`readIntentHistoryMetadata()` membaca `Sigma/design/intent-history.md`,
   PLAN-EVAL-06 §6) — PLAN tidak punya padanan jalur pemulihan apa pun.
2. **Grup ambigu (>1 PLAN atau >1 EXEC di major yang sama) memaksa SEMUA
   entry jadi `DRAFT`**, walau file lama yang ditimpa punya state `LOCKED`
   yang sudah benar dan konsisten. Ini **kasus nyata JLH**: `FMN-PLAN
   v0.1/v0.2/v0.3` + `DEV-EXEC v0.1/v0.2/v0.3` (3 pasang di bawah major v0)
   — filenames semata tidak cukup untuk membuktikan pairing yang benar
   (`plan_version_ref`/state), jadi kode ini (dengan sengaja, lihat
   komentar [reconstruct.ts:290-294](../../src/engine/reconstruct.ts#L290-L294))
   memilih tidak menebak — tapi konsekuensinya, riwayat `LOCKED` yang
   sebenarnya benar (dan sudah tercatat rapi di `progress-v<N>.json` lama)
   ikut dibuang, digantikan `DRAFT` yang salah secara historis.

**Root cause tunggal untuk keduanya**: `--reconstruct` tidak pernah
mempertimbangkan "apakah file yang mau ditimpa ini sendiri masih valid dan
bisa dipercaya?" — ia selalu berasumsi kondisi terburuk (file hilang/korup),
bahkan ketika itu tidak benar.

## Investigasi lanjutan yang sudah dilakukan (2026-07-18)

- Dicek `src/commands/exec.ts` — **EXEC tidak pernah memakai
  `title`/`focus`** sama sekali (`grep` nol hasil). Jadi gap #1 di atas
  murni soal PLAN, bukan EXEC (walau `ArtifactVersion` sebagai tipe
  menyediakan field itu untuk keduanya).
- Dicek pola yang sudah ada: `recoveredMetadata` parameter di
  `buildReconstructedChains()` ([reconstruct.ts:183-186](../../src/engine/reconstruct.ts#L183-L186))
  sudah menunjukkan pola yang tepat untuk ditiru — sumber pemulihan
  terpisah, dipetakan per-versi, di-merge ke `ArtifactVersion`/`ChainState`
  yang baru dibangun. PLAN-EVAL-07 ini pada dasarnya memperluas pola yang
  sama ke domain PLAN, dengan sumber data berbeda (bukan `intent-history.md`,
  tapi file `progress-v<N>.json` lama itu sendiri — lihat §2 di bawah kenapa
  sumbernya berbeda).
- Dicek `test/reconstruct.test.ts` — test `'does not guess a pairing when
  multiple PLAN drafts exist under the same major'` ([reconstruct.test.ts:72](../../test/reconstruct.test.ts#L72))
  sudah mengunci perilaku **hasil DRAFT** untuk grup ambigu sebagai
  kontrak yang disengaja — perbaikan §2 di bawah tidak boleh mengubah
  perilaku test ini untuk kasus **file lama benar-benar tidak ada/korup**
  (harus tetap DRAFT+INVALID marker persis seperti sekarang), hanya
  menambah jalur baru untuk kasus **file lama ada dan valid**.

---

## Scope

### 1. Perbaikan wajib — pemulihan `title`/`focus` PLAN (gap #1)

Independen dari perbaikan #2, aman diimplementasikan sendiri tanpa
menyentuh logika state/pairing sama sekali:

- Sebelum `buildReconstructedChains()` menimpa suatu chain, baca
  `progress-v<N>.json` **lama** (kalau ada dan berhasil di-parse JSON —
  tidak perlu lolos `validateChainSemantics()` penuh untuk langkah ini,
  cukup bisa dibaca) untuk chain major yang sama, ekstrak
  `{ [planVersion]: { title, focus } }` dari `plan.versions` yang ada.
  Fungsi baru: `readExistingPlanMetadata(projectRoot, chainVersion):
  Map<string, { title?: string; focus?: string }>` di `reconstruct.ts` —
  pola yang sama persis dengan `readIntentHistoryMetadata()`, sumbernya
  beda (file JSON langsung, bukan markdown table).
- Terapkan di **kedua** cabang plan (`plans.length === 1` maupun grup
  ambigu) — gap ini tidak terikat pada ambiguitas pairing, jadi
  perbaikannya juga tidak boleh terikat ke situ.
- Kalau file lama tidak ada/tidak bisa di-parse (skenario korup/hilang
  yang jadi alasan awal `--reconstruct` dipakai) → peta kosong, perilaku
  identik dengan hari ini (tidak ada regresi untuk kasus recovery
  sungguhan).

### 2. Perbaikan utama — jangan buang state valid saat file lama sehat (gap #2)

Ini yang mencegah kejadian seperti JLH terulang. Aturan baru, diterapkan
**per major version**, sebelum masuk ke cabang pairing 1:1/ambigu yang
sudah ada:

- Baca `progress-v<N>.json` lama untuk major ini (kalau ada).
- Kalau ada **dan** lolos `validateChainSemantics()` penuh (bukan cuma
  bisa di-parse — harus benar-benar valid secara skema) **dan** setiap
  `file` yang dirujuk `plan.versions`/`exec.versions` di dalamnya masih
  ada di hasil `discoverArtifacts()` untuk major ini (tidak ada yang
  sudah dihapus dari disk sejak terakhir ditulis) → **chain ini dianggap
  sehat, bukan target pemulihan** untuk domain plan/exec/roadmap/close:
  salin `plan`/`exec`/`roadmap`/`close`/`gates` apa adanya dari file lama
  (bukan dibangun ulang dari nol), **hanya** `intent` (dan `chain_version`/
  `schema_version`/timestamp administratif) yang tetap diproses lewat
  jalur reconstruct biasa untuk konsistensi. Kalau ada file artifact BARU
  di disk yang belum tercatat di chain lama (mis. `plan new` dibuat lagi
  setelah), entry itu ditambahkan lewat logika reconstruct biasa untuk
  entry yang belum dikenal saja — bukan menimpa entry yang sudah dikenal
  dan valid.
- Kalau file lama **tidak ada**, **gagal parse**, atau **gagal
  `validateChainSemantics()`** → perilaku hari ini berlaku 100% tidak
  berubah (blind reconstruct dari disk, termasuk grup-ambigu-jadi-DRAFT).
  Ini penting: `--reconstruct` tetap harus bisa pulih dari kerusakan
  sungguhan — perbaikan ini **tidak boleh** membuatnya mempercayai data
  yang benar-benar rusak.
- **Konsekuensi buat kontrak test yang sudah ada**
  ([reconstruct.test.ts:72](../../test/reconstruct.test.ts#L72)): test itu
  membangun skenario tanpa `progress-v<N>.json` lama sama sekali (chain
  belum pernah ada, baru dibangun dari artifact) — jalur baru di atas
  tidak tersentuh (tidak ada file lama untuk dibaca), jadi test itu tetap
  valid tanpa perubahan. Test baru diperlukan khusus untuk kasus "file
  lama ADA dan valid" (§4).

### 3. Tidak berubah / di luar scope

- Filosofi inti "jangan menebak — flag dan minta konfirmasi manual" untuk
  kasus file benar-benar hilang/korup **tidak berubah** — ini plan-eval
  tentang *kapan* filosofi itu berlaku (hanya saat benar-benar perlu),
  bukan menggantinya.
- `title`/`focus` untuk EXEC — tidak relevan (EXEC tidak pernah memakainya,
  §Investigasi).
- Data historis JLH yang **sudah terlanjur hilang** (title/focus plan
  v0.1/v0.2/v0.3, yang sekarang tidak ada di `progress.json` lama JLH
  ataupun manapun) — **tidak bisa dipulihkan** oleh plan-eval ini,
  perbaikan di sini mencegah kehilangan **berikutnya**, bukan memulihkan
  yang sudah terlanjur hilang. PLAN-EVAL-03 (migrasi JLH) menangani
  kasus ini sebagai "known permanent data loss" terpisah.
- Perubahan skema `ChainState`/`ArtifactVersion` — tidak ada field baru
  yang dibutuhkan, `title`/`focus` sudah ada di tipe hari ini.

---

## Rencana Implementasi Detail

### Perubahan `src/engine/reconstruct.ts`

1. Tambah fungsi:
   ```ts
   function readExistingChain(projectRoot: string, chainVersion: string): ChainState | null {
     const filePath = chainFilePath(projectRoot, chainVersion); // dari chain.ts, sudah diexport
     if (!fs.existsSync(filePath)) return null;
     try {
       const raw = fs.readJsonSync(filePath) as ChainState;
       validateChainSemantics(raw); // lempar kalau tidak valid
       return raw;
     } catch {
       return null; // tidak ada / tidak bisa diparse / gagal validasi — semua diperlakukan sama: "tidak bisa dipercaya"
     }
   }
   ```
   (import tambahan dari `./chain`: `chainFilePath`, `validateChainSemantics`.)
2. Di `buildReconstructedChains()`, tepat sebelum blok "PLAN + EXEC"
   ([reconstruct.ts:263](../../src/engine/reconstruct.ts#L263)):
   ```ts
   const existingChain = readExistingChain(projectRoot, chainVersion); // butuh projectRoot diteruskan ke buildReconstructedChains — lihat poin 4
   const discoveredFiles = new Set([...plans.map(p => p.file), ...execs.map(e => e.file)]);
   const existingFilesStillPresent = existingChain
     ? [...existingChain.plan.versions, ...existingChain.exec.versions].every(
         v => !v.file || discoveredFiles.has(v.file) || /* entry tanpa file baru boleh, tapi kalau ada file harus masih ada */ true
       )
     : false;
   ```
   (detail exact predicate "semua file yang dirujuk masih ada" perlu
   disempurnakan saat coding — cek tiap `v.file` di `existingChain.plan.versions`
   dan `.exec.versions` ada di `discoveredFiles`, bukan sebaliknya, supaya file
   yang baru muncul tidak menggagalkan predicate ini.)
3. Kalau `existingChain && existingFilesStillPresent` → langsung
   `chain.plan = existingChain.plan; chain.exec = existingChain.exec;`
   (salin objek tracker utuh, bukan field per field) sebelum masuk ke
   cabang pairing 1:1/ambigu yang sudah ada — **skip** blok "PLAN + EXEC"
   yang ada sekarang untuk chain ini sepenuhnya. Roadmap/close juga
   disalin serupa (`chain.roadmap = existingChain.roadmap`, `chain.close =
   existingChain.close`) — skip blok ROADMAP/CLOSE yang ada.
4. `buildReconstructedChains()` butuh `projectRoot` sebagai parameter baru
   (sekarang cuma menerima `found`/`recoveredMetadata`, keduanya sudah
   di-precompute oleh caller) — tanda tangan fungsi berubah, satu-satunya
   pemanggil (`reconstructAllChains()`, [reconstruct.ts:362-366](../../src/engine/reconstruct.ts#L362-L366))
   disesuaikan (sudah punya `projectRoot` di scope-nya, tinggal diteruskan).
5. Untuk perbaikan #1 (title/focus) — kalau `existingChain` ditemukan tapi
   `existingFilesStillPresent` **false** (berarti tetap masuk jalur
   reconstruct biasa karena ada file yang hilang), tetap ekstrak
   `title`/`focus` dari `existingChain.plan.versions` (kalau ada) sebagai
   `recoveredPlanMetadata: Map<string, {title?, focus?}>`, di-merge ke
   `planEntry` di kedua cabang (1:1 dan ambigu) — ini memisahkan perbaikan
   #1 (selalu jalan kalau ada data lama, terlepas dari apakah #2
   ter-trigger) dari perbaikan #2 (cuma jalan kalau seluruh chain
   dianggap sehat).

### Perubahan pemanggil

- `reconstructAllChains()` ([reconstruct.ts:362-366](../../src/engine/reconstruct.ts#L362-L366)):
  teruskan `projectRoot` ke `buildReconstructedChains()`.
- `src/commands/doctor.ts` — tidak ada perubahan API publik yang terlihat
  Director (tetap `--reconstruct`, `--v`, `--all-versions`, tidak ada flag
  baru); perbaikan ini murni internal.

### 4. Rencana test (tambahan di `test/reconstruct.test.ts`)

- **Baru**: `'preserves LOCKED plan/exec state and title/focus when the
  existing chain file is still valid'` — setup: tulis
  `progress-v1.json` valid dengan 2 plan versi (`v0.1` SUPERSEDED, `v0.2`
  LOCKED dengan title/focus terisi) + exec `v0.2` LOCKED, tulis semua file
  artifact yang direferensikan di disk, jalankan `--reconstruct --v v1`,
  assert hasil identik (title/focus tetap ada, state tetap LOCKED/SUPERSEDED,
  bukan direset ke DRAFT).
- **Baru**: `'still falls back to blind reconstruct when the existing
  chain file is corrupted'` — setup: tulis `progress-v1.json` yang rusak
  (JSON tidak valid, atau valid JSON tapi gagal `validateChainSemantics`),
  jalankan `--reconstruct --v v1`, assert perilaku **hari ini** tidak
  berubah (state dibangun dari nol berdasar artifact di disk).
- **Baru**: `'recovers plan title/focus from the existing chain file even
  when pairing is ambiguous'` — setup: 3 plan drafts di bawah major yang
  sama seperti test existing ([reconstruct.test.ts:72](../../test/reconstruct.test.ts#L72)),
  tapi kali ini ada `progress-v<N>.json` lama valid yang punya
  title/focus untuk ketiganya (state boleh apa saja) dan **satu** file
  artifact yang hilang dari disk (supaya `existingFilesStillPresent`
  jadi false, memicu jalur "tetap reconstruct tapi title/focus dipulihkan"
  — bukan jalur "salin utuh" di §2) — assert: state tetap ikut aturan
  ambigu-jadi-DRAFT yang lama (perilaku #2 tidak ter-trigger), **tapi**
  title/focus tiap entry tetap terisi (perbaikan #1 tetap jalan).
- Verifikasi test lama ([reconstruct.test.ts:72](../../test/reconstruct.test.ts#L72),
  `:33`, `:55`, dst.) tidak terpengaruh — semuanya dijalankan dari kondisi
  "belum ada chain file sama sekali" (skenario asli `--reconstruct` untuk
  recovery), jadi `existingChain` selalu `null` di situ, jalur baru tidak
  ter-trigger.

### 5. Urutan eksekusi implementasi

1. `readExistingChain()` + helper predicate `existingFilesStillPresent` di
   `reconstruct.ts`.
2. `readExistingPlanMetadata()` (bisa digabung jadi bagian dari
   `readExistingChain()` — satu baca file, dua guna) untuk perbaikan #1.
3. Ubah tanda tangan `buildReconstructedChains()` (+`projectRoot`), ubah
   pemanggil `reconstructAllChains()`.
4. Sisipkan logika §2 langkah 2–3 di atas, tepat sebelum blok PLAN+EXEC
   yang ada.
5. Tulis 3 test baru (§4).
6. `npm run build && npm test` — pastikan seluruh test lama (211, per
   status PLAN-EVAL-06) tetap hijau + 3 baru.

---

## Dependency

- **PLAN-EVAL-05** (Doctor Multi-Chain & Reconstruct) — SELESAI, ini yang
  membangun `reconstruct.ts` versi sekarang yang jadi target perbaikan ini.
- **PLAN-EVAL-06** (`intent-history.md`) — SELESAI, `readIntentHistoryMetadata()`
  jadi pola/preseden yang ditiru di sini.
- Tidak bergantung pada PLAN-EVAL-03 (migrasi JLH) atau sebaliknya — dua
  plan-eval ini independen secara teknis, ditemukan bersamaan tapi
  menyentuh kode berbeda (`reconstruct.ts` di sini; skrip migrasi
  standalone baru di PLAN-EVAL-03). Boleh dikerjakan dalam urutan
  manapun relatif terhadap PLAN-EVAL-03.

## Risiko

- **Predicate "file masih ada" (§2) perlu presisi** — kalau salah desain
  (terlalu longgar), bisa mempercayai chain lama yang sebagian sudah usang
  (referensi file yang sudah dihapus/diganti) sebagai "sehat". Mitigasi:
  `validateChainSemantics()` penuh + pengecekan keberadaan tiap file yang
  dirujuk sebelum memutuskan "sehat", bukan cuma "bisa di-parse".
- **Menambah parameter `projectRoot` ke `buildReconstructedChains()`** —
  perubahan tanda tangan fungsi yang sudah dites langsung (bukan cuma
  lewat CLI) di beberapa test unit; perlu audit pemanggil test yang
  memanggilnya langsung (bukan cuma `reconstructAllChains()`) sebelum
  mengubah tanda tangan, supaya tidak pecah diam-diam.
- Risiko regresi rendah untuk kasus recovery sungguhan (file benar-benar
  hilang/korup) — jalur itu sengaja dibuat identik dengan perilaku hari
  ini (fallback eksplisit), bukan digantikan.

## Di luar scope

- Pemulihan data JLH yang sudah terlanjur hilang (title/focus plan
  v0.1/v0.2/v0.3) — tidak mungkin, sumbernya sudah tidak ada di mana pun.
  Dicatat sebagai known loss di PLAN-EVAL-03.
- Perluasan `title`/`focus` ke EXEC — tidak relevan, EXEC tidak memakainya.
