// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, Stage E W1 — the one
// use-case shared by `sigma reference update` (CLI) and
// `sigma_update_reference` (MCP control tool). Transport-agnostic on
// purpose: no Commander, no console.log — returns structured data the
// caller formats.
//
// Unlike every other Stage E primitive so far, this operation never reads
// or writes progress-v<N>.json at all ("Not tracked... no gate, no lock
// state" — Sigma/SIGMA-OPERATION-REGISTRY.json's own gating note, confirmed
// against the code: no chain.ts import anywhere in this file or the CLI
// command it replaces).

import fs from 'fs-extra';
import path from 'path';
import { copyTemplateToArtifact } from '../utils/artifacts';
import { REFERENCE_DIR, REFERENCE_LIST_FILE, REFERENCE_DATA_DIR } from '../config';

export class ReferenceUpdateError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ReferenceUpdateError';
  }
}

export interface UpdateReferenceListResult {
  relPath: string;
  scaffolded: boolean;
  newRowsAdded: number;
  missingFiles: string[];
}

const LOCAL_ARTIFACT_HEADING = '## Local Artifact';
const LOCAL_ARTIFACT_ID_PREFIX = 'LA';

// Top-level only — a folder in data/ (e.g. statistics_data/ containing
// 2021.csv, 2022.csv, ...) is recorded as a single row for the folder, not
// one row per file nested inside it.
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

function nextId(existingIds: string[], prefix: string): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const id of existingIds) {
    const match = id.match(pattern);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(2, '0')}`;
}

export function referenceUpdateTransactionFiles(projectRoot: string): string[] {
  return [path.join(projectRoot, REFERENCE_LIST_FILE)];
}

export function updateReferenceList(projectRoot: string): UpdateReferenceListResult {
  const listPath = path.join(projectRoot, REFERENCE_LIST_FILE);
  const dataDir = path.join(projectRoot, REFERENCE_DATA_DIR);
  const referenceDir = path.join(projectRoot, REFERENCE_DIR);

  let scaffolded = false;
  if (!fs.existsSync(listPath)) {
    copyTemplateToArtifact('REFERENCE-LIST-TEMPLATE.md', listPath);
    scaffolded = true;
  }

  const content = fs.readFileSync(listPath, 'utf8');
  const lines = content.split(/\r?\n/);

  const localHeadingIdx = lines.findIndex(line => line.trim() === LOCAL_ARTIFACT_HEADING);
  if (localHeadingIdx === -1) {
    throw new ReferenceUpdateError('INVALID_OPERATION', `reference-list.md is missing the "${LOCAL_ARTIFACT_HEADING}" section. Cannot sync.`);
  }

  let nextHeadingIdx = lines.findIndex((line, i) => i > localHeadingIdx && /^##\s+/.test(line.trim()));
  if (nextHeadingIdx === -1) nextHeadingIdx = lines.length;

  const tableRowIndices: number[] = [];
  for (let i = localHeadingIdx; i < nextHeadingIdx; i += 1) {
    if (lines[i].trim().startsWith('|')) tableRowIndices.push(i);
  }

  if (tableRowIndices.length < 2) {
    throw new ReferenceUpdateError('INVALID_OPERATION', 'reference-list.md Local Artifact table is malformed (missing header/separator row).');
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

  return {
    relPath: path.relative(projectRoot, listPath),
    scaffolded,
    newRowsAdded: newRows.length,
    missingFiles,
  };
}
