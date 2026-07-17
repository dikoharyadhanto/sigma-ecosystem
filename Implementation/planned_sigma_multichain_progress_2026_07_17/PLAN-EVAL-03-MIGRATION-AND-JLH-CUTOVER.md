# PLAN-EVAL-03 — Migration Algorithm & JLH Cutover

**Sumber**: [DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md) (Konsolidasi Lanjutan bagian 13, "Implikasi ke migrasi JLH"; "Langkah Berikutnya")
**Tanggal**: 2026-07-17
**Status**: DRAFT — ringkas, belum didetailkan. Prioritas #3 — bukti nyata bahwa PLAN-EVAL-01 bekerja di project sungguhan.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

Algoritma migrasi satu-kali dari `Sigma/progress.json` lama (skema nested
single-file) ke skema multi-file baru (`Sigma/progress-v1.json` +
`Sigma/activate_status.json`) hasil PLAN-EVAL-01. **JLH
(`KLHK_JasaLingkunganHidup`) dikonfirmasi Director sebagai target migrasi
pertama** — dipakai sebagai uji coba nyata begitu implementasi siap.

## Scope

- Baca `progress.json` lama, tulis ulang jadi `progress-v1.json` (data
  intent/roadmap/close saat ini jadi objek tunggal; plan/exec tetap array
  dipindah apa adanya) + buat `activate_status.json` menunjuk ke chain itu.
- Guard pra-migrasi: tolak jalan kalau working tree git untuk `Sigma/`
  belum bersih (belum di-commit) — pengganti backup, sesuai keputusan
  PLAN-EVAL-02. Rollback = `git checkout`, bukan restore file `.bak`.
- Verifikasi hasil migrasi terhadap project JLH secara langsung sebagai
  acceptance test nyata (bukan cuma unit test sintetis).
