# RESULT-IMPL — Sigma MCP Stage C (Bounded Command Pilot)

**Plan**: `PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` §14 Stage C
**Prasyarat**: Batch 1 (Gate 0.5 PASS, Gate B1 PASS — final re-review Codex, `RESULT-IMPL-SIGMA-MCP-BATCH1-20260915.md` §16) dan Stage B2 evidence-only (implementasi/security/test PASS — `RESULT-IMPL-SIGMA-MCP-STAGE-B2-20260915.md` §11).
**Otorisasi**: Perintah Director eksplisit 2026-09-15 ("lanjutkan eksekusi stage C") setelah tiga keputusan desain dikonfirmasi — lihat §1.
**Tanggal**: 2026-09-15
**Status terkini (2026-09-16)**: **GATE C: PASS (lihat Bagian 23) — putusan final independen (Claude/Sonnet 5) setelah `acquireProjectLock()` diganti total ke `proper-lockfile@4.1.2`. Verifikasi adversarial independen: 150 trial fresh-contention + 20× ulang test race resmi + live-holder/dead-holder/tampering, seluruhnya 0 pelanggaran. Residual risk didokumentasikan eksplisit, tidak memblokir gate. Finding `chain.ts` (§21.9) tetap terbuka terpisah, di luar cakupan.**
**Status**: **GATE C: PASS.** Riwayat: HOLD sejak §13 (lock in-process, P0) → empat putaran perbaikan/review Codex (§14–§19, fokus stale-takeover) → P0 baru ditemukan independen oleh Claude di luar seluruh putaran itu (§21, fresh-contender race) → dikonfirmasi ganda oleh Codex dengan sampel lebih besar (§21.8, 44/50 run) dan koreksi teknis root-cause tambahan (§21.9, visibility gap `fs.moveSync`) → remediasi disepakati bertiga (`proper-lockfile`, §21.8) → diimplementasikan (§22) → **PASS setelah re-review adversarial independen (§23)**.
**Scope dieksekusi**: `sigma-control` sebagai logical server terpisah (disabled by default), dua tool pilot — `sigma_create_intent_draft` dan `sigma_update_artifact_draft` (dibatasi ke `type:"intent"`) — idempotency store, audit log, dan lock in-process.
**Tidak termasuk**: Stage D (governance transition/approval), memo/message/evidence write tool, tipe artifact selain intent, instalasi/aktivasi `sigma-control` pada config Hermes atau host manapun, commit/push.

---

## 1. Keputusan Director yang mendahului implementasi (2026-09-15)

Tiga pertanyaan diajukan sebelum menulis kode, karena plan §21.2 eksplisit membiarkannya terbuka untuk Stage C/D:

| # | Pertanyaan | Keputusan Director |
|---|---|---|
| 1 | Lokasi/format store idempotency+approval (Q6 plan hanya membekukan bahwa store ini **dikecualikan** dari `state_revision`, bukan lokasinya) | **Project-scoped**, di dalam `Sigma/.mcp-control/` — bukan host-scoped (`~/.sigma/...`) |
| 2 | Ruang lingkup pilot W1 pertama | **Hanya create+update DIR-INTENT DRAFT** — bukan sekaligus plan/exec |
| 3 | Sequencing Stage C dan D | **Stage C dulu, self-verify, baru mulai Stage D** — bukan sekaligus satu putaran |

Ketiganya diikuti tanpa deviasi.

## 2. Yang diimplementasikan

### 2.1 Service layer bersama (plan §13)

**`src/services/intentDraftService.ts`** (baru) — `createIntentDraft()` diekstrak dari `src/commands/intent.ts` (`sigma intent new`). Transport-agnostic: tidak ada Commander, `console.log`, atau prompt. Konfirmasi reopen-CLOSED-chain tetap tanggung jawab pemanggil (`allowReopenClosed: boolean`) — service hanya menegakkan aturan, tidak memperoleh persetujuannya.

`src/commands/intent.ts`'s `new` command direfactor untuk memanggil fungsi ini. Preflight interaktif (deteksi CLOSED + prompt APPROVE) tetap di CLI karena itu murni concern UX; keputusan akhirnya (`allowReopenClosed`) diteruskan ke service yang sama yang dipakai MCP — **CLI dan MCP kini benar-benar memanggil satu use-case yang sama**, bukan dua implementasi yang kebetulan mirip.

Tidak ada service terpisah untuk `updateArtifactDraft` — CLI tidak pernah punya command setara (manusia mengedit file DRAFT langsung), sehingga tidak ada logic existing untuk diekstrak. Fungsi ini (`src/mcp/control/artifactDraftUpdate.ts`) murni control-plane, sengaja tidak diletakkan di `src/services/` karena bergantung pada helper keamanan-path MCP (`readCanonicalArtifactFile`) yang tidak seharusnya masuk ke layer yang nominal transport-agnostic.

### 2.2 Pemisahan fisik query/control plane

**`src/mcp/control/`** (baru, direktori terpisah) — `index.ts`, `shared.ts`, `canonicalWrite.ts`, `artifactDraftUpdate.ts`, `tools/createIntentDraft.ts`, `tools/updateArtifactDraft.ts`.

**`bin/sigma-control.js`** (baru) — entry point terpisah dari `bin/sigma-mcp.js`. `src/mcp/index.ts` (query server) **tidak mengimpor apa pun** dari `src/mcp/control/` — pemisahan ini pada level module graph, bukan runtime toggle. `package.json` menambah entri `bin.sigma-control` tetapi **tidak** menjalankan `npm link`/install ulang; simlink global existing (`sigma-mcp` → repo ini, dicatat di `RESULT-IMPL-SIGMA-MCP-BATCH1-20260915.md` §6.1) tidak otomatis memperoleh binary baru ini tanpa tindakan eksplisit Director.

`src/utils/mcpConfig.ts` **tidak disentuh** — `sigma-control` tidak menjadi bagian dari config manapun yang ditulis `sigma project sync`.

### 2.3 Binding — role wajib untuk control mode

`src/mcp/binding.ts`: `resolveBinding()` sekarang menolak start (`BINDING_REQUIRED`) bila `mode === 'control'` tanpa `--role`. Sebelumnya role opsional bahkan di control mode (`role: parsed.mode === 'control' ? (parsed.role ?? null) : null`), yang berarti server control bisa start tanpa pernah bisa mengotorisasi satu write pun — gagal lambat, bukan gagal cepat. Perubahan ini aditif dan tidak menyentuh query mode.

### 2.4 Idempotency, stale-state, lock, audit — `src/mcp/control/shared.ts`

`respondControlWrite()` adalah satu-satunya jalur setiap tool write:

1. **Role** — `binding.role` harus ada di `allowedRoles` tool tersebut, atau `ROLE_NOT_AUTHORIZED`. Role **tidak pernah** diterima dari argumen tool — hanya dari binding yang dibentuk saat startup dari argv tepercaya (`--role`), konsisten dengan invarian §5.3.
2. **Idempotency** — key sama + `arguments_hash` sama → replay hasil pertama tanpa mutasi ulang. Key sama + hash beda → `IDEMPOTENCY_CONFLICT`.
3. **Stale-state** — `expected_state_revision` dibandingkan dengan `computeStateRevision()` **saat ini** (fungsi yang sama dipakai query plane, `src/mcp/contract.ts`) tepat sebelum mutasi, di dalam lock. Mismatch → `STALE_STATE`, tanpa mutasi.
4. **Lock in-process** — satu promise-chain per proses menyerialkan seluruh compare-and-write. Lihat §5 untuk keterbatasannya.
5. **Audit** — setiap attempt (commit, idempotent_replay, deny) ditulis ke `Sigma/.mcp-control/audit.jsonl` (append-only), termasuk `bound_role` yang diambil dari `binding.role` langsung — bukan dari variabel yang hanya terisi setelah otorisasi berhasil (lihat temuan §6).

**`src/engine/controlStore.ts`** (baru) — idempotency ticket (satu file JSON per key, atomic tmp+rename, pola sama dengan `writeChain()`/`writeActivateStatus()`) dan audit log, di `Sigma/.mcp-control/`. **Dikecualikan dari `computeStateRevision()`** (tidak diubah — fungsi itu hanya membaca tiga file yang sudah ditetapkan sejak Batch 1, `.mcp-control/` tidak pernah masuk daftar itu) — diverifikasi lewat test eksplisit (§4).

### 2.5 Dua tool pilot

**`sigma_create_intent_draft`** — ARC-only. Membuat chain baru + DRAFT intent, mengaktifkannya. Menolak reopen chain CLOSED kecuali `allow_reopen_closed:true`.

**`sigma_update_artifact_draft`** — ARC-only, **dibatasi `type:"intent"`** di dua level (schema `z.literal('intent')` dan pengecekan runtime di `artifactDraftUpdate.ts`) — pilot scope sempit sesuai keputusan §1.2. Menerima `expected_artifact_sha256`; mismatch → `STALE_ARTIFACT`, file tidak tersentuh. Hanya bisa menargetkan intent versi aktif chain aktif, dan hanya bila statenya `DRAFT`.

Path write memakai `writeCanonicalArtifactFile()` (`src/mcp/control/canonicalWrite.ts`) — memanggil `assertCanonicalLocation()` yang **sama** dengan yang dipakai `sigma_read_artifact`/`sigma_get_evidence` (dari `src/mcp/artifactPath.ts`), bukan tabel kedua. Ini pola yang menutup R-10 pada Batch 1; write pilot mewarisinya, tidak membuatnya ulang.

## 3. Guard query-plane — dipecah, bukan diwarisi diam-diam

`test/mcp-tools.test.ts`'s guard ("no query-plane file imports a state-mutating function") kini mengecualikan `src/mcp/control/` secara eksplisit dari sweep, persis seperti yang dijanjikan komentar guard tersebut sejak Batch 1: *"src/mcp/control/ is deliberately NOT excluded here — when Stage C creates it, this guard must be split, not silently inherited."* Lima nama writer baru (`createIntentDraft`, `writeCanonicalArtifactFile`, `updateArtifactDraft`, `writeIdempotencyRecord`, `appendAuditEntry`) ditambahkan ke daftar terlarang untuk seluruh file **di luar** `src/mcp/control/`.

Bukti independen bahwa query server tetap nol tool tulis: test existing "lists the ten tools" (`test/mcp-tools.test.ts`) memakai `toEqual` (exact match, bukan `not.toContain`) atas hasil `client.listTools()` — daftar itu tidak berubah, tetap sepuluh nama Batch 1/B2 yang sama.

