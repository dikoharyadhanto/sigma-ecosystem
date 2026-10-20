// PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY-20261015 — WP-MCP-01/02/06.
//
// Capability manifest: ONE record per active registry operation, saying which
// plane it belongs to, whether an MCP primitive exists today, and which actual
// tools realise it. policy.ts derives its tier table, owner table and
// mcp_status from this file; nothing else is a source of truth.
//
// This file declares. It does not discover. A declaration can lie, so
// test/mcp-capability-manifest.test.ts compares it with the tools the two
// servers really register (query: buildServer, control: buildControlServer).
// The control server is deliberately NOT imported here — it is a separate
// module graph from the query server (src/mcp/control/index.ts), and the
// parity test is what keeps this file honest for both planes.
//
// Vocabulary
//   tier         authority class (Q/W1/W2/W3/NA) — what policy.ts has always used.
//                It is the plan's `risk_class`; no second axis was invented.
//   plane        where the operation is meant to live. `query`/`control` are
//                intent and say nothing about existence; mcp_status does.
//   mcp_status   implemented    >=1 tool in tool_names is registered today
//                deferred       admissible in principle, no primitive yet /
//                               design not final (not a permanent ban)
//                not_admissible a security boundary says it must never be MCP
//   mapping      exact       same inputs, outputs, and side effects
//                functional  same purpose, differs in shape or adds a guard
//                partial     covers only part of the operation (see rationale)
//                none        no tool realises it
//
// Tombstones are NOT records here. They are listed in TOMBSTONES, may never be
// given a record, and tools that still reference them are COMPATIBILITY_TOOLS (metadata: legacy_compatibility).

export type Tier = 'Q' | 'W1' | 'W2' | 'W3' | 'NA';
export type Plane = 'query' | 'control' | 'cli_only' | 'deferred';
export type McpStatus = 'implemented' | 'deferred' | 'not_admissible';
export type Mapping = 'exact' | 'functional' | 'partial' | 'none';
export type OwnerRole = 'ARC' | 'FMN' | 'DEV' | 'AUD';

export interface CapabilityRecord {
  operation_id: string;
  tier: Tier;
  plane: Plane;
  mcp_status: McpStatus;
  tool_names: readonly string[];
  mapping: Mapping;
  rationale: string;
  /** Derived from the matrix §3, advisory, NOT ratified. */
  owner_role?: OwnerRole;
}

function rec(
  operation_id: string, tier: Tier, plane: Plane, mcp_status: McpStatus,
  tool_names: readonly string[], mapping: Mapping, rationale: string, owner_role?: OwnerRole,
): CapabilityRecord {
  return { operation_id, tier, plane, mcp_status, tool_names, mapping, rationale, ...(owner_role ? { owner_role } : {}) };
}

const SPLIT_TOKEN = 'prepare/commit pair; Director approval is recorded through the trusted local CLI, never by an MCP tool';

