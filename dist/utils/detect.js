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
    return {
        claudeCommands: path_1.default.join(home, '.claude', 'commands'),
        codexSkills: path_1.default.join(home, '.codex', 'skills'),
        reasonixSkills: path_1.default.join(home, '.reasonix', 'skills'),
        reasonixConfig: path_1.default.join(home, '.reasonix', 'config.json'),
        antigravityAgents: path_1.default.join(home, '.gemini', 'agents'),
    };
}
function detectTools() {
    const t = targetPaths();
    return {
        claudeCode: fs_extra_1.default.existsSync(t.claudeCommands),
        codex: fs_extra_1.default.existsSync(t.codexSkills),
        reasonix: fs_extra_1.default.existsSync(t.reasonixSkills),
        antigravity: fs_extra_1.default.existsSync(t.antigravityAgents),
    };
}
//# sourceMappingURL=detect.js.map