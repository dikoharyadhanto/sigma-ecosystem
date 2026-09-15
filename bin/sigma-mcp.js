#!/usr/bin/env node
const mcp = require('../dist/mcp/index.js');
if (mcp && typeof mcp.startMcpServer === 'function') {
  // Binding arguments are parsed from argv at startup (PLAN-IMPL-SIGMA-MCP
  // §7.1). Passed explicitly rather than read from process.argv inside the
  // server so the same entry path is drivable from tests.
  mcp.startMcpServer(process.argv.slice(2)).catch((e) => {
    console.error('Fatal error in sigma-mcp:', e);
    process.exit(1);
  });
}
