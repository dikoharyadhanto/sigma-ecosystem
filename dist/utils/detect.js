"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.targetPaths = targetPaths;
exports.detectTools = detectTools;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
function targetPaths() {
    const home = os_1.default.homedir();
    // opencode: XDG_CONFIG_HOME is deliberately ignored (F16 O-9) — the verified
    // layout on every platform is ~/.config/opencode.
    const opencodeConfigDir = path_1.default.join(home, '.config', 'opencode');
    return {
        claudeCommands: path_1.default.join(home, '.claude', 'commands'),
        codexSkills: path_1.default.join(home, '.codex', 'skills'),
        reasonixSkills: path_1.default.join(home, '.reasonix', 'skills'),
        reasonixConfig: path_1.default.join(home, '.reasonix', 'config.json'),
        antigravitySkills: path_1.default.join(home, '.gemini', 'config', 'skills'),
        opencodeConfigDir,
        opencodeCommands: path_1.default.join(opencodeConfigDir, 'commands'),
        opencodePlugins: path_1.default.join(opencodeConfigDir, 'plugins'),
    };
}
function detectTools() {
    const t = targetPaths();
    const home = os_1.default.homedir();
    return {
        claudeCode: fs_extra_1.default.existsSync(path_1.default.join(home, '.claude')),
        codex: fs_extra_1.default.existsSync(t.codexSkills),
        reasonix: fs_extra_1.default.existsSync(path_1.default.join(home, '.reasonix')),
        antigravity: fs_extra_1.default.existsSync(path_1.default.join(home, '.gemini')),
        opencode: fs_extra_1.default.existsSync(t.opencodeConfigDir),
    };
}
//# sourceMappingURL=detect.js.map