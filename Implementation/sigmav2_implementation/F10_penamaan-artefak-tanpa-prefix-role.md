# F10 — Penamaan artefak tanpa prefix role

Tanggal: 14 Oktober 2026
Status: DIIMPLEMENTASIKAN pada master 15 Oktober 2026 (ter-commit: f223c00). O-1 sampai O-9 disetujui Director sesuai rekomendasi; otorisasi eksekusi diberikan Director. Hasil dan batas pada bagian 10. Distribusi ke perangkat/proyek tetap F09.
Urutan: setelah F17, sebelum F12 (urutan yang diterima Director: F17 → F10 → F12 → finalisasi Protocol/keputusan review Constitution → F09).
Basis pemeriksaan: repositori master Sigma, branch main, HEAD cf5364d (F17 ter-commit).

Dasar: T-16 pada [F00](F00_indeks-dan-register.md) (TERKUNCI, Director, 6 Oktober 2026) dan butir 2 pada daftar fokus F00 bagian 7; sumber: D-07 pada dokumen 28 September.
Dokumen ini bukan artefak governance proyek terdaftar.

Label: **TERKUNCI** = arahan eksplisit Director; **TERVERIFIKASI** = hasil baca source pada HEAD di atas; **REKOMENDASI** = usulan teknis yang belum disetujui; **TERBUKA** = keputusan yang masih diperlukan.

## 1. Tujuan dan batas

Artefak baru dibuat tanpa prefix role pada nama file. Artefak lama tidak diganti nama. Seluruh operasi yang bergantung pada nama file menerima nama dengan maupun tanpa prefix.

Di luar cakupan (REKOMENDASI, menunggu konfirmasi pada O-7 dan O-8): mengubah nama tipe artefak pada teks keluaran dan dokumen (mis. "DIR-INTENT" pada tampilan status), marker `SIGMA:DOC type=DIR_INTENT`, nama berkas template (`DIR-INTENT-TEMPLATE.md` dan sejenisnya), mengganti nama artefak lama, serta distribusi ke host/proyek (F09).

## 2. Keputusan Director yang terkunci

- (T-16) Sejak Sigma v2 terpasang, setiap `intent new`, `plan new`, `exec new`, dan `close new` membuat file tanpa prefix role, di proyek baru maupun lama.
- Artefak lama tetap berprefix dan tidak diganti nama.
- Semua operasi yang memeriksa nama file menerima nama dengan maupun tanpa prefix.
- Tidak ada eksekusi sebelum otorisasi eksplisit Director.

Bentuk nama baru, nasib pending plan, dan hal lain pada bagian 6 belum ditentukan.

## 3. Peta dampak terverifikasi

Pemeriksaan baca saja (grep dan baca source) pada HEAD cf5364d. Verifikasi ulang sebelum eksekusi karena kode dapat berubah.

### 3.1 Definisi pusat dan pemakainya

| Lokasi | Fakta | Dampak |
|---|---|---|
| `src/config.ts:80-86`, `ARTIFACT_LAYOUT` | Satu tabel per domain: `dirs`, `prefix` (`DIR-INTENT`, `ROADMAP`, `FMN-PLAN`, `DEV-EXEC`, `DIR-CLOSE`), `versionSource`. | Titik tunggal untuk ditingkatkan: prefix tunggal harus menjadi nama baru ditambah nama lama yang masih diterima. |
| `src/engine/reconstruct.ts:77-87` | Regex `^<prefix>-(<version>)\.md$` untuk menemukan artefak di disk. | Nama tanpa prefix tidak ditemukan; chain tidak dapat direkonstruksi. |
| `src/mcp/artifactPath.ts:75-87`; `src/mcp/tools/readArtifact.ts` | Path kandidat dibangun dari `prefix` dan `dirs`. | Pembacaan artefak lewat MCP gagal untuk nama baru. |
| `src/engine/chain.ts:563-571` (`readChain`) | Pemeriksaan identitas chain (intent, scheme, plan_ref) hanya untuk path yang cocok `<prefix>-<ver>.md`; yang tidak cocok dilewati **tanpa galat**. | Nama baru melemahkan pemeriksaan identitas secara senyap. Harus diterima agar pemeriksaan tetap berlaku. |

### 3.2 Penjaga identitas path

| Lokasi | Fakta | Dampak |
|---|---|---|
| `src/engine/revisions.ts:41-50`, `artifactFile` | Menolak path terdaftar kecuali tepat `Sigma/<dir>/<PREFIX>-<version>.md` (galat "Unregistered/cross-identity artifact path"). Dipakai approval, revisi, dan pencatatan changelog F17. | **Pemblokir utama.** Tanpa perubahan, `approve` dan changelog gagal untuk setiap artefak bernama baru. |

