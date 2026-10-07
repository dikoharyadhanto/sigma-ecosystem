# Evaluasi Integrasi Sigma ke OpenCode

- **Tanggal:** 2026-10-08
- **Status:** Dokumen advisory untuk review Director. Bukan artefak governance Sigma; tidak mengotorisasi implementasi apa pun.
- **Basis:** `sigma-ecosystem` v2.0.0 (working tree saat ini), dokumentasi resmi opencode (opencode.ai/docs, diakses 2026-10-08).
- **Ruang lingkup:** Analisis bagaimana mekanisme `setup/targets` Sigma (skill, bridge, hook, MCP) dapat diterapkan ke opencode sebagai target baru. Tanpa perubahan kode.
- **Penulis:** opencode (agent), atas permintaan Director.

### Konvensi label

| Label | Arti |
| :--- | :--- |
| **[FAKTA]** | Terverifikasi dari source code repo atau dokumentasi resmi, dengan rujukan. |
| **[INFERENSI]** | Kesimpulan penulis dari fakta; belum diuji di pemakaian nyata. |
| **[USULAN]** | Rekomendasi penulis; belum diputuskan. |

---

## 1. Ringkasan Eksekutif

[FAKTA] Sigma saat ini mendukung lima target AI: `claude_code`, `codex`, `reasonix`, `antigravity`, `cursor` (`src/commands/setup.ts:43-65`). Tidak ada satu pun referensi `opencode` di seluruh repo di luar `node_modules` (pencarian substring `opencode` pada semua `*.md`, `*.ts`, `*.json`, `*.js` — nol hasil).

[INFERENSI] Integrasi opencode sangat feasible dan tergolong rendah-risiko, karena opencode menyediakan padanan untuk setiap mekanisme yang Sigma pakai:

| Mekanisme Sigma | Padanan opencode | Kesulitan |
| :--- | :--- | :--- |
| Skill role (`/arc`, `/fmn`, `/dev`, `/aud`, dst.) | Custom commands (`~/.config/opencode/commands/*.md`) | Rendah |
| Role sebagai mode sesi | Primary agents (`~/.config/opencode/agents/*.md`) | Rendah |
| Bridge file (CLAUDE.md, AGENTS.md, dst.) | `AGENTS.md` project root (dibaca native oleh opencode) | Rendah, **tetapi ada konflik** — lihat §6.1 |
| Hook `protect-sigma.js` (PreToolUse) | Plugin `tool.execute.before` | Sedang |
| Registrasi `sigma-mcp` | Key `mcp` di `opencode.json` | Rendah, bentuk config berbeda — lihat §5.4 |

Titik kerja utama ada di tiga file sumber: `src/utils/detect.ts`, `src/commands/setup.ts`, `src/utils/mcpConfig.ts`, plus satu folder target baru `setup/targets/opencode/`.

---

## 2. Cara Kerja `setup/targets` Saat Ini

Semua di bawah ini [FAKTA], dirujuk ke file.

### 2.1 Deteksi platform

`src/utils/detect.ts:34-44` — `detectTools()` menguji keberadaan direktori home per platform:

| Platform | Syarat deteksi | Direktori target skill |
| :--- | :--- | :--- |
| `claudeCode` | `~/.claude/` ada | `~/.claude/commands/` |
| `codex` | `~/.codex/skills/` ada | `~/.codex/skills/` |
| `reasonix` | `~/.reasonix/` ada | `~/.reasonix/skills/` |
| `antigravity` | `~/.gemini/` ada | `~/.gemini/config/skills/` |
| `cursor` | `~/.cursor/rules/` ada | `~/.cursor/rules/` |

`detectTools()` dipanggil oleh `sigma setup install`, `sigma setup update`, dan `sigma setup uninstall`. Instalasi bersifat opt-in per platform lewat checkbox interaktif (atau `--yes` untuk semua yang terdeteksi).

### 2.2 Deployment skill

`src/commands/setup.ts:43-49` — tiga konstanta mengendalikan pemetaan:

