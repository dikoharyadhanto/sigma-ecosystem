---
## 1. Delta Concept Understanding

> Dipelajari dari `I:\Works\Project\delta-ecosystem` — Delta Full master folder.

### 1.1 Identitas & Tujuan

Delta adalah **AI Cognitive Operating System** — sistem orkestrasi multi-agent terstruktur di mana Director (manusia) memegang otoritas konstitusional tertinggi. Tujuannya: mengubah intent Director menjadi produk nyata dengan cara yang **traceable, terstruktur, dan tidak bergantung pada ingatan atau keberuntungan**.

### 1.2 Dokumen Konstitusional & Operasional

| Dokumen                 | Peran                                                                                                                                                                                                                     | Ukuran     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `DELTA_CONSTITUTION.md` | "Undang-undang dasar" — 10 Articles: otoritas Director, agent sovereignty, hierarchy of authority, single source of truth, transient cognition, runtime authority, amandemen, lifecycle governance, operational integrity | ~250 baris |
| `DELTA_PROTOCOL.md`     | "Undang-undang operasional" — tata laksana, workflow sequence, naming convention, versioning, skill routing, memory layer, conflict resolution                                                                            | 1003 baris |
| `DELTA_README.md`       | Panduan Director (Bahasa Indonesia)                                                                                                                                                                                       | 691 baris  |

### 1.3 Hierarchy of Authority (Article IV)

```
DELTA_CONSTITUTION
        ↓
DIRECTOR_INTENT (DIR-DI)
        ↓
DELTA_PROTOCOL
        ↓
GLOBAL_RULES (00_Rules/)
        ↓
STRAT → WO → RUNTIME_STATE → SKILLS → CDC
```

### 1.4 Enam Agent + Director

| Agent        | Nama Peran                        | Output Dokumen            | Sifat                                               |
| ------------ | --------------------------------- | ------------------------- | --------------------------------------------------- |
| **Director** | Pemilik intent, otoritas final    | DIR-DI                    | Pengambil keputusan                                 |
| **GMN**      | Global System Architect           | STRAT                     | Strategi & arsitektur                               |
| **GPT**      | Brutal Auditor                    | — (advisory critique)     | Advisory only — tidak punya otoritas runtime        |
| **PPX**      | Verificator & Researcher          | — (advisory verification) | Advisory only                                       |
| **ANT**      | Technical Foreman & QA Controller | WO, ANT-STR, PDC          | Penerjemah strategi → tugas teknis, QA, dokumentasi |
| **CDC**      | Lead Developer                    | IMPL, WALK                | Eksekutor kode                                      |
| **NLM**      | Ecosystem Knowledge Constructor   | KNOW                      | Research eksternal, fully isolated dari project     |

### 1.5 Siklus Hidup Penuh (STRICT Mode)

```
DI new → DI lock (Director audit)
  ↓
STRAT new → complete → lock (Director audit)
  ↓
WO new → advance → complete → lock (Director audit)
  ↓
ANT-STR new ─────── (gate: WO must be LOCKED; test contract sebelum build)
  ↓
IMPL new ────────── (gate: WO LOCKED + ANT-STR exists)
  ↓
WALK new ────────── (gate: WO LOCKED + ANT-STR exists)
  ↓
ANT-STR execute → complete → lock
  │                   STR lock → auto-locks IMPL + WALK
  ↓
PDC new → complete → lock → project end
```

**Total: 7-8 langkah formal dengan multiple approval gate per langkah.**

### 1.6 CLI — Mandatory Middleware

CLI (`delta`) adalah **enforcement layer** antara Director intent dan AI execution. Pattern: `delta {domain} {action}`.

Domain kritis: `di`, `strat`, `wo`, `str`, `impl`, `walk`, `pdc`, `audit`, `override`, `project`, `session`, `refresh`, `block`, `unblock`, `cso`, `skill`, `setup`, `decision`, `gitignore`.

**Prinsip kunci:**

- Runtime state (`progress.json`) adalah **operational truth** — mengatur apa yang diizinkan CLI saat ini
- Markdown documents adalah **semantic truth** — mendefinisikan apa yang seharusnya
- Jika konflik: `progress.json` yang menang
- Agent tidak boleh bypass CLI untuk operasi yang sudah punya definisi di Operation Registry

### 1.7 Sistem Memory (3-Tier + Decision + Learning)

| Layer                     | Authority                                           | Storage                                     | Write Rule                                  |
| ------------------------- | --------------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| **Constitutional Memory** | Invariant — prinsip dari Constitution & Protocol    | `~/.delta/memory_delta.jsonl` (MCP graph)   | Director-gated                              |
| **Operational Memory**    | Reusable ecosystem conventions                      | `~/.delta/memory_delta.jsonl` (MCP graph)   | Director-approved                           |
| **Decision Memory**       | Authoritative — auto-generated dari CLI lock events | `Delta/09_Memory/decisions.jsonl`           | CLI only (deterministic heading extraction) |
| **Learning Memory**       | Advisory — CDC proposes, ANT validates              | `Delta/09_Memory/learning-candidates.jsonl` | Auto-capture at `str lock`                  |
| **Ephemeral Cognitive**   | Session residue                                     | Tidak disimpan                              | MUST NOT persist                            |

### 1.8 Fitur Berat Lainnya

- **Skill Routing Engine** — Triple-gate: `routed ∩ STRAT_allowlist ∩ WO_binding`. CDC wajib evaluasi, hasilnya bisa nol skill.
- **Director Override** — Runtime declaration via CLI (`delta override declare`), bukan anotasi markdown.
- **Temporary Experimental Authorization (TEA)** — Deviasi konstitusional scoped & time-bounded, tidak mengubah doktrin.
- **Git Evidence** — L0-L4 physical traceability (inspect → diff → capture → publish).
- **CSO (Cognitive State Object)** — Handoff artifact opsional antar sesi; timestamp-based naming.
- **PDC Generation** — Structured closure draft dari extraction heading dokumen.
- **Approval Gate** — Paired intent-evidence: upstream defines minimum, downstream records satisfaction.
- **Cascade Quarantine** — `delta block` / `delta unblock`.
- **STRAT Invalidation** — SOFT (CDC resolve lokal) vs HARD (eskalasi ke GMN).

### 1.9 Struktur Folder Project

```
NamaProject/
├── project.json                    ← CLI-managed
├── DELTA_README.md / CLAUDE.md / GEMINI.md / AGENTS.md
├── Delta/                          ← Governance layer
│   ├── DELTA_CONSTITUTION.md / DELTA_PROTOCOL.md
│   ├── progress.json               ← Runtime state (CLI-managed)
│   ├── DELTA-REGISTRY.json         ← Semantic registry
│   ├── 00_Rules/                   ← ANT-RULE, CDC-RULE, GMN-RULE
│   ├── 01_Strategy/                ← DIR-DI, GMN-STRAT
│   ├── 02_Blueprint/               ← ANT-WO, ANT-STR
│   ├── 03_Build/                   ← CDC-IMPL, CDC-WALK
│   ├── 07_Logs/                    ← CSO files
│   ├── 08_Test/                    ← ANT test artifacts
│   └── 09_Memory/                  ← decisions.jsonl, learning-candidates.jsonl
└── [Project Work Folders]/         ← Source code, tests, dll.
```

### 1.10 Versioning

| Tier   | Scope               | Version       | Strategy                         |
| ------ | ------------------- | ------------- | -------------------------------- |
| Tier 1 | DI, STRAT, PDC      | v1.0, v2.0... | Synchronized, overwrite in place |
| Tier 2 | WO, STR, IMPL, WALK | v0.1, v0.2... | Separate versioned files         |
| Tier 3 | Audit artifacts     | v0.1, v0.2... | Never overwrite                  |
| Tier L | CSO                 | Timestamp     | Immutable logs                   |
| Tier E | KNOW (NLM)          | No version    | Living document, overwrite       |

---

## 2. Sigma Plan Concept Understanding

> Dipelajari dari `Intent/DIR-DI-000-SIGMA-v1.0.md` + `Discussion/` CSO files.

### 2.1 Identitas & Tujuan

