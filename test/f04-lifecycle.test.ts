import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { setupTestEnv, stubProjectIdentity, validIntentDocV5, validPlanDocV3, validExecDocV3, runCli, TestEnv } from './helpers';
import { createInitialChain, ratifyIntent, certifyIntentDoc, registerPlanDraft, registerExecDraft, writeChain, writeActivateStatus, readActiveChain, hasCleanGate3Chain, supersedePlanVersion, resolveTargetVersion, chainFilePath } from '../src/engine/chain';
import { writeChainMetadata } from '../src/engine/numbering';
import { resolveLifecycleModel } from '../src/engine/lifecycle';
import { withGovernanceTransaction } from '../src/engine/governanceTransaction';
import { approvalReview, approveArtifactUseCase, approveArtifactTransactionFiles } from '../src/services/approvalService';
import { revisionPaths, boundedPath, planContractHash, assertPlanCertified, preparePlanRevision, checkPlanRevision, commitPlanRevision, revisionTransactionFiles, acknowledgePlan, readRevisionLedger, prepareRevisionTicket } from '../src/engine/revisions';
import { lifecycleMigrationPreview, migrateLifecycle } from '../src/engine/lifecycleMigration';
import { reconstructAllChains } from '../src/engine/reconstruct';
import { computePlanStatus } from '../src/mcp/tools/planStatus';
import { computeDoctor } from '../src/mcp/tools/doctor';
import { readTicket, writeApproval, generateId, approvalPath, ticketPath } from '../src/engine/controlStore';
const envs: TestEnv[] = [];
afterEach(() => { for (const e of envs.splice(0))
    e.cleanup(); });
