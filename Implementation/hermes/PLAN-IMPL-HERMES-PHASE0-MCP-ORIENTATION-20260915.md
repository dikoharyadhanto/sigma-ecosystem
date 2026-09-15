# PLAN-IMPL — Hermes Phase 0: Read-Only Orientation Lab

**Sumber**: Sesi Professional Mode 2026-09-15 (Director + Claude), lanjutan dari verifikasi `2026-09-15_proposal-hermes-sigma-integration-setup-guide.md` (Discussion) dan empat dokumen desain `2026-09-12_*`.
**Tanggal**: 2026-09-15
**Status**: **IMPLEMENTED — Gate 0 PASS pada 2026-09-15.** Hasil dan caveat: `RESULT-HERMES-PHASE0-MCP-ORIENTATION-20260915.md`. Bukan FMN-PLAN Sigma dan tidak memiliki otoritas lock/gate Sigma.
**Cakupan perubahan kode Sigma**: **Nihil.** Fase ini hanya membuat profile Hermes terisolasi, menyiapkan proyek lab disposable, mengonfigurasi MCP pada profile itu, dan menjalankan verifikasi. Tidak ada file di `src/` yang disentuh.

---

## 1. Tujuan

Buktikan secara empiris bahwa Hermes dapat membaca state Sigma lewat `sigma-mcp` secara **read-only**, tanpa membuka jalur tulis governance dan tanpa mengubah state proyek. Eksperimen ini adalah "Read-only lab" yang direkomendasikan `2026-09-12_research-hermes-agent-integration.md` §8 langkah 1.

Phase 0 harus menjawab empat hal:

1. Apa nama administratif dan nama model-facing sebenarnya untuk keenam tool MCP Sigma pada Hermes yang terpasang?
2. Apakah hasil state/orientation/gate yang dibaca Hermes cocok dengan `sigma session bootstrap` manual?
3. Apakah subprocess `sigma-mcp` benar-benar tidak menerima credential Hermes yang tidak diperlukan?
4. Apakah seluruh panggilan MCP read-only tidak mengubah file governance proyek lab?

## 2. Keputusan Director — sudah dijawab

| Keputusan | Baseline yang disetujui 2026-09-15 | Konsekuensi |
|---|---|---|
| Profile Hermes | Profile baru khusus lab bernama `sigma-lab` | Tidak memakai atau memodifikasi profile personal `default`; profile dibuat tanpa clone state, channel, memory, atau skill personal. |
| Proyek lab | Proyek Sigma disposable baru tanpa secret/data nyata | Tidak memakai `sigma-ecosystem` atau proyek aktif lain sebagai fixture. Project ID/root aktual dicatat saat provisioning. |
| Scope gateway | Slack dipisahkan dari Phase 0 MCP | Keberhasilan/kegagalan Slack tidak menjadi bagian Gate 0. Slack tetap merupakan track paralel dengan test contract tersendiri. |

Keputusan di atas menghapus open question Director untuk Phase 0. Detail path executable, path lab, dan cara observasi subprocess adalah keputusan teknis lokal yang harus diverifikasi oleh executor dan dicatat sebagai evidence; bukan keputusan governance baru.

## 3. Baseline lokal yang sudah terverifikasi

Hasil inspeksi read-only pada 2026-09-15:

- Hermes Agent yang terpasang: `v0.21.3 (2026.9.14)`, upstream `8f785318`.
- Binary Hermes ada di `%LOCALAPPDATA%\hermes\bin\hermes.exe`, tetapi belum tersedia sebagai `hermes` di `PATH` shell saat inspeksi.
- Profile yang sudah ada hanya `default`; model terkonfigurasi dan gateway berhenti.
- `hermes config check` lulus untuk config version `45`; keberadaan `DEEPSEEK_API_KEY` terdeteksi tanpa membaca atau mencetak nilainya.
- `sigma.cmd --version` menghasilkan `1.0.0`.
- Shim PowerShell `sigma.ps1`/`sigma-mcp.ps1` tertahan oleh Execution Policy pada shell ini. Untuk Phase 0, gunakan `.cmd` atau executable absolut yang di-resolve; jangan mengubah Execution Policy sebagai bagian eksperimen.
- `sigma-mcp` tidak menyediakan kontrak `--version`; invocation tersebut memulai server stdio. Validasi server dilakukan melalui handshake `hermes mcp test`, bukan flag versi.
- Hermes `v0.21.3` menyediakan `profile create/list`, `mcp add/list/test`, dan `tools list`. CLI menampilkan MCP dalam notasi administratif `server:tool`; nama yang diterima model tetap harus direkam dari tool schema/log aktual.

