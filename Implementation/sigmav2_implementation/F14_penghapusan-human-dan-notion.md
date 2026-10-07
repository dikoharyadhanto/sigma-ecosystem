# F14 - Penghapusan proyeksi HUMAN dan integrasi Notion

Tanggal: 7 Oktober 2026
Status: RENCANA DISETUJUI, BELUM DIEKSEKUSI. Seluruh butir H-1 sampai H-9 dijawab Director (7 Oktober 2026). Keputusan Director: eksekusi dilakukan di sesi baru, bukan di sesi perencanaan ini. Belum ada kode, rules, template, registry, skill, atau konfigurasi yang diubah. Catatan serah terima ada di bagian 11.
Dasar: instruksi Director 7 Oktober 2026 (hapus penerapan dokumen human; hapus penerapan Notion; rekomendasikan nasib `sigma humanize`; rencana lebih dulu), keputusan D-13 pada dokumen 28 September, F13 butir O-7 (Notion ditinggalkan), dan [F00](F00_indeks-dan-register.md).
Label: **TERKUNCI** (keputusan Director), **TERVERIFIKASI** (diperiksa pada berkas), **REKOMENDASI** (asisten, belum keputusan).

## 1. Tujuan dan batas

Tujuan: menghapus (a) proyeksi `*-HUMAN`, Fidelity Ledger, dan operasi yang membuatnya, serta (b) integrasi Notion beserta gate-nya. Sesudahnya dokumen sumber (INTENT, PLAN, EXEC, CLOSE) adalah satu-satunya bentuk dokumen, dan Sigma tidak lagi memiliki jalur publikasi eksternal. Perubahan ini bersifat breaking dan sejalan dengan versi 2.0.0.

Di luar batas: `sigma notes` (F06); review isi template CLOSE (E04, terpisah); sinkronisasi ke `~/.sigma` dan proyek (F09); data yang sudah berada di Notion; review AUD-RULE dan Constitution (ditahan); perubahan Protocol di luar butir H-3.

## 2. Keputusan Director (TERKUNCI, 7 Oktober 2026)

1. Penerapan dokumen human dihapus: D-13 dijalankan (tiga template `*-HUMAN`, Fidelity Ledger, operasi `humanize`, kode publikasi).
2. Penerapan Notion dihapus: perintah `sigma notion`, kode, kredensial, dan gate.
3. Nasib `sigma humanize` diputuskan Director setelah rekomendasi pada bagian 3.
4. Tidak ada eksekusi sebelum rencana ini disetujui.

## 3. Rekomendasi: nasib "sigma humanize"

Istilah ini menunjuk tiga benda berbeda.

| Benda | Fungsi | Bergantung pada HUMAN atau Notion | Rekomendasi |
|---|---|---|---|
| `sigma intent/exec/close humanize`, tiga tool MCP `sigma_*_humanize`, tiga service | Menyalin template HUMAN dan Ledger ke `Sigma/human/` | Seluruhnya | **HAPUS** |
| Skill `/humanize` (4 target) | Menulis ulang isi untuk pembaca manusia; tidak mengubah state | Tidak. Hanya satu paragraf "Out Of Scope" dan satu bagian "Relationship to Sigma Humanize Operation" yang menyebut HUMAN dan Notion | **PERTAHANKAN**, dipangkas |
| `sigma scan --file` dan `sigma_terminology.default.json` | Memindai berkas untuk istilah Sigma | Tidak. Komentar kodenya sendiri menyatakan "independent of Notion entirely" | **PERTAHANKAN**, rujukan Notion dihapus |

Alasan mempertahankan skill `/humanize`:
1. Isi intinya tidak terkait HUMAN. Writing Style Rules (F11) hanya empat butir gaya untuk dokumen governance. F11 tidak memuat Core Invariant ("jangan memanufaktur kepastian"), tiga tingkat detail teknis (`LOW`, `BALANCE`, `HIGH`), maupun empat operasi Preserve, Compress, Rephrase, Infer. Menghapus skill menghilangkan ketiganya.
2. Dokumen desain 27 September mengarahkan `/humanize` menjadi alat review internal sebelum lock, bukan hanya alat publikasi.
3. Biaya mempertahankannya kecil: tiga suntingan pada empat target.

