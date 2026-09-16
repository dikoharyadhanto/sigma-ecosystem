"use strict";
// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, Stage E W1 — the one
// use-case shared by `sigma intent humanize` (CLI) and `sigma_intent_humanize`
// (MCP control tool). Transport-agnostic on purpose: no Commander, no
// console.log.
//
// chain.intent.human is a bookkeeping record, not a gate transition — this
// precondition ("requires RATIFIED") and the already-exists guard are both
// artifact-readiness checks, not registry gate checks (chain.gates.* is
// never read here), so both use INVALID_OPERATION, not GATE_BLOCKED.
//
// Kept separate from execHumanizeService.ts/closeHumanizeService.ts rather
// than one generic function — intent's --v selects a DIFFERENT CHAIN
// entirely (readChain(root, v) vs the active one), structurally unlike
// exec's --v (selects a version within the active chain's array) or close
// (no selector at all). Forcing one shape would hide that difference, not
// simplify it — see planDraftService.ts/execDraftService.ts precedent for
// the same reasoning applied to draft creation.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentHumanizeError = void 0;
exports.humanizeIntentTransactionFiles = humanizeIntentTransactionFiles;
exports.humanizeIntent = humanizeIntent;
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
const controlStore_1 = require("../engine/controlStore");
class IntentHumanizeError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'IntentHumanizeError';
    }
}
exports.IntentHumanizeError = IntentHumanizeError;
function resolveChain(projectRoot, version) {
    const normalized = (0, chain_1.normalizeVersionArg)(version);
    return normalized ? { chainVersion: normalized, data: (0, chain_1.readChain)(projectRoot, normalized) } : (0, chain_1.readActiveChain)(projectRoot);
}
function humanizeIntentTransactionFiles(projectRoot, version) {
    const { chainVersion, data: chain } = resolveChain(projectRoot, version);
    const v = chain.intent.version;
    return [
        path_1.default.join(projectRoot, 'Sigma', 'human', `DIR-INTENT-HUMAN-${v}.md`),
        path_1.default.join(projectRoot, 'Sigma', 'human', `DIR-INTENT-HUMAN-${v}.fidelity.md`),
        (0, chain_1.chainFilePath)(projectRoot, chainVersion),
    ];
}
function humanizeIntent(input) {
    const { projectRoot, version, force = false } = input;
    const { chainVersion, data: chain } = resolveChain(projectRoot, version);
    if (chain.intent.state !== 'RATIFIED') {
        throw new IntentHumanizeError('INVALID_OPERATION', `INTENT ${chain.intent.version} is in state "${chain.intent.state}"; humanize requires RATIFIED.\n` +
            'Run: sigma intent ratify');
    }
    if (chain.intent.human && !force) {
        throw new IntentHumanizeError('INVALID_OPERATION', `A human projection for INTENT ${chain.intent.version} already exists ` +
            `(generated ${chain.intent.human.generated_at}).\n` +
            'Re-running would overwrite any content already written into it. Pass --force to proceed anyway.');
    }
    const humanRelPath = (0, fs_1.toPosix)(path_1.default.join('Sigma', 'human', `DIR-INTENT-HUMAN-${chain.intent.version}.md`));
    const ledgerRelPath = (0, fs_1.toPosix)(path_1.default.join('Sigma', 'human', `DIR-INTENT-HUMAN-${chain.intent.version}.fidelity.md`));
    (0, artifacts_1.copyTemplateToArtifact)('DIR-INTENT-HUMAN-TEMPLATE.md', path_1.default.join(projectRoot, humanRelPath));
    (0, controlStore_1.controlTestFailpoint)('intent_humanize_after_template');
    (0, artifacts_1.copyTemplateToArtifact)('HUMAN-FIDELITY-LEDGER-TEMPLATE.md', path_1.default.join(projectRoot, ledgerRelPath));
    (0, controlStore_1.controlTestFailpoint)('intent_humanize_after_ledger');
    chain.intent.human = {
        version: chain.intent.version,
        generated_at: new Date().toISOString(),
    };
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    (0, controlStore_1.controlTestFailpoint)('intent_humanize_after_chain');
    return { chainVersion, version: chain.intent.version, humanRelPath, ledgerRelPath };
}
//# sourceMappingURL=intentHumanizeService.js.map