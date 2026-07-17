# PLAN-EVAL-01 — Core Storage & Schema Migration (Opsi C Foundation)

**Sumber**: [DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md)
**Tanggal**: 2026-07-17 (draf awal) — didalami 2026-07-17 (Professional Mode, terhadap kode nyata `src/`) — kelima keputusan §8 DIKONFIRMASI Director 2026-07-17.
**Status**: DRAFT — didalami, kelima keputusan skema di §8 sudah dikonfirmasi Director, belum LOCKED (bukan FMN-PLAN, tidak ada mekanisme lock Sigma untuk dokumen ini). Prioritas #1 (fondasi, blocking semua plan-eval lain di folder ini). Menunggu approval eksplisit Director untuk mulai Fase 0 implementasi (§6).
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma. Pendalaman di bawah ditulis dengan membaca langsung `src/engine/progress.ts` (1313 baris), `src/engine/reconstruct.ts`, `src/utils/fs.ts`, `src/utils/docCheck.ts`, `src/commands/{intent,doctor,session,plan,project}.ts`, dan `test/helpers.ts` — bukan cuma dari DISCUSSION doc. Beberapa temuan di bawah adalah konsekuensi struktural yang **belum eksplisit** ditulis di DISCUSSION doc; masing-masing ditandai dan dikumpulkan di §8, dan sudah **DIKONFIRMASI Director** — lihat §8 untuk status akhir tiap poin.

---

## 1. Inti

Ganti storage `Sigma/progress.json` tunggal (nested per-domain) dengan model
per-chain, analog `refs/heads/<branch>` + `HEAD` di Git:

```text
Sigma/activate_status.json  ← BARU, cuma { active_chain }
Sigma/progress-v1.json      ← ChainState v1
Sigma/progress-v2.json      ← ChainState v2, dst.
```

Nama `progress.json` pensiun total — tidak dipakai lagi untuk manifest
maupun file chain.

## 2. Scope (ringkas — detail di §3–§6)

- `intent`/`roadmap`/`close` jadi objek tunggal per chain (bukan array
  `versions`). `plan`/`exec` **tetap** array multi-versi — tidak berubah.
- Layer resolusi baru: setiap command baca `activate_status.json` dulu untuk
  tahu `progress-v<N>.json` mana yang aktif, sebelum baca/tulis state.
- Invarian "tepat satu chain ACTIVE": kalau `active_chain` tidak valid
  (kosong/menunjuk chain tak ada), auto-default ke Intent tertinggi yang
  belum `SUPERSEDED` — bukan hard-stop.
- Fold `sigma progress *` (tidak pernah dibuat) → seluruhnya jadi
  `sigma intent new` (auto-create + auto-activate chain baru),
  `sigma intent activate --v <versi>`, `sigma intent list` (diperluas jadi
  projection lintas-chain, bukan cache).
- Rewrite ~104 call site array→objek di 9 file command
  (`session.ts`, `close.ts`, `project.ts`, `intent.ts`, `override.ts`,
  `plan.ts`, `doctor.ts`, `exec.ts`, `roadmap.ts`) + 53 panggilan
  `readProgress`/`writeProgress`, **plus** `src/utils/fs.ts` (`findProjectRoot`)
  dan `src/utils/docCheck.ts` (`resolveSigmaDocPath`) — dua file yang tidak
  disebut eksplisit di DISCUSSION doc tapi tersentuh langsung (lihat §3.6, §5).
- `SUPERSEDED` chain terminal permanen (kebal `intent activate`), tapi
  tetap tinggal di `Sigma/` selamanya (tidak dipindah ke arsip terpisah).
- Urutan tulis `intent new`: tulis file chain baru dulu, baru update
  `activate_status.json` terakhir (aman kalau proses mati di tengah).
- `sigma intent activate` tidak butuh `--director-confirm` (mengandalkan
  default-ke-terbaru + visibility wajib di `session bootstrap`, bukan
  friksi otorisasi).

---

## 3. Skema Data — Tipe Konkret

### 3.1 `ActivateStatus` (manifest, `Sigma/activate_status.json`)

```ts
export interface ActivateStatus {
  active_chain: string | null; // "v1", "v2", ... — null hanya sebelum intent new pertama
}
```

Tidak ada field lain. Tidak ada `schema_version` di sini — versi skema
proyek sudah dan tetap dipegang `.sigma-identity.json`/`ChainState.schema_version`;
menambah satu lagi akan melanggar "store facts, not summaries" untuk alasan
yang sama seperti `project_id`/`project_name` yang sudah ditolak masuk sini.

### 3.2 `ChainState` (per-chain, `Sigma/progress-v<N>.json`)

```ts
export type IntentState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';     // lihat §3.4 — INACTIVE dijatuhkan
export type RoadmapState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';    // lihat §3.5 — ACTIVE/INACTIVE dijatuhkan
export type CloseState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';      // tidak berubah

export interface SingleIntentState {
  version: string;         // == chain_version, selalu — tidak pernah beda
  state: IntentState;
  file?: string;
  created_at: string;
  updated_at: string;
  locked_at?: string;
  supersede_reason?: string;
  // superseded_by DIJATUHKAN — lihat §3.4
}

export interface SingleRoadmapState {
  version: string;
  state: RoadmapState;
  file?: string;
  created_at: string;
  updated_at: string;
  locked_at?: string;
  supersede_reason?: string;
  // intent_version_ref DIJATUHKAN — selalu == chain.intent.version, lihat §3.5
}

export interface SingleCloseState {
  version: string;
  state: CloseState;
  file?: string;
  created_at: string;
  updated_at: string;
  locked_at?: string;
  supersede_reason?: string;
  // intent_version_ref DIJATUHKAN — alasan sama seperti roadmap
}

export interface ChainState {
  schema_version: string;
  chain_version: string;              // "v1" — sama dengan intent.version dan suffix nama file
  created_at: string;
  updated_at: string;
  lifecycle_state: LifecycleState;    // PER-CHAIN sekarang — lihat §3.3
  intent: SingleIntentState;          // tidak pernah null — chain lahir dari intent new
  roadmap: SingleRoadmapState | null; // null sampai `roadmap new` dijalankan
  plan: PlanTracker;                  // TIDAK BERUBAH — tetap { active_version, active_state, versions[], pending[] }
  exec: ArtifactTracker;              // TIDAK BERUBAH — tetap { active_version, active_state, versions[] }
  close: SingleCloseState | null;     // null sampai `close new` dijalankan
  gates: Gates;                       // tidak berubah bentuk, tapi sekarang murni per-chain
  runtime_invalid?: RuntimeInvalidState;
}
```

Field yang **sengaja tidak ada** di `ChainState`: `project_id`, `project_name`.
Lihat §3.3.

`roadmap`/`close` pakai `| null` (bukan sentinel object kosong seperti
`ArtifactTracker` lama dengan `active_version: null`) — karena keduanya
sekarang objek tunggal, bukan tracker; "belum ada" paling jujur direpresentasikan
sebagai tidak ada objek sama sekali, bukan objek placeholder. `intent` tidak
pernah `null` karena keberadaan file `ChainState` itu sendiri **disebabkan**
oleh `intent new` — tidak ada skenario chain file ada tapi intent-nya kosong.

### 3.3 Temuan baru — `project_id`/`project_name` dan `lifecycle_state` tidak disebut eksplisit di DISCUSSION doc

