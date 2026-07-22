# PLAN-EVAL-01 — Native MCP Server `sigma-mcp`: Increment Read-Only

**Sumber**: Sesi Professional Mode 2026-07-22 (dipandu skill `mcp-builder`) — Director bermaksud membangun native MCP server untuk sigma-ecosystem.
**Tanggal**: 2026-07-22
**Status**: DRAFT — 5 keputusan desain sudah diputuskan Director 2026-07-22 (lihat "Keputusan Director Tercatat"). Siap dinaikkan ke rencana implementasi terperinci.
**Catatan**: Plan implementasi biasa disusun Professional Mode. Bukan FMN-PLAN Sigma; tidak punya otoritas lock/gate Sigma.
**Menggantikan**: `Implementation/planned_mcp_dev/PLAN-MCP-1.md` — di-*supersede* per keputusan Director 2026-07-22; rujukan API-nya (`progress.ts`/`readProgress`/`ProgressJson`) sudah usang, plan ini memperbaruinya ke `chain.ts`/`ChainState`.
**Rujukan best-practice**: skill `mcp-builder` — `reference/mcp_best_practices.md` dan `reference/node_mcp_server.md`. Terverifikasi terhadap struktur repo saat planning pass ini.

---

## Inti

Hari ini AI role yang mengoperasikan Sigma harus menjalankan command CLI lalu
menafsirkan stdout untuk menjawab pertanyaan orientasi dasar: proyek ada di
fase apa, Gate 2 terbuka atau tidak, ada intent basi, versi plan aktif berapa.
Logika itu **sudah ada** sebagai kode engine bertipe (`src/engine/chain.ts`),
hanya belum diekspos sebagai antarmuka terstruktur yang bisa dipanggil sebagai
tool.

**Ide**: bungkus fungsi-fungsi read-only `chain.ts` (dan `registry.ts`,
`roleMemory.ts`, `mailbox.ts`) di balik server MCP stdio. AI client memanggil
tool, dapat **JSON terstruktur** langsung dari code path yang sama dengan CLI —
bukan reimplementasi, bukan parsing teks terminal.

**Prinsip desain yang dipegang** (warisan roadmap MCP + best-practice
`mcp-builder`): increment pertama **murni read-only/aditif**. Nol tool yang
memutasi state. Tidak mengubah skema `progress-v<N>.json`, tidak mengubah
signature fungsi engine mana pun. Biaya: satu modul baru `src/mcp/` + satu bin
entry `bin/sigma-mcp.js`. CLI `sigma` yang lama tidak tersentuh sama sekali.

---

## Problem Statement

Nilai Sigma bukan sekadar eksekusi command — melainkan disiplin peran, kontrol
lifecycle, ketertelusuran keputusan, dan pelestarian otoritas Director. Saat
ini batas-batas itu hanya terlihat oleh AI client sebagai teks stdout yang
harus dijahit dari beberapa command. Ini rapuh: bergantung pada disiplin agent
dan kepatuhan prompt.

Yang hilang bukan logikanya (sudah ada di `chain.ts`), melainkan **antarmuka
terstruktur** yang membuat konsep-konsep itu eksplisit dan tool-callable.

---

## Prinsip Desain (jadi batasan plan ini)

| Prinsip | Batasan konkret |
|---|---|
| CLI tetap otoritas | Tool MCP memanggil fungsi engine/util yang sudah ada; tidak mereimplementasi logika gate/state di lapisan MCP. |
| Tanpa mutasi state langsung | Increment ini nol tool write. Semua tool dalam scope read-only. |
| Read-only dulu | Hanya Layer 1 roadmap. Guidance (Layer 2) dan mutation (Layer 3) eksplisit di luar scope. |
| Respons terstruktur, bukan teks terminal | Output tool = objek JSON bertipe (`phase`, `gates`, `artifacts`, …), bukan string berformat untuk manusia. |
| Core vendor-neutral | Server = `@modelcontextprotocol/sdk` stdio biasa; tidak ada perilaku spesifik-client di logika tool. |
| **stdout hanya untuk JSON-RPC** | Kontrak stdio MCP: hanya frame protokol yang boleh ke stdout. `console.log`/chalk apa pun yang tercapai dari fungsi yang dibungkus akan merusak transport. `console.error` (stderr) aman untuk diagnostik. |
| Penamaan snake_case + prefix service | Per `mcp_best_practices.md`: `sigma_get_state`, bukan `get_state` atau `sigma.status`. Menghindari tabrakan dengan MCP server lain. |

