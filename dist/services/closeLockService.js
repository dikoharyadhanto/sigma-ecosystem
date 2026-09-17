"use strict";
// Stage F (W2 batch, continued) — the use-case shared by `sigma close lock`
// (CLI) and sigma_commit_close_lock's mutate step (MCP control tool).
// Transport-agnostic: no Commander, no console.log, no interactive prompt —
// mirrors intentRatifyService.ts's split. The CLI's interactive
// `promptApprove()`/`--yes` gate has no MCP equivalent: the Director
// approval record IS the explicit confirmation for this transition, same as
// every other W2 tool in this batch.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseLockError = void 0;
exports.closeDocPath = closeDocPath;
exports.closeLockTransactionFiles = closeLockTransactionFiles;
exports.lockCloseUseCase = lockCloseUseCase;
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const docCheck_1 = require("../utils/docCheck");
class CloseLockError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'CloseLockError';
    }
}
exports.CloseLockError = CloseLockError;
function closeDocPath(projectRoot, chain) {
    if (!chain.close)
        throw new CloseLockError('INVALID_OPERATION', 'No active DIR-CLOSE found. Run: sigma close new');
    return path_1.default.join(projectRoot, chain.close.file ?? path_1.default.join('Sigma', 'close', `DIR-CLOSE-${chain.close.version}.md`));
}
function closeLockTransactionFiles(projectRoot) {
    const { chainVersion } = (0, chain_1.readActiveChain)(projectRoot);
    return [(0, chain_1.chainFilePath)(projectRoot, chainVersion)];
}
/**
 * Locks the active chain's DRAFT DIR-CLOSE (lifecycle -> CLOSED), auto-
 * locking a still-DRAFT ROADMAP as a side effect. Throws CloseLockError
 * (INVALID_OPERATION) for every business-rule rejection — no active DRAFT
 * close, or the doc fails structural/eligibility validation.
 */
function lockCloseUseCase(projectRoot) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    if (!chain.close || chain.close.state !== 'DRAFT') {
        throw new CloseLockError('INVALID_OPERATION', 'Active DIR-CLOSE is not in DRAFT state. Cannot lock.');
    }
    const closeVersion = chain.close.version;
    const roadmapToLock = chain.roadmap && chain.roadmap.state === 'DRAFT' ? chain.roadmap.version : null;
    const absPath = closeDocPath(projectRoot, chain);
    const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'close');
    try {
        (0, docCheck_1.ensureSigmaDocEligible)(report, 'close');
    }
    catch (e) {
        throw new CloseLockError('INVALID_OPERATION', e.message);
    }
    if (roadmapToLock) {
        (0, chain_1.lockActiveRoadmap)(chain);
    }
    (0, chain_1.lockActiveClose)(chain);
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    return { chainVersion, version: closeVersion, docReport: report, roadmapLocked: roadmapToLock };
}
//# sourceMappingURL=closeLockService.js.map