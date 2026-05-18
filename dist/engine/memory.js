"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.harvestIntentLock = harvestIntentLock;
exports.harvestRoadmapLock = harvestRoadmapLock;
exports.harvestPlanLock = harvestPlanLock;
exports.harvestExecLock = harvestExecLock;
exports.harvestCloseLock = harvestCloseLock;
exports.initDecisionsFile = initDecisionsFile;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const SECTION_SPECS = {
    INTENT: [
        { field: 'director_notes', patterns: [/^## .*director.*$/im] },
        { field: 'risk_notes', patterns: [/^## 8\. Risk/im] },
        { field: 'evidence_references', patterns: [/^## 2\. Success Definition/im], required: true },
    ],
    ROADMAP: [
        { field: 'director_notes', patterns: [/^## 9\. Director Roadmap Notes/im] },
        { field: 'risk_notes', patterns: [] },
        { field: 'evidence_references', patterns: [/^## 2\. Source Intent Alignment/im], required: true },
        { field: 'stage_summary', patterns: [/^## 3\. Stage Overview/im] },
        { field: 'recommended_next_plan', patterns: [/^## 8\. FMN Roadmap Notes/im] },
        { field: 'pending_items', patterns: [/^## 7\. Pending Items/im] },
    ],
    PLAN: [
        { field: 'director_notes', patterns: [/^## .*director.*$/im] },
        { field: 'risk_notes', patterns: [] },
        { field: 'evidence_references', patterns: [] },
        { field: 'task_plan_summary', patterns: [/^## 2\. Work Order/im], required: true },
        { field: 'test_contract_summary', patterns: [/^## 5\. Pre-Build Test Contract/im], required: true },
    ],
    EXEC: [
        { field: 'director_notes', patterns: [/^## .*director.*$/im] },
        { field: 'risk_notes', patterns: [] },
        { field: 'evidence_references', patterns: [] },
        { field: 'implementation_summary', patterns: [/^## 2\. Implementation Approach/im], required: true },
        { field: 'known_issues', patterns: [/^## .*known.*(issues|limitations).*$/im] },
    ],
    CLOSE: [
        { field: 'director_notes', patterns: [/^## 10\. Director Closure Decision Notes/im], required: true },
        { field: 'risk_notes', patterns: [] },
        { field: 'evidence_references', patterns: [/^## 3\. Evidence References/im], required: true },
        { field: 'plan_refs', patterns: [/^## 3\. Evidence References/im] },
        { field: 'exec_refs', patterns: [/^## 3\. Evidence References/im] },
        { field: 'closure_verdict', patterns: [/^## 10\. Director Closure Decision Notes/im] },
        { field: 'accepted_limitations', patterns: [/^## 6\. Known Limitations/im] },
    ],
};
// Returns the content of the section following `pattern` up to the next ## heading.
// Returns '' if the heading is not found. Never throws.
function extractSection(content, pattern) {
    const match = content.match(pattern);
    if (!match || match.index === undefined)
        return '';
    const start = match.index + match[0].length;
    const rest = content.slice(start);
    const nextHeading = rest.search(/^## /m);
    const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
    return normalizeSection(section);
}
function normalizeSection(content) {
    return content
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
function extractFirstSection(content, patterns) {
    for (const pattern of patterns) {
        const value = extractSection(content, pattern);
        if (value)
            return value;
    }
    return '';
}
function extractSections(artifact, content, sourceFile) {
    const extracted = {};
    for (const spec of SECTION_SPECS[artifact]) {
        const value = extractFirstSection(content, spec.patterns);
        extracted[spec.field] = value;
        if (spec.required && !value) {
            process.stderr.write(`[harvest] ${artifact} ${sourceFile}: missing expected section for ${String(spec.field)}\n`);
        }
    }
    return extracted;
}
function appendEntry(projectRoot, entry) {
    const filePath = path_1.default.join(projectRoot, config_1.PROJECT_DECISIONS_FILE);
    fs_extra_1.default.ensureFileSync(filePath);
    fs_extra_1.default.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}
function harvestIntentLock(projectRoot, version, sourceFile) {
    try {
        if (!sourceFile)
            return;
        const absPath = path_1.default.join(projectRoot, sourceFile);
        if (!fs_extra_1.default.existsSync(absPath)) {
            process.stderr.write(`[harvest] source file not found — skipping: ${sourceFile}\n`);
            return;
        }
        const content = fs_extra_1.default.readFileSync(absPath, 'utf8');
        const entry = {
            artifact: 'INTENT',
            version,
            lock_event: 'intent.lock',
            source_file: sourceFile,
            timestamp: new Date().toISOString(),
            director_notes: '',
            risk_notes: '',
            evidence_references: '',
            ...extractSections('INTENT', content, sourceFile),
        };
        appendEntry(projectRoot, entry);
    }
    catch (e) {
        process.stderr.write(`[harvest] intent.lock error — skipping: ${e.message}\n`);
    }
}
function harvestRoadmapLock(projectRoot, version, sourceFile) {
    try {
        if (!sourceFile)
            return;
        const absPath = path_1.default.join(projectRoot, sourceFile);
        if (!fs_extra_1.default.existsSync(absPath)) {
            process.stderr.write(`[harvest] source file not found — skipping: ${sourceFile}\n`);
            return;
        }
        const content = fs_extra_1.default.readFileSync(absPath, 'utf8');
        const entry = {
            artifact: 'ROADMAP',
            version,
            lock_event: 'roadmap.lock',
            source_file: sourceFile,
            timestamp: new Date().toISOString(),
            risk_notes: '',
            director_notes: '',
            evidence_references: '',
            ...extractSections('ROADMAP', content, sourceFile),
        };
        appendEntry(projectRoot, entry);
    }
    catch (e) {
        process.stderr.write(`[harvest] roadmap.lock error — skipping: ${e.message}\n`);
    }
}
function harvestPlanLock(projectRoot, version, sourceFile) {
    try {
        if (!sourceFile)
            return;
        const absPath = path_1.default.join(projectRoot, sourceFile);
        if (!fs_extra_1.default.existsSync(absPath)) {
            process.stderr.write(`[harvest] source file not found — skipping: ${sourceFile}\n`);
            return;
        }
        const content = fs_extra_1.default.readFileSync(absPath, 'utf8');
        const entry = {
            artifact: 'PLAN',
            version,
            lock_event: 'plan.lock',
            source_file: sourceFile,
            timestamp: new Date().toISOString(),
            director_notes: '',
            risk_notes: '',
            evidence_references: '',
            ...extractSections('PLAN', content, sourceFile),
        };
        appendEntry(projectRoot, entry);
    }
    catch (e) {
        process.stderr.write(`[harvest] plan.lock error — skipping: ${e.message}\n`);
    }
}
function harvestExecLock(projectRoot, version, sourceFile) {
    try {
        if (!sourceFile)
            return;
        const absPath = path_1.default.join(projectRoot, sourceFile);
        if (!fs_extra_1.default.existsSync(absPath)) {
            process.stderr.write(`[harvest] source file not found — skipping: ${sourceFile}\n`);
            return;
        }
        const content = fs_extra_1.default.readFileSync(absPath, 'utf8');
        const entry = {
            artifact: 'EXEC',
            version,
            lock_event: 'exec.lock',
            source_file: sourceFile,
            timestamp: new Date().toISOString(),
            director_notes: '',
            risk_notes: '',
            evidence_references: '',
            ...extractSections('EXEC', content, sourceFile),
        };
        appendEntry(projectRoot, entry);
    }
    catch (e) {
        process.stderr.write(`[harvest] exec.lock error — skipping: ${e.message}\n`);
    }
}
function harvestCloseLock(projectRoot, version, sourceFile) {
    try {
        if (!sourceFile)
            return;
        const absPath = path_1.default.join(projectRoot, sourceFile);
        if (!fs_extra_1.default.existsSync(absPath)) {
            process.stderr.write(`[harvest] source file not found — skipping: ${sourceFile}\n`);
            return;
        }
        const content = fs_extra_1.default.readFileSync(absPath, 'utf8');
        const sections = extractSections('CLOSE', content, sourceFile);
        const evidenceRefs = sections.evidence_references ?? '';
        const closureVerdict = sections.director_notes ?? '';
        const entry = {
            artifact: 'CLOSE',
            version,
            lock_event: 'close.lock',
            source_file: sourceFile,
            timestamp: new Date().toISOString(),
            director_notes: closureVerdict,
            risk_notes: '',
            evidence_references: evidenceRefs,
            plan_refs: evidenceRefs,
            exec_refs: evidenceRefs,
            closure_verdict: closureVerdict,
            accepted_limitations: '',
            ...sections,
        };
        appendEntry(projectRoot, entry);
    }
    catch (e) {
        process.stderr.write(`[harvest] close.lock error — skipping: ${e.message}\n`);
    }
}
// Creates Sigma/memory/decisions.jsonl as an empty file if it does not exist.
// Non-blocking — any error is printed to stderr and not thrown.
function initDecisionsFile(projectRoot) {
    try {
        const filePath = path_1.default.join(projectRoot, config_1.PROJECT_DECISIONS_FILE);
        fs_extra_1.default.ensureFileSync(filePath);
    }
    catch (e) {
        process.stderr.write(`[memory] failed to initialize decisions.jsonl: ${e.message}\n`);
    }
}
//# sourceMappingURL=memory.js.map