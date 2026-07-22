"use strict";
/**
 * mcpConfig.ts — Wiring sigma-mcp ke AI client configs
 *
 * Menyediakan fungsi tulis dan hapus config MCP untuk kelima platform:
 *   Tulis  : writeClaudeMcpConfig, writeCursorMcpConfig,
 *            writeCodexMcpConfig, writeAntigravityMcpConfig
 *   Hapus  : removeCodexMcpConfig, removeAntigravityMcpConfig
 *   Helper : tryMcpOp — wrap operasi MCP dengan try-catch, kembalikan pesan error atau null
 *
 * Prinsip desain:
 *   - Native-only: hanya mendaftarkan sigma-mcp, tidak membangkitkan server lain
 *   - Merge-aware: membaca file existing terlebih dulu, upsert key "sigma" saja
 *   - Idempoten: dipanggil dua kali menghasilkan file yang sama
 *   - Non-destruktif: entri MCP server lain milik pengguna tidak terhapus
 *   - Fungsi hapus: no-op kalau file/key tidak ada; merge-delete kalau ada
 *   - Fault-tolerant: semua fungsi boleh gagal (EPERM, EACCES, file locked);
 *     gunakan tryMcpOp() di call site supaya error jadi warn, bukan crash
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeClaudeMcpConfig = writeClaudeMcpConfig;
exports.writeCursorMcpConfig = writeCursorMcpConfig;
exports.writeCodexMcpConfig = writeCodexMcpConfig;
exports.writeAntigravityMcpConfig = writeAntigravityMcpConfig;
exports.removeCodexMcpConfig = removeCodexMcpConfig;
exports.removeAntigravityMcpConfig = removeAntigravityMcpConfig;
exports.isSigmaMcpResolvable = isSigmaMcpResolvable;
exports.tryMcpOp = tryMcpOp;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const smol_toml_1 = require("smol-toml");
// ── Payload sigma-mcp ─────────────────────────────────────────────────────────
/** Entri sigma-mcp yang ditulis ke semua config. command = "sigma-mcp" (bare,
 *  asumsi global install — resolvable via PATH). */
const SIGMA_MCP_ENTRY = {
    command: 'sigma-mcp',
    args: [],
};
// ── Helpers ───────────────────────────────────────────────────────────────────
/** Baca JSON dari path; kembalikan {} kalau file tidak ada atau parse gagal. */
function readJsonSafe(filePath) {
    if (!fs_extra_1.default.existsSync(filePath))
        return {};
    try {
        const raw = fs_extra_1.default.readJsonSync(filePath);
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            return raw;
        }
        return {};
    }
    catch {
        return {};
    }
}
/** Tulis JSON ke path; buat direktori parent bila perlu. */
function writeJsonSafe(filePath, data) {
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(filePath));
    fs_extra_1.default.writeJsonSync(filePath, data, { spaces: 2 });
}
// ── Stage 2: Project-scoped (ditulis di project start / sync) ─────────────────
/**
 * Tulis/upsert entri sigma ke .mcp.json di project root.
 * Format: { "mcpServers": { "sigma": { "command": "sigma-mcp", "args": [] } } }
 * Merge-aware: entri server lain dipertahankan.
 */
function writeClaudeMcpConfig(projectRoot) {
    const filePath = path_1.default.join(projectRoot, '.mcp.json');
    const existing = readJsonSafe(filePath);
    if (!existing.mcpServers || typeof existing.mcpServers !== 'object' || Array.isArray(existing.mcpServers)) {
        existing.mcpServers = {};
    }
    existing.mcpServers.sigma = SIGMA_MCP_ENTRY;
    writeJsonSafe(filePath, existing);
}
/**
 * Tulis/upsert entri sigma ke .cursor/mcp.json di project root.
 * Format identik dengan .mcp.json (Cursor membaca mcpServers JSON yang sama).
 * Merge-aware: entri server lain dipertahankan.
 */
function writeCursorMcpConfig(projectRoot) {
    const filePath = path_1.default.join(projectRoot, '.cursor', 'mcp.json');
    const existing = readJsonSafe(filePath);
    if (!existing.mcpServers || typeof existing.mcpServers !== 'object' || Array.isArray(existing.mcpServers)) {
        existing.mcpServers = {};
    }
    existing.mcpServers.sigma = SIGMA_MCP_ENTRY;
    writeJsonSafe(filePath, existing);
}
// ── Stage 3: Global-scoped (ditulis di setup install / update) ────────────────
/**
 * Upsert entri sigma ke ~/.codex/config.toml (global Codex config).
 * Bagian: [mcp_servers.sigma]
 * Merge-aware: setting Codex lain (non-mcp_servers) dipertahankan utuh.
 *
 * Format TOML yang dihasilkan di bagian sigma:
 *   [mcp_servers.sigma]
 *   command = "sigma-mcp"
 *   args = []
 */
