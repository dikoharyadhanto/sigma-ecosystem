# Panduan Migrasi `Sigma/progress.json` Lama → Skema Multi-Chain

Panduan operasional untuk menjalankan `scripts/migrate-legacy-progress.js`
terhadap project Sigma mana pun yang masih memakai skema lama
(`Sigma/progress.json` tunggal). Ditulis setelah migrasi nyata pertama
terhadap project **JLH** (`KLHK_JasaLingkunganHidup`) berhasil dijalankan
dan diverifikasi (2026-07-18).

**Rujukan desain lengkap**: [PLAN-EVAL-03 — Migration Algorithm & JLH
Cutover](../Implementation/planned_sigma_multichain_progress_2026_07_17/PLAN-EVAL-03-MIGRATION-AND-JLH-CUTOVER.md)
— dokumen ini cuma versi ringkas cara pakai, bukan pengganti dokumen itu.

---

## 1. Kapan panduan ini relevan

Project Sigma yang **hanya** punya `Sigma/progress.json` (belum pernah
punya `Sigma/activate_status.json`) sudah **tidak dikenali `sigma` CLI
sama sekali** sejak PLAN-EVAL-01 — semua command akan gagal dengan pesan
seperti *"No Sigma project found"* atau *"Not inside a Sigma project"*,
walau foldernya valid. Ini bukan bug, memang disengaja: skema penyimpanan
baru (satu file `progress-v<N>.json` per chain + satu `activate_status.json`
sebagai pointer) menggantikan skema lama secara total.

Kalau project Anda mengalami ini, itu tandanya project tersebut perlu
dimigrasikan dulu memakai skrip ini.

## 2. Prasyarat

- Akses ke source code `sigma-ecosystem` di komputer ini
  (`i:\Works\Project\sigma-ecosystem`) — skrip **bukan** bagian dari
  paket `sigma` yang ter-install global, jadi selalu dijalankan dari sini,
  menunjuk ke path project lain sebagai argumen.
- Build sudah terbaru:
  ```
  cd i:\Works\Project\sigma-ecosystem
  npm run build
  ```
  (cukup dijalankan ulang kalau ada perubahan kode `sigma-ecosystem` sejak
  terakhir kali — tidak perlu diulang setiap migrasi kalau kode tidak berubah).
- Project target sudah di-commit git (disarankan, bukan wajib — lihat §6
  soal kenapa tidak ada guard otomatis).

## 3. Langkah-langkah

### Langkah 1 — Dry-run dulu, selalu

```
node scripts/migrate-legacy-progress.js "<path-project-target>" --dry-run
```

Ini **tidak menulis apa pun ke disk** — hanya mencetak isi lengkap
`progress-v<N>.json` yang AKAN dihasilkan untuk setiap chain, plus isi
`activate_status.json`-nya. Baca hasil ini baris demi baris sebelum
lanjut — ini satu-satunya jaring pengaman nyata di alur ini (lihat §6).

### Langkah 2 — Tangani entry yang ambigu (kalau ada)

Kalau di data lama ada `DIR-INTENT` yang berstatus `SUPERSEDED` atau
`INACTIVE`, skrip **akan menolak jalan** dan meminta keputusan eksplisit —
tidak ada default otomatis, karena versi Sigma lama dulu **otomatis**
menandai intent sebelumnya `SUPERSEDED`/`INACTIVE` setiap kali intent yang
lebih baru dikunci, terlepas apakah itu benar-benar keputusan Director atau
bukan (persis kasus JLH v1).

Pilih salah satu, per versi yang bermasalah:

| Situasi sebenarnya | Flag |
| --- | --- |
| Chain itu sebenarnya berdiri sendiri — selesai (closed) atau masih berjalan, **bukan** benar-benar dibatalkan | `--treat-locked=v1` |
| Chain itu memang benar-benar dibatalkan/digantikan | `--treat-superseded=v1` |

Boleh beberapa versi sekaligus, dipisah koma: `--treat-locked=v1,v3`.

### Langkah 3 — Perbaiki state yang tidak sesuai kenyataan (kalau ada)

Kadang data lama mencatat sesuatu sebagai `LOCKED` padahal kenyataannya
belum selesai (atau sebaliknya) — akibat bug lama (lihat
[PLAN-EVAL-07](../Implementation/planned_sigma_multichain_progress_2026_07_17/PLAN-EVAL-07-RECONSTRUCT-METADATA-PRESERVATION.md))
atau sekadar belum sempat dikunci lewat command. Timpa manual per entry:

```
--force-plan-state=v0.2=DRAFT
--force-exec-state=v1.1=DRAFT
```

Format: `<versi>=<STATE>`, `STATE` salah satu dari `DRAFT`/`LOCKED`/`SUPERSEDED`,
boleh beberapa dipisah koma. Ini yang dipakai untuk mengoreksi `exec v1.1`
di migrasi JLH (tercatat `LOCKED` di data lama, tapi kenyataannya masih
`DRAFT`).

### Langkah 4 — Ulangi dry-run sampai hasilnya benar

Jalankan lagi Langkah 1 dengan flag-flag di atas ditambahkan, review lagi.
Ulangi sampai output-nya benar-benar mencerminkan kenyataan project
tersebut — jangan terburu-buru ke langkah berikutnya.

### Langkah 5 — Jalankan sungguhan

Tambahkan `--confirm`, hilangkan `--dry-run`:

```
node scripts/migrate-legacy-progress.js "<path-project-target>" \
  --treat-locked=v1 \
  --force-exec-state=v1.1=DRAFT \
  --confirm
```

