# RESULT-IMPL â€” Stage E W1 pilot: `sigma_create_exec_draft`

**Tanggal**: 2026-09-16
**Sumber**: `PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` Â§14 Stage E, menyusul `RESULT-IMPL-SIGMA-MCP-STAGE-E-PLAN-DRAFT-20260916.md`.
**Perintah Director**: lanjutkan Stage E ke primitive berikutnya, dengan pengingat eksplisit bahwa `sigma_send_message`/`sigma_write_memo` **tidak** masuk rotasi ini (sempat dibangun lalu di-revert Director setelah review Codex menemukan masalah role-mismatch/oracle/filename-derivation â€” butuh desain ulang terpisah). Primitive dipilih: **`sigma_create_exec_draft`** â€” analog langsung `sigma_create_plan_draft`, logis menyusul karena bergantung pada PLAN LOCKED.
**Peran implementer**: Claude Code sebagai implementator; Codex sebagai reviewer independen berikutnya. Dokumen ini **tidak** men-declare "Gate E PASS".
**Status**: Implementasi + test contract selesai, satu putaran self-review adversarial dilakukan. Menunggu review independen Codex.

## 1. Ringkasan

`sigma_create_exec_draft` adalah MCP control-plane equivalent dari `sigma exec new`. Dua perbedaan struktural dari `plan_draft` (dan dari `intent_draft`) mewarnai seluruh implementasi ini:

1. **Versi bukan counter independen.** `nextExecVersion(chain, planVersionRef)` (`src/engine/chain.ts`) selalu mengembalikan `planVersionRef` itu sendiri â€” DEV-EXEC selalu memakai persis versi FMN-PLAN yang direferensikan. Tidak ada `v0.1`, `v0.2`, dst. seperti plan_draft.
2. **Pemilihan target PLAN adalah business logic nyata**, bukan formalitas. Satu PLAN LOCKED hanya boleh punya satu exec non-final (PLAN-IMPL-MULTIDRAFT-LOCK Â§4) â€” bila `plan_version` diberikan, harus LOCKED dan belum punya exec terbuka (`EXEC CONFLICT` bila sudah); bila tidak diberikan, auto-resolve hanya sah bila tepat satu kandidat (nol kandidat atau kandidat ambigu keduanya ditolak).

## 2. File yang berubah

**Baru**:
- `src/services/execDraftService.ts` â€” `createExecDraft()`, `createExecDraftTransactionFiles()`, `ExecDraftError`, helper privat `resolveTargetPlan()` yang mem-porting logic pemilihan target dari `exec.ts` verbatim (dipakai baik oleh transactionFiles maupun mutate, supaya keduanya tidak pernah divergen â€” pola sama seperti `planDraftService.ts`).
- `src/mcp/control/tools/createExecDraft.ts` â€” registrasi tool, mirror `createPlanDraft.ts`.
- `test/control-exec-draft.test.ts` â€” 27 test.

**Diubah**:
- `src/commands/exec.ts` â€” `exec new` direfaktor memanggil `createExecDraft()`. Command `lock`/`humanize`/`check`/`status`/`list` tidak disentuh.
- `src/mcp/control/index.ts` â€” registrasi `sigma_create_exec_draft` (daftar tool control-plane: 5 â†’ 6).
- `test/control-intent-draft.test.ts` â€” daftar exact-match tool diperbarui (5 â†’ 6).
- `test/mcp-tools.test.ts` â€” `createExecDraft` ditambahkan ke guard defense-in-depth.
- `Implementation/sigma-mcp/SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md` â€” `exec_new`: "deferred Stage E" â†’ "implemented â€” Stage E W1 pilot".

## 3. Deviasi dan koreksi selama implementasi

