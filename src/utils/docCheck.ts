import fs from 'fs-extra';
import path from 'path';

export type SigmaDocDomain = 'intent' | 'roadmap' | 'plan' | 'exec' | 'close';

interface SigmaDocSpec {
  heading: string;
  expectedType: string;
  fallbackPath: string;
  requiredSections: string[];
}

interface MarkerMatch {
  raw: string;
  line: number;
}

interface SectionMarker {
  artifactType: string;
  sectionId: string;
  line: number;
  headingLine: number | null;
  headingText: string | null;
}

/**
 * A lock requirement is content-aware (unlike structural errors/warnings): it reflects
 * whether a decision recorded in the document (a verdict, a checklist item, a narrative
 * field) satisfies what `sigma {domain} lock` requires. `scope: 'conditional'` marks a
 * requirement that only appears in the list when its own condition applies (e.g. the
 * SKIP_FOR_AUDIT verbatim instruction) — it still blocks lock like any other requirement
 * once present, it just isn't always relevant enough to show.
 */
export interface SigmaDocRequirement {
  label: string;
  satisfied: boolean;
  scope: 'lock' | 'conditional';
}

export interface SigmaDocCheckReport {
  ok: boolean;
  heading: string;
  file: string;
  documentType: string | null;
  schema: string | null;
  errors: string[];
  warnings: string[];
  passes: string[];
  /**
   * Lock Requirements — content-aware gate results. Never affects `ok`/exit code of
   * `check`; only `lock` treats an unsatisfied requirement as blocking (see
   * `ensureSigmaDocEligible`). Computed unconditionally by both `check` and `lock` calls
   * to `validateSigmaDocFile` so the two commands can never disagree about what is
   * required — see PLAN-EVAL-11 Bagian A.5, "Lock Validation Equivalence".
   */
  requirements: SigmaDocRequirement[];
}

const VERDICT_SECTION_ID: Partial<Record<SigmaDocDomain, string>> = {
  intent: 'AUD_FINDINGS_ADVISORY_ONLY',
  plan: 'AUD_FINDINGS',
};

const VERDICT_CHECKBOX_LABELS = new Set([
  'PASS',
  'PASS_WITH_RISK',
  'REVISE',
  'REJECT_RECOMMENDED',
  'PROMOTE_TO_HEAVIER_PROCESS',
  'OTHER',
  'SKIP_FOR_AUDIT',
]);

const FINAL_CHECKLIST_SECTION_ID = 'FINAL_VALIDATION_CHECKLIST';
const QUALITY_BAR_SECTION_ID = 'QUALITY_BAR';
const CONDITIONAL_REQUIREMENT_HEADING = /^###\s*13\.2\s+Conditional Requirement/i;

const QUALITY_BAR_CHECKLIST_PHRASES = [
  'Security minimum standard',
  'UX Trust minimum standard',
  'UI / Product Packaging minimum standard',
  'Performance / Cost minimum standard',
];

const QUALITY_BAR_DIMENSIONS = ['Security', 'UX Trust', 'UI / Product Packaging', 'Performance / Cost'];

const EXEC_VERDICT_SECTION_ID = 'FMN_POST_BUILD_REVIEW';
const EXEC_VERDICT_LABELS = new Set([
  'READY_FOR_LOCK',
  'NEEDS_DEV_UPDATE',
  'REVISION_REQUIRED',
  'COMPLETE_WITH_RISK',
  'OTHER',
]);

const CLOSE_VERDICT_SECTION_ID = 'CLOSURE_DECISION';
const CLOSE_VERDICT_LABELS = new Set([
  'CLOSE_ACCEPTED',
  'CLOSE_ACCEPTED_WITH_LIMITATIONS',
  'DO_NOT_CLOSE',
  'OPEN_NEW_PLAN',
  'UPDATE_CURRENT_EXEC',
  'OTHER',
]);
const CLOSE_VERDICT_ALLOWED_LABELS = new Set(['CLOSE_ACCEPTED', 'CLOSE_ACCEPTED_WITH_LIMITATIONS']);