Diagram struktur file di DISCUSSION doc hanya menulis
`Sigma/progress-v1.json ← ChainState v1 (intent, roadmap, plan, exec, close, gates, runtime_invalid)`
— tidak menyebut `project_id`/`project_name`/`lifecycle_state` sama sekali.
Dua kesimpulan diambil di sini secara eksplisit (bukan asumsi diam-diam),
karena keduanya menentukan bentuk `ChainState` dan blast radius §5:

- **`project_id`/`project_name` tidak masuk `ChainState`.** Ini perpanjangan
  langsung dari prinsip yang Director sudah pakai untuk menolak field itu
  masuk `activate_status.json` (audit "store facts, not summaries", DISCUSSION
  §10) — identitas proyek adalah fakta project-level, sudah dan cukup hidup
  di `.sigma-identity.json`, sudah dan tetap satu-satunya sumbernya (dipakai
  `doctor --reconstruct` sebagai fallback hari ini juga). Menaruhnya lagi di
  tiap `progress-v<N>.json` menduplikasi fakta yang sama N kali. Konsekuensi:
  command apa pun yang mencetak `data.project_name`/`data.project_id` hari
  ini (mis. `session.ts:146`) harus baca `.sigma-identity.json` terpisah —
  layer resolusi §4 menyediakan ini dalam satu panggilan gabungan supaya
  tidak jadi 53 titik baca identitas manual.
- **`lifecycle_state` jadi per-chain, bukan lagi project-level.** Ini
  konsekuensi struktural, bukan pilihan bebas: begitu Director menegaskan
  `activate_status.json` **hanya** `{ active_chain }` (DISCUSSION §10), tidak
  ada file lain yang tersisa untuk menampung "lifecycle project" yang
  bersifat mutable-sering — satu-satunya tempat yang konsisten adalah di
  dalam `ChainState` itu sendiri. Ini juga selaras dengan prinsip isolasi
  total: chain v1 yang sudah `CLOSED` dan chain v2 yang baru `DESIGN` memang
  dua siklus hidup independen, sama seperti dua branch Git tidak berbagi satu
  status "lifecycle". `sigma project status` yang hari ini mencetak satu
  `lifecycle_state` global akan mencetak lifecycle **chain aktif** (delegasi
  ke chain aktif, pola yang sama seperti semua command lain di §5).
  **DIKONFIRMASI Director 2026-07-17** — lihat §8 poin 1 dan 2.

### 3.4 Temuan baru — `IntentState` kehilangan `INACTIVE` sebagai konsekuensi struktural langsung Opsi C

