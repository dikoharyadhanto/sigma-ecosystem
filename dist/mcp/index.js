"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildServer = buildServer;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const config_1 = require("../config");
const state_1 = require("./tools/state");
// Exported so tests can boot the server in-process (PLAN-IMPL-01 §4).
function buildServer() {
    const server = new mcp_js_1.McpServer({ name: 'sigma-mcp-server', version: config_1.SIGMA_VERSION });
    (0, state_1.registerStateTool)(server);
    return server;
}
async function main() {
    const server = buildServer();
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('sigma-mcp running on stdio'); // stderr only — never console.log
}
if (require.main === module) {
    main().catch((e) => {
        console.error('Fatal error in sigma-mcp:', e);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map