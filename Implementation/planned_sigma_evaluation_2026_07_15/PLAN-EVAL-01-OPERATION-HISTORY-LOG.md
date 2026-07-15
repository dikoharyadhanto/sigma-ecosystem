# PLAN-EVAL-01 — Sigma Operation History Log (Local Project-Level Audit Trail)

**Sumber**: Diskusi langsung Professional Mode, 2026-07-15 (bukan berasal dari `Discussion/*.md` — ide baru muncul langsung di sesi ini).
**Tanggal**: 2026-07-15
**Status**: IMPLEMENTED
**Urutan eksekusi**: Berdiri sendiri — tidak bagian dari batch `planned_sigma_evaluation_2026_07_14` (topik dan sumber berbeda).
**Catatan**: Dokumen ini adalah plan implementasi biasa, disusun dalam Professional Mode. Bukan FMN-PLAN Sigma dan tidak memiliki otoritas lock/gate Sigma. Digunakan sebagai draft input sebelum (jika Director menghendaki) dirumuskan ulang menjadi DIR-INTENT/FMN-PLAN formal.

---

## Objective

Menambahkan fitur log historis operasi Sigma — file lokal di dalam `Sigma/`
yang mencatat **setiap** operasi CLI Sigma yang pernah dijalankan di level
local project, beserta tanggal dan waktunya. Tujuannya murni pemantauan
historis ("apa saja yang pernah dijalankan, kapan") — bukan mekanisme
recovery, bukan mekanisme audit isi konten, bukan pengganti `progress.json`.

Syarat keras: **tidak boleh ada satu pun operasi yang lolos tidak tercatat**,
termasuk operasi yang gagal/error di tengah jalan.

---

## Latar Belakang

