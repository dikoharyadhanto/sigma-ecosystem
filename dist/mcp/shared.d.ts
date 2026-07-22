export declare const SOURCE_ENGINE: "engine";
export declare function resolveRoot(): string | null;
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