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
export declare function migrateMailbox(root: string, dryRun?: boolean): Promise<{
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
} | {
    applied: boolean;
    moved: number;
    reset_unread: number;
    recovered: boolean;
    warnings?: undefined;
} | {
    applied: boolean;
    moved: number;
    reset_unread: number;
    warnings: {
        id: string;
        path: string;
    }[];
    recovered?: undefined;
}>;
//# sourceMappingURL=mailboxMigration.d.ts.map