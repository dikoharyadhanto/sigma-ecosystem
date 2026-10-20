"use strict";
// PLAN-IMPL-SIGMA-GITIGNORE-IDENTITY-AND-PORTABILITY §3.4 item 1 / WP-4.
//
// Snapshot mode for the INTENT baseline and amendment flow (F05). With Sigma
// gitignore ON, `Sigma/charter/INTENT-v<N>.md` is not tracked by Git, so the
// Git baseline (commit + annotated tag) cannot exist. The certified bytes are
// kept as local files instead:
//
//   Sigma/revisions/INTENT-v<N>/base.md        content at `baseline adopt`
//   Sigma/revisions/INTENT-v<N>/amd-<NNN>.md   content certified by each amendment
//   Sigma/revisions/INTENT-v<N>/ledger.json    ordered list of the above with hashes
//
// Same governance shape as the Git mode: the Director reviews a diff against
// the last certified content and approves a file hash; only the anchor differs
// (a local snapshot instead of a commit). The snapshot is evidence kept beside
// the chain, not a replacement for it — the chain's `snapshot_baseline` and the
// amendment entries remain the record. Snapshots are append-only: Sigma never
// rewrites or deletes one.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.snapshotDirRel = snapshotDirRel;
exports.snapshotLedgerRel = snapshotLedgerRel;
exports.snapshotFileRel = snapshotFileRel;
exports.intentSnapshotTransactionFiles = intentSnapshotTransactionFiles;
exports.resolveIntentVerificationMode = resolveIntentVerificationMode;
exports.readSnapshotLedger = readSnapshotLedger;
exports.writeSnapshot = writeSnapshot;
exports.readBaselineSnapshot = readBaselineSnapshot;
exports.findSnapshotByHash = findSnapshotByHash;
exports.inspectIntentSnapshot = inspectIntentSnapshot;
exports.diffDocuments = diffDocuments;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const gitRepo_1 = require("./gitRepo");
const docHash_1 = require("./docHash");
const fs_1 = require("../utils/fs");
const revisions_1 = require("./revisions");
// ── Paths ────────────────────────────────────────────────────────────────────
function snapshotDirRel(chainVersion) {
    if (!/^v\d+$/.test(chainVersion))
        throw new Error(`Invalid chain version: ${chainVersion}`);
    return `Sigma/revisions/INTENT-${chainVersion}`;
}
function snapshotLedgerRel(chainVersion) {
    return `${snapshotDirRel(chainVersion)}/ledger.json`;
}
function snapshotFileRel(chainVersion, id) {
    if (id === 'BASE')
        return `${snapshotDirRel(chainVersion)}/base.md`;
    const match = /^AMD-(\d{3,})$/.exec(id);
    if (!match)
        throw new Error(`Invalid amendment id: ${id}`);
    return `${snapshotDirRel(chainVersion)}/amd-${match[1]}.md`;
}
/** Files an adopt or amendment transaction may create or replace, so the journal can roll them back. */
function intentSnapshotTransactionFiles(root, chainVersion, id) {
    return [snapshotLedgerRel(chainVersion), snapshotFileRel(chainVersion, id)].map(rel => path_1.default.join(root, rel));
}
// ── Mode resolution ──────────────────────────────────────────────────────────
/**
 * Which anchor verifies this chain's INTENT:
 *  - a recorded snapshot baseline wins (it is the newer decision);
 *  - otherwise a recorded Git baseline keeps Git mode;
 *  - with neither, Git mode only if the INTENT file is actually tracked by Git,
 *    because that is the only case where a commit can hold it.
 */
function resolveIntentVerificationMode(root, chain) {
    if (chain.intent.snapshot_baseline)
        return 'snapshot';
    if (chain.intent.git_baseline)
        return 'git';
    try {
        if (!(0, gitRepo_1.gitAvailable)(root).ok)
            return 'snapshot';
        const top = (0, gitRepo_1.repoToplevel)(root);
        if (!top.ok)
            return 'snapshot';
        const abs = (0, revisions_1.artifactFile)(root, chain, 'intent', chain.intent.version);
        return (0, gitRepo_1.isTracked)(top.root, (0, gitRepo_1.repoRelativePath)(top.root, abs)) ? 'git' : 'snapshot';
    }
    catch {
        return 'snapshot';
    }
}
// ── Ledger ───────────────────────────────────────────────────────────────────
function readSnapshotLedger(root, chainVersion) {
    const file = path_1.default.join(root, snapshotLedgerRel(chainVersion));
    if (!fs_extra_1.default.existsSync(file))
        return { schema_version: 1, chain: chainVersion, entries: [] };
    const raw = fs_extra_1.default.readJsonSync(file);
    const ledger = raw;
    if (!ledger || ledger.schema_version !== 1 || ledger.chain !== chainVersion || !Array.isArray(ledger.entries)) {
        throw new Error(`INTENT snapshot ledger is malformed: ${snapshotLedgerRel(chainVersion)}`);
    }
    return ledger;
}
function writeSnapshotLedger(root, ledger) {
    const file = path_1.default.join(root, snapshotLedgerRel(ledger.chain));
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(file));
    const tmp = `${file}.${process.pid}.tmp`;
    fs_extra_1.default.writeJsonSync(tmp, ledger, { spaces: 2 });
    (0, fs_1.atomicReplaceFileSync)(tmp, file);
}
/**
 * Writes `bytes` as the snapshot for `id` and appends it to the ledger. An
 * existing snapshot is adopted only when its bytes are identical (a rerun after
 * an interrupted attempt); a different file is never overwritten.
 */
