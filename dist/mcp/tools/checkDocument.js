"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCheckDocument = computeCheckDocument;
exports.registerCheckDocumentTool = registerCheckDocumentTool;
const zod_1 = require("zod");
const chain_1 = require("../../engine/chain");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
const errors_1 = require("../errors");
const docCheck_1 = require("../../utils/docCheck");
const path_1 = __importDefault(require("path"));
function resolveSingleObject(chain, type, version) {
    const entry = type === 'intent' ? chain.intent : type === 'roadmap' ? chain.roadmap : chain.close;
    if (!entry) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `No ${type.toUpperCase()} found for this chain.`);
    }
    if (version && version !== entry.version) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `${type.toUpperCase()} ${version} not found; the active chain has ${entry.version}.`);
    }
    if (!entry.file) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `${type.toUpperCase()} has no file registered.`);
    }
    return { version: entry.version, file: entry.file };
}
function resolveArrayEntry(chain, type, version) {
    const versions = type === 'plan' ? chain.plan.versions : chain.exec.versions;
    const activeVersion = type === 'plan' ? chain.plan.active_version : chain.exec.active_version;
    if (!version) {
        const resolution = (0, chain_1.resolveTargetVersion)(versions, undefined);
        if (resolution.kind === 'ambiguous') {
            throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `${resolution.candidates.length} DRAFT ${type === 'plan' ? 'FMN-PLANs' : 'DEV-EXECs'} are open: ` +
                `${resolution.candidates.join(', ')}. Specify version to check one.`);
        }
    }
    const entry = version
        ? versions.find((v) => v.version === version)
        : versions.find((v) => v.version === activeVersion);
    if (!entry) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, version ? `${type} version ${version} not found.` : `No active ${type} version found.`);
    }
    if (!entry.file) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `${type} ${entry.version} has no file registered.`);
    }
    return { version: entry.version, file: entry.file };
}
function computeCheckDocument(root, type, version) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return (0, shared_1.noProject)();
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(root);
    const resolved = type === 'intent' || type === 'roadmap' || type === 'close'
        ? resolveSingleObject(chain, type, version)
        : resolveArrayEntry(chain, type, version);
    const absPath = path_1.default.join(root, resolved.file);
    const report = (0, docCheck_1.validateSigmaDocFile)(absPath, type);
    const binding = (0, shared_1.getBinding)();
    return {
        active_chain: chainVersion,
        type,
        version: resolved.version,
        ok: report.ok,
        heading: report.heading,
        file: (0, contract_1.redactPath)(binding, report.file),
        document_type: report.documentType,
        schema: report.schema,
        errors: report.errors,
        warnings: report.warnings,
        passes: report.passes,
        requirements: report.requirements,
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerCheckDocumentTool(server) {
    server.registerTool('sigma_check_document', {
        title: 'Validate a Sigma governance document',
        description: 'Runs structural/marker validation on one governance document (intent, roadmap, plan, exec, or close) in ' +
            'the active chain — the query-plane equivalent of `sigma <domain> check`. For plan/exec, defaults to the ' +
            'active version; if more than one DRAFT is open, version is required. Read-only, never mutates the ' +
            'document or the chain. Returns { active_chain, type, version, ok, heading, file, document_type, schema, ' +
            'errors, warnings, passes, requirements, source } — file is project-relative, never a host absolute path.',
        inputSchema: {
            type: zod_1.z.enum(['intent', 'roadmap', 'plan', 'exec', 'close']),
            version: zod_1.z
                .string()
                .optional()
                .describe('Target version, e.g. "v1" (intent/roadmap/close) or "v0.1" (plan/exec). Defaults to the active version.'),
            project_root: zod_1.z.string().optional().describe('Optional absolute path to the Sigma project root directory.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ type, version, project_root }) => (0, contract_1.respond)('sigma_check_document', project_root, (root) => computeCheckDocument(root, type, version)));
}
//# sourceMappingURL=checkDocument.js.map