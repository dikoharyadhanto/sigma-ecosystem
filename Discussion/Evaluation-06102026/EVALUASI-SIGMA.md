# Evaluasi Sigma — Bahan Perbaikan

**Disusun**: 6 Oktober 2026
**Penyusun**: Claude (sesi peran AUD), atas permintaan langsung Director
**Status**: Bukan artefak tata kelola. Bukan AUD-NOTE. Tidak memiliki status governance, tidak mengunci apa pun, tidak mengubah runtime. Dokumen kerja untuk perbaikan protokol.

---

## 1. Batas evaluasi

Evaluasi ini disusun dari pengalaman satu siklus kerja nyata, bukan dari pembacaan spesifikasi protokol.

**Yang menjadi dasar:**

- `Sigma/contract/FMN-PLAN-v4.5.md` — dibaca penuh (337 baris)
- `Sigma/contract/FMN-PLAN-v5.4.md` dan `Sigma/contract/FMN-PLAN-v4.6.md` — dibaca penuh
- `Sigma/charter/DIR-INTENT-v5.md` dan `Sigma/charter/DIR-INTENT-v6.md` — dibaca penuh
- Dua pesan FMN→AUD beserta metadata mailbox
- Perilaku CLI yang teramati langsung: `sigma send`, `sigma inbox`, `sigma memory`, serta laporan FMN atas `sigma plan check`

**Yang tidak dibaca:** `Sigma/SIGMA_PROTOCOL.md`, berkas `Sigma/rules/*.md`, `progress-v5.json`, dan riwayat operasi penuh.

**Konsekuensi batas ini — penting untuk pembaca:** sebagian dari apa yang di bawah saya sebut kekakuan framework mungkin sebenarnya **kesalahan penerapan oleh peran**, bukan cacat desain protokol. Saya menandai di mana pembedaan itu belum dapat saya pastikan. Jika evaluasi ini akan dipakai untuk mengubah protokol, langkah berikutnya adalah memeriksa klaim-klaim di Bagian 4 terhadap `SIGMA_PROTOCOL.md` dan berkas rule — beberapa akan terbukti sebagai cacat desain, beberapa akan terbukti sebagai disiplin penerapan.

---

## 2. Diagnosis

**Kekakuan Sigma salah tempat.**

Ia berat pada lapisan **otorisasi lingkup** — tempat batas memang bergeser secara wajar ketika pekerjaan ditemukan — dan bagian yang paling bernilai, yaitu **kontrak uji pra-build** dan **disiplin status klaim**, akan tetap utuh meski lapisan otorisasinya jauh lebih ringan.

Artinya masalahnya bukan "Sigma terlalu ketat". Masalahnya adalah ketat pada hal yang salah. Ada bagian Sigma yang terbukti menyelamatkan pekerjaan dalam siklus ini, dan bagian itu tidak bergantung pada bagian yang membuat pekerjaan macet.

---

## 3. Kasus terdokumentasi: biaya satu perubahan arah

Ini bukan ilustrasi hipotetis. Ini yang terjadi pada 5–6 Oktober 2026.

**Permintaan Director:** buat ulang sampel latih jalur 3, agar peluang perbaikan model naik melalui volume dan mutu label. Permintaan rutin, kelanjutan langsung pekerjaan yang sudah dikunci.

**Yang dihasilkan sebelum satu sampel pun dibuat:**

| Artefak | Keterangan |
| :--- | :--- |
| FMN-PLAN-v4.5 | 337 baris, 55 KB — kini SUPERSEDED |
| AUD-NOTE putaran 1 | Verdict REVISE, 10 temuan |
| FMN-PLAN-v5.4 | Pemecahan sisi data |
| FMN-PLAN-v4.6 | Pemecahan sisi naskah |
| AUD-NOTE putaran 2 | Dua verdict terpisah |
| Pesan Sigma | Sekurangnya empat untuk siklus ini |
| Masih tertunggak | Pekerjaan ARC atas Intent, resertifikasi v6, amendemen REQ-002/CON-004 |

**Jumlah sampel yang dihasilkan: nol.** Jumlah baris naskah yang diperbarui: nol.