---

## Temuan Planning Pass (wajib dibaca sebelum coding)

Diverifikasi terhadap kode terkini, **bukan** diasumsikan dari PLAN-MCP-1:

1. **`src/engine/progress.ts` sudah tidak ada.** Sudah dimigrasikan ke
   `src/engine/chain.ts`. Konsekuensi untuk plan ini:
   - `readProgress(root)` → **`readActiveChain(root)`** yang mengembalikan
     `{ chainVersion, data: ChainState }`.
   - tipe `ProgressJson` → **`ChainState`** (`src/engine/chain.ts:189`).
   - `getGateStatus()` sekarang menerima `ChainState`
     (`src/engine/chain.ts:687`).
   - PLAN-MCP-1 §"Existing Reusable Surfaces" perlu dibaca ulang dengan peta
     ini; jangan pakai nama fungsi lamanya.

2. **`runBootstrap` masih mencetak langsung.** Di `src/commands/session.ts:119`
   ia `function` non-export yang membangun output lewat `console.log`/chalk,
   bukan mengembalikan struktur data. Maka `sigma_get_orientation` **tidak bisa
   membungkusnya apa adanya** — memanggilnya dari tool MCP akan mengotori
   stream JSON-RPC stdout. Stage 1 harus mengekstrak perakitan datanya jadi
   fungsi murni yang dipakai bersama oleh CLI dan tool MCP.

3. **Fungsi read-only yang sudah tersedia di `chain.ts`** (nama terverifikasi):
   `readActiveChain`, `readChain`, `readProjectIdentity`, `listChainVersions`,
   `getGateStatus`, `getGateStatusLabel`, `isGateInvalid`, `getOperationalGate`,
   `hasInvalidRuntime`, `getInvalidMarkers`, `getInvalidWarningLines`,
   `runDoctorReconciliation`. Semua murni membaca `ChainState` — tidak menulis.
   `getNextValidOperations` dirujuk `src/commands/session.ts:8` (dari
   `chain.ts`) untuk daftar operasi valid berikutnya.

4. **Sumber read-only lain**: `src/engine/registry.ts`
   (`loadDocumentRegistry`, `getDocumentsForRole`), `src/engine/roleMemory.ts`
   (`loadRoleMemory` — sudah bounded per peran), `src/engine/mailbox.ts`
   (`readIndex`, `getUnreadForRole`), `src/utils/operationLog.ts` +
   `src/commands/report.ts` (`readAllEntries` untuk operations.jsonl).

---

## Scope

### Dalam scope

- Tambah dependency `@modelcontextprotocol/sdk` + `zod` (lihat Catatan
  Integrasi SDK).
- Modul baru `src/mcp/`: bootstrap server, registry tool, handler per-tool
  (satu berkas per domain).
- Bin entry baru `bin/sigma-mcp.js`, didaftarkan di `package.json` `"bin"`,
  terpisah dari `bin/sigma.js`.
- Refactor perakitan-data `runBootstrap` (`session.ts`) jadi fungsi murni
  bersama (bukan sekadar DRY — ini syarat kebenaran stdout).
- Implementasi tool read-only (lihat Surface Tool).
- Test unit berbasis fixture per tool + verifikasi manual via MCP Inspector.

### Di luar scope

- Tool apa pun yang memutasi state (`lock`, `supersede`, `override`, `close`,
  `send`) — Layer 3.
- Tool guidance/klasifikasi otoritas (Layer 2) — butuh design pass sendiri soal
  cara mengklasifikasi "butuh otorisasi Director".
- Integrasi setup/config generator untuk VS Code/Reasonix/Gemini (Milestone C).
- Resources/prompts MCP, notification-driven refresh, dashboard.
- Perubahan skema `progress-v<N>.json` atau signature fungsi engine mana pun.

---

## Surface Tool

Penamaan snake_case + prefix `sigma_` per `mcp_best_practices.md` (keputusan
Director #1). Setiap respons menyertakan `source: "engine"` (provenance: nilai
datang dari code path yang sama dengan CLI).

### Increment ini — 5 tool inti (keputusan Director #5)