- Tidak ada migrasi paksa/otomatis untuk project lain — opt-in/dipicu
  command, konsisten dengan preferensi Director soal migrasi bertahap
  (lihat pola serupa di PLAN-EVAL-01 folder `_07_17`, Isu Terbuka #4).

## Bentuk skema tujuan yang sudah final (dari implementasi PLAN-EVAL-01, 2026-07-17 — bukan tebakan lagi)

Algoritma migrasi harus menghasilkan `ChainState` persis sesuai bentuk di
`src/engine/chain.ts` (fungsi pembantu yang bisa dipakai langsung, bukan
menulis literal JSON manual: `createInitialChain()`, `writeChain()`,
`writeActivateStatus()`). Detail yang **berbeda dari asumsi awal** di baris
pertama scope di atas ("intent/roadmap/close jadi objek tunggal... plan/exec
dipindah apa adanya"):

- **`intent.state` lama bisa `INACTIVE`, tapi `IntentState` baru cuma
  `'DRAFT' | 'LOCKED' | 'SUPERSEDED'`** (PLAN-EVAL-01 §3.4 — INACTIVE
  dihapus total, konsekuensi struktural, bukan pilihan). Setiap entry
  `INACTIVE` di array `intent.versions` lama harus dipetakan ulang: kalau
  entry itu tidak pernah punya `supersede_reason` tercatat di mana pun
  (INACTIVE murni karena didemosi otomatis saat intent baru di-lock, bukan
  karena disupersede eksplisit) → jadi chain terpisah dengan
  `intent.state = 'LOCKED'` (bukan didemosi — di dunia chain terpisah tidak
  ada lagi "yang didemosi", setiap chain berdiri sendiri). Kalau memang
  pernah ada indikasi supersede (jarang di data lama, karena `intent
  supersede` baru ada belakangan) → `SUPERSEDED`. **Ini keputusan mapping
  yang perlu diverifikasi manual per-entry terhadap JLH, bukan aturan
  mekanis buta** — perilaku historis JLH sebelum PLAN-EVAL-01 tidak
  membedakan keduanya secara eksplisit dalam data.
- **`roadmap.state` lama bisa `ACTIVE`/`INACTIVE`, `RoadmapState` baru cuma
  `'DRAFT' | 'LOCKED' | 'SUPERSEDED'`** (PLAN-EVAL-01 §3.5). Karena 1:1
  per-chain, `ACTIVE`/`INACTIVE` (arbitrase kompetisi antar-roadmap) tidak
  berlaku lagi — mapping: `ACTIVE`/`INACTIVE` tanpa `supersede_reason` →
  `DRAFT` (belum di-lock lewat cascade `close lock`); kalau chain itu sudah
  closed (ada DIR-CLOSE LOCKED terkait) → `LOCKED`.
- **Field yang hilang total dari skema baru, jangan ikut dipindahkan**:
  `superseded_by` (di intent/roadmap/close — PLAN-EVAL-01 §3.2/§3.4, isolasi
  total artinya tidak ada pointer ke chain lain yang disimpan), dan
  `intent_version_ref` khusus di roadmap/close (selalu sama dengan
  `chain.intent.version` sendiri sekarang, redundan). `plan.intent_version_ref`
  dan `exec.plan_version_ref` **tetap ada** (plan/exec tidak berubah bentuk).
- **Field baru wajib ada**: `chain_version` (match nama file
  `progress-v<N>.json`), `schema_version` (level `ChainState`, bukan cuma
  level project).
- `project_id`/`project_name` **tidak ikut ke `ChainState`** — tetap hanya
  di `.sigma-identity.json` (sudah ada hari ini, tidak berubah).

## Konsekuensi `findProjectRoot()` — wajib ditangani migrasi (PLAN-EVAL-01 Fase 5, 2026-07-17)

`findProjectRoot()` sekarang menjangkar pada `Sigma/activate_status.json`,
**bukan lagi** `Sigma/progress.json` — proyek yang hanya punya `progress.json`
lama (belum pernah dimigrasikan) **tidak lagi dikenali CLI sama sekali**,
gagal dengan "Not inside a Sigma project" walau folder valid. Ini bukan bug,
memang disengaja (lihat PLAN-EVAL-01 §3.6/Fase 5) — tapi konsekuensinya
langsung untuk plan-eval ini: **migrasi WAJIB membuat `activate_status.json`
sebagai bagian dari transaksinya**, bukan opsional/langkah terpisah — tanpa
itu, project JLH pasca-"migrasi setengah jalan" (kalau proses mati di
tengah) jadi tidak bisa diakses `sigma` command apa pun sampai file itu ada.

## Interaksi dengan `doctor --reconstruct` yang masih di jalur lama (temuan PLAN-EVAL-01 Fase 4)

`doctor --reconstruct` (belum dimigrasikan, tetap scope PLAN-EVAL-05) masih
menulis ulang `Sigma/progress.json` dari nol setiap dijalankan (lewat
`reconstructProgress()`+`writeProgress()`, path lama). Kalau Director/AI
menjalankan `sigma doctor --reconstruct` pada project JLH **setelah**
migrasi ini selesai, itu akan **menghidupkan kembali** `progress.json` lama
(dengan isi hasil scan artifact, bukan isi sebelum migrasi) berdampingan
dengan `progress-v1.json` yang baru — membingungkan meski tidak merusak apa
pun (progress.json memang sudah jadi file mati, tidak dibaca command lain
manapun). **Rekomendasi**: dokumentasikan ini sebagai catatan operasional
untuk Director, atau pertimbangkan menghapus `Sigma/progress.json` lama
begitu migrasi sukses diverifikasi (bukan restore — cuma pembersihan, git
tetap jadi safety net kalau ternyata dibutuhkan lagi, sesuai prinsip
PLAN-EVAL-02).

## Dependency

- **PLAN-EVAL-01** (wajib) — skema tujuan migrasi belum ada tanpa ini. Sudah
  selesai diimplementasikan (2026-07-17) — lihat bentuk skema final di atas.
- **PLAN-EVAL-02** (wajib untuk pola rollback) — guard git-clean-tree
  menggantikan backup file yang tadinya jadi bagian algoritma migrasi.

## Di luar scope

- Redefinisi Gate 1.5/lifecycle Roadmap-Close — **sudah selesai di
  PLAN-EVAL-01 sendiri** (bukan PLAN-EVAL-04 lagi — lihat koreksi di
  dokumen PLAN-EVAL-04). Migrasi data ini cuma memindahkan bentuk data ke
  skema yang sudah final tersebut, tidak mengubah aturan gate lebih jauh.
- Keputusan eksplisit menjalankan `sigma intent supersede --v v1` di JLH
  (state historis Intent v1 JLH sudah `SUPERSEDED` dari fix PLAN-EVAL-01
  folder `_07_17`) — di luar cakupan command migrasi storage ini, tetap
  wewenang Director terpisah.
- Migrasi `doctor --reconstruct` itu sendiri — PLAN-EVAL-05.

## Risiko

- Project JLH adalah data produksi nyata — kesalahan migrasi berdampak
  langsung. Mitigasi: guard git-clean-tree + verifikasi manual `git diff`
  sebelum dan sesudah, dijalankan Director/AI dengan hati-hati, bukan
  otomatis tanpa review.
- **Baru**: keputusan mapping `INACTIVE`→`LOCKED`/`SUPERSEDED` dan
  `ACTIVE`/`INACTIVE` roadmap→`DRAFT`/`LOCKED` (lihat bagian skema di atas)
  tidak sepenuhnya mekanis — perlu tinjauan manual per-chain historis JLH,
  bukan aturan satu-baris yang aman diotomatisasi buta.
- **Baru**: kalau migrasi berhenti di tengah (mati sebelum
  `activate_status.json` tertulis), project JLH untuk sementara tidak
  dikenali `findProjectRoot()` sama sekali — perlu langkah recovery yang
  jelas didokumentasikan sebelum dijalankan terhadap data produksi.
