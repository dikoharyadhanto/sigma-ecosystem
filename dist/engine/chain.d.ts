export type LifecycleState = 'DESIGN' | 'BUILD' | 'CLOSE' | 'CLOSED';
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
type ArtifactDomain = 'intent' | 'plan' | 'exec' | 'close' | 'roadmap';
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
export declare function readOverrides(projectRoot: string): OverrideEntry[];
export declare function parseMajorVersion(version: string): number;
export declare function parseMinorVersion(version: string): number;
export type IntentState = 'DRAFT' | 'RATIFIED' | 'SUPERSEDED';
export type RoadmapState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type CloseState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export interface AmendmentEntry {
    id: string;
    created_at: string;
    change: string;
    director_approved_at: string;
}
export interface SingleIntentState {
    version: string;
    state: IntentState;
    file?: string;
    created_at: string;
    updated_at: string;
    ratified_at?: string;
    supersede_reason?: string;
    title?: string;
    focus?: string;
    arc_score?: number;
    arc_score_notes?: string;
    arc_score_updated_at?: string;
    amendments?: AmendmentEntry[];
    effective_amendment?: string | null;
    certified_doc_sha256?: string;
    certified_at?: string;
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
    _migratedOnRead?: string[];
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
export declare function createInitialChain(chainVersion: string, intentFilePath: string, title?: string, focus?: string): ChainState;
export declare function hasRatifiedIntent(chain: ChainState): boolean;
export declare function hasCleanGate2Chain(chain: ChainState): boolean;
export declare function hasCleanGate3Chain(chain: ChainState): boolean;
export declare function describeGate3Blockers(chain: ChainState): string[];
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
export declare function nextExecVersion(_chain: ChainState, planVersionRef: string): string;
export declare function ratifyIntent(chain: ChainState): void;
export declare function certifyIntentDoc(chain: ChainState, absDocPath: string): void;
export declare function isIntentDocUncertified(chain: ChainState, absDocPath: string): boolean;
export declare function nextAmendmentId(chain: ChainState): string;
export declare function recordIntentAmendment(chain: ChainState, change: string): AmendmentEntry;
export declare function arcScoreBand(score: number): 'OUTPUT_INCOMPLETE' | 'SATISFIED_NEEDS_REVIEW' | 'SATISFIED_RECOMMENDED';
export declare function hasGate35Score(chain: ChainState): boolean;
export declare function recordArcScore(chain: ChainState, score: number, notes: string): void;
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
export declare function lockPlanVersion(chain: ChainState, version: string): string;
export type TargetResolution = {
    kind: 'resolved';
    version: string;
} | {
    kind: 'ambiguous';
    candidates: string[];
} | {
    kind: 'empty';
};
export declare function resolveTargetVersion(versions: ArtifactVersion[], explicit: string | undefined): TargetResolution;
export declare function registerPendingPlan(chain: ChainState, id: string, filePath: string, title?: string, focus?: string): void;
export declare function promotePendingPlan(chain: ChainState, id: string, version: string, newFilePath: string, intentVersionRef: string, title?: string, focus?: string): void;
export declare function supersedePlanVersion(chain: ChainState, version: string, reason: string): void;
export declare function registerExecDraft(chain: ChainState, version: string, filePath: string, planVersionRef: string): void;
export declare function lockExecVersion(chain: ChainState, version: string): void;
export declare function registerCloseDraft(chain: ChainState, filePath: string): void;
export declare function lockActiveClose(chain: ChainState): void;
export declare function getNextValidOperations(chain: ChainState): string[];
export {};
//# sourceMappingURL=chain.d.ts.map