1. **Regresi ditemukan dan diperbaiki sebelum diserahkan**: draf pertama service ini menyederhanakan tiga pesan error CLI (pemadatan multi-line menjadi satu baris, menghilangkan saran command spesifik seperti `sigma exec check --v <v>`/`sigma plan supersede --v <v>`). Ini memutus test existing `exec-concurrency.test.ts` (`"refuses a second exec for a plan that already has one open..."`, meng-assert `/sigma plan supersede --v v1\.1/` secara eksak). Diperbaiki dengan mengembalikan ketiga pesan (not-LOCKED, EXEC CONFLICT, zero-candidates, ambiguous-candidates) verbatim sama persis dengan `src/commands/exec.ts` sebelum refactor â€” bukan hanya kontennya, tapi format `\n`-nya juga, karena test lain (`exec-concurrency.test.ts`, 8 test) sudah membuktikan CLI lama mem-print format itu apa adanya. Pelajaran dari Stage E#1 (`plan_draft`) â€” di mana pemadatan pesan serupa aman karena tidak ada test yang meng-assert format eksak â€” **tidak otomatis berlaku di sini**; setiap porting pesan CLI ke service harus diverifikasi lewat test existing, bukan diasumsikan aman berdasarkan preseden primitive lain.
2. **Kode error untuk business-logic pemilihan target**: `GATE_BLOCKED` dipakai hanya untuk `gate_2_open` (tidak ada PLAN LOCKED sama sekali). Kasus lain (plan tidak LOCKED, EXEC CONFLICT, nol/ambigu kandidat) memakai `INVALID_OPERATION` â€” Gate 2 sendiri terbuka pada kasus-kasus itu, masalahnya ada di pemilihan target, bukan gate.
3. **Idempotency scope mencakup `plan_version`** (beda dari plan_draft yang argumentsForHash-nya cuma title/focus): `argumentsForHash: { plan_version: args.plan_version ?? null }` â€” eksplisit `null` untuk "omitted" supaya retry dengan `plan_version` beda (termasuk diberikan vs tidak) terdeteksi `IDEMPOTENCY_CONFLICT`, dibuktikan test khusus.
4. **Skema Zod untuk `plan_version`**: `z.string().regex(/^v\d+\.\d+$/).optional()` â€” format ketat "vN.N", tidak memakai `normalizeVersionArg()` (fleksibilitas CLI untuk mengetik "1.1" tanpa "v" tetap CLI-only, tidak diporting ke MCP karena caller mesin sebaiknya memakai format kanonik yang sudah didapat dari `sigma_get_state`, bukan format longgar untuk manusia).
5. **Tidak ada langkah render file ketiga** (beda dari plan_draft yang re-render ROADMAP) â€” exec_draft hanya menyentuh dokumen exec baru dan chain file, sehingga hanya dua failpoint spesifik (`exec_create_after_artifact`, `exec_create_after_chain`), bukan tiga.

## 4. Test dan evidence

**Baru**: `test/control-exec-draft.test.ts`, 27 test:

1. **Role dan gate boundary** (3 test) â€” no role, role FMN (bukan DEV), tidak ada PLAN LOCKED sama sekali (`GATE_BLOCKED`).
2. **Target-PLAN selection** (6 test) â€” auto-resolve sukses (kandidat tunggal), plan_version eksplisit bukan LOCKED, EXEC CONFLICT (plan_version eksplisit sudah punya exec), nol kandidat (semua plan LOCKED sudah dieksekusi), kandidat ambigu (>1, tanpa plan_version), plan_version eksplisit menyelesaikan ambiguitas secara deterministik â€” termasuk assert eksplisit bahwa versi exec yang dihasilkan **selalu identik** dengan versi plan yang direferensikan.
3. **Stale state** (1 test).
4. **Idempotency dan concurrency** (3 test) â€” replay, conflict pada `plan_version` berbeda, concurrent same-process.
5. **Crash-window safety** (2 test) â€” mutate() throw sinkron menyisakan record "failed", pending record tanpa journal fail closed.
6. **Transport-level** (2 test) â€” panggilan tool nyata via in-memory client (`version`/`planVersionRef` cocok), dan penolakan `plan_version` yang tidak match pola `vN.N` (`'../../etc/passwd'`) di level skema Zod â€” `isError:true`, tidak ada exec tercipta.
7. **Cross-process concurrency dan process-death recovery** (10 test) â€” dua proses nyata berebut idempotency key sama (tepat satu commit) dan key berbeda pada revision sama (tepat satu menang, `STALE_STATE`); `it.each` atas 8 failpoint (2 spesifik exec + 6 generik wrapper), proses di-`SIGKILL`, proses baru pulih deterministik ke tepat satu efek.

Test daftar-tool exact-match di `test/control-intent-draft.test.ts` diperbarui dari 5 menjadi 6 tool.