export const CAPABILITY_MANIFEST: readonly CapabilityRecord[] = Object.freeze([
  // ── Query plane — implemented ─────────────────────────────────────────────
  rec('project_status', 'Q', 'query', 'implemented', ['sigma_get_state'], 'functional', 'State, gate summary and chain; the CLI also prints CLI-valid operations.'),
  rec('session_bootstrap', 'Q', 'query', 'implemented', ['sigma_get_orientation'], 'functional', 'One-shot orientation covering the bootstrap payload.'),
  rec('memory', 'Q', 'query', 'implemented', ['sigma_get_memory'], 'exact', 'Wraps the same engine path as `sigma memory`.'),
  rec('doctor', 'Q', 'query', 'implemented', ['sigma_doctor'], 'partial',
    'Registry level is semantic, tier Q because only the read-only diagnosis is exposed. Recovery, --reconstruct and --migrate-mailbox stay CLI-only.'),
  rec('intent_status', 'Q', 'query', 'implemented', ['sigma_intent_status'], 'exact', 'Query-plane equivalent of `sigma intent status`.', 'ARC'),
  rec('plan_status', 'Q', 'query', 'implemented', ['sigma_plan_status'], 'exact', 'Query-plane equivalent of `sigma plan status`.', 'FMN'),
  rec('exec_status', 'Q', 'query', 'implemented', ['sigma_exec_status'], 'exact', 'Query-plane equivalent of `sigma exec status`.', 'DEV'),
  rec('close_status', 'Q', 'query', 'implemented', ['sigma_close_status'], 'exact', 'Query-plane equivalent of `sigma close status`.', 'AUD'),
  rec('intent_list', 'Q', 'query', 'implemented', ['sigma_list_intents'], 'exact', 'Cross-chain listing.'),
  rec('plan_list', 'Q', 'query', 'implemented', ['sigma_list_plans'], 'exact', 'Includes pending plans.', 'FMN'),
  rec('exec_list', 'Q', 'query', 'implemented', ['sigma_list_execs'], 'exact', 'All states, unlike sigma_exec_status.', 'DEV'),
  rec('roadmap_list', 'Q', 'query', 'implemented', ['sigma_list_roadmap_stages'], 'functional',
    'Lists stages of the one ROADMAP; the registry description says roadmap versions.', 'FMN'),
  rec('intent_check', 'Q', 'query', 'implemented', ['sigma_check_document'], 'functional', 'One generic tool, type=intent.', 'ARC'),
  rec('plan_check', 'Q', 'query', 'implemented', ['sigma_check_document'], 'functional', 'One generic tool, type=plan.', 'FMN'),
  rec('exec_check', 'Q', 'query', 'implemented', ['sigma_check_document'], 'functional', 'One generic tool, type=exec.', 'DEV'),
  rec('roadmap_check', 'Q', 'query', 'implemented', ['sigma_check_document'], 'functional', 'One generic tool, type=roadmap.', 'FMN'),
  rec('inbox_check', 'Q', 'query', 'implemented', ['sigma_check_mailbox_integrity'], 'exact',
    'Mailbox integrity only. Not part of the deferred message design.'),
  rec('config_show', 'Q', 'query', 'implemented', ['sigma_get_config'], 'exact', 'No credentials are printed by either surface.'),
  rec('report_logs', 'Q', 'query', 'implemented', ['sigma_get_operation_log'], 'exact', 'Reads Sigma/logs/operations.jsonl.', 'AUD'),
  rec('git_evidence', 'Q', 'query', 'implemented', ['sigma_get_git_evidence'], 'exact', 'Whole-worktree status, `--no-optional-locks`.', 'DEV'),
  rec('audit_show', 'Q', 'query', 'implemented', ['sigma_get_audit_pack'], 'partial',
    'Status and stale-source detection; the CLI additionally renders the pack and original responses.'),
  rec('decisions_list', 'Q', 'query', 'implemented', ['sigma_list_decisions'], 'functional', 'Questions and control tickets listed separately.'),

  rec('review_check', 'Q', 'query', 'implemented', ['sigma_review_check'], 'exact', 'Same validateSigmaDocFile report as `sigma review check`; creates nothing.', 'ARC'),
  rec('close_check', 'Q', 'query', 'implemented', ['sigma_close_check'], 'exact',
    'Same assessCloseNewEligibility as `sigma close check`, prepare, and `close new`. Evaluates Gate 3 and PRODUCT REVIEW before a CLOSE exists; NOT sigma_check_document(type=close), which validates an existing CLOSE.', 'AUD'),
  rec('dev_status', 'Q', 'query', 'implemented', ['sigma_dev_status'], 'exact', 'Workspace state from identity record, dev/ folder, and marker.', 'DEV'),
  rec('notes_list', 'Q', 'query', 'implemented', ['sigma_notes_list'], 'exact',
    'Mirrors CLI `notes list` as is, including unregistered and non-Markdown warnings (Director decision: notes unchanged until real use shows a problem).'),
  rec('intent_baseline_check', 'Q', 'query', 'implemented', ['sigma_intent_baseline_check'], 'exact', 'Git read-only (GIT_OPTIONAL_LOCKS=0); does not adopt a baseline.'),
  rec('intent_amendment_preview', 'Q', 'query', 'implemented', ['sigma_intent_amendment_preview'], 'exact',
    'Review package only; creates no amendment, ticket, or tag. Patch is cut at 64 KiB and flagged.'),
  rec('plan_revise_check', 'Q', 'query', 'implemented', ['sigma_plan_revise_check'], 'partial',
    'Evaluation half only (the same checkPlanRevision commit re-runs). The CLI `--prepare-ticket` alias writes a ticket and is NOT exposed; tier Q like `doctor`, whose registry level is also semantic.', 'FMN'),

  // ── Query plane — admissible, not yet built ───────────────────────────────
  rec('decisions_target', 'Q', 'query', 'deferred', [], 'none', 'Read-only and admissible; not in the WP-MCP-03 priority list.'),

  // ── Control plane — implemented ───────────────────────────────────────────
  rec('intent_new', 'W1', 'control', 'implemented', ['sigma_create_intent_draft'], 'exact', 'ARC only; idempotency key and state revision required.', 'ARC'),
  rec('plan_new', 'W1', 'control', 'implemented', ['sigma_create_plan_draft'], 'partial', 'Non-pending path only; pending-queue staging is not exposed.', 'FMN'),
  rec('exec_new', 'W1', 'control', 'implemented', ['sigma_create_exec_draft'], 'exact', 'DEV only; requires Gate 2.', 'DEV'),
  rec('roadmap_new', 'W1', 'control', 'implemented', ['sigma_create_roadmap_draft'], 'exact', 'FMN only; one ROADMAP per chain.', 'FMN'),
  rec('roadmap_render', 'W1', 'control', 'implemented', ['sigma_render_roadmap'], 'exact', 'Deterministic Stage Overview re-derivation.', 'FMN'),
  rec('reference_update', 'W1', 'control', 'implemented', ['sigma_update_reference'], 'exact', 'Top-level files of reference/data only.'),
  rec('intent_clone', 'W1', 'control', 'implemented', ['sigma_preview_clone', 'sigma_clone_draft'], 'exact',
    'Preview (query) then confirm (control) with an unchanged preview token.', 'ARC'),
  rec('plan_clone', 'W1', 'control', 'implemented', ['sigma_preview_clone', 'sigma_clone_draft'], 'exact',
    'Preview (query) then confirm (control) with an unchanged preview token.', 'FMN'),
  rec('audit_new', 'W1', 'control', 'implemented', ['sigma_create_audit_pack'], 'exact', 'No external sending, no lifecycle approval.'),
  rec('audit_record', 'W1', 'control', 'implemented', ['sigma_record_audit_response'], 'exact', 'AUD only; never approves an artifact.', 'AUD'),
  rec('decisions_add', 'W1', 'control', 'implemented', ['sigma_add_decision'], 'exact', 'No MCP tool resolves a Director decision.'),
  rec('decisions_assess', 'W1', 'control', 'implemented', ['sigma_record_readiness'], 'exact', 'FMN only; tied to PLAN and INTENT hashes.', 'FMN'),
  rec('exec_acknowledge_plan', 'W1', 'control', 'implemented', ['sigma_acknowledge_plan'], 'exact', 'Grants no coding authority.', 'DEV'),
  rec('inbox_archive', 'W1', 'control', 'implemented', ['sigma_inbox_archive'], 'functional',
    'Adds a guard the CLI lacks: a bound role may archive only a message addressed to itself. One of two mailbox tools allowed by TC-MSG-04.'),
  rec('intent_ratify', 'W2', 'control', 'implemented', ['sigma_prepare_intent_ratify', 'sigma_commit_intent_ratify'], 'exact', SPLIT_TOKEN),
  rec('intent_amendment', 'W2', 'control', 'implemented', ['sigma_prepare_intent_amendment', 'sigma_commit_intent_amendment'], 'exact', SPLIT_TOKEN),
  rec('intent_supersede', 'W2', 'control', 'implemented', ['sigma_prepare_intent_supersede', 'sigma_commit_intent_supersede'], 'exact', SPLIT_TOKEN),
  rec('plan_supersede', 'W2', 'control', 'implemented', ['sigma_prepare_plan_supersede', 'sigma_commit_plan_supersede'], 'exact', SPLIT_TOKEN),
  rec('plan_promote', 'W2', 'control', 'implemented', ['sigma_prepare_plan_promote', 'sigma_commit_plan_promote'], 'exact', SPLIT_TOKEN, 'FMN'),
  rec('plan_approve', 'W2', 'control', 'implemented', ['sigma_prepare_plan_approve', 'sigma_commit_plan_approve'], 'exact', SPLIT_TOKEN, 'FMN'),
  rec('exec_approve', 'W2', 'control', 'implemented', ['sigma_prepare_exec_approve', 'sigma_commit_exec_approve'], 'exact', SPLIT_TOKEN, 'DEV'),
  rec('close_new', 'W2', 'control', 'implemented', ['sigma_prepare_close_new', 'sigma_commit_close_new'], 'exact', SPLIT_TOKEN),
  rec('close_lock', 'W2', 'control', 'implemented', ['sigma_prepare_close_lock', 'sigma_commit_close_lock'], 'exact', SPLIT_TOKEN),

  // ── Control plane — Phase 3 (WP-MCP-04) ───────────────────────────────────
  rec('review_new', 'W1', 'control', 'implemented', ['sigma_create_review'], 'exact',
    'Same resolveReviewNewTarget/createReviewDraft as `sigma review new`. ARC only; one file, no chain state, no verdict recorded. The Director/FMN-request preconditions are human facts that neither surface can verify.', 'ARC'),
  rec('notes_new', 'W1', 'control', 'implemented', ['sigma_create_note'], 'functional',
    'Single step like the create_*_draft tools (no ticket or approval exists for a note). Differs from the CLI: attributed to the bound role, no --role argument; path containment by the control transaction.'),
  rec('plan_revise_prepare', 'W1', 'control', 'implemented', ['sigma_prepare_plan_revision'], 'exact',
    'FMN only. Same assertCanPrepareRevision/preparePlanRevision as the CLI. Editing the staged candidate stays a file edit, as in the CLI; no whole-content writer is exposed for it.', 'FMN'),
  rec('plan_revise_ticket', 'W1', 'control', 'implemented', ['sigma_issue_plan_revision_ticket'], 'exact',
    'FMN only. Director decision 5a made it its own CLI operation. The ticket grants no authority; approval is recorded through the trusted local CLI.', 'FMN'),
  rec('plan_revise_commit', 'W1', 'control', 'implemented', ['sigma_commit_plan_revision'], 'functional',
    'FMN only. Approval is conditional as in the engine: a ticket and exact Director approval only for a loosening or the director checkpoint. Adds expected_candidate_sha256 (commit exactly what was checked) which the CLI does not have. The CONTRACT_CHANGE notice stays CLI/skill (mailbox deferred).', 'FMN'),
  rec('plan_update', 'W1', 'control', 'deferred', [], 'none',
    'Updates stage title/focus. sigma_update_artifact_draft replaces whole DRAFT content and is not an equivalent.', 'FMN'),
  rec('intent_activate', 'W3', 'cli_only', 'not_admissible', [], 'none',
    'Final Director decision 2026-09-17 (capability matrix §3.3): it writes Sigma/activate_status.json, one of the three inputs of state_revision itself, so an MCP session could move the active chain from under its own revision basis. Tier W3, was W2: availability is forbidden, not director_required.'),

  // ── Mailbox / memo — deferred by Director decision ────────────────────────
  rec('inbox', 'Q', 'deferred', 'deferred', [], 'none', 'Message design is a separate Director session (transport, audience binding, attachment, lifecycle, approval).'),
  rec('inbox_read', 'W1', 'deferred', 'deferred', [], 'none', 'Message design deferred; read changes unread state.'),
  rec('inbox_clear', 'W1', 'deferred', 'deferred', [], 'none', 'Message design deferred.'),
  rec('send', 'W1', 'deferred', 'deferred', [], 'none', 'Message design deferred.'),
  rec('memo_write', 'W1', 'deferred', 'deferred', [], 'none', 'Message design deferred.'),
  rec('memo_list', 'Q', 'deferred', 'deferred', [], 'none', 'Message design deferred.'),
  rec('memo_read', 'W1', 'deferred', 'deferred', [], 'none', 'Message design deferred.'),
  rec('memo_clear', 'W1', 'deferred', 'deferred', [], 'none', 'Message design deferred.'),

  // ── CLI-only — boundary, never MCP ────────────────────────────────────────
  rec('project_start', 'W3', 'cli_only', 'not_admissible', [], 'none', 'Bootstrap and lifecycle host operation.'),
  rec('project_sync', 'W3', 'cli_only', 'not_admissible', [], 'none', 'Host operation.'),
  rec('project_register', 'W3', 'cli_only', 'not_admissible', [], 'none', 'Registration is an explicit human act; no discovery path may perform it.'),
  rec('setup_install', 'W3', 'cli_only', 'not_admissible', [], 'none', 'Installs into the host environment.'),
  rec('setup_update', 'W3', 'cli_only', 'not_admissible', [], 'none', 'Rewrites the host installation.'),
  rec('setup_uninstall', 'W3', 'cli_only', 'not_admissible', [], 'none', 'Removes the host installation.'),
  rec('override', 'W3', 'cli_only', 'not_admissible', [], 'none', 'Director authority bypass; --director-confirm is a human act.'),
  rec('control_show', 'W3', 'cli_only', 'not_admissible', [], 'none', 'Trusted local Director surface.'),
  rec('control_approve', 'W3', 'cli_only', 'not_admissible', [], 'none', 'Trusted local Director surface; an MCP approval tool would void the ticket model.'),
  rec('control_reject', 'W3', 'cli_only', 'not_admissible', [], 'none', 'Trusted local Director surface.'),
  rec('intent_baseline_adopt', 'W3', 'cli_only', 'not_admissible', [], 'none', 'Director-confirmed baseline adoption.'),
  rec('dev_create_workspace', 'W3', 'cli_only', 'not_admissible', [], 'none', 'Creates a local development workspace.'),
  rec('scan', 'NA', 'cli_only', 'not_admissible', [], 'none',
    'read_only was wrong: it writes Sigma/logs/*_terminology-scan.log, and it takes an arbitrary file path (sigma_read_file in disguise).'),

  // ── CLI-only now — reviewable, not a permanent ban ────────────────────────
  rec('config', 'W3', 'cli_only', 'deferred', [], 'none', 'Project configuration; CLI-only this iteration.'),
  rec('config_set_language', 'W1', 'cli_only', 'deferred', [], 'none', 'Project configuration; CLI-only this iteration.'),
  rec('config_set_mailbox_outdate_keep', 'W3', 'cli_only', 'deferred', [], 'none', 'Project configuration; CLI-only this iteration.'),
  rec('config_set_memo_limit', 'W3', 'cli_only', 'deferred', [], 'none', 'Project configuration; CLI-only this iteration.'),
  rec('config_set_origin_machine', 'W3', 'cli_only', 'deferred', [], 'none', 'Project configuration; writes the Git-tracked identity file; CLI-only this iteration.'),
  rec('config_set_gitignore', 'W3', 'cli_only', 'deferred', [], 'none', 'Project configuration that also edits .gitignore and the Git index (git rm --cached); CLI-only this iteration.'),
  rec('decisions_resolve', 'W3', 'cli_only', 'not_admissible', [], 'none',
    'Resolving a Director decision is the Director\'s own act; an MCP tool doing it is self-approval, which the ticket/approval model exists to prevent. sigma_add_decision already states that no MCP tool resolves one. Reclassified from deferred on the Director\'s delegation of technical classification (2026-10-15).'),
  rec('notes_update', 'W3', 'cli_only', 'deferred', [], 'none',
    'Moves files and refreshes the notes index; needs a concurrency and target-note contract first.'),
]);

