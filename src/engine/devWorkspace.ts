import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { DEV_WORKSPACE_DIR, DEV_WORKSPACE_MARKER_FILE, PROJECT_IDENTITY_FILE } from '../config';
import { atomicReplaceFileSync } from '../utils/fs';

// The identity file holds the record; it is the switch. The marker inside the
// folder is derived from it and can be rebuilt. The folder name is fixed, so
// the recorded path is informational and never used to locate the folder.

export interface DevWorkspaceRecord {
  path: string;
  created_at: string;
}

export interface DevWorkspaceMarker {
  role: 'DEV';
  project_id: string;
  created_at: string;
}

export type DevWorkspaceState = 'INACTIVE' | 'ACTIVE' | 'ACTIVE_DEGRADED';

export type DevWorkspaceDegradedReason =
  | 'FOLDER_MISSING'
  | 'MARKER_MISSING'
  | 'MARKER_INVALID'
  | 'PROJECT_ID_MISMATCH';

export interface DevWorkspaceStatus {
  state: DevWorkspaceState;
  degradedReason: DevWorkspaceDegradedReason | null;
  /** True when no record exists but an entry named `dev` is present in the project root. */
  unregisteredFolder: boolean;
}

export class DevWorkspaceError extends Error {}

type IdentityObject = Record<string, unknown>;

// ── Identity access ────────────────────────────────────────────────────────

function identityPath(projectRoot: string): string {
  return path.join(projectRoot, PROJECT_IDENTITY_FILE);
}

function readIdentityObject(projectRoot: string): IdentityObject {
  const filePath = identityPath(projectRoot);
  if (!fs.existsSync(filePath)) {
    throw new DevWorkspaceError(`No Sigma project identity found at ${filePath}. Run: sigma project start`);
  }
  let parsed: unknown;
  try {
    parsed = fs.readJsonSync(filePath);
  } catch {
    throw new DevWorkspaceError(`Project identity at ${filePath} is not valid JSON. Run: sigma project register`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new DevWorkspaceError(`Project identity at ${filePath} is not a JSON object. Run: sigma project register`);
  }
  return parsed as IdentityObject;
}

function hasRecord(identity: IdentityObject): boolean {
  return identity.dev_workspace !== undefined && identity.dev_workspace !== null;
}

function recordCreatedAt(identity: IdentityObject): string | null {
  const record = identity.dev_workspace;
  if (record !== null && typeof record === 'object') {
    const createdAt = (record as Partial<DevWorkspaceRecord>).created_at;
    if (typeof createdAt === 'string') return createdAt;
  }
  return null;
}

/** Read-merge-write through a temporary file, so a failed write leaves the identity as it was. */
function writeIdentityMerged(projectRoot: string, patch: IdentityObject): void {
  const filePath = identityPath(projectRoot);
  const merged = { ...readIdentityObject(projectRoot), ...patch };
  const tmpPath = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.writeJsonSync(tmpPath, merged, { spaces: 2 });
    atomicReplaceFileSync(tmpPath, filePath);
  } catch (err) {
    fs.removeSync(tmpPath);
    throw err;
  }
}

// ── Folder and marker access ───────────────────────────────────────────────

function workspaceFolder(projectRoot: string): string {
  return path.join(projectRoot, DEV_WORKSPACE_DIR);
}

function markerPath(projectRoot: string): string {
  return path.join(workspaceFolder(projectRoot), DEV_WORKSPACE_MARKER_FILE);
}

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

/** Name of any root entry equal to `dev` ignoring case, so `Dev` is caught on every platform. */
function findEntryNamedDev(projectRoot: string): string | null {
  const match = fs.readdirSync(projectRoot).find(name => name.toLowerCase() === DEV_WORKSPACE_DIR);
  return match ?? null;
}

type MarkerReading =
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'ok'; marker: DevWorkspaceMarker };

function readMarker(projectRoot: string): MarkerReading {
  const filePath = markerPath(projectRoot);
  if (!fs.existsSync(filePath)) return { kind: 'missing' };
  try {
    const parsed: unknown = fs.readJsonSync(filePath);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { kind: 'invalid' };
    const marker = parsed as Partial<DevWorkspaceMarker>;
    if (marker.role !== 'DEV' || typeof marker.project_id !== 'string') return { kind: 'invalid' };
    return { kind: 'ok', marker: marker as DevWorkspaceMarker };
  } catch {
    return { kind: 'invalid' };
  }
}

// ── Status ─────────────────────────────────────────────────────────────────

export function getDevWorkspaceStatus(projectRoot: string): DevWorkspaceStatus {
  const identity = readIdentityObject(projectRoot);

  if (!hasRecord(identity)) {
    return { state: 'INACTIVE', degradedReason: null, unregisteredFolder: findEntryNamedDev(projectRoot) !== null };
  }

  const degraded = (degradedReason: DevWorkspaceDegradedReason): DevWorkspaceStatus => ({
    state: 'ACTIVE_DEGRADED',
    degradedReason,
    unregisteredFolder: false,
  });

  if (!isDirectory(workspaceFolder(projectRoot))) return degraded('FOLDER_MISSING');

  const reading = readMarker(projectRoot);
  if (reading.kind === 'missing') return degraded('MARKER_MISSING');
  if (reading.kind === 'invalid') return degraded('MARKER_INVALID');
  if (reading.marker.project_id !== identity.project_id) return degraded('PROJECT_ID_MISMATCH');

  return { state: 'ACTIVE', degradedReason: null, unregisteredFolder: false };
}

