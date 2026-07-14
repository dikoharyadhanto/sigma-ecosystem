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
const progress_1 = require("../engine/progress");
function getStagePlansForRoadmap(data, roadmapVersion) {
    const roadmapMajor = (0, progress_1.parseMajorVersion)(roadmapVersion);
    return data.plan.versions
        .filter(v => v.intent_version_ref && (0, progress_1.parseMajorVersion)(v.intent_version_ref) === roadmapMajor)
        .sort((a, b) => (0, progress_1.parseMinorVersion)(a.version) - (0, progress_1.parseMinorVersion)(b.version));
}
function generateStageOverview(data, roadmapVersion) {
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
function renderRoadmapFile(roadmapPath, data) {
    if (!fs_extra_1.default.existsSync(roadmapPath)) {
        throw new Error(`ROADMAP file not found: ${roadmapPath}`);
    }
    const activeRoadmap = data.roadmap.versions.find(v => v.state === 'ACTIVE');
    if (!activeRoadmap) {
        throw new Error('No ACTIVE ROADMAP found in progress.json.');
    }
    let content = fs_extra_1.default.readFileSync(roadmapPath, 'utf8');
    content = replaceSection(content, 'stage-overview', generateStageOverview(data, activeRoadmap.version));
    content = removeSectionIfPresent(content, 'plan-breakdown');
    fs_extra_1.default.writeFileSync(roadmapPath, content, 'utf8');
}
//# sourceMappingURL=roadmap.js.map