/** Retired operations. Present in the registry as tombstones, never active. */
export const TOMBSTONES: Readonly<Record<string, { replacement: string }>> = Object.freeze({
  intent_lock: { replacement: 'intent_ratify' },
  plan_lock: { replacement: 'plan_approve' },
  exec_lock: { replacement: 'exec_approve' },
});

/** Registered tools that exist for completed-ticket replay only. Never counts as support. */
export const COMPATIBILITY_TOOLS: Readonly<Record<string, { tombstone: string; plane: 'control' }>> = Object.freeze({
  sigma_prepare_plan_lock: { tombstone: 'plan_lock', plane: 'control' },
  sigma_commit_plan_lock: { tombstone: 'plan_lock', plane: 'control' },
  sigma_prepare_exec_lock: { tombstone: 'exec_lock', plane: 'control' },
  sigma_commit_exec_lock: { tombstone: 'exec_lock', plane: 'control' },
});

/**
 * Tools that realise no registry operation: MCP-native conveniences over
 * engine state. Listed explicitly so an unmapped tool is a test failure, not a
 * silent omission (AC-MCP-02).
 */
export const MCP_NATIVE_TOOLS: Readonly<Record<string, { plane: 'query' | 'control'; rationale: string }>> = Object.freeze({
  sigma_get_gates: { plane: 'query', rationale: 'Gate view; a slice of project_status.' },
  sigma_list_artifacts: { plane: 'query', rationale: 'Artifact tracker summary; no single CLI operation.' },
  sigma_read_artifact: { plane: 'query', rationale: 'Reads one artifact by type/version from the tracker; takes no path.' },
  sigma_get_evidence: { plane: 'query', rationale: 'Plan/exec version metadata and registered file hash.' },
  sigma_get_effective_policy: { plane: 'query', rationale: 'Projection of this manifest; advisory.' },
  sigma_verify_binding: { plane: 'query', rationale: 'Server binding check; no CLI counterpart.' },
  sigma_update_artifact_draft: { plane: 'control', rationale: 'Whole-content replace of a registered DRAFT; no CLI operation of that shape.' },
  sigma_record_evidence: { plane: 'control', rationale: 'Appends a hashed evidence citation to an EXEC version; no CLI operation of that shape.' },
});

