# RESULT-IMPL — Sigma MCP Batch 1

**Plan**: `PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` (APPROVED Batch 1, keputusan Q1–Q6 di §21.1)
**Tanggal**: 2026-09-15
**Scope dieksekusi**: Stage 0 + Stage A + Stage B1
**Status**: **Stage 0 SELESAI. Gate 0.5 dan Gate B1 REOPENED oleh review Codex, perbaikan R-01…R-09 selesai, menunggu re-review.**
**Commit/push**: branch `hermes-integration`, di-push atas otorisasi Director. Tidak di-merge ke `main`.

> **Revisi 2026-09-15.** Versi pertama dokumen ini menutup Gate 0.5 sebagai `runtime UNPROVEN` atas dasar klaim bahwa lab Hermes memakai binary global yang lama. **Klaim itu salah** dan dikoreksi di §6. Setelah Director mengotorisasi `npm link`, pemeriksaan pertama menunjukkan global `sigma-mcp` sudah berupa symlink ke repo ini sejak sebelum Batch 1 — sehingga `npm link` tidak diperlukan dan smoke test runtime dapat langsung dijalankan.

---

## 1. Status gate

| Gate | Hasil | Dasar |
|---|---|---|
| Stage 0 | SELESAI | Capability matrix 59 operasi + 3 mismatch registry terdokumentasi |
| Gate 0.5 (Stage A) | **REOPENED** | R-01…R-04, R-06…R-10 CLOSED. R-05 sebagian: discovery/binding/isolasi terbukti via Hermes (§14), pemanggilan tool belum — butuh credential Director |
| Gate B1 (Stage B) | **REOPENED** | R-01 dan R-10 CLOSED; 10 regression test pada reader artifact (§11, §13), menunggu re-review terakhir |

## 2. Bukti eksekusi

| Perintah | Hasil |
|---|---|
| `npm run build` (`tsc`) | Bersih, nol error |
| `npm test` | **50 file / 536 test pass** (519 → 532 setelah review pertama → 536 setelah R-10) |
| Smoke test runtime (§6.2) | **32 assertion, ALL CHECKS PASSED**, out-of-process terhadap lab `HERMESLAB` |
| Baseline pra-Batch 1 | 49 file / 487 test pass |
| Delta | +1 file, +45 test. **Nol test hilang, nol test di-skip** |
| `git diff --check` | Bersih (satu warning CRLF pada `dist/` yang sudah ada sebelumnya) |

### 2.1 Mutation check

Test hijau pada percobaan pertama bukan bukti bahwa test-nya menyentuh sesuatu. Guard binding karena itu diuji dengan sengaja dirusak: `assertCallRootAllowed` diubah menjadi `if (false)`, lalu suite dijalankan ulang.

```
× binding — isolation (§16.1) > a per-call project_root naming another project is a BOUNDARY_VIOLATION
  Tests  1 failed | 31 passed (32)
```

Guard dikembalikan dan build diverifikasi ulang. Test tersebut nyata, bukan tautologi.

## 3. Yang diimplementasikan

### 3.1 Stage 0 — inventory dan contract freeze

`SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md`: seluruh 59 operasi registry diklasifikasi ke tier Q (24) / W1 (16) / W2 (11) / W3 (8), masing-masing dengan owner role turunan dan status `implemented`/`deferred`/`not_admissible`.

Tiga temuan yang mengubah desain, bukan sekadar catatan:

1. **`notion` tidak ada di registry sama sekali.** Delapan subcommand (`setup`, `enable`, `disable`, `status`, `push`, `pull-state`, `pull`, `progress`) terdaftar di `src/cli.ts` dan tidak satu pun di `SIGMA-OPERATION-REGISTRY.json`. Seluruh permukaan credential dan sinkronisasi eksternal tidak terlihat oleh registry. Konsekuensi: enforcement **tidak boleh** berbasis lookup registry — operasi yang tidak ada akan terbaca sebagai "tidak dibatasi", bukan "terlarang". Policy karena itu dibangun sebagai allowlist eksplisit.
2. **`scan` read-only tetapi tidak admissible.** Ia menerima path file arbitrary; mengeksposnya sama dengan `sigma_read_file` berkedok. Bukti bahwa `level` registry bukan penentu admissibility.
3. **`roadmap_lock` tidak ada.** Roadmap menjadi `LOCKED` hanya sebagai efek samping `close lock`. Plan sudah dikoreksi dari kondisional menjadi pernyataan faktual.

Juga tercatat: **lima dari sembilan tool Batch 1 tidak punya padanan operasi registry**. Surface MCP dan registry beririsan, bukan subset satu sama lain — sehingga "parity dengan registry" bukan target yang bermakna.

### 3.2 Stage A — binding dan response contract

**`src/mcp/binding.ts` (baru).** Binding di-resolve sekali di startup dari argumen proses tepercaya saja. Tiga hasil: `verified` (root + project_id cocok), `bound` (root tanpa verifikasi identity), `discovery` (tanpa root, fallback legacy). Canonicalisasi memakai `realpathSync.native` — itu yang benar-benar menyelesaikan junction Windows dan memulihkan casing on-disk; perbandingan case-insensitive hanya pada win32.

**`src/mcp/contract.ts` (baru).** Envelope `{ contract_version, tool, binding, snapshot, ...payload }`, 14 error code beku, dan `state_revision` deterministik atas tiga file (`.sigma-identity.json`, `Sigma/activate_status.json`, `Sigma/progress-v<N>.json`). Error tak bertipe di-anonimkan menjadi `INTERNAL_ERROR` sehingga teks engine dan host path tidak pernah sampai ke model.

**`src/mcp/shared.ts`.** `resolveRoot()` dipertahankan tetapi kini short-circuit ke binding bila ada. Ia diberi peringatan eksplisit sebagai jalur discovery-only.

**`src/mcp/index.ts`.** Binding dibentuk sebelum transport tersambung; `BindingError` mematikan proses dengan exit code 2, bukan membiarkannya melayani proyek mana pun yang kebetulan ditemukan. `roots/list` hanya ditanyakan dalam discovery mode — server terikat tidak membiarkan gagasan client tentang workspace memengaruhinya.

