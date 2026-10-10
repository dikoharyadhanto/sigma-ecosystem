# F01 - Peta konsistensi aturan Sigma

Tanggal mulai ulang: 10 Oktober 2026
Status: implementasi master F01 selesai dan lulus validasi. Distribusi host dan proyek tetap pekerjaan F09.
Basis pemeriksaan: master main pada 891cdd9; perbandingan baca saja dengan salinan terpasang di host dan proyek KLHK. Perbedaan byte menunjukkan ketidaksamaan isi, bukan penyebab, arah perubahan, atau izin untuk menimpa salinan.

## 1. Tujuan dan batas

F01 memetakan ketidaksesuaian antara otoritas dan petunjuk yang dibaca agen: template, rules, role memory, skill, bridge, registry, teks CLI/MCP, dan salinan proyek. Hasilnya menjadi dasar keputusan perubahan master dan syarat distribusi F09. Tidak ada sinkronisasi, migrasi, perubahan proyek KLHK, atau perubahan kode pada audit awal ini.

Protocol dibaca untuk mencatat konflik, tetapi revisinya dilakukan setelah fokus lain yang mengubah perilaku selesai dan sebelum distribusi F09. Constitution dibaca hanya untuk mendeteksi konflik kewenangan. Usulan amandemennya berada pada fokus terpisah F15 dan memerlukan deklarasi eksplisit Director sesuai Article VIII.

## 2. Keputusan yang sudah ada

- Director mengizinkan F01 dilanjutkan dengan audit master dan salinan yang dapat diverifikasi, tanpa menyinkronkan atau mengubah salinan tersebut (10 Oktober 2026).
- T-18 di F00: versi aturan harus bernilai nyata, bukan unversioned; perbedaan master dan proyek harus terdeteksi; perubahan lokal proyek dipertahankan, tanpa penimpaan otomatis. Bentuk versi dan pemilik pemeriksaan belum diputuskan.
- Constitution dan Protocol tetap ditunda untuk perubahan teks. Protocol dikerjakan setelah fokus isi lain; Constitution mengikuti prosedur amandemen.
- F07 bergantung pada F01. F09 adalah distribusi, bukan pengganti audit konsistensi.

## 3. Baseline dan metode

- Master: aturan, template, empat role memory, lima keluarga skill, bridge, registry, README, dan jalur distribusi dibaca pada HEAD 891cdd9.
- Salinan host: berkas di ~/.sigma dan skill terpasang untuk Claude Code, Codex, Reasonix, serta Antigravity dibandingkan byte-per-byte dengan master. Target opencode tersedia di master tetapi belum terpasang pada ~/.config/opencode/commands.
- Salinan proyek: berkas terpilih di KLHK/Sigma dan lima bridge di akar proyek dibandingkan byte-per-byte dengan master. Tidak ada berkas proyek yang diubah.
- Hasil negatif dibatasi pada lokasi dan pola pemeriksaan di atas. Perbedaan semantik hanya dinyatakan bila contoh isi yang relevan sudah dibaca.

## 4. Temuan awal terverifikasi