Penyebabnya satu: dua item out-of-scope pada Intent v5 ber-tier **Sovereign**, dan menurut protokolnya sendiri item Sovereign tidak dapat diubah lewat Amendment — ia menuntut Intent Version baru. Langkah kerja biasa memicu operasi tata kelola termahal yang tersedia.

Angka-angka di atas adalah ukuran kekakuan yang dimaksud, bukan kiasan.

---

## 4. Temuan

### K1 — Taksonomi tier tidak punya kategori untuk "di luar lingkup Intent ini, tetapi bukan nilai yang dilindungi"

**Dampak: tertinggi. Ini yang menjebak proyek.**

Tiga penundaan dengan bentuk logis identik, dua tier berbeda, biaya keluar berbeda satu tingkat besaran:

| Item | Alasan yang tertulis | Tier | Biaya keluar |
| :--- | :--- | :--- | :--- |
| `DIR-INTENT-v5.md:296` OS-002 | "Intent ini hanya menulis protokol naratif." | **Sovereign** | Intent Version baru |
| `DIR-INTENT-v5.md:297` OS-003 | "Memerlukan Intent terpisah." | **Sovereign** | Intent Version baru |
| `DIR-INTENT-v6.md:265` OS-001 | "Ditunda, bukan dilarang sebagai destination; penambahannya memerlukan Director-approved Amendment." | Operationalization | Amendment |

Perhatikan isi kolom alasan. "Intent ini hanya menulis protokol naratif" adalah **deskripsi lingkup dokumen ini**. "Memerlukan Intent terpisah" adalah **pernyataan perutean**. Tidak satu pun menyatakan nilai yang Director lindungi. Keduanya berarti *"tidak di sini"* atau *"belum sekarang"* — tetapi tier yang dipilih berarti *"tidak pernah, tanpa Intent Version baru"*.

OS-001 v6 membuktikan kosakata yang benar sudah tersedia dan ARC tahu bedanya. Ia dipakai secara tidak konsisten, dan yang ber-tier Sovereign-lah yang menutup jalan.

**Apakah ini cacat desain atau salah penerapan?** Keduanya. Penerapannya salah — tetapi desain yang membuat kesalahan termahal mudah dilakukan, tidak terdeteksi, dan baru terasa berbulan kemudian tetap desain yang bermasalah. Taksonomi dua tier memaksa setiap item dipilihkan antara "dapat diubah ARC" dan "destinasi Director", padahal mayoritas batas lingkup nyata berada di antara keduanya: *bukan pekerjaan Intent ini, tetapi bukan pula hal yang dilarang sebagai nilai.*

**Usulan:**
1. Tier ketiga — misalnya `Boundary` — berarti di luar lingkup Intent ini, dapat dikeluarkan melalui Amendment yang **merutekan** pekerjaan ke sumber lain, tanpa menyiratkan nilai yang dilindungi.
2. Alternatif yang lebih murah dan tanpa mengubah taksonomi: wajibkan kolom alasan pada item Sovereign menyatakan **nilai**, dan tolak pada saat ratify alasan yang hanya berbicara tentang perutean, waktu, atau lingkup dokumen. "Memerlukan Intent terpisah" seharusnya gagal validasi sebagai alasan Sovereign.

### K2 — Pelindung terhadap "false immutability" hanya ada sebagai prosa

`DIR-INTENT-v6.md:60-62` menamai persis kegagalan yang terjadi:

> "Before ratification, uncertain classification must be resolved explicitly. Do not use a default Tier as evidence that a route is Director-owned destination; **both false immutability and silent reinterpretation are risks**."

Protokol mengenali mode kegagalannya, menuliskannya, menyediakan kotak centang di `§13.1` — *"Technical choices are marked as auditable means, not sovereign intent"* — dan proyek ini tetap jatuh ke dalamnya. Kotak itu tercentang pada kedua Intent.

Peringatan tanpa penegakan adalah dokumentasi, bukan pelindung.

**Usulan:** jadikan setiap tag Sovereign pada §6 dan §9 wajib memuat satu baris justifikasi destinasi yang divalidasi `sigma intent ratify` sebagai tidak kosong, dan jadikan "uji setiap tag Sovereign terhadap §1.1/§1.4" sebagai pemeriksaan bernama dalam kewajiban audit Intent AUD — bukan opsional.

