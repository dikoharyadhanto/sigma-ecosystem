import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { buildServer } from '../src/mcp/index';
import { buildControlServer } from '../src/mcp/control/index';
import {
  CAPABILITY_MANIFEST, TOMBSTONES, COMPATIBILITY_TOOLS, MCP_NATIVE_TOOLS,
  inventoryDrift, type CapabilityRecord,
} from '../src/mcp/capabilityManifest';
import { OPERATION_TIERS, OPERATION_OWNER, mcpStatusFor, availabilityFor } from '../src/mcp/policy';

// PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY-20261015 — Phase 1.
// TC-MCP-01 registry completeness, TC-MCP-02 tool inventory, TC-MCP-08
// tombstone rejection, TC-MCP-09 non-registration.
//
// The manifest is a declaration. These tests are what stop it drifting from
// the registry and from the tools the two servers really register.

const ROOT = path.resolve(__dirname, '..');
const registry = fs.readJsonSync(path.join(ROOT, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json')) as {
  operations: Array<{ operation_id: string }>;
};
const registryIds = registry.operations.map((o) => o.operation_id);
const TOMBSTONE_IDS = ['intent_lock', 'plan_lock', 'exec_lock'];
const ACTIVE_IDS = registryIds.filter((id) => !TOMBSTONE_IDS.includes(id));

async function listToolNames(server: McpServer): Promise<string[]> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'manifest-parity', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const { tools } = await client.listTools();
  await client.close();
  return tools.map((t) => t.name).sort();
}

const cleanups: Array<() => void> = [];
const cwd = process.cwd();
afterEach(() => {
  process.chdir(cwd);
  while (cleanups.length) cleanups.pop()!();
});

describe('TC-MCP-01 registry completeness', () => {
  it('has exactly one record for every active registry operation', () => {
    const ids = CAPABILITY_MANIFEST.map((r) => r.operation_id);
    expect(new Set(ids).size, 'duplicate records').toBe(ids.length);
    expect([...ids].sort()).toEqual([...ACTIVE_IDS].sort());
  });

  it('keeps tombstones in the registry and out of the manifest', () => {
    expect(Object.keys(TOMBSTONES).sort()).toEqual([...TOMBSTONE_IDS].sort());
    for (const id of TOMBSTONE_IDS) {
      expect(registryIds, `${id} is a registry tombstone`).toContain(id);
      expect(CAPABILITY_MANIFEST.find((r) => r.operation_id === id), `${id} must have no capability record`).toBeUndefined();
      expect(OPERATION_TIERS[id]).toBe('NA');
      expect(mcpStatusFor(id)).toBe('not_admissible');
      expect(availabilityFor(id, null).availability).toBe('forbidden');
    }
  });

  it('classifies notes_new, notes_list and notes_update (AC-MCP-04)', () => {
    expect(OPERATION_TIERS.notes_list).toBe('Q');
    expect(OPERATION_TIERS.notes_new).toBe('W1');
    expect(OPERATION_TIERS.notes_update).toBe('W3');
    expect(mcpStatusFor('notes_list')).toBe('implemented');
    expect(mcpStatusFor('notes_new')).toBe('implemented');
    expect(mcpStatusFor('notes_update')).toBe('deferred');
  });

  it('gives every record a rationale, and a mapping consistent with its tools', () => {
    for (const r of CAPABILITY_MANIFEST) {
      expect(r.rationale.trim().length, `${r.operation_id} needs a rationale`).toBeGreaterThan(0);
      if (r.tool_names.length === 0) expect(r.mapping, `${r.operation_id}: no tools means mapping none`).toBe('none');
      else expect(r.mapping, `${r.operation_id}: tools present, mapping must not be none`).not.toBe('none');
    }
  });

  it('keeps the plane, status, and tier vocabulary internally consistent', () => {
    const bad: string[] = [];
    for (const r of CAPABILITY_MANIFEST) {
      const id = r.operation_id;
      if (r.plane === 'query' && r.tier !== 'Q') bad.push(`${id}: query plane needs tier Q`);
      if ((r.tier === 'W3' || r.tier === 'NA') && r.plane !== 'cli_only') bad.push(`${id}: tier ${r.tier} must be cli_only`);
      if (r.mcp_status === 'not_admissible' && r.plane !== 'cli_only') bad.push(`${id}: not_admissible must be cli_only`);
      if (r.mcp_status === 'implemented' && r.plane !== 'query' && r.plane !== 'control') bad.push(`${id}: implemented needs a query/control plane`);
      if (r.plane === 'deferred' && r.mcp_status !== 'deferred') bad.push(`${id}: deferred plane needs deferred status`);
      if (r.mcp_status === 'implemented' && r.tool_names.length === 0) bad.push(`${id}: implemented without tool_names`);
      if (r.mcp_status !== 'implemented' && r.tool_names.length > 0) bad.push(`${id}: tool_names while ${r.mcp_status}`);
    }
    expect(bad).toEqual([]);
  });

  it('derives the tier and owner tables from the manifest and nothing else', () => {
    for (const r of CAPABILITY_MANIFEST) {
      expect(OPERATION_TIERS[r.operation_id]).toBe(r.tier);
      expect(OPERATION_OWNER[r.operation_id]).toBe(r.owner_role);
    }
    expect(Object.keys(OPERATION_TIERS).sort()).toEqual([...registryIds].sort());
  });
});

