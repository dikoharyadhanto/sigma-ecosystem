# RESULT-IMPL — Stage E W1 review follow-up: Codex putaran 2 findings

**Tanggal**: 2026-09-16
**Sumber**: Review teknis independen Codex putaran 2 atas lima RESULT report Stage E sebelumnya (`RESULT-IMPL-SIGMA-MCP-ATOMIC-WRITE-FIX-20260916.md`, `...-PLAN-DRAFT-...`, `...-EXEC-DRAFT-...`, `...-UPDATE-ARTIFACT-DRAFT-PLAN-EXEC-...`, `...-STAGE-E-W1-COMPLETION-...`), yang menggantikan review naratif putaran 1 (klaim BLOCKER-nya dicabut eksplisit oleh putaran 2 setelah source/test dibuka langsung).
**Perintah Director**: putuskan D-01/D-02/H-01/H-02 lewat pertanyaan terstruktur (2026-09-16), lalu eksekusi.
**Peran implementer**: Claude Code sebagai implementator; Codex sebagai reviewer independen berikutnya. Dokumen ini **tidak** men-declare "Gate E PASS".
**Status**: Empat keputusan Director dieksekusi penuh — dua didokumentasikan (tanpa perubahan kode), dua diimplementasikan dengan test contract penuh. Menunggu review independen Codex atas batch ini.

## 1. Ringkasan keputusan Director dan tindak lanjut

| # | Temuan | Keputusan Director | Tindak lanjut |
|---|---|---|---|
| D-01 | `assertRequiredMetadata` mengubah perilaku CLI `plan new` (menolak `\|`/newline) | Setujui sebagai bug fix | Didokumentasikan di RESULT report `plan_draft` §8. Tidak ada perubahan kode. |
| D-02 | `expected_artifact_sha256` tidak mengikat konten INTENT/ROADMAP/PLAN yang dibaca sebagai precondition | `expected_state_revision` dinyatakan cukup | Didokumentasikan di RESULT report `plan_draft` dan `exec_draft` §8. Tidak ada perubahan kode. |
| H-01 | `sigma_record_evidence` (item asli Plan Doc §9.2 pilot) terlewat total | Bangun sebagai putaran Stage E berikutnya | **Diimplementasikan** — §3 di bawah. |
| H-02 | `sigma_inbox_archive` melanggar invarian §5.9/§13 (CLI dan MCP harus satu service) | Refactor ke service bersama dengan actor-context | **Diimplementasikan** — §2 di bawah. |

## 2. H-02 — `sigma_inbox_archive` direfactor ke service bersama

**Sebelum**: logic hidup di `src/mcp/control/inboxArchive.ts` (MCP-only), CLI `src/commands/inbox.ts`'s `runArchive()` memanggil `updateMessageStatus`/`writeIndex` langsung — dua implementasi mutasi terpisah untuk use case yang sama, melanggar §5 invarian #9 ("Same use case, two adapters") dan §13 ("Service-layer rule": harus menjadi *satu-satunya* jalur CLI dan MCP).

**Sesudah**: satu service `src/services/inboxArchiveService.ts`, `archiveMessage({projectRoot, messageId, actorRole})` dengan `actorRole: string | null`:
- `null` — pemanggil CLI trusted-terminal, ownership check dilewati (perilaku identik byte-for-byte dengan `sigma inbox archive <id>` sebelumnya).
- role string — pemanggil MCP bound-role, `entry.to !== actorRole` ditolak `ROLE_NOT_AUTHORIZED`.

Satu fungsi, satu code path, dua policy saat pemanggilan — bukan dua implementasi. `src/commands/inbox.ts` dan `src/mcp/control/tools/archiveMessage.ts` sama-sama memanggil fungsi ini. `src/mcp/control/inboxArchive.ts` (modul lama) dihapus.

**Regresi**: `test/mailbox-regression.test.ts` (CLI, termasuk test `archive <id>`) dan `test/control-inbox-archive.test.ts` (MCP) tetap PASS tanpa perubahan assertion — perilaku CLI maupun MCP tidak berubah dari sudut pandang eksternal, hanya lokasi/struktur kode. Satu test baru ditambahkan (`actorRole: null` membuktikan bypass ownership check secara eksplisit) — 24 test (naik dari 23).

## 3. H-01 — `sigma_record_evidence` (primitive baru)

