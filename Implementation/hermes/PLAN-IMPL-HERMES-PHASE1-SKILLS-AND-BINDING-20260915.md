# PLAN-IMPL — Hermes Phase 1: Skills + Project Binding

**Sumber**: Sesi Professional Mode 2026-09-15 (Director + Claude), lanjutan dari `2026-09-15_proposal-hermes-sigma-integration-setup-guide.md` (Discussion, dikoreksi 2026-09-15) dan `2026-09-12_design-hermes-sigma-project-scoped-governance.md` §3.
**Tanggal**: 2026-09-15
**Status**: **DRAFT — menunggu review Director. Belum ada eksekusi apa pun.** Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma. Prasyarat: `PLAN-IMPL-HERMES-PHASE0-MCP-ORIENTATION-20260915.md` selesai (nama tool MCP sebenarnya sudah terkonfirmasi).
**Cakupan perubahan kode Sigma**: **Ya** — lihat §4. Ini kontras dengan draf awal guide yang sempat menyebut "tidak ada kode baru" (sudah dikoreksi di Discussion doc).

---

## 1. Masalah yang diselesaikan

Hermes belum punya skill perilaku Sigma (ARC/FMN/DEV/AUD) di profile-nya — inilah sebab guide setup yang dibuat Hermes kemarin akurat di level konsep tapi salah di banyak detail operasional (npm install, daftar tool MCP, skema skill): Hermes menjawab dari pengetahuan umum, bukan dari konteks proyek yang benar-benar dimuat. Fase 1 menutup celah itu dengan:

1. Skill behaviour-only (M1) untuk ARC/FMN/DEV/AUD yang Hermes bisa muat, dengan sumber kebenaran yang sama seperti target lain (`setup/targets/`).
2. Mekanisme binding tiga lapis (deteksi → verifikasi → capability) sesuai `2026-09-12_design-hermes-sigma-project-scoped-governance.md` §3, supaya `cwd` semata tidak pernah cukup mengaktifkan governance Sigma.

## 2. Prinsip kunci (dari dokumen desain, dikonfirmasi ulang)

> Skill Hermes memuat *behaviour*, bukan *authority*. `sigma intent ratify`, `sigma plan lock`, `sigma close lock`, dll. tidak pernah dijalankan otonom oleh skill — hanya memandu *bagaimana* AI role bekerja begitu Director memberi mandat.

> `cwd` boleh memicu **deteksi** (read-only, aman). **Binding** (aktivasi capability) selalu perlu verifikasi eksplisit lewat `sigma session bootstrap` + `.sigma-identity.json`. Tidak ada auto-bind dari nama folder atau memory Hermes.

## 3. Temuan tambahan (ditemukan saat menyusun plan ini, di luar cakupan koreksi guide 2026-09-15)

**Bridge file existing (`AGENTS.md`) tidak netral — isinya Codex-branded.** `setup/targets/bridge/AGENTS.md` sudah ada dan otomatis ditulis ke root proyek saat `sigma project start` (lihat `BRIDGE_STUBS` di `src/config.ts:44` dan `src/commands/project.ts:410-412`). Tapi frontmatter-nya `name: CODEX-RULES`, isinya eksplisit "System-level constraints for Codex operating...". Guide kemarin (§6.2) mengusulkan "gunakan AGENTS.md yang portabel" — itu keliru diasumsikan netral. Pola yang sudah dipakai Sigma untuk tool lain adalah **satu file bridge per tool** (`CLAUDE.md`, `GEMINI.md`, `DEEPSEEK.md`, `REASONIX.md`), bukan satu `AGENTS.md` yang dipakai bersama. Rekomendasi: ikuti pola yang sudah ada — buat `HERMES.md` sebagai bridge stub baru, bukan menumpangi `AGENTS.md`.

**`.sigma-identity.json` dan `sigma project register`/`start` — klaim guide §6.3 terkonfirmasi akurat**, tidak perlu koreksi. File ini memang sudah ditulis oleh `project start` (`src/commands/project.ts:370-373`) dan bisa diregenerasi lewat `sigma project register`.

## 4. Cakupan Teknis

### 4.1 Yang berubah

