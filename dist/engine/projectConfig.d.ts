export interface ProjectConfig {
    schema_version: string;
    document_language: string;
    interaction_language: string;
    formal_identifier_language: string;
}
export declare function langLabel(code: string): string;
export declare function readProjectConfig(projectRoot: string): ProjectConfig;
export declare function writeProjectConfig(projectRoot: string, config: ProjectConfig): void;
export declare function createDefaultProjectConfig(lang?: string): ProjectConfig;
//# sourceMappingURL=projectConfig.d.ts.map