export declare class CloseHumanizeError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface HumanizeCloseInput {
    projectRoot: string;
    force?: boolean;
}
export interface HumanizeCloseResult {
    chainVersion: string;
    version: string;
    humanRelPath: string;
    ledgerRelPath: string;
}
export declare function humanizeCloseTransactionFiles(projectRoot: string): string[];
export declare function humanizeClose(input: HumanizeCloseInput): HumanizeCloseResult;
//# sourceMappingURL=closeHumanizeService.d.ts.map