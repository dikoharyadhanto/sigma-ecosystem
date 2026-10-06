# Diskusi rencana perubahan Sigma v2

Tanggal mulai: 6 Oktober 2026
Mode: diskusi dan verifikasi read-only. Dokumen ini adalah catatan kerja, bukan artefak governance atau otorisasi implementasi.
Otorisasi write sesi ini terbatas pada dokumen ini; file Markdown pendukung lain memerlukan otorisasi eksplisit Director. Kode, konfigurasi, state Sigma, dan Git tidak diubah.

## Temuan 01 - Konteks message dan memo bercampur lintas intent

### Pengalaman yang dilaporkan Director

Director dapat mengarahkan FMN atau DEV berpindah pekerjaan antar versi. Pergantian lintas major memerlukan aktivasi intent yang sesuai. Tampilan message/memo dan pembatasannya masih mencampur pekerjaan lintas major, sehingga pesan atau memo dari konteks lain mengganggu pekerjaan yang sedang aktif. Ini adalah laporan penggunaan Director; verifikasi sesi ini berfokus pada implementasi mailbox.

### Usulan Director

1. Tampilan memo normal hanya memperlihatkan memo milik major intent yang sedang aktif.
2. Default batas memo menjadi 5 per major intent per AI role, bukan satu akumulasi 5 per AI role untuk seluruh proyek.
3. Pengiriman message hanya diblokir oleh message UNREAD milik pengirim pada major intent yang sama dengan pekerjaan/pesan yang dituju. Message UNREAD pada major intent lain tidak memblokir.
4. Memo dan message intent lain tetap tersimpan; beralih intent mengubah konteks yang relevan, bukan menganggap pesan sudah dibaca.

Pengelompokan mengikuti major intent/chain; perpindahan minor di dalam intent yang sama tetap berbagi kuota dan kewajiban baca. Pergantian intent biasa tidak mengubah status pesan; pengecualian yang diputuskan kemudian adalah migrasi pesan/memo lama melalui doctor ke LEGACY dengan UNREAD diubah menjadi READ.

### Fakta terverifikasi dari kode main pada f707085

- src/engine/mailbox.ts:205-235: getUnreadForRole(), selectInboxMessages(), dan getUnreadMemosForRole() memfilter role, tipe, serta status; tidak memfilter chain/intent.
- src/commands/send.ts:98-114: send gate memeriksa seluruh message UNREAD milik pengirim, dengan MEMO dikecualikan, tanpa batas chain.
- src/commands/memo.ts:133-145,187-202: kuota dan daftar memo menggunakan akumulasi role tanpa filter chain.
- src/engine/projectConfig.ts:47,124: default memo_unread_limit adalah 5. Batas yang berlaku sekarang menghitung memo UNREAD, bukan seluruh memo tersimpan. Membaca memo membebaskan slot.
- src/engine/mailbox.ts:13-29: metadata MessageEntry mempunyai related_artifact, tetapi belum mempunyai identitas chain tersendiri.
- src/commands/memo.ts:68-80,144: chain aktif sudah ditulis sebagai konteks di isi Markdown memo, tetapi tidak disimpan sebagai field chain pada index.
- src/commands/inbox.ts:48-58: indikator memo pada inbox juga menghitung lintas chain.
- src/engine/mailbox.ts:244-250 dan src/commands/memo.ts:249-253: auto-outdate READ message/memo menggunakan kumpulan per role yang bercampur lintas chain.
- src/engine/chain.ts:1134-1139: pada model sekarang, major PLAN adalah major INTENT dikurangi 1; EXEC mengikuti versi PLAN. Karena itu, prefix major pada PLAN/EXEC tidak boleh langsung dianggap sebagai major intent.

Kesimpulan: keluhan tentang pencampuran konteks, kuota memo lintas major, dan send gate lintas major didukung implementasi kode. Tidak dilakukan reproduksi CLI karena command read dapat menulis status atau log.

### Pemahaman perilaku yang dituju

Contoh memakai identitas intent, bukan prefix versi PLAN legacy:

| Kondisi | Perilaku usulan |
|---|---|
| Intent v6 aktif; DEV memiliki 5 memo UNREAD pada intent v5 | Memo v5 tidak memenuhi kuota v6; DEV dapat menulis memo v6. |
| Intent v6 aktif; DEV memiliki 5 memo UNREAD pada intent v6 | Penulisan memo v6 berikutnya ditolak bila kuota tetap berbasis UNREAD. |
| Intent v6 aktif; FMN memiliki message UNREAD hanya pada intent v5 | Message untuk pekerjaan intent v6 boleh dikirim. |
| FMN memiliki message UNREAD pada intent v6 | Message untuk pekerjaan intent v6 tetap diblokir sampai message relevan dibaca. |
| Berpindah minor di dalam intent v6 | Tetap memakai kumpulan memo dan send gate intent v6 yang sama. |

### Rekomendasi asisten - belum keputusan Director

- Simpan identitas chain/intent secara eksplisit sebagai metadata message/memo, terpisah dari related_artifact. Resolusi referensi PLAN/EXEC mengikuti keanggotaan chain sebenarnya.
- Terapkan batas konteks secara konsisten pada daftar, indikator memo inbox, perhitungan kuota, send gate, dan evaluasi auto-outdate; mengganti tampilan saja tidak menyelesaikan seluruh pencampuran.
- Director kemudian menetapkan kuota default lima memo UNREAD per intent per role; pembacaan membebaskan slot.
- Pertahankan keterlacakan dan akses riwayat; pergantian intent biasa tidak mengubah UNREAD, sedangkan migrasi LEGACY melalui doctor mengikuti keputusan Director yang lebih baru.

### Penetapan lanjutan Director dan detail tersisa

- Kuota ditetapkan: default lima memo UNREAD per intent per role.
- Message dan memo dipisahkan menjadi Sigma/messages/<ROLE>/<KONTEKS>/ dan Sigma/memo/<ROLE>/<KONTEKS>/; KONTEKS mencakup major v1/v2/v3 untuk INTENT/ROADMAP/CLOSE, minor seperti v1.1/v1.2 untuk PLAN/EXEC, serta GENERAL dan LEGACY.
- Doctor memindahkan seluruh message/memo format Sigma lama ke LEGACY masing-masing role, termasuk yang referensinya dapat diketahui; UNREAD diubah paksa menjadi READ sebelum dipindahkan. Ini menggantikan rekomendasi klasifikasi ulang pesan lama ke chain dan mempertahankan UNREAD saat migrasi.
- Pengiriman lintas intent ditolak: pesan bertanda v2.1 memerlukan INTENT v2 aktif pada standar baru; untuk chain legacy, resolusi tetap mengikuti keanggotaan chain dan penomoran yang berlaku.
- Tampilan normal mengikuti intent aktif; seluruh kategori action diperlakukan sama untuk send gate, termasuk FYI, RESPOND, REVIEW, UNBLOCK dan OTHER.
- GENERAL digunakan sebagai cadangan bila versi tidak dapat dihubungkan; GENERAL UNREAD selalu tampil, termasuk ketika intent aktif berbeda atau belum tersedia. Detail gate/kuota GENERAL, balasan dengan konteks tidak sesuai dan kebijakan retensi/akses riwayat masih perlu spesifikasi.

Rincian struktur, agregasi major dan migrasi tercatat pada bagian Keputusan lanjutan Director di bawah.

Status: keluhan terverifikasi dan keputusan mailbox lanjutan Director dicatat; detail yang disebut terbuka masih membutuhkan keputusan; belum ada implementasi.

## Temuan 02 - Penomoran PLAN/EXEC selaras dengan INTENT, kompatibilitas per chain

### Penjelasan dan arah perubahan Director

Director menyatakan aturan major PLAN = major INTENT - 1 berasal dari kesalahan pemahaman desain awal dan berpotensi membingungkan pengguna serta AI role. Aturan baru yang diinginkan: INTENT vN mempunyai PLAN vN.1, vN.2, dan seterusnya; EXEC mengikuti nomor PLAN pasangannya.

Kompatibilitas dipertahankan: chain lama yang sudah memakai/mengunci aturan lama tetap memakai aturan lama sampai intent baru dibuat. Aturan baru mulai berlaku ketika intent/chain baru dibuat setelah perubahan ini diterapkan, termasuk intent baru di proyek lama. Artefak dan referensi historis tidak dinomori ulang.

Ini adalah arah desain dan batas kompatibilitas dari Director dalam diskusi, bukan otorisasi implementasi.

### Contoh perilaku

| Kondisi | Penomoran |
|---|---|
| Chain legacy INTENT v2 dengan PLAN v1.1, v1.2 | Tetap memakai PLAN/EXEC v1.x. |
| PLAN tambahan pada chain legacy tersebut | Pemahaman asisten: tetap v1.3 dan seterusnya, sehingga satu chain tidak mencampur dua aturan. |
| INTENT v3 baru dibuat di proyek lama setelah aturan baru tersedia | PLAN v3.1, v3.2; EXEC sama dengan PLAN pasangannya. |
| INTENT v2 baru pada proyek yang sejak awal memakai aturan baru | PLAN/EXEC v2.1, v2.2, dan seterusnya. |
| Mengaktifkan kembali INTENT v2 legacy | Tetap aturan legacy; aktivasi tidak membuat intent/chain baru. |

### Fakta terverifikasi

- src/engine/chain.ts:1134-1139: nextPlanVersion() mengalokasikan major PLAN dengan major INTENT dikurangi 1.
- src/engine/chain.ts:1388-1395: registerPlanDraft() juga menegakkan aturan tersebut. Mengubah generator saja akan membuat validasi menolak versi baru.
- src/engine/chain.ts:1151-1152 dan src/services/execDraftService.ts:122,137: EXEC sudah mengikuti versi PLAN yang direferensikan; hubungan satu PLAN dengan EXEC bernomor sama tidak perlu diubah secara konseptual.
- src/services/intentDraftService.ts:90-105: pembuatan intent membuat chain terpisah melalui createInitialChain(), lalu menulis manifest aktif. Ini menyediakan titik penetapan aturan penomoran untuk chain baru.
- src/engine/chain.ts:275-295: ChainState mempunyai schema_version dan chain_version, tetapi belum menyimpan penanda khusus aturan penomoran.
- src/engine/chain.ts:969-974: doctor dapat menaikkan schema_version chain lama. Karena itu schema_version saja tidak aman untuk menentukan apakah chain harus memakai aturan baru.
- src/engine/reconstruct.ts:319-338: rekonstruksi dari artefak mengelompokkan PLAN/EXEC dengan asumsi major INTENT = major PLAN + 1. Asumsi ini harus membedakan aturan lama dan baru agar pemulihan tidak memasangkan artefak ke intent yang salah.

### Rekomendasi asisten - belum keputusan implementasi

1. Tetapkan aturan penomoran sebagai properti chain saat chain dibuat, misalnya versioning_scheme = legacy_offset atau intent_aligned. Nama field/nilai ini masih usulan teknis.
2. Chain tanpa penanda memakai fallback legacy yang eksplisit; chain baru menuliskan aturan baru. Upgrade CLI, project sync, doctor, aktivasi ulang, atau amandemen tidak mengganti aturan penomoran chain lama secara otomatis.
3. Generator versi, validasi, pembuatan/promosi PLAN, pairing EXEC, dan rekonstruksi menggunakan aturan chain yang sama. Jalur CLI dan MCP harus konsisten.
4. Pertahankan file, nomor, referensi, dan evidence historis. Perubahan ini tidak memerlukan renumber seluruh proyek.
5. Untuk rekonstruksi ketika state chain hilang, siapkan bukti aturan/keanggotaan chain yang tetap tersedia di artefak atau metadata pemulihan; jangan menebak aturan hanya dari nomor file.

### Kaitan dengan Temuan 01

Message dan memo tetap harus memakai identitas intent/chain sebenarnya. Pada proyek campuran, PLAN v1.x dapat menjadi turunan INTENT v2 legacy, sedangkan PLAN v3.x menjadi turunan INTENT v3 baru. Prefix PLAN/EXEC bukan pengganti metadata keanggotaan chain.

### Penetapan kompatibilitas DRAFT dan detail teknis

- Director menetapkan INTENT DRAFT yang sudah ada sebelum upgrade tetap memakai skema legacy, termasuk ketika belum mempunyai PLAN.
- Bentuk penanda permanen aturan penomoran dan bukti pemulihannya masih perlu spesifikasi.

Status: aturan sekarang terverifikasi; arah penyelarasan dan kompatibilitas Director dicatat; rincian desain masih dalam diskusi; belum ada implementasi.

### Tambahan Director - Pemberitahuan kompatibilitas pada session bootstrap

Masalah tambahan: setelah protokol memakai aturan baru, AI yang membaca protokol dapat menganggap pola chain legacy sebagai kesalahan karena tidak mendapat penjelasan kompatibilitas saat orientasi.

