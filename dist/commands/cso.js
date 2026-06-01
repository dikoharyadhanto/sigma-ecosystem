"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.csoCommand = csoCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
function buildTimestamp() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${yyyy}${mm}${dd}-${hh}${min}`;
}
function csoCommand() {
    const cmd = new commander_1.Command('cso');
    cmd.description('Manage CSO (Close-out Session Output) artifacts');
    cmd.command('new')
        .description('Create a new CSO file in Sigma/logs/')
        .option('--role <role>', 'Optional legacy role label for filename (deprecated)')
        .option('--from <file>', 'Seed content from an existing draft file')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const ts = buildTimestamp();
            const roleSegment = opts.role ? `${opts.role.toUpperCase()}-` : '';
            const baseName = `CSO-${roleSegment}${ts}`;
            const fileName = `${baseName}.md`;
            const relPath = path_1.default.join('Sigma', 'logs', fileName);
            const absPath = path_1.default.join(projectRoot, relPath);
            fs_extra_1.default.ensureDirSync(path_1.default.dirname(absPath));
            if (opts.from) {
                const srcPath = path_1.default.resolve(opts.from);
                if (!fs_extra_1.default.existsSync(srcPath)) {
                    throw new Error(`Source file not found: ${opts.from}`);
                }
                fs_extra_1.default.copySync(srcPath, absPath);
            }
            else {
                (0, artifacts_1.copyTemplateToArtifact)('CSO-TEMPLATE.md', absPath);
            }
            console.log(`CSO created: ${relPath}`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=cso.js.map