describe('TC-MCP-02 tool inventory', () => {
  it('matches the manifest to the tools the servers really register', async () => {
    const queryTools = await listToolNames(buildServer());
    const controlTools = await listToolNames(buildControlServer());
    expect(queryTools.length).toBeGreaterThan(0);
    expect(controlTools.length).toBeGreaterThan(0);

    const report = inventoryDrift({ registryIds, queryTools, controlTools });
    expect(report).toEqual({
      unclassified: [], unknownRecords: [], duplicateRecords: [], orphanTools: [],
      implementedWithoutTool: [], wrongPlane: [], toolsWithoutImplemented: [],
    });
  });

  it('keeps the planes physically separate', async () => {
    const queryTools = new Set(await listToolNames(buildServer()));
    const controlTools = await listToolNames(buildControlServer());
    expect(controlTools.filter((t) => queryTools.has(t))).toEqual([]);
  });

  it('never counts a legacy compatibility tool as support for an operation', async () => {
    const controlTools = new Set(await listToolNames(buildControlServer()));
    const legacy = Object.keys(COMPATIBILITY_TOOLS);
    for (const tool of legacy) expect(controlTools.has(tool), `${tool} is still registered`).toBe(true);
    for (const r of CAPABILITY_MANIFEST) {
      expect(r.tool_names.filter((t) => legacy.includes(t)), `${r.operation_id} must not cite a legacy tool`).toEqual([]);
    }
    for (const t of Object.keys(MCP_NATIVE_TOOLS)) {
      expect(legacy, `${t} is both native and legacy`).not.toContain(t);
    }
  });

  it('detects each kind of drift it exists to catch', () => {
    const base = {
      registryIds: ['alpha', 'beta', 'plan_lock'],
      queryTools: ['sigma_alpha'],
      controlTools: ['sigma_orphan'],
    };
    const rec = (over: Partial<CapabilityRecord>): CapabilityRecord => ({
      operation_id: 'alpha', tier: 'Q', plane: 'query', mcp_status: 'implemented',
      tool_names: ['sigma_alpha'], mapping: 'exact', rationale: 'x', ...over,
    });

    expect(inventoryDrift(base, [rec({})]).unclassified).toEqual(['beta']);
    expect(inventoryDrift(base, [rec({}), rec({})]).duplicateRecords).toEqual(['alpha']);
    expect(inventoryDrift(base, [rec({}), rec({ operation_id: 'ghost' })]).unknownRecords).toEqual(['ghost']);
    expect(inventoryDrift(base, [rec({})]).orphanTools).toEqual(['sigma_orphan']);
    expect(inventoryDrift(base, [rec({ tool_names: ['sigma_missing'] })]).implementedWithoutTool).toEqual(['alpha']);
    expect(inventoryDrift(base, [rec({ plane: 'control' })]).wrongPlane).toEqual(['alpha']);
    expect(inventoryDrift(base, [rec({ plane: 'cli_only' })]).wrongPlane).toEqual(['alpha']);
    expect(inventoryDrift(base, [rec({ mcp_status: 'deferred' })]).toolsWithoutImplemented).toEqual(['alpha']);
  });
});

describe('TC-MCP-08 tombstone rejection', () => {
  it('fails when a capability record is added for a tombstone', () => {
    const forged: CapabilityRecord = {
      operation_id: 'plan_lock', tier: 'W2', plane: 'control', mcp_status: 'implemented',
      tool_names: ['sigma_prepare_plan_lock'], mapping: 'exact', rationale: 'forged',
    };
    const report = inventoryDrift(
      { registryIds, queryTools: [], controlTools: ['sigma_prepare_plan_lock'] },
      [...CAPABILITY_MANIFEST, forged],
    );
    expect(report.unknownRecords, 'a record for plan_lock must be reported').toContain('plan_lock');
  });

  it('does not let a tombstone be counted as an active operation', () => {
    const active = new Set(CAPABILITY_MANIFEST.map((r) => r.operation_id));
    for (const id of TOMBSTONE_IDS) expect(active.has(id)).toBe(false);
    expect(active.size).toBe(registryIds.length - TOMBSTONE_IDS.length);
  });
});

describe('TC-MCP-09 non-registration', () => {
  it('building both servers and listing tools creates no project state', async () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-manifest-bare-'));
    cleanups.push(() => fs.removeSync(bare));
    const repoStatus = path.join(ROOT, 'Sigma', 'activate_status.json');
    const existedBefore = fs.existsSync(repoStatus);

    process.chdir(bare);
    await listToolNames(buildServer());
    await listToolNames(buildControlServer());

    expect(fs.readdirSync(bare), 'a non-Sigma directory must stay untouched').toEqual([]);
    expect(fs.existsSync(path.join(bare, 'Sigma'))).toBe(false);
    expect(fs.existsSync(repoStatus)).toBe(existedBefore);
  });
});