Arahan Director:

- Setiap session bootstrap mengenali aturan penomoran intent/chain yang sedang aktif.
- Jika chain aktif memakai pola lama, tampilkan warning singkat yang menjelaskan bahwa pola lama dipertahankan demi kompatibilitas.
- Aturan legacy yang dijelaskan: nomor pertama/major PLAN selalu satu lebih kecil dari major INTENT; EXEC mengikuti nomor PLAN.
- Warning hanya muncul untuk intent aktif yang terdeteksi memakai aturan legacy. Chain baru dengan aturan selaras tidak mendapat warning tersebut.

Contoh redaksi usulan:

> [KOMPATIBILITAS] INTENT v2 memakai penomoran lama: PLAN/EXEC v1.x (major PLAN = major INTENT - 1). Pola ini dipertahankan untuk kompatibilitas chain lama. Gunakan pola tersebut selama bekerja pada chain ini.

Perilaku yang dituju:

| Kondisi bootstrap | Pemberitahuan |
|---|---|
| INTENT v2 legacy aktif | Muncul penjelasan bahwa turunan memakai v1.x. |
| INTENT v3 dengan aturan baru aktif | Warning legacy tidak muncul. |
| Ada chain legacy tetapi chain aktif memakai aturan baru | Warning legacy tidak muncul. |
| Chain legacy diaktifkan kembali lalu bootstrap dijalankan | Warning legacy muncul kembali untuk chain aktif tersebut. |

Verifikasi read-only:

- src/session/bootstrapView.ts:24-51 menyediakan data bersama bootstrap CLI dan orientation MCP, termasuk chain aktif; belum memiliki metadata aturan penomoran atau warning kompatibilitas versi.
- src/commands/session.ts:140-145 sudah menampilkan Active Chain secara menonjol. Ini merupakan lokasi logis bagi penjelasan kompatibilitas aktif.
- src/mcp/tools/orientation.ts:71-94 menggunakan bootstrap view yang sama dan sudah mengembalikan warning runtime. Warning penomoran legacy perlu dibedakan dari invalid/stale runtime.
- src/commands/intent.ts:292-307 mengaktifkan chain yang dipilih; aktivasi tidak membuat chain baru atau mengganti aturan penomorannya.

Rekomendasi asisten - belum keputusan tambahan:

1. Deteksi legacy dari aturan chain yang stabil, bukan semata dari keberadaan PLAN. Chain legacy yang belum mempunyai PLAN tetap perlu mendapat penjelasan aturan yang berlaku.
2. Pemberitahuan ini bersifat informasional dan tidak menandai chain sebagai rusak, membuka/menutup gate, atau menawarkan renumber otomatis.
3. Orientasi MCP menerima informasi kompatibilitas yang sama secara terstruktur, agar pemahaman AI tidak bergantung pada jalur CLI.
4. Protokol baru cukup menyebut satu pengecualian kompatibilitas: chain legacy mengikuti aturan yang dinyatakan bootstrap, sedangkan aturan selaras berlaku bagi intent baru. Ini membuat penjelasan runtime konsisten dengan authority protokol.

Status tambahan: kebutuhan pemberitahuan legacy bersyarat dari Director dicatat; belum ada implementasi.

## Pembacaan dokumen sumber 01 - Keputusan desain dan inventaris 28 September

Sumber: 2026-09-28_sigma-v2-keputusan-desain-dan-inventaris.md, dibaca penuh (bagian 1-12).
Basis sumber: v1.0.0 pada d4555a3. Basis kode yang diperiksa dalam sesi sekarang: main dengan integrasi inti pada f707085.
Dokumen sumber mencatat 22 keputusan desain Director, tetapi berstatus advisory dan secara eksplisit tidak mengotorisasi implementasi. Bagian berlabel USULAN/INFERENSI tetap dibedakan dari catatan keputusan. Dokumen sumber tidak diubah.

### Pemahaman utama

1. Dokumen merancang penyederhanaan artefak dan rules sekaligus perubahan alur persetujuan pekerjaan. Tujuan praktisnya: dokumen mudah direview manusia, kontrak bisa menyesuaikan temuan implementasi secara terkendali, dan penguncian menandai pekerjaan yang benar-benar selesai.
2. PLAN berubah dari DRAFT langsung LOCKED menjadi DRAFT lalu APPROVED. PLAN tetap dapat direvisi oleh FMN pada checkpoint yang ditentukan sampai pasangan PLAN-EXEC terkunci. Persetujuan EXEC langsung mengunci kedua artefak bernomor sama; APPROVED pada EXEC adalah tindakan menuju penguncian pasangan, bukan antrian status baru yang jelas terpisah.
3. FMN tetap pemilik PLAN. DEV mengajukan CONTRACT_CHANGE_REQUEST dengan alasan, bukan mengedit PLAN. FMN memberitahukan perubahan lewat CONTRACT_CHANGE. Perubahan biasa direview Director bersama persetujuan EXEC; pelonggaran AC/kontrak uji membutuhkan persetujuan Director sebelum pekerjaan terdampak dilanjutkan.
4. Pengaman acuan: EXEC menyimpan revisi PLAN; PLAN menyimpan revisi INTENT. Persetujuan EXEC menolak acuan PLAN yang tertinggal, perubahan kontrak tanpa pemberitahuan, dan pelonggaran yang belum disetujui. Amandemen INTENT memicu peninjauan pasangan APPROVED, tanpa mengubah pasangan LOCKED secara retroaktif.
5. Gaya humanize menjadi gaya dokumen sumber. Ringkasan Director pindah ke atas; angka, larangan, ambang, dan verdict harus tetap presisi. Boilerplate/instruksi pengisian pindah ke rules; marker dan ID formal dipertahankan; bukti yang dapat dihasilkan CLI tidak diulang manual.
6. Template INTENT, PLAN, EXEC, dan CLOSE dipangkas melalui penggabungan isi, pemindahan doktrin, dan bagian opsional. INTENT mendapat ringkasan serta 3 skenario termasuk dan 3 tidak termasuk yang wajib sebelum ratify. AC dan test contract PLAN menjadi tabel yang sama. Dua checkpoint FMN pada EXEC tetap dipertahankan.
7. Nama artefak menjadi INTENT, PLAN, EXEC, CLOSE; prefix role hilang, kepemilikan ditulis di header. ROADMAP tetap. Reader diharapkan menerima nama lama dan baru; pengenalan nama generik dibatasi folder Sigma dan pola versi untuk mencegah salah deteksi file proyek.
8. Doktrin berulang diusulkan pindah ke COMMON-RULE. Skill untuk empat target diusulkan dihasilkan dari satu sumber. CONSTITUTION tetap dokumen prinsip singkat; PROTOCOL menjadi spesifikasi referensi. Inventaris MUST saat ini baru per klaster; keterlacakan per aturan direncanakan untuk penulisan ulang.
9. Proyeksi HUMAN terpisah serta Fidelity Ledger akan dihapus. Notion memakai dokumen sumber. Ini memerlukan penyesuaian jalur publikasi dan kompatibilitas proyek lama, tidak hanya perubahan gaya template.
10. Kompatibilitas: dua model didukung, chain lama tidak dinomori ulang. Dokumen membuka migrasi state opsional per chain. Aturan penomoran selaras sama dengan Temuan 02; warning bootstrap legacy dan pembatasan message/memo pada Temuan 01 belum dirumuskan dalam dokumen sumber.
11. D-16 memperbolehkan persetujuan PLAN dan otorisasi mulai coding diberikan sekaligus. D-19 menghilangkan batas putaran klarifikasi DRAFT, tetapi tetap membatasi debat posisi. Frasa khusus skor/SKIP_FOR_AUDIT tetap. Profil Lite ditunda sampai pilot menghasilkan data.
12. sigma note merupakan track terpisah untuk rilis 1.1.0: catatan bebas tanpa chain, NOTE-YYMMDDHHMM-slug, judul dan tanggal awal, pencarian judul, penanganan tabrakan nama, serta pembacaan catatan legacy tanpa indeks. Memo tetap mempunyai fungsi antrean operasional tersendiri.

### Verifikasi dan pembatasan klaim

- ROADMAP memang sudah otomatis dikunci bersama close bila masih DRAFT: src/services/closeLockService.ts:59-70. Koreksi di awal dokumen sumber benar untuk kode sekarang.
- Model persetujuan/revisi pasangan v2 belum terdapat pada jalur sekarang: PLAN/EXEC masih memakai lock, Gate 2 bergantung pada PLAN LOCKED, dan service MCP memanggil use case lock yang sama. Ini desain yang akan dibuat, bukan kemampuan yang sudah tersedia.
- Penomoran offset dan EXEC sama dengan PLAN terverifikasi pada Temuan 02.
- Pendeteksian edit INTENT melalui hash sudah tersedia di chain.ts:1190-1210, tetapi itu belum sama dengan model revisi numerik dan sertifikasi PLAN yang diusulkan.
- INACTIVE pada tabel status INTENT bagian 2.2 sumber tidak sesuai tipe sekarang: chain.ts:200 memakai DRAFT, RATIFIED, SUPERSEDED. Active/inactive adalah pemilihan chain, bukan status INTENT saat ini.
- Marker schema pada template memang ada, tetapi versi schema dokumen, schema runtime 1.2.0, versi paket 1.0.0, dan skema lifecycle/penomoran adalah hal berbeda. docCheck.ts:541 memilih satu DOC_SPECS berdasarkan domain; keberadaan marker schema saja belum memberi pemilihan validator v1/v2.
- sigma note belum ditemukan di daftar command source maupun file command/test note. Pemeriksaan dilakukan melalui registrasi src/cli.ts dan inventaris nama file; hasil berlaku untuk repo saat ini.
- Skill write-memo memang mengizinkan file detail bebas di Sigma/notes lalu menunjuknya dari memo: setup/targets/claude_code/write-memo.md:34-36. Memo dan note bukan nama baru untuk objek yang sama.
- Angka perkiraan ukuran/kemunculan MUST dan nama lama pada dokumen sumber tidak dihitung ulang dalam sesi ini; diperlakukan sebagai inventaris baseline lama, bukan ukuran main sekarang.

### Hal yang perlu diperjelas dalam pembahasan

1. Bagian 6.1 masih berlabel USULAN dan posisi Arahan untuk FMN di template INTENT masih menunggu pilot. Pernyataan semua keputusan selesai tidak berarti struktur dan kontrak teknis sudah final.
2. Dukungan chain v1 dan penghapusan plan lock/exec lock dengan tombstone perlu jalur operasional yang eksplisit. Data lama bisa tetap terbaca, tetapi workflow lama belum tentu tetap dapat diteruskan bila command dan skills-nya tidak ditangani.
3. schema_version runtime dapat diperbarui doctor. Penanda kompatibilitas lifecycle/penomoran harus stabil dan dibedakan dari format runtime serta marker template.
4. Daftar dampak source hanya merinci MCP output/query. Setelah integrasi f707085, service dan MCP control prepare/commit, ticket/approval, validasi stale state, transaksi/recovery, dan audit juga harus memakai aturan v2 yang sama.
5. Hash dan nomor revisi membuktikan adanya perubahan serta acuan, bukan makna perubahan. Penilaian pelonggaran tetap bergantung pada FMN/DEV, Director, dan audit; batas ini sudah diakui sumber.
6. Pilihan migrasi state opsional pada bagian 8 belum disamakan dengan aturan terbaru sesi ini. Penomoran baru khusus chain baru dan migrasi state chain lama adalah dua keputusan yang perlu dipisahkan; jangan menganggap pernyataan terbaru mengotorisasi migrasi.
7. Usulan mailbox per intent dan warning bootstrap legacy dari sesi ini perlu diikutkan pada rancangan berikutnya agar protokol, orientasi, pemberitahuan perubahan kontrak, dan kompatibilitas berjalan konsisten.

Penilaian asisten: bagian yang paling menentukan keseluruhan desain adalah makna APPROVED versus LOCKED dan batas revisi PLAN, karena menentukan gate, checkpoint, bukti, command, serta kompatibilitas. Dokumen ini cukup sebagai arah dan inventaris, belum spesifikasi implementasi lengkap. Belum ada kode, konfigurasi, dokumen sumber, atau Git yang diubah selama pembacaan.

## Arah evaluasi menyeluruh - Keterbacaan Director dan kejelasan AI

### Tujuan dan pengalaman Director

Director ingin mengevaluasi ulang seluruh file Markdown Sigma, termasuk template dan rules, serta memory yang memengaruhi perilaku AI. Dokumen harus disederhanakan secara seimbang: Director dapat membaca dan meninjau substansinya, sementara AI tetap memahami pekerjaan dan batas kewenangannya. Director melaporkan kesulitan membaca dokumen Sigma dan menilainya sebagai faktor yang menjelaskan beberapa hasil kerja yang tidak sesuai keinginan.

