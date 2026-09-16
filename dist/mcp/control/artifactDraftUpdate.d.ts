import { ArtifactType } from '../artifactPath';
/** The three artifact types this tool supports updating a DRAFT of. A
 *  narrower alias of ArtifactType, not a redeclaration — roadmap/close
 *  remain rejected below even though they're valid ArtifactType values. */
export type UpdatableArtifactType = 'intent' | 'plan' | 'exec';
export declare function isUpdatableArtifactType(type: string): type is UpdatableArtifactType;
export declare function ownerRoleForArtifactType(type: UpdatableArtifactType): 'ARC' | 'FMN' | 'DEV';
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