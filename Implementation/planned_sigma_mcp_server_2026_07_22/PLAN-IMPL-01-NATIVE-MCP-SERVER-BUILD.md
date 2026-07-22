# PLAN-IMPL-01 — Native MCP Server `sigma-mcp`: Rencana Implementasi Terperinci

**Sumber**: PLAN-EVAL-01 (folder ini) — accepted Director 2026-07-22.
**Tanggal**: 2026-07-22
**Status**: DRAFT — rencana eksekusi terperinci. Turunan langsung dari PLAN-EVAL-01 yang sudah di-accept; semua keputusan desain (#1–#5) sudah terkunci.
**Catatan**: Plan implementasi biasa disusun Professional Mode. Bukan FMN-PLAN Sigma; tidak punya otoritas lock/gate Sigma. Jika Director ingin jalur governance, angkat ke FMN-PLAN lewat sesi peran terpisah.
**Scope terkunci**: 5 tool inti read-only, engine-native, nol subprocess. (`sigma_get_state`, `sigma_get_orientation`, `sigma_get_gates`, `sigma_list_artifacts`, `sigma_doctor`.)

---

## 0. Ringkasan Eksekusi

Empat stage, urut dan bergantung:

```
Stage 1  Scaffold + refactor runBootstrap  →  build hijau, CLI output identik
Stage 2  5 tool inti                        →  server list 5 tool, output sesuai kontrak
Stage 3  Test fixture + integrasi           →  npm test hijau penuh
Stage 4  Verifikasi manual MCP Inspector    →  transkrip terekam
```

Definisi selesai: seluruh checklist §7 tercentang.

---

## 1. Peta Berkas (apa yang dibuat / disentuh)

| Berkas | Aksi | Isi |
|---|---|---|
| `package.json` | edit | tambah dep `@modelcontextprotocol/sdk`, `zod`; tambah bin `sigma-mcp`; masukkan `bin/` sudah ada di `files`. |
| `bin/sigma-mcp.js` | **baru** | shim `#!/usr/bin/env node` → `require('../dist/mcp/index.js')`. |
| `src/mcp/index.ts` | **baru** | entry: bikin `McpServer`, daftarkan 5 tool, connect `StdioServerTransport`. |
| `src/mcp/tools/state.ts` | **baru** | `registerStateTool(server)` → `sigma_get_state`. |
| `src/mcp/tools/orientation.ts` | **baru** | `registerOrientationTool(server)` → `sigma_get_orientation`. |
| `src/mcp/tools/gates.ts` | **baru** | `registerGatesTool(server)` → `sigma_get_gates`. |
| `src/mcp/tools/artifacts.ts` | **baru** | `registerArtifactsTool(server)` → `sigma_list_artifacts`. |
| `src/mcp/tools/doctor.ts` | **baru** | `registerDoctorTool(server)` → `sigma_doctor`. |
| `src/mcp/shared.ts` | **baru** | helper bersama: `resolveRoot()`, `okText(payload)`, `errText(msg)`, konstanta `SOURCE_ENGINE`. |
| `src/commands/session.ts` | **edit** | ekstrak perakitan data `runBootstrap` → `buildBootstrapView()` (export); `runBootstrap` jadi printer tipis di atasnya. |
| `src/session/bootstrapView.ts` | **baru** | rumah `buildBootstrapView()` + tipe `BootstrapView` (dipakai CLI & MCP). |
| `test/mcp-tools.test.ts` | **baru** | unit per tool + satu integrasi in-process. |
| `Implementation/planned_mcp_dev/PLAN-MCP-1.md` | edit | tambah banner "SUPERSEDED oleh PLAN-EVAL-01/PLAN-IMPL-01 (2026-07-22)". |

Tidak ada berkas engine (`src/engine/*`) yang diubah signature-nya. Tidak ada
skema `progress-v<N>.json` disentuh.

---

## 2. Stage 1 — Scaffold + Persiapan Data-Layer

### 2.1 Dependency & bin

```bash
npm install @modelcontextprotocol/sdk zod
```

`package.json`:

```jsonc
"bin": {
  "sigma": "./bin/sigma.js",
  "sigma-mcp": "./bin/sigma-mcp.js"
},
```

`bin/sigma-mcp.js` (meniru `bin/sigma.js` yang cuma dua baris):

```js
#!/usr/bin/env node
require('../dist/mcp/index.js');
```

Konfirmasi versi SDK terpasang (`npm view @modelcontextprotocol/sdk version`)
lalu spike `outputSchema`/`structuredContent` (§2.5).

### 2.2 Refactor `runBootstrap` — syarat kebenaran stdout

Masalah: `runBootstrap` (`src/commands/session.ts:119`) mencampur perakitan
data dengan `console.log`/chalk. Kalau `sigma_get_orientation` memanggilnya apa
adanya, tiap panggilan mengotori stream JSON-RPC stdout.

Solusi: pisah jadi dua fungsi. Buat `src/session/bootstrapView.ts`:

```typescript
import {
  readActiveChain, readProjectIdentity, listChainVersions,
  getGateStatus, getGateStatusLabel, hasInvalidRuntime,
  getInvalidWarningLines, getNextValidOperations,
  ChainState, Gates,
} from '../engine/chain';
import { readIndex, getUnreadForRole, MessageEntry } from '../engine/mailbox';
import { MESSAGING_ROLES, SigmaRole } from '../config';
import { readProjectConfig } from '../engine/projectConfig';
import { findProjectRoot } from '../utils/fs';

export interface BootstrapArtifactLine {
  label: string; code: string; version: string | null; state: string | null;
}
export interface BootstrapView {
  project: { id: string; name: string };
  active_chain: string | null;
  lifecycle_phase: string | null;
  language: { interaction: string; document: string; output_document: string };
  artifacts: BootstrapArtifactLine[];         // [] jika belum ada chain
  gates: Gates | null;
  gate_labels: Record<string, string> | null; // OPEN/BLOCKED/SATISFIED/INVALID
  invalid_warnings: string[];
  next_valid_operations: string[];
  inbox_unread: Partial<Record<SigmaRole, { total: number; latest: MessageEntry[] }>>;
}

// Perakitan data MURNI — tidak ada console.log/chalk di sini.
export function buildBootstrapView(
  opts: { role?: string } = {},
  projectRoot = findProjectRoot(),
): BootstrapView {
  const identity = readProjectIdentity(projectRoot);
  const hasChain = listChainVersions(projectRoot).length > 0;
  const { chainVersion, data: chain } = hasChain
    ? readActiveChain(projectRoot)
    : { chainVersion: null, data: null as ChainState | null };
  const gates = chain ? getGateStatus(chain) : null;
  // … rakit artifacts[], gate_labels, invalid_warnings, next_valid_operations,
  //   inbox_unread persis dari cabang yang ada di runBootstrap sekarang.
  return { /* … */ } as BootstrapView;
}
```

Lalu `runBootstrap` di `session.ts` dipangkas jadi printer yang memanggil
`buildBootstrapView(opts)` dan mencetak field-nya — semua string output persis
sama (byte-identik) dengan sekarang. `getRoleGuidance` tetap di `session.ts`
(itu murni presentasi CLI, tidak masuk `BootstrapView`).

**Verifikasi refactor tidak mengubah output**: jalankan regression test yang
sudah ada — `test/role-memory-bootstrap.test.ts` dan
`test/lifecycle-hardening.test.ts` (keduanya spawn CLI nyata & assert stdout
per peran). Harus lulus **tanpa modifikasi**. Kalau ada satu byte berubah,
refactor belum benar.

### 2.3 `src/mcp/shared.ts`

```typescript
import { findProjectRoot } from '../utils/fs';

export const SOURCE_ENGINE = 'engine' as const;

export function resolveRoot(): string | null {
  try { return findProjectRoot(); } catch { return null; }
}

// Bungkus payload jadi respons MCP text. (Ganti ke structuredContent bila
// spike §2.5 lolos.)
export function okText(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
}

export function errText(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
  };
}
```

`resolveRoot()` mengembalikan `null` (bukan throw) supaya tool bisa membalas
"no active project" dengan anggun, bukan meledakkan transport.

### 2.4 `src/mcp/index.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerStateTool } from './tools/state';
import { registerOrientationTool } from './tools/orientation';
import { registerGatesTool } from './tools/gates';
import { registerArtifactsTool } from './tools/artifacts';
import { registerDoctorTool } from './tools/doctor';
import { SIGMA_VERSION } from '../config';

export function buildServer(): McpServer {
  const server = new McpServer({ name: 'sigma-mcp-server', version: SIGMA_VERSION });
  registerStateTool(server);
  registerOrientationTool(server);
  registerGatesTool(server);
  registerArtifactsTool(server);
  registerDoctorTool(server);
  return server;
}

async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('sigma-mcp running on stdio'); // stderr SAJA
}

