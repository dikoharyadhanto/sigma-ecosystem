import { ChainState } from './chain';
export declare function effectiveLifecycleGates(root: string, chain: ChainState): {
    gate_1_open: boolean;
    gate_2_open: boolean;
    gate_3_satisfied: boolean;
};
export declare function lifecycleView(root: string, chain: ChainState): {
    lifecycle_model: import("./lifecycle").LifecycleModel;
    effective_gates: {
        gate_1_open: boolean;
        gate_2_open: boolean;
        gate_3_satisfied: boolean;
    };
    lifecycle_warnings: string[];
    plans: {
        version: string;
        state: string;
        revision: number | null;
        contract_sha256: string | null;
        intent_revision_ref: number | null;
        needs_intent_review: boolean;
        pending_notice: boolean;
        historical_legacy: boolean;
        blockers: string[];
    }[];
    execs: {
        version: string;
        state: string;
        plan: string | null;
        plan_revision_ref: number | null;
        plan_contract_sha256_ref: string | null;
        acknowledged_at: string | null;
        blockers: string[];
    }[];
    approval_blockers: string[];
};
//# sourceMappingURL=lifecycleView.d.ts.map