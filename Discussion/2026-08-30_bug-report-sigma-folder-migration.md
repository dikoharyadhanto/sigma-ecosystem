# Bug Report Sigma CLI — Kerusakan Resolusi Path Setelah Migrasi Struktur Folder Manual

> Disusun untuk diserahkan ke AI pengembang Sigma. Ditulis oleh sesi DEV
> (Claude) atas permintaan Director, 2026-08-30. Sigma CLI versi **0.10.0**.
> Project: KLHK JasaLingkunganHidup, active chain v4, phase BUILD.

---

## 1. Ringkasan Eksekutif

Director memindahkan struktur folder artefak Sigma secara manual (`git mv`,
commit `b30c5b7`, 2026-08-30 21:33 +07) agar sesuai dengan **SIGMA_PROTOCOL.md
§13 Folder-to-Phase Mapping** (`Sigma/charter/`, `Sigma/contract/`,
`Sigma/roadmap/`, `Sigma/evidence/`). Perpindahan file itu sendiri **sudah
benar** dan cocok dengan target yang didokumentasikan protokol.

Namun `progress-v<N>.json` menyimpan path absolut per-artefak di field
`entry.file`, dan CLI **meresolusi `entry.file` lebih dulu** (perilaku yang
memang dinyatakan protokol §13: *"every command resolves stored `entry.file`
paths first ... old projects are never force-migrated to the new folder
names"*). Karena `entry.file` masih menunjuk `Sigma/build/...` dan
`Sigma/design/...` yang sudah tidak ada, **semua operasi CLI yang membuka file
artefak lama gagal dengan `ENOENT`**.

Tidak ada perintah migrasi (`sigma project` hanya punya `start`, `status`,
`sync`, `register`; tidak ada `migrate`/`relayout`). `sigma doctor` melaporkan
`VALID` — tidak mendeteksi `entry.file` menggantung.

**Dampak:** operasi baca-saja untuk verifikasi artefak lama rusak; artefak baru
(v3.8, dibuat setelah migrasi) tidak terpengaruh.

---

## 2. Apa yang Dilakukan Director

| Langkah | Detail |
| :--- | :--- |
| Perintah | `git mv` seluruh isi `Sigma/build/` → `Sigma/contract/` (FMN-PLAN), `Sigma/evidence/` (DEV-EXEC), `Sigma/roadmap/` (ROADMAP); `Sigma/design/` → `Sigma/charter/` (DIR-INTENT); `discussion/`, `references/`, `research/` → `Sigma/notes/` |
| Commit | `b30c5b7` (pesan commit menyesatkan — tertulis "Add ROADMAP v2, v3, and v4" padahal isinya restrukturisasi folder + artefak v3.8) |
| Folder lama | `Sigma/build/` dan `Sigma/design/` sudah **tidak ada** (terhapus penuh oleh rename) |
| Yang TIDAK diupdate | `progress-v1..v4.json` (`entry.file`), `Sigma/messages/index.json`, `SIGMA-OPERATION-REGISTRY.json` |

Target migrasi cocok dengan SIGMA_PROTOCOL.md §13 (versi protokol di project ini
sudah memuat mapping folder baru — diupdate di commit `bd8f6ee` / `b30c5b7`).

---

## 3. BUG A — `entry.file` Menggantung Setelah Migrasi Folder

### 3.1 Akar masalah

`progress-v4.json` menyimpan (16 entri stale):

```
line  10:  "file": "Sigma/design/DIR-INTENT-v4.md"      → seharusnya Sigma/charter/
line  37:  "file": "Sigma/build/ROADMAP-v4.md"          → seharusnya Sigma/roadmap/
line  48–116: "file": "Sigma/build/FMN-PLAN-v3.1..v3.7" → seharusnya Sigma/contract/
line 188–241: "file": "Sigma/build/DEV-EXEC-v3.1..v3.7" → seharusnya Sigma/evidence/
```

Chain non-aktif juga: `progress-v1.json` (8), `progress-v2.json` (16),
`progress-v3.json` (4) — total 28 entri stale tambahan.

`SIGMA-OPERATION-REGISTRY.json` memuat string `Sigma/design/DIR-INTENT-v{version}.md`,
`Sigma/build/FMN-PLAN-v{version}.md`, `Sigma/build/DEV-EXEC-{plan_version}.md`,
`Sigma/build/ROADMAP-v{N}.md` di field `description` (kosmetik — bukan resolusi,
tapi menyesatkan pembaca).

Hanya artefak v3.8 (dibuat setelah migrasi) yang benar:
`Sigma/contract/FMN-PLAN-v3.8.md`, `Sigma/evidence/DEV-EXEC-v3.8.md`.

### 3.2 Perintah yang rusak (reproduksi verbatim)

| Perintah | Error |
| :--- | :--- |
| `sigma intent check` | `ENOENT: no such file or directory, open '.../Sigma/design/DIR-INTENT-v4.md'` |
| `sigma roadmap check` | `ENOENT: ... open '.../Sigma/build/ROADMAP-v4.md'` |
| `sigma plan check --v v3.1` … `--v v3.7` | `ENOENT: ... open '.../Sigma/build/FMN-PLAN-v3.7.md'` |
| `sigma exec check --v v3.1` … `--v v3.7` | `ENOENT: ... open '.../Sigma/build/DEV-EXEC-v3.7.md'` |
| `sigma exec check --v v3.4` (draft parked) | `ENOENT: ... open '.../Sigma/build/DEV-EXEC-v3.4.md'` |

Catatan: `sigma exec check --v 3.4` (tanpa prefix `v`) memberi pesan berbeda
lagi — `DEV-EXEC 3.4 not found` — inkonsistensi normalisasi argumen versi
(minor, terpisah).

### 3.3 Perintah yang TIDAK rusak

Semua yang hanya membaca metadata `progress-v<N>.json` tanpa membuka file
artefak: `sigma project status`, `sigma plan list`, `sigma exec list`,
`sigma exec status`, `sigma plan check` (tanpa `--v`, meresolusi artefak aktif
v3.8), `sigma exec check --v v3.8`, `sigma config show`, `sigma reference`,
`sigma report logs`, MCP `sigma_get_state` / `sigma_get_gates` /
`sigma_get_orientation` / `sigma_list_artifacts`, dan `sigma exec new`
(menulis ke lokasi baru `Sigma/evidence/` dengan benar).

### 3.4 `sigma doctor` — gap diagnostik

`sigma doctor` dan MCP `sigma_doctor` melaporkan:

```
--- Current Runtime State ---
  VALID
findings: { repaired: [], invalidMarked: [], invalidCleared: [], remainingInvalid: [] }
```

Doctor **tidak memvalidasi keberadaan file `entry.file`**. Idealnya doctor
mendeteksi `entry.file` menggantung dan menawarkan perbaikan (lihat §5).

---

## 4. BUG B — Separator Path Windows di `messages/index.json` (PRA-ADA, bukan dari migrasi ini)

### 4.1 Akar masalah

`Sigma/messages/index.json` memuat **54 entri** dengan `file` memakai separator
backslash Windows:

```
line 581: "file": "Sigma\\messages\\DEV\\20260720-043455837-G2GE-HANDOFF-FMN-to-DEV.md"
```

`git blame`: masuk sejak commit `3598a890` (2026-07-30) — era mesin Windows.
**Bukan** akibat restrukturisasi folder 2026-08-30. Sudah ada sebelum project
pindah ke Linux (lihat `Sigma/notes/2026-08-01_migrasi-proses-ekstraksi-geoai-ke-linux.md`).
Entri baru (pasca-Linux) memakai forward-slash dengan benar — index.json jadi
campuran.

CLI melakukan `fs.open` dengan string path literal tanpa normalisasi ke POSIX,
sehingga di Linux 54 entri itu tidak resolve.

### 4.2 Perintah yang rusak

| Perintah | Error |
| :--- | :--- |
| `sigma inbox read MSG-20260819-172404446-KC06-FMN-DEV` | `Message file missing on disk: Sigma\messages\DEV\20260819-172404446-KC06-NOTE-FMN-to-DEV.md` (file-nya SEBENARNYA ada di `Sigma/messages/DEV/...` dengan forward-slash) |
| `sigma inbox check` | `Result: 166 pass, 55 warning(s), 54 failure(s)` — "Message file missing on disk" untuk 54 entri backslash + "ORPHAN FILE (not in index)" untuk file yang sama karena string path tak cocok |

Contoh unik: pesan `KC06` muncul **dua kali** di output `inbox check` —
sebagai "missing on disk" (entri index backslash) DAN "orphan file" (file
fisik forward-slash) — konfirmasi ini murni ketidakcocokan string separator,
bukan file benar-benar hilang.

### 4.3 Dampak

54 pesan historis tidak bisa dibaca via `sigma inbox read`. Pesan DEV yang
relevan untuk sesi ini (`KC06`, FYI historis DEV-EXEC-v3.7) sudah dibaca
langsung dari file fisik — tidak menghambat pekerjaan v3.8. Tidak ada pesan
UNREAD aktif yang terdampak selain KC06 (yang isinya FYI, sudah terverifikasi).

---

## 5. Rekomendasi untuk Pengembang Sigma

### Prioritas 1 — Perintah migrasi layout

Tambahkan `sigma project migrate-layout` (atau perluas `sigma doctor --repair`)
yang:
1. Mendeteksi `entry.file` di semua `progress-v<N>.json` yang tidak ada di disk.
2. Untuk tiap entri menggantung, mencari file dengan basename sama di folder
   kanonik §13 (`charter/`, `contract/`, `roadmap/`, `evidence/`, `close/`)
   dan folder lama (`build/`, `design/`).
3. Jika tepat satu kandidat ditemukan → rewrite `entry.file`.
4. Menulis log ke `Sigma/logs/` (protokol §13 menyebut folder ini memang untuk
   "migration logs" — fitur tampaknya sudah diantisipasi tapi belum ada).
5. Idempoten; dry-run default seperti `sigma project sync`.

### Prioritas 2 — `sigma doctor` deteksi `entry.file` menggantung

Doctor harus menandai `entry.file` yang tidak ada di disk sebagai temuan
`INVALID` (bukan `VALID`), dengan pesan yang mengarahkan ke perintah perbaikan.
Saat ini doctor memberi rasa aman palsu.

### Prioritas 3 — Normalisasi separator path

Semua pembacaan path dari `progress-v<N>.json` dan `messages/index.json` harus
di-normalisasi (`path.normalize` + swap `\` → `/` di POSIX) sebelum `fs`
access. Ini menyelesaikan BUG B tanpa perlu edit manual index.json, dan
membuat project portabel Windows↔Linux.

### Prioritas 4 — Guardrail

- Saat CLI mendeteksi folder kanonik baru (`Sigma/contract/` dll.) berisi
  artefak TAPI `entry.file` masih menunjuk folder lama → tampilkan peringatan
  eksplisit + saran jalankan migrasi, alih-alih `ENOENT` mentah.
- `sigma project sync` bisa sekalian mendeteksi kondisi ini.

### Prioritas 5 — Konsistensi minor

- `sigma exec check --v 3.4` vs `--v v3.4` memberi jalur error berbeda —
  normalisasi argumen versi.
- `SIGMA-OPERATION-REGISTRY.json` field `description` masih menyebut
  `Sigma/build/` dan `Sigma/design/` — perbarui saat regenerasi.

---

## 6. Kondisi Saat Laporan Ini Dibuat

- **Belum ada perbaikan diterapkan.** Tidak ada file state yang diedit manual
  (CLAUDE.md melarang edit `progress.json` / `index.json` langsung).
- **Pekerjaan v3.8 bisa lanjut:** `FMN-PLAN-v3.8` dan `DEV-EXEC-v3.8` sudah di
  lokasi kanonik baru dengan `entry.file` benar; `sigma exec check --v v3.8`
  jalan normal.
- **Risiko yang belum diuji:** apakah `sigma exec lock` untuk v3.8 membaca
  artefak sibling (mis. DIR-INTENT-v4) lewat path saat re-evaluasi Gate 3.
  Bila ya, lock v3.8 bisa gagal sampai BUG A diperbaiki. Tidak diuji karena
  `exec lock` mengubah state dan butuh otorisasi Director.
- **`sigma exec new --plan v3.8`** dijalankan sesi ini (membuat draft v3.8) —
  tidak memperparah kerusakan; menulis ke `Sigma/evidence/` dengan benar.
- Draft `DEV-EXEC-v3.4` (di-park atas instruksi Director 2026-08-15) kini tidak
  bisa di-`check`/`lock` sampai BUG A diperbaiki.

### Opsi interim (keputusan Director)

| Opsi | Konsekuensi |
| :--- | :--- |
| A. Tunggu perbaikan CLI dari pengembang Sigma | Paling aman. Verifikasi artefak lama & resume v3.4 tertunda. v3.8 pre-build tetap bisa jalan. |
| B. Revert commit `b30c5b7` (kembalikan `Sigma/build/` + `Sigma/design/`) | CLI langsung normal. Artefak v3.8 perlu ikut dipindah balik + `entry.file`-nya disesuaikan. Membatalkan penyelarasan ke struktur protokol §13. |
| C. Pengembang Sigma sediakan patch/skrip migrasi `entry.file` | Solusi permanen sesuai arah protokol §13. |

---

## 7. Resolusi (sesi Professional Mode, 2026-08-30)

### BUG A — `entry.file` menggantung → diperbaiki langsung di project KLHK

Keputusan Director: KLHK adalah **satu-satunya** project yang pernah migrasi folder manual,
dan `Sigma/build/`·`Sigma/design/` tidak akan dipakai lagi ke depan. Jadi tidak perlu
mekanisme migrasi permanen di CLI — cukup edit langsung file state KLHK (Professional Mode,
di luar governance role), git sebagai jaring pengaman.

Diedit di `/home/dikoharyadhanto/Documents/Works/Projects/KLHK_JasaLingkunganHidup`
(substitusi string `entry.file`, tidak menyentuh state/gate/version):

| Dari | Ke |
| :--- | :--- |
| `Sigma/design/DIR-INTENT-*` | `Sigma/charter/DIR-INTENT-*` |
| `Sigma/build/ROADMAP-*` | `Sigma/roadmap/ROADMAP-*` |
| `Sigma/build/FMN-PLAN-*` | `Sigma/contract/FMN-PLAN-*` |
| `Sigma/build/DEV-EXEC-*` | `Sigma/evidence/DEV-EXEC-*` |

- `progress-v1..v4.json`: 44 entri `entry.file` diperbaiki (8 + 16 + 4 + 16). Tiap target
  diverifikasi ada di disk. `Sigma/close/DIR-CLOSE-v1.md`, `Sigma/pending/FMN-PLAN-*.md`,
  dan entri v3.8 dibiarkan (sudah benar).
- `SIGMA-OPERATION-REGISTRY.json`: 8 string `description`/`post_condition` kosmetik dibersihkan.
- `Sigma/messages/index.json`: 54 entri `file` backslash → forward-slash (BUG B, lihat bawah).

Percobaan sebelumnya menambah rekonsiliasi path ke `sigma doctor` **di-revert** — nilainya
terikat ke skenario migrasi yang tidak akan berulang.

### BUG B — separator backslash

- `progress-v<N>.json`: sudah ditangani sebelumnya (`normalizeFilePathsOnRead`).
- **KLHK** `messages/index.json`: 54 entri `file` di-swap `\` → `/` langsung (perbaikan satu kali).
- **CLI (sigma-ecosystem)**: `readIndex()` (`src/engine/mailbox.ts`) kini menormalkan `\` → `/`
  pada `file` dan `attachments[]` setiap baca, sebelum cek duplikat — melengkapi pola
  `normalizeFilePathsOnRead()` yang sudah ada untuk `progress.json`, asuransi portabilitas
  Windows↔Linux ke depan. `index.json` tidak ditulis ulang oleh CLI.
- Test: `test/mailbox-path-normalization.test.ts`.

### Fitur tambahan (permintaan Director) — tier pesan `OUTDATED`

Tujuan: AI role tidak membuang waktu membaca pesan usang. Non-destruktif — hanya flip status,
tidak ada file dipindah/dihapus.

- Status pesan: `UNREAD | READ | ARCHIVED | OUTDATED`.
- `sigma inbox clear --role <role> [--keep 5] [--dry-run]` — READ berlebih (di luar N terbaru)
  → `OUTDATED`. `sigma inbox clear --all-roles --director-confirm` untuk semua role sekaligus.
- `sigma inbox --role X --all` = UNREAD + READ + ARCHIVED (tanpa OUTDATED); `--outdated` khusus OUTDATED.
- Auto-sweep: default **aktif** (`mailbox.auto_outdate_read_keep: 5` di `project.config.json`).
  Setelah tiap `sigma inbox read` sukses, READ berlebih milik role tsb. → `OUTDATED` + notifikasi.
  `sigma config set mailbox-outdate-keep 0` untuk menonaktifkan.
- `sigma inbox read <id>` tetap bisa membaca pesan OUTDATED (tidak mengubah status kembali).
- Test: `test/inbox-outdated.test.ts`.

### Belum dikerjakan

Setelah keputusan "perbaiki KLHK langsung, tidak ada mekanisme migrasi di CLI", sisa relevan:

- **Prioritas 5a** — normalisasi argumen `--v 3.4` ≡ `--v v3.4`. Bug arg-parsing independen,
  tidak terkait folder. Prioritas rendah.
- **Prioritas 5b** — cek apakah generator registry (`scripts/refresh-registries.js` /
  template) di sigma-ecosystem masih memancarkan `Sigma/build/`·`Sigma/design/`; kalau ya,
  itu doc-drift laten untuk semua project saat regenerasi. Prioritas rendah.

Tidak lagi relevan (mati bersama revert rekonsiliasi-path `sigma doctor`):
Prioritas 4 (guardrail ENOENT), varian Prioritas 2 (flag `entry.file` hilang total).

## 8. Resolusi lanjutan — normalisasi separator di sisi TULIS (sesi Professional Mode, 2026-09-03)

Konteks: path project ini bolak-balik Linux↔Windows. Normalisasi saat-BACA
(`normalizeFilePathsOnRead`, `readIndex`) sudah ada, tapi tiap command masih
menyimpan path pakai `path.join(...)` → di Windows persist `\` ke JSON, dan
konsumen yang tak lewat dua fungsi itu tetap patah. Suite test dijalankan di
Windows: **9 gagal**, sebagian bug lintas-platform asli.

Ditangani (Prioritas 3, tuntas):

- Helper `toPosix()` baru di `src/utils/fs.ts`. Dipakai di tiap titik yang
  **mem-persist** atau **membandingkan-string** relative path:
  `intent/plan/exec/close/roadmap new` (`entry.file`), `send` (index `file` +
  `attachments`), `*humanize*` (`humanRelPath`/`ledgerRelPath`), `doctor
  --reconstruct` (`reconstruct.ts` rebuild `file`), `scan` (report path).
  Progress-v<N>.json & messages/index.json kini POSIX-at-rest di OS manapun.
- **BUG lintas-platform nyata #1** — `sigma inbox check` di Windows: disk-walk
  pakai `path.join` (`\`) dibandingkan dengan index yang sudah dinormalisasi
  ke `/` saat baca → **tiap pesan dilaporkan ORPHAN**. Fixed di
  `inbox.ts:213`.
- **BUG lintas-platform nyata #2** — `writeReasonixMcpConfig` menulis path
  Windows mentah (`args = ["C:\Users\..."]`) ke `~/.reasonix/config.toml`.
  `\U` bukan escape unicode TOML yang valid → **seluruh config.toml gagal
  parse, Reasonix kehilangan semua plugin**. Fixed: normalisasi ke forward
  slash + `JSON.stringify` (`mcpConfig.ts`). Config `.mcp.json` / `.cursor` /
  Codex tak disentuh — JSON meng-escape `\` dengan benar dan `resolveRoot()`
  fallback ke `cwd` bila path tersimpan tak resolve di OS lain.
- **Prioritas 5b** — dicek: `scripts/refresh-registries.js` tidak lagi
  memancarkan `Sigma/build/`·`Sigma/design/` (sudah dibersihkan di commit
  `322f0f7`). Tidak ada aksi.

**Prioritas 5a (tuntas)** — `normalizeVersionArg()` baru di `chain.ts`, dipasang
sebagai commander coercion fn di tiap opsi `--v` / `--plan` dan `notion pull
<version>`. `--v 3.4` dan `--v v3.4` kini resolve identik (trim + prefix `v`
bila diawali digit; idempoten; teks non-versi lewat apa adanya).

**Line ending** — `.gitattributes` (`eol=lf`) + renormalize ditambahkan: file
yang di-build/checkout di Windows tak lagi tampil "modified" palsu.

Test: `test/version-arg-normalization.test.ts` (baru), blok write-side di
`test/windows-path-backward-compat.test.ts`, asersi Reasonix di
`test/mcp-config.test.ts` diupdate ke `toPosix(tmpProject)`. Suite: **431 pass,
0 gagal**. Commit `de70363`.

Semua item bug report ini selesai.
