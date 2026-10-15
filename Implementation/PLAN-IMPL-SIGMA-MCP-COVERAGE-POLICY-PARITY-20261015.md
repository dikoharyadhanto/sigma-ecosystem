# PLAN IMPLEMENTASI — Sigma MCP Coverage, Policy, dan Parity

**Tanggal:** 2026-10-15
**Status:** Draf untuk review Director
**Jenis:** Work order dan test contract
**Batas kewenangan:** Dokumen ini tidak mengaktifkan atau meregistrasikan repository sebagai proyek Sigma. Implementasi, commit, dan push tidak termasuk dalam rencana ini.

## 1. Tujuan

Menyelaraskan operasi Sigma CLI, registry operasi, kebijakan MCP, dan tool MCP aktual agar:

1. status dukungan setiap operasi dapat diverifikasi secara mekanis;
2. operasi yang layak diakses melalui MCP tersedia pada plane yang tepat;
3. operasi yang sengaja tetap CLI-only memiliki alasan eksplisit;
4. tool query tidak menulis state dan tool control tetap dibatasi oleh project serta role binding;
5. tombstone tidak kembali dianggap sebagai operasi aktif.

## 2. Baseline terverifikasi

Baseline audit tanggal 2026-10-15:

- `sigma --version`: `2.1.0`.
- Registry `Sigma/SIGMA-OPERATION-REGISTRY.json`: 89 entri, terdiri dari 86 operasi aktif dan 3 tombstone (`intent_lock`, `plan_lock`, `exec_lock`).
- Server query MCP: 26 tool aktual.
- Server control MCP: 37 tool aktual, termasuk 4 tool kompatibilitas prepare/commit yang berkaitan dengan tombstone plan/exec lock.
- Audit awal mengidentifikasi 47 pemetaan exact/functional terhadap 86 operasi aktif. Angka ini harus diregenerasi secara mekanis saat implementasi, bukan dipertahankan sebagai hitungan manual.
- `src/mcp/policy.ts` memiliki 86 key tetapi tidak memuat `notes_new`, `notes_list`, dan `notes_update`.
- Set `IMPLEMENTED` dan hasil `mcp_status` saat ini tidak merepresentasikan tool MCP aktual secara andal.
- Matriks `Implementation/sigma-mcp/SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md` masih memakai baseline lama dan tidak boleh menjadi sumber kebenaran.
- Hanya server query yang dikonfigurasi otomatis pada lingkungan saat ini. Server control tetap manual.
- Repository ini bukan proyek Sigma aktif karena tidak memiliki `Sigma/activate_status.json`.

## 3. Keputusan desain yang direkomendasikan

### 3.1 Sumber kebenaran capability

Buat manifest capability yang dapat dibaca kode dan test, dengan satu record per operasi registry aktif. Field minimum:

- `operation_id`;
- `plane`: `query`, `control`, `cli_only`, atau `deferred`;
- `mcp_status`: `implemented`, `deferred`, atau `not_admissible`;
- `tool_names`: nol, satu, atau beberapa nama tool MCP;
- `mapping`: `exact`, `functional`, `partial`, atau `none`;
- `rationale`;
- `risk_class` dan prasyarat role/project bila relevan.

Manifest menjadi sumber bagi policy reporting dan parity test. Daftar tool aktual tetap berasal dari registrasi server; test membandingkan keduanya sehingga deklarasi tidak dapat menyimpang diam-diam dari implementasi.

### 3.2 Pemisahan plane

- **Query:** operasi read-only, tidak membuat ticket, tidak menulis log/state proyek, dan tidak mengubah Git.
- **Control:** operasi yang menulis artefak/state atau membuat serta mengonsumsi ticket. Server tetap manual, project-bound, role-bound, dan tidak diaktifkan otomatis.
- **CLI-only:** operasi lokal/administratif, bootstrap, setup, konfigurasi host, atau operasi yang lebih aman dijalankan eksplisit oleh manusia.
- **Deferred:** operasi yang layak dipertimbangkan tetapi desain keamanan atau kontraknya belum disepakati.

