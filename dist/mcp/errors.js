"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpQueryError = void 0;
// Shared typed error for query-tool boundary/validation failures.
//
// contract.respond() unwraps this via its `code` field and turns it into a
// typed error envelope with the message preserved; anything untyped is
// anonymised to INTERNAL_ERROR instead (§8 rule 5). Every query tool that
// needs to reject a call with one of the frozen ERROR_CODES throws this
// rather than a bare Error, so the boundary is explicit at the throw site.
class McpQueryError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'McpQueryError';
    }
}
exports.McpQueryError = McpQueryError;
//# sourceMappingURL=errors.js.map