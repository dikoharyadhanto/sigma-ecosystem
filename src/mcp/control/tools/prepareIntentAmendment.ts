// Stage F (W2 batch) — sigma_prepare_intent_amendment. First half of the
// two-stage governance transition (plan §9.3), same shape as Stage D's
// prepareIntentRatify.ts: "typed prepare -> durable Director approval ->
// typed commit". This tool only freezes an operation ticket; it grants no
// authority and never mutates governance state.
//
// F05: the ticket also freezes the Git review package (baseline commit, diff
// hash, INTENT file hash, purpose_changed). The Director approves the reviewed
// content; the commit holding it is supplied at commit time and verified there.
//
// Unlike ratify, this operation carries a business argument (`change`) that
// the commit tool needs again to perform the write — there is no ticket
// field that stores raw business payloads (OperationTicket only stores
// arguments_hash, by design — see engine/controlStore.ts). The same
// `change` text is therefore required again at commit time, and commit's
// checkPreconditions re-hashes it and compares against the ticket's frozen
// arguments_hash (and the approval's) before trusting it — a caller cannot
// silently substitute a different change text than the one Director
// approved.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readActiveChain } from '../../../engine/chain';
import { readCanonicalArtifactFile } from '../../artifactPath';
import { previewIntentAmendment, AmendmentPreview } from '../../../engine/intentGit';
import { generateId, writeTicket, ticketPath, OperationTicket, TICKET_TTL_MS } from '../../../engine/controlStore';
import { computeStateRevision, ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { getBinding } from '../../shared';
import { respondControlWrite, stableHash } from '../shared';

const MAX_CHANGE_LENGTH = 2000;

function assertValidChange(change: string): void {
  const trimmed = change.trim();
  if (!trimmed) {
    throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, '--change cannot be empty.');
  }
  if (/[|\n\r]/.test(change)) {
    throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, '--change cannot contain "|" or a newline (single-line amendment summary).');
  }
  if (change.length > MAX_CHANGE_LENGTH) {
    throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, `--change exceeds ${MAX_CHANGE_LENGTH} characters.`);
  }
}

export function registerPrepareIntentAmendmentTool(server: McpServer): void {
  server.registerTool(
    'sigma_prepare_intent_amendment',
    {
      title: 'Prepare an intent amendment operation ticket',
      description:
        'Freezes a Director-approved Amendment (free-text `change`) against the active chain\'s RATIFIED ' +
        'DIR-INTENT into an operation ticket. Does not record anything. The ticket grants no authority by ' +
        'itself: a Director must record an approval for it via the trusted local CLI (`sigma control approve ' +
        '<ticket_id>`) before sigma_commit_intent_amendment can use it. Tickets expire after 30 minutes. ARC role only.',
      inputSchema: {
        change: z.string().min(1).max(MAX_CHANGE_LENGTH),
        purpose_changed: z.boolean(),
        idempotency_key: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: { change: string; purpose_changed: boolean; idempotency_key: string }) => {
      const operationTicketId = generateId('opt');
      // Git work is slow; the control layer limits mutate() to a short lease-safety budget,
      // so the preview is computed in checkPreconditions (still under the project lock).
      let preview: AmendmentPreview | undefined;
      return respondControlWrite(
        {
          tool: 'sigma_prepare_intent_amendment',
          operationId: 'intent_amendment_prepare',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: { change: args.change, purpose_changed: args.purpose_changed },
          allowedRoles: ['ARC'],
          checkPreconditions: (root) => {
            assertValidChange(args.change);
            const { chainVersion, data: chain } = readActiveChain(root);
            if (chain.intent.state !== 'RATIFIED' || !chain.intent.file) return; // mutate reports these
            preview = previewIntentAmendment(root, chainVersion, chain);
            if (preview.report.blockers.length) {
              throw new McpQueryError(
                ERROR_CODES.INVALID_OPERATION,
                'Git preflight failed; resolve before preparing an amendment:\n' + preview.report.blockers.map(b => ' - ' + b).join('\n')
              );
            }
          },
          transactionFiles: (root) => [ticketPath(root, operationTicketId)],
        },
        (root) => {
          const { data: chain } = readActiveChain(root);
          if (chain.intent.state !== 'RATIFIED') {
            throw new McpQueryError(
              ERROR_CODES.INVALID_OPERATION,
              `Active DIR-INTENT is "${chain.intent.state}", not RATIFIED. Amendment requires RATIFIED.`
            );
          }
          if (!chain.intent.file) {
            throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, 'Active intent has no registered file.');
          }

          const doc = readCanonicalArtifactFile(root, 'intent', chain.intent.version, chain.intent.file);
          if (!doc.present || !doc.sha256) {
            throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'The RATIFIED DIR-INTENT file is not present on disk.');
          }

          if (!preview) throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, 'Amendment preview was not computed.');

          const { revision } = computeStateRevision(root);
          if (!revision) {
            throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, 'Could not compute a state_revision for this project.');
          }

          const binding = getBinding();
          const now = new Date();
          const ticket: OperationTicket = {
            operation_ticket_id: operationTicketId,
            operation_id: 'intent_amendment',
            project_id: binding.projectId ?? '',
            bound_role: binding.role ?? '',
            arguments_hash: stableHash({ change: args.change, purpose_changed: args.purpose_changed }),
            target: { artifact: 'intent', version: chain.intent.version, sha256: doc.sha256 },
            expected_state_revision: revision,
            effects: [
              `intent.amendments: +1 entry ${preview.next_amendment_id} (purpose_changed: ${args.purpose_changed ? 'yes' : 'no'}; change: "${args.change}")`,
              'Result commit supplied at commit time is verified; annotated tag ' + preview.next_tag + ' is created locally (never pushed)',
              'intent.certified_doc_sha256: certified from the reviewed file bytes (the document is not rewritten); APPROVED PLANs flagged for INTENT review',
            ],
            authority: 'director',
            issued_at: now.toISOString(),
            expires_at: new Date(now.getTime() + TICKET_TTL_MS).toISOString(),
            consumed_at: null,
            dependencies_sha256: preview.diff_sha256,
            review_package: {
              baseline_commit: preview.report.baseline?.commit,
              diff_stat: preview.diff.stat,
              diff_sha256: preview.diff_sha256,
              doc_sha256: preview.report.working_sha256,
              purpose_changed: args.purpose_changed,
              impact: preview.impact,
            },
          };
          writeTicket(root, ticket);

          return {
            operation_ticket_id: ticket.operation_ticket_id,
            operation_id: ticket.operation_id,
            target: ticket.target,
            effects: ticket.effects,
            expected_state_revision: ticket.expected_state_revision,
            expires_at: ticket.expires_at,
          };
        }
      );
    }
  );
}
