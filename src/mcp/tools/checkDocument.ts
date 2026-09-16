// Stage B2 — sigma_check_document. Query-plane equivalent of `sigma intent
// check`, `sigma roadmap check`, `sigma plan check`, `sigma exec check`,
// `sigma close check` — five CLI commands that are all one pipeline
// (validateSigmaDocFile -> SigmaDocCheckReport -> printSigmaDocReport),
// differing only in how the target file's path is resolved. One typed tool
// with `type: z.enum([...])`, not five near-identical tools — the CHECK
// group is the one B2 group uniform enough to warrant this (contrast
// STATUS/LIST, which stay as separate tools because their shapes genuinely
// differ per type).
//
// SigmaDocCheckReport.file is an absolute host path (docCheck.ts always
// returns it that way; the CLI converts it to relative only at print time,
// in printSigmaDocReport). Never forward that raw — redactPath() (same
// primitive sigma_get_memory uses) converts it to a project-relative path on
// a verified binding, exactly like the CLI's own path.relative() call, and
// preserves legacy unbound-client behaviour otherwise.
//
// plan/exec share the same ambiguity rule `sigma plan check`/`sigma exec
// check` already enforce (PLAN-IMPL-MULTIDRAFT-LOCK §8.3): without an
// explicit version, more than one open DRAFT is refused rather than
// silently picking one — resolveTargetVersion() is the same chain.ts
// function the CLI commands call for this.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  ChainState,
  readActiveChain,
  listChainVersions,
  resolveTargetVersion,
  ArtifactVersion,
} from '../../engine/chain';
import { SOURCE_ENGINE, noProject, getBinding } from '../shared';
import { respond, redactPath, ERROR_CODES } from '../contract';
import { McpQueryError } from '../errors';
import { validateSigmaDocFile, SigmaDocDomain } from '../../utils/docCheck';
import path from 'path';

export type CheckDocumentType = SigmaDocDomain;

function resolveSingleObject(
  chain: ChainState,
  type: 'intent' | 'roadmap' | 'close',
  version?: string
): { version: string; file: string } {
  const entry = type === 'intent' ? chain.intent : type === 'roadmap' ? chain.roadmap : chain.close;
  if (!entry) {
    throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, `No ${type.toUpperCase()} found for this chain.`);
  }
  if (version && version !== entry.version) {
    throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, `${type.toUpperCase()} ${version} not found; the active chain has ${entry.version}.`);
  }
  if (!entry.file) {
    throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, `${type.toUpperCase()} has no file registered.`);
  }
  return { version: entry.version, file: entry.file };
}

function resolveArrayEntry(
  chain: ChainState,
  type: 'plan' | 'exec',
  version?: string
): { version: string; file: string } {
  const versions: ArtifactVersion[] = type === 'plan' ? chain.plan.versions : chain.exec.versions;
  const activeVersion = type === 'plan' ? chain.plan.active_version : chain.exec.active_version;

  if (!version) {
    const resolution = resolveTargetVersion(versions, undefined);
    if (resolution.kind === 'ambiguous') {
      throw new McpQueryError(
        ERROR_CODES.INVALID_OPERATION,
        `${resolution.candidates.length} DRAFT ${type === 'plan' ? 'FMN-PLANs' : 'DEV-EXECs'} are open: ` +
        `${resolution.candidates.join(', ')}. Specify version to check one.`
      );
    }
  }

  const entry = version
    ? versions.find((v) => v.version === version)
    : versions.find((v) => v.version === activeVersion);
  if (!entry) {
    throw new McpQueryError(
      ERROR_CODES.INVALID_OPERATION,
      version ? `${type} version ${version} not found.` : `No active ${type} version found.`
    );
  }
  if (!entry.file) {
    throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, `${type} ${entry.version} has no file registered.`);
  }
  return { version: entry.version, file: entry.file };
}

export function computeCheckDocument(root: string | null, type: CheckDocumentType, version?: string): unknown {
  if (!root) return noProject();
  if (listChainVersions(root).length === 0) return noProject();

  const { chainVersion, data: chain } = readActiveChain(root);
  const resolved =
    type === 'intent' || type === 'roadmap' || type === 'close'
      ? resolveSingleObject(chain, type, version)
      : resolveArrayEntry(chain, type, version);

  const absPath = path.join(root, resolved.file);
  const report = validateSigmaDocFile(absPath, type);
  const binding = getBinding();

  return {
    active_chain: chainVersion,
    type,
    version: resolved.version,
    ok: report.ok,
    heading: report.heading,
    file: redactPath(binding, report.file),
    document_type: report.documentType,
    schema: report.schema,
    errors: report.errors,
    warnings: report.warnings,
    passes: report.passes,
    requirements: report.requirements,
    source: SOURCE_ENGINE,
  };
}

export function registerCheckDocumentTool(server: McpServer): void {
  server.registerTool(
    'sigma_check_document',
    {
      title: 'Validate a Sigma governance document',
      description:
        'Runs structural/marker validation on one governance document (intent, roadmap, plan, exec, or close) in ' +
        'the active chain — the query-plane equivalent of `sigma <domain> check`. For plan/exec, defaults to the ' +
        'active version; if more than one DRAFT is open, version is required. Read-only, never mutates the ' +
        'document or the chain. Returns { active_chain, type, version, ok, heading, file, document_type, schema, ' +
        'errors, warnings, passes, requirements, source } — file is project-relative, never a host absolute path.',
      inputSchema: {
        type: z.enum(['intent', 'roadmap', 'plan', 'exec', 'close']),
        version: z
          .string()
          .optional()
          .describe('Target version, e.g. "v1" (intent/roadmap/close) or "v0.1" (plan/exec). Defaults to the active version.'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ type, version }: { type: CheckDocumentType; version?: string }) =>
      respond('sigma_check_document', undefined, (root) => computeCheckDocument(root, type, version))
  );
}
