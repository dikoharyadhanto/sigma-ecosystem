// Gate 0.5 runtime smoke test — real subprocess, real stdio JSON-RPC.
//
// Spawns the same file the global `sigma-mcp` shim executes
// (%APPDATA%\npm\node_modules\sigma-ecosystem\bin\sigma-mcp.js, a symlink to
// this repo) and drives it as an out-of-process MCP server against the Hermes
// Phase 0 lab project.

// Relative to this file's home in the repo, so the script carries no absolute
// host path of its own.
import { Client } from '../../../node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../../../node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

// Host paths are parameters, not constants, so this is re-runnable by a
// reviewer on another machine:
//
//   node gate05-runtime-smoke.mjs <LAB_ROOT> [BIN_JS] [OTHER_PROJECT_ROOT]
//
// LAB_ROOT   a disposable Sigma project (the Hermes Phase 0 lab, HERMESLAB)
// BIN_JS     bin/sigma-mcp.js as the global shim resolves it — defaults to
//            resolving `sigma-ecosystem` through the global node_modules, so
//            the test exercises the same file a real client would launch
// OTHER      any second Sigma project, used only as a cross-project target
//            that must be refused

const LAB = process.env.SIGMA_SMOKE_LAB || process.argv[2];
const BIN = process.env.SIGMA_SMOKE_BIN || process.argv[3] ||
  path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'sigma-ecosystem', 'bin', 'sigma-mcp.js');
const OTHER = process.env.SIGMA_SMOKE_OTHER || process.argv[4] || process.cwd();

