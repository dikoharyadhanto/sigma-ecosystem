"use strict";
// PLAN-IMPL-01 §3.4 — sigma_doctor
//
// Read-only WITH RESPECT TO DISK. runDoctorReconciliation mutates the chain
// object in memory (auto-repair of known corruption patterns) but only
// persists if the caller invokes writeChain. This tool deliberately never
// calls writeChain: it reports what reconciliation WOULD change as a
// diagnosis, flagged applied: false. A disk-writing doctor is a mutation and
// belongs to a later (Layer 3) increment, not here.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDoctor = computeDoctor;
exports.registerDoctorTool = registerDoctorTool;
const chain_1 = require("../../engine/chain");
const shared_1 = require("../shared");
// Pure core (PLAN-IMPL-01 §4-A).
function computeDoctor(root) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return (0, shared_1.noProject)();
    // readActiveChain returns a fresh in-memory projection; mutating it here does
    // not touch disk because we never writeChain.
    const { data } = (0, chain_1.readActiveChain)(root);
    const overrides = (0, chain_1.readOverrides)(root);
    // root is passed so the diagnosis includes stale entry.file detection; this
    // tool still never calls writeChain, so the rewrite/markers stay in-memory.
    const findings = (0, chain_1.runDoctorReconciliation)(data, overrides, root);
    return {
        active: true,
        findings,
        applied: false,
        source: shared_1.SOURCE_ENGINE,
    };
}
const zod_1 = require("zod");
function registerDoctorTool(server) {
    server.registerTool('sigma_doctor', {
        title: 'Sigma Doctor (diagnosis only)',
        description: 'Run Sigma runtime reconciliation as a READ-ONLY diagnosis and report what it would repair or flag, without writing to disk. Read-only. Accepts optional project_root parameter. Returns { active, findings, applied: false, source }.',
        inputSchema: {
            project_root: zod_1.z
                .string()
                .optional()
                .describe('Optional absolute path to the Sigma project root directory.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ project_root }) => (0, shared_1.okText)(computeDoctor((0, shared_1.resolveRoot)(project_root))));
}
//# sourceMappingURL=doctor.js.map