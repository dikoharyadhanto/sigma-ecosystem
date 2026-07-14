# PLAN-EVAL-06 — Redesain Sistem Konfigurasi Bahasa (`sigma config`)

**Sumber**: `Discussion/sigma-system-evaluation-2026-07-14.md` (Topik 4 — `sigma config`)
**Tanggal**: 2026-07-14
**Status**: IMPLEMENTED (2026-07-14) — seluruh Tahap 1-6 selesai dikerjakan dan diverifikasi. Lihat "Implementation Walkthrough" di akhir dokumen.
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
2. Schema `project.config.json` final: **3 field** — `interaction_language` (AI communication / percakapan), `document_language` (dokumen Sigma, sudah ada), **`output_document_language`** (field baru, untuk dokumen non-Sigma / output umum — nama final diputuskan pasca-evaluasi, lihat Riwayat Diskusi Tambahan).
3. **Tipe nilai semua field bahasa diubah dari kode language (en/id/fr/dst. + lookup `LANG_NAMES`) menjadi nama bahasa dalam bentuk string bebas.** Definisi presisi: *nilai field bahasa adalah nama bahasa dalam bentuk string bebas yang dapat dipahami manusia dan AI — tidak dibatasi kode ISO maupun daftar enum.* Field ini menyimpan **nama bahasa, bukan instruksi** (boundary hasil review AUD).
   - Contoh valid: `English`, `Indonesia`, `Japanese`, `Jepang`, `Bahasa Jawa`, `Jawa`, `Français`, `Deutsch`.
   - Contoh tidak direkomendasikan (secara teknis tetap diterima karena tidak ada validasi enforced, tapi menyalahi semantik field): `Gunakan Bahasa Indonesia formal`, `Indonesia + English`, `Tolong jawab pakai Indonesia`.
   - `LANG_NAMES` dict dan fungsi `langLabel()` tidak diperlukan lagi (atau disederhanakan jadi pass-through string apa adanya).
   - **Nilai default bawaan seluruh field**: string literal **`"English"`** (bukan lagi kode `'en'`) — konsisten dengan tipe value bebas di atas.
4. `sigma session bootstrap` **selalu menampilkan blok preferensi bahasa**, tidak lagi disembunyikan saat default.
5. **Aturan perilaku baru**: ketika Director secara eksplisit menyatakan preferensi bahasa di tengah percakapan, AI role **tidak langsung menjalankan `sigma config`** — AI **wajib menawarkan dulu** apakah preferensi itu ingin dipersist ke Sigma config, dan baru menjalankan `sigma config` setelah **approval eksplisit** Director (selaras "Director Authorization Language" di `CLAUDE.md`).
6. **Klarifikasi cakupan semantik (Ide Director, disetujui)**: preferensi bahasa hanya mengatur **arah tulis/respons AI** (bagaimana AI berbicara dan menulis dokumen) — **bukan kemampuan baca/pemahaman**. AI **tidak boleh auto-switch** bahasa respons hanya karena Director kebetulan menulis pesan dalam bahasa lain di tengah sesi. Yang memicu alur tawaran-persist di poin 5 hanya **instruksi eksplisit** ("balas pakai bahasa Indonesia"), bukan sekadar bahasa pesan Director itu sendiri. Konsekuensi: pada project baru dengan config default (`English`), jika Director menulis penuh dalam bahasa lain tanpa pernah menyatakan instruksi eksplisit, AI tetap merespons dalam `English` sampai ada instruksi eksplisit atau config diubah.
7. Aturan poin 5 dan 6 **diformalkan ke role-memory per role** (`Sigma/role-memory/{ARC,FMN,DEV,AUD}-memory.json`) sebagai poin general. **Catatan penting**: Professional Mode (mode default, non-governance) **tidak memuat role-memory sama sekali** — aturan ini hanya aktif saat salah satu role governance (ARC/FMN/DEV/AUD) sedang aktif.

---

## Riwayat Diskusi Tambahan (pasca-evaluasi, 2026-07-14)

Poin berikut adalah hasil diskusi lanjutan Director dengan AUD (advisory) dan Professional Mode, setelah draft awal plan ini disusun. Semua poin di bawah **final** dan menggantikan bagian "ditentukan saat implementasi" yang relevan di draft awal.

