# Diskusi: Perpindahan Wewenang Closure ke ARC + Mekanisme Skor Kepuasan ARC

> **Sifat dokumen**: Catatan hasil diskusi eksploratif antara Director, AI teknisi/pengembang Sigma (Professional Mode — bukan role governance manapun), dan AUD (audit formal, dua putaran). Bukan `PLAN-EVAL`, bukan artifact Sigma resmi, tidak mengubah `progress-v<N>.json`, tidak melalui `sigma send`.
> **Tujuan**: Diserahkan ke AUD untuk audit sebelum ide ini dituangkan menjadi `PLAN-EVAL` formal. **`PLAN-EVAL` sengaja belum dibuat** atas instruksi eksplisit Director.
> **Status audit**: AUD sudah memberi dua putaran review. Verdict akhir: **PASS (Strong Pass)**. Lihat Section 8.
> **Tanggal**: 2026-07-20

---

## 1. Titik Berangkat

Diskusi dimulai dari evaluasi sistem Closure (`DIR-CLOSE`) yang sudah berjalan di Sigma saat ini. Setelah dipetakan (lihat Section 2), Director mengajukan empat perubahan besar terhadap desain closure yang berlaku:

1. Memindahkan **wewenang operasional CLI** atas siklus `close` dari **FMN** ke **ARC**.
2. Menambahkan **mekanisme skor** yang dihitung/dinilai ARC, sebagai **syarat pembuka gerbang `sigma close new`** (bukan gerbang `close lock`).
3. Menambahkan **Mandatory Message Trigger** baru: ARC wajib melapor ke FMN setiap kali skor dicatat, mengikuti pola yang sudah ada untuk DEV dan AUD.
4. Menambahkan **mekanisme Petition / Admission Review** untuk permintaan re-evaluasi skor — muncul dari audit AUD putaran kedua, lihat Section 6.

Keempat perubahan ini murni hasil diskusi — belum ada keputusan lock, belum ada implementasi, belum ada `PLAN-EVAL`.

---

## 2. Kondisi Sistem Saat Ini (Sebelum Perubahan)

Ringkasan closure system yang berjalan hari ini, dipetakan dari kode dan rule file:

- **Lifecycle**: `START → DESIGN → BUILD → CLOSE`. CLOSE adalah fase terakhir; proyek dianggap selesai saat `DIR-CLOSE` LOCKED.
- **Gate 3** (`hasCleanGate3Chain`, `src/engine/chain.ts:560`) memblokir `sigma close new` sampai ada rantai bersih **INTENT (LOCKED) → PLAN (LOCKED) → EXEC (LOCKED)** dalam satu chain version yang sama.
- **`close lock`** divalidasi oleh `docCheck.ts` — satu-satunya domain di mana verdict checkbox Director (`CLOSE_ACCEPTED` / `CLOSE_ACCEPTED_WITH_LIMITATIONS` / dst.) benar-benar menggerbangi lock secara kode (verdict-aware), berbeda dari verdict AUD/FMN yang selalu advisory.
- **`close lock` juga men-trigger side effect**: auto-lock ROADMAP milik chain yang sama (jika masih DRAFT).
- **Kepemilikan isi**: `DIR-CLOSE` 100% milik Director. Tidak ada AI role yang berwenang menulis isinya (ARC/FMN/DEV eksplisit "Cannot author... DIR-CLOSE" di `SIGMA_PROTOCOL.md` §4).
- **Kepemilikan operasional CLI** (sebelum perubahan yang didiskusikan): **FMN** adalah satu-satunya role yang boleh menjalankan `sigma close check` (bebas) dan `sigma close lock` (hanya setelah otorisasi eksplisit Director) — lihat `FMN-RULE.md` §CLI Operation Policy. ARC tidak punya wewenang apa pun di `close`; DEV tidak punya sama sekali; AUD eksplisit dilarang menjalankan `close lock`.
- **Messaging**: `sigma send`/`sigma inbox` sudah jadi mekanisme komunikasi antar-role standar. Flag yang tersedia: `--from`, `--to` (role: `arc|fmn|dev|aud`), `--type` (`NOTE|CHECK|RESPONSE|HANDOFF|QUESTION|RISK`), `--action` (`FYI|RESPOND|REVIEW|UNBLOCK|OTHER`), `--subject`, `--message`/`--message-file`, `--related-artifact` (`src/commands/send.ts`, `src/config.ts`). DEV punya 3 Mandatory Message Trigger, AUD punya 1 (wajib kirim hasil audit) — keduanya rule-level, bukan CLI-enforced.

---

## 3. Perubahan #1 — Wewenang Operasional Close: FMN → ARC

### Rasional Director

- **FMN harus tetap murni implementasi.** FMN tidak boleh punya akses ke `close` sekalipun Director mengizinkan, karena FMN adalah pihak yang menulis/mengelola kontrak build (`FMN-PLAN`) yang justru **dinilai** di dalam `DIR-CLOSE` §4 (Intent Satisfaction). Memberi FMN akses closure menciptakan potensi konflik kepentingan struktural — FMN berpotensi "menutup pekerjaannya sendiri."
- **ARC adalah pemegang kontrak Intent sejak awal.** ARC yang menyusun `DIR-INTENT` (intent core, success criteria, scope boundary). ARC paling tepat menilai di titik closure apakah implementasi benar-benar memenuhi kontrak yang ARC bantu rumuskan di awal, lalu memberi rekomendasi tutup/jangan-tutup ke Director. ARC menjadi **role bookend**: membuka Intent di DESIGN, menutup loop-nya di CLOSE.

### Model otorisasi CLI yang disepakati

**Tidak berubah dari model FMN sebelumnya** — hanya pindah pemegangnya:

| Command | Kelas | Siapa jalankan |
| :--- | :--- | :--- |
| `sigma close check` | Read-only | ARC — boleh jalan sendiri |
| `sigma close new` | Draft/Operational | ARC — dalam batas role, dengan syarat skor (lihat Section 4) |
| `sigma close lock` | Approval | ARC — hanya setelah otorisasi eksplisit Director |

### Konsekuensi arsitektur yang teridentifikasi (belum diputuskan, dicatat sebagai titik yang perlu direkonsiliasi)

