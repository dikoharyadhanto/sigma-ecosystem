import fs from 'fs-extra';
import path from 'path';
import { PROJECT_DECISIONS_FILE } from '../config';

export interface DecisionEntry {
  artifact: 'INTENT' | 'ROADMAP' | 'PLAN' | 'EXEC' | 'CLOSE';
  version: string;
  lock_event: 'intent.lock' | 'roadmap.lock' | 'plan.lock' | 'exec.lock' | 'close.lock';
  source_file: string;
  timestamp: string;
  director_notes: string;
  risk_notes: string;
  evidence_references: string;
  // ROADMAP-specific
  stage_summary?: string;
  recommended_next_plan?: string;
  pending_items?: string;
  // PLAN-specific
  task_plan_summary?: string;
  test_contract_summary?: string;
  // EXEC-specific
  implementation_summary?: string;
  known_issues?: string;
  // CLOSE-specific
  plan_refs?: string;
  exec_refs?: string;
  closure_verdict?: string;
  accepted_limitations?: string;
}

type ArtifactKind = DecisionEntry['artifact'];

interface SectionSpec {
  field: keyof DecisionEntry;
  patterns: RegExp[];
  required?: boolean;
}

const SECTION_SPECS: Record<ArtifactKind, SectionSpec[]> = {
  INTENT: [
    { field: 'director_notes', patterns: [/^## .*director.*$/im] },
    { field: 'risk_notes', patterns: [/^## 8\. Risk/im] },
    { field: 'evidence_references', patterns: [/^## 2\. Success Definition/im], required: true },
  ],
  ROADMAP: [
    { field: 'director_notes', patterns: [/^## 9\. Director Roadmap Notes/im] },
    { field: 'risk_notes', patterns: [] },
    { field: 'evidence_references', patterns: [/^## 2\. Source Intent Alignment/im], required: true },
    { field: 'stage_summary', patterns: [/^## 3\. Stage Overview/im] },
    { field: 'recommended_next_plan', patterns: [/^## 8\. FMN Roadmap Notes/im] },
    { field: 'pending_items', patterns: [/^## 7\. Pending Items/im] },
  ],
  PLAN: [
    { field: 'director_notes', patterns: [/^## .*director.*$/im] },
    { field: 'risk_notes', patterns: [] },
    { field: 'evidence_references', patterns: [] },
    { field: 'task_plan_summary', patterns: [/^## 2\. Work Order/im], required: true },
    { field: 'test_contract_summary', patterns: [/^## 5\. Pre-Build Test Contract/im], required: true },
  ],
  EXEC: [
    { field: 'director_notes', patterns: [/^## .*director.*$/im] },
    { field: 'risk_notes', patterns: [] },
    { field: 'evidence_references', patterns: [] },
    { field: 'implementation_summary', patterns: [/^## 2\. Implementation Approach/im], required: true },
    { field: 'known_issues', patterns: [/^## .*known.*(issues|limitations).*$/im] },
  ],
  CLOSE: [
    { field: 'director_notes', patterns: [/^## 10\. Director Closure Decision Notes/im], required: true },
    { field: 'risk_notes', patterns: [] },
    { field: 'evidence_references', patterns: [/^## 3\. Evidence References/im], required: true },
    { field: 'plan_refs', patterns: [/^## 3\. Evidence References/im] },
    { field: 'exec_refs', patterns: [/^## 3\. Evidence References/im] },
    { field: 'closure_verdict', patterns: [/^## 10\. Director Closure Decision Notes/im] },
    { field: 'accepted_limitations', patterns: [/^## 6\. Known Limitations/im] },
  ],
};

// Returns the content of the section following `pattern` up to the next ## heading.
// Returns '' if the heading is not found. Never throws.
function extractSection(content: string, pattern: RegExp): string {
  const match = content.match(pattern);
  if (!match || match.index === undefined) return '';
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextHeading = rest.search(/^## /m);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  return normalizeSection(section);
}

function normalizeSection(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractFirstSection(content: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const value = extractSection(content, pattern);
    if (value) return value;
  }
  return '';
}

function extractSections(
  artifact: ArtifactKind,
  content: string,
  sourceFile: string
): Partial<DecisionEntry> {
  const extracted: Partial<DecisionEntry> = {};
  for (const spec of SECTION_SPECS[artifact]) {
    const value = extractFirstSection(content, spec.patterns);
    (extracted as Record<string, string>)[spec.field] = value;
    if (spec.required && !value) {
      process.stderr.write(`[harvest] ${artifact} ${sourceFile}: missing expected section for ${String(spec.field)}\n`);
    }
  }
  return extracted;
}

function appendEntry(projectRoot: string, entry: DecisionEntry): void {
  const filePath = path.join(projectRoot, PROJECT_DECISIONS_FILE);
  fs.ensureFileSync(filePath);
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}

export function harvestIntentLock(projectRoot: string, version: string, sourceFile: string): void {
  try {
    if (!sourceFile) return;
    const absPath = path.join(projectRoot, sourceFile);
    if (!fs.existsSync(absPath)) {
      process.stderr.write(`[harvest] source file not found — skipping: ${sourceFile}\n`);
      return;
    }
    const content = fs.readFileSync(absPath, 'utf8');
    const entry: DecisionEntry = {
      artifact: 'INTENT',
      version,
      lock_event: 'intent.lock',
      source_file: sourceFile,
      timestamp: new Date().toISOString(),
      director_notes: '',
      risk_notes: '',
      evidence_references: '',
      ...extractSections('INTENT', content, sourceFile),
    };
    appendEntry(projectRoot, entry);
  } catch (e) {
    process.stderr.write(`[harvest] intent.lock error — skipping: ${(e as Error).message}\n`);
  }
}

export function harvestRoadmapLock(projectRoot: string, version: string, sourceFile: string): void {
  try {
    if (!sourceFile) return;
    const absPath = path.join(projectRoot, sourceFile);
    if (!fs.existsSync(absPath)) {
      process.stderr.write(`[harvest] source file not found — skipping: ${sourceFile}\n`);
      return;
    }
    const content = fs.readFileSync(absPath, 'utf8');
    const entry: DecisionEntry = {
      artifact: 'ROADMAP',
      version,
      lock_event: 'roadmap.lock',
      source_file: sourceFile,
      timestamp: new Date().toISOString(),
      risk_notes: '',
      director_notes: '',
      evidence_references: '',
      ...extractSections('ROADMAP', content, sourceFile),
    };
    appendEntry(projectRoot, entry);
  } catch (e) {
    process.stderr.write(`[harvest] roadmap.lock error — skipping: ${(e as Error).message}\n`);
  }
}

export function harvestPlanLock(projectRoot: string, version: string, sourceFile: string): void {
  try {
    if (!sourceFile) return;
    const absPath = path.join(projectRoot, sourceFile);
    if (!fs.existsSync(absPath)) {
      process.stderr.write(`[harvest] source file not found — skipping: ${sourceFile}\n`);
      return;
    }
    const content = fs.readFileSync(absPath, 'utf8');
    const entry: DecisionEntry = {
      artifact: 'PLAN',
      version,
      lock_event: 'plan.lock',
      source_file: sourceFile,
      timestamp: new Date().toISOString(),
      director_notes: '',
      risk_notes: '',
      evidence_references: '',
      ...extractSections('PLAN', content, sourceFile),
    };
    appendEntry(projectRoot, entry);
  } catch (e) {
    process.stderr.write(`[harvest] plan.lock error — skipping: ${(e as Error).message}\n`);
  }
}

export function harvestExecLock(projectRoot: string, version: string, sourceFile: string): void {
  try {
    if (!sourceFile) return;
    const absPath = path.join(projectRoot, sourceFile);
    if (!fs.existsSync(absPath)) {
      process.stderr.write(`[harvest] source file not found — skipping: ${sourceFile}\n`);
      return;
    }
    const content = fs.readFileSync(absPath, 'utf8');
    const entry: DecisionEntry = {
      artifact: 'EXEC',
      version,
      lock_event: 'exec.lock',
      source_file: sourceFile,
      timestamp: new Date().toISOString(),
      director_notes: '',
      risk_notes: '',
      evidence_references: '',
      ...extractSections('EXEC', content, sourceFile),
    };
    appendEntry(projectRoot, entry);
  } catch (e) {
    process.stderr.write(`[harvest] exec.lock error — skipping: ${(e as Error).message}\n`);
  }
}

export function harvestCloseLock(projectRoot: string, version: string, sourceFile: string): void {
  try {
    if (!sourceFile) return;
    const absPath = path.join(projectRoot, sourceFile);
    if (!fs.existsSync(absPath)) {
      process.stderr.write(`[harvest] source file not found — skipping: ${sourceFile}\n`);
      return;
    }
    const content = fs.readFileSync(absPath, 'utf8');
    const sections = extractSections('CLOSE', content, sourceFile);
    const evidenceRefs = sections.evidence_references ?? '';
    const closureVerdict = sections.director_notes ?? '';
    const entry: DecisionEntry = {
      artifact: 'CLOSE',
      version,
      lock_event: 'close.lock',
      source_file: sourceFile,
      timestamp: new Date().toISOString(),
      director_notes: closureVerdict,
      risk_notes: '',
      evidence_references: evidenceRefs,
      plan_refs: evidenceRefs,
      exec_refs: evidenceRefs,
      closure_verdict: closureVerdict,
      accepted_limitations: '',
      ...sections,
    };
    appendEntry(projectRoot, entry);
  } catch (e) {
    process.stderr.write(`[harvest] close.lock error — skipping: ${(e as Error).message}\n`);
  }
}

// Creates Sigma/memory/decisions.jsonl as an empty file if it does not exist.
// Non-blocking — any error is printed to stderr and not thrown.
export function initDecisionsFile(projectRoot: string): void {
  try {
    const filePath = path.join(projectRoot, PROJECT_DECISIONS_FILE);
    fs.ensureFileSync(filePath);
  } catch (e) {
    process.stderr.write(`[memory] failed to initialize decisions.jsonl: ${(e as Error).message}\n`);
  }
}
