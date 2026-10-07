"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveVersioningScheme = resolveVersioningScheme;
exports.planMajorForChain = planMajorForChain;
exports.parseChainMetadata = parseChainMetadata;
exports.readChainMetadata = readChainMetadata;
exports.withChainMetadata = withChainMetadata;
exports.writeChainMetadata = writeChainMetadata;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
function resolveVersioningScheme(chain) {
    const value = chain.versioning_scheme;
    if (value === undefined)
        return 'legacy_offset';
    if (value !== 'legacy_offset' && value !== 'intent_aligned') {
        throw new Error(`Unknown versioning_scheme: ${String(value)}. Restore chain identity before continuing.`);
    }
    return value;
}
function planMajorForChain(chain) {
    const match = /^v(\d+)$/.exec(chain.intent.version);
    if (!match)
        throw new Error(`Invalid INTENT version: ${chain.intent.version}`);
    return Number(match[1]) - (resolveVersioningScheme(chain) === 'legacy_offset' ? 1 : 0);
}
function parseChainMetadata(content) {
    const starts = content.match(/<!--\s*SIGMA:CHAIN\b/g) ?? [];
    if (starts.length === 0)
        return null;
    if (starts.length !== 1)
        throw new Error('Duplicate SIGMA:CHAIN metadata.');
    const marker = /<!--\s*SIGMA:CHAIN\s+intent=(v\d+)\s+versioning_scheme=(legacy_offset|intent_aligned)(?:\s+plan=(v\d+\.\d+))?\s*-->/.exec(content);
    if (!marker)
        throw new Error('Malformed SIGMA:CHAIN metadata.');
    return { intent: marker[1], versioning_scheme: marker[2], ...(marker[3] ? { plan: marker[3] } : {}) };
}
function readChainMetadata(file, projectRoot) {
    if (projectRoot) {
        const relative = path_1.default.relative(fs_extra_1.default.realpathSync(projectRoot), fs_extra_1.default.realpathSync(file));
        if (relative === '..' || relative.startsWith(`..${path_1.default.sep}`) || path_1.default.isAbsolute(relative)) {
            throw new Error('BOUNDARY_VIOLATION: chain metadata resolves outside the project.');
        }
    }
    const stat = fs_extra_1.default.statSync(file);
    if (!stat.isFile())
        throw new Error('BOUNDARY_VIOLATION: chain metadata path is not a regular file.');
    if (stat.size > 512 * 1024)
        throw new Error('PAYLOAD_TOO_LARGE: chain metadata exceeds the byte read limit.');
    return parseChainMetadata(fs_extra_1.default.readFileSync(file, 'utf8'));
}
function withChainMetadata(content, metadata) {
    const existing = parseChainMetadata(content);
    if (existing) {
        if (existing.intent !== metadata.intent || existing.versioning_scheme !== metadata.versioning_scheme || existing.plan !== metadata.plan) {
            throw new Error('SIGMA:CHAIN metadata conflicts with the owning chain.');
        }
        return content;
    }
    const newline = content.includes('\r\n') ? '\r\n' : '\n';
    const marker = `<!-- SIGMA:CHAIN intent=${metadata.intent} versioning_scheme=${metadata.versioning_scheme}${metadata.plan ? ` plan=${metadata.plan}` : ''} -->`;
    const firstEnd = content.indexOf('\n');
    if (firstEnd < 0)
        return content + newline + marker + newline;
    return content.slice(0, firstEnd + 1) + marker + newline + content.slice(firstEnd + 1);
}
function writeChainMetadata(file, chain, plan) {
    const content = withChainMetadata(fs_extra_1.default.readFileSync(file, 'utf8'), {
        intent: chain.intent.version, versioning_scheme: resolveVersioningScheme(chain), ...(plan ? { plan } : {}),
    });
    fs_extra_1.default.writeFileSync(file, content, 'utf8');
}
//# sourceMappingURL=numbering.js.map