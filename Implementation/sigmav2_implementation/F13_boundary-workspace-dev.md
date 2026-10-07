# F13 - Boundary workspace DEV

Tanggal: 7 Oktober 2026
Status: DITERAPKAN (7 Oktober 2026), belum di-commit. Seluruh butir bagian 6 (O-1 sampai O-12) dijawab Director. Hasil: kode (`devWorkspace.ts`, `dev.ts`, identitas baca-gabung-tulis, doctor, bootstrap), registry 61 operasi, klasifikasi MCP, DEV-RULE, skill DEV (4 target), memory DEV, dan 35 test pada `test/dev-workspace.test.ts`. Satu build bersama perubahan versi Sigma menjadi 2.0.0; `npm test` 73 file dan 991 test lulus. Catatan penerapan: pemeriksaan "catatan sudah ada" dilakukan sebelum pemeriksaan entri `dev`; `sigma dev status` tetap menulis satu baris ke log operasi bawaan semua perintah; skrip `refresh-registries.js` memetakan tanda hubung pada nama perintah ke garis bawah; section "DEV Workspace Boundary" berada setelah Key Rules & Constraints.
Dasar: keputusan Director 7 Oktober 2026 pada sesi evaluasi, dan [F00](F00_indeks-dan-register.md). Label: **TERKUNCI** (keputusan Director), **TERVERIFIKASI** (diperiksa pada berkas), **REKOMENDASI** (asisten, belum keputusan).

## 1. Tujuan dan batas fokus

Memberi DEV satu wilayah tulis tersendiri, `<project_root>/dev/`, sehingga seluruh hasil kerja DEV berada di satu lokasi yang dapat ditinjau Director dan tidak bercampur dengan berkas lain proyek. Boundary hanya berlaku pada proyek yang workspace-nya diaktifkan; proyek lain tidak berubah.

Cakupan: operasi CLI `sigma dev create-workspace` dan `sigma dev status`; catatan workspace pada `.sigma-identity.json`; pemulihan lewat `sigma doctor`; bagian aturan pada DEV-RULE; skill dan memory DEV; registry dan klasifikasi MCP; test.

Di luar batas: hook teknis (diputuskan tidak ada); penerbitan salinan `dev/` ke repositori lain (manual, tidak diatur Sigma); alat pemindah produk proyek lama; stempel versi Sigma (F12); proyeksi MCP untuk `sigma dev status` (F09); template EXEC dan DEV-RULE di luar bagian boundary (E03).

## 2. Keputusan Director yang terkunci (7 Oktober 2026)

