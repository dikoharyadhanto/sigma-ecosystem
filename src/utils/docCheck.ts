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
      'ROADMAP_PURPOSE',
      'SOURCE_INTENT_ALIGNMENT',
      'STAGE_OVERVIEW',
      'CORE_PROCESS_FLOW',
      'STAGE_DETAILS',
      'FMN_ROADMAP_NOTES',
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

export function validateSigmaDocFile(absPath: string, domain: SigmaDocDomain): SigmaDocCheckReport {
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
    if (domain === 'roadmap' && missingRequired.includes('CORE_PROCESS_FLOW') && markerMap.has('PHASE_DEPENDENCIES')) {
      warnings.push('ROADMAP appears to use the old Phase Dependencies format. Run: sigma roadmap migrate-core-flow');
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
    if (domain === 'roadmap' && unknownSectionIds.includes('PHASE_DEPENDENCIES')) {
      warnings.push('Legacy ROADMAP section marker detected: PHASE_DEPENDENCIES. Run: sigma roadmap migrate-core-flow');
    }
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