Baseline ini harus dicek ulang saat eksekusi. Jika versi binary berubah, hentikan dan nilai ulang command/schema sebelum mengubah config.

## 4. Persiapan terisolasi

### 4.1 Preflight executable dan config

1. Resolve dan catat path absolut `hermes.exe`, `sigma.cmd`, dan `sigma-mcp.cmd` tanpa mengubah `PATH` atau Execution Policy.
2. Jalankan `hermes.exe --version`, `sigma.cmd --version`, `hermes.exe profile list`, dan `hermes.exe config check`.
3. Pastikan tidak ada profile `sigma-lab` lama. Jika ada, jangan overwrite/delete otomatis; inspeksi dan eskalasi karena state-nya tidak lagi dapat dianggap disposable.
4. Pastikan tidak ada proses/gateway yang sedang memiliki profile `sigma-lab`.

### 4.2 Buat profile `sigma-lab`

1. Buat profile baru tanpa clone dan tanpa bundled skills:
   ```powershell
   & <HERMES_EXE> profile create sigma-lab --no-skills --description "Isolated Sigma MCP read-only lab"
   ```
2. Provision hanya provider/model minimum yang diperlukan agar satu chat pengujian dapat berjalan. Jika DeepSeek dipakai, masukkan `DEEPSEEK_API_KEY` melalui mekanisme config/credential profile tanpa mencetak nilainya. Jangan clone `.env`, channel, memory, session, atau skill dari `default`.
3. Jalankan `hermes.exe --profile sigma-lab config path` dan `config check`; rekam path config dan statusnya, bukan isi secret.

### 4.3 Buat proyek Sigma disposable

1. Pilih root baru yang jelas berada di area lab Hermes, bukan di dalam repository `sigma-ecosystem` atau proyek aktif lain. Rekomendasi Windows: `%LOCALAPPDATA%\hermes\labs\sigma-phase0`.
2. Verifikasi resolved absolute path sebelum membuat direktori. Jika path sudah berisi data, jangan gunakan `--reinit` atau menghapusnya; pilih root kosong lain.
3. Inisialisasi proyek lab dengan identitas khusus, Git lokal tanpa remote, dan tanpa Humanize/Notion gate eksternal. Baseline yang disarankan:
   ```powershell
   sigma.cmd project start --id HERMESLAB --name "Hermes Phase 0 Lab" --lang Indonesia --confirm --init-git --no-humanize-gate
   ```
4. Jalankan `sigma.cmd session bootstrap` dari root lab dan simpan output teredaksi sebagai baseline. Pastikan `.sigma-identity.json` dan chain `Sigma/progress-v<N>.json` tersedia.
5. Proyek ini boleh dipakai ulang untuk fase lab berikutnya, tetapi tidak boleh menerima secret, remote Git, atau pekerjaan produksi. Jangan hapus registry/state-nya secara manual setelah pengujian.

Pembuatan `.sigma-identity.json` dan state Sigma hanya diizinkan di proyek disposable ini. Tidak ada file governance baru yang dibuat pada `sigma-ecosystem` atau proyek lain.

## 5. Langkah eksperimen

### 5.1 Registrasi dan konektivitas MCP

