# Diskusi Sigma — INTENT dan CLOSE, Dibahas Per Seksi

**Tanggal:** 15 Oktober 2026
**Jenis:** Peta kerja diskusi. Setiap seksi diputuskan satu per satu oleh Director.
**Status:** Bahan pembahasan. **Bukan** keputusan, persetujuan implementasi, atau perubahan template, rule, atau kode.
**Pendahulu:** `DISKUSI_SIGMA_INTENT_STRATEGIS_2026-10-15.md` (evaluasi INTENT sebagai mandat strategis).

## Cara memakai dokumen ini

- Satu seksi dibahas sampai selesai sebelum seksi berikutnya dibuka.
- Setiap seksi memuat: tujuan, bahan yang sudah terverifikasi, keputusan terbuka (dengan rekomendasi), ketergantungan, dan keluaran.
- Butir bertanda **[Director]** adalah pernyataan Director. Butir bertanda **[Verifikasi]** berasal dari pembacaan rule, template, atau kode. Butir bertanda **[Inferensi]** adalah penilaian asisten yang belum diputuskan.
- Kolom status keputusan di setiap seksi diisi hanya setelah Director memutuskan.

## Peta seksi dan urutan yang disarankan

| # | Seksi | Jenis | Bergantung pada | Status |
|---|---|---|---|---|
| 1 | Definisi dan makna INTENT | Keputusan konsep | — | SELESAI (15 Oktober 2026) |
| 2 | Perombakan template INTENT | Perubahan dokumen | 1 | KEPUTUSAN SELESAI (15 Oktober 2026); daftar perubahan menunggu persetujuan akhir Director |
| 3 | Recheck dan sinkronisasi ARC-RULE, skill, memory ARC | Perubahan dokumen | 1, 2, 4, 6, 7 | TERBUKA |
| 4 | Definisi dan makna CLOSE | Keputusan konsep | 1 | DISETUJUI (15 Oktober 2026) |
| 4a | PRODUCT REVIEW (artefak baru, hasil diskusi seksi 4 dan 5) | Keputusan konsep dan desain | 1, 4 | PRINSIP DISETUJUI; rincian ditunda ke tahap detail sistem closure |
| 5 | Sistem agar CLOSE murah dan tidak membebani ARC | Keputusan desain | 4 | TERBUKA |
| 6 | Perombakan template CLOSE | Perubahan dokumen | 4, 5, 7 | TERBUKA |
| 7 | Skoring ARC: dihapus atau direkonstruksi | Keputusan desain | 1, 4, 5 | SEMENTARA: band turunan otomatis dari PRODUCT REVIEW, bukan gate; rincian ditunda |

**Urutan kerja yang disarankan [Inferensi]:** 1 → 4 → 7 → 5 → 2 → 6 → 3.
Alasan: definisi (1, 4) harus ada sebelum desain apa pun. Keputusan skoring (7) menentukan bentuk sistem CLOSE (5) dan template CLOSE (6). Perubahan template (2, 6) menyusul. Sinkronisasi rule, skill, dan memory (3) dikerjakan terakhir karena merujuk bentuk final semua yang lain.

---

## Seksi 1 — Definisi dan makna INTENT

**Tujuan:** menetapkan satu definisi INTENT yang menjadi dasar semua perubahan berikutnya.

### Bahan

- **[Director]** INTENT adalah visi atau mandat strategis atas satu objektif utama. Rincian pekerjaan berada di PLAN. Satu INTENT bertahan melewati banyak PLAN–EXEC. Perubahan atau penambahan fitur tidak otomatis berarti perubahan tujuan. INTENT tetap cukup jelas untuk mengendalikan pekerjaan dan dapat diamandemen.
- **[Director]** Untuk proyek aplikasi, INTENT menjelaskan aplikasi yang ingin dihasilkan dan kualitasnya (security, UX, UI, performance), tidak membakukan daftar fitur.
- **[Director]** ARC hanya peduli produk akhir dan kesesuaiannya dengan tujuan, tidak peduli caranya.
- **[Verifikasi]** Struktur chain sudah mendukung model ini: satu INTENT per chain, banyak PLAN dan EXEC. Masalahnya ada pada isi yang dianjurkan template dan rule, bukan pada struktur.
- **[Verifikasi]** Protokol: "A complementary or replacing INTENT is a separate chain"; ratifikasi INTENT baru tidak men-supersede INTENT lain secara otomatis.
- **[Verifikasi]** Rule memuat dua tekanan yang bertentangan: INTENT harus "explicit enough for FMN to plan without inventing intent" dan ARC "refuses ambiguous intent synthesis", berhadapan dengan kebutuhan INTENT yang strategis dan tahan perubahan.

### Definisi INTENT (DISETUJUI Director, 15 Oktober 2026)

> INTENT adalah mandat strategis atas satu objektif utama: apa yang hendak dihasilkan, untuk siapa, mengapa, pada standar mutu apa, dan bagaimana keberhasilannya dikenali pada produk akhir. Satu INTENT menangkap satu mandat dengan satu objektif utama. Ia bertahan melewati perubahan fitur, metode, dan tahapan.

Catatan: kalimat terakhir draf awal ("ia berubah hanya bila objektif, penerima manfaat, atau definisi berhasil berubah") digantikan oleh jalur perubahan di bawah, karena mencampur amandemen dengan INTENT baru. Istilah "mandat" dipakai sebagai unit, bukan "proyek": satu proyek dapat memuat lebih dari satu mandat yang independen.

Saat definisi ini masuk ke rule dan template Sigma, prosanya diterjemahkan ke bahasa Inggris, bukan disalin.

### Uji isi INTENT [Inferensi; perumusan final di Seksi 2]

1. **Uji falsifiability** (sudah ada di rule): outcome dan threshold terukur dan mengukur outcome itu sendiri.
2. **Uji ketahanan:** bila fitur, metode, atau tahap berubah dan tujuan tetap, apakah butir ini masih benar?
3. **Uji produk akhir:** dapatkah ARC menjawab butir ini dengan memeriksa produk akhir dan INTENT saja, tanpa membaca riwayat pekerjaan?

Butir yang gagal uji 3 bersifat *process-only*. Ia bukan otomatis salah masuk INTENT, tetapi pengawalnya FMN dan AUD selama BUILD, bukan ARC saat CLOSE.

### Jalur perubahan (DISETUJUI Director, 15 Oktober 2026)

| Tingkat | Perubahan | Jalur |
|---|---|---|
| T1 | Fitur, metode, teknologi, tahapan | PLAN atau ROADMAP; INTENT tidak disentuh |
| T2 | Penajaman atau koreksi objektif, penerima manfaat, atau definisi berhasil **yang sama** | Amandemen INTENT |
| T3 | Perubahan arah objektif utama | INTENT baru yang independen |

**[DIGANTIKAN oleh redaksi M2, DISETUJUI Director, 15 Oktober 2026.]** Tabel di atas memiliki celah: fitur yang mengubah penerima manfaat, batas strategis, atau standar mutu secara harfiah tergolong T1. Redaksi yang berlaku:

| Tingkat | Perubahan | Jalur |
|---|---|---|
| T1 | Fitur, metode, teknologi, atau tahapan yang **tidak mengubah** outcome, penerima manfaat, batas strategis, maupun standar mutu | PLAN atau ROADMAP; INTENT tidak disentuh |
| T2 | Penajaman atau koreksi objektif, penerima manfaat, definisi berhasil, batas strategis, atau standar mutu, **dengan objektif utama yang sama** | Amandemen INTENT |
| T3 | Perubahan arah objektif utama | INTENT baru yang independen |

Catatan: klasifikasi adalah panduan bagi ARC dan Director, bukan gate; kasus yang meragukan T1 atau T2 disampaikan ARC kepada Director. Jalur FMN memakai status `AMENDMENT_REQUESTED` pada template PLAN yang sudah ada. Efektivitas uji ini bergantung pada INTENT yang ditulis pada tingkat strategis (lihat 2.1 dan 2.4).

Pertimbangan Director yang mendasari: perubahan arah jarang terjadi. Pada rantai yang sudah berat, mengamandemen objektif utama sama mahalnya dengan INTENT baru dan membuat dokumen PLAN serta kontrak tidak sinkron, sehingga tampak seperti tujuan berbeda. Seringnya berpindah versi INTENT menandakan INTENT dipakai sebagai serpihan objektif kecil.

### Indikator kualitas (DISETUJUI Director, 15 Oktober 2026)

INTENT yang baik jarang diamandemen. Amandemen berulang pada Scope, Functional Requirements, atau Constraints dibaca sebagai tanda INTENT memuat butir implementasi atau terlalu mengekang. Indikator ini informatif dan tidak menjadi gate, karena penghukuman terhadap amandemen mendorong INTENT dibiarkan usang.

### Usulan turunan (belum diputuskan secara eksplisit) [Inferensi]

- Ambang numerik berat rantai dihapus; cukup panduan kualitatif.
- Peringatan divergensi ARC wajib menyebut pasangan LOCKED yang terdampak (dari `amendment preview`) dan memberi rekomendasi berdasarkan T2/T3, tetap bukan gate.
- Amandemen mencatat bagian INTENT yang disentuh. Belum diperiksa apakah AMD-NNN sudah merekamnya secara terstruktur.
- Uji independensi INTENT baru: "dapatkah ia ditutup dan dinilai tanpa INTENT lain?" dan "apakah ia hanya tahap atau paket kerja dari objektif yang sudah punya INTENT?"

### Keputusan terbuka

