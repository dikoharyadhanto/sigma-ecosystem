import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv, runCli, makeChainWithLockedIntent, writeChainFixture, stubProjectIdentity, TestEnv,
} from './helpers';

// PLAN-IMPL-SIGMA-REPORT-DIAGNOSTIC-MESSAGE-GIT-BOUNDARY — WP-TST-02 / TC-TST-04 / TC-TST-05.
//
// An operation may be classified `read_only` in the operation registry only if
// running it changes nothing: project files, global config, messages, the
// operation log, or Git (index, refs, worktree). Every registry read_only
// operation is run against one fixture and the whole tree is hashed before and
// after. A new read_only operation without a row below fails the coverage test
// with the id to add, so the classification cannot drift silently.
//
// History: this test found `scan` mislabelled read_only (it writes
// Sigma/logs/<ts>_terminology-scan.log when terms are found); it is now
// `semantic` in the registry and therefore absent here.

const ROOT = path.resolve(__dirname, '..');

const REGISTRY = fs.readJsonSync(path.join(ROOT, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json')) as {
  operations: Array<{ operation_id: string; level: string }>;
};
const READ_ONLY_IDS = REGISTRY.operations.filter(o => o.level === 'read_only').map(o => o.operation_id);

// operation_id -> CLI arguments. Command path is the operation id with `_` as a
// space, except where the CLI differs (none today). Arguments are equivalence
// class representatives: required flags supplied, optional flags omitted.
const INVOCATIONS: Record<string, string> = {
  project_status: 'project status',
  session_bootstrap: 'session bootstrap',
  intent_status: 'intent status',
  intent_list: 'intent list',
  plan_lock: 'plan lock',
  plan_status: 'plan status',
  plan_list: 'plan list',
  exec_lock: 'exec lock',
  exec_status: 'exec status',
  exec_list: 'exec list',
  review_check: 'review check',
  close_status: 'close status',
  git_evidence: 'git evidence',
  roadmap_list: 'roadmap list',
  config_show: 'config show',
  inbox: 'inbox --role fmn',
  inbox_check: 'inbox check',
  close_check: 'close check',
  exec_check: 'exec check',
  intent_check: 'intent check',
  memory: 'memory --arc',
  plan_check: 'plan check',
  roadmap_check: 'roadmap check',
  report_logs: 'report logs',
  memo_list: 'memo list --role fmn',
  dev_status: 'dev status',
  notes_list: 'notes list',
  audit_show: 'audit show',
  decisions_list: 'decisions list',
  decisions_target: 'decisions target --type plan --v v1',
  control_show: 'control show TICKET-0',
  intent_amendment_preview: 'intent amendment preview',
  intent_baseline_check: 'intent baseline check',
};

function git(cwd: string, args: string): void {
  execSync(`git ${args}`, { cwd, stdio: 'ignore' });
}

// Hash of every file under the given roots (path + bytes), sorted for stability.
function snapshot(...roots: string[]): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (root: string, dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(root, abs);
      else if (entry.isFile()) {
        out.set(`${path.basename(root)}:${path.relative(root, abs)}`,
          crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex'));
      }
    }
  };
  roots.forEach(r => walk(r, r));
  return out;
}

function diff(before: Map<string, string>, after: Map<string, string>): string[] {
  const changed: string[] = [];
  for (const [k, v] of after) {
    if (!before.has(k)) changed.push(`+ ${k}`);
    else if (before.get(k) !== v) changed.push(`~ ${k}`);
  }
  for (const k of before.keys()) if (!after.has(k)) changed.push(`- ${k}`);
  return changed.sort();
}

describe('read_only operations are observationally pure', () => {
  let env: TestEnv;

  beforeAll(() => {
    env = setupTestEnv();
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    stubProjectIdentity(env);
    // One UNREAD message so inbox/memo listings have something to act on.
    const sent = runCli('send --from arc --to fmn --related-artifact GENERAL --message "seed"', env.projectDir, env.homeDir);
    expect(sent.exitCode).toBe(0);
    git(env.projectDir, 'init -q');
    git(env.projectDir, 'config user.email t@example.invalid');
    git(env.projectDir, 'config user.name t');
    git(env.projectDir, 'add -A');
    git(env.projectDir, 'commit -q -m seed');
  });

  afterAll(() => env?.cleanup());

  it('has an invocation for every registry read_only operation, and none stale', () => {
    expect(READ_ONLY_IDS.filter(id => !(id in INVOCATIONS)).sort(),
      'add these operation ids to INVOCATIONS').toEqual([]);
    expect(Object.keys(INVOCATIONS).filter(id => !READ_ONLY_IDS.includes(id)).sort(),
      'these ids are no longer read_only in the registry').toEqual([]);
  });

  for (const id of READ_ONLY_IDS) {
    it(`${id} changes no project, global, or Git state`, () => {
      const args = INVOCATIONS[id];
      if (!args) return; // reported by the coverage test above
      const before = snapshot(env.projectDir, path.join(env.homeDir, '.sigma'));
      runCli(args, env.projectDir, env.homeDir);
      const after = snapshot(env.projectDir, path.join(env.homeDir, '.sigma'));
      expect(diff(before, after), `\`sigma ${args}\` mutated state although the registry classifies ${id} as read_only`)
        .toEqual([]);
    });
  }
});