1. Catat config `sigma-lab` sebelum perubahan dan siapkan rollback config yang tidak menyalin file credential.
2. Daftarkan server melalui CLI native Hermes `v0.21.3`, menggunakan path absolut `sigma-mcp.cmd` hasil preflight dan **tanpa** `--env`:
   ```powershell
   & <HERMES_EXE> --profile sigma-lab mcp add sigma --command <SIGMA_MCP_CMD> --connect-timeout 30
   ```
3. Periksa hasil dengan `mcp list`, `mcp test sigma`, `tools list --platform cli`, dan `config check` pada profile `sigma-lab`.
4. Jangan mengandalkan hot-reload. Setelah registrasi/test, mulai sesi Hermes baru pada root proyek lab agar koneksi dan tool schema dibangun dari config yang sudah final. Restart proses hanya jika `mcp test`, log, atau runtime menunjukkan config lama masih dipakai.
5. Rollback konfigurasi MCP adalah `mcp remove sigma` pada profile `sigma-lab`; jangan mengedit config profile `default`.

### 5.2 Rekam nama tool aktual

Catat dua bentuk nama secara terpisah:

- notasi administratif yang tampil di `mcp list`/`tools list` (Hermes `v0.21.3` mendokumentasikan bentuk `server:tool`); dan
- nama model-facing/tool schema yang benar-benar digunakan saat Hermes melakukan tool call.

Jangan mengasumsikan `mcp_sigma_get_state` maupun `mcp_sigma_sigma_get_state`. Hasil aktual menjadi input wajib Phase 1.

### 5.3 Verifikasi orientasi dan keenam tool

1. Dari root lab, ambil baseline manual `sigma.cmd session bootstrap` serta state/gate/artifact yang relevan.
2. Dalam sesi Hermes baru yang terikat ke root lab, panggil keenam tool yang diekspos `src/mcp/index.ts`:
   - `sigma_get_state`
   - `sigma_get_orientation`
   - `sigma_get_gates`
   - `sigma_list_artifacts`
   - `sigma_doctor`
   - `sigma_get_memory`
3. Bandingkan sekurang-kurangnya `project_id`, project root, chain version, lifecycle/gate status, dan artifact list dengan hasil CLI manual.
4. Perbedaan rendering/ringkasan boleh terjadi; perbedaan fakta atau state adalah kegagalan Gate 0.

### 5.4 Cek negatif: capability dan non-mutation

1. Verifikasi daftar tool aktual hanya memuat enam tool Sigma read-only di atas dan tidak memuat operasi `ratify`, `lock`, `approve`, `close`, atau mutasi governance lain.
2. Ambil manifest sebelum uji yang berisi daftar path dan SHA-256 seluruh file governance lab (`.sigma-identity.json` dan tree `Sigma/`). Simpan manifest di luar tree yang diukur.
3. Setelah seluruh tool MCP dipanggil, ambil manifest kedua dan bandingkan path serta hash.
4. Jalankan `git status --porcelain` pada lab sebelum/sesudah sebagai pemeriksaan tambahan.
5. Gate gagal bila tool Sigma baru muncul, file governance baru/hilang, atau content hash berubah. Perubahan file session/log Hermes di luar tree governance tidak dihitung sebagai mutasi Sigma, tetapi tetap dicatat.

### 5.5 Cek environment subprocess tanpa mengekspos secret

1. Gunakan launcher diagnostik sementara di area lab yang meneruskan stdio ke `sigma-mcp.cmd`, tetapi hanya merekam boolean keberadaan variabel sensitif—tidak pernah nama+nilai atau dump environment penuh.
2. Minimum assertions: `DEEPSEEK_API_KEY`, token channel, credential provider lain yang terdapat pada profile, dan sentinel rahasia parent harus **absent** pada child `sigma-mcp` kecuali sebuah variable secara eksplisit dibutuhkan dan di-allowlist untuk MCP (baseline Phase 0: tidak ada).
3. Jalankan satu `mcp test` dan satu tool call melalui launcher, simpan hasil boolean sebagai evidence, lalu kembalikan command MCP ke executable `sigma-mcp.cmd` asli.
4. Verifikasi config final tidak memiliki `mcp_servers.sigma.env`/`--env` credential dan launcher diagnostik tidak menyimpan nilai secret.
5. Bila credential apa pun terdeteksi pada child, hentikan eksperimen, cabut koneksi MCP, jangan mencetak nilainya, dan perlakukan Gate 0 sebagai gagal.

