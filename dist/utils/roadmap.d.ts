import { ArtifactVersion, ChainState } from '../engine/chain';
import { replaceSection, removeSectionIfPresent } from './renderMarkers';
export { replaceSection, removeSectionIfPresent };
export declare function getStagePlansForRoadmap(chain: ChainState): ArtifactVersion[];
export declare function generateStageOverview(chain: ChainState): string;
export declare function renderRoadmapFile(roadmapPath: string, chain: ChainState): void;
//# sourceMappingURL=roadmap.d.ts.map