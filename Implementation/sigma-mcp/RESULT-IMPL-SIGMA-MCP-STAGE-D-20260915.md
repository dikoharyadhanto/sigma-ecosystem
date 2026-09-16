# RESULT-IMPL — Sigma MCP Stage D (Governance Transition Pilot)

**Plan**: `PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` §14 Stage D
**Prasyarat**: Stage C bounded command pilot (implementasi/self-verified — `RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md`)
**Otorisasi**: Perintah Director eksplisit 2026-09-16 ("lanjut saja ke stage D jadi codex sekalian review stage C dan D") — sequencing awal (Stage C dulu, tunggu review, baru Stage D) digantikan instruksi ini; Codex diminta review Stage C **dan** D sekaligus.
**Tanggal**: 2026-09-15/16
**Status terkini (2026-09-16)**: **GATE D: PASS (lihat Bagian 21) — putusan final independen (Claude/Sonnet 5) setelah `acquireProjectLock()` diganti total ke `proper-lockfile@4.1.2` (primitive sama dengan Stage C, RESULT Stage C §23). 20× ulang test race commit-ratify resmi: 0/20 gagal (sebelumnya ~22%). Full suite 53 file / 618 test PASS.**
**Status**: **GATE D: PASS.** Riwayat: HOLD sejak §11 (lock in-process, P0) → empat putaran perbaikan/review Codex (§12–§17, fokus stale-takeover) → P0 baru ditemukan independen oleh Claude (§19, fresh-contender race) → remediasi `proper-lockfile` disepakati bertiga (RESULT Stage C §21.8) → diimplementasikan (§20) → **PASS setelah re-review adversarial independen (§21)**.
**Scope dieksekusi**: pilot transisi tunggal `intent_ratify` melalui `typed prepare → durable Director approval (trusted local CLI) → typed commit`. Dua tool MCP baru (`sigma_prepare_intent_ratify`, `sigma_commit_intent_ratify`), satu perintah CLI baru (`sigma control approve/reject/show`), operation ticket + approval record store.
**Tidak termasuk**: transisi W2 lain (plan_lock, exec_lock, close_lock, dst — plan §14 Stage D item 5: "satu per satu" setelah gate ini lulus), remote Director authentication, W3 privileged operations, commit/push.

---

## 1. Ringkasan gate

| Gate | Status |
|---|---|
| Stage C (prasyarat) | Self-verified, lihat `RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md` |
| Stage D (dokumen ini) | Self-verified terhadap kriteria plan §14 Stage D. **Belum** direview eksternal |

## 2. Yang diimplementasikan

### 2.1 Service layer bersama — `intentRatifyDraft()`

**`src/services/intentRatifyService.ts`** (baru) — `ratifyIntentDraft()` diekstrak dari `sigma intent ratify` (CLI). `src/commands/intent.ts`'s `ratify` command direfactor memanggilnya; `sigma_commit_intent_ratify` memanggil fungsi **yang sama**. CLI tetap mencetak doc report sendiri (concern UX, bukan mutasi) sebelum memanggil service.

**Regresi yang ditemukan dan diperbaiki selama refactor ini sendiri** (bukan oleh reviewer): dua test di `test/progress-hardening.test.ts` gagal pada percobaan build pertama karena urutan operasi berubah — versi awal refactor CLI membaca+mencetak doc report **sebelum** memanggil `assertChainCanMutate()` (yang sekarang hidup di dalam service), sehingga fixture dengan chain yang secara semantik korup (mis. `intent.version` tidak cocok `chain_version`) gagal dengan `ENOENT` (file dokumen tidak pernah dibuat oleh fixture) alih-alih pesan diagnostik semantik yang jelas yang diharapkan test. Diperbaiki dengan memanggil `assertChainCanMutate(chain)` di CLI **sebelum** langkah cetak-report, duplikasi satu pemanggilan read-only yang murah — bukan duplikasi mutasi. Terverifikasi: kedua test lulus kembali, full suite tetap hijau.

### 2.2 Operation ticket + approval record store

**`src/engine/controlStore.ts`** (diperluas dari Stage C) — menambah:
- `OperationTicket` + `writeTicket`/`readTicket`/`markTicketConsumed` — `Sigma/.mcp-control/tickets/`
- `ApprovalRecord` + `writeApproval`/`readApproval`/`markApprovalConsumed` — `Sigma/.mcp-control/approvals/`
- `TICKET_TTL_MS`/`APPROVAL_TTL_MS` = 30 menit (default pilot, belum dapat dikonfigurasi — dicatat sebagai keterbatasan §7)

Lokasi dan pola atomic write **mewarisi** keputusan Stage C (project-scoped, `Sigma/.mcp-control/`), bukan membuka ulang pertanyaan yang sudah diputuskan Director.

### 2.3 Generalisasi `respondControlWrite`

**`src/mcp/control/shared.ts`** direfactor: precondition check sebelum `mutate()` kini pluggable (`checkPreconditions: (root) => void`) alih-alih hardcoded perbandingan `expected_state_revision`. `staleStateCheck()` diekstrak sebagai closure yang dipakai kedua tool Stage C (create/update draft) tanpa perubahan perilaku — diverifikasi: seluruh 17 test Stage C tetap hijau setelah refactor ini. Ini memungkinkan idempotency/lock/audit machinery ditulis **sekali**, dipakai baik oleh Stage C (precondition sederhana) maupun Stage D (precondition ticket+approval yang jauh lebih kaya) — bukan implementasi paralel kedua.

### 2.4 `sigma_prepare_intent_ratify` (ARC-only)

Read-only terhadap governance state: membekukan versi+state+hash dokumen DRAFT intent aktif dan `state_revision` saat ini ke dalam operation ticket. Menolak (`INVALID_OPERATION`) bila intent bukan DRAFT. Ticket **tidak memberi otoritas apa pun** (plan §10.1) — hanya membekukan kondisi awal.

### 2.5 `sigma_commit_intent_ratify` (ARC-only)

Menerima `operation_ticket_id` + `approval_id` + `idempotency_key` — **tidak** menerima argumen bisnis lain; nilai yang dibandingkan (target hash, expected state) datang dari ticket itu sendiri, bukan dari input caller, sehingga caller tidak bisa "meyakinkan" tool tentang nilai yang seharusnya independen diverifikasi.

Rantai validasi di dalam `checkPreconditions` (dijalankan di dalam lock, sebelum mutasi):
1. Ticket dikenal, milik proyek ini, bertipe `intent_ratify`, belum consumed, belum expired.
2. Approval record ada, merujuk ticket yang sama, operation/arguments/expected-state/target-hash cocok, `decision === 'approve'` (bukan `reject`), belum consumed, belum expired.
3. **Setelah** ticket dan approval saling cocok: `state_revision` live dan hash dokumen live dicek ulang terhadap yang dibekukan ticket — approval yang valid untuk snapshot basi tetap ditolak (`STALE_STATE`/`STALE_ARTIFACT`).

Mutasi: memanggil `ratifyIntentDraft()` (service yang sama dengan CLI), lalu menandai **baik** ticket maupun approval sebagai consumed dalam operasi yang sama.

Pemetaan kode error mengikuti vocabulary `ERROR_CODES` yang sudah dibekukan sejak Batch 1 — **tidak ada kode baru yang ditambahkan**, sesuai larangan eksplisit di `contract.ts`. Peta lengkap didokumentasikan di header file.

### 2.6 `sigma control approve/reject/show` — trusted local Director CLI

**`src/commands/control.ts`** (baru), didaftarkan di `src/cli.ts`. Tidak ada satu pun tool MCP yang menulis approval record — satu-satunya penulis adalah perintah CLI ini, dijalankan langsung oleh Director di host lokal. Ini realisasi literal plan §10.2 ("Pilot menggunakan approval yang direkam melalui trusted local CLI Director") dan kriteria berhenti §22 ("approval chat/runtime diterima sebagai approval governance" — dihindari secara struktural, bukan lewat policy).

Pola UX mengikuti konvensi existing (`intent supersede`, `override`): preview ticket dicetak dulu, lalu `--director-confirm` wajib untuk benar-benar merekam keputusan. `reject` mewajibkan `--reason`.

**Batas kepercayaan yang dinyatakan eksplisit** (bukan diasumsikan): identitas Director = user OS lokal (`os.userInfo().username`), method = `"local_cli"`. Tidak ada autentikasi Director remote — sesuai plan §10.2/§21.2 yang menyatakan ini keputusan desain terpisah, di luar scope pilot.

