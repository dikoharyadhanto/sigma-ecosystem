import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { findProjectRoot, toPosix } from '../utils/fs';
import { scanForSigmaTerminology, loadTerminologyList } from '../engine/terminologyScanner';
import { PROJECT_SIGMA_DIR } from '../config';

// PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §2.10 — standalone, top-level (not
// nested under `notion`/`humanize`): use case is broader than either
// pipeline — checking source code or any document before it's shared or
// published externally, independent of Notion entirely. Read-only, never
// touches gate/lock/chain state.
const SIGMA_ARTIFACT_PATTERNS = [/^DIR-INTENT-/, /^FMN-PLAN-/, /^DEV-EXEC-/, /^ROADMAP-/, /^DIR-CLOSE-/];

function isSigmaArtifactFile(filename: string): boolean {
  return SIGMA_ARTIFACT_PATTERNS.some(p => p.test(filename));
}

function timestampSlug(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export function scanCommand(): Command {
  const cmd = new Command('scan');
  cmd
    .description('Scan a file for Sigma terminology before sharing or publishing it externally')
    .requiredOption('--file <path>', 'File to scan (relative to the current directory, or absolute)')
    .action((opts: { file: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const targetPath = path.isAbsolute(opts.file) ? opts.file : path.resolve(process.cwd(), opts.file);

        if (!fs.existsSync(targetPath)) {
          console.error(chalk.red(`Error: ${opts.file} does not exist.`));
          process.exit(1);
        }

        const filename = path.basename(targetPath);
        if (isSigmaArtifactFile(filename)) {
          console.log(
            `Skipped: ${filename} is a Sigma artifact file — it is expected to contain Sigma\n` +
            'terminology by design. `sigma scan` does not apply to DIR-INTENT/FMN-PLAN/DEV-EXEC/\n' +
            'ROADMAP/DIR-CLOSE source artifacts.'
          );
          return;
        }

        const content = fs.readFileSync(targetPath, 'utf8');
        const terminology = loadTerminologyList(projectRoot);
        const matches = scanForSigmaTerminology(content, terminology);

        if (matches.length === 0) {
          console.log(`No Sigma terminology detected in ${opts.file}.`);
          return;
        }

        const logsDir = path.join(projectRoot, PROJECT_SIGMA_DIR, 'logs');
        fs.ensureDirSync(logsDir);
        const logFileName = `${timestampSlug(new Date())}_terminology-scan.log`;
        const logRelPath = toPosix(path.join(PROJECT_SIGMA_DIR, 'logs', logFileName));
        const logAbsPath = path.join(logsDir, logFileName);

        const lines: string[] = [];
        lines.push(`Sigma terminology scan — ${opts.file}`);
        lines.push(`Scanned at: ${new Date().toISOString()}`);
        lines.push('');
        for (const m of matches) {
          lines.push(`  Line ${m.line}: "${m.lineText}"`);
          lines.push(`           ^ ${m.term}`);
        }
        lines.push('');
        lines.push(`${matches.length} term(s) found. Review and reword before sharing this file externally.`);
        fs.writeFileSync(logAbsPath, lines.join('\n') + '\n', 'utf8');

        console.log(`${matches.length} term(s) detected. Full report: ${logRelPath}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });
  return cmd;
}
