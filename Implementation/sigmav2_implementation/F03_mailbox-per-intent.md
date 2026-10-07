# F03 - Mailbox per intent

Tanggal: 7 Oktober 2026
Status: Implementasi dan validasi selesai 7 Oktober 2026; O-1 sampai O-7 disetujui, npm test 69 berkas / 966 tes lulus (exit 0), tes doctor terakhir 6 berkas / 68 tes lulus. Di-commit Director dalam 9f1bea6; push berhasil dilaporkan Director dan main sama dengan origin/main saat awal penyusunan F04.
Sifat dokumen: catatan kerja pengembangan master Sigma, bukan artefak governance proyek. Instruksi Director "commit dan push telah dilakukan, lanjutkan ke f03" mengotorisasi penyusunan fokus ini. Director kemudian menyetujui seluruh rekomendasi dan melanjutkan eksekusi; build/pengujian tercakup, migrasi proyek nyata tidak dilakukan.

## 1. Tujuan dan batas fokus

Pisahkan pesan dan memo berdasarkan intent pemiliknya pada penyimpanan, tampilan, kuota, send gate, orientasi, dan retensi. Identitas intent harus mengikuti keanggotaan artefak sebenarnya, termasuk chain dengan penomoran legacy.

Cakupan yang diusulkan: engine mailbox, resolver referensi, CLI send/inbox/memo/doctor, inisialisasi proyek, orientasi CLI/MCP, pemeriksaan integritas CLI/MCP, kompatibilitas archive MCP, dan tes. Penyesuaian master MEMO-TEMPLATE serta skill read-memo/write-memo empat target dicakup sebagai teks pendamping setelah perilaku disetujui. Perubahan aturan/memory dicatat untuk F01/F09; Protocol dikerjakan terakhir.

Tidak termasuk perubahan lifecycle APPROVED/LOCKED (F04), penomoran (F02 sudah selesai), nama artefak governance (F10), notes (F06), versi paket/SCHEMA_VERSION, Constitution, Protocol, registries, sinkronisasi aset terpasang/proyek (F09), commit, atau push. Migrasi hanya diuji pada fixture sementara; proyek pengguna tidak dimigrasikan dalam eksekusi pengembangan ini.

**TERVERIFIKASI:** repositori bersih saat pemeriksaan awal; branch main, HEAD `0c3e3b1` memuat F02. Status `main...origin/main` tanpa ahead/behind menunjukkan kesamaan dengan referensi remote lokal; tidak dilakukan fetch atau pemeriksaan server remote. Hasil F02 sebelumnya: 68 berkas / 934 tes lulus, exit 0. Angka tersebut bukan hasil uji F03.

## 2. Keputusan Director yang sudah terkunci

Dasar: [diskusi_rencana_perubahan_sigma_v2.md](../../Discussion/Evaluation-06102026/diskusi_rencana_perubahan_sigma_v2.md), Temuan 01 (baris 7-66), kasus K7 (baris 464), dan keputusan lanjutan (baris 538-590), diperiksa pada HEAD di atas.

1. Tampilan normal mengikuti major intent aktif. Berpindah intent tidak mengubah status pesan/memo sistem baru.
2. Kuota default lima memo **UNREAD per intent per role**. Membaca memo membebaskan slot. Semua minor dalam intent yang sama berbagi kuota.
3. Send gate memeriksa pesan UNREAD yang diterima pengirim dalam intent yang sama. Pesan intent lain tidak memblokir. MEMO tetap dikecualikan.
4. Seluruh action diperlakukan sama, termasuk FYI, RESPOND, REVIEW, UNBLOCK, OTHER. Minor lain dalam intent yang sama tetap ikut gate; kasus FYI v4.4 terhadap audit v4.5 bukan pengecualian.
5. Struktur: `Sigma/messages/<ROLE>/<KONTEKS>/` dan `Sigma/memo/<ROLE>/<KONTEKS>/`. INTENT/ROADMAP/CLOSE memakai folder major; PLAN/EXEC memakai folder versi minor. GENERAL dan LEGACY tersedia pada keduanya.
6. Pengiriman lintas intent ditolak. Referensi PLAN/EXEC legacy dihubungkan ke intent melalui chain sebenarnya, bukan prefix angka.
7. GENERAL adalah cadangan bila referensi tidak dapat dihubungkan. GENERAL UNREAD selalu tampak bersama konteks aktif atau ketika belum ada intent aktif. Keputusan ini belum menentukan gate/kuota GENERAL.
8. Doctor memindahkan seluruh pesan/memo Sigma format lama ke LEGACY masing-masing role, termasuk yang referensinya diketahui. UNREAD diubah menjadi READ; reset ini administratif, bukan bukti penerima telah memahami isi. Pesan format baru tidak dimigrasikan ulang.
9. F02 menetapkan `versioning_scheme` dan metadata identitas artefak. Chain lama tetap offset; chain baru aligned; tidak ada renumber sejarah.

## 3. Peta dampak kode yang terverifikasi

Nomor baris berikut adalah lokasi pada HEAD `0c3e3b1`; periksa kembali bila basis berubah.

