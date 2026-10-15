// PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY-20261015 — WP-MCP-03 shared helpers
// for the priority query tools. Query plane only: nothing here writes.

import { z } from 'zod';
import path from 'path';
import { ChainState, readActiveChain, readChain, listChainVersions } from '../../engine/chain';
import { ERROR_CODES } from '../contract';
import { McpQueryError } from '../errors';

/** Optional chain selector, same meaning as the CLI's `--v` on these operations. */
export const chainArg = z.string().regex(/^v\d+$/).optional();

/** Active chain, or the named one. Never falls back to another chain silently. */
export function resolveChainTarget(root: string, chain?: string): { chainVersion: string; data: ChainState } {
  if (!chain) return readActiveChain(root);
  if (!listChainVersions(root).includes(chain)) {
    throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, `Chain ${chain} not found in this project.`);
  }
  return { chainVersion: chain, data: readChain(root, chain) };
}

/**
 * Engine text can carry host paths (git stderr, fs errors). Everything that
 * reaches the model is passed through here first: known roots become
 * project-relative, and any other absolute path is masked.
 */
export function scrubHostPaths(text: string, roots: ReadonlyArray<string | null | undefined>): string {
  let out = text;
  const known = roots.filter((r): r is string => !!r).map((r) => path.resolve(r)).sort((a, b) => b.length - a.length);
  for (const r of known) {
    out = out.split(r + path.sep).join('').split(r).join('.');
  }
  return out.replace(/(?<![\w.:~-])\/(?:[\w.@+-]+\/)+[\w.@+-]+/g, '<path>');
}

/**
 * A precondition failure that the CLI would print as its message. Keeps the
 * explanation (typed INVALID_OPERATION) but drops host paths. Typed errors
 * pass through untouched.
 */
export function asPrecondition(err: unknown, roots: ReadonlyArray<string | null | undefined>): never {
  if (err instanceof McpQueryError) throw err;
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code in ERROR_CODES) throw err;
  const message = err instanceof Error ? err.message : String(err);
  throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, scrubHostPaths(message, roots));
}

/** Upper bound for a returned diff; larger output is cut and flagged, never silently dropped. */
export const MAX_DIFF_CHARS = 64 * 1024;

export function boundText(text: string, max = MAX_DIFF_CHARS): { text: string; truncated: boolean } {
  return text.length <= max ? { text, truncated: false } : { text: text.slice(0, max), truncated: true };
}

/** scrubHostPaths over every string in a JSON-shaped value. */
export function scrubDeep<T>(value: T, roots: ReadonlyArray<string | null | undefined>): T {
  if (typeof value === 'string') return scrubHostPaths(value, roots) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, roots)) as unknown as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, scrubDeep(v, roots)])) as T;
  }
  return value;
}