function fixture(scheme: 'legacy_offset' | 'intent_aligned' = 'intent_aligned', model: 'paired_approval' | 'legacy_lock' = 'paired_approval') {
    const env = setupTestEnv();
    envs.push(env);
    stubProjectIdentity(env);
    const root = env.projectDir;
    const version = scheme === 'legacy_offset' ? 'v0.1' : 'v1.1';
    const intentFile = path.join(root, 'Sigma/charter/DIR-INTENT-v1.md');
    fs.writeFileSync(intentFile, validIntentDocV5('v1'));
    const chain = createInitialChain('v1', 'Sigma/charter/DIR-INTENT-v1.md', undefined, undefined, scheme, model);
    writeChainMetadata(intentFile, chain);
    ratifyIntent(chain);
    certifyIntentDoc(chain, intentFile);
    registerPlanDraft(chain, version, 'Sigma/contract/FMN-PLAN-' + version + '.md', 'v1');
    fs.writeFileSync(path.join(root, 'Sigma/contract/FMN-PLAN-' + version + '.md'), validPlanDocV3(version));
    writeChainMetadata(path.join(root, 'Sigma/contract/FMN-PLAN-' + version + '.md'), chain);
    chain.roadmap={version:'v1',state:'DRAFT',file:'Sigma/roadmap/ROADMAP-v1.md',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    fs.outputFileSync(path.join(root,chain.roadmap.file!),['<!-- SIGMA:DOC type=ROADMAP schema=1 -->','# ROADMAP v1','<!-- SIGMA:RENDER:START:stage-overview -->','<!-- SIGMA:ROADMAP:SECTION:STAGE_OVERVIEW -->','## 4. Stage Overview','Initial stages','<!-- SIGMA:RENDER:END:stage-overview -->'].join(String.fromCharCode(10)));
    writeChainMetadata(path.join(root,chain.roadmap.file!),chain);
    writeChain(root, 'v1', chain);
    writeActivateStatus(root, 'v1');
    return { env, root, version };
}
async function approve(root: string, domain: 'plan' | 'exec', v: string) { return withGovernanceTransaction(root, domain + '_approve', () => approveArtifactTransactionFiles(root, domain, v), () => approveArtifactUseCase(root, domain, v)); }
function exec(root: string, v: string) { const { data: chain } = readActiveChain(root); registerExecDraft(chain, v, 'Sigma/evidence/DEV-EXEC-' + v + '.md', v); fs.writeFileSync(path.join(root, 'Sigma/evidence/DEV-EXEC-' + v + '.md'), validExecDocV3(v, v, 'READY_FOR_APPROVAL')); writeChainMetadata(path.join(root, 'Sigma/evidence/DEV-EXEC-' + v + '.md'), chain, v); writeChain(root, 'v1', chain); }
async function ack(root: string, v: string, rev: number) { return withGovernanceTransaction(root, 'ack', () => [chainFilePath(root, 'v1')], () => acknowledgePlan(root, v, rev)); }
async function stage(root: string, v: string, loosening = false, checkpoint: 'pre-build' | 'post-build' | 'director' = 'pre-build') {
    const p = revisionPaths(v);
    await withGovernanceTransaction(root, 'revision_prepare', () => [boundedPath(root, p.candidate), boundedPath(root, p.staging)], () => preparePlanRevision(root, v, { checkpoint, loosening, reason: 'AC correction', requested_by: 'FMN', delta: 'Change AC-001' }));
    const candidate = boundedPath(root, p.candidate);
    let text = fs.readFileSync(candidate, 'utf8').replace('Test criteria.', 'Revised criteria.');
    text = text.replace('<!-- SIGMA:FMN_PLAN:SECTION:AUD_NOTES -->', '<!-- SIGMA:FMN_PLAN:SECTION:CONTRACT_CHANGES -->\n## Contract Changes\n\n| No | Checkpoint | What Changed | Reason | Requested By | Loosening? | Director Approval |\n|:--|:--|:--|:--|:--|:--|:--|\n| 1 | ' + checkpoint + ' | Change AC-001 | AC correction | FMN | ' + (loosening ? 'Yes' : 'No') + ' | Review package |\n\n<!-- SIGMA:FMN_PLAN:SECTION:AUD_NOTES -->');
    fs.writeFileSync(candidate, text);
    return p;
}
async function commitRevision(root: string, v: string, ticket?: string, approval?: string) { return withGovernanceTransaction(root, 'revision_commit', () => [...revisionTransactionFiles(root, v), ...(ticket ? [ticketPath(root, ticket)] : []), ...(approval ? [approvalPath(root, approval)] : [])], () => commitPlanRevision(root, v, ticket, approval)); }
function send(env: TestEnv, v: string, extra = '') { return runCli('send --from fmn --to dev --type CONTRACT_CHANGE --related-artifact PLAN-' + v + ' --revision-id ' + v + ':rev-2 --message "Review AC correction" ' + extra, env.projectDir, env.homeDir); }
describe('F04 lifecycle and revision contract', () => {
    it.each(['legacy_offset', 'intent_aligned'] as const)('U-01/U-02: paired approval keeps %s numbering and locks both only at EXEC approval', async (scheme) => {
        const { root, version } = fixture(scheme);
        await approve(root, 'plan', version);
        expect(readActiveChain(root).data.plan.versions[0].state).toBe('APPROVED');
        exec(root, version);
        expect(approvalReview(root, 'exec', version).blockers.join(' ')).toContain('acknowledge');
        await ack(root, version, 1);
        await approve(root, 'exec', version);
        const c = readActiveChain(root).data;
        expect(c.plan.versions[0].state).toBe('LOCKED');
        expect(c.exec.versions[0].state).toBe('LOCKED');
        expect(c.plan.versions[0].locked_at).toBe(c.exec.versions[0].locked_at);
        expect(c.gates.gate_3_satisfied).toBe(true);
    });
    it.each(['legacy_offset', 'intent_aligned'] as const)('U-01: legacy approve retains separate locks with %s numbering', async (scheme) => {
        const { root, version } = fixture(scheme, 'legacy_lock');
        await approve(root, 'plan', version);
        expect(readActiveChain(root).data.plan.versions[0].state).toBe('LOCKED');
        exec(root, version);
        await approve(root, 'exec', version);
        expect(readActiveChain(root).data.exec.versions[0].state).toBe('LOCKED');
    });
    it('U-01: unmarked tracker is legacy; unsupported model rejects', () => { const { root } = fixture(); const c = readActiveChain(root).data; delete c.lifecycle_model; expect(resolveLifecycleModel(c)).toBe('legacy_lock'); (c as any).lifecycle_model = 'bogus'; expect(() => resolveLifecycleModel(c)).toThrow('Unsupported'); });
    it('U-03/U-04: other open work blocks Gate 3 even when display pointer changes', async () => {
        const { root, version } = fixture();
        await approve(root, 'plan', version);
        exec(root, version);
        await ack(root, version, 1);
        const c = readActiveChain(root).data;
        registerPlanDraft(c, 'v1.2', 'Sigma/contract/FMN-PLAN-v1.2.md', 'v1');
        fs.writeFileSync(path.join(root, 'Sigma/contract/FMN-PLAN-v1.2.md'), validPlanDocV3('v1.2'));
        writeChain(root, 'v1', c);
        await approve(root, 'exec', version);
        expect(hasCleanGate3Chain(readActiveChain(root).data)).toBe(false);
        const d = readActiveChain(root).data;
        supersedePlanVersion(d, 'v1.2', 'abandoned');
        expect(hasCleanGate3Chain(d)).toBe(true);
    });
    it('U-03: multiple initial approval candidates require explicit target', () => { const { root } = fixture(); const c = readActiveChain(root).data; registerPlanDraft(c, 'v1.2', 'Sigma/contract/FMN-PLAN-v1.2.md', 'v1'); expect(resolveTargetVersion(c.plan.versions, undefined).kind).toBe('ambiguous'); });
    it.each(['DRAFT', 'APPROVED'])('U-04: %s PLAN prevents completion', async (state) => { const { root, version } = fixture(); await approve(root, 'plan', version); exec(root, version); await ack(root, version, 1); await approve(root, 'exec', version); const c = readActiveChain(root).data; c.plan.versions.push({ ...c.plan.versions[0], version: 'v1.2', state }); expect(hasCleanGate3Chain(c)).toBe(false); });
    it('U-04: missing/cross-number pair fails Gate 3', async () => { const { root, version } = fixture(); await approve(root, 'plan', version); exec(root, version); await ack(root, version, 1); await approve(root, 'exec', version); const c = readActiveChain(root).data; c.exec.versions[0].version = 'v1.2'; expect(hasCleanGate3Chain(c)).toBe(false); });
    it('U-05: CLI lock tombstone never mutates', () => { const { root, env, version } = fixture(); const before = fs.readFileSync(chainFilePath(root, 'v1'), 'utf8'); const result = runCli('plan lock --v ' + version, root, env.homeDir); expect(result.exitCode).toBe(1); expect(result.stderr).toContain('TOMBSTONE'); expect(fs.readFileSync(chainFilePath(root, 'v1'), 'utf8')).toBe(before); });
    it('U-06: normalized hash excludes append-only AUD Notes but includes contract', async () => { const { root, version } = fixture(); await approve(root, 'plan', version); const file = path.join(root, 'Sigma/contract/FMN-PLAN-' + version + '.md'); const text = fs.readFileSync(file, 'utf8'); expect(planContractHash(text.replace(/\n/g, '\r\n'))).toBe(planContractHash(text)); fs.appendFileSync(file, '\nAudit 2: advisory finding.\n'); expect(() => assertPlanCertified(root, readActiveChain(root).data, version)).not.toThrow(); fs.writeFileSync(file, text.replace('Test criteria.', 'Easier criteria.')); expect(() => assertPlanCertified(root, readActiveChain(root).data, version)).toThrow('UNCERTIFIED_EDIT'); });
    it.each(['missing', 'duplicate', 'malformed', 'edit', 'delete'])('U-06: AUD marker/change %s rejected', async (kind) => { const { root, version } = fixture(); await approve(root, 'plan', version); const file = path.join(root, 'Sigma/contract/FMN-PLAN-' + version + '.md'); let text = fs.readFileSync(file, 'utf8'); if (kind === 'missing')
        text = text.replace('<!-- SIGMA:FMN_PLAN:SECTION:AUD_NOTES -->', ''); if (kind === 'duplicate')
        text += '\n<!-- SIGMA:FMN_PLAN:SECTION:AUD_NOTES -->'; if (kind === 'malformed')
        text = text.replace('## AUD Notes', '## Misc'); if (kind === 'edit')
        text = text.replace('- [x] PASS', '- [x] REVISE'); if (kind === 'delete')
        text = text.trimEnd(); fs.writeFileSync(file, text); expect(() => assertPlanCertified(root, readActiveChain(root).data, version)).toThrow(); });
    it('U-07/U-08/U-11: ordinary staged revision needs notice and explicit newest ack', async () => {
        const { root, env, version } = fixture();
        await approve(root, 'plan', version);
        exec(root, version);
        await ack(root, version, 1);
        await stage(root, version);
        const check = checkPlanRevision(root, version);
        expect(check.diff.ac_test_ids).toContain('AC-001');
        await commitRevision(root, version);
        expect(readActiveChain(root).data.plan.versions[0].pending_notice).toBe(true);
        expect(send(env, version).exitCode).toBe(0);
        expect(readActiveChain(root).data.exec.versions[0].plan_revision_ref).toBe(1);
        expect(approvalReview(root, 'exec', version).blockers.join(' ')).toContain('acknowledge');
        await ack(root, version, 2);
        await approve(root, 'exec', version);
        expect(readRevisionLedger(root, readActiveChain(root).data, version).records[1].approved_with_exec_at).toBeTruthy();
    });
    it.each([{ loosening: true, checkpoint: 'pre-build' }, { loosening: false, checkpoint: 'director' }] as const)('U-07: early approval required for %j before canonical edit', async (d) => { const { root, version } = fixture(); await approve(root, 'plan', version); await stage(root, version, d.loosening, d.checkpoint); const file = path.join(root, 'Sigma/contract/FMN-PLAN-' + version + '.md'); const before = fs.readFileSync(file, 'utf8'); await expect(commitRevision(root, version)).rejects.toThrow('APPROVAL_REQUIRED'); expect(fs.readFileSync(file, 'utf8')).toBe(before); });
    it('U-07: early approval binds candidate and durable consumed receipt', async () => { const { root, version } = fixture(); await approve(root, 'plan', version); await stage(root, version, true); const id = generateId('opt'); await withGovernanceTransaction(root, 'ticket', () => [ticketPath(root, id)], () => prepareRevisionTicket(root, version, id)); const t = readTicket(root, id)!; const a = generateId('appr'); writeApproval(root, { approval_id: a, project_id: t.project_id, operation_ticket_id: id, operation_id: t.operation_id, arguments_hash: t.arguments_hash, target_artifact: 'plan', target_version: version, target_sha256: t.target!.sha256, expected_state_revision: t.expected_state_revision, decision: 'approve', reason: null, director_identity: 'test-director', authentication_method: 'local_cli', channel: 'cli', issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60000).toISOString(), consumed_at: null }); await commitRevision(root, version, id, a); const receipt = readRevisionLedger(root, readActiveChain(root).data, version).records[1].authorization; expect(receipt?.approval.consumed_at).toBeTruthy(); });
    it('U-08: notice cannot be sent by wrong role or with old revision', async () => { const { root, env, version } = fixture(); await approve(root, 'plan', version); await stage(root, version); await commitRevision(root, version); const bad = runCli('send --from dev --to fmn --type CONTRACT_CHANGE --related-artifact PLAN-' + version + ' --revision-id ' + version + ':rev-2 --message "change"', root, env.homeDir); expect(bad.exitCode).toBe(1); expect(readActiveChain(root).data.plan.versions[0].pending_notice).toBe(true); expect(send(env, version).exitCode).toBe(0); expect(send(env, version).exitCode).toBe(1); });
    it('U-09: sender unread GENERAL blocks notice without losing snapshot', async () => { const { root, env, version } = fixture(); await approve(root, 'plan', version); await stage(root, version); await commitRevision(root, version); expect(runCli('send --from dev --to fmn --related-artifact GENERAL --message "pending"', root, env.homeDir).exitCode).toBe(0); const blocked = send(env, version); expect(blocked.exitCode).toBe(1); expect(blocked.stderr).toContain('SEND BLOCKED'); expect(fs.existsSync(boundedPath(root, revisionPaths(version, 2).snapshot))).toBe(true); expect(readActiveChain(root).data.plan.versions[0].pending_notice).toBe(true); });
    it('U-10: notice status OUTDATED does not remove proof; file tamper blocks ack', async () => { const { root, env, version } = fixture(); await approve(root, 'plan', version); exec(root, version); await stage(root, version); await commitRevision(root, version); expect(send(env, version).exitCode).toBe(0); const indexFile = path.join(root, 'Sigma/messages/index.json'); const index = fs.readJsonSync(indexFile); index.messages[0].status = 'OUTDATED'; fs.writeJsonSync(indexFile, index); await ack(root, version, 2); fs.appendFileSync(path.join(root, index.messages[0].file), 'tamper'); expect(() => assertPlanCertified(root, readActiveChain(root).data, version)).toThrow(); });
    it.each(['snapshot', 'ledger'])('U-10: missing/changed %s evidence blocks', async (kind) => { const { root, version } = fixture(); await approve(root, 'plan', version); const paths = revisionPaths(version); fs.appendFileSync(boundedPath(root, kind === 'snapshot' ? paths.snapshot : paths.ledger), 'tamper'); expect(() => assertPlanCertified(root, readActiveChain(root).data, version)).toThrow(); });
    it('U-12: INTENT recertification invalidates APPROVED, never demotes LOCKED history', async () => { const { root, version } = fixture(); await approve(root, 'plan', version); exec(root, version); await ack(root, version, 1); const c = readActiveChain(root).data; certifyIntentDoc(c, path.join(root, c.intent.file!)); writeChain(root, 'v1', c); expect(c.plan.versions[0].needs_intent_review).toBe(true); expect(approvalReview(root, 'exec', version).blockers.join(' ')).toContain('STALE_INTENT'); });
    it('U-13: opt-in migration converts orphan LOCKED PLAN but creates no revision/approval', async () => { const { root, version } = fixture('intent_aligned', 'legacy_lock'); await approve(root, 'plan', version); const before = fs.readFileSync(chainFilePath(root, 'v1'), 'utf8'); const dry = await migrateLifecycle(root, 'v1', true); expect(dry.applied).toBe(false); expect(fs.readFileSync(chainFilePath(root, 'v1'), 'utf8')).toBe(before); await migrateLifecycle(root, 'v1', false, true); const c = readActiveChain(root).data; expect(c.plan.versions[0].state).toBe('APPROVED'); expect(c.plan.versions[0].revision).toBeUndefined(); expect(c.plan.versions[0].legacy_provenance?.locked_at).toBeTruthy(); expect((await migrateLifecycle(root, 'v1', false, true)).applied).toBe(false); await approve(root, 'plan', version); expect(readRevisionLedger(root, readActiveChain(root).data, version).records[0].provenance).toBe('imported_baseline'); });
    it('U-13: ambiguous migration rejects before any deduplication', () => { const { root, version } = fixture('intent_aligned', 'legacy_lock'); const c = readActiveChain(root).data; registerExecDraft(c, version, 'Sigma/evidence/DEV-EXEC-' + version + '.md', version); c.exec.versions.push({ ...c.exec.versions[0], state: 'LOCKED' }); expect(() => lifecycleMigrationPreview(c)).toThrow('Ambiguous'); expect(c.exec.versions.length).toBe(2); });
    it('U-14: reconstruct without tracker never claims completed pair', () => { const { root, version } = fixture(); exec(root, version); fs.unlinkSync(chainFilePath(root, 'v1')); const c = reconstructAllChains(root).chains.get(1)!.data; expect(c.lifecycle_model).toBe('unknown'); expect(c.exec.versions[0].state).toBe('DRAFT'); expect(c.gates.gate_3_satisfied).toBe(false); });
    it('U-14: reconstruct preserves certified INTENT/PLAN when another artifact appears', async () => { const { root, version } = fixture(); await approve(root, 'plan', version); fs.writeFileSync(path.join(root, 'Sigma/contract/FMN-PLAN-v1.2.md'), validPlanDocV3('v1.2')); writeChainMetadata(path.join(root, 'Sigma/contract/FMN-PLAN-v1.2.md'), readActiveChain(root).data); const before = readActiveChain(root).data; const c = reconstructAllChains(root).chains.get(1)!.data; expect(c.intent.certified_doc_sha256).toBe(before.intent.certified_doc_sha256); expect(c.plan.versions.find(p => p.version === version)?.revision).toBe(1); });
    it('U-15: INVALID recovery cannot bypass missing acknowledgement/hash', async () => { const { root, version } = fixture(); await approve(root, 'plan', version); exec(root, version); const c = readActiveChain(root).data; c.runtime_invalid = { last_doctor_run_at: null, markers: [{ id: 'x', domain: 'exec', status: 'INVALID', reason: 'recovery', chain: { intent_version: 'v1', plan_version: version, exec_version: version }, first_detected_at: new Date().toISOString(), last_detected_at: new Date().toISOString() }] }; writeChain(root, 'v1', c); await expect(approve(root, 'exec', version)).rejects.toThrow('acknowledge'); });
    it('U-16: read-only status/doctor exposes APPROVED and never certifies', async () => { const { root, version } = fixture(); await approve(root, 'plan', version); const before = fs.readFileSync(chainFilePath(root, 'v1'), 'utf8'); expect((computePlanStatus(root) as any).approved[0].state).toBe('APPROVED'); expect((computeDoctor(root) as any).applied).toBe(false); expect(fs.readFileSync(chainFilePath(root, 'v1'), 'utf8')).toBe(before); });
});