Risiko: sebagian isinya tumpang tindih dengan F11. Konsolidasi dikerjakan di F07 atau F01, bukan di F14.
Alternatif: hapus skill. Pilih ini bila F11 dinilai cukup. Konsekuensinya: empat target skill, pemetaan di `setup.ts`, dan test paritas tingkat detail ikut dihapus.

## 4. Fakta terverifikasi

| Area | Isi | Lokasi |
|---|---|---|
| A. Gate humanize | `plan new` dan `close new` diblokir bila `notion_humanize_gate.enabled`, sampai sumbernya dipublikasikan ke Notion. Gate juga memengaruhi pertanyaan interaktif dan opsi `--humanize-gate`/`--no-humanize-gate` pada `project start`, baris "Notion Humanize Gate" pada `config show`, bidang `notion_humanize_gate_enabled` pada tool MCP `getConfig`, dan butir `sigma config show` pada memory ARC, FMN, DEV. Nilai bawaan OFF; pada proyek KLHK OFF. | `planDraftService.ts`, `closeNewService.ts`, `projectConfig.ts`, `project.ts`, `commands/config.ts`, `mcp/tools/getConfig.ts`, tiga file role-memory |
| B. Operasi humanize | Tiga perintah CLI, tiga service, tiga tool MCP control, klasifikasi tier dan pemilik, tiga entri registry operasi (61 menjadi 58), entri `humanize_scaffold` dan `humanize_push` pada registry dokumen | `commands/{intent,exec,close}.ts`, `services/*HumanizeService.ts`, `mcp/control/tools/*Humanize.ts`, `mcp/control/index.ts`, `mcp/policy.ts`, dua registry JSON |
| C. Publikasi dan coverage | Pengirim ke Notion, rekonsiliasi artefak SUPERSEDED, pemeriksa coverage Ledger. Konfigurasi coverage PLAN-EXEC sudah tidak cocok dengan schema 3 (tabel "Implementation Constraints" tidak ada lagi, sehingga hitungannya 0 dan lolos tanpa memeriksa). `stripTemplateInstructions` hanya dipakai pengirim. | `engine/humanizePush.ts`, `engine/fidelityCoverage.ts`, `engine/terminologyScanner.ts` |
| D. Notion | Perintah `sigma notion` dengan delapan subperintah (`setup`, `enable`, `disable`, `status`, `push`, `pull-state`, `pull`, `progress`); kredensial per mesin; marker `.sigma-remote-state.json`; cabang marker pada `findProjectRoot`. Tidak ada dependensi npm (memakai `fetch`). | `commands/notion.ts`, `engine/notionService.ts`, `engine/notionCredentials.ts`, `config.ts`, `utils/fs.ts`, `cli.ts` |
| E. State | Tipe `HumanArtifactState` dan bidang `human?` pada INTENT, entri EXEC, dan CLOSE (skema 1.2.0). Folder `human` pada `SUBFOLDERS`. | `engine/chain.ts`, `config.ts` |
| F. Template | `DIR-INTENT-HUMAN`, `PLAN-EXEC-HUMAN`, `DIR-CLOSE-HUMAN`, `HUMAN-FIDELITY-LEDGER` | `Sigma/templates/` |
| G. Dokumen | README (sekitar baris 644-651), Protocol (baris 471-472, 556-557, 583-594, 647 dan seterusnya), CHANGELOG, skill `/humanize` | akar repo, `Sigma/`, `setup/targets/` |
| H. Test | Tujuh file dihapus penuh, 84 test: `control-humanize` 23, `humanize-fase1` 6, `humanize-fase3` 10, `humanize-fase6-gate` 10, `humanize-reconcile` 9, `humanize-fidelity-coverage` 10, `notion-integration` 16. Disunting: `humanize-terminology-scan` (14), `humanize-detail-level-parity` (9), `config-show`, `mcp-tools`, `mcp-binding`, `mcp-b2-final`, `control-plan-draft`, `control-intent-draft`, test folder `human`, komentar `helpers.ts`. | `test/` |
| I. Keadaan nyata | Pada empat proyek Sigma di `I:\Works\Project` tidak ada `.sigma-remote-state.json`, tidak ada berkas di `Sigma/human/`, dan tidak ada jejak `pushed_to_notion_at`. KLHK: `notion.enabled=false`, gate `false`. Kredensial Notion ada di `~/.sigma/notion.credentials.json` pada mesin ini. Proyek di drive atau mesin lain belum diperiksa. | pemeriksaan read-only |
| J. Perilaku berbahaya | `sigma notion push` menghapus folder `Sigma/` lokal (`purgeSigmaDir`) bila `clean_local` aktif, setelah state berhasil didorong. Hanya `pull-state` yang memulihkannya. Proyek dalam keadaan itu kehilangan jalur pemulihan setelah perintah dihapus. | `notionService.ts` |
| K. dist | `dist/` dilacak Git dan `tsc` tidak menghapus keluaran dari sumber yang dihapus. Tanpa pembersihan, `dist/commands/notion.js` dan modul lain tetap ada, dimuat oleh `refresh-registries`, dan tetap tersedia lewat symlink global. | `dist/` |

