#!/usr/bin/env node
/**
 * Installs the repo's git hooks (scripts/git-hooks/*) into .git/hooks.
 * Idempotent: overwrites only hooks that came from this installer or don't exist.
 *
 * Usage: node scripts/install-git-hooks.js
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const hooksSrc = path.join(repoRoot, 'scripts', 'git-hooks');
const hooksDst = path.join(repoRoot, '.git', 'hooks');

if (!fs.existsSync(hooksDst)) {
  // Not a git checkout (e.g. npm tarball install) — nothing to do.
  process.exit(0);
}

const MARKER = '[sigma git-hook]';

for (const name of fs.readdirSync(hooksSrc)) {
  const src = path.join(hooksSrc, name);
  const dst = path.join(hooksDst, name);

  if (fs.existsSync(dst)) {
    const existing = fs.readFileSync(dst, 'utf8');
    if (!existing.includes(MARKER)) {
      console.warn(`skip ${name}: .git/hooks/${name} exists and was not installed by this script`);
      continue;
    }
  }

  fs.copyFileSync(src, dst);
  fs.chmodSync(dst, 0o755);
  console.log(`installed ${name} -> .git/hooks/${name}`);
}
