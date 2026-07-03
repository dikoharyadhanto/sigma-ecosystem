import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { setupTestEnv, runCli, TestEnv } from './helpers';

describe('Comprehensive Research reference list', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('project start creates Sigma/reference/reference-list.md once, project-wide', () => {
    env = setupTestEnv();

    const result = runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    const listPath = path.join(env.projectDir, 'Sigma', 'reference', 'reference-list.md');
    expect(fs.existsSync(listPath)).toBe(true);
    const content = fs.readFileSync(listPath, 'utf8');
    expect(content).toMatch(/## Local Artifact/);
    expect(content).toMatch(/## Website Link/);
    expect(content).toMatch(/## Online Source Data/);
  });

  it('sigma reference update self-heals a missing reference-list.md', () => {
    env = setupTestEnv();
    runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    const listPath = path.join(env.projectDir, 'Sigma', 'reference', 'reference-list.md');
    fs.removeSync(listPath);
    expect(fs.existsSync(listPath)).toBe(false);

    const result = runCli('reference update', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/self-heal/i);
    expect(fs.existsSync(listPath)).toBe(true);
  });

  it('sigma reference update adds new rows for top-level files found in Sigma/reference/data/', () => {
    env = setupTestEnv();
    runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    const dataDir = path.join(env.projectDir, 'Sigma', 'reference', 'data');
    fs.ensureDirSync(dataDir);
    fs.writeFileSync(path.join(dataDir, 'dataset.csv'), 'a,b,c\n');

    const result = runCli('reference update', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/New local artifact rows added: 1/);

    const content = fs.readFileSync(
      path.join(env.projectDir, 'Sigma', 'reference', 'reference-list.md'),
      'utf8'
    );
    expect(content).toMatch(/`data\/dataset\.csv`/);
  });

  it('sigma reference update records a data/ subfolder as a single row, not one row per nested file', () => {
    env = setupTestEnv();
    runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    const dataDir = path.join(env.projectDir, 'Sigma', 'reference', 'data');
    const statsDir = path.join(dataDir, 'rainfall_data');
    fs.ensureDirSync(statsDir);
    fs.writeFileSync(path.join(statsDir, '2021.csv'), 'a,b,c\n');
    fs.writeFileSync(path.join(statsDir, '2022.csv'), 'a,b,c\n');

    const result = runCli('reference update', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/New local artifact rows added: 1/);

    const content = fs.readFileSync(
      path.join(env.projectDir, 'Sigma', 'reference', 'reference-list.md'),
      'utf8'
    );
    expect(content).toMatch(/`data\/rainfall_data\/`/);
    expect(content).not.toMatch(/data\/rainfall_data\/2021\.csv/);
    expect(content).not.toMatch(/data\/rainfall_data\/2022\.csv/);

    // Idempotent — a second run must not add a row per nested file either.
    const second = runCli('reference update', env.projectDir, env.homeDir);
    expect(second.stdout).toMatch(/New local artifact rows added: 0/);
  });

  it('sigma reference update assigns sequential LA ids, continuing after the template\'s LA01 example', () => {
    env = setupTestEnv();
    runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    const dataDir = path.join(env.projectDir, 'Sigma', 'reference', 'data');
    fs.ensureDirSync(dataDir);
    fs.writeFileSync(path.join(dataDir, 'a.csv'), 'x\n');
    fs.writeFileSync(path.join(dataDir, 'b.csv'), 'x\n');

    const result = runCli('reference update', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/New local artifact rows added: 2/);

    const listPath = path.join(env.projectDir, 'Sigma', 'reference', 'reference-list.md');
    const content = fs.readFileSync(listPath, 'utf8');
    const ids = [...content.matchAll(/\| (LA\d+) \|/g)].map(m => m[1]);

    // LA01 is the template's built-in example; the two new files claim the next two ids,
    // in whatever order the filesystem lists them, with no gaps or reuse.
    expect(ids.sort()).toEqual(['LA01', 'LA02', 'LA03']);

    // A later run with one more file continues the sequence rather than reusing an id.
    fs.writeFileSync(path.join(dataDir, 'c.csv'), 'x\n');
    runCli('reference update', env.projectDir, env.homeDir);
    const contentAfterThird = fs.readFileSync(listPath, 'utf8');
    const idsAfterThird = [...contentAfterThird.matchAll(/\| (LA\d+) \|/g)].map(m => m[1]);
    expect(idsAfterThird.sort()).toEqual(['LA01', 'LA02', 'LA03', 'LA04']);
  });

  it('sigma reference update is idempotent and never overwrites existing Category/Notes', () => {
    env = setupTestEnv();
    runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    const dataDir = path.join(env.projectDir, 'Sigma', 'reference', 'data');
    fs.ensureDirSync(dataDir);
    fs.writeFileSync(path.join(dataDir, 'dataset.csv'), 'a,b,c\n');

    runCli('reference update', env.projectDir, env.homeDir);

    const listPath = path.join(env.projectDir, 'Sigma', 'reference', 'reference-list.md');
    const afterFirstRun = fs.readFileSync(listPath, 'utf8');
    const filled = afterFirstRun.replace(
      '| LA02 | `data/dataset.csv` | [...] | [...] |',
      '| LA02 | `data/dataset.csv` | Source / Data | Population counts, 2024 |'
    );
    fs.writeFileSync(listPath, filled);

    const second = runCli('reference update', env.projectDir, env.homeDir);

    expect(second.exitCode).toBe(0);
    expect(second.stdout).toMatch(/New local artifact rows added: 0/);
    const afterSecondRun = fs.readFileSync(listPath, 'utf8');
    expect(afterSecondRun).toMatch(/Population counts, 2024/);
    // Only one row for dataset.csv — not duplicated
    expect(afterSecondRun.match(/data\/dataset\.csv/g)?.length).toBe(1);
  });

  it('sigma reference update flags a Local Artifact row whose file no longer exists, without deleting it', () => {
    env = setupTestEnv();
    runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    const dataDir = path.join(env.projectDir, 'Sigma', 'reference', 'data');
    fs.ensureDirSync(dataDir);
    fs.writeFileSync(path.join(dataDir, 'dataset.csv'), 'a,b,c\n');
    runCli('reference update', env.projectDir, env.homeDir);

    fs.removeSync(path.join(dataDir, 'dataset.csv'));
    const result = runCli('reference update', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\[WARNING\]/);
    expect(result.stdout).toMatch(/data\/dataset\.csv/);

    const listPath = path.join(env.projectDir, 'Sigma', 'reference', 'reference-list.md');
    const content = fs.readFileSync(listPath, 'utf8');
    expect(content).toMatch(/data\/dataset\.csv/);
  });
});
