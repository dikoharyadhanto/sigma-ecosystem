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

// Returns the content of the section following `pattern` up to the next ## heading.
// Returns '' if the heading is not found. Never throws.
function extractSection(content: string, pattern: RegExp): string {
  const match = content.match(pattern);
  if (!match || match.index === undefined) return '';
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextHeading = rest.search(/^## /m);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  return section.trim();
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
      director_notes: extractSection(content, /^## .*director/im),
      risk_notes: extractSection(content, /^## 8\. Risk/im),
      evidence_references: extractSection(content, /^## 2\. Success Definition/im),
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
      director_notes: extractSection(content, /^## 9\. Director Roadmap Notes/im),
      risk_notes: '',
      evidence_references: extractSection(content, /^## 2\. Source Intent Alignment/im),
      stage_summary: extractSection(content, /^## 3\. Stage Overview/im),
      recommended_next_plan: extractSection(content, /^## 8\. FMN Roadmap Notes/im),
      pending_items: extractSection(content, /^## 7\. Pending Items/im),
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
      director_notes: extractSection(content, /^## .*director/im),
      risk_notes: '',
      evidence_references: '',
      task_plan_summary: extractSection(content, /^## 2\. Work Order/im),
      test_contract_summary: extractSection(content, /^## 5\. Pre-Build Test Contract/im),
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
      director_notes: extractSection(content, /^## .*director/im),
      risk_notes: '',
      evidence_references: '',
      implementation_summary: extractSection(content, /^## 2\. Implementation Approach/im),
      known_issues: extractSection(content, /^## .*known.*(issues|limitations)/im),
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
    const evidenceRefs = extractSection(content, /^## 3\. Evidence References/im);
    const closureVerdict = extractSection(content, /^## 10\. Director Closure Decision Notes/im);
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
      accepted_limitations: extractSection(content, /^## 6\. Known Limitations/im),
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
