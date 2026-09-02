import fs from 'fs-extra';
import path from 'path';
import { PROJECT_SIGMA_DIR } from '../config';
import { toPosix } from '../utils/fs';
import {
  ChainState,
  ArtifactVersion,
  InvalidMarker,
  SingleRoadmapState,
  SingleCloseState,
  createInitialChain,
  runDoctorReconciliation,
  parseMajorVersion,
  parseMinorVersion,
  chainFilePath,
  readChain,
  validateChainSemantics,
} from './chain';

// PLAN-EVAL-05 — `sigma doctor --reconstruct` rebuilds progress-v<N>.json
// chain files from the artifact files still on disk. Lock state is never
// written into those files (see the "Lock State: Managed by Sigma CLI via
// progress.json" banner in every template) — only the CLI's own gate checks
// ever proved a version was genuinely LOCKED, and those checks are enforced
// at artifact-creation time. So the one thing reconstruct can trust is: a
// downstream artifact could only have been created if its prerequisite was
// really LOCKED at that moment (creation is gated on tracker state, not just
// the gate flag — see plan.ts/exec.ts/close.ts). Whatever cannot be proven
// this way is left DRAFT and flagged INVALID rather than guessed, matching
// the existing INVALID-recovery philosophy already used by `sigma doctor`.
//
// Each major version found on disk (one DIR-INTENT-vN.md) is evaluated
// independently — there is no "highest version wins" demotion anymore
// (unlike the pre-PLAN-EVAL-05 single-ProgressJson algorithm). Under Opsi C,
// `intent new` may be run at any time regardless of whether the previous
// chain is RATIFIED/DRAFT (DISCUSSION "Konsolidasi Lanjutan" bagian 3), so two
// RATIFIED intents living side by side in separate chain files is a normal,
// valid state — not corruption to arbitrate between.

interface FoundArtifact {
  version: string;
  file: string;
}

interface DiscoveredArtifacts {
  intent: FoundArtifact[];
  roadmap: FoundArtifact[];
  plan: FoundArtifact[];
  exec: FoundArtifact[];
  close: FoundArtifact[];
  skipped: string[];
}

type Domain = 'intent' | 'roadmap' | 'plan' | 'exec' | 'close';

// PLAN-IMPL-SIGMA-ARTIFACT-FOLDER-RENAME-20260816 — `dirs` (plural, new name
// first) instead of a single `dir`. Reconstruct has no stored entry.file to
// fall back on (that is precisely the state it exists to rebuild), so
// unlike intent.ts/plan.ts/exec.ts/roadmap.ts it cannot rely on the
// stored-path-wins mechanism for backward compatibility — it has to
// actually look in both the old and new folder for a project it doesn't
// yet know the age of.
const PATTERNS: Record<Domain, { dirs: string[]; regex: RegExp; docType: string }> = {
  intent: { dirs: ['charter', 'design'], regex: /^DIR-INTENT-(v\d+)\.md$/, docType: 'DIR_INTENT' },
  roadmap: { dirs: ['roadmap', 'build'], regex: /^ROADMAP-(v\d+)\.md$/, docType: 'ROADMAP' },
  plan: { dirs: ['contract', 'build'], regex: /^FMN-PLAN-(v\d+\.\d+)\.md$/, docType: 'FMN_PLAN' },
  exec: { dirs: ['evidence', 'build'], regex: /^DEV-EXEC-(v\d+\.\d+)\.md$/, docType: 'DEV_EXEC' },
  close: { dirs: ['close'], regex: /^DIR-CLOSE-(v\d+)\.md$/, docType: 'DIR_CLOSE' },
};

function readDocType(absPath: string): string | null {
  const head = fs.readFileSync(absPath, 'utf8').slice(0, 200);
  const match = head.match(/<!--\s*SIGMA:DOC\s+type=(\S+)/);
  return match ? match[1] : null;
}

