import { ChainState } from '../engine/chain';
import { SigmaDocCheckReport } from '../utils/docCheck';
export declare class PlanPromoteError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/**
 * Re-derives the one location a pending plan `id` may occupy
 * (`Sigma/pending/FMN-PLAN-<id>.md`) and verifies `trackerFile` both
 * declares that exact path and still resolves there after symlinks/
 * junctions are followed — the same posture assertCanonicalLocation() uses
 * for versioned artifacts, applied to the one fixed pending-plan path.
 * Returns the verified absolute path. Call this immediately before the
 * operation it guards (open or move) — see header.
 */
export declare function assertPendingPlanCanonicalPath(projectRoot: string, id: string, trackerFile: string): string;
export declare function assertValidPromoteArgs(title: string, focus: string): void;
/** Re-runs every plan_promote precondition (short of the pending entry's
 *  own presence, checked by the caller) against a live chain — used by both
 *  prepare and the MCP-scope preview. Throws PlanPromoteError. */
export declare function assertPlanPromoteGatesOpen(chain: ChainState): void;
export declare function findPendingPlan(chain: ChainState, id: string): import("../engine/chain").PendingPlanEntry;
export interface PromotePlanResult {
    chainVersion: string;
    version: string;
    oldRelPath: string;
    newRelPath: string;
    docReport: SigmaDocCheckReport;
}
export declare function planPromoteTransactionFiles(projectRoot: string, id: string): string[];
/**
 * Promotes a pending plan (`id`) into the official DRAFT queue with an
 * assigned version, renaming its file and re-rendering the ROADMAP Stage
 * Overview. Throws PlanPromoteError (GATE_BLOCKED / INVALID_OPERATION /
 * BOUNDARY_VIOLATION) for every business-rule rejection.
 *
 * The promoted document is validated after the move and its report
 * returned rather than trusted silently — mirrors what `sigma plan
 * promote` (CLI) already does. Like the CLI, an invalid result still
 * commits (a promoted plan is a DRAFT, not required to be lock-eligible);
 * `docReport.ok` tells the caller whether it needs fixing before `plan
 * lock`.
 */
export declare function promotePlanUseCase(projectRoot: string, id: string, title: string, focus: string): PromotePlanResult;
//# sourceMappingURL=planPromoteService.d.ts.map