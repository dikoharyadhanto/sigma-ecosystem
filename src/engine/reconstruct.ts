import fs from 'fs-extra';
import path from 'path';
import { PROJECT_SIGMA_DIR } from '../config';
import {
  ProgressJson,
  ArtifactVersion,
  InvalidMarker,
  createInitialProgress,
  hasActiveLockedIntent,
  hasCleanGate2Chain,
  hasCleanGate3Chain,
  parseMajorVersion,
  parseMinorVersion,
} from './progress';

// `sigma doctor --reconstruct` rebuilds progress.json from the artifact files
// still on disk. Lock state is never written into those files (see the "Lock
// State: Managed by Sigma CLI via progress.json" banner in every template) —
// only the CLI's own gate checks ever proved a version was genuinely LOCKED,
// and those checks are enforced at artifact-creation time. So the one thing
// reconstruct can trust is: a downstream artifact could only have been
// created if its prerequisite was really LOCKED at that moment (creation is
// gated on tracker state, not just the gate flag — see plan.ts/exec.ts/close.ts).
// Whatever cannot be proven this way is left DRAFT and flagged INVALID rather
// than guessed, matching the existing INVALID-recovery philosophy already
// used by `sigma doctor`.

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

const PATTERNS: Record<Domain, { dir: string; regex: RegExp; docType: string }> = {
  intent: { dir: 'design', regex: /^DIR-INTENT-(v\d+)\.md$/, docType: 'DIR_INTENT' },
  roadmap: { dir: 'build', regex: /^ROADMAP-(v\d+)\.md$/, docType: 'ROADMAP' },
  plan: { dir: 'build', regex: /^FMN-PLAN-(v\d+\.\d+)\.md$/, docType: 'FMN_PLAN' },
  exec: { dir: 'build', regex: /^DEV-EXEC-(v\d+\.\d+)\.md$/, docType: 'DEV_EXEC' },
  close: { dir: 'close', regex: /^DIR-CLOSE-(v\d+)\.md$/, docType: 'DIR_CLOSE' },
};

function readDocType(absPath: string): string | null {
  const head = fs.readFileSync(absPath, 'utf8').slice(0, 200);
  const match = head.match(/<!--\s*SIGMA:DOC\s+type=(\S+)/);
  return match ? match[1] : null;
}

export function discoverArtifacts(projectRoot: string): DiscoveredArtifacts {
  const found: DiscoveredArtifacts = { intent: [], roadmap: [], plan: [], exec: [], close: [], skipped: [] };

  for (const domain of Object.keys(PATTERNS) as Domain[]) {
    const { dir, regex, docType } = PATTERNS[domain];
    const absDir = path.join(projectRoot, PROJECT_SIGMA_DIR, dir);
    if (!fs.existsSync(absDir)) continue;

    for (const filename of fs.readdirSync(absDir)) {
      const match = filename.match(regex);
      if (!match) continue;

      const relFile = path.join(PROJECT_SIGMA_DIR, dir, filename);
      const absFile = path.join(absDir, filename);
      const actualType = readDocType(absFile);
      if (actualType !== docType) {
        found.skipped.push(`${relFile} (expected SIGMA:DOC type=${docType}, found "${actualType ?? 'none'}")`);
        continue;
      }

      found[domain].push({ version: match[1], file: relFile });
    }
  }

  return found;
}

function sortByMajor<T extends { version: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => parseMajorVersion(a.version) - parseMajorVersion(b.version));
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

export interface ReconstructResult {
  data: ProgressJson;
  notes: string[];
}

