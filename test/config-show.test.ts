import { describe, it, expect, afterEach } from 'vitest';
import { setupTestEnv, runCli, stubProjectRootAnchor, TestEnv } from './helpers';

// F14 removed the Notion humanize gate, so `sigma config show` no longer
// reports it. What remains must still print.

describe('sigma config show', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('prints the language and mailbox lines and no Notion Humanize Gate line', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);

    const result = runCli('config show', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/AI Communication Language:/);
    expect(result.stdout).toMatch(/Mailbox Auto-Outdate Keep:/);
    expect(result.stdout).not.toMatch(/Notion|Humanize Gate/i);
  });
});
