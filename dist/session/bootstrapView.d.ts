import { ChainState, Gates, ProjectIdentity } from '../engine/chain';
export interface BootstrapView {
    projectRoot: string;
    identity: ProjectIdentity;
    chainVersion: string | null;
    chain: ChainState | null;
    gates: Gates | null;
    nextOps: string[];
}
export declare function buildBootstrapView(projectRoot?: string): BootstrapView;
//# sourceMappingURL=bootstrapView.d.ts.map