# PLAN-EVAL-04 — Explicit Project Path Wiring for sigma-mcp

**Status**: PROPOSED  
**Tanggal**: 2026-07-22  
**Domain**: MCP Orientation Layer / CLI Wiring  

---

## Context & Motivation

Pada evaluasi lapangan dengan AI Client (seperti Antigravity/Gemini), ketika `sigma-mcp` dipanggil dari konfigurasi MCP global (`~/.gemini/config/mcp_config.json`), client men-spawn proses `sigma-mcp` dari direktori home user (`C:\Users\dikoh`) tanpa mewariskan `cwd` dari ruang kerja proyek (`i:\Works\Project\...`).

Akibatnya, `process.cwd()` pada proses `sigma-mcp` berada di luar proyek Sigma, sehingga tool MCP mengembalikan `{"active": false}`.

## Solution Design

1. Memperbarui fungsi generator konfigurasi MCP di `src/utils/mcpConfig.ts` agar menerima parameter `projectRoot?: string`.
2. Jika `projectRoot` disuplai:
   Payload `args` di-generate sebagai `[projectRoot]` (misal: `["i:/Works/Project/KLHK_JasaLingkunganHidup"]`).
3. Menghubungkan `writeClaudeMcpConfig(projectRoot)`, `writeCursorMcpConfig(projectRoot)`, `writeCodexMcpConfig(projectRoot)`, dan `writeAntigravityMcpConfig(projectRoot)` pada perintah:
   - `sigma project start`
   - `sigma project sync --confirm`
4. Dengan demikian, baik konfigurasi lokal (`.mcp.json`, `.cursor/mcp.json`) maupun konfigurasi global (`~/.codex/config.toml`, `~/.gemini/config/mcp_config.json`) secara otomatis memiliki argumen path proyek eksplisit.
