# F17 — Changelog produk dari EXEC yang telah LOCKED

Tanggal: 14 Oktober 2026
Status: DIIMPLEMENTASIKAN pada master 14 Oktober 2026 (belum di-commit). Seluruh keputusan O-1 sampai O-12 tertutup; hasil dan batas pada bagian 10. Distribusi ke perangkat/proyek tetap F09.
Urutan: **sebelum F10**, atas instruksi Director. Kode F17 dipakai karena F15 dicadangkan dan F16 sudah digunakan; nomor fokus tidak menentukan urutan pengerjaan.
Basis pemeriksaan: repositori master Sigma, branch main, HEAD 92efefc.

Dasar: instruksi Director 14 Oktober 2026 pada sesi ini; [F00](F00_indeks-dan-register.md), [F13 — workspace DEV](F13_boundary-workspace-dev.md), [F04 — lifecycle](F04_lifecycle-approved-locked-doctor-dan-revisi.md), serta [F08 — transaksi dan catatan internal](F08_review-sumber-revisi-audit-dan-keputusan.md).
Dokumen ini bukan artefak governance proyek terdaftar. Instruksi saat ini hanya mengotorisasi rencana, bukan implementasi.

Label: **TERKUNCI** = arahan eksplisit Director; **TERVERIFIKASI** = hasil baca source; **REKOMENDASI** = usulan teknis yang belum disetujui; **TERBUKA** = keputusan yang masih diperlukan.

## 1. Tujuan dan batas

Menghasilkan changelog produk yang singkat dari daftar perubahan yang ditulis DEV di EXEC. Director tidak perlu menyalin perubahan ke changelog secara manual setelah EXEC dikunci.

Alur yang direncanakan:

1. DEV mengisi satu section baru **Changelog** pada EXEC dengan poin perubahan.
2. Saat EXEC berhasil mencapai status LOCKED, sistem menyalin daftar tersebut ke CHANGELOG.md pada lokasi yang sesuai.
3. Tanggal entri berasal dari waktu EXEC dikunci, bukan waktu DEV menulis daftar atau waktu retry dijalankan.
4. CHANGELOG.md produk hanya menampilkan tanggal dan daftar perubahan. Identitas Sigma untuk pelacakan, jika diperlukan, disimpan dalam catatan internal terpisah.

Cakupan: template/validator EXEC, jalur approval CLI/MCP yang menghasilkan LOCKED, deteksi workspace DEV, penulisan CHANGELOG.md produk, pencegahan duplikasi, pemulihan transaksi, serta petunjuk role yang relevan.

Di luar cakupan: implementasi pada sesi penyusunan ini; changelog rilis repositori master Sigma; penulisan ulang EXEC LOCKED; publikasi Git/release; sinkronisasi perangkat/proyek; membuka kembali F07; memindahkan changelog lama otomatis; mengubah otoritas approval atau lifecycle yang berlaku.

## 2. Keputusan Director yang terkunci

- Tambahkan rencana implementasi baru **sebelum F10**.
- Bila workspace DEV terdeteksi, changelog berada di **<project_root>/dev/CHANGELOG.md**.
- Bila workspace DEV tidak terdeteksi, changelog berada di **<project_root>/CHANGELOG.md**. Root proyek bukan direktori terminal saat perintah dijalankan.
- EXEC mendapat satu section baru bernama **Changelog**, berupa daftar perubahan.
- Setelah EXEC berstatus LOCKED, isi daftar disalin ke CHANGELOG.md.
- Tampilan CHANGELOG.md hanya **tanggal penguncian dan daftar perubahan**, tanpa menyebut artefak Sigma.
- Setiap poin ditulis singkat dengan kalimat efektif yang menyatakan perubahan.
- Tidak ada implementasi sekarang; keluaran sesi ini adalah rencana Markdown dan pencatatan urutannya.

### 2.1 Catatan Director, 14 Oktober 2026 (lanjutan) — TERKUNCI

Seluruh rekomendasi O-1 sampai O-8 disetujui, dengan catatan berikut. Bila catatan bertentangan dengan rekomendasi pada bagian 5 atau 6, **catatan ini yang berlaku**; bagian yang bertentangan sudah disesuaikan di bawah.

1. **Pencatatan changelog tidak pernah menghalangi lock.** Bila CHANGELOG.md tidak terdeteksi, pencatatan dilewati sampai file tersebut ada. Masalah pencatatan tidak boleh menggagalkan atau menahan proses lock.
2. **Hanya dua lokasi valid:** `<project_root>/CHANGELOG.md` dan `<project_root>/dev/CHANGELOG.md`. Lokasi lain diabaikan dan tidak dianggap.
3. **Dua file terdeteksi sekaligus:** sistem memeriksa pengaturan workspace dev. Aktif → `dev/CHANGELOG.md` yang valid. Nonaktif (off) → `CHANGELOG.md` di project root yang valid, walaupun ada file di folder dev.
4. **Pembuatan file:** CHANGELOG.md dibuat otomatis oleh Sigma pada `sigma project update` atau `sigma project start`. Alternatif: dibuat manual.

Akibat pada rekomendasi sebelumnya (diverifikasi dari isi dokumen ini):

