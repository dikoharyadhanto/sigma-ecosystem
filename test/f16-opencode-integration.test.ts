/**
 * f16-opencode-integration.test.ts — F16 U-08.
 *
 * Runs the real `opencode` binary against a project and home produced by Sigma.
 * Skipped when `opencode` (or, for the connection check, `sigma-mcp`) is not on PATH:
 * the contract is opt-in on machines that have the tool, never a CI requirement.
 * Verified against opencode 1.18.35 (Windows). Plugin *blocking* needs a model call
 * and is covered by the manual smoke U-09, not here.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { runCli } from './helpers';

function onPath(bin: string): boolean {
  try {
    execSync(process.platform === 'win32' ? `where ${bin}` : `which ${bin}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const HAS_OPENCODE = onPath('opencode');
const HAS_SIGMA_MCP = onPath('sigma-mcp');

describe.skipIf(!HAS_OPENCODE)('F16 U-08 opencode integration', () => {
  let home: string;
  let project: string;
  let resolved: Record<string, any>;

  const opencode = (args: string): string =>
    execSync(`opencode ${args}`, {
      cwd: project,
      env: { ...process.env, HOME: home, USERPROFILE: home },
      encoding: 'utf-8',
      timeout: 90_000,
    });

  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-oc-home-'));
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-oc-proj-'));
    fs.ensureDirSync(path.join(home, '.config', 'opencode'));

    expect(runCli('setup install --yes --force', project, home).exitCode).toBe(0);
    expect(runCli('project start --id OCINT --name "OC Int" --confirm', project, home).exitCode).toBe(0);

    resolved = JSON.parse(opencode('debug config'));
  }, 120_000);

  afterAll(() => {
    fs.removeSync(home);
    fs.removeSync(project);
  });

  it('resolves mcp.sigma bound to the project', () => {
    const sigma = resolved.mcp.sigma;
    expect(sigma.type).toBe('local');
    expect(sigma.enabled).toBe(true);
    expect(sigma.command.slice(0, 3)).toEqual(['sigma-mcp', '--mode', 'query']);
    expect(sigma.command).toContain('--project-id');
    expect(sigma.command[sigma.command.indexOf('--project-id') + 1]).toBe('OCINT');
  });

  it('resolves the nine Sigma commands', () => {
    expect(Object.keys(resolved.command).sort()).toEqual(
      ['arc', 'aud', 'dev', 'fmn', 'humanize', 'read-memo', 'report', 'sigma-test', 'write-memo'],
    );
    expect(resolved.command.arc.description).toMatch(/^Sigma ARC/);
    expect(resolved.command.arc.template).toContain('Role Identity');
  });

  it('registers the protection plugin', () => {
    const plugins: string[] = resolved.plugin ?? [];
    expect(plugins.some((p) => /plugins\/protect-sigma\.js$/.test(p))).toBe(true);
  });

  it.skipIf(!HAS_SIGMA_MCP)('reports the MCP server as connected', () => {
    const out = opencode('mcp list').replace(/\u001b\[[0-9;]*m/g, '');
    expect(out).toMatch(/sigma\s+connected/);
  }, 120_000);
});