**Berbeda dari setiap primitive Stage E sebelumnya**: tidak ada padanan CLI sama sekali (`Sigma/evidence/` yang ada selama ini hanya konvensi path file DEV-EXEC, bukan record evidence terpisah), dan tidak ada data model existing di `chain.ts`. Spesifikasi Plan Doc §9.2 hanya satu baris ("Mencatat evidence terstruktur — Plan/exec ref; hash; no arbitrary host attachment"), sehingga ini murni pekerjaan desain, bukan porting — tiga sub-keputusan diklarifikasi ke Director sebelum implementasi (lihat §3.1–§3.3).

### 3.1 Bentuk data (keputusan Director: "Referensi eksternal")

```ts
interface EvidenceRecord {
  description: string;
  ref_path: string;      // relatif ke project root
  ref_sha256: string;    // dihitung server-side, tidak pernah dipercaya dari caller
  recorded_by: string;   // role
  recorded_at: string;   // ISO timestamp
}
```

Field `plan_version`/`exec_version` pada sketsa awal **sengaja dihilangkan** dari record itu sendiri — sudah implisit dari lokasi array (§3.2), menyimpannya lagi akan jadi sumber kebenaran ganda yang bisa berbeda.

### 3.2 Lokasi penyimpanan (keputusan Director: "Array baru di chain.ts, per exec entry")

`chain.exec.versions[].evidence?: EvidenceRecord[]` (`src/engine/chain.ts` — field baru pada `ArtifactVersion`, hanya pernah diisi pada entry `exec`, sama seperti `human?: HumanArtifactState` yang sudah ada). Naik/turun bersama `state_revision` dan transaction journal `chain.ts` yang sudah ada — tidak ada primitive atomicity baru.

### 3.3 Role owner (keputusan Director: "DEV saja")

`allowedRoles: ['DEV']` — selaras §6.2 Plan Doc ("DEV: create/update exec/evidence").

### 3.4 Boundary `ref_path` (keputusan Director tambahan, diklarifikasi terpisah: "Batasi ke dalam project root")

`ref_path` adalah **satu-satunya path di permukaan MCP ini yang tidak diturunkan dari tracker `chain.ts`** — berbeda total dari model allowlist `src/mcp/artifactPath.ts` yang dipakai `sigma_read_artifact`/`sigma_get_evidence`. Ini didiskusikan eksplisit ke Director karena berdekatan dengan kelas risiko yang membuat `scan` **NOT ADMISSIBLE** (matriks §3.5 — path file arbitrary).

Implementasi (`src/mcp/control/recordEvidence.ts`):
- `ref_path` wajib relatif (absolute ditolak `INVALID_OPERATION`).
- Diresolusi ke `projectRoot`, dicek containment **sebelum** open (`canonicalize()` — realpath, resolve symlink) dan **sesudah** open (mitigasi TOCTOU, pola sama seperti `readCanonicalArtifactFile`) — escape (`../` atau symlink keluar root) ditolak `BOUNDARY_VIOLATION`.
- Dibuka via `fs.openSync` + `fstatSync` (bukan `path.resolve` mentah) — direktori/non-regular-file ditolak `BOUNDARY_VIOLATION`.
- Dibatasi `MAX_EVIDENCE_REF_BYTES` (10 MiB) — bukan untuk payload response (isi file tidak pernah dikembalikan ke caller), tapi karena `respondControlWrite()`'s `mutate()` wajib sinkron (INVARIANT di `shared.ts`) sehingga hash file raksasa di bawah lock akan memblokir request lain.
- `ref_sha256` selalu dihitung server-side dari byte yang benar-benar dibaca — tidak pernah dipercaya dari input caller.

### 3.5 Temuan self-review: `artifact_hash_after` audit trail

Saat self-review (sebelum serah terima), ditemukan `RecordEvidenceResult` awal tidak punya field `sha256` di top level — `respondControlWrite()`'s `sha256Of()` (unwrap struktural, dipakai juga oleh `updateArtifactDraft`) hanya membaca `.sha256` langsung pada objek hasil, bukan field bersarang `.record.ref_sha256`. Efeknya: audit log akan mencatat `artifact_hash_after: null` walau hash sebenarnya ada. **Diperbaiki** dengan menambah field `sha256` di top level `RecordEvidenceResult` (mirror `record.ref_sha256`), dan ditambahkan test khusus yang membaca `Sigma/control/audit.jsonl` langsung dan membuktikan `artifact_hash_after` terisi benar.

## 4. Test dan evidence

