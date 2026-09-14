# Proposal — Security Boundaries untuk Hermes

**Status:** DRAFT untuk review Director  
**Tanggal:** 12 September 2026  
**Cakupan:** Hermes pada PC Windows Director; komunikasi CLI dari laptop dan Telegram dari ponsel; DeepSeek API; delegasi Claude Code/Codex; serta proyek Sigma yang terikat secara eksplisit.

## 1. Keputusan utama yang direkomendasikan

Hermes tidak boleh dipercaya hanya karena memiliki persona, role behaviour, atau prompt yang baik. Ia harus diperlakukan sebagai sistem yang menerima input tidak tepercaya dan dapat menjalankan tool berdaya tinggi pada PC Director.

Keamanan harus diterapkan dalam urutan berikut:

```text
Identitas dan scope
    → capability minimum
    → sandbox / privilege boundary
    → approval untuk tindakan material
    → evidence dan audit
    → emergency stop dan recovery
```

Prinsip dasarnya:

> **Tidak ada instruksi, memory, role, atau approval percakapan yang dengan sendirinya memberikan akses. Akses harus berasal dari policy teknis yang eksplisit, terikat scope, dan dapat dicabut.**

Ini mengikuti model defense-in-depth Hermes—authorization gateway, command approval, file-write safety, sandbox, credential filtering MCP, pemindaian injection, dan isolasi sesi—tetapi menambah batas yang diperlukan oleh desain Sigma. [Hermes Security](https://hermes-agent.nousresearch.com/docs/user-guide/security)

## 2. Threat model yang relevan

| Ancaman | Jalur serangan | Dampak utama | Batas yang diperlukan |
|---|---|---|---|
| Akun Telegram atau ponsel Director diambil alih | Pesan tampak datang dari Director | Perintah terminal, perubahan source, atau kebocoran data | Allowlist, trust tier channel, approval kuat untuk tindakan material, kill switch |
| Prompt injection tidak langsung | Web page, issue, PDF, log, source code, MCP result, atau pesan role | Hermes mengubah tujuan, memakai tool, atau mengeksfiltrasi data | Semua konten eksternal dianggap data, bukan instruksi; capability minimum; approval write/egress |
| Credential leakage | `.env`, token Telegram, API key, token OAuth Claude/Codex, log, memory, MCP child process | Pengambilalihan provider atau akses proyek | Secret isolation, redaction, ACL, filtering environment, rotation |
| Tool overreach | Terminal lokal, PowerShell, Git, browser, desktop automation, delegated CLI | Kerusakan PC, perubahan sistem, publikasi, atau data loss | Sandbox, allow/deny policy, capability profile, action tier |
| Cross-project leakage | Memory, session, worktree, dispatcher, fallback provider | Scope atau data proyek A masuk ke proyek B/non-Sigma | Explicit binding, per-project runtime state, memory segregation |
| Supply-chain / plugin compromise | MCP, plugin, package install, skill, script, agent output | Arbitrary execution atau credential exfiltration | Allowlist dependency, review/pin, isolated tool environment, no auto-install |
| Automation loop / duplicated worker | Cron, dispatcher, retry, child agent | Action ganda, spam, biaya, state Sigma inkonsisten | Claim/lease, idempotency ledger, rate/cost limit, circuit breaker |
| Akses fisik/offline ke PC | PC Windows yang mati/terkunci dicuri atau dimodifikasi | Akses disk dan credential lokal | BitLocker, TPM/Secure Boot, Windows account security, recovery-key policy |

OWASP secara khusus mengidentifikasi indirect prompt injection, tool pivot, memory poisoning, dan privilege yang terlalu luas sebagai risiko agentic AI. Batas teknis harus memisahkan input tidak tepercaya dari capability yang dapat menghasilkan efek nyata. [OWASP Agentic AI Top 10](https://genai.owasp.org/download/52117/)

## 3. Security invariants

1. **Director adalah satu-satunya identitas manusia berotoritas.** Telegram username, isi pesan, nama file, dan text “approved” bukan bukti otoritas yang cukup tanpa channel identity dan policy yang berlaku.
2. **Tidak ada auto-bind proyek.** Current working directory, nama repository, memory, atau isi pesan tidak dapat mengaktifkan capability Sigma.
3. **Tidak ada secret dalam prompt atau memory.** Secret hanya berada dalam credential store/secret file dengan ACL; log dan laporan harus redacted.
4. **Tidak ada terminal host umum dari Telegram.** Kanal ponsel tidak boleh menjadi shell remote terselubung.
5. **Tidak ada approval governance yang digantikan approval tool.** Approval Hermes hanya mengizinkan aksi runtime; approval Sigma tetap direkam control plane Sigma.
6. **Tidak ada write, egress, atau delegasi lintas provider secara implisit.** Ketiganya memerlukan scope dan policy eksplisit.
7. **Tidak ada privilege admin permanen untuk Hermes.** Elevasi sistem selalu just-in-time dan dikonfirmasi Director melalui channel trust tinggi.
8. **State Sigma lebih otoritatif daripada Hermes.** Memory, ledger dispatcher, dan ringkasan Hermes tidak dapat menggantikan state, artifact, approval, atau inbox Sigma.
9. **Gagal tertutup untuk aksi material.** Jika state, scope, identity, approval, atau evidence tidak dapat dipastikan, Hermes berhenti atau hanya melakukan discovery read-only.

## 4. Trust tier untuk media Director

Tidak semua channel mempunyai nilai autentikasi yang sama. Pesan Telegram yang sah tetap merupakan input remote yang dapat berasal dari ponsel yang hilang atau akun yang diambil alih.

| Tier | Channel / keadaan | Aksi yang dapat diminta | Aksi yang dilarang tanpa eskalasi tier |
|---|---|---|---|
| **T0 — Untrusted** | Web, webhook, email eksternal, issue, source code, file, output MCP, pesan dari user tidak diizinkan | Discovery tanpa credential, ekstraksi, draft, atau laporan | Write, terminal berbahaya, akses secret, network egress, perubahan memory/policy |
| **T1 — Telegram Director** | Telegram dengan numeric allowlist eksklusif Director | Diskusi, status, pekerjaan read-only, scheduling, bounded action yang telah didelegasikan | Security-policy change, secret/credential action, system config, destructive action, publish, risk acceptance material |
| **T2 — CLI laptop via jaringan privat** | CLI yang terhubung ke runtime PC yang sama dan user telah terautentikasi | Approval teknis terbatas, review evidence penuh, perubahan yang telah diberi mandate | Elevasi administrator, perubahan trust root, credential rotation, tindakan irreversible tanpa konfirmasi tambahan |
| **T3 — Sesi Windows lokal/RDP Director** | Windows login manual Director, dengan OS identity/UAC bila diperlukan | Tindakan sistem, keamanan, credential, deployment, dan recovery setelah decision packet | Tidak ada bypass terhadap Sigma sovereign decision atau hard deny policy |

Tingkat ini tidak menggantikan autonomy budget. Ia menambah syarat channel untuk tindakan bernilai tinggi. Contohnya, Telegram dapat meminta “siapkan opsi migrasi”, tetapi Hermes meminta konfirmasi T2/T3 untuk mengubah firewall Windows, memutar token, memasang software, mengubah gateway profile, atau mengirim data proyek ke provider baru.

## 5. Identity, remote access, dan Windows host

### 5.1 Windows account dan boot boundary

- Jangan menonaktifkan sign-in Windows dan jangan memberi password Windows kepada Hermes.
- Hermes utama tidak dijalankan sebagai Administrator atau LocalSystem secara permanen.
- Untuk pilot, jalankan Hermes pada akun Windows Director yang tidak memiliki elevation aktif; UAC/elevation tetap meminta tindakan Director saat memang diperlukan.
- Target penguatan berikutnya adalah akun Windows standard terpisah untuk runner Hermes. Ini hanya layak setelah repo, worktree, dan login Claude/Codex dapat dipisahkan tanpa mengurangi auditability. Jangan membuat akun service sebagai Administrator demi kenyamanan.
- Jangan memakai Windows Service pre-login yang memiliki akses penuh ke repo/credential. Jika suatu hari diperlukan relay pre-login, ia harus menjadi profile/headless service terpisah dengan toolset status-only.

Windows 11 menyediakan Administrator protection sebagai pola least privilege: aplikasi tetap deprivileged dan elevasi membutuhkan persetujuan eksplisit pengguna. Prinsip yang sama harus diterapkan pada Hermes. [Microsoft Administrator Protection](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/administrator-protection/)

### 5.2 Remote login Director

- Wake-on-LAN hanya menyalakan PC; Hermes tidak boleh mengisi layar sign-in Windows.
- Gunakan remote desktop privat untuk login manual Director, bukan RDP yang diekspos ke internet.
- Bila PC memakai Windows Pro/Enterprise/Education, kandidat utama adalah Windows App/RDP di atas Tailscale, Network Level Authentication aktif, dan hanya akun Director yang diizinkan.
- Jangan membuka port `3389` dengan port forwarding. Tailscale menghindari public exposure dan membuat ponsel/laptop serta PC berada dalam jaringan privat terenkripsi.
- Aktifkan MFA pada identity pengelola jaringan privat dan proteksi kuat pada akun Microsoft/Google/Apple yang menjadi identity provider-nya.

Microsoft menyatakan Network Level Authentication direkomendasikan untuk RDP; Tailscale mendokumentasikan akses RDP tanpa public IP maupun port forwarding. [Microsoft Remote Desktop](https://learn.microsoft.com/en-us/windows-server/remote/remote-desktop-services/remotepc/remote-desktop-allow-access), [Tailscale Windows RDP](https://tailscale.com/docs/solutions/access-remote-desktops-using-windows-rdp)

### 5.3 Host hardening minimum

- BitLocker aktif pada volume sistem, recovery key disimpan di lokasi yang tidak dapat dibaca Hermes, dan TPM/Secure Boot diverifikasi.
- Windows Update dan Microsoft Defender aktif; Windows Firewall tidak dimatikan untuk mempermudah integrasi.
- Hindari menjalankan PC Hermes dengan akun yang selalu memiliki token administrator aktif.
- Akses fisik, recovery key, password manager, serta perangkat ponsel Director masuk ke scope keamanan Hermes karena semuanya dapat membuka host atau identity.

Microsoft merekomendasikan BitLocker pada perangkat dengan TPM dan menjelaskan bahwa Secure Boot/TPM melindungi kunci saat startup. [Microsoft BitLocker](https://learn.microsoft.com/en-us/windows/security/operating-system-security/data-protection/bitlocker/countermeasures)

## 6. Gateway Telegram dan ingress

### 6.1 Policy wajib

- Gunakan satu Telegram bot private untuk Director pada fase awal.
- Isi `TELEGRAM_ALLOWED_USERS` hanya dengan numeric user ID Director. Jangan gunakan `TELEGRAM_ALLOW_ALL_USERS` atau global allow-all.
- Jangan menambahkan bot ke grup, forum, atau inline mode pada fase awal. Bila group dibutuhkan kelak, gunakan chat allowlist dan `require_mention`.
- Unknown DM disarankan `ignore`, bukan pairing, untuk bot pribadi berdaya tinggi. Pairing hanya digunakan bila Director sengaja ingin menambah identitas lain.
- Token bot disimpan sebagai secret; tidak masuk ke repo, message body, screenshot, artifact, atau memory. Rotasi token segera bila ada dugaan exposure.
- Semua attachment, voice transcription, URL, dan pesan yang masuk tetap dianggap T0 content meskipun pengirimnya Director; instruksi di dalam dokumen tidak otomatis menjadi mandat.

Hermes secara default menolak user yang tidak diizinkan bila tidak ada allowlist. Telegram authorization menggunakan numeric user ID, bukan username. [Hermes Security](https://hermes-agent.nousresearch.com/docs/user-guide/security), [Telegram Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram)

### 6.2 Batas tool per channel

- Telegram hanya mendapat profile `director-gateway`; jangan memberikan profile ini toolset terminal host penuh secara default.
- Telegram boleh meminta status, membaca artifact yang telah diizinkan, memulai diskusi, menjadwalkan check yang aman, atau melanjutkan delegated workflow.
- Browser, terminal, filesystem write, desktop automation, credential management, Git publish, provider/model change, dan plugin/MCP management harus off atau capability-gated pada Telegram.
- Approval request dari Telegram hanya berlaku untuk tindakan di tier T1. Perintah material harus meminta konfirmasi ulang melalui T2/T3 dan menyertakan decision packet.
- Webhook dan API server tidak pernah memperoleh capability write/destructive; `unattended_mode` harus deny.

## 7. Execution boundary dan action tier

### 7.1 Kelas tindakan

| Kelas | Contoh | Default capability | Approval / evidence |
|---|---|---|---|
| **E0 — Observe** | Baca status, artifact, inbox, diff, log yang diizinkan | Read-only | Tidak perlu approval per aksi; audit event dicatat |
| **E1 — Bounded reversible** | Buat draft di sandbox, test, retry aman, edit worktree disposable | Scope/worktree spesifik | Autonomy envelope + evidence hasil |
| **E2 — Project write** | Ubah source dalam locked plan, buat artifact draft, update worktree | DEV/project-bound capability | Gate Sigma, test contract, evidence, dan policy write |
| **E3 — External/irreversible** | Push/publish, deploy, migrasi data, kirim data ke layanan baru, hapus material | Disabled by default | Decision Director T2/T3 + approval runtime eksplisit + rollback/impact record |
| **E4 — Security/system authority** | Ubah firewall, UAC, Windows service, credential, account, plugin/MCP policy, remote-access setting | Hard denied by default | Director T3, change plan, backup/rollback, dan jejak audit; beberapa aksi tetap manual-only |

Kelas ini berlaku di luar maupun di dalam proyek Sigma. Pada proyek Sigma, E2 juga dibatasi state/gate Sigma; E3 dan E4 tidak berubah menjadi otomatis hanya karena plan telah locked.

### 7.2 Terminal dan sandbox

- Default terminal untuk gateway Telegram adalah Docker atau sandbox setara, bukan `local` host.
- Satu tugas menerima mount worktree yang spesifik; jangan mount seluruh profile Windows, seluruh disk, atau seluruh koleksi proyek.
- Docker credential forwarding harus opt-in per environment variable. Jangan meneruskan token provider, SSH, GitHub, atau Telegram ke sandbox kecuali task benar-benar membutuhkannya.
- Host-local terminal hanya diizinkan untuk runner terpilih yang memerlukan Claude Code/Codex atau tool Windows, dengan root/worktree, command class, dan timeout yang dibatasi.
- Desktop automation off secara default. Ia diaktifkan hanya pada sesi Windows user aktif, task sempit, dan approval yang eksplisit.
- Tidak ada `approvals.mode: off`, `--yolo`, `--dangerously-skip-permissions`, atau pola setara pada profile Director gateway.

Hermes mendukung terminal Docker yang persistent dan memperingatkan bahwa credential yang diteruskan menjadi terlihat dari dalam container. Untuk deployment gateway, dokumentasinya merekomendasikan backend terisolasi daripada local host. [Hermes Configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration), [Hermes Security](https://hermes-agent.nousresearch.com/docs/user-guide/security)

### 7.3 Approval policy Hermes

- Mulai dengan `approvals.mode: manual` pada profile utama sampai command policy telah diuji.
- `cron_mode`, `single_query_mode`, dan `unattended_mode` harus `deny`.
- Permanent allowlist tidak boleh berisi wildcard untuk shell, PowerShell, `sudo`, `rm`, installer/package manager, registry, service manager, Git push, atau command credential.
- Hard deny harus mencakup penghapusan recursive di luar disposable workspace, perubahan disk/boot, account/user management, firewall/security product changes, secret reads/dumps, dan disable audit/logging.
- Approval “always” dari chat tidak boleh langsung menjadi permanent allowlist. Perubahan allowlist harus berupa proposal yang ditinjau di T2/T3.
- Approval teknis yang rutin tidak sama dengan Director approval Sigma. Keduanya disimpan dan dinilai secara terpisah.

Hermes defaultnya menolak dangerous command pada cron, single-query, dan unattended context; mode `off` menghilangkan seluruh safety prompt. [Hermes Approval Policy](https://hermes-agent.nousresearch.com/docs/user-guide/security)

## 8. Project, Sigma, dan role boundary

- Binding memerlukan `project_id` dan root eksplisit; Hermes tidak boleh menebak proyek dari current directory, chat history, atau nama repository.
- Setiap proyek memiliki worktree/runtime state, dispatch ledger, log, dan M3 working memory sendiri.
- Hanya role Sigma yang sah dan teraktivasi dapat membaca inbox role lalu mengirim `sigma send`; Hermes dispatcher tidak menandai pesan `READ` saat polling.
- Semua perubahan state Sigma memakai CLI/control plane yang valid; file state, registry, artifact generated, dan message index tidak boleh diedit langsung.
- Hermes global tidak membawa approval, risk acceptance, scope, evidence, atau fakta proyek dari satu binding ke binding lain.
- AUD Sigma menerima capability paling sempit: evidence yang diberi mandat, read-only, tidak ada crawling bebas, tidak ada persistent project memory minimum yang dapat merusak independensi.

## 9. Data, provider, memory, dan log boundary

### 9.1 Klasifikasi data

| Kelas data | Contoh | Boleh ke DeepSeek / provider eksternal? | Penyimpanan Hermes |
|---|---|---|---|
| **D0 Public** | Dokumentasi publik, kode open source, pengetahuan umum | Ya, bila task membutuhkan | Dapat berada di session normal |
| **D1 Internal rendah** | Ringkasan desain non-rahasia, metadata proyek | Hanya bila policy proyek mengizinkan | Terikat proyek, retention terbatas |
| **D2 Confidential** | Source proprietary, issue privat, roadmap, konfigurasi internal | Default tidak; perlu allowlist data/provider eksplisit | Project-bound dan encrypted at rest bila tersedia |
| **D3 Secret/restricted** | API key, OAuth token, `.env`, private key, password, recovery key, personal data sensitif | Tidak pernah | Credential store/secret manager; tidak masuk memory, prompt, artifact, atau log |

Sampai data-processing policy DeepSeek ditinjau secara terpisah, anggap setiap payload API sebagai data yang keluar dari PC. Hermes harus menyaring D3 dan tidak mengirim D2 secara default.

### 9.2 Credential policy

- Pisahkan credential Telegram, DeepSeek, Claude Code, Codex, Git/SSH, MCP, dan Windows. Tidak ada satu `.env` yang diberikan ke seluruh profile atau sandbox.
- Gunakan ACL Windows yang membatasi file credential hanya ke account/profile yang memerlukannya; jangan menyimpan token dalam repository, shared folder, atau plaintext note.
- MCP subprocess menerima environment allowlist minimal. Jangan meneruskan `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, token Telegram, atau SSH key secara global.
- Rotasi/revoke credential adalah tindakan E4; Hermes dapat menyiapkan langkah tetapi tidak memutarnya sendiri dari Telegram.
- Provider failure tidak boleh menyebabkan fallback lintas-provider bila payload mengandung D2/D3 atau policy provider belum disetujui.

### 9.3 Memory dan log

- `memory.write_approval` atau kontrol setara harus aktif bagi profile yang dapat menangani proyek Sigma.
- M0 global hanya menyimpan preferensi Director yang eksplisit dan non-rahasia. M3 project-bound tidak dipromosikan otomatis ke memory global.
- Memory, skill, prompt, dan file konfigurasi yang baru/diubah diperlakukan sebagai code/config change: scan injection, review, approval, versioning, dan rollback.
- Log harus menyimpan actor/channel, project binding, tool/action class, approval reference, outcome, dan evidence reference—tanpa plaintext secret atau isi data D3.
- Retention, export, backup, dan penghapusan log harus memiliki policy; backup yang menyimpan credential harus terenkripsi dan aksesnya dibatasi.

Hermes menyediakan filtering credential untuk MCP subprocess serta optional approval/scan untuk perubahan skill, tetapi policy project isolation dan retention tetap harus ditambahkan oleh desain ini. [Hermes Security](https://hermes-agent.nousresearch.com/docs/user-guide/security), [Hermes Configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration)

## 10. Delegasi, MCP, plugin, dan external agent boundary

### 10.1 Claude Code dan Codex

- Claude Code/Codex adalah specialist executor, bukan sumber otoritas governance dan bukan trusted root.
- Delegasi selalu menggunakan task envelope: project binding, scope, non-scope, root/worktree, tool/capability, data class, autonomy budget, expected evidence, dan callback reference.
- Jangan mengirim memory global, credential provider Hermes, seluruh repository, atau seluruh history percakapan ke child agent.
- Output agent dianggap untrusted until verified. Hermes/role utama memeriksa diff, test, evidence, serta deviasi sebelum menyatakan hasil.
- Tidak ada delegated `git push`, publish, deploy, provider/model setting, credential management, atau perubahan Sigma state tanpa policy dan approval yang relevan.

### 10.2 MCP dan plugin

- Install MCP/plugin hanya dari source yang telah ditinjau dan diizinkan Director; pin version/commit bila dimungkinkan.
- Server MCP diberi allowlist tool paling kecil, timeout, scope filesystem/network terbatas, serta environment credential minimum.
- Tidak ada auto-install package/skill/plugin dari instruksi web, issue, atau model output.
- Gateway injection plugin tetap disabled kecuali plugin secara eksplisit ditinjau dan dipercaya.
- `sigma-mcp` hanya tersedia pada profile yang telah bound ke proyek Sigma; capability write governance tidak boleh ditawarkan melalui MCP.

## 11. Automation dan dispatch safety

- Cron tidak menjalankan perubahan material tanpa interactive approval; default headless policy adalah deny.
- Mailbox Dispatcher hanya melakukan discovery read-only sebelum role intake. Ia tidak mengubah `UNREAD` menjadi `READ` atas namanya sendiri.
- Claim/lease mailbox diperlukan sebelum lebih dari satu dispatcher/scheduler dapat menangani proyek yang sama.
- Semua job memiliki concurrency cap, idempotency key, deadline, retry budget, cost budget, dan delivery target allowlist.
- Circuit breaker mematikan automation setelah failure berulang, error authorization, evidence mismatch, cost threshold, atau indikasi prompt injection/exfiltration.
- Tidak ada cron global yang memindai semua proyek/direktori untuk “membantu”. Hanya proyek Sigma dengan binding eksplisit yang dapat dipantau.

## 12. Emergency stop dan recovery

| Situasi | Tindakan segera | Kondisi pemulihan |
|---|---|---|
| Telegram/personal device diduga kompromi | Pause gateway; revoke Telegram authorization/token; cabut session remote | Identity Director diverifikasi dan token/allowlist diperbarui |
| Provider/MCP key diduga bocor | Revoke/rotate key dari dashboard provider; hentikan profile yang memakai key | Secret baru terpasang, log diperiksa, scope akses diperketat |
| Hermes berperilaku tidak sesuai scope | Stop gateway dan child process; cabut capability/profile binding | Incident review, evidence review, policy/test diperbarui |
| Sigma state/mailbox conflict | Pause dispatcher, jangan repair manual | Baca state otoritatif, jalankan check, lakukan repair hanya lewat jalur yang diizinkan |
| Windows host diduga kompromi | Putuskan jaringan privat/remote access, jangan percaya credential lokal | Investigasi host, rotate credential dari perangkat bersih, reimage bila perlu |

Kontrol darurat minimum yang perlu tersedia bagi Director: menghentikan gateway, menghentikan child agent, menonaktifkan Telegram bot/token, mencabut device jaringan privat, mencabut provider key, serta melihat audit log. Semua harus dapat dilakukan tanpa meminta Hermes yang mungkin sedang bermasalah.

## 13. Baseline implementasi yang direkomendasikan

Prioritas awal, sebelum memberi Hermes capability proyek yang luas:

1. Host Windows hardened: sign-in tetap aktif, BitLocker/Defender/Firewall/updates aktif, account non-admin, remote login privat.
2. Satu profile Hermes private; Telegram numeric allowlist hanya Director; group, allow-all, dan plugin injection off.
3. DeepSeek key terpisah dengan budget/cost alert; D3 blocked dan D2 denied-by-default ke provider eksternal.
4. Gateway profile dimulai dengan terminal sandbox, `approvals.mode: manual`, dan seluruh unattended mode `deny`.
5. Tidak ada desktop automation, pre-login service, cron material, plugin tambahan, atau delegated CLI write pada tahap pertama.
6. Project binding dan Sigma MCP read-only terlebih dahulu; kemudian role/capability minimal setelah dispatcher, claim/lease, dan audit contract tersedia.
7. Uji dengan proyek sandbox tanpa secret: unauthorized Telegram, malicious document, project scope mismatch, blocked command, failed approval, provider fallback, dispatcher crash, dan emergency stop.

## 14. Keputusan Director yang masih diperlukan

1. Apakah Telegram hanya untuk satu numeric user ID Director, atau akan ada identitas lain yang bisa pairing?
   - **Rekomendasi:** satu ID Director; unknown DM diabaikan.

2. Apakah tindakan E3/E4 dari Telegram dilarang total, atau boleh dimintakan lalu dikonfirmasi dari CLI/RDP?
   - **Rekomendasi:** Telegram boleh meminta dan menerima laporan; konfirmasi final E3/E4 dari T2/T3.

3. Apakah akun Windows runner Hermes akan tetap akun Director pada pilot, atau langsung dibuat account standard terpisah?
   - **Rekomendasi:** pilot pada akun Director non-admin dengan sandbox ketat; pisahkan account setelah alur Claude/Codex/worktree teruji.

4. Data kelas apa yang boleh dikirim ke DeepSeek API?
   - **Rekomendasi:** mulai dari D0 dan D1 yang disetujui; D2/D3 dilarang sampai policy provider/data selesai.

5. Apakah desktop automation diperlukan pada fase pertama?
   - **Rekomendasi:** tidak. Terminal/worktree yang dibatasi lebih mudah diaudit dan dipulihkan.

6. Berapa batas biaya, concurrency, dan waktu kerja yang boleh dilakukan tanpa interaksi Director?
   - **Rekomendasi:** tetapkan rendah pada pilot dan tingkatkan berdasarkan evidence penggunaan nyata.

## 15. Batas proposal

Dokumen ini adalah baseline desain keamanan, bukan konfigurasi final atau izin implementasi. Ia belum memilih mode deployment Hermes di PC Windows, edition Windows, remote access product, desain account runner, provider data-processing policy, command denylist aktual, format audit log, atau perubahan pada Sigma. Setiap perubahan tersebut harus melalui desain implementasi dan test contract tersendiri.

## 16. Browser isolation dan application allowlist

### 16.1 Keputusan arah browser

Chrome utama Director tidak boleh diakses, disalin, dihubungkan melalui CDP, atau dioperasikan melalui desktop automation oleh Hermes. Hermes menggunakan browser yang dimilikinya sendiri.

| Mode browser | Tujuan | Identity/session | Status rekomendasi |
|---|---|---|---|
| **Hermes anonymous browser** | Riset, dokumentasi, web extraction, dan browsing umum | Chromium bawaan Hermes dengan profile bersih/throwaway tanpa login | Default |
| **Hermes authenticated browser** | Layanan tertentu yang secara eksplisit dibutuhkan tugas | Profile Chromium/Chrome terpisah milik account `hermes-runner`; hanya login layanan yang disetujui | Aktivasi per kebutuhan |
| **Chrome utama Director** | Aktivitas personal Director | Cookie, password, history, sync, dan session Director | Dilarang untuk Hermes |

Local browser Hermes secara default memakai Chromium terpisah dan profile bersih; browser utama hanya disentuh bila real-profile browsing atau koneksi CDP diaktifkan secara eksplisit. [Hermes Browser Automation](https://hermes-agent.nousresearch.com/docs/user-guide/features/browser/)

### 16.2 Guardrail browser

- `browser.use_real_profile` harus tetap `false`.
- Hermes tidak memakai `/browser connect`, `browser.cdp_url`, atau endpoint CDP yang menunjuk ke Chrome/Edge/Brave utama Director.
- Account Windows `hermes-runner` tidak diberi ACL untuk membaca profile browser Director, termasuk `%LOCALAPPDATA%\\Google\\Chrome\\User Data` atau profile browser lain yang setara.
- Desktop automation tetap disabled secara default sehingga Hermes tidak dapat membuka atau mengoperasikan browser utama melalui GUI sebagai bypass.
- Browser authenticated Hermes disimpan pada directory runtime yang diizinkan, misalnya `C:\\HermesRuntime\\browser-profile`; profile itu tidak login Chrome Sync menggunakan akun personal Director.
- Download dan export browser hanya menuju directory runtime/export Hermes atau proyek yang telah bound; attachment hasil browsing diperlakukan sebagai input tidak tepercaya.
- Password manager, email personal, perbankan, akun administrator, recovery key, dan akun personal Director tidak pernah dibuka dari browser Hermes.
- Browser recording dimatikan secara default. Jika diaktifkan untuk evidence, rekaman dianggap D2/D3 sesuai kontennya, diberi retention pendek, dan tidak dikirim ke provider eksternal.
- Login ke layanan authenticated dilakukan manual oleh Director pada browser Hermes yang terpisah; Hermes tidak menerima password dan tidak menyimpan kredensial dalam memory/prompt.

### 16.3 Capability aplikasi bukan akses universal

Hermes tidak otomatis memperoleh akses atau hak mengoperasikan semua aplikasi yang terpasang pada PC. Capability yang tersedia hanya memberikan salah satu jalur berikut:

| Jalur | Kemampuan | Batas |
|---|---|---|
| **Terminal** | Menjalankan executable/CLI yang diizinkan | Tergantung executable path, account Windows, ACL, sandbox, command policy, dan approval |
| **Desktop automation** | Klik, ketik, scroll, serta membaca elemen UI aplikasi | Memerlukan sesi Windows user aktif; tidak menjamin aplikasi memiliki UI automation yang dapat dipakai |
| **API/MCP** | Mengoperasikan aplikasi/layanan lewat interface resmi | Hanya bila connector, credential, dan scope tool diberikan eksplisit |

Computer Use Hermes di Windows menggunakan UIAutomation dan input dispatch, tetapi bukan mekanisme akses universal. Secure desktop Windows, UAC elevation, aplikasi dengan UI khusus, password manager, atau aplikasi yang tidak membuka accessibility tree dapat membatasi atau memblokir automation. [Hermes Computer Use](https://hermes-agent.nousresearch.com/docs/user-guide/features/computer-use/)

### 16.4 Application allowlist

Tidak ada policy “semua aplikasi PC dapat digunakan Hermes”. Setiap aplikasi atau command family dimasukkan ke capability policy hanya setelah kebutuhan, account, data scope, action tier, dan evidence/approval requirement didefinisikan.

| Kategori | Status awal | Catatan |
|---|---|---|
| Browser Hermes | Diizinkan terbatas | Mengikuti Bagian 16.1–16.2 |
| Sigma CLI, Git, build/test tool, Docker sandbox | Diizinkan per project binding | Scope worktree/proyek dan action tier wajib berlaku |
| Claude Code dan Codex | Diizinkan sebagai specialist executor | Task envelope, worktree, capability, dan evidence contract wajib |
| Editor/IDE khusus | Belum diizinkan | Dapat dipertimbangkan jika ada workflow dan policy yang jelas |
| Chrome utama Director, password manager, email/pesan personal, aplikasi perbankan | Hard deny | Tidak ada exception otomatis dari Telegram atau role Sigma |
| Registry, Windows Settings, firewall, service manager, installer/package manager, aplikasi remote access | Hard deny / E4 | Hanya perubahan manual Director atau prosedur E4 yang ditinjau |
| Aplikasi lain | Deny by default | Memerlukan admission ke allowlist |

Desktop automation tidak diaktifkan pada fase pertama. Terminal/worktree yang dibatasi, browser Hermes terpisah, serta API resmi yang narrowly scoped lebih mudah diaudit dan dipulihkan.
