"use strict";
/**
 * mcpConfig.ts — Wiring sigma-mcp ke AI client configs
 *
 * Menyediakan fungsi tulis dan hapus config MCP untuk platform yang didukung:
 *   Tulis  : writeClaudeMcpConfig, writeOpencodeMcpConfig,
 *            writeCodexMcpConfig, writeAntigravityMcpConfig, writeReasonixMcpConfig
 *   Hapus  : removeCodexMcpConfig, removeAntigravityMcpConfig, removeReasonixMcpConfig,
 *            removeOpencodeMcpConfig
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
exports.McpManualEditRequired = void 0;
exports.writeClaudeMcpConfig = writeClaudeMcpConfig;
exports.resolveOpencodeConfigPath = resolveOpencodeConfigPath;
exports.writeOpencodeMcpConfig = writeOpencodeMcpConfig;
exports.removeOpencodeMcpConfig = removeOpencodeMcpConfig;
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
const jsonc_parser_1 = require("jsonc-parser");
const fs_1 = require("./fs");
const config_1 = require("../config");
// ── Payload sigma-mcp ─────────────────────────────────────────────────────────
/** Helper untuk membuat entri config sigma-mcp.
 *
 *  PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §7.1/§7.4 — bentuk argumen berubah
 *  dari posisional `[projectRoot]` menjadi flag eksplisit, supaya server dapat
 *  mengikat diri ke satu project DAN memverifikasi identitasnya:
 *
 *    lama : { command: "sigma-mcp", args: ["C:/proj"] }
 *    baru : { command: "sigma-mcp", args: ["--mode","query",
 *                                         "--project-root","C:/proj",
 *                                         "--project-id","ABC"] }
 *
 *  Bentuk lama tetap dipahami server (binding tanpa verifikasi identity), jadi
 *  config yang sudah terpasang tidak putus; migrasi terjadi saat `sigma project
 *  sync` berikutnya, bukan otomatis.
 *
 *  project_id dibaca langsung dari .sigma-identity.json agar seluruh call site
 *  lama tidak perlu berubah. Bila identity belum ada — mis. dipanggil sebelum
 *  file itu ditulis — entri jatuh ke bentuk bound-tanpa-verifikasi, yang tetap
 *  mengunci root.
 */
