export declare function operationIdForCommandPath(commandPath: string): string;
export declare function isRegisteredReadOnlyOperation(commandPath: string): boolean;
export interface OperationLogEntry {
    operation: string;
    timestamp: string;
    status: 'success' | 'error';
    exit_code: number;
}
export declare function appendOperationLogEntry(operation: string, exitCode: number): void;
export declare function ensureOperationsLog(projectRoot: string): boolean;
//# sourceMappingURL=operationLog.d.ts.map