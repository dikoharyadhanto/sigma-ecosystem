import { ChainState, readChain, resolveActiveChainVersion, writeChain, chainFilePath, validateChainNumbering, hasCleanGate2Chain, hasCleanGate3Chain } from './chain';
import { resolveLifecycleModel } from './lifecycle';
import { withGovernanceTransaction } from './governanceTransaction';
import { roadmapTransactionFiles, renderGovernanceRoadmap } from './revisions';
export function lifecycleMigrationPreview(chain: ChainState) {
    const model = resolveLifecycleModel(chain);
    if (model === 'unknown')
        throw new Error('Unknown lifecycle provenance; migration cannot infer approval history.');
    validateChainNumbering(chain);
    const plans = new Set<string>();
    const execs = new Set<string>();
    for (const p of chain.plan.versions) {
        if (plans.has(p.version) || !['DRAFT', 'LOCKED', 'SUPERSEDED', ...(model === 'paired_approval' ? ['APPROVED'] : [])].includes(p.state) || p.intent_version_ref !== chain.intent.version)
            throw new Error('Ambiguous PLAN migration identity/state: ' + p.version);
        plans.add(p.version);
    }
    for (const e of chain.exec.versions) {
        if (execs.has(e.version) || !['DRAFT', 'LOCKED', 'SUPERSEDED'].includes(e.state) || !e.plan_version_ref || !plans.has(e.plan_version_ref) || e.version !== e.plan_version_ref)
            throw new Error('Ambiguous EXEC migration identity/state: ' + e.version);
        execs.add(e.version);
    }
    for (const p of chain.plan.versions) {
        const pairs = chain.exec.versions.filter(e => e.plan_version_ref === p.version && e.state !== 'SUPERSEDED');
        if (pairs.length > 1 || p.state === 'SUPERSEDED' && pairs.length || p.state === 'DRAFT' && pairs.some(e => e.state === 'LOCKED') || model === 'paired_approval' && p.state === 'LOCKED' && (pairs.length !== 1 || pairs[0].state !== 'LOCKED'))
            throw new Error('Ambiguous PLAN/EXEC pair: ' + p.version);
    }
    const migrated = JSON.parse(JSON.stringify(chain)) as ChainState;
    const changes: string[] = [];
    if (model === 'paired_approval')
        return { chain: migrated, changes, applied: false, needs_baseline_review: migrated.plan.versions.filter(p => p.state === 'APPROVED' && !p.revision).map(p => p.version) };
    migrated.lifecycle_model = 'paired_approval';
    changes.push('lifecycle_model: legacy_lock -> paired_approval');
    for (const p of migrated.plan.versions) {
        if (p.state !== 'LOCKED')
            continue;
        const pair = migrated.exec.versions.find(e => e.plan_version_ref === p.version && e.state !== 'SUPERSEDED');
        if (pair?.state === 'LOCKED') {
            p.historical_legacy = true;
            pair.historical_legacy = true;
            continue;
        }
        p.legacy_provenance = { state: 'LOCKED', locked_at: p.locked_at };
        delete p.locked_at;
        p.state = 'APPROVED';
        if (migrated.plan.active_version === p.version)
            migrated.plan.active_state = 'APPROVED';
        changes.push('PLAN ' + p.version + ': LOCKED -> APPROVED; explicit imported baseline review required');
    }
    migrated.gates.gate_2_open = hasCleanGate2Chain(migrated);
    migrated.gates.gate_3_satisfied = hasCleanGate3Chain(migrated);
    return { chain: migrated, changes, applied: false, needs_baseline_review: migrated.plan.versions.filter(p => p.state === 'APPROVED' && !p.revision).map(p => p.version) };
}
export async function migrateLifecycle(root: string, version?: string, dryRun = false, directorConfirm = false) {
    if (!dryRun && !directorConfirm)
        throw new Error('--director-confirm is required for lifecycle migration. Preview with --dry-run first.');
    const target = version ?? resolveActiveChainVersion(root);
    // A dry-run must not create a lease directory or transaction journal.
    if (dryRun) {
        const preview = lifecycleMigrationPreview(readChain(root, target));
        return { ...preview, chain: undefined, target, applied: false };
    }
    return withGovernanceTransaction(root, 'lifecycle_migrate', () => [chainFilePath(root, target), ...roadmapTransactionFiles(root, readChain(root, target))], () => {
        const preview = lifecycleMigrationPreview(readChain(root, target));
        if (!preview.changes.length)
            return { ...preview, chain: undefined, target, applied: false };
        renderGovernanceRoadmap(root, preview.chain);
        writeChain(root, target, preview.chain);
        return { ...preview, chain: undefined, target, applied: true };
    });
}
