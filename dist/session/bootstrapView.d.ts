import { ChainState, Gates, ProjectIdentity } from '../engine/chain';
import { VersioningScheme } from '../engine/numbering';
export interface BootstrapView {
    projectRoot: string;
    identity: ProjectIdentity;
    chainVersion: string | null;
    chain: ChainState | null;
    gates: Gates | null;
    nextOps: string[];
    numbering: {
        scheme: VersioningScheme;
        intent_version: string;
        plan_major: number;
        source: 'chain' | 'legacy_fallback';
    } | null;
    compatibilityWarnings: string[];
}
export declare function buildBootstrapView(projectRoot?: string): BootstrapView;
//# sourceMappingURL=bootstrapView.d.ts.map