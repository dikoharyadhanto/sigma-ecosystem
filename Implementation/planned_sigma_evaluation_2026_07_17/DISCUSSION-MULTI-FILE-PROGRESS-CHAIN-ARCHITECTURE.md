# DISCUSSION — Multi-File Progress Architecture (Opsi C, lanjutan PLAN-EVAL-02)

**Sumber**: Lanjutan langsung diskusi
[PLAN-EVAL-02](./PLAN-EVAL-02-CHAIN-ACTIVATION-AND-ISOLATION.md) di sesi yang
sama, 2026-07-17, dengan Professional Mode (bukan role governance Sigma).

**Status**: DISCUSSION LOG — **bukan plan implementasi, bukan FMN-PLAN**.
Dokumen ini menangkap keputusan arsitektur yang diambil Director
(Opsi C menggantikan Opsi B di PLAN-EVAL-02), plus analisis skala
perubahan dan isu terbuka baru yang muncul darinya. Director sudah
menyatakan implementasi nyata **akan dipecah jadi beberapa PLAN-EVAL
baru** (numbering belum ditentukan) — dokumen ini bukan salah satunya,
ini catatan keputusan sumber sebelum pemecahan itu terjadi.

**Konsekuensi untuk PLAN-EVAL-02**: dinyatakan **OBSOLETE** oleh Director.
Opsi B (nested `chains: Record<string, ChainState>` dalam satu
`progress.json`) di dokumen itu digantikan Opsi C di sini. Latar belakang,
Keputusan Desain A–D, dan sebagian besar Isu Terbuka #1–9 di PLAN-EVAL-02
**tetap berlaku secara konsep** (dirujuk balik di sini, tidak diulang),
hanya lapisan penyimpanan skemanya yang berubah.

---

## Keputusan: Opsi C — satu `progress.json` per chain, bukan nested dalam satu file

Dipilih Director menggantikan Opsi B (skema nested tunggal). Alasan utama
Director: analog langsung dengan model Git (`refs/heads/<branch>` + `HEAD`)
yang sudah dipakai sebagai kerangka berpikir sejak `sigma activate` ≈
`git checkout` diusulkan di PLAN-EVAL-02.

### Struktur file (final, revisi ketiga — lihat "Konsolidasi Lanjutan" bagian 10 di bawah)

```text
.sigma-identity.json      ← sudah ada hari ini, di root project (di luar Sigma/): { schema_version, project_id, project_name, registered, logs_created_at }
Sigma/activate_status.json ← BARU, pointer super-tipis: { active_chain }, tidak lain tidak bukan
Sigma/progress-v1.json    ← ChainState v1 (intent, roadmap, plan, exec, close, gates, runtime_invalid)
Sigma/progress-v2.json    ← ChainState v2
```

**Tidak ada file bernama `progress.json` lagi sama sekali** — nama itu
sudah pensiun total dari arsitektur baru. Nama rata (`progress-v<N>.json`
untuk chain) menggantikan usulan awal `Sigma/chains/<v>/progress.json`
— lihat "Konsolidasi Lanjutan" bagian 1 untuk alasan dan bukti konvensi
yang mendasarinya. Manifest/pointer-nya sendiri berganti nama total jadi
`Sigma/activate_status.json` — lihat "Konsolidasi Lanjutan" bagian 10.
Ini menjawab **Isu Terbuka Baru #1 dan #6** sekaligus (lihat status
RESOLVED di daftar Isu Terbuka di bawah).

### Aturan kunci yang disepakati

- Tiap `progress-v<N>.json` per-chain **hanya boleh punya satu** `intent`,
  `roadmap`, `close` — bukan array/tracker multi-versi lagi (beda dari
  Opsi B yang menyimpannya sebagai objek tunggal juga, tapi di sini
  ditegaskan ulang sebagai bagian dari alasan Director memilih Opsi C).
  `plan`/`exec` **tetap** tracker multi-versi (tidak berubah dari Opsi B).
- **Tidak ada command/namespace baru `sigma progress *`** — dibatalkan,
  lihat "Konsolidasi Lanjutan" di bawah. Semua operasi chain dilipat ke
  command `sigma intent` yang sudah ada.
- Pointer/manifest `Sigma/activate_status.json` (nama final — lihat
  "Konsolidasi Lanjutan" bagian 10) **tidak menyimpan ringkasan/cache
  chain apa pun** (bukan `chains: Record<...>` seperti draf pertama, dan
  bukan pula identitas project yang menduplikasi `.sigma-identity.json`)
  — cuma `active_chain`, benar-benar itu saja. Daftar & status semua
  chain selalu dihitung ulang (projection) dari hasil scan
  `Sigma/progress-v*.json`, tidak pernah disimpan sebagai salinan. Ini
  konsisten dengan prinsip "store facts, not summaries" yang disepakati
  di ronde Audit AUD di bawah.

---

## Analisis skala perubahan (fakta kode, dicek langsung — 2026-07-17)

Sebelum keputusan diambil, dicek apakah Opsi C benar mengecilkan skala
implementasi dibanding Opsi B. Angka nyata dari `src/`:

| Yang diukur | Jumlah |
|---|---|
| `intent.versions`/`active_version`/`active_state` | 43 pemakaian |
| `roadmap.versions`/dst. | 35 pemakaian |
| `close.versions`/dst. | 26 pemakaian |
| `plan.versions`/dst. (pembanding — **tetap array**, tidak berubah) | 47 pemakaian |
| `exec.versions`/dst. (pembanding — **tetap array**) | 43 pemakaian |
| File command yang memanggil `readProgress`/`writeProgress` | 9 file (`session.ts`, `close.ts`, `project.ts`, `intent.ts`, `override.ts`, `plan.ts`, `doctor.ts`, `exec.ts`, `roadmap.ts`) |
| Total panggilan `readProgress`/`writeProgress` | 53 |
| `src/engine/progress.ts` | 1313 baris |
| Test suite | 160 test di 25 file |

**Kesimpulan analisis — penting untuk konteks plan-eval turunan nanti**:

