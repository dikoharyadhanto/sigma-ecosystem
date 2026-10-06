# RESULT-IMPL â€” Stage E W1 pilot: `sigma_create_plan_draft`

**Tanggal**: 2026-09-16
**Sumber**: `PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` Â§14 Stage E ("Tambahkan primitive berdasarkan kebutuhan nyata... satu per satu"), diperluas dari Stage C/D yang sengaja dipersempit ke intent draft/ratify saja.
**Perintah Director**: mulai Stage E secara bertahap, satu primitive per putaran, setelah fondasi `chain.ts`/`controlStore.ts` diperbaiki (lihat `RESULT-IMPL-SIGMA-MCP-ATOMIC-WRITE-FIX-20260916.md`). Primitive pertama dipilih Director dari tiga opsi: **`sigma_create_plan_draft`** â€” mirror langsung pola `sigma_create_intent_draft` yang sudah PASS gate.
**Peran implementer**: Claude Code sebagai implementator; Codex sebagai reviewer independen berikutnya. Dokumen ini **tidak** men-declare "Gate E PASS" â€” itu keputusan review, bukan implementer.
**Status**: Implementasi + test contract selesai, satu putaran self-review adversarial dilakukan (Â§5). Menunggu review independen Codex.

## 1. Ringkasan

`sigma_create_plan_draft` adalah MCP control-plane equivalent dari `sigma plan new` (jalur non-pending). Mengikuti pola arsitektur `sigma_create_intent_draft` (Stage C) persis: service layer transport-agnostic dipakai bersama CLI dan MCP, `respondControlWrite()` untuk idempotency/lock/journal/audit, tool registration di `sigma-control` server.

Perbedaan struktural dari `intent_draft` yang menjadi fokus utama pekerjaan ini:

| | `sigma_create_intent_draft` | `sigma_create_plan_draft` |
|---|---|---|
| Target di chain | `chain.intent` â€” objek tunggal | `chain.plan.versions[]` â€” array |
| Precondition | Tidak ada (opsional: CLOSED-chain reopen) | Gate 1 (RATIFIED intent) + Gate 1.5 (ROADMAP eligible) + humanize gate opsional |
| Efek samping file lain | `activate_status.json`, `intent-history.md` | `Sigma/roadmap/ROADMAP-vN.md` (Stage Overview re-render) |
| Role | ARC | FMN |

## 2. File yang berubah

**Baru**:
- `src/services/planDraftService.ts` â€” `createPlanDraft()`, `createPlanDraftTransactionFiles()`, `PlanDraftError`. Mirror `intentDraftService.ts`; lihat Â§3 untuk deviasi disengaja.
- `src/mcp/control/tools/createPlanDraft.ts` â€” registrasi tool MCP, mirror `createIntentDraft.ts` persis.
- `test/control-plan-draft.test.ts` â€” 26 test, mirror struktur `test/control-intent-draft.test.ts`.

**Diubah**:
- `src/commands/plan.ts` â€” `plan new` (jalur non-pending) direfaktor memanggil `createPlanDraft()`, bukan menduplikasi mutation logic. Jalur `--pending` tidak disentuh (di luar cakupan Stage E W1 saat ini â€” lihat Â§3).
- `src/mcp/control/index.ts` â€” registrasi `sigma_create_plan_draft` di `buildControlServer()`.
- `test/control-intent-draft.test.ts` â€” daftar exact-match 5 tool control-plane diperbarui (sebelumnya 4).
- `test/mcp-tools.test.ts` â€” `createPlanDraft` ditambahkan ke guard defense-in-depth query-plane (daftar `writerNames`).
- `Implementation/sigma-mcp/SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md` â€” entri `plan_new` diubah dari "deferred Stage E" menjadi "implemented â€” Stage E W1 pilot".

## 3. Deviasi dan keputusan desain

