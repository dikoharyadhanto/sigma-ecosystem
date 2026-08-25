# PLAN-IMPL — Sigma Artifact Folder Rename

**Sumber**: Diskusi lanjutan pada sesi ini (2026-08-16), terpisah dari evaluasi Notion/Humanize tapi bersinggungan dengan satu keputusan yang sempat terbuka di sana (lokasi folder dokumen human).
**Tanggal**: 2026-08-16 · **Revisi 1**
**Status**: **Fase 1–5 SELESAI (2026-08-25).** Fase 6 (migrasi `sigma doctor` untuk proyek lama) sengaja ditunda, di luar cakupan plan ini (§2.3). 397/397 test lulus, tanpa regresi.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.
**Hubungan dengan plan lain**: Menyelesaikan pertanyaan terbuka di `PLAN-IMPL-SIGMA-HUMANIZE-OPERATION-20260816` §6 poin 2 (lokasi file human) — dikonfirmasi Director tetap folder terpisah `Sigma/human/`, bukan nested di dalam folder tiap artefak. Tidak bergantung ke plan Notion v2 atau Humanize; bisa dikerjakan independen.
**Branch**: diusulkan branch baru terpisah, `feat/sigma-artifact-folder-rename`, dari `main`. `main` tidak disentuh, tidak ada merge tanpa izin eksplisit Director.

---

## 1. Masalah yang diselesaikan

Dua keluhan Director terhadap struktur folder `Sigma/` yang ada sekarang:

1. **Nama generik, tidak mencerminkan vocabulary Sigma sendiri.** `design/` dan `build/` adalah istilah umum yang bisa berarti apa saja; tidak menyiratkan apa isinya tanpa membuka file.
2. **`build/` mencampur tiga tipe artefak berbeda dalam satu folder datar** — `ROADMAP-v<N>.md`, `FMN-PLAN-v<N>.md`, dan `DEV-EXEC-v<N>.md` semua duduk bersebelahan, dibedakan cuma dari prefix nama file. Di proyek dengan siklus panjang (`CanopySense` sebagai contoh nyata — puluhan versi `FMN-PLAN` dan `DEV-EXEC`), folder ini jadi sangat padat dan sulit ditelusuri.

---

## 2. Keputusan

### 2.1 Pemetaan folder baru

| Folder lama | Folder baru | Artefak | Alasan penamaan |
| :--- | :--- | :--- | :--- |
| `Sigma/design/` | `Sigma/charter/` | `DIR-INTENT` | "Charter" berpasangan alami dengan **RATIFIED** — status lock INTENT yang sudah ada — dan secara isi memang persis project charter: objective, scope, constraint, kriteria sukses, otorisasi proyek berjalan. Lebih pas dari alternatif yang sempat dipertimbangkan (`blueprint/` — terlalu menyiratkan dokumen teknis; `vision/` — terlalu lunak untuk dokumen yang juga berisi constraint mengikat). |
| `Sigma/build/` | `Sigma/contract/` | `FMN-PLAN` | Sudah jadi vocabulary internal dokumen itu sendiri — section 6 `FMN-PLAN` namanya literally "Pre-Build Test Contract". |
| `Sigma/build/` | `Sigma/roadmap/` | `ROADMAP` | Tidak berubah nama, cuma dipisah jadi folder sendiri. |
| `Sigma/build/` | `Sigma/evidence/` | `DEV-EXEC` | Header dokumen `DEV-EXEC` sendiri menyebut dirinya "verification evidence". |
| `Sigma/close/` | `Sigma/close/` | `DIR-CLOSE` | Tidak berubah. |
| *(baru)* | `Sigma/human/` | `*-HUMAN` (dari `PLAN-IMPL-SIGMA-HUMANIZE-OPERATION`) | Dikonfirmasi Director tetap folder terpisah di root `Sigma/`, bukan nested di dalam `charter/`/`contract/`/`evidence/` masing-masing. Menyelesaikan pertanyaan terbuka di plan Humanize §6. |
| *(baru)* | `Sigma/notes/` | Catatan kerja bebas-format, bertanggal (analog `Discussion/` di repo ini sendiri, atau `KLHK_JasaLingkunganHidup/discussion/`) | Bukan artefak Sigma resmi — tidak tunduk gate/lock. Aturan konten & hubungannya dengan skill `/humanize` didetailkan di plan Humanize §2.9, folder ini cuma mengunci lokasinya. |

`reference/` **tetap di dalam `Sigma/`** (`Sigma/reference/`), tidak dikeluarkan ke root proyek dan tidak diganti nama — dipertimbangkan Director, ditolak karena risiko tabrakan nama generik di root (banyak proyek sudah punya `docs/`/`reference/`/`research/` sendiri) dan supaya jejak Sigma tetap terkurung satu folder, konsisten dengan motif awal "git tidak boleh kotor oleh artefak Sigma".

### 2.2 Cakupan: proyek baru saja, tanpa migrasi paksa

Diverifikasi langsung ke kode sebelum keputusan ini diambil: setiap command (`intent.ts`, `plan.ts`, `exec.ts`, `roadmap.ts`) resolve path artefak dengan pola `entry.file ?? path.join('Sigma', '<folder-lama>', ...)` — path yang **tersimpan** di `progress-v<N>.json` selalu diprioritaskan di atas hasil hitung ulang dari nama folder. Ini diverifikasi di:

