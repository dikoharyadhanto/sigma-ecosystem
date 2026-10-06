// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, Stage C pilot — the one
// use-case shared by `sigma intent new` (CLI) and `sigma_create_intent_draft`
// (MCP control tool). Transport-agnostic on purpose: no Commander, no
// console.log, no prompt. The CLOSED-chain reopen confirmation stays with
// each caller (interactive prompt for the CLI, an explicit boolean argument
// for MCP) — this function only enforces that the confirmation happened,
// it does not obtain it.

import path from 'path';
import {
  ChainState,
  createInitialChain,
  nextChainVersion,
  writeChain,
  readActiveChain,
  writeActivateStatus,
  chainFilePath,
  activateStatusPath,
} from '../engine/chain';
import { toPosix } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import { intentHistoryPath, renderIntentHistoryFile } from '../utils/intentHistory';
import { controlTestFailpoint } from '../engine/controlStore';

export class IntentDraftError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'IntentDraftError';
  }
}

export interface CreateIntentDraftInput {
  projectRoot: string;
  title: string;
  focus: string;
  /** Caller has already obtained (or does not need) confirmation to open a
   *  new chain while the active one is CLOSED. Defaults to false — silence
   *  never implies consent. */
  allowReopenClosed?: boolean;
}

export interface CreateIntentDraftResult {
  chainVersion: string;
  relPath: string;
  title: string;
  focus: string;
}

export function createIntentDraftTransactionFiles(projectRoot: string): string[] {
  const chainVersion = nextChainVersion(projectRoot);
  return [
    path.join(projectRoot, 'Sigma', 'charter', `DIR-INTENT-${chainVersion}.md`),
    chainFilePath(projectRoot, chainVersion),
    activateStatusPath(projectRoot),
    intentHistoryPath(projectRoot),
  ];
}

// PLAN-EVAL-06 §6.2 — intent-history.md is a plain pipe-split table, and
// doctor --reconstruct parses it back to recover title/focus. "|"/newlines
// would corrupt both the render and the recovery parser. Same rule the CLI
// enforced inline before this was extracted (src/commands/intent.ts).
function assertRequiredMetadata(title: string, focus: string): void {
  if (!title?.trim()) throw new IntentDraftError('INVALID_OPERATION', 'title is required.');
  if (!focus?.trim()) throw new IntentDraftError('INVALID_OPERATION', 'focus is required.');
  if (/[|\n\r]/.test(title)) {
    throw new IntentDraftError('INVALID_OPERATION', 'title cannot contain "|" or a newline (breaks intent-history.md).');
  }
  if (/[|\n\r]/.test(focus)) {
    throw new IntentDraftError('INVALID_OPERATION', 'focus cannot contain "|" or a newline (breaks intent-history.md).');
  }
}

export function createIntentDraft(input: CreateIntentDraftInput): CreateIntentDraftResult {
  const { projectRoot, title, focus, allowReopenClosed = false } = input;
  assertRequiredMetadata(title, focus);

  // Read-only preflight — a brand-new project with no chain yet has nothing
  // to check CLOSED-ness against.
  let activeForPreflight: ChainState | null = null;
  try {
    activeForPreflight = readActiveChain(projectRoot).data;
  } catch {
    // no chain exists yet — first intent draft on this project
  }

  if (activeForPreflight?.lifecycle_state === 'CLOSED' && !allowReopenClosed) {
    throw new IntentDraftError(
      'INVALID_OPERATION',
      'The active chain is CLOSED. Creating a new intent draft will open a new, isolated chain and ' +
      'activate it — the CLOSED chain is left untouched. Confirm reopening before retrying.'
    );
  }

  const chainVersion = nextChainVersion(projectRoot);
  const relPath = toPosix(path.join('Sigma', 'charter', `DIR-INTENT-${chainVersion}.md`));
  const absPath = path.join(projectRoot, relPath);
  copyTemplateToArtifact('DIR-INTENT-TEMPLATE.md', absPath);
  controlTestFailpoint('create_after_artifact');

  const chain = createInitialChain(chainVersion, relPath, title, focus);
  writeChain(projectRoot, chainVersion, chain); // chain file first
  controlTestFailpoint('create_after_chain');
  writeActivateStatus(projectRoot, chainVersion); // manifest last — PLAN-EVAL-01 §5.9 write order
  controlTestFailpoint('create_after_activate');
  renderIntentHistoryFile(projectRoot);
  controlTestFailpoint('create_after_history');

  return { chainVersion, relPath, title, focus };
}
