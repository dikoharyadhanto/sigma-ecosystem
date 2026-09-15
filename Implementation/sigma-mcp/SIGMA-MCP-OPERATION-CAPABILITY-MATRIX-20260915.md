# SIGMA MCP — Operation Capability Matrix

**Deliverable**: Stage 0 dari `PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` §14.
**Tanggal**: 2026-09-15
**Sumber**: `Sigma/SIGMA-OPERATION-REGISTRY.json` (59 operasi) diverifikasi silang terhadap `src/commands/*.ts` dan `src/cli.ts`.
**Status**: Klasifikasi lengkap. Bukan doktrin Sigma dan tidak mengubah registry — lihat §5.

---

## 1. Kenapa dokumen ini ada

Registry Sigma mengklasifikasikan operasi pada dua dimensi: `level` (`semantic` / `read_only` / `system`) dan `role` (`any` / `director`). Kedua dimensi itu **tidak cukup** untuk memutuskan apakah suatu operasi boleh mempunyai primitive MCP, karena:

1. `level` menjawab "apakah ia menulis", bukan "seberapa berbahaya bila ditulis oleh model".
2. `role` hanya mengenal `any` dan `director`. Tidak ada atribusi ARC/FMN/DEV/AUD per operasi, padahal seluruh desain capability per-role bergantung padanya.
3. Registry sendiri menyatakan batasnya: `role_definitions.director` berbunyi *"CLI enforces this by convention — Sigma has no auth layer; governance relies on role discipline."*

Matriks ini menambah dua dimensi turunan — **tier admissibility** dan **owner role** — tanpa menyentuh registry (keputusan Q4, §21.1 plan).

## 2. Definisi tier

| Tier | Arti | Plane |
|---|---|---|
| **Q** | Non-mutating. Aman diekspos selama path resolution terbatas. | Query |
| **W1** | Mutasi project-local, reversible, terbatas pada DRAFT / mailbox / evidence. | Bounded command |
| **W2** | Transisi lifecycle material. Wajib approval Director durable. | Governance transition |
| **W3** | Menyentuh host, config global, sistem eksternal, atau bersifat destruktif. | Di luar control plane |
| **NA** | **Not admissible** — tidak boleh mendapat primitive MCP untuk AI role pada desain saat ini, apa pun tier teknisnya. | — |

Kolom **Owner role** bersifat **turunan dan belum diratifikasi**. Ia berasal dari §6.2 plan, bukan dari registry. Sampai Director meratifikasinya, ia adalah input desain, bukan otoritas enforcement.

## 3. Matriks

### 3.1 Tier Q — Query (24 operasi)

| Operation | Level | Registry role | Owner role | Tool MCP | Status |
|---|---|---|---|---|---|
| `project_status` | read_only | any | semua | `sigma_get_state` | **implemented** (Phase 0) |
| `session_bootstrap` | read_only | any | semua | `sigma_get_orientation` | **implemented** (Phase 0) |
| `memory` | read_only | any | semua | `sigma_get_memory` | **implemented** (Phase 0) |
| `doctor` (diagnosis saja) | semantic | any | semua | `sigma_doctor` (`applied:false`) | **implemented** (Phase 0) — lihat split di §3.4 |
| `intent_status` | read_only | any | ARC | `sigma_list_artifacts` (parsial) | deferred B2 |
| `plan_status` | read_only | any | FMN | `sigma_list_artifacts` (parsial), `sigma_get_evidence` (versi tunggal, parsial) | deferred B2 — masih tidak mencakup daftar seluruh versi |
| `exec_status` | read_only | any | DEV | `sigma_list_artifacts` (parsial), `sigma_get_evidence` (versi tunggal, parsial) | deferred B2 — masih tidak mencakup daftar seluruh versi |
| `close_status` | read_only | any | AUD | `sigma_list_artifacts` (parsial) | deferred B2 |
| `intent_list` | read_only | any | semua | — | deferred B2 |
| `plan_list` | read_only | any | FMN | — | deferred B2 |
| `exec_list` | read_only | any | DEV | — | deferred B2 |
| `roadmap_list` | read_only | any | FMN | — | deferred B2 |
| `intent_check` | read_only | any | ARC | — | deferred B2 |
| `plan_check` | read_only | any | FMN | — | deferred B2 |
| `exec_check` | read_only | any | DEV | — | deferred B2 |
| `close_check` | read_only | any | AUD | — | deferred B2 |
| `roadmap_check` | read_only | any | FMN | — | deferred B2 |
| `inbox` | read_only | any | semua | — | deferred, tanpa jadwal — MCP mailbox dibangun lalu **ditarik** oleh keputusan Director setelah review Codex (2026-09-15). Lihat §3.6 |
| `inbox_check` | read_only | any | semua | — | deferred B2 |
| `memo_list` | read_only | any | semua | — | deferred B2 |
| `config_show` | read_only | any | semua | — | deferred B2 |
| `report_logs` | read_only | any | AUD | — | deferred B2 — **caveat**: `operations.jsonl` memuat path host |
| `git_evidence` | read_only | any | DEV / AUD | — | deferred B2 — **caveat**: membaca state di luar pohon `Sigma/` |
| `scan` | read_only | any | — | — | **NOT ADMISSIBLE** — lihat §3.5 |

