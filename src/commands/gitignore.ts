import { Command } from 'commander';

const GITIGNORE_OUTPUT = `# Sigma CLI
node_modules/
dist/
*.js.map

# Sigma runtime
# Note: the Sigma/ governance folder SHOULD be committed — it is the project record.
# Only exclude CLI build artifacts and local backups if needed:
# Sigma/logs/      ← optional: exclude if logs are too verbose for git
`;

export function gitignoreCommand(): Command {
  const cmd = new Command('gitignore');
  cmd.description('Generate .gitignore content for Sigma projects');

  cmd
    .command('generate')
    .description('Print recommended .gitignore entries to stdout')
    .action(() => {
      process.stdout.write(GITIGNORE_OUTPUT);
    });

  return cmd;
}
