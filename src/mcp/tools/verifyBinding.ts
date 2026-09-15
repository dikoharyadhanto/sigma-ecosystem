// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §9.1 — sigma_verify_binding
//
// Lets a consumer confirm, before it does anything else, that this server is
// bound to the project the consumer thinks it is. An orchestrator holding
// several sessions has otherwise no way to tell them apart: every other tool
// answers happily about whichever project it is bound to.
//
// It only ever compares against the existing binding. It never searches the
// filesystem for the expected project, and a mismatch is reported as a fact,
// not resolved by moving the binding.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SOURCE_ENGINE, getBinding } from '../shared';
import { respond, fingerprintOfExpectedRoot } from '../contract';

export function computeVerifyBinding(
  root: string | null,
  expected: { projectId?: string; root?: string }
): unknown {
  const binding = getBinding();

  const idMatch =
    expected.projectId === undefined ? null : binding.projectId === expected.projectId;

  const rootMatch =
    expected.root === undefined
      ? null
      : binding.root !== null && fingerprintOfExpectedRoot(expected.root) === binding.rootFingerprint;

  // "Usable" is deliberately stricter than "bound": a checked expectation that
  // fails makes the session unusable for that consumer even though the server
  // itself is perfectly well bound.
  const ok = binding.root !== null && idMatch !== false && rootMatch !== false;

  return {
    active: root !== null,
    bound: binding.root !== null,
    binding_verified: binding.verified,
    binding_kind: binding.kind,
    mode: binding.mode,
    bound_role: binding.role,
    expected_project_id_match: idMatch,
    expected_root_match: rootMatch,
    usable: ok,
    source: SOURCE_ENGINE,
  };
}

export function registerVerifyBindingTool(server: McpServer): void {
  server.registerTool(
    'sigma_verify_binding',
    {
      title: 'Verify Sigma Project Binding',
      description:
        'Confirm which Sigma project this MCP server is bound to, and optionally check that binding against what the caller expects. Read-only. Optional expected_project_id and expected_root are compared against the server-side binding only — this tool never searches for another project and never changes the binding. Returns { bound, binding_verified, binding_kind, mode, bound_role, expected_project_id_match, expected_root_match, usable, source }. A null match field means the caller did not supply that expectation.',
      inputSchema: {
        expected_project_id: z
          .string()
          .optional()
          .describe('Project ID the caller believes this server is bound to.'),
        expected_root: z
          .string()
          .optional()
          .describe('Absolute project root the caller believes this server is bound to. Compared by fingerprint; never used to rebind.'),
      },
    },
    async ({ expected_project_id, expected_root }: { expected_project_id?: string; expected_root?: string }) =>
      respond('sigma_verify_binding', undefined, (root) =>
        computeVerifyBinding(root, { projectId: expected_project_id, root: expected_root })
      )
  );
}
