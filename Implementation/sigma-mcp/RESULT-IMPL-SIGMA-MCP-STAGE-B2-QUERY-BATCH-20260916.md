# RESULT-IMPL — Stage B2 query-plane batch: 13 tool menutup 17 operasi

**Tanggal**: 2026-09-16
**Sumber**: `PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` §14 Stage B2 (evidence-only pilot sudah selesai 2026-09-15 — lihat `RESULT-IMPL-SIGMA-MCP-STAGE-B2-20260915.md`). Batch ini menutup sisa 17 dari 18 operasi B2 yang masih `deferred`.
**Perintah Director**: "lanjutkan ke b2 dulu saja" (2026-09-16), setelah keputusan arsitektur dikonfirmasi lewat pertanyaan terstruktur (§2 di bawah).
**Peran implementer**: Claude Code sebagai implementator; Codex sebagai reviewer independen berikutnya. Dokumen ini **tidak** men-declare "Gate B2 PASS".
**Status**: Implementasi + test contract selesai untuk 13 tool, satu putaran self-review adversarial dilakukan (§6). Review independen Codex putaran pertama BLOCKED tiga temuan HIGH (§9); seluruhnya ditutup dan diverifikasi ulang (§10).

## 1. Ringkasan

18 operasi read-only tersisa dari inventarisasi Stage 0 (`intent/plan/exec/close/roadmap × status/list/check`, `inbox_check`, `memo_list`, `config_show`, `report_logs`, `git_evidence`) diriset penuh (baca langsung setiap implementasi CLI, bukan asumsi dari nama), lalu diimplementasikan sebagai **13 tool MCP baru** menutup **17 operasi** (lima operasi CHECK dipetakan ke satu tool, `sigma_check_document`). `memo_list` dikecualikan secara eksplisit atas keputusan Director (§2).

Tidak ada satu pun operasi B2 yang benar-benar identik strukturnya dengan operasi lain di grup berbeda — riset awal ini yang menentukan arsitektur tool (§3), bukan asumsi.

## 2. Keputusan Director (2026-09-16, sebelum implementasi)

Tiga pertanyaan diajukan setelah riset awal, semuanya dijawab dengan opsi rekomendasi:

1. **Cakupan `sigma_get_git_evidence`**: parity penuh dengan CLI (seluruh working tree, bukan dibatasi ke `Sigma/`).
2. **`memo_list`**: dikecualikan dari batch ini — domain mailbox yang sama dengan `inbox`/`inbox_read` yang sudah ditarik (§3.6), tidak dibuka kembali tanpa keputusan tersendiri.
3. **Arsitektur tool**: campuran sesuai keseragaman tiap grup — bukan satu tool generik untuk semua 17-18 operasi, juga bukan 17 tool yang seluruhnya independen.

## 3. Arsitektur dan temuan riset per grup

### 3.1 Grup CHECK (5 operasi → 1 tool: `sigma_check_document`)

`intent_check`/`plan_check`/`exec_check`/`close_check`/`roadmap_check` adalah **satu pipeline kode yang sama persis** — `validateSigmaDocFile()` → `SigmaDocCheckReport` → `printSigmaDocReport()`. Satu-satunya perbedaan: resolusi path dokumen per tipe, dan guard ambiguitas (`resolveTargetVersion()`) khusus plan/exec ketika >1 DRAFT terbuka tanpa `--v`.

**Temuan keamanan**: `SigmaDocCheckReport.file` adalah **absolute host path** (CLI aman karena selalu dikonversi relatif sebelum print; objek mentahnya tidak). Tool ini meredaksinya lewat `redactPath()` — primitif yang sama dipakai `sigma_get_memory` — sebelum dikembalikan. Dibuktikan lewat test terpisah (verified vs unverified binding).

### 3.2 Grup STATUS (4 operasi → 4 tool, TIDAK digeneralisasi)

`intent_status`/`close_status` (single-object + gate) dan `plan_status`/`exec_status` (kategorisasi DRAFT/LOCKED + pairing plan↔exec yang dihitung runtime via `.find()`, plus pending untuk plan) adalah **dua bentuk berbeda**, bukan variasi kecil dari satu bentuk. Memaksakan satu tool generik akan menghilangkan nuansa pairing/pending yang justru jadi nilai utama operasi ini.

### 3.3 Grup LIST (4 operasi → 4 tool, TIDAK digeneralisasi)