- Bagian 5.2: "tolak lock bila ACTIVE_DEGRADED" dan "tolak perubahan sebelum lock efektif bila tujuan tidak dapat ditulis" **dibatalkan** oleh catatan 1.
- Bagian 5.2: "tidak perlu membuat file kosong pada project start" **dibatalkan** oleh catatan 4.
- Bagian 5.4 dan O-6: "satu transaksi; gagal tulis changelog → lock tidak dilaporkan sukses" **dibatalkan** oleh catatan 1. Publikasi menjadi langkah pasca-lock yang tidak memblokir.
- Bagian 5.5 dan O-8: entri baru "mengikuti dev/ bila workspace aktif" tetap berlaku hanya bila `dev/CHANGELOG.md` ada atau menang pada aturan catatan 3; lihat O-9.

### 2.2 Penyederhanaan Director, 14 Oktober 2026 (lanjutan kedua) — TERKUNCI

Prinsip: changelog adalah **fitur tambahan** dan tidak boleh berlebihan. Keputusan:

- O-9 rekomendasi diterima (satu-satunya file yang ada dipakai). O-10 disetujui (ACTIVE_DEGRADED dilewati dengan pemberitahuan). O-11 disetujui sesuai rekomendasi, dengan koreksi nama: perintahnya `sigma project sync --confirm`, bukan `project update`.
- **O-12 — syarat pencatatan.** Changelog dicatat hanya bila semua syarat berikut terpenuhi:
  1. Sigma versi 2 terpasang dan fitur ini ada.
  2. Berlaku hanya saat operasi DEV (EXEC) berpindah status menjadi LOCKED, dan EXEC memakai template terbaru yang memuat section Changelog.
  3. File CHANGELOG.md sudah ada pada salah satu dari dua lokasi valid.

  Tafsir syarat 1 (diterima Director): tidak diimplementasikan sebagai pemeriksaan versi terpisah; kode yang menjalankan approve memuat fitur, dan syarat 2 menjadi bukti tingkat proyek. Pemeriksaan versi eksplisit bergantung pada F12 dan di luar cakupan.

  Catatan: instruksi Director semula bernomor 1, 3, 4; Director mengoreksi bahwa itu salah penomoran dan syaratnya total tiga.
- Bila syarat tidak terpenuhi **atau terjadi kesalahan apa pun**: lewati dan beritahu dalam bahasa Inggris bahwa pencatatan tidak berhasil beserta alasannya, sehingga dilewati. Pesan juga memuat peringatan agar pengguna memperbarui changelog secara manual dahulu, lalu menyelesaikan penyebabnya; hanya peringatan, tanpa penolakan (teks tepat pada 5.2).
- **Sekali per peristiwa lock.** "Sekali" berarti satu pencatatan setiap kali EXEC berpindah ke LOCKED, yaitu saat `sigma exec approve --director-confirm` berhasil; pada model paired_approval saat itu PLAN dan EXEC menjadi LOCKED bersama. Pencatatan dilakukan setelah perubahan status itu. Bukan sekali seumur proyek.
- CHANGELOG.md boleh disunting manual oleh role AI bila ada yang salah, selama formatnya sesuai. Sigma tidak menjaga atau mendeteksi suntingan tersebut.
- Selain itu dapat disesuaikan secara manual.

Akibat penyederhanaan: receipt internal, lease/identitas publikasi, transaksi gabungan, deteksi konflik suntingan, pengikatan hash/dependensi khusus changelog, dan tampilan tujuan pada preview **dibatalkan**. Bagian 5.2, 5.4 dan tabel keputusan di bawah ditulis ulang sesuai ini.

### 2.3 Perubahan Director, 14 Oktober 2026 (lanjutan keenam) — TERKUNCI

- **Heading berupa versi EXEC, bukan tanggal.** Bentuk file tidak berubah selain itu: `## v1.1`, daftar perubahan, lalu `## v1.2` dan seterusnya. Tanggal tidak ditulis.
- Akibat: zona waktu, pemformatan tanggal, dan ketergantungan pada `locked_at` **dibatalkan**; O-3 tidak berlaku lagi. Versi yang baru dikunci ditambahkan di atas (urutan pencatatan, bukan perbandingan string versi). Versi yang sudah ada diperluas, bukan diduplikasi.
- Ini menggantikan keputusan awal bahwa file produk "hanya tanggal dan daftar"; versi EXEC kini muncul di file produk atas keputusan Director.
- **Pemisahan catatan dan salinan (usulan Director):** file buatan Sigma dipertahankan murni sebagai catatan; pemberian judul atau section tambahan dilakukan pada salinan dengan nama berbeda, bukan pada file aslinya. Sigma tidak menyediakan perintah salin.
- **Nama file diganti menjadi `CHANGE-RECORD.md`** (bagian 11). Seluruh penyebutan `CHANGELOG.md` pada dokumen ini untuk file produk dibaca sebagai `CHANGE-RECORD.md`; nama section pada EXEC tetap `Changelog`.

## 3. Masalah yang diselesaikan

