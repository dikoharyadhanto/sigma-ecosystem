// PLAN-IMPL-01 §3.4 — sigma_doctor
//
// Read-only WITH RESPECT TO DISK. runDoctorReconciliation mutates the chain
// object in memory (auto-repair of known corruption patterns) but only
// persists if the caller invokes writeChain. This tool deliberately never
// calls writeChain: it reports what reconciliation WOULD change as a
// diagnosis, flagged applied: false. A disk-writing doctor is a mutation and
// belongs to a later (Layer 3) increment, not here.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  readActiveChain,
  listChainVersions,
  readOverrides,
  runDoctorReconciliation,
} from '../../engine/chain';
import { resolveRoot, okText, noProject, SOURCE_ENGINE } from '../shared';

// Pure core (PLAN-IMPL-01 §4-A).
export function computeDoctor(root: string | null): unknown {
  if (!root) return noProject();
  if (listChainVersions(root).length === 0) return noProject();

  // readActiveChain returns a fresh in-memory projection; mutating it here does
  // not touch disk because we never writeChain.
  const { data } = readActiveChain(root);
  const overrides = readOverrides(root);
  const findings = runDoctorReconciliation(data, overrides);

  return {
    active: true,
    findings,
    applied: false,
    source: SOURCE_ENGINE,
  };
}

export function registerDoctorTool(server: McpServer): void {
  server.registerTool(
    'sigma_doctor',
    {
      title: 'Sigma Doctor (diagnosis only)',
      description:
        'Run Sigma runtime reconciliation as a READ-ONLY diagnosis and report what it would repair or flag, without writing to disk. Takes no arguments. Returns { active, findings: { repaired, invalidMarked, invalidCleared, remainingInvalid }, applied: false, source }. applied is always false — this tool never persists changes. Returns { active: false, ... } when no chain exists.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => okText(computeDoctor(resolveRoot())),
  );
}