export function discoverArtifacts(projectRoot: string): DiscoveredArtifacts {
  const found: DiscoveredArtifacts = { intent: [], roadmap: [], plan: [], exec: [], close: [], skipped: [] };

  for (const domain of Object.keys(PATTERNS) as Domain[]) {
    const { dirs, regex, docType } = PATTERNS[domain];
    for (const dir of dirs) {
      const absDir = path.join(projectRoot, PROJECT_SIGMA_DIR, dir);
      if (!fs.existsSync(absDir)) continue;

      for (const filename of fs.readdirSync(absDir)) {
        const match = filename.match(regex);
        if (!match) continue;

        const relFile = toPosix(path.join(PROJECT_SIGMA_DIR, dir, filename));
        const absFile = path.join(absDir, filename);
        const actualType = readDocType(absFile);
        if (actualType !== docType) {
          found.skipped.push(`${relFile} (expected SIGMA:DOC type=${docType}, found "${actualType ?? 'none'}")`);
          continue;
        }

        found[domain].push({ version: match[1], file: relFile });
      }
    }
  }

  return found;
}

function sortByMajorMinor<T extends { version: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const majorDiff = parseMajorVersion(a.version) - parseMajorVersion(b.version);
    if (majorDiff !== 0) return majorDiff;
    return parseMinorVersion(a.version) - parseMinorVersion(b.version);
  });
}

function groupByMajor(entries: FoundArtifact[]): Map<number, FoundArtifact[]> {
  const groups = new Map<number, FoundArtifact[]>();
  for (const entry of sortByMajorMinor(entries)) {
    const major = parseMajorVersion(entry.version);
    const list = groups.get(major) ?? [];
    list.push(entry);
    groups.set(major, list);
  }
  return groups;
}

let markerSeq = 0;
function makeMarker(
  domain: InvalidMarker['domain'],
  gate: InvalidMarker['gate'],
  reason: string,
  chain: InvalidMarker['chain'],
  now: string,
): InvalidMarker {
  markerSeq += 1;
  return {
    id: `reconstruct:${domain}:${markerSeq}`,
    domain,
    status: 'INVALID',
    reason,
    gate,
    chain,
    first_detected_at: now,
    last_detected_at: now,
  };
}

// ── Multi-chain grouping + build ────────────────────────────────────────────

export interface ReconstructedChain {
  chainVersion: string;
  data: ChainState;
}

// A major version with build artifacts (roadmap/plan/exec/close) on disk but
// no matching DIR-INTENT-vN.md. Cannot be represented as a ChainState at all
// — `ChainState.intent` is non-nullable by construction (a chain file only
// ever exists because `intent new` created it, PLAN-EVAL-01 §3.2). Reported,
// never guessed into existence.
export interface UnresolvedGroup {
  major: number;
  artifacts: string[];
}

export interface MultiReconstructResult {
  chains: Map<number, ReconstructedChain>;
  unresolved: UnresolvedGroup[];
  skipped: string[];
}

// PLAN-EVAL-06 §6 — Sigma/design/intent-history.md is the only place `title`/`focus`
// persist outside progress-v<N>.json (DIR-INTENT templates never carry them). If it
// survived whatever wiped/corrupted the chain file, read it back instead of losing
// the data. Deliberately a plain pipe-split, not a markdown table parser — this is
// why `sigma intent new --title/--focus` rejects literal "|" and newlines (see
// intent.ts): keeping the row format this simple is what makes lossless parse-back
// cheap. Keep in sync with generateIntentHistoryContent() in utils/intentHistory.ts
// if the column shape ever changes — deliberately not shared code, so engine/ does
// not depend on utils/ (see PLAN-EVAL-06 §6.1).
//
// closure-authority PLAN-EVAL-02 — table grew from 5 to 7 data columns (added
// Score, Notes for the ARC Satisfaction Score). Threshold deliberately kept at
// 6, not raised to 8: only the first 4 elements (index 0 empty +
// version/title/focus) are ever read below, so a pre-PLAN-EVAL-02 5-column row
// (7 elements) and a current 7-column row (9 elements) both recover cleanly —
// title/focus recovery for projects with an older intent-history.md is
// preserved, not silently broken by the later column addition
// (test-suite-debt PLAN-EVAL-01, 2026-07-21).
function readIntentHistoryMetadata(projectRoot: string): Map<string, { title?: string; focus?: string }> {
  // Folder-rename dual-lookup, same reasoning as PATTERNS above — reconstruct
  // does not know in advance whether this project predates the rename.
  const candidates = [
    path.join(projectRoot, PROJECT_SIGMA_DIR, 'charter', 'intent-history.md'),
    path.join(projectRoot, PROJECT_SIGMA_DIR, 'design', 'intent-history.md'),
  ];
  const filePath = candidates.find(p => fs.existsSync(p));
  const result = new Map<string, { title?: string; focus?: string }>();
  if (!filePath) return result;

  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const cells = line.split('|').map(c => c.trim());
    // 6 accepts both table shapes — pre-PLAN-EVAL-02 5-column rows (7 elements)
    // and current 7-column rows with Score/Notes (9 elements) — since only the
    // first 4 elements (empty + version/title/focus) are ever read below.
    if (cells.length < 6) continue;
    const [, version, title, focus] = cells;
    if (!/^v\d+$/.test(version)) continue; // skips header row + the `:---` separator row
    result.set(version, {
      title: title && title !== 'TBD' ? title : undefined,
      focus: focus && focus !== 'TBD' ? focus : undefined,
    });
  }
  return result;
}

