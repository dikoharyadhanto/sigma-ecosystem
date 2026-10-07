import { Command } from 'commander';
import chalk from 'chalk';
import { findProjectRoot } from '../utils/fs';
import {
  createDevWorkspace,
  describeDevWorkspace,
  getDevWorkspaceStatus,
} from '../engine/devWorkspace';

function printStatus(projectRoot: string): void {
  const status = getDevWorkspaceStatus(projectRoot);
  console.log(`DEV workspace: ${status.state}`);
  for (const line of describeDevWorkspace(status)) {
    console.log(line);
  }
}

export function devCommand(): Command {
  const cmd = new Command('dev');
  cmd.description('DEV workspace commands');

  cmd
    .command('create-workspace')
    .description('Create the DEV workspace dev/ and register it in the project identity (run only on explicit Director instruction)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        createDevWorkspace(projectRoot);
        console.log(chalk.green('DEV workspace created: dev/'));
        console.log('Note: this operation wrote at the project root, outside Sigma/.');
        printStatus(projectRoot);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('status')
    .description('Show whether the DEV workspace is active, degraded, or not registered (read-only)')
    .action(() => {
      try {
        printStatus(findProjectRoot());
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
