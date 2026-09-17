# SIGMA MCP — Operation Capability Matrix

**Deliverable**: Stage 0 dari `PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` §14.
**Tanggal**: 2026-09-15, diperbarui 2026-09-16 (batch Stage E W1 + review Codex putaran 1/2; batch B2 query-plane).
**Sumber**: `Sigma/SIGMA-OPERATION-REGISTRY.json` (59 operasi) diverifikasi silang terhadap `src/commands/*.ts` dan `src/cli.ts`.
**Status**: Klasifikasi lengkap. Bukan doktrin Sigma dan tidak mengubah registry — lihat §5.

---

## 1. Kenapa dokumen ini ada

Registry Sigma mengklasifikasikan operasi pada dua dimensi: `level` (`semantic` / `read_only` / `system`) dan `role` (`any` / `director`). Kedua dimensi itu **tidak cukup** untuk memutuskan apakah suatu operasi boleh mempunyai primitive MCP, karena:

1. `level` menjawab "apakah ia menulis", bukan "seberapa berbahaya bila ditulis oleh model".
2. `role` hanya mengenal `any` dan `director`. Tidak ada atribusi ARC/FMN/DEV/AUD per operasi, padahal seluruh desain capability per-role bergantung padanya.
3. Registry sendiri menyatakan batasnya: `role_definitions.director` berbunyi *"CLI enforces this by convention — Sigma has no auth layer; governance relies on role discipline."*

Matriks ini menambah dua dimensi turunan — **tier admissibility** dan **owner role** — tanpa menyentuh registry (keputusan Q4, §21.1 plan).

## 2. Definisi tier

| Tier | Arti | Plane |
|---|---|---|
| **Q** | Non-mutating. Aman diekspos selama path resolution terbatas. | Query |
| **W1** | Mutasi project-local, reversible, terbatas pada DRAFT / mailbox / evidence. | Bounded command |
| **W2** | Transisi lifecycle material. Wajib approval Director durable. | Governance transition |
| **W3** | Menyentuh host, config global, sistem eksternal, atau bersifat destruktif. | Di luar control plane |
| **NA** | **Not admissible** — tidak boleh mendapat primitive MCP untuk AI role pada desain saat ini, apa pun tier teknisnya. | — |

Kolom **Owner role** bersifat **turunan dan belum diratifikasi**. Ia berasal dari §6.2 plan, bukan dari registry. Sampai Director meratifikasinya, ia adalah input desain, bukan otoritas enforcement.

## 3. Matriks

### 3.1 Tier Q — Query (24 operasi)