### 3.3 Tidak ada registrasi implisit

Discovery, start-up server, diagnostic, maupun pemanggilan tool tidak boleh:

- menjalankan `sigma project register` atau ekuivalennya;
- membuat `Sigma/activate_status.json`;
- mengubah repository non-Sigma menjadi proyek Sigma;
- mengaktifkan control plane secara otomatis.

## 4. Ruang lingkup implementasi

### WP-MCP-01 — Rekonsiliasi inventaris

1. Ekstrak seluruh operation ID aktif dan tombstone dari registry.
2. Introspeksi tool query dan control dari server hasil build.
3. Petakan setiap tool ke operation ID secara exact, functional, partial, atau none.
4. Tandai tool kompatibilitas historis yang tidak boleh dihitung sebagai dukungan operasi aktif.
5. Hasilkan laporan parity yang deterministik untuk test dan dokumentasi.

**Keluaran:** inventaris mesin-terbaca dan laporan perbedaan registry–policy–server.

### WP-MCP-02 — Perbaikan policy

1. Ganti daftar `IMPLEMENTED` statis yang tidak lengkap dengan data manifest capability.
2. Tambahkan operasi notes yang hilang.
3. Pastikan `sigma_get_effective_policy` melaporkan status berdasarkan manifest dan tool yang benar-benar terdaftar.
4. Bedakan `not_admissible` dari `deferred`:
   - `not_admissible`: sengaja tidak boleh menjadi MCP berdasarkan boundary keamanan;
   - `deferred`: belum diimplementasikan atau desain belum final.
5. Tolak operation ID tombstone sebagai target capability baru.

**Keluaran:** policy yang konsisten dan dapat diuji.

### WP-MCP-03 — Penambahan query tools prioritas

Tambahkan atau sempurnakan tool berikut:

| Operasi CLI | Tool MCP yang direncanakan | Kontrak utama |
|---|---|---|
| `review_check` | `sigma_review_check` | Menghitung hasil review tanpa menulis artefak. |
| `close_check` | `sigma_close_check` | Mengevaluasi Gate 3 dan Product Review sebelum CLOSE tersedia; tidak disamakan dengan pemeriksaan dokumen CLOSE. |
| `dev_status` | `sigma_dev_status` | Membaca status workspace/development tanpa mutasi. |
| `notes_list` | `sigma_notes_list` | Membaca daftar notes dengan filter tervalidasi. |
| `intent_baseline_check` | `sigma_intent_baseline_check` | Memeriksa kelayakan baseline tanpa adopsi. |
| `intent_amendment_preview` | `sigma_intent_amendment_preview` | Menghasilkan preview tanpa membuat amendment. |
| `plan_revise_check` | `sigma_plan_revise_check` | Hanya bagian evaluasi read-only; tidak membuat ticket atau revisi. |

Catatan: `close_check` harus memiliki tool khusus karena `sigma_check_document(type=close)` hanya memeriksa dokumen yang sudah ada dan bukan ekuivalen fungsional.

### WP-MCP-04 — Penambahan control tools prioritas

Tambahkan operasi mutasi yang kontraknya sudah cukup jelas:

| Operasi CLI | Bentuk MCP yang direncanakan | Boundary |
|---|---|---|
| `review_new` | prepare/commit atau satu commit berticket sesuai pola yang berlaku | Project-bound dan role-bound. |
| `notes_new` | prepare/commit | Validasi target dan path containment. |
| `plan_revise_prepare` | prepare | Menghasilkan ticket deterministik, tanpa revisi. |
| `plan_revise_commit` | commit | Mengonsumsi ticket sekali pakai dan menolak state kedaluwarsa. |
| bagian ticket dari `plan_revise_check` | control-specific prepare | Dipisahkan tegas dari query check read-only. |

Nama final tool mengikuti konvensi server control yang sudah digunakan. Pemisahan prepare/commit dipertahankan untuk operasi dengan dampak material atau risiko stale state.

