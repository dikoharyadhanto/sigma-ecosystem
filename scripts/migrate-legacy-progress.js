#!/usr/bin/env node
'use strict';

/**
 * migrate-legacy-progress.js
 *
 * One-time migration: reads a project's legacy Sigma/progress.json
 * (single-file nested schema) and rewrites it as the multi-file
 * Sigma/progress-v<N>.json + Sigma/activate_status.json schema (PLAN-EVAL-01,
 * Opsi C). Not a `sigma` subcommand — this is a one-shot, opt-in tool run
 * directly per project, not a routine CLI operation (see DISCUSSION doc's
 * "no new command namespace" principle).
 *
 * Full design/mapping rules this implements:
 * Implementation/planned_sigma_multichain_progress_2026_07_17/
 * PLAN-EVAL-03-MIGRATION-AND-JLH-CUTOVER.md (§10).
 *
 * Usage:
 *   node scripts/migrate-legacy-progress.js <projectRoot> [options]
 *
 * Options:
 *   --dry-run                    Print the resulting chain files without writing.
 *                                 This is the default whenever --confirm is absent.
 *   --confirm                    Actually write progress-v<N>.json + activate_status.json.
 *   --treat-locked=v1,v2         Chain versions whose legacy intent.state is
 *                                SUPERSEDED/INACTIVE but should be treated as a
 *                                genuine standalone LOCKED chain — old Sigma
 *                                versions auto-marked the previous intent
 *                                SUPERSEDED/INACTIVE on every newer intent,
 *                                regardless of whether that was ever a real
 *                                Director decision (PLAN-EVAL-03 §10.1). The
 *                                script refuses to proceed on any
 *                                SUPERSEDED/INACTIVE entry not covered by this
 *                                or --treat-superseded below — no silent default.
 *   --treat-superseded=v1        Chain versions whose legacy SUPERSEDED/INACTIVE
 *                                marking should be kept as a genuine supersede.
 *   --force-plan-state=v1.1=DRAFT,v2.2=SUPERSEDED
 *                                Override specific PLAN entries' resulting state
 *                                (comma-separated version=STATE pairs) — for legacy
 *                                bookkeeping that doesn't reflect reality (e.g. an
 *                                entry marked LOCKED that isn't actually finished).
 *   --force-exec-state=v1.1=DRAFT
 *                                Same as --force-plan-state, for EXEC entries.
 *
 * Prerequisite: npm run build  (dist/engine/chain.js and dist/config.js must exist)
 */

const fs = require('fs-extra');
const path = require('path');
const {
  writeChain,
  writeActivateStatus,
  validateChainSemantics,
  hasActiveLockedIntent,
  hasCleanGate2Chain,
  hasCleanGate3Chain,
} = require('../dist/engine/chain');
const { SCHEMA_VERSION, PROJECT_SIGMA_DIR } = require('../dist/config');