function readProjectIdForBinding(projectRoot) {
    try {
        const raw = fs_extra_1.default.readJsonSync(path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE));
        return typeof raw.project_id === 'string' && raw.project_id.length > 0 ? raw.project_id : null;
    }
    catch {
        return null;
    }
}
function makeMcpEntry(projectRoot) {
    if (!projectRoot || typeof projectRoot !== 'string' || projectRoot.trim().length === 0) {
        // Global install: no project to bind to. Server starts in discovery mode.
        return { command: 'sigma-mcp', args: [] };
    }
    const root = projectRoot.trim();
    const args = ['--mode', 'query', '--project-root', root];
    const projectId = readProjectIdForBinding(root);
    if (projectId)
        args.push('--project-id', projectId);
    return { command: 'sigma-mcp', args };
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
 * Tulis teks ke path; buat direktori parent bila perlu.
 *
 * Memakai strategi write-to-temp + rename untuk menghindari EPERM pada
 * Windows ketika file target memiliki attribute Hidden (mis. mcp_config.json
 * yang dibuat oleh Antigravity). Node.js libuv tidak bisa membuka file Hidden
 * dengan flag O_TRUNC|O_CREAT, tapi replace via rename selalu berhasil.
 */
function writeTextSafe(filePath, text) {
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(filePath));
    const tmp = filePath + '.sigma_tmp';
    try {
        // Tulis ke file temp dulu (tidak pernah Hidden karena baru dibuat)
        fs_extra_1.default.writeFileSync(tmp, text, 'utf-8');
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
/** Tulis JSON polos (tanpa komentar) ke path secara atomik. */
function writeJsonSafe(filePath, data) {
    writeTextSafe(filePath, JSON.stringify(data, null, 2) + '\n');
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
/** Error yang pesannya sudah lengkap dan dipakai apa adanya oleh tryMcpOp —
 *  bukan kegagalan I/O, melainkan config yang sengaja tidak ditimpa. */
class McpManualEditRequired extends Error {
    constructor(message) {
        super(message);
        this.name = 'McpManualEditRequired';
    }
}
exports.McpManualEditRequired = McpManualEditRequired;
const OPENCODE_SCHEMA_URL = 'https://opencode.ai/config.json';
/**
 * Tentukan berkas config opencode proyek: `opencode.jsonc` bila ada, jika tidak
 * `opencode.json` (yang sudah ada, atau yang akan dibuat). opencode membaca dan
 * menggabungkan keduanya bila berdampingan; urutan prioritasnya tidak diuji
 * (F16 §4.1), jadi `.jsonc` dipilih mengikuti pengguna yang sudah memakainya.
 */
function resolveOpencodeConfigPath(projectRoot) {
    const jsonc = path_1.default.join(projectRoot, 'opencode.jsonc');
    if (fs_extra_1.default.existsSync(jsonc))
        return jsonc;
    return path_1.default.join(projectRoot, 'opencode.json');
}
/** Entri `mcp.sigma` untuk opencode: `command` berupa satu array (command + args). */
function makeOpencodeMcpEntry(projectRoot) {
    const { command, args } = makeMcpEntry(projectRoot);
    return { type: 'local', command: [command, ...args], enabled: true };
}
/** Baca config opencode (JSONC). Kembalikan null bila berkas tidak ada. Lempar
 *  McpManualEditRequired bila tidak dapat di-parse — berkas itu tidak boleh ditimpa. */
function readOpencodeConfig(filePath, manualHint) {
    if (!fs_extra_1.default.existsSync(filePath))
        return null;
    const raw = fs_extra_1.default.readFileSync(filePath, 'utf-8');
    const bom = raw.startsWith('﻿') ? '﻿' : '';
    const body = raw.slice(bom.length);
    const eol = body.includes('\r\n') ? '\r\n' : '\n';
    // Berkas kosong dianggap objek kosong (sama dengan readJsonSafe).
    const text = body.trim().length === 0 ? '{}' : body;
    const errors = [];
    const root = (0, jsonc_parser_1.parse)(text, errors, { allowTrailingComma: true });
    if (errors.length > 0 || !root || typeof root !== 'object' || Array.isArray(root)) {
        throw new McpManualEditRequired(`${filePath} could not be parsed as JSON/JSONC, so it was left unchanged. ${manualHint}`);
    }
    return { text, bom, eol, root: root };
}
function applyOpencodeEdit(text, eol, jsonPath, value) {
    const edits = (0, jsonc_parser_1.modify)(text, jsonPath, value, {
        formattingOptions: { insertSpaces: true, tabSize: 2, eol },
    });
    return (0, jsonc_parser_1.applyEdits)(text, edits);
}
/**
 * Upsert entri `mcp.sigma` ke config opencode di project root (F16 §5.3).
 * Format: { "mcp": { "sigma": { "type": "local", "command": ["sigma-mcp", ...], "enabled": true } } }
 *
 * Berbeda dari writeClaudeMcpConfig: config opencode boleh JSONC (komentar,
 * koma akhir), sehingga edit dilakukan secara surgical lewat jsonc-parser —
 * komentar, urutan key, dan server lain dipertahankan. jsonc-parser merapikan
 * (format ulang) baris sibling terakhir di titik sisip; isi dan baris lain tidak
 * berubah. Berkas yang tidak dapat di-parse TIDAK ditimpa
 * (McpManualEditRequired). Idempoten; ditulis atomik.
 */
function writeOpencodeMcpConfig(projectRoot) {
    const filePath = resolveOpencodeConfigPath(projectRoot);
    const entry = makeOpencodeMcpEntry(projectRoot);
    const parsed = readOpencodeConfig(filePath, `Add this under the top-level object manually:\n${JSON.stringify({ mcp: { sigma: entry } }, null, 2)}`);
    if (!parsed) {
        writeJsonSafe(filePath, { $schema: OPENCODE_SCHEMA_URL, mcp: { sigma: entry } });
        return;
    }
    const mcp = parsed.root.mcp;
    const mcpIsObject = !!mcp && typeof mcp === 'object' && !Array.isArray(mcp);
    // Sama dengan penulis lain: `mcp` yang bukan objek dianggap rusak dan diganti.
    const next = mcpIsObject
        ? applyOpencodeEdit(parsed.text, parsed.eol, ['mcp', 'sigma'], entry)
        : applyOpencodeEdit(parsed.text, parsed.eol, ['mcp'], { sigma: entry });
    if (next !== parsed.text)
        writeTextSafe(filePath, parsed.bom + next);
}
/**
 * Hapus key `mcp.sigma` dari config opencode di project root.
 * No-op kalau berkas atau key tidak ada. Berkas yang tidak dapat di-parse
 * tidak disentuh (McpManualEditRequired).
 */
function removeOpencodeMcpConfig(projectRoot) {
    const filePath = resolveOpencodeConfigPath(projectRoot);
    const parsed = readOpencodeConfig(filePath, 'Remove the "sigma" key under "mcp" manually.');
    if (!parsed)
        return;
    const mcp = parsed.root.mcp;
    if (!mcp || typeof mcp !== 'object' || Array.isArray(mcp))
        return;
    if (!Object.prototype.hasOwnProperty.call(mcp, 'sigma'))
        return;
    let next = applyOpencodeEdit(parsed.text, parsed.eol, ['mcp', 'sigma'], undefined);
    // Kosongkan juga `mcp` bila sigma satu-satunya isinya, supaya berkas bersih.
    if (Object.keys(mcp).length === 1) {
        next = applyOpencodeEdit(next, parsed.eol, ['mcp'], undefined);
    }
    writeTextSafe(filePath, parsed.bom + next);
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
    // Reviewer finding R-07: this built its own positional argument list while
    // makeMcpEntry() had already moved to binding flags, so `sigma project sync`
    // migrated every client except Reasonix — which stayed permanently on
    // binding_verified:false. One builder now feeds both.
    const entry = makeMcpEntry(projectRoot ? (0, fs_1.toPosix)(projectRoot.trim()) : undefined);
    const args = `[${entry.args.map((a) => JSON.stringify(a)).join(', ')}]`;
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
        if (e instanceof McpManualEditRequired)
            return e.message;
        const err = e;
        const code = err.code ? ` [${err.code}]` : '';
        return `Could not write ${targetLabel}${code}: ${err.message ?? String(e)}. The file may be locked by another process (e.g. the AI client itself). Try again with the client closed, or add the entry manually.`;
    }
}
//# sourceMappingURL=mcpConfig.js.map