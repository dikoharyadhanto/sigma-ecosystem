# Proposal — Setup Configuration Guide: Integrasi Sigma ↔ Hermes

- **Tanggal:** 2026-09-15 (diperbarui dari diskusi Director)
- **Status:** Proposal teknis untuk review Director; bukan artefak governance Sigma dan bukan otorisasi implementasi.
- **Objek:** Panduan setup konkret untuk mengintegrasikan Hermes Agent sebagai runtime/orchestrator Sigma.
- **Bahasa:** Indonesia (konfigurasi teknis/command tetap English).
- **Referensi dokumen induk:**
  - `2026-09-12_research-hermes-agent-integration.md`
  - `2026-09-12_design-hermes-sigma-project-scoped-governance.md`
  - `2026-09-12_proposal-hermes-inherited-role-behavior-persona-memory.md`
  - `2026-09-12_proposal-hermes-security-boundaries.md`
- **Catatan verifikasi (2026-09-15, Claude — final, diskusi dengan Hermes untuk dokumen ini dihentikan Director):** Revisi ini menulis ulang sebagian besar dokumen dan tanpa sengaja mengembalikan tiga klaim yang sudah dikoreksi di revisi sebelumnya (§7, §8.1, §9.2), plus dua temuan baru dari verifikasi lanjutan (§9.8, §5.1). Kutipan Konstitusi Sigma di §3 dan §11 (Article III, Article VI) sudah dicek langsung ke `Sigma/SIGMA_CONSTITUTION.md` — akurat. Titik koreksi ditandai **[Terverifikasi 2026-09-15]**.

---

## 1. Ringkasan rekomendasi

Integrasi dibangun di atas **extension point native Hermes** (skills, MCP, profiles, project-context files), bukan dispatcher global yang memantau filesystem. MVP hampir tanpa kode baru di sisi Sigma maupun Hermes.

**Kebutuhan #1 Director — yang menjadi pusat desain — adalah gateway:** kemampuan Hermes menjembatani komunikasi Director ↔ AI role Sigma. Ini bukan pelengkap, melainkan alasan utama integrasi.

```text
Director
  │ (natural language, decision)
  ▼
Hermes — global runtime + orchestrator ("flexible role")
  ├── persona + behaviour warisan AI role Sigma (tanpa governance)
  ├── skills sigma-arc/fmn/dev/aud        (M1 role behaviour, read-only)
  ├── sigma-mcp                            (orientation read-only)
  ├── project-context binding              (deteksi → verifikasi → capability)
  ├── profiles                             (default = orchestrator; sigma-dev = sandbox)
  └── memory M0                            (preferensi Director, write_approval)
         │
         ▼
Sigma control plane — satu-satunya sumber kebenaran
  ├── chain state, gate, artifact, approval, evidence
  └── CLI adalah satu-satunya penulis lifecycle
```

**Prinsip inti:** Hermes menyediakan "tubuh" (reasoning, tool, sandbox, memory, komunikasi); Sigma menyediakan "otak governance". Hermes **tidak pernah** menjadi sumber kebenaran lifecycle.

---

## 2. Arsitektur tiga lapis

```text
1. GLOBAL — Hermes sebagai "flexible role"
   Warisan persona + behaviour dari AI role Sigma, TANPA governance.
   Prinsip (Article III Konstitusi): "Reasoning may cross domains. Authority may not."

2. PROJECT — interaksi dengan Sigma yang sesungguhnya
   Hanya pada proyek terdaftar Sigma, secara local scope.
   Hermes sendiri yang meregistrasi proyek (sigma project start/register),
   atas persetujuan dan perintah Director — bukan otomatis, bukan dari cwd.

3. GATEWAY — jembatan komunikasi Director ↔ AI role Sigma
   Kebutuhan utama. Slack (smartphone + laptop Linux) + CLI (laptop Linux via SSH).
```

**Pembagian peran:**

| Pihak | Tanggung jawab |
|---|---|
| **Director** | Tujuan, prioritas, pilihan, persetujuan, keputusan akhir |
| **Hermes** | Konteks proyek, verifikasi binding, pilih/aktifkan role, bawa konteks minimum, monitor state, rangkum, minta keputusan |
| **AI Role Sigma** | Mandat formal: ARC (intent), FMN (plan), DEV (implementasi), AUD (audit) |
| **Sigma control plane** | Sumber kebenaran state, artifact, approval, gate, capability, komunikasi formal |

