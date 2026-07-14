import { ArtifactVersion, ProgressJson } from '../engine/progress';
export declare function getStagePlansForRoadmap(data: ProgressJson, roadmapVersion: string): ArtifactVersion[];
export declare function generateStageOverview(data: ProgressJson, roadmapVersion: string): string;
export declare function replaceSection(content: string, name: string, replacement: string): string;
export declare function removeSectionIfPresent(content: string, name: string): string;
export declare function renderRoadmapFile(roadmapPath: string, data: ProgressJson): void;
//# sourceMappingURL=roadmap.d.ts.map