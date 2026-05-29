import { Command } from 'commander';
import { findProjectRoot } from '../utils/fs';
import { readProjectConfig, writeProjectConfig, langLabel } from '../engine/projectConfig';

export function configCommand(): Command {
  const cmd = new Command('config');
  cmd.description('Manage project configuration (Sigma/project.config.json)');

  const set = cmd.command('set');
  set.description('Set a configuration value');

  set.command('language <lang>')
    .description(
      'Set the Director interaction language (e.g., "en", "id"). ' +
      'Artifact content (FMN-PLAN, DEV-EXEC, ROADMAP) is always written in English regardless of this setting.'
    )
    .action((lang: string) => {
      try {
        const projectRoot = findProjectRoot();
        const config = readProjectConfig(projectRoot);
        const prev = config.interaction_language;
        config.interaction_language = lang;
        writeProjectConfig(projectRoot, config);
        console.log(`Language preference updated.`);
        console.log(`  Interaction: ${prev} → ${lang} (${langLabel(lang)})`);
        console.log(`  Artifact content: English (unchanged)`);
        console.log('');
        console.log(`AI roles will read this setting at bootstrap and communicate in ${langLabel(lang)}.`);
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
        console.log(`Interaction language:     ${config.interaction_language} (${langLabel(config.interaction_language)})`);
        console.log(`Document language:        ${config.document_language} (${langLabel(config.document_language)})`);
        console.log(`Formal identifiers:       ${config.formal_identifier_language} (${langLabel(config.formal_identifier_language)})`);
        console.log('');
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