| Lokasi | Perilaku saat ini | Dampak F03 yang diusulkan |
|---|---|---|
| `src/engine/mailbox.ts:12-33,46-130` | Satu index `Sigma/messages/index.json`; entry belum menyimpan intent/konteks; normalisasi separator, penolakan ID/path duplikat dan JSON rusak sudah ada | Tambah metadata format/konteks; pertahankan guard; penulisan index atomik dan pembacaan format lama tanpa migrasi otomatis |
| `src/engine/mailbox.ts:205-265` | Seluruh selector hanya membatasi role/status/type; retensi READ menggabungkan message dan memo seluruh intent; folder hanya per role | Selector dengan scope eksplisit, kelompok kuota/gate/retensi, pemisahan direktori message/memo |
| `src/commands/send.ts:94-118,125-168` | Referensi teks bebas/N/A; gate lintas intent; reply ID tidak dikenal hanya warning; attachment disalin sebelum file/index ditulis | Resolusi konteks sebelum gate dan sebelum write; validasi reply; tulis entry/folder yang konsisten |
| `src/commands/memo.ts:26-60,133-175,187-257` | Regex hanya INTENT/PLAN/EXEC; referensi belum diverifikasi terhadap chain; kuota lintas intent; memo disimpan bersama message | Tambah ROADMAP/CLOSE; resolusi bersama send; daftar/kuota scoped; file masuk `Sigma/memo/` |
| `src/commands/inbox.ts:45-116,127-180,188-285` | List/pointer/read/clear tanpa scope intent; disk scan orphan hanya satu tingkat di messages | Scope tampilan/retensi; opsi riwayat; scan konteks pada messages dan memo; read ID tetap tersedia |
| `src/commands/session.ts:258-329` | Bootstrap menghitung seluruh unread lintas intent; exception mailbox diabaikan | Gunakan scope/resolver bersama dan tampilkan diagnosis mailbox bila data tidak dapat dipercaya |
| `src/mcp/tools/orientation.ts:34-63,85-102` | Hitungan inbox/memo lintas intent; kegagalan index ditampilkan sebagai hitungan kosong | Paritas scope bootstrap; tambahan status/warning agar kegagalan tidak bermakna antrean kosong |
| `src/mcp/tools/checkMailboxIntegrity.ts:23-90` | Pemeriksaan per-role hanya file langsung di messages | Engine pemeriksaan bersama CLI/MCP; recursive scan terbatas pada pohon mailbox; metadata/path/identity ikut diperiksa |
| `src/commands/doctor.ts:56-173,326-363` | Rekonsiliasi chain; tanpa migrasi mailbox; proyek tanpa chain cepat return | Diagnosis/migrasi mailbox terpisah dari lifecycle, termasuk proyek sebelum INTENT pertama |
| `src/mcp/tools/doctor.ts:21-36` | Diagnosis read-only; proyek tanpa chain return noProject | Tambah diagnosis mailbox read-only pada proyek valid, termasuk tanpa chain; tidak ada pemindahan/reset status melalui MCP |
| `src/services/inboxArchiveService.ts:51-74` | Index tunggal; MCP memeriksa kepemilikan penerima; transaksi snapshot index | Pertahankan index bersama dan ownership; archive by ID tetap lintas konteks dengan kewenangan yang sama; koordinasi dengan migrasi |
| `src/commands/project.ts:357-365` | Membuat pohon messages role/attachments dan index kosong format lama | Inisialisasi index format baru dan dua pohon mailbox; folder versi dibuat sesuai kebutuhan |
| `src/engine/projectConfig.ts:16-24,72-89` | Default kuota/keep = 5; nilai 0 menonaktifkan fitur memo/auto-sweep | Angka dan konfigurasi lama dipertahankan; makna kelompok menjadi per intent/role/type |
| `src/engine/chain.ts:313,380,486,543`, `src/engine/numbering.ts` | Identitas pemilik chain dan dua skema penomoran sudah tersedia | Dibaca oleh resolver; tidak mengubah chain atau menebak major dengan offset universal |
| `src/engine/controlStore.ts:357-484,734`, `src/utils/fs.ts:50`, `src/cli.ts:93` | Lock proyek MCP, journal transaksi, atomic replace tersedia; CLI memakai parse sinkron | Gunakan lock proyek yang sama untuk mutasi mailbox CLI; adaptasi async action/parseAsync bila diperlukan; journal migrasi khusus tidak menyamar sebagai approval MCP |
| `Sigma/templates/MEMO-TEMPLATE.md:4,15`, `setup/targets/*/read-memo*`, `setup/targets/*/write-memo*` | Teks menunjuk lokasi lama, tiga tipe ref, kuota per role | Selaraskan master dengan lokasi, scope, riwayat dan tipe referensi yang disetujui; jangan mengubah otorisasi membaca isi memo |

**Batas MCP yang terverifikasi:** `src/mcp/index.ts:18-19` dan `src/mcp/policy.ts:82-83` mencatat penarikan tool list/read mailbox oleh Director. F03 tidak menambah tool send/write/read/list mailbox. Paritas berlaku untuk tool yang masih tersedia: orientation, doctor diagnosis, integrity, archive. Mailbox tidak termasuk `state_revision` (`src/mcp/contract.ts:59-66`); keputusan itu dipertahankan.