EXEC menyimpan laporan pekerjaan dan bukti, tetapi changelog produk membutuhkan catatan perubahan yang dapat dibaca tanpa memahami proses Sigma. Menyalin laporan EXEC secara keseluruhan akan membawa status, review, bukti, serta nama artefak yang tidak diperlukan pengguna produk.

Section Changelog menjadi daftar yang memang disiapkan untuk produk. Runtime menyalin daftar yang sudah direview; runtime tidak merangkum ulang narasi EXEC atau mengarang poin perubahan saat lock.

## 4. Peta dampak terverifikasi

Pemeriksaan baca saja pada HEAD 92efefc; verifikasi ulang sebelum implementasi karena kode dapat berubah.

| Lokasi | Fakta terverifikasi | Dampak rencana |
|---|---|---|
| Sigma/templates/DEV-EXEC-TEMPLATE.md | Template master menggunakan schema 3; belum ada section Changelog pada template yang diperiksa. | Tambah section berisi daftar singkat, instruksi penulisan, dan marker yang dikenali validator. |
| src/utils/docCheck.ts, EXEC_SPEC_V3 | Daftar section wajib/opsional dan urutannya ditetapkan per schema. | Penambahan section harus menentukan kompatibilitas schema lama; jangan membuat EXEC lama invalid secara tidak sengaja. |
| src/engine/devWorkspace.ts, getDevWorkspaceStatus | INACTIVE, ACTIVE dan ACTIVE_DEGRADED dibedakan. Catatan pada identitas proyek adalah saklar; folder dev biasa bukan workspace terdaftar. | Resolver tujuan memakai status workspace yang ada, bukan hanya existsSync('dev'). Perlakuan DEGRADED perlu keputusan. |
| src/services/approvalService.ts, approveArtifactUseCase | Pada paired_approval, approval EXEC mengunci PLAN/EXEC bersama dan mengisi locked_at; pada legacy_lock, service memanggil jalur lock legacy. | Publikasi mengikuti transisi EXEC ke LOCKED pada kedua model; lock PLAN tidak memicu publikasi tersendiri. |
| src/services/execLockService.ts; src/engine/chain.ts, lockExecVersion | Jalur legacy mengubah EXEC menjadi LOCKED dan mencatat waktu penguncian. | Gunakan locked_at aktual yang sudah dicatat, bukan mengambil tanggal baru secara terpisah. |
| src/commands/approval.ts | `registerApprovalCommands(cmd, domain)` dipasang pada `sigma plan` dan `sigma exec`; perintah yang berlaku adalah `sigma exec approve --director-confirm` (`lock` hanya tombstone). `sigma dev` hanya memiliki `create-workspace` dan `status`. | Titik pemicu pencatatan adalah jalur sukses `approve` pada domain exec, sesudah perubahan status. |
| src/mcp/control/tools/approveArtifact.ts | Prepare/commit membekukan hash/dependensi dan memakai transaksi, role, ticket serta approval Director. | Pemicu pada commit sukses yang menjadikan EXEC LOCKED, dengan perilaku setara CLI; tidak menambah pengikatan khusus changelog. |
| src/engine/controlStore.ts; src/engine/governanceTransaction.ts | Ada journal, pemulihan dan perlindungan konflik penulisan. | Tidak dipakai untuk changelog (dibatalkan di 2.2); pencatatan berada di luar transaksi lock. |
| Sigma/rules/DEV-RULE.md; role memory; setup/targets | DEV mengisi laporan hasil; petunjuk role didistribusikan dari master. | Tambahkan aturan poin perubahan yang efektif; bila rule berubah, hash memory diperbarui. Distribusi tetap F09. |

Penelusuran awal pada template EXEC dan jalur service/engine/MCP belum menemukan mekanisme changelog yang dimaksud. Ini hasil pemeriksaan terbatas, bukan klaim bahwa seluruh repo tidak memiliki penggunaan istilah changelog.

## 5. Spesifikasi yang direkomendasikan

Seluruh detail pada bagian ini adalah **REKOMENDASI**, kecuali ketentuan Director pada bagian 2 dan 2.1. Pada 14 Oktober 2026 (lanjutan) bagian ini disesuaikan dengan catatan Director; baris yang diubah ditandai "disesuaikan".

### 5.1 Isi section Changelog pada EXEC

Letak (arahan Director 14 Oktober 2026): **section terakhir**, sesudah Director Observation Report & Minor Requests. Waktu pengisian terbaik (arahan Director 14 Oktober 2026): **terakhir, sesudah FMN Post-Build Review**, agar daftar mencerminkan hasil akhir. Changelog bukan catatan historis proses: hanya merangkum perubahan terbaru yang berhasil diimplementasikan dan berlaku saat lock; perubahan yang dibatalkan, diganti, dikembalikan, atau tidak terkirim tidak dimasukkan. FMN meninjau kesesuaiannya dengan hasil sebelum approval EXEC.

Bentuk sumber: daftar Markdown datar. Satu poin menyampaikan satu perubahan produk atau hasil kerja yang material.

Contoh sumber sekaligus isi yang akan disalin:

- Memperbaiki perhitungan luas pada batas wilayah.
- Menambahkan ekspor hasil dalam format CSV.
- Mengurangi waktu pemuatan tabel hasil.

