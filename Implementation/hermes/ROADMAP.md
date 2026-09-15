# Roadmap — Integrasi Sigma ↔ Hermes

**Status:** Peta visual untuk review Director. Bukan artefak governance Sigma, tidak mengotorisasi eksekusi apa pun. Turunan dari `Discussion/2026-09-15_proposal-hermes-sigma-integration-setup-guide.md` (dikoreksi) dan plan di folder ini.

Dua diagram:

1. **§1 — Peta fase pengembangan** (roadmap integrasi Sigma ↔ Hermes, Phase 0–4).
2. **§2 — Urutan konfigurasi Hermes + testing yang dipasangkan** (bagaimana tiap langkah config diverifikasi).

---

## 1. Peta fase pengembangan integrasi

```mermaid
flowchart TD
    Start(["Mulai"]) --> D0{{"Prasyarat lintas-fase:\nprofile lab + proyek lab\n(lihat README.md)"}}
    D0 --> P0

    subgraph P0["PHASE 0 — Read-Only Orientation Lab"]
        direction TB
        P0a["Daftarkan sigma-mcp\ndi config.yaml"]
        P0b["Restart Hermes"]
        P0c["Cek nama tool asli\n(hermes tools)"]
        P0d["Bandingkan vs\nsigma session bootstrap manual"]
        P0a --> P0b --> P0c --> P0d
    end

    P0 --> G0{"Gate 0 lolos?\nMCP read-only terbukti,\nnol jalur tulis governance"}
    G0 -- "belum" --> P0
    G0 -- "lolos" --> P1

    subgraph P1["PHASE 1 — Skills + Project Binding"]
        direction TB
        P1a["Kode: setup.ts + detect.ts\n(ROLE_FILES, targetDirMap, dst)"]
        P1b["setup/targets/hermes/*/SKILL.md"]
        P1c["Bridge stub HERMES.md baru"]
        P1d["Uji: skill ARC to draft DIR-INTENT"]
        P1e["Uji: sigma plan new DITOLAK\nsebelum ratify"]
        P1a --> P1b --> P1c --> P1d --> P1e
    end

    P1 --> G1{"Gate 1 lolos?\nrole immutability terjaga,\nplan new tertahan"}
    G1 -- "belum" --> P1
    G1 -- "lolos" --> P2

    subgraph P2["PHASE 2 — DEV Sandbox (belum di-plan rinci)"]
        direction TB
        P2a["Profile sigma-dev terpisah\nDocker + worktree"]
        P2b["Satu pilot: locked plan\nto DEV sandbox to evidence"]
        P2a --> P2b
    end

    P2 --> G2{"Gate 2 lolos?\nsource berubah hanya di worktree,\nsatu penulis progress.json"}
    G2 -- "belum" --> P2
    G2 -- "lolos" --> P3

    subgraph P3["PHASE 3 — Mailbox Dispatcher (belum di-plan rinci)"]
        direction TB
        P3a["Skema baru:\nUNREAD to CLAIMED to READ"]
        P3b["Dispatcher tidak menandai\nREAD saat polling"]
        P3a --> P3b
    end

    P3 --> G3{"Gate 3 lolos?\nclaim/lease cegah\naktivasi ganda"}
    G3 -- "belum" --> P3
    G3 -- "lolos" --> P4

    subgraph P4["PHASE 4 — Delegasi Specialist (belum di-plan rinci)"]
        direction TB
        P4a["Claude Code claude -p to DEV"]
        P4b["Codex codex exec to AUD/backup"]
        P4a --> P4b
    end

    P4 --> G4{"Gate 4 lolos?\noutput specialist diverifikasi,\ntanpa delegated push/publish"}
    G4 -- "lolos" --> Done(["Pipeline otonom penuh\nDirector hanya approve"])

    subgraph SLACK["Track paralel — Slack Gateway (mulai sejak Phase 0)"]
        direction TB
        Sa["hermes slack manifest --agent-view --write"]
        Sb["Install app di Slack workspace"]
        Sc["Isi .env: SLACK_BOT_TOKEN,\nSLACK_ALLOWED_USERS"]
        Sd["hermes gateway run (uji foreground)"]
        Se["hermes gateway install\nBELUM TERVERIFIKASI di Windows"]
        Sa --> Sb --> Sc --> Sd --> Se
    end

    P0 -. paralel .-> SLACK
```

