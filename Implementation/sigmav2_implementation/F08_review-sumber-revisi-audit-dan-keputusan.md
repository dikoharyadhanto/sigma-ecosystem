# F08 — Review sumber/kesiapan, revisi dari artefak lama, paket audit, dan keputusan tertunda

Tanggal: 14 Oktober 2026
Status: SELESAI pada master, 14 Oktober 2026. O-1 sampai O-10 disetujui dan F08a–F08c dieksekusi; build serta 78 berkas / 1.209 tes lulus. Hasil/batas lengkap pada bagian 11. Distribusi dan migrasi proyek nyata tetap di luar cakupan.
Sifat: catatan pengembangan master Sigma, bukan artefak governance proyek terdaftar. Otorisasi implementasi berasal dari instruksi eksplisit Director yang dicatat pada bagian 10.

Dasar:
- [F00](F00_indeks-dan-register.md), Strategy Action 10–12.
- [Diskusi Sigma v2](../../Discussion/Evaluation-06102026/diskusi_rencana_perubahan_sigma_v2.md), pembelajaran audit UX (R2, R5, R6), kasus AUD KLHK (K3/K4), dan Strategy Action.
- [F04](F04_lifecycle-approved-locked-doctor-dan-revisi.md) dan [F05](F05_amandemen-intent-git-dan-penghapusan-tier.md): fondasi persetujuan, revisi, sertifikasi, snapshot, dan diff yang telah diterapkan.
- Arahan Director 14 Oktober 2026: mulai F08; F07 menjadi PENDING PROCESS. F07 tidak dijadwalkan otomatis untuk dikerjakan, tidak menjadi prasyarat F08/distribusi, dan hanya ditinjau kembali bila evaluasi penggunaan nyata menunjukkan kebutuhan.

Label: TERKUNCI = arahan Director; TERVERIFIKASI = hasil baca source; REKOMENDASI = usulan, belum keputusan; TERBUKA = membutuhkan keputusan.

## 1. Tujuan dan batas

F08 mengurangi pekerjaan manual untuk memeriksa sumber kontrak, membuat revisi terarah, menyiapkan audit, dan menemukan keputusan yang belum selesai. Tiga keluaran berurutan:

1. **F08a — Review sumber dan kesiapan:** tampilkan teks serta fungsi ID INTENT yang dirujuk PLAN; pisahkan hasil pemeriksaan struktur, sertifikasi isi, dan penilaian kesiapan pekerjaan.
2. **F08b — Draf dari artefak lama dan diff:** gunakan isi lama sebagai bahan revisi, dengan identitas baru, reset keabsahan/bukti, dan perbandingan perubahan.
3. **F08c — Paket audit dan keputusan tertunda:** kumpulkan sumber yang tepat dan respons asli AUD, serta tampilkan keputusan dalam konteks intent aktif.

Tidak mengubah tujuan Director, otoritas role, lifecycle/gate F04, model amandemen F05, penomoran F02, atau mailbox F03. Tidak menghidupkan kembali tier INTENT. Tidak menjalankan pilot F07, menulis ulang artefak LOCKED, mengubah proyek nyata, menyinkronkan host, atau mengubah Constitution/Protocol. Dampak dokumentasi Protocol dicatat untuk review akhir; distribusi melalui F09.

## 2. Keputusan Director yang sudah terkunci

- Mulai F08 setelah F07 ditunda, bukan menunggu hasil pilot.
- Penundaan F07 bergantung pada evaluasi penggunaan nyata; tidak ada janji atau jadwal pengerjaan F07.
- Urutan pembahasan F08: review sumber/kesiapan → revisi dari artefak lama → paket audit/keputusan tertunda.
- Folder ini repositori master, bukan proyek Sigma terdaftar; rencana tidak dibuat lewat intent/plan/exec new.
- Persetujuan memulai penyusunan F08 tidak diperlakukan sebagai persetujuan seluruh desain baru di bagian 6.

## 3. Peta dampak dan fakta source

Pemeriksaan baca saja pada 14 Oktober 2026; nomor baris perlu diverifikasi ulang sebelum implementasi.