**Baru**: `test/control-record-evidence.test.ts`, 32 test:
1. Direct service contract (13 test) — happy path, akumulasi array (bukan overwrite), target `exec_version` eksplisit vs aktif, exec tidak ditemukan, tidak ada exec aktif, description kosong, `ref_path` absolute, traversal `../`, escape lewat directory junction, tidak ada file, direktori, oversized.
2. Role dan gate boundary (3 test) — no role, role selain DEV (FMN), stale state.
3. Idempotency (3 test) — replay, conflict, concurrent same-process.
4. Crash-window safety (2 test) — reject-then-retry, pending-tanpa-journal fail closed.
5. Audit trail (1 test) — `artifact_hash_after` terisi benar (§3.5).
6. Transport-level (1 test) — panggilan tool nyata lewat in-memory MCP client.
7. Cross-process concurrency dan process-death recovery (9 test) — sama idempotency key (tepat satu commit), beda key pada `expected_state_revision` sama (`STALE_STATE`), `it.each` atas 8 failpoint (2 spesifik `record_evidence_after_read`/`record_evidence_after_chain` + 6 generik wrapper) dengan `SIGKILL` proses nyata dan recovery deterministik.

**Diubah**: `test/control-inbox-archive.test.ts` (import path + 1 test baru untuk `actorRole: null`), `test/control-intent-draft.test.ts` (daftar tool exact-match, 13→14), `test/mcp-tools.test.ts` (guard `writerNames` +`recordEvidence`).

**Regresi**:
- `npm run build` — bersih di setiap langkah (H-02, lalu H-01).
- `npm test` — **62 file / 818 test PASS** (naik dari 61 file/785 test sebelum follow-up ini: +1 test `inbox_archive`, +32 test `record_evidence` baru, -0 hilang).
- `test/mailbox-regression.test.ts` (23 test, CLI inbox) tetap PASS tanpa perubahan assertion.

## 5. Self-review adversarial (satu putaran, sebelum serah terima ke Codex)

- **`ref_path` containment diuji tiga arah**: traversal `../` di luar root, direktori (bukan regular file), dan **escape lewat directory junction** — keduanya `BOUNDARY_VIOLATION`. Update 2026-09-16 (menutup saran Codex "tambahkan test symlink escape saat environment mendukungnya"): `fs.symlinkSync(target, link, 'file')` memang gagal `EPERM` di environment ini (tidak ada Developer Mode/elevasi), tapi `fs.symlinkSync(target, link, 'junction')` (reparse point direktori Windows) **tidak** butuh privilese dan `canonicalize()` (via `fs.realpathSync.native`) terbukti me-resolve junction ke target sebenarnya di luar root — dibuktikan lewat probe manual sebelum test ditulis. Test baru membuat junction di dalam `evidence-output/` menunjuk ke direktori temp di luar project root, lalu membuktikan `ref_path` yang melewatinya ditolak `BOUNDARY_VIOLATION`. Gap cakupan sebelumnya sudah tertutup.
- **Role server-derived**: `allowedRoles: ['DEV']` ditegakkan dari `binding.role`; tidak ada field role di `inputSchema` `sigma_record_evidence`.
- **Idempotency scope**: `argumentsForHash` mencakup `exec_version`, `description`, `ref_path` — tidak mencakup `ref_sha256` (server-computed, tidak dikirim caller) — konsisten dengan desain replay-tanpa-revalidasi-state yang sudah diverifikasi Stage C/E sebelumnya.
- **`inbox_archive` regresi CLI dibuktikan, bukan diasumsikan**: 23 test `mailbox-regression.test.ts` dijalankan ulang tanpa modifikasi assertion setelah refactor — bukti perilaku CLI identik, bukan klaim.

## 6. Status akhir

`git status` menunjukkan seluruh perubahan (dua RESULT report Stage E diedit untuk mencatat keputusan D-01/D-02; `inbox_archive` dipindah lokasi; empat file baru untuk `record_evidence`; capability matrix diperbarui; satu RESULT report baru ini) sebagai working-tree diff/untracked — **tidak ada commit yang dibuat oleh implementer**. Menunggu review independen Codex atas batch ini sebelum keputusan commit/lanjut.

## 7. Review teknis independen - 2026-09-16

**Status: PASS WITH LOW-SEVERITY DOCUMENTATION NIT.** H-01 dan H-02 telah ditutup secara teknis. `npm run build`, targeted test follow-up, dan full `npm test -- --silent` selesai tanpa kegagalan yang terlapor. Tidak ada blocker implementasi ditemukan.

