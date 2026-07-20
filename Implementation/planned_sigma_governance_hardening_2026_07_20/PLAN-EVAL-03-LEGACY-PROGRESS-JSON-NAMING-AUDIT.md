# PLAN-EVAL-03 — Legacy `progress.json` Naming Audit

**Sumber**: Diflag langsung oleh Director (2026-07-20) — arsitektur sudah pindah dari `progress.json` tunggal ke multi-file `progress-v<N>.json` (lihat `Implementation/planned_sigma_multichain_progress_2026_07_17/PLAN-EVAL-01-CORE-STORAGE-SCHEMA-MIGRATION.md`), tapi banyak dokumen kemungkinan belum diperbarui mengikuti istilah baru.
**Tanggal**: 2026-07-20
**Status**: DRAFT — **belum diaudit per-file**. Ini pencatatan scope + metode audit, bukan daftar perbaikan siap eksekusi. Director eksplisit meminta ini jadi prioritas **paling rendah/terakhir**.
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