## 5. Spesifikasi perubahan

Urutan menghapus pemakai sebelum yang dipakai, sehingga setiap langkah dapat dikompilasi sendiri.

- **W0 Prasyarat.** Pohon kerja bersih. `npm test` (991 test) sebagai pembanding. Butir H-6 dikonfirmasi (tidak ada proyek dalam keadaan `remote-state`).
- **W1 Gate.** Hapus pemeriksaan gate pada `planDraftService.ts` dan `closeNewService.ts`. Hapus `notion` dan `notion_humanize_gate` dari `projectConfig.ts` (tipe, default, pembuatan baru). Hapus pertanyaan, opsi, dan baris ringkasan pada `project.ts`, baris pada `config show`, dan bidang pada `getConfig`. Konfigurasi lama dengan `enabled: true` tidak lagi memblokir apa pun.
- **W2 Operasi humanize.** Hapus subperintah `humanize` pada `intent.ts`, `exec.ts`, `close.ts`; tiga service; tiga tool MCP control dan registrasinya di `index.ts`; entri tier dan pemilik pada `policy.ts` (W1 menjadi 13); tiga entri registry operasi (total 58); dua entri registry dokumen.
- **W3 Notion.** Hapus `commands/notion.ts`, `notionService.ts`, `notionCredentials.ts`, registrasi di `cli.ts`, konstanta kredensial dan marker pada `config.ts`, dan cabang marker pada `findProjectRoot` (pesan "not a Sigma project" tetap). Komentar `scan.ts` yang menyebut Notion disesuaikan.
- **W4 Infrastruktur publikasi.** Hapus `humanizePush.ts`, `fidelityCoverage.ts`, dan `stripTemplateInstructions`. Hapus tipe `HumanArtifactState` dan bidang `human?` dari `chain.ts` tanpa mengubah `SCHEMA_VERSION` (1.2.0). Data lama tetap terbaca (diuji pada W7).
- **W5 Template dan folder.** Hapus empat template. Keluarkan `human` dari `SUBFOLDERS` (proyek baru tidak lagi membuat `Sigma/human/`; `notes` tetap).
- **W6 Dokumen, rules, skill, memory.**
  - README: hapus baris `sigma notion` dan paragraf pendukungnya.
  - Protocol (butir H-3): hapus baris folder `human`, baris domain `notion`, tiga operasi `humanize` pada tabel kelas dan catatan kaki 3 dan 4, serta bagian "External-Facing Projections".
  - CHANGELOG: entri 2.0.0 "Removed".
  - Skill `/humanize` (butir H-1): hapus paragraf HUMAN pada "Out Of Scope" dan bagian "Relationship to Sigma Humanize Operation" di empat target.
  - Memory ARC, FMN, DEV: butir `sigma config show` tidak lagi menyebut Notion Humanize Gate.
  - `sigma_terminology.default.json`: tiga istilah yang hanya relevan bagi fitur ini dapat dihapus (opsional).