Pedoman:

- Gunakan kalimat efektif yang langsung menyatakan perubahan; tidak perlu pembuka, alasan panjang atau kronologi pekerjaan.
- Catat perubahan yang benar-benar dilakukan pada eksekusi tersebut, bukan seluruh fitur proyek atau pekerjaan yang masih direncanakan.
- Jangan memasukkan identitas/versi artefak Sigma, rujukan PLAN/EXEC/INTENT, verdict audit, gate, atau laporan administratif seperti commit/push ke daftar produk.
- Jalur/istilah produk boleh dipakai bila diperlukan untuk menjelaskan perubahan, tetapi jangan menyalin tabel evidence atau daftar seluruh berkas.
- Jangan membuat section bersarang, tabel, judul tambahan atau paragraf panjang.
- Runtime menyalin teks yang disetujui; tidak memotong kalimat atau menyunting makna otomatis demi memendekkannya.
- Tidak menetapkan batas karakter atau jumlah poin yang arbitrer. Kejelasan dan keringkasan direview oleh DEV/FMN; validator memeriksa bentuk, placeholder dan rujukan artefak yang dapat dikenali.
- Rekomendasi bila memang tidak ada perubahan produk: pernyataan eksplisit "Tidak ada perubahan produk." menghasilkan tidak ada entri tanggal kosong. Keputusan ini belum terkunci.

### 5.2 Tujuan dan waktu pembuatan berkas

Aturan resolusi tujuan (disesuaikan; dasar: catatan Director 2.1 butir 1–4):

1. Himpunan kandidat hanya `<project_root>/CHANGELOG.md` dan `<project_root>/dev/CHANGELOG.md`. Berkas lain diabaikan.
2. Tidak ada kandidat yang ada → publikasi dilewati; lock tetap berjalan.
3. Kedua kandidat ada → status workspace menentukan: ACTIVE → dev/, INACTIVE → root.
4. Hanya satu kandidat ada → file itu dipakai (O-9, disetujui).
5. Root proyek ditentukan dari identitas proyek, bukan cwd.

| Kondisi | Perilaku |
|---|---|
| Kedua file ada, workspace ACTIVE | Tulis hanya dev/CHANGELOG.md. |
| Kedua file ada, workspace INACTIVE | Tulis hanya CHANGELOG.md pada root, walaupun dev/CHANGELOG.md ada. |
| Hanya satu file ada (O-9, diterima) | Pakai satu-satunya file yang ada. |
| Folder dev ada tetapi tidak terdaftar | Diperlakukan INACTIVE (detektor F13). |
| Workspace ACTIVE_DEGRADED (O-10, disetujui) | Dilewati dengan pemberitahuan; tidak menebak tujuan; lock berhasil. |
| Tidak ada file pada kedua lokasi | Dilewati dengan pemberitahuan; tidak membuat file saat lock. |
| Tujuan folder, symlink, tidak dapat ditulis, atau keluar dari batas proyek | Dilewati dengan pemberitahuan; lock berhasil. |
| Pembuatan otomatis (O-11, disetujui) | `sigma project start` (termasuk `--reinit`) dan `sigma project sync --confirm`; hanya bila kedua lokasi kosong; dev/ bila workspace ACTIVE, selain itu root; isi awal kosong; tidak menimpa; `sigma dev create-workspace` tidak membuat file. |

Pemberitahuan dilewati ditulis dalam bahasa Inggris pada keluaran `sigma exec approve`, dengan bentuk:

`Changelog was not recorded because <reason>, so it was skipped. Update the changelog manually first, then resolve this issue; otherwise the next changelog record will fail again.`

Kalimat kedua adalah koreksi Director (14 Oktober 2026, lanjutan keempat). Sifatnya **peringatan saja**, bukan penolakan dan bukan gerbang: Sigma tidak menahan lock maupun pencatatan berikutnya. Urutan yang dianjurkan kepada pengguna: perbarui isi changelog secara manual dahulu, lalu selesaikan penyebabnya agar pencatatan berikutnya berhasil. Bila penyebab belum diperbaiki, pencatatan berikutnya dilewati lagi dengan pemberitahuan yang sama.

Contoh alasan: no CHANGELOG.md found at the project root or in dev/; the EXEC does not use the template version that has a Changelog section; the Changelog section is empty or still a placeholder; the destination is not writable; the dev workspace is degraded; an unexpected error occurred (disertai pesan galatnya). Lock tidak terpengaruh.

### 5.3 Format keluaran

Contoh tampilan lengkap file produk, tanpa judul global, versi, marker atau metadata Sigma:

~~~markdown
## v1.2

- Memperbaiki perhitungan luas pada batas wilayah.
- Menambahkan ekspor hasil dalam format CSV.

## v1.1

- Mempercepat pemuatan tabel hasil.
~~~

Rekomendasi:

- (Diganti 2.3) Heading berupa versi EXEC, mis. `## v1.1`; tidak ada tanggal.
- Versi yang baru dikunci di atas; satu heading per versi.
- Setiap EXEC memiliki versinya sendiri, sehingga tidak ada penggabungan lintas EXEC; versi yang sudah ada diperluas.
- Identitas proyek, artefak, chain, hash dan waktu rinci tidak ditulis di file produk, termasuk dalam komentar Markdown tersembunyi.
- Poin identik dari dua eksekusi berbeda tidak otomatis dihapus. Pencegahan duplikasi berlaku untuk publikasi ulang eksekusi yang sama, bukan penyamaan teks perubahan.
- File berformat kompatibel dipertahankan dan ditambah. File yang formatnya berbeda tidak ditimpa atau dikonversi diam-diam; pratinjau/keputusan penyesuaian harus terpisah.

Zona waktu dan format tanggal tidak lagi relevan (2.3).

### 5.4 Pemicu dan perilaku

- Pemicu: perpindahan sukses EXEC menjadi LOCKED melalui `sigma exec approve --director-confirm` (CLI) atau commit approve pada MCP. Pada paired_approval, PLAN dan EXEC menjadi LOCKED bersama; pada legacy_lock, hanya EXEC yang relevan. `sigma plan approve`, preview, status, check, dan bootstrap tidak mencatat changelog.
- Urutan: ubah status ke LOCKED dahulu, catat changelog sesudahnya. Kegagalan pencatatan tidak membatalkan atau menunda lock.
- Satu pencatatan per peristiwa lock. Karena pencatatan hanya dijalankan pada jalur perpindahan status yang sebenarnya, pemanggilan ulang approve terhadap EXEC yang sudah LOCKED tidak mencatat lagi. Tidak ada receipt atau penyimpanan status tambahan.
- Konsekuensi yang diterima: bila proses berhenti tepat sesudah lock dan sebelum pencatatan, entri tidak tercatat dan tidak dicoba ulang otomatis; entri dapat ditambahkan manual.
- (Diganti 2.3) Tidak ada tanggal; heading memakai versi EXEC yang dikunci.
- Isi diambil dari section Changelog pada EXEC yang disetujui; runtime tidak menulis ulang poin.
- Hanya berlaku untuk EXEC yang memakai template terbaru; EXEC LOCKED sebelumnya tidak dibackfill.
- Penambahan ke CHANGELOG.md bersifat menambah (append ke kelompok tanggal); isi yang sudah ada tidak diubah. Format file yang tidak dikenali → dilewati dengan pemberitahuan.
- Suntingan manual oleh role AI diperbolehkan selama formatnya sesuai 5.3; aturan ini dicatat pada pedoman role, bukan dijaga runtime.

### 5.5 Kompatibilitas dan perubahan lokasi

- Rekomendasi schema: EXEC baru memakai schema dokumen berikutnya dengan Changelog wajib; EXEC schema 2/3 tetap divalidasi dengan aturan lama. Ini usulan, bukan perubahan SCHEMA_VERSION chain.
- EXEC lama yang belum LOCKED dapat menambahkan Changelog secara eksplisit jika dukungan marker kompatibel disetujui. Tanpa section, laporkan bahwa publikasi tidak tersedia; jangan mengarang daftar dari laporan hasil.
- EXEC lama yang sudah LOCKED tetap utuh; tidak ada backfill atau tanggal penguncian yang ditebak.
- (Disesuaikan) Jika workspace baru diaktifkan setelah changelog root pernah ada, tujuan mengikuti aturan resolusi 5.2: bila `dev/CHANGELOG.md` juga ada dan workspace ACTIVE, dev/ yang dipakai; bila hanya root yang ada, lihat O-9. File lama tidak dipindahkan, digabung atau dihapus otomatis. Dampak dua lokasi disampaikan kepada Director; migrasi riwayat memerlukan keputusan terpisah.
- F10 dapat mengganti nama artefak, tetapi publisher harus mengikuti identitas/state terdaftar, bukan hardcode prefix nama file.
- F09 mendistribusikan template/rule/validator yang kompatibel bersama runtime. Hindari instalasi parsial template baru tanpa reader/validator yang mendukungnya.

## 6. Keputusan terbuka dan rekomendasi

Ketentuan utama pada bagian 2 dan catatan Director pada 2.1 tidak dibuka ulang. Status O-1 sampai O-8: rekomendasi disetujui Director 14 Oktober 2026 (lanjutan), dengan penyesuaian yang tertulis pada kolom terakhir. O-9 sampai O-12 dijawab Director pada lanjutan kedua; lihat 2.2.

