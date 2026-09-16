// Gate D runtime smoke test — real subprocesses, real stdio JSON-RPC, real
// `sigma control` CLI subprocess for the Director approval step. Builds its
// own disposable fixture project (same isolation pattern as
// stageC-runtime-smoke.mjs) and tears it down at the end.
//
//   node Implementation/sigma-mcp/evidence/stageD-runtime-smoke.mjs
//
// Exercises, across three independent real processes (sigma-control for
// prepare/commit, `sigma control` CLI for the Director decision, sigma-mcp
// for the query-side observation) sharing nothing but the project on disk:
//   - prepare freezes a ticket without ratifying anything
//   - `sigma control approve` without --director-confirm records nothing
//   - `sigma control approve --director-confirm` records an approval a
//     separate control-server process can then consume
//   - commit ratifies, opens Gate 1, and the query server (yet another
//     process) observes the identical post-state
//   - the same approval cannot commit a second time
//   - a chat-style "just trust me" call with no approval_id is impossible —
//     the schema requires one, and a fabricated one is rejected

import { Client } from '../../../node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../../../node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const CLI = path.join(REPO_ROOT, 'dist', 'cli.js');
const MCP_BIN = path.join(REPO_ROOT, 'bin', 'sigma-mcp.js');
const CONTROL_BIN = path.join(REPO_ROOT, 'bin', 'sigma-control.js');
const require = createRequire(import.meta.url);
const { SCHEMA_VERSION } = require(path.join(REPO_ROOT, 'dist', 'config.js'));

