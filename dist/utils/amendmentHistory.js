"use strict";
// DIR-INTENT Section 14 (Amendment History) render — mirrors intentHistory.ts's
// pattern: chain.intent.amendments[] is the source of truth, this is a pure
// projection over it. Unlike intentHistory.ts (which overwrites a standalone
// file wholesale), this renders into a delimiter pair inside DIR-INTENT.md via
// renderMarkers.ts, leaving every other hand-authored section untouched — the
// same mechanism renderRoadmapFile() uses for ROADMAP's Stage Overview.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAmendmentHistory = generateAmendmentHistory;
exports.ensureAmendmentHistorySection = ensureAmendmentHistorySection;
exports.renderAmendmentHistory = renderAmendmentHistory;
const fs_extra_1 = __importDefault(require("fs-extra"));
const renderMarkers_1 = require("./renderMarkers");
const SECTION_MARKER = '<!-- SIGMA:DIR_INTENT:SECTION:AMENDMENT_HISTORY -->';
const SECTION_HEADING = '## 14. Amendment History';
const SECTION_NOTE = [
    '> Auto-rendered by `sigma intent amendment`. Do not edit by hand — the',
    '> content between the delimiters is overwritten in full every time the',
    '> command runs. Operationalization content changes happen *in place* in',
    '> the relevant section above; this table is only the record of it.',
].join('\n');
const RENDER_START = '<!-- SIGMA:RENDER:START:amendment-history -->';
const RENDER_END = '<!-- SIGMA:RENDER:END:amendment-history -->';
function generateAmendmentHistory(chain) {
    const header = [
        '| Amendment | Date | Change |',
        '| :--- | :--- | :--- |',
    ];
    const rows = (chain.intent.amendments ?? []).map(a => `| ${a.id} | ${a.created_at.slice(0, 10)} | ${a.change} |`);
    return [...header, ...rows].join('\n');
}
// Idempotent — appends the Section 14 skeleton to a DIR-INTENT document that
// predates the Amendment mechanism (§6.3 of the RATIFIED plan). Chains
// created before Section 14 existed cannot otherwise be amended without a
// Director hand-editing an already-RATIFIED document, which is a worse
// exception than this one-time, mechanical append.
function ensureAmendmentHistorySection(content) {
    if (content.includes(SECTION_MARKER))
        return content;
    const block = [
        '',
        '---',
        '',
        SECTION_MARKER,
        SECTION_HEADING,
        '',
        SECTION_NOTE,
        '',
        RENDER_START,
        RENDER_END,
        '',
    ].join('\n');
    return content.replace(/\n?$/, '') + '\n' + block;
}
// Renders Section 14 into a DIR-INTENT file in place, auto-injecting the
// section skeleton first if the document predates it.
function renderAmendmentHistory(intentDocPath, chain) {
    if (!fs_extra_1.default.existsSync(intentDocPath)) {
        throw new Error(`DIR-INTENT file not found: ${intentDocPath}`);
    }
    let content = fs_extra_1.default.readFileSync(intentDocPath, 'utf8');
    content = ensureAmendmentHistorySection(content);
    content = (0, renderMarkers_1.replaceSection)(content, 'amendment-history', generateAmendmentHistory(chain), 'DIR-INTENT file');
    fs_extra_1.default.writeFileSync(intentDocPath, content, 'utf8');
}
//# sourceMappingURL=amendmentHistory.js.map