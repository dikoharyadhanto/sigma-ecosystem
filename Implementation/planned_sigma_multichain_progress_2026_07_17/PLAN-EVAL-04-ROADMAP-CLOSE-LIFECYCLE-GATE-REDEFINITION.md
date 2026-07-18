# PLAN-EVAL-04 — Roadmap/Close Lifecycle & Gate 1.5 Redefinition

**Sumber**: [DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md) (Konsolidasi Lanjutan bagian 8; Isu Terbuka Baru lanjutan #8)
**Tanggal**: 2026-07-17 — **HAMPIR SELURUH SCOPE DITEMUKAN SUDAH SELESAI oleh PLAN-EVAL-01, dicatat ulang 2026-07-17** (lihat "Koreksi Besar" di bawah). **Investigasi Isu Terbuka #8 sendiri sudah dilakukan langsung terhadap kode nyata 2026-07-17** — lihat "Temuan Investigasi Isu Terbuka #8" di bawah, baca **itu** duluan; itu bagian paling terkini dan berisi rencana implementasi konkret yang genuinely tersisa.
**Status**: DRAFT — scope asli 90% selesai (Koreksi Besar). Isu Terbuka #8 sudah diinvestigasi tuntas: ditemukan **satu celah nyata** (override cross-chain leak, lihat di bawah) plus konfirmasi bahwa sisanya sudah bersih. Rencana implementasi untuk celah itu sudah konkret — **menunggu approval eksplisit Director sebelum eksekusi kode**.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## KOREKSI BESAR (2026-07-17) — baca ini dulu

Draf awal dokumen ini (di bawah, dipertahankan apa adanya sebagai riwayat)
menulis seluruh scope-nya sebagai pekerjaan yang **akan** dilakukan
plan-eval ini. Saat PLAN-EVAL-01 diimplementasikan (Fase 3, 2026-07-17),
ditemukan fakta yang mengubah gambaran itu total: **`sigma close lock`
SUDAH memanggil `lockActiveRoadmap()` sebagai efek samping HARI INI, sebelum
migrasi apa pun dimulai** (dicek langsung di `src/commands/close.ts` versi
lama sebelum disentuh). PLAN-EVAL-01 sendiri sempat salah paham soal ini di
draf awalnya juga (mengira ini perilaku baru untuk PLAN-EVAL-04) — begitu
dikoreksi, jadi jelas: seluruh mekanisme cascade auto-lock roadmap itu
**perilaku existing yang wajib dipertahankan PLAN-EVAL-01** (prinsip "migrasi
storage, bukan migrasi perilaku"), bukan desain baru milik plan-eval ini.

**Status per item scope asli, dicek terhadap kode nyata setelah PLAN-EVAL-01 Fase 3**:

| Item scope asli | Status | Bukti |
| --- | --- | --- |
| Roadmap & Close tetap 3 state | **SELESAI** (di PLAN-EVAL-01) | `RoadmapState`/`CloseState` di `src/engine/chain.ts` sudah `'DRAFT' \| 'LOCKED' \| 'SUPERSEDED'` |
| Hapus model `ACTIVE`/`INACTIVE` roadmap | **SELESAI** (di PLAN-EVAL-01) | Struktural — dipaksa begitu roadmap jadi objek tunggal per chain (§3.5), bukan pilihan independen |
| Roadmap auto-`LOCKED` sebagai efek samping `close lock` | **SELESAI** (sudah ada sebelum PLAN-EVAL-01, dipertahankan) | `src/commands/close.ts` — `lockActiveRoadmap(chain)` dipanggil kondisional sebelum `lockActiveClose(chain)`, persis pola lama |
| Close tetap punya command `lock` eksplisit | **SELESAI** (tidak pernah berubah) | Tidak disentuh sejak awal |
| `SUPERSEDED` Roadmap/Close selalu cascade otomatis | **SELESAI** (di PLAN-EVAL-01) | `supersedeIntentVersion()` di `chain.ts` men-cascade roadmap+close sekaligus |
| Redefinisi Gate 1.5 ("roadmap ada dan belum SUPERSEDED") | **SELESAI** (di PLAN-EVAL-01, dipaksa) | `src/commands/plan.ts` — `getRoadmapPathIfEligible()`: `chain.roadmap !== null && chain.roadmap.state !== 'SUPERSEDED'` |
| Tinjau ulang gate/hubungan lain lintas-chain (Isu Terbuka #8) | **BELUM** — sengaja dideferred | Tidak disentuh PLAN-EVAL-01 sama sekali |

**Kesimpulan**: dari 6 item scope asli, 5 sudah selesai — bukan karena
plan-eval ini dikerjakan lebih dulu, tapi karena kelimanya ternyata
**konsekuensi terpaksa** dari migrasi storage PLAN-EVAL-01 sendiri (§3.5:
"bagian struktural... wajib ditangani di PLAN-EVAL-01"), bukan keputusan
desain independen yang bisa ditunda. **Scope plan-eval ini menyusut jadi
cuma Isu Terbuka #8** — lihat "Scope (setelah koreksi)" di bawah.

---

## Temuan Investigasi Isu Terbuka #8 (2026-07-17, terhadap kode nyata)

Investigasi dilakukan langsung terhadap `src/` (bukan asumsi dari dokumen
lain) sebelum plan ini ditulis ulang: dibaca penuh `src/engine/chain.ts`,
semua 9 file command (`intent.ts`, `roadmap.ts`, `plan.ts`, `exec.ts`,
`close.ts`, `doctor.ts`, `session.ts`, `project.ts`, `override.ts`),
`src/utils/roadmap.ts`, `src/utils/fs.ts` (`findProjectRoot`), plus test
suite terkait (`chain-engine.test.ts`, `chain-gate.test.ts`,
`doctor-invalid.test.ts`, `intent-list.test.ts`, `override-doctor.test.ts`).
Dijalankan juga `npx tsc --noEmit` (bersih) dan `npm test` (190/190 test,
25 file, semua PASS) sebagai baseline sebelum menyimpulkan apa pun.

### Temuan A — migrasi PLAN-EVAL-01 ternyata sudah 100% selesai, bukan cuma 90%

"Koreksi Besar" di atas (ditulis lebih awal, hari yang sama) sudah mencatat
5 dari 6 item scope asli selesai lewat cascade `close.ts`. Investigasi ini
menemukan progres lebih jauh lagi, terjadi di commit-commit setelah "Koreksi
Besar" itu ditulis (dicek `git log`):

- **Setiap** command file (bukan cuma `close.ts`) sudah pindah penuh ke
  `chain.ts` — termasuk `doctor` (mode default, Fase 4), `session
  bootstrap`, `project status`, `override` — bukan cuma `intent`/`roadmap`/
  `plan`/`exec`/`close` yang jadi fokus PLAN-EVAL-01 awal.
- `findProjectRoot()` ([fs.ts:27-42](../../src/utils/fs.ts#L27-L42)) **sudah**
  menjangkar ke `Sigma/activate_status.json`, bukan `progress.json` —
  berarti "Fase 5" yang di PLAN-EVAL-03 disebut sebagai konsekuensi yang
  "wajib ditangani migrasi" **sudah live di kode**, bukan lagi rencana.
- Seluruh mekanisme auto-backup (DISCUSSION "Konsolidasi Lanjutan" bagian
  13) **sudah dihapus** dari `project.ts`/`doctor.ts` — commit
  `2c80be4 refactor: remove backup functionality from project and doctor
  commands`, commit paling baru di riwayat repo saat ini. Keputusan yang
  didokumentasikan sebagai "belum diimplementasikan, menunggu plan-eval
  turunan" sudah dieksekusi duluan, di luar plan-eval manapun yang
  menyebutnya secara eksplisit.
- Satu-satunya bagian yang **sengaja** masih di jalur lama adalah
  `sigma doctor --reconstruct` (lewat `reconstruct.ts`/`progress.ts`) —
  dan ini **bukan temuan baru**, sudah ditandai eksplisit di kode sendiri
  ([doctor.ts:11-21](../../src/commands/doctor.ts#L11-L21)) sebagai
  scope PLAN-EVAL-05, dengan alasan teknis yang jelas (pekerjaannya
  *adalah* pekerjaan multi-chain PLAN-EVAL-05, tidak ada irisan aman untuk
  dipotong ke sini).

### Temuan B — celah nyata: `sigma override` bocor lintas-chain lewat `overrides.jsonl`

Ini satu-satunya temuan Isu Terbuka #8 yang genuinely baru dan actionable.

**Mekanisme bug**: `Sigma/memory/overrides.jsonl` adalah log flat
**project-wide**, bukan per-chain — `OverrideEntry`
([progress.ts:91-102](../../src/engine/progress.ts#L91-L102)) tidak punya
field pengenal chain sama sekali (`chain_version`/`intent_version` tidak
ada). `readOverrides(projectRoot)` ([progress.ts:157-172](../../src/engine/progress.ts#L157-L172))
membaca **seluruh** isi file, dari chain manapun, tanpa filter. Hasilnya
diteruskan apa adanya ke `runDoctorReconciliation(chain, overrides)` di
`doctor.ts`, yang memanggil `hasActiveOverrideForGate()`
([chain.ts:660-675](../../src/engine/chain.ts#L660-L675)) — fungsi ini
mencocokkan setiap entry ke **chain yang sedang diperiksa saat itu**, tanpa
tahu chain asal entry itu.

Untuk override DIR-INTENT, ini aman: `versionForArtifact()`
([override.ts:17-22](../../src/commands/override.ts#L17-L22)) selalu
mengisi `entry.version = chain.intent.version`, dan karena
`intent.version` selalu unik per chain (sama dengan `chain_version`),
pencocokan `entry.version === chain.intent.version` otomatis chain-scoped
lewat isi datanya sendiri.

Untuk override FMN-PLAN/DEV-EXEC dengan `entry.version` terisi, ini
**kebetulan** juga aman — dikonfirmasi lewat DISCUSSION bagian 7 (numbering
plan/exec: `planMajor = intentMajor − 1`, dan tiap chain cuma pernah punya
satu intent major sepanjang hidupnya) — jadi string versi plan/exec
(`v0.x`, `v1.x`, dst.) tidak akan pernah tabrakan antar chain, sehingga
pencocokan versi tetap chain-scoped secara implisit.

**Celahnya ada di cabang `entry.version` kosong/null**
([chain.ts:666-672](../../src/engine/chain.ts#L666-L672)):

```ts
if (entry.version) {
  const v = domain.versions.find(x => x.version === entry.version);
  return !!v && v.state === 'DRAFT';
}
return !domain.versions.some(v => v.state !== 'DRAFT');
```

`entry.version` kosong terjadi kalau Director meng-override Gate 2/Gate 3
**sebelum** ada draft FMN-PLAN/DEV-EXEC sama sekali di chain itu (mis.
langsung setelah `intent lock`, sebelum `plan new`) — skenario yang valid
dan reachable, bukan hipotetis (`describeBlockedGate()` di
`override.ts:24-47` memang mengizinkan override Gate 2/3 dalam kondisi
ini). Cabang fallback-nya lalu jadi: *"apakah chain yang sedang diperiksa
sekarang tidak punya satu pun versi plan/exec yang bukan DRAFT?"* — kondisi
yang otomatis **true** untuk chain manapun yang baru saja dibuat lewat
`intent new` (`chain.plan.versions` mulai dari array kosong,
`createInitialChain()` di [chain.ts:290-319](../../src/engine/chain.ts#L290-L319)).

**Skenario nyata**: Director meng-override Gate 2 di chain v1 sebelum
`plan new` pernah dijalankan (entry tertulis dengan `version: null`).
Chain v1 lanjut berjalan normal. Beberapa waktu kemudian Director membuka
chain v2 (`intent new`, auto-activate) dan mengunci intent-nya, tapi belum
sempat `plan new`. Kalau `sigma doctor` dijalankan di titik ini,
`hasActiveOverrideForGate('Gate 2')` menemukan entry lama milik chain v1,
mencocokkannya ke chain v2 (yang `plan.versions` masih `[]`), lolos cabang
fallback, dan **memaksa `gate_2_open = true` di chain v2** — padahal chain
v2 tidak pernah di-override sama sekali. Ini pelanggaran langsung prinsip
isolasi total yang jadi alasan Director memilih Opsi C.

**Kenapa belum ketahuan test suite yang ada**: `override-doctor.test.ts`
(satu-satunya test untuk mekanisme ini) cuma menguji skenario
single-chain dengan `entry.version` terisi (`chainWithDraftPlan()` selalu
menyediakan satu draft plan sebelum override dipanggil) — cabang
null-version dan skenario dua-chain sama sekali belum tersentuh test.

### Temuan C — sisanya bersih, tidak ada asumsi lintas-chain lain yang ditemukan

Ditinjau satu per satu, tidak ada temuan lain:

| Yang ditinjau | Hasil |
| --- | --- |
| Gate 1/2/3 boolean + `hasCleanGate2Chain`/`hasCleanGate3Chain` ([chain.ts:438-456](../../src/engine/chain.ts#L438-L456)) | Selalu membandingkan `intent_version_ref`/`plan_version_ref` terhadap `chain.intent.version` milik chain yang sama — tidak ada jalur ke chain lain. |
| Gate 1.5 (`getRoadmapPathIfEligible`, [plan.ts:54-57](../../src/commands/plan.ts#L54-L57)) | Sudah didefinisikan ulang sesuai DISCUSSION, dan sudah dipakai konsisten di `plan new`/`plan promote`. |
| `getNextValidOperations()` ([chain.ts:1122-1163](../../src/engine/chain.ts#L1122-L1163)) | Semua percabangan beroperasi murni pada satu `ChainState` yang diterima sebagai parameter; tidak ada baca implisit ke chain lain. Kombinasi state yang diuji `chain-engine.test.ts` (fresh DRAFT, roadmap exists, dst.) konsisten dengan logikanya. |
| `intent supersede`/`previewIntentSupersedeCascade`/cascade ([chain.ts:826-875](../../src/engine/chain.ts#L826-L875)) | Cascade murni dalam satu `ChainState` yang sama; `intent.ts` membaca chain target lewat `readChain(projectRoot, opts.v)` eksplisit, tidak pernah menyentuh chain lain sebagai side effect. |
| `resolveActiveChainVersion`/auto-default ([chain.ts:194-229](../../src/engine/chain.ts#L194-L229)) | Sesuai DISCUSSION bagian 12, sudah diuji `chain-engine.test.ts` untuk semua kombinasi (null, stale pointer, semua SUPERSEDED). |
| `session bootstrap`/`project status` | Keduanya baca `readActiveChain` sekali, tidak menggabungkan data dari chain lain. |
| `roadmap.ts`/`generateStageOverview` ([roadmap.ts:11-15](../../src/utils/roadmap.ts#L11-L15)) | Filter `intent_version_ref === chain.intent.version` sudah jadi no-op defensif yang benar (tidak mungkin ada entry plan milik chain lain masuk ke array yang sama). |
| `send.ts` (mailbox) | Tidak menyentuh `ChainState`/versi intent sama sekali — di luar cakupan lifecycle chain. |
| `docCheck.ts` | Tidak menyentuh `progress.json`/tracker versi sama sekali. |
| `Sigma/logs/operations.jsonl` | Cuma diakses untuk append (`project.ts`) dan tampilan (`report.ts`) — tidak pernah dibaca balik untuk keputusan gate, jadi tidak berisiko seperti `overrides.jsonl`. |

### Temuan D — dua item DISCUSSION yang belum diimplementasikan, tapi di luar scope Isu Terbuka #8

Ditemukan saat investigasi, dicatat supaya tidak hilang, **tapi bukan
"gate/relationship yang salah"** — ini fitur baru yang belum pernah
diberi nomor plan-eval, beda kategori dari Isu Terbuka #8:

- `--title`/`--focus` wajib di `sigma intent new` + auto-render
  `Sigma/design/intent-history.md` (DISCUSSION "Konsolidasi Lanjutan"
  bagian 5) — belum ada baris kode apa pun untuk ini di `intent.ts`.
- `sigma doctor --all-versions` (DISCUSSION "Konsolidasi Lanjutan" bagian
  4) — belum ada flag ini di `doctor.ts`.

Direkomendasikan Director memutuskan apakah dua ini butuh plan-eval baru
sendiri (mis. PLAN-EVAL-06/07) — di luar keputusan itu, **tidak
dimasukkan ke scope implementasi PLAN-EVAL-04 ini**.

---

## Scope (implementasi, hasil investigasi di atas)

Satu-satunya pekerjaan kode yang genuinely tersisa dan disetujui masuk
plan-eval ini — **Temuan B**:

1. **Tambah `chain_version: string` ke `OverrideEntry`**
   ([progress.ts:91-102](../../src/engine/progress.ts#L91-L102)) — field
   baru, bukan pengganti `version` yang sudah ada (yang tetap dipakai
   untuk pencocokan versi artifact di dalam chain itu).
2. **`override.ts`**: isi `chain_version: chainVersion` saat menulis
   `OverrideEntry` di `runOverride()` (`chainVersion` sudah tersedia dari
   `readActiveChain(projectRoot)`, tinggal diteruskan).
3. **`chain.ts`**: `runDoctorReconciliation()`/`hasActiveOverrideForGate()`
   filter `overrides` ke `entry.chain_version === chain.chain_version`
   **sebelum** logika pencocokan artifact yang sudah ada berjalan — ini
   menutup celah di cabang null-version sekaligus jadi defense-in-depth
   eksplisit untuk cabang versioned (yang saat ini aman by construction,
   bukan by contract).
4. **Kompatibilitas mundur**: entry lama di `overrides.jsonl` (ditulis
   sebelum field ini ada) tidak punya `chain_version` — treat sebagai
   **tidak cocok ke chain manapun** (fail-safe: lebih baik meng-under-
   authorize override lama daripada membiarkan simulasi 2026 kambuh),
   bukan treat sebagai wildcard yang cocok ke semua chain. Ini
   penyempitan yang aman terhadap perilaku hari ini, bukan perilaku baru
   yang bisa surprise Director — entry lama yang genuinely masih relevan
   tinggal di-override ulang.
5. **Test regresi baru** (`override-doctor.test.ts` atau file baru
   `override-chain-isolation.test.ts`) yang membuktikan skenario di
   Temuan B sudah tertutup: override Gate 2 di chain v1 sebelum ada plan
   draft (`version: null` di log lama/simulasikan lewat fixture), buat +
   lock intent chain v2 tanpa plan, jalankan `sigma doctor`, assert
   `gate_2_open` chain v2 tetap `false`.

Tidak ada perubahan lain di luar 5 poin di atas — Temuan C sudah
mengonfirmasi tidak ada celah lain yang perlu ditutup lewat kode.

## Dependency

- **PLAN-EVAL-01** (wajib, sudah selesai — dan ternyata lebih lengkap dari
  yang tercatat sebelumnya, lihat Temuan A) — `chain.ts`/`OverrideEntry`
  yang jadi target perubahan di sini adalah kode PLAN-EVAL-01 yang sudah
  jadi.
- Tidak bergantung pada PLAN-EVAL-03 (migrasi JLH) atau PLAN-EVAL-05
  (`doctor --reconstruct`) — celah Temuan B murni di jalur `chain.ts`/
  `override.ts` yang sudah aktif hari ini, lepas dari keduanya.

## Di luar scope

- Semua 5 item yang sudah SELESAI di tabel "Koreksi Besar" — jangan
  dikerjakan ulang.
- Perubahan storage/file layout — sudah selesai di PLAN-EVAL-01.
- Migrasi data project existing (JLH) — PLAN-EVAL-03 (**postponed**,
  Director sedang beda device saat plan ini ditulis, 2026-07-17).
- Migrasi `doctor --reconstruct` — PLAN-EVAL-05 (dikonfirmasi ulang lewat
  Temuan A/C, bukan temuan baru).
- Temuan D (`--title`/`--focus` + `intent-history.md`, `--all-versions`)
  — fitur baru belum bernomor, menunggu keputusan Director terpisah.

## Risiko

- **Kode yang disentuh (`hasActiveOverrideForGate`) adalah gate-safety-
  critical** — dipakai `runDoctorReconciliation` untuk memutuskan apakah
  gate boleh tetap dipaksa terbuka. Regresi di sini bisa dua arah: (a)
  gagal menutup celah Temuan B sepenuhnya, atau (b) terlalu ketat sehingga
  override yang sah (single-chain, kasus umum) berhenti bekerja — mitigasi:
  jalankan `override-doctor.test.ts` yang sudah ada (2 test, masih harus
  tetap PASS tanpa perubahan) berdampingan dengan test baru di poin 5,
  bukan menggantikannya.
- **Kompatibilitas mundur** untuk `overrides.jsonl` yang sudah ada di
  project manapun yang memakai Sigma hari ini (termasuk kemungkinan
  project ini sendiri) — poin 4 di atas (`chain_version` hilang → tidak
  cocok ke chain manapun) sudah dirancang sebagai fail-safe, tapi tetap
  perlu diverifikasi tidak ada override yang sedang aktif dan bergantung
  pada entry lama sebelum menjalankan `sigma doctor` pasca-perubahan ini
  di project manapun.
- Risiko skenario asli PLAN-EVAL-04 (5 dari 6 item struktural) sudah nol
  — sudah selesai lewat PLAN-EVAL-01, dikonfirmasi ulang Temuan A.

---

## Riwayat — draf asli sebelum koreksi (dipertahankan sebagai catatan, JANGAN dijadikan acuan implementasi)

### Inti (asli)

Di dunia 1:1 per-chain, model `ACTIVE`/`INACTIVE` Roadmap (arbitrase
kompetisi antar-roadmap) tidak relevan lagi — tidak ada lagi yang perlu
diarbitrase karena satu chain hanya punya satu Roadmap.

### Scope (asli, sudah selesai — lihat tabel koreksi di atas)

- Roadmap & Close tetap 3 state (`DRAFT`/`LOCKED`/`SUPERSEDED`) — bukan
  disederhanakan jadi 2.
- Hapus command `sigma roadmap lock` (tidak pernah ada) dan model
  `ACTIVE`/`INACTIVE` — Roadmap selalu `DRAFT` sepanjang chain berjalan
  (dashboard hidup, terus di-render ulang), baru otomatis jadi `LOCKED`
  sebagai efek samping saat `sigma close lock` berhasil.
- Close tetap punya command `lock` eksplisit — tidak berubah.
- `SUPERSEDED` untuk Roadmap maupun Close selalu otomatis (cascade dari
  `intent supersede --director-confirm`), tidak pernah manual. Chain yang
  ditinggalkan sebelum close: Roadmap lompat `DRAFT → SUPERSEDED` langsung.
- Redefinisi Gate 1.5: dari "ROADMAP harus `ACTIVE`" jadi "Roadmap untuk
  chain ini sudah dibuat (ada) dan belum `SUPERSEDED`" — begitu
  `sigma roadmap new` sukses sekali, Gate 1.5 terbuka permanen sampai chain
  berakhir.
- Tinjau ulang gate/hubungan lain yang mungkin diam-diam mengasumsikan
  hubungan lintas Intent major version (Isu Terbuka #8 — investigasinya
  sudah selesai, lihat "Temuan Investigasi Isu Terbuka #8" dan "Scope
  (implementasi, hasil investigasi di atas)" jauh di atas).