| # | Pertanyaan | Rekomendasi | Status |
|---|---|---|---|
| 1.1 | Unit INTENT | Satu INTENT = satu mandat dengan satu objektif utama; satu proyek idealnya satu INTENT; beberapa INTENT diperbolehkan bila objektifnya independen. | SELESAI untuk unit. Sisa produk berumur panjang dipindah ke 1.6 |
| 1.2 | INTENT berfungsi ganda: pagar wewenang FMN dan tolok ukur penilaian CLOSE? | Ya. | TERCAKUP oleh definisi ("mandat" dan "dikenali pada produk akhir") |
| 1.3 | Kriteria masuk butir ke INTENT dan kategori wajib | Satu kriteria ditambah daftar kategori minimal. | DIPINDAH ke Seksi 2; tersirat oleh definisi |
| 1.4 | Jalur perubahan T1/T2/T3 | — | **DISETUJUI** |
| 1.5 | Peran Functional Requirements | Dipertahankan sebatas kapabilitas inti. | DIPINDAH ke Seksi 2 (soal isi template) |
| 1.6 | Objektif tercapai lalu produk berlanjut: INTENT baru atau bukan? (lihat catatan di bawah) | Objektif baru setelah CLOSE = INTENT baru yang independen. | **DISETUJUI Director, 15 Oktober 2026** |
| 1.7 | Indikator kualitas (amandemen jarang) | — | **DISETUJUI** |

**Catatan 1.6:** jalur T1–T3 tidak mencakup kasus ketika objektif sudah tercapai (CLOSE) dan produk yang sama dilanjutkan dengan tujuan berikutnya. Itu bukan penajaman (T2) dan bukan perubahan arah (T3).

**Keputusan 1.6 (DISETUJUI Director):** bila objektif sebuah INTENT sudah tercapai dan ditutup lewat CLOSE, tujuan lanjutan untuk produk yang sama dirumuskan sebagai INTENT baru yang independen. INTENT yang sudah CLOSE tidak diamandemen untuk memuat tujuan lanjutan.

**Keluaran seksi:** satu definisi INTENT yang disetujui, tiga jalur perubahan, dan satu indikator kualitas. Tiga uji isi dirumuskan final di Seksi 2.

**Status seksi (15 Oktober 2026):** SELESAI. Butir 1.3 dan 1.5 dibahas di Seksi 2.

---

## Seksi 2 — Perombakan template INTENT

**Tujuan:** menjadikan template `DIR-INTENT-TEMPLATE.md` (schema 5) mencerminkan definisi Seksi 1.

### Bahan

- **[Verifikasi]** Lima titik risiko pada template saat ini (dari dokumen pendahulu §5.2): Objective terlalu terbuka, kolom *Must Deliver* di Scope, *Out of Scope* yang menggabungkan deferred dan non-goal, Functional Requirements bergaya backlog, dan Constraints and Technical Direction serta Success Threshold.
- **[Verifikasi]** Validator ratify schema 5 hanya memeriksa Director Summary, contoh batas included/excluded, dan empat dimensi Quality Standards (`src/utils/docCheck.ts:614-665`). Scope, Constraints, dan Functional Requirements tidak diwajibkan oleh kode.
- **[Verifikasi]** Gate PLAN schema 3 memberi peringatan bila "Requirements served (REQ IDs)" kosong (`src/utils/docCheck.ts:715-717`).
- **[Verifikasi]** `intent clone` hanya mendukung INTENT schema 5 dan PLAN schema 3. Fixture schema 4 ada di `test/fixtures/`.
- **[Inferensi]** Perubahan struktur template berpotensi memerlukan kenaikan nomor schema. Dampaknya ke `cloneDraftService`, validator, dan fixture belum diinventarisasi.
- **[Director, 15 Oktober 2026]** Tidak ada pengaturan khusus tentang standar mutu yang berpotensi usang (tidak ada aturan rujukan mengambang, tidak ada kolom penanda, tidak ada pencatatan versi tambahan). Dibiarkan mengalir apa adanya; dievaluasi bila menjadi masalah. Jalur amandemen yang berlaku tidak berubah: ARC dapat mengusulkan, Director yang memberlakukan.

### Keputusan terbuka

| # | Pertanyaan | Rekomendasi | Status |
|---|---|---|---|
| 2.1 | Apakah *Deferred* dan *Non-goal* dipisah menjadi kolom atau tabel berbeda? | Pisahkan lewat guidance dahulu; ubah struktur tabel hanya bila guidance terbukti tidak cukup. | **DISETUJUI 15 Oktober 2026** (lihat "Keputusan atas masukan ChatGPT tentang template"): tidak ada kategori *deferred* di INTENT. Ditunda dalam mandat = penahapan (T1; stage di Planned Stage atau PLAN); di luar mandat = Out of Scope dengan catatan kandidat INTENT berikutnya. In Scope menjadi batas mandat. Redaksi akhir kolom belum |
| 2.2 | Bentuk Functional Requirements di template (mengikuti 1.5). | Dibatasi pada kapabilitas inti; user story dan AC rinci dipindah ke kontrak PLAN. | **DISETUJUI** (sama dengan 1.5) |
| 2.3 | Bagaimana Constraints dibedakan antara batas strategis dan pilihan teknis? | Constraint hanya yang lolos uji ketahanan; pilihan teknis lain menjadi ruang keputusan PLAN. | **DISETUJUI 15 Oktober 2026 (redaksi)**: subjudul menjadi "Constraints"; kriteria masuk = "apakah batas ini tetap berlaku bila metode berubah?"; tipe `Technical` dipersempit menjadi persyaratan teknis eksternal; alasan perlindungan di tingkat INTENT ditulis pada kolom `Notes` (panduan, tidak divalidasi); tipe lain dan binding level **tidak** diubah; `DEV Must Not` dipertahankan (penjaga BUILD, bukan baris PRODUCT REVIEW). Teks subjudul dan nilai `Type` tidak dibaca kode (hanya prefiks `CON-nnn`) |
| 2.4 | Batas jumlah kriteria sukses (karena biaya CLOSE linear terhadap jumlahnya; lihat Seksi 5). | Batas wajar dengan peringatan advisory, bukan blokir. | **DISETUJUI 15 Oktober 2026 (D3)**: tanpa batas angka dan tanpa kode; hanya panduan. Pengaman: satu REQ = satu verdict; indikator "amandemen jarang". Peringatan advisory dapat ditambahkan kemudian bila INTENT bergaya backlog muncul di praktik |
| 2.5 | Apakah perombakan memerlukan schema 6, atau cukup revisi isi schema 5? | Putuskan setelah inventarisasi dampak pada clone, validator, dan fixture. | **DISETUJUI 15 Oktober 2026: schema 6** (Director: lebih aman; kriteria = tingkat perbedaan template, bukan kepraktisan). Kerangka mesin tidak berubah, makna berubah pada empat section (Desired Outcome, Scope, Constraints, Core Requirements); nomor schema berfungsi sebagai pembeda generasi dokumen. Dampak [Verifikasi]: `cloneDraftService.ts:41-46` (sumber schema 5 ke template 6) dan tes terkait; `ARC-RULE.md:820` ("only INTENT schema 5 ... support cloning"); fixture dan tes yang memuat `schema=5`; `resolveDocSpec` tidak berubah (`>= 5`). Mekanisme "RATIFIED schema migration" menyangkut `schema_version` file chain, bukan nomor schema dokumen, sehingga tidak terpengaruh. Temuan awal di blok "Keputusan atas masukan ChatGPT tentang template". Preseden repo [Verifikasi]: schema dinaikkan saat bagian ditambahkan (commit `5038679`, Quality Bar; EXEC schema 4 menambah section Changelog wajib); satu section dihapus dari INTENT schema 5 tanpa kenaikan (commit `c16095f`, 2026-10-07, `GUIDANCE_FOR_FMN`). Konvensi belum konsisten. Pertanyaan Director: seberapa berbeda template baru, bukan soal praktis |
| 2.6 | Kolom *Measurement Method* vs "metode ARC bebas". | INTENT menyatakan standar dan kelas bukti yang diterima, bukan prosedur uji. | **LABEL DISETUJUI 15 Oktober 2026**: *Measurement Method* diganti **Evidence Required** (label yang sama dengan kolom Quality Standards; jenis bukti pada produk akhir, bukan prosedur uji; bukti yang tidak dapat diperoleh dicatat *Not verified*; metode dipilih ARC). **DISETUJUI 15 Oktober 2026 (konfirmasi):** judul H2 "Desired Outcome and Acceptance" (ID marker `DESIRED_OUTCOME_AND_MEASUREMENT` tetap) dan draf blok: Desired Outcome, Success Threshold ("a standard, not a result"), Evidence Required. Dampak: hanya teks template, `ARC-RULE.md:42, :229`, `AUD-RULE.md:466, :482`; kode hanya membaca ID marker |
| 2.9 | (baru) Satu kewajiban yang dapat dinilai didefinisikan sekali; section lain merujuk, tidak menyalin, agar PRODUCT REVIEW tidak menilai kriteria yang sama berkali-kali. | Prinsip disetujui; mekanisme dirumuskan bersama 2.4 dan Seksi 4a. | **DISETUJUI 15 Oktober 2026 (D1, D2)**: (D1) satu kewajiban didefinisikan sekali di rumahnya (keberhasilan objektif = Success Threshold; kapabilitas atau kualitas hasil = `REQ-nnn`; standar mutu = baris Quality Standards, dirujuk lewat nama dimensi; kondisi gagal yang belum tercakup = Project Failure); bagian lain merujuk, tidak menyalin; tanpa format ID baru; rujukan pada Project Failure tidak menambah baris. (D2) Panduan pengisi INTENT menyatakan empat bagian yang menjadi sumber baris PRODUCT REVIEW (Desired Outcome and Acceptance: 1; Core Requirements: 1 per REQ; Quality Standards: 1 per dimensi bukan N/A; Project Failure: 1 bila memuat kondisi yang belum tercakup). Scope, Constraints, Assumptions, Risks, Research bukan sumber baris. Penurunan mekanis dan format baris menunggu tahap detail sistem closure |
| 2.10 | (baru) Quality Standards mengizinkan dimensi khusus domain (mis. validitas metodologis untuk produk akademik); dimensi tidak relevan N/A dengan alasan. | Hanya panduan; validator tidak berubah. | **DISETUJUI 15 Oktober 2026** |
| 2.7 | Uji independensi INTENT baru (kapan, dan peran ARC saat Director menyatakan tujuan atau perubahan). | Tiga pemeriksaan (dapat ditutup tanpa INTENT lain? hanya tahap dari objektif yang sudah ada? lanjutan setelah CLOSE?) sebagai panduan ARC, sebelum draf INTENT baru dibuat. | **ARAH DISETUJUI dan DIKLARIFIKASI 15 Oktober 2026 (pernyataan Director)**: ARC tidak merekomendasikan apa pun; ia hanya memberi path. INTENT baru **bukan** opsi path (untuk saat ini), kecuali bila itu INTENT pertama proyek (belum ada INTENT sama sekali). Path saat aktivasi: (1) diskusi biasa; (2) diskusi mengarah ke pengecekan INTENT saat ini dan tindakan amandemen atau tidak, dengan dua hasil: terakomodir tanpa amandemen, atau diamandemen; (3) evaluasi produk akhir. Rekomendasi ARC boleh diberikan hanya bila Director menanyakannya. Redaksi akhir belum. Irisan [Verifikasi]: `ARC-RULE.md` §Role Activation (pertanyaan dua opsi "open a new INTENT, or evaluate"), `:523` (divergence warning), `:443-446` (jalur keluar Petition; ditunda ke Seksi 3 dan 7), skill ARC pada `setup/targets/*` (langkah 2 aktivasi). Butir yang menunggu: lihat pertanyaan terbuka pada sesi 15 Oktober 2026 (jalur bila penilaian ARC "tidak terakomodir dan tidak dapat diamandemen"; pemeriksaan keberadaan INTENT saat aktivasi; cakupan aturan "rekomendasi hanya bila ditanya") |
| 2.8 | Amandemen merekam bagian INTENT yang disentuh. | Tanpa field baru; dihitung dari diff Git. | **DISETUJUI 15 Oktober 2026** |

