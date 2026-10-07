# F02 - Penomoran chain dan warning bootstrap

Tanggal: 7 Oktober 2026
Status: Implementasi dan validasi selesai 7 Oktober 2026 setelah persetujuan O-1 sampai O-3 dan eksekusi; 68 berkas / 934 tes lulus, kode keluar npm/Vitest 0. Belum di-commit.
Basis verifikasi awal: branch `main`, HEAD `5d8ff01`. Tahap penyusunan dilakukan read-only; implementasi, build, dan pengujian dimulai setelah persetujuan eksplisit Director. Hasil akhir dicatat di bagian 10.
Sifat dokumen: rencana kerja pengembangan master Sigma, bukan artefak PLAN proyek terdaftar dan bukan otorisasi implementasi.

## 1. Tujuan dan batas fokus

Membuat chain baru memakai INTENT vN -> PLAN vN.1, vN.2, ... -> EXEC dengan versi yang sama dengan PLAN pasangannya. Chain lama mempertahankan offset major INTENT dikurangi satu. Bootstrap menjelaskan pola legacy hanya ketika chain tersebut aktif.

Cakupan: identitas aturan penomoran per chain; generator dan validasi versi; pembuatan/promosi PLAN; pairing EXEC; rekonstruksi identitas chain; informasi kompatibilitas CLI/MCP; uji chain lama, baru, dan campuran.

Di luar cakupan: lifecycle APPROVED/LOCKED dan sertifikasi revisi (F04), mailbox (F03), amandemen INTENT (F05), penghapusan prefix nama artefak (F10), versi/distribusi instalasi (F12/F09), perubahan Constitution dan Protocol. Tidak ada renumber atau penyuntingan massal artefak historis.

Label: **TERKUNCI** = keputusan Director; **TERVERIFIKASI** = diperiksa pada source; **REKOMENDASI** = usulan yang belum disetujui; **TERBUKA** = memerlukan keputusan Director.

## 2. Keputusan Director yang sudah terkunci

Sumber utama: [diskusi perubahan Sigma v2](../../Discussion/Evaluation-06102026/diskusi_rencana_perubahan_sigma_v2.md), Temuan 02, khususnya baris 68-155 dan penetapan DRAFT pada baris 110-113. Sumber pendukung: [keputusan desain 28 September](../../Discussion/Evaluation-06102026/2026-09-28_sigma-v2-keputusan-desain-dan-inventaris.md), D-03 dan tabel penomoran.

| ID | Keputusan TERKUNCI |
|---|---|
| D-1 | INTENT baru setelah perubahan diterapkan memakai major PLAN yang sama dengan INTENT; EXEC mengikuti versi PLAN pasangannya. Berlaku juga untuk INTENT baru di proyek lama. |
| D-2 | Chain lama tetap menggunakan penomoran lama; nomor, file, dan referensi historis tidak diubah. |
| D-3 | INTENT DRAFT yang sudah ada sebelum upgrade tetap legacy, termasuk bila belum mempunyai PLAN. |
| D-4 | Aktivasi ulang chain legacy tidak menjadikannya chain baru. |
| D-5 | Setiap bootstrap mengenali aturan chain aktif. Warning singkat menjelaskan offset dan kompatibilitas hanya untuk chain aktif yang legacy. Keberadaan chain legacy lain tidak memicu warning. |
| D-6 | Nomor PLAN yang sudah superseded tidak dipakai ulang; EXEC tetap bernomor sama dengan PLAN yang direferensikannya (D-03 sumber 28 September, tabel penomoran). |

Kelanjutan PLAN tambahan di chain legacy mengikuti aturan yang sama merupakan konsekuensi desain D-2; dalam tabel diskusi awal masih berlabel pemahaman asisten. Spesifikasi pada dokumen ini menyatakannya secara eksplisit untuk persetujuan rencana.

## 3. Peta dampak kode pada HEAD yang diperiksa

Seluruh lokasi di tabel ini **TERVERIFIKASI** melalui pembacaan source. Nomor baris adalah baseline dan perlu diperiksa kembali bila HEAD berubah.

