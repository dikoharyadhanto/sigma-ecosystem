import fs from 'fs-extra';
import { ProgressJson } from '../engine/progress';

export interface StageEntry {
  version: string;
  title: string;
  focus: string;
}

export function parseStages(content: string): StageEntry[] {
  const stages: StageEntry[] = [];
  const lines = content.split('\n');
  const headingRegex = /^## Stage (\d+\.\d+)\s*[—\-]\s*(.+)$/;
  const focusCommentRegex = /^<!-- SIGMA:STAGE:FOCUS:(.*) -->$/;

  for (let i = 0; i < lines.length; i++) {
    const match = headingRegex.exec(lines[i]);
    if (match) {
      const version = match[1];
      const title = match[2].trim();
      let focus = 'TBD';
      if (i + 1 < lines.length) {
        const focusMatch = focusCommentRegex.exec(lines[i + 1].trim());
        if (focusMatch) {
          focus = focusMatch[1].trim() || 'TBD';
        }
      }
      stages.push({ version, title, focus });
    }
  }
  return stages;
}

export function planStateForStage(stageVersion: string, data: ProgressJson): string {
  const planVersion = `v${stageVersion}`;
  const plan = data.plan.versions.find(v => v.version === planVersion);
  if (!plan) return 'PENDING';
  return plan.state;
}

export function generateStageOverview(stages: StageEntry[], data: ProgressJson): string {
  if (stages.length === 0) {
    return '## 3. Stage Overview\n\n| Stage | Title | Focus | Status | Reason |\n| :--- | :--- | :--- | :--- | :--- |';
  }
  const rows = stages.map(s => {
    const planEntry = data.plan.versions.find(v => v.version === `v${s.version}`);
    const status = planEntry?.state ?? 'PENDING';
    const focus = planEntry?.focus ?? s.focus;
    const reason = planEntry?.state === 'SUPERSEDED' ? (planEntry.supersede_reason ?? '—') : '—';
    return `| ${s.version} | ${s.title} | ${focus} | ${status} | ${reason} |`;
  });
  return [
    '## 3. Stage Overview',
    '',
    '| Stage | Title | Focus | Status | Reason |',
    '| :--- | :--- | :--- | :--- | :--- |',
    ...rows,
  ].join('\n');
}

export function generatePlanBreakdown(stages: StageEntry[], data: ProgressJson): string {
  if (stages.length === 0) {
    return '## 6. PLAN Breakdown\n\n| PLAN | Covers Stage | Title | Focus | Status | Reason |\n| :--- | :--- | :--- | :--- | :--- | :--- |';
  }
  const rows: string[] = [];
  for (const s of stages) {
    const planVersion = `v${s.version}`;
    const plan = data.plan.versions.find(v => v.version === planVersion);
    if (plan) {
      const reason = plan.state === 'SUPERSEDED' ? (plan.supersede_reason ?? '—') : '—';
      const title = plan.title ?? s.title;
      const focus = plan.focus ?? s.focus;
      rows.push(`| FMN-PLAN ${planVersion} | Stage ${s.version} | ${title} | ${focus} | ${plan.state} | ${reason} |`);
    } else {
      rows.push(`| — | Stage ${s.version} | ${s.title} | ${s.focus} | PENDING | — |`);
    }
  }
  return [
    '## 6. PLAN Breakdown',
    '',
    '| PLAN | Covers Stage | Title | Focus | Status | Reason |',
    '| :--- | :--- | :--- | :--- | :--- | :--- |',
    ...rows,
  ].join('\n');
}