const FINAL_DIRECTOR_DECISION_SECTION_ID = 'FINAL_DIRECTOR_DECISION';

const DOC_SPECS: Record<SigmaDocDomain, SigmaDocSpec> = {
  intent: {
    heading: 'Sigma Intent Check',
    expectedType: 'DIR_INTENT',
    fallbackPath: path.join('Sigma', 'design', 'DIR-INTENT.md'),
    requiredSections: [
      'INTENT_CORE',
      'COMPREHENSIVE_RESEARCH',
      'SUCCESS_DEFINITION',
      'QUALITY_BAR',
      'STRATEGIC_TRADE_OFFS',
      'SCOPE_BOUNDARY',
      'CONSTRAINTS_AND_PREFERENCES',
      'TECHNICAL_AND_ARCHITECTURE_DIRECTION',
      'FUNCTIONAL_REQUIREMENTS',
      'RISK_AND_FAILURE_DEFINITION',
      'EXECUTION_DIRECTION_FOR_FMN',
      'AUD_FINDINGS_ADVISORY_ONLY',
      'FINAL_VALIDATION_CHECKLIST',
    ],
  },
  roadmap: {
    heading: 'Sigma Roadmap Check',
    expectedType: 'ROADMAP',
    fallbackPath: path.join('Sigma', 'build', 'ROADMAP.md'),
    requiredSections: [
      'OVERVIEW',
      'CORE_PROCESS_FLOW',
      'STAGE_OVERVIEW',
    ],
  },
  plan: {
    heading: 'Sigma Plan Check',
    expectedType: 'FMN_PLAN',
    fallbackPath: path.join('Sigma', 'build', 'FMN-PLAN.md'),
    requiredSections: [
      'SOURCE_ALIGNMENT',
      'WORK_ORDER_TASK_PLAN',
      'ACCEPTANCE_CRITERIA',
      'IMPLEMENTATION_CONSTRAINTS',
      'PRE_BUILD_TEST_CONTRACT',
      'DEV_HANDOFF_INSTRUCTIONS',
      'AUD_FINDINGS',
      'DIRECTORS_SUMMARY',
    ],
  },
  exec: {
    heading: 'Sigma Exec Check',
    expectedType: 'DEV_EXEC',
    fallbackPath: path.join('Sigma', 'build', 'DEV-EXEC.md'),
    requiredSections: [
      'SOURCE_PLAN_ALIGNMENT',
      'DEV_PRE_BUILD_ASSESSMENT',
      'IMPLEMENTATION_APPROACH',
      'FILES_COMPONENTS_TO_CHANGE',
      'KEY_TECHNICAL_DECISIONS',
      'FMN_PRE_BUILD_REVIEW',
      'IMPLEMENTATION_WALKTHROUGH',
      'DEVIATIONS_FROM_FMN_PLAN',
      'DEPENDENCY_ENVIRONMENT_CHANGES',
      'DEVELOPER_VERIFICATION',
      'GIT_CHANGE_EVIDENCE',
      'ISSUES_ENCOUNTERED',
      'KNOWN_LIMITATIONS_TECH_DEBT',
      'DEV_COMPLETION_STATEMENT',
      'FMN_POST_BUILD_REVIEW',
      'DIRECTOR_OBSERVATION_REPORT_MINOR_REQUESTS',
      'DIRECTORS_SUMMARY',
    ],
  },
  close: {
    heading: 'Sigma Close Check',
    expectedType: 'DIR_CLOSE',
    fallbackPath: path.join('Sigma', 'close', 'DIR-CLOSE.md'),
    requiredSections: [
      'CLOSURE_DECISION',
      'HUMAN_PROJECT_STORY',
      'DELIVERED_STATE',
      'INTENT_SATISFACTION',
      'EVIDENCE_MAP',
      'LIMITATIONS_DEVIATIONS_CORRECTIONS',
      'OPERATIONAL_HANDOFF_NOTES',
      'NEW_INTENT_BOUNDARY',
      'FINAL_DIRECTOR_DECISION',
    ],
  },
};