| ID | Keputusan | Rekomendasi (asli) | Status dan penyesuaian |
|---|---|---|---|
| O-1 | Arti workspace "terdeteksi"; folder dev biasa dan ACTIVE_DEGRADED | Detektor F13: ACTIVE → dev/, INACTIVE → root; folder biasa tidak mengaktifkan workspace. DEGRADED menghentikan publikasi/lock. | DISETUJUI dengan penyesuaian: DEGRADED **tidak** menghentikan lock (catatan 1); perilakunya O-10. |
| O-2 | Kapan file dibuat; eksekusi tanpa perubahan produk | Buat saat publikasi pertama; "Tidak ada perubahan produk." tidak membuat heading tanggal kosong. | DISETUJUI dengan penyesuaian: file dibuat oleh `project start`/pembaruan proyek (catatan 4), bukan saat publikasi. Aturan "Tidak ada perubahan produk." tetap. |
| O-3 | Format tanggal dan zona waktu | (Dibatalkan 2.3) Heading memakai versi EXEC; tanggal dan zona waktu tidak dipakai. | TIDAK BERLAKU. |
| O-4 | Urutan dan pengelompokan entri | Versi terbaru dikunci di atas; satu kelompok per versi; hanya versi dan daftar. | DISETUJUI, disesuaikan 2.3. |
| O-5 | Schema, kewajiban section, EXEC lama | Schema baru untuk EXEC baru dengan section wajib; schema 2/3 tetap sah; tanpa backfill. | DISETUJUI. |
| O-6 | Publikasi gagal atau operasi diulang | Lock dan changelog satu transaksi; gagal tulis → lock tidak sukses. | DISETUJUI dengan penyesuaian: **dibalik** (catatan 1). Lock tidak pernah gagal karena changelog; pencatatan sesudah lock, dilewati dengan pemberitahuan bila gagal; tanpa receipt (2.2). |
| O-7 | CHANGELOG.md lama berbeda format | Pertahankan isi; tidak menimpa atau mengubah format otomatis. | DISETUJUI. Format tidak kompatibel → publikasi dilewati dengan peringatan (konsisten catatan 1). |
| O-8 | Workspace diaktifkan setelah changelog root ada | Entri baru mengikuti lokasi workspace; riwayat tidak dipindah. | DISETUJUI dengan penyesuaian: tunduk pada aturan resolusi 5.2 dan O-9. |
| O-9 | Hanya **satu** dari dua file yang ada (mis. workspace ACTIVE tetapi hanya root/CHANGELOG.md ada; atau workspace off tetapi hanya dev/CHANGELOG.md ada) | Pakai satu-satunya file yang ada. Pembacaan harfiah catatan 3: pemeriksaan status workspace hanya untuk menyelesaikan konflik dua file; "tidak terdeteksi" hanya bila tidak ada kandidat sama sekali. Alternatif: tujuan ditentukan status workspace saja dan file kandidat lain dianggap tidak ada → dilewati. Alternatif ini membuat pencatatan berhenti senyap begitu workspace diaktifkan pada proyek yang sudah punya CHANGELOG.md root. | DISETUJUI (rekomendasi diterima). |
| O-10 | Perilaku ACTIVE_DEGRADED (tidak boleh memblokir lock) | Lewati publikasi dengan peringatan dan arahkan ke `sigma dev ...`/doctor untuk perbaikan. Tidak menebak tujuan: memilih dev/ atau root saat boundary rusak adalah tebakan. | DISETUJUI. |
| O-11 | Perintah yang membuat file otomatis | **Temuan:** `sigma project update` tidak ada pada master (subperintah `project`: start, status, sync, register; `sigma setup update` hanya memperbarui ~/.sigma/, tidak menyentuh proyek). Rekomendasi: `sigma project start` (termasuk `--reinit`) dan `sigma project sync --confirm`; file dibuat hanya bila kedua lokasi kosong, pada dev/ bila workspace ACTIVE, selain itu root; isi awal kosong (tanpa judul global, sesuai 5.3); tidak ditimpa bila sudah ada; `sigma dev create-workspace` tidak membuat file. Alasan memilih `project sync`: sudah ada pratinjau dry-run dan gerbang `--confirm`, sehingga penulisan ke proyek yang ada tidak muncul tanpa persetujuan; menambah perintah `project update` baru menambah permukaan CLI tanpa kebutuhan tambahan. | DISETUJUI sesuai rekomendasi; nama operasi dikoreksi menjadi `sigma project sync --confirm`. |
| O-12 | Syarat pencatatan dan entri yang dilewati | Tanpa retry otomatis, tanpa receipt, tanpa perintah baru. | DIJAWAB (lihat 2.2): hanya bila ketiga syarat terpenuhi (1: Sigma v2 dan fitur ada; 2: EXEC berpindah ke LOCKED dengan template terbaru yang memuat section Changelog; 3: CHANGELOG.md sudah ada); selain itu atau bila ada galat, dilewati dengan pemberitahuan Inggris; sekali per peristiwa lock; suntingan manual diperbolehkan. Menggantikan rekomendasi receipt/retry sebelumnya. |

Pilihan schema/marker serta kontrak input/output final dirinci saat implementasi disetujui. Tidak ada receipt, perintah sinkronisasi, atau backfill baru.

## 7. Strategi uji dan kriteria selesai

Tidak ada pengujian runtime dijalankan pada sesi penyusunan ini. Kasus berikut adalah kontrak uji yang diusulkan untuk implementasi mendatang.

