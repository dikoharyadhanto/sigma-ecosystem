# RESULT-IMPL â€” Stage E W1 pilot: perluasan `sigma_update_artifact_draft` ke tipe plan/exec

**Tanggal**: 2026-09-16
**Sumber**: `PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE-20260915.md` Â§14 Stage E, menyusul `RESULT-IMPL-SIGMA-MCP-STAGE-E-PLAN-DRAFT-20260916.md` dan `RESULT-IMPL-SIGMA-MCP-STAGE-E-EXEC-DRAFT-20260916.md`, keduanya mencatat item ini sebagai pekerjaan Stage E yang belum dikerjakan.
**Konteks eksekusi**: dikerjakan sementara Codex (reviewer independen) rate-limited, atas instruksi Director untuk lanjut implementasi tanpa menunggu â€” bukan pengganti review, tiga increment Stage E (`plan_draft`, `exec_draft`, dan perluasan ini) plus fix fondasi `chain.ts`/`controlStore.ts` kini satu paket menunggu Codex aktif kembali.
**Peran implementer**: Claude Code sebagai implementator; Codex sebagai reviewer independen berikutnya. Dokumen ini **tidak** men-declare "Gate E PASS".
**Status**: Implementasi + test contract selesai, satu putaran self-review adversarial dilakukan. Menunggu review independen Codex.

## 1. Ringkasan

Berbeda dari `plan_draft`/`exec_draft` (tool MCP baru), pekerjaan ini **memperluas tool yang sudah ada dan sudah lulus Gate C** (`sigma_update_artifact_draft`) dari `type:"intent"` saja menjadi `intent`/`plan`/`exec`. Tidak ada tool baru terdaftar, tidak ada CLI yang direfactor (tidak ada CLI `intent update`/`plan update`/`exec update` â€” manusia mengedit file DRAFT langsung, dicatat sejak Stage C).

Dua perbedaan struktural yang jadi fokus:

1. **Role sekarang type-dependent**, bukan hardcoded `['ARC']`: intent â†’ ARC, plan â†’ FMN, exec â†’ DEV (`ownerRoleForArtifactType()`).
2. **Lookup artifact sekarang type-dependent**: `chain.intent` adalah objek tunggal (lookup langsung), `chain.plan.versions[]`/`chain.exec.versions[]` adalah array (perlu `.find(v => v.version === version)`). Fungsi baru `resolveDraftEntry()` menjembatani perbedaan ini di satu tempat, dipakai baik oleh `updateArtifactDraftTransactionFiles()` maupun `updateArtifactDraft()`.

Lapisan keamanan path (`assertCanonicalLocation`/`readCanonicalArtifactFile`/`writeCanonicalArtifactFile`, `src/mcp/artifactPath.ts`) **tidak disentuh sama sekali** â€” sudah generik untuk kelima `ArtifactType` sejak Batch 1. Perluasan ini murni di lapisan business-logic (lookup + role) di atasnya.

## 2. File yang berubah

**Diubah**:
- `src/mcp/control/artifactDraftUpdate.ts` â€” `UpdatableArtifactType` (`'intent'|'plan'|'exec'`), `ownerRoleForArtifactType()`, `isUpdatableArtifactType()`, `resolveDraftEntry()` baru; `updateArtifactDraft()`/`updateArtifactDraftTransactionFiles()` memakainya menggantikan akses langsung `chain.intent.*`.
- `src/mcp/control/tools/updateArtifactDraft.ts` â€” skema `type: z.enum(['intent','plan','exec'])`; `allowedRoles: [ownerRoleForArtifactType(args.type)]` dihitung per-call; deskripsi tool diperbarui.
- `test/control-intent-draft.test.ts` â€” test "refuses a type other than intent (pilot scope)" diperbarui: target `type: 'plan'` (sekarang valid) diganti loop atas `['roadmap', 'close']` (masih genuinely di luar cakupan).
- `Implementation/sigma-mcp/SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md` â€” baris `plan_update`: "deferred Stage E for `plan`" â†’ "implemented â€” Stage E W1 pilot", mencatat `exec` ikut tercakup tool yang sama.

