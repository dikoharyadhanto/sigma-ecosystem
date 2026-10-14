// Trusted CLI shares MCP's lease, journal and recovery implementation.
import crypto from 'crypto';
import {
  acquireProjectLock, recoverControlTransactions, beginControlTransaction,
  markControlTransactionCommitPending, markControlTransactionRollbackPending,
  finalizeControlTransaction, AuditEntry, CONTROL_MUTATION_MAX_MS,
} from './controlStore';
import { computeStateRevision } from '../mcp/contract';
import { readProjectIdentity } from './chain';
export async function localTransaction<T>(root: string, operation: string, actor: string, files: () => string[], mutate: () => T): Promise<T> {
  const lock = await acquireProjectLock(root);
  try {
    recoverControlTransactions(root); lock.assertOwned();
    const revision = computeStateRevision(root).revision;
    if (!revision) throw new Error('Project state unavailable.');
    const key = crypto.randomUUID();
    const audit: AuditEntry = {
      timestamp: new Date().toISOString(), correlation_id: key, project_id: readProjectIdentity(root).project_id,
      binding_fingerprint: null, bound_role: actor, channel: 'cli', operation_id: operation,
      operation_ticket_id: null, approval_id: null, idempotency_key_hash: key,
      state_revision_before: revision, state_revision_after: null, artifact_hash_before: null, artifact_hash_after: null, outcome: 'pending',
    };
    const journal = beginControlTransaction({ root, projectId: audit.project_id!, operationId: operation,
      boundRole: actor, idempotencyKey: key, argumentsHash: key, revisionBefore: revision,
      files: files(), auditEntry: audit, guardedWrites: true });
    try {
      const started = Date.now(), result = mutate();
      if (result && typeof (result as { then?: unknown }).then === 'function') throw new Error('CLI transaction must be synchronous.');
      if (Date.now() - started > CONTROL_MUTATION_MAX_MS) throw new Error('CLI mutation exceeded lease safety budget.');
      lock.assertOwned();
      const after = computeStateRevision(root).revision!;
      markControlTransactionCommitPending(root, journal, result, after, { ...audit, outcome: 'commit', state_revision_after: after });
      finalizeControlTransaction(root, journal);
      return result;
    } catch (error) {
      if (journal.status === 'prepared') {
        markControlTransactionRollbackPending(root, journal, (error as Error).message, { ...audit, outcome: 'deny' });
        finalizeControlTransaction(root, journal);
      }
      throw error;
    }
  } finally { await lock.release(); }
}