Tujuan ini menjadi arah diskusi. Pernyataan hubungan sebab-akibat diperlakukan sebagai hipotesis penggunaan yang masuk akal; belum dibuktikan sebagai satu-satunya penyebab pada pekerjaan tertentu.

### Bukti dari sampel saat ini

- SIGMA_PROTOCOL.md:626-645 secara eksplisit memisahkan INTENT/CLOSE yang wajib mudah dipahami Director dari PLAN/EXEC/rules/protocol yang boleh padat. Konsekuensi desainnya: dokumen yang menentukan persetujuan pekerjaan tidak seluruhnya dioptimalkan untuk review Director.
- FMN-PLAN-TEMPLATE.md:28-101 mencampur isian prasyarat proyek dengan penjelasan panjang tentang semantik status, snapshot, ownership, dan prosedur revisi.
- FMN-PLAN-TEMPLATE.md:269-284 menempatkan ringkasan Director di bagian akhir; instruksinya mengandaikan Director cukup membaca ringkasan tersebut. Risiko: keputusan kontrak yang menentukan hasil tidak mudah diperiksa langsung.
- DEV-EXEC-TEMPLATE.md:60-84 memuat penjelasan prosedural riset dan batas otoritas yang lebih sesuai ditempatkan pada aturan role daripada diulang pada setiap artefak proyek.
- Role memory FMN/DEV berisi general reminders, role-specific reminders, dan perintah prosedural; source_rule_version masih unversioned. Memory menyatakan dirinya pengingat, bukan sumber otoritas baru, tetapi pengulangan tetap meningkatkan biaya menjaga konsistensi.

Sampel ini mendukung diagnosis beban baca dan pencampuran fungsi. Ini belum audit penuh setiap dokumen Sigma.

### Pandangan asisten

1. Setuju bahwa keterbacaan adalah kebutuhan fungsional governance, bukan sekadar preferensi bahasa. Persetujuan hanya efektif jika Director dapat memahami hasil yang dijanjikan, batas lingkup, risiko, dan cara membuktikannya sebelum pekerjaan dimulai.
2. Setuju memindahkan ringkasan keputusan ke atas, menulis kontrak proyek dengan bahasa yang jelas, menghapus boilerplate, serta menggabungkan section yang mengulang informasi sama.
3. Tidak setuju menjadikan jumlah baris, ukuran file, jumlah section, atau batas lima kalimat sebagai ukuran keberhasilan utama. Ringkas tetapi menyembunyikan lingkup, ambang, atau keputusan yang belum selesai tetap gagal.
4. Ragu bahwa pemendekan dokumen sendiri cukup mencegah pekerjaan meleset. Salah penafsiran intent, AC yang tidak menggambarkan hasil yang diinginkan, konflik antar sumber, dan acuan versi yang salah perlu dibedakan melalui kasus nyata.
5. Tidak merekomendasikan mengadopsi seluruh perubahan dokumen 28 September sebagai satu paket. Rename artefak, model APPROVED/LOCKED, revisi kontrak, penghapusan HUMAN, dan note adalah keputusan berbeda dengan dampak berbeda. Kebutuhan keterbacaan bisa diuji lebih dahulu tanpa mengubah semuanya sekaligus.
6. Model PLAN yang dapat direvisi terkendali masuk akal untuk menghadapi penemuan saat implementasi; persetujuan bersyarat pada bukti revisi, pemberitahuan, dan pengawasan pelonggaran yang jelas. Revisi bukan pengganti pemahaman awal intent.

### Rekomendasi untuk evaluasi dokumen - belum rencana eksekusi

- Cakupan mencakup CONSTITUTION/PROTOCOL, template, role rules, skill/bridge setiap target, role memory JSON, dokumen proyeksi dan aturan pemeliharaannya, registry yang menghubungkan dokumen/operasi, serta orientasi/bootstrap/help yang membentuk pemahaman runtime. Arsip historis perlu dipilah sebagai evidence; evaluasi ulang tidak berarti menulis ulang seluruh arsip.
- Pisahkan fungsi: artefak berisi kontrak spesifik proyek; rules berisi prosedur/otoritas role; protocol berisi spesifikasi; memory berisi pengingat inti dengan rujukan sumber; skill/bridge menjadi pintu masuk yang konsisten.
- Sumber tunggal berarti setiap aturan mempunyai satu definisi otoritatif, bukan semua dokumen disatukan ke satu file panjang. Pengingat lokal yang membantu boleh ada, tetapi tidak menjadi versi aturan yang disunting independen.
- Artefak menyajikan keputusan di awal, kemudian kontrak yang dapat direview Director, lalu bukti teknis rinci bila diperlukan. Ambang penerimaan, larangan, risiko yang memengaruhi keputusan, dan ketidakpastian tidak disembunyikan dalam lampiran.
- Ringkasan Director bukan pengganti substansi kontrak. Ringkasan dan detail harus cocok; informasi berisiko atau lingkup yang belum jelas harus muncul pada bagian yang digunakan untuk menyetujui pekerjaan.
- Evaluasi aturan yang terlalu absolut atau otomatis meminta approval/berhenti pada kegiatan operasional. Yang dipertahankan harus memiliki tujuan kendali, pemicu, tindakan, dan pengecualian yang jelas; bukan dihapus semata karena panjang.
- Pilot satu pasangan INTENT-PLAN dari kasus nyata yang sebelumnya meleset, lalu ikuti sampai interpretasi DEV/hasil. Uji pemahaman Director dan role memakai pertanyaan hasil, batas, kriteria bukti, keputusan terbuka, serta kapan pekerjaan selesai. Waktu baca hanyalah satu indikator.
- Gunakan tabel keterlacakan makna: kewajiban yang digabung/dipindah tetap dapat ditemukan; penghapusan substantif adalah keputusan tersendiri. Jangan hanya mempertahankan string MUST tanpa menilai fungsi dan redundansinya.

### Kriteria keberhasilan yang direkomendasikan

1. Director dapat menjelaskan apa yang akan dihasilkan, apa yang tidak dikerjakan, kriteria selesai, risiko penting, dan keputusan yang diminta tanpa menerjemahkan jargon.
2. ARC, FMN, DEV, dan AUD mengartikan batas serta kriteria penerimaan secara konsisten; pertanyaan yang mengubah lingkup atau hasil sudah ditandai sebelum implementasi.
3. Angka, larangan, otoritas, bukti wajib, serta kompatibilitas tetap eksplisit dan terlacak.
4. Kontrak dan ringkasan tidak bertentangan; memory/skill/rules tidak memperkenalkan kewajiban baru atau aturan lama yang berbeda.
5. Jumlah klarifikasi ulang dan ketidaksesuaian terhadap tujuan berkurang pada kasus pilot. Belum ada target angka yang disepakati.

Status: tujuan evaluasi menyeluruh Director dicatat; penilaian asisten bersifat rekomendasi; belum ada perubahan pada dokumen Sigma operasional, kode, konfigurasi, atau Git.


## Sampel proyek nyata - KLHK_JasaLingkunganHidup

### Lingkup pembacaan dan status

Director mengarahkan pembacaan beberapa artefak dari I:/Works/Project/KLHK_JasaLingkunganHidup untuk mempelajari pola dokumen Sigma yang benar-benar dipakai. Pembacaan dilakukan langsung tanpa perubahan pada proyek KLHK, tanpa menjalankan Sigma CLI, dan tanpa menyalin artefak menjadi file baru.

Empat artefak dibaca seluruh isinya:
- Sigma/charter/DIR-INTENT-v6.md: 671 baris, 43.169 byte; snapshot runtime RATIFIED.
- Sigma/contract/FMN-PLAN-v5.3.md: 246 baris, 21.243 byte; snapshot runtime LOCKED.
- Sigma/evidence/DEV-EXEC-v5.3.md: 545 baris, 51.601 byte; snapshot runtime LOCKED.
- Sigma/contract/FMN-PLAN-v5.4.md: 261 baris, 32.386 byte; snapshot runtime DRAFT.

Tambahan: inventaris struktur dan ukuran artefak lain; bagian pembaruan pasca-build serta ringkasan akhir DEV-EXEC-v5.1.md dibaca sebagai contoh dokumen yang bertambah lintas sesi (846 baris, 175.539 byte). Dokumen terakhir ini tidak dibaca seluruhnya. Ukuran/baris menggambarkan sampel saat dibaca, bukan nilai mutu.

activate_status.json memilih v6. progress-v6.json mereferensikan PLAN v5.1 sampai v5.4 ke INTENT v6, dan EXEC mengikuti nomor PLAN. Ini contoh nyata pola versi lama yang dibahas pada Temuan 02. PLAN aktif v5.4 DRAFT; EXEC aktif v5.3 LOCKED. Status berasal dari pembacaan JSON, bukan pemeriksaan CLI baru.

### Pola yang terverifikasi

1. **Kontrak proyek bercampur dengan manual pengisian dan doktrin.** INTENT v6 ?2 berstatus NOT_NEEDED pada baris 95?102, tetapi baris 104?150 tetap memuat contoh banjir/curah hujan, aturan sumber, petunjuk sitasi, dan beberapa isian N/A. Contoh tersebut bukan substansi proyek penutupan lahan. EXEC v5.3 baris 73?92 memuat aturan lengkap mengenai kewenangan riset; baris 105?131 kembali memberi instruksi dan format pengisian. Pemindahan petunjuk ini dapat mengurangi beban baca tanpa menghilangkan keputusan proyek.

2. **Bahasa isian belum konsisten dengan pembaca Director.** INTENT v6 memadukan uraian tujuan Bahasa Indonesia dengan user story dan acceptance criteria berbahasa Inggris pada ?9 (baris 357?467), serta doktrin Inggris di banyak bagian. Konfigurasi proyek menyatakan bahasa dokumen Indonesia. ID, istilah ilmiah, dan nama status dapat tetap formal; prosa keputusan dan instruksi tidak harus mengikuti bahasa placeholder template.

3. **Informasi sama ditulis ulang sebagai kewajiban di banyak bagian.** PLAN v5.3 menjelaskan larangan inferensi ulang, perubahan masukan, label baru, dan naskah akademik pada Source Alignment (17?20), Build Objective (59), AC (98?103), Constraints (114?120), Handoff (157?172), dan ringkasan (241). Sebagian pengulangan berguna sebagai orientasi atau pengujian, tetapi menyalin ulang definisi batas lengkap menciptakan banyak tempat yang harus konsisten. Usulan: definisi batas otoritatif sekali, ringkasan singkat di awal, kemudian rujukan ID pada tugas/pemeriksaan yang menggunakannya.

4. **Ringkasan sudah bermanfaat tetapi terlambat ditemukan.** Ringkasan PLAN v5.3 mulai baris 234, EXEC v5.3 baris 527, PLAN v5.4 baris 248, dan EXEC v5.1 baris 814. Isi PLAN v5.3 baris 241 sudah menyampaikan pekerjaan/batas dengan cukup jelas. Memindahkannya ke awal memiliki manfaat langsung; ringkasan tetap harus diikuti kontrak yang dapat ditinjau, bukan menggantikan detail yang menentukan penerimaan.

5. **Dokumen panjang belum menjamin kriteria tidak ambigu.** PLAN v5.3 baris 245 menyatakan tidak ada pertanyaan terbuka. EXEC pasangannya kemudian mengajukan tiga klarifikasi pada baris 51?53: apakah rasterisasi ulang PL24 termasuk lingkup, apakah komposisi klaster pada 10 piksel wajib ketika data hanya tersedia mulai 25 piksel, dan arti ambang 6,25 ha. FMN menjawab pada baris 231?233. Ini bukan bukti otomatis bahwa PLAN keliru; penemuan DEV merupakan fungsi review yang berguna. Tetapi kasus ini menunjukkan frasa tabel sensitivitas lengkap perlu menyatakan dimensi kelengkapan dan keterbatasan masukan, bukan hanya diulang lebih sering.

6. **Penggabungan AC/test mempunyai dasar nyata, dengan pemetaan yang tidak dipaksakan.** PLAN v5.4 memiliki 14 AC (134?147) dan 14 TC (133?146), setiap TC merujuk satu AC. Banyak metode/hasil di dua tabel berdekatan maknanya; satu matriks hasil wajib?metode?bukti dapat memudahkan review. PLAN v5.3 berbeda: enam AC dilayani empat TC, termasuk uji unit lintas fungsi. Struktur baru harus mendukung satu AC dengan beberapa uji dan satu uji yang mendukung beberapa AC. Jangan menghilangkan pengujian teknis yang tidak berpasangan satu-satu dengan AC.

