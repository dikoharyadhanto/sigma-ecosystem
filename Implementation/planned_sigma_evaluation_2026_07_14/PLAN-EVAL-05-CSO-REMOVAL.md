# PLAN-EVAL-05 — Penghapusan Total Fitur CSO (Context Session Object)

**Sumber**: `Discussion/sigma-system-evaluation-2026-07-14.md` (Topik 4 — kategori "Evaluate to be removed", item `cso`)
**Tanggal**: 2026-07-14
**Status**: IMPLEMENTED
**Urutan eksekusi**: 5 dari 8 (lihat `README.md` di folder ini)
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN, tidak punya otoritas lock/gate Sigma.

---

## Objective

Menghapus fitur CSO (`cso new`) secara penuh dari sistem — bukan hanya command
CLI, tapi seluruh sistem yang bergantung padanya: rule file per role, dokumen
publik, dan skill Claude Code. Perannya sudah digantikan `sigma
message`/inbox untuk konteks handover.

**Keputusan Director bersifat FINAL dan cakupan penuh** (dikonfirmasi
eksplisit di sesi evaluasi): hapus termasuk seluruh sistem yang bergantung
pada CSO, bukan cuma command CLI.

---

## Alasan Director

Konsep CSO bagus tapi tidak dibutuhkan — perannya sudah digantikan `sigma
message`/inbox untuk konteks handover antar sesi/role.

---

## Cakupan Penghapusan

### 1. Command CLI
- `src/commands/cso.ts` (`cso new`).

