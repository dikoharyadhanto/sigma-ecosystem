export type Tier = 'Q' | 'W1' | 'W2' | 'W3' | 'NA';
/** What a consumer may expect of an operation right now. */
export type Availability = 'observe' | 'role_action' | 'director_required' | 'gate_blocked' | 'forbidden';
/** Whether an MCP primitive actually exists today. Separate from authority. */
export type McpStatus = 'implemented' | 'deferred' | 'not_admissible';
export declare const OPERATION_TIERS: Readonly<Record<string, Tier>>;
/** Owner role per matrix §3. Derived, NOT ratified — advisory only. */
export declare const OPERATION_OWNER: Readonly<Record<string, string>>;
export declare function mcpStatusFor(operationId: string): McpStatus;
interface GateFacts {
    gate_1_open: boolean;
    gate_2_open: boolean;
    gate_3_satisfied: boolean;
    intent_state: string | null;
}
export declare function availabilityFor(operationId: string, gates: GateFacts | null): {
    availability: Availability;
    gate_evaluated: boolean;
};
export declare function computeEffectivePolicy(root: string | null, roleFilter?: string): unknown;
export {};
//# sourceMappingURL=policy.d.ts.map