export function replaceSection(content: string, name: string, replacement: string): string {
  const startDelim = `<!-- SIGMA:RENDER:START:${name} -->`;
  const endDelim = `<!-- SIGMA:RENDER:END:${name} -->`;
  const startIdx = content.indexOf(startDelim);
  const endIdx = content.indexOf(endDelim);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Section delimiters not found for "${name}" in ROADMAP file. Template may need updating.`);
  }
  const before = content.substring(0, startIdx + startDelim.length);
  const after = content.substring(endIdx);
  return `${before}\n${replacement}\n${after}`;
}

export function renderRoadmapFile(roadmapPath: string, data: ProgressJson): void {
  if (!fs.existsSync(roadmapPath)) {
    throw new Error(`ROADMAP file not found: ${roadmapPath}`);
  }
  let content = fs.readFileSync(roadmapPath, 'utf8');
  const stages = parseStages(content);

  content = replaceSection(content, 'stage-overview', generateStageOverview(stages, data));
  content = replaceSection(content, 'plan-breakdown', generatePlanBreakdown(stages, data));

  fs.writeFileSync(roadmapPath, content, 'utf8');
}

interface CoreProcessMigrationResult {
  changed: boolean;
  content: string;
  message: string;
}

function extractLegacyPhaseDependenciesBody(content: string): string | null {
  const startDelim = '<!-- SIGMA:RENDER:START:phase-dependencies -->';
  const endDelim = '<!-- SIGMA:RENDER:END:phase-dependencies -->';
  const startIdx = content.indexOf(startDelim);
  const endIdx = content.indexOf(endDelim);

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return null;

  const block = content
    .substring(startIdx + startDelim.length, endIdx)
    .trim();

  return block;
}

function normalizeLegacyPhaseDependenciesBody(body: string): string {
  const lines = body.split('\n');
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed === '<!-- SIGMA:ROADMAP:SECTION:PHASE_DEPENDENCIES -->') return false;
    if (trimmed === '## 4. Phase Dependencies') return false;
    return true;
  });
  return filtered.join('\n').trim();
}

function buildCoreProcessFlowSection(legacyBody: string | null): string {
  const intro = [
    '<!-- SIGMA:ROADMAP:SECTION:CORE_PROCESS_FLOW -->',
    '## 4. Core Process Flow',
    '',
    '> Manual section. FMN writes the high-level product/system flow here.',
    '> This section is not regenerated by `sigma roadmap render`.',
    '',
  ];

  const normalizedLegacy = legacyBody ? normalizeLegacyPhaseDependenciesBody(legacyBody) : '';
  if (!normalizedLegacy) {
    return [
      ...intro,
      '[Optional manual Mermaid or plain-text process outline]',
    ].join('\n');
  }

  return [
    ...intro,
    '> Migrated from legacy `Phase Dependencies`. Review and rewrite this into a concise core process view when ready.',
    '',
    normalizedLegacy,
  ].join('\n');
}

function ensureMarkerBeforeHeading(content: string, marker: string, heading: string): string {
  if (content.includes(marker)) return content;
  const needle = heading;
  const idx = content.indexOf(needle);
  if (idx === -1) return content;
  return `${content.substring(0, idx)}${marker}\n${content.substring(idx)}`;
}

export function migrateRoadmapCoreProcessFlowContent(content: string): CoreProcessMigrationResult {
  const alreadyNew = content.includes('<!-- SIGMA:ROADMAP:SECTION:CORE_PROCESS_FLOW -->');
  const oldStartDelim = '<!-- SIGMA:RENDER:START:phase-dependencies -->';
  const oldEndDelim = '<!-- SIGMA:RENDER:END:phase-dependencies -->';

  const hasLegacyBlock = content.includes(oldStartDelim) && content.includes(oldEndDelim);

  if (!hasLegacyBlock) {
    if (alreadyNew) {
      return {
        changed: false,
        content,
        message: 'ROADMAP already uses Core Process Flow. No migration needed.',
      };
    }

    return {
      changed: false,
      content,
      message: 'No legacy Phase Dependencies block found. Nothing to migrate.',
    };
  }

  const legacyBody = extractLegacyPhaseDependenciesBody(content);
  const replacement = buildCoreProcessFlowSection(legacyBody);

  const startIdx = content.indexOf(oldStartDelim);
  const endIdx = content.indexOf(oldEndDelim);
  const before = content.substring(0, startIdx).replace(/\s*$/, '');
  const after = content.substring(endIdx + oldEndDelim.length).replace(/^\s*/, '');
  let migrated = `${before}\n\n${replacement}\n\n${after}`;
  migrated = ensureMarkerBeforeHeading(
    migrated,
    '<!-- SIGMA:ROADMAP:SECTION:STAGE_OVERVIEW -->',
    '## 3. Stage Overview',
  );
  migrated = ensureMarkerBeforeHeading(
    migrated,
    '<!-- SIGMA:ROADMAP:SECTION:PLAN_BREAKDOWN -->',
    '## 6. PLAN Breakdown',
  );

  return {
    changed: true,
    content: migrated,
    message: normalizedLegacyMessage(legacyBody),
  };
}

function normalizedLegacyMessage(legacyBody: string | null): string {
  const normalizedLegacy = legacyBody ? normalizeLegacyPhaseDependenciesBody(legacyBody) : '';
  if (!normalizedLegacy) {
    return 'Legacy Phase Dependencies block replaced with manual Core Process Flow placeholder.';
  }
  return 'Legacy Phase Dependencies block migrated into manual Core Process Flow for review.';
}

export function migrateRoadmapCoreProcessFlowFile(roadmapPath: string): string {
  if (!fs.existsSync(roadmapPath)) {
    throw new Error(`ROADMAP file not found: ${roadmapPath}`);
  }

  const content = fs.readFileSync(roadmapPath, 'utf8');
  const result = migrateRoadmapCoreProcessFlowContent(content);

  if (result.changed) {
    fs.writeFileSync(roadmapPath, result.content, 'utf8');
  }

  return result.message;
}

export const STAGE_STUB_TEMPLATE = (stageVersion: string, title = '(title TBD)', focus?: string): string => {
  const focusComment = focus ? `\n<!-- SIGMA:STAGE:FOCUS:${focus} -->` : '';
  const focusBody = focus ? `\n${focus}\n` : '';
  return `\n## Stage ${stageVersion} — ${title}${focusComment}\n\n> ⚠ Need to fill\n\n### Focus\n${focusBody}\n### Main Output\n\n### Main Tasks\n\n### Explicit Non-Scope\n\n### Dependency / Gate Before Next Stage\n\n### Risk / Watch-Out\n`;
};

