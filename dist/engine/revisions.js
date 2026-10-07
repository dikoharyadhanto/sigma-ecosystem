"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.needsEarlyApproval = exports.planContractHash = exports.normalizeDocument = exports.sha256 = void 0;
exports.splitPlanContract = splitPlanContract;
exports.assertAuditAppendOnly = assertAuditAppendOnly;
exports.boundedPath = boundedPath;
exports.artifactFile = artifactFile;
exports.revisionPaths = revisionPaths;
exports.currentIntent = currentIntent;
exports.readRevisionLedger = readRevisionLedger;
exports.assertPlanCertified = assertPlanCertified;
exports.validateDeclaration = validateDeclaration;
exports.verifyNotice = verifyNotice;
exports.assertAllNotices = assertAllNotices;
exports.recordNotice = recordNotice;
exports.roadmapTransactionFiles = roadmapTransactionFiles;
exports.renderGovernanceRoadmap = renderGovernanceRoadmap;
exports.certifyPlanBaseline = certifyPlanBaseline;
exports.revisionTransactionFiles = revisionTransactionFiles;
exports.preparePlanRevision = preparePlanRevision;
exports.checkPlanRevision = checkPlanRevision;
exports.contractDiff = contractDiff;
exports.prepareRevisionTicket = prepareRevisionTicket;
exports.validateDirectorTicket = validateDirectorTicket;
exports.commitPlanRevision = commitPlanRevision;
exports.acknowledgePlan = acknowledgePlan;
exports.approveLedgerWithExec = approveLedgerWithExec;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const numbering_1 = require("./numbering");
const chain_1 = require("./chain");
const lifecycle_1 = require("./lifecycle");
const controlStore_1 = require("./controlStore");
const contract_1 = require("../mcp/contract");
const docCheck_1 = require("../utils/docCheck");
const roadmap_1 = require("../utils/roadmap");
const sha256 = (bytes) => crypto_1.default.createHash('sha256').update(bytes).digest('hex');
exports.sha256 = sha256;
const normalizeDocument = (text) => text.replace(/\r\n/g, '\n');
exports.normalizeDocument = normalizeDocument;
const AUD = '<!-- SIGMA:FMN_PLAN:SECTION:AUD_NOTES -->';
function splitPlanContract(text) {
    const normalized = (0, exports.normalizeDocument)(text);
    if (normalized.split(AUD).length !== 2)
        throw new Error('PLAN AUD_NOTES marker missing or duplicated.');
    const index = normalized.indexOf(AUD);
    const remainder = normalized.slice(index);
    if (/<!--\s*SIGMA:FMN_PLAN:SECTION:/.test(remainder.slice(AUD.length)))
        throw new Error('AUD_NOTES must be the final PLAN section.');
    if (!/^<!-- SIGMA:FMN_PLAN:SECTION:AUD_NOTES -->\n## (?:\d+\.\s*)?AUD Notes\b/.test(remainder))
        throw new Error('Malformed AUD_NOTES section.');
    return { contract: normalized.slice(0, index), audit: remainder };
}
const planContractHash = (text) => (0, exports.sha256)(splitPlanContract(text).contract);
exports.planContractHash = planContractHash;
function assertAuditAppendOnly(before, current) {
    if (!splitPlanContract(current).audit.startsWith(splitPlanContract(before).audit))
        throw new Error('AUD Notes edit/delete is not append-only.');
}
function boundedPath(root, relative) {
    if (typeof relative !== 'string' || relative.includes('\\') || !relative.startsWith('Sigma/'))
        throw new Error('Invalid governance path.');
    const absolute = path_1.default.resolve(root, relative);
    (0, controlStore_1.assertNoTransactionSymlink)(root, absolute);
    return absolute;
}
function artifactFile(root, chain, type, version) {
    const entry = type === 'intent' ? chain.intent : chain[type].versions.find(e => e.version === version);
    const prefixes = { intent: 'DIR-INTENT', plan: 'FMN-PLAN', exec: 'DEV-EXEC' };
    const directories = { intent: ['charter', 'design'], plan: ['contract', 'design'], exec: ['evidence', 'build'] };
    const rel = entry?.file?.replace(/\\/g, '/');
    if (!rel || !directories[type].some(dir => rel === 'Sigma/' + dir + '/' + prefixes[type] + '-' + version + '.md'))
        throw new Error('Unregistered/cross-identity artifact path: ' + type + ' ' + version);
    const file = boundedPath(root, rel);
    if (fs_extra_1.default.existsSync(file)) {
        const metadata = (0, numbering_1.readChainMetadata)(file, root);
        if (metadata && (metadata.intent !== chain.intent.version || metadata.versioning_scheme !== (0, numbering_1.resolveVersioningScheme)(chain) || (type === 'exec' ? metadata.plan !== version : metadata.plan !== undefined)))
            throw new Error('SIGMA:CHAIN metadata conflicts with owning artifact identity.');
    }
    return file;
}
function revisionPaths(version, revision = 1) {
    if (!/^v\d+\.[1-9]\d*$/.test(version) || !Number.isSafeInteger(revision) || revision < 1)
        throw new Error('Invalid PLAN revision identity.');
    const base = 'Sigma/revisions/PLAN-' + version;
    return { ledger: base + '/ledger.json', snapshot: base + '/rev-' + String(revision).padStart(4, '0') + '.md',
        candidate: 'Sigma/revisions/staging/PLAN-' + version + '.md', staging: 'Sigma/revisions/staging/PLAN-' + version + '.json' };
}
function planEntry(chain, version) {
    const entries = chain.plan.versions.filter(p => p.version === version);
    if (entries.length !== 1 || entries[0].intent_version_ref !== chain.intent.version)
        throw new Error('Invalid PLAN identity: ' + version);
    return entries[0];
}
function currentIntent(root, chain) {
    if (chain.intent.state !== 'RATIFIED' || !chain.intent.certified_doc_sha256)
        throw new Error('INTENT baseline unknown or not RATIFIED; Director certification required.');
    const hash = (0, exports.sha256)(fs_extra_1.default.readFileSync(artifactFile(root, chain, 'intent', chain.intent.version)));
    if (hash !== chain.intent.certified_doc_sha256)
        throw new Error('UNCERTIFIED_EDIT: INTENT source changed.');
    // Imported current baseline is not a claim about historical amendment count.
    const revision = chain.intent.revision ?? 1;
    if (!Number.isSafeInteger(revision) || revision < 1)
        throw new Error('Invalid certified INTENT revision; Director recovery required.');
    return { revision, hash };
}
function readRevisionLedger(root, chain, version) {
    const plan = planEntry(chain, version);
    const paths = revisionPaths(version);
    if (plan.revision_ledger !== paths.ledger || !plan.revision_ledger_sha256 || !plan.revision)
        throw new Error('PLAN revision baseline unknown; explicit baseline approval required.');
    const bytes = fs_extra_1.default.readFileSync(boundedPath(root, paths.ledger));
    if ((0, exports.sha256)(bytes) !== plan.revision_ledger_sha256)
        throw new Error('PLAN ledger hash mismatch.');
    const ledger = JSON.parse(bytes.toString('utf8'));
    if (ledger.format !== 1 || ledger.intent !== chain.intent.version || ledger.plan !== version || !Array.isArray(ledger.records) || ledger.records.length !== plan.revision)
        throw new Error('Invalid revision ledger identity/cardinality.');
    for (const [index, record] of ledger.records.entries()) {
        const revision = index + 1;
        if (record.revision !== revision || record.revision_id !== version + ':rev-' + revision || record.snapshot !== revisionPaths(version, revision).snapshot || !Number.isSafeInteger(record.intent_revision_ref) || record.intent_revision_ref < 1 || !/^[a-f0-9]{64}$/.test(record.intent_doc_sha256_ref) || !['initial_approval', 'imported_baseline', 'revision'].includes(record.provenance) || Number.isNaN(Date.parse(record.created_at)))
            throw new Error('Invalid revision record.');
        const snapshot = fs_extra_1.default.readFileSync(boundedPath(root, record.snapshot));
        if ((0, exports.sha256)(snapshot) !== record.snapshot_sha256 || (0, exports.planContractHash)(snapshot.toString('utf8')) !== record.contract_sha256)
            throw new Error('Snapshot hash mismatch: ' + record.snapshot);
        if (revision > 1) {
            validateDeclaration(record.declaration);
            if ((0, exports.needsEarlyApproval)(record.declaration))
                verifyAuthorizationReceipt(record);
        }
        if (record.notice)
            verifyNotice(root, ledger, record);
    }
    const latest = ledger.records[ledger.records.length - 1];
    if (latest.contract_sha256 !== plan.contract_sha256 || latest.intent_revision_ref !== plan.intent_revision_ref || latest.intent_doc_sha256_ref !== plan.intent_doc_sha256_ref)
        throw new Error('PLAN tracker/ledger revision mismatch.');
    return ledger;
}
function persistLedger(root, chain, ledger) {
    const plan = planEntry(chain, ledger.plan);
    const relative = revisionPaths(ledger.plan).ledger;
    const content = JSON.stringify(ledger, null, 2) + '\n';
    (0, controlStore_1.journaledWrite)(root, boundedPath(root, relative), content);
    plan.revision_ledger = relative;
    plan.revision_ledger_sha256 = (0, exports.sha256)(content);
}
function assertPlanCertified(root, chain, version, requireIntent = true) {
    if ((0, lifecycle_1.resolveLifecycleModel)(chain) !== 'paired_approval')
        throw new Error('Paired lifecycle required.');
    const plan = planEntry(chain, version);
    if (!plan.approved_at || !plan.approval_receipt || plan.approval_receipt.approved_at !== plan.approved_at || !['cli', 'mcp-control'].includes(plan.approval_receipt.channel) || Number.isNaN(Date.parse(plan.approved_at)))
        throw new Error('PLAN baseline approval receipt missing or malformed.');
    const ledger = readRevisionLedger(root, chain, version);
    const text = fs_extra_1.default.readFileSync(artifactFile(root, chain, 'plan', version), 'utf8');
    const latest = ledger.records[ledger.records.length - 1];
    if ((0, exports.planContractHash)(text) !== latest.contract_sha256)
        throw new Error('UNCERTIFIED_EDIT: PLAN contract changed outside revise commit.');
    assertAuditAppendOnly(fs_extra_1.default.readFileSync(boundedPath(root, latest.snapshot), 'utf8'), text);
    if (requireIntent) {
        const intent = currentIntent(root, chain);
        if (plan.needs_intent_review || plan.intent_revision_ref !== intent.revision || plan.intent_doc_sha256_ref !== intent.hash)
            throw new Error('STALE_INTENT: PLAN must review the current INTENT through plan revise.');
    }
    return ledger;
}
function validateDeclaration(value) {
    const d = value;
    if (!d || !['pre-build', 'post-build', 'director'].includes(d.checkpoint) || !['FMN', 'DEV', 'Director'].includes(d.requested_by) || typeof d.loosening !== 'boolean' || typeof d.reason !== 'string' || !d.reason.trim() || typeof d.delta !== 'string' || !d.delta.trim())
        throw new Error('Revision requires checkpoint, requester, reason, explicit boolean loosening and delta. Classification is a human declaration.');
}
const needsEarlyApproval = (d) => d.loosening || d.checkpoint === 'director';
exports.needsEarlyApproval = needsEarlyApproval;
function verifyAuthorizationReceipt(record) {
    const auth = record.authorization;
    if (!auth || auth.ticket.bound_role !== 'FMN' || auth.ticket.target?.artifact !== 'plan' || auth.ticket.target.version !== record.revision_id.split(':')[0] || auth.approval.project_id !== auth.ticket.project_id || auth.approval.operation_id !== auth.ticket.operation_id || auth.approval.target_artifact !== 'plan' || auth.approval.target_version !== auth.ticket.target.version || auth.approval.expected_state_revision !== auth.ticket.expected_state_revision || auth.ticket.operation_id !== 'plan_revise' || auth.approval.decision !== 'approve' || auth.approval.operation_ticket_id !== auth.ticket.operation_ticket_id || auth.approval.arguments_hash !== auth.ticket.arguments_hash || auth.approval.target_sha256 !== record.snapshot_sha256 || auth.ticket.target?.sha256 !== record.snapshot_sha256 || !auth.approval.consumed_at || !auth.ticket.consumed_at || auth.approval.channel !== 'cli' || auth.approval.authentication_method !== 'local_cli')
        throw new Error('Missing/invalid early Director approval receipt.');
}
function verifyNotice(root, ledger, record) {
    const n = record.notice;
    if (!n || n.from !== 'FMN' || n.to !== 'DEV' || n.intent !== ledger.intent || n.plan !== ledger.plan || n.revision !== record.revision || n.contract_sha256 !== record.contract_sha256 || !n.message_id || !n.file.startsWith('Sigma/messages/DEV/' + ledger.plan + '/') || !/^[a-f0-9]{64}$/.test(n.payload_sha256) || Number.isNaN(Date.parse(n.created_at)))
        throw new Error('Missing or invalid CONTRACT_CHANGE notice for ' + record.revision_id);
    const noticeText = fs_extra_1.default.readFileSync(boundedPath(root, n.file), 'utf8');
    if ((0, exports.sha256)(noticeText) !== n.file_sha256 || !noticeText.includes('| Revision ID | ' + record.revision_id + ' |') || !noticeText.includes('| Contract SHA256 | ' + record.contract_sha256 + ' |') || (0, exports.sha256)(noticeText.slice(noticeText.indexOf('\n## Message\n\n') + 13).trimEnd()) !== n.payload_sha256)
        throw new Error('CONTRACT_CHANGE file missing/changed/mismatched: ' + n.message_id);
}
function assertAllNotices(root, ledger) {
    for (const record of ledger.records.slice(1))
        verifyNotice(root, ledger, record);
}
function recordNotice(root, version, revision, receipt) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(root);
    const ledger = assertPlanCertified(root, chain, version);
    if (planEntry(chain, version).state !== 'APPROVED' || !Number.isSafeInteger(revision) || revision < 2 || revision > planEntry(chain, version).revision)
        throw new Error('Notice must reference a registered APPROVED PLAN revision.');
    const record = ledger.records[revision - 1];
    if (revision <= 1 || record.notice)
        throw new Error('Notice revision missing or already notified; no notice reuse.');
    record.notice = receipt;
    verifyNotice(root, ledger, record);
    planEntry(chain, version).pending_notice = ledger.records.slice(1).some(r => !r.notice);
    persistLedger(root, chain, ledger);
    chain.gates.gate_2_open = (0, chain_1.hasCleanGate2Chain)(chain);
    (0, chain_1.writeChain)(root, chainVersion, chain);
}
function roadmapTransactionFiles(root, chain) { return chain.roadmap?.file ? [boundedPath(root, chain.roadmap.file.replace(/\\/g, '/'))] : []; }
function renderGovernanceRoadmap(root, chain) {
    if (!chain.roadmap?.file)
        return;
    const file = roadmapTransactionFiles(root, chain)[0];
    if (!fs_extra_1.default.existsSync(file) && (0, lifecycle_1.resolveLifecycleModel)(chain) === 'legacy_lock')
        return;
    const content = (0, roadmap_1.removeSectionIfPresent)((0, roadmap_1.replaceSection)(fs_extra_1.default.readFileSync(file, 'utf8'), 'stage-overview', (0, roadmap_1.generateStageOverview)(chain)), 'plan-breakdown');
    (0, controlStore_1.journaledWrite)(root, file, content);
}
function certifyPlanBaseline(root, chain, version, expectedSha, expectedIntentSha) {
    const plan = planEntry(chain, version);
    const intent = currentIntent(root, chain);
    const imported = plan.state === 'APPROVED' && !plan.revision;
    if (!(plan.state === 'DRAFT' || imported) || plan.revision || plan.revision_ledger)
        throw new Error('PLAN baseline approval requires DRAFT or explicit imported APPROVED baseline.');
    const file = artifactFile(root, chain, 'plan', version);
    (0, docCheck_1.ensureSigmaDocEligible)((0, docCheck_1.validateSigmaDocFile)(file, 'plan'), 'plan');
    const bytes = fs_extra_1.default.readFileSync(file);
    if (expectedSha && (0, exports.sha256)(bytes) !== expectedSha || expectedIntentSha && intent.hash !== expectedIntentSha)
        throw new Error('Approval source changed before baseline commit.');
    const contract = (0, exports.planContractHash)(bytes.toString('utf8'));
    const now = new Date().toISOString();
    if (!chain.intent.revision) {
        chain.intent.revision = intent.revision;
        chain.intent.revision_provenance = 'imported_current_certification';
    }
    const paths = revisionPaths(version);
    const ledger = { format: 1, intent: chain.intent.version, plan: version, records: [{ revision: 1, revision_id: version + ':rev-1', snapshot: paths.snapshot, snapshot_sha256: (0, exports.sha256)(bytes), contract_sha256: contract, intent_revision_ref: intent.revision, intent_doc_sha256_ref: intent.hash, created_at: now, provenance: imported ? 'imported_baseline' : 'initial_approval' }] };
    (0, controlStore_1.journaledWrite)(root, boundedPath(root, paths.snapshot), bytes, true);
    plan.revision = 1;
    plan.contract_sha256 = contract;
    plan.intent_revision_ref = intent.revision;
    plan.intent_doc_sha256_ref = intent.hash;
    plan.needs_intent_review = false;
    persistLedger(root, chain, ledger);
}
function revisionTransactionFiles(root, version) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(root);
    const plan = planEntry(chain, version);
    const paths = revisionPaths(version, (plan.revision ?? 0) + 1);
    return [(0, chain_1.chainFilePath)(root, chainVersion), artifactFile(root, chain, 'plan', version), boundedPath(root, paths.snapshot), boundedPath(root, paths.ledger), ...roadmapTransactionFiles(root, chain)];
}
function preparePlanRevision(root, version, declaration, replaceStaging = false) {
    validateDeclaration(declaration);
    const { data: chain } = (0, chain_1.readActiveChain)(root);
    const plan = planEntry(chain, version);
    if (plan.state !== 'APPROVED')
        throw new Error('Only APPROVED PLAN can be revised by FMN.');
    assertPlanCertified(root, chain, version, false);
    currentIntent(root, chain);
    const paths = revisionPaths(version);
    const stage = { format: 1, intent: chain.intent.version, plan: version, base_revision: plan.revision, base_contract_sha256: plan.contract_sha256, base_ledger_sha256: plan.revision_ledger_sha256, declaration };
    const stageFile = boundedPath(root, paths.staging);
    const previous = fs_extra_1.default.existsSync(stageFile) ? JSON.parse(fs_extra_1.default.readFileSync(stageFile, 'utf8')) : null;
    if (previous && previous.base_revision >= plan.revision && !replaceStaging)
        throw new Error('An open staging candidate already exists; finish or explicitly remove it before preparing another.');
    (0, controlStore_1.journaledWrite)(root, boundedPath(root, paths.candidate), fs_extra_1.default.readFileSync(artifactFile(root, chain, 'plan', version)), !previous);
    (0, controlStore_1.journaledWrite)(root, boundedPath(root, paths.staging), JSON.stringify(stage, null, 2) + '\n', !previous);
    return { candidate: paths.candidate, metadata: paths.staging };
}
function checkPlanRevision(root, version) {
    const { data: chain } = (0, chain_1.readActiveChain)(root);
    const plan = planEntry(chain, version);
    const paths = revisionPaths(version);
    if (plan.state !== 'APPROVED')
        throw new Error('Only APPROVED PLAN can be revised.');
    const ledger = assertPlanCertified(root, chain, version, false);
    const intent = currentIntent(root, chain);
    const stage = JSON.parse(fs_extra_1.default.readFileSync(boundedPath(root, paths.staging), 'utf8'));
    if (stage.format !== 1 || stage.intent !== chain.intent.version || stage.plan !== version || stage.base_revision !== plan.revision || stage.base_contract_sha256 !== plan.contract_sha256 || stage.base_ledger_sha256 !== plan.revision_ledger_sha256)
        throw new Error('Stale/mismatched staging baseline; prepare a new candidate.');
    validateDeclaration(stage.declaration);
    const candidate = fs_extra_1.default.readFileSync(boundedPath(root, paths.candidate));
    const text = candidate.toString('utf8');
    const metadata = (0, numbering_1.readChainMetadata)(boundedPath(root, paths.candidate), root);
    if (metadata && (metadata.intent !== chain.intent.version || metadata.versioning_scheme !== (0, numbering_1.resolveVersioningScheme)(chain) || metadata.plan !== undefined))
        throw new Error('Staged PLAN metadata conflicts with owning chain.');
    const old = fs_extra_1.default.readFileSync(boundedPath(root, ledger.records[ledger.records.length - 1].snapshot), 'utf8');
    assertAuditAppendOnly(old, text);
    assertAuditAppendOnly(fs_extra_1.default.readFileSync(artifactFile(root, chain, 'plan', version), 'utf8'), text);
    const contract = (0, exports.planContractHash)(text);
    if (contract === plan.contract_sha256 && intent.hash === plan.intent_doc_sha256_ref && intent.revision === plan.intent_revision_ref)
        throw new Error('No contract/source change to certify.');
    // Candidate must include its own substantive Contract Changes entry before freezing.
    const changes = text.split('<!-- SIGMA:FMN_PLAN:SECTION:CONTRACT_CHANGES -->');
    if (changes.length !== 2 || !changes[1].split(AUD)[0].includes(stage.declaration.reason) || !changes[1].split(AUD)[0].includes(stage.declaration.delta))
        throw new Error('Candidate Contract Changes must contain the declared reason and delta.');
    (0, docCheck_1.ensureSigmaDocEligible)((0, docCheck_1.validateSigmaDocFile)(boundedPath(root, paths.candidate), 'plan'), 'plan');
    const changeRows = changes[1].split(AUD)[0].split(/\r?\n/).filter(line => line.trim().startsWith('|')).map(line => line.split('|').slice(1, -1).map(c => c.trim()));
    const row = changeRows.find(c => c.length === 7 && c[2] === stage.declaration.delta && c[3] === stage.declaration.reason);
    if (!row || row[1] !== stage.declaration.checkpoint || row[4] !== stage.declaration.requested_by || row[5].toLowerCase() !== (stage.declaration.loosening ? 'yes' : 'no'))
        throw new Error('Candidate Contract Changes declaration mismatch (checkpoint/requester/loosening/delta).');
    const diff = contractDiff(old, text);
    const dependencies = (0, exports.sha256)(JSON.stringify({ chain, intent, ledger_hash: plan.revision_ledger_sha256, canonical: (0, exports.sha256)(fs_extra_1.default.readFileSync(artifactFile(root, chain, 'plan', version))), candidate: (0, exports.sha256)(candidate), stage }));
    return { version, next_revision: plan.revision + 1, candidate: paths.candidate, candidate_sha256: (0, exports.sha256)(candidate), contract_sha256: contract, intent, stage, diff, early_approval_required: (0, exports.needsEarlyApproval)(stage.declaration), dependencies_sha256: dependencies };
}
function contractDiff(before, after) {
    const a = splitPlanContract(before).contract.split('\n');
    const b = splitPlanContract(after).contract.split('\n');
    let first = 0;
    while (first < a.length && first < b.length && a[first] === b[first])
        first++;
    let tail = 0;
    while (tail < a.length - first && tail < b.length - first && a[a.length - 1 - tail] === b[b.length - 1 - tail])
        tail++;
    const removed = a.slice(first, a.length - tail);
    const added = b.slice(first, b.length - tail);
    return { from_line: first + 1, removed, added, ac_test_ids: [...new Set((removed.join('\n') + '\n' + added.join('\n')).match(/(?:AC|TEST|TC|U)-\d+/g) ?? [])], classification: 'human-declared; no semantic loosening inference' };
}
function prepareRevisionTicket(root, version, ticketId = (0, controlStore_1.generateId)('opt')) {
    const review = checkPlanRevision(root, version);
    const identity = (0, chain_1.readProjectIdentity)(root);
    const now = new Date();
    const ticket = { operation_ticket_id: ticketId, operation_id: 'plan_revise', project_id: identity.project_id, bound_role: 'FMN', arguments_hash: (0, exports.sha256)(JSON.stringify(review)), target: { artifact: 'plan', version, sha256: review.candidate_sha256 }, expected_state_revision: (0, contract_1.computeStateRevision)(root).revision, effects: ['Certify PLAN ' + version + ' revision ' + review.next_revision, 'Pending CONTRACT_CHANGE notice; EXEC acknowledgement required'], authority: 'director', issued_at: now.toISOString(), expires_at: new Date(now.getTime() + controlStore_1.TICKET_TTL_MS).toISOString(), consumed_at: null, review_package: review, dependencies_sha256: review.dependencies_sha256 };
    (0, controlStore_1.writeTicket)(root, ticket);
    return ticket;
}
function validateDirectorTicket(root, ticketId, approvalId, operation, version, hash, dependencies) {
    const ticket = (0, controlStore_1.readTicket)(root, ticketId);
    const approval = (0, controlStore_1.readApproval)(root, approvalId);
    const identity = (0, chain_1.readProjectIdentity)(root);
    const artifact = operation === 'exec_approve' ? 'exec' : 'plan';
    const role = artifact === 'exec' ? 'DEV' : 'FMN';
    if (!ticket || !approval || ticket.authority !== 'director' || ticket.bound_role !== role || ticket.target?.artifact !== artifact || ticket.project_id !== identity.project_id || approval.project_id !== identity.project_id || ticket.operation_id !== operation || ticket.target?.version !== version || ticket.target.sha256 !== hash || ticket.dependencies_sha256 !== dependencies || ticket.expected_state_revision !== (0, contract_1.computeStateRevision)(root).revision || ticket.consumed_at || !Number.isFinite(Date.parse(ticket.expires_at)) || Date.parse(ticket.expires_at) < Date.now())
        throw new Error('STALE_STATE: ticket target/dependencies expired, changed or mismatched.');
    if (approval.operation_ticket_id !== ticketId || approval.operation_id !== operation || approval.arguments_hash !== ticket.arguments_hash || approval.expected_state_revision !== ticket.expected_state_revision || approval.target_sha256 !== hash || approval.target_artifact !== ticket.target.artifact || approval.target_version !== version || approval.decision !== 'approve' || approval.consumed_at || !Number.isFinite(Date.parse(approval.expires_at)) || Date.parse(approval.expires_at) < Date.now() || approval.channel !== 'cli' || approval.authentication_method !== 'local_cli')
        throw new Error('APPROVAL_MISMATCH: exact trusted local Director approval required.');
    return { ticket, approval };
}
function commitPlanRevision(root, version, ticketId, approvalId) {
    const review = checkPlanRevision(root, version);
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(root);
    const plan = planEntry(chain, version);
    const ledger = assertPlanCertified(root, chain, version, false);
    let authorization;
    if (review.early_approval_required) {
        if (!ticketId || !approvalId)
            throw new Error('APPROVAL_REQUIRED: prepare candidate ticket and obtain Director approval first.');
        authorization = validateDirectorTicket(root, ticketId, approvalId, 'plan_revise', version, review.candidate_sha256, review.dependencies_sha256);
    }
    const bytes = fs_extra_1.default.readFileSync(boundedPath(root, review.candidate));
    if ((0, exports.sha256)(bytes) !== review.candidate_sha256)
        throw new Error('Candidate changed before commit.');
    const now = new Date().toISOString();
    const paths = revisionPaths(version, review.next_revision);
    const record = { revision: review.next_revision, revision_id: version + ':rev-' + review.next_revision, snapshot: paths.snapshot, snapshot_sha256: review.candidate_sha256, contract_sha256: review.contract_sha256, intent_revision_ref: review.intent.revision, intent_doc_sha256_ref: review.intent.hash, created_at: now, provenance: 'revision', declaration: review.stage.declaration };
    if (authorization) {
        authorization.ticket.consumed_at = now;
        authorization.approval.consumed_at = now;
        record.authorization = authorization;
    }
    (0, controlStore_1.journaledWrite)(root, boundedPath(root, paths.snapshot), bytes, true);
    (0, controlStore_1.journaledWrite)(root, artifactFile(root, chain, 'plan', version), bytes);
    ledger.records.push(record);
    plan.revision = record.revision;
    plan.contract_sha256 = record.contract_sha256;
    plan.intent_revision_ref = record.intent_revision_ref;
    plan.intent_doc_sha256_ref = record.intent_doc_sha256_ref;
    plan.needs_intent_review = false;
    plan.pending_notice = true;
    persistLedger(root, chain, ledger);
    chain.gates.gate_2_open = (0, chain_1.hasCleanGate2Chain)(chain);
    chain.gates.gate_3_satisfied = (0, chain_1.hasCleanGate3Chain)(chain);
    renderGovernanceRoadmap(root, chain);
    (0, chain_1.writeChain)(root, chainVersion, chain);
    if (authorization) {
        (0, controlStore_1.markTicketConsumed)(root, ticketId, now);
        (0, controlStore_1.markApprovalConsumed)(root, approvalId, now);
    }
    return { version, revision: record.revision, revision_id: record.revision_id, status: 'pending_notice' };
}
function acknowledgePlan(root, version, revision) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(root);
    const exec = chain.exec.versions.find(e => e.version === version);
    if (!exec || chain.exec.versions.filter(e => e.version === version).length !== 1 || exec.state !== 'DRAFT' || exec.plan_version_ref !== version)
        throw new Error('Acknowledgement requires a DRAFT same-number EXEC/PLAN pair.');
    const plan = planEntry(chain, version);
    if (plan.state !== 'APPROVED' || plan.revision !== revision)
        throw new Error('Acknowledge the latest APPROVED PLAN revision explicitly.');
    const ledger = assertPlanCertified(root, chain, version);
    assertAllNotices(root, ledger);
    exec.plan_revision_ref = revision;
    exec.plan_contract_sha256_ref = plan.contract_sha256;
    exec.acknowledged_at = new Date().toISOString();
    exec.updated_at = exec.acknowledged_at;
    (0, chain_1.writeChain)(root, chainVersion, chain);
    return { version, revision, acknowledged_at: exec.acknowledged_at, coding_authorized: false };
}
function approveLedgerWithExec(root, chain, version, time) {
    const ledger = assertPlanCertified(root, chain, version);
    for (const r of ledger.records)
        r.approved_with_exec_at = time;
    persistLedger(root, chain, ledger);
}
//# sourceMappingURL=revisions.js.map