- `ARC-RULE.md:405` saat ini eksplisit **melarang** ARC menyentuh artifact close sama sekali sebagai default (*"ARC MUST NOT... inspect roadmap/plan/exec/close artifacts... by default"*) — bertentangan langsung dengan wewenang baru ini, perlu ditulis ulang bukan sekadar ditambah baris.
- `SIGMA_PROTOCOL.md` §4.1 saat ini menyatakan *"ARC's work ends when DIR-INTENT is LOCKED"* dan tabel role §4 memetakan ARC hanya ke fase DESIGN. ARC perlu didefinisikan ulang sebagai role dua-fase (DESIGN + CLOSE).
- Baris `sigma close check`/`sigma close lock` di `FMN-RULE.md` §CLI Operation Policy perlu dihapus dari tabel FMN, dan section serupa perlu dibuat baru di `ARC-RULE.md` (yang saat ini nyaris tidak punya CLI Operation Policy sama sekali).
- Instruksi aktivasi role ARC di CLAUDE.md (global & project) — *"stop first and ask whether Director wants to open a new DIR-INTENT"* — murni framing DESIGN-phase, perlu cabang instruksi baru untuk skenario aktivasi ARC di fase BUILD/CLOSE untuk evaluasi closure.
- Peran AUD terhadap `DIR-CLOSE` (audit isi, kalau diberi akses Director) **tidak berubah** — orthogonal terhadap siapa yang menjalankan CLI-nya.
- Peran DEV terhadap closure **tetap tidak ada** sama sekali.

---

## 4. Perubahan #2 — Skor Kepuasan ARC sebagai Syarat `close new`

### Posisi dalam alur

Skor ini **bukan gerbang `close lock`** (verdict checkbox Director di `DIR-CLOSE` tetap satu-satunya gerbang lock, tidak berubah). Skor ini adalah **prasyarat baru sebelum `sigma close new` bisa dijalankan** — gerbang baru yang menempel di sisi Gate 3, sementara draft menyebutnya **"Gate 3.5 — ARC Satisfaction Score."**

Skor bersifat **tidak final** — bisa dinilai ulang oleh ARC seiring PLAN/EXEC baru masuk ke chain selama BUILD berlangsung. Ini bukan penilaian sekali di ujung proyek.

### Cakupan evaluasi

ARC menilai **seluruh riwayat plan dalam satu chain intent version** — dari FMN-PLAN pertama sampai FMN-PLAN/DEV-EXEC terakhir yang terikat ke versi INTENT tersebut, bukan cuma rantai bersih terakhir yang dicek Gate 3.

### Definisi "Satisfied"

Seberapa baik proses implementasi sejalan dengan `DIR-INTENT`, dari sisi **proses** dan **output** yang diharapkan.

- **Output satisfied** — apakah deliverable konkret yang dijanjikan INTENT (§1.4 Desired Outcome, §3.1 Concrete Outcome, §3.2 Success Threshold) benar-benar berdiri dan berfungsi sesuai yang ditulis. **Bukan** soal kualitas teknis, polish, atau fitur tambahan di luar kontrak — murni soal "apakah yang dijanjikan itu ada dan berfungsi." Contoh dari Director: kalau INTENT menjanjikan website marketplace jualan, output satisfied = situsnya hidup dan bisa diakses sebagai marketplace, bukan soal bagus-tidaknya UI atau ada-tidaknya fitur ekstra.
- **Process satisfied** — apakah cara mencapai output itu sejalan dengan constraint, non-goals, dan arahan yang tertulis di INTENT — bukan sekadar "sampai tujuan," tapi "sampai dengan cara yang diizinkan."

### Skala skor (bertingkat, bukan dua sumbu yang dijumlah rata)

```
0 ─────────────────── 50 ─────────────────── 100
   Output Satisfied         Process Satisfied
   (harus penuh untuk        (hanya dinilai setelah
    naik di atas 50)          output sudah penuh)
```

- **0–50**: murni menilai output. Untuk melewati 50, output harus **sepenuhnya** terpenuhi — tidak ada jalan menembus 50 dengan output yang baru sebagian jadi.
- **50–100**: begitu output penuh (mentok di 50), skala lanjut menilai proses sebagai **penambah** di atas fondasi output yang sudah utuh. Proses tidak pernah bisa menggantikan/mengompensasi output yang belum lengkap.

### Ambang batas

| Skor | Efek |
| :--- | :--- |
| < 50 | Gerbang **tertutup** — `sigma close new` tidak bisa dijalankan. Output belum sepenuhnya terpenuhi. |
| 50–79 | Gerbang **terbuka** (`close new` bisa jalan), tapi ARC **tidak merekomendasikan** penutupan. Director tetap bisa melanjutkan `close lock` lewat instruksi eksplisit biasa — **tanpa perlu mekanisme override khusus**, karena ini setara pola advisory-vs-Director-finality yang sudah berlaku untuk verdict AUD/FMN hari ini. |
| ≥ 80 | ARC percaya diri merekomendasikan penutupan sebagai satisfied ke Director. |

### Keputusan penting: tidak perlu mekanisme override untuk skor < 50

Sempat didiskusikan apakah skor < 50 perlu mekanisme bypass (mis. `sigma override` yang sudah ada di Sigma untuk Gate 1/1.5/2/3). **Diputuskan tidak perlu.** Alasan Director: sebuah chain intent version **boleh dibiarkan tidak pernah ditutup** — itu bukan kondisi gagal yang harus diselesaikan paksa, itu hasil yang sah. Sigma sudah mendukung kerja multi-chain-version (multi progress); kalau satu chain tidak pernah tembus 50, Director bisa terus mengiterasi PLAN/EXEC di chain yang sama, atau membuka chain/intent version baru dan melanjutkan di sana. Menambah mekanisme override baru untuk skor < 50 dianggap **terlalu birokratis** dan tidak perlu — konsisten dengan constitutional invariant Sigma yang sudah ada: *"Evidence-based closure — completion requires documented proof of work"* (`SIGMA_PROTOCOL.md` §2).

### Tujuan sesungguhnya (reframing penting dari Director)

