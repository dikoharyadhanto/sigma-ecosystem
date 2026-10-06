// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, Stage E W1 — the one use-case
// shared by `sigma exec new` (CLI) and `sigma_create_exec_draft` (MCP control
// tool). Transport-agnostic on purpose: no Commander, no console.log.
//
// Mirrors src/services/planDraftService.ts's shape, but two things differ
// structurally: (1) there is no independent version counter — nextExecVersion()
// (src/engine/chain.ts) always returns the referenced PLAN's own version, so
// this service's "which version" question is really "which PLAN", and (2)
// target-PLAN selection (PLAN-IMPL-MULTIDRAFT-LOCK §4's per-PLAN exec
// cardinality guard) is real, non-trivial business logic ported from
// src/commands/exec.ts verbatim, not simplified.

import path from 'path';
import fs from 'fs-extra';
import {
  ChainState,
  readActiveChain,
  writeChain,
  nextExecVersion,
  registerExecDraft,
  getOperationalGate,
  assertChainCanMutate,
  chainFilePath,
} from '../engine/chain';
import { toPosix } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import { controlTestFailpoint } from '../engine/controlStore';

export class ExecDraftError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ExecDraftError';
  }
}

export interface CreateExecDraftInput {
  projectRoot: string;
  /** Which LOCKED plan to execute. Required when more than one LOCKED plan
   *  has no open (non-SUPERSEDED) exec yet; optional and auto-resolved when
   *  exactly one such plan exists — mirrors CLI's `--plan`. */
  planVersion?: string;
}

export interface CreateExecDraftResult {
  chainVersion: string;
  version: string;
  relPath: string;
  planVersionRef: string;
}

// PLAN-IMPL-MULTIDRAFT-LOCK §4 (Director-confirmed cardinality invariant) —
// at most one non-final exec per plan. Ported verbatim from
// src/commands/exec.ts's `exec new` action (the CLI command this service
// replaces) rather than re-derived, because this is exactly the logic that
// enforces that invariant; simplifying it here would reopen the gap
// MULTIDRAFT-LOCK closed. Used by both createExecDraftTransactionFiles()
// (to compute the target file path before the lock/journal begins) and
// createExecDraft() itself, so the two can never resolve differently.
function resolveTargetPlan(chain: ChainState, requestedPlanVersion?: string): string {
  const lockedPlans = chain.plan.versions.filter(v => v.state === 'LOCKED');
  const plansWithOpenExec = new Set(
    chain.exec.versions
      .filter(v => v.state !== 'SUPERSEDED')
      .map(v => v.plan_version_ref)
      .filter((ref): ref is string => Boolean(ref))
  );
  const unexecutedPlans = lockedPlans.filter(p => !plansWithOpenExec.has(p.version));

  if (requestedPlanVersion) {
    const target = lockedPlans.find(p => p.version === requestedPlanVersion);
    if (!target) {
      const available = lockedPlans.map(p => p.version).join(', ') || '(none)';
      throw new ExecDraftError(
        'INVALID_OPERATION',
        `FMN-PLAN ${requestedPlanVersion} is not a LOCKED plan.\nLOCKED plans: ${available}`
      );
    }
    const openExecForPlan = chain.exec.versions.find(
      v => v.plan_version_ref === requestedPlanVersion && v.state !== 'SUPERSEDED'
    );
    if (openExecForPlan) {
      throw new ExecDraftError(
        'INVALID_OPERATION',
        `EXEC CONFLICT: FMN-PLAN ${requestedPlanVersion} already has DEV-EXEC ${openExecForPlan.version} in ${openExecForPlan.state} state.\n` +
        'A plan has at most one execution — continue that DEV-EXEC instead of creating a new one:\n' +
        `  ${openExecForPlan.file ?? `Sigma/build/DEV-EXEC-${openExecForPlan.version}.md`}\n` +
        `  sigma exec check --v ${openExecForPlan.version}\n` +
        'To abandon it instead, supersede its plan and open a new plan version:\n' +
        `  sigma plan supersede --v ${requestedPlanVersion} --reason "..."`
      );
    }
    return requestedPlanVersion;
  }

  if (unexecutedPlans.length === 0) {
    throw new ExecDraftError(
      'INVALID_OPERATION',
      'All locked plans already have an exec.\nRun: sigma plan new   to create a new plan'
    );
  }
  if (unexecutedPlans.length === 1) {
    return unexecutedPlans[0].version;
  }
  const versions = unexecutedPlans.map(p => p.version).join(', ');
  throw new ExecDraftError(
    'INVALID_OPERATION',
    `${unexecutedPlans.length} unexecuted locked plans found: ${versions}\n` +
    `Specify which to execute: sigma exec new --plan ${unexecutedPlans[0].version}`
  );
}

function assertGate2Open(chain: ChainState): void {
  if (!getOperationalGate(chain, 'gate_2_open')) {
    throw new ExecDraftError('GATE_BLOCKED', 'GATE 2 BLOCKED: No locked FMN-PLAN. Run: sigma plan lock');
  }
}

export function createExecDraftTransactionFiles(projectRoot: string, planVersion?: string): string[] {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  assertGate2Open(chain);
  const planVersionRef = resolveTargetPlan(chain, planVersion);
  const version = nextExecVersion(chain, planVersionRef);
  return [
    path.join(projectRoot, 'Sigma', 'evidence', `DEV-EXEC-${version}.md`),
    chainFilePath(projectRoot, chainVersion),
  ];
}

export function createExecDraft(input: CreateExecDraftInput): CreateExecDraftResult {
  const { projectRoot, planVersion } = input;

  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  assertChainCanMutate(chain);
  assertGate2Open(chain);
  const planVersionRef = resolveTargetPlan(chain, planVersion);

  const version = nextExecVersion(chain, planVersionRef);
  const relPath = toPosix(path.join('Sigma', 'evidence', `DEV-EXEC-${version}.md`));
  const absPath = path.join(projectRoot, relPath);

  // Defensive checks ported from the CLI command — registerExecDraft() would
  // itself throw on the first, but failing before any artifact write is
  // written is the whole point (an orphan file with no chain entry is worse
  // than an early, clean refusal).
  if (chain.exec.versions.some(v => v.version === version)) {
    throw new ExecDraftError('INVALID_OPERATION', `EXEC CONFLICT: DEV-EXEC ${version} already exists in progress-${chainVersion}.json`);
  }
  if (fs.existsSync(absPath)) {
    throw new ExecDraftError('INVALID_OPERATION', `EXEC FILE CONFLICT: ${relPath} already exists. Refusing to overwrite existing DEV-EXEC artifact.`);
  }

  copyTemplateToArtifact('DEV-EXEC-TEMPLATE.md', absPath);
  controlTestFailpoint('exec_create_after_artifact');

  registerExecDraft(chain, version, relPath, planVersionRef);
  writeChain(projectRoot, chainVersion, chain);
  controlTestFailpoint('exec_create_after_chain');

  return { chainVersion, version, relPath, planVersionRef };
}
