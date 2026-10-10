# F07 — Pilot keterbacaan dan penyederhanaan dokumen Sigma

Tanggal: 10 Oktober 2026
Status: DRAF RENCANA. Belum ada pilot, perubahan template/rule/validator, build, distribusi, atau perubahan proyek KLHK.
Dasar: [F00](F00_indeks-dan-register.md) (Strategy Action 6–7 dan T-14), [F01](F01_peta-konsistensi-aturan.md), [diskusi rencana Sigma v2](../../Discussion/Evaluation-06102026/diskusi_rencana_perubahan_sigma_v2.md) bagian "Penyederhanaan dokumen Sigma" dan Strategy Action. Keputusan terbaru Director: Constitution dan Protocol ditangani terakhir setelah fokus isi stabil, sebelum F09 dan uji coba proyek nyata.

## 1. Tujuan dan batas

F07 menguji apakah Director dapat memahami hasil, batas, ukuran selesai, risiko material, dan keputusan yang masih terbuka dari artefak Sigma tanpa penjelasan lisan tambahan. Pilot harus memastikan ARC, FMN, DEV, dan AUD menafsirkan kewajiban yang sama secara konsisten. Pemendekan jumlah baris bukan ukuran keberhasilan.

Dua keluaran F07:

1. **Hasil pilot keterbacaan:** peta makna sumber, rancangan penyajian ringkas, jawaban pembaca, perbedaan interpretasi, dan keputusan struktur yang didukung bukti.
2. **Perubahan master setelah pilot diterima:** revisi terarah pada template, validator, rules, skill, memory, dan petunjuk aktif yang benar-benar diperlukan. Cakupan pastinya ditentukan dari hasil pilot dan keputusan terbuka di bawah.

Artefak KLHK dipakai sebagai **bahan baca**. PLAN/EXEC yang telah LOCKED dan artefak proyek lain tidak ditulis ulang. F07 tidak menyinkronkan master ke `~/.sigma` atau proyek (F09), tidak menjalankan pekerjaan geospasial KLHK, dan tidak mengubah lifecycle, amandemen, penomoran, atau otoritas role. Constitution dan Protocol hanya mendapat daftar dampak untuk review terakhir yang terpisah; teks keduanya tidak diubah dalam F07.

## 2. Keputusan yang sudah terkunci

- F01 menjadi dasar: sumber master, host, dan proyek memiliki drift; perubahan lokal proyek tidak boleh ditimpa otomatis. Hasil F07 dibuat pada master saja dan ditahan dari distribusi sampai F09.
- Director Summary berada di awal INTENT, PLAN, dan EXEC master; brief INTENT tidak menjadi artefak atau persetujuan terpisah. Jumlah awal tiga contoh termasuk dan tiga tidak termasuk masih **peringatan validator**, bukan syarat jumlah untuk ratifikasi. F07 menilai apakah angka tersebut efektif (F00 T-14).
- `Guidance for FMN` telah dihapus dari INTENT schema 5 oleh E01B. Fokus eksekusi milik FMN pada ROADMAP/PLAN. Pilot tidak menghidupkan kembali section itu.
- Writing Style Rules sudah ada pada master ARC/FMN/DEV rules, skill empat target, dan pengingat role memory. F07 menguji penerapannya, bukan menambah aturan gaya yang redundan.
- Dokumen dan kode mendukung schema lama dan baru. Penyederhanaan tampilan tidak boleh membuat artefak lama tidak terbaca atau mengubah status LOCKED.
- Constitution memerlukan jalur amandemen F15 bila ada perubahan prinsip/otoritas. Protocol direvisi setelah keputusan isi F07/F08/F10/F12 stabil dan sebelum distribusi F09.

## 3. Bukti awal dan peta dampak