7. **Pemendekan boilerplate bisa menggeser kepadatan ke tabel.** PLAN v5.4 sudah mengurangi petunjuk dibanding PLAN v5.3, tetapi tabel Isi minimum laporan keputusan DEV (99?114) memuat banyak kewajiban bersyarat dalam tiap sel. Contohnya N/kapasitas, QA penafsir, kesepadanan sumber, dan split. Substansi ilmiah ini banyak yang memang perlu. Rekomendasi bukan menghapusnya, melainkan memisahkan hasil wajib, metode yang bebas dipilih DEV, keputusan Director yang masih tertunda, dan lampiran bukti ilmiah. Jumlah baris lebih sedikit tidak selalu berarti lebih mudah dibaca.

8. **Status dokumen dan kebersihan isi perlu dibedakan.** progress-v6.json menyebut EXEC v5.3 LOCKED, sedangkan file sekarang masih memuat tabel placeholder pada baris 491, 504, 517?518. FMN Notes baris 473 sebelumnya meminta placeholder diganti dengan pernyataan tidak ada observasi/permintaan. Ini ketidaksesuaian yang terverifikasi pada snapshot saat ini. Belum ditelusuri kapan placeholder berada di sana, siapa yang menyunting, atau apakah validator lock pernah menerima versi yang sama; karena itu belum dinyatakan sebagai bug gate tertentu. Bagian yang tidak berlaku sebaiknya berisi pernyataan singkat, tanpa tabel contoh aktif. Pada EXEC v5.1 baris 830, jawaban proyek masuk ke dalam kalimat petunjuk template dan baris 832 masih berupa placeholder; contoh tambahan pencampuran petunjuk dengan isi.

9. **Ringkasan terkini dan riwayat perlu mudah dibedakan.** EXEC v5.1 mempunyai pembaruan pasca-build bertanggal di tengah walkthrough. Hal ini menjaga bukti lintas sesi, tetapi membuat pembaca perlu menentukan hasil mana yang menggantikan informasi sebelumnya. Bagian Open Risks / Next Actions pada akhir masih berisi langkah menuju lock, sedangkan snapshot runtime sekarang sudah LOCKED. Itu dapat merupakan rekaman historis yang sah; jangan diam-diam menulis ulang dokumen terkunci. Untuk dokumen baru, waktu/status saat ringkasan dibuat dan pembedaan hasil terakhir dari riwayat pembaruan akan membantu pembaca.

### Hal yang harus dipertahankan

- Keterlacakan INTENT ? PLAN ? EXEC dan ID tugas/AC/TC.
- Review pra-build FMN yang benar-benar menyelesaikan tiga klarifikasi pada pasangan v5.3.
- Review pasca-build yang memetakan AC/TC ke bukti, bukan hanya verdict tanpa alasan.
- Pembedaan kesesuaian terhadap PL2024 dari akurasi, ketidakcocokan dari kesalahan label yang terbukti, dan kandidat sampel dari label interpretasi final.
- Ambang 10/25/100 piksel dan 6,25 ha, serta keterbatasan data komposisi pada 10 piksel.
- Bukti checksum/himpunan berkas, rekonsiliasi angka, batas interpretasi, dan deviasi yang diakui.
- Keputusan yang belum selesai pada PLAN v5.4: sertifikasi/kesesuaian sumber, target/N/kapasitas/QA, serta kunci/mapping. Posisi DRAFT dan dependensi terbuka tidak boleh disamarkan menjadi kesiapan implementasi.

### Batas verifikasi

Angka hasil run, jumlah test lulus, dan kualitas model di EXEC diperlakukan sebagai hasil yang dicatat artefak; skrip, data geospasial, log test, dan produk aplikasi belum diaudit atau dijalankan ulang. Pembacaan ini menilai pola dokumen, bukan mensertifikasi hasil teknis atau menyimpulkan seluruh proyek gagal.

PLAN v5.4 menyebut UNCERTIFIED_EDIT pada INTENT v6. Pemeriksaan read-only tambahan menemukan SHA-256 file INTENT saat ini berbeda dari certified_doc_sha256 di progress-v6.json. Ini menguatkan adanya perbedaan terhadap snapshot sertifikasi yang tercatat, tetapi bukan pemeriksaan lengkap mekanisme effective intent/amendment. Tidak ada upaya memperbaiki sertifikasi atau mengaktifkan chain.

### Rekomendasi pilot - belum otorisasi perubahan

Pasangan PLAN/EXEC v5.3 merupakan calon pilot yang baik: scope terbatas, ada hasil tercatat, dan terdapat klarifikasi nyata yang dapat dipakai menguji apakah struktur baru lebih jelas. Gunakan salinan konseptual untuk desain setelah otorisasi yang sesuai; jangan menulis ulang artefak LOCKED proyek. PLAN v5.4 dapat menjadi pembanding kontrak ilmiah kompleks, tanpa menganggap dependensi sumbernya sudah selesai.

Struktur yang direkomendasikan: keputusan dan status di awal; hasil serta batas pekerjaan; prasyarat/keputusan terbuka; kontrak penerimaan dan bukti; cara kerja serta kebebasan teknis; checkpoint/review yang relevan; detail/riwayat sebagai bagian lanjutan. Ini usulan diskusi, bukan struktur final yang sudah disepakati.

Penilaian asisten: kesulitan review Director mempunyai dasar konkret pada sampel proyek nyata. Masalahnya meliputi campuran fungsi, pengulangan, istilah/bahasa, kepadatan tabel, dan penandaan status/riwayat. Pemendekan saja tidak cukup. Hanya dokumen diskusi ini yang diperbarui; proyek KLHK, source/rules/template Sigma, konfigurasi, dan Git tidak diubah.


## Rekomendasi asisten untuk review Director - Penyederhanaan dokumen Sigma

Status: USULAN ASISTEN, belum menjadi keputusan Director atau otorisasi implementasi. Bagian ini merangkum rekomendasi sebelumnya menjadi bahan review, berdasarkan pembacaan dokumen desain 28 September dan sampel artefak proyek KLHK. Otorisasi saat ini hanya untuk pencatatan dalam dokumen diskusi ini.

### 1. Jadikan kemampuan Director meninjau kontrak sebagai sasaran utama

Dokumen dianggap berhasil bila Director dapat menjelaskan hasil yang dijanjikan, batas pekerjaan, ukuran selesai, risiko material, dan keputusan yang masih diperlukan. Jumlah baris, jumlah section, atau batas lima kalimat tidak dijadikan ukuran utama. AI juga harus menafsirkan unsur tersebut secara konsisten.

Prioritas awal: ringkasan keputusan di atas, bahasa sesuai konfigurasi proyek, hasil dan larangan jelas, serta pemisahan keputusan final dari usulan atau asumsi. Istilah teknis yang diperlukan tetap dipakai dengan penjelasan singkat; ID dan nama status formal dipertahankan.

### 2. Pisahkan fungsi setiap kelompok dokumen

| Kelompok | Fungsi yang direkomendasikan |
| :--- | :--- |
| Artefak INTENT/PLAN/EXEC/CLOSE | Tujuan, kontrak, keputusan, hasil dan bukti khusus proyek. |
| Role rules | Kewenangan, kewajiban, pemicu tindakan dan eskalasi role. |
| Protocol | Definisi formal dan hubungan mekanisme Sigma. |
| Constitution | Prinsip inti dan batas otoritas. |
| Skill/bridge | Panduan masuk dan urutan kerja yang merujuk aturan otoritatif. |
| Memory | Pengingat singkat yang mempunyai rujukan sumber; tidak menciptakan kewajiban baru. |

Petunjuk pengisian, contoh generik, dan doktrin panjang dikeluarkan dari isi artefak proyek yang sudah diisi. Cara penyediaan panduan penulisan bagi AI perlu dirancang agar tetap mudah ditemukan saat drafting. Satu sumber otoritatif per aturan tidak mengharuskan seluruh aturan berada dalam satu file besar.

### 3. Gunakan struktur yang memudahkan pembacaan berurutan

Usulan struktur berikut bersifat awal; susunan final ditentukan setelah pilot.

| Artefak | Urutan substansi yang disarankan |
| :--- | :--- |
| INTENT | Ringkasan tujuan dan keputusan; hasil yang diinginkan; lingkup termasuk/tidak termasuk; kriteria sukses dan mutu; batas tetap versus pilihan metode; risiko/asumsi; arahan untuk FMN dan rujukan pendukung. |
| PLAN | Ringkasan pekerjaan dan status kesiapan; hasil serta batas pekerjaan; prasyarat/keputusan terbuka; tugas dan kebebasan metode; kriteria penerimaan beserta metode/bukti pengujian; risiko dan handoff. |
| EXEC | Ringkasan hasil pada waktu pelaporan; acuan PLAN; penilaian/rencana DEV; checkpoint FMN pra-build; realisasi dan deviasi; hasil verifikasi; checkpoint FMN pasca-build; keterbatasan dan tindak lanjut; riwayat/bukti rinci. |

Angka, ambang, larangan, serta ketidakpastian yang memengaruhi persetujuan tetap muncul dalam kontrak utama. Detail pendukung yang panjang dapat ditempatkan pada bagian lanjutan dengan rujukan yang jelas. Ringkasan tidak menggantikan kontrak atau menjadi satu-satunya bagian yang diharapkan dibaca Director.

### 4. Kurangi pengulangan tanpa menghilangkan keterlacakan

Tetapkan definisi lengkap setiap batas/kewajiban pada satu tempat. Tugas, pemeriksaan dan handoff merujuknya melalui ID atau rujukan bagian. Pengulangan singkat diperbolehkan bila membantu pembaca memahami risiko atau keputusan, tetapi tidak menjadi definisi alternatif yang harus dipelihara terpisah.

Untuk PLAN, gabungkan penyajian AC dan test contract sejauh memperjelas hasil wajib, metode pemeriksaan, hasil yang diterima dan bukti. Pertahankan relasi fleksibel: satu AC dapat memerlukan beberapa pengujian; satu pengujian dapat mendukung beberapa AC. Uji teknis tambahan tetap dapat dicatat secara terpisah jika lebih jelas.

### 5. Nyatakan kelengkapan dan keputusan terbuka secara konkret

Kata lengkap, layak, valid, siap dan sesuai harus menunjuk objek, cakupan, ukuran atau bukti yang bisa diperiksa. Contoh pilot KLHK: kelengkapan sensitivitas perlu membedakan total klaster pada 10/25/100 piksel dari komposisi klaster yang hanya tersedia mulai 25 piksel, serta ambang tambahan 6,25 ha.

Pisahkan tiga hal dalam kontrak: hasil yang wajib, metode yang bebas dipilih DEV, dan keputusan Director yang belum tersedia. Ketidaktersediaan data atau kapasitas diberi konsekuensi yang jelas. Pertanyaan baru dari DEV tetap dapat muncul setelah review awal; struktur tidak boleh mengklaim bahwa semua ketidakpastian dapat dihapus sebelum implementasi.

### 6. Bersihkan bagian tidak berlaku dan tandai waktu pelaporan

Bagian yang tidak berlaku cukup berisi status singkat beserta alasan bila diperlukan. Hindari tabel contoh aktif atau placeholder dalam artefak yang dinyatakan siap ditinjau.

Ringkasan EXEC diberi konteks waktu dan tahap pelaporan. Pembaruan lintas sesi harus menunjukkan hasil mana yang menggantikan informasi sebelumnya, sambil mempertahankan riwayat yang diperlukan. Dokumen historis LOCKED tidak ditulis ulang hanya untuk menyesuaikan gaya atau status terkini; aturan penyajian baru perlu menghormati batas edit setiap artefak.

### 7. Uji penyederhanaan melalui contoh nyata sebelum perubahan menyeluruh

Pasangan PLAN/EXEC v5.3 KLHK direkomendasikan sebagai pilot awal karena pekerjaan terbatas dan ada tiga klarifikasi nyata. PLAN v5.4 menjadi pembanding pekerjaan ilmiah yang lebih kompleks; dependensi sumber dan keputusan terbukanya tetap dipertahankan sebagai belum selesai.

Pilot menilai apakah Director dan AI dapat menjawab pertanyaan yang sama tentang hasil, batas, bukti selesai, kewenangan dan keputusan terbuka. Periksa pula apakah klarifikasi tentang rasterisasi, cakupan 10 piksel dan 6,25 ha dapat ditangani lebih jelas. Gunakan peta makna untuk memastikan setiap kewajiban penting masih tersedia setelah digabung atau dipindahkan.

Tidak ada salinan pilot, template baru, atau perubahan artefak KLHK yang dibuat pada sesi pencatatan ini.

### 8. Pisahkan keputusan perubahan yang berbeda

