import crypto from 'crypto';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {
  BRIDGE_STUBS,
  GLOBAL_BRIDGE_DIR,
  GLOBAL_CONFIG_FILE,
  GLOBAL_GOVERNANCE_DIR,
  GLOBAL_RULES_DIR,
  GLOBAL_TEMPLATES_DIR,
  PROJECT_IDENTITY_FILE,
  PROJECT_SIGMA_DIR,
  SIGMA_VERSION,
} from '../config';
import { ROLE_MEMORY_ROLES } from '../engine/roleMemory';
import { targetPaths } from '../utils/detect';
import { atomicReplaceFileSync } from '../utils/fs';

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE_SIGMA = path.join(PACKAGE_ROOT, 'Sigma');
const BUNDLE_BRIDGE = path.join(PACKAGE_ROOT, 'setup', 'targets', 'bridge');
const BUNDLE_TARGETS = path.join(PACKAGE_ROOT, 'setup', 'targets');

export interface AssetPair {
  label: string;
  source: string;
  target: string;
}

export interface AssetDifference extends AssetPair {
  status: 'SAME' | 'MISSING' | 'DIFF' | 'UNSAFE';
  sourceHash: string;
  targetHash?: string;
  acceptanceToken?: string;
}

export function sha256File(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  if (!fs.lstatSync(dir).isDirectory()) throw new Error('Expected a directory: ' + dir);
  const result: string[] = [];
  const visit = (current: string): void => {
    for (const name of fs.readdirSync(current).sort()) {
      const file = path.join(current, name);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error('Symbolic links are not supported in managed assets: ' + file);
      if (stat.isDirectory()) visit(file);
      else if (stat.isFile()) result.push(path.relative(dir, file));
      else throw new Error('Unsupported managed asset: ' + file);
    }
  };
  visit(dir);
  return result;
}

function filePair(label: string, source: string, target: string): AssetPair[] {
  if (!fs.existsSync(source)) return [];
  if (!fs.lstatSync(source).isFile()) throw new Error('Expected a regular managed file: ' + source);
  return [{ label, source, target }];
}

function lstatIfPresent(file: string): fs.Stats | undefined {
  try { return fs.lstatSync(file); }
  catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
}

function treePairs(label: string, sourceDir: string, targetDir: string): AssetPair[] {
  return listFiles(sourceDir).map(relative => ({
    label: label + '/' + relative.split(path.sep).join('/'),
    source: path.join(sourceDir, relative),
    target: path.join(targetDir, relative),
  }));
}

export function managedProjectAssets(projectRoot: string): AssetPair[] {
  const sigmaDir = path.join(projectRoot, PROJECT_SIGMA_DIR);
  const templateSource = fs.existsSync(GLOBAL_TEMPLATES_DIR) ? GLOBAL_TEMPLATES_DIR : path.join(BUNDLE_SIGMA, 'templates');
  return [
    ...filePair('Sigma/SIGMA_CONSTITUTION.md',
      path.join(GLOBAL_GOVERNANCE_DIR, 'SIGMA_CONSTITUTION.md'),
      path.join(sigmaDir, 'SIGMA_CONSTITUTION.md')),
    ...filePair('Sigma/SIGMA_PROTOCOL.md',
      path.join(GLOBAL_GOVERNANCE_DIR, 'SIGMA_PROTOCOL.md'),
      path.join(sigmaDir, 'SIGMA_PROTOCOL.md')),
    ...treePairs('Sigma/rules', GLOBAL_RULES_DIR, path.join(sigmaDir, 'rules')),
    ...treePairs('Sigma/templates', templateSource, path.join(sigmaDir, 'templates')),
    ...filePair('Sigma/SIGMA-OPERATION-REGISTRY.json',
      path.join(BUNDLE_SIGMA, 'SIGMA-OPERATION-REGISTRY.json'),
      path.join(sigmaDir, 'SIGMA-OPERATION-REGISTRY.json')),
    ...filePair('Sigma/SIGMA-REGISTRY.json',
      path.join(BUNDLE_SIGMA, 'SIGMA-REGISTRY.json'),
      path.join(sigmaDir, 'SIGMA-REGISTRY.json')),
    ...treePairs('Sigma/role-memory', path.join(BUNDLE_SIGMA, 'role-memory'), path.join(sigmaDir, 'role-memory')),
  ];
}

