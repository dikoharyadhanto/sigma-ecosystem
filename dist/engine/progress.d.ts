export type LifecycleState = 'DESIGN' | 'BUILD' | 'CLOSE' | 'CLOSED';
export type IntentState = 'DRAFT' | 'LOCKED' | 'INACTIVE' | 'SUPERSEDED';
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
    title?: string;
    focus?: string;
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
export interface OverrideEntry {
    type: 'override';
    timestamp: string;
    artifact: string;
    phase: string;
    gate_bypassed: string;
    reason: string;
    authorized_by: 'Director';
    version?: string | null;
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
type ArtifactDomain = 'intent' | 'plan' | 'exec' | 'close' | 'roadmap';
export declare function hasActiveLockedIntent(data: ProgressJson): boolean;
export declare function hasCleanGate2Chain(data: ProgressJson): boolean;
export declare function hasCleanGate3Chain(data: ProgressJson): boolean;
export declare function readOverrides(projectRoot: string): OverrideEntry[];
export declare function getInvalidMarkers(data: ProgressJson): InvalidMarker[];
export declare function writeProgress(projectRoot: string, data: ProgressJson): void;
export declare function createInitialProgress(projectId: string, projectName: string): ProgressJson;
export declare function parseMajorVersion(version: string): number;
export declare function parseMinorVersion(version: string): number;
export {};
//# sourceMappingURL=progress.d.ts.map