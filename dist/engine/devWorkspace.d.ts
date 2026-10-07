export interface DevWorkspaceRecord {
    path: string;
    created_at: string;
}
export interface DevWorkspaceMarker {
    role: 'DEV';
    project_id: string;
    created_at: string;
}
export type DevWorkspaceState = 'INACTIVE' | 'ACTIVE' | 'ACTIVE_DEGRADED';
export type DevWorkspaceDegradedReason = 'FOLDER_MISSING' | 'MARKER_MISSING' | 'MARKER_INVALID' | 'PROJECT_ID_MISMATCH';
export interface DevWorkspaceStatus {
    state: DevWorkspaceState;
    degradedReason: DevWorkspaceDegradedReason | null;
    /** True when no record exists but an entry named `dev` is present in the project root. */
    unregisteredFolder: boolean;
}
export declare class DevWorkspaceError extends Error {
}
export declare function getDevWorkspaceStatus(projectRoot: string): DevWorkspaceStatus;
/** Message shown for a state, in the wording the DEV rules refer to. */
export declare function describeDevWorkspace(status: DevWorkspaceStatus): string[];
/** File operations used by create, replaceable so a failure at each step can be exercised. */
export interface DevWorkspaceIo {
    makeFolder(folderPath: string): void;
    writeMarker(filePath: string, marker: DevWorkspaceMarker): void;
    writeRecord(projectRoot: string, record: DevWorkspaceRecord): void;
}
export interface CreateDevWorkspaceResult {
    record: DevWorkspaceRecord;
    marker: DevWorkspaceMarker;
}
export declare function createDevWorkspace(projectRoot: string, io?: DevWorkspaceIo, now?: Date): CreateDevWorkspaceResult;
export interface RepairDevWorkspaceResult {
    before: DevWorkspaceStatus;
    after: DevWorkspaceStatus;
    actions: string[];
}
/**
 * Recreates a missing folder and a missing or invalid marker from the record.
 * Never touches the contents of dev/ beyond the marker, and never changes the record.
 */
export declare function repairDevWorkspace(projectRoot: string, now?: Date): RepairDevWorkspaceResult;
//# sourceMappingURL=devWorkspace.d.ts.map