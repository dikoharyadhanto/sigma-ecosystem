import { ArtifactType } from '../artifactPath';
export interface UpdateArtifactDraftInput {
    projectRoot: string;
    type: ArtifactType;
    version: string;
    content: string;
    expectedArtifactSha256: string;
}
export interface UpdateArtifactDraftResult {
    type: ArtifactType;
    version: string;
    path: string;
    bytes: number;
    sha256: string;
}
export declare function updateArtifactDraftTransactionFiles(input: Pick<UpdateArtifactDraftInput, 'projectRoot' | 'type' | 'version'>): string[];
export declare function updateArtifactDraft(input: UpdateArtifactDraftInput): UpdateArtifactDraftResult;
//# sourceMappingURL=artifactDraftUpdate.d.ts.map