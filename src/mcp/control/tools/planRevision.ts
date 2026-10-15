// WP-MCP-04 (Phase 3) — the controlled revision of an APPROVED PLAN, as three
// control tools mirroring `sigma plan revise prepare | ticket | commit`:
//
//   sigma_prepare_plan_revision       stage the candidate + the declaration
//   sigma_issue_plan_revision_ticket  freeze the review into a Director ticket
//   sigma_commit_plan_revision        certify the revision (ledger, snapshot)
//
// The evaluation between them is the query tool sigma_plan_revise_check.
//
// What is NOT here, on purpose:
//   - Editing the staged candidate. Like the CLI flow, the FMN edits
//     Sigma/revisions/staging/PLAN-<v>.md as a file. A whole-content writer for
//     it would be a second, separately bound way to alter a governance
//     document, and nothing requires it.
//   - Approval. Director approval is recorded through the trusted local CLI
//     (`sigma control approve`); no MCP tool writes one (as for every W2 flow).
//   - The CONTRACT_CHANGE notice to DEV. Sending stays a CLI/skill operation
//     (mailbox design is deferred); commit leaves the revision `pending_notice`
//     exactly as the CLI does.
//
// Approval is conditional, and this mirrors the engine rather than choosing:
// commit needs a ticket and an exact approval only when the declaration is a
// loosening or the `director` checkpoint (needsEarlyApproval). An ordinary
// pre/post-build revision commits without one and is reviewed with EXEC.
//
// Every engine function called here is the one the CLI calls; the tools add
// role binding (FMN), a state-revision check, and typed refusals.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  assertCanPrepareRevision, boundedPath, checkPlanRevision, commitPlanRevision, prepareRevisionTicket,
  preparePlanRevision, revisionPaths, revisionTransactionFiles, validateDirectorTicket, ChangeDeclaration,
} from '../../../engine/revisions';
import { approvalPath, generateId, ticketPath } from '../../../engine/controlStore';
import { ERROR_CODES, ErrorCode } from '../../contract';
import { McpQueryError } from '../../errors';
import { scrubHostPaths } from '../../tools/queryHelpers';
import { respondControlWrite, staleStateCheck } from '../shared';

const VERSION = z.string().regex(/^v\d+\.[1-9]\d*$/, 'PLAN version such as v1.1');
const SHA256 = z.string().regex(/^[0-9a-f]{64}$/);
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

/** The engine prefixes some refusals with a frozen code; keep it, type the rest INVALID_OPERATION. */
function refusal(root: string, e: unknown): never {
  if (e instanceof McpQueryError) throw e;
  const message = scrubHostPaths(e instanceof Error ? e.message : String(e), [root]);
  const prefixed = /^(STALE_STATE|STALE_ARTIFACT|APPROVAL_MISMATCH|APPROVAL_REQUIRED):/.exec(message);
  const code: ErrorCode = prefixed ? (prefixed[1] as ErrorCode) : ERROR_CODES.INVALID_OPERATION;
  throw new McpQueryError(code, message);
}

