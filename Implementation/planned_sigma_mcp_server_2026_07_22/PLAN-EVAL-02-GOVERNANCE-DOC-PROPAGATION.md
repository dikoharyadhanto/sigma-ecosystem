# PLAN-EVAL-02 — Propagasi Dokumentasi Governance untuk `sigma-mcp`

**Sumber**: Sesi Professional Mode 2026-07-22 — audit lanjutan setelah `npm
test` penuh (227/227) dikonfirmasi lulus dan PLAN-IMPL-01 §7 dinyatakan
selesai; Director meminta cek artifak governance mana yang perlu diupdate
sekarang `sigma-mcp` resmi dipakai.
**Tanggal**: 2026-07-22
**Status**: **SELESAI DIEKSEKUSI 2026-07-22.** Seluruh 6 stage diimplementasikan
di sesi yang sama dengan keputusan Director, `npm test` 227/227 lulus tanpa
modifikasi. Lihat "Draft Acceptance Criteria" untuk verifikasi per item dan
"Catatan Eksekusi" untuk temuan tambahan yang muncul saat implementasi Stage 6.
**Catatan**: Disusun Professional Mode. Bukan FMN-PLAN Sigma; tidak punya
otoritas lock/gate Sigma.
**Menindaklanjuti**: `PLAN-EVAL-01-NATIVE-MCP-SERVER-READ-ONLY.md` §Di luar
scope butir "Integrasi setup/config generator untuk VS Code/Reasonix/Gemini
(Milestone C)" — plan itu sudah mengantisipasi bahwa propagasi ke lapisan
dokumentasi/config adalah increment terpisah, bukan bagian dari build server.

---

## Inti

`sigma-mcp` sudah live: server stdio start, 5 tool inti terdaftar
(`sigma_get_state`, `sigma_get_gates`, `sigma_get_orientation`,
`sigma_list_artifacts`, `sigma_doctor`), seluruh suite `npm test` (27 file,
227 test) lulus tanpa modifikasi. Satu-satunya checklist PLAN-IMPL-01 §7 yang
tersisa — "Suite `npm test` penuh lulus" — sudah tercentang.

Yang **belum** ikut berubah: seluruh lapisan governance yang mengajarkan AI
role bagaimana cara beroperasi di dalam Sigma. Audit hari ini menyisir Sigma
Protocol, Sigma Constitution, keempat role rule (`ARC/FMN/DEV/AUD-RULE.md`),
lima file bridge (`CLAUDE.md`/`GEMINI.md`/`AGENTS.md`/`DEEPSEEK.md`/
`REASONIX.md`), skill role per platform, template artifak, dan `README.md`.
Hasilnya: **nol mention MCP** di hampir semua artifak itu — kecuali dua
deskripsi skill `sigma-test` yang sudah menjanjikan cek MCP padahal belum
diimplementasikan.

---

## Problem Statement

MCP adalah kanal orientasi read-only baru yang paralel dengan CLI, tapi tidak
ada dokumen governance yang menyebutkan keberadaannya. Ini menciptakan tiga
kelas masalah:

1. **Celah disiplin peran (paling berisiko).** `AUD-RULE.md` melarang AUD
   "run CLI commands, inspect `progress-v<N>.json`, ... atau explore
   repository tanpa otorisasi Director" — tapi redaksi itu ditulis di sekitar
   *eksekusi CLI dan pembacaan file*, bukan *pemanggilan MCP tool*. Kalau
   client AI Director punya `sigma-mcp` terpasang, AUD bisa memanggil
   `sigma_get_state`/`sigma_get_orientation` untuk mengintip state proyek
   **tanpa melanggar redaksi rule saat ini**, karena MCP tool secara harfiah
   bukan "CLI command".
