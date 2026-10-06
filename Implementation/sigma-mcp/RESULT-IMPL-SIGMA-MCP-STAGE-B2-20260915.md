# RESULT-IMPL — Sigma MCP Stage B2

**Plan**: `PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` §14 Stage B, items 3–4
**Prasyarat**: `RESULT-IMPL-SIGMA-MCP-BATCH1-20260915.md` — Gate 0.5 PASS, Gate B1 PASS (final re-review Codex, §16)
**Tanggal**: 2026-09-15
**Scope dieksekusi (akhir, setelah revert §9)**: evidence view (`sigma_get_evidence`) saja. Scope awal juga mencakup mailbox metadata/peek (`sigma_list_messages`, `sigma_read_message`); ditarik oleh keputusan Director setelah review Codex — lihat §8–§9.
**Status**: **R-B2-05 ditutup (§12) — README diperbarui.** Re-review Codex (§11) sudah menyatakan implementasi/security/test PASS; satu-satunya item terbuka (dokumentasi) telah dikerjakan. MCP mailbox/memo telah dikeluarkan sepenuhnya dari scope aktif; Stage B2 evidence-only tidak memiliki temuan kode yang memblokir. Final PASS administratif menunggu konfirmasi Codex/Director atas §12.

**Cakupan yang secara eksplisit TIDAK termasuk** (tidak diminta, tidak dikerjakan): Stage C/D/E, `sigma-control`, write tool apa pun, `intent_list`/`plan_list`/`exec_list`/`roadmap_list`/`*_check`/`memo_list`/`config_show`/`report_logs`/`git_evidence` (item lain yang capability matrix Stage 0 tandai "deferred B2" tetapi tidak disebut eksplisit oleh plan §14 sebagai cakupan B2), operasi mutating `inbox_read`/`memo_read`, commit/push.

---

## 1. Keputusan yang mendahului implementasi

Dua keputusan diminta ke Director sebelum menulis kode, karena plan §9.1 secara eksplisit membiarkannya terbuka untuk B2:

| # | Pertanyaan | Keputusan Director (2026-09-15) |
|---|---|---|
| 1 | Konflik semantik `sigma_read_message` vs CLI `inbox read` (plan §9.1) | **Opsi A** — pisah use-case. `sigma_read_message` = `message_peek` non-mutating; half mutating (mark READ + sweep OUTDATED) tetap CLI-only, dipindah ke Stage C, bukan diimplementasikan di B2 |
| 2 | Cakupan B2 | Dibatasi ke evidence view + mailbox metadata/peek saja — bukan seluruh item "deferred B2" yang tercatat di capability matrix Stage 0 |

Detail rasional ada di transkrip permintaan konfirmasi sebelum implementasi; tidak diulang di sini.

## 2. Temuan desain yang muncul saat implementasi (bukan bagian dari dua keputusan di atas)

Satu isu arsitektur tidak disebut eksplisit oleh plan dan baru terlihat saat menulis kode: **query-mode binding tidak pernah membawa role.**

`src/mcp/binding.ts` sebelum Stage B2: `role: parsed.mode === 'control' ? (parsed.role ?? null) : null` — hanya control mode yang bisa punya role terikat. Tapi mailbox secara inheren per-role, dan invarian §5.3 plan ("Role is server-derived") melarang model menaikkan role lewat argumen tool (`role: "AUD"` sebagai parameter `sigma_list_messages`, misalnya).

**Resolusi**: `resolveBinding()` diperluas menerima `--role` pada kedua mode, dari argv proses tepercaya yang sama dengan `--project-id`. Ini murni penerapan invarian yang sudah ada (role tetap hanya dari trusted argv, tidak pernah dari tool call) diperluas ke mode kedua — bukan kebijakan baru, dan **tidak menambah kapabilitas write apa pun**: role pada query mode hanya menyaring proyeksi baca. W1/W2 admissibility tetap murni domain control mode, yang tidak disentuh sama sekali oleh Stage B2.

Keputusan ini diambil tanpa konfirmasi Director terpisah karena merupakan penerapan langsung invarian §5.3 yang sudah disetujui, bukan keputusan kebijakan baru — konsisten dengan sesi berjalan dalam mode otonom. Dicatat di sini untuk transparansi dan supaya review Codex dapat memeriksanya sebagai perubahan boundary, bukan sekadar detail implementasi.

## 3. Yang diimplementasikan

### 3.1 Refactor pendahuluan — `src/mcp/artifactPath.ts`

Sebelum menulis `sigma_get_evidence`, tabel derivasi path kanonik (`candidatesFor`, `allowedRelPaths`, `assertCanonicalLocation`) dipindah keluar dari `readArtifact.ts` ke modul baru `src/mcp/artifactPath.ts`. Alasannya bukan preferensi gaya: R-10 pada Batch 1 terjadi persis karena tabel layout hidup dua kali (`reconstruct.ts` dan reader MCP) dan drift. `sigma_get_evidence` butuh boundary yang identik atas tracker plan/exec yang sama — menyalinnya kedua kali akan mengulang kesalahan yang sama. `readArtifact.ts` sekarang mengimpor dari modul bersama ini; `computeReadArtifact` dan `MAX_ARTIFACT_BYTES` tetap diekspor dari lokasi lama sehingga `test/mcp-binding.test.ts` tidak berubah.

