import path from 'path';
import os from 'os';

export const SIGMA_VERSION = '0.10.0';
// 1.1.0 — RATIFIED rename (Director directive 2026-08-12): DIR-INTENT
// intent.state "LOCKED" → "RATIFIED", intent.locked_at → intent.ratified_at.
// A chain written by an older binary still reads fine (readChain()
// normalizes it); the bump matters for the other direction — an older
// binary reading a chain already written with "RATIFIED" would otherwise
// silently treat the intent as not-locked instead of surfacing a clear
// INVALID (schema-too-new) marker. See isNewerSchema().
export const SCHEMA_VERSION = '1.1.0';

export const GLOBAL_SIGMA_DIR = path.join(os.homedir(), '.sigma');
export const GLOBAL_TEMPLATES_DIR = path.join(GLOBAL_SIGMA_DIR, 'templates');
export const GLOBAL_RULES_DIR = path.join(GLOBAL_SIGMA_DIR, 'rules');
export const GLOBAL_GOVERNANCE_DIR = path.join(GLOBAL_SIGMA_DIR, 'governance');
export const GLOBAL_BRIDGE_DIR = path.join(GLOBAL_SIGMA_DIR, 'bridge');
export const GLOBAL_CONFIG_FILE = path.join(GLOBAL_SIGMA_DIR, 'sigma.config.json');
// PLAN-IMPL-NOTION-REMOTE-GOVERNANCE-INTEGRATION-V2 D-01 — Notion tokens are
// per-machine secrets, never project-local. Keyed by project_id inside this
// file so one machine can hold credentials for multiple Sigma projects.
// Never referenced from any path under a project root, and never written to
// anything git can see.
export const GLOBAL_NOTION_CREDENTIALS_FILE = path.join(GLOBAL_SIGMA_DIR, 'notion.credentials.json');

export const PROJECT_SIGMA_DIR = 'Sigma';
// Root-level (sibling to Sigma/), not inside it — so identity survives even if Sigma/ itself is corrupted.
export const PROJECT_IDENTITY_FILE = '.sigma-identity.json';
// D-03 — written only after a confirmed-successful Notion push that purges
// Sigma/ locally. Root-level, same reasoning as PROJECT_IDENTITY_FILE: must
// survive the purge it documents. Deliberately NOT an anchor for the shared
// findProjectRoot() — see notionService.ts's own resolver.
export const PROJECT_REMOTE_STATE_FILE = '.sigma-remote-state.json';

// Bridge stub filenames — AI tool instruction files written at project root.
export const BRIDGE_STUBS = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md', 'DEEPSEEK.md', 'REASONIX.md'];
// PLAN-EVAL-01 Fase 5 — the manifest findProjectRoot() anchors on. Written by
// `sigma project start`/`--reinit` (active_chain: null) and by `sigma intent
// new` (first real chain activation).
export const ACTIVATE_STATUS_FILE = path.join(PROJECT_SIGMA_DIR, 'activate_status.json');
export const OVERRIDES_FILE = path.join(PROJECT_SIGMA_DIR, 'memory', 'overrides.jsonl');
export const OPERATIONS_LOG_FILE = path.join(PROJECT_SIGMA_DIR, 'logs', 'operations.jsonl');
// Amendment mechanism (Discussion 2026-08-11_0115 §3 item 4) — append-only audit
// trail for `sigma intent amendment`, mirroring operations.jsonl's role: never
// itself the render source (chain.intent.amendments[] is), just a durable log.
export const INTENT_AMENDMENT_LOG_FILE = path.join(PROJECT_SIGMA_DIR, 'logs', 'intent_amendment.log');
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
