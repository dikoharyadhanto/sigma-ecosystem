# PLAN-EVAL-06 — Redesain Sistem Konfigurasi Bahasa (`sigma config`)

**Sumber**: `Discussion/sigma-system-evaluation-2026-07-14.md` (Topik 4 — `sigma config`)
**Tanggal**: 2026-07-14
**Status**: DRAFT FOR REVIEW
**Urutan eksekusi**: 6 dari 8 (lihat `README.md` di folder ini)
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN, tidak punya otoritas lock/gate Sigma.

---

## Objective

Bukan soal menghapus command, tapi memperjelas dan memperbaiki desain sistem
preferensi bahasa `sigma config` sehingga preferensi yang disampaikan Director
di sesi chat benar-benar konsisten antar sesi, bukan diulang manual setiap
kali.

---

## Latar Belakang

Director terbiasa menyampaikan preferensi bahasa secara verbal ke AI role
tiap sesi ("gunakan bahasa Indonesia dalam percakapan"), padahal mekanisme
untuk mempersist-kan ini sudah ada (`sigma config set language`) tapi tidak
pernah dipakai — sehingga tidak konsisten antar sesi.

### Temuan Teknis (sudah diverifikasi dari kode)

- `project.config.json` sebelumnya punya 3 field ([projectConfig.ts:5-10](../../src/engine/projectConfig.ts#L5-L10)): `document_language`, `interaction_language`, `formal_identifier_language`. Hanya `interaction_language` yang punya CLI setter (`config set language`); `document_language` cuma bisa diset sekali saat `project start --lang`, tidak ada setter setelahnya.
- `sigma session bootstrap` ([session.ts:149-158](../../src/commands/session.ts#L149-L158)) **sudah** menampilkan blok preferensi bahasa + instruksi eksplisit `[LANG] Write document prose in ...` — tapi **disembunyikan kalau masih default English** ("only surface when non-English to avoid noise"). Ini akar kenapa mekanisme yang sudah ada terasa tidak pernah "muncul".
- `formal_identifier_language` ([projectConfig.ts:9,16,57](../../src/engine/projectConfig.ts#L9); [config.ts:44](../../src/commands/config.ts#L44)): **sepenuhnya vestigial** — tidak ada setter, tidak pernah dibaca/jadi keputusan di manapun di codebase, hardcode selalu `'en'`. Aman dihapus tanpa dampak fungsional.
- Bahasa dokumen sebenarnya **2 kategori**, bukan 1: dokumen Sigma (DIR-INTENT/FMN-PLAN/dst., = `document_language` yang sudah ada) vs dokumen non-Sigma (output umum di luar artefak formal, mis. file log seperti `Discussion/*.md`) — kategori kedua ini **belum punya field sama sekali**.

---

## Keputusan Final

1. `formal_identifier_language` **dihapus** dari schema — tidak ada dampak fungsional.
2. Schema `project.config.json` final: **3 field** — `interaction_language` (percakapan), `document_language` (dokumen Sigma, sudah ada), **1 field baru** untuk dokumen non-Sigma (nama field final ditentukan saat implementasi tahap ini, bukan di sesi evaluasi).
3. **Tipe nilai semua field bahasa diubah dari kode language (en/id/fr/dst. + lookup `LANG_NAMES`) menjadi string bebas/deskriptif.** Director tidak mau dibatasi daftar kode bahasa — cukup tulis deskriptif (mis. `"Javanese language/Bahasa Jawa"`), AI langsung paham tanpa perlu tabel lookup kode↔nama. `LANG_NAMES` dict dan fungsi `langLabel()` tidak diperlukan lagi (atau disederhanakan jadi pass-through string apa adanya).
4. `sigma session bootstrap` **selalu menampilkan blok preferensi bahasa**, tidak lagi disembunyikan saat default.
5. **Aturan perilaku baru**: ketika Director secara eksplisit menyatakan preferensi bahasa di tengah percakapan, AI role **tidak langsung menjalankan `sigma config`** — AI **wajib menawarkan dulu** apakah preferensi itu ingin dipersist ke Sigma config, dan baru menjalankan `sigma config` setelah **approval eksplisit** Director (selaras "Director Authorization Language" di `CLAUDE.md`).
6. Aturan di atas **diformalkan ke role-memory per role** (`Sigma/role-memory/{ARC,FMN,DEV,AUD}-memory.json`) sebagai satu poin general. **Catatan penting**: Professional Mode (mode default, non-governance) **tidak memuat role-memory sama sekali** — aturan ini hanya aktif saat salah satu role governance (ARC/FMN/DEV/AUD) sedang aktif.

---

## Task Breakdown

**Tahap 1 — Schema**
- [ ] Hapus field `formal_identifier_language` dari `ProjectConfig` interface, `DEFAULTS`, dan `createDefaultProjectConfig()` di `src/engine/projectConfig.ts`.
- [ ] Tentukan nama final field bahasa dokumen non-Sigma (kandidat: `output_document_language`, `general_document_language` — pilih satu, dokumentasikan alasan singkat di sini setelah diputuskan).
- [ ] Tambah field baru tersebut ke `ProjectConfig`, `DEFAULTS`, `createDefaultProjectConfig()`.

**Tahap 2 — Tipe Nilai Bebas**
- [ ] Ubah tipe validasi/penanganan semua field bahasa dari kode-terbatas (mis. enum `en`/`id`/dst.) menjadi string bebas.
- [ ] Hapus atau sederhanakan `LANG_NAMES` dict dan `langLabel()` — jika masih dipakai di tempat lain untuk formatting, ubah jadi pass-through string apa adanya.

**Tahap 3 — CLI Setter**
- [ ] Tambah CLI setter untuk `document_language` (saat ini tidak ada setter post-creation, hanya bisa diset sekali saat `project start --lang`).
- [ ] Tambah CLI setter untuk field baru dokumen non-Sigma.
- [ ] Restrukturisasi `sigma config set language` jadi beberapa sub-target yang jelas (mis. `config set language --interaction`, `--sigma-document`, `--output-document`) — bentuk final flag ditentukan saat implementasi.

**Tahap 4 — `session bootstrap`**
- [ ] Hapus logika kondisional "only surface when non-English" di `session.ts:150` — blok bahasa selalu tampil apa pun nilainya (termasuk saat masih default).

**Tahap 5 — Role Memory**
- [ ] Tambahkan poin baru ke `Sigma/role-memory/{ARC,FMN,DEV,AUD}-memory.json`: instruksi "jika Director menyatakan preferensi bahasa eksplisit di percakapan, tawarkan dulu apakah ingin dipersist ke `sigma config`; jalankan hanya setelah Director approve eksplisit."

**Tahap 6 — Dokumentasi**
- [ ] Update `README.md`/`Sigma/SIGMA_PROTOCOL.md` yang menjelaskan `sigma config` dan field bahasa — sesuaikan dengan schema 3-field baru dan tipe string bebas.

---

## Dependency Catatan

Tidak ada dependency ke/dari plan lain — topik ini murni berdiri sendiri
secara teknis.

---

## Risiko

- Mengubah tipe field dari kode-terbatas ke string bebas berarti validasi
  input jadi jauh lebih longgar — pastikan tidak ada logic lain di codebase
  yang diam-diam mengasumsikan field ini selalu berupa kode 2-huruf (grep
  `document_language`/`interaction_language` sebelum mengubah tipe).
- Restrukturisasi `config set language` jadi beberapa sub-target berpotensi
  breaking change untuk siapa pun yang sudah terbiasa dengan flag lama —
  risiko kecil karena tool ini dipakai Director sendiri, tapi tetap perlu
  dicatat di README sebagai perubahan perilaku CLI.

---

## Draft Acceptance Criteria

- [ ] `formal_identifier_language` tidak lagi ada di schema `project.config.json`.
- [ ] Field baru untuk bahasa dokumen non-Sigma tersedia dan punya CLI setter.
- [ ] Semua field bahasa menerima string bebas, bukan lagi dibatasi daftar kode.
- [ ] `sigma session bootstrap` selalu menampilkan blok preferensi bahasa, termasuk saat semua field masih default.
- [ ] `document_language` punya CLI setter post-creation (tidak lagi hanya bisa diset sekali saat `project start`).
- [ ] Keempat file `Sigma/role-memory/{role}-memory.json` memuat poin aturan "tawarkan dulu sebelum persist preferensi bahasa".
- [ ] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini.