Error internal (`ArtifactReadError`) juga digeneralisasi menjadi `McpQueryError` di `src/mcp/errors.ts`, dipakai bersama oleh artifact, evidence, dan mailbox — sebelumnya nama itu tersirat khusus artifact.

### 3.2 `sigma_get_evidence` (`src/mcp/tools/evidence.ts`)

Proyeksi status/referensi satu versi plan/exec: `version`, `state`, `created_at`/`updated_at`/`locked_at`, `superseded_by`/`supersede_reason`, `intent_version_ref`/`plan_version_ref`, `title`/`focus`, `human` (status humanize), dan — bila file terdaftar — `path` (relatif, kanonik), `bytes`, `sha256`. **Tidak pernah** mengembalikan isi dokumen (itu tetap domain `sigma_read_artifact`) dan tidak membaca log apa pun.

Boundary path memakai `assertCanonicalLocation` yang sama dengan `sigma_read_artifact` — termasuk dukungan folder legacy pra-rename (R-10 parity), diverifikasi dengan test khusus.

### 3.3 `sigma_list_messages` + `sigma_read_message` (`src/mcp/tools/mailbox.ts`)

- `sigma_list_messages` — mereplikasi tiga tier `selectInboxMessages()` (`unread`/`all`/`outdated`) persis, metadata saja, MEMO dikecualikan (sama seperti CLI `sigma inbox`).
- `sigma_read_message` — membaca isi satu pesan **tanpa** memanggil `updateMessageStatus`/`writeIndex`. Status pesan pada payload dan pada disk tetap seperti sebelum panggilan. MEMO ditolak eksplisit (operasi terpisah, masih deferred). Pesan milik role lain terbaca sebagai "not found" tanpa membedakan dari "benar-benar tidak ada".

Boundary path untuk mailbox: lokasi kanonik sebuah pesan diturunkan dari field `to` milik entry-nya sendiri (`Sigma/messages/<TO>/`) plus validasi bentuk nama file terhadap pola `generateFilename()` — `entry.file` tidak pernah dipercaya verbatim, sama seperti tracker artifact (R-01/R-10). Realpath di-re-check setelah `openSync`, pola yang sama dengan `sigma_read_artifact`.

Kedua tool menolak (`ROLE_NOT_AUTHORIZED`) bila binding tidak punya role ARC/FMN/DEV/AUD.

### 3.4 Guard dan policy

- `test/mcp-tools.test.ts`: guard statis "no query-plane file imports a state-mutating engine function" diperluas dengan `writeIndex`, `updateMessageStatus`.
- `src/mcp/policy.ts`: `inbox` dipindah ke `IMPLEMENTED` — `sigma_list_messages` mereplikasi operasi itu penuh. `inbox_read` **tetap** deferred — `sigma_read_message` bukan realisasinya (§1).
- Daftar tool di `src/mcp/index.ts` bertambah tiga: `sigma_get_evidence`, `sigma_list_messages`, `sigma_read_message`. Total 12 tool (6 Phase 0 + 3 Batch 1 + 3 Stage B2).

## 4. Bukti eksekusi

| Perintah | Hasil |
|---|---|
| `npm run build` (`tsc`) | Bersih, nol error |
| `npm test` (full suite) | **51 file / 552 test PASS** (dari 50 file / 536 pada akhir Batch 1; +1 file, +16 test, nol hilang) |
| `test/mcp-stage-b2.test.ts` (baru, 16 test) | Semua PASS — evidence status+hash, present:false, unknown version, boundary `.env`, legacy-folder parity; mailbox role-required, role-scoping, MEMO exclusion, non-mutasi (payload+disk), boundary directory/filename-shape, tiga view tier; transport-level envelope + non-mutasi |
| `test/mcp-tools.test.ts` (tool-list assertion diperbarui ke 12 tool) | PASS |
| `test/mcp-binding.test.ts`, `test/mcp-config.test.ts` (regresi Batch 1) | PASS, tidak berubah |

### 4.1 Mutation-check — sebagian tidak dapat diselesaikan

Untuk R-01/R-10 pada Batch 1, guard boundary sengaja dimatikan (`if (false)`) lalu suite dijalankan ulang untuk membuktikan test benar-benar menggigit, bukan tautologi. Saya mencoba pola yang sama pada `assertMessageCanonicalLocation` di `mailbox.ts`.

**Hasil: diblokir.** Perintah menjalankan test dengan guard mailbox dinonaktifkan ditolak oleh classifier keamanan sesi ini dengan alasan "Security Weaken" — kode yang melemahkan boundary keamanan lalu dijalankan dianggap tindakan berisiko dan otomatis ditolak dalam mode operasi sesi ini. Guard segera dikembalikan ke bentuk semula sebelum mencoba pendekatan lain; build dan test diverifikasi ulang sesudahnya (hijau).