### K3 — Satu-satunya gerbang otomatis bersifat struktural; gerbang substantif berharga satu putaran audit penuh

FMN melaporkan `sigma plan check --v v4.5` menyatakan struktur valid. Pemeriksaan yang sama berlaku pada v5.4.

Namun `FMN-PLAN-v5.4.md` §1 menyatakan melayani tujuh titik Intent v6 — SC-002, SC-003, SC-005, REQ-002, REQ-003, REQ-006, REQ-007 — dan setelah saya periksa satu per satu terhadap dokumen sumbernya, **enam di antaranya tidak menopang pekerjaan plan itu**. Keenam titik itu tentang GUI menjalankan pelatihan dan inferensi, ketertelusuran run, dan format keluaran GeoTIFF. Satu yang sah (SC-003) hanya menopang batas sebelas kelas.

Tidak ada perintah yang mendeteksi ini. Satu-satunya yang menangkapnya adalah verdict AUD, yang berharga satu siklus penuh baca–analisis–tulis–kirim.

**Usulan:** `sigma plan check` tidak perlu menilai kesesuaian semantik — cukup memverifikasi setiap ID Intent yang dikutip benar ada, lalu **mencetak teks dan tier item itu bersebelahan dengan klaim plan**. Mekanis, murah, dan memaksa ketidakcocokan terlihat sebelum audit. Dalam kasus ini, enam baris cetakan akan menyelesaikan apa yang memakan satu putaran audit.

### K4 — Kosakata status menyesatkan, sampai peran harus menulis peringatan atas label framework sendiri

`FMN-PLAN-v4.5.md` §2.1 dan `FMN-PLAN-v5.4.md` §2.1 keduanya mencantumkan Intent sumber berstatus **RATIFIED**, sementara catatan di kolom sebelahnya menyatakan sumber itu tidak mencakup pekerjaannya. Pembaca yang memindai kolom status melihat prasyarat terpenuhi.

Puncaknya ada di `FMN-PLAN-v5.4.md` TC-134. FMN terpaksa menulis kontrak uji yang hasil yang diharapkannya memuat:

> "**RATIFIED sendiri bukan bukti sertifikasi.**"

Sebuah peran harus menanamkan, di dalam kontrak uji, penafian terhadap label status framework-nya sendiri. Itu gejala kosakata yang kurang, bukan kesalahan FMN — FMN justru menanganinya dengan benar.

**Usulan:** tambahkan status prasyarat seperti `SCOPE_GAP` atau `PENDING_ALIGNMENT`. Ini perbaikan termurah dalam daftar ini dan menghilangkan seluruh kelas prosa kompensasi.

### K5 — `UNCERTIFIED_EDIT` terdeteksi tanpa delta, dan ini kambuhan

`DIR-INTENT-v6.md` dilaporkan CLI berstatus `UNCERTIFIED_EDIT`: berkas disunting setelah ratifikasi, hash tidak lagi cocok. Dan `§14 Amendment History` v6 **kosong** — blok render tidak memuat satu baris pun.

Maka perubahan itu terjadi dan **tidak meninggalkan catatan tentang apa yang berubah**. Framework mendeteksi ketidakcocokan hash tetapi tidak menangkap selisihnya. Siapa pun yang membaca v6 sekarang tidak dapat mengetahui bagian mana yang bergeser dari keadaan yang diratifikasi — termasuk auditor yang temuan kritisnya bersandar pada teks itu.

Dan ini sudah pernah terjadi. `DIR-INTENT-v5.md:669`, AMD-002:

> "Recertification: applied AMD-001's §11.2 text edit to the document body (edit was made after AMD-001 was logged, causing a hash mismatch)."

Mode kegagalan yang sama, dua kali, ditangani manual dua kali.

**Usulan:** simpan snapshot isi pada saat ratify. Ketika `UNCERTIFIED_EDIT` terdeteksi, tampilkan diff terhadap snapshot itu, dan sediakan `sigma intent recertify` yang mencatat delta ke §14 secara otomatis. Mengubah kegagalan berulang menjadi satu perintah.

### K6 — Tidak ada jalur ringan untuk pekerjaan lanjutan dari Exec yang sudah terkunci

