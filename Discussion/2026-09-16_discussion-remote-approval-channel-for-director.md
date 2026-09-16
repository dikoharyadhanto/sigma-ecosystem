# Diskusi — Mengapa Otoritas Director Tidak Bisa Dipindahkan ke Hermes, dan Kanal Approval Jarak Jauh

- **Tanggal:** 2026-09-16
- **Status:** Catatan diskusi Director ↔ Claude. **Bukan plan, bukan otorisasi implementasi.** Dua arah sudah dipilih Director (lihat §5) tetapi belum ada desain teknis rinci maupun perintah eksekusi.
- **Konteks:** Diskusi ini terjadi tepat setelah Gate C dan Gate D `PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` dinyatakan PASS oleh Claude (reviewer independen) — lihat `Implementation/sigma-mcp/RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md` §23 dan `RESULT-IMPL-SIGMA-MCP-STAGE-D-20260915.md` §21. Director meminta orientasi ulang: apa sebenarnya masalah yang baru saja diselesaikan, dan apa konsekuensinya untuk cara Hermes akan dipakai sehari-hari.
- **Bahasa:** Indonesia (istilah teknis/command tetap English).
- **Referensi terkait:**
  - `Implementation/sigma-mcp/PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` §10.2, §21.2, §22 (approval durable, remote Director authentication sebagai keputusan terpisah, kriteria berhenti host-lokal)
  - `Implementation/sigma-mcp/RESULT-IMPL-SIGMA-MCP-STAGE-D-20260915.md` (mekanisme approval `sigma control approve/reject` yang aktual)
  - `Discussion/2026-09-15_proposal-hermes-sigma-integration-setup-guide.md` §2 (gateway Slack + CLI via SSH sudah disebut sebagai arah, dokumen ini menjelaskan alasan keamanannya secara lebih dalam)

---

## 1. Pertanyaan awal Director

> "sebenarnya apa yaa masalah kita ini? sebenarnya apa tujuan dari stage c dan d? apa yang kita sedang lakukan?"

Ringkasan jawaban:

- **Masalah dasar**: Sigma adalah sistem governance yang selama ini hanya dioperasikan manusia lewat CLI. Hermes butuh berinteraksi dengan Sigma secara terprogram (bukan manusia mengetik command satu-satu), tapi registry Sigma sendiri mengakui otoritas role selama ini hanya dijaga "disiplin", bukan sistem (`role_definitions.director`: *"CLI enforces this by convention — Sigma has no auth layer"*).
- **Tujuan Stage C**: buktikan AI role bisa menulis mutasi yang reversibel (draft) lewat MCP dengan aman — role ditegakkan server, retry tidak menggandakan efek, state basi ditolak.
- **Tujuan Stage D**: buktikan hal yang sama untuk transisi **material** (ratifikasi, buka gate) tanpa melanggar *Director finality* — lewat pola `prepare → approval Director durable → commit`.
- **Yang sedang dilakukan**: Claude berperan reviewer independen terhadap implementasi Codex, karena klaim "aman" dari pembuat kode sendiri tidak cukup untuk software governance.

## 2. Pertanyaan konsekuensi konkret

> "apa konsekuensi jika hermes dan atau ai role saling berinteraksi dengan sistem sigma yang tanpa pengembangan sigma-mcp vs dengan pengembangan sigma mcp ini?"

Perbandingan yang dibahas (tabel lengkap ada di transkrip percakapan, ringkasan poin inti):

| Tanpa sigma-mcp (CLI/shell) | Dengan sigma-mcp (Stage A–D) |
|---|---|
| Role diklaim lewat prompt/argumen, dipercaya begitu saja | Role ditentukan server dari argumen proses saat startup — tidak bisa diubah dari tool/prompt |
| Retry bisa menggandakan efek | Wajib `idempotency_key`, exactly-once |
| Bisa menimpa state yang sudah berubah | Wajib `expected_state_revision`/hash, mismatch ditolak |
| Ratifikasi bisa dijalankan AI selama role "diklaim" benar | Wajib approval Director durable via CLI lokal, AI tidak bisa self-approve |
| Dua sesi AI berjalan bersamaan → race tanpa kontrol | Lock lintas-proses (baru diperbaiki minggu ini) |

Contoh nyata yang jadi alasan proses review berlarut-larut: lock lama terbukti bisa ditembus ~1 dari 5 percobaan ketika dua proses `sigma-control` mencoba meratifikasi ticket yang sama nyaris bersamaan — persis skenario yang mungkin terjadi kalau Hermes mengelola beberapa sesi/role paralel.

## 3. Koreksi mental model Director

> "...bayangan saya ini akan sama hanya beda actor yang melakukan. mohon dikoreksi..."

Koreksi inti: **pergantian aktor (Director manual → Hermes/orchestrator otomatis) bukan pergantian netral.** Tiga alasan:

1. **Sumber otoritas.** Saat Director mengetik langsung, tidak ada pertanyaan "apakah ini benar-benar Director?" — itu memang Director, di mesinnya sendiri. Begitu Hermes yang "mengetik", pertanyaan itu jadi nyata: Hermes bukan Director, dan tidak boleh otomatis dianggap punya otoritasnya.
2. **Skala dan konkurensi.** Director tidak akan pernah menjalankan dua terminal pada nanodetik yang identik. Hermes, yang mengelola banyak sesi paralel, bisa — dan race lock yang ditemukan minggu ini adalah bukti konkretnya.
3. **Permukaan pengaruh via konten.** Director hanya mendengarkan penilaiannya sendiri. AI role di bawah Hermes saling membaca output satu sama lain (pesan, dokumen) — isi teks itu sendiri jadi jalur pengaruh potensial (prompt injection), sehingga role harus ditentukan server, bukan dari teks yang sedang dibaca AI.

