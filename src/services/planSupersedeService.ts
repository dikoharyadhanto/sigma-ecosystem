// Stage F (W2 batch, continued) — the use-case shared by `sigma plan
// supersede` (CLI) and sigma_commit_plan_supersede's mutate step (MCP
// control tool). Transport-agnostic: no Commander, no console.log — mirrors
// intentRatifyService.ts's split. Unlike intent_supersede, this operation
// already only ever targets the active chain in the CLI (no cross-chain
// `--v`), so there is no MCP scope-narrowing decision to make here.

import path from 'path';
import fs from 'fs-extra';
import {
  ChainState,
  readActiveChain,
  assertChainCanMutate,
  supersedePlanVersion,
  writeChain,
  chainFilePath,
} from '../engine/chain';
import { renderRoadmapFile } from '../utils/roadmap';

export class PlanSupersedeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PlanSupersedeError';
  }
}

const MAX_REASON_LENGTH = 2000;

export function assertValidPlanSupersedeReason(reason: string): void {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new PlanSupersedeError('INVALID_OPERATION', '--reason cannot be empty.');
  }
  if (reason.length > MAX_REASON_LENGTH) {
    throw new PlanSupersedeError('INVALID_OPERATION', `--reason exceeds ${MAX_REASON_LENGTH} characters.`);
  }
}

export function planDocPath(projectRoot: string, chain: ChainState, version: string): string {
  const entry = chain.plan.versions.find(v => v.version === version);
  if (!entry) throw new PlanSupersedeError('INVALID_OPERATION', `FMN-PLAN ${version} not found.`);
  return path.join(projectRoot, entry.file ?? path.join('Sigma', 'contract', `FMN-PLAN-${entry.version}.md`));
}

export function describePlanSupersedeCascadeEffects(chain: ChainState, version: string): string[] {
  const target = chain.plan.versions.find(v => v.version === version);
  const effects = [`plan.${version}.state: ${target?.state ?? '?'} -> SUPERSEDED`];
  for (const exec of chain.exec.versions) {
    if (exec.plan_version_ref === version && exec.state !== 'SUPERSEDED') {
      effects.push(`exec.${exec.version}.state: ${exec.state} -> SUPERSEDED (cascade)`);
    }
  }
  if (chain.roadmap) {
    effects.push(`roadmap.${chain.roadmap.version}: re-rendered with SUPERSEDED status`);
  }
  return effects;
}

export interface SupersedePlanResult {
  chainVersion: string;
  version: string;
  cascadedExecs: string[];
}

export function planSupersedeTransactionFiles(projectRoot: string): string[] {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  const files = [chainFilePath(projectRoot, chainVersion)];
  if (chain.roadmap) {
    files.push(path.join(projectRoot, chain.roadmap.file ?? path.join('Sigma', 'roadmap', `ROADMAP-${chain.roadmap.version}.md`)));
  }
  return files;
}

/**
 * Supersedes an FMN-PLAN version (DRAFT or LOCKED) on the active chain,
 * auto-superseding any linked non-final DEV-EXEC. Throws PlanSupersedeError
 * (INVALID_OPERATION) for every business-rule rejection (not found, already
 * SUPERSEDED, malformed reason).
 */
export function supersedePlanUseCase(projectRoot: string, version: string, reason: string): SupersedePlanResult {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  assertChainCanMutate(chain);
  assertValidPlanSupersedeReason(reason);

  const cascadedExecs = chain.exec.versions
    .filter(v => v.plan_version_ref === version && v.state !== 'SUPERSEDED')
    .map(v => v.version);

  try {
    supersedePlanVersion(chain, version, reason);
  } catch (e) {
    throw new PlanSupersedeError('INVALID_OPERATION', (e as Error).message);
  }
  writeChain(projectRoot, chainVersion, chain);

  if (chain.roadmap) {
    const roadmapPath = path.join(projectRoot, chain.roadmap.file ?? path.join('Sigma', 'roadmap', `ROADMAP-${chain.roadmap.version}.md`));
    if (fs.existsSync(roadmapPath)) {
      renderRoadmapFile(roadmapPath, chain);
    }
  }

  return { chainVersion, version, cascadedExecs };
}