function die(message) {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

function parseMajor(version) {
  const m = /^v(\d+)/.exec(version);
  if (!m) throw new Error(`Cannot parse major version from "${version}"`);
  return parseInt(m[1], 10);
}

function parseMinor(version) {
  const m = /^v\d+(?:\.(\d+))?/.exec(version);
  return m && m[1] ? parseInt(m[1], 10) : 0;
}

function parseKeyValueList(raw) {
  const map = new Map();
  for (const pair of raw.split(',').map(s => s.trim()).filter(Boolean)) {
    const eq = pair.indexOf('=');
    if (eq === -1) die(`Malformed version=STATE pair "${pair}" — expected e.g. "v1.1=DRAFT".`);
    map.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return map;
}

function parseArgs(argv) {
  const args = {
    _: [], treatLocked: [], treatSuperseded: [],
    forcePlanState: new Map(), forceExecState: new Map(),
  };
  for (const raw of argv) {
    if (raw.startsWith('--treat-locked=')) {
      args.treatLocked = raw.slice('--treat-locked='.length).split(',').map(s => s.trim()).filter(Boolean);
    } else if (raw.startsWith('--treat-superseded=')) {
      args.treatSuperseded = raw.slice('--treat-superseded='.length).split(',').map(s => s.trim()).filter(Boolean);
    } else if (raw.startsWith('--force-plan-state=')) {
      args.forcePlanState = parseKeyValueList(raw.slice('--force-plan-state='.length));
    } else if (raw.startsWith('--force-exec-state=')) {
      args.forceExecState = parseKeyValueList(raw.slice('--force-exec-state='.length));
    } else if (raw === '--dry-run') {
      args.dryRun = true;
    } else if (raw === '--confirm') {
      args.confirm = true;
    } else if (raw.startsWith('--')) {
      die(`Unknown option "${raw}".`);
    } else {
      args._.push(raw);
    }
  }
  return args;
}

// Overrides legacy-derived state for specific PLAN/EXEC entries — for
// bookkeeping that doesn't reflect reality (e.g. an entry marked LOCKED that
// isn't actually finished yet). Applied after the normal mapping rules, right
// before gates are (re)computed, so gate booleans always reflect the
// corrected state, never the pre-override one.
function applyForcedStates(tracker, overrides, now) {
  if (!overrides || overrides.size === 0) return;
  for (const entry of tracker.versions) {
    if (!overrides.has(entry.version)) continue;
    const newState = overrides.get(entry.version);
    entry.state = newState;
    entry.updated_at = now;
    delete entry.locked_at;
    delete entry.supersede_reason;
    if (newState === 'LOCKED') {
      entry.locked_at = now;
    } else if (newState === 'SUPERSEDED') {
      entry.supersede_reason = 'Forced via --force-plan-state/--force-exec-state override during migration.';
    } else if (newState !== 'DRAFT') {
      die(`Invalid forced state "${newState}" for ${entry.version} — must be DRAFT, LOCKED, or SUPERSEDED.`);
    }
    if (tracker.active_version === entry.version) {
      tracker.active_state = newState;
    }
  }
}

// ── Chain construction ──────────────────────────────────────────────────────

function buildChains(legacy, treatLocked, treatSuperseded, forcePlanState, forceExecState, now) {
  const intentVersions = (legacy.intent && legacy.intent.versions) || [];
  const roadmapVersions = (legacy.roadmap && legacy.roadmap.versions) || [];
  const planVersions = (legacy.plan && legacy.plan.versions) || [];
  const execVersions = (legacy.exec && legacy.exec.versions) || [];
  const closeVersions = (legacy.close && legacy.close.versions) || [];

  const results = [];
  const errors = [];
  const claimedPlan = new Set();
  const claimedExec = new Set();
  const claimedRoadmap = new Set();
  const claimedClose = new Set();

  for (const intentEntry of intentVersions) {
    const chainVersion = intentEntry.version;

    // ── INTENT ──────────────────────────────────────────────────────────────
    let intentState = intentEntry.state;
    let supersedeReason = intentEntry.supersede_reason;
    if (intentState === 'INACTIVE' || intentState === 'SUPERSEDED') {
      if (treatLocked.includes(chainVersion)) {
        intentState = 'LOCKED';
      } else if (treatSuperseded.includes(chainVersion)) {
        intentState = 'SUPERSEDED';
        if (!supersedeReason) {
          supersedeReason = `Migrated from legacy schema: superseded_by ${JSON.stringify(intentEntry.superseded_by || 'unknown')}; no supersede_reason recorded in legacy data.`;
        }
      } else {
        errors.push(
          `INTENT ${chainVersion} is "${intentEntry.state}" in legacy data — ambiguous, cannot migrate automatically.\n` +
          `  Old Sigma versions auto-marked the previous intent SUPERSEDED/INACTIVE whenever a newer one was locked,\n` +
          `  regardless of whether that was ever a real Director decision (PLAN-EVAL-03 §10.1).\n` +
          `  Re-run with --treat-locked=${chainVersion} if this chain is actually a standalone completed/ongoing\n` +
          `  chain (not really cancelled), or --treat-superseded=${chainVersion} if it really was cancelled.`
        );
        continue;
      }
    } else if (intentState !== 'LOCKED' && intentState !== 'DRAFT') {
      errors.push(`INTENT ${chainVersion} has unrecognized legacy state "${intentEntry.state}".`);
      continue;
    }

    const intent = {
      version: chainVersion,
      state: intentState,
      created_at: intentEntry.created_at || now,
      updated_at: intentEntry.updated_at || now,
    };
    if (intentEntry.file) intent.file = intentEntry.file;
    if (intentState === 'LOCKED') {
      intent.locked_at = intentEntry.locked_at || intentEntry.updated_at || now;
    }
    if (intentState === 'SUPERSEDED') {
      intent.supersede_reason = supersedeReason;
    }
    // superseded_by intentionally dropped — PLAN-EVAL-01 §3.2/§3.4: no
    // cross-chain pointers under total isolation.

    // ── Group everything else under this chain ─────────────────────────────
    const roadmapEntry = roadmapVersions.find(r => r.intent_version_ref === chainVersion);
    if (roadmapEntry) claimedRoadmap.add(roadmapEntry);
    const closeEntry = closeVersions.find(c => c.version === chainVersion);
    if (closeEntry) claimedClose.add(closeEntry);
    const chainPlanEntries = planVersions.filter(p => p.intent_version_ref === chainVersion);
    for (const p of chainPlanEntries) claimedPlan.add(p);
    const chainPlanVersionSet = new Set(chainPlanEntries.map(p => p.version));
    const planMajorForChain = parseMajor(chainVersion) - 1;
    const chainExecEntries = execVersions.filter(e => {
      if (e.plan_version_ref) return chainPlanVersionSet.has(e.plan_version_ref);
      // No plan_version_ref recorded at all (seen in JLH v0.x) — fall back to
      // major-version grouping (plan major = intent major − 1, exec major =
      // plan major, DISCUSSION "Konsolidasi Lanjutan" §7). Safe: planMajorForChain
      // is unique per chain, so this can never double-claim across chains.
      return parseMajor(e.version) === planMajorForChain;
    });
    for (const e of chainExecEntries) claimedExec.add(e);

    // A chain with ANY close entry recorded (regardless of its own legacy
    // state) is treated as genuinely completed — PLAN-EVAL-03 §10.1/§10.3:
    // raw DRAFT/ambiguous state on its own domains may itself be corrupted by
    // the reconstruct.ts bug (PLAN-EVAL-07) or simply never finalized through
    // the lock command, so it is not trusted as-is for a closed chain.
    const isClosedChain = !!closeEntry;

    let roadmap = null;
    const plan = { active_version: null, active_state: null, versions: [], pending: [] };
    const exec = { active_version: null, active_state: null, versions: [] };
    let close = null;

    if (isClosedChain) {
      if (roadmapEntry) {
        roadmap = {
          version: chainVersion, state: 'LOCKED',
          file: roadmapEntry.file, created_at: roadmapEntry.created_at || now, updated_at: now,
          locked_at: now,
        };
      }

      const sortedPlans = [...chainPlanEntries].sort((a, b) => parseMinor(a.version) - parseMinor(b.version));
      for (const p of sortedPlans) {
        const entry = {
          version: p.version, state: 'LOCKED',
          created_at: p.created_at || now, updated_at: now, locked_at: p.locked_at || now,
          intent_version_ref: chainVersion,
        };
        if (p.file) entry.file = p.file;
        if (p.title) entry.title = p.title;
        if (p.focus) entry.focus = p.focus;
        plan.versions.push(entry);
      }
      if (sortedPlans.length > 0) {
        plan.active_version = sortedPlans[sortedPlans.length - 1].version;
        plan.active_state = 'LOCKED';
      }

      const sortedExecs = [...chainExecEntries].sort((a, b) => parseMinor(a.version) - parseMinor(b.version));
      for (const e of sortedExecs) {
        const entry = {
          version: e.version, state: 'LOCKED',
          created_at: e.created_at || now, updated_at: now, locked_at: e.locked_at || now,
          // Backfill 1:1 by matching version when the legacy entry never
          // recorded plan_version_ref at all (JLH v0.x pattern) — a
          // reconstruction of intent, not a guess: this project's plan/exec
          // pairs were always created and numbered together.
          plan_version_ref: e.plan_version_ref || e.version,
        };
        if (e.file) entry.file = e.file;
        exec.versions.push(entry);
      }
      if (sortedExecs.length > 0) {
        exec.active_version = sortedExecs[sortedExecs.length - 1].version;
        exec.active_state = 'LOCKED';
      }

      close = {
        version: chainVersion, state: 'LOCKED',
        file: closeEntry.file, created_at: closeEntry.created_at || now, updated_at: now, locked_at: now,
      };
    } else {
      // Still-running chain (e.g. JLH v2) — reshape only, preserve legacy state.
      if (roadmapEntry) {
        const legacyState = roadmapEntry.state;
        const state = (legacyState === 'ACTIVE' || legacyState === 'INACTIVE') ? 'DRAFT' : legacyState;
        roadmap = {
          version: chainVersion, state,
          file: roadmapEntry.file, created_at: roadmapEntry.created_at || now, updated_at: roadmapEntry.updated_at || now,
        };
        if (state === 'LOCKED') roadmap.locked_at = roadmapEntry.locked_at || now;
        if (state === 'SUPERSEDED') {
          roadmap.supersede_reason = roadmapEntry.supersede_reason ||
            'Migrated from legacy schema: no supersede_reason recorded in legacy data.';
        }
      }

      for (const p of chainPlanEntries) {
        const entry = {
          version: p.version, state: p.state,
          created_at: p.created_at || now, updated_at: p.updated_at || now,
          intent_version_ref: chainVersion,
        };
        if (p.file) entry.file = p.file;
        if (p.locked_at) entry.locked_at = p.locked_at;
        if (p.supersede_reason) entry.supersede_reason = p.supersede_reason;
        if (p.title) entry.title = p.title;
        if (p.focus) entry.focus = p.focus;
        plan.versions.push(entry);
      }
      if (legacy.plan && legacy.plan.active_version && chainPlanVersionSet.has(legacy.plan.active_version)) {
        plan.active_version = legacy.plan.active_version;
        plan.active_state = legacy.plan.active_state;
      }

      for (const e of chainExecEntries) {
        const entry = {
          version: e.version, state: e.state,
          created_at: e.created_at || now, updated_at: e.updated_at || now,
        };
        if (e.file) entry.file = e.file;
        if (e.locked_at) entry.locked_at = e.locked_at;
        if (e.supersede_reason) entry.supersede_reason = e.supersede_reason;
        if (e.plan_version_ref) entry.plan_version_ref = e.plan_version_ref;
        exec.versions.push(entry);
      }
      const chainExecVersionSet = new Set(chainExecEntries.map(e => e.version));
      if (legacy.exec && legacy.exec.active_version && chainExecVersionSet.has(legacy.exec.active_version)) {
        exec.active_version = legacy.exec.active_version;
        exec.active_state = legacy.exec.active_state;
      }

      close = null;
    }

    applyForcedStates(plan, forcePlanState, now);
    applyForcedStates(exec, forceExecState, now);

    let lifecycle_state;
    if (close && close.state === 'LOCKED') lifecycle_state = 'CLOSED';
    else if (close) lifecycle_state = 'CLOSE';
    else if (intentState === 'LOCKED') lifecycle_state = 'BUILD';
    else lifecycle_state = 'DESIGN';

    const chain = {
      schema_version: SCHEMA_VERSION,
      chain_version: chainVersion,
      created_at: intentEntry.created_at || now,
      updated_at: now,
      lifecycle_state,
      intent,
      roadmap,
      plan,
      exec,
      close,
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
      runtime_invalid: { markers: [], last_doctor_run_at: null },
    };
    // Always recomputed from the chain's own content — never copied from the
    // legacy global gates, which only ever represented whichever intent was
    // active at the time (PLAN-EVAL-03 §10.1 finding #5).
    chain.gates.gate_1_open = hasActiveLockedIntent(chain);
    chain.gates.gate_2_open = hasCleanGate2Chain(chain);
    chain.gates.gate_3_satisfied = hasCleanGate3Chain(chain);

    results.push({ chainVersion, chain });
  }

  results.sort((a, b) => parseMajor(a.chainVersion) - parseMajor(b.chainVersion));

  const orphans = [];
  for (const p of planVersions) if (!claimedPlan.has(p)) orphans.push(`PLAN ${p.version} (intent_version_ref=${JSON.stringify(p.intent_version_ref)})`);
  for (const e of execVersions) if (!claimedExec.has(e)) orphans.push(`EXEC ${e.version} (plan_version_ref=${JSON.stringify(e.plan_version_ref)})`);
  for (const r of roadmapVersions) if (!claimedRoadmap.has(r)) orphans.push(`ROADMAP ${r.version} (intent_version_ref=${JSON.stringify(r.intent_version_ref)})`);
  for (const c of closeVersions) if (!claimedClose.has(c)) orphans.push(`CLOSE ${c.version}`);

  return { results, errors, orphans };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = args._[0];
  if (!projectRoot) {
    die(
      'Usage: node scripts/migrate-legacy-progress.js <projectRoot> [--dry-run|--confirm] ' +
      '[--treat-locked=v1,...] [--treat-superseded=v1,...]'
    );
  }
  const absRoot = path.resolve(projectRoot);
  if (!fs.existsSync(absRoot)) die(`Project root does not exist: ${absRoot}`);

  const legacyPath = path.join(absRoot, PROJECT_SIGMA_DIR, 'progress.json');
  if (!fs.existsSync(legacyPath)) {
    die(`No legacy Sigma/progress.json found at ${legacyPath} — nothing to migrate.`);
  }

  const write = !!args.confirm;
  console.log(write ? '=== MIGRATE (writing) ===\n' : '=== DRY RUN (pass --confirm to write) ===\n');

  // Informational only — no hard block. PLAN-EVAL-02 (final decision)
  // rejected any git-clean-tree guard as general Sigma policy; this script
  // follows the same call (PLAN-EVAL-03 §10.5), confirmed by Director.
  try {
    const { execSync } = require('child_process');
    const status = execSync('git status --porcelain -- Sigma', { cwd: absRoot, encoding: 'utf-8' });
    if (status.trim()) {
      console.log('NOTE: uncommitted changes detected under Sigma/ in this project:');
      console.log(status);
      console.log('This does not block the migration, but committing first makes `git checkout -- Sigma/` a clean rollback if needed.\n');
    }
  } catch {
    console.log('NOTE: could not run `git status` for this project (not a git repo, or git unavailable) — no automatic rollback safety net.\n');
  }

  const legacy = fs.readJsonSync(legacyPath);
  if (!legacy.intent || !Array.isArray(legacy.intent.versions)) {
    die(`${legacyPath} does not look like a legacy Sigma/progress.json (missing intent.versions array).`);
  }

  const now = new Date().toISOString();
  const { results, errors, orphans } = buildChains(
    legacy, args.treatLocked, args.treatSuperseded, args.forcePlanState, args.forceExecState, now
  );

  if (errors.length > 0) {
    console.error('Cannot proceed — ambiguous legacy state found:\n');
    for (const e of errors) console.error(`  - ${e}\n`);
    process.exit(1);
  }

  if (results.length === 0) {
    die('No INTENT versions found in legacy data — nothing to migrate.');
  }

  for (const { chainVersion, chain } of results) {
    console.log(`--- ${chainVersion} -> progress-${chainVersion}.json ---`);
    console.log(JSON.stringify(chain, null, 2));
    console.log('');
    validateChainSemantics(chain); // throws with a descriptive message if invalid
  }

  const activeVersion = legacy.intent.active_version || results[results.length - 1].chainVersion;
  console.log(`activate_status.json -> ${JSON.stringify({ active_chain: activeVersion })}\n`);

  if (orphans.length > 0) {
    console.log('NOTE: legacy entries not claimed by any chain (not migrated, review manually):');
    for (const o of orphans) console.log(`  - ${o}`);
    console.log('');
  }

  if (!write) {
    console.log('Dry run complete — no files written. Re-run with --confirm to write.');
    return;
  }

  // Write order: every chain file first, activate_status.json last
  // (DISCUSSION §11 / PLAN-EVAL-01 §4, generalized here to N chains) — if the
  // process dies mid-write, the worst case is an unpointed-to chain file
  // (harmless), never a manifest pointing at a chain file that doesn't exist.
  for (const { chainVersion, chain } of results) {
    writeChain(absRoot, chainVersion, chain);
  }
  writeActivateStatus(absRoot, activeVersion);

  console.log('Migration complete.');
  console.log(`Wrote: ${results.map(r => `progress-${r.chainVersion}.json`).join(', ')}, activate_status.json`);
  console.log('\nSigma/progress.json (legacy) was left untouched — safe to remove manually once verified (git remains the safety net, PLAN-EVAL-02).');
}

main();