1. Wilayah tulis DEV adalah `<project_root>/dev/` dan namanya tetap `dev`. Saat aktif, DEV hanya menulis di dalamnya. Pengecualian: berkas EXEC dan operasi tulis Sigma yang sudah diizinkan bagi DEV (misalnya `sigma memo`, `sigma send`), yang menulis di dalam `Sigma/`.
2. Role lain tidak menulis di dalam `dev/` sebagai maksud desain; maksud ini tidak dituliskan sebagai aturan pada rules mana pun (O-8 dan O-12 ditolak: pelanggaran semacam itu hampir tidak pernah terjadi). Membaca diizinkan bagi semua role. DEV boleh membaca di seluruh isi proyek. Akses di luar proyek (baca dan tulis) dicabut kecuali ada otoritas eksplisit Director.
3. `dev/` memuat seluruh produk (kode, aset, berkas build). Build dan test dijalankan dari dalam `dev/`. Tidak ada langkah penempatan hasil ke lokasi lain.
4. Aturan berlaku hanya saat workspace aktif. Proyek yang belum mengaktifkan workspace bekerja seperti sekarang.
5. Aktivasi: `sigma dev create-workspace`, atas otoritas Director, dijalankan oleh DEV. Menolak berjalan bila folder `dev/` sudah ada, dengan atau tanpa penanda. Satu operasi melakukan tiga hal: membuat `dev/`, membuat penanda di dalamnya, dan mencatat workspace pada `.sigma-identity.json`.
6. Catatan pada `.sigma-identity.json` adalah saklar utama dan bersifat fail-closed: catatan ada berarti aturan aktif, walaupun folder atau penanda hilang. DEV tidak dapat mengubah `.sigma-identity.json`, tetapi dapat menghapus penanda.
7. Pemulihan penanda: dibuat ulang dari catatan lewat `sigma doctor --repair-workspace`. Tidak ada operasi `repair` atau `remove` terpisah, dan tidak ada opsi konfirmasi pada CLI (lihat butir 14).
14. Operasi `create-workspace` dan perbaikan doctor tidak memakai opsi `--director-confirm` maupun `--role`. Otoritas Director ditegakkan oleh DEV-RULE (tabel CLI Operation Policy, kelas Approval) dan pengingat pada memory DEV, sama dengan `exec lock`; aktivasi selalu atas inisiatif Director. Alasan: operasi tidak menimpa apa pun dan dapat dibatalkan, dan opsi tersebut tidak dapat diautentikasi. Menonaktifkan workspace berarti Director menghapus catatan secara manual.
8. Git adalah lapisan keempat yang opsional dan hanya mendeteksi; tidak diwajibkan. `dev/` tidak masuk `.gitignore`.
9. `sigma dev status` (read-only) menampilkan keadaan; DEV menjalankannya saat aktivasi dan melaporkan hasilnya ke Director.
10. Tidak ada hook teknis. Penegakan bergantung pada rules, skill, memory, dan `sigma dev status`. Keterbatasan ini ditulis di bagian 8.
11. Adopsi pada proyek lama: `create-workspace` dijalankan dulu (folder kosong), lalu pelaku di luar DEV (Director, atau sesi profesional atau AI non-Sigma) memindahkan produk ke dalamnya, memperbaiki path, dan menguji; DEV memverifikasi di dalam `dev/`. Kriteria pemeriksaan ditulis sebelum memindahkan: build dan seluruh test lulus, pencarian teks atas prefix path lama tidak menemukan sisa, keluaran utama dijalankan satu kali.
12. Publikasi dilakukan manual dan tidak diatur Sigma: `dev/` disalin ke lokasi lain, folder diganti nama, penanda dihapus; `dev/` asli tetap dengan penandanya.
13. Kolom Location pada Key Output PLAN dihapus; lokasi hasil dilaporkan di EXEC (E03 A-10).

## 3. Peta dampak kode (TERVERIFIKASI pada kode saat ini, read-only)