**Sigma** (sebelumnya "Delta-Lite") adalah **adik ringan Delta Full** — dirancang untuk proyek kecil-menengah, prototipe, fast execution cycles, dan solo-builder workflows. Sigma adalah **sibling protocol terpisah**, bukan modifikasi Delta Full.

**Mengapa tidak modifikasi Delta Full saja?**

- Reworking Delta Full untuk support lightweight mode berisiko destabilisasi arsitektur utama
- Menambah conditional logic dan command confusion
- Membuat kedua sistem lebih sulit di-maintain

### 2.2 Siklus Hidup (Target v1.0)

```
start → design → build → close
```

4 fase vs 7-8 langkah Delta Full.

> ⚠️ **Koreksi (Phase 0A)**: Fase pertama awalnya disebut "plan" dalam dokumen diskusi awal, lalu diubah menjadi **"DESIGN"** dalam `sigma_phase_implementation.md` dan `SIGMA_PROTOCOL.md` untuk menghindari konflik nama dengan artifact FMN-PLAN. "DESIGN" adalah nama resmi fase pertama di semua dokumen downstream.

### 2.3 Role Sequence (Dikompresi)

| Delta Full                                            | Sigma                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| Director → GMN → GPT/PPX → ANT → CDC → ANT → Director | **Director raw intent → GMN Lite → GPT Auditor → Director lock** |

Tidak ada ANT, CDC, PPX sebagai role terpisah dalam desain awal Sigma.

### 2.4 Artefak (Direncanakan)

| Layer              | Delta Full                                     | Sigma                                                                                                                                    |
| ------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Strategy/Audit** | DI + STRAT (2 dokumen, 2 role)                 | **Satu artefak compressed** dengan sublayer authority labels                                                                             |
| **Plan/Build**     | WO + ANT-STR + IMPL + WALK (4 dokumen, 3 role) | **Satu artefak `LITE-EXECUTION`** berisi Work Order/Task Plan + Pre-build Test Contract + Post-build Test Report + Implementation Report |
| **Closure**        | PDC (ANT-authored, mandatory)                  | Closure artifact (detail belum didesain)                                                                                                 |

### 2.5 Sublayer Authority (Strategy Layer)

Dalam artefak strategi Sigma, konten dibagi berdasarkan status auditability:

| Sublayer                           | Audit Status                                                       |
| ---------------------------------- | ------------------------------------------------------------------ |
| **Director Intent** (tujuan, visi) | **Sovereign** — tidak bisa diaudit. Director owns the destination. |
| **Constraints & Preferences**      | Auditable                                                          |
| **Tech Stack**                     | Auditable                                                          |
| **Timeline**                       | Auditable                                                          |
| **Solution Assumptions**           | Auditable                                                          |
| **Architecture Preference**        | Auditable                                                          |
| **Scope Choices**                  | Auditable                                                          |
| **Risk Assessment**                | Auditable                                                          |
| **Evidence Requirements**          | Auditable                                                          |

Prinsip: **Audit attacks the route, not the destination.** GPT Auditor tidak boleh menyerang intent sovereign Director, tapi boleh menantang methods, assumptions, feasibility, scope, risk, dan evidence.

### 2.6 Test Contract Rule (Plan/Build Layer)

Test contract harus:

1. **Ditulis sebelum build** dimulai — mencegah AI mengarang kriteria tes setelah implementasi
2. **Diselesaikan setelah build** — sebagai test report

Ini menjaga integritas bukti: kriteria sukses ditetapkan sebelum eksekusi.

### 2.7 Prinsip yang Diwarisi dari Delta Constitution

- ✅ Director authority sebagai pemegang keputusan akhir
- ✅ Intent clarity & traceability
- ✅ Evidence-based closure (tidak bisa menutup proyek tanpa bukti)
- ✅ Audit sebagai advisory input, Director sebagai runtime approver
- ✅ Override traceability
- ✅ Single source of truth per concern
- ✅ Lifecycle governance (persistent vs transient)

### 2.8 Yang Sengaja TIDAK Diadopsi dari Delta Full

- ❌ Full document chain (DI → STRAT → WO → ANT-STR → IMPL/WALK → PDC)
- ❌ Triple-gate skill routing engine
- ❌ 3-tier memory + Decision + Learning (hanya lightweight memory)
- ❌ Multi-role handoff (ANT ↔ CDC ↔ ANT)
- ❌ NLM knowledge modules (default exclude)
- ❌ Full CSO lifecycle (CSO tetap ada sebagai opsi, bukan gate)
- ❌ Complex CLI surface (20+ domain)

### 2.9 CLI & Memory — Tetap Ada, Tapi Minimal

Keputusan dari Checkpoint 2:

- **CLI tetap ada**: Tanpa CLI, Sigma hanya menjadi template sistem dokumen tanpa runtime truth
- **Memory tetap ada**: Tanpa memory, cross-session continuity rusak
- Tapi keduanya harus **minimal** — tidak mereplikasi kompleksitas Delta Full

### 2.10 Yang Sudah Disetujui Director (Checkpoint 1-4)

| Checkpoint | Keputusan                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| CP 1       | Delta Full valid sebagai full governance system; non-UX issues adalah hardening backlog, bukan fatal flaw |
| CP 2       | Sigma harus tetap pakai CLI dan memory dalam bentuk minimal                                               |
| CP 3       | Role sequence: Director raw intent → GMN Lite → GPT Auditor → Director lock                               |
| CP 3       | Strategy pakai satu artefak compressed dengan sublayer authority labels                                   |
| CP 3       | Audit boundary: destination (sovereign) vs route (auditable)                                              |
| CP 4       | Plan/build merged ke satu `LITE-EXECUTION` document                                                       |
| CP 4       | Test contract ditulis sebelum build, diselesaikan setelah build                                           |

### 2.11 Yang Masih Open / Belum Diputuskan

- Nama final artefak strategi: `LITE-PLAN` vs `LITE-STRAT`
- Nama final artefak eksekusi: `LITE-EXECUTION` vs `LITE-BUILDPLAN`
- Apakah GPT audit di execution layer mandatory atau optional (risk-based)
- Apakah CLI harus enforce pre-build section hash/snapshot
- Desain Close layer (belum dimulai)
- Memory records untuk Lite layer events
- CLI command final naming
- Promotion mechanism dari Lite ke Full
- Apakah Lite akan jadi CLI profile di bawah CLI yang sama, atau package terpisah
- Minimal evidence level untuk berbagai tipe proyek Lite

### 2.12 Kriteria Sukses v1.0 (dari DI)

1. Satu end-to-end Sigma workflow terdefinisi jelas
2. Required artifact types terdefinisi
3. Strategy, audit, execution, testing, implementation, dan closure responsibilities jelas
4. Runtime state requirements minimal tapi cukup
5. Evidence requirements mencegah false closure
6. Sigma arsitektural terpisah dari Delta Full

---

### Perbandingan Ringkas

| Dimensi           | Delta Full                                        | Sigma                                                   |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------- |
| **Siklus**        | 7-8 langkah formal                                | 4 fase (start→plan→build→close)                         |
| **Role**          | 6 agent + Director                                | 3 role + Director                                       |
| **Artefak**       | 8 tipe (DI, STRAT, WO, STR, IMPL, WALK, PDC, CSO) | ~3 tipe (Strategy, Execution, Closure)                  |
| **CLI domain**    | 20+ domain, ~70 perintah                          | Minimal (`delta lite *`)                                |
| **Memory**        | 3-tier + Decision + Learning                      | Lightweight memory                                      |
| **Skill routing** | Triple-gate mandatory                             | Default-exclude                                         |
| **NLM**           | On-demand ecosystem knowledge                     | Default-exclude                                         |
| **PDC**           | Mandatory, ANT-authored                           | Closure artifact (TBD)                                  |
| **Governance**    | Full constitutional + operational                 | Constitutional principles tetap, operasional dikompresi |
| **Target user**   | Proyek serius, kompleks, multi-fase               | Proyek kecil-menengah, prototipe, solo-builder          |

---

## MAIN DISCUSSION

> Checklist perumusan Sigma. Centang `[x]` saat item sudah diputuskan Director.
> Item baru hasil analisis perbandingan Delta Full vs Sigma ditandai `🆕`.

