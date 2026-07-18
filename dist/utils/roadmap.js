"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStagePlansForRoadmap = getStagePlansForRoadmap;
exports.generateStageOverview = generateStageOverview;
exports.replaceSection = replaceSection;
exports.removeSectionIfPresent = removeSectionIfPresent;
exports.renderRoadmapFile = renderRoadmapFile;
const fs_extra_1 = __importDefault(require("fs-extra"));
const chain_1 = require("../engine/chain");
// PLAN-EVAL-01 Fase 3 — every entry in chain.plan.versions already belongs
// to this chain's own INTENT by construction (registerPlanDraft() validates
// planMajor === intentMajor - 1 against this chain's own intent at write
// time — there is no cross-chain plan to filter out anymore). The filter
// against intent_version_ref is kept as a defensive no-op, not because it
// can vary (PLAN-EVAL-01 §5).
function getStagePlansForRoadmap(chain) {
    return chain.plan.versions
        .filter(v => v.intent_version_ref === chain.intent.version)
        .sort((a, b) => (0, chain_1.parseMinorVersion)(a.version) - (0, chain_1.parseMinorVersion)(b.version));
}
function generateStageOverview(chain) {
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
function replaceSection(content, name, replacement) {
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
function removeSectionIfPresent(content, name) {
    const startDelim = `<!-- SIGMA:RENDER:START:${name} -->`;
    const endDelim = `<!-- SIGMA:RENDER:END:${name} -->`;
    const startIdx = content.indexOf(startDelim);
    const endIdx = content.indexOf(endDelim);
    if (startIdx === -1 || endIdx === -1)
        return content;
    if (endIdx < startIdx) {
        throw new Error(`Section delimiters are out of order for "${name}" in ROADMAP file.`);
    }
    const before = content.substring(0, startIdx).replace(/[ \t]*\n?$/, '');
    const after = content.substring(endIdx + endDelim.length).replace(/^\s*\n?/, '\n');
    return `${before}${after}`;
}
// PLAN-EVAL-01 §3.5 — no more searching for the "ACTIVE" roadmap entry;
// there is only ever one roadmap per chain, and it's rendered regardless of
// its own lock state (DRAFT/LOCKED) since the Stage Overview table is
// independent of that.
function renderRoadmapFile(roadmapPath, chain) {
    if (!fs_extra_1.default.existsSync(roadmapPath)) {
        throw new Error(`ROADMAP file not found: ${roadmapPath}`);
    }
    if (!chain.roadmap) {
        throw new Error('No ROADMAP found for this chain.');
    }
    let content = fs_extra_1.default.readFileSync(roadmapPath, 'utf8');
    content = replaceSection(content, 'stage-overview', generateStageOverview(chain));
    content = removeSectionIfPresent(content, 'plan-breakdown');
    fs_extra_1.default.writeFileSync(roadmapPath, content, 'utf8');
}
//# sourceMappingURL=roadmap.js.map