**`src/utils/mcpConfig.ts`.** Entri config berubah dari `args: [root]` menjadi `args: ["--mode","query","--project-root",root,"--project-id",id]`. `project_id` dibaca langsung dari `.sigma-identity.json` sehingga seluruh call site lama tidak berubah.

### 3.3 Stage B1 — policy dan bounded artifact read

**`src/mcp/policy.ts` (baru).** Tabel tier adalah allowlist eksplisit hasil transkripsi capability matrix, bukan turunan field registry — alasannya tertulis di kepala file. Operasi yang tidak ada di tabel → `forbidden`. Payload menyatakan `advisory: true` dan `enforcement: "server-side, re-checked per command"` secara harfiah, supaya model tidak membaca proyeksi sebagai izin.

**`sigma_read_artifact`.** Menerima `type` + `version`, **tidak pernah** path. File di atas 512 KB **ditolak, bukan dipotong** — dokumen governance terpotong yang dibaca sebagai utuh lebih berbahaya daripada gagal baca.

> Versi pertama menyelesaikan path dari field `file` milik chain tracker dan hanya memastikan hasilnya berada di dalam bound root. Itu batas yang salah, dan reviewer membuktikannya dengan membaca `.env` — lihat R-01 di §11. Sejak perbaikan, path **diturunkan** dari layout kanonik per tipe+versi dan tracker hanya boleh memilih di antaranya, tidak pernah memperkenalkan path baru.

## 4. Deviasi terhadap plan

Tiga, semuanya disengaja.

1. **`structuredContent` tanpa `outputSchema`.** Verifikasi SDK 1.29.0: `validateToolOutput` hanya berjalan bila tool mendeklarasikan `outputSchema`, dan sisi client menolak keras bila skema ada tetapi structured content tidak cocok. Mendeklarasikan skema sekarang akan membekukan setiap bentuk payload menjadi hard error di client pada drift sekecil apa pun. Batch 1 mengambil representasi terstrukturnya tanpa mengambil kopling itu. Plan §8.3 tidak mewajibkan `outputSchema`, jadi ini tetap patuh.

2. **Guard writer diperluas dari `tools/` ke seluruh `src/mcp/`.** Guard lama hanya memindai direktori `tools/`, sehingga `binding.ts`, `contract.ts`, dan `policy.ts` tidak akan pernah diperiksa. `src/mcp/control/` sengaja **tidak** dikecualikan: saat Stage C membuatnya, guard ini harus gagal keras supaya pemisahannya dilakukan sadar, bukan diwarisi diam-diam.

3. **`sigma_get_memory` menambah field `source_path_fingerprint`.** Diperlukan agar redaksi §8.1 tetap dapat dikorelasikan. Aditif; bernilai `null` pada binding tak terverifikasi.

## 5. Risiko yang masih terbuka

| Risiko | Status |
|---|---|
| Config terpasang masih bentuk posisional | Terbukti berfungsi sebagai `bound`/unverified (§6.2 kasus A). Menjadi `verified` hanya setelah Director menjalankan `project sync` |
| Global `sigma-mcp` adalah symlink ke working tree | Setiap `npm run build` di repo ini langsung mengubah perilaku seluruh client MCP di host. Bukan temuan Batch 1, tetapi baru terlihat sekarang dan layak Director ketahui |
| Role binding hanya sekuat pemilik proses | Sudah masuk kriteria berhenti §22; memblokir Stage C di luar host lokal |
| `dist/` ter-track di git | Build mengubah 20 file `dist/`. Konvensi repo yang sudah ada, tidak saya ubah |
| Konflik semantik `inbox_read`/`memo_read` | Terdokumentasi di plan §9.1; keputusan milik Stage B2 |

## 6. Bukti runtime Gate 0.5

### 6.1 Koreksi: `npm link` tidak pernah diperlukan

Versi pertama dokumen ini menyatakan lab Hermes "masih memakai binary lama". Itu **keliru**, dan saya tidak memverifikasinya sebelum menulisnya. Pemeriksaan aktual:

```
%APPDATA%\npm\node_modules\sigma-ecosystem -> I:\Works\Project\sigma-ecosystem   (symlink, 2026-09-15 07:38)
%APPDATA%\npm\sigma-mcp.cmd                 -> ...\node_modules\sigma-ecosystem\bin\sigma-mcp.js
```

Global `sigma-mcp` sudah merupakan symlink ke repo ini **sejak sebelum Batch 1 dimulai**. Artinya lab Hermes selalu menjalankan `dist/` repo ini, dan kode Stage A sudah terjangkau lewat path global begitu `npm run build` selesai — dikonfirmasi dengan membaca `binding.js` melalui path global dan menemukan marker `BINDING_REQUIRED`.

Konsekuensinya, penahanan Gate 0.5 pada versi pertama didasarkan pada asumsi yang tidak diperiksa, bukan pada batas teknis yang nyata. Otorisasi `npm link` dari Director tetap yang membuka pemeriksaan ini — tetapi tindakannya sendiri tidak dibutuhkan, dan **tidak ada perubahan host yang dilakukan**.

### 6.2 Smoke test out-of-process

Skrip: `Implementation/sigma-mcp/evidence/gate05-runtime-smoke.mjs` — dapat dijalankan ulang, path host sebagai parameter.

```
node Implementation/sigma-mcp/evidence/gate05-runtime-smoke.mjs <LAB_ROOT>
```

Ini bukan in-process reference client. Ia men-spawn subprocess nyata atas file yang sama dengan yang dieksekusi shim global, berbicara JSON-RPC lewat stdio, terhadap proyek lab `HERMESLAB` yang sesungguhnya.

