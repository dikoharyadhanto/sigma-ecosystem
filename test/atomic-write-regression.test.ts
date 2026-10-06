// Regression coverage for RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md §21.9 —
// writeChain()/writeActivateStatus() (src/engine/chain.ts), writeJsonAtomic()
// (src/engine/controlStore.ts), and writeCanonicalArtifactFile()
// (src/mcp/control/canonicalWrite.ts) all wrote via
// `fs.moveSync(tmp, dest, { overwrite: true })`, which fs-extra implements as
// `removeSync(dest)` then `rename()` — two syscalls, not one atomic replace.
// An empirical two-thread reproduction at the time of the finding measured
// ~55% of concurrent reads observing the destination file missing entirely
// during write contention.
//
// The fix (applied alongside this test) replaces that idiom with a direct
// `fs.renameSync(tmp, dest)` everywhere it appeared — a true OS-level atomic
// replace on both POSIX and Windows for a tmp file on the same filesystem as
// its destination, which is always the case here since tmp paths are always
// `${dest}.tmp...`. These tests reproduce the exact methodology (a busy-loop
// reader racing a busy-loop writer) against the *fixed* functions and assert
// zero misses — proving the visibility gap is closed, not just asserting the
// code looks different.
//
// The reader runs in a real worker_thread (test/helpers/existsBusyLoop.worker.mjs)
// so its fs.existsSync() calls are genuine concurrent OS-level syscalls
// racing the writer's tmp+rename, not a simulation within one call stack.

import { describe, it, expect } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { Worker } from 'worker_threads';

import { chainFilePath, activateStatusPath, writeChain, writeActivateStatus, createInitialChain } from '../src/engine/chain';
import { writeTicket, ticketPath, generateId, OperationTicket } from '../src/engine/controlStore';
import { writeCanonicalArtifactFile } from '../src/mcp/control/canonicalWrite';
import { setupTestEnv, writeChainFixture, makeChain, TestEnv } from './helpers';

const WORKER_PATH = path.join(__dirname, 'helpers', 'existsBusyLoop.worker.mjs');
const RACE_DURATION_MS = 1200;

interface RaceResult {
  reads: number;
  misses: number;
}

function raceReaderAgainstWriter(filePath: string, write: () => void): Promise<RaceResult> {
  const worker = new Worker(WORKER_PATH, { workerData: { filePath, durationMs: RACE_DURATION_MS } });
  const resultPromise = new Promise<RaceResult>((resolve, reject) => {
    worker.once('message', resolve);
    worker.once('error', reject);
  });

  const deadline = Date.now() + RACE_DURATION_MS;
  let writes = 0;
  while (Date.now() < deadline) {
    write();
    writes++;
  }

  return resultPromise.then(async (result) => {
    await worker.terminate();
    expect(writes).toBeGreaterThan(0); // sanity: the race actually happened
    return result;
  });
}

describe('atomic-write regression — writeChain()/writeActivateStatus() (chain.ts)', () => {
  it('writeChain never leaves progress-vN.json observably missing under write contention', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-atomic-chain-'));
    fs.mkdirSync(path.join(projectRoot, 'Sigma'), { recursive: true });
    const chain = createInitialChain('v1', 'Sigma/charter/DIR-INTENT-v1.md');
    writeChain(projectRoot, 'v1', chain); // establish the file before racing overwrites

    const filePath = chainFilePath(projectRoot, 'v1');
    let toggle = false;
    const result = await raceReaderAgainstWriter(filePath, () => {
      toggle = !toggle;
      writeChain(projectRoot, 'v1', { ...chain, lifecycle_state: toggle ? 'DESIGN' : 'BUILD' } as typeof chain);
    });

    expect(result.reads).toBeGreaterThan(0);
    expect(result.misses).toBe(0);
    fs.removeSync(projectRoot);
  });

  it('writeActivateStatus never leaves activate_status.json observably missing under write contention', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-atomic-activate-'));
    fs.mkdirSync(path.join(projectRoot, 'Sigma'), { recursive: true });
    writeActivateStatus(projectRoot, 'v1');

    const filePath = activateStatusPath(projectRoot);
    let toggle = false;
    const result = await raceReaderAgainstWriter(filePath, () => {
      toggle = !toggle;
      writeActivateStatus(projectRoot, toggle ? 'v1' : 'v2');
    });

    expect(result.reads).toBeGreaterThan(0);
    expect(result.misses).toBe(0);
    fs.removeSync(projectRoot);
  });
});

describe('atomic-write regression — writeJsonAtomic() (controlStore.ts, via writeTicket)', () => {
  it('writeTicket never leaves its ticket file observably missing under write contention', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-atomic-ticket-'));
    fs.mkdirSync(path.join(projectRoot, 'Sigma'), { recursive: true });

    const ticketId = generateId('op');
    const baseTicket: OperationTicket = {
      operation_ticket_id: ticketId,
      operation_id: 'intent_ratify',
      project_id: 'TEST',
      bound_role: 'ARC',
      arguments_hash: 'sha256:' + crypto.createHash('sha256').update('x').digest('hex'),
      target: null,
      expected_state_revision: 'sha256:' + crypto.createHash('sha256').update('y').digest('hex'),
      effects: [],
      authority: 'director',
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      consumed_at: null,
    };
    writeTicket(projectRoot, baseTicket); // establish the file before racing overwrites

    const filePath = ticketPath(projectRoot, ticketId);
    let toggle = false;
    const result = await raceReaderAgainstWriter(filePath, () => {
      toggle = !toggle;
      writeTicket(projectRoot, { ...baseTicket, consumed_at: toggle ? null : new Date().toISOString() });
    });

    expect(result.reads).toBeGreaterThan(0);
    expect(result.misses).toBe(0);
    fs.removeSync(projectRoot);
  });
});

describe('atomic-write regression — writeCanonicalArtifactFile() (mcp/control/canonicalWrite.ts)', () => {
  it('never leaves the canonical artifact file observably missing under write contention', async () => {
    const env: TestEnv = setupTestEnv();
    const chain = makeChain('v1');
    writeChainFixture(env, 'v1', chain);
    writeCanonicalArtifactFile(env.projectDir, 'intent', 'v1', 'Sigma/charter/DIR-INTENT-v1.md', '# initial');

    const filePath = path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md');
    let n = 0;
    const result = await raceReaderAgainstWriter(filePath, () => {
      n++;
      writeCanonicalArtifactFile(env.projectDir, 'intent', 'v1', 'Sigma/charter/DIR-INTENT-v1.md', `# revision ${n}`);
    });

    expect(result.reads).toBeGreaterThan(0);
    expect(result.misses).toBe(0);
    env.cleanup();
  });
});
