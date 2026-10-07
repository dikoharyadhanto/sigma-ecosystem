"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerApprovalCommands = registerApprovalCommands;
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const governanceTransaction_1 = require("../engine/governanceTransaction");
const approvalService_1 = require("../services/approvalService");
const revisions_1 = require("../engine/revisions");
const revisions_2 = require("../engine/revisions");
const docCheck_1 = require("../utils/docCheck");
const controlStore_1 = require("../engine/controlStore");
function failure(e) { console.error(e.message); process.exitCode = 1; }
function registerApprovalCommands(cmd, domain) {
    cmd.command('lock').description('Removed: use approve; semantics follow lifecycle_model')
        .option('--v <version>', 'Former target', chain_1.normalizeVersionArg).action(() => failure(new Error('TOMBSTONE: sigma ' + domain + ' lock removed. Use sigma ' + domain + ' approve [--v <version>] --director-confirm. Legacy approves retain legacy lock semantics.')));
    cmd.command('approve').description('Preview or approve the exact artifact and dependencies')
        .option('--v <version>', 'Explicit target; required for imported baseline review', chain_1.normalizeVersionArg)
        .option('--director-confirm', 'Explicit Director approval of the displayed review package')
        .action(async (opts) => {
        try {
            const root = (0, fs_1.findProjectRoot)();
            const review = (0, approvalService_1.approvalReview)(root, domain, opts.v);
            (0, docCheck_1.printSigmaDocReport)((0, docCheck_1.validateSigmaDocFile)((0, revisions_2.artifactFile)(root, (0, chain_1.readActiveChain)(root).data, domain, review.version), domain), root);
            console.log(JSON.stringify(review, null, 2));
            if (!opts.directorConfirm) {
                console.log('Preview only. Re-run with --director-confirm to approve.');
                return;
            }
            (0, approvalService_1.ensureApprovalReady)(review);
            const result = await (0, governanceTransaction_1.withGovernanceTransaction)(root, domain + '_approve', () => (0, approvalService_1.approveArtifactTransactionFiles)(root, domain, opts.v), () => {
                if ((0, approvalService_1.approvalReview)(root, domain, opts.v).dependencies_sha256 !== review.dependencies_sha256)
                    throw new Error('Review dependencies changed; preview again.');
                return (0, approvalService_1.approveArtifactUseCase)(root, domain, opts.v);
            });
            console.log(JSON.stringify(result, null, 2));
            console.log((domain === 'plan' ? 'FMN-PLAN' : 'DEV-EXEC') + ' ' + result.version + ' ' + result.state + ' (' + result.lifecycle_model + ')');
        }
        catch (e) {
            failure(e);
        }
    });
    if (domain === 'exec') {
        cmd.command('acknowledge-plan').description('DEV explicitly acknowledges the latest PLAN revision; grants no coding authority')
            .requiredOption('--v <version>', 'EXEC target', chain_1.normalizeVersionArg).requiredOption('--revision <number>', 'Latest PLAN revision')
            .action(async (opts) => {
            try {
                const root = (0, fs_1.findProjectRoot)();
                const revision = Number(opts.revision);
                if (!Number.isSafeInteger(revision) || revision < 1)
                    throw new Error('Positive integer --revision required.');
                console.log(JSON.stringify(await (0, governanceTransaction_1.withGovernanceTransaction)(root, 'exec_acknowledge_plan', () => [(0, chain_1.chainFilePath)(root, (0, chain_1.readActiveChain)(root).chainVersion)], () => (0, revisions_1.acknowledgePlan)(root, opts.v, revision)), null, 2));
            }
            catch (e) {
                failure(e);
            }
        });
        return;
    }
    const revise = cmd.command('revise').description('FMN stages/checks/commits a controlled APPROVED contract revision');
    revise.command('prepare').requiredOption('--v <version>', 'PLAN target', chain_1.normalizeVersionArg)
        .requiredOption('--checkpoint <checkpoint>', 'pre-build | post-build | director').requiredOption('--reason <reason>', 'Reason also recorded in candidate Contract Changes')
        .requiredOption('--requested-by <role>', 'FMN | DEV | Director').requiredOption('--loosening <boolean>', 'Explicit true or false human classification')
        .requiredOption('--delta <description>', 'Delta also recorded in candidate Contract Changes').option('--replace-staging', 'Explicitly replace an unfinished stale staging candidate; canonical PLAN is unaffected')
        .action(async (opts) => {
        try {
            if (!['true', 'false'].includes(opts.loosening))
                throw new Error('--loosening must be true or false.');
            const root = (0, fs_1.findProjectRoot)();
            const p = (0, revisions_1.revisionPaths)(opts.v);
            const declaration = { checkpoint: opts.checkpoint, reason: opts.reason, requested_by: opts.requestedBy, loosening: opts.loosening === 'true', delta: opts.delta };
            console.log(JSON.stringify(await (0, governanceTransaction_1.withGovernanceTransaction)(root, 'plan_revise_prepare', () => [(0, revisions_1.boundedPath)(root, p.candidate), (0, revisions_1.boundedPath)(root, p.staging)], () => (0, revisions_1.preparePlanRevision)(root, opts.v, declaration, !!opts.replaceStaging)), null, 2));
        }
        catch (e) {
            failure(e);
        }
    });
    revise.command('check').requiredOption('--v <version>', 'PLAN target', chain_1.normalizeVersionArg).option('--prepare-ticket', 'Freeze review into a Director approval ticket')
        .action(async (opts) => {
        try {
            const root = (0, fs_1.findProjectRoot)();
            const review = (0, revisions_1.checkPlanRevision)(root, opts.v);
            console.log(JSON.stringify(review, null, 2));
            if (opts.prepareTicket) {
                const id = (0, controlStore_1.generateId)('opt');
                console.log(JSON.stringify(await (0, governanceTransaction_1.withGovernanceTransaction)(root, 'plan_revise_ticket', () => [(0, controlStore_1.ticketPath)(root, id)], () => (0, revisions_1.prepareRevisionTicket)(root, opts.v, id)), null, 2));
            }
        }
        catch (e) {
            failure(e);
        }
    });
    revise.command('commit').requiredOption('--v <version>', 'PLAN target', chain_1.normalizeVersionArg).option('--ticket <id>', 'Director-approved candidate ticket').option('--approval <id>', 'Trusted local approval record')
        .action(async (opts) => {
        try {
            const root = (0, fs_1.findProjectRoot)();
            console.log(JSON.stringify(await (0, governanceTransaction_1.withGovernanceTransaction)(root, 'plan_revise_commit', () => [...(0, revisions_1.revisionTransactionFiles)(root, opts.v), ...(opts.ticket ? [(0, controlStore_1.ticketPath)(root, opts.ticket)] : []), ...(opts.approval ? [(0, controlStore_1.approvalPath)(root, opts.approval)] : [])], () => (0, revisions_1.commitPlanRevision)(root, opts.v, opts.ticket, opts.approval)), null, 2));
        }
        catch (e) {
            failure(e);
        }
    });
}
//# sourceMappingURL=approval.js.map