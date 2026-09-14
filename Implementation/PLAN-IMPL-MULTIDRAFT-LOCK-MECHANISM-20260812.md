# PLAN-IMPL — Multi-Draft Lock Mechanism (PLAN/EXEC) + Dua Penambahan Template

**Sumber**: [../Discussion/2026-08-12_1413_Plan-exec-lock-mechanism-multidraft.md](../Discussion/2026-08-12_1413_Plan-exec-lock-mechanism-multidraft.md), ditambah keputusan Director dalam sesi review plan ini (2026-08-12).
**Tanggal**: 2026-08-12 · **Revisi 3**
**Status**: **DRAFT — belum ada satu baris pun yang dieksekusi.** Seluruh keputusan desain (§12) sudah ditutup Director; tidak ada lagi yang menunggu jawaban.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

> **Yang berubah dari Revisi 1** — keputusan Director membatalkan sebagian besar desain awal. Diringkas kumulatif di §0 supaya perbedaannya tidak perlu dicari.

---

## 0. Perubahan dari Revisi 1

| Topik | Revisi 1 | Revisi 2 (diputuskan Director) |
| :--- | :--- | :--- |
| Definisi Gate 3 | Dua opsi diajukan (D-01) | **Definisi Director**: tidak boleh ada DRAFT PLAN maupun DRAFT EXEC, dan **setiap** PLAN LOCKED wajib punya pasangan EXEC LOCKED. PLAN `SUPERSEDED` diabaikan sepenuhnya, punya EXEC atau tidak |
| Jalan keluar DRAFT PLAN | Command baru `plan discard` + state baru `DISCARDED` + bump `SCHEMA_VERSION` | **Dibatalkan.** `plan supersede` diperluas menerima DRAFT. Tanpa verb baru, tanpa state baru, **tanpa bump schema** |
| Jalan keluar DRAFT EXEC | `exec discard`, lalu sempat `exec supersede` | **Tidak ada — disengaja.** EXEC hanya keluar lewat cascade dari `plan supersede`, seperti sekarang. Membatalkan EXEC = men-supersede PLAN-nya lalu membuka versi PLAN baru (§6.2) |
| Versi EXEC | Mengikuti `nextExecVersion()` yang ada | **Selalu sama dengan versi PLAN.** `nextExecVersion()` runtuh jadi identitas (§6.3) |
| `plan status`/`exec status` | Tetap berbasis pointer + banner peringatan saat ambigu | **Jadi tampilan tingkat chain.** Tidak membaca `active_version` sama sekali. Banner tidak diperlukan lagi |
| `plan queue` | Dipertahankan | **Dihapus**, diserap `plan status` |
| `plan activate` | Dipertahankan dengan deskripsi baru | **Dihapus** — satu-satunya gunanya menggeser pointer untuk `status`, yang tidak lagi membaca pointer |
| Pasangan PLAN↔EXEC | — | Dicek lewat **`plan_version_ref`** di kode, dan kesamaan versi dijamin **secara konstruksi** oleh §6.3 |
| Penanganan ambiguitas | Dua tingkat: hard block untuk command mutasi, soft warn untuk command baca | **Satu aturan**: tidak ada eksekusi diam-diam saat ambigu, termasuk pada command read-only seperti `check` (§8.3) |

Dua konsekuensi menyenangkan: **risiko bump schema hilang seluruhnya**, dan permukaan command berkurang bersih (`queue` + `activate` keluar, tidak ada command baru sama sekali).

---

## Inti

| Blok | Isi | Fase |
| :--- | :--- | :--- |
| **A — Konkurensi & penargetan lock** | `plan lock --v`, guard `exec new` per-PLAN, `exec lock --v` | 1–3 |
| **B — Jalan keluar & gerbang** | Supersede diperluas, Gate 3 didefinisikan ulang | 4–5 |
| **C — Permukaan command** | `status` tingkat chain, `queue`/`activate` dihapus, sapuan `--v` | 6 |
| **D — Template** | FMN-PLAN §Pre-requirement, DEV-EXEC §Technical Research | 7 |
| **E — Dokumentasi** | rule docs, protokol, registry, README, `setup/targets/**` | 8 |

Fase 4 mendahului Fase 5 dengan sengaja: definisi Gate 3 baru menjadikan DRAFT sebagai penghalang penutupan chain, jadi jalan keluarnya harus sudah ada lebih dulu. Merilis Fase 5 tanpa Fase 4 berarti merilis chain yang bisa terkunci selamanya.

---

## 1. Temuan verifikasi terhadap kode nyata

Diverifikasi langsung ke source. Tujuh temuan mengubah atau memperluas asumsi dokumen diskusi.

### 1.1 Gate 3 terikat ke `exec.active_version`

