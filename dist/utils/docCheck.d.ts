export type SigmaDocDomain = 'intent' | 'roadmap' | 'plan' | 'exec' | 'close';
/**
 * A lock requirement is content-aware (unlike structural errors/warnings): it reflects
 * whether a decision recorded in the document (a verdict, a checklist item, a narrative
 * field) satisfies what `sigma {domain} lock` requires. `scope: 'conditional'` marks a
 * requirement that only appears in the list when its own condition applies (e.g. the
 * SKIP_FOR_AUDIT verbatim instruction) — it still blocks lock like any other requirement
 * once present, it just isn't always relevant enough to show.
 */
export interface SigmaDocRequirement {
    label: string;
    satisfied: boolean;
    scope: 'lock' | 'conditional';
}
export interface SigmaDocCheckReport {
    ok: boolean;
    heading: string;
    file: string;
    documentType: string | null;
    schema: string | null;
    errors: string[];
    warnings: string[];
    passes: string[];
    /**
     * Lock Requirements — content-aware gate results. Never affects `ok`/exit code of
     * `check`; only `lock` treats an unsatisfied requirement as blocking (see
     * `ensureSigmaDocEligible`). Computed unconditionally by both `check` and `lock` calls
     * to `validateSigmaDocFile` so the two commands can never disagree about what is
     * required — see PLAN-EVAL-11 Bagian A.5, "Lock Validation Equivalence".
     */
    requirements: SigmaDocRequirement[];
}
export declare function validateSigmaDocFile(absPath: string, domain: SigmaDocDomain): SigmaDocCheckReport;
export declare function printSigmaDocReport(report: SigmaDocCheckReport, projectRoot?: string): void;
export declare function ensureSigmaDocEligible(report: SigmaDocCheckReport, command: string): void;
//# sourceMappingURL=docCheck.d.ts.map