// PLAN-EVAL-07 — before treating a chain as "missing/corrupted, rebuild
// blind from disk" (the scenario --reconstruct exists for), check whether
// its progress-v<N>.json is actually still there and valid. A blind rebuild
// cannot prove LOCKED history for plan/exec (filenames alone are not
// enough — see the "ambiguous group" branch below) and never carries PLAN
// title/focus at all; a chain file that's still valid is strictly more
// trustworthy for both than guessing from disk. Corrupted/missing files
// fall through to `null` here, which keeps today's blind-reconstruct
// behavior exactly as before — this only ever adds trust, never removes it.
function readExistingChain(projectRoot: string, chainVersion: string): ChainState | null {
  const filePath = chainFilePath(projectRoot, chainVersion);
  if (!fs.existsSync(filePath)) return null;
  try {
    // Goes through readChain() rather than a raw fs.readJsonSync() so a
    // legacy chain file still carrying intent.state "LOCKED" (pre-RATIFIED
    // rename, Director directive 2026-08-12) gets normalized before
    // validateChainSemantics() sees it — otherwise gate_1_open=true with a
    // literal "LOCKED" intent fails hasRatifiedIntent() and this function
    // silently returns null, discarding real plan/exec title/focus history
    // that PLAN-EVAL-07 exists specifically to preserve.
    const chain = readChain(projectRoot, chainVersion);
    validateChainSemantics(chain);
    return chain;
  } catch {
    return null;
  }
}

// Wholesale-trust the existing chain's plan/exec/roadmap/close only when the
// artifact file set discovered on disk for this chain is *exactly* the same
// as what the existing chain already references — nothing added, nothing
// removed since it was last written. If a new artifact appeared (e.g. a
// fresh `plan new`) or one vanished, the safer choice is to fall back to
// today's blind rebuild for this chain rather than risk mixing stale and
// fresh state — title/focus recovery (extractPlanMetadata below) still
// applies independently in that fallback path.
// `file` fields are written with path.join(), so they carry native OS
// separators — normalize before comparing so a chain file written on one
// separator convention still compares equal (defensive; also keeps the
// comparison stable regardless of how a given `file` string was produced).
function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, '/');
}

function referencedFileSet(chain: ChainState): Set<string> {
  const files: (string | undefined)[] = [
    chain.roadmap?.file,
    chain.close?.file,
    ...chain.plan.versions.map(v => v.file),
    ...chain.exec.versions.map(v => v.file),
  ];
  return new Set(files.filter((f): f is string => !!f).map(normalizeSlashes));
}

function sameFileSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const f of a) if (!b.has(f)) return false;
  return true;
}

