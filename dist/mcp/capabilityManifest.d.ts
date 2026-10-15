export type Tier = 'Q' | 'W1' | 'W2' | 'W3' | 'NA';
export type Plane = 'query' | 'control' | 'cli_only' | 'deferred';
export type McpStatus = 'implemented' | 'deferred' | 'not_admissible';
export type Mapping = 'exact' | 'functional' | 'partial' | 'none';
export type OwnerRole = 'ARC' | 'FMN' | 'DEV' | 'AUD';
export interface CapabilityRecord {
    operation_id: string;
    tier: Tier;
    plane: Plane;
    mcp_status: McpStatus;
    tool_names: readonly string[];
    mapping: Mapping;
    rationale: string;
    /** Derived from the matrix §3, advisory, NOT ratified. */
    owner_role?: OwnerRole;
}
export declare const CAPABILITY_MANIFEST: readonly CapabilityRecord[];
/** Retired operations. Present in the registry as tombstones, never active. */
export declare const TOMBSTONES: Readonly<Record<string, {
    replacement: string;
}>>;
/** Registered tools that exist for completed-ticket replay only. Never counts as support. */
export declare const COMPATIBILITY_TOOLS: Readonly<Record<string, {
    tombstone: string;
    plane: 'control';
}>>;
/**
 * Tools that realise no registry operation: MCP-native conveniences over
 * engine state. Listed explicitly so an unmapped tool is a test failure, not a
 * silent omission (AC-MCP-02).
 */
export declare const MCP_NATIVE_TOOLS: Readonly<Record<string, {
    plane: 'query' | 'control';
    rationale: string;
}>>;
export declare function capabilityFor(operationId: string): CapabilityRecord | undefined;
export declare function isTombstone(operationId: string): boolean;
export interface InventoryInput {
    registryIds: readonly string[];
    queryTools: readonly string[];
    controlTools: readonly string[];
}
export interface InventoryReport {
    /** Active registry operations with no record, and records for unknown/tombstoned operations. */
    unclassified: string[];
    unknownRecords: string[];
    duplicateRecords: string[];
    /** Tools registered on a server that nothing in the manifest accounts for. */
    orphanTools: string[];
    /** `implemented` records naming a tool that is not registered. */
    implementedWithoutTool: string[];
    /** `implemented` records whose tools are on the wrong plane. */
    wrongPlane: string[];
    /** Records carrying tool_names while not `implemented`. */
    toolsWithoutImplemented: string[];
}
export declare function inventoryDrift(input: InventoryInput, manifest?: readonly CapabilityRecord[]): InventoryReport;
//# sourceMappingURL=capabilityManifest.d.ts.map