export interface TerminologyMatch {
    term: string;
    line: number;
    lineText: string;
}
export declare function scanForSigmaTerminology(content: string, terminology: string[]): TerminologyMatch[];
export declare function loadTerminologyList(projectRoot: string): string[];
//# sourceMappingURL=terminologyScanner.d.ts.map