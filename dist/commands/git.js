"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gitCommand = gitCommand;
const commander_1 = require("commander");
const child_process_1 = require("child_process");
const fs_1 = require("../utils/fs");
function run(cmd, cwd) {
    return (0, child_process_1.execSync)(cmd, { cwd, encoding: 'utf8' }).trim();
}
function gitCommand() {
    const cmd = new commander_1.Command('git');
    cmd.description('Git repository inspection commands');
    cmd.command('evidence')
        .description('Display git evidence: branch, commit, changed files, diff summary (read-only)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            try {
                run('git rev-parse --git-dir', projectRoot);
            }
            catch {
                console.error('No git repository found. Initialize with: git init');
                process.exit(1);
            }
            let branch = '(unknown)';
            let hash = '(unknown)';
            let subject = '(unknown)';
            let date = '(unknown)';
            let changedFiles = 'none';
            let diffStat = 'none';
            try {
                branch = run('git rev-parse --abbrev-ref HEAD', projectRoot);
            }
            catch { /* ok */ }
            try {
                const logOut = run('git log -1 --format=%H%n%s%n%ai', projectRoot);
                const [h, s, d] = logOut.split('\n');
                hash = h ?? '(unknown)';
                subject = s ?? '(unknown)';
                date = d ?? '(unknown)';
            }
            catch { /* ok */ }
            try {
                const status = run('git status --short', projectRoot);
                if (status)
                    changedFiles = status;
            }
            catch { /* ok */ }
            try {
                const diff = run('git diff --stat HEAD', projectRoot);
                if (diff)
                    diffStat = diff;
            }
            catch { /* ok */ }
            console.log('\n=== Git Evidence ===\n');
            console.log(`Branch:   ${branch}`);
            console.log(`Commit:   ${hash}`);
            console.log(`Message:  ${subject}`);
            console.log(`Date:     ${date}`);
            console.log('\n--- Changed Files ---');
            console.log(changedFiles);
            console.log('\n--- Diff Summary ---');
            console.log(diffStat);
            console.log('');
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=git.js.map