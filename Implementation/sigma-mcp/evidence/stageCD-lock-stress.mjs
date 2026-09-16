import { spawn } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const controlStore = path.join(repoRoot, 'dist', 'engine', 'controlStore.js');
const trials = Number(process.argv[2] ?? 100);

if (!Number.isSafeInteger(trials) || trials < 1) {
  throw new Error('Trial count must be a positive integer.');
}

const childSource = String.raw`
const fs = require('fs');
const { acquireProjectLock } = require(process.argv[1]);
const [root, ready, start, guard] = process.argv.slice(2);

(async () => {
  fs.writeFileSync(ready, String(process.pid), { flag: 'wx' });
  while (!fs.existsSync(start)) await new Promise((resolve) => setTimeout(resolve, 1));

  const handle = await acquireProjectLock(root);
  let ownsGuard = false;
  try {
    fs.writeFileSync(guard, String(process.pid), { flag: 'wx' });
    ownsGuard = true;
    await new Promise((resolve) => setTimeout(resolve, 8));
  } catch (err) {
    if (err && err.code === 'EEXIST') {
      console.error('CONCURRENT_ENTRY');
      process.exitCode = 42;
    } else {
      throw err;
    }
  } finally {
    if (ownsGuard) fs.unlinkSync(guard);
    await handle.release();
  }
})().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exitCode = 1;
});
`;

function waitForFile(file, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (fs.existsSync(file)) return resolve();
      if (Date.now() > deadline) return reject(new Error(`Timed out waiting for ${file}`));
      setTimeout(poll, 2);
    };
    poll();
  });
}

function spawnContender(root, ready, start, guard) {
  const child = spawn(process.execPath, ['-e', childSource, controlStore, root, ready, start, guard], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const completion = new Promise((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  return { child, completion };
}

let completed = 0;
for (let trial = 1; trial <= trials; trial += 1) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-lock-stress-'));
  const readyA = path.join(root, 'ready-a');
  const readyB = path.join(root, 'ready-b');
  const start = path.join(root, 'start');
  const guard = path.join(root, 'critical-section.guard');
  try {
    const a = spawnContender(root, readyA, start, guard);
    const b = spawnContender(root, readyB, start, guard);
    await Promise.all([waitForFile(readyA), waitForFile(readyB)]);
    fs.writeFileSync(start, 'go', { flag: 'wx' });
    const [resultA, resultB] = await Promise.all([a.completion, b.completion]);
    if (resultA.code !== 0 || resultB.code !== 0) {
      throw new Error(JSON.stringify({ trial, resultA, resultB }));
    }
    completed += 1;
  } finally {
    fs.removeSync(root);
  }
}

console.log(JSON.stringify({ primitive: 'proper-lockfile', trials: completed, concurrent_entry_violations: 0 }));
