# PLAN-EVAL-04 — Petition / Admission Review Mechanism

**Sumber**: [../../Discussion/closure-authority-and-arc-scoring-proposal-20260720.md](../../Discussion/closure-authority-and-arc-scoring-proposal-20260720.md) Section 6, keputusan #15–#17 (Section 9), open items #5–#6 (Section 10).
**Tanggal**: 2026-07-20
**Status**: DRAFT — belum dieksekusi, menunggu otorisasi eksplisit Director. **Bagian ini juga punya perbedaan pendapat terbuka yang belum diputuskan Director** (lihat §3 di bawah) — dianggap paling belum-matang dari keempat PLAN-EVAL di folder ini.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.
**Dependency**: PLAN-EVAL-02 (band skor yang direferensikan), PLAN-EVAL-03 (trigger yang bisa memicu Petition).

---

## Inti

Mekanisme ini murni hasil audit AUD putaran kedua, dipicu pertanyaan
Director: *"apa yang terjadi jika saya dan ARC berbeda pendapat, dan saya
ingin ARC menjadi bias demi memenuhi hasrat saya ingin menutup?"*

Prinsip inti: **"Authority cannot rewrite recorded truth."** Director tetap
memegang authority penuh (mulai chain baru, menghentikan proyek, mengubah
intent) — yang tidak boleh adalah mengubah evaluasi historis terhadap
kontrak yang sudah dikunci tanpa evidence baru. Implikasinya: ARC tidak
mewakili Director hari ini — ARC mewakili Director yang telah mengunci
`DIR-INTENT`.

Model tiga tahap: **Petition** (FMN atau Director) → **Admission Review**
(ARC menilai: evidence cukup untuk membuka evaluasi ulang?) → jika ya,
**Re-evaluation** (ARC menilai ulang skor). Dua keputusan ini sengaja
dipisah — "layak dievaluasi ulang?" vs "setelah melihat evidence, apakah
evaluasi berubah?"

**Perlakuan simetris FMN vs Director**: keduanya lewat Admission Review
yang sama. Director **tidak** otomatis dilayani hanya karena posisinya.
Satu-satunya pembeda sah: Director bisa mengubah **intent itu sendiri**
(chain/intent version baru, hak eksklusif) — tapi tidak bisa memaksa ARC
mengubah evaluasi terhadap intent yang sudah dikunci tanpa evidence baru
yang genuin. Istilah baku: **"Right to Petition"**, bukan "Right to
Re-evaluation."

---

## Scope perubahan file

### 1. `Sigma/rules/ARC-RULE.md` — section baru "Petition / Admission Review"

Ditempatkan setelah §Escalation Path (baris ~377-400) atau sebagai section
mandiri sebelum §Final Doctrine (baris ~548), berisi minimal:

- **Model tiga tahap** (Petition → Admission Review → Re-evaluation) persis
  seperti diagram di dokumen sumber §6.
- **Dua jalan keluar wajib** yang selalu ditawarkan ARC saat menolak
  (Admission Review gagal, atau Re-evaluation tidak mengubah skor):
  1. Lanjutkan chain ini — ajukan plan+exec baru yang benar-benar mendekati
     intent yang dikunci.
  2. Mulai chain baru — kalau tujuan/standar keberhasilan memang ingin
     berubah, itu hak Director, tapi lewat intent baru.
