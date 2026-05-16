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
