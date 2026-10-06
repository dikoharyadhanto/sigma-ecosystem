// Stage E W1 — sigma_inbox_archive's shared service. Refactored out of an
// MCP-only implementation (formerly src/mcp/control/inboxArchive.ts) after
// Codex's independent review (finding H-02, 2026-09-16) flagged the
// MCP-only version as violating Plan Doc invariant #9 ("same use case, two
// adapters") and §13's service-layer rule: a mutation use case must have
// exactly one implementation shared by CLI and MCP, not two.
//
// CLI `sigma inbox archive <id>` (src/commands/inbox.ts) has no role/
// binding concept at all — any caller who knows a message ID can archive
// any role's message, because the CLI never filters on `entry.to`. That is
// tolerable for a trusted human at a terminal; it is a real gap once this
// becomes callable by an AI role/orchestrator through MCP, which is the
// same class of concern that got sigma_list_messages/sigma_read_message
// reverted by Director after Codex found role-mismatch issues (capability
// matrix §3.6). Director decision (2026-09-16, clarifying this specific
// primitive): add an ownership check — a bound role may only archive a
// message addressed to itself — without changing CLI behavior.
//
// Reconciled with the shared-service invariant via `actorRole: string |
// null`: null means "trusted CLI caller, no ownership enforced" (CLI
// passes null, preserving today's exact behavior byte-for-byte); a role
// string means "MCP bound-role caller" and enforces `entry.to ===
// actorRole`. One function, one code path, two call-time policies — not
// two implementations.

import path from 'path';
import { readIndex, writeIndex, updateMessageStatus } from '../engine/mailbox';
import { MESSAGES_INDEX_FILE } from '../config';
import { controlTestFailpoint } from '../engine/controlStore';

export class InboxArchiveError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'InboxArchiveError';
  }
}

export interface ArchiveMessageInput {
  projectRoot: string;
  messageId: string;
  /** null = trusted CLI caller, no ownership check enforced. A role string
   *  = MCP bound-role caller, enforced against the message's `to` field. */
  actorRole: string | null;
}

export interface ArchiveMessageResult {
  id: string;
  status: 'ARCHIVED';
}

export function archiveMessageTransactionFiles(projectRoot: string): string[] {
  return [path.join(projectRoot, MESSAGES_INDEX_FILE)];
}

export function archiveMessage(input: ArchiveMessageInput): ArchiveMessageResult {
  const { projectRoot, messageId, actorRole } = input;
  const index = readIndex(projectRoot);
  const entry = index.messages.find(m => m.id === messageId);
  if (!entry) {
    throw new InboxArchiveError('INVALID_OPERATION', `Message not found: ${messageId}`);
  }
  if (actorRole !== null && entry.to !== actorRole) {
    throw new InboxArchiveError(
      'ROLE_NOT_AUTHORIZED',
      `Message ${messageId} is addressed to ${entry.to}, not ${actorRole}. A role may only archive its own messages.`
    );
  }

  updateMessageStatus(index, messageId, 'ARCHIVED');
  controlTestFailpoint('inbox_archive_after_status');
  writeIndex(projectRoot, index);
  controlTestFailpoint('inbox_archive_after_write');

  return { id: messageId, status: 'ARCHIVED' };
}
