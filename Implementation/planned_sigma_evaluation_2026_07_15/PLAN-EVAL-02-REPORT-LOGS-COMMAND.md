# PLAN-EVAL-02 — `sigma report logs` Command

**Sumber**: Diskusi langsung Professional Mode, 2026-07-17 (follow-up dari
[PLAN-EVAL-01-OPERATION-HISTORY-LOG.md](PLAN-EVAL-01-OPERATION-HISTORY-LOG.md)).
**Tanggal**: 2026-07-17
**Status**: IMPLEMENTED
**Urutan eksekusi**: Berdiri di atas PLAN-EVAL-01 — butuh
`Sigma/logs/operations.jsonl` dan `OperationLogEntry` yang dibangun di
plan itu.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan
FMN-PLAN, tidak punya otoritas lock/gate Sigma.

---

## Objective

PLAN-EVAL-01 membuat `Sigma/logs/operations.jsonl` bisa diisi otomatis,
tapi satu-satunya cara membacanya adalah `cat` mentah — tidak enak dibaca
begitu baris sudah banyak. Plan ini menambahkan command baca-saja untuk
menampilkannya dalam format yang enak dibaca, dengan filter.

---

## Keputusan Desain yang Disepakati

1. **Domain command**: `sigma report logs` — bukan command top-level baru
   (`sigma logs`), melainkan subcommand pertama dari domain `report` yang
   baru dibuat (belum ada sebelumnya di CLI — jangan tertukar dengan skill
   Claude Code `/report`, itu hal yang berbeda). Membuka ruang untuk
   `sigma report ...` lain di masa depan.
2. **Format output default**: baris log yang diformat, bukan tabel
   berkolom, bukan dump JSON mentah:
   ```
   [2026-07-15T10:23:41.512Z] SUCCESS  intent lock
   [2026-07-15T10:24:02.884Z] ERROR    override (exit 1)
   ```
   `(exit N)` hanya ditampilkan untuk baris `ERROR` — `SUCCESS` selalu
   exit 0, redundan untuk ditampilkan tiap baris.
3. **`--json`** sebagai escape hatch — cetak baris JSONL mentah (setelah
   difilter) untuk kebutuhan scripting/`jq`, tanpa reformat.
4. **Filter "maksimal tapi wajar"** — tidak menambah field baru ke file
   log itu sendiri, cuma cara menyaring saat ditampilkan:
   - `--status <success|error>`
   - `--operation <text>` — substring match, case-insensitive
   - `--since <ISO|relatif>` / `--until <ISO|relatif>` — relatif menerima
     `Nd`/`Nh`/`Nm` (hari/jam/menit sebelum sekarang)
   - `-n, --limit <N>` — N entri terakhir yang masih memenuhi filter lain
5. **Default tanpa `--limit`**: tampilkan **semua** entri yang cocok, tidak
   ada pemotongan tersembunyi. Alasan: log ini "murni catatan historis
   untuk pemantauan" — pemotongan default berisiko menyembunyikan
   informasi tanpa Director sadar. `--limit` murni opt-in.

---

## Task Breakdown

- [x] Buat `src/commands/report.ts` — domain `report`, subcommand `logs`.
  Baca `operations.jsonl` via `findProjectRoot()` (baris korup di-skip,
  tidak menggagalkan seluruh laporan), terapkan filter, cetak.
- [x] Daftarkan `reportCommand()` di
  [src/cli.ts](../../src/cli.ts).
- [x] Verifikasi manual end-to-end di project scratch: project campuran
  sukses/gagal, semua filter (`--status`, `--operation`, `--limit`,
  `--json`, `--since`, `--until`) dan jalur error (`--status` invalid,
  `--limit` invalid, `--since` invalid, di luar project) dicoba langsung
  lewat CLI sungguhan, bukan cuma unit test.
- [x] `test/report-logs.test.ts` — 10 test baru (format output, tiap
  filter satu per satu, kombinasi `--json` + filter, error path, log
  kosong, di luar project).

---

## Dependency Catatan

- Bergantung penuh pada PLAN-EVAL-01 — memakai `OPERATIONS_LOG_FILE` dan
  tipe `OperationLogEntry` yang didefinisikan di sana, tidak mendefinisikan
  skema baru.
- Tidak ada dependency masuk dari plan lain.

