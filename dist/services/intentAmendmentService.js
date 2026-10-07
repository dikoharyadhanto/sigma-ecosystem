"use strict";
// Stage F (W2 batch) — the use-case shared by `sigma intent amendment` (CLI)
// and sigma_commit_intent_amendment's mutate step (MCP control tool).
// Transport-agnostic: no Commander, no console.log — mirrors
// intentRatifyService.ts's split (src/commands/intent.ts keeps printing).
//
// F05 — Git-based amendment (option B of F05 §4.3): the Director approves the
// reviewed content, the content is committed, and this use-case is the single
// effective point. It verifies the result commit, creates the annotated tag,
// and only then writes the chain. The INTENT document is never written here:
// the bytes reviewed, committed and certified are the same bytes.
//
// Two phases because MCP control mutations have a short lease-safety budget
// (CONTROL_MUTATION_MAX_MS) that spawning Git cannot meet:
//   1. verifyAndTagAmendment — every Git call (verification, diff stat, tag).
//      The MCP tool runs it in checkPreconditions, still under the project lock.
//   2. applyVerifiedAmendment — chain mutation, certification and log only.
// recordIntentAmendmentUseCase runs both for the CLI.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentAmendmentError = void 0;
exports.intentAmendmentTransactionFiles = intentAmendmentTransactionFiles;
exports.appendIntentLog = appendIntentLog;
exports.verifyAndTagAmendment = verifyAndTagAmendment;
exports.applyVerifiedAmendment = applyVerifiedAmendment;
exports.recordIntentAmendmentUseCase = recordIntentAmendmentUseCase;
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const chain_1 = require("../engine/chain");
const config_1 = require("../config");
const gitRepo_1 = require("../engine/gitRepo");
const intentGit_1 = require("../engine/intentGit");
class IntentAmendmentError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'IntentAmendmentError';
    }
}
exports.IntentAmendmentError = IntentAmendmentError;
function intentAmendmentTransactionFiles(projectRoot, targetChainVersion) {
    const chainVersion = targetChainVersion ?? (0, chain_1.readActiveChain)(projectRoot).chainVersion;
    return [(0, chain_1.chainFilePath)(projectRoot, chainVersion), path_1.default.join(projectRoot, config_1.INTENT_AMENDMENT_LOG_FILE)];
}
function appendIntentLog(projectRoot, record) {
    const logPath = path_1.default.join(projectRoot, config_1.INTENT_AMENDMENT_LOG_FILE);
    fs_extra_1.default.ensureFileSync(logPath);
    fs_extra_1.default.appendFileSync(logPath, JSON.stringify(record) + '\n');
}
function loadChain(projectRoot, targetChainVersion) {
    return targetChainVersion
        ? { chainVersion: targetChainVersion, data: (0, chain_1.readChain)(projectRoot, targetChainVersion) }
        : (0, chain_1.readActiveChain)(projectRoot);
}
/**
 * Phase 1 — every Git step. Throws IntentAmendmentError (INVALID_OPERATION) for each
 * business-rule rejection (not RATIFIED, empty/malformed --change, any unfinished Git
 * step) so the caller gets an actionable message. The tag is created last, after all
 * verification; a rerun adopts a tag left by an interrupted attempt (same commit only)
 * and a tag on any other commit is never moved or overwritten.
 */