### 3.2 Tier W1 — Bounded command (16 operasi)

| Operation | Registry role | Owner role | Tool MCP | Status |
|---|---|---|---|---|
| `intent_new` | any | ARC | `sigma_create_intent_draft` | deferred Stage C — **pilot W1** |
| `plan_new` | any | FMN | `sigma_create_plan_draft` | deferred Stage C |
| `exec_new` | any | DEV | `sigma_create_exec_draft` | deferred Stage C |
| `plan_update` | any | FMN | `sigma_update_artifact_draft` | deferred Stage C |
| `send` | any | semua | `sigma_send_message` | deferred Stage C |
| `memo_write` | any | semua | `sigma_write_memo` | deferred Stage C |
| `memo_read` | any | semua | — | deferred, tanpa jadwal — MCP memo tidak direncanakan (keputusan Director 2026-09-15, §3.6); tetap CLI/skill (`sigma memo read`, skill `read-memo`) |
| `inbox_read` | any | semua | — | deferred, tanpa jadwal — MCP mailbox tidak direncanakan (keputusan Director 2026-09-15, §3.6); tetap CLI (`sigma inbox read`) |
| `inbox_archive` | any | semua | — | deferred Stage E |
| `roadmap_new` | any | FMN | — | deferred Stage E |
| `roadmap_render` | any | FMN | — | deferred Stage E — derivasi deterministik dari chain state |
| `reference_update` | any | semua | — | deferred Stage E |
| `config_set_language` | any | DIRECTOR | — | deferred Stage E — nilai rendah bagi AI role |
| `intent_humanize` | any | ARC | — | deferred Stage E |
| `exec_humanize` | any | DEV | — | deferred Stage E |
| `close_humanize` | any | AUD | — | deferred Stage E |

### 3.3 Tier W2 — Governance transition (11 operasi)

Seluruhnya memakai `typed prepare → durable Director approval → typed commit`.

| Operation | Registry role | Owner role | Status | Catatan |
|---|---|---|---|---|
| `intent_ratify` | director | DIRECTOR | deferred Stage D — **pilot W2** | Transisi tunggal pertama |
| `intent_amendment` | director | DIRECTOR | deferred Stage D+ | Operationalization only |
| `intent_score` | director | DIRECTOR | deferred Stage D+ | Prasyarat Gate 3.5 |
| `intent_supersede` | director | DIRECTOR | deferred Stage D+ | Cascade ke ROADMAP/PLAN/EXEC |
| `intent_activate` | any | DIRECTOR | deferred Stage D+ | **Hazard**: menulis `Sigma/activate_status.json`, salah satu input `state_revision` binding itu sendiri. Sebuah sesi MCP dapat memindahkan chain aktif di bawah kakinya sendiri. Registry menandainya `any`; matriks ini menaikkannya ke DIRECTOR |
| `plan_lock` | director | DIRECTOR | deferred Stage D+ | |
| `plan_supersede` | director | DIRECTOR | deferred Stage D+ | |
| `plan_promote` | any | FMN + DIRECTOR | deferred Stage D+ | Memberi versi resmi pada pending plan — struktural |
| `exec_lock` | director | DIRECTOR | deferred Stage D+ | |
| `close_new` | director | DIRECTOR | deferred Stage D+ | Gate 3 |
| `close_lock` | director | DIRECTOR | deferred Stage D+ | Mengunci ROADMAP sebagai efek samping — wajib muncul di `effects[]` ticket |

