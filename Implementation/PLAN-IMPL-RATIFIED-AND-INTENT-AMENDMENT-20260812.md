# PLAN-IMPL — `RATIFIED` + Intent Amendment Model

**Sumber**: [../Discussion/2026-08-11_0115_Intent-taxonomy-and-amendment-model.md](../Discussion/2026-08-11_0115_Intent-taxonomy-and-amendment-model.md) (dokumen sumber kebenaran saat ini), dengan konteks asal di [../Discussion/2026-08-11_0021_Intent-evaluation-sigma.md](../Discussion/2026-08-11_0021_Intent-evaluation-sigma.md).
**Tanggal**: 2026-08-12
**Status**: **SELURUH FASE (1–6) SELESAI DIEKSEKUSI (2026-08-12)** — lihat §12 untuk urutan fase. Ringkasan per fase:

- **Fase 1/2** (rename RATIFIED): rename schema `LOCKED`→`RATIFIED` + `locked_at`→`ratified_at` khusus intent; normalisasi baca legacy di `readChain()` dengan penanda `_migratedOnRead`; migrasi persisten via `sigma doctor` dengan pelaporan `repaired[]` (diverifikasi manual end-to-end); command `sigma intent lock` dihapus total, diganti `sigma intent ratify` dengan tombstone; bump `SCHEMA_VERSION` → `1.1.0`; taksonomi tier Sovereign/Operationalization di `DIR-INTENT-TEMPLATE.md` §1.6/§6/§9 + judul §13.1 → "Ratify Requirement"; sapuan terminologi menyeluruh (`SIGMA_PROTOCOL.md`, rule docs, registry, role-memory, README, bridge stub, `setup/targets/**`). Bug nyata ditemukan & diperbaiki: `readExistingChain()` di `reconstruct.ts` melewati normalisasi `readChain()`, menyebabkan chain legacy kehilangan riwayat title/focus PLAN — diperbaiki dengan delegasi ke `readChain()`.
- **Fase 3** (effective-state): `AmendmentEntry` + `amendments[]`/`effective_amendment`/`certified_doc_sha256`/`certified_at` di `SingleIntentState`; `certifyIntentDoc()`/`isIntentDocUncertified()` (SHA-256, deliberately terpisah dari `ratifyIntent()` yang tetap pure/no-I/O); `UNCERTIFIED_EDIT` disurfacekan di `intent status`, `intent check`, `session bootstrap`, dan MCP `sigma_get_orientation`/`sigma_list_artifacts`; `sigma doctor` sengaja tidak pernah men-stempel ulang hash (no self-heal, dengan komentar eksplisit di kode).
- **Fase 4** (Section 14 + docCheck): `replaceSection`/`removeSectionIfPresent` digeneralisasi ke `src/utils/renderMarkers.ts` (di-re-export dari `roadmap.ts`); modul baru `src/utils/amendmentHistory.ts` (render + auto-inject idempoten); Section 14 ditambahkan ke `DIR-INTENT-TEMPLATE.md`, `schema=3`→`4`; `docCheck.ts` dapat `optionalSections`/`sectionOrder` — dokumen lama tanpa Section 14 tetap `ok`, dokumen baru tidak kena warning "unknown section", urutan tetap divalidasi saat section hadir.
- **Fase 5** (command): `sigma intent amendment --change "..." [--v <version>]` — guard state RATIFIED, sanitasi `|`/newline/kosong, urutan eksekusi id→append→render(+auto-inject)→hash→writeChain→log (`Sigma/logs/intent_amendment.log`, JSONL), tanpa `--director-confirm` (D-02). Diverifikasi end-to-end manual: ratify→edit manual→UNCERTIFIED_EDIT muncul→amendment→cleared, AMD-001→AMD-002 berurutan, auto-inject pada dokumen lama.
- **Fase 6** (dokumentasi): `SIGMA_PROTOCOL.md` §5.1.1 (mekanisme lengkap), §16/§16A (command surface + Approval-class); `ARC-RULE.md` §Amendment Request baru (diagram klasifikasi, "ARC mengklasifikasi bukan menyetujui", non-retroaktivitas); `FMN-RULE.md` framing sadar-tier + tabel Protocol Overrides (`NOTED`/`AMENDMENT_REQUESTED`/`AMENDMENT_RATIFIED`); `FMN-PLAN-TEMPLATE.md` §5 redesign; `SIGMA-OPERATION-REGISTRY.json` entry `intent_amendment` baru (total 54 operasi); README command table.

**Test**: 272/272 lulus (31 file) — termasuk 12 test baru `intent-amendment.test.ts` (guard, urutan id, render, auto-inject, log, effective-state penuh) dan 3 test baru `doc-check-optional-sections.test.ts`.

**Insiden sesi ini, diperbaiki**: catatan Section 14 di template dan `amendmentHistory.ts` sempat tertulis dalam Bahasa Indonesia (tersalin langsung dari draf dokumen plan tanpa diterjemahkan) — ditandai Director, diperbaiki ke Bahasa Inggris di kedua lokasi. Disapu ulang menyeluruh, tidak ada sisa.

**Temuan di luar scope, dicatat untuk sesi mendatang**: `Sigma/SIGMA-OPERATION-REGISTRY.json` punya drift struktural yang lebih luas dari sekadar RATIFIED — field `active_state`/`active_version` dipakai untuk domain (roadmap/close) yang skemanya sebenarnya cuma `state` tunggal, dan beberapa entry masih menyebut mekanisme `stale_intent`/`--ack-stale-intent` yang sudah tidak ada di kode sejak PLAN-EVAL-01. Tidak disentuh sesi ini — di luar scope rename RATIFIED, hanya bagian yang bersinggungan langsung (nilai `LOCKED`→`RATIFIED` untuk intent) yang diperbaiki. ~18 fixture test inline (`test/*.ts`) juga masih menulis literal `state: 'LOCKED'` untuk intent — tidak berdampak (dinormalisasi `readChain()` saat baca, seluruh suite tetap hijau) tapi belum disapu untuk konsistensi kosmetik. **Periodic Intent Re-evaluation** (dokumen sumber §4, mekanisme deteksi cumulative drift) juga tetap di luar scope — lihat §11.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma. Format mengacu longgar pada DEV-EXEC template — bukan artifact Sigma.

---

## Inti

Tiga perubahan yang saling terkait, dikerjakan dalam enam fase:

1. **`LOCKED` → `RATIFIED`, khusus DIR-INTENT** — beserta command-nya: `sigma intent lock` → **`sigma intent ratify`** (arahan Director, 2026-08-12). Fungsi identik, makna dipertegas. Migrasi `progress-v<N>.json` lama ditangani dua lapis: normalisasi saat baca (kompatibilitas langsung) + `sigma doctor` yang mempersistensikan konversi ke disk.
2. **Taksonomi tier Sovereign / Operationalization** di level *item*, ditulis ke template + rule docs. Nol kode CLI — ini guardrail eksplisit dari AUD.
3. **Mekanisme Amendment**: `chain.intent.amendments[]` sebagai sumber render, Section 14 di DIR-INTENT sebagai proyeksi, `intent_amendment.log` sebagai jejak audit, dan command baru `sigma intent amendment --change "..."`.

Ditambah satu hal yang dokumen sumber tandai terbuka dan plan ini usulkan solusinya secara konkret: **effective-state semantics** — jaminan sistem (bukan disiplin prosedural) bahwa teks `.md` yang sudah diedit tapi belum disertifikasi tidak terbaca sebagai Operationalization efektif (§5).

---

## 1. Prasyarat: dua item blocking AUD

AUD memberi verdict `REVISE` untuk "dokumen diskusi ini sebagai basis plan implementasi", dengan dua item yang dinilai blocking (dokumen sumber §6):

| Item blocking AUD | Ditangani di | Sifat penanganan |
| :--- | :--- | :--- |
| Taksonomi item-level Sovereign/Operationalization | **Fase 1** (§4) | Diselesaikan penuh sebagai pekerjaan dokumen/template. Tidak ada kode. |
| Effective-state semantics sebelum sertifikasi | **Fase 3** (§5) | Diusulkan solusi konkret berbasis hash dokumen; butuh keputusan Director (D-03). |