---

## Risiko

- `--operation` substring match berarti filter yang terlalu pendek bisa
  menangkap lebih banyak dari yang dimaksud (misal `--operation an`
  menangkap `plan check` juga). Diterima sebagai trade-off kesederhanaan —
  tidak ada sintaks regex/exact-match terpisah.
- Baris JSONL korup di `operations.jsonl` di-skip diam-diam saat dibaca
  (bukan menggagalkan seluruh laporan) — konsisten dengan sifat file
  sebagai catatan historis best-effort, tapi berarti laporan bisa
  under-report tanpa peringatan eksplisit kalau ada korupsi parsial.

---

## Acceptance Criteria — ALL MET (implemented 2026-07-17)

- [x] `sigma report logs` menampilkan seluruh entri dalam format baris log
  yang mudah dibaca, tanpa `--limit` menyembunyikan apa pun secara diam-diam.
- [x] `--status`, `--operation`, `--since`, `--until`, `--limit`, `--json`
  semuanya berfungsi sesuai spesifikasi, diverifikasi manual (CLI
  sungguhan di project scratch) dan otomatis (10 test).
- [x] Nilai filter tidak valid (`--status`, `--limit`, `--since`/`--until`)
  menghasilkan pesan error yang jelas dan exit code 1, bukan crash/stack
  trace.
- [x] Command di luar konteks project gagal bersih (pesan error standar
  `findProjectRoot()`, exit code 1).
- [x] `npm test` lulus tanpa regresi — 23 file test, 146 test, semua
  passed (naik dari 22 file/136 test di akhir PLAN-EVAL-01).

---

## Implementation Walkthrough

**Tanggal eksekusi**: 2026-07-17
**Mode**: Professional Mode.

### Ringkasan File Berubah

- `src/commands/report.ts` (baru) — domain `report`, subcommand `logs`,
  parser filter, formatter baris log.
- `src/cli.ts` — import + `program.addCommand(reportCommand())`.
- `test/report-logs.test.ts` (baru) — 10 test.

### Detail Non-Trivial

- **`sigma report logs` mencatat dirinya sendiri**: karena hook operation
  log di PLAN-EVAL-01 sifatnya global (semua command lewat
  `program.hook('preAction', ...)`), setiap pemanggilan `report logs` juga
  jadi satu baris baru di `operations.jsonl` — tapi baru ditulis di
  `process.on('exit')`, **setelah** command selesai mencetak hasilnya.
  Jadi laporan yang dicetak tidak pernah memuat entri untuk pemanggilan itu
  sendiri; entri itu baru muncul di pemanggilan berikutnya. Perilaku ini
  diverifikasi lewat pengujian manual (lihat Testing Walkthrough) dan
  didokumentasikan lewat komentar di `test/report-logs.test.ts` (test
  `--limit`).
- **Baris JSONL korup di-skip, bukan menggagalkan seluruh perintah**:
  `readAllEntries()` membungkus `JSON.parse()` tiap baris dalam
  `try/catch` — satu baris korup (misal dari korupsi manual/gangguan I/O)
  tidak membuat seluruh `sigma report logs` gagal, hanya baris itu yang
  hilang dari laporan.
- **`--since`/`--until` relatif**: regex `/^(\d+)([dhm])$/i` dicoba dulu
  sebelum jatuh ke `new Date(value)` — jadi `1d`/`24h`/`30m` diproses
  sebagai offset dari waktu sekarang, string lain diperlakukan sebagai
  tanggal/waktu absolut standar JavaScript `Date` parsing.

### Testing Walkthrough

Dua lapis verifikasi:

1. **Manual, end-to-end**: project scratch dibuat lewat `node dist/cli.js
   project start`, dijalankan campuran command sukses (`project status`,
   `intent status`, `doctor`) dan gagal (`override` tanpa `--reason`,
   `plan check` tanpa Gate 1) untuk mengisi log sungguhan, lalu semua
   filter dan jalur error dicoba langsung lewat CLI yang di-build
   (`dist/cli.js`), bukan cuma lewat test runner.
2. **Otomatis**: `test/report-logs.test.ts` (10 test) + full suite
   `npx vitest run` — 23 file test, 146 test, semua passed, tanpa regresi
   dari baseline 22 file/136 test.