| Lokasi | Fakta terverifikasi | Dampak F08 |
|---|---|---|
| src/commands/plan.ts, plan check | Memilih PLAN, memanggil validateSigmaDocFile, mencetak laporan serta lifecycleView. | Titik integrasi review sumber; pertahankan perilaku check yang sudah dipakai. |
| src/utils/docCheck.ts, evaluatePlanV3Gate | Memeriksa penyebutan versi INTENT dan isian Requirements served; belum menampilkan teks ID sumber atau membuktikan keselarasan makna. | Pengurai sumber dan laporan review harus dipisahkan dari validator struktur. |
| Sigma/templates/FMN-PLAN-TEMPLATE.md, Source Alignment | Memuat versi, REQ, SC/OS, CON, RR, Quality Standards, dan Planned Stage; instruksi tabel saat ini IDs only. | Tidak harus menambah kutipan panjang ke PLAN; laporan dapat menyajikan teks dari sumber saat dibaca. |
| Sigma/templates/DIR-INTENT-TEMPLATE.md | Schema 5: SC/OS/CON/RR dalam tabel, REQ dalam heading dan isi. | Ekstraksi harus mengikuti bentuk sumber; angka ID tanpa isi tidak cukup. Schema lama perlu fixture tersendiri. |
| src/engine/revisions.ts | Sudah ada hash kontrak, ledger/snapshot, staging, acuan revisi INTENT/PLAN, sertifikasi, dan receipt notifikasi. currentIntent menolak isi yang berbeda dari hash tersertifikasi. | Gunakan fondasi F04; jangan membuat alur sertifikasi paralel. Baseline historis yang tidak diketahui tetap tidak diketahui. |
| src/services/intentDraftService.ts, planDraftService.ts, execDraftService.ts | Pembuatan draf memakai template; input service saat ini belum menyediakan sumber salinan versi lama. EXEC mengikuti versi PLAN dan menjaga satu EXEC per PLAN. | Jalur salin harus memakai generator identitas/gate yang ada; jangan menyalin metadata lama atau membuat versi EXEC independen. |
| src/utils/artifacts.ts | resolveTemplate mengutamakan ~/.sigma/templates sebelum bundle master. | Uji harus mengendalikan sumber template; kelulusan master tidak membuktikan host telah terdistribusi. |
| src/mcp/tools/checkDocument.ts | sigma_check_document memproyeksikan hasil validator dan lifecycle; versi ambigu ditolak. | Review CLI/MCP memakai service bersama dan field tambahan yang kompatibel. |
| src/mcp/control/tools/create*Draft.ts; src/mcp/control/artifactDraftUpdate.ts | Draft creation memakai state revision/idempotensi; update hanya DRAFT intent/plan/exec dan memeriksa hash file. | Perluasan clone harus ikut kontrol role, binding, hash, transaksi dan pemulihan yang ada. |
| src/commands/control.ts; src/engine/controlStore.ts | Ada show/approve/reject per ticket, masa berlaku, target hash, dan review_package. AuditEntry merekam metadata transaksi, bukan isi/verdict asli AUD. | Daftar keputusan dapat memakai ticket yang ada; audit teknis bukan audit substantif AUD. |
| src/mcp/tools/evidence.ts | sigma_get_evidence mengembalikan status/referensi/hash satu PLAN/EXEC, bukan badan dokumen. | Paket audit perlu reader artefak dan manifest sumber, bukan hanya status evidence. |

Penelusuran awal deklarasi CLI dan service draf belum menemukan opsi clone/from; pemeriksaan kedua pada input MCP create draft juga belum menemukan parameter tersebut. Belum ada dasar menyatakan seluruh kemampuan sejenis di repo tidak ada; verifikasi registrasi operasi dan jalur lain sebelum menambah command.

## 4. Spesifikasi perilaku yang diusulkan

Rekomendasi bagian ini disetujui Director 14 Oktober 2026; rincian pelaksanaannya ada pada bagian 10.

### 4.1 F08a — Review sumber/kesiapan

