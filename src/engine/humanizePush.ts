import fs from 'fs-extra';
import path from 'path';
import { ChainState, readActiveChain, readChain, listChainVersions, writeChain, readProjectIdentity } from './chain';
import { toPosix } from '../utils/fs';
import { syncArtifactToNotion, deleteNotionPageByTitle } from './notionService';
import { stripTemplateInstructions, scanForSigmaTerminology, loadTerminologyList } from './terminologyScanner';
import {
  checkFidelityCoverage,
  CoverageConfig,
  DIR_INTENT_COVERAGE_CONFIG,
  PLAN_EXEC_COVERAGE_CONFIG,
  DIR_CLOSE_COVERAGE_CONFIG,
} from './fidelityCoverage';

// PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §2.7/§4 Fase 4/6 — the orchestration
// `sigma notion push` runs for every generated-but-not-yet-pushed human
// artifact on the active chain. Deliberately separate from
// syncArtifactToNotion() itself (plan v2's generic primitive, which knows
// nothing about humanize semantics — §2.7's own layering note) — this file
// is the humanize-specific layer that decides what gets pushed and under
// what conditions, then hands already-checked content to the generic
// primitive.

export interface HumanArtifactPushTarget {
  kind: 'intent' | 'exec' | 'close';
  artifactType: string;
  version: string;
  humanRelPath: string;
  ledgerRelPath: string;
  sourceRelPaths: string[];
  coverageConfig: CoverageConfig;
}

export interface HumanArtifactPushResult {
  target: HumanArtifactPushTarget;
  success: boolean;
  pageUrl?: string;
  error?: string;
}

// §2.6 — the Notion-facing title, distinct from `target.artifactType`
// (which stays the internal Sigma label, used only in CLI output — never
// published). No "Sigma", no artifact codes, matches the terminology
// mapping's own vocabulary (DIR-INTENT -> "Project Brief", DEV-EXEC ->
// "Delivery"). Version stays in the title for lookup uniqueness across
// superseded history; a bare version tag isn't Sigma-specific vocabulary.
export function computeHumanNotionTitle(kind: HumanArtifactPushTarget['kind'], version: string, projectName: string): string {
  const label = kind === 'intent' ? 'Project Brief' : kind === 'exec' ? 'Delivery Summary' : 'Closing Summary';
  return `${projectName} — ${label} (${version})`;
}

function humanPaths(prefix: string, version: string): { humanRelPath: string; ledgerRelPath: string } {
  return {
    humanRelPath: toPosix(path.join('Sigma', 'human', `${prefix}-${version}.md`)),
    ledgerRelPath: toPosix(path.join('Sigma', 'human', `${prefix}-${version}.fidelity.md`)),
  };
}