### A. Identitas & Branding

- [x] Nama produk final: **Sigma** ✅
- [x] Nama CLI binary: **`sigma`** (contoh: `sigma setup install`, `sigma project start`) ✅
- [ ] ~~Tagline / one-liner~~ → Deferred ke DI document (Director: "ini seharusnya ada di dokumen DI saya")
- [x] Apakah Sigma berdiri sebagai produk mandiri atau tetap disebut "bagian dari Delta Ecosystem"? ✅
  - **Jawaban**: Secara implementasi berdiri sendiri, tidak ada ketergantungan pada Delta Full. Secara branding, Sigma adalah bagian dari Delta Ecosystem.

> **Catatan**: Item #3 (tagline) sudah benar ada di `DIR-DI-000-SIGMA-v1.0.md` bagian "Project Identity". Tidak perlu dibahas ulang di sini.

### B. Protocol & Constitution

- [x] Perumusan `SIGMA_PROTOCOL.md` — dokumen operasional utama Sigma ✅
- [x] Hubungan Sigma dengan `DELTA_CONSTITUTION.md`: **Delta Constitution juga berlaku untuk Sigma.** Sigma pakai file yang sama (dikopi ke folder Sigma, rename `SIGMA_CONSTITUTION.md`). ✅
- [x] Apakah Sigma perlu constitution terpisah? **Tidak.** Sigma pakai Delta Constitution. ✅
- [x] Batas invariant vs longgar ✅:
  - **Wajib**: Director authority, evidence-based closure, traceability, single source of truth
  - **Longgar**: jumlah artefak, role count, approval gate, versioning tiers, skill routing
- [x] Promotion mechanism: **Keputusan sepihak Director.** Tidak ada migrasi instan — proyek Sigma ditutup, lalu dibuat proyek Delta Full baru dari awal. ✅
- [x] Apakah Sigma butuh Director Override? **Tidak perlu.** ✅
- [x] Apakah Sigma perlu TEA? **Tidak.** (TEA adalah konsep Delta Full untuk deviasi konstitusional sementara — tidak relevan untuk Sigma) ✅
- [x] Conflict resolution: **Konstitusi hanya mengatur prinsip/core, bukan teknis.** Seharusnya tidak ada konflik antara Sigma Protocol dengan Constitution. ✅
- [x] Constitutional sync: **Cukup copy-paste** Delta Constitution ke folder Sigma, rename jadi `SIGMA_CONSTITUTION.md`. Konten sama. ✅

> ⚠️ **Catatan**: Karena Sigma standalone, Sigma punya **kopi sendiri** dari Delta Constitution di folder distribusinya (`SIGMA_CONSTITUTION.md`). Jika Delta Constitution diamendemen, **Sigma WAJIB mengikuti amendemen tersebut** — perubahan konstitusi di Delta berpengaruh ke Sigma.

### C. AI Roles — Definisi & Rules

- [x] **Berapa role?** **4 role**: ARC, AUD, FMN, DEV ✅
- [x] **Nama final**: **ARC** (Global Architect), **AUD** (Auditor), **FMN** (Foreman), **DEV** (Developer) ✅
- [x] **Mapping ke Delta**: ARC = GMN, AUD = GPT+PPX, **FMN = ANT**, **DEV = CDC** ✅
- [x] **Tanggung jawab**: ✅
  - **ARC**: Menggali intent Director (wawancara/konsultasi), menyusun draft DIR-INTENT
  - **AUD**: Brutal auditor, advisory only — bukan approval gate
  - **FMN**: Work Order / implementation plan + evaluasi hasil coding DEV + simulasi testing (seperti ANT di Delta)
  - **DEV**: Implementasi kode + laporan hasil implementasi (seperti CDC di Delta)
- [x] **AUD mandatory?** **Tidak.** Hanya pertimbangan untuk Director. ✅
- [ ] **Rules detail** → Deferred: spesifikasinya nanti saat implementasi
- [x] **Role overlap / activation**: Sama seperti Delta — aktivasi eksplisit, tidak bisa pindah di tengah sesi. Harus session baru. ✅
- [x] **Session bootstrap**: **Tetap ada.** `sigma session bootstrap` — agent wajib baca rules + dokumen aktif di awal sesi. ✅
- [x] **Sigma Orchestrator?** **Tidak diperlukan sekarang.** ✅
- [x] **Role rules lokasi**: **Rules sendiri**, tidak shared dengan Delta. Karena definisi role di Sigma bersifat gabungan (multi-role), rules harus berbeda. ✅
- [x] **NLM?** **Tidak masuk dulu.** Bisa dipertimbangkan nanti. ✅

