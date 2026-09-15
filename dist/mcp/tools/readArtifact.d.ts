import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
/** Refuse rather than truncate. Generous for prose, far below any real file. */
export declare const MAX_ARTIFACT_BYTES: number;
export type ArtifactType = 'intent' | 'roadmap' | 'plan' | 'exec' | 'close';
export declare class ArtifactReadError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function computeReadArtifact(root: string | null, type: ArtifactType, version?: string): unknown;
export declare function registerReadArtifactTool(server: McpServer): void;
//# sourceMappingURL=readArtifact.d.ts.map