| Kasus | Hasil |
|---|---|
| **A — config lama × binary baru** (§7.4 sel kiri-atas) | 9 tool ditemukan; `project_id` HERMESLAB; `binding.kind=bound`, `verified=false`; fingerprint ada, root absolut tidak bocor |
| **B — config baru × binary baru** | `binding.kind=verified`, `verified=true`; `state_revision` valid; `sigma_verify_binding` usable; ekspektasi keliru dilaporkan tanpa memindah binding; enam tool Phase 0 tetap `active`+`source:engine`; policy meliputi 59 operasi dan menyatakan diri advisory; tidak ada operasi `implemented` yang bukan `observe`; `read_artifact` mengembalikan intent v1 dengan path relatif |
| **B negatif — cross-project** | `project_root` ke proyek lain ditolak `BOUNDARY_VIOLATION`; penolakan tidak membocorkan detail proyek lain |
| **C — `--project-id` salah** | Proses menolak start, exit code 2, `PROJECT_ID_MISMATCH` di stderr, tidak satu pun ID di-echo |
| **D — control mode tanpa binding** | Proses menolak start, exit code 2, `BINDING_REQUIRED` di stderr |
| **Non-mutasi** | **41/41 file governance lab byte-identical** sebelum dan sesudah seluruh pemanggilan di atas |

`ALL CHECKS PASSED` — 30 assertion, nol gagal.

Perhatikan kasus A: `.mcp.json` lab masih berbentuk posisional dan **tidak saya ubah**. Sel kompatibilitas itu karena itu terbukti pada config produksi apa adanya, bukan pada fixture.

## 7. Daftar file berubah

**Baru — source (6)**
`src/mcp/binding.ts`, `src/mcp/contract.ts`, `src/mcp/policy.ts`, `src/mcp/tools/verifyBinding.ts`, `src/mcp/tools/effectivePolicy.ts`, `src/mcp/tools/readArtifact.ts`

**Baru — test (1)**
`test/mcp-binding.test.ts` (32 test)

**Baru — dokumen (2)**
`Implementation/sigma-mcp/SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md`, dokumen ini

**Diubah — source (9)**
`src/mcp/index.ts`, `src/mcp/shared.ts`, `src/mcp/tools/{state,gates,artifacts,doctor,orientation,memory}.ts`, `src/utils/mcpConfig.ts`

**Diubah — lain (4)**
`bin/sigma-mcp.js`, `test/mcp-tools.test.ts`, `test/mcp-config.test.ts`, `Implementation/sigma-mcp/README.md`

**Diubah — plan (1)**
`Implementation/sigma-mcp/PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` — 11 koreksi faktual + §21.1 keputusan Q1–Q6

**`dist/` (20 file)** — artefak build, ter-track mengikuti konvensi repo.

**Tidak disentuh**: lima file milik Director yang sudah termodifikasi sejak awal sesi (`Discussion/2026-09-15_...`, `Implementation/hermes/*`). Per §20.3 aturan 2, working tree existing diperlakukan sebagai milik Director.

## 8. Yang tidak dikerjakan

Sesuai §20.2: nihil `sigma-control`, nihil write tool, nihil approval/idempotency store, nihil Stage B2/C/D/E, nihil perubahan profile Hermes, nihil perubahan config global Codex/Claude/Reasonix/Gemini/host.

**Commit/push dikerjakan** atas otorisasi eksplisit Director setelah implementasi selesai — ke branch `hermes-integration`, tidak ke `main`. Versi pertama dokumen ini menyatakan "nihil commit/push" di bagian ini sekaligus "dua commit sudah di-push" di header; kontradiksi itu (reviewer finding R-09) dikoreksi di sini. Status aktual tercatat di header.

`sigma project start` dan `sigma project sync` **tidak pernah dijalankan** selama batch ini — caveat Phase 0 §5.2 membuktikan keduanya menyentuh config global. Perubahan `mcpConfig.ts` diverifikasi hanya lewat fixture disposable di `test/mcp-config.test.ts`.

## 9. Paket review

Untuk review Codex sesuai §20.5: source diff, output test lengkap (§2), capability matrix, dokumen ini, dan mutation check (§2.1). Yang paling layak diperiksa keras:

1. Apakah `assertCallRootAllowed` + `resolveRoot` short-circuit benar-benar menutup **seluruh** jalur re-resolusi, termasuk yang belum terpikir.
2. Apakah containment check `sigma_read_artifact` tahan terhadap junction Windows, bukan hanya `..`.
3. Apakah `structuredContent` tanpa `outputSchema` benar keputusan yang tepat, atau menunda masalah.
4. Apakah tier pada capability matrix dapat dipertahankan, khususnya `plan_promote` dan `intent_activate` yang saya naikkan di atas klasifikasi registry.

## 10. REVIEW — Codex (2026-09-15)

**Verdict: REQUEST CHANGES.** Stage 0/capability inventory dapat diterima sebagai dasar kerja, tetapi **Gate 0.5 dan Gate B1 belum PASS**. Build dan seluruh test existing lulus, namun review adversarial menemukan pelanggaran boundary, lifecycle proses, dan snapshot contract yang tidak dicakup test tersebut.

**Baseline review**: commit `d65d183` (implementasi) dan `8e2506c` (runtime evidence), pada branch `hermes-integration` dengan HEAD `8e2506c`. Review ini tidak mengubah source implementasi.

### 10.1 Ringkasan status gate

| Area | Klaim result | Hasil review | Alasan utama |
|---|---|---|---|
| Stage 0 — capability/policy inventory | PASS | **PASS dengan catatan** | Matrix dan deny-by-default direction berguna; gap registry `notion` dicatat dengan benar. |
| Gate 0.5 — binding + query contract | PASS | **FAIL / reopen** | Entrypoint memulai dua server, snapshot dapat memakai chain yang salah, live identity drift tidak ditolak, dan evidence belum berasal dari Hermes sebagai consumer aktual. |
| Gate B1 — policy + bounded artifact read | PASS | **FAIL / reopen** | `sigma_read_artifact` dapat diarahkan tracker untuk membaca file arbitrer di dalam project root. |

### 10.2 Temuan blocking

#### R-01 — CRITICAL — `sigma_read_artifact` bukan bounded governance read

`candidatesFor()` mempercayai nilai `file` dari progress tracker sebagai allowlist (`src/mcp/tools/readArtifact.ts:49-71`). Validasi berikutnya hanya memastikan resolved path masih berada di project root (`src/mcp/tools/readArtifact.ts:75-82,115-147`); tidak ada validasi direktori, pola nama, atau jenis artefak terhadap canonical governance layout.

