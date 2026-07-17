# PLAN-EVAL-02 — Chain Activation & Total Isolation (Multi-Chain Sigma)

**Sumber**: Diskusi langsung dengan Director di sesi ini, 2026-07-17, sebagai
kelanjutan diskusi PLAN-EVAL-01. Dipicu oleh pertanyaan Director sendiri:
"apakah sistem sekarang mengizinkan perpindahan pekerjaan lintas chain, atau
cuma boleh bekerja pada satu chain terbaru?" — jawabannya (dianalisis dari
kode nyata): **model kedua**, tapi ditegakkan tidak konsisten (lihat "Latar
Belakang" di bawah). Director lalu mengusulkan desain chain activation
penuh untuk sesi berikutnya.

**Tanggal**: 2026-07-17
**Status**: **OBSOLETE** — digantikan Opsi C (satu `progress.json` per
chain, bukan nested dalam satu file) di
[DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](./DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md).
Latar Belakang dan Keputusan Desain A–D di bawah **tetap berlaku secara
konsep** (masih jadi rujukan), tapi bagian "Desain Teknis — Opsi B" tidak
lagi jadi arah implementasi. Implementasi nyata akan dipecah jadi
beberapa PLAN-EVAL baru terpisah (lihat dokumen discussion di atas),
bukan dokumen ini. Dipertahankan sebagai arsip riwayat diskusi, jangan
dihapus.

~~**Status lama**: DRAFT FOR REVIEW — **belum diimplementasikan sama sekali**.~~
Ini bukan bugfix seperti PLAN-EVAL-01 (yang menambal cascade tak-berizin),
ini **proposal fitur/redesain arsitektur baru** — restrukturisasi skema data
inti (`progress.json`) dan hampir seluruh command surface. Dokumen ini murni
menangkap hasil diskusi supaya bisa direview Director secara utuh sebelum
keputusan implementasi apa pun diambil. Banyak Isu Terbuka di bawah **belum
punya jawaban** — dokumen ini sengaja dibuat di titik ini (sebelum semua
keputusan final) sesuai permintaan Director eksplisit: "buat dulu saja
plan-eval nya nanti saya review, termasuk open question dan risiko yang
perlu diputuskan dan konsekuensi desain."

**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan
FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Latar Belakang — Kenapa Ini Muncul

Saat mendiskusikan hasil PLAN-EVAL-01 (Intent LOCKED lama → `INACTIVE`,
bukan lagi `SUPERSEDED` otomatis), Director bertanya apakah sistem
mengizinkan kerja paralel lintas beberapa Intent chain (seperti Git branch),
atau memaksa satu chain terbaru saja. Analisis kode nyata menunjukkan
**keduanya, tidak konsisten**:

1. **Ditegakkan kaku** — semua fungsi gate (`hasCleanGate2Chain()`,
   `hasCleanGate3Chain()`, `evaluateCloseChain()` di
   [progress.ts](../../src/engine/progress.ts) dan
   [close.ts](../../src/commands/close.ts)) mensyaratkan Plan/Exec merujuk
   ke Intent yang **statusnya literal `LOCKED` saat ini** — bukan sekadar
   "pernah ada di histori". Karena mekanisme swap (`lockActiveIntent()`)
   menjamin cuma satu Intent boleh `LOCKED` sekaligus, begitu Intent lama
   turun ke `INACTIVE`, Gate 2/Gate 3/eligibility DIR-CLOSE untuk chain itu
   **tidak akan pernah bisa dipuaskan lagi** — permanen, walau artifact-nya
   sendiri (Plan/Exec) masih ada dan LOCKED secara fisik. `sigma plan new`
   juga selalu menempel ke `data.intent.versions.find(v => v.state ===
   'LOCKED')` — satu-satunya current, tidak ada cara menargetkan Intent versi
   lain secara eksplisit.
2. **Tidak ditegakkan sama sekali** — `lockOldestPlanDraft()` (`sigma plan
   lock`) dan alur `sigma exec new` **tidak memfilter berdasarkan Intent
   chain sama sekali**; keduanya cuma peduli urutan pembuatan (FIFO) dan
   status DRAFT/LOCKED murni. Konsekuensi nyata: di proyek
   `KLHK_JasaLingkunganHidup`, `sigma plan lock` hari ini akan mengunci
   **v0.1** (dibuat duluan, terikat Intent v1 yang sudah `INACTIVE`) —
   bukan melanjutkan kerja di bawah v2 — dan hasilnya percuma (tidak akan
   pernah membuka Gate 2), tanpa peringatan apa pun saat itu terjadi.

Kesimpulan dari diskusi: filosofi `INACTIVE` (PLAN-EVAL-01) — "belum tentu
mati, bisa jadi pelengkap" — benar secara **konseptual**, tapi secara
**fungsional** chain yang sudah `INACTIVE` beku permanen untuk tujuan
governance (gate/close), tanpa mekanisme resume. Ini bukan model Git-branch;
ini juga bukan disiplin murni-kaku — ini celah tak-disengaja di antara
keduanya.

**Pemicu tambahan**: bug yang ditemukan Director di fitur
`getInactiveIntentWarnings()` (baru saja ditambahkan di PLAN-EVAL-01) —
fungsi itu memakai satu aturan blanket "bukan `SUPERSEDED` = masih
menggantung" di semua domain, padahal ROADMAP punya siklus hidup sendiri
(`DRAFT → ACTIVE → INACTIVE → LOCKED`) di mana `INACTIVE`/`LOCKED` sudah
jadi status istirahat yang **normal dan selesai** — beda dari Plan/Exec/
Close yang tidak punya ACTIVE/INACTIVE sendiri. Ini sudah diperbaiki secara
sempit (lihat commit terkait), tapi mengungkap masalah desain yang lebih
dalam: definisi ACTIVE/INACTIVE bercampur antar domain karena ACTIVE/INACTIVE
Roadmap dan "current" Intent adalah dua mekanisme berbeda yang kebetulan
memakai istilah sama.

---

## Keputusan Desain yang Disepakati Lewat Diskusi

### A. Pisahkan "LOCKED" (persetujuan, permanen) dari "ACTIVE" (target kerja saat ini, bisa dipindah)

Command baru: **`sigma activate <version>`** (mis. `sigma activate v1`,
`sigma activate v2`) — analog `git checkout`. Ini memungkinkan beberapa
Intent chain sama-sama `LOCKED` (disetujui/sah) sekaligus, tapi cuma satu
yang jadi target kerja "saat ini" — dipindah secara eksplisit lewat command
ini, bukan efek samping otomatis dari command lain.

### B. Gate & isolasi total per-chain — tidak ada kaitan apa pun antar chain

Ini keputusan paling mendasar (dikonfirmasi eksplisit oleh Director):
**semua sistem gate berlaku per-chain, bukan global.** Gate 1/1.5/2/3 untuk
chain v1 dihitung murni dari artifact-artifact di dalam chain v1;
mengaktifkan/menyupersede/mengunci apa pun di chain v2 **tidak boleh**
mempengaruhi status gate chain v1 sama sekali, dan sebaliknya. Tidak ada
perhitungan bersama, tidak ada state yang dibagi antar chain kecuali satu
pointer tunggal `active_chain` (lihat Desain Teknis).

### C. ACTIVE/INACTIVE Roadmap dihapus — bukan cuma diganti nama

Konsekuensi langsung dari isolasi total: ACTIVE/INACTIVE Roadmap ada
*khusus* untuk mengarbitrase "roadmap mana yang menang" di antara roadmap-
roadmap yang bersaing **secara global**. Begitu chain diisolasi total dan
Roadmap tetap 1:1 ke Intent (guard ini sudah ada dari
`registerRoadmapDraft()`), tidak ada lagi kompetisi lintas-chain untuk
diarbitrase. Roadmap disederhanakan mengikuti pola yang sama seperti
Plan/Exec/Close: **`DRAFT → LOCKED → SUPERSEDED`** saja. Tidak perlu
istilah pengganti — ikut pola yang sudah ada.

Konsekuensi ikutan: `INACTIVE` untuk **Intent** juga tidak perlu disimpan
sebagai state lagi (lihat Desain Teknis) — "aktif atau tidak" jadi murni
`data.active_chain === key`, dihitung saat itu juga, bukan field yang
di-mutasi.

### D. Command harian hanya "melihat" active_chain — jendela lintas-chain terpisah dan eksplisit

`sigma session bootstrap`, `sigma project status`, `sigma doctor` (laporan
rutinnya), dan semua command pembuatan/lock artifact (`plan new`, `plan
lock`, `exec new`, `close new`, dst.) **hanya beroperasi pada
`active_chain`** — tidak pernah menampilkan atau memodifikasi chain lain
secara implisit. Tidak ada flag override lintas-chain di command-command
ini (mis. `plan new --intent v1` **tidak diizinkan** saat `active_chain` =
v2) — untuk pindah target, harus `sigma activate v1` dulu, baru bertindak.
Ini menghilangkan ambiguitas "artifact baru ini dibuat di chain mana" secara
struktural, bukan lewat prompt konfirmasi (prompt yes/no dianggap terlalu
lemah — gampang di-klik tanpa mikir, dan tetap tidak menjawab pertanyaan
"chain mana yang dimaksud" di awal).

Command lintas-chain yang eksplisit disengaja (baru):

```
sigma chain list                 # semua chain + state ringkas (LOCKED/DRAFT/SUPERSEDED, gate summary)
sigma chain status --v v1        # detail penuh satu chain tanpa perlu activate dulu
```

**Konsekuensi terhadap PLAN-EVAL-01**: fitur `getInactiveIntentWarnings()`
yang baru saja ditambahkan (menampilkan info chain lain di `project
status`/`session bootstrap`/`doctor`) **melanggar prinsip D** dan perlu
dihapus dari laporan default begitu fitur ini diimplementasikan — digantikan
`sigma chain list`/`sigma chain status`, yang harus dipanggil sengaja.

---

## Desain Teknis

### Skema data — direkomendasikan: struktur ternest per-chain (bukan array datar)

Dua opsi dipertimbangkan dalam diskusi:

**Opsi A (lebih ringan)**: pertahankan array datar (`data.intent.versions`,
dst.) seperti sekarang, tambah `active_chain` di top-level, hitung gate
per-chain lewat fungsi yang difilter `intent_version_ref`. Diff lebih
kecil, tidak perlu migrasi skema besar — tapi isolasi cuma dijamin lewat
disiplin kode (persis kelas bug ACTIVE/INACTIVE Roadmap yang barusan
ditemukan), bukan struktur data.

**Opsi B (direkomendasikan)**: isolasi dijamin di level skema, bukan cuma
logika:

```ts
interface ProgressJson {
  schema_version: string;        // WAJIB naik — ini v2 skema, bukan patch
  project_id: string;
  project_name: string;
  active_chain: string | null;   // satu-satunya pointer lintas-chain, mis. "v2"
  created_at: string;
  updated_at: string;
  chains: Record<string, ChainState>;   // key = major version Intent, mis. "v1", "v2"
}

interface ChainState {
  intent: {
    state: 'DRAFT' | 'LOCKED' | 'SUPERSEDED';   // tidak ada INACTIVE lagi
    file?: string;
    created_at: string;
    updated_at: string;
    locked_at?: string;
    supersede_reason?: string;
  };
  roadmap: {
    state: 'DRAFT' | 'LOCKED' | 'SUPERSEDED';   // tidak ada ACTIVE/INACTIVE lagi
    file?: string;
    created_at: string;
    updated_at: string;
    locked_at?: string;
  } | null;                                      // 1:1, null kalau belum dibuat
  plan: PlanTracker;    // TETAP tracker multi-versi — banyak minor version wajar DALAM satu chain
  exec: ArtifactTracker;
  close: {
    state: 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
    file?: string;
    created_at: string;
    updated_at: string;
    locked_at?: string;
  } | null;                                      // 1:1, null kalau belum dibuat
  gates: {
    gate_1_open: boolean;
    gate_1_5_open: boolean;    // ROADMAP LOCKED untuk chain ini — saat ini implisit, diusulkan eksplisit
    gate_2_open: boolean;
    gate_3_satisfied: boolean;
  };
  runtime_invalid: RuntimeInvalidState;   // per-chain juga — konsisten prinsip isolasi
}
```

Alasan `intent`/`roadmap`/`close` jadi satu entry (bukan array) per chain:
chain itu sendiri *didefinisikan* oleh satu major version Intent, jadi tidak
perlu lagi array "versions" di dalamnya untuk domain-domain yang sudah 1:1
ke chain. `plan`/`exec` tetap tracker multi-versi karena di dalam SATU chain
tetap wajar ada banyak minor version berjalan iteratif (dan `plan
supersede` di dalam satu chain tetap valid, tidak berubah).

**Penyederhanaan bonus**: `supersedeIntentVersion()` (PLAN-EVAL-01) jadi
jauh lebih sederhana di skema baru — karena semua descendant sebuah chain
sudah otomatis berada di `ChainState` yang sama, cascade `intent supersede`
tinggal menandai satu `ChainState` (`intent`, `roadmap`, semua `plan`,
semua `exec`, `close`) jadi `SUPERSEDED`, tanpa perlu lagi menyaring lintas
tracker berdasar `*_version_ref` seperti sekarang.

### Perilaku `sigma activate <version>`

- Hanya bisa menargetkan chain yang `intent.state` masih `LOCKED` atau
  `DRAFT` (opsi diperdebatkan — lihat Isu Terbuka #5). Chain `SUPERSEDED`
  ditolak — itu status terminal permanen, beda dari sekadar "tidak
  diaktifkan".
- Mengubah **hanya** `data.active_chain`. Tidak memutasi `ChainState` mana
  pun. Tidak butuh `--director-confirm` (bukan aksi berisiko/merusak —
  lihat Isu Terbuka #7).

### Migrasi data existing

Semua project Sigma yang ada hari ini punya struktur array-datar tunggal
(single-chain implisit). Perlu migrasi otomatis satu-kali saat
`schema_version` lama terdeteksi: bungkus tracker existing ke dalam satu
entry `chains[<intent major aktif>]`, `active_chain` diisi versi Intent
yang saat ini `LOCKED`. Intent lama yang sudah `SUPERSEDED`/`INACTIVE`
(seperti kasus JLH) menjadi `ChainState` terpisah masing-masing, lengkap
dengan histori gate-nya sendiri — ini justru menyelesaikan kasus JLH secara
struktural (v1 jadi chain sendiri yang bisa di-`activate` lagi kapan saja).

---

## Isu Terbuka / Perlu Keputusan Director

1. **`project status` — ikut aturan D (cuma active chain) atau tetap ada
   ringkasan lintas-chain?** Mis. jumlah total chain yang masih terbuka/
   `LOCKED`. Belum diputuskan di diskusi ini.
2. **Numbering Plan/Exec lintas-chain**: apakah tiap chain restart
   numbering minor version-nya sendiri secara independen (mis. chain v1
   dan chain v2 sama-sama bisa punya "plan pertama"), atau tetap perlu
   keunikan tampilan lintas-chain (mis. label `FMN-PLAN v0.1 (chain v1)`
   vs `(chain v2)` supaya tidak membingungkan saat kedua chain sama-sama
   sedang dilihat lewat `sigma chain list`)?
3. **Apakah Roadmap masih perlu tahap `DRAFT` sebelum `LOCKED`?** Di dunia
   lama, DRAFT vs ACTIVE penting karena banyak Roadmap bisa eksis
   bersaing secara global. Di dunia baru (1:1 per chain, tidak ada
   kompetisi), apakah Roadmap sebaiknya langsung dibuat sah begitu dibuat
   (skip tahap DRAFT), atau tahap DRAFT tetap berguna untuk "menulis dulu,
   sahkan belakangan" dalam SATU chain yang sama?
4. **Migrasi `runtime_invalid`**: per-chain penuh (sesuai keputusan B), atau
   tetap ada satu rollup ringan di top-level untuk tampilan cepat
   (non-otoritatif, cuma agregasi)?
5. **Bisakah chain `SUPERSEDED` di-`activate` lagi?** Draf ini mengasumsikan
   tidak (SUPERSEDED = terminal permanen, beda dari sekadar "belum
   diaktifkan") — tapi ini belum dikonfirmasi eksplisit oleh Director.
6. **`sigma intent supersede` (PLAN-EVAL-01) di dunia multi-chain**: apakah
   konsepnya masih relevan sebagai command terpisah, atau apakah "chain
   yang sudah selesai dan tidak akan pernah dipakai lagi" cukup direpresentasikan
   lewat mekanisme lain? Rekomendasi awal: tetap relevan (SUPERSEDED tetap
   beda makna dari "tidak aktif") — tapi cascade-nya jadi jauh lebih
   sederhana di skema baru (lihat Desain Teknis).
7. **`--director-confirm` untuk `sigma activate`?** Draf ini mengasumsikan
   tidak perlu (cuma pointer, tidak memutasi artifact apa pun, blast
   radius kecil dibanding `intent supersede`) — tapi ini pola baru yang
   belum ada presedennya, layak dikonfirmasi eksplisit oleh Director
   mengingat `CLAUDE.md` Director Authorization Language cukup ketat soal
   kelas command apa yang butuh otorisasi.
8. **Migrasi spesifik proyek JLH**: dengan desain ini, proyek JLH akan
   bermigrasi jadi 2 chain (`v1`, `v2`). Apakah Director ingin proyek JLH
   jadi kandidat pertama migrasi manual/uji coba begitu fitur ini siap?
9. **Skala perubahan vs staging**: mengingat blast radius sangat besar
   (lihat Risiko), apakah implementasi sebaiknya dipecah jadi beberapa
   PLAN-EVAL bertahap (mis. dulu skema + migrasi, baru command activate,
   baru command chain list/status, baru pemangkasan getInactiveIntentWarnings),
   atau tetap satu paket besar?

---

## Risiko

- **Blast radius sangat besar** — hampir semua file yang disentuh
  PLAN-EVAL-01 perlu ditulis ulang cara resolve datanya: `intent.ts`,
  `plan.ts`, `exec.ts`, `close.ts`, `roadmap.ts`, `doctor.ts`,
  `reconstruct.ts`, `session.ts`, `project.ts`, plus seluruh
  `src/engine/progress.ts`. ini bukan penambalan, ini penulisan ulang
  mayoritas engine.
- **`schema_version` bump + migrasi wajib** — beda dari PLAN-EVAL-01 yang
  cuma menambah nilai enum, ini perubahan bentuk JSON top-level yang tidak
  backward-compatible. Setiap project existing (semuanya, karena
  multi-chain belum pernah ada) butuh migrasi satu-kali otomatis saat
  dibuka pertama kali dengan CLI versi baru. Migrasi yang salah bisa
  merusak project riil (termasuk JLH) — perlu backup otomatis + jalur
  rollback yang teruji ketat sebelum dianggap aman.
- **Regresi tersembunyi di command yang tidak jadi fokus utama** —
  command seperti `sigma override`, `sigma send`/mailbox, `sigma reference
  update` yang membaca `progress.json` secara tidak langsung
  (`versionForArtifact()` di [override.ts](../../src/commands/override.ts),
  dll.) perlu diaudit satu per satu, tidak cuma command inti governance.
- **Test suite existing (160 test, PLAN-EVAL-01) sebagian besar akan perlu
  ditulis ulang** — banyak fixture test memakai bentuk `progress.json` lama
  (array datar) secara langsung; migrasi skema berarti hampir semua
  fixture di `test/helpers.ts` perlu diperbarui juga.
- **Ini feature baru, bukan bugfix** — beda dari PLAN-EVAL-01 yang
  memperbaiki pelanggaran otorisasi yang sudah terjadi, PLAN-EVAL-02 adalah
  keputusan produk/arsitektur (menambah kapabilitas kerja paralel).
  Reversibility lebih rendah begitu project riil sudah bermigrasi ke skema
  baru — perlu dipastikan Director benar-benar menginginkan kapabilitas ini
  sebelum jalan, bukan cuma menutup celah yang ditemukan di diskusi.

---

## Draft Acceptance Criteria (SANGAT PRELIMINER — menunggu Isu Terbuka #1–9 diputuskan)

- [ ] `schema_version` dinaikkan; skema `ProgressJson` direstrukturisasi
  jadi `{ active_chain, chains: Record<string, ChainState> }` sesuai Opsi B.
- [ ] `IntentState` dan `RoadmapState` kehilangan nilai `INACTIVE`/`ACTIVE`
  masing-masing — jadi `'DRAFT' | 'LOCKED' | 'SUPERSEDED'` seragam di semua
  5 domain artifact.
- [ ] Command baru `sigma activate <version>` — memindah `active_chain`,
  menolak target yang `SUPERSEDED`.
- [ ] Command baru `sigma chain list` dan `sigma chain status --v
  <version>` — satu-satunya jendela lintas-chain yang disengaja.
- [ ] `sigma session bootstrap`, `sigma project status`, `sigma doctor`
  (laporan rutin) hanya membaca/menampilkan `chains[active_chain]`.
- [ ] `getInactiveIntentWarnings()` (PLAN-EVAL-01) dihapus dari laporan
  default; digantikan `sigma chain list`.
- [ ] Semua command pembuatan/lock artifact (`intent new/lock`, `roadmap
  new`, `plan new/lock/promote`, `exec new/lock`, `close new/lock`) tidak
  punya opsi override lintas-chain — selalu beroperasi pada `active_chain`.
- [ ] Gate 1/1.5/2/3 dan `runtime_invalid` dihitung/disimpan per-`ChainState`,
  nol perhitungan bersama antar chain.
- [ ] `supersedeIntentVersion()` disederhanakan jadi operasi satu-`ChainState`
  (tandai `intent`, `roadmap`, semua `plan`, semua `exec`, `close` di dalam
  chain yang sama jadi `SUPERSEDED`), masih wajib `--director-confirm`.
- [ ] Migrasi otomatis: setiap project dengan `schema_version` lama dibungkus
  jadi satu `ChainState` per major-version Intent yang pernah ada di
  historinya, dengan backup otomatis sebelum ditulis.
- [ ] Skenario regresi isolasi: memanipulasi chain manapun (activate,
  lock, supersede) tidak mengubah `gates`/`runtime_invalid` milik chain lain
  sama sekali.
- [ ] `npm test` lulus — mayoritas fixture di `test/helpers.ts` perlu ditulis
  ulang untuk bentuk skema baru.

---

## Dependency Catatan

- **Bergantung pada PLAN-EVAL-01** (sudah diimplementasikan) — terutama
  `supersedeIntentVersion()`, `registerCloseDraft()` 1:1 guard, dan konsep
  `INACTIVE` yang sekarang mau digantikan dengan pointer `active_chain`.
  PLAN-EVAL-01 tidak perlu di-revert; desain ini melanjutkan/menggantikan
  sebagian mekanismenya di skema baru.
- **`getInactiveIntentWarnings()`** (ditambahkan di PLAN-EVAL-01) akan
  dihapus sebagai bagian dari implementasi dokumen ini — dicatat eksplisit
  supaya tidak dianggap regresi tak-disengaja saat itu terjadi.
