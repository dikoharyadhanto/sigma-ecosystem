"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const config_1 = require("./config");
const setup_1 = require("./commands/setup");
const project_1 = require("./commands/project");
const session_1 = require("./commands/session");
const intent_1 = require("./commands/intent");
const plan_1 = require("./commands/plan");
const exec_1 = require("./commands/exec");
const close_1 = require("./commands/close");
const review_1 = require("./commands/review");
const roadmap_1 = require("./commands/roadmap");
const git_1 = require("./commands/git");
const override_1 = require("./commands/override");
const send_1 = require("./commands/send");
const inbox_1 = require("./commands/inbox");
const memo_1 = require("./commands/memo");
const config_2 = require("./commands/config");
const memory_1 = require("./commands/memory");
const doctor_1 = require("./commands/doctor");
const reference_1 = require("./commands/reference");
const notes_1 = require("./commands/notes");
const report_1 = require("./commands/report");
const scan_1 = require("./commands/scan");
const control_1 = require("./commands/control");
const dev_1 = require("./commands/dev");
const f08_1 = require("./commands/f08");
const operationLog_1 = require("./utils/operationLog");
const fs_1 = require("./utils/fs");
const assetConsistency_1 = require("./services/assetConsistency");
const program = new commander_1.Command();
program
    .name('sigma')
    .description('Sigma — AI-operated governance runtime CLI')
    .version(config_1.SIGMA_VERSION);
program.addCommand((0, setup_1.setupCommand)());
program.addCommand((0, project_1.projectCommand)());
program.addCommand((0, session_1.sessionCommand)());
program.addCommand((0, intent_1.intentCommand)());
program.addCommand((0, plan_1.planCommand)());
program.addCommand((0, exec_1.execCommand)());
program.addCommand((0, close_1.closeCommand)());
program.addCommand((0, review_1.reviewCommand)());
program.addCommand((0, roadmap_1.roadmapCommand)());
program.addCommand((0, git_1.gitCommand)());
program.addCommand((0, override_1.overrideCommand)());
program.addCommand((0, send_1.sendCommand)());
program.addCommand((0, inbox_1.inboxCommand)());
program.addCommand((0, memo_1.memoCommand)());
program.addCommand((0, config_2.configCommand)());
program.addCommand((0, memory_1.memoryCommand)());
program.addCommand((0, doctor_1.doctorCommand)());
program.addCommand((0, reference_1.referenceCommand)());
program.addCommand((0, notes_1.notesCommand)());
program.addCommand((0, report_1.reportCommand)());
program.addCommand((0, scan_1.scanCommand)());
program.addCommand((0, control_1.controlCommand)());
program.addCommand((0, dev_1.devCommand)());
program.addCommand((0, f08_1.auditCommand)());
program.addCommand((0, f08_1.decisionsCommand)());
program.on('command:*', (operands) => {
    console.error(`Unknown command: sigma ${operands.join(' ')}`);
    console.error('Run `sigma --help` for available commands.');
    process.exit(1);
});
// ── Operation history log ───────────────────────────────────────────────────
// Mutating and governance-significant operations are recorded on process exit,
// including failures inside handlers. Operations classified `read_only` in
// the registry are deliberately excluded: diagnostics must not change the
// project merely by observing it.
let pendingOperation = null;
function commandPath(cmd) {
    const parts = [];
    let current = cmd;
    while (current && current.parent) {
        parts.unshift(current.name());
        current = current.parent;
    }
    return parts.join(' ');
}
program.hook('preAction', (_thisCommand, actionCommand) => {
    pendingOperation = commandPath(actionCommand);
    if ((0, operationLog_1.isRegisteredReadOnlyOperation)(pendingOperation))
        pendingOperation = null;
    if (pendingOperation === 'doctor' && actionCommand.opts().checkAssets)
        pendingOperation = null;
    if (pendingOperation === 'plan check' && actionCommand.opts().sources ||
        ['audit show', 'decisions list', 'decisions target'].includes(pendingOperation ?? '') ||
        ['intent clone', 'plan clone'].includes(pendingOperation ?? '') && !actionCommand.opts().confirm)
        pendingOperation = null;
});
// ── Version warning (F12) ───────────────────────────────────────────────────
// One line on stderr when the Sigma assets this project (or the global
// installation) holds are behind the installed CLI. Silent outside a project.
// `setup`, `project start|register|sync`, and `doctor` are the commands that
// fix or diagnose the condition, and `session bootstrap` already prints the
// same message through its compatibility warnings.
const VERSION_WARNING_EXEMPT = new Set([
    'project start', 'project register', 'project sync', 'session bootstrap',
]);
function exemptFromVersionWarning(operation) {
    const [head] = operation.split(' ');
    return head === 'setup' || head === 'doctor' || VERSION_WARNING_EXEMPT.has(operation);
}
program.hook('preAction', (_thisCommand, actionCommand) => {
    if (exemptFromVersionWarning(commandPath(actionCommand)))
        return;
    let projectRoot;
    try {
        projectRoot = (0, fs_1.findProjectRoot)();
    }
    catch {
        return;
    }
    const status = (0, assetConsistency_1.evaluateVersionStatus)(projectRoot);
    if (status?.message)
        console.error(status.message);
});
process.on('exit', (code) => {
    if (pendingOperation) {
        (0, operationLog_1.appendOperationLogEntry)(pendingOperation, code);
    }
});
program.parseAsync(process.argv).catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
});
//# sourceMappingURL=cli.js.map