- **Nama field baru**: `output_document_language` (diputuskan dari frasa Director "output written language"; kontras jelas dengan `document_language` untuk dokumen Sigma).
- **Wording tipe value**: direvisi dari "string bebas/deskriptif" menjadi "nama bahasa dalam bentuk string bebas" (saran AUD) — menghindari ambiguitas bahwa field ini bisa diisi kalimat deskriptif/instruksi. Verdict AUD atas poin ini: **PASS** (sebelumnya PASS_WITH_RISK).
- **Desain wizard interaktif** (menggantikan opsi flag `--interaction`/`--sigma-document`/`--output-document` sebagai satu-satunya jalur, lihat Tahap 3): satu alur tanya-jawab berurutan, 3 pertanyaan yes/no, dipakai bersama oleh `sigma project start` (mode interaktif) dan `sigma config` (dijalankan tanpa subcommand):
  1. `Change AI Communication Language? (y/n)` → jika `y`, input manual oleh Director (atau diisi AI bila Director secara eksplisit meminta AI mengisi) → set `interaction_language`.
  2. `Change Output Doc Written Language? (y/n)` → pola sama → set `output_document_language`.
  3. `Change Sigma Docs Language? (y/n)` → pola sama → set `document_language`.
  - Jika Director menjawab `n` pada salah satu pertanyaan, wizard **wajib menampilkan label eksplisit** bahwa default dipakai, misalnya: `Sigma Docs Language: using default — English`. Tidak boleh diam-diam skip tanpa keterangan.
  - Logic 3-pertanyaan ini harus jadi **satu fungsi shared**, dipakai ulang oleh kedua entry point (`project start` dan bare `config`) — hindari duplikasi definisi pertanyaan.
  - Flag scripting (`config set language --interaction <value>` dst., lihat Tahap 3) tetap dipertahankan sebagai jalur non-interaktif untuk automation/CI; wizard adalah jalur interaktif untuk Director yang menjalankan langsung dari terminal. Kedua jalur ini saling melengkapi, bukan saling menggantikan.
  - Bentuk final flag non-interaktif untuk `project start --confirm` (single shorthand vs 3 flag terpisah per field) masih **dideferred ke tahap implementasi** — bukan bagian dari perubahan perilaku yang perlu diputuskan Director sekarang.
- **Temuan tambahan (bukan dari plan awal): `Sigma/SIGMA_PROTOCOL.md` §16D stale.** Dua masalah: (1) menyebut file config sebagai `Sigma/sigma.config.json`, padahal nama aktual adalah `Sigma/project.config.json`; (2) menyatakan *"Artifact content is always written in English regardless of language setting"* — ini kontradiksi langsung dengan `document_language` yang sudah ada di kode dan dengan seluruh premis `Discussion/SIGMA_PERSONAL_LANGUAGE_PREFERENCE_NOTE.md`. §16D harus dikoreksi mengikuti perilaku `document_language` yang sudah ada (bukan sebaliknya) — lihat Tahap 6.

---

## Task Breakdown

**Tahap 1 — Schema**
- [x] Hapus field `formal_identifier_language` dari `ProjectConfig` interface, `DEFAULTS`, dan `createDefaultProjectConfig()` di `src/engine/projectConfig.ts`.
- [x] Tambah field baru `output_document_language` ke `ProjectConfig`, `DEFAULTS`, `createDefaultProjectConfig()`.
- [x] Set nilai `DEFAULTS` ketiga field bahasa ke string literal `"English"` (bukan `'en'`); update juga default parameter `createDefaultProjectConfig(lang = 'en')` → `'English'`.