Probe independen mengubah `intent.file` pada fixture menjadi `.env`, menaruh sentinel di file tersebut, lalu memanggil `computeReadArtifact(root, 'intent')`. Hasilnya:

```json
{"present":true,"path":".env","secretReturned":true}
```

Artinya progress tracker yang rusak/manipulatif dapat mengubah query artefak menjadi pembaca file arbitrer di dalam project, termasuk material D3 seperti `.env`. Ini bertentangan langsung dengan syarat Gate B1 pada plan: caller tidak boleh membaca arbitrary path/project/role.

**Perbaikan wajib**: treat tracker path as untrusted; validasi terhadap allowlist lokasi dan filename per artifact type, gunakan canonical/real path, dan baca dari handle/file identity yang sudah diverifikasi untuk mengurangi celah check-to-read. Tambahkan negative test untuk `.env`, file source biasa, cross-type path, junction/symlink, dan perubahan file di antara check/read.

#### R-02 — CRITICAL — executable memulai dua MCP server pada stdio yang sama

`src/mcp/index.ts:94-103` menganggap module sebagai entrypoint bila `require.main.filename` berakhir dengan `sigma-mcp.js` dan memanggil `startMcpServer()`. Pada saat yang sama, `bin/sigma-mcp.js:2-10` me-require module itu lalu memanggil `startMcpServer()` lagi.

Probe terhadap executable nyata menunjukkan dua pesan startup dan **dua JSON-RPC response identik untuk satu request `initialize` dengan id yang sama**. Ini adalah pelanggaran lifecycle/protocol dan dapat menimbulkan perilaku nondeterministik pada consumer. Smoke SDK yang dilaporkan tidak mendeteksi response duplikat tersebut.

**Perbaikan wajib**: hanya satu layer yang memiliki startup side effect; module library sebaiknya hanya mengekspor fungsi, sedangkan bin menjadi satu-satunya entrypoint. Tambahkan transport test yang menyatakan tepat satu startup dan tepat satu response untuk setiap request id.

#### R-03 — HIGH — `state_revision` mengikuti pointer mentah, bukan active chain efektif

`computeStateRevision()` membaca `activate_status.active_chain` langsung lalu meng-hash `progress-${activeChain}.json` (`src/mcp/contract.ts:67-105`). Engine Sigma sendiri dapat memulihkan pointer stale/missing/superseded melalui resolver active-chain. Karena resolver yang dipakai snapshot berbeda dari resolver payload tool, metadata dan isi respons dapat berbicara tentang chain berbeda.

Probe dengan manifest menunjuk `v99` sementara engine memilih progress valid `v1` menghasilkan:

```json
{"engineActiveChain":"v1","snapshotActiveChain":"v99","revisionChanged":false}
```

Perubahan bytes `progress-v1.json` tidak mengubah revision. Ini merusak konsistensi query sekarang dan akan membuat proteksi stale-state Stage C/D tidak aman.

**Perbaikan wajib**: resolve active chain melalui satu primitive engine yang sama, lalu hash file chain efektif yang benar. Tambahkan regression test untuk stale pointer, missing pointer, superseded chain, dan perubahan bytes pada chain efektif.

#### R-04 — HIGH — verified binding tidak mendeteksi penggantian identity setelah startup

`computeVerifyBinding()` hanya membandingkan expectation dengan binding yang di-cache saat startup (`src/mcp/tools/verifyBinding.ts:17-46`). Ia tidak membaca ulang `.sigma-identity.json` pada bound root.

Probe mengganti project ID live dari `HERMESLAB` menjadi `REPLACED` setelah binding terbentuk. Hasilnya:

```json
{"verifyUsableAfterIdentityReplacement":true,"cachedBindingProjectId":"HERMESLAB","liveStateProjectId":"REPLACED"}
```

Server tetap mengaku usable/verified sambil menyajikan state dengan identity lain. Untuk proses orchestrator berumur panjang, ini adalah kegagalan fail-closed.

**Perbaikan wajib**: re-attest identity bound pada setiap request atau invalidasi binding saat identity revision berubah; mismatch wajib menghasilkan typed `BOUNDARY_VIOLATION`. Definisikan pula `usable` agar tidak `true` untuk binding yang tidak verified ketika dipakai consumer required-binding.

#### R-05 — HIGH — evidence runtime bukan evidence Hermes aktual

Skrip `Implementation/sigma-mcp/evidence/gate05-runtime-smoke.mjs:11,63-64` memakai MCP SDK `Client` + `StdioClientTransport` sendiri. Ini valid sebagai **reference-client subprocess test**, tetapi bukan eksekusi melalui Hermes/profile `sigma-lab`.

Plan mensyaratkan reference client **dan Hermes** membaca state yang sama (`PLAN...:423`) serta runtime smoke Hermes bila environment tersedia (`PLAN...:635`). Dokumen result belum memperlihatkan bukti discovery/call melalui proses Hermes, child environment credential probe, atau hasil sembilan tool dari consumer tersebut. Karena itu evidence saat ini tidak cukup untuk menaikkan Gate 0.5 menjadi PASS—terlebih executable ternyata menghasilkan response duplikat.

**Perbaikan wajib**: setelah R-02 selesai, rekam smoke aktual dari Hermes `sigma-lab`: daftar nama tool yang ditemukan, binding `HERMESLAB`, panggilan sembilan query, cross-project rejection, parity `structuredContent`/text, dan credential child-environment probe tanpa membocorkan secret.

### 10.3 Temuan non-blocking tetapi harus ditutup dalam Batch 1

#### R-06 — MEDIUM — error `sigma_get_memory` masih membocorkan absolute host path

`computeMemory()` menangkap exception engine lalu memasukkan raw `Error.message` ke payload sukses (`src/mcp/tools/memory.ts:12-39`). Karena exception tidak mencapai wrapper `respond()`, mekanisme anonymization tidak berjalan. Fixture dengan JSON memory korup mengembalikan pesan seperti `Failed to parse role memory file at C:\\Users\\...\\fmn-memory.json` pada verified binding.

**Perbaikan**: lempar typed error melalui response wrapper atau sanitasi message sebelum menjadi payload; tambahkan assertion bahwa error verified-binding tidak memuat absolute path/user directory.