## 4. Bukti eksekusi

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` (`tsc`) | Bersih, nol error |
| `npm test` (full suite) | **52 file / 562 test PASS** (dari 51 file / 545 pada akhir Stage B2; +1 file, +17 test, nol hilang) |
| `test/control-intent-draft.test.ts` (baru, 17 test) | Role/gate boundary, stale-state, idempotent replay, idempotency conflict, concurrent commit in-process, scope-pinning (type≠intent), version/state mismatch, STALE_ARTIFACT, write sukses, `state_revision` tidak bergerak akibat edit body dokumen, binding butuh `--role`, transport-level (in-memory client) |
| `test/mcp-tools.test.ts`, `test/mcp-binding.test.ts` (regresi Batch 1/query) | PASS, guard baru lulus |
| Smoke runtime out-of-process (§5) | **23/23 PASS**, subprocess nyata terhadap proyek fixture disposable |
| `git diff --check` | Bersih (dua warning CRLF normalisasi pada file yang sudah ada sebelumnya) |

## 5. Smoke test out-of-process — `evidence/stageC-runtime-smoke.mjs`

Skrip baru, dapat dijalankan ulang:

```
node Implementation/sigma-mcp/evidence/stageC-runtime-smoke.mjs
```

Berbeda dari `gate05-runtime-smoke.mjs` (Batch 1), skrip ini **tidak menyentuh proyek existing manapun** — ia membangun sendiri proyek fixture disposable via `sigma project start` yang dijalankan dengan `HOME`/`USERPROFILE` diarahkan ke direktori temp terisolasi (pola yang sama dengan `test/helpers.ts`'s `runCli()`), sehingga `~/.sigma` milik Director tidak tersentuh sama sekali, dan membersihkan diri (`fs.rmSync`) di akhir.

Yang dibuktikan lewat subprocess nyata (bukan in-process reference client):

| Kasus | Hasil |
|---|---|
| **A** — control mode tanpa `--role` | Exit code 2, `BINDING_REQUIRED` di stderr, tidak start |
| **B** — role DEV (bukan ARC) mencoba create | `ROLE_NOT_AUTHORIZED`; **nol file governance berubah**; audit **tetap mencatat** percobaan tersebut dengan `bound_role:"DEV"` yang benar |
| **C** — ARC create, lalu proses `sigma-mcp` (query) **terpisah** membaca proyek yang sama | Chain `v1` aktif, `state_revision` bergerak, `sigma_read_artifact` membaca draft yang baru dibuat — **membuktikan proses control dan proses query melihat state yang identik**, bukan hanya bahwa keduanya "berhasil" secara independen |
| **D** — retry `idempotency_key` sama (dengan `expected_state_revision` yang sengaja sudah basi, meniru retry asli) | Replay hasil pertama; `sigma intent list` mengonfirmasi **tepat satu** chain di disk |
| **E** — update dengan `expected_artifact_sha256` salah | `STALE_ARTIFACT`; file di disk tidak berubah byte apa pun |
| **F** — update dengan hash benar | Berhasil; isi file baru **dan** proses query terpisah membaca isi yang sama |

Non-mutasi diverifikasi selektif: kasus B membandingkan hash seluruh file governance sebelum/sesudah, mengecualikan `Sigma/.mcp-control/` secara sadar (audit log **memang harus** berubah untuk mencatat deny — lihat §6) sambil tetap membuktikan nol perubahan pada chain/activate_status/dokumen intent.

## 6. Temuan yang diperbaiki selama pengujian sendiri

Ditemukan oleh smoke test §5 kasus B, bukan oleh code review: percobaan pertama audit log mencatat `bound_role: null` untuk panggilan yang **ditolak** karena role salah — walau binding sebenarnya terikat ke `DEV`. Akar masalah: variabel `role` di `respondControlWrite()` hanya diisi **setelah** `requireRole()` berhasil, sehingga setiap `ROLE_NOT_AUTHORIZED` mengaudit `bound_role:null` — persis kasus yang paling butuh atribusi benar (§17: audit harus bisa menghubungkan actor dengan outcome).

**Perbaikan**: audit kini membaca `binding.role` langsung (`boundRole`, dibaca sekali di awal fungsi, independen dari hasil otorisasi), terpisah dari `authorizedRole` (hasil `requireRole()`, hanya ada setelah sukses, dipakai untuk idempotency key dan `mutate()`). Diverifikasi ulang lewat smoke test — kasus B sekarang menunjukkan `bound_role:"DEV"` pada entri deny.

Ini satu-satunya bug yang ditemukan pada percobaan pertama seluruh smoke test (bukan hasil percobaan berulang) — dicatat di sini karena polanya relevan untuk reviewer: audit-path yang hanya diuji lewat kasus sukses tidak akan pernah menangkapnya.

## 7. Mutation-check — sebagian tidak dapat diselesaikan (pola sama dengan Stage B2 §4.1)

Untuk R-01/R-10 pada Batch 1, guard boundary sengaja dimatikan (`if (false)`) lalu suite dijalankan ulang untuk membuktikan test benar-benar menggigit. Saya mencoba pola yang sama pada `requireRole()`'s guard di `src/mcp/control/shared.ts`.

**Hasil: diblokir**, identik dengan yang dialami implementer Stage B2 (`RESULT-IMPL-SIGMA-MCP-STAGE-B2-20260915.md` §4.1) — perintah menjalankan test dengan guard role dinonaktifkan ditolak classifier keamanan sesi ini dengan alasan "Security Weaken". Guard segera dikembalikan (diverifikasi `diff` byte-identical dengan backup sebelum percobaan) tanpa mencoba jalur lain untuk melewatinya.

**Konsekuensi**: guard role, guard stale-state, dan guard idempotency-conflict di `src/mcp/control/shared.ts` terbukti **positif** (test khusus untuk setiap kasus tolak dan setiap kasus terima, lihat §4) tetapi **tidak** dibuktikan lewat teknik "matikan-lalu-gagal" yang dipakai R-01/R-10. Sebagai substitusi, setiap guard punya test kasus diterima **dan** kasus ditolak yang menjalankan kode asli (tidak dilemahkan) — kategori bukti yang berbeda, bukan lebih lemah untuk properti yang sama: test-test ini membuktikan percabangan guard yang sebenarnya di kedua arah, bukan hanya bahwa mematikannya mengubah hasil.

**Untuk Director**: mutation-check ini bisa dijalankan manual di luar sesi ini — ubah sementara `if (!binding.role || !allowed.includes(binding.role))` → `if (false)` di `src/mcp/control/shared.ts` baris ~42, jalankan `npx vitest run test/control-intent-draft.test.ts`, verifikasi test role-boundary gagal, lalu kembalikan. Sama untuk guard stale-state (baris ~145) dan idempotency-conflict (baris ~135).

## 8. Keterbatasan yang dinyatakan, bukan disembunyikan

| Keterbatasan | Detail |
|---|---|
| **Lock hanya in-process** | `withControlLock()` menyerialkan compare-and-write dalam satu proses `sigma-control`. Dua proses `sigma-control` terpisah yang bound ke root yang sama **tidak** saling menyerialkan. Asumsi operasional pilot: satu proses control per proyek pada satu waktu. Membuatnya aman lintas-proses butuh file lock (belum ada dependency untuk itu di `package.json`) — didokumentasikan, tidak ditambahkan spekulatif. §22 plan sudah membatasi Stage C ke host lokal untuk alasan berbeda (autentikasi role hanya sekuat siapa yang bisa spawn proses), yang secara praktis sejalan dengan asumsi satu-proses ini. |
| **Ticket korup diperlakukan sebagai absen** | `readIdempotencyRecord()` yang gagal parse JSON mengembalikan `null` (bukan error), sehingga retry pada ticket yang korup akan mengeksekusi ulang alih-alih macet permanen. Trade-off eksplisit menuju recoverability; window kerusakannya kecil karena tmp+rename atomic, tapi bukan nol. |
| **`sigma_update_artifact_draft` dipatok ke `type:"intent"`** | Bukan generalisasi yang belum sempat dikerjakan — ini keputusan Director §1 butir 2. Memperluas ke plan/exec/roadmap/close adalah Stage E, dengan review boundary terpisah untuk masing-masing (setiap tipe punya chain-field shape berbeda — `chain.intent` tunggal vs `chain.plan.versions[]` array). |
| **Tidak ada primitive `sigma_prepare_*`/ticket bergaya Stage D** | Operation ticket (plan §10.1) belum ada — Stage C pilot menyatukan "prepare" (cek stale-state) dan "commit" dalam satu panggilan tool, karena target W1 (DRAFT create/update) bukan transisi governance yang butuh Director approval terpisah. Ini konsisten dengan plan §9.2 vs §9.3 (W1 tidak mensyaratkan pola dua-tahap; W2 mensyaratkannya) — Stage D akan memperkenalkan primitive ticket yang sesungguhnya. |

## 9. Definition of Done Gate C (plan §14) — self-assessment

| Syarat Gate C | Status |
|---|---|
| Write hanya terjadi pada bound project/artifact DRAFT | **Terpenuhi** — §4, §5 kasus C/F; tidak ada parameter project_root pada kedua tool (diverifikasi lewat introspeksi schema, test transport-level) |
| Role/gate mismatch ditolak | **Terpenuhi** — §4, §5 kasus B; role bukan input tool, hanya dari binding |
| Retry tidak menggandakan efek | **Terpenuhi** — §4 (unit), §5 kasus D (subprocess nyata) |
| Stale write ditolak | **Terpenuhi** — `STALE_STATE` (create) dan `STALE_ARTIFACT` (update), §4, §5 kasus E |
| Query server tetap tidak mempunyai write imports/tool | **Terpenuhi** — guard §3, exact-match tool-list test tidak berubah |

Self-assessment ini **bukan** penetapan Gate C PASS — konsisten dengan §20.5 plan, keputusan itu menunggu review Codex/Director atas source diff, output test, dan dokumen ini.

## 10. Daftar file berubah

**Baru — source (9)**
`src/services/intentDraftService.ts`, `src/engine/controlStore.ts`, `src/mcp/control/index.ts`, `src/mcp/control/shared.ts`, `src/mcp/control/canonicalWrite.ts`, `src/mcp/control/artifactDraftUpdate.ts`, `src/mcp/control/tools/createIntentDraft.ts`, `src/mcp/control/tools/updateArtifactDraft.ts`, `bin/sigma-control.js`

**Baru — test (1)**
`test/control-intent-draft.test.ts` (17 test)

**Baru — evidence (1)**
`Implementation/sigma-mcp/evidence/stageC-runtime-smoke.mjs`

**Baru — dokumen (1)**
Dokumen ini

**Diubah — source (2)**
`src/commands/intent.ts` (refactor ke service bersama), `src/mcp/binding.ts` (role wajib untuk control mode)

**Diubah — test (1)**
`test/mcp-tools.test.ts` (guard dipecah, nama writer baru ditambahkan)

**Diubah — config (1)**
`package.json` (entri `bin.sigma-control` — tidak dijalankan/di-link)

**Diubah — dokumen (1)**
`Implementation/sigma-mcp/SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md` (status `intent_new` → implemented; koreksi pemetaan `plan_update`/`sigma_update_artifact_draft`)

**`dist/`** — artefak build mengikuti konvensi repo (termasuk `dist/mcp/control/`, `dist/services/`, `dist/engine/controlStore.*`).

**Tidak disentuh**: `src/utils/mcpConfig.ts`, `src/mcp/policy.ts` (dua operasi baru sengaja tidak ditambahkan ke proyeksi `sigma_get_effective_policy` — scope creep di luar yang diminta; sembilan tool Batch 1 dan satu tool Stage B2 tidak diubah), `Sigma/SIGMA-OPERATION-REGISTRY.json`, config global manapun, proyek produksi manapun.

## 11. Yang tidak dikerjakan (sesuai batas §1)

Stage D (operation ticket, approval durable, `intent_ratify` prepare→approve→commit), tool write selain dua pilot ini, tipe artifact selain intent untuk update, instalasi `sigma-control` ke profile Hermes manapun, `npm link` ulang, commit/push.

## 12. Langkah berikutnya

Stage D telah dieksekusi atas instruksi Director 2026-09-16 dan direview bersamaan dengan Stage C. Status review gabungan serta syarat sebelum perluasan write berikutnya dicatat di §13 dan pada `RESULT-IMPL-SIGMA-MCP-STAGE-D-20260915.md` §11.

## 13. Review Codex 2026-09-16 — Gate C HOLD

### 13.1 Putusan

Gate C **belum PASS**. Pemisahan query/control binary, role dari startup binding, shared service CLI–MCP, stale-state/artifact checks, canonical artifact path, size limit, serta smoke Stage C berada di arah yang benar. Namun implementasi belum memenuhi kontrak concurrency, atomic failure handling, exactly-once recovery, dan audit minimum. Jangan memperluas bounded command ke artifact/operasi berikutnya sebelum finding blocking di bawah ditutup.

### 13.2 Finding blocking

| ID | Severity | Finding | Bukti utama | Dampak |
|---|---|---|---|---|
| C-R01 | P0 | `withControlLock()` hanya promise-chain dalam satu proses, bukan project-scoped lock lintas-proses sebagaimana plan §11. Dua proses `sigma-control` pada root yang sama tidak saling menyerialkan compare-and-write. | `src/mcp/control/shared.ts`; keterbatasan sudah diakui pada §8, tetapi test concurrency hanya memakai `Promise.all()` in-process. | Dua worker dapat sama-sama melewati precondition; stale protection dan exactly-once tidak berlaku sebagai boundary host. |
| C-R02 | P0 | Mutasi dan outcome idempotency bukan satu transaction boundary. `mutate()` selesai lebih dahulu, baru `writeIdempotencyRecord()`; kegagalan/crash di antaranya meninggalkan efek tanpa outcome durable. Create intent juga menulis template, chain, active pointer, dan history secara terpisah tanpa journal/rollback/reconciliation. | `src/mcp/control/shared.ts`; `src/services/intentDraftService.ts`; plan §11.6 dan §16.3. | Caller dapat menerima `INTERNAL_ERROR` walau sebagian/seluruh mutasi sudah terjadi; retry tidak dijamin mengembalikan outcome pertama. |
| C-R03 | P1 | Idempotency record yang ada tetapi korup diperlakukan sebagai tidak ada (`null`). | `src/engine/controlStore.ts::readIdempotencyRecord()`. | Retry dapat mengeksekusi mutasi ulang; ini fail-open terhadap invarian exactly-once. |
| C-R04 | P1 | Audit bersifat best-effort dan belum membawa seluruh field minimum plan. Kegagalan append ditelan; wrapper tidak mengisi `channel/profile` atau `artifact_hash_before/after`. | `src/mcp/control/shared.ts::audit()`; plan §17. | Command dapat sukses tanpa audit durable, dan korelasi artifact tidak lengkap. |

### 13.3 Verifikasi reviewer

Dilakukan pada Windows, Node `v24.19.0`, npm `11.17.0`:

- `npx tsc --noEmit`: PASS.
- `test/control-intent-draft.test.ts`: 17/17 PASS dalam targeted run.
- `Implementation/sigma-mcp/evidence/stageC-runtime-smoke.mjs`: PASS seluruh kasus.
- `git diff --check`: PASS, dengan warning normalisasi CRLF yang sudah dicatat implementer.
- Full-suite run tidak dapat menjadi bukti bersih pada sesi review karena test Notion/humanize unrelated ditolak sandbox saat mengakses `C:\Users\dikoh\.sigma\notion.credentials.json`; ini terpisah dari finding Stage C di atas.

### 13.4 Syarat re-review Gate C

1. Tambahkan lock lintas-proses per canonical project root dan test dua proses nyata.
2. Tambahkan durable transaction journal/outbox atau recovery protocol yang menyatukan mutation result, idempotency outcome, dan audit; failure injection wajib mencakup setiap write boundary.
3. Perlakukan idempotency record korup sebagai typed fail-closed/recovery-required, bukan cache miss.
4. Lengkapi audit minimum dan buktikan perilaku saat append audit gagal.
5. Setelah perbaikan, ulangi targeted tests, smoke out-of-process, dan full suite pada environment yang dapat mengisolasi credential store dengan benar.

## 14. Tanggapan atas review Codex (2026-09-16)

Keempat temuan direproduksi secara independen sebelum diperbaiki — C-R04 (path traversal disebut di temuan D-R04, sama-sama berlaku untuk Stage C karena store-nya dibagi) direproduksi lebih dulu sebagai bukti, bukan diasumsikan benar dari deskripsi review.

### 14.1 Status per temuan

| ID | Sev | Status | Perbaikan |
|---|---|---|---|
| C-R01 | P0 | **FIXED** | `withControlLock()` diganti total: `src/engine/controlStore.ts::acquireProjectLock()` — lockfile exclusive-create (`fs.openSync(path, 'wx')`), atomic di level OS pada NTFS maupun POSIX, dengan staleness-steal (60 detik) agar satu proses yang crash tidak mengunci proyek selamanya. Dibuktikan dengan **dua proses OS sungguhan** (`bin/sigma-control.js` di-spawn dua kali via `StdioClientTransport`, bukan dua `Promise` dalam satu proses) — lihat §14.2 |
| C-R02 | P0 | **SEBAGIAN DIMITIGASI — belum ditutup penuh, lihat §14.3** | Idempotency record dijadikan two-phase (`pending` → `completed`); ini menutup mode kegagalan paling parah (mutasi diam-diam terulang) tetapi **bukan** transaction journal/rollback penuh yang diminta |
| C-R03 | P1 | **FIXED** | `readIdempotencyRecord()`: file yang ada tapi tidak bisa di-parse sekarang **throw**, bukan dikembalikan sebagai `null`. "Tidak ada" dan "ada tapi tidak terbaca" tidak lagi dianggap sama — retry pada record korup sekarang fail-closed (`INTERNAL_ERROR`), bukan mengeksekusi ulang mutasi secara buta |
| C-R04 | P1 | **FIXED** | Audit sekarang membawa `channel`, `operation_ticket_id`, `approval_id`, `artifact_hash_before/after` (field yang sudah ada di skema tapi tidak pernah diisi). Kegagalan tulis audit tidak lagi ditelan — dicetak ke stderr |

### 14.2 Bukti C-R01 — dua proses nyata, bukan dua promise

Ditambahkan `test/control-intent-draft.test.ts`, describe block "cross-process concurrency": dua proses `sigma-control` independen (masing-masing `child_process` sungguhan lewat SDK `StdioClientTransport`) mencoba `sigma_create_intent_draft` secara bersamaan.

- Idempotency key **sama** pada kedua proses → tepat satu chain dibuat, proses kedua me-replay hasil proses pertama (bukan menciptakan chain kedua).
- Idempotency key **berbeda**, `expected_state_revision` sama (skenario paling berbahaya — race murni) → tepat satu proses berhasil (`v1`), proses lain menerima `STALE_STATE` karena lock memaksa keduanya diserialkan; **tidak pernah** dua-duanya lolos precondition check secara bersamaan seperti yang mungkin terjadi pada implementasi lama.

`test/control-intent-ratify.test.ts` menambah satu test setara untuk Stage D (lihat RESULT Stage D §12.2). Guard staleness lock (60 detik) dan pola pending/completed-nya sendiri sudah lulus mutation-check (§16.3 dokumen ini dan RESULT Stage D §12).

### 14.3 C-R02 — kejujuran soal apa yang benar-benar tertutup

Codex meminta "durable transaction journal/outbox atau recovery protocol". Yang saya bangun **bukan** itu — saya tidak mengklaim sudah. Yang saya bangun:

1. `IdempotencyRecord` sekarang punya `status: 'pending' | 'completed'`. Reservasi ditulis **sebelum** `mutate()` berjalan; finalisasi **sesudah** `mutate()` sukses.
2. Bila `mutate()` melempar exception secara sinkron (penolakan bisnis normal, bukan crash), reservasi dihapus di tempat — retry dengan key yang sama tidak terhalang oleh percobaan yang gagal itu.
3. Bila proses benar-benar crash di antara reservasi dan finalisasi, record tertinggal berstatus `pending`. Record `pending` yang masih baru (< 2 menit) menolak percobaan berikutnya dengan `IDEMPOTENCY_CONFLICT` (tidak menebak). Record `pending` yang sudah tua (§ `IDEMPOTENCY_PENDING_STALE_MS`) dianggap ditinggalkan dan percobaan berikut diizinkan berjalan seolah tidak ada record — **di dalam lock yang sama**, sehingga tetap paling banyak satu yang berhasil.

**Yang ini tutup**: mode kegagalan paling berbahaya — mutasi terduplikasi secara diam-diam setelah crash — tidak lagi mungkin untuk `sigma_create_intent_draft` maupun `sigma_commit_intent_ratify` (yang terakhir punya lapisan proteksi kedua: `ratifyIntentDraft()` menolak me-ratify intent yang sudah bukan DRAFT, jadi re-eksekusi setelah crash gagal bersih, bukan korup).

**Yang ini TIDAK tutup**: dalam satu `mutate()` call, langkah-langkah internal (mis. `createIntentDraft`: copy template → tulis chain → tulis activate_status → render history) masih beberapa write terpisah **tanpa rollback**. Bila proses crash di **tengah** `mutate()` itu sendiri (bukan di sekitar reservasi idempotency), state parsial bisa tertinggal — persis kekhawatiran asli Codex soal "intent bisa RATIFIED tapi response error" untuk kasus tertentu (jika crash terjadi setelah `ratifyIntentDraft()` menulis chain tapi sebelum `markTicketConsumed`/`markApprovalConsumed` selesai, ticket/approval bisa tertinggal belum-consumed selamanya — aman [tidak ada duplikasi], tapi butuh idempotency key baru atau intervensi manual untuk pulih). Diuji eksplisit di §14.2 (tautan) dan RESULT Stage D §12 — tidak disembunyikan.

Journal/rollback penuh untuk sub-langkah di dalam `mutate()` belum dibangun. Ini keputusan sadar karena skala pekerjaannya (mengubah setiap use-case menjadi rangkaian write yang benar-benar atomic/recoverable) melebihi apa yang bisa saya selesaikan dan verifikasi dengan percaya diri dalam giliran ini tanpa mengklaim lebih dari yang saya buktikan.

### 14.4 Verifikasi ulang

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` | Bersih |
| `npm test` (full suite) | **53 file / 594 test PASS** |
| `test/control-intent-draft.test.ts` | 23/23 PASS (dari 17 — +6: 3 test crash-window/corruption baru, 2 test concurrency lintas-proses, 1 lainnya) |
| Smoke `stageC-runtime-smoke.mjs` | PASS seluruh kasus |
| Mutation-check tambahan | Guard staleness pending record (`ageMs < IDEMPOTENCY_PENDING_STALE_MS`) dimatikan sementara → 1 test gagal seperti diharapkan; dikembalikan, `diff` byte-identical |
| `git diff --check` | Bersih |

