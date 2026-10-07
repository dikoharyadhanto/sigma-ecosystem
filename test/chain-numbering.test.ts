import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  createInitialChain, nextPlanVersion, registerPlanDraft, promotePendingPlan,
  readChain, writeChain, runDoctorReconciliation, validateChainSemantics,
} from '../src/engine/chain';
import {
  parseChainMetadata, withChainMetadata, resolveVersioningScheme, VersioningScheme,
} from '../src/engine/numbering';
import { reconstructAllChains } from '../src/engine/reconstruct';
import { createIntentDraft } from '../src/services/intentDraftService';
import { createPlanDraft } from '../src/services/planDraftService';
import { createExecDraft } from '../src/services/execDraftService';
import { promotePlanUseCase } from '../src/services/planPromoteService';
import { buildBootstrapView } from '../src/session/bootstrapView';
import { computeOrientation } from '../src/mcp/tools/orientation';
import { computeDoctor } from '../src/mcp/tools/doctor';
import { computeStateRevision } from '../src/mcp/contract';
import { setupTestEnv, stubProjectIdentity, writeChainFixture, chainPath, runCli, TestEnv } from './helpers';

const envs: TestEnv[] = [];
afterEach(() => { for (const env of envs.splice(0)) env.cleanup(); });
function environment(): TestEnv { const env = setupTestEnv(); envs.push(env); stubProjectIdentity(env); return env; }
function chain(version = 'v3', scheme: VersioningScheme = 'intent_aligned') {
  return createInitialChain(version, `Sigma/charter/DIR-INTENT-${version}.md`, undefined, undefined, scheme);
}
function artifact(env: TestEnv, domain: 'intent' | 'plan' | 'exec', version: string, intent?: string, scheme: VersioningScheme = 'intent_aligned', plan?: string) {
  const spec = { intent: ['charter', 'DIR-INTENT', 'DIR_INTENT'], plan: ['contract', 'FMN-PLAN', 'FMN_PLAN'], exec: ['evidence', 'DEV-EXEC', 'DEV_EXEC'] }[domain];
  const file = path.join(env.sigmaDir, spec[0], `${spec[1]}-${version}.md`);
  let text = `<!-- SIGMA:DOC type=${spec[2]} schema=1 -->\n# Artifact\n`;
  if (intent) text = withChainMetadata(text, { intent, versioning_scheme: scheme, ...(plan ? { plan } : {}) });
  fs.writeFileSync(file, text);
  return file;
}
function ready(env: TestEnv, version: string, scheme: VersioningScheme) {
  const state = chain(version, scheme);
  state.intent.state = 'RATIFIED';
  state.intent.ratified_at = state.created_at;
  state.gates.gate_1_open = true;
  state.lifecycle_state = 'BUILD';
  state.roadmap = { version, state: 'DRAFT', file: `Sigma/roadmap/ROADMAP-${version}.md`, created_at: state.created_at, updated_at: state.updated_at };
  fs.copyFileSync(path.join(__dirname, '..', 'Sigma', 'templates', 'ROADMAP-TEMPLATE.md'), path.join(env.projectDir, state.roadmap.file!));
  writeChainFixture(env, version, state);
  return state;
}

describe('per-chain numbering', () => {
  it.each([['legacy_offset', 'v2.1'], ['intent_aligned', 'v3.1']] as const)('%s allocates the correct major', (scheme, expected) => {
    expect(nextPlanVersion(chain('v3', scheme), 'v3')).toBe(expected);
  });
  it('keeps unmarked legacy DRAFT and reserves superseded/gapped minors', () => {
    const state = chain('v3', 'legacy_offset'); delete state.versioning_scheme;
    registerPlanDraft(state, 'v2.1', 'a', 'v3');
    registerPlanDraft(state, 'v2.3', 'b', 'v3'); state.plan.versions[1].state = 'SUPERSEDED';
    expect(nextPlanVersion(state, 'v3')).toBe('v2.4');
    expect(state.versioning_scheme).toBeUndefined();
  });
  it('rejects unknown schemes and cross-chain references before mutation', () => {
    const state = chain();
    expect(() => registerPlanDraft(state, 'v3.1', 'a', 'v4')).toThrow(/Version sync/);
    expect(state.plan.versions).toHaveLength(0);
    state.versioning_scheme = 'unknown' as VersioningScheme;
    expect(() => resolveVersioningScheme(state)).toThrow(/Unknown/);
  });
  it('rejects numbering errors in persisted state', () => {
    const state = chain(); registerPlanDraft(state, 'v3.1', 'a', 'v3');
    state.plan.versions[0].version = 'v2.1';
    expect(() => validateChainSemantics(state)).toThrow(/Version sync/);
  });
  it('invalid promotion does not consume the pending entry', () => {
    const state = chain(); state.plan.pending.push({ id: 'p', file: 'pending', created_at: state.created_at });
    expect(() => promotePendingPlan(state, 'p', 'v2.1', 'target', 'v3')).toThrow(/Version sync/);
    expect(state.plan.pending).toHaveLength(1);
  });
  it('doctor persists legacy fallback without changing numbering or schema policy', () => {
    const state = chain('v1', 'legacy_offset'); delete state.versioning_scheme;
    const report = runDoctorReconciliation(state);
    expect(state.versioning_scheme).toBe('legacy_offset');
    expect(report.repaired).toContain('versioning_scheme persisted as legacy_offset (unmarked legacy fallback)');
    expect(nextPlanVersion(state, 'v1')).toBe('v0.1');
    expect(runDoctorReconciliation(state).repaired).toEqual([]);
  });
});

