# F00 - Indeks rencana implementasi Sigma v2

Tanggal mulai: 6 Oktober 2026
Status dokumen: DRAFT kerja, diperbarui sepanjang penyusunan rencana.
Sifat dokumen: catatan kerja rencana implementasi. Bukan artefak governance Sigma dan bukan otorisasi untuk mengubah kode, konfigurasi, state, atau Git. Implementasi tiap fokus baru dimulai setelah Director menyetujui rencana fokus tersebut secara eksplisit.

## 1. Dasar dan batas

- Sumber keputusan: [diskusi_rencana_perubahan_sigma_v2.md](../../Discussion/Evaluation-06102026/diskusi_rencana_perubahan_sigma_v2.md). Dokumen pendukung di folder yang sama: audit UX 27 September, keputusan desain dan inventaris 28 September, EVALUASI-SIGMA.md (kasus AUD KLHK).
- Basis kode: branch `main`, HEAD 7549f4b saat dokumen ini dibuat. Nomor baris yang dikutip dari dokumen diskusi harus diverifikasi ulang pada kode saat ini sebelum dipakai di rencana fokus.
- Branch kerja: `main`, atas instruksi eksplisit Director 6 Oktober 2026 (evaluasi menyentuh inti Sigma, bukan Hermes). Commit dan merge hanya atas arahan Director.
- Folder ini adalah lokasi seluruh rencana implementasi. Satu file per fokus, Bahasa Indonesia.

## 2. Daftar fokus dan status

| Kode | Fokus | Strategy Action | Status | File |
|---|---|---|---|---|
| F00 | Indeks, glosarium, dependensi, register keputusan terbuka, disiplin build | - | Berjalan | file ini |
| F01 | Peta konsistensi aturan (master, proyek, skill, memory, versi aturan) | 1 | **DITAHAN** - menunggu feedback review Director per dokumen | rencana belum dibuat; bahan review: [F01-lampiran_daftar-periksa-dokumen.md](F01-lampiran_daftar-periksa-dokumen.md) |
| F02 | Penomoran chain dan warning bootstrap | 5 | Diterapkan 7 Oktober setelah O-1 sampai O-3 dan eksekusi disetujui; build lulus, 68 berkas / 934 tes lulus, exit 0; di-commit Director dalam 0c3e3b1; push dilaporkan Director | [F02_penomoran-chain-dan-warning-bootstrap.md](F02_penomoran-chain-dan-warning-bootstrap.md) |
| F03 | Mailbox per intent | 4 | Diterapkan dan divalidasi 7 Oktober: build lulus, 69 berkas / 966 tes lulus exit 0; tes doctor terakhir 6 berkas / 68 tes lulus; di-commit Director dalam 9f1bea6; push berhasil dilaporkan Director, main sama dengan origin/main saat awal F04 | [F03_mailbox-per-intent.md](F03_mailbox-per-intent.md) |
| F04 | Lifecycle APPROVED/LOCKED, doctor, pengikatan revisi | 2, 9 | F04a/F04b diterapkan dan diverifikasi 7–8 Oktober sesuai persetujuan O-1–O-14; TypeScript/build, 70 tes khusus, dan suite lengkap 71 berkas / 1.036 tes lulus, exit 0; di-commit dalam b8050f8 (memuat src, dist, rules, registry, dan dokumen F04); `main` sama dengan `origin/main` per referensi lokal 8 Oktober | [F04_lifecycle-approved-locked-doctor-dan-revisi.md](F04_lifecycle-approved-locked-doctor-dan-revisi.md) |
| F05 | Amandemen INTENT melalui Git, penghapusan tier | 8 | Diterapkan dan diverifikasi 8 Oktober 2026 setelah O-1 sampai O-13 disetujui sesuai rekomendasi; TypeScript/build lulus, suite lengkap 72 berkas / 1.072 tes lulus; build `dist/` sudah dijalankan (O-11); di-commit dalam 90ef165, push dilaporkan Director | [F05_amandemen-intent-git-dan-penghapusan-tier.md](F05_amandemen-intent-git-dan-penghapusan-tier.md) |
| F06 | sigma notes | 3 | Belum dimulai (track terpisah, rilis 1.1.0) | - |
| F07 | Pilot keterbacaan dan penyederhanaan dokumen | 6, 7 | Belum dimulai; bergantung pada F01 | - |
| F08 | Review sumber/kesiapan, revisi dari artefak lama, paket audit, keputusan tertunda | 10-12 | Belum dimulai | - |
| F09 | Distribusi skill/bridge dan validasi paritas CLI/MCP, chain lama/baru | 13 | Belum dimulai | - |
| F10 | Penamaan artefak tanpa prefix role untuk artefak baru; proyek/artefak lama tidak diubah | (tambahan, sumber: D-07 dokumen 28 September) | Ditambahkan 6 Oktober atas keputusan Director; urutan ditentukan kemudian | - |
| F11 | Writing Style Rules pada rules, skill, dan memory ARC, FMN, DEV (AUD dikeluarkan), berlaku untuk artefak INTENT, PLAN, EXEC, CLOSE, dan bagian ROADMAP yang disunting manual | (tambahan, permintaan Director 6 Oktober) | Seluruh keputusan terbuka dijawab; bagian ARC bergabung dengan ARC-RULE batch A | [F11_writing-style-rules.md](F11_writing-style-rules.md) |
| F12 | Versi Sigma pada identitas proyek dan peringatan "outdated" pada setiap operasi | (tambahan, permintaan Director 7 Oktober) | Ditambahkan 7 Oktober; berkaitan erat dengan F09 dan T-18/T-19; urutan ditentukan kemudian | rencana kasar: [F12_rencana-kasar_versi-sigma-pada-proyek.md](F12_rencana-kasar_versi-sigma-pada-proyek.md) |
| F13 | Boundary workspace DEV: wilayah tulis `dev/`, `sigma dev create-workspace` dan `status`, catatan pada identitas proyek, pemulihan lewat doctor | (tambahan, permintaan Director 7 Oktober) | Diterapkan 7 Oktober (belum di-commit); seluruh butir terbuka dijawab Director | [F13_boundary-workspace-dev.md](F13_boundary-workspace-dev.md) |
| F14 | Penghapusan proyeksi HUMAN (D-13) dan integrasi Notion; rekomendasi nasib `sigma humanize` | D-13, F13 O-7 | Rencana disetujui dan W0 sampai W8 dieksekusi 7 Oktober 2026 (belum di-commit); D-13 ditutup; F13 O-7 dirujuk | [F14_penghapusan-human-dan-notion.md](F14_penghapusan-human-dan-notion.md) |
| F16 | Target opencode (command peran, plugin proteksi, MCP proyek, bridge) dan penghapusan target Cursor | (tambahan, permintaan Director 8 Oktober) | Rencana disusun 8 Oktober 2026 dari evaluasi opencode yang diverifikasi ulang; laporan Cursor: target rules global outdate, config MCP proyek masih berlaku; O-1 sampai O-9 disetujui sesuai rekomendasi 8 Oktober 2026; dieksekusi 8 Oktober 2026 (W0–W7): tsc bersih, 75 berkas / 1.141 tes hijau (termasuk perbaikan dua temuan, 11.6), U-09 (smoke manual) menunggu Director; belum di-commit | [F16_target-opencode-dan-penghapusan-cursor.md](F16_target-opencode-dan-penghapusan-cursor.md) |

