"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewClone = previewClone;
exports.cloneTransactionFiles = cloneTransactionFiles;
exports.cloneDraft = cloneDraft;
// F08b: supported section mapping, fresh identity and explicit preview binding.
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const intentDraftService_1 = require("./intentDraftService");
const planDraftService_1 = require("./planDraftService");
const artifacts_1 = require("../utils/artifacts");
const numbering_1 = require("../engine/numbering");
const chain_1 = require("../engine/chain");
const controlStore_1 = require("../engine/controlStore");
const docCheck_1 = require("../utils/docCheck");
const contract_1 = require("../mcp/contract");
const sourceReviewService_1 = require("./sourceReviewService");
const f08Store_1 = require("./f08Store");
const artifactNames_1 = require("../engine/artifactNames");
const CONTRACT_SECTIONS = {
    intent: new Set(['PURPOSE_AND_PROBLEM', 'DESIRED_OUTCOME_AND_MEASUREMENT', 'SCOPE', 'QUALITY_STANDARDS',
        'PRIORITIES_AND_CONSTRAINTS', 'ASSUMPTIONS_AND_RISKS', 'FUNCTIONAL_REQUIREMENTS', 'RESEARCH']),
    plan: new Set(['OBJECTIVE', 'REQUIREMENT', 'KEY_OUTPUT', 'WORK_ORDER', 'ACCEPTANCE_AND_TEST_CONTRACT',
        'CONSTRAINTS_FOR_DEV', 'WORK_OUTSIDE_INTENT']),
};
function delta(before, after) {
    const a = before.replace(/\r\n/g, '\n').split('\n'), b = after.replace(/\r\n/g, '\n').split('\n');
    let head = 0, tail = 0;
    while (head < a.length && head < b.length && a[head] === b[head])
        head++;
    while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail])
        tail++;
    return ['--- source', '+++ new draft', '@@ line ' + (head + 1) + ' @@',
        ...a.slice(head, a.length - tail).map(v => '-' + v), ...b.slice(head, b.length - tail).map(v => '+' + v)].join('\n');
}
function previewClone(input) {
    const { projectRoot: root, type } = input;
    if (!['intent', 'plan'].includes(type))
        throw new Error('Clone supports INTENT and PLAN only.');
    if (!input.title.trim() || !input.focus.trim() || /[|\r\n]/.test(input.title + input.focus))
        throw new Error('Clone title/focus must be non-empty single-line table-safe values.');
    const source = (0, sourceReviewService_1.captureArtifact)(root, input.sourceChain, type, input.sourceVersion);
    // INTENT schema 5 and 6 share the section IDs and order, so a schema 5 source
    // is cloned into the schema 6 template; its sections keep their source wording.
    const docType = type === 'intent' ? 'DIR_INTENT' : 'FMN_PLAN';
    const sourceSchemas = type === 'intent' ? ['5', '6'] : ['3', '4'], destinationExpected = type === 'intent' ? '6' : '4';
    const template = fs_extra_1.default.readFileSync((0, artifacts_1.resolveTemplate)(type === 'intent' ? 'DIR-INTENT-TEMPLATE.md' : 'FMN-PLAN-TEMPLATE.md'), 'utf8');
    const schemaOf = (text) => text.match(/<!--\s*SIGMA:DOC type=([A-Z_]+) schema=(\d+)\s*-->/);
    const sourceSchema = schemaOf(source.content), destinationSchema = schemaOf(template);
    if (sourceSchema?.[1] !== docType || destinationSchema?.[1] !== docType ||
        !sourceSchemas.includes(sourceSchema[2]) || destinationSchema[2] !== destinationExpected)
        throw new Error('Unsupported clone schema mapping. Supported: INTENT 5→6 and 6→6, PLAN 3→4 and 4→4. Checkpoints are reset for FMN reassessment. Review older schemas manually; host templates may require F09.');
    const structure = (0, docCheck_1.validateSigmaDocFile)(path_1.default.join(root, source.path), type);
    if (!structure.ok)
        throw new Error('Source structure invalid: ' + structure.errors.join('; '));
    const sourceSections = (0, sourceReviewService_1.sectionsOf)(source.content, docType), templateSections = (0, sourceReviewService_1.sectionsOf)(template, docType);
    if (new Set(sourceSections.map(s => s.id)).size !== sourceSections.length ||
        new Set(templateSections.map(s => s.id)).size !== templateSections.length)
        throw new Error('Duplicate section markers; cannot clone.');
    const unknown = sourceSections.filter(s => !templateSections.some(t => t.id === s.id));
    if (unknown.length)
        throw new Error('Unmapped source sections: ' + unknown.map(s => s.id).join(', '));
    const active = (0, sourceReviewService_1.reviewChain)(root);
    const targetChain = type === 'intent' ? (0, chain_1.nextChainVersion)(root) : active.chainVersion;
    const targetVersion = type === 'intent' ? targetChain : (0, chain_1.nextPlanVersion)(active.data, active.data.intent.version);
    const sourceById = new Map(sourceSections.map(s => [s.id, s]));
    // Review cadence depends on the new work; use the template default for FMN reassessment.
    const allowed = CONTRACT_SECTIONS[type];
    let content = template.slice(0, template.indexOf(templateSections[0].marker));
    for (const section of templateSections) {
        const old = sourceById.get(section.id);
        if (old && allowed.has(section.id)) {
            // Boundary obligations survive; historical ratification is not inherited.
            content += section.marker + old.body.replace(/\bAMENDMENT_RATIFIED\b/g, 'AMENDMENT_REQUESTED').replace(/\[x\]/gi, '[ ]');
        }
        else
            content += section.marker + section.body;
    }
    content = content.replace(/<!--\s*SIGMA:CHAIN\b[\s\S]*?-->\s*/g, '');
    if (type === 'plan')
        content = content.replace('INTENT-v{X}', 'INTENT-' + active.data.intent.version);
    content = (0, numbering_1.withChainMetadata)(content, { intent: targetChain,
        versioning_scheme: type === 'intent' ? 'intent_aligned' : (0, numbering_1.resolveVersioningScheme)(active.data) });
    const targetDir = type === 'intent' ? 'charter' : 'contract';
    const targetPath = 'Sigma/' + targetDir + '/' + (0, artifactNames_1.artifactFileName)(type, targetVersion);
    // Either name form counts (F10).
    if (fs_extra_1.default.existsSync(path_1.default.join(root, targetPath)) || (0, artifactNames_1.existingArtifactNames)(root, type, targetDir, targetVersion).length > 0)
        throw new Error('Clone destination already exists.');
    const reset = templateSections.filter(s => !allowed.has(s.id)).map(s => s.id);
    const binding = {
        type, source: (0, sourceReviewService_1.targetOnly)(source), title: input.title, focus: input.focus,
        target_chain: targetChain, target_version: targetVersion, target_path: targetPath,
        state_revision: (0, contract_1.computeStateRevision)(root).revision, template_sha256: (0, f08Store_1.digest)(template),
        content_sha256: (0, f08Store_1.digest)(content), allow_reopen_closed: Boolean(input.allowReopenClosed),
    };
    return { ...binding, preview_token: (0, f08Store_1.digest)(JSON.stringify(binding)), content,
        diff: delta(source.content, content), reset_sections: reset,
        effects: type === 'intent' ? ['Create and activate a new DRAFT INTENT chain; source unchanged.'] : ['Create a new DRAFT PLAN under the active chain; source unchanged.'] };
}
function cloneTransactionFiles(input) {
    return [...(input.type === 'intent' ? (0, intentDraftService_1.createIntentDraftTransactionFiles)(input.projectRoot) : (0, planDraftService_1.createPlanDraftTransactionFiles)(input.projectRoot)),
        (0, f08Store_1.f08StorePath)(input.projectRoot)];
}
function cloneDraft(input, token) {
    const preview = previewClone(input);
    if (preview.preview_token !== token)
        throw new Error('STALE_ARTIFACT: source, template or project state changed; preview clone again.');
    const created = input.type === 'intent'
        ? (0, intentDraftService_1.createIntentDraft)({ projectRoot: input.projectRoot, title: input.title, focus: input.focus, allowReopenClosed: input.allowReopenClosed })
        : (0, planDraftService_1.createPlanDraft)({ projectRoot: input.projectRoot, title: input.title, focus: input.focus });
    (0, controlStore_1.journaledWrite)(input.projectRoot, path_1.default.join(input.projectRoot, created.relPath), preview.content);
    (0, controlStore_1.controlTestFailpoint)('f08_clone_after_content');
    const target = (0, sourceReviewService_1.targetOnly)((0, sourceReviewService_1.captureArtifact)(input.projectRoot, preview.target_chain, input.type, preview.target_version));
    const data = (0, f08Store_1.readF08Store)(input.projectRoot);
    data.clones.push({ target, source: preview.source, created_at: new Date().toISOString(), diff: preview.diff, reset_sections: preview.reset_sections });
    (0, f08Store_1.writeF08Store)(input.projectRoot, data);
    (0, controlStore_1.controlTestFailpoint)('f08_clone_after_record');
    return { ...created, target, source: preview.source, sha256: target.sha256, diff: preview.diff, reset_sections: preview.reset_sections };
}
//# sourceMappingURL=cloneDraftService.js.map