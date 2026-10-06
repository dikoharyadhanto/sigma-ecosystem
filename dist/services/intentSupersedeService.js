"use strict";
// Stage F (W2 batch, continued) — the use-case shared by `sigma intent
// supersede` (CLI) and sigma_commit_intent_supersede's mutate step (MCP
// control tool). Transport-agnostic: no Commander, no console.log — mirrors
// intentRatifyService.ts's split.
//
// Scope decision (2026-09-16, Director): the CLI's `--v <version>` lets a
// human target ANY chain, not just the active one — useful for a human
// cleaning up history. The MCP primitive does NOT expose this: `state_
// revision` (contract.ts's computeStateRevision()) hashes only the ACTIVE
// chain's progress-v<N>.json, so mutating a non-active chain would never
// move it — the entire prepare/commit staleness contract this batch relies
// on would silently stop protecting a cross-chain supersede. Scoping to the
// active chain keeps this operation inside the same guarantee every other
// W2 tool in this batch already depends on. The CLI keeps full cross-chain
// capability; only the MCP surface is narrower.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentSupersedeError = void 0;
exports.assertValidSupersedeReason = assertValidSupersedeReason;
exports.describeSupersedeCascadeEffects = describeSupersedeCascadeEffects;
exports.intentSupersedeTransactionFiles = intentSupersedeTransactionFiles;
exports.supersedeIntentUseCase = supersedeIntentUseCase;
const chain_1 = require("../engine/chain");
const intentHistory_1 = require("../utils/intentHistory");
class IntentSupersedeError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'IntentSupersedeError';
    }
}
exports.IntentSupersedeError = IntentSupersedeError;
const MAX_REASON_LENGTH = 2000;
function assertValidSupersedeReason(reason) {
    const trimmed = reason.trim();
    if (!trimmed) {
        throw new IntentSupersedeError('INVALID_OPERATION', '--reason cannot be empty.');
    }
    if (/[|\n\r]/.test(reason)) {
        throw new IntentSupersedeError('INVALID_OPERATION', '--reason cannot contain "|" or a newline (breaks the intent-history.md table).');
    }
    if (reason.length > MAX_REASON_LENGTH) {
        throw new IntentSupersedeError('INVALID_OPERATION', `--reason exceeds ${MAX_REASON_LENGTH} characters.`);
    }
}
function describeSupersedeCascadeEffects(chain, cascade) {
    const effects = [`intent.state: RATIFIED -> SUPERSEDED (${chain.intent.version})`];
    if (cascade.roadmap)
        effects.push(`roadmap.${cascade.roadmap.version}: ${cascade.roadmap.state} -> SUPERSEDED`);
    for (const p of cascade.plan)
        effects.push(`plan.${p.version}: ${p.state} -> SUPERSEDED`);
    for (const e of cascade.exec)
        effects.push(`exec.${e.version}: ${e.state} -> SUPERSEDED`);
    if (cascade.close)
        effects.push(`close.${cascade.close.version}: ${cascade.close.state} -> SUPERSEDED`);
    return effects;
}
function intentSupersedeTransactionFiles(projectRoot, targetChainVersion) {
    const { chainVersion } = targetChainVersion
        ? { chainVersion: targetChainVersion }
        : (0, chain_1.readActiveChain)(projectRoot);
    return [(0, chain_1.chainFilePath)(projectRoot, chainVersion), (0, intentHistory_1.intentHistoryPath)(projectRoot)];
}
/**
 * Supersedes a RATIFIED DIR-INTENT — the active chain by default, or
 * `targetChainVersion` (mirrors CLI's `--v`, human-only; see this file's
 * header for why the MCP tool never passes it). Cascades SUPERSEDED to its
 * ROADMAP/PLAN/EXEC/CLOSE. Throws IntentSupersedeError (INVALID_OPERATION)
 * for every business-rule rejection (not RATIFIED, malformed reason).
 */
function supersedeIntentUseCase(projectRoot, reason, targetChainVersion) {
    const { chainVersion, data: chain } = targetChainVersion
        ? { chainVersion: targetChainVersion, data: (0, chain_1.readChain)(projectRoot, targetChainVersion) }
        : (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    if (chain.intent.state !== 'RATIFIED') {
        throw new IntentSupersedeError('INVALID_OPERATION', `INTENT ${chain.intent.version} is in state "${chain.intent.state}"; supersede requires RATIFIED.`);
    }
    assertValidSupersedeReason(reason);
    const cascade = (0, chain_1.previewIntentSupersedeCascade)(chain);
    (0, chain_1.supersedeIntentVersion)(chain, reason);
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    (0, intentHistory_1.renderIntentHistoryFile)(projectRoot); // PLAN-EVAL-06 — trigger 3/4, same as CLI
    return { chainVersion, version: chain.intent.version, cascade };
}
//# sourceMappingURL=intentSupersedeService.js.map