Keterbacaan dokumen, lifecycle APPROVED/LOCKED, revisi kontrak, penyelarasan penomoran, rename artefak, penghapusan HUMAN, mailbox per intent dan command note mempunyai tujuan serta dampak berbeda. Masing-masing perlu dinilai tersendiri agar manfaat penyederhanaan bisa diuji dan kompatibilitasnya jelas.

Cakupan evaluasi dokumen tetap menyeluruh: template, rules, protocol, constitution, memory, skill/bridge, serta orientasi/help yang memengaruhi pemahaman AI. Arsip historis menjadi sumber bukti; evaluasi menyeluruh tidak otomatis berarti seluruh arsip ditulis ulang.

### Urutan prioritas yang direkomendasikan

1. Sepakati sasaran keterbacaan dan unsur kontrak yang wajib dipertahankan.
2. Evaluasi contoh PLAN/EXEC sederhana dan kompleks untuk menyusun struktur pilot.
3. Periksa kesesuaian makna, keterlacakan dan pemahaman Director/role pada pilot.
4. Susun pembagian aturan otoritatif dan selaraskan rules, memory, skill/bridge serta orientasi.
5. Bahas perubahan lifecycle, penomoran dan fitur lain berikut kompatibilitasnya sebagai keputusan tersendiri.

Catatan review: rekomendasi ini tidak mengubah keputusan Director yang telah diberikan mengenai mailbox per intent, penomoran chain baru, atau warning kompatibilitas. Bagian ini dapat diterima, ditolak, atau disesuaikan per butir oleh Director. Belum ada implementasi yang dilakukan.

## Pembelajaran dokumen audit UX Sigma - 2026-09-27

Status: ringkasan pembelajaran asisten dan verifikasi terbatas pada source saat ini. Bukan keputusan Director, bukan otorisasi implementasi. Sumber: Discussion/Evaluation-06102026/2026-09-27_audit-sigma-ux-dan-evaluasi-pengembangan.md.

### Isi dan posisi dokumen

Audit bertanggal 2026-09-27, berbasis commit d4555a3, bersifat advisory. Tiga keluhan utama: K1 penggunaan melelahkan, K2 penyusunan dokumen lama, K3 dokumen meleset dari intent tetapi sudah terkunci sehingga koreksi mahal. Auditor membedakan fakta source, inferensi, laporan Director, dan rekomendasi; tidak mengamati sesi proyek nyata. Test 487/49 file merupakan laporan pada snapshot tersebut, tidak dijalankan ulang pada pembacaan ini.

Tesis audit: review yang berat dapat mengurangi ketelitian Director; validasi struktur tidak menjamin kesesuaian makna; penguncian mempermahal salah paham yang baru ditemukan di hilir. Hubungan sebab-akibat dan bobot masing-masing faktor masih inferensi, bukan hasil pengukuran lapangan. Kelulusan test pada snapshot tidak membuktikan seluruh repo bebas bug atau bahwa masalah hanya di desain interaksi.

Tiga prinsip yang diajukan: konvergensi makna sebelum elaborasi penuh; persetujuan terikat pada isi yang disetujui; biaya koreksi sebanding dengan besar koreksi.

### Inventaris sepuluh rekomendasi audit

| ID | Usulan | Sasaran |
| :--- | :--- | :--- |
| R1 | Intent Brief dan pernyataan ulang pemahaman ARC sebelum draft penuh | Tangkap salah paham tujuan, batas scope dan asumsi lebih awal. |
| R2 | Pembuatan versi baru dari artefak lama serta diff | Koreksi terarah tanpa menulis ulang seluruh dokumen. |
| R3 | Lock Review Card sebelum ratify/lock | Director mengetahui komitmen, pengecualian, asumsi dan perubahan yang disetujui. |
| R4 | Profil Lite/Full dan pengisian progresif | Proporsionalitas dokumen terhadap pekerjaan; usulan Lite juga mengubah gate. |
| R5 | Audit pack dan audit record | Kurangi logistik antar-role/vendor dengan paket bukti dan rekaman verdict. |
| R6 | Approval Queue | Satukan keputusan yang menunggu Director. |
| R7 | Periodic Intent Checkpoint | Deteksi penyimpangan sebelum closure. |
| R8 | Pisahkan batas debat dari iterasi klarifikasi | Hindari tekanan menyudahi pemahaman karena batas dua revisi. |
| R9 | Metrik siklus dari operations.jsonl | Ukur waktu siklus, supersede dan putaran audit. |
| R10 | Higiene rujukan dan sumber skill | Kurangi drift doktrin; dist merupakan opsi distribusi tersendiri. |

Dokumen memuat enam pertanyaan keputusan D1-D6. Itu permintaan keputusan dari auditor, bukan keputusan yang sudah diberikan Director. Bagian urutan Hermes tidak menjadi scope sesi ini.

### Verifikasi terbatas terhadap main saat ini

HEAD yang diperiksa: f707085 pada main. Perbedaan terhadap snapshot audit harus dibawa ke evaluasi lanjutan.

1. Validasi ratify tetap berbasis struktur/checklist/verdict/Quality Bar. src/services/intentRatifyService.ts memanggil validateSigmaDocFile dan ensureSigmaDocEligible lalu mencertifikasi file. Tidak ada pembuktian otomatis bahwa Director telah memahami makna dokumen pada jalur tersebut.
2. Humanize INTENT tetap mensyaratkan RATIFIED (src/services/intentHumanizeService.ts). Ringkasan Director PLAN tetap di section 10 pada bagian akhir template; FMN-RULE juga mengatur pengisiannya menjelang lock.
3. Jalur intent new dan plan new yang diperiksa tetap menggunakan template (src/services/intentDraftService.ts dan planDraftService.ts). Opsi --from/--clone belum tersedia pada deklarasi kedua command tersebut. Hal ini adalah keterbatasan fitur pembuatan artefak, bukan larangan AI menggunakan versi lama sebagai referensi revisi draft baru.
4. Batas dua revisi per section masih tertulis pada Common Role Doctrine ARC-RULE dan FMN-RULE.
5. Pernyataan umum audit bahwa persetujuan belum terikat pada isi perlu diperbarui: alur MCP control sudah menyediakan prepare, approval melalui CLI lokal, dan commit. Ticket intent ratify mengikat artifact/version/hash serta state revision; ApprovalRecord membawa identitas target tersebut, dan commit memeriksa kecocokan dengan file/status terkini. Rujukan: src/commands/control.ts; src/mcp/control/tools/prepareIntentRatify.ts dan commitIntentRatify.ts. Ini fondasi persetujuan tersimpan untuk alur MCP, belum otomatis sama dengan Approval Queue lengkap atau kartu review makna. Jangan menganggap semua jalur CLI memakai mekanisme yang sama.
6. Urutan state INTENT yang mencantumkan INACTIVE tidak sesuai tipe saat ini: src/engine/chain.ts mendefinisikan DRAFT, RATIFIED, SUPERSEDED; aktivasi chain diatur terpisah.
7. Deskripsi opsi title/focus intent new masih merujuk Sigma/design/intent-history.md, sementara service menempatkan artefak di Sigma/charter. Drift help ini masih terlihat.

### Kaitan dengan diskusi dan rekomendasi asisten

Audit ini membahas alur memahami, menyetujui dan mengoreksi pekerjaan; dokumen keputusan desain sebelumnya lebih banyak membahas struktur artefak dan perubahan lifecycle. Sampel KLHK memberi bukti tambahan tentang pengulangan, ringkasan di akhir, placeholder dan pertanyaan makna yang masih muncul pada PLAN panjang, tetapi tidak mengukur frekuensi atau durasi keluhan K1-K3.

R1 dan R3 dibahas bersama penyederhanaan artefak yang direkomendasikan sebelumnya. Sebelum elaborasi INTENT penuh, ARC menyampaikan ulang pemahamannya, asumsi dan contoh batas scope agar Director dapat mengoreksi salah paham lebih awal. Kesepahaman yang diterima Director: brief menjadi section awal di dalam INTENT dan wajib terisi sebelum ratify, tanpa artefak atau persetujuan terpisah; jumlah tetap 3 contoh termasuk dan 3 tidak termasuk diuji saat pilot, bukan dikunci sekarang. Hash harus mengikat sumber yang disetujui dan hubungan kartu ke sumber, bukan hanya ringkasan yang dapat tetap sama ketika detail kontrak berubah. Perubahan sumber setelah review harus ditampilkan untuk dinilai kembali; persetujuan versi sebelumnya tidak otomatis mencakup perubahan itu.

Penegasan hasil check: tampilkan kelayakan struktur/persyaratan administratif secara terpisah dari persetujuan makna. Label Eligible tidak boleh menyiratkan bahwa tujuan, scope dan kriteria keberhasilan telah sesuai maksud Director. Mekanisme persetujuan tersimpan pada MCP menjadi fondasi yang sudah tersedia, dengan batas kemampuan sebagaimana verifikasi di atas.

R2 memerlukan reset identitas, referensi chain/version, status, certification, verdict/checklist dan klaim bukti sesuai konteks; menyalin isi bukan menyalin keabsahan lama. Audit delta perlu memeriksa dampak pada keseluruhan kontrak. Estimasi rendah dan 1-2 hari dalam audit belum diverifikasi.

R4 bukan sekadar pemendekan dokumen: pengecualian ROADMAP/gate mengubah governance dan harus menjadi keputusan terpisah. Rekomendasi asisten: tunda profil yang melewati gate, penambahan status sementara, serta checkpoint wajib setiap lima PLAN sampai kebutuhan dan konsekuensinya diuji. R7 perlu mempertimbangkan perubahan tujuan/scope atau temuan besar selain angka jumlah plan. R9 harus membedakan waktu kalender dari waktu kerja dan menilai kelengkapan log sebelum menjadikannya ukuran kecepatan.

R8 mendukung pemisahan klarifikasi dari debat yang sudah dicatat sebagai D-19 pada pembacaan sumber 28 September. Rekomendasi asisten: pertahankan kewenangan Director menentukan kecukupan pembahasan; ketika klarifikasi dihentikan, AI tetap mencatat ketidakjelasan yang tersisa dan tidak menyajikannya sebagai kepastian.

R5 dan R6 direkomendasikan untuk mengurangi logistik operasi inti Sigma setelah alur review membaik. Paket audit menunjukkan target dan versi, bukti yang disertakan, serta respons asli AUD; pencatatan terstruktur tidak mengubah isi verdict. Daftar keputusan tertunda mengikuti konteks intent aktif dan menyediakan akses riwayat eksplisit, selaras dengan Temuan 01. Kedua usulan dinilai dari manfaat operasional Sigma, tanpa ketergantungan Hermes.

Penegasan prioritas fitur audit ini, mengikuti pilot keterbacaan yang sudah direkomendasikan: perbaikan review/klarifikasi, lalu revisi terarah beserta diff, kemudian fasilitas audit dan keputusan tertunda. Perbaikan mailbox dan kompatibilitas penomoran tetap menjadi kebutuhan tersendiri; urutan ini tidak menunda atau mengubah arahan Director tersebut.

Belum ada implementasi, perubahan rule/template, pembuatan artefak pilot, atau perubahan Git. Catatan ini hanya pada dokumen diskusi yang telah diotorisasi.

## Kasus AUD KLHK - EVALUASI-SIGMA.md

Sumber dibaca penuh: EVALUASI-SIGMA.md, disusun AUD pada 6 Oktober 2026 dari siklus kerja 5-6 Oktober. Dokumen bukan artefak governance. Pengalaman kebuntuan Director/FMN/AUD diterima sebagai laporan kasus; klaim tentang aturan diperiksa terpisah. Catatan berikut hanya menambah bukti atau koreksi yang belum tercakup dalam bagian sebelumnya.

### Fakta baru dan koreksi terhadap diagnosis AUD