Audit source Hermes boleh menjadi bukti pendukung, tetapi tidak menggantikan pemeriksaan runtime. Pada baseline `v0.21.3`, `tools/mcp_tool_config.py::_build_safe_env()` membangun environment terfilter namun juga dapat meneruskan secret dari external secret source; karena itu konfigurasi profile dan hasil runtime keduanya harus diperiksa.

## 6. Evidence yang harus dihasilkan

Simpan laporan teredaksi yang memuat:

- versi dan path binary Hermes/Sigma yang benar-benar digunakan;
- project ID/root lab dan versi chain;
- path config profile `sigma-lab` tanpa isi credential;
- hasil `mcp list`, `mcp test`, dan daftar enam tool;
- pemetaan nama administratif ↔ nama model-facing tool;
- tabel perbandingan manual bootstrap vs hasil Hermes;
- manifest hash pre/post dan hasil `git status`;
- boolean sanitasi environment tanpa nilai secret;
- deviation, kegagalan, dan tindakan rollback bila ada.

Evidence disimpan pada lokasi lab yang tidak ikut diukur sebagai state governance dan tidak dikirim ke provider/chat sebelum redaction diperiksa.

## 7. Definition of Done

Sesuai gate Phase 0 pada `2026-09-15_proposal-hermes-sigma-integration-setup-guide.md` §14, dengan scope Slack dipisahkan berdasarkan keputusan Director 2026-09-15:

- [x] Profile `sigma-lab` dan proyek disposable terisolasi dari profile personal serta proyek nyata.
- [x] Agent membaca state Sigma melalui MCP dengan fakta yang cocok dengan `sigma session bootstrap` manual.
- [x] Keenam tool Sigma aktual tersedia dan tidak ada tool write governance yang terekspos.
- [x] Nama administratif dan model-facing tool terdokumentasikan untuk Phase 1.
- [x] Hash/path file governance tidak berubah setelah seluruh panggilan read-only.
- [x] Tidak ada credential asing yang diteruskan ke subprocess `sigma-mcp`.
- [x] Rollback MCP telah didefinisikan dan evidence teredaksi lengkap.

Gate Slack bukan bagian Definition of Done ini.

## 8. Yang eksplisit TIDAK dilakukan

- Tidak membuat `setup/targets/hermes/` atau mengubah `src/`.
- Tidak membuat/menulis `AGENTS.md`, `.sigma-identity.json`, atau state Sigma di luar proyek disposable yang disetujui.
- Tidak menjalankan command tulis lifecycle Sigma (`intent`, `plan`, `exec`, `close`, `approve`, `ratify`, atau `lock`) dari sesi Hermes.
- Tidak mengaktifkan gateway, Slack, Telegram, cron, webhook, desktop automation, atau channel eksternal.
- Tidak mengubah Windows Execution Policy, PATH sistem, provider fallback, plugin, atau policy global Hermes.
- Tidak clone profile `default` dan tidak menyalin memory/session/channel personal ke `sigma-lab`.
- Tidak update Hermes ke versi lain di tengah eksperimen.

## 9. Setelah fase ini selesai

Pemetaan nama tool dari §5.2 dan hasil sanitasi environment dari §5.5 menjadi input wajib `PLAN-IMPL-HERMES-PHASE1-SKILLS-AND-BINDING-20260915.md`. Skill Phase 1 tidak boleh menyebut nama tool atau asumsi path/config yang belum dibuktikan Phase 0.

Phase 0 selesai dengan Gate 0 PASS. Open question berikutnya berada pada Phase 1, bukan pada plan ini.
