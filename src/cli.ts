import { Command } from 'commander';
import { SIGMA_VERSION } from './config';
import { setupCommand } from './commands/setup';
import { projectCommand } from './commands/project';
import { sessionCommand } from './commands/session';
import { intentCommand } from './commands/intent';
import { planCommand } from './commands/plan';
import { execCommand } from './commands/exec';
import { closeCommand } from './commands/close';
import { reviewCommand } from './commands/review';
import { roadmapCommand } from './commands/roadmap';
import { gitCommand } from './commands/git';
import { overrideCommand } from './commands/override';
import { sendCommand } from './commands/send';
import { inboxCommand } from './commands/inbox';
import { memoCommand } from './commands/memo';
import { configCommand } from './commands/config';
import { memoryCommand } from './commands/memory';
import { doctorCommand } from './commands/doctor';
import { referenceCommand } from './commands/reference';
import { notesCommand } from './commands/notes';
import { reportCommand } from './commands/report';
import { scanCommand } from './commands/scan';
import { controlCommand } from './commands/control';
import { devCommand } from './commands/dev';
import { auditCommand, decisionsCommand } from './commands/f08';
import { appendOperationLogEntry } from './utils/operationLog';
import { findProjectRoot } from './utils/fs';
import { evaluateVersionStatus } from './services/assetConsistency';

const program = new Command();

program
  .name('sigma')
  .description('Sigma — AI-operated governance runtime CLI')
  .version(SIGMA_VERSION);

program.addCommand(setupCommand());
program.addCommand(projectCommand());
program.addCommand(sessionCommand());
program.addCommand(intentCommand());
program.addCommand(planCommand());
program.addCommand(execCommand());
program.addCommand(closeCommand());
program.addCommand(reviewCommand());
program.addCommand(roadmapCommand());
program.addCommand(gitCommand());
program.addCommand(overrideCommand());
program.addCommand(sendCommand());
program.addCommand(inboxCommand());
program.addCommand(memoCommand());
program.addCommand(configCommand());
program.addCommand(memoryCommand());
program.addCommand(doctorCommand());
program.addCommand(referenceCommand());
program.addCommand(notesCommand());
program.addCommand(reportCommand());
program.addCommand(scanCommand());
program.addCommand(controlCommand());
program.addCommand(devCommand());
program.addCommand(auditCommand());
program.addCommand(decisionsCommand());

program.on('command:*', (operands: string[]) => {
  console.error(`Unknown command: sigma ${operands.join(' ')}`);
  console.error('Run `sigma --help` for available commands.');
  process.exit(1);
});

// ── Operation history log ───────────────────────────────────────────────────
// Every command handler catches its own errors and calls process.exit(1)
// directly (never throws out to commander), so a postAction hook would never
// see failed operations — the process is already dead by the time it would
// fire. process.on('exit') always runs immediately before the process
// actually terminates regardless of cause, so pairing it with preAction (to
// capture which command is about to run) is the only combination that
// guarantees every operation is recorded, success or failure, without
// touching any individual command handler.

let pendingOperation: string | null = null;

function commandPath(cmd: Command): string {
  const parts: string[] = [];
  let current: Command | null = cmd;
  while (current && current.parent) {
    parts.unshift(current.name());
    current = current.parent;
  }
  return parts.join(' ');
}

program.hook('preAction', (_thisCommand, actionCommand) => {
  pendingOperation = commandPath(actionCommand);
  if (pendingOperation === 'doctor' && actionCommand.opts().checkAssets) pendingOperation = null;
  if (pendingOperation === 'plan check' && actionCommand.opts().sources ||
      ['audit show', 'decisions list', 'decisions target'].includes(pendingOperation ?? '') ||
      ['intent clone', 'plan clone'].includes(pendingOperation ?? '') && !actionCommand.opts().confirm) pendingOperation = null;
});

// ── Version warning (F12) ───────────────────────────────────────────────────
// One line on stderr when the Sigma assets this project (or the global
// installation) holds are behind the installed CLI. Silent outside a project.
// `setup`, `project start|register|sync`, and `doctor` are the commands that
// fix or diagnose the condition, and `session bootstrap` already prints the
// same message through its compatibility warnings.
const VERSION_WARNING_EXEMPT = new Set([
  'project start', 'project register', 'project sync', 'session bootstrap',
]);

function exemptFromVersionWarning(operation: string): boolean {
  const [head] = operation.split(' ');
  return head === 'setup' || head === 'doctor' || VERSION_WARNING_EXEMPT.has(operation);
}

program.hook('preAction', (_thisCommand, actionCommand) => {
  if (exemptFromVersionWarning(commandPath(actionCommand))) return;
  let projectRoot: string;
  try {
    projectRoot = findProjectRoot();
  } catch {
    return;
  }
  const status = evaluateVersionStatus(projectRoot);
  if (status?.message) console.error(status.message);
});

process.on('exit', (code) => {
  if (pendingOperation) {
    appendOperationLogEntry(pendingOperation, code);
  }
});

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(err.message);
  process.exitCode = 1;
});