export function updateStageMetadata(
  roadmapPath: string,
  stageVersion: string,
  title?: string,
  focus?: string,
): void {
  if (!fs.existsSync(roadmapPath)) {
    throw new Error(`ROADMAP file not found: ${roadmapPath}`);
  }

  const escapedVersion = stageVersion.replace('.', '\\.');
  const headingRegex = new RegExp(`^## Stage ${escapedVersion}\\s*[—\\-]\\s*(.+)$`);
  const focusCommentRegex = /^<!-- SIGMA:STAGE:FOCUS:(.*) -->$/;

  const lines = fs.readFileSync(roadmapPath, 'utf8').split('\n');
  let stageLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRegex.test(lines[i])) {
      stageLineIdx = i;
      break;
    }
  }

  if (stageLineIdx === -1) {
    throw new Error(
      `Stage ${stageVersion} section not found in ROADMAP.\n` +
      `Run: sigma roadmap reconcile --fix   to append missing stage stubs`,
    );
  }

  if (title !== undefined) {
    lines[stageLineIdx] = `## Stage ${stageVersion} — ${title}`;
  }

  if (focus !== undefined) {
    const newFocusComment = `<!-- SIGMA:STAGE:FOCUS:${focus} -->`;
    const nextLine = lines[stageLineIdx + 1] ?? '';
    if (focusCommentRegex.test(nextLine.trim())) {
      lines[stageLineIdx + 1] = newFocusComment;
    } else {
      lines.splice(stageLineIdx + 1, 0, newFocusComment);
    }
  }

  fs.writeFileSync(roadmapPath, lines.join('\n'), 'utf8');
}

export function appendRoadmapSectionStub(roadmapPath: string, planVersion: string, title?: string, focus?: string): void {
  if (!fs.existsSync(roadmapPath)) return;
  const stageVersion = planVersion.replace(/^v/, '');
  const stub = STAGE_STUB_TEMPLATE(stageVersion, title, focus);
  fs.appendFileSync(roadmapPath, stub, 'utf8');
}
