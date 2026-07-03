import { Command } from 'commander';
import { SIGMA_VERSION } from './config';
import { setupCommand } from './commands/setup';
import { projectCommand } from './commands/project';
import { sessionCommand } from './commands/session';
import { gitignoreCommand } from './commands/gitignore';
import { intentCommand } from './commands/intent';
import { planCommand } from './commands/plan';
import { execCommand } from './commands/exec';
import { closeCommand } from './commands/close';
import { roadmapCommand } from './commands/roadmap';
import { gitCommand } from './commands/git';
import { csoCommand } from './commands/cso';
import { overrideCommand } from './commands/override';
import { sendCommand } from './commands/send';
import { inboxCommand } from './commands/inbox';
import { configCommand } from './commands/config';
import { syncCommand } from './commands/sync';
import { memoryCommand } from './commands/memory';
import { doctorCommand } from './commands/doctor';
import { referenceCommand } from './commands/reference';

const program = new Command();

program
  .name('sigma')
  .description('Sigma — Lightweight project governance CLI')
  .version(SIGMA_VERSION);

program.addCommand(setupCommand());
program.addCommand(projectCommand());
program.addCommand(sessionCommand());
program.addCommand(gitignoreCommand());
program.addCommand(intentCommand());
program.addCommand(planCommand());
program.addCommand(execCommand());
program.addCommand(closeCommand());
program.addCommand(roadmapCommand());
program.addCommand(gitCommand());
program.addCommand(csoCommand());
program.addCommand(overrideCommand());
program.addCommand(sendCommand());
program.addCommand(inboxCommand());
program.addCommand(configCommand());
program.addCommand(syncCommand());
program.addCommand(memoryCommand());
program.addCommand(doctorCommand());
program.addCommand(referenceCommand());

program.on('command:*', (operands: string[]) => {
  console.error(`Unknown command: sigma ${operands.join(' ')}`);
  console.error('Run `sigma --help` for available commands.');
  process.exit(1);
});

program.parse(process.argv);