**Keluaran seksi:** daftar perubahan template yang disetujui, keputusan schema, dan daftar dampak kode yang perlu mengikuti.

### Serah-terima ke sesi baru (15 Oktober 2026)

Seksi 2 dilanjutkan di sesi percakapan baru karena bahasannya teknis tentang template. Belum ada perubahan pada template, rule, kode, atau state proyek apa pun.

**Sudah diputuskan dan berdampak pada template:**

- Definisi INTENT dan jalur T1/T2/T3, indikator kualitas "amandemen jarang", dan butir 1.6 (Seksi 1).
- INTENT berisi standar; hasil ukur ditulis di PRODUCT REVIEW, bukan di INTENT atau CLOSE. Kriteria INTENT adalah untuk PRODUCT REVIEW (Seksi 4a).
- Standar mutu yang berpotensi usang: tidak diatur khusus; dibiarkan mengalir, dievaluasi bila menjadi masalah.
- Template dan rule ditulis dalam bahasa Inggris; prosa diskusi diterjemahkan, tidak disalin.

**Butir yang sedang menunggu keputusan Director (butir pertama sesi baru):**

- **[DISETUJUI Director, 15 Oktober 2026; format akhir pada blok "Keputusan atas masukan ChatGPT tentang template".] 1.5 Peran Functional Requirements.** Usulan Opsi B: dipertahankan di INTENT sebatas kapabilitas inti pada tingkat outcome, dengan AC yang dapat diverifikasi pada produk akhir; Priority dan user story dihapus; section dan ID `REQ-nnn` tetap; test contract rinci menjadi urusan PLAN. Alasan: tiap REQ menjadi satu baris PRODUCT REVIEW; ID dipakai gate PLAN (`docCheck.ts:715-717`); validator ratify schema 5 tidak memeriksa FR (`docCheck.ts:614-665`).

**Antrean butir Seksi 2 (belum dibahas):**

- 1.3 Kriteria masuk butir ke INTENT: perumusan final tiga uji (falsifiability, ketahanan, produk akhir) di panduan template/rule.
- 2.1 Pemisahan Deferred dan Non-goal di Out of Scope (rekomendasi: lewat guidance dahulu).
- 2.3 Pembedaan constraint strategis dan pilihan teknis.
- 2.4 Batas jumlah kriteria sukses (advisory, bukan blokir), karena biaya review linear terhadap jumlah butir.
- 2.5 Apakah perombakan memerlukan schema 6 (dampak pada `cloneDraftService`, validator, fixture `test/fixtures/DIR-INTENT-TEMPLATE-schema4.md`).
- 2.6 (baru) Kolom *Measurement Method* di INTENT bertabrakan dengan keputusan "metode ARC dibebaskan". Usulan: INTENT menyatakan standar dan kelas bukti yang diterima, bukan prosedur uji. Belum dibahas.
- 2.7 (baru) Uji independensi INTENT baru ("dapatkah ia ditutup dan dinilai tanpa INTENT lain?", "apakah ia hanya tahap atau paket kerja dari objektif yang sudah punya INTENT?") sebagai panduan ARC.
- 2.8 (baru) Apakah amandemen perlu merekam bagian INTENT yang disentuh (untuk indikator kualitas). Belum diverifikasi apakah AMD-NNN sudah merekamnya.

**Masukan eksternal (ChatGPT, 15 Oktober 2026):** lihat bagian "Masukan eksternal" di akhir dokumen. Butir M2, M3, dan M8 relevan langsung ke Seksi 2 dan butir 1.5; belum diputuskan Director.

**Yang belum dibaca:** skill ARC, `Sigma/role-memory/arc-memory.json`, rule FMN/AUD/DEV (Seksi 3).

**Berkas acuan:** `Sigma/templates/DIR-INTENT-TEMPLATE.md` (schema 5), `Sigma/rules/ARC-RULE.md` §INTENT Filling Guidance, `src/utils/docCheck.ts`.

### Keputusan atas masukan ChatGPT tentang template (15 Oktober 2026)

**Dasar keputusan [Director]:** Director mengikuti rekomendasi yang disepakati asisten dan ChatGPT; untuk butir teknis, termasuk yang memerlukan verifikasi lanjutan atau yang tidak disetujui asisten, Director mengikuti rekomendasi asisten. Tidak ada perubahan template, rule, atau kode; ini keputusan diskusi.

| Poin masukan ChatGPT | Keputusan | Butir |
|---|---|---|
| Struktur schema 5 dipertahankan; yang diubah adalah pembagian tanggung jawab | Diterima | umum |
| REQ = kapabilitas atau kualitas inti; Priority dan User Story dihapus; ID tetap | **Diterima** (Opsi B), format akhir di bawah | 1.5 (= M8) |
| Scope: `Must Deliver` menjadi batas mandat; *deferred* keluar dari INTENT | Arah diterima; menunggu verifikasi ROADMAP | 2.1 |
| Constraints: kriteria masuk berbasis uji ketahanan | Kriteria diterima | 2.3 |
| Penyederhanaan binding level menjadi dua kelompok | **Ditolak** | 2.3 |
| `Measurement Method` menjadi dasar bukti yang diterima | Arah diterima | 2.6 |
| Dimensi mutu khusus domain | Diterima | 2.10 |
| Kriteria yang sama tidak dihitung berkali-kali | Prinsip diterima, isu baru | 2.9 |
| Batas lima kalimat Director Summary diubah | **Tidak diubah**; hanya satu baris panduan bahwa contoh batas bersifat ilustrasi batas mandat, bukan daftar fitur | — |
| Urutan section baru (Core Requirements naik ke posisi 5) | **Ditolak**: urutan ditegakkan sebagai *error*, tanpa manfaat substantif | — |
| Naik ke schema 6 | **Belum diputuskan**; diputuskan di 2.5 setelah inventarisasi | 2.5 |
| Uji penerimaan: FMN dapat membuat beberapa PLAN berbeda untuk tujuan yang sama tanpa mengubah INTENT; ARC membedakan T1 dari T2 tanpa banyak pertanyaan persetujuan baru | Diterima sebagai uji template baru (Kasus A dan B bersumber dari diskusi Director–ChatGPT; tidak diverifikasi asisten) | penutup Seksi 2 |

**Format REQ akhir (DISETUJUI; tentatif secara redaksi, diterjemahkan ke template berbahasa Inggris):**

```markdown
## Core Requirements   <!-- marker ID FUNCTIONAL_REQUIREMENTS tidak berubah -->

> Core capabilities and result qualities the final product must have, stated at
> outcome level. Each REQ is one obligation, defined once here; other sections
> refer to it by ID. Features, technology, and technical tests belong to PLAN.

### REQ-001 - [Short name]

**Required Capability**: [What the product must enable, or what quality the result must have.]

**Acceptance Standard**:

- [Condition verifiable on the final product, without prescribing the check method.]
```

- Priority dan User Story dihapus; acceptance standard berupa butir biasa, **bukan** checkbox, karena INTENT mencatat standar dan hasil dicatat di PRODUCT REVIEW (Seksi 4a).
- Judul section menjadi *Core Requirements*; ID marker `FUNCTIONAL_REQUIREMENTS` dan format heading `### REQ-nnn` dipertahankan (dipakai `sourceReviewService.ts:57-78` dan gate PLAN `docCheck.ts:715-717`).
- Panduan ARC: tiga contoh M8 (keputusan solusi, kapabilitas, kualitas hasil) sebagai pembeda.

**Temuan verifikasi kode (dasar bagi 2.5):**

- Kontrak yang dibaca mesin pada INTENT schema 5: ID marker section, urutan section (pelanggaran = *error*, `docCheck.ts:1006-1020`), regex subjudul `### Summary`, `### Included Scenarios`, `### Excluded Scenarios`, dan empat nama dimensi mutu.
- Tidak menyentuh validator: mengganti teks judul section lain, menghapus Priority dan User Story, mengubah kolom tabel, menambah dimensi mutu (baris dengan nama lain diabaikan, `docCheck.ts:654`), dan menulis "N/A" (hanya teks berbentuk `[...]` dianggap placeholder, `docCheck.ts:494-497`).
- Memerlukan perubahan validator atau schema baru: mengubah urutan atau ID marker, atau mengubah subjudul Summary.
- Jumlah contoh batas 3 dan 3 hanya peringatan advisory; yang wajib hanya lebih dari nol (`docCheck.ts:636-651`). Batas lima kalimat tidak ditegakkan kode.
- `resolveDocSpec` memakai `version >= 5` untuk spec INTENT v5 (`docCheck.ts:414-423`): dokumen schema 6 tanpa spec baru akan diperlakukan sebagai v5.
- Belum diinventarisasi: versi aset host (F09 version stamping) dan redistribusi ke tiga proyek nyata; teks judul section sebagai konsumen kode (grep awal tidak menemukan).