Catatan penomoran: F15 tetap dicadangkan untuk usulan amandemen Constitution (belum disetujui).

Urutan penyusunan yang disetujui Director: F00, F02, F03, F04, F05, F06, F01, F07, F08, F09. Satu fokus per giliran; setiap fokus berakhir dengan pertanyaan terbuka dan rekomendasi, lalu menunggu keputusan Director.

Penyimpangan dari tabel Strategy Action pada dokumen diskusi: F02 didahulukan dari F03 karena pemetaan pesan bertanda v2.1 ke INTENT v2 membutuhkan identitas chain dan aturan penomoran.

### Penanda F01 - DITAHAN

F01 tidak dikembangkan sampai Director memberikan feedback hasil review per dokumen. Yang sudah ada hanya bahan yang tercatat di dokumen diskusi, tanpa analisis tambahan:

- Salinan AUD-RULE di KLHK berbeda dari master; bagian pemeriksaan tag pada audit INTENT ada di master dan tidak ada di KLHK (hash berbeda). Sebab dan waktu drift belum ditelusuri.
- `aud-memory.json` master dan KLHK identik, `source_rule_version` masih unversioned.
- Skill AUD (Codex) menyebut memory dan rules, tetapi langkah aktivasi tidak eksplisit memuat pembacaan rules.

Constitution dan Protocol juga DITAHAN dan direview belakangan (keputusan Director, 6 Oktober 2026). Review Constitution dari AI lain tersimpan di `artifact_sigma_review_director.md` dan belum diolah; perubahan Constitution memerlukan deklarasi amandemen eksplisit Director (Article VIII).

Pengembangan lanjutan F01 menunggu: (a) feedback Director per dokumen, (b) kejelasan dokumen mana yang menjadi cakupan peta. Fokus lain yang menyentuh rules/memory/skill (F03, F04, F05, F09) mencatat butir yang perlu disinkronkan di F01 tanpa menunggu F01 selesai.

