# Indeks Plan Implementasi — Multi-File Progress Chain (Opsi C)

**Disusun**: 2026-07-17, Professional Mode
**Sumber**: [../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md)
**Status**: Dokumen-dokumen di folder ini adalah plan implementasi biasa yang
disusun dalam Professional Mode. Bukan FMN-PLAN Sigma dan tidak memiliki
otoritas lock/gate Sigma.

Semua dokumen di folder ini sengaja ditulis **ringkas** (inti keputusan +
scope saja) sebagai hasil pemecahan pertama dari DISCUSSION doc. Masing-masing
akan didetailkan dan didiskusikan ulang terpisah saat gilirannya dikerjakan —
jangan dianggap final/lengkap sampai proses itu terjadi.

Tidak berhubungan dengan folder `planned_sigma_evaluation_2026_07_14` atau
`_07_15` (topik dan sumber sesi berbeda). Bernomor ulang dari 01 karena berada
di folder baru — **tidak** melanjutkan penomoran `PLAN-EVAL-01`/`02` di folder
`planned_sigma_evaluation_2026_07_17` (topik berbeda: supersede cascade vs
arsitektur storage).

---

## Isi (urutan = prioritas pengerjaan)

| # | Dokumen | Ringkasan | Dependency |
|---|---|---|---|
| 1 | [PLAN-EVAL-01-CORE-STORAGE-SCHEMA-MIGRATION.md](PLAN-EVAL-01-CORE-STORAGE-SCHEMA-MIGRATION.md) | Fondasi: `progress-v<N>.json` + `activate_status.json`, objek tunggal intent/roadmap/close, rewrite ~104 call site, fold `sigma progress *` → `sigma intent`. | Tidak ada — ini fondasi. |
| 2 | [PLAN-EVAL-02-AUTO-BACKUP-REMOVAL.md](PLAN-EVAL-02-AUTO-BACKUP-REMOVAL.md) | Hapus seluruh mekanisme auto-backup Sigma (termasuk yang sudah ada hari ini), ganti guard git-clean-tree. | Independen — bisa jalan kapan saja. |
| 3 | [PLAN-EVAL-03-MIGRATION-AND-JLH-CUTOVER.md](PLAN-EVAL-03-MIGRATION-AND-JLH-CUTOVER.md) | Algoritma migrasi `progress.json` lama → `progress-v1.json`, JLH sebagai pilot. | #1 (wajib), #2 (untuk pola rollback). |
| 4 | [PLAN-EVAL-04-ROADMAP-CLOSE-LIFECYCLE-GATE-REDEFINITION.md](PLAN-EVAL-04-ROADMAP-CLOSE-LIFECYCLE-GATE-REDEFINITION.md) | Hapus model ACTIVE/INACTIVE roadmap, cascade SUPERSEDED, auto-lock roadmap saat close lock, redefinisi Gate 1.5. | #1 (wajib). |
| 5 | [PLAN-EVAL-05-DOCTOR-MULTICHAIN-RECONSTRUCT.md](PLAN-EVAL-05-DOCTOR-MULTICHAIN-RECONSTRUCT.md) | `sigma doctor --all-versions`, 3 mode `--reconstruct`, kebijakan file chain yatim. | #1 (wajib). |
| 6 | [PLAN-EVAL-06-INTENT-HISTORY-AUTORENDER.md](PLAN-EVAL-06-INTENT-HISTORY-AUTORENDER.md) | `--title`/`--focus` wajib di `intent new`, `Sigma/design/intent-history.md` auto-render. | #1 (wajib). |

**Catatan urutan**: #2 disisipkan sebelum #3 karena keputusan "no backup"
adalah prasyarat konseptual untuk pola rollback migrasi di #3, walau #2
sendiri tidak bergantung teknis pada #1. #4 didahulukan dari #5/#6 karena
Gate 1.5 yang tidak diperbaiki akan memblokir alur kerja harian (`plan`/
`close`) begitu #1 live.
