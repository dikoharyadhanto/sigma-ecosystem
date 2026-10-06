"use strict";
// Stage F (W2 batch) — the use-case shared by `sigma intent amendment` (CLI)
// and sigma_commit_intent_amendment's mutate step (MCP control tool).
// Transport-agnostic: no Commander, no console.log — mirrors
// intentRatifyService.ts's split (src/commands/intent.ts keeps printing).
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentAmendmentError = void 0;
exports.intentAmendmentTransactionFiles = intentAmendmentTransactionFiles;
exports.recordIntentAmendmentUseCase = recordIntentAmendmentUseCase;
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const chain_1 = require("../engine/chain");
const amendmentHistory_1 = require("../utils/amendmentHistory");
const config_1 = require("../config");
class IntentAmendmentError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'IntentAmendmentError';
    }
}
exports.IntentAmendmentError = IntentAmendmentError;
function intentDocPath(projectRoot, chain) {
    return path_1.default.join(projectRoot, chain.intent.file ?? path_1.default.join('Sigma', 'charter', `DIR-INTENT-${chain.intent.version}.md`));
}
function intentAmendmentTransactionFiles(projectRoot, targetChainVersion) {
    const { chainVersion, data: chain } = targetChainVersion
        ? { chainVersion: targetChainVersion, data: (0, chain_1.readChain)(projectRoot, targetChainVersion) }
        : (0, chain_1.readActiveChain)(projectRoot);
    return [(0, chain_1.chainFilePath)(projectRoot, chainVersion), intentDocPath(projectRoot, chain), path_1.default.join(projectRoot, config_1.INTENT_AMENDMENT_LOG_FILE)];
}
/**
 * Records a Director-approved Amendment against a RATIFIED DIR-INTENT —
 * the active chain by default, or `targetChainVersion` (mirrors CLI's
 * `--v`). Throws IntentAmendmentError (INVALID_OPERATION) for every
 * business-rule rejection (not RATIFIED, empty/malformed --change) so the
 * caller gets an actionable message. Chain-corruption errors from
 * assertChainCanMutate() are left untyped on purpose, same discipline as
 * ratifyIntentDraft().
 */
function recordIntentAmendmentUseCase(projectRoot, change, targetChainVersion) {
    const { chainVersion, data: chain } = targetChainVersion
        ? { chainVersion: targetChainVersion, data: (0, chain_1.readChain)(projectRoot, targetChainVersion) }
        : (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    let entry;
    try {
        entry = (0, chain_1.recordIntentAmendment)(chain, change);
    }
    catch (e) {
        throw new IntentAmendmentError('INVALID_OPERATION', e.message);
    }
    const absPath = intentDocPath(projectRoot, chain);
    (0, amendmentHistory_1.renderAmendmentHistory)(absPath, chain);
    (0, chain_1.certifyIntentDoc)(chain, absPath);
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    const logPath = path_1.default.join(projectRoot, config_1.INTENT_AMENDMENT_LOG_FILE);
    fs_extra_1.default.ensureFileSync(logPath);
    fs_extra_1.default.appendFileSync(logPath, JSON.stringify({
        chain: chainVersion,
        id: entry.id,
        created_at: entry.created_at,
        director_approved_at: entry.director_approved_at,
        change: entry.change,
        doc_sha256: chain.intent.certified_doc_sha256,
    }) + '\n');
    return { chainVersion, version: chain.intent.version, entry, certifiedDocSha256: chain.intent.certified_doc_sha256 };
}
//# sourceMappingURL=intentAmendmentService.js.map