- **W7 Test.** Hapus tujuh file (84 test). Sunting file sebagian. Tambahkan test regresi pada bagian 8.
- **W8 Build, dist, verifikasi.** Satu build, dilaporkan lebih dulu (symlink global). Hapus berkas `dist/` yang sumbernya sudah dihapus (daftar eksplisit: notion, notionService, notionCredentials, humanizePush, fidelityCoverage, tiga HumanizeService, tiga tool MCP control, masing-masing `.js`, `.d.ts`, `.d.ts.map`). Jalankan `npm test` dan `npm run refresh-registries:dry`.

## 6. Kompatibilitas dan migrasi

Tidak ada migrasi otomatis. Data lama dibiarkan dan diabaikan.

| Data atau pemakai lama | Perlakuan |
|---|---|
| `project.config.json` dengan kunci `notion` dan `notion_humanize_gate` | Dibiarkan; tidak dibaca; tetap ada saat file ditulis ulang |
| Chain dengan bidang `human` | Dibiarkan dan dipertahankan saat chain ditulis ulang (diuji) |
| `Sigma/human/*.md`, `Sigma/notes/*.fidelity.md` | Dibiarkan; tidak dibaca |
| `.sigma-remote-state.json` | Dibiarkan; tidak ada lagi petunjuk `pull-state` |
| Template human di `~/.sigma/templates` dan salinan proyek | Tetap sampai dibersihkan manual atau oleh F09 (`sync` tidak menghapus berkas) |
| Skrip yang memakai `--humanize-gate` atau `--no-humanize-gate` | Gagal dengan "unknown option" (breaking) |
| Klien MCP yang memanggil `sigma_*_humanize` | Tool hilang dari daftar |
| `SCHEMA_VERSION` | Tetap 1.2.0 |

## 7. Risiko

- **Proyek dalam keadaan `remote-state`** kehilangan jalur pemulihan (fakta J). Pencegahan: prasyarat H-6.
- **Kredensial Notion tetap ada** di mesin. Kode tidak menghapusnya (H-5).
- **Build mengubah perilaku `sigma-mcp` di seluruh host.** Satu build, dilaporkan lebih dulu.
- **File `dist/` basi** bila pembersihan W8 terlewat.
- **Protocol ditahan.** Tanpa suntingan sempit pada H-3, Protocol mendeskripsikan perintah yang tidak ada.
- **Perubahan breaking.** Skrip dan klien MCP eksternal dapat gagal; tercatat pada CHANGELOG.

## 8. Strategi uji dan kriteria selesai

Test baru:
1. `plan new` dan `close new` tidak diblokir walau `project.config.json` memuat `notion_humanize_gate.enabled: true`.
2. Chain dengan bidang `human` tetap terbaca dan bidangnya bertahan saat ditulis ulang.
3. `project.config.json` dengan kunci Notion tetap terbaca; kunci bertahan saat `config set` menulis ulang.
4. `sigma notion ...` dan `sigma <intent|exec|close> humanize` menghasilkan "unknown command" atau opsi tidak dikenal.
5. `project start` tidak membuat `Sigma/human/` dan tidak menyebut Notion.
6. Registry operasi 58 entri; `mcp-binding` memeriksa 58; tidak ada operasi tanpa klasifikasi.

