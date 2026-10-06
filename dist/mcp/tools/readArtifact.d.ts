import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ArtifactType, MAX_ARTIFACT_BYTES } from '../artifactPath';
export { MAX_ARTIFACT_BYTES, ArtifactType };
export declare function computeReadArtifact(root: string | null, type: ArtifactType, version?: string): unknown;
export declare function registerReadArtifactTool(server: McpServer): void;
//# sourceMappingURL=readArtifact.d.ts.map