## 4. Spesifikasi perilaku yang diusulkan

Bagian ini mula-mula merupakan rekomendasi dan kini **TERKUNCI** melalui persetujuan Director atas seluruh rekomendasi serta eksekusi.

### 4.1 Identitas dan penyimpanan

Satu index tetap di `Sigma/messages/index.json` untuk message dan memo. Tambahkan `mailbox_format: 2` pada index, terpisah dari SCHEMA_VERSION governance. Entry baru menyimpan `intent_version` (vN atau null) dan `context` (versi artefak, GENERAL, LEGACY). `related_artifact` tetap menyimpan rujukan asli. Entry format baru harus mempunyai kedua field konteks yang valid; field hilang/bertentangan bukan alasan fallback legacy diam-diam.

Identitas kuota/gate: `(role penerima, intent_version)` untuk pesan/memo terkait chain; GENERAL adalah kumpulan tersendiri. Identitas retensi menambah jenis kumpulan message atau memo. Nama folder saja tidak membuktikan pemilik intent.

| Artefak yang dirujuk | Metadata intent / context | Direktori contoh |
|---|---|---|
| INTENT/ROADMAP/CLOSE v3 milik INTENT v3 | v3 / v3 | `Sigma/messages/FMN/v3/` atau `Sigma/memo/FMN/v3/` |
| PLAN/EXEC v3.2 aligned milik INTENT v3 | v3 / v3.2 | `Sigma/messages/FMN/v3.2/` atau `Sigma/memo/FMN/v3.2/` |
| PLAN/EXEC v2.1 legacy milik INTENT v3 | v3 / v2.1 | `Sigma/messages/FMN/v2.1/` atau `Sigma/memo/FMN/v2.1/` |
| GENERAL | null / GENERAL | `<messages atau memo>/<ROLE>/GENERAL/` |
| Hasil migrasi format lama | null / LEGACY | `<messages atau memo>/<ROLE>/LEGACY/` |

Validasi read/check mencocokkan metadata, type, recipient, path yang diizinkan, dan keanggotaan artefak. Semua path disimpan POSIX dan diperiksa containment serta symlink/junction sebelum write/move. Konflik identitas menghasilkan diagnosis/error, bukan GENERAL.

### 4.2 Resolusi referensi

Resolver bersama menerima INTENT/ROADMAP/PLAN/EXEC/CLOSE, versi artefak yang sebenarnya, prefix role lama maupun bentuk tanpa prefix, serta versi polos bila pemiliknya unik. Contoh `PLAN-v2.1`, `FMN-PLAN-v2.1`, dan `EXEC-v2.1` legacy dihubungkan melalui tracker chain, bukan asumsi intent v2.

- Pemilik unik = intent aktif: boleh membuat entry dalam konteks artefaknya, termasuk artefak SUPERSEDED historis yang masih terdaftar. Status lifecycle bukan batas baru send/memo.
- Pemilik unik = intent lain: tolak sebelum attachment/file/index ditulis; tampilkan intent yang harus diaktifkan.
- Pemilik diketahui tetapi tidak ada intent aktif: tolak dengan petunjuk aktivasi. Referensi GENERAL tetap dapat digunakan sebelum ada chain.
- Referensi kosong/N/A/GENERAL atau belum dapat dihubungkan: usulan O-4 berlaku. Ref memo tetap wajib secara sintaks; string arbitrary yang tidak termasuk sintaks didukung ditolak.
- Ada beberapa pemilik atau bukti chain rusak/bertentangan: tolak; jangan mengubahnya menjadi GENERAL untuk melewati gate.

CLI menampilkan konteks folder dan intent pemilik sehingga prefix legacy tidak menyesatkan.

### 4.3 Tampilan dan gate

Default inbox dan memo list: UNREAD intent aktif ditambah GENERAL UNREAD. Tanpa intent aktif, hanya GENERAL UNREAD serta diagnosis bila resolusi aktif gagal. `--all` memperluas status dalam scope yang sama, bukan membuka semua intent. OUTDATED tetap hanya terlihat melalui opsi khusus; tidak dihapus.

Usulan riwayat O-3: `--intent vN` memilih agregasi major intent sebenarnya; `--context GENERAL|LEGACY|vN[.minor]` memilih konteks penyimpanan; `--all-intents` menampilkan seluruh konteks dengan label identitas. `--intent` boleh dipasangkan dengan `--context` versi untuk menghindari ambiguitas folder legacy. Selector GENERAL/LEGACY, atau all-intents, tidak digabung dengan selector intent. Opsi status `--all`/`--outdated` tetap terpisah dan validasinya eksplisit. Selector riwayat tidak ikut mengubah chain aktif atau status.

Tampilan normal selalu menyertakan GENERAL UNREAD. Selector riwayat eksplisit boleh menampilkan hanya konteks yang diminta; konteks diprint pada header. Pembacaan berdasarkan ID dan archive mempertahankan akses lintas konteks yang sudah ada; ini tidak memberi AI otorisasi baru untuk membaca isi tanpa arahan Director.

