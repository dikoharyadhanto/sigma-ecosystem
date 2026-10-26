import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import { spawnSync } from 'child_process';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createInitialChain, readChain, writeChain } from '../src/engine/chain';
import { computeStateRevision } from '../src/mcp/contract';
import { setBinding, resetBindingForTest } from '../src/mcp/shared';
import { fingerprintRoot } from '../src/mcp/binding';
import { buildControlServer } from '../src/mcp/control/index';
import { buildServer } from '../src/mcp/index';
import * as controlStore from '../src/engine/controlStore';
import { writeTicket, writeApproval, generateId } from '../src/engine/controlStore';
import { localTransaction } from '../src/engine/localTransaction';
import { createPlanDraft } from '../src/services/planDraftService';
import { CloneInput, previewClone, cloneDraft, cloneTransactionFiles } from '../src/services/cloneDraftService';
import { captureArtifact, matchReferences, intentItems, reviewPlanSources } from '../src/services/sourceReviewService';
import { digest, f08StorePath, readF08Store } from '../src/services/f08Store';
import { createAuditPack, auditPackStatus, renderAuditPack, recordAuditResponse, addQuestion, resolveQuestion, listDecisions, recordReadiness } from '../src/services/auditDecisionService';
import { computeCheckDocument } from '../src/mcp/tools/checkDocument';
import { setupTestEnv, stubProjectIdentity, writeChainFixture, runCli, TestEnv } from './helpers';
const REPO = path.resolve(__dirname, '..');
const envs: TestEnv[] = [];
afterEach(() => { vi.restoreAllMocks(); envs.splice(0).forEach(e => e.cleanup()); resetBindingForTest(); delete process.env.SIGMA_CONTROL_TEST_FAILPOINT; });
function bootstrap(scheme: 'legacy_offset' | 'intent_aligned' = 'intent_aligned') {
  const env = setupTestEnv(); envs.push(env); stubProjectIdentity(env);
  const chain = createInitialChain('v1', 'Sigma/charter/DIR-INTENT-v1.md', 'Project', 'Focus', scheme);
  chain.intent.state = 'RATIFIED'; chain.intent.ratified_at = chain.created_at; chain.gates.gate_1_open = true;
  chain.roadmap = { version: 'v1', state: 'DRAFT', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: chain.created_at, updated_at: chain.created_at };
  writeChainFixture(env, 'v1', chain);
  const intent = fs.readFileSync(path.join(REPO, 'Sigma/templates/DIR-INTENT-TEMPLATE.md'), 'utf8')
    .replace('### REQ-001 - [Short name]', '### REQ-001 - Keep every source record')
    .replace('**Required Capability**: [What the product must enable, or what quality the result must have.]', '**Required Capability**: Preserve all rows.\n\n#### Details\n\nNo silent filtering.');
  fs.writeFileSync(path.join(env.sigmaDir, 'charter/DIR-INTENT-v1.md'), intent);
  fs.copySync(path.join(REPO, 'Sigma/templates/ROADMAP-TEMPLATE.md'), path.join(env.sigmaDir, 'roadmap/ROADMAP-v1.md'));
  const created = createPlanDraft({ projectRoot: env.projectDir, title: 'Stage', focus: 'Output' });
  const planPath = path.join(env.projectDir, created.relPath);
  fs.writeFileSync(planPath, fs.readFileSync(planPath, 'utf8').replace('INTENT-v{X}', 'INTENT-v1').replace('[REQ-xxx, ...]', 'REQ-001, REQ-404')
    .replace('[SC-xxx, ...]; excluded: [OS-xxx, ...]', 'SC-001; excluded: OS-001').replace('[CON-xxx, ...] / none', 'CON-001').replace('[RR-xxx, ...] / none', 'RR-001'));
  return { ...env, version: created.version, planPath };
}
async function write<T>(root: string, fn: () => T) {
  return localTransaction(root, 'f08_test', 'FMN', () => [f08StorePath(root)], fn);
}
function cloneInput(env: ReturnType<typeof bootstrap>, type: 'intent' | 'plan' = 'plan'): CloneInput {
  return { projectRoot: env.projectDir, type, sourceChain: 'v1', sourceVersion: type === 'intent' ? 'v1' : env.version, title: 'Revised', focus: 'Preserve rows' };
}
function bind(root: string, role: string, mode: 'query' | 'control' = 'control') {
  setBinding({ root, role, mode, kind: 'verified', projectId: 'TEST', rootFingerprint: fingerprintRoot(root), verified: true });
}
async function connection(root: string, role: string, control = true) {
  bind(root, role, control ? 'control' : 'query');
  const server = control ? buildControlServer() : buildServer();
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'f08-test', version: '0' });
  await Promise.all([server.connect(s), client.connect(c)]);
  return { client, close: async () => { await client.close(); await server.close(); } };
}
describe('F08a quoted source review', () => {
  it('quotes complete multiline requirements, finds table IDs, and reports missing references without claiming READY', () => {
    const env = bootstrap(), before = fs.readFileSync(path.join(env.sigmaDir, 'progress-v1.json'));
    const result = reviewPlanSources(env.projectDir);
    const refs = result.current_references!.references;
    expect(refs.find(r => r.id === 'REQ-001')!.matches[0].text).toContain('No silent filtering.');
    expect(refs.find(r => r.id === 'REQ-404')!.status).toBe('MISSING');
    expect(refs.find(r => r.id === 'SC-001')!.status).toBe('FOUND');
    expect(result.semantic_readiness.status).toBe('UNKNOWN');
    expect(result.certification.baseline.status).toBe('UNKNOWN');
    expect(fs.readFileSync(path.join(env.sigmaDir, 'progress-v1.json'))).toEqual(before);
    expect(fs.existsSync(f08StorePath(env.projectDir))).toBe(false);
  });
  it('reports duplicate definitions and ignores comment/fenced examples', () => {
    const plan = '<!-- SIGMA:FMN_PLAN:SECTION:SOURCE_ALIGNMENT -->\n| Requirements served | REQ-001 |\n';
    const source = '<!-- SIGMA:DIR_INTENT:SECTION:FUNCTIONAL_REQUIREMENTS -->\n### REQ-001 - first\nBody\n### REQ-001 - second\nOther\n<!-- ### REQ-999 - comment -->\n~~~md\n### REQ-888 - example\n~~~\n';
    expect(matchReferences(plan, source).references[0].status).toBe('AMBIGUOUS');
    expect(intentItems(source).map(r => r.id)).toEqual(['REQ-001', 'REQ-001']);
  });
  it('reads schema 4 definitions without reintroducing tier authority', () => {
    const items = intentItems(fs.readFileSync(path.join(REPO, 'test/fixtures/DIR-INTENT-TEMPLATE-schema4.md'), 'utf8'));
    expect(items.find(i => i.id === 'REQ-002')!.text).toContain('REQ-002');
    expect(items.find(i => i.id === 'SC-001')!.section).toBe('SCOPE_BOUNDARY');
  });
  it.each(['legacy_offset', 'intent_aligned'] as const)('preserves %s plan identity and matches CLI/MCP service results', scheme => {
    const env = bootstrap(scheme), result = reviewPlanSources(env.projectDir, env.version);
    const mcp = computeCheckDocument(env.projectDir, 'plan', env.version, true) as { source_review: unknown };
    expect(mcp.source_review).toEqual(result);
    expect(result.plan.version).toBe(env.version);
  });
  it('shows certified hash mismatches without replacing a missing historical source with current content', () => {
    const env = bootstrap(), chain = readChain(env.projectDir, 'v1');
    chain.intent.certified_doc_sha256 = 'a'.repeat(64);
    chain.plan.versions[0].intent_doc_sha256_ref = 'b'.repeat(64);
    chain.plan.versions[0].revision = 1;
    chain.plan.versions[0].revision_ledger = 'Sigma/revisions/PLAN-' + env.version + '/ledger.json';
    chain.plan.versions[0].revision_ledger_sha256 = 'c'.repeat(64);
    writeChain(env.projectDir, 'v1', chain);
    const result = reviewPlanSources(env.projectDir);
    expect(result.certification.current_matches_certified).toBe(false);
    expect(result.findings.join('\n')).toContain('PLAN ledger:');
    expect(JSON.stringify(result)).not.toContain(env.projectDir);
    expect(result.certification.baseline).toMatchObject({ status: 'UNKNOWN', sha256: 'sha256:' + 'b'.repeat(64), content: null });
  });
  it('rejects ambiguous PLAN selection, forged paths and cross-intent references', () => {
    const env = bootstrap();
    createPlanDraft({ projectRoot: env.projectDir, title: 'Second', focus: 'Other' });
    expect(() => reviewPlanSources(env.projectDir)).toThrow(/Multiple open/);
    const chain = readChain(env.projectDir, 'v1'); chain.plan.versions[0].file = '../.sigma-identity.json'; writeChain(env.projectDir, 'v1', chain);
    expect(() => reviewPlanSources(env.projectDir, env.version)).toThrow(/canonical/);
    chain.plan.versions[0].file = 'Sigma/contract/FMN-PLAN-' + env.version + '.md';
    chain.plan.versions[0].intent_version_ref = 'v2'; writeChain(env.projectDir, 'v1', chain);
    expect(() => reviewPlanSources(env.projectDir, env.version)).toThrow(/different INTENT/);
  });
  it('treats missing source as a finding and refuses symlink source disclosure', () => {
    const env = bootstrap(), intentPath = path.join(env.sigmaDir, 'charter/DIR-INTENT-v1.md');
    fs.removeSync(intentPath);
    expect(reviewPlanSources(env.projectDir).current_source).toBeNull();
    fs.symlinkSync(path.join(env.projectDir, '.sigma-identity.json'), intentPath);
    const result = reviewPlanSources(env.projectDir);
    expect(result.current_source).toBeNull(); expect(JSON.stringify(result)).not.toContain('"registered": true');
  });
  it('records explicit advisory readiness and invalidates it when PLAN or INTENT changes', async () => {
    const env = bootstrap(), review = reviewPlanSources(env.projectDir), before = fs.readFileSync(path.join(env.sigmaDir, 'progress-v1.json'));
    await write(env.projectDir, () => recordReadiness(env.projectDir, env.version, 'SCOPE_GAP', 'Needs a scope decision', review.plan.sha256, review.current_source!.sha256, 'FMN'));
    expect(reviewPlanSources(env.projectDir).semantic_readiness.status).toBe('SCOPE_GAP');
    fs.appendFileSync(path.join(env.sigmaDir, 'charter/DIR-INTENT-v1.md'), '\nChanged intent');
    expect(reviewPlanSources(env.projectDir).semantic_readiness).toMatchObject({ status: 'UNKNOWN', stale: true });
    expect(fs.readFileSync(path.join(env.sigmaDir, 'progress-v1.json'))).toEqual(before);
    expect(() => recordReadiness(env.projectDir, env.version, 'READY', 'No', review.plan.sha256, review.current_source!.sha256, 'DEV')).toThrow(/FMN/);
  });
});
describe('F08b safe draft cloning', () => {
  it.each(['intent', 'plan'] as const)('creates fresh %s identity and strips audit approvals while keeping contractual content', async type => {
    const env = bootstrap(), input = cloneInput(env, type), source = captureArtifact(env.projectDir, 'v1', type, input.sourceVersion);
    const p = path.join(env.projectDir, source.path);
    fs.writeFileSync(p, source.content.replace('[...]', 'Contract survives').replace('- [ ] PASS', '- [x] PASS'));
    const before = fs.readFileSync(p), preview = previewClone(input);
    expect(preview.reset_sections).toContain('DIRECTOR_SUMMARY');
    const created = await localTransaction(env.projectDir, 'clone', type === 'intent' ? 'ARC' : 'FMN', () => cloneTransactionFiles(input), () => cloneDraft(input, preview.preview_token));
    const content = fs.readFileSync(path.join(env.projectDir, created.relPath), 'utf8');
    expect(content).not.toContain('- [x] PASS');
    expect(fs.readFileSync(p)).toEqual(before);
    expect(readF08Store(env.projectDir).clones).toHaveLength(1);
    const chain = readChain(env.projectDir, type === 'intent' ? 'v2' : 'v1');
    const entry = type === 'intent' ? chain.intent : chain.plan.versions.find(p => p.version === 'v1.2')!;
    expect(entry.state).toBe('DRAFT'); expect(entry.certified_doc_sha256).toBeUndefined();
    if (type === 'intent') expect(JSON.parse(fs.readFileSync(env.activateStatusPath, 'utf8')).active_chain).toBe('v2');
  });
  it('clones an INTENT schema 5 source into the schema 6 template and still refuses schema 4', async () => {
    const env = bootstrap(), input = cloneInput(env, 'intent'), source = captureArtifact(env.projectDir, 'v1', 'intent', input.sourceVersion);
    const p = path.join(env.projectDir, source.path);
    fs.writeFileSync(p, source.content.replace('schema=6', 'schema=5').replace('[What this project creates or changes.]', 'Schema five contract survives'));
    const preview = previewClone(input);
    const created = await localTransaction(env.projectDir, 'clone', 'ARC', () => cloneTransactionFiles(input), () => cloneDraft(input, preview.preview_token));
    const content = fs.readFileSync(path.join(env.projectDir, created.relPath), 'utf8');
    expect(content).toContain('schema=6');
    expect(content).not.toContain('schema=5');
    expect(content).toContain('Schema five contract survives');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('schema=5', 'schema=4'));
    expect(() => previewClone(input)).toThrow(/Unsupported clone schema/);
  });
  it.each(['3', '4'])('clones PLAN schema %s into schema 4 and resets the review schedule', schema => {
    const env = bootstrap(), input = cloneInput(env, 'plan');
    let source = fs.readFileSync(env.planPath, 'utf8');
    if (schema === '3') {
      source = source.replace('type=FMN_PLAN schema=4', 'type=FMN_PLAN schema=3').replace(
        /<!-- SIGMA:FMN_PLAN:SECTION:CHECKPOINT_FOR_POST_BUILD_REVIEW -->[\s\S]*?(?=<!-- SIGMA:FMN_PLAN:SECTION:ACCEPTANCE_AND_TEST_CONTRACT -->)/, '',
      );
    } else {
      source = source.replace('**Total checkpoints:** 1', '**Total checkpoints:** 2\n\n- Checkpoint 1: After: TASK-001 is complete and verified; Focus: interfaces.\n- Checkpoint 2 (Final): After: all implementation and verification are complete; Focus: overall post-build review.');
    }
    fs.writeFileSync(env.planPath, source);
    const preview = previewClone(input);
    expect(preview.content).toContain('type=FMN_PLAN schema=4');
    expect(preview.content).toContain('**Total checkpoints:** 1');
    expect(preview.content).not.toContain('**Total checkpoints:** 2');
    expect(preview.reset_sections).toContain('CHECKPOINT_FOR_POST_BUILD_REVIEW');
    expect(fs.readFileSync(env.planPath, 'utf8')).toBe(source);
  });
  it('rejects stale preview, unsupported schemas and arbitrary chain selectors before creating a draft', async () => {
    const env = bootstrap(), input = cloneInput(env), preview = previewClone(input);
    fs.appendFileSync(env.planPath, '\nSource edited');
    await expect(localTransaction(env.projectDir, 'clone', 'FMN', () => cloneTransactionFiles(input), () => cloneDraft(input, preview.preview_token))).rejects.toThrow(/STALE_ARTIFACT/);
    expect(readChain(env.projectDir, 'v1').plan.versions).toHaveLength(1);
    fs.writeFileSync(env.planPath, fs.readFileSync(env.planPath, 'utf8').replace(/type=FMN_PLAN schema=\d+/, 'type=FMN_PLAN schema=2'));
    expect(() => previewClone(input)).toThrow(/Unsupported clone schema/);
    expect(() => previewClone({ ...input, sourceChain: '../v1' })).toThrow(/Invalid chain/);
  });
  it('rolls back target, chain and provenance on a failure after draft content', async () => {
    const env = bootstrap(), input = cloneInput(env), preview = previewClone(input);
    const before = fs.readFileSync(path.join(env.sigmaDir, 'progress-v1.json'));
    const spy = vi.spyOn(controlStore, 'controlTestFailpoint').mockImplementation(name => { if (name === 'f08_clone_after_content') throw new Error('injected clone failure'); });
    await expect(localTransaction(env.projectDir, 'clone', 'FMN', () => cloneTransactionFiles(input), () => cloneDraft(input, preview.preview_token))).rejects.toThrow();
    spy.mockRestore();
    expect(fs.readFileSync(path.join(env.sigmaDir, 'progress-v1.json'))).toEqual(before);
    expect(fs.existsSync(path.join(env.projectDir, preview.target_path))).toBe(false);
    expect(readF08Store(env.projectDir).clones).toEqual([]);
  });
  it('requires explicit CLOSED reopen and leaves the source chain unchanged', async () => {
    const env = bootstrap(), chain = readChain(env.projectDir, 'v1'); chain.lifecycle_state = 'CLOSED'; writeChain(env.projectDir, 'v1', chain);
    const input = cloneInput(env, 'intent'), preview = previewClone(input);
    await expect(localTransaction(env.projectDir, 'clone', 'ARC', () => cloneTransactionFiles(input), () => cloneDraft(input, preview.preview_token))).rejects.toThrow(/CLOSED/);
    const confirmed = { ...input, allowReopenClosed: true }, p = previewClone(confirmed), before = fs.readFileSync(path.join(env.sigmaDir, 'progress-v1.json'));
    await localTransaction(env.projectDir, 'clone', 'ARC', () => cloneTransactionFiles(confirmed), () => cloneDraft(confirmed, p.preview_token));
    expect(fs.readFileSync(path.join(env.sigmaDir, 'progress-v1.json'))).toEqual(before);
  });
});
describe('F08c audit packs and substantive decisions', () => {
  it('preserves original AUD response bytes and detects source edits and snapshot tampering', async () => {
    const env = bootstrap(), target = captureArtifact(env.projectDir, 'v1', 'plan', env.version);
    const before = fs.readFileSync(path.join(env.sigmaDir, 'progress-v1.json'));
    const pack = await write(env.projectDir, () => createAuditPack(env.projectDir, 'plan', env.version, target.sha256));
    const raw = 'PASS_WITH_RISK\r\nOriginal response, unchanged.\n';
    await write(env.projectDir, () => recordAuditResponse(env.projectDir, pack.id, raw, 'AUD external session', pack.manifest_sha256, 'AUD'));
    expect(auditPackStatus(env.projectDir, pack.id).responses[0].raw).toBe(raw);
    expect(renderAuditPack(env.projectDir, pack.id)).toContain('Keep every source record');
    expect(fs.readFileSync(path.join(env.sigmaDir, 'progress-v1.json'))).toEqual(before);
    fs.appendFileSync(env.planPath, '\nChanged');
    expect(auditPackStatus(env.projectDir, pack.id).stale).toBe(true);
    await expect(write(env.projectDir, () => recordAuditResponse(env.projectDir, pack.id, raw, 'AUD', pack.manifest_sha256, 'AUD'))).rejects.toThrow(/stale/);
    const data = readF08Store(env.projectDir); data.packs[0].files[0].content += 'forged';
    fs.writeJsonSync(f08StorePath(env.projectDir), data);
    expect(() => auditPackStatus(env.projectDir, pack.id)).toThrow(/integrity/);
  });
  it('answers only an unchanged question with Director confirmation, without changing gates', async () => {
    const env = bootstrap(), target = captureArtifact(env.projectDir, 'v1', 'plan', env.version);
    const before = fs.readFileSync(path.join(env.sigmaDir, 'progress-v1.json'));
    const q = await write(env.projectDir, () => addQuestion(env.projectDir, 'plan', env.version, 'Include all rows?', target.sha256, 'FMN'));
    expect(listDecisions(env.projectDir).substantive[0].status).toBe('OPEN');
    await expect(write(env.projectDir, () => resolveQuestion(env.projectDir, q.id, 'Yes', target.sha256, false))).rejects.toThrow(/confirmation/);
    await write(env.projectDir, () => resolveQuestion(env.projectDir, q.id, 'Yes', target.sha256, true));
    expect(listDecisions(env.projectDir).substantive).toEqual([]);
    fs.appendFileSync(env.planPath, '\nScope changed');
    expect(listDecisions(env.projectDir).substantive[0]).toMatchObject({ status: 'NEEDS_REVIEW', stale: true });
    expect(fs.readFileSync(path.join(env.sigmaDir, 'progress-v1.json'))).toEqual(before);
  });
  it('isolates questions by intent and retains explicit history access', async () => {
    const env = bootstrap(), target = captureArtifact(env.projectDir, 'v1', 'plan', env.version);
    await write(env.projectDir, () => addQuestion(env.projectDir, 'plan', env.version, 'Question?', target.sha256, 'FMN'));
    const input = cloneInput(env, 'intent'), preview = previewClone(input);
    await localTransaction(env.projectDir, 'clone', 'ARC', () => cloneTransactionFiles(input), () => cloneDraft(input, preview.preview_token));
    expect(listDecisions(env.projectDir).substantive).toEqual([]);
    expect(listDecisions(env.projectDir, 'v1').substantive).toHaveLength(1);
  });
  it('excludes expired, consumed and rejected tickets from pending approvals', () => {
    const env = bootstrap(), target = captureArtifact(env.projectDir, 'v1', 'plan', env.version), revision = computeStateRevision(env.projectDir).revision!;
    for (const status of ['pending', 'expired', 'consumed', 'rejected']) {
      const ticketId = generateId('op'), issued = new Date().toISOString();
      const ticket = { operation_ticket_id: ticketId, operation_id: 'plan_approve', project_id: 'TEST', bound_role: 'FMN',
        arguments_hash: digest(status), target: { artifact: 'plan', version: env.version, sha256: target.sha256 },
        expected_state_revision: revision, effects: [], authority: 'director' as const, issued_at: issued,
        expires_at: new Date(Date.now() + (status === 'expired' ? -1000 : 60000)).toISOString(), consumed_at: status === 'consumed' ? issued : null };
      writeTicket(env.projectDir, ticket);
      if (status === 'rejected') writeApproval(env.projectDir, { approval_id: generateId('appr'), project_id: 'TEST',
        operation_ticket_id: ticketId, operation_id: ticket.operation_id, arguments_hash: ticket.arguments_hash,
        target_artifact: 'plan', target_version: env.version, target_sha256: target.sha256, expected_state_revision: revision,
        decision: 'reject', reason: 'No', director_identity: 'test', authentication_method: 'local_cli', channel: 'cli',
        issued_at: issued, expires_at: ticket.expires_at, consumed_at: null });
    }
    expect(listDecisions(env.projectDir).transactions.map(t => t.status)).toEqual(['PENDING_DIRECTOR']);
    expect(listDecisions(env.projectDir, undefined, true).transactions).toHaveLength(4);
  });
  it('refuses to overwrite a corrupt internal record store', async () => {
    const env = bootstrap(); fs.ensureDirSync(path.dirname(f08StorePath(env.projectDir))); fs.writeFileSync(f08StorePath(env.projectDir), '{broken');
    const before = fs.readFileSync(f08StorePath(env.projectDir));
    await expect(write(env.projectDir, () => addQuestion(env.projectDir, 'plan', env.version, 'Q', digest('x'), 'FMN'))).rejects.toThrow();
    expect(fs.readFileSync(f08StorePath(env.projectDir))).toEqual(before);
  });
});
describe('F08 MCP and CLI boundaries', () => {
  it('MCP clone is role-bound, idempotent and refuses query writes', async () => {
    const env = bootstrap(), input = cloneInput(env), preview = previewClone(input), rev = computeStateRevision(env.projectDir).revision!;
    const args = { type: 'plan', source_chain: 'v1', source_version: env.version, title: input.title, focus: input.focus,
      preview_token: preview.preview_token, expected_state_revision: rev, idempotency_key: 'clone-1' };
    const wrong = await connection(env.projectDir, 'DEV');
    try { expect((await wrong.client.callTool({ name: 'sigma_clone_draft', arguments: args })).isError).toBe(true); }
    finally { await wrong.close(); }
    const good = await connection(env.projectDir, 'FMN');
    try {
      const first = await good.client.callTool({ name: 'sigma_clone_draft', arguments: args });
      expect(first.isError).not.toBe(true);
      const replay = await good.client.callTool({ name: 'sigma_clone_draft', arguments: args });
      expect(replay.isError).not.toBe(true);
      expect(readChain(env.projectDir, 'v1').plan.versions).toHaveLength(2);
      const conflict = await good.client.callTool({ name: 'sigma_clone_draft', arguments: { ...args, title: 'Changed title' } });
      expect(conflict.isError).toBe(true);
    } finally { await good.close(); }
    const query = await connection(env.projectDir, 'FMN', false);
    try {
      const { tools } = await query.client.listTools();
      expect(tools.some(t => t.name === 'sigma_preview_clone')).toBe(true);
      expect(tools.every(t => t.annotations?.readOnlyHint === true)).toBe(true);
      expect(tools.some(t => t.name === 'sigma_clone_draft')).toBe(false);
      expect(tools.some(t => t.name === 'sigma_resolve_decision')).toBe(false);
    } finally { await query.close(); }
  });
  it('CLI source review and clone preview do not write operation logs', () => {
    const env = bootstrap();
    const review = runCli('plan check --sources --v ' + env.version, env.projectDir, env.homeDir);
    expect(review.exitCode).toBe(0); expect(JSON.parse(review.stdout).semantic_readiness.status).toBe('UNKNOWN');
    const preview = runCli('plan clone --from-chain v1 --from ' + env.version + ' --title New --focus Revision', env.projectDir, env.homeDir);
    expect(preview.exitCode).toBe(0); expect(JSON.parse(preview.stdout).preview_token).toMatch(/^sha256:/);
    expect(fs.existsSync(path.join(env.sigmaDir, 'logs/operations.jsonl'))).toBe(false);
  });
});

