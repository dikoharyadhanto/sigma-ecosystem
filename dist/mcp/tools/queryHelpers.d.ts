import { z } from 'zod';
import { ChainState } from '../../engine/chain';
/** Optional chain selector, same meaning as the CLI's `--v` on these operations. */
export declare const chainArg: z.ZodOptional<z.ZodString>;
/** Active chain, or the named one. Never falls back to another chain silently. */
export declare function resolveChainTarget(root: string, chain?: string): {
    chainVersion: string;
    data: ChainState;
};
/**
 * Engine text can carry host paths (git stderr, fs errors). Everything that
 * reaches the model is passed through here first: known roots become
 * project-relative, and any other absolute path is masked.
 */
export declare function scrubHostPaths(text: string, roots: ReadonlyArray<string | null | undefined>): string;
/**
 * A precondition failure that the CLI would print as its message. Keeps the
 * explanation (typed INVALID_OPERATION) but drops host paths. Typed errors
 * pass through untouched.
 */
export declare function asPrecondition(err: unknown, roots: ReadonlyArray<string | null | undefined>): never;
/** Upper bound for a returned diff; larger output is cut and flagged, never silently dropped. */
export declare const MAX_DIFF_CHARS: number;
export declare function boundText(text: string, max?: number): {
    text: string;
    truncated: boolean;
};
/** scrubHostPaths over every string in a JSON-shaped value. */
export declare function scrubDeep<T>(value: T, roots: ReadonlyArray<string | null | undefined>): T;
//# sourceMappingURL=queryHelpers.d.ts.map