function writeSnapshot(root, chainVersion, id, bytes, meta) {
    const rel = snapshotFileRel(chainVersion, id);
    const abs = path_1.default.join(root, rel);
    let created = true;
    if (fs_extra_1.default.existsSync(abs)) {
        if (!fs_extra_1.default.readFileSync(abs).equals(bytes)) {
            throw new Error(`Snapshot ${rel} already exists with different content; Sigma never overwrites a snapshot.`);
        }
        created = false;
    }
    else {
        fs_extra_1.default.ensureDirSync(path_1.default.dirname(abs));
        const tmp = `${abs}.${process.pid}.tmp`;
        fs_extra_1.default.writeFileSync(tmp, bytes);
        (0, fs_1.atomicReplaceFileSync)(tmp, abs);
    }
    const entry = {
        id,
        file: rel,
        doc_sha256: (0, gitRepo_1.sha256Hex)(bytes),
        doc_sha256_lf: (0, gitRepo_1.lfSha256)(bytes),
        revision: meta.revision,
        provenance: meta.provenance,
        recorded_at: meta.recorded_at,
    };
    const ledger = readSnapshotLedger(root, chainVersion);
    const existing = ledger.entries.find(e => e.id === id);
    if (existing) {
        if (existing.doc_sha256 !== entry.doc_sha256)
            throw new Error(`Ledger already holds ${id} with a different hash.`);
    }
    else {
        ledger.entries.push(entry);
        writeSnapshotLedger(root, ledger);
    }
    return { entry: existing ?? entry, created };
}
/** The recorded snapshot content, verified against its recorded hash. Null when missing or altered. */
function readBaselineSnapshot(root, baseline) {
    const abs = path_1.default.join(root, baseline.file);
    if (!fs_extra_1.default.existsSync(abs))
        return null;
    const bytes = fs_extra_1.default.readFileSync(abs);
    return (0, gitRepo_1.lfSha256)(bytes) === baseline.doc_sha256_lf ? bytes : null;
}
/**
 * Looks through every snapshot of a chain for content that is the certified document `hash`
 * (raw, LF-folded or CRLF-expanded form, optional `sha256:` prefix — see matchesCertified).
 */
function findSnapshotByHash(root, chainVersion, hash) {
    let ledger;
    try {
        ledger = readSnapshotLedger(root, chainVersion);
    }
    catch {
        return null;
    }
    for (const entry of ledger.entries) {
        const abs = path_1.default.join(root, entry.file);
        if (!fs_extra_1.default.existsSync(abs))
            continue;
        const bytes = fs_extra_1.default.readFileSync(abs);
        if ((0, docHash_1.matchesCertified)(bytes, hash))
            return bytes;
    }
    return null;
}
// ── Inspection (same report shape as the Git mode) ───────────────────────────
/**
 * `clean`  — the INTENT must equal its certified/snapshot content (before ARC starts editing).
 * `edited` — the INTENT is expected to differ from the snapshot (preview and commit verification).
 *
 * Returns an IntentGitReport so the CLI and MCP printers need no second shape:
 * `repo_root` stays null and `repo_path` carries the project-relative INTENT path.
 */
