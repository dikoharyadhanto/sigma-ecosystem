/**
 * mcp-config.test.ts — Unit tests untuk src/utils/mcpConfig.ts
 *
 * Cakupan:
 *   - writeClaudeMcpConfig     : merge-aware, idempoten, non-destruktif
 *   - writeOpencodeMcpConfig   : JSONC-aware (komentar/koma akhir), idempoten, tidak menimpa file rusak
 *   - removeOpencodeMcpConfig  : no-op kalau tidak ada, hapus key sigma saja
 *   - writeCodexMcpConfig      : merge-aware, idempoten, non-destruktif (TOML)
 *   - writeAntigravityMcpConfig: merge-aware, idempoten, non-destruktif
 *   - removeCodexMcpConfig     : no-op kalau tidak ada, merge-delete, idempoten
 *   - removeAntigravityMcpConfig: no-op kalau tidak ada, merge-delete, idempoten
 *   - writeReasonixMcpConfig   : merge-aware, idempoten, non-destruktif, preserves comments (TOML)
 *   - removeReasonixMcpConfig  : no-op kalau tidak ada, merge-delete, idempoten, preserves comments
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { parse as parseTOML } from 'smol-toml';
import { parse as parseJsonc } from 'jsonc-parser';
import { toPosix } from '../src/utils/fs';

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

function opencodeJsonPath(dir: string) {
  return path.join(dir, 'opencode.json');
}

function opencodeJsoncPath(dir: string) {
  return path.join(dir, 'opencode.jsonc');
}

function codexConfigPath(home: string) {
  return path.join(home, '.codex', 'config.toml');
}

function antigravityConfigPath(home: string) {
  return path.join(home, '.gemini', 'config', 'mcp_config.json');
}

function reasonixConfigPath(home: string) {
  return path.join(home, '.reasonix', 'config.toml');
}

function stubIdentity(root: string, id: string) {
  fs.writeJsonSync(path.join(root, '.sigma-identity.json'), {
    schema_version: '1.2.0', project_id: id, project_name: id,
    registered: true, logs_created_at: new Date().toISOString(),
  });
}

// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §7.1/§7.4 — the entry moved from a
// bare positional root to explicit binding flags. --project-id is appended
// only when the project actually has a readable .sigma-identity.json, so these
// fixtures (which write no identity file) exercise the bound-but-unverified
// form; the verified form is asserted separately below.
const expectedEntry = (root?: string, projectId?: string) => ({
  command: 'sigma-mcp',
  args: root
    ? projectId
      ? ['--mode', 'query', '--project-root', root, '--project-id', projectId]
      : ['--mode', 'query', '--project-root', root]
    : [],
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

// ── writeOpencodeMcpConfig / removeOpencodeMcpConfig (F16 U-04) ───────────────

describe('writeOpencodeMcpConfig', () => {
  const entryFor = (root: string, projectId?: string) => {
    const e = expectedEntry(root, projectId);
    return { type: 'local', command: [e.command, ...e.args], enabled: true };
  };

  it('creates opencode.json with $schema and a bound sigma entry when no config exists', async () => {
    const { writeOpencodeMcpConfig } = await importMcpConfig();
    writeOpencodeMcpConfig(tmpProject);

    expect(fs.existsSync(opencodeJsoncPath(tmpProject))).toBe(false);
    const content = fs.readJsonSync(opencodeJsonPath(tmpProject));
    expect(content.$schema).toBe('https://opencode.ai/config.json');
    expect(content.mcp.sigma).toEqual(entryFor(tmpProject));
    expect(content.mcp.sigma.command.slice(0, 3)).toEqual(['sigma-mcp', '--mode', 'query']);
  });

  it('binds the verified project id when .sigma-identity.json exists', async () => {
    const { writeOpencodeMcpConfig } = await importMcpConfig();
    stubIdentity(tmpProject, 'OCPROJ');
    writeOpencodeMcpConfig(tmpProject);

    const content = fs.readJsonSync(opencodeJsonPath(tmpProject));
    expect(content.mcp.sigma).toEqual(entryFor(tmpProject, 'OCPROJ'));
    expect(content.mcp.sigma.command).toContain('--project-id');
  });

  it('merges into an existing opencode.json without touching other keys or servers', async () => {
    const { writeOpencodeMcpConfig } = await importMcpConfig();
    fs.writeJsonSync(opencodeJsonPath(tmpProject), {
      theme: 'dark',
      mcp: { other: { type: 'local', command: ['other-mcp'], enabled: true } },
    });

    writeOpencodeMcpConfig(tmpProject);

    const content = fs.readJsonSync(opencodeJsonPath(tmpProject));
    expect(content.theme).toBe('dark');
    expect(content.mcp.other).toEqual({ type: 'local', command: ['other-mcp'], enabled: true });
    expect(content.mcp.sigma).toEqual(entryFor(tmpProject));
  });

  it('prefers opencode.jsonc when it exists and preserves its comments and trailing commas', async () => {
    const { writeOpencodeMcpConfig } = await importMcpConfig();
    const original = [
      '{',
      '  // my own settings',
      '  "$schema": "https://opencode.ai/config.json",',
      '  "theme": "dark", /* keep me */',
      '  "mcp": {',
      '    // another server',
      '    "other": { "type": "local", "command": ["other-mcp"], "enabled": true },',
      '  },',
      '}',
      '',
    ].join('\n');
    fs.writeFileSync(opencodeJsoncPath(tmpProject), original, 'utf-8');

    writeOpencodeMcpConfig(tmpProject);

    expect(fs.existsSync(opencodeJsonPath(tmpProject))).toBe(false);
    const text = fs.readFileSync(opencodeJsoncPath(tmpProject), 'utf-8');
    // Comments and the lines before the insertion point survive verbatim.
    expect(text).toContain('  // my own settings\n');
    expect(text).toContain('  "theme": "dark", /* keep me */\n');
    expect(text).toContain('    // another server\n');
    const parsed = parseJsonc(text, [], { allowTrailingComma: true });
    expect(parsed.mcp.other.command).toEqual(['other-mcp']);
    expect(parsed.mcp.sigma).toEqual(entryFor(tmpProject));
  });

  it('adds an mcp section to a commented config that has none', async () => {
    const { writeOpencodeMcpConfig } = await importMcpConfig();
    fs.writeFileSync(opencodeJsoncPath(tmpProject), '{\n  // only a comment\n  "theme": "dark"\n}\n', 'utf-8');

    writeOpencodeMcpConfig(tmpProject);

    const text = fs.readFileSync(opencodeJsoncPath(tmpProject), 'utf-8');
    expect(text).toContain('// only a comment');
    const parsed = parseJsonc(text, [], { allowTrailingComma: true });
    expect(parsed.theme).toBe('dark');
    expect(parsed.mcp.sigma).toEqual(entryFor(tmpProject));
  });

  it('keeps CRLF line endings and a BOM', async () => {
    const { writeOpencodeMcpConfig } = await importMcpConfig();
    fs.writeFileSync(
      opencodeJsoncPath(tmpProject),
      '﻿{\r\n  // crlf file\r\n  "theme": "dark"\r\n}\r\n',
      'utf-8',
    );

    writeOpencodeMcpConfig(tmpProject);

    const text = fs.readFileSync(opencodeJsoncPath(tmpProject), 'utf-8');
    expect(text.startsWith('﻿')).toBe(true);
    expect(text).not.toMatch(/[^\r]\n/);
    expect(text).toContain('// crlf file');
    expect(parseJsonc(text.slice(1), [], { allowTrailingComma: true }).mcp.sigma).toEqual(entryFor(tmpProject));
  });

  it('is idempotent: a second call leaves the file byte-identical', async () => {
    const { writeOpencodeMcpConfig } = await importMcpConfig();
    fs.writeFileSync(opencodeJsoncPath(tmpProject), '{\n  // c\n  "theme": "dark",\n}\n', 'utf-8');

    writeOpencodeMcpConfig(tmpProject);
    const first = fs.readFileSync(opencodeJsoncPath(tmpProject), 'utf-8');
    writeOpencodeMcpConfig(tmpProject);
    const second = fs.readFileSync(opencodeJsoncPath(tmpProject), 'utf-8');

    expect(second).toBe(first);
  });

  it('replaces a stale sigma entry (e.g. after the project moved)', async () => {
    const { writeOpencodeMcpConfig } = await importMcpConfig();
    fs.writeJsonSync(opencodeJsonPath(tmpProject), {
      mcp: { sigma: { type: 'local', command: ['sigma-mcp', '/old/root'], enabled: true } },
    });

    writeOpencodeMcpConfig(tmpProject);

    expect(fs.readJsonSync(opencodeJsonPath(tmpProject)).mcp.sigma).toEqual(entryFor(tmpProject));
  });

  it('replaces a non-object mcp value', async () => {
    const { writeOpencodeMcpConfig } = await importMcpConfig();
    fs.writeJsonSync(opencodeJsonPath(tmpProject), { mcp: 'invalid' });

    writeOpencodeMcpConfig(tmpProject);

    expect(fs.readJsonSync(opencodeJsonPath(tmpProject)).mcp.sigma).toEqual(entryFor(tmpProject));
  });

  it('never overwrites a file it cannot parse; the error carries the snippet to add by hand', async () => {
    const { writeOpencodeMcpConfig, tryMcpOp } = await importMcpConfig();
    const broken = '{ "theme": "dark", "mcp": { ';
    fs.writeFileSync(opencodeJsonPath(tmpProject), broken, 'utf-8');

    const err = tryMcpOp(() => writeOpencodeMcpConfig(tmpProject), 'opencode.json');

    expect(fs.readFileSync(opencodeJsonPath(tmpProject), 'utf-8')).toBe(broken);
    expect(fs.readdirSync(tmpProject).some((f) => f.endsWith('.sigma_tmp'))).toBe(false);
    expect(err).toContain('left unchanged');
    expect(err).toContain('"sigma-mcp"');
    expect(err).not.toContain('locked by another process');
  });

  it('treats a top-level array as unparseable and leaves it alone', async () => {
    const { writeOpencodeMcpConfig, tryMcpOp } = await importMcpConfig();
    fs.writeFileSync(opencodeJsonPath(tmpProject), '[1, 2]', 'utf-8');

    const err = tryMcpOp(() => writeOpencodeMcpConfig(tmpProject), 'opencode.json');

    expect(err).toContain('left unchanged');
    expect(fs.readFileSync(opencodeJsonPath(tmpProject), 'utf-8')).toBe('[1, 2]');
  });

  it('treats an empty file as an empty object', async () => {
    const { writeOpencodeMcpConfig } = await importMcpConfig();
    fs.writeFileSync(opencodeJsonPath(tmpProject), '', 'utf-8');

    writeOpencodeMcpConfig(tmpProject);

    expect(fs.readJsonSync(opencodeJsonPath(tmpProject)).mcp.sigma).toEqual(entryFor(tmpProject));
  });
});

