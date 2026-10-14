// F08a: quoted sources and administrative facts, never automatic semantic approval.
import path from 'path';
import { ChainState, readActiveChain, readChain, chainFilePath, readProjectIdentity, resolveTargetVersion } from '../engine/chain';
import { parseChainMetadata, resolveVersioningScheme } from '../engine/numbering';
import { readCanonicalArtifactFile, candidatesFor, ArtifactType } from '../mcp/artifactPath';
import { assertNoTransactionSymlink } from '../engine/controlStore';
import { readRevisionLedger } from '../engine/revisions';
import * as git from '../engine/gitRepo';
import { validateSigmaDocFile } from '../utils/docCheck';
import { TargetRef, CapturedFile, digest, readF08Store } from './f08Store';

export function reviewChain(root: string, explicit?: string): { chainVersion: string; data: ChainState } {
  const version = explicit ?? readActiveChain(root).chainVersion;
  if (!/^v\d+$/.test(version)) throw new Error('Invalid chain version.');
  assertNoTransactionSymlink(root, chainFilePath(root, version));
  const data = readChain(root, version);
  if (data.chain_version !== version || data.intent.version !== version) throw new Error('Chain identity mismatch.');
  return { chainVersion: version, data };
}
export function captureArtifact(root: string, chainVersion: string, type: ArtifactType, version: string): CapturedFile {
  const { data: chain } = reviewChain(root, chainVersion);
  const matches = candidatesFor(chain, type).filter(entry => entry.version === version);
  if (matches.length !== 1) throw new Error('Artifact must be uniquely registered: ' + type + ' ' + version);
  if (type === 'plan' && chain.plan.versions.find(p => p.version === version)?.intent_version_ref !== chain.intent.version)
    throw new Error('PLAN references a different INTENT.');
  if (type === 'exec') {
    const exec = chain.exec.versions.find(e => e.version === version)!;
    if (!chain.plan.versions.some(p => p.version === exec.plan_version_ref)) throw new Error('EXEC references an unregistered PLAN.');
  }
  const file = readCanonicalArtifactFile(root, type, version, matches[0].file);
  if (!file.present || file.content === null || !file.sha256) throw new Error('Registered artifact unavailable: ' + file.path);
  const metadata = parseChainMetadata(file.content);
  if (metadata && (metadata.intent !== chainVersion || metadata.versioning_scheme !== resolveVersioningScheme(chain) ||
      (type === 'exec' ? metadata.plan !== version : metadata.plan !== undefined)))
    throw new Error('Artifact chain metadata mismatch.');
  return { chain: chainVersion, type, version, path: file.path, sha256: file.sha256, content: file.content };
}
export function targetOnly(file: CapturedFile): TargetRef {
  const { content: _content, ...target } = file; return target;
}
export interface Section { id: string; marker: string; body: string; }
export function sectionsOf(text: string, type: string): Section[] {
  const clean = text.replace(/\r\n/g, '\n');
  const re = new RegExp('<!--\\s*SIGMA:' + type + ':SECTION:([A-Z0-9_]+)\\s*-->', 'g');
  const markers = [...clean.matchAll(re)];
  return markers.map((m, i) => ({ id: m[1], marker: m[0], body: clean.slice(m.index! + m[0].length, markers[i + 1]?.index ?? clean.length) }));
}
function visible(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))
    .replace(/^(\x60{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, m => m.replace(/[^\n]/g, ' '));
}
export interface SourceItem { id: string; section: string; text: string; }
export function intentItems(text: string): SourceItem[] {
  const result: SourceItem[] = [];
  for (const section of sectionsOf(text, 'DIR_INTENT')) {
    const content = visible(section.body), lines = content.split('\n');
    const headings = [...content.matchAll(/^(#{2,6})\s+(?:\d+(?:\.\d+)*[.)]?\s+)?(REQ-\d+)\b[^\n]*/gm)];
    for (const h of headings) {
      const remainder = content.slice(h.index! + h[0].length);
      const next = new RegExp('^#{1,' + h[1].length + '}\\s+', 'm').exec(remainder);
      result.push({ id: h[2], section: section.id, text: content.slice(h.index!, next ? h.index! + h[0].length + next.index : content.length).trim() });
    }
    for (const line of lines) {
      const match = line.match(/^\|\s*(SC|OS|CON|RR|REQ)-(\d+)\s*\|/);
      if (match) result.push({ id: match[1] + '-' + match[2], section: section.id, text: line.trim() });
    }
  }
  return result;
}
function sourceAlignment(plan: string): string {
  const parts = sectionsOf(plan, 'FMN_PLAN').filter(s => s.id === 'SOURCE_ALIGNMENT');
  if (parts.length !== 1) throw new Error('Source Alignment missing or ambiguous.');
  return visible(parts[0].body);
}
export function matchReferences(plan: string, intent: string) {
  const alignment = sourceAlignment(plan), definitions = intentItems(intent);
  const references: { id: string; role: string; status: string; matches: SourceItem[] }[] = [];
  for (const line of alignment.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.trim().split('|').slice(1, -1).map(s => s.trim());
    const ids = [...new Set(cells.slice(1).join('|').match(/\b(?:REQ|SC|OS|CON|RR)-\d+\b/g) ?? [])];
    for (const id of ids) {
      const matches = definitions.filter(item => item.id === id);
      references.push({ id, role: cells[0], status: matches.length === 1 ? 'FOUND' : matches.length ? 'AMBIGUOUS' : 'MISSING', matches });
    }
  }
  const versions = [...new Set([...alignment.matchAll(/\b(?:DIR-)?INTENT[-\s]+(v\d+)\b/gi)].map(m => m[1]))];
  return { declared_intent_versions: versions, references };
}
function certifiedSource(root: string, chain: ChainState, expected: string | undefined, current: CapturedFile) {
  if (!expected) return { status: 'UNKNOWN', sha256: null, content: null as string | null, origin: null as string | null };
  const hash = expected.startsWith('sha256:') ? expected : 'sha256:' + expected;
  if (hash === current.sha256) return { status: 'AVAILABLE', sha256: hash, content: current.content, origin: 'current-content-matches-reference' };
  const top = git.repoToplevel(root);
  if (top.ok) {
    const rel = git.repoRelativePath(top.root, path.join(root, current.path));
    const commits = [chain.intent.git_baseline?.commit, ...(chain.intent.amendments ?? []).flatMap(a => [a.result_commit, a.baseline_commit])];
    for (const commit of [...new Set(commits.filter((v): v is string => !!v))]) {
      const blob = git.blobAt(top.root, commit, rel);
      if (blob && digest(blob) === hash) return { status: 'AVAILABLE', sha256: hash, content: blob.toString('utf8'), origin: 'git:' + commit };
    }
  }
  return { status: 'UNKNOWN', sha256: hash, content: null as string | null, origin: null as string | null };
}
export function reviewPlanSources(root: string, explicitVersion?: string, explicitChain?: string) {
  const { chainVersion, data: chain } = reviewChain(root, explicitChain);
  let version = explicitVersion;
  if (!version) {
    const open = chain.plan.versions.filter(p => p.state === 'DRAFT' || p.state === 'APPROVED');
    const resolution = resolveTargetVersion(open.map(p => ({ ...p, state: 'DRAFT' })), undefined);
    if (resolution.kind === 'ambiguous') throw new Error('Multiple open PLANs; specify version.');
    version = resolution.kind === 'resolved' ? resolution.version : chain.plan.active_version ?? undefined;
  }
  if (!version) throw new Error('No PLAN available for source review.');
  const plan = captureArtifact(root, chainVersion, 'plan', version);
  const entry = chain.plan.versions.find(p => p.version === version)!;
  const structure = validateSigmaDocFile(path.join(root, plan.path), 'plan');
  const findings: string[] = [];
  let current: CapturedFile | null = null;
  try { current = captureArtifact(root, chainVersion, 'intent', chain.intent.version); }
  catch (error) { findings.push((error as Error).message.split(root).join('.')); }
  let expected = entry.intent_doc_sha256_ref;
  if (entry.revision_ledger) {
    try { const ledger = readRevisionLedger(root, chain, version); expected = ledger.records[ledger.records.length - 1].intent_doc_sha256_ref; }
    catch (error) { findings.push('PLAN ledger: ' + (error as Error).message.split(root).join('.')); }
  }
  const baseline = current ? certifiedSource(root, chain, expected, current) : { status: 'UNKNOWN', sha256: expected ?? null, content: null, origin: null };
  let currentRefs: ReturnType<typeof matchReferences> | null = null;
  let baselineRefs: ReturnType<typeof matchReferences> | null = null;
  try {
    if (current) currentRefs = matchReferences(plan.content, current.content);
    if (baseline.content) baselineRefs = matchReferences(plan.content, baseline.content);
  } catch (error) { findings.push((error as Error).message.split(root).join('.')); }
  if (currentRefs && (currentRefs.declared_intent_versions.length !== 1 || currentRefs.declared_intent_versions[0] !== chain.intent.version))
    findings.push('Declared INTENT version missing, ambiguous or different from owning chain.');
  let roadmap: CapturedFile | null = null;
  if (chain.roadmap) {
    try { roadmap = captureArtifact(root, chainVersion, 'roadmap', chain.roadmap.version); }
    catch (error) { findings.push('ROADMAP: ' + (error as Error).message.split(root).join('.')); }
  }
  const namedSections = current ? sectionsOf(current.content, 'DIR_INTENT').filter(s => ['QUALITY_STANDARDS', 'QUALITY_BAR'].includes(s.id)) : [];
  const assessment = readF08Store(root).assessments.filter(a => a.target.chain === chainVersion && a.target.version === version && a.target.type === 'plan').slice(-1)[0];
  const assessmentFresh = assessment && assessment.target.sha256 === plan.sha256 && assessment.source_sha256 === current?.sha256;
  const certified = chain.intent.certified_doc_sha256;
  return {
    project_id: readProjectIdentity(root).project_id, chain: chainVersion, plan: targetOnly(plan),
    structure: { ok: structure.ok, schema: structure.schema, errors: structure.errors, warnings: structure.warnings, requirements: structure.requirements },
    certification: { plan_state: entry.state, plan_revision: entry.revision ?? null, needs_intent_review: entry.needs_intent_review ?? false,
      pending_notice: entry.pending_notice ?? false, reference_is_plan_approval: !!entry.revision_ledger && !findings.some(f => f.startsWith('PLAN ledger: ')), current_intent_sha256: current?.sha256 ?? null, certified_intent_sha256: certified ?? null,
      current_matches_certified: certified && current ? current.sha256 === (certified.startsWith('sha256:') ? certified : 'sha256:' + certified) : null,
      plan_intent_revision_ref: entry.intent_revision_ref ?? null, baseline },
    current_source: current, current_references: currentRefs, referenced_references: baselineRefs,
    named_sources: { quality_standards: namedSections, planned_stage: roadmap ? sectionsOf(roadmap.content, 'ROADMAP').filter(s => s.id === 'PLANNED_STAGE') : [],
      roadmap: roadmap ? targetOnly(roadmap) : null, note: 'Named sections are source material for human review, not a semantic match verdict.' },
    semantic_readiness: assessment ? { status: assessmentFresh ? assessment.status : 'UNKNOWN', stale: !assessmentFresh, assessment } : { status: 'UNKNOWN', stale: false, assessment: null },
    findings, grants_approval: false,
  };
}