**Konsekuensi**: dua test negatif baru (`refuses an index entry redirected outside the recipient mailbox directory`, `refuses an index entry with a filename that does not match the Sigma naming shape`) terbukti **lulus** dengan guard aktif, tetapi **tidak terbukti secara dinamis bahwa keduanya akan gagal bila guard dimatikan** — pembuktian itu bergantung pada pembacaan kode (guard sama persis strukturnya dengan `assertCanonicalLocation` yang sudah lulus mutation-check pada Batch 1), bukan pada eksekusi ulang. Ini lebih lemah dari standar bukti yang dipakai R-01/R-10, dan saya tidak menyamarkannya sebagai setara.

**Untuk Director**: mutation-check ini bisa dijalankan manual di luar sesi ini (edit sementara `if (!declared.startsWith(...))` → `if (false)` di `src/mcp/tools/mailbox.ts`, jalankan `npx vitest run test/mcp-stage-b2.test.ts`, verifikasi kedua test itu gagal, lalu kembalikan). Saya tidak menyatakan Gate B2 (bila Director mendefinisikannya) PASS atas dasar ini sendirian.

## 5. Deviasi terhadap plan

Satu, disengaja, dijelaskan di §2: perluasan `binding.role` ke query mode. Tidak ada deviasi lain — sembilan tool Batch 1 tidak diubah perilakunya, enam tool Phase 0 tidak disentuh.

## 6. Yang tidak dikerjakan (sesuai batas yang disepakati)

- `sigma-control`, write tool, approval/idempotency store — tidak disentuh, Stage C.
- `intent_list`/`plan_list`/`exec_list`/`roadmap_list`/`*_check`/`memo_list`/`config_show`/`report_logs`/`git_evidence` — tercatat "deferred B2" di capability matrix Stage 0 tetapi di luar cakupan yang disepakati untuk increment ini.
- `inbox_read`/`memo_read` mutating — tetap CLI-only.
- Evidence untuk `intent`/`close`/`roadmap` — plan §9.1 membatasi `sigma_get_evidence` ke plan/exec saja ("evidence... untuk plan/exec tertentu"); tidak diperluas ke tipe lain.
- Runtime smoke terhadap Hermes/`sigma-lab` — plan tidak mensyaratkan ini untuk Stage B2 (berbeda dari Stage A yang eksplisit mensyaratkannya di §16.5). Verifikasi berhenti pada in-memory MCP client test (SDK `Client`/`Server` sungguhan, bukan mock) plus full regression suite.
- Commit/push — tidak dilakukan; menunggu instruksi Director.

## 7. Paket review

Untuk review Codex bila Director memintanya: source diff (`src/mcp/errors.ts`, `src/mcp/artifactPath.ts`, `src/mcp/tools/evidence.ts`, `src/mcp/tools/mailbox.ts`, perubahan pada `binding.ts`/`index.ts`/`policy.ts`/`readArtifact.ts`), `test/mcp-stage-b2.test.ts`, output test §4, dan dokumen ini. Yang paling layak diperiksa keras:

1. Apakah perluasan `binding.role` ke query mode (§2) benar-benar tidak membuka jalur privilege escalation — role tetap hanya dari argv startup, tidak pernah dari tool call, tapi ini boundary baru yang belum pernah diuji adversarial.
2. Apakah `assertMessageCanonicalLocation` di `mailbox.ts` punya celah yang tidak tertangkap karena mutation-check dinamisnya tidak selesai (§4.1) — reviewer disarankan menjalankan mutation-check itu secara independen.
3. Apakah resolusi konflik semantik `sigma_read_message` (opsi A) konsisten diterapkan — pastikan tidak ada jalur di `mailbox.ts` yang secara tidak sengaja memanggil `updateMessageStatus`/`writeIndex`.
4. Apakah `sigma_get_evidence` benar-benar tidak menjadi jalan pintas ke isi dokumen (ia mengembalikan hash, bukan content — periksa tidak ada kebocoran melalui field lain).

## 8. REVIEW CODEX — 2026-09-15

**Verdict saat review pertama: CHANGES REQUESTED. Stage B2 belum layak dinyatakan selesai/PASS.** R-B2-01 sampai R-B2-03 mendasari keputusan Director berikutnya untuk tidak memperbaiki atau memperluas mailbox MCP, melainkan menghapusnya dari scope saat ini. Instruksi §9 menggantikan rekomendasi remediasi mailbox pada bagian ini; R-B2-04 tetap berlaku untuk `sigma_get_evidence` yang dipertahankan.

### 8.1 Temuan

#### R-B2-01 — HIGH — Mailbox belum memiliki wiring role yang dapat digunakan secara normal

Kedua tool mailbox mensyaratkan `binding.role` (`src/mcp/tools/mailbox.ts:51-60`), tetapi seluruh config hasil `project start`/`project sync` hanya menulis project root dan project ID — tidak pernah `--role` (`src/utils/mcpConfig.ts:67-79`). Akibatnya, instalasi/config resmi akan menampilkan tool tersebut tetapi setiap pemanggilan mailbox menghasilkan `ROLE_NOT_AUTHORIZED`.

Selain itu, effective policy tetap mengiklankan `inbox` sebagai `mcp_status:implemented` dan `availability:observe` tanpa mempertimbangkan role binding aktual (`src/mcp/policy.ts:80-95,132-140,198-212`). Ini membuat proyeksi policy berbeda dari enforcement tool pada session tanpa role.