---

## 3. Model peran: Hermes sebagai "flexible role"

Hermes mewarisi *kualitas kerja* AI role Sigma, bukan *kewenangannya*:

| Warisan | Isi |
|---|---|
| **Boleh diwariskan global** | Persona komunikasi (Humanize BALANCE, Bahasa Indonesia), disiplin berpikir ARC/FMN/DEV/AUD, pola identifikasi risiko/bukti/scope, template capability per role |
| **Tidak diwariskan global** | State chain, isi artifact, approval/keputusan Director, evidence, otoritas gate/lock, kesimpulan bahwa role Sigma aktif di konteks baru |

**Pemetaan ke Konstitusi (Article III — Agent Sovereignty & Role Immutability):**

- Professional roles (ARC/FMN/DEV/AUD) tetap **immutable per sesi** dan satu-satunya pemegang mandat governance.
- Hermes global = **flexible** — boleh memakai cara berpikir lintas role ("reasoning may cross domains"), tetapi **tidak pernah** memegang otoritasnya ("authority may not cross").

**Implikasi teknis:** ARC/FMN/AUD cukup sebagai **skill** dalam satu profile (behaviour-only). DEV memerlukan **profile terpisah** karena containment-nya beda (Docker + worktree + safe root) — konfigurasi level-profile, tidak bisa bersih di-switch per role dalam satu sesi.

---

## 4. Mekanisme binding — deteksi vs verifikasi vs capability

Hermes auto-load project context berdasarkan `cwd`; ini tampak bertentangan dengan invariant "no auto-bind berdasarkan cwd". Ketegangan diselesaikan dengan **tiga lapisan**:

| Lapisan | Trigger | Efek | Aman? |
|---|---|---|---|
| **Deteksi** | `cwd` mengandung `.sigma-identity.json` / context file | Hermes *menyadari* kemungkinan ada proyek Sigma; hanya membaca pointer | Ya — read-only |
| **Verifikasi** | Eksplisit, sebelum aksi governance | `sigma session bootstrap` + baca `.sigma-identity.json`; cocokkan `project_id`, root, active chain, gate | Ya — inilah "explicit binding" |
| **Capability** | Gate + role + policy profile | Tool write/governance hanya lewat role profile + sandbox | Ya — policy-gated |

**Registrasi proyek:** Hermes menjalankan `sigma project start` / `sigma project register` **atas persetujuan/perintah Director**. `cwd`, nama repo, memory, atau isi pesan tidak pernah cukup untuk mengaktifkan capability Sigma.

---

## 5. Topologi deployment

| Fakta | Nilai |
|---|---|
| **Host Hermes** | PC Windows Director (mesin ini) — satu-satunya tempat Hermes ditanam |
| **Laptop Director** | Linux — **tidak** menjalankan Hermes kedua |
| **Smartphone** | Slack |
| **Channel utama** | **Slack** (Socket Mode — tanpa IP publik, ideal untuk PC di belakang router) |
| **Akses teknis dari laptop Linux** | Slack (app/browser) **atau** CLI via SSH ke PC Windows, atau web dashboard |

### 5.1 Siklus hidup gateway di Windows

**[Belum diverifikasi 2026-09-15]** Instalasi desktop Hermes yang sedang kita pakai saat ini **belum** punya Scheduled Task terdaftar (dicek langsung: `Get-ScheduledTask` tidak menemukan task Hermes/Nous apa pun di mesin ini) — auto-start `ONLOGON` di bawah ini adalah target konfigurasi, bukan kondisi yang sudah berjalan. Lihat catatan §9.8 soal `hermes gateway install` yang belum jelas jalur Windows-nya.

Gateway auto-start via **Scheduled Task `ONLOGON`** (target, setelah dikonfigurasi) — artinya hidup **setelah login Windows**, bukan setelah power-on:

```text
power-on (remote) → boot ke layar sign-in → [gateway BELUM hidup]
   → login Windows (Tailscale/RDP) → [gateway ONLOGON hidup] → Slack aktif
```

### 5.2 Opsi akses dari laptop Linux

