export interface DecisionEntry {
    artifact: 'INTENT' | 'ROADMAP' | 'PLAN' | 'EXEC' | 'CLOSE';
    version: string;
    lock_event: 'intent.lock' | 'roadmap.lock' | 'plan.lock' | 'exec.lock' | 'close.lock';
    source_file: string;
    timestamp: string;
    director_notes: string;
    risk_notes: string;
    evidence_references: string;
    stage_summary?: string;
    recommended_next_plan?: string;
    pending_items?: string;
    task_plan_summary?: string;
    test_contract_summary?: string;
    implementation_summary?: string;
    known_issues?: string;
    plan_refs?: string;
    exec_refs?: string;
    closure_verdict?: string;
    accepted_limitations?: string;
}
export declare function harvestIntentLock(projectRoot: string, version: string, sourceFile: string): void;
export declare function harvestRoadmapLock(projectRoot: string, version: string, sourceFile: string): void;
export declare function harvestPlanLock(projectRoot: string, version: string, sourceFile: string): void;
export declare function harvestExecLock(projectRoot: string, version: string, sourceFile: string): void;
export declare function harvestCloseLock(projectRoot: string, version: string, sourceFile: string): void;
export declare function initDecisionsFile(projectRoot: string): void;
//# sourceMappingURL=memory.d.ts.map