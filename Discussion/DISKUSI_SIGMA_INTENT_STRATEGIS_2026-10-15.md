# Diskusi Produk Sigma — INTENT sebagai Mandat Strategis, Bukan Kontrak Kerja

**Tanggal catatan:** 15 Oktober 2026  
**Jenis:** Catatan diskusi dan evaluasi konseptual produk Sigma  
**Mode sesi:** Diskusi default, **bukan** AUD Critic/Verificator Mode  
**Status:** Bahan pembahasan; **bukan** keputusan perubahan template/rules, persetujuan implementasi, atau artefak governance Sigma

## 1. Konteks dan sumber pembahasan

Director menjelaskan bahwa penggunaan Sigma v1 terasa melelahkan (*exhausting*) dan biaya mengulang kontrak sangat tinggi, khususnya ketika perubahan pekerjaan memaksa pembuatan INTENT baru. Diskusi diarahkan untuk menilai apakah filosofi serta template INTENT Sigma v2 mengurangi risiko tersebut, bukan sekadar menyederhanakan panjang dokumen.

Dokumen yang menjadi basis pembahasan:

1. `SIGMA_PROTOCOL.md` v1.0 (15 Oktober 2026) — model governance/lifecycle Sigma v2.
2. `diskusi_rencana_perubahan_sigma_v2.md` — konteks masalah penggunaan, evaluasi, rekomendasi, dan keputusan pengembangan.
3. `F00_indeks-dan-register.md` — perkembangan fokus implementasi v2, termasuk status F07 yang ditunda.
4. `DIR-INTENT-v5.md` (schema 4, proyek KLHK/JLH) — draft narasi akademis justifikasi 12 kelas dan protokol sampel.
5. `DIR-INTENT-v6.md` (schema 4, proyek KLHK/JLH) — aplikasi GUI untuk operasi model pada PC Super Windows.
6. `DIR-INTENT-TEMPLATE.md` (schema 5, Sigma v2) — template INTENT yang sedang dievaluasi.

**Batas bukti:** Pembahasan berdasarkan dokumen dan penjelasan Director. Tidak dilakukan audit runtime, pemeriksaan ulang kode, pengujian penggunaan ARC dengan template v2, ataupun pembuktian hasil ilmiah KLHK. Perilaku ARC-RULE v2 belum ditinjau langsung dalam diskusi ini.

## 2. Posisi dan tujuan Director

### 2.1 Prinsip yang diinginkan

- **INTENT adalah visi/mandat strategis**: menjelaskan **satu objektif utama** proyek, masalah yang hendak diselesaikan, penerima manfaat, hasil akhir, dan standar mutu keberhasilan.
- **PLAN adalah kontrak pekerjaan**: menentukan tahapan, deliverable, fitur, pilihan teknis, acceptance criteria, pengujian, dan bukti implementasi untuk mencapai visi.
- Idealnya, **satu objektif utama dapat ditangani oleh satu INTENT yang bertahan melewati banyak PLAN–EXEC**, bukan dibuat ulang setiap ada tambahan/penggantian fitur atau evolusi metodologi.
- INTENT tidak semestinya terlalu detail atau terlalu sempit; tetap harus **cukup jelas untuk mengendalikan pekerjaan**, serta dapat diamandemen bila memang diperlukan.
- Perubahan atau penambahan fitur tidak otomatis berarti perubahan tujuan proyek.

**Contoh ilustratif dari Director:** Untuk proyek aplikasi, INTENT seharusnya menjelaskan aplikasi yang ingin dihasilkan dan kualitas seperti security, UX, UI, dan performance yang matang/layak digunakan. INTENT tidak perlu membakukan daftar fitur A/B/C yang dapat berubah sepanjang pengembangan.

**Objektif utama kasus KLHK menurut Director:** **membuat naskah akademik Jasa Lingkungan Hidup (JLH)**. Dua INTENT lama dinilai berisiko berupa rencana kerja dengan cakupan berbeda yang dinaikkan statusnya menjadi dokumen strategis, padahal pekerjaan-pekerjaan itu saling terkait.

### 2.2 Status posisi

