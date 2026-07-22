// PLAN-IMPL-01 — sigma-mcp entry point (stdio).
//
// Native MCP server exposing Sigma governance state to AI clients as
// structured tools, so a client can orient without shelling out to `sigma` and
// parsing terminal text. The CLI remains the operational authority; this layer
// is read-only over the same engine functions.
//
// Registers the six read-only core tools: sigma_get_state,
// sigma_get_orientation, sigma_get_gates, sigma_list_artifacts, sigma_doctor,
// sigma_get_memory.
//
// stdout is reserved for JSON-RPC frames — all diagnostics go to stderr.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SIGMA_VERSION } from '../config';
import { registerStateTool } from './tools/state';
import { registerOrientationTool } from './tools/orientation';
import { registerGatesTool } from './tools/gates';
import { registerArtifactsTool } from './tools/artifacts';
import { registerDoctorTool } from './tools/doctor';
import { registerMemoryTool } from './tools/memory';

// Exported so tests can boot the server in-process (PLAN-IMPL-01 §4).
export function buildServer(): McpServer {
  const server = new McpServer({ name: 'sigma-mcp-server', version: SIGMA_VERSION });
  registerStateTool(server);
  registerOrientationTool(server);
  registerGatesTool(server);
  registerArtifactsTool(server);
  registerDoctorTool(server);
  registerMemoryTool(server);
  return server;
}

import { addClientRoot } from './shared';

export async function startMcpServer(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('sigma-mcp running on stdio'); // stderr only — never console.log

  // Best-effort fetch client roots via MCP protocol (roots/list)
  try {
    const rootsResult = await server.server.listRoots();
    if (rootsResult && Array.isArray(rootsResult.roots)) {
      for (const r of rootsResult.roots) {
        if (r.uri) addClientRoot(r.uri);
      }
    }
  } catch {
    // Client may not support roots capability
  }
}

const isEntrypoint =
  typeof require !== 'undefined' &&
  require.main &&
  (require.main === module || require.main.filename.endsWith('sigma-mcp.js'));

if (isEntrypoint) {
  startMcpServer().catch((e) => {
    console.error('Fatal error in sigma-mcp:', e);
    process.exit(1);
  });
}