function ensureSafeTarget(file: string, root: string): boolean {
  const relative = path.relative(root, file);
  if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) return false;
  let current = root;
  const rootStat = lstatIfPresent(current);
  if (rootStat && !rootStat.isDirectory()) return false;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    const stat = lstatIfPresent(current);
    if (stat && !stat.isDirectory() && current !== file) return false;
    if (stat?.isSymbolicLink()) return false;
  }
  const targetStat = lstatIfPresent(file);
  return !targetStat || targetStat.isFile();
}

export function inspectAsset(pair: AssetPair, safeRoot?: string): AssetDifference {
  const sourceHash = sha256File(pair.source);
  if (safeRoot && !ensureSafeTarget(pair.target, safeRoot)) {
    return { ...pair, status: 'UNSAFE', sourceHash };
  }
  const targetStat = lstatIfPresent(pair.target);
  if (!targetStat) return { ...pair, status: 'MISSING', sourceHash };
  if (!targetStat.isFile()) return { ...pair, status: 'UNSAFE', sourceHash };
  const targetHash = sha256File(pair.target);
  if (sourceHash === targetHash) return { ...pair, status: 'SAME', sourceHash, targetHash };
  const acceptanceToken = crypto.createHash('sha256')
    .update(pair.label + '\0' + sourceHash + '\0' + targetHash)
    .digest('hex');
  return { ...pair, status: 'DIFF', sourceHash, targetHash, acceptanceToken };
}

// F09 — bridge files (CLAUDE.md, AGENTS.md, ...) live in the project root and
// are seeded from the global bridge templates. They are part of what
// `project sync` replaces, each behind its own acceptance token, but not of the
// version stamp: a project is not "outdated" because it kept its own bridge text.
function projectBridgePairs(projectRoot: string): AssetPair[] {
  const source = fs.existsSync(GLOBAL_BRIDGE_DIR) ? GLOBAL_BRIDGE_DIR : BUNDLE_BRIDGE;
  return treePairs('bridge', source, projectRoot)
    .filter(pair => path.dirname(pair.target) === projectRoot && (BRIDGE_STUBS as readonly string[]).includes(path.basename(pair.target)));
}

export function syncableProjectAssets(projectRoot: string): AssetPair[] {
  return [...managedProjectAssets(projectRoot), ...projectBridgePairs(projectRoot)];
}

export function inspectProjectAssets(projectRoot: string): AssetDifference[] {
  return syncableProjectAssets(projectRoot).map(pair => inspectAsset(pair, projectRoot));
}

export function formatAssetDifference(item: AssetDifference, includeAcceptanceToken = true): string {
  const hashes = 'source sha256:' + item.sourceHash +
    (item.targetHash ? ', target sha256:' + item.targetHash : '');
  return item.status + ' ' + item.label + ' (' + hashes + ')' +
    (includeAcceptanceToken && item.acceptanceToken ? ' accept=' + item.acceptanceToken : '') +
    ' source=' + item.source + ' target=' + item.target;
}

export interface SyncResult {
  copied: string[];
  backupDir?: string;
}

export function syncManagedAssets(projectRoot: string, acceptedTokens: string[]): SyncResult {
  const differences = inspectProjectAssets(projectRoot);
  const validTokens = new Set(differences.filter(item => item.status === 'DIFF').map(item => item.acceptanceToken!));
  const unexpected = acceptedTokens.filter(token => !validTokens.has(token));
  if (unexpected.length) throw new Error('Unknown or stale acceptance token: ' + unexpected.join(', '));
  const accepted = new Set(acceptedTokens);
  const unsafe = differences.filter(item => item.status === 'UNSAFE');
  if (unsafe.length) throw new Error('Unsafe managed asset path(s):\n' + unsafe.map(item => formatAssetDifference(item)).join('\n'));
  const blocked = differences.filter(item => item.status === 'DIFF' && !accepted.has(item.acceptanceToken!));
  if (blocked.length) {
    throw new Error('Managed asset differences require a decision for each file. No asset or MCP config was changed.\n' +
      blocked.map(item => formatAssetDifference(item)).join('\n') +
      '\nReview each source and target, then pass --accept <token> for every approved replacement.');
  }

  const changed = differences.filter(item => item.status === 'DIFF');
  let backupDir: string | undefined;
  if (changed.length) {
    const projectKey = crypto.createHash('sha256').update(path.resolve(projectRoot)).digest('hex').slice(0, 16);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(4).toString('hex');
    backupDir = path.join(os.homedir(), '.local', 'share', 'sigma', 'sync-backups', projectKey, stamp);
    for (const item of changed) {
      const backupFile = path.join(backupDir, item.label);
      fs.ensureDirSync(path.dirname(backupFile));
      fs.copyFileSync(item.target, backupFile);
    }
  }

  // A second check rejects files changed after the decision and before the first write.
  for (const item of differences) {
    const current = inspectAsset(item, projectRoot);
    if (current.status !== item.status || current.sourceHash !== item.sourceHash ||
        current.targetHash !== item.targetHash) {
      throw new Error('Managed asset changed since inspection; repeat the dry run: ' + item.label);
    }
  }

  const copied: string[] = [];
  for (const item of differences) {
    if (item.status === 'SAME') continue;
    fs.ensureDirSync(path.dirname(item.target));
    fs.copyFileSync(item.source, item.target);
    copied.push(item.label);
  }
  return { copied, backupDir };
}

