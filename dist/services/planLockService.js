"use strict";
// Stage F (W2 batch) — the use-case shared by `sigma plan lock` (CLI) and
// sigma_commit_plan_lock's mutate step (MCP control tool). Transport-
// agnostic: no Commander, no console.log — mirrors intentRatifyService.ts's
// split (src/commands/plan.ts keeps printing).
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanLockError = void 0;
exports.resolvePlanLockTarget = resolvePlanLockTarget;
exports.lockPlanDraftTransactionFiles = lockPlanDraftTransactionFiles;
exports.lockPlanDraftUseCase = lockPlanDraftUseCase;
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const docCheck_1 = require("../utils/docCheck");
class PlanLockError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'PlanLockError';
    }
}
exports.PlanLockError = PlanLockError;
function planDocPath(projectRoot, chain, version) {
    const entry = chain.plan.versions.find(v => v.version === version);
    if (!entry)
        throw new PlanLockError('INVALID_OPERATION', `FMN-PLAN ${version} not found.`);
    return path_1.default.join(projectRoot, entry.file ?? path_1.default.join('Sigma', 'contract', `FMN-PLAN-${entry.version}.md`));
}
/**
 * Resolves which DRAFT FMN-PLAN version a lock should target, mirroring the
 * CLI's `resolveTargetVersion()` disambiguation: explicit version wins, then
 * the sole open DRAFT, otherwise an actionable error (none open, or more
 * than one and no version was given).
 */
function resolvePlanLockTarget(chain, explicitVersion) {
    const resolution = (0, chain_1.resolveTargetVersion)(chain.plan.versions, explicitVersion);
    if (resolution.kind === 'empty') {
        throw new PlanLockError('INVALID_OPERATION', 'No DRAFT FMN-PLAN to lock. Run: sigma plan new');
    }
    if (resolution.kind === 'ambiguous') {
        throw new PlanLockError('INVALID_OPERATION', `${resolution.candidates.length} DRAFT FMN-PLANs are open: ${resolution.candidates.join(', ')}. Specify which one to lock.`);
    }
    return resolution.version;
}
function lockPlanDraftTransactionFiles(projectRoot) {
    const { chainVersion } = (0, chain_1.readActiveChain)(projectRoot);
    return [(0, chain_1.chainFilePath)(projectRoot, chainVersion)];
}
/**
 * Locks the active chain's DRAFT FMN-PLAN identified by `version` (or the
 * sole open DRAFT when omitted), opening Gate 2. Throws PlanLockError
 * (INVALID_OPERATION) for every business-rule rejection — ambiguous/missing
 * target, or the doc fails structural/eligibility validation.
 */
function lockPlanDraftUseCase(projectRoot, version) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    const targetVersion = resolvePlanLockTarget(chain, version);
    const absPath = planDocPath(projectRoot, chain, targetVersion);
    const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'plan');
    try {
        (0, docCheck_1.ensureSigmaDocEligible)(report, 'plan');
    }
    catch (e) {
        throw new PlanLockError('INVALID_OPERATION', e.message);
    }
    const lockedVersion = (0, chain_1.lockPlanVersion)(chain, targetVersion);
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    return { chainVersion, version: lockedVersion, docReport: report };
}
//# sourceMappingURL=planLockService.js.map