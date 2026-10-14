import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
export declare const cloneShape: {
    type: z.ZodEnum<{
        intent: "intent";
        plan: "plan";
    }>;
    source_chain: z.ZodString;
    source_version: z.ZodString;
    title: z.ZodString;
    focus: z.ZodString;
    allow_reopen_closed: z.ZodOptional<z.ZodBoolean>;
};
export declare function registerF08QueryTools(server: McpServer): void;
//# sourceMappingURL=f08Queries.d.ts.map