// Collects every human artifact the chain currently knows about — not just
// ones missing a push timestamp. Re-pushing an already-pushed artifact is
// intentional and safe (syncArtifactToNotion() is idempotent, D-04): a
// Director who edits the human doc after an earlier push needs the update
// to actually reach Notion, not be silently skipped because it "already
// happened once."
export function collectHumanPushTargets(chain: ChainState): HumanArtifactPushTarget[] {
  const targets: HumanArtifactPushTarget[] = [];

  // SUPERSEDED entries are excluded here on purpose — those get deleted by
  // reconcileSupersededHumanArtifacts(), not re-pushed. Re-syncing a
  // SUPERSEDED artifact's content right before deleting it would be wasted
  // work at best and a race at worst.
  if (chain.intent.human && chain.intent.state !== 'SUPERSEDED') {
    const { humanRelPath, ledgerRelPath } = humanPaths('DIR-INTENT-HUMAN', chain.intent.version);
    targets.push({
      kind: 'intent',
      artifactType: 'DIR-INTENT-HUMAN',
      version: chain.intent.version,
      humanRelPath,
      ledgerRelPath,
      sourceRelPaths: [chain.intent.file ?? toPosix(path.join('Sigma', 'charter', `DIR-INTENT-${chain.intent.version}.md`))],
      coverageConfig: DIR_INTENT_COVERAGE_CONFIG,
    });
  }

  for (const execEntry of chain.exec.versions) {
    if (!execEntry.human || execEntry.state === 'SUPERSEDED') continue;
    const { humanRelPath, ledgerRelPath } = humanPaths('PLAN-EXEC-HUMAN', execEntry.version);
    const planEntry = execEntry.plan_version_ref
      ? chain.plan.versions.find(v => v.version === execEntry.plan_version_ref)
      : undefined;
    const sourceRelPaths = [
      planEntry?.file ?? (execEntry.plan_version_ref ? toPosix(path.join('Sigma', 'contract', `FMN-PLAN-${execEntry.plan_version_ref}.md`)) : undefined),
      execEntry.file ?? toPosix(path.join('Sigma', 'evidence', `DEV-EXEC-${execEntry.version}.md`)),
    ].filter((p): p is string => Boolean(p));
    targets.push({
      kind: 'exec',
      artifactType: 'PLAN-EXEC-HUMAN',
      version: execEntry.version,
      humanRelPath,
      ledgerRelPath,
      sourceRelPaths,
      coverageConfig: PLAN_EXEC_COVERAGE_CONFIG,
    });
  }

  if (chain.close?.human && chain.close.state !== 'SUPERSEDED') {
    const { humanRelPath, ledgerRelPath } = humanPaths('DIR-CLOSE-HUMAN', chain.close.version);
    targets.push({
      kind: 'close',
      artifactType: 'DIR-CLOSE-HUMAN',
      version: chain.close.version,
      humanRelPath,
      ledgerRelPath,
      sourceRelPaths: [chain.close.file ?? toPosix(path.join('Sigma', 'close', `DIR-CLOSE-${chain.close.version}.md`))],
      coverageConfig: DIR_CLOSE_COVERAGE_CONFIG,
    });
  }

  return targets;
}

export async function pushHumanArtifact(projectRoot: string, target: HumanArtifactPushTarget): Promise<HumanArtifactPushResult> {
  const humanAbsPath = path.join(projectRoot, target.humanRelPath);
  const ledgerAbsPath = path.join(projectRoot, target.ledgerRelPath);

  if (!fs.existsSync(humanAbsPath)) {
    return { target, success: false, error: `${target.humanRelPath} not found.` };
  }
  if (!fs.existsSync(ledgerAbsPath)) {
    return { target, success: false, error: `${target.ledgerRelPath} (Fidelity Ledger) not found.` };
  }

  const rawContent = fs.readFileSync(humanAbsPath, 'utf8');
  const ledgerContent = fs.readFileSync(ledgerAbsPath, 'utf8');

  // §2.7 tahap 0 — strip before anything else scans this content.
  const { cleaned } = stripTemplateInstructions(rawContent);

  // §2.7 tahap 1 — terminology gate. Blocking, not a warning.
  const terminology = loadTerminologyList(projectRoot);
  const termMatches = scanForSigmaTerminology(cleaned, terminology);
  if (termMatches.length > 0) {
    const list = termMatches.map(m => `  Line ${m.line}: "${m.term}" — ${m.lineText}`).join('\n');
    return {
      target,
      success: false,
      error: `Sigma terminology detected in ${target.humanRelPath} — push blocked:\n${list}`,
    };
  }

  // §2.3/§2.7 tahap 2 — fidelity coverage gate, against the (concatenated)
  // source artifact(s), not the human doc itself.
  const sourceContent = target.sourceRelPaths
    .map(rel => {
      const abs = path.join(projectRoot, rel);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
    })
    .join('\n');
  const coverageGaps = checkFidelityCoverage(sourceContent, ledgerContent, target.coverageConfig);
  if (coverageGaps.length > 0) {
    const list = coverageGaps.map(g => `  ${g.identifier} (${g.kind}): ${g.detail}`).join('\n');
    return {
      target,
      success: false,
      error: `Fidelity Ledger coverage incomplete for ${target.humanRelPath} — push blocked:\n${list}`,
    };
  }

  const identity = readProjectIdentity(projectRoot);
  const notionTitle = computeHumanNotionTitle(target.kind, target.version, identity.project_name);
  const pushRes = await syncArtifactToNotion(projectRoot, target.artifactType, target.version, cleaned, notionTitle);
  if (!pushRes.success) {
    return { target, success: false, error: pushRes.error };
  }

  return { target, success: true, pageUrl: pushRes.pageUrl };
}