## 3. Bukti eksekusi

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` (`tsc`) | Bersih, nol error |
| `npm test` (full suite) | **53 file / 585 test PASS** (dari 52 file / 562 di akhir Stage C; +1 file, +23 test, nol hilang) |
| `test/control-intent-ratify.test.ts` (baru, 23 test) | Role boundary, ticket expired, approval contract lengkap (§16.4: unknown/mismatch/reject/expired/consumed), state/artifact drift setelah prepare, commit sukses+single-use+audit, retry idempoten, dan lima test CLI `sigma control` lewat subprocess nyata (`runCli`) |
| `test/control-intent-draft.test.ts` (regresi Stage C setelah generalisasi `respondControlWrite`) | 17/17 PASS, tidak berubah perilaku |
| Smoke runtime out-of-process — `evidence/stageD-runtime-smoke.mjs` (baru) | **23/23 PASS** — tiga proses terpisah (sigma-control prepare, `sigma control` CLI approve, sigma-control commit) plus proses query terpisah yang mengonfirmasi post-state identik |
| Smoke runtime Stage C (`evidence/stageC-runtime-smoke.mjs`, regresi) | 23/23 PASS, tidak berubah |
| `git diff --check` | Bersih (dua warning CRLF normalisasi pada file yang sudah ada sebelumnya) |

## 4. Smoke test out-of-process — `evidence/stageD-runtime-smoke.mjs`

```
node Implementation/sigma-mcp/evidence/stageD-runtime-smoke.mjs
```

Membangun proyek fixture disposable sendiri (pola isolasi sama dengan Stage C — `HOME`/`USERPROFILE` diarahkan ke temp dir, dibersihkan di akhir). Yang dibuktikan lewat proses nyata terpisah — bukan in-process reference client:

| Kasus | Hasil |
|---|---|
| **A** — prepare (proses `sigma-control` 1) | Ticket dibuat; proses `sigma-mcp` (query) **terpisah** mengonfirmasi intent tetap DRAFT |
| **B** — `sigma control show`/`approve` tanpa `--director-confirm` (CLI subprocess) | Preview tercetak; exit 1 tanpa `--director-confirm`; **tidak ada direktori approval dibuat** |
| **C** — `sigma control approve --director-confirm` (CLI subprocess) | exit 0; approval_id tercetak dan dapat di-parse |
| **D** — commit (proses `sigma-control` **ke-2**, terpisah dari yang menjalankan prepare) | Sukses; proses query terpisah mengonfirmasi Gate 1 open **dan** intent RATIFIED |
| **E** — commit ulang dengan ticket+approval yang sama, idempotency_key berbeda | `APPROVAL_MISMATCH`; nol file governance berubah (di luar `.mcp-control/`) |
| **F** — prepare kedua setelah ratify | `INVALID_OPERATION` — tidak ada lagi DRAFT untuk dibekukan |

Poin penting: prepare, approve, dan commit berjalan di **proses OS yang berbeda-beda**, saling berkomunikasi hanya lewat file di disk (ticket, approval, chain) — ini membuktikan store berbasis file benar-benar menjadi titik koordinasi yang berfungsi, bukan cuma lolos karena berbagi memori proses yang sama seperti test in-process.

**Bug ditemukan-dan-diperbaiki dalam skrip smoke test itu sendiri** (bukan pada kode Stage D): draf pertama skrip memakai `sigma_get_state` untuk memeriksa status DRAFT/RATIFIED — tool itu tidak pernah mengekspos `intent.state` (hanya `phase`/`gates`). Kegagalan pertama skrip justru membuktikan `ratifyIntentDraft()` **benar** menolak meratifikasi template kosong hasil `sigma intent new` (yang belum diisi) — diperbaiki dengan mengisi dokumen intent yang valid sebelum prepare, dan mengganti pemeriksaan ke `sigma_read_artifact` yang benar-benar mengembalikan `state`.

## 5. Mutation-check — sebagian berhasil (berbeda dari Stage B2/C)

Untuk R-01/R-10 pada Batch 1, pola pembuktian adalah mematikan guard lalu memastikan test gagal. Pada Stage B2 dan Stage C, percobaan ini **diblokir** classifier keamanan sesi ("Security Weaken"). Pada Stage D, dicoba ulang pada file `src/mcp/control/tools/commitIntentRatify.ts` — **kali ini tidak diblokir**:

| Guard dimatikan (`if (false)`) | Hasil |
|---|---|
| `approval.decision !== 'approve'` (menolak decision "reject") | 2 test gagal: "reject decision is refused" dan test CLI end-to-end reject-flow |
| `ticket.consumed_at` **dan** `approval.consumed_at` sekaligus | 2 test gagal — satu langsung ("already-consumed approval"), satu tertangkap oleh lapisan berbeda (`STALE_STATE` alih-alih `APPROVAL_MISMATCH`, karena `state_revision` sudah bergerak setelah commit pertama) — **bukti defense-in-depth**: menghapus guard single-use tidak membuka celah replay karena lapisan stale-state independen tetap menangkapnya |

Guard dikembalikan (`diff` byte-identical dengan backup sebelum percobaan, diverifikasi) dan build+test diulang — hijau. Guard `role`, `stale-state`, `stale-artifact`, dan pemeriksaan `ticket`/`approval` lain (unknown id, wrong project, wrong hash, expired) tidak dicoba dimatikan lagi setelah dua percobaan berhasil di atas — dianggap cukup mewakili tanpa mengulang setiap kombinasi, dan tetap punya test kasus diterima+ditolak yang menjalankan kode asli (pola substitusi yang sama dijelaskan di `RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md` §7).

## 6. Keputusan desain yang dibuat tanpa pertanyaan eksplisit ke Director

Satu, dicatat di sini untuk transparansi:

**Role pemanggil (`binding.role`) untuk `sigma_prepare_intent_ratify`/`sigma_commit_intent_ratify` dipatok ke ARC**, bukan mensyaratkan `binding.role === 'DIRECTOR'`. Alasan: `--role` binding MCP hanya mengenal empat AI role (ARC/FMN/DEV/AUD, plan §6.2) — Director adalah manusia yang berinteraksi lewat CLI lokal, bukan lewat binding MCP. Capability matrix Stage 0 mencatat "Owner role: DIRECTOR" untuk `intent_ratify`, yang saya baca sebagai **otoritas** (siapa yang benar-benar mengizinkan), bukan **binding role pemanggil** — otoritas itu ditegakkan lewat approval record terpisah yang hanya bisa ditulis `sigma control approve`, bukan lewat argumen tool atau role binding. Ini realisasi langsung invarian §5.8 "Director finality", bukan penyimpangan darinya — dan dicatat eksplisit di `SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md` §3.3 agar reviewer dapat menilai interpretasi ini secara sadar, bukan menemukannya sebagai kejutan.

## 7. Keterbatasan yang dinyatakan

| Keterbatasan | Detail |
|---|---|
| TTL ticket/approval tetap (30 menit) | Belum dapat dikonfigurasi. Pilihan pilot, bukan batas fisik protokol. |
| Lock in-process (diwarisi dari Stage C) | Sama seperti Stage C §8 — satu proses `sigma-control` per proyek pada satu waktu adalah asumsi operasional pilot. |
| Tidak ada revocation eksplisit untuk approval yang belum dipakai | Director dapat merekam `reject` untuk tiket yang masih aktif, tetapi tidak ada perintah "cabut approval yang sudah approve". Untuk pilot, TTL 30 menit membatasi window; kebutuhan revocation eksplisit belum terbukti. |
| Hanya `intent_ratify` | Sesuai scope pilot plan §14 item 3. `plan_lock`/`exec_lock`/`close_lock`/dll adalah Stage D+ terpisah (matriks §3.3), masing-masing perlu primitive ticket dan pemetaan error code sendiri karena bentuk targetnya berbeda (single object vs array of versions). |
| Approval tidak mem-verifikasi identitas Director secara kriptografis | Sesuai plan §10.2/§21.2 — remote Director authentication adalah keputusan desain terpisah, di luar pilot lokal ini. |

## 8. Definition of Done Gate D (plan §14) — self-assessment

| Syarat Gate D | Status |
|---|---|
| Tidak ada transisi tanpa approval valid | **Terpenuhi** — §2.5, §4 kasus F, `test/control-intent-ratify.test.ts` approval-contract suite |
| Ticket terikat hash/state | **Terpenuhi** — target sha256 + expected_state_revision dibekukan di ticket, dicek ulang saat commit (§2.5 butir 3) |
| Approval single-use | **Terpenuhi** — §5 mutation-check, §4 kasus E |
| Audit lengkap | **Terpenuhi** — `respondControlWrite()`'s audit mencakup attempt/deny/commit dengan `operation_ticket_id` implisit lewat `operation_id`; korelasi diverifikasi di `test/control-intent-ratify.test.ts` ("marks both ticket and approval consumed") |
| Semantics identik antara CLI dan MCP | **Terpenuhi** — `ratifyIntentDraft()` satu-satunya implementasi, dipakai kedua adapter; diverifikasi §2.1 (regresi progress-hardening membuktikan urutan operasi CLI tidak diam-diam berbeda dari service) |

Self-assessment ini **bukan** penetapan Gate D PASS — menunggu review Codex/Director, sesuai instruksi Director bahwa Codex akan me-review Stage C **dan** D bersamaan.

## 9. Daftar file berubah (Stage D saja — di atas Stage C)

**Baru — source (6)**
`src/services/intentRatifyService.ts`, `src/commands/control.ts`, `src/mcp/control/tools/prepareIntentRatify.ts`, `src/mcp/control/tools/commitIntentRatify.ts`

**Baru — test (1)**
`test/control-intent-ratify.test.ts` (23 test)

**Baru — evidence (1)**
`Implementation/sigma-mcp/evidence/stageD-runtime-smoke.mjs`

**Baru — dokumen (1)**
Dokumen ini

**Diubah — source (5)**
`src/commands/intent.ts` (refactor `ratify` ke service bersama + fix urutan operasi), `src/engine/controlStore.ts` (tambah ticket+approval primitives), `src/mcp/control/shared.ts` (generalisasi `checkPreconditions`), `src/mcp/control/tools/createIntentDraft.ts` + `updateArtifactDraft.ts` (pakai `staleStateCheck()`), `src/mcp/control/index.ts` (daftarkan dua tool baru), `src/cli.ts` (daftarkan `control` command)

**Diubah — test (1)**
`test/control-intent-draft.test.ts` (helper disesuaikan ke `checkPreconditions`; tool-list assertion jadi 4 tool)

**Diubah — dokumen (1)**
`Implementation/sigma-mcp/SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md` (status `intent_ratify` → implemented + klarifikasi owner-role)

**`dist/`** — mengikuti konvensi repo.

**Tidak disentuh**: `src/mcp/policy.ts`, `Sigma/SIGMA-OPERATION-REGISTRY.json`, config global manapun, proyek produksi manapun, `sigma-control` tidak di-link/diinstal ke host.

## 10. Paket review untuk Codex (Stage C + D sekaligus, sesuai instruksi Director)

Untuk kedua stage: source diff penuh sejak `629967a` (HEAD final review Batch 1), output test lengkap (§3 dokumen ini + §4 `RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md`), kedua capability matrix update, kedua result report, dan kedua skrip smoke test evidence. Yang paling layak diperiksa keras:

1. Apakah interpretasi "Owner role: DIRECTOR = otoritas lewat approval, bukan binding role" (§6) benar-benar tidak membuka celah — role ARC yang bisa prepare+commit secara mekanis, dengan approval sebagai satu-satunya gerbang otoritas nyata.
2. Apakah rantai validasi `checkPreconditions` di `commitIntentRatify.ts` benar-benar lengkap — reviewer disarankan mencoba kombinasi yang belum saya uji eksplisit (mis. approval dengan `arguments_hash` cocok tapi field lain sengaja diubah satu-satu).
3. Apakah lock in-process (diwarisi Stage C, §7) punya implikasi keamanan yang lebih serius untuk Stage D dibanding Stage C, mengingat Stage D memindahkan gate lifecycle (bukan sekadar draft).
4. Apakah generalisasi `checkPreconditions` di `shared.ts` (§2.3) memperkenalkan regresi pada dua tool Stage C — 17 test lama saya nyatakan tetap hijau, tapi review independen disarankan.
5. Apakah pemetaan error code (§2.5) ke 14 kode yang sudah dibekukan konsisten dan tidak ambigu bagi konsumen.

## 11. Review Codex 2026-09-16 — Gate D HOLD

### 11.1 Putusan

Gate D **belum PASS** dan tidak boleh menjadi dasar penambahan transition W2 lain. Pola `prepare → trusted local CLI approval → commit`, penggunaan shared `ratifyIntentDraft()`, serta mayoritas pemeriksaan mismatch/expiry/replay sudah tepat. Namun finding C-R01 sampai C-R04 pada Stage C diwarisi langsung oleh Stage D, dan menjadi lebih serius karena operasi ini memindahkan lifecycle governance.

### 11.2 Finding blocking

| ID | Severity | Finding | Bukti utama | Dampak |
|---|---|---|---|---|
| D-R01 | P0 | Tidak ada project-scoped lock lintas-proses. `withControlLock()` hanya menyerialkan call dalam satu proses, sementara prepare/approve/commit memang berjalan di proses berbeda. Tidak ada concurrent-commit test Stage D. | `src/mcp/control/shared.ts`; plan §11.4/§11.7 dan Stage D item 4; keterbatasan §7 dokumen ini. | Dua worker dapat sama-sama melihat ticket/approval belum consumed dan state masih cocok, lalu keduanya menjalankan transition. Asumsi operasional satu server bukan pemenuhan kontrak. |
| D-R02 | P0 | Commit bukan transaksi crash-safe. Urutannya adalah ratify governance state, mark ticket consumed, mark approval consumed, tulis idempotency record, lalu append audit—semuanya write terpisah tanpa journal/recovery. | `src/mcp/control/tools/commitIntentRatify.ts`; `src/mcp/control/shared.ts`; `src/services/intentRatifyService.ts`. | Crash/failure dapat menghasilkan intent sudah RATIFIED tetapi response error, ticket/approval belum atau hanya sebagian consumed, outcome hilang, dan audit salah/absen. |
| D-R03 | P1 | Audit Stage D tidak mencatat `operation_ticket_id` atau `approval_id`; juga tidak mengisi `channel/profile` dan artifact hashes. Kegagalan audit ditelan. Klaim §8 bahwa ticket ID “implisit lewat operation_id” tidak valid karena keduanya identifier berbeda. | `src/mcp/control/shared.ts::audit()` dibandingkan plan §17. | Gate D mensyaratkan audit lengkap dan korelasi approval; syarat itu belum terpenuhi. |
| D-R04 | P1 | `operation_ticket_id` dan `approval_id` dari caller langsung dipakai pada `path.join(..., id + '.json')` tanpa validasi format atau containment check. Komentar bahwa ticket ID tidak berasal dari caller tidak sesuai call path commit/CLI. | `src/engine/controlStore.ts::ticketPath()` dan `approvalPath()`; `src/mcp/control/tools/commitIntentRatify.ts`; `src/commands/control.ts`. | Path traversal memungkinkan lookup keluar dari `.mcp-control` dan, dengan cukup `..`, keluar dari project root; melanggar binding/isolation boundary. Reviewer mereproduksi `readTicket(root, '../../../outside')` dan `readApproval(root, '../../../outside')` membaca `root/outside.json`. |
| D-R05 | P1 | Ticket canonical tidak memiliki `effects[]`; approval hanya mengikat `target_sha256`, bukan artifact type+version+hash seperti minimum plan §10.2. Preview Director juga tidak menampilkan efek lifecycle/gate dari ratify. | `OperationTicket`/`ApprovalRecord` di `src/engine/controlStore.ts`; `printTicketSummary()` di `src/commands/control.ts`; plan §10.1–§10.2. | Approval belum merepresentasikan seluruh target/effect material yang disetujui Director. |
| D-R06 | P1 | Bukti test overstated: test bernama “marks both ticket and approval consumed” hanya mengassert `ticketAfter.consumed_at`; tidak membaca kembali approval. Tidak ada crash-recovery/failure-injection atau concurrent Stage D test. | `test/control-intent-ratify.test.ts` sekitar test happy path; plan Stage D item 4 dan §16.3–§16.4. | Klaim approval single-use dan crash safety belum dibuktikan pada boundary yang diwajibkan. |

### 11.3 Verifikasi reviewer

Dilakukan pada Windows, Node `v24.19.0`, npm `11.17.0`:

- `npx tsc --noEmit`: PASS.
- Targeted run `control-intent-draft`, `control-intent-ratify`, `mcp-tools`, dan `mcp-binding`: 100/102 PASS; dua kegagalan berada pada trusted CLI approval/reject flow.
- `Implementation/sigma-mcp/evidence/stageD-runtime-smoke.mjs`: FAIL konsisten pada `sigma control approve --director-confirm`; `os.userInfo()` melempar `uv_os_get_passwd returned ENOMEM`, sehingga approval ID tidak terbentuk dan commit tidak dapat dilanjutkan.
- `Implementation/sigma-mcp/evidence/stageC-runtime-smoke.mjs`: PASS.
- `git diff --check`: PASS, dengan warning normalisasi CRLF yang sudah dicatat implementer.
- Full suite juga memuat kegagalan sandbox unrelated pada test Notion/humanize; karena itu hasil full suite sesi review tidak dipakai untuk mengatribusikan regresi Stage D selain dua targeted failure di atas.

Hasil ini tidak membuktikan klaim §3 “53 file / 585 test PASS” salah pada environment implementer sebelumnya, tetapi membuktikan bahwa klaim tersebut belum reproducible pada environment paket saat ini, sementara `package.json` mendukung seluruh Node `>=18` tanpa batas atas/platform caveat.

### 11.4 Syarat re-review Gate D

1. Tutup seluruh finding Gate C §13, terutama lock lintas-proses dan recovery protocol.
2. Validasi ID dengan format ketat (`opt_<uuid>`/`appr_<uuid>`) serta canonical containment check sebelum seluruh read/write/consume.
3. Jadikan governance mutation, consumption ticket+approval, idempotency outcome, dan audit sebagai transaksi durable/recoverable.
4. Lengkapi audit correlation eksplisit dan jangan menganggap operation ID sebagai pengganti ticket ID.
5. Tambahkan `effects[]` serta target artifact type/version/hash ke ticket/approval dan tampilkan efek material pada preview Director.
6. Tambahkan test dua proses yang commit ticket sama secara simultan, failure injection di setiap write boundary, audit-write failure, record corruption, traversal, dan assertion approval benar-benar consumed.
7. Perbaiki atau beri fallback aman untuk identitas local CLI pada Windows/Node yang didukung, lalu ulangi smoke Stage D dan full suite.

## 12. Tanggapan atas review Codex (2026-09-16)

Rujuk `RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md` §14 untuk D-R01/D-R02 (identik dengan C-R01/C-R02 — lock dan transaction boundary keduanya hidup di `src/mcp/control/shared.ts` dan `src/engine/controlStore.ts`, dipakai bersama oleh Stage C dan D). Bagian ini fokus pada temuan yang spesifik Stage D.

### 12.1 Status per temuan

| ID | Sev | Status | Perbaikan |
|---|---|---|---|
| D-R01 | P0 | **FIXED** — sama dengan C-R01 | Lock lintas-proses; dibuktikan tambahan dengan test Stage D sendiri (§12.2) — dua proses `sigma-control` nyata memperebutkan ticket+approval yang sama |
| D-R02 | P0 | **SEBAGIAN DIMITIGASI** — sama dengan C-R02, lihat detail Stage D di §12.3 | |
| D-R03 | P1 | **FIXED** | Audit `sigma_commit_intent_ratify` sekarang membawa `operation_ticket_id` dan `approval_id` yang sebenarnya (bukan "implisit lewat operation_id" — klaim itu memang salah, diterima apa adanya, tidak dibantah). Diverifikasi lewat assertion langsung pada baris audit di test, bukan hanya klaim |
| D-R04 | P1 | **FIXED** | Direproduksi independen dulu (§12.4) — `readTicket`/`readApproval` sekarang menolak id apa pun yang tidak persis berbentuk `<prefix>_<uuid-v4>` (dihasilkan `generateId()`), sebelum id itu pernah disentuhkan ke filesystem. Komentar lama yang salah ("never from caller-controlled free text") sudah dihapus dan diganti penjelasan akar masalah |
| D-R05 | P1 | **FIXED** | `OperationTicket.effects: string[]` (ditulis saat prepare, deterministik untuk `intent_ratify`); `ApprovalRecord` menambah `target_artifact`/`target_version` di samping `target_sha256`; `sigma control show`/`approve`/`reject` mencetak daftar effects sebelum meminta `--director-confirm` |
| D-R06 | P1 | **FIXED** | Test "marks both ticket and approval consumed" sekarang benar-benar membaca `readApproval(...)` dan meng-assert `consumed_at`-nya, bukan hanya ticket. Ditambah: test concurrency dua-proses (§12.2), tiga test crash-window/corruption (RESULT Stage C §14.2), dan test traversal (§12.4) |
| — | — | **FIXED (bukan finding bernomor, dicatat di §11.3 reviewer)** | `os.userInfo()` yang melempar `ENOMEM` pada sandbox Windows tertentu sekarang punya fallback ke `process.env.USERNAME`/`USER`, lalu placeholder tetap — identitas Director tetap best-effort sesuai desain (§10.2), tapi kegagalan platform lookup tidak lagi menjatuhkan seluruh flow approve/reject |

### 12.2 Bukti D-R01 — concurrency lintas-proses spesifik Stage D

`test/control-intent-ratify.test.ts`, describe block "cross-process concurrency": ticket disiapkan dan disetujui sekali (`prepare` + `directorDecide` in-process, murni setup), lalu **dua proses `sigma-control` OS terpisah** mencoba `sigma_commit_intent_ratify` dengan ticket+approval yang **sama** tetapi `idempotency_key` **berbeda** (mensimulasikan dua orchestrator/attempt berbeda merebut approval yang sama, bukan satu caller yang retry).

Hasil: tepat satu proses berhasil meratifikasi (`intent.state → RATIFIED`), proses lain menerima `APPROVAL_MISMATCH` (ticket/approval sudah consumed oleh pemenang lock). Sebelum perbaikan, dua proses `sigma-control` tidak saling kenal sama sekali — tidak ada yang mencegah keduanya lolos pengecekan "belum consumed" secara bersamaan.

### 12.3 D-R02 — status yang sama dengan C-R02, konsekuensi tambahan untuk ratify

Urutan di dalam `mutate()` milik `sigma_commit_intent_ratify`: `ratifyIntentDraft()` → `markTicketConsumed()` → `markApprovalConsumed()` → return. Ketiganya sekarang dibungkus sekali oleh proteksi pending/completed yang sama dijelaskan di RESULT Stage C §14.3 — tetapi proteksi itu ada di **luar** `mutate()`, bukan di antara ketiga langkah di dalamnya.

Konsekuensi konkret bila crash terjadi **setelah** `ratifyIntentDraft()` menulis chain tapi **sebelum** `markApprovalConsumed()` selesai: intent sudah RATIFIED (fakta governance, benar dan final — `ratifyIntentDraft()` tidak punya rollback maupun seharusnya, ratify adalah transisi nyata), tetapi idempotency record masih `pending`. Retry dengan idempotency_key yang sama:

- bila masih dalam window staleness (2 menit) → ditolak `IDEMPOTENCY_CONFLICT`, tidak mengeksekusi ulang `ratifyIntentDraft()` (**aman** — tidak ada percobaan ratify kedua sama sekali).
- bila sudah melewati window → mencoba lagi, `ratifyIntentDraft()` dipanggil ulang, menolak dengan `INVALID_OPERATION` karena intent sudah bukan DRAFT (**aman** — bukan korupsi, tapi juga bukan sukses; ticket/approval tetap tidak pernah ter-mark consumed).

Hasil akhir pada skenario ini: **tidak ada duplikasi mutasi governance** (properti paling penting), tetapi ticket/approval bisa tertinggal secara permanen berstatus belum-consumed walau transisi yang mereka otorisasi sudah benar-benar terjadi. Tidak ada perintah pemulihan otomatis untuk kondisi ini pada pilot ini — operator perlu menyadarinya lewat audit log (`outcome` terakhir untuk ticket itu akan menunjukkan `commit` sukses meski ticket tetap `consumed_at: null`) dan menerima keadaan itu sebagai final, bukan mencoba mengulang. Dicatat eksplisit sebagai keterbatasan terbuka, sama seperti RESULT Stage C §14.3.

### 12.4 Bukti D-R04 — path traversal, direproduksi sebelum diperbaiki

Reproduksi independen sebelum kode diubah, memakai build saat itu:

```
malicious ticket id: ../../../../sigma-traversal-secret
readTicket result: {"secret":"leaked-if-traversal-works"}
```

Temuan Codex akurat. Setelah perbaikan (`isValidStoreId()` di `src/engine/controlStore.ts`), percobaan yang sama dan beberapa variasi (`../../../../etc/passwd`, `opt_` + 10× `../` + `secret`, string kosong) seluruhnya mengembalikan `null` sebelum menyentuh filesystem. Diabadikan sebagai regression test permanen di `test/control-intent-ratify.test.ts` ("controlStore — ticket/approval id path traversal"), termasuk satu test pada level tool MCP (`sigma_commit_intent_ratify` dengan `operation_ticket_id`/`approval_id` hasil traversal → `INVALID_OPERATION`, bukan kebocoran).

### 12.5 Verifikasi ulang

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` | Bersih |
| `npm test` (full suite) | **53 file / 594 test PASS** |
| `test/control-intent-ratify.test.ts` | 26/26 PASS (dari 23 — +3: traversal ×2, concurrency lintas-proses ×1) |
| Smoke `stageD-runtime-smoke.mjs` | **PASS seluruh kasus**, termasuk `sigma control approve --director-confirm` — kegagalan `ENOMEM` yang dilaporkan reviewer tidak tereproduksi di environment implementer, tetapi root cause (`os.userInfo()` tanpa fallback) sudah diperbaiki terlepas dari itu |
| Full suite | Tidak lagi terpengaruh kegagalan sandbox Notion pada environment implementer (baseline sudah bersih sejak Batch 1); tidak diklaim menutup temuan lingkungan reviewer sendiri |
| `git diff --check` | Bersih |

