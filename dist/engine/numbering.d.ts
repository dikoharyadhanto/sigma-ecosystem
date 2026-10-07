export type VersioningScheme = 'legacy_offset' | 'intent_aligned';
export interface NumberedChain {
    versioning_scheme?: VersioningScheme;
    intent: {
        version: string;
    };
}
export interface ChainMetadata {
    intent: string;
    versioning_scheme: VersioningScheme;
    plan?: string;
}
export declare function resolveVersioningScheme(chain: Pick<NumberedChain, 'versioning_scheme'>): VersioningScheme;
export declare function planMajorForChain(chain: NumberedChain): number;
export declare function parseChainMetadata(content: string): ChainMetadata | null;
export declare function readChainMetadata(file: string, projectRoot?: string): ChainMetadata | null;
export declare function withChainMetadata(content: string, metadata: ChainMetadata): string;
export declare function writeChainMetadata(file: string, chain: NumberedChain, plan?: string): void;
//# sourceMappingURL=numbering.d.ts.map