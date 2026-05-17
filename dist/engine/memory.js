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
    return section.trim();
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
            director_notes: extractSection(content, /^## .*director/im),
            risk_notes: extractSection(content, /^## 8\. Risk/im),
            evidence_references: extractSection(content, /^## 2\. Success Definition/im),
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
            director_notes: extractSection(content, /^## 9\. Director Roadmap Notes/im),
            risk_notes: '',
            evidence_references: extractSection(content, /^## 2\. Source Intent Alignment/im),
            stage_summary: extractSection(content, /^## 3\. Stage Overview/im),
            recommended_next_plan: extractSection(content, /^## 8\. FMN Roadmap Notes/im),
            pending_items: extractSection(content, /^## 7\. Pending Items/im),
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
            director_notes: extractSection(content, /^## .*director/im),
            risk_notes: '',
            evidence_references: '',
            task_plan_summary: extractSection(content, /^## 2\. Work Order/im),
            test_contract_summary: extractSection(content, /^## 5\. Pre-Build Test Contract/im),
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
            director_notes: extractSection(content, /^## .*director/im),
            risk_notes: '',
            evidence_references: '',
            implementation_summary: extractSection(content, /^## 2\. Implementation Approach/im),
            known_issues: extractSection(content, /^## .*known.*(issues|limitations)/im),
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
        const evidenceRefs = extractSection(content, /^## 3\. Evidence References/im);
        const closureVerdict = extractSection(content, /^## 10\. Director Closure Decision Notes/im);
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
            accepted_limitations: extractSection(content, /^## 6\. Known Limitations/im),
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