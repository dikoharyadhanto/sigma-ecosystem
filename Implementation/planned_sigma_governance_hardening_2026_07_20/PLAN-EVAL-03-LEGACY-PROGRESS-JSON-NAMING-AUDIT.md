# PLAN-EVAL-03 — Legacy `progress.json` Naming Audit

**Sumber**: Diflag langsung oleh Director (2026-07-20) — arsitektur sudah pindah dari `progress.json` tunggal ke multi-file `progress-v<N>.json` (lihat `Implementation/planned_sigma_multichain_progress_2026_07_17/PLAN-EVAL-01-CORE-STORAGE-SCHEMA-MIGRATION.md`), tapi banyak dokumen kemungkinan belum diperbarui mengikuti istilah baru.
**Tanggal**: 2026-07-20
**Status**: **EXECUTED** (2026-07-20, atas otorisasi eksplisit Director). Semua 46 file diaudit dan diperbaiki, plus 3 temuan tambahan di luar scope asli (lihat "Hasil eksekusi" di bawah). `npm run build && npm test` hijau penuh (214/214 test, 26/26 file).
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

Verifikasi cepat (`grep -rl "progress\.json"`) menemukan istilah `progress.json`
masih dipakai di **46 file** — jauh lebih luas dari perkiraan awal:

- `Sigma/` (16 file): `SIGMA_PROTOCOL.md` (9 titik: baris 47, 281, 294, 316,
  335, 341, 442, 496, 551), keempat rule file (`DEV-RULE.md`, `FMN-RULE.md`,
  `AUD-RULE.md`, `ARC-RULE.md`), semua 6 template (`DEV-EXEC-TEMPLATE.md`,
  `FMN-PLAN-TEMPLATE.md`, `DIR-INTENT-TEMPLATE.md`, `ROADMAP-TEMPLATE.md`,
  `DIR-CLOSE-TEMPLATE.md`), 2 registry JSON, dan 4 role-memory JSON.
- `setup/` (30 file): skill file untuk 6 target AI tool berbeda (`claude_code`,
  `antigravity`, `codex`, `reasonix`, `cursor`, bridge stub `CLAUDE.md`/
  `GEMINI.md`/`AGENTS.md`/`DEEPSEEK.md`), plus `setup/targets/hooks/protect-sigma.js`.

**Konfirmasi teknis**: `src/engine/chain.ts:222` —
`CHAIN_FILE_PATTERN = /^progress-v(\d+)\.json$/` — file aktif memang sudah
bernama `progress-v<N>.json`, bukan `progress.json`, sejak migrasi arsitektur
multi-chain.

**Sampel yang sudah dicek** (`SIGMA_PROTOCOL.md`): seluruh 9 titik yang
ditemukan adalah deskripsi perilaku runtime **saat ini** (mis. baris 47
"`progress.json` is the operational truth for what is permitted", baris 341
"Gate enforcement is performed by the CLI at runtime against `progress.json`")
— bukan referensi historis. Artinya sampel ini kemungkinan besar genuine
drift, bukan pemakaian yang sah.

**Kontras penting — bukan semua kemunculan adalah bug**: `scripts/migrate-legacy-progress.js`
dan `scripts/PANDUAN-MIGRASI-LEGACY-PROGRESS.md` **juga** menyebut
`progress.json`, tapi itu **benar** — keduanya secara eksplisit membahas
migrasi dari format lama, jadi istilah `progress.json` di sana merujuk ke
format legacy yang memang sedang dimigrasikan, bukan drift. Dua file itu
**di luar scope perbaikan** — dicatat di sini supaya audit berikutnya tidak
salah "memperbaiki" referensi yang justru sudah benar.

---

## Belum diketahui — perlu audit sebelum ada rencana perbaikan konkret

Karena Director memang meminta ini prioritas rendah, saya sengaja **tidak**
menghabiskan waktu sekarang untuk membaca seluruh 46 file satu-satu. Yang
perlu dilakukan saat giliran plan ini dikerjakan:

1. Untuk tiap file di 46 daftar, klasifikasikan:
   - **Genuine drift** — mendeskripsikan perilaku/state saat ini, seharusnya
     bilang "chain file aktif (`progress-v<N>.json`)" atau istilah netral
     seperti "runtime chain state", bukan "progress.json".
   - **Historical/migration-legit** — sah menyebut `progress.json` karena
     memang membahas format lama (pola sama seperti dua file `scripts/`
     yang sudah dikecualikan di atas).
2. Untuk file target `setup/` yang jumlahnya banyak (6 tool x beberapa file
   per tool) — cek dulu apakah ada **satu sumber template bersama** yang
   di-generate ke semua target (mirip pola `setup/targets/bridge/CLAUDE.md`
   di PLAN-EVAL-01 §A.1), supaya perbaikan tidak perlu diulang manual di
   30 file terpisah.
3. Prioritaskan `SIGMA_PROTOCOL.md` dan 4 rule file dulu di antara yang
   genuine drift (dampak lebih tinggi — dibaca tiap aktivasi role) sebelum
   menyentuh skill file per-tool.

