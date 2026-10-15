"use strict";
// PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY-20261015 — WP-MCP-03 shared helpers
// for the priority query tools. Query plane only: nothing here writes.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_DIFF_CHARS = exports.chainArg = void 0;
exports.resolveChainTarget = resolveChainTarget;
exports.scrubHostPaths = scrubHostPaths;
exports.asPrecondition = asPrecondition;
exports.boundText = boundText;
exports.scrubDeep = scrubDeep;
const zod_1 = require("zod");
const path_1 = __importDefault(require("path"));
const chain_1 = require("../../engine/chain");
const contract_1 = require("../contract");
const errors_1 = require("../errors");
/** Optional chain selector, same meaning as the CLI's `--v` on these operations. */
exports.chainArg = zod_1.z.string().regex(/^v\d+$/).optional();
/** Active chain, or the named one. Never falls back to another chain silently. */
function resolveChainTarget(root, chain) {
    if (!chain)
        return (0, chain_1.readActiveChain)(root);
    if (!(0, chain_1.listChainVersions)(root).includes(chain)) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `Chain ${chain} not found in this project.`);
    }
    return { chainVersion: chain, data: (0, chain_1.readChain)(root, chain) };
}
/**
 * Engine text can carry host paths (git stderr, fs errors). Everything that
 * reaches the model is passed through here first: known roots become
 * project-relative, and any other absolute path is masked.
 */
function scrubHostPaths(text, roots) {
    let out = text;
    const known = roots.filter((r) => !!r).map((r) => path_1.default.resolve(r)).sort((a, b) => b.length - a.length);
    for (const r of known) {
        out = out.split(r + path_1.default.sep).join('').split(r).join('.');
    }
    return out.replace(/(?<![\w.:~-])\/(?:[\w.@+-]+\/)+[\w.@+-]+/g, '<path>');
}
/**
 * A precondition failure that the CLI would print as its message. Keeps the
 * explanation (typed INVALID_OPERATION) but drops host paths. Typed errors
 * pass through untouched.
 */
function asPrecondition(err, roots) {
    if (err instanceof errors_1.McpQueryError)
        throw err;
    const code = err?.code;
    if (typeof code === 'string' && code in contract_1.ERROR_CODES)
        throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, scrubHostPaths(message, roots));
}
/** Upper bound for a returned diff; larger output is cut and flagged, never silently dropped. */
exports.MAX_DIFF_CHARS = 64 * 1024;
function boundText(text, max = exports.MAX_DIFF_CHARS) {
    return text.length <= max ? { text, truncated: false } : { text: text.slice(0, max), truncated: true };
}
/** scrubHostPaths over every string in a JSON-shaped value. */
function scrubDeep(value, roots) {
    if (typeof value === 'string')
        return scrubHostPaths(value, roots);
    if (Array.isArray(value))
        return value.map((v) => scrubDeep(v, roots));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubDeep(v, roots)]));
    }
    return value;
}
//# sourceMappingURL=queryHelpers.js.map