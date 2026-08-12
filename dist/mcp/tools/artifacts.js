"use strict";
// PLAN-IMPL-01 §3.3 — sigma_list_artifacts
//
// Read-only. Projects the ChainState artifact trackers. Deliberately returns
// counts, not the full versions[] arrays (those can be large; the full history
// is a future sigma_read_artifact concern).
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeArtifacts = computeArtifacts;
exports.registerArtifactsTool = registerArtifactsTool;
const path_1 = __importDefault(require("path"));
const chain_1 = require("../../engine/chain");
const shared_1 = require("../shared");
// Pure core (PLAN-IMPL-01 §4-A).
function computeArtifacts(root) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return (0, shared_1.noProject)();
    const { chainVersion, data } = (0, chain_1.readActiveChain)(root);
    const uncertified = !!(data.intent.file && (0, chain_1.isIntentDocUncertified)(data, path_1.default.join(root, data.intent.file)));
    return {
        active: true,
        active_chain: chainVersion,
        intent: {
            version: data.intent.version,
            state: data.intent.state,
            title: data.intent.title ?? null,
            focus: data.intent.focus ?? null,
            // Amendment mechanism (Discussion 2026-08-11_0115 §5.3)
            doc_uncertified: uncertified,
            doc_uncertified_since: uncertified ? (data.intent.effective_amendment ?? 'ratification') : null,
        },
        roadmap: data.roadmap
            ? { version: data.roadmap.version, state: data.roadmap.state }
            : null,
        plan: {
            active_version: data.plan.active_version,
            active_state: data.plan.active_state,
            versions_count: data.plan.versions.length,
            pending_count: data.plan.pending.length,
            // PLAN-IMPL-MULTIDRAFT-LOCK §8.5 (Director directive 2026-08-12) —
            // active_version is a display pointer only; an AI role must not infer
            // "the" current plan from it once concurrent DRAFTs are possible.
            // Structured so a consumer can detect ambiguity without parsing text.
            open_drafts: data.plan.versions.filter(v => v.state === 'DRAFT').map(v => v.version),
        },
        exec: {
            active_version: data.exec.active_version,
            active_state: data.exec.active_state,
            versions_count: data.exec.versions.length,
            open_drafts: data.exec.versions.filter(v => v.state === 'DRAFT').map(v => v.version),
        },
        close: data.close
            ? { version: data.close.version, state: data.close.state }
            : null,
        source: shared_1.SOURCE_ENGINE,
    };
}
const zod_1 = require("zod");
function registerArtifactsTool(server) {
    server.registerTool('sigma_list_artifacts', {
        title: 'List Sigma Artifacts',
        description: 'Return the artifact tracker summary for the active chain: intent, roadmap, plan, exec, and close, each with version and state. intent also reports doc_uncertified — true when the DIR-INTENT file has been edited since its last ratify/amendment certification. Read-only. Accepts optional project_root parameter. Returns { active, active_chain, intent, roadmap, plan, exec, close, source }.',
        inputSchema: {
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
    }, async ({ project_root }) => (0, shared_1.okText)(computeArtifacts((0, shared_1.resolveRoot)(project_root))));
}
//# sourceMappingURL=artifacts.js.map