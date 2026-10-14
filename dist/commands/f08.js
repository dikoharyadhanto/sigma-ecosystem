"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloneCommand = cloneCommand;
exports.auditCommand = auditCommand;
exports.decisionsCommand = decisionsCommand;
const commander_1 = require("commander");
const fs_1 = require("../utils/fs");
const localTransaction_1 = require("../engine/localTransaction");
const cloneDraftService_1 = require("../services/cloneDraftService");
const sourceReviewService_1 = require("../services/sourceReviewService");
const f08Store_1 = require("../services/f08Store");
const auditDecisionService_1 = require("../services/auditDecisionService");
const output = (result) => console.log(JSON.stringify(result, null, 2));
const fail = (error) => { console.error(error.message); process.exitCode = 1; };
function artifactType(value) {
    if (!['intent', 'plan', 'exec', 'roadmap', 'close'].includes(value))
        throw new Error('Invalid artifact type.');
    return value;
}
function cloneCommand(type) {
    return new commander_1.Command('clone').description('Preview a new DRAFT from a registered source. Confirm only after reviewing reset sections and diff.')
        .requiredOption('--from-chain <version>', 'Source intent chain, e.g. v1')
        .requiredOption('--from <version>', 'Source artifact version')
        .requiredOption('--title <text>', 'New title').requiredOption('--focus <text>', 'New focus')
        .option('--confirm', 'Create the reviewed DRAFT')
        .option('--preview-token <hash>', 'Token from the unchanged preview')
        .option('--yes', 'Explicitly confirm reopening a CLOSED chain for a new INTENT')
        .action(async (opts) => {
        try {
            const root = (0, fs_1.findProjectRoot)();
            const input = { projectRoot: root, type, sourceChain: opts.fromChain,
                sourceVersion: opts.from, title: opts.title, focus: opts.focus, allowReopenClosed: Boolean(opts.yes) };
            if (!opts.confirm) {
                output((0, cloneDraftService_1.previewClone)(input));
                return;
            }
            if (!opts.previewToken)
                throw new Error('--preview-token from a reviewed preview is required.');
            output(await (0, localTransaction_1.localTransaction)(root, type + '_clone', type === 'intent' ? 'ARC' : 'FMN', () => (0, cloneDraftService_1.cloneTransactionFiles)(input), () => (0, cloneDraftService_1.cloneDraft)(input, opts.previewToken)));
        }
        catch (error) {
            fail(error);
        }
    });
}
function auditCommand() {
    const cmd = new commander_1.Command('audit').description('Build audit snapshots and record original AUD responses. No approval or external sending.');
    cmd.command('new').requiredOption('--type <type>', 'Target artifact type').requiredOption('--v <version>', 'Target version')
        .requiredOption('--target-sha256 <hash>', 'Reviewed target hash')
        .option('--include-evidence', 'Include only registered, hash-matching text evidence within 512 KiB each')
        .action(async (opts) => {
        try {
            const root = (0, fs_1.findProjectRoot)(), type = artifactType(opts.type);
            output(await (0, localTransaction_1.localTransaction)(root, 'audit_new', 'Director', () => [(0, f08Store_1.f08StorePath)(root)], () => (0, auditDecisionService_1.createAuditPack)(root, type, opts.v, opts.targetSha256, opts.includeEvidence)));
        }
        catch (error) {
            fail(error);
        }
    });
    cmd.command('show <id>').option('--markdown', 'Render snapshots for manual audit handoff')
        .action((id, opts) => {
        try {
            const root = (0, fs_1.findProjectRoot)();
            if (opts.markdown)
                console.log((0, auditDecisionService_1.renderAuditPack)(root, id));
            else
                output((0, auditDecisionService_1.auditPackStatus)(root, id));
        }
        catch (error) {
            fail(error);
        }
    });
    cmd.command('record <id>').requiredOption('--text <text>', 'Exact original AUD response')
        .requiredOption('--origin <text>', 'Response source/vendor/session, explicitly declared')
        .requiredOption('--pack-sha256 <hash>', 'Reviewed pack manifest hash')
        .action(async (id, opts) => {
        try {
            const root = (0, fs_1.findProjectRoot)();
            output(await (0, localTransaction_1.localTransaction)(root, 'audit_record', 'AUD', () => [(0, f08Store_1.f08StorePath)(root)], () => (0, auditDecisionService_1.recordAuditResponse)(root, id, opts.text, opts.origin, opts.packSha256, 'AUD')));
        }
        catch (error) {
            fail(error);
        }
    });
    return cmd;
}
function decisionsCommand() {
    const cmd = new commander_1.Command('decisions').description('Substantive questions and control tickets are separate; answers never approve artifacts.');
    cmd.command('list').option('--chain <version>', 'Explicit historical intent chain').option('--history', 'Include resolved and terminal records')
        .action((opts) => {
        try {
            output((0, auditDecisionService_1.listDecisions)((0, fs_1.findProjectRoot)(), opts.chain, opts.history));
        }
        catch (error) {
            fail(error);
        }
    });
    cmd.command('add').requiredOption('--type <type>', 'Target artifact type').requiredOption('--v <version>', 'Target artifact version')
        .requiredOption('--question <text>', 'Explicit substantive question')
        .requiredOption('--target-sha256 <hash>', 'Reviewed target hash')
        .requiredOption('--role <role>', 'ARC, FMN or DEV')
        .action(async (opts) => {
        try {
            const root = (0, fs_1.findProjectRoot)(), type = artifactType(opts.type);
            output(await (0, localTransaction_1.localTransaction)(root, 'decisions_add', opts.role, () => [(0, f08Store_1.f08StorePath)(root)], () => (0, auditDecisionService_1.addQuestion)(root, type, opts.v, opts.question, opts.targetSha256, opts.role)));
        }
        catch (error) {
            fail(error);
        }
    });
    cmd.command('resolve <id>').requiredOption('--answer <text>', 'Director answer')
        .requiredOption('--target-sha256 <hash>', 'Reviewed unchanged target hash').option('--director-confirm', 'Explicit Director decision')
        .action(async (id, opts) => {
        try {
            if (!opts.directorConfirm)
                throw new Error('--director-confirm is required.');
            const root = (0, fs_1.findProjectRoot)();
            output(await (0, localTransaction_1.localTransaction)(root, 'decisions_resolve', 'Director', () => [(0, f08Store_1.f08StorePath)(root)], () => (0, auditDecisionService_1.resolveQuestion)(root, id, opts.answer, opts.targetSha256, true)));
        }
        catch (error) {
            fail(error);
        }
    });
    cmd.command('assess').description('Record an advisory FMN assessment; never grants approval.')
        .requiredOption('--v <version>', 'PLAN version')
        .requiredOption('--status <status>', 'READY, SCOPE_GAP, PENDING_ALIGNMENT, UNKNOWN')
        .requiredOption('--reason <text>', 'Substantive FMN rationale')
        .requiredOption('--target-sha256 <hash>', 'Reviewed PLAN hash')
        .requiredOption('--source-sha256 <hash>', 'Reviewed INTENT hash')
        .action(async (opts) => {
        try {
            const root = (0, fs_1.findProjectRoot)();
            output(await (0, localTransaction_1.localTransaction)(root, 'decisions_assess', 'FMN', () => [(0, f08Store_1.f08StorePath)(root)], () => (0, auditDecisionService_1.recordReadiness)(root, opts.v, opts.status, opts.reason, opts.targetSha256, opts.sourceSha256, 'FMN')));
        }
        catch (error) {
            fail(error);
        }
    });
    // A minimal read-only target hash helper avoids arbitrary path arguments.
    cmd.command('target').requiredOption('--type <type>', 'Artifact type').requiredOption('--v <version>', 'Artifact version')
        .action((opts) => {
        try {
            const root = (0, fs_1.findProjectRoot)();
            const { content: _content, ...target } = (0, sourceReviewService_1.captureArtifact)(root, (0, sourceReviewService_1.reviewChain)(root).chainVersion, artifactType(opts.type), opts.v);
            output(target);
        }
        catch (error) {
            fail(error);
        }
    });
    return cmd;
}
//# sourceMappingURL=f08.js.map