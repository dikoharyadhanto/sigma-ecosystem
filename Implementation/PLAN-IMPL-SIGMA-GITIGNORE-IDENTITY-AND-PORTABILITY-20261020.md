# PLAN-IMPL: Default Gitignore Seluruh Jejak Sigma (Kecuali `.sigma-identity.json`), Guardrail Blokir Lintas-Mesin, Non-Destructive Git Index Cleanup, dan Konfigurasi `sigma config`

**Tanggal:** 2026-10-20 (Revisi Final — Pesan Blokir Bahasa Inggris & Tabel Pemetaan File Terverifikasi)  
**Status:** DRAFT FINAL — Menunggu Perintah Eksplisit Director untuk Eksekusi Kode  
**Target Sistem:** Sigma Ecosystem v2.1.0 (`SCHEMA_VERSION = '1.2.0'`)  
**Lingkup Repository:** Master Repository Sigma (`/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem`)

---

## 1. Prinsip Dasar & Ketetapan Arsitektur Director

Seluruh rancangan dalam dokumen ini tunduk pada **6 Invarian Mutlak** yang ditetapkan oleh Director:

1. **Invarian 1 — 100% Non-Destruktif terhadap File Lokal (Zero Local File Deletion):**
   Penerapan fitur gitignore maupun pembersihan indeks Git **dilarang keras bersifat destruktif**. Seluruh file Sigma yang ada di disk lokal pada mesin asli tempat proyek teregistrasi (`Sigma/**`, `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `DEEPSEEK.md`, `REASONIX.md`, `.mcp.json`, `opencode.json`, `CHANGE-RECORD.md`, `dev/.sigma-workspace.json`) **wajib tetap utuh 100% di lokal**. Tidak boleh ada satu pun file lokal Sigma yang terhapus dari harddisk akibat penerapan gitignore atau pengubahan konfigurasi.
2. **Invarian 2 — Default Gitignore `ON` Kecuali `.sigma-identity.json`:**
   Secara default (`gitignore_sigma: true`), seluruh file yang dihasilkan atau dikelola oleh Sigma dimasukkan ke blok `.gitignore` proyek, **kecuali satu file**: `/.sigma-identity.json` di root proyek.
3. **Invarian 3 — Perlindungan Mutlak terhadap Folder `./dev` (DEV Workspace):**
   Folder `./dev` **dilarang keras dimasukkan ke `.gitignore`** karena ketika konfigurasi DEV workspace aktif (`sigma dev create-workspace`), seluruh kode dan hasil pekerjaan proyek disimpan di dalam folder `./dev`. Hanya file metadata internal buatan Sigma yang berada di dalam `./dev` (yaitu `/dev/.sigma-workspace.json` dan `/dev/CHANGE-RECORD.md`) yang di-gitignore secara spesifik per nama file, sedangkan folder `/dev/` dan seluruh hasil proyek di dalamnya tetap dilacak penuh oleh Git.
4. **Invarian 4 — Fungsi `.sigma-identity.json` sebagai Penjaga / Pemblokir (Guardrail) di Mesin Lain (Pesan dalam Bahasa Inggris):**
   Ketika repositori di-*pull* atau di-*clone* di **mesin lain** saat gitignore Sigma aktif di mesin asli, di mesin lain tersebut hanya akan ada `.sigma-identity.json` sedangkan direktori `Sigma/` beserta isinya tidak ditemukan.
   - Apabila di mesin lain tersebut pengguna/AI mencoba **meregistrasi ulang Sigma** (`sigma project start`, `sigma project register`, `sigma project sync`) **ATAU menjalankan operasi Sigma apa pun** (CLI maupun MCP): **Seluruh operasi Sigma WAJIB DIBLOKIR dan MENOLAK DIJALANKAN** dengan pesan dalam **Bahasa Inggris**:

     ```text
     [SIGMA BLOCKED — MISSING LOCAL SIGMA FILES]
     This project was previously registered with Sigma (detected via .sigma-identity.json: <project_id> — "<project_name>"),
     but the Sigma runtime files (Sigma/) were not found on this machine.
     
     All Sigma operations are blocked and you cannot run any Sigma command on this machine
     (including re-registering or re-initializing the project).
     
     To use Sigma on this machine:
       1. On the original machine where this project is registered, disable Sigma gitignore:
          sigma config set gitignore off
       2. Commit and push all Sigma files from the original machine to your Git repository.
       3. Run `git pull` on this machine.
     ```
5. **Invarian 5 — Pembersihan Indeks Git Secara Bersih untuk Proyek Lama (`git rm --cached`):**
   Pada proyek yang sudah terlanjur meng-commit file-file Sigma ke Git, saat gitignore ini diterapkan (`ON`), Sigma otomatis melepaskan file-file Sigma (selain `.sigma-identity.json`) dari **indeks pelacakan Git** (`git rm -r --cached`) tanpa menghapus file fisik di disk lokal.
6. **Invarian 6 — Pengaturan di `sigma config` (Activate / Deactivate, Default `ON`) & Portabilitas Saat `OFF`:**
   Setting ini dapat diaktifkan (`on`/`activate`) dan dinonaktifkan (`off`/`deactivate`) melalui `sigma config set gitignore <mode>`, dengan nilai default **`ON`**. Ketika pengguna mematikan gitignore (`off`) di mesin asli lalu melakukan *push* dan *pull* ke mesin kedua, normalisasi hash (`lfSha256`) dan penyesuaian path lokal `.mcp.json` memastikan proyek Sigma yang di-*pull* secara utuh di mesin kedua langsung dapat bekerja tanpa rusak oleh perbedaan hash/OS/path.

---

## 2. Tabel Pemetaan Lengkap Seluruh File & Folder Hasil Operasi Sigma

Tabel berikut telah diverifikasi melalui dua metode sekaligus: (1) **Eksplorasi kode sumber** di master folder Sigma (`src/config.ts`, `src/commands/project.ts`, `src/engine/devWorkspace.ts`, `src/services/changelogService.ts`, `src/utils/mcpConfig.ts`) dan (2) **Uji empiris registrasi proyek dummy** (`sigma project start` + `sigma dev create-workspace` di `/tmp`).

### 2.1 Tabel A — Daftar Seluruh File & Folder Hasil Operasi Sigma yang MASUK `.gitignore` (Default `ON`)

Seluruh **12 entri** di bawah ini adalah file/folder yang dihasilkan karena aktivitas operasi Sigma dan **wajib masuk `.gitignore`** (serta dibersihkan dari indeks Git via `git rm --cached` jika sudah terlanjur ter-commit):

| No     | Path yang Didaftarkan di `.gitignore` | Lokasi                   | Operasi Sigma yang Menghasilkan                                     | Keterangan                                                                                                                                          |
|:------ |:------------------------------------- |:------------------------ |:------------------------------------------------------------------- |:--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | `/Sigma/`                             | Folder `./Sigma`         | `sigma project start` & seluruh operasi runtime Sigma               | Mengabaikan seluruh direktori `./Sigma` beserta seluruh artefak, rules, templates, logs, messages, memo, revisions, dan `.mcp-control` di dalamnya. |
| **2**  | `/CLAUDE.md`                          | Root proyek (`./`)       | `sigma project start` / `sigma project sync`                        | File jembatan instruksi AI untuk Claude Code (`BRIDGE_STUBS`).                                                                                      |
| **3**  | `/GEMINI.md`                          | Root proyek (`./`)       | `sigma project start` / `sigma project sync`                        | File jembatan instruksi AI untuk Gemini / Antigravity (`BRIDGE_STUBS`).                                                                             |
| **4**  | `/AGENTS.md`                          | Root proyek (`./`)       | `sigma project start` / `sigma project sync`                        | File jembatan instruksi AI untuk Codex / OpenCode (`BRIDGE_STUBS`).                                                                                 |
| **5**  | `/DEEPSEEK.md`                        | Root proyek (`./`)       | `sigma project start` / `sigma project sync`                        | File jembatan instruksi AI untuk DeepSeek (`BRIDGE_STUBS`).                                                                                         |
| **6**  | `/REASONIX.md`                        | Root proyek (`./`)       | `sigma project start` / `sigma project sync`                        | File jembatan instruksi AI untuk Reasonix (`BRIDGE_STUBS`).                                                                                         |
| **7**  | `/.mcp.json`                          | Root proyek (`./`)       | `sigma project start` / `sigma project sync`                        | Konfigurasi MCP lokal (Claude Code / Reasonix) yang memuat path absolut mesin lokal.                                                                |
| **8**  | `/opencode.json`                      | Root proyek (`./`)       | `sigma project start` / `sigma project sync`                        | Konfigurasi MCP lokal (OpenCode) yang memuat path absolut mesin lokal.                                                                              |
| **9**  | `/opencode.jsonc`                     | Root proyek (`./`)       | `sigma project start` / `sigma project sync`                        | Varian `.jsonc` dari konfigurasi MCP OpenCode di root proyek.                                                                                       |
| **10** | `/CHANGE-RECORD.md`                   | Root proyek (`./`)       | `sigma project start` / `sigma project sync` / `sigma exec approve` | File changelog yang dihasilkan oleh operasi Sigma di root proyek (`changelogService.ts`).                                                           |
| **11** | `/dev/.sigma-workspace.json`          | Di dalam folder `./dev/` | `sigma dev create-workspace` / `sigma doctor --repair-workspace`    | **Masuk `.gitignore`:** File penanda workspace yang dihasilkan oleh operasi Sigma di dalam folder `./dev`.                                          |
| **12** | `/dev/CHANGE-RECORD.md`               | Di dalam folder `./dev/` | `sigma project sync` / `sigma exec approve` (saat `dev/` aktif)     | **Masuk `.gitignore`:** File changelog yang dihasilkan oleh operasi Sigma di dalam folder `./dev`.                                                  |

---

### 2.2 Tabel B — Daftar File & Folder yang TIDAK MASUK `.gitignore` (Tetap Dilacak oleh Git)

| No    | Path di Proyek                                                                                | Status di Git                         | Aturan di Blok `.gitignore`                                                                    | Keterangan                                                                                                                                                    |
|:----- |:--------------------------------------------------------------------------------------------- |:------------------------------------- |:---------------------------------------------------------------------------------------------- |:------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | `/.sigma-identity.json`                                                                       | **TIDAK DI-GITIGNORE (Tetap di Git)** | `!/.sigma-identity.json`                                                                       | **Satu-satunya file dari Sigma yang tidak di-gitignore.** Menjadi identitas bahwa proyek pernah teregistrasi Sigma dan memicu blokir guardrail di mesin lain. |
| **2** | Seluruh file lain di dalam `./dev/` *(selain `.sigma-workspace.json` dan `CHANGE-RECORD.md`)* | **TIDAK DI-GITIGNORE (Tetap di Git)** | *(Folder `/dev/` tidak di-ignore; hanya 2 file Sigma pada Tabel A No. 11 & 12 yang di-ignore)* | Seluruh kode sumber dan hasil pekerjaan proyek di dalam folder `./dev` tetap dilacak normal oleh Git.                                                         |

---

### 2.2 Rincian Subfolder & File di Dalam `/Sigma/` (Seluruhnya Otomatis Ter-cover oleh Rule `/Sigma/`)

Saat `sigma project start` dan operasi siklus dijalankan, seluruh item di bawah ini berada di dalam `/Sigma/` dan otomatis ter-gitignore oleh satu baris `/Sigma/`:

| Sub-Path di Dalam `/Sigma/`           | Fungsi                                                                                                                                           |
|:------------------------------------- |:------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Sigma/activate_status.json`          | Manifest status aktivasi proyek, pointer `active_chain`, serta tempat baru untuk `sigma_applied` dan `logs_created_at`.                          |
| `Sigma/project.config.json`           | Konfigurasi bahasa proyek, kuota mailbox/memo, dan setting `git.gitignore_sigma` (`true`/`false`).                                               |
| `Sigma/progress-v<N>.json`            | State mesin siklus per versi rantai (`INTENT`, `PLAN`, `EXEC`, `CLOSE`, gate status, dan hash sertifikasi).                                      |
| `Sigma/notes-registry.json`           | Registri catatan proyek (F06).                                                                                                                   |
| `Sigma/SIGMA_CONSTITUTION.md`         | Dokumen konstitusi Sigma yang disalin dari `~/.sigma/governance/`.                                                                               |
| `Sigma/SIGMA_PROTOCOL.md`             | Dokumen protokol Sigma yang disalin dari `~/.sigma/governance/`.                                                                                 |
| `Sigma/SIGMA-REGISTRY.json`           | Registri dokumen Sigma yang disalin dari bundle master.                                                                                          |
| `Sigma/SIGMA-OPERATION-REGISTRY.json` | Registri operasi CLI Sigma yang disalin dari bundle master.                                                                                      |
| `Sigma/rules/*`                       | Aturan peran (`ARC-RULE.md`, `FMN-RULE.md`, `DEV-RULE.md`, `AUD-RULE.md`, `DIRECTOR-PROTOCOL.md`, dll.).                                         |
| `Sigma/templates/*`                   | Template dokumen (`INTENT`, `ROADMAP`, `PLAN`, `EXEC`, `CLOSE`, `MEMO`, dll.).                                                                   |
| `Sigma/role-memory/*`                 | File JSON memori peran (`arc-memory.json`, `fmn-memory.json`, `dev-memory.json`, `aud-memory.json`).                                             |
| `Sigma/charter/*`                     | Dokumen `INTENT-v<N>.md` dan `intent-history.md`.                                                                                                |
| `Sigma/roadmap/*`                     | Dokumen `ROADMAP-v<N>.md`.                                                                                                                       |
| `Sigma/contract/*`                    | Dokumen kontrak kerja `PLAN-v<N.M>.md`.                                                                                                          |
| `Sigma/evidence/*`                    | Dokumen laporan implementasi `EXEC-v<N.M>.md`.                                                                                                   |
| `Sigma/close/*`                       | Dokumen penutupan siklus `CLOSE-v<N>.md`.                                                                                                        |
| `Sigma/review/*`                      | Dokumen ulasan produk `PRODUCT-REVIEW-v<N>.md`.                                                                                                  |
| `Sigma/notes/*`                       | `note-list.md`, `note-list/`, dan `unregistered-notes/`.                                                                                         |
| `Sigma/reference/*`                   | `reference-list.md` dan subfolder `data/`.                                                                                                       |
| `Sigma/logs/*`                        | `operations.jsonl`, `intent_amendment.log`, `f08.json`, dan `*_terminology-scan.log`.                                                            |
| `Sigma/messages/*`                    | `index.json`, `attachments/`, dan kotak pesan per peran (`DIRECTOR/`, `ARC/`, `FMN/`, `DEV/`, `AUD/`).                                           |
| `Sigma/memo/*`                        | Kotak memo mandiri per peran (`ARC/`, `FMN/`, `DEV/`, `AUD/`).                                                                                   |
| `Sigma/memory/*`                      | `overrides.jsonl` (riwayat Director override).                                                                                                   |
| `Sigma/revisions/*`                   | Snapshot dan ledger revisi kontrak (`PLAN-v<X.Y>/`, `INTENT-v<N>/`, `staging/`).                                                                 |
| `Sigma/.mcp-control/*`                | State transaksi control plane MCP (`idempotency/`, `tickets/`, `approvals/`, `journal/`, `audit-entries/`, `audit.jsonl`, `project-write.lock`). |

---

### 2.3 Blok `.gitignore` Eksak yang Akan Ditulis Sigma

Berdasarkan Tabel 2.1, berikut adalah isi blok terkelola yang akan disisipkan/diperbarui oleh Sigma di `<project_root>/.gitignore` ketika `gitignore_sigma` bernilai `true` (default `ON`):

```gitignore
# >>> sigma-managed >>>
# Managed by Sigma CLI (sigma config set gitignore on|off)
# Do not edit inside this block manually.
/Sigma/
/CLAUDE.md
/GEMINI.md
/AGENTS.md
/DEEPSEEK.md
/REASONIX.md
/.mcp.json
/opencode.json
/opencode.jsonc
/CHANGE-RECORD.md
/dev/.sigma-workspace.json
/dev/CHANGE-RECORD.md
!/.sigma-identity.json
# <<< sigma-managed <<<
```

> **Catatan Keamanan Folder `/dev/`:** Perhatikan bahwa `/dev/` **sama sekali tidak dicantumkan** sebagai folder yang di-ignore. Hanya dua file spesifik `/dev/.sigma-workspace.json` dan `/dev/CHANGE-RECORD.md` yang di-ignore. Seluruh kode aplikasi dan direktori di dalam `/dev/**` tetap dilacak oleh Git secara normal.

---

## 3. Rincian Desain Teknis per Area

### 3.1 Guardrail Blokir Penuh Saat Hanya `.sigma-identity.json` yang Ditemukan (`MISSING_SIGMA_FILES_GUARD`)

**Perubahan Desain (`src/utils/fs.ts`, `src/cli.ts`, `src/commands/project.ts`, `src/mcp/binding.ts`):**

1. Buat fungsi `inspectProjectRegistrationState(startDir)` di `src/utils/fs.ts`:

   - Menelusuri ke atas dari `startDir` untuk memeriksa keberadaan `.sigma-identity.json` dan `Sigma/activate_status.json`.
   - Mengembalikan salah satu dari 3 status:
     - `'REGISTERED_COMPLETE'`: `.sigma-identity.json` ada DAN `Sigma/activate_status.json` (beserta folder `Sigma/`) ada.
     - `'IDENTITY_ONLY_MISSING_SIGMA'`: `.sigma-identity.json` ditemukan (`registered: true`), tetapi folder `Sigma/` atau `Sigma/activate_status.json` **tidak ditemukan**.
     - `'UNREGISTERED'`: Keduanya tidak ditemukan.

2. **Gatekeeper Pemblokir Global (`assertSigmaFilesPresentOrThrow`):**

   - Dipasang pada:
     1. **Hook global `preAction` di `src/cli.ts`**: Memblokir **seluruh** perintah CLI Sigma (`sigma project start`, `sigma project register`, `sigma project sync`, `sigma project status`, `sigma session`, `sigma intent`, `sigma plan`, `sigma exec`, `sigma close`, `sigma config`, `sigma doctor`, `sigma git`, `sigma report`, `sigma dev`, dll. — hanya mengecualikan `sigma setup` yang merupakan installer global host).
     2. **Di dalam `runStart()`, `runRegister()`, `runSync()` di `src/commands/project.ts`**: Memastikan registrasi ulang tidak pernah bisa melewati blokir.
     3. **Di dalam `resolveBinding()` di `src/mcp/binding.ts`**: Memblokir seluruh panggilan tool MCP (`sigma-mcp`) di mesin kedua.

3. **Pesan Error Standar (dalam Bahasa Inggris):**

   ```text
   [SIGMA BLOCKED — MISSING LOCAL SIGMA FILES]
   This project was previously registered with Sigma (detected via .sigma-identity.json: <project_id> — "<project_name>"),
   but the Sigma runtime files (Sigma/) were not found on this machine.
   
   All Sigma operations are blocked and you cannot run any Sigma command on this machine
   (including re-registering or re-initializing the project).
   
   To use Sigma on this machine:
     1. On the original machine where this project is registered, disable Sigma gitignore:
        sigma config set gitignore off
     2. Commit and push all Sigma files from the original machine to your Git repository.
     3. Run `git pull` on this machine.
   ```

---

### 3.2 Jaminan 100% Non-Destruktif & Pembersihan Indeks Git (`src/utils/gitignore.ts`)

1. **Larangan Mutlak Penghapusan File Lokal:**
   - Modul `src/utils/gitignore.ts` **tidak pernah** memanggil `fs.remove`, `fs.unlink`, atau `git rm` tanpa `--cached` terhadap file Sigma mana pun.
   - Seluruh file Sigma di mesin lokal tetap utuh 100%.
2. **Pembersihan Indeks Git untuk Proyek Lama (`untrackSigmaFilesFromGitIndex`):**
   - Daftar path eksak yang diperiksa di indeks Git (sama persis dengan daftar `.gitignore`, tanpa menyentuh `.sigma-identity.json` dan tanpa menyentuh file kode proyek di dalam `dev/`):

     ```ts
     export const SIGMA_GITIGNORE_TARGET_PATHS = [
       'Sigma',
       'CLAUDE.md',
       'GEMINI.md',
       'AGENTS.md',
       'DEEPSEEK.md',
       'REASONIX.md',
       '.mcp.json',
       'opencode.json',
       'opencode.jsonc',
       'CHANGE-RECORD.md',
       'dev/.sigma-workspace.json',
       'dev/CHANGE-RECORD.md',
     ] as const;
     ```

   - Mengecek `git ls-files -z -- ...SIGMA_GITIGNORE_TARGET_PATHS`.

   - Jika ada file dari daftar di atas yang terlanjur ter-commit di indeks Git, jalankan:

     ```bash
     git rm -r --cached --quiet --ignore-unmatch -- <tracked_paths>
     ```

   - File fisik di disk lokal tetap utuh 100%, sedangkan di Git file-file tersebut langsung berstatus *deleted from index* (untuk 1 kali commit pembersihan) dan selanjutnya diabaikan penuh oleh `.gitignore`.

---

### 3.3 Pengaturan di `sigma config` (Activate / Deactivate, Default `ON`)

1. **Penyimpanan di `Sigma/project.config.json` & `.sigma-identity.json`:**
   - Di `src/engine/projectConfig.ts`:

     ```ts
     export interface GitProjectConfig {
       gitignore_sigma: boolean; // default: true (ON)
     }
     ```
2. **Perintah CLI (`src/commands/config.ts`):**
   - `sigma config set gitignore on` (alias: `activate`, `true`, `1`):
     - Mengatur `git.gitignore_sigma = true` di `Sigma/project.config.json` dan `.sigma-identity.json`.
     - Menulis blok `# >>> sigma-managed >>>` ke `.gitignore`.
     - Menjalankan `untrackSigmaFilesFromGitIndex(projectRoot)` (`git rm -r --cached`) untuk membersihkan indeks Git tanpa menghapus file lokal.
   - `sigma config set gitignore off` (alias: `deactivate`, `false`, `0`):
     - Mengatur `git.gitignore_sigma = false` di `Sigma/project.config.json` dan `.sigma-identity.json`.
     - Menghapus blok `# >>> sigma-managed >>>` dari `.gitignore` sehingga seluruh file Sigma kembali dapat di-commit dan di-push ke Git (misalnya saat ingin memindahkan pekerjaan Sigma ke mesin lain).
   - `sigma config show`:
     - Menampilkan baris `Sigma Gitignore Mode: ON (active — only .sigma-identity.json tracked in Git)` atau `OFF (inactive — Sigma files can be tracked in Git)`.

---

### 3.4 Redesign Fitur Internal Pendukung

1. **Redesign F05 (`sigma intent baseline` & `sigma intent amendment` — `src/engine/intentGit.ts`):**
   - Menyimpan snapshot baseline dan amandemen `INTENT` secara lokal di `Sigma/revisions/INTENT-v<N>/` (`base.md`, `amd-<NNN>.md`, `ledger.json`) dan menghapus kewajiban `git.isTracked()` sehingga `sigma intent baseline` dan `sigma intent amendment` berjalan mulus meskipun `Sigma/` berada di dalam `.gitignore`.
2. **Pemurnian `.sigma-identity.json` (`src/services/assetConsistency.ts`, `src/commands/project.ts`):**
   - Memindahkan field volatil `sigma_applied` (`sigma_version`, `assets_hash`, `synced_at`) dan `logs_created_at` dari `.sigma-identity.json` ke dalam `Sigma/activate_status.json` (dengan fallback baca untuk proyek lama), sehingga `.sigma-identity.json` tidak pernah berubah akibat `sigma project sync` atau reset log.
3. **Perbaikan `.sigma-workspace.json` Saat Mode DEV Workspace Aktif:**
   - Apabila pengguna menyalakan `sigma dev create-workspace`, selain menulis `/dev/.sigma-workspace.json` (yang di-gitignore) dan mencatat `dev_workspace` di `.sigma-identity.json`, jika di kemudian hari pengguna memindahkan proyek ke mesin lain atau `/dev/.sigma-workspace.json` belum ada di mesin tujuan setelah `git pull`, Sigma otomatis memastikan `/dev/.sigma-workspace.json` tersedia berdasarkan record `dev_workspace` di `.sigma-identity.json`.
4. **Normalisasi Hash Lintas-OS (`lfSha256`) & Auto-Refresh Path `.mcp.json`:**
   - Memastikan ketika pengguna mematikan gitignore (`sigma config set gitignore off`), melakukan push, dan melakukan pull di mesin lain, perbedaan line-ending (`CRLF` vs `LF`) atau path direktori lokal tidak merusak sertifikasi hash Sigma maupun `.mcp.json`.

---

## 4. Ringkasan Work Packages Implementasi

1. **WP-1 (`src/engine/projectConfig.ts`, `src/commands/config.ts`, `src/services/assetConsistency.ts`, `src/commands/project.ts`):**
   - Skema `git.gitignore_sigma` (default `true`), perintah `sigma config set gitignore <on|off|activate|deactivate>`, tampilan `sigma config show`, serta relokasi `sigma_applied` & `logs_created_at` ke `Sigma/activate_status.json`.
2. **WP-2 (`src/utils/gitignore.ts`, `src/commands/project.ts`, `src/commands/git.ts`):**
   - Pengelolaan blok `# >>> sigma-managed >>>` di `.gitignore` (sesuai Tabel 2.1, melindungi `/dev/` dan hanya meng-ignore `/dev/.sigma-workspace.json` serta `/dev/CHANGE-RECORD.md`) dan pembersihan indeks Git non-destruktif `untrackSigmaFilesFromGitIndex()` (`git rm -r --cached`).
3. **WP-3 (`src/utils/fs.ts`, `src/cli.ts`, `src/commands/project.ts`, `src/mcp/binding.ts`):**
   - Implementasi guardrail `'IDENTITY_ONLY_MISSING_SIGMA'` yang memblokir seluruh operasi CLI dan MCP Sigma (termasuk `project start/register/sync`) dengan pesan Bahasa Inggris ketika `.sigma-identity.json` ditemukan tetapi folder `Sigma/` tidak ada.
4. **WP-4 (`src/engine/intentGit.ts`, `src/services/intentRatifyService.ts`, `src/services/intentBaselineService.ts`, `src/services/intentAmendmentService.ts`):**
   - Redesign F05 menggunakan snapshot lokal `Sigma/revisions/INTENT-v<N>/` tanpa menuntut `INTENT-vN.md` dilacak oleh Git.
5. **WP-5 (`src/utils/hash.ts`, `src/engine/chain.ts`, `src/engine/revisions.ts`, `src/services/assetConsistency.ts`, `src/mcp/artifactPath.ts`, `src/utils/mcpConfig.ts`, `src/engine/devWorkspace.ts`):**
   - Standarisasi hash `lfSha256` lintas-OS, auto-refresh path `.mcp.json`, dan auto-rebuild marker `/dev/.sigma-workspace.json` jika folder `dev/` ditarik ke mesin lain saat mode `gitignore off`.
6. **WP-6 (`test/*.test.ts`, `Sigma/SIGMA-OPERATION-REGISTRY.json`, `setup/SIGMA-OPERATION-REGISTRY.json`):**
   - Pengujian otomatis untuk:
     - **Zero Local File Deletion** saat `gitignore on` & `git rm --cached` dijalankan.
     - **Perlindungan Folder `/dev/`**: Memastikan file kode produk di dalam `dev/` (mis. `dev/src/index.ts`) **tidak** ter-ignore oleh Git dan **tidak** terkena `git rm --cached`, sedangkan `dev/.sigma-workspace.json` dan `dev/CHANGE-RECORD.md` ter-ignore.
     - **Hard Block (English Message)** di mesin kedua saat hanya `.sigma-identity.json` yang ada.
     - **Siklus `sigma config set gitignore off` -> push -> pull di mesin kedua -> operasi Sigma berjalan normal.**
