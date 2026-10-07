"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDoctor = computeDoctor;
exports.registerDoctorTool = registerDoctorTool;
const lifecycleView_1 = require("../../engine/lifecycleView");
const chain_1 = require("../../engine/chain");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
const mailboxMigration_1 = require("../../engine/mailboxMigration");
// Pure core (PLAN-IMPL-01 §4-A).
function computeDoctor(root) {
    if (!root)
        return (0, shared_1.noProject)();
    const mailbox = (0, mailboxMigration_1.mailboxMigrationDiagnosis)(root);
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return { active: true, findings: { repaired: [], invalidMarked: [], invalidCleared: [] }, mailbox, applied: false, source: shared_1.SOURCE_ENGINE };
    // readActiveChain returns a fresh in-memory projection; mutating it here does
    // not touch disk because we never writeChain.
    const { data } = (0, chain_1.readActiveChain)(root);
    const overrides = (0, chain_1.readOverrides)(root);
    const findings = (0, chain_1.runDoctorReconciliation)(data, overrides);
    return {
        active: true,
        lifecycle: (0, lifecycleView_1.lifecycleView)(root, data),
        findings,
        mailbox,
        applied: false,
        source: shared_1.SOURCE_ENGINE,
    };
}
const zod_1 = require("zod");
function registerDoctorTool(server) {
    server.registerTool('sigma_doctor', {
        title: 'Sigma Doctor (diagnosis only)',
        description: 'Diagnose Sigma runtime and mailbox migration/integrity without writing, including projects before their first INTENT. Mailbox migration/reset requires CLI doctor --migrate-mailbox. Accepts optional project_root. Returns { active, findings, mailbox, applied: false, source }.',
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
    }, async ({ project_root }) => (0, contract_1.respond)('sigma_doctor', project_root, computeDoctor));
}
//# sourceMappingURL=doctor.js.map