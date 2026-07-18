"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverArtifacts = discoverArtifacts;
exports.buildReconstructedChains = buildReconstructedChains;
exports.reconstructAllChains = reconstructAllChains;
exports.findSigmaProjectRoot = findSigmaProjectRoot;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const chain_1 = require("./chain");
const PATTERNS = {
    intent: { dir: 'design', regex: /^DIR-INTENT-(v\d+)\.md$/, docType: 'DIR_INTENT' },
    roadmap: { dir: 'build', regex: /^ROADMAP-(v\d+)\.md$/, docType: 'ROADMAP' },
    plan: { dir: 'build', regex: /^FMN-PLAN-(v\d+\.\d+)\.md$/, docType: 'FMN_PLAN' },
    exec: { dir: 'build', regex: /^DEV-EXEC-(v\d+\.\d+)\.md$/, docType: 'DEV_EXEC' },
    close: { dir: 'close', regex: /^DIR-CLOSE-(v\d+)\.md$/, docType: 'DIR_CLOSE' },
};
function readDocType(absPath) {
    const head = fs_extra_1.default.readFileSync(absPath, 'utf8').slice(0, 200);
    const match = head.match(/<!--\s*SIGMA:DOC\s+type=(\S+)/);
    return match ? match[1] : null;
}
function discoverArtifacts(projectRoot) {
    const found = { intent: [], roadmap: [], plan: [], exec: [], close: [], skipped: [] };
    for (const domain of Object.keys(PATTERNS)) {
        const { dir, regex, docType } = PATTERNS[domain];
        const absDir = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, dir);
        if (!fs_extra_1.default.existsSync(absDir))
            continue;
        for (const filename of fs_extra_1.default.readdirSync(absDir)) {
            const match = filename.match(regex);
            if (!match)
                continue;
            const relFile = path_1.default.join(config_1.PROJECT_SIGMA_DIR, dir, filename);
            const absFile = path_1.default.join(absDir, filename);
            const actualType = readDocType(absFile);
            if (actualType !== docType) {
                found.skipped.push(`${relFile} (expected SIGMA:DOC type=${docType}, found "${actualType ?? 'none'}")`);
                continue;
            }
            found[domain].push({ version: match[1], file: relFile });
        }
    }
    return found;
}
function sortByMajorMinor(entries) {
    return [...entries].sort((a, b) => {
        const majorDiff = (0, chain_1.parseMajorVersion)(a.version) - (0, chain_1.parseMajorVersion)(b.version);
        if (majorDiff !== 0)
            return majorDiff;
        return (0, chain_1.parseMinorVersion)(a.version) - (0, chain_1.parseMinorVersion)(b.version);
    });
}
function groupByMajor(entries) {
    const groups = new Map();
    for (const entry of sortByMajorMinor(entries)) {
        const major = (0, chain_1.parseMajorVersion)(entry.version);
        const list = groups.get(major) ?? [];
        list.push(entry);
        groups.set(major, list);
    }
    return groups;
}
let markerSeq = 0;
function makeMarker(domain, gate, reason, chain, now) {
    markerSeq += 1;
    return {
        id: `reconstruct:${domain}:${markerSeq}`,
        domain,
        status: 'INVALID',
        reason,
        gate,
        chain,
        first_detected_at: now,
        last_detected_at: now,
    };
}
// PLAN-EVAL-06 §6 — Sigma/design/intent-history.md is the only place `title`/`focus`
// persist outside progress-v<N>.json (DIR-INTENT templates never carry them). If it
// survived whatever wiped/corrupted the chain file, read it back instead of losing
// the data. Deliberately a plain pipe-split, not a markdown table parser — this is
// why `sigma intent new --title/--focus` rejects literal "|" and newlines (see
// intent.ts): keeping the row format this simple is what makes lossless parse-back
// cheap. Keep in sync with generateIntentHistoryContent() in utils/intentHistory.ts
// if the column shape ever changes — deliberately not shared code, so engine/ does
// not depend on utils/ (see PLAN-EVAL-06 §6.1).
function readIntentHistoryMetadata(projectRoot) {
    const filePath = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, 'design', 'intent-history.md');
    const result = new Map();
    if (!fs_extra_1.default.existsSync(filePath))
        return result;
    for (const line of fs_extra_1.default.readFileSync(filePath, 'utf8').split('\n')) {
        const cells = line.split('|').map(c => c.trim());
        if (cells.length < 6)
            continue; // not a `| vN | Title | Focus | Status | Reason |` row
        const [, version, title, focus] = cells;
        if (!/^v\d+$/.test(version))
            continue; // skips header row + the `:---` separator row
        result.set(version, {
            title: title && title !== 'TBD' ? title : undefined,
            focus: focus && focus !== 'TBD' ? focus : undefined,
        });
    }
    return result;
}
function buildReconstructedChains(found, recoveredMetadata = new Map()) {
    const now = new Date().toISOString();
    markerSeq = 0;
    const intentsByMajor = new Map();
    for (const entry of found.intent)
        intentsByMajor.set((0, chain_1.parseMajorVersion)(entry.version), entry);
    const roadmapsByMajor = new Map();
    for (const entry of found.roadmap)
        roadmapsByMajor.set((0, chain_1.parseMajorVersion)(entry.version), entry);
    const closesByMajor = new Map();
    for (const entry of found.close)
        closesByMajor.set((0, chain_1.parseMajorVersion)(entry.version), entry);
    // Plan/exec major = intent major − 1 (invariant confirmed never to
    // collide across chains — DISCUSSION "Konsolidasi Lanjutan" bagian 7).
    const planGroups = groupByMajor(found.plan);
    const execGroups = groupByMajor(found.exec);
    const allMajors = new Set();
    for (const m of intentsByMajor.keys())
        allMajors.add(m);
    for (const m of roadmapsByMajor.keys())
        allMajors.add(m);
    for (const m of closesByMajor.keys())
        allMajors.add(m);
    for (const planMajor of planGroups.keys())
        allMajors.add(planMajor + 1);
    for (const execMajor of execGroups.keys())
        allMajors.add(execMajor + 1);
    const chains = new Map();
    const unresolved = [];
    for (const major of [...allMajors].sort((a, b) => a - b)) {
        const intentEntry = intentsByMajor.get(major);
        const planMajor = major - 1;
        const plans = planGroups.get(planMajor) ?? [];
        const execs = execGroups.get(planMajor) ?? [];
        const roadmapEntry = roadmapsByMajor.get(major);
        const closeEntry = closesByMajor.get(major);
        if (!intentEntry) {
            const artifacts = [];
            if (roadmapEntry)
                artifacts.push(roadmapEntry.file);
            if (closeEntry)
                artifacts.push(closeEntry.file);
            for (const p of plans)
                artifacts.push(p.file);
            for (const e of execs)
                artifacts.push(e.file);
            unresolved.push({ major, artifacts });
            continue;
        }
        const chainVersion = `v${major}`;
        const markers = [];
        const recovered = recoveredMetadata.get(chainVersion) ?? {};
        const chain = (0, chain_1.createInitialChain)(chainVersion, intentEntry.file, recovered.title, recovered.focus);
        chain.created_at = now;
        chain.updated_at = now;
        // ── INTENT ──────────────────────────────────────────────────────────────
        const hasDownstreamEvidence = plans.length > 0 || !!roadmapEntry;
        if (hasDownstreamEvidence) {
            chain.intent.state = 'LOCKED';
            chain.intent.locked_at = now;
        }
        else {
            markers.push(makeMarker('intent', 'gate_1_open', `DIR-INTENT ${chainVersion} found on disk but no downstream FMN-PLAN or ROADMAP confirms it was ever LOCKED. Re-run \`sigma intent lock\` if it should be, or leave as DRAFT.`, { intent_version: chainVersion, plan_version: null, exec_version: null }, now));
        }
        // ── ROADMAP ─────────────────────────────────────────────────────────────
        if (roadmapEntry) {
            const roadmap = {
                version: chainVersion, state: closeEntry ? 'LOCKED' : 'DRAFT',
                file: roadmapEntry.file, created_at: now, updated_at: now,
            };
            if (closeEntry)
                roadmap.locked_at = now;
            chain.roadmap = roadmap;
        }
        // ── PLAN + EXEC ─────────────────────────────────────────────────────────
        if (plans.length === 1 && execs.length <= 1) {
            const plan = plans[0];
            const planLocked = execs.length === 1;
            const planEntry = {
                version: plan.version, file: plan.file, created_at: now, updated_at: now,
                state: planLocked ? 'LOCKED' : 'DRAFT',
                intent_version_ref: chainVersion,
            };
            if (planLocked)
                planEntry.locked_at = now;
            if (!planLocked) {
                markers.push(makeMarker('plan', 'gate_2_open', `FMN-PLAN ${plan.version} found on disk but no downstream DEV-EXEC confirms it was ever LOCKED. Re-run \`sigma plan lock\` if it should be, or leave as DRAFT.`, { intent_version: chainVersion, plan_version: plan.version, exec_version: null }, now));
            }
            chain.plan.versions.push(planEntry);
            if (execs.length === 1) {
                const exec = execs[0];
                chain.exec.versions.push({
                    version: exec.version, file: exec.file, created_at: now, updated_at: now,
                    state: 'LOCKED', locked_at: now, plan_version_ref: plan.version,
                });
            }
        }
        else if (plans.length > 0 || execs.length > 0) {
            // Ambiguous group: multiple PLAN drafts and/or multiple EXEC versions
            // under the same major. Filenames alone cannot prove which PLAN a
            // given EXEC targets, so nothing here is guessed — everything is left
            // DRAFT and flagged for Director review.
            for (const plan of plans) {
                chain.plan.versions.push({
                    version: plan.version, file: plan.file, created_at: now, updated_at: now,
                    state: 'DRAFT', intent_version_ref: chainVersion,
                });
            }
            for (const exec of execs) {
                chain.exec.versions.push({
                    version: exec.version, file: exec.file, created_at: now, updated_at: now, state: 'DRAFT',
                });
            }
            markers.push(makeMarker('plan', 'gate_2_open', `Multiple FMN-PLAN/DEV-EXEC versions found under major v${planMajor} (${plans.map(p => p.version).join(', ') || 'none'} / ${execs.map(e => e.version).join(', ') || 'none'}). Automatic reconstruct cannot safely pair them — verify manually and use \`sigma plan lock\` / \`sigma exec lock\` / \`sigma plan supersede\` as needed.`, { intent_version: chainVersion, plan_version: null, exec_version: null }, now));
        }
        if (chain.plan.versions.length > 0) {
            const last = sortByMajorMinor(chain.plan.versions).pop();
            chain.plan.active_version = last.version;
            chain.plan.active_state = last.state;
        }
        if (chain.exec.versions.length > 0) {
            const last = sortByMajorMinor(chain.exec.versions).pop();
            chain.exec.active_version = last.version;
            chain.exec.active_state = last.state;
        }
        // ── CLOSE ───────────────────────────────────────────────────────────────
        if (closeEntry) {
            const close = {
                version: chainVersion, state: 'DRAFT', file: closeEntry.file, created_at: now, updated_at: now,
            };
            chain.close = close;
            // Closing is a terminal step with no further downstream artifact — its
            // LOCKED state can never be proven from disk alone. Default to DRAFT
            // (project stays open) rather than risk a false CLOSED claim.
            markers.push(makeMarker('close', undefined, `DIR-CLOSE ${chainVersion} found on disk but closure cannot be confirmed as LOCKED from artifact files alone. Re-run \`sigma close lock\` if this project should be CLOSED.`, { intent_version: null, plan_version: null, exec_version: null }, now));
        }
        // ── Lifecycle ─────────────────────────────────────────────────────────────
        const hasAnyBuildArtifact = chain.roadmap !== null || chain.plan.versions.length > 0 || chain.exec.versions.length > 0 || chain.close !== null;
        chain.lifecycle_state = hasAnyBuildArtifact || chain.intent.state === 'LOCKED' ? 'BUILD' : 'DESIGN';
        // Gates + structural consistency markers are computed by the exact same
        // function `sigma doctor` (default mode) already uses — avoids
        // duplicating gate logic in two places that would need to stay in sync.
        // It fully replaces runtime_invalid.markers with its own structural
        // findings, so the "unprovable-lock" markers collected above are merged
        // back in afterward rather than overwritten.
        chain.runtime_invalid = { markers: [], last_doctor_run_at: null };
        (0, chain_1.runDoctorReconciliation)(chain, []);
        chain.runtime_invalid.markers = [...markers, ...chain.runtime_invalid.markers];
        chains.set(major, { chainVersion, data: chain });
    }
    return { chains, unresolved, skipped: [...found.skipped] };
}
function reconstructAllChains(projectRoot) {
    const found = discoverArtifacts(projectRoot);
    const recoveredMetadata = readIntentHistoryMetadata(projectRoot);
    return buildReconstructedChains(found, recoveredMetadata);
}
// `findProjectRoot()` (utils/fs.ts) anchors on Sigma/activate_status.json
// existing — which is exactly what may be missing in the scenario
// --reconstruct exists for. This anchors on the Sigma/ directory itself
// instead.
function findSigmaProjectRoot(startDir = process.cwd()) {
    let current = path_1.default.resolve(startDir);
    while (true) {
        if (fs_extra_1.default.existsSync(path_1.default.join(current, config_1.PROJECT_SIGMA_DIR)))
            return current;
        const parent = path_1.default.dirname(current);
        if (parent === current) {
            throw new Error('Not inside a Sigma project. No Sigma/ directory found in this directory or any parent.');
        }
        current = parent;
    }
}
//# sourceMappingURL=reconstruct.js.map