export function registerPlanRevisionTools(server: McpServer): void {
  // ── prepare: stage candidate + declaration ────────────────────────────────
  server.registerTool(
    'sigma_prepare_plan_revision',
    {
      title: 'Stage a revision of an APPROVED PLAN',
      description:
        'Copies the APPROVED PLAN `version` into the staging candidate and records the change declaration ' +
        '(checkpoint, reason, requester, explicit loosening, delta) — the control-plane equivalent of `sigma plan ' +
        'revise prepare`. FMN only. The canonical PLAN is not changed. Edit the candidate file ' +
        '(Sigma/revisions/staging/PLAN-<version>.md) yourself, put the declared reason and delta in its Contract ' +
        'Changes, then evaluate it with sigma_plan_revise_check. `loosening` is a human classification and must be ' +
        'stated, never inferred. An open candidate is refused unless replace_staging is true. Requires ' +
        'idempotency_key and expected_state_revision. Returns { candidate, staging, early_approval_required }.',
      inputSchema: {
        version: VERSION,
        checkpoint: z.enum(['pre-build', 'post-build', 'director']),
        reason: z.string().min(1).max(2000),
        requested_by: z.enum(['FMN', 'DEV', 'Director']),
        loosening: z.boolean(),
        delta: z.string().min(1).max(2000),
        replace_staging: z.boolean().optional(),
        idempotency_key: z.string().min(1),
        expected_state_revision: z.string().min(1),
      },
      annotations: WRITE,
    },
    async (args) => {
      const declaration: ChangeDeclaration = {
        checkpoint: args.checkpoint, reason: args.reason, requested_by: args.requested_by,
        loosening: args.loosening, delta: args.delta,
      };
      const stale = staleStateCheck(args.expected_state_revision);
      return respondControlWrite(
        {
          tool: 'sigma_prepare_plan_revision',
          operationId: 'plan_revise_prepare',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: { ...declaration, version: args.version, replace_staging: args.replace_staging ?? false },
          allowedRoles: ['FMN'],
          guardedWrites: true,
          checkPreconditions: (root) => {
            stale(root);
            try { assertCanPrepareRevision(root, args.version, declaration, !!args.replace_staging); } catch (e) { refusal(root, e); }
          },
          transactionFiles: (root) => {
            const p = revisionPaths(args.version);
            return [boundedPath(root, p.candidate), boundedPath(root, p.staging)];
          },
        },
        (root) => {
          try {
            const out = preparePlanRevision(root, args.version, declaration, !!args.replace_staging);
            return {
              version: args.version,
              candidate: out.candidate,
              staging: out.metadata,
              early_approval_required: declaration.loosening || declaration.checkpoint === 'director',
            };
          } catch (e) {
            return refusal(root, e);
          }
        },
      );
    },
  );

  // ── ticket: freeze the review for the Director ────────────────────────────
  server.registerTool(
    'sigma_issue_plan_revision_ticket',
    {
      title: 'Issue a Director approval ticket for a PLAN revision',
      description:
        'Freezes the current revision review (candidate hash, dependencies, state revision) into a single-use ' +
        'operation ticket — the control-plane equivalent of `sigma plan revise ticket`. FMN only. Needed only when ' +
        'the declaration is a loosening or the `director` checkpoint; an ordinary revision commits without one. ' +
        'The ticket grants no authority: the Director reviews it and records approval through the trusted local ' +
        'CLI (`sigma control show` / `sigma control approve <ticket> --director-confirm`). No MCP tool records an ' +
        'approval. Changes no PLAN, ledger, or chain state. Requires idempotency_key and expected_state_revision. ' +
        'Returns the ticket, including its review_package.',
      inputSchema: {
        version: VERSION,
        idempotency_key: z.string().min(1),
        expected_state_revision: z.string().min(1),
      },
      annotations: WRITE,
    },
    async (args) => {
      const id = generateId('opt');
      const stale = staleStateCheck(args.expected_state_revision);
      return respondControlWrite(
        {
          tool: 'sigma_issue_plan_revision_ticket',
          operationId: 'plan_revise_ticket',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: { version: args.version },
          allowedRoles: ['FMN'],
          guardedWrites: true,
          checkPreconditions: (root) => {
            stale(root);
            try { checkPlanRevision(root, args.version); } catch (e) { refusal(root, e); }
          },
          transactionFiles: (root) => [ticketPath(root, id)],
        },
        (root) => {
          try {
            const ticket = prepareRevisionTicket(root, args.version, id);
            return { ...ticket, early_approval_required: ticket.review_package ? (ticket.review_package as { early_approval_required?: boolean }).early_approval_required : undefined };
          } catch (e) {
            return refusal(root, e);
          }
        },
      );
    },
  );

  // ── commit: certify ───────────────────────────────────────────────────────
  server.registerTool(
    'sigma_commit_plan_revision',
    {
      title: 'Commit a PLAN revision',
      description:
        'Certifies the staged revision of the APPROVED PLAN `version`: next revision number, snapshot, ledger ' +
        'entry, canonical PLAN replaced by the candidate — the control-plane equivalent of `sigma plan revise ' +
        'commit`. FMN only. `expected_candidate_sha256` must be the candidate_sha256 you got from ' +
        'sigma_plan_revise_check, so exactly what was reviewed is what is certified. When the declaration is a ' +
        'loosening or the `director` checkpoint, operation_ticket_id and approval_id (a Director approval recorded ' +
        'through the trusted local CLI for that exact candidate) are required and are consumed once; otherwise ' +
        'they are not needed. The revision is left `pending_notice`: DEV must be notified with a CONTRACT_CHANGE ' +
        'message (a CLI/skill operation) and acknowledge it. Requires idempotency_key and ' +
        'expected_state_revision. Returns { version, revision, revision_id, status }.',
      inputSchema: {
        version: VERSION,
        expected_candidate_sha256: SHA256,
        operation_ticket_id: z.string().min(1).optional(),
        approval_id: z.string().min(1).optional(),
        idempotency_key: z.string().min(1),
        expected_state_revision: z.string().min(1),
      },
      annotations: { ...WRITE, destructiveHint: true },
    },
    async (args) => {
      const stale = staleStateCheck(args.expected_state_revision);
      let needsApproval = false;
      return respondControlWrite(
        {
          tool: 'sigma_commit_plan_revision',
          operationId: 'plan_revise_commit',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {
            version: args.version, expected_candidate_sha256: args.expected_candidate_sha256,
            operation_ticket_id: args.operation_ticket_id ?? null, approval_id: args.approval_id ?? null,
          },
          allowedRoles: ['FMN'],
          guardedWrites: true,
          operationTicketId: args.operation_ticket_id,
          approvalId: args.approval_id,
          artifactHashBefore: args.expected_candidate_sha256,
          checkPreconditions: (root) => {
            stale(root);
            try {
              const review = checkPlanRevision(root, args.version);
              if (review.candidate_sha256 !== args.expected_candidate_sha256) {
                throw new McpQueryError(ERROR_CODES.STALE_ARTIFACT, 'The candidate changed since it was checked; run sigma_plan_revise_check again.');
              }
              needsApproval = review.early_approval_required;
              if (needsApproval) {
                if (!args.operation_ticket_id || !args.approval_id) {
                  throw new McpQueryError(ERROR_CODES.APPROVAL_REQUIRED,
                    'This revision is a loosening or a director checkpoint: issue a ticket, have the Director approve it through the trusted local CLI, then commit with operation_ticket_id and approval_id.');
                }
                validateDirectorTicket(root, args.operation_ticket_id, args.approval_id, 'plan_revise', args.version, review.candidate_sha256, review.dependencies_sha256);
              }
            } catch (e) { refusal(root, e); }
          },
          transactionFiles: (root) => [
            ...revisionTransactionFiles(root, args.version),
            ...(needsApproval && args.operation_ticket_id ? [ticketPath(root, args.operation_ticket_id)] : []),
            ...(needsApproval && args.approval_id ? [approvalPath(root, args.approval_id)] : []),
          ],
        },
        (root) => {
          try {
            const out = commitPlanRevision(root, args.version, needsApproval ? args.operation_ticket_id : undefined, needsApproval ? args.approval_id : undefined);
            return { ...out, notice: 'pending: send CONTRACT_CHANGE to DEV (CLI/skill) and have DEV acknowledge it' };
          } catch (e) {
            return refusal(root, e);
          }
        },
      );
    },
  );
}
