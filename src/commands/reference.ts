import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { findProjectRoot } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import { REFERENCE_DIR, REFERENCE_LIST_FILE, REFERENCE_DATA_DIR } from '../config';

const LOCAL_ARTIFACT_HEADING = '## Local Artifact';

// Top-level only — a folder in data/ (e.g. statistics_data/ containing 2021.csv,
// 2022.csv, ...) is recorded as a single row for the folder, not one row per
// file nested inside it.
function listTopLevelEntries(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .map(entry => (entry.isDirectory() ? `${entry.name}/` : entry.name));
}

function splitTableCells(rowLine: string): string[] {
  const trimmed = rowLine.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map(cell => cell.trim());
}

function normalizePathCell(cell: string): string {
  return cell.replace(/^`|`$/g, '').trim();
}

const LOCAL_ARTIFACT_ID_PREFIX = 'LA';

function nextId(existingIds: string[], prefix: string): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const id of existingIds) {
    const match = id.match(pattern);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(2, '0')}`;
}

function runUpdate(): void {
  const projectRoot = findProjectRoot();
  const listPath = path.join(projectRoot, REFERENCE_LIST_FILE);
  const dataDir = path.join(projectRoot, REFERENCE_DATA_DIR);
  const referenceDir = path.join(projectRoot, REFERENCE_DIR);

  if (!fs.existsSync(listPath)) {
    copyTemplateToArtifact('REFERENCE-LIST-TEMPLATE.md', listPath);
    console.log('  reference-list.md was missing — scaffolded from template (self-heal).');
  }

  const content = fs.readFileSync(listPath, 'utf8');
  const lines = content.split(/\r?\n/);

  const localHeadingIdx = lines.findIndex(line => line.trim() === LOCAL_ARTIFACT_HEADING);
  if (localHeadingIdx === -1) {
    throw new Error(`reference-list.md is missing the "${LOCAL_ARTIFACT_HEADING}" section. Cannot sync.`);
  }

  let nextHeadingIdx = lines.findIndex((line, i) => i > localHeadingIdx && /^##\s+/.test(line.trim()));
  if (nextHeadingIdx === -1) nextHeadingIdx = lines.length;

  const tableRowIndices: number[] = [];
  for (let i = localHeadingIdx; i < nextHeadingIdx; i += 1) {
    if (lines[i].trim().startsWith('|')) tableRowIndices.push(i);
  }

  if (tableRowIndices.length < 2) {
    throw new Error('reference-list.md Local Artifact table is malformed (missing header/separator row).');
  }

  // First two matched rows are the header and separator; the rest are data rows.
  const dataRowIndices = tableRowIndices.slice(2);

  const existingPaths = new Set<string>();
  const existingIds: string[] = [];
  const missingFiles: string[] = [];
  for (const idx of dataRowIndices) {
    const cells = splitTableCells(lines[idx]);
    if (cells.length < 2) continue;
    const id = cells[0];
    const linkOrPath = normalizePathCell(cells[1]);
    existingIds.push(id);
    existingPaths.add(linkOrPath);

    if (!/^https?:\/\//i.test(linkOrPath)) {
      const absCandidate = path.join(referenceDir, linkOrPath);
      if (!fs.existsSync(absCandidate)) {
        missingFiles.push(`${id} ${linkOrPath}`);
      }
    }
  }

  const relPaths = listTopLevelEntries(dataDir).map(name => `data/${name}`);

  const newRows: string[] = [];
  for (const rel of relPaths) {
    if (!existingPaths.has(rel)) {
      const id = nextId(existingIds, LOCAL_ARTIFACT_ID_PREFIX);
      existingIds.push(id);
      newRows.push(`| ${id} | \`${rel}\` | [...] | [...] |`);
      existingPaths.add(rel);
    }
  }

  if (newRows.length > 0) {
    const insertAfter = tableRowIndices[tableRowIndices.length - 1];
    lines.splice(insertAfter + 1, 0, ...newRows);
    fs.writeFileSync(listPath, lines.join('\n'));
  }

  console.log(`Reference list synced: ${path.relative(projectRoot, listPath)}`);
  console.log(`  New local artifact rows added: ${newRows.length}`);
  console.log('  Existing rows: never modified (Category/Notes are a manual/AI-role judgment call).');

  if (missingFiles.length > 0) {
    console.log('  [WARNING] Local Artifact rows pointing to files no longer on disk (not removed — review manually):');
    for (const missing of missingFiles) {
      console.log(`    - ${missing}`);
    }
  }
}

export function referenceCommand(): Command {
  const cmd = new Command('reference');
  cmd.description('Manage the project-wide reference list (Comprehensive Research source index)');

  cmd
    .command('update')
    .description('Sync the Local Artifact table in Sigma/reference/reference-list.md from Sigma/reference/data/')
    .action(() => {
      try {
        runUpdate();
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
