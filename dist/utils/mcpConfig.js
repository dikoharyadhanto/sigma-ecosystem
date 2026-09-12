"use strict";
/**
 * mcpConfig.ts — Wiring sigma-mcp ke AI client configs
 *
 * Menyediakan fungsi tulis dan hapus config MCP untuk platform yang didukung:
 *   Tulis  : writeClaudeMcpConfig, writeCursorMcpConfig,
 *            writeCodexMcpConfig, writeAntigravityMcpConfig, writeReasonixMcpConfig
 *   Hapus  : removeCodexMcpConfig, removeAntigravityMcpConfig, removeReasonixMcpConfig
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
 *
 * Catatan Reasonix: writeCodexMcpConfig dkk. memakai smol-toml (parse penuh →
 * mutate → stringify), yang aman untuk Codex karena config.toml-nya polos
 * tanpa komentar. ~/.reasonix/config.toml sebaliknya penuh komentar dokumentasi
 * yang harus dipertahankan, dan smol-toml membuang semua komentar saat
 * stringify — jadi writeReasonixMcpConfig/removeReasonixMcpConfig TIDAK
 * memakai parse+stringify penuh. Keduanya melakukan surgical text edit per
 * baris pada blok `[[plugins]]` yang name-nya "sigma" saja, sisa file
 * (komentar, plugin lain, section lain) tidak disentuh sama sekali.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeClaudeMcpConfig = writeClaudeMcpConfig;
exports.writeCursorMcpConfig = writeCursorMcpConfig;
exports.writeCodexMcpConfig = writeCodexMcpConfig;
exports.writeAntigravityMcpConfig = writeAntigravityMcpConfig;
exports.writeReasonixMcpConfig = writeReasonixMcpConfig;
exports.removeReasonixMcpConfig = removeReasonixMcpConfig;
exports.removeCodexMcpConfig = removeCodexMcpConfig;
exports.removeAntigravityMcpConfig = removeAntigravityMcpConfig;
exports.isSigmaMcpResolvable = isSigmaMcpResolvable;
exports.tryMcpOp = tryMcpOp;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const smol_toml_1 = require("smol-toml");
const fs_1 = require("./fs");
// ── Payload sigma-mcp ─────────────────────────────────────────────────────────
/** Helper untuk membuat entri config sigma-mcp.
 *  Jika projectRoot diberikan, masukkan ke args: [projectRoot]. */
function makeMcpEntry(projectRoot) {
    return {
        command: 'sigma-mcp',
        args: projectRoot && typeof projectRoot === 'string' && projectRoot.trim().length > 0
            ? [projectRoot.trim()]
            : [],
    };
}
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
/**
 * Tulis JSON ke path; buat direktori parent bila perlu.
 *
 * Memakai strategi write-to-temp + rename untuk menghindari EPERM pada
 * Windows ketika file target memiliki attribute Hidden (mis. mcp_config.json
 * yang dibuat oleh Antigravity). Node.js libuv tidak bisa membuka file Hidden
 * dengan flag O_TRUNC|O_CREAT, tapi replace via rename selalu berhasil.
 */
function writeJsonSafe(filePath, data) {
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(filePath));
    const json = JSON.stringify(data, null, 2) + '\n';
    const tmp = filePath + '.sigma_tmp';
    try {
        // Tulis ke file temp dulu (tidak pernah Hidden karena baru dibuat)
        fs_extra_1.default.writeFileSync(tmp, json, 'utf-8');
        // Rename/replace: aman bahkan untuk file Hidden di Windows
        fs_extra_1.default.renameSync(tmp, filePath);
    }
    catch (e) {
        // Cleanup tmp kalau rename gagal
        try {
            fs_extra_1.default.unlinkSync(tmp);
        }
        catch { /* ignore */ }
        throw e;
    }
}
// ── Stage 2: Project-scoped (ditulis di project start / sync) ─────────────────
/**
 * Tulis/upsert entri sigma ke .mcp.json di project root.
 * Format: { "mcpServers": { "sigma": { "command": "sigma-mcp", "args": [projectRoot] } } }
 * Merge-aware: entri server lain dipertahankan.
 */
