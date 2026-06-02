import { ProgressJson } from '../engine/progress';
export type SigmaDocDomain = 'intent' | 'roadmap' | 'plan' | 'exec' | 'close';
export interface SigmaDocCheckReport {
    ok: boolean;
    heading: string;
    file: string;
    documentType: string | null;
    schema: string | null;
    errors: string[];
    warnings: string[];
    passes: string[];
}
export declare function validateSigmaDocFile(absPath: string, domain: SigmaDocDomain): SigmaDocCheckReport;
export declare function resolveSigmaDocPath(projectRoot: string, data: ProgressJson, domain: SigmaDocDomain, version?: string): string;
export declare function printSigmaDocReport(report: SigmaDocCheckReport, projectRoot?: string): void;
export declare function ensureSigmaDocEligible(report: SigmaDocCheckReport, command: string): void;
//# sourceMappingURL=docCheck.d.ts.map