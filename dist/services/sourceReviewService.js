"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewChain = reviewChain;
exports.captureArtifact = captureArtifact;
exports.targetOnly = targetOnly;
exports.sectionsOf = sectionsOf;
exports.intentItems = intentItems;
exports.matchReferences = matchReferences;
exports.reviewPlanSources = reviewPlanSources;
// F08a: quoted sources and administrative facts, never automatic semantic approval.
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const numbering_1 = require("../engine/numbering");
const artifactPath_1 = require("../mcp/artifactPath");
const controlStore_1 = require("../engine/controlStore");
const revisions_1 = require("../engine/revisions");
const git = __importStar(require("../engine/gitRepo"));
const docHash_1 = require("../engine/docHash");
const docCheck_1 = require("../utils/docCheck");
const f08Store_1 = require("./f08Store");
function reviewChain(root, explicit) {
    const version = explicit ?? (0, chain_1.readActiveChain)(root).chainVersion;
    if (!/^v\d+$/.test(version))
        throw new Error('Invalid chain version.');
    (0, controlStore_1.assertNoTransactionSymlink)(root, (0, chain_1.chainFilePath)(root, version));
    const data = (0, chain_1.readChain)(root, version);
    if (data.chain_version !== version || data.intent.version !== version)
        throw new Error('Chain identity mismatch.');
    return { chainVersion: version, data };
}
function captureArtifact(root, chainVersion, type, version) {
    const { data: chain } = reviewChain(root, chainVersion);
    const matches = (0, artifactPath_1.candidatesFor)(chain, type).filter(entry => entry.version === version);
    if (matches.length !== 1)
        throw new Error('Artifact must be uniquely registered: ' + type + ' ' + version);
    if (type === 'plan' && chain.plan.versions.find(p => p.version === version)?.intent_version_ref !== chain.intent.version)
        throw new Error('PLAN references a different INTENT.');
    if (type === 'exec') {
        const exec = chain.exec.versions.find(e => e.version === version);
        if (!chain.plan.versions.some(p => p.version === exec.plan_version_ref))
            throw new Error('EXEC references an unregistered PLAN.');
    }
    const file = (0, artifactPath_1.readCanonicalArtifactFile)(root, type, version, matches[0].file);
    if (!file.present || file.content === null || !file.sha256)
        throw new Error('Registered artifact unavailable: ' + file.path);
    const metadata = (0, numbering_1.parseChainMetadata)(file.content);
    if (metadata && (metadata.intent !== chainVersion || metadata.versioning_scheme !== (0, numbering_1.resolveVersioningScheme)(chain) ||
        (type === 'exec' ? metadata.plan !== version : metadata.plan !== undefined)))
        throw new Error('Artifact chain metadata mismatch.');
    return { chain: chainVersion, type, version, path: file.path, sha256: file.sha256, content: file.content };
}
function targetOnly(file) {
    const { content: _content, ...target } = file;
    return target;
}
function sectionsOf(text, type) {
    const clean = text.replace(/\r\n/g, '\n');
    const re = new RegExp('<!--\\s*SIGMA:' + type + ':SECTION:([A-Z0-9_]+)\\s*-->', 'g');
    const markers = [...clean.matchAll(re)];
    return markers.map((m, i) => ({ id: m[1], marker: m[0], body: clean.slice(m.index + m[0].length, markers[i + 1]?.index ?? clean.length) }));
}
function visible(text) {
    return text.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))
        .replace(/^(\x60{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, m => m.replace(/[^\n]/g, ' '));
}
function intentItems(text) {
    const result = [];
    for (const section of sectionsOf(text, 'DIR_INTENT')) {
        const content = visible(section.body), lines = content.split('\n');
        const headings = [...content.matchAll(/^(#{2,6})\s+(?:\d+(?:\.\d+)*[.)]?\s+)?(REQ-\d+)\b[^\n]*/gm)];
        for (const h of headings) {
            const remainder = content.slice(h.index + h[0].length);
            const next = new RegExp('^#{1,' + h[1].length + '}\\s+', 'm').exec(remainder);
            result.push({ id: h[2], section: section.id, text: content.slice(h.index, next ? h.index + h[0].length + next.index : content.length).trim() });
        }
        for (const line of lines) {
            const match = line.match(/^\|\s*(SC|OS|CON|RR|REQ)-(\d+)\s*\|/);
            if (match)
                result.push({ id: match[1] + '-' + match[2], section: section.id, text: line.trim() });
        }
    }
    return result;
}
function sourceAlignment(plan) {
    const parts = sectionsOf(plan, 'FMN_PLAN').filter(s => s.id === 'SOURCE_ALIGNMENT');
    if (parts.length !== 1)
        throw new Error('Source Alignment missing or ambiguous.');
    return visible(parts[0].body);
}
function matchReferences(plan, intent) {
    const alignment = sourceAlignment(plan), definitions = intentItems(intent);
    const references = [];
    for (const line of alignment.split('\n')) {
        if (!line.trim().startsWith('|'))
            continue;
        const cells = line.trim().split('|').slice(1, -1).map(s => s.trim());
        const ids = [...new Set(cells.slice(1).join('|').match(/\b(?:REQ|SC|OS|CON|RR)-\d+\b/g) ?? [])];
        for (const id of ids) {
            const matches = definitions.filter(item => item.id === id);
            references.push({ id, role: cells[0], status: matches.length === 1 ? 'FOUND' : matches.length ? 'AMBIGUOUS' : 'MISSING', matches });
        }
    }
    const versions = [...new Set([...alignment.matchAll(/\b(?:DIR-)?INTENT[-\s]+(v\d+)\b/gi)].map(m => m[1]))];
    return { declared_intent_versions: versions, references };
}
function certifiedSource(root, chain, expected, current) {
    if (!expected)
        return { status: 'UNKNOWN', sha256: null, content: null, origin: null };
    const hash = expected.startsWith('sha256:') ? expected : 'sha256:' + expected;
    if (hash === current.sha256 || (0, docHash_1.matchesCertified)(Buffer.from(current.content, 'utf8'), expected))
        return { status: 'AVAILABLE', sha256: hash, content: current.content, origin: 'current-content-matches-reference' };
    const top = git.repoToplevel(root);
    if (top.ok) {
        const rel = git.repoRelativePath(top.root, path_1.default.join(root, current.path));
        const commits = [chain.intent.git_baseline?.commit, ...(chain.intent.amendments ?? []).flatMap(a => [a.result_commit, a.baseline_commit])];
        for (const commit of [...new Set(commits.filter((v) => !!v))]) {
            const blob = git.blobAt(top.root, commit, rel);
            if (blob && (0, docHash_1.matchesCertified)(blob, hash))
                return { status: 'AVAILABLE', sha256: hash, content: blob.toString('utf8'), origin: 'git:' + commit };
        }
    }
    return { status: 'UNKNOWN', sha256: hash, content: null, origin: null };
}
function reviewPlanSources(root, explicitVersion, explicitChain) {
    const { chainVersion, data: chain } = reviewChain(root, explicitChain);
    let version = explicitVersion;
    if (!version) {
        const open = chain.plan.versions.filter(p => p.state === 'DRAFT' || p.state === 'APPROVED');
        const resolution = (0, chain_1.resolveTargetVersion)(open.map(p => ({ ...p, state: 'DRAFT' })), undefined);
        if (resolution.kind === 'ambiguous')
            throw new Error('Multiple open PLANs; specify version.');
        version = resolution.kind === 'resolved' ? resolution.version : chain.plan.active_version ?? undefined;
    }
    if (!version)
        throw new Error('No PLAN available for source review.');
    const plan = captureArtifact(root, chainVersion, 'plan', version);
    const entry = chain.plan.versions.find(p => p.version === version);
    const structure = (0, docCheck_1.validateSigmaDocFile)(path_1.default.join(root, plan.path), 'plan');
    const findings = [];
    let current = null;
    try {
        current = captureArtifact(root, chainVersion, 'intent', chain.intent.version);
    }
    catch (error) {
        findings.push(error.message.split(root).join('.'));
    }
    let expected = entry.intent_doc_sha256_ref;
    if (entry.revision_ledger) {
        try {
            const ledger = (0, revisions_1.readRevisionLedger)(root, chain, version);
            expected = ledger.records[ledger.records.length - 1].intent_doc_sha256_ref;
        }
        catch (error) {
            findings.push('PLAN ledger: ' + error.message.split(root).join('.'));
        }
    }
    const baseline = current ? certifiedSource(root, chain, expected, current) : { status: 'UNKNOWN', sha256: expected ?? null, content: null, origin: null };
    let currentRefs = null;
    let baselineRefs = null;
    try {
        if (current)
            currentRefs = matchReferences(plan.content, current.content);
        if (baseline.content)
            baselineRefs = matchReferences(plan.content, baseline.content);
    }
    catch (error) {
        findings.push(error.message.split(root).join('.'));
    }
    if (currentRefs && (currentRefs.declared_intent_versions.length !== 1 || currentRefs.declared_intent_versions[0] !== chain.intent.version))
        findings.push('Declared INTENT version missing, ambiguous or different from owning chain.');
    let roadmap = null;
    if (chain.roadmap) {
        try {
            roadmap = captureArtifact(root, chainVersion, 'roadmap', chain.roadmap.version);
        }
        catch (error) {
            findings.push('ROADMAP: ' + error.message.split(root).join('.'));
        }
    }
    const namedSections = current ? sectionsOf(current.content, 'DIR_INTENT').filter(s => ['QUALITY_STANDARDS', 'QUALITY_BAR'].includes(s.id)) : [];
    const assessment = (0, f08Store_1.readF08Store)(root).assessments.filter(a => a.target.chain === chainVersion && a.target.version === version && a.target.type === 'plan').slice(-1)[0];
    const assessmentFresh = assessment && assessment.target.sha256 === plan.sha256 && assessment.source_sha256 === current?.sha256;
    const certified = chain.intent.certified_doc_sha256;
    return {
        project_id: (0, chain_1.readProjectIdentity)(root).project_id, chain: chainVersion, plan: targetOnly(plan),
        structure: { ok: structure.ok, schema: structure.schema, errors: structure.errors, warnings: structure.warnings, requirements: structure.requirements },
        certification: { plan_state: entry.state, plan_revision: entry.revision ?? null, needs_intent_review: entry.needs_intent_review ?? false,
            pending_notice: entry.pending_notice ?? false, reference_is_plan_approval: !!entry.revision_ledger && !findings.some(f => f.startsWith('PLAN ledger: ')), current_intent_sha256: current?.sha256 ?? null, certified_intent_sha256: certified ?? null,
            current_matches_certified: certified && current ? (0, docHash_1.matchesCertified)(Buffer.from(current.content, 'utf8'), certified) : null,
            plan_intent_revision_ref: entry.intent_revision_ref ?? null, baseline },
        current_source: current, current_references: currentRefs, referenced_references: baselineRefs,
        named_sources: { quality_standards: namedSections, planned_stage: roadmap ? sectionsOf(roadmap.content, 'ROADMAP').filter(s => s.id === 'PLANNED_STAGE') : [],
            roadmap: roadmap ? targetOnly(roadmap) : null, note: 'Named sections are source material for human review, not a semantic match verdict.' },
        semantic_readiness: assessment ? { status: assessmentFresh ? assessment.status : 'UNKNOWN', stale: !assessmentFresh, assessment } : { status: 'UNKNOWN', stale: false, assessment: null },
        findings, grants_approval: false,
    };
}
//# sourceMappingURL=sourceReviewService.js.map