// Busy-loop reader used by test/atomic-write-regression.test.ts to reproduce
// the RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md §21.9 methodology: hammer
// fs.existsSync() on a target file while another thread/process repeatedly
// overwrites it via tmp+rename, and count how many reads observe the file
// missing entirely. Runs in a real worker thread (separate OS-level fs
// syscalls from the writer) so the race is genuine, not simulated.
import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';

const { filePath, durationMs } = workerData;
const start = Date.now();
let reads = 0;
let misses = 0;

while (Date.now() - start < durationMs) {
  reads++;
  if (!fs.existsSync(filePath)) misses++;
}

parentPort.postMessage({ reads, misses });
