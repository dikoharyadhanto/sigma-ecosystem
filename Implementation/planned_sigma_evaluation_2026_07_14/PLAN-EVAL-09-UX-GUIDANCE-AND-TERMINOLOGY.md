# PLAN-EVAL-09 — Perbaikan UX Guidance & Konsolidasi Terminologi Sigma

**Sumber**: `Discussion/sigma-system-evaluation-2026-07-14.md` (Topik 8 — Evaluasi UX: Guidance & Komunikasi AI Role terhadap User Baru, Terminologi Sigma)
**Tanggal**: 2026-07-14
**Status**: DRAFT FOR REVIEW
**Urutan eksekusi**: Ditambahkan setelah 8 dokumen plan awal (lihat catatan sequencing di bawah) — bukan bagian dari urutan #1–#8 asli di `README.md` folder ini, karena Topik 8 baru dibuka Director setelah sesi evaluasi awal ditutup.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN, tidak punya otoritas lock/gate Sigma.

---

## Objective

Menjalankan 2 tweak komunikasi kecil (bukan perubahan doktrin/protokol) yang
dikunci Director untuk memperbaiki pengalaman user baru saat berinteraksi
dengan AI role Sigma, dan mengonsolidasikan tabel "Human Label" yang saat ini
terduplikasi di beberapa file skill menjadi satu sumber rujukan.

Skala perbaikan **sengaja dipersempit** oleh Director setelah menimbang audit
AUD eksternal — rencana propagasi 4-layer (PROTOCOL + RULE + skill + bridge)
dan opsi menaikkan "Director-First Communication" ke tier doktrin
(`SIGMA_PROTOCOL.md` §4.0b) **ditarik kembali** karena dinilai terlalu besar
untuk skala masalah yang sebenarnya sempit.

---

## Latar Belakang

Director menjalankan simulasi user baru (fresh project, belum pernah pakai
Sigma) memakai Claude sebagai AI role Sigma, dimulai dari `sigma project
start`. Dari transcript simulasi, Director mengidentifikasi 2 masalah:
1. Komunikasi AI role kurang *guidance* dan komunikatif terhadap user baru.
2. Istilah/term Sigma (ARC, FMN, DEV, AUD, DIR-INTENT, dst.) berpotensi
   membingungkan user baru.

### Bukti Konkret dari Simulasi (diverifikasi ke kode)

- User bertanya "gimana cara pakainya" → dijawab langsung dengan seluruh
  lifecycle (START→DESIGN→BUILD→CLOSE) + 4 role sekaligus, memaksa user
  bertanya mundur 3 kali berurutan sebelum bisa maju lagi.