1. **Drift aturan master terhadap proyek terverifikasi.** Master Sigma/rules/AUD-RULE.md:488-515 sudah mewajibkan pemeriksaan ketepatan tag pada audit INTENT dalam Critic Mode, termasuk Sovereign yang terlalu kuat dan Operationalization yang terlalu lemah. Bagian tersebut juga tersedia pada commit d4555a3. Salinan KLHK tidak mempunyai bagian itu: setelah DIR-INTENT Review Focus langsung masuk FMN-PLAN Audit. SHA-256 master 21443ac8efbccffc1e06f29f352ae59e25fa9ecb84a4037963f3b85ab1b36eaa, KLHK 5339724f1906bcfd464a9585f405daf6913a8c7f5e6280680800cde02e1f2591. Karena itu K9 bukan bukti bahwa inti Sigma sama sekali belum mengatur pemeriksaan tier. Yang terbukti adalah aturan berbeda antar salinan; sebab dan waktu drift belum ditelusuri.
2. **Memory tidak menunjukkan perbedaan tersebut.** Sigma/role-memory/aud-memory.json master dan KLHK identik, SHA-256 5761d51ddc5bd666e79d817099ed6ae3dc04a3e9c9e56318b405e9f303973c9c. source_rule_version masih unversioned dan tidak memuat pemeriksaan item-tier. setup/targets/codex/aud/SKILL.md:86-95 menyebut memory dan active role rules, tetapi langkah aktivasi tidak secara eksplisit memuat pembacaan rule sebelum menunggu paket audit. Ini celah penyampaian yang perlu dievaluasi; belum membuktikan instruksi mana yang benar-benar termuat pada sesi historis AUD.
3. **Kebijakan isolasi bukan larangan mutlak menilai referensi sumber.** AUD-RULE master dan KLHK:109-134 membolehkan mengidentifikasi ambiguitas, kontradiksi atau missing intent pada Director Reference. Akses berkas tetap harus berada dalam paket/otorisasi Director. Usulan potongan INTENT sebagai evidence package standar relevan untuk mengurangi logistik; pernyataan bahwa AUD tidak pernah dapat meninjau kembali tier sumber terlalu absolut.
4. **Alasan tier pada batas scope memang perlu diuji.** KLHK INTENT v5:296-297 memakai alasan lingkup/perutean untuk OS-002/OS-003 bertag Sovereign; v6:265 memakai Operationalization untuk penundaan OS-001. Ini bukti risiko ketidakkonsistenan, belum bukti final bahwa seluruh tag itu salah. Sovereign mencakup tujuan dan keluaran inti, bukan hanya nilai moral. Batas tanggung jawab yang sengaja ditetapkan Director dapat menjadi bagian tujuan; penundaan metode sementara berbeda. Penentuan salah klasifikasi memerlukan acuan keputusan Director saat ratifikasi, bukan hanya kalimat alasan. Tag Sovereign tidak berarti larangan global selamanya: perubahan intent tetap tersedia dan batas berlaku pada sumber yang bersangkutan.
5. **Dukungan referensi tidak sama dengan kewenangan pekerjaan.** PLAN v5.4:12 memang mengutip tujuh ID. INTENT v6 REQ-002 memuat batas sebelas kelas; SC-005/REQ-003 memuat traceability yang dapat mendukung kendali plan. Jadi klaim enam ID sama sekali tidak menopang pekerjaan terlalu kuat. Namun dukungan batas/mutu tersebut tidak otomatis mengotorisasi pembangkitan kandidat dan tidak membatalkan OS-002. Pemeriksaan referensi perlu menampilkan fungsi setiap ID: dasar hasil, batas, mutu, atau masukan; sekadar ID ada bukan bukti alignment semantik.
6. **RATIFIED, sertifikasi isi dan kesiapan scope merupakan dimensi berbeda.** PLAN v5.4 sudah mengakuinya pada prasyarat dan TC-134. Usulan SCOPE_GAP/PENDING_ALIGNMENT dapat menjadi penilaian kesiapan terhadap pekerjaan tertentu, terpisah dari status artefak RATIFIED. Jangan mengganti lifecycle hanya untuk menyatakan sumber belum cocok. Perbedaan hash v6 serta sejarah AMD-002 v5:669 menguatkan kasus sertifikasi yang sudah dicatat, tanpa membuktikan siapa penyuntingnya atau seluruh delta historis.
7. **Rangkaian amendment mempunyai risiko urutan langkah.** src/services/intentAmendmentService.ts:69-72 merender history lalu mencertifikasi file saat itu. AMD-002 v5 mencatat edit isi dilakukan setelah AMD-001 direkam. Snapshot dan diff membantu diagnosis; perbaikan juga perlu mengikat edit yang telah direview dengan pencatatan/sertifikasinya. Recertify tidak boleh sekadar menerima seluruh isi terkini atau membersihkan warning tanpa klasifikasi perubahan dan otorisasi yang sesuai. Sertifikasi baru tidak berlaku retroaktif.
8. **Dua usulan memperluas perubahan lebih jauh dari kebutuhan kasus.** Continuation tidak dapat mewarisi kewenangan baru dari EXEC LOCKED: bukti pekerjaan lama bukan perluasan scope. PLAN baru dalam chain yang ada juga tidak selalu membutuhkan INTENT baru dan CLOSE tersendiri; diagnosis biaya tidak boleh mengasumsikan satu siklus penuh untuk setiap inkremen. Handoff peran satu sesi memerlukan desain independensi audit; larangan mengedit artefak sebelumnya saja belum mencegah model mengaudit hasil sendiri atau membawa asumsi sesi sebelumnya.
9. **Usulan mailbox berbeda dari arahan sesi.** K7 mengusulkan menghapus send gate atau menjadi warning. Arahan Director pada Temuan 01 tetap mempertahankan gate unread dalam intent yang sama. Kasus FYI v4.4 terhadap audit v4.5 juga menunjukkan potensi friksi antar-minor dalam intent yang sama; filter major tidak otomatis menyelesaikannya. Detail itu merupakan pertanyaan desain tersendiri, bukan alasan mengubah arahan Director yang sudah dicatat.

### Implikasi tambahan untuk prioritas evaluasi

Periksa konsistensi versi rules proyek, master, skill dan memory sebelum menambah kewajiban yang mungkin sudah tersedia. Gunakan identitas revisi/hash sumber aturan yang dapat ditinjau; jangan menyamakan unversioned dengan sinkron. Pembaruan proyek tetap harus mempertahankan perubahan lokal dan kompatibilitas, bukan overwrite otomatis.

Pada paket review PLAN, tampilkan teks/tier sumber yang dikutip beserta peran dukungannya, lalu nilai kesiapan scope secara terpisah dari status dan sertifikasi. Pengujian otomatis dapat memeriksa keberadaan ID serta kelengkapan alasan, tetapi tidak membuktikan ketepatan klasifikasi hanya dengan alasan tidak kosong atau pencocokan kata. Audit klasifikasi yang terstruktur perlu mengacu pada tujuan Director dan membandingkan item sejenis.

Tier ketiga Boundary, continuation dan handoff peran belum direkomendasikan sebagai perbaikan pertama. Dahulukan kegagalan penyampaian aturan, keterlihatan sumber dan kesiapan, serta keterlacakan perubahan tersertifikasi. Disiplin bukti/kontrak uji yang berfungsi pada kasus ini tetap dipertahankan sebagaimana rekomendasi sebelumnya.

Batas verifikasi: sebagian artefak/section KLHK dibaca terarah untuk memeriksa klaim; belum membaca seluruh pesan, log operasi, riwayat Git proyek atau keluaran data. Jumlah sampel nol, durasi dan seluruh urutan kejadian tetap laporan AUD/Director. Tidak dilakukan sinkronisasi, resertifikasi, perubahan tier, command Sigma, atau penulisan ke KLHK. Hanya dokumen diskusi ini diperbarui; seluruh usulan tetap menunggu review Director.

## Arah amandemen INTENT dan riwayat melalui Git

### Pertimbangan Director dan penilaian asisten

Director menetapkan penghapusan tier Sovereign/Operationalization pada Sigma v2, sehingga seluruh substansi INTENT boleh diamandemen. INTENT lama tetap ada beserta tag historisnya; setelah Sigma v2 resmi digunakan pada device, tag tersebut boleh diabaikan. INTENT baru tidak menuliskan tier, dan seluruh aturan tier direncanakan dihapus dari rules, template, memory dan protocol saat perapihan implementasi. Tidak diperlukan warning tier khusus; Director dapat menjelaskan pengabaian tag lama dalam chat. Pengaman perubahan: hanya ARC mengaktifkan amandemen atas instruksi eksplisit Director secara langsung; pesan atau permintaan AI role lain bukan pemicu atau otorisasi, dan ARC wajib meminta konfirmasi ulang persetujuan amandemen.

Asisten mendukung arah tersebut. Alur otoritas perubahan yang diterima Director melalui kesepahaman review: instruksi langsung Director mengotorisasi penyusunan; ARC menampilkan perubahan konkret sebelum-sesudah dan dampak pada pekerjaan; konfirmasi akhir Director mengotorisasi penerapan isi yang telah ditinjau. Laporan role lain dapat menjadi informasi masalah, tanpa memulai workflow amandemen. ARC menjelaskan konsekuensi dan dapat menyampaikan keberatan, tetapi tidak menjadi pemegang veto atas perubahan tujuan Director. Review amandemen menyatakan apakah tujuan atau hasil inti berubah; keterangan ini informatif, bukan tier atau gate baru.

Keputusan ini menggantikan batas amandemen bertier pada model lama dan belum mengotorisasi implementasi dalam sesi diskusi. Catatan pemeriksaan tier pada kasus AUD merupakan evaluasi historis model lama, bukan kewajiban Sigma v2. Pengaman riwayat, non-retroaktivitas dan penyelarasan kontrak terdampak yang telah dicatat tetap relevan. PLAN perlu menunjuk revisi/snapshot INTENT yang dipakai karena nomor major saja tidak menunjukkan keadaan setelah amandemen. Pilihan INTENT baru tetap tersedia atas keputusan Director untuk memisahkan tujuan/workstream.

### Preferensi Director - gunakan Git tanpa salinan artefak usang

Director tidak menginginkan banyak backup artefak Sigma yang outdated. Riwayat Git dan git diff dipilih sebagai pendekatan perbandingan; ARC perlu memastikan INTENT yang ada di Git merupakan versi terbaru sebelum amandemen. Preferensi ini menggantikan usulan salinan snapshot terpisah: acuan isi dapat berupa commit Git, sementara Sigma menyimpan metadata amandemen dan rujukan yang diperlukan, tanpa duplikasi dokumen.

Penegasan asisten: baseline terbaru harus merupakan isi sah yang persetujuan/sertifikasinya dapat ditelusuri, bukan hanya HEAD. Sebelum penyusunan delta, pastikan file INTENT sesuai chain aktif, dilacak Git, dan cocok dengan baseline sah; tetapkan commit acuan. Perubahan INTENT yang belum tercatat atau belum disahkan dijelaskan terlebih dahulu agar tidak ikut terbawa. Pemeriksaan terarah pada INTENT; perubahan berkas pekerjaan lain tidak otomatis menghalangi amandemen. Rancangan atau sumber yang berubah setelah review memerlukan pembaruan persetujuan.

### Kesepahaman riwayat Git dan tag - diterima Director

Director menerima rekomendasi bersama Codex dan Claude pada 6 Oktober 2026 untuk rancangan berikut; penerimaan desain tidak mengotorisasi perubahan kode atau Git dalam sesi diskusi.

- Git lokal menjadi prasyarat alur amandemen berbasis Git; penggunaan Sigma lainnya tetap sah tanpa Git, sesuai prepareLocalGit pada src/commands/project.ts:119-146.
- Baseline ratifikasi dan setiap hasil amandemen yang disahkan tersedia sebagai commit dengan tag Git lokal, tanpa backup dokumen terpisah; contoh sigma/intent-v2-amd-003 menunjuk hasil amandemen ketiga, sedangkan baseline sebelumnya tetap tersedia.
- Tag dibuat terhadap commit eksplisit yang memuat isi INTENT final yang telah ditinjau dan disahkan; tag pada HEAD tidak menyimpan edit yang belum masuk commit, dan perubahan isi setelah review memerlukan review/persetujuan yang diperbarui.
- Metadata Sigma mengikat chain, ID amandemen, baseline sebelum perubahan, commit/tag hasil dan SHA-256 isi tersertifikasi; hash membuktikan kecocokan tetapi tidak menyimpan isi lama.
- Sigma tidak memindahkan atau menimpa tag yang sudah dicatat; tag mempertahankan objek commit dari pembersihan Git selama referensinya tersedia, tanpa membuat tag kebal terhadap penghapusan manual.
- Director menetapkan push ke remote dilakukan sendiri; Sigma tidak melakukan push otomatis. Distribusi tag tetap perlu dicakup dalam workflow manual Director karena push branch biasa tidak otomatis mengirim semua tag. Director menerima commit lokal atas arahan eksplisitnya, dengan pelaksanaan dapat dibantu AI; Sigma memverifikasi acuan dan membuat tag, tanpa commit otomatis.
- Alur saat ini pada src/services/intentAmendmentService.ts belum membuat commit/tag; rancangan harus menangani kegagalan pencatatan, sertifikasi, commit dan tag agar tidak melaporkan amandemen selesai dengan acuan yang belum tersedia.