**Regresi**:
- `npm run build` â€” bersih.
- `npm test` â€” **56 file / 675 test PASS** (naik dari 55 file/648 test setelah Stage E#1; delta murni test baru file ini plus fix regresi Â§3.1, tidak ada test yang hilang).
- Test CLI existing yang menyentuh `exec new` (`exec-concurrency.test.ts` 8 test â€” termasuk assertion pesan EXEC CONFLICT eksak, `exec-version-parity.test.ts` 6 test, `exec-close-verdict-gates.test.ts` 11 test) tetap PASS setelah refactor, membuktikan parity CLI benar-benar terjaga byte-for-byte pada pesan yang sudah dites, bukan hanya "secara umum sama".

## 5. Self-review adversarial (satu putaran, sebelum serah terima ke Codex)

- **Role server-derived**: `allowedRoles: ['DEV']` dari `binding.role`, tidak ada field role di schema.
- **`project_root` tidak ada di schema tool baru** â€” dicakup test generik yang meloop semua tool control-plane.
- **Permukaan path-traversal**: `plan_version` divalidasi ketat di level Zod (`vN.N`) sebelum mencapai handler; bahkan bila lolos, hanya dipakai untuk lookup terhadap `chain.plan.versions`, tidak pernah jadi komponen path â€” dibuktikan dengan test input `'../../etc/passwd'` ditolak di level skema.
- **Transaction journal mencakup kedua file yang disentuh mutation** (dokumen exec baru, chain file) â€” dibuktikan 2 failpoint spesifik + 6 generik wrapper, seluruhnya pulih ke tepat satu efek setelah proses nyata di-`SIGKILL`.
- **`resolveTargetPlan()` dipanggil identik oleh `transactionFiles` dan `mutate`**, di bawah lock yang sama, tidak ada window untuk keduanya divergen (properti yang sama yang menjaga `plan_draft`'s `nextPlanVersion` tetap konsisten).
- **Fidelity pesan CLI**: setelah regresi Â§3.1 ditemukan dan diperbaiki, seluruh test CLI existing yang menyentuh pesan `exec new` (termasuk assertion command-suggestion spesifik) dijalankan ulang dan PASS â€” bukan diasumsikan aman.
- **Batas cakupan yang sama seperti Stage E#1**: kasus gate/target-selection dites di level service langsung (bukan lewat `respondControlWrite` penuh untuk setiap kode error), karena plumbing error-code passthrough sudah terbukti benar dari primitive sebelumnya. Kasus role dan stale-state dites lewat wrapper penuh. Konsisten dengan keputusan Director soal kedalaman review (implementasi + test contract + satu putaran self-review, bukan multi-round penuh).

## 6. Yang belum dikerjakan (sengaja, di luar cakupan putaran ini)

- Perluasan `sigma_update_artifact_draft` ke tipe plan/exec â€” item W1 lain, belum disentuh.
- `sigma_send_message`/`sigma_write_memo` â€” eksplisit di luar rotasi ini per pengingat Director, butuh desain ulang terpisah.
- Operasi roadmap â€” belum disentuh.
- Seluruh item W2 (governance transition selain `intent_ratify`) â€” belum tersentuh.
- W3 â€” tetap deferred permanen.

## 7. Status akhir

`git status` menunjukkan seluruh perubahan sebagai working-tree diff/untracked; tidak ada commit yang dibuat oleh implementer. Menunggu review Codex dan keputusan Director soal commit/lanjut ke primitive Stage E berikutnya.

## 8. Review teknis independen - 2026-09-16

**Status: PASS WITH DIRECTOR DECISION.** Tidak ditemukan defect implementasi pada `sigma_create_exec_draft` dari source dan test yang diperiksa. Build TypeScript selesai bersih; test control Stage E dan suite penuh selesai tanpa kegagalan yang terlapor. `git diff --check` tidak melaporkan error whitespace.

### Bukti yang diperiksa

- Source tool/service/CLI adapter, wrapper control, binding control, dan test Stage E.
- `npm run build`, targeted test Stage E, serta full `npm test -- --silent` berhasil dijalankan.
- `respondControlWrite()` membuktikan checked binding, role DEV, stale-state enforcement di bawah lock, idempotency, journaling/recovery, dan audit event lengkap sesuai field Plan Doc §17.

### Hasil verifikasi

- `src/commands/exec.ts` telah memakai `createExecDraft()`; tidak ditemukan subprocess CLI atau mutation logic MCP terduplikasi.
- Pemilihan PLAN, guard satu exec terbuka, version parity PLAN-to-EXEC, role DEV, Zod validation, dan cross-process recovery memiliki implementasi serta test.
- Control server terpisah dari query server dan tidak dapat start tanpa root, project ID, serta role terverifikasi.

### Temuan yang masih memerlukan keputusan

1. **D-01 - cakupan `expected_artifact_sha256` ambigu.** Create-exec memerlukan `expected_state_revision`, tetapi tidak hash PLAN LOCKED yang dipilih sebagai precondition. State revision tidak mencakup perubahan manual pada konten PLAN. Plan Doc §7.3 tidak tegas apakah hash diwajibkan untuk artifact yang hanya dibaca sebagai precondition. Director perlu memutuskan; bila ya, input tool dan test harus ditambah.

### Koreksi terhadap catatan review sebelumnya

Klaim bahwa audit observability, policy availability, recovery, parity service, atau bukti primer tidak tersedia **dicabut**. Source/test yang diperiksa mendukung klaim implementasi utama.

### Keputusan Director — 2026-09-16

**D-01 — `expected_state_revision` dinyatakan cukup**, konsisten dengan keputusan yang sama untuk `plan_draft` (lihat `RESULT-IMPL-SIGMA-MCP-STAGE-E-PLAN-DRAFT-20260916.md` §8). Precondition PLAN LOCKED tidak memerlukan hash-pinning konten; kewajiban `expected_artifact_sha256` berlaku untuk artifact yang ditulis, bukan yang hanya dibaca sebagai precondition state. Tidak ada perubahan tool/schema yang diperlukan.