- `ROLE_FILES`: nama file per platform per role.
- `PLATFORM_LABELS`: label tampilan.
- `PLATFORM_SOURCE_DIR`: subfolder sumber di `setup/targets/`.

Sembilan skill di-deploy per platform (delapan untuk semua, cursor hanya satu file rules):

`arc`, `fmn`, `dev`, `aud`, `report`, `sigma-test`, `humanize`, `write-memo`, `read-memo`.

Format kemasan berbeda per platform (`deploySkillsAndHook()`, `setup.ts:210-299`):

| Platform | Format |
| :--- | :--- |
| `claude_code` | File `.md` datar dengan frontmatter `name` + `description` → `~/.claude/commands/<role>.md` |
| `reasonix` | File `.md` datar, konten hampir identik dengan claude_code tetapi path/label disesuaikan (terverifikasi: `reasonix/sigma-test.md` berbeda dari `claude_code/sigma-test.md` pada path dan label platform) → `~/.reasonix/skills/<role>.md` |
| `codex` | Direktori per skill: `<role>/SKILL.md` + `<role>/agents/openai.yaml` (metadata UI: `display_name`, `short_description`, `default_prompt`) → `~/.codex/skills/` |
| `antigravity` | Direktori per skill: `sigma-<role>/SKILL.md` + `sigma-<role>/plugin.json`, plus update `manifest.json` (`status: installed`, `disabled: false`) → `~/.gemini/config/skills/` |
| `cursor` | Satu file `SIGMA.mdc` (frontmatter `alwaysApply: true`) → `~/.cursor/rules/` — bukan skill per role |

Installer menangani konflik tipe file-vs-direktori di tujuan (`setup.ts:243-250`) dan bersifat overwrite penuh untuk file milik Sigma.

### 2.3 Hook (khusus Claude Code)

`setup/targets/hooks/protect-sigma.js` — hook `PreToolUse` dengan matcher `Edit|Write`, didaftarkan ke `~/.claude/settings.json` oleh `deployHook()` (`setup.ts:303-361`). Hook memblokir edit/tulis langsung ke `Sigma/progress(-v\d+)?.json` dengan keluaran `decision: block`. Pendaftaran idempoten; uninstall menghapus hanya entri milik Sigma (`removeHookEntry`, `setup.ts:508-527`).

### 2.4 Bridge files

`src/config.ts:37` — `BRIDGE_STUBS = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md', 'DEEPSEEK.md', 'REASONIX.md']`.

Alurnya: `setup install` menyalin `setup/targets/bridge/` → `~/.sigma/bridge/`; `sigma project start` menulis kelima file ke root proyek (`src/commands/project.ts:393-409`, skip bila sudah ada kecuali `--overwrite-bridge`).

Isi bridge adalah *model directives*: lima mode operasional (Professional + ARC/FMN/DEV/AUD), immutability role per sesi, model operator CLI, bahasa otorisasi Director, larangan edit file CLI-managed. Perlu dicatat: **`AGENTS.md` versi bridge saat ini berisi direktif yang diberi label khusus "Codex Model Directives"** (`setup/targets/bridge/AGENTS.md:1-6`).

### 2.5 Registrasi MCP

`src/utils/mcpConfig.ts`. Dua lingkup:

**Global** (ditulis oleh `setup install` / `setup update`, tanpa binding proyek — server berjalan dalam *discovery mode*):

| Platform | File | Bentuk entri |
| :--- | :--- | :--- |
| Codex | `~/.codex/config.toml` | `[mcp_servers.sigma]` `command = "sigma-mcp"`, `args = []` (parse+stringify TOML penuh via smol-toml) |
| Antigravity | `~/.gemini/config/mcp_config.json` | `mcpServers.sigma = { command, args }` (JSON merge-aware) |
| Reasonix | `~/.reasonix/config.toml` | blok `[[plugins]]` `name = "sigma"` — **surgical text edit per baris**, bukan parse TOML, supaya komentar dokumentasi Reasonix tidak hilang (`mcpConfig.ts:19-26, 274-292`) |

