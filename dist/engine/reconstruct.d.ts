import { ProgressJson } from './progress';
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
export interface ReconstructResult {
    data: ProgressJson;
    notes: string[];
}
export declare function buildReconstructedProgress(found: DiscoveredArtifacts, projectId: string, projectName: string): ReconstructResult;
export declare function reconstructProgress(projectRoot: string, projectId: string, projectName: string): ReconstructResult;
export declare function findSigmaProjectRoot(startDir?: string): string;
export {};
//# sourceMappingURL=reconstruct.d.ts.map