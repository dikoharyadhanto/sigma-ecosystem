"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewCommand = reviewCommand;
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const docCheck_1 = require("../utils/docCheck");
const reviewNewService_1 = require("../services/reviewNewService");
const closeNewService_1 = require("../services/closeNewService");
// PRODUCT REVIEW is recognized by its file: Sigma/review/PRODUCT-REVIEW-vN.md,
// one per INTENT, version equal to the chain's INTENT version, no chain state.
// ARC creates it after the Director states that the final product is ready.
function reviewDocPath(projectRoot, chain) {
    const rel = (0, closeNewService_1.findProductReviewRel)(projectRoot, chain);
    if (!rel)
        throw new Error('No PRODUCT REVIEW found for this chain. Run: sigma review new');
    return path_1.default.join(projectRoot, rel);
}
function reviewCommand() {
    const cmd = new commander_1.Command('review');
    cmd.description('Manage PRODUCT REVIEW artifact');
    cmd.command('new')
        .description('Create the PRODUCT REVIEW for the active chain (requires ratified INTENT; one per INTENT)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const { relPath, docReport: report } = (0, reviewNewService_1.createReviewDraft)(projectRoot);
            console.log(`Created: ${relPath}`);
            console.log('Open it with FMN\'s Review Request (from the `sigma send` message), then record ARC, AUD, and Director verdicts.');
            console.log('Running automatic validation...\n');
            (0, docCheck_1.printSigmaDocReport)(report, projectRoot);
            if (!report.ok)
                process.exit(1);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('check')
        .description('Validate a PRODUCT REVIEW structure and report whether its verdicts permit `sigma close new` (read-only)')
        .option('--v <version>', 'Check the PRODUCT REVIEW of a specific chain instead of the active one', chain_1.normalizeVersionArg)
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const chain = opts.v ? (0, chain_1.readChain)(projectRoot, opts.v) : (0, chain_1.readActiveChain)(projectRoot).data;
            const report = (0, docCheck_1.validateSigmaDocFile)(reviewDocPath(projectRoot, chain), 'review');
            (0, docCheck_1.printSigmaDocReport)(report, projectRoot);
            if (!report.ok)
                process.exit(1);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=review.js.map