**Proyek** (ditulis oleh `sigma project start` / `sigma project sync`, terikat ke proyek):

| Platform | File | Bentuk entri |
| :--- | :--- | :--- |
| Claude Code / Reasonix | `.mcp.json` di root proyek | `mcpServers.sigma = { command: "sigma-mcp", args: ["--mode","query","--project-root",<root>,"--project-id",<id>] }` |
| Cursor | `.cursor/mcp.json` | identik dengan `.mcp.json` |

Selain itu `project start`/`sync` **juga** menulis ulang config global Codex dan Antigravity **dengan** `projectRoot` terikat (`project.ts:415-438, 591-614`) — jadi entri global ikut ter-binding ke proyek terakhir yang di-sync.

Semua penulisan bersifat merge-aware (hanya upsert/hapus key `sigma`), idempoten, dan fault-tolerant via `tryMcpOp()` — kegagalan tulis menjadi warning, bukan crash. `project_id` untuk binding dibaca dari `.sigma-identity.json` (`mcpConfig.ts:58-65`); bila belum ada, entri jatuh ke bentuk bound-tanpa-verifikasi. Uninstall global menghapus key `sigma` dari tiga config global; file proyek (`.mcp.json`, `.cursor/mcp.json`) sengaja tidak disentuh (`setup.ts:623-624`).

### 2.6 Dua server MCP

[FAKTA] Paket mendistribusikan tiga bin (`package.json:6-10`): `sigma`, `sigma-mcp` (query, read-only, 23 tool), dan `sigma-control` (bounded write, 29 tool: 9 write langsung + 10 pasang `prepare`/`commit`). Setup hanya mendaftarkan query server; control server butuh registrasi manual dengan `--project-root`, `--project-id`, `--role` (README §Sigma MCP). Transisi governance lewat control server tetap mensyaratkan approval Director lewat `sigma control approve <ticketId> --director-confirm` — tool MCP tidak bisa memberi approval sendiri.

---

## 3. Konvensi opencode (terverifikasi)

[FAKTA] Dari dokumentasi resmi opencode (opencode.ai/docs/{config,agents,commands,rules,skills,mcp-servers,plugins}):

1. **Config.** JSON/JSONC. Global: `~/.config/opencode/opencode.json`. Proyek: `opencode.json` di root proyek (atau `.opencode/opencode.json`). Precedence: remote org < global < proyek. Subdirektori memakai bentuk jamak: `agents/`, `commands/`, `plugins/`, `skills/`, dll.
2. **Rules.** opencode membaca `AGENTS.md` di root proyek (rules proyek) dan `~/.config/opencode/AGENTS.md` (global). **Kompatibilitas Claude Code:** bila `AGENTS.md` tidak ada, opencode jatuh ke `CLAUDE.md` (proyek) lalu `~/.claude/CLAUDE.md` (global). File instruksi tambahan bisa dirujuk lewat array `instructions` di `opencode.json`.
3. **Agents.** File markdown di `~/.config/opencode/agents/` (global) atau `.opencode/agents/` (proyek). Nama file = nama agent. Frontmatter: `description` (wajib), `mode` (`primary` | `subagent` | `all`), `model`, `temperature`, `permission`, dll. Primary agents diganti dengan Tab; subagent dipanggil via `@mention` atau Task tool.
4. **Commands.** File markdown di `~/.config/opencode/commands/` atau `.opencode/commands/`. Frontmatter: `description`, opsional `agent` dan `model`. Body = template prompt (mendukung argumen `$1`, `$2`, … dan shell injection `` !`cmd` ``). Dipanggil sebagai `/<nama>`.
5. **Skills.** Direktori `.opencode/skills/<nama>/SKILL.md` (atau `.md` datar), global di `~/.config/opencode/skills/`. Dimuat otomatis berdasarkan relevansi (bukan slash command). opencode **juga** auto-discover `~/.claude/skills/` dan `~/.agents/skills/`.
6. **MCP.** Di `opencode.json`: `"mcp": { "<nama>": { "type": "local", "command": ["<bin>", "<arg1>", ...], "enabled": true } }`. Perhatikan: `command` adalah **array tunggal** (bukan pasangan `command`+`args` seperti `.mcp.json`).
7. **Plugins.** File JS/TS di `~/.config/opencode/plugins/` (global) atau `.opencode/plugins/` (proyek). Mengekspor fungsi yang mengembalikan hooks. Hook `tool.execute.before` menerima `input.tool` (nama tool lowercase, mis. `"edit"`, `"write"`, `"read"`) dan `output.args`; melempar `Error` dari hook ini **memblokir** eksekusi tool (contoh resmi: `.env protection`).

