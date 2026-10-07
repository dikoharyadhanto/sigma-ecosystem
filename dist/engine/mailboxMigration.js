"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withMailboxLock = void 0;
exports.mailboxMigrationDiagnosis = mailboxMigrationDiagnosis;
exports.migrateMailbox = migrateMailbox;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const mailbox_1 = require("./mailbox");
const mailboxContext_1 = require("./mailboxContext");
const controlStore_1 = require("./controlStore");
const fs_1 = require("../utils/fs");
const config_1 = require("../config");
const JOURNAL = 'Sigma/messages/migrations/v2/journal.json';
const INDEX = 'Sigma/messages/index.json';
const hash = (content) => crypto_1.default.createHash('sha256').update(content).digest('hex');
function readJournal(root) {
    const file = (0, mailboxContext_1.assertMailboxPath)(root, JOURNAL);
    if (!fs_extra_1.default.existsSync(file))
        return null;
    const j = fs_extra_1.default.readJsonSync(file);
    if (j.format !== 1 || !['prepared', 'committed', 'completed'].includes(j.stage) || !Array.isArray(j.moves) || !(j.before === null || typeof j.before === 'string') || j.after?.mailbox_format !== 2 || typeof j.migrated_at !== 'string')
        throw new Error('Corrupt mailbox migration journal; manual recovery required.');
    const ids = new Set();
    (0, mailbox_1.validateMailboxIndexData)(j.after);
    let before = { messages: [] };
    if (j.before !== null) {
        const decoded = Buffer.from(j.before, 'base64');
        if (decoded.toString('base64') !== j.before)
            throw new Error('Invalid migration index snapshot.');
        before = (0, mailbox_1.validateMailboxIndexData)(JSON.parse(decoded.toString('utf8')));
        if (before.mailbox_format !== undefined)
            throw new Error('Migration snapshot is not legacy.');
    }
    if (before.messages.length !== j.moves.length || j.after.messages.length !== j.moves.length)
        throw new Error('Migration journal entry count mismatch.');
    for (const m of j.moves) {
        if (typeof m.id !== 'string' || !/^[a-f0-9]{64}$/.test(m.hash) || !/^Sigma\/messages\/(ARC|FMN|DEV|AUD)\/[^/]+\.md$/.test(m.source) || !/^Sigma\/(messages|memo)\/(ARC|FMN|DEV|AUD)\/LEGACY\/[^/]+\.md$/.test(m.destination) || ids.has(m.id))
            throw new Error('Invalid mailbox migration move; manual recovery required.');
        ids.add(m.id);
        (0, mailboxContext_1.assertMailboxPath)(root, m.source);
        (0, mailboxContext_1.assertMailboxPath)(root, m.destination);
        const entry = j.after.messages.find(e => e.id === m.id);
        const original = before.messages.find(e => e.id === m.id);
        if (!entry || !original || original.file !== m.source || entry.to !== original.to || entry.from !== original.from || entry.type !== original.type || entry.file !== m.destination || entry.context !== 'LEGACY' || entry.migration?.original_file !== m.source || entry.migration?.original_status !== original.status || entry.status !== (original.status === 'UNREAD' ? 'READ' : original.status))
            throw new Error('Mailbox migration journal identity mismatch.');
    }
    return j;
}
function saveJournal(root, j) {
    const absolute = (0, mailboxContext_1.assertMailboxPath)(root, JOURNAL);
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(absolute));
    const tmp = `${absolute}.${process.pid}.tmp`;
    fs_extra_1.default.writeJsonSync(tmp, j, { spaces: 2 });
    (0, fs_1.atomicReplaceFileSync)(tmp, absolute);
}
function failpoint(name) {
    if (process.env.SIGMA_TEST_MAILBOX_MIGRATION_CRASH_AT === name && process.env.NODE_ENV === 'test')
        process.exit(91);
    if (process.env.SIGMA_TEST_MAILBOX_MIGRATION_FAILPOINT === name && process.env.NODE_ENV === 'test')
        throw new Error(`Mailbox migration failpoint: ${name}`);
}
function verifyFile(root, rel, expected) {
    const absolute = (0, mailboxContext_1.assertMailboxPath)(root, rel, true);
    if (hash(fs_extra_1.default.readFileSync(absolute)) !== expected)
        throw new Error(`Mailbox migration hash conflict: ${rel}. No overwrite; manual recovery required.`);
}
function indexMatches(root, j) {
    const file = (0, mailboxContext_1.assertMailboxPath)(root, INDEX);
    const current = fs_extra_1.default.existsSync(file) ? fs_extra_1.default.readFileSync(file) : null;
    if (current === null && j.before === null || current !== null && j.before !== null && current.equals(Buffer.from(j.before, 'base64')))
        return 'before';
    if (current && current.equals(Buffer.from(JSON.stringify(j.after, null, 2) + '\n')))
        return 'after';
    throw new Error('Mailbox migration index changed outside transaction; manual recovery required.');
}
async function recover(root, j, assertOwned) {
    if (j.stage === 'completed')
        return;
    const state = indexMatches(root, j);
    if (j.stage === 'prepared') {
        for (const m of j.moves) {
            verifyFile(root, m.source, m.hash);
            if (fs_extra_1.default.existsSync((0, mailboxContext_1.assertMailboxPath)(root, m.destination)))
                verifyFile(root, m.destination, m.hash);
        }
        assertOwned();
        if (state === 'after') {
            const indexFile = (0, mailboxContext_1.assertMailboxPath)(root, INDEX);
            if (j.before === null)
                fs_extra_1.default.unlinkSync(indexFile);
            else {
                const tmp = `${indexFile}.${process.pid}.rollback`;
                fs_extra_1.default.writeFileSync(tmp, Buffer.from(j.before, 'base64'));
                (0, fs_1.atomicReplaceFileSync)(tmp, indexFile);
            }
        }
        for (const m of j.moves) {
            const destination = (0, mailboxContext_1.assertMailboxPath)(root, m.destination);
            if (fs_extra_1.default.existsSync(destination)) {
                assertOwned();
                await fs_extra_1.default.remove(destination);
            }
        }
        // Sources were never removed before commit; a retry can preflight again.
        assertOwned();
        fs_extra_1.default.unlinkSync((0, mailboxContext_1.assertMailboxPath)(root, JOURNAL));
        return;
    }
    if (state !== 'after')
        throw new Error('Committed mailbox migration index was replaced; manual recovery required.');
    for (const m of j.moves) {
        verifyFile(root, m.destination, m.hash);
        if (fs_extra_1.default.existsSync((0, mailboxContext_1.assertMailboxPath)(root, m.source)))
            verifyFile(root, m.source, m.hash);
    }
    for (const m of j.moves) {
        const source = (0, mailboxContext_1.assertMailboxPath)(root, m.source);
        if (fs_extra_1.default.existsSync(source)) {
            assertOwned();
            await fs_extra_1.default.remove(source);
        }
    }
    assertOwned();
    j.stage = 'completed';
    saveJournal(root, j);
}
function mailboxMigrationDiagnosis(root) {
    const journal = readJournal(root);
    const index = (0, mailbox_1.readIndex)(root);
    const disk = (0, mailboxContext_1.mailboxDiskFiles)(root);
    const pending = journal !== null && journal.stage !== 'completed';
    const required = pending || index.mailbox_format !== 2 && (index.messages.length > 0 || disk.length > 0);
    const integrity = (0, mailbox_1.checkMailboxIntegrity)(root);
    return { required, interrupted: pending, stage: journal?.stage ?? null, move_count: index.mailbox_format === 2 ? 0 : index.messages.length, reset_unread_count: index.mailbox_format === 2 ? 0 : index.messages.filter(m => m.status === 'UNREAD').length, integrity, warnings: [...(required ? [mailboxContext_1.MIGRATION_REQUIRED] : []), ...(integrity.failures || integrity.warnings ? [`Mailbox integrity: ${integrity.failures} failure(s), ${integrity.warnings} orphan file(s). Run sigma inbox check.`] : [])] };
}
var mailboxLock_1 = require("./mailboxLock");
Object.defineProperty(exports, "withMailboxLock", { enumerable: true, get: function () { return mailboxLock_1.withMailboxLock; } });
async function migrateMailbox(root, dryRun = false) {
    if (dryRun)
        return { ...mailboxMigrationDiagnosis(root), applied: false };
    const lock = await (0, controlStore_1.acquireProjectLock)(root);
    try {
        lock.assertOwned();
        const interrupted = readJournal(root);
        if (interrupted?.stage !== 'completed' && interrupted)
            await recover(root, interrupted, lock.assertOwned);
        const index = (0, mailbox_1.readIndex)(root);
        if (index.mailbox_format === 2)
            return { applied: false, moved: 0, reset_unread: 0, recovered: !!interrupted && interrupted.stage !== 'prepared' };
        const integrity = (0, mailbox_1.checkMailboxIntegrity)(root);
        if (integrity.findings.missing_files.length || integrity.findings.orphan_files.length || integrity.findings.invalid_fields.length)
            throw new Error('Mailbox migration preflight failed: missing source, orphan file, or invalid metadata. Nothing moved.');
        const beforeFile = (0, mailboxContext_1.assertMailboxPath)(root, INDEX);
        const before = fs_extra_1.default.existsSync(beforeFile) ? fs_extra_1.default.readFileSync(beforeFile).toString('base64') : null;
        const after = JSON.parse(JSON.stringify(index));
        after.mailbox_format = 2;
        const timestamp = new Date().toISOString();
        const moves = [];
        let reset = 0;
        for (const e of after.messages) {
            if (!config_1.MESSAGING_ROLES.includes(e.from) || !config_1.MESSAGING_ROLES.includes(e.to) || e.type === 'MEMO' && e.from !== e.to)
                throw new Error(`Invalid legacy mailbox identity: ${e.id}`);
            const source = e.file;
            const destination = `Sigma/${e.type === 'MEMO' ? 'memo' : 'messages'}/${e.to}/LEGACY/${path_1.default.basename(source)}`;
            if (fs_extra_1.default.existsSync((0, mailboxContext_1.assertMailboxPath)(root, destination)))
                throw new Error(`Mailbox migration destination collision: ${destination}. Nothing moved.`);
            moves.push({ id: e.id, source, destination, hash: hash(fs_extra_1.default.readFileSync((0, mailboxContext_1.assertMailboxPath)(root, source, true))) });
            e.migration = { original_file: source, original_status: e.status, migrated_at: timestamp };
            if (e.status === 'UNREAD') {
                e.status = 'READ';
                reset++;
            }
            e.file = destination;
            e.intent_version = null;
            e.context = 'LEGACY';
        }
        const map = new Map(moves.map(m => [m.source, m.destination]));
        for (const e of after.messages)
            e.attachments = e.attachments.map(a => map.get(a) ?? a);
        const journal = { format: 1, stage: 'prepared', before, after, moves, migrated_at: timestamp };
        lock.assertOwned();
        saveJournal(root, journal);
        failpoint('after_journal');
        for (const m of moves) {
            verifyFile(root, m.source, m.hash);
            const dest = (0, mailboxContext_1.assertMailboxPath)(root, m.destination);
            fs_extra_1.default.ensureDirSync(path_1.default.dirname(dest));
            lock.assertOwned();
            await fs_extra_1.default.copyFile((0, mailboxContext_1.assertMailboxPath)(root, m.source, true), dest, fs_extra_1.default.constants.COPYFILE_EXCL);
            verifyFile(root, m.destination, m.hash);
            failpoint('after_copy');
        }
        lock.assertOwned();
        (0, mailbox_1.writeIndex)(root, after);
        failpoint('after_index');
        journal.stage = 'committed';
        saveJournal(root, journal);
        failpoint('after_commit');
        await recover(root, journal, lock.assertOwned);
        failpoint('after_cleanup');
        return { applied: true, moved: moves.length, reset_unread: reset, warnings: integrity.findings.missing_attachments };
    }
    finally {
        await lock.release();
    }
}
//# sourceMappingURL=mailboxMigration.js.map