Send gate menghitung non-MEMO UNREAD milik sender dalam intent tujuan. FYI dan minor terdahulu dalam intent tersebut tetap memblokir. GENERAL mengikuti O-1. Tidak ada pengecualian action/minor atau parameter untuk melewati gate.

Bootstrap CLI dan MCP memakai scope yang sama. Usulan tambahan respons MCP: `mailbox_context`, `mailbox_status`, `mailbox_warnings`. Bila index/konteks tidak dapat dipercaya, nyatakan hitungan tidak tersedia melalui status/warning; jangan menyimpulkan tidak ada unread. Diagnosis/list tidak memigrasikan, mereset status, atau menulis index.

### 4.4 Memo, balasan, dan retensi

Memo masih self-addressed, tidak memakai --to, dan tidak ikut send gate. Kuota menghitung UNREAD pada intent pemilik dan role yang sama; default 5, konfigurasi proyek yang ada tetap dihormati. GENERAL mempunyai hitungan terpisah sesuai O-1; UI memisahkan slot intent dari GENERAL bila keduanya tampil.

Balasan mengikuti O-2: parent harus ditemukan; bila ref balasan tidak diberikan, warisi konteks parent. Parent intent lain memerlukan aktivasi intent itu dahulu. Di dalam intent yang sama, balasan boleh menunjuk minor/artefak berbeda secara eksplisit; relasi reply_to tetap dipertahankan. Balasan yang mengubah GENERAL menjadi chain, chain menjadi GENERAL, atau LEGACY menjadi konteks aktif ditolak; gunakan pesan baru dengan pointer ID bila ingin membawa bahasan lama.

Retensi O-3: auto-outdate READ dikelompokkan per role, intent dan jenis (message/memo). Minor dalam satu intent berbagi jendela keep. GENERAL dan LEGACY terpisah. Read berdasarkan ID hanya mengevaluasi kelompok entry yang dibaca dan melindungi ID itu, UNREAD serta ARCHIVED. Aktivasi intent tidak memicu sweep. Default keep tetap 5; konfigurasi 0 menonaktifkan auto-sweep. Clear manual --keep 0 tetap berarti outdate seluruh READ kelompok yang dipilih.

Usulan `inbox clear` menangani message saja; tambahkan `memo clear` untuk memo, dengan scope/keep/dry-run yang sama. Operasi normal menyasar intent aktif; GENERAL/LEGACY/lintas intent memerlukan selector eksplisit. `--all-roles` tetap memerlukan --director-confirm; pembersihan semua intent juga memerlukan --director-confirm. Tidak ada penghapusan file.

## 5. Kompatibilitas dan migrasi

### 5.1 Sebelum migrasi

Index tanpa mailbox_format dibaca sebagai format lama. File/entry itu tidak diasumsikan milik intent hanya dari related_artifact. Diagnosis/list menampilkan peringatan migrasi; selector LEGACY dapat memeriksa daftar sejarah tanpa reset. Entry lama bukan GENERAL UNREAD. Sebelum migrasi selesai, mutasi mailbox ditolak dengan petunjuk doctor agar gate/kuota baru tidak mengabaikan antrean lama diam-diam; membaca isi melalui CLI read juga mutasi status, sehingga ditolak sampai migrasi. Membaca berkas langsung untuk pemeriksaan oleh Director tetap tersedia. Sesudah migrasi, akses read berdasarkan ID berlaku seperti bagian 4.3.

Index lama kosong dan tanpa file lama/orphan dapat diinisialisasi format baru pada mutasi pertama. Bila index tidak ada tetapi ada file mailbox, jangan membuat index kosong yang memutus riwayat; laporkan pemulihan diperlukan. Mixed entry dengan metadata format baru pada index lama atau metadata hilang pada index format baru dilaporkan sebagai konflik sebelum write, kecuali kondisi parsial yang dibuktikan journal migrasi.

### 5.2 Migrasi doctor (O-6 dan O-7)

Usulan perintah khusus: `sigma doctor --migrate-mailbox [--dry-run]`. Default doctor, --all-versions dan --reconstruct mendiagnosis migrasi tertunda; tidak mereset mailbox sebagai efek samping rekonsiliasi chain. --repair-workspace tetap terbatas pada workspace. Mode migrasi mailbox terpisah dari opsi doctor lainnya, berlaku satu proyek sekaligus, termasuk tanpa chain. MCP doctor hanya melaporkan rencana/jumlah/masalah, `applied: false`.

Urutan transaksi yang diusulkan:

