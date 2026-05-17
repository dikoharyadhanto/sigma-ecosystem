interface McpServer {
    command: string;
    args: string[];
    env?: Record<string, string>;
}
interface McpJsonConfig {
    mcpServers: Record<string, McpServer>;
}
interface VscodeMcpConfig {
    servers: Record<string, McpServer>;
}
export declare function createMcpConfig(options?: {
    platform?: NodeJS.Platform;
    homeDir?: string;
}): McpJsonConfig;
export declare function createVscodeMcpConfig(options?: {
    platform?: NodeJS.Platform;
    homeDir?: string;
}): VscodeMcpConfig;
export declare function writeMcpJson(filePath: string, options?: {
    platform?: NodeJS.Platform;
    homeDir?: string;
}): void;
export declare function writeVscodeMcpJson(filePath: string, options?: {
    platform?: NodeJS.Platform;
    homeDir?: string;
}): void;
export declare function writeReasonixMcpConfig(filePath: string, options?: {
    homeDir?: string;
}): void;
export {};
//# sourceMappingURL=mcp.d.ts.map