Poin di atas merupakan **arah dan preferensi produk yang dinyatakan Director dalam diskusi**, bukan otorisasi untuk mengubah dokumen atau runtime Sigma. Rumusan persis struktur dan aturan v2 belum diputuskan dalam sesi ini.

## 3. Kerangka pembagian kewenangan dokumen yang dibahas

| Lapisan | Pertanyaan utama | Konten yang paling sesuai |
|---|---|---|
| **INTENT** | Apa objektif utama, untuk siapa, mengapa, dan apa definisi berhasil? | Mandat, outcome, manfaat, batas strategis yang relevan, kualitas dan ukuran keberhasilan |
| **ROADMAP** | Tahapan besar apa yang masuk akal untuk mencapai mandat? | Strategi tahap, urutan dan ketergantungan |
| **PLAN** | Pekerjaan konkret apa yang dilakukan dalam tahap ini dan bagaimana diterima? | Scope tahap, deliverable/fitur, kontrak kerja, AC, test contract, dependensi, pilihan teknis |
| **EXEC** | Apa yang benar-benar dibangun dan apa buktinya? | Realisasi, pengujian, deviasi, keterbatasan, bukti |
| **CLOSE** | Apakah mandat strategis selesai atau diakhiri berdasarkan bukti? | Evaluasi pencapaian objektif dan dasar penutupan |

**Nuansa penting:** INTENT tetap membutuhkan ukuran keberhasilan yang dapat diverifikasi dan batas yang cukup untuk mencegah PLAN mengarang tujuan. INTENT bukan sekadar slogan visi. Namun ia tidak perlu mengunci semua fitur, format artefak, metode, atau aktivitas sementara.

## 4. Pelajaran dari dua INTENT Sigma v1

### 4.1 DIR-INTENT-v5 — potensi penyempitan objektif akademik

**Dokumen menyatakan:**

- **§1.1 Objective:** draft narasi akademis untuk KLHK tentang justifikasi skema 12 kelas penutupan lahan pada baseline aktif Kalimantan serta protokol sampel latih berlabel.
- **§3 Success Definition:** keberhasilan berkisar pada tabel 12 kelas, narasi persiapan sampel, dan pembedaan label interpretasi dari *ground truth* independen.
- **§6 Scope Boundary:** beberapa batas berlabel **Sovereign**, antara lain `OS-002` (tidak mengumpulkan/memperbaiki label atau melakukan adjudikasi sampel), `OS-003` (tidak menjalankan baseline/model, GUI, GLCM/fenologi), dan `OS-005` (tidak menyusun laporan progres/evaluasi teknis historis rantai lain).
- Dalam model v1, perubahan item **Sovereign** dinyatakan memerlukan INTENT baru, bukan amandemen.

**Evaluasi diskusi:**

1. INTENT v5 mempunyai objektif **lokal yang cukup jelas**, tetapi **lebih sempit** daripada objektif utama naskah akademik JLH yang dinyatakan Director.
2. Kriteria berhasil mengukur satu **paket pekerjaan/narasi**, bukan secara langsung keberhasilan keseluruhan naskah akademik JLH.
3. Larangan terhadap kegiatan penunjang (misalnya pemodelan atau evaluasi sampel) dapat mengubah penemuan kebutuhan metodologis menjadi persoalan **lintas-INTENT**, walaupun tujuan utamanya tidak berubah.
4. Nilai yang **layak dipertahankan pada tingkat strategis**: integritas ilmiah, ketertelusuran sumber, pengakuan keterbatasan, dan larangan klaim empiris tanpa bukti.

**Kesimpulan bersyarat:** v5 merupakan contoh kuat risiko *work package* yang dinaikkan menjadi INTENT. Tetapi jika pekerjaan tersebut memang didelegasikan sebagai mandat mandiri dengan pemilik/hasil tersendiri, pemisahan dapat dibenarkan; hal itu tidak disimpulkan hanya dari teks v5.

### 4.2 DIR-INTENT-v6 — objektif produk jelas, implementasi terlalu dominan

**Dokumen menyatakan:**

