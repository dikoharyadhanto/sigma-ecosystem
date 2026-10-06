"use strict";
// Stage F (W2 batch) — the use-case shared by `sigma intent score` (CLI) and
// sigma_commit_intent_score's mutate step (MCP control tool). Transport-
// agnostic: no Commander, no console.log — mirrors intentRatifyService.ts's
// split (src/commands/intent.ts keeps printing).
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentScoreError = void 0;
exports.intentScoreTransactionFiles = intentScoreTransactionFiles;
exports.recordArcScoreUseCase = recordArcScoreUseCase;
const chain_1 = require("../engine/chain");
const intentHistory_1 = require("../utils/intentHistory");
class IntentScoreError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'IntentScoreError';
    }
}
exports.IntentScoreError = IntentScoreError;
function intentScoreTransactionFiles(projectRoot, targetChainVersion) {
    const { chainVersion } = targetChainVersion
        ? { chainVersion: targetChainVersion }
        : (0, chain_1.readActiveChain)(projectRoot);
    return [(0, chain_1.chainFilePath)(projectRoot, chainVersion), (0, intentHistory_1.intentHistoryPath)(projectRoot)];
}
/**
 * Records an ARC Satisfaction Score against a RATIFIED DIR-INTENT — the
 * active chain by default, or `targetChainVersion` (mirrors CLI's `--v`).
 * Throws IntentScoreError (INVALID_OPERATION) for every business-rule
 * rejection (not RATIFIED, score out of range, notes containing `|`/newline)
 * so the caller gets an actionable message.
 */
function recordArcScoreUseCase(projectRoot, score, notes, targetChainVersion) {
    const { chainVersion, data: chain } = targetChainVersion
        ? { chainVersion: targetChainVersion, data: (0, chain_1.readChain)(projectRoot, targetChainVersion) }
        : (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    try {
        (0, chain_1.recordArcScore)(chain, score, notes);
    }
    catch (e) {
        throw new IntentScoreError('INVALID_OPERATION', e.message);
    }
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    (0, intentHistory_1.renderIntentHistoryFile)(projectRoot);
    return { chainVersion, version: chain.intent.version, score, notes };
}
//# sourceMappingURL=intentScoreService.js.map