function parseDocMarker(line: string): { type: string; schema: string } | null {
  const match = line.match(/^<!--\s*SIGMA:DOC\s+type=([A-Z_]+)\s+schema=(\S+)\s*-->$/);
  if (!match) return null;
  return { type: match[1], schema: match[2] };
}

function parseSectionMarker(line: string): { artifactType: string; sectionId: string } | null {
  const match = line.match(/^<!--\s*SIGMA:([A-Z_]+):SECTION:([A-Z0-9_]+)(?:\s+[^>]*)?\s*-->$/);
  if (!match) return null;
  return { artifactType: match[1], sectionId: match[2] };
}

function nextNonEmptyLine(lines: string[], startIndex: number): { index: number; text: string } | null {
  for (let i = startIndex; i < lines.length; i += 1) {
    const text = lines[i];
    if (text.trim().length > 0) return { index: i, text };
  }
  return null;
}

function pushResult(condition: boolean, successMessage: string, failureMessage: string, passes: string[], errors: string[]): void {
  if (condition) passes.push(successMessage);
  else errors.push(failureMessage);
}

/** End boundary (exclusive) of a marked section's body: the line before the next marker, or EOF. */
function sectionEndLine(relevantMarkers: SectionMarker[], marker: SectionMarker, totalLines: number): number {
  const laterMarkers = relevantMarkers
    .filter(m => m.line > marker.line)
    .sort((a, b) => a.line - b.line);
  return laterMarkers.length > 0 ? laterMarkers[0].line - 1 : totalLines;
}

/** Labels ticked (`- [x] LABEL`) within `lines[start, end)`, restricted to a known label set. */
function scanTickedLabels(lines: string[], start: number, end: number, labelSet: Set<string>): string[] {
  const ticked: string[] = [];
  for (let i = start; i < end; i += 1) {
    const match = lines[i].match(/^-\s*\[([ xX])\]\s*([A-Z_]+)/);
    if (match && labelSet.has(match[2]) && /x/i.test(match[1])) {
      ticked.push(match[2]);
    }
  }
  return ticked;
}

/** First non-empty line of prose directly under a heading matching `headingRegex`, within `[start, end)`. */
function findHeadingBody(lines: string[], start: number, end: number, headingRegex: RegExp): string | null {
  let headingIndex = -1;
  for (let i = start; i < end; i += 1) {
    if (headingRegex.test(lines[i].trim())) {
      headingIndex = i;
      break;
    }
  }
  if (headingIndex === -1) return null;

  let bodyEnd = end;
  for (let i = headingIndex + 1; i < end; i += 1) {
    if (/^#{2,3}\s+/.test(lines[i].trim())) {
      bodyEnd = i;
      break;
    }
  }

  const next = nextNonEmptyLine(lines, headingIndex + 1);
  if (!next || next.index >= bodyEnd) return null;
  return next.text.trim();
}

function isPlaceholderContent(text: string | null): boolean {
  if (!text) return true;
  return /^\[.*\]$/.test(text.trim());
}

function evaluateAudVerdictGate(
  domain: SigmaDocDomain,
  relevantMarkers: SectionMarker[],
  lines: string[],
  requirements: SigmaDocRequirement[],
  passes: string[],
  warnings: string[],
): void {
  const verdictSectionId = VERDICT_SECTION_ID[domain];
  if (!verdictSectionId) return;
  const marker = relevantMarkers.find(m => m.sectionId === verdictSectionId);
  if (!marker) return;

  const end = sectionEndLine(relevantMarkers, marker, lines.length);
  const ticked = scanTickedLabels(lines, marker.line, end, VERDICT_CHECKBOX_LABELS);

  let verbatimValue: string | null = null;
  for (let i = marker.line; i < end; i += 1) {
    const verbatimMatch = lines[i].match(/Director Instruction \(verbatim\)[^:]*:\s*(.*)$/);
    if (verbatimMatch) verbatimValue = verbatimMatch[1].trim();
  }

  requirements.push({ label: 'AUD Advisory Verdict recorded (exactly one)', satisfied: ticked.length === 1, scope: 'lock' });

  if (ticked.length === 0) {
    warnings.push('AUD Advisory Verdict: no verdict checkbox is checked — exactly one is required before lock');
  } else if (ticked.length > 1) {
    warnings.push(`AUD Advisory Verdict: more than one verdict checkbox is checked (${ticked.join(', ')}) — exactly one is required`);
  } else {
    passes.push(`AUD Advisory Verdict: exactly one checkbox checked (${ticked[0]})`);
    if (ticked[0] === 'SKIP_FOR_AUDIT') {
      const isEmpty = !verbatimValue || verbatimValue.length === 0 || verbatimValue === '[...]';
      requirements.push({
        label: 'Director Instruction (verbatim) recorded for SKIP_FOR_AUDIT',
        satisfied: !isEmpty,
        scope: 'conditional',
      });
      if (isEmpty) {
        warnings.push('AUD Advisory Verdict: SKIP_FOR_AUDIT is checked but "Director Instruction (verbatim)" is empty — the Director\'s instruction must be recorded verbatim before lock');
      } else {
        passes.push('AUD Advisory Verdict: SKIP_FOR_AUDIT has a recorded Director Instruction');
      }
    }
  }
}

