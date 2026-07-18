# PLAN-EVAL-05 — Doctor Multi-Chain (`--all-versions`) & Reconstruct

**Sumber**: [DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md) (Konsolidasi Lanjutan bagian 4 & 9)
**Tanggal**: 2026-07-17 (draf awal, ringkas) — didetailkan 2026-07-18, Professional Mode, terhadap kode nyata `src/` (`chain.ts`, `reconstruct.ts`, `doctor.ts`, `progress.ts`, `intent.ts`, `roadmap.ts`, `close.ts`, `override.ts`, `project.ts`, `config.ts`, `test/helpers.ts`).
**Status**: **SELESAI (2026-07-18)** — diimplementasikan penuh atas otorisasi eksplisit Director ("you get my approval to begin implementation now"). `npm run build` bersih, `npm test` **199/199 (25 file)**. Diverifikasi juga manual end-to-end di luar test harness (lihat §13). Belum LOCKED (bukan FMN-PLAN, tidak ada mekanisme lock Sigma untuk dokumen ini).

### Ringkasan eksekusi (2026-07-18)

Semua 4 fase (§9) selesai dalam satu sesi implementasi berurutan, bukan dipisah per-commit:

1. **`reconstruct.ts` ditulis ulang** — `buildReconstructedChains()` menggantikan `buildReconstructedProgress()` (§5.2), menghasilkan `Map<major, ReconstructedChain>` + `unresolved: UnresolvedGroup[]` + `skipped: string[]`. `discoverArtifacts()` reused tanpa perubahan (§5.1, dikonfirmasi benar saat implementasi). Gate/marker computation didelegasikan ke `runDoctorReconciliation()` yang sudah ada (§5.2 langkah 6), dengan marker "unprovable-lock" digabung manual sesudahnya (bukan lewat mekanisme merge `runDoctorReconciliation` sendiri — fungsi itu **mengganti total** `runtime_invalid.markers`, bukan menggabung, temuan implementasi yang tidak eksplisit di draf desain).
2. **`doctor.ts` — 3-mode `--reconstruct` + `--all-versions`** — `resolveReconstructTargets()` (§5.4) diimplementasikan persis seperti desain, dengan satu perbaikan: penanganan error `resolveActiveChainVersion()` di mode default awalnya menelan **semua** error (termasuk "chain file ada tapi korup") jadi pesan generik "no chain files exist" — diperbaiki supaya hanya kasus "belum ada chain sama sekali" yang di-reframe, error lain (termasuk file korup — skenario utama reconstruct) diteruskan apa adanya. `--id`/`--name` **dihapus total** dari `doctor --reconstruct` (bukan sekadar diupdate) — temuan implementasi: `ChainState` tidak pernah membawa `project_id`/`project_name` (PLAN-EVAL-01 §3.3), jadi kedua flag itu sudah kehilangan sesuatu untuk direkonstruksi ke dalamnya begitu target berubah dari `ProgressJson` ke `ChainState`.
3. **Penghapusan `progress.ts` total (§7)** — 12 tipe + `readOverrides()` + `parseMajorVersion`/`parseMinorVersion` direlokasi ke `chain.ts`; 4 importer lain (`roadmap.ts`, `override.ts`, `project.ts`, `doctor.ts`) diupdate; `progress.json` stub write di `project.ts` `runStart()` dihapus; dua fallback identity (`doctor.ts` lama, `project.ts`'s `resolveRegisterIdentity()`) dihapus; `PROGRESS_FILE` dihapus dari `config.ts`. **Bug nyata ditemukan & diperbaiki di langkah ini**: `runStart()`'s guard "proyek sudah ada" (`if (fileExists(progressPath))`) ternyata **belum pernah dipindah** ke `activate_status.json` walau `findProjectRoot()` sendiri sudah dipindah sejak PLAN-EVAL-01 Fase 5 — kalau tidak diperbaiki, `project start` tanpa `--reinit` tidak akan pernah lagi mendeteksi proyek existing begitu `progress.json` berhenti ditulis (guard akan selalu lolos, berpotensi menimpa state project tanpa peringatan).
4. **Test** — `test/reconstruct.test.ts` ditulis ulang total (13 test: 4 skenario lama diadaptasi ke `ChainState`, 9 baru — `--v` targeted-only, `--v` not-found, `--all-versions` multi-chain, unresolved group, default-mode active-only, default-mode no-chain-files error, mutual exclusion, `--v` without `--reconstruct`) plus 2 test baru untuk `doctor --all-versions` (reconciliation-only). `test/lifecycle-hardening.test.ts` diperbaiki (assert `activate_status.json` ada dan `progress.json` **tidak** ada, bukan sebaliknya). 8 file lain yang menyebut `env.progressPath` diaudit (§8.2) — dikonfirmasi semuanya menulis fixture yang sudah tidak terbaca oleh kode apa pun sejak sebelum plan-eval ini (bukan regresi baru) — dibiarkan apa adanya, pembersihannya di luar scope plan-eval ini. `npm test` **199/199 (25 file)**.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## 1. Inti

`sigma doctor` **satu-satunya** command yang butuh flag lintas-chain, karena
tugasnya (`runDoctorReconciliation`) adalah **memperbaiki**, bukan cuma
**menampilkan** (beda dari `sigma intent list` yang murni display). Semua
command mutasi lain sengaja tidak diberi flag lintas-chain — akan melanggar
isolasi total antar-chain kalau dipaksakan.

## 2. Koreksi Penting (2026-07-17, dari sesi sebelumnya) — scope plan-eval ini lebih besar dari draf awal

PLAN-EVAL-01 (Fase 4) sudah memigrasikan **mode default** `sigma doctor` ke
`chain.ts` sepenuhnya — tapi secara sadar **TIDAK** menyentuh `--reconstruct`
sama sekali, dengan alasan yang mengubah gambaran scope plan-eval ini:

> `discoverArtifacts()` (di `reconstruct.ts`) pada dasarnya memindai SEMUA
> `DIR-INTENT-v*.md` yang ada di disk sekaligus, berpotensi lintas major
> version — pengelompokan itu **sudah** merupakan pekerjaan multi-chain
> PLAN-EVAL-05 sendiri, tidak ada versi "satu-chain-saja" yang lebih kecil
> untuk dipisah dengan aman.

Konsekuensi konkret untuk scope plan-eval ini:

1. Baris "Reuse `runDoctorReconciliation(data, overrides)` yang sudah ada" di
   scope asli sudah **tidak berlaku** — versi `progress.ts` yang dimaksud
   baris itu **sudah dihapus** (PLAN-EVAL-01 Fase 5, `progress.ts` dirampingkan
   dari 1313 baris jadi ~243). Yang ada sekarang adalah `runDoctorReconciliation`
   versi `chain.ts` (menerima `ChainState`) — **ini** yang dipakai/di-loop untuk
   `--all-versions`, bukan versi lama (sudah tidak ada).
2. `--reconstruct` (ketiga mode-nya) belum tersentuh sama sekali — `discoverArtifacts()`/
   `buildReconstructedProgress()` (`reconstruct.ts`) dan `runReconstruct()`
   (`doctor.ts`) masih 100% di jalur lama (`ProgressJson`, tulis ke
   `Sigma/progress.json`). Plan-eval ini harus memigrasikan **keduanya** ke
   `ChainState` sebelum bisa menambahkan 3-mode + `--all-versions` di atasnya.
3. **Payoff langsung**: begitu `--reconstruct` selesai dimigrasikan,
   `src/engine/progress.ts` **bisa dihapus** — tapi lihat §7 di bawah:
   penghapusan totalnya **bukan** sekadar "hapus file ini", karena `chain.ts`
   sendiri masih mengimpor beberapa tipe/fungsi bersama darinya hari ini
   (temuan sesi ini, lihat §7 — draf sebelumnya tidak menyebut ini).
4. Mekanisme backup ketiga (ditemukan PLAN-EVAL-01 Fase 4, dicatat di
   PLAN-EVAL-02): `runReconstruct()` di `doctor.ts` membackup `progress.json`
   lama ke `reconstruct-backup-<timestamp>.json` sebelum menimpanya — sudah
   **tidak ada lagi** di kode saat ini (dicek ulang sesi ini,
   [doctor.ts](../../src/commands/doctor.ts) tidak lagi punya baris
   `backupFile`/`reconstruct-backup-`). PLAN-EVAL-02 kemungkinan sudah
   menghapusnya duluan, atau baris itu memang tidak pernah ada di titik yang
   dirujuk — baik begitu, tidak ada pekerjaan tersisa di sini untuk poin ini.

## 3. Temuan tambahan sesi ini (2026-07-18) — verifikasi terhadap kode nyata

Sebelum menulis detail algoritma, dicek apakah asumsi draf sebelumnya masih
berlaku terhadap kode yang sudah berjalan hari ini (PLAN-EVAL-01/04 sudah
banyak berubah sejak draf awal plan-eval ini ditulis):

- **`ChainState.intent`/`.roadmap`/`.close` sudah 3-state penuh** (`DRAFT
  | LOCKED | SUPERSEDED`, tanpa `ACTIVE`/`INACTIVE`) — `chain.ts:32-38`.
  Tidak ada pekerjaan tersisa dari PLAN-EVAL-04 yang memblokir migrasi
  reconstruct: skema target sudah stabil.
- **Gate 1.5 sudah didefinisikan ulang** ("roadmap ada dan belum
  SUPERSEDED") — `plan.ts:106-118`. Tidak perlu ditunggu.
- **`close lock` sudah men-cascade auto-lock roadmap** — `close.ts:95,125-133`.
  Perilaku existing, dipertahankan apa adanya, tidak perlu didesain ulang di
  sini.
- **Numbering plan/exec lintas-chain sudah aman** (tidak pernah tabrakan,
  `nextPlanVersion()`/`nextExecVersion()`, `chain.ts:773-790`) — konfirmasi
  bahwa overrides global (`Sigma/memory/overrides.jsonl`, dibaca lewat
  `readOverrides()`) sudah cukup ter-scope per chain lewat `version` pada
  tiap entry ([override.ts:100-109](../../src/commands/override.ts#L100)),
  **kecuali** entry lama tanpa field `version` (celah yang sedang
  diinvestigasi terpisah di PLAN-EVAL-04, "override cross-chain leak") —
  **eksplisit di luar scope plan-eval ini**, tidak diperbaiki di sini. Untuk
  `--all-versions`, array `overrides` yang sama (dibaca sekali) dipakai ulang
  untuk setiap chain — konsisten dengan bagaimana `hasActiveOverrideForGate()`
  sudah bekerja hari ini (mencocokkan lewat `version`, bukan lewat asumsi
  "chain aktif").
- **Kesimpulan**: tidak ada dependency baru ke PLAN-EVAL-04 yang perlu
  ditunggu. Scope plan-eval ini murni: migrasi `reconstruct.ts` + `doctor.ts`
  `--reconstruct` ke `ChainState`, tambah `--all-versions`, lalu bereskan
  penghapusan `progress.ts`.

## 4. Kebutuhan yang sudah dikonfirmasi (tidak berubah dari draf awal)

- `sigma doctor` (default) — **SUDAH SELESAI oleh PLAN-EVAL-01**, tidak perlu
  dikerjakan ulang.
- `sigma doctor --all-versions` — ulangi `runDoctorReconciliation()`
  (`chain.ts`) untuk setiap `progress-v*.json` yang ada, tanpa mengubah
  `active_chain`. Bisa dikombinasikan dengan `--reconstruct`.
- `sigma doctor --reconstruct` — 3 mode:
  - tanpa flag: rekonstruksi chain **aktif** saja.
  - `--v <versi>`: rekonstruksi **satu** chain spesifik.
  - `--all-versions`: rekonstruksi **semua** chain yang ditemukan di disk.
- `--reconstruct`/`--all-versions` boleh membangun ulang **file chain** dari
  artifact di disk, tapi **tidak boleh menebak** `active_chain` — itu murni
  wewenang `sigma intent activate --v <x>` (sudah ada, PLAN-EVAL-01).

---

## 5. Desain — Algoritma Reconstruct Multi-Chain

### 5.1 `discoverArtifacts()` — dipakai ulang tanpa perubahan

Dicek terhadap kode: `discoverArtifacts()` ([reconstruct.ts:58-83](../../src/engine/reconstruct.ts#L58))
murni scan filename + `SIGMA:DOC` marker per domain, mengembalikan
`FoundArtifact[]` (`{ version, file }`) per domain. Tidak menyentuh
`ProgressJson` sama sekali. **Tidak ada perubahan dibutuhkan** — reused
langsung. `PATTERNS`, `readDocType()`, `sortByMajor`/`sortByMajorMinor`,
`groupByMajor()` juga reused apa adanya (tidak coupled ke `ProgressJson`).

### 5.2 Fungsi baru: `buildReconstructedChains()` menggantikan `buildReconstructedProgress()`

Perbedaan inti dari fungsi lama: alih-alih membangun **satu** `ProgressJson`
gabungan, fungsi ini mengelompokkan artifact per **major version** dan
membangun **satu `ChainState` per kelompok** yang punya `DIR-INTENT-vN.md`.

```ts
export interface ReconstructedChain {
  chainVersion: string;       // "v1", "v2", ...
  data: ChainState;
  notes: string[];
}

export interface UnresolvedGroup {
  major: number;
  artifacts: string[];        // file relatif yang ditemukan tapi tidak punya DIR-INTENT-vN.md pasangannya
}

export interface MultiReconstructResult {
  chains: Map<number, ReconstructedChain>; // key = major version number
  unresolved: UnresolvedGroup[];
  skipped: string[]; // dari found.skipped (marker mismatch) — sama seperti sebelumnya
}

export function buildReconstructedChains(found: DiscoveredArtifacts): MultiReconstructResult;
```

**Algoritma per major version `N` (satu per `DIR-INTENT-vN.md` yang
ditemukan)**:

1. `chainVersion = "vN"`.
2. **Intent** — evaluasi **evidence-based**, tanpa konsep "isHighest" (beda
   dari algoritma lama, lihat §5.3 kenapa): `LOCKED` kalau ditemukan
   `FMN-PLAN-v(N-1).x.md` **atau** `ROADMAP-vN.md`; kalau tidak, `DRAFT` +
   `InvalidMarker` ("no downstream FMN-PLAN or ROADMAP confirms it was ever
   LOCKED"). **Tidak pernah** menebak `SUPERSEDED` — sama seperti filosofi
   lama, `supersede_reason` tidak bisa dibuktikan dari file artifact di disk
   sama sekali (field itu cuma pernah hidup di `progress-vN.json` yang justru
   sedang dibangun ulang).
3. **Roadmap** — kalau `ROADMAP-vN.md` ditemukan: `state = 'LOCKED'` kalau
   ditemukan bukti chain ini sudah `CLOSE`-worthy (`DIR-CLOSE-vN.md` ada),
   selain itu `'DRAFT'` (default — roadmap yang masih hidup, konsisten dengan
   §3.5 PLAN-EVAL-01: roadmap cuma jadi `LOCKED` lewat cascade `close lock`,
   tidak pernah berdiri sendiri). Kalau tidak ditemukan: `chain.roadmap =
   null`.
4. **Plan/Exec** — reused langsung dari algoritma `groupByMajor()` yang sudah
   ada (§ logika "clean pairing vs ambiguous group" di kode lama,
   [reconstruct.ts:207-278](../../src/engine/reconstruct.ts#L207)), cuma
   ditulis ke `data.plan.versions`/`data.exec.versions` milik **satu**
   `ChainState`, bukan array gabungan lintas-chain. Plan major untuk chain
   `vN` selalu `v(N-1).x` (invarian yang sudah dikonfirmasi tidak pernah
   tabrakan lintas-chain, §3).
5. **Close** — kalau `DIR-CLOSE-vN.md` ditemukan: sama seperti lama, tidak
   bisa dibuktikan `LOCKED` dari artifact saja (tidak ada downstream) →
   selalu `DRAFT` + `InvalidMarker` mengarahkan ke `sigma close lock` kalau
   memang seharusnya closed.
6. **Gates + `runtime_invalid` — SIMPLIFIKASI dari kode lama**: alih-alih
   menghitung `gates.gate_1_open`/dst. secara manual di dalam fungsi ini
   (seperti `buildReconstructedProgress()` lama melakukannya,
   [reconstruct.ts:320-328](../../src/engine/reconstruct.ts#L320)), langsung
   panggil `runDoctorReconciliation(chainState, [])` yang **sudah ada** di
   `chain.ts` setelah domain intent/roadmap/plan/exec/close di atas terisi.
   Ini menghindari duplikasi logika gate antara `doctor` biasa dan
   `reconstruct` (dua tempat yang harus selalu sinkron kalau dipisah) —
   `runDoctorReconciliation` sudah menghitung `gates.*` dari kondisi chain
   yang sama persis (`hasActiveLockedIntent`/`hasCleanGate2Chain`/
   `hasCleanGate3Chain`) dan menambah marker konsistensi struktural
   (active-pair, plan/exec cross-ref) di atas marker "unprovable-lock" yang
   sudah ditambahkan reconstruct sendiri di langkah 2/5. Kedua sumber marker
   digabung (bukan saling menimpa) sebelum ditulis ke `runtime_invalid.markers`.
   **Catatan**: overrides tidak relevan di titik rekonstruksi (chain baru
   saja dibangun ulang dari nol, belum ada override yang tercatat untuknya
   dalam konteks reconstruct) — panggil dengan `overrides = []`.
7. **`lifecycle_state`** — `'BUILD'` kalau ada bukti aktivitas build apa pun
   (roadmap/plan/exec/close ditemukan) atau intent `LOCKED`; `'CLOSED'` kalau
   close ditemukan **dan** berhasil dibuktikan `LOCKED` (lihat langkah 5 —
   dalam praktik ini jarang terjadi murni dari reconstruct, karena closure
   `LOCKED` nyaris tidak pernah bisa dibuktikan dari artifact saja); selain
   itu `'DESIGN'`.

**Kelompok tanpa `DIR-INTENT-vN.md`** (plan/exec/roadmap/close file
ditemukan tapi tidak ada intent doc pasangannya untuk major itu) — **tidak
bisa** direpresentasikan sebagai `ChainState` valid sama sekali, karena
`ChainState.intent` non-nullable (skema PLAN-EVAL-01 §3.2: "chain file hanya
pernah ada karena `intent new` menciptakannya"). Ini kasus baru yang tidak
ada di algoritma lama (yang punya satu `ProgressJson` gabungan sehingga bisa
menaruh entry plan yatim dengan `intent_version_ref` menunjuk versi yang
tidak ada). Kelompok begini masuk `unresolved: UnresolvedGroup[]`, **tidak**
ditulis sebagai file apa pun — dilaporkan ke Director lewat output CLI
sebagai catatan manual: "Ditemukan artifact build untuk major vN tapi tidak
ada DIR-INTENT-vN.md — tidak bisa direkonstruksi tanpa Intent doc. Pulihkan
filenya dari git history, atau ini bisa diabaikan kalau memang artifact
nyasar."

### 5.3 Kenapa tidak ada lagi `isHighest`/demosi-ke-INACTIVE untuk intent

Algoritma lama ([reconstruct.ts:151-179](../../src/engine/reconstruct.ts#L151))
mendemosi intent non-tertinggi jadi `INACTIVE` karena semua intent hidup
dalam **satu array** di **satu** `progress.json` — ambiguitas "yang mana
fokusnya" harus diselesaikan di dalam file yang sama. Di model chain-per-file,
**setiap major version adalah file terpisah**, dan `intent new` boleh
dijalankan kapan saja tanpa syarat chain sebelumnya selesai (DISCUSSION
"Konsolidasi Lanjutan" bagian 3) — artinya sangat mungkin dua chain LOCKED
hidup berdampingan secara sah (bukan korupsi). Reconstruct yang benar
mengevaluasi **setiap** major version secara independen berdasarkan bukti
downstream-nya sendiri, tidak berdasarkan "apakah ini yang tertinggi".

### 5.4 Command surface `sigma doctor --reconstruct` — resolusi target per mode

```ts
function resolveReconstructTargets(
  projectRoot: string,
  result: MultiReconstructResult,
  opts: { v?: string; allVersions?: boolean },
): number[] {
  if (opts.v && opts.allVersions) {
    throw new Error('--v and --all-versions are mutually exclusive.');
  }
  if (opts.allVersions) {
    return [...result.chains.keys()].sort((a, b) => a - b);
  }
  if (opts.v) {
    const major = parseMajorVersion(opts.v); // "v3" -> 3
    if (!result.chains.has(major)) {
      throw new Error(`No DIR-INTENT-${opts.v}.md found on disk — nothing to reconstruct for chain ${opts.v}.`);
    }
    return [major];
  }
  // Default: reconstruct only the currently active chain.
  let activeVersion: string;
  try {
    activeVersion = resolveActiveChainVersion(projectRoot);
  } catch {
    throw new Error(
      'No chain files exist yet and no --v/--all-versions was given — cannot determine which chain to reconstruct. ' +
      'Use --v <version> to target one chain, or --all-versions to reconstruct every chain found on disk.'
    );
  }
  const major = parseMajorVersion(activeVersion);
  if (!result.chains.has(major)) {
    throw new Error(`No DIR-INTENT-${activeVersion}.md found on disk for the active chain (${activeVersion}) — nothing to reconstruct.`);
  }
  return [major];
}
```

Catatan desain penting:

- **`--v`/default tidak mensyaratkan chain file sudah ada di disk** — justru
  itu skenario utama reconstruct (file hilang/korup). Yang disyaratkan adalah
  **artifact doc**-nya (`DIR-INTENT-vN.md`) ada, karena itu satu-satunya
  sumber kebenaran reconstruct.
- **`--all-versions` tidak pernah menghapus chain file untuk major yang
  tidak ditemukan artifact-nya** — hanya menimpa/menulis major yang punya
  `DIR-INTENT-vN.md` di `result.chains`. Chain lama yang filenya masih valid
  tapi kebetulan tidak match sisi ini tidak tersentuh (tidak ada operasi
  hapus di plan-eval ini sama sekali).
- **Tidak ada prompt konfirmasi tambahan** — konsisten dengan perilaku
  `--reconstruct` hari ini (flag itu sendiri sudah eksplisit consent),
  supaya tidak menambah friksi UX yang tidak diminta di scope ini.
- Setelah target ditentukan, untuk tiap major di dalamnya: `writeChain(projectRoot, "vN", result.chains.get(major).data)`,
  lalu cetak ringkasan (per domain, jumlah version, marker INVALID) — format
  output sama seperti fungsi lama, diulang per chain.

### 5.5 `sigma doctor --all-versions` (tanpa `--reconstruct`)

Loop murni atas chain file yang **sudah ada** di disk (bukan re-derive dari
artifact):

```ts
function runAllVersionsDoctor(projectRoot: string): void {
  const versions = listChainVersions(projectRoot);
  const overrides = readOverrides(projectRoot);
  if (versions.length === 0) {
    console.log('No chain exists yet. Nothing to reconcile.');
    return;
  }
  for (const chainVersion of versions) {
    const chain = readChain(projectRoot, chainVersion);
    const report = runDoctorReconciliation(chain, overrides);
    writeChain(projectRoot, chainVersion, chain);
    // cetak laporan per chain, sama format seperti runDefaultDoctor() hari ini,
    // dengan header "=== Chain vN ===" untuk memisahkan tiap bagian.
  }
}
```

Ini murni loop atas fungsi yang sudah ada — tidak ada logika reconciliation
baru yang ditulis, sesuai analisis draf awal ("bukti murah untuk
diimplementasi").

### 5.6 Kombinasi `--all-versions --reconstruct`

Dua langkah berurutan, bukan satu langkah gabungan: (1) jalankan §5.4 dengan
`opts.allVersions = true` untuk membangun ulang setiap chain dari artifact;
(2) tidak perlu langkah reconciliation terpisah setelahnya — `runDoctorReconciliation`
sudah dipanggil **di dalam** `buildReconstructedChains()` per chain (§5.2
langkah 6), jadi hasil akhirnya sudah final begitu langkah (1) selesai.

---

## 6. Keputusan yang perlu diambil — kebijakan file chain "yatim"

Ini satu-satunya open item tersisa dari DISCUSSION doc ("perilaku `doctor`
terhadap file chain yatim — auto-adopt vs cuma dilaporkan"). Sesi ini
menelusuri kembali apakah masalah ini masih nyata setelah membaca
`resolveActiveChainVersion()` yang sudah diimplementasikan PLAN-EVAL-01:

- `listChainVersions()` ([chain.ts:127-137](../../src/engine/chain.ts#L127))
  sudah menemukan **setiap** `progress-v*.json` lewat scan nama file —
  tidak butuh terdaftar di `activate_status.json` untuk "terlihat". Setiap
  chain yatim otomatis muncul di `sigma intent list` dan otomatis ikut
  direkonsiliasi oleh `sigma doctor --all-versions` (§5.5) tanpa mekanisme
  tambahan apa pun.
- `resolveActiveChainVersion()` ([chain.ts:194-229](../../src/engine/chain.ts#L194))
  **sudah** auto-default ke chain_version tertinggi yang bukan `SUPERSEDED`
  kapan pun pointer `active_chain` tidak valid/hilang — ini **sudah**
  menjawab skenario paling umum "chain baru ditulis tapi
  `activate_status.json` gagal ditulis" (crash di antara §11 DISCUSSION):
  chain yatim itu (biasanya yang tertinggi) otomatis jadi kandidat aktif
  begitu Director menjalankan command apa pun berikutnya — tanpa kode baru.

**Rekomendasi resolusi (untuk dikonfirmasi Director)**: **tidak perlu
mekanisme "auto-adopt" terpisah.** Chain yatim sudah otomatis:
1. **Terlihat** — lewat `intent list` (scan nama file, bukan manifest).
2. **Direkonsiliasi** — lewat `doctor --all-versions` (§5.5, loop semua file
   yang ada).
3. **Bisa diaktifkan** — manual lewat `intent activate --v <x>`, atau
   otomatis lewat fallback `resolveActiveChainVersion()` kalau pointer
   sedang tidak valid.

Tidak ada celah tersisa yang butuh kode tambahan — "auto-adopt" akan berarti
menebak `active_chain` secara diam-diam di luar dua jalur resmi di atas,
yang justru melanggar prinsip "jangan menebak `active_chain`" yang sudah
disepakati Director (§9/§12 DISCUSSION). **Keputusan final untuk plan-eval
ini**: perilaku "cuma dilaporkan" (lewat visibility yang sudah ada) — bukan
"auto-adopt" sebagai mekanisme baru. Ini menutup open item terakhir
DISCUSSION doc.

---

## 7. Penghapusan `src/engine/progress.ts` — checklist konkret

Draf sebelumnya menyatakan "begitu migrasi selesai, `progress.ts` bisa
dihapus total" — dicek ulang sesi ini terhadap seluruh importer nyata di
`src/`, dan ternyata **tidak sesederhana itu**: `chain.ts` sendiri masih
mengimpor banyak tipe/fungsi bersama dari `progress.ts`
([chain.ts:4-19](../../src/engine/chain.ts#L4)):

```ts
import {
  LifecycleState, PlanTracker, ArtifactTracker, ArtifactVersion,
  PendingPlanEntry, Gates, RuntimeInvalidState, InvalidGateKey,
  InvalidMarkerDomain, InvalidChainRef, InvalidMarker, OverrideEntry,
  parseMajorVersion, parseMinorVersion,
} from './progress';
```

Importer lain yang juga bergantung pada `progress.ts` (grep penuh
`src/`, sesi ini):

| File | Yang diimpor |
| --- | --- |
| `src/engine/chain.ts` | 12 tipe + `parseMajorVersion`/`parseMinorVersion` (di atas) |
| `src/utils/roadmap.ts` | `ArtifactVersion`, `parseMinorVersion` |
| `src/commands/override.ts` | `OverrideEntry` |
| `src/commands/project.ts` | `createInitialProgress` (dipakai `project start` menulis stub `progress.json` legacy) |
| `src/commands/doctor.ts` | `readOverrides`, `writeProgress`, `getInvalidMarkers` (alias `getInvalidMarkersLegacy`), `ProgressJson` |
| `src/engine/reconstruct.ts` | `ProgressJson`, `ArtifactVersion`, `InvalidMarker`, `createInitialProgress`, `hasActiveLockedIntent`, `hasCleanGate2Chain`, `hasCleanGate3Chain`, `parseMajorVersion`, `parseMinorVersion` |

Penghapusan total butuh urutan berikut, bukan satu langkah "hapus file":

1. **Relokasi tipe/fungsi yang masih dipakai** dari `progress.ts` langsung ke
   `chain.ts` (bukan file baru — `chain.ts` sudah jadi "rumah" domain state):
   `LifecycleState`, `PlanTracker`, `ArtifactTracker`, `ArtifactVersion`,
   `PendingPlanEntry`, `Gates`, `RuntimeInvalidState`, `InvalidGateKey`,
   `InvalidMarkerDomain`, `InvalidChainRef`, `InvalidMarker`, `OverrideEntry`,
   `parseMajorVersion`, `parseMinorVersion`, `readOverrides()`. Hapus baris
   `import ... from './progress'` di `chain.ts` (jadi definisi lokal).
2. **`reconstruct.ts` setelah migrasi §5** tidak lagi butuh `ProgressJson`/
   `createInitialProgress`/`hasActiveLockedIntent`/dst. sama sekali (semua
   diganti versi `chain.ts`: `ChainState`, `createInitialChain`,
   `hasActiveLockedIntent`/`hasCleanGate2Chain`/`hasCleanGate3Chain` versi
   `chain.ts`, `runDoctorReconciliation`). Update importnya ke `'./chain'`.
3. **`doctor.ts`**: `readOverrides` → import dari `'../engine/chain'` (baru
   lokasinya, langkah 1). `writeProgress`/`ProgressJson`/`getInvalidMarkersLegacy`
   dihapus total (tidak ada penggantinya — `runReconstruct()` yang baru
   menulis lewat `writeChain()` per chain, bukan `writeProgress()` tunggal).
4. **`utils/roadmap.ts`**: ganti import `ArtifactVersion`/`parseMinorVersion`
   ke `'../engine/chain'`.
5. **`commands/override.ts`**: ganti import `OverrideEntry` ke
   `'../engine/chain'`.
6. **`commands/project.ts`**: hapus import + pemakaian `createInitialProgress`
   sepenuhnya — lihat §7.1 di bawah (project.ts tidak lagi menulis
   `progress.json` legacy sama sekali).
7. **Setelah 1–6, `progress.ts` sudah nol importer** — hapus filenya.
8. **`src/config.ts`**: hapus konstanta `PROGRESS_FILE` (`config.ts:25`) —
   nol pemakai setelah langkah 6.

### 7.1 `project.ts` — berhenti menulis stub `progress.json` legacy

Scope asli plan-eval ini bertanya: "begitu tidak ada lagi yang membaca file
itu sama sekali, pertimbangkan apakah `project start` masih perlu menulis
stub itu sama sekali." Jawabannya sekarang eksplisit **tidak** — sekali
`progress.ts`/`createInitialProgress` dihapus (§7 langkah 7), tidak ada lagi
tipe untuk membuat stub itu tanpa mengimpor ulang sesuatu yang sengaja
dihapus. **Keputusan**: `project start`/`--reinit` **berhenti menulis**
`Sigma/progress.json` sama sekali — baris [project.ts:246-251](../../src/commands/project.ts#L246)
(`writeJsonSync(progressPath, initial, ...)`) dihapus, beserta variabel
`progressPath` yang jadi tidak terpakai.

**Efek berantai — dua fallback identity lain yang membaca `progress.json`
juga harus berhenti**, karena file itu tidak akan pernah eksis lagi untuk
proyek baru mana pun setelah perubahan ini (proyek lama yang sudah
di-`start` sebelum perubahan ini masih punya file lama di disk, tapi tidak
ada jaminan isinya valid/terbaru — tidak boleh jadi sumber kebenaran):

- `doctor.ts`'s `resolveProjectIdentity()` ([doctor.ts:81-115](../../src/commands/doctor.ts#L81)) —
  hapus cabang pertama (baca `progress.json`), sisakan `.sigma-identity.json`
  lalu `--id`/`--name` sebagai satu-satunya sumber. Pesan error diupdate
  (tidak lagi menyebut "progress.json is unreadable").
- `project.ts`'s `resolveRegisterIdentity()` ([project.ts:448-470](../../src/commands/project.ts#L448)) —
  perubahan yang sama persis, dipakai `sigma project register`.

Ini bukan hanya "beres-beres bawaan" — ini **wajib** dilakukan bersamaan
dengan §7 langkah 7 (hapus `progress.ts`), karena kedua fungsi ini secara
langsung membaca path `Sigma/progress.json` (bukan lewat import dari
`progress.ts`, jadi tidak otomatis error kompilasi kalau dilewatkan) — kalau
tidak diupdate, keduanya diam-diam jadi dead-code fallback yang tidak pernah
match apa pun untuk proyek baru, dan tetap membaca file basi untuk proyek
lama tanpa itu dimaksudkan sebagai fitur.

---

## 8. Rencana Test

### 8.1 `test/reconstruct.test.ts` — ditulis ulang total

File ini saat ini (4 test) menegaskan bentuk `ProgressJson` lama
(`env.progressPath`, `data.intent.versions`, dll. — lihat isi file). Setelah
migrasi §5, seluruh isinya tidak valid lagi (target file berubah jadi
`progress-vN.json` per chain, bentuk data jadi `ChainState`). Ditulis ulang
dengan cakupan setara **plus** kasus baru:

1. Single-chain clean rebuild (equivalent test lama #1) — assert lewat
   `chainPath(env, 'v1')`, bentuk `ChainState` tunggal.
2. Lone unconfirmable `DIR-INTENT` → `DRAFT` + INVALID (equivalent test lama #2).
3. Ambiguous multi-PLAN-draft group tidak ditebak (equivalent test lama #3).
4. Identity recovery lewat `--id`/`--name` tanpa membuat file backup apa pun
   (equivalent test lama #4, disesuaikan: tidak ada lagi
   `env.progressPath` untuk dirusak — buat skenario `.sigma-identity.json`
   hilang/rusak alih-alih).
5. **Baru**: `--v <version>` merekonstruksi **hanya** chain yang diminta,
   tidak menyentuh chain lain yang sudah ada di disk (dua chain fixture,
   assert chain kedua tidak berubah `updated_at`-nya).
6. **Baru**: `--all-versions` merekonstruksi **setiap** major version yang
   ditemukan (dua atau tiga `DIR-INTENT-vN.md` sekaligus di disk, tanpa
   chain file sama sekali — disaster recovery penuh), setiap
   `progress-vN.json` hasilnya diverifikasi independen.
7. **Baru**: kelompok artifact tanpa `DIR-INTENT-vN.md` pasangannya (mis.
   `FMN-PLAN-v0.1.md` sendirian tanpa `DIR-INTENT-v1.md`) dilaporkan di
   `unresolved` / stdout, **tidak** menulis file apa pun untuk major itu.
8. **Baru**: mode default (tanpa `--v`/`--all-versions`) hanya menyentuh
   chain aktif (`activate_status.json` mengarah ke `v2` dari tiga chain yang
   ditemukan di disk — assert cuma `progress-v2.json` yang ditulis/berubah).
9. **Baru**: mode default tanpa chain file sama sekali dan tanpa
   `activate_status.json` valid → pesan error terarah ke `--v`/`--all-versions`
   (§5.4).

### 8.2 File test lain yang perlu diaudit (referensi `progress.json`/`env.progressPath`)

Grep penuh (`test/`) menemukan 11 file yang menyebut `progressPath`/
`progress.json`. Sebagian besar (per pola PLAN-EVAL-01 yang sudah berjalan)
kemungkinan cuma memakai `env.progressPath` sebagai variabel path yang tidak
lagi diasersi isinya (progress.json sudah "legacy/inert" sejak PLAN-EVAL-01).
Perlu diaudit satu per satu saat implementasi (bukan diasumsikan aman):
`role-memory-bootstrap.test.ts`, `report-logs.test.ts`,
`mailbox-regression.test.ts`, `operation-log.test.ts`,
`lifecycle-hardening.test.ts`, `doctor-recovery-reset-removal.test.ts`,
`error-messages.test.ts`, `doc-check.test.ts`,
`command-helper-regression.test.ts`, plus `test/helpers.ts` sendiri
(`TestEnv.progressPath` field — kemungkinan tetap dipertahankan sebagai path
literal yang valid untuk ditulis manual di test yang butuh mensimulasikan
proyek pra-migrasi, tapi tidak lagi ditulis oleh `project start` yang
sesungguhnya).

### 8.3 Regresi penghapusan `progress.ts`

- `npm run build` bersih (tidak ada importer tersisa) — bukti mekanis bahwa
  checklist §7 lengkap.
- Uji manual end-to-end: `project start` di direktori kosong → konfirmasi
  **tidak ada** `Sigma/progress.json` yang tertulis sama sekali.
- `project register` dan `doctor --reconstruct` tanpa `.sigma-identity.json`
  dan tanpa `--id`/`--name` → keduanya gagal dengan pesan yang tidak lagi
  menyebut `progress.json`.

---

## 9. Urutan Implementasi (fase)

1. **Fase 1 — `reconstruct.ts`: migrasi algoritma ke `ChainState`.**
   `buildReconstructedChains()` (§5.2) menggantikan `buildReconstructedProgress()`.
   `reconstructProgress()` (fungsi pembungkus lama) diganti
   `reconstructAllChains(projectRoot): MultiReconstructResult` yang memanggil
   `discoverArtifacts()` + `buildReconstructedChains()`. Verifikasi:
   `npm run build` bersih, unit test langsung ke fungsi ini (tanpa CLI) untuk
   kasus grouping/unresolved.
2. **Fase 2 — `doctor.ts`: `runReconstruct()` 3-mode + `runAllVersionsDoctor()`.**
   `resolveReconstructTargets()` (§5.4), wiring flag `--v`/`--all-versions` ke
   `doctorCommand()` (Commander), `runAllVersionsDoctor()` (§5.5). Verifikasi:
   `test/reconstruct.test.ts` ditulis ulang (§8.1) hijau, `test/doctor-invalid.test.ts`
   tidak regresi (mode default tidak berubah perilaku).
3. **Fase 3 — Penghapusan `progress.ts` (§7).** Relokasi tipe/fungsi ke
   `chain.ts`, update 4 importer lain (`roadmap.ts`, `override.ts`,
   `project.ts`, `doctor.ts`), hapus stub `progress.json` di `project.ts`
   (§7.1), hapus dua fallback identity (`doctor.ts`/`project.ts`), hapus
   `PROGRESS_FILE` di `config.ts`. Verifikasi: `npm run build` bersih (bukti
   nol importer tersisa), `npm test` penuh, audit 11 file test (§8.2).
4. **Fase 4 — Verifikasi menyeluruh + dokumentasi.** Update dokumen ini
   dengan hasil aktual (jumlah test, temuan implementasi) mengikuti pola
   PLAN-EVAL-01. Manual end-to-end: disaster recovery penuh (hapus semua
   `Sigma/progress-v*.json` + `activate_status.json`, jalankan
   `doctor --reconstruct --all-versions`, konfirmasi semua chain pulih dan
   `intent activate --v <x>` bisa dijalankan manual sesudahnya).

---

## 10. Dependency

- **PLAN-EVAL-01** (wajib, sudah selesai) — file layout `progress-v*.json` +
  `activate_status.json` + seluruh domain function `chain.ts` sudah ada.
- **PLAN-EVAL-02, 04, 06** — tidak ada dependency (dikonfirmasi §3): tidak
  ada perubahan skema yang masih ditunggu dari plan-eval lain di folder ini.

## 11. Di luar scope

- Perubahan invarian ACTIVE/auto-default itu sendiri — sudah final di
  PLAN-EVAL-01, plan-eval ini cuma memakainya.
- `sigma intent activate` — sudah ada, PLAN-EVAL-01.
- "Override cross-chain leak" (entry `overrides.jsonl` lama tanpa field
  `version`) — milik PLAN-EVAL-04, tidak disentuh di sini (§3).
- Hook regenerasi `Sigma/design/intent-history.md` dari `sigma doctor`
  ("self-healing net" yang disebut DISCUSSION untuk fitur itu) — fitur
  `intent-history.md` sendiri belum ada (PLAN-EVAL-06, belum diimplementasikan).
  Titik penambahan hook itu nanti adalah di dalam `runDefaultDoctor()`/
  `runAllVersionsDoctor()`/`runReconstruct()` yang dibangun plan-eval ini —
  dicatat sebagai catatan untuk siapa pun yang mengerjakan PLAN-EVAL-06
  setelah ini, bukan pekerjaan plan-eval ini.

## 12. Risiko

- `discoverArtifacts()`/scan regex per domain sudah diverifikasi tidak
  coupled ke `ProgressJson` (§5.1) — risiko akurasi lintas-banyak-chain
  sekaligus (bukan cuma sekali untuk satu file) tetap perlu dites langsung
  (§8.1 poin 6).
- Migrasi `buildReconstructedChains()` adalah rewrite riil (mengelompokkan
  per major version, membangun N `ChainState` terpisah, kasus baru
  "unresolved group" yang tidak ada di algoritma lama) — anggarkan waktu
  setara PLAN-EVAL-01 Fase 1, bukan cuma "tambah flag ke command yang sudah
  jalan".
- **Baru, ditemukan sesi ini**: penghapusan `progress.ts` bukan operasi
  satu-file — 6 importer (§7) perlu direlokasi/diupdate secara terkoordinasi
  dalam commit yang sama, termasuk dua fallback identity yang membaca
  `Sigma/progress.json` lewat path literal (bukan import), yang mudah
  terlewat karena tidak menyebabkan error kompilasi kalau dilupakan.
- Payoff besar (hapus `progress.ts` total, hentikan penulisan
  `progress.json`) berarti kesalahan di plan-eval ini langsung menyentuh
  jalur `project start`/`project register` yang dipakai setiap proyek baru —
  perlu test coverage ketat (§8) sebelum dianggap selesai.

## 13. Verifikasi Manual End-to-End (2026-07-18)

Di luar test harness, dijalankan skenario disaster-recovery penuh terhadap
CLI ter-build (`dist/cli.js`) di direktori scratch terpisah:

1. `project start --id MANUAL --name "Manual Test" --confirm` — dikonfirmasi
   **tidak ada** `Sigma/progress.json` yang tertulis sama sekali; `activate_status.json`
   tertulis dengan `{ active_chain: null }`.
2. `intent new` → isi `DIR-INTENT-v1.md` lengkap → `intent lock` — sukses,
   `progress-v1.json` berisi `intent.state: "LOCKED"`, `gates.gate_1_open: true`.
3. **Disaster recovery**: hapus `Sigma/progress-v1.json` **dan**
   `Sigma/activate_status.json` sekaligus (skenario terburuk — kedua file
   hilang). `doctor --reconstruct --all-versions` berhasil membangun ulang
   `progress-v1.json` dari `DIR-INTENT-v1.md` — sesuai desain, hasilnya
   `DRAFT` + `INVALID` marker (bukan `LOCKED`) karena tidak ada
   ROADMAP/FMN-PLAN downstream yang membuktikan versi lama pernah `LOCKED` —
   ini **bukan bug**, ini batas jujur reconstruct: status lock asli tidak
   pernah bisa dibuktikan ulang dari artifact semata (§5.2).
4. **Ditemukan lewat langkah ini, bukan test otomatis**: dengan
   `activate_status.json` juga hilang total, `intent list`/`intent activate`/
   `session bootstrap` semuanya gagal ("Not inside a Sigma project") — ini
   **bukan regresi**, ini pemisahan tanggung jawab yang memang disengaja
   (§4/§6: `doctor --reconstruct` cuma tugas membangun ulang **file chain**,
   tidak pernah menyentuh manifest). Jalur pemulihan yang benar untuk manifest
   yang hilang total adalah `sigma project start --reinit`, dikonfirmasi
   berhasil: menulis ulang `activate_status.json`, dan `intent list`
   sesudahnya menunjukkan `v1` otomatis terpilih `*` (Active) lewat mekanisme
   auto-default `resolveActiveChainVersion()` yang sudah ada (PLAN-EVAL-01).
