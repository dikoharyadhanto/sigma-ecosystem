"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.devCommand = devCommand;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = require("../utils/fs");
const devWorkspace_1 = require("../engine/devWorkspace");
function printStatus(projectRoot) {
    const status = (0, devWorkspace_1.getDevWorkspaceStatus)(projectRoot);
    console.log(`DEV workspace: ${status.state}`);
    for (const line of (0, devWorkspace_1.describeDevWorkspace)(status)) {
        console.log(line);
    }
}
function devCommand() {
    const cmd = new commander_1.Command('dev');
    cmd.description('DEV workspace commands');
    cmd
        .command('create-workspace')
        .description('Create the DEV workspace dev/ and register it in the project identity (run only on explicit Director instruction)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            (0, devWorkspace_1.createDevWorkspace)(projectRoot);
            console.log(chalk_1.default.green('DEV workspace created: dev/'));
            console.log('Note: this operation wrote at the project root, outside Sigma/.');
            printStatus(projectRoot);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd
        .command('status')
        .description('Show whether the DEV workspace is active, degraded, or not registered (read-only)')
        .action(() => {
        try {
            printStatus((0, fs_1.findProjectRoot)());
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=dev.js.map