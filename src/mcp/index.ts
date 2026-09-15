// PLAN-IMPL-01 — sigma-mcp entry point (stdio).
//
// Native MCP server exposing Sigma governance state to AI clients as
// structured tools, so a client can orient without shelling out to `sigma` and
// parsing terminal text. The CLI remains the operational authority; this layer
// is read-only over the same engine functions.
//
// Stage A (PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §7) added startup binding:
// the server resolves ONE project from trusted process arguments before it
// accepts any tool call, and never re-resolves afterwards.
//
// Registers the six read-only core tools — sigma_get_state,
// sigma_get_orientation, sigma_get_gates, sigma_list_artifacts, sigma_doctor,
// sigma_get_memory — plus the Batch 1 additions sigma_verify_binding,
// sigma_get_effective_policy, and sigma_read_artifact.
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
import { registerVerifyBindingTool } from './tools/verifyBinding';
import { registerEffectivePolicyTool } from './tools/effectivePolicy';
import { registerReadArtifactTool } from './tools/readArtifact';
import { addClientRoot, setBinding, getBinding } from './shared';
import { parseBindingArgs, resolveBinding, BindingError } from './binding';

// Exported so tests can boot the server in-process (PLAN-IMPL-01 §4).
export function buildServer(): McpServer {
  const server = new McpServer({ name: 'sigma-mcp-server', version: SIGMA_VERSION });
  registerStateTool(server);
  registerOrientationTool(server);
  registerGatesTool(server);
  registerArtifactsTool(server);
  registerDoctorTool(server);
  registerMemoryTool(server);
  registerVerifyBindingTool(server);
  registerEffectivePolicyTool(server);
  registerReadArtifactTool(server);
  return server;
}

/**
 * Establishes the binding from process arguments. A BindingError here is fatal
 * by design: a server that cannot tell which project it is bound to must not
 * start and answer questions about whichever project it happens to find.
 */
export function bindFromArgv(argv: string[]): void {
  setBinding(resolveBinding(parseBindingArgs(argv)));
}

export async function startMcpServer(argv: string[] = process.argv.slice(2)): Promise<void> {
  try {
    bindFromArgv(argv);
  } catch (e) {
    if (e instanceof BindingError) {
      console.error(`sigma-mcp refusing to start: [${e.code}] ${e.message}`);
      process.exit(2);
    }
    throw e;
  }

  const binding = getBinding();
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `sigma-mcp running on stdio (mode=${binding.mode} binding=${binding.kind} verified=${binding.verified})`
  ); // stderr only — never console.log

  // Client roots are a discovery-mode fallback only. A bound server must not
  // let the client's idea of a workspace influence which project it serves, so
  // it does not even ask (§7.1 rule 5).
  if (!binding.root) {
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
