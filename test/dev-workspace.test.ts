import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {
  createDevWorkspace,
  describeDevWorkspace,
  getDevWorkspaceStatus,
  repairDevWorkspace,
  DevWorkspaceError,
  DevWorkspaceIo,
} from '../src/engine/devWorkspace';
import { runCli, setupTestEnv, TestEnv } from './helpers';

// DEV workspace boundary (F13): `dev/` as the DEV write area, registered by a
// record in the project identity (the switch) and a marker inside the folder.

const IDENTITY = '.sigma-identity.json';
const MARKER = path.join('dev', '.sigma-workspace.json');

function writeIdentity(root: string, extra: Record<string, unknown> = {}): void {
  fs.writeJsonSync(
    path.join(root, IDENTITY),
    {
      schema_version: '1.2.0',
      project_id: 'TEST',
      project_name: 'Test Project',
      registered: true,
      logs_created_at: '2026-01-01T00:00:00.000Z',
      ...extra,
    },
    { spaces: 2 },
  );
}

function readIdentity(root: string): Record<string, unknown> {
  return fs.readJsonSync(path.join(root, IDENTITY));
}

function rawIdentity(root: string): string {
  return fs.readFileSync(path.join(root, IDENTITY), 'utf8');
}

/** Every file under root with its size and mtime, so a "writes nothing" claim can be checked. */
function snapshot(root: string, skip: string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (skip.includes(rel)) continue;
      const stat = fs.lstatSync(full);
      out[rel] = stat.isDirectory() ? 'dir' : `${stat.size}:${stat.mtimeMs}`;
      if (stat.isDirectory()) walk(full);
    }
  };
  walk(root);
  return out;
}