## 3. Struktur standar dokumen rencana per fokus

1. Tujuan dan batas fokus.
2. Keputusan Director yang sudah terkunci (dengan rujukan ke dokumen diskusi).
3. Peta dampak kode, diverifikasi pada kode saat ini (file, fungsi, jalur CLI dan MCP).
4. Spesifikasi perilaku: kondisi, hasil, kasus tepi.
5. Kompatibilitas dan migrasi.
6. Keputusan terbuka: pertanyaan, opsi, rekomendasi dengan alasan, kolom jawaban Director.
7. Strategi uji dan kriteria selesai.
8. Risiko dan dependensi.
9. Urutan langkah implementasi (diisi setelah keputusan terbuka tertutup).

Label isi yang dipakai konsisten: **TERKUNCI** (keputusan Director), **TERVERIFIKASI** (diperiksa pada kode), **REKOMENDASI** (asisten, belum keputusan), **TERBUKA** (menunggu keputusan).

## 4. Dependensi antar fokus

```text
F02 (identitas chain, aturan penomoran)
 |-- F03 (mailbox per intent)
 |-- F04 (lifecycle, acuan revisi)
 |-- F05 (amandemen; PLAN menunjuk revisi INTENT)
F04 --> F08 (review sumber, revisi dari artefak lama)
F01 --> F07 --> (template, rules, memory baru)
F06 independen
F09 menutup seluruh fokus
```

Dependensi lunak (dapat dikerjakan paralel, perlu sinkron): F05 dan F07 sama-sama menyentuh penghapusan tier pada rules/template/memory/protocol; F03, F04, F05 menambah perilaku yang perlu dicerminkan di skill dan orientasi (F09).

## 5. Register keputusan terbuka lintas fokus

Disalin dari dokumen diskusi sebagai titik awal. Setiap butir dibahas di rencana fokus yang ditunjuk; rekomendasi asisten ditambahkan di sana.

