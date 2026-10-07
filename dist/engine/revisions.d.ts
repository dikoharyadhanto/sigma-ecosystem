import { ChainState } from './chain';
import { OperationTicket } from './controlStore';
export declare const sha256: (bytes: string | Buffer) => string;
export declare const normalizeDocument: (text: string) => string;
export declare function splitPlanContract(text: string): {
    contract: string;
    audit: string;
};
export declare const planContractHash: (text: string) => string;
export declare function assertAuditAppendOnly(before: string, current: string): void;
export declare function boundedPath(root: string, relative: string): string;
export declare function artifactFile(root: string, chain: ChainState, type: 'intent' | 'plan' | 'exec', version: string): string;
export declare function revisionPaths(version: string, revision?: number): {
    ledger: string;
    snapshot: string;
    candidate: string;
    staging: string;
};
export interface ChangeDeclaration {
    checkpoint: 'pre-build' | 'post-build' | 'director';
    reason: string;
    requested_by: 'FMN' | 'DEV' | 'Director';
    loosening: boolean;
    delta: string;
}
export interface NoticeReceipt {
    message_id: string;
    from: 'FMN';
    to: 'DEV';
    intent: string;
    plan: string;
    revision: number;
    contract_sha256: string;
    created_at: string;
    file: string;
    file_sha256: string;
    payload_sha256: string;
}
export interface RevisionRecord {
    revision: number;
    revision_id: string;
    snapshot: string;
    snapshot_sha256: string;
    contract_sha256: string;
    intent_revision_ref: number;
    intent_doc_sha256_ref: string;
    created_at: string;
    provenance: 'initial_approval' | 'imported_baseline' | 'revision';
    declaration?: ChangeDeclaration;
    authorization?: {
        ticket: OperationTicket;
        approval: import('./controlStore').ApprovalRecord;
    };
    notice?: NoticeReceipt;
    approved_with_exec_at?: string;
}
export interface RevisionLedger {
    format: 1;
    intent: string;
    plan: string;
    records: RevisionRecord[];
}
export declare function currentIntent(root: string, chain: ChainState): {
    revision: number;
    hash: string;
};
export declare function readRevisionLedger(root: string, chain: ChainState, version: string): RevisionLedger;
export declare function assertPlanCertified(root: string, chain: ChainState, version: string, requireIntent?: boolean): RevisionLedger;
export declare function validateDeclaration(value: unknown): asserts value is ChangeDeclaration;
export declare const needsEarlyApproval: (d: ChangeDeclaration) => boolean;
export declare function verifyNotice(root: string, ledger: RevisionLedger, record: RevisionRecord): void;
export declare function assertAllNotices(root: string, ledger: RevisionLedger): void;
export declare function recordNotice(root: string, version: string, revision: number, receipt: NoticeReceipt): void;
export declare function roadmapTransactionFiles(root: string, chain: ChainState): string[];
export declare function renderGovernanceRoadmap(root: string, chain: ChainState): void;
export declare function certifyPlanBaseline(root: string, chain: ChainState, version: string, expectedSha?: string, expectedIntentSha?: string): void;
export declare function revisionTransactionFiles(root: string, version: string): string[];
export interface RevisionStage {
    format: 1;
    intent: string;
    plan: string;
    base_revision: number;
    base_contract_sha256: string;
    base_ledger_sha256: string;
    declaration: ChangeDeclaration;
}
export declare function preparePlanRevision(root: string, version: string, declaration: ChangeDeclaration, replaceStaging?: boolean): {
    candidate: string;
    metadata: string;
};
export declare function checkPlanRevision(root: string, version: string): {
    version: string;
    next_revision: number;
    candidate: string;
    candidate_sha256: string;
    contract_sha256: string;
    intent: {
        revision: number;
        hash: string;
    };
    stage: RevisionStage;
    diff: {
        from_line: number;
        removed: string[];
        added: string[];
        ac_test_ids: string[];
        classification: string;
    };
    early_approval_required: boolean;
    dependencies_sha256: string;
};
export declare function contractDiff(before: string, after: string): {
    from_line: number;
    removed: string[];
    added: string[];
    ac_test_ids: string[];
    classification: string;
};
export declare function prepareRevisionTicket(root: string, version: string, ticketId?: string): OperationTicket;
export declare function validateDirectorTicket(root: string, ticketId: string, approvalId: string, operation: string, version: string, hash: string, dependencies: string): {
    ticket: OperationTicket;
    approval: import("./controlStore").ApprovalRecord;
};
export declare function commitPlanRevision(root: string, version: string, ticketId?: string, approvalId?: string): {
    version: string;
    revision: number;
    revision_id: string;
    status: string;
};
export declare function acknowledgePlan(root: string, version: string, revision: number): {
    version: string;
    revision: number;
    acknowledged_at: string;
    coding_authorized: boolean;
};
export declare function approveLedgerWithExec(root: string, chain: ChainState, version: string, time: string): void;
//# sourceMappingURL=revisions.d.ts.map