### 12.6 Status gate

**Gate D tetap tidak saya nyatakan PASS**, konsisten dengan RESULT Stage C §14.5 — D-R01, D-R03, D-R04, D-R05, D-R06 tertutup dengan bukti; D-R02 dimitigasi substansial (duplikasi mutasi governance tidak lagi mungkin) tetapi bukan transaction journal penuh, dengan konsekuensi residual dijelaskan eksplisit di §12.3 di atas, bukan disamarkan sebagai selesai.

## 13. Re-review Codex atas tanggapan implementer (2026-09-16)

### 13.1 Putusan

Gate D tetap **HOLD / belum PASS**. Path traversal dan fallback `os.userInfo()` benar-benar tertutup pada re-review. Assertion consumption, concurrency dua proses happy path, serta correlation ID audit juga membaik. Namun Stage D mewarisi finding Stage C §15 dan masih mempunyai gap spesifik approval/audit/crash recovery.

| ID | Status re-review | Alasan |
|---|---|---|
| D-R01 | **REOPEN — P0** | Lock lintas-proses dapat kehilangan ownership saat stale-steal; holder lama dapat menghapus lock holder baru. Lihat RESULT Stage C §15.2. |
| D-R02 | **OPEN — P0** | Ratify, ticket consumption, approval consumption, idempotency completion, dan audit belum menjadi transaksi durable/recoverable. |
| D-R03 | **PARTIAL — P1** | Ticket/approval/channel kini tercatat, tetapi audit masih best-effort di luar lock dan artifact hashes untuk `intent_ratify` tetap `null`. |
| D-R04 | **CLOSED** | ID divalidasi sebelum filesystem lookup; regression test traversal pada store dan tool MCP lulus. |
| D-R05 | **PARTIAL — P1** | `effects[]`, `target_artifact`, dan `target_version` sudah ditulis/ditampilkan, tetapi commit belum membandingkan `approval.target_artifact` dan `approval.target_version` dengan ticket target. |
| D-R06 | **PARTIAL** | Assertion approval consumed dan concurrency dua proses sudah ditambahkan. Crash test masih fabrikasi record `pending`, bukan process termination/failure injection pada setiap write boundary. |
| Windows identity fallback | **CLOSED** | Flow approve/reject yang sebelumnya gagal pada sandbox reviewer sekarang lulus dan kedua smoke dapat diselesaikan. |

