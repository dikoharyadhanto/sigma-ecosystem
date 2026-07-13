import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { setupTestEnv, runCli, TestEnv } from './helpers';

// Coverage for PLAN-EVAL-01 Bagian B.3: `sigma doctor --reconstruct` rebuilds
// progress.json purely from artifact files on disk. Lock state is never
// written into those files, so the only thing reconstruct can trust is the
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

  it('rebuilds a clean single-cycle chain as fully LOCKED with no INVALID markers', () => {
    env = setupTestEnv();
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v1.md', 'DIR_INTENT');
    writeArtifact(env.sigmaDir, 'build', 'ROADMAP-v1.md', 'ROADMAP');
    writeArtifact(env.sigmaDir, 'build', 'FMN-PLAN-v0.1.md', 'FMN_PLAN');
    writeArtifact(env.sigmaDir, 'build', 'DEV-EXEC-v0.1.md', 'DEV_EXEC');

    const result = runCli('doctor --reconstruct --id TEST --name "Test Project"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/No ambiguous state/);

    const data = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(data.intent.versions).toHaveLength(1);
    expect(data.intent.versions[0]).toMatchObject({ version: 'v1', state: 'LOCKED' });
    expect(data.roadmap.versions[0]).toMatchObject({ version: 'v1', state: 'ACTIVE' });
    expect(data.plan.versions[0]).toMatchObject({ version: 'v0.1', state: 'LOCKED' });
    expect(data.exec.versions[0]).toMatchObject({ version: 'v0.1', state: 'LOCKED', plan_version_ref: 'v0.1' });
    expect(data.gates).toEqual({ gate_1_open: true, gate_2_open: true, gate_3_satisfied: true });
    expect(data.lifecycle_state).toBe('BUILD');
    expect(data.runtime_invalid.markers).toHaveLength(0);
  });

  it('leaves an unconfirmable lone DIR-INTENT as DRAFT with an INVALID marker instead of guessing LOCKED', () => {
    env = setupTestEnv();
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v1.md', 'DIR_INTENT');

    const result = runCli('doctor --reconstruct --id TEST --name "Test Project"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Marked INVALID/);

    const data = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(data.intent.versions[0]).toMatchObject({ version: 'v1', state: 'DRAFT' });
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

    const result = runCli('doctor --reconstruct --id TEST --name "Test Project"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Marked INVALID/);

    const data = fs.readJsonSync(env.progressPath) as Record<string, any>;
    const planStates = data.plan.versions.map((v: any) => v.state);
    expect(planStates).toEqual(['DRAFT', 'DRAFT']);
    expect(data.gates.gate_2_open).toBe(false);
    expect(data.runtime_invalid.markers.some((m: any) => /cannot safely pair/.test(m.reason))).toBe(true);
  });

  it('recovers project identity from --id/--name and backs up an unreadable progress.json', () => {
    env = setupTestEnv();
    fs.writeFileSync(env.progressPath, '{ not valid json');
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v1.md', 'DIR_INTENT');

    const result = runCli('doctor --reconstruct --id RECOV --name "Recovered Project"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/backed up to/i);

    const data = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(data.project_id).toBe('RECOV');
    expect(data.project_name).toBe('Recovered Project');

    const logsDir = path.join(env.sigmaDir, 'logs');
    const backups = fs.readdirSync(logsDir).filter(f => f.startsWith('reconstruct-backup-'));
    expect(backups.length).toBe(1);
  });
});
