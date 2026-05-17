"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMcpConfig = createMcpConfig;
exports.createVscodeMcpConfig = createVscodeMcpConfig;
exports.writeMcpJson = writeMcpJson;
exports.writeVscodeMcpJson = writeVscodeMcpJson;
exports.writeGeminiMcpConfig = writeGeminiMcpConfig;
exports.writeReasonixMcpConfig = writeReasonixMcpConfig;
const fs_extra_1 = __importDefault(require("fs-extra"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
function resolveMemoryFilePath(platform = process.platform, homeDir = os_1.default.homedir()) {
    const pathApi = platform === 'win32' ? path_1.default.win32 : path_1.default.posix;
    return pathApi.join(homeDir, '.sigma', 'memory_sigma.jsonl');
}
function npxCommand(packageName, platform = process.platform) {
    if (platform === 'win32') {
        return { command: 'cmd', args: ['/c', 'npx', '-y', packageName] };
    }
    return { command: 'npx', args: ['-y', packageName] };
}
function createMcpConfig(options = {}) {
    const platform = options.platform ?? process.platform;
    const homeDir = options.homeDir ?? os_1.default.homedir();
    return {
        mcpServers: {
            'sequential-thinking': npxCommand('@modelcontextprotocol/server-sequential-thinking', platform),
            'sigma-memory': {
                ...npxCommand('@modelcontextprotocol/server-memory', platform),
                env: { MEMORY_FILE_PATH: resolveMemoryFilePath(platform, homeDir) },
            },
        },
    };
}
function createVscodeMcpConfig(options = {}) {
    const base = createMcpConfig(options);
    return { servers: base.mcpServers };
}
function writeMcpJson(filePath, options = {}) {
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(filePath));
    fs_extra_1.default.writeFileSync(filePath, JSON.stringify(createMcpConfig(options), null, 2) + '\n', 'utf8');
}
function writeVscodeMcpJson(filePath, options = {}) {
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(filePath));
    fs_extra_1.default.writeFileSync(filePath, JSON.stringify(createVscodeMcpConfig(options), null, 2) + '\n', 'utf8');
}
function writeGeminiMcpConfig(options = {}) {
    const homeDir = options.homeDir ?? os_1.default.homedir();
    const settingsPath = path_1.default.join(homeDir, '.gemini', 'settings.json');
    const memoryFilePath = path_1.default.join(homeDir, '.sigma', 'memory_sigma.jsonl');
    let existing = {};
    if (fs_extra_1.default.existsSync(settingsPath)) {
        try {
            existing = fs_extra_1.default.readJsonSync(settingsPath);
        }
        catch { /* ignore parse errors; start fresh */ }
    }
    const sigmaServers = {
        'sequential-thinking': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] },
        'sigma-memory': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], env: { MEMORY_FILE_PATH: memoryFilePath } },
    };
    const existingServers = (existing.mcpServers ?? {});
    const merged = {
        ...existing,
        mcpServers: { ...existingServers, ...sigmaServers },
    };
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(settingsPath));
    fs_extra_1.default.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
}
// Merges sigma MCP servers into ~/.reasonix/config.json.
// Reasonix activates servers listed in the `mcp` array; `mcpServers` provides their full config.
// Both sections must be consistent for a server to work correctly.
function writeReasonixMcpConfig(filePath, options = {}) {
    let existing = {};
    if (fs_extra_1.default.existsSync(filePath)) {
        try {
            existing = fs_extra_1.default.readJsonSync(filePath);
        }
        catch { /* ignore parse errors; start fresh */ }
    }
    const homeDir = options.homeDir ?? os_1.default.homedir();
    const memoryFilePath = path_1.default.join(homeDir, '.sigma', 'memory_sigma.jsonl');
    const sigmaServers = {
        'sequential-thinking': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] },
        'sigma-memory': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], env: { MEMORY_FILE_PATH: memoryFilePath } },
    };
    // Rebuild mcp activation array:
    // - strip object-format entries (not valid in Reasonix mcp array)
    // - strip any `memory=...` inline shorthand that conflicts with sigma-memory
    // - ensure sigma server names are present as plain string activators
    const sigmaNames = new Set(Object.keys(sigmaServers));
    const existingMcp = Array.isArray(existing.mcp)
        ? existing.mcp.filter((e) => {
            if (typeof e !== 'string')
                return false;
            // drop inline shorthand entries that conflict with sigma-managed names
            // format: "name=command" or just "name"
            const entryName = e.split('=')[0].trim();
            return !sigmaNames.has(entryName) && entryName !== 'memory';
        })
        : [];
    const mcpArray = [...existingMcp, ...Object.keys(sigmaServers)];
    const existingServers = (existing.mcpServers ?? {});
    const merged = {
        ...existing,
        mcp: mcpArray,
        mcpServers: { ...existingServers, ...sigmaServers },
    };
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(filePath));
    fs_extra_1.default.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
}
//# sourceMappingURL=mcp.js.map