**Tahap 2 — Tipe Nilai Bebas**
- [x] Ubah tipe validasi/penanganan semua field bahasa dari kode-terbatas (mis. enum `en`/`id`/dst.) menjadi nama bahasa dalam bentuk string bebas (lihat definisi presisi di Keputusan Final #3).
- [x] Hapus `LANG_NAMES` dict dan `langLabel()` sepenuhnya (bukan disederhanakan jadi pass-through) — seluruh call site diganti pakai field string apa adanya langsung. Lihat Implementation Walkthrough untuk alasan pilih hapus total.

**Tahap 3 — CLI Setter & Wizard Interaktif**
- [x] Tambah CLI setter untuk `document_language` (saat ini tidak ada setter post-creation, hanya bisa diset sekali saat `project start --lang`).
- [x] Tambah CLI setter untuk `output_document_language`.
- [x] Restrukturisasi `sigma config set language` jadi beberapa sub-target yang jelas (mis. `config set language --interaction`, `--sigma-document`, `--output-document`) — jalur ini untuk automation/scripting/CI.
- [x] Implementasikan wizard interaktif 3-pertanyaan yes/no (lihat "Riwayat Diskusi Tambahan" untuk urutan dan copy persis) sebagai **satu fungsi shared** (`src/engine/languageWizard.ts`).
- [x] Pasang wizard tersebut sebagai default action `sigma config` saat dijalankan **tanpa subcommand**.
- [x] Pasang wizard yang sama ke dalam alur interaktif `sigma project start` (menyatu dengan prompt `projectId`/`projectName` yang sudah ada di `project.ts:139-158`), aktif hanya saat mode interaktif (bukan `--confirm`).
- [x] Pastikan wizard menampilkan label eksplisit saat default dipakai (`... using default — English`) untuk setiap pertanyaan yang dijawab `n`. Diperluas: kalau field sudah pernah dikustomisasi (bukan default), label jadi `keeping current — <value>` — bukan salah mengklaim "default" untuk nilai yang sebenarnya sudah diubah Director sebelumnya.
- [x] Bentuk final flag non-interaktif untuk `project start --confirm`: **shorthand tunggal** — `--lang <name>` mengisi ketiga field sekaligus dengan nilai yang sama (kompatibel dengan flag lama, cuma berhenti memaksa lowercase/ISO code). Tidak ditambah 3 flag terpisah karena non-interactive/`--confirm` mode ditujukan untuk automation/CI yang biasanya cukup satu bahasa seragam; kalau butuh nilai berbeda per field di mode non-interaktif, jalankan `config set language` setelah `project start`.

**Tahap 4 — `session bootstrap`**
- [x] Hapus logika kondisional "only surface when non-English" di `session.ts:150` — blok bahasa selalu tampil apa pun nilainya (termasuk saat masih default `English`).

**Tahap 5 — Role Memory**
- [x] Tambahkan poin baru ke `Sigma/role-memory/{ARC,FMN,DEV,AUD}-memory.json`: instruksi "jika Director menyatakan preferensi bahasa eksplisit di percakapan, tawarkan dulu apakah ingin dipersist ke `sigma config`; jalankan hanya setelah Director approve eksplisit."
- [x] Tambahkan poin kedua: "preferensi bahasa hanya mengatur arah tulis/respons AI, bukan kemampuan baca — jangan auto-switch bahasa respons hanya karena Director menulis pesan dalam bahasa lain; hanya instruksi eksplisit yang memicu tawaran persist di poin sebelumnya."
- [x] **Tambahan pasca-implementasi (diminta Director setelah Tahap 1-6 selesai)**: poin ketiga — "jika tidak jelas field bahasa mana yang dimaksud Director, tanya eksplisit apakah berlaku untuk ketiganya (AI Communication Language, Sigma Docs Language, Output Doc Written Language) atau hanya field tertentu, sebelum menawarkan persist." Tidak ada di draft awal — lihat Implementation Walkthrough.

**Tahap 6 — Dokumentasi**
- [x] Update `README.md`/`Sigma/SIGMA_PROTOCOL.md` yang menjelaskan `sigma config` dan field bahasa — sesuaikan dengan schema 3-field baru dan tipe string bebas.
- [x] Koreksi `Sigma/SIGMA_PROTOCOL.md` §16D: perbaiki nama file (`Sigma/project.config.json`, bukan `sigma.config.json`) dan hapus/koreksi klaim "artifact content is always written in English regardless of language setting" agar selaras dengan perilaku `document_language` yang sebenarnya (dan dengan `Discussion/SIGMA_PERSONAL_LANGUAGE_PREFERENCE_NOTE.md`).

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

- [x] `formal_identifier_language` tidak lagi ada di schema `project.config.json`.
- [x] Field `output_document_language` tersedia, punya CLI setter, dan defaultnya `"English"`.
- [x] Semua field bahasa menerima nama bahasa dalam bentuk string bebas, bukan lagi dibatasi daftar kode.
- [x] `DEFAULTS` dan `createDefaultProjectConfig()` memakai `"English"` (string literal), bukan `'en'`.
- [x] `sigma session bootstrap` selalu menampilkan blok preferensi bahasa, termasuk saat semua field masih default `English`.
- [x] `document_language` punya CLI setter post-creation (tidak lagi hanya bisa diset sekali saat `project start`).
- [x] Wizard interaktif 3-pertanyaan (yes/no per field) tersedia dari bare `sigma config` dan dari `sigma project start` mode interaktif, memakai satu fungsi shared, dan menampilkan label eksplisit saat default dipakai.
- [x] Keempat file `Sigma/role-memory/{role}-memory.json` memuat poin "tawarkan dulu sebelum persist preferensi bahasa" **dan** poin "bahasa hanya mengatur arah tulis/respons, bukan auto-switch mengikuti bahasa pesan Director". (Plus poin ketiga tambahan pasca-implementasi, lihat Tahap 5.)
- [x] `Sigma/SIGMA_PROTOCOL.md` §16D dikoreksi: nama file benar (`project.config.json`) dan tidak lagi menyatakan artifact content selalu Inggris tanpa syarat.
- [x] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini — **131/131 test lulus, 0 modifikasi test** (tidak ada test lama yang menyentuh area bahasa/config ini).

---

## Implementation Walkthrough

**Tanggal eksekusi**: 2026-07-14
**Mode**: Professional Mode (bukan DEV role Sigma governance — plan ini bukan FMN-PLAN, tidak lock/gate)

### Keputusan Director selama sesi implementasi

Beberapa keputusan lahir dari diskusi lanjutan sebelum kode ditulis (sudah dicatat di "Riwayat Diskusi Tambahan" di atas), plus satu tambahan setelah implementasi selesai:

1. **Wording value field** direvisi dari "string bebas/deskriptif" jadi "nama bahasa dalam bentuk string bebas", hasil review AUD (advisory) yang mengubah verdict dari PASS_WITH_RISK ke PASS.
2. **Desain wizard**: Director secara eksplisit meminta bentuk 3 pertanyaan yes/no berurutan (bukan 3 flag CLI terpisah untuk kasus interaktif), dipakai bersama oleh `project start` dan bare `sigma config`.
3. **Semantik "bahasa" dibatasi arah tulis/respons, bukan baca** — AI tidak boleh auto-switch bahasa jawaban hanya karena Director kebetulan menulis dalam bahasa lain.
4. **Default bawaan**: string literal `"English"`, dan wizard wajib melabeli eksplisit saat default dipakai.
5. **Tambahan pasca-implementasi**: setelah Tahap 1-6 selesai dan diverifikasi, Director meminta satu poin lagi ditambahkan ke role-memory — klarifikasi scope (semua field vs field tertentu) sebelum menawarkan persist. Ditambahkan ke `general[]` keempat file role-memory, di antara poin "tawarkan dulu" dan poin "arah tulis saja".

### Penyesuaian teknis di luar draft awal (ditemukan saat coding)

| Area | Detail |
|:--- |:--- |
| `langLabel()` / `LANG_NAMES` | Draft awal memberi opsi "hapus atau sederhanakan jadi pass-through". Dipilih **hapus total** — begitu value sudah nama bahasa apa adanya, fungsi identity (`return name`) tidak menambah nilai apa pun di seluruh call site; lebih bersih langsung memakai field string-nya. |
| `src/engine/languageWizard.ts` (baru) | Tidak disebut sebagai nama file di draft awal (draft hanya bilang "satu fungsi shared") — dibuat sebagai modul baru terpisah dari `projectConfig.ts`, isinya murni logic prompt. |
| Desain internal wizard: satu `inquirer.prompt([...])` vs beberapa panggilan berantai | Implementasi awal memakai loop dengan 2 pemanggilan `inquirer.prompt()` terpisah per field (confirm lalu input). Saat diuji manual dengan stdin yang di-pipe (lihat di bawah), ditemukan crash `ERR_USE_AFTER_CLOSE` di pemanggilan kedua. Direfaktor jadi **satu pemanggilan `inquirer.prompt([...])` dengan array pertanyaan memakai `when:` conditional** — pola yang sama dengan prompt `projectId`/`projectName` yang sudah ada di `project.ts`. Lebih robust dan konsisten gaya kodebase. |
| `project start --lang` | Sebelumnya `.trim().toLowerCase()` (asumsi kode ISO 2-huruf). Dihapus karena sekarang value bebas (`"Bahasa Jawa"` tidak boleh dipaksa lowercase). Help text flag diperbarui. |
| §16D `SIGMA_PROTOCOL.md` | Draft awal cuma bilang "koreksi nama file + klaim always-English". Realisasinya section ini ditulis ulang lebih lengkap: menjelaskan 3 field secara eksplisit, menjelaskan formal identifier tetap Inggris (karena field `formal_identifier_language` sudah dihapus, kebijakannya perlu tetap dinyatakan sebagai teks, bukan field), dan menambahkan aturan arah-tulis-bukan-baca dari Keputusan Final #6. |

### File yang diubah

| File | Perubahan |
|:--- |:--- |
| `src/engine/projectConfig.ts` | Schema (`formal_identifier_language` dihapus, `output_document_language` ditambah), `DEFAULTS` → `"English"`, `LANG_NAMES`/`langLabel` dihapus |
| `src/engine/languageWizard.ts` (baru) | `promptLanguageWizard()` — wizard 3-pertanyaan shared |
| `src/commands/config.ts` | Bare `sigma config` → wizard; `config set language <name> --interaction\|--sigma-document\|--output-document`; `config show` diperbarui |
| `src/commands/project.ts` | Wizard dipanggil di alur interaktif `project start`; `--lang` jadi shorthand free-form untuk mode non-interaktif |
| `src/commands/session.ts` | Blok `--- Director Preferences ---` selalu tampil, 5 baris `[LANG]` termasuk aturan arah-tulis |
| `Sigma/role-memory/{arc,fmn,dev,aud}-memory.json` | 3 poin baru di `general[]` (tawarkan-dulu, klarifikasi-scope, arah-tulis-saja) |
| `Sigma/SIGMA_PROTOCOL.md` §16D | Ditulis ulang lengkap |
| `README.md` | Baris tabel command `config` diperbarui (wizard + setter baru) |

### Verifikasi

- `npm run build` — bersih, 0 error TypeScript (dijalankan 2×, setelah refactor wizard di atas).
- `npm test` — **21 file test, 131 test, semua passed**. Tidak ada test yang perlu diubah (tidak ada test lama yang menyentuh area config bahasa).
- Sandbox manual di luar repo (`.../scratchpad/sigma-lang-demo/`): `project start --confirm` (default English) → `config set language Indonesia --interaction` → `config set language "Bahasa Jawa" --sigma-document` → `config show` → `session bootstrap`. Semua berjalan sesuai desain; output `session bootstrap` lengkap disimpan di `bootstrap-output.txt` di folder sandbox tersebut dan sudah ditunjukkan ke Director.
- **Keterbatasan yang diketahui**: wizard interaktif (`sigma config` tanpa subcommand) tidak berhasil diverifikasi end-to-end lewat piped stdin di shell Windows/Git-Bash yang dipakai sesi ini (`ERR_USE_AFTER_CLOSE` dari inquirer, environment-specific, bukan corrupt state — tidak ada tulisan config yang rusak karena crash terjadi sebelum `writeProjectConfig` dipanggil). Kode memakai pola inquirer standar yang identik dengan yang sudah terbukti jalan di `project.ts`, tapi Director disarankan mengonfirmasi sendiri UX wizard di terminal interaktif asli.

### Di luar scope (sengaja tidak disentuh)

- `Discussion/SIGMA_PERSONAL_LANGUAGE_PREFERENCE_NOTE.md` masih memakai contoh schema lama (termasuk `formal_identifier_language`) — tidak ada di Task Breakdown manapun, dibiarkan sebagai catatan historis. Belum diputuskan apakah perlu diupdate/diarsipkan.

### Hasil akhir

- Belum di-commit ke git — menunggu keputusan Director kapan melakukan commit.
- Tidak ada perubahan pada `Sigma/progress.json` (plan ini bukan governance artifact Sigma, tidak menyentuh lock/gate state).