**Verifikasi ROADMAP untuk 2.1 [Verifikasi, 15 Oktober 2026]:**

- ROADMAP adalah dokumen milik FMN, bersifat *living*, FMN boleh mengeditnya bebas, dan tidak diratifikasi Director (`FMN-RULE.md:286-307`; `SIGMA_PROTOCOL.md` §5.2). Bila ROADMAP bertentangan dengan INTENT, INTENT yang berlaku.
- Strukturnya hanya Overview, Core Process Flow, Planned Stage (Stage/Title/Focus), dan Stage Overview (dihasilkan CLI). Tidak ada tempat khusus untuk butir yang ditunda.
- Implikasi: memindahkan *deferred* ke ROADMAP berarti butir itu keluar dari kendali Director yang tertulis, kecuali FMN mentranskripsikannya sebagai stage. Pengendali yang tersisa adalah persetujuan Director atas PLAN.
- Usulan asisten (menunggu keputusan): tidak ada kategori ketiga. Butir ditunda **dalam** mandat = urusan penahapan (T1), dicatat FMN sebagai stage di Planned Stage atau di PLAN. Butir yang berada **di luar** mandat ini = Out of Scope, dengan catatan bila menjadi kandidat INTENT berikutnya (selaras dengan keputusan 1.6).

**DISETUJUI Director, 15 Oktober 2026 (konfirmasi atas usulan asisten):**

- **2.1:** tidak ada kategori *deferred* di INTENT (lihat tabel 2.1).
- **M3:** bukti proses boleh dipakai sebagai bukti atas klaim hasil. Kepatuhan terhadap cara kerja tidak menjadi baris PRODUCT REVIEW, tetapi constraint berbasis cara kerja tetap boleh ada di INTENT (pengawalnya FMN dan AUD selama BUILD), kecuali pelanggarannya berdampak pada hasil.
- **M9 dan 1.3:** tiga uji isi INTENT disatukan menjadi satu pertanyaan utama: "apakah butir ini menggambarkan hasil atau kualitas yang ingin dipertahankan, bukan cara sementara?" Falsifiability dan "dapat dinilai pada produk akhir" menjadi dua pemeriksaan pelengkap. Butir 1.3 selesai.
- **2.8:** tidak ada field baru pada AMD-NNN; indikator amandemen dihitung dari diff Git antara commit baseline dan hasil, dipetakan ke section lewat marker. [Inferensi; belum diuji dengan kode.]

### Batas cakupan implementasi (pernyataan Director, 15 Oktober 2026)

**[Director]** Implementasi dibatasi pada tiga area: ARC, CLOSE, dan INTENT, beserta sistem Sigma yang menyentuh atau beririsan dengan ketiganya. Perubahan di luar itu dihindari selama masih dalam fokus dan dampaknya tidak serius.

**Inventarisasi irisan terhadap keputusan Seksi 1–2 dan prinsip Seksi 4a [Verifikasi berbasis grep atas `Sigma/`, `setup/`, `src/`; belum dibaca penuh]:**

| Artefak | Ada irisan? | Rincian | Bila tidak diubah |
|---|---|---|---|
| `DIR-INTENT-TEMPLATE.md`, `ARC-RULE.md`, `arc-memory.json` | Di dalam area | Perubahan inti | — |
| `DIR-CLOSE-TEMPLATE.md`, kode skor/CLOSE (`intentScoreService`, `closeNewService`, `intent.ts`, `chain.ts`, `intentHistory.ts`, tool MCP `prepare/commitIntentScore`) | Di dalam area | Seksi 4–7 | — |
| `SIGMA_PROTOCOL.md` (§Gate 3.5, deskripsi CLOSE), `SIGMA-OPERATION-REGISTRY.json` | Beririsan, sistem | Bagian INTENT/CLOSE/skor saja | — |
| `AUD-RULE.md:466, :482` (INTENT Review Focus menyebut "measurement method") | Di luar area, wording | Istilah berubah di INTENT | Rendah: konsep tetap berlaku, hanya label field yang berganti |
| `AUD-RULE.md:626-656` (CLOSE Audit Focus: skor, Petition, deferred) | Beririsan dengan CLOSE | Ikut Seksi 4–7 | — |
| `AUD-RULE.md:770` (format final product / closure review) | Tidak perlu diubah | Format audit produk akhir sudah ada; target audit = produk akhir sudah tercakup definisi Audit Target | — |
| `FMN-RULE.md:418, :640` (sengketa "ARC Satisfaction Score" lewat Petition) | Di luar area, 2 kalimat | Hanya bila Seksi 7 mengubah otoritas skor | Rendah; diputuskan di Seksi 7 |
| Template PLAN dan EXEC, `DEV-RULE.md`, kode plan/exec, skill di `setup/` | **Tidak ada** | ID `REQ-nnn` dan format heading dipertahankan; Priority/User Story tidak dibaca kode; skill tidak menyebut istilah terkait | — |

**Penahan di luar cakupan [belum diverifikasi]:** perubahan aset host (template dan rule) kemungkinan memerlukan kenaikan versi dan redistribusi lewat mekanisme F09; itu prosedur distribusi, bukan perubahan isi peran lain. Dicek saat 2.5.

**Aturan (DISETUJUI Director, 15 Oktober 2026):** perubahan di luar daftar "di dalam area" dan "beririsan" tidak dilakukan tanpa disampaikan dahulu ke Director beserta alasan dan dampak bila ditunda.

**`AUD-RULE.md` dan `FMN-RULE.md` (DIIZINKAN Director, 15 Oktober 2026):** Director mengizinkan kedua rule disentuh. Cakupan yang dipahami asisten [tentatif]: dua frasa `AUD-RULE.md:466, :482`, bagian CLOSE Audit Focus `AUD-RULE.md:626-656`, dan dua kalimat Petition `FMN-RULE.md:418, :640`, sebatas menyelaraskan istilah dengan keputusan INTENT/CLOSE. Urutan tidak berubah: tidak ada perubahan rule sebelum template final (Seksi 3). Perubahan pada PLAN, EXEC, `DEV-RULE.md`, dan kode plan/exec tetap berlaku aturan "sampaikan dahulu".

### Penutup Seksi 2: keluaran (15 Oktober 2026)

**Keputusan terakhir [Director, 15 Oktober 2026]** atas 2.7: (1a) bila penilaian ARC "tidak terakomodir dan tidak dapat diamandemen", ARC menyatakannya sebagai **temuan faktual**, bukan opsi path dan bukan rekomendasi; (2a) pada aktivasi ARC boleh memeriksa keberadaan dan status INTENT saja (`sigma intent status` atau `sigma_intent_status`), tanpa membaca isi; (3) aturan "rekomendasi hanya bila ditanya" **tidak diperluas**: `ARC-RULE.md:65` dan `:811` dibiarkan apa adanya. Kasus tepi yang diusulkan asisten [tentatif]: INTENT berstatus DRAFT = path 2 menjadi "melanjutkan penyusunan INTENT".

**A. Draf template.** `Discussion/DRAFT_DIR-INTENT-TEMPLATE-schema6_2026-10-15.md` (badan template teks akhir bahasa Inggris). [Verifikasi] Draf dan template schema 5 saat ini dijalankan pada validator (`dist/utils/docCheck.js`, salinan scratch): keduanya tanpa *error*, dengan peringatan dan daftar requirement lock yang identik. Draf schema 6 divalidasi sebagai v5 (`>= 5`). `dist` berasal dari build yang ada; belum dibangun ulang.

**B. Keputusan schema.** Schema 6.

**C. Daftar perubahan template (ringkas).**

| Section (ID marker tetap) | Perubahan |
|---|---|
| Header | Penanda `schema=6`; kalimat definisi mandat (terjemahan definisi yang disetujui); blok "How to fill" (satu pertanyaan utama, empat bagian yang dinilai, definisi sekali) |
| Director Summary | Satu baris panduan: contoh batas = ilustrasi batas mandat |
| Purpose and Problem | Tidak berubah |
| Desired Outcome → "Desired Outcome and Acceptance" | `Measurement Method` menjadi `Evidence Required`; ambang = standar, bukan hasil |
| Scope | In Scope: kolom `Must Deliver` menjadi `Mandate Coverage` **[TENTATIF]**; Out of Scope: hanya di luar mandat, tanpa *deferred* |
| Quality Standards | Dimensi khusus domain diizinkan; N/A dengan alasan |
| Priorities and Constraints | Subjudul "Constraints"; kriteria masuk; `Technical` = persyaratan eksternal; `Notes` = alasan perlindungan |
| Assumptions and Risks | Hanya panduan Project Failure (tidak mengulang yang sudah tersirat) |
| Functional Requirements → "Core Requirements" | `Required Capability` dan `Acceptance Standard`; Priority, User Story, dan checkbox dihapus |
| Research, AUD Notes | Tidak berubah |

**D. Dampak kode dan tes (area INTENT, tanpa perubahan di PLAN/EXEC selain satu fixture).**

| Berkas | Perubahan |
|---|---|
| `src/services/cloneDraftService.ts:41-46` | Menerima sumber schema 5 atau 6 ke template schema 6; pesan galat disesuaikan |
| `src/utils/docCheck.ts` | Tidak ada perubahan fungsional (`resolveDocSpec`: `>= 5`); opsional komentar `:612` |
| `test/doc-check-intent-schema5.test.ts` | Dijalankan ulang terhadap template baru; tambah satu kasus dokumen schema 6 valid |
| `test/helpers.ts` | Fixture schema 5 dipertahankan (dokumen lama tetap valid); varian schema 6 bila diperlukan |
| `test/f08-workflows.test.ts:32-34` (area PLAN, fixture saja) | Dua string literal (`### REQ-001 - [Requirement Title]`, baris `**User Story**`) disesuaikan dengan blok REQ baru |
| `CHANGELOG.md` | Catatan: template INTENT schema 6, panduan direvisi; aset host terdeteksi lewat hash |