// Pushes every human artifact currently generated on the active chain and
// persists pushed_to_notion_at/notion_page_url for each success — this is
// what `sigma plan new`/`sigma close new` check (§3.4/§4 Fase 6) to decide
// whether the humanize gate is satisfied. A partial failure still persists
// whatever succeeded; only the failed target's state is left unstamped.
export async function pushAllHumanArtifacts(projectRoot: string): Promise<HumanArtifactPushResult[]> {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  const targets = collectHumanPushTargets(chain);
  if (targets.length === 0) return [];

  const results: HumanArtifactPushResult[] = [];
  for (const target of targets) {
    const result = await pushHumanArtifact(projectRoot, target);
    results.push(result);
    if (result.success) {
      const now = new Date().toISOString();
      if (target.kind === 'intent' && chain.intent.human) {
        chain.intent.human.pushed_to_notion_at = now;
        chain.intent.human.notion_page_url = result.pageUrl;
      } else if (target.kind === 'exec') {
        const execEntry = chain.exec.versions.find(v => v.version === target.version);
        if (execEntry?.human) {
          execEntry.human.pushed_to_notion_at = now;
          execEntry.human.notion_page_url = result.pageUrl;
        }
      } else if (target.kind === 'close' && chain.close?.human) {
        chain.close.human.pushed_to_notion_at = now;
        chain.close.human.notion_page_url = result.pageUrl;
      }
    }
  }

  writeChain(projectRoot, chainVersion, chain);
  return results;
}

export interface ReconcileResult {
  artifactType: string;
  version: string;
  deleted: boolean;
  error?: string;
}

function supersededCandidatesForChain(chain: ChainState): { kind: HumanArtifactPushTarget['kind']; artifactType: string; version: string }[] {
  const candidates: { kind: HumanArtifactPushTarget['kind']; artifactType: string; version: string }[] = [];
  if (chain.intent.state === 'SUPERSEDED' && chain.intent.human) {
    candidates.push({ kind: 'intent', artifactType: 'DIR-INTENT-HUMAN', version: chain.intent.version });
  }
  for (const execEntry of chain.exec.versions) {
    if (execEntry.state === 'SUPERSEDED' && execEntry.human) {
      candidates.push({ kind: 'exec', artifactType: 'PLAN-EXEC-HUMAN', version: execEntry.version });
    }
  }
  if (chain.close?.state === 'SUPERSEDED' && chain.close.human) {
    candidates.push({ kind: 'close', artifactType: 'DIR-CLOSE-HUMAN', version: chain.close.version });
  }
  return candidates;
}

// §2.5 — Notion must never keep showing a human artifact whose source is
// SUPERSEDED locally. Not a hook on `intent supersede`/`plan supersede`
// (that would give a core governance command a network dependency,
// contradicting plan v2 §1) — deliberately checked here, at push time,
// covering only artifacts that were actually pushed at least once
// (chain.*.human present).
//
// Scans every chain on disk, not just the active one — `intent supersede
// --v <version>` routinely targets a chain other than the currently active
// one (Director opens v2, leaving v1 SUPERSEDED but still on disk), and a
// project can end up with zero eligible "active" chain at all (every chain
// SUPERSEDED — resolveActiveChainVersion() throws in that case). Neither
// scenario should silently skip cleanup.
export async function reconcileSupersededHumanArtifacts(projectRoot: string): Promise<ReconcileResult[]> {
  const results: ReconcileResult[] = [];
  const identity = readProjectIdentity(projectRoot);

  for (const version of listChainVersions(projectRoot)) {
    const chain = readChain(projectRoot, version);
    for (const c of supersededCandidatesForChain(chain)) {
      const title = computeHumanNotionTitle(c.kind, c.version, identity.project_name);
      const res = await deleteNotionPageByTitle(projectRoot, title);
      results.push({ artifactType: c.artifactType, version: c.version, deleted: res.deleted, error: res.error });
    }
  }

  return results;
}