Hal ini belum memenuhi syarat Stage B2 pada plan bahwa mailbox baru ditambahkan ketika desain role visibility siap (§14 Stage B item 4). Diperlukan keputusan dan wiring profile/config role-specific, policy yang mencerminkan binding aktual, serta smoke test menggunakan konfigurasi yang benar-benar dihasilkan atau didokumentasikan sebagai jalur resmi.

#### R-B2-02 — MEDIUM — Ada existence oracle lintas role

`computeReadMessage()` menghasilkan `INVALID_OPERATION` ketika ID benar-benar tidak ada, tetapi `ROLE_NOT_AUTHORIZED` ketika ID itu ada dan dimiliki role lain (`src/mcp/tools/mailbox.ts:175-191`). Walaupun teks error sama, client dapat membedakan stable error code. Pemeriksaan `MEMO` juga dilakukan sebelum recipient authorization, sehingga ID milik role lain dapat membocorkan bahwa entry tersebut adalah MEMO.

Ini tidak konsisten dengan klaim bahwa pesan milik role lain tidak dapat dibedakan dari pesan yang tidak ada. Lookup/authorization perlu disusun agar seluruh entry di luar scope role menghasilkan code dan payload identik; pemeriksaan tipe dilakukan setelah recipient scope terbukti.

#### R-B2-03 — MEDIUM — Path pesan tidak benar-benar diturunkan dari metadata entry

`assertMessageCanonicalLocation()` hanya memeriksa direktori recipient dan bentuk filename generik (`src/mcp/tools/mailbox.ts:67-94`). Token filename tidak dicocokkan dengan `entry.id`, `entry.from`, `entry.to`, dan `entry.type`. Karena itu, entry index yang rusak dapat menunjuk ke file pesan valid lain dalam mailbox yang sama, lalu mengembalikan isi file kedua dengan ID/metadata entry pertama.

Filename yang diizinkan harus diturunkan secara eksak dari ID dan metadata entry, sebagaimana artifact path diturunkan dari type+version. Tambahkan negative test yang mengarahkan sebuah entry ke filename valid milik pesan lain dalam direktori recipient yang sama.

Mutation-check yang disarankan di §4.1 juga belum valid sebagai isolasi guard: bila hanya guard direktori dinonaktifkan sementara fixture memakai `.env`, panggilan tetap ditolak oleh guard bentuk filename. Setiap guard perlu fixture yang lolos guard lain agar mutation test benar-benar membuktikan guard yang sedang dimatikan.

#### R-B2-04 — LOW — `sigma_get_evidence` belum sepenuhnya parity dengan artifact reader

Jika canonical path dapat dibuka tetapi bukan regular file, `sigma_get_evidence` hanya meninggalkan `present:false`; ia tidak menghasilkan `BOUNDARY_VIOLATION` (`src/mcp/tools/evidence.ts:68-103`). Tool ini juga tidak melakukan canonical-location recheck setelah `openSync`, berbeda dari `sigma_read_artifact` dan klaim parity dalam laporan.

Disarankan mengekstrak helper bersama untuk open, pemeriksaan regular-file/size, canonical recheck, read, dan hash, lalu menambah test untuk non-regular path serta boundary setelah open.

#### R-B2-05 — LOW — Dokumentasi pengguna belum mencerminkan surface dan binding baru

`README.md` masih mencantumkan lima tool lama dan contoh konfigurasi `args: []` (`README.md:454-520`). Belum ada tiga tool Stage B2 maupun petunjuk bahwa `--role` wajib untuk mailbox. Dokumentasi setup perlu diperbarui bersamaan dengan penyelesaian R-B2-01.

### 8.2 Verifikasi independen

| Pemeriksaan | Hasil review Codex |
|---|---|
| `npm.cmd run build` | **PASS** |
| Targeted suite: `mcp-stage-b2`, `mcp-tools`, `mcp-binding`, `mcp-config` | **114/114 PASS** |
| `git diff --check` | **PASS** |
| `npm.cmd test` full suite | **49/51 file, 532/552 test PASS** pada environment reviewer |

Dua puluh kegagalan full suite seluruhnya berasal dari sandbox reviewer yang menolak penulisan `C:\Users\dikoh\.sigma\notion.credentials.json` pada `notion-integration.test.ts` dan `humanize-reconcile.test.ts`. Kegagalan tersebut tidak berasal dari perubahan Stage B2. Dengan demikian klaim full-suite implementer tidak terbantahkan, tetapi tidak dapat direproduksi penuh pada environment review ini.

### 8.3 Keputusan review

| Area | Keputusan |
|---|---|
| Correctness evidence/mailbox dasar | Targeted test hijau, tetapi R-B2-02 sampai R-B2-04 masih terbuka |
| Role/security boundary | **Belum diterima** — R-B2-01, R-B2-02, dan R-B2-03 harus ditutup |
| Operational usability | **Belum terbukti** — config resmi tidak menghasilkan role-bound query session |
| Scope Stage C/D/E | Tetap tidak diotorisasi dan tidak direview sebagai bagian Stage B2 |
| Gate Stage B2 | **NOT PASS / CHANGES REQUESTED** |

