# Indeks Plan Implementasi — Closure Authority Migration + ARC Satisfaction Score

**Disusun**: 2026-07-20, Professional Mode (AI teknisi/pengembang Sigma).
**Sumber**: [../../Discussion/closure-authority-and-arc-scoring-proposal-20260720.md](../../Discussion/closure-authority-and-arc-scoring-proposal-20260720.md) — hasil diskusi Director + AI teknisi/pengembang, diaudit AUD tiga putaran, verdict akhir **PASS (Strong Pass)**.
**Status**: Dokumen-dokumen di folder ini adalah plan implementasi biasa yang
disusun dalam Professional Mode. Bukan FMN-PLAN Sigma dan tidak memiliki
otoritas lock/gate Sigma. **Belum ada satu baris kode atau rule file pun yang
diubah** — folder ini murni draf plan-eval untuk direview Director.

**PENTING — gerbang eksekusi**: Sesuai instruksi eksplisit Director, penyusunan
dokumen plan-eval ini (dokumen yang sedang Anda baca) diizinkan berjalan
sekarang. **Eksekusi (perubahan kode/rule file sungguhan) hanya boleh dimulai
setelah Director memberi otorisasi eksplisit untuk memulai** — per dokumen
sumber ini dan per dokumen masing-masing di bawah.

**Status per 2026-07-21**: #1, #2, dan #3 sudah **EXECUTED** (lihat tabel di
bawah). Eksekusi #3 dilanjutkan setelah Director secara eksplisit meminta
lanjut dan memberi otorisasi 2026-07-21. #4 menunggu Director kembali
meminta lanjut eksekusi.

Tidak berhubungan dengan folder `planned_sigma_governance_hardening_2026_07_20`,
`planned_sigma_multichain_progress_2026_07_17`, atau `planned_sigma_evaluation_*`
(topik dan sumber sesi berbeda). Bernomor ulang dari 01 karena berada di folder baru.

---

## Isi (urutan = prioritas/dependency pengerjaan)

