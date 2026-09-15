import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export declare function buildServer(): McpServer;
/**
 * Establishes the binding from process arguments. A BindingError here is fatal
 * by design: a server that cannot tell which project it is bound to must not
 * start and answer questions about whichever project it happens to find.
 */
export declare function bindFromArgv(argv: string[]): void;
export declare function startMcpServer(argv?: string[]): Promise<void>;
//# sourceMappingURL=index.d.ts.map