### 3.3 Pembuat nama (create)

| Lokasi | Pembuatan |
|---|---|
| `src/services/intentDraftService.ts:54,98` | `charter/DIR-INTENT-<chain>.md` |
| `src/services/planDraftService.ts:104,121` | `contract/FMN-PLAN-<ver>.md` |
| `src/services/execDraftService.ts:127,142` | `evidence/DEV-EXEC-<ver>.md` |
| `src/services/closeNewService.ts:40`; `src/mcp/control/tools/prepareCloseNew.ts:71` | `close/DIR-CLOSE-<chain>.md` (dan teks ringkasan efek) |
| `src/services/planPromoteService.ts:169,202` | `contract/FMN-PLAN-<ver>.md` saat promote dari pending |
| `src/services/cloneDraftService.ts:70` | Tujuan clone F08 (intent dan plan) |
| `src/commands/plan.ts:94`; `src/mcp/artifactPath.ts:237`; `src/services/planPromoteService.ts:84` | Pending plan `pending/FMN-PLAN-<id>.md` dan path kanonisnya |

### 3.4 Path bawaan jika `entry.file` kosong

`src/commands/intent.ts:56`, `plan.ts:59`, `exec.ts:23`, `close.ts:38`; `src/services/intentRatifyService.ts:29`, `execLockService.ts:28`, `closeLockService.ts:32`, `planLockService.ts:28`, `planSupersedeService.ts:42`; `src/mcp/tools/intentStatus.ts:15`; pesan di `execDraftService.ts:89`.

Pola `entry.file ?? default`: path terdaftar menang, jadi hanya berlaku bila entri tanpa `file`. Default hanya perlu mengikuti nama baru untuk entri baru tanpa `file`; entri lama tetap benar.

### 3.5 Filter berbasis nama dan teks

| Lokasi | Fakta | Dampak |
|---|---|---|
| `src/commands/scan.ts:12` | `SIGMA_ARTIFACT_PATTERNS = [/^DIR-INTENT-/, /^FMN-PLAN-/, /^DEV-EXEC-/, /^ROADMAP-/, /^DIR-CLOSE-/]` untuk mengecualikan berkas artefak dari pemindaian terminologi. | Nama baru akan dipindai sebagai dokumen biasa (positif palsu). Basename `PLAN-v1.1.md` juga ada di `Sigma/revisions/staging/`, jadi filter harus sadar direktori. |
| `src/commands/doctor.ts:230,255,310` | Pesan galat menyebut `DIR-INTENT-v<N>.md`. | Teks menyesatkan untuk nama baru. |
| `Sigma/SIGMA_PROTOCOL.md:466-470`; `Sigma/SIGMA-OPERATION-REGISTRY.json:268-273,536,821,1531`; `README.md:107` | Tabel dan deskripsi penamaan. | Dokumentasi mengikuti. |

### 3.6 Terverifikasi tidak terdampak

- **Referensi mailbox:** `src/engine/mailboxContext.ts:124` (dan 150) sudah menerima `INTENT|ROADMAP|PLAN|EXEC|CLOSE-vN` dengan maupun tanpa `DIR|FMN|DEV-`. Pesan dan memo tidak perlu diubah.
- **Revisi PLAN:** `src/engine/revisions.ts` memakai `Sigma/revisions/PLAN-<ver>/...` yang sudah tanpa prefix.
- **Marker tipe dokumen** (`type=DIR_INTENT`, `FMN_PLAN`, `DEV_EXEC`, `DIR_CLOSE`) dan pembacaan `SIGMA:DOC` oleh reconstruct tidak bergantung pada nama file.
- **ROADMAP** sudah tanpa prefix role (`ROADMAP-v1.md`).
- **`setup/`, `scripts/`, `bin/`:** nol rujukan nama berprefix pada pemeriksaan ini.

### 3.7 Tes

Sekitar 26 berkas tes memanggil `intent|plan|exec|close new` melalui CLI, dan sekitar 445 baris tes menyebut pola nama berprefix. Sebagian besar adalah path fixture terdaftar yang tetap valid (nama lama diterima) dan menjadi cakupan kompatibilitas mundur. Tes yang menegaskan **nama file hasil pembuatan** harus diubah; jumlahnya baru diketahui saat suite dijalankan terhadap perubahan, bukan dari audit ini.

## 4. Spesifikasi yang direkomendasikan