| Area | Fakta | Dampak |
|---|---|---|
| Pendaftaran perintah | [cli.ts](../../src/cli.ts) memasang setiap domain lewat `program.addCommand(xCommand())`; belum ada domain `dev` | Berkas baru `src/commands/dev.ts` dan satu baris pendaftaran |
| Identitas proyek | `.sigma-identity.json` berisi lima bidang (`schema_version`, `project_id`, `project_name`, `registered`, `logs_created_at`). `writeProjectIdentity` ([project.ts](../../src/commands/project.ts) baris 184-198) menulis ulang seluruh objek dengan bidang itu saja. Dipanggil dari `runStart` (baris 372) dan `runRegister` (baris 661) | Catatan baru akan hilang pada `project start --reinit` atau `project register` bila penulisan tidak diubah menjadi baca-gabung-tulis yang mempertahankan bidang tak dikenal. Perubahan ini juga dibutuhkan F12 (stempel versi pada berkas yang sama) |
| Pembaca identitas | `readProjectIdentity` ([chain.ts](../../src/engine/chain.ts) baris 550) membaca objek apa adanya; `pushStateToNotion` ([notionService.ts](../../src/engine/notionService.ts) baris 497-515) mengirim seluruh isi identitas ke payload Notion | Bidang baru ikut terkirim bila fungsi Notion dipakai; Notion ditinggalkan dan kodenya dibiarkan (butir O-7 ditolak) |
| Doctor | `sigma doctor` mode default merekonsiliasi dan menulis ulang chain tanpa konfirmasi; punya bagian "Diagnostics" non-blokir ([doctor.ts](../../src/commands/doctor.ts) baris 95-99) yang memuat peringatan; opsi yang ada: `--recovery`, `--all-versions`, `--reconstruct`, `--v` | Pemeriksaan workspace masuk bagian Diagnostics; perbaikan lewat opsi baru yang eksplisit dan tidak memakai jalur rekonsiliasi default |
| Sesi bootstrap | `sigma session bootstrap --role <role>` ([session.ts](../../src/commands/session.ts) baris 315) menampilkan panduan per role; kasus DEV memuat `routine`, `approval`, `stopPoint` | Satu baris status workspace pada panduan DEV |
| Registry operasi | `Sigma/SIGMA-OPERATION-REGISTRY.json`: 59 operasi; `role` hanya bernilai `any` atau `director`; tidak ada dimensi ARC/FMN/DEV/AUD. Skrip `npm run refresh-registries` menyuntik stub operasi baru dari `dist/` | Dua entri baru (menjadi 61); skrip membutuhkan build lebih dulu |
| Klasifikasi MCP | [policy.ts](../../src/mcp/policy.ts): `OPERATION_TIERS` adalah daftar putih eksplisit; operasi yang tidak tercantum dianggap `forbidden`. `test/mcp-binding.test.ts` menegaskan 59 operasi dan bahwa tidak ada operasi tanpa klasifikasi | Dua operasi harus dicantumkan; angka 59 pada test berubah menjadi 61 |
| Proyek lama | `project start` menolak direktori yang sudah menjadi proyek Sigma kecuali `--reinit` | Perilaku `--reinit` terhadap `dev/` dan catatan harus ditetapkan (butir O-6) |
| Role aktif | Pencarian `active_role` dan sejenisnya di `src/` tidak menemukan konsep role aktif per sesi | Dasar keputusan tanpa hook; "hanya DEV" ditegakkan oleh aturan, bukan autentikasi |
| Pola persetujuan Director | Operasi kelas Approval memakai bahasa otorisasi pada percakapan; operasi bidang kontrol ([control.ts](../../src/commands/control.ts) baris 139-149) memakai opsi `--director-confirm` yang wajib | Pola ini tidak dipakai pada F13 (butir O-2) |
| Wilayah kerja role pada Protocol dan Constitution | Pencarian kata kunci tidak menemukan definisi wilayah kerja role pada `SIGMA_PROTOCOL.md` dan `SIGMA_CONSTITUTION.md`. Ini bukan bukti ketiadaan | Perubahan keduanya tidak direncanakan; Protocol dan Constitution ditahan |
| Aturan role yang ada | DEV-RULE Key Rule 5 menyatakan kode sumber dan produk berada di "project work area" dan DEV tidak menaruh kode di `Sigma/`; ARC-RULE Key Rule 1 dan FMN-RULE Key Rule 1 melarang ARC dan FMN menulis kode implementasi | Key Rule 5 diubah; rules ARC, FMN, dan AUD tidak diubah (O-8 ditolak) |

## 4. Spesifikasi perilaku

### 4.1 `sigma dev create-workspace`

