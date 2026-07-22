// PLAN-IMPL-01 §3.5 — sigma_get_orientation
//
// Read-only. Reuses buildBootstrapView (the console-free assembly extracted in
// Stage 1) so the CLI `session bootstrap` and this tool never drift. Passes
// through the raw next_valid_operations list; it does NOT classify each
// operation's authority level — that is deferred to the Layer 2 guidance
// increment.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getGateStatusLabel,
  getInvalidWarningLines,
  InvalidGateKey,
} from '../../engine/chain';
import { readIndex, getUnreadForRole } from '../../engine/mailbox';
import { MESSAGING_ROLES, SigmaRole } from '../../config';
import { buildBootstrapView } from '../../session/bootstrapView';
import { resolveRoot, okText, noProject, SOURCE_ENGINE } from '../shared';

const GATE_LABELS: Record<InvalidGateKey, string> = {
  gate_1_open: 'Gate 1 (Design Complete)',
  gate_2_open: 'Gate 2 (Plan Locked)',
  gate_3_satisfied: 'Gate 3 (Build Evidence)',
};

function collectInboxUnread(projectRoot: string, role?: SigmaRole): Record<string, number> {
  const unread: Record<string, number> = {};
  try {
    const index = readIndex(projectRoot);
    const roles = role ? [role] : MESSAGING_ROLES;
    for (const r of roles) {
      if (!(MESSAGING_ROLES as readonly string[]).includes(r)) continue;
      const count = getUnreadForRole(index, r).length;
      if (count > 0) unread[r] = count;
    }
  } catch {
    // index.json absent/unreadable — treat as no unread, same as the CLI.
  }
  return unread;
}

// Pure core (PLAN-IMPL-01 §4-A).
export function computeOrientation(root: string | null, role?: SigmaRole): unknown {
  if (!root) return noProject();

  const view = buildBootstrapView(root);
  const { chain, chainVersion, gates, nextOps } = view;

  // Blockers = gates currently BLOCKED (a locked prerequisite is missing).
  const blockers: string[] = [];
  if (chain) {
    for (const key of Object.keys(GATE_LABELS) as InvalidGateKey[]) {
      if (getGateStatusLabel(chain, key) === 'BLOCKED') {
        blockers.push(`${GATE_LABELS[key]} is BLOCKED`);
      }
    }
  }

  return {
    active: true,
    phase: chain ? chain.lifecycle_state : null,
    active_chain: chainVersion,
    gate_summary: gates,
    next_valid_operations: nextOps,
    stale_intent_warnings: chain ? getInvalidWarningLines(chain) : [],
    blockers,
    inbox_unread: collectInboxUnread(root, role),
    source: SOURCE_ENGINE,
  };
}

export function registerOrientationTool(server: McpServer): void {
  server.registerTool(
    'sigma_get_orientation',
    {
      title: 'Get Sigma Orientation',
      description:
        'Return a one-shot orientation for an AI role operating Sigma: lifecycle phase, active chain, gate summary, the CLI-valid next operations, stale/invalid runtime warnings, blockers, and unread inbox counts. Read-only. Optional argument role (ARC | FMN | DEV | AUD) scopes the inbox counts to that role. Returns { active, phase, active_chain, gate_summary, next_valid_operations, stale_intent_warnings, blockers, inbox_unread, source }. next_valid_operations is the raw CLI-valid list and does NOT indicate which require Director authorization. Returns { active: false, ... } outside a Sigma project.',
      inputSchema: {
        role: z
          .enum(['ARC', 'FMN', 'DEV', 'AUD'])
          .optional()
          .describe('Optional Sigma role to scope inbox unread counts to.'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ role }: { role?: 'ARC' | 'FMN' | 'DEV' | 'AUD' }) =>
      okText(computeOrientation(resolveRoot(), role as SigmaRole | undefined)),
  );
}