### WP-MCP-05 — Klasifikasi operasi yang tidak ditambahkan sekarang

#### Deferred: mailbox/message

Operasi berikut tidak didesain rinci dalam rencana ini karena kontrak message akan dibahas terpisah dengan Director:

- `inbox`, `inbox_read`, `inbox_clear`;
- `send`;
- `memo_write`, `memo_list`, `memo_read`, `memo_clear`.

Status sementara: `deferred`, bukan `not_admissible`, sampai keputusan tentang transport, audience/role binding, attachment, lifecycle, dan approval dibuat.

#### Direkomendasikan tetap CLI-only

Kelompok berikut tidak memperoleh MCP pada iterasi ini:

- bootstrap dan lifecycle host: `project_start`, `project_sync`, `project_register`;
- instalasi: `setup_install`, `setup_update`, `setup_uninstall`;
- konfigurasi: `config`, `config_set_language`, `config_set_mailbox_outdate_keep`, `config_set_memo_limit`;
- authority/manual governance: `override`, `control_show`, `control_approve`, `control_reject`;
- lifecycle intent sensitif: `intent_activate`, `intent_baseline_adopt`;
- operasi lingkungan atau workspace: `dev_create_workspace`, `scan`, bagian mutasi dari `doctor`;
- operasi yang memerlukan resolusi manusia eksplisit: `decisions_resolve`;
- `notes_update`, sampai kontrak concurrency dan target note ditetapkan.

Alasan per operasi harus dicatat di manifest. Klasifikasi ini dapat berubah melalui review terpisah; bukan larangan permanen.

### WP-MCP-06 — Tombstone dan kompatibilitas

1. Registry tombstone tidak boleh dilaporkan sebagai operasi aktif.
2. Tool historis yang masih diperlukan untuk kompatibilitas harus diberi metadata `legacy_compatibility` dan tidak dipakai untuk memperluas capability baru.
3. Dokumentasi harus membedakan tool kompatibilitas dari dukungan operasi aktif.
4. Penambahan pemetaan baru ke `intent_lock`, `plan_lock`, atau `exec_lock` harus gagal pada test.

### WP-MCP-07 — Dokumentasi

1. Regenerasi matriks capability dari manifest atau generator yang sama.
2. Perbarui komentar kebijakan yang masih merujuk baseline lama.
3. Dokumentasikan cara mengaktifkan control server secara manual tanpa mendaftarkan proyek.
4. Dokumentasikan perbedaan exact, functional, partial, dan none.
5. Tandai tanggal serta versi registry yang menjadi baseline hasil generasi.

## 5. Area kode yang diperkirakan berubah

Daftar ini bersifat target inspeksi, bukan izin perubahan di luar implementasi yang kelak disetujui:

- `src/mcp/policy.ts`;
- modul baru atau yang ada untuk manifest capability MCP;
- registrasi server query MCP;
- registrasi server control MCP;
- schema/handler tool prioritas;
- test MCP, policy, security boundary, dan parity;
- `Implementation/sigma-mcp/SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md` atau penggantinya yang dihasilkan otomatis;
- dokumentasi operasional MCP yang terkait.

## 6. Kriteria penerimaan

