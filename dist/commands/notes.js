"use strict";
// F06 — `sigma notes new|list|update`. Thin Commander layer over services/notesService.ts.
// Free-form notes: no chain, no gate, no lock state, no Director approval; any role may run them.
Object.defineProperty(exports, "__esModule", { value: true });
exports.notesCommand = notesCommand;
const commander_1 = require("commander");
const fs_1 = require("../utils/fs");
const mailboxLock_1 = require("../engine/mailboxLock");
const notesService_1 = require("../services/notesService");
function fail(e) {
    console.error(e.message);
    process.exitCode = 1;
}
function printViolations(violations) {
    console.error('[REFUSED] Non-Markdown files found under Sigma/notes/. Sigma/notes/ is Markdown-only; nothing was moved or written.');
    console.error('Move or remove these yourself, then run `sigma notes update` again:');
    for (const v of violations)
        console.error(`  - Sigma/notes/${v}`);
}
function notesCommand() {
    const cmd = new commander_1.Command('notes');
    cmd.description('Register and list free-form Markdown notes (Sigma/notes/)');
    cmd
        .command('new')
        .description('Create a registered note in Sigma/notes/note-list/ and refresh note-list.md')
        .requiredOption('--title <title>', 'Note title (required)')
        .option('--role <role>', 'Role creating the note (arc|fmn|dev|aud|director), recorded in the registry')
        .action(async (opts) => {
        try {
            const root = (0, fs_1.findProjectRoot)();
            const result = await (0, mailboxLock_1.withMailboxLock)(root, () => (0, notesService_1.createNote)(root, opts.title, { role: opts.role }));
            console.log(`Note ${result.entry.id} created: ${result.relPath}`);
            console.log(`  Title: ${result.entry.title}`);
            if (result.catalogError) {
                console.error(`[WARNING] The note is registered but note-list.md could not be refreshed: ${result.catalogError}`);
                console.error('  Run `sigma notes update` to regenerate it.');
                process.exitCode = 1;
            }
        }
        catch (e) {
            fail(e);
        }
    });
    cmd
        .command('list')
        .description('List registered notes, newest first')
        .option('--search <keyword>', 'Filter by title (case-insensitive)')
        .action((opts) => {
        try {
            const result = (0, notesService_1.listNotes)((0, fs_1.findProjectRoot)(), opts.search);
            if (result.notes.length === 0) {
                console.log(opts.search ? `No registered notes match "${opts.search}".` : 'No notes registered.');
            }
            for (const { entry, missing } of result.notes) {
                const when = (0, notesService_1.displayDateTime)(new Date(entry.created_at));
                console.log(`${entry.id}  ${when}  ${entry.title}  (${entry.path})${missing ? '  (missing)' : ''}`);
            }
            const { unregistered, nonMarkdown } = result.scan;
            if (nonMarkdown.length > 0) {
                console.error(`[WARNING] ${nonMarkdown.length} non-Markdown file(s) under Sigma/notes/; \`sigma notes update\` will refuse until they are removed.`);
            }
            if (unregistered.length > 0) {
                console.error(`[WARNING] ${unregistered.length} Markdown file(s) under Sigma/notes/ are not registered notes; \`sigma notes update\` would move them to unregistered-notes/.`);
            }
        }
        catch (e) {
            fail(e);
        }
    });
    cmd
        .command('update')
        .description('Move unregistered Markdown to unregistered-notes/, reject non-Markdown, refresh note-list.md')
        .option('--dry-run', 'Print what would happen without changing anything')
        .option('--rebuild-registry', 'Restore a missing or unreadable notes registry from note-list.md (preview unless --director-confirm)')
        .option('--director-confirm', 'Confirm a --rebuild-registry write (Director decision)')
        .action(async (opts) => {
        try {
            const root = (0, fs_1.findProjectRoot)();
            if (opts.rebuildRegistry) {
                const confirm = Boolean(opts.directorConfirm) && !opts.dryRun;
                const report = confirm
                    ? await (0, mailboxLock_1.withMailboxLock)(root, () => (0, notesService_1.rebuildRegistry)(root, { confirm: true }))
                    : (0, notesService_1.rebuildRegistry)(root, { confirm: false });
                console.log(confirm ? 'Registry rebuilt from note-list.md.' : 'Preview only. Nothing was written.');
                console.log(`  Restorable rows: ${report.accepted.length}`);
                for (const n of report.accepted)
                    console.log(`    + ${n.id}  ${n.file}  ${n.title}`);
                console.log(`  Rejected rows: ${report.rejected.length}`);
                for (const r of report.rejected)
                    console.log(`    - ${r.row}  (${r.reason})`);
                console.log(`  Next ID will follow N${String(report.lastId).padStart(2, '0')} (IDs are never reused).`);
                if (report.corruptBackup)
                    console.log(`  The unreadable registry was kept as ${report.corruptBackup}`);
                if (!confirm) {
                    console.log('Re-run with --director-confirm (without --dry-run) to write the registry. Files not listed in the catalog stay unregistered and are not moved by this run.');
                }
                return;
            }
            const result = opts.dryRun
                ? (0, notesService_1.updateNotes)(root, { dryRun: true })
                : await (0, mailboxLock_1.withMailboxLock)(root, () => (0, notesService_1.updateNotes)(root, { dryRun: false }));
            if (result.violations.length > 0) {
                printViolations(result.violations);
                process.exitCode = 1;
                return;
            }
            console.log(opts.dryRun ? 'Dry run — nothing was changed.' : 'Notes updated.');
            console.log(`  Markdown files moved to unregistered-notes/: ${result.moves.length}`);
            for (const m of result.moves)
                console.log(`    Sigma/notes/${m.from} -> Sigma/notes/${m.to}`);
            console.log(`  Registered notes: ${result.registered}`);
            if (result.missing.length > 0) {
                console.log('  [WARNING] Registered notes whose file is missing (kept in the registry, hidden from note-list.md):');
                for (const m of result.missing)
                    console.log(`    - ${m}`);
            }
            if (!opts.dryRun)
                console.log(`  note-list.md ${result.catalogUpdated ? 'refreshed' : 'already up to date'}.`);
        }
        catch (e) {
            fail(e);
        }
    });
    return cmd;
}
//# sourceMappingURL=notes.js.map