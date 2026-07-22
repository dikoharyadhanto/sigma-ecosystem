// PLAN-IMPL-01 §3.1 — sigma_get_state
//
// Read-only. Wraps the same engine functions the CLI uses (readActiveChain,
// getGateStatus, hasInvalidRuntime). No writer function is imported here.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  readActiveChain,
  readProjectIdentity,
  listChainVersions,
  getGateStatus,
  hasInvalidRuntime,
} from '../../engine/chain';
import { resolveRoot, okText, noProject, SOURCE_ENGINE } from '../shared';

// Core logic exported as a pure function so it can be unit-tested without the
// MCP transport (PLAN-IMPL-01 §4-A). registerStateTool is a thin wrapper.
export function computeState(root: string | null): unknown {
  if (!root) return noProject();

  const identity = readProjectIdentity(root);

  if (listChainVersions(root).length === 0) {
    return noProject({
      project_id: identity.project_id,
      project_name: identity.project_name,
    });
  }

  const { chainVersion, data } = readActiveChain(root);
  return {
    active: true,
    phase: data.lifecycle_state,
    active_chain: chainVersion,
    project_id: identity.project_id,
    project_name: identity.project_name,
    schema_version: data.schema_version,
    gates: getGateStatus(data),
    has_invalid_runtime: hasInvalidRuntime(data),
    source: SOURCE_ENGINE,
  };
}

import { z } from 'zod';

export function registerStateTool(server: McpServer): void {
  server.registerTool(
    'sigma_get_state',
    {
      title: 'Get Sigma Lifecycle State',
      description:
        'Return the current Sigma lifecycle phase, active chain, project identity, and gate summary. Read-only; wraps the same engine code path as the CLI. Accepts optional project_root parameter. Returns { active, phase, active_chain, project_id, project_name, schema_version, gates, has_invalid_runtime, source }, or { active: false, ... } when no Sigma chain exists.',
      inputSchema: {
        project_root: z
          .string()
          .optional()
          .describe('Optional absolute path to the Sigma project root directory.'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ project_root }: { project_root?: string }) =>
      okText(computeState(resolveRoot(project_root))),
  );
}