const DEGRADED_REASON_TEXT: Readonly<Record<DevWorkspaceDegradedReason, string>> = {
  FOLDER_MISSING: 'the folder dev/ is missing',
  MARKER_MISSING: 'the marker dev/.sigma-workspace.json is missing',
  MARKER_INVALID: 'the marker dev/.sigma-workspace.json is not valid',
  PROJECT_ID_MISMATCH: 'the marker belongs to a different project',
};

/** Message shown for a state, in the wording the DEV rules refer to. */
export function describeDevWorkspace(status: DevWorkspaceStatus): string[] {
  switch (status.state) {
    case 'INACTIVE': {
      const lines = ['No workspace restriction applies to DEV in this project. DEV works under the standard rules.'];
      if (status.unregisteredFolder) {
        lines.push('A folder `dev/` exists but is not a registered DEV workspace. It is treated as an ordinary project folder.');
      }
      return lines;
    }
    case 'ACTIVE':
      return [
        'DEV workspace is active. DEV may write only inside `<project_root>/dev/`. DEV may read other locations in this project. ' +
        'Exceptions: DEV writes the EXEC file and runs Sigma operations that write inside `Sigma/` (for example `sigma memo`, `sigma send`). ' +
        'Access outside the project requires explicit Director authorization.',
      ];
    case 'ACTIVE_DEGRADED': {
      const reason = status.degradedReason ? ` (${DEGRADED_REASON_TEXT[status.degradedReason]})` : '';
      return [
        `DEV workspace is registered, but \`dev/\` or its marker is missing or invalid${reason}. Restrictions still apply. ` +
        'Do not write outside `dev/`. Report this to the Director and ask for repair with `sigma doctor --repair-workspace`.',
      ];
    }
  }
}

// ── Create ─────────────────────────────────────────────────────────────────

/** File operations used by create, replaceable so a failure at each step can be exercised. */
export interface DevWorkspaceIo {
  makeFolder(folderPath: string): void;
  writeMarker(filePath: string, marker: DevWorkspaceMarker): void;
  writeRecord(projectRoot: string, record: DevWorkspaceRecord): void;
}

const DEFAULT_IO: DevWorkspaceIo = {
  makeFolder: folderPath => fs.mkdirSync(folderPath),
  writeMarker: (filePath, marker) => fs.writeJsonSync(filePath, marker, { spaces: 2, flag: 'wx' }),
  writeRecord: (projectRoot, record) => writeIdentityMerged(projectRoot, { dev_workspace: record }),
};

export interface CreateDevWorkspaceResult {
  record: DevWorkspaceRecord;
  marker: DevWorkspaceMarker;
}

export function createDevWorkspace(
  projectRoot: string,
  io: DevWorkspaceIo = DEFAULT_IO,
  now: Date = new Date(),
): CreateDevWorkspaceResult {
  const identity = readIdentityObject(projectRoot);

  if (hasRecord(identity)) {
    throw new DevWorkspaceError(
      'A DEV workspace is already registered for this project. Run `sigma dev status` to see its state, ' +
      'or `sigma doctor` to check it.'
    );
  }

  const existing = findEntryNamedDev(projectRoot);
  if (existing !== null) {
    throw new DevWorkspaceError(
      `An entry named "${existing}" already exists in the project root. ` +
      'To activate the workspace, the Director must rename or move that entry first.'
    );
  }

  const createdAt = now.toISOString();
  const record: DevWorkspaceRecord = { path: DEV_WORKSPACE_DIR, created_at: createdAt };
  const marker: DevWorkspaceMarker = {
    role: 'DEV',
    project_id: String(identity.project_id),
    created_at: createdAt,
  };

  const folder = workspaceFolder(projectRoot);
  let folderCreated = false;
  try {
    io.makeFolder(folder);
    folderCreated = true;
    io.writeMarker(markerPath(projectRoot), marker);
    // The record is written last: it is the switch, so it must not exist unless the rest does.
    io.writeRecord(projectRoot, record);
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    let rollbackFailure: string | null = null;
    if (folderCreated) {
      try {
        fs.removeSync(folder);
      } catch (rollbackErr) {
        rollbackFailure = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
      }
    }
    throw new DevWorkspaceError(
      rollbackFailure === null
        ? `Could not create the DEV workspace: ${cause}. Everything created by this operation was removed.`
        : `Could not create the DEV workspace: ${cause}. Removing dev/ also failed: ${rollbackFailure}. Remove dev/ manually before retrying.`
    );
  }

  return { record, marker };
}

// ── Repair ─────────────────────────────────────────────────────────────────

export interface RepairDevWorkspaceResult {
  before: DevWorkspaceStatus;
  after: DevWorkspaceStatus;
  actions: string[];
}

/**
 * Recreates a missing folder and a missing or invalid marker from the record.
 * Never touches the contents of dev/ beyond the marker, and never changes the record.
 */
export function repairDevWorkspace(projectRoot: string, now: Date = new Date()): RepairDevWorkspaceResult {
  const before = getDevWorkspaceStatus(projectRoot);
  const actions: string[] = [];

  if (before.state === 'ACTIVE_DEGRADED') {
    const identity = readIdentityObject(projectRoot);
    const folder = workspaceFolder(projectRoot);

    if (before.degradedReason === 'FOLDER_MISSING') {
      fs.mkdirSync(folder, { recursive: true });
      actions.push('Recreated the folder dev/ (empty).');
    }

    const marker: DevWorkspaceMarker = {
      role: 'DEV',
      project_id: String(identity.project_id),
      created_at: recordCreatedAt(identity) ?? now.toISOString(),
    };
    fs.writeJsonSync(markerPath(projectRoot), marker, { spaces: 2 });
    actions.push('Recreated the marker dev/.sigma-workspace.json from the record.');
  }

  return { before, after: getDevWorkspaceStatus(projectRoot), actions };
}
