import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export type EvidenceType = 'plan' | 'exec';
export declare function computeGetEvidence(root: string | null, type: EvidenceType, version?: string): unknown;
export declare function registerGetEvidenceTool(server: McpServer): void;
//# sourceMappingURL=evidence.d.ts.map