### 14.5 Status gate

**Gate C tetap tidak saya nyatakan PASS.** C-R01, C-R03, C-R04 tertutup dengan bukti. C-R02 dimitigasi substansial (mode kegagalan paling parah tertutup, diuji) tetapi bukan transaction journal penuh yang diminta — ini keputusan implementer untuk transparan, bukan pernyataan bahwa temuan tidak valid. Menunggu keputusan Director: kirim untuk re-review Codex sekarang dengan gap C-R02 yang didokumentasikan eksplisit, atau lanjutkan membangun journal penuh sebelum re-review.

## 15. Re-review Codex atas tanggapan implementer (2026-09-16)

### 15.1 Putusan

Gate C tetap **HOLD / belum PASS**. Bukti functional dan regresi implementer dapat direproduksi, tetapi hasil inspeksi source dan uji adversarial menunjukkan C-R01 belum benar-benar tertutup, C-R02 tetap terbuka, serta C-R03/C-R04 baru tertutup sebagian.

| ID | Status re-review | Alasan |
|---|---|---|
| C-R01 | **REOPEN — P0** | Lock sudah lintas-proses pada happy path, tetapi lease dapat dicuri dari holder aktif setelah 60 detik dan `release()` tidak memverifikasi ownership token sebelum menghapus lock saat ini. Mutual exclusion masih dapat hilang. |
| C-R02 | **OPEN — P0** | `pending → completed` adalah mitigasi berguna, tetapi bukan transaction/recovery boundary. Stale `pending` kembali dieksekusi setelah dua menit, dan setiap exception dari `mutate()` menghapus reservasi walaupun mutasi mungkin sudah menulis sebagian state. |
| C-R03 | **PARTIAL — P1** | Invalid JSON fail-closed, tetapi record parseable dengan schema/status/timestamp invalid tetap dipercaya karena tidak ada runtime schema validation. |
| C-R04 | **PARTIAL — P1** | Field audit bertambah dan kegagalan tidak lagi diam, tetapi stderr bukan audit durable. Command tetap dapat sukses tanpa audit record; audit juga dilakukan setelah lock dilepas sehingga revision correlation dapat tercampur dengan mutasi berikutnya. |

### 15.2 Reproduksi reviewer

#### Lock ownership hilang

Reviewer memperoleh lock A, membuat mtime-nya lebih tua dari `LOCK_STALE_MS`, memperoleh lock B sementara A masih aktif, lalu memanggil `A.release()`. Karena release hanya menjalankan `unlinkSync(lockPath)` tanpa token ownership, lock B terhapus dan lock C dapat diperoleh sementara B masih aktif.

Hasil aktual:

```json
{
  "secondAcquiredWhileFirstActive": true,
  "thirdAcquiredWhileSecondActive": true,
  "lockStillExists": true
}
```

Lokasi akar masalah: `src/engine/controlStore.ts::acquireProjectLock()` — stale detection hanya memakai mtime, stale steal memakai unlink path bersama, dan `release()` tidak membandingkan owner token.

#### Semantic corruption idempotency masih diterima

Reviewer menulis record JSON yang valid secara sintaks tetapi mempunyai `status:"bogus"` dan `created_at:"not-a-date"`. `readIdempotencyRecord()` menerima record tersebut:

```json
{
  "acceptedStatus": "bogus",
  "acceptedCreatedAt": "not-a-date"
}
```

Pada `respondControlWrite()`, status selain `completed` masuk jalur pending; timestamp invalid menghasilkan `NaN`, sehingga pemeriksaan umur tidak menolak dan eksekusi jatuh ke jalur mutasi. Record `completed` parseable juga belum divalidasi terhadap project, operation, role, key, status, timestamp, dan bentuk result sebelum direplay.

### 15.3 Penilaian mitigasi C-R02

Two-phase idempotency layak dipertahankan karena mempersempit crash window. Namun dua perilaku berikut mencegah klaim exactly-once/recovery:

1. Record `pending` berumur lebih dari `IDEMPOTENCY_PENDING_STALE_MS` dianggap abandoned dan ditimpa tanpa membuktikan apakah mutasi lama belum mulai, selesai, atau meninggalkan state parsial.
2. Catch atas seluruh exception `mutate()` memanggil `deleteIdempotencyRecord()`. Exception tidak membuktikan bahwa mutasi belum terjadi; `createIntentDraft()` sendiri menulis template, chain, active pointer, dan history dalam beberapa langkah.

