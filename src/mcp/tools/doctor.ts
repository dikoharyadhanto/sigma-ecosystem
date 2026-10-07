import { lifecycleView } from '../../engine/lifecycleView';
// PLAN-IMPL-01 §3.4 — sigma_doctor
//
// Read-only WITH RESPECT TO DISK. runDoctorReconciliation mutates the chain
// object in memory (auto-repair of known corruption patterns) but only
// persists if the caller invokes writeChain. This tool deliberately never
// calls writeChain: it reports what reconciliation WOULD change as a
// diagnosis, flagged applied: false. A disk-writing doctor is a mutation and
// belongs to a later (Layer 3) increment, not here.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  readActiveChain,
  listChainVersions,
  readOverrides,
  runDoctorReconciliation,
} from '../../engine/chain';
import { noProject, SOURCE_ENGINE } from '../shared';
import { respond } from '../contract';
import { mailboxMigrationDiagnosis } from '../../engine/mailboxMigration';

// Pure core (PLAN-IMPL-01 §4-A).
export function computeDoctor(root: string | null): unknown {
  if (!root) return noProject();
  const mailbox = mailboxMigrationDiagnosis(root);
  if (listChainVersions(root).length === 0) return { active: true, findings: { repaired: [], invalidMarked: [], invalidCleared: [] }, mailbox, applied: false, source: SOURCE_ENGINE };

  // readActiveChain returns a fresh in-memory projection; mutating it here does
  // not touch disk because we never writeChain.
  const { data } = readActiveChain(root);
  const overrides = readOverrides(root);
  const findings = runDoctorReconciliation(data, overrides);

  return {
    active: true,
    lifecycle: lifecycleView(root,data),
    findings,
    mailbox,
    applied: false,
    source: SOURCE_ENGINE,
  };
}

import { z } from 'zod';

export function registerDoctorTool(server: McpServer): void {
  server.registerTool(
    'sigma_doctor',
    {
      title: 'Sigma Doctor (diagnosis only)',
      description:
        'Diagnose Sigma runtime and mailbox migration/integrity without writing, including projects before their first INTENT. Mailbox migration/reset requires CLI doctor --migrate-mailbox. Accepts optional project_root. Returns { active, findings, mailbox, applied: false, source }.',
      inputSchema: {
        project_root: z
          .string()
          .optional()
          .describe('Optional absolute path to the Sigma project root directory.'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ project_root }: { project_root?: string }) =>
      respond('sigma_doctor', project_root, computeDoctor),
  );
}
