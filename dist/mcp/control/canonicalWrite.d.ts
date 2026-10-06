import { ArtifactType } from '../artifactPath';
export interface CanonicalWriteResult {
    abs: string;
    rel: string;
    bytes: number;
    sha256: string;
}
export declare function writeCanonicalArtifactFile(root: string, type: ArtifactType, version: string, trackerFile: string, content: string): CanonicalWriteResult;
//# sourceMappingURL=canonicalWrite.d.ts.map