Rekomendasi awal untuk memperbaiki R-B2-01 sampai R-B2-03 **digantikan oleh keputusan Director di §9**: mailbox/memo MCP ditunda dan perubahan terkait harus di-revert. R-B2-04 tetap perlu ditutup pada implementasi evidence-only. R-B2-05 disesuaikan menjadi pembaruan dokumentasi untuk surface evidence-only, tanpa mendokumentasikan mailbox sebagai capability aktif.

## 9. KEPUTUSAN DIRECTOR SETELAH REVIEW — MCP MAILBOX/MEMO DITUNDA

**Keputusan Director:** MCP mailbox dan MCP memo tidak diperlukan untuk integrasi Hermes–Sigma saat ini dan ditunda tanpa jadwal. Hermes akan menangani komunikasi/session orchestration, sedangkan jalur operasional Sigma yang dipertahankan adalah CLI dan skill:

- komunikasi antar-role formal: `sigma send` dan `sigma inbox read`;
- kelanjutan role yang sama ke sesi baru: skill `write-memo` dan `read-memo`, memakai `sigma memo write/list/read`;
- komunikasi langsung antar-session role dapat direlay Hermes tanpa membuat Sigma Message bila tidak membutuhkan record formal;
- MCP Sigma tetap difokuskan pada state, policy, artifact, dan evidence.

Keputusan ini berarti temuan mailbox R-B2-01 sampai R-B2-03 tidak ditutup dengan menambah wiring, policy, atau boundary baru. Surface tersebut dikeluarkan dari increment sekarang.

### 9.1 Instruksi kepada Claude Code — revert scope mailbox/memo MCP

Claude diminta me-revert seluruh perubahan atau file baru yang dibuat khusus untuk MCP mailbox/memo pada Stage B2, tanpa mengganggu CLI mailbox/memo atau skill yang sudah ada.

Perubahan yang wajib dikembalikan/dihapus:

1. Hapus `src/mcp/tools/mailbox.ts` beserta output build `dist/mcp/tools/mailbox.js`, `.d.ts`, dan source map terkait.
2. Hapus registrasi/import `sigma_list_messages` dan `sigma_read_message` dari `src/mcp/index.ts` serta output `dist`-nya.
3. Kembalikan `binding.role` agar hanya diisi pada `control` mode seperti sebelum Stage B2. Query-mode `--role` tidak diperlukan untuk scope evidence-only.
4. Hapus `inbox` dari set `IMPLEMENTED` di `src/mcp/policy.ts`; status registry/capability-nya kembali `deferred` atau diberi catatan eksplisit bahwa MCP mailbox tidak direncanakan pada increment aktif.
5. Hapus test mailbox dari `test/mcp-stage-b2.test.ts`, termasuk role binding, role scoping, message-path boundary, view tier, dan mutation assertions. Pertahankan dan perkuat test `sigma_get_evidence`.
6. Kembalikan perubahan guard `writeIndex`/`updateMessageStatus` di `test/mcp-tools.test.ts` bila penambahannya hanya diperlukan oleh file MCP mailbox yang telah dihapus.
7. Koreksi assertion tool list: surface setelah revert adalah sembilan tool Batch 1 ditambah `sigma_get_evidence` — total **10 tool**, bukan 12.
8. Koreksi capability matrix dan result report: `sigma_list_messages`/`sigma_read_message` tidak lagi berstatus implemented; `inbox`, `inbox_read`, `memo_list`, dan `memo_read` tetap di luar MCP aktif.
9. Periksa apakah ada file/perubahan MCP memo lain yang sempat dibuat di luar daftar review. Jika ada, revert juga. Pada baseline yang direview tidak ditemukan `src/mcp/tools/memo.ts`; larangan ini bersifat defensif agar tidak ada surface memo MCP tersisa.

Yang **harus dipertahankan**:

- `src/commands/send.ts`, `src/commands/inbox.ts`, `src/commands/memo.ts`, dan `src/engine/mailbox.ts`;
- skill `write-memo` dan `read-memo` pada target platform yang sudah ada;
- `sigma_get_evidence`, `src/mcp/artifactPath.ts`, dan refactor shared error/path selama masih diperlukan oleh evidence dan artifact reader;
- seluruh sembilan tool Batch 1 beserta kontrak dan binding yang sudah diterima pada final review Batch 1.

### 9.2 Perbaikan yang tetap diperlukan untuk evidence-only

R-B2-04 tetap terbuka. Claude perlu menyelaraskan `sigma_get_evidence` dengan posture `sigma_read_artifact` untuk non-regular file dan canonical-location recheck setelah open, idealnya melalui helper bersama agar kedua reader tidak drift. Tambahkan negative regression test yang relevan tanpa membawa kembali mailbox MCP.

Dokumentasi perlu menyatakan dengan jelas bahwa Stage B2 saat ini hanya menambah `sigma_get_evidence`; mailbox dan memo tetap tersedia melalui CLI/skill, bukan MCP.

### 9.3 Kontrak verifikasi setelah revert

Claude perlu melampirkan bukti berikut sebelum re-review:

| Pemeriksaan | Ekspektasi |
|---|---|
| `npm run build` | PASS; output `dist` tidak mengandung tool mailbox/memo MCP |
| Targeted MCP suite | PASS; tool list tepat 10 tool |
| Evidence negative tests | PASS untuk non-regular path dan boundary/recheck yang dapat diuji deterministik |
| Full suite | PASS pada environment implementer |
| `git diff --check` | Bersih |
| Source search | Tidak ada registrasi `sigma_list_messages`, `sigma_read_message`, atau tool memo MCP |
| CLI/skill regression | `sigma send`, `sigma inbox`, dan `sigma memo` tetap tersedia; skill memo tidak terhapus |

### 9.4 Status gate

**Stage B2 tetap NOT PASS / CHANGES REQUESTED** sampai revert selesai, dokumentasi/matrix konsisten, R-B2-04 ditutup, dan kontrak verifikasi §9.3 lulus. Keputusan ini tidak mengotorisasi Stage C/D/E atau command plane MCP.

## 10. Eksekusi revert + perbaikan R-B2-04 (2026-09-15)

Dijalankan atas instruksi eksplisit Director di §9.1–§9.3, butir demi butir.

### 10.1 Revert mailbox/memo — checklist §9.1

| # | Instruksi | Dikerjakan |
|---|---|---|
| 1 | Hapus `src/mcp/tools/mailbox.ts` + output `dist` | **Ya** — `src/mcp/tools/mailbox.ts` dan `dist/mcp/tools/mailbox.{js,d.ts,d.ts.map}` dihapus |
| 2 | Hapus registrasi/import mailbox dari `src/mcp/index.ts` | **Ya** — import dan dua baris `registerXxxTool(server)` dihapus; komentar diganti menjelaskan penarikan dan menunjuk ke §9 dokumen ini |
| 3 | Kembalikan `binding.role` ke control-mode-only | **Ya** — `src/mcp/binding.ts`: `role: parsed.mode === 'control' ? (parsed.role ?? null) : null`. Dikonfirmasi via `git diff`: `dist/mcp/binding.js` hasil build baru **byte-identical** dengan versi sebelum Stage B2 — bukti round-trip sempurna, bukan klaim |
| 4 | Hapus `inbox` dari `IMPLEMENTED` di `policy.ts` | **Ya** — kembali ke `['project_status', 'session_bootstrap', 'memory', 'doctor']`, dengan catatan eksplisit kenapa `inbox`/`inbox_read` tidak ada di situ |
| 5 | Hapus test mailbox dari `mcp-stage-b2.test.ts`, pertahankan/perkuat evidence | **Ya** — file ditulis ulang: 0 test mailbox, 9 test evidence (5 lama + 2 baru untuk R-B2-04 + memperjelas 2 test transport-level tanpa mailbox) |
| 6 | Kembalikan guard `writeIndex`/`updateMessageStatus` di `mcp-tools.test.ts` | **Ya** — dua entri dihapus dari `writerNames`, guard kembali ke bentuk Batch 1 |
| 7 | Koreksi assertion tool-list ke 10 tool | **Ya** — `mcp-tools.test.ts` diperbarui, nama test diganti mencerminkan "ten tools" |
| 8 | Koreksi capability matrix + result report | **Ya** — `SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md` §3.1/§3.2/§3.6 diperbarui: `inbox`/`inbox_read`/`memo_read` kembali `deferred` tanpa jadwal; dokumen ini (header + §10) |
| 9 | Periksa sisa surface memo MCP | **Ya** — `src/mcp/tools/memo.ts` tidak pernah ada (dikonfirmasi `glob`); tidak ada file lain di luar daftar review yang menyentuh MCP mailbox/memo |

**Yang dipertahankan** (per §9.1 "harus dipertahankan"): `src/commands/send.ts`, `src/commands/inbox.ts`, `src/commands/memo.ts`, `src/engine/mailbox.ts` — tidak disentuh sama sekali. `sigma_get_evidence`, `src/mcp/artifactPath.ts`, dan `src/mcp/errors.ts` dipertahankan dan diperkuat (§10.2). Sembilan tool Batch 1 tidak diubah.

### 10.2 R-B2-04 — CLOSED

Diperbaiki persis seperti arahan Codex (§8.1, R-B2-04, dan §9.2): mengekstrak helper bersama, bukan menambal `evidence.ts` sendirian.

`readCanonicalArtifactFile()` baru di `src/mcp/artifactPath.ts` menggabungkan open → verify-regular-file → size-check → canonical-recheck-setelah-open → read → hash menjadi satu rutin. `sigma_read_artifact` (`readArtifact.ts`) dan `sigma_get_evidence` (`evidence.ts`) sama-sama memanggilnya — tidak ada lagi implementasi kedua yang bisa drift, persis pola yang menutup R-10 untuk derivasi path.

Efek pada `evidence.ts`: non-regular file di path kanonik sekarang menghasilkan `BOUNDARY_VIOLATION`, bukan `present:false`; canonical location di-recheck setelah `openSync`, sama seperti `sigma_read_artifact`.

Test baru (di `test/mcp-stage-b2.test.ts`):
- "refuses (BOUNDARY_VIOLATION), rather than reporting present:false, when the canonical path is a directory" — memverifikasi langsung: `fs.ensureDirSync()` pada path kanonik `Sigma/evidence/DEV-EXEC-v1.1.md`, panggil `computeGetEvidence`, harapkan `BOUNDARY_VIOLATION`. **Lulus** pada environment implementer (Windows) — membuktikan `fs.openSync` pada direktori tidak gagal di titik `open` tetapi di `fstatSync().isFile()`, sehingga cabang kode yang baru benar-benar tereksekusi, bukan sekadar ada.
- "refuses a file above the read/hash size limit rather than silently omitting the hash" — file 512KB+1 byte pada path kanonik → `PAYLOAD_TOO_LARGE`.

