/**
 * mcp-config.test.ts — Unit tests untuk src/utils/mcpConfig.ts
 *
 * Cakupan:
 *   - writeClaudeMcpConfig     : merge-aware, idempoten, non-destruktif
 *   - writeCursorMcpConfig     : merge-aware, idempoten, non-destruktif
 *   - writeCodexMcpConfig      : merge-aware, idempoten, non-destruktif (TOML)
 *   - writeAntigravityMcpConfig: merge-aware, idempoten, non-destruktif
 *   - removeCodexMcpConfig     : no-op kalau tidak ada, merge-delete, idempoten
 *   - removeAntigravityMcpConfig: no-op kalau tidak ada, merge-delete, idempoten
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { parse as parseTOML } from 'smol-toml';

// ── Isolasi HOME via env override ─────────────────────────────────────────────
// Semua fungsi global-scoped di mcpConfig.ts menggunakan os.homedir(), yang
// membaca HOME/USERPROFILE. Kita override env di sini supaya test tidak
// menyentuh home direktori nyata pengguna.

let tmpHome: string;
let tmpProject: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-mcp-test-home-'));
  tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-mcp-test-proj-'));
  originalHome = process.env['HOME'];
  originalUserProfile = process.env['USERPROFILE'];
  // Override agar os.homedir() mengembalikan tmpHome di semua platform
  process.env['HOME'] = tmpHome;
  process.env['USERPROFILE'] = tmpHome;
});

afterEach(() => {
  // Restore env
  if (originalHome === undefined) {
    delete process.env['HOME'];
  } else {
    process.env['HOME'] = originalHome;
  }
  if (originalUserProfile === undefined) {
    delete process.env['USERPROFILE'];
  } else {
    process.env['USERPROFILE'] = originalUserProfile;
  }
  fs.removeSync(tmpHome);
  fs.removeSync(tmpProject);
});

// Lazy-import supaya HOME override berlaku saat fungsi dipanggil
async function importMcpConfig() {
  // Re-import setiap test tidak bisa di ESM pure, tapi karena mcpConfig.ts
  // memanggil os.homedir() di runtime (bukan module-load time), override env
  // sudah cukup — tidak perlu dynamic import.
  return await import('../src/utils/mcpConfig');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mcpJsonPath(dir: string) {
  return path.join(dir, '.mcp.json');
}

function cursorMcpPath(dir: string) {
  return path.join(dir, '.cursor', 'mcp.json');
}

function codexConfigPath(home: string) {
  return path.join(home, '.codex', 'config.toml');
}

function antigravityConfigPath(home: string) {
  return path.join(home, '.gemini', 'config', 'mcp_config.json');
}

const expectedEntry = (root?: string) => ({
  command: 'sigma-mcp',
  args: root ? [root] : [],
});

// ── writeClaudeMcpConfig ──────────────────────────────────────────────────────

describe('writeClaudeMcpConfig', () => {
  it('creates .mcp.json with sigma entry and project path when file does not exist', async () => {
    const { writeClaudeMcpConfig } = await importMcpConfig();
    writeClaudeMcpConfig(tmpProject);

    expect(fs.existsSync(mcpJsonPath(tmpProject))).toBe(true);
    const content = fs.readJsonSync(mcpJsonPath(tmpProject));
    expect(content.mcpServers.sigma).toEqual(expectedEntry(tmpProject));
  });

  it('merges sigma entry without touching existing servers', async () => {
    const { writeClaudeMcpConfig } = await importMcpConfig();
    // File dengan server lain milik pengguna
    fs.writeJsonSync(mcpJsonPath(tmpProject), {
      mcpServers: { other: { command: 'other-mcp', args: [] } },
    });

    writeClaudeMcpConfig(tmpProject);

    const content = fs.readJsonSync(mcpJsonPath(tmpProject));
    expect(content.mcpServers.sigma).toEqual(expectedEntry(tmpProject));
    expect(content.mcpServers.other).toEqual({ command: 'other-mcp', args: [] });
  });

  it('is idempotent (calling twice produces same result)', async () => {
    const { writeClaudeMcpConfig } = await importMcpConfig();
    writeClaudeMcpConfig(tmpProject);
    writeClaudeMcpConfig(tmpProject);

    const content = fs.readJsonSync(mcpJsonPath(tmpProject));
    expect(content.mcpServers.sigma).toEqual(expectedEntry(tmpProject));
    expect(Object.keys(content.mcpServers)).toHaveLength(1);
  });

  it('overwrites corrupt mcpServers (non-object) with correct structure', async () => {
    const { writeClaudeMcpConfig } = await importMcpConfig();
    fs.writeJsonSync(mcpJsonPath(tmpProject), { mcpServers: 'invalid' });

    writeClaudeMcpConfig(tmpProject);

    const content = fs.readJsonSync(mcpJsonPath(tmpProject));
    expect(content.mcpServers.sigma).toEqual(expectedEntry(tmpProject));
  });
});

// ── writeCursorMcpConfig ──────────────────────────────────────────────────────

describe('writeCursorMcpConfig', () => {
  it('creates .cursor/mcp.json with sigma entry when file does not exist', async () => {
    const { writeCursorMcpConfig } = await importMcpConfig();
    writeCursorMcpConfig(tmpProject);

    expect(fs.existsSync(cursorMcpPath(tmpProject))).toBe(true);
    const content = fs.readJsonSync(cursorMcpPath(tmpProject));
    expect(content.mcpServers.sigma).toEqual(expectedEntry(tmpProject));
  });

  it('merges sigma entry without touching existing servers', async () => {
    const { writeCursorMcpConfig } = await importMcpConfig();
    fs.ensureDirSync(path.join(tmpProject, '.cursor'));
    fs.writeJsonSync(cursorMcpPath(tmpProject), {
      mcpServers: { other: { command: 'other-mcp', args: [] } },
    });

    writeCursorMcpConfig(tmpProject);

    const content = fs.readJsonSync(cursorMcpPath(tmpProject));
    expect(content.mcpServers.sigma).toEqual(expectedEntry(tmpProject));
    expect(content.mcpServers.other).toEqual({ command: 'other-mcp', args: [] });
  });

  it('is idempotent', async () => {
    const { writeCursorMcpConfig } = await importMcpConfig();
    writeCursorMcpConfig(tmpProject);
    writeCursorMcpConfig(tmpProject);

    const content = fs.readJsonSync(cursorMcpPath(tmpProject));
    expect(content.mcpServers.sigma).toEqual(expectedEntry(tmpProject));
  });
});

// ── writeCodexMcpConfig ───────────────────────────────────────────────────────

describe('writeCodexMcpConfig', () => {
  it('creates ~/.codex/config.toml with [mcp_servers.sigma] when file does not exist', async () => {
    const { writeCodexMcpConfig } = await importMcpConfig();
    writeCodexMcpConfig(tmpProject);

    const filePath = codexConfigPath(tmpHome);
    expect(fs.existsSync(filePath)).toBe(true);
    const parsed = parseTOML(fs.readFileSync(filePath, 'utf-8')) as any;
    expect(parsed.mcp_servers?.sigma?.command).toBe('sigma-mcp');
    expect(parsed.mcp_servers?.sigma?.args).toEqual([tmpProject]);
  });

  it('merges sigma without touching other Codex settings', async () => {
    const { writeCodexMcpConfig } = await importMcpConfig();
    const filePath = codexConfigPath(tmpHome);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, `[model]\nname = "o3"\n\n[mcp_servers.other]\ncommand = "other-mcp"\nargs = []\n`, 'utf-8');

    writeCodexMcpConfig(tmpProject);

    const parsed = parseTOML(fs.readFileSync(filePath, 'utf-8')) as any;
    expect(parsed.mcp_servers?.sigma?.command).toBe('sigma-mcp');
    expect(parsed.mcp_servers?.sigma?.args).toEqual([tmpProject]);
    expect(parsed.mcp_servers?.other?.command).toBe('other-mcp');
    expect((parsed.model as any)?.name).toBe('o3');
  });

  it('is idempotent', async () => {
    const { writeCodexMcpConfig } = await importMcpConfig();
    writeCodexMcpConfig(tmpProject);
    writeCodexMcpConfig(tmpProject);

    const parsed = parseTOML(fs.readFileSync(codexConfigPath(tmpHome), 'utf-8')) as any;
    expect(parsed.mcp_servers?.sigma?.command).toBe('sigma-mcp');
    expect(parsed.mcp_servers?.sigma?.args).toEqual([tmpProject]);
    expect(Object.keys(parsed.mcp_servers)).toHaveLength(1);
  });
});

// ── writeAntigravityMcpConfig ─────────────────────────────────────────────────

describe('writeAntigravityMcpConfig', () => {
  it('creates ~/.gemini/config/mcp_config.json with sigma entry and project path', async () => {
    const { writeAntigravityMcpConfig } = await importMcpConfig();
    writeAntigravityMcpConfig(tmpProject);

    const filePath = antigravityConfigPath(tmpHome);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readJsonSync(filePath);
    expect(content.mcpServers.sigma).toEqual(expectedEntry(tmpProject));
  });

  it('merges sigma without touching other MCP servers', async () => {
    const { writeAntigravityMcpConfig } = await importMcpConfig();
    const filePath = antigravityConfigPath(tmpHome);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeJsonSync(filePath, {
      mcpServers: { other: { command: 'other-mcp', args: [] } },
    });

    writeAntigravityMcpConfig(tmpProject);

    const content = fs.readJsonSync(filePath);
    expect(content.mcpServers.sigma).toEqual(expectedEntry(tmpProject));
    expect(content.mcpServers.other).toEqual({ command: 'other-mcp', args: [] });
  });

  it('is idempotent', async () => {
    const { writeAntigravityMcpConfig } = await importMcpConfig();
    writeAntigravityMcpConfig(tmpProject);
    writeAntigravityMcpConfig(tmpProject);

    const content = fs.readJsonSync(antigravityConfigPath(tmpHome));
    expect(content.mcpServers.sigma).toEqual(expectedEntry(tmpProject));
  });
});

// ── removeCodexMcpConfig ──────────────────────────────────────────────────────

describe('removeCodexMcpConfig', () => {
  it('is no-op when file does not exist', async () => {
    const { removeCodexMcpConfig } = await importMcpConfig();
    expect(() => removeCodexMcpConfig()).not.toThrow();
    expect(fs.existsSync(codexConfigPath(tmpHome))).toBe(false);
  });

  it('is no-op when key sigma does not exist', async () => {
    const { removeCodexMcpConfig } = await importMcpConfig();
    const filePath = codexConfigPath(tmpHome);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, `[mcp_servers.other]\ncommand = "other-mcp"\nargs = []\n`, 'utf-8');

    removeCodexMcpConfig();

    const parsed = parseTOML(fs.readFileSync(filePath, 'utf-8')) as any;
    expect(parsed.mcp_servers?.other?.command).toBe('other-mcp');
    expect(parsed.mcp_servers?.sigma).toBeUndefined();
  });

  it('removes sigma key and preserves other servers and settings', async () => {
    const { writeCodexMcpConfig, removeCodexMcpConfig } = await importMcpConfig();
    const filePath = codexConfigPath(tmpHome);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, `[model]\nname = "o3"\n\n[mcp_servers.other]\ncommand = "other-mcp"\nargs = []\n`, 'utf-8');
    writeCodexMcpConfig(); // add sigma

    removeCodexMcpConfig();

    const parsed = parseTOML(fs.readFileSync(filePath, 'utf-8')) as any;
    expect(parsed.mcp_servers?.sigma).toBeUndefined();
    expect(parsed.mcp_servers?.other?.command).toBe('other-mcp');
    expect((parsed.model as any)?.name).toBe('o3');
  });

  it('removes mcp_servers key entirely when sigma was the only entry', async () => {
    const { writeCodexMcpConfig, removeCodexMcpConfig } = await importMcpConfig();
    writeCodexMcpConfig();

    removeCodexMcpConfig();

    const parsed = parseTOML(fs.readFileSync(codexConfigPath(tmpHome), 'utf-8')) as any;
    expect(parsed.mcp_servers).toBeUndefined();
  });

  it('is idempotent (calling remove twice is safe)', async () => {
    const { writeCodexMcpConfig, removeCodexMcpConfig } = await importMcpConfig();
    writeCodexMcpConfig();
    removeCodexMcpConfig();
    expect(() => removeCodexMcpConfig()).not.toThrow();
  });
});

// ── removeAntigravityMcpConfig ────────────────────────────────────────────────

describe('removeAntigravityMcpConfig', () => {
  it('is no-op when file does not exist', async () => {
    const { removeAntigravityMcpConfig } = await importMcpConfig();
    expect(() => removeAntigravityMcpConfig()).not.toThrow();
    expect(fs.existsSync(antigravityConfigPath(tmpHome))).toBe(false);
  });

  it('is no-op when key sigma does not exist', async () => {
    const { removeAntigravityMcpConfig } = await importMcpConfig();
    const filePath = antigravityConfigPath(tmpHome);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeJsonSync(filePath, { mcpServers: { other: { command: 'other-mcp', args: [] } } });

    removeAntigravityMcpConfig();

    const content = fs.readJsonSync(filePath);
    expect(content.mcpServers?.other?.command).toBe('other-mcp');
    expect(content.mcpServers?.sigma).toBeUndefined();
  });

  it('removes sigma key and preserves other servers', async () => {
    const { writeAntigravityMcpConfig, removeAntigravityMcpConfig } = await importMcpConfig();
    const filePath = antigravityConfigPath(tmpHome);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeJsonSync(filePath, { mcpServers: { other: { command: 'other-mcp', args: [] } } });
    writeAntigravityMcpConfig();

    removeAntigravityMcpConfig();

    const content = fs.readJsonSync(filePath);
    expect(content.mcpServers?.sigma).toBeUndefined();
    expect(content.mcpServers?.other?.command).toBe('other-mcp');
  });

  it('removes mcpServers key entirely when sigma was the only entry', async () => {
    const { writeAntigravityMcpConfig, removeAntigravityMcpConfig } = await importMcpConfig();
    writeAntigravityMcpConfig();

    removeAntigravityMcpConfig();

    const content = fs.readJsonSync(antigravityConfigPath(tmpHome));
    expect(content.mcpServers).toBeUndefined();
  });

  it('is idempotent (calling remove twice is safe)', async () => {
    const { writeAntigravityMcpConfig, removeAntigravityMcpConfig } = await importMcpConfig();
    writeAntigravityMcpConfig();
    removeAntigravityMcpConfig();
    expect(() => removeAntigravityMcpConfig()).not.toThrow();
  });
});
