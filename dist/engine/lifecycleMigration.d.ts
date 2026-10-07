import { ChainState } from './chain';
export declare function lifecycleMigrationPreview(chain: ChainState): {
    chain: ChainState;
    changes: string[];
    applied: boolean;
    needs_baseline_review: string[];
};
export declare function migrateLifecycle(root: string, version?: string, dryRun?: boolean, directorConfirm?: boolean): Promise<{
    chain: undefined;
    target: string;
    applied: boolean;
    changes: string[];
    needs_baseline_review: string[];
}>;
//# sourceMappingURL=lifecycleMigration.d.ts.map