### Verifikasi keputusan

- **D-01:** keputusan Director menerima guard metadata CLI sebagai bug fix telah tercatat di Result plan draft.
- **D-02:** interpretasi `expected_artifact_sha256` hanya untuk artifact yang ditulis telah tercatat di Result plan/exec draft. Implementasi tetap konsisten dengan keputusan itu.

### H-02: inbox archive shared service

- `src/services/inboxArchiveService.ts` kini menjadi jalur mutasi tunggal yang dipakai CLI dan MCP.
- CLI memanggil service dengan `actorRole: null`, sehingga perilaku trusted-terminal lama dipertahankan.
- MCP meneruskan bound role server ke service; ownership `entry.to === actorRole` ditegakkan sebelum mutasi.
- Core persistensi tetap memakai helper mailbox yang sama, dan test CLI mailbox serta test MCP follow-up lulus.

### H-01: record evidence

- `sigma_record_evidence` terdaftar sebagai tool DEV-only, memakai verified control binding, stale-state check, idempotency, lock, journal/recovery, dan audit wrapper yang sama.
- `ref_path` harus relatif; containment project root diperiksa sebelum dan setelah open, file harus regular, dan ukuran dibatasi 10 MiB.
- Hash referensi dihitung server-side dari bytes yang dibaca; caller tidak dapat memasok hash sendiri.
- Record di-append ke `chain.exec.versions[].evidence[]`; test membuktikan idempotency, race lintas-proses, recovery crash, role denial, traversal/directory/oversize rejection, dan `artifact_hash_after` audit terisi.
- Matrix capability telah menambahkan `record_evidence` dan mencatat refactor `inbox_archive`.

### Residual risk yang telah diketahui

- Test symlink escape langsung belum dijalankan di Windows karena privilege pembuatan symlink tidak dapat diasumsikan. Source memakai canonicalize sebelum dan sesudah open; ini cukup untuk status saat ini, tetapi test symlink perlu ditambah pada environment yang mendukungnya.
- Director secara eksplisit memilih containment project root, bukan allowlist tracker, untuk `ref_path`. Konsekuensinya DEV dapat mereferensikan dan meng-hash file regular lain di dalam project root, tetapi tidak dapat membaca host path di luar root atau menerima isi file pada response. Ini adalah boundary policy yang telah diputuskan, bukan defect implementasi.

### Temuan minor

Komentar `src/engine/chain.ts` merujuk `src/services/evidenceService.ts`, sedangkan implementasi aktual berada di `src/mcp/control/recordEvidence.ts`. Perbaiki rujukan komentar pada perubahan dokumentasi berikutnya agar tidak menyesatkan maintainer; tidak memengaruhi runtime.

### Verdict

Follow-up ini menutup H-01 dan H-02. Batch Stage E dapat diperlakukan sebagai **W1 yang selesai dalam scope keputusan Director**: `record_evidence` kini tersedia; `send` dan `memo_write` tetap deferred berdasarkan keputusan yang tercatat. Tidak ada klaim Gate E PASS yang dibuat oleh dokumen ini, dan review ini juga tidak menyatakan Gate E PASS.

## 8. Tindak lanjut atas review §7 — 2026-09-16

Kedua item ditutup pada hari yang sama:

1. **Temuan minor (komentar `chain.ts`)** — diperbaiki: `src/services/evidenceService.ts` → `src/mcp/control/recordEvidence.ts`. `npm run build` bersih.
2. **Residual risk (test symlink escape)** — `fs.symlinkSync(..., 'file')` dikonfirmasi gagal `EPERM` di environment ini (tidak ada Developer Mode/elevasi), tapi `fs.symlinkSync(..., 'junction')` (reparse point direktori Windows) **tidak** butuh privilese, dan probe manual membuktikan `canonicalize()` (`fs.realpathSync.native`) tetap me-resolve junction ke target sebenarnya di luar root. Test baru ditambahkan (`test/control-record-evidence.test.ts` — junction di `evidence-output/` menunjuk ke direktori temp di luar project root) membuktikan `BOUNDARY_VIOLATION` tertegak. Ini bukan symlink file, tapi menutup kelas risiko yang sama (reparse-point escape) dengan mekanisme yang tersedia tanpa elevasi di environment ini.

**Evidence**: `npm run build` bersih; `test/control-record-evidence.test.ts` naik dari 31 menjadi 32 test, seluruhnya PASS; full suite **62 file / 818 test PASS** (naik dari 817).
