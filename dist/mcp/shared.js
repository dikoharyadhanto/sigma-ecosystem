"use strict";
// PLAN-IMPL-01 Stage 1 — shared helpers for the sigma-mcp tools.
//
// HARD CONSTRAINT: nothing here (or anything it is reached from) may write to
// stdout. The stdio transport reserves stdout for JSON-RPC frames. Diagnostics
// go to stderr via console.error, never console.log.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOURCE_ENGINE = void 0;
exports.setClientRoots = setClientRoots;
exports.addClientRoot = addClientRoot;
exports.resolveRoot = resolveRoot;
exports.okText = okText;
exports.errText = errText;
exports.noProject = noProject;
const url_1 = require("url");
const fs_1 = require("../utils/fs");
exports.SOURCE_ENGINE = 'engine';
const clientRootsCache = [];
function setClientRoots(roots) {
    clientRootsCache.length = 0;
    for (const r of roots) {
        addClientRoot(r);
    }
}
function addClientRoot(uriOrPath) {
    try {
        const pathStr = uriOrPath.startsWith('file://')
            ? (0, url_1.fileURLToPath)(uriOrPath)
            : uriOrPath;
        if (pathStr && !clientRootsCache.includes(pathStr)) {
            clientRootsCache.push(pathStr);
        }
    }
    catch {
        // Ignore malformed URIs
    }
}
/**
 * Resolves the Sigma project root from multiple candidate sources:
 * 1. explicitPath (e.g. passed from an MCP tool argument)
 * 2. Environment variables (SIGMA_PROJECT_ROOT, INIT_CWD, PWD)
 * 3. CLI arguments (--project-root, --cwd, or a positional path)
 * 4. Client roots received via MCP protocol (roots/list)
 * 5. Current working directory (process.cwd())
 */
function resolveRoot(explicitPath) {
    const candidates = [];
    // 1. Explicit path parameter
    if (explicitPath && typeof explicitPath === 'string' && explicitPath.trim().length > 0) {
        candidates.push(explicitPath.trim());
    }
    // 2. Environment variables
    if (process.env.SIGMA_PROJECT_ROOT)
        candidates.push(process.env.SIGMA_PROJECT_ROOT);
    if (process.env.INIT_CWD)
        candidates.push(process.env.INIT_CWD);
    // 3. CLI arguments (e.g., sigma-mcp --project-root <path> or sigma-mcp <path>)
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--project-root' || arg === '--cwd') {
            if (args[i + 1])
                candidates.push(args[i + 1]);
        }
        else if (!arg.startsWith('-')) {
            candidates.push(arg);
        }
    }
    if (process.env.PWD)
        candidates.push(process.env.PWD);
    // 4. MCP Client Roots
    for (const root of clientRootsCache) {
        candidates.push(root);
    }
    // 5. Default process.cwd()
    candidates.push(process.cwd());
    // Try each candidate directory using findProjectRoot()
    for (const candidate of candidates) {
        try {
            const root = (0, fs_1.findProjectRoot)(candidate);
            if (root)
                return root;
        }
        catch {
            // Continue to next candidate
        }
    }
    return null;
}
// Standard success envelope. If a future SDK spike (PLAN-IMPL-01 §2.5) confirms
// structuredContent support, swap the body to include it — the call sites do
// not change.
function okText(payload) {
    return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}
function errText(message) {
    return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    };
}
// Uniform "no active Sigma project/chain in this directory" payload. This is a
// valid state, not an error — returned via okText, not errText.
function noProject(extra = {}) {
    return {
        active: false,
        message: 'No active Sigma project or chain in this directory.',
        source: exports.SOURCE_ENGINE,
        ...extra,
    };
}
//# sourceMappingURL=shared.js.map