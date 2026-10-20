import { Command } from 'commander';
import { findProjectRoot } from '../utils/fs';
import { readProjectConfig, writeProjectConfig, resolveAutoOutdateKeep, resolveMemoLimit, resolveGitignoreSigma, hasExplicitGitignoreSigma, DEFAULT_MAILBOX } from '../engine/projectConfig';
import { disableSigmaGitignore, enableSigmaGitignore, isGitignoreBlockApplied, persistGitignoreSetting } from '../services/gitignoreService';
import { warn } from '../utils/output';
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
    .option('--sigma-document', 'Set the Sigma document (INTENT/PLAN/EXEC/etc.) language')
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

  set.command('mailbox-outdate-keep <n>')
    .description(
      'Set how many most-recent READ messages `sigma inbox read` keeps before aging the rest to OUTDATED. ' +
      '0 disables the auto-sweep (mailbox.auto_outdate_read_keep).'
    )
    .action((n: string) => {
      try {
        const value = Number(n);
        if (!Number.isInteger(value) || value < 0) {
          throw new Error(`Expected a non-negative integer, got "${n}".`);
        }
        const projectRoot = findProjectRoot();
        const config = readProjectConfig(projectRoot);
        const prev = config.mailbox?.auto_outdate_read_keep;
        config.mailbox = { ...DEFAULT_MAILBOX, ...config.mailbox, auto_outdate_read_keep: value };
        writeProjectConfig(projectRoot, config);
        console.log(`Mailbox auto-outdate keep: ${prev ?? '(default)'} -> ${value}${value === 0 ? ' (auto-sweep disabled)' : ''}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  set.command('memo-limit <n>')
    .description(
      'Set the max unread MEMO count per INTENT and role (GENERAL separate) before `sigma memo write` is blocked (default 5). ' +
      '0 disables the memo feature (mailbox.memo_unread_limit).'
    )
    .action((n: string) => {
      try {
        const value = Number(n);
        if (!Number.isInteger(value) || value < 0) {
          throw new Error(`Expected a non-negative integer, got "${n}".`);
        }
        const projectRoot = findProjectRoot();
        const config = readProjectConfig(projectRoot);
        const prev = config.mailbox?.memo_unread_limit;
        config.mailbox = { ...DEFAULT_MAILBOX, ...config.mailbox, memo_unread_limit: value };
        writeProjectConfig(projectRoot, config);
        console.log(`Memo unread limit: ${prev ?? '(default)'} -> ${value}${value === 0 ? ' (memo disabled)' : ''}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  set.command('gitignore <mode>')
    .description(
      'Turn the Sigma .gitignore block on or off (git.gitignore_sigma, default on). ' +
      'on|activate|true|1: ignore every Sigma-generated file except .sigma-identity.json and detach already-tracked ones from the Git index (files stay on disk). ' +
      'off|deactivate|false|0: remove the block so Sigma files can be committed and pushed to another machine.'
    )
    .action((mode: string) => {
      try {
        const normalized = mode.trim().toLowerCase();
        const ON = ['on', 'activate', 'true', '1'];
        const OFF = ['off', 'deactivate', 'false', '0'];
        if (!ON.includes(normalized) && !OFF.includes(normalized)) {
          throw new Error(`Unknown mode "${mode}". Use on|activate|true|1 or off|deactivate|false|0.`);
        }
        const enable = ON.includes(normalized);
        const projectRoot = findProjectRoot();
        const prev = resolveGitignoreSigma(readProjectConfig(projectRoot));
        persistGitignoreSetting(projectRoot, enable);
        const report = enable ? enableSigmaGitignore(projectRoot) : disableSigmaGitignore(projectRoot);
        console.log(`Sigma Gitignore Mode: ${prev ? 'ON' : 'OFF'} -> ${enable ? 'ON' : 'OFF'}`);
        for (const line of report.lines) console.log('  ' + line);
        for (const line of report.warnings) warn(line);
        if (!enable) {
          console.log('  Next: commit and push the Sigma files from this machine, then `git pull` on the other machine.');
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
        const keep = resolveAutoOutdateKeep(config);
        console.log(`Mailbox Auto-Outdate Keep:     ${keep === 0 ? 'OFF' : keep}`);
        const memoLimit = resolveMemoLimit(config);
        console.log(`Memo Unread Limit:             ${memoLimit === 0 ? 'OFF (memo disabled)' : memoLimit}`);
        const gitignoreOn = resolveGitignoreSigma(config);
        const applied = isGitignoreBlockApplied(projectRoot);
        const origin = hasExplicitGitignoreSigma(config) ? '' : ' [default]';
        console.log(`Sigma Gitignore Mode:          ${gitignoreOn
          ? 'ON (active — only .sigma-identity.json tracked in Git)'
          : 'OFF (inactive — Sigma files can be tracked in Git)'}${origin}`);
        if (gitignoreOn && !applied) {
          console.log('                               (block not yet in .gitignore — run: sigma config set gitignore on)');
        }
        console.log('');
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
