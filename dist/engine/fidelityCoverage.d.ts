export interface CoverageConfig {
    idPatterns: RegExp[];
    namedTables: string[];
    namedItems?: string[];
}
export interface CoverageGap {
    kind: 'id' | 'table-row-count' | 'named-item';
    identifier: string;
    detail?: string;
}
export declare function checkFidelityCoverage(sourceContent: string, ledgerContent: string, config: CoverageConfig): CoverageGap[];
export declare const DIR_INTENT_COVERAGE_CONFIG: CoverageConfig;
export declare const PLAN_EXEC_COVERAGE_CONFIG: CoverageConfig;
export declare const DIR_CLOSE_COVERAGE_CONFIG: CoverageConfig;
//# sourceMappingURL=fidelityCoverage.d.ts.map