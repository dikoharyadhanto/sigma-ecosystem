import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export declare function buildControlServer(): McpServer;
/**
 * Mode is forced to 'control' regardless of what argv says — this binary has
 * exactly one purpose, and a caller passing `--mode query` to it by mistake
 * must not silently get a control server that believes it is a query server.
 * resolveBinding() then applies control mode's stricter rules: project-root,
 * project-id, and role are all required, or the process refuses to start.
 */
export declare function bindControlFromArgv(argv: string[]): void;
export declare function startControlServer(argv?: string[]): Promise<void>;
//# sourceMappingURL=index.d.ts.map