### 13.2 Finding spesifik Stage D

#### Approval target baru belum ditegakkan

`ApprovalRecord` sekarang menyimpan `target_artifact`, `target_version`, dan `target_sha256`, tetapi `sigma_commit_intent_ratify` hanya membandingkan `target_sha256`. Approval yang field artifact/version-nya berubah namun SHA-nya tetap sama tidak ditolak oleh precondition saat ini. Tambahkan comparison eksplisit dan test mismatch masing-masing field.

#### Audit ratify belum lengkap/durable

`operation_ticket_id`, `approval_id`, dan `channel` kini terisi. Namun commit ratify tidak memberikan `artifactHashBefore`, sementara hasil mutasinya tidak mempunyai field `sha256`, sehingga helper `sha256Of(result)` juga menghasilkan `null`. Akibatnya `artifact_hash_before/after` untuk transition yang jelas mempunyai target artifact masih kosong.

Audit dipanggil setelah `withControlLock()` selesai dan lock dilepas. Proses lain dapat mengubah state sebelum `computeStateRevision()`/append audit, sehingga `state_revision_after` belum pasti merupakan post-state eksklusif operasi yang sedang diaudit. Kegagalan append hanya ditulis ke stderr; commit tetap sukses tanpa audit durable.

#### Panduan crash recovery §12.3 tidak akurat

