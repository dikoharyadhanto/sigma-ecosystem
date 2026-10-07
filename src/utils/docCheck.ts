import fs from 'fs-extra';
import path from 'path';

export type SigmaDocDomain = 'intent' | 'roadmap' | 'plan' | 'exec' | 'close';

interface SigmaDocSpec {
  heading: string;
  expectedType: string;
  fallbackPath: string;
  requiredSections: string[];   // missing → error, blocks lock/ratify
  // Amendment mechanism (Fase 4) — known but not required: a document
  // missing an optional section is still `ok`; one present is validated for
  // order like any required section, but never triggers "unknown section
  // marker" or "missing required section marker". Promoting an entry here
  // into requiredSections is a separate, later decision (D-05) — not done
  // automatically once every project has migrated.
  optionalSections?: string[];
  // Full expected order across required + optional. Defaults to
  // requiredSections when omitted (every domain except intent today).
  sectionOrder?: string[];
  // Section holding the AUD advisory verdict, when it differs from the
  // domain default in VERDICT_SECTION_ID.
  verdictSectionId?: string;
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
  'READY_FOR_APPROVAL',
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

// First DIR_INTENT schema version that uses the unnumbered section layout
// (Director Summary first, no Final Validation Checklist). Documents on an
// earlier schema keep validating against DOC_SPECS.intent unchanged.
const INTENT_SCHEMA_V5 = 5;

const INTENT_SPEC_V5: SigmaDocSpec = {
  heading: 'Sigma Intent Check',
  expectedType: 'DIR_INTENT',
  fallbackPath: path.join('Sigma', 'charter', 'DIR-INTENT.md'),
  requiredSections: [
    'DIRECTOR_SUMMARY',
    'PURPOSE_AND_PROBLEM',
    'DESIRED_OUTCOME_AND_MEASUREMENT',
    'SCOPE',
    'QUALITY_STANDARDS',
    'PRIORITIES_AND_CONSTRAINTS',
    'ASSUMPTIONS_AND_RISKS',
    'FUNCTIONAL_REQUIREMENTS',
    'AUD_NOTES',
  ],
  // RESEARCH is present only when needed. AMENDMENT_HISTORY stays optional
  // until the Git-based amendment flow replaces `sigma intent amendment` (F05).
  optionalSections: ['RESEARCH', 'AMENDMENT_HISTORY'],
  sectionOrder: [
    'DIRECTOR_SUMMARY',
    'PURPOSE_AND_PROBLEM',
    'DESIRED_OUTCOME_AND_MEASUREMENT',
    'SCOPE',
    'QUALITY_STANDARDS',
    'PRIORITIES_AND_CONSTRAINTS',
    'ASSUMPTIONS_AND_RISKS',
    'FUNCTIONAL_REQUIREMENTS',
    'RESEARCH',
    'AUD_NOTES',
    'AMENDMENT_HISTORY',
  ],
  verdictSectionId: 'AUD_NOTES',
};

// First FMN_PLAN schema version that uses the unnumbered section layout
// (Director Summary first, merged Acceptance Criteria and Test Contract).
// Documents on an earlier schema keep validating against DOC_SPECS.plan.
const PLAN_SCHEMA_V3 = 3;

const PLAN_SPEC_V3: SigmaDocSpec = {
  heading: 'Sigma Plan Check',
  expectedType: 'FMN_PLAN',
  fallbackPath: path.join('Sigma', 'contract', 'FMN-PLAN.md'),
  requiredSections: [
    'DIRECTOR_SUMMARY',
    'SOURCE_ALIGNMENT',
    'OBJECTIVE',
    'KEY_OUTPUT',
    'WORK_ORDER',
    'ACCEPTANCE_AND_TEST_CONTRACT',
    'CONSTRAINTS_FOR_DEV',
    'AUD_NOTES',
  ],
  // CONTRACT_CHANGES stays free-form until the checkpoint and approval rules (F04) exist.
  optionalSections: ['REQUIREMENT', 'WORK_OUTSIDE_INTENT', 'CONTRACT_CHANGES'],
  sectionOrder: [
    'DIRECTOR_SUMMARY',
    'SOURCE_ALIGNMENT',
    'OBJECTIVE',
    'REQUIREMENT',
    'KEY_OUTPUT',
    'WORK_ORDER',
    'ACCEPTANCE_AND_TEST_CONTRACT',
    'CONSTRAINTS_FOR_DEV',
    'WORK_OUTSIDE_INTENT',
    'CONTRACT_CHANGES',
    'AUD_NOTES',
  ],
  verdictSectionId: 'AUD_NOTES',
};

// First execution-document schema version with the unnumbered section layout
// (summary first, build result and verification in one section). Earlier
// schemas keep validating against DOC_SPECS.exec.
const EXEC_SCHEMA_V3 = 3;

const EXEC_SPEC_V3: SigmaDocSpec = {
  heading: 'Sigma Exec Check',
  expectedType: 'DEV_EXEC',
  fallbackPath: path.join('Sigma', 'evidence', 'DEV-EXEC.md'),
  requiredSections: [
    'DIRECTOR_SUMMARY',
    'IMPLEMENTATION_PLAN',
    'FMN_PRE_BUILD_REVIEW',
    'BUILD_RESULT_AND_VERIFICATION',
    'DEVIATIONS_ISSUES_LIMITATIONS',
    'FMN_POST_BUILD_REVIEW',
    'DIRECTOR_OBSERVATION_REPORT_MINOR_REQUESTS',
  ],
  // Present only when the author chooses to research; nothing gates on it.
  optionalSections: ['TECHNICAL_RESEARCH'],
  sectionOrder: [
    'DIRECTOR_SUMMARY',
    'IMPLEMENTATION_PLAN',
    'TECHNICAL_RESEARCH',
    'FMN_PRE_BUILD_REVIEW',
    'BUILD_RESULT_AND_VERIFICATION',
    'DEVIATIONS_ISSUES_LIMITATIONS',
    'FMN_POST_BUILD_REVIEW',
    'DIRECTOR_OBSERVATION_REPORT_MINOR_REQUESTS',
  ],
};

const DOC_SPECS: Record<SigmaDocDomain, SigmaDocSpec> = {
  intent: {
    heading: 'Sigma Intent Check',
    expectedType: 'DIR_INTENT',
    fallbackPath: path.join('Sigma', 'charter', 'DIR-INTENT.md'),
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
    // Amendment History (Fase 4) — known-but-optional so DIR-INTENT docs
    // predating the Amendment mechanism keep passing check/ratify unchanged.
    // sigma intent amendment auto-injects it into old docs on first use
    // (amendmentHistory.ts); promoting it to requiredSections is a separate
    // future decision (D-05), not automatic once every project has migrated.
    optionalSections: ['AMENDMENT_HISTORY'],
    sectionOrder: [
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
      'AMENDMENT_HISTORY',
    ],
  },
  roadmap: {
    heading: 'Sigma Roadmap Check',
    expectedType: 'ROADMAP',
    fallbackPath: path.join('Sigma', 'roadmap', 'ROADMAP.md'),
    requiredSections: [
      'OVERVIEW',
      'CORE_PROCESS_FLOW',
      'PLANNED_STAGE',
      'STAGE_OVERVIEW',
    ],
  },
  plan: {
    heading: 'Sigma Plan Check',
    expectedType: 'FMN_PLAN',
    fallbackPath: path.join('Sigma', 'contract', 'FMN-PLAN.md'),
    requiredSections: [
      'SOURCE_ALIGNMENT',
      'WORK_ORDER_TASK_PLAN',
      'ACCEPTANCE_CRITERIA',
      'IMPLEMENTATION_CONSTRAINTS',
      'PROTOCOL_OVERRIDES_EXPANSIONS',
      'PRE_BUILD_TEST_CONTRACT',
      'DEV_HANDOFF_INSTRUCTIONS',
      'AUD_FINDINGS',
      'DIRECTORS_SUMMARY',
    ],
    // Pre-requirement (PLAN-IMPL-MULTIDRAFT-LOCK §9.1/§9.3) — known-but-optional
    // so FMN-PLAN docs predating this section keep passing check/lock
    // unchanged. Promoting it to requiredSections is a separate future
    // decision, not automatic once every project has migrated — same
    // pattern as intent's AMENDMENT_HISTORY.
    optionalSections: ['PRE_REQUIREMENT'],
    sectionOrder: [
      'SOURCE_ALIGNMENT',
      'PRE_REQUIREMENT',
      'WORK_ORDER_TASK_PLAN',
      'ACCEPTANCE_CRITERIA',
      'IMPLEMENTATION_CONSTRAINTS',
      'PROTOCOL_OVERRIDES_EXPANSIONS',
      'PRE_BUILD_TEST_CONTRACT',
      'DEV_HANDOFF_INSTRUCTIONS',
      'AUD_FINDINGS',
      'DIRECTORS_SUMMARY',
    ],
  },
  exec: {
    heading: 'Sigma Exec Check',
    expectedType: 'DEV_EXEC',
    fallbackPath: path.join('Sigma', 'evidence', 'DEV-EXEC.md'),
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
    // Technical Research (PLAN-IMPL-MULTIDRAFT-LOCK §9.2/§9.3) — same
    // known-but-optional treatment as plan's PRE_REQUIREMENT above.
    optionalSections: ['TECHNICAL_RESEARCH'],
    sectionOrder: [
      'SOURCE_PLAN_ALIGNMENT',
      'DEV_PRE_BUILD_ASSESSMENT',
      'TECHNICAL_RESEARCH',
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

function resolveDocSpec(domain: SigmaDocDomain, schema: string | null): SigmaDocSpec {
  const version = schema === null ? NaN : Number(schema);
  if (Number.isInteger(version)) {
    if (domain === 'intent' && version >= INTENT_SCHEMA_V5) return INTENT_SPEC_V5;
    if (domain === 'plan' && version >= PLAN_SCHEMA_V3) return PLAN_SPEC_V3;
    if (domain === 'exec' && version >= EXEC_SCHEMA_V3) return EXEC_SPEC_V3;
  }
  return DOC_SPECS[domain];
}

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
  verdictSectionId: string | undefined,
  relevantMarkers: SectionMarker[],
  lines: string[],
  requirements: SigmaDocRequirement[],
  passes: string[],
  warnings: string[],
): void {
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

/** Non-placeholder bullet items directly under a heading matching `headingRegex`, within `[start, end)`. */
function countFilledBullets(lines: string[], start: number, end: number, headingRegex: RegExp): number {
  let headingIndex = -1;
  for (let i = start; i < end; i += 1) {
    if (headingRegex.test(lines[i].trim())) {
      headingIndex = i;
      break;
    }
  }
  if (headingIndex === -1) return 0;

  let count = 0;
  for (let i = headingIndex + 1; i < end; i += 1) {
    const text = lines[i].trim();
    if (/^#{2,3}\s+/.test(text)) break;
    const bullet = text.match(/^[-*]\s+(.+)$/);
    if (bullet && !isPlaceholderContent(bullet[1])) count += 1;
  }
  return count;
}

const EXPECTED_BOUNDARY_EXAMPLES = 3;

// Ratify requirements for DIR_INTENT schema 5. Replaces the 15-checkbox Final
// Validation Checklist: each requirement reads the content it names.
function evaluateIntentV5Gate(
  relevantMarkers: SectionMarker[],
  lines: string[],
  requirements: SigmaDocRequirement[],
  passes: string[],
  warnings: string[],
): void {
  const summaryMarker = relevantMarkers.find(m => m.sectionId === 'DIRECTOR_SUMMARY');
  if (summaryMarker) {
    const end = sectionEndLine(relevantMarkers, summaryMarker, lines.length);

    const summaryText = findHeadingBody(lines, summaryMarker.line, end, /^###\s*Summary\s*$/i);
    const summaryStated = !isPlaceholderContent(summaryText);
    requirements.push({ label: 'Director Summary is stated', satisfied: summaryStated, scope: 'lock' });

    const included = countFilledBullets(lines, summaryMarker.line, end, /^###\s*Included Scenarios\s*$/i);
    const excluded = countFilledBullets(lines, summaryMarker.line, end, /^###\s*Excluded Scenarios\s*$/i);
    requirements.push({
      label: 'Director Summary boundary examples stated (included and excluded)',
      satisfied: included > 0 && excluded > 0,
      scope: 'lock',
    });
    // Count is advisory until the pilot confirms the starting value of 3 and 3.
    if (included > 0 && excluded > 0 && (included !== EXPECTED_BOUNDARY_EXAMPLES || excluded !== EXPECTED_BOUNDARY_EXAMPLES)) {
      warnings.push(
        `Director Summary: ${EXPECTED_BOUNDARY_EXAMPLES} included and ${EXPECTED_BOUNDARY_EXAMPLES} excluded scenarios expected (found ${included} and ${excluded})`
      );
    } else if (included === EXPECTED_BOUNDARY_EXAMPLES && excluded === EXPECTED_BOUNDARY_EXAMPLES) {
      passes.push('Director Summary: boundary examples complete (3 included, 3 excluded)');
    }
  }

  const qualityMarker = relevantMarkers.find(m => m.sectionId === 'QUALITY_STANDARDS');
  if (qualityMarker) {
    const end = sectionEndLine(relevantMarkers, qualityMarker, lines.length);
    const stated = new Map<string, boolean>();
    for (let i = qualityMarker.line; i < end; i += 1) {
      const rowMatch = lines[i].match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
      if (!rowMatch) continue;
      const dimension = rowMatch[1].trim();
      if (!QUALITY_BAR_DIMENSIONS.includes(dimension)) continue;
      stated.set(dimension, !isPlaceholderContent(rowMatch[2]));
    }
    for (const dimension of QUALITY_BAR_DIMENSIONS) {
      requirements.push({
        label: `Quality Standards — ${dimension} minimum standard stated or N/A`,
        satisfied: stated.get(dimension) === true,
        scope: 'lock',
      });
    }
  }
}

const MAX_KEY_ITEM_ROWS = 5;
const INTENT_VERSION_REFERENCE = /INTENT[-\s]?v?\s*\d+/i;

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

/** Data rows (first cell is a number) of the table inside `[start, end)`. */
function numberedTableRows(lines: string[], start: number, end: number): string[][] {
  const rows: string[][] = [];
  for (let i = start; i < end; i += 1) {
    if (/^\|\s*\d+\s*\|/.test(lines[i].trim())) rows.push(splitTableRow(lines[i]));
  }
  return rows;
}

// Lock requirements for FMN_PLAN schema 3. Blocking: Director Summary stated,
// INTENT version named. Advisory (warnings): oversized key-item tables and
// acceptance criteria without a test method or expected result.
function evaluatePlanV3Gate(
  relevantMarkers: SectionMarker[],
  lines: string[],
  requirements: SigmaDocRequirement[],
  passes: string[],
  warnings: string[],
): void {
  const summaryMarker = relevantMarkers.find(m => m.sectionId === 'DIRECTOR_SUMMARY');
  if (summaryMarker) {
    const end = sectionEndLine(relevantMarkers, summaryMarker, lines.length);
    const summaryText = findHeadingBody(lines, summaryMarker.line, end, /^###\s*Summary\s*$/i);
    requirements.push({ label: 'Director Summary is stated', satisfied: !isPlaceholderContent(summaryText), scope: 'lock' });
  }

  const sourceMarker = relevantMarkers.find(m => m.sectionId === 'SOURCE_ALIGNMENT');
  if (sourceMarker) {
    const end = sectionEndLine(relevantMarkers, sourceMarker, lines.length);
    const body = lines.slice(sourceMarker.line, end).join('\n');
    requirements.push({
      label: 'Source Alignment names the INTENT version',
      satisfied: INTENT_VERSION_REFERENCE.test(body),
      scope: 'lock',
    });

    let requirementsServed: string | null = null;
    for (let i = sourceMarker.line; i < end; i += 1) {
      const row = lines[i].trim().match(/^\|\s*Requirements served\s*\|\s*([^|]*?)\s*\|/i);
      if (row) requirementsServed = row[1];
    }
    if (isPlaceholderContent(requirementsServed)) {
      warnings.push('Source Alignment: Requirements served (REQ IDs) not stated');
    } else {
      passes.push('Source Alignment: Requirements served stated');
    }
  }

  for (const [sectionId, label] of [['REQUIREMENT', 'Requirement'], ['KEY_OUTPUT', 'Key Output']] as const) {
    const marker = relevantMarkers.find(m => m.sectionId === sectionId);
    if (!marker) continue;
    const end = sectionEndLine(relevantMarkers, marker, lines.length);
    const rowCount = numberedTableRows(lines, marker.line, end).length;
    if (rowCount > MAX_KEY_ITEM_ROWS) {
      warnings.push(`${label}: ${rowCount} rows; ${MAX_KEY_ITEM_ROWS} or fewer expected (key items only)`);
    }
  }

  const acMarker = relevantMarkers.find(m => m.sectionId === 'ACCEPTANCE_AND_TEST_CONTRACT');
  if (acMarker) {
    const end = sectionEndLine(relevantMarkers, acMarker, lines.length);
    const incomplete: string[] = [];
    for (let i = acMarker.line; i < end; i += 1) {
      if (!/^\|\s*AC-\d+/i.test(lines[i].trim())) continue;
      const cells = splitTableRow(lines[i]);
      const [acId, , testMethod, expectedResult] = cells;
      if (isPlaceholderContent(testMethod ?? null) || isPlaceholderContent(expectedResult ?? null)) incomplete.push(acId);
    }
    if (incomplete.length > 0) {
      warnings.push(`Acceptance Criteria and Test Contract: no Test Method or Expected Result for ${incomplete.join(', ')}`);
    } else {
      passes.push('Acceptance Criteria and Test Contract: every AC has a Test Method and Expected Result');
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

const PLAN_VERSION_REFERENCE = /PLAN[-\s]?v?\s*\d+/i;
const PLACEHOLDER_TEXT = '[...]';

// Blocking: the summary is stated. Advisory (warnings only): the plan section
// names the source plan version, and no `[...]` placeholder remains in a
// required section. A placeholder can be legitimate content (a code sample),
// which is why it only warns.
function evaluateExecV3Gate(
  spec: SigmaDocSpec,
  relevantMarkers: SectionMarker[],
  lines: string[],
  requirements: SigmaDocRequirement[],
  passes: string[],
  warnings: string[],
): void {
  const summaryMarker = relevantMarkers.find(m => m.sectionId === 'DIRECTOR_SUMMARY');
  if (summaryMarker) {
    const end = sectionEndLine(relevantMarkers, summaryMarker, lines.length);
    const summaryText = findHeadingBody(lines, summaryMarker.line, end, /^###\s*Summary\s*$/i);
    requirements.push({ label: 'Director Summary is stated', satisfied: !isPlaceholderContent(summaryText), scope: 'lock' });
  }

  const planMarker = relevantMarkers.find(m => m.sectionId === 'IMPLEMENTATION_PLAN');
  if (planMarker) {
    const end = sectionEndLine(relevantMarkers, planMarker, lines.length);
    const body = lines.slice(planMarker.line, end).join('\n');
    if (PLAN_VERSION_REFERENCE.test(body)) {
      passes.push('Implementation Plan: PLAN version named');
    } else {
      warnings.push('Implementation Plan: PLAN version not named');
    }
  }

  const unfilled = relevantMarkers
    .filter(marker => spec.requiredSections.includes(marker.sectionId))
    .filter(marker => {
      const end = sectionEndLine(relevantMarkers, marker, lines.length);
      return lines.slice(marker.line, end).some(line => line.includes(PLACEHOLDER_TEXT));
    })
    .map(marker => marker.sectionId);
  if (unfilled.length > 0) {
    warnings.push(`Placeholder ${PLACEHOLDER_TEXT} remains in: ${unfilled.join(', ')}`);
  } else {
    passes.push('No placeholder remains in required sections');
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

  const spec = resolveDocSpec(domain, schema);

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

  const knownSectionIds = [...spec.requiredSections, ...(spec.optionalSections ?? [])];
  const unknownSectionIds = [...markerMap.keys()].filter(sectionId => !knownSectionIds.includes(sectionId));
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

  const orderedMarkers = (spec.sectionOrder ?? spec.requiredSections)
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

  evaluateAudVerdictGate(spec.verdictSectionId ?? VERDICT_SECTION_ID[domain], relevantMarkers, lines, requirements, passes, warnings);

  if (domain === 'intent') {
    if (spec === INTENT_SPEC_V5) {
      evaluateIntentV5Gate(relevantMarkers, lines, requirements, passes, warnings);
    } else {
      evaluateFinalChecklistGate(relevantMarkers, lines, requirements);
    }
  }

  if (domain === 'plan' && spec === PLAN_SPEC_V3) {
    evaluatePlanV3Gate(relevantMarkers, lines, requirements, passes, warnings);
  }

  if (domain === 'exec') {
    evaluateExecVerdictGate(relevantMarkers, lines, requirements, passes, warnings);
    if (spec === EXEC_SPEC_V3) {
      evaluateExecV3Gate(spec, relevantMarkers, lines, requirements, passes, warnings);
    }
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
  const approvalDocument = report.documentType === 'FMN_PLAN' || report.documentType === 'DEV_EXEC';
  const readiness = approvalDocument ? 'Approval' : 'Lock';
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
    console.log(readiness + ' Requirements');
    for (const requirement of report.requirements) {
      console.log(`${requirement.satisfied ? '✓' : '✗'} ${requirement.label}`);
    }
  }

  console.log('');
  console.log(`Result: ${report.ok ? (report.warnings.length > 0 ? 'OK WITH WARNINGS' : 'OK') : 'FAILED'}`);

  if (report.requirements.length > 0) {
    console.log(
      unsatisfied.length === 0
        ? 'Document is structurally valid and all ' + readiness + ' Requirements are satisfied.'
        : `Document is ${report.ok ? 'structurally valid but' : 'NOT structurally valid and'} NOT READY FOR ${approvalDocument ? 'APPROVAL' : 'LOCK'} (${unsatisfied.length} requirement(s) unsatisfied).`
    );
  }

  const lockReady = report.ok && unsatisfied.length === 0;
  console.log(`${readiness} readiness: ${lockReady ? (report.warnings.length > 0 ? 'Eligible with warnings' : 'Eligible') : 'Not eligible'}`);
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