**Baru**:
- `test/control-artifact-draft-update-plan-exec.test.ts` â€” 12 test.

## 3. Deviasi dan keputusan desain

1. **Pesan error intent digeneralisasi ke pesan generik per-tipe** (`"${type} ${version} is in state \"${state}\"; only a DRAFT can be updated through this tool."` menggantikan pesan literal `"DIR-INTENT ${version} is in state..."`). Diverifikasi TIDAK ada test yang meng-assert substring "DIR-INTENT" pada pesan ini (hanya `/only a DRAFT/`, generik) sebelum melakukan perubahan â€” pelajaran langsung dari regresi pesan CLI di RESULT `exec_draft` Â§3.1: setiap perubahan teks pesan diverifikasi terhadap test existing dulu, tidak diasumsikan aman.
2. **Pesan "not found" untuk intent tetap dipertahankan verbatim** (`"The active chain's intent is at version X, not Y."`) â€” cabang `type === 'intent'` di `resolveDraftEntry()` adalah salinan persis logic lama, bukan digeneralisasi, karena test existing (`/not v2|v1, not v2/`) mengasumsikan bentuk pesan spesifik itu.
3. **`roadmap`/`close` tetap di luar cakupan** â€” sesuai daftar W1 Director yang eksplisit hanya menyebut "plan/exec". Ditegakkan di dua lapis (skema Zod `z.enum` tidak menyertakan keduanya; runtime check `isUpdatableArtifactType()` menolak sebelum mencapai lookup) â€” pola pertahanan berlapis yang sama seperti pilot Stage C.
4. **Idempotency scope terhadap `bound_role` yang kini bervariasi per tipe** tidak diuji lewat test baru khusus â€” ini properti struktural `IdempotencyRecord` (`src/engine/controlStore.ts`, sudah ada sejak Stage C: record di-hash dari `operationId + boundRole + idempotencyKey`) yang sudah diverifikasi benar oleh test suite `controlStore` yang ada; tidak ada logic baru yang perlu dibuktikan ulang di titik ini â€” dicatat eksplisit di sini sebagai keputusan cakupan, bukan celah yang terlewat.

## 4. Test dan evidence

**Baru**: `test/control-artifact-draft-update-plan-exec.test.ts`, 12 test:

1. **Owner role per tipe** (1 test) â€” `ownerRoleForArtifactType('plan')==='FMN'`, `('exec')==='DEV'`, `('intent')==='ARC'`.
2. **Array lookup (plan)** (4 test) â€” update `v0.1` tidak menyentuh `v0.2` yang tidak terkait; versi tidak ada di array â†’ `INVALID_OPERATION`; versi LOCKED (bukan DRAFT) â†’ ditolak; hash stale â†’ `STALE_ARTIFACT`, file tidak tersentuh; hash cocok â†’ tertulis atomik, `state_revision` tidak bergerak.
3. **Array lookup (exec)** (2 test) â€” versi tidak ada di array â†’ `INVALID_OPERATION`; hash cocok â†’ tertulis atomik.
4. **Transport-level lewat MCP client nyata** (3 test) â€” update plan sebagai FMN berhasil, percobaan yang sama dengan binding DEV ditolak `ROLE_NOT_AUTHORIZED` dan **tidak** menyentuh file (dibuktikan dengan membaca ulang isi file); update exec sebagai DEV berhasil, binding FMN ditolak; `roadmap` ditolak di level skema (`isError:true`) â€” scope tidak diam-diam melebar.
5. **Cross-process concurrency (plan)** (1 test) â€” dua proses `sigma-control` nyata racing pada hash artifact yang sama, tepat satu menulis, yang kalah `STALE_ARTIFACT`.

**Regresi**:
- `npm run build` â€” bersih.
- `npm test` â€” **57 file / 687 test PASS** (naik dari 56 file/675 test setelah `exec_draft`; delta murni test baru).
- `test/control-intent-draft.test.ts` (34 test, termasuk seluruh kontrak `sigma_update_artifact_draft` untuk intent dari Stage C) dijalankan ulang penuh dan PASS tanpa perubahan â€” parity jalur intent benar-benar terjaga, bukan diasumsikan.

