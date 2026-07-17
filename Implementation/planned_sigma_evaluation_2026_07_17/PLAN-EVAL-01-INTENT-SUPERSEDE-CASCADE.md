# PLAN-EVAL-01 — Intent SUPERSEDED Requires Explicit Director Authorization (+ Cascade to Roadmap/Plan/Exec/Close)

**Sumber**: Laporan FMN dari proyek eksternal `KLHK_JasaLingkunganHidup` (project_id `JLH`), disampaikan ke sesi ini 2026-07-17; diverifikasi ke source code sigma-cli dan ke `progress.json` riil proyek tersebut; desain final disepakati lewat diskusi langsung dengan Director di sesi ini, termasuk temuan kritis dari Director sendiri (lihat "Temuan Kritis" di bawah).
**Tanggal**: 2026-07-17
**Status**: IMPLEMENTED (2026-07-17). Desain disetujui Director (lihat Isu Terbuka #1/#2/#3/#5 di bawah untuk keputusan final), diimplementasikan oleh Professional Mode di sesi yang sama. Lihat "Implementation Walkthrough" di bagian bawah dokumen ini untuk rincian file yang diubah, keputusan teknis saat implementasi, dan hasil `npm test`.
**Revisi**: Dokumen ini sudah dua kali direvisi total di sesi yang sama:

1. Draft awal ("DIR-CLOSE Version Drift Gap") — deteksi-drift + `--ack-context-drift`. Diganti karena tidak cukup (lihat riwayat diskusi).
2. Revisi kedua ("cascade otomatis di `lockActiveIntent()`") — diganti lagi setelah Director mengungkap **temuan yang lebih dalam**: cascade itu sendiri tidak boleh terpicu otomatis oleh `intent lock`, karena Intent men-supersede Intent lama saat ini **sudah** terjadi otomatis tanpa otorisasi eksplisit — dan itu sendiri adalah bug yang lebih berbahaya dari yang coba diperbaiki dokumen ini sejak awal.

**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Temuan Kritis — Ini yang Paling Berbahaya di Seluruh Topik Ini

**Intent yang sudah `LOCKED` bisa berubah jadi `SUPERSEDED` tanpa Director
pernah secara eksplisit menyatakan atau menyetujui itu.** Ini bukan
spekulasi — dikonfirmasi Director sendiri terjadi nyata di proyek
`KLHK_JasaLingkunganHidup`: Intent v1 berubah jadi `SUPERSEDED` di
`progress.json` pada saat Intent v2 dikunci, padahal Director **tidak
pernah** menyatakan atau menyetujui Intent v1 diubah jadi `SUPERSEDED`
pada saat itu terjadi — walau belakangan memang benar v1 seharusnya
begitu.

**Bukti kode**: `lockActiveIntent()` ([progress.ts:803-814](../../src/engine/progress.ts#L803-L814)):

```js
for (const v of data.intent.versions) {
  if (v.state === 'LOCKED') {
    v.state = 'SUPERSEDED';
    v.superseded_by = activeVersion;
    v.updated_at = now;
  }
}
```

Begitu `sigma intent lock` dipanggil untuk Intent DRAFT yang baru,
**Intent LOCKED sebelumnya apa pun otomatis jadi `SUPERSEDED`** —
unconditional, tanpa cabang kondisi, tanpa opsi lain. Dicek juga: **tidak
ada command `sigma intent supersede`** ([intent.ts](../../src/commands/intent.ts), `grep supersede` nihil) —
tidak ada jalur terpisah untuk operasi ini sama sekali. Satu-satunya cara
Intent jadi `SUPERSEDED` hari ini adalah efek samping tak-terhindarkan
dari mengunci Intent berikutnya.

**Ini melanggar `CLAUDE.md` sendiri.** Bagian *Director Authorization
Language* menyebut eksplisit: "Approval-class, lock, risk-acknowledgment,
**supersession**, and destructive commands require explicit Director
authorization before execution." Supersession disebut namanya secara
eksplisit di situ — tapi implementasi saat ini tidak memberi jalan sama
sekali untuk otorisasi terpisah, karena operasinya bahkan tidak berdiri
sendiri sebagai command yang bisa diotorisasi.

**Kenapa ini lebih parah dari sekadar "kurang flag `--director-confirm`"**:
`sigma plan supersede` juga tidak punya `--director-confirm` (lihat
Risiko), tapi setidaknya dia command **eksplisit dan bernama** — AI
role yang mengikuti *CLI Operator Model* di `CLAUDE.md` ("Identify the
next valid CLI command. State whether it requires Director authorization.
Ask if the Director wants you to run it.") setidaknya punya titik nyata
untuk berhenti dan bertanya. Supersede Intent **tidak punya titik itu
sama sekali** — dia menumpang di `sigma intent lock`, command rutin yang
deskripsinya cuma "Lock active DIR-INTENT (opens Gate 1, lifecycle →
BUILD)", **tidak mengungkap** bahwa Intent lain akan ikut berubah status.
Bahkan AI role yang paling patuh sekalipun tidak akan tahu untuk bertanya,
karena tidak ada sinyal apa pun di permukaan command bahwa efek samping
ini ada.

**Kesalahpahaman konsep yang mendasarinya**: Intent baru **tidak berarti
otomatis membatalkan Intent lama**. Intent baru bisa jadi kelanjutan atau
pelengkap dari Intent sebelumnya, bukan penggantinya. `SUPERSEDED` adalah
pernyataan konseptual yang berat ("ini sudah tidak berlaku") — sehingga
hanya boleh dipicu oleh operasi eksplisit yang disetujui Director secara
sadar, bukan efek samping otomatis dari operasi lain.

### Temuan Tambahan — Close Kena Pola yang Sama (Director diminta cek, ternyata memang ada)

Dicek satu per satu terhadap semua fungsi `lock*` di
[progress.ts](../../src/engine/progress.ts): **Plan** (`lockOldestPlanDraft()`,
[progress.ts:886-902](../../src/engine/progress.ts#L886-L902)), **Exec**
(`lockActiveExec()`, [progress.ts:1035-1047](../../src/engine/progress.ts#L1035-L1047)),
dan **Roadmap** (`lockActiveRoadmap()`, [progress.ts:1159-1170](../../src/engine/progress.ts#L1159-L1170))
semuanya **bersih** — tidak ada loop auto-supersede tersembunyi.

Tapi **`lockActiveClose()`** ([progress.ts:1080-1101](../../src/engine/progress.ts#L1080-L1101))
punya loop yang **persis sama** dengan `lockActiveIntent()`:

```js
for (const v of data.close.versions) {
  if (v.state === 'LOCKED') {
    v.state = 'SUPERSEDED';
    v.superseded_by = activeVersion;
    ...
  }
}
```

Begitu DIR-CLOSE baru dikunci, DIR-CLOSE `LOCKED` sebelumnya (kalau ada)
otomatis `SUPERSEDED` tanpa otorisasi apa pun — skala lebih kecil dari
Intent, tapi bug yang sama persis.

**Root cause-nya kenapa cuma Close yang kena**: `registerCloseDraft()`
([close.ts:82](../../src/commands/close.ts#L82)) memakai `nextMajorVersion()`
sehingga Close punya lineage nomor versinya sendiri (v1, v2, v3...), dan
**tidak ada penjagaan** yang mencegah draft DIR-CLOSE kedua dibuat untuk
Intent yang sama — beda dari `registerRoadmapDraft()` yang eksplisit
menolak Roadmap kedua untuk Intent major version yang sama. Karena
Roadmap dijaga di titik pembuatan, `lockActiveRoadmap()` tidak pernah
butuh loop supersede. Close kehilangan penjagaan yang sama, jadi
`lockActiveClose()` "terpaksa" punya loop supersede sebagai penambal di
titik lock — dengan risiko yang sama seperti Intent.

**Perbaikannya sejalan dengan desain yang sudah disepakati** (Close 1:1
ke Intent, lihat Keputusan Desain A/B di bawah): `registerCloseDraft()`
perlu penjagaan yang sama seperti `registerRoadmapDraft()` — tolak draft
DIR-CLOSE baru untuk Intent yang sama kalau sudah ada draft/LOCKED
sebelumnya yang belum `SUPERSEDED` (lewat cascade Intent). Begitu
penjagaan ini ada, loop auto-supersede di `lockActiveClose()` jadi tidak
akan pernah kepakai — dihapus sebagai bagian fix ini juga.

---

## Bukti dari Proyek Riil (`KLHK_JasaLingkunganHidup`)

Diverifikasi langsung terhadap `Sigma/progress.json` proyek tersebut
(2026-07-17):

- Intent v1 `SUPERSEDED` → v2 `LOCKED`. **Director mengonfirmasi langsung**:
  tidak pernah menyatakan atau menyetujui Intent v1 diubah jadi
  `SUPERSEDED` pada saat itu terjadi — itu murni efek samping otomatis
  `intent lock` untuk v2, bukan keputusan sadar yang diambil terpisah.
  Belakangan memang benar v1 seharusnya `SUPERSEDED` (proyek memang pivot
  scope) — tapi itu kesimpulan yang baru valid **setelah fakta**, bukan
  sesuatu yang disetujui **pada saat** transisi state terjadi.
- Plan/Exec v0.1–v0.3 (terikat Intent v1) masih `DRAFT` dengan
  `stale_intent: true` — flag lunak, tidak pernah jadi `SUPERSEDED`
  sungguhan.
- Roadmap v1 (terikat Intent v1) jadi `INACTIVE` lewat aksi manual
  `roadmap activate v2` — bukan efek otomatis dari Intent pivot.
- DIR-CLOSE v1 (terikat Intent v1) masih `DRAFT`, menggantung — tidak ada
  mekanisme apa pun yang menyentuhnya.
- `sigma close check` dijalankan langsung di proyek ini, hasilnya
  `Lock readiness: Eligible with warnings` — **tidak ada sinyal apa pun**
  soal mismatch. `sigma close lock` hari ini akan meloloskannya.

---

## Root Cause

**Akar utama (Temuan Kritis di atas)**: `lockActiveIntent()`
([progress.ts:803-814](../../src/engine/progress.ts#L803-L814)) men-supersede
Intent lama secara otomatis, unconditional, tanpa command terpisah, tanpa
otorisasi eksplisit.

**Akar kedua (efek berantai dari akar pertama)**: bahkan dengan asumsi
supersede Intent itu sah, turunannya (Roadmap, Plan, Exec, Close) tidak
konsisten menanggapi:

1. **Plan/Exec** — `propagateStaleIntent()` ([progress.ts:783-801](../../src/engine/progress.ts#L783-L801))
   cuma menempel flag lunak `stale_intent: true`, tidak mengubah `state`.
2. **Roadmap** — punya jalur `activate` manual (ACTIVE↔INACTIVE), tidak
   pernah otomatis `SUPERSEDED` walau `RoadmapState`
   ([progress.ts:12](../../src/engine/progress.ts#L12)) sudah
   mendeklarasikan `'SUPERSEDED'` sebagai state valid — dideklarasikan
   tapi tidak pernah dipakai.
3. **Close** — tidak ada mekanisme apa pun. Tidak menyimpan
   `intent_version_ref`, tidak pernah disentuh propagasi maupun supersede
   manual.

**Kasus kembar**: `sigma intent new` setelah `lifecycle_state === 'CLOSED'`
([intent.ts:37-56](../../src/commands/intent.ts#L37-L56)) memicu alur
"reopen" — begitu Intent baru itu di-lock, `lockActiveIntent()` cuma reset
`lifecycle_state → BUILD`, tidak pernah menyentuh DIR-CLOSE lama yang
sudah **LOCKED** dari closure sebelumnya. Sama persis gap-nya, titik
masuk beda (reopen vs pivot pertengahan-BUILD) — keduanya lewat fungsi
yang sama.

---

## Keputusan Desain yang Disepakati

### A. Intent SUPERSEDED jadi operasi eksplisit, terpisah dari `intent lock`

1. **`sigma intent lock` berhenti auto-supersede.** Mengunci Intent DRAFT
   baru tidak lagi mengubah status Intent LOCKED sebelumnya. `active_version`/
   `active_state` tetap pindah ke Intent yang baru dikunci (itu yang
   dipakai gate/lifecycle), tapi Intent lama **tidak dihapus/diubah** —
   cuma bergeser dari "aktif" jadi "tidak aktif", dengan cara yang tidak
   merusak apa pun.

2. **State baru: `INACTIVE`** ditambahkan ke `IntentState`
   (saat ini `'DRAFT' | 'LOCKED' | 'SUPERSEDED'` di
   [progress.ts:8](../../src/engine/progress.ts#L8), jadi
   `'DRAFT' | 'LOCKED' | 'INACTIVE' | 'SUPERSEDED'`). Meniru pola yang
   sudah ada persis di `RoadmapState`. `INACTIVE` = "bukan fokus saat ini",
   tidak menyiratkan pembatalan, tidak memicu cascade apa pun.
   `lockActiveIntent()` mentransisikan Intent LOCKED lama → `INACTIVE`
   (bukan `SUPERSEDED`), sebagai pengganti loop yang sekarang ada.

3. **Command baru: `sigma intent supersede --v <version> --reason <reason> --director-confirm`**
   (pola `plan supersede`, plus gate otorisasi eksplisit). **Satu-satunya**
   jalur Intent jadi `SUPERSEDED` sungguhan. Wajib `--director-confirm`
   (beda dari `plan supersede` yang tidak punya gate ini — lihat Risiko
   soal kenapa Intent butuh gate lebih ketat) karena blast radius-nya
   mencakup seluruh cascade di bawah (poin B).
   Preflight sebelum eksekusi wajib menampilkan **daftar lengkap** apa
   yang akan ikut ter-cascade (mirip preflight `close lock`) — termasuk
   artifact yang sudah `LOCKED` — sebelum Director mengonfirmasi.

### B. Cascade — dipindah dari `lockActiveIntent()` ke `supersedeIntentVersion()` (baru)

Isi cascade-nya **tidak berubah** dari rancangan sebelumnya, cuma titik
pemicunya pindah dari otomatis (`intent lock`) ke eksplisit
(`intent supersede --director-confirm`):

- **Prinsip umum**: `SUPERSEDED` independen cuma untuk artifact dengan
  lineage banyak-versi di bawah parent tetap (**Intent**, **Plan**).
  Artifact 1:1 ketat ke parent-nya (**Roadmap**→Intent, **Close**→Intent,
  **Exec**→Plan) tidak boleh punya mekanisme `SUPERSEDED` sendiri, cuma
  cascade murni.
- **Cascade berlaku untuk semua state, termasuk `LOCKED`** — Plan/Exec/
  Roadmap/Close yang sudah `LOCKED` di bawah Intent yang disupersede tetap
  ikut jadi `SUPERSEDED`, sesuai keputusan sebelumnya.
- **`stale_intent`/`--ack-stale-intent` dihapus total**, digantikan
  cascade ini. `evaluateCloseChain()` jadi lebih sederhana (cukup cek
  chain `LOCKED` ada, tanpa cabang `isStale`).
- **`sigma plan supersede` tetap ada** (Plan punya lineage sah) —
  sekarang ini jadi **jalur kedua** menuju cascade yang sama, di samping
  `intent supersede` (kalau Plan disupersede manual tanpa Intent-nya
  ikut, cascade cuma sampai Exec, tidak menyentuh Roadmap/Close — itu
  perilaku `plan supersede` yang sudah ada, tidak berubah).
- **`sigma exec supersede` (command manual berdiri sendiri) dihapus** —
  Exec 1:1 ke Plan, tidak boleh punya jalur `SUPERSEDED` independen.
  `supersedeExecVersion()` ([progress.ts:1050-1058](../../src/engine/progress.ts#L1050-L1058))
  ikut dihapus (tidak dipakai cascade manapun — cascade Plan→Exec sudah
  punya logika inline sendiri).

### C. Prinsip Cakupan Cascade — Searah ke Bawah, Tidak Pernah Bocor Keluar Chain

Prinsip tambahan yang mengikat semua cascade di dokumen ini (diputuskan
eksplisit oleh Director): **`SUPERSEDED` cuma boleh menjalar ke bawah, di
dalam satu chain version yang sama — tidak pernah otomatis mempengaruhi
apa pun di luar chain itu, dan tidak pernah menjalar ke atas.**

- **Major version (Intent) `SUPERSEDED`** → seluruh chain di bawahnya
  (major version itu sendiri + minor version chain-nya: Roadmap, Plan,
  Exec, Close yang terikat padanya) otomatis ikut `SUPERSEDED`. Ini
  cascade **ke bawah**, di dalam satu chain — persis Poin B di atas.
- **Minor version chain (Plan) `SUPERSEDED`** → dokumen minor version lain
  yang jadi turunannya (Exec) ikut terpengaruh. Tapi **tidak pernah**
  menjalar ke atas dan men-supersede major version chain (Intent) yang
  menaunginya. Men-supersede satu Plan (lewat `plan supersede`) tidak
  boleh mengubah status Intent sama sekali.
- **Antar-chain yang tidak berhubungan tidak boleh saling
  mempengaruhi**: men-supersede Intent v1 tidak boleh menyentuh apa pun
  yang terikat ke Intent v2 (atau versi lain mana pun) — cascade harus
  match persis pada `intent_version_ref`/`plan_version_ref` milik chain
  yang disupersede, bukan menyapu semua entry.

**Verifikasi terhadap desain yang sudah ada di dokumen ini**: prinsip ini
sudah otomatis dipatuhi oleh rancangan Poin B dan `supersedePlanVersion()`
yang sudah ada — cascade Intent→{Roadmap,Plan,Exec,Close} dan
Plan→Exec keduanya searah ke bawah, dan keduanya match berdasarkan
`*_version_ref` spesifik (bukan menyapu seluruh tracker). Tidak ada
perubahan desain yang dibutuhkan — prinsip ini ditulis eksplisit di sini
supaya jadi kontrak yang diuji (lihat Draft Acceptance Criteria) dan jadi
rambu untuk implementasi/perluasan Sigma di masa depan, supaya tidak ada
yang tergoda menambahkan cascade ke atas atau cascade lintas-chain nanti.

---

## Desain Teknis

### Titik pemicu dipisah jadi dua

- **`lockActiveIntent()`** ([progress.ts:803](../../src/engine/progress.ts#L803)) —
  Intent LOCKED lama → `INACTIVE`. Tidak ada cascade ke turunan mana pun
  di sini lagi.
- **`supersedeIntentVersion(data, version, reason)`** (baru, pola sama
  seperti `supersedePlanVersion()` di [progress.ts:948](../../src/engine/progress.ts#L948)) —
  target versi (`LOCKED` atau `INACTIVE`) → `SUPERSEDED`, lalu cascade
  penuh ke Roadmap → Plan → Exec → Close yang `intent_version_ref`-nya
  menunjuk ke versi itu. Dipanggil dari `sigma intent supersede` di
  `intent.ts` (subcommand baru), wajib `--director-confirm`.

### Urutan cascade di dalam `supersedeIntentVersion()`

1. **Roadmap** — versi dengan `intent_version_ref === targetVersion` dan
   `state !== 'SUPERSEDED'` → `state = 'SUPERSEDED'`. Kalau itu
   `data.roadmap.active_version`, `active_state` ikut di-set.
2. **Plan** — versi dengan `intent_version_ref === targetVersion` dan
   `state !== 'SUPERSEDED'` → `state = 'SUPERSEDED'`, `supersede_reason`
   diisi pesan cascade.
3. **Exec** — versi yang `plan_version_ref`-nya menunjuk Plan yang baru
   tercascade di langkah 2 → `state = 'SUPERSEDED'` (reuse logika yang
   sudah ada di `supersedePlanVersion()`).
4. **Close** — versi dengan `intent_version_ref === targetVersion` dan
   `state !== 'SUPERSEDED'` → `state = 'SUPERSEDED'`.

`superseded_by` **tidak** diisi untuk entry yang tercascade (Plan/Exec/
Roadmap/Close) — cukup `supersede_reason`. Untuk Intent sendiri,
`superseded_by` **opsional**: karena Director bisa men-supersede Intent
tanpa penggantinya sudah ada (mis. "Intent ini saya batalkan, belum ada
penggantinya"), field ini cuma diisi kalau ada Intent `LOCKED`/`DRAFT`
lain yang jelas jadi penggantinya saat command dijalankan — kalau tidak
ada, dibiarkan kosong.

### Prasyarat schema

- `IntentState` ([progress.ts:8](../../src/engine/progress.ts#L8)) —
  tambah `'INACTIVE'`.
- `registerCloseDraft()` ([progress.ts:1062-1078](../../src/engine/progress.ts#L1062-L1078)) —
  mulai menyimpan `intent_version_ref` (field sudah ada di
  `ArtifactVersion`, tinggal diisi untuk `close`), **dan** tambah
  penjagaan 1:1 seperti `registerRoadmapDraft()` (tolak draft baru untuk
  Intent yang sudah punya entry close belum-`SUPERSEDED`).
- `lockActiveClose()` ([progress.ts:1080-1101](../../src/engine/progress.ts#L1080-L1101)) —
  hapus loop auto-supersede close lama (lihat "Temuan Tambahan" di atas);
  begitu penjagaan di atas ada, loop ini tidak akan pernah kepakai lagi.
- `RoadmapState` ([progress.ts:12](../../src/engine/progress.ts#L12)) —
  tidak perlu diubah, `'SUPERSEDED'` sudah ada.

### Preflight `sigma intent supersede`

Wajib (bukan opsional) menampilkan sebelum minta `--director-confirm`:
daftar Roadmap/Plan/Exec/Close yang akan ikut `SUPERSEDED`, ditandai jelas
mana yang sudah `LOCKED` (pekerjaan selesai yang ikut ke-relabel). Pola
sama seperti preflight `close lock` yang sudah ada
([close.ts:123-135](../../src/commands/close.ts#L123-L135)).

---

## Katalog Ancaman — Tercakup vs Tersisa

1. **Intent SUPERSEDED tanpa otorisasi eksplisit (Temuan Kritis)** — ✅
   tertutup. Sekarang butuh command terpisah + `--director-confirm`.
2. **Pivot Intent di tengah draft DIR-CLOSE (kasus JLH)** — ✅ tertutup,
   **tapi sekarang bersyarat**: cuma tertutup kalau Director benar-benar
   menjalankan `intent supersede` secara eksplisit. Kalau Director cuma
   `intent lock` (Intent lama jadi `INACTIVE`, bukan `SUPERSEDED`), DIR-CLOSE
   lama **tetap DRAFT dan tetap bisa di-lock** — karena secara desain,
   Intent yang `INACTIVE` belum tentu "mati", jadi turunannya sengaja
   tidak di-cascade. Ini konsekuensi yang benar sesuai prinsip Director
   ("Intent baru bisa jadi pelengkap"), tapi berarti **tidak ada proteksi
   otomatis** kalau Director lupa menjalankan `intent supersede` padahal
   niatnya memang mengganti arah. Lihat Isu Terbuka #1.
3. **Roadmap berganti tanpa Intent berubah** — tetap di luar cakupan,
   tidak berubah dari draf sebelumnya.
4. **DIR-CLOSE nganggur lama di Intent yang sama** — tetap di luar
   cakupan, tidak berubah.
5. **Pivot berantai (v1→v2→v3)** — ✅ tertutup **per pivot yang memang
   disupersede eksplisit**. Kalau beberapa pivot terjadi tapi Director
   cuma `intent lock` berulang tanpa pernah `intent supersede`, semuanya
   cuma jadi `INACTIVE` berjejer — tidak salah, tapi tidak ada cascade
   sampai eksplisit dijalankan.
6. **Risiko meta — rantai kepercayaan AI-operator** — ✅ tertutup untuk
   kasus di mana `intent supersede` memang dijalankan. Untuk kasus Intent
   cuma `INACTIVE` (belum di-supersede), `close check` akan tetap
   melaporkan `Eligible` untuk DIR-CLOSE yang terikat ke Intent `INACTIVE`
   itu — **ini bukan bug**, karena secara desain `INACTIVE` bukan `SUPERSEDED`,
   dan Close yang terikat Intent `INACTIVE` (bukan `SUPERSEDED`) memang
   belum tentu salah untuk tetap di-lock (tergantung apakah Intent itu
   benar mati atau cuma "sedang tidak fokus"). Ini bedanya dengan
   Temuan Kritis: dulu masalahnya adalah *supersede terjadi tanpa
   persetujuan*; sekarang, kalau memang belum di-supersede, sistem dengan
   sengaja tidak menganggapnya basi.

---

## Isu Terbuka / Perlu Keputusan Director

**Keputusan Director (2026-07-17, sebelum implementasi)**:

1. **#1 (warning non-blocking)** → **Ya, tambahkan.** Diimplementasikan sebagai
   `getInactiveIntentWarnings()` di `progress.ts`, ditampilkan di
   `sigma project status`, `sigma session bootstrap`, dan `sigma doctor`.
2. **#2 (`--director-confirm` sebagai preseden kedua)** → **Ya, setuju.**
   `sigma intent supersede` wajib `--director-confirm`, sesuai desain awal.
3. **#3 (Close menyimpan `roadmap_version_ref`)** → **Tidak, di luar
   cakupan.** Tidak diimplementasikan; Close tetap hanya menyimpan
   `intent_version_ref`.
4. **#4 (migrasi data existing)** → **Tidak ada migrasi paksa**, sesuai
   rekomendasi awal. Tidak berubah.
5. **#5 (normalisasi proyek JLH)** → **Ditunda.** Director akan memutuskan
   kapan menjalankan `sigma intent supersede --v v1` di proyek JLH setelah
   fix ini tersedia; tidak dieksekusi sebagai bagian dari sesi implementasi
   ini.

Rincian teks asli isu-isu ini (sebelum keputusan) tetap disimpan di bawah
untuk konteks historis:

1. **Konsekuensi dari #A.1**: karena `intent lock` tidak lagi otomatis
   menyupersede, **tidak ada lagi jaminan otomatis** bahwa turunan Intent
   lama akan pernah di-cascade — itu jadi sepenuhnya tergantung Director
   ingat menjalankan `intent supersede` secara terpisah. Apakah ini
   trade-off yang diterima (lebih aman dari sisi "tidak ada state berubah
   tanpa izin", tapi butuh disiplin Director untuk benar-benar
   menyupersede saat memang berniat begitu), atau perlu semacam
   pengingat/warning (bukan blocking) di `sigma project status`/`sigma
   doctor` kalau ada Intent `INACTIVE` yang punya turunan `LOCKED`/`DRAFT`
   menggantung dalam waktu lama?
2. **`--director-confirm` untuk `intent supersede` vs pola command lain**:
   sesuai catatan proyek yang sudah ada, command lock lain di Sigma
   sengaja **tidak** punya gate `--director-confirm` (otorisasi
   ditegakkan lewat disiplin percakapan AI-Director, bukan kode — lihat
   `override.ts` sebagai satu-satunya preseden kode-enforced sebelum ini).
   `intent supersede` diusulkan **jadi preseden kedua** yang code-enforced,
   karena blast radius-nya jauh lebih besar (bisa menyentuh artifact
   `LOCKED` di 4 domain sekaligus). Apakah Director setuju
   `intent supersede` layak jadi pengecualian kedua ini?
3. **Roadmap yang di-`activate` manual**: sama seperti draf sebelumnya,
   masih terbuka apakah Close perlu menyimpan `roadmap_version_ref` juga.
4. **Migrasi data existing**: sama seperti draf sebelumnya — proyek lama
   dengan `stale_intent: true` dibiarkan (tidak ada migrasi paksa),
   rekomendasi tidak berubah.
5. **Proyek JLH spesifik**: dengan desain baru ini, apakah Director
   ingin **secara eksplisit** menjalankan `sigma intent supersede --v v1`
   di proyek JLH nanti (setelah fix ini ada) untuk menormalkan state-nya
   secara resmi — mengingat Director sendiri sudah menyatakan "pada
   akhirnya memang Intent v1 itu superseded"? Ini akan jadi kesempatan
   pertama command baru ini dipakai dengan persetujuan eksplisit yang
   sebelumnya tidak pernah diberikan.

---

## Dependency Catatan

- Tidak bergantung pada `planned_sigma_evaluation_2026_07_14` maupun
  `2026_07_15` — domain berbeda.
- Revisi internal dokumen ini sendiri menggantikan dua draft sebelumnya
  di sesi yang sama (lihat "Revisi" di atas) — tidak ada dokumen lain
  yang bergantung pada draft yang diganti.

---

## Risiko

- **Proyek JLH tetap rawan sampai fix ada DAN Director eksplisit
  menjalankan `intent supersede`** — bahkan setelah fix ini
  diimplementasikan, kalau Director tidak menjalankan
  `sigma intent supersede --v v1` secara eksplisit, DIR-CLOSE v1 di JLH
  **tetap** `DRAFT` dan tetap bisa di-lock (karena Intent v1 di data
  historisnya sudah kadung `SUPERSEDED` dari sebelum fix ini — bukan
  `INACTIVE` — jadi migrasi/normalisasi data JLH perlu dipikirkan
  terpisah, di luar cakupan kode ini). Mitigasi tetap sama: jangan
  jalankan `sigma close lock` di JLH sampai ini semua beres.
- **`sigma plan supersede` dan `sigma exec supersede` (sebelum dihapus)
  juga tidak punya `--director-confirm`** — gap yang sama dengan Intent,
  cuma lebih kecil blast radius-nya. Dokumen ini cuma menambal Intent
  (karena itu yang paling berbahaya dan sudah terbukti kena di JLH);
  apakah `plan supersede` juga perlu gate yang sama adalah pertanyaan
  terbuka **di luar cakupan** dokumen ini.
- **Breaking change CLI**: `--ack-stale-intent` dan `sigma exec supersede`
  dihapus; `sigma intent supersede` adalah command baru dengan gate wajib
  yang sebelumnya tidak ada jalurnya sama sekali (jadi bukan breaking
  dalam arti "mengubah command lama", tapi mengubah cara satu-satunya
  Intent bisa di-supersede).

---

## Draft Acceptance Criteria (untuk implementasi setelah Isu Terbuka #1/#2 diputuskan)

- [x] `IntentState` menambah `'INACTIVE'`.
- [x] `lockActiveIntent()` mentransisikan Intent `LOCKED` lama →
  `INACTIVE` (bukan lagi `SUPERSEDED`), tanpa cascade ke turunan mana pun.
- [x] Command baru `sigma intent supersede --v <version> --reason <reason> --director-confirm`,
  dengan preflight wajib menampilkan seluruh artifact yang akan
  ter-cascade sebelum eksekusi.
- [x] `supersedeIntentVersion()` (baru) — cascade `SUPERSEDED` penuh ke
  Roadmap → Plan → Exec → Close, mencakup entry yang sudah `LOCKED`.
- [x] `registerCloseDraft()` menyimpan `intent_version_ref` **dan**
  menolak draft baru untuk Intent yang sudah punya close belum-`SUPERSEDED`
  (penjagaan 1:1 seperti `registerRoadmapDraft()`).
- [x] Loop auto-supersede di `lockActiveClose()` dihapus.
- [x] `stale_intent`, `--ack-stale-intent`, `sigma exec supersede`,
  `supersedeExecVersion()` dihapus dari kode.
- [x] `evaluateCloseChain()` disederhanakan (tanpa cabang `isStale`).
- [x] `sigma plan supersede` tidak terpengaruh — tetap cascade otomatis
  ke Exec seperti sebelumnya.
- [x] Skenario regresi: `intent lock` untuk Intent baru **tidak**
  mengubah status Intent lama jadi `SUPERSEDED` — cuma `INACTIVE`, dan
  turunannya (Plan/Exec/Roadmap/Close) sama sekali tidak tersentuh.
- [x] Skenario regresi: `intent supersede --director-confirm` men-cascade
  `SUPERSEDED` ke seluruh turunan Intent target, termasuk yang `LOCKED`.
- [x] Skenario regresi: `intent supersede` tanpa `--director-confirm`
  ditolak dengan pesan jelas.
- [x] Skenario regresi: reopen setelah `CLOSED` — Intent baru di-lock
  membuat Intent lama `INACTIVE` (bukan `SUPERSEDED`); DIR-CLOSE lama
  tetap `LOCKED` apa adanya kecuali Director eksplisit men-supersede
  Intent lama itu.
- [x] Skenario regresi (Prinsip C — searah ke bawah): `sigma plan
  supersede` pada Plan tertentu **tidak** mengubah `state` Intent yang
  menaunginya sama sekali (masih `LOCKED`/`INACTIVE` apa adanya).
- [x] Skenario regresi (Prinsip C — tidak bocor antar-chain): proyek
  dengan dua Intent chain independen (misal Intent v1 dan Intent v2
  sama-sama `LOCKED` — kasus "pelengkap", bukan pivot) — men-supersede
  Intent v1 **tidak** mengubah apa pun yang terikat ke Intent v2
  (Roadmap/Plan/Exec/Close-nya tetap apa adanya).
- [x] `npm test` lulus tanpa regresi.

---

## Implementation Walkthrough (2026-07-17, Professional Mode)

Semua item Draft Acceptance Criteria di atas diimplementasikan dalam satu
sesi setelah Director menjawab Isu Terbuka #1/#2/#3/#4/#5 (lihat jawaban di
bagian "Isu Terbuka" di atas). Build (`tsc`) dan test suite penuh
(`npx vitest run`) hijau di akhir sesi: **24 file test, 155 test, 0 gagal**
(146 pre-existing + 9 baru).

### Engine — `src/engine/progress.ts`

- `IntentState` → `'DRAFT' | 'LOCKED' | 'INACTIVE' | 'SUPERSEDED'`;
  `TRACKER_STATES.intent` diikutkan.
- `ArtifactVersion.stale_intent` dihapus dari interface. `StaleIntentWarning`
  dan `isStaleIntentPresent()` dihapus, diganti `InactiveIntentWarning` +
  `getInactiveIntentWarnings()` (Isu Terbuka #1) — menyisir Roadmap/Plan/Exec/
  Close yang masih menunjuk ke Intent `INACTIVE` dan belum `SUPERSEDED`.
- `propagateStaleIntent()` dihapus total.
- `lockActiveIntent()`: loop lama (`LOCKED → SUPERSEDED` + `superseded_by`)
  diganti `LOCKED → INACTIVE` tanpa `superseded_by` dan tanpa memanggil
  propagasi apa pun ke Plan/Exec.
- `hasCleanGate2Chain()` / `hasCleanGate3Chain()`: cabang `!v.stale_intent`
  dihapus — sudah redundan sejak awal karena gate-nya sudah bergantung pada
  `iv.state === 'LOCKED'`, yang otomatis `false` begitu Intent lama pindah ke
  `INACTIVE`/`SUPERSEDED`. Perilaku gate tidak berubah, hanya kode mati
  yang hilang.
- `evaluateGate3()` (duplikat persis `hasCleanGate3Chain()`) dihapus;
  `lockActiveExec()` sekarang memanggil `hasCleanGate3Chain()` langsung.
- Baru: `collectIntentCascadeTargets()` (privat), `previewIntentSupersedeCascade()`
  (read-only, dipakai preflight CLI), `supersedeIntentVersion()` (mutasi
  penuh). Cascade match ketat per `intent_version_ref`/`plan_version_ref` —
  tidak pernah menyapu seluruh tracker (Prinsip C).
- `registerCloseDraft()`: parameter `staleAcknowledged: boolean` diganti
  `intentVersionRef: string`; menyimpan `intent_version_ref` pada entry baru;
  menolak draft baru kalau sudah ada entry Close untuk `intent_version_ref`
  yang sama dan belum `SUPERSEDED` (pola sama seperti `registerRoadmapDraft()`).
- `lockActiveClose()`: loop auto-supersede dihapus — penjagaan 1:1 di atas
  membuatnya tidak akan pernah terpakai lagi.
- `supersedeExecVersion()` dihapus.
- Deteksi "stranded reopen" di `runDoctorReconciliation()` diperluas: dulu
  hanya mengecek `state === 'SUPERSEDED'`, sekarang juga `'INACTIVE'` —
  karena reopen normal sekarang menghasilkan `INACTIVE`, bukan `SUPERSEDED`.

### CLI — `src/commands/`

- `intent.ts`: subcommand baru `supersede` — preflight wajib (daftar semua
  Roadmap/Plan/Exec/Close yang akan ter-cascade, ditandai kalau `LOCKED`),
  lalu menolak eksekusi tanpa `--director-confirm` (exit 1, progress.json
  tidak tersentuh), baru memanggil `supersedeIntentVersion()` kalau confirm
  diberikan.
- `close.ts`: `--ack-stale-intent` dan seluruh logic ack-note dihapus;
  `evaluateCloseChain()` disederhanakan (tanpa `isStale`, sekarang juga
  mengembalikan `intentVersionRef` untuk diteruskan ke `registerCloseDraft()`);
  import `fs` yang jadi tak terpakai dihapus.
- `exec.ts`: subcommand `supersede` dihapus; kolom "Stale" di `status`/`list`
  dihapus.
- `plan.ts`: kolom/baris "Stale Intent" di `status`/`list` dihapus (`plan
  supersede` sendiri tidak disentuh — tetap cascade otomatis ke Exec).
- `project.ts`, `session.ts`: bagian "STALE_INTENT Warnings" diganti
  "INACTIVE Intent Warnings (non-blocking)" memakai `getInactiveIntentWarnings()`.
- `doctor.ts`: bagian yang sama ditambahkan ke output default `sigma doctor`.

### Reconstruct — `src/engine/reconstruct.ts`

- Intent non-tertinggi yang ditemukan di disk sekarang direkonstruksi
  sebagai `INACTIVE` (bukan `SUPERSEDED` + `superseded_by`), konsisten
  dengan hasil default `lockActiveIntent()` yang baru — reconstruct tidak
  boleh menebak klaim `SUPERSEDED` yang sekarang butuh otorisasi eksplisit.
- Seluruh penandaan `stale_intent` pada Plan/Exec hasil reconstruct dihapus
  (variabel `staleIntent`/`activeIntentVersion` yang jadi tak terpakai
  ikut dihapus).
- Rekonstruksi DIR-CLOSE (multi-versi berdasar urutan file di disk) sengaja
  **tidak** diubah — di luar cakupan AC, dan tidak memanggil
  `registerCloseDraft()` sehingga penjagaan 1:1 baru tidak relevan di sana.

### Tes yang diperbarui (perilaku lama tidak lagi berlaku)

- `test/intent-reopen-cycle.test.ts`: assert Intent lama `INACTIVE` (bukan
  `SUPERSEDED`) setelah reopen; Plan/Exec lama diverifikasi **tidak**
  tersentuh sama sekali (bukan `stale_intent: true`).
- `test/progress-hardening.test.ts`: assert yang sama untuk skenario pivot
  mid-BUILD (bukan reopen dari CLOSED).
- `test/lifecycle-hardening.test.ts`: test `--ack-stale-intent` diganti
  test penjagaan 1:1 baru (`close new` kedua untuk Intent yang sama ditolak
  dengan pesan `DIR-CLOSE already exists for INTENT`).

### Tes baru — `test/intent-supersede.test.ts` (9 test)

Mencakup seluruh skenario regresi di Draft Acceptance Criteria yang belum
tercakup test lain: guard version-not-found dan state-DRAFT-ditolak, gate
`--director-confirm` (ditolak tanpa confirm + progress.json tidak berubah),
isi preflight (menampilkan entry `LOCKED` secara eksplisit), cascade penuh
ke 4 domain sekaligus, no-op yang aman kalau tidak ada turunan, isolasi
antar-chain (dua Intent independen — `intent supersede` pada salah satu
tidak menyentuh yang lain), `plan supersede` tidak menjalar ke atas ke
Intent, dan reopen-setelah-CLOSED di level CLI (DIR-CLOSE lama tetap
`LOCKED` sampai Director eksplisit men-supersede).

### Dokumentasi tata kelola disinkronkan

- `Sigma/SIGMA_PROTOCOL.md`: state machine DIR-INTENT (Section 5.1) ditulis
  eksplisit termasuk `INACTIVE`; baris "Auto-supersede" DIR-INTENT dan
  DIR-CLOSE diperbarui; bagian Gate 3 STALE_INTENT diganti penjelasan
  cascade `intent supersede`; tabel Command Authority Classes dan daftar
  sinyal otorisasi (`ack stale intent` dihapus) diperbarui.
- `Sigma/rules/FMN-RULE.md`, `DEV-RULE.md`, `AUD-RULE.md`: baris
  `sigma exec supersede` (command yang sudah dihapus) diganti/dibuang dari
  tabel/daftar command yang butuh otorisasi Director atau dilarang untuk AUD.
- Dokumen perencanaan lama (`Discussion/`, `Implementation/PLAN-*.md` di
  luar folder `planned_sigma_evaluation_2026_07_17/`) **tidak** diubah —
  itu catatan historis titik-waktu, bukan dokumentasi hidup.

### Di luar cakupan (dikonfirmasi Director, lihat Isu Terbuka #3/#4/#5)

- `roadmap_version_ref` pada Close — tidak ditambahkan.
- Migrasi paksa data lama dengan `stale_intent: true` — tidak dilakukan.
- Normalisasi proyek `KLHK_JasaLingkunganHidup` (`intent supersede --v v1`)
  — ditunda, menunggu keputusan Director terpisah.
