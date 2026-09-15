# PLAN-IMPL — Hermes Phase 0: Read-Only Orientation Lab

**Sumber**: Sesi Professional Mode 2026-09-15 (Director + Claude), lanjutan dari verifikasi `2026-09-15_proposal-hermes-sigma-integration-setup-guide.md` (Discussion) dan empat dokumen desain `2026-09-12_*`.
**Tanggal**: 2026-09-15
**Status**: **DRAFT — menunggu review Director. Belum ada eksekusi apa pun.** Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.
**Cakupan perubahan kode Sigma**: **Nihil.** Fase ini murni konfigurasi sisi Hermes + verifikasi manual. Tidak ada file di `src/` yang disentuh.

---

## 1. Tujuan

Buktikan secara empiris bahwa Hermes dapat membaca state Sigma lewat `sigma-mcp` secara **read-only**, tanpa jalur tulis governance apa pun terbuka — sebelum kita percaya asumsi apa pun dari dokumen desain sebelumnya. Ini adalah eksperimen "Read-only lab" yang direkomendasikan `2026-09-12_research-hermes-agent-integration.md` §8 langkah 1, dan sekaligus menyelesaikan dua ambiguitas yang ditemukan saat verifikasi guide kemarin:

1. Nama tool MCP sebenarnya di sisi Hermes — `mcp_sigma_get_state` atau `mcp_sigma_sigma_get_state`? (lihat guide §6.1, koreksi 2026-09-15)
2. Apakah environment yang diteruskan ke subprocess `sigma-mcp` benar-benar tersaring (tidak membawa credential Hermes yang tidak perlu)?

## 2. Prasyarat — perlu keputusan Director dulu

| Keputusan | Opsi | Rekomendasi |
|---|---|---|
| Profile Hermes yang dipakai | (a) profile `default` yang sudah ada DeepSeek key, atau (b) profile baru khusus lab Sigma | (b) — memisahkan eksperimen Sigma dari pemakaian personal, sesuai prinsip pemisahan profile di `2026-09-12_proposal-hermes-security-boundaries.md` §5.1/§13 |
| Proyek lab | **[Terverifikasi 2026-09-15]** `sigma-ecosystem` (repo ini) **bukan** proyek yang dikelola Sigma — tidak ada `Sigma/progress-v<N>.json` chain, tidak ada `.sigma-identity.json`. Perlu proyek lab terpisah yang sudah `sigma project register` + `sigma project start` | Director menentukan proyek mana |

Fase ini **tidak dieksekusi** sampai kedua keputusan di atas dijawab.

## 3. Langkah kerja

1. **Registrasi `sigma-mcp`** ke `config.yaml` profile yang dipilih, via `hermes config edit` (bukan edit file manual langsung):
   ```yaml
   mcp_servers:
     sigma:
       command: "sigma-mcp"
       args: []
       timeout: 60
       connect_timeout: 30
   ```
2. **Restart Hermes** (registrasi MCP tidak hot-reload — dikonfirmasi dari dokumentasi Hermes).
3. **Cek nama tool sebenarnya** — jalankan `hermes tools` (atau perintah setara yang mendaftar tool aktif) dan catat nama pasti tool `sigma_*` yang muncul. Ini menjawab ambiguitas §1 poin 1 secara langsung, bukan asumsi.
4. **Verifikasi orientasi** — di proyek lab yang sudah ditentukan, jalankan dua hal berdampingan dan bandingkan hasilnya:
   - Manual: `sigma session bootstrap` (dari terminal biasa).
   - Via Hermes: minta Hermes memanggil tool MCP yang setara (state + orientation) dan meringkas.
   Kriteria: informasi yang dilaporkan Hermes (project id, chain version, gate status) harus cocok dengan output manual.
5. **Cek negatif — tidak ada jalur tulis.** Pastikan tidak ada tool `sigma_*` yang bisa memanggil operasi lock/ratify/close/lock apa pun. Daftar tool dari `src/mcp/index.ts` seharusnya hanya: `sigma_get_state`, `sigma_get_orientation`, `sigma_get_gates`, `sigma_list_artifacts`, `sigma_doctor`, `sigma_get_memory` — semua read-only by construction (tidak ada tool lain terdaftar di `buildServer()`).
6. **Cek environment subprocess** — konfirmasi `sigma-mcp` yang di-spawn Hermes tidak menerima `DEEPSEEK_API_KEY` atau credential Hermes lain yang tidak perlu (subprocess MCP seharusnya hanya perlu env minimal untuk menjalankan Node/Sigma CLI itu sendiri).

## 4. Definition of Done

Sesuai `2026-09-15_proposal-hermes-sigma-integration-setup-guide.md` §8 baris Fase 0, ditambah dua kriteria dari verifikasi kemarin:

- [ ] Agent membaca state Sigma via MCP dengan hasil yang cocok dengan `sigma session bootstrap` manual.
- [ ] Tidak ada jalur tulis governance yang tersedia lewat MCP (terverifikasi dari daftar tool aktual, bukan asumsi dokumentasi).
- [ ] Nama tool `sigma_*` sebenarnya di sisi Hermes terdokumentasikan (untuk dipakai di skill Phase 1).
- [ ] Tidak ada credential asing yang bocor ke subprocess `sigma-mcp`.

## 5. Yang eksplisit TIDAK dilakukan di fase ini

- Tidak membuat `setup/targets/hermes/`.
- Tidak membuat/menulis `AGENTS.md` atau `.sigma-identity.json` baru di proyek manapun.
- Tidak menjalankan command tulis Sigma apa pun (`intent`, `plan`, `exec`, `close`, `approve`) dari sesi Hermes.
- Tidak mengaktifkan gateway, Telegram, cron, atau channel eksternal apa pun (di luar cakupan dokumen ini — sudah disepakati sebelumnya).

## 6. Setelah fase ini selesai

Hasil §3 (nama tool sebenarnya) dan §6 (kebersihan environment) menjadi input wajib untuk `PLAN-IMPL-HERMES-PHASE1-SKILLS-AND-BINDING-20260915.md` — skill Phase 1 tidak boleh menyebut nama tool yang belum terverifikasi.