| File dan lokasi | Perilaku sekarang | Dampak F02 yang direkomendasikan |
|---|---|---|
| `src/engine/chain.ts:252` `ChainState` | Memuat `schema_version` dan `chain_version`, belum memuat aturan penomoran khusus. | Tambah aturan penomoran yang stabil, terpisah dari schema runtime. |
| `src/engine/chain.ts:484`, `:511`, `:545` `readChain`, `writeChain`, `createInitialChain` | Reader menormalisasi state/path lama; writer menulis JSON; constructor dipakai oleh pembuatan INTENT dan rekonstruksi. | Resolusi legacy dan validasi nilai aturan; constructor menerima skema secara eksplisit agar rekonstruksi artefak lama tidak mendapat default skema baru. |
| `src/engine/chain.ts:930`, khususnya `:949` `runDoctorReconciliation` | Doctor dapat menaikkan `schema_version`. | Doctor mempertahankan aturan penomoran; kenaikan schema tidak menjadi migrasi numbering. |
| `src/engine/chain.ts:1114` `nextPlanVersion` | Major = major INTENT - 1; minor = jumlah entri pada major tersebut + 1. | Major menurut aturan chain; kebijakan minor pada O-3. |
| `src/engine/chain.ts:1360` `registerPlanDraft` | Memvalidasi major offset terhadap parameter `intentVersionRef`. | Gunakan aturan chain yang sama dengan generator dan pastikan referensi menunjuk INTENT milik chain. |
| `src/engine/chain.ts:1461` `promotePendingPlan` | Mendaftarkan PLAN hasil promosi langsung ke tracker; tidak melewati `registerPlanDraft`. | Terapkan validasi aturan/referensi sebelum menghapus pending atau menambah entri. |
| `src/engine/chain.ts:1131`, `:1540` `nextExecVersion`, `registerExecDraft` | EXEC mengikuti PLAN; pendaftaran menolak versi EXEC yang tidak identik dan versi duplikat. | Pertahankan invariant tersebut; metadata pemulihan harus menyebut PLAN yang benar. |
| `src/engine/chain.ts:770` `validateChainSemantics` | Memeriksa referensi INTENT dan keberadaan PLAN yang direferensikan EXEC; belum memeriksa major PLAN menurut aturan chain. | Periksa nilai skema dan konsistensi numbering untuk state yang akan ditulis; jangan mengoreksi angka otomatis. Perlakuan state lama menyimpang perlu mengikuti batas pada bagian 5. |
| `src/services/intentDraftService.ts:49`, `:74`, khususnya `:98-104` | Menyalin template, membuat chain, lalu menulis manifest aktif; dipakai CLI/MCP. | Tetapkan aligned pada pembuatan INTENT, serta tulis marker sebelum artefak dianggap selesai dibuat. |
| `src/services/planDraftService.ts:97`, `:110` | Menghitung versi untuk daftar file transaksi dan mutasi dengan generator yang sama, kemudian merender ROADMAP. | Marker keanggotaan pada PLAN baru; hasil transaksi, file, tracker, dan ROADMAP konsisten. |
| `src/services/planPromoteService.ts:142`, `:185` | Mengalokasikan versi dengan generator, memindahkan pending file, lalu mendaftarkannya. | Tambah marker ketika pending menjadi PLAN resmi; metadata chain mengikuti chain pemilik pending. |
| `src/services/execDraftService.ts:59`, `:118`, `:129` | Memilih PLAN dari chain aktif, termasuk eksekusi tidak berurutan; versi EXEC mengikuti referensi PLAN. | Marker keanggotaan dan PLAN pada EXEC baru; tidak mengubah syarat lifecycle. |
| `src/engine/reconstruct.ts:92`, `:302`, khususnya `:319-338`, `:355` | Discovery membaca nama dan `SIGMA:DOC`; PLAN/EXEC dikelompokkan dengan major + 1, kemudian constructor membuat state. | Pulihkan aturan dan membership sebelum pengelompokan; baca state yang masih valid serta marker artefak. Hapus asumsi offset universal. |
| `src/engine/reconstruct.ts:414-445` | Jalur satu PLAN/satu EXEC mengaitkan keduanya berdasarkan jumlah file pada major; tidak memeriksa kesamaan minor di jalur ini. | Tolak pairing versi yang tidak identik. Metadata keanggotaan tidak menjadi bukti lock. Perombakan inferensi lifecycle tetap F04. |
| `src/commands/doctor.ts:185`, `:254` | Memilih target dan menulis hasil rekonstruksi; `--all-versions` dapat menulis beberapa chain. | Perilaku konflik dan cakupan penulisan diputuskan pada O-2; laporan menyebut bukti/fallback penomoran. |
| `src/session/bootstrapView.ts:22`, `:35`; `src/commands/session.ts:139`, `:162` | View bersama membawa chain aktif; CLI menampilkan Active Chain. | Tambah metadata dan warning kompatibilitas dalam view, tampilkan dekat identitas chain aktif. |
| `src/mcp/tools/orientation.ts:67`, `:85`, `:104` | Memakai view yang sama; `stale_intent_warnings` khusus masalah runtime. | Bidang numbering dan compatibility terpisah; perbarui deskripsi respons tool. |
| `src/mcp/control/tools/{createIntentDraft,createPlanDraft,createExecDraft}.ts`; `preparePlanPromote.ts:90` | Tool mutasi memakai service bersama; prepare promosi menghitung projected version dengan generator yang sama. | Verifikasi paritas termasuk preview, transaksi, rollback, dan stale-state. |
| `src/mcp/contract.ts:68-115` `computeStateRevision` | Hash mencakup byte state chain aktif. | Field numbering pada JSON otomatis tercakup; tidak perlu membuat hash terpisah hanya untuk field ini. Marker artefak tidak tercakup oleh hash ini. |
| `src/utils/artifacts.ts:8-19` | Template global didahulukan; penyalinan belum mengisi identitas chain. | Penulisan marker dilakukan oleh kode pembuatan artefak, sehingga tidak bergantung pada template global sudah diperbarui. |
| `src/utils/docCheck.ts:392-395`; `src/config.ts:80-85`; `src/utils/roadmap.ts:11-20` | Parser `SIGMA:DOC` ketat; pengenalan file masih berprefix; ROADMAP mengambil tracker/referensi chain, bukan menghitung offset. | Marker baru berdiri terpisah dari `SIGMA:DOC`; jangan menyisipkan field ke baris schema. Koreksi komentar ROADMAP; rename/pola nama tanpa prefix tetap F10. |

