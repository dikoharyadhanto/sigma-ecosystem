"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const config_1 = require("./config");
const setup_1 = require("./commands/setup");
const project_1 = require("./commands/project");
const session_1 = require("./commands/session");
const gitignore_1 = require("./commands/gitignore");
const intent_1 = require("./commands/intent");
const plan_1 = require("./commands/plan");
const exec_1 = require("./commands/exec");
const close_1 = require("./commands/close");
const roadmap_1 = require("./commands/roadmap");
const git_1 = require("./commands/git");
const cso_1 = require("./commands/cso");
const override_1 = require("./commands/override");
const send_1 = require("./commands/send");
const inbox_1 = require("./commands/inbox");
const config_2 = require("./commands/config");
const sync_1 = require("./commands/sync");
const memory_1 = require("./commands/memory");
const doctor_1 = require("./commands/doctor");
const program = new commander_1.Command();
program
    .name('sigma')
    .description('Sigma — Lightweight project governance CLI')
    .version(config_1.SIGMA_VERSION);
program.addCommand((0, setup_1.setupCommand)());
program.addCommand((0, project_1.projectCommand)());
program.addCommand((0, session_1.sessionCommand)());
program.addCommand((0, gitignore_1.gitignoreCommand)());
program.addCommand((0, intent_1.intentCommand)());
program.addCommand((0, plan_1.planCommand)());
program.addCommand((0, exec_1.execCommand)());
program.addCommand((0, close_1.closeCommand)());
program.addCommand((0, roadmap_1.roadmapCommand)());
program.addCommand((0, git_1.gitCommand)());
program.addCommand((0, cso_1.csoCommand)());
program.addCommand((0, override_1.overrideCommand)());
program.addCommand((0, send_1.sendCommand)());
program.addCommand((0, inbox_1.inboxCommand)());
program.addCommand((0, config_2.configCommand)());
program.addCommand((0, sync_1.syncCommand)());
program.addCommand((0, memory_1.memoryCommand)());
program.addCommand((0, doctor_1.doctorCommand)());
program.on('command:*', (operands) => {
    console.error(`Unknown command: sigma ${operands.join(' ')}`);
    console.error('Run `sigma --help` for available commands.');
    process.exit(1);
});
program.parse(process.argv);
//# sourceMappingURL=cli.js.map