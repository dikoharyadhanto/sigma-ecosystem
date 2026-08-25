import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  ChainState,
  createInitialChain,
  ratifyIntent,
  registerPlanDraft,
  lockPlanVersion,
  registerExecDraft,
  nextExecVersion,
} from '../src/engine/chain';
import {
  setupTestEnv,
  runCli,
  stubProjectRootAnchor,
  writeChainFixture,
  makeChain,
  chainPath,
  validPlanDoc,
  TestEnv,
} from './helpers';

// PLAN-IMPL-MULTIDRAFT-LOCK §6.3/§13.1 (Director directive 2026-08-12) —
// EXEC version must equal PLAN version exactly, in every condition,
// including the non-sequential-execution scenario from discussion §1.2
// which the old chain-wide-counter nextExecVersion() got wrong (it would
// produce EXEC v1.3 for a PLAN v1.1 executed after PLAN v1.2).

function lockedIntentChain(version = 'v1'): ChainState {
  const chain = createInitialChain(version, `Sigma/charter/DIR-INTENT-${version}.md`);
  ratifyIntent(chain);
  return chain;
}

describe('nextExecVersion — identity with the referenced PLAN version', () => {
  it('always returns exactly the plan version reference, ignoring any existing exec versions', () => {
    const chain = lockedIntentChain();
    expect(nextExecVersion(chain, 'v1.7')).toBe('v1.7');
  });
});

describe('registerExecDraft — version invariant guards (PLAN-IMPL-MULTIDRAFT-LOCK §6.3)', () => {
  it('throws when the EXEC version does not exactly equal the PLAN version it references', () => {
    const chain = lockedIntentChain();
    registerPlanDraft(chain, 'v0.1', 'Sigma/contract/FMN-PLAN-v0.1.md', 'v1');
    lockPlanVersion(chain, 'v0.1');
    expect(() => registerExecDraft(chain, 'v0.2', 'Sigma/evidence/DEV-EXEC-v0.2.md', 'v0.1'))
      .toThrow(/EXEC version must equal PLAN version exactly/);
  });

  it('still rejects a duplicate EXEC version — defensive guard retained', () => {
    const chain = lockedIntentChain();
    registerPlanDraft(chain, 'v0.1', 'Sigma/contract/FMN-PLAN-v0.1.md', 'v1');
    lockPlanVersion(chain, 'v0.1');
    registerExecDraft(chain, 'v0.1', 'Sigma/evidence/DEV-EXEC-v0.1.md', 'v0.1');
    expect(() => registerExecDraft(chain, 'v0.1', 'Sigma/evidence/DEV-EXEC-v0.1.md', 'v0.1'))
      .toThrow(/Duplicate DEV-EXEC version/);
  });
});

describe('sigma exec new — EXEC version always equals PLAN version (CLI end-to-end)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('sequential execution: single LOCKED plan produces an exec with the identical version', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
      plan: {
        active_version: 'v1.1', active_state: 'LOCKED', pending: [],
        versions: [{ version: 'v1.1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
      },
      gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
    }));

    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const exec = data.exec as Record<string, unknown>;
    const versions = exec.versions as Array<Record<string, unknown>>;
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe('v1.1');
    expect(versions[0].plan_version_ref).toBe('v1.1');
  });

  it('non-sequential execution (discussion §1.2): executing PLAN v1.1 after PLAN v1.2 still yields EXEC v1.1, not a chain-wide-counter version', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
      plan: {
        active_version: 'v1.2', active_state: 'LOCKED', pending: [],
        versions: [
          { version: 'v1.1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
          { version: 'v1.2', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.2.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
        ],
      },
      gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
    }));

    // Execute the newer plan first — the old chain-wide counter would seed
    // highestExecMinor at 2 here.
    const first = runCli('exec new --plan v1.2', env.projectDir, env.homeDir);
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toMatch(/DEV-EXEC-v1\.2/);

    // Now execute the older plan. Under the old algorithm this produced
    // v1.3 (highestExecMinor=2, +1). Under the new identity rule it must be
    // v1.1 — matching PLAN v1.1 exactly.
    const second = runCli('exec new --plan v1.1', env.projectDir, env.homeDir);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toMatch(/DEV-EXEC-v1\.1/);
    expect(second.stdout).not.toMatch(/DEV-EXEC-v1\.3/);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const exec = data.exec as Record<string, unknown>;
    const versions = exec.versions as Array<Record<string, unknown>>;
    expect(versions.map(v => v.version).sort()).toEqual(['v1.1', 'v1.2']);
    expect(versions.find(v => v.plan_version_ref === 'v1.1')?.version).toBe('v1.1');
    expect(versions.find(v => v.plan_version_ref === 'v1.2')?.version).toBe('v1.2');
  });

  it('full abandon-and-retry cycle (supersede → plan new → plan lock → exec new) still produces a matching pair', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
      roadmap: { version: 'v1', state: 'LOCKED', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now },
      plan: {
        active_version: 'v0.1', active_state: 'LOCKED', pending: [],
        versions: [{ version: 'v0.1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v0.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
      },
      exec: {
        active_version: 'v0.1', active_state: 'DRAFT',
        versions: [{ version: 'v0.1', state: 'DRAFT', file: 'Sigma/evidence/DEV-EXEC-v0.1.md', created_at: now, updated_at: now, plan_version_ref: 'v0.1' }],
      },
      gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
    }));
    fs.writeFileSync(
      path.join(env.projectDir, 'Sigma', 'roadmap', 'ROADMAP-v1.md'),
      '# ROADMAP v1\n\n<!-- SIGMA:RENDER:START:stage-overview -->\n<!-- SIGMA:ROADMAP:SECTION:STAGE_OVERVIEW -->\n## 3. Stage Overview\n<!-- SIGMA:RENDER:END:stage-overview -->\n'
    );

    // Abandon PLAN v0.1 (and its unfinished DRAFT exec, via cascade).
    const supersede = runCli('plan supersede --v v0.1 --reason "wrong approach"', env.projectDir, env.homeDir);
    expect(supersede.exitCode).toBe(0);

    // Open a fresh plan version to retry.
    const planNew = runCli('plan new --title "Retry" --focus "Retry focus"', env.projectDir, env.homeDir);
    expect(planNew.exitCode).toBe(0);
    const afterPlanNew = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const planAfterNew = afterPlanNew.plan as Record<string, unknown>;
    const newPlanVersion = planAfterNew.active_version as string;
    expect(newPlanVersion).not.toBe('v0.1');

    // Satisfy the AUD verdict gate, then lock it.
    fs.writeFileSync(
      path.join(env.projectDir, 'Sigma', 'contract', `FMN-PLAN-${newPlanVersion}.md`),
      validPlanDoc(newPlanVersion)
    );
    const planLock = runCli(`plan lock --v ${newPlanVersion}`, env.projectDir, env.homeDir);
    expect(planLock.exitCode).toBe(0);

    // Execute it — the resulting EXEC must carry the exact same version.
    const execNew = runCli(`exec new --plan ${newPlanVersion}`, env.projectDir, env.homeDir);
    expect(execNew.exitCode).toBe(0);

    const final = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const finalExec = final.exec as Record<string, unknown>;
    const finalVersions = finalExec.versions as Array<Record<string, unknown>>;
    const newExecEntry = finalVersions.find(v => v.plan_version_ref === newPlanVersion);
    expect(newExecEntry?.version).toBe(newPlanVersion);
  });
});
