"use strict";
// Stage F (W2 batch) — the use-case shared by `sigma close new` (CLI) and
// sigma_commit_close_new's mutate step (MCP control tool). Transport-
// agnostic: no Commander, no console.log — mirrors intentRatifyService.ts's
// split (src/commands/close.ts keeps printing).
//
// Unlike the other four W2 pilots in this batch, this operation creates a
// DIR-CLOSE artifact that does not exist yet — there is nothing to freeze a
// pre-existing sha256 against. The MCP control tool's operation ticket
// therefore carries `target: null` and relies on `expected_state_revision`
// alone for drift detection. The PRODUCT REVIEW verdicts live in their own file
// and are not covered by state_revision, so createCloseDraftUseCase() re-runs
// every precondition (Gate 3, PRODUCT REVIEW verdicts) before writing anything.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseNewError = void 0;
exports.findProductReviewRel = findProductReviewRel;
exports.assessCloseNewEligibility = assessCloseNewEligibility;
exports.assertCloseNewEligible = assertCloseNewEligible;
exports.closeNewTransactionFiles = closeNewTransactionFiles;
exports.createCloseDraftUseCase = createCloseDraftUseCase;
const path_1 = __importDefault(require("path"));
const lifecycleView_1 = require("../engine/lifecycleView");
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
const docCheck_1 = require("../utils/docCheck");
const artifactNames_1 = require("../engine/artifactNames");
class CloseNewError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'CloseNewError';
    }
}
exports.CloseNewError = CloseNewError;
function closeDraftRelPath(chain) {
    return (0, fs_1.toPosix)(path_1.default.join('Sigma', 'close', (0, artifactNames_1.artifactFileName)('close', chain.chain_version)));
}
/** Project-relative path of this chain's PRODUCT REVIEW, or null when no file exists. */
function findProductReviewRel(projectRoot, chain) {
    const [existing] = (0, artifactNames_1.existingArtifactNames)(projectRoot, 'review', 'review', chain.chain_version);
    return existing ? (0, fs_1.toPosix)(path_1.default.join('Sigma', 'review', existing)) : null;
}
/**
 * Reports every `close new` precondition against a live chain without writing
 * anything or throwing. Used by `sigma close check`, by prepare (freeze the
 * ticket only if this would currently succeed), and by `close new` itself.
 * Order: Gate 3, then the PRODUCT REVIEW exists, then its verdicts, then an
 * existing CLOSE.
 */
function assessCloseNewEligibility(chain, projectRoot) {
    const blockers = [];
    const gate3Satisfied = (0, chain_1.hasCleanGate3Chain)(chain) && (0, lifecycleView_1.effectiveLifecycleGates)(projectRoot, chain).gate_3_satisfied;
    if (!gate3Satisfied) {
        const open = (0, chain_1.describeGate3Blockers)(chain);
        const lines = ['GATE 3 BLOCKED: the chain still has open work.', ...open.map(r => `  ${r}`)];
        lines.push('Every locked plan needs exactly one locked exec with valid contract evidence, and nothing may be left in DRAFT/APPROVED.');
        if (open.some(r => r.startsWith('DRAFT FMN-PLAN'))) {
            lines.push('Abandon what is no longer wanted: sigma plan supersede --v <version> --reason "..."');
        }
        if (open.some(r => r.includes('has no LOCKED DEV-EXEC'))) {
            lines.push('Run: sigma exec new / sigma exec approve --director-confirm to finish an unpaired plan.');
        }
        blockers.push({ code: 'GATE_BLOCKED', message: lines.join('\n') });
    }
    const reviewFile = findProductReviewRel(projectRoot, chain);
    let review = null;
    if (!reviewFile) {
        blockers.push({
            code: 'GATE_BLOCKED',
            message: 'PRODUCT REVIEW MISSING: closure cannot be created because the PRODUCT REVIEW does not exist. ' +
                'Create it with: sigma review new',
        });
    }
    else {
        review = (0, docCheck_1.evaluateProductReview)(path_1.default.join(projectRoot, reviewFile));
        if (!review.accepted) {
            blockers.push({
                code: 'GATE_BLOCKED',
                message: `PRODUCT REVIEW NOT ACCEPTED (${reviewFile}): closure needs every required verdict to be PASS or PASS_WITH_RISK.\n` +
                    review.blockers.map(b => `  ${b}`).join('\n'),
            });
        }
    }
    if (chain.close !== null && chain.close.state !== 'SUPERSEDED') {
        blockers.push({
            code: 'INVALID_OPERATION',
            message: `DIR-CLOSE already exists for this chain (${chain.close.version}, ${chain.close.state}). Resolve or lock the existing DIR-CLOSE first.`,
        });
    }
    return { eligible: blockers.length === 0, blockers, gate3Satisfied, reviewFile, review };
}
/** Throws CloseNewError for the first unmet `close new` precondition. */
function assertCloseNewEligible(chain, projectRoot) {
    const result = assessCloseNewEligibility(chain, projectRoot);
    const first = result.blockers[0];
    if (first)
        throw new CloseNewError(first.code, first.message);
}
function closeNewTransactionFiles(projectRoot) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    return [(0, chain_1.chainFilePath)(projectRoot, chainVersion), path_1.default.join(projectRoot, closeDraftRelPath(chain))];
}
/**
 * Creates a new DIR-CLOSE draft against the active chain (Gate 3). Throws
 * CloseNewError (GATE_BLOCKED / INVALID_OPERATION) for every business-rule
 * rejection so the caller gets an actionable message.
 */
function createCloseDraftUseCase(projectRoot) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    assertCloseNewEligible(chain, projectRoot);
    const riskNotesBefore = assessCloseNewEligibility(chain, projectRoot).review?.riskNotes ?? [];
    const version = chain.chain_version;
    const relPath = closeDraftRelPath(chain);
    const absPath = path_1.default.join(projectRoot, relPath);
    // Either name form counts (F10): never put a second file beside an existing one.
    const [existingClose] = (0, artifactNames_1.existingArtifactNames)(projectRoot, 'close', 'close', version);
    if (existingClose)
        throw new CloseNewError('INVALID_OPERATION', `CLOSE FILE CONFLICT: Sigma/close/${existingClose} already exists.`);
    (0, artifacts_1.copyTemplateToArtifact)('DIR-CLOSE-TEMPLATE.md', absPath);
    try {
        (0, chain_1.registerCloseDraft)(chain, relPath);
    }
    catch (e) {
        throw new CloseNewError('INVALID_OPERATION', e.message);
    }
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'close');
    if (!report.ok) {
        // Should never happen from the fixed template alone — defensive only.
        // Throwing here (rather than returning a failing report, as the CLI
        // does) lets the MCP transaction wrapper roll the scaffold back instead
        // of leaving a broken DRAFT registered against the chain.
        throw new CloseNewError('INTERNAL_ERROR', `${report.heading} failed immediately after scaffold.`);
    }
    return { chainVersion, version, relPath, docReport: report, riskNotes: riskNotesBefore };
}
//# sourceMappingURL=closeNewService.js.map