| Tool | Membungkus | Output (kontrak awal, boleh berubah saat implementasi) |
|---|---|---|
| `sigma_get_state` | `readActiveChain` + `getGateStatus` + `hasInvalidRuntime` | `{ phase, project_id, project_name, active_chain, schema_version, gates, has_invalid_runtime, source }` |
| `sigma_get_orientation` | refactor `runBootstrap` + `getNextValidOperations` | `{ phase, role_hint, gate_summary, next_valid_operations[], stale_intent_warnings[], blockers[], source }` |
| `sigma_get_gates` | `getGateStatus` + `isGateInvalid` + `getGateStatusLabel` | `{ gate_1_open, gate_2_open, gate_3_satisfied, labels, invalid_markers[], source }` |
| `sigma_list_artifacts` | tracker `ChainState` (`intent`/`plan`/`exec`/`close`/`roadmap`) | `{ intent, plan, exec, close, roadmap, source }` (masing-masing objek tracker) |
| `sigma_doctor` | `runDoctorReconciliation` | `{ findings[], reconciled, source }` |

### Ditunda ke increment lanjutan (masih Layer 1 read-only)

| Tool | Membungkus | Catatan |
|---|---|---|
| `sigma_read_artifact` | pembaca berkas artifact by domain+version | Butuh sanitasi path (anti traversal); layak increment sendiri. |
| `sigma_get_role_memory` | `loadRoleMemory(role)` | Input `role` ∈ ARC/FMN/DEV/AUD. |
| `sigma_list_inbox` | `readIndex` + `getUnreadForRole(role)` | — |
| `sigma_get_operation_log` | `readAllEntries` + filter | Dukung `limit`/`offset`/`status`/`since`. |

> **Catatan scope**: `sigma_check` **tidak** masuk sini — read-only tapi wajib
> lewat subprocess CLI, ditunda ke increment guidance Layer 2 (keputusan
> Director #3). Increment pertama tetap **murni engine-native, nol subprocess**.

Anotasi tool (semua tool read-only di plan ini): `readOnlyHint: true`,
`destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`
(hanya menyentuh filesystem proyek lokal, bukan entitas eksternal).

Semua nama field adalah **kontrak awal beku** untuk mulai coding; boleh
disempurnakan saat implementasi.

---

## Catatan Integrasi SDK (dicek, bukan diasumsikan)

- **Format modul kompatibel apa adanya.** `@modelcontextprotocol/sdk`
  menyediakan build dual CJS/ESM. `tsconfig.json` repo ini `"module":
  "commonjs"` tanpa `"type": "module"` di `package.json` — SDK bisa
  `require()` langsung. **Tidak perlu migrasi ESM proyek-wide.** (PLAN-MCP-1
  sudah memverifikasi ini terhadap v1.29.0; konfirmasi ulang versi terbaru saat
  Stage 1.)
- **Node sudah memenuhi.** `engines.node` SDK `>=18`; repo ini sudah
  `"engines": { "node": ">=18.0.0" }`.
- **API modern saja** (per `node_mcp_server.md`): pakai `server.registerTool()`,
  **bukan** `server.tool()` / `setRequestHandler` lawas.
- **Skema input pakai Zod** dengan `.strict()`; mayoritas tool di sini tanpa
  argumen (`inputSchema: {}`), kecuali `sigma_read_artifact`,
  `sigma_get_role_memory`, `sigma_list_inbox`, `sigma_get_operation_log`.
- **Spike Stage 1**: cek apakah versi SDK terpasang mendukung
  `outputSchema`/`structuredContent` sehingga tool bisa mengembalikan JSON
  terstruktur asli, bukan blob `text` ter-`JSON.stringify`. Fallback: taruh
  payload di satu blok `text`.

Contoh bentuk (CJS, gaya repo ini):

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readActiveChain, getGateStatus, hasInvalidRuntime } from "../engine/chain";
import { findProjectRoot } from "../utils/fs";

const server = new McpServer({ name: "sigma-mcp-server", version: "0.10.0" });

