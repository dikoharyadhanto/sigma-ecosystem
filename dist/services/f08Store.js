"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.digest = exports.F08_STORE = void 0;
exports.f08StorePath = f08StorePath;
exports.readF08Store = readF08Store;
exports.writeF08Store = writeF08Store;
// F08 internal records. These records grant no governance approval.
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const controlStore_1 = require("../engine/controlStore");
const chain_1 = require("../engine/chain");
exports.F08_STORE = 'Sigma/logs/f08.json';
const digest = (value) => 'sha256:' + crypto_1.default.createHash('sha256').update(value).digest('hex');
exports.digest = digest;
function f08StorePath(root) {
    const file = path_1.default.join(root, exports.F08_STORE);
    (0, controlStore_1.assertNoTransactionSymlink)(root, file);
    return file;
}
function readF08Store(root) {
    const file = f08StorePath(root), projectId = (0, chain_1.readProjectIdentity)(root).project_id;
    if (!fs_extra_1.default.existsSync(file))
        return { format: 1, project_id: projectId, packs: [], responses: [], questions: [], assessments: [], clones: [] };
    const stat = fs_extra_1.default.lstatSync(file);
    if (!stat.isFile() || stat.size > 16 * 1024 * 1024)
        throw new Error('F08 store is not a regular file or exceeds 16 MiB.');
    const data = JSON.parse(fs_extra_1.default.readFileSync(file, 'utf8'));
    if (data.format !== 1 || data.project_id !== projectId ||
        ![data.packs, data.responses, data.questions, data.assessments, data.clones].every(Array.isArray))
        throw new Error('Invalid F08 store identity/format; refusing to overwrite.');
    return data;
}
function writeF08Store(root, data) {
    const body = JSON.stringify(data, null, 2) + '\n';
    if (Buffer.byteLength(body) > 16 * 1024 * 1024)
        throw new Error('F08 store exceeds 16 MiB; archive explicitly before adding records.');
    (0, controlStore_1.journaledWrite)(root, f08StorePath(root), body);
}
//# sourceMappingURL=f08Store.js.map