"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectId = getProjectId;
exports.readGlobalNotionToken = readGlobalNotionToken;
exports.writeGlobalNotionToken = writeGlobalNotionToken;
exports.clearGlobalNotionToken = clearGlobalNotionToken;
exports.resolveNotionToken = resolveNotionToken;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
function getProjectId(projectRoot) {
    const identityPath = path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE);
    if (!fs_extra_1.default.existsSync(identityPath))
        return undefined;
    try {
        const identity = fs_extra_1.default.readJsonSync(identityPath);
        return identity.project_id;
    }
    catch {
        return undefined;
    }
}
function readCredentialsFile() {
    if (!fs_extra_1.default.existsSync(config_1.GLOBAL_NOTION_CREDENTIALS_FILE))
        return {};
    try {
        return fs_extra_1.default.readJsonSync(config_1.GLOBAL_NOTION_CREDENTIALS_FILE);
    }
    catch {
        return {};
    }
}
function readGlobalNotionToken(projectId) {
    const all = readCredentialsFile();
    return all[projectId]?.token;
}
function writeGlobalNotionToken(projectId, token) {
    const all = readCredentialsFile();
    all[projectId] = { token };
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(config_1.GLOBAL_NOTION_CREDENTIALS_FILE));
    fs_extra_1.default.writeJsonSync(config_1.GLOBAL_NOTION_CREDENTIALS_FILE, all, { spaces: 2 });
}
function clearGlobalNotionToken(projectId) {
    const all = readCredentialsFile();
    if (projectId in all) {
        delete all[projectId];
        fs_extra_1.default.writeJsonSync(config_1.GLOBAL_NOTION_CREDENTIALS_FILE, all, { spaces: 2 });
    }
}
// Resolves the token for a project: env var override first (CI/scripting),
// then the project's entry in the global per-machine credentials file.
function resolveNotionToken(projectRoot) {
    const envToken = process.env.NOTION_TOKEN;
    if (envToken)
        return envToken;
    const projectId = getProjectId(projectRoot);
    if (!projectId)
        return undefined;
    return readGlobalNotionToken(projectId);
}
//# sourceMappingURL=notionCredentials.js.map