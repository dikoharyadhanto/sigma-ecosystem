export interface OperationConstraint {
    condition: string;
}
export interface OperationGating {
    pre_condition?: string;
    post_condition?: string;
}
export interface Operation {
    operation_id: string;
    domain?: string;
    action?: string;
    role?: string;
    level?: string;
    description?: string;
    constraints?: OperationConstraint[];
    gating?: OperationGating;
    error_messages?: Record<string, string>;
}
export interface OperationRegistry {
    schema_version: string;
    registry_id: string;
    total_operations: number;
    domains: string[];
    operations: Operation[];
}
export interface DocumentEntry {
    document_id: string;
    file: string;
    location: string;
    authority_tier: string;
    owner: string;
    description: string;
    mandatory_when: string[];
    tolerate_missing: boolean;
    missing_behavior?: string;
}
export interface DocumentRegistry {
    schema_version: string;
    total_documents: number;
    documents: DocumentEntry[];
}
export declare function loadOperationRegistry(projectRoot: string): OperationRegistry;
export declare function loadDocumentRegistry(projectRoot: string): DocumentRegistry;
export declare function getOperation(registry: OperationRegistry, operationId: string): Operation | undefined;
export declare function getDocumentsForRole(registry: DocumentRegistry, role: string | null): DocumentEntry[];
//# sourceMappingURL=registry.d.ts.map