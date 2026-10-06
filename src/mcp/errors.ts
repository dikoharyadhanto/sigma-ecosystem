// Shared typed error for query-tool boundary/validation failures.
//
// contract.respond() unwraps this via its `code` field and turns it into a
// typed error envelope with the message preserved; anything untyped is
// anonymised to INTERNAL_ERROR instead (§8 rule 5). Every query tool that
// needs to reject a call with one of the frozen ERROR_CODES throws this
// rather than a bare Error, so the boundary is explicit at the throw site.
export class McpQueryError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'McpQueryError';
  }
}
