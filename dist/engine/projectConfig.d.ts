export interface ProjectConfig {
    schema_version: string;
    document_language: string;
    interaction_language: string;
    output_document_language: string;
}
export declare function readProjectConfig(projectRoot: string): ProjectConfig;
export declare function writeProjectConfig(projectRoot: string, config: ProjectConfig): void;
export declare function createDefaultProjectConfig(lang?: string): ProjectConfig;
//# sourceMappingURL=projectConfig.d.ts.map