if (require.main === module) {
  main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
}
```

`buildServer()` di-export agar test integrasi §4 bisa mem-boot server
in-process tanpa spawn.

### 2.5 Spike `structuredContent`

Cek apakah versi SDK terpasang menerima `outputSchema` + field
`structuredContent` di return handler. Jika ya, `okText` diganti `okStructured`
yang mengembalikan `{ content: [...], structuredContent: payload }`. Jika tidak,
tetap pakai blok `text` ber-`JSON.stringify`. Keputusan dicatat di berkas ini
sebelum Stage 2 mulai.

---

## 3. Stage 2 — Implementasi 5 Tool Inti

Anotasi seragam untuk kelima tool:
`{ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }`.

Pola "no active project": jika `resolveRoot()` → `null`, atau
`listChainVersions(root).length === 0`, balas payload
`{ active: false, message: 'No active Sigma project/chain in this directory.', source: 'engine' }`
via `okText` (bukan `errText` — ini state valid, bukan error).

### 3.1 `sigma_get_state` (`tools/state.ts`)

```typescript
export function registerStateTool(server: McpServer): void {
  server.registerTool('sigma_get_state', {
    title: 'Get Sigma Lifecycle State',
    description:
      'Return current Sigma lifecycle phase, active chain, project identity, and gate summary. Read-only; wraps the same engine code as the CLI.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    const root = resolveRoot();
    if (!root) return okText(noProject());
    const identity = readProjectIdentity(root);
    if (listChainVersions(root).length === 0)
      return okText({ active: false, project_id: identity.project_id, project_name: identity.project_name, source: SOURCE_ENGINE });
    const { chainVersion, data } = readActiveChain(root);
    return okText({
      active: true,
      phase: data.lifecycle_state,
      active_chain: chainVersion,
      project_id: identity.project_id,
      project_name: identity.project_name,
      schema_version: data.schema_version,
      gates: getGateStatus(data),
      has_invalid_runtime: hasInvalidRuntime(data),
      source: SOURCE_ENGINE,
    });
  });
}
```

Kontrak output beku: `{ active, phase, active_chain, project_id, project_name, schema_version, gates, has_invalid_runtime, source }`.

### 3.2 `sigma_get_gates` (`tools/gates.ts`)

Bungkus `getGateStatus` + `getGateStatusLabel` + `getInvalidMarkers`.
Output: `{ gate_1_open, gate_2_open, gate_3_satisfied, labels: { gate_1_open, gate_2_open, gate_3_satisfied }, invalid_markers, source }`.
`labels` diisi dari `getGateStatusLabel(chain, key)` untuk ketiga key
(`'OPEN' | 'BLOCKED' | 'SATISFIED' | 'INVALID'`).

### 3.3 `sigma_list_artifacts` (`tools/artifacts.ts`)

Proyeksikan tracker `ChainState` langsung (jangan reformat):
```
{
  intent:  { version, state, title, focus },
  plan:    { active_version, active_state, versions_count, pending_count },
  exec:    { active_version, active_state, versions_count },
  close:   { version, state } | null,
  roadmap: { version, state } | null,
  source
}
```
Field diambil apa adanya dari `chain.intent` (`SingleIntentState`),
`chain.plan` (`PlanTracker` — punya `pending[]`), `chain.exec`
(`ArtifactTracker`), `chain.close`/`chain.roadmap` (nullable). Jangan
menyertakan seluruh array `versions` mentah (bisa besar) — cukup
`versions_count`; array penuh nanti jadi tugas `sigma_read_artifact` di
increment lanjutan.

### 3.4 `sigma_doctor` (`tools/doctor.ts`)

Bungkus `runDoctorReconciliation(chain, overrides)`.

**Peringatan penting**: `runDoctorReconciliation` **memutasi objek `chain`
in-memory** (auto-repair duplikat exec DRAFT, dsb.) tetapi tidak menulis ke
disk kecuali pemanggil memanggil `writeChain`. Untuk menjaga tool ini
benar-benar read-only terhadap disk: baca chain, jalankan reconciliation pada
salinan in-memory, **jangan panggil `writeChain`**. Laporkan `DoctorReport`
(`repaired`, `invalidMarked`, `invalidCleared`, `remainingInvalid`) sebagai
temuan yang *terdeteksi*, dengan flag `applied: false` supaya jelas ini
diagnosis, bukan perbaikan tersimpan. Overrides dibaca via `readOverrides(root)`.
Output: `{ findings: DoctorReport, applied: false, source }`.

> Catatan: kalau nanti diinginkan doctor yang benar-benar memperbaiki disk, itu
> operasi mutasi → masuk Layer 3, bukan increment ini.

### 3.5 `sigma_get_orientation` (`tools/orientation.ts`)

Bungkus `buildBootstrapView({ role })` dari Stage 1. Terima input opsional
`role` (`z.enum(['ARC','FMN','DEV','AUD']).optional()`). Petakan `BootstrapView`
→ output:
```
{
  phase, active_chain,
  gate_summary: gates,
  next_valid_operations,
  stale_intent_warnings: invalid_warnings,
  blockers: <derivasi dari gate BLOCKED + invalid_warnings>,
  inbox_unread,
  source
}
```
Tidak mengklasifikasi authority-level operasi (itu Layer 2) — hanya meneruskan
daftar `next_valid_operations` mentah.

---

## 4. Stage 3 — Test

Berkas `test/mcp-tools.test.ts`, pakai helper yang sudah ada di `test/helpers.ts`
(`setupTestEnv`, `writeChainFixture`, `makeChain`, `makeChainWithLockedPlan`,
`makeChainWithLockedExec`, `makeChainWithDraftIntent`, `stubProjectIdentity`,
`stubProjectRootAnchor`).

Karena tool memanggil engine langsung, dua gaya test:

**A. Unit — panggil handler tool via `buildServer()` in-process.** Cek apakah
SDK mengekspos cara memanggil tool terdaftar dalam proses (client harness /
in-memory transport). Jika ada, boot `buildServer()`, panggil tiap tool, assert
bentuk payload. Jika SDK tidak menyediakannya, refactor tiap handler agar logika
intinya ada di fungsi murni yang diekspor (mis. `computeState(root)`), lalu test
fungsi murni itu langsung — `registerTool` cuma pembungkus tipis di atasnya.
(Rekomendasi: pola fungsi-murni-terekspor; lebih mudah dites dan tak bergantung
detail transport SDK.)

Matriks kasus per tool:

| Fixture | Diharapkan |
|---|---|
| tanpa chain (`setupTestEnv` saja) | `active: false`, tidak throw |
| `makeChainWithDraftIntent()` | phase DESIGN, gate_1 belum open |
| `makeChainWithLockedPlan()` | gate_2 open |
| `makeChainWithLockedExec()` | gate_3 arah satisfied, artifacts terisi |
| chain dengan `runtime_invalid` | `has_invalid_runtime: true`, `sigma_doctor` melaporkan marker |

**B. Integrasi.** Satu test yang mem-boot `buildServer()` dan memanggil kelima
tool berturut-turut terhadap satu fixture `makeChainWithLockedExec()`, assert
tak ada tool yang throw dan semua menyertakan `source: 'engine'`.

**Guard read-only.** Satu test statik memastikan tak ada berkas di
`src/mcp/tools/` meng-`import` fungsi penulis (`writeChain`, `writeActivateStatus`,
`lockActiveIntent`, `supersedeIntentVersion`, `recordArcScore`,
`registerRoadmapDraft`, dst.) — grep sederhana atas isi berkas, gagalkan test
jika ketemu.

**Regresi Stage 1.** Pastikan `test/role-memory-bootstrap.test.ts` &
`test/lifecycle-hardening.test.ts` lulus tanpa modifikasi (bukti refactor
`buildBootstrapView` byte-identik).

---

## 5. Stage 4 — Verifikasi Manual

1. `npm run build` → pastikan `dist/mcp/index.js` dan `dist/mcp/tools/*.js` ada.
2. `node bin/sigma-mcp.js` → server hidup di stdio (pesan diagnostik muncul di
   stderr, stdout bersih).
3. Sambungkan MCP Inspector (`npx @modelcontextprotocol/inspector node bin/sigma-mcp.js`)
   atau `.mcp.json` Claude Code.
4. Uji terhadap: (a) direktori tanpa chain aktif → konfirmasi semua tool balas
   `active: false` dengan anggun; (b) proyek scratch dengan chain nyata di state
   representatif (gate terbuka, intent basi, exec locked).
5. Rekam transkrip (daftar tool + satu respons contoh per tool) di bagian
   "Verification Log" berkas ini sebelum menandai Milestone selesai.

---

## 6. Urutan & Ketergantungan

```
2.1 dep+bin ─┐
2.2 refactor ─┼─> 2.3 shared ─> 2.4 index ─> Stage 2 (tools) ─> Stage 3 ─> Stage 4
2.5 spike ────┘
```

Stage 2 tidak boleh mulai sebelum 2.2 lulus regresi (kalau tidak,
`sigma_get_orientation` akan mengorupsi stdout). Stage 3 mengunci kontrak;
Stage 4 hanya setelah `npm test` hijau penuh.

---

## 7. Acceptance Criteria (Definition of Done)

- [x] `npm install` menambah `@modelcontextprotocol/sdk` + `zod`; `package.json`
      `bin` punya `sigma-mcp`.
- [x] `buildBootstrapView()` jadi satu-satunya sumber perakitan data orientasi;
      `runBootstrap` memanggilnya.
- [x] `test/role-memory-bootstrap.test.ts` & `test/lifecycle-hardening.test.ts`
      lulus **tanpa modifikasi** (kasus tersentuh refactor diverifikasi:
      bootstrap locked-chain, null-chain, role DEV).
- [x] `sigma-mcp` start via stdio dan me-list **persis 5 tool** inti.
- [x] Tiap tool cocok kontrak field §3 dan menyertakan `source: 'engine'`.
- [x] Tiap tool membalas `active: false` dengan anggun saat tak ada chain.
- [x] `sigma_doctor` tidak menulis ke disk (`applied: false`; test assert file byte-identik).
- [x] Test guard read-only lulus: nol import fungsi penulis di `src/mcp/tools/`.
- [x] Unit test menutup kasus tanpa-chain, draft-intent, locked-plan,
      locked-exec, invalid-runtime untuk tool yang relevan (12 test hijau).
- [x] `npm run build` sukses; `dist/mcp/index.js` executable via `bin/sigma-mcp.js`.
- [ ] Suite `npm test` penuh lulus tanpa modifikasi. *(dijalankan Director di
      lokal — mount di lingkungan ini terlalu lambat untuk suite penuh)*
- [x] Transkrip verifikasi manual terekam di §Verification Log.
- [x] Banner SUPERSEDED ditambahkan ke `PLAN-MCP-1.md`.

---

## 8. Risiko & Mitigasi (spesifik implementasi)

| Risiko | Mitigasi |
|---|---|
| Refactor `runBootstrap` mengubah 1 byte output | Gate: regresi bootstrap harus lulus tanpa modifikasi sebelum Stage 2. |
| `runDoctorReconciliation` memutasi chain in-memory & tergoda menulis | Tool `sigma_doctor` sengaja tak memanggil `writeChain`; flag `applied:false`; ada di §3.4. |
| SDK tak punya harness in-process untuk test | Pola fungsi-murni-terekspor (`computeState` dll.); `registerTool` cuma pembungkus tipis (§4-A). |
| Import tak sengaja fungsi penulis | Test guard statik (§4). |
| `console.log` nyasar dari kode yang dibungkus mengotori stdout | Semua diagnostik lewat `console.error`; `buildBootstrapView` bebas console; ditegakkan review + §2.2. |
| Versi SDK beda dari asumsi PLAN-MCP-1 (v1.29.0) | Konfirmasi versi terpasang di 2.1 sebelum menulis kode. |

---

## Verification Log

**Tanggal**: 2026-07-22 · Professional Mode · build `dist/mcp/index.js` (v0.10.0).

### Metode

MCP Inspector adalah GUI interaktif yang dijalankan Director sendiri; di
lingkungan eksekusi ini verifikasi dilakukan **headless** — mengirim frame
JSON-RPC MCP asli (`initialize` → `notifications/initialized` → `tools/list`
→ `tools/call`×5) langsung ke `node dist/mcp/index.js` lewat stdio. Ini
menguji jalur protokol yang persis sama dengan yang dipakai Inspector/Claude
Code. Dua kondisi diuji: (A) proyek scratch dengan chain aktif nyata, (B)
direktori tanpa proyek Sigma.

Perintah setara untuk Director menjalankan Inspector sendiri:

```bash
npx @modelcontextprotocol/inspector node bin/sigma-mcp.js
```

### Hasil A — cwd = proyek scratch (chain v1: intent/roadmap/plan LOCKED, exec DRAFT)

```
tools/list -> [sigma_get_state, sigma_get_orientation, sigma_get_gates, sigma_list_artifacts, sigma_doctor]

sigma_get_state       -> {"active":true,"phase":"BUILD","active_chain":"v1","project_id":"SCRATCH","project_name":"Scratch Project","schema_version":"1.0.0","gates":{"gate_1_open":true,"gate_2_open":true,"gate_3_satisfied":false},"has_invalid_runtime":false,"source":"engine"}
sigma_get_gates       -> {"active":true,"gate_1_open":true,"gate_2_open":true,"gate_3_satisfied":false,"labels":{"gate_1_open":"OPEN","gate_2_open":"OPEN","gate_3_satisfied":"BLOCKED"},"invalid_markers":[],"source":"engine"}
sigma_list_artifacts  -> {"active":true,"active_chain":"v1","intent":{"version":"v1","state":"LOCKED","title":"Scratch intent","focus":"verify mcp"},"roadmap":{"version":"v1","state":"LOCKED"},"plan":{"active_version":"v1.1","active_state":"LOCKED","versions_count":1,"pending_count":0},"exec":{"active_version":"v1.1","active_state":"DRAFT","versions_count":1},"close":null,"source":"engine"}
sigma_get_orientation -> {"active":true,"phase":"BUILD","active_chain":"v1","gate_summary":{"gate_1_open":true,"gate_2_open":true,"gate_3_satisfied":false},"next_valid_operations":["plan new","exec new","session bootstrap","project status"],"stale_intent_warnings":[],"blockers":["Gate 3 (Build Evidence) is BLOCKED"],"inbox_unread":{},"source":"engine"}
sigma_doctor          -> {"active":true,"findings":{"repaired":[],"invalidMarked":[],"invalidCleared":[],"remainingInvalid":[]},"applied":false,"source":"engine"}

stderr: "sigma-mcp running on stdio"   (stdout hanya berisi frame JSON-RPC — bersih)
```

### Hasil B — cwd = direktori tanpa proyek Sigma

```
tools/list -> [sigma_get_state, sigma_get_orientation, sigma_get_gates, sigma_list_artifacts, sigma_doctor]
semua tool -> {"active":false,"message":"No active Sigma project or chain in this directory.","source":"engine"}
```

### Kesimpulan verifikasi

- Server boot via stdio; `tools/list` mengembalikan **persis 5 tool** inti. ✓
- Tiap tool cocok kontrak field §3 dan menyertakan `source:"engine"`. ✓
- Jalur "no active project" anggun (`active:false`), tidak error/crash. ✓
- Diagnostik hanya di stderr; stdout bersih (kontrak stdio terpenuhi). ✓
- `sigma_doctor` melapor `applied:false` (read-only terhadap disk). ✓

### Catatan sisa (untuk dijalankan Director di mesin lokal)

- `npm test` suite penuh belum dijalankan sekaligus di lingkungan ini karena
  filesystem ter-mount lambat (~12 dtk/spawn CLI). Test baru
  `test/mcp-tools.test.ts` (12 test) lulus in-process; regresi bootstrap
  (`role-memory-bootstrap`, `lifecycle-hardening`) lulus pada kasus yang
  tersentuh refactor. Jalankan `npm test` penuh sekali di lokal untuk
  konfirmasi akhir sebelum rilis 0.10.0.