| Objek | Fakta terverifikasi pada 10 Oktober 2026 | Implikasi untuk F07 |
|---|---|---|
| KLHK PLAN v5.3 dan EXEC v5.3 | Berkas tersedia pada `Sigma/contract/FMN-PLAN-v5.3.md` (schema 2) dan `Sigma/evidence/DEV-EXEC-v5.3.md` (schema 2); masing-masing 245 dan 544 baris. EXEC memuat tiga klarifikasi pra-build: rasterisasi ulang PL24, cakupan komposisi pada 10 piksel, dan arti ambang 6,25 ha. | Pasangan utama untuk uji apakah kontrak ringkas mempertajam pertanyaan tanpa menghilangkan batas, angka, dan bukti. Isi teknis diperlakukan sebagai klaim artefak, bukan diverifikasi ulang. |
| KLHK INTENT v6 | `Sigma/charter/DIR-INTENT-v6.md` tersedia (schema 4; 670 baris). | Sumber batas dan tujuan saat menilai keterlacakan PLAN; juga bahan uji contoh batas brief. Schema lama tidak dijadikan template baru. |
| KLHK PLAN v5.4 | Diskusi September mencatat dokumen DRAFT 261 baris sebagai pembanding kompleks. Berkas tersebut **belum ditemukan** pada daftar berkas proyek sekarang, pemeriksaan folder kontrak, maupun daftar berkas Git proyek. | Ketersediaan sumber perlu diputuskan sebelum pembanding kompleks ditetapkan. `FMN-PLAN-v5.2.md` tersedia, tetapi kasus dan pertanyaan yang diuji berbeda. |
| Template master | INTENT schema 5, PLAN schema 3, EXEC schema 3, CLOSE schema 2. Tiga template pertama sudah menempatkan Director Summary di awal. PLAN schema 3 sudah menggabungkan acceptance criteria dan test contract. | Jangan mengulang perubahan yang telah diterapkan. Uji kualitas isi, lokasi batas/keputusan, dan kegunaan struktur saat diisi. |
| Validator | `src/utils/docCheck.ts` memisahkan spesifikasi per schema; jumlah 3+3 memunculkan peringatan; sebagian kelengkapan PLAN/EXEC hanya diperingatkan. | Setiap perubahan marker, urutan, atau kewajiban memerlukan penilaian dampak dan tes kompatibilitas per schema. Pilot tidak boleh menganggap lolos validator setara dengan dipahami manusia. |
| CLOSE | Template CLOSE masih mengacu nomor section INTENT lama, seperti "Desired Outcome (1.4)" dan "Success Criteria (3.1)" (temuan F01-09). | Review langsung dengan rubrik yang sama dan koreksi rujukan setelah keputusan; jangan merombak CLOSE hanya dengan bukti pilot PLAN/EXEC. |
| Rules, skill, memory | Writing Style Rules sudah ada; F01 memberi hash `source_rule_version` pada memory master. | Ubah hanya petunjuk yang terbukti salah/berulang. Bila rule berubah, perbarui hash memory dan periksa paritas skill. |

Rujukan lokasi KLHK di tabel adalah sumber baca di luar repo ini: `/home/dikoharyadhanto/Documents/Works/Projects/KLHK_JasaLingkunganHidup`. Tidak ada snapshot baru yang dibuat di proyek tersebut.

## 4. Kontrak pilot

### 4.1 Bahan dan pembanding

- **Kasus utama:** PLAN/EXEC v5.3 bersama bagian INTENT v6 yang menjadi sumbernya. Bandingkan cara baca dokumen asli dengan penyajian alternatif yang memuat kewajiban sama.
- **Kasus kompleks:** PLAN v5.4 bila sumber autentik tersedia dan statusnya dapat dikonfirmasi. Bila tidak, gunakan v5.2 hanya sebagai pembanding kompleks alternatif, dengan tujuan uji dan batas interpretasi dicatat ulang. Hasil v5.2 tidak boleh dipresentasikan sebagai validasi v5.4.
- **Brief INTENT:** uji enam contoh batas (tiga termasuk, tiga tidak termasuk) terhadap skenario yang memang menimbulkan salah tafsir. Bandingkan juga jumlah yang lebih sedikit bila enam contoh mengulang makna; keputusan akhir dibuat dari pemahaman dan cakupan, bukan angka tetap.
- Artefak contoh disusun sebagai **salinan konseptual terpisah**. Tidak menyunting sumber KLHK atau memasukkan dokumen proyek utuh ke repositori master. Bahan kerja sementara berada di `/tmp`; laporan F07 hanya menyimpan peta kewajiban, ringkasan/ekstrak minimal yang diperlukan, dan hasil penilaian.

### 4.2 Peta makna sebelum penyederhanaan

Untuk setiap kewajiban sumber, catat ID/rujukan, pemilik keputusan, hasil yang wajib, larangan, angka/ambang, metode yang boleh dipilih DEV, bukti verifikasi, prasyarat, keputusan terbuka, dan tempatnya pada rancangan alternatif. Kewajiban yang dihapus atau berubah makna ditandai sebagai **perubahan substantif** dan tidak diterima sebagai penyuntingan gaya.