| Berkas | Perubahan |
| :--- | :--- |
| `src/config.ts:44` | `BRIDGE_STUBS` — tambah `'HERMES.md'`. |
| `setup/targets/bridge/HERMES.md` | **Berkas baru.** Isi setara `AGENTS.md`/`CODEX-RULES` tapi ditulis untuk Hermes: model operasi (skill behaviour-only, MCP read-only, binding wajib sebelum aksi governance), bukan salinan mentah `CODEX-RULES`. |
| `src/commands/setup.ts` — `ROLE_FILES` | Tambah entri `hermes: { arc: ..., fmn: ..., dev: ..., aud: ..., report: ..., sigmaTest: ..., humanize: ..., writeMemo: ..., readMemo: ... }` — format nilai (flat file vs direktori) mengikuti hasil §4.3. |
| `src/commands/setup.ts` — `PLATFORM_LABELS` | Tambah `hermes: 'Hermes  (~/.hermes-equivalent/skills/)'` — path sebenarnya diverifikasi dulu (lihat §4.2). |
| `src/commands/setup.ts` — `PLATFORM_SOURCE_DIR` | Tambah `hermes: 'hermes'`. |
| `src/commands/setup.ts` — `targetDirMap` di `deploySkillsAndHook()` | Tambah `hermes: paths.hermesSkills`. |
| `src/commands/setup.ts` — `targetDirMap` di `runUninstall()` | Tambah entri yang sama — dua map ini terpisah di source saat ini (`deploySkillsAndHook` dan `runUninstall` masing-masing punya literal sendiri), keduanya harus konsisten atau uninstall tidak akan membersihkan skill Hermes. |
| `src/utils/detect.ts` — `DetectedTools` interface | Tambah `hermes: boolean`. |
| `src/utils/detect.ts` — `ToolTargetPaths` interface + `targetPaths()` | Tambah `hermesSkills: string` — path sebenarnya menunggu hasil verifikasi §4.2 (bukan diasumsikan `~/.hermes/skills`, karena instalasi Windows kita sendiri memakai `%LOCALAPPDATA%\hermes\skills`, bukan `~/.hermes`). |
| `src/utils/detect.ts` — `detectTools()` | Tambah `hermes: fs.existsSync(t.hermesSkills)`. |
| `setup/targets/hermes/{sigma-arc,sigma-fmn,sigma-dev,sigma-aud,sigma-report}/SKILL.md` | **Berkas baru.** Frontmatter **hanya** `name:` + `description:` (pola Codex yang sudah ada dan terbukti, bukan `version:`/`metadata.hermes.tags:` yang belum diverifikasi — lihat guide §5.2 koreksi 2026-09-15) sampai Phase 0 mengonfirmasi Hermes menerima/mengabaikan field tambahan. |

### 4.2 Prasyarat verifikasi sebelum menulis kode (bukan diasumsikan)