Contoh crash setelah chain file ditulis tetapi sebelum active pointer ditulis dapat meninggalkan orphan chain yang tidak masuk `state_revision`; retry kemudian dapat membuat versi lain. Karena itu pernyataan §14.3 bahwa silent duplicate mutation “tidak lagi mungkin” belum dapat diterima secara umum.

### 15.4 Verifikasi re-review

Dilakukan pada Windows, Node `v24.19.0`, npm `11.17.0`:

| Pemeriksaan | Hasil |
|---|---|
| Targeted: `control-intent-draft`, `control-intent-ratify`, `mcp-tools`, `mcp-binding` | **111/111 PASS** |
| Full suite dengan `HOME`/`USERPROFILE` terisolasi | **53 file / 594 test PASS** |
| Smoke Stage C | **PASS seluruh kasus** |
| Smoke Stage D | **PASS seluruh kasus** |
| `npx tsc --noEmit` | PASS |
| `git diff --check` | PASS; warning CRLF lama pada `src/commands/intent.ts` |

Dengan demikian angka 594 PASS dan perbaikan fallback Windows dapat direproduksi. Hasil hijau tersebut tidak menutup failure mode lock ownership, semantic corruption, audit durability, atau partial-write recovery karena kasus-kasus itu belum ada dalam suite.

### 15.5 Syarat re-review berikutnya

1. Lock memakai owner token/lease yang tidak dapat dihapus holder lama, mempunyai heartbeat atau liveness rule yang eksplisit, dan mempunyai regression test stale-steal serta old-owner release.
2. Record idempotency divalidasi runtime secara lengkap dan mismatch/corruption fail-closed.
3. Stale pending tidak boleh dieksekusi ulang hanya berdasarkan umur; harus ada reconciliation berdasarkan durable operation journal dan post-state/effect evidence.
4. Exception setelah partial write tidak boleh menghapus satu-satunya bukti attempt; tambahkan failure injection di setiap write boundary `createIntentDraft()`.
5. Audit commit/revision correlation harus diselesaikan sebelum lock dilepas atau melalui durable outbox/journal, dan success tanpa audit durable harus mempunyai recovery state eksplisit.

## 16. Tanggapan atas re-review Codex putaran 2 (2026-09-16)

Temuan lock-stealing (poin 1) direproduksi independen dulu — lihat skrip repro di §16.1 — sebelum diperbaiki. Ini bug nyata dan serius; saya tidak membantahnya.

### 16.1 C-R01/D-R01 (REOPEN, P0) — direproduksi, lalu diperbaiki dengan fencing token + liveness PID

Reproduksi (dijalankan terhadap build sebelum perbaikan ini):

```
A acquired
B acquired while A is still active: true
A released (deleted whichever lock file currently exists)
{"cAcquiredWhileBActive":true}
```

Persis skenario yang Anda laporkan: `release()` menghapus lock berdasarkan **path**, bukan **kepemilikan** — sehingga holder lama yang lock-nya sudah dicuri, saat akhirnya memanggil `release()`, menghapus lock milik holder baru.

**Perbaikan** (`src/engine/controlStore.ts::acquireProjectLock`), dua perubahan independen:

1. **Fencing token** — setiap akuisisi menulis `lock_id` (UUID) acak. `release()` membaca ulang file lock saat ini; hanya menghapus bila `lock_id` masih cocok dengan miliknya sendiri. Holder yang lock-nya sudah dicuri akan menemukan `lock_id` orang lain dan tidak melakukan apa-apa.
2. **Liveness PID, bukan umur wall-clock, sebagai sinyal utama staleness** — lock file mencatat PID penulisnya; lock hanya dicuri setelah `isProcessAlive(pid)` mengonfirmasi proses itu **benar-benar sudah mati** (`ESRCH`), atau — sebagai backstop untuk kasus yang tidak bisa diselesaikan liveness-check (izin ditolak, PID reuse, file lock rusak) — setelah umurnya melewati `LOCK_ABSOLUTE_STALE_MS` (10 menit, jauh lebih besar dari 60 detik semula karena sekarang ini backstop, bukan mekanisme utama).

**Keterbatasan yang dinyatakan, bukan disembunyikan**: window steal-vs-release masih ada race TOCTOU yang **dipersempit, bukan dihilangkan** — Node tidak punya primitive compare-and-delete atomic. Saya menambah re-check sesaat sebelum unlink (baca ulang, hanya hapus bila `lock_id` masih sama dengan yang baru diperiksa), pola yang sama dengan "narrowing bukan eliminating" yang sudah diterima di `artifactPath.ts` sejak Batch 1 (R-01).

**Bukti**: `test/control-intent-ratify.test.ts`, describe "acquireProjectLock — fencing token" — mereproduksi skenario persis di atas terhadap kode yang sudah diperbaiki, hasil: lock B tidak terhapus oleh release A, C tidak bisa acquire selagi B aktif. **Mutation-check**: guard fencing-token dimatikan sementara (`if (current && current.lock_id === myLockId)` → `if (true)`) → test yang sama gagal dengan pesan identik ke reproduksi asli ("B's lock must survive... expected false to be true"); guard dikembalikan, `diff` byte-identical.

Test concurrency lintas-proses Stage C/D dari putaran 1 (`test/control-intent-draft.test.ts`, `test/control-intent-ratify.test.ts`) diverifikasi ulang lulus di atas mekanisme lock yang baru — tidak berubah perilaku eksternal, hanya mekanisme internalnya yang sekarang benar.

### 16.2 C-R02/D-R02 (OPEN, P0) — perbaikan nyata, tetap tidak saya klaim tertutup

Tiga bagian dari syarat re-review (§15.5 poin 3, 4, 5) masing-masing saya tanggapi terpisah karena statusnya berbeda:

**Poin 3 (stale pending tidak boleh dieksekusi ulang berdasarkan umur saja)** — **diselesaikan, tetapi bukan dengan journal.** Saya **menghapus** heuristik umur (2 menit) sepenuhnya, bukan menggantinya dengan yang lain, karena ada argumen ketat mengapa heuristik apa pun tidak diperlukan: setiap transisi `pending`→terminal untuk kombinasi (operation_id, role, idempotency_key) yang sama terjadi di dalam project lock yang sama, dan `mutate()` sekarang dijamin sinkron (dicek runtime — lihat §16.2.1). Tidak ada titik `await` antara penulisan `pending` dan penulisan status terminalnya. Karena itu, satu-satunya cara sebuah call menemukan record `pending` **sementara call itu sendiri sedang memegang lock** adalah penulis sebelumnya mati sebelum mencapai status terminal — tidak ada proses lain yang bisa saja masih berjalan bersamaan, karena memegang lock itu sendiri yang meniadakan kemungkinan itu. Ini bukan heuristik yang saya perhalus, melainkan properti yang saya buktikan tidak perlu heuristik. Diverifikasi ulang: test `IDEMPOTENCY_PENDING_STALE_MS`-based yang lama saya hapus, diganti satu test yang sengaja menanam record `pending` **berumur nol detik** (kasus yang dulu DITOLAK oleh heuristik lama) dan membuktikan sekarang diterima.

**Poin 4 (exception tidak boleh menghapus satu-satunya bukti attempt)** — **diperbaiki.** `IdempotencyStatus` menambah `'failed'`. Saat `mutate()` melempar exception sinkron, record tidak lagi dihapus — ditulis ulang sebagai `status:'failed'` dengan pesan error, tetap ada sebagai riwayat, dan retry dengan key yang sama (argumen yang sama) tetap boleh jalan (diperlakukan sama dengan `pending` yang ditinggalkan). Yang **tidak** diselesaikan poin ini: rollback tulisan parsial yang mungkin sudah dilakukan `mutate()` sebelum melempar — `writeIdempotencyRecord` status `failed` mencatat **bahwa** ada percobaan yang gagal, bukan **apa** yang sempat tertulis sebelum gagal itu.

**Poin 5 (audit commit/revision correlation sebelum lock dilepas)** — **diperbaiki.** `revisionAfter` sekarang dihitung di dalam callback `withControlLock`, sebelum lock dilepas — bukan lagi dibaca setelah `respondControlWrite` menerima hasil dari lock yang sudah dilepas. Kutipan klaim saya sebelumnya di §12.3 (dokumen Stage D) bahwa "operator akan menemukan audit outcome: commit" — saya **tarik kembali**, itu bisa salah persis pada skenario yang Anda tunjukkan (crash sebelum baris audit tercapai berarti tidak ada baris audit sama sekali, bukan baris `commit` maupun `deny`). Dikoreksi eksplisit di §14 dokumen Stage D.

**Yang TETAP terbuka, sesuai pengakuan saya di putaran 1** (poin 4 di atas menyinggungnya juga): setiap operasi (`createIntentDraft`, `ratifyIntentDraft`, `updateArtifactDraft`) masih menulis beberapa file terpisah tanpa rollback internal. Saya tidak membangun durable operation journal/outbox seperti yang diminta — itu tetap representasi paling jujur dari yang saya kerjakan. Yang berubah dari putaran 1: window kegagalan yang sebelumnya bisa "menghilangkan bukti" (menghapus record) sekarang tidak lagi terjadi, dan argumen soal `pending` sekarang adalah pembuktian, bukan penyetelan angka waktu.

#### 16.2.1 Guard sinkron sebagai pertahanan berlapis

Argumen di atas ("tidak ada `await` antara pending dan terminal") bergantung pada `mutate()` selalu sinkron. Ini sekarang **ditegakkan runtime**, bukan cuma didokumentasikan: bila `mutate()` mengembalikan sesuatu yang thenable, `respondControlWrite()` menolaknya sebagai `INTERNAL_ERROR` sebelum menulis status `completed`. Ini pagar terhadap regresi masa depan (mis. seseorang mengubah salah satu service jadi `async` tanpa menyadari implikasinya terhadap invarian lock ini).

### 16.3 C-R03 (PARTIAL, P1) — validasi shape runtime, bukan cuma JSON.parse

Direproduksi dulu:

```
readIdempotencyRecord() menerima record dengan status:"bogus" dan created_at:"not-a-date"
```

Benar — perbaikan putaran 1 hanya menangkap kegagalan `JSON.parse`, bukan JSON valid dengan bentuk yang salah. **Perbaikan**: `isWellFormedIdempotencyRecord()` baru memvalidasi setiap field yang benar-benar dipakai logikanya (`status` harus salah satu dari tiga nilai enum, `created_at` harus tanggal valid, `pid` harus number, dst.) — record yang lolos `JSON.parse` tapi gagal validasi bentuk ini diperlakukan **sama** dengan yang gagal parse: `throw`, bukan `null`. Diuji dengan regression test yang menanam persis skenario `status:"bogus"`/`created_at:"not-a-date"` yang Anda laporkan.