#### R-07 — MEDIUM — writer Reasonix tidak bermigrasi ke verified binding

Writer umum membentuk argumen `--mode query --project-root ... --project-id ...` (`src/utils/mcpConfig.ts:73-79`), tetapi `makeReasonixPluginBlockLines()` masih menulis hanya `[projectRoot]` (`src/utils/mcpConfig.ts:249-257`). Test justru mengunci bentuk lama (`test/mcp-config.test.ts:390-392,405-410`). Akibatnya `sigma project sync` tidak dapat memigrasikan Reasonix ke `binding_verified:true`, tidak konsisten dengan komentar dan kontrak migrasi config baru.

**Perbaikan**: gunakan builder binding yang sama dengan escaping TOML yang benar dan tambahkan fixture Reasonix dengan `.sigma-identity.json`.

#### R-08 — MEDIUM — tiga tool baru tidak membawa MCP safety annotations

Registrasi `sigma_verify_binding`, `sigma_get_effective_policy`, dan `sigma_read_artifact` tidak menyertakan `annotations`, sementara enam tool existing menyatakan `readOnlyHint`, `destructiveHint`, `idempotentHint`, dan `openWorldHint`. Ini membuat metadata query-plane tidak seragam bagi orchestrator.

**Perbaikan**: tambahkan annotation read-only/non-destructive/idempotent/closed-world yang sama dan assertion pada tool-list transport test.

#### R-09 — LOW — result report kontradiktif mengenai commit/push

Header menyatakan dua commit sudah di-push (`§ awal:7`), sedangkan §8 menyatakan “nihil commit/push/publish” (`§8:159`). Perbaiki menjadi fakta aktual dan, bila relevan, catat otorisasi Director serta commit yang termasuk Batch 1.

### 10.4 Verifikasi yang lulus

- `npm.cmd run build`: **PASS**.
- Targeted MCP suite: `test/mcp-binding.test.ts`, `test/mcp-tools.test.ts`, `test/mcp-config.test.ts`: **3 file / 81 test PASS**.
- Full suite: **50 file / 519 test PASS**. Eksekusi sandbox pertama terhalang `EPERM` ketika fixture Notion mengakses lokasi temp/home Windows; rerun dengan akses host yang sesuai lulus seluruhnya.
- `git diff --check`: tidak menemukan whitespace error pada source review; hanya warning normalisasi CRLF/LF pada tracked `dist/engine/notionService.js`.
- Scope utama terjaga: tidak ada command/write/control tool baru; policy projection eksplisit advisory dan arah allowlist lebih aman daripada menganggap operasi yang tidak ada di registry sebagai allowed.

Passing test di atas adalah sinyal regresi yang baik, tetapi tidak menutup temuan adversarial R-01 sampai R-05.

### 10.5 Syarat re-review

1. Tutup R-01 sampai R-05 dan tambahkan regression test yang mereproduksi setiap probe.
2. Tutup R-06 sampai R-08 dalam Batch 1; koreksi narasi R-09.
3. Jalankan build, targeted suite, full suite, transport single-response test, dan non-mutation hash check.
4. Lampirkan evidence **Hermes aktual**, terpisah dari reference-client smoke.
5. Jangan mulai Stage B2/C atau mengaktifkan command plane sebelum Gate 0.5 dan B1 kembali direview dan dinyatakan PASS.

## 11. Tanggapan atas review Codex (2026-09-15)

Kesembilan temuan direproduksi secara independen sebelum diperbaiki. **Tidak ada yang dibantah.** Setiap probe kini menjadi regression test.

### 11.1 Status per temuan

| # | Sev | Status | Perbaikan | Regression test |
|---|---|---|---|---|
| R-01 | CRITICAL | **FIXED** | Tracker menjadi input tidak tepercaya. Path diturunkan dari layout kanonik per tipe+versi (`LAYOUT` + `VERSION_RE`), bukan dibaca dari tracker; realpath harus tetap mendarat di lokasi kanonik itu; baca lewat file descriptor (`openSync`/`fstatSync`/`readSync`) | 6 test: `.env`, cross-type dir, filename beda versi, versi path-shaped, symlink di lokasi kanonik, dan satu test bahwa artefak sah **tetap terbaca** |
| R-02 | CRITICAL | **FIXED** | Blok auto-start `isEntrypoint` dihapus dari `src/mcp/index.ts`; `bin/sigma-mcp.js` jadi satu-satunya entrypoint | Spawn binary nyata, hitung baris startup dan frame per request id |
| R-03 | HIGH | **FIXED** | `computeStateRevision()` memakai `resolveActiveChainVersion()` dari engine — resolver yang sama dengan payload tool | Pointer `v99` + edit `progress-v1.json` → revision bergerak |
| R-04 | HIGH | **FIXED** | `assertIdentityUnchanged()` dipanggil di `respond()` setiap request; `usable` kini mensyaratkan binding **verified**, bukan sekadar bound | Identity swap → `BOUNDARY_VIOLATION`; positional config → `usable:false` |
| R-05 | HIGH | **BELUM** | Perlu keputusan Director — lihat §11.3 | — |
| R-06 | MEDIUM | **FIXED** | `catch` tidak lagi meneruskan `Error.message`; mengembalikan kode stabil + pesan generik | Memory file korup → payload tidak memuat path host |
| R-07 | MEDIUM | **FIXED** | `makeReasonixPluginBlockLines()` memakai `makeMcpEntry()` yang sama | Fixture Reasonix dengan identity → `--project-id` hadir; satu test bahwa semua writer sepakat |
| R-08 | MEDIUM | **FIXED** | Annotations pada tiga tool baru | Transport test menegaskan **semua** tool punya annotations seragam |
| R-09 | LOW | **FIXED** | §8 dan header diselaraskan | — |

### 11.2 Bukti setelah perbaikan

| | Sebelum | Sesudah |
|---|---|---|
| R-01 probe `.env` | `{present:true, secretReturned:true}` | `BOUNDARY_VIOLATION` |
| R-01 artefak sah | terbaca | **tetap terbaca** — perbaikan tidak mematikan tool |
| R-02 satu `initialize` | 2 startup, 2 frame id=1 | 1 startup, 1 frame |
| R-03 pointer `v99` | snapshot `v99`, revision tidak bergerak | snapshot `v1`, revision bergerak |
| R-04 identity swap | `usable:true` sambil menyajikan `REPLACED` | `BOUNDARY_VIOLATION` |