2. **Deskripsi mendahului implementasi.** `setup/targets/antigravity/sigma-test/plugin.json`
   dan `setup/targets/codex/sigma-test/agents/openai.yaml` sudah menulis
   "read-only check of CLI, **MCP**, memory, skills" — tapi tidak ada satu pun
   varian `sigma-test` (termasuk `claude_code/sigma-test.md` yang dipakai di
   sesi ini) yang benar-benar punya langkah cek MCP di badan skill-nya.
   Deskripsi antar platform pun tidak konsisten satu sama lain.
3. **Nol onboarding.** `README.md` tidak menyebut `sigma-mcp` sama sekali
   walau `package.json` sudah punya bin entry-nya. `sigma setup install` dan
   `sigma project start` tidak menulis konfigurasi MCP apa pun ke proyek/AI
   client (dikonfirmasi lewat test `"project start seeds role-memory files
   and does not write any MCP config"`). Pengguna harus tahu sendiri untuk
   mendaftarkan `sigma-mcp` secara manual.

---

## Prinsip Desain (batasan plan ini)

| Prinsip | Batasan konkret |
|---|---|
| MCP tetap lapisan read-only aditif | Dokumentasi tidak boleh menyiratkan MCP menggantikan otoritas CLI untuk write/gate/lock — konsisten dengan prinsip PLAN-EVAL-01 "CLI tetap otoritas". |
| Minimal-diff pada bridge templates | 5 file bridge nyaris identik (beda hanya judul/frontmatter). Redaksi baru ditulis sekali, diterapkan sama persis ke lima-limanya. Jangan biarkan kontennya mulai divergen antar platform. |
| AUD tetap paling ketat | Redaksi baru untuk AUD-RULE harus eksplisit melarang pemanggilan MCP tool tanpa otorisasi, setara kekuatan larangan CLI yang sudah ada — bukan sekadar catatan longgar. |
| Tidak menjanjikan lebih dari yang ada | Dokumentasi hanya boleh mendeskripsikan 5 tool yang benar-benar berjalan hari ini. Jangan menyebut tool Layer 2/3 (`sigma_read_artifact`, guidance, mutation) yang belum dibangun. |
| Housekeeping, bukan redesign | Ini perubahan redaksional pada dokumen yang sudah ada, bukan penulisan ulang struktur rule/bridge/skill. |

---

## Temuan Audit (dasar plan ini)

Diverifikasi langsung terhadap isi file saat audit 2026-07-22, bukan diasumsikan:

| Kategori | Path kanonik (sumber `sigma setup install`) | Temuan |
|---|---|---|
| Protokol/Konstitusi | `Sigma/SIGMA_PROTOCOL.md`, `Sigma/SIGMA_CONSTITUTION.md` | Nol mention MCP. |
| Role rules | `Sigma/rules/{ARC,FMN,DEV,AUD}-RULE.md` | Nol mention MCP. `AUD-RULE.md` baris 817, 906, 970-996, 1012, 1035 melarang scan/inspect berbasis CLI+file, tidak menyebut MCP tool. |
| Role skills | `setup/targets/{claude_code,antigravity,codex,reasonix}/*` | Nol mention MCP di badan skill `arc/fmn/dev/aud/report`. `sigma-test`: deskripsi antigravity (`plugin.json`) & codex (`agents/openai.yaml`) sudah sebut "CLI, MCP, memory, skills"; deskripsi claude_code & reasonix masih "CLI, skills" saja. Tidak ada implementasi cek MCP di badan skill manapun. |
| Bridge files | `setup/targets/bridge/{CLAUDE,GEMINI,AGENTS,DEEPSEEK,REASONIX}.md` | Nol mention MCP di kelima file (nyaris identik satu sama lain). Section "CLI Operator Model" menyajikan CLI sebagai satu-satunya kanal orientasi. |
| Template artifak | `Sigma/templates/*.md` | Nol mention — memang tidak relevan (template isi artifak, bukan dokumen proses). |
| README | `README.md` | Nol mention `sigma-mcp` walau `package.json` `"bin"` sudah mendaftarkannya. |
| Instalasi/wiring | `src/commands/setup.ts`, `src/commands/project.ts` (start/sync) | Tidak menulis config MCP apa pun ke proyek/client — dikonfirmasi test `role-memory-bootstrap.test.ts` ("project start ... does not write any MCP config"). |
| Temuan sampingan (bukan soal MCP) | `CLAUDE.md` (root repo ini) vs `setup/targets/bridge/CLAUDE.md` | Root sudah drift dari template bridge terbaru: masih `Sigma/progress.json` (singular, pra-multichain) dan belum punya section "Inter-Role Context Handoff". |

