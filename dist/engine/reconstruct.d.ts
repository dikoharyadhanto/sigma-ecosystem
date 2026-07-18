import { ChainState } from './chain';
interface FoundArtifact {
    version: string;
    file: string;
}
interface DiscoveredArtifacts {
    intent: FoundArtifact[];
    roadmap: FoundArtifact[];
    plan: FoundArtifact[];
    exec: FoundArtifact[];
    close: FoundArtifact[];
    skipped: string[];
}
export declare function discoverArtifacts(projectRoot: string): DiscoveredArtifacts;
export interface ReconstructedChain {
    chainVersion: string;
    data: ChainState;
}
export interface UnresolvedGroup {
    major: number;
    artifacts: string[];
}
export interface MultiReconstructResult {
    chains: Map<number, ReconstructedChain>;
    unresolved: UnresolvedGroup[];
    skipped: string[];
}
export declare function buildReconstructedChains(found: DiscoveredArtifacts): MultiReconstructResult;
export declare function reconstructAllChains(projectRoot: string): MultiReconstructResult;
export declare function findSigmaProjectRoot(startDir?: string): string;
export {};
//# sourceMappingURL=reconstruct.d.ts.map