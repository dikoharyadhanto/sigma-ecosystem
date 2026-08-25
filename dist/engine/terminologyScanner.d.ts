export interface TerminologyMatch {
    term: string;
    line: number;
    lineText: string;
}
export declare function scanForSigmaTerminology(content: string, terminology: string[]): TerminologyMatch[];
export declare function loadTerminologyList(projectRoot: string): string[];
export declare function stripTemplateInstructions(content: string): {
    cleaned: string;
    strippedLines: number;
};
//# sourceMappingURL=terminologyScanner.d.ts.map