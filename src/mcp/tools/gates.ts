// PLAN-IMPL-01 §3.2 — sigma_get_gates
//
// Read-only. Wraps getGateStatus + getGateStatusLabel + getInvalidMarkers.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  readActiveChain,
  listChainVersions,
  getGateStatus,
  getGateStatusLabel,
  getInvalidMarkers,
  InvalidGateKey,
} from '../../engine/chain';
import { resolveRoot, okText, noProject, SOURCE_ENGINE } from '../shared';

const GATE_KEYS: InvalidGateKey[] = ['gate_1_open', 'gate_2_open', 'gate_3_satisfied'];

// Pure core (PLAN-IMPL-01 §4-A) — unit-testable without the transport.
export function computeGates(root: string | null): unknown {
  if (!root) return noProject();
  if (listChainVersions(root).length === 0) return noProject();

  const { data } = readActiveChain(root);
  const gates = getGateStatus(data);
  const labels: Record<string, string> = {};
  for (const key of GATE_KEYS) {
    labels[key] = getGateStatusLabel(data, key);
  }

  return {
    active: true,
    gate_1_open: gates.gate_1_open,
    gate_2_open: gates.gate_2_open,
    gate_3_satisfied: gates.gate_3_satisfied,
    labels,
    invalid_markers: getInvalidMarkers(data),
    source: SOURCE_ENGINE,
  };
}

export function registerGatesTool(server: McpServer): void {
  server.registerTool(
    'sigma_get_gates',
    {
      title: 'Get Sigma Gate Status',
      description:
        'Return the three Sigma lifecycle gates with human-readable labels and any INVALID runtime markers. Read-only; takes no arguments. Returns { active, gate_1_open, gate_2_open, gate_3_satisfied, labels: { gate_1_open, gate_2_open, gate_3_satisfied }, invalid_markers, source }. Each label is one of OPEN | BLOCKED | SATISFIED | INVALID. Returns { active: false, ... } when no chain exists.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => okText(computeGates(resolveRoot())),
  );
}
