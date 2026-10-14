import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv, stubProjectIdentity, stubProjectRootAnchor, validIntentDocV5, validPlanDocV3, validExecDocV4, runCli, TestEnv,
} from './helpers';
import {
  createInitialChain, ratifyIntent, certifyIntentDoc, registerPlanDraft, registerExecDraft, writeChain, writeActivateStatus, readActiveChain, readChain, chainFilePath,
} from '../src/engine/chain';
import { writeChainMetadata } from '../src/engine/numbering';
import { withGovernanceTransaction } from '../src/engine/governanceTransaction';
import { approveArtifactUseCase, approveArtifactTransactionFiles } from '../src/services/approvalService';
import { acknowledgePlan, artifactFile } from '../src/engine/revisions';
import { discoverArtifacts } from '../src/engine/reconstruct';
import { resolveMailboxReference } from '../src/engine/mailboxContext';
import { allowedRelPaths } from '../src/mcp/artifactPath';
import { recordChangelogForLockedExec } from '../src/services/changelogService';
import { createExecDraft } from '../src/services/execDraftService';
import { createPlanDraft } from '../src/services/planDraftService';
import { promotePlanUseCase } from '../src/services/planPromoteService';
import {
  artifactFileName, candidateFileNames, matchArtifactName, matchArtifactRel, classifyArtifactRel, pendingPlanRelCandidates,
  existingArtifactNames, assertNoArtifactConflict, defaultArtifactRel, artifactNameRegex,
} from '../src/engine/artifactNames';

const envs: TestEnv[] = [];
afterEach(() => { for (const e of envs.splice(0)) e.cleanup(); });

const V = 'v1.1';