| Jalur | Cara | Catatan |
|---|---|---|
| **Slack** | App Linux / browser | Satu channel menyatukan smartphone + laptop |
| **SSH → CLI** | Laptop Linux → SSH ke PC Windows → `hermes` | Perlu OpenSSH server di Windows + Tailscale (desain §5.2) |
| **Web dashboard** | Browser Linux → dashboard Hermes | Tab `/chat` (terminal tertanam) butuh POSIX PTY → di Windows native muncul banner "pakai WSL2"; sisanya jalan normal |

---

## 6. Routing AI role → provider

### 6.1 Aturan standing (keputusan Director)

**Sebelum routing AI role apa pun, Hermes WAJIB bertanya dulu ke Director:**
1. sedang berlangganan apa saat ini,
2. pemetaan AI → role yang berlaku saat itu.

**Tidak menebak, tidak menyimpulkan dari CLI/env.** Status langganan hanya diketahui Director; pemetaan adalah keputusan otoritas Director.

### 6.2 Pemetaan default

| AI Role | Claude Code | Codex | Gemini (Antigravity CLI) | DeepSeek |
|---|---|---|---|---|
| **ARC** | ✓ | ✓ (bisa) | ✓ (paling pas kalau terpaksa) | ✓ (cenderung) |
| **FMN** | ✓ | ✓ (bisa) | ✗ | ✓ (cenderung) |
| **DEV** | ✓ (**utama**) | ✗ (jarang) | ✗ | ✗ |
| **AUD** | ✗ (jarang) | ✓ (**utama**) | ✗ | ✗ |

Catatan: DEV (Claude) dan AUD (Codex) otomatis beda model → audit lintas-otak, selaras sifat AUD yang eksternal/pasif.

### 6.3 Fondasi: langganan ≠ akses API

| Yang dimiliki | Yang bisa dipakai |
|---|---|
| Claude Code subscription | **CLI** Claude Code (login `claude`), **bukan** Anthropic API |
| Codex subscription | **CLI** Codex (`codex exec`, OAuth), **bukan** OpenAI API |
| Gemini AI subscription | Belum jelas — perlu dicek apakah memberi API key (`GOOGLE_API_KEY`) atau hanya akses aplikasi |

### 6.4 Graceful degradation

```text
Hermes (DeepSeek)  = lapisan KONSTAN — orchestrator + ARC/FMN
                     (murah, selalu hidup, tanpa syarat langganan)
Claude/Codex/Gemini = lapisan VARIABEL — specialist opsional
                     (dipakai HANYA jika langganan aktif DAN tugas butuh)
```

Sistem harus bekerja penuh walau nol langganan aktif. Setiap langganan = tambahan spesialis, bukan syarat hidup.

### 6.5 Faktor routing (berurutan)

1. **Kelas tugas** — reasoning/strategi vs coding berat vs audit vs riset
2. **Kemampuan empiris** — model yang terbukti bagus *saat ini* (bukan reputasi nama)
3. **Ketersediaan** — langganan yang aktif (dari jawaban Director, bukan deteksi)
4. **Kelas data** — D0/D1 boleh keluar; D2 default tidak; D3 tidak pernah (keamanan §9.1)
5. **Biaya** — langganan = sunk cost (ada kuota); DeepSeek = metered (murah)

---

## 7. Lima titik integrasi

| # | Konsep Sigma | Mekanisme Hermes | Sifat | Kode baru? |
|---|---|---|---|---|
| 1 | Role behaviour (M1) | **Skills** `sigma-arc/fmn/dev/aud` | Progressive-load, versioned, read-only | **Ya** — isi `SKILL.md` reuse gaya yang sudah ada di `setup/targets/`, tapi mendaftarkan Hermes sebagai platform baru tetap perubahan kode di `setup.ts`/`detect.ts` (lihat §8.1, §15 poin 1) [Terverifikasi 2026-09-15 — koreksi kontradiksi berulang dengan §15] |
| 2 | Orientasi state | **`sigma-mcp`** (stdio, read-only) | Tool prefix `mcp_sigma_*` | Tidak |
| 3 | Project binding | **Context file + `.sigma-identity.json` + bootstrap** | Deteksi auto, verifikasi eksplisit | Tidak |
| 4 | Isolasi peran | **Profiles** (state) + **sandbox/worktree** (DEV) | Profile ≠ security boundary | Tidak |
| 5 | Persona Director | **`SOUL.md`** + **memory M0** | Humanize BALANCE, Bahasa Indonesia | Tidak |

