import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { createDefaultProjectConfig, readProjectConfig, writeProjectConfig } from '../src/engine/projectConfig';
import { isNotionApiDetectable } from '../src/engine/notionService';

function jsonResponse(body: any, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as any;
}

// PLAN-IMPL-SIGMA-HUMANIZE-OPERATION — Fase 1 (config field + auto-detect
// fallback). CLI-level prompt/flag wiring in `sigma project start` and the
// `sigma notion enable/disable` commands are exercised end-to-end manually
// (mocking inquirer for a Commander action is disproportionate here); this
// covers the engine-level pieces those commands depend on.
describe('Sigma Humanize Fase 1 — notion_humanize_gate config', () => {
  let projectDir: string;
  let restoreToken: string | undefined;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-humanize-fase1-'));
    restoreToken = process.env.NOTION_TOKEN;
    delete process.env.NOTION_TOKEN;
  });

  afterEach(() => {
    fs.removeSync(projectDir);
    vi.unstubAllGlobals();
    if (restoreToken !== undefined) process.env.NOTION_TOKEN = restoreToken;
    else delete process.env.NOTION_TOKEN;
  });

  describe('createDefaultProjectConfig / readProjectConfig', () => {
    it('defaults notion_humanize_gate.enabled to false', () => {
      const cfg = createDefaultProjectConfig();
      expect(cfg.notion_humanize_gate).toEqual({ enabled: false });
    });

    it('reads the default when project.config.json does not exist yet', () => {
      const cfg = readProjectConfig(projectDir);
      expect(cfg.notion_humanize_gate?.enabled).toBe(false);
    });

    it('persists an explicit enabled:true through write/read', () => {
      const cfg = createDefaultProjectConfig();
      cfg.notion_humanize_gate = { enabled: true };
      writeProjectConfig(projectDir, cfg);

      const reread = readProjectConfig(projectDir);
      expect(reread.notion_humanize_gate?.enabled).toBe(true);
    });
  });

  describe('isNotionApiDetectable()', () => {
    it('returns false when NOTION_TOKEN is not set', async () => {
      expect(await isNotionApiDetectable()).toBe(false);
    });

    it('returns false when NOTION_TOKEN is set but the connection test fails', async () => {
      process.env.NOTION_TOKEN = 'secret_bad_token';
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'Unauthorized' }, false, 401)));

      expect(await isNotionApiDetectable()).toBe(false);
    });

    it('returns true when NOTION_TOKEN is set and the connection test succeeds', async () => {
      process.env.NOTION_TOKEN = 'secret_good_token';
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ name: 'Sigma Bot', bot: { workspace_name: 'Test Workspace' } })));

      expect(await isNotionApiDetectable()).toBe(true);
    });
  });
});
