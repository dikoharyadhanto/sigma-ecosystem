import { ChainState } from '../engine/chain';
import { ArtifactType } from '../mcp/artifactPath';
import { TargetRef, CapturedFile } from './f08Store';
export declare function reviewChain(root: string, explicit?: string): {
    chainVersion: string;
    data: ChainState;
};
export declare function captureArtifact(root: string, chainVersion: string, type: ArtifactType, version: string): CapturedFile;
export declare function targetOnly(file: CapturedFile): TargetRef;
export interface Section {
    id: string;
    marker: string;
    body: string;
}
export declare function sectionsOf(text: string, type: string): Section[];
export interface SourceItem {
    id: string;
    section: string;
    text: string;
}
export declare function intentItems(text: string): SourceItem[];
export declare function matchReferences(plan: string, intent: string): {
    declared_intent_versions: string[];
    references: {
        id: string;
        role: string;
        status: string;
        matches: SourceItem[];
    }[];
};
export declare function reviewPlanSources(root: string, explicitVersion?: string, explicitChain?: string): {
    project_id: string;
    chain: string;
    plan: TargetRef;
    structure: {
        ok: boolean;
        schema: string | null;
        errors: string[];
        warnings: string[];
        requirements: import("../utils/docCheck").SigmaDocRequirement[];
    };
    certification: {
        plan_state: string;
        plan_revision: number | null;
        needs_intent_review: boolean;
        pending_notice: boolean;
        reference_is_plan_approval: boolean;
        current_intent_sha256: string | null;
        certified_intent_sha256: string | null;
        current_matches_certified: boolean | null;
        plan_intent_revision_ref: number | null;
        baseline: {
            status: string;
            sha256: null;
            content: string | null;
            origin: string | null;
        } | {
            status: string;
            sha256: string;
            content: string | null;
            origin: string | null;
        } | {
            status: string;
            sha256: string | null;
            content: null;
            origin: null;
        };
    };
    current_source: CapturedFile | null;
    current_references: {
        declared_intent_versions: string[];
        references: {
            id: string;
            role: string;
            status: string;
            matches: SourceItem[];
        }[];
    } | null;
    referenced_references: {
        declared_intent_versions: string[];
        references: {
            id: string;
            role: string;
            status: string;
            matches: SourceItem[];
        }[];
    } | null;
    named_sources: {
        quality_standards: Section[];
        planned_stage: Section[];
        roadmap: TargetRef | null;
        note: string;
    };
    semantic_readiness: {
        status: "UNKNOWN" | "READY" | "SCOPE_GAP" | "PENDING_ALIGNMENT";
        stale: boolean;
        assessment: import("./f08Store").Assessment;
    } | {
        status: string;
        stale: boolean;
        assessment: null;
    };
    findings: string[];
    grants_approval: boolean;
};
//# sourceMappingURL=sourceReviewService.d.ts.map