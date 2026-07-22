# planned_sigma_mcp_server_2026_07_22

**Tanggal**: 2026-07-22
**Status**: DRAFT — sketsa awal untuk direview Director, belum final.
**Penyusun**: Professional Mode (default). Bukan FMN-PLAN Sigma; tidak punya otoritas lock/gate Sigma.
**Pemicu**: Director bermaksud membangun **native MCP server** untuk sigma-ecosystem, dipandu skill `mcp-builder`.

---

## Inti

Folder ini merencanakan sebuah **native MCP server** (`sigma-mcp`) yang
mengekspos state governance Sigma sebagai *tool* MCP terstruktur, sehingga AI
client (Claude Code, Cowork, dll.) bisa mengorientasi diri di dalam siklus
Sigma **tanpa** harus menjalankan command CLI lalu mem-parsing teks stdout.

Prinsip yang dipegang sama seperti roadmap MCP lama: **CLI tetap otoritas
operasional**. MCP hanya lapisan akses AI-native di atas engine yang sudah ada.

```text
AI client
  -> sigma-mcp (MCP server, stdio)
  -> src/engine/* (dibaca langsung untuk read-only)
  -> sigma CLI (subprocess, untuk write/gate-enforced)
  -> runtime state & artifacts Sigma
```

---

## Isi folder

| Berkas | Isi |
|---|---|
| `README.md` | Dokumen ini — orientasi + hubungan dengan rencana MCP lama. |
| `PLAN-EVAL-01-NATIVE-MCP-SERVER-READ-ONLY.md` | Rencana increment pertama (level konsep): server stdio + tool read-only, diselaraskan ke best-practice `mcp-builder`. **Accepted Director 2026-07-22.** |
| `PLAN-IMPL-01-NATIVE-MCP-SERVER-BUILD.md` | Rencana implementasi terperinci: peta berkas, signature fungsi, refactor `runBootstrap`, test fixture, langkah build/verifikasi. Turunan PLAN-EVAL-01. |
| `PLAN-EVAL-02-GOVERNANCE-DOC-PROPAGATION.md` | Increment lanjutan (Milestone C yang disebut PLAN-EVAL-01): audit + rencana update dokumentasi governance (role rules, bridge files, skill, README) sekarang `sigma-mcp` resmi dipakai. **Selesai dieksekusi 2026-07-22** — 6 stage, ~18 file, `npm test` 227/227 lulus. Lihat "Catatan Eksekusi" di dokumen untuk temuan tambahan (dangling reference `sigma refresh`, command usang `REASONIX.md`). |
| `RISET-INSTALASI-MCP-CLIENT-2026-07-22.md` | Riset murni (bukan plan): format registrasi MCP terverifikasi untuk **kelima platform** — Claude Code, Codex CLI, Reasonix, Antigravity, Cursor (ditambahkan di sesi lanjutan tanggal yang sama) — dasar teknis PLAN-EVAL-03. |
| `PLAN-EVAL-03-MCP-SETUP-INSTALLATION-WIRING.md` | Wiring agar `sigma-mcp` otomatis terdaftar ke AI client — project-scoped (`.mcp.json` + `.cursor/mcp.json`, via `project start`/`project sync`) untuk Claude Code+Reasonix+Cursor, global-scoped (`~/.codex/config.toml`, `~/.gemini/config/mcp_config.json`, via `setup install`/`setup update`) untuk Codex+Antigravity. Menulis ulang mekanisme yang dihapus `PLAN-EVAL-07-MCP-LEGACY-REMOVAL.md` — Director mengonfirmasi PLAN-EVAL-07 usang untuk bagian ini. Kelima platform tercakup. **Riset sudah diserap; 2 rekomendasi baru (Codex global, dependency TOML) menunggu konfirmasi Director sebelum eksekusi.** |

---

## Hubungan dengan rencana MCP sebelumnya

Sudah ada dua dokumen MCP di repo yang **wajib dibaca lebih dulu**:

- `Implementation/sigma_mcp_roadmap_dev.md` (2026-06-10) — roadmap direksional
  berlapis (Layer 1 read-only → Layer 3 gated write). **Masih relevan** sebagai
  arah strategis; PLAN-EVAL-01 mengambil Layer 1 sebagai scope.
- `Implementation/planned_mcp_dev/PLAN-MCP-1.md` (2026-07-03) — rencana konkret
  Milestone A/B. **Sebagian sudah usang**: dokumen itu merujuk
  `src/engine/progress.ts`, `readProgress`, dan tipe `ProgressJson`, padahal
  modul itu **sudah tidak ada** — sudah dimigrasikan ke `src/engine/chain.ts`
  (tipe `ChainState`, fungsi `readActiveChain`/`readChain`,
  `getGateStatus(chain)`) sejak kerja PLAN-EVAL-01 Fase 2. Lihat komentar di
  `src/commands/intent.ts:29-31`.

PLAN-EVAL-01 di folder ini **memperbarui** PLAN-MCP-1 ke API terkini dan
menambahkan hal yang belum dibahas PLAN-MCP-1: konvensi penamaan tool
(snake_case per best-practice `mcp-builder`, bukan dot-notation), anotasi tool,
dan strategi write-command lewat subprocess CLI.

---

## Keputusan Director (tercatat 2026-07-22)

Kelima keputusan sudah diputuskan mengikuti rekomendasi. Detail di bagian
"Keputusan Director Tercatat" PLAN-EVAL-01.

1. **Penamaan tool** — snake_case (`sigma_get_state`). ✓
2. **PLAN-MCP-1** — di-*supersede* oleh PLAN-EVAL-01. ✓
3. **`sigma_check`** — ditunda ke Layer 2; increment pertama nol subprocess. ✓
4. **Dependency** — `@modelcontextprotocol/sdk` + `zod` disetujui. ✓
5. **Cakupan tool** — mulai dari 5 tool inti; 4 sisanya di increment lanjutan. ✓