---

## Scope

### Dalam scope

- **Stage 1** — `Sigma/rules/AUD-RULE.md`: perluas larangan "run CLI
  commands / inspect state / explore repository tanpa otorisasi Director"
  agar eksplisit mencakup pemanggilan MCP tool apa pun (`sigma_get_state`,
  `sigma_get_gates`, `sigma_get_orientation`, `sigma_list_artifacts`,
  `sigma_doctor`).
- **Stage 2** — `Sigma/rules/{ARC,FMN,DEV}-RULE.md` (lebih ringan): sebutkan
  MCP sebagai kanal orientasi read-only yang setara `sigma session
  bootstrap`/`sigma {domain} check`, tanpa mengubah otoritas lock/gate mana
  pun.
- **Stage 3** — Kelima `setup/targets/bridge/*.md`: tambah satu subsection
  singkat (redaksi identik di kelima file) yang menjelaskan MCP tersedia
  untuk orientasi read-only; CLI tetap satu-satunya otoritas write/gate/lock.
- **Stage 4** — `sigma-test`, opsi (a) dipilih Director: turunkan janji
  deskripsi di `setup/targets/antigravity/sigma-test/plugin.json` dan
  `setup/targets/codex/sigma-test/agents/openai.yaml` dari "CLI, MCP, memory,
  skills" jadi selaras dengan `claude_code`/`reasonix` ("CLI, skills"). Murni
  redaksi field `description` — nol perubahan badan skill, nol logika baru.
- **Stage 5** — Tambah section MCP ke `README.md`: cara install, cara
  daftarkan ke AI client, daftar 5 tool + kegunaan singkat. Director memutuskan
  cakupan mencakup **semua platform** (Claude Code, Cursor, Codex,
  Antigravity, Reasonix), bukan Claude Code saja — masing-masing butuh contoh
  format registrasi client sendiri.
- **Stage 6** — Sinkronkan **seluruh 5 file bridge root** proyek ini
  (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `DEEPSEEK.md`, `REASONIX.md`) ke
  template terbaru, bukan cuma `CLAUDE.md`. Director memutuskan ini masuk
  scope plan ini.

### Di luar scope

- Menulis config `.mcp.json` (atau setara) secara otomatis dari
  `sigma setup install` / `sigma project start` — **keputusan Director:
  ditangani terpisah di `PLAN-EVAL-03-MCP-SETUP-INSTALLATION-WIRING.md`**,
  bukan digabung ke plan ini, karena profil risikonya beda (perubahan kode
  instalasi vs perubahan redaksional dokumen).
- `Sigma/SIGMA_PROTOCOL.md` / `SIGMA_CONSTITUTION.md` — didiamkan kecuali
  Director eksplisit ingin MCP diakui secara formal di level
  protokol/konstitusi (keputusan besar, bukan housekeeping redaksional).
- `Sigma/templates/*.md` — tidak relevan.
- Dokumentasi tool Layer 2/3 MCP (guidance, write/mutation) — tidak ada yang
  perlu didokumentasikan karena belum dibangun (lihat PLAN-EVAL-01 §Ditunda).

---

## Task Breakdown

### Stage 1 — AUD-RULE hardening (prioritas tertinggi)

