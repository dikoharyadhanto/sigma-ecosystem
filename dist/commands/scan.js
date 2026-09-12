"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanCommand = scanCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = require("../utils/fs");
const terminologyScanner_1 = require("../engine/terminologyScanner");
const config_1 = require("../config");
// PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §2.10 — standalone, top-level (not
// nested under `notion`/`humanize`): use case is broader than either
// pipeline — checking source code or any document before it's shared or
// published externally, independent of Notion entirely. Read-only, never
// touches gate/lock/chain state.
const SIGMA_ARTIFACT_PATTERNS = [/^DIR-INTENT-/, /^FMN-PLAN-/, /^DEV-EXEC-/, /^ROADMAP-/, /^DIR-CLOSE-/];
function isSigmaArtifactFile(filename) {
    return SIGMA_ARTIFACT_PATTERNS.some(p => p.test(filename));
}
function timestampSlug(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return (`${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
        `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`);
}
function scanCommand() {
    const cmd = new commander_1.Command('scan');
    cmd
        .description('Scan a file for Sigma terminology before sharing or publishing it externally')
        .requiredOption('--file <path>', 'File to scan (relative to the current directory, or absolute)')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const targetPath = path_1.default.isAbsolute(opts.file) ? opts.file : path_1.default.resolve(process.cwd(), opts.file);
            if (!fs_extra_1.default.existsSync(targetPath)) {
                console.error(chalk_1.default.red(`Error: ${opts.file} does not exist.`));
                process.exit(1);
            }
            const filename = path_1.default.basename(targetPath);
            if (isSigmaArtifactFile(filename)) {
                console.log(`Skipped: ${filename} is a Sigma artifact file — it is expected to contain Sigma\n` +
                    'terminology by design. `sigma scan` does not apply to DIR-INTENT/FMN-PLAN/DEV-EXEC/\n' +
                    'ROADMAP/DIR-CLOSE source artifacts.');
                return;
            }
            const content = fs_extra_1.default.readFileSync(targetPath, 'utf8');
            const terminology = (0, terminologyScanner_1.loadTerminologyList)(projectRoot);
            const matches = (0, terminologyScanner_1.scanForSigmaTerminology)(content, terminology);
            if (matches.length === 0) {
                console.log(`No Sigma terminology detected in ${opts.file}.`);
                return;
            }
            const logsDir = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, 'logs');
            fs_extra_1.default.ensureDirSync(logsDir);
            const logFileName = `${timestampSlug(new Date())}_terminology-scan.log`;
            const logRelPath = (0, fs_1.toPosix)(path_1.default.join(config_1.PROJECT_SIGMA_DIR, 'logs', logFileName));
            const logAbsPath = path_1.default.join(logsDir, logFileName);
            const lines = [];
            lines.push(`Sigma terminology scan — ${opts.file}`);
            lines.push(`Scanned at: ${new Date().toISOString()}`);
            lines.push('');
            for (const m of matches) {
                lines.push(`  Line ${m.line}: "${m.lineText}"`);
                lines.push(`           ^ ${m.term}`);
            }
            lines.push('');
            lines.push(`${matches.length} term(s) found. Review and reword before sharing this file externally.`);
            fs_extra_1.default.writeFileSync(logAbsPath, lines.join('\n') + '\n', 'utf8');
            console.log(`${matches.length} term(s) detected. Full report: ${logRelPath}`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=scan.js.map