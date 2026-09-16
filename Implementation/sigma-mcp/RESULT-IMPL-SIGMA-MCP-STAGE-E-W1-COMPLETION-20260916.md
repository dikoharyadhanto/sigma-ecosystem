# RESULT-IMPL â€” Stage E W1 completion batch (7 primitive)

**Tanggal**: 2026-09-16
**Sumber**: `PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` Â§14 Stage E, menuntaskan seluruh operasi W1 yang masih `deferred` per instruksi Director, kecuali `send`/`memo_write` (di luar rotasi, butuh desain ulang terpisah â€” mailbox/memo sempat dibangun ke MCP lalu di-revert Director) dan `config_set_language` (dilewati atas kesepakatan â€” nilai rendah bagi AI role).
**Konteks eksekusi**: dikerjakan sementara Codex (reviewer independen) rate-limited, atas instruksi eksplisit Director untuk lanjut tanpa menunggu. Batch ini menyusul empat RESULT report Stage E sebelumnya (fix fondasi `chain.ts`/`controlStore.ts`, `plan_draft`, `exec_draft`, perluasan `update_artifact_draft`) yang masih menunggu review.
**Peran implementer**: Claude Code sebagai implementator; Codex sebagai reviewer independen berikutnya. Dokumen ini **tidak** men-declare "Gate PASS" untuk satu pun primitive di bawah.
**Status**: Implementasi + test contract penuh selesai untuk ketujuh primitive, satu putaran self-review adversarial dilakukan. Menunggu review independen Codex.

## 1. Ringkasan tujuh primitive

| Primitive | Tool MCP | Role | Sumber CLI | Catatan struktural |
|---|---|---|---|---|
| `roadmap_new` | `sigma_create_roadmap_draft` | FMN | `sigma roadmap new` | `chain.roadmap` objek tunggal, versi = `chain.chain_version` (bukan counter independen) |
| `roadmap_render` | `sigma_render_roadmap` | FMN | `sigma roadmap render` | **Tidak** menyentuh `progress-v<N>.json` â€” `state_revision` tidak bergerak. Deterministik, idempoten. |
| `reference_update` | `sigma_update_reference` | semua (4 role) | `sigma reference update` | Tidak tersentuh chain/gate sama sekali â€” "Not tracked in progress-v<N>.json" |
| `intent_humanize` | `sigma_intent_humanize` | ARC | `sigma intent humanize` | `--v` memilih **chain lain sepenuhnya** |
| `exec_humanize` | `sigma_exec_humanize` | DEV | `sigma exec humanize` | `--v` memilih versi **dalam array** `chain.exec.versions[]`; precondition ganda (exec LOCKED + plan LOCKED) |
| `close_humanize` | `sigma_close_humanize` | AUD | `sigma close humanize` | Tidak ada selector versi sama sekali |
| `inbox_archive` | `sigma_inbox_archive` | semua (4 role), dengan ownership check | `sigma inbox archive` | **Bukan port murni** â€” lihat Â§3 |

## 2. File yang berubah

**Service baru** (`src/services/`): `roadmapService.ts`, `referenceUpdateService.ts`, `intentHumanizeService.ts`, `execHumanizeService.ts`, `closeHumanizeService.ts`. **MCP-only** (`src/mcp/control/`): `inboxArchive.ts` (lihat Â§3 untuk alasan tidak di `src/services/`).

**MCP tool baru** (`src/mcp/control/tools/`): `createRoadmapDraft.ts`, `renderRoadmap.ts`, `updateReference.ts`, `intentHumanize.ts`, `execHumanize.ts`, `closeHumanize.ts`, `archiveMessage.ts`. Terdaftar di `src/mcp/control/index.ts` â€” total tool control-plane sekarang **13** (dari 6 sebelum batch ini: intent_draft, update_artifact_draft, prepare/commit_intent_ratify, plan_draft, exec_draft).

**CLI direfactor** memanggil service baru: `src/commands/roadmap.ts` (`new`, `render`), `src/commands/reference.ts` (`update`), `src/commands/intent.ts` (`humanize`), `src/commands/exec.ts` (`humanize`), `src/commands/close.ts` (`humanize`). `src/commands/inbox.ts` **tidak disentuh** (lihat Â§3).

