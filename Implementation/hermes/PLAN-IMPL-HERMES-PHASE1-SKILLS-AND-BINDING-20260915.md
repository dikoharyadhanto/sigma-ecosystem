# PLAN-IMPL — Hermes Phase 1: Skills + Project Binding

**Sumber**: Sesi Professional Mode 2026-09-15 (Director + Claude), lanjutan dari `2026-09-15_proposal-hermes-sigma-integration-setup-guide.md` (Discussion, dikoreksi 2026-09-15) dan `2026-09-12_design-hermes-sigma-project-scoped-governance.md` §3.
**Tanggal**: 2026-09-15
**Status**: **DRAFT — keputusan Director atas §8 sudah dikonfirmasi 2026-09-15 (mengikuti rekomendasi review Claude). Belum ada eksekusi Phase 1** (penulisan kode/skill belum dimulai; update ini murni penyelarasan dokumen sebelum coding). Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma. Prasyarat Phase 0 sudah terpenuhi pada 2026-09-15; lihat `RESULT-HERMES-PHASE0-MCP-ORIENTATION-20260915.md`.
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

Path skill Hermes yang sebenarnya di instalasi Windows kita: `%LOCALAPPDATA%\hermes\skills\` (dikonfirmasi langsung 2026-09-15 saat audit instalasi desktop).

**Keputusan Director (2026-09-15, §8.2)**: cakupan verifikasi path Phase 1 dibatasi ke Windows saja. Riset path macOS/Linux (`~/.hermes/skills` atau `~/Library/Application Support/hermes/skills`?) **ditunda** ke fase saat platform tersebut benar-benar digunakan — bukan prasyarat coding Phase 1.

**Tetap wajib sebagai item kerja sebelum coding** (tidak berubah oleh keputusan di atas): cek `hermes config path` / `hermes doctor` di profile yang dipakai untuk memastikan path skill Windows yang dipakai kode benar, dan cek apakah ada env var resmi `HERMES_HOME` yang bisa dibaca alih-alih hardcode `os.homedir()` + segmen path seperti target lain di `detect.ts`. Env var lebih tahan lintas-OS bila tersedia, dan pengecekan ini murah dilakukan sekarang meskipun cakupan lintas-platform ditunda.

### 4.3 Format skill — direktori vs file flat (keputusan terkunci)

`ROLE_FILES` punya dua pola berbeda: Codex pakai direktori (`arc/SKILL.md`), Claude Code/Reasonix pakai file flat (`arc.md`).

**Keputusan Director (2026-09-15, §8.3)**: pola direktori (`arc/SKILL.md`, mengikuti Codex) dipilih untuk `setup/targets/hermes/`. Tetap wajib diverifikasi terhadap dokumentasi/`hermes doctor` sebelum final, sebagai bagian dari item kerja §4.2.

**Klarifikasi cakupan coding**: keputusan ini **tidak** menambah pekerjaan implementasi. `deploySkillsAndHook()` (`src/commands/setup.ts:236-257`) sudah generik — memakai `fs.copySync` dan mengecek konflik tipe (`isDirectory()`) sebelum overwrite, sudah menangani direktori (Codex, Antigravity) maupun file flat (Claude Code, Reasonix) tanpa cabang kode terpisah. Menambahkan `hermes` ke `PLATFORM_SOURCE_DIR`/`ROLE_FILES` dengan pola direktori otomatis reuse jalur yang sama; tidak perlu jalur copy baru.

### 4.4 Yang TIDAK berubah / TIDAK dilakukan di fase ini

- Tidak ada perubahan pada `src/mcp/*` **di dalam scope Phase 1 ini** — enam tool Phase 0 cukup untuk eksperimen behaviour/skill satu proyek. Hardening binding, kontrak query, dan command plane direncanakan dalam plan platform consumer-neutral `../sigma-mcp/PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md`; Gate 0.5-nya wajib sebelum gateway diberi capability Sigma, multi-project routing, atau capability write yang lebih luas.
- Tidak ada mekanisme approval queue/evidence engine baru (itu scope Blueprint terpisah, bukan bagian integrasi ini).
- Tidak ada perubahan pada `sigma project start` untuk menulis file konteks Hermes secara otomatis — di Phase 1 ini, penulisan `HERMES.md` ke proyek lab dilakukan manual/terverifikasi dulu; otomatisasi penuh via `BRIDGE_STUBS` baru dianggap selesai setelah §4.1 diimplementasikan dan diuji, bukan sebelum.
- Tidak ada capability tulis apa pun diberikan ke skill Hermes — role rule tetap menegaskan "recommend, not execute" untuk command approval-class (pola yang sama seperti `CODEX-RULES` §Director Authorization Language).
- **Pemisahan profile produksi Sigma** (profile terpisah dari `default` dengan `HERMES_HOME` + credential set sendiri, di luar `sigma-lab` yang sudah dipakai Phase 0) — **eksplisit ditunda ke Phase 2** (keputusan Director 2026-09-15, menyelesaikan pertanyaan terbuka Discussion `2026-09-15_proposal-hermes-sigma-integration-setup-guide.md` §16 poin 3). Phase 1 hanya menambah skill + bridge stub; tidak menyentuh topologi profile/credential produksi.

## 5. Isi `HERMES.md` (bridge stub baru) — rangkuman

Mengikuti struktur `AGENTS.md`/`CODEX-RULES` yang sudah ada, dengan penyesuaian khusus Hermes:

- Operational Modes (Professional/ARC/FMN/DEV/AUD) — identik prinsipnya.
- **MCP Orientation Layer** — daftar tool diperbarui ke **enam** tool nyata (`sigma_get_state`, `sigma_get_orientation`, `sigma_get_gates`, `sigma_list_artifacts`, `sigma_doctor`, `sigma_get_memory`). Hasil Phase 0: selector administratif memakai `sigma:<tool>` dan nama model-facing memakai `mcp__sigma__<tool>`; jangan gunakan asumsi lama `mcp_sigma_*`.
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
6. **Precedence skill bawaan Hermes** — RESULT Phase 0 §5 caveat 3 mencatat `hermes profile create --no-skills` tetap menghasilkan satu skill bawaan `autonomous-ai-agents/hermes-agent` meski marker `.no-bundled-skills` ada, dan menandai ini "perlu diperhitungkan pada Phase 1". Tambahkan uji manual/otomatis: dengan skill `sigma-arc/fmn/dev/aud/report` ter-deploy berdampingan dengan skill bawaan tersebut, konfirmasi tidak ada konflik aktivasi/precedence — sesi ARC (via skill Sigma) tetap menghasilkan behaviour ARC yang benar, bukan tercampur/tertimpa oleh skill bawaan Hermes.

## 7. Definition of Done

Sesuai guide §8 baris Fase 1:

- [ ] ARC (via skill Hermes) menghasilkan draft `DIR-INTENT` yang masuk akal.
- [ ] `sigma plan new` **ditolak** oleh CLI sebelum intent di-ratify — membuktikan skill tidak membawa otoritas, hanya behaviour.
- [ ] Role immutability terjaga (skill tidak mencoba berpindah role dalam satu sesi, sesuai instruksi di `HERMES.md`).
- [ ] `sigma setup uninstall --confirm` membersihkan seluruh jejak skill Hermes tanpa sisa.
- [ ] Skill bawaan `autonomous-ai-agents/hermes-agent` (RESULT Phase 0 §5 caveat 3) terbukti tidak berkonflik precedence dengan skill `sigma-arc/fmn/dev/aud` yang baru — lihat §6 item 6.

## 8. Keputusan Director (dikonfirmasi 2026-09-15)

Diputuskan berdasarkan review Claude atas RESULT Phase 0 dan draf plan ini; Director mengikuti seluruh rekomendasi tanpa perubahan. Belum ada eksekusi kode — keputusan ini mengunci arah, bukan mengesahkan mulainya coding (lihat baris Status di atas).

1. **Bridge stub**: `HERMES.md` baru, bukan menumpangi `AGENTS.md` — disetujui. Lihat §3, §4.1.
2. **Cakupan path lintas-platform**: verifikasi Windows saja untuk Phase 1; riset macOS/Linux ditunda. `HERMES_HOME` env var tetap dicek sebagai item kerja sekarang. Lihat §4.2.
3. **Format skill**: direktori (`arc/SKILL.md`, pola Codex). Tidak menambah cakupan coding — lihat klarifikasi di §4.3.
4. **Proyek lab uji end-to-end §7**: sama dengan Phase 0 — `HERMESLAB` (`C:\Users\dikoh\AppData\Local\hermes\labs\sigma-phase0`), untuk kontinuitas evidence (chain `v1` yang sudah ada).
5. **(Tambahan hasil review)** Precedence skill bawaan Hermes (`autonomous-ai-agents/hermes-agent`) ditambahkan ke cakupan test/DoD Phase 1 — lihat §6 item 6, §7.
6. **(Tambahan hasil review)** Pemisahan profile produksi + `HERMES_HOME`/credential terpisah — eksplisit ditunda ke Phase 2, bukan bagian Phase 1 — lihat §4.4.
