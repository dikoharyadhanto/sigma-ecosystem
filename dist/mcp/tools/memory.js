"use strict";
// PLAN-IMPL-01 — sigma_get_memory
//
// Read-only. Wraps loadRoleMemory from the engine so AI agents can retrieve
// role memory reminders via MCP without shelling out to `sigma memory --<role>`.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeMemory = computeMemory;
exports.registerMemoryTool = registerMemoryTool;
const zod_1 = require("zod");
const roleMemory_1 = require("../../engine/roleMemory");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
function computeMemory(root, role) {
    try {
        const { memory, sourcePath } = (0, roleMemory_1.loadRoleMemory)(role, root ?? undefined);
        // §8.1 — on a verified binding source_path becomes project-relative and
        // gains a fingerprint; on an unverified one it stays the absolute path the
        // pre-Stage-A clients already receive. Redaction follows binding state, not
        // binary version, so no installed client changes behaviour on its own.
        const binding = (0, shared_1.getBinding)();
        return {
            active: true,
            role: memory.role,
            authority: memory.authority,
            source_rule: memory.source_rule,
            source_rule_version: memory.source_rule_version,
            memory_updated_at: memory.memory_updated_at,
            general: memory.general,
            role_specific: memory.role_specific,
            source_path: (0, contract_1.redactPath)(binding, sourcePath),
            source_path_fingerprint: binding.verified ? (0, contract_1.pathFingerprint)(sourcePath) : null,
            source: shared_1.SOURCE_ENGINE,
        };
    }
    catch {
        // Reviewer finding R-06: this used to put the raw engine message into a
        // *success* payload, which never reaches respond()'s anonymisation. A
        // corrupt memory file therefore returned
        // "Failed to parse role memory file at C:\Users\...\fmn-memory.json" to
        // the model, on a verified binding, host path and all.
        //
        // The message is dropped, not forwarded. The role and a stable code are
        // enough for a consumer to act; the detail belongs in the operator's
        // terminal, not in a model's context.
        return {
            active: false,
            role,
            error: { code: contract_1.ERROR_CODES.INTERNAL_ERROR, message: 'Role memory for this role could not be read.' },
            source: shared_1.SOURCE_ENGINE,
        };
    }
}
function registerMemoryTool(server) {
    server.registerTool('sigma_get_memory', {
        title: 'Get Sigma Role Memory',
        description: 'Return role memory reminders for a specific Sigma governance role (ARC, FMN, DEV, or AUD). Read-only; wraps the same engine code path as `sigma memory --<role>`. Accepts required role parameter and optional project_root. Returns { active: true, role, authority, source_rule, source_rule_version, memory_updated_at, general, role_specific, source_path, source } or { active: false, error, source } on error.',
        inputSchema: {
            role: zod_1.z
                .enum(roleMemory_1.ROLE_MEMORY_ROLES)
                .describe('Governance role to retrieve memory for: ARC, FMN, DEV, or AUD.'),
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
    }, async ({ role, project_root }) => (0, contract_1.respond)('sigma_get_memory', project_root, (root) => computeMemory(root, role)));
}
//# sourceMappingURL=memory.js.map