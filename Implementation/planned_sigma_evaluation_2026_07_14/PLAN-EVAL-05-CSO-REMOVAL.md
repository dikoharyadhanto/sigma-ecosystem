# PLAN-EVAL-05 — Penghapusan Total Fitur CSO (Context Session Object)

**Sumber**: `Discussion/sigma-system-evaluation-2026-07-14.md` (Topik 4 — kategori "Evaluate to be removed", item `cso`)
**Tanggal**: 2026-07-14
**Status**: DRAFT FOR REVIEW
**Urutan eksekusi**: 5 dari 8 (lihat `README.md` di folder ini)
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN, tidak punya otoritas lock/gate Sigma.

---

## Objective

Menghapus fitur CSO (`cso new`) secara penuh dari sistem — bukan hanya command
CLI, tapi seluruh sistem yang bergantung padanya: rule file per role, dokumen
publik, dan skill Claude Code. Perannya sudah digantikan `sigma
message`/inbox untuk konteks handover.

**Keputusan Director bersifat FINAL dan cakupan penuh** (dikonfirmasi
eksplisit di sesi evaluasi): hapus termasuk seluruh sistem yang bergantung
pada CSO, bukan cuma command CLI.

---

## Alasan Director

Konsep CSO bagus tapi tidak dibutuhkan — perannya sudah digantikan `sigma
message`/inbox untuk konteks handover antar sesi/role.

---

## Cakupan Penghapusan

### 1. Command CLI
- `src/commands/cso.ts` (`cso new`).

### 2. Referensi Konsep di Rule File Role (4 file)
- `Sigma/rules/ARC-RULE.md`
- `Sigma/rules/AUD-RULE.md`
- `Sigma/rules/DEV-RULE.md`
- `Sigma/rules/FMN-RULE.md`, mis. [FMN-RULE.md:361](../../Sigma/rules/FMN-RULE.md#L361)

### 3. Dokumentasi Publik
- `README.md`
- `Sigma/SIGMA_PROTOCOL.md`

### 4. Skill Claude Code
- Skill `/cso` — memanggil `sigma cso new` langsung.
- Skill `/checkpoint` — memanggil `sigma cso new` langsung.
- Kedua skill perlu **dipensiunkan atau dialihkan ke `sigma send`** (keputusan bentuk pengalihan ditentukan saat implementasi — lihat Task Breakdown).

---

## Task Breakdown

**Tahap 1 — Pemetaan Referensi Lengkap**
- [ ] Grep menyeluruh untuk `cso`/`CSO`/`Context Session Object` di seluruh repo (`src/`, `Sigma/`, `README.md`, skill directory Claude Code) untuk memastikan cakupan di atas lengkap sebelum mulai menghapus.

**Tahap 2 — Hapus Command & Engine**
- [ ] Hapus `src/commands/cso.ts` dan registrasinya di `src/cli.ts`.
- [ ] Hapus fungsi engine pendukung CSO (jika ada helper terpisah di `src/engine/` atau `src/utils/` — verifikasi lewat grep di Tahap 1).
- [ ] Hapus test terkait CSO (grep `cso` di folder `test/`).

**Tahap 3 — Bersihkan Rule File**
- [ ] Revisi `Sigma/rules/ARC-RULE.md`, `AUD-RULE.md`, `DEV-RULE.md`, `FMN-RULE.md` — hapus seluruh referensi konsep/alur CSO ([FMN-RULE.md:361](../../Sigma/rules/FMN-RULE.md#L361) dan yang lain hasil Tahap 1).

**Tahap 4 — Bersihkan Dokumentasi**
- [ ] Update `README.md` — hapus bagian yang menjelaskan `sigma cso new`.
- [ ] Update `Sigma/SIGMA_PROTOCOL.md` — hapus referensi CSO di seluruh bagian yang relevan (command table, penjelasan konsep, dsb).

**Tahap 5 — Pensiunkan/Alihkan Skill**
- [ ] Putuskan bentuk pengalihan skill `/cso` dan `/checkpoint`: opsi (a) hapus total kedua skill, (b) ubah isi skill agar memanggil `sigma send` sebagai gantinya dengan nama skill yang sama, atau (c) hapus `/cso` total dan ubah `/checkpoint` jadi alias tipis ke `sigma send`. Konfirmasi pilihan ke Director sebelum implementasi skill selesai.
- [ ] Implementasikan pilihan yang dikonfirmasi di file skill terkait.

**Tahap 6 — Verifikasi Akhir**
- [ ] Grep ulang seluruh repo untuk memastikan tidak ada sisa referensi `cso`/CSO yang lolos dari Tahap 2-5.

---

## Dependency Catatan

- **PLAN-EVAL-08** (setup final pass) memiliki dependency **masuk** dari plan
  ini: `ROLE_FILES` map di `src/commands/setup.ts` punya entri `checkpoint`/
  `cso` per platform yang perlu dihapus sebagai konsekuensi plan ini — item itu
  sengaja **tidak** dikerjakan di sini, melainkan di PLAN-EVAL-08 sesuai
  arahan "topik setup dikerjakan di akhir".
- Tidak ada dependency masuk dari plan lain — CSO removal berdiri sendiri.

---

## Risiko

- Skill `/cso` dan `/checkpoint` adalah satu-satunya jalur command CSO yang
  benar-benar dipakai Director sehari-hari (via Claude Code) — pastikan
  pengalihan Tahap 5 dikomunikasikan jelas, jangan sampai Director kehilangan
  alur checkpoint tanpa pengganti yang jelas.
- Referensi CSO tersebar di banyak file (4 rule file + 2 dokumen + 1 skill
  pasangan) — risiko utama adalah referensi yang lolos grep pertama (Tahap
  1). Tahap 6 wajib dilakukan sebagai verifikasi penutup.

---

## Draft Acceptance Criteria

- [ ] `sigma cso new` tidak lagi terdaftar di CLI.
- [ ] Tidak ada referensi CSO tersisa di `ARC-RULE.md`, `AUD-RULE.md`, `DEV-RULE.md`, `FMN-RULE.md`.
- [ ] Tidak ada referensi CSO tersisa di `README.md`/`SIGMA_PROTOCOL.md`.
- [ ] Skill `/cso` dan `/checkpoint` sudah dipensiunkan atau dialihkan ke `sigma send` sesuai keputusan Director.
- [ ] Grep akhir untuk `cso`/CSO di seluruh repo tidak menemukan referensi aktif yang tersisa (di luar catatan historis di `Discussion/`/`Implementation/` yang memang dokumen arsip).
- [ ] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini.
