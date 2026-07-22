/**
 * mcpConfig.ts — Wiring sigma-mcp ke AI client configs
 *
 * Menyediakan fungsi tulis dan hapus config MCP untuk kelima platform:
 *   Tulis  : writeClaudeMcpConfig, writeCursorMcpConfig,
 *            writeCodexMcpConfig, writeAntigravityMcpConfig
 *   Hapus  : removeCodexMcpConfig, removeAntigravityMcpConfig
 *
 * Prinsip desain:
 *   - Native-only: hanya mendaftarkan sigma-mcp, tidak membangkitkan server lain
 *   - Merge-aware: membaca file existing terlebih dulu, upsert key "sigma" saja
 *   - Idempoten: dipanggil dua kali menghasilkan file yang sama
 *   - Non-destruktif: entri MCP server lain milik pengguna tidak terhapus
 *   - Fungsi hapus: no-op kalau file/key tidak ada; merge-delete kalau ada
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { parse as parseTOML, stringify as stringifyTOML } from 'smol-toml';

// ── Payload sigma-mcp ─────────────────────────────────────────────────────────

/** Entri sigma-mcp yang ditulis ke semua config. command = "sigma-mcp" (bare,
 *  asumsi global install — resolvable via PATH). */
const SIGMA_MCP_ENTRY = {
  command: 'sigma-mcp',
  args: [] as string[],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Baca JSON dari path; kembalikan {} kalau file tidak ada atau parse gagal. */
function readJsonSafe(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readJsonSync(filePath) as unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

/** Tulis JSON ke path; buat direktori parent bila perlu. */
function writeJsonSafe(filePath: string, data: Record<string, unknown>): void {
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeJsonSync(filePath, data, { spaces: 2 });
}

// ── Stage 2: Project-scoped (ditulis di project start / sync) ─────────────────

/**
 * Tulis/upsert entri sigma ke .mcp.json di project root.
 * Format: { "mcpServers": { "sigma": { "command": "sigma-mcp", "args": [] } } }
 * Merge-aware: entri server lain dipertahankan.
 */
export function writeClaudeMcpConfig(projectRoot: string): void {
  const filePath = path.join(projectRoot, '.mcp.json');
  const existing = readJsonSafe(filePath);

  if (!existing.mcpServers || typeof existing.mcpServers !== 'object' || Array.isArray(existing.mcpServers)) {
    existing.mcpServers = {};
  }
  (existing.mcpServers as Record<string, unknown>).sigma = SIGMA_MCP_ENTRY;

  writeJsonSafe(filePath, existing);
}

/**
 * Tulis/upsert entri sigma ke .cursor/mcp.json di project root.
 * Format identik dengan .mcp.json (Cursor membaca mcpServers JSON yang sama).
 * Merge-aware: entri server lain dipertahankan.
 */
export function writeCursorMcpConfig(projectRoot: string): void {
  const filePath = path.join(projectRoot, '.cursor', 'mcp.json');
  const existing = readJsonSafe(filePath);

  if (!existing.mcpServers || typeof existing.mcpServers !== 'object' || Array.isArray(existing.mcpServers)) {
    existing.mcpServers = {};
  }
  (existing.mcpServers as Record<string, unknown>).sigma = SIGMA_MCP_ENTRY;

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
export function writeCodexMcpConfig(): void {
  const filePath = path.join(os.homedir(), '.codex', 'config.toml');

  let parsed: Record<string, unknown> = {};
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      parsed = parseTOML(raw) as Record<string, unknown>;
    } catch {
      // Kalau parse gagal, pertahankan parsed = {} dan overwrite
      // (file corrupt — lebih baik reset section ini daripada biarkan rusak)
    }
  }

  // Pastikan mcp_servers ada sebagai tabel
  if (!parsed.mcp_servers || typeof parsed.mcp_servers !== 'object' || Array.isArray(parsed.mcp_servers)) {
    parsed.mcp_servers = {};
  }
  const mcpServers = parsed.mcp_servers as Record<string, unknown>;
  mcpServers.sigma = { command: 'sigma-mcp', args: [] as string[] };

  fs.ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, stringifyTOML(parsed), 'utf-8');
}

/**
 * Upsert entri sigma ke ~/.gemini/config/mcp_config.json (global Antigravity config).
 * Format: { "mcpServers": { "sigma": { "command": "sigma-mcp", "args": [] } } }
 * Merge-aware: server MCP lain milik pengguna dipertahankan.
 */
export function writeAntigravityMcpConfig(): void {
  const filePath = path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
  const existing = readJsonSafe(filePath);

  if (!existing.mcpServers || typeof existing.mcpServers !== 'object' || Array.isArray(existing.mcpServers)) {
    existing.mcpServers = {};
  }
  (existing.mcpServers as Record<string, unknown>).sigma = SIGMA_MCP_ENTRY;

  writeJsonSafe(filePath, existing);
}

// ── Stage 8: Uninstall cleanup ────────────────────────────────────────────────

/**
 * Hapus key "sigma" dari [mcp_servers] di ~/.codex/config.toml.
 * No-op kalau file tidak ada atau key tidak ada.
 * Sisa konten file (setting Codex lain) dipertahankan utuh.
 */
export function removeCodexMcpConfig(): void {
  const filePath = path.join(os.homedir(), '.codex', 'config.toml');
  if (!fs.existsSync(filePath)) return;

  let parsed: Record<string, unknown>;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    parsed = parseTOML(raw) as Record<string, unknown>;
  } catch {
    return; // File corrupt — jangan sentuh
  }

  const mcpServers = parsed.mcp_servers;
  if (!mcpServers || typeof mcpServers !== 'object' || Array.isArray(mcpServers)) return;

  const servers = mcpServers as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(servers, 'sigma')) return;

  delete servers.sigma;

  // Kalau mcp_servers sekarang kosong, hapus juga key-nya supaya file bersih
  if (Object.keys(servers).length === 0) {
    delete parsed.mcp_servers;
  }

  fs.writeFileSync(filePath, stringifyTOML(parsed), 'utf-8');
}

/**
 * Hapus key "sigma" dari mcpServers di ~/.gemini/config/mcp_config.json.
 * No-op kalau file tidak ada atau key tidak ada.
 * Sisa server MCP lain milik pengguna dipertahankan utuh.
 */
export function removeAntigravityMcpConfig(): void {
  const filePath = path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
  if (!fs.existsSync(filePath)) return;

  const existing = readJsonSafe(filePath);
  const mcpServers = existing.mcpServers;
  if (!mcpServers || typeof mcpServers !== 'object' || Array.isArray(mcpServers)) return;

  const servers = mcpServers as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(servers, 'sigma')) return;

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
export function isSigmaMcpResolvable(): boolean {
  const { execSync } = require('child_process') as typeof import('child_process');
  const isWindows = process.platform === 'win32';
  const checkCmd = isWindows ? 'where sigma-mcp' : 'which sigma-mcp';
  try {
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
