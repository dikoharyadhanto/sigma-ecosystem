# PLAN-EVAL-01 — Konsolidasi `sigma doctor`, `override`, dan Penghapusan `project reset`

**Sumber**: `Discussion/sigma-system-evaluation-2026-07-14.md` (Topik 4 — bagian `override`/`sigma doctor`/`sigma project reset`)
**Tanggal**: 2026-07-14
**Status**: IMPLEMENTED (2026-07-14) — Bagian A dan Bagian B selesai dikerjakan dan diverifikasi. Lihat "Implementation Walkthrough" di akhir dokumen.
**Urutan eksekusi**: 1 dari 8 (lihat `README.md` di folder ini)
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN, tidak punya otoritas lock/gate Sigma.

---

## Kenapa Dokumen Ini Dikerjakan Lebih Dulu

Dari seluruh 7 topik yang disepakati di sesi evaluasi, **hanya satu keputusan yang
sengaja ditunda dan belum final**: arah perbaikan `override` + `sigma doctor`.
Dokumen sumber eksplisit menyebut ini sebagai agenda **wajib diselesaikan sebagai
bagian awal Plan Implementation, bukan diasumsikan**. Karena keputusan
`sigma project reset` (sudah final: dihapus, digantikan mode baru di `doctor`)
bergantung langsung pada bentuk akhir `sigma doctor`, kedua item ini digabung
jadi satu unit kerja yang harus tuntas sebelum dokumen plan lain menyentuh area
yang sama.

---

## Bagian A — Keputusan `override` + `sigma doctor` (Final: Opsi 1 — Perbaiki)

### Latar Belakang Teknis (sudah diverifikasi dari kode)

