"use strict";
// sigma_create_review — control-plane equivalent of `sigma review new`
// (PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY WP-MCP-04).
//
// Single step: a PRODUCT REVIEW is one file with no chain state and no
// ticket. ARC only, as `review new` is operated by ARC after the Director
// states the product is ready and FMN's review request has arrived. Neither
// of those two human facts can be verified here, exactly as with the CLI; the
// tool enforces what the CLI enforces (RATIFIED INTENT, one review per INTENT)
// and nothing weaker.
//
// It never records a verdict. Verdicts are written into the document by ARC,
// AUD, and the Director themselves.
//
// Its transaction lists exactly one file, the review itself. The file name is
// derived from the chain version, never from the caller.
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCreateReviewTool = registerCreateReviewTool;
const zod_1 = require("zod");
const reviewNewService_1 = require("../../../services/reviewNewService");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const queryHelpers_1 = require("../../tools/queryHelpers");
const shared_1 = require("../shared");
function refusal(root, e) {
    if (e instanceof reviewNewService_1.ReviewNewError) {
        throw new errors_1.McpQueryError(e.code === 'GATE_BLOCKED' ? contract_1.ERROR_CODES.GATE_BLOCKED : contract_1.ERROR_CODES.INVALID_OPERATION, (0, queryHelpers_1.scrubHostPaths)(e.message, [root]));
    }
    if (e instanceof errors_1.McpQueryError)
        throw e;
    // Missing chain, malformed tracker, invalid numbering: CLI prints these as is.
    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, (0, queryHelpers_1.scrubHostPaths)(e instanceof Error ? e.message : String(e), [root]));
}
function registerCreateReviewTool(server) {
    server.registerTool('sigma_create_review', {
        title: 'Create the PRODUCT REVIEW',
        description: 'Creates the PRODUCT REVIEW (Sigma/review/PRODUCT-REVIEW-vN.md) for the active chain from the template — ' +
            'the MCP control-plane equivalent of `sigma review new`. ARC role only. Requires a RATIFIED INTENT; one ' +
            'review is kept per INTENT, a second call is refused. Records no verdict: ARC, AUD, and the Director write ' +
            'theirs into the document. Writes one file and changes no chain state. Requires idempotency_key and ' +
            'expected_state_revision (from a prior sigma_get_state call on this binding). Returns { chain, path, ' +
            'validation: { ok, errors, warnings } }. Whether a CLOSE may follow is sigma_close_check.',
        inputSchema: {
            idempotency_key: zod_1.z.string().min(1),
            expected_state_revision: zod_1.z.string().min(1),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args) => {
        const stale = (0, shared_1.staleStateCheck)(args.expected_state_revision);
        return (0, shared_1.respondControlWrite)({
            tool: 'sigma_create_review',
            operationId: 'review_new',
            idempotencyKey: args.idempotency_key,
            argumentsForHash: {},
            allowedRoles: ['ARC'],
            checkPreconditions: (root) => {
                stale(root);
                // Refuse before a journal exists, so a refusal leaves nothing behind.
                try {
                    (0, reviewNewService_1.resolveReviewNewTarget)(root);
                }
                catch (e) {
                    refusal(root, e);
                }
            },
            transactionFiles: (root) => (0, reviewNewService_1.reviewNewTransactionFiles)(root),
            guardedWrites: true,
        }, (root) => {
            try {
                const result = (0, reviewNewService_1.createReviewDraft)(root);
                return {
                    chain: result.chainVersion,
                    path: result.relPath,
                    validation: {
                        ok: result.docReport.ok,
                        errors: result.docReport.errors,
                        warnings: result.docReport.warnings,
                    },
                };
            }
            catch (e) {
                return refusal(root, e);
            }
        });
    });
}
//# sourceMappingURL=createReview.js.map