describe('DEV workspace — engine', () => {
  const dirs: string[] = [];

  function project(extra: Record<string, unknown> = {}): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-devws-'));
    dirs.push(root);
    writeIdentity(root, extra);
    return root;
  }

  afterEach(() => {
    while (dirs.length > 0) {
      const dir = dirs.pop();
      if (dir) fs.removeSync(dir);
    }
  });

  describe('create', () => {
    it('creates the folder, the marker, and the record, and keeps the other identity fields', () => {
      const root = project({ future_field: { keep: true } });

      const { record, marker } = createDevWorkspace(root);

      expect(fs.statSync(path.join(root, 'dev')).isDirectory()).toBe(true);
      expect(fs.readdirSync(path.join(root, 'dev'))).toEqual(['.sigma-workspace.json']);
      expect(fs.readJsonSync(path.join(root, MARKER))).toEqual({
        role: 'DEV',
        project_id: 'TEST',
        created_at: record.created_at,
      });
      expect(marker.project_id).toBe('TEST');

      const identity = readIdentity(root);
      expect(identity.dev_workspace).toEqual({ path: 'dev', created_at: record.created_at });
      expect(identity.future_field).toEqual({ keep: true });
      expect(identity.project_id).toBe('TEST');
      expect(getDevWorkspaceStatus(root).state).toBe('ACTIVE');
    });

    it('leaves no temporary file behind', () => {
      const root = project();
      createDevWorkspace(root);

      expect(fs.readdirSync(root).filter(name => name.includes('.tmp-'))).toEqual([]);
    });

    describe('refuses when an entry named dev exists', () => {
      const cases: Array<[string, (root: string) => void]> = [
        ['an empty folder', root => fs.mkdirSync(path.join(root, 'dev'))],
        ['a folder with a marker', root => {
          fs.mkdirSync(path.join(root, 'dev'));
          fs.writeJsonSync(path.join(root, MARKER), { role: 'DEV', project_id: 'TEST', created_at: 'x' });
        }],
        ['a plain file', root => fs.writeFileSync(path.join(root, 'dev'), 'not a folder')],
        ['a folder named Dev', root => fs.mkdirSync(path.join(root, 'Dev'))],
      ];

      for (const [label, arrange] of cases) {
        it(label, () => {
          const root = project();
          arrange(root);
          const before = rawIdentity(root);
          const treeBefore = snapshot(root);

          expect(() => createDevWorkspace(root)).toThrow(/rename or move that entry/);

          expect(rawIdentity(root)).toBe(before);
          expect(snapshot(root)).toEqual(treeBefore);
        });
      }

      it('a symbolic link', () => {
        const root = project();
        const target = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-devws-target-'));
        dirs.push(target);
        try {
          fs.symlinkSync(target, path.join(root, 'dev'), 'junction');
        } catch {
          return; // the platform or account may not allow links
        }

        expect(() => createDevWorkspace(root)).toThrow(/rename or move that entry/);
        expect(readIdentity(root).dev_workspace).toBeUndefined();
      });
    });

    it('refuses when a record already exists and reports it as registered', () => {
      const root = project();
      createDevWorkspace(root);
      const before = rawIdentity(root);

      expect(() => createDevWorkspace(root)).toThrow(/already registered/);
      expect(rawIdentity(root)).toBe(before);
    });

    it('refuses without a project identity', () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-devws-'));
      dirs.push(root);

      expect(() => createDevWorkspace(root)).toThrow(DevWorkspaceError);
      expect(fs.existsSync(path.join(root, 'dev'))).toBe(false);
    });

    describe('removes what it created when a step fails', () => {
      const realFolder = (folder: string): void => fs.mkdirSync(folder);
      const realMarker = (file: string, marker: object): void => fs.writeJsonSync(file, marker);
      const boom = (): never => {
        throw new Error('disk full');
      };

      it('when the folder cannot be created', () => {
        const root = project();
        const before = rawIdentity(root);
        const io: DevWorkspaceIo = { makeFolder: boom, writeMarker: realMarker, writeRecord: boom };

        expect(() => createDevWorkspace(root, io)).toThrow(/disk full/);

        expect(fs.existsSync(path.join(root, 'dev'))).toBe(false);
        expect(rawIdentity(root)).toBe(before);
      });

      it('when the marker cannot be written', () => {
        const root = project();
        const before = rawIdentity(root);
        const io: DevWorkspaceIo = { makeFolder: realFolder, writeMarker: boom, writeRecord: boom };

        expect(() => createDevWorkspace(root, io)).toThrow(/Everything created by this operation was removed/);

        expect(fs.existsSync(path.join(root, 'dev'))).toBe(false);
        expect(rawIdentity(root)).toBe(before);
      });

      it('when the record cannot be written', () => {
        const root = project();
        const before = rawIdentity(root);
        const io: DevWorkspaceIo = { makeFolder: realFolder, writeMarker: realMarker, writeRecord: boom };

        expect(() => createDevWorkspace(root, io)).toThrow(/disk full/);

        expect(fs.existsSync(path.join(root, 'dev'))).toBe(false);
        expect(rawIdentity(root)).toBe(before);
        expect(getDevWorkspaceStatus(root).state).toBe('INACTIVE');
      });
    });
  });

  describe('status', () => {
    it('INACTIVE without a record, and says so when an unregistered dev folder exists', () => {
      const root = project();
      expect(getDevWorkspaceStatus(root)).toEqual({ state: 'INACTIVE', degradedReason: null, unregisteredFolder: false });

      fs.mkdirSync(path.join(root, 'dev'));
      expect(getDevWorkspaceStatus(root)).toEqual({ state: 'INACTIVE', degradedReason: null, unregisteredFolder: true });
      expect(describeDevWorkspace(getDevWorkspaceStatus(root)).join(' ')).toMatch(/not a registered DEV workspace/);
    });

    it('INACTIVE even when a valid marker sits in an unregistered folder', () => {
      const root = project();
      fs.mkdirSync(path.join(root, 'dev'));
      fs.writeJsonSync(path.join(root, MARKER), { role: 'DEV', project_id: 'TEST', created_at: 'x' });

      expect(getDevWorkspaceStatus(root).state).toBe('INACTIVE');
    });

    it('ACTIVE with a record, the folder, and a matching marker', () => {
      const root = project();
      createDevWorkspace(root);

      expect(getDevWorkspaceStatus(root)).toEqual({ state: 'ACTIVE', degradedReason: null, unregisteredFolder: false });
    });

    const degraded: Array<[string, string, (root: string) => void]> = [
      ['the folder is missing', 'FOLDER_MISSING', root => fs.removeSync(path.join(root, 'dev'))],
      ['the marker is missing', 'MARKER_MISSING', root => fs.removeSync(path.join(root, MARKER))],
      ['the marker is not JSON', 'MARKER_INVALID', root => fs.writeFileSync(path.join(root, MARKER), '{not json')],
      ['the marker has another role', 'MARKER_INVALID', root => fs.writeJsonSync(path.join(root, MARKER), { role: 'FMN', project_id: 'TEST' })],
      ['the marker belongs to another project', 'PROJECT_ID_MISMATCH', root => fs.writeJsonSync(path.join(root, MARKER), { role: 'DEV', project_id: 'OTHER', created_at: 'x' })],
    ];

    for (const [label, reason, damage] of degraded) {
      it(`ACTIVE_DEGRADED when ${label}`, () => {
        const root = project();
        createDevWorkspace(root);
        damage(root);

        const status = getDevWorkspaceStatus(root);

        expect(status.state).toBe('ACTIVE_DEGRADED');
        expect(status.degradedReason).toBe(reason);
        expect(describeDevWorkspace(status).join(' ')).toMatch(/sigma doctor --repair-workspace/);
      });
    }

    it('writes nothing', () => {
      const root = project();
      createDevWorkspace(root);
      fs.removeSync(path.join(root, MARKER));
      const before = snapshot(root);
      const identity = rawIdentity(root);

      getDevWorkspaceStatus(root);

      expect(snapshot(root)).toEqual(before);
      expect(rawIdentity(root)).toBe(identity);
    });

    it('the active message names the write area and the exceptions', () => {
      const root = project();
      createDevWorkspace(root);

      const text = describeDevWorkspace(getDevWorkspaceStatus(root)).join(' ');

      expect(text).toMatch(/may write only inside `<project_root>\/dev\/`/);
      expect(text).toMatch(/EXEC file/);
      expect(text).toMatch(/Access outside the project requires explicit Director authorization/);
    });
  });

  describe('repair', () => {
    it('recreates a missing folder as an empty folder with a marker, and keeps the record', () => {
      const root = project();
      createDevWorkspace(root);
      fs.removeSync(path.join(root, 'dev'));
      const identity = rawIdentity(root);

      const result = repairDevWorkspace(root);

      expect(result.before.degradedReason).toBe('FOLDER_MISSING');
      expect(result.after.state).toBe('ACTIVE');
      expect(result.actions.length).toBe(2);
      expect(fs.readdirSync(path.join(root, 'dev'))).toEqual(['.sigma-workspace.json']);
      expect(rawIdentity(root)).toBe(identity);
    });

    it('recreates a missing marker without touching the work inside dev/', () => {
      const root = project();
      createDevWorkspace(root);
      fs.ensureDirSync(path.join(root, 'dev', 'src'));
      fs.writeFileSync(path.join(root, 'dev', 'src', 'a.txt'), 'work in progress');
      fs.removeSync(path.join(root, MARKER));
      const created = (readIdentity(root).dev_workspace as { created_at: string }).created_at;

      const result = repairDevWorkspace(root);

      expect(result.after.state).toBe('ACTIVE');
      expect(fs.readFileSync(path.join(root, 'dev', 'src', 'a.txt'), 'utf8')).toBe('work in progress');
      expect(fs.readJsonSync(path.join(root, MARKER)).created_at).toBe(created);
    });

    it('replaces a marker that belongs to another project', () => {
      const root = project();
      createDevWorkspace(root);
      fs.writeJsonSync(path.join(root, MARKER), { role: 'DEV', project_id: 'OTHER', created_at: 'x' });

      const result = repairDevWorkspace(root);

      expect(result.after.state).toBe('ACTIVE');
      expect(fs.readJsonSync(path.join(root, MARKER)).project_id).toBe('TEST');
    });

    it('does nothing when the workspace is active or not registered', () => {
      const inactive = project();
      expect(repairDevWorkspace(inactive).actions).toEqual([]);
      expect(fs.existsSync(path.join(inactive, 'dev'))).toBe(false);

      const active = project();
      createDevWorkspace(active);
      const before = snapshot(active);

      expect(repairDevWorkspace(active).actions).toEqual([]);
      expect(snapshot(active)).toEqual(before);
    });
  });
});

