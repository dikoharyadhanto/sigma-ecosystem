# Sigma MCP — Capability Matrix

> Generated from `src/mcp/capabilityManifest.ts` by `scripts/generate-mcp-matrix.js`. Do not edit by hand:
> `test/mcp-capability-matrix.test.ts` fails when this file differs from a fresh render.

## Baseline

- Sigma version: `2.1.0`
- Operation registry: schema `1.0.0`, generated `2026-10-14T18:05:35.000Z`, 91 entries
- Active operations: 88; tombstones: 3 (`intent_lock`, `plan_lock`, `exec_lock`)
- Implemented on MCP: 57; deferred: 16; not admissible: 15

This matrix replaces `Implementation/sigma-mcp/SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md` as the
reference for what exists. That file stays as the record of the original reasoning and decisions.

## How to read it

| Field | Values | Meaning |
|:--|:--|:--|
| tier | `Q`, `W1`, `W2`, `W3`, `NA` | Authority class. `Q` observes; `W1` a bound role may write; `W2` needs a durable Director approval; `W3` and `NA` have no MCP primitive today. |
| plane | `query`, `control`, `cli_only`, `deferred` | Where the operation is meant to live. It says nothing about whether a tool exists. |
| mcp_status | `implemented`, `deferred`, `not_admissible` | `implemented`: a registered tool realises it. `deferred`: allowed in principle, not built or not designed (not a permanent ban). `not_admissible`: a security boundary says it must never be MCP. |
| mapping | `exact`, `functional`, `partial`, `none` | `exact`: same inputs, outputs, side effects. `functional`: same purpose, different shape or an added guard. `partial`: covers only part of the operation. `none`: no tool. |

A `functional` or `partial` mapping is never counted as full support without its rationale.
Tombstones are never counted as active operations and can never receive a record.

## Enabling the servers

- Query server `sigma-mcp`: registered for your AI tools by `sigma project start` / `sigma project sync` and by `sigma setup install` / `sigma setup update`. It is read-only.
- Control server `sigma-control`: never registered automatically. Start it yourself with an explicit binding, for example
  `sigma-control --project-root <root> --project-id <id> --role <ARC|FMN|DEV|AUD>`. It refuses to start without all three.
- Neither server, nor any tool or this document's generator, registers a project. A directory that is not a Sigma project stays untouched.
- A Director approval is never given by an MCP tool. It is recorded with `sigma control approve <ticketId> --director-confirm` on the trusted local CLI.

## Query plane (`sigma-mcp`) — 30