Seluruh bagian ini adalah **REKOMENDASI**, kecuali yang tercantum pada bagian 2.

### 4.1 Nama baru

| Domain | Lama | Baru |
|---|---|---|
| Intent | `DIR-INTENT-v1.md` | `INTENT-v1.md` |
| Plan | `FMN-PLAN-v1.1.md` | `PLAN-v1.1.md` |
| Exec | `DEV-EXEC-v1.1.md` | `EXEC-v1.1.md` |
| Close | `DIR-CLOSE-v1.md` | `CLOSE-v1.md` |
| Roadmap | `ROADMAP-v1.md` | tidak berubah |

Alasan: kosakata `INTENT/PLAN/EXEC/CLOSE-vN` sudah dipakai pada referensi mailbox, jalur revisi, dan pesan galat.

### 4.2 Modul tunggal

Satu modul (usulan `src/engine/artifactNames.ts`) menggantikan penggunaan `prefix` langsung:

- `artifactFileName(domain, version)` → nama baru, hanya untuk pembuatan.
- `artifactNameRegex(domain)` dan `matchArtifactName(domain, filename)` → menerima nama baru **dan** lama, mengembalikan versi serta bentuk (baru/lama).
- `candidateFileNames(domain, version)` → daftar nama yang diterima, nama baru lebih dulu.

Semua konsumen pada 3.1, 3.2, dan 3.5 beralih ke modul ini; pembuat pada 3.3 memakai `artifactFileName`. `entry.file` yang terdaftar tetap sumber kebenaran; pencocokan nama hanya memvalidasi bahwa path terdaftar adalah salah satu bentuk yang sah untuk identitasnya.

### 4.3 Aturan perilaku

- **Pembuatan:** selalu nama baru, pada direktori yang sama seperti sekarang (`charter/`, `contract/`, `evidence/`, `close/`). Bila file tujuan sudah ada dalam bentuk lama untuk versi yang sama, pembuatan ditolak dengan galat yang jelas (bukan menimpa, bukan membuat pasangan).
- **Pencocokan:** menerima kedua bentuk pada setiap direktori yang diizinkan (termasuk `design/` dan `build/` lama).
- **Satu versi dua bentuk:** dua file untuk versi yang sama di direktori yang sama adalah konflik; dilaporkan oleh reconstruct/doctor dan tidak dipilih otomatis (O-3).
- **Chain campuran:** chain yang dibuat dengan nama lama dapat memperoleh artefak baru bernama baru (T-16). Perilaku ini diuji, bukan dihindari.

## 5. Dampak ke fitur lain

- **F17:** pencatatan changelog memakai `artifactFile`, sehingga bergantung pada perbaikan di 3.2. Tes kompatibilitas ditambahkan.
- **F08 (clone, audit pack):** target clone memakai nama baru; pembacaan sumber lama tetap.
- **F12 (versi Sigma pada proyek):** sinyal "outdated" membantu mencegah binary lama bertemu nama baru; tidak menjadi prasyarat.
- **F09:** distribusi template/rule/registry yang diubah dilakukan di sana.

## 6. Keputusan terbuka dan rekomendasi