Tiga bentuk berbeda ditemukan saat riset:
- `intent_list` — **satu-satunya operasi lintas-chain** di seluruh permukaan MCP proyek ini (membaca setiap `progress-v<N>.json`, bukan hanya chain aktif).
- `plan_list`/`exec_list` — mirip (version/state/ref/created_at), tapi `plan_list` punya sub-list `pending` yang tidak dipunyai `exec_list`.
- `roadmap_list` — **bukan** daftar versi ROADMAP (chain hanya punya satu ROADMAP, objek tunggal). Registry mendeskripsikannya sebagai "Table of ROADMAP versions" — dikonfirmasi **tidak cocok** dengan implementasi aktual (daftar stage/plan). Tool dinamai `sigma_list_roadmap_stages`, bukan `sigma_list_roadmaps`, mengikuti perilaku nyata. Dicatat sebagai mismatch registry baru — capability matrix §5.4.

**Bug CLI yang ditutup sekalian**: `plan status`/`plan list`'s `readPendingTitle()` fallback mengembalikan **absolute host path** sebagai "title" ketika file pending tidak punya heading `# ` atau gagal dibaca. `sigma_plan_status`/`sigma_list_plans` fallback ke `null`, dibuktikan lewat test yang meng-assert JSON response tidak pernah memuat `env.projectDir`.

### 3.4 `inbox_check` (1 operasi → 1 tool: `sigma_check_mailbox_integrity`)

Berbeda struktur dari grup CHECK meski namanya mengikuti pola `*_check` — ini integrity check index-vs-disk (file hilang, file orphan, attachment hilang, ID duplikat, field tidak valid), bukan `SigmaDocCheckReport`. Tidak ada konsep role/`--role` (berlaku simetris untuk semua role), tidak pernah membaca/mengembalikan subject atau isi pesan — risiko strukturnya berbeda dari `memo_list` yang tetap dikecualikan.

**Temuan saat testing**: `readIndex()` (`src/engine/mailbox.ts`) sudah fail-closed pada ID duplikat sebelum kode pemeriksa integritas (baik CLI maupun tool ini) sempat jalan — artinya logic pendeteksian duplikat di CLI `inbox check` **sudah dead code** sejak guard itu ditambahkan ke `readIndex()`. Direplikasi apa adanya di tool ini (parity, bukan bug baru), didokumentasikan lewat test yang membuktikan perilaku propagasi error ini secara eksplisit, bukan diam-diam dianggap "tidak pernah terjadi".

### 3.5 `config_show`, `report_logs`, `git_evidence` (3 operasi → 3 tool berdiri sendiri)

- **`sigma_get_config`**: `ProjectConfig` tidak punya field credential sama sekali; `notion.parent_page_id`/`database_id` ada di tipe tapi CLI tidak pernah mencetaknya — tool ini juga tidak menambahkannya.
- **`sigma_get_operation_log`**: **caveat matrix lama dicabut**. Dicek langsung ke `OperationLogEntry` (`src/utils/operationLog.ts`) — field-nya hanya `{operation, timestamp, status, exit_code}`, tidak ada path host sama sekali. Catatan "operations.jsonl memuat path host" di versi matrix sebelumnya tidak terkonfirmasi kode `hermes-integration` saat ini.
- **`sigma_get_git_evidence`**: **caveat matrix lama terkonfirmasi dan dipertahankan by design** — `git status`/`git diff` berjalan atas seluruh working tree, bisa membocorkan nama file/perubahan kode aplikasi di luar `Sigma/`. Keputusan Director (§2 poin 1): parity penuh, bukan dibatasi.

## 4. File yang berubah

**Baru** — 13 tool (`src/mcp/tools/`) menutup 17 operasi: `checkDocument.ts`, `intentStatus.ts`, `closeStatus.ts`, `planStatus.ts`, `execStatus.ts`, `listIntents.ts`, `listPlans.ts`, `listExecs.ts`, `listRoadmapStages.ts`, `checkMailboxIntegrity.ts`, `getConfig.ts`, `getOperationLog.ts`, `getGitEvidence.ts`.

**Baru** — 4 test file: `test/mcp-check-document.test.ts` (12 test), `test/mcp-status.test.ts` (9 test), `test/mcp-list.test.ts` (7 test), `test/mcp-b2-final.test.ts` (13 test setelah §10).