describe('DEV workspace — CLI', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  /** A real project, created the way a user would. */
  function realProject(): TestEnv {
    const e = setupTestEnv();
    fs.removeSync(e.sigmaDir); // setupTestEnv() pre-creates folders; start from nothing
    const started = runCli('project start --id TEST --name "Test Project" --confirm', e.projectDir, e.homeDir);
    expect(started.exitCode).toBe(0);
    return e;
  }

  const operationsLog = 'Sigma/logs/operations.jsonl';

  it('create-workspace activates the workspace and status reports it', () => {
    env = realProject();

    const created = runCli('dev create-workspace', env.projectDir, env.homeDir);
    expect(created.exitCode).toBe(0);
    expect(created.stdout).toMatch(/DEV workspace created: dev\//);
    expect(created.stdout).toMatch(/outside Sigma\//);
    expect(created.stdout).toMatch(/DEV workspace: ACTIVE/);

    const status = runCli('dev status', env.projectDir, env.homeDir);
    expect(status.exitCode).toBe(0);
    expect(status.stdout).toMatch(/DEV workspace: ACTIVE/);
    expect(fs.readJsonSync(path.join(env.projectDir, MARKER)).project_id).toBe('TEST');
  });

  it('status is INACTIVE in a project without a record and writes nothing', () => {
    env = realProject();
    const before = snapshot(env.projectDir, [operationsLog]);

    const status = runCli('dev status', env.projectDir, env.homeDir);

    expect(status.exitCode).toBe(0);
    expect(status.stdout).toMatch(/DEV workspace: INACTIVE/);
    expect(snapshot(env.projectDir, [operationsLog])).toEqual(before);
  });

  it('create-workspace refuses a second run and an existing dev folder, with a non-zero exit', () => {
    env = realProject();
    fs.mkdirSync(path.join(env.projectDir, 'dev'));

    const blocked = runCli('dev create-workspace', env.projectDir, env.homeDir);
    expect(blocked.exitCode).toBe(1);
    expect(blocked.stderr).toMatch(/rename or move that entry/);
    expect(readIdentity(env.projectDir).dev_workspace).toBeUndefined();

    fs.removeSync(path.join(env.projectDir, 'dev'));
    expect(runCli('dev create-workspace', env.projectDir, env.homeDir).exitCode).toBe(0);
    const again = runCli('dev create-workspace', env.projectDir, env.homeDir);
    expect(again.exitCode).toBe(1);
    expect(again.stderr).toMatch(/already registered/);
  });

  it('project start --reinit and project register keep the record and unknown identity fields', () => {
    env = realProject();
    expect(runCli('dev create-workspace', env.projectDir, env.homeDir).exitCode).toBe(0);
    const identityPath = path.join(env.projectDir, IDENTITY);
    const withExtra = { ...fs.readJsonSync(identityPath), future_field: 'keep' };
    fs.writeJsonSync(identityPath, withExtra, { spaces: 2 });
    fs.writeFileSync(path.join(env.projectDir, 'dev', 'work.txt'), 'product file');
    const record = withExtra.dev_workspace;

    const reinit = runCli('project start --id TEST --name "Test Project" --confirm --reinit', env.projectDir, env.homeDir);
    expect(reinit.exitCode).toBe(0);
    expect(readIdentity(env.projectDir).dev_workspace).toEqual(record);
    expect(readIdentity(env.projectDir).future_field).toBe('keep');
    expect(fs.readFileSync(path.join(env.projectDir, 'dev', 'work.txt'), 'utf8')).toBe('product file');

    const register = runCli('project register --id TEST --name "Test Project"', env.projectDir, env.homeDir);
    expect(register.exitCode).toBe(0);
    expect(readIdentity(env.projectDir).dev_workspace).toEqual(record);
    expect(readIdentity(env.projectDir).future_field).toBe('keep');
    expect(runCli('dev status', env.projectDir, env.homeDir).stdout).toMatch(/DEV workspace: ACTIVE\b/);
  });

  it('project sync does not touch dev/', () => {
    env = realProject();
    expect(runCli('dev create-workspace', env.projectDir, env.homeDir).exitCode).toBe(0);
    fs.writeFileSync(path.join(env.projectDir, 'dev', 'work.txt'), 'product file');
    const before = snapshot(path.join(env.projectDir, 'dev'));

    const sync = runCli('project sync --confirm', env.projectDir, env.homeDir);

    expect(sync.exitCode).toBe(0);
    expect(snapshot(path.join(env.projectDir, 'dev'))).toEqual(before);
  });

  describe('doctor', () => {
    it('reports ACTIVE_DEGRADED without writing, and only --repair-workspace repairs', () => {
      env = realProject();
      expect(runCli('dev create-workspace', env.projectDir, env.homeDir).exitCode).toBe(0);
      fs.removeSync(path.join(env.projectDir, MARKER));

      const diagnose = runCli('doctor', env.projectDir, env.homeDir);
      expect(diagnose.exitCode).toBe(0);
      expect(diagnose.stdout).toMatch(/\[WARN\] DEV workspace is ACTIVE_DEGRADED/);
      expect(fs.existsSync(path.join(env.projectDir, MARKER))).toBe(false);

      const repair = runCli('doctor --repair-workspace', env.projectDir, env.homeDir);
      expect(repair.exitCode).toBe(0);
      expect(repair.stdout).toMatch(/State after: ACTIVE/);
      expect(fs.readJsonSync(path.join(env.projectDir, MARKER)).project_id).toBe('TEST');

      const after = runCli('doctor', env.projectDir, env.homeDir);
      expect(after.stdout).not.toMatch(/ACTIVE_DEGRADED/);
    });

    it('--repair-workspace is exclusive and harmless on an unregistered project', () => {
      env = realProject();

      const combined = runCli('doctor --repair-workspace --all-versions', env.projectDir, env.homeDir);
      expect(combined.exitCode).toBe(1);
      expect(combined.stderr).toMatch(/cannot be combined/);

      const alone = runCli('doctor --repair-workspace', env.projectDir, env.homeDir);
      expect(alone.exitCode).toBe(0);
      expect(alone.stdout).toMatch(/No DEV workspace is registered/);
      expect(fs.existsSync(path.join(env.projectDir, 'dev'))).toBe(false);
    });
  });

  describe('session bootstrap', () => {
    it('shows one workspace line for DEV and none for other roles', () => {
      env = realProject();
      expect(runCli('intent new --title "T" --focus "F"', env.projectDir, env.homeDir).exitCode).toBe(0);

      const inactive = runCli('session bootstrap --role dev', env.projectDir, env.homeDir);
      expect(inactive.stdout).toMatch(/--- DEV Workspace ---\s+INACTIVE/);

      expect(runCli('dev create-workspace', env.projectDir, env.homeDir).exitCode).toBe(0);
      const active = runCli('session bootstrap --role dev', env.projectDir, env.homeDir);
      expect(active.stdout).toMatch(/--- DEV Workspace ---\s+ACTIVE: write only inside dev\//);

      fs.removeSync(path.join(env.projectDir, MARKER));
      const degraded = runCli('session bootstrap --role dev', env.projectDir, env.homeDir);
      expect(degraded.stdout).toMatch(/ACTIVE_DEGRADED: restrictions apply/);

      expect(runCli('session bootstrap --role fmn', env.projectDir, env.homeDir).stdout).not.toMatch(/DEV Workspace/);
      expect(runCli('session bootstrap', env.projectDir, env.homeDir).stdout).not.toMatch(/DEV Workspace/);
    });
  });

  it('the two operations are registered and classified', () => {
    const registry = fs.readJsonSync(path.resolve(__dirname, '..', 'Sigma', 'SIGMA-OPERATION-REGISTRY.json'));
    const byId = new Map<string, Record<string, unknown>>(registry.operations.map((o: Record<string, unknown>) => [o.operation_id as string, o]));

    expect(registry.total_operations).toBe(65);
    expect(registry.operations).toHaveLength(65);
    expect(byId.get('dev_create_workspace')).toMatchObject({ level: 'semantic', role: 'director' });
    expect(byId.get('dev_status')).toMatchObject({ level: 'read_only', role: 'any' });
  });
});