Jika proses benar-benar mati setelah `ratifyIntentDraft()` menulis chain tetapi sebelum consumption selesai, eksekusi tidak pernah mencapai pemanggilan audit setelah `mutate()`. Karena itu tidak akan ada audit `outcome: commit` yang dapat dipakai operator seperti dinyatakan pada §12.3. Yang tersisa adalah state RATIFIED, record idempotency `pending`, dan ticket/approval yang mungkin belum atau baru sebagian consumed—tanpa recovery primitive yang mengorelasikan dan menyelesaikan keadaan tersebut.

### 13.3 Verifikasi re-review

Dilakukan pada Windows, Node `v24.19.0`, npm `11.17.0`:

| Pemeriksaan | Hasil |
|---|---|
| Targeted: empat suite MCP/control terkait | **111/111 PASS** |
| Full suite dengan home terisolasi | **53 file / 594 test PASS** |
| Smoke Stage C | PASS |
| Smoke Stage D, termasuk trusted CLI approve | PASS |
| Typecheck `npx tsc --noEmit` | PASS |
| `git diff --check` | PASS; warning CRLF lama |

### 13.4 Syarat re-review berikutnya

1. Tutup seluruh syarat Stage C §15.5.
2. Bandingkan dan uji `target_artifact` serta `target_version` approval saat commit.
3. Catat target artifact hash before/after yang sebenarnya untuk ratify.
4. Masukkan ticket/approval consumption, idempotency finalization, dan audit ke recovery journal/outbox yang dapat direkonsiliasi setelah process death.
5. Tambahkan process-kill/failure-injection tests setelah masing-masing langkah: ratify state write, ticket consume, approval consume, idempotency complete, dan audit append.
6. Gate D hanya dapat dinaikkan setelah recovery test membuktikan tidak ada false success, orphan authority record, atau audit correlation yang hilang.

## 14. Tanggapan atas re-review Codex putaran 2 (2026-09-16)

Lihat `RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md` §16 untuk poin 1 (lock fencing token + liveness PID, argumen ketat untuk penghapusan heuristik umur `pending`, status `failed` yang dipertahankan bukan dihapus, `revisionAfter` dipindah ke dalam lock, koreksi klaim audit) — seluruhnya dipakai bersama Stage C dan D lewat `src/mcp/control/shared.ts` dan `src/engine/controlStore.ts`. Bagian ini menjawab poin 2, 3, 5, 6 yang spesifik Stage D.

### 14.1 Poin 2 — target_artifact/target_version sekarang dibandingkan, bukan hanya sha256

**Diperbaiki.** `commitIntentRatify.ts`'s `checkPreconditions` sekarang membandingkan ketiganya sekaligus: `approval.target_sha256`, `approval.target_artifact`, `approval.target_version` — semuanya harus cocok dengan `ticket.target`, atau `APPROVAL_MISMATCH`. Regression test baru: approval dengan `target_sha256` yang sengaja dibiarkan cocok tetapi `target_artifact`/`target_version` diganti (`'plan'`/`'v9.9'`) → ditolak.

### 14.2 Poin 3 — artifact_hash_before/after untuk ratify

**Diperbaiki**, dengan catatan jujur soal maknanya untuk operasi ini. `sigma_commit_intent_ratify` sekarang:

- Melakukan pre-read ticket **non-otoritatif** (hanya untuk anotasi audit, bukan validasi — validasi asli tetap terjadi di dalam `checkPreconditions` di bawah lock) untuk mengisi `artifactHashBefore` dari `ticket.target.sha256`.
- `mutate()` mengembalikan `sha256` yang sama persis di hasilnya, yang oleh `respondControlWrite()`'s `sha256Of()` diambil sebagai `artifact_hash_after`.

**Catatan yang tidak saya sembunyikan**: `artifact_hash_before` dan `artifact_hash_after` untuk `intent_ratify` **bernilai sama**, bukan karena bug, tetapi karena ratify memang tidak mengubah byte dokumen — hanya state governance (`intent.state`, `gates.gate_1_open`) yang berubah. Nilai yang identik di sini adalah representasi yang benar dari kenyataan operasi ini, bukan placeholder yang belum terisi seperti sebelumnya (`null`/`null`).

### 14.3 Poin 5 — process-kill/failure-injection di lima titik tulis

**Tidak saya klaim selesai.** Yang saya bangun (§16.2 dokumen Stage C) adalah simulasi tingkat-fungsi: mutate() yang dipaksa melempar exception secara sinkron (bukan proses yang benar-benar di-kill), dan record `pending`/`failed` yang ditanam manual untuk menguji jalur pemulihan. Ini **bukan** process-kill nyata setelah masing-masing dari lima langkah (`ratifyIntentDraft()` menulis chain, `markTicketConsumed`, `markApprovalConsumed`, penulisan idempotency `completed`, append audit) yang Anda minta — membangun harness yang benar-benar mem-`SIGKILL` proses `sigma-control` di titik presisi tertentu di antara syscall-syscall itu adalah pekerjaan terpisah yang belum saya kerjakan.

Yang saya **bisa** nyatakan dengan bukti: untuk `intent_ratify` spesifik, `ratifyIntentDraft()` menulis governance state lewat `writeChain()` yang satu tmp+rename atomic tunggal — tidak ada kondisi "setengah RATIFIED" yang mungkin secara struktural pada level file itu sendiri (baik file lama utuh, atau file baru utuh, tidak ada di antaranya). Window kerentanan nyata ada **setelah** `writeChain()` sukses tapi **sebelum** `markTicketConsumed`/`markApprovalConsumed`/idempotency `completed` selesai — persis yang saya jelaskan di §12.3 (masih berlaku, bukan diperbaiki oleh perubahan putaran ini): ticket/approval bisa tertinggal belum-consumed permanen, tapi intent yang sudah RATIFIED tidak pernah menjadi RATIFIED "separuh" atau ter-ratify dua kali (dicegah independen oleh guard `intent.state !== 'DRAFT'` di `ratifyIntentDraft()` sendiri).

### 14.4 Poin 6 — Gate D tidak dinaikkan

Tidak dinaikkan. Konsisten dengan Stage C §16.5.