- `sigma doctor` (`runDoctorReconciliation`, [progress.ts:398-415](../../src/engine/progress.ts#L398-L415)) menghitung ulang gate flags murni dari `hasActiveLockedIntent`/`hasCleanGate2Chain`/`hasCleanGate3Chain` ([progress.ts:244-278](../../src/engine/progress.ts#L244-L278)) — fungsi-fungsi ini **tidak tahu apa-apa** soal `overrides.jsonl`.
- Akibatnya: begitu `sigma doctor` dijalankan setelah `override`, gate yang dipaksa terbuka **otomatis dibalikkan** ke tertutup oleh doctor. `override` jadi tidak reliable, efeknya mudah hilang tanpa peringatan, dan `overrides.jsonl` jadi log yatim (mengklaim bypass terjadi, padahal runtime sudah membatalkannya diam-diam).
- `override` sendiri **tidak redundan** dengan `supersede` — beda kasus: `override` memaksa gate terbuka tanpa artefak terkait benar-benar LOCKED ([override.ts:29-63](../../src/commands/override.ts#L29-L63)); `supersede` mengasumsikan artefak sudah LOCKED lalu diganti versi baru.

### Keputusan yang Harus Diambil di Awal Tahap Ini

Sebelum coding dimulai, Director harus memilih salah satu arah:

1. **Perbaiki** — buat `runDoctorReconciliation` "override-aware": baca `overrides.jsonl`, dan untuk override yang masih berlaku (belum di-supersede/exec belum selesai), jangan balikkan gate yang sudah sengaja dipaksa terbuka.
2. **Hapus** — buang `override` sepenuhnya karena bentuknya sekarang sudah tidak reliable, dan biarkan Director menggunakan jalur lock/supersede normal saja.

### Rekomendasi Teknis (bukan keputusan final — tetap perlu konfirmasi Director)

Opsi 1 (perbaiki) lebih konsisten dengan filosofi Sigma yang sudah ada — `override`
adalah katup darurat yang sah untuk kasus non-standar, dan `doctor` seharusnya
menghormati keputusan eksplisit Director, bukan menimpanya diam-diam. Opsi 2
lebih sederhana tapi menghapus kapabilitas yang punya use-case sah (bypass gate
tanpa lock lengkap).

### Task Breakdown — Bagian A

**Tahap A.1 — Ambil Keputusan Director**
- [x] Sampaikan dua opsi di atas ke Director, minta keputusan eksplisit sebelum lanjut ke A.2.

> **Keputusan Director (2026-07-14): Opsi 1 — Perbaiki.** `runDoctorReconciliation` dibuat override-aware, sesuai rekomendasi teknis di atas.

**Tahap A.2 — Jika opsi "Perbaiki" dipilih**
- [x] Ubah `runDoctorReconciliation` ([progress.ts:398-415](../../src/engine/progress.ts#L398-L415)) agar membaca `overrides.jsonl` sebelum menghitung ulang gate flags.
  - Implementasi: `runDoctorReconciliation(data, overrides)` menerima parameter baru `overrides: OverrideEntry[]` ([progress.ts](../../src/engine/progress.ts)); dibaca lewat `readOverrides(projectRoot)` di [doctor.ts](../../src/commands/doctor.ts).
- [x] Definisikan aturan "override masih berlaku": mis. override untuk gate tertentu dianggap aktif sampai artefak yang di-bypass benar-benar di-lock secara sah, atau sampai di-supersede eksplisit.
  - Aturan final (`isOverrideStillActive` di `progress.ts`): override tetap aktif selama versi artefak yang dicatat di log masih berstatus DRAFT (persis kondisi saat override dibuat). Begitu versi itu benar-benar LOCKED atau di-SUPERSEDED, override otomatis "habis" dan tidak lagi memengaruhi hasil `doctor`. `OverrideEntry` diperluas dengan field `version` (versi artefak yang di-bypass) agar aturan ini bisa dicek per versi, bukan per gate secara umum.
- [x] Tambahkan test: jalankan `override` lalu `doctor`, pastikan gate yang dipaksa terbuka **tidak** dibalikkan selama override masih valid.
  - Lihat [test/override-doctor.test.ts](../../test/override-doctor.test.ts) — test "keeps gate_2_open true after doctor when the overridden plan is still DRAFT".
- [x] Tambahkan test negatif: override yang sudah tidak relevan (artefak sudah di-lock normal) tidak lagi memengaruhi hasil `doctor`.
  - Lihat [test/override-doctor.test.ts](../../test/override-doctor.test.ts) — test "stops forcing the gate open once the overridden version is superseded by a real pivot".

**Tahap A.2 (alternatif) — Jika opsi "Hapus" dipilih**
- Hapus `src/commands/override.ts` dan registrasinya di `src/cli.ts`.
- Hapus `overrides.jsonl` read/write logic terkait di `progress.ts`/engine lain.
- Update test yang menguji `override` (cari lewat grep `override` di folder `test/`).
- Update README.md/SIGMA_PROTOCOL.md yang menyebut `sigma override`.

---

## Bagian B — Penghapusan `sigma project reset` (Sudah Final)

### Latar Belakang Teknis (sudah diverifikasi dari kode)

- `sigma project reset` ([project.ts:427-468](../../src/commands/project.ts#L427-L468)): mode soft menimpa total `progress.json` ke state awal (hanya `project_id`/`project_name` dipertahankan); `--wipe` tambahan mengosongkan `design/`, `build/`, `close/` (diarsipkan dulu, lokasi aktif dikosongkan).
- 3 masalah konkret: (1) tidak ada command restore/rollback — pemulihan dari backup butuh edit manual `progress.json`, bertentangan langsung dengan larangan `CLAUDE.md`; (2) tidak ada `--dry-run` (beda dengan `override` yang punya preview); (3) flag `--confirm` generik, tidak eksplisit menandakan otoritas Director seperti `--director-confirm` di `override`, padahal dampaknya lebih destruktif.
- `sigma doctor` **tidak** menggantikan tujuan asli `reset` — `runDoctorReconciliation()` ([progress.ts:358-490](../../src/engine/progress.ts#L358-L490)) hanya membandingkan field di dalam `progress.json` dengan dirinya sendiri, tidak pernah membaca file artefak markdown di disk.

### Keputusan (Final, dari sesi evaluasi)

1. `sigma project reset` **dihapus total** — mode soft maupun `--wipe`.
2. Kasus corruption recovery digantikan **2 mode baru di `sigma doctor`** (bukan command baru terpisah):
   - `sigma doctor --recovery` — perilaku doctor yang sudah ada saat ini (`runDoctorReconciliation`), hanya diberi nama/flag eksplisit. Tidak perlu logika baru (di luar hasil Bagian A jika opsi "Perbaiki" dipilih).
   - `sigma doctor --reconstruct` (nama final `--reconstruct` vs `--rebuild` bisa dipilih saat implementasi) — **kapabilitas baru**: `progress.json` lama dipindah ke lokasi backup/temp (bukan ditimpa diam-diam), lalu dibangun ulang dari nol dengan membaca seluruh file artefak Sigma (`design/`, `build/`, `close/`) untuk menentukan versi/status lock/gate berdasarkan kondisi file sebenarnya.
3. Use-case "lepas dari Sigma / lepas-pasang kembali" **tidak dipertahankan sebagai command** — cukup hapus folder `Sigma/` manual, tidak perlu jalur CLI.

### Task Breakdown — Bagian B

**Tahap B.1 — Hapus `project reset`**
- [x] Hapus `runReset()` dan registrasi `cmd.command('reset')` di `src/commands/project.ts` (~baris 427-468, 524-530).
- [x] Hapus test terkait `project reset` (grep `reset` di folder `test/`).
  - Tidak ditemukan test dedicated untuk `project reset` (grep hanya menemukan false-positive tidak terkait). Sebagai gantinya ditambahkan test regresi baru yang memverifikasi command benar-benar sudah tidak ada: [test/doctor-recovery-reset-removal.test.ts](../../test/doctor-recovery-reset-removal.test.ts) — "rejects `sigma project reset` as an unknown subcommand".

**Tahap B.2 — Tambahkan `sigma doctor --recovery`**
- [x] Tambahkan flag `--recovery` ke `src/commands/doctor.ts`, memanggil `runDoctorReconciliation` seperti perilaku default sekarang (setelah Bagian A selesai, termasuk logika override-aware jika opsi "Perbaiki" dipilih).
- [x] Putuskan apakah `--recovery` jadi default behavior baru (dipanggil tanpa flag) atau wajib eksplisit — dokumentasikan pilihannya di sini setelah implementasi.
  - **Keputusan**: `sigma doctor` tanpa flag **tetap** berperilaku persis seperti sebelumnya (backward compatible — tidak ada script/dokumentasi lama yang rusak). `--recovery` adalah alias eksplisit murni untuk perilaku yang sama, disediakan agar simetris dengan `--reconstruct` dan agar Director bisa secara eksplisit menyatakan "recovery mode" di command line. Test: [test/doctor-recovery-reset-removal.test.ts](../../test/doctor-recovery-reset-removal.test.ts) — "behaves identically to plain `sigma doctor`".

**Tahap B.3 — Bangun `sigma doctor --reconstruct`**
- [x] Desain parser artefak markdown (DIR-INTENT/ROADMAP/FMN-PLAN/DEV-EXEC/DIR-CLOSE) untuk ekstrak versi + status lock dari isi file — ini pekerjaan implementasi baru, belum ada logika serupa di codebase.
  - **Temuan penting selama implementasi**: isi file artefak **tidak pernah** menyimpan status lock (setiap template eksplisit menyatakan "Lock State: Managed by Sigma CLI via `progress.json`. Do not edit lock state here.", dan tidak ada command yang menulis stempel lock ke file). Parser karena itu tidak mem-parsing "status lock dari isi file", melainkan menyimpulkan status LOCKED dari **bukti struktural**: keberadaan artefak turunan yang secara arsitektur mensyaratkan gate atasnya benar-benar terkunci (mis. `FMN-PLAN` tidak mungkin ada tanpa `DIR-INTENT` LOCKED — lihat `plan.ts`/`exec.ts`/`close.ts`), dikombinasikan dengan aritmatika versi (`PLAN major = INTENT major − 1`, `EXEC major = PLAN major`). Kasus yang tidak bisa dibuktikan (versi terluar tanpa turunan, atau beberapa draft PLAN/EXEC ambigu di major yang sama) tidak pernah ditebak — selalu jatuh ke DRAFT + marker INVALID (memakai mekanisme INVALID yang sama dari Bagian A). Pendekatan ini diarahkan langsung oleh Director setelah saya melaporkan temuan di atas. Implementasi: [src/engine/reconstruct.ts](../../src/engine/reconstruct.ts) (baru).
- [x] Desain lokasi backup/temp untuk `progress.json` lama saat `--reconstruct` dijalankan (bukan `Sigma/logs/` seperti `reset` lama — tentukan lokasi baru saat implementasi, mis. `Sigma/logs/reconstruct-backup-<timestamp>.json`).
  - Diimplementasikan persis seperti disebut: `Sigma/logs/reconstruct-backup-<timestamp>.json` (lihat `runReconstruct()` di [doctor.ts](../../src/commands/doctor.ts)).
- [x] Implementasikan `--reconstruct`: baca seluruh artefak di `design/`, `build/`, `close/`, tentukan status lock per versi dari isi file (heading/marker), tulis `progress.json` baru.
  - Catatan tambahan di luar scope tertulis semula, ditemukan sebagai blocker nyata saat implementasi:
    - `findProjectRoot()` normal mensyaratkan `Sigma/progress.json` **ada** untuk menemukan root proyek — tidak berfungsi untuk skenario "progress.json hilang total" yang justru jadi tujuan utama `--reconstruct`. Ditambahkan `findSigmaProjectRoot()` yang mencari berdasarkan folder `Sigma/` saja.
    - Resolusi identitas proyek (`project_id`/`project_name`, wajib untuk `progress.json` baru) diselesaikan berlapis: baca `progress.json` mentah (meski gagal validasi) → cek `~/.sigma/projects.json` berdasarkan path → fallback flag `--id`/`--name` eksplisit.
    - **Bug pre-existing ditemukan & diperbaiki**: `createInitialProgress()` ([progress.ts](../../src/engine/progress.ts)) melakukan shallow-spread satu objek `emptyTracker` yang sama ke 5 domain (`intent`/`plan`/`exec`/`close`/`roadmap`), sehingga array `versions` ter-share antar domain. Selama ini laten karena seluruh command lain selalu round-trip lewat disk (JSON parse memutus reference) sebelum menyentuh domain lain; `--reconstruct` adalah pemakai pertama yang push ke banyak domain sekaligus di memori sebelum serialize, sehingga bug ini langsung kebongkar lewat kegagalan test. Sudah diperbaiki di root cause-nya.
- [x] Tambahkan test: skenario `progress.json` corrupt/hilang tapi artefak markdown lengkap → `--reconstruct` menghasilkan `progress.json` yang konsisten dengan isi file.
  - [test/reconstruct.test.ts](../../test/reconstruct.test.ts) (4 test): golden path single-cycle chain (progress.json hilang total), leaf INTENT yang tidak bisa dikonfirmasi LOCKED, multi-draft PLAN ambigu, serta identitas proyek pulih dari `--id`/`--name` saat `progress.json` corrupt (JSON invalid) sekaligus verifikasi backup dibuat.

**Tahap B.4 — Dokumentasi**
- [x] Update `README.md` dan `Sigma/SIGMA_PROTOCOL.md` yang menyebut `sigma project reset` — ganti dengan referensi ke `sigma doctor --recovery`/`--reconstruct`.
  - `Sigma/SIGMA_PROTOCOL.md` dan `Sigma/rules/*` sudah dicek — tidak ada referensi ke `sigma project reset` di sana (tidak perlu perubahan). `README.md`: baris `sigma project reset` dihapus dari tabel command reference; ditambahkan baris `sigma doctor` / `sigma doctor --recovery` / `sigma doctor --reconstruct` (`doctor` ternyata belum pernah didokumentasikan sama sekali di README sebelumnya). Sesuai keputusan Director, dokumen historis di `Discussion/`/`Implementation/` dan `setup/targets/*` tidak diubah.

---

## Risiko

- Keputusan Bagian A memengaruhi jumlah pekerjaan Bagian B.2 (apakah perlu logika override-aware di `--recovery`) — jangan mulai B.2 sebelum A.1 tuntas.
- `--reconstruct` adalah kapabilitas baru yang belum ada presedennya di codebase (parsing artefak markdown untuk menentukan state) — alokasikan waktu ekstra untuk edge case (artefak dengan format tidak standar, versi ganda, dsb).
- Tidak ada jalur migrasi otomatis untuk project lama yang masih mengandalkan `sigma project reset` — Director perlu sadar ini sebagai breaking change bagi siapa pun yang memakainya (kemungkinan kecil karena tool ini dipakai Director sendiri).

---

## Draft Acceptance Criteria

- [x] Keputusan `override` (perbaiki/hapus) sudah diambil eksplisit oleh Director dan dicatat di dokumen ini sebelum implementasi Bagian A.2 dimulai. — Lihat catatan keputusan di Tahap A.1 (Opsi 1 — Perbaiki).
- [x] `sigma project reset` tidak lagi ada di CLI (baik soft maupun `--wipe`). — Diverifikasi lewat test regresi (unknown command).
- [x] `sigma doctor --recovery` tersedia dan berperilaku setara `doctor` lama (ditambah override-aware jika opsi "Perbaiki" dipilih).
- [x] `sigma doctor --reconstruct` tersedia, teruji terhadap skenario `progress.json` hilang/corrupt dengan artefak lengkap di disk.
- [x] Seluruh test suite (`npm test`) lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini. — 105 passed / 7 failed; 7 kegagalan itu sudah dikonfirmasi pre-existing (identik sebelum dan sesudah perubahan sesi ini, diverifikasi lewat `git stash` + re-run).
- [x] README.md/SIGMA_PROTOCOL.md tidak lagi menyebut `sigma project reset` sebagai command aktif.

---

## Implementation Walkthrough

**Dikerjakan**: 2026-07-14, Professional Mode (bukan DEV role Sigma — plan ini tidak melalui gate Sigma).

### Files Changed

| File | Perubahan |
|:--- |:--- |
| [src/config.ts](../../src/config.ts) | Tambah konstanta `OVERRIDES_FILE`. |
| [src/engine/progress.ts](../../src/engine/progress.ts) | Tambah `OverrideEntry`, `readOverrides()`, logika override-aware di `runDoctorReconciliation`; export `parseMajorVersion`/`parseMinorVersion`/`hasActiveLockedIntent`/`hasCleanGate2Chain`/`hasCleanGate3Chain` untuk dipakai ulang oleh `reconstruct.ts`; fix bug shared-array-reference di `createInitialProgress()`. |
| [src/commands/override.ts](../../src/commands/override.ts) | Pakai `OverrideEntry` dari engine; catat `version` artefak yang di-bypass ke log. |
| [src/commands/doctor.ts](../../src/commands/doctor.ts) | Tambah flag `--recovery` dan `--reconstruct` (+ `--id`/`--name`); wiring ke `readOverrides`/`runDoctorReconciliation`/`reconstructProgress`. |
| [src/commands/project.ts](../../src/commands/project.ts) | Hapus `runReset()` + registrasi `project reset`; export `validateProjectId`/`validateProjectName` untuk dipakai `doctor.ts`. |
| [src/engine/reconstruct.ts](../../src/engine/reconstruct.ts) | **Baru.** Discovery artefak dari disk + rekonstruksi `progress.json` berbasis bukti struktural. |
| [README.md](../../README.md) | Hapus baris `project reset`; tambah baris `doctor`/`--recovery`/`--reconstruct`. |
| [test/override-doctor.test.ts](../../test/override-doctor.test.ts) | **Baru.** 2 test (Bagian A). |
| [test/doctor-recovery-reset-removal.test.ts](../../test/doctor-recovery-reset-removal.test.ts) | **Baru.** 2 test (Bagian B.1/B.2). |
| [test/reconstruct.test.ts](../../test/reconstruct.test.ts) | **Baru.** 4 test (Bagian B.3). |

### Keputusan Desain Kunci

1. **Override tetap ada, dibuat override-aware** (Bagian A) — aturan "masih berlaku" diikat ke state versi artefak (DRAFT → masih berlaku; LOCKED/SUPERSEDED → habis), bukan ke timestamp, supaya deterministik dan mudah diuji.
2. **`--reconstruct` tidak pernah menebak status lock** — karena isi file artefak memang tidak pernah menyimpan status lock (temuan yang mengubah premis awal Bagian B.3), pendekatan final memakai bukti struktural (gate-dependency chain + aritmatika versi), dengan fallback ke DRAFT + marker INVALID untuk semua kasus yang tidak bisa dibuktikan. Ini arahan langsung Director setelah saya melaporkan temuan bahwa parsing isi file secara jujur tidak mungkin dilakukan.
3. **`sigma doctor` default tidak berubah** — `--recovery` murni alias, supaya tidak ada breaking change untuk siapa pun yang sudah terbiasa memakai `sigma doctor` polos.

### Verifikasi

- `npm run build` bersih di setiap tahap.
- Baseline pre-existing dikonfirmasi via `git stash` + rebuild + test: 7 test gagal yang sama sudah ada sebelum sesi ini dimulai, tidak terkait override/doctor/reset.
- Full suite akhir: **105 passed / 7 failed** (7 gagal = baseline pre-existing, tidak berubah).

### Keterbatasan yang Diketahui (untuk follow-up jika diperlukan)

- `--reconstruct` tidak bisa memulihkan timestamp historis asli (`locked_at`, dsb.) — semua distempel dengan waktu reconstruct dijalankan.
- Kasus multi-draft PLAN/EXEC ambigu di major yang sama sengaja tidak diautoresolusi — Director perlu memverifikasi manual lalu memakai `sigma plan lock`/`sigma plan supersede` seperti biasa.
- `--reconstruct` tidak pernah bisa membuktikan `DIR-CLOSE` benar-benar LOCKED (langkah closing adalah leaf tanpa artefak turunan) — selalu default DRAFT + marker INVALID, Director perlu re-run `sigma close lock` jika project memang seharusnya CLOSED.