function masterToHost(): AssetPair[] {
  return [
    ...filePair('governance/SIGMA_CONSTITUTION.md',
      path.join(BUNDLE_SIGMA, 'SIGMA_CONSTITUTION.md'),
      path.join(GLOBAL_GOVERNANCE_DIR, 'SIGMA_CONSTITUTION.md')),
    ...filePair('governance/SIGMA_PROTOCOL.md',
      path.join(BUNDLE_SIGMA, 'SIGMA_PROTOCOL.md'),
      path.join(GLOBAL_GOVERNANCE_DIR, 'SIGMA_PROTOCOL.md')),
    ...treePairs('rules', path.join(BUNDLE_SIGMA, 'rules'), GLOBAL_RULES_DIR),
    ...treePairs('templates', path.join(BUNDLE_SIGMA, 'templates'), GLOBAL_TEMPLATES_DIR),
    ...treePairs('bridge', BUNDLE_BRIDGE, GLOBAL_BRIDGE_DIR),
  ];
}

function masterToProject(projectRoot: string): AssetPair[] {
  const sigmaDir = path.join(projectRoot, PROJECT_SIGMA_DIR);
  return [
    ...filePair('Sigma/SIGMA_CONSTITUTION.md',
      path.join(BUNDLE_SIGMA, 'SIGMA_CONSTITUTION.md'), path.join(sigmaDir, 'SIGMA_CONSTITUTION.md')),
    ...filePair('Sigma/SIGMA_PROTOCOL.md',
      path.join(BUNDLE_SIGMA, 'SIGMA_PROTOCOL.md'), path.join(sigmaDir, 'SIGMA_PROTOCOL.md')),
    ...treePairs('Sigma/rules', path.join(BUNDLE_SIGMA, 'rules'), path.join(sigmaDir, 'rules')),
    ...treePairs('Sigma/templates', path.join(BUNDLE_SIGMA, 'templates'), path.join(sigmaDir, 'templates')),
    ...treePairs('Sigma/role-memory', path.join(BUNDLE_SIGMA, 'role-memory'), path.join(sigmaDir, 'role-memory')),
    ...filePair('Sigma/SIGMA-REGISTRY.json',
      path.join(BUNDLE_SIGMA, 'SIGMA-REGISTRY.json'), path.join(sigmaDir, 'SIGMA-REGISTRY.json')),
    ...filePair('Sigma/SIGMA-OPERATION-REGISTRY.json',
      path.join(BUNDLE_SIGMA, 'SIGMA-OPERATION-REGISTRY.json'), path.join(sigmaDir, 'SIGMA-OPERATION-REGISTRY.json')),
    ...treePairs('bridge', BUNDLE_BRIDGE, projectRoot)
      .filter(pair => path.dirname(pair.target) === projectRoot),
  ];
}

function installedSkillPairs(): AssetPair[] {
  const paths = targetPaths();
  const families: Array<[string, string, string]> = [
    ['claude', path.join(BUNDLE_TARGETS, 'claude_code'), paths.claudeCommands],
    ['codex', path.join(BUNDLE_TARGETS, 'codex'), paths.codexSkills],
    ['reasonix', path.join(BUNDLE_TARGETS, 'reasonix'), paths.reasonixSkills],
    ['antigravity', path.join(BUNDLE_TARGETS, 'antigravity'), paths.antigravitySkills],
  ];
  const installed = families.flatMap(([name, source, target]) =>
    fs.existsSync(target) ? treePairs('skills/' + name, source, target) : []);
  if (fs.existsSync(paths.opencodeCommands)) {
    installed.push(...treePairs('skills/opencode',
      path.join(BUNDLE_TARGETS, 'opencode'), paths.opencodeCommands)
      .filter(pair => pair.source.endsWith('.md')));
  }
  if (fs.existsSync(paths.opencodePlugins)) {
    installed.push(...filePair('skills/opencode/plugins/protect-sigma.js',
      path.join(BUNDLE_TARGETS, 'opencode', 'plugins', 'protect-sigma.js'),
      path.join(paths.opencodePlugins, 'protect-sigma.js')));
  }
  return installed;
}

