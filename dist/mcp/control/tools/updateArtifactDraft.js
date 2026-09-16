"use strict";
// Stage C pilot (intent) + Stage E W1 extension (plan/exec) —
// sigma_update_artifact_draft. Control-plane only. Scope pinned to
// intent/plan/exec at the schema level (z.enum) as well as inside
// updateArtifactDraft() itself — see artifactDraftUpdate.ts's header.
// Role is derived from `type`, not hardcoded — ARC owns intent, FMN owns
// plan, DEV owns exec (ownerRoleForArtifactType()), computed per call so it
// can never be supplied by the caller.
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUpdateArtifactDraftTool = registerUpdateArtifactDraftTool;
const zod_1 = require("zod");
const artifactDraftUpdate_1 = require("../artifactDraftUpdate");
const shared_1 = require("../shared");
function registerUpdateArtifactDraftTool(server) {
    server.registerTool('sigma_update_artifact_draft', {
        title: 'Update artifact DRAFT content',
        description: 'Replaces the full content of a registered DRAFT artifact — intent (ARC role), plan (FMN role), or ' +
            'exec (DEV role) — and only the active chain\'s own version of that type. Requires idempotency_key, ' +
            'expected_state_revision (from sigma_get_state), and expected_artifact_sha256 (from a prior ' +
            'sigma_read_artifact call) — a mismatch on either is rejected rather than silently overwritten.',
        inputSchema: {
            type: zod_1.z.enum(['intent', 'plan', 'exec']),
            version: zod_1.z.string().min(1).describe('Must match an existing DRAFT version of that type in the active chain, e.g. "v1" (intent) or "v0.1" (plan/exec).'),
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
        allowedRoles: [(0, artifactDraftUpdate_1.ownerRoleForArtifactType)(args.type)],
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