### 3.4 Tier W3 / NA — Privileged (8 operasi + 1 split)

| Operation | Level | Alasan | Status |
|---|---|---|---|
| `project_start` | semantic | Menulis config MCP **global** Codex/Gemini (caveat Phase 0 §5.2) | NOT ADMISSIBLE |
| `project_sync` | semantic | Sinkronisasi doktrin dari `~/.sigma/templates/` | NOT ADMISSIBLE |
| `project_register` | semantic | Perbaikan identity — memindahkan identitas proyek | NOT ADMISSIBLE |
| `setup_install` | system | Host-level, membuat `~/.sigma/` | NOT ADMISSIBLE |
| `setup_update` | system | Host-level | NOT ADMISSIBLE |
| `setup_uninstall` | system | Menghapus `~/.sigma/` | NOT ADMISSIBLE |
| `override` | semantic | Mem-bypass gate atas otoritas Director | NOT ADMISSIBLE |
| `config` | semantic | Wizard interaktif — tidak dapat dijalankan non-interaktif | NOT ADMISSIBLE |
| `doctor --recovery/--reconstruct` | semantic | Cabang repair dari `doctor`; menulis ke chain file | NOT ADMISSIBLE |

**Split `doctor`.** Registry memperlakukan `doctor` sebagai satu operasi `semantic`. Implementasinya punya dua cabang berbeda sifat: diagnosis (read-only) dan repair (menulis). `sigma_doctor` sudah mengekspos cabang pertama saja dengan `applied:false`. Matriks ini memisahkan keduanya; registry belum.

### 3.5 `scan` — read-only tetapi tidak admissible

`scan` ber-level `read_only`, jadi secara registry ia tampak aman. Ia **tidak** aman sebagai primitive MCP: ia menerima path file **arbitrary** untuk dipindai. Mengeksposnya sama dengan memberi `sigma_read_file` berkedok, yang dilarang eksplisit oleh §4 non-goal plan.

Ini contoh utama kenapa `level` registry tidak boleh dijadikan penentu admissibility.

### 3.6 Stage B2 (2026-09-15) — evidence-only, setelah review dan revert mailbox

Stage B2 semula menambah tiga tool (`sigma_get_evidence`, `sigma_list_messages`, `sigma_read_message`). Review Codex menemukan tiga temuan pada dua tool mailbox — R-B2-01 (HIGH, config resmi tidak pernah menulis `--role` sehingga mailbox selalu `ROLE_NOT_AUTHORIZED` pada instalasi nyata), R-B2-02 (MEDIUM, existence oracle lintas role lewat error code yang berbeda), R-B2-03 (MEDIUM, filename pesan tidak diturunkan dari `entry.id`/`from`/`to`/`type` sehingga entry index yang rusak bisa diarahkan ke file pesan lain yang sah). Director memutuskan **tidak memperbaiki temuan itu, melainkan menarik seluruh MCP mailbox/memo dari scope** — Hermes tidak membutuhkannya sekarang; komunikasi antar-role tetap lewat CLI (`sigma send`, `sigma inbox read`) dan skill (`write-memo`/`read-memo`).

**Yang bertahan setelah revert:**

| Tool | Padanan registry | Sifat |
|---|---|---|
| `sigma_get_evidence` | `plan_status`/`exec_status` (parsial — satu versi, bukan daftar) | **baru** — proyeksi status/referensi tracker plan/exec, bukan isi dokumen |

`sigma_list_messages` dan `sigma_read_message`, berikut `src/mcp/tools/mailbox.ts`, dihapus. `binding.role` dikembalikan ke control-mode-only. `inbox` dan `inbox_read` di §3.1/§3.2 kembali `deferred` tanpa jadwal.

