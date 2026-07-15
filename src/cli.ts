import { Command } from 'commander';
import { SIGMA_VERSION } from './config';
import { setupCommand } from './commands/setup';
import { projectCommand } from './commands/project';
import { sessionCommand } from './commands/session';
import { intentCommand } from './commands/intent';
import { planCommand } from './commands/plan';
import { execCommand } from './commands/exec';
import { closeCommand } from './commands/close';
import { roadmapCommand } from './commands/roadmap';
import { gitCommand } from './commands/git';
import { overrideCommand } from './commands/override';
import { sendCommand } from './commands/send';
import { inboxCommand } from './commands/inbox';
import { configCommand } from './commands/config';
import { memoryCommand } from './commands/memory';
import { doctorCommand } from './commands/doctor';
import { referenceCommand } from './commands/reference';
import { appendOperationLogEntry } from './utils/operationLog';

const program = new Command();

program
  .name('sigma')
  .description('Sigma — Lightweight project governance CLI')
  .version(SIGMA_VERSION);

program.addCommand(setupCommand());
program.addCommand(projectCommand());
program.addCommand(sessionCommand());
program.addCommand(intentCommand());
program.addCommand(planCommand());
program.addCommand(execCommand());
program.addCommand(closeCommand());
program.addCommand(roadmapCommand());
program.addCommand(gitCommand());
program.addCommand(overrideCommand());
program.addCommand(sendCommand());
program.addCommand(inboxCommand());
program.addCommand(configCommand());
program.addCommand(memoryCommand());
program.addCommand(doctorCommand());
program.addCommand(referenceCommand());

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
});

process.on('exit', (code) => {
  if (pendingOperation) {
    appendOperationLogEntry(pendingOperation, code);
  }
});

program.parse(process.argv);