- Resolver menerima identitas PLAN terdaftar, bukan arbitrary path. Jika beberapa target terbuka, pengguna memilih versi eksplisit.
- Tampilkan identitas proyek/chain/PLAN dan INTENT rujukan, schema, hash isi saat dibaca, serta acuan revisi tersertifikasi bila tersedia. Bedakan sumber saat ini dari snapshot acuan PLAN; jangan menyajikan keduanya sebagai versi isi yang sama ketika berbeda.
- Ekstrak referensi dari bagian Source Alignment, lalu tampilkan ID, teks sumber lengkap yang relevan, lokasi/section, kategori, dan fungsi yang diklaim PLAN: requirement dilayani, scope dipatuhi/dikecualikan, constraint dipatuhi, risiko ditangani. Fungsi tersebut klaim kontrak, bukan kesimpulan semantik validator.
- ID hilang, duplikat/ambigu, rujukan lintas intent, versi berbeda, atau sumber tidak terbaca dilaporkan secara eksplisit. Tidak memilih kecocokan pertama, mencari bebas di proyek lain, atau mengarang teks sumber.
- Quality Standards dan Planned Stage bukan selalu ID; tangani sebagai rujukan bernama dengan asal yang jelas. Pembacaan ROADMAP dibatasi artefak terdaftar.
- Tampilkan tiga dimensi terpisah: (a) struktur/persyaratan administratif; (b) sertifikasi dan kesesuaian hash/acuan; (c) penilaian semantik kesiapan scope oleh FMN/Director.
- Nilai awal penilaian semantik adalah belum dinilai. Label yang mungkin dipakai: READY, SCOPE_GAP, PENDING_ALIGNMENT, UNKNOWN; kosakata final bagian 6. Jangan menyimpulkan READY hanya karena ID ada, alasan terisi, atau kata kunci cocok.
- Check/review tetap baca saja. Temuan baru tidak otomatis mengubah RATIFIED/APPROVED/LOCKED, menulis progress, atau mengubah gate. Penolakan sertifikasi yang telah ada di F04/F05 tetap berlaku.
- Usulan permukaan: perluasan opsional plan check --sources dan parameter setara sigma_check_document. Nama ini belum keputusan dan belum tersedia sebagai fitur F08.
- Bila penilaian semantik belum memiliki pencatatan terstruktur, laporan menyatakan unknown/belum dinilai; jangan menganggap narasi bebas sebagai persetujuan yang tersertifikasi.

### 4.2 F08b — Draf dari versi lama dan diff

- Pilih sumber eksplisit dengan type, chain dan version di proyek yang sama; target mengikuti gate serta generator versi yang berlaku. Sumber tetap utuh.
- Rekomendasi cakupan awal: INTENT dan PLAN. EXEC memerlukan desain reset bukti dan pasangan PLAN yang lebih rinci sebelum diaktifkan; CLOSE/ROADMAP tidak otomatis termasuk.
- Isi yang dipindahkan berupa tujuan, scope, kontrak atau narasi relevan. Template tujuan mengikuti schema yang didukung runtime; mapping schema lama/baru harus eksplisit. Jika mapping tidak didukung, tolak sebelum menulis dan laporkan kebutuhan penyusunan manual.
- Identitas proyek/chain/versi, metadata SIGMA:CHAIN, status, timestamp, sertifikasi, amendment/tag, persetujuan, hash kontrak, revision ledger, dan receipt tidak diwarisi. Acuan sumber untuk target dihitung ulang dari chain tujuan.
- Verdict AUD/FMN, checklist persetujuan, hasil tes, klaim pekerjaan selesai dan bukti lama direset atau ditandai hanya sebagai riwayat sumber di luar klaim aktif. Reset tidak boleh menghapus kewajiban kontrak.
- Catat provenance sumber (identitas, path relatif, hash) dan tampilkan diff isi sebelum hasil dipakai sebagai draf final. Sumber berubah sejak preview → tolak; review ulang.
- Salin tidak supersede sumber, tidak mengaktifkan perubahan pada kontrak APPROVED, dan tidak membatalkan pasangan PLAN/EXEC. Supersede/approval tetap operasi terpisah.
- Gagal parsial tidak meninggalkan chain yang menunjuk file hilang; CLI/MCP harus menyepakati jaminan transaksi, recovery, dan idempotensi. Rincian file transaksi ditetapkan sebelum implementasi.
- Draf dari sumber lama tidak mewarisi persetujuan lama; audit delta tetap menilai dampak pada keseluruhan kontrak.