| ID | Kriteria |
|---|---|
| AC-MCP-01 | Seluruh operation ID registry aktif memiliki tepat satu klasifikasi capability. |
| AC-MCP-02 | Seluruh tool query/control aktual dipetakan ke operation ID aktif atau ditandai eksplisit sebagai legacy/internal. |
| AC-MCP-03 | Policy melaporkan `implemented` hanya bila tool yang dipetakan benar-benar terdaftar pada plane yang ditentukan. |
| AC-MCP-04 | `notes_new`, `notes_list`, dan `notes_update` tidak lagi hilang dari policy. |
| AC-MCP-05 | Tujuh query tools prioritas tersedia dan terbukti tidak menulis state. |
| AC-MCP-06 | Control tools prioritas menerapkan role binding, project binding, path containment, dan ticket semantics yang ditetapkan. |
| AC-MCP-07 | `sigma_close_check` tidak diimplementasikan sebagai alias pemeriksaan dokumen CLOSE. |
| AC-MCP-08 | Tombstone tidak dihitung sebagai operasi aktif dan tidak dapat memperoleh capability baru. |
| AC-MCP-09 | Menjalankan query server atau parity test pada repository ini tidak meregistrasikan proyek Sigma. |
| AC-MCP-10 | Control server tetap opt-in/manual dan tidak masuk konfigurasi default. |
| AC-MCP-11 | Matriks dokumentasi dapat diregenerasi dari sumber kebenaran yang sama dengan test. |
| AC-MCP-12 | Seluruh test lama dan test baru lulus tanpa perubahan Git yang tidak diharapkan. |

## 7. Test contract

| Test | Menutup AC | Metode | Hasil yang diwajibkan |
|---|---|---|---|
| TC-MCP-01 Registry completeness | 01, 04, 08 | Bandingkan registry aktif/tombstone dengan manifest. | Tidak ada operasi aktif hilang/duplikat; tombstone terpisah. |
| TC-MCP-02 Tool inventory | 02, 03 | Introspeksi `buildServer` dan `buildControlServer`; cocokkan nama tool dengan manifest. | Tidak ada tool yatim atau klaim implemented tanpa tool. |
| TC-MCP-03 Plane enforcement | 03, 05, 06 | Panggil tool dengan fixture role/project yang valid dan invalid. | Query tidak memerlukan authority mutasi; control menolak binding salah. |
| TC-MCP-04 Query immutability | 05, 09 | Snapshot file tree, operation log, dan Git sebelum/sesudah seluruh query tool prioritas. | Tidak ada file, log, index, tag, commit, atau konfigurasi berubah. |
| TC-MCP-05 Close semantics | 07 | Fixture tanpa dokumen CLOSE tetapi dengan state Gate 3/Product Review yang bervariasi. | Hasil mengikuti gate/review, bukan keberadaan dokumen CLOSE. |
| TC-MCP-06 Ticket lifecycle | 06 | Prepare, commit, replay, ticket kedaluwarsa, dan state berubah. | Commit valid hanya sekali; replay/stale ditolak deterministik. |
| TC-MCP-07 Path containment | 06 | Target normal, traversal, symlink escape, dan path di luar root. | Hanya path di dalam project root yang diterima. |
| TC-MCP-08 Tombstone rejection | 08 | Coba tambahkan/resolve capability bagi tiga tombstone. | Test gagal dengan pesan eksplisit. |
| TC-MCP-09 Non-registration | 09, 10 | Jalankan inventory/query pada fixture non-Sigma dan repository ini. | Tidak tercipta activate status atau registrasi; control tidak auto-start. |
| TC-MCP-10 Generated matrix | 11 | Regenerasi dua kali dari input identik dan bandingkan output. | Output deterministik dan tanpa diff pada generasi kedua. |
| TC-MCP-11 Regression | 12 | Jalankan suite penuh proyek. | Semua test lulus; worktree hanya memuat perubahan yang disetujui. |

## 8. Urutan eksekusi yang direkomendasikan

1. Bekukan baseline registry dan inventaris tool aktual dalam test fixture/generator.
2. Tambahkan manifest capability dan parity test yang mula-mula memperlihatkan drift.
3. Perbaiki policy hingga parity dasar lulus.
4. Implementasikan query tools prioritas beserta immutability test.
5. Implementasikan control tools prioritas beserta ticket/security test.
6. Tegaskan tombstone dan klasifikasi CLI-only/deferred.
7. Regenerasi dokumentasi capability.
8. Jalankan suite penuh dan audit worktree.

## 9. Risiko dan stop condition

