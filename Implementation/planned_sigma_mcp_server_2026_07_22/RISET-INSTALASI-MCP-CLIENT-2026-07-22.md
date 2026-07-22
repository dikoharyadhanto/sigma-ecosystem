# Riset: Pemasangan MCP Server ke Antigravity, Codex, Reasonix, Claude Code, dan Cursor

**Tanggal riset**: 2026-07-22 (Cursor ditambahkan pada sesi lanjutan tanggal yang sama)
**Metode**: Web search + fetch dokumentasi resmi/primer. Asumsi versi **terbaru** tiap tool per tanggal riset.
**Tujuan**: Referensi konkret untuk menyambungkan `sigma-mcp` (server MCP native sigma-ecosystem, lihat `PLAN-IMPL-01`) ke masing-masing AI coding tool yang disebut di `AGENTS.md`/`CLAUDE.md`/`DEEPSEEK.md`/`GEMINI.md`/`REASONIX.md` proyek ini, ditambah Cursor sebagai IDE populer di luar daftar bridge file proyek ini.
**Catatan**: Ini dokumen riset murni — bukan plan implementasi, tidak mengubah kode apa pun.

---

## Ringkasan Cepat (tabel perbandingan)

| Tool | Lokasi config | Format | Cara tercepat |
|---|---|---|---|
| **Claude Code** | `.mcp.json` (project) / `~/.claude.json` (user/local) | JSON, key `mcpServers` | `claude mcp add <name> -- <command>` |
| **Codex CLI** | `~/.codex/config.toml` (global) / `.codex/config.toml` (project, trusted only) | TOML, tabel `[mcp_servers.<name>]` | `codex mcp add <name> -- <command>` |
| **Reasonix** | `reasonix.toml` (project/user) key `[[plugins]]`; juga baca `.mcp.json` apa adanya | TOML **atau** JSON (`.mcp.json` dipetakan otomatis) | Taruh `.mcp.json` di root proyek — langsung terbaca |
| **Antigravity (CLI/IDE)** | `~/.gemini/config/mcp_config.json` (shared/global) atau `.gemini/antigravity/mcp_config.json` (per-tool) | JSON, key `mcpServers` | Edit `mcp_config.json` lewat Settings → Customizations → Open MCP Config |
| **Cursor** | `.cursor/mcp.json` (project) / `~/.cursor/mcp.json` (global) | JSON, key `mcpServers` — **format identik Claude Code** | Settings → MCP/Tools & MCP → Add Custom MCP, atau edit `mcp.json` langsung |

Semua lima tool mendukung dua jenis transport yang relevan untuk `sigma-mcp`: **stdio** (proses lokal — ini yang dipakai `bin/sigma-mcp.js`) dan **HTTP/Streamable HTTP** (untuk server remote — tidak relevan untuk `sigma-mcp` karena dia stdio-only per desain PLAN-IMPL-01).

---

## 1. Claude Code

