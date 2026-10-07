"use strict";
// PLAN-IMPL-01 Stage 1 — console-free assembly of the data that
// `sigma session bootstrap` prints. Extracted from runBootstrap so that both
// the CLI printer (src/commands/session.ts) and the MCP orientation tool
// (src/mcp/tools/*) consume the same source without any console output.
//
// HARD CONSTRAINT: nothing in this file may write to stdout/stderr. The MCP
// stdio transport reserves stdout for JSON-RPC frames; any console.log reached
// from an MCP tool corrupts the stream. This function only reads.
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBootstrapView = buildBootstrapView;
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const numbering_1 = require("../engine/numbering");
// Pure reads only — mirrors the data-gathering prologue of runBootstrap.
// A fresh project (before the first `intent new`) has no chain yet; that is a
// valid state, represented as chain: null / chainVersion: null, matching the
// CLI's graceful "none" display.
function buildBootstrapView(projectRoot = (0, fs_1.findProjectRoot)()) {
    const identity = (0, chain_1.readProjectIdentity)(projectRoot);
    const hasChain = (0, chain_1.listChainVersions)(projectRoot).length > 0;
    const { chainVersion, data: chain } = hasChain
        ? (0, chain_1.readActiveChain)(projectRoot)
        : { chainVersion: null, data: null };
    const gates = chain ? (0, chain_1.getGateStatus)(chain) : null;
    const nextOps = chain ? (0, chain_1.getNextValidOperations)(chain) : ['intent new'];
    const numbering = chain ? {
        scheme: (0, numbering_1.resolveVersioningScheme)(chain), intent_version: chain.intent.version,
        plan_major: (0, numbering_1.planMajorForChain)(chain), source: chain.versioning_scheme === undefined ? 'legacy_fallback' : 'chain',
    } : null;
    const compatibilityWarnings = numbering?.scheme === 'legacy_offset' ? [
        `[KOMPATIBILITAS] INTENT ${numbering.intent_version} memakai penomoran lama: PLAN/EXEC v${numbering.plan_major}.x (major PLAN = major INTENT - 1). Pola ini dipertahankan untuk kompatibilitas chain lama. Gunakan pola tersebut selama bekerja pada chain ini.`,
    ] : [];
    return { projectRoot, identity, chainVersion, chain, gates, nextOps, numbering, compatibilityWarnings };
}
//# sourceMappingURL=bootstrapView.js.map