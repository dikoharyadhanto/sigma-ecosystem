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

## 7. Resolusi (sesi DEV Professional Mode, 2026-08-30)

Diterapkan di codebase sigma-cli ini (bukan di project KLHK). Semua 430 test hijau, `tsc` bersih.

### BUG A — `entry.file` menggantung → ditangani di `sigma doctor` (Opsi C)

- `runDoctorReconciliation()` (`src/engine/chain.ts`) menerima `projectRoot` opsional. Pass baru:
  untuk tiap path tersimpan (`intent`/`roadmap`/`close`/`plan.versions`/`plan.pending`/`exec.versions`)
  yang tidak ada di disk, cari basename yang sama di folder kanonik **dan** legacy
  (`charter`/`design`, `contract`/`build`, `evidence`/`build`, `roadmap`/`build`, `close`).
  - Tepat 1 kandidat → `entry.file` ditulis ulang di tempat, dilaporkan sebagai `Repaired`.
  - ≥2 kandidat → `INVALID` marker (butuh review Director).
  - 0 kandidat → **dibiarkan** (artefak hilang/terhapus adalah domain `sigma doctor --reconstruct`,
    bukan pass ini — supaya state metadata-only tidak terganggu).
- `sigma doctor` = chain aktif; `sigma doctor --all-versions` = semua chain (v1..v4).
- MCP `sigma_doctor` melaporkan temuan yang sama, tetap read-only terhadap disk.
- Project yang **belum** migrasi tidak tersentuh (path lama masih resolve → tidak ada aksi).
- Test: `test/doctor-dangling-paths.test.ts`.

### BUG B — separator backslash

- `progress-v<N>.json`: sudah ditangani sebelumnya (`normalizeFilePathsOnRead`).
- `messages/index.json`: `readIndex()` (`src/engine/mailbox.ts`) kini menormalkan `\` → `/`
  pada `entry.file` dan `attachments[]` setiap kali baca, sebelum cek duplikat. `index.json`
  tidak ditulis ulang. `sigma inbox read` / `inbox check` kini resolve 54 entri legacy.
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

### Belum dikerjakan (tindak lanjut terpisah, disepakati Director)

- Prioritas 4 — guardrail: ubah ENOENT mentah jadi pesan "jalankan `sigma doctor`".
- Prioritas 5 — normalisasi argumen `--v 3.4` vs `--v v3.4`; string `Sigma/build/`·`Sigma/design/`
  di `description` `SIGMA-OPERATION-REGISTRY.json`.
- Prioritas 2 (varian): menandai `entry.file` yang hilang total (0 kandidat) sebagai `INVALID` —
  ditunda karena butuh refactor fixture test yang luas.
