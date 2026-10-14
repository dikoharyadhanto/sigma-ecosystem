"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.localTransaction = localTransaction;
// Trusted CLI shares MCP's lease, journal and recovery implementation.
const crypto_1 = __importDefault(require("crypto"));
const controlStore_1 = require("./controlStore");
const contract_1 = require("../mcp/contract");
const chain_1 = require("./chain");
async function localTransaction(root, operation, actor, files, mutate) {
    const lock = await (0, controlStore_1.acquireProjectLock)(root);
    try {
        (0, controlStore_1.recoverControlTransactions)(root);
        lock.assertOwned();
        const revision = (0, contract_1.computeStateRevision)(root).revision;
        if (!revision)
            throw new Error('Project state unavailable.');
        const key = crypto_1.default.randomUUID();
        const audit = {
            timestamp: new Date().toISOString(), correlation_id: key, project_id: (0, chain_1.readProjectIdentity)(root).project_id,
            binding_fingerprint: null, bound_role: actor, channel: 'cli', operation_id: operation,
            operation_ticket_id: null, approval_id: null, idempotency_key_hash: key,
            state_revision_before: revision, state_revision_after: null, artifact_hash_before: null, artifact_hash_after: null, outcome: 'pending',
        };
        const journal = (0, controlStore_1.beginControlTransaction)({ root, projectId: audit.project_id, operationId: operation,
            boundRole: actor, idempotencyKey: key, argumentsHash: key, revisionBefore: revision,
            files: files(), auditEntry: audit, guardedWrites: true });
        try {
            const started = Date.now(), result = mutate();
            if (result && typeof result.then === 'function')
                throw new Error('CLI transaction must be synchronous.');
            if (Date.now() - started > controlStore_1.CONTROL_MUTATION_MAX_MS)
                throw new Error('CLI mutation exceeded lease safety budget.');
            lock.assertOwned();
            const after = (0, contract_1.computeStateRevision)(root).revision;
            (0, controlStore_1.markControlTransactionCommitPending)(root, journal, result, after, { ...audit, outcome: 'commit', state_revision_after: after });
            (0, controlStore_1.finalizeControlTransaction)(root, journal);
            return result;
        }
        catch (error) {
            if (journal.status === 'prepared') {
                (0, controlStore_1.markControlTransactionRollbackPending)(root, journal, error.message, { ...audit, outcome: 'deny' });
                (0, controlStore_1.finalizeControlTransaction)(root, journal);
            }
            throw error;
        }
    }
    finally {
        await lock.release();
    }
}
//# sourceMappingURL=localTransaction.js.map