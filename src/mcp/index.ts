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
// sigma_get_memory — the Batch 1 additions sigma_verify_binding,
// sigma_get_effective_policy, and sigma_read_artifact, and the Stage B2
// (evidence-only) addition sigma_get_evidence.
//
// MCP mailbox/memo tools (sigma_list_messages, sigma_read_message) were built
// and reviewed during Stage B2 but withdrawn by Director decision after
// review (2026-09-15, RESULT-IMPL-SIGMA-MCP-STAGE-B2-20260915.md §9): Hermes
// integration does not need them, and cross-role messaging stays on the CLI
// (`sigma send`/`sigma inbox read`) and the write-memo/read-memo skills. Do
// not re-add a mailbox tool here without a fresh Director decision — the
// review that withdrew it found real role-binding and boundary gaps (R-B2-01
// through R-B2-03) that a reintroduction would have to address again.
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
import { registerGetEvidenceTool } from './tools/evidence';
import { registerCheckDocumentTool } from './tools/checkDocument';
import { registerIntentStatusTool } from './tools/intentStatus';
import { registerCloseStatusTool } from './tools/closeStatus';
import { registerPlanStatusTool } from './tools/planStatus';
import { registerExecStatusTool } from './tools/execStatus';
import { registerListIntentsTool } from './tools/listIntents';
import { registerListPlansTool } from './tools/listPlans';
import { registerListExecsTool } from './tools/listExecs';
import { registerListRoadmapStagesTool } from './tools/listRoadmapStages';
import { registerCheckMailboxIntegrityTool } from './tools/checkMailboxIntegrity';
import { registerGetConfigTool } from './tools/getConfig';
import { registerGetOperationLogTool } from './tools/getOperationLog';
import { registerGetGitEvidenceTool } from './tools/getGitEvidence';
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
  registerGetEvidenceTool(server);
  // Stage B2 — first primitive: sigma_check_document. See checkDocument.ts's
  // header for why this is one generic typed tool where the rest of B2 is
  // not.
  registerCheckDocumentTool(server);
  // Stage B2 — STATUS group: four separate tools, not one generic tool —
  // intent/close are single-object + gate, plan/exec are
  // DRAFT/LOCKED-categorized with pairing/pending, genuinely different
  // shapes (see each tool's header).
  registerIntentStatusTool(server);
  registerCloseStatusTool(server);
  registerPlanStatusTool(server);
  registerExecStatusTool(server);
  // Stage B2 — LIST group: four separate tools, not one generic tool —
  // intent_list is the only cross-chain operation in this project,
  // plan_list has a pending sub-list exec_list doesn't, and roadmap_list is
  // actually a stage listing, not a roadmap-version listing (see
  // listRoadmapStages.ts's header — registry description mismatch).
  registerListIntentsTool(server);
  registerListPlansTool(server);
  registerListExecsTool(server);
  registerListRoadmapStagesTool(server);
  // Stage B2 — final four: inbox_check (mailbox integrity, NOT the same
  // family as sigma_check_document despite the name — see
  // checkMailboxIntegrity.ts), config_show, report_logs, git_evidence.
  // memo_list stays excluded from this batch — Director decision
  // 2026-09-16, mailbox domain stays untouched beyond the integrity check.
  registerCheckMailboxIntegrityTool(server);
  registerGetConfigTool(server);
  registerGetOperationLogTool(server);
  registerGetGitEvidenceTool(server);
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

// NO startup side effect here — this module only exports.
//
// It used to auto-start when `require.main.filename` ended with
// "sigma-mcp.js". That condition is true when bin/sigma-mcp.js requires this
// module, and bin then called startMcpServer() itself: two servers attached to
// one stdio pair, answering every request twice with the same JSON-RPC id.
// Reviewer finding R-02, reproduced against the real executable — one
// `initialize` with id=1 produced two RESULT frames, both id=1.
//
// The defect predates Batch 1: both halves were already present before this
// work began, so every sigma-mcp session on this host has been double-
// answering since Phase 0.
//
// bin/sigma-mcp.js is now the single entrypoint. Do not reintroduce an
// auto-start here; test/mcp-binding.test.ts asserts exactly one startup line
// and exactly one response per request id against the real binary.