if (!LAB) {
  console.error('usage: node gate05-runtime-smoke.mjs <LAB_ROOT> [BIN_JS] [OTHER_PROJECT_ROOT]');
  process.exit(64);
}
const EXPECTED_ID = process.env.SIGMA_SMOKE_ID || 'HERMESLAB';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  PASS  ${name}`);
  else { console.log(`  FAIL  ${name} ${detail}`); failures++; }
};

function governanceHashes(root) {
  const out = {};
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      if (name === '.git') continue;
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

async function session(args) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [BIN, ...args] });
  const client = new Client({ name: 'gate05-smoke', version: '1.0.0' });
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

const before = governanceHashes(LAB);
console.log(`\nGovernance files in lab: ${Object.keys(before).length}\n`);

// ── Case A — legacy positional config (what the lab's .mcp.json holds today)
console.log('CASE A — legacy positional args (config lama x binary baru)');
{
  const s = await session([LAB]);
  const { tools } = await s.client.listTools();
  check('nine tools discovered', tools.length === 9, `got ${tools.length}`);

  const st = await s.call('sigma_get_state');
  check('contract_version present', st.payload.contract_version === '1.0');
  check('project is HERMESLAB', st.payload.project_id === EXPECTED_ID);
  check('bound but unverified', st.payload.binding.verified === false && st.payload.binding.kind === 'bound',
    JSON.stringify(st.payload.binding));
  check('root fingerprint present, absolute root absent',
    typeof st.payload.binding.root_fingerprint === 'string' &&
    !JSON.stringify(st.payload.binding).includes('hermes'));
  await s.close();
}

// ── Case B — verified binding
console.log('\nCASE B — verified binding args (config baru x binary baru)');
let revB;
{
  const s = await session(['--mode', 'query', '--project-root', LAB, '--project-id', EXPECTED_ID]);

  const st = await s.call('sigma_get_state');
  check('binding verified', st.payload.binding.verified === true && st.payload.binding.kind === 'verified',
    JSON.stringify(st.payload.binding));
  revB = st.payload.snapshot.state_revision;
  check('state_revision present', /^sha256:[0-9a-f]{64}$/.test(revB || ''));

  const vb = await s.call('sigma_verify_binding', { expected_project_id: EXPECTED_ID, expected_root: LAB });
  check('verify_binding usable', vb.payload.usable === true);
  check('verify_binding id+root match', vb.payload.expected_project_id_match === true && vb.payload.expected_root_match === true);

  const vbBad = await s.call('sigma_verify_binding', { expected_project_id: 'SOMETHING_ELSE' });
  check('wrong expectation reported, not rebound', vbBad.payload.expected_project_id_match === false && vbBad.payload.usable === false);

  // the six Phase 0 tools still answer
  for (const [name, params] of [
    ['sigma_get_orientation', {}], ['sigma_get_gates', {}], ['sigma_list_artifacts', {}],
    ['sigma_doctor', {}], ['sigma_get_memory', { role: 'FMN' }],
  ]) {
    const r = await s.call(name, params);
    check(`${name} active + engine-sourced`, r.payload.active === true && r.payload.source === 'engine',
      JSON.stringify(r.payload).slice(0, 120));
  }

  const pol = await s.call('sigma_get_effective_policy');
  check('policy covers 59 operations', pol.payload.operations?.length === 59, `got ${pol.payload.operations?.length}`);
  check('policy declares itself advisory', pol.payload.advisory === true);
  check('no implemented op is a write',
    pol.payload.operations.filter(o => o.mcp_status === 'implemented').every(o => o.availability === 'observe'));

  const art = await s.call('sigma_read_artifact', { type: 'intent' });
  check('read_artifact returns intent v1', art.payload.artifact_type === 'intent' && art.payload.version === 'v1',
    JSON.stringify(art.payload).slice(0, 160));
  check('read_artifact path is project-relative', art.payload.present === false || !path.isAbsolute(art.payload.path || ''));

  // ── negative: cross-project via tool argument
  const bad = await s.call('sigma_get_state', { project_root: OTHER });
  check('cross-project project_root refused', bad.isError === true && bad.payload.error?.code === 'BOUNDARY_VIOLATION',
    JSON.stringify(bad.payload).slice(0, 160));
  check('refusal leaks no other-project detail', !JSON.stringify(bad.payload).includes('sigma-ecosystem'));

  await s.close();
}

// ── Case C — mismatched project id must refuse to start
console.log('\nCASE C — wrong --project-id must refuse to start');
{
  const r = spawnSync(process.execPath, [BIN, '--mode', 'query', '--project-root', LAB, '--project-id', 'WRONG'],
    { encoding: 'utf8', timeout: 20000 });
  check('exit code 2', r.status === 2, `status=${r.status}`);
  check('PROJECT_ID_MISMATCH on stderr', /PROJECT_ID_MISMATCH/.test(r.stderr || ''), (r.stderr || '').slice(0, 160));
  check('neither id echoed', !/HERMESLAB/.test(r.stderr || '') && !/WRONG"/.test(r.stderr || ''));
}

// ── Case D — control mode must refuse without a binding
console.log('\nCASE D — control mode must refuse unbound');
{
  const r = spawnSync(process.execPath, [BIN, '--mode', 'control'], { encoding: 'utf8', timeout: 20000 });
  check('exit code 2', r.status === 2, `status=${r.status}`);
  check('BINDING_REQUIRED on stderr', /BINDING_REQUIRED/.test(r.stderr || ''), (r.stderr || '').slice(0, 160));
}

// ── Case E — exactly one server, exactly one response per request id
//
// Added after reviewer finding R-02. The SDK client above cannot catch this:
// it correlates the first response to the request id and discards the rest, so
// a server answering twice looked perfectly healthy. This case reads raw stdio
// frames instead of going through the client.
console.log('\nCASE E — one server, one response per request id');
{
  const { spawn } = await import('child_process');
  const child = spawn(process.execPath, [BIN, LAB]);
  let rawOut = '', rawErr = '';
  child.stdout.on('data', d => rawOut += d);
  child.stderr.on('data', d => rawErr += d);
  await new Promise(r => setTimeout(r, 700));
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'raw', version: '1' } } }) + '\n');
  await new Promise(r => setTimeout(r, 1500));
  child.kill();

  const frames = rawOut.split('\n').filter(l => l.trim());
  const startups = (rawErr.match(/running on stdio/g) || []).length;
  check('exactly one startup', startups === 1, `got ${startups}`);
  check('exactly one frame for id=1', frames.length === 1, `got ${frames.length}`);
}

// ── non-mutation across every call above
console.log('\nNON-MUTATION');
{
  const after = governanceHashes(LAB);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diff = [...keys].filter(k => before[k] !== after[k]);
  check(`${Object.keys(after).length} files byte-identical before/after`, diff.length === 0, diff.join(', '));
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