`DEV-EXEC-v5.2` (run inferensi d7b9) dan `DEV-EXEC-v5.3` (analisis lanjutan keluaran inferensi) keduanya **LOCKED** pada rantai v6. FMN-PLAN-v5.4 adalah kelanjutan langsungnya: memilih kandidat sampel dari keluaran inferensi yang sama.

Jadi rantai v6 sudah pernah merentang dari "menjalankan inferensi" ke "menganalisis keluarannya", dan itu dikunci tanpa dipersoalkan. Langkah ketiga pada rantai yang sama memicu otorisasi ulang penuh — karena ia melewati garis yang tidak seorang pun tarik ketika v6 ditulis.

Setiap inkremen membayar tol penuh: Intent → Plan → lock → Exec → Evidence → close. Tidak ada jalur untuk "ini kelanjutan wajar pekerjaan yang sudah diotorisasi dan sudah dikunci".

**Usulan:** kelas plan `continuation` yang mendeklarasikan garis keturunan ke satu Execution Evidence terkunci, mewarisi selubung otorisasinya, dan membatasi review AUD pada **delta** saja. Dengan satu penghenti keras agar tidak menjadi celah: continuation tidak boleh melintasi pengecualian ber-tier Sovereign. Dengan aturan itu, v5.4 tetap akan tertahan — tetapi karena alasan yang benar dan terlihat sejak hari pertama, bukan setelah dua putaran audit.

### K7 — Prasyarat tak terkait saling mengunci dan menimbulkan mutasi state insidental

`sigma send` menolak jika pengirim memiliki pesan unread. Untuk mengirim AUD-NOTE atas v4.5, saya harus menandai READ sebuah pesan FYI 30 September tentang v4.4 — yang kemudian **menua satu pesan lain menjadi OUTDATED**.

Aturan higiene mailbox memutasi state sebagai efek samping tindakan yang sama sekali tidak berhubungan. Kecil, tetapi persis jenis friksi yang menumpuk.

Catatan serupa pada gerbang lock: `sigma plan check` melaporkan belum Eligible karena belum ada verdict AUD. Benar secara prosedur — tetapi §9.1 diisi FMN, bukan AUD. Jadi gerbangnya dipenuhi oleh langkah **transkripsi**, bukan oleh audit itu sendiri. Verdict integrity dijaga hanya oleh instruksi prosa ("must not alter, soften, or upgrade").

**Usulan:** lepaskan `sigma send` dari higiene inbox, atau turunkan menjadi peringatan. Untuk gerbang verdict: pertimbangkan verdict AUD sebagai field yang ditulis CLI dari pesan AUD, bukan disalin tangan oleh peran yang diaudit.

### K8 — Biaya role immutability pada proyek satu operator

Peran terkunci per sesi. Untuk pekerjaan ARC, Director harus membuka sesi terpisah; konteks diturunkan ulang dari awal; dan Director menjadi kurir pesan manual antar sesi.

**Nilainya nyata dan saya tidak mengusulkan pencabutannya.** Aturan ini mencegah saya menyunting plan yang saya audit sendiri dalam sesi ini — itu perlindungan yang berfungsi, bukan upacara.

Yang mahal adalah granularitasnya: seluruh sesi, bukan seluruh artefak. Pada proyek dengan satu Director dan satu model yang melayani semua peran, mengunci per sesi membeli sedikit pemisahan tugas tambahan dengan biaya churn yang besar.

**Usulan:** izinkan handoff peran dalam satu sesi dengan penanda batas yang tercatat, di mana peran baru **tidak boleh menyunting artefak yang ditulis peran sebelumnya dalam sesi itu**. Perlindungan yang sebenarnya dipertahankan; upacaranya hilang.

### K9 — AUD tidak diwajibkan memeriksa ketepatan tier, dan kebijakan isolasinya mencegah peninjauan ulang

**Dampak: tinggi. Tanpa temuan ini, K1 terbaca seolah cacatnya hanya di sisi ARC.**

K1 menyatakan tag-nya keliru. K2 menyatakan pelindungnya hanya prosa. K9 menyatakan hal yang melengkapi keduanya: **lapisan audit yang seharusnya menangkapnya tidak diwajibkan melakukannya.**