Tes terkait yang diperiksa: `test/chain-engine.test.ts`, `test/exec-version-parity.test.ts`, `test/reconstruct.test.ts`, dan `test/helpers.ts`. Helper lama memuat fixture INTENT v1 dengan PLAN v1.1 walaupun generator legacy menghasilkan v0.1; ini data sintetis, bukan bukti chain produksi memakai aligned. Penambahan validasi tidak boleh diselesaikan dengan sekadar mengubah semua ekspektasi tes legacy menjadi aligned.

## 4. Spesifikasi perilaku yang direkomendasikan

Seluruh rekomendasi teknis di bagian ini **TERKUNCI** setelah Director menyetujui seluruh rekomendasi dan menginstruksikan eksekusi pada 7 Oktober 2026.

### 4.1 Aturan yang stabil per chain dan bukti pemulihan

- Field chain: `versioning_scheme`, nilai `legacy_offset` atau `intent_aligned`. Chain baru melalui service INTENT selalu menulis `intent_aligned`. Nilai eksplisit yang tidak dikenali adalah kesalahan; jangan diperlakukan sebagai field kosong atau legacy.
- Satu resolver aturan dipakai generator, validator, promosi, bootstrap, dan rekonstruksi. Schema template INTENT/PLAN/EXEC, `SCHEMA_VERSION`, versi paket, dan status RATIFIED tidak menentukan penomoran.
- Chain tanpa field memakai fallback legacy hanya bila tidak ada bukti terstruktur yang bertentangan. Pembacaan/orientasi tidak menulis field. Doctor boleh mempermanenkan hasil fallback di JSON dan melaporkannya, tetapi tidak menyunting artefak historis atau mengganti legacy menjadi aligned.
- Constructor menerima skema yang telah dipilih caller; jalur `intent new` dan rekonstruksi tidak berbagi default aligned yang dapat mengubah chain lama.
- Artefak INTENT, PLAN, dan EXEC yang baru dibuat mendapatkan komentar metadata di dekat awal dokumen, setelah baris `SIGMA:DOC`. PLAN/EXEC baru pada chain legacy mencatat `legacy_offset`. Artefak historis tidak ditambahi marker secara massal.
- Pending PLAN belum memiliki versi resmi; marker resmi ditulis saat promosi, sebelum registrasi selesai. Penyuntingan marker tidak boleh merusak isi pending.