> ⚠️ **Tentang "Session bootstrap" (#8)**: Di Delta Full, session bootstrap artinya agen di awal sesi wajib membaca file rulenya sendiri + dokumen aktif (WO, STRAT, dll.) sebelum mulai bekerja. Contoh: CDC wajib `delta session bootstrap` lalu baca WO terbaru. Ini memastikan agent selalu punya konteks terbaru. Pertanyaan buat Director: **Apakah Sigma perlu ritual bootstrap serupa?** Atau cukup agent langsung baca file yang relevan tanpa command formal? Mengingat jawaban #6 (aktivasi eksplisit seperti Delta), kemungkinan jawabannya iya — tapi perlu diputuskan apakah pakai command `sigma session bootstrap` atau cukup konvensi tanpa CLI.

### D. Artefak & Dokumen

- [x] **Nama & total artefak**: **4 dokumen final**: `DIR-INTENT`, `PLAN`, `EXEC`, `DIR-CLOSE` ✅
  - **DIR-INTENT** — Director's Intent + Strategy + Constraints. **Director-owned, ARC-assisted.**
  - **PLAN** — Work Order + Simulation Test Report (oleh FMN). Gabungan WO + STR di Delta.
  - **EXEC** — Implementation Plan + Implementation Report (oleh DEV). Gabungan IMPL + WALK di Delta.
  - **DIR-CLOSE** — Closure (oleh Director) — evidence summary + publish-ready documentation
- [ ] **Template & format** → Deferred: dibahas saat implementasi template document
- [x] **Naming convention**: Tetap sama seperti Delta — `{ROLE}-{DOC}-{PROJECT_ID}-v{VER}.md` ✅
  - Contoh: `DIR-INTENT-001-v1.0.md`, `ARC-PLAN-001-v1.0.md`, `DEV-EXEC-001-v0.1.md`, `DIR-CLOSE-001-v1.0.md`
- [x] **Versioning strategy**: Tetap sama seperti Delta (Tier 1/2/3) ✅
- [x] **Konversi ke Delta Full?** **Tidak bisa dikonversi.** ✅
- [x] **Folder penyimpanan**: **Folder sendiri `Sigma/`** (bukan `Delta/`) ✅
- [x] **CSO (Cognitive State Object)**: **Tetap ada.** Seperti Delta — artefak opsional untuk handoff antar sesi. Disimpan di `Sigma/logs/`. ✅
- [ ] Sublayer authority labels dalam strategy artifact → Deferred: bagian dari template DIR-INTENT
- [ ] Pre-build test contract format → Deferred: bagian dari template PLAN
- [ ] Post-build test report format → Deferred: bagian dari template PLAN
- [ ] Evidence section → Deferred: bagian dari template

#### D+. Auto-Supersede Policy 🆕

- [x] **DIR-INTENT**: **Single-active, auto-supersede.** Saat versi baru di-lock, semua versi lama LOCKED → SUPERSEDED otomatis. Hanya satu intent aktif dalam satu project. ✅
- [x] **DIR-CLOSE**: **Single-active, auto-supersede.** Saat versi baru di-lock, semua versi lama LOCKED → SUPERSEDED otomatis. Hanya satu closure baseline aktif. ✅
- [x] **PLAN**: **Multi-active, manual supersede only.** Locking versi baru TIDAK meng-supersede versi lama. Supersede harus eksplisit: `sigma plan supersede --v <version> --reason "..."`. ✅
- [x] **EXEC**: **Multi-active, manual supersede only.** Locking versi baru TIDAK meng-supersede versi lama. Supersede harus eksplisit: `sigma exec supersede --v <version> --reason "..."`. ✅
- [x] **STALE_INTENT warning**: PLAN/EXEC yang mengacu ke DIR-INTENT versi lama (SUPERSEDED) ditandai `STALE_INTENT`. Tetap LOCKED, tapi tidak boleh dipakai untuk close tanpa Director review. ✅
- [x] **CLOSE reference**: DIR-CLOSE harus explicit menyebut versi PLAN + EXEC (versi yang sama) yang mendukung closure. ✅

### E. CLI — Command Surface & Arsitektur

- [x] **Pattern command**: Mirip Delta — `sigma {domain} {action}`. Contoh: `sigma setup install`, `sigma project start` ✅
- [x] **Nama command mengikuti dokumen**: `sigma intent new`, `sigma plan new`, `sigma exec new`, `sigma exec audit`, `sigma close new`, dll. ✅
- [x] **Cakupan**: CLI operasi penting di Delta harus ada di Sigma. `sigma --help` dan `sigma {domain} --help` tetap ada. ✅
- [x] **Approval gate**: **Director only** secara operational CLI. Dokumen Intent dan Exec diaudit oleh AUD secara opsional (advisory), Director tetap yang approve. ✅
- [x] **Pre-build test contract snapshot**: **Tidak perlu.** Cukup percaya disiplin DEV + review AUD. Nanti jadi ribet kalau dikunci. ✅
- [x] **`sigma audit`**: **Punya.** ✅
- [x] **`sigma override`**: **Tidak punya.** ✅
- [x] **`sigma block` / `sigma unblock`**: **Tidak punya.** ✅
- [x] **Runtime state**: **`progress.json`** — tetap sama seperti Delta. Nanti disesuaikan dan dicek ulang. ✅
- [x] **`sigma promote`**: **Tidak ada.** Delta dan Sigma tidak bisa saling migrasi. Harus manual karena arsitektur tidak sama. ✅
- [x] **CLI architecture**: **Samakan dengan Delta CLI** — pakai Operation Registry, pattern `delta {domain} {action}`, dsb. ✅
- [x] **Tech stack**: Mengikuti Delta CLI (Node.js) — implisit dari "samakan dengan Delta CLI" ✅
- [x] **Mode interaktif / wizard**: **Ide menarik, boleh dibuat.** ✅

### F. Memory & MCP — Model Persistensi

- [x] **MCP Memory Graph**: **Terpisah dari Delta**, tapi fungsi tetap sama. Pakai MCP seperti Delta. ✅
- [x] **Memory tiers**: **3 tier**: Constitutional, Operational Sigma, dan Decision Memory. Ephemeral & Learning **tidak diperlukan**. ✅
- [x] **Decision Memory**: **Tetap perlu auto-harvest** dari lock events seperti Delta Full. ✅
- [x] **Learning Memory**: **Tidak perlu.** ✅
- [x] **CSO**: **Tetap ada**, tidak disederhanakan. (Sudah diputuskan di seksi D) ✅
- [x] **Cara kerja**: Sama seperti Delta. ✅
- [x] **Memory search / query**: **Tidak perlu CLI command khusus.** Delta juga tidak punya `delta memory search`. Query memory dilakukan via MCP tools (`search_nodes`, `read_graph`) oleh agen. Sigma mengikuti cara yang sama. ✅
- [x] **Memory decay**: **Tidak diperlukan.** ✅
- [x] **Path penyimpanan**: **`Sigma/memory/`** ✅

> ⚠️ **Catatan perbaikan proses**: Director minta agar pertanyaan yang sudah terjawab di seksi lain tidak ditanyakan ulang. Contoh: CSO sudah diputuskan di D, Git state sudah implisit dari E (CLI = seperti Delta), dsb. Mulai sekarang saya akan cross-check sebelum menampilkan poin.

### G. Workflow & Lifecycle

- [x] **Fase**: **START → DESIGN → BUILD → CLOSE** ✅ *(dikoreksi dari "PLAN" → "DESIGN" — lihat Session #3)*
- [x] **Gate Rules (3 gate)**: ✅
  - **PLAN** butuh DIR-INTENT locked
  - **EXEC** butuh PLAN locked (versi yang sama)
  - **CLOSE** butuh DIR-INTENT locked + minimal **1 PLAN locked + 1 EXEC locked** dengan **versi yang sama**
- [x] **State machine**: ✅
  - **INTENT**: DRAFT → UNDER_REVIEW → {Audit AUD / Approval Director} → LOCKED → SUPERSEDED
  - **PLAN**: DRAFT → {Audit AUD / Approval Director} → LOCKED → SUPERSEDED
  - **EXEC**: DRAFT → {Audit AUD / Approval Director} → BUILDING → TESTING → COMPLETED → LOCKED → SUPERSEDED
  - **DIR-CLOSE**: DRAFT → {Approval} → LOCKED → SUPERSEDED
- [x] **Approval gates**: **Hanya Director.** ✅
- [x] **Director tidak setuju di tengah fase**: Tidak perlu mekanisme formal. Kalau tidak setuju, jangan di-approve dulu. ✅
- [x] **Build bisa diulang**: **Bisa** (iterasi v0.1, v0.2, dst.) ✅
- [x] **Minimum viable evidence**: **Minimal 1 PLAN + 1 EXEC locked dengan versi yang sama.** ✅
- [x] **Close final atau bisa reopen?**: **Revisi = versi baru.** DIR-CLOSE LOCKED = accepted as current published closure baseline. Jika perlu revisi, buat versi baru (`v1.1`, `v2.0`). Versi lama menjadi SUPERSEDED. Bukan unlock/edit in place. ✅
- [x] **Parallel execution**: **Tidak.** Build jangan dimulai sampai plan di-approve. ✅
- [x] **Stale project**: Tidak masalah. Tinggal lanjutkan. Bisa refine strategi lagi atau mulai build pakai intent yang sudah ada. ✅

### H. Evidence & Closure

- [x] **Evidence minimal**: Minimal 1 EXEC locked (dari G7) ✅
- [x] **Format closure**: DIR-CLOSE — oleh Director (dari D5) ✅
- [x] **Isi dokumen closure**: **Deferred** → masuk pembahasan template (narasi, bukti lampiran, checklist, dsb.) ✅
- [x] **Verification**: **Self-attestation Director** — tidak perlu third-party. (Implisit dari semua keputusan: Director adalah satu-satunya approval gate) ✅
- [x] **False closure prevention**: Sudah tercakup di gate rule G2 — CLOSE butuh min 1 EXEC locked. Tidak bisa close tanpa bukti eksekusi. ✅

### I. Fitur Delta Full yang Diadopsi / Dikompresi / Di-drop

- [x] **Diadopsi penuh**: Director authority, evidence-based closure, traceability ✅
- [x] **Diadopsi penuh**: Naming convention, versioning (Tier 1/2/3), progress.json, CSO ✅
- [x] **Dikompresi**: 6 role → **3 role** (ARC, AUD, DEV) ✅
- [x] **Dikompresi**: 7 artefak → **4 artefak** (DIR-INTENT, ARC-PLAN, DEV-EXEC, DIR-CLOSE) ✅
- [x] **Dikompresi**: Strategy/Audit = ARC-PLAN, Plan/Build = DEV-EXEC ✅
- [x] **Dikompresi**: Memory 5-tier → **3 tier** (Constitutional, Operational Sigma, Decision) ✅
- [x] **Dikompresi**: Gate rules 7+ → **2 gate rules** ✅
- [x] **Di-drop**: Skill routing engine ✅
- [x] **Di-drop**: NLM Knowledge Modules (untuk sekarang) ✅
- [x] **Di-drop**: ANT-STR, IMPL, WALK sebagai artefak terpisah (masuk DEV-EXEC) ✅
- [x] **Di-drop**: Director Override, TEA, block/unblock ✅
- [x] **Di-drop**: Learning Memory ✅
- [x] **Need decision**: ~~Git Evidence~~ → CLI = seperti Delta, jadi Git Evidence tetap ikut ✅
- [x] **Need decision**: ~~Decision Harvest~~ → F3: auto-harvest tetap ada ✅
- [x] 🆕 **Git Evidence**: **Tetap pakai, tapi minimal/read-only.** `sigma git evidence` — output: branch, latest commit, changed files, diff summary, test command output reference. Tidak ada publish layer, tidak ada heavy evidence lifecycle. ✅

### J. Struktur Folder & Inisialisasi Proyek

- [x] **Folder**: **`Sigma/`** (bukan `Delta/`) — dari D9 ✅
- [x] **Init command**: `sigma project start` — dari E2 ✅
- [x] **`project.json`**: Tetap ada — dari E9 (progress.json = seperti Delta) ✅
- [x] **Struktur internal**: Mirip Delta, tapi **tanpa penomoran prefix** folder. `00_Rules` → `rules`, `01_Strategy` → `strategy`, `02_Execution` → `execution`, `03_Closure` → `closure`, `07_Logs` → `logs`, `09_Memory` → `memory`. ✅
- [x] **File yang di-generate**: Hampir sama cara kerjanya seperti Delta. Perbedaan hanya fitur yang dipotong. ✅
- [x] **Bridge files**: **Tetap sama** seperti Delta (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`) ✅
- [x] **`.gitignore`**: **Fitur sama** seperti Delta ✅
- [x] **Template files**: **`~/.sigma/templates/`** — mirip Delta ✅

### K. Migration & Interoperabilitas

- [x] **Promotion Sigma → Delta**: **Tidak ada migrasi instan.** Tutup Sigma, buat Delta Full dari awal. — dari B5 ✅
- [x] **Artefak mapping**: **Tidak bisa dikonversi.** — dari D8 ✅
- [x] **`sigma promote`**: **Tidak ada.** — dari E10 ✅
- [x] **Delta downgrade ke Sigma?** Tidak applicable — arsitektur beda, tidak saling migrasi. ✅
- [x] **CLI coexist**: **Bisa** — binary berbeda (`sigma` vs `delta`), tidak konflik. ✅
- [ ] ~~Runtime state saat promotion~~ → Tidak relevan (tidak ada migrasi)
- [ ] Apakah Sigma bisa baca Delta Full artefacts? 
- [x] **CLI coexist**: **Bisa** — binary berbeda (`sigma` vs `delta`), tidak konflik. ✅
- [x] **Sigma baca Delta artifacts?** **Tidak bisa.** ✅
- [x] **Sharing Project ID**: **Global `project.json` berbagi file yang sama.** Project ID incremental (tidak reset). Perlu flag: ini project Delta atau Sigma. ✅
- [x] **Hybrid proyek?** **Tidak ada.** Sigma ya Sigma, Delta ya Delta. ✅

### L. Testing & Quality Assurance

- [x] **Pre-build test contract**: **Deferred** — bagian dari template DEV-EXEC ✅
- [x] **Post-build test report**: **Deferred** — bagian dari template DEV-EXEC ✅
- [x] **Yang menjalankan test**: **DEV** — dari C6 (DEV = ANT+CDC, termasuk testing) ✅
- [x] **Test gagal?** Belum ada mekanisme formal. Implisit: iterasi ulang (build bisa diulang dari G8). ✅
- [x] **Jenis test**: Dua jenis — **Automatic test oleh DEV** (wajib) + **Manual testing oleh Director** (opsional). Director melaporkan bug/error lewat chat AI atau file EXEC. ✅
- [x] **Test directory**: **Project root `/test`**, bukan `Sigma/test/`. Sama seperti `src/` di root. ✅

### M. Dokumentasi & Onboarding

- [x] **`SIGMA_README.md`**: **Pasti ada** — panduan Director. ✅
- [ ] Quick start guide → Deferred
- [ ] Contoh proyek lengkap → Deferred
- [x] **Perbandingan Sigma vs Delta**: Isi substansi lebih lite, lebih sedikit dokumen. Dokumen Sigma tergantung fitur yang diadopsi. ✅
- [ ] FAQ → Deferred

### N. Teknis Implementasi

- [x] **Bahasa CLI**: **Node.js** — dari E12 ✅
- [x] **Package manager & distribusi**: **Sama kayak Delta** (npm). ✅
- [ ] Sisanya deferred ke implementasi (daemon, auto-update, offline mode, telemetry, minimum env)

### O. Governance & Edge Cases

- [x] **Tanpa Intent**: **Tidak bisa.** Sigma dan Delta tidak bisa bekerja tanpa Intent document. Kalau tidak mau buat Intent, jangan daftarkan ke Sigma/Delta — kerjakan sebagai project biasa. ✅
- [x] **AUD "memblokir" plan**: Tidak mungkin. AUD advisory only, bukan approval gate. ✅
- [x] **Build berbeda dari plan**: Karena role digabung (DEV = ANT+CDC), satu-satunya verifikasi adalah **hasil akhir dari laporan Director** (manual testing). Tidak ada mekanisme formal — Director memverifikasi saat testing manual. ✅
- [x] **Proyek terbengkalai**: Tidak masalah, tinggal lanjutkan. ✅
- [x] **Director belum puas**: Iterasi/build ulang. ✅
- [x] **Batasan ukuran proyek**: **Tergantung Director.** Tidak ada ukuran pasti. Director yang memutuskan pakai Sigma atau Delta. ✅
- [x] **Multi-Director / kolaborasi**: **Belum didukung.** Sigma dan Delta menganut single authority tunggal. ✅

---

## Session #1 — 20260516 — Identitas & Constitution

> **Peserta**: Director + GPT (Reasonix)
> **Topik**: Seksi A (Identitas & Branding) + Seksi B (Protocol & Constitution)
> **Status**: Selesai

### Keputusan Seksi A — Identitas & Branding

| #   | Keputusan               | Detail                                                                                                                                                         |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Nama produk final       | **Sigma**                                                                                                                                                      |
| A2  | Nama CLI binary         | **`sigma`** (contoh: `sigma setup install`, `sigma project start`)                                                                                             |
| A3  | Tagline / deskripsi     | Deferred ke `DIR-DI-000-SIGMA-v1.0.md`                                                                                                                         |
| A4  | Kemandirian vs branding | **Implementasi**: standalone penuh, tidak ada ketergantungan pada Delta Full. **Branding**: Sigma adalah bagian dari Delta Ecosystem.                          |
| A5  | Folder & resource       | Semua resource sendiri — folder structure, CLI codebase, runtime state, templates. Tidak menyentuh `Delta/` folder. Referensi source code Delta Full tersedia. |

### Keputusan Seksi B — Protocol & Constitution

| #   | Keputusan                       | Detail                                                                                                                                                                                                            |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Dokumen operasional             | **`SIGMA_PROTOCOL.md`** — dokumen utama, jauh lebih ringkas dari DELTA_PROTOCOL.md (1003 baris)                                                                                                                   |
| B2  | Hubungan dgn Delta Constitution | Delta Constitution berlaku untuk Sigma. File yang sama, dikopi ke distribusi Sigma.                                                                                                                               |
| B3  | Constitution terpisah?          | **Tidak.** Sigma tidak punya constitution sendiri. Pakai Delta Constitution.                                                                                                                                      |
| B4  | Invariant vs fleksibel          | **Wajib**: Director authority, evidence-based closure, traceability, single source of truth. **Fleksibel**: jumlah artefak, role count, approval gate, versioning tiers, skill routing.                           |
| B5  | Promotion ke Delta Full         | **Keputusan sepihak Director.** Proyek Sigma ditutup → dibuat proyek Delta Full baru dari awal. Tidak ada migrasi instan.                                                                                         |
| B6  | Director Override               | **Tidak diperlukan.**                                                                                                                                                                                             |
| B7  | TEA                             | **Tidak diperlukan.** (Konsep Delta Full — tidak relevan untuk Sigma)                                                                                                                                             |
| B8  | Conflict resolution             | **Tidak diperlukan.** Konstitusi mengatur prinsip/core, bukan teknis. Sigma Protocol tidak akan bertentangan.                                                                                                     |
| B9  | Constitutional sync             | Delta Constitution dikopi ke folder Sigma, rename `SIGMA_CONSTITUTION.md`. **Jika Delta Constitution diamendemen, Sigma WAJIB mengikuti amendemen tersebut.** Perubahan konstitusi di Delta berpengaruh ke Sigma. |

### Keputusan Seksi C — AI Roles

| #   | Keputusan          | Detail                                                                                                                    |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| C1  | Jumlah role        | **4 role**: ARC, AUD, FMN, DEV                                                                 |
| C2  | Nama & kode        | **ARC** (Architect), **AUD** (Auditor), **FMN** (Foreman), **DEV** (Developer)                 |
| C3  | Mapping Delta      | ARC = GMN, AUD = GPT+PPX, **FMN = ANT**, **DEV = CDC**                                         |
| C4  | Tugas ARC          | Menggali intent Director (wawancara/konsultasi), menyusun draft DIR-INTENT                     |
| C5  | Tugas AUD          | Brutal auditor (GPT+PPX gabungan), advisory only — bukan approval gate                         |
| C6  | Tugas FMN          | Work Order / implementation plan + evaluasi hasil coding DEV + simulasi testing (seperti ANT)  |
| C7  | Tugas DEV          | Implementasi kode + laporan hasil implementasi (seperti CDC)                                   |
| C8  | AUD mandatory?     | **Tidak.** Hanya pertimbangan untuk Director.                                                  |
| C9  | Role activation    | Sama seperti Delta — aktivasi eksplisit, tidak bisa pindah di tengah sesi, harus session baru  |
| C10 | Sigma Orchestrator | **Tidak diperlukan sekarang.**                                                                 |
| C11 | Rules lokasi       | **Rules sendiri**, tidak shared dengan Delta. Karena definisi role di Sigma bersifat gabungan. |
| C12 | NLM                | **Tidak masuk dulu.** Bisa dipertimbangkan nanti.                                              |
| C13 | Rules detail       | **Deferred** — spesifikasinya nanti saat implementasi                                          |
| C14 | Session bootstrap  | **Tetap ada.** `sigma session bootstrap` — agent wajib baca rules + dokumen aktif.             |

### Keputusan Seksi D — Artefak & Dokumen

| #   | Keputusan            | Detail                                                                                  |
| --- | -------------------- | --------------------------------------------------------------------------------------- |
| D1  | Total & nama artefak | **4 dokumen**: `DIR-INTENT`, `PLAN`, `EXEC`, `DIR-CLOSE`                                       |
| D2  | DIR-INTENT           | Director-owned, ARC-assisted. Intent + Strategy + Constraints.                                  |
| D3  | PLAN                 | Work Order + Simulation Test Report (oleh FMN). Gabungan WO + STR di Delta.                     |
| D4  | EXEC                 | Implementation Plan + Implementation Report (oleh DEV). Gabungan IMPL + WALK di Delta.          |
| D5  | DIR-CLOSE            | Closure — oleh Director (evidence summary + publish-ready docs)                                 |
| D6  | Naming convention    | Tetap `{ROLE}-{DOC}-{PROJECT_ID}-v{VER}.md` seperti Delta                                       |
| D7  | Versioning           | Tetap pakai Tier 1/2/3 seperti Delta                                                            |
| D8  | Konversi ke Delta    | **Tidak bisa.**                                                                                 |
| D9  | Folder               | **`Sigma/`** (folder sendiri, bukan `Delta/`)                                                   |
| D10 | Template & format    | **Deferred** — dibahas saat implementasi template                                               |
| D11 | CSO                  | **Tetap ada.** Disimpan di `Sigma/logs/`. Artefak opsional untuk handoff antar sesi.            |

### Keputusan Seksi E — CLI

| #   | Keputusan             | Detail                                                                                                                      |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| E1  | Pattern               | `sigma {domain} {action}` — mirip Delta                                                                                     |
| E2  | Command naming        | Mengikuti nama dokumen: `sigma intent new`, `sigma plan new`, `sigma exec new`, `sigma exec audit`, `sigma close new`, dll. |
| E3  | Cakupan               | CLI operasi penting di Delta harus ada di Sigma                                                                             |
| E4  | Approval gate         | Director only. AUD audit opsional (advisory), Director tetap approve.                                                       |
| E5  | Pre-build snapshot    | **Tidak perlu.** Cukup disiplin DEV + review AUD.                                                                           |
| E6  | `sigma audit`         | **Punya**                                                                                                                   |
| E7  | `sigma override`      | **Tidak punya**                                                                                                             |
| E8  | `sigma block/unblock` | **Tidak punya**                                                                                                             |
| E9  | Runtime state         | `progress.json` — seperti Delta, nanti disesuaikan                                                                          |
| E10 | `sigma promote`       | **Tidak ada.** Tidak bisa migrasi antar Sigma-Delta.                                                                        |
| E11 | Arsitektur CLI        | Samakan dengan Delta CLI                                                                                                    |
| E12 | Tech stack            | Node.js (mengikuti Delta)                                                                                                   |
| E13 | `sigma --help`        | Tetap ada                                                                                                                   |
| E14 | Mode interaktif       | **Boleh dibuat** — ide menarik                                                                                              |

### Keputusan Seksi F — Memory & MCP

| #   | Keputusan        | Detail                                                                                           |
| --- | ---------------- | ------------------------------------------------------------------------------------------------ |
| F1  | MCP Memory Graph | **Terpisah dari Delta**, fungsi tetap sama. Pakai MCP seperti Delta.                             |
| F2  | Memory tiers     | **3 tier**: Constitutional, Operational Sigma, Decision. (Ephemeral & Learning tidak diperlukan) |
| F3  | Decision Memory  | **Auto-harvest** dari lock events seperti Delta.                                                 |
| F4  | Learning Memory  | **Tidak perlu.**                                                                                 |
| F5  | CSO              | **Tetap ada**, tidak disederhanakan. (Sudah diputuskan di D)                                     |
| F6  | Cara kerja       | Sama seperti Delta.                                                                              |
| F7  | Memory search    | **Tidak perlu CLI command.** Delta juga tidak punya. Query via MCP tools (`search_nodes`).       |
| F8  | Memory decay     | **Tidak diperlukan.**                                                                            |
| F9  | Path             | **`Sigma/memory/`**                                                                              |

### Keputusan Seksi G — Workflow & Lifecycle

| #   | Keputusan             | Detail                                                                                         |
| --- | --------------------- | ---------------------------------------------------------------------------------------------- |
| G1  | Fase                  | **START → DESIGN → BUILD → CLOSE** *(dikoreksi: "PLAN" → "DESIGN" — lihat Session #3)*        |
| G2  | Gate Rules            | 3 gate: PLAN butuh INTENT locked; EXEC butuh PLAN locked; CLOSE butuh INTENT + 1 PLAN + 1 EXEC (versi sama) |
| G3  | State INTENT          | DRAFT → UNDER_REVIEW → {Audit AUD / Approval Director} → LOCKED → SUPERSEDED                   |
| G4  | State PLAN            | DRAFT → {Audit AUD / Approval Director} → LOCKED → SUPERSEDED                                  |
| G5  | State EXEC            | DRAFT → {Audit AUD / Approval Director} → BUILDING → TESTING → COMPLETED → LOCKED → SUPERSEDED |
| G6  | State DIR-CLOSE       | DRAFT → {Approval} → LOCKED → SUPERSEDED                                                       |
| G7  | Approval              | Hanya Director                                                                                 |
| G8  | Director tidak setuju | Tidak perlu mekanisme formal — jangan di-approve dulu                                          |
| G9  | Build iterasi         | Bisa diulang (v0.1, v0.2, dst.)                                                                |
| G10 | Minimum evidence      | Minimal 1 PLAN + 1 EXEC locked dengan versi yang sama                                          |
| G11 | Parallel execution    | Tidak — EXEC jangan dimulai sebelum PLAN di-approve                                            |
| G12 | Stale project         | Tidak masalah. Tinggal lanjutkan dari catatan yang ada.                                        |
| G13 | Close reopenable?     | **Revisi = versi baru.** LOCKED = baseline. Revisi → versi baru, lama → SUPERSEDED.            |

### Status Checklist

| Seksi     | Total   | Selesai | Pending |
| --------- | ------- | ------- | ------- |
| A         | 5       | 5       | 0       |
| B         | 9       | 9       | 0       |
| C         | 14      | 13      | 1       |
| D         | 11      | 8       | 3       |
| D+        | 6       | 6       | 0       |
| E         | 14      | 14      | 0       |
| F         | 9       | 9       | 0       |
| G         | 13      | 13      | 0       |
| H         | 5       | 5       | 0       |
| I         | 15      | 15      | 0       |
| J         | 8       | 8       | 0       |
| K         | 8       | 8       | 0       |
| L         | 6       | 6       | 0       |
| M         | 5       | 2       | 3       |
| N         | 3       | 2       | 1       |
| O         | 7       | 7       | 0       |
| **Total** | **147** | **138** | **9**   |

---

## Session #2 — 20260516 — AUD Audit Review

> **Auditor**: AUD (GPT Auditor)
> **Sumber**: Review `discussion.md` pasca Session #1
> **Status**: Audit selesai — rekomendasi diterapkan

### Temuan & Koreksi

| # | Temuan | Status |
|---|---|---|
| 1 | **ARC-PLAN tidak punya gate/state machine** — tidak konsisten sebagai artefak utama. Fungsi plan merge ke DIR-INTENT. Artefak: 4 → 3. | ✅ Diterapkan |
| 2 | **DIR-INTENT ownership** harus "Director-owned, ARC-assisted". ARC boleh draft, Director yang lock. | ✅ Diterapkan |
| 3 | **DIR-CLOSE "reopen"** ambigu — harusnya revisi = versi baru (v1.1, v2.0), versi lama SUPERSEDED. Bukan unlock/edit in place. | ✅ Diterapkan |
| 4 | **Folder path inkonsisten** — `07_Logs` vs `memory`. Standarisasi tanpa prefix: `logs/`, `memory/`. | ✅ Diterapkan |
| 5 | **Git Evidence** harus minimal/read-only. Tidak perlu heavy lifecycle seperti Delta Full. | ✅ Diterapkan |

### Keputusan yang Dikonfirmasi Kuat

- Nama Sigma, CLI `sigma`, standalone + Delta branding
- 3 role: ARC, AUD, DEV *(⚠️ keliru — lihat koreksi di bawah)*
- Gate hanya 2: EXEC butuh INTENT locked; CLOSE butuh INTENT + 1 EXEC locked *(⚠️ keliru — lihat koreksi di bawah)*
- AUD advisory only, Director only approval
- Tidak ada override, block/unblock, TEA, promote
- Sigma dan Delta tidak saling migrasi
- `sigma promote` tidak ada — boundary arsitektur bersih

> ⚠️ **Koreksi pasca Session #2**: Dua poin di atas keliru dan bertentangan dengan keputusan Session #1:
> - **Role**: Bukan 3, tapi **4 role** (ARC, AUD, **FMN**, DEV) — FMN (Foreman) sudah diputuskan di C1–C6 Session #1 sebagai role BUILD terpisah dari DEV.
> - **Gate**: Bukan 2, tapi **3 gate** — Gate 1: FMN-PLAN butuh INTENT locked; Gate 2: DEV-EXEC butuh FMN-PLAN locked; Gate 3: CLOSE butuh INTENT + 1 FMN-PLAN + 1 DEV-EXEC locked (versi sama). Ini konsisten dengan G2 yang sudah diputuskan di Session #1.
> Keputusan Session #1 (C1 dan G2) adalah yang benar dan digunakan di semua dokumen downstream.

### Verdict

**Sigma siap masuk ke `SIGMA_PROTOCOL.md`.** Semua keputusan arsitektur sudah konsisten. 8 item pending adalah detail template/implementasi, bukan blocker desain.

> **Update**: `SIGMA_PROTOCOL.md` sudah ditulis di Phase 0A (lihat Session #3).

---

## Session #3 — 20260516 — Phase 0A Execution Decisions

> **Peserta**: Director + Claude (Sonnet 4.6)
> **Topik**: Eksekusi Phase 0A — keputusan implementasi selama penulisan SIGMA_CONSTITUTION.md dan SIGMA_PROTOCOL.md
> **Status**: Selesai — dokumen Phase 0A sudah dibuat

### Keputusan & Koreksi Phase 0A

| #   | Keputusan | Detail |
| --- | --------- | ------ |
| S3-1 | **Fase pertama: "PLAN" → "DESIGN"** | Nama fase pertama diubah dari "plan" menjadi **DESIGN** untuk menghindari konflik nama dengan artifact FMN-PLAN. Lifecycle resmi: `START → DESIGN → BUILD → CLOSE`. Semua dokumen downstream menggunakan "DESIGN". |
| S3-2 | **SIGMA_CONSTITUTION.md: terminology adapted** | Bukan pure verbatim copy dari DELTA_CONSTITUTION.md. Struktur 10 artikel tetap sama, tapi terminologi diadaptasi untuk Sigma (Article I menyebut "Sigma", Article IV menggunakan Sigma artifact hierarchy). Sync obligation tetap berlaku: jika Delta Constitution diamendemen, SIGMA_CONSTITUTION.md harus diupdate. |
| S3-3 | **File location: dalam `Sigma/`** | SIGMA_CONSTITUTION.md dan SIGMA_PROTOCOL.md berada di `Sigma/` folder, bukan di project root. Semua governance artifacts Sigma (termasuk doctrine files) live inside `Sigma/`. |
| S3-4 | **sigma-ecosystem = dogfooding Sigma project** | Folder `sigma-ecosystem/` diperlakukan sebagai project root sekaligus registered Sigma project pertama. `Sigma/` di dalamnya adalah governance layer aktif untuk project ini sendiri. Sigma dibangun menggunakan Sigma protocol. |
| S3-5 | **SIGMA_PROTOCOL.md: living document** | Ditulis secara inkremental per fase. Phase 0A menulis sections 1–19 (foundational doctrine). Fase berikutnya menambah sections yang relevan tanpa menulis ulang sections sebelumnya kecuali ada konflik. |
| S3-6 | **AUD activation policy: confirmed (Open Item #1)** | AUD optional by default. Recommended sebelum INTENT lock pertama, sebelum build jika scope/tech risk non-trivial, sebelum public release. Mandatory hanya jika Director mark project sebagai risk-sensitive. |
| S3-7 | **SIGMA_PROTOCOL.md: section coverage per phase** | Phase 0A: 15 sections FULL, 2 sections FOUNDATIONAL (akan di-extend di Phase 1 dan 2), 1 section HIGH-LEVEL (CLI Command Surface — full spec di Phase 4). Detail di `Implementation/PLAN-0A.md`. |

### Dokumen yang Dihasilkan

| File | Lokasi | Status |
| ---- | ------ | ------ |
| `SIGMA_CONSTITUTION.md` | `Sigma/SIGMA_CONSTITUTION.md` | ✅ Selesai — Director-reviewed |
| `SIGMA_PROTOCOL.md` | `Sigma/SIGMA_PROTOCOL.md` | ✅ Selesai — Phase 0A sections complete |
| `PLAN-0A.md` | `Implementation/PLAN-0A.md` | ✅ Selesai — Director-approved |

### Open Items Resolved

| Open Item | Resolusi |
| --------- | -------- |
| #1 — AUD activation policy wording | ✅ Resolved — S3-6 di atas |

### Pending Items Sisa (dari sigma_phase_implementation.md)

| # | Open Item | Resolves In |
| - | --------- | ----------- |
| 2 | Rules detail untuk roles — ARC, AUD, FMN, DEV | Phase 2 |
| 3 | Template & format dokumen detail | Phase 1 |
| 4 | Sublayer authority labels dalam DIR-INTENT + FMN-PLAN template | Phase 1 |
| 5 | Isi dokumen closure / DIR-CLOSE format | Phase 1 |
| 6 | Detail teknis implementasi (daemon, auto-update, offline mode, telemetry) | Phase 6 |

---

## Session #4 — 20260516 — Phase 0B Design, AUD Audit & Execution

> **Peserta**: Director + AUD (GPT Auditor) + Claude (Sonnet 4.6)
> **Topik**: 3 diskusi desain pre-0B + AUD audit PLAN-0B (15 issue) + patch confirmations + Phase 0B file creation
> **Status**: Selesai — PLAN-0B.md + SIGMA_PROTOCOL.md diupdate, 3 file Phase 0B dibuat

### Diskusi Desain Pre-0B (3 Pertanyaan Director)

| # | Pertanyaan | Keputusan |
|---|---|---|
| Q1 | Bagaimana jika ada update sigma, sedangkan sigma project start di versi lama? | Dua jalur terpisah: `sigma setup update` (global, safe, tidak menyentuh project Sigma/) vs `sigma project sync` (project-level, Director-confirmed, dengan backup sebelum write). Schema mismatch: auto-migrate jika CLI lebih baru (backup + log); BLOCK semantic ops jika progress.json lebih baru dari CLI. |
| Q2 | Bagaimana jika mau reset progress dan mendaftarkan ulang? | `project_reset` dengan `--confirm` (soft: backup progress.json saja) atau `--confirm --wipe` (archive artifacts ke logs/reset-archive-{timestamp}/ — tidak pernah permanent delete). |
| Q3 | Bagaimana mengatur ulang project ID global? | `sigma project register` — re-register project ID dari progress.json ke ~/.sigma/projects.json. Tidak ada concept "project ID global" yang terpisah dari progress.json. |

### AUD Audit PLAN-0B — 15 Issues & Resolusi

| # | Issue AUD | Verdict Director | Patch |
|---|---|---|---|
| 1 | Operation count inkonsisten (32/37 di PLAN-0B) | ✅ Setuju + koreksi — count benar = 36 (AUD hitung 35, missing exec_list) | Semua referensi count → 36 |
| 2 | intent_lock: UNDER_REVIEW implication vs state machine | ✅ Setuju — hapus UNDER_REVIEW sepenuhnya. Review/audit tulis ke file dokumen, TIDAK ubah progress.json. | PLAN-0B + SIGMA_PROTOCOL sections 6.1-6.4 |
| 3 | plan_lock: state machine tidak explicitly say no auto-supersede | ✅ Setuju — tambah explicit no auto-supersede di description | PLAN-0B plan_lock description |
| 4 | Semantic level definition ambigu | ✅ Setuju — ubah ke "mutates project artifacts or runtime state" | PLAN-0B level definition |
| 5 | lifecycle_state missing CLOSED enum | ✅ Setuju — tambah CLOSED: close_lock → CLOSED | PLAN-0B + SIGMA_PROTOCOL |
| 6 | Gate 3: tidak enforce full chain INTENT→PLAN→EXEC | ✅ Setuju — Gate 3 harus validasi chain: active INTENT LOCKED → PLAN LOCKED referencing it → EXEC LOCKED referencing that PLAN | PLAN-0B + SIGMA_PROTOCOL Section 7 |
| 7 | STALE_INTENT: kontradiksi antara "warn" dan "block" | ✅ Setuju — explicit: `--ack-stale-intent` flag REQUIRED, tanpa flag = BLOCK. Acknowledgment dicatat di DIR-CLOSE DRAFT metadata. | PLAN-0B + SIGMA_PROTOCOL Section 9 |
| 8 | plan_lock: no-auto-supersede perlu ditegaskan | ✅ Sama dengan #3 | |
| 9 | project_sync: tidak ada mention backup | ✅ Setuju — tambah backup line: "Backs up affected files to Sigma/logs/sync-backup-{timestamp}/ before writing" | PLAN-0B project_sync |
| 10 | setup_install: klaim manages MCP memory — overlap dengan setup_memory | ✅ Setuju — hapus MCP dari setup_install scope. Strict separation. | PLAN-0B setup_install |
| 11 | gitignore level: "semantic" vs "read_only" | ✅ Setuju — ubah ke read_only (stdout only, tidak write file) | PLAN-0B gitignore_generate |
| 12 | SIGMA-REGISTRY: dua authority axes tidak dibedakan | ✅ Setuju — split ke semantic authority vs runtime authority | PLAN-0B + SIGMA_PROTOCOL |
| 13 | Folder naming: strategy/execution/closure → design/build/close | ✅ Director patch sekarang — lebih konsisten dengan lifecycle phase names | PLAN-0B + SIGMA_PROTOCOL Sections 5, 6, 12, 13 |
| 14 | SIGMA-REGISTRY count: 9 vs 10 | ✅ Koreksi — 10 entries termasuk progress_json (runtime_state tier) | PLAN-0B |
| 15 | Seed file note perlu klarifikasi | ✅ Setuju — tambah note tentang DIR-DI-000-SIGMA vs lifecycle artifact | PLAN-0B |

### Keputusan Final Phase 0B

| #  | Keputusan | Detail |
|----|---|---|
| S4-1 | **Naming convention final** | `{ROLE}-{DOC}-v{VERSION}.md` — PROJECT_ID **dihapus** dari filename. Project identity di progress.json dan ~/.sigma/projects.json. Alasan: path sudah berikan project context; lebih clean; tidak ada rename cost jika project ID berubah. |
| S4-2 | **Folder structure final** | `design/` (DIR-INTENT), `build/` (FMN-PLAN + DEV-EXEC), `close/` (DIR-CLOSE). Menggantikan strategy/execution/closure — konsisten dengan lifecycle phase names. |
| S4-3 | **UNDER_REVIEW dihapus** | Tidak ada state UNDER_REVIEW di progress.json state machine. Audit/review command tulis ke file dokumen saja — tidak mengubah runtime state. |
| S4-4 | **lifecycle_state enum final** | `DESIGN \| BUILD \| CLOSE \| CLOSED`. Transitions: project_start → DESIGN; intent_lock → BUILD; close_new → CLOSE; close_lock → CLOSED. |
| S4-5 | **Gate 3 chain-based** | Validasi chain: active INTENT LOCKED → ≥1 PLAN LOCKED referencing that INTENT → ≥1 EXEC LOCKED referencing that PLAN. Independent PLAN/EXEC tanpa chain tidak satisfies Gate 3. |
| S4-6 | **STALE_INTENT: block behavior** | `close new` BLOCKS tanpa `--ack-stale-intent` jika chain ada stale_intent=true. Flag required; acknowledgment dicatat di DIR-CLOSE DRAFT metadata. |
| S4-7 | **setup_install vs setup_memory** | Strict separation: setup_install hanya deploy files/templates/shortcuts; setup_memory handle MCP memory config. Tidak overlap. |
| S4-8 | **project_sync: Director-confirmed + backup** | Tidak pernah auto-triggered oleh setup_update. Requires --confirm. Backup sebelum write ke Sigma/logs/sync-backup-{timestamp}/. |
| S4-9 | **project_reset modes** | Soft (--confirm): backup progress.json saja. Archive (--confirm --wipe): archive artifact files ke logs/reset-archive-{timestamp}/. Never permanent delete. |
| S4-10 | **Schema migration policy** | Auto-migrate (CLI newer): backup + write + migration log. Block (CLI older): error message. Read-only ops masih allowed saat blocked. |
| S4-11 | **SIGMA-REGISTRY authority: dua axes** | Semantic authority: constitutional → operational_governance → agent_rule → agent_config. Runtime authority: runtime_state (progress.json). Konflik: progress.json wins untuk gate decisions. |
| S4-12 | **36 operations total** | Distribusi per domain: project(5), session(1), intent(5), plan(6), exec(9), close(4), git(1), cso(1), setup(3), gitignore(1). |

### Dokumen yang Dihasilkan

| File | Lokasi | Status |
|------|--------|--------|
| `PLAN-0B.md` | `Implementation/PLAN-0B.md` | ✅ Selesai — 15 patches applied |
| `SIGMA_PROTOCOL.md` (updates) | `Sigma/SIGMA_PROTOCOL.md` | ✅ Selesai — Sections 5-7, 9-10, 12-13 updated |
| `SIGMA-OPERATION-REGISTRY.json` | `Sigma/SIGMA-OPERATION-REGISTRY.json` | ✅ Selesai — 36 operations |
| `SIGMA-REGISTRY.json` | `Sigma/SIGMA-REGISTRY.json` | ✅ Selesai — 10 document entries |
| `progress.json` | `Sigma/progress.json` | ✅ Selesai — seed file for sigma-ecosystem |

### Open Items dari Session #4

Tidak ada open item baru. Semua 15 AUD audit items resolved.