---

## 4. Pemetaan Komponen Sigma → opencode

### 4.1 Skill role → Commands (padanan paling dekat)

[FAKTA] Skill Sigma di claude_code adalah file `.md` datar berisi prompt role, ditempatkan di `~/.claude/commands/` dan dipanggil sebagai `/arc`, `/fmn`, dst. Model mentalnya persis *slash command*.

[FAKTA] opencode commands (`~/.config/opencode/commands/<nama>.md`) adalah padanan satu-satu: file markdown dengan frontmatter `description`, body prompt, dipanggil `/<nama>`.

[INFERENSI] Kesembilan file `setup/targets/claude_code/*.md` dapat disalin hampir apa adanya ke `setup/targets/opencode/` sebagai commands. Penyesuaian yang perlu:

- Referensi path platform di `sigma-test.md` (§2.2) — harus menunjuk `~/.config/opencode/commands/` dan label `Platform: OpenCode`.
- Frontmatter opencode commands tidak memakai field `name` (nama diambil dari nama file); field `name:` tambahan tidak berbahaya tetapi redundan.
- Fallback role-memory di skill (`Sigma/role-memory/{role}-memory.json`, `sigma memory --<role>`) bersifat platform-netral — tidak perlu diubah.

### 4.2 Role sebagai agents (opsi yang lebih idiomatik)

[FAKTA] Sigma menegaskan *role immutability dalam satu sesi* (contoh `dev.md:19-25`) — role tidak boleh berganti di tengah sesi.

[FAKTA] opencode memiliki primary agents yang di-switch dengan Tab dan berlaku untuk seluruh sesi sampai diganti manual, dengan `permission` per agent.

[INFERENSI] Memetakan ARC/FMN/DEV/AUD sebagai **primary agents** (`~/.config/opencode/agents/arc.md`, dst.) lebih setia pada semantik "role aktif per sesi" dibanding commands (yang one-shot). Bonus: `permission` opencode bisa menegakkan batasan role secara mekanis — misalnya agent `aud` dengan `edit: deny`, `bash: deny` untuk memaksa sifat pasif AUD, sesuatu yang di platform lain hanya ditegakkan lewat instruksi teks.

[USULAN] Deploy keduanya: agents sebagai mode utama + commands sebagai shortcut yang menginstruksikan "aktifkan agent X" (atau cukup andalkan commands, mengikuti pola claude_code, bila ingin perubahan minimal). Keputusan ini milik Director — lihat §7, O-1.

### 4.3 Bridge file → AGENTS.md

[FAKTA] opencode membaca `AGENTS.md` di root proyek sebagai rules native.

[FAKTA] `sigma project start` sudah menulis `AGENTS.md` ke root proyek — tetapi isinya "Codex Model Directives" (`bridge/AGENTS.md:1-6`).

[FAKTA] Bila `AGENTS.md` tidak ada, opencode jatuh ke `CLAUDE.md` — yang juga sudah ditulis Sigma ke root proyek ("Claude Model Directives"). Jadi **secara tidak sengaja, proyek Sigma hari ini sudah memuat satu bridge ke dalam sesi opencode**: isi `CLAUDE.md` akan terbaca bila `AGENTS.md` dihapus/ditiadakan.

Konflik dan opsi dibahas di §6.1.

### 4.4 Hook `protect-sigma.js` → plugin opencode