**Test baru**: `test/control-roadmap.test.ts` (28 test), `test/control-reference-update.test.ts` (15 test), `test/control-humanize.test.ts` (32 test, tiga tipe), `test/control-inbox-archive.test.ts` (23 test). Total **98 test baru** untuk batch ini.

**Diubah**: `test/control-intent-draft.test.ts` (daftar exact-match tool: 6 â†’ 13), `test/mcp-tools.test.ts` (guard defense-in-depth: +7 nama fungsi writer baru), `Implementation/sigma-mcp/SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md` (7 baris â†’ implemented).

## 3. Deviasi signifikan â€” `sigma_inbox_archive` (satu-satunya yang bukan port CLI murni)

CLI `sigma inbox archive <message-id>` (`src/commands/inbox.ts`) **tidak punya pengecekan role/ownership sama sekali** â€” tidak ada `--role`, siapa pun yang tahu message ID bisa mengarsipkan pesan role mana pun. Ini ditoleransi untuk CLI (butuh akses terminal manusia) tapi menjadi gap nyata begitu jadi callable AI role/orchestrator lewat MCP.

**Keputusan Director (2026-09-16, klarifikasi eksplisit)**: tambahkan ownership check baru â€” bound role hanya boleh mengarsipkan pesan yang `to`-nya adalah role itu sendiri (`ROLE_NOT_AUTHORIZED` bila tidak).

Implementasi: `src/mcp/control/inboxArchive.ts` (**bukan** `src/services/`, karena ini logic MCP-spesifik yang sengaja tidak dipakai CLI â€” mirror alasan Stage C untuk `artifactDraftUpdate.ts`). `allowedRoles` di level tool: keempat AI role (pola dua-lapis: gate kasar di `allowedRoles`, ownership check granular di dalam `mutate()` â€” pola baru, belum pernah dipakai primitive sebelumnya). **CLI `inbox.ts` tidak direfactor dan tidak diberi ownership check** â€” di luar cakupan yang diminta, dan CLI command ini tidak punya konsep role/binding untuk dibandingkan. Dikonfirmasi lewat re-run penuh `test/mailbox-regression.test.ts` (23 test, termasuk test `archive <id>` sendiri) tanpa perubahan sedikit pun.

Reuse `readIndex`/`writeIndex`/`updateMessageStatus` dari `src/engine/mailbox.ts` tanpa modifikasi â€” hanya gate ownership di depannya yang baru. Tidak pernah membaca/mengembalikan isi pesan (beda dari `inbox_read`/`memo_read` yang direvert â€” itu R-B2-01/02/03 soal *penyajian konten*, ini murni membalik satu field status).

## 4. Deviasi kecil lain