1. **`assertRequiredMetadata` (guard "|"/newline) ditambahkan ke plan draft â€” bug yang sudah ada di CLI sebelum perubahan ini, ditutup sekalian.** `generateStageOverview()` (`src/utils/roadmap.ts`) merender title/focus ke baris tabel pipe (`| ${stage} | ${title} | ${focus} | ... |`) tanpa escaping â€” identik dengan risiko intent-history.md yang sudah ditutup `intentDraftService.ts`. CLI `plan new` yang ada sebelumnya **tidak** memvalidasi ini (hanya non-empty). Karena Stage E mengharuskan satu service dipakai CLI dan MCP (invarian Â§9 plan), guard ini masuk ke service baru dan otomatis menutup gap itu untuk kedua caller, bukan hanya MCP. Dicatat di sini karena ini perubahan perilaku CLI, meski kecil dan searah dengan pola yang sudah mapan di intent draft.
2. **Humanize gate (`notion_humanize_gate`) dipertahankan di service, bukan didrop.** Opsional, project-config driven, sudah ada di CLI. Dipertahankan agar MCP tidak menjadi jalan pintas untuk melewati policy yang CLI tegakkan â€” konsisten dengan invarian "same use case, two adapters".
3. **Hanya jalur non-pending yang diporting.** `sigma plan new --pending` (staging tanpa gate/versi) tetap CLI-only â€” tidak ada dalam daftar W1 Director maupun di Stage C/D precedent. Tidak diperluas tanpa perintah eksplisit.
4. **`getRoadmapPathIfEligible()` diduplikasi (bukan diimpor) dari `src/commands/plan.ts` ke `planDraftService.ts`.** Fungsi murni satu baris logic; mengimpor dari `plan.ts` akan menyeret dependency Commander ke service yang harus tetap transport-agnostic. Duplikasi satu fungsi kecil dinilai lebih aman daripada mencemari boundary itu.
5. **Nama failpoint baru**: `plan_create_after_artifact`, `plan_create_after_chain`, `plan_create_after_roadmap` â€” sengaja diberi prefix `plan_` agar tidak collide dengan failpoint intent (`create_after_artifact`, dst.) yang dibaca dari environment variable global `SIGMA_CONTROL_TEST_FAILPOINT`.

## 4. Test dan evidence

**Baru**: `test/control-plan-draft.test.ts`, 26 test, terorganisir mengikuti lima properti Gate C (Â§14 plan) plus satu kategori tambahan khusus array-of-versions:

1. **Role dan gate boundary** (7 test) â€” no role, role ARC (bukan FMN), intent belum RATIFIED (`GATE_BLOCKED`), ROADMAP tidak ada (`GATE_BLOCKED`), ROADMAP SUPERSEDED, title mengandung `|`, humanize gate aktif memblokir.
2. **Stale state** (1 test).
3. **Idempotency dan concurrency** (3 test) â€” replay, conflict, concurrent same-process.
4. **Array-of-versions correctness** (1 test) â€” draft kedua di bawah intent yang sama menghasilkan `v0.2` tanpa mengubah `v0.1`, keduanya `state: DRAFT` dengan title/focus masing-masing benar. Ini membuktikan langsung klaim Â§3 RESULT Stage C bahwa `chain.plan.versions[]` (array) butuh boundary review terpisah dari `chain.intent` (objek tunggal).
5. **Crash-window safety** (2 test) â€” mutate() throw sinkron menyisakan record "failed" (bukan hilang), pending record tanpa journal fail closed.
6. **Transport-level** (1 test) â€” panggilan tool nyata lewat in-memory MCP client, `structuredContent` cocok dengan `contract_version: "1.0"`, chain hasil dibaca ulang dari disk.
7. **Cross-process concurrency dan process-death recovery** (11 test) â€” dua proses `sigma-control` nyata (bukan `Promise.all` dalam satu proses) berebut idempotency key yang sama (tepat satu commit) dan key berbeda pada `expected_state_revision` yang sama (tepat satu menang, yang kalah `STALE_STATE`); `it.each` atas 9 failpoint (3 spesifik plan_draft + 6 generik wrapper) â€” proses nyata di-kill (`SIGKILL`) pada titik itu, proses baru dengan idempotency key sama pulih deterministik ke persis satu efek.

