import { MessageIndex } from './mailbox';
import type { MessageEntry } from './mailbox';
export interface OrphanCandidate {
    file: string;
    entry?: MessageEntry;
    error?: string;
    original_type?: string;
}
export declare function inspectOrphans(root: string, index: MessageIndex): OrphanCandidate[];
export declare function mailboxMigrationDiagnosis(root: string): {
    required: boolean;
    interrupted: boolean;
    stage: "completed" | "prepared" | "committed" | null;
    move_count: number;
    reset_unread_count: number;
    integrity: {
        ok: boolean;
        passes: number;
        warnings: number;
        failures: number;
        findings: {
            missing_files: {
                id: string;
                file: string;
            }[];
            orphan_files: string[];
            missing_attachments: {
                id: string;
                path: string;
            }[];
            duplicate_ids: string[];
            invalid_fields: {
                id: string;
                field: string;
                value: string;
            }[];
        };
    };
    warnings: string[];
};
export { withMailboxLock } from './mailboxLock';
export declare function migrateMailbox(root: string, dryRun?: boolean, adoptOrphans?: boolean): Promise<{
    applied: boolean;
    required: boolean;
    interrupted: boolean;
    stage: "completed" | "prepared" | "committed" | null;
    move_count: number;
    reset_unread_count: number;
    integrity: {
        ok: boolean;
        passes: number;
        warnings: number;
        failures: number;
        findings: {
            missing_files: {
                id: string;
                file: string;
            }[];
            orphan_files: string[];
            missing_attachments: {
                id: string;
                path: string;
            }[];
            duplicate_ids: string[];
            invalid_fields: {
                id: string;
                field: string;
                value: string;
            }[];
        };
    };
    warnings: string[];
} | {
    adopt_orphans: {
        adoptable: number;
        rejected: {
            file: string;
            reason: string | undefined;
        }[];
    };
    applied: boolean;
    required: boolean;
    interrupted: boolean;
    stage: "completed" | "prepared" | "committed" | null;
    move_count: number;
    reset_unread_count: number;
    integrity: {
        ok: boolean;
        passes: number;
        warnings: number;
        failures: number;
        findings: {
            missing_files: {
                id: string;
                file: string;
            }[];
            orphan_files: string[];
            missing_attachments: {
                id: string;
                path: string;
            }[];
            duplicate_ids: string[];
            invalid_fields: {
                id: string;
                field: string;
                value: string;
            }[];
        };
    };
    warnings: string[];
    moved?: undefined;
    reset_unread?: undefined;
    recovered?: undefined;
    adopted_orphans?: undefined;
} | {
    applied: boolean;
    moved: number;
    reset_unread: number;
    recovered: boolean;
    adopted_orphans?: undefined;
    warnings?: undefined;
} | {
    applied: boolean;
    moved: number;
    reset_unread: number;
    adopted_orphans: number;
    warnings: {
        id: string;
        path: string;
    }[];
    recovered?: undefined;
}>;
//# sourceMappingURL=mailboxMigration.d.ts.map