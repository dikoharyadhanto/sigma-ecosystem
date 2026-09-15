import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
/** Refuse rather than truncate. Generous for prose, far below any real file. */
export declare const MAX_ARTIFACT_BYTES: number;
export type ArtifactType = 'intent' | 'roadmap' | 'plan' | 'exec' | 'close';
/**
 * Two reviewer findings shaped what this file trusts, and they pull in opposite
 * directions — which is the whole difficulty of the tool.
 *
 * R-01 (too permissive): the tracker's `file` field was treated as the
 * allowlist, checked only for staying inside the project root. An entry
 * rewritten to `.env` read `.env` back, returning a live Notion token. "Inside
 * the root" is the wrong boundary for a governance-artifact reader.
 *
 * R-10 (too restrictive, after fixing R-01): the replacement table hardcoded
 * only the post-rename folders, so every project created before
 * PLAN-IMPL-SIGMA-ARTIFACT-FOLDER-RENAME-20260816 was refused here while the
 * CLI read it perfectly well through the stored entry.file. CLI and MCP
 * disagreeing about what a project *is* trips the stop criterion in plan §22.
 *
 * The resolution is not a middle setting between the two. It is: derive the
 * permitted paths from ARTIFACT_LAYOUT — which lists both the new and the
 * pre-rename folder for each type, and is shared with engine/reconstruct.ts so
 * the two cannot drift again — and let the tracker only choose among them.
 */
export declare class ArtifactReadError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function computeReadArtifact(root: string | null, type: ArtifactType, version?: string): unknown;
export declare function registerReadArtifactTool(server: McpServer): void;
//# sourceMappingURL=readArtifact.d.ts.map