Mekanisme skor ini **bukan sekadar gerbang izin klik close**. Nilai utamanya: membuat **ARC berperan sebagai evaluator berkelanjutan atas kualitas kerja dalam satu chain**, sepanjang BUILD berjalan — bukan hanya di ujung proyek. Gerbang `close new` cuma titik di mana evaluasi berkelanjutan itu "ditagih"/diformalkan, bukan tujuan itu sendiri.

### Penyimpanan skor dan command CLI (open item #2 — RESOLVED)

**Lokasi**: `Sigma/design/intent-history.md`. File ini sudah CLI-managed, auto-rendered (bukan dokumen ber-lock), dan sudah berbentuk satu baris per chain/intent-version — cakupannya persis sama dengan cakupan skor ("satu chain intent version"). Dua kolom baru ditambahkan ke tabel yang sudah ada (`Version | Title | Focus | Status | Reason`): **Skor Evaluasi** dan **Catatan**.

**Command**: `sigma intent score <n> --notes "..."` — **bukan** `sigma plan score` (usulan awal Director dikoreksi jadi domain `intent`). Alasan pemilihan domain:

- `intent-history.md` sudah dimiliki dan dirender oleh domain `intent` (`sigma intent new/lock/supersede/activate` + `sigma doctor`, lihat `src/utils/intentHistory.ts`) — domain yang memiliki file sebaiknya domain yang menulis ke file itu.
- Skor ini menjawab "seberapa terpenuhi INTENT ini", bukan menilai `FMN-PLAN` sebagai dokumen — nama `plan score` menyesatkan pembaca command history.
- Konsistensi taksonomi: seluruh domain CLI Sigma (`intent`, `plan`, `exec`, `close`, `roadmap`) berbasis **jenis artifact**, bukan berbasis **role**. Domain baru berbasis role (mis. `sigma arc score`) akan jadi yang pertama memutus pola itu tanpa alasan kuat.
- Disarankan mengikuti pola flag `--v <version>` yang sudah dipakai `close check` (default beroperasi ke chain aktif, override eksplisit untuk chain non-aktif) — konsisten dengan command lain, bukan pola baru.

**Sanitasi `--notes`**: wajib mengikuti pembatasan yang **sama persis** dengan `sigma intent new --title/--focus` — menolak literal `|` dan newline. Ini bukan pilihan desain baru, murni mengikuti presedan yang sudah ada di file yang sama, untuk melindungi parser plain pipe-split di `engine/reconstruct.ts` (`readIntentHistoryMetadata`, baris ~161-176) yang dipakai jalur pemulihan `doctor --reconstruct`. Ambang validasi baris (`cells.length < 6`, mengasumsikan bentuk 5-kolom saat ini) juga wajib diperbarui begitu 2 kolom baru ditambahkan.

**Kebijakan riwayat**: tabel `intent-history.md` menyimpan **nilai terkini saja** (tertimpa tiap kali `sigma intent score` dijalankan ulang). Riwayat lengkap tiap penilaian (kapan, skor berapa, catatan apa) **tidak** diduplikasi di file ini — sudah otomatis terekam di `Sigma/logs/operations.jsonl` (setiap invokasi CLI tercatat di sana by design). Ini selaras dengan constitutional invariant *"Single source of truth per concern"*: `intent-history.md` = state terkini, `operations.jsonl` = riwayat. Menyimpan riwayat multi-baris langsung di `intent-history.md` akan mengubah file itu dari "satu baris per chain" jadi struktur bersarang — perubahan jauh lebih besar daripada menambah 2 kolom, dan merusak asumsi parser `reconstruct.ts` yang bergantung penuh pada bentuk flat-nya.

> **Catatan lanjutan (audit AUD putaran kedua)**: AUD mengusulkan tambahan `sigma intent score --history` sebagai command read-only terpisah di masa depan, spesifik untuk melihat tren skor — bukan mengubah `intent-history.md` jadi menyimpan riwayat. Alasan: nilai utama continuous evaluation justru trennya, bukan snapshot terakhir, dan menggali `operations.jsonl` manual tidak praktis untuk Director. **Ditunda ke `PLAN-EVAL` lanjutan**, dicatat sebagai open item (Section 9).

### Otorisasi commit dan hak baca ARC (open item #3 dan #4 — direvisi setelah audit AUD)

**Hak baca — otonomi penuh, dipicu frasa eksplisit.** Ketika Director mengucapkan *"evaluasi project ini"* / *"Evaluate this project"* (atau frasa setara), ARC berhak membaca **seluruh** riwayat chain (`progress-v<N>.json`, semua artifact plan/exec terkait, bukan cuma rantai bersih Gate 3) **tanpa otorisasi per-command**. Ini mencabut larangan default `ARC-RULE.md:405` khusus untuk konteks evaluasi ini — bukan pencabutan total larangan itu untuk semua konteks ARC lainnya. ARC lalu menyampaikan skornya lewat percakapan dulu (murni diskusi, bukan aksi CLI, tidak butuh gerbang apa pun).

**Menulis (`sigma intent score`) — REVISI dari draf sebelumnya.** Draf awal dokumen ini menyebut ini kelas otorisasi baru ("otorisasi-commit"), terpisah dari Approval-class. **AUD menantang klaim itu**: apakah ini benar-benar kelas baru, atau sekadar "Operational Write" — karena Director tidak menyetujui isi, hanya menyetujui persist. AI teknisi/pengembang **merevisi posisinya sendiri** setelah ditantang: secara **mekanisme CLI**, `sigma intent score` berperilaku identik dengan Approval-class (ARC tidak boleh jalan sampai ada sinyal eksplisit Director) — itu bukan ciri Draft/Operational, yang berjalan tanpa sinyal apa pun. Menambah kelas keempat berisiko proliferasi kelas otorisasi (Approval / Operational / Commit / Override — makin banyak makin sulit dikelola), risiko yang secara eksplisit diangkat AUD.

