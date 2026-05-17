"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.success = success;
exports.info = info;
exports.warn = warn;
exports.error = error;
exports.section = section;
exports.table = table;
const chalk_1 = __importDefault(require("chalk"));
function success(msg) {
    console.log(chalk_1.default.green(msg));
}
function info(msg) {
    console.log(chalk_1.default.cyan(msg));
}
function warn(msg) {
    console.log(chalk_1.default.yellow(msg));
}
function error(msg) {
    console.error(chalk_1.default.red(`Error: ${msg}`));
    process.exit(1);
}
function section(title) {
    console.log(`\n--- ${title} ---`);
}
function table(rows) {
    if (rows.length === 0)
        return;
    const colWidths = rows[0].map((_, colIdx) => Math.max(...rows.map(row => (row[colIdx] ?? '').length)));
    for (const row of rows) {
        const line = row.map((cell, i) => (cell ?? '').padEnd(colWidths[i])).join('  ');
        console.log(line);
    }
}
//# sourceMappingURL=output.js.map