Contoh usulan format (bukan perubahan template):

```markdown
<!-- SIGMA:CHAIN intent=v3 versioning_scheme=intent_aligned -->
```

Pada EXEC ditambahkan referensi PLAN dalam marker yang sama:

```markdown
<!-- SIGMA:CHAIN intent=v3 versioning_scheme=intent_aligned plan=v3.1 -->
```

Metadata ini membuktikan klaim identitas/membership yang perlu diperiksa konsistensinya; bukan signature, bukan bukti keaslian penciptaan lewat CLI, dan bukan bukti APPROVED/LOCKED. Marker tidak memuat status persetujuan, hash sertifikasi, atau revisi kontrak. Seluruh marker ditulis sebelum failpoint sesudah pembuatan artefak, agar artefak yatim akibat kegagalan membawa identitas pemulihan. File yang dimutasi tetap dicakup jurnal transaksi MCP yang sudah ada.

### 4.2 Matriks penomoran dan bootstrap

| Kondisi | PLAN/EXEC | Warning legacy |
|---|---|---|
| INTENT v2 legacy aktif, sudah ada PLAN v1.1/v1.2 | PLAN berikutnya v1.3; EXEC sama dengan PLAN target | Muncul |
| INTENT v2 DRAFT lama, belum ada PLAN | Setelah prasyarat terpenuhi: PLAN v1.1 | Muncul sejak bootstrap, tidak menunggu PLAN |
| INTENT v3 baru di proyek lama | PLAN v3.1, v3.2; EXEC sama dengan PLAN target | Tidak muncul |
| INTENT v1 pertama di proyek baru | PLAN v1.1 | Tidak muncul |
| INTENT v1 legacy | PLAN v0.1, v0.2, ... tetap sah | Muncul |
| Chain aligned aktif, chain legacy lain tersedia | Menurut chain aligned | Tidak muncul |
| Chain legacy diaktifkan kembali | Tetap offset | Muncul kembali |
| Belum ada chain aktif/pertama | Tidak dialokasikan | Tidak muncul |

Contoh warning:

> [KOMPATIBILITAS] INTENT v2 memakai penomoran lama: PLAN/EXEC v1.x (major PLAN = major INTENT - 1). Pola ini dipertahankan untuk kompatibilitas chain lama. Gunakan pola tersebut selama bekerja pada chain ini.

View bersama mengembalikan `numbering` (skema, versi INTENT, major PLAN, sumber resolusi) dan `compatibility_warnings` (daftar string). Tanpa chain: `numbering: null`, warning kosong. Warning tidak masuk `stale_intent_warnings` atau `blockers`, dan tidak mengubah gate, next operations, status validitas, atau sertifikasi dokumen. Nilai skema yang rusak menghasilkan diagnosis kesalahan, bukan warning legacy biasa.

### 4.3 Rekonstruksi dan konflik bukti

1. Discover artefak dengan aturan nama/folder yang berlaku, lalu baca metadata chain. Baca state chain yang masih valid sebelum menentukan pengelompokan. Jangan menetapkan group lewat `major + 1` terlebih dahulu.
2. Cocokkan state valid dan marker INTENT/PLAN/EXEC yang tersedia. Bukti terstruktur yang berbeda harus dilaporkan sebagai konflik; jangan memilih salah satu diam-diam. Marker malformed atau duplikat juga tidak dianggap marker absent.
3. Gunakan membership eksplisit untuk artefak baru. Artefak lama tanpa marker hanya dikaitkan melalui state yang valid atau aturan legacy dengan satu kandidat yang konsisten. Peralihan normal tidak menimbulkan benturan: bila INTENT legacy terakhir v3, PLAN legacy maksimal major v2, sedangkan INTENT baru pertama v4 memakai PLAN v4.x; major PLAN v3 terlewati. Contoh PLAN v2.1 yang diklaim INTENT v3 legacy sekaligus INTENT v2 aligned adalah data yang menyimpang dari urutan peralihan normal, bukan konsekuensi upgrade. Bukti tetap diperlukan agar rekonstruksi tidak mengaitkan PLAN aligned v4.x ke INTENT v5 dengan rumus offset lama.
4. Bila marker INTENT hilang tetapi marker PLAN/EXEC sepakat tentang INTENT dan skema, metadata tersebut dapat memulihkan aturan. Bila hanya INTENT aligned tersisa, skema tetap aligned meskipun tidak ada PLAN. Bila INTENT tidak tersedia sama sekali, jangan menciptakan INTENT dari file turunannya.
5. Membership tidak menyelesaikan keputusan lifecycle. Pertahankan batas inferensi yang sekarang, dengan guard bahwa PLAN/EXEC yang dipasangkan harus memiliki versi sama; perubahan APPROVED/LOCKED dan pemulihan lifecycle dibahas di F04.
6. Untuk konflik keanggotaan/skema yang belum terselesaikan, rekomendasi O-2 adalah tidak menulis chain yang terdampak. Menjalankan rekonstruksi ulang tidak mengganti legacy menjadi aligned atau mengalokasikan versi baru.