- `sigma project start` ([project.ts:269](../../src/commands/project.ts#L269))
  hanya mencetak pesan generik: `Next: Run \`sigma session bootstrap\` or
  \`sigma project status\` to confirm state.` — tidak ada guidance spesifik
  fase.
- Skill `arc.md` ([setup/targets/claude_code/arc.md:51](../../setup/targets/claude_code/arc.md#L51)),
  Role Activation langkah 2: *"Stop and ask whether the Director wants to
  open a new DIR-INTENT"* — dilontarkan tanpa didahului penjelasan singkat
  "ARC itu role apa"/"DIR-INTENT itu apa". Pola aktivasi yang sama juga
  ditemukan di `fmn.md`, `dev.md`, `aud.md` (lihat referensi masing-masing
  di [fmn.md:49-54](../../setup/targets/claude_code/fmn.md#L49-L54),
  [dev.md:50-55](../../setup/targets/claude_code/dev.md#L50-L55),
  [aud.md:86-90](../../setup/targets/claude_code/aud.md#L86-L90)).
- Output mentah `sigma memory --arc` sempat tampil apa adanya ke user pemula
  — detail operasional internal yang seharusnya tidak perlu terlihat.

### Audit Eksternal (AUD, direlay Director)

**Verdict AUD: PASS.** User baru bisa sampai ke aktivasi ARC tanpa membuka
dokumentasi — dianggap keberhasilan berarti. Satu opportunity berbobot besar:
urutan penjelasan artifact baru masih "definisi dulu, baru manfaat" — AUD
mengusulkan dibalik jadi **Director-First Communication**: (1) kenapa ini
dilakukan, (2) apa yang terjadi selanjutnya, (3) baru nama Sigma-nya.

### Kalibrasi Ulang Director

Director menilai hasil simulasi **sudah cukup baik** (selaras verdict PASS
AUD) — perbaikan yang dibutuhkan **kecil**. Fokus dipersempit ke 2 tweak teks
di skill file yang sudah ada, bukan entri baru di `SIGMA_PROTOCOL.md` atau
`Sigma/rules/*-RULE.md`.

---

## Keputusan Final

1. **Tweak #1 — Kalimat pembuka onboarding**: perbaiki respons pertama saat
   user bertanya "cara pakai" — cukup next-step + 1 baris fungsi role, bukan
   seluruh lifecycle + 4 role sekaligus.
2. **Tweak #2 — Urutan penjelasan first-mention**: saat artifact/istilah
   Sigma disebut pertama kali, urutannya kenapa/manfaat dulu, nama Sigma
   belakangan (bukan definisi dulu).
3. Kedua tweak **cukup ditulis sebagai contoh kalimat** di bagian
   "Director-Facing Communication Rules" pada `arc.md`, direplikasi ke
   `fmn.md`/`dev.md`/`aud.md` — **tidak** ada entri baru di
   `SIGMA_PROTOCOL.md` atau `Sigma/rules/*-RULE.md`.
4. **Wording Human Label dikunci**: pakai apa adanya yang sudah tertulis di
   `SIGMA_PROTOCOL.md` §5.8 ([SIGMA_PROTOCOL.md:327-337](../../Sigma/SIGMA_PROTOCOL.md#L327-L337)).
   Director menolak usulan wording Indonesia ("Dokumen Intent", "Kontrak
   Kerja/Plan", dst.) sebagai pengganti. Ini otomatis menyelesaikan isu
   "pilih satu label FMN-PLAN" — tetap "Plan Doc", tidak digabung dengan
   alternatif lain.
5. **Konsolidasi sumber label** — `SIGMA_PROTOCOL.md` §5.8 tetap jadi
   satu-satunya canonical source. File skill yang menduplikasi tabel ini
   sebaiknya merujuk ke §5.8 alih-alih menyalin ulang isi tabel.

### Koreksi Cakupan Duplikasi (temuan verifikasi tahap plan ini)

Dokumen sumber evaluasi menyebut "6 skill file" penduplikasi tabel Human
Label (`arc.md`, `fmn.md`, `dev.md`, `aud.md`, `sigma-test.md`, `report.md`).
Diverifikasi ulang saat menyusun plan ini — **cakupan riil hanya 4 file**:

| File | Tabel penuh "Use this / Not this"? | Catatan |
|---|---|---|
| `setup/targets/claude_code/arc.md` | Ya, [baris 74-85](../../setup/targets/claude_code/arc.md#L74-L85) | Bagian "Director-Facing Communication Rules" |
| `setup/targets/claude_code/fmn.md` | Ya, [baris 75-86](../../setup/targets/claude_code/fmn.md#L75-L86) | sda |
| `setup/targets/claude_code/dev.md` | Ya, [baris 76-87](../../setup/targets/claude_code/dev.md#L76-L87) | sda |
| `setup/targets/claude_code/aud.md` | Ya, [baris 117-128](../../setup/targets/claude_code/aud.md#L117-L128) | sda |
| `setup/targets/claude_code/sigma-test.md` | **Tidak** | Hanya 1 contoh inline "Intent Doc (DIR-INTENT v1) → Plan Doc (FMN-PLAN v1)" di template output ([baris 83](../../setup/targets/claude_code/sigma-test.md#L83)) — bukan tabel duplikat, tidak perlu diubah. |
| `setup/targets/claude_code/report.md` | **Tidak** | Tidak ditemukan tabel maupun contoh label — tidak perlu diubah. |

Task breakdown di bawah menyesuaikan cakupan riil (4 file), bukan 6.

### Catatan Overlap dengan Plan Lain (bukan dikerjakan di sini)

- Baris `| Context Handoff (CSO) | CSO |` di 4 file skill di atas, dan baris
  `| Context Handoff | CSO |` + seluruh Section 5.5 di `SIGMA_PROTOCOL.md`,
  **sudah tercakup di scope PLAN-EVAL-05** (CSO removal, Tahap 1 "grep
  menyeluruh... skill directory Claude Code" dan Tahap 4 "hapus referensi CSO
  di seluruh bagian yang relevan"). **Tidak dikerjakan ulang di plan ini**
  untuk menghindari duplikasi kerja/conflict edit pada baris yang sama.
- Bahasa label ini (Indonesia/Inggris) kemungkinan mengikuti
  `interaction_language`, bukan `document_language` — karena label dipakai
  dalam percakapan lisan ke Director, bukan prosa artefak formal. Ini
  **keputusan terbuka**, berkaitan dengan skema bahasa `project.config.json`
  hasil PLAN-EVAL-06. **Tidak diputuskan/dieksekusi di plan ini** — dicatat
  sebagai follow-up lintas-plan (lihat "Dependency Catatan").

---

## Task Breakdown

**Tahap 1 — Tweak Onboarding (arc.md sebagai master, replikasi ke 3 file lain)**
- [ ] Tambahkan 1-2 contoh kalimat pembuka onboarding di bagian
      "Director-Facing Communication Rules" `arc.md`: next-step ringkas + 1
      baris fungsi role saat user bertanya "cara pakai", bukan seluruh
      lifecycle + 4 role sekaligus.
- [ ] Replikasi pola yang sama (disesuaikan konteks role) ke `fmn.md`,
      `dev.md`, `aud.md`.

**Tahap 2 — Tweak First-Mention Ordering**
- [ ] Tambahkan 1 contoh kalimat "kenapa/manfaat dulu, nama Sigma belakangan"
      saat istilah/artefak Sigma disebut pertama kali, di `arc.md`.
- [ ] Replikasi ke `fmn.md`, `dev.md`, `aud.md`.

**Tahap 3 — Konsolidasi Tabel Human Label (4 file, bukan 6 — lihat koreksi cakupan di atas)**
- [ ] Ubah tabel penuh "Use this / Not this" di `arc.md` (baris 74-85),
      `fmn.md` (baris 75-86), `dev.md` (baris 76-87), `aud.md` (baris
      117-128) menjadi rujukan singkat ke `Sigma/SIGMA_PROTOCOL.md` §5.8,
      bukan salinan penuh tabel.
- [ ] Pastikan bentuk rujukan tetap actionable untuk AI role (mis. tetap
      cantumkan aturan "gunakan human label, bukan artifact code" secara
      eksplisit + pointer ke §5.8 untuk daftar lengkap) — jangan sampai
      konsolidasi membuat instruksi jadi kurang jelas dibanding tabel penuh.
- [ ] Jangan ubah/hapus baris `Context Handoff (CSO)` di keempat file ini
      sebagai bagian plan ini — biarkan tertangani oleh PLAN-EVAL-05 (lihat
      "Catatan Overlap" di atas). Jika PLAN-EVAL-05 sudah dieksekusi lebih
      dulu, baris ini seharusnya sudah hilang sebelum tahap ini berjalan.

**Tahap 4 — Verifikasi**
- [ ] Baca ulang keempat file skill setelah perubahan — pastikan urutan
      "Role Activation" tidak melompat ke pertanyaan prosedural tanpa
      pengantar singkat, sesuai kalibrasi Director (perbaikan kecil, bukan
      restrukturisasi section).
- [ ] Konfirmasi `sigma-test.md` dan `report.md` tetap tidak diubah (tidak
      ada tabel duplikat di keduanya).

**Tahap 5 — Dokumentasi Follow-up Terbuka**
- [ ] Catat eksplisit di `README.md` folder ini (atau di plan lintas-topik
      berikutnya) bahwa keputusan "field bahasa mana yang mengatur Human
      Label" masih terbuka, menunggu Director memutuskan setelah
      PLAN-EVAL-06 selesai — bukan bagian dari acceptance criteria plan ini.

---

## Dependency Catatan

- **Rekomendasi urutan**: kerjakan plan ini **setelah PLAN-EVAL-05** (CSO
  removal) selesai, supaya baris `Context Handoff (CSO)` di 4 file skill
  sudah hilang lebih dulu — menghindari konflik edit pada rentang baris yang
  sama di Tahap 3.
- **Tidak ada dependency teknis** ke PLAN-EVAL-01/02/03/04/07/08 — plan ini
  murni menyentuh file skill Claude Code dan tidak menyentuh command CLI,
  schema, atau `progress.json`.
- **Keterkaitan terbuka dengan PLAN-EVAL-06** (redesain `sigma config`
  bahasa): keputusan final field bahasa untuk Human Label menunggu schema
  3-field dari PLAN-EVAL-06 stabil dulu — dicatat sebagai follow-up, tidak
  memblokir eksekusi plan ini.

---

## Risiko

- Karena skala perbaikan sengaja dipersempit jadi contoh kalimat (bukan
  aturan wajib terstruktur), ada risiko kecil AI role tetap kadang melompat
  ke istilah teknis duluan meski contoh sudah ditambahkan — sifatnya
  guidance, bukan validasi CLI yang bisa dipaksakan.
- Mengubah tabel penuh jadi rujukan singkat berisiko kehilangan
  self-containment file skill (pembaca harus buka `SIGMA_PROTOCOL.md`
  terpisah) — mitigasi: tetap sertakan 1-2 baris contoh paling sering dipakai
  langsung di skill file, bukan rujukan kosong tanpa konteks.
- Jika PLAN-EVAL-05 belum dieksekusi saat plan ini berjalan, Tahap 3 perlu
  menghindari menyentuh baris `Context Handoff (CSO)` secara tidak sengaja
  saat mengganti tabel jadi rujukan — cukup pastikan baris itu tidak ikut
  disalin ke bentuk rujukan baru.

---

## Draft Acceptance Criteria

- [ ] `arc.md`, `fmn.md`, `dev.md`, `aud.md` masing-masing memuat contoh
      kalimat onboarding ringkas (Tweak #1) dan contoh urutan first-mention
      kenapa→nama (Tweak #2) di bagian "Director-Facing Communication
      Rules".
- [ ] Keempat file yang sama tidak lagi menyalin penuh tabel Human Label —
      merujuk ke `Sigma/SIGMA_PROTOCOL.md` §5.8 sebagai sumber tunggal.
- [ ] Tidak ada perubahan pada `SIGMA_PROTOCOL.md` §5.8 wording (dikunci apa
      adanya, sesuai Keputusan Final poin 4).
- [ ] Tidak ada entri baru ditambahkan ke `Sigma/rules/*-RULE.md` atau
      `SIGMA_PROTOCOL.md` sebagai bagian plan ini (skala tetap kecil, sesuai
      kalibrasi Director).
- [ ] `sigma-test.md` dan `report.md` tidak berubah.
- [ ] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja
      disesuaikan di tahap ini (perubahan di plan ini murni konten Markdown
      skill file, kemungkinan besar tidak menyentuh test sama sekali).