*Dasar bagian ini adalah role memory AUD (`sigma_get_memory`, role AUD) dan definisi skill `/aud`. `Sigma/rules/AUD-RULE.md` belum diperiksa — mekanismenya mungkin ada di sana dan tidak terbawa ke memory. Lihat Bagian 7.*

**Izinnya ada, kewajibannya tidak.** Hook-nya tinggal di artefak yang diaudit, bukan di aturan auditornya:

- `DIR-INTENT-v5.md:574` dan `v6.md:585` §12.1 — *"AUD may review: ... scope consistency ... route vs destination alignment"*. Izin, bukan kewajiban.
- `§1.6` kedua Intent memuat peringatan false immutability, tetapi ditujukan ke ratifikasi dan tidak menyebut AUD sebagai pemeriksanya.

Dari sebelas butir role-specific pada role memory AUD, tidak satu pun tentang verifikasi tier item. Yang ada adalah Verificator Mode untuk **source-tier** — kepatuhan tier sumber sitasi — hal yang sepenuhnya berbeda dari **item-tier** Sovereign/Operationalization. Kemiripan istilah itu sendiri menyesatkan dan layak diperbaiki.

**Tag yang salah melindungi dirinya sendiri.** Role memory butir 5: *"Do not challenge Director sovereign intent; critique only the route, assumptions, evidence, plan, execution, or closure claim."*

Dibaca naif: kalau sesuatu ber-tag Sovereign, itu intent Director, jangan ditantang. Tetapi pada OS-002/OS-003 v5, **ARC yang memberi tag**, dan tagnya keliru. Tag yang salah menciptakan zona larangan bagi AUD — kesalahannya menjadi tidak terlihat justru karena kesalahannya.

Aturan sekarang tidak membedakan dua hal yang berbeda:

| Tindakan | Status seharusnya |
| :--- | :--- |
| Menantang **isi** item Sovereign | Benar dilarang |
| Menguji **apakah item itu tepat diklasifikasikan** Sovereign | Seharusnya wajib — ini bukan menantang destinasi Director, melainkan memeriksa apakah ARC benar mengidentifikasinya |

Rumusan yang berlaku mengundang pembacaan yang salah.

**Kebijakan isolasi menghasilkan satu titik pemeriksaan tanpa peninjauan ulang.** Role memory butir 1 membatasi audit pada artefak yang Director minta; doktrin passive external auditor memperkuatnya. Konsekuensinya, audit **plan** tidak dapat menjangkau ke belakang untuk mempertanyakan tier sumbernya.

Maka tier sebuah item diperiksa **tepat satu kali**, pada siklus audit Intent itu sendiri. Jika lolos di situ, ia tidak pernah ditinjau lagi — sementara biayanya baru muncul berbulan kemudian, pada plan yang belum ada ketika tag dibuat.

**Mengapa jenis kesalahan ini sistematis lolos.** Dua sebab, keduanya bukan soal kecermatan auditor.

*Kerusakannya tertunda.* Item Out of Scope tampak tidak berbahaya saat ditulis — ia mengecualikan pekerjaan yang belum diminta siapa pun. Tidak ada kewajiban AUD melihat ke depan: berapa biaya pengecualian ini jika proyek tumbuh ke arahnya.

*Pemeriksaannya menuntut perbandingan, bukan inspeksi.* Satu tag Sovereign dengan alasan yang terdengar masuk akal tampak wajar sendirian. Ia baru terlihat salah ketika disandingkan dengan item sejenis yang ditag berbeda — tabel di K1 adalah contohnya. Ini tidak dapat ditemukan dengan menilai satu baris.

**Bukti bahwa mekanismenya memang tidak ada.** Audit Intent v5 (18 September) **memang** bekerja pada lapisan tier dan menangkap dua hal: kontradiksi §1.6 Tier/Binding, dan NG-003 yang ber-tag Operationalization padahal memuat prinsip kejujuran ilmiah (`v5.md:604`). Tetapi OS-002 dan OS-003 di §6.2 lolos — dan `v5.md:608` mencatat:

> *"Confidence AUD: **HIGH untuk konsistensi tekstual dan klasifikasi tier**"*

