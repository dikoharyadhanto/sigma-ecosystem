export declare class ExecHumanizeError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface HumanizeExecInput {
    projectRoot: string;
    /** DEV-EXEC version to humanize instead of the active one — a version
     *  within the active chain's chain.exec.versions[], not a different
     *  chain. */
    version?: string;
    force?: boolean;
}
export interface HumanizeExecResult {
    chainVersion: string;
    version: string;
    planVersionRef: string;
    humanRelPath: string;
    ledgerRelPath: string;
}
export declare function humanizeExecTransactionFiles(projectRoot: string, version?: string): string[];
export declare function humanizeExec(input: HumanizeExecInput): HumanizeExecResult;
//# sourceMappingURL=execHumanizeService.d.ts.map