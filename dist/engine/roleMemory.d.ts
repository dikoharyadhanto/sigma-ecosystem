export declare const ROLE_MEMORY_ROLES: readonly ["ARC", "FMN", "DEV", "AUD"];
export type RoleMemoryRole = typeof ROLE_MEMORY_ROLES[number];
export interface RoleMemory {
    schema_version: string;
    role: RoleMemoryRole;
    source_rule: string;
    source_rule_version: string;
    memory_updated_at: string;
    authority: string;
    general: string[];
    role_specific: string[];
}
export declare function getBundledRoleMemoryDir(): string;
export declare function getRoleMemoryFilename(role: RoleMemoryRole): string;
export declare function getLocalRoleMemoryPath(projectRoot: string, role: RoleMemoryRole): string;
export declare function getBundledRoleMemoryPath(role: RoleMemoryRole): string;
export declare function loadRoleMemory(role: RoleMemoryRole, projectRoot?: string): {
    memory: RoleMemory;
    sourcePath: string;
};
//# sourceMappingURL=roleMemory.d.ts.map