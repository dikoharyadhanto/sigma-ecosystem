// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §12 — policy projection.
// PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY-20261015 WP-MCP-02 — manifest-driven.
//
// This module answers "what may be done here, and by whom" as a *projection*.
// It is advisory. Enforcement happens again inside every command, on the
// server, against the same inputs. A consumer that trusts this projection
// instead of attempting the operation is using it wrong, and a command that
// trusts it instead of re-checking is a bug.
//
// The tier, owner and mcp_status of every operation come from ONE place,
// capabilityManifest.ts, an explicit allowlist. It is deliberately NOT derived
// from the registry's own `level`/`role` fields:
//
//   - `level: read_only` does not imply admissible. `scan` is read_only by
//     label and takes an arbitrary file path, which would be sigma_read_file in
//     disguise.
//   - the registry has no ARC/FMN/DEV/AUD dimension at all, only any/director.
//   - a CLI subcommand may exist with no registry entry, so an unknown
//     operation_id must mean FORBIDDEN, never "not restricted".
//
// Hence: anything absent from the manifest is forbidden. The old matrix
// (Implementation/sigma-mcp/SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md)
// is a stale baseline and is not a source of truth.
//
// This module never imports a server: the control server is a separate module
// graph by design. That the manifest's `implemented` claims match the tools the
// servers really register is enforced by test/mcp-capability-manifest.test.ts.

import fs from 'fs-extra';
import path from 'path';
import { OPERATION_REGISTRY_FILE } from '../config';
import { readActiveChain, listChainVersions, getGateStatus } from '../engine/chain';
import { effectiveLifecycleGates } from '../engine/lifecycleView';
import { SOURCE_ENGINE } from './shared';
import {
  CAPABILITY_MANIFEST, TOMBSTONES, capabilityFor, isTombstone,
  type Tier, type McpStatus, type Plane,
} from './capabilityManifest';

export type { Tier, McpStatus, Plane };

/** What a consumer may expect of an operation right now. */
export type Availability =
  | 'observe'            // Q, non-mutating
  | 'role_action'        // W1, a bound role may do it
  | 'director_required'  // W2, needs a durable Director approval
  | 'gate_blocked'       // admissible in principle, blocked by current lifecycle
  | 'forbidden';         // W3/NA — no MCP primitive today

// Derived views of the manifest. Tombstones keep their historical tier NA so
// they stay forbidden and never read as unrestricted.
export const OPERATION_TIERS: Readonly<Record<string, Tier>> = Object.freeze({
  ...Object.fromEntries(CAPABILITY_MANIFEST.map((r) => [r.operation_id, r.tier])),
  ...Object.fromEntries(Object.keys(TOMBSTONES).map((id) => [id, 'NA' as Tier])),
});

/** Owner role per matrix §3. Derived, NOT ratified — advisory only. */
export const OPERATION_OWNER: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(CAPABILITY_MANIFEST.filter((r) => r.owner_role).map((r) => [r.operation_id, r.owner_role as string])),
);

/**
 * Whether an MCP primitive exists, as declared by the manifest. Tombstones and
 * unknown ids are never implemented. `mcp_status` is a claim; the parity test
 * is what proves the named tools are registered on the declared plane.
 */
export function mcpStatusFor(operationId: string): McpStatus {
  if (isTombstone(operationId)) return 'not_admissible';
  return capabilityFor(operationId)?.mcp_status ?? 'not_admissible';
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
    case 'plan_new':
    case 'plan_clone':    return !g.gate_1_open;
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

  // Unknown operation → forbidden: absent from the registry must not read as
  // "unrestricted".
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
    const g = getGateStatus({...data,gates:effectiveLifecycleGates(root,data)});
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
        ...(op.operation_id==='plan_revise_commit'?{conditional_director_approval:'Required for loosening or director checkpoint; ordinary pre/post-build changes are reviewed with EXEC.'}:{}),
        mcp_status: mcpStatusFor(op.operation_id),
        // Declared by the manifest, not introspected: this tool runs in the
        // query server and must not import the control server. The parity test
        // proves the declaration against both servers' real tool lists.
        plane: capabilityFor(op.operation_id)?.plane ?? null,
        mcp_tools: capabilityFor(op.operation_id)?.tool_names ?? [],
        registry_status: isTombstone(op.operation_id) ? 'tombstone' : 'active',
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