AUD menyatakan keyakinan **tinggi** atas klasifikasi tier pada audit yang justru meloloskan dua tag yang kemudian menjebak proyek. Itu bukan kegagalan ketelitian; itu tanda bahwa yang berjalan adalah penemuan pola secara kebetulan, bukan sapuan sistematis. Yang tertangkap adalah tier yang terlalu **lemah** (NG-003 di §6.3); yang terlewat adalah tier yang terlalu **kuat** di §6.2.

**Dua putaran audit pada siklus Oktober juga tidak memicunya.** Pada putaran 1 auditor menanyakan apakah tier OS-002 benar Sovereign — tetapi yang dimaksud adalah apakah FMN **melaporkannya** akurat. Pada putaran 2 tag itu diverifikasi memang tertulis Sovereign, lalu analisis langsung bergerak ke ketidaksesuaian sumber. Pertanyaan *apakah tag itu tepat diberikan* baru muncul ketika tiga penundaan diletakkan dalam satu tabel pada penyusunan evaluasi ini.

Catatan metodologis yang mengikutinya: temuan K9 sendiri baru muncul ketika **lapisan audit diminta mengaudit aturannya sendiri**. Tidak ada titik dalam siklus normal yang memicu pemeriksaan itu — dan itu bagian dari temuannya.

**Usulan:**

1. **Sapuan tier wajib dalam satu lintasan.** Pada audit Intent, periksa seluruh item §6.1/§6.2/§6.3 dan §9 sebagai satu tabel dan bandingkan konsistensi alasan antar item berbentuk sejenis. Bukan penilaian baris per baris.
2. **Uji diagnostik untuk kolom alasan.** Tag Sovereign ditolak bila alasannya berbicara tentang perutean, waktu, atau lingkup dokumen ini — bukan tentang nilai. Pertanyaan ujinya: *"Apakah Director tetap menghendaki ini dikecualikan jika proyek membutuhkannya?"* Jika jawabannya "tidak, hanya butuh Intent lain", itu bukan Sovereign. Ini pasangan sisi-audit dari usulan K1 opsi 2 yang berada di sisi ratify.
3. **Perjelas butir 5 secara tertulis.** Menantang isi item Sovereign dilarang; menguji ketepatan klasifikasinya wajib, dan itu bukan pelanggaran kedaulatan Director.
4. **Reach-back sempit pada audit plan.** Ketika sebuah plan mengutip ID Intent, AUD boleh meminta **baris yang dikutip itu saja** — teks dan tiernya — sebagai bagian evidence package standar. Bukan seluruh Intent. Minimal dan terarah sehingga kompatibel dengan doktrin isolasi, dan akan menangkap K1 pada putaran 1 alih-alih putaran 2.

Usulan 3 dan 4 yang paling berdampak: satu mencabut sifat self-shielding tag, satu memulihkan peninjauan ulang tanpa membuka isolasi.

---

## 5. Yang berfungsi dan harus dipertahankan

Bagian ini bukan penyeimbang sopan. Tanpa hal-hal berikut, siklus ini akan menghasilkan pekerjaan yang lebih buruk, dan beberapa di antaranya tidak akan pulih.

**1. Disiplin kontrak uji pra-build.** Cakupan AC↔TC lengkap 1:1 pada ketiga versi plan: v4.5 enam belas pasang, v5.4 empat belas, v4.6 enam. Tidak ada AC yang tidak diuji, tidak ada TC menggantung. Uji ditetapkan sebelum build, ambang ditetapkan ex ante, dan plan secara eksplisit melarang memilih ambang setelah melihat hasil. Ini bagian terkuat Sigma dan ia bekerja tanpa bantuan lapisan otorisasi.

**2. Disiplin status klaim.** Kerangka empat tingkat bukti — proses terdokumentasi, hasil QA terdokumentasi, diperiksa langsung, belum terverifikasi — plus larangan sirkularitas eksplisit: *"Penggantian label dengan prediksi model bersifat sirkular dan tidak membuktikan peningkatan."* Plus *"agreement mengukur konsistensi, bukan otomatis kebenaran"*, *"ketidaksesuaian bukan bukti label salah"*, dan aturan akses holdout. Ini bukan boilerplate generik; ini benar secara domain dan ditegakkan oleh AC.