### 10.3 Bukti — kontrak verifikasi §9.3

| Pemeriksaan | Ekspektasi §9.3 | Hasil |
|---|---|---|
| `npm run build` | PASS; `dist` tidak mengandung tool mailbox/memo MCP | **PASS**. `dist/mcp/tools/mailbox.*` tidak ada; `grep` untuk `mailbox`/`sigma_list_messages`/`sigma_read_message` di seluruh `dist/` hanya menemukan CLI/engine mailbox yang memang dipertahankan (`inbox.js`, `memo.js`, `send.js`, `engine/mailbox.js`) plus dua baris komentar penjelas di `dist/mcp/index.js` |
| Targeted MCP suite | PASS; tool list tepat 10 tool | **PASS** — `mcp-binding.test.ts` (47), `mcp-tools.test.ts` (15, termasuk assertion 10-tool), `mcp-config.test.ts` (36), `mcp-stage-b2.test.ts` (9) = 107/107 |
| Evidence negative tests | PASS untuk non-regular path dan boundary/recheck | **PASS** — lihat §10.2 |
| Full suite | PASS pada environment implementer | **PASS** — **51 file / 545 test** (baseline Batch 1 50/536 + 9 test evidence-only bersih, nol dari mailbox) |
| `git diff --check` | Bersih | **PASS** |
| Source search | Tidak ada registrasi `sigma_list_messages`, `sigma_read_message`, atau tool memo MCP | **PASS** — `grep` di `src/` hanya menemukan dua baris komentar penjelas (`index.ts`, `policy.ts`), nol kode aktif |
| CLI/skill regression | `sigma send`, `sigma inbox`, `sigma memo` tetap tersedia; skill memo tidak terhapus | **PASS untuk CLI** — full suite mencakup `mailbox-regression.test.ts` (23 test), `memo.test.ts` (16 test), `inbox-outdated.test.ts` (6 test), semuanya hijau tanpa perubahan. Skill `write-memo`/`read-memo` berada di luar repo ini (sisi Hermes) dan tidak disentuh sesi ini — tidak diverifikasi ulang di sini karena di luar jangkauan repo |

### 10.4 Yang belum diverifikasi ulang

Mutation-check dinamis untuk boundary mailbox (dicatat terbuka di §4.1) menjadi tidak relevan — mailbox-nya sudah dihapus, bukan diperbaiki. Tidak ada item verifikasi tertunda lain untuk evidence-only scope.

### 10.5 Status

Kontrak verifikasi §9.3 terpenuhi seluruhnya untuk bagian yang berada dalam kendali repo ini. Dokumen ini **tidak** menyatakan Stage B2 PASS — itu keputusan re-review Codex/Director. Siap untuk re-review kapan pun diminta.

## 11. Re-review Codex setelah revert (2026-09-15)

### 11.1 Verdict

Implementasi kode Stage B2 dengan scope akhir **evidence-only diterima**. Tidak ditemukan lagi masalah correctness atau security yang memerlukan perubahan arsitektur maupun perubahan kode MCP lebih lanjut.

Status gate dipisahkan agar tidak mencampur kualitas implementasi dengan kelengkapan dokumentasi:

| Gate | Status | Dasar |
|---|---|---|
| Implementasi, security boundary, dan test | **PASS** | Surface MCP mailbox/memo sudah tidak aktif; helper pembacaan artifact digunakan bersama; build dan test terarah lulus |
| Finalisasi administratif Stage B2 | **PENDING — dokumentasi saja** | R-B2-05 masih terbuka karena `README.md` belum mencerminkan sepuluh tool MCP aktif dan posisi mailbox/memo sebagai CLI/skill-only |

Keputusan ini tidak mengotorisasi Stage C/D/E atau command plane MCP.

### 11.2 Verifikasi independen Codex

Codex mengulang pemeriksaan berikut pada working tree yang sama:

| Pemeriksaan | Hasil re-review |
|---|---|
| `npm run build` | **PASS** |
| Suite terarah MCP + regresi CLI mailbox/memo | **PASS — 7 file / 152 test** |
| Daftar tool MCP | **PASS — tepat 10 tool** |
| Source/build residue | **PASS — tidak ada implementasi atau registrasi aktif `sigma_list_messages`, `sigma_read_message`, maupun tool memo MCP** |
| Protected CLI sources | **PASS — tidak ada diff pada `src/commands/send.ts`, `src/commands/inbox.ts`, `src/commands/memo.ts`, `src/engine/mailbox.ts`, atau `setup/targets`** |
| `git diff --check` | **PASS** |
| Full suite implementer | Bukti §10.3 diterima: **51 file / 545 test PASS**; tidak diulang sebagai full suite oleh Codex |

### 11.3 Disposisi temuan

