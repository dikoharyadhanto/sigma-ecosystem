import { type Tier, type McpStatus, type Plane } from './capabilityManifest';
export type { Tier, McpStatus, Plane };
/** What a consumer may expect of an operation right now. */
export type Availability = 'observe' | 'role_action' | 'director_required' | 'gate_blocked' | 'forbidden';
export declare const OPERATION_TIERS: Readonly<Record<string, Tier>>;
/** Owner role per matrix §3. Derived, NOT ratified — advisory only. */
export declare const OPERATION_OWNER: Readonly<Record<string, string>>;
/**
 * Whether an MCP primitive exists, as declared by the manifest. Tombstones and
 * unknown ids are never implemented. `mcp_status` is a claim; the parity test
 * is what proves the named tools are registered on the declared plane.
 */
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
//# sourceMappingURL=policy.d.ts.map