export interface AssetDriftReport {
  differences: Array<AssetDifference & { layer: string }>;
  memoryWarnings: string[];
}

export function inspectAssetDrift(projectRoot?: string): AssetDriftReport {
  const groups: Array<[string, AssetPair[]]> = [
    ['master-host', masterToHost()],
    ['master-installed', installedSkillPairs()],
  ];
  if (projectRoot) {
    groups.push(['host-project', managedProjectAssets(projectRoot)]);
    groups.push(['master-project', masterToProject(projectRoot)]);
  }
  const differences = groups.flatMap(([layer, pairs]) =>
    pairs.map(pair => ({ ...inspectAsset(pair, layer.endsWith('project') ? projectRoot : undefined), layer })));
  const memoryWarnings: string[] = [];
  for (const role of ROLE_MEMORY_ROLES) {
    const name = role.toLowerCase();
    for (const [layer, sigmaDir] of [
      ['master', BUNDLE_SIGMA],
      ...(projectRoot ? [['project', path.join(projectRoot, PROJECT_SIGMA_DIR)]] : []),
    ]) {
      const memoryFile = path.join(sigmaDir, 'role-memory', name + '-memory.json');
      const ruleFile = path.join(sigmaDir, 'rules', role + '-RULE.md');
      if (!fs.existsSync(memoryFile) || !fs.existsSync(ruleFile)) continue;
      try {
        const memory = fs.readJsonSync(memoryFile) as { source_rule_version?: string };
        const expected = 'sha256:' + sha256File(ruleFile);
        if (memory.source_rule_version !== expected) {
          memoryWarnings.push(layer + ' ' + role + ' memory source_rule_version=' +
            String(memory.source_rule_version) + ' expected=' + expected +
            ' memory=' + memoryFile + ' rule=' + ruleFile);
        }
      } catch (err) {
        memoryWarnings.push(layer + ' ' + role + ' memory could not be checked: ' + (err as Error).message);
      }
    }
  }
  return { differences, memoryWarnings };
}

// ── F12: version stamp ───────────────────────────────────────────────────────
//
// Three layers: master (this package) -> host (~/.sigma) -> project. Each lower
// layer records the version and the content hash of the sources it was last
// made identical to. A stamp is only ever written when every managed asset on
// that layer is SAME as its source (stamp*IfCurrent), so a stamp is true by
// construction: it says "at synced_at everything matched", not "nothing has
// been edited since". Local edits made after a sync are not detected here;
// `sigma doctor --check-assets` is the source of truth for those.

export interface VersionStamp {
  sigma_version: string;
  assets_hash: string;
  synced_at: string;
}

export type VersionLevel =
  | 'current'
  | 'host_unknown'
  | 'host_outdated'
  | 'project_unknown'
  | 'project_outdated';

export interface VersionStatus {
  level: VersionLevel;
  installed_version: string;
  host: VersionStamp | null;
  project: VersionStamp | null;
  message: string | null;
  command: string | null;
}

export interface StampResult {
  written: boolean;
  reason?: string;
}

// Hash over the SOURCE side of the pairs, keyed by label, so two files that
// swap contents produce a different hash and the result does not depend on the
// order in which pairs were listed.
export function computeAssetsHash(pairs: AssetPair[]): string {
  const lines = pairs.map(pair => pair.label + '\0' + sha256File(pair.source)).sort();
  return 'sha256:' + crypto.createHash('sha256').update(lines.join('\n')).digest('hex');
}

function readJsonObject(file: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = fs.readJsonSync(file);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // missing or unreadable: callers decide what that means
  }
  return null;
}

function writeJsonAtomic(file: string, value: Record<string, unknown>): void {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeJsonSync(tmp, value, { spaces: 2 });
  atomicReplaceFileSync(tmp, file);
}