---

## 8. Konfigurasi sisi Sigma

### 8.1 Target setup baru: `setup/targets/hermes/`

Menambah target Hermes ke `sigma setup install` agar role rules ter-deploy sebagai **Hermes skills**. **[Terverifikasi 2026-09-15]** Ini bukan sekadar menaruh folder — mendaftarkan platform baru butuh perubahan kode di `src/commands/setup.ts` (`ROLE_FILES`, `PLATFORM_LABELS`, `PLATFORM_SOURCE_DIR`, `targetDirMap` — dua tempat terpisah: `deploySkillsAndHook()` dan `runUninstall()`) dan `src/utils/detect.ts` (`DetectedTools`, `targetPaths()`, `detectTools()`). Rincian teknis lengkap ada di `Implementation/hermes/PLAN-IMPL-HERMES-PHASE1-SKILLS-AND-BINDING-20260915.md`.

```text
setup/targets/hermes/
├── sigma-arc/SKILL.md        # behaviour ARC (M1), tanpa otoritas gate
├── sigma-fmn/SKILL.md
├── sigma-dev/SKILL.md
├── sigma-aud/SKILL.md
├── sigma-report/SKILL.md     # briefing Director (chat-only)
```

**[Terverifikasi 2026-09-15 — koreksi]** Klaim "format sama dengan Codex/Antigravity" tidak akurat: `setup/targets/codex/arc/SKILL.md` yang sudah ada hanya memuat frontmatter `name:` + `description:`. Field `version:`/`metadata.hermes.tags:` di bawah **belum diverifikasi** terhadap skema skill Hermes sebenarnya — perlakukan sebagai usulan, bukan fakta baku, sampai diuji lewat `hermes doctor`/skill loading:

```markdown
---
name: sigma-arc
description: "ARC role behaviour for Sigma projects — clarify Director intent and draft DIR-INTENT. Behaviour only; no gate authority."
# version / metadata.hermes.tags di bawah BELUM TERUJI terhadap skema Hermes nyata —
# verifikasi dulu sebelum deploy, atau hapus jika Hermes menolak field asing.
version: 1.0.0
metadata:
  hermes:
    tags: [sigma, arc, intent, governance]
---

# Sigma ARC — role behaviour (M1)

## Scope
Behaviour layer only. Tidak membawa otoritas gate, ratify, lock, atau state proyek.

## Mandat
- Urai permintaan Director menjadi objective, outcome, success criteria, scope, constraints, risk, assumption.
- ...
```

**Penting:** skills memuat *behaviour*, bukan *authority*. `sigma intent ratify`, `sigma plan lock`, `sigma close lock` **tidak** dijalankan skill secara otonom — hanya memandu *bagaimana* role bekerja; eksekusi CLI write tetap butuh keputusan Director + gate valid.

---

## 9. Konfigurasi sisi Hermes

### 9.1 Provider inference (DeepSeek)

DeepSeek = jalur inference Hermes (untuk ARC/FMN/orchestration). Key hanya di `.env`, tidak pernah di prompt/memory/artifact/repo.

```bash
hermes model deepseek        # atau hermes setup → pilih deepseek
# .env: DEEPSEEK_API_KEY=sk-...
```

### 9.2 Registrasi `sigma-mcp` (Phase 0)

```yaml
mcp_servers:
  sigma:
    command: "sigma-mcp"
    args: []
    timeout: 60
    connect_timeout: 30
```

- Transport **stdio**; subprocess menerima environment tersaring.
- **[Terverifikasi 2026-09-15 — koreksi]** `src/mcp/index.ts` mendaftarkan **enam** tool read-only, bukan lima: `sigma_get_state`, `sigma_get_orientation`, `sigma_get_gates`, `sigma_list_artifacts`, `sigma_doctor`, dan **`sigma_get_memory`** (terlewat lagi di revisi ini — relevan untuk role behaviour yang butuh akses role-memory).
- **[Belum diverifikasi — uji di Phase 0]** Nama tool akhir di sisi Hermes diasumsikan `mcp_sigma_get_state` dkk., tapi tool asli sudah bernama `sigma_get_state` (prefix "sigma_" sudah melekat), sementara konvensi Hermes adalah `mcp_<server>_<tool>` dengan `<server>` = `sigma`. Kombinasinya berpotensi jadi `mcp_sigma_sigma_get_state` (dobel). Konfirmasi nama sebenarnya lewat `hermes tools`/`hermes chat` sebelum dipakai di skill/prompt manapun.
- Perubahan MCP butuh restart Hermes.

