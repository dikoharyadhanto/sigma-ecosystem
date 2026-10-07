"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIGRATION_REQUIRED = void 0;
exports.activeMailboxIntent = activeMailboxIntent;
exports.mailboxScope = mailboxScope;
exports.entryContext = entryContext;
exports.matchesMailboxScope = matchesMailboxScope;
exports.retentionScope = retentionScope;
exports.assertMailboxPath = assertMailboxPath;
exports.mailboxDiskFiles = mailboxDiskFiles;
exports.validateMailboxContext = validateMailboxContext;
exports.resolveMailboxReference = resolveMailboxReference;
exports.validateEntryMembership = validateEntryMembership;
exports.assertMailboxMutable = assertMailboxMutable;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const chain_1 = require("./chain");
const numbering_1 = require("./numbering");
const config_1 = require("../config");
exports.MIGRATION_REQUIRED = 'Mailbox migration required. Run: sigma doctor --migrate-mailbox --dry-run, then sigma doctor --migrate-mailbox';
function activeMailboxIntent(root) {
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return null;
    return (0, chain_1.readActiveChain)(root).data.intent.version;
}
function mailboxScope(root, opts = {}) {
    if (opts.allIntents && (opts.intent || opts.context))
        throw new Error('--all-intents cannot be combined with --intent or --context.');
    if (opts.intent && !/^v\d+$/.test(opts.intent))
        throw new Error('--intent must be an INTENT major version, e.g. v3.');
    if (opts.context && !/^(GENERAL|LEGACY|v\d+(?:\.\d+)?)$/.test(opts.context))
        throw new Error('Invalid --context. Use GENERAL, LEGACY, or an artifact version.');
    if (opts.intent && /^(GENERAL|LEGACY)$/.test(opts.context ?? ''))
        throw new Error('--intent cannot be combined with GENERAL or LEGACY.');
    if (opts.intent)
        (0, chain_1.readChain)(root, opts.intent);
    if (opts.allIntents)
        return { allIntents: true };
    if (opts.intent || opts.context)
        return { ...(opts.intent ? { intent: opts.intent } : {}), ...(opts.context ? { context: opts.context } : {}) };
    return { intent: activeMailboxIntent(root), includeGeneral: true };
}
function entryContext(entry) {
    if (entry.context === undefined && entry.intent_version === undefined)
        return { intent_version: null, context: 'LEGACY' };
    return { intent_version: entry.intent_version ?? null, context: entry.context };
}
function matchesMailboxScope(entry, scope) {
    if (!scope || scope.allIntents)
        return true;
    const identity = entryContext(entry);
    if (scope.context && identity.context !== scope.context)
        return false;
    if ('intent' in scope) {
        if (scope.intent === null && scope.includeGeneral)
            return identity.context === 'GENERAL';
        if (identity.intent_version === scope.intent && identity.context !== 'LEGACY' && identity.context !== 'GENERAL')
            return true;
        return !!scope.includeGeneral && identity.context === 'GENERAL' && entry.status === 'UNREAD';
    }
    return true;
}
function retentionScope(entry) {
    const identity = entryContext(entry);
    return identity.intent_version ? { intent: identity.intent_version } : { context: identity.context };
}
function assertMailboxPath(root, relative, mustExist = false) {
    if (!relative || relative.includes('\\') || path_1.default.isAbsolute(relative) || /^[a-z]:/i.test(relative) || relative.split('/').some(s => s === '..' || s === '.' || !s))
        throw new Error(`BOUNDARY_VIOLATION: invalid mailbox path ${relative}`);
    const absolute = path_1.default.resolve(root, relative);
    const rootReal = fs_extra_1.default.realpathSync(root);
    let candidate = absolute;
    while (!fs_extra_1.default.existsSync(candidate)) {
        const parent = path_1.default.dirname(candidate);
        if (parent === candidate)
            throw new Error('BOUNDARY_VIOLATION: no contained parent.');
        candidate = parent;
    }
    const real = fs_extra_1.default.realpathSync(candidate);
    const rel = path_1.default.relative(rootReal, real);
    if (rel === '..' || rel.startsWith(`..${path_1.default.sep}`) || path_1.default.isAbsolute(rel))
        throw new Error(`BOUNDARY_VIOLATION: mailbox path escapes project: ${relative}`);
    // Even contained links are excluded: a move must target the recorded path.
    let part = path_1.default.resolve(root);
    for (const segment of relative.split('/')) {
        part = path_1.default.join(part, segment);
        if (fs_extra_1.default.existsSync(part) && fs_extra_1.default.lstatSync(part).isSymbolicLink())
            throw new Error(`BOUNDARY_VIOLATION: linked mailbox path ${relative}`);
    }
    if (mustExist && (!fs_extra_1.default.existsSync(absolute) || !fs_extra_1.default.statSync(absolute).isFile()))
        throw new Error(`Mailbox file missing or not regular: ${relative}`);
    return absolute;
}
function mailboxDiskFiles(root) {
    const files = [];
    function walk(rel) {
        const absolute = assertMailboxPath(root, rel);
        if (!fs_extra_1.default.existsSync(absolute))
            return;
        for (const name of fs_extra_1.default.readdirSync(absolute)) {
            const child = `${rel}/${name}`;
            const checked = assertMailboxPath(root, child);
            const stat = fs_extra_1.default.lstatSync(checked);
            if (stat.isDirectory())
                walk(child);
            else if (name.endsWith('.md'))
                files.push(child);
        }
    }
    for (const base of ['messages', 'memo'])
        for (const role of config_1.MESSAGING_ROLES)
            walk(`Sigma/${base}/${role}`);
    return files.sort();
}
function validateMailboxContext(entry, format) {
    const hasMetadata = entry.context !== undefined || entry.intent_version !== undefined;
    if (format !== 2) {
        if (hasMetadata)
            throw new Error(`Mailbox format conflict: ${entry.id} has v2 metadata in a legacy index.`);
        if (!/^Sigma\/messages\/[^/]+\/[^/]+\.md$/.test(entry.file))
            throw new Error(`Invalid legacy mailbox path: ${entry.file}`);
        return;
    }
    if (!hasMetadata || !Object.prototype.hasOwnProperty.call(entry, 'intent_version'))
        throw new Error(`Missing mailbox context metadata: ${entry.id}`);
    const c = entry.context;
    if (typeof c !== 'string' || !/^(GENERAL|LEGACY|v\d+(?:\.\d+)?)$/.test(c))
        throw new Error(`Invalid mailbox context: ${entry.id}`);
    if (/^(GENERAL|LEGACY)$/.test(c) ? entry.intent_version !== null : typeof entry.intent_version !== 'string' || !/^v\d+$/.test(entry.intent_version))
        throw new Error(`Invalid mailbox intent identity: ${entry.id}`);
    if (!config_1.MESSAGING_ROLES.includes(entry.to) || !config_1.MESSAGING_ROLES.includes(entry.from))
        throw new Error(`Invalid mailbox role: ${entry.id}`);
    if (entry.type === 'MEMO' && entry.from !== entry.to)
        throw new Error(`MEMO must be self-addressed: ${entry.id}`);
    const base = entry.type === 'MEMO' ? 'memo' : 'messages';
    if (!entry.file.startsWith(`Sigma/${base}/${entry.to}/${c}/`) || entry.file.slice(`Sigma/${base}/${entry.to}/${c}/`.length).includes('/') || !entry.file.endsWith('.md'))
        throw new Error(`Mailbox metadata/path mismatch: ${entry.id}`);
}
function owns(chain, type, version) {
    if ((!type || type === 'INTENT') && chain.intent.version === version)
        return true;
    if ((!type || type === 'ROADMAP') && chain.roadmap?.version === version)
        return true;
    if ((!type || type === 'CLOSE') && chain.close?.version === version)
        return true;
    if ((!type || type === 'PLAN') && chain.plan.versions.some(p => p.version === version))
        return true;
    return (!type || type === 'EXEC') && chain.exec.versions.some(e => e.version === version);
}
function resolveMailboxReference(root, reference) {
    const ref = reference?.trim() || 'N/A';
    if (/^(GENERAL|N\/A)$/.test(ref))
        return { intent_version: null, context: 'GENERAL' };
    const parsed = /^(?:(?:(?:DIR|FMN|DEV)-)?(INTENT|ROADMAP|PLAN|EXEC|CLOSE)-)?(v\d+(?:\.\d+)?)$/.exec(ref);
    if (!parsed)
        throw new Error(`Invalid artifact reference "${ref}". Use INTENT/ROADMAP/PLAN/EXEC/CLOSE-vN, an artifact version, or GENERAL.`);
    const [, type, version] = parsed;
    const chains = (0, chain_1.listChainVersions)(root).map(v => { const chain = (0, chain_1.readChain)(root, v); (0, chain_1.validateChainNumbering)(chain); return chain; });
    const owners = chains.filter(c => owns(c, type, version));
    if (owners.length > 1)
        throw new Error(`Ambiguous mailbox reference ${ref}: multiple INTENT owners.`);
    if (owners.length === 0)
        return { intent_version: null, context: 'GENERAL', warning: `Reference ${ref} is not registered; stored in GENERAL. It will not be reclassified automatically.` };
    const owner = owners[0];
    if (activeMailboxIntent(root) !== owner.intent.version)
        throw new Error(`Cross-intent mailbox operation rejected: ${ref} belongs to INTENT ${owner.intent.version}. Activate that INTENT first.`);
    if (version.includes('.')) {
        if (Number(version.match(/^v(\d+)/)[1]) !== (0, numbering_1.planMajorForChain)(owner))
            throw new Error(`Mailbox numbering conflict for ${ref}.`);
    }
    else if (version !== owner.intent.version)
        throw new Error(`Mailbox major identity conflict for ${ref}.`);
    (0, numbering_1.resolveVersioningScheme)(owner);
    return { intent_version: owner.intent.version, context: version };
}
function validateEntryMembership(root, entry, cache = new Map()) {
    const c = entryContext(entry);
    if (!c.intent_version)
        return;
    let chain = cache.get(c.intent_version);
    if (!chain) {
        chain = (0, chain_1.readChain)(root, c.intent_version);
        (0, chain_1.validateChainNumbering)(chain);
        cache.set(c.intent_version, chain);
    }
    if (c.context.includes('.')) {
        if (!owns(chain, undefined, c.context) || Number(c.context.match(/^v(\d+)/)[1]) !== (0, numbering_1.planMajorForChain)(chain))
            throw new Error(`Mailbox chain membership mismatch: ${entry.id}`);
    }
    else if (c.context !== chain.intent.version)
        throw new Error(`Mailbox chain membership mismatch: ${entry.id}`);
    const ref = entry.related_artifact;
    if (ref && !/^(GENERAL|N\/A)$/.test(ref)) {
        const parsed = /^(?:(?:(?:DIR|FMN|DEV)-)?(INTENT|ROADMAP|PLAN|EXEC|CLOSE)-)?(v\d+(?:\.\d+)?)$/.exec(ref);
        if (!parsed || parsed[2] !== c.context || !owns(chain, parsed[1], parsed[2]))
            throw new Error(`Mailbox artifact reference mismatch: ${entry.id}`);
    }
}
function assertMailboxMutable(root, index) {
    const journal = assertMailboxPath(root, 'Sigma/messages/migrations/v2/journal.json');
    if (fs_extra_1.default.existsSync(journal) && fs_extra_1.default.readJsonSync(journal).stage !== 'completed')
        throw new Error(`${exports.MIGRATION_REQUIRED} (interrupted migration)`);
    if (index.mailbox_format !== 2) {
        if (index.messages.length || mailboxDiskFiles(root).length)
            throw new Error(exports.MIGRATION_REQUIRED);
        index.mailbox_format = 2;
    }
    const cache = new Map();
    for (const entry of index.messages) {
        validateMailboxContext(entry, 2);
        assertMailboxPath(root, entry.file);
        validateEntryMembership(root, entry, cache);
    }
}
//# sourceMappingURL=mailboxContext.js.map