| operation | tier | registry level | mcp_status | tools | mapping | rationale |
|:--|:--|:--|:--|:--|:--|:--|
| `audit_show` | Q | read_only | implemented | `sigma_get_audit_pack` | partial | Status and stale-source detection; the CLI additionally renders the pack and original responses. |
| `close_check` | Q | read_only | implemented | `sigma_close_check` | exact | Same assessCloseNewEligibility as `sigma close check`, prepare, and `close new`. Evaluates Gate 3 and PRODUCT REVIEW before a CLOSE exists; NOT sigma_check_document(type=close), which validates an existing CLOSE. |
| `close_status` | Q | read_only | implemented | `sigma_close_status` | exact | Query-plane equivalent of `sigma close status`. |
| `config_show` | Q | read_only | implemented | `sigma_get_config` | exact | No credentials are printed by either surface. |
| `decisions_list` | Q | read_only | implemented | `sigma_list_decisions` | functional | Questions and control tickets listed separately. |
| `decisions_target` | Q | read_only | deferred | — | none | Read-only and admissible; not in the WP-MCP-03 priority list. |
| `dev_status` | Q | read_only | implemented | `sigma_dev_status` | exact | Workspace state from identity record, dev/ folder, and marker. |
| `doctor` | Q | semantic | implemented | `sigma_doctor` | partial | Registry level is semantic, tier Q because only the read-only diagnosis is exposed. Recovery, --reconstruct and --migrate-mailbox stay CLI-only. |
| `exec_check` | Q | read_only | implemented | `sigma_check_document` | functional | One generic tool, type=exec. |
| `exec_list` | Q | read_only | implemented | `sigma_list_execs` | exact | All states, unlike sigma_exec_status. |
| `exec_status` | Q | read_only | implemented | `sigma_exec_status` | exact | Query-plane equivalent of `sigma exec status`. |
| `git_evidence` | Q | read_only | implemented | `sigma_get_git_evidence` | exact | Whole-worktree status, `--no-optional-locks`. |
| `inbox_check` | Q | read_only | implemented | `sigma_check_mailbox_integrity` | exact | Mailbox integrity only. Not part of the deferred message design. |
| `intent_amendment_preview` | Q | read_only | implemented | `sigma_intent_amendment_preview` | exact | Review package only; creates no amendment, ticket, or tag. Patch is cut at 64 KiB and flagged. |
| `intent_baseline_check` | Q | read_only | implemented | `sigma_intent_baseline_check` | exact | Git read-only (GIT_OPTIONAL_LOCKS=0); does not adopt a baseline. |
| `intent_check` | Q | read_only | implemented | `sigma_check_document` | functional | One generic tool, type=intent. |
| `intent_list` | Q | read_only | implemented | `sigma_list_intents` | exact | Cross-chain listing. |
| `intent_status` | Q | read_only | implemented | `sigma_intent_status` | exact | Query-plane equivalent of `sigma intent status`. |
| `memory` | Q | read_only | implemented | `sigma_get_memory` | exact | Wraps the same engine path as `sigma memory`. |
| `notes_list` | Q | read_only | implemented | `sigma_notes_list` | exact | Mirrors CLI `notes list` as is, including unregistered and non-Markdown warnings (Director decision: notes unchanged until real use shows a problem). |
| `plan_check` | Q | read_only | implemented | `sigma_check_document` | functional | One generic tool, type=plan. |
| `plan_list` | Q | read_only | implemented | `sigma_list_plans` | exact | Includes pending plans. |
| `plan_revise_check` | Q | semantic | implemented | `sigma_plan_revise_check` | partial | Evaluation half only (the same checkPlanRevision commit re-runs). The CLI `--prepare-ticket` alias writes a ticket and is NOT exposed; tier Q like `doctor`, whose registry level is also semantic. |
| `plan_status` | Q | read_only | implemented | `sigma_plan_status` | exact | Query-plane equivalent of `sigma plan status`. |
| `project_status` | Q | read_only | implemented | `sigma_get_state` | functional | State, gate summary and chain; the CLI also prints CLI-valid operations. |
| `report_logs` | Q | read_only | implemented | `sigma_get_operation_log` | exact | Reads Sigma/logs/operations.jsonl. |
| `review_check` | Q | read_only | implemented | `sigma_review_check` | exact | Same validateSigmaDocFile report as `sigma review check`; creates nothing. |
| `roadmap_check` | Q | read_only | implemented | `sigma_check_document` | functional | One generic tool, type=roadmap. |
| `roadmap_list` | Q | read_only | implemented | `sigma_list_roadmap_stages` | functional | Lists stages of the one ROADMAP; the registry description says roadmap versions. |
| `session_bootstrap` | Q | read_only | implemented | `sigma_get_orientation` | functional | One-shot orientation covering the bootstrap payload. |

## Control plane (`sigma-control`) — 29