describe('creation metadata and collision guards', () => {
  it('creates aligned INTENT after a legacy chain without touching old state', () => {
    const env = environment(); const old = chain('v1', 'legacy_offset'); delete old.versioning_scheme;
    writeChainFixture(env, 'v1', old); const before = fs.readFileSync(chainPath(env, 'v1'), 'utf8');
    const result = createIntentDraft({ projectRoot: env.projectDir, title: 'Next', focus: 'Scope' });
    expect(result.chainVersion).toBe('v2');
    expect(readChain(env.projectDir, 'v2').versioning_scheme).toBe('intent_aligned');
    expect(parseChainMetadata(fs.readFileSync(path.join(env.projectDir, result.relPath), 'utf8'))).toEqual({ intent: 'v2', versioning_scheme: 'intent_aligned' });
    expect(fs.readFileSync(chainPath(env, 'v1'), 'utf8')).toBe(before);
  });
  it.each(['legacy_offset', 'intent_aligned'] as const)('PLAN and nonsequential EXEC creation retain %s identity', scheme => {
    const env = environment(); ready(env, 'v3', scheme);
    const first = createPlanDraft({ projectRoot: env.projectDir, title: 'First', focus: 'Scope' });
    const second = createPlanDraft({ projectRoot: env.projectDir, title: 'Second', focus: 'Scope' });
    const state = readChain(env.projectDir, 'v3');
    for (const entry of state.plan.versions) { entry.state = 'LOCKED'; entry.locked_at = state.created_at; }
    state.plan.active_state = 'LOCKED'; state.gates.gate_2_open = true; writeChain(env.projectDir, 'v3', state);
    for (const planVersion of [second.version, first.version]) {
      const result = createExecDraft({ projectRoot: env.projectDir, planVersion });
      expect(result.version).toBe(planVersion);
      expect(parseChainMetadata(fs.readFileSync(path.join(env.projectDir, result.relPath), 'utf8'))).toEqual({ intent: 'v3', versioning_scheme: scheme, plan: planVersion });
    }
  });
  it('refuses an existing PLAN file and preserves state/file bytes', () => {
    const env = environment(); ready(env, 'v3', 'intent_aligned');
    const file = artifact(env, 'plan', 'v3.1'); const before = fs.readFileSync(chainPath(env, 'v3'), 'utf8');
    expect(() => createPlanDraft({ projectRoot: env.projectDir, title: 'T', focus: 'F' })).toThrow(/FILE CONFLICT/);
    expect(fs.readFileSync(chainPath(env, 'v3'), 'utf8')).toBe(before);
    expect(fs.readFileSync(file, 'utf8')).not.toContain('SIGMA:CHAIN');
  });
  it('promotes pending PLAN with assigned aligned metadata and refuses collisions before moving', () => {
    const env = environment(); const state = ready(env, 'v3', 'intent_aligned');
    fs.ensureDirSync(path.join(env.sigmaDir, 'pending'));
    const pending = 'Sigma/pending/FMN-PLAN-p.md'; fs.writeFileSync(path.join(env.projectDir, pending), '<!-- SIGMA:DOC type=FMN_PLAN schema=3 -->\n# Pending\n');
    state.plan.pending.push({ id: 'p', file: pending, created_at: state.created_at }); writeChain(env.projectDir, 'v3', state);
    const destination = artifact(env, 'plan', 'v3.1');
    expect(() => promotePlanUseCase(env.projectDir, 'p', 'T', 'F')).toThrow(/FILE CONFLICT/);
    expect(fs.existsSync(path.join(env.projectDir, pending))).toBe(true);
    fs.unlinkSync(destination);
    const result = promotePlanUseCase(env.projectDir, 'p', 'T', 'F');
    expect(result.version).toBe('v3.1');
    expect(parseChainMetadata(fs.readFileSync(path.join(env.projectDir, result.newRelPath), 'utf8'))).toEqual({ intent: 'v3', versioning_scheme: 'intent_aligned' });
  });
  it('metadata preserves CRLF and rejects malformed, duplicate, or conflicting identity', () => {
    const meta = { intent: 'v3', versioning_scheme: 'intent_aligned' as const };
    const result = withChainMetadata('<!-- SIGMA:DOC type=DIR_INTENT schema=5 -->\r\n# INTENT\r\n', meta);
    expect(result.replace(/\r\n/g, '')).not.toContain('\n');
    expect(withChainMetadata(result, meta)).toBe(result);
    expect(() => parseChainMetadata('<!-- SIGMA:CHAIN nope -->')).toThrow(/Malformed/);
    expect(() => parseChainMetadata(result + result)).toThrow(/Duplicate/);
    expect(() => withChainMetadata(result, { ...meta, intent: 'v4' })).toThrow(/conflicts/);
  });
});

