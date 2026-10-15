#!/usr/bin/env node
// Writes Implementation/sigma-mcp/SIGMA-MCP-CAPABILITY-MATRIX.generated.md from
// the capability manifest. Reads compiled output, so run `npx tsc` first.
//
//   node scripts/generate-mcp-matrix.js            write the file
//   node scripts/generate-mcp-matrix.js --check    exit 1 if the file is stale

'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { renderCapabilityMatrix } = require(path.join(root, 'dist', 'mcp', 'capabilityMatrix.js'));
const registry = JSON.parse(fs.readFileSync(path.join(root, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const target = path.join(root, 'Implementation', 'sigma-mcp', 'SIGMA-MCP-CAPABILITY-MATRIX.generated.md');

const text = renderCapabilityMatrix({ sigmaVersion: pkg.version, registry });

if (process.argv.includes('--check')) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (current !== text) {
    console.error('SIGMA-MCP-CAPABILITY-MATRIX.generated.md is stale. Run: node scripts/generate-mcp-matrix.js');
    process.exit(1);
  }
  console.log('Capability matrix is current.');
} else {
  fs.writeFileSync(target, text, 'utf8');
  console.log(`Wrote ${path.relative(root, target)}`);
}
