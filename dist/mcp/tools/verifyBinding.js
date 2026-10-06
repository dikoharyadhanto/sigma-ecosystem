"use strict";
// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §9.1 — sigma_verify_binding
//
// Lets a consumer confirm, before it does anything else, that this server is
// bound to the project the consumer thinks it is. An orchestrator holding
// several sessions has otherwise no way to tell them apart: every other tool
// answers happily about whichever project it is bound to.
//
// It only ever compares against the existing binding. It never searches the
// filesystem for the expected project, and a mismatch is reported as a fact,
// not resolved by moving the binding.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeVerifyBinding = computeVerifyBinding;
exports.registerVerifyBindingTool = registerVerifyBindingTool;
const zod_1 = require("zod");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
function computeVerifyBinding(root, expected) {
    const binding = (0, shared_1.getBinding)();
    const idMatch = expected.projectId === undefined ? null : binding.projectId === expected.projectId;
    const rootMatch = expected.root === undefined
        ? null
        : binding.root !== null && (0, contract_1.fingerprintOfExpectedRoot)(expected.root) === binding.rootFingerprint;
    // "Usable" means usable by a required-binding consumer, which is the only
    // kind allowed to hold governance capability (§7.1 rule 8). So it demands a
    // *verified* binding, not merely a bound one — reviewer finding R-04, second
    // half. A positional-config session is bound and perfectly able to answer
    // queries, and still reports usable:false, because it never proved which
    // project it is attached to. Consumers that only need reads should look at
    // `bound`; consumers that need identity should look at `usable`.
    const ok = binding.verified && binding.root !== null && idMatch !== false && rootMatch !== false;
    return {
        active: root !== null,
        bound: binding.root !== null,
        binding_verified: binding.verified,
        binding_kind: binding.kind,
        mode: binding.mode,
        bound_role: binding.role,
        expected_project_id_match: idMatch,
        expected_root_match: rootMatch,
        usable: ok,
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerVerifyBindingTool(server) {
    server.registerTool('sigma_verify_binding', {
        title: 'Verify Sigma Project Binding',
        description: 'Confirm which Sigma project this MCP server is bound to, and optionally check that binding against what the caller expects. Read-only. Optional expected_project_id and expected_root are compared against the server-side binding only — this tool never searches for another project and never changes the binding. Returns { bound, binding_verified, binding_kind, mode, bound_role, expected_project_id_match, expected_root_match, usable, source }. A null match field means the caller did not supply that expectation.',
        inputSchema: {
            expected_project_id: zod_1.z
                .string()
                .optional()
                .describe('Project ID the caller believes this server is bound to.'),
            expected_root: zod_1.z
                .string()
                .optional()
                .describe('Absolute project root the caller believes this server is bound to. Compared by fingerprint; never used to rebind.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ expected_project_id, expected_root }) => (0, contract_1.respond)('sigma_verify_binding', undefined, (root) => computeVerifyBinding(root, { projectId: expected_project_id, root: expected_root })));
}
//# sourceMappingURL=verifyBinding.js.map