**E. Serah-terima ke Seksi 3 (rule, skill, memory; tidak diubah sebelum template final).**

| Berkas | Perubahan |
|---|---|
| `ARC-RULE.md` §INTENT Filling Guidance | Disesuaikan penuh dengan template baru |
| `ARC-RULE.md:42`, `:229` | "measurement method" menjadi "evidence required" |
| `ARC-RULE.md` §Role Activation | Tiga path (diskusi biasa; pengecekan INTENT dan amandemen atau tidak; evaluasi produk akhir); pengecualian INTENT pertama; pemeriksaan status INTENT saat aktivasi |
| `ARC-RULE.md` §Amendment Request | Klasifikasi T1/T2/T3; divergence warning (`:523`) dikerucutkan menjadi lanjutkan amandemen atau biarkan; temuan faktual bila di luar jangkauan amandemen; pemeriksaan independensi hanya bila Director memutuskan INTENT baru |
| `ARC-RULE.md:820` | Kloning schema 5 dan 6 |
| `ARC-RULE.md:443-446` | Jalur keluar Petition: ditunda ke Seksi 7 |
| Skill ARC (lima target di `setup/targets/*`) | Langkah 2 aktivasi mengikuti §Role Activation |
| `arc-memory.json` | Disinkronkan; belum dibaca |
| `SIGMA_PROTOCOL.md` §5.1 | Kalimat definisi INTENT disesuaikan dengan definisi mandat |
| `README.md:741` | Kloning schema 5 ke 6 |
| `AUD-RULE.md:466, :482`; `FMN-RULE.md:418, :640` | Diizinkan Director; sebatas selaras istilah (FMN hanya bila Seksi 7 mengubah otoritas skor) |

**F. Tiga butir tentatif: DISETUJUI Director, 15 Oktober 2026 (sesuai rekomendasi asisten):** nama kolom `Mandate Coverage`; redaksi blok "How to fill" dan kalimat definisi pada header; kasus tepi INTENT DRAFT pada path 2 ("melanjutkan penyusunan INTENT").

**H. IMPLEMENTASI TAHAP 1 SELESAI (15 Oktober 2026), menunggu review Director.** Dikerjakan atas persetujuan Director (rencana butir 1–9 dan konsekuensi a–d). Draf `DRAFT_DIR-INTENT-TEMPLATE-schema6_2026-10-15.md` kini digantikan oleh `Sigma/templates/DIR-INTENT-TEMPLATE.md` (schema 6).

| Berkas | Perubahan |
|---|---|
| `Sigma/templates/DIR-INTENT-TEMPLATE.md` | Schema 6, badan template dari draf (tanpa banner dan penanda tentatif) |
| `Sigma/rules/ARC-RULE.md` | §Role Activation (tiga path, INTENT pertama, kasus DRAFT, pemeriksaan status); §INTENT Filling Guidance; §INTENT Change Classification (baru, di bawah §Amendment Request); divergence warning; `:42`, tier output skor (istilah saja), paragraf kloning; baris `sigma intent status` pada tabel CLI |
| `Sigma/role-memory/arc-memory.json` | Entri aktivasi, penilaian akomodasi, pengisian INTENT, kloning; `source_rule_version` diperbarui ke hash ARC-RULE baru |
| Skill ARC (`claude_code`, `opencode`, `reasonix`, `antigravity`, `codex`) | Langkah aktivasi 2–4 dan paragraf kloning |
| `Sigma/SIGMA_PROTOCOL.md` §5.1 | Kalimat definisi INTENT = mandat strategis |
| `setup/targets/bridge/{CLAUDE,AGENTS,GEMINI}.md` | Teks aktivasi ARC |
| `src/services/cloneDraftService.ts` (+ `dist/`) | Kloning INTENT schema 5 atau 6 ke template schema 6 |
| `test/role-memory-bootstrap.test.ts`, `test/f08-workflows.test.ts`, `test/doc-check-intent-schema5.test.ts` | Penyesuaian frasa dan literal; dua tes baru (schema 6 valid; kloning 5→6 dan schema 4 tetap ditolak) |

**Verifikasi:** `npm run build` bersih; `vitest run`: 83 berkas, 1311 tes lulus (1309 awal + 2 baru). Tidak ada commit.

**Belum disentuh (masuk berkas diskusi baru):** `AUD-RULE.md`, `FMN-RULE.md`, `README.md:741` (kloning "schema 5 to 5"), `DIR-CLOSE-TEMPLATE.md`, gate dan skor di protokol dan ARC-RULE (§Closure Evaluation, Score Methodology, Petition), `SIGMA-OPERATION-REGISTRY.json`, `CHANGELOG.md`, redistribusi aset host (`sigma setup update`, `project sync`).

**Penerimaan Director (15 Oktober 2026):** implementasi tahap 1 disetujui dan diterima, dengan catatan bahwa perubahan sistem skoring, PRODUCT REVIEW, dan closure belum dilakukan dan belum didiskusikan detail. Pembahasan lanjutan: `DISKUSI_SIGMA_CLOSURE_PRODUCT_REVIEW_SKORING_2026-10-15.md`.

**G. Batas implementasi tahap ini [Director, 15 Oktober 2026]:** untuk saat ini hanya menyentuh **ARC-RULE, memory ARC, skill ARC, template INTENT, dan penegasan definisi INTENT di `SIGMA_PROTOCOL.md`**. Sisanya (Seksi 4–7 dan butir serah-terima E di luar daftar itu) disusun pada berkas diskusi md baru. Konsekuensi yang beririsan dengan daftar ini dan memerlukan persetujuan tersendiri dicatat pada sesi yang sama (tes `role-memory-bootstrap`, fixture `f08-workflows`, kode `intent clone`, dan teks aktivasi ARC pada berkas bridge).

---

## Seksi 3 — Recheck dan sinkronisasi ARC-RULE, skill, dan memory ARC

**Tujuan:** memastikan seluruh instruksi yang dibaca ARC konsisten satu sama lain dan dengan template baru. Dikerjakan terakhir.

### Cakupan yang perlu diperiksa

