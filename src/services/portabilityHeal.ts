// PLAN-IMPL-SIGMA-GITIGNORE-IDENTITY-AND-PORTABILITY §3.4 items 3-4 / WP-5.
//
// After a project folder is moved, or pulled to another machine while Sigma
// gitignore is OFF, two machine-local artifacts can be stale:
//   - .mcp.json / opencode.* hold an absolute --project-root from the old path;
//   - dev/.sigma-workspace.json (derived from the record in .sigma-identity.json)
//     may be missing.
// Both are derived state, so both are rebuilt. This runs only before mutating
// operations: read-only commands must not change the project by observing it.
// It never throws; a failure is reported on stderr and the command proceeds.

import { getDevWorkspaceStatus, repairDevWorkspace } from '../engine/devWorkspace';
import {
  findStaleMcpProjectRoots,
  tryMcpOp,
  writeClaudeMcpConfig,
  writeOpencodeMcpConfig,
} from '../utils/mcpConfig';

export interface HealReport {
  messages: string[];
}

export function healPortabilityState(projectRoot: string): HealReport {
  const messages: string[] = [];

  try {
    const stale = findStaleMcpProjectRoots(projectRoot);
    if (stale.includes('.mcp.json')) {
      const err = tryMcpOp(() => writeClaudeMcpConfig(projectRoot), '.mcp.json');
      messages.push(err ? `Sigma: .mcp.json points to another project root and could not be refreshed (${err})`
        : 'Sigma: .mcp.json pointed to another project root; refreshed for this location.');
    }
    const opencode = stale.find(name => name.startsWith('opencode.'));
    if (opencode) {
      const err = tryMcpOp(() => writeOpencodeMcpConfig(projectRoot), opencode);
      messages.push(err ? `Sigma: ${opencode} points to another project root and could not be refreshed (${err})`
        : `Sigma: ${opencode} pointed to another project root; refreshed for this location.`);
    }
  } catch (e) {
    messages.push(`Sigma: MCP path check skipped (${(e as Error).message}).`);
  }

  try {
    const status = getDevWorkspaceStatus(projectRoot);
    if (status.state === 'ACTIVE_DEGRADED' && status.degradedReason === 'MARKER_MISSING') {
      repairDevWorkspace(projectRoot);
      messages.push('Sigma: dev/.sigma-workspace.json was missing; rebuilt from the record in .sigma-identity.json.');
    }
  } catch (e) {
    messages.push(`Sigma: DEV workspace marker check skipped (${(e as Error).message}).`);
  }

  return { messages };
}