function evaluateFinalChecklistGate(
  relevantMarkers: SectionMarker[],
  lines: string[],
  requirements: SigmaDocRequirement[],
): void {
  const checklistMarker = relevantMarkers.find(m => m.sectionId === FINAL_CHECKLIST_SECTION_ID);
  if (checklistMarker) {
    const checklistEnd = sectionEndLine(relevantMarkers, checklistMarker, lines.length);

    let lockRequirementEnd = checklistEnd;
    for (let i = checklistMarker.line; i < checklistEnd; i += 1) {
      if (CONDITIONAL_REQUIREMENT_HEADING.test(lines[i].trim())) {
        lockRequirementEnd = i;
        break;
      }
    }

    for (let i = checklistMarker.line; i < lockRequirementEnd; i += 1) {
      const checkboxMatch = lines[i].match(/^-\s*\[([ xX])\]\s*(.+)$/);
      if (!checkboxMatch) continue;
      const text = checkboxMatch[2].trim();
      const isQualityBarItem = QUALITY_BAR_CHECKLIST_PHRASES.some(phrase => text.includes(phrase));
      if (isQualityBarItem) continue;
      requirements.push({ label: text, satisfied: /x/i.test(checkboxMatch[1]), scope: 'lock' });
    }
  }

  const qualityBarMarker = relevantMarkers.find(m => m.sectionId === QUALITY_BAR_SECTION_ID);
  if (qualityBarMarker) {
    const qualityBarEnd = sectionEndLine(relevantMarkers, qualityBarMarker, lines.length);
    for (let i = qualityBarMarker.line; i < qualityBarEnd; i += 1) {
      const rowMatch = lines[i].match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
      if (!rowMatch) continue;
      const dimension = rowMatch[1].trim();
      if (!QUALITY_BAR_DIMENSIONS.includes(dimension)) continue;
      const standardCell = rowMatch[2].trim();
      requirements.push({
        label: `Quality Bar — ${dimension} minimum standard stated or N/A`,
        satisfied: !/^\[.*\]$/.test(standardCell),
        scope: 'lock',
      });
    }
  }
}

function evaluateExecVerdictGate(
  relevantMarkers: SectionMarker[],
  lines: string[],
  requirements: SigmaDocRequirement[],
  passes: string[],
  warnings: string[],
): void {
  const marker = relevantMarkers.find(m => m.sectionId === EXEC_VERDICT_SECTION_ID);
  if (!marker) return;

  const end = sectionEndLine(relevantMarkers, marker, lines.length);
  const ticked = scanTickedLabels(lines, marker.line, end, EXEC_VERDICT_LABELS);

  requirements.push({
    label: 'FMN Post-Build Advisory Verdict recorded (exactly one)',
    satisfied: ticked.length === 1,
    scope: 'lock',
  });

  if (ticked.length === 0) {
    warnings.push('FMN Post-Build Advisory Verdict: no verdict checkbox is checked — exactly one is required before lock');
  } else if (ticked.length > 1) {
    warnings.push(`FMN Post-Build Advisory Verdict: more than one verdict checkbox is checked (${ticked.join(', ')}) — exactly one is required`);
  } else {
    // Verdict-agnostic by design (PLAN-EVAL-11 Bagian B): FMN is advisory, not approval
    // authority, so which verdict is checked never affects whether this is satisfied.
    passes.push(`FMN Post-Build Advisory Verdict: exactly one checkbox checked (${ticked[0]})`);
  }
}

