"use strict";
// PLAN-IMPL-01 §3.5 — sigma_get_orientation
//
// Read-only. Reuses buildBootstrapView (the console-free assembly extracted in
// Stage 1) so the CLI `session bootstrap` and this tool never drift. Passes
// through the raw next_valid_operations list; it does NOT classify each
// operation's authority level — that is deferred to the Layer 2 guidance
// increment.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeOrientation = computeOrientation;
exports.registerOrientationTool = registerOrientationTool;
const zod_1 = require("zod");
const path_1 = __importDefault(require("path"));
const chain_1 = require("../../engine/chain");
const mailbox_1 = require("../../engine/mailbox");
const config_1 = require("../../config");
const bootstrapView_1 = require("../../session/bootstrapView");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
const GATE_LABELS = {
    gate_1_open: 'Gate 1 (Design Complete)',
    gate_2_open: 'Gate 2 (Plan Locked)',
    gate_3_satisfied: 'Gate 3 (Build Evidence)',
};
// PLAN-IMPL-SIGMA-MEMO-OPERATIONAL-BRIEF-20260902 — mirrors the CLI's own
// split: cross-role inbox_unread excludes MEMO (same as the sigma send gate
// and sigma session bootstrap's "Role Inbox"), memo_unread is the separate
// self-addressed count (same as sigma session bootstrap's "Unread Memos").
function collectInboxUnread(projectRoot, role) {
    const unread = {};
    try {
        const index = (0, mailbox_1.readIndex)(projectRoot);
        const roles = role ? [role] : config_1.MESSAGING_ROLES;
        for (const r of roles) {
            if (!config_1.MESSAGING_ROLES.includes(r))
                continue;
            const count = (0, mailbox_1.getUnreadForRole)(index, r, { excludeMemo: true }).length;
            if (count > 0)
                unread[r] = count;
        }
    }
    catch {
        // index.json absent/unreadable — treat as no unread, same as the CLI.
    }
    return unread;
}
function collectMemoUnread(projectRoot, role) {
    const unread = {};
    try {
        const index = (0, mailbox_1.readIndex)(projectRoot);
        const roles = role ? [role] : config_1.MESSAGING_ROLES;
        for (const r of roles) {
            if (!config_1.MESSAGING_ROLES.includes(r))
                continue;
            const count = (0, mailbox_1.countUnreadMemos)(index, r);
            if (count > 0)
                unread[r] = count;
        }
    }
    catch {
        // index.json absent/unreadable — treat as no unread, same as the CLI.
    }
    return unread;
}
// Pure core (PLAN-IMPL-01 §4-A).
function computeOrientation(root, role) {
    if (!root)
        return (0, shared_1.noProject)();
    const view = (0, bootstrapView_1.buildBootstrapView)(root);
    const { chain, chainVersion, gates, nextOps } = view;
    // Blockers = gates currently BLOCKED (a locked prerequisite is missing).
    const blockers = [];
    if (chain) {
        for (const key of Object.keys(GATE_LABELS)) {
            if ((0, chain_1.getGateStatusLabel)(chain, key) === 'BLOCKED') {
                blockers.push(`${GATE_LABELS[key]} is BLOCKED`);
            }
        }
    }
    const intentDocUncertified = !!(chain?.intent.file && (0, chain_1.isIntentDocUncertified)(chain, path_1.default.join(root, chain.intent.file)));
    return {
        active: true,
        phase: chain ? chain.lifecycle_state : null,
        active_chain: chainVersion,
        gate_summary: gates,
        next_valid_operations: nextOps,
        stale_intent_warnings: chain ? (0, chain_1.getInvalidWarningLines)(chain) : [],
        blockers,
        inbox_unread: collectInboxUnread(root, role),
        memo_unread: collectMemoUnread(root, role),
        // Amendment mechanism (Discussion 2026-08-11_0115 §5.3) — true when the
        // DIR-INTENT file's bytes no longer match the last certified hash (edited
        // outside `sigma intent ratify`/`sigma intent amendment`).
        intent_doc_uncertified: intentDocUncertified,
        intent_doc_uncertified_since: intentDocUncertified ? (chain.intent.effective_amendment ?? 'ratification') : null,
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerOrientationTool(server) {
    server.registerTool('sigma_get_orientation', {
        title: 'Get Sigma Orientation',
        description: 'Return a one-shot orientation for an AI role operating Sigma: lifecycle phase, active chain, gate summary, the CLI-valid next operations, stale/invalid runtime warnings, blockers, unread cross-role inbox counts, unread self-addressed memo counts, and DIR-INTENT certification state. Read-only. Optional argument role (ARC | FMN | DEV | AUD) scopes both counts to that role. Optional project_root sets the project directory. Returns { active, phase, active_chain, gate_summary, next_valid_operations, stale_intent_warnings, blockers, inbox_unread, memo_unread, intent_doc_uncertified, intent_doc_uncertified_since, source }.',
        inputSchema: {
            role: zod_1.z
                .enum(['ARC', 'FMN', 'DEV', 'AUD'])
                .optional()
                .describe('Optional Sigma role to scope inbox unread counts to.'),
            project_root: zod_1.z
                .string()
                .optional()
                .describe('Optional absolute path to the Sigma project root directory.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ role, project_root }) => (0, contract_1.respond)('sigma_get_orientation', project_root, (root) => computeOrientation(root, role)));
}
//# sourceMappingURL=orientation.js.map