import fs from 'fs-extra';
import { ArtifactVersion, ProgressJson, parseMajorVersion, parseMinorVersion } from '../engine/progress';

export function getStagePlansForRoadmap(data: ProgressJson, roadmapVersion: string): ArtifactVersion[] {
  const roadmapMajor = parseMajorVersion(roadmapVersion);
  return data.plan.versions
    .filter(v => v.intent_version_ref && parseMajorVersion(v.intent_version_ref) === roadmapMajor)
    .sort((a, b) => parseMinorVersion(a.version) - parseMinorVersion(b.version));
}

export function generateStageOverview(data: ProgressJson, roadmapVersion: string): string {
  const header = [
    '<!-- SIGMA:ROADMAP:SECTION:STAGE_OVERVIEW -->',
    '## 3. Stage Overview',
    '',
    '| Stage | Title | Focus | Status | Reason |',
    '| :--- | :--- | :--- | :--- | :--- |',
  ];

  const stagePlans = getStagePlansForRoadmap(data, roadmapVersion);
  const rows = stagePlans.map(plan => {
    const stage = plan.version.replace(/^v/, '');
    const title = plan.title ?? 'TBD';
    const focus = plan.focus ?? 'TBD';
    const reason = plan.state === 'SUPERSEDED' ? (plan.supersede_reason ?? '—') : '—';
    return `| ${stage} | ${title} | ${focus} | ${plan.state} | ${reason} |`;
  });

  return [...header, ...rows].join('\n');
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

export function removeSectionIfPresent(content: string, name: string): string {
  const startDelim = `<!-- SIGMA:RENDER:START:${name} -->`;
  const endDelim = `<!-- SIGMA:RENDER:END:${name} -->`;
  const startIdx = content.indexOf(startDelim);
  const endIdx = content.indexOf(endDelim);
  if (startIdx === -1 || endIdx === -1) return content;
  if (endIdx < startIdx) {
    throw new Error(`Section delimiters are out of order for "${name}" in ROADMAP file.`);
  }

  const before = content.substring(0, startIdx).replace(/[ \t]*\n?$/, '');
  const after = content.substring(endIdx + endDelim.length).replace(/^\s*\n?/, '\n');
  return `${before}${after}`;
}

export function renderRoadmapFile(roadmapPath: string, data: ProgressJson): void {
  if (!fs.existsSync(roadmapPath)) {
    throw new Error(`ROADMAP file not found: ${roadmapPath}`);
  }
  const activeRoadmap = data.roadmap.versions.find(v => v.state === 'ACTIVE');
  if (!activeRoadmap) {
    throw new Error('No ACTIVE ROADMAP found in progress.json.');
  }

  let content = fs.readFileSync(roadmapPath, 'utf8');
  content = replaceSection(content, 'stage-overview', generateStageOverview(data, activeRoadmap.version));
  content = removeSectionIfPresent(content, 'plan-breakdown');

  fs.writeFileSync(roadmapPath, content, 'utf8');
}
