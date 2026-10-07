import fs from 'fs-extra';
import path from 'path';

export type VersioningScheme = 'legacy_offset' | 'intent_aligned';
export interface NumberedChain {
  versioning_scheme?: VersioningScheme;
  intent: { version: string };
}
export interface ChainMetadata {
  intent: string;
  versioning_scheme: VersioningScheme;
  plan?: string;
}

export function resolveVersioningScheme(chain: Pick<NumberedChain, 'versioning_scheme'>): VersioningScheme {
  const value = chain.versioning_scheme;
  if (value === undefined) return 'legacy_offset';
  if (value !== 'legacy_offset' && value !== 'intent_aligned') {
    throw new Error(`Unknown versioning_scheme: ${String(value)}. Restore chain identity before continuing.`);
  }
  return value;
}

export function planMajorForChain(chain: NumberedChain): number {
  const match = /^v(\d+)$/.exec(chain.intent.version);
  if (!match) throw new Error(`Invalid INTENT version: ${chain.intent.version}`);
  return Number(match[1]) - (resolveVersioningScheme(chain) === 'legacy_offset' ? 1 : 0);
}

export function parseChainMetadata(content: string): ChainMetadata | null {
  const starts = content.match(/<!--\s*SIGMA:CHAIN\b/g) ?? [];
  if (starts.length === 0) return null;
  if (starts.length !== 1) throw new Error('Duplicate SIGMA:CHAIN metadata.');
  const marker = /<!--\s*SIGMA:CHAIN\s+intent=(v\d+)\s+versioning_scheme=(legacy_offset|intent_aligned)(?:\s+plan=(v\d+\.\d+))?\s*-->/.exec(content);
  if (!marker) throw new Error('Malformed SIGMA:CHAIN metadata.');
  return { intent: marker[1], versioning_scheme: marker[2] as VersioningScheme, ...(marker[3] ? { plan: marker[3] } : {}) };
}

export function readChainMetadata(file: string, projectRoot?: string): ChainMetadata | null {
  if (projectRoot) {
    const relative = path.relative(fs.realpathSync(projectRoot), fs.realpathSync(file));
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('BOUNDARY_VIOLATION: chain metadata resolves outside the project.');
    }
  }
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error('BOUNDARY_VIOLATION: chain metadata path is not a regular file.');
  if (stat.size > 512 * 1024) throw new Error('PAYLOAD_TOO_LARGE: chain metadata exceeds the byte read limit.');
  return parseChainMetadata(fs.readFileSync(file, 'utf8'));
}

export function withChainMetadata(content: string, metadata: ChainMetadata): string {
  const existing = parseChainMetadata(content);
  if (existing) {
    if (existing.intent !== metadata.intent || existing.versioning_scheme !== metadata.versioning_scheme || existing.plan !== metadata.plan) {
      throw new Error('SIGMA:CHAIN metadata conflicts with the owning chain.');
    }
    return content;
  }
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const marker = `<!-- SIGMA:CHAIN intent=${metadata.intent} versioning_scheme=${metadata.versioning_scheme}${metadata.plan ? ` plan=${metadata.plan}` : ''} -->`;
  const firstEnd = content.indexOf('\n');
  if (firstEnd < 0) return content + newline + marker + newline;
  return content.slice(0, firstEnd + 1) + marker + newline + content.slice(firstEnd + 1);
}

export function writeChainMetadata(file: string, chain: NumberedChain, plan?: string): void {
  const content = withChainMetadata(fs.readFileSync(file, 'utf8'), {
    intent: chain.intent.version, versioning_scheme: resolveVersioningScheme(chain), ...(plan ? { plan } : {}),
  });
  fs.writeFileSync(file, content, 'utf8');
}