const BY_ID: ReadonlyMap<string, CapabilityRecord> = new Map(CAPABILITY_MANIFEST.map((r) => [r.operation_id, r]));

export function capabilityFor(operationId: string): CapabilityRecord | undefined {
  return BY_ID.get(operationId);
}

export function isTombstone(operationId: string): boolean {
  return Object.prototype.hasOwnProperty.call(TOMBSTONES, operationId);
}

// ── Drift report (WP-MCP-01) ────────────────────────────────────────────────

export interface InventoryInput {
  registryIds: readonly string[];
  queryTools: readonly string[];
  controlTools: readonly string[];
}

export interface InventoryReport {
  /** Active registry operations with no record, and records for unknown/tombstoned operations. */
  unclassified: string[];
  unknownRecords: string[];
  duplicateRecords: string[];
  /** Tools registered on a server that nothing in the manifest accounts for. */
  orphanTools: string[];
  /** `implemented` records naming a tool that is not registered. */
  implementedWithoutTool: string[];
  /** `implemented` records whose tools are on the wrong plane. */
  wrongPlane: string[];
  /** Records carrying tool_names while not `implemented`. */
  toolsWithoutImplemented: string[];
}

export function inventoryDrift(
  input: InventoryInput,
  manifest: readonly CapabilityRecord[] = CAPABILITY_MANIFEST,
): InventoryReport {
  const registry = new Set(input.registryIds);
  const query = new Set(input.queryTools);
  const control = new Set(input.controlTools);
  const seen = new Set<string>();
  const duplicateRecords: string[] = [];
  for (const r of manifest) {
    if (seen.has(r.operation_id)) duplicateRecords.push(r.operation_id);
    seen.add(r.operation_id);
  }

  const activeIds = input.registryIds.filter((id) => !isTombstone(id));
  const declared = new Set(manifest.map((r) => r.operation_id));
  const unclassified = activeIds.filter((id) => !declared.has(id)).sort();
  const unknownRecords = manifest
    .filter((r) => !registry.has(r.operation_id) || isTombstone(r.operation_id))
    .map((r) => r.operation_id).sort();

  const accounted = new Set<string>([
    ...manifest.flatMap((r) => r.tool_names),
    ...Object.keys(COMPATIBILITY_TOOLS),
    ...Object.keys(MCP_NATIVE_TOOLS),
  ]);
  const orphanTools = [...query, ...control].filter((t) => !accounted.has(t)).sort();

  const implementedWithoutTool: string[] = [];
  const wrongPlane: string[] = [];
  const toolsWithoutImplemented: string[] = [];
  for (const r of manifest) {
    if (r.mcp_status !== 'implemented') {
      if (r.tool_names.length > 0) toolsWithoutImplemented.push(r.operation_id);
      continue;
    }
    if (r.plane !== 'query' && r.plane !== 'control') { wrongPlane.push(r.operation_id); continue; }
    const missing = r.tool_names.length === 0 || r.tool_names.some((t) => !query.has(t) && !control.has(t));
    if (missing) { implementedWithoutTool.push(r.operation_id); continue; }
    if (r.plane === 'query' && r.tool_names.some((t) => !query.has(t))) wrongPlane.push(r.operation_id);
    if (r.plane === 'control' && !r.tool_names.some((t) => control.has(t))) wrongPlane.push(r.operation_id);
  }

  return {
    unclassified, unknownRecords, duplicateRecords: duplicateRecords.sort(), orphanTools,
    implementedWithoutTool: implementedWithoutTool.sort(), wrongPlane: wrongPlane.sort(),
    toolsWithoutImplemented: toolsWithoutImplemented.sort(),
  };
}