Test daftar-tool exact-match di `test/control-intent-draft.test.ts` diperbarui dari 4 menjadi 5 tool (menambahkan `sigma_create_plan_draft`) â€” bukti struktural bahwa surface tool baru terdaftar sesuai ekspektasi, bukan klaim tanpa bukti.

**Regresi**:
- `npm run build` â€” bersih.
- `npm test` â€” **55 file / 648 test PASS** (naik dari 54 file/622 test setelah `RESULT-IMPL-SIGMA-MCP-ATOMIC-WRITE-FIX-20260916.md`; delta murni test baru file ini, tidak ada test yang hilang atau berubah perilaku pada file lain).
- Test CLI existing yang menyentuh `plan new` (`humanize-fase6-gate.test.ts`, `gate-enforcement.test.ts`, `chain-gate.test.ts`, `plan-lock-targeting.test.ts`, `plan-supersede.test.ts`, `exec-version-parity.test.ts`, `error-messages.test.ts`, `gate3-semantics.test.ts` â€” 70 test total) tetap PASS setelah refactor CLI memanggil service baru, termasuk assertion pesan error humanize gate/Gate 1.5 â€” membuktikan parity CLI tidak berubah dari sisi behavior yang teramati (hanya format join pesan blocker berubah dari multi-line ke satu baris, lihat Â§3.2 â€” tidak ada test yang meng-assert format itu secara exact).

## 5. Self-review adversarial (satu putaran, sebelum serah terima ke Codex)

Diperiksa, tanpa temuan yang memerlukan perubahan kode lebih lanjut:

- **Role server-derived**: `allowedRoles: ['FMN']` ditegakkan dari `binding.role` (startup `--role`), tidak ada field role di `inputSchema`. Tidak ada jalan bagi model memalsukan role.
- **`project_root` tidak ada di schema tool baru** â€” dibuktikan oleh test generik yang meloop semua tool control-plane (sudah mencakup tool baru ini otomatis).
- **Tidak ada permukaan path-traversal** â€” `createPlanDraft` hanya menerima `title`/`focus` (string bebas, divalidasi non-empty + tanpa `|`/newline); semua path artifact diturunkan server-side dari `nextPlanVersion()` + konstanta template, tidak ada input model yang menjadi bagian path.
- **Transaction journal mencakup ketiga file yang disentuh mutation** (dokumen plan baru, chain file, ROADMAP file) â€” dibuktikan lewat 3 failpoint spesifik plus 6 failpoint generik wrapper, seluruhnya pulih ke tepat satu efek setelah proses nyata di-`SIGKILL`.
- **Idempotency scope**: `argumentsForHash` sengaja tidak menyertakan versi/chain state (sama seperti `intent_draft`) â€” retry dengan key+argumen identik mereplay hasil asli tanpa re-validasi state, meniru desain yang sudah diverifikasi Stage C. Bukan bug, disengaja dan dites eksplisit.
- **Gate-rejection path lewat `respondControlWrite` penuh** hanya dites langsung untuk kasus role (no-role, role ARC) â€” kasus gate lain (Gate 1/1.5/humanize/`|`-char) dites di level service langsung karena bisnis logic itu murni ada di service, sementara plumbing error-code passthrough (`codeOf()` men-unwrap `PlanDraftError` sama seperti `IntentDraftError`) sudah terbukti benar dari test `intent_draft` yang memakai mekanisme identik. Dinilai cukup mengingat keputusan Director soal kedalaman review putaran ini (implementasi + test contract penuh + satu putaran self-review, bukan multi-round penuh setara Stage C/D) â€” dicatat eksplisit di sini sebagai batas cakupan, bukan disembunyikan.

## 6. Yang belum dikerjakan (sengaja, di luar cakupan putaran ini)

