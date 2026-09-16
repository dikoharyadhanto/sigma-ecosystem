"use strict";
// Stage C pilot — sigma_update_artifact_draft. Control-plane only. Scope
// pinned to type "intent" at the schema level (z.literal) as well as inside
// updateArtifactDraft() itself — see artifactDraftUpdate.ts's header.
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUpdateArtifactDraftTool = registerUpdateArtifactDraftTool;
const zod_1 = require("zod");
const artifactDraftUpdate_1 = require("../artifactDraftUpdate");
const shared_1 = require("../shared");
function registerUpdateArtifactDraftTool(server) {
    server.registerTool('sigma_update_artifact_draft', {
        title: 'Update artifact DRAFT content',
        description: 'Replaces the full content of a registered DRAFT artifact. Stage C pilot scope: intent only, and ' +
            'only the active chain\'s own intent version. ARC role only. Requires idempotency_key, ' +
            'expected_state_revision (from sigma_get_state), and expected_artifact_sha256 (from a prior ' +
            'sigma_read_artifact call) — a mismatch on either is rejected rather than silently overwritten.',
        inputSchema: {
            type: zod_1.z.literal('intent'),
            version: zod_1.z.string().min(1).describe('Must match the active chain\'s current intent version, e.g. "v1".'),
            content: zod_1.z.string().describe('Full replacement content of the DRAFT file (not a diff).'),
            expected_artifact_sha256: zod_1.z.string().min(1),
            idempotency_key: zod_1.z.string().min(1),
            expected_state_revision: zod_1.z.string().min(1),
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (args) => (0, shared_1.respondControlWrite)({
        tool: 'sigma_update_artifact_draft',
        operationId: 'artifact_draft_update',
        idempotencyKey: args.idempotency_key,
        argumentsForHash: {
            type: args.type,
            version: args.version,
            content: args.content,
            expected_artifact_sha256: args.expected_artifact_sha256,
        },
        allowedRoles: ['ARC'],
        checkPreconditions: (0, shared_1.staleStateCheck)(args.expected_state_revision),
        artifactHashBefore: args.expected_artifact_sha256,
        transactionFiles: (root) => (0, artifactDraftUpdate_1.updateArtifactDraftTransactionFiles)({
            projectRoot: root,
            type: args.type,
            version: args.version,
        }),
    }, (root) => (0, artifactDraftUpdate_1.updateArtifactDraft)({
        projectRoot: root,
        type: args.type,
        version: args.version,
        content: args.content,
        expectedArtifactSha256: args.expected_artifact_sha256,
    })));
}
//# sourceMappingURL=updateArtifactDraft.js.map