| Operation | Level | Registry role | Owner role | Tool MCP | Status |
|---|---|---|---|---|---|
| `project_status` | read_only | any | semua | `sigma_get_state` | **implemented** (Phase 0) |
| `session_bootstrap` | read_only | any | semua | `sigma_get_orientation` | **implemented** (Phase 0) |
| `memory` | read_only | any | semua | `sigma_get_memory` | **implemented** (Phase 0) |
| `doctor` (diagnosis saja) | semantic | any | semua | `sigma_doctor` (`applied:false`) | **implemented** (Phase 0) — lihat split di §3.4 |
| `intent_status` | read_only | any | ARC | `sigma_intent_status` | **implemented — B2 batch** (2026-09-16) |
| `plan_status` | read_only | any | FMN | `sigma_plan_status` | **implemented — B2 batch** (2026-09-16). Mencakup daftar DRAFT/LOCKED penuh, pairing plan↔exec, dan pending — bukan lagi parsial. |
| `exec_status` | read_only | any | DEV | `sigma_exec_status` | **implemented — B2 batch** (2026-09-16). Mencakup daftar DRAFT/LOCKED penuh dengan `plan_version_ref` — bukan lagi parsial. |
| `close_status` | read_only | any | AUD | `sigma_close_status` | **implemented — B2 batch** (2026-09-16) |
| `intent_list` | read_only | any | semua | `sigma_list_intents` | **implemented — B2 batch** (2026-09-16). Satu-satunya tool query-plane yang lintas-chain — membaca seluruh `progress-v<N>.json`, bukan hanya chain aktif. |
| `plan_list` | read_only | any | FMN | `sigma_list_plans` | **implemented — B2 batch** (2026-09-16). Menutup bug CLI `readPendingTitle()`: fallback title CLI adalah absolute host path bila file pending tanpa heading `# `; tool ini fallback ke `null`. |
| `exec_list` | read_only | any | DEV | `sigma_list_execs` | **implemented — B2 batch** (2026-09-16) |
| `roadmap_list` | read_only | any | FMN | `sigma_list_roadmap_stages` | **implemented — B2 batch** (2026-09-16). **Nama sengaja diubah dari pola `sigma_list_roadmaps`** — deskripsi `outputs` registry untuk operasi ini ("Table of ROADMAP versions") **tidak cocok** dengan implementasi CLI aktual (menampilkan stage/plan, bukan versi roadmap; chain hanya punya satu ROADMAP). Drift dokumentasi ini dicatat sebagai mismatch baru — lihat §5.4. |
| `intent_check` | read_only | any | ARC | `sigma_check_document` | **implemented — B2 batch** (2026-09-16). Satu tool generik `type` enum menutup kelima operasi `*_check` (intent/roadmap/plan/exec/close) — lihat baris di bawah. |
| `plan_check` | read_only | any | FMN | `sigma_check_document` | **implemented — B2 batch** (2026-09-16) — lihat `intent_check` |
| `exec_check` | read_only | any | DEV | `sigma_check_document` | **implemented — B2 batch** (2026-09-16) — lihat `intent_check` |
| `close_check` | read_only | any | AUD | `sigma_check_document` | **implemented — B2 batch** (2026-09-16) — lihat `intent_check` |
| `roadmap_check` | read_only | any | FMN | `sigma_check_document` | **implemented — B2 batch** (2026-09-16) — lihat `intent_check`. **Catatan keamanan**: `SigmaDocCheckReport.file` yang mendasari kelima operasi ini adalah absolute host path; tool meredaksinya lewat `redactPath()` (primitif yang sama dipakai `sigma_get_memory`) sebelum dikembalikan. |
| `inbox` | read_only | any | semua | — | deferred, tanpa jadwal — MCP mailbox dibangun lalu **ditarik** oleh keputusan Director setelah review Codex (2026-09-15). Lihat §3.6 |
| `inbox_check` | read_only | any | semua | `sigma_check_mailbox_integrity` | **implemented — B2 batch** (2026-09-16). Berbeda struktur dari `sigma_check_document` meski namanya mirip — integrity check index-vs-disk (file hilang, orphan, attachment hilang, field tidak valid), bukan `SigmaDocCheckReport`. Tidak ada konsep role/`--role`; tidak pernah mengembalikan subject/isi pesan. |
| `memo_list` | read_only | any | semua | — | deferred B2 — **dikecualikan secara eksplisit** dari batch ini (keputusan Director 2026-09-16), bukan lupa. Menyentuh domain mailbox yang sama dengan `inbox`/`inbox_read` yang ditarik §3.6; berbeda dari `inbox_check` karena `memo_list` mengembalikan metadata pesan (subject, ref, status) per role, bukan hanya integrity count. |
| `config_show` | read_only | any | semua | `sigma_get_config` | **implemented — B2 batch** (2026-09-16). Tidak ada field credential di `ProjectConfig`; `notion.parent_page_id`/`database_id` ada di tipe tapi tidak pernah dicetak CLI, tool ini pun tidak. |
| `report_logs` | read_only | any | AUD | `sigma_get_operation_log` | **implemented — B2 batch** (2026-09-16). **Caveat lama dicabut**: diverifikasi langsung ke `OperationLogEntry` (`src/utils/operationLog.ts`) — field-nya hanya `{operation, timestamp, status, exit_code}`, tidak ada path host sama sekali. Catatan "memuat path host" pada versi matrix sebelumnya tidak terkonfirmasi kode aktual `hermes-integration`. |
| `git_evidence` | read_only | any | DEV / AUD | `sigma_get_git_evidence` | **implemented — B2 batch** (2026-09-16). **Caveat lama terkonfirmasi dan dipertahankan by design**: tool ini membaca `git status`/`git diff` atas SELURUH working tree, bukan hanya `Sigma/` — keputusan Director eksplisit (parity penuh dengan CLI), bukan kelalaian. |
| `scan` | read_only | any | — | — | **NOT ADMISSIBLE** — lihat §3.5 |

### 3.2 Tier W1 — Bounded command (17 operasi)

