# PLAN-EVAL-06 — `--title`/`--focus` Wajib + `intent-history.md` Auto-Render

**Sumber**: [DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md) (Konsolidasi Lanjutan bagian 5)
**Tanggal**: 2026-07-17 (draf awal) — detail implementasi disusun 2026-07-18, diimplementasikan 2026-07-18
**Status**: IMPLEMENTED — semua 8 langkah §12 selesai, termasuk pemulihan `title`/`focus`
lewat `--reconstruct` (§6). `npm run build` bersih, full test suite 211/211 lulus
(26 file, termasuk `test/intent-history.test.ts` baru — 12 test).
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## 0. Verifikasi kode terkini (2026-07-18) — sebelum menulis detail

Dicek langsung terhadap `src/` di commit `fd63a3d` (setelah refactor "remove legacy
progress.ts and migrate ... to chain.ts"), bukan diasumsikan dari draf 2026-07-17:

- **PLAN-EVAL-01 dan PLAN-EVAL-05 sudah 100% terimplementasi.** `src/engine/progress.ts`
  sudah tidak ada sama sekali — semua tipe/fungsi yang dirujuk draf awal
  (`ChainState`, `createInitialChain`, `writeChain`, dst.) sekarang hidup di
  `src/engine/chain.ts` (1271 baris). `sigma doctor --all-versions`/`--reconstruct`
  ([doctor.ts](../../src/commands/doctor.ts)) sudah berfungsi penuh. Dependency plan-eval
  ini terhadap keduanya **terpenuhi**, bukan lagi asumsi "kalau sudah selesai nanti".
- **`sigma intent new` masih benar-benar belum punya `--title`/`--focus`**
  ([intent.ts:50-101](../../src/commands/intent.ts#L50-L101)) — cuma `--yes`. Premis draf
  awal masih valid persis seperti ditulis.
- **`sigma intent activate --v` sudah ada dan berfungsi**
  ([intent.ts:180-198](../../src/commands/intent.ts#L180-L198)) — menolak chain
  `SUPERSEDED`, tidak butuh `--director-confirm`. Aman dipakai sebagai salah satu dari 4
  titik pemicu.
- **`SingleIntentState` ([chain.ts:147-159](../../src/engine/chain.ts#L147-L159)) belum
  punya field `title`/`focus`.** `ArtifactVersion` (dipakai plan/exec) sudah punya
  keduanya sebagai optional field — pola yang sama tinggal direplikasi ke
  `SingleIntentState`, bukan pola baru.
- **`createInitialChain(chainVersion, intentFilePath)`
  ([chain.ts:397](../../src/engine/chain.ts#L397)) dipanggil di 2 tempat produksi**:
  `intent.ts:87` (jalur normal) dan `reconstruct.ts:204` (jalur `doctor --reconstruct`,
  scan artifact di disk). Menambah parameter `title?`/`focus?` opsional ke fungsi ini
  **aman** untuk kedua caller — signature lama tetap valid secara TypeScript untuk
  `reconstruct.ts` (lihat §6 untuk konsekuensi semantiknya, bukan konsekuensi
  kompilasi).
- **`generateStageOverview()` di [roadmap.ts](../../src/utils/roadmap.ts) adalah pola
  yang sudah terbukti jalan** untuk kolom `Title`/`Focus`/`Reason` dengan fallback
  `?? 'TBD'`/`?? '—'` — dipakai sebagai referensi langsung untuk fungsi render baru di
  plan-eval ini, bukan didesain dari nol.
- **6 call-site test CLI nyata akan pecah** begitu `--title`/`--focus` jadi wajib
  (grep menyeluruh terhadap `test/`, bukan perkiraan) — daftar lengkap di §7.

Kesimpulan: tidak ada premis di draf 2026-07-17 yang keliru. Bagian di bawah ini
menggantikan draf ringkas dengan rencana konkret per-file.

---

## 1. Inti (tidak berubah dari draf)

Samakan `sigma intent new` dengan pola `sigma plan new`/`plan promote` yang sudah
mewajibkan `--title`/`--focus`, plus dokumen ringkasan lintas-chain baru
(`Sigma/design/intent-history.md`) yang 100% auto-render — supaya `Title`/`Focus`/
`Status`/`Reason` tiap chain terlihat tanpa membuka `DIR-INTENT-vX.md` penuh.

## 2. Perubahan skema — `src/engine/chain.ts`

### 2.1 `SingleIntentState` (baris 147-159)

Tambah dua field optional, persis pola `ArtifactVersion`:

```ts
export interface SingleIntentState {
  version: string;
  state: IntentState;
  file?: string;
  created_at: string;
  updated_at: string;
  locked_at?: string;
  supersede_reason?: string;
  title?: string;   // BARU
  focus?: string;   // BARU
}
```

Optional, additive — **tidak perlu bump `SCHEMA_VERSION`** (sama seperti
`ArtifactVersion.title`/`.focus` yang sudah ada hari ini tanpa bump skema). Chain file
lama tanpa field ini tetap valid; `title`/`focus` cuma `undefined`.

### 2.2 `createInitialChain()` (baris 397)

```ts
export function createInitialChain(
  chainVersion: string,
  intentFilePath: string,
  title?: string,
  focus?: string,
): ChainState {
  // ... existing body ...
  intent: {
    version: chainVersion,
    state: 'DRAFT',
    file: intentFilePath,
    created_at: now,
    updated_at: now,
    ...(title ? { title } : {}),
    ...(focus ? { focus } : {}),
  },
  // ...
}
```

`reconstruct.ts:204` tetap memanggil dengan 2 argumen — hasilnya `title`/`focus`
`undefined` untuk chain hasil reconstruct, konsisten dengan bagaimana `plan`/`exec`
reconstruct juga tidak mengisi `title`/`focus` hari ini (lihat §6).

## 3. Command — `src/commands/intent.ts`

### 3.1 `intent new` — wajibkan `--title`/`--focus`

Tambah helper lokal (pola identik `assertRequiredStageMetadata` di
[plan.ts:42-48](../../src/commands/plan.ts#L42-L48)):

```ts
function assertRequiredIntentMetadata(title: string | undefined, focus: string | undefined): void {
  if (!title?.trim()) throw new Error('sigma intent new requires --title <title>');
  if (!focus?.trim()) throw new Error('sigma intent new requires --focus <focus>');
  // §6.2 — intent-history.md is a plain pipe-split table, and doctor --reconstruct
  // parses it back to recover title/focus. "|"/newlines would corrupt both.
  if (/[|\n\r]/.test(title)) throw new Error('--title cannot contain "|" or a newline (breaks the intent-history.md table and its recovery parser)');
  if (/[|\n\r]/.test(focus)) throw new Error('--focus cannot contain "|" or a newline (breaks the intent-history.md table and its recovery parser)');
}
```

Di command builder:

```ts
cmd.command('new')
  .description('Create a new DIR-INTENT draft (auto-creates and auto-activates a new chain)')
  .requiredOption('--title <title>', 'Intent title written into intent-history.md')
  .requiredOption('--focus <focus>', 'Intent focus summary written into intent-history.md')
  .option('--yes', 'Skip interactive APPROVE prompt when reopening a CLOSED project')
  .action(async (opts: { title?: string; focus?: string; yes?: boolean }) => {
    try {
      assertRequiredIntentMetadata(opts.title, opts.focus);
      // ... existing reopen-preflight logic unchanged ...
      const chain = createInitialChain(chainVersion, relPath, opts.title, opts.focus);
      writeChain(projectRoot, chainVersion, chain);
      writeActivateStatus(projectRoot, chainVersion);
      renderIntentHistoryFile(projectRoot); // BARU — titik pemicu 1/4
      // ... existing validation output unchanged ...
```

Catatan: `requiredOption` dari commander sudah melempar error sebelum `.action()`
jalan sama sekali kalau flag hilang — `assertRequiredIntentMetadata` di sini murni
jaring pengaman kedua untuk string kosong/whitespace (`--title ""`), identik alasan
kenapa `plan.ts` juga punya keduanya (`requiredOption` + assert manual).

### 3.2 `intent lock` — titik pemicu 2/4

Tambah satu baris setelah `writeChain(projectRoot, chainVersion, chain)`:

```ts
writeChain(projectRoot, chainVersion, chain);
renderIntentHistoryFile(projectRoot); // BARU
console.log(`DIR-INTENT ${version} LOCKED. ...`);
```

### 3.3 `intent supersede` — titik pemicu 3/4

Tambah setelah `writeChain(projectRoot, opts.v, chain)`:

```ts
writeChain(projectRoot, opts.v, chain);
renderIntentHistoryFile(projectRoot); // BARU
console.log(`DIR-INTENT ${opts.v} superseded. ...`);
```

### 3.4 `intent activate --v` — titik pemicu 4/4

Tambah setelah `writeActivateStatus(projectRoot, opts.v)`:

```ts
writeActivateStatus(projectRoot, opts.v);
renderIntentHistoryFile(projectRoot); // BARU
console.log(`Active chain switched to ${opts.v}.`);
```

**Catatan penting (temuan verifikasi, bukan asumsi)**: kolom `intent-history.md` yang
disepakati (§4) adalah `Version | Title | Focus | Status | Reason` — **tidak ada kolom
Active**. Artinya render ulang di titik pemicu ini **tidak mengubah isi file sama
sekali** dibanding sebelum `activate` dijalankan (fakta Version/Title/Focus/Status/
Reason semua per-chain, tidak berubah karena pointer aktif berpindah). Ini tetap
sesuai dokumen sumber (`activate` eksplisit didaftarkan sebagai salah satu dari 4
titik pemicu di kedua dokumen), dan konsisten dengan filosofi "doctor selalu render
ulang tanpa syarat, bukan smart-diff" yang sudah dipakai di titik pemicu lain — jadi
diimplementasikan apa adanya sebagai no-op yang aman, bukan dihilangkan secara
sepihak. Kalau Director ingin kolom Active ditambahkan supaya titik pemicu ini punya
efek nyata, itu perubahan scope yang perlu dikonfirmasi eksplisit sebelum
implementasi — **belum diasumsikan di rencana ini** (menghindari kolom
"mudah-diperluas-nanti" tanpa kebutuhan sekarang, sesuai prinsip ronde audit AUD yang
sudah dicatat di DISCUSSION doc).

## 4. Modul render baru — `src/utils/intentHistory.ts`

File baru, meniru pola `src/utils/roadmap.ts` (import dari `chain.ts`, tidak sebaliknya
— menjaga `chain.ts` sebagai layer data murni):

```ts
import fs from 'fs-extra';
import path from 'path';
import { PROJECT_SIGMA_DIR } from '../config';
import { ChainState, listChainVersions, readChain } from '../engine/chain';

export function intentHistoryPath(projectRoot: string): string {
  return path.join(projectRoot, PROJECT_SIGMA_DIR, 'design', 'intent-history.md');
}

export function generateIntentHistoryContent(chains: ChainState[]): string {
  const header = [
    '# Intent History',
    '',
    '<!-- Auto-generated by `sigma intent` (new/lock/supersede/activate) and `sigma doctor`. -->',
    '<!-- Do not edit by hand — Sigma CLI overwrites this file in full on every trigger. -->',
    '',
    '| Version | Title | Focus | Status | Reason |',
    '| :--- | :--- | :--- | :--- | :--- |',
  ];
  const rows = chains.map(chain => {
    const { version, state, supersede_reason } = chain.intent;
    const title = chain.intent.title ?? 'TBD';
    const focus = chain.intent.focus ?? 'TBD';
    const reason = state === 'SUPERSEDED' ? (supersede_reason ?? '—') : '—';
    return `| ${version} | ${title} | ${focus} | ${state} | ${reason} |`;
  });
  return [...header, ...rows, ''].join('\n');
}

export function renderIntentHistoryFile(projectRoot: string): void {
  const versions = listChainVersions(projectRoot);
  if (versions.length === 0) return; // nothing to render yet — pre-`intent new`
  const chains = versions.map(v => readChain(projectRoot, v));
  const content = generateIntentHistoryContent(chains);
  const filePath = intentHistoryPath(projectRoot);
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}
```

Desain sengaja **tidak** memakai delimiter `SIGMA:RENDER:START/END`
([roadmap.ts:32](../../src/utils/roadmap.ts#L32)) — beda dari `renderRoadmapFile()`
yang harus menjaga bagian manual di sekitar bagian auto-render. File ini 100%
auto-render, timpa seluruh isi tiap kali, tidak butuh file template artifact
(konsisten dengan keputusan DISCUSSION §5).

`listChainVersions()` sudah mengembalikan versi terurut ascending numerik
([chain.ts:234-244](../../src/engine/chain.ts#L234-L244)) — tidak perlu sorting
tambahan di modul baru ini.

## 5. Jaring pengaman self-heal — `src/commands/doctor.ts`

Tambah `renderIntentHistoryFile(projectRoot)` di **tiga** tempat:

- `runDefaultDoctor()` — setelah blok existing selesai (atau di awal, sebelum print
  report; urutan tidak penting karena keduanya independen). Guard "no chain yet" yang
  sudah ada ([doctor.ts:27-32](../../src/commands/doctor.ts#L27-L32)) sudah cukup —
  `renderIntentHistoryFile()` sendiri juga no-op kalau `listChainVersions()` kosong
  (lihat §4), jadi aman dipanggil tanpa guard tambahan, tapi diletakkan **setelah**
  guard existing supaya tidak menulis apa pun sebelum pesan "No chain exists yet"
  tercetak.
- `runAllVersionsDoctor()` — sekali di luar loop `for (const chainVersion of
  versions)`, bukan di dalam loop (rendernya bukan per-chain, cukup satu pemanggilan
  yang membaca ulang semua chain setelah loop reconciliation selesai).
- `runReconstruct()` — setelah loop `for (const major of targets)` selesai menulis
  semua `writeChain(...)`, sebelum bagian "Unresolved"/"Skipped" report. Menjamin
  `intent-history.md` konsisten dengan hasil reconstruct terbaru, termasuk kasus
  `title`/`focus` yang hilang (lihat §6).

Import `renderIntentHistoryFile` dari `../utils/intentHistory` di `doctor.ts`.

## 6. `--reconstruct` memulihkan `title`/`focus` dari `intent-history.md` (revisi
   2026-07-18 — Director meminta ini di-auto-detect, bukan diterima sebagai batasan)

Draf sebelumnya mencatat bagian ini sebagai batasan yang diterima ("title/focus hilang
kalau di-reconstruct, sama seperti plan/exec"). Director mengoreksi: karena
`Sigma/design/intent-history.md` **satu-satunya tempat lain** di luar
`progress-v<N>.json` yang menyimpan `title`/`focus` (§0 — `DIR-INTENT-TEMPLATE.md`
tidak punya field ini), dan skenario paling umum untuk `--reconstruct` adalah *satu*
file JSON hilang/korup sementara file lain di `Sigma/` tetap utuh — `intent-history.md`
layak dipakai sebagai sumber pemulihan sekunder, bukan diterima hilang begitu saja.

### 6.1 Desain

- **Tidak reuse parsing dari `utils/intentHistory.ts`** — logic baca ditaruh langsung
  di `src/engine/reconstruct.ts` sebagai fungsi privat, supaya `engine/` tidak jadi
  bergantung ke `utils/` (belum ada preseden arah dependency itu di kode saat ini;
  `reconstruct.ts` sudah terbiasa mengimplementasikan scan/parsing artifact-nya sendiri
  — lihat `PATTERNS`/`readDocType()` yang sudah ada). Konsekuensinya: format baris
  tabel (`| Version | Title | Focus | Status | Reason |`) punya dua "penulis" logic
  independen (render di `utils/intentHistory.ts`, parse di `engine/reconstruct.ts`) —
  keduanya harus tetap sinkron secara manual kalau format tabel berubah di kemudian
  hari. Diberi komentar silang di kedua sisi supaya tidak diam-diam drift.

- **Fungsi baru privat di `reconstruct.ts`**:

  ```ts
  // Recovery source for `title`/`focus`: Sigma/design/intent-history.md is the only
  // place these fields persist outside progress-v<N>.json (DIR-INTENT templates never
  // carry them — PLAN-EVAL-06 §0). If it survived whatever wiped/corrupted the chain
  // file, read it back instead of losing the data. Deliberately a plain pipe-split,
  // not a markdown table parser — this is why `sigma intent new --title/--focus`
  // rejects literal "|" and newlines (see intent.ts): keeping the row format this
  // simple is what makes lossless parse-back cheap. Keep in sync with
  // generateIntentHistoryContent() in utils/intentHistory.ts if the column shape ever
  // changes.
  function readIntentHistoryMetadata(projectRoot: string): Map<string, { title?: string; focus?: string }> {
    const filePath = path.join(projectRoot, PROJECT_SIGMA_DIR, 'design', 'intent-history.md');
    const result = new Map<string, { title?: string; focus?: string }>();
    if (!fs.existsSync(filePath)) return result;

    for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
      const cells = line.split('|').map(c => c.trim());
      if (cells.length < 6) continue; // not a `| vN | Title | Focus | Status | Reason |` row
      const [, version, title, focus] = cells;
      if (!/^v\d+$/.test(version)) continue; // skips header row + the `:---` separator row
      result.set(version, {
        title: title && title !== 'TBD' ? title : undefined,
        focus: focus && focus !== 'TBD' ? focus : undefined,
      });
    }
    return result;
  }
  ```

- **`reconstructAllChains()` ([reconstruct.ts:331](../../src/engine/reconstruct.ts#L331))**:

  ```ts
  export function reconstructAllChains(projectRoot: string): MultiReconstructResult {
    const found = discoverArtifacts(projectRoot);
    const recoveredMetadata = readIntentHistoryMetadata(projectRoot);
    return buildReconstructedChains(found, recoveredMetadata);
  }
  ```

- **`buildReconstructedChains()` ([reconstruct.ts:156](../../src/engine/reconstruct.ts#L156))** —
  tambah parameter kedua dengan default aman (tidak ada pemanggil langsung selain
  `reconstructAllChains()` di kode maupun test, dicek lewat grep §0, tapi default
  tetap ditambah sebagai jaring pengaman):

  ```ts
  export function buildReconstructedChains(
    found: DiscoveredArtifacts,
    recoveredMetadata: Map<string, { title?: string; focus?: string }> = new Map(),
  ): MultiReconstructResult {
    // ...
    const chainVersion = `v${major}`;
    const recovered = recoveredMetadata.get(chainVersion) ?? {};
    const chain = createInitialChain(chainVersion, intentEntry.file, recovered.title, recovered.focus);
    // ...
  }
  ```

### 6.2 Guard baru — `--title`/`--focus` menolak `|` dan newline

Karena `intent-history.md` sekarang jadi sumber pemulihan data (bukan cuma dokumen
kosmetik), baris tabel harus tetap dapat diparse balik dengan aman. Parser di §6.1
sengaja plain pipe-split (bukan markdown table parser sungguhan) — kalau `--title`/
`--focus` mengandung `|` atau newline, baris tabel rusak (kolom bergeser) dan parse-
back gagal diam-diam (mengembalikan `undefined`, bukan error — kehilangan data tanpa
peringatan).

**Keputusan**: `assertRequiredIntentMetadata()` (§3.1) menolak input yang mengandung
`|`, `\n`, atau `\r`, dengan pesan error eksplisit ("breaks the intent-history.md
table and its recovery parser"). Ini pembatasan input baru — kalau Director lebih
suka skema escape/unescape dibanding penolakan langsung, ini perubahan desain kecil
yang perlu dikonfirmasi ulang sebelum implementasi, belum diasumsikan sebagai final.

**Catatan cakupan**: kerentanan format tabel yang sama juga ada di Stage Overview
ROADMAP (`plan`/`exec` punya `title`/`focus` dengan pola render identik,
[roadmap.ts:16-35](../../src/utils/roadmap.ts#L16-L35)) — tapi Stage Overview **tidak
pernah diparse balik** oleh apa pun (murni tampilan), jadi risikonya cuma kosmetik
(kolom bergeser di dokumen), bukan kehilangan data. **Sengaja tidak disentuh** di
plan-eval ini untuk menjaga scope tetap kecil dan terisolasi — dicatat di sini supaya
tidak terlupakan sebagai potensi follow-up kecil terpisah, bukan diam-diam diabaikan.

### 6.3 Kapan pemulihan ini benar-benar bisa terjadi

- **Bisa pulih**: `progress-v<N>.json` hilang/korup, tapi `Sigma/design/intent-history.md`
  masih ada dan masih punya baris untuk versi itu dengan `title`/`focus` bukan `TBD`.
- **Tidak bisa pulih (fallback ke `TBD`, sama seperti draf sebelumnya)**: seluruh
  folder `Sigma/` hilang total (maka `DIR-INTENT-vX.md` juga hilang — reconstruct
  sendiri sudah tidak berjalan untuk versi itu, lihat "Unresolved" di
  `runReconstruct()`), atau `intent-history.md` memang belum pernah sempat dirender
  untuk versi itu (mis. korup terjadi sebelum titik pemicu pertama sempat jalan —
  skenario sangat sempit).
- Loop pemulihan-diri konsisten dengan §5: `readIntentHistoryMetadata()` membaca file
  **lama** di awal `reconstructAllChains()` (sebelum chain manapun ditulis ulang),
  lalu `runReconstruct()` di `doctor.ts` memanggil `renderIntentHistoryFile()` di akhir
  — jadi hasilnya konsisten: kalau pemulihan berhasil, file tetap menampilkan nilai
  yang benar; kalau gagal, file jujur menampilkan `TBD` sesuai kenyataan data yang
  hilang.

## 7. Test yang akan pecah — wajib diperbaiki sebagai bagian plan-eval ini

Grep menyeluruh (`grep -rln "intent new" test/`) menghasilkan 6 file; dari situ, 6
pemanggilan CLI nyata (bukan komentar/string assertion) butuh tambahan
`--title "..." --focus "..."`:

| File | Baris | Perbaikan |
| --- | --- | --- |
| `test/command-helper-regression.test.ts` | 20 | `runCli('intent new --title "X" --focus "Y"', ...)` |
| `test/doc-check.test.ts` | 29 | idem |
| `test/doc-check.test.ts` | 46 | idem |
| `test/intent-reopen.test.ts` | 29 | idem (plus `--yes`/prompt input tetap seperti semula) |
| `test/intent-reopen.test.ts` | 47 | idem (`--yes` tetap) |
| `test/intent-supersede.test.ts` | 210 | idem (`--yes` tetap) |

`test/intent-list.test.ts`, `test/role-memory-bootstrap.test.ts` hanya menyinggung
string `"intent new"` di pesan/komentar (`"None. Run: sigma intent new"`) — tidak
memanggil CLI, **tidak perlu diubah**.

`test/chain-engine.test.ts` memanggil `createInitialChain()` langsung (bukan lewat
CLI) di banyak tempat — semua tetap valid karena `title`/`focus` opsional (§2.2), tidak
perlu diubah kecuali test baru ditambahkan khusus untuk field ini.

## 8. Test baru — `test/intent-history.test.ts`

- `intent new` tanpa `--title`/`--focus` → exit 1, pesan error jelas (baik dari
  `requiredOption` commander maupun dari `assertRequiredIntentMetadata` untuk kasus
  string kosong).
- `intent new --title "Foo" --focus "Bar"` → `Sigma/design/intent-history.md` dibuat,
  berisi satu baris `| v1 | Foo | Bar | DRAFT | — |`.
- `intent lock` → baris berubah jadi `LOCKED`.
- `intent supersede --v v1 --reason "..." --director-confirm` → baris jadi
  `SUPERSEDED` dengan kolom Reason terisi reason yang diberikan.
- `intent activate --v v1` (setelah `intent new` kedua membuat v2 aktif) → file
  ter-render ulang, isi tabel **tidak berubah** (§3.4) tapi tidak error/tidak korup.
- Dua chain (`v1` lalu `v2`) → `intent-history.md` menampilkan kedua baris terurut
  `v1` lalu `v2`.
- Hapus `intent-history.md` manual, lalu jalankan `sigma doctor` (default) →
  file pulih dengan isi benar. Ulangi untuk `--all-versions`.
- `sigma doctor --reconstruct` pada chain yang `progress-v<N>.json`-nya dihapus manual,
  tapi `intent-history.md` masih ada dan masih punya baris `title`/`focus` terisi untuk
  versi itu → verifikasi eksplisit bahwa hasil reconstruct memulihkan `title`/`focus`
  yang sama (bukan `TBD`) — test positif untuk §6.
- `sigma doctor --reconstruct` saat `intent-history.md` tidak ada sama sekali (mis.
  seluruh `Sigma/design/` hilang) → tetap jalan tanpa error, hasilnya `TBD` (fallback
  §6.3, bukan crash).
- `intent new --title "Bad|Value" --focus "ok"` dan `--focus "line1\nline2"` → exit 1,
  pesan error jelas dari guard §6.2 (kedua arah: `|` di title, newline di focus).

## 9. Di luar scope (tidak berubah dari draf)

- Command ketiga terpisah untuk data yang sama — eksplisit ditolak di ronde audit AUD
  ("Intent Evolution sebagai layer baru").
- Menambah kolom Active ke `intent-history.md` (lihat §3.4) — bukan bagian scope
  kecuali diminta eksplisit oleh Director.
- Menyimpan `title`/`focus` ke dalam `DIR-INTENT-vX.md` supaya reconstruct-able (§6) —
  perubahan template governance yang lebih besar, plan-eval terpisah kalau memang
  dibutuhkan nanti.
- **PLAN-EVAL-03 (Migration & JLH Cutover) — postponed oleh Director** (beda device
  saat ini). Tidak ada dependency dari plan-eval ini ke PLAN-EVAL-03 — keduanya
  independen, penundaan PLAN-EVAL-03 tidak memblokir pekerjaan ini.

## 10. Dependency (dikonfirmasi terpenuhi, §0)

- **PLAN-EVAL-01** — selesai. `intent new`/`lock`/`supersede`/`activate` beroperasi di
  model chain.
- **PLAN-EVAL-05** — selesai. `doctor --all-versions`/`--reconstruct` tersedia sebagai
  titik integrasi self-heal.

## 11. Risiko (diperbarui dengan temuan konkret)

- Kecil, sesuai penilaian draf awal. Risiko utama tetap "salah satu dari 4 titik
  pemicu lupa dikaitkan" — dimitigasi oleh `doctor` (§5), dan sekarang tiap titik
  pemicu punya test eksplisit terencana (§8), bukan cuma niat.
- **Direvisi (§6, atas permintaan Director)**: `title`/`focus` sekarang **dipulihkan**
  dari `intent-history.md` saat `doctor --reconstruct`, bukan diterima hilang. Risiko
  baru dari perubahan ini: (a) `engine/reconstruct.ts` mendapat parser pipe-split
  privat yang harus tetap sinkron manual dengan format render di
  `utils/intentHistory.ts` (§6.1 — dimitigasi lewat komentar silang di kedua sisi,
  bukan lewat shared code, supaya tidak membuat `engine/` bergantung ke `utils/`);
  (b) guard karakter `|`/newline baru di `--title`/`--focus` (§6.2) adalah pembatasan
  input yang sebelumnya tidak ada — kecil, tapi tetap perubahan perilaku CLI yang
  perlu dikonfirmasi Director (belum final kalau ternyata skema escape lebih
  disukai).
- **Baru**: 6 test existing pecah (§7) — sudah diinventarisasi lengkap, perbaikannya
  mekanis (tambah 2 flag), tidak ada risiko tersembunyi di baliknya.

## 12. Urutan kerja implementasi (kalau disetujui)

1. `chain.ts` — tambah `title?`/`focus?` ke `SingleIntentState`, update
   `createInitialChain()` signature.
2. `src/utils/intentHistory.ts` — file baru (§4).
3. `intent.ts` — wajibkan `--title`/`--focus` di `new` + guard karakter `|`/newline
   (§6.2); pasang 4 titik pemicu render.
4. `doctor.ts` — pasang render di 3 tempat (§5).
5. `reconstruct.ts` — tambah `readIntentHistoryMetadata()` privat, sambungkan lewat
   `reconstructAllChains()`/`buildReconstructedChains()` (§6.1).
6. Perbaiki 6 test existing (§7).
7. Tambah `test/intent-history.test.ts` (§8), termasuk 3 test baru untuk pemulihan
   `--reconstruct` dan guard karakter (§6).
8. `npm run build` + jalankan full test suite — pastikan tidak ada regresi di luar
   yang sudah diinventarisasi.

---

**Menunggu approval eksplisit Director sebelum implementasi dimulai** (sesuai
Director Authorization Language di CLAUDE.md — plan ini bukan lock/gate Sigma, tapi
tetap perubahan kode nyata).
