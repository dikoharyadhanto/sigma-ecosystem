# Indeks Plan Implementasi — Governance Hardening (dari Bug Report 2026-07-20)

**Disusun**: 2026-07-20, Professional Mode
**Sumber**: [../../Discussion/sigma-bug-report-20260720-131540.md](../../Discussion/sigma-bug-report-20260720-131540.md) (laporan 3-bagian AUD/DEV/FMN), diperkuat diskusi lanjutan Director dengan analisis silang ChatGPT (soft invariant vs hard invariant, kelas Runtime Extension vs Runtime Foundation).
**Status**: Dokumen-dokumen di folder ini adalah plan implementasi biasa yang
disusun dalam Professional Mode. Bukan FMN-PLAN Sigma dan tidak memiliki
otoritas lock/gate Sigma.

Semua dokumen di folder ini sudah didetailkan cukup jauh (bukan cuma ringkasan
satu paragraf) karena scope-nya sudah diverifikasi langsung terhadap kode dan
rule file nyata pada tanggal ini — tapi tetap akan didiskusikan ulang saat
gilirannya dikerjakan sebelum eksekusi final.

Tidak berhubungan dengan folder `planned_sigma_multichain_progress_2026_07_17`
atau `planned_sigma_evaluation_*` (topik dan sumber sesi berbeda). Bernomor
ulang dari 01 karena berada di folder baru.

---

## Isi (urutan = prioritas pengerjaan)

| # | Dokumen | Ringkasan | Dependency |
|---|---|---|---|
| 1 | [PLAN-EVAL-01-RULE-DOCUMENTATION-DRIFT-FIXES.md](PLAN-EVAL-01-RULE-DOCUMENTATION-DRIFT-FIXES.md) | Perbaikan teks murni: frasa CLI usang, drift nomor section (lebih parah dari temuan awal — lihat catatan di bawah), gap izin CLI AUD, nilai `--type`/`--action` yang hilang, slot Protocol Overrides di FMN-PLAN, instruksi Asset ID Tracker, klarifikasi otorisasi mid-build, dan satu doktrin baru di SIGMA_PROTOCOL.md. | Tidak ada — semua item independen satu sama lain. |
| 2 | [PLAN-EVAL-02-EXEC-AUTHORIZE-GATE.md](PLAN-EVAL-02-EXEC-AUTHORIZE-GATE.md) | Fitur runtime baru: `sigma exec authorize` — mengganti pola "DEV menilai sendiri apakah frasa Director cukup" dengan flag terstruktur di chain state. Draf awal (belum final) — butuh ronde desain terpisah sebelum implementasi. | Independen secara teknis dari #1, tapi idealnya #1 selesai dulu supaya DEV-RULE.md yang dirujuk `sigma exec authorize` sudah dalam kondisi bersih (nomor section tidak drift). |
| 3 | [PLAN-EVAL-03-LEGACY-PROGRESS-JSON-NAMING-AUDIT.md](PLAN-EVAL-03-LEGACY-PROGRESS-JSON-NAMING-AUDIT.md) | **EXECUTED.** Istilah `progress.json` usang diperbaiki di 45/46 file (1 historical-legit dibiarkan). Ternyata dampaknya lebih besar dari perkiraan: termasuk hook `protect-sigma.js` yang tidak lagi memblokir apa pun, dan 5 entri command hantu + 2 deskripsi salah total di `SIGMA-OPERATION-REGISTRY.json`. | Independen dari #1 dan #2. |

**Catatan urutan**: #1 didahulukan murni karena risikonya jauh lebih rendah
(tidak ada perubahan kode fungsional, kecuali satu penambahan section ID di
`docCheck.ts` untuk item A.5) dan tidak bergantung pada keputusan desain
terbuka apa pun. #2 sengaja dipisah karena menyentuh skema `chain.ts`/
`progress.json` — kelas kerja yang jauh lebih besar ("Runtime Extension" per
istilah diskusi Director, bukan "Runtime Foundation" penuh seperti
session-scoped memory enforcement yang secara eksplisit **tidak** direncanakan
di sini, lihat bagian ditolak di bawah).