Ketujuh belas baris di bawah = 16 operasi registry asli + `record_evidence` (tidak ada padanan registry, seperti `sigma_read_artifact` di §4). Status "reviewed PASS" merujuk pada review teknis independen Codex putaran 2 (2026-09-16), yang membuka source/test secara langsung (bukan review naratif putaran 1, yang klaimnya sudah dicabut — lihat masing-masing RESULT report §8/§9).

| Operation | Registry role | Owner role | Tool MCP | Status |
|---|---|---|---|---|
| `intent_new` | any | ARC | `sigma_create_intent_draft` | **implemented — Stage C pilot** (2026-09-15; see RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md) |
| `plan_new` | any | FMN | `sigma_create_plan_draft` | **implemented — reviewed PASS WITH DIRECTOR DECISION** (2026-09-16). D-01 (guard `\|`/newline pada `sigma plan new`) dan D-02 (cakupan `expected_artifact_sha256`) diputuskan Director — lihat RESULT-IMPL-SIGMA-MCP-STAGE-E-PLAN-DRAFT-20260916.md §8. |
| `exec_new` | any | DEV | `sigma_create_exec_draft` | **implemented — reviewed PASS WITH DIRECTOR DECISION** (2026-09-16). D-01 (cakupan `expected_artifact_sha256`, sama keputusan dengan `plan_new`) — lihat RESULT-IMPL-SIGMA-MCP-STAGE-E-EXEC-DRAFT-20260916.md §8. |
| `plan_update` | any | FMN | `sigma_update_artifact_draft` | **implemented — reviewed PASS** (2026-09-16, bersih, satu saran non-blocking soal coverage test EXEC — lihat RESULT-IMPL-SIGMA-MCP-STAGE-E-UPDATE-ARTIFACT-DRAFT-PLAN-EXEC-20260916.md §8). Same tool now also covers `exec` (role DEV) — there is no separate `exec_update` registry row to pair it with, same reason `plan_update`/`intent_new` have none: the CLI never had an `exec update`/`intent update` command (a human edits the DRAFT file directly), so both are new capabilities, not migrated ones. Scope: `type` is `z.enum(['intent','plan','exec'])`; `roadmap`/`close` remain out of scope, rejected at both the schema and service layer. |
| `send` | any | semua | `sigma_send_message` | deferred Stage C |
| `memo_write` | any | semua | `sigma_write_memo` | deferred Stage C |
| `memo_read` | any | semua | — | deferred, tanpa jadwal — MCP memo tidak direncanakan (keputusan Director 2026-09-15, §3.6); tetap CLI/skill (`sigma memo read`, skill `read-memo`) |
| `inbox_read` | any | semua | — | deferred, tanpa jadwal — MCP mailbox tidak direncanakan (keputusan Director 2026-09-15, §3.6); tetap CLI (`sigma inbox read`) |
| `inbox_archive` | any | semua | `sigma_inbox_archive` | **implemented — reviewed PASS** (refactored 2026-09-16 setelah review Codex putaran 2 temuan H-02; follow-up direview ulang, verdict PASS WITH LOW-SEVERITY DOCUMENTATION NIT — lihat RESULT-IMPL-SIGMA-MCP-STAGE-E-REVIEW-FOLLOWUP-20260916.md §7). Logic dipindah ke `src/services/inboxArchiveService.ts` — satu service dipakai CLI dan MCP (§13, §5 invarian #9), dengan parameter `actorRole: string \| null`: `null` untuk CLI trusted-terminal (tanpa ownership check, perilaku identik dengan sebelumnya), role string untuk MCP bound-role (`entry.to === actorRole` ditegakkan, `ROLE_NOT_AUTHORIZED` bila tidak). Sebelumnya sempat MCP-only (`src/mcp/control/inboxArchive.ts`, dihapus) — deviasi itu sudah ditutup, bukan lagi deviasi terbuka. |
| `roadmap_new` | any | FMN | `sigma_create_roadmap_draft` | **implemented — Stage E W1** (2026-09-16; lihat RESULT-IMPL-SIGMA-MCP-STAGE-E-W1-COMPLETION-20260916.md) |
| `roadmap_render` | any | FMN | `sigma_render_roadmap` | **implemented — Stage E W1** (2026-09-16). Tidak menyentuh `progress-v<N>.json` sama sekali — `state_revision` tidak bergerak akibat operasi ini. |
| `reference_update` | any | semua | `sigma_update_reference` | **implemented — Stage E W1** (2026-09-16). Tidak tersentuh sama sekali oleh chain/gate — "Not tracked in progress-v<N>.json" (dikonfirmasi kode). |
| `config_set_language` | any | DIRECTOR | — | deferred Stage E — nilai rendah bagi AI role (dilewati atas kesepakatan Director, di luar batch ini) |
| `intent_humanize` | any | ARC | `sigma_intent_humanize` | **implemented — Stage E W1** (2026-09-16) |
| `exec_humanize` | any | DEV | `sigma_exec_humanize` | **implemented — Stage E W1** (2026-09-16) |
| `close_humanize` | any | AUD | `sigma_close_humanize` | **implemented — Stage E W1** (2026-09-16) |
| `record_evidence` (tanpa padanan registry) | — | DEV | `sigma_record_evidence` | **implemented — reviewed PASS** (2026-09-16, menutup temuan H-01 — item asli Plan Doc §9.2 pilot yang sempat terlewat dari batch "W1 completion"; verdict review Codex PASS WITH LOW-SEVERITY DOCUMENTATION NIT, kedua item sisa sudah ditutup — lihat RESULT-IMPL-SIGMA-MCP-STAGE-E-REVIEW-FOLLOWUP-20260916.md §7–§8). Control-plane only, tanpa padanan CLI. `ref_path` adalah satu-satunya path di permukaan MCP ini yang tidak diturunkan dari tracker chain.ts (berbeda dari model allowlist `artifactPath.ts`) — dibatasi via project-root containment (realpath, tolak traversal/symlink escape termasuk directory junction), bukan allowlist; `ref_sha256` selalu dihitung server-side dari isi file, tidak pernah dipercaya dari input caller. Disimpan di `chain.exec.versions[].evidence[]`. Lihat `src/mcp/control/recordEvidence.ts`. |

### 3.3 Tier W2 — Governance transition (11 operasi)

Seluruhnya memakai `typed prepare → durable Director approval → typed commit`.

| Operation | Registry role | Owner role | Status | Catatan |
|---|---|---|---|---|
| `intent_ratify` | director | DIRECTOR | **implemented — Stage D pilot** (2026-09-15, self-verified pending Codex/Director review; see RESULT-IMPL-SIGMA-MCP-STAGE-D-20260915.md) | Transisi tunggal pertama. **Klarifikasi "Owner role: DIRECTOR"**: `DIRECTOR` bukan role MCP yang bisa di-bind (`--role` hanya menerima ARC/FMN/DEV/AUD, empat AI role plan §6.2 — Director adalah manusia, bukan binding MCP). Kedua tool (`sigma_prepare_intent_ratify`, `sigma_commit_intent_ratify`) di-gate ke `binding.role === 'ARC'` (pemilik DIR-INTENT) untuk pemanggilan mekanis; otoritas DIRECTOR ditegakkan lewat approval record terpisah yang hanya bisa direkam via `sigma control approve/reject` (trusted local CLI, di luar MCP sepenuhnya) — bukan lewat binding role. Ini realisasi langsung invarian §5.8 "Director finality", bukan penyimpangan darinya. |
| `intent_amendment` | director | DIRECTOR | **implemented — Stage F batch, self-verified pending Codex/Director review** (2026-09-16). `sigma_prepare_intent_amendment` / `sigma_commit_intent_amendment`, di-gate ke ARC (pemilik DIR-INTENT), pola sama dengan `intent_ratify`. | `change` adalah business argument bertipe free-text — tidak disimpan mentah di ticket (skema `OperationTicket` sengaja hanya menyimpan `arguments_hash`, lihat §13). Karena itu `change` wajib disuplai ulang saat commit; `checkPreconditions` menghitung ulang hash-nya dan mencocokkan terhadap `ticket.arguments_hash` **dan** `approval.arguments_hash` — caller tidak bisa mengganti teks change dari yang disetujui Director. Service diekstrak ke `src/services/intentAmendmentService.ts`, dipakai bersama oleh CLI (`sigma intent amendment`) dan MCP. |
| `intent_score` | director | DIRECTOR | **implemented — Stage F batch, self-verified pending Codex/Director review** (2026-09-16). `sigma_prepare_intent_score` / `sigma_commit_intent_score`, di-gate ke ARC. | Sama pola re-supply-and-hash-match dengan `intent_amendment` untuk `score`+`notes`. Prasyarat Gate 3.5 (`close new`). Service: `src/services/intentScoreService.ts`. |
| `intent_supersede` | director | DIRECTOR | **implemented — Stage F batch, self-verified pending Codex/Director review** (2026-09-16). `sigma_prepare_intent_supersede` / `sigma_commit_intent_supersede`, di-gate ke ARC. | Cascade ke ROADMAP/PLAN/EXEC/CLOSE, dilaporkan sebagai `effects[]` per-artifact. **Keputusan desain diimplementasikan**: approval record W2 dipakai sebagai pengganti `--director-confirm` CLI, bukan lapisan tambahan. **Scope decision baru**: MCP di-scope ke active chain saja — CLI punya `--v <version>` lintas-chain, tapi `computeStateRevision()` (contract.ts) hanya hash progress file chain AKTIF, jadi mutasi chain non-aktif tidak pernah menggerakkan `state_revision` dan kontrak staleness W2 diam-diam berhenti melindungi. CLI tetap punya kapabilitas penuh; hanya permukaan MCP yang dipersempit. Service: `src/services/intentSupersedeService.ts`. |
| `intent_activate` | any | DIRECTOR | **NOT ADMISSIBLE — keputusan final Director, 2026-09-17** | **Hazard**: menulis `Sigma/activate_status.json`, salah satu dari tiga file input `state_revision` itu sendiri. Sebuah sesi MCP dapat memindahkan chain aktif di bawah kakinya sendiri (race self-referential terhadap basis staleness-nya). Director memutuskan operasi ini **tidak akan pernah** mendapat primitive MCP — tetap CLI-only permanen, sekelas `inbox`/`memo_read` di §3.6. Tidak ada mekanisme mitigasi dalam pola prepare/commit W2 yang menutup celah ini tanpa mengubah `computeStateRevision()` secara arsitektural. |
| `plan_lock` | director | DIRECTOR | **implemented — Stage F batch, self-verified pending Codex/Director review** (2026-09-16). `sigma_prepare_plan_lock` / `sigma_commit_plan_lock`, di-gate ke FMN (pemilik FMN-PLAN). | `version` (opsional, disambiguasi saat >1 DRAFT terbuka) adalah selector struktural, bukan konten bebas — cukup dibekukan lewat `ticket.target.version`, tidak perlu pola re-supply-and-hash-match seperti amendment/score. Service: `src/services/planLockService.ts`. |
| `plan_supersede` | director | DIRECTOR | **implemented — Stage F batch, self-verified pending Codex/Director review** (2026-09-16). `sigma_prepare_plan_supersede` / `sigma_commit_plan_supersede`, di-gate ke FMN. | CLI-nya sudah scoped ke active chain saja (tidak ada `--v` lintas-chain seperti intent_supersede), jadi tidak ada keputusan penyempitan scope seperti `intent_supersede`. Auto-cascade DEV-EXEC non-final yang terkait, dilaporkan di `effects[]` dan hasil commit. Service: `src/services/planSupersedeService.ts`. |
| `plan_promote` | any | FMN + DIRECTOR | **implemented — Stage F batch, self-verified pending Codex/Director review** (2026-09-17). `sigma_prepare_plan_promote` / `sigma_commit_plan_promote`, di-gate ke FMN. | **Keputusan desain Director 2026-09-17**: "FMN + DIRECTOR" dibaca sama seperti "DIRECTOR" pada `intent_ratify` (§3.3's klarifikasi) — `binding.role === 'FMN'` untuk pemanggilan mekanis, otoritas DIRECTOR ditegakkan lewat approval record terpisah. Tidak butuh mekanisme dual-role baru. Business args (`id`, `title`, `focus`) memakai pola re-supply-and-hash-match. Mutasinya memindah file (`Sigma/pending/FMN-PLAN-<id>.md` → `Sigma/contract/FMN-PLAN-<version>.md`) — menambah fungsi baru `readCanonicalPendingPlanFile()`/`assertCanonicalPendingPlanLocation()` di `src/mcp/artifactPath.ts` (pending plan bukan tracker artifact bertipe/berversi, jadi tidak bisa lewat `readCanonicalArtifactFile()` yang ada — punya allowlist satu path tetap sendiri, postur keamanan sama). Service: `src/services/planPromoteService.ts`. |
| `exec_lock` | director | DIRECTOR | **implemented — Stage F batch, self-verified pending Codex/Director review** (2026-09-16). `sigma_prepare_exec_lock` / `sigma_commit_exec_lock`, di-gate ke DEV (pemilik DEV-EXEC). | Sama pola dengan `plan_lock` untuk domain EXEC. Service: `src/services/execLockService.ts`. |
| `close_new` | director | DIRECTOR | **implemented — Stage F batch, self-verified pending Codex/Director review** (2026-09-16). `sigma_prepare_close_new` / `sigma_commit_close_new`, di-gate ke AUD (pemilik DIR-CLOSE). | Gate 3. **Beda struktural dari operasi W2 lain di batch ini**: operasi ini membuat artifact DIR-CLOSE yang belum ada — tidak ada sha256 pra-eksisting untuk dibekukan, jadi `ticket.target` = `null` dan staleness murni bergantung pada `expected_state_revision` (setiap precondition — Gate 3, Gate 3.5, humanize gate — adalah fungsi murni dari byte `chain.json`, yang sudah di-hash oleh state_revision). Service: `src/services/closeNewService.ts`. |
| `close_lock` | director | DIRECTOR | **implemented — Stage F batch, self-verified pending Codex/Director review** (2026-09-16). `sigma_prepare_close_lock` / `sigma_commit_close_lock`, di-gate ke AUD. | Mengunci ROADMAP (bila masih DRAFT) sebagai efek samping — muncul di `effects[]` ticket dan field `roadmapLocked` pada hasil commit. Prompt interaktif CLI (`promptApprove()`/`--yes`) tidak punya padanan MCP — approval record W2 sepenuhnya menggantikannya, sama seperti seluruh batch ini. Service: `src/services/closeLockService.ts`. |

**Status verifikasi batch Stage F — SELESAI 9 dari 10 operasi W2** (`intent_activate` NOT ADMISSIBLE final, lihat barisnya): self-verified oleh implementer (build `tsc --noEmit` bersih, full suite **898 test, 893-895 PASS pada eksekusi paralel penuh — flaky di bawah beban paralel tinggi mesin ini, terbukti 100% PASS saat dijalankan serial** `--pool=forks --poolOptions.forks.singleFork=true`, lihat catatan flakiness di bawah), **belum direview Codex maupun Director**, dan **belum di-commit ke git** — menunggu keputusan Director soal commit, sama seperti seluruh batch W1/B2 sebelumnya. `npm run build` sengaja tidak dijalankan selama sesi ini karena symlink global `sigma-mcp` (lihat memory `global-sigma-mcp-symlink`) akan langsung membuat kode yang belum direview ini aktif di seluruh MCP client di mesin ini.

**Catatan flakiness test suite (2026-09-17, ditemukan bukan disebabkan batch ini)**: menjalankan full suite (69 file, ~900 test) tiga kali berurutan dalam sesi yang sama menghasilkan 3-5 kegagalan acak yang BERBEDA setiap kali, termasuk pada file yang sudah lama PASS dan tidak disentuh sesi ini (`control-intent-ratify.test.ts`, `control-plan-draft.test.ts`). Semua kegagalan bergejala sama: `INTERNAL_ERROR` generik atau "ticket missing" pada test yang memakai lock file lintas-proses (`proper-lockfile`) atau spawn subprocess nyata. Dikonfirmasi sebagai resource contention paralel (bukan bug logika): lima file yang sempat gagal, saat dijalankan bersama secara SERIAL (`--pool=forks --poolOptions.forks.singleFork=true`), **100% PASS (103/103)**. Ini karakteristik pra-eksisting test harness di bawah beban paralel tinggi di mesin ini, bukan regresi dari batch Stage F.

### 3.4 Tier W3 / NA — Privileged (8 operasi + 1 split)

| Operation | Level | Alasan | Status |
|---|---|---|---|
| `project_start` | semantic | Menulis config MCP **global** Codex/Gemini (caveat Phase 0 §5.2) | NOT ADMISSIBLE |
| `project_sync` | semantic | Sinkronisasi doktrin dari `~/.sigma/templates/` | NOT ADMISSIBLE |
| `project_register` | semantic | Perbaikan identity — memindahkan identitas proyek | NOT ADMISSIBLE |
| `setup_install` | system | Host-level, membuat `~/.sigma/` | NOT ADMISSIBLE |
| `setup_update` | system | Host-level | NOT ADMISSIBLE |
| `setup_uninstall` | system | Menghapus `~/.sigma/` | NOT ADMISSIBLE |
| `override` | semantic | Mem-bypass gate atas otoritas Director | NOT ADMISSIBLE |
| `config` | semantic | Wizard interaktif — tidak dapat dijalankan non-interaktif | NOT ADMISSIBLE |
| `doctor --recovery/--reconstruct` | semantic | Cabang repair dari `doctor`; menulis ke chain file | NOT ADMISSIBLE |

**Split `doctor`.** Registry memperlakukan `doctor` sebagai satu operasi `semantic`. Implementasinya punya dua cabang berbeda sifat: diagnosis (read-only) dan repair (menulis). `sigma_doctor` sudah mengekspos cabang pertama saja dengan `applied:false`. Matriks ini memisahkan keduanya; registry belum.

### 3.5 `scan` — read-only tetapi tidak admissible

`scan` ber-level `read_only`, jadi secara registry ia tampak aman. Ia **tidak** aman sebagai primitive MCP: ia menerima path file **arbitrary** untuk dipindai. Mengeksposnya sama dengan memberi `sigma_read_file` berkedok, yang dilarang eksplisit oleh §4 non-goal plan.

Ini contoh utama kenapa `level` registry tidak boleh dijadikan penentu admissibility.

### 3.6 Stage B2 (2026-09-15) — evidence-only, setelah review dan revert mailbox

Stage B2 semula menambah tiga tool (`sigma_get_evidence`, `sigma_list_messages`, `sigma_read_message`). Review Codex menemukan tiga temuan pada dua tool mailbox — R-B2-01 (HIGH, config resmi tidak pernah menulis `--role` sehingga mailbox selalu `ROLE_NOT_AUTHORIZED` pada instalasi nyata), R-B2-02 (MEDIUM, existence oracle lintas role lewat error code yang berbeda), R-B2-03 (MEDIUM, filename pesan tidak diturunkan dari `entry.id`/`from`/`to`/`type` sehingga entry index yang rusak bisa diarahkan ke file pesan lain yang sah). Director memutuskan **tidak memperbaiki temuan itu, melainkan menarik seluruh MCP mailbox/memo dari scope** — Hermes tidak membutuhkannya sekarang; komunikasi antar-role tetap lewat CLI (`sigma send`, `sigma inbox read`) dan skill (`write-memo`/`read-memo`).

**Yang bertahan setelah revert:**

| Tool | Padanan registry | Sifat |
|---|---|---|
| `sigma_get_evidence` | `plan_status`/`exec_status` (parsial — satu versi, bukan daftar) | **baru** — proyeksi status/referensi tracker plan/exec, bukan isi dokumen |

`sigma_list_messages` dan `sigma_read_message`, berikut `src/mcp/tools/mailbox.ts`, dihapus. `binding.role` dikembalikan ke control-mode-only. `inbox` dan `inbox_read` di §3.1/§3.2 kembali `deferred` tanpa jadwal.

**R-B2-04 (LOW, tetap perlu diperbaiki pada evidence) — CLOSED.** `sigma_get_evidence` semula punya boundary lebih longgar dari `sigma_read_artifact`: tidak melempar `BOUNDARY_VIOLATION` untuk non-regular file di path kanonik, dan tidak melakukan canonical-recheck setelah `openSync`. Diperbaiki dengan mengekstrak `readCanonicalArtifactFile()` ke `src/mcp/artifactPath.ts` — satu rutin open/verify/hash/read yang dipakai `sigma_read_artifact` **dan** `sigma_get_evidence`, sehingga keduanya tidak bisa drift lagi pada boundary maupun pada posture pembacaan. Diverifikasi dengan test baru: direktori pada path kanonik → `BOUNDARY_VIOLATION` (bukan `present:false`), file di atas batas ukuran → `PAYLOAD_TOO_LARGE`.

**Verifikasi final.** `test/mcp-stage-b2.test.ts` (9 test, evidence-only): status + hash, present:false untuk file hilang, unknown version, boundary violation `.env`, parity legacy folder (R-10), non-regular-file boundary (R-B2-04), payload-too-large; dua test transport-level (envelope + non-mutasi). Full suite kembali ke baseline Batch 1 + 9 test evidence: **51 file / 545 test PASS**.

## 4. Surface Batch 1

| Tool | Padanan registry | Sifat |
|---|---|---|
| `sigma_get_state` | `project_status` | existing |
| `sigma_get_orientation` | `session_bootstrap` | existing |
| `sigma_get_gates` | — (turunan chain state) | existing, tanpa padanan registry |
| `sigma_list_artifacts` | — (turunan tracker) | existing, tanpa padanan registry |
| `sigma_doctor` | `doctor` (cabang diagnosis) | existing |
| `sigma_get_memory` | `memory` | existing |
| `sigma_verify_binding` | — | **baru** — operasi server, bukan operasi Sigma |
| `sigma_get_effective_policy` | — | **baru** — proyeksi atas registry, bukan operasi |
| `sigma_read_artifact` | — | **baru** — tidak ada padanan CLI; artifact selama ini dibaca manusia lewat filesystem |

**Temuan**: lima dari sembilan tool Batch 1 tidak punya padanan operasi registry. Surface MCP bukan superset maupun subset registry — keduanya beririsan. Klaim "MCP parity dengan registry" karenanya tidak bermakna tanpa kualifikasi, dan Stage E harus dibaca sebagai *menambah primitive berdasarkan kebutuhan*, bukan mengejar 59 tool.

## 5. Mismatch registry vs implementasi

Plan §14 Stage 0 butir 2 meminta mismatch ditandai. Empat ditemukan (§5.4 ditambahkan saat implementasi B2 batch, 2026-09-16).

### 5.1 `notion` tidak ada di registry sama sekali

`src/commands/notion.ts` terdaftar di `src/cli.ts:21,48` dan mengekspos **delapan** subcommand: `setup`, `enable`, `disable`, `status`, `push`, `pull-state`, `pull`, `progress`. Tidak satu pun muncul di `SIGMA-OPERATION-REGISTRY.json`, dan `notion` bukan salah satu dari 20 domain terdaftar.

Artinya seluruh permukaan **credential handling dan sinkronisasi eksternal** Sigma tidak terlihat oleh registry. Konsekuensi langsung: setiap enforcement yang mengambil operation registry sebagai sumber kebenaran akan menganggap operasi-operasi ini *tidak ada*, bukan menganggapnya *terlarang*. Deny-by-default harus berbasis **allowlist**, bukan lookup registry.

### 5.2 Domain `sync` terdaftar tanpa command sendiri

`domains` memuat `sync`, tetapi tidak ada `src/commands/sync.ts`. Operasi sinkronisasi hidup sebagai `project sync`. Domain ini tampaknya sisa historis.

### 5.3 `doctor` mencampur dua sifat dalam satu entri

Lihat §3.4.

### 5.4 `roadmap_list`'s `outputs.description` tidak cocok dengan implementasi CLI

Registry mendeskripsikan output `roadmap_list` sebagai "Table of ROADMAP versions: version, state, file path". Implementasi aktual (`src/commands/roadmap.ts`'s `roadmap list`, dikonfirmasi baca kode langsung) menampilkan **daftar stage/plan** (`getStagePlansForRoadmap()`) — version/state/title/focus per PLAN, bukan per versi ROADMAP. Ini konsisten dengan model data chain: satu chain hanya punya **satu** ROADMAP (objek tunggal `chain.roadmap`, bukan array), jadi "daftar versi ROADMAP" secara struktural tidak mungkin lebih dari satu baris. Tool MCP (`sigma_list_roadmap_stages`) dinamai mengikuti perilaku aktual, bukan deskripsi registry yang usang.

## 6. Kesimpulan yang mengikat implementasi

1. **Deny-by-default berbasis allowlist eksplisit**, bukan berbasis ketiadaan entri registry (§5.1).
2. **`level` registry bukan penentu admissibility** (§3.5).
3. **Dimensi owner role tidak ada di registry** dan yang dipakai di sini bersifat turunan serta belum diratifikasi (§2).
4. **`intent_activate` adalah hazard khusus** karena menulis input `state_revision` binding (§3.3).
5. **Klaim parity registry↔MCP tidak bermakna** tanpa kualifikasi (§4).