| ID | Fokus | Butir terbuka |
|---|---|---|
| T-01 | F02 | **TERKUNCI (Director, 7 Oktober 2026):** field `versioning_scheme` pada JSON chain + marker identitas pada INTENT/PLAN/EXEC baru; fallback legacy dilaporkan; batas kehilangan seluruh metadata diterima sesuai F02 O-1 |
| T-02 | F03 | **TERKUNCI (Director, 7 Oktober):** GENERAL non-MEMO ikut gate semua konteks; memo GENERAL kuota tersendiri; reply mewarisi konteks parent, parent tidak dikenal/lintas intent aktif ditolak (F03 O-1/O-2) |
| T-03 | F03 | **TERKUNCI:** retensi READ per role + intent + jenis, GENERAL/LEGACY terpisah; riwayat melalui selector eksplisit, --all hanya status; clear message/memo terpisah (F03 O-3) |
| T-04 | F03 | Ditangani sebagai kasus uji F03: keputusan Director pada diskusi sudah menetapkan semua action/minor intent yang sama ikut gate. Tidak diajukan pengecualian baru |
| T-05 | F03 | **TERKUNCI:** doctor --migrate-mailbox dengan --dry-run; transaksi satu proyek, preflight sebelum move, provenance reset dan recovery idempoten; konflik/orphan/source hilang menolak (F03 O-6/O-7) |
| T-06 | F04 | **TERKUNCI:** PLAN LOCKED tanpa EXEC dikonversi menjadi APPROVED dengan baseline review wajib; ambiguitas menolak seluruh chain sebelum deduplikasi. Baseline tanpa bukti tetap unknown/blocker (O-4/O-9) |
| T-07 | F04 | **TERKUNCI:** spesifikasi gate, validator, orientasi dan guard diterima sesuai O-1/O-5/O-10/O-11/O-14; dua tahap satu hasil dengan pemeriksaan revisi lengkap, tanpa bypass INVALID/override. Hasil eksekusi dicatat pada F04 bagian 11 |
| T-08 | F04 | **TERKUNCI:** lifecycle_model terpisah dari numbering; approve mengikuti model legacy/new dengan output eksplisit; CLI/MCP lock lama menjadi tombstone, tiket lama pending ditolak tanpa konsumsi, replay sukses lama historis (O-2/O-12) |
| T-09 | F04 | **TERKUNCI:** migrasi lifecycle eksplisit per chain melalui --migrate-lifecycle, dry-run/--v dan --director-confirm; konversi pasangan pasti otomatis di dalam migrasi. Doctor biasa/MCP tidak memigrasikan model; tidak migrasi proyek nyata pada F04 (O-3) |
| T-10 | F05 | Urutan persetujuan, pencatatan, sertifikasi, commit, tag; penanganan kegagalan parsial. **TERKUNCI (Director, 8 Oktober 2026, F05 O-1):** persetujuan isi, commit, lalu satu titik efektif yang memverifikasi, membuat tag annotated, dan baru menulis chain; tag sisa percobaan terputus diadopsi bila commit sama, tidak pernah dipindahkan. Diterapkan (F05 bagian 11) |
| T-11 | F05 | Distribusi tag pada alur push manual Director. **TERKUNCI (Director, 8 Oktober 2026, F05 O-3/O-11):** tag annotated, teks pengingat (`git push --follow-tags` atau `git push origin <tag>`), tanpa pemeriksaan remote. Diterapkan (F05 bagian 11) |
| T-12 | F06 | Penyimpanan registry, kolom katalog, kebijakan file hilang/rename/benturan nama |
| T-13 | F06 | Cakupan validasi subfolder dan unregistered-notes; kompatibilitas nama command `sigma note` lama terhadap `sigma notes` |
| T-14 | F07 | Struktur final template setelah pilot; jumlah contoh brief (3 termasuk, 3 tidak termasuk) |
| T-15 | F01 | Seluruh butir ditahan menunggu feedback Director |
| T-16 | F10 | **TERKUNCI (Director, 6 Oktober 2026):** sejak Sigma v2 terpasang, setiap `intent new`, `plan new`, `exec new`, dan `close new` membuat file tanpa prefix role. Artefak lama tetap berprefix dan tidak diganti nama. Semua operasi yang bergantung pada pengecekan nama file menerima nama dengan maupun tanpa prefix |
| T-17 | F06 | **TERKUNCI (Director, 6 Oktober 2026):** struktur notes = `unregistered-notes/`, `note-list/`, `note-list.md`; `LEGACY` hanya untuk mailbox. Definisi Director: **auto rejection** = setiap file non-Markdown yang terdeteksi di folder notes ditolak pada setiap `sigma notes update`; **auto move** = setiap Markdown yang tidak dibuat lewat `sigma notes new` dikategorikan tidak terdaftar dan dipindahkan ke `unregistered-notes/` pada setiap `sigma notes update`. Keduanya perilaku `update`, bukan sistem terpisah. Terbuka untuk F06: bentuk penolakan (hentikan seluruh update atau proses sebagian sambil melaporkan) |
| T-18 | F01 | **TERKUNCI (Director, 7 Oktober 2026):** versi aturan harus bernilai nyata (versi atau hash sumber), tidak boleh `unversioned`, agar drift antar salinan terdeteksi. `source_rule_version` pada role memory dan perbandingan salinan master/proyek menjadi syarat F01. Pembaruan proyek mempertahankan perubahan lokal, tanpa overwrite otomatis. Terbuka: bentuk versi (semver per rule atau hash isi) dan apakah `sigma doctor` yang membandingkan |
| T-19 | F09 | **Syarat urutan sinkronisasi (7 Oktober 2026):** template INTENT schema 5 tidak boleh disinkronkan ke `~/.sigma/templates` sebelum atau tanpa perubahan AUD-RULE, FMN-RULE, dan Protocol yang menghapus model tier (lihat bagian 8). Jika tidak, AUD diperintahkan memeriksa tag dan section yang tidak ada, dan FMN berpegang pada larangan yang bergantung pada lapisan yang sudah dihapus. **Pembaruan (E03, commit 0b2b8ca):** syarat urutan yang sama untuk PLAN schema 3 terhadap EXEC schema 3 dan DEV-RULE terpenuhi pada master; yang tersisa adalah sinkronisasi ke `~/.sigma/templates` dan proyek (F09) |
| T-20 | F12 | Pembanding versi. Rekomendasi: dua nilai pada stempel: `sigma_version` (versi paket) dan `assets_hash` (hash isi set yang disinkronkan: governance, rules, templates, registry, role-memory). Versi semver saja tidak cukup: `package.json` masih 1.0.0 padahal `CHANGELOG` memuat banyak perubahan di bagian Unreleased |
| T-21 | F12 | Dua tingkat kedaluwarsa: (1) CLI (paket, hidup lewat symlink) lebih baru daripada `~/.sigma` (hanya berubah lewat `sigma setup update`); (2) `~/.sigma` lebih baru daripada proyek (hanya berubah lewat `sigma project sync --confirm`). Apakah peringatan membedakan keduanya dan menyebut perintah yang benar |
| T-22 | F12 | Cakupan peringatan. Rekomendasi: semua perintah CLI di dalam proyek kecuali `setup`, `project sync/register/start`, `doctor`, dan bantuan; satu baris ke stderr; tidak muncul di luar proyek. MCP: bidang peringatan di respons orientasi/status, bukan di setiap tool |
| T-23 | F12 | `sigma project sync` menimpa rules dan templates proyek tanpa perbandingan (`overwrite: true`). Peringatan yang mendorong sinkronisasi lebih sering membuat perubahan lokal lebih sering tertimpa. Bertabrakan dengan T-18 (pertahankan perubahan lokal). Rekomendasi: cadangan otomatis dan laporan berkas yang berubah sebelum menimpa |
| T-24 | F12 | Proyek yang dibuat sebelum stempel ada. Rekomendasi: dianggap "versi tidak diketahui", peringatan yang sama; `sigma doctor` mengisi stempel setelah sinkronisasi berhasil |
| T-25 | F04 | **Kosakata lock pada artefak PLAN schema 3 dan FMN-RULE (Director, 7 Oktober 2026: dibiarkan sampai F04).** Pada Sigma v2 PLAN tidak di-lock sendiri: PLAN berstatus APPROVED dan ikut terkunci otomatis ketika EXEC pasangannya di-lock. Template dan rules yang ditulis pada E02 masih memakai kosakata CLI saat ini. Yang diganti pada F04: template FMN-PLAN (header "before lock" dan "After lock", petunjuk Contract Changes "after lock", "this lock cycle" pada SKIP_FOR_AUDIT); FMN-RULE (PLAN Creation Rules: "before lock", "as of this PLAN's lock", "snapshot as of lock", "pre-lock contract", "the PLAN locks"; AUD Findings Section Authorization: `sigma plan lock` dan "lock cycle"; Role Activation dan CLI Operation Policy: perintah `plan lock`); validator `docCheck.ts` (nama "lock requirements", `plan lock`); memory FMN. Makna APPROVED, pihak penyetuju, apakah isi masih berubah sesudahnya, dan titik "checkpoint" pada Contract Changes ditetapkan F04. **Tambahan E03 (kosakata lock EXEC, sama perlakuannya):** verdict `READY_FOR_LOCK` pada template EXEC schema 3, validator, dan test; perintah `exec lock` dan frasa "approved and locked" pada DEV-RULE (CLI Operation Policy, Change Evidence), skill DEV (empat target), dan memory DEV; nama "Lock Requirements" pada validator |

