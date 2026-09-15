"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildServer = buildServer;
exports.bindFromArgv = bindFromArgv;
exports.startMcpServer = startMcpServer;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const config_1 = require("../config");
const state_1 = require("./tools/state");
const orientation_1 = require("./tools/orientation");
const gates_1 = require("./tools/gates");
const artifacts_1 = require("./tools/artifacts");
const doctor_1 = require("./tools/doctor");
const memory_1 = require("./tools/memory");
const verifyBinding_1 = require("./tools/verifyBinding");
const effectivePolicy_1 = require("./tools/effectivePolicy");
const readArtifact_1 = require("./tools/readArtifact");
const shared_1 = require("./shared");
const binding_1 = require("./binding");
// Exported so tests can boot the server in-process (PLAN-IMPL-01 §4).
function buildServer() {
    const server = new mcp_js_1.McpServer({ name: 'sigma-mcp-server', version: config_1.SIGMA_VERSION });
    (0, state_1.registerStateTool)(server);
    (0, orientation_1.registerOrientationTool)(server);
    (0, gates_1.registerGatesTool)(server);
    (0, artifacts_1.registerArtifactsTool)(server);
    (0, doctor_1.registerDoctorTool)(server);
    (0, memory_1.registerMemoryTool)(server);
    (0, verifyBinding_1.registerVerifyBindingTool)(server);
    (0, effectivePolicy_1.registerEffectivePolicyTool)(server);
    (0, readArtifact_1.registerReadArtifactTool)(server);
    return server;
}
/**
 * Establishes the binding from process arguments. A BindingError here is fatal
 * by design: a server that cannot tell which project it is bound to must not
 * start and answer questions about whichever project it happens to find.
 */
function bindFromArgv(argv) {
    (0, shared_1.setBinding)((0, binding_1.resolveBinding)((0, binding_1.parseBindingArgs)(argv)));
}
async function startMcpServer(argv = process.argv.slice(2)) {
    try {
        bindFromArgv(argv);
    }
    catch (e) {
        if (e instanceof binding_1.BindingError) {
            console.error(`sigma-mcp refusing to start: [${e.code}] ${e.message}`);
            process.exit(2);
        }
        throw e;
    }
    const binding = (0, shared_1.getBinding)();
    const server = buildServer();
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error(`sigma-mcp running on stdio (mode=${binding.mode} binding=${binding.kind} verified=${binding.verified})`); // stderr only — never console.log
    // Client roots are a discovery-mode fallback only. A bound server must not
    // let the client's idea of a workspace influence which project it serves, so
    // it does not even ask (§7.1 rule 5).
    if (!binding.root) {
        try {
            const rootsResult = await server.server.listRoots();
            if (rootsResult && Array.isArray(rootsResult.roots)) {
                for (const r of rootsResult.roots) {
                    if (r.uri)
                        (0, shared_1.addClientRoot)(r.uri);
                }
            }
        }
        catch {
            // Client may not support roots capability
        }
    }
}
const isEntrypoint = typeof require !== 'undefined' &&
    require.main &&
    (require.main === module || require.main.filename.endsWith('sigma-mcp.js'));
if (isEntrypoint) {
    startMcpServer().catch((e) => {
        console.error('Fatal error in sigma-mcp:', e);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map