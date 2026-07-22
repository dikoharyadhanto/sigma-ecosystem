// PLAN-IMPL-01 Stage 1 — shared helpers for the sigma-mcp tools.
//
// HARD CONSTRAINT: nothing here (or anything it is reached from) may write to
// stdout. The stdio transport reserves stdout for JSON-RPC frames. Diagnostics
// go to stderr via console.error, never console.log.

import { findProjectRoot } from '../utils/fs';

export const SOURCE_ENGINE = 'engine' as const;

// Returns the project root, or null when the caller is not inside a Sigma
// project. Tools treat null as a valid "no active project" state and respond
// gracefully rather than throwing (which would surface as a transport error).
export function resolveRoot(): string | null {
  try {
    return findProjectRoot();
  } catch {
    return null;
  }
}

// Standard success envelope. If a future SDK spike (PLAN-IMPL-01 §2.5) confirms
// structuredContent support, swap the body to include it — the call sites do
// not change.
export function okText(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
}

export function errText(message: string) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
  };
}

// Uniform "no active Sigma project/chain in this directory" payload. This is a
// valid state, not an error — returned via okText, not errText.
export function noProject(extra: Record<string, unknown> = {}) {
  return {
    active: false,
    message: 'No active Sigma project or chain in this directory.',
    source: SOURCE_ENGINE,
    ...extra,
  };
}
