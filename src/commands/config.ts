import { Command } from 'commander';
import { findProjectRoot } from '../utils/fs';
import { readProjectConfig, writeProjectConfig } from '../engine/projectConfig';
import { promptLanguageWizard } from '../engine/languageWizard';

export function configCommand(): Command {
  const cmd = new Command('config');
  cmd.description('Manage project configuration (Sigma/project.config.json)');

  // `sigma config` with no subcommand — interactive language wizard.
  cmd.action(async () => {
    try {
      const projectRoot = findProjectRoot();
      const config = readProjectConfig(projectRoot);
      console.log('\n=== Sigma Language Preferences ===\n');
      const updated = await promptLanguageWizard(config);
      writeProjectConfig(projectRoot, updated);
      console.log('\nLanguage preferences updated.');
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

  const set = cmd.command('set');
  set.description('Set a configuration value (non-interactive)');

  set.command('language <name>')
    .description(
      'Set a language preference to a free-form language name (e.g. "English", "Indonesia") — not an ISO code. ' +
      'Requires exactly one of --interaction, --sigma-document, or --output-document.'
    )
    .option('--interaction', 'Set the AI communication (Director-facing) language')
    .option('--sigma-document', 'Set the Sigma document (DIR-INTENT/FMN-PLAN/DEV-EXEC/etc.) language')
    .option('--output-document', 'Set the non-Sigma output document language')
    .action((name: string, flags: { interaction?: boolean; sigmaDocument?: boolean; outputDocument?: boolean }) => {
      try {
        const selected = [flags.interaction, flags.sigmaDocument, flags.outputDocument].filter(Boolean).length;
        if (selected !== 1) {
          throw new Error('Specify exactly one of --interaction, --sigma-document, or --output-document.');
        }

        const projectRoot = findProjectRoot();
        const config = readProjectConfig(projectRoot);

        if (flags.interaction) {
          const prev = config.interaction_language;
          config.interaction_language = name;
          writeProjectConfig(projectRoot, config);
          console.log(`AI Communication Language: ${prev} -> ${name}`);
        } else if (flags.sigmaDocument) {
          const prev = config.document_language;
          config.document_language = name;
          writeProjectConfig(projectRoot, config);
          console.log(`Sigma Docs Language: ${prev} -> ${name}`);
        } else {
          const prev = config.output_document_language;
          config.output_document_language = name;
          writeProjectConfig(projectRoot, config);
          console.log(`Output Doc Written Language: ${prev} -> ${name}`);
        }
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('show')
    .description('Show current project configuration')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const config = readProjectConfig(projectRoot);
        console.log('\n=== Project Config ===\n');
        console.log(`AI Communication Language:     ${config.interaction_language}`);
        console.log(`Sigma Docs Language:           ${config.document_language}`);
        console.log(`Output Doc Written Language:   ${config.output_document_language}`);
        console.log('');
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
