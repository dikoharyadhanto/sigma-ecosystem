"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.csoCommand = csoCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const progress_1 = require("../engine/progress");
const fs_1 = require("../utils/fs");
const config_1 = require("../config");
const PACKAGE_ROOT = path_1.default.resolve(__dirname, '..', '..');
const BUNDLE_TEMPLATES = path_1.default.join(PACKAGE_ROOT, 'Sigma', 'templates');
function resolveTemplate(name) {
    const global = path_1.default.join(config_1.GLOBAL_TEMPLATES_DIR, name);
    if (fs_extra_1.default.existsSync(global))
        return global;
    const bundle = path_1.default.join(BUNDLE_TEMPLATES, name);
    if (fs_extra_1.default.existsSync(bundle))
        return bundle;
    throw new Error('Template not found. Run: sigma setup install');
}
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
        .option('--role <role>', 'Role label for filename (e.g. DEV, FMN, ARC)', 'ANON')
        .option('--from <file>', 'Seed content from an existing draft file')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            const role = opts.role.toUpperCase();
            const ts = buildTimestamp();
            const baseName = `CSO-${role}-${ts}`;
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
                const templatePath = resolveTemplate('CSO-TEMPLATE.md');
                fs_extra_1.default.copySync(templatePath, absPath);
            }
            const now = new Date().toISOString();
            const entry = {
                version: baseName,
                state: 'COMPLETE',
                file: relPath,
                created_at: now,
            };
            (0, progress_1.registerCsoEntry)(data, entry);
            (0, progress_1.writeProgress)(projectRoot, data);
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