- **Keputusan Director**: redaksi larangan MCP **disatukan persis** ke
  larangan CLI yang sudah ada di `Sigma/rules/AUD-RULE.md` (baris-baris
  sekitar 817, 906, 970-996, 1012, 1035) — bukan subsection baru terpisah.
  Setiap tempat yang menyebut "run CLI commands" / "explore repository" /
  "inspect [state/file]" diperluas dalam kalimat yang sama agar juga
  mencakup "atau memanggil MCP tool apa pun (`sigma_get_state`,
  `sigma_get_gates`, `sigma_get_orientation`, `sigma_list_artifacts`,
  `sigma_doctor`)".

### Stage 2 — ARC/FMN/DEV-RULE mention (ringan)

- Satu-dua kalimat per file, bukan section baru: MCP tersedia sebagai kanal
  baca alternatif untuk orientasi.

### Stage 3 — Bridge template propagation (5 file)

- Tulis satu paragraf/subsection sekali, terapkan identik ke
  `setup/targets/bridge/{CLAUDE,GEMINI,AGENTS,DEEPSEEK,REASONIX}.md`.

### Stage 4 — Skill description reconciliation (`sigma-test`)

- **Keputusan Director**: opsi (a), minimal. Ubah field `description` di
  `setup/targets/antigravity/sigma-test/plugin.json` dan
  `setup/targets/codex/sigma-test/agents/openai.yaml` — hapus kata "MCP"
  dari deskripsi, samakan jadi "read-only check of CLI, skills, and project
  structure" (redaksi identik dengan `claude_code/sigma-test.md` dan
  `reasonix/sigma-test.md`). Tidak ada perubahan badan skill (`sigma-test`
  tetap tidak mengecek MCP apa pun — janjinya diturunkan, bukan
  diimplementasikan).

### Stage 5 — README MCP section (semua platform)

- Instalasi, pendaftaran ke client, daftar 5 tool. **Keputusan Director**:
  cakupan mencakup Claude Code, Cursor, Codex, Antigravity, dan Reasonix —
  masing-masing contoh format registrasi client sendiri, bukan cuma Claude
  Code.
- Catatan: registrasi otomatis (isi konkret `.mcp.json` per platform) baru
  benar-benar ada setelah PLAN-EVAL-03 dieksekusi. Sebelum itu, section README
  ini mendokumentasikan **cara manual** mendaftarkan `sigma-mcp`. Setelah
  PLAN-EVAL-03 selesai, bagian ini perlu direvisi supaya tidak kontradiksi
  dengan perilaku otomatis yang baru ada.

### Stage 6 — Resync 5 file bridge root (bukan cuma `CLAUDE.md`)

- **Keputusan Director**: masuk scope plan ini, diperluas ke kelima file
  root (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `DEEPSEEK.md`,
  `REASONIX.md`), bukan `CLAUDE.md` saja.
- **Temuan teknis penting saat verifikasi decision ini**: tidak ada mekanisme
  `sigma project sync` untuk file bridge — `runSync()`
  (`src/commands/project.ts:371-437`) cuma menyalin `Sigma/SIGMA_CONSTITUTION.md`,
  `Sigma/SIGMA_PROTOCOL.md`, `Sigma/rules/`, registry, dan `role-memory/`.
  Satu-satunya jalur CLI yang menyentuh file bridge root adalah
  `sigma project start --overwrite-bridge`
  (`src/commands/project.ts:286-301`), dan itu **overwrite penuh**
  (`{ overwrite: true }`) — bukan merge.
