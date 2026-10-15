export interface MatrixInput {
    sigmaVersion: string;
    registry: {
        schema_version: string;
        generated_at: string;
        total_operations: number;
        operations: ReadonlyArray<{
            operation_id: string;
            level: string;
            role: string;
        }>;
    };
}
export declare function renderCapabilityMatrix(input: MatrixInput): string;
//# sourceMappingURL=capabilityMatrix.d.ts.map