| operation | tier | registry level | mcp_status | tools | mapping | rationale |
|:--|:--|:--|:--|:--|:--|:--|
| `audit_new` | W1 | semantic | implemented | `sigma_create_audit_pack` | exact | No external sending, no lifecycle approval. |
| `audit_record` | W1 | semantic | implemented | `sigma_record_audit_response` | exact | AUD only; never approves an artifact. |
| `close_lock` | W2 | semantic | implemented | `sigma_prepare_close_lock`, `sigma_commit_close_lock` | exact | prepare/commit pair; Director approval is recorded through the trusted local CLI, never by an MCP tool |
| `close_new` | W2 | semantic | implemented | `sigma_prepare_close_new`, `sigma_commit_close_new` | exact | prepare/commit pair; Director approval is recorded through the trusted local CLI, never by an MCP tool |
| `decisions_add` | W1 | semantic | implemented | `sigma_add_decision` | exact | No MCP tool resolves a Director decision. |
| `decisions_assess` | W1 | semantic | implemented | `sigma_record_readiness` | exact | FMN only; tied to PLAN and INTENT hashes. |
| `exec_acknowledge_plan` | W1 | semantic | implemented | `sigma_acknowledge_plan` | exact | Grants no coding authority. |
| `exec_approve` | W2 | semantic | implemented | `sigma_prepare_exec_approve`, `sigma_commit_exec_approve` | exact | prepare/commit pair; Director approval is recorded through the trusted local CLI, never by an MCP tool |
| `exec_new` | W1 | semantic | implemented | `sigma_create_exec_draft` | exact | DEV only; requires Gate 2. |
| `inbox_archive` | W1 | semantic | implemented | `sigma_inbox_archive` | functional | Adds a guard the CLI lacks: a bound role may archive only a message addressed to itself. One of two mailbox tools allowed by TC-MSG-04. |
| `intent_amendment` | W2 | semantic | implemented | `sigma_prepare_intent_amendment`, `sigma_commit_intent_amendment` | exact | prepare/commit pair; Director approval is recorded through the trusted local CLI, never by an MCP tool |
| `intent_clone` | W1 | semantic | implemented | `sigma_preview_clone`, `sigma_clone_draft` | exact | Preview (query) then confirm (control) with an unchanged preview token. |
| `intent_new` | W1 | semantic | implemented | `sigma_create_intent_draft` | exact | ARC only; idempotency key and state revision required. |
| `intent_ratify` | W2 | semantic | implemented | `sigma_prepare_intent_ratify`, `sigma_commit_intent_ratify` | exact | prepare/commit pair; Director approval is recorded through the trusted local CLI, never by an MCP tool |
| `intent_supersede` | W2 | semantic | implemented | `sigma_prepare_intent_supersede`, `sigma_commit_intent_supersede` | exact | prepare/commit pair; Director approval is recorded through the trusted local CLI, never by an MCP tool |
| `notes_new` | W1 | semantic | implemented | `sigma_create_note` | functional | Single step like the create_*_draft tools (no ticket or approval exists for a note). Differs from the CLI: attributed to the bound role, no --role argument; path containment by the control transaction. |
| `plan_approve` | W2 | semantic | implemented | `sigma_prepare_plan_approve`, `sigma_commit_plan_approve` | exact | prepare/commit pair; Director approval is recorded through the trusted local CLI, never by an MCP tool |
| `plan_clone` | W1 | semantic | implemented | `sigma_preview_clone`, `sigma_clone_draft` | exact | Preview (query) then confirm (control) with an unchanged preview token. |
| `plan_new` | W1 | semantic | implemented | `sigma_create_plan_draft` | partial | Non-pending path only; pending-queue staging is not exposed. |
| `plan_promote` | W2 | semantic | implemented | `sigma_prepare_plan_promote`, `sigma_commit_plan_promote` | exact | prepare/commit pair; Director approval is recorded through the trusted local CLI, never by an MCP tool |
| `plan_revise_commit` | W1 | semantic | implemented | `sigma_commit_plan_revision` | functional | FMN only. Approval is conditional as in the engine: a ticket and exact Director approval only for a loosening or the director checkpoint. Adds expected_candidate_sha256 (commit exactly what was checked) which the CLI does not have. The CONTRACT_CHANGE notice stays CLI/skill (mailbox deferred). |
| `plan_revise_prepare` | W1 | semantic | implemented | `sigma_prepare_plan_revision` | exact | FMN only. Same assertCanPrepareRevision/preparePlanRevision as the CLI. Editing the staged candidate stays a file edit, as in the CLI; no whole-content writer is exposed for it. |
| `plan_revise_ticket` | W1 | semantic | implemented | `sigma_issue_plan_revision_ticket` | exact | FMN only. Director decision 5a made it its own CLI operation. The ticket grants no authority; approval is recorded through the trusted local CLI. |
| `plan_supersede` | W2 | semantic | implemented | `sigma_prepare_plan_supersede`, `sigma_commit_plan_supersede` | exact | prepare/commit pair; Director approval is recorded through the trusted local CLI, never by an MCP tool |
| `plan_update` | W1 | semantic | deferred | — | none | Updates stage title/focus. sigma_update_artifact_draft replaces whole DRAFT content and is not an equivalent. |
| `reference_update` | W1 | semantic | implemented | `sigma_update_reference` | exact | Top-level files of reference/data only. |
| `review_new` | W1 | semantic | implemented | `sigma_create_review` | exact | Same resolveReviewNewTarget/createReviewDraft as `sigma review new`. ARC only; one file, no chain state, no verdict recorded. The Director/FMN-request preconditions are human facts that neither surface can verify. |
| `roadmap_new` | W1 | semantic | implemented | `sigma_create_roadmap_draft` | exact | FMN only; one ROADMAP per chain. |
| `roadmap_render` | W1 | semantic | implemented | `sigma_render_roadmap` | exact | Deterministic Stage Overview re-derivation. |

## CLI only — 21