### 2. Referensi Konsep di Rule File Role (4 file)
- `Sigma/rules/ARC-RULE.md`
- `Sigma/rules/AUD-RULE.md`
- `Sigma/rules/DEV-RULE.md`
- `Sigma/rules/FMN-RULE.md`, mis. [FMN-RULE.md:361](../../Sigma/rules/FMN-RULE.md#L361)

### 3. Dokumentasi Publik
- `README.md`
- `Sigma/SIGMA_PROTOCOL.md`

### 4. Skill Claude Code (diperluas ke semua platform saat implementasi)
- Skill `/cso` — memanggil `sigma cso new` langsung.
- Skill `/checkpoint` — memanggil `sigma cso new` langsung.
- Kedua skill perlu **dipensiunkan atau dialihkan ke `sigma send`** (keputusan bentuk pengalihan ditentukan saat implementasi — lihat Task Breakdown).
- **Update saat implementasi**: pasangan skill `/cso` + `/checkpoint` yang sama juga ditemukan di 3 platform lain (Codex, Reasonix, Antigravity) — tidak tertulis eksplisit di draft awal ini. Director mengonfirmasi cakupan diperluas ke keempat platform sekaligus di sesi implementasi (lihat Implementation Walkthrough).

---

## Task Breakdown

**Tahap 1 — Pemetaan Referensi Lengkap**
- [x] Grep menyeluruh untuk `cso`/`CSO`/`Context Session Object` di seluruh repo (`src/`, `Sigma/`, `README.md`, skill directory Claude Code) untuk memastikan cakupan di atas lengkap sebelum mulai menghapus. Hasil awal: 104 file mengandung referensi (termasuk arsip `Discussion/`/`Implementation/`). Grep ulang di tengah implementasi menemukan cakupan lebih luas dari draft awal — lihat Implementation Walkthrough.

**Tahap 2 — Hapus Command & Engine**
- [x] Hapus `src/commands/cso.ts` dan registrasinya di `src/cli.ts`.
- [x] Hapus fungsi engine pendukung CSO — tidak ada helper terpisah di `src/engine/`; ditemukan sebagai gantinya: entri `'sigma cso'` di `src/utils/mcp.ts` (`SIGMA_SHELL_ALLOWED`) dan `Sigma/templates/CSO-TEMPLATE.md`, keduanya dihapus.
- [x] Hapus test terkait CSO (grep `cso` di folder `test/`) — `test/doctor-invalid.test.ts`, `test/progress-hardening.test.ts`, `test/helpers.ts` disesuaikan.

**Tahap 3 — Bersihkan Rule File**
- [x] Revisi `Sigma/rules/ARC-RULE.md`, `AUD-RULE.md`, `DEV-RULE.md`, `FMN-RULE.md` — hapus seluruh referensi konsep/alur CSO ([FMN-RULE.md:361](../../Sigma/rules/FMN-RULE.md#L361) dan yang lain hasil Tahap 1).

**Tahap 4 — Bersihkan Dokumentasi**
- [x] Update `README.md` — hapus bagian yang menjelaskan `sigma cso new` (tabel artifact, shortcut `/cso`/`/checkpoint`, tabel Sigma Skills, tabel Command Reference). Dua referensi historis dipertahankan sengaja (catatan migrasi legacy `progress.json.cso[]` dan daftar "what is preserved").
- [x] Update `Sigma/SIGMA_PROTOCOL.md` — hapus referensi CSO di seluruh bagian yang relevan (Section 5.5 artifact definition, tabel command domain, tabel command tier, formatting standards, dsb).

**Tahap 5 — Pensiunkan/Alihkan Skill**
- [x] Putuskan bentuk pengalihan skill `/cso` dan `/checkpoint`. Keputusan final Director: **hapus total kedua skill, tanpa alias** — bukan opsi (b)/(c) yang semula diusulkan. Alasan Director: tujuan evaluasi ini merampingkan sistem Sigma dari operasi yang tidak diperlukan; `sigma send`/inbox sudah menjadi jalur resmi handoff, sehingga alias buatan untuk `/checkpoint` tidak punya urgensi fungsional dan hanya menambah kompleksitas (self-addressing + gate unread-inbox yang tidak relevan untuk kasus pakai checkpoint).
- [x] Implementasikan pilihan yang dikonfirmasi di file skill terkait — diperluas ke 4 platform (Claude Code, Codex, Reasonix, Antigravity), bukan hanya Claude Code seperti draft awal.

**Tahap 6 — Verifikasi Akhir**
- [x] Grep ulang seluruh repo untuk memastikan tidak ada sisa referensi `cso`/CSO yang lolos dari Tahap 2-5. Hasil akhir: 0 referensi aktif tersisa di luar 2 catatan legacy yang disengaja di `README.md` dan dokumen arsip `Discussion/`/`Implementation/`.

---

## Dependency Catatan

- **PLAN-EVAL-08** (setup final pass) memiliki dependency **masuk** dari plan
  ini: `ROLE_FILES` map di `src/commands/setup.ts` punya entri `checkpoint`/
  `cso` per platform yang perlu dihapus sebagai konsekuensi plan ini — item itu
  sengaja **tidak** dikerjakan di sini, melainkan di PLAN-EVAL-08 sesuai
  arahan "topik setup dikerjakan di akhir".
- Tidak ada dependency masuk dari plan lain — CSO removal berdiri sendiri.

---

## Risiko

- Skill `/cso` dan `/checkpoint` adalah satu-satunya jalur command CSO yang
  benar-benar dipakai Director sehari-hari (via Claude Code) — pastikan
  pengalihan Tahap 5 dikomunikasikan jelas, jangan sampai Director kehilangan
  alur checkpoint tanpa pengganti yang jelas.
- Referensi CSO tersebar di banyak file (4 rule file + 2 dokumen + 1 skill
  pasangan) — risiko utama adalah referensi yang lolos grep pertama (Tahap
  1). Tahap 6 wajib dilakukan sebagai verifikasi penutup.

---

## Draft Acceptance Criteria

- [x] `sigma cso new` tidak lagi terdaftar di CLI. Diverifikasi via `node dist/cli.js --help`.
- [x] Tidak ada referensi CSO tersisa di `ARC-RULE.md`, `AUD-RULE.md`, `DEV-RULE.md`, `FMN-RULE.md`.
- [x] Tidak ada referensi CSO tersisa di `README.md`/`SIGMA_PROTOCOL.md` (kecuali 2 catatan legacy yang disengaja di README.md — lihat Implementation Walkthrough).
- [x] Skill `/cso` dan `/checkpoint` sudah dipensiunkan — **dihapus total, tanpa alias**, sesuai keputusan final Director (bukan opsi alias `sigma send` yang semula diusulkan draft ini).
- [x] Grep akhir untuk `cso`/CSO di seluruh repo tidak menemukan referensi aktif yang tersisa (di luar catatan historis di `Discussion/`/`Implementation/` yang memang dokumen arsip).
- [x] `npm test` lulus — 21 file test, 131 test, semua passed. Modifikasi test dibatasi pada penyesuaian terkait CSO (`test/doctor-invalid.test.ts`, `test/progress-hardening.test.ts`, `test/helpers.ts`) plus penghapusan import `path` yang jadi tidak terpakai di `doctor-invalid.test.ts`.

---

## Implementation Walkthrough

**Tanggal eksekusi**: 2026-07-14
**Mode**: Professional Mode (bukan DEV role Sigma governance — plan ini bukan FMN-PLAN, tidak lock/gate)

### Keputusan Director selama sesi implementasi

Dua open question diajukan sebelum implementasi dimulai, keduanya dijawab eksplisit oleh Director:

1. **Bentuk pengalihan `/checkpoint`**: draft awal mengusulkan alias ke `sigma send`. Setelah ditelusuri, pemetaan itu butuh desain self-addressed message plus mewarisi gate unread-inbox yang tidak dimiliki CSO lama — kompleksitas baru tanpa kebutuhan fungsional nyata. Director memutuskan **hapus total kedua skill, tanpa alias**, dengan alasan: tujuan evaluasi ini adalah merampingkan sistem Sigma dari operasi yang tidak diperlukan, dan `sigma send`/inbox sudah menjadi jalur resmi handoff sejak awal.
2. **Cakupan platform**: draft awal hanya menyebut skill Claude Code. Ditemukan pasangan skill `/cso`+`/checkpoint` yang identik juga ada di Codex, Reasonix, dan Antigravity. Director mengonfirmasi cakupan diperluas ke keempat platform sekaligus di plan ini (bukan didefer ke PLAN-EVAL-08).

### Cakupan aktual vs draft tertulis

Pemetaan referensi awal (Tahap 1) mengarah ke grep dasar sebelum implementasi dimulai. Selama eksekusi, ditemukan beberapa titik referensi CSO yang **tidak tertulis eksplisit** di draft awal plan ini, dan dimasukkan ke scope karena konsisten dengan keputusan Director "cakupan penuh — seluruh sistem yang bergantung pada CSO":

| Area tambahan | Detail |
|:--- |:--- |
| `src/utils/mcp.ts` | Entri `'sigma cso'` di `SIGMA_SHELL_ALLOWED` (daftar shell command yang di-whitelist untuk Reasonix) — dihapus. |
| `Sigma/templates/CSO-TEMPLATE.md` | Template yang dipakai `cso.ts` — dihapus sebagai bagian "engine pendukung". |
| `setup/targets/bridge/{CLAUDE,GEMINI,AGENTS}.md` | Kalimat "Project context for handoff uses CSO artifacts." — diganti referensi ke `sigma send`/`sigma inbox`. |
| 20 file skill role per-platform | `arc.md`/`fmn.md`/`dev.md`/`aud.md`/`report.md` di 4 platform (Claude Code, Codex, Reasonix, Antigravity) masing-masing punya section sendiri ("Optional CSO Context", "External Audit CSO Scope", baris CSO di tabel Director-Facing Communication Rules, baris di Information Sources) — terpisah dari `Sigma/rules/*.md` yang sudah eksplisit disebut Tahap 3. Dibersihkan dengan script Node.js karena konten identik lintas platform. |
| `setup/sigma-memory-seed.jsonl` | Seed data MCP memory ecosystem-level — entity `SigmaCSO` + 2 relasi + beberapa observation lain (domain list, project structure) yang menyebut CSO — dihapus/disesuaikan. |
| `Sigma/templates/DEV-EXEC-TEMPLATE.md` | Field "CSO / handoff artifacts consulted" di section DEV Pre-Build Assessment — diganti "Inbox handoff messages consulted" agar tetap merujuk mekanisme yang masih ada. |
| `Sigma/SIGMA-REGISTRY.json` / `SIGMA-OPERATION-REGISTRY.json` | Bukan `sigma refresh` (tidak ada command CLI dengan nama itu) — mekanisme aktual adalah `npm run refresh-registries` (`scripts/refresh-registries.js`), yang bersifat **additive-only**: entri yang sudah tidak terdeteksi di CLI hanya dilaporkan ("review manually"), tidak dihapus otomatis. Entri `cso_new`/domain `cso` dihapus manual, dibatasi hanya yang terkait CSO (6 entri stale lain yang ikut terdeteksi laporan itu pre-existing, di luar scope plan ini, tidak disentuh). |
| `dist/commands/cso.*` | Artifact build lama — `dist/` ternyata tracked di git dan `tsc` tidak membersihkan file lama secara otomatis; dihapus manual lalu rebuild. |

### Urutan eksekusi aktual

1. Hapus `src/commands/cso.ts` + registrasi `src/cli.ts` + entri `mcp.ts` + `CSO-TEMPLATE.md`.
2. Bersihkan 4 rule file (`Sigma/rules/*-RULE.md`).
3. Bersihkan `README.md` dan `Sigma/SIGMA_PROTOCOL.md`.
4. Bersihkan 3 bridge stub template.
5. Hapus 8 file/folder skill `/cso`+`/checkpoint` di 4 platform.
6. Hapus entri `checkpoint`/`cso` dari `ROLE_FILES` map di `src/commands/setup.ts`.
7. Sesuaikan/hapus test terkait CSO di 3 file.
8. Build TypeScript (`npm run build`) — bersih, lalu ditemukan & dibersihkan stale `dist/commands/cso.*`, rebuild ulang.
9. Sinkronisasi registry: `npm run refresh-registries` (additive-only) + cleanup manual entri `cso_new`/domain `cso` di `SIGMA-OPERATION-REGISTRY.json`, plus penyesuaian deskripsi terkait di `SIGMA-REGISTRY.json`.
10. Grep verifikasi menyeluruh → ditemukan 20 file skill per-platform + memory seed + `DEV-EXEC-TEMPLATE.md` yang belum tercakup draft awal → dibersihkan (lihat tabel di atas).
11. Grep verifikasi ulang → 0 referensi aktif tersisa di luar arsip.
12. `npm test` → 21 file test, 131 test, semua passed.

### Hasil akhir

- 61 file berubah (`git status --short`): penghapusan file command/skill/template, dan penyesuaian referensi di rule file, dokumentasi, bridge stub, skill per-platform, registry, dan memory seed.
- Tidak ada perubahan pada `Sigma/progress.json` (plan ini bukan governance artifact, tidak menyentuh lock/gate state).
- Belum di-commit ke git — menunggu keputusan Director kapan melakukan commit.