### 9.3 Project context file untuk deteksi (Phase 1)

`sigma project start` menulis `AGENTS.md` (portabel untuk Claude Code/Codex) atau `.hermes.md` (walk-parent).

```markdown
# Sigma Governance

Proyek ini dikelola oleh Sigma Ecosystem. Lihat `Sigma/SIGMA_PROTOCOL.md`.

Hermes: sebelum aksi yang menyentuh intent/plan/exec/close/approval/state,
WAJIB verifikasi binding:
1. Baca `.sigma-identity.json` (project_id + root).
2. Jalankan `sigma session bootstrap` (read-only).
3. Pastikan role/operasi valid terhadap gate.

File ini hanya menandai keberadaan Sigma. Ia tidak memberikan authority.
```

Batasan: ≤ 20.000 karakter; semua context file melewati threat-pattern scanner.

### 9.4 Profiles

| Profile | Peran | Backend terminal | Capability |
|---|---|---|---|
| `default` | Orchestrator + kerja global + ARC/FMN/AUD (via skill) | `local` (tepercaya) | Tools umum; governance via CLI Sigma + persetujuan Director |
| `director-gateway` | Slack-facing | `docker`/sandbox | Status, read-only, scheduling; tanpa terminal host umum |
| `sigma-dev` | DEV otonom | `docker` + worktree | Source write hanya di worktree; tanpa akses control-plane |

### 9.5 Memory (M0)

```yaml
memory:
  memory_enabled: true
  user_profile_enabled: true
  write_approval: true
```

- M0 hanya preferensi Director global. Tidak menyimpan state/fakta/rahasia proyek.
- M3 (project-bound) tidak dipromosikan ke memory global; dihapus saat binding berakhir.
- AUD profile memakai memory minimum/non-persistent.

### 9.6 Approval policy

```yaml
approvals:
  mode: manual
  cron_mode: deny
  single_query_mode: deny
  unattended_mode: deny
```

- `mode: off` / `--yolo` / `--dangerously-skip-permissions` dilarang pada profile Director gateway.
- Approval Hermes (runtime) ≠ approval Sigma (governance). Disimpan dan dinilai terpisah.

### 9.7 DEV sandbox (Phase 2) — verifikasi terhadap config saat ini

```yaml
terminal:
  backend: docker
  cwd: <worktree disposable yang ditentukan dispatcher>
  timeout: 180
  # home_mode, env_passthrough, docker_network, container_cpu/memory/disk/persistent:
  #   verifikasi nama key terhadap `hermes config check` pada versi ter-pin.
  #   Posisi aman: env allowlist kosong, docker_network: false, container non-persistent.
```

Prinsip: mount hanya worktree DEV; `HERMES_WRITE_SAFE_ROOT` ke worktree; Docker = security boundary (image/mount/network/env/limit adalah policy utama).

### 9.8 Setup Slack (channel utama)

```bash
# 1. Generate manifest sekali
hermes slack manifest --agent-view --write

# 2. api.slack.com → Create New App → From manifest → paste → install to workspace

# 3. .env
# SLACK_BOT_TOKEN=xoxb-...      (Bot User OAuth Token)
# SLACK_APP_TOKEN=xapp-...      (App-Level Token, Socket Mode)
# SLACK_ALLOWED_USERS=U01ABC... (Member ID Director, comma-separated)
# SLACK_HOME_CHANNEL=C012345... (opsional)

# 4. Mulai gateway
hermes gateway run                # foreground (uji) — [Terverifikasi 2026-09-15] "hermes gateway"
                                   #   tanpa subcommand TIDAK berjalan foreground; `run` wajib
                                   #   (dicek: `hermes gateway --help` menuntut subcommand)
hermes gateway install            # background service — [Belum diverifikasi di Windows] help
                                   #   text command ini menyebut "systemd/launchd" (Linux/macOS);
                                   #   belum jelas apakah ini yang membuat Scheduled Task `ONLOGON`
                                   #   di §5.1, atau itu jalur terpisah dari desktop installer. Uji
                                   #   langsung sebelum diasumsikan bekerja sama di Windows.
```