Fase 1 sengaja dijadwalkan **sebelum** semua fase kode. Alasannya bukan formalitas urutan: tanpa taksonomi tier, command `sigma intent amendment` tidak punya definisi operasional untuk "apa yang boleh diamandemen", dan ARC tidak punya dasar klasifikasi selain intuisi — persis kondisi yang model ini dibuat untuk menghilangkan.

---

## 2. Temuan verifikasi terhadap kode nyata

Diverifikasi langsung ke source, bukan diasumsikan dari dokumen. Empat temuan mengubah asumsi dokumen sumber:

### 2.1 `INACTIVE` sudah tidak ada di kode — dokumen sumber salah asumsi

Dokumen sumber §3 item 1 menetapkan state machine baru `DRAFT → RATIFIED → INACTIVE → SUPERSEDED`, "hanya label `LOCKED` yang di-rename". Faktanya di [../src/engine/chain.ts:137-139](../src/engine/chain.ts#L137-L139):

```ts
// PLAN-EVAL-01 §3.4 — INACTIVE dropped: structurally dead once each chain
// file holds exactly one intent (nothing left in the same file to demote).
export type IntentState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
```

`INACTIVE` dihapus di PLAN-EVAL-01 karena satu file chain hanya memuat satu intent — tidak ada lagi yang bisa didemosi. Yang membuat dokumen sumber (dan AUD, yang menarik temuannya setelah dikutipkan protokol) mengira `INACTIVE` masih hidup adalah **[../Sigma/SIGMA_PROTOCOL.md:203-216](../Sigma/SIGMA_PROTOCOL.md#L203-L216) yang belum diperbarui sejak PLAN-EVAL-01** — masih mendokumentasikan auto-demote ke `INACTIVE` dan state machine 4-state.

Konsekuensi: state machine target sebenarnya `DRAFT → RATIFIED → SUPERSEDED`. Lihat D-01.

### 2.2 Drift dokumentasi lain di area yang sama

Ditemukan saat menelusuri jalur yang sama, perlu dibereskan sekalian karena akan makin menyesatkan setelah rename:

- `SIGMA-OPERATION-REGISTRY.json`, entry `intent_lock`: masih mendeskripsikan "Auto-supersedes any prior LOCKED INTENT (single-active policy)" dan propagasi `STALE_INTENT` — dua mekanisme yang sudah tidak ada.
- [../Sigma/SIGMA_PROTOCOL.md:382-387](../Sigma/SIGMA_PROTOCOL.md#L382-L387) (Gate 3) mengulang klaim demote-ke-`INACTIVE` yang sama.

### 2.3 `replaceSection()` masih terikat ROADMAP

[../src/utils/roadmap.ts:37-48](../src/utils/roadmap.ts#L37-L48) adalah mekanisme render yang dokumen sumber minta ditiru persis, tapi pesan errornya hard-coded `"in ROADMAP file"`. Dipakai apa adanya untuk DIR-INTENT, pesan error jadi salah.

### 2.4 Menambah section wajib ke DIR-INTENT akan memblokir dokumen lama

[../src/utils/docCheck.ts:536-543](../src/utils/docCheck.ts#L536-L543): section id yang ada di `requiredSections` tapi tidak ada di file → **error**, dan `ok: false` berarti `sigma intent ratify` menolak jalan ([../src/utils/docCheck.ts:666-677](../src/utils/docCheck.ts#L666-L677)). Sebaliknya, marker yang ada di file tapi tidak terdaftar → warning `Unknown section markers found`.

Artinya menambahkan `AMENDMENT_HISTORY` ke `requiredSections` akan langsung mematahkan `intent check`/`intent ratify` untuk setiap DIR-INTENT yang dibuat dari template lama di semua project Sigma yang sudah jalan. Butuh konsep section "dikenal tapi tidak wajib". Lihat §6.2 dan D-05.

---

## 3. Fase 2 — Rename `LOCKED` → `RATIFIED` + command `intent ratify`

> Diletakkan sebagai fase kode pertama karena semua fase berikutnya menyentuh `SingleIntentState`; melakukannya belakangan berarti menulis ulang kode yang baru saja ditulis.
>
> **Catatan ejaan**: Director menuliskan `ractify`. Bentuk baku bahasa Inggrisnya `ratify` (→ `RATIFIED`), dan plan ini memakai itu — konsisten dengan nama state serta aturan SIGMA_PROTOCOL §16D bahwa identifier formal tetap bahasa Inggris. Kalau Director memang menghendaki ejaan `ractify`, itu perlu dinyatakan eksplisit karena akan berbeda dari nama state-nya sendiri.

### 3.1 Schema

[../src/engine/chain.ts:139](../src/engine/chain.ts#L139):

```ts
// Rename doktrinal (Discussion 2026-08-11_0115 §3 item 1): ratifikasi
// menetapkan intent yang mengatur, tidak membekukan operasionalisasinya.
// Hanya DIR-INTENT yang memakai RATIFIED — Roadmap/Plan/Exec/Close tetap LOCKED.
export type IntentState = 'DRAFT' | 'RATIFIED' | 'SUPERSEDED';
```

`RoadmapState`, `CloseState`, `ArtifactVersion.state` (plan/exec) **tidak disentuh**.

### 3.2 Kompatibilitas file lama — lapis 1: normalisasi saat baca

Dua lapis yang saling melengkapi, bukan dua alternatif:

| Lapis | Mekanisme | Tugas |
| :--- | :--- | :--- |
| 1 | Normalisasi di `readChain()` (§3.2) | Membuat chain lama **langsung jalan** tanpa tindakan apa pun dari Director. |
| 2 | `sigma doctor` (§3.7) | **Mempersistensikan** konversi ke disk + bump `schema_version`, sehingga file jadi self-describing dan lapis 1 suatu saat bisa dicabut. |

Tanpa lapis 1, setiap project yang belum menjalankan `doctor` akan melihat Gate 1 tertutup tanpa penjelasan. Tanpa lapis 2, file di disk selamanya menyimpan label lama dan lapis 1 jadi utang permanen.

Titik tunggal di `readChain()` ([../src/engine/chain.ts](../src/engine/chain.ts), sekitar validasi required-keys di baris ~360):

```ts
// Kompatibilitas mundur: chain yang ditulis sebelum rename menyimpan
// "LOCKED" (dan, untuk file hasil migrasi legacy yang sangat lama,
// mungkin "INACTIVE"). Dinormalisasi saat baca; file di disk ikut
// tertulis ulang dengan label baru pada operasi tulis berikutnya.
function normalizeIntentStateOnRead(chain: ChainState): void {
  const legacy = chain.intent.state as string;
  if (legacy === 'LOCKED' || legacy === 'INACTIVE') {
    chain.intent.state = 'RATIFIED';
  }
  // lihat D-09 — field waktu ikut di-rename
  const legacyAt = (chain.intent as Record<string, unknown>).locked_at as string | undefined;
  if (legacyAt && !chain.intent.ratified_at) {
    chain.intent.ratified_at = legacyAt;
    delete (chain.intent as Record<string, unknown>).locked_at;
  }
}
```

Alasan memilih normalisasi baca dibanding command migrasi:

- Konsisten dengan preseden project: PLAN-EVAL-01 menyelesaikan penghapusan `INACTIVE` tanpa memaksa Director menjalankan langkah manual.
- Satu choke point. Setiap pembacaan chain melewati `readChain()`; tidak ada jalur baca kedua yang bisa terlewat.
- Tidak ada file yang ditulis ulang sampai ada operasi yang memang menulis — sejalan dengan sikap "git sebagai jaring pengaman, bukan mekanisme backup sendiri".

`scripts/migrate-legacy-progress.js` memetakan `INACTIVE` legacy ke `LOCKED`/`SUPERSEDED` secara eksplisit saat migrasi, jadi cabang `INACTIVE` di atas defensif — bukan jalur yang diharapkan aktif.

### 3.3 Bump `SCHEMA_VERSION` → `1.1.0`

[../src/config.ts:5](../src/config.ts#L5). Ini bukan kosmetik. [../src/engine/chain.ts:578-582](../src/engine/chain.ts#L578-L582) sudah punya `isNewerSchema()` yang menandai chain sebagai INVALID kalau schema-nya lebih baru dari yang didukung binary. Tanpa bump, sigma versi lama yang membaca chain berisi `"state": "RATIFIED"` akan diam-diam menganggap intent **tidak** terkunci (`hasActiveLockedIntent()` → `false`), sehingga gerbang tampak tertutup tanpa penjelasan. Dengan bump, kondisinya jadi pesan INVALID yang jelas.

### 3.4 Command rename — `sigma intent lock` → `sigma intent ratify`

Perubahan di [../src/commands/intent.ts:125](../src/commands/intent.ts#L125):

```ts
cmd.command('ratify')
  .description('Ratify active DIR-INTENT (opens Gate 1, lifecycle → BUILD)')
```

**Keputusan Director (D-08): `lock` dihapus total — tanpa alias, tanpa masa tenggang.**

Guard internal **tidak berubah**: state awal yang disyaratkan tetap `DRAFT`, validasi dokumen tetap `validateSigmaDocFile(absPath, 'intent')` + `ensureSigmaDocEligible()`. Yang berubah hanya nama command, deskripsi, dan label state yang ditulis. Fungsi `lockActiveIntent()` ([chain.ts:919](../src/engine/chain.ts#L919)) di-rename `ratifyIntent()`.

**Satu detail eksekusi yang perlu diputuskan saat coding, bukan sekarang**: `sigma intent lock` yang dijalankan setelah penghapusan akan gagal dengan pesan commander generik. Menambahkan satu *tombstone* — subcommand `lock` yang **tidak melakukan ratifikasi apa pun**, hanya mencetak pesan dan `exit 1` — mengubah kegagalan itu jadi terarah:

```
Error: `sigma intent lock` has been removed. Use `sigma intent ratify`.
DIR-INTENT is ratified, not locked — see SIGMA_PROTOCOL §5.1.
```

Ini tetap penghapusan total dalam arti fungsional (command tidak lagi meratifikasi apa pun), dan justru menegakkan terminologi baru di titik paling efektif: saat seseorang memakai istilah lama.

**Blast radius rename — sudah diinventarisasi, lebih besar dari yang terlihat.** String `intent lock` muncul di 39 berkas di luar `Discussion/` dan `Implementation/`:

| Kelompok | Jumlah | Catatan |
| :--- | :--- | :--- |
| `setup/targets/**` — skill file claude_code / codex / antigravity / reasonix + bridge stub | 26 | Ini yang dibaca AI role di project lain. Baru ikut berubah setelah user menjalankan `sigma setup update`. **Tanpa alias, ini bukan lagi soal kerapian**: setiap berkas yang terlewat akan menyuruh AI role menjalankan command yang gagal keras. Semuanya wajib ikut di rilis yang sama. |
| Bridge stub di root repo (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `DEEPSEEK.md`, `REASONIX.md`) | 5 | Salinan hasil generate; sumbernya `setup/targets/bridge/`. |
| Rule docs + protokol + template + registry + role memory | 7 | Termasuk `Sigma/role-memory/arc-memory.json`. |
| Source + README | 6 | Pesan CLI dan saran "Next:". |

Titik yang mudah terlewat karena bukan berupa dokumentasi: `getNextValidOperations()` ([chain.ts:1284](../src/engine/chain.ts#L1284)) mem-push literal `'intent lock'`, dan string itu muncul di `sigma session bootstrap` serta MCP `sigma_get_orientation` sebagai saran langkah berikutnya untuk AI role.

### 3.5 `locked_at` → `ratified_at`

Konsekuensi wajar dari tujuan "mempertegas dan konsistensi status": membiarkan `intent.locked_at` di sebelah `intent.state: "RATIFIED"` justru memulihkan ambiguitas yang rename ini hilangkan. Perubahan pada `SingleIntentState` ([chain.ts:147-164](../src/engine/chain.ts#L147-L164)), dengan normalisasi baca di §3.2 dan persistensi lewat `doctor` di §3.7. Field `locked_at` pada roadmap/plan/exec/close **tidak** disentuh. Lihat D-09.

### 3.6 Call site yang harus diubah

Semua sudah diinventarisasi:

| File | Baris | Sifat |
| :--- | :--- | :--- |
| [../src/engine/chain.ts](../src/engine/chain.ts) | 546, 558, 574, 783, 919-926, 966, 997-1003, 1280-1284 | Perbandingan state + transisi. `lockActiveIntent()` menulis `'RATIFIED'`. |
| [../src/commands/intent.ts](../src/commands/intent.ts) | 132, 188-189, 196 | Guard `lock` (tetap butuh `DRAFT`), guard + pesan `supersede`. |
| [../src/commands/plan.ts](../src/commands/plan.ts) | 111, 247 | Gate 1 / Gate 2 prasyarat. |
| [../src/commands/roadmap.ts](../src/commands/roadmap.ts) | 47 | Gate 1.5 prasyarat. |
| [../src/engine/reconstruct.ts](../src/engine/reconstruct.ts) | 343, 467 | `doctor --reconstruct` menulis state hasil rekonstruksi. |
| [../src/commands/doctor.ts](../src/commands/doctor.ts), [session.ts](../src/commands/session.ts), [project.ts](../src/commands/project.ts), [../src/mcp/tools/artifacts.ts](../src/mcp/tools/artifacts.ts) | 181 / 164 / 367 / 23 | Passthrough tampilan — otomatis benar, tapi perlu dicek lebar kolom (`padEnd(14)` di [intent.ts:325](../src/commands/intent.ts#L325) masih cukup untuk `RATIFIED`). |

Nama fungsi `hasActiveLockedIntent()` ([chain.ts:545-547](../src/engine/chain.ts#L545-L547)) ikut di-rename `hasRatifiedIntent()` agar tidak jadi sumber kebingungan berikutnya.

### 3.7 `sigma doctor` — migrasi otomatis `LOCKED` → `RATIFIED` (arahan Director)

**Tempat yang tepat: `runDoctorReconciliation()`** di [../src/engine/chain.ts:737](../src/engine/chain.ts#L737) — bukan di `doctor.ts`. Alasannya struktural, bukan selera: fungsi itu sudah menjadi satu-satunya tempat perbaikan otomatis dilakukan, sudah mengembalikan `report.repaired[]` untuk dilaporkan, dan ketiga mode `doctor` sudah memanggil `writeChain()` setelahnya ([doctor.ts:38](../src/commands/doctor.ts#L38), [doctor.ts:101](../src/commands/doctor.ts#L101)). Menaruhnya di sana membuat ketiga mode ikut termigrasi tanpa kode tambahan:

| Mode | Cakupan migrasi |
| :--- | :--- |
| `sigma doctor` (default) | Chain aktif. |
| `sigma doctor --all-versions` | Setiap chain di disk — **ini jalur migrasi yang sebenarnya**, karena chain lama umumnya bukan yang aktif. |
| `sigma doctor --reconstruct` | Tidak relevan: `reconstruct.ts:343` menulis state dari nol, jadi sudah menulis `RATIFIED` setelah Fase 2. |

Perbaikan yang ditambahkan, mengikuti bentuk auto-repair yang sudah ada di fungsi itu:

```ts
// Migrasi label ratifikasi (Fase 2). Chain yang ditulis sebelum rename
// menyimpan "LOCKED"; readChain() sudah menormalkannya saat baca, langkah
// ini yang mempersistensikannya ke disk sekaligus menaikkan schema_version,
// supaya file berhenti bergantung pada lapis normalisasi baca.
if (rawIntentStateWas('LOCKED') || rawIntentLockedAtPresent()) {
  repaired.push(`intent.state migrated "LOCKED" → "RATIFIED" (and locked_at → ratified_at)`);
}
if (chain.schema_version !== SCHEMA_VERSION && !isNewerSchema(chain.schema_version, SCHEMA_VERSION)) {
  repaired.push(`schema_version migrated "${chain.schema_version}" → "${SCHEMA_VERSION}"`);
  chain.schema_version = SCHEMA_VERSION;
}
```

Satu detail implementasi yang harus diperhatikan, kalau tidak fitur ini jadi tidak terlihat sama sekali: karena `readChain()` sudah menormalkan state **sebelum** `runDoctorReconciliation()` melihatnya, pada titik ini chain sudah bernilai `RATIFIED` dan tidak ada apa pun yang tersisa untuk dideteksi. Jadi normalisasi baca harus **melaporkan** apa yang diubahnya, bukan mengubahnya diam-diam. Opsi paling bersih: `readChain()` menyetel penanda non-persisten pada objek hasil baca —

```ts
// tidak ikut ditulis ke disk; hanya penanda in-memory bahwa nilai di file
// berbeda dari nilai yang dipakai runtime
export interface ChainState {
  // ...
  /** @internal */ _migratedOnRead?: string[];
}
```

— dan `runDoctorReconciliation()` mengangkat isinya ke `repaired[]`. Tanpa ini, `doctor` akan menulis file yang sudah terkonversi tapi melaporkan "tidak ada yang diperbaiki", sehingga Director tidak punya cara tahu migrasi sudah terjadi. `writeChain()` harus membuang field `_` sebelum serialisasi.

**Naikkan `schema_version` hanya ke arah maju.** Guard `isNewerSchema()` di atas mencegah `doctor` versi lama menurunkan chain yang ditulis binary lebih baru.

Bagian ini **tidak** ada hubungannya dengan `certified_doc_sha256` di §5.5 — di sana `doctor` sengaja hanya melapor tanpa menyembuhkan. Perbedaannya tegas: migrasi label adalah rename mekanis yang tidak menghapus informasi apa pun; men-stempel ulang hash justru menghapus satu-satunya bukti bahwa dokumen diedit di luar jalur amandemen.

### 3.8 Pesan CLI

```
DIR-INTENT v2 RATIFIED. Gate 1 open. Lifecycle → BUILD. Next: sigma roadmap new
```

### 3.9 Sapuan terminologi — "locked intent" → "ratified intent" (D-10)

Keputusan Director: **istilah lock generik dibiarkan apa adanya**; yang disapu hanya yang secara eksplisit merujuk DIR-INTENT.

**Diubah** — prosa yang menyebut intent dikunci:

| Pola | Jumlah kemunculan | Jadi |
| :--- | :--- | :--- |
| `intent lock` / `INTENT lock` (nama command) | 71 | `intent ratify` |
| `DIR-INTENT is LOCKED` | 17 | `DIR-INTENT is RATIFIED` |
| `locked intent` / `locked \`DIR-INTENT\`` / `locked DIR-INTENT` / `locked INTENT` | 27 | `ratified intent` / `ratified DIR-INTENT` |
| `LOCKED DIR-INTENT` / `LOCKED intent` / `LOCKED INTENT` | 9 | `RATIFIED DIR-INTENT` / `RATIFIED intent` |
| `DIR-INTENT must be LOCKED` / `intent must be LOCKED` | 5 | `must be RATIFIED` |
| Judul §13.1 `Lock Requirement` di DIR-INTENT template | 1 | `Ratify Requirement` (keputusan Director 2026-08-12) |

±130 kemunculan di `Sigma/`, `setup/targets/`, `README.md`, dan bridge stub root. Yang paling padat: `SIGMA-OPERATION-REGISTRY.json`, `SIGMA_PROTOCOL.md`, `ARC-RULE.md`, `FMN-RULE.md` — plus `Sigma/role-memory/arc-memory.json` dan `fmn-memory.json`, yang dibaca peran pada setiap aktivasi.

Termasuk pesan error runtime yang menyebut intent secara eksplisit, mis. `Gate 1 blocked: DIR-INTENT must be LOCKED before ROADMAP can be created.` ([roadmap.ts:47](../src/commands/roadmap.ts#L47), [plan.ts:111](../src/commands/plan.ts#L111)) dan pesan `intent supersede` di [intent.ts:189](../src/commands/intent.ts#L189).

**Dibiarkan** — istilah lock yang tidak merujuk intent:

- `Lock readiness` / `Lock Requirements` di output `check` ([docCheck.ts:645-663](../src/utils/docCheck.ts#L645-L663)) — keputusan Director; ini label generik lintas domain, dan mengubahnya akan memutus kontrak string yang dibaca AI role lewat Pre-Lock Verification Rule.
- `locked FMN-PLAN`, `locked DEV-EXEC`, `LOCKED` sebagai state artifact lain.
- `plan lock`, `exec lock`, `close lock`, `Lock State` di header template non-intent, `sigma {domain} lock` generik.
- `Sigma/templates/DIR-INTENT-TEMPLATE.md` baris "**Lock State**: Managed by Sigma CLI" — merujuk mekanisme CLI generik, bukan status intent. Batas ini memang tipis; kalau Director menghendaki baris ini ikut, sebutkan saat review.

**Aman diubah — sudah diverifikasi**: judul §13.1 tidak dibaca parser mana pun. `evaluateFinalChecklistGate()` menemukan batas daftar Lock Requirement lewat `CONDITIONAL_REQUIREMENT_HEADING` ([docCheck.ts:76](../src/utils/docCheck.ts#L76)) yang menganchor ke judul **13.2** "Conditional Requirement", lalu memindai checkbox dari marker section sampai batas itu — teks judul 13.1 tidak pernah dicocokkan. Dua tempat yang harus ikut berubah supaya tidak jadi drift baru: fixture DIR-INTENT di `test/helpers.ts:432` (bukan karena test akan gagal — memang tidak — tapi supaya fixture tetap cermin template), dan `ARC-RULE.md:310` yang menyuruh ARC "complete the Lock Requirement checklist in Section 13".

Catatan konsistensi yang diterima: judul template jadi "Ratify Requirement" sementara label output `check` tetap "Lock Requirements". Keduanya memang beda cakupan — judul template khusus DIR-INTENT, label CLI generik lintas domain — dan label CLI sengaja tidak disentuh agar kontrak string Pre-Lock Verification Rule tetap utuh (D-10).

**Guard regresi yang disarankan**: satu test yang mem-*grep* `Sigma/`, `setup/targets/`, dan `README.md` untuk pola `intent lock` dan menggagalkan build kalau ada yang tersisa. Drift antara rule doc dan CLI nyata sudah pernah terjadi di project ini (PLAN-18: rule doc menyebut `sigma message send` sementara command sebenarnya `sigma send`), dan justru rule doc yang jadi mata rantai terlemah karena tidak ada yang mengeksekusinya. Tanpa alias, drift yang sama sekarang berakibat command gagal keras, bukan sekadar membingungkan.

### 3.10 Test

`test/helpers.ts` (55 kemunculan `LOCKED`) adalah pusat gravitasi perubahan test — fixture intent di baris 155, 171, 192 dan seterusnya. Fixture plan/exec/roadmap/close **tidak** berubah. Ini justru menjadikan test suite pemeriksa alami untuk aturan "rename hanya untuk DIR-INTENT": kalau ada test plan/exec yang ikut rusak, berarti rename bocor ke domain lain.

---

## 4. Fase 1 — Taksonomi tier item-level (nol kode)

> Fase dokumen, dikerjakan **sebelum** semua fase kode. Guardrail AUD dipatuhi: tidak ada validator semantik CLI untuk taksonomi ini, sekarang maupun sebagai follow-up.

### 4.1 Pola yang diperluas

[../Sigma/templates/DIR-INTENT-TEMPLATE.md:236-248](../Sigma/templates/DIR-INTENT-TEMPLATE.md#L236-L248) §7 sudah punya polanya: kolom **Binding Level** per baris, dengan definisi eksplisit di bawah tabel. Yang dilakukan hanya memperluas pola itu ke §6 dan §9 — tidak menciptakan mekanisme baru.

### 4.2 Peta tier per section

| Section | Tier | Dasar |
| :--- | :--- | :--- |
| §1 Intent Core (1.1–1.5) | **Sovereign**, seluruhnya | Sudah berjudul "Sovereign Layer" di template. Tujuan, penerima manfaat, nilai utama. |
| §3.1 Concrete Outcome, §3.2 Success Threshold | Operationalization | Template sudah menyatakan 3.1 "mengoperasionalkan" 1.4 — pengakuan tier yang sudah ada secara tekstual. |
| §4 Quality Bar | Operationalization | Standar minimum bisa menajam seiring pemahaman. |
| §5 Strategic Trade-Offs | **Sovereign** | Ini pernyataan nilai Director, bukan terjemahan ARC. |
| §6 Scope Boundary (6.1/6.2/6.3) | **Campur — per item** | Justru di sini drift CanopySense terjadi. Butuh tag per baris. |
| §7 Constraints | Sudah ber-tier (Binding Level) | `Non-negotiable` diperlakukan setara Sovereign; sisanya Operationalization. |
| §8 Technical Direction | Operationalization | Template sudah menyatakannya: "auditable means — not sovereign intent". |
| §9 Functional Requirements | **Campur — per REQ** | Butuh tag per REQ. |
| §10 Risk Appetite (10.1) | **Sovereign** | Toleransi risiko fatal adalah keputusan nilai Director. |
| §10.3 Risk Register, §11 Execution Direction | Operationalization | — |

### 4.3 Bentuk konkret perubahan template

**§6 Scope Boundary** — item bullet diubah jadi tabel bertag:

```markdown
### 6.3 Non-Goals

| ID | Non-Goal | Tier | Alasan |
|:--- |:--- |:--- |:--- |
| NG-001 | [...] | Sovereign / Operationalization | [...] |
```

**§9 Functional Requirements** — satu baris field baru per REQ, sejajar `**Priority**`:

```markdown
### REQ-001 — [Requirement Title]

**Priority**: Must / Should / Could
**Tier**: Sovereign / Operationalization
```

**Definisi tier** ditulis satu kali, di bawah §1 (bukan diulang di tiap section), memakai bentuk yang sama dengan "Binding Level Definitions" §7:

- **Sovereign** — tujuan dan nilai Director. Perubahan di sini bukan Amendment; perubahan di sini adalah Intent Version baru.
- **Operationalization** — terjemahan ARC atas tujuan itu ke bentuk yang bisa dieksekusi FMN/DEV, berdasarkan apa yang diketahui *sekarang*. Boleh berkembang lewat Amendment; berkembangnya bukan pelanggaran intent.

**Default saat ragu**: `Sovereign`. Salah menandai Sovereign hanya memaksa jalur yang lebih berat (Intent Version baru); salah menandai Operationalization membuka persis pintu samping yang §2A klausul kedua dokumen sumber larang.

### 4.4 Konsekuensi untuk intent lama

Intent yang sudah `RATIFIED` (hasil normalisasi dari `LOCKED`) tidak punya tag tier sama sekali. Rename label berjalan otomatis, **taksonomi tidak retroaktif**. Untuk intent semacam itu, ARC melakukan klasifikasi berdasarkan penilaian dan wajib menyatakan tier-nya eksplisit dalam klasifikasi — tidak ada tag di dokumen yang bisa dirujuk. Ini menyimpang dari prinsip "Legacy Intent → Migration Review → RATIFIED" di dokumen asal; lihat D-06.

---

## 5. Fase 3 — Schema `amendments[]` + effective-state

### 5.1 Struktur

Ditambahkan ke `SingleIntentState` ([../src/engine/chain.ts:147-164](../src/engine/chain.ts#L147-L164)) — lokasi yang sama dengan `arc_score` (closure-authority PLAN-EVAL-02), dengan alasan identik: cakupannya satu chain intent, bukan per plan/exec.

```ts
export interface AmendmentEntry {
  id: string;                    // "AMD-001" — zero-padded, PREFIX-NNN
  created_at: string;            // ISO, distempel saat command dijalankan
  change: string;                // free-text gaya commit message
  director_approved_at: string;  // ISO, lihat D-04
}

export interface SingleIntentState {
  // ...field yang sudah ada...
  amendments?: AmendmentEntry[];       // sumber render Section 14
  effective_amendment?: string | null; // id AMD terakhir yang tersertifikasi
  certified_doc_sha256?: string;       // hash DIR-INTENT.md saat ratifikasi/amandemen terakhir
  certified_at?: string;               // ISO
}
```

Semua opsional — chain lama tetap valid tanpa migrasi field.

### 5.2 Effective-state: masalah sebenarnya

Dokumen sumber §4 menyatakan invarian yang dibutuhkan: konsumen effective-state (FMN, DEV, siapa pun yang membaca DIR-INTENT) harus mengambil Operationalization saat ini dari state **teramandemen terakhir**, bukan sekadar teks filesystem terbaru. AUD menolak framing "tidak ada jeda antara edit dan sertifikasi" karena itu bersandar pada disiplin perilaku, bukan jaminan.

Pointer `effective_amendment` saja **tidak menyelesaikan ini**. Pointer tahu amandemen terakhir yang sah; ia tidak tahu apakah file `.md` sudah diedit setelahnya. Yang dibutuhkan adalah deteksi, bukan penanda.

### 5.3 Usulan: sertifikasi berbasis hash dokumen

- Saat `sigma intent ratify` berhasil: hitung SHA-256 isi file DIR-INTENT, simpan ke `certified_doc_sha256`, stempel `certified_at`, set `effective_amendment = null`.
- Saat `sigma intent amendment` berhasil: render Section 14 lebih dulu, **lalu** hitung ulang hash atas file hasil render, perbarui `certified_doc_sha256` dan `effective_amendment = <AMD-NNN baru>`.
- Setiap pembacaan yang relevan membandingkan hash file saat ini dengan `certified_doc_sha256`. Beda → dokumen berada dalam state `UNCERTIFIED_EDIT` (identifier formal, tetap bahasa Inggris per SIGMA_PROTOCOL §16D).

Permukaan yang menampilkan `UNCERTIFIED_EDIT`:

| Permukaan | Bentuk |
| :--- | :--- |
| `sigma intent status` | Baris tambahan `Doc state: UNCERTIFIED_EDIT (edited after AMD-002)` |
| `sigma intent check` | Warning, bukan error — lihat D-03 |
| `sigma session bootstrap` | Kolom state DIR-INTENT ([session.ts:164](../src/commands/session.ts#L164)) |
| MCP `sigma_get_orientation` / `sigma_get_artifacts` | Field terstruktur, sejajar CLI |

Ini yang mengubah invarian dari prosedural jadi sistemik: FMN yang membaca DIR-INTENT di sesi mana pun melihat penanda bahwa teks yang dibacanya belum tersertifikasi, tanpa bergantung pada seseorang yang ingat memberi tahu.

### 5.4 Yang sengaja **tidak** disediakan

Tidak ada command "sertifikasi ulang tanpa amandemen". Command semacam itu akan jadi persis pintu samping yang §2A klausul kedua larang: cara membuat edit apa pun jadi "efektif" tanpa klasifikasi ARC dan tanpa jejak `AMD-NNN`. Jalan keluar yang sah untuk dokumen ber-`UNCERTIFIED_EDIT` hanya dua: ajukan amandemen, atau kembalikan file (`git checkout`).

Konsekuensi yang diterima: perbaikan typo pada dokumen `RATIFIED` akan memunculkan penanda drift sampai diselesaikan salah satu dari dua jalan itu. Inilah alasan penanda dipilih di level warning, bukan error (D-03).

### 5.5 `sigma doctor` tidak boleh menyembuhkan hash

`doctor` melaporkan `UNCERTIFIED_EDIT`, tidak pernah men-stempel ulang `certified_doc_sha256`. Menyembuhkannya secara otomatis berarti menghapus sinyal — self-heal yang menghancurkan hal yang seharusnya ia laporkan. Perlu ditulis sebagai komentar eksplisit di kode, karena pola self-heal `doctor` di tempat lain (mis. `renderIntentHistoryFile()`) justru kebalikannya.

---

## 6. Fase 4 — Section 14 di template + dukungan docCheck

### 6.1 Perubahan template

[../Sigma/templates/DIR-INTENT-TEMPLATE.md](../Sigma/templates/DIR-INTENT-TEMPLATE.md), setelah §13, sebagai section terakhir:

```markdown
<!-- SIGMA:DIR_INTENT:SECTION:AMENDMENT_HISTORY -->
## 14. Amendment History

> Auto-render oleh `sigma intent amendment`. Jangan diedit tangan — isi di
> antara delimiter ditimpa penuh setiap command dijalankan.
> Perubahan isi Operationalization terjadi *in place* di section terkait;
> tabel ini hanya catatannya.

<!-- SIGMA:RENDER:START:amendment-history -->
<!-- SIGMA:RENDER:END:amendment-history -->
```

Marker dokumen di baris 1 dinaikkan: `schema=3` → `schema=4`.

Dua jebakan yang sudah dicek terhadap validator:

- `parseSectionMarker()` mensyaratkan **H2 tepat setelah marker** ([docCheck.ts:495-503](../src/utils/docCheck.ts#L495-L503)). Delimiter render diletakkan **di bawah** heading, bukan di antara marker dan heading.
- `validateSigmaDocFile()` memunculkan warning untuk pola teks `Section \d+` ([docCheck.ts:583-587](../src/utils/docCheck.ts#L583-L587)). Prosa di dalam section ini — dan isi `--change` yang ditulis ARC — harus memakai rujukan gaya `§6.3`, bukan "Section 6".

### 6.2 `docCheck.ts`: konsep section dikenal-tapi-tidak-wajib

Sesuai temuan §2.4. `SigmaDocSpec` diperluas:

```ts
interface SigmaDocSpec {
  heading: string;
  expectedType: string;
  fallbackPath: string;
  requiredSections: string[];   // hilang → error, memblokir lock
  optionalSections?: string[];  // dikenal; boleh hilang, tetap divalidasi urutannya kalau ada
  sectionOrder?: string[];      // urutan penuh; default = requiredSections
}
```

Tiga titik penyesuaian di `validateSigmaDocFile()`:

1. `unknownSectionIds` ([docCheck.ts:556-559](../src/utils/docCheck.ts#L556-L559)) memeriksa gabungan required + optional — supaya dokumen baru tidak memicu warning palsu.
2. Pemeriksaan urutan ([docCheck.ts:570-581](../src/utils/docCheck.ts#L570-L581)) memakai `sectionOrder`, dan hanya menilai marker yang benar-benar ada.
3. `missingRequired` tidak berubah — `AMENDMENT_HISTORY` masuk ke `optionalSections`, jadi tidak pernah muncul di sana.

Efeknya: DIR-INTENT lama tetap lolos `check`/`lock` tanpa disentuh; DIR-INTENT baru tidak kena warning. Promosi ke `requiredSections` bisa dilakukan di siklus terpisah setelah semua project bermigrasi (D-05).

### 6.3 Auto-inject untuk dokumen lama

Kalau `sigma intent amendment` dijalankan pada DIR-INTENT yang belum punya Section 14, command menambahkannya di akhir file (marker + heading + pasangan delimiter) lalu merender isinya. Tanpa ini, intent lama tidak bisa diamandemen sama sekali tanpa Director mengedit tangan dokumen yang sudah `RATIFIED` — pengecualian yang lebih buruk daripada penambahan yang idempoten ini.

### 6.4 Generalisasi mekanisme render

`replaceSection()` / `removeSectionIfPresent()` dipindah dari [../src/utils/roadmap.ts](../src/utils/roadmap.ts) ke `src/utils/renderMarkers.ts` dengan parameter label dokumen untuk pesan error, dan di-re-export dari `roadmap.ts` supaya call site + test yang ada tidak berubah. Modul baru `src/utils/amendmentHistory.ts` mengikuti bentuk [../src/utils/intentHistory.ts](../src/utils/intentHistory.ts):

```ts
export function generateAmendmentHistory(chain: ChainState): string {
  const header = [
    '| Amendment | Date | Change |',
    '| :--- | :--- | :--- |',
  ];
  const rows = (chain.intent.amendments ?? []).map(
    a => `| ${a.id} | ${a.created_at.slice(0, 10)} | ${a.change} |`
  );
  return [...header, ...rows].join('\n');
}
```

Tiga kolom, sesuai dokumen sumber — tanpa kolom `section_ref`.

---

## 7. Fase 5 — Command `sigma intent amendment`

### 7.1 Bentuk

```
sigma intent amendment --change "<free text>" [--v <version>]
```

Ditambahkan di [../src/commands/intent.ts](../src/commands/intent.ts), domain `intent`. `--v` opsional dengan default chain aktif, mengikuti pola `intent score`/`intent check` yang sudah ada.

### 7.2 Guard

| Guard | Perilaku |
| :--- | :--- |
| `assertChainCanMutate(chain)` | Sama seperti command mutasi lain. |
| `intent.state !== 'RATIFIED'` | Tolak. `DRAFT` diedit bebas (belum ada yang diikat); `SUPERSEDED` sudah pensiun. |
| `--change` mengandung `\|`, `\n`, `\r` | Tolak, dengan pesan sepola `assertRequiredIntentMetadata()` ([intent.ts:53-62](../src/commands/intent.ts#L53-L62)) — tabel Section 14 adalah pipe-table. |
| `--change` kosong / hanya spasi | Tolak. |

### 7.3 Urutan eksekusi (penting — hash bergantung padanya)

1. Baca chain, jalankan guard.
2. Hitung `id` berikutnya: `AMD-` + zero-pad 3 dari `amendments.length + 1`.
3. Append entry ke `chain.intent.amendments`, set `effective_amendment = id`.
4. Render Section 14 ke file DIR-INTENT (auto-inject section kalau belum ada).
5. **Hitung hash file hasil render**, simpan ke `certified_doc_sha256` + `certified_at`.
6. `writeChain()`.
7. Append satu baris ke `Sigma/logs/intent_amendment.log`.

Langkah 5 harus setelah 4, kalau tidak command ini sendiri langsung memicu `UNCERTIFIED_EDIT` yang ia buat.

### 7.4 Log khusus

Konstanta baru di [../src/config.ts](../src/config.ts):

```ts
export const INTENT_AMENDMENT_LOG_FILE = path.join(PROJECT_SIGMA_DIR, 'logs', 'intent_amendment.log');
```

Format JSONL, satu baris per amandemen, mengikuti pola [../src/utils/operationLog.ts](../src/utils/operationLog.ts):

```json
{"chain":"v2","id":"AMD-001","created_at":"...","director_approved_at":"...","change":"...","doc_sha256":"..."}
```

Catatan yang perlu disadari: `operations.jsonl` sudah otomatis mencatat invokasi `intent amendment` lewat hook di [../src/cli.ts:74-80](../src/cli.ts#L74-L80). Log khusus ini hanya berguna kalau memuat lebih banyak — yaitu isi record + chain + hash, seperti di atas. Kalau isinya hanya "command ini pernah jalan", ia redundan dan sebaiknya tidak dibuat.

### 7.5 Kelas otorisasi — tanpa `--director-confirm`

Dokumen sumber menyebut command ini Approval-class. Yang **tidak** disiratkannya adalah flag `--director-confirm`, dan plan ini merekomendasikan untuk tidak menambahkannya. Alasan: Director sudah memutuskan sebelumnya bahwa command lock sengaja tidak punya gate `--director-confirm` di kode; `--director-confirm` hanya dipakai `sigma override` dan `sigma intent supersede`, keduanya karena blast radius lintas-domain yang tidak bisa dibatalkan. Amandemen tidak punya sifat itu — ia menambah satu baris append-only pada satu chain.

Penempatannya: baris Approval di tabel Command Authority Classes ([SIGMA_PROTOCOL.md:517](../Sigma/SIGMA_PROTOCOL.md#L517)), bersama `intent score`, dengan catatan kaki serupa — yang Director otorisasi adalah tindakan **mencatat** amandemen yang klasifikasinya sudah dikerjakan ARC lebih dulu.

### 7.6 Output

```
AMD-002 recorded for DIR-INTENT v2.
Change: §6.3 Non-Goals: removed prohibition on COG rendering — Director determined this is part of intended realization, not scope creep.
Section 14 (Amendment History) re-rendered. Document re-certified.
```

---

## 8. Fase 6 — Rule docs, protokol, registry

Semua di bawah ini pekerjaan dokumen; tidak ada yang menyentuh kode.

**Pengecualian urutan**: baris yang menyangkut rename command (`setup/targets/**`, bridge stub, role memory, entry registry `intent_ratify`, DIR-INTENT template) dikerjakan **bersama Fase 2**, bukan ditunda ke sini. Alasannya makin kuat setelah D-08: tanpa alias, berkas yang tertinggal menginstruksikan AI role menjalankan command yang sudah tidak ada. Yang tersisa di Fase 6 adalah dokumentasi Amendment — yang memang harus menunggu perilakunya nyata.

| Berkas | Perubahan |
| :--- | :--- |
| [../Sigma/rules/ARC-RULE.md](../Sigma/rules/ARC-RULE.md) | Subsection baru §Amendment Request — dekat tapi terpisah struktural dari §Petition/Admission Review. Isi: alur klasifikasi (§5.2 dokumen sumber), doktrin "ARC mengklasifikasi, tidak menyetujui", ARC yang menulis isi `--change` (bukan menyalin framing pengaju), non-retroaktivitas, dan kewajiban klasifikasi berlaku untuk **semua** asal usulan termasuk Director. |
| [../Sigma/rules/FMN-RULE.md](../Sigma/rules/FMN-RULE.md) | Ganti framing datar "FMN is subordinate to locked DIR-INTENT" (:164) dan "MUST NOT invent requirements beyond locked DIR-INTENT" (:37) dengan framing sadar-tier. Klausul eskalasi (:317) dan Protocol Overrides (:256-261) merujuk jalur Amendment eksplisit, sepola dengan cara :323 menyebut jalur Petition. |
| [../Sigma/templates/FMN-PLAN-TEMPLATE.md:77-79](../Sigma/templates/FMN-PLAN-TEMPLATE.md#L77-L79) | Tabel §5 jadi `\| Item \| Justification \| Status \| Notes \|`; vokabulari status `NOTED` / `AMENDMENT_REQUESTED` / `AMENDMENT_RATIFIED`. Ditegaskan `NOTED` = "tercatat", bukan "sudah dinilai tidak berdampak". Tidak ada perubahan `docCheck` — validator hanya memeriksa keberadaan marker section, bukan isi tabelnya. |
| [../Sigma/SIGMA_PROTOCOL.md](../Sigma/SIGMA_PROTOCOL.md) | §5.1 ditulis ulang: state machine `DRAFT → RATIFIED → SUPERSEDED`, hapus `INACTIVE` dan auto-demote (temuan §2.1); tambah Section 14 + amandemen. §16 tambah action `amendment` di baris domain `intent`. §16A tabel Approval-class. Gate 3 (:382-387) dibersihkan dari klaim `INACTIVE`. |
| `Sigma/SIGMA-OPERATION-REGISTRY.json` | Entry baru `intent_amendment`; perbaiki deskripsi `intent_lock` yang stale (temuan §2.2). Disunting manual lalu `sigma project sync --confirm` — `scripts/refresh-registries.js` masih stub. |
| `Sigma/SIGMA-OPERATION-REGISTRY.json` (rename) | `operation_id: "intent_lock"` → `"intent_ratify"`, `action: "lock"` → `"ratify"`. Dua entry berubah di file yang sama dengan baris di atas — kerjakan sekaligus. |
| `setup/targets/**` — 26 berkas | Skill file `arc`/`fmn`/`dev`/`aud`/`report` untuk claude_code, codex, antigravity, reasonix + 5 bridge stub. Ini yang dibaca AI role di project pengguna; tanpa diperbarui, role akan terus menyarankan command yang sudah tidak ada. |
| Bridge stub di root repo (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `DEEPSEEK.md`, `REASONIX.md`) | Regenerasi dari `setup/targets/bridge/`, jangan disunting langsung. |
| `Sigma/role-memory/arc-memory.json` | Dua rujukan `intent lock`. Dibaca ARC lewat `sigma memory --arc` / MCP `sigma_get_memory` pada setiap aktivasi peran. |
| [../Sigma/templates/DIR-INTENT-TEMPLATE.md](../Sigma/templates/DIR-INTENT-TEMPLATE.md) | 5 rujukan `sigma intent lock` → `sigma intent ratify`, dan judul §13.1 "Lock Requirement" → "Ratify Requirement" (keputusan Director; verifikasi keamanannya di §3.9). |
| [../README.md](../README.md) | Command surface + tabel state. |

---

## 9. Rencana test

| Area | Test |
| :--- | :--- |
| Rename | Chain baru dari `intent new` + `intent ratify` berakhir `RATIFIED`; Gate 1/1.5/2/3 tetap terbuka pada state baru; state plan/exec/roadmap/close tetap `LOCKED` (test negatif untuk kebocoran rename). |
| Kompatibilitas baca | Fixture `progress-v1.json` berisi `"state": "LOCKED"` → terbaca `RATIFIED`; `"INACTIVE"` → `RATIFIED`; operasi tulis berikutnya mempersistensikan label baru. |
| Schema | Chain ber-`schema_version` lebih baru menghasilkan INVALID marker, bukan gerbang yang diam-diam tertutup. |
| Command rename | `sigma intent ratify` menjalankan alur yang identik dengan `intent lock` lama (guard `DRAFT`, validasi dokumen, Gate 1, lifecycle → BUILD); `sigma intent lock` **gagal** (exit ≠ 0) dan tidak mengubah state apa pun; `getNextValidOperations()` menyarankan `intent ratify`. `test/intent-lock.test.ts` di-rename `intent-ratify.test.ts`. |
| Sapuan terminologi | Guard regresi (§3.9): tidak ada lagi pola `intent lock` tersisa di `Sigma/`, `setup/targets/`, `README.md`. Test negatif: istilah generik (`Lock readiness`, `plan lock`, `locked FMN-PLAN`) tidak ikut tersapu. |
| Migrasi `doctor` | Fixture chain berisi `"state": "LOCKED"` + `locked_at` + `schema_version: "1.0.0"` → setelah `sigma doctor`, file di disk berisi `RATIFIED` + `ratified_at` + `1.1.0`, dan `report.repaired` **memuat baris migrasinya** (bukan diam-diam). `--all-versions` memigrasi setiap chain, bukan hanya yang aktif. Idempoten: `doctor` kedua tidak melaporkan perbaikan apa pun. |
| `amendment` | Guard state (`DRAFT`/`SUPERSEDED` ditolak); urutan id `AMD-001` → `AMD-002` → `AMD-003`; sanitasi `\|`/newline; Section 14 ter-render dan **seluruh isi lain dokumen tidak berubah** (pola test `roadmap-stage-overview.test.ts`); auto-inject Section 14 pada dokumen lama. |
| Effective-state | Setelah ratifikasi hash tersimpan; edit manual file → `UNCERTIFIED_EDIT` muncul di `intent status`/`check`; amandemen mengembalikan ke tersertifikasi; `doctor` melaporkan tanpa menyembuhkan. |
| docCheck | Dokumen tanpa `AMENDMENT_HISTORY` tetap `ok` (tidak memblokir lock); dokumen dengan section itu tidak memicu warning `Unknown section markers`; urutan section tetap tervalidasi ketika section opsional hadir. |

---

## 10. Keputusan — semuanya sudah diputuskan Director (2026-08-12)

| ID | Keputusan | Rekomendasi |
| :--- | :--- | :--- |
| ~~**D-01**~~ | **DIPUTUSKAN 2026-08-12** — terima state machine 3-state `DRAFT → RATIFIED → SUPERSEDED`; `INACTIVE` tidak dihidupkan kembali. | SIGMA_PROTOCOL §5.1 dan Gate 3 (:382-387) diperbaiki sebagai bagian Fase 6 — dokumentasi yang menyesuaikan kode, bukan sebaliknya. |
| ~~**D-02**~~ | **DIPUTUSKAN 2026-08-12** — `sigma intent amendment` **tanpa** `--director-confirm`. | Approval-class lewat disiplin otorisasi percakapan, sama seperti `intent ratify` dan `intent score`. `--director-confirm` tetap eksklusif untuk `override` dan `intent supersede`. |
| ~~**D-03**~~ | **DIPUTUSKAN 2026-08-12** — `UNCERTIFIED_EDIT` di level **warning**, dan tidak ada command "sertifikasi ulang". | Jalan keluar sah hanya dua: ajukan amandemen, atau kembalikan file lewat git. Konsekuensi diterima: perbaikan typo pada dokumen RATIFIED memunculkan penanda sampai diselesaikan salah satunya. |
| ~~**D-04**~~ | **DIPUTUSKAN 2026-08-12** — simpan `created_at` **dan** `director_approved_at`. | Hari ini bernilai sama; dipisah sejak awal supaya alur persetujuan asinkron di kemudian hari tidak perlu migrasi schema. Perbedaan maknanya ditulis sebagai komentar di definisi `AmendmentEntry`, bukan hanya di plan ini. |
| ~~**D-05**~~ | **DIPUTUSKAN 2026-08-12** — `AMENDMENT_HISTORY` sebagai section **dikenal-tapi-opsional**; promosi jadi wajib di siklus terpisah. | Butuh `optionalSections`/`sectionOrder` di `SigmaDocSpec` (§6.2). Promosi ke wajib jadi item follow-up tersendiri, bukan bagian rilis ini. |
| ~~**D-06**~~ | **DIPUTUSKAN 2026-08-12** — label intent lama dimigrasikan otomatis; taksonomi tier **tidak** retroaktif. | Menyimpang dari "Legacy Intent → Migration Review → RATIFIED" di dokumen asal, dan penyimpangan itu kini eksplisit — bukan asumsi diam-diam. Untuk intent tanpa tag tier, ARC wajib menyatakan klasifikasinya eksplisit di setiap amandemen (§4.4). |
| ~~**D-07**~~ | **DIPUTUSKAN 2026-08-12** — bump `schema=3` → `4` di marker DIR-INTENT, dan `SCHEMA_VERSION` `1.0.0` → `1.1.0`. | Bump `SCHEMA_VERSION` yang membuat binary lama menandai chain sebagai INVALID alih-alih salah membaca `RATIFIED` sebagai "belum terkunci" (§3.3). |
| ~~**D-08**~~ | **DIPUTUSKAN 2026-08-12** — `sigma intent lock` **dihapus total**, tanpa alias. | Konsekuensi yang diterima: seluruh 26 berkas `setup/targets/**` + bridge stub + rule docs wajib ikut di rilis yang sama, karena tidak ada lagi jaring pengaman untuk instalasi yang tertinggal (§3.4). Guard regresi di §3.9 jadi wajib, bukan opsional. |
| ~~**D-09**~~ | **DIPUTUSKAN 2026-08-12** — `intent.locked_at` → `ratified_at`. | Sesuai §3.5. `locked_at` artifact lain tidak disentuh. |
| ~~**D-10**~~ | **DIPUTUSKAN 2026-08-12** — istilah lock generik dibiarkan; hanya prosa yang eksplisit menyebut intent dikunci yang disapu jadi "ratified". | Cakupan lengkap + daftar yang dibiarkan ada di §3.9. `Lock readiness` / `Lock Requirements` tetap seperti sekarang, jadi kontrak string Pre-Lock Verification Rule tidak berubah dan CLAUDE.md tidak perlu disentuh. |

---

## 11. Di luar scope

- **Periodic Intent Re-evaluation** (dokumen sumber §4). Mekanisme deteksi cumulative drift dari tiga sumber bukti belum terselesaikan di level desain; memaksakannya ke plan ini berarti mengimplementasikan hal yang belum diputuskan. Rencana terpisah setelah amandemen berjalan dan ada `AMD-NNN` + entry Protocol Overrides nyata untuk dibaca.
- **Validator semantik CLI untuk taksonomi tier.** Guardrail eksplisit AUD; tidak sekarang, tidak sebagai follow-up.
- **Rename `LOCKED` di artifact selain DIR-INTENT.** Keputusan Director eksplisit untuk membatasi biaya migrasi.
- **Command `sigma intent amendment list/show`.** Section 14 dan `intent_amendment.log` sudah menjawab kebutuhan baca; command ketiga untuk data yang sama adalah pola yang sudah pernah ditolak di ronde audit PLAN-EVAL-06.
- **Perubahan mekanisme Petition.** Dokumen asal §3.5 sudah menetapkan Petition dan Amendment sebagai mekanisme yang sengaja terpisah; tidak dikunjungi ulang.

---

## 12. Urutan pengerjaan

| # | Fase | Dependency | Sifat |
| :--- | :--- | :--- | :--- |
| 1 | Fase 1 — Taksonomi tier (§4) | Tidak ada | Dokumen. Membuka blocking AUD #1. |
| 2 | Fase 2 — Rename `RATIFIED` + command `intent ratify` + migrasi `doctor` + sapuan terminologi (§3) | #1 tidak wajib | Kode + dokumen. Fondasi; menyentuh `SingleIntentState` yang dipakai fase berikutnya. Rename command dan sapuan §3.9 **wajib satu rilis**. |
| 3 | Fase 3 — Schema amandemen + effective-state (§5) | #2 | Kode. Membuka blocking AUD #2. |
| 4 | Fase 4 — Template Section 14 + docCheck (§6) | #3 | Kode + template. |
| 5 | Fase 5 — Command `intent amendment` (§7) | #4 | Kode. Merakit #3 dan #4 jadi satu command. |
| 6 | Fase 6 — Rule/protokol/registry (§8) | #5 | Dokumen. Terakhir supaya mendeskripsikan perilaku yang sudah nyata, bukan yang direncanakan. |

Fase 1 dan 2 bisa berjalan paralel — tidak ada persinggungan berkas.

---

## 13. Risiko

| Risiko | Dampak | Mitigasi |
| :--- | :--- | :--- |
| Rename bocor ke artifact non-INTENT | Sedang. Menghapus keputusan Director yang membatasi cakupan migrasi. | Fixture plan/exec/roadmap/close di `test/helpers.ts` sengaja tidak diubah — jadi alarm otomatis. |
| Satu jalur baca chain terlewat dari normalisasi | Tinggi. Chain lama tampak tidak terkunci, gerbang tertutup tanpa penjelasan. | Normalisasi hanya di `readChain()`; verifikasi tidak ada pembacaan `progress-v<N>.json` yang melewatinya (`reconstruct.ts` menulis, bukan membaca state lama). |
| Hash bergeser karena penyebab yang tidak berbahaya (newline akhir, formatting editor) | Sedang. Terlalu sering false positive → penanda diabaikan orang. | Level warning (D-03); hash dihitung atas byte file apa adanya, tanpa normalisasi — normalisasi yang "pintar" justru menciptakan celah edit yang tak terdeteksi. |
| `AMENDMENT_HISTORY` dipromosikan jadi wajib terlalu cepat | Tinggi bagi project pengguna. `intent ratify` mati mendadak. | D-05 memisahkan promosi ke siklus tersendiri, setelah migrasi. |
| Satu berkas skill/rule terlewat dari sapuan | **Tinggi** — naik dari sedang setelah D-08. Tanpa alias, AI role yang membaca berkas itu menjalankan command yang gagal keras, di tengah sesi governance. | Guard regresi grep di §3.9 dijadikan test yang menggagalkan build, bukan checklist manual. Rilis rename dan pembaruan `setup/targets/**` harus satu commit. |
| Migrasi `doctor` berjalan tapi tidak terlihat | Sedang. Director tidak punya cara tahu file sudah dikonversi; dianggap belum jalan lalu dijalankan berulang. | Penanda `_migratedOnRead` (§3.7) yang diangkat ke `repaired[]`; ditegakkan lewat test yang memeriksa isi `report.repaired`, bukan hanya isi file hasilnya. |
| Sapuan terminologi kebablasan ke istilah generik | Sedang. `Lock readiness` ikut berubah → kontrak string Pre-Lock Verification Rule putus, AI role mencari string yang tidak pernah muncul. | D-10 membatasi sapuan hanya pada prosa yang menyebut intent; daftar "dibiarkan" di §3.9 dijadikan test negatif, bukan sekadar catatan. |
| Taksonomi tier diisi asal oleh ARC (semua ditandai Operationalization) | Tinggi. Seluruh model runtuh — semua jadi amendable. | Default "kalau ragu, Sovereign" (§4.3); klasifikasi ARC wajib independen dan berlaku juga saat Director yang mengusulkan (§5.2 dokumen sumber). Tidak ada penegakan kode — memang disengaja. |