### 4.3 F08c — Paket audit dan keputusan tertunda

- Paket audit bersifat snapshot untuk satu target eksplisit. Manifest memuat proyek, chain, type/version, hash target, sumber INTENT/PLAN/ROADMAP yang relevan, revisi/sertifikasi, bukti yang dipilih, serta daftar yang hilang/tidak disertakan.
- Baca hanya artefak terdaftar dan bukti yang diizinkan dalam proyek. Tidak menyapu home directory, arbitrary log, atau path yang keluar melalui symlink.
- Sumber atau target berubah setelah paket dibuat → tandai stale; tidak gunakan audit lama sebagai bukti untuk isi baru. Baseline unknown tidak dinaikkan menjadi certified.
- Rekam respons asli AUD utuh bersama hash, identitas target/paket dan asal respons. Ringkasan terstruktur boleh ditambahkan, tetapi tidak mengganti teks asli, verdict, atau mengeksekusi persetujuan.
- Tidak mengirim paket ke AUD/vendor secara otomatis; ekspor dan pencatatan tidak memberi izin mengirim pesan eksternal.
- Daftar keputusan default hanya intent aktif. Pisahkan ticket transaksi dari pertanyaan substantif; ticket expired/consumed/rejected bukan pending approval.
- Riwayat chain lain hanya lewat selector eksplisit. Pertanyaan substantif memerlukan pencatatan eksplisit dan rujukan artefak/hash; jangan menebak status keputusan dari semua kalimat tanya.
- Penyelesaian pertanyaan substantif tidak meratifikasi, approve, supersede, atau mengubah gate. Jika isi target berubah, tandai kebutuhan evaluasi ulang.
- Bentuk file penyimpanan, akses tulis role, command dan MCP baru belum ditetapkan. Detail F08c dibahas setelah F08a/F08b stabil.

## 5. Kompatibilitas dan migrasi

- Schema INTENT 4/5, PLAN 2/3, dan model legacy_lock/paired_approval menjadi kasus uji; jangan menyamakan legacy dengan invalid.
- F08 tidak memigrasikan proyek nyata atau menambah field wajib pada chain tanpa keputusan khusus. Sumber/revisi historis tidak tersedia → laporkan unknown.
- Tidak mengganti nama artefak; F10 menangani nama dengan/tanpa prefix. Resolver baru harus terpusat agar F10 tidak memerlukan perubahan tersebar.
- F12 menangani identitas versi instalasi/proyek; F08 hanya mencatat hash sumber review/paket yang relevan.
- Perubahan rule memerlukan pembaruan hash role memory sesuai F01. Skill/bridge diperbarui di master; salinan terpasang tetap menunggu F09.
- F07 bukan gate. Struktur yang ada digunakan; temuan keterbacaan pada penggunaan nyata dapat memicu keputusan terpisah untuk membuka F07 kembali.

## 6. Keputusan terbuka

Seluruh rekomendasi O-1 sampai O-10 disetujui Director 14 Oktober 2026 dengan instruksi eksekusi. Pertanyaan dan alasan dipertahankan untuk keterlacakan.

