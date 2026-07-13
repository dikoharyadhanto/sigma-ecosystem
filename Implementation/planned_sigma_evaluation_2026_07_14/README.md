# Indeks Plan Implementasi — Evaluasi Sistem Sigma (14 Juli 2026)

**Sumber**: `Discussion/sigma-system-evaluation-2026-07-14.md`
**Disusun**: 2026-07-14, Professional Mode
**Status**: DRAFT FOR REVIEW
**Catatan**: Dokumen-dokumen di subfolder ini adalah plan implementasi biasa yang
disusun dalam Professional Mode. Bukan FMN-PLAN Sigma dan tidak memiliki otoritas
lock/gate Sigma. Digunakan sebagai draft input sebelum (jika Director menghendaki)
dirumuskan ulang menjadi DIR-INTENT/FMN-PLAN formal per topik atau per kelompok topik.

---

## Tujuan Subfolder

Sesi diskusi evaluasi 14 Juli 2026 menghasilkan 7 topik yang sudah **disepakati**
(lihat dokumen sumber), masing-masing dengan daftar "Implikasi teknis untuk fase
implementasi" yang belum dieksekusi. Subfolder ini memecah seluruh implikasi
teknis tersebut menjadi **8 dokumen plan implementasi**, disusun agar bisa
dikerjakan bertahap, satu dokumen per tahap, tanpa Director perlu membaca ulang
seluruh notulen evaluasi di setiap tahap kerja.

Pembagian **bukan 1:1 dengan 7 topik** — beberapa topik digabung karena
mekanismenya identik (Topik 2+3 sama-sama soal `appendAuditFindings`), beberapa
dipisah karena keputusan yang belum final di dalamnya perlu diselesaikan lebih
dulu sebagai unit kerja sendiri (Topik 4 bagian `override`/`sigma doctor`).

---

## Urutan Eksekusi yang Direkomendasikan