describe('F04 source, migration and notice integration',()=>{
 it('U-03/U-06/U-16: disk edits block only the affected approved target while healthy parallel work remains eligible',async()=>{const {root,version}=fixture();await approve(root,'plan',version);const c=readActiveChain(root).data;registerPlanDraft(c,'v1.2','Sigma/contract/FMN-PLAN-v1.2.md','v1');const second=path.join(root,'Sigma/contract/FMN-PLAN-v1.2.md');fs.writeFileSync(second,validPlanDocV3('v1.2'));writeChainMetadata(second,c);writeChain(root,'v1',c);await approve(root,'plan','v1.2');fs.appendFileSync(path.join(root,'Sigma/contract/FMN-PLAN-v1.1.md'),`
<!-- SIGMA:FMN_PLAN:SECTION:AC -->`);expect((computePlanStatus(root) as any).gate_2_open).toBe(true);expect((computePlanStatus(root) as any).lifecycle.plans[0].blockers.length).toBeGreaterThan(0);fs.appendFileSync(second,`
<!-- SIGMA:FMN_PLAN:SECTION:AC -->`);expect((computePlanStatus(root) as any).gate_2_open).toBe(false);});
 it('U-12: source recertification keeps completed history locked and flags only open APPROVED contracts',async()=>{const {root,version}=fixture();await approve(root,'plan',version);exec(root,version);await ack(root,version,1);await approve(root,'exec',version);const c=readActiveChain(root).data;registerPlanDraft(c,'v1.2','Sigma/contract/FMN-PLAN-v1.2.md','v1');const file=path.join(root,'Sigma/contract/FMN-PLAN-v1.2.md');fs.writeFileSync(file,validPlanDocV3('v1.2'));writeChainMetadata(file,c);writeChain(root,'v1',c);await approve(root,'plan','v1.2');const updated=readActiveChain(root).data;certifyIntentDoc(updated,path.join(root,updated.intent.file!));writeChain(root,'v1',updated);expect(updated.plan.versions[0].state).toBe('LOCKED');expect(updated.exec.versions[0].state).toBe('LOCKED');expect(updated.plan.versions[0].needs_intent_review).toBe(false);expect(updated.plan.versions[1].needs_intent_review).toBe(true);expect(()=>assertPlanCertified(root,updated,version,false)).not.toThrow();});
 it('U-13: migration keeps completed legacy history, converts unfinished pairs and preserves drafts',async()=>{const {root,version}=fixture('intent_aligned','legacy_lock');await approve(root,'plan',version);exec(root,version);await approve(root,'exec',version);const c=readActiveChain(root).data;const now=new Date().toISOString();c.plan.versions.push({version:'v1.2',state:'LOCKED',intent_version_ref:'v1',created_at:now,updated_at:now,locked_at:now,title:'Open contract'},{version:'v1.3',state:'DRAFT',intent_version_ref:'v1',created_at:now,updated_at:now});c.exec.versions.push({version:'v1.2',state:'DRAFT',plan_version_ref:'v1.2',created_at:now,updated_at:now});writeChain(root,'v1',c);await migrateLifecycle(root,'v1',false,true);const migrated=readActiveChain(root).data;expect(migrated.plan.versions.map(p=>p.state)).toEqual(['LOCKED','APPROVED','DRAFT']);expect(migrated.exec.versions.map(e=>e.state)).toEqual(['LOCKED','DRAFT']);expect(migrated.plan.versions[0].historical_legacy).toBe(true);expect(migrated.plan.versions[1].revision).toBeUndefined();expect(migrated.plan.versions[1].title).toBe('Open contract');});
 it('U-10: read, archive and quota sweep preserve durable notice bytes and acknowledgement eligibility',async()=>{const {root,env,version}=fixture();await approve(root,'plan',version);exec(root,version);await stage(root,version);await commitRevision(root,version);expect(send(env,version).exitCode).toBe(0);const index=fs.readJsonSync(path.join(root,'Sigma/messages/index.json'));const notice=index.messages[0];expect(runCli('inbox read '+notice.id,root,env.homeDir).exitCode).toBe(0);expect(runCli('inbox archive '+notice.id,root,env.homeDir).exitCode).toBe(0);expect(runCli('inbox clear --role dev --keep 0',root,env.homeDir).exitCode).toBe(0);expect(fs.existsSync(path.join(root,notice.file))).toBe(true);await ack(root,version,2);expect(approvalReview(root,'exec',version).blockers).toEqual([]);});
 it('U-09: legacy mailbox blocks a notice and keeps revision evidence pending',async()=>{const {root,env,version}=fixture();await approve(root,'plan',version);await stage(root,version);await commitRevision(root,version);fs.outputFileSync(path.join(root,'Sigma/messages/FMN/old.md'),'Historical message');fs.outputJsonSync(path.join(root,'Sigma/messages/index.json'),{messages:[{id:'old-message',from:'DEV',to:'FMN',type:'NOTE',subject:'Historical message',file:'Sigma/messages/FMN/old.md',status:'READ',created_at:'2026-10-01T00:00:00.000Z',attachments:[],action:'FYI',related_artifact:'GENERAL'}]});const result=send(env,version);expect(result.exitCode).toBe(1);expect(result.stderr).toMatch(/migrat|legacy/i);expect(readActiveChain(root).data.plan.versions[0].pending_notice).toBe(true);expect(fs.existsSync(boundedPath(root,revisionPaths(version,2).snapshot))).toBe(true);});
 it('U-16: check selects the sole open contract even when the display pointer names a superseded contract',async()=>{const {root,env,version}=fixture();const c=readActiveChain(root).data;c.plan.versions.push({...c.plan.versions[0],version:'v1.2',file:'Sigma/contract/FMN-PLAN-v1.2.md',state:'SUPERSEDED'});c.plan.active_version='v1.2';c.plan.active_state='SUPERSEDED';writeChain(root,'v1',c);const result=runCli('plan check',root,env.homeDir);expect(result.exitCode).toBe(0);expect(result.stdout).toContain('FMN-PLAN-'+version+'.md');});
 it('U-02/U-16: CLI approval preview is read-only and explicit confirm applies paired semantics',()=>{const {root,env,version}=fixture();const before=fs.readFileSync(chainFilePath(root,'v1'),'utf8');expect(runCli('plan approve --v '+version,root,env.homeDir).exitCode).toBe(0);expect(fs.readFileSync(chainFilePath(root,'v1'),'utf8')).toBe(before);expect(runCli('plan approve --v '+version+' --director-confirm',root,env.homeDir).exitCode).toBe(0);expect(readActiveChain(root).data.plan.versions[0].state).toBe('APPROVED');expect(runCli('plan status',root,env.homeDir).stdout).toContain('APPROVED');});
});

