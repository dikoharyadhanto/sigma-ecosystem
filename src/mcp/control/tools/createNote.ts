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

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import path from 'path';
import { createNote, planNote, NotesError } from '../../../services/notesService';
import { ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { scrubHostPaths } from '../../tools/queryHelpers';
import { respondControlWrite, staleStateCheck } from '../shared';

const TITLE_MAX = 200;

/** One clock reading per call, shared by the file listing and the write. */
const clocks = new Map<string, Date>();

function asInvalidOperation(root: string, e: unknown): never {
  if (e instanceof NotesError) {
    throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, scrubHostPaths(e.message, [root]));
  }
  throw e;
}

export function registerCreateNoteTool(server: McpServer): void {
  server.registerTool(
    'sigma_create_note',
    {
      title: 'Create a registered note',
      description:
        'Creates a free-form Markdown note in Sigma/notes/note-list/ and registers it — the MCP control-plane ' +
        'equivalent of `sigma notes new`. Any of the four AI roles; the note is attributed to the role this server ' +
        'is bound to (there is no role argument). Needs no active chain and no Director approval. `title` is one ' +
        'line with at least one letter or digit. Never moves, rewrites, or deletes an existing note (`notes ' +
        'update` stays CLI-only). Requires idempotency_key and expected_state_revision (from a prior ' +
        'sigma_get_state call on this binding). Returns { id, title, path, created_by_role, catalog_updated, ' +
        'catalog_error }. A catalog refresh failure is reported, not fatal: the note is registered.',
      inputSchema: {
        title: z.string().min(1).max(TITLE_MAX),
        idempotency_key: z.string().min(1),
        expected_state_revision: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: { title: string; idempotency_key: string; expected_state_revision: string }) => {
      const stale = staleStateCheck(args.expected_state_revision);
      const callKey = `${args.idempotency_key}\u0000${args.title}`;
      return respondControlWrite(
        {
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
            try { planNote(root, args.title, now); } catch (e) { clocks.delete(callKey); asInvalidOperation(root, e); }
          },
          transactionFiles: (root) => {
            const plan = planNote(root, args.title, clocks.get(callKey) ?? new Date());
            return [plan.relPath, plan.registryRel, plan.catalogRel].map((rel) => path.join(root, rel));
          },
          guardedWrites: true,
        },
        (root, role) => {
          const now = clocks.get(callKey) ?? new Date();
          clocks.delete(callKey);
          try {
            const result = createNote(root, args.title, { role, now });
            return {
              id: result.entry.id,
              title: result.entry.title,
              path: result.relPath,
              created_by_role: result.entry.created_by_role ?? null,
              catalog_updated: result.catalogUpdated,
              catalog_error: result.catalogError ? scrubHostPaths(result.catalogError, [root]) : null,
            };
          } catch (e) {
            return asInvalidOperation(root, e);
          }
        },
      );
    },
  );
}