Kasus v5.3 wajib menguji secara eksplisit:

1. Apakah rasterisasi ulang PL24 dari GDB diizinkan, dengan gerbang rekonsiliasi yang tetap terlihat.
2. Apakah "sensitivitas lengkap" berarti total klaster 10/25/100 piksel, sementara komposisi hanya ada mulai 25 piksel; konsekuensi data 10 piksel tetap jelas.
3. Apakah 6,25 ha merupakan ambang tambahan dan bukan padanan 10/25/100 piksel.
4. Apakah kesesuaian terhadap PL2024 dibedakan dari akurasi model, serta batas perubahan data produksi dan pekerjaan di luar lingkup tetap eksplisit.
5. Apakah AC/TC dan bukti pasca-build masih dapat ditelusuri tanpa memaksakan pemetaan satu banding satu.

### 4.3 Uji pemahaman

Gunakan pertanyaan yang sama untuk dokumen asli dan alternatif, dengan jawaban acuan yang diturunkan dari sumber sebelum rancangan alternatif dibaca:

| Pertanyaan | Bukti jawaban memadai |
|---|---|
| Apa hasil wajib dan batas pekerjaan? | Menunjuk hasil, pengecualian, dan larangan yang tepat beserta rujukan. |
| Kapan pekerjaan dianggap selesai? | Menyebut kriteria, metode, hasil yang diterima, dan bukti; tidak mengganti "kesesuaian" menjadi "akurasi". |
| Apa yang dapat DEV putuskan sendiri? | Memisahkan pilihan metode dari ambang/lingkup yang perlu keputusan FMN atau Director. |
| Apa yang masih belum diputuskan? | Menyebut keputusan terbuka dan konsekuensi terhadap kesiapan, tanpa menyamarkannya sebagai persetujuan. |
| Apa status hasil saat ini? | Membedakan kontrak pra-build, hasil, review FMN, batasan, dan riwayat; tidak menyimpulkan hasil teknis telah diverifikasi oleh pilot. |

Director menilai kegunaan untuk persetujuan. Penafsiran ARC/FMN/DEV/AUD dicatat terpisah dengan konteks peran yang sama; perbedaan dicocokkan ke jawaban acuan, bukan diselesaikan dengan penjelasan lisan setelah membaca. Catat pertanyaan klarifikasi, salah tafsir material, lokasi informasi yang sulit ditemukan, dan waktu baca sebagai indikator sekunder. Tidak menetapkan target menit atau persentase pemangkasan yang belum disetujui.

### 4.4 Kriteria lulus dan berhenti

Pilot layak menjadi dasar revisi master bila:

- Tidak ada kewajiban, angka, larangan, otoritas, risiko material, atau bukti yang hilang/berubah tanpa keputusan eksplisit.
- Director dapat menjawab lima pertanyaan dari dokumen; titik yang masih perlu keputusan tampak jelas sebelum persetujuan.
- Penafsiran role atas hasil, batas, bukti, dan kewenangan sejalan dengan jawaban acuan; beda material diidentifikasi dan diperbaiki di rancangan.
- Ringkasan konsisten dengan kontrak utama, dan kontrak tetap dapat ditelusuri dari INTENT ke PLAN/EXEC.
- Kasus kompleks tidak tampak "siap" hanya karena tabel atau narasinya lebih pendek.

Jika penyederhanaan menghilangkan satu butir material, menyamarkan keputusan terbuka, atau membuat pembaca keliru tentang otoritas/hasil, hentikan promosi rancangan itu ke template. Perbaiki dan uji kembali bagian yang terdampak. Hasil pilot boleh menunjukkan bahwa struktur master saat ini cukup baik; F07 tidak mewajibkan perubahan kosmetik.

## 5. Rencana implementasi setelah hasil pilot

Tahap ini **usulan pekerjaan**, belum otorisasi mengubah aset:

1. Tetapkan struktur yang lulus pilot per artefak. Pertahankan ringkasan di awal, definisi kewajiban di satu lokasi yang dapat dirujuk, serta pemisahan keputusan final dari asumsi dan pertanyaan terbuka.
2. Revisi template master hanya pada bagian yang terbukti mengganggu pembacaan. Periksa INTENT, PLAN, EXEC satu per satu. CLOSE mendapat review langsung atas rujukan INTENT usang dan pembacaan keputusan penutupan; perubahan semantiknya menunggu bukti spesifik.
3. Untuk perubahan struktur/marker/gerbang, ubah `src/utils/docCheck.ts` dan fixture/tes per schema. Dokumen lama tetap dapat dibaca; dokumen LOCKED tidak ditulis ulang. Pilih apakah perubahan cukup kompatibel dalam schema kini atau memerlukan schema baru berdasarkan dampak yang nyata.
4. Perbarui role rules sebagai sumber otoritatif untuk prosedur penulisan, lalu skill/bridge dan role memory sebagai petunjuk turunan. Setiap rule yang berubah membuat hash `source_rule_version` memory terkait diperbarui. Registry, CLI help, dan orientasi diperiksa hanya jika perilaku/petunjuknya berubah.
5. Catat dampak yang perlu dibawa ke review akhir Constitution/Protocol tanpa menyuntingnya di F07. Jalur amandemen Constitution tetap F15; Protocol diperbarui setelah keputusan isi lain stabil dan sebelum F09.
6. Verifikasi master: peta makna lengkap, perbandingan marker/schema, tes validator dokumen baru dan lama yang relevan, `npx tsc --noEmit`, build `dist/`, tes fokus, lalu suite regresi bila kode berubah. Build memengaruhi CLI/MCP host karena symlink; titiknya ditetapkan setelah patch dapat direview.

## 6. Kompatibilitas, distribusi, dan risiko

- Pilot memakai artefak KLHK dengan schema lama sebagai **kasus pemahaman**, bukan bukti bahwa schema lama harus dikonversi. Konversi proyek dan sinkronisasi host ditahan sampai F09.
- Dokumen yang telah LOCKED tidak disunting. Rancangan alternatif tidak boleh diperlakukan sebagai revisi resmi kontrak KLHK atau sertifikasi hasil teknis.
- Ringkasan terlalu pendek dapat menyembunyikan lingkup dan ambang; tabel gabungan dapat menyembunyikan hubungan banyak-ke-banyak AC/TC. Peta makna dan tanya-jawab menjadi pengaman utama.
- Uji oleh agen yang sudah membaca hasil historis dapat bias. Urutan dan konteks baca harus dicatat; bila memungkinkan, beri pembaca hanya paket yang akan mereka miliki pada tahap kerja tersebut.
- Distribusi parsial berisiko karena host/project masih memakai template dan skill lama. F09 harus menyatukan perubahan F07 dengan Protocol/Constitution final serta klasifikasi drift F01 sebelum uji coba proyek nyata.

## 7. Keputusan terbuka untuk Director

| ID | Keputusan | Rekomendasi dan alasan | Status |
|---|---|---|---|
| O-1 | Pembanding kompleks ketika PLAN v5.4 belum ditemukan pada salinan KLHK kini | Minta lokasi/salinan autentik v5.4. Bila tidak tersedia, pakai v5.2 sebagai kasus kompleks **berlabel pengganti**, bukan seolah-olah sama; jangan membuat ulang v5.4 dari ringkasan diskusi. | TERBUKA |
| O-2 | Siapa yang menilai pemahaman pilot? | Director memberi penilaian keputusan; penafsiran ARC/FMN/DEV/AUD dikumpulkan dengan pertanyaan acuan yang sama dan dicatat per role. Sesi role hanya dilakukan setelah otorisasi pilot; tidak mengubah state Sigma. | TERBUKA |
| O-3 | Status angka contoh batas brief INTENT | Pertahankan 3+3 sebagai nilai awal dan peringatan sampai hasil pilot. Putuskan jumlah final dari cakupan salah tafsir, bukan panjang dokumen. | TERBUKA (T-14) |
| O-4 | Luas perubahan CLOSE pada F07 | Review rujukan lama dan keterbacaan keputusan penutupan; koreksi terarah bila terbukti, tetapi tidak mengadopsi struktur baru PLAN/EXEC secara otomatis. | TERBUKA |
| O-5 | Penyimpanan bahan pilot berbasis artefak KLHK | Simpan dokumen sumber tetap di proyek asal; bahan sementara di `/tmp` dan laporan master hanya menyimpan peta/ekstrak minimal yang diperlukan. Ini mengurangi duplikasi dokumen proyek dan risiko drift. | TERBUKA |

Setelah O-1 sampai O-5 diputuskan, susun instrumen pilot dan bahan yang dapat direview. Perubahan template/rule/validator baru dimulai setelah hasil pilot dan patch konkretnya disetujui.
