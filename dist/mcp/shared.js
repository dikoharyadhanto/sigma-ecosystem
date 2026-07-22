"use strict";
// PLAN-IMPL-01 Stage 1 — shared helpers for the sigma-mcp tools.
//
// HARD CONSTRAINT: nothing here (or anything it is reached from) may write to
// stdout. The stdio transport reserves stdout for JSON-RPC frames. Diagnostics
// go to stderr via console.error, never console.log.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOURCE_ENGINE = void 0;
exports.resolveRoot = resolveRoot;
exports.okText = okText;
exports.errText = errText;
exports.noProject = noProject;
const fs_1 = require("../utils/fs");
exports.SOURCE_ENGINE = 'engine';
// Returns the project root, or null when the caller is not inside a Sigma
// project. Tools treat null as a valid "no active project" state and respond
// gracefully rather than throwing (which would surface as a transport error).
function resolveRoot() {
    try {
        return (0, fs_1.findProjectRoot)();
    }
    catch {
        return null;
    }
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