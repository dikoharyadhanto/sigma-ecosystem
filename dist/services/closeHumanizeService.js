"use strict";
// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, Stage E W1 — the one
// use-case shared by `sigma close humanize` (CLI) and `sigma_close_humanize`
// (MCP control tool). Transport-agnostic on purpose.
//
// Kept separate from intentHumanizeService.ts/execHumanizeService.ts — see
// intentHumanizeService.ts's header for why. Here: chain.close is a single
// object (SingleCloseState | null), like chain.intent — but with no `--v`
// selector at all (the CLI command never had one; always the active
// chain's own close).
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseHumanizeError = void 0;
exports.humanizeCloseTransactionFiles = humanizeCloseTransactionFiles;
exports.humanizeClose = humanizeClose;
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
const controlStore_1 = require("../engine/controlStore");
class CloseHumanizeError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'CloseHumanizeError';
    }
}
exports.CloseHumanizeError = CloseHumanizeError;
function humanizeCloseTransactionFiles(projectRoot) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    if (!chain.close) {
        throw new CloseHumanizeError('INVALID_OPERATION', 'No active DIR-CLOSE found. Run: sigma close new');
    }
    const v = chain.close.version;
    return [
        path_1.default.join(projectRoot, 'Sigma', 'human', `DIR-CLOSE-HUMAN-${v}.md`),
        path_1.default.join(projectRoot, 'Sigma', 'human', `DIR-CLOSE-HUMAN-${v}.fidelity.md`),
        (0, chain_1.chainFilePath)(projectRoot, chainVersion),
    ];
}
function humanizeClose(input) {
    const { projectRoot, force = false } = input;
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    if (!chain.close) {
        throw new CloseHumanizeError('INVALID_OPERATION', 'No active DIR-CLOSE found. Run: sigma close new');
    }
    if (chain.close.state !== 'LOCKED') {
        throw new CloseHumanizeError('INVALID_OPERATION', `DIR-CLOSE ${chain.close.version} is in state "${chain.close.state}"; humanize requires LOCKED.\n` +
            'Run: sigma close lock');
    }
    if (chain.close.human && !force) {
        throw new CloseHumanizeError('INVALID_OPERATION', `A human projection for DIR-CLOSE ${chain.close.version} already exists ` +
            `(generated ${chain.close.human.generated_at}).\n` +
            'Re-running would overwrite any content already written into it. Pass --force to proceed anyway.');
    }
    const humanRelPath = (0, fs_1.toPosix)(path_1.default.join('Sigma', 'human', `DIR-CLOSE-HUMAN-${chain.close.version}.md`));
    const ledgerRelPath = (0, fs_1.toPosix)(path_1.default.join('Sigma', 'human', `DIR-CLOSE-HUMAN-${chain.close.version}.fidelity.md`));
    (0, artifacts_1.copyTemplateToArtifact)('DIR-CLOSE-HUMAN-TEMPLATE.md', path_1.default.join(projectRoot, humanRelPath));
    (0, controlStore_1.controlTestFailpoint)('close_humanize_after_template');
    (0, artifacts_1.copyTemplateToArtifact)('HUMAN-FIDELITY-LEDGER-TEMPLATE.md', path_1.default.join(projectRoot, ledgerRelPath));
    (0, controlStore_1.controlTestFailpoint)('close_humanize_after_ledger');
    chain.close.human = {
        version: chain.close.version,
        generated_at: new Date().toISOString(),
    };
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    (0, controlStore_1.controlTestFailpoint)('close_humanize_after_chain');
    return { chainVersion, version: chain.close.version, humanRelPath, ledgerRelPath };
}
//# sourceMappingURL=closeHumanizeService.js.map