| ID | Pertanyaan | Rekomendasi dan alasan | Status |
|---|---|---|---|
| O-1 | Permukaan review sumber? | Tambahkan mode opsional plan check --sources dan parameter setara sigma_check_document, memakai service bersama; keluaran default lama tetap kompatibel. | DISETUJUI 14 Oktober 2026 — F08a |
| O-2 | Apakah hasil review baru menjadi gate otomatis? | Tidak. Laporkan temuan secara terpisah; pertahankan gate sertifikasi F04/F05. Validasi ID tidak membuktikan keselarasan makna. Gate baru perlu keputusan terpisah. | DISETUJUI 14 Oktober 2026 — F08a |
| O-3 | Bagaimana penilaian semantik kesiapan dicatat? | F08a menyajikan sumber/fakta dan status belum dinilai; FMN memberi penilaian kepada Director dalam review. Pencatatan terstruktur masuk F08c, terikat target/hash. READY tidak disimpulkan mesin. | DISETUJUI 14 Oktober 2026 — F08a |
| O-4 | Sumber review: isi terkini atau acuan saat persetujuan? | Tampilkan keduanya bila tersedia dan berbeda, dengan hash/revisi serta label asal. Bila acuan belum tersertifikasi/tersedia, laporkan unknown dan jangan menggantikannya diam-diam dengan isi terkini. | DISETUJUI 14 Oktober 2026 — F08a |
| O-5 | Jenis artefak yang dapat dibuat dari versi lama? | Mulai INTENT dan PLAN. EXEC ditahan sampai desain reset hasil/bukti dan pasangan PLAN dapat direview; CLOSE/ROADMAP di luar cakupan awal. | DISETUJUI 14 Oktober 2026 — F08b |
| O-6 | Batas asal dan transformasi schema clone? | Sumber terdaftar dalam proyek yang sama, chain/version eksplisit; mapping ke template tujuan hanya untuk pasangan schema yang didukung. Tidak menyalin mentah schema tak dikenal. | DISETUJUI 14 Oktober 2026 — F08b |
| O-7 | Apakah salinan otomatis menggantikan artefak lama? | Tidak. Buat DRAFT baru dan provenance/diff; supersede, aktivasi, ratify dan approve tetap memakai aturan/otorisasi yang berlaku. Detail aktivasi INTENT baru harus mengikuti perilaku intent new dan dijelaskan di preview. | DISETUJUI 14 Oktober 2026 — F08b |
| O-8 | Bentuk dan tempat paket audit? | Manifest terstruktur + dokumen baca manusia, sumber berupa snapshot/hash yang terbatas; lokasi serta file transaksi ditetapkan saat merinci F08c. Jangan menambah folder resmi tanpa keputusan. | DISETUJUI 14 Oktober 2026 — F08c |
| O-9 | Respons AUD boleh diterjemahkan menjadi verdict otomatis? | Simpan respons asli dan metadata; pengisian verdict terstruktur membutuhkan verifikasi eksplisit, tidak pernah menjadi approval Director. | DISETUJUI 14 Oktober 2026 — F08c |
| O-10 | Daftar keputusan hanya ticket atau juga pertanyaan substantif? | Keduanya, ditampilkan terpisah. Ticket dibaca dari control store; pertanyaan substantif dicatat eksplisit, berlingkup intent/artefak/hash. Desain penyimpanan dan otoritas tulis diajukan sebelum implementasi. | DISETUJUI 14 Oktober 2026 — F08c |

Rincian command, penyimpanan, otoritas dan batas implementasi yang diturunkan dari rekomendasi disetujui dicatat pada bagian 10. Persetujuan tidak mengubah batas distribusi F09 atau status F07.

## 7. Strategi uji dan kriteria selesai

Tidak ada tes dijalankan saat menyusun rencana ini. Baseline terakhir yang dilaporkan F01: 77 berkas / 1.182 tes lulus; bukan hasil tes F08.

| ID | Kasus dan hasil wajib |
|---|---|
| U-01 | ID unik menghasilkan teks sumber yang benar, termasuk REQ multi-baris dan SC/OS/CON/RR dalam tabel; dukungan schema lama diuji dengan fixture nyata yang diminimalkan. |
| U-02 | ID hilang/duplikat, lintas intent, sumber hilang, dan metadata bertentangan dilaporkan tanpa fallback yang mengarang. |
| U-03 | Struktur lolos/ID ada tidak otomatis menghasilkan semantic READY; status sertifikasi dan readiness tetap terpisah. |
| U-04 | Hash/revisi sumber berubah → laporan memperlihatkan perbedaan acuan dan isi kini; baseline unknown tetap unknown. |
| U-05 | Review CLI/MCP memilih target yang sama; versi ambigu ditolak; seluruh review tidak menulis file/state/log. |
| U-06 | Clone menghasilkan identitas/gate/metadata baru yang benar; sumber tetap identik byte; tidak mewarisi verdict, sertifikasi, checklist atau klaim bukti lama. |
| U-07 | Mapping schema tidak didukung, path traversal/symlink, sumber bukan artefak terdaftar, target bentrok atau gate tertutup → tolak sebelum mutasi. |
| U-08 | Sumber berubah setelah preview serta kegagalan sesudah penulisan file/chain → penolakan/recovery konsisten; replay MCP tidak membuat draf kedua. |
| U-09 | Paket audit mengikat hash target dan dependensi, menyatakan sumber/bukti hilang, serta mendeteksi perubahan setelah snapshot. |
| U-10 | Respons asli AUD dapat dibaca kembali dengan hash sama; ringkasan/record tidak mengubah verdict atau status artefak. |
| U-11 | Daftar keputusan memisahkan ticket dan pertanyaan; expired/consumed/rejected tidak dianggap pending approval; chain lain hanya lewat selector. |
| U-12 | Menjawab pertanyaan tidak mengubah gate; perubahan target menandai evaluasi ulang; batas role/binding serta transaksi CLI/MCP diuji. |