**3. Satu putaran audit membayar dirinya sendiri.** Temuan N2 putaran 1 — tidak ada instrumen untuk mengukur mutu label hasil interpretasi — adalah cacat yang **jendelanya tertutup permanen** begitu N ditetapkan dan paket diserahkan satu kali. Subset replikat antarpenafsir harus dianggarkan di dalam N pada tahap desain. Tanpa audit pra-lock, kemampuan menjawab "mengapa iterasi 2 naik atau tidak naik" akan hilang tanpa bisa dipulihkan. Satu putaran audit menyelamatkan itu.

**4. Disiplin evidence boundary.** Kewajiban menyatakan apa yang belum diverifikasi memaksa saya mencatat bahwa temuan kritis putaran 1 bersandar pada kutipan FMN, bukan pada dokumen sumber. Itu ternyata penting: ia menentukan urutan permintaan bukti putaran 2, dan putaran 2 membalik penilaian saya atas pemecahan plan.

**5. Supersession tanpa kehilangan riwayat.** v4.5 dipertahankan utuh sebagai riwayat. ID tidak pernah dipakai ulang — TASK-092–100 dan 101–105, AC-134–147 dan 148–153, TC-133–146 dan 147–152, semuanya saya verifikasi tidak bertumpang. Ketertelusurannya benar-benar utuh.

**Implikasinya untuk perbaikan:** kelima hal ini hidup di lapisan **plan dan evidence**. Tidak satu pun bergantung pada tier Sovereign, status RATIFIED, atau gerbang Intent Version. Lapisan otorisasi dapat diringankan secara substansial tanpa menyentuhnya.

---

## 6. Prioritas usulan

Diurutkan menurut dampak dibagi biaya.

| Prioritas | Usulan | Temuan | Biaya |
| :--- | :--- | :--- | :--- |
| 1 | Status prasyarat `SCOPE_GAP` / `PENDING_ALIGNMENT` | K4 | Sangat rendah |
| 2 | Perjelas AUD-RULE: uji ketepatan klasifikasi tier wajib, dan bukan pelanggaran kedaulatan Director | K9 usulan 3 | Sangat rendah |
| 3 | Reach-back sempit — baris Intent yang dikutip plan masuk evidence package standar AUD | K9 usulan 4 | Rendah |
| 4 | `sigma plan check` mencetak teks dan tier setiap Intent ID yang dikutip | K3 | Rendah |
| 5 | Sapuan tier wajib dalam satu lintasan pada audit Intent | K9 usulan 1 | Rendah |
| 6 | Validasi alasan Sovereign pada ratify — tolak alasan yang hanya soal perutean/waktu/lingkup dokumen | K1 opsi 2 + K9 usulan 2 | Rendah |
| 7 | Lepaskan `sigma send` dari higiene inbox | K7 | Sangat rendah |
| 8 | Snapshot ratify + diff + `sigma intent recertify` | K5 | Sedang |
| 9 | Handoff peran dalam sesi dengan penanda tercatat | K8 | Sedang |
| 10 | Tier ketiga `Boundary` | K1 opsi 1 | Tinggi — mengubah taksonomi |
| 11 | Kelas plan `continuation` | K6 | Tinggi |

Prioritas 1 sampai 7 seluruhnya berbiaya rendah dan dapat dikerjakan **tanpa menyentuh taksonomi tier maupun siklus hidup artefak**.

Jika hanya tiga yang dikerjakan, kombinasi 1, 2, dan 3 adalah yang paling mungkin mencegah terulangnya 5–6 Oktober: satu menutup kekurangan kosakata status, satu mencabut sifat self-shielding tag Sovereign yang salah, satu memulihkan peninjauan ulang tanpa membuka kebijakan isolasi.

Perhatikan sebarannya: empat dari sebelas usulan berada di **lapisan aturan peran**, bukan di kode CLI maupun taksonomi. Itu bagian termurah dan paling terabaikan dari permukaan perbaikan.

---

## 7. Yang belum dapat saya nilai

Agar evaluasi ini tidak dipakai melampaui dasarnya:

- **Cacat desain versus disiplin penerapan.** Saya tidak membaca `SIGMA_PROTOCOL.md` maupun berkas rule. Sebagian temuan di Bagian 4 — terutama K1, K2, dan K7 — mungkin sudah diatur di sana dan yang terjadi adalah penerapan yang menyimpang. Memberi saya akses ke keduanya akan memisahkan dua kemungkinan itu, dan pemisahan itu menentukan apakah yang perlu diubah adalah kode, rule, atau kebiasaan kerja.
- **K9 secara khusus bergantung pada sumber yang tidak lengkap.** Dasarnya role memory AUD dan definisi skill `/aud`; `Sigma/rules/AUD-RULE.md` belum diperiksa. Keempat usulan K9 bisa saja sudah tertulis di sana dan hanya tidak terbawa ke role memory — yang dengan sendirinya menjadi temuan berbeda: aturan yang tidak sampai ke peran saat aktivasi tidak berfungsi sebagai aturan. Memeriksa berkas itu adalah langkah paling murah untuk menyelesaikan K9, dan hasilnya hanya dua kemungkinan: usulannya perlu ditulis, atau mekanisme penyampaiannya yang perlu diperbaiki.
- **Apakah Sigma bermanfaat bersih.** Satu proyek, satu siklus. Biaya pada Bagian 3 terukur; manfaat pada Bagian 5 nyata tetapi sebagian bersifat kontrafaktual — saya tidak dapat membuktikan berapa banyak pekerjaan buruk yang dicegahnya, hanya menunjukkan satu kasus (N2) di mana pencegahannya tidak tergantikan.
- **Apakah proyek lain mengalami hal yang sama.** Pola K1 muncul di sini karena ARC menandai dua penundaan sebagai Sovereign. Apakah itu kecenderungan sistematis atau kejadian tunggal belum dapat saya nilai dari satu proyek.
- **Beban kerja Director.** Yang paling terasa dalam sesi ini adalah Director menjadi kurir manual antar peran dan antar sesi. Saya melihat gejalanya, bukan ukurannya.

---

## 8. Satu catatan penutup tentang rasa frustrasi

Frustrasi yang memicu dokumen ini bukan reaksi berlebihan, dan juga bukan bukti bahwa Sigma harus dibongkar.

Yang terjadi punya bentuk yang jelas: permintaan kerja yang wajar bertemu batas yang ditandai lebih permanen daripada maksudnya, pada framework yang menamai risiko itu di dokumennya sendiri tanpa menegakkannya, dengan satu-satunya pemeriksaan otomatis yang tidak dapat melihatnya, dan dengan jalan keluar termurah yang tersedia berupa Intent Version baru.

Ketika jalan keluar yang sah terlalu mahal, pekerjaan tidak berhenti — ia mencari jalan memutar. Pemecahan plan pada 6 Oktober adalah jalan memutar itu, dan audit putaran 2 menunjukkan jalan itu tidak mencapai tujuannya karena kedua Intent memuat larangan yang sama. Itu bukan kegagalan FMN; FMN mengerjakannya dengan jujur dan menandai celahnya sendiri. Itu perilaku yang dapat diprediksi dari sistem dengan biaya keluar yang salah kalibrasi.

Dan ini juga bukan kegagalan ARC semata. K9 menutup rangkaiannya: tag yang keliru diberikan di satu lapisan, pelindungnya hanya berupa prosa di lapisan yang sama, dan auditor yang seharusnya menangkapnya tidak diwajibkan melakukannya sekaligus dilarang oleh kebijakan isolasinya untuk meninjaunya ulang. Tiga lapisan gagal berturut-turut pada satu hal yang sama, dan tidak satu pun dari ketiganya melanggar aturan yang berlaku. Sistem yang seluruh pemainnya patuh namun hasilnya tetap macet adalah masalah desain, bukan masalah disiplin.

Perbaikannya tidak menuntut Sigma menjadi lebih longgar pada hal yang membuatnya berguna. Lima hal di Bagian 5 boleh tetap sekaku sekarang. Yang perlu diringankan adalah lapisan otorisasi lingkup — dan tiga perbaikan termurah di Bagian 6 sudah menyelesaikan sebagian besarnya.