Ini menulis `Sigma/progress-v1.json`, `Sigma/progress-v2.json`, dst. (satu
file per chain) dan `Sigma/activate_status.json`. **`Sigma/progress.json`
lama tidak disentuh sama sekali** — tetap ada di disk sebagai file mati,
aman dihapus manual belakangan kalau sudah yakin migrasi berhasil.

### Langkah 6 — Verifikasi dengan `sigma` CLI sungguhan

Pindah ke folder project target, jalankan (semua harus exit sukses, tanpa
error "Not inside a Sigma project" lagi):

```
sigma project status
sigma session bootstrap
sigma intent list
sigma doctor --all-versions
```

`intent list` harus menampilkan satu baris per chain dengan status yang
sesuai ekspektasi Langkah 4. `doctor --all-versions` harus melaporkan
semua chain `VALID` (tidak ada marker invalid baru).

### Langkah 7 — Commit manual

Skrip ini **tidak pernah** menjalankan `git add`/`git commit` apa pun —
itu tetap keputusan dan tindakan Anda sendiri, setelah puas dengan hasil
verifikasi Langkah 6. Review `git status`/`git diff` project target dulu
sebelum commit.

---

## 4. Ringkasan semua flag

| Flag | Wajib? | Fungsi |
| --- | --- | --- |
| `<projectRoot>` (argumen pertama) | Ya | Path ke folder root project yang mau dimigrasikan |
| `--dry-run` | Default | Cetak hasil tanpa menulis apa pun |
| `--confirm` | Ya, untuk benar-benar menulis | Tulis `progress-v<N>.json` + `activate_status.json` |
| `--treat-locked=v1,v2` | Kondisional | Chain `SUPERSEDED`/`INACTIVE` di data lama yang sebenarnya berdiri sendiri (bug auto-supersede sistem lama) |
| `--treat-superseded=v1` | Kondisional | Chain `SUPERSEDED`/`INACTIVE` di data lama yang memang benar-benar dibatalkan |
| `--force-plan-state=v0.1=DRAFT,...` | Opsional | Timpa state entry PLAN tertentu yang tidak sesuai kenyataan |
| `--force-exec-state=v1.1=DRAFT,...` | Opsional | Sama seperti di atas, untuk entry EXEC |

Kalau ada `DIR-INTENT` dengan status `SUPERSEDED`/`INACTIVE` tapi belum
dicakup salah satu dari `--treat-locked`/`--treat-superseded`, skrip
**berhenti dengan error** dan menyebutkan persis versi mana yang perlu
diputuskan — bukan menebak.

## 5. Contoh nyata: migrasi JLH (2026-07-18)

```
node scripts/migrate-legacy-progress.js \
  "i:\Works\Project\KLHK_JasaLingkunganHidup" \
  --treat-locked=v1 \
  --force-exec-state=v1.1=DRAFT \
  --confirm
```

Konteks: intent v1 JLH tercatat `SUPERSEDED` di data lama (efek bug
auto-supersede), padahal sebenarnya chain v1 adalah pekerjaan yang sudah
selesai dan closed berdiri sendiri, tidak dibatalkan oleh v2 →
`--treat-locked=v1`. Exec v1.1 (di bawah chain v2 yang masih berjalan)
tercatat `LOCKED` padahal kenyataannya belum selesai → `--force-exec-state=v1.1=DRAFT`.

Hasil: `progress-v1.json` (semua domain `LOCKED`, gates
`true/true/true`, lifecycle `CLOSED`), `progress-v2.json` (intent `LOCKED`,
roadmap `DRAFT`, plan v1.1 `LOCKED`, exec v1.1 `DRAFT`, gate_3 `false`
karena exec belum locked, lifecycle `BUILD`), `activate_status.json`
menunjuk `v2`.

## 6. Catatan penting soal keamanan

- **Tidak ada mekanisme backup otomatis dan tidak ada guard git-clean-tree**
  — ini keputusan sadar (lihat PLAN-EVAL-02), bukan kealpaan. Satu-satunya
  jaring pengaman adalah: (a) `--dry-run` sebagai default, (b) `--confirm`
  wajib eksplisit untuk menulis, (c) `git status`/`git diff` project git
  Anda sendiri sebagai rollback (`git checkout -- Sigma/` kalau ternyata
  hasilnya salah).
- Skrip memvalidasi setiap `ChainState` yang dihasilkan
  (`validateChainSemantics()`) sebelum menulis apa pun — kalau ada yang
  gagal validasi, skrip berhenti dengan pesan error deskriptif tanpa
  menulis file apa pun untuk chain yang gagal itu (chain lain yang sudah
  divalidasi lolos tetap bisa keburu tertulis kalau kegagalan terjadi
  belakangan dalam urutan — makanya tetap review `--dry-run` dulu,
  jangan andalkan validasi sebagai satu-satunya jaring pengaman).
- Kalau proses berhenti di tengah (mati sebelum `activate_status.json`
  sempat ditulis), project untuk sementara tidak dikenali `sigma` CLI sama
  sekali sampai file itu ada — cukup jalankan ulang skrip (aman diulang,
  tidak merusak apa pun) atau `git checkout -- Sigma/` untuk mulai bersih.
- Skrip ditulis generik berdasar satu kasus nyata (JLH) — kalau project
  lain punya bentuk data lama yang berbeda dari yang sudah ditangani di
  sini (misalnya pola `close`/`roadmap` yang tidak biasa), skrip mungkin
  gagal dengan error atau menghasilkan sesuatu yang perlu ditinjau ulang.
  Selalu perlakukan hasil `--dry-run` sebagai sesuatu yang wajib dibaca
  penuh, bukan formalitas.
