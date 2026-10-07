/** Caller already owns the shared lease (e.g. sigma send). Mutation is synchronous. */
export declare function governanceMutationUnderLease<T>(root: string, operation: string, files: string[], mutate: () => T, assertOwned: () => void): T;
/** CLI adapter for the same project lease and journal used by MCP. */
export declare function withGovernanceTransaction<T>(root: string, operation: string, files: () => string[], mutate: () => T): Promise<T>;
//# sourceMappingURL=governanceTransaction.d.ts.map