- Kelas: Approval. Dijalankan DEV hanya setelah instruksi eksplisit Director, ditegakkan oleh DEV-RULE dan memory DEV (tanpa opsi CLI). Pada registry: `level: semantic`, `role: director` (sama dengan `exec_lock`).
- Prasyarat: berada di dalam proyek Sigma; `.sigma-identity.json` ada; belum ada entri bernama `dev` pada project root (berkas, folder, atau tautan; perbandingan tidak peka huruf besar-kecil agar `Dev` pada Windows juga terdeteksi); belum ada catatan `dev_workspace` pada identitas.
- Penolakan: (a) entri `dev` sudah ada, dengan atau tanpa penanda: pesan menyatakan bahwa Director harus mengganti nama atau memindahkan entri itu bila ingin mengaktifkan workspace; (b) catatan sudah ada: pesan menyatakan workspace sudah terdaftar dan merujuk `sigma doctor`.
- Urutan: (1) buat `dev/`; (2) tulis penanda `dev/.sigma-workspace.json`; (3) tulis catatan pada identitas sebagai langkah terakhir (baca-gabung-tulis, melalui berkas sementara lalu rename). Bila langkah apa pun gagal, operasi menghapus kembali folder dan penanda yang dibuat dalam proses yang sama, melaporkan kegagalan, dan keluar dengan kode bukan nol.
- Catatan identitas: `"dev_workspace": { "path": "dev", "created_at": "<ISO>" }`.
- Penanda: `{ "role": "DEV", "project_id": "<id>", "created_at": "<ISO>" }`; seluruh isi dapat dibuat ulang dari identitas.
- Keluaran: pesan "workspace aktif" (bagian 4.3) dan pengingat bahwa operasi ini menulis di project root di luar `Sigma/`.

### 4.2 `sigma dev status`

- Kelas: read-only; role `any`. Tidak menulis apa pun. Menentukan keadaan dari tiga sumber: catatan identitas, folder, dan penanda.

| Catatan | Folder | Penanda | Keadaan |
|---|---|---|---|
| tidak | apa pun | apa pun | `INACTIVE` (bila `dev/` ada: catatan tambahan bahwa folder itu bukan workspace terdaftar) |
| ada | ada | ada dan `project_id` cocok | `ACTIVE` |
| ada | hilang | - | `ACTIVE_DEGRADED` |
| ada | ada | hilang atau `project_id` tidak cocok | `ACTIVE_DEGRADED` |

### 4.3 Teks pesan (usulan, bahasa Inggris, dapat disesuaikan)

`INACTIVE`:
> No workspace restriction applies to DEV in this project. DEV works under the standard rules.
> *(bila folder `dev/` ada tanpa catatan)* A folder `dev/` exists but is not a registered DEV workspace. It is treated as an ordinary project folder.

`ACTIVE`:
> DEV workspace is active. DEV may write only inside `<project_root>/dev/`. DEV may read other locations in this project. Exceptions: DEV writes the EXEC file and runs Sigma operations that write inside `Sigma/` (for example `sigma memo`, `sigma send`). Access outside the project requires explicit Director authorization.

`ACTIVE_DEGRADED`:
> DEV workspace is registered, but `dev/` or its marker is missing or invalid. Restrictions still apply. Do not write outside `dev/`. Report this to the Director and ask for repair with `sigma doctor --repair-workspace`.

### 4.4 Doctor

- Pemeriksaan: setiap `sigma doctor` menjalankan pemeriksaan yang sama dengan `sigma dev status` pada bagian Diagnostics dan menampilkan `[WARN]` untuk `ACTIVE_DEGRADED`. Pemeriksaan tidak menulis.
- Perbaikan: `sigma doctor --repair-workspace` (opt-in eksplisit, tanpa opsi konfirmasi). Membuat ulang folder kosong bila hilang dan penanda dari catatan bila hilang atau tidak cocok. Tidak menimpa isi `dev/` dan tidak mengubah catatan. Melaporkan tindakan yang dilakukan. Isi kerja DEV yang hilang bersama folder tidak dapat dipulihkan kecuali tersimpan di Git atau salinan lain.

### 4.5 Aturan DEV-RULE (usulan teks, bahasa Inggris)

Bagian baru "DEV Workspace Boundary":