| ID | Temuan | Bukti | Akibat atau batas kesimpulan |
|---|---|---|---|
| F01-01 | Daftar periksa 6 Oktober usang: masih memuat empat template HUMAN dan target Cursor, sementara master sudah menghapusnya; opencode dan notes belum tercakup. | F01-lampiran_daftar-periksa-dokumen.md; isi Sigma/templates dan setup/targets | Inventaris harus dibangun ulang sebelum review per dokumen. |
| F01-02 | Template host dan KLHK masih memakai INTENT schema 4, PLAN schema 2, EXEC schema 2; master masing-masing schema 5, 3, 3. | Marker baris pertama enam salinan template; src/commands/project.ts memilih template ~/.sigma bila ada | Pembuatan atau sinkronisasi proyek dari host ini dapat memakai template lama. Ini belum membuktikan artefak proyek lama tidak valid. |
| F01-03 | Keempat rules host dan KLHK berbeda byte dari master. Semua 36 skill terpasang yang diperiksa berbeda byte dari pasangan master; contoh semantik pada skill DEV Codex: instruksi lama memakai plan lock dan exec lock, sedangkan master memakai plan approve dan exec approve. CLI help saat ini menyebut kedua perintah lock telah dihapus. | Perbandingan byte; setup/targets/codex/dev/SKILL.md terhadap ~/.codex/skills/dev/SKILL.md; CLI help plan dan exec | Agen yang memakai salinan terpasang dapat menerima alur yang bertentangan dengan runtime saat ini. Isi seluruh selisih skill belum diklasifikasi. |
| F01-04 | Lima bridge di KLHK berbeda byte dari master; AGENTS.md dan CLAUDE.md di KLHK masih memerintahkan intent lock, plan lock, exec lock dan menyebut progress.json. | KLHK/AGENTS.md dan KLHK/CLAUDE.md sekitar baris 78 dan 112 | Petunjuk proyek dapat mengarahkan agen ke perintah atau berkas runtime lama. |
| F01-05 | Empat role memory master dan KLHK masih memuat source_rule_version = unversioned. Pembaca memory hanya memuat JSON; tidak membandingkan versi atau hash rule. | Sigma/role-memory/*.json; src/engine/roleMemory.ts | Keputusan T-18 belum diterapkan. Perbedaan lokal tidak terdeteksi lewat field ini. |
| F01-06 | project sync --confirm menyalin governance, rules, template, registry, dan memory dengan overwrite: true. | src/commands/project.ts sekitar baris 530-600 | Jalur sinkronisasi saat ini dapat menimpa perubahan lokal; bertentangan dengan kebijakan T-18. Jangan menjalankan sinkronisasi proyek sebelum mekanisme perlindungan diputuskan dan diterapkan. |
| F01-07 | Protocol master masih menyatakan PLAN harus LOCKED sebelum EXEC, memuat dua tier INTENT, alur amandemen lama, dan perintah plan lock / exec lock. | Sigma/SIGMA_PROTOCOL.md bagian 3, 5.1.1, Gate 2, 16A | Konflik dengan F04/F05 yang telah diterapkan. Perbaikan Protocol dicatat untuk sapuan akhir, bukan dilakukan di F01. |
| F01-08 | README dan registry operasi master masih memuat plan lock / exec lock sebagai petunjuk aktif; registry memuat pesan Gate 2 yang menyuruh plan lock. | README.md sekitar baris 614 dan 621; Sigma/SIGMA-OPERATION-REGISTRY.json sekitar baris 706 dan 719 | Petunjuk runtime dan dokumentasi dapat menyesatkan pengguna meskipun kode sudah menyediakan alur approve. |
| F01-09 | Template CLOSE master masih merujuk Desired Outcome (1.4) dan Success criteria (3.1), sedangkan template INTENT schema 5 memakai judul tanpa nomor tersebut. | Sigma/templates/DIR-CLOSE-TEMPLATE.md sekitar baris 93-101; DIR-INTENT-TEMPLATE.md | Rujukan lintas artefak usang. Pemeriksaan konsistensi masuk F01; perubahan isi CLOSE memerlukan fokus review tersendiri. |
| F01-10 | Catatan lama F00 tentang kriteria pemilihan verdict AUD tidak lagi sesuai isi master: AUD-RULE sekarang memuat Verdict Selection Criteria. | F00 bagian 8; Sigma/rules/AUD-RULE.md sekitar baris 694 | Jangan membawa temuan lama sebagai masalah aktif tanpa verifikasi ulang. |
| F01-11 | Daftar eksplisit Commands AUD must not execute masih menyebut plan lock dan exec lock, bukan perintah approve yang berlaku. Larangan umum AUD terhadap semua operasi approval-class tetap ada. | Sigma/rules/AUD-RULE.md sekitar baris 1162 dan 1200-1212 | Ini selisih kejelasan daftar, bukan bukti AUD diizinkan menyetujui runtime. |

Constitution master identik byte dengan salinan ~/.sigma dan KLHK pada pemeriksaan ini. Kesamaan byte tidak menyelesaikan usulan perbaikan substantif dalam artifact_sigma_review_director.md.

## 5. Peta salinan dan batas distribusi

- ~/.sigma: empat rules dan lima template berbeda dari master; tiga template lain yang diperiksa identik. Protocol berbeda, Constitution identik. Folder role memory dan dua registry JSON tidak ada pada lokasi global ini; role memory CLI memakai salinan proyek bila ada, kemudian bundle master.
- KLHK: empat rules, tiga template inti, ROADMAP, MEMO, terminologi, dua registry, dan empat role memory berbeda dari master; CLOSE, MSG, dan REFERENCE-LIST template identik pada perbandingan byte. Lima bridge proyek berbeda dari master. Penilaian apakah selisih tertentu merupakan kustomisasi sah belum dilakukan.
- Salinan host dan KLHK tidak identik untuk Protocol, ARC/FMN/AUD-RULE, INTENT/PLAN/ROADMAP template, dan kelima bridge. DEV-RULE, terminologi, EXEC/CLOSE/MEMO template identik antara host dan KLHK. Karena itu selisih proyek tidak dapat disimpulkan hanya berasal dari host; asalnya perlu dinilai per berkas.
- Skill host: sembilan dari sembilan pasangan yang diperiksa berbeda byte untuk setiap target Claude Code, Codex, Reasonix, dan Antigravity. Ini inventaris perbedaan, bukan hasil review semantik semua 36 berkas.
- project start dan project sync memilih template global bila tersedia. F09 harus memisahkan pembaruan host dari migrasi salinan proyek, disertai pratinjau selisih dan perlindungan perubahan lokal.

## 6. Keputusan terbuka dan rekomendasi

| ID | Pertanyaan | Rekomendasi | Status |
|---|---|---|---|
| O-1 | Identitas versi aturan yang nyata? | SHA-256 isi rule yang tepat, disimpan sebagai source_rule_version pada memory. Hash lebih mampu mendeteksi perubahan tanpa menuntut disiplin bump semver per rule; hasil banding harus menampilkan kedua path dan hash. Selaraskan rancangan dengan F12 assets_hash. | DISETUJUI dan diterapkan pada empat memory master |
| O-2 | Di mana pemeriksaan perbedaan berjalan? | sigma doctor melaporkan perbedaan master, host, dan proyek secara baca saja; jangan memperbaiki atau menimpa otomatis. Bila baseline asal salinan tidak ada, nyatakan asal perubahan tidak diketahui. | DISETUJUI; diterapkan sebagai sigma doctor --check-assets |
| O-3 | Bagaimana project sync memenuhi kebijakan mempertahankan perubahan lokal? | Pratinjau per berkas, cadangan, dan penolakan otomatis pada konflik yang tidak dapat diklasifikasi; perubahan proyek hanya diterapkan sesudah keputusan Director terhadap selisih konkret. | DISETUJUI; diterapkan dengan --accept per berkas dan cadangan |
| O-4 | Apakah CLOSE yang belum direview diubah dalam F01? | F01 hanya mencatat rujukan yang usang; revisi template dan validator CLOSE dibahas pada fokus review dokumen agar tidak menyelinapkan perubahan semantik. | DISETUJUI; perubahan CLOSE ditunda |
| O-5 | Kapan petunjuk plan lock / exec lock di README dan registry dibetulkan? | Jadikan koreksi sempit sebagai pekerjaan master pertama setelah rencana F01 disetujui, sebab petunjuk aktif dapat mengarahkan tindakan keliru. Protocol tetap menunggu sapuan akhir. | DISETUJUI; petunjuk aktif README, registry, dan daftar AUD dikoreksi |

## 7. Strategi verifikasi untuk pekerjaan lanjutan

1. Klasifikasikan selisih semantik rules, skill, bridge, memory, registry, dan teks runtime: aturan aktif yang salah, perbedaan platform yang sah, riwayat yang boleh tetap ada, atau perubahan lokal proyek yang belum diketahui.
2. Untuk perubahan master, uji hubungan template-validator, perintah CLI yang benar, aktivasi role, dan pesan kesalahan yang dibaca agen. Tes harus mencakup schema lama yang masih didukung.
3. Untuk desain drift, uji bahwa laporan hanya membaca; hash berubah saat rule berubah; salinan lokal berbeda terdeteksi; project sync tidak menimpa konflik; dan pilihan Director atas perbedaan dapat ditelusuri.
4. Verifikasi ulang perbedaan sesudah build hanya bila kode berubah. Audit awal tidak membangun atau menguji; implementasi berikutnya menjalankan build dan tes.

## 8. Risiko dan dependensi

- Mengubah ~/.sigma sekarang dapat membuat template baru berjalan bersama Protocol dan skill yang masih lama. Distribusi parsial berisiko menghasilkan instruksi yang saling bertentangan.
- Perubahan lokal KLHK belum diklasifikasi. Perlindungan sync master kini menolak penggantian berkas DIFF tanpa token, tetapi belum ada dasar untuk memutuskan perbedaan KLHK mana yang boleh diganti pada F09.
- Protocol memerlukan daftar perubahan gabungan F02-F06, E04, F13, F16, dan hasil F07/F08 sebelum direvisi. Constitution mengikuti jalur F15 bila Director memilih amandemen.
- Berkas ~/.sigma/notion.credentials.json terdeteksi berdasarkan nama saja, tanpa membaca isinya. Ini perlu ditinjau pada pembersihan instalasi F09; keberadaan berkas tidak membuktikan kredensial masih berlaku.

## 9. Urutan langkah berikutnya

1. Selesaikan validasi regresi dan catat hasilnya.
2. Gunakan laporan `sigma doctor --check-assets` untuk mengklasifikasi selisih host dan proyek sebelum distribusi F09; asal perubahan belum diketahui hanya dari hash.
3. Lanjutkan F07/F08; selesaikan Protocol setelah perubahan isi stabil. Constitution tetap pada jalur F15.
4. Rencanakan distribusi F09 terpisah, dengan keputusan Director untuk setiap penggantian berkas proyek yang berbeda.

## 10. Implementasi master 10 Oktober 2026

- `source_rule_version` empat role memory kini berisi `sha256:<hash>` dari byte rule master. Pemeriksaan aset melaporkan mismatch antara memory dan rule master/proyek. Pengguna F12 dapat menyelaraskan nama dan cakupan `assets_hash` kemudian; belum ada perubahan skema identitas proyek.
- `sigma doctor --check-assets` membandingkan master dengan host, skill terpasang, dan proyek yang sedang aktif; juga host dengan proyek. Status SAME/MISSING/DIFF/UNSAFE beserta path dan SHA-256 dicetak. Mode ini tidak merekonsiliasi chain dan tidak menulis operation log. Karena belum ada baseline asal, hasil tidak mengklaim arah atau izin perubahan.
- `sigma project sync` tanpa `--confirm` hanya memberi pratinjau per berkas. `--confirm` menyalin yang hilang; tiap berkas DIFF memerlukan token `--accept` yang mengikat nama berkas dan kedua hash. Token kedaluwarsa ditolak. Byte sebelumnya dicadangkan ke `~/.local/share/sigma/sync-backups/` sebelum penggantian. Path yang memakai tautan simbolik ditolak. `project start --reinit` juga menolak perbedaan aset terkelola sebelum menulis.
- README dan registry operasi diperbarui untuk alur approve dan perilaku sync/doctor; daftar larangan eksplisit AUD diperbarui. Protocol dan Constitution tetap tidak diubah. Template CLOSE tetap menunggu review dokumen.
- Build TypeScript, empat tes fokus F01, dan suite regresi penuh lulus: 77 berkas uji, 1.182 tes. Laporan doctor dari master tanpa proyek membandingkan 74 pasangan berkas dan menemukan 52 perbedaan; angka ini inventaris byte, bukan klasifikasi asal atau persetujuan distribusi.
