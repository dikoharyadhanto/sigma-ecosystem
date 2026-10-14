import { Command } from 'commander';
import { findProjectRoot } from '../utils/fs';
import { localTransaction } from '../engine/localTransaction';
import { CloneInput, previewClone, cloneDraft, cloneTransactionFiles } from '../services/cloneDraftService';
import { ArtifactType } from '../mcp/artifactPath';
import { captureArtifact, reviewChain } from '../services/sourceReviewService';
import { f08StorePath, Assessment } from '../services/f08Store';
import {
  createAuditPack, auditPackStatus, renderAuditPack, recordAuditResponse,
  addQuestion, resolveQuestion, listDecisions, recordReadiness,
} from '../services/auditDecisionService';
const output = (result: unknown) => console.log(JSON.stringify(result, null, 2));
const fail = (error: unknown) => { console.error((error as Error).message); process.exitCode = 1; };
function artifactType(value: string): ArtifactType {
  if (!['intent', 'plan', 'exec', 'roadmap', 'close'].includes(value)) throw new Error('Invalid artifact type.');
  return value as ArtifactType;
}
export function cloneCommand(type: 'intent' | 'plan'): Command {
  return new Command('clone').description('Preview a new DRAFT from a registered source. Confirm only after reviewing reset sections and diff.')
    .requiredOption('--from-chain <version>', 'Source intent chain, e.g. v1')
    .requiredOption('--from <version>', 'Source artifact version')
    .requiredOption('--title <text>', 'New title').requiredOption('--focus <text>', 'New focus')
    .option('--confirm', 'Create the reviewed DRAFT')
    .option('--preview-token <hash>', 'Token from the unchanged preview')
    .option('--yes', 'Explicitly confirm reopening a CLOSED chain for a new INTENT')
    .action(async (opts: { fromChain: string; from: string; title: string; focus: string; confirm?: boolean; previewToken?: string; yes?: boolean }) => {
      try {
        const root = findProjectRoot();
        const input: CloneInput = { projectRoot: root, type, sourceChain: opts.fromChain,
          sourceVersion: opts.from, title: opts.title, focus: opts.focus, allowReopenClosed: Boolean(opts.yes) };
        if (!opts.confirm) { output(previewClone(input)); return; }
        if (!opts.previewToken) throw new Error('--preview-token from a reviewed preview is required.');
        output(await localTransaction(root, type + '_clone', type === 'intent' ? 'ARC' : 'FMN',
          () => cloneTransactionFiles(input), () => cloneDraft(input, opts.previewToken!)));
      } catch (error) { fail(error); }
    });
}
export function auditCommand(): Command {
  const cmd = new Command('audit').description('Build audit snapshots and record original AUD responses. No approval or external sending.');
  cmd.command('new').requiredOption('--type <type>', 'Target artifact type').requiredOption('--v <version>', 'Target version')
    .requiredOption('--target-sha256 <hash>', 'Reviewed target hash')
    .option('--include-evidence', 'Include only registered, hash-matching text evidence within 512 KiB each')
    .action(async (opts: { type: string; v: string; targetSha256: string; includeEvidence?: boolean }) => {
      try {
        const root = findProjectRoot(), type = artifactType(opts.type);
        output(await localTransaction(root, 'audit_new', 'Director', () => [f08StorePath(root)],
          () => createAuditPack(root, type, opts.v, opts.targetSha256, opts.includeEvidence)));
      } catch (error) { fail(error); }
    });
  cmd.command('show <id>').option('--markdown', 'Render snapshots for manual audit handoff')
    .action((id: string, opts: { markdown?: boolean }) => {
      try { const root = findProjectRoot(); if (opts.markdown) console.log(renderAuditPack(root, id)); else output(auditPackStatus(root, id)); }
      catch (error) { fail(error); }
    });
  cmd.command('record <id>').requiredOption('--text <text>', 'Exact original AUD response')
    .requiredOption('--origin <text>', 'Response source/vendor/session, explicitly declared')
    .requiredOption('--pack-sha256 <hash>', 'Reviewed pack manifest hash')
    .action(async (id: string, opts: { text: string; origin: string; packSha256: string }) => {
      try {
        const root = findProjectRoot();
        output(await localTransaction(root, 'audit_record', 'AUD', () => [f08StorePath(root)],
          () => recordAuditResponse(root, id, opts.text, opts.origin, opts.packSha256, 'AUD')));
      } catch (error) { fail(error); }
    });
  return cmd;
}
export function decisionsCommand(): Command {
  const cmd = new Command('decisions').description('Substantive questions and control tickets are separate; answers never approve artifacts.');
  cmd.command('list').option('--chain <version>', 'Explicit historical intent chain').option('--history', 'Include resolved and terminal records')
    .action((opts: { chain?: string; history?: boolean }) => {
      try { output(listDecisions(findProjectRoot(), opts.chain, opts.history)); } catch (error) { fail(error); }
    });
  cmd.command('add').requiredOption('--type <type>', 'Target artifact type').requiredOption('--v <version>', 'Target artifact version')
    .requiredOption('--question <text>', 'Explicit substantive question')
    .requiredOption('--target-sha256 <hash>', 'Reviewed target hash')
    .requiredOption('--role <role>', 'ARC, FMN or DEV')
    .action(async (opts: { type: string; v: string; question: string; targetSha256: string; role: string }) => {
      try {
        const root = findProjectRoot(), type = artifactType(opts.type);
        output(await localTransaction(root, 'decisions_add', opts.role, () => [f08StorePath(root)],
          () => addQuestion(root, type, opts.v, opts.question, opts.targetSha256, opts.role)));
      } catch (error) { fail(error); }
    });
  cmd.command('resolve <id>').requiredOption('--answer <text>', 'Director answer')
    .requiredOption('--target-sha256 <hash>', 'Reviewed unchanged target hash').option('--director-confirm', 'Explicit Director decision')
    .action(async (id: string, opts: { answer: string; targetSha256: string; directorConfirm?: boolean }) => {
      try {
        if (!opts.directorConfirm) throw new Error('--director-confirm is required.');
        const root = findProjectRoot();
        output(await localTransaction(root, 'decisions_resolve', 'Director', () => [f08StorePath(root)],
          () => resolveQuestion(root, id, opts.answer, opts.targetSha256, true)));
      } catch (error) { fail(error); }
    });
  cmd.command('assess').description('Record an advisory FMN assessment; never grants approval.')
    .requiredOption('--v <version>', 'PLAN version')
    .requiredOption('--status <status>', 'READY, SCOPE_GAP, PENDING_ALIGNMENT, UNKNOWN')
    .requiredOption('--reason <text>', 'Substantive FMN rationale')
    .requiredOption('--target-sha256 <hash>', 'Reviewed PLAN hash')
    .requiredOption('--source-sha256 <hash>', 'Reviewed INTENT hash')
    .action(async (opts: { v: string; status: string; reason: string; targetSha256: string; sourceSha256: string }) => {
      try {
        const root = findProjectRoot();
        output(await localTransaction(root, 'decisions_assess', 'FMN', () => [f08StorePath(root)],
          () => recordReadiness(root, opts.v, opts.status as Assessment['status'], opts.reason, opts.targetSha256, opts.sourceSha256, 'FMN')));
      } catch (error) { fail(error); }
    });
  // A minimal read-only target hash helper avoids arbitrary path arguments.
  cmd.command('target').requiredOption('--type <type>', 'Artifact type').requiredOption('--v <version>', 'Artifact version')
    .action((opts: { type: string; v: string }) => {
      try { const root = findProjectRoot(); const { content: _content, ...target } = captureArtifact(root, reviewChain(root).chainVersion, artifactType(opts.type), opts.v); output(target); }
      catch (error) { fail(error); }
    });
  return cmd;
}
