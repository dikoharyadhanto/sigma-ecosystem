# RESULT-IMPL — Sigma MCP Batch 1

**Plan**: `PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` (APPROVED Batch 1, keputusan Q1–Q6 di §21.1)
**Tanggal**: 2026-09-15
**Scope dieksekusi**: Stage 0 + Stage A + Stage B1
**Status**: **Stage 0 SELESAI. Gate 0.5 PASS (contract + runtime). Gate B1 PASS.**
**Commit/push**: branch `hermes-integration`, dua commit, sudah di-push. Tidak di-merge ke `main`.

> **Revisi 2026-09-15.** Versi pertama dokumen ini menutup Gate 0.5 sebagai `runtime UNPROVEN` atas dasar klaim bahwa lab Hermes memakai binary global yang lama. **Klaim itu salah** dan dikoreksi di §6. Setelah Director mengotorisasi `npm link`, pemeriksaan pertama menunjukkan global `sigma-mcp` sudah berupa symlink ke repo ini sejak sebelum Batch 1 — sehingga `npm link` tidak diperlukan dan smoke test runtime dapat langsung dijalankan.

---

## 1. Status gate

| Gate | Hasil | Dasar |
|---|---|---|
| Stage 0 | SELESAI | Capability matrix 59 operasi + 3 mismatch registry terdokumentasi |
| Gate 0.5 (Stage A) | **PASS** | Contract lulus by test; runtime dibuktikan out-of-process terhadap lab `HERMESLAB` — §6 |
| Gate B1 (Stage B) | PASS | `sigma_get_effective_policy` + bounded `sigma_read_artifact` lulus test, nol mutasi |

## 2. Bukti eksekusi

| Perintah | Hasil |
|---|---|
| `npm run build` (`tsc`) | Bersih, nol error |
| `npm test` | **50 file / 519 test pass** |
| Smoke test runtime (§6.2) | **30 assertion, ALL CHECKS PASSED**, out-of-process terhadap lab `HERMESLAB` |
| Baseline pra-Batch 1 | 49 file / 487 test pass |
| Delta | +1 file, +32 test. **Nol test hilang, nol test di-skip** |
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

**`sigma_read_artifact`.** Menerima `type` + `version`, **tidak pernah** path. Path diselesaikan hanya dari `file` pada chain tracker, real path wajib tetap di dalam bound root (inilah yang menahan entri tracker yang menunjuk ke luar), dan file di atas 512 KB **ditolak, bukan dipotong** — dokumen governance terpotong yang dibaca sebagai utuh lebih berbahaya daripada gagal baca.

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

Sesuai §20.2: nihil `sigma-control`, nihil write tool, nihil approval/idempotency store, nihil Stage B2/C/D/E, nihil perubahan profile Hermes, nihil perubahan config global Codex/Claude/Reasonix/Gemini/host, nihil commit/push/publish.

`sigma project start` dan `sigma project sync` **tidak pernah dijalankan** selama batch ini — caveat Phase 0 §5.2 membuktikan keduanya menyentuh config global. Perubahan `mcpConfig.ts` diverifikasi hanya lewat fixture disposable di `test/mcp-config.test.ts`.

## 9. Paket review

Untuk review Codex sesuai §20.5: source diff, output test lengkap (§2), capability matrix, dokumen ini, dan mutation check (§2.1). Yang paling layak diperiksa keras:

1. Apakah `assertCallRootAllowed` + `resolveRoot` short-circuit benar-benar menutup **seluruh** jalur re-resolusi, termasuk yang belum terpikir.
2. Apakah containment check `sigma_read_artifact` tahan terhadap junction Windows, bukan hanya `..`.
3. Apakah `structuredContent` tanpa `outputSchema` benar keputusan yang tepat, atau menunda masalah.
4. Apakah tier pada capability matrix dapat dipertahankan, khususnya `plan_promote` dan `intent_activate` yang saya naikkan di atas klasifikasi registry.
