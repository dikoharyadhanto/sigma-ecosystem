"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildServer = buildServer;
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
// Exported so tests can boot the server in-process (PLAN-IMPL-01 §4).
function buildServer() {
    const server = new mcp_js_1.McpServer({ name: 'sigma-mcp-server', version: config_1.SIGMA_VERSION });
    (0, state_1.registerStateTool)(server);
    (0, orientation_1.registerOrientationTool)(server);
    (0, gates_1.registerGatesTool)(server);
    (0, artifacts_1.registerArtifactsTool)(server);
    (0, doctor_1.registerDoctorTool)(server);
    (0, memory_1.registerMemoryTool)(server);
    return server;
}
const shared_1 = require("./shared");
async function startMcpServer() {
    const server = buildServer();
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('sigma-mcp running on stdio'); // stderr only — never console.log
    // Best-effort fetch client roots via MCP protocol (roots/list)
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