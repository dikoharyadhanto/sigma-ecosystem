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
/**
 * Tulis/upsert entri sigma ke .mcp.json di project root.
 * Format: { "mcpServers": { "sigma": { "command": "sigma-mcp", "args": [] } } }
 * Merge-aware: entri server lain dipertahankan.
 */
export declare function writeClaudeMcpConfig(projectRoot: string): void;
/**
 * Tulis/upsert entri sigma ke .cursor/mcp.json di project root.
 * Format identik dengan .mcp.json (Cursor membaca mcpServers JSON yang sama).
 * Merge-aware: entri server lain dipertahankan.
 */
export declare function writeCursorMcpConfig(projectRoot: string): void;
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
export declare function writeCodexMcpConfig(): void;
/**
 * Upsert entri sigma ke ~/.gemini/config/mcp_config.json (global Antigravity config).
 * Format: { "mcpServers": { "sigma": { "command": "sigma-mcp", "args": [] } } }
 * Merge-aware: server MCP lain milik pengguna dipertahankan.
 */
export declare function writeAntigravityMcpConfig(): void;
/**
 * Hapus key "sigma" dari [mcp_servers] di ~/.codex/config.toml.
 * No-op kalau file tidak ada atau key tidak ada.
 * Sisa konten file (setting Codex lain) dipertahankan utuh.
 */
export declare function removeCodexMcpConfig(): void;
/**
 * Hapus key "sigma" dari mcpServers di ~/.gemini/config/mcp_config.json.
 * No-op kalau file tidak ada atau key tidak ada.
 * Sisa server MCP lain milik pengguna dipertahankan utuh.
 */
export declare function removeAntigravityMcpConfig(): void;
/**
 * Cek apakah "sigma-mcp" bisa di-resolve di PATH sistem saat ini.
 * Mengembalikan true kalau binary ditemukan, false kalau tidak.
 *
 * Dipakai untuk menampilkan warning (bukan error fatal) kalau pengguna
 * belum install sigma-mcp secara global saat menjalankan project start/sync
 * atau setup install/update.
 */
export declare function isSigmaMcpResolvable(): boolean;
//# sourceMappingURL=mcpConfig.d.ts.map