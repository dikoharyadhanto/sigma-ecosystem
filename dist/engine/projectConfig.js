"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readProjectConfig = readProjectConfig;
exports.writeProjectConfig = writeProjectConfig;
exports.createDefaultProjectConfig = createDefaultProjectConfig;
exports.resolveAutoOutdateKeep = resolveAutoOutdateKeep;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const DEFAULT_MAILBOX = {
    auto_outdate_read_keep: 5,
};
const DEFAULTS = {
    schema_version: config_1.SCHEMA_VERSION,
    document_language: 'English',
    interaction_language: 'English',
    output_document_language: 'English',
    notion: {
        enabled: false,
        clean_local: false,
    },
    notion_humanize_gate: {
        enabled: false,
    },
    mailbox: { ...DEFAULT_MAILBOX },
};
function readProjectConfig(projectRoot) {
    const filePath = path_1.default.join(projectRoot, config_1.PROJECT_CONFIG_FILE);
    if (!fs_extra_1.default.existsSync(filePath))
        return { ...DEFAULTS };
    try {
        const raw = fs_extra_1.default.readJsonSync(filePath);
        return { ...DEFAULTS, ...raw };
    }
    catch {
        return { ...DEFAULTS };
    }
}
function writeProjectConfig(projectRoot, config) {
    const filePath = path_1.default.join(projectRoot, config_1.PROJECT_CONFIG_FILE);
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(filePath));
    fs_extra_1.default.writeJsonSync(filePath, config, { spaces: 2 });
}
function createDefaultProjectConfig(lang = 'English') {
    return {
        schema_version: config_1.SCHEMA_VERSION,
        document_language: lang,
        interaction_language: lang,
        output_document_language: lang,
        notion: {
            enabled: false,
            clean_local: false,
        },
        notion_humanize_gate: {
            enabled: false,
        },
        mailbox: { ...DEFAULT_MAILBOX },
    };
}
// Resolves the auto-outdate keep-count, tolerating a missing or malformed
// `mailbox` block. An explicit 0 is honored (disables the sweep); anything
// non-numeric or negative falls back to the default.
function resolveAutoOutdateKeep(config) {
    const raw = config.mailbox?.auto_outdate_read_keep;
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
        return DEFAULT_MAILBOX.auto_outdate_read_keep;
    }
    return Math.floor(raw);
}
//# sourceMappingURL=projectConfig.js.map