[FAKTA] Hook Claude Code memblokir `Edit|Write` ke `Sigma/progress-v<N>.json` via `~/.claude/settings.json`.

[FAKTA] Plugin opencode dengan hook `tool.execute.before` dapat melempar `Error` untuk memblokir tool; nama tool opencode lowercase (`edit`, `write`). Plugin global ditaruh di `~/.config/opencode/plugins/`.

[INFERENSI] Padanan fungsional penuh tersedia. Bentuk plugin kira-kira: ekspor `ProtectSigma` yang mengembalikan `{ "tool.execute.before": async (input, output) => { if ((input.tool === "edit" || input.tool === "write") && /Sigma[\/\\]progress(-v\d+)?\.json$/.test(output.args.filePath ?? "")) throw new Error(...) } }`.

[INFERENSI] Perbedaan perilaku yang perlu dicatat: (a) hook Claude Code dipasang global dan aktif di semua proyek; plugin di `~/.config/opencode/plugins/` juga global — setara. (b) Tool patch opencode bernama `apply_patch` juga termasuk kategori edit (dokumen permissions mengelompokkan `write`, `edit`, `apply_patch` di bawah permission `edit`) — plugin harus mencakup `apply_patch` bila ingin paritas penuh. (c) Alternatif tanpa plugin: permission `"edit"` dengan pola deny per path tidak mendukung glob path per-file secara selektif untuk memblokir hanya satu file — plugin tetap jalur yang benar.

### 4.5 Registrasi MCP

[FAKTA] opencode membaca server MCP dari key `mcp` di `opencode.json` (proyek) dan `~/.config/opencode/opencode.json` (global).

[USULAN] Pemetaan langsung dari `makeMcpEntry()`:

```jsonc
// opencode.json (proyek)
{
  "mcp": {
    "sigma": {
      "type": "local",
      "command": ["sigma-mcp", "--mode", "query", "--project-root", "<root>", "--project-id", "<id>"],
      "enabled": true
    }
  }
}
```

[INFERENSI] Implementasi `writeOpencodeMcpConfig()` dapat meniru `writeClaudeMcpConfig()` (`mcpConfig.ts:129-139`): `readJsonSafe` → upsert key → `writeJsonSafe` (strategi temp+rename yang sudah ada). Dua perbedaan: (1) root key bernama `mcp`, bukan `mcpServers`; (2) entri berbentuk `{ type: "local", command: [...] }`, bukan `{ command, args }`. File JSONC: parser JSON murni akan gagal bila config pengguna memakai komentar — ini risiko nyata karena opencode menganjurkan JSONC; lihat §6.3.

[INFERENSI] `sigma-control` bisa didaftarkan dengan cara yang sama sebagai server kedua (mis. key `sigma-control`) dengan `--mode control --role <ROLE>`, tetapi mengikuti kebijakan Sigma saat ini, registrasi control sebaiknya tetap manual.

### 4.6 Deteksi platform

[USULAN] Meniru pola `detect.ts`: `opencode: fs.existsSync(path.join(home, '.config', 'opencode'))`. Di Windows, `~/.config/opencode` ter-resolve ke `C:\Users\<user>\.config\opencode` — konsisten dengan dokumentasi opencode untuk Windows.

---

## 5. Ruang Lingkup Perubahan Kode (inventaris, bukan implementasi)

[INFERENSI] Daftar lengkap titik sentuh bila integrasi dikerjakan:

| File | Perubahan |
| :--- | :--- |
| `src/utils/detect.ts` | Tambah `opencode: boolean` di `DetectedTools`; tambah path `opencodeCommands` (`~/.config/opencode/commands`), `opencodeAgents`, `opencodePlugins`, `opencodeConfig` di `ToolTargetPaths`; tambah deteksi di `detectTools()` |
| `src/commands/setup.ts` | Tambah entri `opencode` di `ROLE_FILES`, `PLATFORM_LABELS`, `PLATFORM_SOURCE_DIR`, `targetDirMap` (fungsi `deploySkillsAndHook` dan `runUninstall`); deploy plugin protect-sigma bila `opencode` terpilih (padanan `deployHook()`) |
| `src/utils/mcpConfig.ts` | Tambah `writeOpencodeMcpConfig()` dan `removeOpencodeMcpConfig()`; tambah builder entri bentuk opencode (`type: "local"`, `command: array`); pertimbangkan parser JSONC (lihat §6.3) |
| `src/commands/project.ts` | Panggil `writeOpencodeMcpConfig(projectRoot)` di `runStart` dan `runSync`; tambah bridge handling bila opsi bridge baru dipilih (§6.1) |
| `setup/targets/opencode/` | Folder sumber baru: 9 command `.md` + opsional 4 agent `.md` + `plugins/protect-sigma.js` |
| `setup/targets/bridge/` | Kemungkinan file bridge baru atau generalisasi `AGENTS.md` (§6.1) |
| `README.md` | Daftar target, tabel registrasi MCP, catatan uninstall |
| `setup/targets/*/sigma-test.md` | Bila pola diteruskan: varian opencode dengan path `~/.config/opencode/commands/` |
| `Sigma/SIGMA_PROTOCOL.md` | Bagian distribusi/target bila protokol menamai platform yang didukung |

---

## 6. Titik Gesek dan Risiko

### 6.1 Konflik AGENTS.md (paling penting)

[FAKTA] opencode memakai `AGENTS.md` sebagai rules native; Sigma sudah menulis `AGENTS.md` berisi *Codex* directives ke setiap proyek.

[INFERENSI] Akibatnya: di proyek Sigma yang dibuka dengan opencode hari ini, opencode memuat aturan yang diberi label untuk model lain. Isinya sebagian besar generik (lima mode, otorisasi Director, larangan edit progress JSON), jadi secara fungsional "berhasil", tetapi kepemilikan dokumen menjadi kabur — dan bila nanti Sigma menulis `AGENTS.md` versi opencode, versi Codex tertimpa.

Opsi (belum diputuskan):

- **O-1a. Generalisasikan `bridge/AGENTS.md`** menjadi directives netral-model (konten hampir sama untuk semua target). Paling sederhana; menghapus dikotomi per-model; risiko: mengubah perilaku Codex yang sudah berjalan.
- **O-1b. Biarkan `AGENTS.md` untuk Codex; beri opencode file terpisah** (mis. `Sigma/OPENCODE.md`) dan daftarkan lewat `instructions` di `opencode.json` proyek saat `project start`. Tidak menyentuh target lain; memakai fitur native opencode.
- **O-1c. Manfaatkan fallback CLAUDE.md**: hapus `AGENTS.md` dari `BRIDGE_STUBS` untuk proyek baru dan jadikan `CLAUDE.md` satu-satunya bridge — tetapi ini mengubah perilaku Codex dan bertentangan dengan konvensi nama AGENTS.md yang justru populer.

[USULAN] O-1b paling rendah risiko dan paling menghormati batas "jangan ubah target lain", dengan catatan `instructions` di `opencode.json` harus merge-aware juga.

### 6.2 Commands vs Agents

Sudah dibahas di §4.2. Ini keputusan UX: commands (paritas dengan claude_code, minimal) atau agents (idiomatik opencode, permission mekanis per role). Keduanya bisa hidup berdampingan.

### 6.3 JSONC pada `opencode.json`

[FAKTA] opencode mendukung komentar di config (JSONC).

[INFERENSI] `readJsonSafe()` di `mcpConfig.ts` memakai `fs.readJsonSync` (JSON murni) dan akan gagal parse bila pengguna menaruh komentar — fallback-nya adalah `{}`, yang berarti **config pengguna tertimpa total**, bukan merge. Ini melanggar prinsip non-destruktif yang Sigma pegang untuk platform lain (kasus serupa sudah diantisipasi untuk Reasonix lewat surgical text edit, `mcpConfig.ts:19-26`). Mitigasi: parser JSONC (strip-comments) atau surgical upsert. Risiko ini tidak ada di target lain karena `.mcp.json`, `mcp_config.json`, dan `config.toml` Codex tidak mendukung komentar.

