// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §12 — policy projection.
//
// This module answers "what may be done here, and by whom" as a *projection*.
// It is advisory. Enforcement happens again inside every command, on the
// server, against the same inputs. A consumer that trusts this projection
// instead of attempting the operation is using it wrong, and a command that
// trusts it instead of re-checking is a bug.
//
// The tier table below is an explicit allowlist, transcribed from
// Implementation/sigma-mcp/SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md.
// It is deliberately NOT derived from the registry's own `level`/`role` fields:
//
//   - `level: read_only` does not imply admissible. `scan` is read_only and
//     takes an arbitrary file path, which would be sigma_read_file in disguise.
//   - the registry has no ARC/FMN/DEV/AUD dimension at all, only any/director.
//   - eight `notion` subcommands exist in the CLI and in no registry entry, so
//     an unknown operation_id must mean FORBIDDEN, never "not restricted".
//
// Hence: anything absent from this table is forbidden (matrix §6.1).

import fs from 'fs-extra';
import path from 'path';
import { OPERATION_REGISTRY_FILE } from '../config';
import { readActiveChain, listChainVersions, getGateStatus } from '../engine/chain';
import { SOURCE_ENGINE } from './shared';

export type Tier = 'Q' | 'W1' | 'W2' | 'W3' | 'NA';

/** What a consumer may expect of an operation right now. */
export type Availability =
  | 'observe'            // Q, non-mutating
  | 'role_action'        // W1, a bound role may do it
  | 'director_required'  // W2, needs a durable Director approval
  | 'gate_blocked'       // admissible in principle, blocked by current lifecycle
  | 'forbidden';         // W3/NA — no MCP primitive, now or planned

/** Whether an MCP primitive actually exists today. Separate from authority. */
export type McpStatus = 'implemented' | 'deferred' | 'not_admissible';

export const OPERATION_TIERS: Readonly<Record<string, Tier>> = Object.freeze({
  // ── Q (24) ────────────────────────────────────────────────────────────────
  project_status: 'Q', session_bootstrap: 'Q', memory: 'Q', doctor: 'Q',
  intent_status: 'Q', plan_status: 'Q', exec_status: 'Q', close_status: 'Q',
  intent_list: 'Q', plan_list: 'Q', exec_list: 'Q', roadmap_list: 'Q',
  intent_check: 'Q', plan_check: 'Q', exec_check: 'Q', close_check: 'Q',
  roadmap_check: 'Q', inbox: 'Q', inbox_check: 'Q', memo_list: 'Q',
  config_show: 'Q', report_logs: 'Q', git_evidence: 'Q',
  scan: 'NA', // read_only by level, inadmissible by shape — matrix §3.5

  // ── W1 (16) ───────────────────────────────────────────────────────────────
  intent_new: 'W1', plan_new: 'W1', exec_new: 'W1', plan_update: 'W1',
  send: 'W1', memo_write: 'W1', memo_read: 'W1', inbox_read: 'W1',
  inbox_archive: 'W1', roadmap_new: 'W1', roadmap_render: 'W1',
  reference_update: 'W1', config_set_language: 'W1', intent_humanize: 'W1',
  exec_humanize: 'W1', close_humanize: 'W1',

  // ── W2 (11) ───────────────────────────────────────────────────────────────
  intent_ratify: 'W2', intent_amendment: 'W2', intent_score: 'W2',
  intent_supersede: 'W2', intent_activate: 'W2', plan_lock: 'W2',
  plan_supersede: 'W2', plan_promote: 'W2', exec_lock: 'W2',
  close_new: 'W2', close_lock: 'W2',

  // ── W3 (8) ────────────────────────────────────────────────────────────────
  project_start: 'W3', project_sync: 'W3', project_register: 'W3',
  setup_install: 'W3', setup_update: 'W3', setup_uninstall: 'W3',
  override: 'W3', config: 'W3',
});

/** Owner role per matrix §3. Derived, NOT ratified — advisory only. */
export const OPERATION_OWNER: Readonly<Record<string, string>> = Object.freeze({
  intent_new: 'ARC', intent_status: 'ARC', intent_check: 'ARC', intent_humanize: 'ARC',
  plan_new: 'FMN', plan_status: 'FMN', plan_list: 'FMN', plan_check: 'FMN',
  plan_update: 'FMN', roadmap_new: 'FMN', roadmap_list: 'FMN',
  roadmap_check: 'FMN', roadmap_render: 'FMN', plan_promote: 'FMN',
  exec_new: 'DEV', exec_status: 'DEV', exec_list: 'DEV', exec_check: 'DEV',
  exec_humanize: 'DEV', git_evidence: 'DEV',
  close_status: 'AUD', close_check: 'AUD', close_humanize: 'AUD', report_logs: 'AUD',
});