- **Kewajiban menyertakan alasan singkat** setiap kali ARC menolak Petition
  (mis. *"Evidence provided does not challenge the basis of the current
  evaluation"* atau *"This evidence was already considered during Evaluation
  #1"*) — supaya pemohon tahu kenapa ditolak, bukan sekadar "reject" tanpa
  penjelasan.
- **Mekanisme "ARC bertanya, bukan memutuskan sendiri"** untuk kasus ambigu
  klarifikasi-vs-perubahan intent: ARC wajib bertanya balik secara eksplisit
  ke Director — *"Apakah ini klarifikasi terhadap intent yang sudah
  dikunci, atau perubahan intent?"* Kalau Director menjawab "perubahan" →
  ARC merekomendasikan chain baru. Beban klasifikasi dipindah ke Director
  sendiri, bukan disimpulkan sepihak oleh ARC.
- **Batasan scope eksplisit**: pola ini **hanya** berlaku untuk re-evaluasi
  skor ARC dalam konteks closure — bukan pola governance generik untuk
  domain lain (mis. menantang finding AUD). Perluasan itu dicatat AUD
  sebagai kemungkinan arsitektur masa depan, bukan bagian scope di sini.
- **Traceability**: Petition dikirim lewat `sigma send` biasa (lihat §2 di
  bawah untuk parameter) — jejak siapa meminta, alasan, dan kenapa
  ditolak/diterima sudah otomatis tercatat lewat `sigma inbox` +
  `Sigma/logs/operations.jsonl`, tidak butuh infrastruktur pelacakan baru.

### 2. Parameter `sigma send` untuk Petition — **belum ditetapkan di dokumen sumber**

Berbeda dari Trigger 2 (PLAN-EVAL-03) yang parameternya sudah eksplisit
(`--type CHECK --action REVIEW`), dokumen sumber **tidak** menentukan
parameter `sigma send` untuk Petition itu sendiri (baik dari FMN maupun
Director ke ARC). Draf rekomendasi (perlu dikonfirmasi Director, bukan
diasumsikan final):

```
sigma send --from <fmn|director-proxy> --to arc --type QUESTION --action RESPOND \
  --subject "Petition: request re-evaluation of ARC score <version>" \
  --message "<evidence/rationale>"
```

`QUESTION` dipilih (bukan `CHECK`/`RISK`) karena Petition pada dasarnya
meminta ARC memutuskan sesuatu (Admission), bukan melaporkan status — tapi
ini rekomendasi AI teknisi/pengembang, **bukan keputusan Director** yang
sudah dikonfirmasi seperti Trigger 2. Perlu dikonfirmasi sebelum bagian ini
ditulis final di `ARC-RULE.md`.

### 3. Perbedaan pendapat terbuka: kapan Admission Review dipetakan ke command CLI?

Ini satu-satunya titik di seluruh diskusi sumber di mana AI teknisi/
pengembang dan AUD **tidak sepakat**, dan Director **belum memutuskan**
(Section 10 open item #5):

- **Opsi A** (diusulkan AI teknisi/pengembang): petakan Admission Review ke
  command/format terstruktur (mis. `sigma petition`) sebelum masuk versi
  final — supaya status accepted/rejected bisa diperiksa sistem tanpa
  membaca ulang seluruh mailbox.
- **Opsi B** (diusulkan AUD, direkomendasikan tetap dipertahankan di plan
  ini): biarkan Admission Review matang dulu sebagai governance/prosa,
  dijalankan manual lewat `sigma send` biasa, sebelum bentuk command-nya
  dipikirkan. Alasan: command yang dibuat terlalu awal padahal
  governance-nya belum stabil akan ikut berubah-ubah mengikuti governance
  yang masih bergerak.

**Rekomendasi plan ini**: ikuti Opsi B untuk rilis pertama (murni
prosa/`sigma send`) — bukan karena Opsi A salah, tapi karena berkomitmen ke
command sebelum governance ini pernah dijalankan sungguhan di proyek nyata
berisiko membangun command yang bentuknya salah. **Ini tetap rekomendasi,
bukan keputusan** — Director perlu mengonfirmasi arah sebelum bagian ini
dieksekusi.

### 4. `Sigma/rules/AUD-RULE.md` §4 DIR-CLOSE Audit — perluasan scope

Section "### DIR-CLOSE Audit Focus" (baris ~554-558) mendapat bullet baru:

> - Is ARC's pattern of Admission Decisions (accept/reject Petitions)
>   consistent with the evidence presented — not merely "does AUD agree
>   with the score," but "is ARC accepting/rejecting Petitions for reasons
>   that track evidence, not convenience or bias."

**Ini bukan mengaudit skornya** (itu tetap wewenang evaluatif ARC yang tidak
diaudit isi-substansinya oleh AUD) — murni mengaudit **konsistensi proses**
Admission Decision terhadap evidence yang diajukan. Dokumen sumber mencatat
ini sebagai open item baru dari AUD (Section 10 poin #6): "mekanisme
detailnya belum dirancang" — bullet di atas adalah titik masuk minimal,
**bukan** desain lengkap. Kandidat pertanyaan lanjutan yang belum dijawab:
apakah AUD mengaudit setiap Admission Decision, atau sampling; apakah ada
ambang jumlah penolakan berturut-turut yang memicu audit otomatis.

### 5. `Sigma/rules/FMN-RULE.md` — pointer kecil

Subsection "With ARC" (baris ~313-322) dan §Escalation Path (baris
~360-384) mendapat satu kalimat pointer: kalau FMN tidak setuju dengan skor
ARC, jalurnya adalah Petition (rujuk `ARC-RULE.md` §Petition/Admission
Review) — bukan mengulang argumen di pesan bebas berharap ARC berubah
pikiran tanpa evidence baru.

---

## Yang **tidak berubah**

- Skor tetap sama selama tidak ada plan+exec baru yang benar-benar
  memenuhi evaluasi ARC — Petition yang ditolak tidak mengubah apa pun di
  `chain.intent.arc_score`.
- AUD tetap advisory-only terhadap keseluruhan mekanisme ini — perluasan
  scope audit di §4 di atas tidak memberi AUD wewenang lock/block, hanya
  wewenang melapor temuan ke Director (konsisten dengan batasan AUD yang
  sudah ada).

## Risiko & residual risk yang diakui terbuka (tidak bisa ditutup aturan)

- **Preference dibungkus sebagai klarifikasi**: tidak ada cara mekanis
  membedakan "klarifikasi intent yang sah" dari "preferensi operasional
  yang dibungkus sebagai klarifikasi" — Director bisa menyampaikan
  keduanya dengan kalimat yang terdengar sama. Mekanisme "ARC bertanya"
  (§1 di atas) mengurangi, **bukan menghilangkan**, area abu-abu ini.
  Residualnya bergantung pada integritas ARC menilai jawaban Director
  dengan jujur — sama seperti Sigma sudah mempercayakan independensi ke
  AUD hari ini. Ini diakui eksplisit sebagai batas desain, bukan
  kekurangan implementasi yang bisa "diperbaiki nanti".

## Langkah selanjutnya

Bukan untuk dieksekusi langsung. Menunggu, secara berurutan: (1) Director
memutuskan arah §3 (Opsi A vs Opsi B — command CLI kapan), (2) Director
mengonfirmasi/mengoreksi parameter `sigma send` rekomendasi di §2, (3)
otorisasi eksplisit Director untuk mulai edit `ARC-RULE.md`/`AUD-RULE.md`/
`FMN-RULE.md`. Dari keempat PLAN-EVAL di folder ini, dokumen ini paling
membutuhkan diskusi lanjutan sebelum layak dieksekusi — bukan karena
kualitas analisisnya lebih rendah, tapi karena dokumen sumbernya sendiri
mencatat titik ini sebagai belum diputuskan, bukan sekadar belum
didetailkan.