Tambahan dari penyusunan F02, ditutup melalui persetujuan eksplisit Director atas seluruh rekomendasi dan eksekusi pada 7 Oktober 2026:

| ID | Fokus | Butir terbuka |
|---|---|---|
| T-26 | F02 | **TERKUNCI:** rekonstruksi tidak menulis chain terdampak konflik; chain independen boleh dipulihkan pada `--all-versions`; kegagalan target dilaporkan dengan exit nonzero dan history yang terdampak dipertahankan (O-2) |
| T-27 | F02 | **TERKUNCI:** alokasi minor terbesar + 1 pada kedua skema, mencakup SUPERSEDED; benturan file ditolak tanpa overwrite. Nomor yang seluruh buktinya terhapus tidak dapat dipulihkan dari state saja (O-3) |


Tambahan dari penyusunan F03, seluruh rekomendasi dan eksekusi disetujui Director pada 7 Oktober 2026:

| ID | Fokus | Butir terbuka |
|---|---|---|
| T-28 | F03 | **TERKUNCI:** referensi belum terhubung masuk GENERAL dengan warning, lintas intent diketahui/ambigu tetap ditolak, tanpa reclassify otomatis (F03 O-4) |
| T-29 | F03 | **TERKUNCI:** index tunggal message/memo, mailbox_format: 2 dan metadata intent/context terpisah dari SCHEMA_VERSION (F03 O-5) |

Keputusan F04 (Director, 7 Oktober 2026): seluruh rekomendasi O-1 sampai O-14 **DISETUJUI**, sehingga T-30 sampai T-36 ditutup sesuai rekomendasi. T-25 disetujui melalui O-13/O-14. Implementasi, build, dan uji dilakukan di sesi baru, tidak dalam sesi persetujuan. Perubahan Protocol tetap terakhir.