| Risiko | Mitigasi/stop condition |
|---|---|
| Pemetaan functional menutupi perbedaan semantik. | Hentikan pemetaan bila precondition, output, atau side effect berbeda material; gunakan `partial` atau tool khusus. |
| Query handler memanggil jalur CLI yang menulis operation log. | Jangan rilis tool tersebut sebagai query sampai jalur read-only murni tersedia. |
| Control tool dapat bekerja di luar proyek/role yang terikat. | Gagal tertutup; implementasi tidak diterima sampai binding dan containment teruji. |
| Manifest kembali menjadi daftar manual yang drift. | Registrasi server dan parity test harus memvalidasi manifest pada CI. |
| Rencana message dipaksakan masuk iterasi MCP. | Hentikan dan bawa keputusan kepada Director; desain message sengaja ditunda. |
| Tool memicu registrasi proyek implisit. | Perlakukan sebagai kegagalan keamanan dan hentikan implementasi. |

## 10. Di luar ruang lingkup

- Desain rinci message, inbox, dan memo.
- Perubahan kepemilikan commit/push Git.
- Aktivasi formal role Sigma atau registrasi repository ini sebagai proyek Sigma.
- Migrasi otomatis konfigurasi pengguna.
- Penghapusan tool kompatibilitas tanpa audit konsumen.

## 11. Keputusan Director yang diperlukan sebelum implementasi

1. Menyetujui manifest capability sebagai sumber kebenaran policy/parity.
2. Menyetujui daftar query dan control tools prioritas.
3. Menyetujui kelompok operasi yang tetap CLI-only pada iterasi ini.
4. Menyetujui bahwa mailbox/message tetap deferred sampai sesi desain khusus.

## 12. Catatan serah-terima dari PLAN-IMPL-SIGMA-REPORT-DIAGNOSTIC-MESSAGE-GIT-BOUNDARY-20261015

**Ditambahkan:** 2026-10-15, setelah plan tersebut selesai diimplementasikan. Bagian ini adalah pengingat untuk sesi implementasi plan ini; isi §1–§11 tidak diubah dan tetap menunggu review Director.

### 12.1 Status plan sebelumnya

- Terimplementasi; suite penuh 89 file / 1431 test lulus saat serah-terima. (Setelah plan isolasi legacy, §13: 90 file / 1454 test.)
- **Belum** di-commit, di-push, atau dipasang secara global. Keputusan Director: commit, push, dan instalasi global Sigma dilakukan **setelah seluruh plan yang berjalan selesai** (kini tiga: diagnostic, isolasi legacy, dan plan ini).
- Akibatnya worktree saat sesi ini dimulai **sudah kotor oleh plan sebelumnya**. Untuk AC-MCP-12 ("hanya perubahan yang disetujui"), catat `git status --short` di awal sesi sebagai baseline dan bedakan perubahan plan ini darinya.

File yang diubah plan sebelumnya (tracked): `Sigma/SIGMA-OPERATION-REGISTRY.json`, `dist/` (cli, commands/send, utils/operationLog), `src/cli.ts`, `src/commands/send.ts`, `src/utils/operationLog.ts`, `setup/targets/*/report*` dan `*/sigma-test*` (5 platform), `test/operation-log.test.ts`, `test/f04-lifecycle.test.ts`. File baru: `test/read-only-conformance.test.ts`, `test/operation-parity.test.ts`, `test/message-git-boundary.test.ts`, `test/skill-static-audit.test.ts`.

### 12.2 Hal yang sengaja dititipkan ke plan ini

