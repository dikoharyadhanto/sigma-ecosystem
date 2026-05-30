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
    return '## 3. Stage Overview\n\n| Stage | Title | Focus | Status |\n| :--- | :--- | :--- | :--- |';
  }
  const rows = stages.map(s => {
    const status = planStateForStage(s.version, data);
    return `| ${s.version} | ${s.title} | ${s.focus} | ${status} |`;
  });
  return [
    '## 3. Stage Overview',
    '',
    '| Stage | Title | Focus | Status |',
    '| :--- | :--- | :--- | :--- |',
    ...rows,
  ].join('\n');
}

export function generatePhaseDependencies(stages: StageEntry[]): string {
  const nodeId = (v: string) => `S_${v.replace('.', '_')}`;
  if (stages.length === 0) {
    return '## 4. Phase Dependencies\n\n```mermaid\nflowchart TD\n```';
  }
  const nodes = stages.map(s => `  ${nodeId(s.version)}[Stage ${s.version}]`).join('\n');
  const links = stages.length > 1
    ? '\n  ' + stages.slice(0, -1).map((s, i) => `${nodeId(s.version)} --> ${nodeId(stages[i + 1].version)}`).join('\n  ')
    : '';
  return [
    '## 4. Phase Dependencies',
    '',
    '```mermaid',
    'flowchart TD',
    nodes,
    links ? links : '',
    '```',
  ].filter(l => l !== '').join('\n');
}

export function generatePlanBreakdown(stages: StageEntry[], data: ProgressJson): string {
  if (stages.length === 0) {
    return '## 6. PLAN Breakdown\n\n| PLAN | Covers Stage | Status |\n| :--- | :--- | :--- |';
  }
  const rows: string[] = [];
  for (const s of stages) {
    const planVersion = `v${s.version}`;
    const plan = data.plan.versions.find(v => v.version === planVersion);
    if (plan) {
      rows.push(`| FMN-PLAN ${planVersion} | Stage ${s.version} | ${plan.state} |`);
    } else {
      rows.push(`| — | Stage ${s.version} | PENDING |`);
    }
  }
  return [
    '## 6. PLAN Breakdown',
    '',
    '| PLAN | Covers Stage | Status |',
    '| :--- | :--- | :--- |',
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
  content = replaceSection(content, 'phase-dependencies', generatePhaseDependencies(stages));
  content = replaceSection(content, 'plan-breakdown', generatePlanBreakdown(stages, data));

  fs.writeFileSync(roadmapPath, content, 'utf8');
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