[../src/engine/chain.ts:631-643](../src/engine/chain.ts#L631-L643) menghitung Gate 3 dari EXEC yang kebetulan ditunjuk `active_version`. Tiga akibatnya begitu EXEC konkuren diizinkan:

1. **`registerExecDraft()` menghapus Gate 3 yang sah** ([chain.ts:1388-1390](../src/engine/chain.ts#L1388-L1390)) — membuat EXEC B untuk PLAN B menghapus bukti bahwa rantai PLAN A → EXEC A sudah bersih.
2. **`exec lock --v` tidak bisa sekadar menambah flag** — mengunci versi non-aktif akan menghitung Gate 3 dari artefak lain.
3. **Salahnya tidak muncul sebagai output aneh.** [chain.ts:684](../src/engine/chain.ts#L684) melempar `semanticError` bila `gate_3_satisfied` tersimpan `true` sementara predikatnya `false`.

Definisi baru dari Director (§5) melepas ketergantungan ini sekaligus.

### 1.2 `nextExecVersion()` akan memecah kesamaan versi begitu eksekusi paralel

Director menetapkan versi EXEC **wajib** sama dengan versi PLAN dalam kondisi apa pun. Algoritma sekarang tidak memenuhi itu: `nextExecVersion()` ([chain.ts:998-1006](../src/engine/chain.ts#L998-L1006)) memakai penghitung global per-major, bukan cermin versi PLAN.

```text
PLAN v1.1 LOCKED, PLAN v1.2 LOCKED, belum ada exec
exec new --plan v1.2  →  EXEC v1.2      (kebetulan sama)
exec new --plan v1.1  →  EXEC v1.3      ← pasangan PLAN v1.1, versinya beda
```

Kesamaan angka selama ini benar **hanya karena eksekusi selalu berurutan** — dan justru urutan itulah yang plan ini longgarkan. Jadi aturan Director menuntut perubahan mekanis pada `nextExecVersion()`, bukan sekadar disiplin. Perbaikannya di §6.3.

### 1.3 `supersede` tidak pernah menghitung ulang gerbang — bug yang sudah ada sekarang

`supersedePlanVersion()` ([chain.ts:1327-1351](../src/engine/chain.ts#L1327-L1351)) mengubah state dan mencatat alasan, tapi **tidak pernah menyentuh `chain.gates`**. Sementara `validateChainSemantics()` melempar error bila `gate_2_open === true` tanpa PLAN LOCKED ([chain.ts:681-683](../src/engine/chain.ts#L681-L683)).

Karena `writeChain()` tidak memvalidasi ([chain.ts:431-438](../src/engine/chain.ts#L431-L438)) dan validasi baru jalan lewat `assertChainCanMutate()` di awal setiap command yang menulis ([chain.ts:744-753](../src/engine/chain.ts#L744-L753)), urutannya: men-supersede PLAN LOCKED terakhir **berhasil**, lalu **command berikutnya yang menulis akan gagal** dengan `gate is open without a LOCKED PLAN`, sampai `sigma doctor` merepairnya ([chain.ts:899-901](../src/engine/chain.ts#L899-L901)).

Ini bug yang sudah ada, bukan bawaan plan ini. Tapi plan ini memindahkannya dari jarang ke sering: setelah Fase 4, `supersede` menjadi **satu-satunya** pintu keluar untuk draft, jadi jalur ini akan sering dilewati. Diperbaiki di Fase 4.

### 1.4 `getNextValidOperations()` memakai `plan.active_state`

[chain.ts:1446](../src/engine/chain.ts#L1446): `const planLocked = chain.plan.active_state === 'LOCKED';` padahal `hasActiveLockedPlan()` yang benar sudah ada di [chain.ts:617](../src/engine/chain.ts#L617). Saran `exec new` hilang begitu pointer kebetulan menunjuk DRAFT. Output ini muncul di `sigma session bootstrap` dan MCP `sigma_get_orientation` — jadi yang tersesat adalah AI role. [chain.ts:1460-1464](../src/engine/chain.ts#L1460-L1464) juga menyusun string `plan lock # will lock ... (oldest DRAFT)` yang jadi salah total setelah FIFO dicabut.

### 1.5 `lock` bergerbang verdict — sebabnya `supersede` harus menerima DRAFT

`ensureSigmaDocEligible()` ([docCheck.ts:699-710](../src/utils/docCheck.ts#L699-L710)) memblokir lock bila ada lock requirement yang belum terpenuhi:

- **FMN-PLAN**: tepat satu verdict AUD tercentang di §8; bila `SKIP_FOR_AUDIT`, Instruksi Director harus tertulis verbatim ([docCheck.ts:312-344](../src/utils/docCheck.ts#L312-L344)).
- **DEV-EXEC**: verdict FMN Post-Build Review tercatat ([docCheck.ts:402-417](../src/utils/docCheck.ts#L402-L417)).

Konsekuensinya jalur "kunci dulu, baru supersede" tidak layak sebagai jalan keluar untuk DRAFT PLAN: ia memaksa mencentang verdict pada dokumen yang justru dibatalkan **dan** mencatat `LOCKED` yang tidak pernah terjadi. Karena itu `plan supersede` diperluas ke DRAFT (Fase 4), bukan lock yang dipermudah.

### 1.6 `pending[]` tidak menjawab kebutuhan ini

`plan.pending[]` menampung plan yang belum pernah masuk antrean. Setelah `plan promote` tidak ada jalan kembali — tidak ada subcommand penghapus, baik untuk pending maupun DRAFT. Jadi pending menutup kasus "belum ingin masuk antrean", bukan "sudah di antrean dan tidak diinginkan". Item terbuka dokumen diskusi §7 **tertutup**.

### 1.7 Renumbering template aman; test yang akan pecah

`docCheck` **tidak pernah memvalidasi nomor heading** — hanya marker ada, tepat satu H2 mengikuti tiap marker, dan urutan kemunculan marker. Jadi pergeseran nomor section murni kosmetik bagi CLI. Mekanisme `optionalSections` + `sectionOrder` juga sudah ada, dibuat untuk `AMENDMENT_HISTORY` ([docCheck.ts:139-160](../src/utils/docCheck.ts#L139-L160)) dan langsung dipakai ulang.

Yang akan pecah: seluruh [../test/plan-activate.test.ts](../test/plan-activate.test.ts) (command-nya dihapus), dan [../test/chain-engine.test.ts:209](../test/chain-engine.test.ts#L209). Drift registry juga tersenggol: entry `exec_lock` masih mensyaratkan `exec.active_state == 'COMPLETED'` dan menyarankan `sigma exec advance complete` — state dan command yang tidak ada di kode.

---

## 2. Inventaris konsumen `active_version` / `active_state`

Memenuhi prasyarat dokumen diskusi §4.1. Sumber: `grep -rn "active_version\|active_state" src/`.

| Lokasi | Peran | Klasifikasi | Tindakan |
| :--- | :--- | :--- | :--- |
| [chain.ts:631-643](../src/engine/chain.ts#L631-L643) `hasCleanGate3Chain` | Evaluasi Gate 3 | **Otoritas seleksi — salah** | Fase 5, ditulis ulang tanpa pointer |
| [chain.ts:1388-1390](../src/engine/chain.ts#L1388-L1390) `registerExecDraft` | Reset Gate 3 | **Efek samping lintas workstream** | Fase 5, dihitung ulang |
| [chain.ts:1393-1406](../src/engine/chain.ts#L1393-L1406) `lockActiveExec` | Target lock | **Otoritas seleksi — salah** | Fase 3, → `lockExecVersion(chain, v)` |
| [chain.ts:1271-1288](../src/engine/chain.ts#L1271-L1288) `lockOldestPlanDraft` | Target lock (FIFO) | **Seleksi implisit — salah** | Fase 1, → `lockPlanVersion(chain, v)` |
| [chain.ts:1446](../src/engine/chain.ts#L1446) `getNextValidOperations` | Saran operasi | **Salah** | Fase 1, → `hasActiveLockedPlan()` |
| [exec.ts:124](../src/commands/exec.ts#L124) guard `active_state !== 'DRAFT'` | Prasyarat lock | **Otoritas seleksi — salah** | Fase 3, cek state per-versi |
| [plan.ts:364-394](../src/commands/plan.ts#L364-L394) / [exec.ts:161-184](../src/commands/exec.ts#L161-L184) `status` | Tampilan | **Dihapus dari jalur baca** | Fase 6, `status` jadi tingkat chain |
| [plan.ts:66-72](../src/commands/plan.ts#L66-L72) / [exec.ts:22-28](../src/commands/exec.ts#L22-L28) `planDocPath`/`execDocPath` | Default `--v` untuk `check` | Default, bukan otoritas | Fase 6, `--v` wajib saat ambigu |
| [chain.ts:1353-1364](../src/engine/chain.ts#L1353-L1364) `activatePlanDraft` | Menggeser pointer | **Kehilangan alasan** | Fase 6, dihapus bersama command-nya |
| [override.ts:18-19](../src/commands/override.ts#L18-L19) | Artefak yang dicatat di override record | **Tindakan permanen — tidak boleh pointer** | Fase 6, `--v` wajib saat ambigu |
| [session.ts:171-172](../src/commands/session.ts#L171-L172), [project.ts:368-369](../src/commands/project.ts#L368-L369) | Ringkasan orientasi | Menyesatkan saat ambigu | Fase 6, tampilkan jumlah draft terbuka |
| [mcp/tools/artifacts.ts:36-43](../src/mcp/tools/artifacts.ts#L36-L43) | Pelaporan JSON | Benar, tapi kurang | Fase 6, tambah `open_drafts[]` |
| [chain.ts:1183](../src/engine/chain.ts#L1183), [1336](../src/engine/chain.ts#L1336), [1346](../src/engine/chain.ts#L1346) cascade | Sinkronisasi pointer | Benar | Tidak disentuh |
| [chain.ts:573-606](../src/engine/chain.ts#L573-L606) `validateTracker`, [chain.ts:862-869](../src/engine/chain.ts#L862-L869) doctor repair | Invariant pointer↔state | Benar | Tidak disentuh; wajib tetap hijau |
| [reconstruct.ts:446-452](../src/engine/reconstruct.ts#L446-L452) | Rekonstruksi dari file | Benar | Tidak disentuh |

**Ringkasan**: enam call site memperlakukan `active_version` sebagai otoritas seleksi — semuanya ditangani. Setelah Fase 6, tidak ada satu pun command **baca** yang bergantung pada pointer. Field-nya tetap ada (dipakai `override`, MCP, rekonstruksi, dan invarian `validateTracker`); menghapusnya sepenuhnya adalah pekerjaan lain di kemudian hari, tidak termasuk di sini.

---

## 3. Fase 1 — `plan lock --v`, FIFO dicabut

`lockOldestPlanDraft(chain)` diganti `lockPlanVersion(chain, version)`:

```ts
export function lockPlanVersion(chain: ChainState, version: string): string {
  const target = chain.plan.versions.find(v => v.version === version);
  if (!target) throw new Error(`FMN-PLAN ${version} not found. Run: sigma plan list`);
  if (target.state !== 'DRAFT') {
    throw new Error(`FMN-PLAN ${version} is in state "${target.state}"; lock requires DRAFT.`);
  }
  const now = new Date().toISOString();
  target.state = 'LOCKED';
  target.locked_at = now;
  target.updated_at = now;

  chain.plan.active_version = version;   // pointer tampilan ikut pindah (D-02)
  chain.plan.active_state = 'LOCKED';
  chain.gates.gate_2_open = hasCleanGate2Chain(chain);
  chain.gates.gate_3_satisfied = hasCleanGate3Chain(chain);   // §5
  return version;
}
```

Helper resolusi target dipisah karena dipakai bersama `plan lock`, `exec lock`, dan `check`:

```ts
export function resolveTargetVersion(
  versions: ArtifactVersion[],
  wantedState: 'DRAFT',
  explicit: string | undefined,
): { version: string } | { ambiguous: string[] } | { empty: true }
```

Command [plan.ts:148-170](../src/commands/plan.ts#L148-L170) mendapat `--v` dengan tiga cabang: nol DRAFT → pesan eksplisit; tepat satu → jalan tanpa argumen; lebih dari satu tanpa `--v` → tolak + daftar (§10). Validasi dokumen tetap dijalankan terhadap **versi terpilih**.

`getNextValidOperations()` diperbaiki di fase ini juga (§1.4).

---

## 4. Fase 2 — Guard `exec new` menjadi per-PLAN

Guard chain-wide di [exec.ts:47-56](../src/commands/exec.ts#L47-L56) dihapus, diganti pengecekan setelah `planVersionRef` terpilih:

```ts
const openExecForPlan = chain.exec.versions.find(
  v => v.plan_version_ref === planVersionRef && v.state !== 'LOCKED' && v.state !== 'SUPERSEDED'
);
if (openExecForPlan) { throw new Error(/* §10 */); }
```

Dua detail yang harus benar:

- **`unexecutedPlans` didefinisikan ulang.** Sekarang [exec.ts:59-66](../src/commands/exec.ts#L59-L66) menghitung "PLAN LOCKED tanpa EXEC **LOCKED**"; dengan konkurensi, PLAN yang sudah punya EXEC DRAFT tetap muncul sebagai kandidat lalu ditolak guard — daftar kandidatnya jadi menyesatkan. Kandidat yang benar: PLAN LOCKED **tanpa EXEC non-SUPERSEDED sama sekali**.
- **Invarian kardinalitas ditegakkan juga di `registerExecDraft()`**, bukan hanya di command, supaya jalur non-CLI tidak bisa menembusnya.

`--plan` tidak berubah — sudah sesuai kebutuhan (dokumen diskusi §3).

---

## 5. Fase 3 — `exec lock --v`

`lockActiveExec(chain)` → `lockExecVersion(chain, version)`, pola identik §3: cari entri, wajib `DRAFT`, set `LOCKED` + `locked_at`, pindahkan pointer, hitung ulang gerbang.

Command [exec.ts:117-142](../src/commands/exec.ts#L117-L142): guard `chain.exec.active_state !== 'DRAFT'` dihapus, diganti `resolveTargetVersion()` yang sama, lalu validasi dokumen terhadap versi terpilih.

---

## 6. Fase 4 — Supersede diperluas, versi EXEC dikunci ke versi PLAN

### 6.1 `plan supersede` menerima DRAFT

Satu-satunya perubahan aturan di [chain.ts:1331](../src/engine/chain.ts#L1331):

```ts
// Lama:  if (target.state !== 'LOCKED') throw ...
// Baru:
if (target.state === 'SUPERSEDED') {
  throw new Error(`FMN-PLAN ${version} is already SUPERSEDED (reason: ${target.supersede_reason}).`);
}
```

Menolak target yang sudah `SUPERSEDED` bukan formalitas: tanpa itu, supersede ulang akan menimpa `supersede_reason` yang lama dan menghapus jejak alasan aslinya.

Cascade ke EXEC tetap apa adanya — PLAN DRAFT tidak mungkin punya EXEC (Gate 2 menuntut LOCKED), jadi loop-nya sekadar tidak menemukan apa-apa.

### 6.2 EXEC tidak mendapat pintu keluar sendiri — keputusan Director

**Tidak ada `exec supersede`, dan tidak akan ditambahkan.** DEV-EXEC tetap hanya bisa menjadi `SUPERSEDED` lewat cascade — dari `plan supersede` ([chain.ts:1340-1350](../src/engine/chain.ts#L1340-L1350)) atau `intent supersede` ([chain.ts:1185-1190](../src/engine/chain.ts#L1185-L1190)) — persis seperti hari ini.

Alasannya: pintu keluar langsung untuk EXEC akan memecah kesamaan versi PLAN↔EXEC, yang Director tetapkan sebagai invarian mutlak. Kalau EXEC v1.6 bisa dibuang sendiri sementara PLAN v1.6 tetap `LOCKED`, PLAN itu butuh EXEC pengganti — dan versinya tidak mungkin v1.6 lagi (sudah terpakai).

Jalur membatalkan DRAFT EXEC karena itu:

```text
PLAN v1.6 LOCKED, EXEC v1.6 DRAFT, arah eksekusinya salah
  → sigma plan supersede --v v1.6 --reason "..."   (EXEC v1.6 ikut cascade)
  → sigma plan new --title "..." --focus "..."     (→ v1.7, isi disalin dari v1.6)
  → sigma plan lock --v v1.7
  → sigma exec new --plan v1.7                     (→ EXEC v1.7)
```

Harganya dinyatakan terang-terangan: **PLAN yang isinya masih benar ikut dibuang, dan dokumennya harus ditulis ulang di versi baru.** Director menerima harga itu sebagai ganti invarian versi yang tidak pernah bocor. Ini bukan kebuntuan — jalan keluarnya ada, hanya lebih berat.

### 6.3 Versi EXEC = versi PLAN, dijamin secara konstruksi

Konsekuensi mekanis dari §6.2, dan yang membuat aturan Director benar-benar bisa dipegang (§1.2). `nextExecVersion()` runtuh menjadi identitas:

```ts
// Sebelumnya: penghitung global per-major (highestExecMinor / planMinorFloor).
// Sebuah PLAN kini tidak akan pernah punya EXEC kedua — satu-satunya jalan
// EXEC jadi SUPERSEDED adalah cascade, dan cascade selalu ikut mematikan
// PLAN-nya, sehingga PLAN itu tidak akan pernah jadi kandidat `exec new` lagi.
// Karena itu versi PLAN aman dipakai langsung: tabrakan tidak mungkin terjadi.
export function nextExecVersion(_chain: ChainState, planVersionRef: string): string {
  return planVersionRef;
}
```

Argumen ketiadaan tabrakan, dieja lengkap karena inilah yang membuat penyederhanaan ini sah:

1. EXEC jadi `SUPERSEDED` hanya lewat cascade (§6.2).
2. Cascade selalu berasal dari PLAN atau INTENT yang di-supersede, jadi PLAN-nya pasti ikut `SUPERSEDED`.
3. Kandidat `exec new` hanya PLAN berstatus `LOCKED` ([exec.ts:59](../src/commands/exec.ts#L59)).
4. Maka satu versi PLAN tidak akan pernah menghasilkan EXEC kedua, dan `EXEC.version = PLAN.version` tidak pernah bertabrakan.

Jaring pengaman untuk hal yang "seharusnya tidak terjadi" sudah ada dan dipertahankan: guard duplikat versi di `registerExecDraft()` ([chain.ts:1373-1375](../src/engine/chain.ts#L1373-L1375)) dan pengecekan berkas di [exec.ts:97-102](../src/commands/exec.ts#L97-L102). Pengecekan major-match di `registerExecDraft()` dinaikkan menjadi pengecekan kesamaan penuh.

**Tidak ditambahkan sebagai validasi baca.** Menambahkan asersi `exec.version === plan_version_ref` ke `validateChainSemantics()` akan menolak chain lama — dan itu bukan teori: delapan fixture test yang ada sekarang memang memasangkan versi berbeda (mis. [test/plan-supersede.test.ts:81-82](../test/plan-supersede.test.ts#L81-L82) memakai `plan_version_ref: 'v1'` untuk EXEC v1.1/v1.2). Invarian ditegakkan **saat pembuatan** dan dilaporkan **oleh `sigma doctor`**, tidak pernah dengan melempar error saat membaca data lama.

### 6.4 Recompute gerbang di jalur supersede (§1.3)

`supersedePlanVersion()` diakhiri:

```ts
chain.gates.gate_2_open = hasCleanGate2Chain(chain);
chain.gates.gate_3_satisfied = hasCleanGate3Chain(chain);
```

Memperbaiki bug yang sudah ada sekarang, sekaligus mencegahnya menjadi sering setelah supersede jadi pintu keluar utama.

### 6.5 Yang **tidak** dilakukan

Berkas `.md` milik artefak yang di-supersede **tidak dihapus** — git adalah jaring pengaman, dan jejak kerja tetap perlu bisa dibaca. Tidak ada `--director-confirm`, konsisten dengan `plan supersede` hari ini yang hanya menuntut `--reason`; otorisasi Director ditegakkan di lapis doktrin (kelas Approval, `SIGMA_PROTOCOL.md` §16A).

---

## 7. Fase 5 — Definisi Gate 3 baru

> Fase paling rawan di seluruh plan ini. Salah di sini tidak muncul sebagai perilaku aneh melainkan sebagai chain yang gagal divalidasi (§1.1). **Jangan digabung commit-nya dengan fase lain.**

### 7.1 Definisi

```ts
export function hasCleanGate3Chain(chain: ChainState): boolean {
  if (chain.intent.state !== 'RATIFIED') return false;

  // Tidak ada pekerjaan yang menggantung — di kedua domain.
  if (chain.plan.versions.some(v => v.state === 'DRAFT')) return false;
  if (chain.exec.versions.some(v => v.state === 'DRAFT')) return false;

  // PLAN SUPERSEDED diabaikan sepenuhnya, punya EXEC atau tidak (keputusan Director).
  const activePlans = chain.plan.versions.filter(v => v.state === 'LOCKED');
  if (activePlans.length === 0) return false;

  // Setiap PLAN LOCKED wajib punya tepat satu EXEC LOCKED yang menunjuknya.
  return activePlans.every(plan => {
    if (plan.intent_version_ref !== chain.intent.version) return false;
    const pairs = chain.exec.versions.filter(
      e => e.state === 'LOCKED' && e.plan_version_ref === plan.version
    );
    return pairs.length === 1;
  });
}
```

Dibaca sebagai kalimat: *"INTENT sudah diratifikasi, tidak ada yang menggantung, dan semua yang direncanakan sudah dikerjakan."*

Apa yang ditutupnya dibanding hari ini: sekarang Gate 3 hanya menuntut **satu** rantai bersih, sehingga PLAN v1.2 yang dikunci tapi tidak pernah dieksekusi tidak menghalangi `close new`. Chain bisa ditutup dengan pekerjaan terencana yang menggantung. Definisi baru menutup itu.

### 7.2 `plan.pending[]` sengaja tidak dihitung

Keputusan Director: pending plan **tidak memblokir** penutupan chain, dan **tidak perlu peringatan CLI baru**.

Secara teknis pending plan memang tidak punya field `state` sama sekali ([chain.ts:45-51](../src/engine/chain.ts#L45-L51)) — jadi rumus §7.1 tidak menyentuhnya. Yang lebih menentukan adalah alasan doktrinalnya: pending berarti gagasan yang belum diangkat, entah karena sudah tidak relevan atau karena terlewat. Untuk kemungkinan "terlewat", penjagaannya sudah ada dan bukan di lapis CLI:

- **FMN wajib membriefkan pending plan ke Director setiap aktivasi peran** — sudah tertulis di [FMN-RULE.md §Role Activation](../Sigma/rules/FMN-RULE.md), butir pertama dari daftar yang harus dilaporkan sebelum FMN berhenti.
- **ARC menilai kelayakan penutupan lewat Satisfaction Score**, dan Gate 3.5 menuntut skor ≥ 50 sebelum DIR-CLOSE boleh dibuat ([chain.ts:1120-1122](../src/engine/chain.ts#L1120-L1122), [close.ts:64-69](../src/commands/close.ts#L64-L69)).

Menambahkan gerbang atau banner ketiga di `close new` hanya akan menduplikasi penjagaan yang sudah bekerja di lapis peran. Tidak dilakukan.

### 7.3 Sapuan recompute — bagian yang mudah terlewat

Karena membuat DRAFT PLAN kini bisa **menutup** Gate 3 yang tadinya terbuka, dan `validateChainSemantics` menolak `gate_3_satisfied: true` yang tidak sesuai predikat, setiap mutasi berikut wajib diakhiri recompute:

| Fungsi | Alasan |
| :--- | :--- |
| `registerPlanDraft` | DRAFT baru → Gate 3 tertutup. **Hari ini fungsi ini tidak menyentuh gerbang sama sekali** |
| `promotePendingPlan` | idem |
| `lockPlanVersion` | DRAFT hilang, tapi muncul PLAN LOCKED tanpa pasangan → tetap tertutup |
| `supersedePlanVersion` | PLAN keluar dari hitungan → bisa **membuka** Gate 3 |
| `registerExecDraft` | ganti `gate_3_satisfied = false` menjadi hasil hitung, bukan asersi |
| `registerPendingPlan` | **tidak perlu** — pending tidak masuk hitungan (§7.2); yang menutup Gate 3 adalah `plan promote`, saat entri pindah ke `versions[]` sebagai DRAFT |
| `lockExecVersion` | pasangan lengkap → bisa membuka Gate 3 |
| cascade EXEC di dalam `supersedePlanVersion` | EXEC ikut keluar dari hitungan bersama PLAN-nya |

`sigma doctor` tidak perlu disentuh — ia sudah memanggil `hasCleanGate3Chain()` untuk repair ([chain.ts:905](../src/engine/chain.ts#L905)), jadi otomatis ikut definisi baru.

---

## 8. Fase 6 — Permukaan command

### 8.1 `status` menjadi tampilan tingkat chain

`plan status` dan `exec status` berhenti membaca `active_version`. Isinya: seluruh DRAFT terbuka, seluruh LOCKED (beserta pasangan EXEC-nya untuk domain plan), pending, dan status gerbang. Tanpa `--v`, tanpa pointer, tanpa banner peringatan — tidak ada lagi yang bisa berbohong, jadi tidak ada yang perlu diperingatkan.

### 8.2 Yang dihapus

- **`plan queue`** — diserap `plan status`. FIFO sudah dicabut, jadi "antrean" bukan lagi antrean, cuma himpunan draft terbuka.
- **`plan activate`** (beserta `activatePlanDraft()` di engine) — satu-satunya gunanya menggeser pointer untuk `status`, yang tidak lagi membacanya.

### 8.3 Prinsip yang mengatur seluruh sapuan `--v`

Ditetapkan Director, dan berlaku ke semua command tanpa kecuali:

> **Tidak ada satu pun command yang boleh mengeksekusi diam-diam ketika ambiguitas terdeteksi.**

Ambiguitas berarti hal yang sama di mana pun: **lebih dari satu DRAFT** pada domain yang bersangkutan. Prinsip ini menggantikan pembagian dua tingkat di dokumen diskusi §4.1 (hard block untuk command mutasi, soft warn untuk command baca). Pembagian itu tidak lagi diperlukan, karena setelah §8.1 dan §8.2 pemetaannya jadi bersih:

- Command yang **memilih artefak** — `lock`, `supersede`, `update`, `check`, `override` — wajib eksplisit saat ambigu, baca maupun tulis. `check` termasuk meskipun read-only: yang berbahaya bukan efek sampingnya, melainkan seseorang menyimpulkan sesuatu dari dokumen yang bukan yang ia kira.
- Command yang **tidak memilih apa pun** — `status`, `list` — tidak pernah butuh `--v` karena tidak pernah bisa salah menunjuk.

### 8.4 Sapuan `--v`

| Command | `--v` | Catatan |
| :--- | :--- | :--- |
| `plan new`, `plan promote`, `exec new` | tidak | membuat, bukan menargetkan (`promote` pakai `--id`, `exec new` pakai `--plan`) |
| `plan status`, `exec status`, `plan list`, `exec list` | tidak | tingkat chain |
| `plan supersede`, `plan update` | **sudah wajib** | tidak berubah |
| `plan lock`, `exec lock` | **baru** | wajib saat ambigu, otomatis saat hanya ada satu DRAFT |
| `plan check`, `exec check` | **diperketat** | sekarang diam-diam jatuh ke pointer; jadi wajib begitu ada lebih dari satu DRAFT — ambang yang sama persis dengan `lock` |
| `override` | **baru, wajib saat ambigu** | tindakan permanen — pointer tidak boleh jadi otoritas ([override.ts:18-19](../src/commands/override.ts#L18-L19)) |

Sebagian besar baris ini sudah begitu sejak awal — FIFO di `plan lock` justru satu-satunya penyimpangan dari prinsip §8.3.

### 8.5 MCP dan orientasi

[mcp/tools/artifacts.ts](../src/mcp/tools/artifacts.ts) mendapat `open_drafts: string[]` per domain; `session bootstrap` dan `project status` menampilkan jumlah draft terbuka. AI role tidak membaca banner teks, jadi bentuknya harus terstruktur.

---

## 9. Fase 7 — Dua penambahan template

Independen dari Fase 1–6; boleh dikerjakan lebih dulu bila Director menghendaki.

### 9.1 FMN-PLAN §2 Pre-requirement

Marker `<!-- SIGMA:FMN_PLAN:SECTION:PRE_REQUIREMENT -->` setelah `SOURCE_ALIGNMENT`; heading digeser 2→3 … 9→10 (kosmetik bagi CLI, §1.7). Isi mengikuti dokumen diskusi §5.1–§5.3: dua sub-tabel, status `DRAFT/LOCKED/SUPERSEDED` untuk Sigma Artefact Requirement, `AVAILABLE/NOT_YET_AVAILABLE` untuk Output Requirement, plus catatan kepemilikan FMN-menulis / DEV-membaca.

### 9.2 DEV-EXEC §3 Technical Research

Marker `<!-- SIGMA:DEV_EXEC:SECTION:TECHNICAL_RESEARCH -->` di antara `DEV_PRE_BUILD_ASSESSMENT` dan `IMPLEMENTATION_APPROACH`; heading 3→4 … 17→18. Struktur persis usulan dokumen diskusi §6.2 (Status NEEDED/NOT_NEEDED, dua sub-bagian, bentuk entri Question/Finding/Decision/Implication), termasuk kalimat doktrin di header section. Tanpa gate: `ensureSigmaDocEligible()` tidak disentuh sama sekali.

### 9.3 Perubahan `docCheck.ts`

`plan` dan `exec` di `DOC_SPECS` ([docCheck.ts:172-211](../src/utils/docCheck.ts#L172-L211)) masing-masing mendapat `optionalSections` **dan `sectionOrder` eksplisit** — tanpa `sectionOrder`, pemeriksaan urutan jatuh ke `requiredSections` dan section baru tidak divalidasi posisinya sama sekali.

Header template naik: `FMN_PLAN schema=1` → `2`, `DEV_EXEC schema=1` → `2` (informatif saja). Dokumen lama di project lain tetap `ok` — persis pola `AMENDMENT_HISTORY`. Menaikkannya ke `requiredSections` adalah keputusan terpisah di masa depan.

---

## 10. Fase 8 — Sapuan dokumentasi, rule, dan registry

| Target | Perubahan |
| :--- | :--- |
| [../README.md](../README.md) baris 562-565 | Hapus baris `plan queue` dan `plan activate`, hapus penyebutan FIFO, tambah `--v` |
| [../Sigma/SIGMA-OPERATION-REGISTRY.json](../Sigma/SIGMA-OPERATION-REGISTRY.json) | Hapus `plan_activate` + `plan_queue`, sunting `plan_lock`/`exec_new`/`exec_lock`/`plan_supersede`/`plan_status`/`exec_status`. **54 → 52 operasi.** Sekalian buang dua drift pada entry yang sama: syarat `COMPLETED`/`exec advance complete` (§1.7) dan klaim `decision_harvest` yang nol implementasinya di `src/` (D-12) |
| [../Sigma/SIGMA_PROTOCOL.md](../Sigma/SIGMA_PROTOCOL.md) §16/§16A | Command surface; Gate 3 didefinisikan ulang di bagian gerbang; invarian versi EXEC = versi PLAN ditulis eksplisit (§6.3) |
| [../Sigma/rules/FMN-RULE.md](../Sigma/rules/FMN-RULE.md) | §Role Activation + §CLI Operation Policy: FMN menghadapi >1 DRAFT PLAN **wajib menyurfacekan pilihan ke Director, dilarang memilih sendiri**. Plus paragraf Pre-requirement di §FMN-PLAN Creation Rules, mencontoh paragraf Protocol Overrides & Expansions |
| [../Sigma/rules/DEV-RULE.md](../Sigma/rules/DEV-RULE.md) | [DEV-RULE.md:526](../Sigma/rules/DEV-RULE.md#L526) "the locked `FMN-PLAN` selected by Sigma runtime" mengasumsikan target tunggal — DEV wajib memverifikasi eksplisit saat ada lebih dari satu PLAN/EXEC terbuka. Plus disiplin Technical Research |
| `setup/targets/**` (26 berkas skill + 5 bridge stub) | Semua penyebutan `plan lock`/`plan queue`/`plan activate`/FIFO. Tidak sampai ke project lain sampai `sigma setup update` dijalankan — wajib satu rilis dengan sisanya |
| `Sigma/role-memory/*.json` | Cek penyebutan urutan lock |

Seluruh dokumen Sigma ditulis **dalam bahasa Inggris**; plan ini berbahasa Indonesia karena bukan artefak Sigma.

---

## 11. Draf pesan error

```text
# plan lock, nol DRAFT
No DRAFT FMN-PLAN to lock. Run: sigma plan new

# plan lock, ambigu
3 DRAFT FMN-PLANs are open: v1.2, v1.3, v1.5
Specify which one to lock: sigma plan lock --v v1.2
Draft plans are no longer locked in creation order — selection is explicit.

# plan lock --v, target bukan DRAFT
FMN-PLAN v1.2 is in LOCKED state; lock requires DRAFT.

# exec new, guard per-PLAN
EXEC CONFLICT: FMN-PLAN v1.6 already has DEV-EXEC v1.6 in DRAFT state.
A plan has at most one execution — continue that DEV-EXEC instead of creating a new one:
  Sigma/build/DEV-EXEC-v1.6.md
  sigma exec check --v v1.6
To abandon it instead, supersede its plan and open a new plan version:
  sigma plan supersede --v v1.6 --reason "..."

# plan check / exec check, ambigu — ambang sama dengan lock
2 DRAFT FMN-PLANs are open: v1.2, v1.3
Specify which one to check: sigma plan check --v v1.2

# exec lock, ambigu
2 DRAFT DEV-EXECs are open: v1.4 (plan v1.4), v1.6 (plan v1.6)
Specify which one to lock: sigma exec lock --v v1.4

# supersede target yang sudah final
FMN-PLAN v1.5 is already SUPERSEDED (reason: deprioritised in favour of v1.6).

# close new, Gate 3 tertutup — pesan menyebut penyebab spesifiknya
GATE 3 BLOCKED: the chain still has open work.
  DRAFT FMN-PLAN: v1.7
  FMN-PLAN v1.6 is LOCKED but has no LOCKED DEV-EXEC
Every locked plan needs exactly one locked exec, and nothing may be left in DRAFT.
Abandon what is no longer wanted: sigma plan supersede --v v1.7 --reason "..."
```

Pesan Gate 3 sengaja menyebut **entri mana** yang menghalangi, bukan sekadar "gate blocked" — dengan syarat gabungan seperti sekarang, pesan generik memaksa Director menebak.

---

## 12. Keputusan — semuanya sudah ditutup

| ID | Pertanyaan | Keputusan Director |
| :--- | :--- | :--- |
| D-01 | Definisi Gate 3 | **Definisi Director** (§7.1): tanpa DRAFT di kedua domain, setiap PLAN LOCKED wajib berpasangan, PLAN SUPERSEDED diabaikan sepenuhnya |
| D-02 | `lock` memindahkan `active_version`? | **Ya** — prinsip §4.1 melarang pointer jadi *otoritas seleksi*, bukan melarangnya diperbarui |
| D-03 | State terminal `DISCARDED` + bump schema? | **Tidak.** `supersede` diperluas ke DRAFT; tidak ada state baru, tidak ada bump |
| D-04 | Jalan keluar untuk DRAFT EXEC | **Tidak ada pintu langsung** — supersede PLAN-nya, buka versi PLAN baru. Menjaga invarian kesamaan versi (§6.2) |
| D-05 | `supersede` butuh `--director-confirm`? | **Tidak** — cukup `--reason` + kelas Approval di doktrin |
| D-06 | `plan activate` dipertahankan? | **Dihapus** (§8.2) |
| D-07 | Penempatan section baru | **Ya** — FMN-PLAN §2, DEV-EXEC §3; renumbering tidak berdampak pada CLI |
| D-08 | Section baru masuk `optionalSections`? | **Ya** — kalau `required`, seluruh FMN-PLAN/DEV-EXEC lama di semua project Sigma langsung gagal `check`/`lock` |
| D-09 | Pasangan PLAN↔EXEC diukur bagaimana? | Dicek lewat **`plan_version_ref`** di kode; kesamaan versi dijamin secara konstruksi oleh §6.3, bukan lewat validasi baca |
| D-10 | Pending plan memblokir penutupan chain? | **Tidak**, dan tanpa peringatan CLI baru — FMN sudah wajib membriefkannya, ARC menilai kelayakan lewat Gate 3.5 (§7.2) |
| D-11 | Ambang ambiguitas untuk `check` | **Sama dengan `lock`**: lebih dari satu DRAFT. Berlaku prinsip umum §8.3 — tidak ada eksekusi diam-diam saat ambigu, termasuk pada command read-only |
| D-12 | Klaim `decision_harvest` di registry yang tidak ada implementasinya | **Dihapus dari entry yang memang disunting** (`plan_lock`, `exec_lock`); entry lain tetap di luar scope |

---

## 13. Rencana test

### 13.1 Berkas baru

- `test/plan-lock-targeting.test.ts` — nol/satu/banyak DRAFT; `--v` valid; `--v` bukan DRAFT; `--v` tidak ada; pointer setelah lock; Gate 2. Ditambah `plan check`/`exec check` menolak tanpa `--v` pada ambang yang sama (prinsip §8.3).
- `test/exec-concurrency.test.ts` — skenario penuh dokumen diskusi §1.5 (PLAN A lock → EXEC A draft → PLAN B lock → EXEC B **berhasil** dibuat); guard per-PLAN menolak EXEC kedua untuk PLAN yang sama; `exec lock --v` memilih di antara dua draft; daftar kandidat `--plan` tidak lagi memuat PLAN yang sudah punya EXEC DRAFT.
- `test/supersede-draft.test.ts` — supersede DRAFT plan; tolak target yang sudah SUPERSEDED (beserta `supersede_reason` lama utuh); cascade EXEC DRAFT saat PLAN-nya di-supersede tetap jalan; **regresi §1.3**: men-supersede PLAN LOCKED terakhir lalu menjalankan command menulis berikutnya tidak lagi gagal.
- `test/exec-version-parity.test.ts` — `EXEC.version === PLAN.version` pada eksekusi berurutan **dan** tidak berurutan (skenario §1.2, yang hari ini menghasilkan EXEC v1.3 untuk PLAN v1.1); siklus penuh supersede-PLAN → `plan new` → `plan lock` → `exec new` menghasilkan pasangan versi yang sama; guard duplikat versi tetap menyala bila ada data yang menyalahi invarian.
- `test/gate3-semantics.test.ts` — definisi baru: dua PLAN LOCKED yang keduanya berpasangan → true; satu berpasangan satu tidak → false; ada DRAFT plan → false; ada DRAFT exec → false; PLAN SUPERSEDED tanpa EXEC tidak menghalangi; pending plan tidak menghalangi (§7.2); recompute di setiap titik §7.3; `doctor` merepair ke nilai yang sama; pesan `close new` menyebut entri penghalang.

### 13.2 Berkas yang disunting

- `test/plan-activate.test.ts` — **dihapus** bersama command-nya; bagian gerbang verdict AUD di dalamnya (baris 171-205) dipindahkan ke `plan-lock-targeting.test.ts` agar tidak ikut hilang.
- `test/chain-engine.test.ts:209` — menyesuaikan signature engine baru.
- `test/doc-check-optional-sections.test.ts` — perluas ke `PRE_REQUIREMENT` dan `TECHNICAL_RESEARCH`.

**Wajib dijalankan dan diperiksa manual meski tidak disunting** (semuanya menyentuh gate/lock): `gate-enforcement`, `exec-close-verdict-gates`, `chain-gate`, `lifecycle-hardening`, `doctor-invalid`, `doctor-schema-migration`, `progress-hardening`, `reconstruct`, `plan-supersede`.

Baseline terverifikasi hari ini: **272/272 lulus, 31 berkas**. Target: seluruh baseline tetap hijau (dikurangi yang memang dihapus) + test baru.

---

## 14. Urutan eksekusi dan risiko

Urutan wajib: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.**

Fase 3 tidak boleh mendahului Fase 2 (guard per-PLAN yang membuat EXEC konkuren mungkin). **Fase 4 wajib mendahului Fase 5** — Fase 5 menjadikan DRAFT sebagai penghalang penutupan chain, jadi pintu keluarnya harus sudah ada. Fase 8 terakhir supaya dokumentasi menggambarkan kode yang final.

**Risiko:**

1. **Pencabutan FIFO adalah breaking change.** Kebiasaan menjalankan `sigma plan lock` tanpa argumen akan gagal begitu ada dua DRAFT. Dampak praktis kecil pada konteks single-operator, tapi bukan nol.
2. **Tiga command hilang atau berubah bentuk** (`plan queue`, `plan activate`, `plan status`/`exec status`). Ini permukaan yang dibaca AI role di project lain lewat berkas skill, jadi 26 berkas `setup/targets/**` harus ikut satu rilis — berkas yang terlewat akan menyuruh role menjalankan command yang sudah tidak ada.
3. **Fase 5 adalah titik paling rawan.** Salah sedikit muncul sebagai chain yang gagal divalidasi, bukan sebagai bug perilaku. Commit terpisah, dan `sigma doctor` diverifikasi bisa memulihkan chain yang terlanjur salah.
4. **Gate 3 jadi lebih ketat dari sebelumnya.** Chain yang hari ini bisa ditutup dengan PLAN LOCKED tanpa EXEC tidak lagi bisa. Ini disengaja (§7.1), tapi berarti chain berjalan yang sudah dalam kondisi itu akan menemukan `close new` tertutup setelah upgrade, dan harus menyelesaikan atau men-supersede PLAN yang menggantung lebih dulu.

**`SCHEMA_VERSION` tidak naik** — tidak ada perubahan format berkas. Ini keuntungan langsung dari keputusan D-03: chain baru tetap terbaca sigma versi lama.

---

## 15. Eksplisit di luar scope

- Drift `SIGMA_PROTOCOL.md` §5.2/§5.3 (tabel definisi artefak FMN-PLAN/DEV-EXEC) — ditunda Director di header dokumen diskusi. Tidak disentuh, termasuk saat Fase 8 menyunting §16.
- Drift struktural `SIGMA-OPERATION-REGISTRY.json` yang lebih luas: `active_state`/`active_version` dipakai untuk domain roadmap/close yang skemanya tunggal. Hanya entry yang memang disunting di Fase 8 yang dibereskan.
- Menghapus field `active_version`/`active_state` sepenuhnya dari skema. Setelah Fase 6 tidak ada command baca yang memakainya, tapi `override`, MCP, rekonstruksi, dan invarian `validateTracker` masih — pekerjaan lain, di kemudian hari.
- Resolusi dependensi transitif pada tabel Pre-requirement — dilarang eksplisit oleh dokumen diskusi §5.1.
- Gate atau verifikasi AI apa pun untuk Technical Research — dilarang eksplisit oleh dokumen diskusi §6.3.
- Mekanisme "resume" untuk DRAFT EXEC — tidak diperlukan; melanjutkan = menyunting kembali berkas `.md` yang sama.