**Diubah**: `src/mcp/index.ts` (registrasi 13 tool baru), `test/mcp-tools.test.ts` (exact-match tool list query-plane: 10 → 23 tool, plus §10's schema guard).

## 5. Test dan evidence

- `npm run build` — bersih di setiap penambahan grup (4 checkpoint terpisah, bukan satu commit besar di akhir).
- `npm test` — **66 file / 857 test PASS** (naik dari 63 file/830 test sebelum batch B2 ini; delta murni test baru, tidak ada yang hilang atau berubah perilaku).
- Query-plane jauh lebih cepat dari control-plane yang dikerjakan sebelumnya (single-digit ms hingga ratusan ms per file, vs puluhan detik) — tidak ada lock/journal/idempotency/subprocess recovery yang perlu dites, karena seluruhnya read-only.

## 6. Self-review adversarial (satu putaran, sebelum serah terima ke Codex)

- **Path redaction terbukti, bukan diasumsikan**: test eksplisit untuk `sigma_check_document` membandingkan binding verified vs unverified, membuktikan `file` field tidak pernah berisi `env.projectDir` pada binding verified.
- **Host-path-leak CLI (readPendingTitle) tertutup dan dibuktikan**: test meng-assert `JSON.stringify(response)` tidak memuat absolute path project.
- **`git_evidence` sengaja tidak dibatasi**: dicatat eksplisit di header file dan RESULT ini sebagai keputusan Director, bukan kelalaian — risiko exposure kode aplikasi di luar `Sigma/` adalah trade-off yang sudah disadari.
- **Non-mutation dibuktikan penuh hanya untuk grup CHECK** (test `governanceHashes` before/after lewat transport nyata). Grup STATUS/LIST/final tidak punya test hash-diff serupa — seluruh compute function hanya memanggil `fs.existsSync`/`readFileSync`/`readdirSync` (tidak pernah `writeFileSync`/`writeChain`), diverifikasi lewat pembacaan kode langsung, tapi **belum dibuktikan lewat test otomatis** untuk 12 dari 17 tool. Dicatat sebagai gap cakupan test, bukan disembunyikan — kandidat kuat untuk temuan Codex.
- **`inbox_check`'s dead-code duplicate-ID path**: didokumentasikan lewat test yang membuktikan `readIndex()` fail-closed duluan, bukan diam-diam dibiarkan sebagai kode yang tampak berfungsi padahal tidak pernah tereksekusi.
- **Role server-derived**: tidak ada tool B2 yang menerima parameter role dari caller — seluruhnya read-only tanpa role-gating sama sekali (`role: "any"` di registry untuk semua 18 operasi), konsisten dengan sifat query-plane.

## 7. Yang belum dikerjakan (sengaja, di luar cakupan batch ini)

- `memo_list` — dikecualikan eksplisit (Director, §2 poin 2).
- Seluruh W2 (governance transition selain `intent_ratify`) — belum tersentuh, di luar cakupan B2.
- Gap test non-mutation untuk 12/17 tool (§6) — kandidat putaran berikutnya bila Codex/Director meminta.

## 8. Status akhir

`git status` pada akhir pekerjaan ini menunjukkan seluruh perubahan sebagai working-tree diff/untracked, tidak ada commit yang dibuat oleh implementer. Menunggu review Codex dan keputusan Director soal commit/lanjut ke cakupan berikutnya.

## 9. Review teknis independen - 2026-09-16

**Status: BLOCKED - perbaikan wajib sebelum Stage B2 dapat diterima.** Build TypeScript berhasil; targeted test B2 (101 test) dan suite penuh selesai tanpa kegagalan yang terlapor. Namun test saat ini tidak menangkap tiga pelanggaran boundary yang direproduksi langsung pada review ini.

### Bukti yang diperiksa

- Source 13 tool B2, registrasi query server, `respond()`, binding, dan test B2.
- `npm run build` berhasil.
- Targeted B2/binding/query test: 6 file, 101 test PASS.
- Full `npm test -- --silent` selesai tanpa kegagalan yang terlapor.
- Dua reproduksi terisolasi pada repository/project sementara untuk Git index dan runtime JSONL.

### Temuan wajib diperbaiki

1. **[HIGH - query Git memutasi repository]** `sigma_get_git_evidence` menjalankan `git status --short` melalui `execSync`. Pada repository sementara, timestamp `.git/index` berubah sesudah pemanggilan tersebut. Ini melanggar invarian Plan Doc §5.4 bahwa query tidak menulis, dan kontrak §16.2 yang mensyaratkan query nol mutasi. Mitigasi telah diuji: `git --no-optional-locks status --short` menghasilkan status yang sama tanpa mengubah timestamp index. Terapkan `--no-optional-locks` pada subprocess Git query yang relevan dan tambahkan test before/after metadata Git.

2. **[HIGH - operation log dapat membocorkan field runtime tak dikenal]** `readAllEntries()` memakai `JSON.parse(line) as OperationLogEntry` lalu mengembalikan objek mentah. TypeScript cast tidak memfilter JSON pada runtime. Reproduksi dengan satu baris JSONL yang memiliki `host_path` mengembalikan `host_path` utuh dalam `sigma_get_operation_log`. Klaim bahwa type `OperationLogEntry` menjamin tidak ada path host tidak benar pada input runtime. Terapkan allowlist/validasi yang membuat output hanya `{ operation, timestamp, status, exit_code }`, dan tambah test untuk membuang field tak dikenal/sensitif.

3. **[HIGH - semua tool B2 baru mengekspos `project_root` per-call]** Ketiga belas tool B2 memasukkan `project_root` dalam schema dan meneruskannya ke `respond()`. Binding memang menolak root yang berbeda, tetapi Plan Doc §7.1 eksplisit: `project_root` per-call dihapus dari tool baru; hanya enam tool legacy boleh menerimanya untuk kompatibilitas. Hapus field tersebut dari seluruh schema B2 baru dan panggil `respond(..., undefined, ...)`. Tambahkan exact-schema test yang memastikan parameter tidak terlihat pada 13 tool baru.

### Temuan dokumentasi

- Report menyebut “17 tool baru”, sedangkan source dan test exact-match menunjukkan 13 tool baru: tool query naik dari 10 menjadi 23. Angka 17 benar sebagai jumlah operasi B2 yang ditutup setelah `memo_list` dikecualikan, karena lima operasi CHECK dipetakan ke satu tool. Koreksi judul, §1, dan §4 agar membedakan 17 operasi dari 13 tool.

### Hal yang terverifikasi benar

- `sigma_check_document` meredaksi path host pada binding terverifikasi.
- Status/list dipisahkan sesuai bentuk data yang berbeda; mailbox integrity tidak mengembalikan subject/isi.
- `sigma_get_config` tidak mengembalikan credential atau ID Notion.
- Scope penuh working tree pada Git evidence telah diputuskan Director, tetapi keputusan scope tidak meniadakan larangan query melakukan write.

### Verdict

Perbaiki tiga temuan HIGH, tambahkan test regresinya, jalankan build dan B2/full suite kembali, lalu ajukan follow-up untuk review ulang. Klaim “Stage B2 PASS” tidak didukung sampai saat itu.

## 10. Tindak lanjut atas review §9 — 2026-09-16

Ketiga temuan HIGH diverifikasi independen terlebih dahulu (baca langsung source dan Plan Doc §7.1/binding.ts, bukan diterima mentah) — semuanya terkonfirmasi valid. Diperbaiki sebagai berikut:

1. **Git index mutation** — [getGitEvidence.ts](../../src/mcp/tools/getGitEvidence.ts): `git status --short` → `git --no-optional-locks status --short`. Test regresi baru di `test/mcp-b2-final.test.ts`: memanggil `computeGetGitEvidence` dua kali berturut-turut dan membandingkan `.git/index` byte-identik + mtime tidak berubah.

2. **Operation log unknown-field leak** — [getOperationLog.ts](../../src/mcp/tools/getOperationLog.ts): `JSON.parse(line) as OperationLogEntry` (type cast) diganti `toSafeEntry()` — proyeksi allowlist eksplisit (`operation`/`timestamp`/`status`/`exit_code` saja, dengan validasi tipe/enum per field; baris yang tidak lolos validasi dibuang, bukan hanya barisnya yang gagal parse JSON). Test regresi baru: entry dengan field `host_path` berisi path sensitif — dibuktikan tidak muncul di output sama sekali (`JSON.stringify` tidak mengandung string tersebut).

3. **`project_root` per-call di 13 tool baru** — dihapus dari `inputSchema` dan signature handler di seluruh 13 file (`getGitEvidence`, `getOperationLog`, `getConfig`, `checkMailboxIntegrity`, `listRoadmapStages`, `listExecs`, `listPlans`, `listIntents`, `execStatus`, `planStatus`, `closeStatus`, `intentStatus`, `checkDocument`); pemanggilan `respond()` sekarang selalu `respond(tool, undefined, compute)`. Import `z` yang jadi tidak terpakai di 9 file juga dihapus. Test regresi baru di `test/mcp-tools.test.ts`: iterasi seluruh tool lewat `client.listTools()`, assert `project_root` hanya ada pada schema enam tool legacy (`sigma_get_state`, `sigma_get_gates`, `sigma_list_artifacts`, `sigma_doctor`, `sigma_get_orientation`, `sigma_get_memory`) dan tidak ada di tool lain mana pun — bukan hanya 13 tool B2, tapi seluruh permukaan query-plane, agar tool baru berikutnya juga tertangkap otomatis.

**Koreksi dokumentasi**: judul, §1, §4 diperbaiki dari “17 tool” menjadi “13 tool menutup 17 operasi” (lima operasi CHECK dipetakan ke satu tool `sigma_check_document`).

**Verifikasi**: `npx tsc --noEmit` bersih. `npx vitest run` — **66 file / 860 test PASS** (naik dari 857 sebelum putaran ini; 3 test baru: git-index non-mutation, operation-log allowlist, project_root schema guard — tidak ada test yang hilang atau berubah perilaku).

Gap yang sudah didokumentasikan di §6/§7 (test non-mutation belum otomatis untuk 12/17 operasi selain grup CHECK) **belum** ditutup di putaran ini — di luar cakupan tiga temuan HIGH yang diwajibkan. Tidak ada klaim “Stage B2 PASS”; menunggu review ulang Codex.

## 11. Review teknis independen — follow-up 2026-09-16

**Status: PASS WITH RECORDED TEST DEBT.** Tiga temuan HIGH pada §9 telah ditutup oleh implementasi dan test regresi yang dapat dijalankan ulang. Status ini menerima cakupan perbaikan B2; bukan deklarasi Gate/lifecycle pass yang lebih luas.

### Verifikasi per temuan

1. **Git evidence nol mutasi — CLOSED.** `computeGetGitEvidence()` sekarang menjalankan `git --no-optional-locks status --short`. Test runtime memanggil fungsi tersebut dua kali terhadap repository sementara yang telah memiliki index, lalu membandingkan byte `.git/index` dan `mtimeMs` sebelum/sesudah. Keduanya identik. Ini memverifikasi perbaikan pada jalur yang dahulu memutasi stat cache, bukan sekadar penggantian literal command.

2. **Kebocoran field operation log — CLOSED.** `toSafeEntry()` memeriksa tipe/enum empat field yang diizinkan lalu membangun objek baru `{ operation, timestamp, status, exit_code }`. Objek JSON sumber tidak pernah diteruskan. Test dengan `host_path` sensitif membuktikan entry tetap dapat dibaca tanpa field tersebut maupun nilai rahasianya muncul dalam serialisasi output.

3. **`project_root` per-call — CLOSED.** Diff menghapus field schema dan handler dari semua 13 tool B2. Tiap handler meneruskan `undefined` ke `respond()`, sehingga root hanya berasal dari binding server. Guard integrasi memakai `client.listTools()` dan memeriksa seluruh permukaan query-plane: hanya enam tool legacy yang boleh mengekspos field tersebut. Guard ini juga melindungi penambahan tool berikutnya dari regresi copy-paste.

### Validasi yang dijalankan reviewer

- `npx tsc --noEmit` — lulus.
- Regresi B2: `test/mcp-b2-final.test.ts`, `test/mcp-tools.test.ts`, `test/mcp-check-document.test.ts`, `test/mcp-status.test.ts`, `test/mcp-list.test.ts`, dan `test/mcp-binding.test.ts` — 6 file / 104 test lulus.
- `git diff --check` — lulus.
- Suite penuh `npm test -- --silent` — 66 file / 860 test lulus.

### Catatan residual

Utang test non-mutasi otomatis untuk 12 dari 17 operasi di luar grup CHECK tetap ada sebagaimana dicatat di §6/§7. Ia tidak lagi memblokir penerimaan follow-up ini karena tiga pelanggaran konkret telah diremediasi dan B2 tidak menambah jalur tulis baru; tetapi harus tetap dilacak sebagai pekerjaan hardening sebelum klaim cakupan non-mutation yang menyeluruh.