Ini temuan paling material dari pembacaan kode. `lockActiveIntent()`
([progress.ts:818-856](../../src/engine/progress.ts#L818)) hari ini punya
loop eksplisit:

```ts
for (const v of data.intent.versions) {
  if (v.state === 'LOCKED') { v.state = 'INACTIVE'; ... }
}
```

Loop ini ada untuk satu alasan: di skema lama, `intent` adalah **array**
dalam **satu file** — jadi ketika Director membuka intent major baru
(`intent new` → `intent lock`) sementara intent major sebelumnya masih
`LOCKED` di array yang sama, entry lama harus didemosi supaya `active_version`
tidak ambigu. `INACTIVE` murni artefak dari "banyak versi intent berbagi satu
array" itu sendiri.

Di Opsi C, **skenario itu tidak bisa terjadi lagi secara struktural** — setiap
major version intent baru berarti file `progress-v<N>.json` baru
(DISCUSSION §"Konsolidasi Lanjutan" bagian 2: "intent new pasti dan selalu
membuka major version baru"). Dalam satu file chain, `intent` hanya pernah
punya **satu** entry sepanjang hidup file itu — tidak pernah ada "entry lain
di array yang sama" untuk didemosi. Konsep "chain mana yang sedang jadi
fokus" sepenuhnya sudah dipegang `activate_status.json.active_chain`, bukan
lagi oleh state `INACTIVE` pada objek intent itu sendiri.

**Konsekuensi konkret**:

- `IntentState` per-chain jadi `'DRAFT' | 'LOCKED' | 'SUPERSEDED'` — 3 state,
  sama seperti `CloseState`/`PlanState`/`ExecState`, bukan 4.
- `lockActiveIntent()` kehilangan seluruh loop demosi-ke-INACTIVE — jadi
  jauh lebih pendek: set `LOCKED`, `locked_at`, buka Gate 1, set
  `lifecycle_state = 'BUILD'`, hitung ulang Gate 2/3 dari chain yang sama
  (semua logika ini tetap perlu, cuma loop array-nya yang hilang).
- `supersedeIntentVersion()`'s guard `if (target.state !== 'LOCKED' &&
  target.state !== 'INACTIVE')` menyusut jadi `if (target.state !== 'LOCKED')`.
- Field `superseded_by` pada intent (dan sudah dijatuhkan juga untuk
  roadmap/close, lihat §3.2) kehilangan sumber datanya: logika lama mencari
  "successor" lewat `data.intent.versions.find(v => v.version !== version && ...)`
  — pencarian yang cuma masuk akal kalau ada beberapa intent dalam satu
  array. Dalam satu chain file tidak ada "successor" untuk dicari. Suksesi
  antar-chain (chain v1 di-supersede, chain v2 jadi penerusnya) tidak
  dilacak sebagai pointer tersimpan — itu tepat konsekuensi dari isolasi
  total (mutasi satu chain file tidak boleh tahu soal file chain lain).
  Director bisa melihat urutan suksesi lewat `intent list` (projection
  lintas-chain, terurut berdasar `chain_version`), bukan lewat field
  tersimpan.
- `getInactiveIntentWarnings()` ([progress.ts:722-765](../../src/engine/progress.ts#L722))
  seluruh mekanismenya hilang landasannya — fungsinya (memperingatkan ada
  Roadmap/Plan/Exec/Close yang masih hidup di bawah intent yang sudah tidak
  jadi fokus) **digantikan** oleh `intent list` yang menampilkan gate/status
  summary tiap chain (termasuk chain non-aktif) — bukan diporting 1:1,
  karena representasinya (per-chain projection) sudah beda bentuk. Ini
  konsisten dengan keputusan audit AUD yang menolak "Intent Evolution
  sebagai artifact/command baru" (DISCUSSION, ronde Audit AUD) — fungsi yang
  sama, direpresentasikan lewat `intent list` yang sudah diperluas, bukan
  mekanisme kedua yang berdiri sendiri.
- Di `reconstruct.ts`, seluruh percabangan `isHighest` di blok INTENT
  ([reconstruct.ts:151-179](../../src/engine/reconstruct.ts#L151)) yang
  membandingkan entry mana yang tertinggi untuk memutuskan LOCKED vs INACTIVE
  jadi tidak relevan — rekonstruksi sekarang berjalan **per file chain yang
  ditemukan** (satu `DIR-INTENT-vN.md` per proses rekonstruksi satu chain),
  bukan lagi satu proses yang membangun satu array multi-intent. Detail
  penuh algoritma reconstruct per-chain didorong ke plan-eval yang menyentuh
  `doctor`/`reconstruct` (`--all-versions`, PLAN-EVAL-05) — dicatat di sini
  hanya supaya urutan implementasi §6 tidak lupa bahwa validasi
  `reconstruct.ts` **tidak lolos tanpa mengubah pola ini**, walau
  detail command `--all-versions` sendiri didorong keluar scope.

**DIKONFIRMASI Director 2026-07-17** — lihat §8 poin 3. Bukan karena
kesimpulannya sempat diragukan (konsekuensinya struktural, bukan preferensi),
tapi karena ini secara teknis adalah keputusan skema (menghapus satu nilai
enum) yang belum pernah diucapkan Director secara literal di DISCUSSION doc,
sehingga tetap perlu sign-off eksplisit sebelum ditulis ke kode.

### 3.5 Temuan baru — `RoadmapState` ACTIVE/INACTIVE mati struktural di sini juga, tapi jangan disamakan dengan redefinisi Gate 1.5 (itu tetap PLAN-EVAL-04)

DISCUSSION §"Konsolidasi Lanjutan" bagian 8 sudah memutuskan model
`ACTIVE`/`INACTIVE` roadmap dihapus **karena** di dunia 1:1 per-chain tidak
ada lagi yang perlu diarbitrase — tapi paragraf yang sama juga menaruh
"redefinisi Gate 1.5 & lifecycle Roadmap/Close" sebagai PLAN-EVAL-04, di
luar scope dokumen ini (§10 di bawah). Ini tampak kontradiktif kalau dibaca
cepat — sebenarnya tidak, dan garis batasnya penting supaya PLAN-EVAL-01
tidak diam-diam menelan pekerjaan PLAN-EVAL-04:

- **Bagian struktural** (ACTIVE/INACTIVE tidak punya makna begitu roadmap
  jadi objek tunggal per chain, karena tidak pernah ada roadmap kedua dalam
  file yang sama untuk diarbitrase) — ini **konsekuensi otomatis migrasi
  skema**, wajib ditangani di PLAN-EVAL-01 karena kalau tidak, tipe
  `RoadmapState` tidak valid untuk objek tunggal.
- **Bagian perilaku** — **KOREKSI (ditemukan saat implementasi Fase 3,
  2026-07-17)**: draf ini sebelumnya salah mengira "roadmap auto-LOCKED
  sebagai efek samping `close lock`" adalah keputusan lifecycle **baru**
  milik PLAN-EVAL-04. Itu keliru — dicek langsung ke `src/commands/close.ts`
  sebelum Fase 3 dimulai: `close lock` **sudah** memanggil
  `lockActiveRoadmap()` sebagai efek samping **hari ini, sebelum migrasi
  apa pun disentuh**. Ini bukan fitur baru untuk didesain — ini perilaku
  existing yang wajib dipertahankan PLAN-EVAL-01 (§8 poin 4 di bawah
  diperbarui sesuai ini juga). Sisa PLAN-EVAL-04 yang genuinely baru cuma
  *definisi ulang* Gate 1.5 (baris berikutnya) dan pemakaian istilah "ada
  dan belum SUPERSEDED" — bukan mekanisme cascade-nya sendiri.

**Keputusan untuk PLAN-EVAL-01**: `RoadmapState` per-chain jadi
`'DRAFT' | 'LOCKED' | 'SUPERSEDED'` — 3 state, ACTIVE/INACTIVE dijatuhkan
dari enum karena memang tidak bisa terisi lagi (tidak ada kompetisi untuk
diarbitrase). **Tidak ada command `sigma roadmap lock`** — sama seperti
hari ini, itu tidak pernah ada sebagai command berdiri sendiri baik sebelum
maupun sesudah migrasi ini; roadmap hanya pernah menjadi LOCKED lewat
cascade `close lock` (lihat Fase 3, §6). `registerRoadmapDraft()`/
`activateRoadmap()`/`lockActiveRoadmap()` disederhanakan (hilang seluruh
logika "cari ACTIVE lain untuk didemosi", sama seperti intent di §3.4).
`activateRoadmap()` sendiri kehilangan alasan untuk ada (tidak ada DRAFT
lain untuk diaktifkan dalam 1 chain) — **dihapus**, bukan disederhanakan;
Gate 1.5 di `plan.ts:106-115` yang mengecek `data.roadmap.versions.find(v
=> v.state === 'ACTIVE')` diganti cek paling sempit yang setara secara
perilaku hari ini: `chain.roadmap !== null && chain.roadmap.state !==
'SUPERSEDED'`.

### 3.6 Temuan baru — `findProjectRoot()` (`src/utils/fs.ts`) tidak disebut di DISCUSSION doc tapi jangkarnya patah total

[fs.ts:33-52](../../src/utils/fs.ts#L33) hari ini menjangkarkan root proyek
pada **keberadaan file** `Sigma/progress.json`:

```ts
const candidate = path.join(current, PROGRESS_FILE); // 'Sigma/progress.json'
if (fs.existsSync(candidate)) return current;
```

Begitu nama `progress.json` pensiun total (§1), fungsi ini tidak akan pernah
menemukan proyek Sigma manapun lagi — **setiap** command yang memanggil
`findProjectRoot()` (semua 9 file command) akan gagal dengan pesan salah
("Not inside a Sigma project") walau proyeknya valid. Ini **bukan** soal
migrasi konten, ini soal jangkar deteksi proyek itu sendiri, dan harus jadi
langkah pertama implementasi (§6 Fase 0), bukan efek samping dari mengganti
`readProgress`.

**Perbaikan**: jangkarkan pada `Sigma/activate_status.json` — file yang
paling stabil-tapi-selalu-ada begitu proyek pernah dijalankan `project
start`/`register` (dibuat sejak awal walau `active_chain: null`, lihat §5.9),
analog `findSigmaProjectRoot()` di `reconstruct.ts:341-355` yang sudah
menjangkar pada keberadaan direktori `Sigma/` itu sendiri untuk kasus
recovery. `findProjectRoot()` biasa tetap menjangkar pada file spesifik
(bukan keberadaan direktori generik `Sigma/`, supaya tetap bisa membedakan
"proyek Sigma valid" dari "folder bernama Sigma yang bukan proyek Sigma"),
cuma file targetnya pindah dari `progress.json` ke `activate_status.json`.

**Koreksi urutan kerja (ditemukan saat implementasi Fase 0, lihat §6)**:
draf awal bagian ini menaruh perubahan `findProjectRoot()` di Fase 0
bersama `chain.ts`. Itu **tidak aman** — Fase 0 cuma menambah modul baru,
belum ada satu pun jalur (baik `project start` maupun `test/helpers.ts`)
yang menulis `activate_status.json`. Mengganti jangkar lebih awal berarti
`findProjectRoot()` gagal menemukan **setiap** proyek/test yang ada
(seluruh 160 test) sampai migrasi selesai. Perbaikan jangkar ini ditunda
jadi satu langkah dengan Fase 5 (§6) — persis di titik yang sama saat
`progress.json`/`PROGRESS_FILE` lama dihapus, supaya tidak pernah ada jendela
waktu di mana `activate_status.json` diharapkan ada tapi belum ada yang
menulisnya.

### 3.7 Temuan baru — `resolveSigmaDocPath()`/`--v` di `intent`/`close`/`roadmap` berubah makna dari "index array" jadi "chain mana"; `plan`/`exec` tidak berubah sama sekali

Empat command punya flag `--v <version>` pada `check` (dan setara) hari ini:
`intent check --v`, `close check --v`, `roadmap check --v`, `exec check --v`,
`plan check --v` (plus `plan activate --v`, `plan supersede --v`, `plan
update --v`, `roadmap activate --v`, `intent supersede --v`). Semuanya hari
ini punya mekanisme sama: index ke dalam **array** `versions` di **satu**
`progress.json`, lewat `resolveSigmaDocPath()`
([docCheck.ts:625-660](../../src/utils/docCheck.ts#L625)) — mis.
`data.intent.versions.find(item => item.version === version)`.

Setelah migrasi, dua kelompok berperilaku beda:

- **`intent check --v`, `close check --v`, `roadmap check --v`** — karena
  `intent`/`close`/`roadmap` sekarang objek tunggal per chain (tidak ada lagi
  array untuk di-index), `--v <version>` di sini **berubah makna** jadi "cek
  chain lain", bukan "cek entry lain di array yang sama". Implementasinya:
  kalau `--v` diberikan, resolusi baca `progress-v<version>.json` langsung
  (read-only, tidak butuh chain itu jadi aktif) alih-alih membaca chain
  aktif. Perilaku yang terlihat Director secara garis besar sama ("lihat
  versi X dari dokumen ini"), tapi jalur baca datanya sekarang lintas-file.
- **`plan check --v`, `exec check --v`, `plan activate/supersede/update --v`**
  — **tidak berubah sama sekali**. `plan`/`exec` tetap array multi-versi di
  dalam **satu** chain file (§3.2), jadi `--v` di sini tetap index array
  persis seperti hari ini, cuma array-nya sekarang hidup di
  `progress-v<active>.json`, bukan `progress.json`.

Ini perlu ditulis eksplisit di kode (komentar) dan di test, supaya tidak ada
yang secara keliru "menyeragamkan" kelima command itu jadi satu pola resolusi
— dua kelompok itu punya sumber data yang secara struktural beda (lintas-file
vs dalam-file) walau nama flag-nya sama persis.

---

## 4. Lapisan Resolusi — Modul Baru

Modul baru `src/engine/chain.ts` (tidak menimpa `src/engine/progress.ts`,
lihat §6 Fase 0 soal kenapa dipisah). Fungsi inti:

```ts
// path helpers
function chainFilePath(projectRoot: string, chainVersion: string): string;
function activateStatusPath(projectRoot: string): string;

// scan Sigma/ untuk semua progress-v<N>.json yang ada
function listChainVersions(projectRoot: string): string[];

// hitung versi chain berikutnya dari file yang ada di disk — bukan lagi
// nextMajorVersion(data.intent.versions), karena tidak ada satu array
// gabungan untuk dihitung panjangnya
function nextChainVersion(projectRoot: string): string;

// baca/tulis manifest
function readActivateStatus(projectRoot: string): ActivateStatus;
function writeActivateStatus(projectRoot: string, activeChain: string): void;

// resolusi invarian "tepat satu chain ACTIVE" — implementasi DISCUSSION §12:
// auto-default ke intent tertinggi yang belum SUPERSEDED kalau active_chain
// tidak valid/kosong. Melempar HANYA kalau listChainVersions() kosong sama
// sekali (belum pernah ada intent new).
function resolveActiveChainVersion(projectRoot: string): string;

// baca satu chain file spesifik (dipakai --v lintas-chain, §3.7)
function readChain(projectRoot: string, chainVersion: string): ChainState;
function writeChain(projectRoot: string, chainVersion: string, data: ChainState): void;

// gabungan paling umum dipakai command — pengganti hampir 1:1 readProgress()
function readActiveChain(projectRoot: string): { chainVersion: string; data: ChainState };

// identitas proyek terpisah dari chain, dipakai bareng readActiveChain()
// di titik yang butuh project_id/project_name (lihat §3.3)
function readProjectIdentity(projectRoot: string): ProjectIdentity;
```

`readChain`/`writeChain` memvalidasi via fungsi setara
`validateProgressSemantics()` yang sudah ada tapi disesuaikan untuk bentuk
`ChainState` (single-object domain, bukan tracker, untuk intent/roadmap/close
— validasi `plan`/`exec` array **dipakai ulang tanpa perubahan** dari
`validateTracker()` yang sudah ada, karena bentuknya memang tidak berubah).

`writeChain` memakai pola atomic write yang sama seperti `writeProgress()`
hari ini (`.tmp` lalu `fs.moveSync` overwrite) — tidak berubah, cuma target
path-nya per-chain.

Command yang hari ini memanggil:

```ts
const data = readProgress(projectRoot);
// ...mutasi data...
writeProgress(projectRoot, data);
```

menjadi:

```ts
const { chainVersion, data } = readActiveChain(projectRoot);
// ...mutasi data (bentuk intent/roadmap/close berubah objek tunggal)...
writeChain(projectRoot, chainVersion, data);
```

Pergantian pola ini mekanis untuk seluruh 53 call site — beban nyata ada di
isi mutasi `intent`/`roadmap`/`close` (~104 titik array→objek di §5), bukan
di pergantian `readProgress`/`writeProgress` itu sendiri.

`sigma intent new` **tidak** memakai `readActiveChain` untuk membuat chain
baru (tidak ada chain existing untuk dimutasi) — jalurnya:

```ts
const chainVersion = nextChainVersion(projectRoot);
const data = createInitialChain(chainVersion); // pengganti createInitialProgress()
// ...registerIntentDraft(data, ...) — sekarang set data.intent langsung, bukan push ke array...
writeChain(projectRoot, chainVersion, data);   // tulis file chain baru DULU
writeActivateStatus(projectRoot, chainVersion); // baru manifest — urutan DISCUSSION §11
```

Kecuali satu preflight read-only: sebelum membuat chain baru, `intent new`
tetap perlu tahu apakah chain **aktif saat ini** ada di lifecycle `CLOSED`
(untuk menampilkan reopen preflight prompt, [intent.ts:46-59](../../src/commands/intent.ts#L46))
— ini baca `readActiveChain()` murni untuk preflight, tanpa memutasi/menulis
apa pun ke chain lama. Kalau belum ada chain sama sekali (`listChainVersions()`
kosong, proyek baru saja `project start`), preflight ini dilewati sepenuhnya
(tidak ada apa pun untuk dicek CLOSED-nya).

---

## 5. Migrasi Command per File

| File | Titik sentuh | Sifat perubahan |
| --- | --- | --- |
| `src/utils/fs.ts` | `findProjectRoot()` | Jangkar pindah dari `progress.json` ke `activate_status.json` (§3.6). **Wajib Fase 0**, semua command bergantung padanya. |
| `src/utils/docCheck.ts` | `resolveSigmaDocPath()` | Cabang 2 jalur: intent/close/roadmap → resolusi lintas-chain (§3.7); plan/exec → tidak berubah. |
| `src/engine/progress.ts` | Hampir seluruh isi (1313 baris) | Dipecah — lihat §6 Fase 0. Fungsi domain intent/roadmap/close (`register*Draft`, `lock*`, `supersede*`) ditulis ulang untuk objek tunggal, bukan array. Fungsi domain plan/exec (`registerPlanDraft`, `lockOldestPlanDraft`, `registerExecDraft`, `lockActiveExec`, dst.) **hampir tidak berubah** — tetap terima `data.plan`/`data.exec` sebagai tracker, ganti tipe parameter dari `ProgressJson` ke `ChainState`. `runDoctorReconciliation()` tetap terima satu objek (sekarang `ChainState`) — cocok dengan temuan DISCUSSION §4 bahwa fungsi ini "tidak tahu apa-apa soal chain". |
| `src/engine/reconstruct.ts` | `discoverArtifacts`, `buildReconstructedProgress` | Scan artifact perlu dikelompokkan per major version dulu (bukan lagi satu array gabungan lintas-major) — tiap kelompok jadi kandidat satu `ChainState`. Cabang `isHighest` untuk intent (§3.4) dan roadmap (§3.5) dihapus karena tidak relevan lagi per-chain. Detail penuh algoritma multi-chain reconstruct **didorong ke PLAN-EVAL-05** (`doctor --all-versions`/`--reconstruct` 3 mode) — di sini cukup pastikan `ChainState` yang dihasilkan valid untuk **satu** chain pada satu panggilan. |
| `src/commands/intent.ts` | `new`, `lock`, `supersede`, `check`, `status`, `list` | `new` — lihat §4 (jalur khusus, bukan readActiveChain biasa). `lock`/`supersede` — objek tunggal, hilang loop array (§3.4). `check --v` — lintas-chain (§3.7). `list` — **paling besar berubah bentuknya**: bukan lagi loop `data.intent.versions`, tapi loop `listChainVersions()` lalu `readChain()` tiap satu untuk merender baris projection (DISCUSSION §"Konsolidasi Lanjutan" bagian 2) — menggantikan `getInactiveIntentWarnings()` yang dihapus (§3.4). |
| `src/commands/session.ts` | `bootstrap` | Baca `readActiveChain()` + `readProjectIdentity()` terpisah (§3.3). **Wajib** menampilkan `active_chain`/`chainVersion` secara eksplisit dan menonjol (DISCUSSION §"Konsolidasi Lanjutan" bagian 6 — kompensasi untuk `intent activate` tanpa `--director-confirm`) — baris baru di atas "Project:" yang sudah ada, mis. `Active Chain:     v2`. |
| `src/commands/plan.ts` | `new` (Gate 1.5), `lock`, `activate`, `supersede`, `check`, `update`, `promote` | Gate 1.5 check jadi `chain.roadmap !== null && chain.roadmap.state !== 'SUPERSEDED'` (§3.5) menggantikan `data.roadmap.versions.find(v => v.state === 'ACTIVE')`. `getActiveRoadmapPath()` ([plan.ts:52-56](../../src/commands/plan.ts#L52)) disederhanakan — tidak perlu `.find(v => v.state === 'ACTIVE')`, langsung `chain.roadmap`. Sisanya (`plan.versions` array logic) **tidak berubah bentuk**, cuma sumber `data` sekarang `ChainState` bukan `ProgressJson`. |
| `src/commands/exec.ts` | seluruh command | `exec.versions` array logic tidak berubah bentuk. `plan_version_ref` tetap divalidasi terhadap `data.plan.versions` (dalam chain yang sama) — tidak ada perubahan makna karena plan/exec memang selalu berada dalam satu chain file yang sama sekarang (isolasi ini gratis, bukan pekerjaan tambahan). |
| `src/commands/close.ts` | `new`, `lock`, `check`, `status` | `new` — guard 1:1 ([progress.ts:1146-1160](../../src/engine/progress.ts#L1146)) jadi trivial: cukup cek `chain.close !== null && chain.close.state !== 'SUPERSEDED'` (tidak perlu lagi `.find` lintas `intent_version_ref` karena hanya ada satu intent di file ini). `check --v` — lintas-chain (§3.7). |
| `src/commands/roadmap.ts` | `new`, `activate`, `lock`, `check`, `status` | `new` — guard 1:1 ([progress.ts:1198-1206](../../src/engine/progress.ts#L1198)) sama-sama jadi trivial (cek `chain.roadmap === null`). `activate` — **dihapus** (§3.5, tidak ada DRAFT lain untuk diaktifkan). `check --v` — lintas-chain (§3.7). |
| `src/commands/doctor.ts` | `runDefaultDoctor`, `runReconstruct`, `resolveProjectIdentity` | Default — target `readActiveChain()` bukan `readProgress()`. `resolveProjectIdentity()` ([doctor.ts:74-108](../../src/commands/doctor.ts#L74)) — cabang pertama (`progressPath` fallback baca `progress.json`) dihapus total, identitas HANYA dari `.sigma-identity.json` atau `--id`/`--name` (progress.json tidak lagi eksis untuk dijadikan fallback). `runReconstruct()` — backup line ([doctor.ts:114-122](../../src/commands/doctor.ts#L114), `reconstruct-backup-<timestamp>.json`) adalah **mekanisme backup ketiga** yang ditemukan di luar dua yang sudah dicatat DISCUSSION §13 (`project start --reinit`, `project sync`) — perlu ditambahkan ke daftar PLAN-EVAL-02 (auto-backup removal), tidak dihapus di sini karena PLAN-EVAL-01 tidak menyentuh keputusan auto-backup. `--all-versions`/3-mode `--reconstruct` tetap PLAN-EVAL-05. |
| `src/commands/override.ts` | apply/list override | `isOverrideStillActive()`/`hasActiveOverrideForGate()` di `progress.ts` beroperasi pada satu `ChainState` — tidak berubah bentuk, cuma tipe parameter. |
| `src/commands/project.ts` | `start`, `--reinit`, `register`, `sync`, `status` | `start` — buat `.sigma-identity.json` (tidak berubah) + `activate_status.json` dengan `active_chain: null` (BARU — lihat §5.9) + **tidak** buat `progress-v1.json` (chain lahir lazy dari `intent new` pertama, §4). `--reinit` backup line ([project.ts:145-157](../../src/commands/project.ts#L145)) — di luar scope sini juga (PLAN-EVAL-02), tapi targetnya perlu disesuaikan jadi backup `activate_status.json` + semua `progress-v*.json` kalau PLAN-EVAL-02 belum selesai lebih dulu (lihat §8 catatan urutan). `status` — cetak lifecycle chain aktif (§3.3), bukan lagi lifecycle project-level. |

**Baris baru di `Sigma/` bootstrap (`project start`) — §5.9**: Karena chain
sekarang lahir lazy, `project start` tidak lagi menghasilkan
`Sigma/progress.json` (state langsung siap dipakai) — ia menghasilkan
`Sigma/activate_status.json` dengan `{ active_chain: null }` saja. Ini state
transien yang sah (proyek terdaftar, belum ada intent) — `resolveActiveChainVersion()`
(§4) untuk kasus ini **melempar error terarah** ("Belum ada DIR-INTENT. Run:
sigma intent new"), bukan mencoba auto-default (tidak ada kandidat chain sama
sekali untuk didefault-kan). Ini konsisten dengan `findProjectRoot()` yang
tetap berhasil menemukan root proyek (§3.6, karena `activate_status.json`
sudah ada) walau belum ada satu pun `progress-v*.json`.

---

## 6. Urutan Implementasi (fase)

Bukan PR tunggal — DISCUSSION §"Langkah Berikutnya" sudah memutuskan
implementasi dipecah, dan §"Risiko" doc ini sendiri (§9 di bawah) mencatat
"tidak bisa dites bermakna dalam keadaan separuh migrasi". Fase di bawah
bukan unit yang bisa di-merge terpisah ke `main` (tetap satu PR/commit besar
akhirnya, konsisten dengan risiko §9), tapi urutan kerja **di dalam** satu
working branch, supaya setiap fase bisa dikompilasi (`tsc`) dan diperiksa
sendiri sebelum lanjut ke fase berikutnya.

1. **Fase 0 — Fondasi murni, tanpa command yang dipindah dulu. SELESAI
   (2026-07-17).** Modul baru `src/engine/chain.ts` (§4) ditulis
   berdampingan dengan `progress.ts` lama (belum dihapus, belum diimpor
   oleh command manapun). Tipe baru `ChainState`/`ActivateStatus`/
   `SingleIntentState`/dst. (§3.2) ditulis di `chain.ts`, bukan menimpa
   `ProgressJson` yang lama. Diverifikasi: `npm run build` bersih, `npm test`
   tetap 160/160 (25 file) — nol regresi, karena tidak ada satu pun call
   site lama yang tersentuh. **`findProjectRoot()` (§3.6) SENGAJA TIDAK
   diubah di fase ini** — lihat koreksi urutan kerja di §3.6: mengganti
   jangkarnya sebelum ada yang menulis `activate_status.json` akan
   mematahkan seluruh proyek/test yang ada. Ditunda ke Fase 5.
2. **Fase 1 — Fungsi mutasi domain, disesuaikan ke bentuk `ChainState`.
   SELESAI (2026-07-17).** Ditulis di `chain.ts` yang sama (bukan file
   terpisah): validasi (`validateChainSemantics`/`assertChainCanMutate`),
   query gate/invalid runtime, `runDoctorReconciliation` (dua heuristik
   repair lama dijatuhkan karena scenario-nya sudah tidak mungkin terjadi
   per-chain — didokumentasikan sebagai komentar di kode), lalu mutasi
   intent (`lockActiveIntent`, `previewIntentSupersedeCascade`,
   `supersedeIntentVersion` — tanpa loop demosi INACTIVE, §3.4), roadmap
   (`registerRoadmapDraft`/`lockActiveRoadmap`, tanpa `activateRoadmap`,
   §3.5), plan/exec (disalin nyaris identik, cuma tipe parameter berubah),
   close (guard 1:1 sama seperti roadmap), dan `getNextValidOperations`.
   **Tidak ada `registerIntentDraft` terpisah** — `createInitialChain()`
   (Fase 0) sudah menggabungkan pembuatan chain + intent DRAFT jadi satu
   langkah, karena `intent` tidak pernah `null` di `ChainState`.
   Diverifikasi: 28 test unit baru langsung terhadap `chain.ts`
   ([test/chain-engine.test.ts](../../test/chain-engine.test.ts), tidak
   lewat CLI) — mencakup invarian satu-chain-aktif, guard 1:1 roadmap/close,
   progresi gate, cascade supersede chain-scoped, `validateChainSemantics`,
   `runDoctorReconciliation`. `npm run build` bersih, `npm test` total
   **188/188 (26 file)** — 160 lama + 28 baru, nol regresi pada suite lama
   (belum ada command yang dipindah, jadi memang seharusnya tidak ada yang
   berubah).
3. **Fase 2 — `intent.ts` penuh. SELESAI (2026-07-17).** `new` (jalur
   khusus §4, termasuk preflight reopen read-only), `lock`, `supersede`
   (target chain eksplisit lewat `--v`, bukan lagi chain aktif — bisa
   men-supersede chain manapun), `check --v` (resolusi lintas-chain, §3.7),
   `status` (pesan ramah "No active INTENT" dipertahankan persis, exit 0,
   untuk kasus belum ada chain sama sekali — bukan error), `list` (projection
   lintas-chain baru, pengganti `getInactiveIntentWarnings()` yang dihapus).
   **Temuan bug nyata saat implementasi**: `resolveActiveChainVersion()`
   (Fase 0) mempercayai `active_chain` yang menunjuk chain yang *ada* tapi
   sudah `SUPERSEDED` — celah nyata karena `intent supersede` tidak pernah
   menyentuh `activate_status.json`, jadi men-supersede chain yang sedang
   aktif meninggalkan manifest basi menunjuk ke chain mati. Diperbaiki:
   `resolveActiveChainVersion` sekarang memperlakukan pointer ke chain
   `SUPERSEDED` sama dengan pointer tidak valid (auto-default), perluasan
   yang disengaja di luar kalimat literal DISCUSSION §12 — didokumentasikan
   di kode dan dikunci lewat test di dua lapis (unit `chain.ts` +
   CLI `intent list`).
   Diverifikasi: `test/intent-lock.test.ts`, `test/intent-reopen.test.ts`,
   `test/intent-supersede.test.ts`, `test/progress-hardening.test.ts` (2 dari
   3 test di-redesain, bukan cuma ganti path — skenario "dua intent dalam
   satu array" sudah tidak bisa direpresentasikan lagi, diganti isolasi
   fisik dua chain file), `test/doc-check.test.ts` dimigrasi ke fixture
   chain; `test/intent-list.test.ts` baru (6 test, cakupan yang sebelumnya
   nol). `npm run build` bersih, `npm test` **195/195 (27 file)**. Diverifikasi
   juga manual end-to-end di luar test harness (`intent new` → `status` →
   `list` menghasilkan `progress-v1.json` + `activate_status.json` yang benar).
4. **Fase 3 — `roadmap.ts`, `plan.ts`, `exec.ts`, `close.ts`. SELESAI
   (2026-07-17).**

   **Koreksi penting ditemukan saat implementasi, memperbaiki kesalahan di
   draf §3.5/§8 poin 4 sebelumnya**: `close lock` **sudah** auto-mengunci
   roadmap sebagai efek samping **hari ini, sebelum migrasi apa pun**
   (`close.ts` sudah memanggil `lockActiveRoadmap()` — dicek langsung di
   kode sebelum Fase 3 dimulai). Draf §3.5 sebelumnya salah mengira ini
   perilaku baru yang didorong ke PLAN-EVAL-04 — yang sebenarnya PLAN-EVAL-04
   miliki hanyalah *penamaan ulang definisi* dependensi ini (menjadikannya
   bagian eksplisit dari redefinisi Gate 1.5), bukan pengenalan mekanismenya.
   PLAN-EVAL-01 tetap **mempertahankan** cascade ini persis seperti perilaku
   hari ini — cuma model penyimpanan roadmap di baliknya yang berubah
   (objek tunggal, bukan cari entry `ACTIVE`). `roadmap.ts` migrasi TIDAK
   menambah command `roadmap lock` (memang tidak pernah ada sebagai command
   berdiri sendiri, sebelum maupun sesudah migrasi) — cuma menghapus
   `roadmap activate` (§3.5, tidak ada DRAFT lain untuk diaktifkan).

   Migrasi lain sesuai rencana: Gate 1.5 di `plan.ts` (`new`/`promote`)
   ditulis ulang jadi "roadmap ada dan belum SUPERSEDED" (§3.5); `--v`
   lintas-chain untuk `roadmap check`/`close check` (§3.7); `plan`/`exec`
   seluruh subcommand disalin nyaris identik (cuma tipe data berubah);
   `utils/roadmap.ts` (`renderRoadmapFile`/`generateStageOverview`) diadaptasi
   untuk `ChainState`.

   Diverifikasi: 8 file test diperbaiki (beberapa — `plan-activate.test.ts`,
   `roadmap-stage-overview.test.ts` — juga menghilangkan fixture "dua intent
   dalam satu array" yang sama seperti Fase 2; dua test di `plan-supersede.test.ts`
   ternyata *vacuously passing* sebelum diperbaiki — tidak mengecek `exitCode`,
   jadi diam-diam tidak menguji apa pun lagi setelah command pindah baca file —
   ditemukan dan diperbaiki saat migrasi, bukan dibiarkan). `npm run build`
   bersih, `npm test` **195/195 (27 file)**. Diverifikasi juga end-to-end
   manual penuh di luar test harness: `intent new` → `lock` → `roadmap new`
   → `plan new` → `lock` → `exec new` → `lock` → `close new` → `lock`,
   termasuk mengonfirmasi cascade auto-lock roadmap benar-benar terpicu
   (`ROADMAP v1 LOCKED.` tercetak) dan `intent list` melaporkan hasil akhir
   yang benar (`LOCKED CLOSED OPEN OPEN OPEN`).
5. **Fase 4 — `session.ts`, `project.ts`, `doctor.ts`, `override.ts`.
   SELESAI (2026-07-17).** `reconstruct.ts` **TIDAK disentuh** — lihat
   penyempitan scope di bawah.

   **Penyempitan scope ditemukan saat implementasi**: `doctor --reconstruct`
   TIDAK dimigrasikan di fase ini, berbeda dari rencana awal §5 yang
   menyiratkan "default reconstruct" bisa di-scope-kan ke satu chain. Analisis
   lebih dekat menunjukkan `discoverArtifacts()` (di `reconstruct.ts`) pada
   dasarnya memindai SEMUA `DIR-INTENT-v*.md` yang ada di disk sekaligus,
   berpotensi lintas major version — pengelompokan itu **sudah** merupakan
   pekerjaan multi-chain PLAN-EVAL-05 sendiri, tidak ada versi "satu-chain-saja"
   yang lebih kecil untuk dipisah dengan aman. Keputusan: `--reconstruct`
   (dan `resolveProjectIdentity()`, yang cuma dipakai olehnya) **dibiarkan
   utuh** di jalur `progress.ts`/`reconstruct.ts` lama, didorong seluruhnya
   ke PLAN-EVAL-05. **Konsekuensi baru untuk Fase 5**: menghapus `progress.ts`
   punya prasyarat tersembunyi — `--reconstruct` butuh port `chain.ts`-nya
   sendiri (PLAN-EVAL-05 atau langkah khusus) sebelum jalur lama yang
   menopangnya bisa dihapus.

   Migrasi yang selesai: `session.ts` (bootstrap sekarang menampilkan
   `Active Chain` secara menonjol — kompensasi visibility untuk `intent
   activate` tanpa `--director-confirm`, DISCUSSION "Konsolidasi Lanjutan"
   bagian 6); `project.ts` (`start`/`--reinit` sekarang juga menulis
   `Sigma/activate_status.json` dengan `active_chain: null`, `progress.json`
   tetap ditulis apa adanya sebagai file legacy/inert — tidak ada yang
   membacanya lagi setelah fase ini kecuali `findProjectRoot()` untuk
   keberadaannya; `status` dipindah ke chain aktif; `sync`/`register` TIDAK
   disentuh, tidak pernah membaca/menulis `ChainState`); `override.ts`
   (migrasi mekanis penuh); `doctor.ts` (mode default saja, lihat di atas).

   **Bug nyata ditemukan lewat pengecekan manual, bukan test otomatis**:
   `session bootstrap`, `project status`, dan `doctor` semuanya crash
   (exit 1) pada proyek yang baru saja `project start` tapi belum pernah
   `intent new` — `readActiveChain()` melempar error "No DIR-INTENT exists
   yet" karena memang belum ada chain sama sekali, tapi ketiga command
   read-only ini seharusnya menampilkan state kosong dengan anggun (perilaku
   asli sebelum migrasi), bukan gagal total. Tidak ada fixture test yang
   menangkap ini karena semua fixture Fase 1–4 kebetulan selalu menyertakan
   minimal satu chain. Diperbaiki di ketiga command (cek `listChainVersions()
   .length === 0` lebih dulu, tampilkan "none — no DIR-INTENT yet" alih-alih
   error), dan ditambahkan 3 test regresi baru khusus untuk kondisi ini.

   Diverifikasi: 8 file test diperbaiki + 3 test baru (kondisi
   "belum ada chain sama sekali"). `npm run build` bersih, `npm test`
   **198/198 (27 file)**. Diverifikasi juga manual end-to-end di luar test
   harness: `project start` (mengonfirmasi `activate_status.json` dibuat),
   `session bootstrap`/`project status`/`doctor` sebelum dan sesudah
   `intent new` pertama, dan `override --dry-run`.
6. **Fase 5 — Hapus `progress.ts` lama** (`ProgressJson`, `PROGRESS_FILE`
   di `config.ts`, `readProgress`/`writeProgress`) setelah dipastikan tidak
   ada satu pun call site tersisa (`grep -rn "readProgress\|writeProgress\|ProgressJson" src/`
   harus nol hasil di luar `chain.ts`/`progress.ts` itu sendiri kalau
   sebagian fungsi domain dipindah fisik ke sana, bukan file baru — keputusan
   nama file final diserahkan ke saat coding, tidak material untuk plan ini).
   **Fase ini juga tempat `findProjectRoot()` (§3.6) akhirnya diganti
   jangkarnya ke `activate_status.json`** — ditunda dari Fase 0 (lihat
   koreksi urutan kerja di §3.6), karena baru di titik ini setiap proyek
   dan setiap fixture test dijamin sudah punya `activate_status.json`
   (Fase 4 project.ts + Fase 6 test migration harus sudah berjalan lebih
   dulu untuk itu — jadi urutan sebenarnya adalah Fase 4/6 selesai duluan,
   baru Fase 5 mengganti jangkar dan menghapus jalur lama sekaligus).
7. **Fase 6 — Migrasi `test/helpers.ts` + 25 file test** (lihat §7 §Strategi
   Migrasi Test di bawah — dikerjakan paralel dengan Fase 2–5, bukan
   menunggu semuanya selesai, supaya regresi ketahuan sedini mungkin, bukan
   di akhir).

---

## 7. Strategi Migrasi Test

`test/helpers.ts` (dibaca langsung) punya pola fixture yang eksplisit
mengasumsikan **satu** `progress.json` dengan array multi-versi dalam satu
objek — mis. `makeProgressWithDraftIntentAfterLockedChain()`
([helpers.ts:516-540](../../test/helpers.ts#L516)) membangun intent v1
`LOCKED` **dan** v2 `DRAFT` **dalam satu array** `intent.versions`. Fixture
ini **tidak bisa direpresentasikan lagi** dalam satu `ChainState` — ia
sekarang harus jadi **dua** file terpisah (`progress-v1.json` LOCKED,
`progress-v2.json` DRAFT) plus satu `activate_status.json` menunjuk v2. Ini
bukan detail kecil — ini pola yang berulang di banyak fixture (setiap
`makeProgressWith*` yang menyiratkan "versi lama + versi baru" harus dipecah
jadi 2+ pemanggilan `writeChainFixture()` terpisah).

**Rencana**:

- `TestEnv` ([helpers.ts:34-40](../../test/helpers.ts#L34)) tambah field
  `activateStatusPath` dan helper `chainPath(version)`, menggantikan
  `progressPath` tunggal.
- `makeProgress*()` (base + varian Draft/Locked per domain) dipecah jadi
  `makeChain*()` yang mengembalikan **satu** `ChainState` untuk **satu**
  versi chain, dipanggil sekali per chain yang dibutuhkan skenario test.
  Fixture yang lama mengasumsikan multi-major-version dalam satu panggilan
  (seperti contoh di atas) diganti dua panggilan `fs.writeJsonSync` terpisah
  ke dua path chain berbeda, plus satu `fs.writeJsonSync(activateStatusPath, ...)`.
- Test yang murni menguji **satu** chain (mayoritas — `intent-lock.test.ts`,
  `plan-activate.test.ts`, `exec-close-verdict-gates.test.ts`, dst.) berubah
  minimal: ganti target path tulis dari `progressPath` ke `chainPath('v1')`,
  tambah satu baris `activate_status.json`. Estimasi 15–18 dari 25 file
  test masuk kategori ini (perubahan mekanis, bukan re-desain skenario).
- Test yang secara eksplisit menguji **transisi antar-major-version dalam
  satu progress.json** (`intent-reopen.test.ts`, `intent-reopen-cycle.test.ts`,
  `intent-supersede.test.ts`, `inactive-intent-warnings.test.ts`) butuh
  **desain ulang skenario**, bukan cuma ganti path — karena premis "dua
  intent version hidup dalam satu file yang sama" itu sendiri sudah tidak
  ada lagi setelah migrasi. `inactive-intent-warnings.test.ts` khususnya
  kemungkinan besar **dihapus seluruhnya** (mengetes mekanisme yang sudah
  tidak ada, §3.4), diganti test baru untuk `intent list` projection kalau
  scope test itu diwariskan ke sana.
- Estimasi total tetap konsisten dengan analisis skala DISCUSSION doc: "160
  test kemungkinan kena" — pembacaan `test/helpers.ts` ini tidak mengubah
  angka itu, cuma mengkonfirmasi bentuk konkret pekerjaannya per file.

---

## 8. Keputusan yang Sudah Dikonfirmasi Director (2026-07-17)

Rangkuman semua titik di §3 yang bukan sekadar penerapan mekanis keputusan
DISCUSSION doc, tapi kesimpulan baru yang diturunkan dari membaca kode nyata
— diajukan sebagai rekomendasi Professional Mode, dan **kelimanya disetujui
Director tanpa perubahan** pada 2026-07-17. Skema di §3 sudah final untuk
mulai coding (Fase 1, §6) — bukan lagi berstatus terbuka.

1. **DIPUTUSKAN — `project_id`/`project_name` tidak masuk `ChainState`**
   (§3.3). Rekomendasi: adopsi — perpanjangan langsung prinsip yang sudah
   dipakai Director untuk `activate_status.json`; menolaknya di sana tapi
   menerimanya di `ChainState` akan jadi inkonsistensi tanpa alasan. Risiko
   kalau ternyata salah: rendah (gampang ditambah balik).
2. **DIPUTUSKAN — `lifecycle_state` jadi per-chain** (§3.3). Rekomendasi:
   adopsi — satu-satunya tempat yang struktural konsisten begitu
   `activate_status.json` dikunci `{ active_chain }` saja, dan selaras
   dengan prinsip isolasi total yang sudah jadi alasan inti Opsi C.
3. **DIPUTUSKAN — `IntentState` kehilangan `INACTIVE`,
   `getInactiveIntentWarnings()` dihapus** (§3.4). Rekomendasi: adopsi —
   state yang secara struktural tidak akan pernah bisa terisi lagi lebih
   berbahaya dipertahankan (kode mati yang tetap harus divalidasi) daripada
   dihapus; penggantinya (`intent list` projection) sudah wajib dibangun
   terlepas dari keputusan ini, jadi bukan kerja tambahan.
4. **DIPUTUSKAN — `RoadmapState` kehilangan `ACTIVE`/`INACTIVE`, `roadmap
   activate` dihapus** (§3.5). Rekomendasi: adopsi — dipaksa skema objek
   tunggal, tidak ada lagi kompetisi untuk diarbitrase. **Koreksi
   dibanding draf awal poin ini** (ditemukan Fase 3, 2026-07-17): auto-lock
   roadmap sebagai efek samping `close lock` **bukan** keputusan baru yang
   ditahan untuk PLAN-EVAL-04 — itu perilaku existing (`close.ts` sudah
   memanggilnya hari ini, sebelum migrasi apa pun) yang PLAN-EVAL-01 wajib
   pertahankan, bukan hindari. Tidak pernah ada command `sigma roadmap lock`
   berdiri sendiri, baik sebelum maupun sesudah migrasi ini.
5. **DIPUTUSKAN — field `superseded_by`/`intent_version_ref` dijatuhkan
   dari intent/close/roadmap** (§3.2, §3.4). Rekomendasi: adopsi —
   `intent_version_ref` di roadmap/close murni redundan (selalu sama dengan
   intent chain itu sendiri); `superseded_by` kalau dipertahankan melanggar
   isolasi total (butuh tahu isi chain lain), dan `intent list` sudah
   menampilkan urutan `chain_version` + status tiap chain sebagai gantinya.

Tidak ada perubahan syarat lain dari Director di luar kelima poin ini —
bentuk `ChainState`/`ActivateStatus` di §3.2/§3.1 berlaku sebagai final.

---

## 9. Risiko yang sudah diketahui

- Skala rewrite besar (160 test kemungkinan kena), tapi **tidak lebih besar**
  dari Opsi B yang sudah dianalisis di DISCUSSION doc — bukan proyek yang
  bertambah besar karena pilih Opsi C.
- Tidak bisa dites bermakna dalam keadaan "separuh migrasi" — harus dikunci
  sebagai satu unit koheren (lihat §6 — fase adalah urutan kerja internal,
  bukan unit rilis terpisah).
- §8 (Keputusan yang Sudah Dikonfirmasi Director) adalah dependency baru
  yang belum ada di draf awal dokumen ini — **sudah selesai** (kelima poin
  dikonfirmasi 2026-07-17, lihat §8), jadi risiko ini tidak lagi menghalangi
  mulainya Fase 1. Dicatat di sini sebagai riwayat: kalau nanti muncul
  temuan skema baru yang sama sifatnya (konsekuensi struktural yang belum
  eksplisit diucapkan Director), pola yang sama berlaku — sign-off dulu
  sebelum ditulis ke kode, bukan diasumsikan lalu ditemukan salah di
  tengah implementasi.
- Tiga mekanisme auto-backup ditemukan (bukan dua seperti DISCUSSION §13):
  `project start --reinit`, `project sync`, **dan** `doctor --reconstruct`
  (§5, baris `doctor.ts`). Kalau PLAN-EVAL-02 (auto-backup removal) belum
  selesai duluan, PLAN-EVAL-01 tetap harus menyesuaikan target backup ketiga
  ini ke `progress-v*.json`/`activate_status.json` (bukan `progress.json`
  yang sudah tidak ada) supaya tidak crash — kalaupun mekanismenya sendiri
  tidak dihapus di sini.

## 10. Di luar scope (didorong ke plan-eval lain)

- Migrasi data lama & JLH cutover → PLAN-EVAL-03.
- Auto-backup removal (termasuk mekanisme ketiga di `doctor --reconstruct`,
  §9) → PLAN-EVAL-02 (independen, tidak wajib selesai dulu, tapi lihat
  catatan urutan di §9).
- `doctor --all-versions`/`--reconstruct` 3 mode, algoritma reconstruct
  multi-chain penuh → PLAN-EVAL-05.
- Sisa redefinisi lifecycle Roadmap/Close di luar Gate 1.5 (yang sudah
  ditulis ulang di PLAN-EVAL-01 sendiri, §3.5/Fase 3) → PLAN-EVAL-04. **Bukan**
  termasuk cascade auto-lock roadmap saat `close lock` — itu perilaku
  existing yang sudah dipertahankan PLAN-EVAL-01 (koreksi §3.5/§8 poin 4).
- `intent-history.md` auto-render → PLAN-EVAL-06.
