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
    const findings = (0, chain_1.runDoctorReconciliation)(data, overrides);
    return {
        active: true,
        findings,
        applied: false,
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerDoctorTool(server) {
    server.registerTool('sigma_doctor', {
        title: 'Sigma Doctor (diagnosis only)',
        description: 'Run Sigma runtime reconciliation as a READ-ONLY diagnosis and report what it would repair or flag, without writing to disk. Takes no arguments. Returns { active, findings: { repaired, invalidMarked, invalidCleared, remainingInvalid }, applied: false, source }. applied is always false — this tool never persists changes. Returns { active: false, ... } when no chain exists.',
        inputSchema: {},
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async () => (0, shared_1.okText)(computeDoctor((0, shared_1.resolveRoot)())));
}
//# sourceMappingURL=doctor.js.map