Perkiraan jumlah test: 991, dikurangi 84 file yang dihapus, dikurangi test `stripTemplateInstructions` dan test gate pada file yang disunting, ditambah sekitar 6 test baru. Angka pasti dilaporkan setelah W8.

Kriteria selesai:
- `npm test` hijau setelah satu build.
- `refresh-registries:dry` melaporkan Removed 0 dan tidak ada operasi `notion_*` atau `*_humanize` yang terdeteksi.
- Pencarian `notion`, `humaniz`, `Fidelity`, dan `-HUMAN` pada `src`, `Sigma`, `setup`, dan README hanya menemukan yang disengaja: skill `/humanize` yang dipertahankan, CHANGELOG, dan dokumen rencana.
- Tidak ada berkas `dist/` yang sumbernya sudah tidak ada.

## 9. Butir keputusan terbuka

Setiap butir: pertanyaan, rekomendasi. Jawaban diisi Director.

**H-1. Skill `/humanize`.** Pertahankan (dipangkas) atau hapus.
Rekomendasi: pertahankan. Alasan pada bagian 3.
Jawaban: DIPERTAHANKAN (Director, 7 Oktober 2026): skill membantu dan tidak dihapus. Suntingan W6 pada skill tetap berlaku (hanya rujukan HUMAN dan Notion yang dihapus).

**H-2. `sigma scan` dan daftar terminologi.** Pertahankan atau hapus.
Rekomendasi: pertahankan. Fungsinya independen dari Notion dan mendukung batas terminologi pada DEV-RULE bagian "Human-Readable Code & Governance Terminology Boundary".
Jawaban: DIPERTAHANKAN (Director, 7 Oktober 2026): belum dicoba, tetapi berguna bagi DEV pada pemakaian berikutnya.

**H-3. Suntingan Protocol.** Protocol ditahan untuk review. Opsi: (a) suntingan sempit hanya pada paragraf, baris, dan tabel yang membahas HUMAN dan Notion; (b) tunggu review Protocol.
Rekomendasi: (a). Tanpa itu Protocol mendeskripsikan perintah yang sudah tidak ada. Bagian Protocol lain yang sudah usang (tabel section EXEC, sisa tier) tetap ditahan.
Jawaban: DISETUJUI (Director, 7 Oktober 2026), opsi (a).

**H-4. Opsi `--humanize-gate` dan `--no-humanize-gate` pada `project start`.** Hapus atau tetap diterima tanpa efek.
Rekomendasi: hapus. Versi mayor 2.0.0 dan opsi itu mengacu pada fitur yang tidak ada.
Jawaban: DIHAPUS (Director, 7 Oktober 2026).

**H-5. Kredensial Notion pada mesin ini.** Kode tidak menghapus `~/.sigma/notion.credentials.json`.
Rekomendasi: Director mencabut token di Notion dan menghapus berkasnya secara manual. Data yang sudah berada di Notion tidak disentuh.
Jawaban: DIMENGERTI (Director, 7 Oktober 2026). Kode tidak menghapus berkas kredensial; pencabutan token dan penghapusan berkas dilakukan Director secara manual.

**H-6. Proyek lain dengan `.sigma-remote-state.json`.** Saya hanya memeriksa `I:\Works\Project`. Prasyarat W3: Director mengonfirmasi tidak ada proyek di drive atau mesin lain yang sedang dalam keadaan state dipindahkan ke Notion, atau menjalankan `sigma notion pull-state` pada proyek itu sebelum W3.
Jawaban: DIKONFIRMASI (Director, 7 Oktober 2026): Notion tidak pernah dijalankan pada produk mana pun, dan artefak human tidak pernah dibuat. Prasyarat W0 terpenuhi. Catatan: kunci `notion` dan `notion_humanize_gate` tetap ada pada `project.config.json` setiap proyek karena `project start` menuliskannya sebagai nilai bawaan, sehingga test kompatibilitas data lama pada bagian 8 (butir 1 sampai 3) tetap dikerjakan.