describe('F08 dependency and crash recovery contracts', () => {
  it('recovers the exact historical INTENT text from a verified Git blob', () => {
    const env = bootstrap(), root = env.projectDir, intentPath = path.join(env.sigmaDir, 'charter/DIR-INTENT-v1.md');
    const old = fs.readFileSync(intentPath), oldHash = digest(old);
    const git = (args: string[]) => {
      const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } });
      if (result.status !== 0) throw new Error(result.stderr);
      return result.stdout.trim();
    };
    git(['init', '-q']); git(['config', 'user.name', 'F08 test']); git(['config', 'user.email', 'f08@example.invalid']);
    git(['add', '.']); git(['commit', '-qm', 'Source baseline']);
    const commit = git(['rev-parse', 'HEAD']);
    const chain = readChain(root, 'v1');
    chain.plan.versions[0].intent_doc_sha256_ref = oldHash.replace('sha256:', '');
    chain.intent.git_baseline = { commit, tag: 'test-baseline', doc_sha256: oldHash.replace('sha256:', ''), doc_sha256_lf: oldHash.replace('sha256:', ''), revision: 1, provenance: 'ratified_commit', recorded_at: new Date().toISOString() };
    fs.writeFileSync(intentPath, old.toString('utf8').replace('No silent filtering.', 'Filtering is now requested.'));
    chain.intent.certified_doc_sha256 = digest(fs.readFileSync(intentPath)).replace('sha256:', '');
    writeChain(root, 'v1', chain);
    const result = reviewPlanSources(root);
    expect(result.certification.baseline).toMatchObject({ status: 'AVAILABLE', origin: 'git:' + commit, sha256: oldHash });
    expect(result.referenced_references!.references[0].matches[0].text).toContain('No silent filtering.');
    expect(result.current_references!.references[0].matches[0].text).toContain('Filtering is now requested.');
  });
  it('includes only hash-matching selected evidence and marks later evidence edits stale', async () => {
    const env = bootstrap(), chain = readChain(env.projectDir, 'v1'), created = chain.created_at;
    const evidencePath = path.join(env.projectDir, 'result.txt'); fs.writeFileSync(evidencePath, 'Measured 42 rows.\n');
    chain.exec.versions.push({ version: env.version, state: 'DRAFT', plan_version_ref: env.version,
      file: 'Sigma/evidence/DEV-EXEC-' + env.version + '.md', created_at: created, updated_at: created,
      evidence: [{ description: 'Count report', ref_path: 'result.txt', ref_sha256: digest(fs.readFileSync(evidencePath)), recorded_by: 'DEV', recorded_at: created }] });
    chain.exec.active_version = env.version; chain.exec.active_state = 'DRAFT'; writeChain(env.projectDir, 'v1', chain);
    fs.copySync(path.join(REPO, 'Sigma/templates/DEV-EXEC-TEMPLATE.md'), path.join(env.sigmaDir, 'evidence/DEV-EXEC-' + env.version + '.md'));
    const target = captureArtifact(env.projectDir, 'v1', 'exec', env.version);
    const pack = await write(env.projectDir, () => createAuditPack(env.projectDir, 'exec', env.version, target.sha256, true));
    expect(auditPackStatus(env.projectDir, pack.id).pack.evidence_snapshots[0].content).toBe('Measured 42 rows.\n');
    fs.writeFileSync(evidencePath, 'Replaced report');
    expect(auditPackStatus(env.projectDir, pack.id).changes).toContain('result.txt');
    const next = await write(env.projectDir, () => createAuditPack(env.projectDir, 'exec', env.version, target.sha256, true));
    expect(auditPackStatus(env.projectDir, next.id).pack.evidence_snapshots).toEqual([]);
    expect(next.missing.join('\n')).toContain('hash differs');
  });
  it('recovers a real interrupted CLI clone without leaving duplicate drafts', () => {
    const env = bootstrap(), base = 'plan clone --from-chain v1 --from ' + env.version + ' --title New --focus Revision';
    const preview = JSON.parse(runCli(base, env.projectDir, env.homeDir).stdout);
    const args = base + ' --confirm --preview-token ' + preview.preview_token;
    process.env.SIGMA_CONTROL_TEST_FAILPOINT = 'f08_clone_after_content';
    const interrupted = runCli(args, env.projectDir, env.homeDir);
    delete process.env.SIGMA_CONTROL_TEST_FAILPOINT;
    expect(interrupted.exitCode).not.toBe(0);
    const recovered = runCli(args, env.projectDir, env.homeDir);
    expect(recovered.exitCode).toBe(0);
    expect(readChain(env.projectDir, 'v1').plan.versions).toHaveLength(2);
    expect(readF08Store(env.projectDir).clones).toHaveLength(1);
  });
  it('makes uncommitted source edits invalidate control tickets even when tracker state is unchanged', () => {
    const env = bootstrap(), target = captureArtifact(env.projectDir, 'v1', 'plan', env.version), issued = new Date().toISOString();
    writeTicket(env.projectDir, { operation_ticket_id: generateId('op'), operation_id: 'plan_approve', project_id: 'TEST', bound_role: 'FMN',
      arguments_hash: digest('test'), target: { artifact: 'plan', version: env.version, sha256: target.sha256 },
      expected_state_revision: computeStateRevision(env.projectDir).revision!, effects: [], authority: 'director',
      issued_at: issued, expires_at: new Date(Date.now() + 60000).toISOString(), consumed_at: null });
    fs.appendFileSync(env.planPath, '\nChanged contract');
    expect(listDecisions(env.projectDir).transactions).toEqual([]);
    expect(listDecisions(env.projectDir, undefined, true).transactions[0].status).toBe('STALE');
  });
  it('MCP audit and question writes enforce role/hash, and never expose a Director resolution tool', async () => {
    const env = bootstrap(), target = captureArtifact(env.projectDir, 'v1', 'plan', env.version), rev = computeStateRevision(env.projectDir).revision!;
    const owner = await connection(env.projectDir, 'FMN');
    let pack: { id: string; manifest_sha256: string };
    try {
      const create = await owner.client.callTool({ name: 'sigma_create_audit_pack', arguments: {
        type: 'plan', version: env.version, expected_artifact_sha256: target.sha256, idempotency_key: 'pack', expected_state_revision: rev } });
      expect(create.isError).not.toBe(true);
      pack = create.structuredContent as unknown as typeof pack;
      const denied = await owner.client.callTool({ name: 'sigma_record_audit_response', arguments: {
        pack_id: pack.id, pack_sha256: pack.manifest_sha256, raw: 'PASS', origin: 'AUD', idempotency_key: 'aud', expected_state_revision: rev } });
      expect(denied.isError).toBe(true);
      const questionArgs = { type: 'plan', version: env.version, expected_artifact_sha256: target.sha256,
        question: 'Clarify output', idempotency_key: 'q', expected_state_revision: rev };
      expect((await owner.client.callTool({ name: 'sigma_add_decision', arguments: questionArgs })).isError).not.toBe(true);
      expect((await owner.client.callTool({ name: 'sigma_add_decision', arguments: questionArgs })).isError).not.toBe(true);
      expect(readF08Store(env.projectDir).questions).toHaveLength(1);
      const { tools } = await owner.client.listTools();
      expect(tools.some(t => /resolve.*decision|decision.*resolve/.test(t.name))).toBe(false);
    } finally { await owner.close(); }
    const auditor = await connection(env.projectDir, 'AUD');
    try {
      const response = await auditor.client.callTool({ name: 'sigma_record_audit_response', arguments: {
        pack_id: pack!.id, pack_sha256: pack!.manifest_sha256, raw: 'PASS_WITH_RISK\nOriginal', origin: 'AUD session',
        idempotency_key: 'aud-response', expected_state_revision: rev } });
      expect(response.isError).not.toBe(true);
      expect(auditPackStatus(env.projectDir, pack!.id).responses[0].raw).toBe('PASS_WITH_RISK\nOriginal');
    } finally { await auditor.close(); }
  });
});

describe('F08 editor conflict protection', () => {
  it('preserves an editor change and reports a recovery conflict instead of overwriting it', async () => {
    const env = bootstrap(), input = cloneInput(env), preview = previewClone(input);
    const spy = vi.spyOn(controlStore, 'controlTestFailpoint').mockImplementation(name => {
      if (name === 'f08_clone_after_content') {
        fs.writeFileSync(path.join(env.projectDir, preview.target_path), 'Independent editor change');
        throw new Error('injected interruption');
      }
    });
    await expect(localTransaction(env.projectDir, 'clone', 'FMN', () => cloneTransactionFiles(input),
      () => cloneDraft(input, preview.preview_token))).rejects.toThrow(/recovery conflict/);
    spy.mockRestore();
    expect(fs.readFileSync(path.join(env.projectDir, preview.target_path), 'utf8')).toBe('Independent editor change');
  });
});
