"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_ACTIONS = exports.VALID_MESSAGE_TYPES = exports.MESSAGING_ROLES = exports.VALID_ROLES = exports.REFERENCE_DATA_DIR = exports.REFERENCE_LIST_FILE = exports.REFERENCE_DIR = exports.MESSAGE_SUBFOLDERS = exports.MESSAGES_ATTACHMENTS_DIR = exports.MESSAGES_INDEX_FILE = exports.MESSAGES_DIR = exports.SUBFOLDERS = exports.PROJECT_CONFIG_FILE = exports.DOCUMENT_REGISTRY_FILE = exports.OPERATION_REGISTRY_FILE = exports.INTENT_AMENDMENT_LOG_FILE = exports.OPERATIONS_LOG_FILE = exports.OVERRIDES_FILE = exports.ACTIVATE_STATUS_FILE = exports.BRIDGE_STUBS = exports.PROJECT_REMOTE_STATE_FILE = exports.PROJECT_IDENTITY_FILE = exports.PROJECT_SIGMA_DIR = exports.GLOBAL_NOTION_CREDENTIALS_FILE = exports.GLOBAL_CONFIG_FILE = exports.GLOBAL_BRIDGE_DIR = exports.GLOBAL_GOVERNANCE_DIR = exports.GLOBAL_RULES_DIR = exports.GLOBAL_TEMPLATES_DIR = exports.GLOBAL_SIGMA_DIR = exports.SCHEMA_VERSION = exports.SIGMA_VERSION = void 0;
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
exports.SIGMA_VERSION = '0.10.0';
// 1.1.0 — RATIFIED rename (Director directive 2026-08-12): DIR-INTENT
// intent.state "LOCKED" → "RATIFIED", intent.locked_at → intent.ratified_at.
// A chain written by an older binary still reads fine (readChain()
// normalizes it); the bump matters for the other direction — an older
// binary reading a chain already written with "RATIFIED" would otherwise
// silently treat the intent as not-locked instead of surfacing a clear
// INVALID (schema-too-new) marker. See isNewerSchema().
// 1.2.0 — PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §4 Fase 2: adds optional
// `human` (HumanArtifactState) to SingleIntentState, ArtifactVersion, and
// SingleCloseState. Purely additive — an older binary reading a chain
// written with this field simply doesn't see it, no INVALID risk in that
// direction. Bumped anyway to follow the established convention (this
// constant also stamps project.config.json/.sigma-identity.json, which
// didn't change shape — see chain.ts's own note on that coupling).
exports.SCHEMA_VERSION = '1.2.0';
exports.GLOBAL_SIGMA_DIR = path_1.default.join(os_1.default.homedir(), '.sigma');
exports.GLOBAL_TEMPLATES_DIR = path_1.default.join(exports.GLOBAL_SIGMA_DIR, 'templates');
exports.GLOBAL_RULES_DIR = path_1.default.join(exports.GLOBAL_SIGMA_DIR, 'rules');
exports.GLOBAL_GOVERNANCE_DIR = path_1.default.join(exports.GLOBAL_SIGMA_DIR, 'governance');
exports.GLOBAL_BRIDGE_DIR = path_1.default.join(exports.GLOBAL_SIGMA_DIR, 'bridge');
exports.GLOBAL_CONFIG_FILE = path_1.default.join(exports.GLOBAL_SIGMA_DIR, 'sigma.config.json');
// PLAN-IMPL-NOTION-REMOTE-GOVERNANCE-INTEGRATION-V2 D-01 — Notion tokens are
// per-machine secrets, never project-local. Keyed by project_id inside this
// file so one machine can hold credentials for multiple Sigma projects.
// Never referenced from any path under a project root, and never written to
// anything git can see.
exports.GLOBAL_NOTION_CREDENTIALS_FILE = path_1.default.join(exports.GLOBAL_SIGMA_DIR, 'notion.credentials.json');
exports.PROJECT_SIGMA_DIR = 'Sigma';
// Root-level (sibling to Sigma/), not inside it — so identity survives even if Sigma/ itself is corrupted.
exports.PROJECT_IDENTITY_FILE = '.sigma-identity.json';
// D-03 — written only after a confirmed-successful Notion push that purges
// Sigma/ locally. Root-level, same reasoning as PROJECT_IDENTITY_FILE: must
// survive the purge it documents. Deliberately NOT an anchor for the shared
// findProjectRoot() — see notionService.ts's own resolver.
exports.PROJECT_REMOTE_STATE_FILE = '.sigma-remote-state.json';
// Bridge stub filenames — AI tool instruction files written at project root.
exports.BRIDGE_STUBS = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md', 'DEEPSEEK.md', 'REASONIX.md'];
// PLAN-EVAL-01 Fase 5 — the manifest findProjectRoot() anchors on. Written by
// `sigma project start`/`--reinit` (active_chain: null) and by `sigma intent
// new` (first real chain activation).
exports.ACTIVATE_STATUS_FILE = path_1.default.join(exports.PROJECT_SIGMA_DIR, 'activate_status.json');
exports.OVERRIDES_FILE = path_1.default.join(exports.PROJECT_SIGMA_DIR, 'memory', 'overrides.jsonl');
exports.OPERATIONS_LOG_FILE = path_1.default.join(exports.PROJECT_SIGMA_DIR, 'logs', 'operations.jsonl');
// Amendment mechanism (Discussion 2026-08-11_0115 §3 item 4) — append-only audit
// trail for `sigma intent amendment`, mirroring operations.jsonl's role: never
// itself the render source (chain.intent.amendments[] is), just a durable log.
exports.INTENT_AMENDMENT_LOG_FILE = path_1.default.join(exports.PROJECT_SIGMA_DIR, 'logs', 'intent_amendment.log');
exports.OPERATION_REGISTRY_FILE = path_1.default.join(exports.PROJECT_SIGMA_DIR, 'SIGMA-OPERATION-REGISTRY.json');
exports.DOCUMENT_REGISTRY_FILE = path_1.default.join(exports.PROJECT_SIGMA_DIR, 'SIGMA-REGISTRY.json');
exports.PROJECT_CONFIG_FILE = path_1.default.join(exports.PROJECT_SIGMA_DIR, 'project.config.json');
// PLAN-IMPL-SIGMA-ARTIFACT-FOLDER-RENAME-20260816 §2.1/§3.1 — design/build
// renamed and split: design -> charter (DIR-INTENT), build -> contract
// (FMN-PLAN) + roadmap (ROADMAP) + evidence (DEV-EXEC). close/rules/logs/
// memory/role-memory/reference unchanged (§3.2 — out of scope). human/notes
// are new (Sigma Humanize Operation's *-HUMAN docs and free-form notes).
// New projects only (§2.2) — a chain's stored entry.file always wins over
// any folder-name-derived fallback (see findProjectRoot()'s callers in
// intent.ts/plan.ts/exec.ts/roadmap.ts), so existing projects created under
// the old names are unaffected without migration.
exports.SUBFOLDERS = ['charter', 'contract', 'roadmap', 'evidence', 'close', 'human', 'notes', 'rules', 'logs', 'memory', 'role-memory', 'reference'];
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