## 4. Mekanisme approval saat ini, dan kenapa Slack/chat tidak diterima

> "bagaimana sistem approval ini hanya bisa saya yang jalankan?"

Mekanisme aktual (Stage D, `sigma control approve/reject <ticket_id> --director-confirm`):

- Dijalankan langsung di terminal pada **host yang sama** dengan project Sigma.
- Identitas Director diambil dari **username OS** (`os.userInfo()`, fallback env var) — bukan sertifikat/tanda tangan kriptografis, murni akses ke mesin itu.
- Approval record terikat ke ticket/hash/state tertentu, sekali pakai, kedaluwarsa 30 menit.
- **Tidak ada satu pun tool MCP (yang dipegang Hermes/AI role) yang bisa menulis approval record** — dipisah di level kode, bukan aturan.
- Chat/runtime confirmation **eksplisit ditolak** sebagai approval (tertulis harfiah di deskripsi tool `sigma_commit_intent_ratify`) — karena teks bisa dipalsukan, disalahartikan AI, atau dihasilkan lewat akun yang diretas.
- Batas yang diakui plan sendiri: ini **belum** otentikasi kuat, dan sengaja dibatasi hanya boleh berjalan di host lokal (§22 plan — menjalankan di luar host lokal tanpa autentikasi role terpisah adalah kriteria berhenti eksplisit). Autentikasi Director jarak jauh dicatat sebagai *"keputusan desain tersendiri sebelum penggunaan produksi"* (§21.2 plan) — belum dirancang.

## 5. Opsi kanal approval jarak jauh — dan keputusan Director

Pertanyaan Director: *"bisakah hermes menjalankan approval ini tapi atas otoritas yang saya berikan dari pesan di slack?"*

**Ditolak sebagai desain** (bukan soal teknis mampu/tidak mampu — secara teknis bisa dibangun, tapi merusak invarian yang baru saja dipertahankan). Kalau Hermes yang membaca pesan Slack lalu Hermes sendiri yang mengeksekusi CLI approval:

- Identitas yang tercatat jadi salah (akun otomasi Hermes, bukan Director).
- Hermes jadi **penafsir** keputusan, bukan penyalur — persis celah yang coba ditutup aturan "chat tidak pernah diterima sebagai approval".
- Permukaan serangan pindah ke Slack: siapa pun yang bisa memasukkan teks meyakinkan ke channel itu (akun diretas, sesi dibajak, pesan lama disalahartikan) berpotensi memicu approval sungguhan.
- Menghapus pemisahan yang sengaja dibuat: saat ini tidak ada tool MCP yang bisa menulis approval sama sekali; memberi Hermes jalan menjalankan CLI itu menghilangkan pemisahan itu.

### Konteks device Director

Hermes hanya hidup di satu PC Windows pribadi ("sigma-integration-hermes"); device lain tetap pra-integrasi. Kebutuhan nyata: mengirim keputusan approve/reject dari HP atau laptop lain saat tidak di depan PC itu, tanpa remote desktop penuh (GUI) bila memungkinkan.

### Tiga opsi yang dibahas

| # | Opsi | Verdict |
|---|---|---|
| 1 | SSH ke PC (idealnya lewat jaringan privat seperti Tailscale/WireGuard, bukan expose port ke publik), jalankan `sigma control approve` langsung dari terminal | **Dipilih.** Setara keamanan dengan duduk di depan PC — command tetap di host yang sama, identitas OS tetap akun Director, tidak ada penafsir di tengah. |
| 2 | Kanal approval native di Slack, **tapi bukan Hermes yang menafsirkan chat** — komponen terpisah (bukan LLM) yang menerima interactive component (tombol Approve/Reject bertarget ticket spesifik), memverifikasi signing secret Slack + Slack user ID Director, lalu menulis approval record langsung tanpa melalui penalaran Hermes/model bahasa apa pun. Hermes hanya boleh berperan membuat ticket dan mengirim notifikasi — bukan menerima keputusan. | **Dipilih**, sebagai proyek terpisah dengan desain dan review keamanan sendiri (belum dirancang; komponen baru = permukaan serangan baru yang butuh threat model sendiri, setara ketatnya dengan review lock kemarin). |
| 3 | Remote desktop penuh (GUI) ke PC | **Tidak dipilih** oleh Director. |

## 6. Status dan langkah berikutnya

- Opsi 1 (SSH + jaringan privat) adalah **quick win** — tidak menambah komponen baru ke Sigma/Hermes, tidak mengubah kode apa pun yang sudah direview, murni konfigurasi infrastruktur di sisi Director.
- Opsi 2 (kanal approval Slack terverifikasi) adalah **proyek baru** yang belum punya plan tertulis. Sebelum implementasi dimulai, perlu dokumen desain tersendiri (setara `PLAN-IMPL-*`) yang mencakup minimal: mekanisme verifikasi signature Slack, di mana listener berjalan (di PC yang sama vs. expose lewat tunnel), format approval record yang dihasilkan (harus kompatibel dengan `ApprovalRecord` yang sudah ada di `src/engine/controlStore.ts`), dan threat model komponen barunya.
- **Tidak ada kode yang diubah oleh diskusi ini.** Dokumen ini murni catatan orientasi dan keputusan arah, dicatat atas permintaan eksplisit Director.
