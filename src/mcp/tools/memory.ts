// PLAN-IMPL-01 — sigma_get_memory
//
// Read-only. Wraps loadRoleMemory from the engine so AI agents can retrieve
// role memory reminders via MCP without shelling out to `sigma memory --<role>`.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadRoleMemory, ROLE_MEMORY_ROLES, RoleMemoryRole } from '../../engine/roleMemory';
import { resolveRoot, okText, SOURCE_ENGINE } from '../shared';

export function computeMemory(root: string | null, role: RoleMemoryRole): unknown {
  try {
    const { memory, sourcePath } = loadRoleMemory(role, root ?? undefined);
    return {
      active: true,
      role: memory.role,
      authority: memory.authority,
      source_rule: memory.source_rule,
      source_rule_version: memory.source_rule_version,
      memory_updated_at: memory.memory_updated_at,
      general: memory.general,
      role_specific: memory.role_specific,
      source_path: sourcePath,
      source: SOURCE_ENGINE,
    };
  } catch (err) {
    return {
      active: false,
      error: (err as Error).message,
      source: SOURCE_ENGINE,
    };
  }
}

export function registerMemoryTool(server: McpServer): void {
  server.registerTool(
    'sigma_get_memory',
    {
      title: 'Get Sigma Role Memory',
      description:
        'Return role memory reminders for a specific Sigma governance role (ARC, FMN, DEV, or AUD). Read-only; wraps the same engine code path as `sigma memory --<role>`. Accepts required role parameter and optional project_root. Returns { active: true, role, authority, source_rule, source_rule_version, memory_updated_at, general, role_specific, source_path, source } or { active: false, error, source } on error.',
      inputSchema: {
        role: z
          .enum(ROLE_MEMORY_ROLES)
          .describe('Governance role to retrieve memory for: ARC, FMN, DEV, or AUD.'),
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
    async ({ role, project_root }: { role: RoleMemoryRole; project_root?: string }) =>
      okText(computeMemory(resolveRoot(project_root), role)),
  );
}
