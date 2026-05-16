import fs from 'fs-extra';
import os from 'os';
import path from 'path';

interface McpServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface McpJsonConfig {
  mcpServers: Record<string, McpServer>;
}

interface VscodeMcpConfig {
  servers: Record<string, McpServer>;
}

interface ReasonixMcpEntry {
  name: string;
  transport: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface ReasonixMcpConfig {
  mcp: ReasonixMcpEntry[];
}

function resolveMemoryFilePath(platform: NodeJS.Platform = process.platform, homeDir = os.homedir()): string {
  const pathApi = platform === 'win32' ? path.win32 : path.posix;
  return pathApi.join(homeDir, '.sigma', 'memory_sigma.jsonl');
}

function npxCommand(packageName: string, platform: NodeJS.Platform = process.platform): { command: string; args: string[] } {
  if (platform === 'win32') {
    return { command: 'cmd', args: ['/c', 'npx', '-y', packageName] };
  }
  return { command: 'npx', args: ['-y', packageName] };
}

export function createMcpConfig(options: { platform?: NodeJS.Platform; homeDir?: string } = {}): McpJsonConfig {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();

  return {
    mcpServers: {
      'sequential-thinking': npxCommand('@modelcontextprotocol/server-sequential-thinking', platform),
      'sigma-memory': {
        ...npxCommand('@modelcontextprotocol/server-memory', platform),
        env: { MEMORY_FILE_PATH: resolveMemoryFilePath(platform, homeDir) },
      },
    },
  };
}

export function createVscodeMcpConfig(options: { platform?: NodeJS.Platform; homeDir?: string } = {}): VscodeMcpConfig {
  const base = createMcpConfig(options);
  return { servers: base.mcpServers };
}

export function writeMcpJson(filePath: string, options: { platform?: NodeJS.Platform; homeDir?: string } = {}): void {
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(createMcpConfig(options), null, 2) + '\n', 'utf8');
}

export function writeVscodeMcpJson(filePath: string, options: { platform?: NodeJS.Platform; homeDir?: string } = {}): void {
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(createVscodeMcpConfig(options), null, 2) + '\n', 'utf8');
}

// Reasonix uses { "mcp": [...] } format; no OS-specific command wrapping — Reasonix handles that itself.
export function createReasonixMcpConfig(options: { platform?: NodeJS.Platform; homeDir?: string } = {}): ReasonixMcpConfig {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();

  return {
    mcp: [
      {
        name: 'sequential-thinking',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
      },
      {
        name: 'sigma-memory',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        env: { MEMORY_FILE_PATH: resolveMemoryFilePath(platform, homeDir) },
      },
    ],
  };
}

// Merges sigma entries into ~/.reasonix/config.json without clobbering other Reasonix settings.
export function writeReasonixMcpConfig(filePath: string, options: { platform?: NodeJS.Platform; homeDir?: string } = {}): void {
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(filePath)) {
    try { existing = fs.readJsonSync(filePath); } catch { /* ignore parse errors; overwrite with fresh config */ }
  }

  const sigmaEntries = createReasonixMcpConfig(options).mcp;
  const sigmaNames = new Set(sigmaEntries.map(e => e.name));

  // Filter both object-format ({ name, ... }) and string-format ("name=command args") duplicates.
  const existingMcp: unknown[] = Array.isArray(existing.mcp)
    ? (existing.mcp as unknown[]).filter(e => {
        if (typeof e === 'string') {
          return !Array.from(sigmaNames).some(n => (e as string).startsWith(n + '='));
        }
        if (typeof e === 'object' && e !== null && 'name' in e) {
          return !sigmaNames.has((e as ReasonixMcpEntry).name);
        }
        return true;
      })
    : [];

  const merged = { ...existing, mcp: [...existingMcp, ...sigmaEntries] };
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
}