- Tidak ada mekanisme audit/history CLI-wide di Sigma saat ini. Satu-satunya
  precedent yang ada adalah `Sigma/memory/overrides.jsonl`
  ([override.ts:13](../../src/commands/override.ts#L13), append-only JSONL
  via `fs.appendFileSync`) — tapi itu scoped hanya ke event override gate,
  bukan seluruh operasi.
- `Sigma/SIGMA-OPERATION-REGISTRY.json` sudah menyebut folder `logs/` sebagai
  bagian dari struktur yang dibuat `project_start`, dan folder itu memang
  dibuat (`SUBFOLDERS` di [config.ts:26](../../src/config.ts#L26)) — tapi
  selama ini kosong, cuma diisi kondisional oleh `--reinit`
  (backup `progress.json`) atau `project sync --confirm`. Fitur ini mengisi
  gap yang sudah tersirat di registry tapi belum pernah diimplementasi.
- Setiap command handler (`src/commands/*.ts`) menangkap error-nya sendiri
  lalu langsung `process.exit(1)` — pola ini terkonfirmasi berulang di 16
  file command (misal [plan.ts](../../src/commands/plan.ts), pola
  `catch (e) { console.error(...); process.exit(1); }`). Ini penting karena
  artinya hook `postAction` milik `commander` **tidak akan pernah kepanggil**
  untuk kasus gagal — proses sudah mati duluan sebelum `commander` sempat
  jalanin `postAction`.

---

## Keputusan Desain yang Disepakati

1. **Lokasi & format file**: `Sigma/logs/operations.jsonl` — append-only,
   satu baris JSON per operasi. Pola sama seperti `overrides.jsonl` yang
   sudah ada.

2. **Isi tiap baris (final, minimal, sesuai "cukup itu" di awal diskusi)**:
   ```json
   {"operation": "intent_lock", "timestamp": "2026-07-15T10:23:41.512Z", "status": "success", "exit_code": 0}
   ```
   Empat field saja: nama operasi, timestamp ISO 8601, status
   (`"success"` / `"error"`), exit code numerik.

3. **Mekanisme non-skip (jawaban atas syarat "tidak boleh terlewat")**:
   - `program.hook('preAction', ...)` didaftarkan **sekali** di
     [src/cli.ts](../../src/cli.ts), setelah semua `program.addCommand(...)`,
     sebelum `program.parse()`. `commander` v12 mempropagasi hook ini ke
     **semua** subcommand termasuk nested (`config set language`), tanpa
     perlu wiring ulang di 51+ handler manapun. Di titik ini disimpan
     sementara di memory: nama operasi + waktu mulai.
   - `process.on('exit', (code) => {...})` didaftarkan sekali di entry
     point — event ini **selalu** jalan tepat sebelum proses mati, apapun
     penyebabnya (selesai normal, `process.exit(1)` manual di tengah
     handler, atau exception tak tertangkap). Di sinilah satu baris JSONL
     ditulis, sekali per eksekusi, pakai exit code untuk menentukan status.
   - `fs.appendFileSync` aman dipakai di `process.on('exit')` karena
     sinkron (batasan Node di titik itu hanya melarang operasi asinkron).
   - Konsekuensi: mekanisme ini **tidak bergantung kerja sama dari
     command handler manapun** — struktural tidak mungkin ke-skip walau ada
     command baru ditambahkan di masa depan, selama didaftarkan lewat
     `program.addCommand`.

4. **Immutability / status file**: log ini masuk kategori "CLI-managed,
   dilarang diedit manual", memperluas tabel *CLI-Managed Files — Do Not
   Edit Directly* di `CLAUDE.md` (yang sudah berisi `progress.json`,
   `SIGMA-REGISTRY.json`, `SIGMA-OPERATION-REGISTRY.json`). Append otomatis
   oleh mekanisme di atas **bukan** "modifikasi" (itu fungsi normalnya).
   Yang dilarang: edit isi/urutan baris, pindah file, hapus file — kecuali
   otorisasi eksplisit Director.

5. **Recovery saat hilang/korup**: dicek ulang tiap kali `sigma project
   register` atau `sigma project start` dijalankan. Kalau
   `Sigma/logs/operations.jsonl` tidak ada atau gagal di-parse, file fresh
   (kosong) dibuat otomatis. **Tidak ada logika pembeda** antara "project
   benar-benar baru" vs "project lama tapi log-nya hilang" — keduanya
   diperlakukan identik sebagai satu event "log diinisialisasi". Konsekuensi
   yang disengaja: histori lama yang hilang, hilang permanen, tidak ada
   usaha rekonstruksi.

6. **Identity file** (`.sigma-identity.json`,
   [project.ts:86-92](../../src/commands/project.ts#L86-L92)) — tambah satu
   field baru:
   ```json
   "logs_created_at": "2026-07-15T10:23:41.512Z"
   ```
   Ditulis ulang oleh `writeProjectIdentity()`
   ([project.ts:113-127](../../src/commands/project.ts#L113-L127)) setiap kali
   log operasi diinisialisasi ulang (baik pertama kali maupun recovery —
   perlakuan identik, selaras poin 5).

7. **Scope "level local project"**: hook hanya menulis log kalau eksekusi
   terjadi di dalam konteks project (`findProjectRoot()` di
   [fs.ts:33](../../src/utils/fs.ts#L33) berhasil). Operasi level
   global/system yang berjalan sebelum project ada (misal `sigma setup`
   awal) otomatis di luar scope karena belum ada `Sigma/logs/` untuk
   ditulisi — tidak perlu pengecualian eksplisit, ini konsekuensi natural
   dari struktur folder.

---

## Task Breakdown

**Tahap 1 — Util penulis log**

- [x] Buat `src/utils/operationLog.ts` — `appendOperationLogEntry(operation,
  exitCode)` menulis satu baris JSONL ke `Sigma/logs/operations.jsonl`
  relatif terhadap `findProjectRoot()`. No-op diam-diam (`catch {}` lalu
  `return`) kalau di luar konteks project (poin 7). Juga berisi
  `ensureOperationsLog(projectRoot)` — validasi tiap baris sebagai JSON,
  recreate kosong kalau hilang/ada baris korup, return boolean apakah baru
  saja diinisialisasi ulang.

**Tahap 2 — Hook terpusat di entry point**

- [x] Tambah `program.hook('preAction', ...)` di
  [src/cli.ts](../../src/cli.ts) — rekam path command lengkap (lihat Isu
  Terbuka #2, sudah diputuskan) ke variabel modul `pendingOperation`.
- [x] Tambah `process.on('exit', (code) => {...})` — panggil
  `appendOperationLogEntry(pendingOperation, code)` kalau `pendingOperation`
  terisi (command tak dikenal tidak pernah memicu `preAction`, jadi otomatis
  tidak tercatat — benar, itu bukan operasi valid).

**Tahap 3 — Inisialisasi & recovery**

- [x] `runStart` ([project.ts:131-301](../../src/commands/project.ts#L131-L301)):
  panggil `ensureOperationsLog(projectRoot)` tepat setelah subfolder dibuat,
  simpan hasilnya (`logsReinitialized`) untuk menentukan `logs_created_at`.
- [x] `runRegister` ([project.ts:489-501](../../src/commands/project.ts#L489-L501)):
  panggil `ensureOperationsLog(projectRoot)` sebelum menulis identity —
  regenerasi otomatis kalau hilang/korup, tidak menyentuh log yang masih
  valid.

**Tahap 4 — Skema identity**

- [x] Update interface `ProjectIdentity`
  ([project.ts:86-92](../../src/commands/project.ts#L86-L92)) — tambah
  `logs_created_at: string`.
- [x] `writeProjectIdentity()` sekarang menerima parameter `logsCreatedAt`
  eksplisit; helper baru `resolveLogsCreatedAt()` mempertahankan nilai lama
  dari identity file yang sudah ada kalau log tidak baru saja
  diinisialisasi ulang, atau stempel waktu baru kalau baru saja
  diinisialisasi (pertama kali maupun recovery — perlakuan identik sesuai
  Keputusan Desain #5).

**Tahap 5 — Dokumentasi governance**

- [x] Tambah baris baru di tabel *CLI-Managed Files — Do Not Edit Directly*
  di `CLAUDE.md` untuk `Sigma/logs/operations.jsonl`.

**Tahap 6 — Testing**

- [x] Test: operasi sukses tercatat status `success` (`doctor`).
- [x] Test: operasi gagal (`process.exit(1)` di tengah handler, tidak pernah
  `throw`) tetap tercatat, status `error` (`override` tanpa `--reason`).
- [x] Test: nested subcommand tercatat dengan path lengkap (`intent status`).
- [x] Test: log hilang/korup → `project register` regenerasi otomatis +
  `logs_created_at` ter-update; log yang masih valid **tidak** direset di
  pemanggilan berikutnya (`logs_created_at` tetap sama).
- [x] Test: command di luar konteks project tidak membuat `Sigma/` maupun
  crash (no-op bersih).
- [x] `test/operation-log.test.ts`, 5 test baru. `npm test` penuh: 22 file,
  136 test, semua lulus (naik dari 21 file/131 test sebelumnya, tanpa
  regresi).

---

## Isu Terbuka / Perlu Keputusan Director — Status Final Implementasi

1. **Field tambahan per entry** — tidak pernah dijawab eksplisit oleh
   Director. Diimplementasikan sesuai default yang tertulis di draft ini:
   **tidak ada field tambahan**, tetap 4 field (`operation`, `timestamp`,
   `status`, `exit_code`). Kalau Director mau tambah field (durasi, aktor)
   nanti, itu perubahan skema baru — baris lama tetap valid untuk di-parse
   karena tiap baris JSONL independen (lihat Risiko).

2. **Format nama operasi yang direkam** — **diputuskan saat implementasi
   (bukan menunggu Director)**: pakai **command path apa adanya** (misal
   `"config set language"`, `"intent lock"`), **bukan** `operation_id`
   registry. Alasan: `operation_id` butuh tabel mapping command-path →
   `operation_id` yang harus di-maintain manual — persis jenis titik gagal
   yang coba dihindari oleh mekanisme hook terpusat di Keputusan Desain #3
   (command baru yang lupa dimasukkan ke mapping akan tercatat salah atau
   di-skip diam-diam). Command path langsung dari `commander` selalu akurat
   dan otomatis mengikuti command baru tanpa maintenance tambahan.

3. **Limitasi force-kill** — `SIGKILL` (atau kondisi lain yang mencegah
   Node menjalankan listener `exit`) secara teknis tidak bisa ditangkap
   mekanisme ini. Didokumentasikan di sini sebagai limitasi yang diterima
   (bukan bug), tidak diselesaikan secara teknis — konsisten dengan cakupan
   "operasi CLI Sigma yang berjalan normal", bukan ketahanan terhadap
   penghentian paksa proses dari luar.

---

## Dependency Catatan

- Berdiri sendiri, tidak bergantung ke plan manapun di
  `planned_sigma_evaluation_2026_07_14` (topik dan sumber sesi berbeda).
- Tidak ada dependency masuk dari plan lain.

---

## Risiko

- Kalau Isu Terbuka #1/#2 tidak diputuskan sebelum implementasi, skema
  JSONL berisiko perlu migrasi ulang kalau field ditambah belakangan
  (append-only berarti baris lama tidak bisa diseragamkan tanpa
  rewrite — yang sudah disepakati dilarang kecuali otorisasi Director).
- Hook `preAction`/`process.on('exit')` global berarti **setiap** command
  lain yang ditambahkan ke `program` otomatis kena — perubahan perilaku
  yang perlu diketahui siapa pun yang menambah command baru di masa depan
  (dampaknya kecil, tapi perlu disebut eksplisit di komentar kode).

---

## Acceptance Criteria — ALL MET (implemented 2026-07-15)

- [x] `Sigma/logs/operations.jsonl` berisi satu baris per eksekusi CLI di
  dalam konteks project, tanpa terkecuali. Diverifikasi via
  `test/operation-log.test.ts` (5 test).
- [x] Operasi yang gagal (`process.exit(1)` di tengah handler) tetap
  tercatat dengan `status: "error"` dan `exit_code` yang sesuai. Diuji
  lewat `sigma override` tanpa `--reason`.
- [x] Menghapus/mengosongkan `operations.jsonl` lalu menjalankan
  `sigma project register` meregenerasi file kosong + update
  `logs_created_at` di `.sigma-identity.json`; log yang masih valid tidak
  direset di pemanggilan berikutnya.
- [x] Command di luar konteks project (`findProjectRoot()` gagal) tidak
  menghasilkan error maupun baris log, dan tidak membuat `Sigma/`.
- [x] `CLAUDE.md` — tabel *CLI-Managed Files* memuat `operations.jsonl`.
- [x] `npm test` lulus tanpa regresi — 22 file test, 136 test, semua
  passed (naik dari 21 file/131 test).

---

## Implementation Walkthrough

**Tanggal eksekusi**: 2026-07-15
**Mode**: Professional Mode (bukan DEV role Sigma governance — plan ini
bukan FMN-PLAN, tidak lock/gate)

### Ringkasan File Berubah

- `src/config.ts` — konstanta baru `OPERATIONS_LOG_FILE`.
- `src/utils/operationLog.ts` (baru) — `appendOperationLogEntry()` dan
  `ensureOperationsLog()`.
- `src/cli.ts` — `program.hook('preAction', ...)` + `process.on('exit',
  ...)`, fungsi `commandPath()` untuk merekonstruksi path command lengkap
  dari `Command.parent`.
- `src/commands/project.ts` — interface `ProjectIdentity` (+
  `logs_created_at`), `writeProjectIdentity()` (parameter baru), helper
  baru `resolveLogsCreatedAt()`, integrasi `ensureOperationsLog()` di
  `runStart` dan `runRegister`.
- `CLAUDE.md` — baris baru di tabel *CLI-Managed Files*.
- `test/operation-log.test.ts` (baru) — 5 test.

### Detail Non-Trivial

- **Kenapa bukan `postAction` saja**: dikonfirmasi langsung di kode
  (`grep` pola `catch (e) { console.error(...); process.exit(1); }` di 16
  file `src/commands/*.ts`) — setiap handler menangani error-nya sendiri
  dan memanggil `process.exit(1)` langsung, tidak pernah `throw` ke luar
  `.action()`. `postAction` `commander` hanya jalan kalau action selesai
  tanpa exception — jadi buta total terhadap semua kegagalan. Solusinya
  `process.on('exit')`, yang oleh spesifikasi Node **selalu** jalan tepat
  sebelum proses benar-benar mati, apa pun penyebabnya.
- **`commandPath()`**: commander v12 mengekspos `Command.parent` sebagai
  field publik. Fungsi ini jalan ke atas dari `actionCommand` (parameter
  kedua callback `preAction`) sampai `parent` bernilai `null` (root
  `program`), mengumpulkan `.name()` tiap level. Hasilnya path lengkap
  seperti `"intent lock"` atau `"config set language"` tanpa perlu daftar
  command manual.
- **Urutan `ensureOperationsLog()` vs `writeProjectIdentity()`**: di kedua
  `runStart` dan `runRegister`, `ensureOperationsLog()` dipanggil dulu,
  hasilnya (`logsReinitialized: boolean`) dipakai `resolveLogsCreatedAt()`
  untuk memutuskan nilai `logs_created_at` sebelum `writeProjectIdentity()`
  benar-benar menulis file — urutan ini penting karena
  `resolveLogsCreatedAt()` membaca identity file **lama** (kalau ada)
  sebelum ditimpa.
- **`Sigma/logs/operations.jsonl` untuk operasi `project register`/`start`
  itu sendiri**: karena `ensureOperationsLog()` jalan di tengah eksekusi
  handler (sebelum proses keluar), sementara entry log untuk operasi yang
  sedang berjalan baru ditulis belakangan oleh `process.on('exit')` — kalau
  log sempat di-regenerate kosong di tengah pemanggilan yang sama, baris
  yang tersisa setelah proses selesai persis satu: entry milik operasi
  `register`/`start` itu sendiri. Perilaku ini sengaja, dan jadi bagian
  dari test ketiga di `operation-log.test.ts`.

### Testing Walkthrough

`npx vitest run` — 22 file test, 136 test, semua passed (baseline
sebelumnya 21 file/131 test, tidak ada regresi). Test baru
(`test/operation-log.test.ts`, 5 test) mencakup: operasi sukses, operasi
gagal via `process.exit(1)` langsung, path nested subcommand, siklus
regenerasi log (missing → dibuat, valid → dipertahankan, korup →
diregenerasi + `logs_created_at` berubah), dan no-op di luar konteks
project.

### Keputusan yang Dibuat Selama Implementasi (bukan menunggu Director)

Dua dari tiga Isu Terbuka di draft awal diselesaikan langsung saat
implementasi tanpa menunggu jawaban Director eksplisit, karena keduanya
punya jawaban teknis yang jelas begitu kode yang relevan diperiksa (lihat
bagian "Isu Terbuka" di atas untuk detail alasan masing-masing):

1. Format nama operasi = command path apa adanya (bukan `operation_id`
   registry) — alasan lengkap di Isu Terbuka #2.
2. Tidak ada field tambahan per entry (durasi/aktor) — tetap default draft
   awal karena Director belum pernah menjawab pertanyaan itu secara
   eksplisit di sesi mana pun.

Kalau Director ingin mengubah salah satu keputusan ini nanti, itu
perubahan skema baru yang aman dilakukan kapan saja — baris JSONL lama
tetap valid untuk di-parse karena append-only dan tiap baris diparse
independen.
