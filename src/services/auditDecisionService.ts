// F08c: audit snapshots and advisory decisions; no lifecycle writes.
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { readProjectIdentity } from '../engine/chain';
import { assertNoTransactionSymlink, readTicket, readApproval, isValidStoreId } from '../engine/controlStore';
import { computeStateRevision } from '../mcp/contract';
import { ArtifactType } from '../mcp/artifactPath';
import { reviewChain, captureArtifact, targetOnly, reviewPlanSources } from './sourceReviewService';
import {
  CapturedFile, AuditPack, Assessment, digest, readF08Store, writeF08Store, f08StorePath,
} from './f08Store';
const now = () => new Date().toISOString();
const id = (kind: string) => kind + '-' + crypto.randomUUID();
function requireText(text: string, label: string, max = 32768): void {
  if (!text?.trim() || Buffer.byteLength(text) > max) throw new Error(label + ' must be non-empty and within its byte limit.');
}
export function activeTarget(root: string, type: ArtifactType, version: string): CapturedFile {
  return captureArtifact(root, reviewChain(root).chainVersion, type, version);
}
function assertHash(file: CapturedFile, expected: string): void {
  if (file.sha256 !== expected) throw new Error('STALE_ARTIFACT: target changed; review again.');
}
export function createAuditPack(root: string, type: ArtifactType, version: string, expectedHash: string, includeEvidence = false) {
  const { chainVersion, data: chain } = reviewChain(root);
  const stateRevision = computeStateRevision(root).revision!;
  const target = activeTarget(root, type, version); assertHash(target, expectedHash);
  const files: CapturedFile[] = [target], missing: string[] = [];
  const add = (kind: ArtifactType, v: string) => {
    if (files.some(f => f.type === kind && f.version === v)) return;
    try { files.push(captureArtifact(root, chainVersion, kind, v)); }
    catch (error) { missing.push(kind + ' ' + v + ': ' + (error as Error).message.split(root).join('.')); }
  };
  add('intent', chain.intent.version);
  if (chain.roadmap) add('roadmap', chain.roadmap.version);
  else missing.push('ROADMAP not registered.');
  const planVersion = type === 'exec' ? chain.exec.versions.find(e => e.version === version)?.plan_version_ref : type === 'plan' ? version : undefined;
  if (planVersion) add('plan', planVersion);
  const evidence = type === 'exec' ? (chain.exec.versions.find(e => e.version === version)?.evidence ?? [])
    .map(e => ({ description: e.description, path: e.ref_path, recorded_sha256: e.ref_sha256 })) : [];
  const evidenceSnapshots: { path: string; sha256: string; content: string }[] = [];
  for (const e of evidence) {
    if (!includeEvidence) missing.push('Evidence reference only (not snapshotted): ' + e.path);
    else {
      try { evidenceSnapshots.push(readEvidenceSnapshot(root, e.path, e.recorded_sha256)); }
      catch (error) { missing.push('Evidence not included: ' + e.path + ': ' + (error as Error).message.split(root).join('.')); }
    }
  }
  const draft = { id: id('pack'), project_id: readProjectIdentity(root).project_id, created_at: now(), state_revision: stateRevision,
    target: targetOnly(target), files, missing, evidence, evidence_snapshots: evidenceSnapshots, review: planVersion ? reviewPlanSources(root, planVersion) : null };
  if (computeStateRevision(root).revision !== stateRevision || files.some(f => captureArtifact(root, f.chain, f.type, f.version).sha256 !== f.sha256) ||
      evidenceSnapshots.some(e => readEvidenceSnapshot(root, e.path, e.sha256).sha256 !== e.sha256))
    throw new Error('STALE_ARTIFACT: sources changed during audit capture.');
  const pack: AuditPack = { ...draft, manifest_sha256: digest(JSON.stringify(draft)) };
  const data = readF08Store(root); data.packs.push(pack); writeF08Store(root, data);
  return { id: pack.id, manifest_sha256: pack.manifest_sha256, target: pack.target, missing, grants_approval: false };
}
function readEvidenceSnapshot(root: string, relative: string, expectedHash: string) {
  if (!relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').includes('..')) throw new Error('Unsafe evidence path.');
  const absolute = path.resolve(root, relative);
  assertNoTransactionSymlink(root, absolute);
  const fd = fs.openSync(absolute, 'r');
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > 512 * 1024) throw new Error('Evidence must be a regular text file within 512 KiB.');
    assertNoTransactionSymlink(root, absolute);
    const bytes = fs.readFileSync(fd), hash = digest(bytes), content = bytes.toString('utf8');
    if (hash.replace(/^sha256:/, '') !== expectedHash.replace(/^sha256:/, '')) throw new Error('Evidence hash differs from its recorded citation.');
    if (!Buffer.from(content).equals(bytes) || content.includes('\0')) throw new Error('Binary evidence is referenced, not exported as text.');
    return { path: relative, sha256: hash, content };
  } finally { fs.closeSync(fd); }
}
function verifyPack(root: string, pack: AuditPack): void {
  const { manifest_sha256, ...body } = pack;
  if (pack.project_id !== readProjectIdentity(root).project_id || digest(JSON.stringify(body)) !== manifest_sha256 ||
      pack.files.some(file => digest(file.content) !== file.sha256) ||
      pack.evidence_snapshots.some(file => digest(file.content) !== file.sha256)) throw new Error('Audit pack integrity mismatch.');
}
export function auditPackStatus(root: string, packId: string) {
  const data = readF08Store(root), pack = data.packs.find(p => p.id === packId);
  if (!pack) throw new Error('Audit pack not found.');
  verifyPack(root, pack);
  const changes: string[] = [];
  if (computeStateRevision(root).revision !== pack.state_revision) changes.push('project state revision');
  for (const old of pack.files) {
    try {
      if (captureArtifact(root, old.chain, old.type, old.version).sha256 !== old.sha256) changes.push(old.path);
    } catch { changes.push(old.path); }
  }
  const priorReview = pack.review as ReturnType<typeof reviewPlanSources> | null;
  if (priorReview?.certification.reference_is_plan_approval) {
    try {
      if (!reviewPlanSources(root, priorReview.plan.version, priorReview.chain).certification.reference_is_plan_approval)
        changes.push('PLAN certification dependencies');
    } catch { changes.push('PLAN certification dependencies'); }
  }
  for (const evidence of pack.evidence_snapshots) {
    try { readEvidenceSnapshot(root, evidence.path, evidence.sha256); } catch { changes.push(evidence.path); }
  }
  for (const response of data.responses.filter(r => r.pack_id === packId)) {
    if (digest(response.raw) !== response.sha256 || response.pack_sha256 !== pack.manifest_sha256)
      throw new Error('AUD response integrity mismatch.');
  }
  return { pack, stale: changes.length > 0, changes, responses: data.responses.filter(r => r.pack_id === packId), grants_approval: false };
}
export function renderAuditPack(root: string, packId: string): string {
  const result = auditPackStatus(root, packId), pack = result.pack;
  return ['# Sigma Audit Pack ' + pack.id, '', 'Target: ' + pack.target.type + ' ' + pack.target.version,
    'Manifest: ' + pack.manifest_sha256, 'Stale: ' + result.stale, '',
    '## Missing / not included', ...pack.missing.map(m => '- ' + m),
    ...pack.files.flatMap(f => ['', '## ' + f.path, 'SHA256: ' + f.sha256, '', f.content]),
    ...pack.evidence_snapshots.flatMap(f => ['', '## Evidence: ' + f.path, 'SHA256: ' + f.sha256, '', f.content]),
    '', '## Source review', JSON.stringify(pack.review, null, 2)].join('\n');
}
export function recordAuditResponse(root: string, packId: string, raw: string, origin: string, expectedPackHash: string, actor: string) {
  if (actor !== 'AUD') throw new Error('AUD role required for recording an audit response.');
  requireText(raw, 'AUD response', 512 * 1024); requireText(origin, 'Response origin');
  const status = auditPackStatus(root, packId);
  if (status.pack.target.chain !== reviewChain(root).chainVersion) throw new Error('Audit writes require the active intent.');
  if (status.stale || status.pack.manifest_sha256 !== expectedPackHash) throw new Error('STALE_ARTIFACT: audit pack is stale or changed.');
  const response = { id: id('aud'), pack_id: packId, pack_sha256: expectedPackHash, raw, sha256: digest(raw), origin, recorded_by: actor, created_at: now() };
  const data = readF08Store(root); data.responses.push(response); writeF08Store(root, data);
  return response;
}
export function addQuestion(root: string, type: ArtifactType, version: string, question: string, expectedHash: string, actor: string) {
  if (!['ARC', 'FMN', 'DEV'].includes(actor)) throw new Error('Only ARC, FMN or DEV may record a substantive question.');
  requireText(question, 'Question');
  const target = activeTarget(root, type, version); assertHash(target, expectedHash);
  const record = { id: id('decision'), target: targetOnly(target), question, created_by: actor, created_at: now() };
  const data = readF08Store(root); data.questions.push(record); writeF08Store(root, data);
  return record;
}
export function resolveQuestion(root: string, questionId: string, answer: string, expectedHash: string, directorConfirmed: boolean) {
  if (!directorConfirmed) throw new Error('Explicit Director confirmation required.');
  requireText(answer, 'Answer');
  const data = readF08Store(root), record = data.questions.find(q => q.id === questionId);
  if (!record || record.target.chain !== reviewChain(root).chainVersion) throw new Error('Question not found in the active intent.');
  if (record.resolved_at) throw new Error('Question already resolved. Record a new question for a new decision.');
  const target = activeTarget(root, record.target.type, record.target.version); assertHash(target, expectedHash);
  if (target.sha256 !== record.target.sha256) throw new Error('STALE_ARTIFACT: question target changed; record a fresh question.');
  Object.assign(record, { answer, resolved_at: now(), resolved_by: 'Director', resolution_sha256: target.sha256 });
  writeF08Store(root, data); return { ...record, grants_approval: false };
}
export function recordReadiness(root: string, version: string, status: Assessment['status'], reason: string,
  expectedHash: string, expectedSourceHash: string, actor: string) {
  if (actor !== 'FMN') throw new Error('FMN role required for semantic readiness assessment.');
  if (!['READY', 'SCOPE_GAP', 'PENDING_ALIGNMENT', 'UNKNOWN'].includes(status)) throw new Error('Invalid readiness status.');
  requireText(reason, 'Assessment reason');
  const { chainVersion, data: chain } = reviewChain(root), target = activeTarget(root, 'plan', version);
  assertHash(target, expectedHash);
  const source = captureArtifact(root, chainVersion, 'intent', chain.intent.version);
  if (source.sha256 !== expectedSourceHash) throw new Error('STALE_ARTIFACT: INTENT changed.');
  const assessment: Assessment = { id: id('assessment'), target: targetOnly(target), source_sha256: source.sha256,
    status, reason, recorded_by: 'FMN', created_at: now() };
  const data = readF08Store(root); data.assessments.push(assessment); writeF08Store(root, data);
  return { ...assessment, grants_approval: false };
}
function storeFiles(root: string, kind: 'tickets' | 'approvals'): string[] {
  const dir = path.join(root, 'Sigma', '.mcp-control', kind);
  assertNoTransactionSymlink(root, dir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.json') && isValidStoreId(name.slice(0, -5))).map(name => name.slice(0, -5));
}
export function listDecisions(root: string, explicitChain?: string, history = false) {
  const chain = reviewChain(root, explicitChain).chainVersion, data = readF08Store(root);
  const substantive = data.questions.filter(q => q.target.chain === chain).map(q => {
    let stale = true;
    try { stale = captureArtifact(root, chain, q.target.type, q.target.version).sha256 !== q.target.sha256; } catch { /* remain stale */ }
    return { ...q, stale, needs_review: stale, status: stale ? 'NEEDS_REVIEW' : q.resolved_at ? 'RESOLVED' : 'OPEN' };
  }).filter(q => history || q.status !== 'RESOLVED');
  const approvals = storeFiles(root, 'approvals').map(key => readApproval(root, key)).filter(a => !!a);
  const transactions = storeFiles(root, 'tickets').map(key => readTicket(root, key)).filter(t => {
    if (!t || t.project_id !== readProjectIdentity(root).project_id) return false;
    if (t.target) {
      try { captureArtifact(root, chain, t.target.artifact as ArtifactType, t.target.version); } catch { return false; }
    } else if (explicitChain && explicitChain !== reviewChain(root).chainVersion) return false;
    return true;
  }).map(t => {
    const ticket = t!;
    const decisions = approvals.filter(a => a!.operation_ticket_id === ticket.operation_ticket_id && a!.project_id === ticket.project_id)
      .sort((a, b) => a!.issued_at.localeCompare(b!.issued_at));
    const latest = decisions[decisions.length - 1];
    let status = ticket.consumed_at ? 'CONSUMED' : Date.parse(ticket.expires_at) <= Date.now() ? 'EXPIRED' :
      latest?.decision === 'reject' ? 'REJECTED' :
      latest?.decision === 'approve' && !latest.consumed_at && Date.parse(latest.expires_at) > Date.now() ? 'APPROVED_AWAITING_COMMIT' : 'PENDING_DIRECTOR';
    if (['PENDING_DIRECTOR', 'APPROVED_AWAITING_COMMIT'].includes(status)) {
      if (/^(plan|exec)_lock/.test(ticket.operation_id)) status = 'RETIRED';
      else if (ticket.expected_state_revision !== computeStateRevision(root).revision) status = 'STALE';
      else if (ticket.target) {
        try {
          const file = captureArtifact(root, chain, ticket.target.artifact as ArtifactType, ticket.target.version);
          if (file.sha256.replace(/^sha256:/, '') !== ticket.target.sha256.replace(/^sha256:/, '')) status = 'STALE';
        } catch { status = 'STALE'; }
      }
    }
    if (!Number.isFinite(Date.parse(ticket.expires_at))) status = 'INVALID';
    return { ticket_id: ticket.operation_ticket_id, operation: ticket.operation_id, target: ticket.target, status };
  }).filter(t => history || ['PENDING_DIRECTOR', 'APPROVED_AWAITING_COMMIT'].includes(t.status));
  return { chain, substantive, transactions, grants_approval: false };
}
export function f08TransactionFiles(root: string): string[] { return [f08StorePath(root)]; }
