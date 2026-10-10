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
//# sourceMappingURL=assetConsistency.d.ts.map