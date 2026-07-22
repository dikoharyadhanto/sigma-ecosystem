"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_ACTIONS = exports.VALID_MESSAGE_TYPES = exports.MESSAGING_ROLES = exports.VALID_ROLES = exports.REFERENCE_DATA_DIR = exports.REFERENCE_LIST_FILE = exports.REFERENCE_DIR = exports.MESSAGE_SUBFOLDERS = exports.MESSAGES_ATTACHMENTS_DIR = exports.MESSAGES_INDEX_FILE = exports.MESSAGES_DIR = exports.SUBFOLDERS = exports.PROJECT_CONFIG_FILE = exports.DOCUMENT_REGISTRY_FILE = exports.OPERATION_REGISTRY_FILE = exports.OPERATIONS_LOG_FILE = exports.OVERRIDES_FILE = exports.ACTIVATE_STATUS_FILE = exports.BRIDGE_STUBS = exports.PROJECT_IDENTITY_FILE = exports.PROJECT_SIGMA_DIR = exports.GLOBAL_CONFIG_FILE = exports.GLOBAL_BRIDGE_DIR = exports.GLOBAL_GOVERNANCE_DIR = exports.GLOBAL_RULES_DIR = exports.GLOBAL_TEMPLATES_DIR = exports.GLOBAL_SIGMA_DIR = exports.SCHEMA_VERSION = exports.SIGMA_VERSION = void 0;
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
exports.SIGMA_VERSION = '0.10.0';
exports.SCHEMA_VERSION = '1.0.0';
exports.GLOBAL_SIGMA_DIR = path_1.default.join(os_1.default.homedir(), '.sigma');
exports.GLOBAL_TEMPLATES_DIR = path_1.default.join(exports.GLOBAL_SIGMA_DIR, 'templates');
exports.GLOBAL_RULES_DIR = path_1.default.join(exports.GLOBAL_SIGMA_DIR, 'rules');
exports.GLOBAL_GOVERNANCE_DIR = path_1.default.join(exports.GLOBAL_SIGMA_DIR, 'governance');
exports.GLOBAL_BRIDGE_DIR = path_1.default.join(exports.GLOBAL_SIGMA_DIR, 'bridge');
exports.GLOBAL_CONFIG_FILE = path_1.default.join(exports.GLOBAL_SIGMA_DIR, 'sigma.config.json');
exports.PROJECT_SIGMA_DIR = 'Sigma';
// Root-level (sibling to Sigma/), not inside it — so identity survives even if Sigma/ itself is corrupted.
exports.PROJECT_IDENTITY_FILE = '.sigma-identity.json';
// Bridge stub filenames — AI tool instruction files written at project root.
exports.BRIDGE_STUBS = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md', 'DEEPSEEK.md', 'REASONIX.md'];
// PLAN-EVAL-01 Fase 5 — the manifest findProjectRoot() anchors on. Written by
// `sigma project start`/`--reinit` (active_chain: null) and by `sigma intent
// new` (first real chain activation).
exports.ACTIVATE_STATUS_FILE = path_1.default.join(exports.PROJECT_SIGMA_DIR, 'activate_status.json');
exports.OVERRIDES_FILE = path_1.default.join(exports.PROJECT_SIGMA_DIR, 'memory', 'overrides.jsonl');
exports.OPERATIONS_LOG_FILE = path_1.default.join(exports.PROJECT_SIGMA_DIR, 'logs', 'operations.jsonl');
exports.OPERATION_REGISTRY_FILE = path_1.default.join(exports.PROJECT_SIGMA_DIR, 'SIGMA-OPERATION-REGISTRY.json');
exports.DOCUMENT_REGISTRY_FILE = path_1.default.join(exports.PROJECT_SIGMA_DIR, 'SIGMA-REGISTRY.json');
exports.PROJECT_CONFIG_FILE = path_1.default.join(exports.PROJECT_SIGMA_DIR, 'project.config.json');
exports.SUBFOLDERS = ['design', 'build', 'close', 'rules', 'logs', 'memory', 'role-memory', 'reference'];
exports.MESSAGES_DIR = path_1.default.join(exports.PROJECT_SIGMA_DIR, 'messages');
exports.MESSAGES_INDEX_FILE = path_1.default.join(exports.MESSAGES_DIR, 'index.json');
exports.MESSAGES_ATTACHMENTS_DIR = path_1.default.join(exports.MESSAGES_DIR, 'attachments');
exports.MESSAGE_SUBFOLDERS = ['ARC', 'FMN', 'DEV', 'AUD', 'DIRECTOR', 'attachments'];
exports.REFERENCE_DIR = path_1.default.join(exports.PROJECT_SIGMA_DIR, 'reference');
exports.REFERENCE_LIST_FILE = path_1.default.join(exports.REFERENCE_DIR, 'reference-list.md');
exports.REFERENCE_DATA_DIR = path_1.default.join(exports.REFERENCE_DIR, 'data');
exports.VALID_ROLES = ['ARC', 'FMN', 'DEV', 'AUD', 'DIRECTOR'];
// DIRECTOR is excluded from messaging — Director communicates directly, not via CLI inbox
exports.MESSAGING_ROLES = ['ARC', 'FMN', 'DEV', 'AUD'];
exports.VALID_MESSAGE_TYPES = ['NOTE', 'CHECK', 'RESPONSE', 'HANDOFF', 'QUESTION', 'RISK'];
exports.VALID_ACTIONS = ['FYI', 'RESPOND', 'REVIEW', 'UNBLOCK', 'OTHER'];
//# sourceMappingURL=config.js.map