1. Periksa index, duplikasi, role/type, semua source/destination, batas workspace, orphan, dan migration journal. Dry-run membaca dan melaporkan saja.
2. Peroleh lock proyek yang sama dengan MCP archive; baca ulang dan ulangi preflight. Mutasi mailbox CLI lain menggunakan lock itu juga sehingga tidak menimpa hasil migrasi. Query tetap read-only.
3. Simpan journal durable berisi index awal, daftar ID/path asal/tujuan, hash isi, status awal, dan tahap transaksi. Lokasi usulan `Sigma/messages/migrations/v2/`. Journal ini khusus migrasi, bukan approval/control transaction MCP.
4. Salin file ke tujuan secara eksklusif; verifikasi byte/hash. Jangan hapus source sebelum index baru berhasil di-commit atomik. Benturan tujuan tanpa bukti journal transaksi yang sama ditolak, termasuk file yang kebetulan bernama sama.
5. Tulis index format baru: MEMO -> Sigma/memo/<ROLE>/LEGACY; lainnya -> Sigma/messages/<ROLE>/LEGACY. UNREAD -> READ; READ/ARCHIVED/OUTDATED dipertahankan. Simpan provenance (`original_file`, `original_status`, `migrated_at`) dan pertahankan ID, reply_to, created_at, related_artifact, action, subject, serta attachment.
6. Setelah commit marker, hapus hanya source yang sudah diverifikasi sesuai journal dan tandai completed. Bila terhenti sebelum commit, pulihkan snapshot dan salinan transaksi; sesudah commit, selesaikan cleanup secara idempoten. Konflik hash akibat edit luar tidak ditimpa; hentikan dan laporkan pemulihan manual yang diperlukan.
7. Pengulangan sesudah completed menghasilkan nol pemindahan/reset. Pesan/memo baru tetap di konteks asal dan statusnya tidak berubah.

Isi Markdown lama dipertahankan sebagai bukti, termasuk status yang tercetak saat pengiriman; index adalah status operasional. Pembacaan LEGACY memberi keterangan reset administratif agar header UNREAD historis tidak disalahartikan. Attachment di lokasi global tetap di tempatnya; path terkelola yang menunjuk file yang dipindahkan diperbarui pada index melalui peta asal/tujuan. Tidak ada penggantian teks bebas dalam body atau path eksternal.

Index rusak, source hilang, orphan Sigma, benturan tujuan, atau identity/path konflik menolak seluruh transaksi sebelum pemindahan. Orphan tidak mendapat ID/role/type hasil tebakan; berkas yang tidak dikenali tetap di tempat dan dilaporkan. Attachment hilang dilaporkan sebagai masalah integritas, tanpa menghapus rujukannya. Setiap reset/pemindahan tercatat; laporan tidak menyebut reset sebagai pembacaan oleh role.

## 6. Keputusan terbuka

**TERKUNCI (Director, 7 Oktober 2026):** "semua rekomendasi anda disetujui, silahkan lanjutkan". Persetujuan mencakup O-1 sampai O-7, detail perilaku, build dan pengujian pada rencana ini. Commit, push, sync aset, dan migrasi proyek nyata tidak termasuk.

| ID / register | Pertanyaan dan opsi | Rekomendasi dan alasan | Jawaban Director |
|---|---|---|---|
| O-1 / T-02 | GENERAL ikut send gate semua intent dan kuota intent, atau punya kewajiban/kuota tersendiri? | GENERAL non-MEMO UNREAD ikut send gate di semua konteks, termasuk sebelum ada intent. GENERAL memo memiliki kuota per role tersendiri (default/config yang sama, 5), tidak menghabiskan slot intent. Pesan umum yang selalu ditampilkan tetap wajib dibaca; memo umum tidak menghalangi kontinuitas intent lain. | Disetujui Director, 7 Oktober 2026 |
| O-2 / T-02 | Reply tidak dikenal atau berbeda intent boleh dikirim dengan warning, atau ditolak? | Tolak parent tidak dikenal, parent intent tidak aktif, dan perubahan GENERAL/LEGACY ke chain. Warisi konteks parent bila ref tidak diberikan; perpindahan minor dalam intent yang sama boleh. Ini menutup relasi balasan yang terlihat sah tetapi mencampur pekerjaan. | Disetujui Director, 7 Oktober 2026 |
| O-3 / T-03 | Retensi digabung message/memo, atau dipisah; riwayat dibuka oleh --all, atau selector tersendiri? | Keep READ per role + intent + jenis; GENERAL/LEGACY terpisah. --all tetap perluasan status, akses lintas konteks eksplisit lewat --intent/--context/--all-intents dan ID. Clear message/memo dipisah; tanpa penghapusan file. Mencegah membaca memo intent baru meng-outdate pesan konteks lain. | Disetujui Director, 7 Oktober 2026 |
| O-4 / T-28 | Referensi yang belum dapat dihubungkan harus ditolak seluruhnya, atau masuk GENERAL? | Kosong/N/A/GENERAL masuk GENERAL; sintaks artefak valid tetapi versi belum terdaftar masuk GENERAL dengan warning dan menyimpan ref asli. Pemilik intent lain, ambigu, atau chain rusak tetap ditolak. Tidak ada reclassify otomatis ketika artefak itu muncul kemudian. Menjalankan keputusan cadangan GENERAL tanpa melonggarkan larangan lintas intent yang sudah diketahui. | Disetujui Director, 7 Oktober 2026 |
| O-5 / T-29 | Index tunggal tetap dipakai, atau message/memo memiliki index masing-masing? | Pertahankan index tunggal, tambah mailbox_format: 2 dan metadata intent/context tiap entry. Lokasi file dipisah sesuai keputusan Director. ID/reply/attachment dan transaksi archive MCP tidak perlu diputus ke dua index; SCHEMA_VERSION tidak berubah. | Disetujui Director, 7 Oktober 2026 |
| O-6 / T-05 | Reset/migrasi LEGACY otomatis pada doctor biasa, atau mode doctor khusus? | Mode khusus --migrate-mailbox dengan preview --dry-run; doctor biasa/MCP melaporkan kebutuhan. Memenuhi arahan migrasi melalui doctor, dengan batas jelas karena reset UNREAD bukan diagnosis biasa. Pengembangan menguji fixture; migrasi proyek nyata memerlukan instruksi tersendiri. | Disetujui Director, 7 Oktober 2026 |
| O-7 / T-05 | Migrasi memproses bagian sehat sambil melewati masalah, atau menolak seluruh transaksi? | Preflight seluruh mailbox dan transaksi durable satu proyek; konflik/source hilang/orphan Sigma menolak sebelum move. Pertahankan ID/ref/provenance, rollback sebelum commit dan cleanup idempoten sesudahnya. Index tunggal membuat pemulihan seluruh transaksi lebih mudah dinilai daripada history setengah pindah. | Disetujui Director, 7 Oktober 2026 |

