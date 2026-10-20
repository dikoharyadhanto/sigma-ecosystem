export interface OriginMachine {
    name: string;
    recorded_at: string;
}
export declare const MAX_MACHINE_NAME_LENGTH = 64;
export declare function currentMachineName(): string;
export declare function validateMachineName(raw: string): string;
export declare function parseOriginMachine(value: unknown): OriginMachine | null;
export declare function sameMachine(a: string, b: string): boolean;
/** Read-merge-write of `origin_machine`; every other identity field survives. Returns the previous record. */
export declare function writeOriginMachine(projectRoot: string, name: string, now?: Date): OriginMachine | null;
//# sourceMappingURL=originMachine.d.ts.map