1. **`notes_list`, `notes_new`, `notes_update` belum punya tier** di `src/mcp/policy.ts` (sesuai baseline §2). `test/operation-parity.test.ts` menguncinya eksak lewat `KNOWN_UNCLASSIFIED`. Begitu WP-MCP-02 memberi tier, test itu **akan gagal sampai array tersebut dikosongkan**; itu disengaja, bukan regresi.
2. **Check B1 `sigma-test` akan FAIL di proyek Sigma aktif** selama poin 1 belum selesai (operasi dengan `tier: null`). Setelah plan ini, B1 seharusnya PASS.
3. **Check B4 `sigma-test` (`mcp_status` vs tool aktual) saat ini hanya bisa `WARN: unverifiable`** karena belum ada manifest. Setelah manifest ada, B4 harus diubah menjadi pembanding nyata antara manifest dan daftar tool hasil introspeksi (A7). Ubah ke lima varian: `setup/targets/claude_code/sigma-test.md`, `opencode/sigma-test.md`, `reasonix/sigma-test.md`, `codex/sigma-test/SKILL.md`, `antigravity/sigma-test/SKILL.md`, dan sesuaikan asersi B4 di `test/skill-static-audit.test.ts`. Skrip generator varian hanya ada di scratchpad sesi lama dan tidak persisten; edit kelima file langsung.

### 12.3 Kendala yang harus diperhatikan

- **`plan_revise_check` berlevel `semantic`** di registry, sedangkan WP-MCP-03 menjadikannya query tool "bagian evaluasi read-only". Sebelum dirilis sebagai query: pisahkan bagian evaluasi dari bagian pembuat ticket, atau reklasifikasi, lalu masukkan ke tabel `INVOCATIONS` di `test/read-only-conformance.test.ts`. Tanpa itu, klaim "tidak menulis state" (AC-MCP-05) tidak tercakup sentinel.
- **Enam dari tujuh query tool prioritas** (`review_check`, `close_check`, `dev_status`, `notes_list`, `intent_baseline_check`, `intent_amendment_preview`) sudah `read_only` dan sudah ada di sentinel CLI. Sentinel itu menguji jalur CLI, **bukan handler MCP**; TC-MCP-04 tetap perlu snapshot sendiri untuk handler.
- **Guard log operasi** (`isRegisteredReadOnlyOperation` di `src/utils/operationLog.ts`) membaca `level` registry. Mengubah level operasi berarti mengubah apakah CLI mencatatnya. Rerun `test/read-only-conformance.test.ts` setiap kali level berubah.
- **`scan` kini `semantic`** (menulis `Sigma/logs/*_terminology-scan.log` saat ada temuan). Manifest harus mencatatnya `cli_only`, konsisten dengan `scan: 'NA'` yang sudah ada di policy.
- **Guard mailbox:** `test/message-git-boundary.test.ts` (TC-MSG-04) menolak tool mailbox-family MCP di luar `sigma_check_mailbox_integrity` dan `sigma_inbox_archive`. Guard memindai literal `registerTool('nama'`; tool baru yang didaftarkan lewat variabel tidak terlihat olehnya. Konsisten dengan WP-MCP-05 (mailbox tetap deferred), tool yang ditambahkan plan ini tidak boleh cocok dengan pola tersebut.
- **`doctor` berlevel `semantic` tetapi bertier `Q`** karena jalur `--check-assets` read-only. Manifest perlu menjelaskan pengecualian ini (WP-MCP-05 sudah menyebut "bagian mutasi dari `doctor`").
- **`checkMailboxIntegrity` mengecualikan mailbox `LEGACY`** dan tidak lagi memiliki field `legacy_excluded` (dicabut oleh plan isolasi; lihat §13). Jangan mengandalkan field itu di manifest atau parity test.
- **`dist/` ter-track git dan test menjalankan `dist/cli.js`.** Jalankan `npx tsc` sebelum test; kegagalan membangun ulang menghasilkan hasil basi yang menyesatkan.

### 12.4 Urutan penutup yang sudah diputuskan Director

1. Selesaikan implementasi plan ini; suite penuh lulus.
2. `sigma doctor --check-assets`: perbedaan yang tersisa hanya yang diharapkan (salinan terpasang tertinggal dari sumber repo; `report` terpasang sudah diketahui DIFF).
3. Instalasi global Sigma (`sigma setup update`, lalu `sigma project sync --confirm` pada proyek yang relevan) dengan persetujuan Director.
4. Commit dan push oleh Director, mencakup ketiga plan. Pemisahan menjadi beberapa commit logis diserahkan kepada Director.

