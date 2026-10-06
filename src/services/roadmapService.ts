// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, Stage E W1 — the two use-cases
// shared by `sigma roadmap new`/`sigma roadmap render` (CLI) and
// `sigma_create_roadmap_draft`/`sigma_render_roadmap` (MCP control tools).
// Transport-agnostic on purpose: no Commander, no console.log.
//
// chain.roadmap is a single object (SingleRoadmapState | null), like
// chain.intent — not an array like chain.plan.versions[]/chain.exec.versions[].
// There is no independent roadmap version counter: a chain's roadmap always
// carries chain.chain_version.

import path from 'path';
import {
  ChainState,
  readActiveChain,
  writeChain,
  assertChainCanMutate,
  registerRoadmapDraft,
  chainFilePath,
} from '../engine/chain';
import { toPosix } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import { renderRoadmapFile } from '../utils/roadmap';
import { controlTestFailpoint } from '../engine/controlStore';

export class RoadmapServiceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'RoadmapServiceError';
  }
}

export interface CreateRoadmapDraftInput {
  projectRoot: string;
}

export interface CreateRoadmapDraftResult {
  chainVersion: string;
  version: string;
  relPath: string;
}

function roadmapAbsPath(projectRoot: string, chain: ChainState): string {
  if (!chain.roadmap) {
    throw new RoadmapServiceError('INVALID_OPERATION', 'No ROADMAP found for this chain. Run: sigma roadmap new');
  }
  return path.join(projectRoot, chain.roadmap.file ?? path.join('Sigma', 'roadmap', `ROADMAP-${chain.roadmap.version}.md`));
}

export function createRoadmapDraftTransactionFiles(projectRoot: string): string[] {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  const version = chain.chain_version;
  return [
    path.join(projectRoot, 'Sigma', 'roadmap', `ROADMAP-${version}.md`),
    chainFilePath(projectRoot, chainVersion),
  ];
}

export function createRoadmapDraft(input: CreateRoadmapDraftInput): CreateRoadmapDraftResult {
  const { projectRoot } = input;

  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  assertChainCanMutate(chain);

  if (chain.intent.state !== 'RATIFIED') {
    throw new RoadmapServiceError('GATE_BLOCKED', 'ROADMAP requires a ratified DIR-INTENT. Run: sigma intent ratify');
  }
  // registerRoadmapDraft() below enforces this same 1:1 guard, but only
  // with a plain Error (no typed .code) — checked here first, with the
  // identical message, so a real conflict surfaces as INVALID_OPERATION
  // instead of falling through to INTERNAL_ERROR. registerRoadmapDraft()'s
  // own check stays in place as the defensive backstop it already is for
  // every other *Draft chain.ts mutator (e.g. registerPlanDraft's version
  // sync check).
  if (chain.roadmap !== null && chain.roadmap.state !== 'SUPERSEDED') {
    throw new RoadmapServiceError(
      'INVALID_OPERATION',
      `ROADMAP already exists for this chain (${chain.roadmap.version}, ${chain.roadmap.state}). ` +
      'To create a new roadmap, create a new INTENT (chain) first.'
    );
  }

  const version = chain.chain_version;
  const relPath = toPosix(path.join('Sigma', 'roadmap', `ROADMAP-${version}.md`));
  const absPath = path.join(projectRoot, relPath);

  // Artifact write first, chain last — same order/rationale as
  // intent/plan/exec draft services: a half-written artifact with no chain
  // entry is an orphan file, recoverable; a chain entry pointing at a
  // missing artifact is not.
  copyTemplateToArtifact('ROADMAP-TEMPLATE.md', absPath);
  controlTestFailpoint('roadmap_create_after_artifact');

  // registerRoadmapDraft() itself re-enforces the 1:1 guard (rejects unless
  // chain.roadmap is null or SUPERSEDED) — not duplicated logic, a backstop.
  registerRoadmapDraft(chain, relPath);
  writeChain(projectRoot, chainVersion, chain);
  controlTestFailpoint('roadmap_create_after_chain');

  return { chainVersion, version, relPath };
}

export function renderActiveRoadmapTransactionFiles(projectRoot: string): string[] {
  const { data: chain } = readActiveChain(projectRoot);
  return [roadmapAbsPath(projectRoot, chain)];
}

export interface RenderActiveRoadmapResult {
  version: string;
  relPath: string;
}

// No assertChainCanMutate() here — matches the existing CLI `roadmap
// render`, which never called it either (render has no DRAFT/LOCKED
// state concern; it re-derives a table from chain.plan.versions[] and
// never touches progress-v<N>.json at all).
export function renderActiveRoadmap(projectRoot: string): RenderActiveRoadmapResult {
  const { data: chain } = readActiveChain(projectRoot);
  const absPath = roadmapAbsPath(projectRoot, chain);
  renderRoadmapFile(absPath, chain);
  controlTestFailpoint('roadmap_render_after_write');
  return { version: chain.roadmap!.version, relPath: chain.roadmap!.file ?? toPosix(path.relative(projectRoot, absPath)) };
}
