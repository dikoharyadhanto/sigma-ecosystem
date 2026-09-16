// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §6.1, §9.2, Stage C — sigma-control
// entry point. A separate logical MCP server from sigma-mcp (src/mcp/index.ts):
// separate binary (bin/sigma-control.js), separate module graph, never
// imported by the query server. That physical separation is what makes
// "control tool tidak boleh terlihat pada profile yang tidak diberi
// capability" (§22) true by construction rather than by a runtime toggle a
// misconfiguration could flip.
//
// Not installed by anything: src/utils/mcpConfig.ts's writer never emits an
// entry for this binary, and `npm link`/global install status is unaffected
// by this file existing (adding a bin entry to package.json only takes
// effect on the next explicit link/install, which this work does not run —
// see the Batch 1 caveat about the pre-existing global sigma-mcp symlink).
//
// Registers exactly two tools for the pilot (plan §14 Stage C item 4: one
// narrow lifecycle first). Both require role ARC and go through
// respondControlWrite() for idempotency/stale-state/audit — see
// src/mcp/control/shared.ts.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SIGMA_VERSION } from '../../config';
import { setBinding, getBinding } from '../shared';
import { parseBindingArgs, resolveBinding, BindingError } from '../binding';
import { registerCreateIntentDraftTool } from './tools/createIntentDraft';
import { registerUpdateArtifactDraftTool } from './tools/updateArtifactDraft';
import { registerPrepareIntentRatifyTool } from './tools/prepareIntentRatify';
import { registerCommitIntentRatifyTool } from './tools/commitIntentRatify';
import { registerCreatePlanDraftTool } from './tools/createPlanDraft';
import { registerCreateExecDraftTool } from './tools/createExecDraft';
import { registerCreateRoadmapDraftTool } from './tools/createRoadmapDraft';
import { registerRenderRoadmapTool } from './tools/renderRoadmap';
import { registerUpdateReferenceTool } from './tools/updateReference';
import { registerIntentHumanizeTool } from './tools/intentHumanize';
import { registerExecHumanizeTool } from './tools/execHumanize';
import { registerCloseHumanizeTool } from './tools/closeHumanize';
import { registerArchiveMessageTool } from './tools/archiveMessage';
import { registerRecordEvidenceTool } from './tools/recordEvidence';

export function buildControlServer(): McpServer {
  const server = new McpServer({ name: 'sigma-control-server', version: SIGMA_VERSION });
  // Stage C — W1 bounded command pilot (create + update DRAFT).
  registerCreateIntentDraftTool(server);
  registerUpdateArtifactDraftTool(server);
  // Stage D — W2 governance transition pilot (prepare -> Director approval
  // via trusted local CLI -> commit). No MCP tool writes an approval record;
  // that is deliberately outside this server's reach — see
  // src/commands/control.ts.
  registerPrepareIntentRatifyTool(server);
  registerCommitIntentRatifyTool(server);
  // Stage E W1 pilot — one primitive at a time (plan §14 Stage E item 1).
  // First: create-only, mirroring the intent_draft pattern for an
  // array-of-versions artifact type instead of a single-object one.
  registerCreatePlanDraftTool(server);
  // Second: exec_draft — version is the referenced PLAN's own version (no
  // independent counter), and target-PLAN selection is real business logic
  // (PLAN-IMPL-MULTIDRAFT-LOCK §4), not a formality.
  registerCreateExecDraftTool(server);
  // Stage E W1 — remaining primitives batch: roadmap (single-object chain
  // domain, no independent version counter).
  registerCreateRoadmapDraftTool(server);
  registerRenderRoadmapTool(server);
  registerUpdateReferenceTool(server);
  // Stage E W1 — human projection family (Notion scaffolding), three
  // separate primitives (ARC/DEV/AUD) rather than one generic tool — see
  // intentHumanizeService.ts's header for why.
  registerIntentHumanizeTool(server);
  registerExecHumanizeTool(server);
  registerCloseHumanizeTool(server);
  // Stage E W1 — inbox_archive. New ownership check the CLI doesn't have;
  // reconciled with the CLI/MCP shared-service invariant via a shared
  // service with an actor-context parameter — see
  // src/services/inboxArchiveService.ts's header.
  registerArchiveMessageTool(server);
  // Stage E W1 — record_evidence. No CLI equivalent — see
  // recordEvidence.ts's header.
  registerRecordEvidenceTool(server);
  return server;
}

/**
 * Mode is forced to 'control' regardless of what argv says — this binary has
 * exactly one purpose, and a caller passing `--mode query` to it by mistake
 * must not silently get a control server that believes it is a query server.
 * resolveBinding() then applies control mode's stricter rules: project-root,
 * project-id, and role are all required, or the process refuses to start.
 */
export function bindControlFromArgv(argv: string[]): void {
  const parsed = parseBindingArgs(argv);
  setBinding(resolveBinding({ ...parsed, mode: 'control' }));
}

export async function startControlServer(argv: string[] = process.argv.slice(2)): Promise<void> {
  try {
    bindControlFromArgv(argv);
  } catch (e) {
    if (e instanceof BindingError) {
      console.error(`sigma-control refusing to start: [${e.code}] ${e.message}`);
      process.exit(2);
    }
    throw e;
  }

  const binding = getBinding();
  const server = buildControlServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `sigma-control running on stdio (mode=control binding=${binding.kind} verified=${binding.verified} role=${binding.role})`
  ); // stderr only — stdout is reserved for JSON-RPC frames
}

// NO startup side effect here, same discipline as src/mcp/index.ts (reviewer
// finding R-02 was exactly this pattern reintroducing a double-start).
// bin/sigma-control.js is the only entrypoint that calls startControlServer().