- **Kode error `GATE_BLOCKED` vs `INVALID_OPERATION`**: dipertahankan konsisten dengan prinsip yang sudah dipakai â€” `GATE_BLOCKED` khusus untuk check yang setara dengan progresi lifecycle registry gate (mis. `roadmap_new`'s "requires ratified DIR-INTENT", yang menduduki posisi Gate 1â†’ROADMAP dalam lifecycle). Precondition humanize (RATIFIED/LOCKED/exists) memakai `INVALID_OPERATION` karena eksplisit didokumentasikan kode sebagai "bookkeeping record, not a gate transition" â€” tidak mempengaruhi `chain.gates.*` sama sekali.
- **`roadmap_new`'s 1:1 guard** (`registerRoadmapDraft()` di `chain.ts`) awalnya hanya melempar `Error` polos (tanpa `.code`), yang akan jatuh ke `INTERNAL_ERROR` di wrapper. Ditambahkan pre-check eksplisit di `roadmapService.ts` dengan pesan identik agar menghasilkan `INVALID_OPERATION` yang benar â€” `registerRoadmapDraft()`'s guard sendiri dipertahankan sebagai backstop defensif, bukan dihapus.
- **`roadmap render`'s fallback path** (`chain.roadmap.file ?? roadmapPath`) â€” versi service mengembalikan path **relatif** sebagai fallback, bukan absolut seperti CLI asli. Tidak ada test yang mengunci format ini (dikonfirmasi sebelum berubah); path relatif lebih konsisten dengan prinsip "tidak membocorkan host path absolut ke model" yang berlaku di seluruh permukaan MCP lain.

## 5. Test dan evidence

**Baru**: 98 test di 4 file (Â§2). Kategori per primitive mengikuti kontrak baku: role/gate boundary, stale-state, idempotency (replay/conflict/concurrent), crash-window (record "failed"/pending-tanpa-journal fail-closed), transport-level (real MCP client), cross-process concurrency + failpoint recovery (`it.each`, proses nyata di-`SIGKILL`). Kategori tambahan spesifik:
- `roadmap_render`: `state_revision` tidak bergerak; idempoten byte-identical; berhasil pada state DRAFT/LOCKED/SUPERSEDED.
- `reference_update`: idempotent replay tanpa duplikasi baris; typed error untuk tabel malformed; ditemukan dan dikoreksi asumsi test yang salah soal baris contoh `LA01`/`example.csv` bawaan template (selalu muncul "missing" di fixture segar â€” bukan bug implementasi, koreksi assertion).
- Humanize x3: precondition spesifik per tipe, semantik `--force`, cross-process untuk ketiganya, failpoint matrix penuh untuk intent (representatif â€” lihat Â§6).
- `inbox_archive`: role pemilik pesan berhasil (`it.each` keempat role), role lain ditolak dengan index tidak berubah, file `.md` pesan tidak pernah tersentuh, failpoint matrix penuh.

**Regresi**:
- `npm run build` â€” bersih di setiap titik penambahan primitive (bukan hanya di akhir).
- `npm test` â€” **61 file / 785 test PASS** (naik dari baseline 57 file/687 test sebelum batch ini; delta murni 98 test baru minus beberapa reorganisasi kecil).
- Seluruh test CLI existing yang berpotensi tersentuh dijalankan ulang dan PASS tanpa perubahan: `test/roadmap-stage-overview.test.ts`, `test/doc-check.test.ts`, `test/reference-list.test.ts` (7 test), `test/humanize-fase1/fase3/fase6-gate/fidelity-coverage/reconcile/terminology-scan/detail-level-parity.test.ts` (92 test gabungan, termasuk assertion pesan presisi untuk ketiga humanize command), `test/mailbox-regression.test.ts` (23 test, membuktikan CLI `inbox archive` benar-benar tidak berubah).

## 6. Self-review adversarial (satu putaran per primitive, sebelum serah terima ke Codex)

- **Role server-derived** di seluruh tujuh primitive â€” tidak ada satu pun yang menerima role dari argumen tool.
- **`project_root` tidak ada di skema tool manapun** â€” dicakup test generik yang meloop seluruh 13 tool control-plane.
- **Parity pesan CLI**: setiap pesan error yang diporting diverifikasi dulu terhadap test existing sebelum digeneralisasi (pelajaran eksplisit dari regresi pesan di `exec_draft`, dicatat ulang di RESULT itu) â€” tidak ada pesan yang berubah tanpa alasan terdokumentasi.
- **`inbox_archive`'s ownership check** diuji baik di level service langsung maupun lewat `respondControlWrite` penuh, termasuk pembuktian bahwa percobaan yang ditolak tidak meninggalkan efek (index tidak berubah, file `.md` tidak tersentuh).
- **Cakupan review berjenjang**: primitive dengan business logic paling kompleks (`roadmap_new`'s 1:1 guard, humanize x3's precondition berbeda per tipe, `inbox_archive`'s ownership check baru) mendapat test dedicated untuk setiap cabang keputusan. Primitive yang murni derivasi/proxy (`roadmap_render`, `reference_update`) mendapat cakupan idempotency/determinism sebagai fokus utama, bukan diulang failpoint matrix penuh â€” `intent_humanize` menjadi representatif satu putaran failpoint penuh untuk keluarga humanize, karena mesin `respondControlWrite()` yang mendasarinya sudah terbukti generik dan identik di ketujuh primitive (dibuktikan berulang kali sejak Stage C).

## 7. Yang masih tersisa (di luar cakupan batch ini)

- `sigma_send_message`/`sigma_write_memo` â€” eksplisit di luar rotasi, butuh desain ulang terpisah pasca-revert.
- `config_set_language` â€” dilewati atas kesepakatan (nilai rendah bagi AI role).
- Seluruh Tier W2 (governance transition) selain `intent_ratify` â€” 9 item (`intent_amendment/score/supersede/activate`, `plan_lock/supersede/promote`, `exec_lock`, `close_new/lock`) â€” belum tersentuh, masing-masing akan butuh ticket/approval primitive sendiri dan review setara `intent_ratify` (4+ putaran adversarial pada Stage D).
- Stage B2 (query plane read-only, ~18 operasi) â€” track terpisah dari Stage E command, belum tersentuh.
- Tier W3/NA â€” permanen di luar cakupan AI role sampai ada plan keamanan terpisah.

## 8. Status akhir

`git status` menunjukkan seluruh perubahan batch ini sebagai working-tree diff/untracked; tidak ada commit yang dibuat oleh implementer. Empat dokumen Discussion baru (`2026-09-16_proposal-{anthropic,deepseek,gemini,openai}-model-role-mapping-cost-balance.md`) juga terlihat di working tree â€” **bukan dibuat oleh implementer dalam sesi ini**, dicatat di sini untuk transparansi, tidak disentuh/dihapus. Menunggu review Codex (aktif kembali) dan keputusan Director soal commit/lanjut ke Tier W2.

## 9. Review teknis independen - 2026-09-16

**Status: PARTIAL PASS; bukan completion penuh W1.** Ketujuh primitive yang dilaporkan memiliki implementasi source dan test yang substantif; build TypeScript, targeted test Stage E, dan suite penuh selesai tanpa kegagalan yang terlapor. Namun dokumen tidak boleh dinyatakan sebagai penyelesaian seluruh W1 Plan Doc.

### Bukti yang diperiksa dan terverifikasi

- `respondControlWrite()` menyediakan binding control terverifikasi, role enforcement, stale-state check, idempotency, project lock, transaction journal/recovery, dan audit record dengan field Plan Doc §17.
- `sigma-control` adalah binary/server terpisah; kode config tidak memasangnya secara otomatis. Source `binding.ts`/control startup menolak control mode tanpa root, project ID, dan role terverifikasi.
- Ketujuh primitive terdaftar sebagai typed tools; tidak ada generic shell atau arbitrary file-path tool.
- `inbox_archive` menggunakan helper engine mailbox yang sama (`readIndex`, `updateMessageStatus`, `writeIndex`) untuk efek persistensi dan test membuktikan ownership deny tidak mengubah index/file.

### Temuan substantif

1. **H-01 - `sigma_record_evidence` terlewat.** Plan Doc §9.2 memasukkan `sigma_record_evidence` ke pilot bounded command. Source dan capability matrix tidak menunjukkan primitive tersebut, sementara `send` serta `memo_write` tetap deferred. Karena itu label "W1 completion" tidak akurat. Ubah menjadi batch parsial atau catat keputusan Director yang secara eksplisit menunda `record_evidence`.

2. **H-02 - deviasi service-layer `inbox_archive` perlu diformalkan.** Tidak ada defect keamanan langsung: ownership check MCP benar-benar melindungi role-bound caller dan mutation akhir memakai helper engine yang sama dengan CLI. Namun source secara sengaja membuat use case MCP-only, sementara Plan Doc §13 menyatakan service use case menjadi jalur bersama CLI dan MCP. Ini adalah deviasi arsitektur, bukan bukti duplication penuh atau kegagalan test. Director perlu memilih: (a) exception Plan yang terdokumentasi untuk policy MCP-only ini, atau (b) refactor service bersama dengan actor context yang membedakan terminal tepercaya dan binding MCP.

3. **D-01 - keputusan hash precondition.** Seperti plan/exec draft, Plan Doc perlu memperjelas apakah `expected_artifact_sha256` diwajibkan juga untuk artifact yang hanya dibaca sebagai precondition.

### Koreksi terhadap catatan review sebelumnya

Klaim bahwa evidence package tidak ada, policy availability tidak terbukti, audit tidak tersedia, atau seluruh recovery harus diuji ulang per primitive **dicabut**. Source dan test menunjukkan mekanisme bersama tersebut ada dan bekerja. Catatan yang benar adalah traceability report perlu menyertakan rujukan test/source, bukan membangun ulang bukti.
