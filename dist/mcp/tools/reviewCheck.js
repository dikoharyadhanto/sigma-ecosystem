"use strict";
// sigma_review_check — query-plane equivalent of `sigma review check`.
// Validates the chain's PRODUCT REVIEW and reports its verdict state. Read
// only: it reads the document, never creates or edits it (that is `review new`).
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeReviewCheck = computeReviewCheck;
exports.registerReviewCheckTool = registerReviewCheckTool;
const path_1 = __importDefault(require("path"));
const chain_1 = require("../../engine/chain");
const closeNewService_1 = require("../../services/closeNewService");
const docCheck_1 = require("../../utils/docCheck");
const contract_1 = require("../contract");
const errors_1 = require("../errors");
const shared_1 = require("../shared");
const queryHelpers_1 = require("./queryHelpers");
function computeReviewCheck(root, chain) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return (0, shared_1.noProject)();
    try {
        const { chainVersion, data } = (0, queryHelpers_1.resolveChainTarget)(root, chain);
        const rel = (0, closeNewService_1.findProductReviewRel)(root, data);
        if (!rel) {
            throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'No PRODUCT REVIEW found for this chain. It is created by `sigma review new`.');
        }
        const report = (0, docCheck_1.validateSigmaDocFile)(path_1.default.join(root, rel), 'review');
        return {
            active_chain: chainVersion,
            ok: report.ok,
            heading: report.heading,
            // Project-relative on every binding mode. redactPath() keeps the absolute
            // path for an unbound client, which a new tool has no reason to inherit.
            file: rel,
            document_type: report.documentType,
            schema: report.schema,
            errors: report.errors,
            warnings: report.warnings,
            passes: report.passes,
            requirements: report.requirements,
            source: shared_1.SOURCE_ENGINE,
        };
    }
    catch (e) {
        return (0, queryHelpers_1.asPrecondition)(e, [root]);
    }
}
function registerReviewCheckTool(server) {
    server.registerTool('sigma_review_check', {
        title: 'Check the PRODUCT REVIEW',
        description: 'Validate the PRODUCT REVIEW of the active chain (or `chain`) and report its structure and verdict state — ' +
            'the query-plane equivalent of `sigma review check`. Read-only: never creates or edits the review. ' +
            'Returns { active_chain, ok, heading, file, document_type, schema, errors, warnings, passes, requirements, source }. ' +
            'Fails with INVALID_OPERATION when the chain has no PRODUCT REVIEW. Whether a CLOSE may be created is ' +
            'answered by sigma_close_check, not here.',
        inputSchema: { chain: queryHelpers_1.chainArg },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args) => (0, contract_1.respond)('sigma_review_check', undefined, (root) => computeReviewCheck(root, args.chain)));
}
//# sourceMappingURL=reviewCheck.js.map