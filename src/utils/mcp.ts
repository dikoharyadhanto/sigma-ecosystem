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

// Merges sigma MCP servers into ~/.reasonix/config.json under the mcpServers key.
// Uses plain npx (no cmd /c) — Reasonix handles OS differences itself.
// Also strips any object-format entries previously written to the mcp array by mistake.
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

  // Strip any object-format entries from the mcp array (added erroneously by earlier sigma versions).
  const existingMcp = Array.isArray(existing.mcp)
    ? (existing.mcp as unknown[]).filter(e => typeof e === 'string')
    : undefined;

  const existingServers = (existing.mcpServers ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = {
    ...existing,
    mcpServers: { ...existingServers, ...sigmaServers },
  };
  if (existingMcp !== undefined) merged.mcp = existingMcp;

  fs.ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
}