> Applies only while the DEV workspace is active, as reported by `sigma dev status`. The workspace is `<project_root>/dev/`.
>
> 1. At activation DEV runs `sigma dev status` and reports the result to the Director.
> 2. DEV writes only inside `dev/`. The exceptions are the EXEC file and Sigma operations that write inside `Sigma/` (for example `sigma memo` and `sigma send`).
> 3. DEV may read any location in the project. DEV reads or writes outside the project only with explicit Director authorization.
> 4. The whole product lives inside `dev/`, including its build files. Build, test, and install commands run from inside `dev/` and write only there.
> 5. DEV does not modify files outside `dev/`. When an existing project adopts the workspace, its product is moved into `dev/` by the Director or by a non-Sigma session, not by DEV.
> 6. DEV does not edit or delete the workspace marker.
> 7. When `sigma dev status` reports a degraded workspace, DEV stops writing outside `dev/`, reports it to the Director, and asks for repair. DEV does not repair it.
> 8. When the workspace is not active, none of the above applies.

Perubahan lain pada DEV-RULE: Key Rule 5 mendapat klausa "inside `dev/` when the workspace is active"; Role Activation memuat langkah `sigma dev status`; tabel CLI Operation Policy memuat `sigma dev status` (read-only) dan `sigma dev create-workspace` (Approval, hanya atas otorisasi eksplisit Director). Bagian ini ditambahkan ke DEV-RULE hasil E03 (setelah penyusunan ulang urutan), tidak sebelumnya.

## 5. Kompatibilitas dan migrasi

- Proyek yang sudah ada tanpa catatan: `INACTIVE`, tidak ada perubahan perilaku, tidak ada migrasi otomatis.
- Proyek yang mengadopsi workspace: prosedur pada keputusan 11. Sigma tidak menyediakan alat pemindah.
- `sigma project sync` tidak menyentuh `dev/` (hanya menyalin rules, templates, registry, role memory, konfigurasi MCP). Diverifikasi melalui test.
- `sigma project start --reinit` dan `sigma project register`: catatan `dev_workspace` dan folder `dev/` dipertahankan (butir O-6).
- Dokumen LOCKED yang menyebut path lama tidak ditulis ulang; pemetaan path lama ke baru dicatat pada dokumen berikutnya oleh pelaku migrasi.

## 6. Keputusan terbuka

Setiap butir: pertanyaan, rekomendasi. Kolom jawaban diisi Director.

**O-1. Bentuk catatan dan penanda.** Rekomendasi: catatan `dev_workspace: { path, created_at }` pada identitas; penanda `dev/.sigma-workspace.json` berisi `role`, `project_id`, `created_at`. Nama berkas penanda dapat diganti.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**O-2. Pengaman operasi.** Diselesaikan (keputusan Director, 7 Oktober 2026): tidak ada opsi `--director-confirm` maupun `--role`. Otoritas Director ditulis pada tabel CLI Operation Policy di DEV-RULE (kelas Approval) dan sebagai satu butir pengingat pada memory DEV. Alasan Director: operasi tidak destruktif; aktivasi selalu atas inisiatif Director.
Jawaban: DISETUJUI (Director, 7 Oktober 2026).

**O-3. Klasifikasi.** Rekomendasi: `dev_status` tingkat `Q` (milik DEV, MCP ditunda ke F09); `dev_create_workspace` tingkat `W3` (hanya CLI, tidak ada primitif MCP) karena menulis di luar `Sigma/` pada project root; registry `role: director` untuk `dev_create_workspace` dan `any` untuk `dev_status`.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**O-4. Nama opsi perbaikan.** Rekomendasi: `sigma doctor --repair-workspace` (tanpa opsi konfirmasi, mengikuti O-2).
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**O-5. Status pada bootstrap.** Rekomendasi: panduan DEV pada `sigma session bootstrap --role dev` memuat satu baris status workspace.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**O-6. Perilaku `project start --reinit` dan `project register`.** Rekomendasi: catatan dan folder dipertahankan (bidang tak dikenal dipertahankan oleh penulisan identitas baca-gabung-tulis); `--reinit` tidak menyentuh `dev/`.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**O-7. Payload Notion.** Rekomendasi: bidang `dev_workspace` disaring dari payload yang dikirim ke Notion, karena bidang baru tidak boleh terkirim ke layanan eksternal tanpa keputusan.
Jawaban: DITOLAK (Director, 7 Oktober 2026). Alasan: Notion ditinggalkan dan rencananya tidak ditindaklanjuti; kode Notion dibiarkan apa adanya. Penulisan identitas baca-gabung-tulis (O-6) tetap dikerjakan karena dibutuhkan oleh `project start --reinit` dan `register`, bukan oleh Notion.

