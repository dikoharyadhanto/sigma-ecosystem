"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_MEMORY_ROLES = void 0;
exports.getBundledRoleMemoryDir = getBundledRoleMemoryDir;
exports.getRoleMemoryFilename = getRoleMemoryFilename;
exports.getLocalRoleMemoryPath = getLocalRoleMemoryPath;
exports.getBundledRoleMemoryPath = getBundledRoleMemoryPath;
exports.loadRoleMemory = loadRoleMemory;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
exports.ROLE_MEMORY_ROLES = ['ARC', 'FMN', 'DEV', 'AUD'];
const PACKAGE_ROOT = path_1.default.resolve(__dirname, '..', '..');
const BUNDLED_ROLE_MEMORY_DIR = path_1.default.join(PACKAGE_ROOT, 'Sigma', 'role-memory');
function getBundledRoleMemoryDir() {
    return BUNDLED_ROLE_MEMORY_DIR;
}
function getRoleMemoryFilename(role) {
    return `${role.toLowerCase()}-memory.json`;
}
function getLocalRoleMemoryPath(projectRoot, role) {
    return path_1.default.join(projectRoot, 'Sigma', 'role-memory', getRoleMemoryFilename(role));
}
function getBundledRoleMemoryPath(role) {
    return path_1.default.join(BUNDLED_ROLE_MEMORY_DIR, getRoleMemoryFilename(role));
}
function loadRoleMemory(role, projectRoot) {
    const candidates = [
        projectRoot ? getLocalRoleMemoryPath(projectRoot, role) : null,
        getBundledRoleMemoryPath(role),
    ].filter((value) => Boolean(value));
    for (const candidate of candidates) {
        if (!fs_extra_1.default.existsSync(candidate))
            continue;
        try {
            const memory = fs_extra_1.default.readJsonSync(candidate);
            return { memory, sourcePath: candidate };
        }
        catch {
            throw new Error(`Failed to parse role memory file at ${candidate}`);
        }
    }
    throw new Error(`Role memory for ${role} not found. Expected local Sigma/role-memory/${getRoleMemoryFilename(role)} ` +
        `or bundled package memory at ${getBundledRoleMemoryPath(role)}.`);
}
//# sourceMappingURL=roleMemory.js.map