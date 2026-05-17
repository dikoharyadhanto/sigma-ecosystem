"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadOperationRegistry = loadOperationRegistry;
exports.loadDocumentRegistry = loadDocumentRegistry;
exports.getOperation = getOperation;
exports.getDocumentsForRole = getDocumentsForRole;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
// ── Loaders ──────────────────────────────────────────────────────────────────
function loadOperationRegistry(projectRoot) {
    const filePath = path_1.default.join(projectRoot, config_1.OPERATION_REGISTRY_FILE);
    if (!fs_extra_1.default.existsSync(filePath)) {
        throw new Error(`Operation registry not found at ${filePath}. Run: sigma project sync`);
    }
    try {
        return fs_extra_1.default.readJsonSync(filePath);
    }
    catch {
        throw new Error(`Failed to parse operation registry at ${filePath}`);
    }
}
function loadDocumentRegistry(projectRoot) {
    const filePath = path_1.default.join(projectRoot, config_1.DOCUMENT_REGISTRY_FILE);
    if (!fs_extra_1.default.existsSync(filePath)) {
        throw new Error(`Document registry not found at ${filePath}. Run: sigma project sync`);
    }
    try {
        return fs_extra_1.default.readJsonSync(filePath);
    }
    catch {
        throw new Error(`Failed to parse document registry at ${filePath}`);
    }
}
function getOperation(registry, operationId) {
    return registry.operations.find(op => op.operation_id === operationId);
}
function getDocumentsForRole(registry, role) {
    const roleKey = role ? `session_bootstrap_${role.toLowerCase()}_role` : null;
    return registry.documents.filter(doc => {
        const when = doc.mandatory_when ?? [];
        if (when.includes('session_bootstrap'))
            return true;
        if (roleKey && when.includes(roleKey))
            return true;
        return false;
    });
}
//# sourceMappingURL=registry.js.map