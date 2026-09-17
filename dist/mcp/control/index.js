"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildControlServer = buildControlServer;
exports.bindControlFromArgv = bindControlFromArgv;
exports.startControlServer = startControlServer;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const config_1 = require("../../config");
const shared_1 = require("../shared");
const binding_1 = require("../binding");
const createIntentDraft_1 = require("./tools/createIntentDraft");
const updateArtifactDraft_1 = require("./tools/updateArtifactDraft");
const prepareIntentRatify_1 = require("./tools/prepareIntentRatify");
const commitIntentRatify_1 = require("./tools/commitIntentRatify");
const createPlanDraft_1 = require("./tools/createPlanDraft");
const createExecDraft_1 = require("./tools/createExecDraft");
const createRoadmapDraft_1 = require("./tools/createRoadmapDraft");
const renderRoadmap_1 = require("./tools/renderRoadmap");
const updateReference_1 = require("./tools/updateReference");
const intentHumanize_1 = require("./tools/intentHumanize");
const execHumanize_1 = require("./tools/execHumanize");
const closeHumanize_1 = require("./tools/closeHumanize");
const archiveMessage_1 = require("./tools/archiveMessage");
const recordEvidence_1 = require("./tools/recordEvidence");
const prepareIntentAmendment_1 = require("./tools/prepareIntentAmendment");
const commitIntentAmendment_1 = require("./tools/commitIntentAmendment");
const prepareIntentScore_1 = require("./tools/prepareIntentScore");
const commitIntentScore_1 = require("./tools/commitIntentScore");
const preparePlanLock_1 = require("./tools/preparePlanLock");
const commitPlanLock_1 = require("./tools/commitPlanLock");
const prepareExecLock_1 = require("./tools/prepareExecLock");
const commitExecLock_1 = require("./tools/commitExecLock");
const prepareCloseNew_1 = require("./tools/prepareCloseNew");
const commitCloseNew_1 = require("./tools/commitCloseNew");
const prepareIntentSupersede_1 = require("./tools/prepareIntentSupersede");
const commitIntentSupersede_1 = require("./tools/commitIntentSupersede");
const preparePlanSupersede_1 = require("./tools/preparePlanSupersede");
const commitPlanSupersede_1 = require("./tools/commitPlanSupersede");
const prepareCloseLock_1 = require("./tools/prepareCloseLock");
const commitCloseLock_1 = require("./tools/commitCloseLock");
const preparePlanPromote_1 = require("./tools/preparePlanPromote");
const commitPlanPromote_1 = require("./tools/commitPlanPromote");
function buildControlServer() {
    const server = new mcp_js_1.McpServer({ name: 'sigma-control-server', version: config_1.SIGMA_VERSION });
    // Stage C — W1 bounded command pilot (create + update DRAFT).
    (0, createIntentDraft_1.registerCreateIntentDraftTool)(server);
    (0, updateArtifactDraft_1.registerUpdateArtifactDraftTool)(server);
    // Stage D — W2 governance transition pilot (prepare -> Director approval
    // via trusted local CLI -> commit). No MCP tool writes an approval record;
    // that is deliberately outside this server's reach — see
    // src/commands/control.ts.
    (0, prepareIntentRatify_1.registerPrepareIntentRatifyTool)(server);
    (0, commitIntentRatify_1.registerCommitIntentRatifyTool)(server);
    // Stage E W1 pilot — one primitive at a time (plan §14 Stage E item 1).
    // First: create-only, mirroring the intent_draft pattern for an
    // array-of-versions artifact type instead of a single-object one.
    (0, createPlanDraft_1.registerCreatePlanDraftTool)(server);
    // Second: exec_draft — version is the referenced PLAN's own version (no
    // independent counter), and target-PLAN selection is real business logic
    // (PLAN-IMPL-MULTIDRAFT-LOCK §4), not a formality.
    (0, createExecDraft_1.registerCreateExecDraftTool)(server);
    // Stage E W1 — remaining primitives batch: roadmap (single-object chain
    // domain, no independent version counter).
    (0, createRoadmapDraft_1.registerCreateRoadmapDraftTool)(server);
    (0, renderRoadmap_1.registerRenderRoadmapTool)(server);
    (0, updateReference_1.registerUpdateReferenceTool)(server);
    // Stage E W1 — human projection family (Notion scaffolding), three
    // separate primitives (ARC/DEV/AUD) rather than one generic tool — see
    // intentHumanizeService.ts's header for why.
    (0, intentHumanize_1.registerIntentHumanizeTool)(server);
    (0, execHumanize_1.registerExecHumanizeTool)(server);
    (0, closeHumanize_1.registerCloseHumanizeTool)(server);
    // Stage E W1 — inbox_archive. New ownership check the CLI doesn't have;
    // reconciled with the CLI/MCP shared-service invariant via a shared
    // service with an actor-context parameter — see
    // src/services/inboxArchiveService.ts's header.
    (0, archiveMessage_1.registerArchiveMessageTool)(server);
    // Stage E W1 — record_evidence. No CLI equivalent — see
    // recordEvidence.ts's header.
    (0, recordEvidence_1.registerRecordEvidenceTool)(server);
    // Stage F — W2 governance transition batch (5 of 10 operations; see
    // SIGMA-MCP-OPERATION-CAPABILITY-MATRIX §3.3). Each follows Stage D's
    // prepare -> Director approval (trusted local CLI) -> commit shape.
    (0, prepareIntentAmendment_1.registerPrepareIntentAmendmentTool)(server);
    (0, commitIntentAmendment_1.registerCommitIntentAmendmentTool)(server);
    (0, prepareIntentScore_1.registerPrepareIntentScoreTool)(server);
    (0, commitIntentScore_1.registerCommitIntentScoreTool)(server);
    (0, preparePlanLock_1.registerPreparePlanLockTool)(server);
    (0, commitPlanLock_1.registerCommitPlanLockTool)(server);
    (0, prepareExecLock_1.registerPrepareExecLockTool)(server);
    (0, commitExecLock_1.registerCommitExecLockTool)(server);
    (0, prepareCloseNew_1.registerPrepareCloseNewTool)(server);
    (0, commitCloseNew_1.registerCommitCloseNewTool)(server);
    // Stage F continued — 3 more W2 operations (8 of 10 total in this tier).
    (0, prepareIntentSupersede_1.registerPrepareIntentSupersedeTool)(server);
    (0, commitIntentSupersede_1.registerCommitIntentSupersedeTool)(server);
    (0, preparePlanSupersede_1.registerPreparePlanSupersedeTool)(server);
    (0, commitPlanSupersede_1.registerCommitPlanSupersedeTool)(server);
    (0, prepareCloseLock_1.registerPrepareCloseLockTool)(server);
    (0, commitCloseLock_1.registerCommitCloseLockTool)(server);
    // Stage F — plan_promote closes out 9 of 10 W2 operations (intent_activate
    // deliberately NOT built as an MCP primitive — Director decision
    // 2026-09-17, see SIGMA-MCP-OPERATION-CAPABILITY-MATRIX §3.3).
    (0, preparePlanPromote_1.registerPreparePlanPromoteTool)(server);
    (0, commitPlanPromote_1.registerCommitPlanPromoteTool)(server);
    return server;
}
/**
 * Mode is forced to 'control' regardless of what argv says — this binary has
 * exactly one purpose, and a caller passing `--mode query` to it by mistake
 * must not silently get a control server that believes it is a query server.
 * resolveBinding() then applies control mode's stricter rules: project-root,
 * project-id, and role are all required, or the process refuses to start.
 */
function bindControlFromArgv(argv) {
    const parsed = (0, binding_1.parseBindingArgs)(argv);
    (0, shared_1.setBinding)((0, binding_1.resolveBinding)({ ...parsed, mode: 'control' }));
}
async function startControlServer(argv = process.argv.slice(2)) {
    try {
        bindControlFromArgv(argv);
    }
    catch (e) {
        if (e instanceof binding_1.BindingError) {
            console.error(`sigma-control refusing to start: [${e.code}] ${e.message}`);
            process.exit(2);
        }
        throw e;
    }
    const binding = (0, shared_1.getBinding)();
    const server = buildControlServer();
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error(`sigma-control running on stdio (mode=control binding=${binding.kind} verified=${binding.verified} role=${binding.role})`); // stderr only — stdout is reserved for JSON-RPC frames
}
// NO startup side effect here, same discipline as src/mcp/index.ts (reviewer
// finding R-02 was exactly this pattern reintroducing a double-start).
// bin/sigma-control.js is the only entrypoint that calls startControlServer().
//# sourceMappingURL=index.js.map