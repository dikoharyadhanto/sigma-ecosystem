import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export interface GetOperationLogFilters {
    status?: 'success' | 'error';
    operation?: string;
    since?: string;
    until?: string;
    limit?: number;
}
export declare function computeGetOperationLog(root: string | null, filters: GetOperationLogFilters): unknown;
export declare function registerGetOperationLogTool(server: McpServer): void;
//# sourceMappingURL=getOperationLog.d.ts.map