function writeClaudeMcpConfig(projectRoot) {
    const filePath = path_1.default.join(projectRoot, '.mcp.json');
    const existing = readJsonSafe(filePath);
    if (!existing.mcpServers || typeof existing.mcpServers !== 'object' || Array.isArray(existing.mcpServers)) {
        existing.mcpServers = {};
    }
    existing.mcpServers.sigma = makeMcpEntry(projectRoot);
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
    existing.mcpServers.sigma = makeMcpEntry(projectRoot);
    writeJsonSafe(filePath, existing);
}
// ── Stage 3: Global-scoped (ditulis di setup install / update & project start / sync) ──
/**
 * Upsert entri sigma ke ~/.codex/config.toml (global Codex config).
 * Bagian: [mcp_servers.sigma]
 * Merge-aware: setting Codex lain (non-mcp_servers) dipertahankan utuh.
 */
function writeCodexMcpConfig(projectRoot) {
    const filePath = path_1.default.join(os_1.default.homedir(), '.codex', 'config.toml');
    let parsed = {};
    if (fs_extra_1.default.existsSync(filePath)) {
        try {
            const raw = fs_extra_1.default.readFileSync(filePath, 'utf-8');
            parsed = (0, smol_toml_1.parse)(raw);
        }
        catch {
            // Kalau parse gagal, pertahankan parsed = {} dan overwrite
        }
    }
    if (!parsed.mcp_servers || typeof parsed.mcp_servers !== 'object' || Array.isArray(parsed.mcp_servers)) {
        parsed.mcp_servers = {};
    }
    const mcpServers = parsed.mcp_servers;
    mcpServers.sigma = makeMcpEntry(projectRoot);
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(filePath));
    fs_extra_1.default.writeFileSync(filePath, (0, smol_toml_1.stringify)(parsed), 'utf-8');
}
/**
 * Upsert entri sigma ke ~/.gemini/config/mcp_config.json (global Antigravity config).
 * Format: { "mcpServers": { "sigma": { "command": "sigma-mcp", "args": [projectRoot] } } }
 * Merge-aware: server MCP lain milik pengguna dipertahankan.
 */
function writeAntigravityMcpConfig(projectRoot) {
    const filePath = path_1.default.join(os_1.default.homedir(), '.gemini', 'config', 'mcp_config.json');
    const existing = readJsonSafe(filePath);
    if (!existing.mcpServers || typeof existing.mcpServers !== 'object' || Array.isArray(existing.mcpServers)) {
        existing.mcpServers = {};
    }
    existing.mcpServers.sigma = makeMcpEntry(projectRoot);
    writeJsonSafe(filePath, existing);
}
/**
 * Cari rentang baris blok `[[pluginsTableName]]` (array-of-tables TOML) yang
 * punya `name = "<pluginName>"` persis (bukan prefix — "sigma" tidak boleh
 * ketemu di blok "sigma-memory"). Mengembalikan null kalau tidak ketemu.
 *
 * Batas blok: dari baris `[[pluginsTableName]]` sampai baris section/array-of-
 * tables berikutnya (`[...]` atau `[[...]]`), atau EOF kalau tidak ada lagi.
 */
