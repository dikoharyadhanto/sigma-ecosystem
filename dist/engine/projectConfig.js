"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.langLabel = langLabel;
exports.readProjectConfig = readProjectConfig;
exports.writeProjectConfig = writeProjectConfig;
exports.createDefaultProjectConfig = createDefaultProjectConfig;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const DEFAULTS = {
    schema_version: config_1.SCHEMA_VERSION,
    document_language: 'en',
    interaction_language: 'en',
    formal_identifier_language: 'en',
};
const LANG_NAMES = {
    en: 'English',
    id: 'Bahasa Indonesia',
    fr: 'French',
    de: 'German',
    es: 'Spanish',
    pt: 'Portuguese',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
};
function langLabel(code) {
    return LANG_NAMES[code] ?? code;
}
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
function createDefaultProjectConfig(lang = 'en') {
    return {
        schema_version: config_1.SCHEMA_VERSION,
        document_language: lang,
        interaction_language: lang,
        formal_identifier_language: 'en',
    };
}
//# sourceMappingURL=projectConfig.js.map