"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTemplate = resolveTemplate;
exports.copyTemplateToArtifact = copyTemplateToArtifact;
exports.appendAuditFindings = appendAuditFindings;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const PACKAGE_ROOT = path_1.default.resolve(__dirname, '..', '..');
const BUNDLE_TEMPLATES = path_1.default.join(PACKAGE_ROOT, 'Sigma', 'templates');
function resolveTemplate(name) {
    const global = path_1.default.join(config_1.GLOBAL_TEMPLATES_DIR, name);
    if (fs_extra_1.default.existsSync(global))
        return global;
    const bundle = path_1.default.join(BUNDLE_TEMPLATES, name);
    if (fs_extra_1.default.existsSync(bundle))
        return bundle;
    throw new Error('Template not found. Run: sigma setup install');
}
function copyTemplateToArtifact(templateName, absPath) {
    const templatePath = resolveTemplate(templateName);
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(absPath));
    fs_extra_1.default.copySync(templatePath, absPath);
}
function appendAuditFindings(absPath, domain, action) {
    const now = new Date().toISOString();
    const section = `\n---\n\n## AUD Advisory Findings\n\n*Appended: ${now}*\n*Operation: sigma ${domain} ${action}*\n*Status: ADVISORY ONLY — does not change runtime state*\n\n**Audit Scope**: [AUD fills this]\n\n**Findings**:\n\n[AUD fills this]\n\n**Recommendation**: [AUD fills this]\n`;
    fs_extra_1.default.appendFileSync(absPath, section);
}
//# sourceMappingURL=artifacts.js.map