| operation | tier | registry level | mcp_status | tools | mapping | rationale |
|:--|:--|:--|:--|:--|:--|:--|
| `config` | W3 | semantic | deferred | — | none | Project configuration; CLI-only this iteration. |
| `config_set_gitignore` | W3 | semantic | deferred | — | none | Project configuration that also edits .gitignore and the Git index (git rm --cached); CLI-only this iteration. |
| `config_set_language` | W1 | semantic | deferred | — | none | Project configuration; CLI-only this iteration. |
| `config_set_mailbox_outdate_keep` | W3 | semantic | deferred | — | none | Project configuration; CLI-only this iteration. |
| `config_set_memo_limit` | W3 | semantic | deferred | — | none | Project configuration; CLI-only this iteration. |
| `control_approve` | W3 | semantic | not_admissible | — | none | Trusted local Director surface; an MCP approval tool would void the ticket model. |
| `control_reject` | W3 | semantic | not_admissible | — | none | Trusted local Director surface. |
| `control_show` | W3 | read_only | not_admissible | — | none | Trusted local Director surface. |
| `decisions_resolve` | W3 | semantic | not_admissible | — | none | Resolving a Director decision is the Director's own act; an MCP tool doing it is self-approval, which the ticket/approval model exists to prevent. sigma_add_decision already states that no MCP tool resolves one. Reclassified from deferred on the Director's delegation of technical classification (2026-10-15). |
| `dev_create_workspace` | W3 | semantic | not_admissible | — | none | Creates a local development workspace. |
| `intent_activate` | W3 | semantic | not_admissible | — | none | Final Director decision 2026-09-17 (capability matrix §3.3): it writes Sigma/activate_status.json, one of the three inputs of state_revision itself, so an MCP session could move the active chain from under its own revision basis. Tier W3, was W2: availability is forbidden, not director_required. |
| `intent_baseline_adopt` | W3 | semantic | not_admissible | — | none | Director-confirmed baseline adoption. |
| `notes_update` | W3 | semantic | deferred | — | none | Moves files and refreshes the notes index; needs a concurrency and target-note contract first. |
| `override` | W3 | semantic | not_admissible | — | none | Director authority bypass; --director-confirm is a human act. |
| `project_register` | W3 | semantic | not_admissible | — | none | Registration is an explicit human act; no discovery path may perform it. |
| `project_start` | W3 | semantic | not_admissible | — | none | Bootstrap and lifecycle host operation. |
| `project_sync` | W3 | semantic | not_admissible | — | none | Host operation. |
| `scan` | NA | semantic | not_admissible | — | none | read_only was wrong: it writes Sigma/logs/*_terminology-scan.log, and it takes an arbitrary file path (sigma_read_file in disguise). |
| `setup_install` | W3 | system | not_admissible | — | none | Installs into the host environment. |
| `setup_uninstall` | W3 | system | not_admissible | — | none | Removes the host installation. |
| `setup_update` | W3 | system | not_admissible | — | none | Rewrites the host installation. |

## Deferred (design not final) — 8

| operation | tier | registry level | mcp_status | tools | mapping | rationale |
|:--|:--|:--|:--|:--|:--|:--|
| `inbox` | Q | read_only | deferred | — | none | Message design is a separate Director session (transport, audience binding, attachment, lifecycle, approval). |
| `inbox_clear` | W1 | semantic | deferred | — | none | Message design deferred. |
| `inbox_read` | W1 | semantic | deferred | — | none | Message design deferred; read changes unread state. |
| `memo_clear` | W1 | semantic | deferred | — | none | Message design deferred. |
| `memo_list` | Q | read_only | deferred | — | none | Message design deferred. |
| `memo_read` | W1 | semantic | deferred | — | none | Message design deferred. |
| `memo_write` | W1 | semantic | deferred | — | none | Message design deferred. |
| `send` | W1 | semantic | deferred | — | none | Message design deferred. |

## Tools that realise no active operation

MCP-native conveniences over engine state, with no CLI operation of the same shape:

| tool | plane | rationale |
|:--|:--|:--|
| `sigma_get_effective_policy` | query | Projection of this manifest; advisory. |
| `sigma_get_evidence` | query | Plan/exec version metadata and registered file hash. |
| `sigma_get_gates` | query | Gate view; a slice of project_status. |
| `sigma_list_artifacts` | query | Artifact tracker summary; no single CLI operation. |
| `sigma_read_artifact` | query | Reads one artifact by type/version from the tracker; takes no path. |
| `sigma_record_evidence` | control | Appends a hashed evidence citation to an EXEC version; no CLI operation of that shape. |
| `sigma_update_artifact_draft` | control | Whole-content replace of a registered DRAFT; no CLI operation of that shape. |
| `sigma_verify_binding` | query | Server binding check; no CLI counterpart. |

## Compatibility tools (not support for any active operation)

Retained so a completed historical ticket can still be replayed. They cannot start a new lock, and they
are never counted as coverage:

| tool | tombstone | replacement |
|:--|:--|:--|
| `sigma_commit_exec_lock` | `exec_lock` | `exec_approve` |
| `sigma_commit_plan_lock` | `plan_lock` | `plan_approve` |
| `sigma_prepare_exec_lock` | `exec_lock` | `exec_approve` |
| `sigma_prepare_plan_lock` | `plan_lock` | `plan_approve` |