| ID | Kasus | Hasil yang diharapkan |
|---|---|---|
| U-01 | Dua file ada: ACTIVE, INACTIVE, folder dev biasa; satu file ada (O-9); tidak ada file; ACTIVE_DEGRADED (O-10) | Tujuan sesuai aturan resolusi 5.2; tidak memakai cwd; berkas selain dua lokasi valid diabaikan (mis. `docs/CHANGELOG.md`, `dev/sub/CHANGELOG.md`); tidak ada fallback diam-diam. |
| U-02 | Section Changelog valid, kosong, placeholder, panjang/berulang, dan mengandung rujukan artefak | Bentuk dan kewajiban diperiksa; review makna tetap tugas DEV/FMN. Runtime tidak menulis ulang poin. |
| U-03 | Lock pertama dan berikutnya pada kedua model lifecycle | Entri hanya dipublikasikan saat EXEC LOCKED, tepat sekali; lock PLAN tidak menambah entri. |
| U-04 | Versi EXEC bernomor dua digit (mis. v1.10 dan v1.9) | Urutan mengikuti pencatatan, tidak membandingkan string; tidak ada tanggal pada file. |
| U-05 | Dua EXEC dikunci berurutan; versi yang sama dicatat ulang | EXEC baru di atas; versi yang sama diperluas; file hanya memuat versi dan daftar. |
| U-06 | Approve diulang pada EXEC yang sudah LOCKED; MCP replay; proses berhenti sesudah lock sebelum pencatatan | Tidak ada entri ganda; lock tetap sah; entri yang tidak tercatat tidak menghasilkan file terpotong. |
| U-07 | Tujuan tidak dapat ditulis, symlink, folder, format tidak dikenali, galat tak terduga | Lock tetap berhasil; pemberitahuan Inggris lengkap (dua kalimat, termasuk `Update the changelog manually first, then resolve this issue; otherwise the next changelog record will fail again.`); tidak ada kode keluar gagal akibat pencatatan tampil; tujuan lain tidak ditulis. |
| U-08 | CHANGELOG.md lama kompatibel/tidak kompatibel dan workspace baru diaktifkan | Riwayat dipertahankan; tidak ada migrasi/penghapusan otomatis. |
| U-09 | EXEC schema lama, LOCKED historis, dan eksekusi tanpa perubahan produk | Kompatibilitas tetap; tidak ada backfill, isi atau tanggal yang dikarang. |
| U-10 | CLI dan MCP untuk target/sumber/tujuan sama | Preview, pengikatan dependensi, hasil dan aturan pemulihan setara. |
| U-11 | `project start` (baru dan `--reinit`) dan `project sync --confirm`: kedua lokasi kosong, salah satu ada, keduanya ada, workspace ACTIVE/INACTIVE | File dibuat hanya bila kedua lokasi kosong, sesuai status workspace; tidak menimpa; dry-run tanpa `--confirm` tidak menulis; `create-workspace` tidak membuat file. |
| U-12 | Lock pada proyek tanpa CHANGELOG.md, atau EXEC dengan template lama / section Changelog kosong | Lock sukses; pemberitahuan Inggris dengan alasan; tidak ada file dibuat saat lock. |

Kriteria selesai setelah implementasi disetujui: seluruh keputusan tertutup, perubahan dapat direview, tes fokus lulus, TypeScript/build dan regresi yang relevan lulus, git diff --check lulus, serta hasil/batas dicatat. Build dan distribusi bukan bagian sesi rencana ini.

## 8. Risiko dan pengaman

- Section yang terlalu teknis atau berisi proses Sigma menghasilkan changelog produk yang buruk. Pengaman: instruksi penulisan dan review sebelum approval, bukan peringkasan otomatis saat lock.
- Lock sukses tetapi pencatatan dilewati/gagal menyebabkan changelog tertinggal. **Risiko yang diterima** Director. Pengaman: pemberitahuan yang selalu tampil, dan suntingan manual diperbolehkan.
- Pembuatan otomatis menulis file pada proyek yang sudah berjalan. Pengaman: hanya bila kedua lokasi kosong, tidak menimpa, dan `project sync` memakai dry-run/`--confirm`.
- Tanpa receipt, entri ganda dicegah hanya oleh penempatan pemicu pada jalur perpindahan status yang sebenarnya. Pengaman: tes U-06; tidak ada pemicu pada preview, status, atau replay.
- Menambah section wajib pada schema lama dapat merusak kelayakan dokumen historis. Pengaman: kontrak per schema dan tidak menulis ulang EXEC LOCKED.
- CHANGELOG.md bisa sudah menjadi dokumen yang dikelola pengguna. Pengaman: hanya menambah, tidak mengubah isi yang ada; format tidak dikenali → dilewati.

## 9. Urutan implementasi setelah persetujuan

1. Tetapkan kontrak final schema/marker section Changelog (tafsir syarat 1 sudah diterima).
2. Susun perubahan template/validator dan pedoman poin perubahan DEV; review dampak dokumen lama.
3. Tambahkan resolver tujuan (dua lokasi valid + status workspace) dan penulis pasca-lock yang tidak memblokir, tanpa receipt. Tambahkan pembuatan CHANGELOG.md pada `project start` dan `project sync --confirm`.
4. Integrasikan pada kedua jalur yang mengubah EXEC menjadi LOCKED (`sigma exec approve` dan commit MCP); jangan membuat command lock baru atau mengaktifkan kembali tombstone.
5. Jalankan tes fokus, build dan regresi sesuai persetujuan; catat hasil sebelum commit/distribusi.
6. Perbarui rules, hash memory, skill/bridge/registry yang benar-benar terdampak pada master. Catat dampak Protocol/F09.
7. Setelah fokus ini ditutup, lanjutkan F10 sesuai urutan. F07 tetap PENDING PROCESS bersyarat evaluasi pemakaian nyata.