describe('removeOpencodeMcpConfig', () => {
  it('is a no-op when no config exists', async () => {
    const { removeOpencodeMcpConfig } = await importMcpConfig();
    expect(() => removeOpencodeMcpConfig(tmpProject)).not.toThrow();
    expect(fs.readdirSync(tmpProject)).toEqual([]);
  });

  it('is a no-op when there is no sigma key', async () => {
    const { removeOpencodeMcpConfig } = await importMcpConfig();
    const original = '{\n  // keep\n  "mcp": { "other": { "type": "local", "command": ["x"] } }\n}\n';
    fs.writeFileSync(opencodeJsoncPath(tmpProject), original, 'utf-8');

    removeOpencodeMcpConfig(tmpProject);

    expect(fs.readFileSync(opencodeJsoncPath(tmpProject), 'utf-8')).toBe(original);
  });

  it('removes only the sigma key and keeps other servers and comments', async () => {
    const { writeOpencodeMcpConfig, removeOpencodeMcpConfig } = await importMcpConfig();
    fs.writeFileSync(
      opencodeJsoncPath(tmpProject),
      '{\n  // keep\n  "mcp": {\n    "other": { "type": "local", "command": ["x"] }\n  }\n}\n',
      'utf-8',
    );
    writeOpencodeMcpConfig(tmpProject);

    removeOpencodeMcpConfig(tmpProject);

    const text = fs.readFileSync(opencodeJsoncPath(tmpProject), 'utf-8');
    expect(text).toContain('// keep');
    const parsed = parseJsonc(text, [], { allowTrailingComma: true });
    expect(parsed.mcp.sigma).toBeUndefined();
    expect(parsed.mcp.other.command).toEqual(['x']);
  });

  it('drops the empty mcp object when sigma was its only entry, and is idempotent', async () => {
    const { writeOpencodeMcpConfig, removeOpencodeMcpConfig } = await importMcpConfig();
    fs.writeJsonSync(opencodeJsonPath(tmpProject), { theme: 'dark' });
    writeOpencodeMcpConfig(tmpProject);

    removeOpencodeMcpConfig(tmpProject);
    removeOpencodeMcpConfig(tmpProject);

    expect(fs.readJsonSync(opencodeJsonPath(tmpProject))).toEqual({ theme: 'dark' });
  });

  it('does not touch a file it cannot parse', async () => {
    const { removeOpencodeMcpConfig, tryMcpOp } = await importMcpConfig();
    const broken = '{ "mcp": ';
    fs.writeFileSync(opencodeJsonPath(tmpProject), broken, 'utf-8');

    const err = tryMcpOp(() => removeOpencodeMcpConfig(tmpProject), 'opencode.json');

    expect(err).toContain('left unchanged');
    expect(fs.readFileSync(opencodeJsonPath(tmpProject), 'utf-8')).toBe(broken);
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
    expect(parsed.mcp_servers?.sigma?.args).toEqual(expectedEntry(tmpProject).args);
  });

  it('merges sigma without touching other Codex settings', async () => {
    const { writeCodexMcpConfig } = await importMcpConfig();
    const filePath = codexConfigPath(tmpHome);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, `[model]\nname = "o3"\n\n[mcp_servers.other]\ncommand = "other-mcp"\nargs = []\n`, 'utf-8');

    writeCodexMcpConfig(tmpProject);

    const parsed = parseTOML(fs.readFileSync(filePath, 'utf-8')) as any;
    expect(parsed.mcp_servers?.sigma?.command).toBe('sigma-mcp');
    expect(parsed.mcp_servers?.sigma?.args).toEqual(expectedEntry(tmpProject).args);
    expect(parsed.mcp_servers?.other?.command).toBe('other-mcp');
    expect((parsed.model as any)?.name).toBe('o3');
  });

  it('is idempotent', async () => {
    const { writeCodexMcpConfig } = await importMcpConfig();
    writeCodexMcpConfig(tmpProject);
    writeCodexMcpConfig(tmpProject);

    const parsed = parseTOML(fs.readFileSync(codexConfigPath(tmpHome), 'utf-8')) as any;
    expect(parsed.mcp_servers?.sigma?.command).toBe('sigma-mcp');
    expect(parsed.mcp_servers?.sigma?.args).toEqual(expectedEntry(tmpProject).args);
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

// ── writeReasonixMcpConfig ────────────────────────────────────────────────────
//
// Beda dari Codex: config.toml Reasonix bisa berisi komentar dokumentasi yang
// HARUS dipertahankan (smol-toml full parse+stringify membuangnya). Test di
// sini secara eksplisit memverifikasi pelestarian komentar, bukan cuma isi
// yang di-parse.

describe('writeReasonixMcpConfig', () => {
  it('creates ~/.reasonix/config.toml with [[plugins]] sigma entry when file does not exist', async () => {
    const { writeReasonixMcpConfig } = await importMcpConfig();
    writeReasonixMcpConfig(tmpProject);

    const filePath = reasonixConfigPath(tmpHome);
    expect(fs.existsSync(filePath)).toBe(true);
    const parsed = parseTOML(fs.readFileSync(filePath, 'utf-8')) as any;
    const sigma = (parsed.plugins as any[]).find((p) => p.name === 'sigma');
    expect(sigma.command).toBe('sigma-mcp');
    // Reasonix path is normalized to forward slashes on write (a raw Windows
    // path breaks TOML parsing — `\U` is an invalid unicode escape).
    expect(sigma.args).toEqual(expectedEntry(toPosix(tmpProject)).args);
  });

  it('merges sigma without touching other plugins or settings', async () => {
    const { writeReasonixMcpConfig } = await importMcpConfig();
    const filePath = reasonixConfigPath(tmpHome);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(
      filePath,
      `config_version = 7\n\n[[plugins]]\nname    = "shell"\ncommand = "npx"\nargs    = ["-y", "mcp-shell"]\n`,
      'utf-8',
    );

    writeReasonixMcpConfig(tmpProject);

    const parsed = parseTOML(fs.readFileSync(filePath, 'utf-8')) as any;
    const plugins = parsed.plugins as any[];
    expect(plugins.find((p) => p.name === 'sigma')?.command).toBe('sigma-mcp');
    expect(plugins.find((p) => p.name === 'sigma')?.args).toEqual(expectedEntry(toPosix(tmpProject)).args);
    expect(plugins.find((p) => p.name === 'shell')?.command).toBe('npx');
    expect((parsed as any).config_version).toBe(7);
  });

  it('preserves comments elsewhere in the file (does not round-trip through smol-toml)', async () => {
    const { writeReasonixMcpConfig } = await importMcpConfig();
    const filePath = reasonixConfigPath(tmpHome);
    fs.ensureDirSync(path.dirname(filePath));
    const original = `# Reasonix configuration.\n# Resolution order: flag > ./reasonix.toml > ~/.reasonix/config.toml > built-in defaults.\n\nconfig_version = 7   # schema marker\n\n[[plugins]]\nname    = "shell"   # inline comment\ncommand = "npx"\nargs    = ["-y", "mcp-shell"]\n`;
    fs.writeFileSync(filePath, original, 'utf-8');

    writeReasonixMcpConfig(tmpProject);

    const result = fs.readFileSync(filePath, 'utf-8');
    expect(result).toContain('# Reasonix configuration.');
    expect(result).toContain('# Resolution order: flag > ./reasonix.toml > ~/.reasonix/config.toml > built-in defaults.');
    expect(result).toContain('config_version = 7   # schema marker');
    expect(result).toContain('name    = "shell"   # inline comment');
  });

  it('does not touch an existing "sigma-memory" plugin (exact name match, not prefix)', async () => {
    const { writeReasonixMcpConfig } = await importMcpConfig();
    const filePath = reasonixConfigPath(tmpHome);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(
      filePath,
      `[[plugins]]\nname    = "sigma-memory"\ncommand = "npx"\nargs    = ["-y", "@modelcontextprotocol/server-memory"]\n`,
      'utf-8',
    );

    writeReasonixMcpConfig(tmpProject);

    const parsed = parseTOML(fs.readFileSync(filePath, 'utf-8')) as any;
    const plugins = parsed.plugins as any[];
    expect(plugins.find((p) => p.name === 'sigma-memory')?.command).toBe('npx');
    expect(plugins.find((p) => p.name === 'sigma')?.command).toBe('sigma-mcp');
    expect(plugins).toHaveLength(2);
  });

  it('is idempotent (calling twice produces the same plugins list)', async () => {
    const { writeReasonixMcpConfig } = await importMcpConfig();
    writeReasonixMcpConfig(tmpProject);
    writeReasonixMcpConfig(tmpProject);

    const parsed = parseTOML(fs.readFileSync(reasonixConfigPath(tmpHome), 'utf-8')) as any;
    const plugins = parsed.plugins as any[];
    expect(plugins.filter((p) => p.name === 'sigma')).toHaveLength(1);
    expect(plugins.find((p) => p.name === 'sigma')?.args).toEqual(expectedEntry(toPosix(tmpProject)).args);
  });

  it('writes empty args when no projectRoot is given', async () => {
    const { writeReasonixMcpConfig } = await importMcpConfig();
    writeReasonixMcpConfig();

    const parsed = parseTOML(fs.readFileSync(reasonixConfigPath(tmpHome), 'utf-8')) as any;
    const sigma = (parsed.plugins as any[]).find((p) => p.name === 'sigma');
    expect(sigma.args).toEqual([]);
  });
});

// ── removeReasonixMcpConfig ───────────────────────────────────────────────────

describe('removeReasonixMcpConfig', () => {
  it('is no-op when file does not exist', async () => {
    const { removeReasonixMcpConfig } = await importMcpConfig();
    expect(() => removeReasonixMcpConfig()).not.toThrow();
    expect(fs.existsSync(reasonixConfigPath(tmpHome))).toBe(false);
  });

  it('is no-op when the sigma plugin does not exist', async () => {
    const { removeReasonixMcpConfig } = await importMcpConfig();
    const filePath = reasonixConfigPath(tmpHome);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, `[[plugins]]\nname    = "shell"\ncommand = "npx"\nargs    = ["-y", "mcp-shell"]\n`, 'utf-8');

    removeReasonixMcpConfig();

    const parsed = parseTOML(fs.readFileSync(filePath, 'utf-8')) as any;
    const plugins = parsed.plugins as any[];
    expect(plugins.find((p) => p.name === 'shell')?.command).toBe('npx');
    expect(plugins.find((p) => p.name === 'sigma')).toBeUndefined();
  });

  it('removes only the sigma plugin, preserving other plugins and comments', async () => {
    const { writeReasonixMcpConfig, removeReasonixMcpConfig } = await importMcpConfig();
    const filePath = reasonixConfigPath(tmpHome);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(
      filePath,
      `# top-level doc comment\nconfig_version = 7\n\n[[plugins]]\nname    = "shell"   # inline comment\ncommand = "npx"\nargs    = ["-y", "mcp-shell"]\n`,
      'utf-8',
    );
    writeReasonixMcpConfig(tmpProject);

    removeReasonixMcpConfig();

    const result = fs.readFileSync(filePath, 'utf-8');
    expect(result).toContain('# top-level doc comment');
    expect(result).toContain('name    = "shell"   # inline comment');
    const parsed = parseTOML(result) as any;
    const plugins = parsed.plugins as any[];
    expect(plugins.find((p) => p.name === 'sigma')).toBeUndefined();
    expect(plugins.find((p) => p.name === 'shell')?.command).toBe('npx');
  });

  it('does not touch an existing "sigma-memory" plugin when removing "sigma"', async () => {
    const { writeReasonixMcpConfig, removeReasonixMcpConfig } = await importMcpConfig();
    const filePath = reasonixConfigPath(tmpHome);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(
      filePath,
      `[[plugins]]\nname    = "sigma-memory"\ncommand = "npx"\nargs    = ["-y", "@modelcontextprotocol/server-memory"]\n`,
      'utf-8',
    );
    writeReasonixMcpConfig(tmpProject);

    removeReasonixMcpConfig();

    const parsed = parseTOML(fs.readFileSync(filePath, 'utf-8')) as any;
    const plugins = parsed.plugins as any[];
    expect(plugins.find((p) => p.name === 'sigma-memory')?.command).toBe('npx');
    expect(plugins.find((p) => p.name === 'sigma')).toBeUndefined();
  });

  it('is idempotent (calling remove twice is safe)', async () => {
    const { writeReasonixMcpConfig, removeReasonixMcpConfig } = await importMcpConfig();
    writeReasonixMcpConfig();
    removeReasonixMcpConfig();
    expect(() => removeReasonixMcpConfig()).not.toThrow();
  });
});

// ── Binding migration (reviewer finding R-07) ────────────────────────────────

describe('binding flags reach every client writer', () => {
  it('Reasonix gets the same verified-binding args as every other client', async () => {
    const { writeReasonixMcpConfig } = await importMcpConfig();
    stubIdentity(tmpProject, 'REASONIXPROJ');

    writeReasonixMcpConfig(tmpProject);

    const parsed = parseTOML(fs.readFileSync(reasonixConfigPath(tmpHome), 'utf-8')) as any;
    const sigma = (parsed.plugins as any[]).find((p) => p.name === 'sigma');
    // Reasonix used to build its own positional list and so could never reach
    // binding_verified:true, no matter how often `project sync` ran.
    expect(sigma.args).toEqual(expectedEntry(toPosix(tmpProject), 'REASONIXPROJ').args);
    expect(sigma.args).toContain('--project-id');
  });

  it('every writer agrees on the argument list for the same project', async () => {
    const m = await importMcpConfig();
    stubIdentity(tmpProject, 'SAMEPROJ');

    m.writeClaudeMcpConfig(tmpProject);
    m.writeOpencodeMcpConfig(tmpProject);
    m.writeReasonixMcpConfig(tmpProject);

    const claude = fs.readJsonSync(mcpJsonPath(tmpProject)).mcpServers.sigma.args;
    const opencode = fs.readJsonSync(opencodeJsonPath(tmpProject)).mcp.sigma.command.slice(1);
    const reasonix = ((parseTOML(fs.readFileSync(reasonixConfigPath(tmpHome), 'utf-8')) as any).plugins as any[])
      .find((p) => p.name === 'sigma').args;

    expect(claude).toEqual(opencode);
    // Reasonix normalises to posix; compare on that basis, not on separators.
    expect(reasonix).toEqual(expectedEntry(toPosix(tmpProject), 'SAMEPROJ').args);
    expect(claude).toContain('--project-id');
  });
});
