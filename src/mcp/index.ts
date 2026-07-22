// PLAN-IMPL-01 — sigma-mcp entry point (stdio).
//
// Native MCP server exposing Sigma governance state to AI clients as
// structured tools, so a client can orient without shelling out to `sigma` and
// parsing terminal text. The CLI remains the operational authority; this layer
// is read-only over the same engine functions.
//
// Stage 1 registers sigma_get_state (proves the boot path + engine reuse).
// Stage 2 adds sigma_get_orientation, sigma_get_gates, sigma_list_artifacts,
// sigma_doctor.
//
// stdout is reserved for JSON-RPC frames — all diagnostics go to stderr.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SIGMA_VERSION } from '../config';
import { registerStateTool } from './tools/state';

// Exported so tests can boot the server in-process (PLAN-IMPL-01 §4).
export function buildServer(): McpServer {
  const server = new McpServer({ name: 'sigma-mcp-server', version: SIGMA_VERSION });
  registerStateTool(server);
  return server;
}

async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('sigma-mcp running on stdio'); // stderr only — never console.log
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal error in sigma-mcp:', e);
    process.exit(1);
  });
}