- **§1.1 Objective:** paket GUI operasional pada PC Super Windows untuk menjalankan training/evaluasi dan inferensi model tanpa ketergantungan pada repository pengembangan atau akun pribadi.
- **§6 Scope:** operasi model, isolasi paket, dan pelestarian fungsi yang ada; `OS-003` mengeluarkan narasi akademis dan laporan progres sebagai workstream terpisah.
- **§8 Technical & Architecture Direction / §9 Functional Requirements:** teknologi dan mekanisme konkret seperti GUI Fenologi/Tkinter, PyTorch `.pt`, ONNX, GeoTIFF, DeepLabV3+/U-Net, adapter, preflight, dan regression test.

**Evaluasi diskusi:**

1. V6 mengandung **objektif produk yang masuk akal secara mandiri**: operator menjalankan model secara aman, transparan, dan tanpa akun pribadi.
2. Tetapi banyak **pilihan metode/teknologi dan pekerjaan tahap tertentu** dibawa ke tingkat INTENT. Sebagian memang diberi label *Operationalization* dalam model v1 dan dapat diamandemen, namun setiap perubahan tetap berpotensi menambah biaya governance.
3. Batas yang lebih strategis dan pantas dipertahankan meliputi: keamanan identitas, independensi dari lingkungan pengembangan, traceability/reproducibility, kebenaran status, dan penolakan masukan atau artefak model yang inkompatibel.
4. **Pertanyaan penentu yang belum terjawab:** apakah GUI v6 hanya sarana untuk menyelesaikan naskah akademik JLH, atau produk independen yang akan dipakai sesudah naskah selesai? Jika independen, INTENT terpisah dapat tepat; jika sekadar sarana, pemisahan dapat menjadi fragmentasi governance.

### 4.3 Pola gabungan

V5 mengeluarkan pekerjaan model/GUI; v6 mengeluarkan narasi akademis. Pembagian tugas seperti ini bisa sehat bila mandat dan tanggung jawabnya benar-benar terpisah. Tetapi ia juga bisa membentuk **batas administratif yang saling mengunci**, sehingga kebutuhan teknis yang saling terkait harus dikelola dalam banyak INTENT.

Pola risiko yang dibahas: **penyelesaian paket pekerjaan lokal tidak otomatis berarti objektif strategis keseluruhan telah tercapai** (*local completion* ≠ *strategic completion*).

## 5. Pemeriksaan template INTENT Sigma v2 (schema 5)

### 5.1 Perbaikan dibanding v1

- **Director Summary** ditempatkan di awal, disertai contoh included/excluded scenarios.
- Struktur lebih singkat dan *Research* bersifat opsional.
- Tier **Sovereign/Operationalization** tidak lagi digunakan; protokol v2 memungkinkan amandemen seluruh substansi INTENT dengan pengamanan otoritas dan riwayat.
- *Desired Outcome and Measurement* secara eksplisit meminta ambang dan metode pengukuran benar-benar mengukur outcome, bukan pengganti yang lebih sempit.

**Penilaian:** kemajuan nyata untuk keterbacaan, fleksibilitas perubahan, dan penurunan biaya administrasi. Namun ini belum sama dengan perlindungan terhadap salah tingkat abstraksi.

### 5.2 Lima titik risiko pengulangan pola v1

| Titik pada template v2 | Risiko yang muncul | Batas yang perlu diperjelas |
|---|---|---|
| **Objective** — `[What this project creates or changes.]` | ARC dapat memilih deliverable tahap tertentu sebagai objektif utama | Identifikasi satu tujuan strategis, penerima manfaat, alasan keberadaan, dan hasil akhir |
| **Scope** — kolom `Must Deliver` | Daftar tugas/deliverable dapat dibekukan sebagai mandat | Scope tingkat tujuan/kapabilitas inti; pisahkan batas mandat dari pekerjaan yang baru ditunda |
| **Out of Scope** — *deferred items* dan *non-goals* digabung | Penundaan sementara tampak seperti larangan permanen | Bedakan pekerjaan belum diprioritaskan dari tujuan yang memang dikecualikan |
| **Functional Requirements** — priority, user story, AC | INTENT berubah menjadi backlog fitur/kontrak FMN | Bedakan kapabilitas penting produk dari fitur, AC teknis, dan kontrak per tahap |
| **Constraints and Technical Direction** serta **Success Threshold** | Teknologi dapat dibekukan tanpa alasan strategis; ambang dapat mengukur outcome yang sejak awal sudah terlalu sempit | Justifikasi kebutuhan constraint strategis dan uji apakah ukuran keberhasilan benar-benar mewakili objektif utama |

