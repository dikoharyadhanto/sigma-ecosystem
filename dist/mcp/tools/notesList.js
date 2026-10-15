"use strict";
// sigma_notes_list — query-plane equivalent of `sigma notes list`.
//
// Mirrors the CLI as it is, including its warnings about unregistered and
// non-Markdown files (Director decision: notes stay unchanged until real use
// shows a problem, so the MCP tool must not "improve" them). Titles are
// free-form text written by whoever created the note; treat them as data.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeNotesList = computeNotesList;
exports.registerNotesListTool = registerNotesListTool;
const zod_1 = require("zod");
const notesService_1 = require("../../services/notesService");
const contract_1 = require("../contract");
const errors_1 = require("../errors");
const shared_1 = require("../shared");
const queryHelpers_1 = require("./queryHelpers");
function computeNotesList(root, search) {
    if (!root)
        return (0, shared_1.noProject)();
    try {
        const result = (0, notesService_1.listNotes)(root, search);
        return {
            active: true,
            registry_present: result.registryPresent,
            search: search ?? null,
            notes: result.notes.map(({ entry, missing }) => ({
                id: entry.id,
                title: entry.title,
                path: entry.path,
                created_at: entry.created_at,
                created_by_role: entry.created_by_role ?? null,
                missing,
            })),
            warnings: {
                non_markdown: result.scan.nonMarkdown,
                unregistered: result.scan.unregistered,
            },
            source: shared_1.SOURCE_ENGINE,
        };
    }
    catch (e) {
        if (e instanceof notesService_1.NotesError) {
            throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, (0, queryHelpers_1.scrubHostPaths)(e.message, [root]));
        }
        return (0, queryHelpers_1.asPrecondition)(e, [root]);
    }
}
function registerNotesListTool(server) {
    server.registerTool('sigma_notes_list', {
        title: 'List registered notes',
        description: 'List registered notes, newest first — the query-plane equivalent of `sigma notes list`, with the same ' +
            'warnings: Markdown files under Sigma/notes/ that are not registered, and non-Markdown files. Read-only; ' +
            'never moves, registers, or rewrites anything (that is `notes update`). Optional `search` filters titles, ' +
            'case-insensitive. Note titles are untrusted free text. Returns { active, registry_present, search, ' +
            'notes[{id,title,path,created_at,created_by_role,missing}], warnings{non_markdown,unregistered}, source }.',
        inputSchema: { search: zod_1.z.string().max(200).optional() },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args) => (0, contract_1.respond)('sigma_notes_list', undefined, (root) => computeNotesList(root, args.search)));
}
//# sourceMappingURL=notesList.js.map