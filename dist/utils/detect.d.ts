export interface DetectedTools {
    claudeCode: boolean;
    codex: boolean;
    reasonix: boolean;
    antigravity: boolean;
    cursor: boolean;
}
export interface ToolTargetPaths {
    claudeCommands: string;
    codexSkills: string;
    reasonixSkills: string;
    reasonixConfig: string;
    antigravitySkills: string;
    cursorRules: string;
}
export declare function targetPaths(): ToolTargetPaths;
export declare function detectTools(): DetectedTools;
//# sourceMappingURL=detect.d.ts.map