**Temuan konseptual inti:** v2 telah memperbaiki **cara memperbaiki INTENT yang salah**, tetapi belum secara memadai mencegah **INTENT yang terlalu operasional disusun dan diratifikasi**.

### 5.3 Penilaian risiko (kualitatif, bukan verdict AUD)

- **Kualitas struktur dan pengurangan boilerplate:** lebih baik daripada template v1.
- **Fleksibilitas amendment:** lebih baik secara desain governance.
- **Perlindungan terhadap pembekuan fitur/teknologi di INTENT:** belum memadai berdasarkan template saja.
- **Risiko fragmentasi satu objektif ke banyak INTENT:** masih bermakna/tinggi jika ARC mengikuti pola lama.

**Batas kesimpulan:** risiko ini berasal dari pembacaan template. Belum ada bukti bahwa ARC pasti menghasilkan INTENT salah pada setiap penggunaan v2. ARC-RULE, skill, memory, validator dan contoh hasil drafting schema 5 belum dinilai bersama.

## 6. Prinsip dan uji desain yang direkomendasikan

### 6.1 Prinsip pokok

> **INTENT menjaga kontinuitas tujuan; ROADMAP mengatur strategi tahapan; PLAN mengakomodasi evolusi solusi; EXEC membuktikan pelaksanaan; CLOSE menilai selesainya mandat.**

> **Perubahan metode tidak otomatis berarti perubahan tujuan; setiap deliverable tidak otomatis layak menjadi objektif strategis baru.**

### 6.2 Uji abstraksi untuk ARC

Sebelum suatu fitur, batas, atau kewajiban ditempatkan dalam INTENT, tanyakan:

1. Apakah ini menjelaskan **mengapa proyek ada** dan **hasil penting** yang perlu dicapai, atau hanya pekerjaan yang saat ini dipilih?
2. Jika fitur, metodologi, teknologi, atau tahap pekerjaan ini berubah tetapi tujuan utama tetap sama, **apakah INTENT masih benar dan berguna?**
3. Apakah kewajiban tersebut benar-benar **batas strategis** yang perlu dilindungi, atau lebih tepat menjadi ruang keputusan PLAN?
4. Apakah kriteria sukses menilai **outcome yang dijanjikan** dan bukan semata kelengkapan deliverable teknis?
5. Apakah suatu *out of scope* bersifat tujuan yang memang dikecualikan, atau hanya pekerjaan yang belum dilakukan saat ini?

Jawaban negatif terhadap pertanyaan kedua merupakan sinyal **kemungkinan over-specification**, bukan bukti otomatis bahwa item tersebut salah. Beberapa platform, standar, atau batas hukum memang dapat menjadi constraint strategis sah bila Director menghendakinya.

### 6.3 Biaya perubahan yang proporsional

- **Perubahan implementasi tanpa mengubah kontrak hasil:** cukup dikelola pada pelaksanaan/PLAN sesuai dampak dan kontrol revisinya.
- **Perubahan kebutuhan/fitur untuk objektif yang sama:** umumnya PLAN baru atau revisi PLAN, sepanjang masih sah dalam mandat dan batas yang telah disetujui.
- **Perubahan mandat utama, penerima manfaat fundamental, atau identitas produk:** keputusan strategis Director, yang dapat memerlukan amandemen INTENT atau INTENT baru menurut alasan pemisahannya.

## 7. Contoh konseptual untuk proyek naskah akademik JLH

**Bukan draft INTENT yang disepakati; hanya ilustrasi tingkat abstraksi yang dibahas:**

> Menghasilkan naskah akademik Jasa Lingkungan Hidup yang layak ditinjau KLHK, didukung argumentasi ilmiah dan metodologi yang dapat dipertanggungjawabkan, berdasarkan sumber serta hasil analisis yang relevan, dengan ketertelusuran bukti dan pernyataan keterbatasan yang jelas.