| ID | Fokus | Butir terbuka |
|---|---|---|
| T-30 | F04 | **TERKUNCI sesuai rekomendasi:** Model lifecycle terpisah dari versioning_scheme dan urutan dua tahap sebagai satu hasil, O-1/O-2 |
| T-31 | F04 | **TERKUNCI sesuai rekomendasi:** Rev+hash, snapshot/ledger PLAN, perlakuan append AUD Notes, O-5 |
| T-32 | F04 | **TERKUNCI sesuai rekomendasi:** Kandidat revisi pada staging, checkpoint, otorisasi awal pelonggaran/perubahan di luar checkpoint, O-6/O-10 |
| T-33 | F04 | **TERKUNCI sesuai rekomendasi:** Typed CONTRACT_CHANGE/REQUEST, receipt durable dan pengakuan acuan oleh DEV tanpa bypass F03, O-7/O-8 |
| T-34 | F04 | **TERKUNCI sesuai rekomendasi:** Baseline legacy yang direview vs unknown/blocker; integrasi minimal INTENT dan batas F05, O-9 |
| T-35 | F04 | **TERKUNCI sesuai rekomendasi:** Guard tidak dilewati INVALID/override, reconstruct konservatif, transaksi CLI/MCP serta tiket legacy, O-10/O-11/O-12 |
| T-36 | F04 | **TERKUNCI sesuai rekomendasi:** Cakupan master FMN/DEV, pembaruan registry terbatas, kompatibilitas verdict, titik build/uji, O-13/O-14 |

Tambahan dari penyusunan F05 (8 Oktober 2026), seluruhnya **TERKUNCI** sesuai rekomendasi atas persetujuan Director dan diterapkan (F05 bagian 11):

| ID | Fokus | Butir terbuka |
|---|---|---|
| T-37 | F05 | Pembentukan baseline Git untuk chain RATIFIED lama dan chain `UNCERTIFIED_EDIT` tanpa commit yang cocok (rekomendasi: `baseline adopt` terpisah, jalur `imported_current` tanpa delta fiktif; F05 O-2) |
| T-38 | F05 | Riwayat amandemen keluar dari dokumen INTENT: section `Amendment History` dan baris header "Amandemen terakhir" tidak ditambahkan. Menyimpang dari D-10d (28 September) "satu baris di header"; rekomendasi: status/orientasi menampilkan amandemen terakhir (F05 O-5) |
| T-39 | F05 | Kosakata `NOTED`/`AMENDMENT_REQUESTED`/`AMENDMENT_RATIFIED` pada PLAN (sisa E02 A-5; rekomendasi: dipertahankan; F05 O-9) |

Tambahan dari penyusunan F16 (8 Oktober 2026), seluruhnya **TERKUNCI** sesuai rekomendasi atas persetujuan Director; eksekusi di sesi baru:

| ID | Fokus | Butir terbuka |
|---|---|---|
| T-40 | F16 | Bridge untuk opencode: rekomendasi generalisasi `bridge/AGENTS.md` untuk Codex dan opencode. Usulan dokumen evaluasi (berkas terpisah lewat `instructions`) tidak didukung: `AGENTS.md` proyek selalu termuat dan `instructions` bersifat penambahan, sehingga berlabel-Codex dan berkas opencode termuat bersamaan (F16 O-1) |
| T-41 | F16 | Command saja pada tahap ini, agent peran ditunda; MCP hanya config proyek terikat (F16 O-2, O-3) |
| T-42 | F16 | Penulisan config opencode yang aman JSONC; rekomendasi dependensi `jsonc-parser` (F16 O-5) |
| T-43 | F16 | Penghapusan Cursor: target rules global outdate, config MCP proyek masih berlaku; rekomendasi hapus seluruhnya dan bersihkan `SIGMA.mdc` berpenanda (F16 O-7, O-8) |

## 6. Disiplin kerja dan build (tentatif)

- Tahap rencana hanya menulis file Markdown di folder ini. Tidak ada build, uji, atau perubahan source.
- Setiap build di repo ini langsung mengubah perilaku sigma-mcp di seluruh host (symlink global). Titik build dan uji pada tahap implementasi ditetapkan di rencana tiap fokus dan disetujui Director sebelum dijalankan.
- Verifikasi kode pada tahap rencana bersifat read-only. Perintah CLI Sigma yang dapat menulis state atau log tidak dijalankan untuk reproduksi.
- Pembaruan dokumen ini: setiap fokus yang selesai disusun mengubah baris statusnya dan menutup/menambah butir register.

## 7. Keputusan Director dari review dokumen (6 Oktober 2026)

Jalur eksekusi empat target: **INTENT template beserta kode, ARC rules, ARC skill, ARC memory** (review Director selesai pada 6 Oktober 2026; skill dan memory hanya menerima Writing Style Rules). Rencana eksekusi: [E01_rencana-eksekusi-arc-dan-intent.md](E01_rencana-eksekusi-arc-dan-intent.md), menunggu persetujuan butir E-1 sampai E-10.

**Review ARC-RULE (9 butir, [artifact_sigma_review_director.md](artifact_sigma_review_director.md)) - tujuh jawaban Director:**