**Keputusan revisi**: `sigma intent score` tetap **Approval-class** di tabel `SIGMA_PROTOCOL.md` §16A — tapi dengan **catatan semantik eksplisit** yang membedakannya dari `close lock`: yang disetujui Director adalah **tindakan mencatat (commit)**, bukan **kelayakan isi skornya** (itu sudah selesai dibahas lewat percakapan sebelumnya). Bahasa otorisasi yang dipakai di `ARC-RULE.md` nanti harus eksplisit berbeda dari bahasa Approval biasa — bukan "apakah Anda setuju skor ini," tapi "catat/simpan skornya sekarang" (mis. "catat", "simpan skornya", "record it") — supaya instance ARC lain tidak salah paham dan mulai meminta persetujuan isi yang sebenarnya sudah tidak dipermasalahkan Director.

### Representasi skor: Band, bukan angka mentah (baru — hasil audit AUD)

AUD mengangkat kekhawatiran: apakah 61 secara operasional berbeda dari 63? Kalau tidak, angka presisi tinggi (0-100 granular) memberi **ilusi presisi palsu**, padahal cuma tiga ambang yang benar-benar operasional (< 50, 50-79, ≥ 80). AI teknisi/pengembang mengusulkan, **AUD mendukung penuh**:

- ARC tetap bebas bernalar internal dengan angka 0-100 (fleksibel untuk pertimbangan sendiri, dan tetap disimpan sebagai `<n>` di `sigma intent score <n>`).
- Tapi setiap kali skor **ditampilkan** ke Director/FMN (tabel `intent-history.md`, pesan Mandatory Trigger ke FMN), yang ditonjolkan adalah **band/kategori**, bukan angka:
  - `< 50` → `OUTPUT_INCOMPLETE`
  - `50–79` → `SATISFIED_NEEDS_REVIEW`
  - `≥ 80` → `SATISFIED_RECOMMENDED`
- Angka mentah tetap tersedia sebagai detail sekunder (mis. di `--notes` atau kolom terpisah), tapi bukan sinyal utama yang dilihat pertama kali.

Ini sekaligus mengurangi risiko Goodhart's Law (lihat subsection berikut) — band jauh lebih sulit "dikejar" secara presisi palsu dibanding angka tunggal.

### Mitigasi Goodhart's Law (baru — hasil audit AUD, dua putaran)

**Kekhawatiran AUD (putaran pertama)**: risiko skor perlahan berubah jadi KPI yang dikejar FMN, bukan lagi representasi evaluasi ARC terhadap intent — *"When a measure becomes a target, it ceases to be a good measure."* AI teknisi/pengembang sepakat ini murni masalah budaya/perilaku, tidak ada gerbang CLI yang bisa mencegahnya secara mekanis — tapi mencatat mitigasi parsial yang sudah ada di desain: Mandatory Message Trigger ARC→FMN (Section 5) sudah mewajibkan **alasan** ikut terkirim bersama skor, bukan angka telanjang.

**Penajaman AUD (putaran kedua)**: ARC **boleh** menjelaskan kenapa skor sekarang segini (evaluasi retrospektif — "kenapa 72"), tapi **tidak boleh** memberi checklist cara mencapai angka target ("lakukan ini supaya jadi 80" — arahan prospektif). Alasan: begitu ARC mulai memberi checklist, FMN mulai mengoptimalkan checklist itu, bukan lagi intent aslinya. Distingsi ini subtle tapi penting — perlu ditulis eksplisit sebagai batasan di `ARC-RULE.md`: ARC menjelaskan evaluasi, bukan meresepkan jalan menuju skor lebih tinggi.

**Prinsip yang perlu dicatat eksplisit di `ARC-RULE.md`** (bahasa AUD): *"Score is a compressed representation of ARC's evaluation against the locked intent — never the target itself."*

---

## 5. Perubahan #3 — Mandatory Message Trigger: ARC → FMN

Trigger pesan wajib **kelima** di Sigma (setelah 3 milik DEV + 1 milik AUD), dan yang pertama milik ARC. Konsisten dengan pola yang sudah ada (Mandatory Message Trigger di rule file, bukan CLI-enforced), diterapkan ke kapabilitas skor yang baru.

### Kondisi pemicu

**Setiap ada pasangan plan+exec LOCKED baru** dalam chain (bukan setiap invokasi `sigma intent score` mentah-mentah). Ini idealnya juga jadi titik ARC melakukan re-assessment.

**Kasus tepi yang dibahas eksplisit** (bukan cuma hipotetis — Director menimbang langsung): kalau evaluasi terakhir sudah mencakup sampai pasangan plan+exec versi v1.5, lalu chain berkembang ke v1.6, evaluasi baru di v1.6 itu sah dan wajar (memicu pesan ke FMN sesuai kondisi pemicu di atas). Kalau ARC menilai ulang di v1.5 lagi (tanpa pasangan baru) — **tetap sah, tidak dilarang secara CLI** — tapi Director sadar konsekuensinya: berpotensi menghasilkan catatan skor yang berbeda untuk versi yang sama (redundant/berpotensi tidak konsisten). Kesimpulan: **idealnya minimal ada satu pasangan plan+exec baru sejak evaluasi terakhir**, tapi ini panduan (soft guidance), **bukan gerbang CLI yang memblokir**.

> Ini secara substansial menjawab open item freshness/staleness yang tercatat di diskusi awal (skor "tidak final, bisa berubah seiring perkembangan") — jawabannya bukan hard gate seperti sempat diperkirakan, melainkan panduan ideal tanpa enforcement mekanis. Konsisten dengan filosofi "tidak mau terlalu birokratis" yang sama seperti keputusan skor < 50 (Section 4).

### Isi pesan minimal