---

## Temuan tambahan di luar bug report asli (ditemukan saat menyusun plan ini)

Bug report 2026-07-20 hanya mencontohkan drift "Section 1b" / "Sections 1–4"
di `DEV-RULE.md`. Saat memverifikasi langsung ke `DEV-EXEC-TEMPLATE.md` untuk
menyusun plan ini, ditemukan drift serupa yang **belum pernah dilaporkan**:

- `DEV-RULE.md:696` — "DEV advisory status (Section 12)" → seharusnya
  Section 14 (DEV Completion Statement).
- `DEV-RULE.md:699` dan `:712` — "Section 13" → seharusnya Section 15 (FMN
  Post-Build Review).
- `FMN-RULE.md:104` — "Section 15 (Director Observation Testing Report)" →
  seharusnya Section 16 (Director Observation Report & Minor Requests).
- `FMN-RULE.md:532` dan `:537` — "Section 13" → seharusnya Section 15 (FMN
  Post-Build Review).

Ini memperkuat argumen struktural di PLAN-EVAL-01 §A.2: masalahnya bukan satu
kesalahan ketik, tapi pola berulang setiap kali template mendapat section baru
(mis. penambahan "Director's Summary" oleh commit `13ad887`) tanpa ada
mekanisme yang memaksa rule file ikut diperbarui.

---

## Item yang dipertimbangkan tapi ditolak (Group C — dicatat untuk jejak audit)

Hasil penyaringan bersama Director: item ini muncul di laporan/diskusi tapi
dinilai menambah friksi tanpa manfaat sepadan, atau sudah tercakup memadai
oleh mekanisme lain. **Tidak** menjadi bagian plan mana pun di folder ini.

1. **Klausul eksplisit "gerbang otorisasi CLI AUD berlaku terlepas
   read-only/destructive"** — ditolak. Diverifikasi: `AUD-RULE.md` §CLI
   Operation Policy (baris 1003-1010) sudah *unconditional*, tidak ada
   pengecualian read-only sama sekali. Insiden yang melatarbelakangi usulan
   ini (AUD menjalankan 5 command tanpa izin) adalah pelanggaran AUD atas
   aturannya sendiri, bukan celah teks — menambah klausul di sini cuma
   menegaskan yang sudah jelas.
2. **Trigger baru "Mid-Build Material Finding"** dengan pola pesan baku +
   aturan stop-total-vs-lanjut-sebagian — ditolak sebagai kelas trigger
   formal. "General Message Policy: diskresi DEV" yang ada sekarang terbukti
   berhasil menangani kasus TC-002. Sebagai gantinya, PLAN-EVAL-01 §A.7 cuma
   menambah satu kalimat panduan default (condong ke pause), bukan trigger
   + template baru.
3. **Validasi semantik di `sigma plan check`** (mendeteksi legalitas tipe
   artefak per fase, mis. "Candidate Claim" vs "RQ-NNN card") — ditolak
   sebagai proyek umum. Validasi semantik-per-fase mahal dibangun dan rapuh
   (rawan false positive/negative). Desain saat ini (struktural dicek mesin,
   semantik dicek AUD/human) dipertahankan.
4. **`MEMORY_LOADED` hard session-state flag** yang memblokir seluruh operasi
   CLI sampai `sigma memory --<role>` dijalankan — ditolak untuk saat ini,
   bukan karena arahnya salah, tapi karena Sigma CLI **belum punya konsep
   sesi sama sekali** (diverifikasi: `sigma session bootstrap` di
   `src/commands/session.ts` murni stateless, baca ulang `progress.json`
   tiap kali dipanggil, tidak ada flag persisten). Ini kelas "Runtime
   Foundation" — butuh infrastruktur baru, bukan tambal teks. Dicatat sebagai
   kandidat backlog arsitektur terpisah, bukan bagian dua plan di folder ini.
