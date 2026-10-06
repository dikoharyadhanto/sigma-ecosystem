#!/usr/bin/env node
// Stage C — sigma-control entrypoint. Separate binary from bin/sigma-mcp.js
// on purpose: a client that never launches this file never gains a single
// write tool, regardless of what flags it passes. Not registered in any
// mcpConfig.ts writer output and not auto-installed (plan §18.2).
const control = require('../dist/mcp/control/index.js');
if (control && typeof control.startControlServer === 'function') {
  control.startControlServer(process.argv.slice(2)).catch((e) => {
    console.error('Fatal error in sigma-control:', e);
    process.exit(1);
  });
}