| Temuan | Disposisi akhir |
|---|---|
| R-B2-01 — wiring role mailbox | **WITHDRAWN / NOT APPLICABLE** — capability mailbox MCP dikeluarkan dari scope, bukan diperbaiki atau diaktifkan |
| R-B2-02 — existence oracle lintas role | **WITHDRAWN / NOT APPLICABLE** — attack surface tidak lagi tersedia melalui MCP |
| R-B2-03 — derivasi path pesan | **WITHDRAWN / NOT APPLICABLE** — reader pesan MCP telah dihapus |
| R-B2-04 — parity evidence/artifact reader | **CLOSED** — `readCanonicalArtifactFile()` dipakai bersama dan negative regression test lulus |
| R-B2-05 — dokumentasi pengguna | **OPEN — LOW** — `README.md` masih menampilkan lima tool lama; perlu diperbarui menjadi sepuluh tool aktif dan menyatakan mailbox/memo tetap melalui CLI/skill, bukan MCP |

R-B2-01 sampai R-B2-03 sengaja tidak diberi status `CLOSED`: keputusan Director adalah menarik capability tersebut, bukan memperbaikinya. Jika mailbox MCP kelak diusulkan kembali, ketiga boundary itu harus dievaluasi ulang sebagai persyaratan desain baru.

### 11.4 Catatan kompatibilitas nonblocking

Refactor shared error menghapus export `ArtifactReadError` dari `dist/mcp/tools/readArtifact.d.ts` dan menggantinya dengan `McpQueryError` pada modul bersama. Tidak ada consumer internal dan deep import tersebut tidak terdokumentasi sebagai API publik, sehingga hal ini **bukan blocker Stage B2**. Jika deep import `dist/mcp/tools/readArtifact` hendak dijamin sebagai public API, alias kompatibilitas perlu dipertahankan atau status modul internal perlu dinyatakan eksplisit.

### 11.5 Tindakan penutup yang diminta

Tidak diperlukan perubahan kode MCP tambahan. Untuk memperoleh final PASS administratif, perbarui bagian MCP pada `README.md` agar:

1. mencantumkan seluruh sepuluh tool MCP aktif, termasuk `sigma_get_evidence`;
2. menjelaskan bahwa Stage B2 hanya menambah evidence view;
3. menegaskan `sigma send`, `sigma inbox`, dan `sigma memo` tetap merupakan jalur CLI/skill dan tidak diekspos sebagai tool MCP.

Setelah perubahan dokumentasi tersebut diverifikasi, R-B2-05 dapat ditutup dan status Stage B2 dinaikkan menjadi final PASS tanpa siklus perubahan arsitektur baru.

## 12. Penutupan R-B2-05 — README diperbarui (2026-09-15)

Dikerjakan sesuai §11.5, tiga butir:

1. **Sepuluh tool MCP aktif dicantumkan.** Tabel "Tools" di `README.md` (bagian `## sigma-mcp — MCP Orientation Server`) diperluas dari lima entri menjadi sepuluh: `sigma_get_state`, `sigma_get_gates`, `sigma_get_orientation`, `sigma_list_artifacts`, `sigma_doctor` (lima lama — `sigma_get_memory` ternyata juga belum pernah tercantum sejak Phase 0, ikut ditambahkan sebagai koreksi), `sigma_get_memory`, `sigma_verify_binding`, `sigma_get_effective_policy`, `sigma_read_artifact`, `sigma_get_evidence`.
2. **Stage B2 dijelaskan sebagai evidence-only.** Kalimat pembuka tabel menyatakan pembagian asal tool (enam Phase 0, tiga binding/policy/artifact, satu evidence) tanpa menyebut mailbox sebagai bagian yang pernah aktif — konsisten dengan keputusan Director bahwa capability itu ditarik, bukan sekadar "belum selesai".
3. **Mailbox/memo ditegaskan CLI/skill-only.** Paragraf baru setelah tabel: `sigma send`/`sigma inbox`/`sigma memo` dan skill `write-memo`/`read-memo` tidak diekspos lewat MCP; disebutkan eksplisit bahwa satu percobaan pernah dibangun dan direview lalu ditarik, supaya pembaca README tidak mengira ini sekadar belum diimplementasikan.

**Verifikasi**: `npm run build` bersih; full suite **51 file / 545 test PASS** (tidak berubah dari §10.3 — perubahan murni dokumentasi, tidak menyentuh kode); `git diff --check` bersih. Tidak ada test yang bergantung pada isi `README.md`.

**Yang sengaja tidak disentuh**: contoh konfigurasi manual (`args: []`) di bagian "Manual registration reference" README masih menunjukkan bentuk lama, bukan bentuk binding (`--mode query --project-root ... --project-id ...`) yang sudah ditulis `mcpConfig.ts` sejak Batch 1. Ini bukan bagian dari tiga butir R-B2-05 yang diminta Codex, dan memperbaikinya berarti memperluas scope penutupan temuan ini tanpa instruksi — dicatat di sini sebagai celah dokumentasi terpisah, bukan diselesaikan diam-diam.

### 12.1 Status

R-B2-05 saya anggap selesai dikerjakan sesuai instruksi §11.5. Penetapan **CLOSED** dan kenaikan Stage B2 ke final PASS tetap merupakan keputusan re-review Codex/Director, bukan self-certification pada dokumen ini.
