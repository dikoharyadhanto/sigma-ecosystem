import { LifecycleState, PlanTracker, ArtifactTracker, ArtifactVersion, Gates, RuntimeInvalidState, InvalidGateKey, InvalidMarker, OverrideEntry } from './progress';
export type IntentState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type RoadmapState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type CloseState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export interface SingleIntentState {
    version: string;
    state: IntentState;
    file?: string;
    created_at: string;
    updated_at: string;
    locked_at?: string;
    supersede_reason?: string;
}
export interface SingleRoadmapState {
    version: string;
    state: RoadmapState;
    file?: string;
    created_at: string;
    updated_at: string;
    locked_at?: string;
    supersede_reason?: string;
}
export interface SingleCloseState {
    version: string;
    state: CloseState;
    file?: string;
    created_at: string;
    updated_at: string;
    locked_at?: string;
    supersede_reason?: string;
}
export interface ChainState {
    schema_version: string;
    chain_version: string;
    created_at: string;
    updated_at: string;
    lifecycle_state: LifecycleState;
    intent: SingleIntentState;
    roadmap: SingleRoadmapState | null;
    plan: PlanTracker;
    exec: ArtifactTracker;
    close: SingleCloseState | null;
    gates: Gates;
    runtime_invalid?: RuntimeInvalidState;
}
export interface ActivateStatus {
    active_chain: string | null;
}
export interface ProjectIdentity {
    schema_version: string;
    project_id: string;
    project_name: string;
    registered: true;
    logs_created_at: string;
}
export declare function chainFilePath(projectRoot: string, chainVersion: string): string;
export declare function activateStatusPath(projectRoot: string): string;
export declare function listChainVersions(projectRoot: string): string[];
export declare function nextChainVersion(projectRoot: string): string;
export declare function readActivateStatus(projectRoot: string): ActivateStatus;
export declare function writeActivateStatus(projectRoot: string, activeChain: string | null): void;
export declare function resolveActiveChainVersion(projectRoot: string): string;
export declare function readChain(projectRoot: string, chainVersion: string): ChainState;
export declare function writeChain(projectRoot: string, chainVersion: string, data: ChainState): void;
export declare function readActiveChain(projectRoot: string): {
    chainVersion: string;
    data: ChainState;
};
export declare function readProjectIdentity(projectRoot: string): ProjectIdentity;
export declare function createInitialChain(chainVersion: string, intentFilePath: string): ChainState;
export declare function hasActiveLockedIntent(chain: ChainState): boolean;
export declare function hasCleanGate2Chain(chain: ChainState): boolean;
export declare function hasCleanGate3Chain(chain: ChainState): boolean;
export declare function validateChainSemantics(chain: ChainState): void;
export declare function hasInvalidRuntime(chain: ChainState): boolean;
export declare function getInvalidMarkers(chain: ChainState): InvalidMarker[];
export declare function isGateInvalid(chain: ChainState, gate: InvalidGateKey): boolean;
export declare function getGateStatusLabel(chain: ChainState, gate: InvalidGateKey): 'OPEN' | 'BLOCKED' | 'SATISFIED' | 'INVALID';
export declare function getOperationalGate(chain: ChainState, gate: InvalidGateKey): boolean;
export declare function getInvalidWarningLines(chain: ChainState): string[];
export declare function assertChainCanMutate(chain: ChainState): void;
export declare function getGateStatus(chain: ChainState): Gates;
export interface DoctorReport {
    repaired: string[];
    invalidMarked: InvalidMarker[];
    invalidCleared: InvalidMarker[];
    remainingInvalid: InvalidMarker[];
}
export declare function runDoctorReconciliation(chain: ChainState, overrides?: OverrideEntry[]): DoctorReport;
export declare function nextPlanVersion(chain: ChainState, intentVersionRef: string): string;
export declare function nextExecVersion(chain: ChainState, planVersionRef: string): string;
export declare function lockActiveIntent(chain: ChainState): void;
export interface IntentCascadeTargets {
    roadmap: SingleRoadmapState | null;
    plan: ArtifactVersion[];
    exec: ArtifactVersion[];
    close: SingleCloseState | null;
}
export declare function previewIntentSupersedeCascade(chain: ChainState): IntentCascadeTargets;
export declare function supersedeIntentVersion(chain: ChainState, reason: string): void;
export declare function registerRoadmapDraft(chain: ChainState, filePath: string): void;
export declare function lockActiveRoadmap(chain: ChainState): void;
export declare function registerPlanDraft(chain: ChainState, version: string, filePath: string, intentVersionRef: string, title?: string, focus?: string): void;
export declare function updatePlanMetadata(chain: ChainState, version: string, title?: string, focus?: string): void;
export declare function lockOldestPlanDraft(chain: ChainState): string;
export declare function registerPendingPlan(chain: ChainState, id: string, filePath: string, title?: string, focus?: string): void;
export declare function promotePendingPlan(chain: ChainState, id: string, version: string, newFilePath: string, intentVersionRef: string, title?: string, focus?: string): void;
export declare function supersedePlanVersion(chain: ChainState, version: string, reason: string): void;
export declare function activatePlanDraft(chain: ChainState, version: string): void;
export declare function registerExecDraft(chain: ChainState, version: string, filePath: string, planVersionRef: string): void;
export declare function lockActiveExec(chain: ChainState): void;
export declare function registerCloseDraft(chain: ChainState, filePath: string): void;
export declare function lockActiveClose(chain: ChainState): void;
export declare function getNextValidOperations(chain: ChainState): string[];
//# sourceMappingURL=chain.d.ts.map