**Rujukan tiap node ke dokumen detail:**

| Fase di diagram | File rinci |
|---|---|
| Phase 0 | `PLAN-IMPL-HERMES-PHASE0-MCP-ORIENTATION-20260915.md` |
| Phase 1 | `PLAN-IMPL-HERMES-PHASE1-SKILLS-AND-BINDING-20260915.md` |
| Phase 2–4, Slack | `../../Discussion/2026-09-15_proposal-hermes-sigma-integration-setup-guide.md` (belum ada PLAN-IMPL — lihat `README.md` §"Kenapa hanya Phase 0/1") |

---

## 2. Konfigurasi Hermes + testing yang dipasangkan

Status warna mencerminkan kondisi **saat ini** (2026-09-15, terverifikasi langsung ke mesin) — bukan rencana ideal. Hijau = sudah terbukti jalan, kuning = langkah jelas tapi belum dikerjakan, merah = masih perlu keputusan Director sebelum bisa dikerjakan.

```mermaid
flowchart TD
    subgraph CONFIG["Urutan konfigurasi Hermes"]
        direction TB
        C1["1. Instal desktop app"]:::done
        C2["2. Hubungkan provider\nDeepSeek API"]:::done
        C3["3. Tambah hermes bin\nke PATH"]:::todo
        C4["4. Tentukan profile lab\ndefault vs baru khusus Sigma"]:::open
        C5["5. Daftarkan sigma-mcp\ndi config.yaml — Phase 0"]:::todo
        C6["6. Deploy skill Sigma\nPhase 1, butuh kode baru"]:::todo
        C7["7. Setup Slack gateway\nmanifest, .env, ALLOWED_USERS"]:::todo
        C8["8. Profile sigma-dev + Docker\nPhase 2"]:::todo
        C1 --> C2 --> C3 --> C4 --> C5 --> C6 --> C7 --> C8
    end

    subgraph TEST["Testing dipasangkan"]
        direction TB
        T1["hermes --version\nhermes doctor"]:::done
        T2["Kirim pesan tes,\ncek respons nyata — sudah terbukti"]:::done
        T3["hermes doctor / hermes status\ndari terminal manapun"]:::todo
        T4["Get-ScheduledTask, Get-Process\npastikan tidak ada service liar"]:::todo
        T5["hermes tools — cek nama tool asli\nvs sigma session bootstrap manual"]:::todo
        T6["Chat: /arc to draft DIR-INTENT;\nsigma plan new harus DITOLAK"]:::todo
        T7["Kirim pesan dari Slack app\nsmartphone, verifikasi respons"]:::todo
        T8["Pilot: locked plan to DEV sandbox\nto evidence to pending approval"]:::todo
    end

    C1 -.verifikasi.-> T1
    C2 -.verifikasi.-> T2
    C3 -.verifikasi.-> T3
    C4 -.verifikasi.-> T4
    C5 -.verifikasi.-> T5
    C6 -.verifikasi.-> T6
    C7 -.verifikasi.-> T7
    C8 -.verifikasi.-> T8

    classDef done fill:#d4edda,stroke:#28a745,color:#155724
    classDef todo fill:#fff3cd,stroke:#ffc107,color:#856404
    classDef open fill:#f8d7da,stroke:#dc3545,color:#721c24
```

**Legenda:**

| Warna | Arti |
|---|---|
| 🟩 Hijau | Sudah dikerjakan dan diverifikasi langsung dalam sesi ini |
| 🟨 Kuning | Langkah jelas (command/cara sudah dikonfirmasi), belum dikerjakan |
| 🟥 Merah | Terhambat keputusan Director yang masih terbuka — lihat bagian "Keputusan Director yang masih terbuka" di tiap `PLAN-IMPL-*.md` |

**Catatan pembacaan diagram:** langkah 3–8 sengaja digambar linear untuk keterbacaan, tapi **langkah 4 (pilih profile lab) memblokir langkah 5 ke bawah** — tidak ada yang bisa dieksekusi sampai keputusan itu dijawab. Track Slack (langkah 7) sebenarnya bisa berjalan paralel dari langkah 3, tidak harus menunggu langkah 6 selesai — lihat diagram §1 untuk hubungan paralelnya.
