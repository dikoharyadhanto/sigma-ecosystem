import fs from 'fs-extra';
import { ArtifactVersion, parseMinorVersion, ChainState } from '../engine/chain';
import { replaceSection, removeSectionIfPresent } from './renderMarkers';

// Re-exported for existing call sites/tests — the implementation moved to
// renderMarkers.ts (PLAN-IMPL Fase 4) since the delimiter mechanism is no
// longer ROADMAP-specific (DIR-INTENT Section 14 / Amendment History uses it
// too). Behavior unchanged: both default to the "ROADMAP file" error label.
export { replaceSection, removeSectionIfPresent };

// PLAN-EVAL-01 Fase 3 — every entry in chain.plan.versions already belongs
// to this chain's own INTENT by construction (registerPlanDraft() validates
// planMajor === intentMajor - 1 against this chain's own intent at write
// time — there is no cross-chain plan to filter out anymore). The filter
// against intent_version_ref is kept as a defensive no-op, not because it
// can vary (PLAN-EVAL-01 §5).
export function getStagePlansForRoadmap(chain: ChainState): ArtifactVersion[] {
  return chain.plan.versions
    .filter(v => v.intent_version_ref === chain.intent.version)
    .sort((a, b) => parseMinorVersion(a.version) - parseMinorVersion(b.version));
}

export function generateStageOverview(chain: ChainState): string {
  const header = [
    '<!-- SIGMA:ROADMAP:SECTION:STAGE_OVERVIEW -->',
    '## 3. Stage Overview',
    '',
    '| Stage | Title | Focus | Status | Reason |',
    '| :--- | :--- | :--- | :--- | :--- |',
  ];

  const stagePlans = getStagePlansForRoadmap(chain);
  const rows = stagePlans.map(plan => {
    const stage = plan.version.replace(/^v/, '');
    const title = plan.title ?? 'TBD';
    const focus = plan.focus ?? 'TBD';
    const reason = plan.state === 'SUPERSEDED' ? (plan.supersede_reason ?? '—') : '—';
    return `| ${stage} | ${title} | ${focus} | ${plan.state} | ${reason} |`;
  });

  return [...header, ...rows].join('\n');
}

// PLAN-EVAL-01 §3.5 — no more searching for the "ACTIVE" roadmap entry;
// there is only ever one roadmap per chain, and it's rendered regardless of
// its own lock state (DRAFT/LOCKED) since the Stage Overview table is
// independent of that.
export function renderRoadmapFile(roadmapPath: string, chain: ChainState): void {
  if (!fs.existsSync(roadmapPath)) {
    throw new Error(`ROADMAP file not found: ${roadmapPath}`);
  }
  if (!chain.roadmap) {
    throw new Error('No ROADMAP found for this chain.');
  }

  let content = fs.readFileSync(roadmapPath, 'utf8');
  content = replaceSection(content, 'stage-overview', generateStageOverview(chain));
  content = removeSectionIfPresent(content, 'plan-breakdown');

  fs.writeFileSync(roadmapPath, content, 'utf8');
}