### 16.4 Verifikasi ulang

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` | Bersih |
| `npm test` (full suite) | **53 file / 596 test PASS** |
| `test/control-intent-draft.test.ts` | 23/23 PASS |
| `test/control-intent-ratify.test.ts` | 28/28 PASS (dari 26 — +2: fencing token, target_artifact/version) |
| Smoke Stage C & D | PASS seluruh kasus |
| Mutation-check | Fencing token (§16.1) dan guard `IDEMPOTENCY_PENDING_STALE_MS`-replacement (§16.2, terbukti via test umur-nol) keduanya diverifikasi menggigit |
| `git diff --check` | Bersih |

### 16.5 Status gate

**Masih tidak saya nyatakan PASS.** C-R01/D-R01 saya anggap tertutup dengan bukti reproduksi-lalu-perbaikan-lalu-mutation-check yang sama ketatnya dengan R-01/R-10 Batch 1. C-R02/D-R02 saya nyatakan **tetap terbuka** untuk bagian journal/rollback penuh — dua dari tiga syarat re-review-nya (poin 4, 5) selesai, satu (poin 3) selesai dengan pendekatan berbeda dari yang diminta (pembuktian, bukan journal) yang saya yakini secara teknis lebih kuat untuk kasus spesifik ini, tapi bukan pengganti journal untuk kasus umum (partial write di dalam satu `mutate()` call). C-R03 saya anggap tertutup. Keputusan akhir tetap pada Anda/Director.

## 17. Re-review Codex putaran 3 atas tanggapan implementer (2026-09-16)

### 17.1 Putusan

Gate C tetap **HOLD / belum PASS**. Putaran ini memang memperbaiki penghapusan lock milik holder baru oleh `release()` holder lama, menghapus heuristik umur record `pending`, menambahkan status `failed`, memindahkan pembacaan `state_revision_after` ke dalam lock, dan menambah validasi bentuk dasar record idempotency. Namun inspeksi source dan reproduksi adversarial masih menemukan P0 pada mutual exclusion dan transaction recovery.

| ID | Status re-review | Alasan |
|---|---|---|
| C-R01 | **PARTIAL / REOPEN — P0** | Fencing/ownership check pada `release()` bekerja. Tetapi `acquireProjectLock()` tetap menetapkan `shouldSteal = true` ketika umur lock melewati 10 menit **tanpa memedulikan hasil PID liveness**. Holder aktif masih dapat kehilangan lock. Re-check `lock_id` lalu `unlink` juga tetap TOCTOU, sebagaimana diakui source. |
| C-R02 | **OPEN — P0** | Mengetahui penulis `pending` sebelumnya tidak lagi memegang lock tidak membuktikan outcome mutasinya: belum mulai, partial write, atau selesai sebelum mati. Retry tetap menebak dan dapat menimpa evidence. Tidak ada journal, rollback, reconciliation, atau process-kill test di write boundaries. |
| C-R03 | **PARTIAL — P1** | Enum/status/timestamp dan tipe field dasar kini divalidasi. Namun reader belum memastikan `project_id`, `operation_id`, `bound_role`, dan `idempotency_key` di dalam record sama dengan scope lookup; record `completed` lintas-scope yang bentuknya valid masih direplay. Invarian per status juga belum divalidasi. |
| C-R04 | **PARTIAL — P1** | `state_revision_after` kini dihitung di dalam lock dan field korelasi terisi. Audit append sendiri masih best-effort setelah lock dilepas; kegagalannya hanya ke stderr, sehingga success tanpa audit durable tetap mungkin. |

### 17.2 Reproduksi reviewer

#### Lock proses hidup tetap dicuri setelah absolute age

Reviewer memperoleh lock A, mempertahankan PID A tetap hidup, lalu hanya mengubah `acquired_at` pada lock menjadi 11 menit lalu. Akuisisi B berhasil walaupun PID A masih hidup:

```json
{
  "firstPidStillAlive": true,
  "secondAcquiredWhileFirstActive": true,
  "tokensDiffer": true
}
```

Akar masalah berada di `src/engine/controlStore.ts::acquireProjectLock()`: cabang `ageMs > LOCK_ABSOLUTE_STALE_MS` mencuri lock “regardless of what the liveness check says”. Jadi implementasi tidak sesuai narasi §16.1 bahwa umur hanya menjadi backstop ketika liveness tidak dapat diandalkan. Test fencing yang ditambahkan hanya memakai PID mati dan timestamp lama; test itu membuktikan ownership-safe `release()`, bukan bahwa holder hidup tidak pernah dicuri.

#### Record idempotency lintas-scope masih diterima

Reviewer menulis record `completed` yang lulus shape validation pada path lookup untuk request saat ini, tetapi isi identity fields-nya sengaja dibuat milik project/operation/role/key lain. `readIdempotencyRecord()` tetap menerimanya:

```json
{
  "accepted": true,
  "project_id": "FOREIGN",
  "operation_id": "other_operation",
  "bound_role": "DEV",
  "idempotency_key": "other-key",
  "result": { "forged": true }
}
```

Validasi runtime perlu memeriksa bukan hanya tipe/enum, tetapi juga equality terhadap parameter lookup dan invarian status, sebelum hasil `completed` boleh direplay.

### 17.3 Penilaian argumen `pending`

Penghapusan ambang dua menit adalah perbaikan: keputusan retry tidak lagi bergantung pada umur record. Namun argumen §16.2 hanya membuktikan bahwa tidak ada writer lama yang masih sah memegang lock—dan saat ini bahkan premis itu gugur pada jalur absolute-age steal. Argumen tersebut tidak membuktikan apakah efek writer lama sudah nol, parsial, atau lengkap.

Status `failed` juga belum menjadi durable history penuh. Percobaan berikutnya dengan key sama langsung memperlakukannya sebagai retryable dan menimpa record; jika penulisan status `failed` sendiri gagal, catch fallback masih menghapus record. Guard “mutate harus sinkron” tidak mengubah atomicity beberapa filesystem write di dalam mutator.

### 17.4 Verifikasi re-review

Dilakukan pada Windows, Node `v24.19.0`, npm `11.17.0`:

| Pemeriksaan | Hasil |
|---|---|
| Targeted: `control-intent-draft`, `control-intent-ratify`, `mcp-tools`, `mcp-binding` | **4 file / 113 test PASS** |
| Full suite dengan `HOME`/`USERPROFILE` terisolasi | **53 file / 596 test PASS** |
| Smoke Stage C | PASS |
| Smoke Stage D | PASS |
| Typecheck `npx tsc --noEmit` | PASS |
| `git diff --check` sebelum pencatatan review | PASS; warning CRLF lama pada `src/commands/intent.ts` |
| Repro holder hidup berumur >10 menit | **FAIL terhadap mutual exclusion** — B memperoleh lock |
| Repro idempotency identity mismatch | **FAIL terhadap fail-closed scope validation** — record diterima |

### 17.5 Syarat re-review berikutnya

1. Jangan pernah mencuri lock dari PID yang terverifikasi hidup hanya karena umur; definisikan hasil liveness `alive/dead/unknown`, dan gunakan expiry hanya untuk `unknown` dengan ownership protocol yang tidak memungkinkan dua holder aktif.
2. Hilangkan race compare-then-unlink pada stale takeover atau tambahkan fencing yang benar-benar ditegakkan oleh setiap mutasi state, bukan hanya token ownership pada `release()`.
3. Validasi seluruh identity/status invariants record idempotency terhadap scope lookup dan fail-closed pada mismatch.
4. Tambahkan durable operation journal/reconciliation untuk membedakan not-started, partial, committed, dan audited; `pending`/`failed` tidak boleh langsung ditimpa tanpa rekonsiliasi evidence.
5. Tambahkan process-kill/failure-injection pada setiap write boundary serta test active-holder melewati absolute age dan dua stale-stealer bersamaan.
6. Buat audit success recoverable/durable bersama outcome operasi, bukan hanya stderr bila append gagal.

## 18. Tanggapan atas re-review Codex putaran 3 (2026-09-16)

Kedua temuan direproduksi independen dulu (skrip repro, dijalankan terhadap build putaran 2 sebelum kode ini diubah) sebelum diperbaiki — hasilnya identik dengan yang Anda laporkan.

### 18.1 C-R01 (PARTIAL/REOPEN, P0) — akar masalahnya benar: umur mengalahkan liveness

Reproduksi:
```
REPRO 1 — live holder stolen after age: {"firstPidStillAlive":true,"secondAcquiredWhileFirstActive":true}
```

Anda benar bahwa komentar putaran 2 ("umur hanya backstop ketika liveness tidak bisa diandalkan") tidak cocok dengan kode-nya sendiri — cabang `ageMs > LOCK_ABSOLUTE_STALE_MS` di `acquireProjectLock()` memang mengeksekusi "regardless of what the liveness check says", persis kutipan Anda.

**Perbaikan** — liveness dijadikan tiga-state (`alive`/`dead`/`unknown`) alih-alih boolean, dan urutan keputusannya diubah total:

- `alive` → **tidak pernah** dicuri, berapa pun umurnya. Ini sekarang aturan absolut dalam percabangan kode, bukan preferensi yang bisa dilewati cabang lain.
- `dead` → dicuri segera, berapa pun umurnya (proses mati tidak menjadi "lebih mati" karena menunggu).
- `unknown` (pid tidak tercatat, atau errno dari signal-0 yang tidak dikenali) → **satu-satunya** kasus yang jatuh ke backstop umur 10 menit.

**Keterbatasan yang dinyatakan**: skenario PID-reuse (proses mati, PID-nya dipakai ulang proses lain yang masih hidup, sebelum siapa pun mengecek) akan membuat lock tersangkut permanen sampai operator menghapus `Sigma/.mcp-control/lock` secara manual setelah memastikan PID yang tercatat bukan `sigma-control` yang sah. Ini keputusan sadar: auto-recovery diam-diam atas sesuatu yang *terlihat* hidup adalah persis bug yang baru diperbaiki dua kali; untuk sistem governance, macet-dengan-pemulihan-manual-oleh-operator lebih aman daripada sembuh-sendiri-diam-diam-berdasarkan-timer.

TOCTOU pada compare-then-unlink (poin re-review #2) — **tidak saya hilangkan sepenuhnya**, karena Node tidak punya primitive compare-and-delete atomic tanpa dependency baru (`flock`/`proper-lockfile`). Window itu sekarang hanya terbuka untuk lock yang **sudah terbukti independen sebagai `dead`**, tidak pernah untuk yang `alive` — bukan penghilangan race, tapi penyempitan cakupannya ke kasus yang jauh lebih sempit dari sebelumnya. Dinyatakan eksplisit, bukan diklaim selesai.

**Bukti**: dua test baru di `test/control-intent-ratify.test.ts` — (1) PID hidup (proses test ini sendiri) dengan `acquired_at` dipalsukan 1 jam lalu → tetap tidak bisa dicuri; (2) PID mati (999999) dengan `acquired_at` baru saja → dicuri dalam <5 detik, membuktikan liveness yang mendorong pencurian, bukan umur, di kedua arah. **Mutation-check**: cabang `unknown`-only diubah agar `alive` juga jatuh ke backstop umur (mereplikasi bug asli) → test pertama gagal persis dengan pesan reproduksi asli; dikembalikan, `diff` byte-identical.

### 18.2 C-R03 (PARTIAL, P1) — identity/invariant validation

Reproduksi:
```
REPRO 2 — cross-scope record accepted at the correct-scope path: {"threw":false,"result":{"project_id":"FOREIGN",...}}
```

**Perbaikan**: `readIdempotencyRecord()` menambah parameter `projectId` dan sekarang memvalidasi dua lapis tambahan setelah shape valid:

1. **`matchesLookupScope()`** — `project_id`/`operation_id`/`bound_role`/`idempotency_key` di dalam record harus **sama persis** dengan parameter yang dipakai untuk mencari record itu (path hash-nya diturunkan dari tiga field terakhir, tapi kesamaan path tidak pernah dianggap sebagai bukti kesamaan isi lagi).
2. **`hasConsistentStatusInvariants()`** — `pending` harus `committed_at:null` dan `error:null`; `completed` harus `committed_at` valid dan `error:null`; `failed` harus `committed_at` valid dan `error` non-kosong. Kombinasi yang tidak sesuai pola ini ditolak.

Ketidakcocokan pada salah satu lapis → `throw`, sama seperti record yang gagal parse — bukan `null` (bukan "dianggap tidak ada").

**Bukti**: dua test baru mereproduksi persis skenario "cross-scope record" dan "completed tapi committed_at null" Anda. **Mutation-check**: guard `matchesLookupScope` dimatikan → test cross-scope gagal ("expected function to throw"); dikembalikan.

### 18.3 Yang TIDAK saya klaim selesai (C-R02, dan sisa C-R01 poin 2/4/5/6 sesuai penilaian Anda)

Tidak berubah dari putaran 2: journal/rollback penuh untuk partial write di dalam satu `mutate()`, process-kill failure-injection nyata di setiap write boundary, dan audit yang benar-benar durable (bukan best-effort-ke-stderr) semuanya **tetap terbuka**. Saya tidak mencoba menutupnya dengan klaim parsial pada putaran ini — dua perbaikan di atas (§18.1, §18.2) adalah lingkup penuh perubahan kode putaran ini.

### 18.4 Verifikasi ulang

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` | Bersih |
| `npm test` (full suite) | **53 file / 600 test PASS** |
| `test/control-intent-draft.test.ts` | 23/23 PASS |
| `test/control-intent-ratify.test.ts` | 32/32 PASS (dari 28 — +4: liveness alive/dead, identity-scope, status-invariant) |
| Smoke Stage C & D | PASS seluruh kasus |
| Mutation-check | Guard liveness-tri-state dan guard identity-scope keduanya diverifikasi menggigit |
| `git diff --check` | Bersih |

### 18.5 Status gate

**Masih tidak saya nyatakan PASS.** C-R01 dan C-R03 saya anggap tertutup sekarang dengan standar bukti yang sama (reproduksi independen → perbaikan → mutation-check) yang dipakai konsisten sejak R-01/R-10 Batch 1. C-R02 tetap terbuka sepenuhnya — tidak ada perubahan pada bagian itu di putaran ini. Keputusan akhir tetap pada Anda/Director.

## 19. Re-review Codex putaran 4 atas tanggapan implementer (2026-09-16)

### 19.1 Putusan

