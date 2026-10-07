"use strict";
// F05 §4.6 — `sigma intent baseline adopt`: binds the certified INTENT content
// of an already RATIFIED chain to a Git commit and a local annotated tag.
// ratify itself stays Git-independent (O-2). Must run inside the governance
// transaction, like the amendment use-case.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentBaselineError = void 0;
exports.adoptIntentBaselineTransactionFiles = adoptIntentBaselineTransactionFiles;
exports.adoptIntentBaselineUseCase = adoptIntentBaselineUseCase;
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const config_1 = require("../config");
const git = __importStar(require("../engine/gitRepo"));
const intentGit_1 = require("../engine/intentGit");
const intentAmendmentService_1 = require("./intentAmendmentService");
class IntentBaselineError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'IntentBaselineError';
    }
}
exports.IntentBaselineError = IntentBaselineError;
function adoptIntentBaselineTransactionFiles(projectRoot, targetChainVersion) {
    const chainVersion = targetChainVersion ?? (0, chain_1.readActiveChain)(projectRoot).chainVersion;
    return [(0, chain_1.chainFilePath)(projectRoot, chainVersion), path_1.default.join(projectRoot, config_1.INTENT_AMENDMENT_LOG_FILE)];
}
function adoptIntentBaselineUseCase(projectRoot, options, targetChainVersion) {
    const { chainVersion, data: chain } = targetChainVersion
        ? { chainVersion: targetChainVersion, data: (0, chain_1.readChain)(projectRoot, targetChainVersion) }
        : (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    const fail = (m) => { throw new IntentBaselineError('INVALID_OPERATION', m); };
    if (chain.intent.state !== 'RATIFIED')
        fail(`INTENT ${chain.intent.version} is in state "${chain.intent.state}"; a baseline requires RATIFIED`);
    const resolved = git.resolveCommit(projectRoot, options.commit);
    if (!resolved.ok)
        return fail(resolved.error);
    const existing = chain.intent.git_baseline;
    if (existing) {
        if (existing.commit === resolved.sha)
            return { chainVersion, baseline: existing, tagCreated: false, alreadyRecorded: true };
        return fail(`A baseline is already recorded at ${existing.commit.slice(0, 12)}; amendments advance it, adopt does not replace it`);
    }
    let located;
    try {
        located = (0, intentGit_1.locateIntentInRepo)(projectRoot, chain);
    }
    catch (e) {
        return fail(e.message);
    }
    const { repoRoot, rel, abs, bytes } = located;
    if (!git.isAncestor(projectRoot, resolved.sha, 'HEAD'))
        fail(`Commit ${resolved.sha.slice(0, 12)} is not reachable from HEAD`);
    const blob = git.blobAt(projectRoot, resolved.sha, rel);
    if (!blob)
        fail(`${rel} does not exist at ${resolved.sha.slice(0, 12)}`);
    const committedLf = git.lfSha256(blob);
    const workingLf = git.lfSha256(bytes);
    const workingSha = git.sha256Hex(bytes);
    if (committedLf !== workingLf)
        fail(`INTENT at ${resolved.sha.slice(0, 12)} differs from the working-tree file; the baseline commit must hold exactly the current content`);
    if (git.pathStatus(repoRoot, rel) !== '')
        fail(`${rel} has uncommitted changes`);
    const certifiedMatches = !!chain.intent.certified_doc_sha256 && chain.intent.certified_doc_sha256 === workingSha;
    let provenance = 'ratified_commit';
    if (!certifiedMatches) {
        if (!options.importCurrent) {
            fail(chain.intent.certified_doc_sha256
                ? 'UNCERTIFIED_EDIT: the INTENT file differs from its certified content and no Git baseline can prove the certified content. ' +
                    'Review the current content, then re-run with --import-current to adopt it as the baseline (no amendment is invented, nothing is retroactive).'
                : 'The INTENT has no certified hash. Review the current content, then re-run with --import-current to certify it as the baseline.');
        }
        (0, chain_1.certifyIntentDoc)(chain, abs);
        chain.intent.revision_provenance = 'imported_current_certification';
        provenance = 'imported_current';
    }
    const tag = (0, intentGit_1.intentTagName)(chainVersion, 'base');
    let tagCreated;
    try {
        tagCreated = (0, intentGit_1.ensureAnnotatedTag)(projectRoot, tag, resolved.sha, [
            `Sigma INTENT baseline (${provenance})`,
            `chain: ${chainVersion}`,
            `intent_revision: ${chain.intent.revision ?? 1}`,
            `doc_sha256: ${workingSha}`,
        ].join('\n')).created;
    }
    catch (e) {
        return fail(e.message);
    }
    const baseline = {
        commit: resolved.sha,
        tag,
        doc_sha256: workingSha,
        doc_sha256_lf: workingLf,
        revision: chain.intent.revision ?? 1,
        provenance,
        recorded_at: new Date().toISOString(),
    };
    chain.intent.git_baseline = baseline;
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    (0, intentAmendmentService_1.appendIntentLog)(projectRoot, { event: 'baseline', chain: chainVersion, recorded_at: baseline.recorded_at, provenance, commit: baseline.commit, tag, doc_sha256: workingSha });
    return { chainVersion, baseline, tagCreated, alreadyRecorded: false };
}
//# sourceMappingURL=intentBaselineService.js.map