- [`src/commands/intent.ts:53`](../src/commands/intent.ts#L53)
- [`src/commands/plan.ts:56,64`](../src/commands/plan.ts#L56)
- [`src/commands/exec.ts:28`](../src/commands/exec.ts#L28)
- [`src/commands/roadmap.ts:30`](../src/commands/roadmap.ts#L30)

Konsekuensinya: **proyek yang sudah ada (mis. CanopySense) tidak rusak** kalau default folder untuk proyek baru diganti — path lama mereka tetap tersimpan dan tetap valid tanpa migrasi apa pun. Rename ini berlaku **hanya untuk proyek yang dibuat setelah fitur ini rilis**, konsisten dengan pola cakupan yang sudah dipakai untuk gate Notion dan gate Humanize di plan-plan sebelumnya.

### 2.3 Migrasi untuk proyek lama — opsional, lewat `sigma doctor`

Director: migrasi untuk proyek existing yang mau ikut pindah ke struktur baru ditangani lewat `sigma doctor` nanti — dicatat sebagai kerja terpisah, tidak didetailkan di plan ini. `sigma doctor` sudah punya preseden untuk operasi reconcile/repair semacam ini (`--reconstruct` untuk membangun ulang `progress-v<N>.json` dari file artefak).

---

## 3. Cakupan Teknis

### 3.1 Yang berubah

- `SUBFOLDERS` di [`src/config.ts:52`](../src/config.ts#L52) — saat ini `['design', 'build', 'close', 'rules', 'logs', 'memory', 'role-memory', 'reference']`. Jadi `['charter', 'contract', 'roadmap', 'evidence', 'close', 'human', 'notes', 'rules', 'logs', 'memory', 'role-memory', 'reference']`. Dipakai `sigma project start` ([`src/commands/project.ts:211`](../src/commands/project.ts#L211)) untuk pre-create folder saat proyek baru dibuat.
- Default path fallback di `intent.ts` (`design` → `charter`), `plan.ts` (`build` → `contract` untuk FMN-PLAN, `build` → `roadmap` untuk ROADMAP), `exec.ts` (`build` → `evidence`). `close.ts` tidak berubah.
- Dokumentasi: `README.md`, `SIGMA_PROTOCOL.md`, komentar kode yang menyebut path lama sebagai contoh.
- Template yang mereferensikan path folder secara eksplisit di isinya (kalau ada).

### 3.2 Yang TIDAK berubah dalam plan ini

- `rules/`, `logs/`, `memory/`, `role-memory/`, `reference/`, `messages/` — di luar cakupan, tidak dibahas Director sebagai keluhan.
- Struktur `Sigma/human/` internal (penamaan file di dalamnya) — itu domain `PLAN-IMPL-SIGMA-HUMANIZE-OPERATION`, plan ini cuma mengunci lokasinya di level root.
- Mekanisme migrasi `sigma doctor` itu sendiri — dicatat sebagai kerja terpisah (§2.3), tidak dirancang di sini.

### 3.3 Test yang perlu disesuaikan

`test/helpers.ts` dan fixture lain yang hardcode path `Sigma/design/DIR-INTENT-...`, `Sigma/build/FMN-PLAN-...`, `Sigma/build/DEV-EXEC-...`, `Sigma/build/ROADMAP-...` — perlu disweep dan disesuaikan ke folder baru untuk test yang memvalidasi proyek baru. Test yang secara sengaja memvalidasi kompatibilitas mundur (path lama tetap terbaca) perlu ditambahkan, bukan cuma diganti.

---

## 4. Fase Implementasi (usulan)

| Fase | Isi | Status |
| :--- | :--- | :--- |
| **1 — Config & scaffolding** | `SUBFOLDERS` di `config.ts`, `sigma project start` mem-precreate folder baru termasuk `human/` | Selesai |
| **2 — Default path per command** | `intent.ts`/`plan.ts`/`exec.ts`/`roadmap.ts` — ganti default fallback ke folder baru; `close.ts` tidak disentuh | Selesai |
| **3 — Regresi kompatibilitas mundur** | Test eksplisit: chain lama dengan `entry.file` menunjuk folder lama tetap ter-resolve benar tanpa migrasi (`test/folder-rename-backward-compat.test.ts`) | Selesai |
| **4 — Sweep test fixture** | `test/helpers.ts` dan fixture lain disesuaikan ke folder baru untuk skenario proyek baru; termasuk temuan di luar cakupan awal — `src/engine/reconstruct.ts` (dual-candidate scan) dan `src/utils/intentHistory.ts` (existence-check path) — yang tidak punya `entry.file` tersimpan untuk fallback | Selesai |
| **5 — Dokumentasi** | README, `SIGMA_PROTOCOL.md`, komentar kode, template yang mereferensikan path lama | Selesai |
| **6 — Migrasi `sigma doctor`** *(terpisah, opsional)* | Dicatat sebagai kerja lanjutan, tidak digarap dalam plan ini | Ditunda, di luar cakupan plan ini |

Fase 3 (regresi kompatibilitas mundur) sengaja mendahului Fase 4 (sweep fixture) — supaya jaminan "proyek lama tidak rusak" punya bukti test sebelum fixture proyek baru ikut diubah, bukan diasumsikan benar dari pembacaan kode saja.

---

## 5. Pertanyaan Terbuka

Tidak ada yang mem-block dimulainya Fase 1–5 — seluruh keputusan penamaan dan cakupan sudah dikunci Director (§2). Fase 6 (migrasi) sengaja dibiarkan tidak terjadwal, menunggu Director membuka itu secara terpisah.