**Batas otorisasi (diperbarui):** implementasi F17 disetujui Director 14 Oktober 2026 dengan lingkup pada bagian 9 dan 10. Commit, build distribusi ke perangkat, dan F09/F12 tidak termasuk.

## 10. Hasil implementasi (14 Oktober 2026)

Dieksekusi sesuai bagian 9 dan keputusan pada 2.1 serta 2.2. Belum di-commit.

| Area | Perubahan | Berkas |
|---|---|---|
| Template dan validator | Template EXEC schema 4 dengan section `CHANGELOG` sebagai section terakhir (sesudah Director Observation Report & Minor Requests); `EXEC_SPEC_V4` mewajibkan section dan urutannya; schema 3 dan lebih lama tidak berubah | `Sigma/templates/DEV-EXEC-TEMPLATE.md`, `src/utils/docCheck.ts` |
| Resolver dan penulis | Modul baru: dua lokasi valid, status workspace menentukan bila keduanya ada, file tunggal dipakai, ACTIVE_DEGRADED/symlink/folder/format tak dikenal/galat apa pun dilewati dengan pesan Inggris; tanggal dari `locked_at` Asia/Jakarta; penulisan atomik tanpa receipt | `src/services/changelogService.ts` |
| Pemicu CLI | Sesudah `withGovernanceTransaction` pada `sigma exec approve --director-confirm` berhasil dan state LOCKED; pesan dilewati ke stderr, kode keluar tidak berubah | `src/commands/approval.ts` |
| Pemicu MCP | Opsi baru `afterCommit` pada `respondControlWrite` yang berjalan sesudah commit dan tidak pada replay idempotent; dipasang hanya untuk domain exec | `src/mcp/control/shared.ts`, `src/mcp/control/tools/approveArtifact.ts` |
| Pembuatan file | `project start` (termasuk `--reinit`) dan `project sync --confirm` membuat CHANGELOG.md kosong hanya bila kedua lokasi kosong; dry-run `project sync` menampilkan baris rencana | `src/commands/project.ts` |
| Pedoman | DEV-RULE bagian EXEC Documentation Rules butir 7; FMN-RULE (With DEV); role memory DEV dan FMN dengan hash rule diperbarui | `Sigma/rules/*`, `Sigma/role-memory/*` |
| Dokumentasi | Entri Unreleased pada CHANGELOG master dan satu baris README | `CHANGELOG.md`, `README.md` |
| Tes | `test/f17-changelog.test.ts` (41 kasus: bagian, format, tujuan, schema 4, pembuatan, jalur approve CLI dan MCP); `validExecDocV4`; satu asersi template pada `doc-check-exec-schema3.test.ts` disesuaikan ke schema 4 | `test/*` |

Verifikasi: `tsc` bersih; 79 berkas / 1.250 tes lulus (1.209 sebelumnya + 41 baru); `git diff --check` bersih.

Batas dan catatan:

- Perilaku sengaja: tidak ada receipt, tidak ada pencatatan ulang. Bila proses berhenti tepat sesudah lock sebelum pencatatan, entri tidak tercatat dan tidak dicoba ulang; entri ditambahkan manual.
- Syarat 1 (Sigma v2 dan fitur ada) tidak diimplementasikan sebagai pemeriksaan terpisah (O-12, tafsir diterima).
- Template baru baru berlaku pada proyek setelah `sigma setup update` (menyalin ke `~/.sigma/templates`) dan `sigma project sync --confirm`. Keduanya tidak dijalankan pada sesi ini; EXEC yang sudah dibuat dari template schema 3 tetap schema 3 dan dilewati dengan pesan yang menyebut schema.
- Saat workspace DEV aktif, aturan DEV-RULE membatasi DEV pada `dev/CHANGELOG.md`; menyunting file root memerlukan otorisasi Director (konsekuensi batas workspace F13, bukan keputusan baru).
- `dist/` yang dilacak Git ikut berubah karena `npm run build`.

## 11. Nama file (14 Oktober 2026, lanjutan ketujuh) — DISETUJUI

Director ragu menamai catatan ini `CHANGELOG.md` karena catatan harus terus hidup dan perubahan format manual atau oleh alat rilis dapat merusak pencatatan. Rekomendasi diterima: file dinamai **`CHANGE-RECORD.md`**, pada dua lokasi valid yang sama (`<project_root>/` dan `<project_root>/dev/`). `CHANGELOG.md` tidak dipakai Sigma; nama itu bebas dipakai untuk salinan presentasi yang dibuat manual. Sigma tidak menyediakan perintah salin, dan salinan perlu disegarkan manual setelah lock berikutnya.

Perubahan: konstanta `CHANGE_RECORD_FILE`, pesan, DEV-RULE, template, README, entri CHANGELOG master, dan tes. Format isi, aturan resolusi, dan pesan dilewati tidak berubah selain nama file.