Batas bukti: jika state serta seluruh marker identitas pada artefak chain baru hilang/dihapus, file tanpa marker dapat tampak seperti artefak lama. Fallback legacy bukan pembuktian bahwa artefak berasal dari sebelum upgrade. Pada keadaan tersebut pemulihan penuh memerlukan bukti tambahan, misalnya versi Git; nomor file, waktu modifikasi, dan schema template tidak cukup. Rancangan ini menolak konflik/ambigu yang terdeteksi, tetapi tidak menjamin deteksi penghapusan seluruh metadata. Batas ini termasuk keputusan penyimpanan O-1.

## 5. Kompatibilitas dan migrasi

- Pembacaan chain lama tidak mengubah JSON/dokumen. INTENT lama yang diratifikasi sesudah upgrade tetap legacy. Aktivasi, sync, doctor, dan amandemen tidak menetapkan ulang skema.
- Marker baru hanya ditulis pada artefak yang dibuat atau pending yang dipromosikan melalui operasi terkait. INTENT/PLAN yang sudah RATIFIED/LOCKED tidak disentuh, sehingga sertifikasi hash historis tidak berubah karena F02.
- Fallback legacy dan pencatatan eksplisit di doctor tidak memerlukan perubahan `SCHEMA_VERSION`; konstanta tetap `1.2.0` sesuai batas sesi. Field baru bersifat tambahan, tetapi binary lama tidak memahami perilaku aligned. Dukungan membaca data lama oleh CLI baru tidak menjamin binary lama aman menulis chain aligned. Distribusi/versi yang mencegah pemakaian binary lama dicatat untuk F09/F12.
- State legacy dengan nomor/referensi menyimpang jangan diperbaiki melalui renumber. Laporkan konflik, pertahankan berkas, dan blokir mutasi terkait sampai bukti/koreksi disepakati. Fixture tes yang menyimpang diperbaiki atau dijadikan uji data invalid secara eksplisit.
- Tidak menggabungkan identitas penomoran dengan lifecycle v1/v2; chain aligned pada tahap F02 masih memakai lifecycle yang tersedia sampai F04 diterapkan.
- Schema template tetap tidak berubah. Marker baru independen dari section dan nama dokumen. Pengenalan nama tanpa prefix, termasuk di rekonstruksi, mengikuti F10.

## 6. Keputusan Director - ditutup