- **Yang benar mengecil karena Opsi C**: jaminan isolasi antar-chain jadi
  *struktural* (batas file), bukan disiplin nested-object — sehingga
  acceptance criteria "skenario regresi isolasi" di PLAN-EVAL-02 tidak
  perlu test terpisah untuk membuktikannya, cukup pembuktian bahwa
  command selalu resolve ke file yang benar.
- **Yang TIDAK mengecil, sama besar dengan Opsi B**: ~104 call site yang
  menyentuh `intent`/`roadmap`/`close` di 9 file command tetap harus
  ditulis ulang dari pola array (`versions.find(state === LOCKED)`) ke
  akses objek tunggal — ini konsekuensi dari keputusan "intent/roadmap/
  close jadi satu objek per chain", yang **sudah ada di Opsi B juga**,
  bukan sesuatu yang unik ditambahkan oleh multi-file. 53 call site
  `readProgress`/`writeProgress` tetap butuh lapisan resolusi baru
  (manifest → path aktif) dengan kompleksitas setara. Risiko migrasi dan
  rewrite 160 test tetap dalam skala yang sama.
- Ringkas: Opsi C memberi **kualitas isolasi lebih tinggi + file lebih
  legible + selaras konvensi `Sigma/` yang sudah multi-file**
  (`role-memory/*.json`, `logs/operations.jsonl`), dengan **skala kerja
  rewrite logika yang setara** dengan Opsi B — bukan proyek yang lebih
  kecil.

---

## Isu Terbuka Baru (khusus Opsi C, di luar #1–9 PLAN-EVAL-02)

1. ~~**Konvensi path pasti** untuk file per-chain~~ — **RESOLVED** (lihat
   "Konsolidasi Lanjutan"): `Sigma/progress-v<N>.json`, nama rata di
   root `Sigma/`, bukan subfolder per-chain. Alasan: konsisten dengan
   konvensi penamaan Sigma yang sudah ada (`DIR-INTENT-vX.md`,
   `FMN-PLAN-vX.md`, `DEV-EXEC-vX.md`, `ROADMAP-vX.md` — semua nama rata
   dengan versi di nama file, tidak ada preseden folder-per-versi).
2. ~~**Konsistensi manifest ↔ file chain**~~ — **RESOLVED** (lihat
   "Konsolidasi Lanjutan" bagian 9): invarian intinya **tepat satu chain
   `ACTIVE` setiap saat — tidak boleh nol, tidak boleh lebih dari satu**.
   `sigma intent activate` adalah satu-satunya jalur resmi menetapkan/
   memperbaiki invarian ini, termasuk sebagai jalur pemulihan kalau
   invarian ini somehow tidak valid. `sigma intent new` bukan
   pengecualian — auto-activate-nya tetap cara sah invarian ini
   terjaga, bukan kasus yang butuh `activate` manual susulan.
3. ~~**Atomicity lintas file saat migrasi/`intent new`**~~ — **RESOLVED**
   untuk urutan tulis (lihat "Konsolidasi Lanjutan" bagian 11): tulis
   file chain baru dulu, update `activate_status.json` terakhir. Sisa
   sub-detail kecil (perilaku `doctor` terhadap file yatim) masih
   menunggu keputusan Director.
4. ~~**`sigma project sync`/backup** perlu tahu soal pola
   `progress-v*.json`~~ — **RESOLVED, tapi bukan dengan memperluas
   backup**: lihat "Konsolidasi Lanjutan" bagian 13 — seluruh mekanisme
   auto-backup dihapus dari Sigma, termasuk yang sudah ada hari ini,
   bukan diperluas untuk file baru.
5. ~~**Apakah `Sigma/progress-v<N>.json` untuk chain `SUPERSEDED` dipindah
   ke lokasi arsip terpisah**~~ — **RESOLVED**: **tidak**. Chain
   `SUPERSEDED` tetap di `Sigma/` selamanya, tidak dipindah ke lokasi
   arsip terpisah — Director menilai itu cuma menambah kerumitan tanpa
   manfaat nyata (sudah kebal `activate` lewat keputusan #1/#6, jadi
   tidak ada urgensi teknis untuk memindahkannya). `progress-v1.json`
   yang `SUPERSEDED` tetap hidup berdampingan dengan chain aktif di
   direktori yang sama.
6. ~~**Nama file per-chain bentrok dengan nama manifest**~~ —
   **RESOLVED**, lalu **disempurnakan lagi** (lihat "Konsolidasi
   Lanjutan" bagian 10): resolusi awal adalah penamaan rata (manifest
   `Sigma/progress.json` tunggal vs chain `Sigma/progress-v1.json`,
   dst.). Keputusan final malah menghapus nama "progress.json" untuk
   manifest sepenuhnya — diganti `Sigma/activate_status.json` — supaya
   tidak ada kebingungan sama sekali antara manifest dan file chain,
   bukan cuma beda penomoran.
