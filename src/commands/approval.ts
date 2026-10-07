import { Command } from 'commander';
import { readActiveChain, chainFilePath, normalizeVersionArg } from '../engine/chain';
import { findProjectRoot } from '../utils/fs';
import { withGovernanceTransaction } from '../engine/governanceTransaction';
import { approvalReview, ensureApprovalReady, approveArtifactUseCase, approveArtifactTransactionFiles, ApprovalDomain } from '../services/approvalService';
import { revisionPaths, boundedPath, ChangeDeclaration, preparePlanRevision, checkPlanRevision, prepareRevisionTicket, commitPlanRevision, revisionTransactionFiles, acknowledgePlan } from '../engine/revisions';
import { artifactFile } from '../engine/revisions';
import { validateSigmaDocFile, printSigmaDocReport } from '../utils/docCheck';
import { generateId, ticketPath, approvalPath } from '../engine/controlStore';
function failure(e: unknown): void { console.error((e as Error).message); process.exitCode = 1; }
export function registerApprovalCommands(cmd: Command, domain: ApprovalDomain): void {
    cmd.command('lock').description('Removed: use approve; semantics follow lifecycle_model')
        .option('--v <version>', 'Former target', normalizeVersionArg).action(() => failure(new Error('TOMBSTONE: sigma ' + domain + ' lock removed. Use sigma ' + domain + ' approve [--v <version>] --director-confirm. Legacy approves retain legacy lock semantics.')));
    cmd.command('approve').description('Preview or approve the exact artifact and dependencies')
        .option('--v <version>', 'Explicit target; required for imported baseline review', normalizeVersionArg)
        .option('--director-confirm', 'Explicit Director approval of the displayed review package')
        .action(async (opts: {
        v?: string;
        directorConfirm?: boolean;
    }) => {
        try {
            const root = findProjectRoot();
            const review = approvalReview(root, domain, opts.v);
            printSigmaDocReport(validateSigmaDocFile(artifactFile(root, readActiveChain(root).data, domain, review.version), domain), root);
            console.log(JSON.stringify(review, null, 2));
            if (!opts.directorConfirm) {
                console.log('Preview only. Re-run with --director-confirm to approve.');
                return;
            }
            ensureApprovalReady(review);
            const result = await withGovernanceTransaction(root, domain + '_approve', () => approveArtifactTransactionFiles(root, domain, opts.v), () => {
                if (approvalReview(root, domain, opts.v).dependencies_sha256 !== review.dependencies_sha256)
                    throw new Error('Review dependencies changed; preview again.');
                return approveArtifactUseCase(root, domain, opts.v);
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
            .requiredOption('--v <version>', 'EXEC target', normalizeVersionArg).requiredOption('--revision <number>', 'Latest PLAN revision')
            .action(async (opts: {
            v: string;
            revision: string;
        }) => {
            try {
                const root = findProjectRoot();
                const revision = Number(opts.revision);
                if (!Number.isSafeInteger(revision) || revision < 1)
                    throw new Error('Positive integer --revision required.');
                console.log(JSON.stringify(await withGovernanceTransaction(root, 'exec_acknowledge_plan', () => [chainFilePath(root, readActiveChain(root).chainVersion)], () => acknowledgePlan(root, opts.v, revision)), null, 2));
            }
            catch (e) {
                failure(e);
            }
        });
        return;
    }
    const revise = cmd.command('revise').description('FMN stages/checks/commits a controlled APPROVED contract revision');
    revise.command('prepare').requiredOption('--v <version>', 'PLAN target', normalizeVersionArg)
        .requiredOption('--checkpoint <checkpoint>', 'pre-build | post-build | director').requiredOption('--reason <reason>', 'Reason also recorded in candidate Contract Changes')
        .requiredOption('--requested-by <role>', 'FMN | DEV | Director').requiredOption('--loosening <boolean>', 'Explicit true or false human classification')
        .requiredOption('--delta <description>', 'Delta also recorded in candidate Contract Changes').option('--replace-staging', 'Explicitly replace an unfinished stale staging candidate; canonical PLAN is unaffected')
        .action(async (opts: any) => {
        try {
            if (!['true', 'false'].includes(opts.loosening))
                throw new Error('--loosening must be true or false.');
            const root = findProjectRoot();
            const p = revisionPaths(opts.v);
            const declaration: ChangeDeclaration = { checkpoint: opts.checkpoint, reason: opts.reason, requested_by: opts.requestedBy, loosening: opts.loosening === 'true', delta: opts.delta };
            console.log(JSON.stringify(await withGovernanceTransaction(root, 'plan_revise_prepare', () => [boundedPath(root, p.candidate), boundedPath(root, p.staging)], () => preparePlanRevision(root, opts.v, declaration, !!opts.replaceStaging)), null, 2));
        }
        catch (e) {
            failure(e);
        }
    });
    revise.command('check').requiredOption('--v <version>', 'PLAN target', normalizeVersionArg).option('--prepare-ticket', 'Freeze review into a Director approval ticket')
        .action(async (opts: {
        v: string;
        prepareTicket?: boolean;
    }) => {
        try {
            const root = findProjectRoot();
            const review = checkPlanRevision(root, opts.v);
            console.log(JSON.stringify(review, null, 2));
            if (opts.prepareTicket) {
                const id = generateId('opt');
                console.log(JSON.stringify(await withGovernanceTransaction(root, 'plan_revise_ticket', () => [ticketPath(root, id)], () => prepareRevisionTicket(root, opts.v, id)), null, 2));
            }
        }
        catch (e) {
            failure(e);
        }
    });
    revise.command('commit').requiredOption('--v <version>', 'PLAN target', normalizeVersionArg).option('--ticket <id>', 'Director-approved candidate ticket').option('--approval <id>', 'Trusted local approval record')
        .action(async (opts: {
        v: string;
        ticket?: string;
        approval?: string;
    }) => { try {
        const root = findProjectRoot();
        console.log(JSON.stringify(await withGovernanceTransaction(root, 'plan_revise_commit', () => [...revisionTransactionFiles(root, opts.v), ...(opts.ticket ? [ticketPath(root, opts.ticket)] : []), ...(opts.approval ? [approvalPath(root, opts.approval)] : [])], () => commitPlanRevision(root, opts.v, opts.ticket, opts.approval)), null, 2));
    }
    catch (e) {
        failure(e);
    } });
}