- **Socket Mode** = WebSocket, tanpa IP publik/port forwarding.
- Scope wajib: `chat:write`, `app_mentions:read`, `channels:history`, `groups:history`, `im:history`, `im:write`, `files:read`, `files:write`, dll. (manifest sudah mengisi; perubahan scope wajib reinstall app).
- Event wajib: `message.im`, `message.mpim`, `message.channels`, `message.groups`, `app_mention`.
- **`SLACK_ALLOWED_USERS` wajib diisi** — tanpa ini gateway deny semua pesan.
- Invite bot ke DM/channel: `/invite @Hermes Agent`.

---

## 10. Pengiriman file & sumber kebenaran

### 10.1 Dua surface

| Surface | Mekanisme |
|---|---|
| **Desktop app** | `MEDIA:/absolute/path` — gambar/audio/video render inline; file lain jadi kartu Download/Preview |
| **Slack** | Attachment via scope `files:write` (upload); `files:read` (baca attachment dari Director) |

Director bisa menerima artifact/evidence untuk diperiksa di kedua surface.

### 10.2 Menimpa vs menumpuk

| Lapisan | Perilaku |
|---|---|
| **Disk/proyek** | **Overwrite by path stabil** — draft yang sama ditimpa, bukan ditumpuk |
| **Slack (delivery)** | Setiap upload = objek attachment baru (Slack tidak dedupe by nama) |
| **Git + Sigma** | **Sumber kebenaran** — punya diff, history, push/pull |

**Aturan "menimpa" yang benar di Sigma:**

| Kondisi | Perlakuan |
|---|---|
| Draft dalam pengerjaan | Boleh **ditimpa** (file sama diperbarui) |
| Artifact RATIFIED/LOCKED | **Tidak boleh ditimpa** — lock irreversible; perubahan = **versi baru** (`v0.2`), bukan menimpa `v0.1` |

**Channel bukan git push/pull** — dan memang seharusnya tidak. Git-nya ada di lapisan proyek. Channel = view/snapshot; source of truth = git + Sigma. Nilai "git-like" di channel: kirim ringkasan diff (bukan file penuh), snapshot terbaru berlabel "view", dan jalankan `git diff/log/pull/push` atas permintaan.

**Secret (D3):** file berisi API key/token/`.env`/private key **tidak boleh** dikirim mentah — redaksi dulu (keamanan §9.1).

---

## 11. Batas self-learning terhadap artifact

**Hermes TIDAK otomatis "mempelajari" artifact Sigma ke memory/skill.** Membaca ≠ mempersist.

| Jenis "pelajaran" | Contoh | Nasib yang benar |
|---|---|---|
| **Pelajaran prosedural** (portabel) | "Klaim test lulus tanpa eksekusi" → verifikasi dengan eksekusi nyata | → **Skill**, dikurasi + versioned + **gate** |
| **Fakta/state proyek** (terikat) | Evidence, keputusan Director, state chain | → **Tetap di Sigma**, dibaca on-demand, tidak pernah dipromosikan ke memory global |