| ID | Pertanyaan dan opsi | Rekomendasi beserta alasan | Jawaban Director |
|---|---|---|---|
| O-1 / T-01 | Di mana aturan penomoran dan bukti pemulihan disimpan? A: field JSON chain + marker pada INTENT/PLAN/EXEC baru, dengan fallback legacy yang dilaporkan dan batas kehilangan metadata di atas. B: field JSON + registry pemulihan terpisah di proyek. C: registry terpisah ditambah marker artefak. | **A.** Bukti tetap mengikuti artefak ketika state hilang; PLAN/EXEC baru pada legacy juga memiliki membership eksplisit. Tidak menambah registry dengan transaksi/sinkronisasi sendiri. C memberi redundansi tambahan dengan biaya pemeliharaan; A tidak dapat membuktikan sejarah bila seluruh metadata dihapus. | Disetujui Director, 7 Oktober 2026 |
| O-2 / T-26 | Saat rekonstruksi menemukan konflik identitas/skema, apakah A: tidak menulis chain terdampak tetapi memulihkan chain independen yang bukti lengkapnya konsisten pada `--all-versions`; atau B: batalkan seluruh penulisan rekonstruksi? | **A.** Konflik satu chain tidak menghalangi pemulihan chain independen. Cakupan terdampak mencakup semua chain yang berebut artefak; untuk target tunggal konflik berarti gagal tanpa penulisan. Laporan parsial harus jelas, exit nonzero bila target tidak dapat dipulihkan, dan history tidak menyingkirkan metadata chain terdampak. B lebih sederhana tetapi menahan pemulihan seluruh proyek. | Disetujui Director, 7 Oktober 2026 |
| O-3 / T-27 | Apakah alokasi minor tetap jumlah entri + 1, atau diganti minor terbesar + 1 dengan pemeriksaan benturan file? | **Minor terbesar + 1, untuk kedua skema.** Contoh riwayat v3.1 dan v3.3: jumlah entri + 1 menghasilkan v3.3 lagi; max + 1 menghasilkan v3.4. Hitung semua status termasuk SUPERSEDED; tolak bila file tujuan sudah ada, jangan menimpa. Tidak menambah kebijakan penghapusan artefak atau registry high-water. Nomor yang seluruh buktinya sudah dihapus tetap tidak dapat diketahui. | Disetujui Director, 7 Oktober 2026 |

**Keputusan Director, 7 Oktober 2026:** "semua rekomendasi anda disetujui. anda bisa lakukan eksekusi". O-1 opsi A, O-2 opsi A, dan O-3 minor terbesar + 1 terkunci. Instruksi ini mengotorisasi implementasi serta titik build/uji pada bagian berikut; tidak mengotorisasi commit atau sinkronisasi.

## 7. Strategi uji dan kriteria selesai

Ini kontrak uji yang disetujui bersama rencana; hasil pelaksanaannya dicatat setelah verifikasi selesai.

| Kelompok | Bukti yang diwajibkan |
|---|---|
| Engine | Kedua skema menghasilkan major yang benar; chain tanpa field tetap legacy; nilai tidak dikenal dan referensi lintas chain ditolak; constructor tidak mengubah skema saat rekonstruksi. |
| Minor dan benturan | SUPERSEDED tidak menggunakan ulang nomor; riwayat berlubang mengikuti O-3; artefak tujuan yang sudah ada tidak tertimpa; penolakan tidak merusak pending/tracker. |
| Pembuatan/promosi | Proyek baru aligned; INTENT baru di proyek lama aligned; INTENT DRAFT pra-upgrade tetap legacy; PLAN tambahan/promosi pada legacy tetap offset; marker dan tracker konsisten. |
| Pairing | Eksekusi PLAN tidak berurutan tetap menghasilkan EXEC identik; rekonstruksi satu PLAN v3.1 dan EXEC v3.2 menolak pairing; marker referensi yang berbeda tidak dipakai untuk membuat pasangan. |
| Rekonstruksi | State hilang/rusak pada legacy, aligned, dan campuran; INTENT aligned tanpa PLAN; marker INTENT hilang dengan bukti turunan; artefak unmarked dengan kandidat bersaing; malformed/duplikat marker; konflik JSON/marker; target tunggal dan `--all-versions` sesuai O-2. Rekonstruksi tidak mengubah skema pada pengulangan. |
| Bootstrap CLI/MCP | Warning hanya untuk chain legacy aktif, termasuk v1 dan DRAFT tanpa PLAN; tidak ada warning bila aligned aktif atau belum ada chain; reaktivasi menampilkan kembali warning; paritas struktur/pesan, gate dan warning runtime tidak berubah akibat informasi kompatibilitas. |
| MCP control | Versi projected promosi sama dengan versi hasil commit; perubahan state chain membatalkan acuan stale; failpoint/rollback tidak meninggalkan membership yang tidak sesuai tracker; marker masuk file artefak yang sudah dicakup transaksi. |
| Regresi | ROADMAP, validasi schema template lama/baru, intent activation, supersede, doctor, sertifikasi hash, dan artefak historis tetap sesuai kontraknya. Fixture menyebut legacy/aligned secara sengaja, bukan menutupi kesalahan penomoran. |

