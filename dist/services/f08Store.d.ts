export declare const F08_STORE = "Sigma/logs/f08.json";
export declare const digest: (value: string | Buffer) => string;
export interface TargetRef {
    chain: string;
    type: 'intent' | 'plan' | 'exec' | 'roadmap' | 'close';
    version: string;
    path: string;
    sha256: string;
}
export interface CapturedFile extends TargetRef {
    content: string;
}
export interface AuditPack {
    id: string;
    project_id: string;
    created_at: string;
    state_revision: string;
    target: TargetRef;
    files: CapturedFile[];
    missing: string[];
    evidence: {
        description: string;
        path: string;
        recorded_sha256: string;
    }[];
    evidence_snapshots: {
        path: string;
        sha256: string;
        content: string;
    }[];
    review: unknown;
    manifest_sha256: string;
}
export interface AuditResponse {
    id: string;
    pack_id: string;
    pack_sha256: string;
    raw: string;
    sha256: string;
    origin: string;
    recorded_by: string;
    created_at: string;
}
export interface Question {
    id: string;
    target: TargetRef;
    question: string;
    created_by: string;
    created_at: string;
    answer?: string;
    resolved_at?: string;
    resolved_by?: string;
    resolution_sha256?: string;
}
export interface Assessment {
    id: string;
    target: TargetRef;
    source_sha256: string;
    status: 'READY' | 'SCOPE_GAP' | 'PENDING_ALIGNMENT' | 'UNKNOWN';
    reason: string;
    recorded_by: 'FMN';
    created_at: string;
}
export interface CloneRecord {
    target: TargetRef;
    source: TargetRef;
    created_at: string;
    diff: string;
    reset_sections: string[];
}
export interface F08Store {
    format: 1;
    project_id: string;
    packs: AuditPack[];
    responses: AuditResponse[];
    questions: Question[];
    assessments: Assessment[];
    clones: CloneRecord[];
}
export declare function f08StorePath(root: string): string;
export declare function readF08Store(root: string): F08Store;
export declare function writeF08Store(root: string, data: F08Store): void;
//# sourceMappingURL=f08Store.d.ts.map