# Proposal — Director-Controlled Model Routing Checkpoint untuk HERMES

- **Tanggal:** 2026-09-17
- **Status:** Draft diskusi; bukan policy Sigma, konfigurasi provider, atau otorisasi implementasi.
- **Tujuan:** Menentukan cara HERMES merujuk keputusan Director tentang provider, model, dan effort sebelum merutekan mandat ke AI role Sigma.
- **Catatan revisi (2026-09-17, diskusi lanjutan Director):** Desain awal (checkpoint yang selalu bertanya ke Director sebelum tiap dispatch) diganti total. Model final: **satu file config routing, dipasang di channel, dikelola langsung oleh Director kapan saja**; HERMES hanya membaca dan memakainya, tidak pernah menyimpan salinan, ticket, atau log routing di tempat lain. HERMES hanya proaktif menghubungi Director saat terjadi sinyal gagal terverifikasi (limit/gangguan/status subscription) pada model yang sedang dipakai. §1–§9 dan §11.3 direvisi sesuai ini.

## 1. Keputusan arah

Satu-satunya rujukan routing model adalah **file config routing yang dipasang di channel** dan dikelola langsung oleh Director. Director dapat mengubahnya kapan saja, tanpa perlu memberi tahu HERMES terlebih dahulu — kecuali dalam konteks merespons sinyal limit/gangguan (§5), di mana Director secara eksplisit memberi tahu HERMES bahwa config sudah diubah.

HERMES **tidak boleh** menyimpan salinan, cache jangka panjang, ticket, atau log apa pun dari isi config ini di tempat lain. Ini bukan soal efisiensi — ini mencegah dua sumber kebenaran yang bisa berbeda dan menimbulkan kesalahpahaman. Bila isi file tidak berubah sejak terakhir dibaca, itulah routing yang berlaku; HERMES tidak perlu bertanya ulang.

```text
Sigma state + artifact/gate yang valid
→ HERMES menentukan role yang secara lifecycle diperlukan
→ HERMES membaca file config routing di channel (saat itu juga, tanpa menyimpan salinan)
→ HERMES dispatch task envelope ke role sesuai isi config saat ini
```

Proposal mapping provider/model dari dokumen lain (mis. setup-guide §6.2) adalah bahan referensi awal untuk mengisi config ini — bukan aturan mengikat yang berdiri sendiri di luar config.

## 2. Pembagian tanggung jawab

| Elemen | Pemegang | Fungsi |
|---|---|---|
| Isi dan perubahan config routing | Director | Diedit langsung di channel, kapan saja, tanpa proses persetujuan tambahan. |
| Pembacaan dan pemakaian config | HERMES | Dibaca ulang sebelum setiap kelompok dispatch; tidak disimpan sebagai salinan/state kedua. |
| Deteksi dan pelaporan sinyal gagal (limit/gangguan/status subscription) | HERMES | Satu-satunya inisiatif proaktif HERMES terkait routing (§5). |
| Keputusan atas sinyal gagal — tunggu atau ganti | Director | Bila ganti, Director mengedit file config sendiri; HERMES tidak mengganti routing atas inisiatif sendiri. |
| State, approval, artifact, evidence Sigma | Sigma | Tidak berubah; tidak tergantikan oleh config routing. |

## 3. Isi minimum file config routing

Config ini dikelola sepenuhnya oleh Director; dokumen ini hanya menjelaskan bentuk minimum yang perlu bisa dibaca HERMES:

```text
Per fase siklus Sigma:
- provider/model untuk ARC
- provider/model untuk FMN
- provider/model untuk DEV
- provider/model untuk AUD

Preferensi fallback per role (opsional, diisi Director bila dikehendaki)
```

Contoh isi saat ini (per diskusi 2026-09-17 — ilustrasi isi aktual config Director, bukan nilai yang dikunci dokumen ini):

| Fase Sigma | ARC | FMN | DEV | AUD |
|---|---|---|---|---|
| Strategis (intent) | Claude | dormant | dormant | OpenCode (GPT) |
| Implementasi (plan+exec) | dormant | DeepSeek | Claude | OpenCode (GPT) |
| Implementasi + amendment (ARC reaktif, sesi baru terpisah) | Claude | DeepSeek | Claude | OpenCode (GPT) |

AUD konstan di OpenCode (GPT) pada seluruh fase — ini menjaga family model AUD selalu berbeda dari role yang diaudit tanpa perlu pengecekan manual tambahan (lihat §6).

Karena isi ini murni milik Director dan dapat berubah kapan saja, dokumen ini tidak menjadikannya sebagai spesifikasi baku. Bila isi tabel di atas berbeda dari file config yang sesungguhnya, **file config yang berlaku, bukan tabel ini**.

## 4. Tidak ada ticket, salinan, atau log routing

HERMES tidak membuat, menyimpan, atau merujuk representasi routing apa pun selain file config itu sendiri pada saat dibaca. Tidak ada `routing_ticket_id`, tidak ada riwayat/log keputusan routing, tidak ada state kedua yang bisa berbeda dari file.