Kriteria selesai per tahap: keputusan terkait tertutup; perilaku dan kontrak input/output final tertulis; tes fokus relevan lulus; TypeScript bersih; build dist pada titik yang disetujui; regresi lengkap bila kode berubah; git diff --check lulus; hasil dan batas cakupan dicatat di dokumen ini/F00. Belum menetapkan tambahan gate berdasarkan hasil semantik.

## 8. Risiko dan dependensi

- F04/F05 sudah membatasi revisi dan sertifikasi. Duplikasi alur F08 dapat menciptakan dua sumber kebenaran; gunakan service/ledger yang ada.
- Pengurai ID yang terlalu sederhana dapat mengambil ID dari komentar/contoh atau kehilangan konteks REQ multi-baris. Jika ambigu, laporkan ambigu.
- Clone mentah dapat membawa persetujuan atau klaim bukti palsu; mapping dan reset harus dapat diuji sebelum fitur diaktifkan.
- Paket audit mudah usang ketika sumber berubah; manifest hash dan pemeriksaan stale wajib ada.
- Daftar keputusan tanpa pencatatan eksplisit mudah keliru atau menjadi approval paralel; pisahkan pertanyaan substantif dari tiket otorisasi.
- Distribusi parsial dapat membuat runtime dan petunjuk AI berbeda; F09 tetap tahap distribusi, bukan dilakukan saat F08.
- F07 ditunda bersyarat; keterbacaan struktur sekarang belum dibuktikan melalui pilot. Evaluasi nyata menjadi sumber keputusan untuk tindak lanjut.

## 9. Urutan implementasi yang diusulkan

1. Putuskan O-1–O-4; lengkapi kontrak F08a dan contoh keluaran untuk review.
2. Setelah persetujuan implementasi F08a, buat service review baca saja, integrasi CLI/MCP dan tes U-01–U-05. Laporkan sebelum tahap berikut.
3. Putuskan O-5–O-7 dan detail clone; review mapping/reset/provenance serta transaksi, lalu implementasikan F08b setelah persetujuan.
4. Putuskan O-8–O-10 dan kontrak penyimpanan/otoritas F08c; implementasikan setelah persetujuan.
5. Validasi gabungan, perbarui rules/skill/memory master bila diperlukan, dan catat dampak Protocol/F09.
6. Commit/push, distribusi, migrasi proyek nyata, dan instalasi perangkat hanya atas instruksi terpisah.

Build mengubah dist yang dipakai runtime host melalui symlink; titik build dilaporkan dan disetujui sebelum dijalankan. Tidak ada estimasi hari atau persentase penyelesaian F08 yang ditetapkan dari pemeriksaan awal ini.

## 10. Persetujuan dan rincian eksekusi — 14 Oktober 2026

Director: "oke semua rekomendasi saya setujui, lakukan eksekusi". Persetujuan ini menutup O-1 sampai O-10 dan mengotorisasi implementasi F08a–F08c beserta build dan validasi yang diperlukan. Tidak termasuk commit/push, distribusi, migrasi proyek nyata, atau membuka kembali F07.

Pilihan implementasi dalam lingkup rekomendasi yang disetujui:

- **Penyimpanan:** satu berkas internal CLI/MCP-managed, Sigma/logs/f08.json, dalam folder logs yang telah ada; format internal 1, tanpa field wajib baru pada chain. Batas 16 MiB, tidak memangkas riwayat otomatis. Provenance clone, snapshot audit, respons asli, pertanyaan dan penilaian kesiapan disimpan terpisah dalam berkas ini.
- **Review sumber:** plan check --sources dan sigma_check_document dengan sources=true memakai service bersama. Kesiapan UNKNOWN sampai ada penilaian FMN; READY/SCOPE_GAP/PENDING_ALIGNMENT/UNKNOWN bersifat advisory, terikat hash PLAN+INTENT dan tidak mengubah gate.
- **Acuan historis:** teks INTENT acuan dicari dari isi terkini yang hash-nya cocok atau blob Git pada baseline/amendment yang tercatat. Hash harus cocok tepat. Sumber yang tidak dapat dibuktikan tetap UNKNOWN; salinan dengan perbedaan CRLF yang tidak cocok byte tidak diklaim sebagai sumber identik.
- **Clone:** intent clone / plan clone preview baca saja; --confirm wajib memakai --preview-token yang mengikat sumber, template, state, metadata target dan isi calon. INTENT clone mengaktifkan chain baru sesuai intent new; CLOSED memerlukan --yes. Implementasi awal hanya INTENT 5→5 dan PLAN 3→3. Schema 4/2 tetap dapat dibaca/divalidasi, tetapi tidak otomatis ditransformasikan. Pairing atau mapping lain ditolak sebelum menulis.
- **Reset:** identitas/state/hash/ledger tidak disalin; ringkasan, source alignment, verdict/checklist audit dan riwayat revisi kembali ke template. Checkbox tercentang pada isi kontrak dikosongkan. Kewajiban dipertahankan; status AMENDMENT_RATIFIED pada pekerjaan di luar intent menjadi AMENDMENT_REQUESTED. Diff memperlihatkan seluruh reset. Isi salinan tetap memerlukan review makna, bukan dianggap siap disetujui.
- **Paket audit:** audit new menangkap target dan sumber terdaftar yang tersedia, manifest/hash serta snapshot; audit show merender JSON atau Markdown ke stdout untuk penyerahan manual. Bukti citation EXEC disertakan hanya bila --include-evidence dipilih, berupa teks ≤512 KiB dan cocok hash citation. Biner/hilang/berubah/tidak dipilih dinyatakan tidak disertakan.
- **Respons AUD:** audit record / sigma_record_audit_response menyimpan teks asli, hash dan asal yang dinyatakan; tidak mengekstrak verdict atau mengisi artefak otomatis. Asal eksternal adalah deklarasi, bukan autentikasi vendor. Pack stale menolak respons baru.
- **Keputusan:** decisions list memisahkan pertanyaan substantif dan ticket control; expired/consumed/rejected/retired/stale tidak disebut pending approval. decisions resolve hanya CLI lokal dengan --director-confirm dan hash target yang tidak berubah; tidak ada tool MCP yang menjawab atas nama Director. Record hash berubah menjadi NEEDS_REVIEW.
- **Role:** ARC clone INTENT; FMN clone PLAN dan menilai kesiapan; ARC/FMN/DEV dapat menyiapkan pack dan pertanyaan; AUD hanya merekam respons asli terhadap pack yang diserahkan. Permukaan CLI lokal merupakan permukaan Director tepercaya. Tulisan MCP selalu memakai binding, role, expected state revision, idempotensi dan journal transaksi yang ada.
- **Petunjuk master:** empat rules, hash role memory, 20 skill peran pada lima target, lima bridge, registry operasi, policy MCP, README dan CHANGELOG diselaraskan. Constitution/Protocol tidak diubah.
- **Runtime:** build dist dilakukan sebagai bagian eksekusi yang disetujui. Salinan ~/.sigma, skill terpasang dan proyek nyata tidak disinkronkan.

### Dampak untuk review akhir Protocol/F09

Protocol perlu menjelaskan tiga dimensi review, clone sebagai DRAFT baru tanpa persetujuan warisan, audit snapshot dan status stale, serta pertanyaan substantif terpisah dari ticket otorisasi. F09 mendistribusikan seluruh aset master dan menguji alur instalasi/update serta proyek nyata; F07 tetap PENDING PROCESS bersyarat evaluasi nyata.

