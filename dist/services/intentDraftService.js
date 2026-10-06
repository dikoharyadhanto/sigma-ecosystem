"use strict";
// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, Stage C pilot — the one
// use-case shared by `sigma intent new` (CLI) and `sigma_create_intent_draft`
// (MCP control tool). Transport-agnostic on purpose: no Commander, no
// console.log, no prompt. The CLOSED-chain reopen confirmation stays with
// each caller (interactive prompt for the CLI, an explicit boolean argument
// for MCP) — this function only enforces that the confirmation happened,
// it does not obtain it.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentDraftError = void 0;
exports.createIntentDraftTransactionFiles = createIntentDraftTransactionFiles;
exports.createIntentDraft = createIntentDraft;
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
const intentHistory_1 = require("../utils/intentHistory");
const controlStore_1 = require("../engine/controlStore");
class IntentDraftError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'IntentDraftError';
    }
}
exports.IntentDraftError = IntentDraftError;
function createIntentDraftTransactionFiles(projectRoot) {
    const chainVersion = (0, chain_1.nextChainVersion)(projectRoot);
    return [
        path_1.default.join(projectRoot, 'Sigma', 'charter', `DIR-INTENT-${chainVersion}.md`),
        (0, chain_1.chainFilePath)(projectRoot, chainVersion),
        (0, chain_1.activateStatusPath)(projectRoot),
        (0, intentHistory_1.intentHistoryPath)(projectRoot),
    ];
}
// PLAN-EVAL-06 §6.2 — intent-history.md is a plain pipe-split table, and
// doctor --reconstruct parses it back to recover title/focus. "|"/newlines
// would corrupt both the render and the recovery parser. Same rule the CLI
// enforced inline before this was extracted (src/commands/intent.ts).
function assertRequiredMetadata(title, focus) {
    if (!title?.trim())
        throw new IntentDraftError('INVALID_OPERATION', 'title is required.');
    if (!focus?.trim())
        throw new IntentDraftError('INVALID_OPERATION', 'focus is required.');
    if (/[|\n\r]/.test(title)) {
        throw new IntentDraftError('INVALID_OPERATION', 'title cannot contain "|" or a newline (breaks intent-history.md).');
    }
    if (/[|\n\r]/.test(focus)) {
        throw new IntentDraftError('INVALID_OPERATION', 'focus cannot contain "|" or a newline (breaks intent-history.md).');
    }
}
function createIntentDraft(input) {
    const { projectRoot, title, focus, allowReopenClosed = false } = input;
    assertRequiredMetadata(title, focus);
    // Read-only preflight — a brand-new project with no chain yet has nothing
    // to check CLOSED-ness against.
    let activeForPreflight = null;
    try {
        activeForPreflight = (0, chain_1.readActiveChain)(projectRoot).data;
    }
    catch {
        // no chain exists yet — first intent draft on this project
    }
    if (activeForPreflight?.lifecycle_state === 'CLOSED' && !allowReopenClosed) {
        throw new IntentDraftError('INVALID_OPERATION', 'The active chain is CLOSED. Creating a new intent draft will open a new, isolated chain and ' +
            'activate it — the CLOSED chain is left untouched. Confirm reopening before retrying.');
    }
    const chainVersion = (0, chain_1.nextChainVersion)(projectRoot);
    const relPath = (0, fs_1.toPosix)(path_1.default.join('Sigma', 'charter', `DIR-INTENT-${chainVersion}.md`));
    const absPath = path_1.default.join(projectRoot, relPath);
    (0, artifacts_1.copyTemplateToArtifact)('DIR-INTENT-TEMPLATE.md', absPath);
    (0, controlStore_1.controlTestFailpoint)('create_after_artifact');
    const chain = (0, chain_1.createInitialChain)(chainVersion, relPath, title, focus);
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain); // chain file first
    (0, controlStore_1.controlTestFailpoint)('create_after_chain');
    (0, chain_1.writeActivateStatus)(projectRoot, chainVersion); // manifest last — PLAN-EVAL-01 §5.9 write order
    (0, controlStore_1.controlTestFailpoint)('create_after_activate');
    (0, intentHistory_1.renderIntentHistoryFile)(projectRoot);
    (0, controlStore_1.controlTestFailpoint)('create_after_history');
    return { chainVersion, relPath, title, focus };
}
//# sourceMappingURL=intentDraftService.js.map