function evaluateCloseVerdictGate(
  relevantMarkers: SectionMarker[],
  lines: string[],
  requirements: SigmaDocRequirement[],
  passes: string[],
  warnings: string[],
): void {
  const marker = relevantMarkers.find(m => m.sectionId === CLOSE_VERDICT_SECTION_ID);
  if (!marker) return;

  const end = sectionEndLine(relevantMarkers, marker, lines.length);
  const ticked = scanTickedLabels(lines, marker.line, end, CLOSE_VERDICT_LABELS);
  const recorded = ticked.length === 1;

  requirements.push({ label: 'Closure Decision verdict recorded (exactly one)', satisfied: recorded, scope: 'lock' });

  if (ticked.length === 0) {
    warnings.push('Closure Decision: no verdict checkbox is checked — exactly one is required before lock');
  } else if (ticked.length > 1) {
    warnings.push(`Closure Decision: more than one verdict checkbox is checked (${ticked.join(', ')}) — exactly one is required`);
  }

  // Verdict-aware by design (PLAN-EVAL-11 Bagian C): the verdict here is Director's own
  // closure decision, not an advisory role's — so unlike exec, its content does gate lock.
  const permits = recorded && CLOSE_VERDICT_ALLOWED_LABELS.has(ticked[0]);
  requirements.push({
    label: 'Closure Decision verdict permits lock (CLOSE_ACCEPTED or CLOSE_ACCEPTED_WITH_LIMITATIONS)',
    satisfied: permits,
    scope: 'lock',
  });

  if (recorded) {
    if (permits) {
      passes.push(`Closure Decision: verdict "${ticked[0]}" permits close lock`);
    } else {
      warnings.push(`Closure Decision: verdict "${ticked[0]}" does not permit close lock — allowed verdicts are CLOSE_ACCEPTED, CLOSE_ACCEPTED_WITH_LIMITATIONS`);
    }
  }
}