| Artefak | Status pembacaan |
|---|---|
| `Sigma/rules/ARC-RULE.md` | Sudah dibaca (Filling Guidance, Behavioral Standards #3 dan #4, ARC-specific stance, Closure Evaluation, Score Methodology, §2 otoritas CLOSE, Trigger 2) |
| Skill `arc` | **Belum dibaca** |
| `Sigma/role-memory/arc-memory.json` | **Belum dibaca** |
| `Sigma/rules/FMN-RULE.md`, `AUD-RULE.md`, rule DEV | Belum dibaca; FMN-RULE merujuk skoring |
| `Sigma/SIGMA_PROTOCOL.md`, `README.md` | Sebagian dibaca |
| `Sigma/SIGMA-OPERATION-REGISTRY.json` | Merujuk skoring; belum dibaca |
| `Implementation/sigmav2_implementation/E01_lampiran_keterlacakan-arc-rule.md` | Belum dibaca; kemungkinan perlu diperbarui |
| Artefak PRODUCT REVIEW (template baru), `AUD-RULE.md` (target audit produk akhir, format per butir), `SIGMA_PROTOCOL.md` (artefak baru, §11 AUD), registry, `ARC-RULE.md` (kepemilikan artefak) | Belum ada; dibuat atau diubah setelah tahap detail sistem closure |

### Drift yang sudah teridentifikasi

- **[Verifikasi]** `ARC-RULE.md:566` dan `:782` menyebut Petition/Admission Review "not yet executed" dan merujuk `PLAN-EVAL-04`, padahal §Petition / Admission Review sudah mendefinisikannya penuh.
- **[Verifikasi]** Template CLOSE masih schema 2 dengan unsur INTENT versi lama; F00 mencatat "review isi template CLOSE" sebagai tindak lanjut terbuka.

### Aturan

- Dokumen Sigma ditulis dalam bahasa Inggris. Prosa Indonesia dari dokumen diskusi ini diterjemahkan, tidak disalin.
- Tidak ada perubahan rule sebelum template yang menjadi acuannya final.

### Keputusan terbuka

| # | Pertanyaan | Rekomendasi | Status |
|---|---|---|---|
| 3.1 | Apakah skill dan memory ARC boleh dibaca sekarang sebagai persiapan, tanpa mengubahnya? | Ya, baca-saja, agar daftar sinkronisasi lengkap sebelum Seksi 2 final. | TERBUKA |
| 3.2 | Apakah drift Petition (`:566`, `:782`) diperbaiki dalam sinkronisasi ini atau terpisah? | Dalam sinkronisasi ini, karena file yang sama disentuh. | TERBUKA |

**Keluaran seksi:** daftar lengkap artefak yang berubah beserta perubahannya, lalu eksekusi setelah persetujuan.

---

## Seksi 4 — Definisi dan makna CLOSE

**Tujuan:** menetapkan apa yang dimaksud CLOSE dan apa yang tidak.

### Bahan

- **[Director]** CLOSE hampir tidak pernah dilakukan karena biayanya tinggi bagi ARC. INTENT dan CLOSE dapat dihubungkan. ARC hanya peduli produk akhir jadi seperti apa dan sesuai tujuan atau tidak, bukan caranya.
- **[Verifikasi]** Protokol: satu CLOSE yang tidak ter-supersede per INTENT; revisi adalah versi baru. `close new` memerlukan INTENT RATIFIED, tidak ada DRAFT, setiap PLAN LOCKED berpasangan dengan satu EXEC LOCKED, dan skor ARC ≥ 50 (Gate 3.5).
- **[Verifikasi]** Template CLOSE saat ini menawarkan keputusan: `CLOSE_ACCEPTED`, `CLOSE_ACCEPTED_WITH_LIMITATIONS`, `DO_NOT_CLOSE`, `OPEN_NEW_PLAN`, `UPDATE_CURRENT_EXEC`, `OTHER`. Dua opsi terakhir (`OPEN_NEW_PLAN`, `UPDATE_CURRENT_EXEC`) bukan penutupan, melainkan pengarahan kembali ke BUILD.
- **[Verifikasi]** Rule: Director memiliki isi CLOSE; ARC hanya mengoperasikan CLI dan mengevaluasi.

### Definisi CLOSE (DISETUJUI Director, 15 Oktober 2026)

> **CLOSE adalah laporan penutup satu mandat.** Ia merangkum bentuk akhir produk, mirip README yang menjelaskan produk, dan memuat keputusan Director untuk menutup atau tidak menutup mandat tersebut. Ia merujuk PRODUCT REVIEW dan tidak memuat hasil pengujian. CLOSE menutup mandat; ia tidak menandai selesainya satu PLAN atau satu rilis.
>
> **Syarat pembuatan:** Gate 3 tetap berlaku (tidak ada PLAN atau EXEC yang belum LOCKED, setiap PLAN LOCKED berpasangan dengan satu EXEC LOCKED) dan PRODUCT REVIEW lengkap. Gate 3.5 (skor ARC) digantikan oleh PRODUCT REVIEW.

Riwayat: draf awal mendefinisikan CLOSE sebagai penilaian produk akhir terhadap INTENT. Penilaian itu dipindah ke artefak PRODUCT REVIEW (lihat Seksi 4a) karena CLOSE adalah laporan penutup, bukan laporan pengujian.

### Posisi Director (15 Oktober 2026; bahan historis, sebagian digantikan oleh Seksi 4a)

- **[Director]** CLOSE adalah dokumen penutup yang menjelaskan bentuk akhir hasil implementasi terhadap objektif yang didefinisikan di INTENT, beserta standar mutu atau standar penilaian yang diukur. Kriteria dan standar ukuran ditulis di INTENT untuk dipakai CLOSE, bukan dokumen lain; hasilnya ditulis di CLOSE. **[DIGANTIKAN: hasil ditulis di PRODUCT REVIEW, bukan CLOSE; lihat Seksi 4a.]**
- **[Director]** Evaluasi sebelum CLOSE adalah padanan skoring ARC. FMN menyerahkan hasil kerja akhir; penilai menilai secara independen dengan caranya sendiri selama standar yang diukur bersumber dari INTENT.
- **[Director]** Produk akhir ditinjau oleh **ARC dan AUD sebagai reviewer**, dengan perbedaan akses:
  - ARC memiliki kebebasan eksplorasi dan pengujian.
  - AUD terbatas pada referensi audit dan akses eksplisit yang diberikan Director. Contoh: AUD tidak memeriksa source code, tetapi dapat menjalankan Claude in Chrome untuk membuka dan menjelajahi aplikasi. INTENT menjadi referensi audit utama, ditambah referensi lain yang diperlukan.
- **[Verifikasi]** Pemetaan ke kosakata AUD-RULE: Audit Target = produk akhir, Director Reference = INTENT, Evidence Package = akses eksplisit yang diberikan Director. Akses eksplisit sesuai pengecualian isolasi AUD ("unless the Director explicitly provides or authorizes that exact scope").
- **[Director]** Metode ARC dibebaskan. ARC boleh menanyakan ke FMN dokumen-dokumen tertentu (a, b, c) sebagai referensi dasar penilaian standar produk akhir dan memastikan ketersediaannya, tanpa eksplorasi penuh. ARC juga boleh mengeksplorasi sendiri. Keduanya sah. ARC menentukan bagaimana standar kualitas dinilai.
- **[Director]** Keluhan sumber biaya adalah **kewajiban** ARC memeriksa setiap artefak PLAN/EXEC untuk skoring (mis. 40 file PLAN membuat ARC kelelahan), bukan eksplorasi berlebih. ARC kini dibebaskan demi menjawab standar kualitas: boleh membaca beberapa EXEC, memeriksa source code sendiri, atau cara apa pun. Sigma memiliki banyak jalur pemeriksaan (roadmap, check notes, dan lain-lain).
- **[Verifikasi]** Jalur komunikasi sudah tersedia: `sigma send` ke FMN dengan `--related-artifact INTENT-vN`; ARC boleh mengirim pesan ke role mana pun atas kebijaksanaannya (ARC-RULE §General Message Policy). Tipe `QUESTION` + aksi `RESPOND` konsisten dengan alasan yang dipakai Petition ("asking ARC to decide something").

### Keputusan terbuka

| # | Pertanyaan | Rekomendasi | Status |
|---|---|---|---|
| 4.1 | Apakah CLOSE hanya menutup mandat (satu INTENT), dan tidak menandai selesainya PLAN atau rilis? | Ya. Selesai PLAN dicatat oleh LOCK EXEC; rilis bukan peristiwa CLOSE kecuali rilis itu memang penutup mandat. | **SELESAI** (tercakup definisi yang disetujui) |
| 4.2 | Apakah `OPEN_NEW_PLAN` dan `UPDATE_CURRENT_EXEC` tetap menjadi opsi keputusan CLOSE? | Dikeluarkan dari keputusan penutupan. Keduanya adalah hasil "tidak ditutup"; cukup dinyatakan sebagai `DO_NOT_CLOSE` dengan alasan. | TERBUKA |
| 4.3 | Siapa memegang penilaian dan siapa memutuskan? (otoritas penulisan isi CLOSE; lihat 5.4) | Dua reviewer (ARC dan AUD) menilai; Director memutuskan. Perbedaan akses seperti di atas. Memerlukan perubahan otoritas di ARC-RULE §2 dan format keluaran per butir di AUD-RULE. | **SELESAI**: penilaian oleh ARC dan AUD dalam PRODUCT REVIEW; Director memutuskan di CLOSE |

**Keluaran seksi:** satu definisi CLOSE yang disetujui dan batas perannya.

---

## Seksi 4a — PRODUCT REVIEW (artefak baru)

**Asal:** muncul dari diskusi Seksi 4 dan 5. CLOSE adalah laporan penutup, sehingga hasil pengujian dan review memerlukan tempat sendiri. Gate 3.5 mensyaratkan skor sebelum CLOSE dapat dibuat, sehingga CLOSE tidak dapat menjadi wadah hasil review.

### Prinsip (DISETUJUI Director, 15 Oktober 2026)

1. Artefak Sigma yang mencatat peninjauan produk akhir terhadap standar INTENT. Satu per INTENT, versi mengikuti versi INTENT, tanpa mekanisme status.
2. Dibuat atas pernyataan eksplisit Director kepada ARC bahwa produk akhir sudah jadi, beserta bentuk dan lokasinya. ARC cukup mengetahui produk dapat diuji. Interaksi percakapan, tanpa mekanisme sistem rumit.
3. Bagian ARC: untuk tiap standar INTENT dicatat standar penilaian, metode yang dipilih, hasil, dan verdict. Bagian AUD: advisory dengan format yang sama seperti bagian AUD pada INTENT dan PLAN, dengan produk akhir sebagai target audit.
4. Hanya verdict yang berubah sebagai hasil akhir.
5. Temuan per putaran bersifat append-only, dan dokumen mencatat produk serta revisi INTENT yang dinilai.
6. Menggantikan skor ARC sebagai syarat pembuatan CLOSE. Gate 3 tetap berlaku.
7. Skoring (sementara): band turunan otomatis dari verdict PRODUCT REVIEW, bukan gate. Rincian saat sistem closure didetailkan.

### Gate pembuatan CLOSE (DISETUJUI Director)

`close new` memerlukan Gate 3 (tidak ada PLAN/EXEC yang tidak LOCKED) **dan** PRODUCT REVIEW lengkap.

**[Verifikasi]** Gate 3 di kode (`chain.ts`, `hasCleanGate3Chain`) memblokir bila ada PLAN `DRAFT` atau `APPROVED`, EXEC `DRAFT`, EXEC LOCKED tanpa PLAN LOCKED yang berpasangan, PLAN LOCKED tanpa tepat satu EXEC LOCKED, atau tidak ada PLAN LOCKED sama sekali. PLAN atau EXEC `SUPERSEDED` tidak memblokir, sehingga PLAN yang ditinggalkan lewat `plan supersede` tidak menahan CLOSE.

### Rincian untuk tahap detail sistem closure (belum diputuskan)

- Deteksi review basi: peringatan bila ada pasangan PLAN/EXEC yang LOCKED setelah review ditulis atau revisi INTENT berubah.
- Pengikatan hash PRODUCT REVIEW saat CLOSE dikunci.
- Set verdict: tabel per standar (*Satisfied / Partially / Not satisfied / Not verified*) dan verdict AUD yang sama dengan INTENT dan PLAN.
- Penamaan (`PRODUCT-REVIEW-vN.md`), registrasi untuk `--related-artifact`, dan cascade `intent supersede`.
- Perintah scaffold dan kelas otoritasnya.
- Penyimpanan bukti biner (tangkapan layar, rekaman penjelajahan AUD).
- Urutan penulisan agar review saling buta (ARC menyelesaikan bagiannya sebelum mentranskripsikan hasil AUD).
- Nasib Trigger 2 dan `intent-history` terhadap band turunan.
- Inventarisasi dampak kode dan tes.

---

## Seksi 5 — Sistem agar CLOSE murah dan tidak membebani ARC

**Tujuan:** merancang mekanisme sehingga CLOSE selesai dengan beban pemeriksaan kecil.

### Sumber biaya saat ini [Verifikasi]

| Penyebab | Lokasi |
|---|---|
| ARC wajib membaca INTENT, ROADMAP, setiap pasangan PLAN+EXEC, dan kode sumber; lingkup evaluasi adalah seluruh riwayat chain | `ARC-RULE.md:558`, `:564` |
| Tier proses (skor 50–100) menilai cara kerja terhadap constraint dan non-goals | `ARC-RULE.md:586` |
| `close new` diblokir bila skor < 50, tanpa bypass | `ARC-RULE.md:612` |
| ARC diharapkan menilai ulang dan mengirim pesan ke FMN setiap pasangan PLAN+EXEC baru LOCKED (Trigger 2; biaya berulang selama BUILD, bukan hanya saat CLOSE) | `ARC-RULE.md:745-749` |
| Template CLOSE 9 bagian dan 3 lampiran; hanya §3 dan §4 yang membandingkan produk dengan INTENT | `DIR-CLOSE-TEMPLATE.md` |

### Gagasan desain [Inferensi]

1. **Kewajiban hasil, bukan cakupan [Director; koreksi diagnosis]:** kewajiban ARC adalah menjawab setiap standar INTENT dengan verdict dan dasar bukti. Cakupan artefak dipilih ARC (EXEC terpilih, source code, roadmap, check notes, atau permintaan referensi ke FMN). Aturan lama yang mewajibkan pembacaan seluruh pasangan PLAN+EXEC dicabut. Verdict mencakup "Not verified" bila bukti tidak tersedia. Rekomendasi ringan: satu baris dasar verdict per butir, bukan daftar file.
2. **Turunan satu-ke-satu [diperbarui: baris penilaian berada di PRODUCT REVIEW, bukan CLOSE]:** baris penilaian diturunkan langsung dari butir INTENT (outcome, tiap kriteria sukses, tiap standar mutu, definisi gagal). Biaya CLOSE menjadi linear terhadap jumlah butir, sehingga INTENT dengan kriteria sedikit dan terukur menghasilkan CLOSE murah.
3. **Evaluasi hanya saat penutupan:** penilaian ARC dilakukan satu kali saat closure evaluation, tidak berulang pada setiap pasangan PLAN+EXEC.
4. **Otomasi opsional:** CLI membuat draf PRODUCT REVIEW yang sudah terisi butir INTENT. Menyentuh kode, sehingga ditunda.

### Keputusan terbuka

| # | Pertanyaan | Rekomendasi | Status |
|---|---|---|---|
| 5.1 | Makna "dihubungkan": (i) struktural, baris CLOSE diturunkan 1:1 dari butir INTENT; atau (ii) mekanis, CLI mengisi draf. | (i) terlebih dahulu; (ii) hanya bila (i) terbukti memangkas biaya. | **DIGANTIKAN** oleh Seksi 4a: baris penilaian berada di PRODUCT REVIEW, bukan CLOSE |
| 5.2 | Kewajiban ARC saat CLOSE (gagasan 1). | Kewajiban = menjawab setiap standar INTENT dengan verdict dan dasar bukti (termasuk "Not verified"); cakupan artefak dan metode dipilih ARC. Kewajiban memeriksa seluruh PLAN+EXEC dicabut. | **DISETUJUI Director** (pernyataan 15 Oktober 2026); rumusan rule menunggu Seksi 3 |
| 5.3 | Apakah penilaian ARC berulang per pasangan PLAN+EXEC (Trigger 2) dihapus? | Dihapus sebagai kewajiban; menjadi opsional atas permintaan Director atau FMN. Bergantung pada keputusan Seksi 7. | TERBUKA |
| 5.4 | Otoritas isi CLOSE (sama dengan 4.3). | Lihat 4.3. | **SELESAI** (sama dengan 4.3) |
| 5.5 | Tempat pencatatan hasil pengujian dan review, dan urutan gate. Masalah [Director, 15 Oktober 2026]: `close new` mensyaratkan skor ARC (Gate 3.5) lebih dulu, sehingga CLOSE belum ada ketika hasil review dihasilkan. [Verifikasi] skor hanya satu nilai dengan satu baris notes tanpa `\|` atau newline, ditimpa setiap kali dijalankan (`chain.ts:1376-1389`). | Opsi A (draf CLOSE sebagai wadah hasil review) **ditolak Director**: CLOSE adalah laporan penutup bergaya README yang merangkum bentuk akhir produk, bukan tempat hasil pengujian. **Usulan Director:** artefak Sigma baru **PRODUCT REVIEW** dengan bagian ARC (standar penilaian, metode, hasil, verdict) dan bagian AUD (format advisory seperti pada INTENT dan PLAN, target audit = produk akhir); menjadi syarat satu-satunya pembuatan CLOSE dan menggantikan Gate 3.5. | USULAN DIRECTOR (diperbarui 15 Oktober 2026): PRODUCT REVIEW **tanpa versi sendiri** (satu per INTENT, terikat versi INTENT) dan **tanpa mekanisme status**; hanya verdict yang berubah sebagai hasil akhir. **Otoritas pembuatan [Director]:** pembuatan PRODUCT REVIEW adalah otoritas eksplisit Director lewat pernyataan kepada ARC bahwa produk akhir sudah jadi dan di mana bentuknya; ARC cukup mengetahui produk dapat diuji. Interaksi percakapan, tanpa mekanisme sistem rumit. **PRINSIP DISETUJUI Director, 15 Oktober 2026** (lihat Seksi 4a); inventarisasi dampak menunggu tahap detail sistem closure |

**Keluaran seksi:** daftar mekanisme yang disetujui, batas baca ARC, dan perkiraan dampak kode (bila ada).

---

## Seksi 6 — Perombakan template CLOSE

**Tujuan:** menyelaraskan `DIR-CLOSE-TEMPLATE.md` dengan Seksi 4, 5, dan 7.

### Bahan [Verifikasi]

- Template CLOSE masih schema 2; INTENT sudah schema 5.
- Tabel §4 (Intent Satisfaction) memakai unsur INTENT lama: primary objective, desired outcome, success criteria, scope boundary, trade-off, primary failure concern. **Standar mutu (Quality Standards) tidak dinilai**, padahal menjadi inti contoh INTENT menurut Director. **[Diperbarui: penilaian per butir kini berada di PRODUCT REVIEW; di CLOSE bagian ini menjadi rujukan ke verdict, bukan tabel penilaian.]**
- §2 (cerita evolusi), §5 (evidence map), dan §6 (deviasi dari PLAN, jalur superseded) bersifat riwayat. §7 (handoff operasional) dan §8 (batas intent baru) bernilai bagi pembaca tetapi bukan bagian penilaian penutupan.

### Keputusan terbuka

| # | Pertanyaan | Rekomendasi | Status |
|---|---|---|---|
| 6.1 | Bagian mana yang wajib dan mana yang opsional? | Wajib: ringkasan bentuk akhir produk, rujukan ke PRODUCT REVIEW, keputusan Director, keterbatasan yang diterima. Lainnya opsional. Penilaian per butir tidak berada di CLOSE. [Diperbarui 15 Oktober 2026 mengikuti Seksi 4a.] | TERBUKA |
| 6.2 | Apakah handoff operasional dipertahankan di CLOSE atau dipindah ke dokumen lain? | Dipertahankan sebagai bagian opsional; ia bukan penilaian penutupan tetapi bernilai bagi pemilik berikutnya. | TERBUKA |
| 6.3 | Apakah perombakan memerlukan kenaikan schema CLOSE, dan apa dampaknya ke validator `close check`? | Putuskan setelah inventarisasi dampak, sama seperti 2.5. | TERBUKA |

**Keluaran seksi:** template CLOSE baru yang disetujui.

---

## Seksi 7 — Skoring ARC: dihapus atau direkonstruksi

**Tujuan:** memutuskan nasib sistem skor ARC (`sigma intent score`, Gate 3.5).

### Mekanisme saat ini [Verifikasi]

- Skala tier: 0–50 output (harus penuh untuk melewati 50), 50–100 proses (hanya dinilai bila output penuh).
- Band: `OUTPUT_INCOMPLETE` (< 50), `SATISFIED_NEEDS_REVIEW` (50–79), `SATISFIED_RECOMMENDED` (≥ 80).
- Gate 3.5: skor ≥ 50 diperlukan untuk `close new`; tidak ada override. Skor bukan gate untuk `close lock`.
- Aturan retrospektif-saja (ARC tidak boleh memberi daftar untuk mencapai skor lebih tinggi) sebagai mitigasi Goodhart.
- Pencatatan memerlukan frasa otorisasi khusus ("catat skor", "masukkan skor", dst.).
- Trigger 2: pesan ke FMN setiap pasangan PLAN+EXEC baru LOCKED.
- Artefak pendukung: render `Sigma/design/intent-history.md`, field di `progress-v<N>.json`.

### Cakupan kode yang terkait [Verifikasi, hitungan awal]

- **13 file di `src/`:** `commands/intent.ts`, `commands/close.ts`, `engine/chain.ts`, `engine/reconstruct.ts`, `utils/docCheck.ts`, `utils/intentHistory.ts`, `services/intentScoreService.ts`, `services/closeNewService.ts`, `mcp/policy.ts`, `mcp/control/index.ts`, `mcp/control/tools/prepareIntentScore.ts`, `mcp/control/tools/commitIntentScore.ts`, `mcp/control/tools/preparePlanLock.ts`.
- **4 file di `test/`:** `progress-hardening.test.ts`, `helpers.ts`, `mcp-tools.test.ts`, `control-w2-batch.test.ts`.
- Dokumen: `ARC-RULE.md`, `FMN-RULE.md`, `SIGMA_PROTOCOL.md`, `arc-memory.json`, `SIGMA-OPERATION-REGISTRY.json`.
- Inventarisasi ini berbasis pencarian kata kunci; belum dibaca satu per satu.

### Opsi [Inferensi; mendahului keputusan PRODUCT REVIEW]

> Catatan 15 Oktober 2026: opsi di bawah dirumuskan sebelum PRODUCT REVIEW disetujui. "Dokumen CLOSE" pada opsi A dan B dibaca sebagai PRODUCT REVIEW. Gate `close new` kini adalah Gate 3 + PRODUCT REVIEW lengkap (Seksi 4a); skoring bersifat sementara (a), lihat 7.5.

| Opsi | Isi | Konsekuensi |
|---|---|---|
| **A. Hapus total** | Gate 3.5, `intent score`, band, Trigger 2, render history dihapus. CLOSE bergantung pada penilaian per butir di dokumen CLOSE dan keputusan Director. | Biaya terendah. Menghapus juga sinyal keselarasan di tengah BUILD yang kini diberikan Trigger 2. Cakupan perubahan kode terbesar. |
| **B. Rekonstruksi** | Tier proses dihapus. Angka tunggal diganti penilaian per butir INTENT (Satisfied / Partially / Not satisfied). Gate `close new` menjadi: tidak ada butir wajib "Not satisfied", atau Director menerima risikonya. Pencatatan hanya saat closure evaluation. | Mempertahankan gate dan jejak historis, menghapus beban proses. Kode skor perlu diubah, bukan dihapus. |
| **C. Pertahankan numerik, output-only** | Skala 0–100 hanya menilai output. | Tier proses hilang, tetapi angka tunggal menyembunyikan butir yang gagal. Paling kecil biaya perubahan, paling lemah nilai informasinya. |

### Pertimbangan [Inferensi]

- Biaya yang dikeluhkan Director bersumber dari tier proses dan lingkup baca, bukan dari keberadaan gate itu sendiri. Opsi B menyerang sumber biaya itu langsung.
- Angka tunggal pada dasarnya hanya bermakna di tiga batas band. Penilaian per butir memuat informasi yang lebih berguna bagi keputusan penutupan.
- Opsi A menghapus mekanisme yang pernah dirancang untuk mencegah "build first, request amendment later" dan "local completion = strategic completion". Penggantinya (penilaian per butir pada CLOSE) hanya menjalankan fungsi itu pada saat penutupan, bukan selama BUILD.

### Keputusan terbuka

| # | Pertanyaan | Rekomendasi | Status |
|---|---|---|---|
| 7.1 | A, B, atau C? | B (rekonstruksi), dengan keputusan final setelah Seksi 1, 4, dan 5 selesai. | **DIGANTIKAN** oleh 7.5 dan Seksi 4a |
| 7.2 | Apakah gate `close new` dipertahankan dalam bentuk apa pun? | Ya, dalam bentuk penilaian per butir. Tanpa gate, CLOSE dapat dibuat tanpa penilaian apa pun. | **DIGANTIKAN**: gate = PRODUCT REVIEW lengkap (Seksi 4a) |
| 7.3 | Nasib Trigger 2 (pesan ke FMN setiap pasangan LOCKED). | Dihapus sebagai kewajiban; opsional. (sama dengan 5.3) | TERBUKA |
| 7.4 | Nasib data skor historis di `progress-v<N>.json` pada proyek yang sudah berjalan. | Dibiarkan sebagai catatan historis; tidak dihapus atau ditulis ulang. | TERBUKA |
| 7.5 | **Makna baru skoring** [Director sedang mempertimbangkan, 15 Oktober 2026]: operasi skoring dipertahankan, tetapi skor menjadi **hasil sementara berdasarkan PRODUCT REVIEW** (hasil pengujian ARC dan audit AUD atas produk akhir), bukan gate. Pilihan: (a) band turunan otomatis dari verdict, tanpa angka; (b) angka yang ditetapkan ARC setelah membaca kedua bagian; (c) skoring dihapus. | Rekomendasi: (a). Menghindari presisi semu dan sumber kebenaran ganda; menjaga nama band sehingga Trigger 2 dan `intent-history` tetap dapat dipakai; menghapus ritual frasa otorisasi komit. | **SEMENTARA (a) dipilih Director, 15 Oktober 2026**; rincian ditunda ke tahap detail sistem closure |

**Keluaran seksi:** keputusan A/B/C, daftar dampak kode final, dan urutan pelaksanaan.

---

## Masukan eksternal (ChatGPT, 15 Oktober 2026) — hasil verifikasi

Status seluruh butir: **masukan; belum diputuskan Director**, kecuali M6 (perbaikan pencatatan yang sudah diterapkan) dan M2 (**DISETUJUI Director, 15 Oktober 2026**, redaksi T1/T2/T3 pada Seksi 1). Setiap usulan wording di bawah bersifat tentatif.

| # | Masukan | Verifikasi | Penilaian | Tindak lanjut |
|---|---|---|---|---|
| M1 | Definisi INTENT dan CLOSE tepat; mandat sebagai unit lebih kuat dari v1 | — | Selaras | Tidak ada |
| M2 | T1 perlu pengaman: fitur yang mengubah outcome, penerima manfaat, batas strategis, atau standar mutu bukan T1 | T2 yang disetujui hanya menyebut objektif, penerima manfaat, dan definisi berhasil. "Batas strategis" (pengecualian scope, constraint) dan "standar mutu" tidak disebut eksplisit. Draf awal sempat menyebutnya | **Valid**: celah redaksi | Usulan wording: T1 = fitur, metode, teknologi, tahapan yang tidak mengubah outcome, penerima manfaat, batas strategis, atau standar mutu; T2 menambahkan "batas strategis dan standar mutu". Tanpa gate baru. Mengubah butir yang sudah disetujui, sehingga memerlukan persetujuan Director |
| M3 | Uji produk akhir tidak boleh mengabaikan bukti proses yang menentukan validitas hasil | Redaksi uji 3 ("tanpa membaca riwayat pekerjaan") lebih ketat daripada keputusan Director (metode ARC bebas, boleh membaca EXEC) | **Valid**: redaksi tidak konsisten | Usulan wording: butir INTENT menyatakan hasil atau kualitas yang dapat dinilai pada produk akhir; bukti apa pun, termasuk bukti proses, boleh dipakai bila menentukan validitas hasil; yang tidak dinilai adalah kepatuhan terhadap cara kerja. Dirumuskan final di butir 1.3 |
| M4 | PRODUCT REVIEW harus menggantikan pemeriksaan lama, bukan menambah lapisan | Kriteria ini belum tertulis. Daftar yang digantikan belum disusun | **Valid** sebagai kriteria keberhasilan desain | Tambahkan kriteria "total pekerjaan penutupan mandat berkurang" dan susun daftar yang dihapus (Closure Evaluation, tier proses Score Methodology, Gate 3.5, Trigger 2 bila diputuskan, isi evaluatif CLOSE §4 sampai §6, Petition/Admission Review bila skor tidak lagi otoritas ARC). Pada tahap detail sistem closure |
| M5a | "Lengkap" ≠ produk memenuhi mandat | "PRODUCT REVIEW lengkap" tidak didefinisikan di dokumen | **Valid** | Usulan: lengkap = setiap standar INTENT memiliki verdict (termasuk *Not satisfied* dan *Not verified*) dan bagian AUD berisi verdict atau skip eksplisit. Kelengkapan tidak menyiratkan rekomendasi menutup; Director melihat standar yang gagal atau belum terverifikasi |
| M5b | Status kewajiban AUD; cenderung opsional berdasar kebijakan risiko | **Klaim benar**: SIGMA_PROTOCOL §11 "AUD is optional by default"; wajib hanya bila Director menandai proyek *risk-sensitive*. Pola INTENT dan PLAN: verdict atau `SKIP_FOR_AUDIT` dengan instruksi Director verbatim. `sigma audit new/record` (audit pack) sudah ada | **Valid**, dan sejalan dengan rekomendasi saya sebelumnya | Usulan: bagian AUD pada PRODUCT REVIEW mengikuti §11 dan pola skip yang tercatat verbatim. Inventarisasi apakah `sigma audit new/record` dapat dipakai |
| M5c | Identitas produk yang dinilai harus terikat | Sudah tercakup sebagian: prinsip 5 (produk dan revisi INTENT yang dinilai) dan rincian deteksi review basi. Namun deteksi basi saat ini berjangkar pada penguncian pasangan PLAN/EXEC, padahal produk dapat berubah tanpa pasangan baru | **Sebagian valid** | Penajaman: deteksi basi berjangkar pada identitas produk (commit, build, atau hash), bukan hanya penguncian pasangan |
| M6 | Catatan lama belum diselaraskan dengan keputusan terbaru | Terkonfirmasi: Seksi 4 (posisi Director), 5 (gagasan 2, 4; 5.1, 5.4), 6 (bahan, 6.1), 7 (opsi, 7.1, 7.2) masih memuat pencatatan hasil di CLOSE | **Valid** | **Diterapkan:** butir lama ditandai DIGANTIKAN atau diperbarui; tidak ada yang dihapus |
| M7 | Keputusan terpenting: ARC membuktikan kesesuaian, bukan menelusuri seluruh PLAN–EXEC | — | Selaras | Tidak ada |
| M8 | Prioritaskan 1.5; REQ tidak boleh menjadi daftar fitur terselubung; contoh: "memakai Tkinter dengan tiga panel" = keputusan solusi; "operator menjalankan dan memantau tanpa akun pribadi" = kapabilitas; "naskah menyajikan argumentasi yang ditopang bukti dapat ditelusuri" = kualitas hasil | — | **Valid**; contoh bermanfaat | Adopsi sebagai syarat dan bahan panduan ARC pada butir 1.5 Opsi B |
| M9 | Pertanyaan penentu: apakah tiap butir INTENT menggambarkan hasil atau kualitas yang ingin dipertahankan, bukan cara sementara? | Setara dengan uji ketahanan | Selaras | Jadikan pertanyaan tunggal di panduan template |
| M10 | Jangan merancang mekanisme penutupan sebelum bentuk INTENT final jelas | Sudah sejalan: rincian sistem closure ditunda | Selaras | Tidak ada |

---

## Catatan batas bukti

- Pembahasan berdasarkan pembacaan rule, template, validator, dan hasil pencarian kata kunci. Tidak ada eksekusi `sigma`, tes, atau audit runtime.
- Observasi "CLOSE hampir tidak pernah dilakukan" berasal dari Director dan belum diverifikasi terhadap data proyek nyata.
- Skill ARC, memory ARC, dan rule FMN/AUD/DEV belum dibaca.
- Dokumen ini tidak mengubah template, rule, kode, atau state proyek apa pun.