**O-8. Larangan tulis role lain.** Rekomendasi: satu kalimat larangan menulis di `dev/` saat workspace aktif pada ARC-RULE dan FMN-RULE (penyuntingan biasa); AUD-RULE termasuk F01 yang ditahan, sehingga tambahan satu kalimat memerlukan persetujuan eksplisit Director seperti B-5 pada E02. Pesan status juga menyatakan larangan itu.
Jawaban: DITOLAK (Director, 7 Oktober 2026). Alasan: berlebihan; pelanggaran semacam itu hampir tidak pernah terjadi pada alur kerja role Sigma. Tidak ada perubahan pada ARC-RULE, FMN-RULE, maupun AUD-RULE.

**O-9. Atribut read-only pada penanda.** Rekomendasi: tidak diimplementasikan. Atribut tidak mencegah penghapusan oleh DEV (pengetahuan umum tentang sistem berkas, bukan hasil uji), berbeda antar sistem operasi, dan pelindung sebenarnya adalah catatan pada identitas.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**O-10. Proyeksi MCP.** Rekomendasi: `sigma dev status` tidak memiliki primitif MCP pada F13; ditunda ke F09 bersama paritas CLI dan MCP.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), sesuai rekomendasi.

**O-11. Kode lama.** Komentar lama pada kode Sigma yang memuat rujukan artefak tidak ditulis ulang (keputusan E03 C-5, hanya berlaku untuk kode baru). Berkas baru F13 mengikuti Code Style Rules.
Jawaban: tidak memerlukan keputusan baru.

**O-12. Kalimat "Other roles must not write inside `dev/`" pada pesan ACTIVE (bagian 4.3) dan butir 6 bagian aturan DEV-RULE (bagian 4.5).** Ditambahkan setelah O-8 ditolak. Kalimat itu bukan larangan pada rules role lain, tetapi memberi tahu DEV bahwa workspace miliknya. Opsi: (a) dipertahankan sebagai informasi bagi DEV; (b) dihapus dari kedua tempat.
Rekomendasi: (a). Alasannya: keputusan Director nomor 2 pada bagian 2 menyatakan role lain tidak menulis di dalam `dev/`; kalimat informasi itu tidak menambah kewajiban pada role lain dan tidak membutuhkan perubahan rules mereka.
Jawaban: (b) dipilih (Director, 7 Oktober 2026): kalimat dihapus dari pesan ACTIVE dan dari butir 6 bagian aturan DEV-RULE. Butir 6 kini hanya memuat larangan DEV mengubah atau menghapus penanda.

## 7. Strategi uji dan kriteria selesai

Uji (berkas baru `test/dev-workspace.test.ts` dan penyesuaian berkas yang ada):
1. `create-workspace` berhasil: folder, penanda, dan catatan tercipta; isi penanda sesuai identitas.
2. Penolakan: `dev` sudah ada (folder, berkas, tautan, `Dev`), dengan dan tanpa penanda; catatan sudah ada.
3. Kegagalan sebagian: kegagalan menulis penanda atau catatan menghapus kembali folder dan penanda yang dibuat dalam proses yang sama; tidak ada sisa.
4. Identitas: `project start --reinit` dan `project register` mempertahankan `dev_workspace` dan bidang tak dikenal lainnya.
5. `sigma dev status`: ketiga keadaan, termasuk penanda dengan `project_id` berbeda; tidak menulis apa pun.
6. Doctor: diagnostik melaporkan `ACTIVE_DEGRADED` tanpa menulis; `--repair-workspace` membuat ulang folder dan penanda tanpa menimpa isi dan tanpa mengubah catatan; doctor tanpa opsi itu tidak memperbaiki.
7. `project sync` tidak menyentuh `dev/`.
8. Registry dan klasifikasi MCP: dua operasi baru tercantum; test `mcp-binding.test.ts` diperbarui dari 59 menjadi 61 operasi; seluruh operasi terklasifikasi.
9. Bootstrap DEV memuat baris status.
10. Pemeriksaan teks: bagian DEV-RULE, pesan status, dan skill DEV konsisten.

