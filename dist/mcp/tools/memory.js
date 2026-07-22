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
function computeMemory(root, role) {
    try {
        const { memory, sourcePath } = (0, roleMemory_1.loadRoleMemory)(role, root ?? undefined);
        return {
            active: true,
            role: memory.role,
            authority: memory.authority,
            source_rule: memory.source_rule,
            source_rule_version: memory.source_rule_version,
            memory_updated_at: memory.memory_updated_at,
            general: memory.general,
            role_specific: memory.role_specific,
            source_path: sourcePath,
            source: shared_1.SOURCE_ENGINE,
        };
    }
    catch (err) {
        return {
            active: false,
            error: err.message,
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
    }, async ({ role, project_root }) => (0, shared_1.okText)(computeMemory((0, shared_1.resolveRoot)(project_root), role)));
}
//# sourceMappingURL=memory.js.map