Titik build/uji yang diusulkan untuk persetujuan eksekusi: pemeriksaan TypeScript tanpa emit, review diff source, lalu satu `npm run build` sebelum tes yang menjalankan CLI karena tes CLI membaca `dist/`. Setelah build, jalankan tes relevan dan suite penuh `npm test`; build tambahan hanya bila ada koreksi source. Build mengubah perilaku instalasi global yang memakai symlink, sehingga dijalankan setelah persetujuan rencana, bukan pada tahap penyusunan ini. Tes menggunakan proyek/home temporer, tidak memakai proyek terdaftar nyata.

Kriteria selesai: keputusan O-1 sampai O-3 tercatat; seluruh jalur di peta dampak menggunakan satu aturan chain; bukti uji memenuhi tabel; source dan dist hasil build konsisten; tidak ada renumber, sync, perubahan Protocol/Constitution/schema constant, atau commit tanpa instruksi Director. Jumlah tes baseline dari handoff belum diverifikasi ulang pada sesi ini.

## 8. Risiko, dependensi, dan catatan untuk fokus lain

- **Risiko utama:** salah mengaitkan PLAN/EXEC ke INTENT ketika state hilang. Marker membantu pemulihan; konflik dan batas fallback harus tetap terlihat. Duplikat artefak pada folder lama/baru tidak boleh diam-diam mengganti entry karena urutan scan.
- **Risiko metadata:** marker adalah data yang bisa disunting. Reader harus memeriksa format, nilai, konsistensi versi, dan membership. Jangan otomatis mensertifikasi hash setelah memperbaiki metadata.
- **Risiko kompatibilitas:** binary lama dapat mengabaikan field baru dan masih memakai offset. Tidak ada janji round-trip operasional binary lama untuk chain aligned.
- **F03:** resolusi message/memo memakai identitas chain dan referensi nyata; major PLAN saja bukan pengganti keanggotaan pada proyek campuran.
- **F04:** metadata F02 hanya numbering/membership. Pemulihan state APPROVED/LOCKED, pasangan ambigu, dan revisi kontrak dibahas terpisah. Rancangan F02 tidak mengesahkan inferensi lifecycle lama sebagai desain akhir Sigma v2.
- **F09/F12:** distribusi runtime, skill/bridge, deskripsi tool/registry, dan penanganan versi binary harus memastikan operasi memakai runtime yang mengerti skema aligned. Template global lama tetap dapat digunakan untuk marker karena kode menulis identitas setelah penyalinan.
- **F10:** pola nama lama dan tanpa prefix perlu diterima oleh discovery setelah fokus tersebut diterapkan; penanda keanggotaan tidak bergantung pada prefix role.

Butir perubahan **Protocol yang dicatat, belum dieksekusi**:

1. Aturan default untuk INTENT/chain baru: PLAN major sama dengan INTENT; EXEC mengikuti PLAN pasangannya.
2. Pengecualian kompatibilitas: chain lama, termasuk DRAFT pra-upgrade, memakai aturan yang dinyatakan bootstrap; aktivasi/amandemen/doctor tidak mengubahnya.
3. Bedakan aturan penomoran dari schema template, schema runtime, versi instalasi, dan lifecycle.
4. Nomor versi tidak membuktikan membership pada proyek campuran; rekonstruksi memakai bukti identitas dan melaporkan konflik. Metadata identitas tidak membuktikan persetujuan/lock.

## 9. Urutan langkah implementasi

Urutan eksekusi berdasarkan persetujuan eksplisit Director atas seluruh rekomendasi dan eksekusi:

1. Catat keputusan dan koreksi penjelasan peralihan normal; implementasikan resolver, metadata, generator, serta guard nomor/referensi.
2. Terapkan metadata pada service INTENT/PLAN/EXEC/promosi, termasuk transaksi dan penolakan benturan file.
3. Selaraskan rekonstruksi dan laporan konflik, kemudian view bootstrap serta CLI/MCP.
4. Tambahkan tes perilaku dan sesuaikan fixture yang sebelumnya memakai numbering sintetis tidak konsisten. Jalankan TypeScript tanpa emit dan review diff sebelum build.
5. Jalankan build (dampak instalasi global sudah diberitahukan), tes relevan dan suite penuh. Koreksi kegagalan bila ada, build ulang hanya setelah source berubah. Catat hasil dan perbarui F00; tidak melakukan commit/sync.

