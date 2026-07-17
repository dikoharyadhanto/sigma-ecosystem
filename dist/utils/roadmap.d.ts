import { ArtifactVersion } from '../engine/progress';
import { ChainState } from '../engine/chain';
export declare function getStagePlansForRoadmap(chain: ChainState): ArtifactVersion[];
export declare function generateStageOverview(chain: ChainState): string;
export declare function replaceSection(content: string, name: string, replacement: string): string;
export declare function removeSectionIfPresent(content: string, name: string): string;
export declare function renderRoadmapFile(roadmapPath: string, chain: ChainState): void;
//# sourceMappingURL=roadmap.d.ts.map