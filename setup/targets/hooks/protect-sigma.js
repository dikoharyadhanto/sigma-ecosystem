#!/usr/bin/env node
'use strict';

const path = require('path');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }

  const tool = input && input.tool_name;
  const args = input && input.tool_input;
  if (typeof tool !== 'string' || !args || typeof args !== 'object') process.exit(0);
  // Claude Write/Edit use file_path; accept older adapter spellings as well.
  const candidates = [args.file_path, args.path, args.filePath];
  const protectedPath = candidates.some(candidate => {
    if (typeof candidate !== 'string') return false;
    const normalized = path.posix.normalize(candidate.replace(/\\/g, '/'));
    return /(?:^|\/)Sigma\/progress(-v\d+)?\.json$/i.test(normalized);
  });

  if (/^(?:Edit|Write|MultiEdit)$/i.test(tool) && protectedPath) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'Sigma progress-v<N>.json is CLI-managed. Use sigma commands (sigma intent ratify, sigma plan approve, etc.) instead of direct edits.',
      },
    }) + '\n');
    process.exit(0);
  }

  process.exit(0);
});