| ID | Keputusan | Rekomendasi dan alasan | Status |
|---|---|---|---|
| O-1 | Bentuk nama baru | `INTENT-vN.md`, `PLAN-vN.M.md`, `EXEC-vN.M.md`, `CLOSE-vN.md`; mengikuti kosakata yang sudah dipakai mailbox dan jalur revisi. | DISETUJUI |
| O-2 | Pending plan | `pending/PLAN-<id>.md` untuk pending baru; pending lama tetap sah (path kanonis menerima bentuk terdaftar yang cocok). Konsisten dengan `plan new` pada T-16. | DISETUJUI |
| O-3 | Dua bentuk untuk satu versi pada direktori yang sama | Konflik yang dilaporkan, tidak diselesaikan otomatis; operasi memakai `entry.file` terdaftar; reconstruct melaporkannya pada daftar dilewati/ambigu. | DISETUJUI |
| O-4 | Chain lama menerima artefak bernama baru | Ya, sesuai T-16 ("di proyek baru maupun lama"). Konsekuensi: daftar folder bercampur dua bentuk pada satu chain. Pengaman: tes campuran dan penjaga identitas tetap berlaku. | DISETUJUI |
| O-5 | Binary Sigma lama terhadap nama baru | Gagal tertutup pada jalur utama (`artifactFile` menolak), tetapi pemeriksaan identitas `readChain` dilewati senyap. Rekomendasi: **tidak** menaikkan `SCHEMA_VERSION` (menyentuh setiap chain); catat sebagai batas yang dikurangi F12. Alternatif yang saya tolak: bump skema agar binary lama menandai chain INVALID (ada preseden pada pekerjaan RATIFIED), karena biayanya migrasi seluruh proyek. | DISETUJUI |
| O-6 | Filter `scan` | Pakai `matchArtifactName` sadar direktori (hanya direktori artefak), bukan basename. Alasan: `Sigma/revisions/staging/PLAN-v1.1.md` memakai basename yang sama. | DISETUJUI |
| O-7 | Teks keluaran dan marker | Tidak diubah: nama tipe pada tampilan status/pesan ("DIR-INTENT", "FMN-PLAN") dan `type=DIR_INTENT` tetap. Alasan: T-16 membahas nama file; marker adalah identitas skema yang dibaca validator dan reconstruct. Pembahasan penamaan konseptual, bila diinginkan, adalah fokus terpisah. | DISETUJUI |
| O-8 | Nama berkas template | Tidak diubah (`DIR-INTENT-TEMPLATE.md` dst.). Alasan: aset Sigma yang dirujuk setup, registry, `project sync`, dan `~/.sigma`; mengubahnya menyebar tanpa manfaat bagi artefak proyek. | DISETUJUI |
| O-9 | `fallbackPath` pada docCheck (`DIR-INTENT.md`, `FMN-PLAN.md`, `DEV-EXEC.md`, `DIR-CLOSE.md`) | Perlu diverifikasi pemakaiannya pada W0; bila hanya default untuk pemeriksaan tanpa versi, tambahkan nama baru sebagai pilihan pertama dan pertahankan yang lama. | DISETUJUI; diverifikasi: `fallbackPath` tidak dibaca oleh kode mana pun (hanya deklarasi), jadi tidak diubah |

## 7. Strategi uji dan kriteria selesai

Tidak ada pengujian runtime dijalankan pada sesi penyusunan ini. Kontrak uji yang diusulkan:

| ID | Kasus | Hasil yang diharapkan |
|---|---|---|
| U-01 | `intent|plan|exec|close new` (CLI dan MCP), pada proyek baru dan chain lama | File tanpa prefix pada direktori yang sama; entri terdaftar `file` memuat nama baru. |
| U-02 | Artefak berprefix lama pada semua operasi (status, check, approve, supersede, reconstruct, MCP read) | Perilaku tidak berubah. |
| U-03 | Chain campuran: intent lama + plan/exec baru | Approve, lock, ledger, dan changelog F17 berfungsi. |
| U-04 | Dua bentuk untuk satu versi pada satu direktori | Konflik dilaporkan; tidak ada pilihan diam-diam; tidak ada penimpaan. |
| U-05 | `readChain` dengan nama baru | Pemeriksaan identitas (intent, scheme, plan_ref) tetap berlaku dan menolak metadata yang tidak cocok. |
| U-06 | `artifactFile` dengan path terdaftar baru, lama, dan tidak sah (`../`, direktori salah, versi tidak cocok) | Baru dan lama diterima; yang tidak sah ditolak seperti sebelumnya. |
| U-07 | Reconstruct pada disk dengan bentuk campuran, termasuk `design/` dan `build/` | Semua ditemukan dengan versi benar; tipe dokumen salah dilaporkan seperti sekarang. |
| U-08 | Pending plan baru dan lama, promote | Path kanonis diterima untuk keduanya; hasil promote memakai nama baru. |
| U-09 | Clone F08 | Tujuan memakai nama baru; sumber berprefix tetap terbaca. |
| U-10 | `sigma scan` pada artefak baru dan `Sigma/revisions/staging/PLAN-*.md` | Artefak dikecualikan; hanya direktori artefak dipertimbangkan. |
| U-11 | Referensi mailbox `PLAN-v1.1`, `FMN-PLAN-v1.1`, `PLAN-v1.1` pada chain campuran | Tetap terselesaikan ke pemilik yang benar. |

Kriteria selesai setelah eksekusi diotorisasi: seluruh keputusan O-1 sampai O-9 tertutup; tes fokus dan regresi lengkap lulus; TypeScript dan build bersih; `git diff --check` bersih; perubahan dokumen (Protocol, registry, README) tercatat; hasil dan batas dicatat pada dokumen ini.

## 8. Risiko dan pengaman