- `sigma_create_exec_draft`, perluasan `sigma_update_artifact_draft` ke tipe plan/exec, `sigma_send_message`, `sigma_write_memo`, operasi roadmap â€” item W1 lain, menunggu putaran Stage E berikutnya satu per satu sesuai arahan Director.
- Seluruh item W2 (governance transition selain `intent_ratify`) â€” belum tersentuh.
- W3 â€” tetap deferred permanen sampai plan keamanan terpisah.
- `sigma plan new --pending` tidak diporting ke MCP.

## 7. Status akhir

`git status` pada akhir pekerjaan ini (sebelum RESULT report Stage E ditulis; lihat commit history untuk status setelahnya) menunjukkan seluruh perubahan sebagai working-tree diff/untracked, tidak ada commit yang dibuat oleh implementer. Menunggu review Codex dan keputusan Director soal commit/lanjut ke primitive Stage E berikutnya.

## 8. Review teknis independen - 2026-09-16

**Status: PASS WITH DIRECTOR DECISION.** Tidak ditemukan defect implementasi pada `sigma_create_plan_draft` dari source dan test yang diperiksa. Build TypeScript selesai bersih; test control Stage E dan suite penuh selesai tanpa kegagalan yang terlapor. `git diff --check` juga tidak melaporkan error whitespace.

### Bukti yang diperiksa

- Source tool, service, CLI adapter, `respondControlWrite()`, binding control, dan test Stage E.
- `npm run build` berhasil.
- Targeted test Stage E dan full `npm test -- --silent` berhasil dijalankan.
- Wrapper control membuktikan verified control binding, role FMN, stale-state check di bawah lock, idempotency, transaction journal/recovery, dan audit event berisi correlation, binding, role, revision, hash, serta outcome.

### Hasil verifikasi

- `src/commands/plan.ts` telah memakai `createPlanDraft()`; CLI dan MCP memakai service mutasi yang sama.
- Tool hanya menerima role server-derived FMN; control server adalah binary terpisah dan binding control harus verified.
- Guard payload, transaksi tiga file (PLAN, chain, ROADMAP), idempotency, dan recovery dijalankan melalui wrapper bersama dan test terkait lulus.

### Temuan yang masih memerlukan keputusan

1. **D-01 - perubahan kompatibilitas CLI.** `assertRequiredMetadata()` kini menolak `|` dan newline pada `sigma plan new`. Source mengonfirmasi ini adalah perubahan perilaku CLI yang disengaja untuk mencegah korupsi tabel ROADMAP. Secara teknis tepat, tetapi perlu persetujuan Director sebagai perubahan kompatibilitas CLI, atau harus dipisahkan dari batch MCP.

2. **D-02 - cakupan `expected_artifact_sha256` ambigu.** Tool create-plan hanya menerima `expected_state_revision`; ia tidak mengikat hash INTENT/ROADMAP yang dibaca sebagai precondition. Ini bukan defect yang dapat diputuskan dari kode saja, karena Plan Doc §7.3 tidak membedakan artifact yang ditulis dari artifact yang hanya dibaca sebagai precondition. Director perlu menetapkan interpretasi tersebut. Jika hash precondition diwajibkan, tool dan test perlu diperluas.

### Koreksi terhadap catatan review sebelumnya

Klaim bahwa policy availability, audit observability, recovery, atau bukti test belum tersedia **dicabut**. Bukti tersebut ada di source/test dan telah diperiksa pada review ulang ini.

### Keputusan Director — 2026-09-16

1. **D-01 — disetujui sebagai perbaikan bug.** `assertRequiredMetadata()` diterima sebagai perubahan perilaku CLI yang sah, konsisten dengan guard yang sudah ada di `intentDraftService.ts`. Tidak dipisah dari batch MCP.
2. **D-02 — `expected_state_revision` dinyatakan cukup.** Precondition read-only (INTENT RATIFIED, ROADMAP eligible) tidak memerlukan hash-pinning konten. Interpretasi Plan Doc §7.3: kewajiban `expected_artifact_sha256` berlaku untuk artifact yang **ditulis**, bukan yang hanya dibaca sebagai precondition state. Tidak ada perubahan tool/schema yang diperlukan.
