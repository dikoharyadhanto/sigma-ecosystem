export type LifecycleState = 'DESIGN' | 'BUILD' | 'CLOSE' | 'CLOSED';
export type IntentState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type PlanState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type ExecState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type CloseState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type RoadmapState = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'SUPERSEDED';
export interface ArtifactVersion {
    version: string;
    state: string;
    file?: string;
    created_at: string;
    updated_at: string;
    locked_at?: string;
    superseded_by?: string;
    supersede_reason?: string;
    stale_intent?: boolean;
    intent_version_ref?: string;
    plan_version_ref?: string;
    title?: string;
    focus?: string;
}
export interface ArtifactTracker {
    active_version: string | null;
    active_state: string | null;
    versions: ArtifactVersion[];
}
export interface PendingPlanEntry {
    id: string;
    file: string;
    created_at: string;
}
export interface PlanTracker extends ArtifactTracker {
    pending: PendingPlanEntry[];
}
export interface Gates {
    gate_1_open: boolean;
    gate_2_open: boolean;
    gate_3_satisfied: boolean;
}
export type InvalidGateKey = 'gate_1_open' | 'gate_2_open' | 'gate_3_satisfied';
export type InvalidMarkerDomain = ArtifactDomain | 'gates';
export interface InvalidChainRef {
    intent_version: string | null;
    plan_version: string | null;
    exec_version: string | null;
}
export interface InvalidMarker {
    id: string;
    domain: InvalidMarkerDomain;
    status: 'INVALID';
    reason: string;
    gate?: InvalidGateKey;
    chain: InvalidChainRef;
    first_detected_at: string;
    last_detected_at: string;
}
export interface RuntimeInvalidState {
    markers: InvalidMarker[];
    last_doctor_run_at: string | null;
}
export interface ProgressJson {
    schema_version: string;
    project_id: string;
    project_name: string;
    lifecycle_state: LifecycleState;
    created_at: string;
    updated_at: string;
    intent: ArtifactTracker;
    plan: PlanTracker;
    exec: ArtifactTracker;
    close: ArtifactTracker;
    roadmap: ArtifactTracker;
    gates: Gates;
    runtime_invalid?: RuntimeInvalidState;
}
export interface GateStatus {
    gate_1_open: boolean;
    gate_2_open: boolean;
    gate_3_satisfied: boolean;
}
export interface StaleIntentWarning {
    domain: string;
    version: string;
}
type ArtifactDomain = 'intent' | 'plan' | 'exec' | 'close' | 'roadmap';
export declare function validateProgress(data: unknown): ProgressJson;
export declare function hasInvalidRuntime(data: ProgressJson): boolean;
export declare function getInvalidMarkers(data: ProgressJson): InvalidMarker[];
export declare function isGateInvalid(data: ProgressJson, gate: InvalidGateKey): boolean;
export declare function getGateStatusLabel(data: ProgressJson, gate: InvalidGateKey): 'OPEN' | 'BLOCKED' | 'SATISFIED' | 'INVALID';
export declare function getOperationalGate(data: ProgressJson, gate: InvalidGateKey): boolean;
export declare function getInvalidWarningLines(data: ProgressJson): string[];
export interface DoctorReport {
    repaired: string[];
    invalidMarked: InvalidMarker[];
    invalidCleared: InvalidMarker[];
    remainingInvalid: InvalidMarker[];
}
export declare function runDoctorReconciliation(data: ProgressJson): DoctorReport;
export declare function validateProgressSemantics(data: ProgressJson): void;
export declare function assertProgressCanMutate(data: ProgressJson): void;
export declare function readProgress(projectRoot: string): ProgressJson;
export declare function writeProgress(projectRoot: string, data: ProgressJson): void;
export declare function checkSchemaVersion(data: ProgressJson): void;
export declare function createInitialProgress(projectId: string, projectName: string): ProgressJson;
export declare function getGateStatus(data: ProgressJson): GateStatus;
export declare function isStaleIntentPresent(data: ProgressJson): StaleIntentWarning[];
export declare function nextMajorVersion(versions: ArtifactVersion[]): string;
export declare function nextPlanVersion(data: ProgressJson, intentVersionRef: string): string;
export declare function nextExecVersion(data: ProgressJson, planVersionRef: string): string;
export declare function registerIntentDraft(data: ProgressJson, version: string, filePath: string): void;
export declare function lockActiveIntent(data: ProgressJson): void;
export declare function registerPlanDraft(data: ProgressJson, version: string, filePath: string, intentVersionRef: string, title?: string, focus?: string): void;
export declare function updatePlanMetadata(data: ProgressJson, version: string, title?: string, focus?: string): void;
export declare function lockOldestPlanDraft(data: ProgressJson): string;
export declare function registerPendingPlan(data: ProgressJson, id: string, filePath: string): void;
export declare function promotePendingPlan(data: ProgressJson, id: string, version: string, newFilePath: string, intentVersionRef: string, title?: string, focus?: string): void;
export declare function supersedePlanVersion(data: ProgressJson, version: string, reason: string): void;
export declare function activatePlanDraft(data: ProgressJson, version: string): void;
export declare function registerExecDraft(data: ProgressJson, version: string, filePath: string, planVersionRef: string): void;
export declare function lockActiveExec(data: ProgressJson): void;
export declare function supersedeExecVersion(data: ProgressJson, version: string, reason: string): void;
export declare function registerCloseDraft(data: ProgressJson, version: string, filePath: string, staleAcknowledged: boolean): void;
export declare function lockActiveClose(data: ProgressJson): void;
export declare function registerRoadmapDraft(data: ProgressJson, version: string, filePath: string, intentVersionRef: string): void;
export declare function activateRoadmap(data: ProgressJson, version: string): void;
export declare function lockActiveRoadmap(data: ProgressJson): void;
export declare function getNextValidOperations(data: ProgressJson): string[];
export {};
//# sourceMappingURL=progress.d.ts.map