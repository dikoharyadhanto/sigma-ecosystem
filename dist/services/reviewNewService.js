"use strict";
// The one use case shared by `sigma review new` (CLI) and `sigma_create_review`
// (MCP control tool). Transport-agnostic: no Commander, no console output.
//
// A PRODUCT REVIEW is recognised by its file, Sigma/review/PRODUCT-REVIEW-vN.md,
// one per INTENT, with no chain state (see commands/review.ts). Creating it
// therefore writes exactly one file and nothing else.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewNewError = void 0;
exports.resolveReviewNewTarget = resolveReviewNewTarget;
exports.reviewNewTransactionFiles = reviewNewTransactionFiles;
exports.createReviewDraft = createReviewDraft;
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const artifactNames_1 = require("../engine/artifactNames");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
const docCheck_1 = require("../utils/docCheck");
class ReviewNewError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'ReviewNewError';
    }
}
exports.ReviewNewError = ReviewNewError;
/** Every `review new` precondition, checked without writing. Throws ReviewNewError for a refusal. */
function resolveReviewNewTarget(projectRoot) {
    const { data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    if (chain.intent.state !== 'RATIFIED') {
        throw new ReviewNewError('GATE_BLOCKED', 'PRODUCT REVIEW requires a RATIFIED INTENT. Run: sigma intent ratify');
    }
    const version = chain.chain_version;
    const [existing] = (0, artifactNames_1.existingArtifactNames)(projectRoot, 'review', 'review', version);
    if (existing) {
        throw new ReviewNewError('INVALID_OPERATION', `PRODUCT REVIEW already exists: Sigma/review/${existing}. Only one is kept per INTENT.`);
    }
    return { chain, chainVersion: version, relPath: (0, fs_1.toPosix)(path_1.default.join('Sigma', 'review', (0, artifactNames_1.artifactFileName)('review', version))) };
}
/** The single file a `review new` may create, absolute, for a control transaction. */
function reviewNewTransactionFiles(projectRoot) {
    return [path_1.default.join(projectRoot, resolveReviewNewTarget(projectRoot).relPath)];
}
function createReviewDraft(projectRoot) {
    const target = resolveReviewNewTarget(projectRoot);
    (0, artifacts_1.copyTemplateToArtifact)('PRODUCT-REVIEW-TEMPLATE.md', path_1.default.join(projectRoot, target.relPath), projectRoot);
    const docReport = (0, docCheck_1.validateSigmaDocFile)(path_1.default.join(projectRoot, target.relPath), 'review');
    return { chainVersion: target.chainVersion, relPath: target.relPath, docReport };
}
//# sourceMappingURL=reviewNewService.js.map