Verifikasi read-only mengacu pada [Git GC](https://git-scm.com/docs/git-gc#_notes), [Git Tag](https://git-scm.com/docs/git-tag) dan [Git Push](https://git-scm.com/docs/git-push); belum dilakukan uji pembuatan tag, rewrite history atau recovery.

### Keputusan commit lokal - diterima Director

Director menerima commit lokal atas arahannya dengan pelaksanaan dapat dibantu AI; pemilihan berkas dan waktu pencatatan tetap berada dalam kendali Director, terutama ketika working tree memuat pekerjaan lain. Manual tidak mengharuskan Director mengetik perintah Git sendiri. Sigma dapat menampilkan berkas/diff yang diperlukan, memeriksa commit baseline dan commit hasil terhadap isi yang disahkan, serta membuat tag lokal tanpa melakukan stage/commit otomatis atau push.

Penyelesaian alur amandemen perlu menunggu commit hasil yang sesuai dan tag tersedia; jika commit belum dibuat atau isinya tidak cocok, Sigma melaporkan langkah yang belum selesai, bukan menerima HEAD secara sembarang. Urutan persetujuan, pencatatan dan sertifikasi akhir tetap harus dirancang konsisten pada implementasi.

### Verifikasi gitignore - read-only

- Source saat ini tidak menunjukkan default setup yang mengabaikan seluruh Sigma/. Jalur yang menambahkan pola itu terdapat pada sigma notion setup melalui opsi eksplisit --gitignore-sigma (src/commands/notion.ts:30,50-54; src/engine/notionService.ts:41-54), bukan default.
- .gitignore master tidak mengabaikan Sigma/ secara keseluruhan. Pada KLHK, aturan mengabaikan bagian tertentu seperti log dan data besar, bukan seluruh folder governance.
- git check-ignore --no-index -v terhadap Sigma/charter/DIR-INTENT-v5.md dan DIR-INTENT-v6.md di KLHK tidak menghasilkan aturan ignore yang cocok. git ls-files mengonfirmasi kedua berkas dilacak.
- Kesimpulan terbatas: penggunaan riwayat/diff Git untuk INTENT tidak terhalang konfigurasi ignore yang diperiksa. Pemeriksaan ini belum mensertifikasi bahwa isi kedua INTENT sama dengan baseline sah terbaru.

Status: penghapusan tier, pengaman amandemen, riwayat Git/tag dan push manual Director ditetapkan sebagai arah desain; belum ada perubahan sistem, amandemen proyek, commit, tag, push/pull, atau perubahan gitignore oleh asisten.

## Rekonsiliasi review Codex dan Claude - 6 Oktober 2026

Director menyatakan mengikuti rekomendasi kesepahaman bersama dan mengotorisasi pembaruan dokumen diskusi. Status berikut memperjelas perubahan terhadap catatan 28 September; tidak menggantikan seluruh D-01 sampai D-22 atau memberi otorisasi implementasi.

| Acuan | Status dan penegasan |
| :--- | :--- |
| D-04 - Amandemen | Batas amandemen bertier digantikan keputusan Sigma v2 tanpa tier; INTENT lama tetap ada dan tag historis boleh diabaikan, dengan pengaman otoritas serta riwayat pada bagian amandemen. |
| D-05 - APPROVED/LOCKED | Keputusan lifecycle sudah tercatat dan tidak dibuka ulang; spesifikasi pelaksanaan serta kompatibilitas chain lama masih perlu dilengkapi. |
| D-12 - Kompatibilitas | Penomoran lama dipertahankan tanpa renumber otomatis; migrasi lifecycle melalui doctor kini ditetapkan secara terbatas sebagaimana keputusan lanjutan, bukan migrasi bebas seluruh chain. |
| D-13 - HUMAN | Keputusan pada sumber tetap tercatat; review ini belum membuka ulang atau mengotorisasi penerapannya. |
| D-15 - Brief | Brief wajib berada dalam INTENT tanpa artefak/approval terpisah; jumlah contoh batas diuji melalui pilot. |
| D-22 - sigma note/notes | Tetap track terpisah rilis 1.1.0; arah terbaru menambah daftar/update dan pembatasan Markdown sebagaimana bagian Klarifikasi Sigma notes, memperluas rancangan awal new/list dengan penyimpanan daftar yang masih perlu ditetapkan. |

Koreksi bukti: cakupan validator EXEC saat ini menjelaskan bagaimana placeholder dapat lolos, tetapi bukan kepastian penyebab historis KLHK; rekomendasi kelengkapan berfokus pada bagian substantif dengan alasan singkat untuk bagian yang tidak berlaku. Director kemudian menetapkan seluruh kategori pesan diperlakukan sama oleh send gate; tidak ada pengecualian FYI atau kategori action lain. Claude mengoreksi contoh CanopySense sebagai pelebaran PLAN, bukan rangkaian amandemen; koreksi itu laporan Claude, belum diverifikasi pada proyek tersebut.

Pembaruan basis pemeriksaan: main lokal dan referensi lokal origin/main berada di da4e831, dengan f707085 sebagai pendahulu; diff keduanya hanya empat dokumen evaluasi dan working tree bersih sebelum pembaruan ini. Pemeriksaan langsung remote gagal karena koneksi, sehingga kondisi server terkini belum dikonfirmasi; informasi review bahwa f707085 hanya berada lokal tidak dipakai sebagai fakta terkini.

## Keputusan lanjutan Director - Jawaban open question

Keputusan berikut diberikan pada 6 Oktober 2026; pencatatan tidak mengotorisasi perubahan kode, state proyek atau Git dalam sesi diskusi.

### Struktur message/memo dan transisi LEGACY

Contoh struktur yang ditetapkan, dengan role FMN:

```text
Sigma/
  messages/FMN/
    v1/
    v2/
    v3/
    v1.1/
    v1.2/
    GENERAL/
    LEGACY/
  memo/FMN/
    v1/
    v2/
    v3/
    v1.1/
    v1.2/
    GENERAL/
    LEGACY/
```

Director menetapkan folder major v1/v2/v3 untuk message/memo terkait INTENT, ROADMAP atau CLOSE; folder minor tetap tersedia bagi PLAN/EXEC. Tujuan perapihan adalah memudahkan Director memeriksa isi pesan dan AI melacak pekerjaan tanpa penumpukan seluruh file dalam satu folder role. Folder versi memisahkan lokasi file; tampilan, kuota memo dan send gate tetap berbasis intent major. Pada standar baru, v2.1 dan v2.2 milik INTENT v2 sehingga kewajiban unread dan kuota dihitung bersama untuk role yang sama. Pada chain legacy, identitas intent mengikuti keanggotaan chain sebenarnya, bukan prefix nomor PLAN/EXEC.

GENERAL merupakan cadangan yang diperkirakan jarang diperlukan karena role umumnya terikat pada versi artefak dalam sesi. Bila ada GENERAL UNREAD, entry tersebut selalu tampil bersama konteks aktif atau ketika tidak ada intent aktif; tidak disembunyikan oleh filter intent. Penampilan ini belum menetapkan apakah GENERAL ikut send gate atau kuota memo intent.

LEGACY menampung seluruh pesan/memo Sigma lama melalui doctor setelah UNREAD diubah menjadi READ. Pembacaan paksa ini merupakan reset administratif migrasi, bukan bukti bahwa penerima telah memahami isi. Keputusan ini mengesampingkan rekomendasi sebelumnya untuk mengklasifikasikan pesan lama ke chain dan mempertahankan UNREAD; pergantian intent biasa pada sistem baru tetap tidak mengubah status.

Verifikasi read-only: src/commands/memo.ts:153-175 menulis memo ke Sigma/messages/<ROLE>/ sebagai MessageEntry bertipe MEMO dan menggunakan index message yang sama; src/engine/mailbox.ts:112-130,264-265 menegaskan lokasi index dan folder. Inventaris KLHK memperlihatkan file message langsung dalam Sigma/messages/FMN, sementara Sigma/memo belum tersedia. Pemisahan folder baru merupakan perubahan yang akan diimplementasikan, bukan perilaku sekarang.

Rekomendasi teknis untuk implementasi: migrasi memperbarui index dan referensi path sambil mempertahankan ID/relasi balasan, mencatat reset status, dan tidak mengarsipkan ulang pesan format v2 saat doctor dijalankan lagi. Belum ada doctor, pemindahan file atau reset status yang dijalankan.

### Transisi lifecycle melalui doctor

| Kondisi pasangan | Keputusan Director untuk doctor Sigma v2 |
| :--- | :--- |
| PLAN LOCKED dan EXEC pasangannya LOCKED | Keduanya tetap LOCKED. |
| PLAN LOCKED dan EXEC pasangannya DRAFT | PLAN otomatis menjadi APPROVED; EXEC tetap DRAFT. |

Ini menetapkan migrasi lifecycle terbatas pada pasangan terkait tanpa renumber artefak; tidak mengubah pasangan selesai secara retroaktif. Kode sekarang belum menerima APPROVED pada state PLAN/EXEC, sehingga validator, gate, service dan orientasi harus diselaraskan ketika implementasi dilakukan. Perlakuan PLAN LOCKED tanpa EXEC pasangan atau pasangan ambigu belum ditetapkan.

### Pertanyaan yang belum dijawab atau memerlukan rincian

- Nomor 7 sudah diputuskan: INTENT DRAFT sebelum upgrade tetap legacy; folder major bagi INTENT/ROADMAP/CLOSE dan tampilan GENERAL UNREAD juga sudah ditetapkan di atas.
- Perhitungan kuota dan send gate bagi GENERAL belum ditetapkan; kemunculan pada tampilan tidak otomatis menjadikan GENERAL pemblokir semua intent.
- Commit lokal sudah diputuskan atas arahan Director dan dapat dikerjakan AI; Sigma memverifikasi acuan serta membuat tag lokal, sementara push tetap dilakukan Director sendiri.
- Retensi/auto-outdate, akses riwayat dan kondisi pasangan lifecycle di luar tabel di atas perlu spesifikasi, tanpa mengubah keputusan yang sudah diberikan.

## Klarifikasi Sigma notes - Katalog catatan bebas Markdown

### Kebutuhan dan arahan Director

Sigma/notes merupakan tempat catatan bebas template. Director membutuhkan daftar yang membantu memilih catatan untuk dibuka dan memudahkan AI melacak catatan ketika jumlah file berkembang; acuan pengalaman adalah Sigma/notes pada proyek KLHK. Pola penggunaan diinginkan menyerupai daftar referensi dan sigma reference update. Director menyebut perintah sigma notes update yang wajib menolak berjalan jika ada file selain format .md; folder ini khusus catatan Markdown.

Aturan pembatasan format berlaku pada update, tanpa mengubah isi catatan menjadi kontrak/template wajib dan tanpa menghapus, memindahkan atau mengonversi file non-Markdown secara otomatis.

### Keputusan registrasi - Ralat aturan tanggal

Director menetapkan bahwa hanya catatan yang dibuat melalui sigma notes new dapat teregistrasi. Markdown yang dibuat atau ditambahkan di luar mekanisme tersebut tidak masuk daftar aktif dan diperlakukan sebagai catatan tidak terdaftar, terlepas dari tanggal pembuatan, nama file atau adanya heading. Director kemudian mengganti nama folder penampung LEGACY menjadi unregistered-notes khusus untuk notes. Keputusan ini menggantikan pendekatan tanggal cutover yang sempat dibahas dalam chat dan rekomendasi katalog otomatis untuk seluruh catatan lama.

- new membuat file Markdown dalam Sigma/notes/note-list/ dan mencatat registrasinya; isi catatan tetap bebas template.
- list dan note-list.md hanya memuat catatan terdaftar, bukan seluruh Markdown yang ditemukan dalam folder.
- update menyinkronkan daftar catatan terdaftar dan memindahkan Markdown tidak terdaftar ke Sigma/notes/unregistered-notes/ sesuai alur perapihan yang sudah diarahkan; update tidak mengimpor atau mendaftarkan file manual.
- Catatan lama KLHK menjadi catatan tidak terdaftar tanpa perlu ekstraksi ringkasan atau pengisian kegunaan satu per satu; file manual baru juga mengikuti perlakuan yang sama.
- Mengedit isi catatan yang sudah dibuat melalui new tetap mempertahankan asal registrasinya; identitas catatan perlu dilacak terpisah dari hash isi yang berubah saat penyuntingan.
- note-list.md merupakan katalog sistem dan dikecualikan dari klasifikasi catatan; folder unregistered-notes dikecualikan dari katalog aktif dan tidak dipindahkan ulang ke unregistered-notes bertingkat. Berada dalam note-list/ saja tidak membuat Markdown menjadi terdaftar bila file tidak dibuat melalui new.

Rekomendasi teknis asisten: gunakan registry yang dicatat oleh new sebagai sumber identitas, bukan mengenali registrasi dari nama file atau tanggal. Jika registry menggunakan JSON, simpan di luar Sigma/notes agar tidak melanggar pembatasan Markdown. Update tidak membuat entry registrasi baru dari file yang ditemukannya; registry yang rusak/hilang pada proyek yang sebelumnya sudah memakai registrasi perlu penanganan pemulihan, bukan otomatis menganggap seluruh catatan aktif sebagai legacy.

Rincian penyimpanan registry, kolom katalog, rename/file hilang dan validasi cakupan unregistered-notes/subfolder masih perlu spesifikasi; keputusan hanya-new dan perlakuan legacy sudah ditetapkan. Pembatasan update terhadap file non-Markdown tetap berlaku.

### Struktur folder yang ditetapkan Director

```text
Sigma/notes/
  unregistered-notes/   # Markdown yang tidak teregistrasi
  note-list/           # Markdown terdaftar melalui sigma notes new
  note-list.md         # Katalog catatan terdaftar
```

Tiga komponen tersebut menjadi struktur aktif folder notes. Saat update, setiap file Markdown asing/tidak terdaftar dalam notes diarahkan ke unregistered-notes, termasuk file manual yang diletakkan langsung di root notes di luar ketiga komponen tersebut. Update tidak mengimpor file asing sebagai catatan aktif dan tidak memperlakukan note-list.md sebagai file asing. File manual yang disisipkan ke note-list/ juga mengikuti aturan registrasi yang sama; posisi folder bukan bukti registrasi.

Rekomendasi implementasi: pertahankan isi file saat pemindahan dan tangani benturan nama tanpa menimpa catatan yang sudah ada; tidak ada pemindahan nyata dalam sesi ini.

### Penegasan Director 6 Oktober 2026 - struktur dan sistem otomatis

Director menegaskan struktur notes yang berlaku adalah unregistered-notes/, note-list/ dan note-list.md. Nama LEGACY hanya berlaku pada mailbox (Sigma/messages dan Sigma/memo).

Director mendefinisikan dua perilaku sigma notes update, yang dijalankan setiap kali update dijalankan:

- **Auto rejection:** setiap file non-Markdown yang terdeteksi di folder notes ditolak. Penolakan ini sejalan dengan keputusan sebelumnya bahwa update menolak file selain .md.
- **Auto move:** setiap file Markdown yang tidak dibuat melalui sigma notes new dikategorikan sebagai catatan tidak terdaftar dan dipindahkan ke folder unregistered-notes.

Detail yang masih perlu spesifikasi di rencana F06: bentuk penolakan (menghentikan seluruh update dengan menampilkan path pelanggaran, sebagaimana rekomendasi sebelumnya, atau memproses file lain sambil melaporkan penolakan) dan penulisan nama folder (unregistered-notes dengan tanda hubung sesuai struktur yang ditetapkan). Keputusan Director belum mengotorisasi implementasi.

### Verifikasi read-only

- KLHK Sigma/notes memiliki 85 file langsung, terdiri atas 73 .md dan 12 non-.md, serta dua subfolder; seluruh subtree memiliki 90 file, terdiri atas 74 .md dan 16 non-.md.
- Format non-Markdown mencakup PDF, DOCX, PPTX, XLSX, TXT, HTML, JPG, PNG dan JS; aturan penolakan baru akan menolak update pada keadaan folder yang diperiksa, bahkan bila pemeriksaan hanya mencakup file langsung.
- Sampel bagian awal tiga catatan (rencana ulang sampel 6 Oktober, glosarium dan CATATAN_DISKUSI) memperlihatkan variasi judul, tanggal dan struktur; pemeriksaan ini tidak membaca atau memverifikasi seluruh substansi catatan.
- src/commands/reference.ts mendaftarkan update saja; daftar sumber disimpan dalam Sigma/reference/reference-list.md. src/services/referenceUpdateService.ts menambah entry baru pada Local Artifact, mempertahankan penilaian Category/Notes yang sudah ada dan melaporkan referensi file hilang tanpa menghapus row. Pemeriksaannya hanya entry tingkat teratas pada reference/data, bukan scan rekursif seluruh file.

### Uji sampel KLHK - Batas ekstraksi otomatis

Director meminta pembuktian pada catatan nyata. Dua variasi penyaring diuji melalui script Node dalam memori pada 10 file yang dipilih untuk variasi format, bukan sampel acak; tidak ada script/katalog yang disimpan atau file KLHK yang diubah. Angka/klaim ilmiah di dalam catatan tidak diverifikasi dalam uji katalog ini.

| Sampel | Hasil ekstraksi dan batasnya |
| :--- | :--- |
| Runbook inferensi v5.2 | Judul awal dan kalimat pembuka menjelaskan bahwa ini dokumen operasional untuk DEV-EXEC v5.2; cuplikan membantu pengenalan. |
| Rencana ulang sampel 6 Oktober | Jika hanya paragraf biasa diterima, cuplikan baru muncul pada rumus di baris 21; menerima butir daftar memberi arahan ukuran pasti pada baris 6. |
| Glosarium | Selepas metadata, tidak ada paragraf biasa; cuplikan daftar hanya memuat satu regulasi, sedangkan heading bagian lebih menggambarkan variasi topik. |
| CATATAN_DISKUSI | Penyaring metadata sederhana masih mengambil Peran Director; penyaring lebih luas melewatinya dan menemukan keluaran Proposal Teknis, tanpa merangkum seluruh diskusi. |
| Register sumber v4.4 | Cuplikan awal mengambil definisi atau keterangan berkas pendukung; judul dan heading bagian lebih berguna daripada menganggap cuplikan sebagai kegunaan lengkap. |
| RO-TEMPLATE | Paragraf biasa pertama berupa [isi]; penerimaan blockquote mengambil penjelasan format, tetapi judul tetap berisi placeholder karena file memang template. |
| Proposal hasil ekspor | Memuat gambar base64 besar; heading pertama DAFTAR TABEL berada pada baris 159. Fallback nama file menghindari judul salah, tetapi cuplikan surat pengantar tetap kurang membantu. |
| Ekspor compass CC-001 | Isi ringkas berbentuk bullet TL;DR; menerima bullet menghasilkan cuplikan substantif, sedangkan pembatasan paragraf biasa melewatkannya. |
| Diskusi proposal-centric | Penyaring dapat mengambil kalimat status di luar scope alih-alih pokok pembahasan; heading bagian memberi petunjuk tambahan. |
| AUD_discussion_integrity_checking | Tidak mempunyai heading Markdown; fallback nama file berjalan dan cuplikan menjadi pertanyaan awal percakapan. |

Dalam variasi kedua, delapan file memakai H1 awal dan dua memakai nama file; itu hasil fallback teknis pada sampel, bukan ukuran ketepatan semantik seluruh koleksi. Waktu modifikasi/path dapat diperoleh otomatis, tetapi tanggal modifikasi bukan tanggal pembuatan atau bukti catatan masih berlaku.

Hasil uji ini merupakan evaluasi pendekatan sebelum keputusan hanya-new; seluruh sampel lama tersebut kini ditujukan ke unregistered-notes, bukan diimpor ke katalog aktif. Koreksi klaim asisten: katalog dasar otomatis dapat dibuat tanpa mengisi manual seluruh catatan, tetapi cuplikan awal tidak dijamin cukup untuk memilih catatan. Rekomendasi: prioritaskan judul/nama, tautan dan waktu modifikasi; tambahkan pratinjau heading bagian untuk file terstruktur dan cuplikan literal sebagai cadangan. Cuplikan tetap berlabel pratinjau, bukan ringkasan atau kegunaan. Hindari heading jauh di isi sebagai judul, lewati kode/gambar/base64/placeholder dan batasi panjang keluaran. Angka batas penyaring pada percobaan belum menjadi spesifikasi final.

### Rekomendasi katalog dan perubahan terhadap D-22

Rancangan D-22 sebelumnya menyediakan new/list dengan pembacaan langsung tanpa indeks. Arahan terbaru mewajibkan asal registrasi melalui new dan menyediakan update untuk katalog serta perapihan legacy; rekomendasi berikut disesuaikan dengan keputusan itu:

- Lokasi katalog ditetapkan Director sebagai Sigma/notes/note-list.md dan catatan aktif disimpan dalam Sigma/notes/note-list/; katalog dikecualikan dari daftar dirinya sendiri.
- Katalog aktif menggunakan judul, identitas, path dan waktu pembuatan yang dicatat saat new, serta waktu modifikasi bila diperlukan; tidak ada kewajiban merangkum seluruh catatan lama yang masuk unregistered-notes. Kegunaan atau pratinjau untuk catatan baru masih perlu keputusan kolom dan tidak dianggap dapat dijamin oleh ekstraksi sederhana.
- list membaca daftar catatan terdaftar dan mendukung pencarian; update memperbarui katalog dari registry/file terkait tanpa mendaftarkan file manual. Keterangan manual jika disediakan tetap opsional dan dipertahankan.
- Validasi seluruh cakupan scan sebelum menulis atau membuat katalog; jika ada file non-.md, tampilkan path pelanggaran dan batalkan seluruh update, bukan menghasilkan katalog parsial.
- new menjadi satu-satunya jalur registrasi catatan aktif; isi tetap bebas template, sedangkan nama/isi catatan manual lama dipertahankan dalam unregistered-notes.
- Struktur notes kini ditetapkan menjadi unregistered-notes/, note-list/ dan note-list.md; penanganan subfolder lama di luar struktur tersebut serta cakupan validasi non-Markdown masih perlu spesifikasi.

Detail tersisa: penyimpanan registry dan kolom katalog, kebijakan file hilang/rename dan benturan nama, cakupan validasi subfolder/unregistered-notes serta kompatibilitas penamaan command lama sigma note terhadap sigma notes new/list/update yang dipakai dalam arahan terbaru. Registrasi hanya melalui new, katalog aktif, migrasi file manual ke unregistered-notes dan pembatasan Markdown sudah menjadi arahan Director; detail rekomendasi teknis belum seluruhnya diputuskan.

Belum ada file di KLHK yang diubah, katalog yang dibuat, command Sigma yang dijalankan atau implementasi source; pencatatan hanya pada dokumen diskusi ini.

## Strategy Action - Prioritas dan urutan pekerjaan

Urutan prioritas inti Sigma mengikuti kesepahaman review; sigma note merupakan track terpisah, sedangkan mailbox dan penomoran dapat dikerjakan tanpa menunggu pilot keterbacaan setelah detail masing-masing ditetapkan.

| Urutan | Fokus | Tindakan yang direkomendasikan |
| :--- | :--- | :--- |
| 1 | Konsistensi aturan | Petakan perbedaan master, rules proyek, skill dan memory agar perbaikan memakai sumber aturan yang jelas. |
| 2 | Rekonsiliasi keputusan | Tegaskan keputusan D-01 sampai D-22 yang dipertahankan atau dibuka ulang serta lengkapi spesifikasi dan kompatibilitas tanpa membuka ulang D-05. |
| 3 | sigma notes - track terpisah | Registrasikan melalui new ke note-list/, kelola note-list.md dengan list/update, pindahkan Markdown asing ke unregistered-notes/ dan tolak update pada file non-Markdown. |
| 4 | Mailbox per intent | Pisahkan folder messages/memo per role dan versi dengan GENERAL/LEGACY, agregasi unread per intent serta migrasi doctor sesuai keputusan Director. |
| 5 | Penomoran dan bootstrap | Selaraskan major PLAN/EXEC dengan INTENT pada chain baru serta pertahankan pola legacy dengan pemberitahuan bootstrap bersyarat. |
| 6 | Pilot keterbacaan | Uji struktur ringkas pada PLAN/EXEC KLHK v5.3 dan PLAN v5.4 serta contoh batas brief INTENT dengan mempertahankan kewajiban penting. |
| 7 | Penyederhanaan dokumen | Terapkan hasil pilot pada template, rules, protocol, constitution dan memory dengan ringkasan di awal serta satu definisi otoritatif per aturan. |
| 8 | Amandemen melalui Git | Terapkan model tanpa tier dengan otoritas ARC/Director, review diff/dampak, konfirmasi akhir serta baseline Git dan tag tanpa backup terpisah atau push otomatis. |
| 9 | Acuan dan revisi kontrak | Ikat revisi INTENT/PLAN/EXEC, terapkan revisi terkendali dan migrasi doctor dari PLAN LOCKED ke APPROVED bila EXEC pasangan masih DRAFT. |
| 10 | Review sumber dan kesiapan | Tampilkan teks serta fungsi ID INTENT yang dikutip PLAN dan pisahkan kelayakan struktur, sertifikasi isi serta kesiapan scope. |
| 11 | Revisi dari artefak lama | Sediakan pembuatan draft dari versi sebelumnya beserta diff dengan reset identitas, persetujuan dan klaim bukti yang perlu diperiksa ulang. |
| 12 | Logistik audit dan keputusan | Sediakan paket audit berisi sumber yang tepat serta daftar keputusan tertunda sesuai intent aktif setelah alur review stabil. |
| 13 | Distribusi dan validasi | Selaraskan skill/bridge seluruh target lalu verifikasi parity aturan, perilaku CLI/MCP dan kompatibilitas pada chain lama serta baru. |