function writeCodexMcpConfig() {
    const filePath = path_1.default.join(os_1.default.homedir(), '.codex', 'config.toml');
    let parsed = {};
    if (fs_extra_1.default.existsSync(filePath)) {
        try {
            const raw = fs_extra_1.default.readFileSync(filePath, 'utf-8');
            parsed = (0, smol_toml_1.parse)(raw);
        }
        catch {
            // Kalau parse gagal, pertahankan parsed = {} dan overwrite
            // (file corrupt — lebih baik reset section ini daripada biarkan rusak)
        }
    }
    // Pastikan mcp_servers ada sebagai tabel
    if (!parsed.mcp_servers || typeof parsed.mcp_servers !== 'object' || Array.isArray(parsed.mcp_servers)) {
        parsed.mcp_servers = {};
    }
    const mcpServers = parsed.mcp_servers;
    mcpServers.sigma = { command: 'sigma-mcp', args: [] };
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(filePath));
    fs_extra_1.default.writeFileSync(filePath, (0, smol_toml_1.stringify)(parsed), 'utf-8');
}
/**
 * Upsert entri sigma ke ~/.gemini/config/mcp_config.json (global Antigravity config).
 * Format: { "mcpServers": { "sigma": { "command": "sigma-mcp", "args": [] } } }
 * Merge-aware: server MCP lain milik pengguna dipertahankan.
 */
function writeAntigravityMcpConfig() {
    const filePath = path_1.default.join(os_1.default.homedir(), '.gemini', 'config', 'mcp_config.json');
    const existing = readJsonSafe(filePath);
    if (!existing.mcpServers || typeof existing.mcpServers !== 'object' || Array.isArray(existing.mcpServers)) {
        existing.mcpServers = {};
    }
    existing.mcpServers.sigma = SIGMA_MCP_ENTRY;
    writeJsonSafe(filePath, existing);
}
// ── Stage 8: Uninstall cleanup ────────────────────────────────────────────────
/**
 * Hapus key "sigma" dari [mcp_servers] di ~/.codex/config.toml.
 * No-op kalau file tidak ada atau key tidak ada.
 * Sisa konten file (setting Codex lain) dipertahankan utuh.
 */
function removeCodexMcpConfig() {
    const filePath = path_1.default.join(os_1.default.homedir(), '.codex', 'config.toml');
    if (!fs_extra_1.default.existsSync(filePath))
        return;
    let parsed;
    try {
        const raw = fs_extra_1.default.readFileSync(filePath, 'utf-8');
        parsed = (0, smol_toml_1.parse)(raw);
    }
    catch {
        return; // File corrupt — jangan sentuh
    }
    const mcpServers = parsed.mcp_servers;
    if (!mcpServers || typeof mcpServers !== 'object' || Array.isArray(mcpServers))
        return;
    const servers = mcpServers;
    if (!Object.prototype.hasOwnProperty.call(servers, 'sigma'))
        return;
    delete servers.sigma;
    // Kalau mcp_servers sekarang kosong, hapus juga key-nya supaya file bersih
    if (Object.keys(servers).length === 0) {
        delete parsed.mcp_servers;
    }
    fs_extra_1.default.writeFileSync(filePath, (0, smol_toml_1.stringify)(parsed), 'utf-8');
}
/**
 * Hapus key "sigma" dari mcpServers di ~/.gemini/config/mcp_config.json.
 * No-op kalau file tidak ada atau key tidak ada.
 * Sisa server MCP lain milik pengguna dipertahankan utuh.
 */
function removeAntigravityMcpConfig() {
    const filePath = path_1.default.join(os_1.default.homedir(), '.gemini', 'config', 'mcp_config.json');
    if (!fs_extra_1.default.existsSync(filePath))
        return;
    const existing = readJsonSafe(filePath);
    const mcpServers = existing.mcpServers;
    if (!mcpServers || typeof mcpServers !== 'object' || Array.isArray(mcpServers))
        return;
    const servers = mcpServers;
    if (!Object.prototype.hasOwnProperty.call(servers, 'sigma'))
        return;
    delete servers.sigma;
    // Kalau mcpServers sekarang kosong, hapus juga key-nya
    if (Object.keys(servers).length === 0) {
        delete existing.mcpServers;
    }
    writeJsonSafe(filePath, existing);
}
// ── Stage 4: PATH check helper ────────────────────────────────────────────────
/**
 * Cek apakah "sigma-mcp" bisa di-resolve di PATH sistem saat ini.
 * Mengembalikan true kalau binary ditemukan, false kalau tidak.
 *
 * Dipakai untuk menampilkan warning (bukan error fatal) kalau pengguna
 * belum install sigma-mcp secara global saat menjalankan project start/sync
 * atau setup install/update.
 */
function isSigmaMcpResolvable() {
    const { execSync } = require('child_process');
    const isWindows = process.platform === 'win32';
    const checkCmd = isWindows ? 'where sigma-mcp' : 'which sigma-mcp';
    try {
        execSync(checkCmd, { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
// ── Fault-tolerant wrapper ────────────────────────────────────────────────────
/**
 * Jalankan operasi MCP (tulis atau hapus) dengan try-catch.
 * Kembalikan null kalau sukses, atau string pesan error kalau gagal.
 *
 * Dipakai di call site (setup.ts, project.ts) supaya kegagalan EPERM,
 * EACCES, atau file-locked-by-process tidak meng-crash command — caller
 * cukup `warn(errMsg)` kalau hasilnya bukan null.
 *
 * Contoh:
 *   const err = tryMcpOp(() => writeAntigravityMcpConfig(), '~/.gemini/config/mcp_config.json');
 *   if (err) warn(`MCP: ${err}`);
 *   else console.log('  MCP: ~/.gemini/config/mcp_config.json updated.');
 */
function tryMcpOp(op, targetLabel) {
    try {
        op();
        return null;
    }
    catch (e) {
        const err = e;
        const code = err.code ? ` [${err.code}]` : '';
        return `Could not write ${targetLabel}${code}: ${err.message ?? String(e)}. The file may be locked by another process (e.g. the AI client itself). Try again with the client closed, or add the entry manually.`;
    }
}
//# sourceMappingURL=mcpConfig.js.map