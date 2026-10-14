/** Name of the Sigma-managed record. Deliberately not the conventional changelog name: tools and people rewrite that file, which would break the recording format. */
export declare const CHANGE_RECORD_FILE = "CHANGE-RECORD.md";
/** First DEV_EXEC document schema that carries the Changelog section. */
export declare const CHANGELOG_MIN_EXEC_SCHEMA = 4;
export declare const CHANGELOG_SECTION_ID = "CHANGELOG";
/** Exact statement a DEV writes instead of a list when there is nothing to record. */
export declare const NO_PRODUCT_CHANGES = "No product changes.";
export type ChangelogOutcome = {
    status: 'recorded';
    file: string;
    version: string;
    entries: number;
} | {
    status: 'no_changes';
} | {
    status: 'skipped';
    reason: string;
    message: string;
};
export declare function changelogSkipMessage(reason: string): string;
export declare function describeChangelogOutcome(outcome: ChangelogOutcome): string;
type Target = {
    ok: true;
    file: string;
    rel: string;
} | {
    ok: false;
    reason: string;
};
/** Only `<root>/CHANGE-RECORD.md` and `<root>/dev/CHANGE-RECORD.md` are valid; anything else is ignored. */
export declare function resolveChangelogTarget(root: string): Target;
type Section = {
    ok: true;
    entries: string[];
} | {
    ok: false;
    none?: true;
    reason: string;
};
export declare function readChangelogSection(markdown: string): Section;
/**
 * Returns the new file text, or null when the existing file is not in the
 * version-heading format. A version not yet present is added at the top
 * (most recently locked first); a version already present is appended to.
 */
export declare function addChangelogEntries(existing: string, version: string, entries: string[]): string | null;
/**
 * Record the Changelog section of a LOCKED DEV-EXEC under its EXEC version. Call only after the
 * transition to LOCKED has been committed, and only from the path that made
 * the transition (never from preview, status or an idempotent replay).
 */
export declare function recordChangelogForLockedExec(root: string, execVersion: string): ChangelogOutcome;
export type ChangelogCreation = {
    action: 'create';
    file: string;
    rel: string;
} | {
    action: 'keep';
    reason: string;
};
/** Decide whether a CHANGE-RECORD.md should be created. Creates nothing. */
export declare function planChangelogCreation(root: string): ChangelogCreation;
export declare function ensureChangelogFile(root: string): {
    created: boolean;
    rel?: string;
    reason?: string;
};
export {};
//# sourceMappingURL=changelogService.d.ts.map