7. **Guard `intent new`** — Director mengonfirmasi (lihat "Konsolidasi
   Lanjutan"): `intent new` boleh dijalankan **kapan saja**, termasuk
   saat chain aktif sebelumnya masih `DRAFT`/belum `LOCKED`. Tidak ada
   syarat "chain sebelumnya harus selesai dulu". Prinsip isolasi total
   antar chain tetap berlaku mutlak terlepas dari kapan chain dibuka.

---

## Ronde Audit AUD — Review Independen atas Opsi C (2026-07-17)

Director membawa keputusan Opsi C (dan draf awal dokumen ini) ke sesi
AUD terpisah untuk audit independen, lalu ke Professional Mode lagi
untuk second opinion atas audit itu. Ringkasan hasil ronde ini:

**Verdict AUD: PASS (Strong Pass)** untuk keputusan arsitektur Opsi C
itu sendiri (bukan implementasinya — AUD eksplisit membatasi scope
audit hanya pada keputusan desain).

**Yang dikonfirmasi ulang lewat audit, konvergen independen dengan
analisis di dokumen ini** (AUD tidak membaca dokumen ini sebelum
sampai pada temuan yang sama — memperkuat validitasnya, bukan
kebetulan):

- Isolasi fisik vs logis (sudah tercatat di atas).
- Manifest → Chain File consistency invariant (Isu Terbuka Baru #2).
- Atomicity lintas file saat operasi multi-tulis (Isu Terbuka Baru #3).

**Yang ditolak dari usulan AUD, dan alasannya** — penting supaya tidak
muncul lagi sebagai "sudah pernah diusulkan" di plan-eval turunan:

- **"Chain sebagai Aggregate Root"** + bayangan kebutuhan masa depan
  (audit log, attachment, cache per chain) — ditolak sebagai *justifikasi
  desain*. Opsi C sudah cukup dijustifikasi oleh isolasi struktural saat
  ini; properti "mudah diperluas nanti" boleh dicatat sebagai efek
  samping yang menyenangkan, tapi **bukan alasan memilih** desain.
- **"Intent Evolution" sebagai layer/artifact baru** — ditolak sebagai
  konsep terpisah. Ini bukan fitur baru: ini persis cara
  `sigma progress list` (sudah diputuskan di atas) seharusnya
  merender datanya. Tidak ada command ketiga untuk data yang sama.

**Prinsip yang disepakati untuk ditulis eksplisit** (dirumuskan lewat
audit ini, disepakati kedua pihak):

> **Jangan membenarkan keputusan desain dengan kebutuhan masa depan,
> jika keputusan itu sudah cukup dibenarkan oleh kebutuhan saat ini.**
>
> Nuansa penting: ini aturan tentang *justifikasi*, bukan tentang
> *desain*. Kalau sebuah desain kebetulan juga memudahkan sesuatu di
> masa depan tanpa biaya tambahan sekarang, itu bukan pelanggaran
> prinsip — yang dilarang adalah memakai kemungkinan itu sebagai
> **alasan memilih** desain tersebut. Dibaca terlalu literal, prinsip
> ini bisa disalahgunakan jadi penolakan YAGNI-absolutis terhadap
> desain yang genuinely lebih bersih.

Bukti historis yang dipakai sebagai grounding prinsip ini (bukan klaim
abstrak — pola berulang di PLAN-EVAL nyata proyek ini): CSO dihapus
karena tidak dibutuhkan *sekarang* (bukan "mungkin nanti"), trivial
command dihapus karena tidak memberi nilai *sekarang*, ROADMAP
dirampingkan karena duplikasi terjadi *sekarang*.

**Isu penamaan tambahan yang dikonfirmasi kedua pihak**: hindari
istilah "roadmap" untuk tampilan lintas-intent/lintas-chain — karena
`FMN-ROADMAP` sudah punya makna established (roadmap implementasi satu
Intent). Nama command `sigma progress list` sudah aman (tidak memakai
kata "roadmap"), tapi dicatat eksplisit supaya istilah "roadmap" tidak
muncul lagi sebagai nama tampilan/bagian dokumentasi untuk konsep ini
di plan-eval turunan.

**Isu penamaan yang masih terbuka saat itu** (dari audit ini): nama file
per-chain bentrok dengan manifest — lihat resolusinya di "Konsolidasi
Lanjutan" di bawah (Isu Terbuka Baru #6, sekarang RESOLVED).

---

## Konsolidasi Lanjutan — Penamaan Rata + Fold ke `sigma intent` (2026-07-17)

Dua putaran diskusi susulan, keduanya usulan Director sendiri, keduanya
diverifikasi langsung terhadap kode nyata sebelum diterima.

### 1. Penamaan rata `progress-v<N>.json` menggantikan folder-per-chain

Director mengusulkan `Sigma/progress-v1.json`, `Sigma/progress-v2.json`
menggantikan `Sigma/chains/v1/progress.json`. Dicek terhadap kode nyata
— cara Sigma menamai artifact bervariasi yang sudah ada hari ini:

```text
Sigma/design/DIR-INTENT-${version}.md
Sigma/build/FMN-PLAN-${version}.md
Sigma/build/DEV-EXEC-${version}.md
Sigma/build/ROADMAP-${version}.md
```

Semua nama rata + versi-di-nama-file, di dalam satu direktori per jenis
artifact — **tidak ada satu pun preseden** folder-per-versi di repo ini.
Penamaan rata yang diusulkan Director justru lebih konsisten dengan
konvensi Sigma yang sudah ada dibanding folder-per-chain yang diusulkan
sebelumnya di dokumen ini. Efek samping baik: otomatis menyelesaikan
Isu Terbuka Baru #6 (bentrok nama manifest vs chain — sekarang beda
nama by construction) tanpa perlu mencari nama pengganti seperti
`chain.json`. Juga mengurangi satu operasi filesystem per transaksi
(tidak perlu `mkdir` sebelum menulis file chain baru).

### 2. Tidak ada namespace command `sigma progress *` — dilipat ke `sigma intent`

Director mengusulkan seluruh command `sigma progress new/activate/list`
dihapus dan dilipat ke command `sigma intent` yang sudah ada. Dicek
terhadap kode nyata untuk memastikan ini valid, bukan cuma preferensi:

- [intent.ts:61](../../src/commands/intent.ts#L61) — versi Intent
  selalu dihasilkan lewat `nextMajorVersion(data.intent.versions)`.
  Intent **tidak pernah** punya versi minor (beda dari Plan/Exec yang
  punya `v1.1`, `v1.2`). Artinya **setiap** `sigma intent new` pasti
  dan selalu membuka major version baru — tidak ada skenario `intent
  new` yang bukan pembukaan chain baru. Aman untuk membuat file chain
  baru sebagai efek otomatis dari `intent new`, tanpa syarat/pengecualian.
- `sigma intent list` **sudah ada** sebagai command hari ini
  ([intent.ts:200](../../src/commands/intent.ts#L200)) — tidak perlu
  command baru untuk tampilan lintas-chain, cukup perluas rendering
  command yang sudah ada.

Command surface final (menggantikan seluruh usulan `sigma progress *`):

- `sigma intent new` — membuat `progress-vN.json` baru **secara
  otomatis** mengikuti versi intent, dan otomatis meng-aktifkan chain
  barunya (mempertahankan default "auto-activate on create" yang sudah
  disepakati sebelumnya, analog `git checkout -b`). Ini juga
  menegaskan ulang bahwa `intent new` (jadi juga pembukaan chain) tetap
  wewenang ARC — tidak perlu keputusan kepemilikan terpisah.
- `sigma intent activate --v <versi>` — menggantikan `sigma progress
  activate`.
- `sigma intent list` — diperluas untuk merender ringkasan lintas-chain
  (status LOCKED/SUPERSEDED/DRAFT, gate summary) — menggantikan `sigma
  progress list`. Tetap sebagai projection murni (baca semua
  `progress-v*.json`, tidak ada yang disimpan sebagai cache), konsisten
  dengan prinsip "store facts, not summaries" dari ronde audit di atas.

Ini pemangkasan vocabulary yang lebih ketat daripada yang sudah
disepakati sebelumnya di ronde audit AUD — bukan cuma "jangan tambah
command baru", tapi **tidak ada command/namespace baru sama sekali**
untuk seluruh fitur multi-chain ini.

### 3. Keputusan governance: `intent new` boleh kapan saja

Director mengonfirmasi: `sigma intent new` boleh dijalankan **kapan
saja**, termasuk saat chain aktif sebelumnya masih `DRAFT` atau belum
`LOCKED` — tidak ada syarat "chain sebelumnya harus selesai/terkunci
dulu". Ini konsisten dengan perilaku `intent new` hari ini (tidak ada
guard seperti itu di kode saat ini — cuma dicek `assertProgressCanMutate`).
Prinsip arsitektur inti **tidak berubah**: isolasi total antar chain
tetap mutlak berlaku terlepas dari kapan/dalam urutan apa chain-chain
itu dibuka — membuka chain baru sambil chain lama belum selesai tidak
memberi efek apa pun ke gate/state chain lama.

### 4. `sigma doctor --all-versions` — satu-satunya command yang butuh flag lintas-chain

Director bertanya operasi apa saja yang menyentuh `progress.json`, lalu
mengusulkan flag baru untuk `sigma doctor` yang meloop semua chain.
Dicek terhadap kode nyata — inventaris lengkap 9 file yang memanggil
`readProgress`/`writeProgress`:

| File | Command | Sifat | Kandidat flag lintas-chain? |
| --- | --- | --- | --- |
| `doctor.ts` | (default), `--reconstruct` | Reconciliation/repair — baca artifact di disk vs `progress.json`, perbaiki drift | **Ya** |
| `session.ts` | `bootstrap` | Read-only report | Tidak — Prinsip D (PLAN-EVAL-02) sudah menetapkan bootstrap cuma boleh lihat `active_chain` |
| `project.ts` | `status` | Read-only report | Tidak — akan tumpang tindih `intent list` |
| `project.ts` | `start`/`sync`/`register` | Project-level, tidak terikat chain tertentu | Tidak relevan |
| `intent.ts` | `list` | Sudah lintas-chain by design (hasil konsolidasi #2) | Tidak perlu flag — memang tugasnya |
| `intent.ts`, `plan.ts`, `exec.ts`, `close.ts`, `roadmap.ts` | seluruh command mutasi (`new`/`lock`/`supersede`/`promote`/`activate`) + command cek satu-artifact (`check`/`status`) | Semua bertarget **satu** artifact di **satu** chain (chain aktif) | Tidak berlaku — melanggar isolasi total kalau dipaksa lintas-chain |
| `override.ts` | apply/list override | Mutasi satu gate spesifik di satu chain | Tidak berlaku |

**Kesimpulan**: `doctor` **satu-satunya** command yang butuh flag
lintas-chain, karena tugasnya (`runDoctorReconciliation`) adalah
**memperbaiki**, bukan cuma **menampilkan** — tidak bisa digantikan
`intent list` yang murni display. Semua command mutasi lain memang
selalu dan hanya boleh menyentuh satu chain (chain aktif) — menambah
flag lintas-chain di sana akan melanggar prinsip isolasi total itu
sendiri, jadi sengaja tidak ditambahkan.

**Bukti murah untuk diimplementasi**: fungsi inti
`runDoctorReconciliation(data, overrides)` cuma menerima satu objek
`ProgressJson`, tidak tahu apa-apa soal "chain" — jadi menambah
`--all-versions` tidak butuh menulis ulang logika reconciliation,
cukup loop pemanggilan fungsi yang sama untuk tiap `progress-v*.json`.
Ini konsekuensi nyata dari isolasi struktural Opsi C (bukan justifikasi
tambahan untuk Opsi C itu sendiri — Opsi C sudah cukup dijustifikasi
sebelumnya).

**Keputusan**:

- `sigma doctor` — default tetap memperbaiki `progress-v<active>.json`
  saja (prinsip identik dengan hari ini, cuma target file berubah dari
  satu-satunya `progress.json` jadi file chain aktif).
- `sigma doctor --all-versions` — mengulang reconciliation yang sama
  untuk setiap `progress-v*.json` yang ada, tanpa mengubah
  `active_chain`. Bisa dikombinasikan dengan `--reconstruct` untuk
  merekonstruksi semua chain yang rusak/hilang sekaligus.
- Nama flag: `--all-versions` (kebab-case jamak, konsisten dengan
  konvensi flag Sigma yang sudah ada seperti `--director-confirm`,
  `--reconstruct`, `--recovery` — bukan `--allversion`).

### 5. `--title`/`--focus` wajib di `sigma intent new`, plus `Sigma/design/intent-history.md` auto-render

Director mengusulkan menyamakan `sigma intent new` dengan pola
`sigma plan new`/`plan promote` yang sudah mewajibkan `--title` dan
`--focus`, supaya `sigma intent list` bisa menampilkan ringkasan tiap
chain tanpa perlu membuka `DIR-INTENT-vX.md` penuh. Dicek terhadap kode
nyata sebelum disepakati:

- Nama flag yang benar hari ini adalah `--title`/`--focus` (bukan
  `--topic`), dipakai wajib di `plan new`/`plan promote`
  ([plan.ts:72-73](../../src/commands/plan.ts#L72-L73)) dan opsional di
  `plan update` ([plan.ts:406-407](../../src/commands/plan.ts#L406-L407)).
  Keduanya **hanya** disimpan di `progress.json`
  (`registerPlanDraft`/`promotePendingPlan`/`updatePlanMetadata`) —
  **tidak pernah** ditulis ke dalam dokumen `FMN-PLAN-*.md` itu sendiri.
  Satu-satunya konsumennya adalah `generateStageOverview()`
  ([roadmap.ts:11](../../src/utils/roadmap.ts#L11)):
  `| Stage | Title | Focus | Status | Reason |`.
- `DIR-INTENT-TEMPLATE.md` **tidak punya field title ringkas sama
  sekali** di manapun (langsung masuk ke narasi panjang "1.1
  Objective") — jadi tidak ada risiko duplikasi antara flag CLI dan isi
  dokumen; field ini akan jadi satu-satunya representasi ringkas Intent
  yang ada.

**Keputusan**:

- `--title`/`--focus` jadi **wajib** (`requiredOption`) di
  `sigma intent new`, sama seperti `plan new`.
- **Tidak ada dokumen ROADMAP-setara untuk Intent** — Director eksplisit
  ingin mengurangi beban manual ARC. Beda dari ROADMAP (dokumen
  campuran: sebagian manual, sebagian auto-render lewat delimiter
  `SIGMA:RENDER:START/END` di [roadmap.ts:32](../../src/utils/roadmap.ts#L32)),
  file baru ini **100% auto-render, nol bagian manual** — lebih
  sederhana dari `renderRoadmapFile()` karena tidak perlu menjaga
  delimiter/bagian manual, cukup timpa seluruh file setiap kali. Tidak
  butuh file template artifact sama sekali (beda dari
  `DIR-INTENT-TEMPLATE.md`/`FMN-PLAN-TEMPLATE.md` yang di-copy saat
  `new`).
- **Lokasi**: `Sigma/design/intent-history.md` — sejajar dengan
  `DIR-INTENT-vX.md` yang memang sudah tinggal di `Sigma/design/`
  ([intent.ts:62](../../src/commands/intent.ts#L62)).
- **Bentuk kolom**: sama persis dengan Stage Overview ROADMAP —
  `| Version | Title | Focus | Status | Reason |`.
- **Nama file** ("intent-history") sengaja dipilih konsisten dengan
  salah satu nama yang diusulkan AUD di ronde audit di atas ("Intent
  History") dan tetap menghindari istilah "roadmap" sesuai kesepakatan
  penamaan yang sudah dicatat.

**Titik pemicu render ulang penuh** (wajib eksplisit, supaya "benar-benar
otomatis" bukan sekadar niat baik — kalau satu titik lupa dikaitkan,
file ini basi persis seperti masalah lama duplikasi ROADMAP):

- `sigma intent new` — baris baru (DRAFT)
- `sigma intent lock` — status → LOCKED
- `sigma intent supersede` — status → SUPERSEDED + reason
- `sigma intent activate --v` — pointer chain aktif berubah

**Jaring pengaman self-healing**: `sigma doctor` (termasuk
`--all-versions`) juga meregenerasi `intent-history.md` dari nol setiap
dijalankan — bukan cuma memperbaiki `progress-v*.json`. Kalau ada satu
titik pemicu di atas yang gagal/lupa terpasang saat implementasi,
`sigma doctor` tetap bisa memulihkan file ini ke keadaan benar kapan
saja.

### 6. Governance batch — reaktivasi `SUPERSEDED`, otorisasi `activate`, default & visibility

Tiga keputusan governance yang menjawab Isu Terbuka #5 dan #7 di
PLAN-EVAL-02 (sebelumnya belum pernah dijawab ulang secara eksplisit):

- **Chain `SUPERSEDED` tidak bisa diaktifkan lagi, selamanya** — kebal
  permanen terhadap `sigma intent activate`. Menjawab Isu Terbuka #5
  PLAN-EVAL-02: ya, `SUPERSEDED` adalah status terminal, beda dari
  sekadar "tidak aktif".
- **`sigma intent activate` tidak butuh `--director-confirm`.** Menjawab
  Isu Terbuka #7 PLAN-EVAL-02. Ini bukan berarti tanpa jaring pengaman —
  ada dua syarat kompensasi yang disepakati bersamaan:
  - Default sistem **selalu mengacu ke chain terbaru** kalau tidak ada
    aktivasi eksplisit (fallback yang aman, mengurangi blast radius
    kalau ada kesalahan).
  - `sigma session bootstrap` **wajib** selalu menampilkan versi
    Intent/chain yang sedang aktif secara eksplisit dan menonjol — jadi
    kesalahan/lupa-chain-aktif ketahuan lewat visibility, bukan dicegah
    lewat friksi otorisasi.

### 7. Numbering Plan/Exec lintas-chain — ternyata sudah selesai oleh kode existing, bukan isu baru

Menjawab Isu Terbuka #2 PLAN-EVAL-02 (yang sebelumnya dikira masih
terbuka). Dicek ulang: `nextPlanVersion()`
([progress.ts:786](../../src/engine/progress.ts#L786)) menghitung
`planMajor = parseMajorVersion(intentVersionRef) - 1`. Chain v1 (intent
major 1) → plan selalu `v0.x`. Chain v2 (intent major 2) → plan selalu
`v1.x`. Karena tiap chain file cuma pernah punya **satu** intent major
sepanjang hidupnya, rentang nomor Plan/Exec-nya otomatis tidak akan
pernah tabrakan antar chain — tanpa perlu skema disambiguasi tambahan
apa pun. **RESOLVED, bukan open issue** — koreksi atas kekhawatiran yang
saya angkat sebelumnya di percakapan ini.

### 8. Siklus hidup final Roadmap & Close, plus redefinisi Gate 1.5

Klarifikasi Director atas pertanyaan sebelumnya soal apakah Roadmap
perlu tahap `DRAFT` terpisah (Isu Terbuka #3 PLAN-EVAL-02):

- **Roadmap dan Close sama-sama tetap 3 state**: `DRAFT`, `LOCKED`,
  `SUPERSEDED` — bukan disederhanakan jadi 2.
- **`sigma roadmap lock` tidak pernah ada sebagai command.** Roadmap
  selalu `DRAFT` sepanjang chain masih berjalan (dashboard hidup, terus
  di-render ulang lewat Stage Overview) — baru berubah **otomatis**
  jadi `LOCKED` sebagai efek samping saat `sigma close lock` berhasil
  dikunci untuk chain itu. Model lama `ACTIVE`/`INACTIVE` (arbitrase
  kompetisi antar-roadmap) dihapus total, digantikan `DRAFT` tunggal —
  karena di dunia 1:1 per-chain tidak ada lagi yang perlu diarbitrase.
- **Close tetap punya command `lock` eksplisit** — tidak berubah dari
  hari ini ([close.ts](../../src/commands/close.ts)).
- **`SUPERSEDED` untuk Roadmap maupun Close selalu otomatis (cascade),
  tidak pernah manual/independen** — begitu Intent di-`supersede`
  lewat `sigma intent supersede --director-confirm`, keduanya ikut
  `SUPERSEDED` sebagai bagian cascade satu `ChainState`. Kalau chain
  ditinggalkan sebelum sempat di-close, Roadmap lompat langsung
  `DRAFT → SUPERSEDED`, tidak pernah sempat `LOCKED`.

**Konsekuensi nyata yang harus diperbaiki**: Gate 1.5 hari ini secara
eksplisit mensyaratkan ROADMAP berstatus `ACTIVE`
([plan.ts:106-110](../../src/commands/plan.ts#L106-L110),
[plan.ts:256](../../src/commands/plan.ts#L256): *"Gate 1.5 blocked: An
ACTIVE ROADMAP must exist..."*). Begitu `ACTIVE` dihapus dari enum,
syarat ini tidak valid lagi secara harfiah — dan mensyaratkan `LOCKED`
juga mustahil dipenuhi sebelum close (akan mengunci Plan selamanya).

**Keputusan**: Gate 1.5 didefinisikan ulang jadi **"Roadmap untuk chain
ini sudah dibuat (ada) dan belum `SUPERSEDED`"** — bukan lagi
mensyaratkan status tertentu. Efeknya: begitu `sigma roadmap new`
sukses sekali, Gate 1.5 langsung terbuka permanen sampai chain berakhir
(LOCKED atau SUPERSEDED).

**Prinsip menyeluruh yang ditegaskan Director** (penting, dan sengaja
**belum** diselesaikan tuntas di sesi ini): karena isolasi antar-chain
sekarang **total**, bukan cuma Gate 1.5 yang perlu didefinisikan ulang —
**seluruh hubungan/ikatan yang tadinya ada antar chain version** (mis.
gate lain yang mungkin masih diam-diam berasumsi ada hubungan lintas
Intent major version) perlu ditinjau ulang satu per satu. Ini dicatat
sebagai pekerjaan yang **sengaja dideferred**, bukan diselesaikan di
sini — lihat Isu Terbuka Baru #8 di bawah.

### 9. Invarian "tepat satu chain ACTIVE" — resolusi Isu Terbuka #2 dan mekanisme `--reconstruct`

> **Revisi (lihat bagian 12 di bawah)**: subbagian "Invarian dan
> pembagian tanggung jawab" dan "Kenapa ini beda dari mode `INVALID`"
> di bawah ini merekam **keputusan awal** (hard-stop, wajib
> `sigma intent activate` manual). Director kemudian merevisi ini jadi
> **auto-default ke versi Intent terbaru yang belum `SUPERSEDED`** —
> lihat bagian 12 untuk keputusan final. Bagian di bawah dipertahankan
> apa adanya sebagai riwayat diskusi, jangan dijadikan acuan
> implementasi tanpa membaca bagian 12.

Director menegaskan invarian inti yang berlaku untuk **semua** operasi
yang butuh tahu "chain mana yang aktif": **harus tepat satu chain
`ACTIVE` setiap saat — tidak boleh nol, tidak boleh lebih dari satu.**
Ini menjawab pertanyaan awal saya soal `sigma doctor --reconstruct` dan
sekaligus menyelesaikan Isu Terbuka #2 secara tuntas.

**Nama flag**: `--v <versi>` (bukan `--version=`) — konsisten dengan
konvensi yang sudah dipakai di semua command lain (`plan activate --v`,
`roadmap check --v`, `intent supersede --v`, dst.).

**Tiga mode `sigma doctor --reconstruct`** (mekanisme recovery-nya,
dicek terhadap `reconstructProgress()` yang sudah ada —
[reconstruct.ts:333](../../src/engine/reconstruct.ts#L333) — yang
bekerja dengan scan file artifact di disk berdasarkan pola regex per
domain, [reconstruct.ts:44-50](../../src/engine/reconstruct.ts#L44-L50)):

- `sigma doctor --reconstruct` (tanpa flag) — rekonstruksi chain
  **aktif** saja (baca `active_chain` dari manifest untuk tahu yang
  mana).
- `sigma doctor --reconstruct --v <versi>` — rekonstruksi **satu**
  chain spesifik (scan hanya artifact yang match pola major version
  itu, mis. `DIR-INTENT-v1.md`, `FMN-PLAN-v0.x.md` untuk chain v1).
- `sigma doctor --reconstruct --all-versions` — rekonstruksi **semua**
  chain yang bisa ditemukan di disk.

**Invarian dan pembagian tanggung jawab yang disepakati**:

- `sigma intent activate` adalah **satu-satunya jalur resmi** untuk
  menetapkan/mengubah chain mana yang `ACTIVE` — baik untuk perpindahan
  normal (analog `git checkout`) maupun sebagai jalur pemulihan kalau
  invarian ini tidak valid (mis. manifest hilang/korup sehingga tidak
  jelas siapa yang aktif).
- `sigma intent new` **bukan pengecualian** — auto-activate-nya tetap
  cara sah invarian ini terjaga (otomatis), bukan kasus yang butuh
  `activate` manual susulan.
- `--reconstruct`/`--all-versions` boleh membangun ulang **file-file
  chain** dari artifact di disk (tugas: pemulihan data), tapi **tidak
  boleh menebak sendiri** siapa yang jadi `active_chain` kalau itu tidak
  diketahui (mis. manifest ikut hilang) — itu wajib menunggu keputusan
  eksplisit lewat `sigma intent activate --v <x>`, tidak boleh
  auto-fallback diam-diam ke "chain terbaru" atau tebakan lain.

**Kenapa ini beda dari mode `INVALID` yang sudah ada**: dicek
`assertProgressCanMutate()` ([progress.ts:611](../../src/engine/progress.ts#L611))
— untuk marker `INVALID` biasa, sistem **tidak** memblokir, cuma cetak
warning dan melonggarkan pengecekan gate, lalu tetap mengizinkan mutasi
jalan (supaya Director bisa lanjut kerja sambil `sigma doctor`
memperbaiki). Itu berlaku karena file yang dimaksud tetap diketahui/
valid — cuma satu domain state yang meragukan. Kasus "tidak ada
`active_chain` yang valid" **berbeda secara kategoris**: sistem benar-
benar tidak tahu file mana yang harus dibaca/ditulis, tidak ada mode
longgar yang masuk akal di sini. Jadi ini harus jadi **hard-stop**
eksplisit untuk semua command yang butuh chain aktif — bukan warning-
dan-lanjut seperti mode `INVALID` biasa — dengan pesan yang mengarahkan
langsung ke `sigma intent activate --v <x>`.

### 10. Manifest berganti nama total jadi `Sigma/activate_status.json` — `progress.json` pensiun sepenuhnya

Director mempertanyakan: kalau semua state sekarang ada di
`progress-v*.json` per-chain, kenapa masih ada file bernama
`progress.json`? Ini pertanyaan yang tepat — jawabannya menemukan cacat
di desain manifest sebelumnya.

**Temuan**: Sigma **sudah punya** file identitas project hari ini,
`.sigma-identity.json`, di **root project** (di luar `Sigma/`), sengaja
diletakkan di situ supaya selamat walau seluruh folder `Sigma/`
rusak/hilang ([project.ts:80-92](../../src/commands/project.ts#L80-L92)).
Isinya: `{ schema_version, project_id, project_name, registered,
logs_created_at }`. Dipakai `sigma doctor --reconstruct` sebagai sumber
identitas cadangan terakhir, **hanya** dibaca saat fallback recovery
([doctor.ts:75-97](../../src/commands/doctor.ts#L75-L97)) — jadi
sengaja jarang ditulis (cuma sekali saat `project start`/`register`),
jangkar pemulihan bencana yang stabil.

Bentuk manifest yang diusulkan sebelumnya
(`{ schema_version, project_id, project_name, active_chain, created_at,
updated_at }`) **menduplikasi** `project_id`/`project_name`/
`schema_version` yang sudah ada di `.sigma-identity.json` — pelanggaran
prinsip "store facts, not summaries" yang justru sudah disepakati
sendiri di ronde audit AUD.

**Kenapa tidak digabung saja ke `.sigma-identity.json`**: `active_chain`
berubah **sering** (tiap `intent new`/`intent activate`), sementara
`.sigma-identity.json` sengaja dirancang **jarang ditulis** sebagai
jangkar stabil. Menggabungkan keduanya membuat file yang seharusnya
paling stabil justru jadi paling sering ditulis — merusak tujuan
desainnya sendiri (makin sering ditulis, makin besar risiko rusak tepat
saat dibutuhkan sebagai jangkar terakhir).

**Keputusan final**: manifest tetap ada sebagai file terpisah, tapi:

- **Nama**: `Sigma/activate_status.json` — bukan `progress.json` sama
  sekali, supaya tidak ada kebingungan dengan `progress-v*.json` (Isu
  Terbuka Baru #6, disempurnakan lagi).
- **Isi**: hanya `{ active_chain }` — keputusan chain/intent mana yang
  sedang aktif, **itu saja**. Tidak ada `project_id`/`project_name`
  (tugas `.sigma-identity.json`), tidak ada cache/ringkasan chain apa
  pun (tugas projection dari scan `progress-v*.json`).
- **Peran**: jadi **bridge** — setiap command yang butuh tahu "chain
  mana yang aktif" (`sigma session bootstrap`, `plan new`, `intent
  status`, dst.) membaca `Sigma/activate_status.json` **dulu** untuk
  tahu `progress-v<N>.json` mana yang harus dibaca/ditulis setelahnya.
- **Lokasi**: tetap di dalam `Sigma/` (bukan root project seperti
  `.sigma-identity.json`) — ini state governance yang berubah aktif,
  bukan jangkar identitas stabil, jadi tempatnya memang bersama
  `progress-v*.json`, bukan disatukan dengan file identitas.

### 11. Urutan tulis final untuk `intent new` — resolusi Isu Terbuka #3

Director mengonfirmasi urutan tulis yang diusulkan sebelumnya sebagai
final: **tulis `Sigma/progress-v<N>.json` (chain baru) dulu, baru
update `Sigma/activate_status.json` terakhir.** Kalau proses mati di
tengah, hasil terburuknya adalah satu file chain baru yang belum
ditunjuk siapa-siapa (aman, bisa dibereskan belakangan) — bukan
`activate_status.json` menunjuk ke chain yang file-nya belum ada
(rusak, semua command butuh chain aktif akan gagal). **Isu Terbuka #3
RESOLVED** untuk bagian urutan tulisnya; perilaku `doctor` terhadap
file yatim (adopsi otomatis vs cuma dilaporkan) masih menunggu
keputusan Director.

### 12. Revisi kebijakan: `active_chain` tidak valid → auto-default ke Intent terbaru yang belum `SUPERSEDED`, bukan hard-stop

Director merevisi keputusan di bagian 9: kalau `active_chain` di
`Sigma/activate_status.json` dalam kondisi tidak valid (kosong/null,
atau menunjuk ke chain yang tidak ada — secara skema cuma satu field,
jadi ini mencakup kasus "nol" dan "tidak dikenal", bukan literal
"lebih dari satu"), sistem **otomatis** kembali ke default: `active_chain`
diset ke versi Intent **tertinggi yang belum `SUPERSEDED`** — tanpa
perlu intervensi manual. **Chain `SUPERSEDED` selalu dikecualikan** dari
kandidat default ini, konsisten dengan keputusan #1/#6 (SUPERSEDED
kebal permanen terhadap aktivasi).

`sigma intent activate --v <x>` **tetap tersedia kapan saja** sebagai
jalur mengubah pilihan itu secara manual — termasuk segera setelah
auto-default terjadi, kalau Director ternyata mau chain lain yang aktif.

**Pembagian tanggung jawab yang final** (menggantikan versi hard-stop
di bagian 9): `sigma doctor --reconstruct`/`--all-versions` tetap murni
tugas **pemulihan data** (membangun ulang isi `progress-v*.json` dari
artifact di disk) — soal file, bukan soal pointer. Resolusi
`active_chain` yang tidak valid adalah kebijakan **terpisah dan
otomatis** (auto-default ke terbaru non-`SUPERSEDED`), tidak bergantung
pada kapan/apakah `--reconstruct` dijalankan. Kedua mekanisme ini
independen satu sama lain — tidak ada yang perlu menunggu yang lain.

### 13. Seluruh mekanisme auto-backup dihapus dari Sigma — resolusi Isu Terbuka #4

Director menyatakan ketidaksukaan terhadap pola "backup dulu sebelum
operasi berisiko" secara umum — dalam praktiknya hampir selalu berujung
jadi dump file yang jarang/tidak pernah direstore. Karena artifact
Sigma (`progress.json`/`progress-v*.json`, dan file governance lain)
sudah ter-*track* git (dicek: tidak ada di `.gitignore`), safety net
yang sebenarnya sudah tersedia gratis lewat `git diff`/`git checkout --`
— dump file custom cuma duplikasi yang tidak pernah dipakai.

**Keputusan**: **tidak boleh ada operasi Sigma manapun yang menjalankan
backup artifact apa pun** — bukan cuma untuk arsitektur multi-chain
baru ini, tapi **mencakup mekanisme yang sudah ada hari ini**:

- `sigma project start --reinit` — langkah `backupFile(progressPath,
  logsDir)` sebelum reinit ([project.ts:145-157](../../src/commands/project.ts#L145-L157))
  **dihapus**.
- `sigma project sync` — direktori `Sigma/logs/sync-backup-<timestamp>/`
  ([project.ts:404](../../src/commands/project.ts#L404)) **dihapus**.

**Implikasi ke migrasi JLH**: langkah "backup `progress.json` lama
sebelum migrasi" di algoritma migrasi (elaborasi Isu Terbuka #6
PLAN-EVAL-02) **diganti** — bukan bikin dump file, tapi migrasi
menolak/memperingatkan jalan kalau working tree git untuk `Sigma/`
belum bersih (belum di-commit). Rollback-nya `git checkout`, bukan
memulihkan dari file `.bak`.

**Catatan cakupan**: ini keputusan yang lebih luas dari sekadar Opsi C
— menyentuh kode `project.ts` yang sudah ada hari ini, tidak terkait
langsung ke multi-chain. Dicatat di sini karena dipicu oleh diskusi ini,
tapi implementasinya bisa jadi PLAN-EVAL tersendiri yang independen dari
pemecahan chain-activation, bukan wajib jadi satu paket. **Dicatat
sebagai keputusan di dokumen ini dulu (status DISCUSSION LOG) — belum
diimplementasikan ke kode, menunggu plan-eval turunan** (dikonfirmasi
Director: eksekusi kode nyata ditunda, bukan dilakukan di sesi ini).

---

## Isu Terbuka Baru (lanjutan)

1. **(#8) Redefinisi menyeluruh hubungan antar chain version di luar
   Gate 1.5** — Director menegaskan prinsip isolasi total berarti semua
   ikatan lama antar-chain (bukan cuma Gate 1.5/Roadmap) berpotensi
   perlu ditinjau ulang. **Keputusan final: tetap dideferred**, secara
   sadar — bukan diselesaikan di dokumen ini, bukan pula ditinjau di
   satu plan-eval terpisah lebih dulu. Setiap plan-eval turunan
   (nomor berapa pun nanti) wajib meninjau ulang gate/hubungan yang
   relevan dengan scope-nya masing-masing **saat bekerja di situ**,
   bukan menunggu audit menyeluruh di muka.

---

## Langkah Berikutnya

Director menyatakan implementasi nyata akan dipecah jadi beberapa
PLAN-EVAL baru terpisah (menjawab Isu Terbuka #9 PLAN-EVAL-02 tentang
staging: **dipecah**, bukan satu paket besar). Dokumen ini jadi acuan
sumber untuk penyusunan plan-eval turunan tersebut. Numbering dan
pembagian scope per plan-eval belum ditentukan — menunggu sesi
berikutnya.

**JLH dikonfirmasi sebagai target migrasi pertama** (Isu Terbuka #8
PLAN-EVAL-02) — dipakai sebagai uji coba begitu implementasi siap.

**Yang masih terbuka sebelum dokumen ini bisa dianggap nol open
question** (syarat Director untuk mulai memecah ke PLAN-EVAL baru,
lihat poin 9 sebelumnya): ~~Isu Terbuka Baru #2~~ (RESOLVED — lihat
Konsolidasi Lanjutan bagian 12), ~~#3~~ (RESOLVED untuk urutan tulis —
lihat bagian 11; sisa satu sub-detail kecil: perilaku `doctor` terhadap
file yatim, adopsi otomatis vs cuma dilaporkan — belum diputuskan),
~~#4~~ (RESOLVED — lihat bagian 13: seluruh auto-backup dihapus, bukan
diperluas), ~~#5~~ (RESOLVED — tidak ada arsip fisik, chain `SUPERSEDED`
tetap di `Sigma/` selamanya), dan ~~#8~~ (RESOLVED sebagai
**sengaja-dideferred** — bukan diklaim selesai, tapi juga bukan
penghalang untuk mulai memecah ke PLAN-EVAL; setiap plan-eval turunan
meninjau ulang hubungan antar-chain yang relevan dengan scope-nya
sendiri saat dikerjakan).

**Dokumen ini sekarang praktis nol open question**, kecuali satu
sub-detail kecil yang sengaja dibiarkan menunggu tahap implementasi:
perilaku `sigma doctor` terhadap file chain yatim (bagian dari #3 —
adopsi otomatis vs cuma dilaporkan). Ini cukup kecil untuk tidak
menghalangi pemecahan ke PLAN-EVAL turunan — bisa diputuskan saat
plan-eval yang menyentuh `doctor`/migrasi disusun.