function verifyAndTagAmendment(projectRoot, request, targetChainVersion) {
    const { chainVersion, data: chain } = loadChain(projectRoot, targetChainVersion);
    (0, chain_1.assertChainCanMutate)(chain);
    if (chain.intent.state !== 'RATIFIED') {
        throw new IntentAmendmentError('INVALID_OPERATION', `INTENT ${chain.intent.version} is in state "${chain.intent.state}"; amendment requires RATIFIED`);
    }
    if (typeof request.purposeChanged !== 'boolean') {
        throw new IntentAmendmentError('INVALID_OPERATION', 'purpose_changed must be declared explicitly (yes or no).');
    }
    // Validate the summary before any Git step so a bad --change never leaves a tag behind.
    if (!request.change.trim())
        throw new IntentAmendmentError('INVALID_OPERATION', '--change cannot be empty');
    if (/[|\n\r]/.test(request.change)) {
        throw new IntentAmendmentError('INVALID_OPERATION', '--change cannot contain "|" or a newline (single-line amendment summary)');
    }
    let verified;
    try {
        verified = (0, intentGit_1.verifyResultCommit)(projectRoot, chainVersion, chain, request.commit, request.docSha256);
    }
    catch (e) {
        throw new IntentAmendmentError('INVALID_OPERATION', e.message);
    }
    const baseline = chain.intent.git_baseline;
    const amendmentId = (0, intentGit_1.nextAmendmentIdOf)(chain);
    const tag = (0, intentGit_1.intentTagName)(chainVersion, amendmentId);
    const diffStat = (0, gitRepo_1.diffAgainstWorktree)(verified.repo_root, baseline.commit, verified.repo_path).stat;
    const message = [
        `Sigma INTENT amendment ${amendmentId}`,
        `chain: ${chainVersion}`,
        `intent_revision: ${(chain.intent.revision ?? 0) + 1}`,
        `doc_sha256: ${verified.working_sha256}`,
        `baseline_commit: ${baseline.commit}`,
        `purpose_changed: ${request.purposeChanged ? 'yes' : 'no'}`,
        `change: ${request.change.trim()}`,
    ].join('\n');
    let tagCreated;
    try {
        // Order matters (F05 §4.3): tag first, chain second. A chain that claims
        // completion without its tag is never written.
        tagCreated = (0, intentGit_1.ensureAnnotatedTag)(projectRoot, tag, verified.commit, message).created;
    }
    catch (e) {
        throw new IntentAmendmentError('INVALID_OPERATION', e.message);
    }
    return { chainVersion, verified, tag, tagCreated, diffStat, amendmentId };
}
/** Phase 2 — no Git subprocess: records the entry, certifies the file bytes, writes chain and log. */
function applyVerifiedAmendment(projectRoot, request, v, targetChainVersion) {
    const { chainVersion, data: chain } = loadChain(projectRoot, targetChainVersion ?? v.chainVersion);
    (0, chain_1.assertChainCanMutate)(chain);
    const baseline = chain.intent.git_baseline;
    if (!baseline || (0, intentGit_1.nextAmendmentIdOf)(chain) !== v.amendmentId) {
        throw new IntentAmendmentError('STALE_ARTIFACT', 'The chain changed since the commit was verified; preview and approve again.');
    }
    let entry;
    try {
        entry = (0, chain_1.recordIntentAmendment)(chain, request.change, {
            purpose_changed: request.purposeChanged,
            baseline_commit: baseline.commit,
            result_commit: v.verified.commit,
            result_tag: v.tag,
            doc_sha256: v.verified.working_sha256,
            doc_sha256_lf: v.verified.working_sha256_lf,
            ...(v.diffStat ? { diff_stat: v.diffStat } : {}),
        });
    }
    catch (e) {
        throw new IntentAmendmentError('INVALID_OPERATION', e.message);
    }
    const absPath = (0, intentGit_1.intentAbsPath)(projectRoot, chain);
    if ((0, gitRepo_1.lfSha256)(fs_extra_1.default.readFileSync(absPath)) !== v.verified.working_sha256_lf) {
        throw new IntentAmendmentError('STALE_ARTIFACT', 'The INTENT file changed during the transaction; preview and approve again.');
    }
    (0, chain_1.certifyIntentDoc)(chain, absPath);
    if (chain.intent.certified_doc_sha256 !== v.verified.working_sha256) {
        throw new IntentAmendmentError('STALE_ARTIFACT', 'The INTENT file changed during the transaction; preview and approve again.');
    }
    chain.intent.git_baseline = {
        commit: v.verified.commit,
        tag: v.tag,
        doc_sha256: v.verified.working_sha256,
        doc_sha256_lf: v.verified.working_sha256_lf,
        revision: chain.intent.revision ?? (baseline.revision + 1),
        provenance: 'amendment',
        recorded_at: entry.created_at,
        amendment: entry.id,
    };
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    appendIntentLog(projectRoot, {
        event: 'amendment',
        chain: chainVersion,
        id: entry.id,
        created_at: entry.created_at,
        director_approved_at: entry.director_approved_at,
        change: entry.change,
        purpose_changed: request.purposeChanged,
        baseline_commit: baseline.commit,
        result_commit: v.verified.commit,
        result_tag: v.tag,
        doc_sha256: chain.intent.certified_doc_sha256,
    });
    return { chainVersion, version: chain.intent.version, entry, certifiedDocSha256: chain.intent.certified_doc_sha256, tag: v.tag, tagCreated: v.tagCreated, commit: v.verified.commit };
}
/**
 * Both phases, for the CLI (runs inside withGovernanceTransaction, which has no
 * mutation-time budget). Must run inside the project's governance transaction.
 */
function recordIntentAmendmentUseCase(projectRoot, request, targetChainVersion) {
    const verified = verifyAndTagAmendment(projectRoot, request, targetChainVersion);
    return applyVerifiedAmendment(projectRoot, request, verified, targetChainVersion);
}
//# sourceMappingURL=intentAmendmentService.js.map