export declare class ReferenceUpdateError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface UpdateReferenceListResult {
    relPath: string;
    scaffolded: boolean;
    newRowsAdded: number;
    missingFiles: string[];
}
export declare function referenceUpdateTransactionFiles(projectRoot: string): string[];
export declare function updateReferenceList(projectRoot: string): UpdateReferenceListResult;
//# sourceMappingURL=referenceUpdateService.d.ts.map