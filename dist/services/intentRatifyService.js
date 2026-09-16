"use strict";
// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, §14 Stage D — the use-case
// shared by `sigma intent ratify` (CLI) and sigma_commit_intent_ratify's
// mutate step (MCP control tool). Transport-agnostic: no Commander, no
// console.log — the CLI keeps printing the doc report itself (see
// src/commands/intent.ts), this only returns it.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentRatifyError = void 0;
exports.ratifyIntentDraftTransactionFiles = ratifyIntentDraftTransactionFiles;
exports.ratifyIntentDraft = ratifyIntentDraft;
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const docCheck_1 = require("../utils/docCheck");
const intentHistory_1 = require("../utils/intentHistory");
const controlStore_1 = require("../engine/controlStore");
class IntentRatifyError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'IntentRatifyError';
    }
}
exports.IntentRatifyError = IntentRatifyError;
function intentDocPath(projectRoot, chain) {
    return path_1.default.join(projectRoot, chain.intent.file ?? path_1.default.join('Sigma', 'charter', `DIR-INTENT-${chain.intent.version}.md`));
}
function ratifyIntentDraftTransactionFiles(projectRoot) {
    const { chainVersion } = (0, chain_1.readActiveChain)(projectRoot);
    return [(0, chain_1.chainFilePath)(projectRoot, chainVersion), (0, intentHistory_1.intentHistoryPath)(projectRoot)];
}
/**
 * Ratifies the active chain's DRAFT intent. Throws IntentRatifyError
 * (INVALID_OPERATION) for every business-rule rejection — not DRAFT, or the
 * doc fails structural/lock-requirement validation — so the caller (CLI or
 * MCP) gets an actionable message rather than an anonymised internal error.
 * Anything assertChainCanMutate() throws for corrupted/invalid chain state is
 * left untyped on purpose — that is not a normal, caller-fixable rejection.
 */
function ratifyIntentDraft(projectRoot) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    if (chain.intent.state !== 'DRAFT') {
        throw new IntentRatifyError('INVALID_OPERATION', 'Active DIR-INTENT is not in DRAFT state. Cannot ratify.');
    }
    const absPath = intentDocPath(projectRoot, chain);
    const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'intent');
    try {
        (0, docCheck_1.ensureSigmaDocEligible)(report, 'intent');
    }
    catch (e) {
        throw new IntentRatifyError('INVALID_OPERATION', e.message);
    }
    const version = chain.intent.version;
    (0, chain_1.ratifyIntent)(chain);
    (0, chain_1.certifyIntentDoc)(chain, absPath);
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    (0, controlStore_1.controlTestFailpoint)('ratify_after_chain');
    (0, intentHistory_1.renderIntentHistoryFile)(projectRoot);
    (0, controlStore_1.controlTestFailpoint)('ratify_after_history');
    return { chainVersion, version, docReport: report };
}
//# sourceMappingURL=intentRatifyService.js.map