## 13. Catatan serah-terima dari PLAN-IMPL-SIGMA-LEGACY-ISOLATION-20261015

**Ditambahkan:** 2026-10-15, setelah plan isolasi legacy diimplementasikan (belum di-commit; suite 90 file / 1454 test lulus). Pengingat untuk sesi implementasi plan ini; isi §1–§11 tidak diubah.

### 13.1 Ringkasan yang relevan bagi MCP

Prinsip Director: Sigma v2 **tidak mendeteksi, tidak melaporkan, dan tidak terhalang** oleh artefak `LEGACY` (mailbox dan memo), apa pun kondisinya, termasuk berkas hilang atau entri rusak. Hanya proses migrasi yang menghasilkannya; riwayat lama dibaca dengan membuka berkas langsung. Note tidak disentuh (tidak punya folder legacy, F06 T-17). Rincian: `PLAN-IMPL-SIGMA-LEGACY-ISOLATION-20261015.md` §13.

### 13.2 Hal yang harus diperhatikan saat mengerjakan plan ini

1. **`readIndex(...).messages` kini dapat memuat entri legacy yang tidak tervalidasi.** Validasi index melewati legacy (format 2) sehingga entri rusak tidak menggagalkan operasi. Akibatnya setiap handler MCP baru yang membaca `messages` secara mentah **wajib** menyaring dengan `isIsolatedLegacy()` (`src/engine/mailboxContext.ts`), atau memakai fungsi seleksi yang sudah menyaring lewat `matchesMailboxScope`. Ini risiko utama bagi query tool baru yang menyentuh mailbox.
2. **Test penjaga statis TC-LEG-08** (`test/legacy-isolation.test.ts`) memindai seluruh `src/`, termasuk `src/mcp/`. Kode tool baru **tidak boleh menyebut kata `LEGACY`**; hanya `mailboxMigration.ts`, `mailboxContext.ts`, dan teks bantuan `doctor.ts` yang diizinkan. Jika perlu mengenali legacy, panggil predikatnya.
3. **`sigma_check_mailbox_integrity`:** payload tidak memuat `legacy_excluded` lagi dan deskripsi tool tidak menyebut legacy. Hasil berbentuk `{ ok, passes, warnings, failures, findings, source }`. Manifest atau parity test yang membandingkan schema output harus memakai bentuk ini.
4. **`sigma_inbox_archive` (control):** terhadap ID legacy kini berperilaku seperti ID tidak dikenal (`INVALID_OPERATION: Message not found`), tanpa penyebutan legacy. Test `control-inbox-archive` tetap lulus. Manifest tidak perlu memperlakukan legacy secara khusus; cukup catat bahwa legacy bukan target operasi v2.
5. **Orientasi dan `mailbox_status`:** `buildMailboxView` melewati entri legacy pada validasi membership; tidak ada hitungan atau peringatan legacy di payload mana pun. Jangan menambahkannya (AC-LEG-05 melarang pelaporan legacy).
6. **Gerbang mutasi mailbox:** `assertMailboxMutable` kini melewati entri legacy. Tool control baru yang menulis mailbox harus tetap lewat gerbang ini, bukan memvalidasi sendiri.
7. **Dokumentasi matriks (WP-MCP-07):** jangan mendokumentasikan `--context LEGACY` atau pembacaan legacy sebagai kapabilitas; keduanya sudah tidak ada (opsi `--context` hanya `GENERAL` atau versi artefak; `--all-intents` tidak mencakup legacy).
8. **`sigma_notes_list` (WP-MCP-03):** keputusan Director untuk note adalah **tidak berubah sama sekali** sampai masalah muncul pada penggunaan nyata. Tool MCP harus mencerminkan perilaku CLI `notes list` apa adanya, termasuk peringatan berkas tak terdaftar; jangan "memperbaikinya" di sisi MCP.
9. **Daftar tool mailbox yang diizinkan** (TC-MSG-04) tidak berubah: `sigma_check_mailbox_integrity` dan `sigma_inbox_archive`.