**Sumber**: [Connect to MCP servers — Claude Code Docs](https://code.claude.com/docs/en/mcp-quickstart)

### Cara pasang (CLI, direkomendasikan)

```bash
# stdio (proses lokal) — ini yang dipakai sigma-mcp
claude mcp add sigma -- node bin/sigma-mcp.js

# atau dengan scope eksplisit
claude mcp add --scope project sigma -- node bin/sigma-mcp.js   # dibagikan ke tim via .mcp.json
claude mcp add --scope user sigma -- node bin/sigma-mcp.js      # hanya untuk Anda, semua proyek
```

Perintah dijalankan di terminal biasa, **bukan** di dalam sesi `claude` yang sedang berjalan.

### Tiga scope & lokasi file

| Scope | File | Berlaku untuk |
|---|---|---|
| `local` (default) | `~/.claude.json`, di bawah entry proyek ini | Hanya Anda, hanya proyek ini |
| `project` | `.mcp.json` di root proyek | Semua orang yang clone proyek (commit ke git) |
| `user` | `~/.claude.json`, di bawah key `mcpServers` top-level | Hanya Anda, semua proyek |

Di Windows, `~/.claude.json` = `%USERPROFILE%\.claude.json`.

### Format `.mcp.json` (kalau ditulis manual)

```json
{
  "mcpServers": {
    "sigma": {
      "type": "stdio",
      "command": "node",
      "args": ["bin/sigma-mcp.js"]
    }
  }
}
```

### Verifikasi

```bash
claude mcp list          # cek status koneksi (di luar sesi)
```
Di dalam sesi: `/mcp` untuk lihat/reconnect/authenticate server.

Status yang mungkin muncul: `✔ Connected`, `! Needs authentication`, `✘ Failed to connect`, `⏸ Pending approval` (untuk server project-scope yang belum di-approve — perlu approve manual sekali saat pertama kali proyek dibuka).

### Catatan penting

- Server project-scope (`.mcp.json`) memicu prompt approval sekali saat teammate pertama kali membuka proyek — ini fitur keamanan, bukan bug.
- Troubleshooting umum: `Connection timed out at startup` → naikkan `MCP_TIMEOUT` (ms) kalau proses butuh waktu lama untuk boot; `Server connects but no tools appear` → biasanya env var yang dibutuhkan server belum di-set.
- Untuk `sigma-mcp` yang stdio murni tanpa env var wajib, seharusnya connect langsung tanpa hambatan.

---

## 2. Codex CLI (OpenAI)

**Sumber**: [Model Context Protocol — Codex | OpenAI Developers](https://developers.openai.com/codex/mcp)

### Cara pasang (CLI)

```bash
codex mcp add sigma -- node bin/sigma-mcp.js
```

Cek server aktif dari dalam TUI Codex: `/mcp`. Semua command MCP: `codex mcp --help`.

### Lokasi config

- Global: `~/.codex/config.toml`
- Project-scoped: `.codex/config.toml` — **hanya untuk trusted projects**

CLI dan IDE extension Codex **berbagi konfigurasi yang sama**, jadi sekali setup berlaku di kedua surface.

### Format `config.toml` (kalau ditulis manual)

```toml
[mcp_servers.sigma]
command = "node"
args = ["bin/sigma-mcp.js"]
# env, env_vars, cwd juga didukung untuk stdio server
```

Opsi tambahan yang relevan per tool:

| Field | Fungsi |
|---|---|
| `startup_timeout_sec` | Timeout boot server (default 10 detik) |
| `tool_timeout_sec` | Timeout tiap tool call (default 60 detik) |
| `enabled` | `false` untuk nonaktifkan tanpa hapus entry |
| `enabled_tools` / `disabled_tools` | Allow-list / deny-list tool |
| `default_tools_approval_mode` | `auto` \| `prompt` \| `approve` |

Untuk server HTTP/OAuth (tidak relevan untuk `sigma-mcp`, tapi dicatat untuk lengkap): `url`, `bearer_token_env_var`, `codex mcp login <server-name>`.

### Verifikasi

`/mcp` di dalam TUI menampilkan daftar server aktif.

---

## 3. Reasonix (DeepSeek-native coding agent)

**Sumber**: [Reasonix GUIDE.md](https://github.com/esengine/DeepSeek-Reasonix/blob/main-v2/docs/GUIDE.md) §Plugins (MCP)

Catatan koreksi dari riset awal: `~/.reasonix/config.json` yang disebut di beberapa artikel sekunder adalah path **lama** (pra-v1.8.1). Per dokumentasi resmi terkini, config utama Reasonix adalah `reasonix.toml`, dengan `config.json` lama hanya dibaca sebagai fallback prioritas-terendah untuk kompatibilitas mundur.

### Dua cara pasang — pilih salah satu

**Cara A — pakai `.mcp.json` yang sudah ada (paling cepat untuk proyek ini)**

Reasonix membaca `.mcp.json` di root proyek **apa adanya** — format sama persis dengan Claude Code:

```json
{
  "mcpServers": {
    "sigma": {
      "command": "node",
      "args": ["bin/sigma-mcp.js"]
    }
  }
}
```

Tidak perlu konversi manual. Reasonix memetakan `mcpServers` (`command`/`args`/`env`, `type`/`url`/`headers`, ekspansi `${VAR}`) ke `[[plugins]]` secara otomatis.

**Cara B — native `[[plugins]]` di `reasonix.toml`**

```toml
[[plugins]]
name    = "sigma"
command = "node"
args    = ["bin/sigma-mcp.js"]
```

`type` default adalah `stdio`. Untuk server HTTP (tidak relevan di sini): `type = "http"`, `url = "..."`, `headers = { Authorization = "Bearer ${TOKEN}" }`.

### Resolusi prioritas config

`flag > ./reasonix.toml > user config (~/.reasonix/config.toml atau %AppData%\reasonix\config.toml di Windows) > default bawaan`.

Kalau `.mcp.json` **dan** `[[plugins]]` di `reasonix.toml` sama-sama mendefinisikan server dengan nama sama, `reasonix.toml` menang.

### Bagaimana tool muncul ke model

Tool server muncul sebagai `mcp__<server>__<tool>` — jadi tool `sigma_get_state` akan muncul sebagai `mcp__sigma__sigma_get_state`. Prompt MCP (bila ada) muncul sebagai `/mcp__sigma__<prompt>`; resource lewat `@sigma:<uri>`.

### Verifikasi

- `/mcp` di sesi interaktif — daftar server terkoneksi + tool yang di-expose.
- Server enabled mulai connect otomatis di background segera setelah sesi dimulai (async, tidak memblokir chat).
- Panel MCP di desktop app: refresh status, reconnect, disable per sesi.

---

## 4. Antigravity (Google, CLI + IDE)

**Sumber**: [Configuring MCP Servers and Skills for Antigravity CLI and IDE (Medium, Google Cloud Community)](https://medium.com/google-cloud/configuring-mcp-servers-and-skills-for-antigravity-cli-and-ide-a938c7eebb78); [Google Cloud Docs — Use MCP servers](https://docs.cloud.google.com/data-cloud-extension/antigravity/use-mcp-servers)

Konteks penting: **Antigravity CLI menggantikan Gemini CLI** (Google mengumumkan transisi ini; Gemini CLI dihentikan untuk tier gratis/Pro/Ultra). Antigravity CLI, Antigravity IDE, dan Antigravity 2.0 (desktop) berbagi satu "agent harness" yang sama, sehingga bisa berbagi satu config MCP.

### Struktur folder `~/.gemini/` (nama folder tetap `.gemini` meski produknya "Antigravity")

```
.gemini
├── antigravity/
├── antigravity-cli/
│   ├── brain/            # riwayat percakapan
│   ├── mcp/              # auto-generated dari shared MCP config — jangan edit manual
│   └── settings.json
├── antigravity-ide/
│   ├── brain/
│   ├── mcp/              # auto-generated dari shared MCP config — jangan edit manual
│   └── plugins/
├── config/
│   ├── plugins/           # plugin shared/global
│   ├── projects/          # proyek yang sudah di-approve
│   └── mcp_config.json    # ← config MCP shared/global — edit di sini
├── skills/                 # skill shared/global
└── GEMINI.md
```

### Cara pasang — shared/global (berlaku di CLI + IDE + desktop sekaligus)

Edit langsung `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "sigma": {
      "command": "node",
      "args": ["bin/sigma-mcp.js"]
    }
  }
}
```

### Cara pasang — lewat UI Antigravity IDE

Settings → tab **Customizations** → tombol **Open MCP Config** → membuka `mcp_config.json` di editor.

### Cara pasang — per-tool (bukan shared)

Kalau hanya ingin aktif di satu tool: `.gemini/antigravity/mcp_config.json` (path berbeda dari config shared).

### Perbedaan format vs Claude Code/Codex/Reasonix — penting!

| Hal | Antigravity | Tool lain |
|---|---|---|
| Field URL server HTTP | **`serverUrl`** | `url` |
| Field timeout per-server | **tidak didukung** di top level | didukung di beberapa tool lain |
| Komentar inline dalam JSON | **tidak didukung** | — |
| Env var untuk stdio server | dilaporkan **bermasalah** di rilis saat artikel ditulis (Mei 2026) — kredensial harus di-hardcode sementara sebagai workaround | umumnya bekerja normal |

Untuk `sigma-mcp` (stdio, tanpa env var wajib) masalah env var di atas **tidak relevan** — cukup `command`+`args` seperti contoh di atas.

### Verifikasi

- CLI: tanya langsung ke agent, mis. "MCP servers apa yang kita punya?" — Antigravity CLI akan melaporkan server yang terkoneksi.
- IDE: sama, tanya ke agent chat di dalam IDE; artikel sumber mengonfirmasi config yang sama otomatis terdeteksi di kedua surface tanpa setup ganda.

---

## 5. Cursor

**Sumber**: [Connect Cursor to an MCP Server — liblab docs](https://liblab.com/docs/mcp/howto-connect-mcp-to-cursor); ringkasan hasil web search atas beberapa panduan pihak ketiga 2026 (TrueFoundry, Fastio, NxCode, dll.) karena `docs.cursor.com/context/mcp` adalah halaman client-rendered — fetch langsung hanya mengembalikan shell JS tanpa konten.

### Lokasi config

| Scope | File |
|---|---|
| Project | `.cursor/mcp.json` di root proyek |
| Global | `~/.cursor/mcp.json` (Windows: `%USERPROFILE%\.cursor\mcp.json`) |

Cursor memuat **kedua** file dan menggabungkan (merge) daftar server dari keduanya.

### Format `mcp.json` — identik dengan Claude Code

```json
{
  "mcpServers": {
    "sigma": {
      "command": "node",
      "args": ["bin/sigma-mcp.js"]
    }
  }
}
```

Root object tetap `mcpServers`; tiap key adalah nama yang ditampilkan Cursor untuk server tersebut. Karena bentuknya sama persis dengan `.mcp.json` Claude Code (dan yang dibaca apa adanya oleh Reasonix), **satu file yang sama bisa dipakai ulang untuk ketiga tool** — tinggal ditaruh di `.cursor/mcp.json` (atau symlink/copy dari `.mcp.json` proyek ini).

### Cara pasang lewat UI

Menu tepatnya bervariasi antar versi Cursor (dokumentasi pihak ketiga tidak konsisten satu sama lain — indikasi UI berubah antar rilis):

- **Cmd/Ctrl + ,** (buka Settings) → **Features → MCP** → **+ Add New MCP Server**, **atau**
- Settings → **Tools & MCP** → expand server untuk toggle tool individual, **atau**
- Settings → **Developer → Edit Config** → pilih **MCP Tools** → **Add Custom MCP** (membuka `mcp.json` langsung di editor)

Untuk `sigma-mcp`, cara paling stabil lintas versi adalah edit `mcp.json` langsung (tidak bergantung menu UI yang berubah-ubah).

### Batas jumlah tool — catatan penting untuk `sigma-mcp`

Sumber pihak ketiga tidak sepakat soal angka pastinya — sebagian menyebut batas **~40 tool**, sebagian lain **~80 tool** gabungan dari semua MCP server aktif. Kalau terlampaui, Cursor memperingatkan dan bisa jadi tidak mengirim semua tool ke agent (karena model performa menurun kalau diberi terlalu banyak tool sekaligus). `sigma-mcp` saat ini hanya mengekspos **5 tool inti** (lihat PLAN-IMPL-01), jadi jauh di bawah ambang manapun — tidak ada risiko di titik ini, tapi perlu diingat kalau nanti menambah tool `sigma_read_artifact`/`sigma_get_role_memory`/dll. di increment lanjutan sambil server MCP lain juga aktif di proyek yang sama.

### Verifikasi

Setelah menyimpan `mcp.json`, Cursor mem-fetch tool dari server dan menampilkannya di panel Settings → MCP/Tools & MCP sebagai indikasi koneksi berhasil. Kalau gagal, cara tercepat debug: salin persis command dari `mcp.json` (`node bin/sigma-mcp.js`) dan jalankan langsung di terminal untuk melihat error aslinya.

---

## Rekomendasi Penyambungan `sigma-mcp` (sintesis)

Untuk kelima tool, pola `command`/`args` identik secara konsep — hanya wadah (JSON vs TOML) dan lokasi file yang beda:

```
command = node
args    = ["bin/sigma-mcp.js"]
cwd     = <root sigma-ecosystem>   (pastikan proses start dari sini, karena
                                     findProjectRoot() di dalam tool
                                     mengandalkan cwd untuk resolusi proyek)
```

Urutan tercepat untuk mencoba kelimanya di proyek ini:

1. **Reasonix** — cukup pastikan `.mcp.json` ada di root proyek (format sudah identik dengan Claude Code); tidak perlu langkah tambahan.
2. **Claude Code** — `.mcp.json` yang sama persis dipakai ulang (format field-nya sama: `command`/`args`). Tinggal jalankan `claude mcp add --scope project sigma -- node bin/sigma-mcp.js` sekali, atau commit `.mcp.json` manual.
3. **Cursor** — juga `mcpServers`/`command`/`args` identik; taruh salinan (atau symlink) file yang sama di `.cursor/mcp.json`.
4. **Codex CLI** — beda wadah (TOML), tapi field yang sama: `codex mcp add sigma -- node bin/sigma-mcp.js`.
5. **Antigravity** — beda wadah (JSON terpisah `mcp_config.json`, bukan `.mcp.json`) dan field HTTP berbeda (`serverUrl`), tapi untuk stdio field-nya sama (`command`/`args`) — tinggal salin blok `sigma` ke `~/.gemini/config/mcp_config.json`.

**Satu file `.mcp.json` di root proyek ini otomatis melayani tiga dari lima tool (Reasonix + Claude Code + Cursor, lewat `.cursor/mcp.json`) tanpa perubahan format apa pun.** Codex dan Antigravity butuh entry terpisah karena format wadah berbeda (TOML dan file config Antigravity sendiri), tapi isinya (`command`, `args`) bisa disalin langsung dari `.mcp.json` yang sama.

### Catatan tambahan untuk Cursor secara spesifik

Karena Cursor sering dipakai berdampingan dengan banyak MCP server lain (linter, browser, database, dst.), perhatikan batas jumlah tool gabungan (§5) saat memutuskan berapa banyak tool `sigma_*` yang diaktifkan sekaligus di proyek yang sama dengan server lain — 5 tool inti saat ini masih sangat aman.

---

## Sumber

- [Connect to MCP servers — Claude Code Docs](https://code.claude.com/docs/en/mcp-quickstart)
- [Model Context Protocol — Codex | OpenAI Developers](https://developers.openai.com/codex/mcp)
- [Reasonix GUIDE.md — esengine/DeepSeek-Reasonix (main-v2)](https://github.com/esengine/DeepSeek-Reasonix/blob/main-v2/docs/GUIDE.md)
- [Configuring MCP Servers and Skills for Antigravity CLI and IDE — Dazbo, Google Cloud Community (Medium)](https://medium.com/google-cloud/configuring-mcp-servers-and-skills-for-antigravity-cli-and-ide-a938c7eebb78)
- [Use MCP servers — Google Cloud Data Agent Kit extension for Antigravity IDE](https://docs.cloud.google.com/data-cloud-extension/antigravity/use-mcp-servers)
- [An important update: Transitioning Gemini CLI to Antigravity CLI — Google Developers Blog](https://developers.googleblog.com/en/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)
- [Connect Cursor to an MCP Server — liblab docs](https://liblab.com/docs/mcp/howto-connect-mcp-to-cursor)
- [MCP Servers in Cursor: Setup, Configuration, and Security (2026 Guide) — TrueFoundry](https://www.truefoundry.com/blog/mcp-servers-in-cursor-setup-configuration-and-security-guide)
- [Cursor MCP Server Setup - Step-by-Step Guide (2026) — Fastio](https://fast.io/resources/cursor-mcp-server-setup/)
- [Cursor MCP Servers July 2026: Setup, Security and Best Practices — NxCode](https://www.nxcode.io/resources/news/cursor-mcp-servers-complete-guide-2026)

**Catatan sumber Cursor**: `docs.cursor.com/context/mcp` (dokumentasi resmi) adalah halaman client-rendered — percobaan fetch langsung hanya mengembalikan shell JavaScript tanpa konten terbaca. Bagian §5 di atas disusun dari beberapa sumber pihak ketiga yang saling menguatkan pada struktur `mcp.json`/lokasi file, tapi **berbeda pendapat** soal detail UI (nama menu berubah antar versi) dan angka pasti batas jumlah tool (40 vs 80). Director disarankan memverifikasi langsung di Settings Cursor miliknya sebelum dianggap final.
