import { ChainState } from '../engine/chain';
export type ApprovalDomain = 'plan' | 'exec';
export declare function resolveApprovalTarget(chain: ChainState, domain: ApprovalDomain, explicit?: string): string;
export declare function approvalReview(root: string, domain: ApprovalDomain, explicit?: string): {
    dependencies_sha256: string;
    chain: string;
    lifecycle_model: import("../engine/lifecycle").LifecycleModel;
    domain: ApprovalDomain;
    version: string;
    target_sha256: string;
    source: any;
    plan_revision: number | undefined;
    acknowledgement: {
        revision: number | undefined;
        hash: string | undefined;
        at: string | undefined;
    } | null;
    deltas: any[];
    blockers: string[];
    document_valid: boolean;
    document_requirements: import("../utils/docCheck").SigmaDocRequirement[];
    advisory_document: string;
    effects: string[];
    legacy_evidence_limit: string | null;
};
export declare function ensureApprovalReady(review: ReturnType<typeof approvalReview>): void;
export declare function approveArtifactTransactionFiles(root: string, domain: ApprovalDomain, explicit?: string): string[];
export declare function approveArtifactUseCase(root: string, domain: ApprovalDomain, explicit?: string, receipt?: {
    channel: string;
    ticket_id?: string;
    approval_id?: string;
}): {
    lifecycle_model: string;
    state: string;
    chainVersion: string;
    version: string;
    docReport: import("../utils/docCheck").SigmaDocCheckReport;
    revision?: undefined;
    gate3Satisfied?: undefined;
} | {
    chainVersion: string;
    version: string;
    lifecycle_model: string;
    state: string;
    revision: number | undefined;
    gate3Satisfied: boolean;
};
//# sourceMappingURL=approvalService.d.ts.map