## 5. Self-review adversarial (satu putaran, sebelum serah terima ke Codex)

- **Role benar-benar type-dependent dan server-derived**: `allowedRoles` dihitung dari `ownerRoleForArtifactType(args.type)` di level tool, bukan dari input caller manapun; dibuktikan lewat test transport-level (FMN sukses/DEV ditolak untuk plan, dan sebaliknya untuk exec), termasuk bukti file tidak tersentuh pada percobaan yang ditolak.
- **Lapisan `assertCanonicalLocation` tidak disentuh** â€” diverifikasi secara struktural (diff tidak menyentuh `artifactPath.ts`) dan fungsional (path hasil tulis persis `Sigma/contract/FMN-PLAN-v0.1.md`/`Sigma/evidence/DEV-EXEC-v0.1.md`, sesuai `ARTIFACT_LAYOUT`).
- **`resolveDraftEntry()` dipanggil identik oleh `transactionFiles` dan `mutate`** â€” pola yang sama yang menjaga konsistensi di `plan_draft`/`exec_draft`.
- **Fidelity pesan CLI/error**: diverifikasi dulu tidak ada test yang bergantung pada teks spesifik sebelum menggeneralisasi pesan (Â§3.1), berbeda dari pendekatan "porting verbatim tanpa pengecekan" yang menyebabkan regresi di `exec_draft`.
- **Cakupan roadmap/close tetap tertutup** â€” dibuktikan di dua lapis (skema + service), bukan hanya didokumentasikan.

## 6. Yang belum dikerjakan (sengaja, di luar cakupan putaran ini)

- `sigma_send_message`/`sigma_write_memo` â€” eksplisit di luar rotasi Stage E saat ini per pengingat Director, butuh desain ulang terpisah.
- Operasi roadmap â€” belum disentuh.
- `roadmap`/`close` tetap di luar cakupan `sigma_update_artifact_draft`.
- Seluruh item W2 (governance transition selain `intent_ratify`) â€” belum tersentuh.
- W3 â€” tetap deferred permanen.

## 7. Status akhir

`git status` menunjukkan seluruh perubahan sebagai working-tree diff/untracked; tidak ada commit yang dibuat oleh implementer. Menunggu review Codex (aktif kembali) dan keputusan Director soal commit/lanjut ke primitive Stage E berikutnya.

## 8. Review teknis independen - 2026-09-16

**Status: PASS.** Perluasan `sigma_update_artifact_draft` untuk PLAN dan EXEC konsisten dengan design control-plane dan lulus verifikasi source/test yang diperiksa. Build TypeScript, targeted control test, dan full suite test selesai tanpa kegagalan yang terlapor; `git diff --check` tidak melaporkan error whitespace.

### Bukti yang diperiksa dan terverifikasi

- `ownerRoleForArtifactType()` memetakan intent/plan/exec ke ARC/FMN/DEV dan tool menghitung `allowedRoles` dari tipe tersebut, bukan dari role input caller.
- Schema membatasi tipe pada `intent|plan|exec`; roadmap/close ditolak.
- `updateArtifactDraft()` membatasi content ke `MAX_ARTIFACT_BYTES` (512 KiB), memverifikasi `expected_artifact_sha256`, memakai canonical artifact path, dan menulis atomik.
- Wrapper control memverifikasi binding control, stale state, idempotency, lock, journal/recovery, serta audit event.
- Test aktual mencakup PLAN stale hash, role rejection tanpa write, typed schema rejection, dan cross-process contention; source menunjukan jalur hash/size/path yang sama untuk PLAN dan EXEC.

### Catatan perbaikan non-blocking

Tambahkan test eksplisit untuk EXEC pada `STALE_ARTIFACT`, entry non-DRAFT, dan race lintas-proses. Ini gap coverage spesifik tipe, bukan indikasi defect saat ini, karena source memakai jalur generic yang sama dan suite penuh lulus.

### Koreksi terhadap catatan review sebelumnya

Klaim bahwa size cap, stale-state/hash contract, canonical path, policy availability, audit observability, atau bukti source belum tersedia **dicabut**. Semuanya dapat diverifikasi di implementasi.