Alasan (dari desain Anda sendiri):
- Auto-ingest seluruh artifact → memory jadi **shadow governance store** (anti-pattern §9.2 "Memory sebagai registry"; melanggar invariant keamanan #8).
- **Kebocoran lintas proyek** (anti-pattern #3 "auto-inheritance").
- **Constitution Article VI (Transient Cognition Doctrine):** *"Cognitive exchanges are transient... must not be elevated to permanent governance artifacts unless explicitly approved by the Director."*

Ringkasnya: **Sigma menyimpan catatannya; Hermes belajar *caranya*, bukan *isinya*.**

---

## 12. AUD pasif via web chat (manual)

AUD bersifat pasif/advisory, sering dilakukan Director di **web chat** (bukan CLI agent). Hermes **tidak** mengotomasi login web chat (dokumen keamanan §16: Chrome utama Director dilarang; login authenticated = manual Director).

**Pola yang benar — Hermes mengorkestrasi di sekelilingnya:**

```text
1. Hermes siapkan materi AUD  →  artifact + prompt siap-paste
2. Director paste ke web chat  →  (ChatGPT/Claude/Gemini sesuai kebiasaan)
3. Director paste temuan balik →  ke Hermes
4. Hermes catat sebagai temuan AUD → ke record Sigma (AUD-NOTE/finding)
```

AUD tetap pasif + manual; Hermes tidak menyentuh sesi login web; temuan tetap masuk jejak governance.

---

## 13. Runbook implementasi (urut)

### Phase 0 — Read-only lab + gateway (jam)

```bash
hermes --version && sigma-mcp --version
hermes config edit              # tambahkan mcp_servers.sigma (§9.2); restart
hermes chat -q "Jalankan mcp_sigma_get_state dan ringkas."   # verifikasi orientasi read-only
```

```bash
# Slack (paralel — channel adalah kebutuhan utama)
hermes slack manifest --agent-view --write
# → setup app + .env + hermes gateway (lihat §9.8)
# → uji: kirim pesan dari smartphone Slack, verifikasi respons
```

### Phase 1 — Skills + binding (hari)

```bash
# Tambah setup/targets/hermes/ (§8.1), build, deploy
cd <proyek-sigma>
sigma project start             # tulis AGENTS.md + .sigma-identity.json
# Uji: /arc → draft DIR-INTENT; sigma plan new DITOLAK sebelum ratify
```

### Phase 2 — DEV sandbox (hari–minggu)

- Profile `sigma-dev` terpisah (§9.4, §9.7); satu pilot: locked plan → DEV sandbox → evidence → pending approval.

### Phase 3 — Mailbox dispatcher (minggu)

- Perlu perubahan Sigma: **claim/lease** (`UNREAD → CLAIMED → READ`).
- Dispatcher tidak menandai pesan `READ` saat polling.

### Phase 4 — Delegasi specialist (minggu)

- Claude Code (`claude -p`) untuk DEV, Codex (`codex exec`) untuk AUD/backup — sesuai pemetaan §6, **setelah bertanya status langganan ke Director**.

---

## 14. Gate verifikasi per fase

| Fase | Gate lolos bila |
|---|---|
| 0 | Agent baca state via MCP; tanpa jalur tulis governance; Slack merespons dari smartphone |
| 1 | ARC draft `DIR-INTENT`; gate menahan `sigma plan new` sebelum ratify; role immutability terjaga |
| 2 | DEV ubah source hanya di worktree; evidence terekam; `progress-v<N>.json` satu penulis |
| 3 | Dispatcher tidak menandai `READ` saat polling; claim/lease cegah aktivasi ganda |
| 4 | Output specialist diverifikasi; tidak ada delegated push/publish tanpa policy |

---

## 15. Perubahan yang masih diperlukan di sisi Sigma

1. **Target `setup/targets/hermes/`** — deploy role rules sebagai skills Hermes.
2. **Claim/lease mailbox** — `UNREAD → CLAIMED(worker_id, lease_until) → READ`.
3. **Approval record primitive** — record durable yang mengikat artifact version, content hash, evidence, identitas Director, transisi lock atomik.

---

## 16. Keputusan Director yang masih terbuka

1. **Binding mechanism** — setujui deteksi/verifikasi/capability (§4) dengan `AGENTS.md` + `.sigma-identity.json` + bootstrap?
2. **Registrasi proyek oleh Hermes** — konfirmasi Hermes menjalankan `sigma project start/register` atas perintah Director?
3. **Pemisahan fisik profile** — `HERMES_HOME` + credential set terpisah profile Sigma vs personal, mulai Phase 1 atau 2?
4. **Version pin Hermes** — versi mana di-pin sebagai baseline, dan jadwal validasi?
5. **Jalur Gemini/Antigravity** — apakah langganan Gemini memberi API key atau hanya akses aplikasi?
6. **Metode remote login Windows** — Tailscale+RDP atau yang lain (menentukan jalur SSH/CLI dari laptop Linux)?

---

## 17. Batas proposal

Dokumen ini adalah panduan setup teknis untuk integrasi, bukan konfigurasi final per deployment. Nilai image Docker, limit resource, model spesifik, network policy, denylist command, format audit log, dan mekanisme approval record tetap harus diputuskan melalui desain implementasi dan test contract tersendiri. Seluruh key konfigurasi Hermes wajib diverifikasi terhadap `hermes config check` pada versi yang di-pin sebelum diterapkan.