describe('F04 declared authority and recovery boundaries', () => {
  it('U-07: missing loosening classification and candidate declaration mismatch cannot be certified', async () => {
    const {root,version}=fixture();await approve(root,'plan',version);const p=revisionPaths(version);
    await expect(withGovernanceTransaction(root,'bad_stage',()=>[boundedPath(root,p.candidate),boundedPath(root,p.staging)],()=>preparePlanRevision(root,version,{checkpoint:'pre-build',requested_by:'FMN',reason:'Review',delta:'AC',loosening:undefined} as any))).rejects.toThrow('explicit boolean');
    await stage(root,version);const candidate=boundedPath(root,p.candidate);fs.writeFileSync(candidate,fs.readFileSync(candidate,'utf8').replace('| FMN | No |','| FMN | Yes |'));expect(()=>checkPlanRevision(root,version)).toThrow('declaration mismatch');
  });
  it('U-15: an audited override cannot replace notice, acknowledgement or early approval evidence', async () => {
    const {root,env,version}=fixture();await approve(root,'plan',version);exec(root,version);await ack(root,version,1);await stage(root,version);await commitRevision(root,version);
    expect(runCli('override --v '+version+' --reason "Fixture recovery" --director-confirm',root,env.homeDir).exitCode).toBe(0);
    const blockers=approvalReview(root,'exec',version).blockers.join(' ');expect(blockers).toMatch(/notice|CONTRACT_CHANGE/i);await expect(approve(root,'exec',version)).rejects.toThrow('Approval blocked');
  });
  it('U-04/U-06: edited completed contracts block closure without demoting history', async () => {
    const {root,version}=fixture();await approve(root,'plan',version);exec(root,version);await ack(root,version,1);await approve(root,'exec',version);
    const file=path.join(root,'Sigma/contract/FMN-PLAN-'+version+'.md');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('Test criteria.','Unapproved result criteria.'));
    const status=computePlanStatus(root) as any;expect(status.lifecycle.effective_gates.gate_3_satisfied).toBe(false);expect(status.locked[0].version).toBe(version);
  });
});