---

## Kenapa prioritas rendah (per instruksi Director)

Director eksplisit belum tahu apakah drift ini berkontribusi besar atau
kecil terhadap masalah yang sedang diperbaiki (PLAN-EVAL-01/02) — beda
dengan item lain di PLAN-EVAL-01 yang sudah terverifikasi berdampak langsung
ke gerbang keras (mis. drift nomor section DEV-RULE.md). Sampai ada bukti
konkret bahwa istilah "progress.json" yang usang ini benar-benar menyesatkan
AI role (bukan sekadar kosmetik), ini tetap di urutan terakhir.

## Langkah selanjutnya

Menunggu giliran. Saat dikerjakan: mulai dari audit klasifikasi di atas
sebelum menulis rencana perbaikan baris-per-baris seperti PLAN-EVAL-01.

---

## Hasil eksekusi (2026-07-20)

**Klasifikasi**: dari 46 file, 45 genuine drift (diperbaiki), 1 historical-legit
(`SIGMA_PROTOCOL.md:668`, entri changelog v0.5 — dibiarkan, sama seperti
`scripts/migrate-legacy-progress.js`/`PANDUAN-MIGRASI-LEGACY-PROGRESS.md` yang
sudah dikecualikan di draft awal). Tidak ada template bersama di `setup/` (per
`src/commands/setup.ts` — tiap (tool × role) file adalah salinan berdiri
sendiri, `deploySkillsAndHook()` cuma `fs.copySync` mentah) — jadi tidak ada
cara "perbaiki satu sumber, otomatis nyebar ke 30 file", tiap file diedit
manual. Konvensi pengganti: `progress.json` → `progress-v<N>.json` (kadang
`progress-v1.json` spesifik kalau konteksnya jelas-jelas seed/first-chain).

**SIGMA-REGISTRY.json / SIGMA-OPERATION-REGISTRY.json** — Director
mengonfirmasi boleh diedit langsung (bukan lewat `sigma project sync
--confirm`) karena repo ini adalah sumber kanonik yang di-*copy* KELUAR ke
`~/.sigma`, bukan sebaliknya — histori git (`11a61e3`) menunjukkan praktik
edit-langsung ini sudah ada sebelumnya.

### Temuan di luar scope asli (ditemukan saat eksekusi, disetujui Director untuk sekalian diperbaiki)

1. **`setup/targets/hooks/protect-sigma.js` — hook proteksi tidak berfungsi.**
   Regex `/Sigma[\/\\]progress\.json$/` tidak pernah cocok dengan nama file
   aktif pasca-migrasi multichain (`progress-v<N>.json`) — hook ini secara
   efektif tidak memblokir apa pun sejak migrasi. Diperbaiki jadi
   `/Sigma[\/\\]progress(-v\d+)?\.json$/`, konsisten dengan
   `CHAIN_FILE_PATTERN` di `chain.ts:222`. Bug fungsional, bukan kosmetik —
   lebih serius dari framing "prioritas rendah" plan ini.
2. **5 entri `operation_id` hantu di `SIGMA-OPERATION-REGISTRY.json`** —
   mendokumentasikan command yang sudah tidak ada di kode sama sekali:
   `project_reset`, `plan_audit`, `exec_audit`, `close_audit`,
   `roadmap_activate` (yang terakhir malah sudah pernah ditandai
   `"NEEDS_REVIEW": true`, tidak pernah diselesaikan sebelum command-nya
   dihapus). Dihapus semua atas persetujuan Director. `total_operations`
   diperbarui dari 56 → 51.
3. **2 deskripsi operasi yang salah total (bukan cuma nama file), ditemukan
   saat memperbaiki wording `progress.json` di sekitarnya**:
   - `project_register` — deskripsi lama bilang command ini fallback baca
     `progress.json` untuk `project_id`/`project_name` kalau `--id`/`--name`
     tidak diberikan. Kode aktual (`project.ts:448-456,513-514`) sudah tidak
     punya fallback sama sekali — `--id`/`--name` keduanya
     `.requiredOption()`. Deskripsi, inputs, constraints, dan
     error_messages diperbaiki mengikuti perilaku nyata.
   - `roadmap_new` — deskripsi lama bilang ROADMAP baru "ACTIVE kalau belum
     ada ROADMAP ACTIVE, selain itu DRAFT" — model arbitrase ACTIVE/DRAFT
     ini sudah dihapus (PLAN-EVAL-01 §3.5 di folder multichain, komentar
     eksplisit di `chain.ts:994-998`). Kode aktual (`roadmap.ts:39-68`)
     selalu membuat DRAFT, satu ROADMAP per chain. Diperbaiki.

`scripts/refresh-registries.js` yang ada cuma mendeteksi command BARU yang
belum terdaftar di registry — tidak mendeteksi entri LAMA yang sudah tidak
berlaku (seperti 5 entri hantu di atas) atau deskripsi yang jadi salah
karena perilaku command berubah. Drift jenis ini tidak akan tertangkap
otomatis di masa depan tanpa audit manual serupa.