### 6.4 Paritas hook

[INFERENSI] Perbedaan nama tool (`Edit|Write` vs `edit`/`write`/`apply_patch`) dan struktur payload (`input.tool_input.path` vs `input.tool` + `output.args.filePath`) menuntut penulisan ulang skrip hook, bukan penyalinan. Uninstall juga harus menghapus file plugin dari `~/.config/opencode/plugins/` — menambah satu cabang di `runUninstall`.

### 6.5 Penamaan skill

[FAKTA] Antigravity memakai prefix `sigma-` untuk nama skill; claude_code/reasonix/codex tidak.

[USULAN] Untuk opencode pakai nama tanpa prefix (`arc`, `fmn`, …) demi paritas dengan claude_code, atau dengan prefix `sigma-` untuk menghindari tabrakan dengan commands buatan pengguna (`/dev` dan `/arc` adalah nama umum). Tabrakan nyata: bila pengguna sudah punya `~/.config/opencode/commands/dev.md`, installer akan menimpanya — `deploySkillsAndHook` melakukan overwrite tanpa backup untuk file skill. [FAKTA] Perilaku overwrite ini sama di semua platform yang ada, jadi bukan risiko baru, tetapi layak dicatat.

### 6.6 Lingkup global vs proyek untuk MCP

[FAKTA] Untuk Codex/Antigravity, `project start` menulis entri global yang *terikat* ke proyek terakhir (`project.ts:426-435`).

[INFERENSI] Bila pola ini ditiru untuk `~/.config/opencode/opencode.json`, proyek kedua akan menimpa binding proyek pertama di config global. Alternatif yang lebih bersih untuk opencode: tulis **hanya** `opencode.json` proyek (bound), dan biarkan global tanpa entri atau tanpa binding (discovery mode). Perlu keputusan (§7, O-2).

---

## 7. Keputusan yang Dibutuhkan dari Director

| ID | Pertanyaan | Rekomendasi penulis |
| :--- | :--- | :--- |
| O-1 | Strategi bridge untuk opencode (§6.1: O-1a / O-1b / O-1c)? | **O-1b** — file khusus + `instructions` di `opencode.json`; tidak menyentuh target lain |
| O-2 | MCP opencode: hanya config proyek, atau juga global (§6.6)? | Hanya proyek (bound); global opsional tanpa binding |
| O-3 | Role sebagai commands saja, agents saja, atau keduanya (§4.1/§4.2)? | Keduanya: commands untuk paritas, agents untuk penegakan permission AUD (read-only) |
| O-4 | Nama skill: `arc` vs `sigma-arc` (§6.5)? | Tanpa prefix untuk paritas; kecuali Director ingin menghindari tabrakan nama |
| O-5 | Apakah parser JSONC wajib untuk `opencode.json` (§6.3)? | Ya — mempertahankan prinsip merge-aware/non-destruktif |
| O-6 | Apakah `sigma-control` ikut didaftarkan otomatis untuk opencode? | Tidak — tetap manual, konsisten dengan platform lain |

---

## 8. Kesimpulan

[INFERENSI] opencode adalah target paling "mudah" di antara target yang mungkin ditambahkan: setiap mekanisme Sigma punya padanan native (commands, agents, AGENTS.md, plugins, key `mcp`). Tidak ada kebutuhan mengubah kernel, gates, atau protokol — seluruh pekerjaan terpusat di lapisan distribusi (`detect.ts`, `setup.ts`, `mcpConfig.ts`, `project.ts`) plus satu folder `setup/targets/opencode/`.

Tiga hal yang benar-benar perlu keputusan desain (bukan sekadar coding): (1) resolusi kepemilikan `AGENTS.md`; (2) commands-vs-agents untuk semantik immutability role; (3) penanganan JSONC agar prinsip non-destruktif Sigma tetap berlaku. Setelah ketiganya diputuskan, implementasi bersifat mekanis mengikuti pola lima target yang sudah ada.
