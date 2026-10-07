export interface DetectedTools {
    claudeCode: boolean;
    codex: boolean;
    reasonix: boolean;
    antigravity: boolean;
    opencode: boolean;
}
export interface ToolTargetPaths {
    claudeCommands: string;
    codexSkills: string;
    reasonixSkills: string;
    reasonixConfig: string;
    antigravitySkills: string;
    opencodeConfigDir: string;
    opencodeCommands: string;
    opencodePlugins: string;
}
export declare function targetPaths(): ToolTargetPaths;
export declare function detectTools(): DetectedTools;
//# sourceMappingURL=detect.d.ts.map