function evaluateFinalDirectorDecisionGate(
  relevantMarkers: SectionMarker[],
  lines: string[],
  requirements: SigmaDocRequirement[],
  passes: string[],
  warnings: string[],
): void {
  const marker = relevantMarkers.find(m => m.sectionId === FINAL_DIRECTOR_DECISION_SECTION_ID);
  if (!marker) return;

  const end = sectionEndLine(relevantMarkers, marker, lines.length);

  const reasonText = findHeadingBody(lines, marker.line, end, /^###\s*Reason\s*$/i);
  const reasonSatisfied = !isPlaceholderContent(reasonText);
  requirements.push({ label: 'Final Director Decision — Reason is stated (not placeholder)', satisfied: reasonSatisfied, scope: 'lock' });
  if (reasonSatisfied) {
    passes.push('Final Director Decision: Reason is stated');
  } else {
    warnings.push('Final Director Decision: Reason is still a placeholder — state the actual reason before lock');
  }

  const sentenceText = findHeadingBody(lines, marker.line, end, /^###\s*Closure Sentence\s*$/i);
  const sentenceSatisfied = !isPlaceholderContent(sentenceText);
  requirements.push({ label: 'Final Director Decision — Closure Sentence is stated (not placeholder)', satisfied: sentenceSatisfied, scope: 'lock' });
  if (sentenceSatisfied) {
    passes.push('Final Director Decision: Closure Sentence is stated');
  } else {
    warnings.push('Final Director Decision: Closure Sentence is still a placeholder — state the actual sentence before lock');
  }
}

export function validateSigmaDocFile(
  absPath: string,
  domain: SigmaDocDomain,
): SigmaDocCheckReport {
  const spec = DOC_SPECS[domain];
  const content = fs.readFileSync(absPath, 'utf8');
  const lines = content.split(/\r?\n/);

  const docMarkers: MarkerMatch[] = [];
  const sectionMarkers: SectionMarker[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const passes: string[] = [];

  let documentType: string | null = null;
  let schema: string | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const docMarker = parseDocMarker(line);
    if (docMarker) {
      docMarkers.push({ raw: line, line: i + 1 });
      if (!documentType) {
        documentType = docMarker.type;
        schema = docMarker.schema;
      }
      continue;
    }

    const sectionMarker = parseSectionMarker(line);
    if (sectionMarker) {
      const nextLine = nextNonEmptyLine(lines, i + 1);
      const headingIsH2 = nextLine ? /^##\s+/.test(nextLine.text.trim()) : false;
      sectionMarkers.push({
        artifactType: sectionMarker.artifactType,
        sectionId: sectionMarker.sectionId,
        line: i + 1,
        headingLine: headingIsH2 && nextLine ? nextLine.index + 1 : null,
        headingText: headingIsH2 && nextLine ? nextLine.text.trim() : null,
      });
    }
  }

  pushResult(docMarkers.length > 0, 'Document marker found', 'Missing document marker', passes, errors);
  if (docMarkers.length > 1) {
    errors.push(`Duplicate document marker found (${docMarkers.length})`);
  } else if (docMarkers.length === 1 && documentType === spec.expectedType) {
    passes.push('Document type matches command context');
  } else if (docMarkers.length === 1) {
    errors.push(`Document type mismatch: expected ${spec.expectedType}, found ${documentType ?? 'unknown'}`);
  }

  if (schema) {
    passes.push(`Schema detected: ${schema}`);
  }

  const relevantMarkers = sectionMarkers.filter(marker => marker.artifactType === spec.expectedType);
  const foreignMarkers = sectionMarkers.filter(marker => marker.artifactType !== spec.expectedType);

  if (foreignMarkers.length > 0) {
    warnings.push(
      `Foreign section markers found: ${foreignMarkers.map(marker => `${marker.artifactType}:${marker.sectionId}`).join(', ')}`
    );
  }

  const markerMap = new Map<string, SectionMarker[]>();
  for (const marker of relevantMarkers) {
    const bucket = markerMap.get(marker.sectionId) ?? [];
    bucket.push(marker);
    markerMap.set(marker.sectionId, bucket);
  }

  const missingRequired = spec.requiredSections.filter(sectionId => !markerMap.has(sectionId));
  if (missingRequired.length === 0) {
    passes.push('Required section markers complete');
  } else {
    for (const sectionId of missingRequired) {
      errors.push(`Missing required section marker: ${sectionId}`);
    }
  }

  const duplicateSectionIds = [...markerMap.entries()]
    .filter(([, markers]) => markers.length > 1)
    .map(([sectionId]) => sectionId);
  if (duplicateSectionIds.length === 0) {
    passes.push('No duplicate section markers');
  } else {
    for (const sectionId of duplicateSectionIds) {
      errors.push(`Duplicate section marker: ${sectionId}`);
    }
  }

  const unknownSectionIds = [...markerMap.keys()].filter(sectionId => !spec.requiredSections.includes(sectionId));
  if (unknownSectionIds.length > 0) {
    warnings.push(`Unknown section markers found: ${unknownSectionIds.join(', ')}`);
  }

  const invalidHeadingMarkers = relevantMarkers.filter(marker => marker.headingLine === null);
  if (invalidHeadingMarkers.length === 0) {
    passes.push('H2 heading found after each section marker');
  } else {
    for (const marker of invalidHeadingMarkers) {
      errors.push(`Expected H2 heading after marker: ${marker.sectionId}`);
    }
  }

  const orderedMarkers = spec.requiredSections
    .map(sectionId => markerMap.get(sectionId)?.[0] ?? null)
    .filter((marker): marker is SectionMarker => marker !== null);
  const isOrdered = orderedMarkers.every((marker, index) => {
    if (index === 0) return true;
    return marker.line > orderedMarkers[index - 1].line;
  });
  if (missingRequired.length === 0 && duplicateSectionIds.length === 0 && isOrdered) {
    passes.push('Section order valid');
  } else if (missingRequired.length === 0 && duplicateSectionIds.length === 0) {
    errors.push('Section order invalid');
  }

  const numericSectionRefs = [...content.matchAll(/\bSection\s+\d+\b/g)].map(match => match[0]);
  if (numericSectionRefs.length > 0) {
    const uniqueRefs = [...new Set(numericSectionRefs)];
    warnings.push(`Numeric section references found: ${uniqueRefs.join(', ')}`);
  }

  // Lock Requirements — content-aware gates. Always evaluated (both check and lock call
  // this same function the same way) so the two commands can never disagree; see the
  // Lock Validation Equivalence invariant on SigmaDocRequirement above.
  const requirements: SigmaDocRequirement[] = [];

  evaluateAudVerdictGate(domain, relevantMarkers, lines, requirements, passes, warnings);

  if (domain === 'intent') {
    evaluateFinalChecklistGate(relevantMarkers, lines, requirements);
  }

  if (domain === 'exec') {
    evaluateExecVerdictGate(relevantMarkers, lines, requirements, passes, warnings);
  }

  if (domain === 'close') {
    evaluateCloseVerdictGate(relevantMarkers, lines, requirements, passes, warnings);
    evaluateFinalDirectorDecisionGate(relevantMarkers, lines, requirements, passes, warnings);
  }

  return {
    ok: errors.length === 0,
    heading: spec.heading,
    file: absPath,
    documentType,
    schema,
    errors,
    warnings,
    passes,
    requirements,
  };
}

export function printSigmaDocReport(report: SigmaDocCheckReport, projectRoot?: string): void {
  const displayPath = projectRoot ? path.relative(projectRoot, report.file) || report.file : report.file;
  console.log(report.heading);
  console.log(`File: ${displayPath}`);
  console.log(`Document Type: ${report.documentType ?? 'UNKNOWN'}`);
  console.log(`Schema: ${report.schema ?? 'UNKNOWN'}`);
  console.log('');
  console.log('Structural Validation');

  for (const pass of report.passes) {
    console.log(`[PASS] ${pass}`);
  }
  for (const warning of report.warnings) {
    console.log(`[WARNING] ${warning}`);
  }
  for (const error of report.errors) {
    console.log(`[ERROR] ${error}`);
  }

  const unsatisfied = report.requirements.filter(requirement => !requirement.satisfied);

  if (report.requirements.length > 0) {
    console.log('');
    console.log('Lock Requirements');
    for (const requirement of report.requirements) {
      console.log(`${requirement.satisfied ? '✓' : '✗'} ${requirement.label}`);
    }
  }

  console.log('');
  console.log(`Result: ${report.ok ? (report.warnings.length > 0 ? 'OK WITH WARNINGS' : 'OK') : 'FAILED'}`);

  if (report.requirements.length > 0) {
    console.log(
      unsatisfied.length === 0
        ? 'Document is structurally valid and all Lock Requirements are satisfied.'
        : `Document is ${report.ok ? 'structurally valid but' : 'NOT structurally valid and'} NOT READY FOR LOCK (${unsatisfied.length} requirement(s) unsatisfied).`
    );
  }

  const lockReady = report.ok && unsatisfied.length === 0;
  console.log(`Lock readiness: ${lockReady ? (report.warnings.length > 0 ? 'Eligible with warnings' : 'Eligible') : 'Not eligible'}`);
}

export function ensureSigmaDocEligible(report: SigmaDocCheckReport, command: string): void {
  if (!report.ok) {
    throw new Error(`${report.heading} failed. Run: sigma ${command} check`);
  }
  const unsatisfied = report.requirements.filter(requirement => !requirement.satisfied);
  if (unsatisfied.length > 0) {
    const list = unsatisfied.map(requirement => `  - ${requirement.label}`).join('\n');
    throw new Error(
      `${report.heading}: ${unsatisfied.length} lock requirement(s) not satisfied:\n${list}\nRun: sigma ${command} check`
    );
  }
}
