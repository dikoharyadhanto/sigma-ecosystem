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
const roadmap_1 = require("./commands/roadmap");
const git_1 = require("./commands/git");
const override_1 = require("./commands/override");
const send_1 = require("./commands/send");
const inbox_1 = require("./commands/inbox");
const config_2 = require("./commands/config");
const memory_1 = require("./commands/memory");
const doctor_1 = require("./commands/doctor");
const reference_1 = require("./commands/reference");
const report_1 = require("./commands/report");
const notion_1 = require("./commands/notion");
const scan_1 = require("./commands/scan");
const operationLog_1 = require("./utils/operationLog");
const program = new commander_1.Command();
program
    .name('sigma')
    .description('Sigma — Lightweight project governance CLI')
    .version(config_1.SIGMA_VERSION);
program.addCommand((0, setup_1.setupCommand)());
program.addCommand((0, project_1.projectCommand)());
program.addCommand((0, session_1.sessionCommand)());
program.addCommand((0, intent_1.intentCommand)());
program.addCommand((0, plan_1.planCommand)());
program.addCommand((0, exec_1.execCommand)());
program.addCommand((0, close_1.closeCommand)());
program.addCommand((0, roadmap_1.roadmapCommand)());
program.addCommand((0, git_1.gitCommand)());
program.addCommand((0, override_1.overrideCommand)());
program.addCommand((0, send_1.sendCommand)());
program.addCommand((0, inbox_1.inboxCommand)());
program.addCommand((0, config_2.configCommand)());
program.addCommand((0, memory_1.memoryCommand)());
program.addCommand((0, doctor_1.doctorCommand)());
program.addCommand((0, reference_1.referenceCommand)());
program.addCommand((0, report_1.reportCommand)());
program.addCommand((0, notion_1.notionCommand)());
program.addCommand((0, scan_1.scanCommand)());
program.on('command:*', (operands) => {
    console.error(`Unknown command: sigma ${operands.join(' ')}`);
    console.error('Run `sigma --help` for available commands.');
    process.exit(1);
});
// ── Operation history log ───────────────────────────────────────────────────
// Every command handler catches its own errors and calls process.exit(1)
// directly (never throws out to commander), so a postAction hook would never
// see failed operations — the process is already dead by the time it would
// fire. process.on('exit') always runs immediately before the process
// actually terminates regardless of cause, so pairing it with preAction (to
// capture which command is about to run) is the only combination that
// guarantees every operation is recorded, success or failure, without
// touching any individual command handler.
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
});
process.on('exit', (code) => {
    if (pendingOperation) {
        (0, operationLog_1.appendOperationLogEntry)(pendingOperation, code);
    }
});
program.parse(process.argv);
//# sourceMappingURL=cli.js.map