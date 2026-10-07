import type { ChainState, ArtifactVersion } from './chain';
export type LifecycleModel = 'legacy_lock' | 'paired_approval' | 'unknown';
export declare function resolveLifecycleModel(chain: ChainState): LifecycleModel;
export declare function assertKnownLifecycle(chain: ChainState): void;
export declare function eligiblePlanState(chain: ChainState): string;
export declare function approvedPlanCurrent(chain: ChainState, plan: ArtifactVersion): boolean;
export declare function lifecycleWarnings(chain: ChainState): string[];
//# sourceMappingURL=lifecycle.d.ts.map