### 13.3 Baseline worktree tambahan

Perubahan plan isolasi (tracked): `src/engine/mailbox.ts`, `src/engine/mailboxContext.ts`, `src/session/mailboxView.ts`, `src/services/mailboxService.ts`, `src/services/inboxArchiveService.ts`, `src/commands/mailboxShared.ts`, `src/commands/project.ts`, `src/commands/send.ts`, `src/mcp/tools/checkMailboxIntegrity.ts`, `Sigma/SIGMA-OPERATION-REGISTRY.json` (deskripsi `inbox_check`), `README.md`, lima berkas `read-memo` pada `setup/targets/`, `dist/`, serta test `mailbox-context`, `mailbox-path-normalization`. Berkas baru: `test/legacy-isolation.test.ts` dan `Implementation/PLAN-IMPL-SIGMA-LEGACY-ISOLATION-20261015.md`.

### 13.4 Catatan yang tidak memengaruhi plan ini tetapi perlu diingat

- Sekitar 33 berkas rule/skill masih memuat kalimat "never target LEGACY for a new write". Benar, tidak menyesatkan, dan sengaja tidak diubah; dapat dirapikan saat tahap instalasi.
- Salinan terpasang global dan salinan proyek belum diperbarui untuk ketiga plan; `sigma doctor --check-assets` akan melaporkan perbedaan sampai instalasi dilakukan atas persetujuan Director.

## 14. Catatan hasil implementasi

**Ditambahkan:** 2026-10-15, setelah seluruh work package diimplementasikan (belum di-commit; suite 96 file / 1543 test lulus). Isi §1–§13 tidak diubah. Pengingat bahwa Director mendelegasikan keputusan teknis kepada rekomendasi asisten selama desain fitur inti tidak berubah.

### 14.1 Penyimpangan dari teks plan

1. **WP-MCP-04, `plan_revise_prepare`.** Plan menyebutnya menghasilkan tiket. Pada kode, `prepare` hanya men-stage kandidat dan deklarasi; tiket berasal dari `check --prepare-ticket`. Dibuat operasi CLI sendiri `plan revise ticket` (`plan_revise_ticket`, registry 90) atas keputusan Director; flag lama tetap sebagai alias.
2. **WP-MCP-02 butir 3.** Policy melaporkan status berdasarkan manifest, bukan introspeksi runtime: server query tidak boleh mengimpor server control. Kebenaran deklarasi dijaga `test/mcp-capability-manifest.test.ts`.
3. **`notes_new`** satu langkah (`sigma_create_note`), bukan prepare/commit; tidak ada tiket atau approval untuk sebuah note.
4. **`plan_revise_check`** tetap `semantic` di registry karena alias `--prepare-ticket` menulis. Tool MCP hanya mengekspos evaluasi (tier Q, mapping `partial`).
5. **Tool tambahan di luar daftar plan:** tidak ada tool pengedit kandidat revisi; kandidat tetap diedit sebagai berkas seperti pada CLI.
6. **Klasifikasi:** `intent_activate` dan `decisions_resolve` `not_admissible`; `config*` dan `notes_update` `deferred`; mailbox/memo `deferred`.

### 14.2 Tool yang ditambahkan

Query (7): `sigma_review_check`, `sigma_close_check`, `sigma_dev_status`, `sigma_notes_list`, `sigma_intent_baseline_check`, `sigma_intent_amendment_preview`, `sigma_plan_revise_check`.
Control (5): `sigma_create_note`, `sigma_create_review`, `sigma_prepare_plan_revision`, `sigma_issue_plan_revision_ticket`, `sigma_commit_plan_revision`.
Server query kini 33 tool, control 42.

### 14.3 Penutup §12.4

Poin 1 selesai. Poin 2–4 (`doctor --check-assets`, instalasi global, commit/push) tetap di tangan Director. Rule FMN/DEV berubah (`plan revise ticket`), sehingga salinan terpasang akan dilaporkan DIFF sampai `sigma setup update` dan `sigma project sync`.
