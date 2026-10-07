"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.governanceMutationUnderLease = governanceMutationUnderLease;
exports.withGovernanceTransaction = withGovernanceTransaction;
const crypto_1 = __importDefault(require("crypto"));
const chain_1 = require("./chain");
const contract_1 = require("../mcp/contract");
const controlStore_1 = require("./controlStore");
/** Caller already owns the shared lease (e.g. sigma send). Mutation is synchronous. */
function governanceMutationUnderLease(root, operation, files, mutate, assertOwned) {
    assertOwned();
    (0, controlStore_1.recoverControlTransactions)(root);
    const identity = (0, chain_1.readProjectIdentity)(root);
    const before = (0, contract_1.computeStateRevision)(root).revision ?? 'unknown';
    const audit = { timestamp: new Date().toISOString(), correlation_id: crypto_1.default.randomUUID(), project_id: identity.project_id, binding_fingerprint: null, bound_role: 'Director', channel: 'cli', operation_id: operation, operation_ticket_id: null, approval_id: null, idempotency_key_hash: crypto_1.default.randomUUID(), state_revision_before: before, state_revision_after: null, artifact_hash_before: null, artifact_hash_after: null, outcome: 'committed' };
    const journal = (0, controlStore_1.beginControlTransaction)({ root, projectId: identity.project_id, operationId: operation, boundRole: 'Director', idempotencyKey: crypto_1.default.randomUUID(), argumentsHash: crypto_1.default.randomUUID(), revisionBefore: before, files, auditEntry: audit, guardedWrites: true });
    let committed = false;
    try {
        assertOwned();
        const result = mutate();
        assertOwned();
        if (result && typeof result.then === 'function')
            throw new Error('Governance mutations must be synchronous.');
        const after = (0, contract_1.computeStateRevision)(root).revision ?? 'unknown';
        (0, controlStore_1.markControlTransactionCommitPending)(root, journal, result, after, { ...audit, state_revision_after: after });
        committed = true;
        (0, controlStore_1.controlTestFailpoint)('governance_after_commit_marker');
        (0, controlStore_1.finalizeControlTransaction)(root, journal);
        return result;
    }
    catch (e) {
        if (!committed) {
            (0, controlStore_1.markControlTransactionRollbackPending)(root, journal, e.message, { ...audit, outcome: 'rolled_back', state_revision_after: before });
            (0, controlStore_1.finalizeControlTransaction)(root, journal);
        }
        throw e;
    }
}
/** CLI adapter for the same project lease and journal used by MCP. */
async function withGovernanceTransaction(root, operation, files, mutate) {
    const lock = await (0, controlStore_1.acquireProjectLock)(root);
    try {
        lock.assertOwned();
        (0, controlStore_1.recoverControlTransactions)(root);
        return governanceMutationUnderLease(root, operation, files(), mutate, lock.assertOwned);
    }
    finally {
        await lock.release();
    }
}
//# sourceMappingURL=governanceTransaction.js.map