describe('bootstrap and reconstruction', () => {
  it('bootstrap CLI/MCP share active-only warning and are read-only', () => {
    const env = environment(); const legacy = chain('v1', 'legacy_offset'); delete legacy.versioning_scheme;
    writeChainFixture(env, 'v1', legacy); const before = fs.readFileSync(chainPath(env, 'v1'), 'utf8');
    const view = buildBootstrapView(env.projectDir);
    const orientation = computeOrientation(env.projectDir) as { compatibility_warnings: string[]; numbering: unknown };
    expect(orientation.compatibility_warnings).toEqual(view.compatibilityWarnings);
    expect(view.numbering?.source).toBe('legacy_fallback');
    expect(view.compatibilityWarnings[0]).toContain('PLAN/EXEC v0.x');
    expect(runCli('session bootstrap', env.projectDir, env.homeDir).stdout).toContain(view.compatibilityWarnings[0]);
    computeDoctor(env.projectDir);
    expect(fs.readFileSync(chainPath(env, 'v1'), 'utf8')).toBe(before);
    writeChainFixture(env, 'v2', chain('v2'));
    expect(buildBootstrapView(env.projectDir).compatibilityWarnings).toEqual([]);
    fs.writeJsonSync(env.activateStatusPath, { active_chain: 'v1' });
    expect(buildBootstrapView(env.projectDir).compatibilityWarnings).toHaveLength(1);
  });
  it('state revision changes when the numbering field changes', () => {
    const env = environment(); writeChainFixture(env, 'v3', chain());
    const before = computeStateRevision(env.projectDir).revision;
    const state = chain('v3', 'legacy_offset'); writeChainFixture(env, 'v3', state);
    expect(computeStateRevision(env.projectDir).revision).not.toBe(before);
  });
  it('a project without chains has no numbering or compatibility warning', () => {
    const env = environment(); fs.writeJsonSync(env.activateStatusPath, { active_chain: null });
    const view = buildBootstrapView(env.projectDir);
    expect(view.numbering).toBeNull(); expect(view.compatibilityWarnings).toEqual([]);
  });
  it('normal transition recovers disjoint legacy/aligned majors and keeps lone aligned INTENT', () => {
    const env = environment();
    artifact(env, 'intent', 'v3'); artifact(env, 'plan', 'v2.1');
    artifact(env, 'intent', 'v4', 'v4'); artifact(env, 'plan', 'v4.1', 'v4'); artifact(env, 'exec', 'v4.1', 'v4', 'intent_aligned', 'v4.1');
    artifact(env, 'intent', 'v5', 'v5');
    const result = reconstructAllChains(env.projectDir);
    expect(result.conflicts).toEqual([]); expect(result.unresolved).toEqual([]);
    expect(result.chains.get(3)?.data.plan.versions[0].version).toBe('v2.1');
    expect(result.chains.get(4)?.data.plan.versions[0].version).toBe('v4.1');
    expect(result.chains.get(5)?.data.versioning_scheme).toBe('intent_aligned');
    expect(result.chains.get(5)?.data.plan.versions).toEqual([]);
  });
  it('recovers missing INTENT marker from children and a corrupt JSON state', () => {
    const env = environment(); artifact(env, 'intent', 'v3'); artifact(env, 'plan', 'v3.1', 'v3');
    fs.writeFileSync(chainPath(env, 'v3'), '{broken');
    const recovered = reconstructAllChains(env.projectDir).chains.get(3)!;
    expect(recovered.data.versioning_scheme).toBe('intent_aligned');
    expect(recovered.numberingSource).toBe('artifact');
  });
  it('does not attach unmarked artifacts with competing owners', () => {
    const env = environment(); artifact(env, 'intent', 'v2', 'v2'); artifact(env, 'intent', 'v3'); artifact(env, 'plan', 'v2.1');
    const result = reconstructAllChains(env.projectDir);
    expect(result.chains.size).toBe(0);
    expect(new Set(result.conflicts.map(c => c.major))).toEqual(new Set([2, 3]));
  });
  it('a conflicting child marker excludes both the stored owner and the claimed owner', () => {
    const env = environment();
    artifact(env, 'intent', 'v3', 'v3', 'legacy_offset'); artifact(env, 'intent', 'v4', 'v4');
    const state = chain('v4'); registerPlanDraft(state, 'v4.1', 'Sigma/contract/FMN-PLAN-v4.1.md', 'v4');
    writeChainFixture(env, 'v4', state);
    artifact(env, 'plan', 'v4.1', 'v3');
    const result = reconstructAllChains(env.projectDir);
    expect(result.chains.has(3)).toBe(false); expect(result.chains.has(4)).toBe(false);
    expect(result.conflicts.some(c => c.major === 4 && c.reason.includes('competing'))).toBe(true);
  });
  it('orphan child metadata never creates a missing INTENT', () => {
    const env = environment(); artifact(env, 'plan', 'v4.1', 'v4');
    const result = reconstructAllChains(env.projectDir);
    expect(result.chains.size).toBe(0); expect(result.unresolved[0].major).toBe(4);
  });
  it('conflicting state/markers preserves affected bytes and recovers independent chain with nonzero exit', () => {
    const env = environment(); artifact(env, 'intent', 'v3', 'v3'); writeChainFixture(env, 'v3', chain('v3', 'legacy_offset'));
    artifact(env, 'intent', 'v4', 'v4');
    const before = fs.readFileSync(chainPath(env, 'v3'), 'utf8');
    const history = path.join(env.sigmaDir, 'design', 'intent-history.md'); fs.ensureDirSync(path.dirname(history)); fs.writeFileSync(history, 'preserve history');
    expect(runCli('doctor --reconstruct --v v3', env.projectDir, env.homeDir).exitCode).toBe(1);
    const result = runCli('doctor --reconstruct --all-versions', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(1); expect(result.stdout).toContain('affected chains were NOT written');
    expect(fs.readFileSync(chainPath(env, 'v3'), 'utf8')).toBe(before);
    expect(fs.readJsonSync(chainPath(env, 'v4')).versioning_scheme).toBe('intent_aligned');
    expect(fs.readFileSync(history, 'utf8')).toBe('preserve history');
  });
  it.each(['malformed', 'duplicate', 'pairing'] as const)('refuses %s identity without guessing a chain', mode => {
    const env = environment(); const intentFile = artifact(env, 'intent', 'v3', 'v3');
    if (mode === 'malformed') fs.appendFileSync(intentFile, '<!-- SIGMA:CHAIN broken -->');
    if (mode === 'duplicate') artifact(env, 'intent', 'v3', 'v3');
    if (mode === 'duplicate') { fs.ensureDirSync(path.join(env.sigmaDir, 'design')); fs.copyFileSync(intentFile, path.join(env.sigmaDir, 'design', 'DIR-INTENT-v3.md')); }
    if (mode === 'pairing') { artifact(env, 'plan', 'v3.1', 'v3'); artifact(env, 'exec', 'v3.2', 'v3', 'intent_aligned', 'v3.2'); }
    const result = reconstructAllChains(env.projectDir);
    expect(result.chains.has(3)).toBe(false); expect(result.conflicts.length).toBeGreaterThan(0);
  });
});
