# Riset: Potensi Integrasi Sigma dengan Hermes Agent

- **Tanggal riset:** 2026-09-12
- **Status:** Catatan riset teknis; bukan artefak governance Sigma.
- **Objek:** [Hermes Agent oleh Nous Research](https://hermes-agent.nousresearch.com/)
- **Tujuan:** Menilai apakah Hermes dapat menjadi runtime agen untuk roadmap otonomi Sigma tanpa memindahkan otoritas governance dari Sigma.

## 1. Ringkasan eksekutif

**Kesimpulan:** Hermes merupakan kandidat runtime yang kuat untuk menjalankan agen peran Sigma, terutama karena memiliki profile terpisah, gateway pesan, scheduler, MCP, worktree otomatis, dan backend sandbox. Namun Hermes **bukan** pengganti kernel Sigma. Integrasi yang benar adalah:

```text
Hermes = runtime/executor agen + antarmuka notifikasi
Sigma  = sumber kebenaran chain + gate + approval + evidence
```

Hermes dapat mempercepat pembangunan dispatcher pada blueprint Sigma, tetapi tidak menutup tiga primitive yang belum ada di Sigma: approval queue, evidence engine, dan dispatcher yang sadar state. Approval perintah berbahaya milik Hermes juga tidak sama dengan persetujuan Director terhadap transisi governance.

**Rekomendasi awal:** Bangun `sigma-agent` sebagai komponen Sigma yang tetap memiliki state dan policy sendiri; gunakan Hermes melalui profile terpisah sebagai executor yang dipanggil komponen tersebut. Jangan menjadikan Hermes cron, Bot Mode, atau memori Hermes sebagai sumber otoritatif lifecycle Sigma.

## 2. Metode dan batasan

Riset ini menggunakan dokumentasi resmi Hermes Agent dan repository resmi. Klaim yang ditandai **[Terverifikasi]** berasal langsung dari sumber tersebut. Bagian **[Inferensi]** adalah kesimpulan arsitektural dari perbandingan dengan source Sigma saat ini.

Tidak ada instalasi, konfigurasi Hermes, atau perubahan source selain pembuatan catatan ini.

## 3. Fakta penting tentang Hermes

### 3.1 Produk dan runtime

- **[Terverifikasi]** Hermes Agent adalah proyek open-source berlisensi MIT dari Nous Research. Situs resmi saat riset menyatakan versi `v0.21.2`.
- **[Terverifikasi]** Hermes menyediakan CLI, gateway pesan, API server, batch runner, dan library Python di atas runtime agen yang sama. Penyimpanan session menggunakan SQLite, FTS5, lineage antar-session, serta atomic write dengan penanganan contention.
- **[Terverifikasi]** Gateway adalah proses jangka panjang dengan otorisasi pengguna, routing session, delivery respons, cron ticking, dan maintenance. Cron Hermes menjalankan agen baru tanpa riwayat percakapan, menyuntikkan skill terkait, lalu menyimpan status pekerjaan berikutnya.

Implikasi: Hermes matang sebagai *agent runtime*, bukan hanya CLI interaktif.

### 3.2 Profiles dan Bot Mode

- **[Terverifikasi]** Setiap profile mempunyai `config.yaml`, `.env`, `SOUL.md`, memory, session, skills, cron jobs, log, dan state database sendiri. Satu profile dapat memiliki gateway independen.
- **[Terverifikasi]** Bot Mode memetakan bot ke profile: satu bot dapat memiliki role, model, memory, skill, dan capability sendiri. Bot dapat berkomunikasi langsung atau dalam group chat; pengiriman antarbot memiliki delivery state, satu retry untuk kegagalan transien, serta reason code terstruktur.
- **[Terverifikasi]** Profile **bukan** sandbox. Pada backend local, semua profile tetap mempunyai akses filesystem setara user OS. `SOUL.md` dan `terminal.cwd` membentuk instruksi serta titik mulai, bukan batas keamanan.

Implikasi: profile Hermes cocok untuk memetakan prinsip Sigma “satu proses/sesi = satu peran”, tetapi harus dipadukan dengan sandbox dan capability policy untuk menghasilkan containment nyata.

### 3.3 MCP dan ekstensi

- **[Terverifikasi]** Hermes dapat terhubung ke server MCP melalui stdio atau HTTP. Tool diberi prefix `mcp_<server>_<tool>` untuk mencegah collision; Hermes juga mendukung filter tool per server dan sanitasi hasil MCP.
- **[Terverifikasi]** MCP subprocess hanya menerima environment aman secara default; credential harus dipasang secara eksplisit di konfigurasi server MCP.
- **[Terverifikasi]** Remote HTTP MCP dapat diberi identity header statis atau berdasarkan nama profile Hermes.
- **[Terverifikasi]** Hermes memiliki plugin system di level user, project, dan package entry point; plugin dapat menambah tool, hook, dan command.

Implikasi: `sigma-mcp` yang telah ada dapat dipasang sebagai MCP stdio baca-saja pada profile Hermes. Ini memberi agen orientasi state Sigma tanpa memberi tool tulis governance melalui MCP.

### 3.4 Isolasi eksekusi, worktree, dan keamanan

- **[Terverifikasi]** Hermes mempunyai backend terminal local, Docker, SSH, Daytona, Modal, Singularity, dan Vercel Sandbox.
- **[Terverifikasi]** Backend Docker mendukung hardening, pembatasan CPU/memori/disk, dan allowlist environment yang diteruskan ke container. Dokumentasinya merekomendasikan container/cloud backend untuk gateway produksi.
- **[Terverifikasi]** `HERMES_WRITE_SAFE_ROOT` dapat membatasi `write_file` dan `patch` ke direktori tertentu. File credential dan beberapa path sensitif diblokir secara keras.
- **[Terverifikasi]** `hermes -w` membuat worktree sementara dalam `.worktrees/`, branch terpisah, lalu menjalankan sesi di sana. Banyak invocation dapat berjalan paralel dengan worktree masing-masing.
- **[Terverifikasi]** Hermes memiliki command-approval untuk pola perintah berbahaya. Default untuk cron, single-query, webhook/API unattended adalah `deny` apabila command memicu approval.

Implikasi: Hermes menyediakan bahan containment untuk DEV otonom, tetapi containment hanya efektif jika backend Docker/cloud dan safe root benar-benar dipakai. Worktree saja membatasi konflik Git, bukan akses host, network, atau secret.

## 4. Pemetaan Hermes terhadap kebutuhan Blueprint Sigma

| Kebutuhan Sigma | Kemampuan Hermes | Penilaian dan batas |
|---|---|---|
| Satu agen per role | Profile/Bot terpisah, gateway proses terpisah | Cocok untuk ARC, FMN, DEV, AUD. Profile tidak menggantikan sandbox. |
| Orientasi state | MCP stdio/HTTP, tool filtering | Cocok langsung untuk `sigma-mcp` yang baca-saja. |
| Eksekusi DEV terisolasi | Docker/cloud backend dan `hermes -w` | Cocok, tetapi perlu mount, safe root, env allowlist, dan network policy eksplisit. |
| Trigger berkala | Cron dan gateway | Dapat menjadi mekanisme polling, tetapi tidak boleh menjadi sumber kebenaran dispatch. |
| Handoff antaragen | Bot message dan group chat | Berguna sebagai transport/notifikasi, tetapi Sigma mailbox tetap lebih sesuai sebagai rekam governance per chain. |
| Notifikasi Director | Gateway pada banyak platform | Kuat untuk menyampaikan approval request atau escalation. Perlu binding request-ID Sigma dan autentikasi Director. |
| Approval Director | Approval command Hermes | **Tidak cocok sebagai pengganti.** Approval Hermes hanya untuk command berbahaya, bukan keputusan governance yang durable. |
| Evidence engine | Terminal tool dan output tool | Hanya executor. Sigma tetap harus menjalankan/menyimpan/hash bukti sebagai kernel evidence. |
| Crash recovery | SQLite session, gateway service, retry delivery | Membantu runtime Hermes, tetapi resume pipeline harus ditentukan dari state Sigma dan request approval. |

## 5. Arsitektur integrasi yang direkomendasikan

### 5.1 Batas otoritas

```text
Director
  │ approval/reject dengan identitas terverifikasi
  ▼
Sigma approval service / CLI
  │ satu-satunya penulis gate, lock, request, dan evidence record
  ├── state chain + approval queue + evidence store
  └── dispatcher state machine
          │ menjalankan pekerjaan yang valid
          ▼
Hermes profile executor (ARC / FMN / DEV / AUD)
  ├── sigma-mcp: orientation read-only
  ├── workspace/worktree terbatas
  └── capability minimal per role
```

**[Inferensi]** `sigma-agent` sebaiknya tetap menjadi dispatcher tipis milik Sigma. Hermes dipanggil sebagai runtime profile/headless session atau melalui API yang stabil. Dengan demikian, perubahan pada memory, Bot Mode, scheduler, atau provider Hermes tidak dapat mengubah lifecycle Sigma.

### 5.2 Konfigurasi peran yang mungkin

| Profile Hermes | Tugas | Capability minimum |
|---|---|---|
| `sigma-arc` | Interview interaktif dan draft intent | MCP state/orientation, read repo terbatas; tanpa scheduler otonom. |
| `sigma-fmn` | Membuat roadmap dan plan dari intent yang sudah RATIFIED | MCP state/artifact, tulis hanya artifact draft, tidak ada capability lock. |
| `sigma-dev` | Implementasi plan LOCKED dan verifikasi | Container terisolasi, worktree, Git, test tooling, MCP orientation; write hanya dalam worktree. |
| `sigma-aud` | Review adversarial | Read-only repository/evidence dan MCP; tanpa terminal tulis. |

Semua profile harus mempunyai `SOUL.md`/skill yang memuat rule Sigma, tetapi rule prompt hanya pelengkap. Gate dan capability policy harus menjadi pembatas nyata.

### 5.3 Integrasi MCP tahap pertama

Langkah teknis paling rendah risiko adalah memasang `sigma-mcp` sebagai MCP stdio pada masing-masing profile. Hanya enam tool Sigma yang tersedia saat ini dan semuanya baca-saja: state, orientation, gates, artifact list, doctor view, dan role memory.

Ini memecahkan masalah orientasi tanpa memberi Hermes jalur MCP untuk mengunci artefak. Perintah tulis harus tetap melalui wrapper/dispatcher Sigma yang menerapkan policy, bukan tool shell generik yang bebas.

## 6. Risiko dan ketegangan desain

### 6.1 Approval Hermes bukan approval Sigma

Hermes meminta approval ketika perintah dianggap berbahaya. Persetujuan itu bisa bersifat sesi-lokal dan command-specific. Blueprint Sigma membutuhkan record durable yang mengikat artifact version, content hash, evidence, identitas Director, keputusan approve/reject, dan transisi lock atomik.

**Keputusan desain:** Jangan memetakan tombol `/approve` Hermes langsung ke `sigma approve`. Hermes hanya boleh menampilkan/mengirim notifikasi; service Sigma harus memverifikasi dan merekam keputusan Director.

### 6.2 Worktree berkonflik dengan state Sigma lokal

State Sigma saat ini berada di dalam root proyek, termasuk `Sigma/progress-v<N>.json`, artefak, mailbox, dan log. Hermes `-w` menjalankan DEV di checkout/worktree berbeda. Jika DEV menjalankan CLI Sigma di sana, state dan request dapat bercabang dari worktree utama.

**[Inferensi — risiko kritis]** Sebelum DEV autonomy, desain harus menentukan salah satu:

1. control-plane Sigma di luar worktree dan diakses melalui service/wrapper tunggal;
2. protocol commit/merge yang secara eksplisit membawa perubahan artefak dan state kembali ke control worktree; atau
3. pemisahan ketat: DEV hanya mengubah source dalam worktree, sedangkan dispatcher di control worktree yang membuat/mengubah artefak dan evidence record.

Opsi 3 paling aman untuk pilot, karena menghindari dua penulis pada `progress-v<N>.json`.

### 6.3 Profile bukan batas keamanan

Dokumentasi Hermes menyatakan profile hanya memisahkan state Hermes; backend local masih memakai akses user OS yang sama. Karena itu, profile `sigma-dev` tidak boleh dianggap cukup untuk menahan agent dari `Sigma/` control-plane, home credential, atau repository lain.

**Mitigasi:** gunakan Docker/cloud backend untuk DEV, mount hanya worktree, set `HERMES_WRITE_SAFE_ROOT` ke worktree, gunakan allowlist environment kosong secara default, dan jangan mount credential kecuali diperlukan.

### 6.4 Memory Hermes versus memori governance

Memory dan skill self-improvement Hermes berguna untuk produktivitas, tetapi ia dapat menyimpan asumsi yang sudah usang atau konteks lintas chain. Ini tidak boleh memiliki kedudukan setara artefak yang RATIFIED/LOCKED.

**Policy yang disarankan:** state Sigma, artifact terkunci, dan mailbox Sigma selalu mengalahkan memory Hermes. Untuk task baru, dispatcher harus menyuntikkan orientasi Sigma terbaru dan membatasi memory role bila perlu.

### 6.5 Scheduler dan idempotensi

Cron Hermes membuat agen baru tanpa history, sementara Bot/gateway dapat pula menerima pesan pada saat yang sama. Jika keduanya dipakai tanpa single-writer policy, plan atau DEV dapat dipicu lebih dari sekali.

**Mitigasi:** trigger Hermes tidak langsung membuka kerja. Ia harus memanggil dispatcher Sigma yang mengklaim lease chain secara atomik dan memakai idempotency key berdasarkan chain, stage, dan artifact version.

## 7. Alternatif integrasi

### A. Sigma dispatcher memanggil Hermes — direkomendasikan

`sigma-agent` mendeteksi state dan menjalankan Hermes profile yang tepat. Hermes menjadi executor/headless agent; Sigma tetap mengatur queue, evidence, dan resume.

- Kelebihan: batas otoritas jelas, migrasi bertahap, sesuai Blueprint.
- Kekurangan: perlu adapter/process supervisor dan kontrak hasil kerja.

### B. Plugin Hermes sebagai adapter Sigma

Plugin Hermes menambah tool untuk membaca queue Sigma dan mengirim hasil ke dispatcher. Cocok setelah kontrak approval/evidence stabil.

- Kelebihan: UX Hermes lebih native; notifikasi/gateway mudah dimanfaatkan.
- Kekurangan: coupling pada API plugin Hermes dan risiko tool write terlalu luas.

### C. Hermes sebagai source of truth pipeline — tidak direkomendasikan

Cron, profile memory, Bot Mode, atau group chat Hermes dijadikan state lifecycle utama.

- Ditolak karena: memindahkan authority dari kernel Sigma ke runtime agen, menyulitkan audit artifact/hash, dan melanggar prinsip “kernel enforces; agents propose.”

## 8. Urutan eksperimen yang disarankan

1. **Read-only lab:** satu profile Hermes dengan `sigma-mcp` stdio; verifikasi bahwa agent dapat membaca orientation dan role memory tanpa command tulis Sigma.
2. **Role profile lab:** buat profile terpisah untuk ARC/FMN/DEV/AUD dengan capability minimal; uji bahwa state Hermes memang terisolasi antarprofile.
3. **DEV sandbox lab:** jalankan profile DEV dalam Docker terhadap worktree disposable; verifikasi safe root, tidak adanya secret, batas CPU/memori, dan cleanup.
4. **Control-plane prototype:** sebelum auto-run, implementasikan approval queue Sigma serta request hash binding. Uji approve/reject dari channel notifikasi Hermes tanpa memberi Hermes kemampuan mengunci langsung.
5. **Evidence prototype:** dispatcher Sigma menjalankan test contract di sandbox Hermes, menangkap output terbatasi dan menyimpan evidence record Sigma.
6. **Pilot single DEV:** hanya satu trigger plan LOCKED → DEV sandbox → evidence → pending approval. Tidak ada FMN/AUD automation sampai pilot ini stabil.

## 9. Keputusan terbuka sebelum implementasi

1. Apakah Hermes akan dijalankan lokal, di Docker lokal, VPS, atau cloud sandbox?
2. Kanal mana yang menjadi interface Director untuk approval: Desktop, Telegram, Slack, atau lainnya?
3. Bagaimana autentikasi Director dibuktikan dan diikat ke record approval Sigma?
4. Bagaimana control-plane Sigma dibedakan dari DEV worktree?
5. Apakah agent diberi terminal shell umum, atau hanya tool Sigma/adapter yang dibatasi capability-nya?
6. Apakah memory Hermes diaktifkan untuk semua peran, dan bagaimana stale memory diatasi?
7. Provider/model apa yang dipilih per peran serta bagaimana budget dibatasi lintas provider?

## 10. Best practices Hermes yang terverifikasi

### 10.1 Konteks, instruksi, dan prompt

- Gunakan `SOUL.md` hanya untuk identitas dan perilaku dasar profile Hermes. Gunakan `AGENTS.md` pada root proyek untuk instruksi teknis yang berulang dan project-specific. Hermes memuat konteks proyek secara otomatis; file harus ringkas karena masuk ke prompt setiap sesi.
- Berikan prompt yang spesifik: target, path, error, hasil yang diharapkan, batasan, dan cara verifikasi. Ini terutama penting untuk cron dan subagen karena keduanya tidak membawa seluruh konteks percakapan induk.
- Jangan menaruh state chain, keputusan Director, atau isi artifact Sigma yang mutable di `SOUL.md` atau global memory. Semua itu harus dibaca ulang dari control-plane Sigma pada saat kerja dimulai.

### 10.2 Profile dan memory

- Satu profile Hermes harus dimiliki satu agen/proses aktif. Dokumentasi Hermes memperingatkan agar dua proses tidak menulis ke `HERMES_HOME` yang sama karena memory otomatis akan bercampur.
- Profile cocok untuk memisahkan ARC, FMN, DEV, dan AUD; tetapi profile bukan boundary filesystem. Gunakan profile untuk isolation state Hermes, bukan untuk security containment.
- Built-in memory dibatasi dan disuntikkan sebagai snapshot pada awal session. Memory yang diubah di tengah sesi tidak mengubah prompt sampai sesi berikutnya.
- Untuk profile Sigma, aktifkan `memory.write_approval: true` pada tahap awal. Ini membuat perubahan memory ditinjau/staged dan mencegah agent menyimpan asumsi proyek sebagai knowledge permanen tanpa kontrol.
- Untuk AUD, rekomendasi awal adalah memory proyek dinonaktifkan atau dikosongkan per engagement; AUD harus bertumpu pada bukti yang disediakan dan state Sigma, bukan recall dari audit sebelumnya.

### 10.3 Skills dan subagen

- Skills cocok untuk prosedur berulang; memory untuk fakta. Jangan mencampur keduanya.
- Service profile yang menjalankan Sigma hanya boleh memakai skill yang dikurasi dan versioned. Jangan mengizinkan instalasi skill dari URL/Hub secara otonom pada profile produksi.
- Delegasi Hermes berguna untuk riset atau pekerjaan paralel non-otoritatif, tetapi tidak boleh menjadi dispatcher Sigma. Delegasi terikat pada proses/session induk dan dapat terhenti ketika session ditutup atau Hermes restart.
- Ringkasan subagen bukan evidence. Hasil harus diverifikasi ulang oleh kernel Sigma atau oleh perintah evidence yang dijalankan dispatcher.

### 10.4 Gateway, cron, dan notifikasi

- Gateway yang memiliki terminal atau capability proyek harus memakai allowlist pengguna eksplisit atau DM pairing. Jangan gunakan mode semua pengguna diizinkan.
- Tetapkan satu home channel untuk notifikasi, tetapi gunakan kanal terpisah untuk escalation/error agar approval queue tidak bercampur dengan noise operasional.
- Cron Hermes selalu memulai agent session baru tanpa history; prompt cron harus self-contained. Untuk Sigma, cron hanya boleh menjalankan *tick* dispatcher atau watcher baca-saja, bukan langsung mengizinkan role membuka/mengunci artefak.
- Gunakan `SIGMA_REQUEST_ID`, chain/version, dan idempotency key pada setiap notifikasi/trigger. Pesan Hermes harus diperlakukan sebagai transport, bukan record approval.

### 10.5 Model, biaya, dan perubahan runtime

- Pilih model utama per profile berdasarkan peran dan uji empiris, bukan nama model yang dianggap permanen. Hermes memisahkan model utama dari model auxiliary.
- Pin model auxiliary yang lebih murah/cepat untuk kompresi, title generation, web extract, approval scoring Hermes, dan routing MCP. Namun approval scoring Hermes tidak boleh memutuskan approval governance Sigma.
- Hindari model tier yang mengizinkan training data untuk automation unattended kecuali Director membuat keputusan eksplisit. Hermes sendiri gagal tertutup untuk tier ini sampai acknowledgement persisten dicatat.
- Hindari model switch di tengah sesi panjang karena cache prompt di-reset dan biaya input dapat meningkat. Lakukan switching pada awal sesi atau session baru.
- Token/cost analytics Hermes adalah estimasi lokal bawah dan tidak mencakup seluruh retry, fallback, maupun auxiliary call. Ia tidak cukup untuk menjadi pencatatan budget governance; dispatcher Sigma tetap perlu budget ledger sendiri.

## 11. Konfigurasi yang direkomendasikan

### 11.1 Prinsip konfigurasi

Konfigurasi berikut adalah baseline desain, bukan file yang dapat langsung diterapkan. Nilai image, limit resource, model, provider, project path, dan network policy harus diputuskan per deployment.

| Area | Hermes umum | Profile Sigma |
|---|---|---|
| `SOUL.md` | Identitas agen umum | Peran Sigma dasar, tanpa state/keputusan proyek |
| Profile | Boleh satu profile personal | Satu profile per role atau executor |
| Terminal | Local hanya untuk pekerjaan tepercaya | DEV: Docker/cloud sandbox; AUD: read-only/no write |
| `terminal.cwd` | Lokasi kerja default bila dibutuhkan | Diikat dispatcher ke project root atau DEV worktree terverifikasi |
| `HOME` subprocess | `auto` praktis untuk personal use | `profile` bila perlu isolasi CLI identity; container lebih disukai |
| Memory | Bebas atau approval sesuai preferensi | `write_approval: true`; no project governance state |
| MCP | Tool umum sesuai kebutuhan | `sigma-mcp` read-only hanya saat binding proyek valid |
| Gateway | Pairing/allowlist | Allowlist Director; hanya notifikasi/approval UI, bukan writer governance |
| Cron | Automasi personal | Dispatcher tick/read-only watcher; tidak memutus lifecycle |

### 11.2 Baseline profile DEV Sigma

Untuk pilot DEV otonom, rekomendasi minimum adalah:

```yaml
# Ilustrasi policy profile sigma-dev; sesuaikan nilai dengan deployment.
terminal:
  backend: docker
  cwd: /path/yang-ditentukan-dispatcher/ke-worktree
  home_mode: profile
  timeout: 180
  env_passthrough: []
  docker_network: false        # buka hanya jika test contract memerlukan egress
  container_cpu: 1
  container_memory: 5120
  container_disk: 51200
  container_persistent: false  # satu sandbox baru per session/pilot

approvals:
  mode: manual
  cron_mode: deny
  single_query_mode: deny
  unattended_mode: deny

memory:
  write_approval: true
```

Catatan penting:

- Docker menghilangkan dangerous-command check karena container menjadi security boundary. Oleh sebab itu, image, mount, network, environment, dan resource limit harus diperlakukan sebagai policy keamanan utama.
- Mount hanya worktree DEV yang disposable. Jangan mount control-plane Sigma, home Director, credential store, atau seluruh workspace.
- Default `docker_network: false` adalah posisi aman untuk build/test yang tidak perlu jaringan. Jika dependency install atau test membutuhkan egress, buka network secara sempit dan dokumentasikan alasannya dalam test contract/evidence policy.
- Jangan memakai `docker_extra_args` untuk menimpa hardening Hermes kecuali ada kebutuhan yang diverifikasi. Dokumentasi menyatakan flag tambahan dapat melemahkan isolation secara diam-diam.
- Untuk kebutuhan persistensi dependency cache, gunakan cache/image build yang dikontrol, bukan container lintas role atau lintas proyek. Container persistent Hermes dapat dipakai untuk development pribadi, tetapi tidak ideal sebagai boundary pilot otonom lintas session.

### 11.3 Profile ARC, FMN, dan AUD

- **ARC:** interaktif dengan Director; terminal write tidak diperlukan secara default. Profile dapat memiliki gateway dan context project setelah binding valid.
- **FMN:** dapat membaca project dan menulis draft artifact melalui capability sempit. Jangan memberinya shell yang dapat memanggil lock/ratify langsung.
- **AUD:** profile paling ketat: no terminal write, no mutable project memory, MCP Sigma baca-saja, dan artifact/evidence diberikan eksplisit oleh dispatcher sesuai scope audit.

### 11.4 Konfigurasi global yang tidak direkomendasikan

- Jangan memakai `SOUL.md` global untuk mewajibkan seluruh Hermes mengikuti Sigma.
- Jangan memasang `sigma-mcp` dan tool tulis Sigma pada default profile yang dipakai untuk pekerjaan non-Sigma.
- Jangan memakai `/etc/hermes` managed scope untuk memaksakan governance Sigma kepada semua proyek. Managed scope boleh dipakai hanya untuk baseline keamanan mesin, misalnya secret redaction atau provider endpoint; dokumentasi Hermes sendiri menyatakan mekanismenya bukan sandbox yang tidak dapat dielakkan.
- Jangan mengaktifkan YOLO mode, allowlist command permanen secara luas, atau `approve` untuk cron/unattended context pada profile yang memiliki akses proyek.
- Jangan menggunakan memory Hermes atau group chat sebagai state lifecycle/approval queue.

### 11.5 Operasi dan pemeliharaan

1. Gunakan `hermes config check` setelah update dan `hermes config migrate` hanya setelah meninjau perubahan konfigurasi.
2. Uji update Hermes di profile/lab non-produksi terlebih dahulu. Gunakan backup pra-update; jangan memilih perilaku update non-interaktif yang membuang perubahan lokal pada environment pengembangan.
3. Tetapkan version pin atau release-validation policy untuk profile Sigma. Perubahan Hermes dapat mengubah tool schema, model routing, prompt assembly, dan perilaku sandbox.
4. Pantau log gateway dan state database; WAL SQLite cocok pada filesystem lokal, tetapi dokumentasi mengingatkan bahwa filesystem jaringan/virtiofs tertentu memerlukan mode `delete`.
5. Terapkan kebijakan satu writer bagi profile, dispatcher, approval queue, dan chain Sigma. Penyimpanan Hermes yang tahan contention tidak menghilangkan kebutuhan single-writer untuk state governance Sigma.

## 12. Sumber primer

1. [Hermes Agent Documentation](https://hermes-agent.nousresearch.com/docs) — overview, feature set, install, runtime entry points.
2. [Hermes Architecture](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture) — runtime, gateway, session persistence, cron, plugin system.
3. [Profiles: Running Multiple Agents](https://hermes-agent.nousresearch.com/docs/user-guide/profiles) — isolation state profile dan batasnya.
4. [Bot Mode](https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode) — bot-to-bot delivery, retries, multi-machine operation.
5. [MCP Integration](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp) — stdio/HTTP, filtering, sanitization, identity header.
6. [Security](https://hermes-agent.nousresearch.com/docs/user-guide/security) — command approval, safe root, container isolation, credential filtering.
7. [Git Worktrees](https://hermes-agent.nousresearch.com/docs/user-guide/git-worktrees) — `hermes -w` dan workflow parallel.
8. [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) — repository resmi dan lisensi MIT.
9. [Configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration) — precedence config, terminal backend, update, working directory, database.
10. [Tips & Best Practices](https://hermes-agent.nousresearch.com/docs/guides/tips) — konteks, memory/skill, cost, messaging, dan security practice.
11. [Persistent Memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory) — batas, approval write, scan, dan isolasi memory.
12. [Configuring Models](https://hermes-agent.nousresearch.com/docs/user-guide/configuring-models) — slot main/auxiliary, cache, training tier, dan fallback.
13. [Managed Scope](https://hermes-agent.nousresearch.com/docs/user-guide/managed-scope) — policy global serta limit enforcement-nya.
14. [Automate Anything with Cron](https://hermes-agent.nousresearch.com/docs/guides/automate-with-cron) — sifat fresh-session dan desain prompt cron.
15. [Delegation & Parallel Work](https://hermes-agent.nousresearch.com/docs/guides/delegation-patterns) — limit, lifecycle, dan verifikasi hasil subagen.
16. [Working with Skills](https://hermes-agent.nousresearch.com/docs/guides/work-with-skills) — progressive loading dan instalasi skill.
