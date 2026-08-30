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
/**
 * Tulis/upsert entri sigma ke .mcp.json di project root.
 * Format: { "mcpServers": { "sigma": { "command": "sigma-mcp", "args": [projectRoot] } } }
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
 */
export declare function writeCodexMcpConfig(projectRoot?: string): void;
/**
 * Upsert entri sigma ke ~/.gemini/config/mcp_config.json (global Antigravity config).
 * Format: { "mcpServers": { "sigma": { "command": "sigma-mcp", "args": [projectRoot] } } }
 * Merge-aware: server MCP lain milik pengguna dipertahankan.
 */
export declare function writeAntigravityMcpConfig(projectRoot?: string): void;
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
export declare function writeReasonixMcpConfig(projectRoot?: string): void;
/**
 * Hapus blok `[[plugins]]` dengan `name = "sigma"` dari ~/.reasonix/config.toml.
 * No-op kalau file atau blok tidak ada.
 * Sisa file (plugin lain, komentar, section lain) dipertahankan byte-identik.
 */
export declare function removeReasonixMcpConfig(): void;
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
export declare function tryMcpOp(op: () => void, targetLabel: string): string | null;
//# sourceMappingURL=mcpConfig.d.ts.map