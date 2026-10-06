import { afterAll } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

// config.ts resolves global paths at module load. Isolate both platform
// home variables before test modules import it, rather than in beforeEach.
const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-suite-home-'));
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;
process.env.HOME = testHome;
process.env.USERPROFILE = testHome;

afterAll(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;
  fs.removeSync(testHome);
});