- **Pemeriksaan identitas dilewati senyap** untuk nama yang tidak dikenal (3.1). Pengaman: modul tunggal, dan U-05.
- **Penjaga `artifactFile` terlalu longgar** setelah menerima dua bentuk. Pengaman: tetap ketat pada direktori, versi, dan bentuk; diuji U-06.
- **Konflik dua bentuk** pada satu versi. Pengaman: dilaporkan, tidak otomatis (O-3), U-04.
- **Binary lama** terhadap nama baru (O-5). Pengaman: gagal tertutup di jalur utama; F12 sebagai pelengkap.
- **Basename sama** pada direktori berbeda (`PLAN-v1.1.md`). Pengaman: filter sadar direktori (O-6).
- **Cakupan menyebar** ke teks dan marker. Pengaman: O-7 dan O-8 menutup cakupan pada nama file.

## 9. Urutan eksekusi setelah otorisasi

1. **W0 — verifikasi ulang:** ulangi pemetaan 3.x pada HEAD saat itu; selesaikan O-9; jalankan suite sebagai baseline.
2. **W1 — modul penamaan:** `artifactNames.ts` dengan tes unit; belum mengubah konsumen.
3. **W2 — penerima (match):** `ARTIFACT_LAYOUT`, `reconstruct`, `mcp/artifactPath`, `readChain`, `artifactFile`, `scan`; tes U-02, U-05, U-06, U-07, U-10. Pembuatan masih nama lama pada tahap ini.
4. **W3 — pembuat (create):** layanan draft, promote, clone, pending, pesan efek; tes U-01, U-03, U-04, U-08, U-09, U-11.
5. **W4 — teks dan dokumen:** pesan galat, Protocol, registry, README; hash role memory bila rule berubah.
6. **W5 — regresi dan penutupan:** suite lengkap, build, `git diff --check`; catat hasil dan batas. Commit menunggu instruksi Director.

Pemisahan W2 sebelum W3 disengaja: sistem lebih dulu belajar membaca kedua bentuk, baru mulai menulis bentuk baru.

**Batas otorisasi (diperbarui):** eksekusi F10 diotorisasi Director pada 15 Oktober 2026 dengan lingkup bagian 9 dan hasil pada bagian 10. Commit, distribusi ke perangkat/proyek, F12, dan F09 tidak termasuk.

## 10. Hasil eksekusi (15 Oktober 2026)

Dieksekusi W0–W5 sesuai bagian 9 pada master. Ter-commit (f223c00).

| Gelombang | Hasil |
|---|---|
| W0 | HEAD cf5364d; baseline 80 berkas / 1.250 tes hijau; O-9 diverifikasi (`fallbackPath` tidak dipakai). |
| W1 | Modul `src/engine/artifactNames.ts`; `ARTIFACT_LAYOUT` memuat `prefix` (baru) dan `legacyPrefix`. |
| W2 | Penerima menerima kedua bentuk: `reconstruct` (konflik dua bentuk dilaporkan pada daftar dilewati), `mcp/artifactPath` (termasuk path pending), `readChain`, `artifactFile`, `sigma scan` (nama pra-F10 dikenali dengan nama; nama baru dikenali menurut folder). |
| W3 | Pembuat: intent/plan/exec/close new, plan new --pending, promote, clone F08, pesan efek `prepareCloseNew`; semua menolak bila versi sama sudah ada dalam bentuk lain. Path bawaan `entry.file ?? ...` memakai `defaultArtifactRel`. |
| W4 | Pesan doctor, SIGMA_PROTOCOL (tabel folder), registry operasi (4 deskripsi), README, CHANGELOG master. |
| W5 | `tsc` bersih; 80 berkas / 1.278 tes hijau (1.250 sebelumnya + 28 baru pada `test/f10-artifact-names.test.ts`); `git diff --check` bersih. |

Penyesuaian tes lama (nama berkas hasil pembuatan): 12 berkas tes, 17 asersi. Seluruh path fixture berprefix tetap valid dan kini menjadi cakupan kompatibilitas mundur.

Batas dan catatan:

- `artifactFile` mempertahankan himpunan folder lamanya (plan: `contract`, `design`; exec: `evidence`, `build`) dan hanya memperluas bentuk nama. Perbedaan dengan `ARTIFACT_LAYOUT` (plan: `contract`, `build`) sudah ada sebelum F10 dan tidak diubah.
- Binary Sigma yang lebih lama menolak artefak bernama baru pada jalur utama (`artifactFile`) dan melewati pemeriksaan identitas `readChain` untuk nama itu (O-5); F12 melengkapinya.
- Perubahan pada Protocol dan registry baru berlaku pada proyek setelah `sigma setup update` dan `sigma project sync --confirm` (F09).
- Nama berkas template, marker tipe dokumen, dan nama tipe pada keluaran tidak diubah (O-7, O-8).
