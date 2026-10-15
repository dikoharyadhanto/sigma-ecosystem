"use strict";
// sigma_create_note — control-plane equivalent of `sigma notes new`
// (PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY WP-MCP-04, first control tool).
//
// Single step, like the sigma_create_*_draft tools — not prepare/commit. A note
// has no ticket, approval, lifecycle gate, or chain state, so there is nothing
// for a second step to freeze or for a Director to approve (Director decision
// 2026-10-15, Phase 3 start).
//
// Differences from the CLI, all deliberate:
//   - The creating role is the server's BOUND role. The CLI's free `--role`
//     flag is not accepted, so a note cannot be attributed to another role.
//   - The transaction lists exactly three files: the new note, the registry,
//     and the catalog. A path outside the project root is refused by the
//     control store itself, and the note's file name is derived from a slug,
//     never taken from the caller.
//   - `notes update` (moving or rewriting files) is not exposed; it stays CLI.
//
// It takes the same project lock as `sigma notes new`, so the two exclude each
// other.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCreateNoteTool = registerCreateNoteTool;
const zod_1 = require("zod");
const path_1 = __importDefault(require("path"));
const notesService_1 = require("../../../services/notesService");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const queryHelpers_1 = require("../../tools/queryHelpers");
const shared_1 = require("../shared");
const TITLE_MAX = 200;
/** One clock reading per call, shared by the file listing and the write. */
const clocks = new Map();
function asInvalidOperation(root, e) {
    if (e instanceof notesService_1.NotesError) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, (0, queryHelpers_1.scrubHostPaths)(e.message, [root]));
    }
    throw e;
}
function registerCreateNoteTool(server) {
    server.registerTool('sigma_create_note', {
        title: 'Create a registered note',
        description: 'Creates a free-form Markdown note in Sigma/notes/note-list/ and registers it — the MCP control-plane ' +
            'equivalent of `sigma notes new`. Any of the four AI roles; the note is attributed to the role this server ' +
            'is bound to (there is no role argument). Needs no active chain and no Director approval. `title` is one ' +
            'line with at least one letter or digit. Never moves, rewrites, or deletes an existing note (`notes ' +
            'update` stays CLI-only). Requires idempotency_key and expected_state_revision (from a prior ' +
            'sigma_get_state call on this binding). Returns { id, title, path, created_by_role, catalog_updated, ' +
            'catalog_error }. A catalog refresh failure is reported, not fatal: the note is registered.',
        inputSchema: {
            title: zod_1.z.string().min(1).max(TITLE_MAX),
            idempotency_key: zod_1.z.string().min(1),
            expected_state_revision: zod_1.z.string().min(1),
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (args) => {
        const stale = (0, shared_1.staleStateCheck)(args.expected_state_revision);
        const callKey = `${args.idempotency_key}\u0000${args.title}`;
        return (0, shared_1.respondControlWrite)({
            tool: 'sigma_create_note',
            operationId: 'notes_new',
            idempotencyKey: args.idempotency_key,
            argumentsForHash: { title: args.title },
            allowedRoles: ['ARC', 'FMN', 'DEV', 'AUD'],
            checkPreconditions: (root) => {
                stale(root);
                // Fail before a journal exists: a bad title or an unreadable
                // registry must not leave a prepared transaction behind.
                const now = new Date();
                clocks.set(callKey, now);
                try {
                    (0, notesService_1.planNote)(root, args.title, now);
                }
                catch (e) {
                    clocks.delete(callKey);
                    asInvalidOperation(root, e);
                }
            },
            transactionFiles: (root) => {
                const plan = (0, notesService_1.planNote)(root, args.title, clocks.get(callKey) ?? new Date());
                return [plan.relPath, plan.registryRel, plan.catalogRel].map((rel) => path_1.default.join(root, rel));
            },
            guardedWrites: true,
        }, (root, role) => {
            const now = clocks.get(callKey) ?? new Date();
            clocks.delete(callKey);
            try {
                const result = (0, notesService_1.createNote)(root, args.title, { role, now });
                return {
                    id: result.entry.id,
                    title: result.entry.title,
                    path: result.relPath,
                    created_by_role: result.entry.created_by_role ?? null,
                    catalog_updated: result.catalogUpdated,
                    catalog_error: result.catalogError ? (0, queryHelpers_1.scrubHostPaths)(result.catalogError, [root]) : null,
                };
            }
            catch (e) {
                return asInvalidOperation(root, e);
            }
        });
    });
}
//# sourceMappingURL=createNote.js.map