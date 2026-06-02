import { ProgressJson } from '../engine/progress';
export interface StageEntry {
    version: string;
    title: string;
    focus: string;
}
export declare function parseStages(content: string): StageEntry[];
export declare function planStateForStage(stageVersion: string, data: ProgressJson): string;
export declare function generateStageOverview(stages: StageEntry[], data: ProgressJson): string;
export declare function replaceSection(content: string, name: string, replacement: string): string;
export declare function removeSectionIfPresent(content: string, name: string): string;
export declare function renderRoadmapFile(roadmapPath: string, data: ProgressJson): void;
interface CoreProcessMigrationResult {
    changed: boolean;
    content: string;
    message: string;
}
export declare function migrateRoadmapCoreProcessFlowContent(content: string): CoreProcessMigrationResult;
export declare function migrateRoadmapCoreProcessFlowFile(roadmapPath: string): string;
export declare const STAGE_STUB_TEMPLATE: (stageVersion: string, title?: string, focus?: string) => string;
export declare function updateStageMetadata(roadmapPath: string, stageVersion: string, title?: string, focus?: string): void;
export declare function appendRoadmapSectionStub(roadmapPath: string, planVersion: string, title?: string, focus?: string): void;
export {};
//# sourceMappingURL=roadmap.d.ts.map