| # | Dokumen | Ringkasan | Dependency |
|---|---|---|---|
| 1 | [PLAN-EVAL-01-ARC-CLOSE-CLI-AUTHORITY-MIGRATION.md](PLAN-EVAL-01-ARC-CLOSE-CLI-AUTHORITY-MIGRATION.md) — **EXECUTED (2026-07-20)** | Pindahkan wewenang operasional CLI `close` dari FMN ke ARC. Murni rule-file text + role definition rewrite — tidak menyentuh schema `chain.ts` atau kode command. | Tidak ada — independen secara teknis, tapi logisnya harus lebih dulu (tanpa ini, skor di #2 tidak ada gunanya operasional karena ARC belum berwenang menjalankan `close`). |
| 2 | [PLAN-EVAL-02-GATE-3-5-ARC-SATISFACTION-SCORE.md](PLAN-EVAL-02-GATE-3-5-ARC-SATISFACTION-SCORE.md) — **EXECUTED (2026-07-20)** | Mekanisme skor ARC sebagai syarat `sigma close new` ("Gate 3.5"). Menyentuh schema `chain.ts`, command baru `sigma intent score`, `intent-history.md`, parser `reconstruct.ts`, dan gate definition baru di `SIGMA_PROTOCOL.md` §7. | Idealnya setelah #1 (lihat alasan di atas), tapi tidak ada blocker teknis keras. |
| 3 | [PLAN-EVAL-03-ARC-FMN-MANDATORY-MESSAGE-TRIGGER.md](PLAN-EVAL-03-ARC-FMN-MANDATORY-MESSAGE-TRIGGER.md) — **EXECUTED (2026-07-21)** | Trigger pesan wajib baru ARC → FMN, dipicu tiap pasangan plan+exec LOCKED baru. Murni penambahan section di `ARC-RULE.md`. | Bergantung pada #2 (pesan melaporkan band skor yang didefinisikan di #2) — **EXECUTED**. |
| 4 | [PLAN-EVAL-04-PETITION-ADMISSION-REVIEW.md](PLAN-EVAL-04-PETITION-ADMISSION-REVIEW.md) | Mekanisme Petition → Admission Review → Re-evaluation untuk permintaan re-evaluasi skor. Murni governance/prosa di `ARC-RULE.md` + `AUD-RULE.md` — **sengaja tidak** dipetakan ke command CLI baru (lihat rasional AUD, dicatat sebagai perbedaan pendapat terbuka yang belum diputuskan Director). | Bergantung secara konten pada #2 (mereferensikan band skor) dan #3 (Trigger yang bisa memicu Petition). |
| 5 | [PLAN-EVAL-05-SETUP-TARGETS-FMN-CLOSE-AUTHORITY-DRIFT.md](PLAN-EVAL-05-SETUP-TARGETS-FMN-CLOSE-AUTHORITY-DRIFT.md) | Perbaiki drift yang ditemukan saat eksekusi #2: file target platform (`fmn.md`/`report.md` di 6 target) belum ikut diupdate saat PLAN-EVAL-01 mencabut wewenang `sigma close` dari FMN. Murni rule-text di file target, tidak menyentuh kode. | Tidak bergantung pada #2–#4 secara teknis — perbaikan terhadap #1 yang terlewat. Ditemukan, bukan direncanakan sejak awal. |

---

## Yang **sengaja tidak** masuk plan manapun di folder ini

Sesuai catatan eksplisit di dokumen sumber (Section 9 poin 8, Section 10):

1. **Rework template `DIR-CLOSE`** — sudah disepakati perlu terjadi, tapi
   secara eksplisit ditunda oleh Director. Tidak ada PLAN-EVAL untuk ini di
   folder ini.
2. **`sigma intent score --history`** (command terpisah untuk melihat tren
   skor) — diusulkan AUD, disepakati sebagai kebutuhan nyata, tapi ditunda ke
   `PLAN-EVAL` lanjutan setelah versi pertama berjalan.
3. **Perluasan pola Petition/Admission Review ke domain lain** (mis.
   menantang finding AUD) — dicatat AUD sebagai kemungkinan arsitektur masa
   depan, bukan bagian scope proposal ini.

---

## Open items yang butuh keputusan/verifikasi Director **sebelum** salah satu
## dokumen di atas layak dianggap final/siap-lock

Ini bukan kekurangan dalam penyusunan plan — ini murni titik yang dokumen
sumber sendiri catat sebagai belum diputuskan (Section 10). Didaftar ulang di
sini per dokumen yang terdampak, supaya tidak hilang saat plan dibaca terpisah:

- ~~**PLAN-EVAL-01**: daftar frasa aktivasi ARC untuk skenario BUILD/CLOSE~~
  — **RESOLVED (2026-07-20)**. Tidak dibutuhkan daftar frasa: pola ARC yang
  sudah berlaku (`arc-memory.json` baris 21) adalah selalu berhenti dan
  bertanya dulu, tidak pernah menyimpulkan dari pola kalimat. Perbaikannya
  jadi memperluas pertanyaan default aktivasi ARC dari satu opsi ("buka
  DIR-INTENT baru?") jadi dua opsi ("buka DIR-INTENT baru, atau evaluasi
  chain yang sudah locked menuju closure?"). Lihat PLAN-EVAL-01 §1a/§1b.
- ~~**PLAN-EVAL-02**: daftar frasa otorisasi-commit yang cukup/tidak cukup
  untuk `sigma intent score`~~ — **RESOLVED (2026-07-20)**. Director
  merumuskan: "catat skor", "catat skor ke sigma", "masukkan skor",
  "masukkan skor ke sigma" (atau padanan tak-ambigu setara) — dibedakan dari
  bahasa Approval-class biasa yang menyetujui isi skor, bukan tindakan
  mencatatnya. Ditulis final ke `ARC-RULE.md` §ARC Satisfaction Score
  Methodology.
- **PLAN-EVAL-04**: (a) kapan/apakah Admission Review dipetakan ke command
  CLI — AI teknisi/pengembang dan AUD tidak sepakat, Director belum
  memutuskan; (b) siapa mengaudit konsistensi Admission Decision ARC — arah
  diusulkan (`AUD-RULE.md` §4) tapi mekanisme detail belum dirancang.
- **Baru (ditemukan 2026-07-20, di luar scope #1–#4)**: file target platform
  (`setup/targets/*/fmn.md`, `report.md` — claude_code, codex, antigravity,
  reasonix, bridge, cursor) masih menyebut FMN berwenang `sigma close
  check`/`close lock`, padahal `FMN-RULE.md` kanonik sudah mencabut wewenang
  itu saat PLAN-EVAL-01 dieksekusi (file target ARC ikut diupdate waktu itu,
  file target FMN terlewat). Director meminta ini diperbaiki dan dituangkan
  sebagai plan-eval terpisah — lihat
  [PLAN-EVAL-05-SETUP-TARGETS-FMN-CLOSE-AUTHORITY-DRIFT.md](PLAN-EVAL-05-SETUP-TARGETS-FMN-CLOSE-AUTHORITY-DRIFT.md)
  (DRAFT, belum dieksekusi).

Item PLAN-EVAL-04 dan PLAN-EVAL-05 dicatat eksplisit di dalam dokumen
masing-masing sebagai "belum final" — bukan diam-diam diasumsikan oleh AI
teknisi/pengembang saat menyusun plan ini.

---

## Constitutional cross-check

Ketiga insight audit AUD (Section 8 dokumen sumber) dijadikan prinsip
pengujian untuk setiap keputusan implementasi di keempat dokumen ini:

- **Evidence** — dasar objektif evaluasi (riwayat plan+exec LOCKED, bukan
  kesan subjektif).
- **Authority** — Director tetap pemegang keputusan arah proyek; skor tidak
  pernah menggerbangi `close lock`.
- **Integrity** — ARC wajib mempertahankan penilaian jujur terhadap evidence
  dan kontrak yang berlaku, bahkan terhadap preferensi Director hari ini.

Begitu salah satu diagram di atas mulai mengambil peran yang lain saat
implementasi (mis. menambah override diam-diam untuk skor < 50), itu sinyal
plan menyimpang dari yang disepakati di diskusi sumber — bukan perbaikan.
