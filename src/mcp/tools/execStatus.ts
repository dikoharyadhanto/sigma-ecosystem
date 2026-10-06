// Stage B2 — sigma_exec_status. Query-plane equivalent of `sigma exec
// status` — categorizes chain.exec.versions[] into DRAFT/LOCKED with their
// plan_version_ref, plus Gate 3. Simpler than plan_status: exec has no
// pending concept.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readActiveChain, listChainVersions, ArtifactVersion } from '../../engine/chain';
import { SOURCE_ENGINE, noProject } from '../shared';
import { respond } from '../contract';

export function computeExecStatus(root: string | null): unknown {
  if (!root) return noProject();
  if (listChainVersions(root).length === 0) {
    return { active: false, gate_3_satisfied: false, source: SOURCE_ENGINE };
  }

  const { chainVersion, data: chain } = readActiveChain(root);
  const byCreatedAt = (a: ArtifactVersion, b: ArtifactVersion) => a.created_at.localeCompare(b.created_at);

  const drafts = chain.exec.versions.filter((v) => v.state === 'DRAFT').sort(byCreatedAt);
  const locked = chain.exec.versions.filter((v) => v.state === 'LOCKED').sort(byCreatedAt);
  const supersededCount = chain.exec.versions.filter((v) => v.state === 'SUPERSEDED').length;

  return {
    active: true,
    active_chain: chainVersion,
    drafts: drafts.map((d) => ({ version: d.version, plan_version_ref: d.plan_version_ref ?? null, created_at: d.created_at })),
    locked: locked.map((e) => ({ version: e.version, plan_version_ref: e.plan_version_ref ?? null })),
    superseded_count: supersededCount,
    gate_3_satisfied: chain.gates.gate_3_satisfied,
    source: SOURCE_ENGINE,
  };
}

export function registerExecStatusTool(server: McpServer): void {
  server.registerTool(
    'sigma_exec_status',
    {
      title: 'Get DEV-EXEC status',
      description:
        'Return the active chain\'s DEV-EXEC status — the query-plane equivalent of `sigma exec status`: open ' +
        'DRAFTs with plan pairing, LOCKED execs, a count of SUPERSEDED execs not otherwise listed, and Gate 3. ' +
        'Read-only. Returns { active, active_chain, drafts, locked, superseded_count, gate_3_satisfied, source }.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () =>
      respond('sigma_exec_status', undefined, (root) => computeExecStatus(root))
  );
}