// PLAN title/focus recovery — independent of the wholesale-trust fast path
// above, applies even when this chain still needs a blind rebuild (e.g. an
// ambiguous PLAN/EXEC pairing). Keyed by PLAN version since that's the only
// domain that ever carries title/focus in practice (EXEC never sets them).
function extractPlanMetadata(chain: ChainState | null): Map<string, { title?: string; focus?: string }> {
  const result = new Map<string, { title?: string; focus?: string }>();
  if (!chain) return result;
  for (const v of chain.plan.versions) {
    if (v.title || v.focus) result.set(v.version, { title: v.title, focus: v.focus });
  }
  return result;
}

export function buildReconstructedChains(
  projectRoot: string,
  found: DiscoveredArtifacts,
  recoveredMetadata: Map<string, { title?: string; focus?: string }> = new Map(),
): MultiReconstructResult {
  const now = new Date().toISOString();
  markerSeq = 0;

  const intentsByMajor = new Map<number, FoundArtifact>();
  for (const entry of found.intent) intentsByMajor.set(parseMajorVersion(entry.version), entry);

  const roadmapsByMajor = new Map<number, FoundArtifact>();
  for (const entry of found.roadmap) roadmapsByMajor.set(parseMajorVersion(entry.version), entry);

  const closesByMajor = new Map<number, FoundArtifact>();
  for (const entry of found.close) closesByMajor.set(parseMajorVersion(entry.version), entry);

  // Plan/exec major = intent major − 1 (invariant confirmed never to
  // collide across chains — DISCUSSION "Konsolidasi Lanjutan" bagian 7).
  const planGroups = groupByMajor(found.plan);
  const execGroups = groupByMajor(found.exec);

  const allMajors = new Set<number>();
  for (const m of intentsByMajor.keys()) allMajors.add(m);
  for (const m of roadmapsByMajor.keys()) allMajors.add(m);
  for (const m of closesByMajor.keys()) allMajors.add(m);
  for (const planMajor of planGroups.keys()) allMajors.add(planMajor + 1);
  for (const execMajor of execGroups.keys()) allMajors.add(execMajor + 1);

  const chains = new Map<number, ReconstructedChain>();
  const unresolved: UnresolvedGroup[] = [];

  for (const major of [...allMajors].sort((a, b) => a - b)) {
    const intentEntry = intentsByMajor.get(major);
    const planMajor = major - 1;
    const plans = planGroups.get(planMajor) ?? [];
    const execs = execGroups.get(planMajor) ?? [];
    const roadmapEntry = roadmapsByMajor.get(major);
    const closeEntry = closesByMajor.get(major);

    if (!intentEntry) {
      const artifacts: string[] = [];
      if (roadmapEntry) artifacts.push(roadmapEntry.file);
      if (closeEntry) artifacts.push(closeEntry.file);
      for (const p of plans) artifacts.push(p.file);
      for (const e of execs) artifacts.push(e.file);
      unresolved.push({ major, artifacts });
      continue;
    }

    const chainVersion = `v${major}`;
    const markers: InvalidMarker[] = [];
    const recovered = recoveredMetadata.get(chainVersion) ?? {};
    const chain = createInitialChain(chainVersion, intentEntry.file, recovered.title, recovered.focus);
    chain.created_at = now;
    chain.updated_at = now;

    // PLAN-EVAL-07 — trust an existing, still-valid progress-v<N>.json's
    // plan/exec/roadmap/close wholesale instead of rebuilding them blind,
    // but only when the artifact file set on disk for this chain exactly
    // matches what it already references (nothing added/removed since it
    // was last written). See readExistingChain()/sameFileSet() above for
    // why: filenames alone cannot prove LOCKED history or carry PLAN
    // title/focus, but a still-valid existing file already proved both
    // once — rebuilding from scratch anyway just discards that. INTENT
    // state is deliberately excluded from this trust (stays computed fresh
    // below) — it's already provable from downstream evidence either way.
    const existingChain = readExistingChain(projectRoot, chainVersion);
    const discoveredFiles = new Set<string>([
      ...(roadmapEntry ? [roadmapEntry.file] : []),
      ...(closeEntry ? [closeEntry.file] : []),
      ...plans.map(p => p.file),
      ...execs.map(e => e.file),
    ].map(normalizeSlashes));
    const useExistingWholesale = !!existingChain && sameFileSet(referencedFileSet(existingChain), discoveredFiles);
    const existingPlanMetadata = extractPlanMetadata(existingChain);

    // ── INTENT ──────────────────────────────────────────────────────────────
    const hasDownstreamEvidence = plans.length > 0 || !!roadmapEntry;
    if (hasDownstreamEvidence) {
      chain.intent.state = 'RATIFIED';
      chain.intent.ratified_at = now;
    } else {
      markers.push(makeMarker(
        'intent', 'gate_1_open',
        `DIR-INTENT ${chainVersion} found on disk but no downstream FMN-PLAN or ROADMAP confirms it was ever RATIFIED. Re-run \`sigma intent ratify\` if it should be, or leave as DRAFT.`,
        { intent_version: chainVersion, plan_version: null, exec_version: null },
        now,
      ));
    }

    if (useExistingWholesale) {
      // PLAN-EVAL-07 — nothing changed on disk since this chain's existing
      // file was last written and it's still valid: reuse its roadmap/plan/
      // exec/close as-is rather than rebuilding (and potentially discarding
      // real LOCKED history / title/focus) from filenames alone.
      chain.roadmap = existingChain!.roadmap;
      chain.plan = existingChain!.plan;
      chain.exec = existingChain!.exec;
      chain.close = existingChain!.close;
    } else {
      // ── ROADMAP ───────────────────────────────────────────────────────────
      if (roadmapEntry) {
        const roadmap: SingleRoadmapState = {
          version: chainVersion, state: closeEntry ? 'LOCKED' : 'DRAFT',
          file: roadmapEntry.file, created_at: now, updated_at: now,
        };
        if (closeEntry) roadmap.locked_at = now;
        chain.roadmap = roadmap;
      }

      // ── PLAN + EXEC ───────────────────────────────────────────────────────
      if (plans.length === 1 && execs.length <= 1) {
        const plan = plans[0];
        const planLocked = execs.length === 1;
        const planEntry: ArtifactVersion = {
          version: plan.version, file: plan.file, created_at: now, updated_at: now,
          state: planLocked ? 'LOCKED' : 'DRAFT',
          intent_version_ref: chainVersion,
        };
        if (planLocked) planEntry.locked_at = now;
        // PLAN-EVAL-07 — recover title/focus from the existing chain file
        // (if any) even on this blind-rebuild path; state/pairing logic
        // above is unchanged, this only plugs the metadata that filenames
        // alone could never carry in the first place.
        const recoveredPlanMeta = existingPlanMetadata.get(plan.version);
        if (recoveredPlanMeta?.title) planEntry.title = recoveredPlanMeta.title;
        if (recoveredPlanMeta?.focus) planEntry.focus = recoveredPlanMeta.focus;
        if (!planLocked) {
          markers.push(makeMarker(
            'plan', 'gate_2_open',
            `FMN-PLAN ${plan.version} found on disk but no downstream DEV-EXEC confirms it was ever LOCKED. Re-run \`sigma plan lock\` if it should be, or leave as DRAFT.`,
            { intent_version: chainVersion, plan_version: plan.version, exec_version: null },
            now,
          ));
        }
        chain.plan.versions.push(planEntry);

        if (execs.length === 1) {
          const exec = execs[0];
          chain.exec.versions.push({
            version: exec.version, file: exec.file, created_at: now, updated_at: now,
            state: 'LOCKED', locked_at: now, plan_version_ref: plan.version,
          });
        }
      } else if (plans.length > 0 || execs.length > 0) {
        // Ambiguous group: multiple PLAN drafts and/or multiple EXEC versions
        // under the same major. Filenames alone cannot prove which PLAN a
        // given EXEC targets, so nothing here is guessed — everything is left
        // DRAFT and flagged for Director review.
        for (const plan of plans) {
          const entry: ArtifactVersion = {
            version: plan.version, file: plan.file, created_at: now, updated_at: now,
            state: 'DRAFT', intent_version_ref: chainVersion,
          };
          const recoveredPlanMeta = existingPlanMetadata.get(plan.version);
          if (recoveredPlanMeta?.title) entry.title = recoveredPlanMeta.title;
          if (recoveredPlanMeta?.focus) entry.focus = recoveredPlanMeta.focus;
          chain.plan.versions.push(entry);
        }
        for (const exec of execs) {
          chain.exec.versions.push({
            version: exec.version, file: exec.file, created_at: now, updated_at: now, state: 'DRAFT',
          });
        }
        markers.push(makeMarker(
          'plan', 'gate_2_open',
          `Multiple FMN-PLAN/DEV-EXEC versions found under major v${planMajor} (${plans.map(p => p.version).join(', ') || 'none'} / ${execs.map(e => e.version).join(', ') || 'none'}). Automatic reconstruct cannot safely pair them — verify manually and use \`sigma plan lock\` / \`sigma exec lock\` / \`sigma plan supersede\` as needed.`,
          { intent_version: chainVersion, plan_version: null, exec_version: null },
          now,
        ));
      }

      if (chain.plan.versions.length > 0) {
        const last = sortByMajorMinor(chain.plan.versions).pop()!;
        chain.plan.active_version = last.version;
        chain.plan.active_state = last.state;
      }
      if (chain.exec.versions.length > 0) {
        const last = sortByMajorMinor(chain.exec.versions).pop()!;
        chain.exec.active_version = last.version;
        chain.exec.active_state = last.state;
      }

      // ── CLOSE ─────────────────────────────────────────────────────────────
      if (closeEntry) {
        const close: SingleCloseState = {
          version: chainVersion, state: 'DRAFT', file: closeEntry.file, created_at: now, updated_at: now,
        };
        chain.close = close;
        // Closing is a terminal step with no further downstream artifact — its
        // LOCKED state can never be proven from disk alone. Default to DRAFT
        // (project stays open) rather than risk a false CLOSED claim.
        markers.push(makeMarker(
          'close', undefined,
          `DIR-CLOSE ${chainVersion} found on disk but closure cannot be confirmed as LOCKED from artifact files alone. Re-run \`sigma close lock\` if this project should be CLOSED.`,
          { intent_version: null, plan_version: null, exec_version: null },
          now,
        ));
      }
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    const hasAnyBuildArtifact = chain.roadmap !== null || chain.plan.versions.length > 0 || chain.exec.versions.length > 0 || chain.close !== null;
    chain.lifecycle_state = hasAnyBuildArtifact || chain.intent.state === 'RATIFIED' ? 'BUILD' : 'DESIGN';

    // Gates + structural consistency markers are computed by the exact same
    // function `sigma doctor` (default mode) already uses — avoids
    // duplicating gate logic in two places that would need to stay in sync.
    // It fully replaces runtime_invalid.markers with its own structural
    // findings, so the "unprovable-lock" markers collected above are merged
    // back in afterward rather than overwritten.
    chain.runtime_invalid = { markers: [], last_doctor_run_at: null };
    runDoctorReconciliation(chain, []);
    chain.runtime_invalid!.markers = [...markers, ...chain.runtime_invalid!.markers];

    chains.set(major, { chainVersion, data: chain });
  }

  return { chains, unresolved, skipped: [...found.skipped] };
}

export function reconstructAllChains(projectRoot: string): MultiReconstructResult {
  const found = discoverArtifacts(projectRoot);
  const recoveredMetadata = readIntentHistoryMetadata(projectRoot);
  return buildReconstructedChains(projectRoot, found, recoveredMetadata);
}

// `findProjectRoot()` (utils/fs.ts) anchors on Sigma/activate_status.json
// existing — which is exactly what may be missing in the scenario
// --reconstruct exists for. This anchors on the Sigma/ directory itself
// instead.
export function findSigmaProjectRoot(startDir: string = process.cwd()): string {
  let current = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(current, PROJECT_SIGMA_DIR))) return current;

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(
        'Not inside a Sigma project. No Sigma/ directory found in this directory or any parent.'
      );
    }
    current = parent;
  }
}