T-04 **tidak diajukan ulang sebagai pengecualian**: keputusan Director sudah menetapkan semua minor/action intent yang sama berbagi kewajiban baca. F03 menjadikannya kasus uji, termasuk FYI minor sebelumnya. Jika Director hendak mengubahnya, diperlukan keputusan baru yang eksplisit.

## 7. Strategi uji dan kriteria selesai

Tahap rencana tidak menjalankan build/test. Setelah rencana dan eksekusi disetujui:

| Area | Bukti yang harus lulus |
|---|---|
| Keanggotaan | Dua intent aligned, dua legacy, serta transisi legacy -> aligned; PLAN/EXEC legacy tidak dihitung menurut prefix; mayoritas referensi lintas tipe/role-prefix terhubung ke pemilik yang benar |
| Resolusi negatif | Intent lain/tanpa aktif, unknown ref, malformed ref, pemilik ambigu, chain/index/path rusak; semua penolakan tanpa file/attachment/index baru |
| Gate | UNREAD intent lain tidak memblokir; intent yang sama selalu memblokir untuk semua action/minor; GENERAL sesuai O-1; MEMO dikecualikan |
| Kuota | Lima UNREAD per intent/role, antar-minor digabung; role/intent lain/GENERAL terisolasi; read membebaskan satu slot; konfigurasi custom/0 dipertahankan |
| Tampilan | Default, --all, --outdated, selector riwayat, tanpa chain, GENERAL selalu tampak pada default; CLI bootstrap/MCP orientation mempunyai hitungan yang sama dan benar-benar read-only |
| Balasan | Parent valid, inheritance, explicit ref minor lain pada intent sama, intent tidak aktif, parent hilang/GENERAL/LEGACY, tanpa side effect pada penolakan |
| Retensi | Banyak READ per intent/role/type; tidak menyapu kelompok lain; UNREAD/ARCHIVED/ID baru dibaca terlindungi; config keep 0 dan clear keep 0 berbeda sesuai kontrak |
| Integritas | Kedua pohon mailbox/konteks diperiksa; orphan/missing/misplaced file, metadata mismatch, separator Windows, traversal/symlink/junction; paritas diagnosis CLI/MCP |
| Migrasi | UNREAD/READ/ARCHIVED/OUTDATED, MEMO/non-MEMO, ID/reply/attachments, tanpa chain, dry-run tanpa write, ulang dua kali, format baru tidak berubah; isi Markdown tetap identik |
| Kegagalan migrasi | Failpoint setelah journal/copy/index commit/cleanup, crash dan retry, hash conflict, destination collision, corrupt/missing index, source hilang, orphan Sigma; journal tidak dijadikan bukti approval |
| Koordinasi mutasi | Migrasi berhadapan dengan send/memo/read/clear/archive MCP; satu pemegang lock, tidak ada lost update/duplikasi/overwrite; lease pulih setelah proses mati |
| Regresi | Tes mailbox/memo/outdated/path/control archive, MCP binding/policy/state_revision, doctor/lifecycle, dan async CLI/operation log tetap benar |

Urutan validasi: `npx tsc --noEmit`; laporkan titik build lalu `npm run build` (dist dilacak dan memengaruhi symlink global sigma-mcp); tes terarah menggunakan dist yang baru; seluruh suite sekali setelah koreksi terkait selesai; `git diff --check` dan inspeksi scope. Ulang build/test hanya bila ada perubahan/failure yang memerlukannya. Jangan menjalankan command migrasi terhadap proyek nyata atau memakai MCP Sigma terikat proyek untuk eksperimen.

Selesai bila keputusan tertutup, seluruh perilaku terkunci/rekomendasi disetujui terimplementasi, kriteria di atas lulus, perubahan dist cocok sumber, laporan F03/F00 diperbarui, dan tidak ada sinkronisasi/commit tanpa instruksi.

## 8. Risiko dan dependensi