Ini berbeda sengaja dari pola HERMES Work Ledger/status runtime pada dokumen lain (yang memisahkan runtime state sebagai sumber kebenaran dari tampilan channel) — untuk routing model, file di channel itu sendiri **adalah** satu-satunya sumber kebenaran, tanpa lapisan state terpisah. Bila HERMES salah membaca/merutekan, Director memverifikasi lewat dashboard usage subscription/API masing-masing provider — bukan lewat log HERMES.

## 5. Perilaku pada limit, gangguan, atau status subscription bermasalah

HERMES memantau tiga sinyal berikut pada model yang sedang aktif dipakai:

1. Hit limit pada subscription/API model yang sedang menjadi routing aktif.
2. Gangguan layanan (outage) pada provider yang sedang dipakai.
3. Status subscription bermasalah (belum dibayar/free tier) — biasanya bermanifestasi sebagai hit limit juga.

Begitu salah satu sinyal ini terverifikasi:

```text
Sinyal terverifikasi
→ hentikan dispatch/sesi dengan aman untuk role terkait
→ ambil output/handoff yang tersedia dari specialist, bila ada
→ laporkan ke Director: model apa, sinyal apa, dampaknya ke tahap apa
→ tunggu keputusan Director:
    - tunggu hingga limit/gangguan pulih, atau
    - Director mengedit file config routing sendiri lalu memberi tahu HERMES
→ HERMES membaca ulang file config sebelum melanjutkan dispatch
```

Laporan ini adalah komunikasi langsung ke Director pada saat kejadian — bukan record yang disimpan HERMES untuk rujukan di kemudian hari (§4).

## 6. Independensi AUD

Setiap kali HERMES membaca file config sebelum dispatch, ia memeriksa — sebagai pemeriksaan langsung saat itu juga, bukan record yang disimpan — apakah AUD memakai provider/model family yang sama dengan role yang sedang diaudit. Bila ya, HERMES menandai ini ke Director sebagai risiko independensi sebelum dispatch berjalan.

Peringatan ini bersifat `DIRECTOR_CONFIRMATION_REQUIRED`, bukan veto otomatis — Director tetap dapat memilih melanjutkan. HERMES tidak menyampaikan persetujuan, keraguan, ketidaksetujuan, atau rekomendasi kepada ARC/FMN/DEV/AUD; peringatan ini hanya untuk Director.

## 7. Urutan dispatch lintas role

Config dibaca ulang setiap kali sekelompok dispatch benar-benar akan dimulai — bukan sekali di awal lifecycle project. Dengan begitu, perubahan yang Director lakukan di tengah jalan langsung berlaku pada dispatch berikutnya tanpa mekanisme tambahan.

Contoh urutan (mengikuti pembagian fase Sigma, §3):

```text
1. Intent (fase strategis): HERMES baca config, dispatch ARC.
2. Intent audit: HERMES baca config, dispatch AUD.
3. Plan (fase implementasi mulai): ARC dormant; HERMES baca config, dispatch FMN.
4. Plan audit: HERMES baca config, dispatch AUD.
5. DEV-EXEC: HERMES baca config, dispatch DEV.
6. Amendment (bila terjadi): ARC reaktif sebagai sesi baru terpisah dari FMN/DEV
   yang mungkin masih berjalan; HERMES baca config untuk ketiganya.
```

HERMES tidak mengirim task ke role yang gate-nya belum terbuka, terlepas dari apa isi config.

## 8. Batas peringatan HERMES

Selain peringatan independensi AUD (§6) dan pelaporan sinyal limit/gangguan/status subscription (§5), HERMES tidak memberi rekomendasi, keraguan, atau opini soal pilihan model/provider Director. Isi config adalah keputusan Director sepenuhnya; HERMES menjalankannya, bukan mengevaluasinya.

## 9. Hal yang belum ditetapkan

1. ~~Mekanisme teknis persis "file config dipasang di channel" — format file~~ — **diputuskan 2026-09-17**: format **YAML**, bukan Markdown/JSON. Alasan: preview Markdown tidak bisa diedit langsung sementara raw source-nya merepotkan (align tabel dll); YAML lebih mudah diedit langsung (struktur key-value, tanpa tabel) sekaligus masih bisa memuat komentar singkat. Isi aktual: `2026-09-17_hermes-model-routing-config.yaml`. Yang **masih terbuka**: cara HERMES membaca file ini real-time tanpa menyimpan salinan, dan cara verifikasi bahwa perubahan benar berasal dari Director.
2. Definisi teknis "family/provider independen" untuk peringatan AUD (§6).
3. Cara membaca availability/model metadata untuk mendeteksi sinyal limit/gangguan tanpa membocorkan credential atau menganggap login sebagai otorisasi.
4. **Baru (2026-09-17):** Director ingin idealnya fitur input variabel yang interaktif di channel (mis. form/slash-command Slack) untuk mengedit config ini, bukan sekadar file mentah. Ini kebutuhan UX nyata, tapi merupakan proyek implementasi tersendiri (perlu fitur Slack app), bukan sesuatu yang bisa dituntaskan lewat pilihan format file saja — dicatat sebagai keinginan masa depan.

