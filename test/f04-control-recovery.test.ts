import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { execFileSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildControlServer } from '../src/mcp/control/index';
import { setBinding, resetBindingForTest } from '../src/mcp/shared';
import { fingerprintRoot } from '../src/mcp/binding';
import { stableHash } from '../src/mcp/control/shared';
import { computeStateRevision } from '../src/mcp/contract';
import { setupTestEnv, stubProjectIdentity, validIntentDocV5, validPlanDocV3, validExecDocV3, TestEnv } from './helpers';
import { createInitialChain, ratifyIntent, certifyIntentDoc, registerPlanDraft, registerExecDraft, writeChain, writeActivateStatus, readActiveChain, chainFilePath } from '../src/engine/chain';
import { writeChainMetadata } from '../src/engine/numbering';
import { withGovernanceTransaction } from '../src/engine/governanceTransaction';
import { approveArtifactUseCase, approveArtifactTransactionFiles } from '../src/services/approvalService';
import { acknowledgePlan, revisionPaths, boundedPath, preparePlanRevision, commitPlanRevision, revisionTransactionFiles } from '../src/engine/revisions';
import { readTicket, readApproval, writeApproval, writeTicket, generateId, writeIdempotencyRecord, acquireProjectLock, journaledWrite } from '../src/engine/controlStore';
const envs: TestEnv[] = [];
afterEach(() => { resetBindingForTest(); for (const e of envs.splice(0))
    e.cleanup(); });
