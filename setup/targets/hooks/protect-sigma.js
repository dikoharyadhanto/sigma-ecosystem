#!/usr/bin/env node
'use strict';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }

  const tool = input.tool_name || '';
  const filePath = (input.tool_input || {}).path || '';

  if (/Edit|Write/.test(tool) && /Sigma[\/\\]progress(-v\d+)?\.json$/.test(filePath)) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: 'Sigma progress-v<N>.json is CLI-managed. Use sigma commands (sigma intent ratify, sigma plan lock, etc.) instead of direct edits.',
    }) + '\n');
    process.exit(0);
  }

  process.exit(0);
});