/**
 * Operations whose MCP primitive exists today. Everything else is deferred.
 *
 * `inbox`/`inbox_read` are NOT here: MCP mailbox tools (sigma_list_messages,
 * sigma_read_message) were built and reviewed during Stage B2 but withdrawn
 * by Director decision after review (2026-09-15,
 * RESULT-IMPL-SIGMA-MCP-STAGE-B2-20260915.md §9). Mailbox stays CLI/skill-only
 * (`sigma send`, `sigma inbox read`, write-memo/read-memo) — there is no MCP
 * primitive for it, so both operations report `deferred`.
 */
const IMPLEMENTED = new Set(['project_status', 'session_bootstrap', 'memory', 'doctor']);

export function mcpStatusFor(operationId: string): McpStatus {
  const tier = OPERATION_TIERS[operationId];
  if (tier === undefined || tier === 'NA' || tier === 'W3') return 'not_admissible';
  return IMPLEMENTED.has(operationId) ? 'implemented' : 'deferred';
}

// ── Gate evaluation ──────────────────────────────────────────────────────────

interface GateFacts {
  gate_1_open: boolean;
  gate_2_open: boolean;
  gate_3_satisfied: boolean;
  intent_state: string | null;
}

/**
 * Only the operations whose precondition is stated unambiguously in the
 * registry are gate-evaluated. The rest report their tier authority with
 * gate_evaluated:false rather than guessing — an advisory projection that
 * invents preconditions is worse than one that admits it does not know.
 */
function gateBlocks(operationId: string, g: GateFacts): boolean | null {
  switch (operationId) {
    case 'plan_new':      return !g.gate_1_open;
    case 'exec_new':      return !g.gate_2_open;
    case 'close_new':     return !g.gate_3_satisfied;
    case 'intent_ratify': return g.intent_state !== 'DRAFT';
    default:              return null;
  }
}

export function availabilityFor(operationId: string, gates: GateFacts | null): {
  availability: Availability;
  gate_evaluated: boolean;
} {
  const tier = OPERATION_TIERS[operationId];

  // Unknown operation → forbidden. This is the notion-subcommand case: absent
  // from the registry must not read as "unrestricted".
  if (tier === undefined || tier === 'NA' || tier === 'W3') {
    return { availability: 'forbidden', gate_evaluated: false };
  }

  if (tier === 'Q') return { availability: 'observe', gate_evaluated: false };

  const blocked = gates ? gateBlocks(operationId, gates) : null;
  if (blocked === true) return { availability: 'gate_blocked', gate_evaluated: true };

  const availability: Availability = tier === 'W2' ? 'director_required' : 'role_action';
  return { availability, gate_evaluated: blocked === false };
}

// ── Projection ───────────────────────────────────────────────────────────────

interface RegistryOperation {
  operation_id: string;
  domain?: string;
  level?: string;
  role?: string;
}

function readRegistry(root: string): RegistryOperation[] | null {
  try {
    const raw = fs.readJsonSync(path.join(root, OPERATION_REGISTRY_FILE)) as { operations?: unknown };
    return Array.isArray(raw.operations) ? (raw.operations as RegistryOperation[]) : null;
  } catch {
    return null;
  }
}

function gateFacts(root: string): GateFacts | null {
  try {
    if (listChainVersions(root).length === 0) return null;
    const { data } = readActiveChain(root);
    const g = getGateStatus(data);
    return {
      gate_1_open: g.gate_1_open,
      gate_2_open: g.gate_2_open,
      gate_3_satisfied: g.gate_3_satisfied,
      intent_state: data.intent?.state ?? null,
    };
  } catch {
    return null;
  }
}

export function computeEffectivePolicy(root: string | null, roleFilter?: string): unknown {
  if (!root) {
    return {
      active: false,
      message: 'No active Sigma project or chain in this directory.',
      source: SOURCE_ENGINE,
    };
  }

  const registry = readRegistry(root);
  if (!registry) {
    return {
      active: false,
      message: 'Operation registry not readable in this project.',
      registry_available: false,
      source: SOURCE_ENGINE,
    };
  }

  const gates = gateFacts(root);

  const operations = registry
    .map((op) => {
      const { availability, gate_evaluated } = availabilityFor(op.operation_id, gates);
      return {
        operation_id: op.operation_id,
        tier: OPERATION_TIERS[op.operation_id] ?? null,
        availability,
        gate_evaluated,
        owner_role: OPERATION_OWNER[op.operation_id] ?? null,
        registry_role: op.role ?? null,
        registry_level: op.level ?? null,
        mcp_status: mcpStatusFor(op.operation_id),
      };
    })
    .filter((row) => !roleFilter || row.owner_role === null || row.owner_role === roleFilter);

  const counts = operations.reduce<Record<string, number>>((acc, row) => {
    acc[row.availability] = (acc[row.availability] ?? 0) + 1;
    return acc;
  }, {});

  return {
    active: true,
    registry_available: true,
    gates_evaluated: gates !== null,
    role_filter: roleFilter ?? null,
    counts,
    operations,
    // Said plainly in the payload so a model cannot mistake the projection for
    // permission: nothing here grants anything (§12).
    advisory: true,
    enforcement: 'server-side, re-checked per command',
    source: SOURCE_ENGINE,
  };
}
