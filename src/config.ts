import path from 'path';
import os from 'os';

export const SIGMA_VERSION = '0.9.0';
export const SCHEMA_VERSION = '1.0.0';

export const GLOBAL_SIGMA_DIR = path.join(os.homedir(), '.sigma');
export const GLOBAL_TEMPLATES_DIR = path.join(GLOBAL_SIGMA_DIR, 'templates');
export const GLOBAL_RULES_DIR = path.join(GLOBAL_SIGMA_DIR, 'rules');
export const GLOBAL_GOVERNANCE_DIR = path.join(GLOBAL_SIGMA_DIR, 'governance');
export const GLOBAL_BRIDGE_DIR = path.join(GLOBAL_SIGMA_DIR, 'bridge');
export const GLOBAL_CONFIG_FILE = path.join(GLOBAL_SIGMA_DIR, 'sigma.config.json');

export const PROJECT_SIGMA_DIR = 'Sigma';
// Root-level (sibling to Sigma/), not inside it — so identity survives even if Sigma/ itself is corrupted.
export const PROJECT_IDENTITY_FILE = '.sigma-identity.json';

// Bridge stub filenames — AI tool instruction files written at project root.
export const BRIDGE_STUBS = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md', 'DEEPSEEK.md', 'REASONIX.md'];
// PLAN-EVAL-01 — legacy single-file store. Nothing reads this file's content
// anymore (chain.ts/progress-v<N>.json replaced it); project.ts's `start`
// still writes it as inert legacy content only, pending PLAN-EVAL-05
// migrating `doctor --reconstruct` off it. findProjectRoot() no longer
// anchors on it — see ACTIVATE_STATUS_FILE below.
export const PROGRESS_FILE = path.join(PROJECT_SIGMA_DIR, 'progress.json');
// PLAN-EVAL-01 Fase 5 — the manifest findProjectRoot() anchors on. Written by
// `sigma project start`/`--reinit` (active_chain: null) and by `sigma intent
// new` (first real chain activation).
export const ACTIVATE_STATUS_FILE = path.join(PROJECT_SIGMA_DIR, 'activate_status.json');
export const OVERRIDES_FILE = path.join(PROJECT_SIGMA_DIR, 'memory', 'overrides.jsonl');
export const OPERATIONS_LOG_FILE = path.join(PROJECT_SIGMA_DIR, 'logs', 'operations.jsonl');
export const OPERATION_REGISTRY_FILE = path.join(PROJECT_SIGMA_DIR, 'SIGMA-OPERATION-REGISTRY.json');
export const DOCUMENT_REGISTRY_FILE = path.join(PROJECT_SIGMA_DIR, 'SIGMA-REGISTRY.json');
export const PROJECT_CONFIG_FILE = path.join(PROJECT_SIGMA_DIR, 'project.config.json');

export const SUBFOLDERS = ['design', 'build', 'close', 'rules', 'logs', 'memory', 'role-memory', 'reference'];

export const MESSAGES_DIR = path.join(PROJECT_SIGMA_DIR, 'messages');
export const MESSAGES_INDEX_FILE = path.join(MESSAGES_DIR, 'index.json');
export const MESSAGES_ATTACHMENTS_DIR = path.join(MESSAGES_DIR, 'attachments');
export const MESSAGE_SUBFOLDERS = ['ARC', 'FMN', 'DEV', 'AUD', 'DIRECTOR', 'attachments'];

export const REFERENCE_DIR = path.join(PROJECT_SIGMA_DIR, 'reference');
export const REFERENCE_LIST_FILE = path.join(REFERENCE_DIR, 'reference-list.md');
export const REFERENCE_DATA_DIR = path.join(REFERENCE_DIR, 'data');

export const VALID_ROLES = ['ARC', 'FMN', 'DEV', 'AUD', 'DIRECTOR'] as const;
export type SigmaRole = typeof VALID_ROLES[number];

// DIRECTOR is excluded from messaging — Director communicates directly, not via CLI inbox
export const MESSAGING_ROLES = ['ARC', 'FMN', 'DEV', 'AUD'] as const;
export type MessagingRole = typeof MESSAGING_ROLES[number];

export const VALID_MESSAGE_TYPES = ['NOTE', 'CHECK', 'RESPONSE', 'HANDOFF', 'QUESTION', 'RISK'] as const;
export type MessageType = typeof VALID_MESSAGE_TYPES[number];

export const VALID_ACTIONS = ['FYI', 'RESPOND', 'REVIEW', 'UNBLOCK', 'OTHER'] as const;
export type ActionRequired = typeof VALID_ACTIONS[number];
