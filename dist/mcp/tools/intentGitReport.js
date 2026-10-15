"use strict";
// Shared by sigma_intent_baseline_check and sigma_intent_amendment_preview.
// IntentGitReport carries repo_root (an absolute host path) and free-text check
// details that can quote git's stderr. Neither may reach the model raw.
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeGitReport = serializeGitReport;
const queryHelpers_1 = require("./queryHelpers");
function serializeGitReport(report, root) {
    const roots = [root, report.repo_root];
    const clean = (s) => (0, queryHelpers_1.scrubHostPaths)(s, roots);
    return {
        chain: report.chain,
        file: report.file ? clean(report.file) : null,
        repo_path: report.repo_path,
        ok: report.blockers.length === 0,
        checks: report.checks.map((c) => ({ id: c.id, ok: c.ok, blocking: c.blocking, detail: clean(c.detail) })),
        blockers: report.blockers.map(clean),
        baseline: report.baseline,
        revision: report.revision,
        certified_sha256: report.certified_sha256,
        working_sha256: report.working_sha256,
        working_sha256_lf: report.working_sha256_lf,
    };
}
//# sourceMappingURL=intentGitReport.js.map