Suite: **50 file / 532 test PASS** (dari 519; +13, nol hilang). Build `tsc` bersih. Smoke runtime: **32 assertion PASS**, termasuk CASE E baru.

### 11.3 Catatan atas R-02 dan R-05

**R-02 mendahului Batch 1.** `git show d65d183^` menunjukkan blok `isEntrypoint` dan pemanggilan `startMcpServer()` di `bin/` keduanya sudah ada sebelum pekerjaan ini. Artinya **Phase 0 dinyatakan PASS dengan cacat ini aktif**, dan tidak terdeteksi oleh evidence Phase 0 maupun oleh smoke Batch 1. Konsekuensi yang melampaui temuannya: setiap sesi MCP Sigma di host ini menerima response ganda sejak Phase 0, dan klaim Phase 0 sebaiknya diperiksa ulang atas dasar itu.

Kenapa smoke saya tidak menangkapnya: SDK `Client` mengkorelasikan response pertama ke request id lalu membuang sisanya, sehingga server yang menjawab dua kali terlihat sehat. CASE E kini membaca frame stdio mentah, di luar client.

**R-05 belum dikerjakan dan bukan karena tidak setuju.** Codex benar bahwa evidence saat ini adalah reference-client subprocess, bukan Hermes sebagai consumer aktual, dan plan §16.5 memang mensyaratkan yang kedua. Menjalankannya berarti menyalakan profile Hermes `sigma-lab` dan merekam discovery/call dari sana — menyentuh runtime Hermes, di luar otorisasi yang ada. Menunggu keputusan Director: saya yang menjalankan, atau Director menjalankan dengan skrip verifikasi yang saya siapkan.

Sampai R-05 tertutup, **Gate 0.5 dan Gate B1 tetap REOPENED**. Dokumen ini tidak menaikkannya sendiri.

## 12. RE-REVIEW — Codex (2026-09-15)

**Verdict tetap: REQUEST CHANGES.** Commit `36802a2` benar sudah berada di `origin/hermes-integration`. Perbaikan R-02, R-03, R-04, R-06, R-07, R-08, dan R-09 diterima. Eksploitasi `.env` pada R-01 tertutup untuk layout folder saat ini, tetapi implementasinya menimbulkan regresi kompatibilitas baru (R-10). R-05 tetap terbuka sesuai pengakuan implementer.

### 12.1 Status temuan setelah re-review

| Temuan | Hasil re-review | Catatan |
|---|---|---|
| R-01 | **FIXED untuk arbitrary tracker path; follow-up R-10** | `.env`, cross-type, path-shaped version, dan symlink statis ditolak; artefak layout baru tetap terbaca. |
| R-02 | **CLOSED** | Binary nyata menghasilkan satu startup dan satu response untuk request `initialize`. |
| R-03 | **CLOSED** | Snapshot memakai active-chain resolver engine dan revision bergerak ketika chain efektif berubah. |
| R-04 | **CLOSED** | Identity diverifikasi ulang per request; swap menghasilkan `BOUNDARY_VIOLATION`; unverified binding tidak lagi `usable`. |
| R-05 | **OPEN** | Belum ada evidence dari Hermes sebagai consumer aktual. |
| R-06 | **CLOSED** | Error memory tidak lagi meneruskan raw host path. |
| R-07 | **CLOSED** | Reasonix memakai builder binding yang sama dan dapat membawa `--project-id`. |
| R-08 | **CLOSED** | Kesembilan tool memiliki safety annotations yang seragam. |
| R-09 | **CLOSED** | Narasi commit/push telah diselaraskan. |
| R-10 | **OPEN — HIGH** | Artifact reader menolak layout legacy yang masih sah dan didukung engine. |

### 12.2 R-10 — HIGH — hardcoded canonical layout memutus proyek pre-rename

`src/mcp/tools/readArtifact.ts:46-55,104-142` hanya mengizinkan layout baru:

- `Sigma/charter/DIR-INTENT-*`
- `Sigma/roadmap/ROADMAP-*`
- `Sigma/contract/FMN-PLAN-*`
- `Sigma/evidence/DEV-EXEC-*`
- `Sigma/close/DIR-CLOSE-*`

Namun compatibility contract Sigma secara eksplisit mempertahankan stored legacy paths tanpa migrasi. `test/folder-rename-backward-compat.test.ts:23-109` membuktikan CLI masih wajib membaca:

- `Sigma/design/DIR-INTENT-*`
- `Sigma/build/ROADMAP-*`
- `Sigma/build/FMN-PLAN-*`
- `Sigma/build/DEV-EXEC-*`

Probe independen membuat chain lama yang valid dengan `intent.file = "Sigma/design/DIR-INTENT-v1.md"`; CLI compatibility fixture untuk bentuk itu lulus, tetapi MCP reader menghasilkan:

```json
{"legacyArtifactRead":false,"code":"BOUNDARY_VIOLATION","message":"Tracker entry does not point at the canonical location for this artifact type and version."}
```

Akibatnya `sigma_read_artifact` tidak memberi artifact minimum yang sama dengan sumber Sigma pada proyek lama, dan compatibility requirement Gate 0.5 belum terpenuhi. Test “artefak sah tetap terbaca” pada §11.2 hanya mencakup layout baru sehingga tidak menangkap regresi ini.

**Perbaikan wajib**: gunakan allowlist exact-path per tipe+versi yang mencakup layout current **dan legacy**, bukan kembali mempercayai arbitrary tracker path. Tracker hanya boleh memilih salah satu derived path berikut:

| Type | Current | Legacy yang tetap sah |
|---|---|---|
| intent | `Sigma/charter/DIR-INTENT-{v}.md` | `Sigma/design/DIR-INTENT-{v}.md` |
| roadmap | `Sigma/roadmap/ROADMAP-{v}.md` | `Sigma/build/ROADMAP-{v}.md` |
| plan | `Sigma/contract/FMN-PLAN-{v}.md` | `Sigma/build/FMN-PLAN-{v}.md` |
| exec | `Sigma/evidence/DEV-EXEC-{v}.md` | `Sigma/build/DEV-EXEC-{v}.md` |
| close | `Sigma/close/DIR-CLOSE-{v}.md` | sama; tidak ada rename |

Untuk setiap pilihan, realpath tetap harus mendarat pada exact derived location tersebut. Tambahkan regression test MCP untuk keempat legacy path dan pertahankan seluruh negative test R-01.

**Hardening note**: pola check → `openSync` → check mengurangi tetapi tidak menghapus symlink-swap race; file descriptor yang dibaca belum dibuktikan identik dengan target pada check kedua. Ini tidak membuka kembali exploit statis yang direproduksi pada R-01, tetapi klaim TOCTOU sebaiknya dibatasi dan hardening handle identity/`O_NOFOLLOW` dituntaskan sebelum command plane mendapat write capability.

### 12.3 Verifikasi independen putaran kedua

- `npm.cmd run build`: **PASS**.
- Full suite dengan akses fixture host yang sesuai: **50 file / 532 test PASS**. Run sandbox-only gagal pada 20 test karena `EPERM` terhadap global Notion credential fixture, sama seperti putaran pertama; bukan regresi commit ini.
- `node Implementation/sigma-mcp/evidence/gate05-runtime-smoke.mjs <LAB_ROOT>`: **32/32 PASS**, termasuk CASE E dan hash non-mutation 41 file.
- `git diff --check 8e2506c..36802a2`: **PASS**.
- Working tree setelah probe: bersih sebelum penambahan catatan re-review ini; probe sementara telah dihapus.

### 12.4 Keputusan gate dan next action

- **Gate 0.5: REOPENED** — menunggu R-05 dan R-10.
- **Gate B1: REOPENED** — menunggu R-10; arbitrary `.env` read yang asli sudah tertutup.
- Koreksi retrospektif Phase 0 terkait response ganda memang diperlukan. Bukti Phase 0 lama tidak membuktikan single-response; re-run melalui Hermes setelah fix R-02 dapat menjadi bukti penggantinya.
- Setelah R-10 diperbaiki, Director perlu mengotorisasi satu runtime verification melalui Hermes profile `sigma-lab` untuk menutup R-05. Reference-client smoke tidak dapat menggantikannya.

## 13. Tanggapan atas re-review Codex — R-10

**R-10 CLOSED.** Terkonfirmasi sendiri sebelum diperbaiki, dan temuannya benar.

### 13.1 Apa yang salah

Perbaikan R-01 mengganti satu batas yang terlalu longgar dengan satu yang terlalu ketat. Tabel `LAYOUT` saya turunkan dari writer CLI (`src/commands/*.ts`) saja, sehingga hanya memuat folder pasca-rename. Padahal engine menjamin dua-duanya:

```
src/engine/reconstruct.ts:64-68
  intent  : ['charter',  'design']
  roadmap : ['roadmap',  'build']
  plan    : ['contract', 'build']
  exec    : ['evidence', 'build']
  close   : ['close']
```

dan `test/folder-rename-backward-compat.test.ts` membuktikan CLI membaca `Sigma/design/` serta `Sigma/build/` tanpa migrasi, lewat `entry.file` yang tersimpan. Akibatnya: **CLI bisa membaca proyek pra-rename, MCP menolaknya** — persis kriteria berhenti §22, "CLI dan MCP menghasilkan semantics berbeda".

### 13.2 Akar masalah, bukan gejalanya

Tabel layout hidup **dua kali**: sebagai `PATTERNS` di `reconstruct.ts` dan sebagai `LAYOUT` di reader MCP. Dua salinan yang bisa drift — dan sudah drift. Menambal daftar folder di reader hanya memperbaiki gejala.

Perbaikan: `ARTIFACT_LAYOUT` dipindahkan ke `src/config.ts` sebagai satu sumber kebenaran. `reconstruct.ts` menurunkan `PATTERNS` darinya (hanya `docType` yang tetap lokal, karena itu memang urusannya sendiri), dan reader MCP menurunkan daftar path yang diizinkan darinya. Keduanya tidak bisa berbeda lagi tanpa mengubah satu tabel yang sama.

Bonus dari sumber bersama: bentuk versi kini per-tipe seperti engine — `v1` untuk intent/roadmap/close, `v1.1` untuk plan/exec — sebelumnya reader menerima keduanya untuk semua tipe.

### 13.3 R-01 tidak dilemahkan

Syarat Director: perbaiki R-10 **sambil mempertahankan seluruh negative test R-01**. Dibuktikan dengan mutation check, bukan dengan pernyataan. Allowlist dimatikan (`if (allowed.includes(declared))` → `if (false)`), suite dijalankan ulang:

```
× refuses a tracker entry that escapes the project root
× refuses a tracker entry redirected at a dotfile inside the root
× refuses a tracker entry pointing at another artifact type's directory
× refuses a filename that does not match the requested version
× accepting the legacy folder does not accept an arbitrary file in it
  Tests  5 failed | 42 passed (47)
```

Lima negative test menggigit. Guard dikembalikan dan build diverifikasi ulang.

Perhatikan test kelima: ia sengaja menjaga agar pelebaran folder tidak menjadi pelebaran filename. `Sigma/design/` juga memuat `intent-history.md`; menerima folder legacy tidak boleh berarti menerima isi apa pun di dalamnya.

### 13.4 Test baru

| Test | Menjaga |
|---|---|
| intent dari `Sigma/design/` | Layout pra-rename terbaca |
| plan dari `Sigma/build/` | Idem, untuk folder `build` yang dipakai tiga tipe |
| `Sigma/design/intent-history.md` ditolak | Folder legacy ≠ filename bebas |
| versi `v1.1` untuk intent ditolak | Bentuk versi per-tipe seperti engine |

### 13.5 Bukti

| | Hasil |
|---|---|
| `npm run build` | Bersih |
| `npm test` | **50 file / 536 test PASS** (dari 532; +4) |
| Runtime smoke | **32 assertion PASS**, 41/41 file lab byte-identical |
| Mutation check | 5 negative test R-01 gagal saat guard dimatikan |