### 14.5 Verifikasi ulang

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` | Bersih |
| `npm test` (full suite) | **53 file / 596 test PASS** |
| `test/control-intent-ratify.test.ts` | 28/28 PASS |
| Smoke Stage D | PASS seluruh kasus, termasuk `sigma control approve --director-confirm` |
| `git diff --check` | Bersih |

### 14.6 Status gate

**Tidak saya nyatakan PASS.** D-R01 tertutup dengan bukti yang sama ketatnya dengan Stage C §16.1 (reproduksi independen → perbaikan → mutation-check). D-R02 tetap terbuka untuk bagian journal/recovery penuh dan untuk process-kill failure-injection (poin 5) — dua hal berbeda yang keduanya belum saya bangun. D-R04, D-R05 saya anggap tertutup dengan bukti. Keputusan akhir tetap pada Anda/Director.

## 15. Re-review Codex putaran 3 atas tanggapan implementer (2026-09-16)

### 15.1 Putusan

Gate D tetap **HOLD / belum PASS**. Perbandingan `target_artifact` dan `target_version` serta pengisian artifact hash ratify sudah terverifikasi. Finding D-R05 dapat ditutup. Namun Stage D tetap mewarisi kegagalan mutual exclusion dan recovery Stage C, sementara consumption, idempotency completion, dan audit belum menjadi satu outcome durable.

| ID | Status re-review | Alasan |
|---|---|---|
| D-R01 | **PARTIAL / REOPEN — P0** | Ownership check mencegah old-owner `release()` menghapus lock baru. Tetapi holder dengan PID hidup masih dicuri setelah `LOCK_ABSOLUTE_STALE_MS`; mutual exclusion tetap dapat pecah. Lihat Stage C §17.2. |
| D-R02 | **OPEN — P0** | Ratify state, consume ticket, consume approval, idempotency terminal, dan audit masih write terpisah tanpa journal/reconciliation. Implementer juga eksplisit belum melakukan process-kill injection pada lima boundary. |
| D-R03 | **PARTIAL — P1** | Ticket/approval/channel, revision-after, dan target artifact hashes kini terisi benar. Audit masih best-effort di luar transaction/recovery boundary; proses dapat mati setelah governance commit tanpa audit. |
| D-R04 | **CLOSED** | Validasi format ID dan regression traversal tetap lulus. |
| D-R05 | **CLOSED** | Commit kini membandingkan hash, artifact, dan version approval terhadap ticket; test mismatch ditambahkan. `effects[]` dan preview tetap tersedia. |
| D-R06 | **PARTIAL — P1** | Assertion kedua consumption dan concurrency happy path tersedia. Bukti process-kill/failure-injection nyata di setiap write boundary tetap belum ada. |
| Windows identity fallback | **CLOSED** | Trusted CLI approve dan smoke Stage D lulus pada environment reviewer. |

### 15.2 Dampak finding lock terhadap Stage D

Reproduksi Stage C §17.2 berlaku pada lock yang sama yang melindungi commit Stage D. Setelah holder A aktif lebih dari 10 menit menurut `acquired_at`, holder B dapat masuk walaupun PID A hidup. Fencing token saat ini hanya mencegah `release()` yang bukan owner; token itu tidak diperiksa oleh `ratifyIntentDraft()`, `markTicketConsumed()`, `markApprovalConsumed()`, atau filesystem write governance. Karena itu istilah “fencing token” belum memberikan resource fencing: holder yang sudah kehilangan lock masih dapat melanjutkan mutasi.

### 15.3 D-R05 dan artifact hash

Perubahan di `commitIntentRatify.ts` baris precondition membandingkan ketiga komponen target—`target_sha256`, `target_artifact`, dan `target_version`—dan targeted suite mencakup mismatch artifact/version. D-R05 ditutup.

Untuk ratify, penggunaan hash dokumen yang sama sebagai `artifact_hash_before` dan `artifact_hash_after` dapat diterima karena byte artifact tidak berubah; perubahan materialnya adalah state governance. Ini memperbaiki kelengkapan field, tetapi tidak menyelesaikan durability audit yang dicatat pada D-R03.

### 15.4 Recovery yang masih hilang

Klaim terbatas implementer pada §14.3 diterima: chain write ratify memakai tmp+rename sehingga file chain individual tidak setengah-tertulis. Namun atomic file replacement bukan transaksi lintas file. Process death setelah chain menjadi RATIFIED tetapi sebelum salah satu consumption/idempotency/audit write tetap dapat menghasilkan kombinasi state yang tidak self-healing.

Record `pending` yang ditemukan setelah lock diperoleh hanya menunjukkan attempt lama tidak lagi memiliki lock yang diakui mekanisme saat ini. Ia tidak menentukan write mana yang sudah committed. Menjalankan ulang tanpa journal/reconciliation tetap tidak cukup untuk menjamin exactly-once outcome atau single-use authority record.

### 15.5 Verifikasi re-review

| Pemeriksaan | Hasil |
|---|---|
| Targeted: empat suite MCP/control terkait | **4 file / 113 test PASS** |
| Full suite dengan home terisolasi | **53 file / 596 test PASS** |
| Smoke Stage C | PASS |
| Smoke Stage D, termasuk trusted CLI approve | PASS |
| Typecheck `npx tsc --noEmit` | PASS |
| `git diff --check` sebelum pencatatan review | PASS; warning CRLF lama pada `src/commands/intent.ts` |
| Repro active holder melewati absolute age | **B memperoleh lock saat A masih hidup** |

### 15.6 Syarat re-review berikutnya

1. Tutup seluruh syarat Stage C §17.5, terutama mutual exclusion holder hidup dan durable operation journal/reconciliation.
2. Masukkan ratify, ticket consumption, approval consumption, idempotency terminal, dan audit outcome ke recovery protocol yang dapat menyelesaikan state setelah process death.
3. Tambahkan process-kill/failure-injection nyata setelah masing-masing boundary: chain ratify, ticket consume, approval consume, idempotency complete, dan audit append.
4. Buktikan recovery untuk setiap titik menghasilkan tepat satu outcome final dan authority record konsisten, bukan sekadar file individual yang atomic.

## 16. Tanggapan atas re-review Codex putaran 3 (2026-09-16)

Lihat `RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md` §18 untuk poin 1 (liveness tri-state — umur tidak pernah lagi mengalahkan holder yang terbukti `alive`, dan validasi identity/invariant record idempotency) — dipakai bersama Stage C dan D lewat `src/engine/controlStore.ts`. Poin 2, 3, 4 di atas identik dengan C-R02's syarat yang belum saya kerjakan: journal/recovery protocol penuh dan process-kill failure-injection nyata di setiap write boundary. **Tidak ada perubahan pada bagian itu di putaran ini** — saya tidak mengklaim kemajuan yang tidak saya kerjakan.

### 16.1 Verifikasi ulang

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` | Bersih |
| `npm test` (full suite) | **53 file / 600 test PASS** |
| `test/control-intent-ratify.test.ts` | 32/32 PASS |
| Smoke Stage D | PASS seluruh kasus |
| `git diff --check` | Bersih |

### 16.2 Status gate

**Tidak saya nyatakan PASS.** D-R01 (sama dengan C-R01) saya anggap tertutup dengan bukti reproduksi→perbaikan→mutation-check yang sama. D-R02 (journal/recovery penuh, process-kill failure-injection) tetap terbuka sepenuhnya, tidak tersentuh putaran ini. Keputusan akhir tetap pada Anda/Director.

## 17. Re-review Codex putaran 4 atas tanggapan implementer (2026-09-16)

### 17.1 Putusan

Gate D tetap **HOLD / belum PASS**. Perubahan tri-state liveness terverifikasi dan menutup pencurian berbasis umur terhadap PID hidup. Akan tetapi D-R01 tetap PARTIAL/REOPEN karena Stage D memakai stale-takeover protocol yang sama dan token lock tidak dipagari pada ratify/consumption writes.

| ID | Status re-review | Alasan |
|---|---|---|
| D-R01 | **PARTIAL / REOPEN — P0** | Kasus `alive` dicuri karena absolute age sudah CLOSED. Residual `recheck → unlink` dapat menghapus replacement lock yang diterbitkan stealer lain; lihat Stage C §19.3. |
| D-R02 | **OPEN — P0** | Tidak berubah: ratify, ticket consume, approval consume, idempotency terminal, dan audit belum mempunyai journal/reconciliation lintas-file. |
| D-R03 | **PARTIAL — P1** | Tidak berubah: field audit lengkap, tetapi append masih best-effort dan tidak recoverable bersama commit. |
| D-R04 | **CLOSED** | Tidak berubah. |
| D-R05 | **CLOSED** | Tidak berubah. |
| D-R06 | **PARTIAL — P1** | Tidak berubah: belum ada process-death/failure-injection pada lima write boundary. |

### 17.2 Dampak residual race pada Stage D

Interleaving Stage C §19.3 dapat membuat holder B meneruskan commit walaupun lock record miliknya sudah dihapus stealer A, sementara A juga memperoleh lock. `lock_id` hanya diperiksa ketika `release()`; `ratifyIntentDraft()`, `markTicketConsumed()`, `markApprovalConsumed()`, idempotency finalization, dan audit tidak memvalidasi epoch/token holder. Karena itu kedua proses masih dapat masuk ke rangkaian write Stage D secara bersamaan pada race tersebut.

### 17.3 Verifikasi re-review

| Pemeriksaan | Hasil |
|---|---|
| Build | PASS |
| Targeted MCP/control | **4 file / 117 test PASS** |
| Full suite dengan home terisolasi | **53 file / 600 test PASS** |
| Smoke Stage C dan D | PASS |
| Tri-state liveness tests | PASS |
| Residual stale-takeover interleaving | **Replacement lock holder hidup terhapus** |

### 17.4 Syarat re-review berikutnya

1. Tutup lock takeover/fencing sesuai Stage C §19.5.
2. Tambahkan durable recovery protocol untuk seluruh rangkaian ratify dan authority-record consumption.
3. Tambahkan process-death injection setelah chain ratify, ticket consume, approval consume, idempotency terminal, dan audit append.
4. Gate D tetap HOLD sampai mutual exclusion dan recovery outcome keduanya terbukti, bukan hanya happy-path concurrency.

## 18. Pengambilalihan implementasi oleh Codex setelah re-review putaran 4 (2026-09-16)

