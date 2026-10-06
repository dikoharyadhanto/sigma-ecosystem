import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SigmaDocDomain } from '../../utils/docCheck';
export type CheckDocumentType = SigmaDocDomain;
export declare function computeCheckDocument(root: string | null, type: CheckDocumentType, version?: string): unknown;
export declare function registerCheckDocumentTool(server: McpServer): void;
//# sourceMappingURL=checkDocument.d.ts.map