function fixture() { const env = setupTestEnv(); envs.push(env); stubProjectIdentity(env); const root = env.projectDir; const c = createInitialChain('v1', 'Sigma/charter/DIR-INTENT-v1.md', undefined, undefined, 'intent_aligned'); const file = path.join(root, c.intent.file!); fs.writeFileSync(file, validIntentDocV5('v1')); writeChainMetadata(file, c); ratifyIntent(c); certifyIntentDoc(c, file); registerPlanDraft(c, 'v1.1', 'Sigma/contract/FMN-PLAN-v1.1.md', 'v1'); fs.writeFileSync(path.join(root, c.plan.versions[0].file!), validPlanDocV3('v1.1')); writeChainMetadata(path.join(root, c.plan.versions[0].file!), c);c.roadmap={version:'v1',state:'DRAFT',file:'Sigma/roadmap/ROADMAP-v1.md',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};fs.outputFileSync(path.join(root,c.roadmap.file!),['<!-- SIGMA:DOC type=ROADMAP schema=1 -->','# ROADMAP v1','<!-- SIGMA:RENDER:START:stage-overview -->','<!-- SIGMA:ROADMAP:SECTION:STAGE_OVERVIEW -->','## 4. Stage Overview','Initial stages','<!-- SIGMA:RENDER:END:stage-overview -->'].join(String.fromCharCode(10)));writeChainMetadata(path.join(root,c.roadmap.file!),c); writeChain(root, 'v1', c); writeActivateStatus(root, 'v1'); return { env, root }; }
async function approve(root: string, domain: 'plan' | 'exec') { return withGovernanceTransaction(root, 'approve', () => approveArtifactTransactionFiles(root, domain, 'v1.1'), () => approveArtifactUseCase(root, domain, 'v1.1')); }
async function executable(root: string) { await approve(root, 'plan'); const c = readActiveChain(root).data; registerExecDraft(c, 'v1.1', 'Sigma/evidence/DEV-EXEC-v1.1.md', 'v1.1'); fs.writeFileSync(path.join(root, c.exec.versions[0].file!), validExecDocV3('v1.1', 'v1.1', 'READY_FOR_APPROVAL')); writeChainMetadata(path.join(root, c.exec.versions[0].file!), c, 'v1.1'); writeChain(root, 'v1', c); await withGovernanceTransaction(root, 'ack', () => [chainFilePath(root, 'v1')], () => acknowledgePlan(root, 'v1.1', 1)); }
async function session(root: string, role: string) { setBinding({ mode: 'control', kind: 'verified', root, projectId: 'TEST', rootFingerprint: fingerprintRoot(root), role, verified: true }); const server = buildControlServer(); const [ct, st] = InMemoryTransport.createLinkedPair(); const client = new Client({ name: 'f04-test', version: '1' }); await Promise.all([server.connect(st), client.connect(ct)]); return { async call(name: string, args: any) { const res = await client.callTool({ name, arguments: args }); const payload = JSON.parse((res.content as any)[0].text); return { ...payload, ok: res.isError !== true, data: payload }; }, close: () => client.close() }; }
function decision(root: string, id: string) { const t = readTicket(root, id)!; const approval = generateId('appr'); writeApproval(root, { approval_id: approval, project_id: t.project_id, operation_ticket_id: id, operation_id: t.operation_id, arguments_hash: t.arguments_hash, target_artifact: t.target!.artifact, target_version: t.target!.version, target_sha256: t.target!.sha256, expected_state_revision: t.expected_state_revision, decision: 'approve', reason: null, director_identity: 'test-director', authentication_method: 'local_cli', channel: 'cli', issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60000).toISOString(), consumed_at: null }); return approval; }
function ticketId(res: any): string { expect(res.ok).toBe(true); return res.data.operation_ticket_id; }
describe('F04 approval control and recovery', () => {
    it.each(['plan', 'exec'] as const)('U-02/U-16: canonical MCP %s approve freezes dependencies and consumes exact approval', async (domain) => { const { root } = fixture(); if (domain === 'exec')
        await executable(root); const s = await session(root, domain === 'plan' ? 'FMN' : 'DEV'); try {
        const prepared = await s.call('sigma_prepare_' + domain + '_approve', { version: 'v1.1', idempotency_key: 'p' });
        const id = ticketId(prepared);
        expect(readTicket(root, id)?.dependencies_sha256).toBeTruthy();
        const a = decision(root, id);
        const result = await s.call('sigma_commit_' + domain + '_approve', { operation_ticket_id: id, approval_id: a, idempotency_key: 'c' });
        expect(result.ok).toBe(true);
        expect(readApproval(root, a)?.consumed_at).toBeTruthy();
        expect(readActiveChain(root).data.plan.versions[0].state).toBe(domain === 'plan' ? 'APPROVED' : 'LOCKED');
    }
    finally {
        await s.close();
    } });
    it.each(['intent', 'target', 'audit'] as const)('U-06/U-11: changed %s after prepare rejects without consumption', async (changed) => { const { root } = fixture(); const s = await session(root, 'FMN'); try {
        const id = ticketId(await s.call('sigma_prepare_plan_approve', { version: 'v1.1', idempotency_key: 'p' }));
        const a = decision(root, id);
        const file = path.join(root, changed === 'intent' ? 'Sigma/charter/DIR-INTENT-v1.md' : 'Sigma/contract/FMN-PLAN-v1.1.md');
        fs.appendFileSync(file, changed === 'audit' ? '\nAUD append.\n' : '\nExternal edit.\n');
        const result = await s.call('sigma_commit_plan_approve', { operation_ticket_id: id, approval_id: a, idempotency_key: 'c' });
        expect(result.ok).toBe(false);
        expect(readTicket(root, id)?.consumed_at).toBeNull();
        expect(readApproval(root, a)?.consumed_at).toBeNull();
    }
    finally {
        await s.close();
    } });
    it('U-11: PLAN AUD append invalidates EXEC ticket even though contract is unchanged', async () => { const { root } = fixture(); await executable(root); const s = await session(root, 'DEV'); try {
        const id = ticketId(await s.call('sigma_prepare_exec_approve', { version: 'v1.1', idempotency_key: 'p' }));
        const a = decision(root, id);
        fs.appendFileSync(path.join(root, 'Sigma/contract/FMN-PLAN-v1.1.md'), '\nAudit additional advice.\n');
        const result = await s.call('sigma_commit_exec_approve', { operation_ticket_id: id, approval_id: a, idempotency_key: 'c' });
        expect(result.ok).toBe(false);
        expect(readApproval(root, a)?.consumed_at).toBeNull();
    }
    finally {
        await s.close();
    } });
    it.each([{ domain: 'plan', role: 'FMN' }, { domain: 'exec', role: 'DEV' }])('U-05: old $domain prepare/commit tombstones leave pending approval untouched', async ({ domain, role }) => { const { root } = fixture(); const s = await session(root, role); try {
        const id = generateId('opt');
        const now = new Date();
        writeTicket(root, { operation_ticket_id: id, operation_id: domain + '_lock', project_id: 'TEST', bound_role: role, arguments_hash: stableHash({}), target: { artifact: domain, version: 'v1.1', sha256: 'old' }, expected_state_revision: computeStateRevision(root).revision!, effects: ['old lock'], authority: 'director', issued_at: now.toISOString(), expires_at: new Date(now.getTime() + 60000).toISOString(), consumed_at: null });
        const a = decision(root, id);
        const before = fs.readFileSync(chainFilePath(root, 'v1'), 'utf8');
        expect((await s.call('sigma_prepare_' + domain + '_lock', { idempotency_key: 'p' })).ok).toBe(false);
        expect((await s.call('sigma_commit_' + domain + '_lock', { operation_ticket_id: id, approval_id: a, idempotency_key: 'c' })).ok).toBe(false);
        expect(readTicket(root, id)?.consumed_at).toBeNull();
        expect(readApproval(root, a)?.consumed_at).toBeNull();
        expect(fs.readFileSync(chainFilePath(root, 'v1'), 'utf8')).toBe(before);
    }
    finally {
        await s.close();
    } });
    it('U-05: completed old commit replay is explicitly historical and never reapplies', async () => { const { root } = fixture(); const s = await session(root, 'FMN'); try {
        const id = generateId('opt');
        const a = generateId('appr');
        const args = { operation_ticket_id: id, approval_id: a };
        const now = new Date().toISOString();
        writeIdempotencyRecord(root, { project_id: 'TEST', operation_id: 'plan_lock_commit', bound_role: 'FMN', idempotency_key: 'historical', arguments_hash: stableHash(args), status: 'completed', pid: process.pid, result: { version: 'v1.1' }, error: null, created_at: now, committed_at: now });
        const before = fs.readFileSync(chainFilePath(root, 'v1'), 'utf8');
        const result = await s.call('sigma_commit_plan_lock', { ...args, idempotency_key: 'historical' });
        expect(result.ok).toBe(true);
        expect(result.data.historical).toBe(true);
        expect(fs.readFileSync(chainFilePath(root, 'v1'), 'utf8')).toBe(before);
    }
    finally {
        await s.close();
    } });
    it('U-16: MCP acknowledge-plan requires DEV and explicit current revision', async () => { const { root } = fixture(); await executable(root); const s = await session(root, 'DEV'); try {
        const result = await s.call('sigma_acknowledge_plan', { version: 'v1.1', revision: 1, expected_state_revision: computeStateRevision(root).revision, idempotency_key: 'ack' });
        expect(result.ok).toBe(true);
        expect(result.data.coding_authorized).toBe(false);
    }
    finally {
        await s.close();
    } });
    it('U-17: competing writers cannot approve the same draft twice', async () => { const { root } = fixture(); const results = await Promise.allSettled([approve(root, 'plan'), approve(root, 'plan')]); expect(results.filter(r => r.status === 'fulfilled').length).toBe(1); expect(readActiveChain(root).data.plan.versions[0].revision).toBe(1); });
    it('U-17: held project lease blocks another writer', async () => { const { root } = fixture(); const lease = await acquireProjectLock(root); try {
        await expect(approve(root, 'plan')).rejects.toThrow();
        expect(readActiveChain(root).data.plan.versions[0].state).toBe('DRAFT');
    }
    finally {
        await lease.release();
    } });
    it.each(['approval_after_roadmap', 'approval_after_chain'])('U-17: PLAN crash at %s restores draft and removes orphan snapshot/ledger', async (point) => {
        const { root } = fixture();
        const before = fs.readFileSync(chainFilePath(root, 'v1'), 'utf8');
        crashCommand(root,['plan','approve','--v','v1.1','--director-confirm'],point);
        expect(fs.existsSync(boundedPath(root,revisionPaths('v1.1').snapshot))).toBe(true);
        expect(fs.readFileSync(path.join(root,'Sigma/roadmap/ROADMAP-v1.md'),'utf8')).toContain('APPROVED');
        expect(readActiveChain(root).data.plan.versions[0].state).toBe(point==='approval_after_chain'?'APPROVED':'DRAFT');
        const lockDir = path.join(root, 'Sigma/.mcp-control/project-write.lock');
        if (fs.existsSync(lockDir)) {
            const old = new Date(Date.now() - 10000);
            fs.utimesSync(lockDir, old, old);
        }
        await withGovernanceTransaction(root, 'recovery', () => [chainFilePath(root, 'v1')], () => null);
        expect(fs.readFileSync(chainFilePath(root, 'v1'), 'utf8')).toBe(before);
        expect(fs.readFileSync(path.join(root,'Sigma/roadmap/ROADMAP-v1.md'),'utf8')).toContain('Initial stages');
        expect(fs.existsSync(boundedPath(root, revisionPaths('v1.1').snapshot))).toBe(false);
        expect(fs.existsSync(boundedPath(root, revisionPaths('v1.1').ledger))).toBe(false);
    });
    it('U-17: external edit after crash refuses destructive rollback', async () => {
        const { root } = fixture();
        try {
            execFileSync(process.execPath, [path.resolve('dist/cli.js'), 'plan', 'approve', '--v', 'v1.1', '--director-confirm'], { cwd: root, env: { ...process.env, SIGMA_CONTROL_TEST_FAILPOINT: 'approval_after_chain' }, windowsHide: true, stdio: 'pipe' });
        }
        catch { }
        expect(readActiveChain(root).data.plan.versions[0].state).toBe('APPROVED');
        fs.appendFileSync(chainFilePath(root, 'v1'), '\n ');
        const edited = fs.readFileSync(chainFilePath(root, 'v1'), 'utf8');
        const lockDir = path.join(root, 'Sigma/.mcp-control/project-write.lock');
        if (fs.existsSync(lockDir)) {
            const old = new Date(Date.now() - 10000);
            fs.utimesSync(lockDir, old, old);
        }
        await expect(withGovernanceTransaction(root, 'recovery', () => [chainFilePath(root, 'v1')], () => null)).rejects.toThrow('manual recovery');
        expect(fs.readFileSync(chainFilePath(root, 'v1'), 'utf8')).toBe(edited);
    });
});
function expiredFixtureLease(root: string) { const lockDir = path.join(root, 'Sigma/.mcp-control/project-write.lock'); if (fs.existsSync(lockDir)) {
    const old = new Date(Date.now() - 10000);
    fs.utimesSync(lockDir, old, old);
} }
function crashCommand(root: string, command: string[], point: string) { let failed = false; try {
    execFileSync(process.execPath, [path.resolve('dist/cli.js'), ...command], { cwd: root, env: { ...process.env, SIGMA_CONTROL_TEST_FAILPOINT: point }, windowsHide: true, stdio: 'pipe' });
}
catch (e: any) {
    failed = true;
    expect(e.status !== 0 || e.signal).toBeTruthy();
} expect(failed).toBe(true); expiredFixtureLease(root); }
async function revision(root: string) {
    const p = revisionPaths('v1.1');
    await withGovernanceTransaction(root, 'revision_prepare', () => [boundedPath(root, p.candidate), boundedPath(root, p.staging)], () => preparePlanRevision(root, 'v1.1', { checkpoint: 'post-build', requested_by: 'FMN', reason: 'Correction', delta: 'Update AC-001', loosening: false }));
    const file = boundedPath(root, p.candidate);
    let doc = fs.readFileSync(file, 'utf8').replace('Test criteria.', 'Corrected criteria.');
    doc = doc.replace('<!-- SIGMA:FMN_PLAN:SECTION:AUD_NOTES -->', `<!-- SIGMA:FMN_PLAN:SECTION:CONTRACT_CHANGES -->
## Contract Changes

| No | Checkpoint | What Changed | Reason | Requested By | Loosening? | Director Approval |
|:--|:--|:--|:--|:--|:--|:--|
| 1 | post-build | Update AC-001 | Correction | FMN | No | With EXEC |

<!-- SIGMA:FMN_PLAN:SECTION:AUD_NOTES -->`);
    fs.writeFileSync(file, doc);
    await withGovernanceTransaction(root, 'revision_commit', () => revisionTransactionFiles(root, 'v1.1'), () => commitPlanRevision(root, 'v1.1'));
}
describe('F04 cross-file crash boundaries', () => {
    it.each(['approval_after_roadmap', 'approval_after_chain'])('U-17: EXEC pair crash at %s never leaves half-lock', async (point) => { const { root } = fixture(); await executable(root); const before = fs.readFileSync(chainFilePath(root, 'v1'), 'utf8'); const ledger = boundedPath(root, revisionPaths('v1.1').ledger); const ledgerBefore = fs.readFileSync(ledger, 'utf8'); crashCommand(root, ['exec', 'approve', '--v', 'v1.1', '--director-confirm'], point); await withGovernanceTransaction(root, 'recovery', () => [chainFilePath(root, 'v1')], () => null); expect(fs.readFileSync(chainFilePath(root, 'v1'), 'utf8')).toBe(before); expect(fs.readFileSync(ledger, 'utf8')).toBe(ledgerBefore); });
    it.each(['contract_notice_after_index', 'contract_notice_after_receipt'])('U-17: notice crash at %s rolls back file/index/receipt together', async (point) => { const { root } = fixture(); await approve(root, 'plan'); await revision(root); const before = fs.readFileSync(chainFilePath(root, 'v1'), 'utf8'); crashCommand(root, ['send', '--from', 'fmn', '--to', 'dev', '--type', 'CONTRACT_CHANGE', '--related-artifact', 'PLAN-v1.1', '--revision-id', 'v1.1:rev-2', '--message', 'Correction notice'], point); await withGovernanceTransaction(root, 'recovery', () => [chainFilePath(root, 'v1')], () => null); expect(fs.readFileSync(chainFilePath(root, 'v1'), 'utf8')).toBe(before); expect(fs.existsSync(path.join(root, 'Sigma/messages/index.json'))).toBe(false); expect(fs.readdirSync(path.join(root, 'Sigma/messages/DEV/v1.1'))).toEqual([]); });
    it.each(['approval_after_ticket_consumed', 'approval_after_approval_consumed', 'after_commit_marker'])('U-17: MCP crash at %s rolls back or finishes consumption exactly once', async (point) => {
        const { root } = fixture();
        await executable(root);
        const s = await session(root, 'DEV');
        const id = ticketId(await s.call('sigma_prepare_exec_approve', { version: 'v1.1', idempotency_key: 'prepare-crash' }));
        const a = decision(root, id);
        await s.close();
        const script = `
 const {buildControlServer}=require('./dist/mcp/control/index.js');const {setBinding}=require('./dist/mcp/shared.js');const {fingerprintRoot}=require('./dist/mcp/binding.js');const {Client}=require('@modelcontextprotocol/sdk/client/index.js');const {InMemoryTransport}=require('@modelcontextprotocol/sdk/inMemory.js');
 (async()=>{const root=process.argv[1];setBinding({mode:'control',kind:'verified',root,projectId:'TEST',rootFingerprint:fingerprintRoot(root),role:'DEV',verified:true});const server=buildControlServer();const [ct,st]=InMemoryTransport.createLinkedPair();const client=new Client({name:'crash-child',version:'1'});await Promise.all([server.connect(st),client.connect(ct)]);const result=await client.callTool({name:'sigma_commit_exec_approve',arguments:{operation_ticket_id:process.argv[2],approval_id:process.argv[3],idempotency_key:'crash-commit'}});process.stderr.write(JSON.stringify(result));await client.close();})().catch(e=>{process.stderr.write(String(e));process.exit(1);});`;
        let crashed = false;
        try {
            execFileSync(process.execPath, ['-e', script, root, id, a], { cwd: path.resolve('.'), env: { ...process.env, SIGMA_CONTROL_TEST_FAILPOINT: point }, windowsHide: true, stdio: 'pipe' });
        }
        catch (e: any) {
            crashed = true;
            expect(e.status !== 0 || e.signal, e.stderr?.toString()).toBeTruthy();
        }
        expect(crashed).toBe(true);
        const interrupted = readActiveChain(root).data;
        expect(interrupted.plan.versions[0].state).toBe('LOCKED');
        expect(interrupted.exec.versions[0].state).toBe('LOCKED');
        expect(!!readTicket(root,id)?.consumed_at).toBe(true);
        expect(!!readApproval(root,a)?.consumed_at).toBe(point !== 'approval_after_ticket_consumed');
        expiredFixtureLease(root);
        await withGovernanceTransaction(root, 'recovery', () => [chainFilePath(root, 'v1')], () => null);
        const committed = point === 'after_commit_marker';
        const c = readActiveChain(root).data;
        expect(c.plan.versions[0].state).toBe(committed ? 'LOCKED' : 'APPROVED');
        expect(c.exec.versions[0].state).toBe(committed ? 'LOCKED' : 'DRAFT');
        expect(!!readApproval(root, a)?.consumed_at).toBe(committed);
        expect(!!readTicket(root, id)?.consumed_at).toBe(committed);
        if (committed) {
            const again = await session(root, 'DEV');
            try {
                const result = await again.call('sigma_commit_exec_approve', { operation_ticket_id: id, approval_id: a, idempotency_key: 'crash-commit' });
                expect(result.ok).toBe(true);
                expect(result.data.state).toBe('LOCKED');
                expect(readActiveChain(root).data.exec.versions[0].locked_at).toBe(c.exec.versions[0].locked_at);
            }
            finally {
                await again.close();
            }
        }
    });
    it('U-17: guarded recovery preserves external edit to an enlisted file not yet written', async () => {
        const { root } = fixture();
        const file = path.join(root, 'Sigma/contract/FMN-PLAN-v1.1.md');
        const changed = fs.readFileSync(file, 'utf8') + `
Editor change`;
        await expect(withGovernanceTransaction(root, 'guard', () => [file, chainFilePath(root, 'v1')], () => { fs.writeFileSync(file, changed); throw new Error('abort'); })).rejects.toThrow('manual recovery');
        expect(fs.readFileSync(file, 'utf8')).toBe(changed);
    });
    it('U-17: guarded writes reject an editor change before overwrite', async () => {
        const { root } = fixture();
        const file = path.join(root, 'Sigma/contract/FMN-PLAN-v1.1.md');
        const changed = fs.readFileSync(file, 'utf8') + `
Editor change`;
        await expect(withGovernanceTransaction(root, 'guard', () => [file], () => { fs.writeFileSync(file, changed); journaledWrite(root, file, 'overwrite'); })).rejects.toThrow('manual recovery');
        expect(fs.readFileSync(file, 'utf8')).toBe(changed);
    });
});
