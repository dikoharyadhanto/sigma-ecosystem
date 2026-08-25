"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeHumanNotionTitle = computeHumanNotionTitle;
exports.collectHumanPushTargets = collectHumanPushTargets;
exports.pushHumanArtifact = pushHumanArtifact;
exports.pushAllHumanArtifacts = pushAllHumanArtifacts;
exports.reconcileSupersededHumanArtifacts = reconcileSupersededHumanArtifacts;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const chain_1 = require("./chain");
const notionService_1 = require("./notionService");
const terminologyScanner_1 = require("./terminologyScanner");
const fidelityCoverage_1 = require("./fidelityCoverage");
// §2.6 — the Notion-facing title, distinct from `target.artifactType`
// (which stays the internal Sigma label, used only in CLI output — never
// published). No "Sigma", no artifact codes, matches the terminology
// mapping's own vocabulary (DIR-INTENT -> "Project Brief", DEV-EXEC ->
// "Delivery"). Version stays in the title for lookup uniqueness across
// superseded history; a bare version tag isn't Sigma-specific vocabulary.
function computeHumanNotionTitle(kind, version, projectName) {
    const label = kind === 'intent' ? 'Project Brief' : kind === 'exec' ? 'Delivery Summary' : 'Closing Summary';
    return `${projectName} — ${label} (${version})`;
}
function humanPaths(prefix, version) {
    return {
        humanRelPath: path_1.default.join('Sigma', 'human', `${prefix}-${version}.md`),
        ledgerRelPath: path_1.default.join('Sigma', 'human', `${prefix}-${version}.fidelity.md`),
    };
}
// Collects every human artifact the chain currently knows about — not just
// ones missing a push timestamp. Re-pushing an already-pushed artifact is
// intentional and safe (syncArtifactToNotion() is idempotent, D-04): a
// Director who edits the human doc after an earlier push needs the update
// to actually reach Notion, not be silently skipped because it "already
// happened once."
function collectHumanPushTargets(chain) {
    const targets = [];
    // SUPERSEDED entries are excluded here on purpose — those get deleted by
    // reconcileSupersededHumanArtifacts(), not re-pushed. Re-syncing a
    // SUPERSEDED artifact's content right before deleting it would be wasted
    // work at best and a race at worst.
    if (chain.intent.human && chain.intent.state !== 'SUPERSEDED') {
        const { humanRelPath, ledgerRelPath } = humanPaths('DIR-INTENT-HUMAN', chain.intent.version);
        targets.push({
            kind: 'intent',
            artifactType: 'DIR-INTENT-HUMAN',
            version: chain.intent.version,
            humanRelPath,
            ledgerRelPath,
            sourceRelPaths: [chain.intent.file ?? path_1.default.join('Sigma', 'charter', `DIR-INTENT-${chain.intent.version}.md`)],
            coverageConfig: fidelityCoverage_1.DIR_INTENT_COVERAGE_CONFIG,
        });
    }
    for (const execEntry of chain.exec.versions) {
        if (!execEntry.human || execEntry.state === 'SUPERSEDED')
            continue;
        const { humanRelPath, ledgerRelPath } = humanPaths('PLAN-EXEC-HUMAN', execEntry.version);
        const planEntry = execEntry.plan_version_ref
            ? chain.plan.versions.find(v => v.version === execEntry.plan_version_ref)
            : undefined;
        const sourceRelPaths = [
            planEntry?.file ?? (execEntry.plan_version_ref ? path_1.default.join('Sigma', 'contract', `FMN-PLAN-${execEntry.plan_version_ref}.md`) : undefined),
            execEntry.file ?? path_1.default.join('Sigma', 'evidence', `DEV-EXEC-${execEntry.version}.md`),
        ].filter((p) => Boolean(p));
        targets.push({
            kind: 'exec',
            artifactType: 'PLAN-EXEC-HUMAN',
            version: execEntry.version,
            humanRelPath,
            ledgerRelPath,
            sourceRelPaths,
            coverageConfig: fidelityCoverage_1.PLAN_EXEC_COVERAGE_CONFIG,
        });
    }
    if (chain.close?.human && chain.close.state !== 'SUPERSEDED') {
        const { humanRelPath, ledgerRelPath } = humanPaths('DIR-CLOSE-HUMAN', chain.close.version);
        targets.push({
            kind: 'close',
            artifactType: 'DIR-CLOSE-HUMAN',
            version: chain.close.version,
            humanRelPath,
            ledgerRelPath,
            sourceRelPaths: [chain.close.file ?? path_1.default.join('Sigma', 'close', `DIR-CLOSE-${chain.close.version}.md`)],
            coverageConfig: fidelityCoverage_1.DIR_CLOSE_COVERAGE_CONFIG,
        });
    }
    return targets;
}
async function pushHumanArtifact(projectRoot, target) {
    const humanAbsPath = path_1.default.join(projectRoot, target.humanRelPath);
    const ledgerAbsPath = path_1.default.join(projectRoot, target.ledgerRelPath);
    if (!fs_extra_1.default.existsSync(humanAbsPath)) {
        return { target, success: false, error: `${target.humanRelPath} not found.` };
    }
    if (!fs_extra_1.default.existsSync(ledgerAbsPath)) {
        return { target, success: false, error: `${target.ledgerRelPath} (Fidelity Ledger) not found.` };
    }
    const rawContent = fs_extra_1.default.readFileSync(humanAbsPath, 'utf8');
    const ledgerContent = fs_extra_1.default.readFileSync(ledgerAbsPath, 'utf8');
    // §2.7 tahap 0 — strip before anything else scans this content.
    const { cleaned } = (0, terminologyScanner_1.stripTemplateInstructions)(rawContent);
    // §2.7 tahap 1 — terminology gate. Blocking, not a warning.
    const terminology = (0, terminologyScanner_1.loadTerminologyList)(projectRoot);
    const termMatches = (0, terminologyScanner_1.scanForSigmaTerminology)(cleaned, terminology);
    if (termMatches.length > 0) {
        const list = termMatches.map(m => `  Line ${m.line}: "${m.term}" — ${m.lineText}`).join('\n');
        return {
            target,
            success: false,
            error: `Sigma terminology detected in ${target.humanRelPath} — push blocked:\n${list}`,
        };
    }
    // §2.3/§2.7 tahap 2 — fidelity coverage gate, against the (concatenated)
    // source artifact(s), not the human doc itself.
    const sourceContent = target.sourceRelPaths
        .map(rel => {
        const abs = path_1.default.join(projectRoot, rel);
        return fs_extra_1.default.existsSync(abs) ? fs_extra_1.default.readFileSync(abs, 'utf8') : '';
    })
        .join('\n');
    const coverageGaps = (0, fidelityCoverage_1.checkFidelityCoverage)(sourceContent, ledgerContent, target.coverageConfig);
    if (coverageGaps.length > 0) {
        const list = coverageGaps.map(g => `  ${g.identifier} (${g.kind}): ${g.detail}`).join('\n');
        return {
            target,
            success: false,
            error: `Fidelity Ledger coverage incomplete for ${target.humanRelPath} — push blocked:\n${list}`,
        };
    }
    const identity = (0, chain_1.readProjectIdentity)(projectRoot);
    const notionTitle = computeHumanNotionTitle(target.kind, target.version, identity.project_name);
    const pushRes = await (0, notionService_1.syncArtifactToNotion)(projectRoot, target.artifactType, target.version, cleaned, notionTitle);
    if (!pushRes.success) {
        return { target, success: false, error: pushRes.error };
    }
    return { target, success: true, pageUrl: pushRes.pageUrl };
}
// Pushes every human artifact currently generated on the active chain and
// persists pushed_to_notion_at/notion_page_url for each success — this is
// what `sigma plan new`/`sigma close new` check (§3.4/§4 Fase 6) to decide
// whether the humanize gate is satisfied. A partial failure still persists
// whatever succeeded; only the failed target's state is left unstamped.
async function pushAllHumanArtifacts(projectRoot) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    const targets = collectHumanPushTargets(chain);
    if (targets.length === 0)
        return [];
    const results = [];
    for (const target of targets) {
        const result = await pushHumanArtifact(projectRoot, target);
        results.push(result);
        if (result.success) {
            const now = new Date().toISOString();
            if (target.kind === 'intent' && chain.intent.human) {
                chain.intent.human.pushed_to_notion_at = now;
                chain.intent.human.notion_page_url = result.pageUrl;
            }
            else if (target.kind === 'exec') {
                const execEntry = chain.exec.versions.find(v => v.version === target.version);
                if (execEntry?.human) {
                    execEntry.human.pushed_to_notion_at = now;
                    execEntry.human.notion_page_url = result.pageUrl;
                }
            }
            else if (target.kind === 'close' && chain.close?.human) {
                chain.close.human.pushed_to_notion_at = now;
                chain.close.human.notion_page_url = result.pageUrl;
            }
        }
    }
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    return results;
}
function supersededCandidatesForChain(chain) {
    const candidates = [];
    if (chain.intent.state === 'SUPERSEDED' && chain.intent.human) {
        candidates.push({ kind: 'intent', artifactType: 'DIR-INTENT-HUMAN', version: chain.intent.version });
    }
    for (const execEntry of chain.exec.versions) {
        if (execEntry.state === 'SUPERSEDED' && execEntry.human) {
            candidates.push({ kind: 'exec', artifactType: 'PLAN-EXEC-HUMAN', version: execEntry.version });
        }
    }
    if (chain.close?.state === 'SUPERSEDED' && chain.close.human) {
        candidates.push({ kind: 'close', artifactType: 'DIR-CLOSE-HUMAN', version: chain.close.version });
    }
    return candidates;
}
// §2.5 — Notion must never keep showing a human artifact whose source is
// SUPERSEDED locally. Not a hook on `intent supersede`/`plan supersede`
// (that would give a core governance command a network dependency,
// contradicting plan v2 §1) — deliberately checked here, at push time,
// covering only artifacts that were actually pushed at least once
// (chain.*.human present).
//
// Scans every chain on disk, not just the active one — `intent supersede
// --v <version>` routinely targets a chain other than the currently active
// one (Director opens v2, leaving v1 SUPERSEDED but still on disk), and a
// project can end up with zero eligible "active" chain at all (every chain
// SUPERSEDED — resolveActiveChainVersion() throws in that case). Neither
// scenario should silently skip cleanup.
async function reconcileSupersededHumanArtifacts(projectRoot) {
    const results = [];
    const identity = (0, chain_1.readProjectIdentity)(projectRoot);
    for (const version of (0, chain_1.listChainVersions)(projectRoot)) {
        const chain = (0, chain_1.readChain)(projectRoot, version);
        for (const c of supersededCandidatesForChain(chain)) {
            const title = computeHumanNotionTitle(c.kind, c.version, identity.project_name);
            const res = await (0, notionService_1.deleteNotionPageByTitle)(projectRoot, title);
            results.push({ artifactType: c.artifactType, version: c.version, deleted: res.deleted, error: res.error });
        }
    }
    return results;
}
//# sourceMappingURL=humanizePush.js.map