Gate C tetap **HOLD / belum PASS**. Implementasi tri-state menutup kasus spesifik holder ber-PID hidup yang dicuri hanya karena umur, dan validasi identity/status record idempotency menutup C-R03. Namun C-R01 sebagai finding mutual exclusion belum dapat diberi status FIXED karena jalur stale takeover masih mempunyai race yang diakui implementer dan dapat menghasilkan dua holder aktif.

| ID | Status re-review | Alasan |
|---|---|---|
| C-R01 | **PARTIAL / REOPEN — P0** | `alive` kini tidak pernah dicuri karena umur; `dead` dicuri segera; `unknown` memakai backstop. Sub-finding putaran 3 ini **CLOSED**. Tetapi stale takeover masih `read → recheck lock_id → unlink(path) → create`; replacement lock dapat muncul setelah recheck dan ikut terhapus. Token tidak ditegakkan pada mutasi governance, sehingga ini belum resource fencing. |
| C-R02 | **OPEN — P0** | Tidak berubah: belum ada journal/reconciliation untuk outcome not-started/partial/committed/audited dan belum ada process-death injection pada write boundaries. |
| C-R03 | **CLOSED** | Reader kini memvalidasi field identity terhadap parameter lookup serta kombinasi `status`/`committed_at`/`error`; mismatch dan invariant corruption throw/fail-closed. Regression tests dan mutation-check relevan tersedia. |
| C-R04 | **PARTIAL — P1** | Tidak berubah: revision-after berada di dalam lock, tetapi audit append masih best-effort dan bukan bagian outcome durable/recoverable. |

### 19.2 Verifikasi tri-state dan C-R03

Inspeksi source mengonfirmasi percabangan eksplisit:

- `alive` tidak memasuki cabang steal;
- `dead` langsung eligible untuk takeover;
- hanya `unknown` yang dievaluasi terhadap `LOCK_ABSOLUTE_STALE_MS`.

Test dengan PID proses test yang hidup dan `acquired_at` satu jam lalu tidak memperoleh lock kedua selama holder pertama aktif. Test PID mati dengan timestamp baru berhasil takeover. Untuk idempotency, record lintas-project/operation/role/key dan record `completed` tanpa `committed_at` kini ditolak. Dengan demikian dua perbaikan konkret yang dilaporkan implementer dapat direproduksi.

### 19.3 Reproduksi deterministik residual stale-takeover race

Reviewer menginstrumentasi urutan syscall lokal pada window setelah stealer A membaca ulang record lama tetapi sebelum A menjalankan `unlink(path)`. Pada window itu stealer B menghapus record mati dan menerbitkan record lock baru dengan PID hidup; A kemudian tetap menghapus path yang kini berisi lock B dan berhasil membuat lock berikutnya.

Hasil aktual:

```json
{
  "replacementWasPublished": true,
  "replacementPidWasAlive": true,
  "replacementSurvived": false,
  "laterStealerAcquired": true
}
```

Ini bukan kasus umur mengalahkan `alive`; tri-state bekerja. Ini race berbeda pada operasi compare-and-delete yang tidak atomik. Karena holder B dapat menganggap dirinya memperoleh lock sementara path-nya sudah dihapus dan diganti holder A, mutual exclusion masih dapat pecah. Keterangan §18.1 yang mengakui TOCTOU akurat, tetapi pengakuan residual P0 tersebut tidak konsisten dengan klaim §18.5 bahwa C-R01 seluruhnya FIXED.

### 19.4 Verifikasi re-review

Dilakukan pada Windows, Node `v24.19.0`, npm `11.17.0`:

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` | PASS |
| Targeted: `control-intent-draft`, `control-intent-ratify`, `mcp-tools`, `mcp-binding` | **4 file / 117 test PASS** |
| Full suite dengan `HOME`/`USERPROFILE` terisolasi | **53 file / 600 test PASS** |
| Smoke Stage C | PASS |
| Smoke Stage D | PASS |
| Tri-state live/dead regression tests | PASS |
| Identity/status-invariant regression tests | PASS |
| Residual takeover interleaving | **FAIL terhadap mutual exclusion** — replacement lock holder hidup terhapus |

### 19.5 Syarat re-review berikutnya

1. Ganti stale takeover dengan primitive/protocol yang tidak memakai compare-then-unlink path bersama secara non-atomik, atau gunakan library/OS lock yang menjamin ownership.
2. Jika tetap memakai fencing token, setiap governance write harus menolak holder dengan token/epoch lama; ownership-safe `release()` saja bukan resource fencing.
3. Tambahkan regression test dua stale-stealer pada lock mati yang membuktikan replacement lock tidak dapat dihapus pesaing.
4. Tutup C-R02 dan C-R04 melalui durable journal/reconciliation, process-death injection, dan audit outcome yang recoverable.

## 20. Pengambilalihan implementasi oleh Codex setelah re-review putaran 4 (2026-09-16)

Director meminta Codex mengambil alih eksekusi dua masalah mayor yang terus tersisa setelah empat putaran. Bagian ini mencatat perubahan kode aktual dan bukti verifikasinya. Catatan review pada Bagian 19 dipertahankan sebagai baseline sebelum perbaikan; bagian ini tidak menghapus jejak tersebut dan tidak menaikkan Gate C secara sepihak.

### 20.1 C-R01 - protocol lock tanpa shared-path takeover

Implementasi lockfile tunggal beserta alur read-recheck-unlink dihapus. `acquireProjectLock()` sekarang memakai directory claim dan protocol Lamport bakery:

- setiap contender membuat file claim unik `claim-<pid>-<uuid>.json` dengan exclusive create;
- fase `choosing` kemudian `waiting` menerbitkan ticket Lamport; urutan ditentukan oleh pasangan ticket dan UUID;
- tidak ada lagi path lock bersama yang dihapus dan diterbitkan ulang oleh contender berbeda;
- cleanup hanya dapat menghapus path claim unik yang baru saja diperiksa sebagai milik PID mati; path tersebut tidak pernah menjadi claim holder pengganti;
- claim PID hidup, liveness unknown, atau record yang tidak dapat dibuktikan aman tetap memblokir secara fail-closed;
- file lock format lama pada lokasi yang sama ditolak dengan pesan migrasi operasional, bukan dicuri otomatis.

Dengan protocol ini, residual interleaving pada Bagian 19.3 tidak lagi mempunyai operasi shared-path compare-then-unlink. Karena ownership direpresentasikan oleh claim path unik, fencing write terhadap satu token global tidak diperlukan untuk mencegah replacement holder dihapus.

Bukti regresi di `test/control-intent-ratify.test.ts` mencakup serialisasi contender dalam proses yang sama, cleanup claim PID mati, dan tiga contender serentak dengan nilai maksimum satu critical section aktif. Test lintas-proses Stage C tetap membuktikan dua proses `sigma-control` tidak menghasilkan torn write atau dua pemenang stale-state.

### 20.2 C-R02 - durable transaction journal dan deterministic recovery

`respondControlWrite()` sekarang mewajibkan `transactionFiles`; caller tidak dapat lagi memakai wrapper write tanpa mendeklarasikan seluruh file yang mungkin berubah. Sebelum mutasi dimulai, `beginControlTransaction()` menyimpan journal dan before-image exact untuk setiap file. Status journal yang dipersistenkan adalah `prepared`, `rollback_pending`, `commit_pending`, `rolled_back`, dan `completed`.

Recovery selalu dijalankan setelah project lock diperoleh dan sebelum idempotency/precondition diperiksa:

- `prepared` atau `rollback_pending`: before-image dikembalikan, idempotency menjadi `failed`, audit rollback dipersistenkan, lalu journal menjadi `rolled_back`;
- `commit_pending`: hasil dan revision-after dari journal dipakai untuk menuntaskan idempotency `completed`, audit commit dipersistenkan, lalu journal menjadi `completed`;
- journal terminal dapat diproses ulang secara idempoten untuk memperbaiki projection audit yang hilang.

Daftar before-image Stage C mencakup artifact intent, chain baru, `activate_status.json`, dan `intent-history.md` untuk create; update artifact mencakup artifact target. Tool prepare Stage D juga menentukan ticket ID sebelum transaksi sehingga ticket path ikut terdaftar. Bare idempotency `pending` tanpa journal yang valid tetap fail-closed; outcome tidak ditebak dan mutasi tidak dijalankan ulang.

### 20.3 C-R04 - audit outcome durable

Audit canonical sekarang disimpan per correlation ID di `Sigma/.mcp-control/audit-entries/` dengan atomic temp-plus-rename. `audit.jsonl` menjadi projection yang dibangun ulang secara atomic dari entry canonical. Import JSONL lama dilakukan satu kali melalui marker migrasi.

Commit dan rollback audit merupakan bagian dari recovery journal. Crash setelah governance write tetapi sebelum append JSONL tidak lagi menghilangkan outcome: proses berikutnya menyelesaikan entry canonical dan projection. Audit best-effort hanya tersisa untuk denial yang terjadi sebelum transaction journal dapat dibuat; successful mutation, rollback, dan idempotent replay memakai jalur durable/fail-closed.

### 20.4 Process-death injection Stage C

Test menjalankan proses `sigma-control` sungguhan, menghentikannya pada failpoint, lalu memakai proses baru dengan idempotency key yang sama. Seluruh boundary berikut diuji: `after_journal_prepared`, `after_idempotency_pending`, `create_after_artifact`, `create_after_chain`, `create_after_activate`, `create_after_history`, `after_mutation_before_commit_marker`, `after_commit_marker`, `after_commit_idempotency`, dan `after_commit_audit`.

Untuk setiap boundary, retry menghasilkan tepat satu chain `v1`, bukan partial chain dan bukan duplikasi. Boundary sebelum commit marker direkonsiliasi dengan rollback lalu retry; boundary setelah commit marker diselesaikan dengan roll-forward lalu idempotent replay.

### 20.5 Verifikasi final implementer

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` | PASS |
| `npx tsc --noEmit` | PASS |
| Empat suite control/MCP terkait | **4 file / 132 test PASS** |
| Full suite dengan HOME dan USERPROFILE terisolasi | **53 file / 615 test PASS** |
| Stage C runtime smoke | **ALL CHECKS PASSED** |
| Stage D runtime smoke | **ALL CHECKS PASSED** |
| Process-death Stage C | **10 boundary PASS** |
| `git diff --check` | PASS |

### 20.6 Disposisi implementer

| ID | Status implementasi | Dasar |
|---|---|---|
| C-R01 | **IMPLEMENTED - siap re-review** | Shared-path takeover dihapus; unique-claim bakery protocol dan regression concurrency tersedia. |
| C-R02 | **IMPLEMENTED - siap re-review** | Before-image journal, rollback/roll-forward recovery, idempotency reconciliation, dan process-death injection tersedia. |
| C-R03 | **Tetap CLOSED** | Validasi scope dan status invariant tidak diubah. |
| C-R04 | **IMPLEMENTED - siap re-review** | Commit/rollback audit canonical durable dan projection repair menjadi bagian recovery. |

**Gate C tetap HOLD.** Bagian ini adalah laporan implementasi, bukan review independen. Gate hanya dapat dinaikkan setelah reviewer memverifikasi protocol, recovery, dan bukti process-death di atas.

## 21. Re-review independen (Claude / Sonnet 5, 2026-09-16) atas pengambilalihan implementasi Codex (Bagian 20)

Dilakukan atas permintaan Director, terpisah dari lima putaran review Codex (§13–§19). Metodologi: source code dibaca langsung (bukan hanya laporan implementer), build dan test suite dijalankan ulang secara independen, dan dua skrip reproduksi tambahan ditulis di luar suite resmi untuk menguji primitive `acquireProjectLock()` secara terisolasi dari seluruh stack MCP.

### 21.1 Putusan

Gate C tetap **HOLD / belum PASS**. Disposisi Codex "C-R01: IMPLEMENTED — siap re-review" (§20.6) **tidak dapat dikonfirmasi**. Ditemukan **P0 baru** yang lolos dari seluruh empat putaran review sebelumnya: protokol bakery pada §20.1 terbukti aman terhadap stale-takeover (fokus seluruh review sebelumnya), tetapi tidak aman terhadap dua kontender **baru** yang datang bersamaan tanpa lock basi sama sekali.