export function buildReconstructedProgress(
  found: DiscoveredArtifacts,
  projectId: string,
  projectName: string,
): ReconstructResult {
  const now = new Date().toISOString();
  const notes: string[] = found.skipped.map(f => `Skipped ${f} — filename matched a known artifact pattern but the SIGMA:DOC marker did not match.`);
  const markers: InvalidMarker[] = [];

  const data = createInitialProgress(projectId, projectName);
  markerSeq = 0;

  // ── INTENT ──────────────────────────────────────────────────────────────────
  const intents = sortByMajor(found.intent);
  const planMajors = new Set(found.plan.map(p => parseMajorVersion(p.version)));
  const roadmapMajors = new Set(found.roadmap.map(r => parseMajorVersion(r.version)));

  intents.forEach((entry, i) => {
    const major = parseMajorVersion(entry.version);
    const isHighest = i === intents.length - 1;
    const version: ArtifactVersion = { version: entry.version, file: entry.file, created_at: now, updated_at: now, state: 'DRAFT' };

    if (!isHighest) {
      version.state = 'SUPERSEDED';
      version.superseded_by = intents[i + 1].version;
    } else if (planMajors.has(major - 1) || roadmapMajors.has(major)) {
      version.state = 'LOCKED';
      version.locked_at = now;
    } else {
      markers.push(makeMarker(
        'intent', 'gate_1_open',
        `DIR-INTENT ${entry.version} found on disk but no downstream FMN-PLAN or ROADMAP confirms it was ever LOCKED. Re-run \`sigma intent lock\` if it should be, or leave as DRAFT.`,
        { intent_version: entry.version, plan_version: null, exec_version: null },
        now,
      ));
    }
    data.intent.versions.push(version);
  });

  if (intents.length > 0) {
    const last = data.intent.versions[data.intent.versions.length - 1];
    data.intent.active_version = last.version;
    data.intent.active_state = last.state;
  }

  const activeIntentVersion = data.intent.active_version;

  // ── ROADMAP ─────────────────────────────────────────────────────────────────
  const roadmaps = sortByMajor(found.roadmap);
  roadmaps.forEach((entry, i) => {
    const major = parseMajorVersion(entry.version);
    const isHighest = i === roadmaps.length - 1;
    const version: ArtifactVersion = {
      version: entry.version, file: entry.file, created_at: now, updated_at: now,
      state: isHighest ? 'ACTIVE' : 'INACTIVE',
      intent_version_ref: entry.version,
    };
    if (!intents.some(iv => parseMajorVersion(iv.version) === major)) {
      markers.push(makeMarker(
        'roadmap', undefined,
        `ROADMAP ${entry.version} references INTENT ${entry.version} which was not found on disk.`,
        { intent_version: entry.version, plan_version: null, exec_version: null },
        now,
      ));
    }
    data.roadmap.versions.push(version);
  });
  if (roadmaps.length > 0) {
    const activeRoadmap = data.roadmap.versions.find(v => v.state === 'ACTIVE');
    data.roadmap.active_version = activeRoadmap!.version;
    data.roadmap.active_state = activeRoadmap!.state;
  }

  // ── PLAN + EXEC ─────────────────────────────────────────────────────────────
  const planGroups = groupByMajor(found.plan);
  const execGroups = groupByMajor(found.exec);
  const allMajors = new Set([...planGroups.keys(), ...execGroups.keys()]);

  for (const major of allMajors) {
    const plans = planGroups.get(major) ?? [];
    const execs = execGroups.get(major) ?? [];
    const intentRef = `v${major + 1}`;
    const intentExists = intents.some(iv => iv.version === intentRef);
    const staleIntent = intentRef !== activeIntentVersion;

    if (plans.length === 1 && execs.length <= 1) {
      const plan = plans[0];
      const planLocked = execs.length === 1;
      const planEntry: ArtifactVersion = {
        version: plan.version, file: plan.file, created_at: now, updated_at: now,
        state: planLocked ? 'LOCKED' : 'DRAFT',
        intent_version_ref: intentRef,
      };
      if (planLocked) planEntry.locked_at = now;
      if (staleIntent) planEntry.stale_intent = true;
      if (!intentExists) {
        markers.push(makeMarker(
          'plan', 'gate_2_open',
          `FMN-PLAN ${plan.version} references missing INTENT ${intentRef}.`,
          { intent_version: intentRef, plan_version: plan.version, exec_version: null },
          now,
        ));
      }
      if (!planLocked) {
        markers.push(makeMarker(
          'plan', 'gate_2_open',
          `FMN-PLAN ${plan.version} found on disk but no downstream DEV-EXEC confirms it was ever LOCKED. Re-run \`sigma plan lock\` if it should be, or leave as DRAFT.`,
          { intent_version: intentRef, plan_version: plan.version, exec_version: null },
          now,
        ));
      }
      data.plan.versions.push(planEntry);

      if (execs.length === 1) {
        const exec = execs[0];
        const execEntry: ArtifactVersion = {
          version: exec.version, file: exec.file, created_at: now, updated_at: now,
          state: 'LOCKED', locked_at: now, plan_version_ref: plan.version,
        };
        if (staleIntent) execEntry.stale_intent = true;
        data.exec.versions.push(execEntry);
      }
    } else {
      // Ambiguous group: multiple PLAN drafts and/or multiple EXEC versions
      // under the same major. Filenames alone cannot prove which PLAN a
      // given EXEC targets, so nothing here is guessed — everything is left
      // DRAFT and flagged for Director review.
      for (const plan of plans) {
        const planEntry: ArtifactVersion = {
          version: plan.version, file: plan.file, created_at: now, updated_at: now,
          state: 'DRAFT', intent_version_ref: intentRef,
        };
        if (staleIntent) planEntry.stale_intent = true;
        data.plan.versions.push(planEntry);
      }
      for (const exec of execs) {
        const execEntry: ArtifactVersion = {
          version: exec.version, file: exec.file, created_at: now, updated_at: now, state: 'DRAFT',
        };
        if (staleIntent) execEntry.stale_intent = true;
        data.exec.versions.push(execEntry);
      }
      markers.push(makeMarker(
        'plan', 'gate_2_open',
        `Multiple FMN-PLAN/DEV-EXEC versions found under major v${major} (${plans.map(p => p.version).join(', ') || 'none'} / ${execs.map(e => e.version).join(', ') || 'none'}). Automatic reconstruct cannot safely pair them — verify manually and use \`sigma plan lock\` / \`sigma exec lock\` / \`sigma plan supersede\` as needed.`,
        { intent_version: intentRef, plan_version: null, exec_version: null },
        now,
      ));
    }
  }

  if (data.plan.versions.length > 0) {
    const last = sortByMajorMinor(data.plan.versions).pop()!;
    const active = data.plan.versions.find(v => v.version === last.version)!;
    data.plan.active_version = active.version;
    data.plan.active_state = active.state;
  }
  if (data.exec.versions.length > 0) {
    const last = sortByMajorMinor(data.exec.versions).pop()!;
    const active = data.exec.versions.find(v => v.version === last.version)!;
    data.exec.active_version = active.version;
    data.exec.active_state = active.state;
  }

  // ── CLOSE ───────────────────────────────────────────────────────────────────
  const closes = sortByMajor(found.close);
  closes.forEach((entry, i) => {
    const isHighest = i === closes.length - 1;
    const version: ArtifactVersion = { version: entry.version, file: entry.file, created_at: now, updated_at: now, state: 'DRAFT' };
    if (!isHighest) {
      version.state = 'SUPERSEDED';
      version.superseded_by = closes[i + 1].version;
    } else {
      // Closing is a terminal step with no further downstream artifact —
      // its LOCKED state can never be proven from disk alone. Default to
      // DRAFT (project stays open) rather than risk a false CLOSED claim.
      markers.push(makeMarker(
        'close', undefined,
        `DIR-CLOSE ${entry.version} found on disk but closure cannot be confirmed as LOCKED from artifact files alone. Re-run \`sigma close lock\` if this project should be CLOSED.`,
        { intent_version: null, plan_version: null, exec_version: null },
        now,
      ));
    }
    data.close.versions.push(version);
  });
  if (closes.length > 0) {
    const last = data.close.versions[data.close.versions.length - 1];
    data.close.active_version = last.version;
    data.close.active_state = last.state;
  }

  // ── Lifecycle + gates ─────────────────────────────────────────────────────────
  const hasAnyBuildArtifact = data.plan.versions.length > 0 || data.exec.versions.length > 0 || data.roadmap.versions.length > 0 || data.close.versions.length > 0;
  data.lifecycle_state = hasAnyBuildArtifact || hasActiveLockedIntent(data) ? 'BUILD' : 'DESIGN';

  data.gates.gate_1_open = hasActiveLockedIntent(data);
  data.gates.gate_2_open = hasCleanGate2Chain(data);
  data.gates.gate_3_satisfied = hasCleanGate3Chain(data);

  data.runtime_invalid = { markers, last_doctor_run_at: now };

  return { data, notes };
}

export function reconstructProgress(projectRoot: string, projectId: string, projectName: string): ReconstructResult {
  const found = discoverArtifacts(projectRoot);
  return buildReconstructedProgress(found, projectId, projectName);
}

// `findProjectRoot()` (utils/fs.ts) anchors on Sigma/progress.json existing —
// which is exactly what may be missing in the scenario --reconstruct exists
// for. This anchors on the Sigma/ directory itself instead.
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
