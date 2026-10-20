// The machine a Sigma project was registered on, recorded in .sigma-identity.json
// (the one Sigma file kept in Git). Informational only: a guard decision never
// depends on it, because hostnames change and repeat across machines. Its job is
// to make the "missing Sigma files" block say where the project's Sigma state lives.

import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { PROJECT_IDENTITY_FILE } from '../config';
import { atomicReplaceFileSync } from '../utils/fs';

export interface OriginMachine {
  name: string;
  recorded_at: string;
}

export const MAX_MACHINE_NAME_LENGTH = 64;

export function currentMachineName(): string {
  return os.hostname().trim();
}

export function validateMachineName(raw: string): string {
  const name = raw.trim();
  if (name.length === 0 || name.length > MAX_MACHINE_NAME_LENGTH) {
    throw new Error(`Machine name must be between 1 and ${MAX_MACHINE_NAME_LENGTH} characters.`);
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(name)) throw new Error('Machine name cannot contain control characters or line breaks.');
  return name;
}

export function parseOriginMachine(value: unknown): OriginMachine | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Partial<OriginMachine>;
  if (typeof record.name !== 'string' || record.name.trim().length === 0) return null;
  return { name: record.name, recorded_at: typeof record.recorded_at === 'string' ? record.recorded_at : '' };
}

export function sameMachine(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Read-merge-write of `origin_machine`; every other identity field survives. Returns the previous record. */
export function writeOriginMachine(projectRoot: string, name: string, now: Date = new Date()): OriginMachine | null {
  const file = path.join(projectRoot, PROJECT_IDENTITY_FILE);
  if (!fs.existsSync(file)) throw new Error(`No Sigma project identity found at ${file}. Run: sigma project start`);
  let identity: Record<string, unknown>;
  try {
    const parsed: unknown = fs.readJsonSync(file);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    identity = parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${PROJECT_IDENTITY_FILE} is unreadable. Run: sigma project register`);
  }
  const previous = parseOriginMachine(identity.origin_machine);
  identity.origin_machine = { name: validateMachineName(name), recorded_at: now.toISOString() } satisfies OriginMachine;
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeJsonSync(tmp, identity, { spaces: 2 });
  atomicReplaceFileSync(tmp, file);
  return previous;
}
