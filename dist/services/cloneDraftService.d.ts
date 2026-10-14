export interface CloneInput {
    projectRoot: string;
    type: 'intent' | 'plan';
    sourceChain: string;
    sourceVersion: string;
    title: string;
    focus: string;
    allowReopenClosed?: boolean;
}
export declare function previewClone(input: CloneInput): {
    preview_token: string;
    content: string;
    diff: string;
    reset_sections: string[];
    effects: string[];
    type: "intent" | "plan";
    source: import("./f08Store").TargetRef;
    title: string;
    focus: string;
    target_chain: string;
    target_version: string;
    target_path: string;
    state_revision: string | null;
    template_sha256: string;
    content_sha256: string;
    allow_reopen_closed: boolean;
};
export declare function cloneTransactionFiles(input: CloneInput): string[];
export declare function cloneDraft(input: CloneInput, token: string): {
    target: import("./f08Store").TargetRef;
    source: import("./f08Store").TargetRef;
    sha256: string;
    diff: string;
    reset_sections: string[];
    chainVersion: string;
    relPath: string;
    title: string;
    focus: string;
};
//# sourceMappingURL=cloneDraftService.d.ts.map