## 10. Batas proposal

Dokumen ini tidak mengaktifkan provider, subscription, API key, mekanisme baca file config, Slack approval bridge, Sigma message/memo untuk HERMES, maupun perubahan source code. Ia menetapkan prinsip bahwa config routing adalah satu-satunya rujukan dan tidak boleh diduplikasi HERMES; detail mekanisme teknis tetap harus melalui desain implementasi tersendiri.

## 11. Role Session Adapter

### 11.1 Model bukan role

Provider atau model tidak identik dengan role Sigma. Claude Code, Codex, Gemini, DeepSeek, OpenCode Zen, atau agent adapter lain hanya menjadi runtime untuk menjalankan **satu instance role** yang telah dipilih Director dan diizinkan lifecycle Sigma.

```text
Isi config routing saat ini (§3)
→ HERMES memilih Role Session Adapter
→ adapter meluncurkan session role baru dan terisolasi
→ satu session = satu role = satu mandate/workstream terbatas
→ output formal melalui artifact/evidence Sigma yang sah
```

Dengan demikian, HERMES tidak sekadar "memanggil model". Ia memilih adapter lalu mengaktifkan role session terikat, misalnya instance `ARC`, `FMN`, `DEV`, atau `AUD`.

### 11.2 Invarian isolasi role

- Satu role session hanya mengaktifkan satu role selama session hidup; ia tidak boleh berganti menjadi role Sigma lain.
- HERMES tidak memberikan riwayat percakapan, reasoning internal, memory kerja, atau output privat satu role kepada role lain.
- Pengetahuan lintas role hanya boleh diperoleh dari artifact Sigma yang dapat dibaca sesuai otoritas, evidence yang disahkan, atau komunikasi formal yang diizinkan Sigma.
- Setiap role session dimulai dengan konteks minimum dari task envelope dan binding yang tervalidasi, bukan dengan transcript global HERMES atau transcript role lain.
- Bila role lain diperlukan, HERMES mengakhiri atau memarkir session sebelumnya sesuai lifecycle, lalu meluncurkan session baru dengan profile role yang tepat.

Larangan ini mencakup model yang sama maupun provider yang sama. Dua session dengan model identik tetap dua role yang terisolasi bila role dan mandate-nya berbeda.

### 11.3 Kontrak minimum adapter

Setiap Role Session Adapter yang dapat menjalankan role formal Sigma harus menyediakan dan merekam, selama session berjalan:

```text
role_session_id
project binding + artifact/version/hash
role profile + rule version/checksum
provider / model / effort / adapter identity
worktree atau filesystem scope
capability allowlist dan data-policy constraints
timeout / retry / budget boundary
session lifecycle: READY | RUNNING | HANDOFF_REQUIRED | PAUSED_LIMIT | CLOSED | FAILED
```

Field ini adalah state operasional sesi yang sedang berjalan, bukan log/riwayat routing yang dipertahankan setelah sesi selesai (§4). Adapter wajib membentuk task envelope, membatasi capability runtime sesuai role, dan mengembalikan output/handoff yang dapat diverifikasi. Login provider, model yang tersedia, atau kemampuan teknis memanggil shell tidak sendiri-sendiri memberi authority Sigma.

### 11.4 Klasifikasi adapter

| Kelas | Contoh | Status terhadap role Sigma |
|---|---|---|
| Native tool adapter | Claude Code, Codex, atau tool resmi lain yang dapat menerima role profile dan Sigma binding | Dapat menjadi role session setelah kontrak adapter terpenuhi. |
| Managed provider adapter | Agent yang diluncurkan HERMES melalui API/provider lain dengan sandbox, tool policy, dan role profile | Dapat menjadi role session hanya setelah kontrak adapter terpenuhi. |
| Raw model call | Prompt/API completion tanpa session isolation, capability control, binding, atau output contract | Bukan role Sigma formal; hanya asisten/draft eksternal. |

Ketiadaan Claude Code atau Codex tidak menutup kemungkinan menjalankan role Sigma melalui managed provider adapter. Namun HERMES harus menolak menganggap raw model call sebagai ARC/FMN/DEV/AUD formal hanya karena modelnya dipilih pada config routing.

### 11.5 Handoff dan kegagalan adapter

Ketika adapter mencapai limit, crash, timeout, atau perlu berganti provider/model, HERMES tidak memindahkan context privat session lama ke session baru. Ia menggunakan hanya artifact/evidence yang sudah tersedia dan handoff formal yang dibuat role sesuai lifecycle. Session baru memperoleh task envelope baru dan reference yang relevan.

Jika handoff formal belum tersedia, HERMES menyatakan state parsial kepada Director dan meminta routing/mandat berikutnya. Ia tidak merekonstruksi reasoning role lama dari memory HERMES dan tidak mengisi memo teknis atas nama role.