**R-B2-04 (LOW, tetap perlu diperbaiki pada evidence) — CLOSED.** `sigma_get_evidence` semula punya boundary lebih longgar dari `sigma_read_artifact`: tidak melempar `BOUNDARY_VIOLATION` untuk non-regular file di path kanonik, dan tidak melakukan canonical-recheck setelah `openSync`. Diperbaiki dengan mengekstrak `readCanonicalArtifactFile()` ke `src/mcp/artifactPath.ts` — satu rutin open/verify/hash/read yang dipakai `sigma_read_artifact` **dan** `sigma_get_evidence`, sehingga keduanya tidak bisa drift lagi pada boundary maupun pada posture pembacaan. Diverifikasi dengan test baru: direktori pada path kanonik → `BOUNDARY_VIOLATION` (bukan `present:false`), file di atas batas ukuran → `PAYLOAD_TOO_LARGE`.

**Verifikasi final.** `test/mcp-stage-b2.test.ts` (9 test, evidence-only): status + hash, present:false untuk file hilang, unknown version, boundary violation `.env`, parity legacy folder (R-10), non-regular-file boundary (R-B2-04), payload-too-large; dua test transport-level (envelope + non-mutasi). Full suite kembali ke baseline Batch 1 + 9 test evidence: **51 file / 545 test PASS**.

## 4. Surface Batch 1

| Tool | Padanan registry | Sifat |
|---|---|---|
| `sigma_get_state` | `project_status` | existing |
| `sigma_get_orientation` | `session_bootstrap` | existing |
| `sigma_get_gates` | — (turunan chain state) | existing, tanpa padanan registry |
| `sigma_list_artifacts` | — (turunan tracker) | existing, tanpa padanan registry |
| `sigma_doctor` | `doctor` (cabang diagnosis) | existing |
| `sigma_get_memory` | `memory` | existing |
| `sigma_verify_binding` | — | **baru** — operasi server, bukan operasi Sigma |
| `sigma_get_effective_policy` | — | **baru** — proyeksi atas registry, bukan operasi |
| `sigma_read_artifact` | — | **baru** — tidak ada padanan CLI; artifact selama ini dibaca manusia lewat filesystem |

**Temuan**: lima dari sembilan tool Batch 1 tidak punya padanan operasi registry. Surface MCP bukan superset maupun subset registry — keduanya beririsan. Klaim "MCP parity dengan registry" karenanya tidak bermakna tanpa kualifikasi, dan Stage E harus dibaca sebagai *menambah primitive berdasarkan kebutuhan*, bukan mengejar 59 tool.

## 5. Mismatch registry vs implementasi

Plan §14 Stage 0 butir 2 meminta mismatch ditandai. Tiga ditemukan.

### 5.1 `notion` tidak ada di registry sama sekali

`src/commands/notion.ts` terdaftar di `src/cli.ts:21,48` dan mengekspos **delapan** subcommand: `setup`, `enable`, `disable`, `status`, `push`, `pull-state`, `pull`, `progress`. Tidak satu pun muncul di `SIGMA-OPERATION-REGISTRY.json`, dan `notion` bukan salah satu dari 20 domain terdaftar.

Artinya seluruh permukaan **credential handling dan sinkronisasi eksternal** Sigma tidak terlihat oleh registry. Konsekuensi langsung: setiap enforcement yang mengambil operation registry sebagai sumber kebenaran akan menganggap operasi-operasi ini *tidak ada*, bukan menganggapnya *terlarang*. Deny-by-default harus berbasis **allowlist**, bukan lookup registry.

### 5.2 Domain `sync` terdaftar tanpa command sendiri

`domains` memuat `sync`, tetapi tidak ada `src/commands/sync.ts`. Operasi sinkronisasi hidup sebagai `project sync`. Domain ini tampaknya sisa historis.

### 5.3 `doctor` mencampur dua sifat dalam satu entri

Lihat §3.4.

## 6. Kesimpulan yang mengikat implementasi

1. **Deny-by-default berbasis allowlist eksplisit**, bukan berbasis ketiadaan entri registry (§5.1).
2. **`level` registry bukan penentu admissibility** (§3.5).
3. **Dimensi owner role tidak ada di registry** dan yang dipakai di sini bersifat turunan serta belum diratifikasi (§2).
4. **`intent_activate` adalah hazard khusus** karena menulis input `state_revision` binding (§3.3).
5. **Klaim parity registry↔MCP tidak bermakna** tanpa kualifikasi (§4).
