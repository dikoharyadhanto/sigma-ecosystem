import fs from 'fs-extra';
import { ProgressJson } from '../engine/progress';

export interface StageEntry {
  version: string;
  title: string;
}

export function parseStages(content: string): StageEntry[] {
  const stages: StageEntry[] = [];
  const regex = /^## Stage (\d+\.\d+)\s*[—\-]\s*(.+)$/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    stages.push({ version: match[1], title: match[2].trim() });
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
    return `| ${s.version} | ${s.title} | TBD | ${status} |`;
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

export const STAGE_STUB_TEMPLATE = (stageVersion: string): string =>
  `\n## Stage ${stageVersion} — (title TBD)\n\n> ⚠ Need to fill\n\n### Focus\n\n### Main Output\n\n### Main Tasks\n\n### Explicit Non-Scope\n\n### Dependency / Gate Before Next Stage\n\n### Risk / Watch-Out\n`;

export function appendRoadmapSectionStub(roadmapPath: string, planVersion: string): void {
  if (!fs.existsSync(roadmapPath)) return;
  const stageVersion = planVersion.replace(/^v/, '');
  const stub = STAGE_STUB_TEMPLATE(stageVersion);
  fs.appendFileSync(roadmapPath, stub, 'utf8');
}