describe('F10 — artifact name module', () => {
  it('builds new names without a role prefix, and leaves ROADMAP unchanged', () => {
    expect(artifactFileName('intent', 'v1')).toBe('INTENT-v1.md');
    expect(artifactFileName('plan', 'v1.1')).toBe('PLAN-v1.1.md');
    expect(artifactFileName('exec', 'v1.1')).toBe('EXEC-v1.1.md');
    expect(artifactFileName('close', 'v1')).toBe('CLOSE-v1.md');
    expect(artifactFileName('roadmap', 'v1')).toBe('ROADMAP-v1.md');
  });

  it('lists the current name first, then the pre-F10 name', () => {
    expect(candidateFileNames('plan', 'v1.1')).toEqual(['PLAN-v1.1.md', 'FMN-PLAN-v1.1.md']);
    expect(candidateFileNames('roadmap', 'v1')).toEqual(['ROADMAP-v1.md']);
  });

  it('recognizes both forms and reports which one it saw', () => {
    expect(matchArtifactName('intent', 'INTENT-v1.md')).toEqual({ version: 'v1', form: 'current' });
    expect(matchArtifactName('intent', 'DIR-INTENT-v1.md')).toEqual({ version: 'v1', form: 'legacy' });
    expect(matchArtifactName('plan', 'FMN-PLAN-v1.1.md')).toEqual({ version: 'v1.1', form: 'legacy' });
    expect(matchArtifactName('exec', 'EXEC-v1.12.md')).toEqual({ version: 'v1.12', form: 'current' });
  });

  it.each([
    ['plan', 'PLAN-v1.md'],          // plan versions need a minor part
    ['intent', 'INTENT-v1.1.md'],    // intent versions have none
    ['plan', 'XPLAN-v1.1.md'],       // not anchored at the start
    ['plan', 'PLAN-v1.1.md.bak'],
    ['exec', 'DEV-PLAN-v1.1.md'],
    ['close', 'DIR-INTENT-v1.md'],
  ] as const)('does not recognize %s file name %s', (domain, name) => {
    expect(matchArtifactName(domain, name)).toBeNull();
  });

  it('hands out a fresh RegExp each time', () => {
    expect(artifactNameRegex('plan')).not.toBe(artifactNameRegex('plan'));
  });

  it('is directory-aware: a revision staging file is not a plan', () => {
    expect(matchArtifactRel('plan', 'Sigma/contract/PLAN-v1.1.md')).toMatchObject({ dir: 'contract', version: 'v1.1', form: 'current' });
    expect(matchArtifactRel('plan', 'Sigma/contract/FMN-PLAN-v1.1.md')).toMatchObject({ form: 'legacy' });
    expect(matchArtifactRel('plan', 'Sigma/revisions/staging/PLAN-v1.1.md')).toBeNull();
    expect(matchArtifactRel('plan', 'Sigma/charter/PLAN-v1.1.md')).toBeNull();
    expect(matchArtifactRel('plan', 'Sigma/contract/sub/PLAN-v1.1.md')).toBeNull();
    expect(classifyArtifactRel('Sigma/evidence/EXEC-v1.1.md')).toBe('exec');
    expect(classifyArtifactRel('Sigma/revisions/staging/PLAN-v1.1.md')).toBeNull();
  });

  it('accepts a pending plan in either form and rejects other ids', () => {
    expect(pendingPlanRelCandidates('ab12')).toEqual(['Sigma/pending/PLAN-ab12.md', 'Sigma/pending/FMN-PLAN-ab12.md']);
    expect(pendingPlanRelCandidates('../x')).toEqual([]);
  });

  it('MCP allowed locations cover every folder and both names', () => {
    const allowed = allowedRelPaths('plan', 'v1.1');
    expect(allowed).toContain('Sigma/contract/PLAN-v1.1.md');
    expect(allowed).toContain('Sigma/contract/FMN-PLAN-v1.1.md');
    expect(allowed).toContain('Sigma/build/PLAN-v1.1.md');
    expect(allowed).toContain('Sigma/build/FMN-PLAN-v1.1.md');
  });

  it('refuses a second file for a version already present in the other form', () => {
    const env = setupTestEnv();
    envs.push(env);
    fs.outputFileSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v1.1.md'), 'old');
    expect(existingArtifactNames(env.projectDir, 'plan', 'contract', 'v1.1')).toEqual(['FMN-PLAN-v1.1.md']);
    expect(() => assertNoArtifactConflict(env.projectDir, 'plan', 'contract', 'v1.1')).toThrow(/already exists as Sigma\/contract\/FMN-PLAN-v1\.1\.md/);
    expect(() => assertNoArtifactConflict(env.projectDir, 'plan', 'contract', 'v1.2')).not.toThrow();
  });

  it('default path prefers an existing file in either form, else the new name', () => {
    const env = setupTestEnv();
    envs.push(env);
    expect(defaultArtifactRel(env.projectDir, 'exec', 'evidence', 'v1.1')).toBe('Sigma/evidence/EXEC-v1.1.md');
    fs.outputFileSync(path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v1.1.md'), 'old');
    expect(defaultArtifactRel(env.projectDir, 'exec', 'evidence', 'v1.1')).toBe('Sigma/evidence/DEV-EXEC-v1.1.md');
  });
});

// ── Chains in each naming mode ──────────────────────────────────────────────

type Mode = 'legacy' | 'current' | 'mixed';

const NAMES: Record<Mode, { intent: string; plan: string; exec: string }> = {
  legacy: { intent: 'DIR-INTENT-v1.md', plan: 'FMN-PLAN-v1.1.md', exec: 'DEV-EXEC-v1.1.md' },
  current: { intent: 'INTENT-v1.md', plan: 'PLAN-v1.1.md', exec: 'EXEC-v1.1.md' },
  // A chain created before F10 that has since received a new-style EXEC (T-16).
  mixed: { intent: 'DIR-INTENT-v1.md', plan: 'FMN-PLAN-v1.1.md', exec: 'EXEC-v1.1.md' },
};

function chainProject(mode: Mode) {
  const env = setupTestEnv();
  envs.push(env);
  stubProjectIdentity(env);
  const root = env.projectDir;
  const n = NAMES[mode];
  const intentRel = 'Sigma/charter/' + n.intent;
  const c = createInitialChain('v1', intentRel, undefined, undefined, 'intent_aligned');
  const intent = path.join(root, intentRel);
  fs.outputFileSync(intent, validIntentDocV5('v1'));
  writeChainMetadata(intent, c);
  ratifyIntent(c);
  certifyIntentDoc(c, intent);
  registerPlanDraft(c, V, 'Sigma/contract/' + n.plan, 'v1');
  const plan = path.join(root, 'Sigma/contract/' + n.plan);
  fs.outputFileSync(plan, validPlanDocV3(V));
  writeChainMetadata(plan, c);
  c.roadmap = { version: 'v1', state: 'DRAFT', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  fs.outputFileSync(path.join(root, c.roadmap.file!), ['<!-- SIGMA:DOC type=ROADMAP schema=1 -->', '# ROADMAP v1', '<!-- SIGMA:RENDER:START:stage-overview -->', '<!-- SIGMA:ROADMAP:SECTION:STAGE_OVERVIEW -->', '## 4. Stage Overview', 'Initial stages', '<!-- SIGMA:RENDER:END:stage-overview -->'].join('\n'));
  writeChainMetadata(path.join(root, c.roadmap.file!), c);
  writeChain(root, 'v1', c);
  writeActivateStatus(root, 'v1');
  return { env, root, names: n };
}

function approve(root: string, domain: 'plan' | 'exec') {
  return withGovernanceTransaction(root, 'approve', () => approveArtifactTransactionFiles(root, domain, V), () => approveArtifactUseCase(root, domain, V));
}

describe.each(['legacy', 'current', 'mixed'] as const)('F10 — approval, identity and changelog on a %s chain', (mode) => {
  it('approves PLAN and EXEC, passes the identity guard, and records the changelog', async () => {
    const { root, names } = chainProject(mode);
    await approve(root, 'plan');

    const d = readActiveChain(root).data;
    registerExecDraft(d, V, 'Sigma/evidence/' + names.exec, V);
    const execFile = path.join(root, 'Sigma/evidence/' + names.exec);
    fs.outputFileSync(execFile, validExecDocV4(V, V, 'READY_FOR_APPROVAL'));
    writeChainMetadata(execFile, d, V);
    writeChain(root, 'v1', d);
    await withGovernanceTransaction(root, 'ack', () => [chainFilePath(root, 'v1')], () => acknowledgePlan(root, V, 1));

    // The guard accepts the registered path in whichever form it was written.
    const chain = readChain(root, 'v1');
    expect(artifactFile(root, chain, 'plan', V)).toBe(path.join(root, 'Sigma/contract/' + names.plan));
    expect(artifactFile(root, chain, 'exec', V)).toBe(execFile);

    await approve(root, 'exec');
    expect(readActiveChain(root).data.exec.versions[0].state).toBe('LOCKED');

    fs.writeFileSync(path.join(root, 'CHANGE-RECORD.md'), '');
    expect(recordChangelogForLockedExec(root, V)).toMatchObject({ status: 'recorded', version: V });
  });

  it('resolves mailbox references with and without the role prefix', () => {
    const { root } = chainProject(mode);
    for (const ref of ['PLAN-v1.1', 'FMN-PLAN-v1.1', 'v1.1', 'INTENT-v1', 'DIR-INTENT-v1']) {
      expect(resolveMailboxReference(root, ref)).toMatchObject({ intent_version: 'v1' });
    }
  });
});

describe('F10 — identity guards on new names', () => {
  it('readChain still checks identity metadata inside a new-name file', () => {
    const { root, names } = chainProject('current');
    const plan = path.join(root, 'Sigma/contract/' + names.plan);
    const original = fs.readFileSync(plan, 'utf8');
    expect(original).toMatch(/SIGMA:CHAIN\s+intent=v1\b/);
    fs.writeFileSync(plan, original.replace(/(SIGMA:CHAIN\s+intent=)v1\b/, '$1v9'));
    expect(() => readChain(root, 'v1')).toThrow(/Chain identity conflict/);
  });

  it('artifactFile rejects a registered path that is the wrong version, folder or name', () => {
    const { root } = chainProject('current');
    for (const bad of ['Sigma/contract/PLAN-v1.2.md', 'Sigma/charter/PLAN-v1.1.md', 'Sigma/contract/PLAN-v1.1.md.bak', 'Sigma/revisions/staging/PLAN-v1.1.md']) {
      const chain = readChain(root, 'v1');
      chain.plan.versions[0].file = bad;
      expect(() => artifactFile(root, chain, 'plan', V), bad).toThrow(/Unregistered\/cross-identity artifact path/);
    }
  });
});

describe('F10 — creation', () => {
  it('plan new and exec new write the new names and refuse a legacy file for the same version', async () => {
    const { root } = chainProject('current');
    // Gate 2 needs a LOCKED/approved plan; approve the fixture plan first, then
    // use the draft services for the next plan.
    await approve(root, 'plan');

    // An orphan legacy EXEC file for the version the next `exec new` would use.
    const orphan = path.join(root, 'Sigma/evidence/DEV-EXEC-v1.1.md');
    fs.outputFileSync(orphan, 'orphan');
    expect(() => createExecDraft({ projectRoot: root })).toThrow(/EXEC FILE CONFLICT: Sigma\/evidence\/DEV-EXEC-v1\.1\.md already exists/);
    expect(fs.readFileSync(orphan, 'utf8')).toBe('orphan');
    expect(fs.existsSync(path.join(root, 'Sigma/evidence/EXEC-v1.1.md'))).toBe(false);

    fs.removeSync(orphan);
    const created = createExecDraft({ projectRoot: root });
    expect(created.relPath).toBe('Sigma/evidence/EXEC-v1.1.md');
    expect(fs.existsSync(path.join(root, created.relPath))).toBe(true);
  });

  it('plan new refuses a legacy plan file for the next version', async () => {
    const { root } = chainProject('current');
    await approve(root, 'plan');
    fs.outputFileSync(path.join(root, 'Sigma/contract/FMN-PLAN-v1.2.md'), 'orphan');
    expect(() => createPlanDraft({ projectRoot: root, title: 'T', focus: 'F' })).toThrow(/PLAN FILE CONFLICT: Sigma\/contract\/FMN-PLAN-v1\.2\.md already exists/);
  });

  it('a pending plan is created as PLAN-<id>.md and promotes to contract/PLAN-<ver>.md', () => {
    const { env, root } = chainProject('current');
    const made = runCli('plan new --pending --title "Later" --focus "Later focus"', root, env.homeDir);
    expect(made.exitCode, made.stdout + made.stderr).toBe(0);
    const id = made.stdout.match(/pending — ID: ([a-z0-9]+)/)![1];
    expect(made.stdout).toContain(`Sigma/pending/PLAN-${id}.md`);
    expect(fs.existsSync(path.join(root, 'Sigma/pending', `PLAN-${id}.md`))).toBe(true);

    const promoted = promotePlanUseCase(root, id, 'Later', 'Later focus');
    expect(promoted.version).toBe('v1.2');
    expect(fs.existsSync(path.join(root, 'Sigma/contract/PLAN-v1.2.md'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'Sigma/pending', `PLAN-${id}.md`))).toBe(false);
    expect(readChain(root, 'v1').plan.versions.find(v => v.version === 'v1.2')?.file).toBe('Sigma/contract/PLAN-v1.2.md');
  });
});

describe('F10 — reconstruct', () => {
  it('finds artifacts in both forms and reports one version present under two names', () => {
    const env = setupTestEnv();
    envs.push(env);
    const write = (dir: string, name: string, type: string) =>
      fs.outputFileSync(path.join(env.sigmaDir, dir, name), `<!-- SIGMA:DOC type=${type} schema=1 -->\n`);
    write('charter', 'INTENT-v2.md', 'DIR_INTENT');       // new form
    write('charter', 'DIR-INTENT-v1.md', 'DIR_INTENT');   // legacy form
    write('contract', 'PLAN-v2.1.md', 'FMN_PLAN');
    write('contract', 'FMN-PLAN-v2.1.md', 'FMN_PLAN');    // same version, both forms

    const found = discoverArtifacts(env.projectDir);
    expect(found.intent.map(a => a.version).sort()).toEqual(['v1', 'v2']);
    expect(found.plan).toEqual([]);
    expect(found.skipped.some(s => s.includes('PLAN-v2.1.md') && s.includes('FMN-PLAN-v2.1.md') && s.includes('two file names'))).toBe(true);
  });
});

describe('F10 — sigma scan', () => {
  it('skips artifacts in both forms but still scans a same-named file elsewhere', () => {
    const env = setupTestEnv();
    envs.push(env);
    stubProjectRootAnchor(env);
    const term = 'FMN-PLAN';
    fs.outputFileSync(path.join(env.projectDir, 'Sigma/contract/PLAN-v1.1.md'), `${term}\n`);
    fs.outputFileSync(path.join(env.projectDir, 'Sigma/contract/FMN-PLAN-v1.2.md'), `${term}\n`);
    fs.outputFileSync(path.join(env.projectDir, 'docs/PLAN-v1.1.md'), `Governed by ${term} and a LOCKED plan.\n`);

    const current = runCli('scan --file Sigma/contract/PLAN-v1.1.md', env.projectDir, env.homeDir);
    expect(current.stdout).toMatch(/Skipped: PLAN-v1\.1\.md is a Sigma artifact file/);

    const legacy = runCli('scan --file Sigma/contract/FMN-PLAN-v1.2.md', env.projectDir, env.homeDir);
    expect(legacy.stdout).toMatch(/Skipped: FMN-PLAN-v1\.2\.md is a Sigma artifact file/);

    const elsewhere = runCli('scan --file docs/PLAN-v1.1.md', env.projectDir, env.homeDir);
    expect(elsewhere.stdout).not.toMatch(/Skipped:/);
  });
});