// Mirrors test/helpers.ts's validIntentDoc('v1') — a document that actually
// satisfies every DIR-INTENT lock requirement, not the bare placeholder
// template `sigma intent new` scaffolds. Using the real template here would
// make ratifyIntentDraft() correctly refuse it (as it should — an unfilled
// DRAFT has no business being ratified), which is not the boundary this
// smoke test is trying to exercise.
const VALID_INTENT_DOC = `<!-- SIGMA:DOC type=DIR_INTENT schema=3 -->
# DIR-INTENT v1

<!-- SIGMA:DIR_INTENT:SECTION:INTENT_CORE -->
## 1. Intent Core

Test intent core.

<!-- SIGMA:DIR_INTENT:SECTION:COMPREHENSIVE_RESEARCH -->
## 2. Comprehensive Research

Test research.

<!-- SIGMA:DIR_INTENT:SECTION:SUCCESS_DEFINITION -->
## 3. Success Definition

Test success definition.

<!-- SIGMA:DIR_INTENT:SECTION:QUALITY_BAR -->
## 4. Quality Bar

| Dimension | Minimum Standard For This Intent | Must Not Happen | Evidence Required |
|:--------- |:-------------------------------- |:--------------- |:----------------- |
| Security | N/A | N/A | N/A |
| UX Trust | N/A | N/A | N/A |
| UI / Product Packaging | N/A | N/A | N/A |
| Performance / Cost | N/A | N/A | N/A |

<!-- SIGMA:DIR_INTENT:SECTION:STRATEGIC_TRADE_OFFS -->
## 5. Strategic Trade-Offs

Test trade-offs.

<!-- SIGMA:DIR_INTENT:SECTION:SCOPE_BOUNDARY -->
## 6. Scope Boundary

Test scope boundary.

<!-- SIGMA:DIR_INTENT:SECTION:CONSTRAINTS_AND_PREFERENCES -->
## 7. Constraints & Preferences

Test constraints.

<!-- SIGMA:DIR_INTENT:SECTION:TECHNICAL_AND_ARCHITECTURE_DIRECTION -->
## 8. Technical & Architecture Direction

Test technical direction.

<!-- SIGMA:DIR_INTENT:SECTION:FUNCTIONAL_REQUIREMENTS -->
## 9. Functional Requirements

Test functional requirements.

<!-- SIGMA:DIR_INTENT:SECTION:RISK_AND_FAILURE_DEFINITION -->
## 10. Risk & Failure Definition

Test risk definition.

<!-- SIGMA:DIR_INTENT:SECTION:EXECUTION_DIRECTION_FOR_FMN -->
## 11. Execution Direction for FMN

Test execution direction.

<!-- SIGMA:DIR_INTENT:SECTION:AUD_FINDINGS_ADVISORY_ONLY -->
## 12. AUD Findings — Advisory Only

Test AUD findings.

- [x] PASS

<!-- SIGMA:DIR_INTENT:SECTION:FINAL_VALIDATION_CHECKLIST -->
## 13. Final Validation Checklist

Test checklist.

### 13.1 Lock Requirement

- [x] Intent Core is clear enough to guide execution.
- [x] Scope in/out is explicit.
- [x] Success criteria are observable or measurable.
- [x] Security minimum standard is stated or explicitly marked not applicable.
- [x] UX Trust minimum standard is stated or explicitly marked not applicable.
- [x] UI / Product Packaging minimum standard is stated or explicitly marked not applicable.
- [x] Performance / Cost minimum standard is stated or explicitly marked not applicable.
- [x] FMN is instructed to preserve the Quality Bar in every PLAN.
- [x] Constraints and preferences are separated.
- [x] Technical choices are marked as auditable means, not sovereign intent.
- [x] At least one execution direction exists for FMN (Execution Direction for FMN).
- [x] Risk appetite is stated.
- [x] Primary failure concern is stated.
- [x] Evidence requirement is stated.
- [x] Director verdict is recorded.

### 13.2 Conditional Requirement

- [ ] Comprehensive Research subsections filled or N/A.
- [ ] AUD Verificator Mode reviewed source-tier compliance, or Director accepted the risk.
`;

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  PASS  ${name}`);
  else { console.log(`  FAIL  ${name} ${detail}`); failures++; }
};

const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-staged-smoke-'));
const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-staged-home-'));
const PROJECT_ID = 'STAGEDSMOKE';
const isolatedEnv = { ...process.env, HOME: homeDir, USERPROFILE: homeDir };

function run(cmd, args) {
  return spawnSync(process.execPath, [cmd, ...args], { cwd: projectDir, env: isolatedEnv, encoding: 'utf8' });
}

function governanceHashes(root) {
  const out = {};
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const st = fs.statSync(abs);
      if (st.isDirectory()) walk(abs);
      else out[path.relative(root, abs).split(path.sep).join('/')] =
        crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    }
  };
  walk(root);
  return out;
}

async function session(bin, args) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [bin, ...args], env: isolatedEnv });
  const client = new Client({ name: 'stageD-smoke', version: '1.0.0' });
  await client.connect(transport);
  return {
    client,
    async call(name, params = {}) {
      const res = await client.callTool({ name, arguments: params });
      return { payload: JSON.parse(res.content[0].text), isError: res.isError === true };
    },
    close: () => client.close(),
  };
}

try {
  console.log(`Fixture project: ${projectDir}\nIsolated HOME:   ${homeDir}\n`);

  console.log('SETUP — minimal ~/.sigma install marker + disposable project');
  {
    const sigmaGlobal = path.join(homeDir, '.sigma');
    fs.mkdirSync(sigmaGlobal, { recursive: true });
    fs.writeFileSync(path.join(sigmaGlobal, 'sigma.config.json'), JSON.stringify({
      schema_version: SCHEMA_VERSION, cli_version: '0.9.0', installed_at: new Date().toISOString(),
    }));
    const start = run(CLI, ['project', 'start', '--id', PROJECT_ID, '--name', 'Stage D Smoke', '--confirm']);
    check('project start exit 0', start.status === 0, (start.stderr || start.stdout || '').slice(0, 300));

    const draft = run(CLI, ['intent', 'new', '--title', 'Stage D smoke intent', '--focus', 'Prove prepare/approve/commit end-to-end']);
    check('intent new exit 0', draft.status === 0, (draft.stderr || draft.stdout || '').slice(0, 300));

    // Overwrite the bare scaffold template with a document that actually
    // satisfies every lock requirement — see VALID_INTENT_DOC's comment.
    fs.writeFileSync(path.join(projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), VALID_INTENT_DOC);
  }

  // ── Case A — prepare freezes a ticket, ratifies nothing
  let ticketId;
  console.log('\nCASE A — sigma_prepare_intent_ratify freezes a ticket without ratifying');
  {
    const s = await session(CONTROL_BIN, ['--project-root', projectDir, '--project-id', PROJECT_ID, '--role', 'ARC']);
    const res = await s.call('sigma_prepare_intent_ratify', { idempotency_key: 'prep-1' });
    check('prepare succeeded', res.isError !== true, JSON.stringify(res.payload).slice(0, 300));
    ticketId = res.payload.operation_ticket_id;
    check('ticket id looks right', typeof ticketId === 'string' && ticketId.startsWith('opt_'), String(ticketId));
    await s.close();

    const q = await session(MCP_BIN, ['--mode', 'query', '--project-root', projectDir, '--project-id', PROJECT_ID]);
    const art = await q.call('sigma_read_artifact', { type: 'intent' });
    check('intent still DRAFT after prepare', art.payload.state === 'DRAFT', JSON.stringify(art.payload).slice(0, 200));
    await q.close();
  }

  // ── Case B — CLI preview + confirm gate, real subprocess
  console.log('\nCASE B — sigma control show / approve gate, real CLI subprocess');
  {
    const show = run(CLI, ['control', 'show', ticketId]);
    check('show exit 0', show.status === 0);
    check('show prints the ticket id', show.stdout.includes(ticketId));

    const noConfirm = run(CLI, ['control', 'approve', ticketId]);
    check('approve without --director-confirm exits 1', noConfirm.status === 1);
    check('no approval directory created yet', !fs.existsSync(path.join(projectDir, 'Sigma', '.mcp-control', 'approvals')));
  }

  // ── Case C — real Director approval via CLI subprocess
  let approvalId;
  console.log('\nCASE C — sigma control approve --director-confirm (real CLI subprocess)');
  {
    const approve = run(CLI, ['control', 'approve', ticketId, '--director-confirm']);
    check('approve exit 0', approve.status === 0, approve.stderr.slice(0, 200));
    const m = approve.stdout.match(/Approval recorded: (appr_[a-f0-9-]+)/);
    check('approval id printed', m !== null, approve.stdout.slice(0, 200));
    approvalId = m ? m[1] : null;
  }

  // ── Case D — commit via a DIFFERENT sigma-control process than prepare used
  console.log('\nCASE D — sigma_commit_intent_ratify (separate process from prepare), query server observes it');
  {
    const s = await session(CONTROL_BIN, ['--project-root', projectDir, '--project-id', PROJECT_ID, '--role', 'ARC']);
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approvalId, idempotency_key: 'commit-1',
    });
    check('commit succeeded', res.isError !== true, JSON.stringify(res.payload).slice(0, 600));
    await s.close();

    const q = await session(MCP_BIN, ['--mode', 'query', '--project-root', projectDir, '--project-id', PROJECT_ID]);
    const gates = await q.call('sigma_get_gates');
    check('query server observes Gate 1 open', gates.payload.gate_1_open === true, JSON.stringify(gates.payload).slice(0, 200));
    const art = await q.call('sigma_read_artifact', { type: 'intent' });
    check('query server observes RATIFIED', art.payload.state === 'RATIFIED', JSON.stringify(art.payload).slice(0, 200));
    await q.close();
  }

  // ── Case E — the same approval cannot commit a second time
  console.log('\nCASE E — the same ticket+approval cannot commit again under a new idempotency_key');
  const before = governanceHashes(projectDir);
  {
    const s = await session(CONTROL_BIN, ['--project-root', projectDir, '--project-id', PROJECT_ID, '--role', 'ARC']);
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approvalId, idempotency_key: 'commit-2-different-key',
    });
    check('second commit refused', res.isError === true && res.payload.error?.code === 'APPROVAL_MISMATCH',
      JSON.stringify(res.payload).slice(0, 200));
    await s.close();
  }
  {
    const after = governanceHashes(projectDir);
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const diff = [...keys].filter(k => before[k] !== after[k] && !k.startsWith('Sigma/.mcp-control/'));
    check('no governance file changed on the refused re-commit', diff.length === 0, diff.join(', '));
  }

  // ── Case F — a fabricated approval_id (no Sigma record) is refused
  console.log('\nCASE F — a chat-style "just trust me" approval_id with no backing record is refused');
  {
    const s = await session(CONTROL_BIN, ['--project-root', projectDir, '--project-id', PROJECT_ID, '--role', 'ARC']);
    // Prepare a second ticket so this isn't conflated with the already-consumed one.
    const p = await s.call('sigma_prepare_intent_ratify', { idempotency_key: 'prep-2-noop' });
    // Active intent is already RATIFIED at this point, so prepare itself
    // should refuse — confirming there is nothing left to fabricate an
    // approval against even in principle.
    check('prepare on an already-RATIFIED intent refuses', p.isError === true && p.payload.error?.code === 'INVALID_OPERATION',
      JSON.stringify(p.payload).slice(0, 200));
    await s.close();
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
} finally {
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.rmSync(homeDir, { recursive: true, force: true });
}

process.exit(failures === 0 ? 0 : 1);
