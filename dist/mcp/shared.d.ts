export declare const SOURCE_ENGINE: "engine";
export declare function setClientRoots(roots: string[]): void;
export declare function addClientRoot(uriOrPath: string): void;
/**
 * Resolves the Sigma project root from multiple candidate sources:
 * 1. explicitPath (e.g. passed from an MCP tool argument)
 * 2. Environment variables (SIGMA_PROJECT_ROOT, INIT_CWD, PWD)
 * 3. CLI arguments (--project-root, --cwd, or a positional path)
 * 4. Client roots received via MCP protocol (roots/list)
 * 5. Current working directory (process.cwd())
 */
export declare function resolveRoot(explicitPath?: string): string | null;
export declare function okText(payload: unknown): {
    content: {
        type: "text";
        text: string;
    }[];
};
export declare function errText(message: string): {
    isError: true;
    content: {
        type: "text";
        text: string;
    }[];
};
export declare function noProject(extra?: Record<string, unknown>): {
    active: boolean;
    message: string;
    source: "engine";
};
//# sourceMappingURL=shared.d.ts.map