| # | Dokumen | Topik sumber | Kenapa di urutan ini |
|---|---|---|---|
| 1 | [PLAN-EVAL-01-DOCTOR-OVERRIDE-RESET.md](PLAN-EVAL-01-DOCTOR-OVERRIDE-RESET.md) | Topik 4 (`override`+`doctor`, `project reset`) | Satu-satunya keputusan yang **belum final** di seluruh notulen — dokumen sumber eksplisit menyatakan ini "wajib diselesaikan sebagai bagian awal Plan Implementation, bukan diasumsikan". Harus lebih dulu karena `project reset` removal bergantung pada hasil keputusan ini (`sigma doctor --recovery`/`--reconstruct`). |
| 2 | [PLAN-EVAL-02-TRIVIAL-COMMAND-REMOVAL.md](PLAN-EVAL-02-TRIVIAL-COMMAND-REMOVAL.md) | Topik 4 (`gitignore generate`, `sigma sync *`) | Risiko teknis paling rendah di seluruh antrian (murni hapus, tidak menyentuh gate/lock). Baik dikerjakan lebih awal sebagai "quick win" sebelum masuk ke perubahan yang lebih struktural. |
| 3 | [PLAN-EVAL-03-ROADMAP-RESTRUCTURING.md](PLAN-EVAL-03-ROADMAP-RESTRUCTURING.md) | Topik 1 + Topik 4 (keluarga `roadmap`) | Digabung karena satu akar mekanisme yang sama: sumber data Stage Overview pindah dari parsing teks H2 ke baca langsung `progress.json`. Topik 1 (restrukturisasi template) dan konsolidasi `reconcile`/`migrate-core-flow` ke `render` tidak bisa dipisah tanpa duplikasi kerja. |
| 4 | [PLAN-EVAL-04-AUD-FINDINGS-GUARDRAIL-AND-CLEANUP.md](PLAN-EVAL-04-AUD-FINDINGS-GUARDRAIL-AND-CLEANUP.md) | Topik 2 + Topik 3 | Topik 3 (hapus 4 command `appendAuditFindings`) secara eksplisit beririsan dengan Topik 2 (guardrail baru harus lebih dulu tersedia di template sebelum satu-satunya jalur lama dihapus). |
| 5 | [PLAN-EVAL-05-CSO-REMOVAL.md](PLAN-EVAL-05-CSO-REMOVAL.md) | Topik 4 (`cso`) | Berdiri sendiri, cakupan penuh (command, rule file, README/SIGMA_PROTOCOL, skill `/cso`+`/checkpoint`). Tidak bergantung ke topik lain, aman dikerjakan kapan saja sebelum final pass setup. |
| 6 | [PLAN-EVAL-06-LANGUAGE-CONFIG-REDESIGN.md](PLAN-EVAL-06-LANGUAGE-CONFIG-REDESIGN.md) | Topik 4 (`sigma config`) | Berdiri sendiri, tidak bersinggungan teknis dengan topik lain manapun. |
| 7 | [PLAN-EVAL-07-MCP-LEGACY-REMOVAL.md](PLAN-EVAL-07-MCP-LEGACY-REMOVAL.md) | Topik 5 | Harus selesai sebelum final pass setup (#8), karena final pass menghapus Step E/E2 di `setup.ts` yang menjadi orphan hanya setelah topik ini tuntas. |
| 8 | [PLAN-EVAL-08-SETUP-FINAL-PASS-GLOBAL-CLEANUP.md](PLAN-EVAL-08-SETUP-FINAL-PASS-GLOBAL-CLEANUP.md) | Topik 6 + Topik 7 | **Sengaja dikerjakan paling akhir** — arahan eksplisit Director maupun dokumen sumber: `sigma setup` menyentuh hampir seluruh keputusan topik lain (CSO, MCP, roadmap, config, sync), sehingga hanya valid dikerjakan setelah semua di atas selesai. |

Urutan #2–#7 di atas adalah **rekomendasi**, bukan hard constraint — dokumen
sumber secara eksplisit membebaskan urutan topik selain klausul "setup di
akhir". Director bebas menukar urutan #2–#7 sesuai prioritas kerja, selama:
- #1 tetap dikerjakan sebelum bagian `project reset` di dalam #1 sendiri selesai (self-contained, tidak ada dependensi keluar),
- #8 tetap dikerjakan terakhir setelah #1–#7 selesai.

---

## Dependency Silang Antar Dokumen

- **#1 → tidak bergantung ke manapun.** Sepenuhnya self-contained (`doctor.ts`, `override.ts`, `project.ts`).
- **#3 (roadmap) tidak bergantung ke #2 (sync)** meski `sync roadmap` memanggil `render()` — karena `sync.ts` dihapus total di #2, urutan tidak memengaruhi hasil akhir.
- **#4 tidak bisa dikerjakan sebelum bagian template di Topik 2 selesai** — sudah tercakup di dalam #4 sendiri sebagai satu unit kerja (template diperbaiki dulu, baru command lama dihapus).
- **#8 secara eksplisit bergantung pada #5 (CSO), #7 (MCP), dan keputusan `install`/`update` di #-nya sendiri** — lihat tabel "Cakupan yang sudah teridentifikasi" di Topik 6/7 dokumen sumber.

---

## Isu yang Sengaja Tidak Dibuatkan Plan di Sini

Sesuai `Discussion/sigma-system-evaluation-2026-07-14.md` bagian "Isu Terbuka":

- Kategorisasi command Sigma CLI di luar yang sudah dibahas (selain `gitignore generate`, `cso`, `override`, `sigma doctor`) — menunggu arahan Director lebih lanjut, tidak ada dasar keputusan untuk dituangkan ke plan.
- `sigma project register` sebagai topik lanjutan terpisah (disebut sekilas di Topik 4, belum dievaluasi) — bukan bagian dari 7 topik yang disepakati, sengaja tidak dimasukkan ke plan manapun di atas.