Kriteria selesai: seluruh uji hijau setelah satu build; `npm run refresh-registries` tidak melaporkan operasi yang hilang; DEV-RULE, skill (4 target), dan memory DEV memuat aturan boundary; keterbatasan penegakan tertulis; tidak ada perubahan perilaku pada proyek tanpa catatan.

## 8. Risiko dan dependensi

- **Penegakan hanya oleh aturan.** Tidak ada hook dan tidak ada autentikasi role. Pelanggaran tidak dicegah; hanya dapat dideteksi (`git status`, bila proyek memakai Git). Ini keputusan Director dan dicatat sebagai keterbatasan.
- **"Hanya DEV" dan "atas otoritas Director" tidak dapat diautentikasi.** CLI tidak memiliki lapisan autentikasi dan F13 tidak menambahkan opsi konfirmasi. Integritasnya bergantung pada DEV-RULE dan memory DEV, sama dengan `exec lock`. Aktivasi yang tidak disengaja membatasi DEV dan hanya dapat dibatalkan secara manual (Director menghapus catatan pada `.sigma-identity.json`).
- **Bidang identitas dapat hilang secara senyap** bila penulisan identitas tidak diubah (bagian 3). Perubahan ini harus selesai sebelum operasi baru dipakai; F12 membutuhkan perubahan yang sama.
- **Penulisan tiga langkah tidak atomik.** Dimitigasi dengan urutan (catatan terakhir) dan penghapusan kembali.
- **Isi kerja DEV tidak dapat dipulihkan** bila folder `dev/` hilang kecuali ada di Git atau salinan lain.
- **Proyek yang sudah punya folder `dev/`** tidak dapat mengaktifkan workspace sampai Director mengganti namanya.
- **Build memengaruhi sigma-mcp di seluruh host** (symlink global). Satu build, dilaporkan sebelum dijalankan.
- Dependensi: E03 selesai lebih dulu (DEV-RULE sudah tersusun ulang); F09 (distribusi skill dan paritas MCP); F12 (identitas). AUD-RULE tidak disentuh (O-8 ditolak).

## 9. Urutan langkah implementasi (sementara; ditetapkan setelah butir bagian 6 dijawab)

| Langkah | Isi |
|---|---|
| W0 | Pastikan pohon kerja bersih, `npm test` sebagai pembanding |
| W1 | Penulisan identitas baca-gabung-tulis (O-6), beserta test |
| W2 | `src/commands/dev.ts`: `create-workspace` dan `status`, pendaftaran di `cli.ts`, beserta test |
| W3 | Doctor: diagnostik dan `--repair-workspace`, beserta test |
| W4 | Bootstrap DEV (O-5), registry (dua entri), klasifikasi `policy.ts`, penyesuaian test jumlah operasi |
| W5 | DEV-RULE: bagian boundary, Key Rule 5, Role Activation, CLI Operation Policy |
| W6 | Skill DEV (4 target) dan memory DEV (termasuk pengingat bahwa `sigma dev create-workspace` hanya dijalankan setelah instruksi eksplisit Director) |
| W7 | Satu build (dilaporkan lebih dulu), `npm test`, `npm run refresh-registries`, pemeriksaan teks |

Commit hanya atas instruksi Director, per kelompok: kode dan test (W1-W4); rules (W5); skill dan memory (W6).