**H-7. Folder `Sigma/human/` pada proyek baru.** Berhenti dibuat.
Rekomendasi: ya. Folder pada proyek lama dibiarkan.
Jawaban: DISETUJUI (Director, 7 Oktober 2026).

**H-8. Salinan lama di `~/.sigma/templates` dan proyek.** Empat template human tetap di sana setelah `sync`.
Rekomendasi: dibiarkan; pembersihan masuk F09.
Jawaban: DISETUJUI (Director, 7 Oktober 2026): dibiarkan, dibersihkan pada F09.

**H-9. Pembersihan `dist/`.** Penghapusan berkas `dist/` hasil kompilasi dari sumber yang dihapus (daftar eksplisit pada W8).
Rekomendasi: setuju, karena `dist/` dilacak Git dan dimuat lewat symlink global.
Jawaban: DISETUJUI (Director, 7 Oktober 2026).

## 10. Urutan eksekusi dan commit

W0 sampai W8 berurutan. Satu build pada W8, dilaporkan lebih dulu. Commit hanya atas instruksi Director, dalam tiga kelompok: (1) kode, test, `dist/` (W1-W5, W7, W8); (2) template, registry, rules, README, Protocol, CHANGELOG (W5-W6); (3) skill dan memory (W6). Setelah F14 selesai, F00 diperbarui: D-13 ditutup dan F13 O-7 dirujuk.

## 11. Catatan serah terima untuk sesi eksekusi

Keputusan Director (7 Oktober 2026): seluruh butir bagian 9 disetujui sesuai rekomendasi; eksekusi dilakukan di sesi baru. Sesi perencanaan tidak mengeksekusi apa pun dari F14.

Keadaan kerja saat serah terima (branch `main`, HEAD afd894c, sinkron dengan `origin/main`):
- Belum di-commit: dokumen ini (belum dilacak Git) dan satu baris F14 pada F00.
- Tidak ada perubahan kode, test, template, registry, skill, atau memory untuk F14.
- Tes terakhir yang diketahui: 73 file, 991 test hijau (setelah build F13 dan versi 2.0.0).

Urutan eksekusi: W0 sampai W8 (bagian 5). Sesi baru memulai dengan memverifikasi keadaan di atas (`git status`, `git log -3`, `npm test`), lalu W1.

Hal yang berlaku:
- Jawaban Director: `/humanize` dipertahankan; `sigma scan` dan daftar terminologi dipertahankan; suntingan Protocol hanya sempit (H-3); opsi `--humanize-gate` dan `--no-humanize-gate` dihapus; folder `Sigma/human/` tidak lagi dibuat pada proyek baru; template human lama di `~/.sigma` dan proyek dibiarkan sampai F09; berkas `dist/` basi dihapus pada W8; kredensial Notion tidak dihapus oleh kode.
- Prasyarat W0 terpenuhi: Notion tidak pernah dijalankan dan artefak human tidak pernah dibuat pada produk mana pun (Director). Test kompatibilitas data lama (bagian 8, butir 1 sampai 3) tetap dikerjakan karena kunci bawaan `notion` dan `notion_humanize_gate` ada pada `project.config.json` setiap proyek.
- Dilarang: menyinkronkan ke `~/.sigma` atau proyek (F09); mengubah AUD-RULE dan Constitution; menyunting Protocol di luar butir H-3; mengubah `SCHEMA_VERSION`.
- Build dilaporkan ke Director sebelum dijalankan (sigma-mcp terpasang lewat symlink global; `dist/` dilacak Git). Commit hanya atas instruksi Director, dalam tiga kelompok (bagian 10).
- Pelajaran dari F13: `tsc` tidak menghapus keluaran dari sumber yang dihapus; `npm test` dijalankan sesudah build, bukan sebelumnya, karena test CLI memakai `dist/`.
- Penutup F14: perbarui F00 (D-13 ditutup, baris F14 selesai) dan lampiran keterlacakan bila ada rules yang berubah.