- Reset administratif dapat terlihat sebagai bukti baca. Provenance dan keterangan LEGACY harus eksplisit; tidak membuat receipt pemahaman role.
- Folder minor legacy tidak mewakili major intent. Seluruh selector menggunakan intent_version; jangan menyalin kebiasaan prefix ke kuota/gate.
- Referensi tidak dikenal ke GENERAL dapat menyembunyikan kesalahan ketik. Warning/ref asli dan penolakan konflik diperlukan; O-4 masih terbuka.
- Memisahkan folder tidak cukup: scanner, bootstrap, quota, retention, archive dan project initialization wajib ikut berubah.
- CLI memakai handler sinkron; lock shared memerlukan integrasi async yang benar dan tes operation log. Journal MCP saat ini terikat approval/idempotency; jangan menggunakannya dengan approval buatan untuk migrasi CLI.
- Multi-file migration tidak atomik melalui satu rename. Journal/copy-before-commit dan recovery harus diuji; mutation lain wajib memakai lock yang sama. Penyuntingan manual di luar lock bisa menimbulkan konflik hash yang memerlukan keputusan manual.
- Kehilangan index lama tidak diatasi dengan menganggap semua file GENERAL atau membangkitkan ID baru. Diagnosis/pemulihan manual diperlukan.
- Biner lama tidak aman menulis index/konteks baru. F09 mendistribusikan runtime/aset yang sesuai; jangan sinkronisasi parsial di F03. Server MCP yang sudah berjalan harus dimulai ulang agar memuat hasil build kelak.
- F01/F09: review teks gate/kuota/aktivasi pada rules/memory dan paritas aset proyek. Master read/write-memo perlu mencerminkan konteks tanpa memperluas otorisasi isi memo; aturan sesi terpisah tetap berlaku.
- Protocol terakhir: revisi struktur mailbox, identitas per intent, GENERAL/LEGACY, gate semua action/minor, kuota UNREAD, akses riwayat, reset administratif dan retensi. Tidak disunting pada F03.
- Registries yang memuat operasi/help baru diperbarui bersama F09; tidak menjalankan refresh-registries pada tahap ini.

## 9. Urutan langkah implementasi

**Urutan disetujui dan selesai dieksekusi; hasil pada bagian 10.**

1. Kunci keputusan, verifikasi ulang basis Git, dan finalkan kontrak metadata/selector/referensi/migrasi.
2. Implementasi resolver dan engine scope/integrity/index atomik tanpa perubahan chain/lifecycle.
3. Implementasi koordinasi mutasi serta journal/preview/migrasi/recovery; validasi negatif dan failpoint lebih dahulu.
4. Integrasikan send/memo/inbox/clear/archive dan scaffold proyek; pertahankan kepemilikan MCP serta akses ID.
5. Integrasikan orientasi/diagnosis CLI/MCP dan doctor tanpa chain; pastikan query tidak menulis.
6. Selaraskan teks master MEMO-TEMPLATE serta read/write-memo empat target; catat kebutuhan rules/memory/Protocol/registry untuk fokus pemilik.
7. TypeScript, build yang dilaporkan, uji terarah dan regresi penuh; periksa scope/hasil dist dan dokumentasikan hasil.
8. Serahkan laporan F03. Commit/push, sinkronisasi, dan migrasi proyek nyata tetap menunggu instruksi Director.

## 10. Laporan eksekusi F03

Implementasi dilakukan di master setelah persetujuan eksplisit Director. Saat laporan implementasi dibuat, perubahan belum di-commit dan tidak ada push. Director kemudian melakukan commit 9f1bea6 dan melaporkan push berhasil; kesamaan main/origin/main terverifikasi saat awal F04. Tidak ada sinkronisasi global/proyek atau migrasi proyek nyata dalam eksekusi pengembangan ini.

### Perubahan yang diterapkan