function inspectIntentSnapshot(root, chainVersion, chain, mode) {
    const checks = [];
    const report = {
        chain: chainVersion, file: chain.intent.file ?? null, repo_path: chain.intent.file ?? null, repo_root: null, checks, blockers: [],
        baseline: null, working_sha256: null, working_sha256_lf: null,
        certified_sha256: chain.intent.certified_doc_sha256 ?? null, revision: chain.intent.revision ?? null,
    };
    const add = (id, ok, detail, blocking = true) => { checks.push({ id, ok, blocking, detail }); return ok; };
    const finish = () => { report.blockers = checks.filter(c => !c.ok && c.blocking).map(c => `${c.id}: ${c.detail}`); return report; };
    add('verification_mode', true, 'snapshot (local copies under Sigma/revisions/; Git is not used for this INTENT)', false);
    add('intent_ratified', chain.intent.state === 'RATIFIED', `INTENT ${chain.intent.version} is ${chain.intent.state}; amendment requires RATIFIED`);
    let abs;
    try {
        abs = (0, revisions_1.artifactFile)(root, chain, 'intent', chain.intent.version);
        if (!fs_extra_1.default.existsSync(abs))
            throw new Error('INTENT file is not present on disk');
        add('intent_file', true, chain.intent.file ?? abs);
    }
    catch (e) {
        add('intent_file', false, e.message);
        return finish();
    }
    const bytes = fs_extra_1.default.readFileSync(abs);
    report.working_sha256 = (0, gitRepo_1.sha256Hex)(bytes);
    report.working_sha256_lf = (0, gitRepo_1.lfSha256)(bytes);
    const baseline = chain.intent.snapshot_baseline;
    if (!add('baseline_recorded', !!baseline, 'No snapshot baseline recorded for this chain. Run: sigma intent baseline adopt --director-confirm'))
        return finish();
    const b = baseline;
    const snapshot = readBaselineSnapshot(root, b);
    add('baseline_snapshot', !!snapshot, snapshot
        ? `${b.file} matches the recorded baseline content`
        : `${b.file} is missing or no longer matches the recorded baseline hash (snapshots are append-only; restore it from backup)`);
    if (mode === 'clean') {
        // Line-ending-only differences (core.autocrlf) are not an edit: same tolerance as the Git mode.
        add('certified_matches_file', (0, docHash_1.matchesCertified)(bytes, report.certified_sha256), `UNCERTIFIED_EDIT: the INTENT file differs from its certified content (${(0, docHash_1.lineEndingHint)(bytes, report.certified_sha256)})`);
        add('file_matches_baseline', report.working_sha256_lf === b.doc_sha256_lf, 'The INTENT file does not match the recorded snapshot baseline content');
    }
    else {
        add('changed_since_baseline', report.working_sha256_lf !== b.doc_sha256_lf, 'The INTENT file has no change relative to the baseline; nothing to amend');
    }
    return finish();
}
// ── Diff (no Git required) ───────────────────────────────────────────────────
const MAX_DIFF_CELLS = 4000000;
function splitLines(text) {
    const normalized = text.replace(/\r\n/g, '\n');
    if (normalized === '')
        return [];
    const lines = normalized.split('\n');
    if (lines[lines.length - 1] === '')
        lines.pop();
    return lines;
}
/** Unified-style line diff of two documents (CRLF folded). Mechanical evidence only. */
function diffDocuments(before, after, labelBefore, labelAfter) {
    const a = splitLines(before);
    const b = splitLines(after);
    if (a.length * b.length > MAX_DIFF_CELLS) {
        return { stat: `(diff skipped: ${a.length} -> ${b.length} lines is too large for the built-in differ)`, patch: '' };
    }
    // Longest common subsequence table, then walk it into hunks.
    const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
        }
    }
    const ops = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            ops.push({ kind: ' ', line: a[i] });
            i++;
            j++;
        }
        else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
            ops.push({ kind: '-', line: a[i] });
            i++;
        }
        else {
            ops.push({ kind: '+', line: b[j] });
            j++;
        }
    }
    while (i < a.length)
        ops.push({ kind: '-', line: a[i++] });
    while (j < b.length)
        ops.push({ kind: '+', line: b[j++] });
    const added = ops.filter(o => o.kind === '+').length;
    const removed = ops.filter(o => o.kind === '-').length;
    const stat = added === 0 && removed === 0
        ? '(no changes)'
        : `${labelAfter} | ${added + removed} changed (+${added} -${removed})`;
    const CONTEXT = 3;
    const keep = new Array(ops.length).fill(false);
    ops.forEach((op, index) => {
        if (op.kind === ' ')
            return;
        for (let k = Math.max(0, index - CONTEXT); k <= Math.min(ops.length - 1, index + CONTEXT); k++)
            keep[k] = true;
    });
    const out = [`--- ${labelBefore}`, `+++ ${labelAfter}`];
    let index = 0;
    while (index < ops.length) {
        if (!keep[index]) {
            index++;
            continue;
        }
        let end = index;
        while (end < ops.length && keep[end])
            end++;
        const hunk = ops.slice(index, end);
        const startA = ops.slice(0, index).filter(o => o.kind !== '+').length + 1;
        const startB = ops.slice(0, index).filter(o => o.kind !== '-').length + 1;
        out.push(`@@ -${startA},${hunk.filter(o => o.kind !== '+').length} +${startB},${hunk.filter(o => o.kind !== '-').length} @@`);
        for (const op of hunk)
            out.push(op.kind + op.line);
        index = end;
    }
    return { stat, patch: added === 0 && removed === 0 ? '' : out.join('\n') + '\n' };
}
//# sourceMappingURL=intentSnapshot.js.map