"use strict";
// Stage F (W2 batch) — the use-case shared by `sigma exec lock` (CLI) and
// sigma_commit_exec_lock's mutate step (MCP control tool). Transport-
// agnostic: no Commander, no console.log — mirrors intentRatifyService.ts's
// split (src/commands/exec.ts keeps printing).
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecLockError = void 0;
exports.resolveExecLockTarget = resolveExecLockTarget;
exports.lockExecDraftTransactionFiles = lockExecDraftTransactionFiles;
exports.lockExecDraftUseCase = lockExecDraftUseCase;
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const docCheck_1 = require("../utils/docCheck");
class ExecLockError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'ExecLockError';
    }
}
exports.ExecLockError = ExecLockError;
function execDocPath(projectRoot, chain, version) {
    const entry = chain.exec.versions.find(v => v.version === version);
    if (!entry)
        throw new ExecLockError('INVALID_OPERATION', `DEV-EXEC ${version} not found.`);
    return path_1.default.join(projectRoot, entry.file ?? path_1.default.join('Sigma', 'evidence', `DEV-EXEC-${entry.version}.md`));
}
/**
 * Resolves which DRAFT DEV-EXEC version a lock should target, mirroring the
 * CLI's `resolveTargetVersion()` disambiguation: explicit version wins, then
 * the sole open DRAFT, otherwise an actionable error (none open, or more
 * than one and no version was given).
 */
function resolveExecLockTarget(chain, explicitVersion) {
    const resolution = (0, chain_1.resolveTargetVersion)(chain.exec.versions, explicitVersion);
    if (resolution.kind === 'empty') {
        throw new ExecLockError('INVALID_OPERATION', 'No DRAFT DEV-EXEC to lock. Run: sigma exec new');
    }
    if (resolution.kind === 'ambiguous') {
        const described = resolution.candidates
            .map(v => {
            const entry = chain.exec.versions.find(e => e.version === v);
            return entry?.plan_version_ref ? `${v} (plan ${entry.plan_version_ref})` : v;
        })
            .join(', ');
        throw new ExecLockError('INVALID_OPERATION', `${resolution.candidates.length} DRAFT DEV-EXECs are open: ${described}\n` +
            `Specify which one to lock: sigma exec lock --v ${resolution.candidates[0]}`);
    }
    return resolution.version;
}
function lockExecDraftTransactionFiles(projectRoot) {
    const { chainVersion } = (0, chain_1.readActiveChain)(projectRoot);
    return [(0, chain_1.chainFilePath)(projectRoot, chainVersion)];
}
/**
 * Locks the active chain's DRAFT DEV-EXEC identified by `version` (or the
 * sole open DRAFT when omitted), re-evaluating Gate 3. Throws ExecLockError
 * (INVALID_OPERATION) for every business-rule rejection — ambiguous/missing
 * target, or the doc fails structural/eligibility validation.
 */
function lockExecDraftUseCase(projectRoot, version) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    const targetVersion = resolveExecLockTarget(chain, version);
    const absPath = execDocPath(projectRoot, chain, targetVersion);
    const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'exec');
    try {
        (0, docCheck_1.ensureSigmaDocEligible)(report, 'exec');
    }
    catch (e) {
        throw new ExecLockError('INVALID_OPERATION', e.message);
    }
    (0, chain_1.lockExecVersion)(chain, targetVersion);
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    return { chainVersion, version: targetVersion, docReport: report, gate3Satisfied: chain.gates.gate_3_satisfied };
}
//# sourceMappingURL=execLockService.js.map