- **Risiko konkret**: diff hari ini menunjukkan kelima file root sudah
  punya konten spesifik-proyek yang tidak ada di template generik (mis.
  paragraf "This project is the sigma-cli source codebase — a
  TypeScript/Node.js npm package..."). Menjalankan
  `--overwrite-bridge` mentah-mentah akan **menghapus kustomisasi itu**,
  bukan cuma menambah bagian MCP yang baru dari Stage 3.
- **Task konkret**: resync dilakukan **manual per file** (bukan lewat
  `--overwrite-bridge`) — ambil hanya section MCP baru dari template hasil
  Stage 3 dan perbaikan `progress.json`→`progress-v<N>.json`/"Inter-Role
  Context Handoff" yang hilang, sambil mempertahankan paragraf kustomisasi
  proyek yang sudah ada di root. `REASONIX.md` juga punya command usang
  (`sigma project reset`, `sigma roadmap lock`) yang perlu disamakan ke
  template sekalian.

---

## Catatan Risiko

- **Scope creep jadi redesign.** Ada 4 rule file + 5 bridge file + 4 skill
  file + README di daftar — risiko nyata berubah dari housekeeping
  redaksional jadi rewrite section besar. Mitigasi: setiap perubahan dibatasi
  1-2 paragraf tambahan per file, bukan restrukturisasi.
- **Drift berlanjut kalau Stage 6 dilewati.** Kalau bridge template diupdate
  tapi root `CLAUDE.md` proyek ini tidak ikut di-sync, jarak driftnya makin
  lebar dari yang sudah ditemukan hari ini.
- **Metadata otoritatif tapi kosong.** Kalau Stage 4 memilih menaikkan janji
  deskripsi `sigma-test` tanpa benar-benar mengimplementasikan langkah cek
  MCP di badan skill, ini mengulang pola yang sudah diperingatkan di
  `Implementation/sigma_implementation_template_style.md` §"Warning policy
  must stay low-noise" — metadata yang terlihat otoritatif tapi tidak
  ditegakkan.

---

## Draft Acceptance Criteria

- [x] `AUD-RULE.md` eksplisit melarang pemanggilan MCP tool tanpa otorisasi
      Director, redaksi disatukan ke larangan CLI yang sudah ada (bukan
      subsection terpisah) — 7 titik diperluas: §8 (roam independen), §Role
      Activation, §External Auditor Isolation Policy (2 titik), §CLI & MCP
      Operation Policy (judul diganti + paragraf baru), §Authorized-Only
      Exception, §Exemptions (kalimat penutup).
- [x] Kelima file bridge **template** (`setup/targets/bridge/`) berisi
      paragraf/subsection identik soal MCP orientation layer.
- [x] Deskripsi `sigma-test` konsisten di keempat platform — semuanya "CLI,
      skills, and project structure" tanpa mention MCP (divergensi
      antigravity `plugin.json`/codex `agents/openai.yaml` vs
      claude_code/reasonix sudah disamakan). Badan skill tidak berubah.
