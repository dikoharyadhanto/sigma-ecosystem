// Stage B2 — sigma_get_git_evidence. Query-plane equivalent of `sigma git
// evidence`.
//
// Director decision (2026-09-16): full parity with the CLI — this reports
// git status/diff over the ENTIRE working tree at projectRoot, not scoped
// to Sigma/. The CLI has always worked this way; DEV/AUD roles need this
// visibility for audit, and scoping it down would be an undocumented
// parity gap between CLI and MCP for a command that has no chain/gate
// concept to begin with. This is the one B2 tool whose data can include
// paths and content entirely outside Sigma/ governance artifacts — by
// design, not by oversight.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execSync } from 'child_process';
import { SOURCE_ENGINE } from '../shared';
import { respond } from '../contract';

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, encoding: 'utf8' }).trim();
}

export function computeGetGitEvidence(root: string | null): unknown {
  if (!root) return { present: false, source: SOURCE_ENGINE };

  try {
    run('git rev-parse --git-dir', root);
  } catch {
    return { present: false, source: SOURCE_ENGINE };
  }

  let branch: string | null = null;
  let hash: string | null = null;
  let subject: string | null = null;
  let date: string | null = null;
  let changedFiles: string | null = null;
  let diffStat: string | null = null;

  try { branch = run('git rev-parse --abbrev-ref HEAD', root); } catch { /* ok */ }
  try {
    const logOut = run('git log -1 --format=%H%n%s%n%ai', root);
    const [h, s, d] = logOut.split('\n');
    hash = h ?? null;
    subject = s ?? null;
    date = d ?? null;
  } catch { /* ok */ }
  try {
    const status = run('git --no-optional-locks status --short', root);
    if (status) changedFiles = status;
  } catch { /* ok */ }
  try {
    const diff = run('git diff --stat HEAD', root);
    if (diff) diffStat = diff;
  } catch { /* ok */ }

  return {
    present: true,
    branch,
    commit: { hash, subject, date },
    changed_files: changedFiles,
    diff_stat: diffStat,
    source: SOURCE_ENGINE,
  };
}

export function registerGetGitEvidenceTool(server: McpServer): void {
  server.registerTool(
    'sigma_get_git_evidence',
    {
      title: 'Get git repository evidence',
      description:
        'Return git branch, latest commit, changed files (git --no-optional-locks status --short), and diff ' +
        'summary (git diff --stat HEAD) for the project root — the query-plane equivalent of `sigma git ' +
        'evidence`. Reports on the ENTIRE working tree, not scoped to Sigma/ (Director decision, full CLI parity) ' +
        '— can surface paths and change summaries for application code outside Sigma governance artifacts. ' +
        'Read-only (does not mutate the repository or its index). Returns { present, branch, commit: { hash, ' +
        'subject, date }, changed_files, diff_stat, source }, or { present: false, source } when no git ' +
        'repository exists.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () =>
      respond('sigma_get_git_evidence', undefined, (root) => computeGetGitEvidence(root))
  );
}