- `mailboxContext.ts` menyimpan/resolusi identitas intent terpisah dari konteks folder. Referensi prefix lama maupun bentuk baru, major INTENT/ROADMAP/CLOSE dan minor PLAN/EXEC mengikuti keanggotaan tracker chain. Offset legacy tidak diubah. Referensi asing/ambigu/konflik ditolak sebelum file atau attachment dibuat; versi belum terdaftar masuk GENERAL dengan warning tanpa reclassify otomatis.
- Index tetap `Sigma/messages/index.json`, format mailbox 2. Message disimpan di `Sigma/messages/<ROLE>/<CONTEXT>/`, memo di `Sigma/memo/<ROLE>/<CONTEXT>/`. Index ditulis atomik, separator dinormalisasi dan metadata/path divalidasi. SCHEMA_VERSION governance tidak berubah.
- Tampilan normal, indikator memo, gate, kuota dan orientasi CLI/MCP memakai scope bersama. Seluruh minor/action intent yang sama ikut send gate; GENERAL non-MEMO ikut semua gate; GENERAL memo mempunyai kuota tersendiri. Balasan mewarisi konteks parent atau menunjuk minor lain dalam intent yang sama; parent hilang, intent tidak aktif dan pengubahan konteks GENERAL/LEGACY ditolak.
- Retensi dipisah per role, intent dan message/memo. Clear minor eksplisit dibatasi pada selector itu; clear normal menyasar intent aktif. GENERAL/LEGACY/lintas intent memakai selector eksplisit. `memo clear` ditambahkan; --all tetap selector status, OUTDATED memakai --outdated. Tidak ada penghapusan history oleh clear/retensi.
- CLI mailbox memakai lock proyek yang sama dengan archive MCP; kepemilikan lease diperiksa sebelum write. CLI memakai parseAsync; ownership/idempotency/journal archive MCP dipertahankan. Pembacaan chain berulang dalam satu validasi memakai cache lokal agar tidak membaca ulang state untuk setiap entry.
- `mailboxMigration.ts`: mode doctor --migrate-mailbox dan --dry-run, preflight seluruh mailbox, journal snapshot/mapping/hash, salin eksklusif sebelum commit index, cleanup source setelah commit, recovery sebelum/sesudah commit. Snapshot journal yang rusak, hash berubah, benturan, orphan, source hilang dan path keluar proyek ditolak. UNREAD lama menjadi READ; status lain dipertahankan. Provenance, ID, reply, ref, timestamp dan byte Markdown dipertahankan; attachment yang menunjuk source terkelola diperbarui ke destination.
- Doctor biasa, all-versions dan reconstruct mendiagnosis kebutuhan migrasi tanpa memigrasikan. Mode migrasi terpisah dari rekonsiliasi chain/workspace, termasuk sebelum INTENT pertama. MCP doctor tetap diagnosis saja; tool mailbox yang sebelumnya ditarik tidak dihidupkan kembali. Orientation mempunyai mailbox_context/status/warnings untuk membedakan data rusak dari antrean kosong. Integrity CLI/MCP memakai satu engine yang memeriksa kedua pohon mailbox.
- Scaffold proyek, help konfigurasi, MEMO-TEMPLATE master dan read-memo/write-memo pada empat target diselaraskan. Otorisasi membaca isi memo dan aturan sesi terpisah tidak diperluas. Rules/memory, Constitution, Protocol dan registries tidak disunting; sinkronisasi aset tetap F09.

### Bukti validasi

- TypeScript --noEmit dan build tsc lulus. Build terakhir dilakukan setelah penambahan diagnosis mailbox pada reconstruct; dist yang dilacak dan keluaran modul baru cocok sumber. Build memengaruhi runtime melalui symlink global; proses MCP yang sudah berjalan perlu dimulai ulang untuk memuat modul baru.
- Tes terarah sebelum review akhir: 8 berkas / 128 tes lulus. Suite penuh pertama: 69 berkas / 963 tes lulus. Setelah guard tambahan dan tes boundary/journal/minor-clear, **npm test lulus: 69 berkas / 966 tes, exit 0**. Penambahan total terhadap F02 = 32 tes dalam `test/mailbox-context.test.ts`.
- Tes baru mencakup offset/aligned, minor/action gate, kuota GENERAL/intent, isolasi tampilan/retensi, balasan, path/junction dengan attachment, perpindahan byte-preserving, semua status lama, orphan/collision/corrupt backup/hash conflict, retry pada empat failpoint, dua penulis CLI, ownership archive, dan proses nyata berhenti setelah index/commit beserta pemulihan stale lease.
- `git diff --check` bersih; inspeksi akhir memastikan perubahan hanya pada sumber/tes/dist F03, teks pendamping memo, dan dokumen rencana/status. HEAD tetap `0c3e3b1`.
- Fixture archive/orientasi diperbarui ke metadata format 2. Tes Windows-path historis melalui migrasi sebelum read, serta check tetap tidak menulis index. Clear GENERAL pada fixture sebelum chain memakai selector GENERAL eksplisit, sesuai batas baru. Tes legacy bukan dipaksa menjadi GENERAL.
- Setelah suite penuh lulus, tambahan terakhir hanya diagnosis mailbox pada reconstruct doctor; build diperbarui dan tes doctor/reconstruct/F02/MCP terkait lulus kembali: **6 berkas / 68 tes, exit 0**. Tidak ada perubahan source setelah pemeriksaan terakhir itu.

### Batas operasional dan tindak lanjut

- Dry-run/diagnosis tidak menulis data mailbox, journal atau status. CLI mempertahankan operation log umum yang sudah ada; pemanggilan CLI tetap dapat menambah log operasi. Tes read-only pada engine/MCP memastikan index/file/journal tidak berubah.
- Migrasi membutuhkan index lama yang dapat dipercaya; orphan tanpa index atau konflik tidak diberi identitas tebakan. Kasus hash/snapshot berubah memerlukan pemeriksaan manual, tidak ditimpa. LEGACY READ adalah reset administratif dan bukan receipt pemahaman role.
- Biner/aset lama belum aman digunakan untuk menulis format 2; distribusi dan validasi salinan proyek dilanjutkan pada F09. Riwayat rules/Protocol yang masih menjelaskan kuota/gate lintas proyek dicatat untuk fokus pemilik, tidak diamendemen pada F03.
- Contoh akses: `sigma inbox --role dev --intent v3 --all`; `sigma memo list --role dev --context LEGACY --all`; `sigma inbox --role dev --all-intents --outdated`. Perintah migrasi proyek nyata tidak dijalankan pada sesi ini.