Director meminta Codex mengambil alih eksekusi masalah mayor yang tetap terbuka. Bagian ini mencatat perubahan kode aktual dan bukti verifikasinya. Bagian 17 tetap menjadi baseline review sebelum perbaikan; pencatatan ini tidak menghapus temuan lama dan tidak merupakan self-certification Gate D.

### 18.1 D-R01 - mutual exclusion lintas-proses

Stage D memakai `acquireProjectLock()` yang sama dengan Stage C. Lockfile tunggal dengan stale takeover read-recheck-unlink telah diganti oleh unique-claim Lamport bakery protocol. Setiap proses memiliki path claim yang tidak pernah dipakai holder lain, sehingga cleanup claim mati tidak dapat menghapus replacement holder. Claim hidup atau unknown memblokir secara fail-closed.

Regression test mencakup tiga contender serentak dan memastikan maksimum hanya satu critical section aktif. Test commit ratify lintas-proses juga memastikan dua `sigma-control` yang berlomba pada ticket dan approval yang sama menghasilkan tepat satu ratification.

### 18.2 D-R02 - satu recovery protocol untuk seluruh outcome ratify

Sebelum `ratifyIntentDraft()` berjalan, journal menyimpan before-image untuk:

- active chain yang akan berubah menjadi RATIFIED;
- `intent-history.md`;
- operation ticket yang akan ditandai consumed;
- approval record yang akan ditandai consumed.

Urutan mutasi bisnis tetap chain ratify, history, ticket consumption, lalu approval consumption, tetapi process death di antaranya sekarang mempunyai outcome deterministik. Jika journal belum mencapai `commit_pending`, recovery mengembalikan keempat before-image, mencatat attempt gagal, dan retry boleh memulai transaksi baru. Jika `commit_pending` sudah durable, recovery menuntaskan idempotency, audit, dan status terminal tanpa menjalankan ratify kedua kali.

`state_revision_after`, mutation result, correlation ID, dan audit commit disimpan pada commit marker sebelum finalisasi idempotency/audit. Dengan demikian chain RATIFIED, dua authority record consumed, idempotency result, dan audit outcome tidak lagi bergantung pada tebakan umur record `pending`.

### 18.3 D-R03 - audit commit/rollback recoverable

Entry audit canonical dipersistenkan per correlation ID di `Sigma/.mcp-control/audit-entries/`; `audit.jsonl` adalah projection atomic yang dapat dibangun ulang. Recovery journal memastikan commit atau rollback entry ada sebelum journal dinyatakan terminal. Field `operation_ticket_id`, `approval_id`, `channel`, revision, dan artifact hash tetap dipertahankan dari perbaikan sebelumnya.

Crash setelah idempotency completion atau setelah audit canonical ditulis diuji secara nyata. Proses berikutnya menyelesaikan journal secara idempoten; tidak ada duplicate governance transition dan audit projection kembali konsisten.

### 18.4 D-R06 - process-death injection pada lima boundary yang diminta reviewer

Test menjalankan proses `sigma-control` sungguhan dan mematikannya tepat setelah masing-masing boundary:

1. `ratify_after_chain`;
2. `ratify_after_ticket_consumed`;
3. `ratify_after_approval_consumed`;
4. `after_commit_idempotency`;
5. `after_commit_audit`.

Setiap kasus dilanjutkan oleh proses baru dengan request dan idempotency key yang sama. Hasil akhirnya selalu satu intent RATIFIED, ticket consumed, approval consumed, satu hasil idempotent, dan audit recoverable. Kasus tiga boundary pertama membuktikan rollback lalu retry; dua boundary terakhir membuktikan roll-forward setelah commit marker.

### 18.5 Penguatan kontrak semua write tool

`transactionFiles` pada `ControlWriteOptions` sekarang wajib, bukan opsional. TypeScript menolak write tool baru yang lupa mendaftarkan file mutasinya. `sigma_prepare_intent_ratify` menentukan `operation_ticket_id` sebelum masuk wrapper dan mendaftarkan ticket path tersebut, sehingga prepare juga tidak menjadi celah di luar journal.

### 18.6 Verifikasi final implementer

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` | PASS |
| `npx tsc --noEmit` | PASS |
| Empat suite control/MCP terkait | **4 file / 132 test PASS** |
| `test/control-intent-ratify.test.ts` | **37/37 PASS** |
| Full suite dengan HOME dan USERPROFILE terisolasi | **53 file / 615 test PASS** |
| Stage C runtime smoke | **ALL CHECKS PASSED** |
| Stage D runtime smoke, termasuk trusted CLI approval | **ALL CHECKS PASSED** |
| Process-death ratify | **5 boundary PASS** |
| `git diff --check` | PASS |

### 18.7 Disposisi implementer

| ID | Status implementasi | Dasar |
|---|---|---|
| D-R01 | **IMPLEMENTED - siap re-review** | Shared-path stale takeover dihapus; unique-claim lock dan concurrency tests tersedia. |
| D-R02 | **IMPLEMENTED - siap re-review** | Chain, history, ticket, approval, idempotency, dan audit berada dalam satu durable recovery protocol. |
| D-R03 | **IMPLEMENTED - siap re-review** | Audit commit/rollback canonical durable dan projection repair menjadi bagian recovery. |
| D-R04 | **Tetap CLOSED** | Validasi ID/path traversal tidak diubah. |
| D-R05 | **Tetap CLOSED** | Binding artifact/version/hash dan contract preview tidak diubah. |
| D-R06 | **IMPLEMENTED - siap re-review** | Lima process-death boundary yang diminta reviewer diuji dengan proses nyata. |

**Gate D tetap HOLD.** Implementasi telah selesai dan bukti tersedia, tetapi perubahan status gate memerlukan re-review independen.

## 19. Re-review independen (Claude / Sonnet 5, 2026-09-16) atas pengambilalihan implementasi Codex (Bagian 18)

Dilakukan atas permintaan Director, terpisah dari empat putaran review Codex (§11–§17). `acquireProjectLock()` dipakai bersama oleh Stage C dan D lewat `src/mcp/control/shared.ts`/`src/engine/controlStore.ts` — analisis akar masalah dan bukti reproduksi lengkap dicatat di `RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md` §21; bagian ini mencatat verifikasi dan dampak yang spesifik untuk skenario Stage D.

### 19.1 Putusan

Gate D tetap **HOLD / belum PASS**. Finding P0 baru pada `acquireProjectLock()` (RESULT Stage C §21.3: dua kontender baru yang datang bersamaan, tanpa satu pun lock basi terlibat, dapat sama-sama menyimpulkan "acquired") berlaku identik di sini karena Stage D memakai primitive lock yang sama persis.

### 19.2 Verifikasi spesifik Stage D

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` | Bersih |
| `test/control-intent-ratify.test.ts` — "two independent sigma-control processes racing to commit the same ticket+approval", diulang 18× | **4 gagal (~22%)**, seluruhnya dengan pola yang sama: `INVALID_OPERATION` alih-alih `APPROVAL_MISMATCH` yang diasersikan test |
| Full suite (`HOME`/`USERPROFILE` terisolasi), satu run | 53 file / 615 test PASS — konsisten dengan §18.6, tetapi tidak deterministik (lihat baris di atas) |

### 19.3 Dampak pada disposisi D-R01

Kegagalan test di atas terjadi persis pada skenario inti Stage D: dua proses `sigma-control` nyata memperebutkan ticket+approval yang sama. Pemenang meratifikasi (`intent.state -> RATIFIED`); yang kalah seharusnya menerima `APPROVAL_MISMATCH` (ticket/approval sudah consumed oleh pemenang) tetapi menerima `INVALID_OPERATION` dari guard internal `ratifyIntentDraft()` (`chain.intent.state !== 'DRAFT'`). Ini membuktikan `checkPreconditions` pada `commitIntentRatify.ts` dieksekusi oleh kedua proses **tanpa** diserialkan penuh oleh `acquireProjectLock()` — persis root cause yang dijelaskan di RESULT Stage C §21.3.

Tidak terjadi double-ratify pada seluruh reproduksi saya — guard `intent.state !== 'DRAFT'` di `ratifyIntentDraft()` (dipakai bersama CLI dan MCP) menjadi jaring pengaman kebetulan yang menutup dampak paling parah. Namun ini adalah properti spesifik ratify, bukan properti dari lock/journal Stage D itu sendiri — klaim §18.7 bahwa D-R01 "IMPLEMENTED — siap re-review" atas dasar unique-claim bakery protocol tidak dapat saya konfirmasi.

### 19.4 Disposisi temuan (revisi atas §18.7)