Dalam pembacaan ini, justifikasi klasifikasi, metode sampel, analisis data, pemodelan, GUI pendukung, dan penggabungan naskah dapat menjadi pekerjaan dalam ROADMAP/PLAN, sepanjang melayani objektif tersebut. Penggantian pendekatan analisis tidak otomatis mengganti visi.

**Keterbatasan ilustrasi:** masih perlu definisi penerima hasil, lingkup naskah, standar akademik, syarat kelayakan review, dan parameter keberhasilan yang disetujui Director. Pernyataan kualitas tidak boleh menjadi abstraksi yang tak dapat diuji.

## 8. Persoalan desain yang belum selesai

1. **Satu INTENT per objektif vs satu INTENT per produk sepanjang umur:** bagaimana model ini berlaku pada produk berumur panjang dengan banyak release?
2. **Makna CLOSE:** bagaimana membedakan selesai satu PLAN, release produk, dan penutupan mandat strategis? Tidak ada rekomendasi langsung menambah lifecycle state baru.
3. **Pemisahan mandat independen:** kapan aplikasi GUI v6 layak memiliki INTENT sendiri, alih-alih menjadi alat bagi naskah akademik?
4. **Peran Functional Requirements di INTENT:** apa batas antara kapabilitas esensial dan fitur/AC yang seharusnya menjadi kontrak FMN?
5. **Aturan ARC saat ini:** apakah `ARC-RULE` schema v2, skill, memory, dan validator sudah menjaga tingkat abstraksi dan mencegah fragmentasi INTENT?
6. **Validasi empiris:** bagaimana menguji keluaran ARC menggunakan kasus nyata KLHK tanpa mengubah artefak v1 yang historis/terkunci?

## 9. Arah tindak lanjut yang direkomendasikan (belum disetujui untuk eksekusi)

**Langkah evaluasi terdekat:** baca **ARC-RULE v2** bersama `DIR-INTENT-TEMPLATE.md` schema 5 untuk melihat apakah guardrail terhadap over-specification dan pemisahan INTENT/PLAN sudah ada. Jika belum, rumuskan perubahan prinsip pada aturan ARC dan/atau petunjuk template **sebelum** mengubah source, validator, atau workflow.

Jika Director nantinya memilih mengujinya, gunakan contoh kasus KLHK untuk membandingkan dua output dari brief objektif utama yang sama: (a) INTENT pada pola template sekarang dan (b) INTENT yang sengaja mempertahankan level strategis. Ukur kejelasan tujuan, cakupan perubahan fitur yang dapat diterima tanpa amandemen, keterujian outcome, serta kemungkinan FMN perlu mengarang keputusan strategis. Evaluasi ini berbeda dari menyederhanakan jumlah baris dokumen.

Menurut `F00_indeks-dan-register.md` yang dibahas, **F07 (pilot keterbacaan dan penyederhanaan dokumen) berstatus PENDING PROCESS**, bukan pekerjaan yang otomatis terjadwal. Catatan ini tidak mengubah keputusan penundaan F07.

## 10. Ringkasan keputusan dan non-keputusan sesi

**Dinyatakan Director:** Preferensi kuat bahwa INTENT seharusnya berupa mandat/visi satu objektif utama, sementara rincian pekerjaan berada dalam PLAN; objek akhir KLHK yang dimaksud adalah naskah akademik JLH; biaya kontrak ulang dan INTENT baru pada v1 tidak proporsional.

**Penilaian/rekomendasi asisten, belum keputusan Director:** Template v2 memperbaiki bentuk dan amendment, tetapi masih berisiko menurunkan objektif utama menjadi paket pekerjaan; perlu batas isi yang lebih ketat dan peninjauan ARC-RULE v2.

**Belum ditentukan:** redaksi aturan baru, perubahan struktur template, revisi validator, relasi rilis–CLOSE, kebijakan satu INTENT sepanjang umur produk, atau perubahan apa pun terhadap artefak KLHK.

**Tidak dilakukan:** aktivasi AUD formal; ratifikasi/lock/approval; penulisan ulang INTENT v5/v6; perubahan kode, rule, template Sigma, project state, atau Git.
