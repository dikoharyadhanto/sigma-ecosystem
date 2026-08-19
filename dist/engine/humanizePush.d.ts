import { ChainState } from './chain';
import { CoverageConfig } from './fidelityCoverage';
export interface HumanArtifactPushTarget {
    kind: 'intent' | 'exec' | 'close';
    artifactType: string;
    version: string;
    humanRelPath: string;
    ledgerRelPath: string;
    sourceRelPaths: string[];
    coverageConfig: CoverageConfig;
}
export interface HumanArtifactPushResult {
    target: HumanArtifactPushTarget;
    success: boolean;
    pageUrl?: string;
    error?: string;
}
export declare function collectHumanPushTargets(chain: ChainState): HumanArtifactPushTarget[];
export declare function pushHumanArtifact(projectRoot: string, target: HumanArtifactPushTarget): Promise<HumanArtifactPushResult>;
export declare function pushAllHumanArtifacts(projectRoot: string): Promise<HumanArtifactPushResult[]>;
export interface ReconcileResult {
    artifactType: string;
    version: string;
    deleted: boolean;
    error?: string;
}
export declare function reconcileSupersededHumanArtifacts(projectRoot: string): Promise<ReconcileResult[]>;
//# sourceMappingURL=humanizePush.d.ts.map