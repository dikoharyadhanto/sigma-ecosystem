export declare class NotesError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare const NOTES_FORMAT = 1;
export interface NoteEntry {
    id: string;
    file: string;
    title: string;
    /** Posix path relative to Sigma/, e.g. notes/note-list/NOTE-2610091530-x.md */
    path: string;
    created_at: string;
    created_by_role?: string;
    /** Set only on entries restored by `update --rebuild-registry`. */
    recovered?: boolean;
}
export interface NotesRegistry {
    notes_format: number;
    /** Highest numeric ID ever issued — IDs are never reused. */
    last_id: number;
    notes: NoteEntry[];
}
/** Creates the notes folders (idempotent). */
export declare function ensureNotesDirs(root: string): void;
export declare function validateTitle(title: string): string;
/** Lowercase ASCII slug: diacritics stripped, non-alphanumerics become "-", max 60 chars. */
export declare function slugify(title: string): string;
/** YYMMDDHHMM in local time. */
export declare function noteStamp(d: Date): string;
export declare function displayDateTime(d: Date): string;
export declare function formatNoteId(n: number): string;
export type RegistryState = {
    state: 'missing';
} | {
    state: 'ok';
    registry: NotesRegistry;
} | {
    state: 'unreadable';
    reason: string;
};
export declare function loadRegistry(root: string): RegistryState;
/** Catalog text built purely from the registry. Rows whose file is missing are not shown (K-6). */
export declare function renderCatalog(root: string, registry: NotesRegistry): string;
/** Rewrites note-list.md from the registry. Returns true when the file changed. */
export declare function syncCatalog(root: string, registry: NotesRegistry): boolean;
/**
 * `sigma project start` / `--reinit`: creates the folders, an empty registry and the
 * initial catalog. Never overwrites an existing, unreadable, or previously-used registry.
 */
export declare function initNotes(root: string): void;
export interface NewNoteResult {
    entry: NoteEntry;
    /** Project-root-relative posix path of the created file. */
    relPath: string;
    catalogUpdated: boolean;
    catalogError: string | null;
}
export declare function normalizeRole(role: string | undefined): string | undefined;
export declare function createNote(root: string, rawTitle: string, opts?: {
    role?: string;
    now?: Date;
}): NewNoteResult;
export interface NotesScan {
    /** Notes-relative posix paths of non-Markdown files (violations). */
    nonMarkdown: string[];
    /** Notes-relative posix paths of Markdown files that are not registered notes. */
    unregistered: string[];
}
export declare function scanNotes(root: string, registry: NotesRegistry | null): NotesScan;
export interface ListedNote {
    entry: NoteEntry;
    missing: boolean;
}
export interface ListNotesResult {
    notes: ListedNote[];
    scan: NotesScan;
    registryPresent: boolean;
}
export declare function listNotes(root: string, search?: string): ListNotesResult;
export interface PlannedMove {
    /** Notes-relative posix paths. */
    from: string;
    to: string;
}
/** Deterministic plan; never overwrites an existing or already-planned target. */
export declare function planMoves(root: string, unregistered: string[]): PlannedMove[];
export interface UpdateNotesResult {
    dryRun: boolean;
    /** Non-empty means the run was refused and nothing was changed. */
    violations: string[];
    moves: PlannedMove[];
    registryCreated: boolean;
    catalogUpdated: boolean;
    registered: number;
    missing: string[];
}
export declare function updateNotes(root: string, opts?: {
    dryRun?: boolean;
}): UpdateNotesResult;
export interface RebuildReport {
    confirmed: boolean;
    accepted: NoteEntry[];
    rejected: {
        row: string;
        reason: string;
    }[];
    lastId: number;
    corruptBackup: string | null;
}
/**
 * Restores the registry from note-list.md (F06 K-7). Allowed only when the
 * registry is missing or unreadable. A row is restored only with a valid unique
 * ID, a NOTE-<10 digits>-<slug>.md file name and a file present in note-list/.
 * Without `confirm` nothing is written.
 */
export declare function rebuildRegistry(root: string, opts: {
    confirm: boolean;
}): RebuildReport;
//# sourceMappingURL=notesService.d.ts.map