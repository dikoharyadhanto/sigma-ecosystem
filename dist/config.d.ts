export declare const SIGMA_VERSION = "1.0.0";
export declare const SCHEMA_VERSION = "1.2.0";
export declare const GLOBAL_SIGMA_DIR: string;
export declare const GLOBAL_TEMPLATES_DIR: string;
export declare const GLOBAL_RULES_DIR: string;
export declare const GLOBAL_GOVERNANCE_DIR: string;
export declare const GLOBAL_BRIDGE_DIR: string;
export declare const GLOBAL_CONFIG_FILE: string;
export declare const GLOBAL_NOTION_CREDENTIALS_FILE: string;
export declare const PROJECT_SIGMA_DIR = "Sigma";
export declare const PROJECT_IDENTITY_FILE = ".sigma-identity.json";
export declare const PROJECT_REMOTE_STATE_FILE = ".sigma-remote-state.json";
export declare const BRIDGE_STUBS: string[];
export declare const ACTIVATE_STATUS_FILE: string;
export declare const OVERRIDES_FILE: string;
export declare const OPERATIONS_LOG_FILE: string;
export declare const INTENT_AMENDMENT_LOG_FILE: string;
export declare const OPERATION_REGISTRY_FILE: string;
export declare const DOCUMENT_REGISTRY_FILE: string;
export declare const PROJECT_CONFIG_FILE: string;
export declare const SUBFOLDERS: string[];
/**
 * Where each governance artifact may live on disk, and how its filename is
 * shaped. New folder name first, pre-rename name second.
 *
 * Single source of truth, deliberately. This table existed twice — once inside
 * reconstruct.ts as PATTERNS, once inside the MCP artifact reader — and the two
 * drifted: the reader listed only the post-rename folders and so refused every
 * project created before PLAN-IMPL-SIGMA-ARTIFACT-FOLDER-RENAME-20260816, while
 * the CLI read those same projects perfectly well through the chain's stored
 * entry.file (reviewer finding R-10). CLI and MCP disagreeing about what a
 * project *is* trips the stop criterion in plan §22, so both now read this.
 *
 * `versionSource` is regex source, not a RegExp, because consumers embed it
 * differently: reconstruct captures the version out of a filename, the MCP
 * reader validates a version token it was handed. Sharing a mutable RegExp
 * would also share its lastIndex.
 */
export declare const ARTIFACT_LAYOUT: {
    readonly intent: {
        readonly dirs: readonly ["charter", "design"];
        readonly prefix: "DIR-INTENT";
        readonly versionSource: "v\\d+";
    };
    readonly roadmap: {
        readonly dirs: readonly ["roadmap", "build"];
        readonly prefix: "ROADMAP";
        readonly versionSource: "v\\d+";
    };
    readonly plan: {
        readonly dirs: readonly ["contract", "build"];
        readonly prefix: "FMN-PLAN";
        readonly versionSource: "v\\d+\\.\\d+";
    };
    readonly exec: {
        readonly dirs: readonly ["evidence", "build"];
        readonly prefix: "DEV-EXEC";
        readonly versionSource: "v\\d+\\.\\d+";
    };
    readonly close: {
        readonly dirs: readonly ["close"];
        readonly prefix: "DIR-CLOSE";
        readonly versionSource: "v\\d+";
    };
};
export type ArtifactDomainKey = keyof typeof ARTIFACT_LAYOUT;
export declare const MESSAGES_DIR: string;
export declare const MESSAGES_INDEX_FILE: string;
export declare const MESSAGES_ATTACHMENTS_DIR: string;
export declare const MESSAGE_SUBFOLDERS: string[];
export declare const REFERENCE_DIR: string;
export declare const REFERENCE_LIST_FILE: string;
export declare const REFERENCE_DATA_DIR: string;
export declare const VALID_ROLES: readonly ["ARC", "FMN", "DEV", "AUD", "DIRECTOR"];
export type SigmaRole = typeof VALID_ROLES[number];
export declare const MESSAGING_ROLES: readonly ["ARC", "FMN", "DEV", "AUD"];
export type MessagingRole = typeof MESSAGING_ROLES[number];
export declare const VALID_MESSAGE_TYPES: readonly ["NOTE", "CHECK", "RESPONSE", "HANDOFF", "QUESTION", "RISK", "MEMO"];
export type MessageType = typeof VALID_MESSAGE_TYPES[number];
export declare const VALID_ACTIONS: readonly ["FYI", "RESPOND", "REVIEW", "UNBLOCK", "OTHER"];
export type ActionRequired = typeof VALID_ACTIONS[number];
//# sourceMappingURL=config.d.ts.map