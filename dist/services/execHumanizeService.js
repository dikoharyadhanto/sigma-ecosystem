"use strict";
// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, Stage E W1 — the one
// use-case shared by `sigma exec humanize` (CLI) and `sigma_exec_humanize`
// (MCP control tool). Transport-agnostic on purpose.
//
// Kept separate from intentHumanizeService.ts/closeHumanizeService.ts — see
// that file's header for why. Here: `--v` selects an exec VERSION WITHIN
// the active chain's array (chain.exec.versions[]), not a different chain
// entirely like intent's `--v`. execEntry.human lives on the array entry,
// not on a top-level chain.exec.human.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecHumanizeError = void 0;
exports.humanizeExecTransactionFiles = humanizeExecTransactionFiles;
exports.humanizeExec = humanizeExec;
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
const controlStore_1 = require("../engine/controlStore");
class ExecHumanizeError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'ExecHumanizeError';
    }
}
exports.ExecHumanizeError = ExecHumanizeError;
function resolveExecEntry(chain, version) {
    const normalized = (0, chain_1.normalizeVersionArg)(version);
    const execEntry = normalized
        ? chain.exec.versions.find(v => v.version === normalized)
        : chain.exec.versions.find(v => v.version === chain.exec.active_version);
    if (!execEntry) {
        throw new ExecHumanizeError('INVALID_OPERATION', normalized ? `DEV-EXEC ${normalized} not found.` : 'No active DEV-EXEC found. Run: sigma exec new');
    }
    return execEntry;
}
function humanizeExecTransactionFiles(projectRoot, version) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    const execEntry = resolveExecEntry(chain, version);
    return [
        path_1.default.join(projectRoot, 'Sigma', 'human', `PLAN-EXEC-HUMAN-${execEntry.version}.md`),
        path_1.default.join(projectRoot, 'Sigma', 'human', `PLAN-EXEC-HUMAN-${execEntry.version}.fidelity.md`),
        (0, chain_1.chainFilePath)(projectRoot, chainVersion),
    ];
}
function humanizeExec(input) {
    const { projectRoot, version, force = false } = input;
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    const execEntry = resolveExecEntry(chain, version);
    if (execEntry.state !== 'LOCKED') {
        throw new ExecHumanizeError('INVALID_OPERATION', `DEV-EXEC ${execEntry.version} is in state "${execEntry.state}"; humanize requires LOCKED.\n` +
            `Run: sigma exec lock --v ${execEntry.version}`);
    }
    const planEntry = execEntry.plan_version_ref
        ? chain.plan.versions.find(v => v.version === execEntry.plan_version_ref)
        : undefined;
    if (!planEntry || planEntry.state !== 'LOCKED') {
        throw new ExecHumanizeError('INVALID_OPERATION', `DEV-EXEC ${execEntry.version}'s referenced FMN-PLAN (${execEntry.plan_version_ref ?? 'none'}) ` +
            `is not LOCKED. A plan+exec pair must both be LOCKED before humanize can run.`);
    }
    if (execEntry.human && !force) {
        throw new ExecHumanizeError('INVALID_OPERATION', `A human projection for DEV-EXEC ${execEntry.version} already exists ` +
            `(generated ${execEntry.human.generated_at}).\n` +
            'Re-running would overwrite any content already written into it. Pass --force to proceed anyway.');
    }
    const humanRelPath = (0, fs_1.toPosix)(path_1.default.join('Sigma', 'human', `PLAN-EXEC-HUMAN-${execEntry.version}.md`));
    const ledgerRelPath = (0, fs_1.toPosix)(path_1.default.join('Sigma', 'human', `PLAN-EXEC-HUMAN-${execEntry.version}.fidelity.md`));
    (0, artifacts_1.copyTemplateToArtifact)('PLAN-EXEC-HUMAN-TEMPLATE.md', path_1.default.join(projectRoot, humanRelPath));
    (0, controlStore_1.controlTestFailpoint)('exec_humanize_after_template');
    (0, artifacts_1.copyTemplateToArtifact)('HUMAN-FIDELITY-LEDGER-TEMPLATE.md', path_1.default.join(projectRoot, ledgerRelPath));
    (0, controlStore_1.controlTestFailpoint)('exec_humanize_after_ledger');
    execEntry.human = {
        version: execEntry.version,
        generated_at: new Date().toISOString(),
    };
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    (0, controlStore_1.controlTestFailpoint)('exec_humanize_after_chain');
    return { chainVersion, version: execEntry.version, planVersionRef: planEntry.version, humanRelPath, ledgerRelPath };
}
//# sourceMappingURL=execHumanizeService.js.map