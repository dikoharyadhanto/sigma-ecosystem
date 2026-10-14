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
const artifactNames_1 = require("../engine/artifactNames");
// Standalone, top-level command: checks source code or any document for
// Sigma terminology before it's shared outside Sigma. Read-only, never
// touches gate/lock/chain state.
// Pre-F10 names are specific enough to recognize by name anywhere, as before.
const LEGACY_ARTIFACT_NAME = /^(?:DIR-INTENT|FMN-PLAN|DEV-EXEC|DIR-CLOSE)-/;
// Names without a role prefix (PLAN-v1.1.md) are generic, and
// `Sigma/revisions/staging/PLAN-v1.1.md` shares a basename with a real plan, so
// they are recognized by where they live as well as what they are called (F10).
function isSigmaArtifactFile(projectRoot, absolutePath) {
    if (LEGACY_ARTIFACT_NAME.test(path_1.default.basename(absolutePath)) || /^ROADMAP-/.test(path_1.default.basename(absolutePath)))
        return true;
    const rel = (0, fs_1.toPosix)(path_1.default.relative(projectRoot, absolutePath));
    if (rel.startsWith('..') || path_1.default.isAbsolute(rel))
        return false;
    return (0, artifactNames_1.classifyArtifactRel)(rel) !== null;
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
            if (isSigmaArtifactFile(projectRoot, targetPath)) {
                console.log(`Skipped: ${filename} is a Sigma artifact file — it is expected to contain Sigma\n` +
                    'terminology by design. `sigma scan` does not apply to INTENT/ROADMAP/PLAN/EXEC/CLOSE\n' +
                    'source artifacts (including their pre-F10 DIR-INTENT/FMN-PLAN/DEV-EXEC/DIR-CLOSE names).');
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