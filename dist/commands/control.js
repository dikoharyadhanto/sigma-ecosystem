"use strict";
// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §10.2, §21.2, Stage D — the
// trusted local Director CLI that records an approval decision against an
// operation ticket a control tool (sigma_prepare_intent_ratify) prepared.
//
// No MCP tool in this codebase writes an approval record. This is
// deliberate: plan §10.2 requires approval to be "direkam melalui trusted
// local CLI Director", and invariant §5.8 ("Director finality") plus the
// stopping criterion §22 ("chat confirmation diterima sebagai approval
// governance" is a hard stop) both depend on that channel staying outside
// anything a model can drive. Running this command IS the authorization —
// there is no further confirmation step inside sigma-control.
//
// Trust boundary, stated rather than assumed: identity is the local OS user
// running this command. There is no remote Director authentication yet
// (plan §10.2, §21.2 — deferred, own design). This command must not be
// exposed over any remote/network surface.
//
// os.userInfo() throws on some Windows sandboxes/containers (observed during
// Codex's Stage C/D review: uv_os_get_passwd failing with ENOMEM) — a
// platform-level lookup failure unrelated to who is actually running the
// command, and not something this tool should crash on given identity here
// is already a best-effort, non-cryptographic trust boundary. Falls back to
// environment variables, then a fixed placeholder, rather than failing the
// approval/rejection outright.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.controlCommand = controlCommand;
const commander_1 = require("commander");
const os_1 = __importDefault(require("os"));
const fs_1 = require("../utils/fs");
const controlStore_1 = require("../engine/controlStore");
function localDirectorIdentity() {
    try {
        return os_1.default.userInfo().username;
    }
    catch {
        return process.env.USERNAME || process.env.USER || 'unknown-local-user';
    }
}
function loadTicketOrExit(projectRoot, ticketId) {
    const ticket = (0, controlStore_1.readTicket)(projectRoot, ticketId);
    if (!ticket) {
        console.error(`Error: no operation ticket found for "${ticketId}".`);
        console.error('It may not exist yet, may belong to a different project root, or the id was mistyped.');
        process.exit(1);
    }
    return ticket;
}
function printTicketSummary(ticket) {
    console.log('\n=== Sigma Control — Operation Ticket ===\n');
    console.log(`Ticket:                  ${ticket.operation_ticket_id}`);
    console.log(`Operation:               ${ticket.operation_id}`);
    console.log(`Requested by role:       ${ticket.bound_role}`);
    if (ticket.target) {
        console.log(`Target artifact:         ${ticket.target.artifact} ${ticket.target.version}`);
        console.log(`Target sha256:           ${ticket.target.sha256}`);
    }
    else {
        console.log('Target artifact:         (none)');
    }
    console.log(`Expected state_revision: ${ticket.expected_state_revision}`);
    console.log(`Issued at:               ${ticket.issued_at}`);
    console.log(`Expires at:              ${ticket.expires_at}`);
    console.log(`Already consumed:        ${ticket.consumed_at ?? 'no'}`);
    if (ticket.effects.length > 0) {
        console.log('Effects if approved and committed:');
        for (const effect of ticket.effects)
            console.log(`  - ${effect}`);
    }
    console.log('');
}
function assertTicketActionable(ticket) {
    if (ticket.consumed_at) {
        console.error('Error: this ticket has already been consumed by a commit. Nothing to decide.');
        process.exit(1);
    }
    if (new Date(ticket.expires_at).getTime() < Date.now()) {
        console.error('Error: this ticket has expired. Ask the requester to prepare a new one.');
        process.exit(1);
    }
}
function recordApproval(projectRoot, ticket, decision, reason) {
    const now = new Date();
    const approval = {
        approval_id: (0, controlStore_1.generateId)('appr'),
        project_id: ticket.project_id,
        operation_ticket_id: ticket.operation_ticket_id,
        operation_id: ticket.operation_id,
        arguments_hash: ticket.arguments_hash,
        target_artifact: ticket.target?.artifact ?? null,
        target_version: ticket.target?.version ?? null,
        target_sha256: ticket.target?.sha256 ?? null,
        expected_state_revision: ticket.expected_state_revision,
        decision,
        reason,
        director_identity: localDirectorIdentity(),
        authentication_method: 'local_cli',
        channel: 'cli',
        issued_at: now.toISOString(),
        expires_at: new Date(now.getTime() + controlStore_1.APPROVAL_TTL_MS).toISOString(),
        consumed_at: null,
    };
    (0, controlStore_1.writeApproval)(projectRoot, approval);
    return approval;
}
function controlCommand() {
    const cmd = new commander_1.Command('control');
    cmd.description('Trusted local Director surface for sigma-control operation tickets (plan §10.2) — never reachable via MCP');
    cmd
        .command('show <ticketId>')
        .description('Preview an operation ticket without recording a decision')
        .action((ticketId) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            printTicketSummary(loadTicketOrExit(projectRoot, ticketId));
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd
        .command('approve <ticketId>')
        .description('Record Director approval for an operation ticket, enabling exactly one commit')
        .option('--director-confirm', 'Required. Explicit Director authorization to record this approval.')
        .action((ticketId, opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const ticket = loadTicketOrExit(projectRoot, ticketId);
            printTicketSummary(ticket);
            assertTicketActionable(ticket);
            if (!opts.directorConfirm) {
                console.error('Error: --director-confirm is required to record an approval.');
                console.error(`Re-run: sigma control approve ${ticketId} --director-confirm`);
                process.exit(1);
            }
            const approval = recordApproval(projectRoot, ticket, 'approve', null);
            console.log(`Approval recorded: ${approval.approval_id}`);
            console.log('Decision: approve');
            console.log(`Expires:  ${approval.expires_at}`);
            console.log(`Give the requester both operation_ticket_id (${ticket.operation_ticket_id}) and approval_id (${approval.approval_id}) for the matching commit tool.`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd
        .command('reject <ticketId>')
        .description('Record Director rejection for an operation ticket')
        .requiredOption('--reason <reason>', 'Required. Why this operation is rejected.')
        .option('--director-confirm', 'Required. Explicit Director authorization to record this rejection.')
        .action((ticketId, opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const ticket = loadTicketOrExit(projectRoot, ticketId);
            printTicketSummary(ticket);
            console.log(`Reason: ${opts.reason}\n`);
            assertTicketActionable(ticket);
            if (!opts.directorConfirm) {
                console.error('Error: --director-confirm is required to record a rejection.');
                console.error(`Re-run: sigma control reject ${ticketId} --reason "..." --director-confirm`);
                process.exit(1);
            }
            const approval = recordApproval(projectRoot, ticket, 'reject', opts.reason);
            console.log(`Rejection recorded: ${approval.approval_id}`);
            console.log('The ticket remains otherwise unconsumed; no commit tool can use this approval to proceed.');
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=control.js.map