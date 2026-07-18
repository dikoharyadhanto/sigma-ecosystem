import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  chainPath,
  writeChainFixture,
  makeChainWithDraftIntent,
  stubProjectRootAnchor,
  TestEnv,
} from './helpers';

// Coverage for PLAN-EVAL-05: `sigma doctor --reconstruct` rebuilds
// progress-v<N>.json chain files from the artifact files on disk, one
// ChainState per major version found. Lock state is never written into
// those files, so the only thing reconstruct can trust is the
// gate-dependency chain: a downstream artifact could only exist if its
// prerequisite was genuinely LOCKED when it was created. Anything that
// cannot be proven this way must come back DRAFT + INVALID, never guessed.

function writeArtifact(sigmaDir: string, subdir: string, filename: string, docType: string): void {
  const dir = path.join(sigmaDir, subdir);
  fs.ensureDirSync(dir);
  fs.writeFileSync(path.join(dir, filename), `<!-- SIGMA:DOC type=${docType} schema=1 -->\n# ${filename}\n`);
}

describe('sigma doctor --reconstruct', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('rebuilds a clean single-cycle chain as fully LOCKED with no INVALID markers (--v)', () => {
    env = setupTestEnv();
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v1.md', 'DIR_INTENT');
    writeArtifact(env.sigmaDir, 'build', 'ROADMAP-v1.md', 'ROADMAP');
    writeArtifact(env.sigmaDir, 'build', 'FMN-PLAN-v0.1.md', 'FMN_PLAN');
    writeArtifact(env.sigmaDir, 'build', 'DEV-EXEC-v0.1.md', 'DEV_EXEC');

    const result = runCli('doctor --reconstruct --v v1', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/No ambiguous state/);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(data.intent).toMatchObject({ version: 'v1', state: 'LOCKED' });
    expect(data.roadmap).toMatchObject({ version: 'v1', state: 'DRAFT' });
    expect(data.plan.versions[0]).toMatchObject({ version: 'v0.1', state: 'LOCKED' });
    expect(data.exec.versions[0]).toMatchObject({ version: 'v0.1', state: 'LOCKED', plan_version_ref: 'v0.1' });
    expect(data.gates).toEqual({ gate_1_open: true, gate_2_open: true, gate_3_satisfied: true });
    expect(data.lifecycle_state).toBe('BUILD');
    expect(data.runtime_invalid.markers).toHaveLength(0);
  });

  it('leaves an unconfirmable lone DIR-INTENT as DRAFT with an INVALID marker instead of guessing LOCKED', () => {
    env = setupTestEnv();
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v1.md', 'DIR_INTENT');

    const result = runCli('doctor --reconstruct --v v1', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Marked INVALID/);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(data.intent).toMatchObject({ version: 'v1', state: 'DRAFT' });
    expect(data.gates.gate_1_open).toBe(false);
    expect(data.lifecycle_state).toBe('DESIGN');
    expect(data.runtime_invalid.markers.length).toBeGreaterThan(0);
    expect(data.runtime_invalid.markers[0].reason).toMatch(/no downstream FMN-PLAN or ROADMAP confirms/);
  });

  it('does not guess a pairing when multiple PLAN drafts exist under the same major', () => {
    env = setupTestEnv();
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v1.md', 'DIR_INTENT');
    writeArtifact(env.sigmaDir, 'build', 'ROADMAP-v1.md', 'ROADMAP');
    writeArtifact(env.sigmaDir, 'build', 'FMN-PLAN-v0.1.md', 'FMN_PLAN');
    writeArtifact(env.sigmaDir, 'build', 'FMN-PLAN-v0.2.md', 'FMN_PLAN');

    const result = runCli('doctor --reconstruct --v v1', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Marked INVALID/);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    const planStates = data.plan.versions.map((v: any) => v.state);
    expect(planStates).toEqual(['DRAFT', 'DRAFT']);
    expect(data.gates.gate_2_open).toBe(false);
    expect(data.runtime_invalid.markers.some((m: any) => /cannot safely pair/.test(m.reason))).toBe(true);
  });

  it('--v targets only the requested chain, leaving other chains on disk untouched', () => {
    env = setupTestEnv();
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v1.md', 'DIR_INTENT');
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v2.md', 'DIR_INTENT');
    const staleV2 = makeChainWithDraftIntent('v2');
    writeChainFixture(env, 'v2', staleV2, { activate: false });

    const result = runCli('doctor --reconstruct --v v1', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(chainPath(env, 'v1'))).toBe(true);
    expect(fs.readJsonSync(chainPath(env, 'v2'))).toEqual(staleV2);
  });

  it('--v fails with a clear error when no DIR-INTENT is found on disk for that version', () => {
    env = setupTestEnv();

    const result = runCli('doctor --reconstruct --v v1', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/No DIR-INTENT-v1\.md found on disk/);
  });

  it('--all-versions reconstructs every major version found on disk in one run', () => {
    env = setupTestEnv();
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v1.md', 'DIR_INTENT');
    writeArtifact(env.sigmaDir, 'build', 'ROADMAP-v1.md', 'ROADMAP');
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v2.md', 'DIR_INTENT');

    const result = runCli('doctor --reconstruct --all-versions', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    const v1 = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    const v2 = fs.readJsonSync(chainPath(env, 'v2')) as Record<string, any>;
    expect(v1.intent.state).toBe('LOCKED');
    expect(v2.intent.state).toBe('DRAFT');
  });

  it('reports an unresolved artifact group when build artifacts exist with no matching DIR-INTENT, and writes nothing for it', () => {
    env = setupTestEnv();
    writeArtifact(env.sigmaDir, 'build', 'FMN-PLAN-v0.1.md', 'FMN_PLAN'); // orphan: no DIR-INTENT-v1.md

    const result = runCli('doctor --reconstruct --all-versions', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Unresolved Artifact Groups/);
    expect(result.stdout).toMatch(/FMN-PLAN-v0\.1\.md/);
    expect(fs.existsSync(chainPath(env, 'v1'))).toBe(false);
  });

  it('default mode (no --v/--all-versions) reconstructs only the currently active chain, leaving others untouched', () => {
    env = setupTestEnv();
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v1.md', 'DIR_INTENT');
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v2.md', 'DIR_INTENT');
    writeArtifact(env.sigmaDir, 'build', 'ROADMAP-v2.md', 'ROADMAP');

    const staleV1 = makeChainWithDraftIntent('v1');
    writeChainFixture(env, 'v1', staleV1, { activate: false });
    writeChainFixture(env, 'v2', makeChainWithDraftIntent('v2')); // activate: true (default) -> active_chain = v2

    const result = runCli('doctor --reconstruct', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(fs.readJsonSync(chainPath(env, 'v1'))).toEqual(staleV1);

    const v2After = fs.readJsonSync(chainPath(env, 'v2')) as Record<string, any>;
    expect(v2After.roadmap).toMatchObject({ version: 'v2', state: 'DRAFT' });
  });

  it('default mode fails with clear guidance when no chain files exist yet and no --v/--all-versions was given', () => {
    env = setupTestEnv();
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v1.md', 'DIR_INTENT');
    // No progress-v*.json on disk at all yet — pure disaster recovery.

    const result = runCli('doctor --reconstruct', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/--v.*--all-versions|--all-versions.*--v/);
  });

  it('--v and --all-versions are mutually exclusive', () => {
    env = setupTestEnv();
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v1.md', 'DIR_INTENT');

    const result = runCli('doctor --reconstruct --v v1 --all-versions', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/mutually exclusive/);
  });

  it('--v without --reconstruct is rejected', () => {
    env = setupTestEnv();

    const result = runCli('doctor --v v1', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/--v is only valid combined with --reconstruct/);
  });
});

describe('sigma doctor --all-versions (reconciliation only, no --reconstruct)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('reconciles every chain file on disk in one run', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', {
      schema_version: '1.0.0', chain_version: 'v1', created_at: now, updated_at: now,
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
      roadmap: null,
      plan: { active_version: null, active_state: null, versions: [], pending: [] },
      exec: { active_version: null, active_state: null, versions: [] },
      close: null,
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
    }, { activate: false });
    writeChainFixture(env, 'v2', {
      schema_version: '1.0.0', chain_version: 'v2', created_at: now, updated_at: now,
      lifecycle_state: 'BUILD',
      intent: { version: 'v2', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v2.md', created_at: now, updated_at: now, locked_at: now },
      roadmap: null,
      plan: { active_version: null, active_state: null, versions: [], pending: [] },
      exec: { active_version: null, active_state: null, versions: [] },
      close: null,
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
    });

    const result = runCli('doctor --all-versions', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Chain v1/);
    expect(result.stdout).toMatch(/Chain v2/);

    const v1 = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    const v2 = fs.readJsonSync(chainPath(env, 'v2')) as Record<string, any>;
    expect(v1.gates.gate_1_open).toBe(true);
    expect(v2.gates.gate_1_open).toBe(true);
  });

  it('reports nothing to reconcile when no chain exists yet', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);

    const result = runCli('doctor --all-versions', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Nothing to reconcile/);
  });
});