| No | Keputusan |
|---|---|
| 1 | "Tier" sebagai source tier Research Mode dan skala skor bertingkat dipertahankan; yang dihapus hanya tier Sovereign/Challengeable (Operationalization) |
| 2 | Sejak Sigma v2 terpasang, `intent new`, `plan new`, `exec new`, dan `close new` membuat artefak tanpa prefix role, di proyek baru maupun lama. Artefak lama tetap berprefix; semua operasi yang memeriksa nama file menerima keduanya (T-16). Ditambahkan sebagai fokus F10 |
| 3 | Rujukan nomor section lintas dokumen diganti rujukan berbasis nama; ID gate (misalnya Gate 3.5) tetap |
| 4 | ARC-RULE dieksekusi dalam dua batch: A (butir 1-4, 9) dan B (butir 5-8, mengikuti penutupan T-10/T-11 di F05). Urutan antar implementasi tidak dipersoalkan selama seluruh permintaan Director terimplementasi |
| 5 | "Intent versi terbaru" berarti isi INTENT pada chain aktif; proyek tanpa Git lokal tidak dapat menjalankan amandemen |
| 6 | Susun ulang urutan section ARC-RULE: edit konten dahulu, penyusunan ulang terpisah, dengan kerangka urutan baru untuk persetujuan dan tabel keterlacakan MUST/MUST NOT |
| 7 | Perubahan INTENT template mencakup perubahan kode (validator `docCheck.ts` dan terkait) agar tetap selaras; build/uji mengikuti disiplin di bagian 6 |

Konsekuensi: eksekusi INTENT template menyentuh kode dan build sigma-mcp (symlink global), sehingga titik build dan uji disepakati dalam rencana eksekusi.

**Review INTENT template ([artifact_sigma_review_director.md](artifact_sigma_review_director.md)):**

| No | Keputusan |
|---|---|
| 1 | Struktur mengikuti §5.1 dokumen 28 September (9 section + ringkasan), dengan koreksi atas bagian yang usang: tier dihapus total, Final Validation Checklist dihapus (ARC-RULE ratify requirement ditulis ulang), baris "Amandemen terakhir" mengikuti keputusan F05, validator memilih spesifikasi per schema agar INTENT lama tetap valid |
| 2 | Butir kedua kosong; sengaja dihapus Director |
| 3 | Judul section dan keterangan petunjuk section berbahasa Inggris; isi pengisian mengikuti bahasa dokumen proyek. Keterangan petunjuk **harus singkat** karena panjangnya mengganggu; petunjuk yang panjang dipindahkan ke rules ARC (ARC-RULE perlu bagian panduan pengisian INTENT, masuk batch A) |
| 4 | Nama section v2 usulan asisten disetujui **sementara** (Director Summary; Purpose and Problem; Desired Outcome and Measurement; Scope; Quality Standards; Priorities and Constraints; Assumptions and Risks; Functional Requirements + Guidance for FMN; Research (opsional); AUD Notes) |
| 5 | "Guidance for FMN" berdiri sebagai section tersendiri dan jumlah contoh uji batas (3 termasuk, 3 tidak termasuk) menjadi nilai awal yang dapat disesuaikan; pilot tidak dijalankan lebih dulu (diterima Director) |

**Catatan E01B (7 Oktober 2026):** bagian "Guidance for FMN berdiri sebagai section tersendiri" pada butir 5, serta "Guidance for FMN" pada daftar section butir 4, DIBATALKAN oleh keputusan Director ("Hapus guidance") dan dieksekusi di [E01B](E01B_revisi-hapus-guidance-for-fmn.md). Bagian lain butir 4 dan 5 (jumlah contoh uji batas 3 dan 3) tetap berlaku. Baris asli tidak diubah.

## 8. Hasil evaluasi menyeluruh (7 Oktober 2026)

Dasar: HEAD 8d20c4b. `tsc --noEmit` bersih; `vitest` 70 file, 922 test lulus. `~/.sigma/templates` masih schema 4, jadi schema 5 belum berlaku di proyek mana pun sampai F09.

**Sisa model tier di master (TERVERIFIKASI, belum diubah).** Seluruhnya termasuk penghapusan tier yang sudah diputuskan Director; daftar ini hanya menetapkan lokasi dan syarat urutan (T-19).

