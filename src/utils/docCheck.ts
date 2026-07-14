import fs from 'fs-extra';
import path from 'path';
import { ProgressJson } from '../engine/progress';

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

export interface SigmaDocCheckReport {
  ok: boolean;
  heading: string;
  file: string;
  documentType: string | null;
  schema: string | null;
  errors: string[];
  warnings: string[];
  passes: string[];
}

export interface SigmaDocCheckOptions {
  /** Enforce the AUD Advisory Verdict checkbox gate (intent/plan lock only). */
  enforceVerdictGate?: boolean;
  /** Enforce the Final Validation Checklist Lock Requirement gate (intent lock only). */
  enforceFinalChecklistGate?: boolean;
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

export function validateSigmaDocFile(
  absPath: string,
  domain: SigmaDocDomain,
  options: SigmaDocCheckOptions = {},
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

  if (options.enforceVerdictGate) {
    const verdictSectionId = VERDICT_SECTION_ID[domain];
    const verdictMarker = verdictSectionId
      ? relevantMarkers.find(marker => marker.sectionId === verdictSectionId)
      : undefined;

    if (verdictMarker) {
      const laterMarkers = relevantMarkers
        .filter(marker => marker.line > verdictMarker.line)
        .sort((a, b) => a.line - b.line);
      const endBoundary = laterMarkers.length > 0 ? laterMarkers[0].line - 1 : lines.length;

      const tickedLabels: string[] = [];
      let verbatimValue: string | null = null;
      for (let i = verdictMarker.line; i < endBoundary; i += 1) {
        const line = lines[i];
        const checkboxMatch = line.match(/^-\s*\[([ xX])\]\s*([A-Z_]+)/);
        if (checkboxMatch) {
          const label = checkboxMatch[2];
          if (VERDICT_CHECKBOX_LABELS.has(label) && /x/i.test(checkboxMatch[1])) {
            tickedLabels.push(label);
          }
          continue;
        }
        const verbatimMatch = line.match(/Director Instruction \(verbatim\)[^:]*:\s*(.*)$/);
        if (verbatimMatch) {
          verbatimValue = verbatimMatch[1].trim();
        }
      }

      if (tickedLabels.length === 0) {
        errors.push('AUD Advisory Verdict: no verdict checkbox is checked — exactly one is required before lock');
      } else if (tickedLabels.length > 1) {
        errors.push(`AUD Advisory Verdict: more than one verdict checkbox is checked (${tickedLabels.join(', ')}) — exactly one is required`);
      } else {
        passes.push(`AUD Advisory Verdict: exactly one checkbox checked (${tickedLabels[0]})`);
        if (tickedLabels[0] === 'SKIP_FOR_AUDIT') {
          const isEmpty = !verbatimValue || verbatimValue.length === 0 || verbatimValue === '[...]';
          if (isEmpty) {
            errors.push('AUD Advisory Verdict: SKIP_FOR_AUDIT is checked but "Director Instruction (verbatim)" is empty — the Director\'s instruction must be recorded verbatim before lock');
          } else {
            passes.push('AUD Advisory Verdict: SKIP_FOR_AUDIT has a recorded Director Instruction');
          }
        }
      }
    }
  }

  if (options.enforceFinalChecklistGate && domain === 'intent') {
    const checklistMarker = relevantMarkers.find(marker => marker.sectionId === FINAL_CHECKLIST_SECTION_ID);
    if (checklistMarker) {
      const laterMarkers = relevantMarkers
        .filter(marker => marker.line > checklistMarker.line)
        .sort((a, b) => a.line - b.line);
      const checklistEnd = laterMarkers.length > 0 ? laterMarkers[0].line - 1 : lines.length;

      let lockRequirementEnd = checklistEnd;
      for (let i = checklistMarker.line; i < checklistEnd; i += 1) {
        if (CONDITIONAL_REQUIREMENT_HEADING.test(lines[i].trim())) {
          lockRequirementEnd = i;
          break;
        }
      }

      const unchecked: string[] = [];
      for (let i = checklistMarker.line; i < lockRequirementEnd; i += 1) {
        const checkboxMatch = lines[i].match(/^-\s*\[([ xX])\]\s*(.+)$/);
        if (!checkboxMatch) continue;
        const text = checkboxMatch[2].trim();
        const isQualityBarItem = QUALITY_BAR_CHECKLIST_PHRASES.some(phrase => text.includes(phrase));
        if (isQualityBarItem) continue;
        if (!/x/i.test(checkboxMatch[1])) {
          unchecked.push(text);
        }
      }

      if (unchecked.length > 0) {
        errors.push(`Final Validation Checklist — Lock Requirement: ${unchecked.length} item(s) not checked: ${unchecked.join(' | ')}`);
      } else {
        passes.push('Final Validation Checklist — Lock Requirement: all items checked');
      }
    }

    const qualityBarMarker = relevantMarkers.find(marker => marker.sectionId === QUALITY_BAR_SECTION_ID);
    if (qualityBarMarker) {
      const laterMarkers = relevantMarkers
        .filter(marker => marker.line > qualityBarMarker.line)
        .sort((a, b) => a.line - b.line);
      const qualityBarEnd = laterMarkers.length > 0 ? laterMarkers[0].line - 1 : lines.length;

      const unresolvedDimensions: string[] = [];
      for (let i = qualityBarMarker.line; i < qualityBarEnd; i += 1) {
        const rowMatch = lines[i].match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
        if (!rowMatch) continue;
        const dimension = rowMatch[1].trim();
        if (!QUALITY_BAR_DIMENSIONS.includes(dimension)) continue;
        const standardCell = rowMatch[2].trim();
        if (/^\[.*\]$/.test(standardCell)) {
          unresolvedDimensions.push(dimension);
        }
      }

      if (unresolvedDimensions.length > 0) {
        errors.push(`Quality Bar (Section 4): minimum standard still a placeholder for: ${unresolvedDimensions.join(', ')} — state a real standard or "N/A"`);
      } else {
        passes.push('Quality Bar (Section 4): minimum standard stated or N/A for all dimensions');
      }
    }
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
  };
}

function resolveVersionedFile(
  projectRoot: string,
  data: ProgressJson,
  domain: SigmaDocDomain,
  version?: string,
): string {
  if (domain === 'intent') {
    const entry = version
      ? data.intent.versions.find(item => item.version === version)
      : data.intent.versions.find(item => item.version === data.intent.active_version);
    if (!entry) throw new Error(version ? `DIR-INTENT ${version} not found.` : 'No active DIR-INTENT found. Run: sigma intent new');
    return path.join(projectRoot, entry.file ?? path.join('Sigma', 'design', `DIR-INTENT-${entry.version}.md`));
  }

  if (domain === 'roadmap') {
    const entry = version
      ? data.roadmap.versions.find(item => item.version === version)
      : data.roadmap.versions.find(item => item.version === data.roadmap.active_version);
    if (!entry) throw new Error(version ? `ROADMAP ${version} not found.` : 'No active ROADMAP found. Run: sigma roadmap new');
    return path.join(projectRoot, entry.file ?? path.join('Sigma', 'build', `ROADMAP-${entry.version}.md`));
  }

  if (domain === 'plan') {
    const entry = version
      ? data.plan.versions.find(item => item.version === version)
      : data.plan.versions.find(item => item.version === data.plan.active_version);
    if (!entry) throw new Error(version ? `FMN-PLAN ${version} not found.` : 'No active FMN-PLAN found. Run: sigma plan new');
    return path.join(projectRoot, entry.file ?? path.join('Sigma', 'build', `FMN-PLAN-${entry.version}.md`));
  }

  if (domain === 'exec') {
    const entry = version
      ? data.exec.versions.find(item => item.version === version)
      : data.exec.versions.find(item => item.version === data.exec.active_version);
    if (!entry) throw new Error(version ? `DEV-EXEC ${version} not found.` : 'No active DEV-EXEC found. Run: sigma exec new');
    return path.join(projectRoot, entry.file ?? path.join('Sigma', 'build', `DEV-EXEC-${entry.version}.md`));
  }

  const entry = version
    ? data.close.versions.find(item => item.version === version)
    : data.close.versions.find(item => item.version === data.close.active_version);
  if (!entry) throw new Error(version ? `DIR-CLOSE ${version} not found.` : 'No active DIR-CLOSE found. Run: sigma close new');
  return path.join(projectRoot, entry.file ?? path.join('Sigma', 'close', `DIR-CLOSE-${entry.version}.md`));
}

export function resolveSigmaDocPath(
  projectRoot: string,
  data: ProgressJson,
  domain: SigmaDocDomain,
  version?: string,
): string {
  return resolveVersionedFile(projectRoot, data, domain, version);
}

export function printSigmaDocReport(report: SigmaDocCheckReport, projectRoot?: string): void {
  const displayPath = projectRoot ? path.relative(projectRoot, report.file) || report.file : report.file;
  console.log(report.heading);
  console.log(`File: ${displayPath}`);
  console.log(`Document Type: ${report.documentType ?? 'UNKNOWN'}`);
  console.log(`Schema: ${report.schema ?? 'UNKNOWN'}`);
  console.log('');

  for (const pass of report.passes) {
    console.log(`[PASS] ${pass}`);
  }
  for (const warning of report.warnings) {
    console.log(`[WARNING] ${warning}`);
  }
  for (const error of report.errors) {
    console.log(`[ERROR] ${error}`);
  }

  console.log('');
  console.log(`Result: ${report.ok ? (report.warnings.length > 0 ? 'OK WITH WARNINGS' : 'OK') : 'FAILED'}`);
  console.log(`Lock readiness: ${report.ok ? (report.warnings.length > 0 ? 'Eligible with warnings' : 'Eligible') : 'Not eligible'}`);
}

export function ensureSigmaDocEligible(report: SigmaDocCheckReport, command: string): void {
  if (!report.ok) {
    throw new Error(`${report.heading} failed. Run: sigma ${command} check`);
  }
}
