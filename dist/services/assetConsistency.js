"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256File = sha256File;
exports.managedProjectAssets = managedProjectAssets;
exports.inspectAsset = inspectAsset;
exports.syncableProjectAssets = syncableProjectAssets;
exports.inspectProjectAssets = inspectProjectAssets;
exports.formatAssetDifference = formatAssetDifference;
exports.syncManagedAssets = syncManagedAssets;
exports.inspectAssetDrift = inspectAssetDrift;
exports.computeAssetsHash = computeAssetsHash;
exports.stampProjectIfCurrent = stampProjectIfCurrent;
exports.stampHostIfCurrent = stampHostIfCurrent;
exports.evaluateVersionStatus = evaluateVersionStatus;
const crypto_1 = __importDefault(require("crypto"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const roleMemory_1 = require("../engine/roleMemory");
const detect_1 = require("../utils/detect");
const fs_1 = require("../utils/fs");
const PACKAGE_ROOT = path_1.default.resolve(__dirname, '..', '..');
const BUNDLE_SIGMA = path_1.default.join(PACKAGE_ROOT, 'Sigma');
const BUNDLE_BRIDGE = path_1.default.join(PACKAGE_ROOT, 'setup', 'targets', 'bridge');
const BUNDLE_TARGETS = path_1.default.join(PACKAGE_ROOT, 'setup', 'targets');
function sha256File(file) {
    return crypto_1.default.createHash('sha256').update(fs_extra_1.default.readFileSync(file)).digest('hex');
}
function listFiles(dir) {
    if (!fs_extra_1.default.existsSync(dir))
        return [];
    if (!fs_extra_1.default.lstatSync(dir).isDirectory())
        throw new Error('Expected a directory: ' + dir);
    const result = [];
    const visit = (current) => {
        for (const name of fs_extra_1.default.readdirSync(current).sort()) {
            const file = path_1.default.join(current, name);
            const stat = fs_extra_1.default.lstatSync(file);
            if (stat.isSymbolicLink())
                throw new Error('Symbolic links are not supported in managed assets: ' + file);
            if (stat.isDirectory())
                visit(file);
            else if (stat.isFile())
                result.push(path_1.default.relative(dir, file));
            else
                throw new Error('Unsupported managed asset: ' + file);
        }
    };
    visit(dir);
    return result;
}
function filePair(label, source, target) {
    if (!fs_extra_1.default.existsSync(source))
        return [];
    if (!fs_extra_1.default.lstatSync(source).isFile())
        throw new Error('Expected a regular managed file: ' + source);
    return [{ label, source, target }];
}
function lstatIfPresent(file) {
    try {
        return fs_extra_1.default.lstatSync(file);
    }
    catch (err) {
        if (err.code === 'ENOENT')
            return undefined;
        throw err;
    }
}
function treePairs(label, sourceDir, targetDir) {
    return listFiles(sourceDir).map(relative => ({
        label: label + '/' + relative.split(path_1.default.sep).join('/'),
        source: path_1.default.join(sourceDir, relative),
        target: path_1.default.join(targetDir, relative),
    }));
}
function managedProjectAssets(projectRoot) {
    const sigmaDir = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR);
    const templateSource = fs_extra_1.default.existsSync(config_1.GLOBAL_TEMPLATES_DIR) ? config_1.GLOBAL_TEMPLATES_DIR : path_1.default.join(BUNDLE_SIGMA, 'templates');
    return [
        ...filePair('Sigma/SIGMA_CONSTITUTION.md', path_1.default.join(config_1.GLOBAL_GOVERNANCE_DIR, 'SIGMA_CONSTITUTION.md'), path_1.default.join(sigmaDir, 'SIGMA_CONSTITUTION.md')),
        ...filePair('Sigma/SIGMA_PROTOCOL.md', path_1.default.join(config_1.GLOBAL_GOVERNANCE_DIR, 'SIGMA_PROTOCOL.md'), path_1.default.join(sigmaDir, 'SIGMA_PROTOCOL.md')),
        ...treePairs('Sigma/rules', config_1.GLOBAL_RULES_DIR, path_1.default.join(sigmaDir, 'rules')),
        ...treePairs('Sigma/templates', templateSource, path_1.default.join(sigmaDir, 'templates')),
        ...filePair('Sigma/SIGMA-OPERATION-REGISTRY.json', path_1.default.join(BUNDLE_SIGMA, 'SIGMA-OPERATION-REGISTRY.json'), path_1.default.join(sigmaDir, 'SIGMA-OPERATION-REGISTRY.json')),
        ...filePair('Sigma/SIGMA-REGISTRY.json', path_1.default.join(BUNDLE_SIGMA, 'SIGMA-REGISTRY.json'), path_1.default.join(sigmaDir, 'SIGMA-REGISTRY.json')),
        ...treePairs('Sigma/role-memory', path_1.default.join(BUNDLE_SIGMA, 'role-memory'), path_1.default.join(sigmaDir, 'role-memory')),
    ];
}
function ensureSafeTarget(file, root) {
    const relative = path_1.default.relative(root, file);
    if (relative.startsWith('..' + path_1.default.sep) || relative === '..' || path_1.default.isAbsolute(relative))
        return false;
    let current = root;
    const rootStat = lstatIfPresent(current);
    if (rootStat && !rootStat.isDirectory())
        return false;
    for (const segment of relative.split(path_1.default.sep)) {
        current = path_1.default.join(current, segment);
        const stat = lstatIfPresent(current);
        if (stat && !stat.isDirectory() && current !== file)
            return false;
        if (stat?.isSymbolicLink())
            return false;
    }
    const targetStat = lstatIfPresent(file);
    return !targetStat || targetStat.isFile();
}
function inspectAsset(pair, safeRoot) {
    const sourceHash = sha256File(pair.source);
    if (safeRoot && !ensureSafeTarget(pair.target, safeRoot)) {
        return { ...pair, status: 'UNSAFE', sourceHash };
    }
    const targetStat = lstatIfPresent(pair.target);
    if (!targetStat)
        return { ...pair, status: 'MISSING', sourceHash };
    if (!targetStat.isFile())
        return { ...pair, status: 'UNSAFE', sourceHash };
    const targetHash = sha256File(pair.target);
    if (sourceHash === targetHash)
        return { ...pair, status: 'SAME', sourceHash, targetHash };
    const acceptanceToken = crypto_1.default.createHash('sha256')
        .update(pair.label + '\0' + sourceHash + '\0' + targetHash)
        .digest('hex');
    return { ...pair, status: 'DIFF', sourceHash, targetHash, acceptanceToken };
}
// F09 — bridge files (CLAUDE.md, AGENTS.md, ...) live in the project root and
// are seeded from the global bridge templates. They are part of what
// `project sync` replaces, each behind its own acceptance token, but not of the
// version stamp: a project is not "outdated" because it kept its own bridge text.
function projectBridgePairs(projectRoot) {
    const source = fs_extra_1.default.existsSync(config_1.GLOBAL_BRIDGE_DIR) ? config_1.GLOBAL_BRIDGE_DIR : BUNDLE_BRIDGE;
    return treePairs('bridge', source, projectRoot)
        .filter(pair => path_1.default.dirname(pair.target) === projectRoot && config_1.BRIDGE_STUBS.includes(path_1.default.basename(pair.target)));
}
function syncableProjectAssets(projectRoot) {
    return [...managedProjectAssets(projectRoot), ...projectBridgePairs(projectRoot)];
}
function inspectProjectAssets(projectRoot) {
    return syncableProjectAssets(projectRoot).map(pair => inspectAsset(pair, projectRoot));
}
function formatAssetDifference(item, includeAcceptanceToken = true) {
    const hashes = 'source sha256:' + item.sourceHash +
        (item.targetHash ? ', target sha256:' + item.targetHash : '');
    return item.status + ' ' + item.label + ' (' + hashes + ')' +
        (includeAcceptanceToken && item.acceptanceToken ? ' accept=' + item.acceptanceToken : '') +
        ' source=' + item.source + ' target=' + item.target;
}
function syncManagedAssets(projectRoot, acceptedTokens) {
    const differences = inspectProjectAssets(projectRoot);
    const validTokens = new Set(differences.filter(item => item.status === 'DIFF').map(item => item.acceptanceToken));
    const unexpected = acceptedTokens.filter(token => !validTokens.has(token));
    if (unexpected.length)
        throw new Error('Unknown or stale acceptance token: ' + unexpected.join(', '));
    const accepted = new Set(acceptedTokens);
    const unsafe = differences.filter(item => item.status === 'UNSAFE');
    if (unsafe.length)
        throw new Error('Unsafe managed asset path(s):\n' + unsafe.map(item => formatAssetDifference(item)).join('\n'));
    const blocked = differences.filter(item => item.status === 'DIFF' && !accepted.has(item.acceptanceToken));
    if (blocked.length) {
        throw new Error('Managed asset differences require a decision for each file. No asset or MCP config was changed.\n' +
            blocked.map(item => formatAssetDifference(item)).join('\n') +
            '\nReview each source and target, then pass --accept <token> for every approved replacement.');
    }
    const changed = differences.filter(item => item.status === 'DIFF');
    let backupDir;
    if (changed.length) {
        const projectKey = crypto_1.default.createHash('sha256').update(path_1.default.resolve(projectRoot)).digest('hex').slice(0, 16);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto_1.default.randomBytes(4).toString('hex');
        backupDir = path_1.default.join(os_1.default.homedir(), '.local', 'share', 'sigma', 'sync-backups', projectKey, stamp);
        for (const item of changed) {
            const backupFile = path_1.default.join(backupDir, item.label);
            fs_extra_1.default.ensureDirSync(path_1.default.dirname(backupFile));
            fs_extra_1.default.copyFileSync(item.target, backupFile);
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
    const copied = [];
    for (const item of differences) {
        if (item.status === 'SAME')
            continue;
        fs_extra_1.default.ensureDirSync(path_1.default.dirname(item.target));
        fs_extra_1.default.copyFileSync(item.source, item.target);
        copied.push(item.label);
    }
    return { copied, backupDir };
}
function masterToHost() {
    return [
        ...filePair('governance/SIGMA_CONSTITUTION.md', path_1.default.join(BUNDLE_SIGMA, 'SIGMA_CONSTITUTION.md'), path_1.default.join(config_1.GLOBAL_GOVERNANCE_DIR, 'SIGMA_CONSTITUTION.md')),
        ...filePair('governance/SIGMA_PROTOCOL.md', path_1.default.join(BUNDLE_SIGMA, 'SIGMA_PROTOCOL.md'), path_1.default.join(config_1.GLOBAL_GOVERNANCE_DIR, 'SIGMA_PROTOCOL.md')),
        ...treePairs('rules', path_1.default.join(BUNDLE_SIGMA, 'rules'), config_1.GLOBAL_RULES_DIR),
        ...treePairs('templates', path_1.default.join(BUNDLE_SIGMA, 'templates'), config_1.GLOBAL_TEMPLATES_DIR),
        ...treePairs('bridge', BUNDLE_BRIDGE, config_1.GLOBAL_BRIDGE_DIR),
    ];
}
function masterToProject(projectRoot) {
    const sigmaDir = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR);
    return [
        ...filePair('Sigma/SIGMA_CONSTITUTION.md', path_1.default.join(BUNDLE_SIGMA, 'SIGMA_CONSTITUTION.md'), path_1.default.join(sigmaDir, 'SIGMA_CONSTITUTION.md')),
        ...filePair('Sigma/SIGMA_PROTOCOL.md', path_1.default.join(BUNDLE_SIGMA, 'SIGMA_PROTOCOL.md'), path_1.default.join(sigmaDir, 'SIGMA_PROTOCOL.md')),
        ...treePairs('Sigma/rules', path_1.default.join(BUNDLE_SIGMA, 'rules'), path_1.default.join(sigmaDir, 'rules')),
        ...treePairs('Sigma/templates', path_1.default.join(BUNDLE_SIGMA, 'templates'), path_1.default.join(sigmaDir, 'templates')),
        ...treePairs('Sigma/role-memory', path_1.default.join(BUNDLE_SIGMA, 'role-memory'), path_1.default.join(sigmaDir, 'role-memory')),
        ...filePair('Sigma/SIGMA-REGISTRY.json', path_1.default.join(BUNDLE_SIGMA, 'SIGMA-REGISTRY.json'), path_1.default.join(sigmaDir, 'SIGMA-REGISTRY.json')),
        ...filePair('Sigma/SIGMA-OPERATION-REGISTRY.json', path_1.default.join(BUNDLE_SIGMA, 'SIGMA-OPERATION-REGISTRY.json'), path_1.default.join(sigmaDir, 'SIGMA-OPERATION-REGISTRY.json')),
        ...treePairs('bridge', BUNDLE_BRIDGE, projectRoot)
            .filter(pair => path_1.default.dirname(pair.target) === projectRoot),
    ];
}
function installedSkillPairs() {
    const paths = (0, detect_1.targetPaths)();
    const families = [
        ['claude', path_1.default.join(BUNDLE_TARGETS, 'claude_code'), paths.claudeCommands],
        ['codex', path_1.default.join(BUNDLE_TARGETS, 'codex'), paths.codexSkills],
        ['reasonix', path_1.default.join(BUNDLE_TARGETS, 'reasonix'), paths.reasonixSkills],
        ['antigravity', path_1.default.join(BUNDLE_TARGETS, 'antigravity'), paths.antigravitySkills],
    ];
    const installed = families.flatMap(([name, source, target]) => fs_extra_1.default.existsSync(target) ? treePairs('skills/' + name, source, target) : []);
    if (fs_extra_1.default.existsSync(paths.opencodeCommands)) {
        installed.push(...treePairs('skills/opencode', path_1.default.join(BUNDLE_TARGETS, 'opencode'), paths.opencodeCommands)
            .filter(pair => pair.source.endsWith('.md')));
    }
    if (fs_extra_1.default.existsSync(paths.opencodePlugins)) {
        installed.push(...filePair('skills/opencode/plugins/protect-sigma.js', path_1.default.join(BUNDLE_TARGETS, 'opencode', 'plugins', 'protect-sigma.js'), path_1.default.join(paths.opencodePlugins, 'protect-sigma.js')));
    }
    return installed;
}
function inspectAssetDrift(projectRoot) {
    const groups = [
        ['master-host', masterToHost()],
        ['master-installed', installedSkillPairs()],
    ];
    if (projectRoot) {
        groups.push(['host-project', managedProjectAssets(projectRoot)]);
        groups.push(['master-project', masterToProject(projectRoot)]);
    }
    const differences = groups.flatMap(([layer, pairs]) => pairs.map(pair => ({ ...inspectAsset(pair, layer.endsWith('project') ? projectRoot : undefined), layer })));
    const memoryWarnings = [];
    for (const role of roleMemory_1.ROLE_MEMORY_ROLES) {
        const name = role.toLowerCase();
        for (const [layer, sigmaDir] of [
            ['master', BUNDLE_SIGMA],
            ...(projectRoot ? [['project', path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR)]] : []),
        ]) {
            const memoryFile = path_1.default.join(sigmaDir, 'role-memory', name + '-memory.json');
            const ruleFile = path_1.default.join(sigmaDir, 'rules', role + '-RULE.md');
            if (!fs_extra_1.default.existsSync(memoryFile) || !fs_extra_1.default.existsSync(ruleFile))
                continue;
            try {
                const memory = fs_extra_1.default.readJsonSync(memoryFile);
                const expected = 'sha256:' + sha256File(ruleFile);
                if (memory.source_rule_version !== expected) {
                    memoryWarnings.push(layer + ' ' + role + ' memory source_rule_version=' +
                        String(memory.source_rule_version) + ' expected=' + expected +
                        ' memory=' + memoryFile + ' rule=' + ruleFile);
                }
            }
            catch (err) {
                memoryWarnings.push(layer + ' ' + role + ' memory could not be checked: ' + err.message);
            }
        }
    }
    return { differences, memoryWarnings };
}
// Hash over the SOURCE side of the pairs, keyed by label, so two files that
// swap contents produce a different hash and the result does not depend on the
// order in which pairs were listed.
function computeAssetsHash(pairs) {
    const lines = pairs.map(pair => pair.label + '\0' + sha256File(pair.source)).sort();
    return 'sha256:' + crypto_1.default.createHash('sha256').update(lines.join('\n')).digest('hex');
}
function readJsonObject(file) {
    try {
        const parsed = fs_extra_1.default.readJsonSync(file);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
        }
    }
    catch {
        // missing or unreadable: callers decide what that means
    }
    return null;
}
function writeJsonAtomic(file, value) {
    const tmp = file + '.' + process.pid + '.tmp';
    fs_extra_1.default.writeJsonSync(tmp, value, { spaces: 2 });
    (0, fs_1.atomicReplaceFileSync)(tmp, file);
}
function asStamp(raw, versionKey) {
    if (raw === null || typeof raw !== 'object')
        return null;
    const record = raw;
    const version = record[versionKey];
    const hash = record.assets_hash;
    const syncedAt = record.synced_at;
    if (typeof version !== 'string' || typeof hash !== 'string' || typeof syncedAt !== 'string')
        return null;
    return { sigma_version: version, assets_hash: hash, synced_at: syncedAt };
}
function allSame(pairs, safeRoot) {
    return pairs.length > 0 && pairs.every(pair => inspectAsset(pair, safeRoot).status === 'SAME');
}
// Records the stamp on the project identity only when every managed project
// asset already matches its source. Never creates the identity file.
function stampProjectIfCurrent(projectRoot) {
    try {
        const pairs = managedProjectAssets(projectRoot);
        if (!allSame(pairs, projectRoot))
            return { written: false, reason: 'managed project assets differ from their sources' };
        const identityPath = path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE);
        const identity = readJsonObject(identityPath);
        if (!identity)
            return { written: false, reason: config_1.PROJECT_IDENTITY_FILE + ' is missing or unreadable' };
        identity.sigma_applied = {
            sigma_version: config_1.SIGMA_VERSION,
            assets_hash: computeAssetsHash(pairs),
            synced_at: new Date().toISOString(),
        };
        writeJsonAtomic(identityPath, identity);
        return { written: true };
    }
    catch (err) {
        return { written: false, reason: err.message };
    }
}
// Records the stamp on ~/.sigma/sigma.config.json only when every host asset
// matches the master bundle. Keeps existing fields; refreshes cli_version.
function stampHostIfCurrent() {
    try {
        const pairs = masterToHost();
        if (!allSame(pairs))
            return { written: false, reason: 'host assets differ from the master bundle' };
        const config = readJsonObject(config_1.GLOBAL_CONFIG_FILE) ?? { schema_version: '1.0.0' };
        config.cli_version = config_1.SIGMA_VERSION;
        config.assets_hash = computeAssetsHash(pairs);
        config.synced_at = new Date().toISOString();
        fs_extra_1.default.ensureDirSync(path_1.default.dirname(config_1.GLOBAL_CONFIG_FILE));
        writeJsonAtomic(config_1.GLOBAL_CONFIG_FILE, config);
        return { written: true };
    }
    catch (err) {
        return { written: false, reason: err.message };
    }
}
const PROJECT_SYNC_STEP = 'Run: sigma project sync (review the dry run), then sigma project sync --confirm';
// Host problems are reported before project problems: syncing a project from a
// stale host would copy stale assets into it (F00 T-19). Returns null when the
// status cannot be determined; callers stay silent in that case, and a version
// check must never fail the command it is attached to.
function evaluateVersionStatus(projectRoot) {
    try {
        const hostConfig = readJsonObject(config_1.GLOBAL_CONFIG_FILE);
        const host = asStamp(hostConfig && { ...hostConfig, sigma_version: hostConfig.cli_version }, 'sigma_version');
        const hostHash = computeAssetsHash(masterToHost());
        const identity = readJsonObject(path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE));
        const project = asStamp(identity?.sigma_applied, 'sigma_version');
        const base = { installed_version: config_1.SIGMA_VERSION, host, project };
        if (!hostConfig) {
            return { ...base, level: 'host_unknown', command: 'sigma setup install',
                message: 'Sigma: the global installation was not found. Run: sigma setup install' };
        }
        if (!host) {
            return { ...base, level: 'host_unknown', command: 'sigma setup update',
                message: 'Sigma: the global installation (~/.sigma) has no version stamp, so it may be outdated. Run: sigma setup update' };
        }
        if (host.sigma_version !== config_1.SIGMA_VERSION || host.assets_hash !== hostHash) {
            return { ...base, level: 'host_outdated', command: 'sigma setup update',
                message: 'Sigma: the global installation (~/.sigma, ' + host.sigma_version +
                    ') is behind the installed CLI (' + config_1.SIGMA_VERSION + '). Run: sigma setup update' };
        }
        if (!project) {
            return { ...base, level: 'project_unknown', command: 'sigma project sync',
                message: 'Sigma: this project has no version stamp, so its Sigma assets may be outdated. ' + PROJECT_SYNC_STEP };
        }
        const projectHash = computeAssetsHash(managedProjectAssets(projectRoot));
        if (project.sigma_version !== config_1.SIGMA_VERSION || project.assets_hash !== projectHash) {
            return { ...base, level: 'project_outdated', command: 'sigma project sync',
                message: 'Sigma: this project was last synced at ' + project.sigma_version + ' (' + project.synced_at +
                    ') and is behind ~/.sigma (' + config_1.SIGMA_VERSION + '). ' + PROJECT_SYNC_STEP };
        }
        return { ...base, level: 'current', command: null, message: null };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=assetConsistency.js.map