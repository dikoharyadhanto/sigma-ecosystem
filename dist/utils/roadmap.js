"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAGE_STUB_TEMPLATE = void 0;
exports.parseStages = parseStages;
exports.planStateForStage = planStateForStage;
exports.generateStageOverview = generateStageOverview;
exports.generatePhaseDependencies = generatePhaseDependencies;
exports.generatePlanBreakdown = generatePlanBreakdown;
exports.replaceSection = replaceSection;
exports.renderRoadmapFile = renderRoadmapFile;
exports.appendRoadmapSectionStub = appendRoadmapSectionStub;
const fs_extra_1 = __importDefault(require("fs-extra"));
function parseStages(content) {
    const stages = [];
    const regex = /^## Stage (\d+\.\d+)\s*[—\-]\s*(.+)$/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
        stages.push({ version: match[1], title: match[2].trim() });
    }
    return stages;
}
function planStateForStage(stageVersion, data) {
    const planVersion = `v${stageVersion}`;
    const plan = data.plan.versions.find(v => v.version === planVersion);
    if (!plan)
        return 'PENDING';
    return plan.state;
}
function generateStageOverview(stages, data) {
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
function generatePhaseDependencies(stages) {
    const nodeId = (v) => `S_${v.replace('.', '_')}`;
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
function generatePlanBreakdown(stages, data) {
    if (stages.length === 0) {
        return '## 6. PLAN Breakdown\n\n| PLAN | Covers Stage | Status |\n| :--- | :--- | :--- |';
    }
    const rows = [];
    for (const s of stages) {
        const planVersion = `v${s.version}`;
        const plan = data.plan.versions.find(v => v.version === planVersion);
        if (plan) {
            rows.push(`| FMN-PLAN ${planVersion} | Stage ${s.version} | ${plan.state} |`);
        }
        else {
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
function renderRoadmapFile(roadmapPath, data) {
    if (!fs_extra_1.default.existsSync(roadmapPath)) {
        throw new Error(`ROADMAP file not found: ${roadmapPath}`);
    }
    let content = fs_extra_1.default.readFileSync(roadmapPath, 'utf8');
    const stages = parseStages(content);
    content = replaceSection(content, 'stage-overview', generateStageOverview(stages, data));
    content = replaceSection(content, 'phase-dependencies', generatePhaseDependencies(stages));
    content = replaceSection(content, 'plan-breakdown', generatePlanBreakdown(stages, data));
    fs_extra_1.default.writeFileSync(roadmapPath, content, 'utf8');
}
const STAGE_STUB_TEMPLATE = (stageVersion) => `\n## Stage ${stageVersion} — (title TBD)\n\n> ⚠ Need to fill\n\n### Focus\n\n### Main Output\n\n### Main Tasks\n\n### Explicit Non-Scope\n\n### Dependency / Gate Before Next Stage\n\n### Risk / Watch-Out\n`;
exports.STAGE_STUB_TEMPLATE = STAGE_STUB_TEMPLATE;
function appendRoadmapSectionStub(roadmapPath, planVersion) {
    if (!fs_extra_1.default.existsSync(roadmapPath))
        return;
    const stageVersion = planVersion.replace(/^v/, '');
    const stub = (0, exports.STAGE_STUB_TEMPLATE)(stageVersion);
    fs_extra_1.default.appendFileSync(roadmapPath, stub, 'utf8');
}
//# sourceMappingURL=roadmap.js.map