function asStamp(raw: unknown, versionKey: string): VersionStamp | null {
  if (raw === null || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const version = record[versionKey];
  const hash = record.assets_hash;
  const syncedAt = record.synced_at;
  if (typeof version !== 'string' || typeof hash !== 'string' || typeof syncedAt !== 'string') return null;
  return { sigma_version: version, assets_hash: hash, synced_at: syncedAt };
}

function allSame(pairs: AssetPair[], safeRoot?: string): boolean {
  return pairs.length > 0 && pairs.every(pair => inspectAsset(pair, safeRoot).status === 'SAME');
}

// Records the stamp on the project identity only when every managed project
// asset already matches its source. Never creates the identity file.
export function stampProjectIfCurrent(projectRoot: string): StampResult {
  try {
    const pairs = managedProjectAssets(projectRoot);
    if (!allSame(pairs, projectRoot)) return { written: false, reason: 'managed project assets differ from their sources' };
    const identityPath = path.join(projectRoot, PROJECT_IDENTITY_FILE);
    const identity = readJsonObject(identityPath);
    if (!identity) return { written: false, reason: PROJECT_IDENTITY_FILE + ' is missing or unreadable' };
    identity.sigma_applied = {
      sigma_version: SIGMA_VERSION,
      assets_hash: computeAssetsHash(pairs),
      synced_at: new Date().toISOString(),
    } satisfies VersionStamp;
    writeJsonAtomic(identityPath, identity);
    return { written: true };
  } catch (err) {
    return { written: false, reason: (err as Error).message };
  }
}

// Records the stamp on ~/.sigma/sigma.config.json only when every host asset
// matches the master bundle. Keeps existing fields; refreshes cli_version.
export function stampHostIfCurrent(): StampResult {
  try {
    const pairs = masterToHost();
    if (!allSame(pairs)) return { written: false, reason: 'host assets differ from the master bundle' };
    const config = readJsonObject(GLOBAL_CONFIG_FILE) ?? { schema_version: '1.0.0' };
    config.cli_version = SIGMA_VERSION;
    config.assets_hash = computeAssetsHash(pairs);
    config.synced_at = new Date().toISOString();
    fs.ensureDirSync(path.dirname(GLOBAL_CONFIG_FILE));
    writeJsonAtomic(GLOBAL_CONFIG_FILE, config);
    return { written: true };
  } catch (err) {
    return { written: false, reason: (err as Error).message };
  }
}

const PROJECT_SYNC_STEP = 'Run: sigma project sync (review the dry run), then sigma project sync --confirm';

// Host problems are reported before project problems: syncing a project from a
// stale host would copy stale assets into it (F00 T-19). Returns null when the
// status cannot be determined; callers stay silent in that case, and a version
// check must never fail the command it is attached to.
export function evaluateVersionStatus(projectRoot: string): VersionStatus | null {
  try {
    const hostConfig = readJsonObject(GLOBAL_CONFIG_FILE);
    const host = asStamp(hostConfig && { ...hostConfig, sigma_version: hostConfig.cli_version }, 'sigma_version');
    const hostHash = computeAssetsHash(masterToHost());
    const identity = readJsonObject(path.join(projectRoot, PROJECT_IDENTITY_FILE));
    const project = asStamp(identity?.sigma_applied, 'sigma_version');
    const base = { installed_version: SIGMA_VERSION, host, project };

    if (!hostConfig) {
      return { ...base, level: 'host_unknown', command: 'sigma setup install',
        message: 'Sigma: the global installation was not found. Run: sigma setup install' };
    }
    if (!host) {
      return { ...base, level: 'host_unknown', command: 'sigma setup update',
        message: 'Sigma: the global installation (~/.sigma) has no version stamp, so it may be outdated. Run: sigma setup update' };
    }
    if (host.sigma_version !== SIGMA_VERSION || host.assets_hash !== hostHash) {
      return { ...base, level: 'host_outdated', command: 'sigma setup update',
        message: 'Sigma: the global installation (~/.sigma, ' + host.sigma_version +
          ') is behind the installed CLI (' + SIGMA_VERSION + '). Run: sigma setup update' };
    }
    if (!project) {
      return { ...base, level: 'project_unknown', command: 'sigma project sync',
        message: 'Sigma: this project has no version stamp, so its Sigma assets may be outdated. ' + PROJECT_SYNC_STEP };
    }
    const projectHash = computeAssetsHash(managedProjectAssets(projectRoot));
    if (project.sigma_version !== SIGMA_VERSION || project.assets_hash !== projectHash) {
      return { ...base, level: 'project_outdated', command: 'sigma project sync',
        message: 'Sigma: this project was last synced at ' + project.sigma_version + ' (' + project.synced_at +
          ') and is behind ~/.sigma (' + SIGMA_VERSION + '). ' + PROJECT_SYNC_STEP };
    }
    return { ...base, level: 'current', command: null, message: null };
  } catch {
    return null;
  }
}
