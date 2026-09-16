"use strict";
// Stage B2 — sigma_intent_status. Query-plane equivalent of `sigma intent
// status` — the active chain's DIR-INTENT: version, state, ratification
// timestamp, doc-uncertified flag (edited after ratification/amendment —
// isIntentDocUncertified(), same engine function the CLI calls), and Gate 1.
// `chain.intent.file` is already project-relative in chain.ts (unlike
// SigmaDocCheckReport.file, no redaction needed).
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeIntentStatus = computeIntentStatus;
exports.registerIntentStatusTool = registerIntentStatusTool;
const zod_1 = require("zod");
const path_1 = __importDefault(require("path"));
const chain_1 = require("../../engine/chain");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
function intentDocPath(root, chain) {
    return path_1.default.join(root, chain.intent.file ?? path_1.default.join('Sigma', 'charter', `DIR-INTENT-${chain.intent.version}.md`));
}
function computeIntentStatus(root) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0) {
        return { active: false, gate_1_open: false, source: shared_1.SOURCE_ENGINE };
    }
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(root);
    const uncertified = (0, chain_1.isIntentDocUncertified)(chain, intentDocPath(root, chain));
    return {
        active: true,
        active_chain: chainVersion,
        version: chain.intent.version,
        state: chain.intent.state,
        ratified_at: chain.intent.ratified_at ?? null,
        file: chain.intent.file ?? null,
        doc_uncertified: uncertified,
        doc_uncertified_since: uncertified ? (chain.intent.effective_amendment ?? 'ratification') : null,
        gate_1_open: chain.gates.gate_1_open,
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerIntentStatusTool(server) {
    server.registerTool('sigma_intent_status', {
        title: 'Get DIR-INTENT status',
        description: 'Return the active chain\'s DIR-INTENT status — the query-plane equivalent of `sigma intent status`: ' +
            'version, state, ratification timestamp, whether the document was edited since it was last ' +
            'certified/ratified, and Gate 1. Read-only. Returns { active, active_chain, version, state, ratified_at, ' +
            'file, doc_uncertified, doc_uncertified_since, gate_1_open, source }, or { active: false, gate_1_open: ' +
            'false, source } when no chain exists yet.',
        inputSchema: {
            project_root: zod_1.z.string().optional().describe('Optional absolute path to the Sigma project root directory.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ project_root }) => (0, contract_1.respond)('sigma_intent_status', project_root, (root) => computeIntentStatus(root)));
}
//# sourceMappingURL=intentStatus.js.map