## 10. Hasil implementasi dan verifikasi

### Perilaku yang diterapkan

- `src/engine/numbering.ts` menjadi resolver skema dan parser/penulis marker identitas. Penomoran terpisah dari schema runtime/template dan lifecycle. Marker dibaca hanya dari lokasi artefak yang dikenali; pembacaan metadata memeriksa batas proyek, berkas biasa, dan batas ukuran 512 KiB.
- Service INTENT membuat chain aligned dan marker sejak awal. Service PLAN, EXEC, dan promosi pending menulis marker sesuai chain; EXEC menyimpan referensi PLAN identik. Generator minor memakai maksimum historis + 1, termasuk SUPERSEDED. File tujuan yang sudah ada ditolak sebelum mutasi.
- Validasi pendaftaran, promosi, dan mutasi menegakkan nomor/referensi chain. Mode pemulihan yang melonggarkan gate lifecycle tidak melonggarkan identitas chain. Doctor mencatat fallback legacy pada JSON tanpa menyunting artefak lama.
- Rekonstruksi menentukan membership sebelum membangun state. State yang masih membawa klaim identitas dan marker artefak diperiksa bersama. Konflik nomor, marker malformed/duplikat, versi artefak duplikat lintas folder, pairing EXEC/PLAN tidak identik, atau pemilik bersaing mencegah penulisan chain terdampak. Chain independen tetap dipulihkan pada `--all-versions`; history dipertahankan ketika ada konflik.
- Bootstrap CLI dan orientasi MCP memakai view yang sama. MCP mengembalikan `numbering` serta `compatibility_warnings`; warning legacy hanya muncul untuk chain aktif dan terpisah dari warning runtime/blockers. View tidak mengubah gate atau menulis state.

Constructor tetap memiliki default legacy untuk kompatibilitas pemanggil lama/fixture; kedua caller produksi (pembuatan INTENT dan rekonstruksi) menyebut skema secara eksplisit. Ini mencegah rekonstruksi mengadopsi default aligned.

### Bukti pengujian

- TypeScript tanpa emit lulus; build terakhir lulus dan menghasilkan `dist/` sesuai source. Build dijalankan kembali hanya setelah koreksi source.
- `test/chain-numbering.test.ts`: **25 tes lulus**, mencakup kedua skema, minor berlubang, benturan file, metadata, chain DRAFT lama, active-only bootstrap, pemulihan state/marker hilang, konflik dua pemilik, dan artefak tanpa INTENT.
- Tes transport MCP pembuatan PLAN dan prepare/commit promosi diperluas untuk kedua skema, termasuk kesesuaian marker dan versi preview/commit. Pengujian concurrency, stale-state, rollback, dan process-death recovery yang sudah ada dijalankan melalui suite penuh.
- Tes relevan setelah koreksi lulus. Suite penuh akhir: **68 berkas / 934 tes lulus**, tanpa tes gagal, kode keluar npm/Vitest **0**. Kode keluar diperiksa eksplisit melalui `$LASTEXITCODE`; PowerShell sebelumnya menggolongkan warning CJS Vite pada stderr sebagai `NativeCommandError`, meskipun ringkasan Vitest bersih. Pemeriksaan akhir mengonfirmasi proses pengujian berhasil.
- `git diff --check` bersih. Source baru, output `dist/`, tes, dokumen F02, dan indeks F00 belum di-commit.

Fixture yang semula memakai PLAN tanpa minor, EXEC yang tidak sama dengan PLAN, atau angka aligned tanpa skema diperbaiki sebagai data uji. Tidak ada renumber pada proyek nyata. Constitution, Protocol, `SCHEMA_VERSION`, template, rules/memory/skill, registry, dan distribusi global/proyek tidak disunting atau disinkronkan. Build mengubah runtime global melalui symlink yang sudah ada; proses server yang telah memuat modul lama perlu sesi baru untuk memuat hasil build.

Batas yang tetap berlaku: kehilangan seluruh bukti identitas memerlukan bukti tambahan untuk pemulihan; metadata tidak membuktikan approval/lock; binary lama belum aman menulis chain aligned. Perubahan Protocol, distribusi, versi instalasi, dan lifecycle tetap mengikuti fokus yang tercatat pada bagian 8.