## 11. Hasil eksekusi F08 — 14 Oktober 2026

Status: **SELESAI pada master dalam cakupan yang disetujui.** F08a, F08b dan F08c sudah diterapkan; distribusi/instalasi perangkat belum dilakukan.

### Perilaku yang tersedia

- CLI plan check --sources dan MCP sigma_check_document sources=true menampilkan teks sumber, referensi hilang/ambigu, sumber terkini/acuan, sertifikasi dan penilaian kesiapan yang terpisah.
- intent clone / plan clone dan MCP preview/clone membuat DRAFT beridentitas baru, mempertahankan sumber, mereset persetujuan/verdict/checkbox, serta menyimpan provenance dan diff. Preview berubah → ditolak.
- audit new/show/record serta MCP pack/response menyimpan snapshot, manifest/hash dan respons asli AUD. Bukti teks dapat dipilih eksplisit; bukti yang tidak dapat disertakan dinyatakan terbuka. Perubahan sumber, state, bukti atau dependensi sertifikasi menandai pack stale.
- decisions add/list/resolve/assess menyediakan pertanyaan substantif dan penilaian FMN yang terikat hash, terpisah dari ticket control. Resolusi Director hanya CLI lokal; tidak ada pengubahan gate atau approval otomatis.
- Query MCP berjumlah 26 tool; control MCP 39 tool, termasuk tombstone legacy. Sepuluh operasi CLI F08 terdaftar dengan parameter aktual; policy MCP membedakan operasi role, query dan resolusi Director lokal.
- Semua penulisan F08 menggunakan lease/journal/recovery yang ada. Penulisan template/metadata clone, history dan roadmap ikut dicatat agar konflik editor ditolak tanpa menimpa perubahan independen. Laporan yang menangkap error sumber menyamarkan root host menjadi path relatif.

### Validasi

- Build TypeScript/dist: lulus, exit 0.
- Regresi final setelah seluruh perubahan kode: **78 berkas uji / 1.209 tes lulus**, exit 0.
- Tes F08: **27 kasus lulus**, mencakup ekstraksi schema lama/baru, referensi hilang/ambigu, acuan Git historis, sertifikasi unknown, advisory readiness stale, reset clone, unsupported mapping, rollback, pemulihan proses CLI yang dihentikan paksa, konflik editor, bukti terpilih, respons AUD asli, isolasi intent, ticket terminal/stale, role/idempotensi MCP dan query tanpa mutasi/log.
- git diff --check: lulus. Whitespace source/dokumen baru, keunikan 78 operation ID, dan empat hash rule/memory master: valid.
- Dry-run registry: semua sepuluh operasi CLI F08 terdeteksi. Masih ada **11 operasi lama di luar F08 yang belum tercatat** dan **1 entri intent_baseline yang tidak cocok command aktif**; refresh menyeluruh tidak dijalankan. Bawa ke penyelarasan akhir/F09.
- Log regresi pada mesin sesi: /tmp/sigma-f08-verified.log. Pengujian menggunakan proyek dan home sementara, bukan proyek pengguna.

### Batas hasil dan langkah berikut

- Clone otomatis hanya INTENT schema 5→5 dan PLAN schema 3→3. Schema lama tetap dapat dibaca/divalidasi; pembuatan revisi dari schema lain memerlukan penyusunan manual. EXEC/CLOSE/ROADMAP tidak masuk clone awal.
- Penilaian FMN adalah deklarasi advisory; tes dan pemeriksaan ID tidak membuktikan keselarasan makna secara otomatis. Asal respons AUD eksternal tetap deklarasi, bukan autentikasi vendor.
- Tidak ada perubahan Constitution, Protocol, SCHEMA_VERSION, versi paket atau dependensi. Tidak ada commit/push, migrasi proyek nyata, atau distribusi ke ~/.sigma/skill terpasang/proyek.
- F07 tetap PENDING PROCESS, tanpa komitmen pengerjaan; tindak lanjut bergantung evaluasi pemakaian nyata.
- Fokus berikut dalam urutan yang diterima: **F10**, kemudian F12, finalisasi Protocol/keputusan review Constitution, dan F09. Belum ada implementasi fokus berikutnya.