function findPluginBlockRange(lines, pluginsTableName, pluginName) {
    const headerRe = new RegExp(`^\\[\\[${pluginsTableName}\\]\\]\\s*$`);
    const sectionRe = /^\[\[?[^\]]+\]\]?\s*$/;
    const nameLineRe = new RegExp(`^name\\s*=\\s*"${pluginName}"\\s*(#.*)?$`);
    for (let i = 0; i < lines.length; i++) {
        if (!headerRe.test(lines[i].trim()))
            continue;
        let end = lines.length;
        for (let j = i + 1; j < lines.length; j++) {
            if (sectionRe.test(lines[j].trim())) {
                end = j;
                break;
            }
        }
        const body = lines.slice(i + 1, end);
        if (body.some((l) => nameLineRe.test(l.trim()))) {
            return { start: i, end };
        }
    }
    return null;
}
/** Bentuk blok teks `[[plugins]]` untuk entri sigma-mcp milik Reasonix.
 *  projectRoot dinormalisasi ke forward slash lalu di-JSON-stringify: sebuah
 *  path Windows mentah (`C:\Users\...`) yang ditulis apa adanya membuat
 *  config.toml gagal parse ("invalid non-hex character in unicode escape" —
 *  `\U` bukan escape TOML yang valid), sehingga Reasonix kehilangan SEMUA
 *  plugin di file itu. Forward slash valid sebagai argumen path di Windows
 *  maupun POSIX, dan JSON.stringify menghasilkan literal string kutip-ganda
 *  yang sah untuk basic string TOML. */
function makeReasonixPluginBlockLines(projectRoot) {
    const args = projectRoot && projectRoot.trim().length > 0
        ? `[${JSON.stringify((0, fs_1.toPosix)(projectRoot.trim()))}]`
        : '[]';
    return [
        '[[plugins]]',
        'name    = "sigma"',
        'command = "sigma-mcp"',
        `args    = ${args}`,
    ];
}
/**
 * Upsert entri sigma ke ~/.reasonix/config.toml (global Reasonix config).
 * Bagian: `[[plugins]]` dengan `name = "sigma"`.
 *
 * Beda dari writeCodexMcpConfig: dilakukan sebagai surgical text edit
 * (lihat catatan Reasonix di header file), bukan parse+stringify TOML penuh,
 * supaya komentar dokumentasi di config.toml Reasonix tidak hilang.
 * Merge-aware: plugin lain (mis. "shell", "sequential-thinking") dan seluruh
 * konten lain file dipertahankan byte-identik.
 */
function writeReasonixMcpConfig(projectRoot) {
    const filePath = path_1.default.join(os_1.default.homedir(), '.reasonix', 'config.toml');
    const raw = fs_extra_1.default.existsSync(filePath) ? fs_extra_1.default.readFileSync(filePath, 'utf-8') : '';
    const lines = raw.length > 0 ? raw.split('\n') : [];
    const range = findPluginBlockRange(lines, 'plugins', 'sigma');
    const blockLines = makeReasonixPluginBlockLines(projectRoot);
    let next;
    if (range) {
        next = [...lines.slice(0, range.start), ...blockLines, ...lines.slice(range.end)];
    }
    else {
        const needsBlankSep = lines.length > 0 && lines[lines.length - 1].trim() !== '';
        next = [...lines, ...(needsBlankSep ? [''] : []), ...blockLines];
    }
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(filePath));
    fs_extra_1.default.writeFileSync(filePath, next.join('\n'), 'utf-8');
}
/**
 * Hapus blok `[[plugins]]` dengan `name = "sigma"` dari ~/.reasonix/config.toml.
 * No-op kalau file atau blok tidak ada.
 * Sisa file (plugin lain, komentar, section lain) dipertahankan byte-identik.
 */
function removeReasonixMcpConfig() {
    const filePath = path_1.default.join(os_1.default.homedir(), '.reasonix', 'config.toml');
    if (!fs_extra_1.default.existsSync(filePath))
        return;
    const raw = fs_extra_1.default.readFileSync(filePath, 'utf-8');
    const lines = raw.split('\n');
    const range = findPluginBlockRange(lines, 'plugins', 'sigma');
    if (!range)
        return;
    let { start } = range;
    const { end } = range;
    // Buang satu baris kosong sebelum blok (kalau ada) supaya tidak menumpuk baris kosong
    if (start > 0 && lines[start - 1].trim() === '')
        start -= 1;
    const next = [...lines.slice(0, start), ...lines.slice(end)];
    fs_extra_1.default.writeFileSync(filePath, next.join('\n'), 'utf-8');
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