server.registerTool(
  "sigma_get_state",
  {
    title: "Get Sigma Lifecycle State",
    description: "Return current Sigma lifecycle phase, active chain, and gate summary. Read-only.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async () => {
    const root = findProjectRoot();
    const { chainVersion, data } = readActiveChain(root);
    const payload = {
      phase: data.state,
      active_chain: chainVersion,
      gates: getGateStatus(data),
      has_invalid_runtime: hasInvalidRuntime(data),
      source: "engine",
    };
    return { content: [{ type: "text", text: JSON.stringify(payload) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("sigma-mcp running on stdio"); // stderr saja, jangan console.log
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
```

---

## Task Breakdown

### Stage 1 — Scaffold & Persiapan Data-Layer

- `npm install @modelcontextprotocol/sdk zod` (build CJS SDK cocok dengan setup
  `commonjs`/tanpa `"type": "module"` — tidak perlu migrasi format modul).
- Buat `src/mcp/server.ts` (bootstrap `McpServer` + `StdioServerTransport`) dan
  `src/mcp/tools/` (satu berkas per domain, pemanggilan `registerTool`).
- **Refactor `runBootstrap`** (`src/commands/session.ts:119`): pisahkan
  perakitan data dari output console/chalk, agar CLI dan tool MCP memanggil
  fungsi bawah yang sama. Syarat kebenaran, bukan gaya.
- Tambah `bin/sigma-mcp.js` + daftarkan di `package.json` `"bin"`.
- Spike `outputSchema`/`structuredContent`.

### Stage 2 — Implementasi Tool Read-Only

- Implementasi **5 tool inti** (`sigma_get_state`, `sigma_get_orientation`,
  `sigma_get_gates`, `sigma_list_artifacts`, `sigma_doctor`) sebagai pembungkus
  tipis fungsi di tabel Temuan Planning Pass.
- **Jaminan**: tidak satu pun berkas di `src/mcp/tools/` meng-`import` fungsi
  engine yang menulis. Ditegakkan lewat code review.

### Stage 3 — Test

- Test unit berbasis fixture `ChainState` per tool: kasus valid, stale-intent,
  invalid-runtime, dan tanpa `progress-v<N>.json` (respons "no active project"
  yang anggun).
- Satu test integrasi yang mem-boot server in-process lalu memanggil tiap tool
  lewat client harness SDK (bila SDK mendukung transport in-process); jika
  tidak, skrip verifikasi manual terdokumentasi.

### Stage 4 — Verifikasi Manual

- Konfigurasi MCP client lokal (Claude Code `.mcp.json` atau MCP Inspector)
  terhadap `bin/sigma-mcp.js`.
- Uji tiap tool terhadap: (a) repo ini sendiri (belum tentu punya
  `progress-v<N>.json` aktif — konfirmasi respons "no active project"), dan (b)
  proyek scratch dengan chain nyata di beberapa state (gate terbuka, intent
  basi).
- Rekam transkrip verifikasi sebelum increment dinyatakan selesai.

---

## Catatan Risiko

- **Korupsi stdout, bukan sekadar drift**: server stdio MCP tak boleh menulis
  apa pun selain frame protokol ke stdout. Chalk/`console.log` di `runBootstrap`
  akan merusak transport bila dibungkus apa adanya. Dimitigasi oleh refactor
  Stage 1.
- **Rujukan API usang di PLAN-MCP-1**: jika implementor mengikuti PLAN-MCP-1
  mentah, ia akan meng-`import` `readProgress`/`progress.ts` yang sudah tidak
  ada → build gagal. Plan ini menggantikan peta fungsinya; pakai tabel Temuan
  Planning Pass.
- **Footprint dependency**: `@modelcontextprotocol/sdk` + `zod` adalah
  dependency runtime baru untuk paket yang kini hanya bergantung `commander`,
  `chalk`, `fs-extra`, `inquirer`. Perlu konfirmasi Director.
- **Directory traversal**: *tidak berlaku untuk increment ini* — `sigma_read_artifact`
  (satu-satunya tool bermetadata path) ditunda ke increment lanjutan. Saat tool
  itu diaktifkan nanti: wajib validasi domain+version → path kanonik, tolak
  input arbitrer (`mcp_best_practices.md` §Input Validation).
- **Scope creep ke Layer 2**: begitu `sigma_get_gates` ada, menambah output
  "operasi valid berikutnya + otoritasnya" terasa menggoda — tapi klasifikasi
  otorisasi eksplisit ditunda. `sigma_get_orientation` boleh menampilkan daftar
  `next_valid_operations` mentah (sudah disediakan `getNextValidOperations`),
  tapi **tidak** mengklasifikasi authority-level-nya di sini.

---

## Backward Compatibility

| Jaminan | Penegakan |
|---|---|
| Skema `progress-v<N>.json` tidak berubah | Dinyatakan di luar scope; tidak ada signature fungsi engine tersentuh. |
| Format registry tidak berubah | Pembaca `SIGMA-REGISTRY.json` / `SIGMA-OPERATION-REGISTRY.json` dibungkus, tak diubah. |
| Perilaku, output, exit code CLI `sigma` tak berubah | Kode baru hidup di `src/mcp/` + `bin/sigma-mcp.js`, entry terpisah. Proyek yang tak memasang MCP client tak pernah mengeksekusi kode baru. |
| Output `sigma session bootstrap` identik setelah refactor Stage 1 | Sudah tercakup regression test yang men-spawn CLI nyata dan meng-assert stdout per peran (`test/role-memory-bootstrap.test.ts`, `test/lifecycle-hardening.test.ts`). Refactor belum selesai sampai test ini lulus tanpa modifikasi. |
| Versi | Rilis sebagai **minor** bump (`0.9.0` → `0.10.0`): menambah surface publik baru, tak mengubah command lama. |

**Ditambahkan ke Acceptance Criteria**: seluruh suite `npm test` lulus tanpa
modifikasi (bukan hanya test MCP baru) sebelum increment dianggap selesai.

---

## Draft Acceptance Criteria

- [ ] Server `sigma-mcp` start via stdio dan me-list persis tool yang
      didefinisikan di Surface Tool.
- [ ] Output tiap tool cocok dengan kontrak field dan menyertakan `source`.
- [ ] Tidak ada tool yang meng-`import` fungsi engine/util yang menulis.
- [ ] `runBootstrap` bukan lagi satu-satunya salinan perakitan data orientasi;
      CLI dan MCP memakai fungsi yang sama.
- [ ] `sigma_read_artifact` menolak path di luar direktori artifact kanonik.
- [ ] Test unit menutup kasus valid, stale-intent, invalid-runtime, dan
      tanpa-chain untuk setiap tool.
- [ ] Transkrip verifikasi manual terhadap chain scratch nyata terekam.
- [ ] Suite `npm test` penuh lulus tanpa modifikasi.
- [ ] Memenuhi exit signal Layer 1 roadmap: *"AI client bisa memahami fase
      Sigma, peran aktif, status gate, artifact aktif, dan blocker tanpa
      menafsirkan output shell."*

---

## Keputusan Director Tercatat

Diputuskan Director 2026-07-22 ("saya mengikuti rekomendasi"). Kelima keputusan
mengikuti rekomendasi plan ini.

1. **Penamaan tool** — **snake_case** (`sigma_get_state`), sesuai
   `mcp_best_practices.md`. Dot-notation `sigma.status` (PLAN-MCP-1) ditolak.
2. **Nasib PLAN-MCP-1** — **di-*supersede*** oleh plan ini. PLAN-MCP-1 tetap
   sebagai arsip; plan ini penerus resmi dengan peta API terkini.
3. **`sigma_check`** — **ditunda ke Layer 2** (increment guidance). Increment
   pertama murni engine-native read-only, nol subprocess CLI.
4. **Dependency baru** — **disetujui**: tambah `@modelcontextprotocol/sdk` +
   `zod` sebagai dependency runtime (konfirmasi versi terpasang saat Stage 1).
5. **Cakupan tool** — **mulai dari 5 tool inti** (`sigma_get_state`,
   `sigma_get_orientation`, `sigma_get_gates`, `sigma_list_artifacts`,
   `sigma_doctor`). Empat tool sisanya (`sigma_read_artifact`,
   `sigma_get_role_memory`, `sigma_list_inbox`, `sigma_get_operation_log`)
   ditunda ke increment lanjutan, masih dalam Layer 1.

### Dampak keputusan ke scope

- Surface Tool sudah dipangkas ke 5 tool inti; Acceptance Criteria berlaku untuk
  ke-5 tool itu.
- `sigma_read_artifact` keluar dari increment pertama → risiko directory
  traversal **tidak berlaku** untuk increment ini (tak ada tool bermetadata
  path). Tetap dicatat sebagai syarat saat tool itu diaktifkan nanti.
- Increment pertama tak menyentuh subprocess sama sekali → permukaan risiko
  lebih kecil.
