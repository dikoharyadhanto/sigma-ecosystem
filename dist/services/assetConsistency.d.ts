export interface AssetPair {
    label: string;
    source: string;
    target: string;
}
export interface AssetDifference extends AssetPair {
    status: 'SAME' | 'MISSING' | 'DIFF' | 'UNSAFE';
    sourceHash: string;
    targetHash?: string;
    acceptanceToken?: string;
}
export declare function sha256File(file: string): string;
export declare function managedProjectAssets(projectRoot: string): AssetPair[];
export declare function inspectAsset(pair: AssetPair, safeRoot?: string): AssetDifference;
export declare function syncableProjectAssets(projectRoot: string): AssetPair[];
export declare function inspectProjectAssets(projectRoot: string): AssetDifference[];
export declare function formatAssetDifference(item: AssetDifference, includeAcceptanceToken?: boolean): string;
export interface SyncResult {
    copied: string[];
    backupDir?: string;
}
export declare function syncManagedAssets(projectRoot: string, acceptedTokens: string[]): SyncResult;
export interface AssetDriftReport {
    differences: Array<AssetDifference & {
        layer: string;
    }>;
    memoryWarnings: string[];
}
export declare function inspectAssetDrift(projectRoot?: string): AssetDriftReport;
export interface VersionStamp {
    sigma_version: string;
    assets_hash: string;
    synced_at: string;
}
export type VersionLevel = 'current' | 'host_unknown' | 'host_outdated' | 'project_unknown' | 'project_outdated';
export interface VersionStatus {
    level: VersionLevel;
    installed_version: string;
    host: VersionStamp | null;
    project: VersionStamp | null;
    message: string | null;
    command: string | null;
}
export interface StampResult {
    written: boolean;
    reason?: string;
}
export declare function computeAssetsHash(pairs: AssetPair[]): string;
export declare function stampProjectIfCurrent(projectRoot: string): StampResult;
export declare function stampHostIfCurrent(): StampResult;
export declare function evaluateVersionStatus(projectRoot: string): VersionStatus | null;
//# sourceMappingURL=assetConsistency.d.ts.map