### 21.2 Metodologi dan bukti verifikasi

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` | Bersih |
| Full suite (`HOME`/`USERPROFILE` terisolasi), satu run | **53 file / 615 test PASS** — klaim §20.5 reproducible pada run tunggal |
| `test/control-intent-ratify.test.ts`, "two independent sigma-control processes racing to commit the same ticket+approval", diulang 18× berturut-turut | **4 gagal (~22%)** — non-deterministik |
| Repro independen langsung terhadap `acquireProjectLock()` (dieksekusi dari `dist/engine/controlStore.js`, dua proses Node asli, di luar seluruh MCP stack), 160 trial | Concurrent-entry violation teramati langsung (§21.3) |

### 21.3 Root cause: bakery algorithm dengan slot dinamis

`acquireProjectLock()` mengadaptasi Lamport's Bakery Algorithm, yang secara matematis mengasumsikan himpunan peserta **tetap** — N slot yang selalu ada sejak awal (default `choosing:false, number:0` untuk peserta yang belum berkompetisi). Jaminan keamanannya bergantung mutlak pada asumsi ini: setiap peserta, dalam loop pembandingnya, selalu bisa memeriksa slot peserta lain, bahkan yang belum mulai — peserta yang belum ikut lomba direpresentasikan sebagai slot yang aman (`number=0`), bukan sebagai ketiadaan yang tidak bisa diperiksa.

Implementasi §20.1 membuat "slot" secara **dinamis** — file klaim baru ada di disk setelah `fs.openSync(claimPath, 'wx')` dipanggil. Jika dua proses memulai `acquireProjectLock()` pada instan yang cukup berdekatan, loop pembanding milik keduanya dapat selesai membaca direktori **sebelum** file klaim pihak lain tercipta di disk — bukan kondisi "belum ikut lomba" yang aman (slot itu memang belum ada untuk diperiksa siapa pun), melainkan tabrakan nyata yang sama sekali tidak terdeteksi oleh kedua sisi.

Bukti konkret (skrip repro minimal terhadap primitive mentah, dua proses OS nyata, tanpa satu pun lock basi terlibat):

```
VIOLATION pid=19616
claim-16160-...json => {"pid":16160,"lock_id":"f7b3bcdd...","phase":"waiting","ticket":1,"acquired_at":"...684Z"}
claim-19616-...json => {"pid":19616,"lock_id":"afe4f523...","phase":"waiting","ticket":1,"acquired_at":"...684Z"}
```

Kedua klaim mendapat ticket sama (1) dan `acquired_at` identik hingga milidetik — keduanya menyimpulkan "tidak diblokir" tanpa pernah saling melihat pada saat pengambilan keputusan. Tie-break `lock_id` semestinya membuat `afe4f523...` (lebih kecil secara leksikografis) menang dan `f7b3bcdd...` menunggu — tetapi `f7b3bcdd...` sudah menyatakan dirinya "acquired" sebelum klaim lawan tercipta di disk untuk diperiksa.

### 21.4 Dampak pada test resmi dan pada tool lain

Ini menjelaskan kegagalan `test/control-intent-ratify.test.ts`'s "two independent sigma-control processes racing to commit the same ticket+approval" yang saya reproduksi berulang (§21.2): pemenang berhasil ratify; yang kalah gagal dengan **`INVALID_OPERATION`**, bukan `APPROVAL_MISMATCH` yang diasersikan test. Ini hanya mungkin terjadi jika proses kedua lolos `checkPreconditions` (melihat ticket/approval belum consumed) **setelah** proses pertama sudah mengubah chain — mustahil bila lock benar-benar menyerialkan seluruh critical section kedua proses.

Dampak nyata tertutupi secara kebetulan untuk `intent_ratify` oleh guard independen di `ratifyIntentDraft()` (`chain.intent.state !== 'DRAFT'`), yang menjadi defense-in-depth tidak disengaja: proses kedua gagal bersih, tidak terjadi double-ratify. **Guard setara pada `sigma_create_intent_draft`/`sigma_update_artifact_draft` belum saya verifikasi** — kedua tool ini memakai lock yang identik (`withControlLock`/`respondControlWrite`) dan karena itu mewarisi kerentanan yang sama; belum ada bukti bahwa dua proses yang sama-sama lolos precondition tidak akan menghasilkan dua chain versi yang sama secara konkuren atau saling menimpa pada `writeChain()`.

### 21.5 Kenapa lolos dari empat putaran review Codex

Seluruh temuan C-R01 pada putaran 1–4 (§13–§19) berfokus pada **stale-takeover** — pencurian lock dari holder yang sudah basi/mati. Race pada §21.3 sama sekali tidak melibatkan lock basi: kedua kontender adalah peserta **baru**, tidak ada satu pun klaim mati yang dicuri. Test "three simultaneous contenders" (§20.1) yang ditulis untuk menunjukkan mutual exclusion berjalan **dalam satu proses** (tiga coroutine `Promise.all`, PID sama) — ini tidak dapat menangkap race lintas-proses karena tidak merepresentasikan dua proses OS independen yang benar-benar mulai bersamaan. Satu-satunya test lintas-proses yang relevan ("two independent sigma-control processes racing...") memang mendeteksi masalah ini, tetapi hanya dijalankan **sekali** per `npm test` — flake rate ~22% yang saya ukur (§21.2) tidak pernah terjamin tertangkap oleh satu kali run "615/615 PASS".

### 21.6 Disposisi temuan (revisi atas §20.6)

| ID | Disposisi Codex (§20.6) | Disposisi independen (Claude, 2026-09-16) |
|---|---|---|
| C-R01 | IMPLEMENTED — siap re-review | **REOPEN — P0.** Race baru pada kontender-baru-bersamaan, tidak berkaitan dengan stale-takeover yang sudah diperbaiki di §20.1. Direproduksi berulang, di luar seluruh MCP stack, langsung terhadap primitive. |
| C-R02 | IMPLEMENTED — siap re-review | Desain journal (before-image, rollback/roll-forward, 10 boundary process-death) secara kode **benar** untuk skenario crash *setelah* lock diperoleh — diverifikasi menyeluruh, seluruh test terkait lulus saat dijalankan. Tetapi properti ini tidak bermakna bila lock itu sendiri bisa ditembus sebelum salah satu peserta memulai transaksinya — dua proses dapat sama-sama masuk dan menjalankan journal masing-masing secara paralel di atas file governance yang sama. |
| C-R03 | CLOSED | Tidak diperiksa ulang secara mendalam pada putaran ini; tidak ada indikasi regresi. |
| C-R04 | IMPLEMENTED — siap re-review | Desain audit durable (per-correlation-id, projection rebuild) terverifikasi konsisten pada pembacaan kode. Tidak ada temuan baru. |

### 21.7 Syarat re-review berikutnya

1. Ganti mekanisme unique-claim bakery dengan primitive yang tidak bergantung pada asumsi himpunan-peserta-tetap — opsi realistis: exclusive OS-level lock sungguhan (mis. dependency `proper-lockfile`, trade-off yang sebelumnya dihindari demi menghindari dependency baru, tetapi sekarang punya justifikasi konkret), atau tambahkan barrier/settle-delay wajib plus pemindaian ulang sebelum keputusan "acquired" difinalkan.
2. Tambahkan test race lintas-proses yang diulang berkali-kali (≥50×) sebagai syarat lulus, bukan satu kali jalan — flake rate rendah tidak boleh disamakan dengan aman.
3. Tulis test setara untuk `sigma_create_intent_draft`/`sigma_update_artifact_draft` guna memastikan tidak ada guard implisit yang hilang seperti yang kebetulan menyelamatkan `intent_ratify`.
4. Gate C tidak dapat dinaikkan sampai butir 1–3 selesai dan diverifikasi ulang.

### 21.8 Tanggapan Codex (2026-09-16) — konfirmasi independen dan rencana perbaikan

Codex mereproduksi temuan §21.3 secara independen, dengan sampel lebih besar dari yang saya jalankan:

| Sampel | Hasil |
|---|---|
| 12 run pertama | 12 PASS — flake tidak selalu muncul pada sampel kecil |
| 50 run berikutnya | **44 PASS, 6 FAIL** — 5 kegagalan menghasilkan `INVALID_OPERATION`, 1 menghasilkan `INTERNAL_ERROR`; tidak satu pun `APPROVAL_MISMATCH` yang diasersikan test |

Codex menarik klaim "C-R01/D-R01: IMPLEMENTED" (§20.6) dan menetapkan putusan objektif yang konsisten dengan §21.6: **C-R01/D-R01 REOPEN — P0**; **C-R02/D-R02** dicatat sebagai "journal/recovery secara lokal benar, tetapi jaminannya belum dapat diandalkan selama dua transaksi bisa masuk bersamaan" — pembingkaian yang lebih presisi daripada "tidak bermakna" pada §21.6, dan saya terima; **C-R04/D-R03** tetap terverifikasi. Gate C dan D tetap HOLD.

Codex menambahkan catatan teknis: root cause tidak boleh dikunci hanya pada framing "dynamic participant Bakery Algorithm" di §21.3 — transisi `choosing → waiting` pada `writeLockClaim()` juga memakai temp-plus-rename, sehingga ada kemungkinan celah visibility tambahan di luar sekadar "file klaim belum ada". Catatan independen: `rename()` ke path yang sudah ada bersifat atomik di level OS (POSIX maupun NTFS) — pembaca selalu melihat konten lama utuh atau konten baru utuh, tidak pernah "file hilang sementara". Root cause yang terukur di §21.3 spesifik terjadi pada fase **sebelum** itu (`fs.openSync(path,'wx')` awal belum tereksekusi sama sekali di sisi lawan). Ini nuansa, bukan perbedaan kesimpulan — keduanya mengarah ke solusi yang sama: protokol custom berbasis file tidak dapat diandalkan untuk exclusion yang wajib benar.

Codex secara eksplisit menolak *settle-delay* sebagai perbaikan karena hanya menurunkan probabilitas race, bukan menghilangkannya — dinilai konsisten dengan kebutuhan jaminan (bukan pengurangan risiko statistik) untuk sistem governance.

**Rencana perbaikan yang disepakati:**

1. Catat review independen dan reproduksi 44/50 Codex di Stage C §21 dan Stage D §19 (dokumen ini).
2. Ganti protokol custom dengan primitive lock lintas-proses matang — `proper-lockfile`, bukan menambah delay pada Bakery Algorithm.
3. Tambahkan stress test ≥50 iterasi untuk: raw lock (`acquireProjectLock`), `sigma_commit_intent_ratify`, `sigma_create_intent_draft`, dan `sigma_update_artifact_draft` — menutup gap §21.4 (guard setara pada create/update belum diverifikasi).
4. Jalankan ulang process-death recovery, full suite, dan smoke Stage C/D setelah penggantian primitive.
5. Catat hasil implementasi di kedua RESULT document. **Gate C dan D tetap HOLD sampai re-review independen berikutnya** — Codex tidak menetapkan hasil review atas implementasinya sendiri, konsisten dengan pola kerja sejak Stage C/D dimulai.

### 21.9 Koreksi teknis Codex — visibility gap `fs.moveSync(...,{overwrite:true})` terverifikasi ganda, dan temuan cakupan lebih luas

Codex mengoreksi §21.8's catatan "nuansa" saya soal atomicity `rename()`: `writeLockClaim()` memakai `fs.moveSync(tmpPath, claimPath, { overwrite: true })` dari fs-extra, dan implementasi aktual paket yang terpasang (`node_modules/fs-extra/lib/move/move-sync.js:28`) menjalankan `removeSync(dest)` **lalu** `rename(src, dest)` saat `overwrite:true` — bukan atomic replace tunggal. Klaim saya bahwa "rename ke path yang sudah ada bersifat atomik" salah untuk idiom yang benar-benar dipakai kode ini (idiom itu sendiri secara sengaja menghindari raw atomic rename OS demi alasan lain di fs-extra, dengan konsekuensi correctness yang tidak disadari di sini).

**Verifikasi independen ganda**, dilakukan sebelum menerima koreksi:

1. Membaca `move-sync.js` langsung — persis seperti dikutip Codex.
2. Reproduksi empiris dua proses OS nyata (satu menulis lewat idiom identik `fs.moveSync(tmp, dest, {overwrite:true})`, satu lagi membaca `fs.existsSync(dest)` dalam busy-loop 4 detik):
   ```
   {"reads":157532,"misses":86975}
   ```
   **~55% pembacaan melihat file target hilang total** selama kontensi tulis — bukan celah mikro-detik yang langka, melainkan kondisi yang sangat mudah terpicu.

**Temuan cakupan lebih luas (baru, di luar C-R01/D-R01)**: idiom `fs.moveSync(tmp, dest, {overwrite:true})` yang sama dipakai bukan hanya `writeLockClaim()`/`writeJsonAtomic()` di `controlStore.ts`, tetapi juga **`writeChain()`** (`src/engine/chain.ts:511-517`) dan **`writeActivateStatus()`** (`src/engine/chain.ts:352-357`) — inti governance engine yang mendahului Stage C/D, dan yang klaim "sudah atomic tmp+rename"-nya sudah dijadikan invarian sejak Batch 1 (plan §11.5). Ini berarti `Sigma/progress-vN.json` dan `Sigma/activate_status.json` sendiri berpotensi terlihat hilang total oleh pembaca mana pun (query-mode MCP server, CLI, proses control lain) selama jendela tulis — bukan hanya lock control-plane.

**Keputusan cakupan Director (2026-09-16)**: perbaikan saat ini **dibatasi ke lock control-plane** (rencana §21.8, butir 1–5). Temuan `writeChain()`/`writeActivateStatus()` **dicatat sebagai finding terpisah, di luar cakupan remediation P0 yang sedang berjalan** — `chain.ts` dipakai seluruh CLI, bukan hanya MCP, sehingga perubahan di sana punya blast radius lebih luas dan memerlukan otorisasi/plan tersendiri, bukan digabung ke remediation lock ini. Perbaikan sederhana yang tersedia bila/ketika finding ini diotorisasi: ganti `fs.moveSync(tmp, dest, {overwrite:true})` dengan `fs.renameSync(tmp, dest)` langsung (atomic replace asli di level OS, pada POSIX maupun Windows, untuk tmp file di direktori/filesystem yang sama) — tidak memerlukan dependency baru.

**Status Codex, dikonfirmasi**: proses dengan rencana §21.8 (`proper-lockfile` untuk lock control-plane + stress test ≥50 iterasi mencakup raw lock, `sigma_commit_intent_ratify`, `sigma_create_intent_draft`, `sigma_update_artifact_draft`). Gate C dan D tetap HOLD sampai re-review independen berikutnya.

## 22. Implementasi Codex putaran terakhir setelah kesepakatan dengan Claude (2026-09-16)

Director menyetujui Codex sebagai implementer dan Claude sebagai reviewer independen. Claude menerima `proper-lockfile` dengan syarat pengukuran durasi keempat mutasi serta ownership check sinkron. Bagian ini laporan implementasi, bukan putusan review. Finding `chain.ts` pada §21.9 tetap di luar cakupan sesuai keputusan Director.

### 22.1 Primitive dan batas klaim

Protocol unique-claim/Bakery di `src/engine/controlStore.ts` dihapus. `acquireProjectLock()` memakai `proper-lockfile@4.1.2` (`@types/proper-lockfile@4.1.4`) pada `Sigma/.mcp-control/project-write.lock`, `realpath:false`, `stale=5.000 ms`, `update=1.000 ms`, retry 100 kali pada interval 100 ms. Admission memakai atomic `mkdir`; ini **filesystem mtime lease dengan heartbeat, bukan kernel-held mutex**. `onCompromised` fatal/fail-closed. Path protocol lama `Sigma/.mcp-control/lock` menyebabkan write ditolak sampai operator menghentikan semua proses versi lama dan menghapus path lama secara aman; tidak ada mixed-protocol takeover.

`assertOwned()` sinkron membandingkan identitas direktori lease (`dev`, `ino`, `birthtimeMs`) dan status lease. Wrapper memeriksanya setelah acquire, sesudah recovery, sebelum `mutate()`, dan sesudahnya sebelum commit marker. Release ditunggu async. Ini pemeriksaan defensif, **bukan fencing kernel** terhadap seluruh filesystem write.

### 22.2 Durasi `mutate()` aktual

Wrapper mencatat durasi monotonic per tool dan menegakkan budget **250 ms** (melebihi budget menghasilkan rollback tanpa commit marker). Satu test end-to-end pada fixture yang sama mengukur keempat tool. Run full suite menghasilkan:

| Tool | `mutate()` aktual | Budget | Heartbeat |
|---|---:|---:|---:|
| create intent draft | 13,2903 ms | 250 ms | 1.000 ms |
| update artifact draft | 9,0786 ms | 250 ms | 1.000 ms |
| prepare intent ratify | 12,8054 ms | 250 ms | 1.000 ms |
| commit intent ratify | 19,2935 ms | 250 ms | 1.000 ms |

Angka tersebut bukti lingkungan uji, bukan batas matematis semua mesin. Guard durasi diperiksa **setelah** fungsi sinkron kembali; bila host/IO berhenti lebih dari `stale=5.000 ms` di tengah mutasi, heartbeat event loop juga berhenti. Lease bukan jaminan absolut terhadap pause ekstrem atau penghapusan manual lock. Reviewer harus menilai residual risk ini eksplisit.

### 22.3 Acceptance dan verifikasi

| Pemeriksaan | Hasil |
|---|---|
| Raw lock, dua proses OS dibarrier dengan exclusive guard | **100/100 trial PASS; 0 concurrent entry** (`evidence/stageCD-lock-stress.mjs`) |
| Ratify race, dua proses | **50/50 PASS**, loser `APPROVAL_MISMATCH` |
| Create race, dua key dan revision sama | **50/50 PASS**, loser `STALE_STATE` |
| Update race, dua konten dan hash awal sama | **50/50 PASS**, loser `STALE_ARTIFACT` |
| Live holder melewati dua heartbeat interval | PASS; contender kedua menunggu sampai release |
| Real process-death Stage C, 10 boundary | PASS; journal pulih setelah stale lease |
| Build dan typecheck | PASS |
| Full suite final, HOME shell tidak diubah | **53 file / 618 test PASS** |
| Runtime smoke C dan D | **ALL CHECKS PASSED** masing-masing |
| `git diff --check` | PASS (warning line-ending lama, tanpa whitespace error) |

Shell run dengan HOME terisolasi ditolak kebijakan eksekusi; tidak dicoba workaround. Fixture test dan smoke script tetap membuat isolasi proyek/HOME sendiri. `npm install` melaporkan 11 advisory pada dependency tree keseluruhan (5 moderate, 5 high, 1 critical); belum ditriase di scope lock dan tidak diklaim berasal dari dependency baru.

### 22.4 Disposisi implementer

C-R01 **IMPLEMENTED, siap re-review independen**; C-R02 dan C-R04 **siap re-review ulang** sesudah stress dan process-death regression dengan lease baru. **Gate C tetap HOLD** sampai Claude memeriksa kode dan bukti secara independen. Temuan `chain.ts` §21.9 tetap finding terpisah, bukan bagian perbaikan ini.

## 23. Re-review final independen (Claude / Sonnet 5, 2026-09-16) — putusan Gate C

### 23.1 Putusan

**Gate C: PASS.** Ini putusan final untuk finding lock lintas-proses (C-R01/C-R02/C-R04) yang membuka seluruh rangkaian review sejak §13. Verifikasi tidak dibatasi pada menjalankan ulang test resmi Codex — saya menulis serangan adversarial independen terhadap primitive baru, termasuk kelas serangan yang PERSIS menjadi basis P0 sebelumnya (fresh-contention, di luar seluruh MCP stack), pada skala yang setara atau lebih besar dari yang menemukan bug asli.

### 23.2 Verifikasi independen (bukan re-run klaim implementer)

| Uji, ditulis dan dijalankan sendiri | Hasil |
|---|---|
| `npm run build` + `npx tsc --noEmit` | Bersih |
| 150 trial fresh-contention pada `acquireProjectLock()` mentah, dua proses OS nyata, di luar seluruh MCP stack (kelas serangan yang sama yang menemukan C-R01 asli) | **0 concurrent-entry, 0 error** |
| 20× ulang test resmi `test/control-intent-ratify.test.ts` — race commit-ratify lintas-proses (sebelumnya terukur ~22% gagal, §21.2) | **0/20 gagal** |
| 15× ulang test resmi `test/control-intent-draft.test.ts` — race create-intent lintas-proses | **0/15 gagal** |
| Live holder bertahan 6,5 detik (melebihi satu `stale` interval penuh, enam siklus heartbeat) sementara kontender menunggu | Tidak dicuri; kontender baru mendapat lock ~65ms setelah holder rilis, bukan sebelumnya |
| Dead-holder takeover — holder di-`SIGKILL` mid-hold, dua kontender baru menunggu bersamaan | Keduanya menunggu penuh interval `stale` (~5,7–5,8 detik) lalu terserialisasi benar; tidak ada double-acquire |
| Tampering eksternal mid-hold — proses lain menghapus dan membuat ulang direktori lease persis saat holder legitimate masih memegangnya, sebelum `onCompromised` async sempat terpanggil | `assertOwned()` (perbandingan identitas `dev`/`ino`/`birthtimeMs`) mendeteksi dan melempar `"Sigma control project lock ownership changed while held."` — defense-in-depth yang bekerja independen dari timer heartbeat |
| Full suite, satu run | **53 file / 618 test PASS** — cocok dengan klaim §22.3 |
| `git diff --check` | Bersih (hanya warning CRLF lama, tidak baru) |
| `npm audit` | 11 advisory seluruhnya berasal dari rantai dev-dependency testing (`vitest`, `vite`, `esbuild`, `hono`, `qs`, `nanoid`, dst) — **nol** yang menyentuh `proper-lockfile` atau dependency transitifnya. Klaim §22.3 bahwa advisory ini tidak berasal dari dependency baru terkonfirmasi, bukan hanya diasumsikan. |

### 23.3 Kenapa ini menutup C-R01 secara struktural, bukan probabilistik

Root cause asli (§21.3): protokol bakery custom membuat "slot" secara dinamis, sehingga dua kontender baru bisa saling tidak terlihat pada window sub-milidetik. `proper-lockfile` menghilangkan window itu secara struktural — admission memakai **satu** `mkdir` atomik pada path tetap yang dibagi bersama; tidak ada langkah "baca state lalu hitung tiket" yang bisa direduksi jadi race. Ini konsisten dengan hasil 150/150 trial tanpa satu pun pelanggaran, dibandingkan ~1 dari 5–8 percobaan pada implementasi lama.

### 23.4 Residual risk yang diterima secara eksplisit, bukan disembunyikan

`proper-lockfile` adalah **filesystem mtime-lease dengan heartbeat, bukan kernel-held mutex** — karakterisasi Codex saya terima apa adanya. Risiko yang tersisa: bila host/IO berhenti lebih lama dari `stale=5.000 ms` **di tengah** `mutate()` yang sedang berjalan (event loop yang sama yang menjalankan heartbeat juga berhenti selama itu), lock secara teoritis bisa dianggap basi oleh proses lain sebelum `assertOwned()` sempat memeriksa ulang setelah mutasi. Ini kelas risiko yang jauh berbeda dari P0 asli:
- P0 asli: reproducible pada kondisi normal, tidak memerlukan kegagalan sistem apa pun (~1 dari 5–8 percobaan pada beban kerja biasa).
- Residual ini: memerlukan pause host/IO ekstrem (>5 detik) tepat di tengah operasi yang secara terukur selesai dalam <20ms (§22.2) — probabilitas jauh lebih rendah, dan budget 250ms + pemeriksaan `assertOwned()` sinkron sebelum/sesudah `mutate()` (§22.1, diverifikasi langsung di kode §-nya) meminimalkan window lebih lanjut tanpa mengklaim menghilangkannya.

Saya terima ini sebagai residual risk yang terdokumentasi, bukan sebagai alasan menahan gate — ini pola yang sama dengan TOCTOU narrow-not-eliminate yang sudah diterima di `artifactPath.ts` sejak Batch 1 (R-01).

### 23.5 Disposisi final

| ID | Disposisi final |
|---|---|
| C-R01 | **CLOSED.** Ditutup dengan reproduksi-lalu-perbaikan-lalu-verifikasi-independen yang lebih ketat dari standar R-01/R-10 Batch 1 — termasuk serangan yang tidak diminta eksplisit oleh acceptance contract (tampering eksternal mid-hold). |
| C-R02 | **CLOSED** untuk exactly-once/recovery pada boundary yang diuji (journal before-image, rollback/roll-forward, 10 boundary process-death) — semuanya lulus di atas primitive lock yang baru. |
| C-R03 | **CLOSED** (tidak berubah sejak §18.2/§19). |
| C-R04 | **CLOSED** untuk audit durable (per-correlation-id, projection rebuild, journal-driven commit/rollback). |

Temuan `writeChain()`/`writeActivateStatus()` (`fs.moveSync(...,{overwrite:true})` non-atomic, §21.9) **tetap terbuka, terpisah, di luar cakupan Gate C** — bukan syarat gate ini, sesuai keputusan Director. Direkomendasikan menjadi item plan tersendiri sebelum Stage E memperluas primitive baru yang bergantung pada asumsi "atomic write" di `chain.ts`.

**Gate C: PASS**, dengan residual risk §23.4 dan finding terpisah di atas dicatat eksplisit untuk keputusan Director tentang langkah berikutnya (Stage E, atau plan perbaikan `chain.ts`).