it('U-01/U-14: conflicting F02 source metadata rejects approval without replacing tracker or baseline', async () => {
  const {root,version}=fixture();const file=path.join(root,'Sigma/contract/FMN-PLAN-'+version+'.md');
  const before=fs.readFileSync(chainFilePath(root,'v1'),'utf8');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('SIGMA:CHAIN intent=v1','SIGMA:CHAIN intent=v2'));
  await expect(approve(root,'plan',version)).rejects.toThrow(/conflict/i);
  expect(fs.readFileSync(chainFilePath(root,'v1'),'utf8')).toBe(before);expect(fs.existsSync(boundedPath(root,revisionPaths(version).snapshot))).toBe(false);
});

it('U-06: revision staging cannot remove AUD advice appended after the latest snapshot', async () => {
  const {root,version}=fixture();await approve(root,'plan',version);const canonical=path.join(root,'Sigma/contract/FMN-PLAN-'+version+'.md');
  fs.appendFileSync(canonical,'\nAUD retained advice.\n');await stage(root,version);const candidate=boundedPath(root,revisionPaths(version).candidate);
  fs.writeFileSync(candidate,fs.readFileSync(candidate,'utf8').replace('\nAUD retained advice.\n','\n'));expect(()=>checkPlanRevision(root,version)).toThrow('append-only');
});
it('U-01/U-14: revision staging cannot replace the owning chain metadata', async () => {
  const {root,version}=fixture();await approve(root,'plan',version);await stage(root,version);const candidate=boundedPath(root,revisionPaths(version).candidate);
  fs.writeFileSync(candidate,fs.readFileSync(candidate,'utf8').replace('SIGMA:CHAIN intent=v1','SIGMA:CHAIN intent=v2'));expect(()=>checkPlanRevision(root,version)).toThrow(/conflict/i);
});
