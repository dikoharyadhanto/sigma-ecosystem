#!/usr/bin/env node
const mcp = require('../dist/mcp/index.js');
if (mcp && typeof mcp.startMcpServer === 'function') {
  mcp.startMcpServer().catch((e) => {
    console.error('Fatal error in sigma-mcp:', e);
    process.exit(1);
  });
}
