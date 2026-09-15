import { Binding } from './binding';
export declare const SOURCE_ENGINE: "engine";
export declare function setBinding(binding: Binding): void;
export declare function getBinding(): Binding;
/** Test-only: restores the unbound default between cases. */
export declare function resetBindingForTest(): void;
export declare function setClientRoots(roots: string[]): void;
export declare function addClientRoot(uriOrPath: string): void;
/**
 * Legacy multi-source resolution — DISCOVERY MODE ONLY.
 *
 * Kept because every MCP config written before Stage A launches the server
 * with no root at all, or with a bare positional one, and those installations
 * must keep working for one release (§7.1 rule 7, Director decision Q1).
 *
 * Once a binding exists this function is not consulted: contract.respond()
 * takes binding.root directly. Do not call it from new code — a new tool that
 * reaches for it is reintroducing exactly the hole Stage A closed.
 *
 * Candidate order:
 * 1. explicitPath (e.g. passed from an MCP tool argument)
 * 2. Environment variables (SIGMA_PROJECT_ROOT, INIT_CWD, PWD)
 * 3. CLI arguments (--project-root, --cwd, or a positional path)
 * 4. Client roots received via MCP protocol (roots/list)
 * 5. Current working directory (process.cwd())
 */
export declare function resolveRoot(explicitPath?: string): string | null;
export declare function okText(payload: unknown): {
    content: {
        type: "text";
        text: string;
    }[];
};
export declare function errText(message: string): {
    isError: true;
    content: {
        type: "text";
        text: string;
    }[];
};
export declare function noProject(extra?: Record<string, unknown>): {
    active: boolean;
    message: string;
    source: "engine";
};
//# sourceMappingURL=shared.d.ts.map