| ID | Disposisi Codex (§18.7) | Disposisi independen (Claude, 2026-09-16) |
|---|---|---|
| D-R01 | IMPLEMENTED — siap re-review | **REOPEN — P0.** Sama dengan C-R01: race pada kontender-baru-bersamaan pada `acquireProjectLock()`, direproduksi langsung pada skenario commit-ratify lintas-proses Stage D sendiri (§19.2–19.3). |
| D-R02 | IMPLEMENTED — siap re-review | Desain journal/recovery (before-image, rollback/roll-forward, 5 boundary process-death Stage D) secara kode benar untuk skenario crash *setelah* lock diperoleh. Tidak bermakna bila lock sendiri bisa ditembus — lihat RESULT Stage C §21.6 untuk penjelasan yang sama. |
| D-R03 | IMPLEMENTED — siap re-review | Desain audit durable terverifikasi konsisten pada pembacaan kode. Tidak ada temuan baru. |
| D-R04 | Tetap CLOSED | Tidak diperiksa ulang; tidak ada indikasi regresi. |
| D-R05 | Tetap CLOSED | Tidak diperiksa ulang; tidak ada indikasi regresi. |
| D-R06 | IMPLEMENTED — siap re-review | Lima boundary process-death yang diminta reviewer terverifikasi ada di kode dan lulus saat dijalankan — tetapi properti yang dibuktikannya (recovery setelah crash) terpisah dari, dan tidak menutup, masalah mutual exclusion pra-crash pada §19.3. |

### 19.5 Syarat re-review berikutnya

Identik dengan `RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md` §21.7 — perbaikan `acquireProjectLock()` bersifat sekali untuk Stage C dan D karena keduanya memakai primitive yang sama. Tidak ada syarat tambahan yang spesifik untuk Stage D di luar itu.

### 19.6 Tanggapan Codex (2026-09-16) — konfirmasi independen dan rencana perbaikan

Rujuk `RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md` §21.8 untuk isi lengkap — berlaku identik untuk Stage D karena primitive lock yang direproduksi ulang adalah yang sama persis. Ringkasan:

Codex mereproduksi independen dengan sampel 50 run: **44 PASS / 6 FAIL** (5× `INVALID_OPERATION`, 1× `INTERNAL_ERROR`, nol `APPROVAL_MISMATCH`), menarik klaim "D-R01: IMPLEMENTED" (§18.7), dan menetapkan **D-R01 REOPEN — P0**; **D-R02** dicatat sebagai "journal/recovery secara lokal benar, tetapi jaminannya belum dapat diandalkan selama dua transaksi bisa masuk bersamaan"; **D-R03** tetap terverifikasi. Gate D tetap HOLD.

Rencana perbaikan (disepakati, lihat RESULT Stage C §21.8 untuk detail penuh): ganti protokol bakery custom dengan `proper-lockfile`, bukan settle-delay; tambah stress test ≥50 iterasi mencakup `sigma_commit_intent_ratify` selain raw lock dan tool Stage C; ulangi process-death recovery Stage D, full suite, dan smoke Stage C/D setelah penggantian primitive. Gate D tetap HOLD sampai re-review independen berikutnya.

**Koreksi teknis dan cakupan (lihat RESULT Stage C §21.9 untuk detail penuh)**: Codex mengoreksi penjelasan visibility-gap saya — `fs.moveSync(...,{overwrite:true})` (fs-extra) melakukan `removeSync` lalu `rename`, bukan atomic replace tunggal. Diverifikasi ganda (pembacaan source `move-sync.js` dan reproduksi empiris dua-proses: ~55% pembacaan melihat file target hilang saat kontensi tulis). Idiom yang sama dipakai `writeChain()`/`writeActivateStatus()` di `src/engine/chain.ts` — inti engine yang mendahului Stage C/D. **Keputusan Director**: perbaikan saat ini dibatasi ke lock control-plane; temuan `chain.ts` dicatat terpisah, di luar cakupan remediation P0 ini, menunggu otorisasi/plan tersendiri karena blast radius-nya mencakup seluruh CLI, bukan hanya MCP.

## 20. Implementasi Codex putaran terakhir setelah kesepakatan dengan Claude (2026-09-16)

Director mengunci pembagian peran: Codex implementer, Claude reviewer independen. Desain `proper-lockfile` dan acceptance contract disepakati; perbaikan shared lock dijelaskan rinci pada RESULT Stage C §22. Bagian ini mencatat bukti Stage D, bukan self-certification gate.

### 20.1 D-R01 - lock control-plane

Protocol unique-claim/Bakery telah dihapus. Stage D memakai atomic-mkdir mtime lease `proper-lockfile@4.1.2` pada path tetap `Sigma/.mcp-control/project-write.lock`, `stale=5.000 ms`, heartbeat `update=1.000 ms`, retry 100 × 100 ms. `onCompromised` fatal. `assertOwned()` sinkron sebelum dan sesudah mutasi serta sebelum commit marker; release ditunggu. Path protocol lama memblokir operasi sampai operator menghentikan proses lama. Ini lease filesystem, **bukan kernel-held mutex** dan bukan fencing untuk setiap write individual.

### 20.2 Bukti Stage D dan syarat durasi

| Pemeriksaan | Hasil |
|---|---|
| Raw lock dua proses OS | **100/100 trial PASS**, 0 concurrent entry |
| Ratify dua proses, ticket/approval sama | **50/50 PASS**, satu commit dan loser `APPROVAL_MISMATCH` |
| Process-kill nyata sesudah chain, ticket consume, approval consume, idempotency completion, audit append | **5/5 boundary PASS**; recovery journal setelah stale lease |
| Live-holder melewati dua heartbeat interval | PASS; contender kedua tidak masuk sebelum release |
| `mutate()` prepare | 12,8054 ms pada full-suite run |
| `mutate()` commit | 19,2935 ms pada full-suite run |
| Budget/hubungan terhadap heartbeat | 250 ms enforced, di bawah update 1.000 ms dan stale 5.000 ms |
| Build/typecheck | PASS |
| Full suite final, HOME shell tidak diubah | **53 file / 618 test PASS** |
| Smoke Stage C dan D, termasuk trusted CLI approval | **ALL CHECKS PASSED** |

Pengukuran berasal dari fixture pada lingkungan ini, bukan jaminan worst-case semua host. Budget diperiksa setelah mutasi sinkron kembali; pause ekstrem melebihi stale interval dan penghapusan manual lock tetap residual risk mtime lease. Lihat Stage C §22.2 untuk batas klaim lengkap. Shell-run HOME terisolasi ditolak kebijakan eksekusi; tidak dicoba workaround. Fixture dan smoke script mengisolasi proyek/HOME sendiri.

### 20.3 Disposisi implementer

D-R01 **IMPLEMENTED, siap re-review independen**. D-R02, D-R03, dan D-R06 **siap re-review ulang** setelah stress dan real process-death regression dengan lease baru. D-R04 dan D-R05 tidak diubah. **Gate D tetap HOLD** hingga Claude menetapkan disposisi review. Finding `writeChain()`/`writeActivateStatus()` yang memakai `fs.moveSync(...,{overwrite:true})` tetap di luar cakupan remediation lock sesuai keputusan Director yang dicatat di Stage C §21.9.

## 21. Re-review final independen (Claude / Sonnet 5, 2026-09-16) — putusan Gate D

### 21.1 Putusan

**Gate D: PASS.** Rujuk `RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md` §23 untuk metodologi dan bukti lengkap — `acquireProjectLock()` yang direview di sana adalah primitive yang sama persis dipakai Stage D. Bagian ini mencatat verifikasi tambahan yang spesifik pada skenario governance-transition Stage D.

### 21.2 Verifikasi independen spesifik Stage D

| Uji, ditulis dan dijalankan sendiri | Hasil |
|---|---|
| 20× ulang test resmi "two independent sigma-control processes racing to commit the same ticket+approval" (sebelumnya ~22% gagal dengan `INVALID_OPERATION`, §19.2) | **0/20 gagal** |
| Full suite, satu run | **53 file / 618 test PASS** |
| Build/typecheck | Bersih |

Uji tambahan (fresh-contention 150 trial, live-holder-survives, dead-holder-takeover, tampering/compromise mid-hold) dijalankan terhadap primitive lock mentah — berlaku identik untuk Stage D karena `sigma_prepare_intent_ratify`/`sigma_commit_intent_ratify` memakai `withControlLock`/`acquireProjectLock` yang sama tanpa modifikasi tambahan di jalur Stage D. Lihat RESULT Stage C §23.2 untuk angka lengkap.

### 21.3 Disposisi final

| ID | Disposisi final |
|---|---|
| D-R01 | **CLOSED.** Root cause sama dengan C-R01 (RESULT Stage C §23.3); ditutup dengan bukti yang sama, ditambah reproduksi khusus pada skenario commit-ratify lintas-proses Stage D sendiri (§21.2). |
| D-R02 | **CLOSED** untuk exactly-once/recovery pada boundary yang diuji (journal, rollback/roll-forward, 5 boundary process-death Stage D) di atas primitive lock baru. |
| D-R03 | **CLOSED** untuk audit durable — tidak berubah sejak §18.2/§19.3. |
| D-R04 | Tetap CLOSED (tidak disentuh putaran ini). |
| D-R05 | Tetap CLOSED (tidak disentuh putaran ini). |
| D-R06 | **CLOSED** — lima boundary process-death Stage D lulus di atas lock baru, dan properti mutual-exclusion pra-crash yang sebelumnya membatalkan nilai temuan ini (§19.3) sekarang juga tertutup. |

Residual risk (§23.4 RESULT Stage C — pause host ekstrem >`stale` interval di tengah mutasi sinkron) dan finding terpisah `chain.ts`/`writeChain()`/`writeActivateStatus()` berlaku identik di sini, dicatat untuk keputusan Director tentang langkah berikutnya, tidak memblokir gate ini.

**Gate D: PASS.**
