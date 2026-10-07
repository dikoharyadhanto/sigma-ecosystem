import crypto from 'crypto';
import { readProjectIdentity } from './chain';
import { computeStateRevision } from '../mcp/contract';
import { acquireProjectLock, recoverControlTransactions, beginControlTransaction, markControlTransactionCommitPending, markControlTransactionRollbackPending, finalizeControlTransaction, AuditEntry, controlTestFailpoint } from './controlStore';
/** Caller already owns the shared lease (e.g. sigma send). Mutation is synchronous. */
export function governanceMutationUnderLease<T>(root: string, operation: string, files: string[], mutate: () => T, assertOwned: () => void): T {
    assertOwned();
    recoverControlTransactions(root);
    const identity = readProjectIdentity(root);
    const before = computeStateRevision(root).revision ?? 'unknown';
    const audit: AuditEntry = { timestamp: new Date().toISOString(), correlation_id: crypto.randomUUID(), project_id: identity.project_id, binding_fingerprint: null, bound_role: 'Director', channel: 'cli', operation_id: operation, operation_ticket_id: null, approval_id: null, idempotency_key_hash: crypto.randomUUID(), state_revision_before: before, state_revision_after: null, artifact_hash_before: null, artifact_hash_after: null, outcome: 'committed' };
    const journal = beginControlTransaction({ root, projectId: identity.project_id, operationId: operation, boundRole: 'Director', idempotencyKey: crypto.randomUUID(), argumentsHash: crypto.randomUUID(), revisionBefore: before, files, auditEntry: audit, guardedWrites: true });
    let committed = false;
    try {
        assertOwned();
        const result = mutate();
        assertOwned();
        if (result && typeof (result as any).then === 'function')
            throw new Error('Governance mutations must be synchronous.');
        const after = computeStateRevision(root).revision ?? 'unknown';
        markControlTransactionCommitPending(root, journal, result, after, { ...audit, state_revision_after: after });
        committed = true;
        controlTestFailpoint('governance_after_commit_marker');
        finalizeControlTransaction(root, journal);
        return result;
    }
    catch (e) {
        if (!committed) {
            markControlTransactionRollbackPending(root, journal, (e as Error).message, { ...audit, outcome: 'rolled_back', state_revision_after: before });
            finalizeControlTransaction(root, journal);
        }
        throw e;
    }
}
/** CLI adapter for the same project lease and journal used by MCP. */
export async function withGovernanceTransaction<T>(root: string, operation: string, files: () => string[], mutate: () => T): Promise<T> {
    const lock = await acquireProjectLock(root);
    try {
        lock.assertOwned();
        recoverControlTransactions(root);
        return governanceMutationUnderLease(root, operation, files(), mutate, lock.assertOwned);
    }
    finally {
        await lock.release();
    }
}