- Skor saat ini (ditampilkan sebagai band, lihat Section 4).
- Versi pasangan plan+exec LOCKED terakhir yang jadi dasar penilaian (dengan asumsi cakupan evaluasi selalu kumulatif dari versi paling awal chain sampai pasangan itu — bukan cuma delta terbaru).
- Highlight apa yang kurang, berdasarkan `DIR-INTENT` — **evaluasi retrospektif, bukan checklist prospektif** (lihat mitigasi Goodhart's Law, Section 4).
- Alasan pemberian skor tersebut.

### Parameter `sigma send`

`--type CHECK --action REVIEW` (dari `VALID_MESSAGE_TYPES`/`VALID_ACTIONS` di `src/config.ts`) — `CHECK` karena isinya laporan status/penilaian (bukan `QUESTION`/`RISK`), `REVIEW` karena FMN diharapkan meninjau, bukan sekadar menerima info (`FYI`). Ditetapkan eksplisit di sini supaya tidak berulang gap yang sudah tercatat di `Discussion/sigma-bug-report-20260720-131540.md` §8.5 — DEV-RULE tidak pernah eksplisit menyebut nilai `--action` untuk Mandatory Message Trigger-nya sendiri, diserahkan ke tebakan DEV dari `--help`.

### Kewajiban balas FMN — digantikan mekanisme Petition (lihat Section 6)

Desain awal: FMN tidak wajib membalas, tapi bebas membalas apa saja. **Ini sekarang diperhalus** oleh mekanisme Petition/Admission Review hasil audit AUD putaran kedua — kalau FMN ingin lebih dari sekadar diskusi bebas (yaitu ingin ARC benar-benar menilai ulang skornya), jalurnya adalah Petition formal, bukan sekadar balasan pesan. Balasan bebas (klarifikasi, apresiasi, pertanyaan) tetap tidak wajib dan tetap terbuka seperti semula. Lihat Section 6.

---

## 6. Perubahan #4 — Petition / Admission Review (hasil audit AUD, putaran kedua)

Mekanisme ini **tidak ada di draf awal** dokumen ini — murni muncul dari dialog Director–AUD setelah putaran audit pertama, dipicu pertanyaan Director: *"apa yang terjadi jika saya dan ARC berbeda pendapat, dan saya ingin ARC menjadi bias demi memenuhi hasrat saya ingin menutup?"*

### Prinsip inti: "Authority cannot rewrite recorded truth"

Rumusan ini hasil dua iterasi. AUD awalnya merumuskan sebagai "Authority vs Truth" (Director punya authority, ARC bertanggung jawab atas truth). AUD sendiri **memperhalus rumusannya di putaran kedua**: bukan Authority vs Truth (seolah dua hal yang berhadapan), melainkan **"Authority cannot rewrite recorded truth."** Director tetap memegang authority penuh — bisa mulai chain baru, menghentikan proyek, mengubah intent. Yang tidak boleh adalah mengubah evaluasi historis tanpa evidence baru.

Implikasinya: **ARC tidak mewakili Director hari ini — ARC mewakili Director yang telah mengunci `DIR-INTENT`.** Begitu `DIR-INTENT` LOCKED, lahir kontrak yang tidak bisa diubah hanya karena Director hari ini berubah pikiran atau lelah. Kalau Director ingin arah berbeda, jalurnya adalah intent baru (chain baru) — bukan mengedit evaluasi terhadap kontrak lama.

### Model tiga tahap

```
Petition (FMN atau Director)
        ↓
Admission Review (ARC menilai: apakah evidence cukup untuk membuka evaluasi ulang?)
        ↓
   Evidence cukup?  ──── TIDAK ──→ Reject (dengan alasan singkat) → Skor tetap
        │
       YA
        ↓
   Re-evaluation (ARC menilai ulang skor)
```

Dua keputusan ini **sengaja dipisah, jangan dicampur**:
- **Admission** — "Apakah permintaan ini layak dievaluasi ulang?"
- **Re-evaluation** — "Setelah melihat evidence, apakah evaluasi saya berubah?"

### Perlakuan FMN vs Director — simetris, dengan satu pembeda

Posisi awal AUD (putaran pertama): FMN lewat Admission Review (bisa ditolak), Director otomatis wajib dilayani (karena Director pemilik intent). **AUD mengoreksi posisinya sendiri** setelah Director menjelaskan skenario bias eksplisit (Director ingin menutup, ARC diminta menaikkan skor tanpa evidence baru): **keduanya sekarang lewat Admission Review yang sama** — Director tidak otomatis dilayani hanya karena posisinya.

Satu-satunya pembeda sah: Director bisa **mengubah intent itu sendiri** (hak eksklusif Director, lewat chain/intent version baru) — tapi tidak bisa memaksa ARC mengubah **evaluasi terhadap intent yang sudah dikunci** tanpa evidence baru yang genuin.

Istilah yang dipakai AUD, disepakati sebagai bahasa baku: FMN/Director punya **"Right to Petition"**, bukan **"Right to Re-evaluation."** Bedanya signifikan — frasa kedua terdengar seperti ARC wajib menurut, frasa pertama menyatakan yang benar: hak mengajukan permintaan yang layak dipertimbangkan, bukan hak memperoleh hasilnya.

### Dua jalan keluar yang selalu ditawarkan ARC saat menolak

ARC tidak pernah sekadar menjawab "tidak." Penolakan (Admission Review gagal, atau Re-evaluation tidak mengubah skor) selalu diakhiri dua opsi governance yang sah:

1. **Lanjutkan chain ini** — ajukan PLAN-EXEC baru untuk benar-benar mendekati intent yang dikunci.
2. **Mulai chain baru** — kalau tujuan/standar keberhasilan memang ingin berubah, itu hak Director, tapi lewat intent baru, bukan mengedit evaluasi lama.

Skor tetap sama selama tidak ada plan+exec baru yang benar-benar memenuhi evaluasi ARC (Director, kalimat asli): *"jika tidak close, selama tidak ada plan exec baru yang satisfied terhadap penilaian ARC, skor ARC tetap sama."*

### Mekanisme mengurangi area abu-abu: ARC bertanya, bukan memutuskan sendiri

Risiko yang diakui terbuka oleh kedua pihak (AI teknisi/pengembang dan AUD): tidak ada cara mekanis membedakan "klarifikasi intent" (sah, ARC boleh pertimbangkan) dari "preferensi operasional yang dibungkus sebagai klarifikasi" (tidak sah, ARC harus tolak) — Director bisa menyampaikan keduanya dengan kalimat yang terdengar sama.

**Mitigasi yang diusulkan AUD** (putaran kedua): ARC tidak memutuskan sendiri mana yang berlaku. ARC **bertanya balik** ke Director secara eksplisit: *"Apakah ini klarifikasi terhadap intent yang sudah dikunci, atau perubahan intent?"* Kalau Director menjawab "perubahan" → ARC merekomendasikan chain baru. Ini memindahkan beban klasifikasi ke Director sendiri (yang memang berwenang penuh atas jawabannya), mengurangi — bukan menghilangkan — area abu-abu. Residual risk tetap diakui terbuka: pada akhirnya ini bergantung pada integritas ARC menilai jawaban Director dengan jujur, sama seperti Sigma sudah mempercayakan independensi ke AUD hari ini.

### Traceability lewat `sigma send` — sudah gratis, tidak perlu dibangun baru

AUD mencatat: kalau Petition dikirim lewat `sigma send`, Sigma otomatis punya jejak siapa meminta, alasannya, dan kenapa ditolak/diterima — tanpa infrastruktur baru, karena `sigma send`/`sigma inbox` + `operations.jsonl` sudah mencatat semua invokasi. **Satu tambahan kecil yang diminta AUD**: ARC wajib menyertakan alasan singkat setiap kali menolak Petition (mis. *"Evidence provided does not challenge the basis of the current evaluation"* atau *"This evidence was already considered during Evaluation #1"*) — supaya pemohon tahu kenapa ditolak, bukan sekadar "reject" tanpa penjelasan.

### Perbedaan pendapat terbuka: kapan Admission Review dipetakan ke command CLI?

Ini **satu-satunya titik di mana AI teknisi/pengembang dan AUD tidak sepakat**, dan sengaja dicatat sebagai perbedaan terbuka, bukan dipaksa jadi konsensus palsu:

- **AI teknisi/pengembang**: mengusulkan Admission Review perlu dipetakan ke command/format terstruktur (bukan cuma pesan bebas lewat `sigma send`) sebelum masuk `PLAN-EVAL`, supaya statusnya (accepted/rejected) bisa diperiksa sistem tanpa membaca ulang seluruh mailbox.
- **AUD**: menahan diri secara sengaja — mengusulkan Admission Review dibiarkan matang dulu sebagai **governance/prosa** (dijalankan manual lewat `sigma send` biasa) sebelum dipikirkan bentuk command-nya (`sigma petition`, atau tetap `sigma send`, atau sesuatu yang lain). Alasan: kalau command dibuat terlalu awal padahal governance-nya belum stabil, command itu ikut berubah-ubah mengikuti governance yang masih bergerak — pemborosan kerja teknis.

**Belum diputuskan** — ini eksplisit ditinggalkan sebagai keputusan Director, bukan diselesaikan sepihak oleh salah satu pihak.

### Perluasan pola: bukan fitur closure, tapi pola governance generik (catatan AUD, belum di-scope)

AUD mengangkat: pola Petition → Admission → Re-review ini berpotensi lebih besar dari sekadar closure — bisa dipakai untuk menantang finding AUD sendiri (FMN mengajukan evidence baru terhadap temuan AUD), atau interaksi role lain. **Untuk proposal ini, pola dibatasi ke re-evaluasi skor ARC saja** — perluasan ke domain lain dicatat sebagai kemungkinan arsitektur masa depan, bukan bagian dari scope `PLAN-EVAL` yang akan disusun dari diskusi ini.

### Siapa mengaudit ARC? (open item baru dari AUD)

Pertanyaan yang muncul dari AUD setelah membaca respons AI teknisi/pengembang: kalau ARC punya wewenang menolak Petition, siapa memastikan ARC tidak menolak semua permintaan karena malas atau bias, bukan karena evidence memang tidak cukup? AUD mengusulkan cakupan audit AUD diperluas: bukan mengaudit **skornya**, tapi mengaudit **konsistensi Admission Decision ARC terhadap evidence yang diajukan**. Ini perlu ditambahkan ke `AUD-RULE.md` §4 (DIR-CLOSE Audit) atau bagian scope audit yang relevan — belum dirancang detailnya, dicatat sebagai open item (Section 9).

---

## 7. Contoh Nyata yang Dipakai untuk Menguji Konsep

Untuk menghindari desain yang cuma masuk akal di kasus sederhana (website marketplace), dilakukan pengecekan silang terhadap `DIR-INTENT-v2.md` proyek nyata `I:\Works\Project\KLHK_JasaLingkunganHidup` (riset ilmiah naskah akademik JLH untuk KLHK).

Pemetaan section template `DIR-INTENT` ke dua kategori:

**Mendefinisikan OUTPUT**: §1.4 Desired Outcome, §1.5 Primary Value Delivered, §3.1 Concrete Outcome, §3.2 Success Threshold, §3.3 Measurement Method, §6.1/6.2 Scope Boundary, §9 Functional Requirements (REQ-xxx + Acceptance Criteria).

**Mendefinisikan PROSES**: §1.6 (di kasus KLHK — "Prinsip Epistemik", guardrail soal cara menyimpulkan, bukan hasil akhirnya), §6.3 Non-Goals, §7 Constraints & Preferences, §8 Technical & Architecture Direction (assumptions, rejected approaches), §10 Risk & Failure Definition, §11 Execution Direction for FMN.

**Temuan penting dari contoh ini**: pada proyek riset seperti KLHK, kalau tim menghasilkan output yang eksis dan lengkap secara bentuk (naskah + data JLH ada) tapi caranya menyusun kesimpulan melanggar guardrail proses (mis. diam-diam memilih mempertahankan metode lama dulu, baru mencari literatur pembenar — persis yang dilarang §1.6 dan §6.3) — itu **kegagalan paling fatal** dari sudut pandang INTENT tersebut, walau ukuran "apakah output eksis" akan terlihat baik-baik saja. Ini **menguatkan** (bukan melemahkan) desain skor bertingkat di atas: proses harus tetap dinilai serius sebagai lapisan tersendiri (50-100), bukan modifier kecil, karena untuk sebagian proyek (riset/ilmiah) integritas proses adalah **inti alasan INTENT itu ada** — sementara di proyek lain (mis. produk software sederhana) proses nyaris tidak relevan terhadap penilaian closure. Model bertingkat (output dulu penuh, baru proses menambah) tetap valid untuk kedua jenis proyek karena tidak memaksa proses mengompensasi output yang belum lengkap, dan tidak memaksa output tinggi otomatis berarti proses aman.

---

## 8. Ringkasan Audit AUD (Dua Putaran)

### Putaran pertama — Verdict: PASS_WITH_RISK

**Insight utama AUD**: proposal ini sebenarnya bukan mendesain ulang closure — ini mendesain **Continuous Intent Evaluation**. Closure lama: BUILD selesai → DIR-CLOSE → Lock. Closure baru: BUILD → ARC terus mengevaluasi → skor berubah → close hanyalah formalisasi terakhir.

**Yang didukung penuh**: ARC sebagai bookend (bukan karena senioritas, tapi karena pemilik kontrak intent sejak awal); skor tidak menggerbangi `close lock` (menjaga final authority Director); model output-dulu-baru-proses (menolak pola umum "output 50% + process 50%" yang bisa meloloskan output gagal asal proses bagus); tidak ada mekanisme override untuk skor < 50 (konsisten filosofi multi-chain); studi kasus KLHK sebagai validasi paling kredibel di seluruh dokumen.

**Tiga kekhawatiran**: (1) Goodhart's Law — skor berisiko jadi KPI yang dikejar, bukan lagi representasi evaluasi; (2) presisi angka semu — beda operasional 61 vs 63 dipertanyakan; (3) identitas ARC bergeser dari architect ke assessor, perlu ditulis hati-hati di rule.

**Satu tantangan konseptual**: apakah "otorisasi-commit" benar-benar kelas baru, atau sekadar Operational Write — mengingat risiko proliferasi kelas otorisasi kalau tiap command baru dapat kelasnya sendiri.

**Satu kekurangan dicatat**: trend vs snapshot — nilai continuous evaluation ada di trennya, bukan angka terakhir saja; `operations.jsonl` menyimpan riwayat tapi tidak otomatis "terlihat."

### Klarifikasi Director yang mengubah arah audit

Dipicu pertanyaan langsung Director: *"apa yang terjadi jika saya dan ARC berbeda pendapat, saya ingin ARC menjadi bias demi memenuhi hasrat saya ingin menutup?"* — dengan penegasan dua jalan keluar yang sah (plan+exec baru, atau jangan close, skor tetap sama tanpa evidence baru).

### Putaran kedua — Verdict: PASS (Strong Pass)

AUD merevisi pemahamannya secara fundamental: ARC bukan sekadar "evaluator" — ARC adalah **penjaga integritas intent Director, bahkan terhadap Director itu sendiri** (analogi: fiduciary dalam hukum; analogi lain: pengawas kontrak yang tidak bisa dipaksa mengubah penilaian hanya karena pemilik proyek ingin cepat selesai). Prinsip yang dirumuskan: *"ARC is accountable to the locked intent, not to the Director's current preference."* Lihat Section 6 untuk detail lengkap mekanisme Petition/Admission Review yang lahir dari putaran ini.

### Respons balik AI teknisi/pengembang (enam poin kritik)

Setelah membaca putaran kedua, AI teknisi/pengembang memberi enam poin kritik terhadap audit AUD sendiri, alih-alih menerima mentah-mentah — termasuk **merevisi rekomendasi sendiri** soal "otorisasi-commit" (mengakui tantangan AUD benar, kelas itu dilebur ke Approval-class dengan catatan semantik, bukan kelas keempat). Enam poin: (1) revisi otorisasi-commit, (2) mitigasi Goodhart's Law lewat kewajiban menyertakan alasan, (3) representasi band vs angka mentah, (4) Admission Review masih prosa — perlu command sebelum `PLAN-EVAL`, (5) trend vs snapshot ditunda ke `PLAN-EVAL` lanjutan, (6) risiko "preference dibungkus sebagai klarifikasi" diakui sebagai residual risk yang tidak bisa ditutup aturan, hanya bisa dipercayakan ke integritas ARC.

### AUD putaran ketiga — respons atas kritik, verdict akhir dikonfirmasi PASS (Strong Pass)

AUD menerima lima dari enam poin, memperhalus satu ("Authority vs Truth" → "Authority cannot rewrite recorded truth" — lihat Section 6), **secara sengaja tidak sepakat** dengan satu poin (command Admission Review sebaiknya ditunda sampai governance matang, bukan dipetakan sekarang — lihat Section 6, dicatat sebagai perbedaan pendapat terbuka, bukan dipaksa konsensus). AUD menambah dua hal baru: mekanisme "ARC bertanya, bukan memutuskan sendiri" untuk klarifikasi-vs-perubahan (Section 6), dan pertanyaan baru "siapa mengaudit ARC" (Section 6, dicatat sebagai open item).

**Insight penutup AUD**: closure bergeser makna dari "Close Project" menjadi **"Resolve Contract."** Dan satu triad yang diusulkan sebagai fondasi arsitektur: Sigma punya tiga mekanisme yang harus tetap terpisah — **Evidence** (dasar objektif evaluasi), **Authority** (siapa berhak memutuskan arah proyek — Director), **Integrity** (kewajiban AI role mempertahankan penilaian jujur terhadap evidence dan kontrak yang berlaku). Begitu salah satu mulai mengambil peran yang lain — authority mengubah integrity, atau evidence diabaikan demi preferensi — checks and balances Sigma kehilangan kekuatannya.

---

## 9. Hal yang Sudah Diputuskan (Explicit Director Decisions)

1. Wewenang operasional CLI `close` pindah dari FMN ke ARC. Model otorisasi per-command (read-only bebas, lock butuh approval eksplisit) **tidak berubah** dari yang berlaku untuk FMN hari ini.
2. Skor ARC **tidak** menggerbangi `close lock` — hanya menggerbangi `sigma close new`.
3. Skor bersifat tidak final, dapat dinilai ulang seiring PLAN/EXEC baru.
4. Skor mencakup **seluruh riwayat plan dalam satu chain intent version**, bukan cuma rantai bersih terakhir.
5. Skala 0-100 bertingkat: 0-50 = output satisfied (harus penuh untuk lolos), 50-100 = process satisfied (murni penambah di atas output yang sudah penuh).
6. Ambang gerbang `close new`: skor ≥ 50. Ambang rekomendasi positif ARC: skor ≥ 80. Zona 50-79: gerbang terbuka tapi ARC tidak merekomendasikan; Director tetap bisa lanjut via instruksi eksplisit biasa.
7. **Tidak ada mekanisme override baru** untuk skor < 50 — chain boleh dibiarkan tidak tertutup selamanya; multi-chain-version sudah jadi katup pelepasnya.
8. Template `DIR-CLOSE` perlu direvisi ulang agar selaras dengan mekanisme ini — **secara eksplisit ditunda**, bukan dikerjakan sekarang.
9. Skor disimpan sebagai dua kolom baru (Skor Evaluasi, Catatan) di `Sigma/design/intent-history.md`, ditulis lewat command baru `sigma intent score <n> --notes "..."`. `--notes` mengikuti sanitasi yang sama dengan `sigma intent new --title/--focus` (tolak `|` dan newline). Tabel menyimpan nilai terkini saja; riwayat lengkap penilaian mengandalkan `Sigma/logs/operations.jsonl`.
10. Hak baca ARC atas riwayat plan/exec: otonomi penuh saat dipicu frasa "evaluasi project ini" / "Evaluate this project", tanpa otorisasi per-command.
11. `sigma intent score` **direvisi jadi Approval-class** (bukan kelas keempat "otorisasi-commit" seperti draf awal), dengan catatan semantik eksplisit: Director menyetujui tindakan mencatat, bukan kelayakan isi skornya.
12. Mandatory Message Trigger baru: ARC → FMN, dipicu tiap pasangan plan+exec LOCKED baru (soft guidance, bukan hard gate, untuk re-evaluasi di versi yang sama). Isi minimal: skor (sebagai band), versi plan+exec dasar penilaian, kekurangan vs INTENT (retrospektif, bukan checklist), alasan skor. Parameter `sigma send --type CHECK --action REVIEW`.
13. Skor ditampilkan ke Director/FMN sebagai **band** (`OUTPUT_INCOMPLETE` / `SATISFIED_NEEDS_REVIEW` / `SATISFIED_RECOMMENDED`), angka mentah jadi detail sekunder — mitigasi presisi semu dan Goodhart's Law.
14. ARC dilarang memberi checklist prospektif ("lakukan ini supaya jadi 80") — hanya boleh menjelaskan evaluasi retrospektif ("kenapa sekarang 72").
15. Mekanisme **Petition → Admission Review → Re-evaluation** diadopsi untuk permintaan re-evaluasi skor, berlaku simetris untuk FMN dan Director (bukan Director otomatis dilayani). Prinsip: "Authority cannot rewrite recorded truth." Dua jalan keluar wajib ditawarkan ARC saat menolak: plan+exec baru, atau chain baru. ARC wajib menyertakan alasan singkat setiap penolakan.
16. Untuk kasus ambigu klarifikasi-vs-perubahan intent, ARC bertanya eksplisit ke Director untuk mengklasifikasikan sendiri — bukan ARC menyimpulkan sepihak.
17. Pola Petition/Admission Review **dibatasi ke re-evaluasi skor ARC saja** untuk proposal ini — perluasan ke domain lain (mis. menantang finding AUD) dicatat sebagai kemungkinan masa depan, bukan bagian scope sekarang.

---

## 10. Titik yang Belum Diputuskan / Belum Dibahas Tuntas (Open Items untuk Director atau Diskusi Lanjutan)

Dicatat apa adanya, tanpa rekomendasi solusi — ini murni daftar celah yang perlu diisi sebelum mekanisme ini bisa dituangkan menjadi `PLAN-EVAL`:

1. **Definisi Gate baru di `SIGMA_PROTOCOL.md` §7** — perlu entri formal "Gate 3.5" (nama sementara) dengan precondition, CLI error message, dan posisi eksplisit relatif terhadap Gate 3 yang sudah ada.
2. **Rework template `DIR-CLOSE`** — sudah disepakati perlu terjadi, tapi bentuknya (section baru untuk mencantumkan skor + riwayat penilaian ARC) belum dirancang. Ditunda sesuai instruksi Director.
3. **Daftar frasa pemicu evaluasi yang sah** — "evaluasi project ini" / "Evaluate this project" disebut sebagai pemicu, tapi belum ada daftar frasa setara/cukup seperti yang dimiliki DEV-RULE untuk otorisasi mulai implementasi.
4. **Bahasa otorisasi-commit yang eksplisit** — daftar frasa konkret yang dianggap cukup/tidak cukup untuk sinyal "catat skornya" (dibedakan dari bahasa Approval-class biasa) belum dirumuskan.
5. **Perbedaan pendapat terbuka: kapan Admission Review dipetakan ke command CLI** — AI teknisi/pengembang mengusulkan sekarang, AUD mengusulkan ditunda sampai governance matang sebagai prosa. **Belum diputuskan Director.** (Section 6)
6. **Siapa mengaudit konsistensi Admission Decision ARC** — pertanyaan baru dari AUD putaran kedua. Perlu diputuskan apakah ini masuk scope `AUD-RULE.md` §4 (DIR-CLOSE Audit) yang sudah ada, atau scope baru. Belum dirancang detail mekanismenya. (Section 6)
7. **`sigma intent score --history`** (atau command sejenis untuk melihat tren skor, bukan cuma nilai terakhir) — diusulkan AUD, disepakati sebagai kebutuhan nyata tapi ditunda ke `PLAN-EVAL` lanjutan, bukan versi pertama.
8. **Konteks insiden hari ini yang relevan tapi belum ditautkan formal**: `Discussion/sigma-bug-report-20260720-131540.md` §13.2/§14 mencatat insiden FMN berhalusinasi punya wewenang merencanakan `DIR-CLOSE` di sesi lain hari ini — bukan bug di mesin closure itu sendiri, tapi memperkuat motivasi mengapa batas wewenang closure (siapa yang boleh apa) perlu ditegaskan ulang secara eksplisit di rule, bukan diserahkan ke inferensi role.

---

*Dokumen ini murni catatan hasil diskusi untuk keperluan audit AUD sebelum penyusunan `PLAN-EVAL`. Tidak mengikat siapa pun, tidak mengubah runtime state proyek manapun.*
