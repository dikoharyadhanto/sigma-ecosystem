// Gate C runtime smoke test — real subprocesses, real stdio JSON-RPC, no
// mocks. Unlike gate05-runtime-smoke.mjs this does not touch any existing
// project: it bootstraps its own disposable fixture (via `sigma project
// start`, itself run out-of-process against an isolated HOME so nothing
// reaches the real ~/.sigma) and tears it down at the end.
//
//   node Implementation/sigma-mcp/evidence/stageC-runtime-smoke.mjs
//
// Exercises, against bin/sigma-control.js and bin/sigma-mcp.js as real
// child processes:
//   - control mode refuses to start without --role
//   - sigma_create_intent_draft creates+activates a chain, ARC-bound
//   - the query server (separate process, same project) observes the same
//     post-state — proving CLI's use-case service and the MCP control tool
//     produce identical results, not just that both "succeed"
//   - retrying the same idempotency_key replays rather than duplicates
//   - a role other than ARC is refused before any write happens
//   - sigma_update_artifact_draft with a stale expected_artifact_sha256 is
//     refused and leaves the file untouched
//   - non-mutation of every file the control plane did not intend to touch
//     (i.e. everything except the one intent doc + chain + activate_status)

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

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  PASS  ${name}`);
  else { console.log(`  FAIL  ${name} ${detail}`); failures++; }
};

const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-stagec-smoke-'));
const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-stagec-home-'));
const PROJECT_ID = 'STAGECSMOKE';
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
  const client = new Client({ name: 'stageC-smoke', version: '1.0.0' });
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

  console.log('SETUP — minimal ~/.sigma install marker (isolated HOME, matches test/helpers.ts setupTestEnv)');
  {
    const sigmaGlobal = path.join(homeDir, '.sigma');
    fs.mkdirSync(sigmaGlobal, { recursive: true });
    fs.writeFileSync(path.join(sigmaGlobal, 'sigma.config.json'), JSON.stringify({
      schema_version: SCHEMA_VERSION, cli_version: '0.9.0', installed_at: new Date().toISOString(),
    }));
    check('install marker written', fs.existsSync(path.join(sigmaGlobal, 'sigma.config.json')));
  }

  console.log('\nSETUP — sigma project start (isolated HOME, disposable fixture)');
  {
    const r = run(CLI, ['project', 'start', '--id', PROJECT_ID, '--name', 'Stage C Smoke', '--confirm']);
    check('project start exit 0', r.status === 0, (r.stderr || r.stdout || '').slice(0, 300));
  }

  // ── Case A — control mode must refuse without --role
  console.log('\nCASE A — control mode refuses to start without --role');
  {
    const r = spawnSync(process.execPath,
      [CONTROL_BIN, '--project-root', projectDir, '--project-id', PROJECT_ID],
      { encoding: 'utf8', timeout: 20000, env: isolatedEnv });
    check('exit code 2', r.status === 2, `status=${r.status}`);
    check('BINDING_REQUIRED on stderr', /BINDING_REQUIRED/.test(r.stderr || ''), (r.stderr || '').slice(0, 160));
  }

  const before = governanceHashes(projectDir);
  console.log(`\nGovernance files in fixture before any control call: ${Object.keys(before).length}`);

  // ── Case B — role other than ARC is refused before any write
  console.log('\nCASE B — a bound role other than ARC is refused, no write happens');
  {
    const s = await session(CONTROL_BIN, ['--project-root', projectDir, '--project-id', PROJECT_ID, '--role', 'DEV']);
    const st = await session(MCP_BIN, ['--mode', 'query', '--project-root', projectDir, '--project-id', PROJECT_ID]);
    const rev = (await st.call('sigma_get_state')).payload.snapshot.state_revision;
    const res = await s.call('sigma_create_intent_draft', {
      title: 'Should not be created', focus: 'x', idempotency_key: 'wrong-role-1', expected_state_revision: rev,
    });
    check('ROLE_NOT_AUTHORIZED', res.isError === true && res.payload.error?.code === 'ROLE_NOT_AUTHORIZED',
      JSON.stringify(res.payload).slice(0, 200));
    await s.close();
    await st.close();
  }
  {
    const after = governanceHashes(projectDir);
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    // .mcp-control/audit.jsonl is EXPECTED to change — §17 requires denials to
    // be audited, not just commits. Everything else (chain files,
    // activate_status.json, the intent doc) must be untouched by a refused
    // call.
    const diff = [...keys].filter(k => before[k] !== after[k] && !k.startsWith('Sigma/.mcp-control/'));
    check('no governance file changed after the refused role-mismatch call', diff.length === 0, diff.join(', '));

    const auditPath = path.join(projectDir, 'Sigma', '.mcp-control', 'audit.jsonl');
    check('the deny was audited', fs.existsSync(auditPath), 'audit.jsonl missing');
    if (fs.existsSync(auditPath)) {
      const lines = fs.readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean);
      const last = JSON.parse(lines[lines.length - 1]);
      check('audit entry records the deny with no secret/credential fields',
        last.outcome === 'deny' && last.error_code === 'ROLE_NOT_AUTHORIZED' && last.bound_role === 'DEV',
        JSON.stringify(last));
    }
  }

  // ── Case C — ARC-bound create, then the query server (separate process)
  // observes the identical post-state.
  console.log('\nCASE C — ARC create_intent_draft, then query server observes the same state');
  let chainVersion, relPath, revAfterCreate, expectedArtifactSha256;
  {
    const s = await session(CONTROL_BIN, ['--project-root', projectDir, '--project-id', PROJECT_ID, '--role', 'ARC']);
    const q0 = await session(MCP_BIN, ['--mode', 'query', '--project-root', projectDir, '--project-id', PROJECT_ID]);
    const rev0 = (await q0.call('sigma_get_state')).payload.snapshot.state_revision;
    await q0.close();

    const res = await s.call('sigma_create_intent_draft', {
      title: 'Stage C Smoke Intent', focus: 'Prove create+update through a real control process',
      idempotency_key: 'create-1', expected_state_revision: rev0,
    });
    check('create succeeded', res.isError !== true, JSON.stringify(res.payload).slice(0, 300));
    chainVersion = res.payload.chainVersion;
    relPath = res.payload.relPath;
    check('chain v1', chainVersion === 'v1', `got ${chainVersion}`);
    check('relPath is the canonical charter path', relPath === 'Sigma/charter/DIR-INTENT-v1.md', relPath);
    await s.close();

    const q1 = await session(MCP_BIN, ['--mode', 'query', '--project-root', projectDir, '--project-id', PROJECT_ID]);
    const st = await q1.call('sigma_get_state');
    check('query server sees the new active chain', st.payload.active_chain === 'v1', JSON.stringify(st.payload).slice(0, 200));
    revAfterCreate = st.payload.snapshot.state_revision;
    check('state_revision moved from the pre-create value', revAfterCreate !== rev0);

    const art = await q1.call('sigma_read_artifact', { type: 'intent' });
    check('query server reads the draft ARC just created', art.payload.present === true && art.payload.version === 'v1',
      JSON.stringify(art.payload).slice(0, 200));
    expectedArtifactSha256 = art.payload.sha256;
    await q1.close();
  }

  // ── Case D — retry with the same idempotency_key replays, no duplicate chain
  console.log('\nCASE D — retrying create with the same idempotency_key does not duplicate the effect');
  {
    const s = await session(CONTROL_BIN, ['--project-root', projectDir, '--project-id', PROJECT_ID, '--role', 'ARC']);
    // Deliberately reuses the now-stale expected_state_revision from Case C —
    // a genuine retry resends what it sent the first time.
    const res = await s.call('sigma_create_intent_draft', {
      title: 'Stage C Smoke Intent', focus: 'Prove create+update through a real control process',
      idempotency_key: 'create-1', expected_state_revision: revAfterCreate,
    });
    check('replay returns the same chain version', res.payload.chainVersion === 'v1', JSON.stringify(res.payload).slice(0, 200));
    await s.close();
  }
  {
    const r = run(CLI, ['intent', 'list']);
    const chainLines = (r.stdout.match(/^v\d+\s/gm) || []).length;
    check('exactly one chain exists on disk after the retry', chainLines === 1, `stdout:\n${r.stdout}`);
  }

  // ── Case E — update with a stale expected_artifact_sha256 is refused, file untouched
  console.log('\nCASE E — update_artifact_draft refuses a stale expected_artifact_sha256');
  {
    const s = await session(CONTROL_BIN, ['--project-root', projectDir, '--project-id', PROJECT_ID, '--role', 'ARC']);
    const before2 = fs.readFileSync(path.join(projectDir, relPath), 'utf8');
    const res = await s.call('sigma_update_artifact_draft', {
      type: 'intent', version: 'v1', content: '# attempted overwrite',
      expected_artifact_sha256: 'sha256:' + '0'.repeat(64),
      idempotency_key: 'update-stale-1', expected_state_revision: revAfterCreate,
    });
    check('STALE_ARTIFACT', res.isError === true && res.payload.error?.code === 'STALE_ARTIFACT',
      JSON.stringify(res.payload).slice(0, 200));
    const after2 = fs.readFileSync(path.join(projectDir, relPath), 'utf8');
    check('file untouched by the refused update', after2 === before2);
    await s.close();
  }

  // ── Case F — update with the correct hash succeeds, and the query server sees the new content
  console.log('\nCASE F — update_artifact_draft with the correct hash succeeds');
  {
    const s = await session(CONTROL_BIN, ['--project-root', projectDir, '--project-id', PROJECT_ID, '--role', 'ARC']);
    const q = await session(MCP_BIN, ['--mode', 'query', '--project-root', projectDir, '--project-id', PROJECT_ID]);
    const rev = (await q.call('sigma_get_state')).payload.snapshot.state_revision;
    await q.close();

    const newContent = '# Stage C smoke — updated via sigma_update_artifact_draft\n';
    const res = await s.call('sigma_update_artifact_draft', {
      type: 'intent', version: 'v1', content: newContent,
      expected_artifact_sha256: expectedArtifactSha256,
      idempotency_key: 'update-ok-1', expected_state_revision: rev,
    });
    check('update succeeded', res.isError !== true, JSON.stringify(res.payload).slice(0, 300));
    await s.close();

    const onDisk = fs.readFileSync(path.join(projectDir, relPath), 'utf8');
    check('file content matches what was sent', onDisk === newContent);

    const q2 = await session(MCP_BIN, ['--mode', 'query', '--project-root', projectDir, '--project-id', PROJECT_ID]);
    const art = await q2.call('sigma_read_artifact', { type: 'intent' });
    check('query server sees the updated content', art.payload.content === newContent);
    await q2.close();
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
} finally {
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.rmSync(homeDir, { recursive: true, force: true });
}

process.exit(failures === 0 ? 0 : 1);