- [x] `README.md` punya section MCP baru ("sigma-mcp — MCP Orientation
      Server") mencakup kelima platform: instalasi, pendaftaran manual ke
      client (konkret untuk Claude Code & Cursor; Codex/Antigravity/Reasonix
      diarahkan ke dokumentasi client masing-masing — lihat Catatan Eksekusi),
      daftar 5 tool.
- [x] Kelima file bridge **root** proyek ini disamakan ke template terbaru
      lewat merge manual (section MCP baru + perbaikan
      `progress.json`→`progress-v<N>.json`/Inter-Role Context Handoff/command
      usang) — paragraf kustomisasi proyek yang sudah ada tetap
      dipertahankan, tidak tertimpa `--overwrite-bridge` mentah.
- [x] `npm test` penuh lulus tanpa modifikasi setelah seluruh perubahan —
      27 file, 227 test, 2026-07-22.

---

## Keputusan Director Tercatat

Diputuskan Director 2026-07-22.

1. **AUD-RULE** — **disatukan persis** ke larangan CLI yang sudah ada di
   setiap tempat yang relevan, bukan subsection baru terpisah.
2. **`sigma-test`** — **opsi (a), minimal**: turunkan janji deskripsi jadi
   "CLI, skills" di semua platform. Badan skill tidak diubah; `sigma-test`
   tetap tidak mengecek MCP. Skill ini **dipertahankan** (sempat
   dipertimbangkan untuk dihapus total, tapi diputuskan tetap ada — nilainya
   sebagai satu-satunya diagnostik instalasi/deployment yang nol-state-touching,
   berbeda dari `sigma doctor`/`sigma_doctor` yang mendiagnosis state chain,
   bukan integritas deployment skill).
3. **README MCP section** — mencakup **semua platform** (Claude Code,
   Cursor, Codex, Antigravity, Reasonix), bukan Claude Code saja.
4. **Stage 6 (resync bridge root)** — **masuk scope plan ini**, diperluas ke
   kelima file root, bukan `CLAUDE.md` saja.
5. **Wiring `.mcp.json` otomatis** — **ditangani terpisah** di
   `PLAN-EVAL-03-MCP-SETUP-INSTALLATION-WIRING.md` (sudah dibuat), mengikuti
   rekomendasi karena profil risiko kode-vs-dokumentasi berbeda.

### Dampak keputusan ke scope

- Stage 6 berubah dari "opsional/temuan sampingan" jadi task wajib dengan
  cakupan lebih luas (5 file, bukan 1) — dan berubah dari asumsi awal "lewat
  `sigma project sync`" jadi **merge manual per file**, karena verifikasi
  kode menunjukkan tidak ada jalur sync otomatis untuk bridge root yang aman
  dipakai tanpa menghapus kustomisasi proyek (lihat detail di Task Breakdown
  Stage 6).
- Stage 5 (README) sekarang butuh riset format registrasi client untuk 4
  platform tambahan (Cursor/Codex/Antigravity/Reasonix), bukan cuma Claude
  Code yang sudah terverifikasi dari sesi PLAN-EVAL-01.
- Cakupan file yang disentuh plan ini naik dari perkiraan awal (~4 rule +
  5 bridge template + 2 skill file + README) jadi juga termasuk 5 bridge
  **root**, total ~16 file berbeda. Tetap housekeeping redaksional per file,
  tapi permukaan review Director saat implementasi nanti lebih luas.

---

## Catatan Eksekusi (2026-07-22)

Temuan/keputusan tambahan yang muncul saat implementasi, di luar Task
Breakdown asli — dicatat eksplisit, bukan modifikasi diam-diam:

- **Dangling reference `sigma refresh` ditemukan di GEMINI.md & AGENTS.md
  root** (bukan cuma CLAUDE.md yang sudah lama dibersihkan). Kedua file
  masih menulis `sigma refresh` di tabel "CLI-Managed Files" untuk
  `SIGMA-REGISTRY.json`/`SIGMA-OPERATION-REGISTRY.json` — command yang
  dikonfirmasi tidak ada implementasinya sama sekali (nol match di
  `src/commands/`). Diperbaiki ke `sigma project sync --confirm`, menyamakan
  ke tabel yang sudah benar di root `CLAUDE.md`.
- **Command usang di `REASONIX.md` (root DAN template)**: verifikasi
  terhadap `src/commands/{project,roadmap}.ts` mengonfirmasi `sigma project
  list` dan `sigma project reset` tidak ada (root), dan `sigma roadmap
  lock`/`sigma roadmap activate` juga tidak ada di kedua versi (root pakai
  `lock`, template pakai `activate` — keduanya salah, `roadmap` tidak pernah
  punya command sekelas lock). Ketiganya dihapus dari daftar, tidak
  digantikan command lain (tidak ada padanan valid untuk "roadmap
  lock/activate" karena roadmap memang tidak digerbang seperti
  intent/plan/exec/close).
- **README §sigma-mcp — cakupan platform jujur, bukan seragam.** Director
  memutuskan README mencakup kelima platform, tapi Codex CLI/Antigravity/
  Reasonix formatnya tidak pernah diverifikasi ulang sejak `src/utils/mcp.ts`
  dihapus total (`PLAN-EVAL-07`). Daripada menebak format (risiko yang sudah
  ditandai eksplisit di `PLAN-EVAL-03`), README memberi instruksi konkret
  untuk Claude Code & Cursor (format `mcpServers` standar, risiko rendah) dan
  mengarahkan ketiga platform lain ke dokumentasi client masing-masing.
  Ini dianggap memenuhi keputusan #3 tanpa melanggar prinsip "jangan
  menjanjikan lebih dari yang terverifikasi".
