import { ArtifactType } from '../mcp/artifactPath';
import { CapturedFile, AuditPack, Assessment } from './f08Store';
export declare function activeTarget(root: string, type: ArtifactType, version: string): CapturedFile;
export declare function createAuditPack(root: string, type: ArtifactType, version: string, expectedHash: string, includeEvidence?: boolean): {
    id: string;
    manifest_sha256: string;
    target: import("./f08Store").TargetRef;
    missing: string[];
    grants_approval: boolean;
};
export declare function auditPackStatus(root: string, packId: string): {
    pack: AuditPack;
    stale: boolean;
    changes: string[];
    responses: import("./f08Store").AuditResponse[];
    grants_approval: boolean;
};
export declare function renderAuditPack(root: string, packId: string): string;
export declare function recordAuditResponse(root: string, packId: string, raw: string, origin: string, expectedPackHash: string, actor: string): {
    id: string;
    pack_id: string;
    pack_sha256: string;
    raw: string;
    sha256: string;
    origin: string;
    recorded_by: string;
    created_at: string;
};
export declare function addQuestion(root: string, type: ArtifactType, version: string, question: string, expectedHash: string, actor: string): {
    id: string;
    target: import("./f08Store").TargetRef;
    question: string;
    created_by: string;
    created_at: string;
};
export declare function resolveQuestion(root: string, questionId: string, answer: string, expectedHash: string, directorConfirmed: boolean): {
    grants_approval: boolean;
    id: string;
    target: import("./f08Store").TargetRef;
    question: string;
    created_by: string;
    created_at: string;
    answer?: string;
    resolved_at?: string;
    resolved_by?: string;
    resolution_sha256?: string;
};
export declare function recordReadiness(root: string, version: string, status: Assessment['status'], reason: string, expectedHash: string, expectedSourceHash: string, actor: string): {
    grants_approval: boolean;
    id: string;
    target: import("./f08Store").TargetRef;
    source_sha256: string;
    status: "READY" | "SCOPE_GAP" | "PENDING_ALIGNMENT" | "UNKNOWN";
    reason: string;
    recorded_by: "FMN";
    created_at: string;
};
export declare function listDecisions(root: string, explicitChain?: string, history?: boolean): {
    chain: string;
    substantive: {
        stale: boolean;
        needs_review: boolean;
        status: string;
        id: string;
        target: import("./f08Store").TargetRef;
        question: string;
        created_by: string;
        created_at: string;
        answer?: string;
        resolved_at?: string;
        resolved_by?: string;
        resolution_sha256?: string;
    }[];
    transactions: {
        ticket_id: string;
        operation: string;
        target: {
            artifact: string;
            version: string;
            sha256: string;
        } | null;
        status: string;
    }[];
    grants_approval: boolean;
};
export declare function f08TransactionFiles(root: string): string[];
//# sourceMappingURL=auditDecisionService.d.ts.map