Path skill Hermes yang sebenarnya di instalasi Windows kita: `%LOCALAPPDATA%\hermes\skills\` (dikonfirmasi langsung 2026-09-15 saat audit instalasi desktop). **Belum diverifikasi**: apakah ini path yang sama secara lintas-platform (macOS/Linux `~/.hermes/skills` atau `~/Library/Application Support/hermes/skills`?), dan apakah Hermes menyediakan env var resmi (mis. `HERMES_HOME`) yang bisa dibaca lintas OS alih-alih hardcode path per-platform seperti target lain. **Item kerja sebelum coding**: cek `hermes config path` / `hermes doctor` di profile yang dipakai untuk memastikan path skill yang benar, dan cek apakah ada `HERMES_HOME` env var yang bisa dipakai (pola lebih tahan lintas-OS daripada hardcode `os.homedir()` + segmen path seperti target lain).

### 4.3 Format skill — direktori vs file flat (perlu keputusan sebelum coding)

`ROLE_FILES` punya dua pola berbeda: Codex pakai direktori (`arc/SKILL.md`), Claude Code/Reasonix pakai file flat (`arc.md`). Belum diverifikasi mana yang didukung/direkomendasikan Hermes untuk skill progressive-load. Keputusan ini menentukan apakah `sourceDir`/`targetDir` copy logic di `deploySkillsAndHook()` perlu jalur baru atau bisa reuse pola Codex apa adanya.

### 4.4 Yang TIDAK berubah / TIDAK dilakukan di fase ini

- Tidak ada perubahan pada `src/mcp/*` — MCP tool sudah cukup dari Phase 0.
- Tidak ada mekanisme approval queue/evidence engine baru (itu scope Blueprint terpisah, bukan bagian integrasi ini).
- Tidak ada perubahan pada `sigma project start` untuk menulis file konteks Hermes secara otomatis — di Phase 1 ini, penulisan `HERMES.md` ke proyek lab dilakukan manual/terverifikasi dulu; otomatisasi penuh via `BRIDGE_STUBS` baru dianggap selesai setelah §4.1 diimplementasikan dan diuji, bukan sebelum.
- Tidak ada capability tulis apa pun diberikan ke skill Hermes — role rule tetap menegaskan "recommend, not execute" untuk command approval-class (pola yang sama seperti `CODEX-RULES` §Director Authorization Language).

## 5. Isi `HERMES.md` (bridge stub baru) — rangkuman

Mengikuti struktur `AGENTS.md`/`CODEX-RULES` yang sudah ada, dengan penyesuaian khusus Hermes:

- Operational Modes (Professional/ARC/FMN/DEV/AUD) — identik prinsipnya.
- **MCP Orientation Layer** — daftar tool diperbarui ke **enam** tool nyata (`sigma_get_state`, `sigma_get_orientation`, `sigma_get_gates`, `sigma_list_artifacts`, `sigma_doctor`, `sigma_get_memory`) dengan nama tool ter-prefix **hasil verifikasi Phase 0** (bukan diasumsikan `mcp_sigma_*`).
- **Binding requirement** (bagian baru, tidak ada di `CODEX-RULES` karena Codex tidak punya isu auto-load-by-cwd yang sama) — instruksi eksplisit: sebelum aksi governance apa pun, verifikasi `.sigma-identity.json` + `sigma session bootstrap`, jangan asumsikan proyek dari nama folder atau memory Hermes.
- Director Authorization Language — identik.
- CLI-Managed Files — Do Not Edit Directly — identik.

## 6. Test / verifikasi yang perlu ditambah

`test/setup-hermes-target.test.ts` (baru):

1. `sigma setup install` mendeteksi keberadaan direktori skill Hermes dan menawarkannya sebagai pilihan platform (checkbox), konsisten dengan platform lain.
2. Skill ter-deploy ke path yang benar hasil §4.2, dengan isi byte-identik dengan source `setup/targets/hermes/`.
3. `sigma setup uninstall --confirm` membersihkan skill Hermes yang ter-deploy (regresi untuk temuan `targetDirMap` ganda di §4.1).
4. `BRIDGE_STUBS` baru (`HERMES.md`) ter-copy ke `GLOBAL_BRIDGE_DIR` saat `setup install`, dan ke project root saat `project start`, sama seperti `AGENTS.md`/`CLAUDE.md` yang sudah ada.
5. Regresi: menambah `hermes` ke `ROLE_FILES`/`PLATFORM_LABELS` tidak mengubah perilaku target lain (Codex/Claude Code/Reasonix/Antigravity/Cursor) — jalankan ulang test suite existing untuk `setup.ts`.

## 7. Definition of Done

Sesuai guide §8 baris Fase 1:

- [ ] ARC (via skill Hermes) menghasilkan draft `DIR-INTENT` yang masuk akal.
- [ ] `sigma plan new` **ditolak** oleh CLI sebelum intent di-ratify — membuktikan skill tidak membawa otoritas, hanya behaviour.
- [ ] Role immutability terjaga (skill tidak mencoba berpindah role dalam satu sesi, sesuai instruksi di `HERMES.md`).
- [ ] `sigma setup uninstall --confirm` membersihkan seluruh jejak skill Hermes tanpa sisa.

## 8. Keputusan Director yang masih terbuka sebelum coding dimulai

1. Setuju pendekatan `HERMES.md` sebagai bridge stub baru (bukan menumpangi `AGENTS.md`)?
2. Path skill Hermes lintas-platform — cukup verifikasi Windows dulu (`%LOCALAPPDATA%\hermes\skills`), atau perlu riset cross-platform sebelum coding?
3. Format skill — direktori (`arc/SKILL.md`, pola Codex) atau file flat (`arc.md`, pola Claude Code/Reasonix)? Menunggu hasil §4.3.
4. Proyek lab mana yang dipakai untuk uji end-to-end §7 (sama dengan keputusan Phase 0, atau proyek terpisah)?
