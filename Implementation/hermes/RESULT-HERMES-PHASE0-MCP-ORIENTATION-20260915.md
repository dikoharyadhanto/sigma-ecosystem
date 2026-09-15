# RESULT — Hermes Phase 0: Read-Only Orientation Lab

**Tanggal eksekusi**: 2026-09-15  
**Status**: **PASS — Gate 0 terpenuhi dengan caveat non-blocking pada §5.**  
**Plan**: `PLAN-IMPL-HERMES-PHASE0-MCP-ORIENTATION-20260915.md`  
**Perubahan source Sigma**: Nihil.

## 1. Hasil utama

| Area | Hasil |
|---|---|
| Runtime | Hermes Agent `v0.21.3 (2026.9.14)`, upstream `8f785318`; Sigma CLI `1.0.0` |
| Profile | `sigma-lab`, terpisah dari `default`; gateway stopped |
| Credential | Tidak dipersist ke profile lab; DeepSeek key diinjeksi hanya pada proses agent saat uji dan tidak dicetak |
| Capability CLI | Seluruh built-in toolset dinonaktifkan; hanya MCP server `sigma` yang enabled |
| Proyek lab | `HERMESLAB`, root `C:\Users\dikoh\AppData\Local\hermes\labs\sigma-phase0` |
| Fixture | Active chain `v1`, lifecycle `DESIGN`, DIR-INTENT `v1` berstatus `DRAFT` |
| Gate | Gate 1/2/3 seluruhnya `BLOCKED`, sama antara bootstrap manual dan hasil MCP |
| MCP | Transport stdio, auth none, enam tool ditemukan dan enabled |
| Doctor | `applied: false`; tidak ada repaired/invalid/remaining findings |
| Non-mutation | 34 file governance sebelum/sesudah pemanggilan enam tool: `0` perbedaan path/hash |
| Environment child | Seluruh credential/sentinel yang diuji absent; `PATH` tetap present |
| Config final | Command MCP dikembalikan ke `C:\Users\dikoh\AppData\Roaming\npm\sigma-mcp.cmd`; koneksi ulang lulus |

## 2. Pemetaan nama tool yang terverifikasi

| Discovery name | Selector administratif Hermes | Model-facing/runtime name |
|---|---|---|
| `sigma_get_state` | `sigma:sigma_get_state` | `mcp__sigma__sigma_get_state` |
| `sigma_get_orientation` | `sigma:sigma_get_orientation` | `mcp__sigma__sigma_get_orientation` |
| `sigma_get_gates` | `sigma:sigma_get_gates` | `mcp__sigma__sigma_get_gates` |
| `sigma_list_artifacts` | `sigma:sigma_list_artifacts` | `mcp__sigma__sigma_list_artifacts` |
| `sigma_doctor` | `sigma:sigma_doctor` | `mcp__sigma__sigma_doctor` |
| `sigma_get_memory` | `sigma:sigma_get_memory` | `mcp__sigma__sigma_get_memory` |

Selector administratif mengikuti syntax `server:tool` yang dinyatakan CLI Hermes. Nama model-facing dibuktikan dari registration dan execution log profile `sigma-lab`, bukan dari ringkasan model.

## 3. Perbandingan state manual dan MCP

| Fakta | `sigma session bootstrap` | Hermes via MCP | Hasil |
|---|---|---|---|
| Project ID | `HERMESLAB` | `HERMESLAB` | Cocok |
| Project root | Root lab | Root lab yang sama | Cocok |
| Active chain | `v1` | `v1` | Cocok |
| Lifecycle | `DESIGN` | `DESIGN` | Cocok |
| Intent | `DIR-INTENT v1 [DRAFT]` | v1 / `DRAFT` | Cocok |
| Gate 1 | `BLOCKED` | `BLOCKED` | Cocok |
| Gate 2 | `BLOCKED` | `BLOCKED` | Cocok |
| Gate 3 | `BLOCKED` | `BLOCKED` | Cocok |
| Next operations | intent ratify, bootstrap, status | daftar yang sama dari orientation | Cocok |

Pada kondisi tanpa active chain, `sigma_get_state/gates/artifacts/doctor` memakai `active:false`, sedangkan orientation/memory tetap dapat memakai `active:true` karena proyek dan role memory valid. Setelah fixture chain `v1` dibuat, pembacaan state/gate menjadi konsisten untuk tujuan Gate 0.

## 4. Evidence runtime

Evidence mentah/teredaksi berada di:

`C:\Users\dikoh\AppData\Local\hermes\labs\sigma-phase0-evidence`

Berkas utama:

- `bootstrap-active-chain.txt`
- `agent-six-tools.txt`
- `agent-six-tools-active-chain.txt`
- `mcp-child-env-presence.txt`
- `governance-before-active-chain-mcp.json`
- `governance-after-active-chain-mcp.json`

Assertion environment child yang lulus:

```text
DEEPSEEK_API_KEY_PRESENT=false
OPENAI_API_KEY_PRESENT=false
ANTHROPIC_API_KEY_PRESENT=false
CLAUDE_CODE_OAUTH_TOKEN_PRESENT=false
SLACK_BOT_TOKEN_PRESENT=false
SLACK_APP_TOKEN_PRESENT=false
TELEGRAM_BOT_TOKEN_PRESENT=false
SIGMA_PHASE0_SENTINEL_PRESENT=false
PATH_PRESENT=true
```

## 5. Caveat dan deviasi non-blocking

1. `sigma session bootstrap` menambahkan event ke `Sigma/logs/operations.jsonl`. Karena itu, baseline hash non-mutation yang valid diambil **setelah** seluruh command pembanding manual selesai dan sebelum sesi MCP-only. Uji ulang MCP-only menghasilkan 34/34 file identik.
2. `sigma project start` melaporkan pembaruan konfigurasi MCP global Codex dan Gemini. Tidak ada snapshot pre-run untuk membuktikan apakah byte config berubah atau entri yang sama hanya ditulis ulang. Jangan menganggap provisioning proyek sepenuhnya project-local pada fase berikutnya.
3. `hermes profile create sigma-lab --no-skills` tetap menghasilkan satu skill bawaan `autonomous-ai-agents/hermes-agent` meskipun marker `.no-bundled-skills` ada. Skill toolset dinonaktifkan dan semua sesi uji memakai `--ignore-rules`, sehingga skill tersebut tidak menjadi capability aktif. Perilaku provisioning ini perlu diperhitungkan pada Phase 1.
4. Profile creation juga membuat alias `C:\Users\dikoh\.local\bin\sigma-lab.bat`; direktorinya tidak berada di `PATH`. Alias tidak digunakan dalam pengujian.
5. Percobaan registrasi pertama berhenti aman pada prompt pemilihan tool dan tidak meninggalkan konfigurasi parsial. Registrasi kemudian diselesaikan interaktif dengan semua enam tool read-only.
6. DeepSeek sempat mencoba batch multi-local yang ditolak oleh Hermes, lalu menjalankan enam call terpisah dengan benar. Penolakan ini tidak mengubah state dan tercatat di log.

## 6. Kesimpulan

Hermes terbukti dapat membaca orientation/state/gate/artifact/doctor/memory Sigma melalui MCP tanpa tool write governance, tanpa mutasi state Sigma, dan tanpa meneruskan credential profile/parent ke child MCP. Gate 0 lulus dan nama tool aktual sudah tersedia sebagai input Phase 1.