### 13.6 Status gate

**Gate 0.5 dan B1 tetap REOPENED.** R-10 tertutup, R-05 belum: evidence runtime masih reference-client subprocess, bukan Hermes sebagai consumer aktual. Sesuai urutan yang Director tetapkan, langkah berikutnya adalah otorisasi pengujian melalui profile Hermes `sigma-lab`, lalu re-review terakhir. Dokumen ini tidak menaikkan gate apa pun.

## 14. R-05 — bukti melalui Hermes sebagai consumer aktual

Dijalankan 2026-09-15 atas otorisasi Director, memakai profile `sigma-lab` dan proyek lab `HERMESLAB`. **R-05 sebagian tertutup**; satu bagian tidak dapat diselesaikan sesi ini — lihat §14.4.

Runtime: Hermes Agent `v0.21.3 (2026.9.14)`, upstream `8f785318` — versi yang sama dengan Phase 0.

### 14.1 Temuan pertama: profile tidak terikat sama sekali

Sebelum apa pun dijalankan, `profiles/sigma-lab/config.yaml` berbunyi:

```yaml
mcp_servers:
  sigma:
    command: C:\Users\dikoh\AppData\Roaming\npm\sigma-mcp.cmd
    connect_timeout: 30.0
    enabled: true
```

Tanpa `args`. Consumer nyata karena itu menjalankan server dalam **discovery mode** — tidak terikat, `binding_verified:false`, dan root diselesaikan lewat `resolveRoot()` legacy dari `cwd`. Persis kelemahan yang Stage A dibuat untuk menutup, masih hidup pada konfigurasi consumer.

Ini adalah alasan R-05 ada. Seluruh test contract dan reference-client smoke hijau, dan tidak satu pun dapat melihat fakta ini, karena tidak satu pun membaca konfigurasi consumer.

### 14.2 Yang terbukti

| Bukti | Hasil |
|---|---|
| Discovery tool | **9 tool ditemukan Hermes**, termasuk `sigma_verify_binding`, `sigma_get_effective_policy`, `sigma_read_artifact` |
| Koneksi | `✓ Connected (953ms)`, transport stdio, auth none |
| Binding sebelum perbaikan config | `sigma-mcp running on stdio (mode=query binding=discovery verified=false)` |
| Binding sesudah perbaikan config | `sigma-mcp running on stdio (mode=query binding=verified verified=true)` |
| cwd saat uji | `C:\Users\dikoh` — netral, bukan root proyek; binding tetap `HERMESLAB` |
| Isolasi toolset | Seluruh toolset built-in `disabled`; hanya `sigma  all tools enabled` |
| Non-mutasi | **41/41 file governance lab byte-identical** sebelum dan sesudah seluruh aktivitas |

Baris binding berasal dari `profiles/sigma-lab/logs/mcp-stderr.log` — stderr proses yang **Hermes sendiri** spawn, bukan proses yang saya jalankan.

### 14.3 R-02 terlihat di log Hermes, termasuk secara historis

Log yang sama merekam sesi Phase 0:

```
===== [2026-09-15 15:52:00] starting MCP server 'sigma' =====
sigma-mcp running on stdio
sigma-mcp running on stdio          ← dua server, satu stdio

===== [2026-09-15 19:24:46] starting MCP server 'sigma' =====
sigma-mcp running on stdio (mode=query binding=verified verified=true)   ← satu
```

Dua baris per start pada sesi Phase 0 adalah R-02, terekam oleh consumer nyata pada hari Phase 0 dinyatakan PASS. Ini bukti independen bahwa cacat itu mendahului Batch 1 dan lolos dari evidence Phase 0 — dan bahwa perbaikannya benar-benar sampai ke consumer.

### 14.4 Yang TIDAK terbukti, dan kenapa

**Pemanggilan tool yang digerakkan model belum dijalankan.** Profile lab tidak menyimpan credential — sesuai desain Phase 0 ("credential tidak dipersist ke profile lab"). Satu giliran percobaan gagal bersih:

```
hermes -z: agent failed: No usable credentials found for provider 'deepseek'.
Set DEEPSEEK_API_KEY.
```

Saya **tidak meminta, mencari, atau menyuntikkan** credential apa pun. Karena itu belum terbukti melalui Hermes: paritas isi payload antara Hermes dan CLI, paritas `structuredContent`/text, dan penolakan cross-project pada level pemanggilan. Ketiganya terbukti pada reference-client (§6.2) tetapi bukan pada consumer aktual.

**Probe credential child-environment juga tidak dijalankan.** Percobaannya diblokir oleh guardrail sesi ini sebagai eksplorasi credential, dan saya tidak mengakalinya. Nilainya rendah: Batch 1 tidak mengubah apa pun soal spawn proses, dan Phase 0 §4 sudah membuktikan isolasi ini.

### 14.5 Perubahan yang saya buat pada lingkungan Director

| Perubahan | Detail |
|---|---|
| `profiles/sigma-lab/config.yaml` | Ditambahkan `args:` binding (`--mode query --project-root <lab> --project-id HERMESLAB`) pada entri `mcp_servers.sigma` |
| Backup | `%TEMP%/sigma-lab-config.yaml.bak` — salin kembali untuk mengembalikan keadaan semula |

Saya mempertahankan perubahan ini, bukan mengembalikannya: tanpa `args`, lab kembali ke discovery mode, yang lebih buruk. Tetapi ini profile milik Director dan keputusan akhir ada pada Director.

Tidak ada perubahan lain: profile `default` tidak disentuh, gateway tidak dijalankan, tidak ada entri MCP baru yang tertinggal, dan pohon governance lab tidak berubah satu byte pun.

### 14.6 Status

**Gate 0.5 dan B1 tetap REOPENED.** R-05 belum dapat dinyatakan tertutup penuh: discovery, binding, isolasi, dan non-mutasi terbukti pada consumer aktual, tetapi pemanggilan tool belum. Untuk menutupnya dibutuhkan satu giliran model pada profile `sigma-lab` — keputusan credential yang menjadi milik Director, bukan saya.
