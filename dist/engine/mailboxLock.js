"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertMailboxLease = assertMailboxLease;
exports.withMailboxLock = withMailboxLock;
const path_1 = __importDefault(require("path"));
const controlStore_1 = require("./controlStore");
const leases = new Map();
// CLI mailbox mutations recheck ownership immediately before writes. MCP
// archive already runs inside its own bounded, journaled control wrapper.
function assertMailboxLease(root) {
    leases.get(path_1.default.resolve(root))?.assertOwned();
}
async function withMailboxLock(root, fn) {
    const lock = await (0, controlStore_1.acquireProjectLock)(root);
    const key = path_1.default.resolve(root);
    try {
        lock.assertOwned();
        (0, controlStore_1.recoverControlTransactions)(root);
        leases.set(key, lock);
        const result = await fn();
        lock.assertOwned();
        return result;
    }
    finally {
        leases.delete(key);
        await lock.release();
    }
}
//# sourceMappingURL=mailboxLock.js.map