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

export function writeGeminiMcpConfig(options: { homeDir?: string } = {}): void {
  const homeDir = options.homeDir ?? os.homedir();
  const settingsPath = path.join(homeDir, '.gemini', 'settings.json');
  const memoryFilePath = path.join(homeDir, '.sigma', 'memory_sigma.jsonl');

  let existing: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    try { existing = fs.readJsonSync(settingsPath); } catch { /* ignore parse errors; start fresh */ }
  }

  const sigmaServers: Record<string, McpServer> = {
    'sequential-thinking': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] },
    'sigma-memory': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], env: { MEMORY_FILE_PATH: memoryFilePath } },
  };

  const existingServers = (existing.mcpServers ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = {
    ...existing,
    mcpServers: { ...existingServers, ...sigmaServers },
  };

  fs.ensureDirSync(path.dirname(settingsPath));
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
}

// Merges sigma MCP servers into ~/.reasonix/config.json.
// Reasonix activates servers listed in the `mcp` array; `mcpServers` provides their full config.
// Both sections must be consistent for a server to work correctly.
export function writeReasonixMcpConfig(filePath: string, options: { homeDir?: string } = {}): void {
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(filePath)) {
    try { existing = fs.readJsonSync(filePath); } catch { /* ignore parse errors; start fresh */ }
  }

  const homeDir = options.homeDir ?? os.homedir();
  const memoryFilePath = path.join(homeDir, '.sigma', 'memory_sigma.jsonl');

  const sigmaServers: Record<string, McpServer> = {
    'sequential-thinking': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] },
    'sigma-memory': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], env: { MEMORY_FILE_PATH: memoryFilePath } },
  };

  // Rebuild mcp activation array:
  // - strip object-format entries (not valid in Reasonix mcp array)
  // - strip any `memory=...` inline shorthand that conflicts with sigma-memory
  // - ensure sigma server names are present as plain string activators
  const sigmaNames = new Set(Object.keys(sigmaServers));
  const existingMcp: string[] = Array.isArray(existing.mcp)
    ? (existing.mcp as unknown[]).filter((e): e is string => {
        if (typeof e !== 'string') return false;
        // drop inline shorthand entries that conflict with sigma-managed names
        // format: "name=command" or just "name"
        const entryName = e.split('=')[0].trim();
        return !sigmaNames.has(entryName) && entryName !== 'memory';
      })
    : [];

  const mcpArray = [...existingMcp, ...Object.keys(sigmaServers)];

  const existingServers = (existing.mcpServers ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = {
    ...existing,
    mcp: mcpArray,
    mcpServers: { ...existingServers, ...sigmaServers },
  };

  fs.ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
}
