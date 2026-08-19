"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanForSigmaTerminology = scanForSigmaTerminology;
exports.loadTerminologyList = loadTerminologyList;
exports.stripTemplateInstructions = stripTemplateInstructions;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
function escapeRegExp(term) {
    return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// Word-boundary, case-sensitive. Case-sensitive is deliberate: Sigma always
// writes state names in caps (DRAFT, LOCKED) — matching case-sensitively
// avoids flagging ordinary lowercase English ("a rough draft", "the door
// was locked") that would otherwise dominate false-positive noise. Director
// decision (session 2026-08-16): no smarter disambiguation than this — a
// false positive costs a reword, not a redesign.
function scanForSigmaTerminology(content, terminology) {
    const lines = content.split('\n');
    const matches = [];
    for (const term of terminology) {
        if (!term.trim())
            continue;
        const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`);
        lines.forEach((lineText, idx) => {
            if (pattern.test(lineText)) {
                matches.push({ term, line: idx + 1, lineText: lineText.trim() });
            }
        });
    }
    return matches;
}
// §2.6 — default list is bundled (Sigma/rules/sigma_terminology.default.json,
// synced like any other rule file, never edited per-project); custom list is
// project-local (Sigma/sigma_terminology.custom.json, deliberately outside
// rules/ so sync never touches it) and starts empty. Director extends it by
// asking the AI to edit the file directly — no dedicated CLI command, this
// is a word list, not governance state.
function loadTerminologyList(projectRoot) {
    const defaultPath = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, 'rules', 'sigma_terminology.default.json');
    const customPath = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, 'sigma_terminology.custom.json');
    const readTerms = (p) => {
        if (!fs_extra_1.default.existsSync(p))
            return [];
        try {
            const data = fs_extra_1.default.readJsonSync(p);
            return Array.isArray(data.terms) ? data.terms.filter((t) => typeof t === 'string') : [];
        }
        catch {
            return [];
        }
    };
    return [...new Set([...readTerms(defaultPath), ...readTerms(customPath)])];
}
// §2.7 tahap 0 — strips every blockquote line (markdown "> ...") before any
// scan runs. Safe because every *-HUMAN template (§7) reserves "> " for
// template-facing instructions exclusively and never uses it for published
// content — a leftover instruction line is always scaffolding, never real
// body text, in a document generated from these templates. Must run before
// scanForSigmaTerminology(): the instructions themselves are full of Sigma
// vocabulary by design (§2.6), so scanning before stripping would fail
// every freshly generated document on its own template text.
function stripTemplateInstructions(content) {
    const lines = content.split('\n');
    let stripped = 0;
    const kept = lines.filter(line => {
        if (/^\s*>/.test(line)) {
            stripped += 1;
            return false;
        }
        return true;
    });
    return { cleaned: kept.join('\n'), strippedLines: stripped };
}
//# sourceMappingURL=terminologyScanner.js.map