| Lokasi | Isi yang usang | Pemilik pekerjaan |
|---|---|---|
| `Sigma/rules/AUD-RULE.md` langkah 3 audit INTENT (sekitar L497-512) dan L167 | Memeriksa ketepatan tag Sovereign/Operationalization; merujuk Intent Core §1.1-1.5, §6, §7, §9, §2.1 yang tidak ada di schema 5. Perlu pemisahan per schema karena INTENT schema 4 masih beredar | F01 (AUD-RULE ditahan) |
| `Sigma/rules/FMN-RULE.md` L37, L164, L166, L297 | Model dua lapis sebagai dasar larangan FMN; rujukan "Section 14" | Sesi FMN/PLAN |
| `Sigma/SIGMA_PROTOCOL.md` §5.1 dan §5.1.1, §14 (Audit Doctrine, tabel batas), catatan §16A | Intent Core sovereign, tier per item, mekanisme amandemen Operationalization | Review Protocol (ditahan) |
| `Sigma/SIGMA-OPERATION-REGISTRY.json` L320 | Deskripsi `intent amendment`: "Operationalization only, never Sovereign". Deskripsi CLI di kode sudah dibersihkan | F09 (jalankan `refresh-registries`) |
| Kode: `src/commands/intent.ts:213`, komentar `src/engine/chain.ts`, `amendmentHistory.ts` | Teks "Section 14" dan heading "## 14." untuk dokumen tanpa penanda. Render berjalan berdasarkan penanda, bukan heading, jadi tidak ada bug fungsional | F05 |

**Rujukan yang tidak terpenuhi dari E01 (TERVERIFIKASI).** INTENT schema 5 menulis "Verdict meanings are in AUD-RULE". AUD-RULE hanya memuat tabel satu baris per verdict. Kriteria pemilihan verdict yang ditambahkan pada rilis 1.0.0 (kondisi PASS_WITH_RISK, audit ulang pada REVISE, syarat REJECT_RECOMMENDED, batas putaran revisi) dihapus dari INTENT template oleh E01 dan masih ada di FMN-PLAN template. Perbaikan ada di AUD-RULE (F01 ditahan); diajukan sebagai butir B-5 di [E02](E02_review-plan-template-dan-fmn.md).

**Pemetaan temuan EVALUASI-SIGMA ke fokus (diverifikasi pada dokumen diskusi, bagian "Kasus AUD KLHK").**

| Temuan | Posisi di dokumen diskusi | Fokus |
|---|---|---|
| K1, K2, K9 (tier) | Tier dihapus total | F05, F07 |
| K3 (plan check menampilkan teks Intent yang dikutip) | Paket review PLAN menampilkan teks/tier sumber dan peran dukungan tiap ID. Keberadaan ID saja bukan bukti keselarasan | F08 |
| K4 (status SCOPE_GAP) | Kesiapan scope dinilai terpisah dari status artefak; lifecycle tidak diganti | F08 |
| K5 (UNCERTIFIED_EDIT tanpa delta) | Snapshot dan diff, recertify dengan klasifikasi dan otorisasi, tidak berlaku retroaktif | F05 |
| K6 (kelas plan continuation) | Tidak direkomendasikan | - |
| K7 (send gate) | Gate unread dalam intent yang sama dipertahankan; friksi antar-minor menjadi T-04 | F03 |
| K8 (handoff peran dalam sesi) | Tidak direkomendasikan; memerlukan desain independensi audit | - |

Catatan: penomoran K1-K9 di sini mengikuti EVALUASI-SIGMA.md. Audit UX 27 September memakai K1-K3 untuk keluhan yang berbeda.

**Status branch `hermes-integration` (TERVERIFIKASI per file).** Dari 455 file yang diubah commit hermes-only sejak merge-base 5d6d771, seluruh kode `src/`, `bin/`, `package*.json`, dan test MCP identik dengan `main`. Perbedaan `src/` hanya komentar dan netralisasi nama Hermes pada test (`mcp-binding.test.ts`, `createIntentDraft.ts`, `mcp/index.ts`); versi `main` yang lebih baru. Konten unik branch hermes: 11 dokumen `Discussion/` Hermes, `RESULT-HERMES-PHASE0-*`, `gate05-runtime-smoke.mjs`, dan revisi `Implementation/hermes/*` serta `README.md`. `dist/mcp/control/inboxArchive.*` hanya ada di branch hermes (artefak build yatim, tidak ada sumbernya). Tidak ada tindakan Git yang dilakukan.

## 9. F12 (7 Oktober 2026)

Permintaan Director: identitas proyek mencatat versi Sigma yang diterapkan; bila versi yang terpasang di perangkat berbeda, setiap operasi Sigma di proyek menampilkan peringatan. Fakta terverifikasi, rencana kasar, dan dependensi ada di [F12](F12_rencana-kasar_versi-sigma-pada-proyek.md). Butir terbuka: T-20 sampai T-24 (bagian 5). Detail disusun saat F12 mulai dikerjakan.
