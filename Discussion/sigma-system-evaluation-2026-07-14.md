# Evaluasi Keseluruhan Sistem Sigma — Sesi Diskusi (14 Juli 2026)

> Mode: Professional Mode (non-governance)
> Tujuan dokumen: mencatat poin-poin yang **disepakati** antara Director dan Claude selama sesi
> diskusi evaluasi menyeluruh sistem Sigma, sebagai bahan input sebelum dirumuskan ke fase
> Plan Implementation (FMN-PLAN atau setara).
> Status sesi: **SELESAI** — Director melanjutkan ke sesi baru untuk fase Plan Implementation.

---

## Cara Pakai Dokumen Ini

- Dokumen ini adalah **living log**, diupdate bertahap selama diskusi berjalan.
- Hanya poin yang sudah **disepakati eksplisit** oleh Director yang dicatat di bagian
  "Kesepakatan". Poin yang masih didiskusikan/belum final masuk ke "Isu Terbuka".
- Di akhir sesi, isi dokumen ini akan dirumuskan ulang menjadi draft Plan Implementation.

---

## Ruang Lingkup Evaluasi

Topik ditentukan Director secara bertahap selama sesi berjalan (bukan daftar tetap di awal).

---

## Kesepakatan

### Topik 1 — Restrukturisasi ROADMAP (mengurangi beban editing manual)

**Masalah awal yang dilaporkan Director:**
- Saat FMN-PLAN berubah di tengah jalan, ada kecenderungan/rasa wajib untuk ikut mengupdate ROADMAP — coupling yang tidak diinginkan.
- Template ROADMAP saat ini (`Sigma/templates/ROADMAP-TEMPLATE.md`) terlalu padat: 6 section, beberapa di antaranya butuh maintenance manual berulang.
- Prinsip yang diinginkan: ROADMAP diarahkan ke **minim editing manual**, sisanya diserahkan ke otomatisasi `sigma` CLI.

**Temuan teknis (diverifikasi dari kode, bukan asumsi):**
- `sigma roadmap render` menghasilkan tabel Stage Overview (`generateStageOverview()`, [roadmap.ts:41](../src/utils/roadmap.ts#L41)) dengan cara **parsing** heading `## Stage X.Y` + comment `<!-- SIGMA:STAGE:FOCUS:... -->` dari blok teks Stage Details (`parseStages()`, [roadmap.ts:10](../src/utils/roadmap.ts#L10)).
- Blok teks stage saat ini dibuat dari `STAGE_STUB_TEMPLATE()` ([roadmap.ts:236](../src/utils/roadmap.ts#L236)) berisi field manual: Focus, Main Output, Main Tasks, Explicit Non-Scope, Dependency/Gate, Risk/Watch-Out.
- Rule tertulis di `FMN-RULE.md` sebenarnya sudah longgar ("FMN should explain deviation", bukan wajib sinkron) — akar rasa "wajib update" kemungkinan lebih dari beban mekanisme template/stub, bukan dari teks aturan itu sendiri (dicatat sebagai observasi, belum perlu keputusan lanjutan).

**Keputusan final struktur ROADMAP baru (6 section → 3 section):**

| Section lama | Keputusan |
|---|---|
| 1. Roadmap Purpose | **Diganti** → "Overview": manual, ditulis FMN, maks ±5 kalimat. Isi: arah besar implementasi, output akhir, cara singkat mencapainya. Permukaan saja, tanpa detail. |
| 2. Source Intent Alignment | **Dihapus** — sudah terwakili di Section 1 tiap FMN-PLAN; menghindari redundansi & risiko unsync. |
| 3. Stage Overview (tabel) | **Dipertahankan** — jadi satu-satunya representasi ringkasan stage, sepenuhnya otomatis via `sigma roadmap render`. |
| 4. Core Process Flow | **Dipertahankan**, disederhanakan jadi **hanya diagram Mermaid**, tanpa narasi teks. Manual, murah diedit ulang kapan pun ada perubahan signifikan (keputusan Director / plan drift). Terpisah dari tabel — perannya gambaran alur besar, bukan data administratif per-stage. |
| 5. Stage Details (blok teks H2/H3 per stage) | **Dihapus total** (revisi dari draf awal yang sempat menyisakan versi auto-only). Tidak ada lagi field manual (Focus, Main Output, Main Tasks, Explicit Non-Scope, Dependency/Gate, Risk/Watch-Out). Data judul+focus cukup hidup di tabel Stage Overview, disuplai lewat flag `--title`/`--focus` saat `sigma plan new`. |
| 6. FMN Roadmap Notes | **Dihapus** — rawan outdate, tidak esensial. |

**Hasil akhir:** ROADMAP hanya punya 3 section: Overview (teks singkat manual) + Core Process Flow (diagram Mermaid manual) + Stage Overview (tabel, full-otomatis). Tidak ada lagi blok teks per-stage yang perlu di-maintain manual.

**Rasional final (setelah pertimbangan tradeoff):** Risiko ketidaksinkronan (FMN fokus ke PLAN dan lupa update ROADMAP) dinilai Director lebih berbahaya daripada hilangnya narrative detail per-stage (Main Output/Risk/Watch-Out). Peran ROADMAP ditegaskan sebagai peta besar arah implementasi dan referensi cepat focus/topik per PLAN — bukan tempat membaca detail. Detail risiko/output tetap tersedia di masing-masing FMN-PLAN, bukan hilang dari sistem, hanya tidak lagi dirangkum ulang di ROADMAP.

**Ide yang dipertimbangkan dan ditolak:** Auto-generate section penting dari FMN-PLAN ke ROADMAP (mis. Acceptance Criteria/ringkasan risiko), diusulkan Director sebagai alternatif untuk mengembalikan sebagian detail tanpa beban manual. Ditolak — akan mengembalikan ROADMAP jadi padat (hanya bedanya diisi otomatis, bukan manual) dan menciptakan coupling struktural baru: perubahan template FMN-PLAN ke depan jadi terikat menjaga kontrak ekstraksi ke ROADMAP. Keputusan: tetap pada tabel Title + Focus + Status saja; field terstruktur baru boleh ditambah nanti jika benar-benar perlu, tapi tidak dengan menarik section PLAN apa adanya.

**Status topik: SELESAI.**

**Implikasi teknis untuk fase implementasi (belum dieksekusi, dicatat sebagai follow-up):**
- `STAGE_STUB_TEMPLATE()` dan mekanisme append blok teks stage ( `appendRoadmapSectionStub`, `updateStageMetadata`) perlu diganti — tidak lagi menulis blok H2/H3 penuh, cukup memastikan data title/focus tersedia untuk row tabel.
- `parseStages()` perlu sumber data baru jika heading H2 teks dihapus (kemungkinan: baca langsung dari `progress.json` per-plan version, bukan dari parsing file ROADMAP).
- Template `ROADMAP-TEMPLATE.md` dan `FMN-RULE.md` (bagian "Mandatory: ROADMAP as Staging Requirement", H2 Stage Section Rules) perlu direvisi mengikuti struktur baru ini.

---

### Topik 2 — Pelonggaran Guardrail "AUD Findings" (DIR-INTENT & FMN-PLAN)

**Masalah awal yang dilaporkan Director:**
- Section "AUD Findings" di DIR-INTENT dan FMN-PLAN cenderung kosong, atau terisi tapi audit-nya cepat basi (ronde audit berikutnya tidak dicatat ulang).
- Root cause: AUD yang dipakai Director biasanya bukan role agentic ber-CLI, melainkan AI pasif eksternal (Claude web, ChatGPT web) yang hasil auditnya di-copy-paste manual oleh Director.

**Temuan teknis (diverifikasi dari kode):**
- `FMN-PLAN-TEMPLATE.md` Section 7 ([FMN-PLAN-TEMPLATE.md:108-109](../Sigma/templates/FMN-PLAN-TEMPLATE.md#L108-L109)) melarang eksplisit: *"FMN and DEV must not write in this section."* — tanpa pengecualian untuk kasus relay dari Director.
- Mekanisme CLI yang ada, `sigma plan audit` ([plan.ts:151](../src/commands/plan.ts#L151)) dan `sigma intent review` ([intent.ts:75](../src/commands/intent.ts#L75)), sama-sama memanggil `appendAuditFindings()` ([artifacts.ts:22-26](../src/utils/artifacts.ts#L22-L26)) yang menghasilkan blok generik identik untuk kedua domain — **tanpa field Verdict/checkbox sama sekali**:
  ```
  **Audit Scope**: [AUD fills this]
  **Findings**: [AUD fills this]
  **Recommendation**: [AUD fills this]
  ```
- Checkbox verdict yang terstruktur (PASS/PASS_WITH_RISK/REVISE/REJECT_RECOMMENDED/PROMOTE_TO_HEAVIER_PROCESS/OTHER) hanya ada di template statis awal DIR-INTENT (Section 12.2, dibuat sekali saat `sigma intent new`). Ronde audit berikutnya via `sigma intent review`/`sigma plan audit` TIDAK ikut membawa checkbox itu — ini kemungkinan penyebab nyata "audit lama tercatat, ronde baru tidak" karena makin banyak ronde, makin banyak blok teks bebas tanpa penanda verdict yang jelas.
- Seluruh alur `sigma send --from aud --to FMN/ARC` di `AUD-RULE.md` mengasumsikan AUD adalah role agentic ber-CLI — tidak cocok dengan pola pakai Director (AUD pasif eksternal + Director sebagai relay).

**Keputusan:**
1. Guardrail "FMN and DEV must not write in this section" **dilonggarkan** menjadi: **ARC dan FMN boleh** mengisi/menulis section AUD Findings (di DIR-INTENT maupun FMN-PLAN), dengan sumber sah salah satu dari: (a) pesan `sigma message`/mailbox langsung dari AUD, atau (b) Director menyampaikan hasil audit di sesi chat.
2. **DEV tetap tidak diberi akses** — cakupan pelonggaran hanya ARC dan FMN.
3. Konten narasi (Findings/Major Findings) **boleh berupa interpretasi, pemahaman, atau kesepakatan** ARC/FMN terhadap hasil audit — tidak wajib verbatim copy-paste.
4. **Verdict tidak boleh diubah** oleh ARC/FMN — harus persis seperti yang disampaikan AUD. Ini murni guardrail tertulis di template, bukan validasi/enforcement teknis baru.
5. Format checkbox verdict **disamakan** antara DIR-INTENT dan FMN-PLAN — FMN-PLAN mengikuti struktur checkbox yang sudah ada di DIR-INTENT Section 12.2 (bukan menambah field bebas baru).
6. Perbaikan checkbox verdict berlaku di **dua tempat**: template statis awal, dan fungsi `appendAuditFindings()` — supaya setiap ronde audit baru (via `sigma plan audit` / `sigma intent review`) konsisten menyertakan checkbox verdict yang sama, bukan hanya ronde pertama.

**Implikasi teknis untuk fase implementasi (belum dieksekusi, dicatat sebagai follow-up):**
- Update `FMN-PLAN-TEMPLATE.md` Section 7: tambahkan struktur checkbox verdict identik dengan DIR-INTENT Section 12.2; revisi kalimat guardrail dari larangan total menjadi carve-out ARC/FMN sesuai keputusan di atas.
- Update `DIR-INTENT-TEMPLATE.md` Section 12: tambahkan kalimat guardrail eksplisit (checkbox verdict tidak boleh diubah ARC, narasi boleh interpretasi).
- Update `appendAuditFindings()` di `artifacts.ts` agar domain-aware / menyertakan blok checkbox verdict yang sama pada setiap append, bukan blok generik tanpa verdict.
- Update `FMN-RULE.md` dan `ARC-RULE.md`: revisi bagian yang menyebut larangan menulis AUD Findings, tambahkan aturan sumber sah (mailbox AUD langsung / relay Director di chat) dan batas "boleh interpretasi, tidak boleh ubah verdict".

**Status topik: SELESAI.**

---

### Topik 3 — Penghapusan Command Family `appendAuditFindings` (intent review / plan audit / exec audit / close audit)

**Latar belakang:** Muncul dari Topik 2 — Director hampir tidak pernah pakai `sigma plan audit`/`sigma intent review`, baru sadar command ini ada. Setelah dicek, keduanya bagian dari keluarga 4 command identik mekanismenya:

| Command | File | Artefak target |
| :--- | :--- | :--- |
| `sigma intent review` | [intent.ts:75](../src/commands/intent.ts#L75) | DIR-INTENT |
| `sigma plan audit` | [plan.ts:151](../src/commands/plan.ts#L151) | FMN-PLAN |
| `sigma exec audit` | [exec.ts:124](../src/commands/exec.ts#L124) | DEV-EXEC |
| `sigma close audit` | [close.ts:120](../src/commands/close.ts#L120) | DIR-CLOSE |

Semua memanggil `appendAuditFindings()` yang sama ([artifacts.ts:22-26](../src/utils/artifacts.ts#L22-L26)) — murni append teks, tidak menyentuh lock/gate state (`assertProgressCanMutate` hanya cek mutability).

**Penilaian risiko:** Risiko teknis rendah — tidak berdampak ke gate chain/lock integrity. Nilai yang hilang hanya kenyamanan (auto header + timestamp), yang sudah tergantikan oleh keputusan Topik 2 (ARC/FMN boleh menulis section AUD Findings langsung).

**Keputusan:** Hapus **keempat command** (`intent review`, `plan audit`, `exec audit`, `close audit`) sekaligus — bukan hanya 2 yang dibahas awal — untuk menjaga konsistensi keluarga command, karena mekanismenya identik dan sama-sama redundan setelah Topik 2.

**Implikasi teknis untuk fase implementasi (belum dieksekusi, dicatat sebagai follow-up):**
- Hapus subcommand di 4 file: `src/commands/intent.ts` (`review`), `src/commands/plan.ts` (`audit`), `src/commands/exec.ts` (`audit`), `src/commands/close.ts` (`audit`).
- Hapus fungsi `appendAuditFindings()` di `src/utils/artifacts.ts` (jadi dead code setelah ke-4 caller dihapus).
- Update test: `test/command-helper-regression.test.ts:32` menguji `intent review` secara eksplisit — perlu dihapus/disesuaikan.
- Update dokumentasi:
  - `README.md` — hapus baris tabel command di line 574 (`plan audit`), 579 (`exec audit`), 583 (`close audit`). (Catatan: `intent review` tidak terdaftar di tabel README, hanya di SIGMA_PROTOCOL.)
  - `Sigma/SIGMA_PROTOCOL.md` — hapus tabel "Invocation commands" (baris ~452-455) dan baris kelas "Advisory" di tabel "Command Authority Classes" (baris ~514); perlu ditinjau apakah kelas "Advisory" masih relevan dipertahankan sebagai kategori jika ke-4 isinya kosong.
  - `Sigma/rules/ARC-RULE.md`, `AUD-RULE.md`, `FMN-RULE.md` — ada referensi ke command ini (ditemukan lewat grep, belum ditinjau detail) — perlu review manual saat implementasi untuk memastikan tidak ada instruksi role yang masih mengarahkan pemakaian command yang sudah dihapus.
  - `Sigma/role-memory/aud-memory.json` — juga mengandung referensi, perlu ditinjau saat implementasi.
- Perubahan ini beririsan langsung dengan Topik 2: setelah command dihapus, satu-satunya jalur mengisi AUD Findings adalah menulis manual ke file oleh ARC/FMN sesuai guardrail baru yang disepakati di Topik 2.

**Status topik: SELESAI.**

---

### Topik 4 — Pemetaan & Evaluasi Seluruh Command Sigma CLI

**Konteks:** Dilakukan pemetaan lengkap seluruh command CLI (19 domain, 61 command/subcommand — daftar lengkap sudah disampaikan ke Director dalam sesi, tidak diduplikasi di sini). Director mengategorikan command yang jadi perhatian ke dalam 2 kategori kerja, sisanya default **keep**:

- **Reconsider to remove** — perlu investigasi teknis dulu (cek cara kerja, bug, potensi error) sebelum ada keputusan keep/remove.
- **Evaluate to be removed** — berdasar praktik nyata (jarang dipakai / kompleksitas tidak sepadan manfaat), tidak perlu investigasi sistem, langsung pertimbangan risiko hapus.

#### Kategori: Evaluate to be removed

| Command | Alasan Director | Catatan tambahan / risiko |
| :--- | :--- | :--- |
| `gitignore generate` | Trivial, hampir tidak dipakai — cukup tambah folder Sigma ke `.gitignore` manual | Aman dihapus — murni print ke stdout, tidak menyentuh state/gate apapun |
| `cso` (`cso new`) | Perannya sudah digantikan `sigma message`/inbox untuk konteks handover; konsep bagus tapi tidak dibutuhkan | **FINAL: hapus, cakupan penuh.** Director mengonfirmasi hapus termasuk seluruh sistem yang bergantung pada CSO — bukan cuma command CLI. Cakupan: (1) command `cso new` di `src/commands/cso.ts`; (2) referensi konsep CSO di 4 rule file role (ARC/AUD/DEV/FMN-RULE.md, mis. [FMN-RULE.md:361](../Sigma/rules/FMN-RULE.md#L361)); (3) referensi di `README.md` dan `SIGMA_PROTOCOL.md`; (4) skill Claude Code `/cso` dan `/checkpoint` (keduanya memanggil `sigma cso new` langsung) — perlu dipensiunkan atau dialihkan ke `sigma send`.

#### Kategori: Reconsider to remove

| Command | Alasan awal Director | Temuan investigasi |
| :--- | :--- | :--- |
| `override` | Sangat jarang dipakai, command lama; awalnya dikira sudah diwakilkan `supersede` | **Klaim redundansi dengan `supersede` tidak akurat** — beda kasus: `override` memaksa gate terbuka tanpa artefak terkait benar-benar LOCKED ([override.ts:29-63](../src/commands/override.ts#L29-L63)); `supersede` mengasumsikan artefak sudah LOCKED lalu diganti versi baru. **Bug nyata ditemukan**: `sigma doctor` (`runDoctorReconciliation`, [progress.ts:398-415](../src/engine/progress.ts#L398-L415)) menghitung ulang gate flags murni dari `hasActiveLockedIntent`/`hasCleanGate2Chain`/`hasCleanGate3Chain` ([progress.ts:244-278](../src/engine/progress.ts#L244-L278)) — fungsi-fungsi ini tidak tahu apa-apa soal `overrides.jsonl`. Akibatnya: begitu `sigma doctor` dijalankan setelah `override`, gate yang dipaksa terbuka **otomatis dibalikkan** ke tertutup oleh doctor, membuat override tidak reliable/mudah hilang efeknya, dan `overrides.jsonl` jadi log yatim (mengklaim bypass terjadi, padahal runtime sudah membatalkannya diam-diam). |
| `sigma doctor` | Ditambahkan sebagai konsekuensi temuan `override` — keduanya perlu disinkronkan, bukan dievaluasi terpisah | Root cause sama seperti di atas: `runDoctorReconciliation` tidak punya mekanisme "override-aware" sama sekali. |
| `sigma project reset` | Kekhawatiran: destruktif terhadap status project | **FINAL — lihat detail keputusan di bawah tabel ini.** |
| Seluruh `sigma roadmap *` (7 subcommand: new, check, migrate-core-flow, activate, render, reconcile, list) | Director khawatir ada redundansi antar subcommand | *(belum diinvestigasi — akan dibahas satu per satu)* |
| Seluruh `sigma sync *` (sync progress, sync roadmap) | Ditambahkan Director ke Reconsider | *(belum diinvestigasi — akan dibahas satu per satu)* |
| `sigma config *` (set language, show) | Ditambahkan Director ke Reconsider | *(belum diinvestigasi — akan dibahas satu per satu)* |
| `sigma setup *` (install, update, memory) | Ditambahkan Director ke Reconsider | *(belum diinvestigasi — akan dibahas satu per satu)* |

**Keputusan — `override` + `sigma doctor`:**
- `override` dan `sigma doctor` **digabung dalam satu item Reconsider** — tidak boleh diputuskan terpisah karena saling memengaruhi.
- Arah perbaikan (perbaiki agar doctor override-aware, atau hapus override sepenuhnya karena sudah tidak reliable dalam bentuk sekarang) **belum diputuskan** — didokumentasikan sebagai agenda wajib di fase rencana perbaikan (Plan Implementation) berikutnya, bukan diselesaikan di sesi evaluasi ini.

**Investigasi — `sigma project reset`:**
- Kode diperiksa ([project.ts:427-468](../src/commands/project.ts#L427-L468)): soft reset menimpa total `progress.json` ke state awal (hanya `project_id`/`project_name` dipertahankan); `--wipe` tambahan mengosongkan folder `design/`, `build/`, `close/` (diarsipkan dulu, tapi lokasi aktif dikosongkan).
- 3 masalah konkret ditemukan: (1) tidak ada command restore/rollback di seluruh CLI — pemulihan dari backup otomatis butuh edit manual `progress.json`, bertentangan dengan larangan CLAUDE.md; (2) tidak ada `--dry-run` (beda dengan `override` yang punya preview); (3) flag `--confirm` generik, tidak menandakan otoritas Director secara eksplisit seperti `--director-confirm` di `override`, padahal dampaknya lebih destruktif.
- Ditelusuri juga apakah `sigma doctor` sudah menutupi tujuan asli `reset` (recovery dari bug ketidaksesuaian artefak vs `progress.json`): **tidak** — `runDoctorReconciliation()` ([progress.ts:358-490](../src/engine/progress.ts#L358-L490)) hanya membandingkan field di dalam `progress.json` dengan dirinya sendiri, tidak pernah membaca file artefak markdown di disk. Jadi tidak menggantikan skenario "isi file artefak tidak sinkron dengan klaim JSON".

**Keputusan — `sigma project reset`:**
1. **Command `sigma project reset` dihapus total** — baik mode soft maupun `--wipe`.
2. **Kasus corruption recovery digantikan 2 mode baru di `sigma doctor`** (konsolidasi ke command yang sudah ada, bukan command baru terpisah):
   - `sigma doctor --recovery` — perilaku doctor yang sudah ada saat ini (`runDoctorReconciliation`, perbaikan konsistensi internal JSON). Tidak perlu logika baru, hanya penamaan/flag eksplisit.
   - `sigma doctor --reconstruct` (nama final `--reconstruct` vs `--rebuild` masih bisa dipilih saat implementasi) — **kapabilitas baru**: `progress.json` lama dipindah ke lokasi backup/temp (bukan ditimpa diam-diam), lalu dibangun ulang dari nol dengan membaca seluruh file artefak Sigma (`design/`, `build/`, `close/`) untuk menentukan versi/status lock/gate berdasarkan kondisi file sebenarnya. Ini pekerjaan implementasi baru — belum ada logika parsing artefak semacam ini di manapun di codebase saat ini.
3. **Use-case "lepas dari Sigma / lepas-pasang kembali" tidak dipertahankan sebagai command** — Director menilai alasannya tidak cukup kuat; cukup hapus folder `Sigma/` manual kalau ingin keluar dari governance, tidak perlu jalur CLI.

**Implikasi teknis untuk fase implementasi (belum dieksekusi, dicatat sebagai follow-up):**
- Hapus `runReset()` dan registrasi `cmd.command('reset')` di `src/commands/project.ts` (~baris 427-468, 524-530).
- Tambahkan flag `--recovery` dan `--reconstruct`/`--rebuild` ke `src/commands/doctor.ts`.
- Bangun logika baru: parser artefak markdown (DIR-INTENT/ROADMAP/FMN-PLAN/DEV-EXEC/DIR-CLOSE) untuk ekstrak versi + status lock dari isi file, dipakai khusus oleh mode `--reconstruct`.
- Desain lokasi backup/temp untuk `progress.json` lama saat `--reconstruct` dijalankan (bukan `Sigma/logs/` seperti `reset` lama — perlu ditentukan saat implementasi).
- Update README.md dan SIGMA_PROTOCOL.md yang menyebut `sigma project reset`.

**Catatan untuk topik lanjutan (belum dibahas, bukan bagian keputusan ini):** Director berencana membahas `sigma project register` (registrasi project ke `~/.sigma/projects.json`) di kesempatan lain — dicurigai juga tidak diperlukan, tapi belum dievaluasi.

**Investigasi — keluarga `sigma roadmap` (7 subcommand):** Director khawatir ada redundansi di operasi yang berkaitan dengan rendering. Ditemukan 3 command tumpang tindih, semuanya memanggil `parseStages()` yang sama:
- `render` ([roadmap.ts:201-220](../src/commands/roadmap.ts#L201-L220)) — regenerate tabel Stage Overview, tulis ke file.
- `reconcile` ([roadmap.ts:224-321](../src/commands/roadmap.ts#L224-L321)) — bandingkan `parseStages()` vs `progress.json` dua arah, laporkan mismatch; `--fix` memanggil fungsi render yang sama persis ([roadmap.ts:300](../src/commands/roadmap.ts#L300)) — jadi `reconcile --fix` sudah menelan `render` di dalamnya.
- `list` ([roadmap.ts:325-390](../src/commands/roadmap.ts#L325-L390)) — `parseStages()` lagi, cross-reference `progress.json` lagi, hasilnya nyaris identik dengan tabel Stage Overview, bedanya dicetak ke layar bukan ditulis ke file.

Root cause redundansi `reconcile`: ada karena dulu 2 sumber data terpisah (teks H2 stage di file ROADMAP vs entry plan di `progress.json`) bisa tidak sinkron. Setelah keputusan **Topik 1** (Stage Details/blok teks H2 dihapus total, tabel Stage Overview langsung bersumber dari `progress.json`), tidak ada lagi dua sisi yang perlu direkonsiliasi — akar masalah `reconcile` hilang dengan sendirinya.

**Keputusan:**
- `reconcile` **dihapus**, fungsinya (regenerate tabel langsung dari `progress.json`, tanpa perlu cek mismatch/flag `--fix` karena secara struktural tidak mungkin lagi tidak sinkron) **digabung ke `render`**.
- `render` jadi satu-satunya operasi penulisan/regenerasi tabel Stage Overview.
- `list` **dipertahankan terpisah** — tetap ada sebagai command read-only tersendiri untuk menampilkan cepat ke layar tanpa menulis file.
- `check` (validasi struktur/marker) **tidak termasuk** konsolidasi ini — tujuannya berbeda, tidak tumpang tindih dengan concern rendering. `new`/`activate` murni lifecycle, juga tidak relevan di sini.
- Hasil akhir sementara: keluarga `roadmap` dari 7 subcommand → 6 subcommand (new, check, migrate-core-flow, activate, render, list) — lihat penyesuaian lanjutan di bawah untuk `migrate-core-flow`.

**Investigasi lanjutan — `migrate-core-flow`:** Command ini migrasi ROADMAP lama yang masih pakai section legacy "Phase Dependencies" ke "Core Process Flow". Dicek: tidak ada file ROADMAP aktif di repo ini dengan konten legacy tsb (hanya jejak di `SIGMA-OPERATION-REGISTRY.json`, bukan konten nyata). Lebih penting: hasil migrasinya adalah Core Process Flow versi **lama** (prosa/Mermaid opsional) — bukan versi baru hasil **Topik 1** (Mermaid-only) — jadi command ini menargetkan format yang sudah usang dua kali lipat.

Dikonfirmasi juga secara teknis bahwa migrasi manual (amankan ROADMAP lama, taruh template baru di path yang sama/terdaftar di `progress.json`, isi ulang kontennya) **sepenuhnya kompatibel** dengan `render` tanpa tool migrasi apapun — `render` hanya peduli 2 hal: (1) path file sesuai `data.roadmap.versions[].file` di `progress.json` ([roadmap.ts:40-43](../src/commands/roadmap.ts#L40-L43)), dan (2) marker delimiter `<!-- SIGMA:RENDER:START/END:stage-overview -->` ada di file ([roadmap.ts:62-73](../src/utils/roadmap.ts#L62-L73)) — otomatis terpenuhi selama file baru dibuat dari template resmi. Tidak peduli riwayat/asal-usul file.

**Keputusan tambahan:** `migrate-core-flow` **dihapus** — pendekatan manual konvensional (backup file lama, drop template baru, isi ulang) sudah cukup dan lebih sederhana, tidak perlu tool migrasi otomatis.

**Hasil akhir final:** keluarga `roadmap` dari 7 subcommand → **5 subcommand** (`new`, `check`, `activate`, `render`, `list`).

**Implikasi teknis untuk fase implementasi (belum dieksekusi, dicatat sebagai follow-up):**
- Hapus `cmd.command('reconcile')` di `src/commands/roadmap.ts` ([roadmap.ts:224-321](../src/commands/roadmap.ts#L224-L321)).
- Hapus `cmd.command('migrate-core-flow')` ([roadmap.ts:126-144](../src/commands/roadmap.ts#L126-L144)) dan fungsi pendukungnya di `src/utils/roadmap.ts` (`migrateRoadmapCoreProcessFlowFile`, `migrateRoadmapCoreProcessFlowContent`, `extractLegacyPhaseDependenciesBody`, `normalizeLegacyPhaseDependenciesBody`, `buildCoreProcessFlowSection`, `ensureMarkerBeforeHeading`, `normalizedLegacyMessage` — jadi dead code setelah command dihapus).
- `renderRoadmapFile()`/`generateStageOverview()` di `src/utils/roadmap.ts` perlu diubah sumber datanya dari parsing teks H2 (`parseStages(content)`) menjadi baca langsung dari `progress.json` plan entries — konsisten dengan implikasi teknis Topik 1.
- `list` ([roadmap.ts:325-390](../src/commands/roadmap.ts#L325-L390)) juga perlu diupdate sumber datanya mengikuti perubahan yang sama (tidak lagi `parseStages()` dari file, langsung dari `progress.json`), supaya konsisten dengan `render`.
- Update README.md/SIGMA_PROTOCOL.md yang menyebut `sigma roadmap reconcile` dan `sigma roadmap migrate-core-flow`.

**Investigasi — keluarga `sigma sync` (2 subcommand):** Director khawatir `sync progress` redundan/konflik dengan `sigma doctor`, dan `sync roadmap` redundan/konflik dengan `sigma roadmap render`.

- **`sync progress`** ([sync.ts:148-204](../src/commands/sync.ts#L148-L204)) — **bukan redundan** dengan `doctor`, beda kelas masalah: melakukan migrasi schema (remap enum lama `BUILDING/TESTING/COMPLETED` → `DRAFT`, hapus field `cso` legacy dari root `progress.json`, tambah `plan.pending` kalau hilang), sedangkan `doctor` hanya memperbaiki konsistensi silang pada schema yang **sudah** current. Dikonfirmasi field `cso` sudah tidak ada sama sekali di schema `ProgressJson` saat ini — jadi ini murni alat migrasi struktur lama→baru untuk project lama.
- **`sync roadmap`** ([sync.ts:208-279](../src/commands/sync.ts#L208-L279)) — **bukan redundan**, tapi bergantung pada `render` (memanggilnya di baris terakhir setelah generate file baru, mirip pola `reconcile --fix` sebelumnya). Fungsinya: bootstrap ROADMAP freeform lama (belum pakai H2 stage convention CLI) jadi format CLI-managed, dengan scrape judul stage dari file FMN-PLAN. Masalah tambahan yang ditemukan: `generateRoadmapFromPlans()` ([sync.ts:37-144](../src/commands/sync.ts#L37-L144)) punya **template ROADMAP hardcode terpisah** di dalam `sync.ts` (bukan baca dari `ROADMAP-TEMPLATE.md`) — struktur 6-section versi lama, otomatis usang setelah keputusan Topik 1 (3 section).

**Keputusan:** Kedua command **dihapus**, beserta seluruh sistem pendukung yang bergantung padanya.

**Implikasi teknis untuk fase implementasi (belum dieksekusi, dicatat sebagai follow-up):**
- Hapus `src/commands/sync.ts` — kedua subcommand (`progress`, `roadmap`) adalah satu-satunya isi command ini, jadi seluruh command `sync` beserta file-nya bisa dihapus.
- Hapus registrasi `import { syncCommand } from './commands/sync'` dan `program.addCommand(syncCommand())` di `src/cli.ts:18` dan `src/cli.ts:45`.
- Fungsi pendukung yang jadi dead code: `runSyncProgress`, `runSyncRoadmap`, `generateRoadmapFromPlans`, `extractStageTitleFromPlan` — semua di `src/commands/sync.ts`, terhapus bersama file.
- Ada file test `test/roadmap-migration.test.ts` yang perlu ditinjau — kemungkinan menguji perilaku `sync roadmap`, perlu dihapus/disesuaikan saat implementasi.
- Update README.md/SIGMA_PROTOCOL.md yang menyebut `sigma sync progress`/`sigma sync roadmap`.
- Project lama (progress.json dengan enum state usang, atau ROADMAP freeform tanpa H2 convention) tidak lagi punya jalur migrasi otomatis — Director menerima risiko ini secara sadar (sejalan dengan pola keputusan `migrate-core-flow` sebelumnya).

**Investigasi & Keputusan — `sigma config` (bukan soal hapus, tapi memperjelas & memperbaiki desain bahasa):**

Latar belakang: Director terbiasa menyampaikan preferensi bahasa secara verbal ke AI role tiap sesi ("gunakan bahasa Indonesia dalam percakapan"), padahal mekanisme untuk mempersist-kan ini sudah ada (`sigma config set language`) tapi tidak pernah dipakai — sehingga tidak konsisten antar sesi.

**Temuan teknis:**
- `project.config.json` sebelumnya punya 3 field ([projectConfig.ts:5-10](../src/engine/projectConfig.ts#L5-L10)): `document_language`, `interaction_language`, `formal_identifier_language`. Hanya `interaction_language` yang punya CLI setter (`config set language`); `document_language` cuma bisa diset sekali saat `project start --lang`, tidak ada setter setelahnya.
- `sigma session bootstrap` ([session.ts:149-158](../src/commands/session.ts#L149-L158)) **sudah** menampilkan blok preferensi bahasa + instruksi eksplisit `[LANG] Write document prose in ...` ke AI role — tapi **disembunyikan kalau masih default English** ("only surface when non-English to avoid noise"). Ini akar kenapa mekanisme yang sudah ada terasa tidak pernah "muncul".
- `formal_identifier_language` ([projectConfig.ts:9,16,57](../src/engine/projectConfig.ts#L9); [config.ts:44](../src/commands/config.ts#L44)) dicek: **sepenuhnya vestigial** — tidak ada setter, tidak pernah dibaca/jadi keputusan di manapun di codebase, hardcode selalu `'en'`. Aman dihapus tanpa dampak fungsional.
- Director mengidentifikasi bahasa dokumen sebenarnya **2 kategori**, bukan 1: dokumen Sigma (DIR-INTENT/FMN-PLAN/dst., = `document_language` yang sudah ada) vs dokumen non-Sigma (output umum di luar artefak formal, mis. file log `Discussion/` ini sendiri) — kategori kedua ini **belum punya field sama sekali**.

**Keputusan final:**
1. `formal_identifier_language` **dihapus** dari schema — tidak ada dampak fungsional.
2. Schema `project.config.json` final: **3 field** — `interaction_language` (percakapan), `document_language` (dokumen Sigma, sudah ada), **1 field baru** (dokumen non-Sigma) — nama field final ditentukan di fase Plan Implementation, bukan sekarang.
3. **Tipe nilai semua field bahasa diubah dari kode language (en/id/fr/dst. + lookup `LANG_NAMES`) menjadi string bebas/deskriptif.** Director tidak mau dibatasi daftar kode bahasa — cukup tulis deskriptif (mis. `"Javanese language/Bahasa Jawa"`), AI langsung paham tanpa perlu tabel lookup kode↔nama. Implikasi: `LANG_NAMES` dict dan fungsi `langLabel()` di `projectConfig.ts` tidak diperlukan lagi (atau disederhanakan jadi pass-through string apa adanya).
4. `sigma session bootstrap` **selalu menampilkan blok preferensi bahasa**, tidak lagi disembunyikan saat default — supaya AI role selalu notice ketiga setting ini di setiap pengecekan progress, mengurangi risiko AI mencampur bahasa antar konteks (percakapan vs dokumen Sigma vs dokumen non-Sigma).
5. **Aturan perilaku baru (dikoreksi):** ketika Director secara eksplisit menyatakan preferensi bahasa (percakapan/dokumen Sigma/dokumen non-Sigma) di tengah percakapan, AI role **tidak langsung menjalankan `sigma config`** — AI **wajib menawarkan dulu** ke Director apakah preferensi itu ingin dipersist ke Sigma config atau tidak, dan baru menjalankan `sigma config` setelah **approval eksplisit** dari Director (selaras dengan prinsip "Director Authorization Language" yang sudah ada di CLAUDE.md project ini — perubahan config yang persisten butuh persetujuan eksplisit, bukan diasumsikan dari pernyataan percakapan biasa).
   - **Rasional yang disampaikan Director:** kalau dipersist ke config, bahasa akan konsisten otomatis di setiap sesi percakapan baru. Kalau tidak dipersist, preferensi mungkin hanya berlaku untuk sesi saat itu saja (tergantung AI-nya) dan hilang/tidak konsisten di sesi berikutnya — termasuk risiko dokumen artefak Sigma vs non-Sigma jadi tidak konsisten bahasanya kalau tidak diatur lewat config.
6. Aturan di atas **diformalkan ke role-memory per role** (`Sigma/role-memory/{ARC,FMN,DEV,AUD}-memory.json`) sebagai satu poin general. Catatan sadar: Professional Mode (mode default, non-governance) **tidak memuat role-memory sama sekali** per CLAUDE.md — jadi aturan ini hanya aktif saat salah satu role governance (ARC/FMN/DEV/AUD) sedang aktif, tidak di Professional Mode.

**Implikasi teknis untuk fase implementasi (belum dieksekusi, dicatat sebagai follow-up):**
- Hapus field `formal_identifier_language` dari `ProjectConfig` interface, `DEFAULTS`, dan `createDefaultProjectConfig()` di `src/engine/projectConfig.ts`.
- Tambah field baru untuk bahasa dokumen non-Sigma (nama final TBD) ke `ProjectConfig`, `DEFAULTS`, `createDefaultProjectConfig()`.
- Ubah tipe validasi/penanganan semua field bahasa dari kode-terbatas ke string bebas; hapus atau sederhanakan `LANG_NAMES`/`langLabel()`.
- Tambah CLI setter untuk field dokumen Sigma (`document_language`, saat ini tidak ada setter post-creation) dan field baru dokumen non-Sigma — kemungkinan restrukturisasi `sigma config set language` jadi beberapa sub-target (interaction/sigma-document/output-document).
- Hapus logika kondisional "only surface when non-English" di `session.ts:150` — blok bahasa selalu tampil.
- Tambahkan poin baru ke 4 file `Sigma/role-memory/{role}-memory.json` (ARC/FMN/DEV/AUD): instruksi "jika Director menyatakan preferensi bahasa eksplisit, tawarkan dulu apakah ingin dipersist ke `sigma config`; jalankan hanya setelah Director approve eksplisit."
- Update README.md/SIGMA_PROTOCOL.md yang menjelaskan `sigma config` dan field bahasa.

**Investigasi & Keputusan — `sigma setup install` vs `sigma setup update`:**

Director khawatir keduanya redundan karena selalu menjalankan keduanya bersamaan saat update sistem Sigma.

**Temuan teknis:** keduanya **tidak redundan**, tapi ada gap desain yang menjelaskan kebiasaan Director:
- `install` ([setup.ts:64-259](../src/commands/setup.ts#L64-L259)): copy templates/rules/governance/bridge ke `~/.sigma/`, seed `projects.json`/`sigma.config.json`, **deteksi AI tool + deploy file skill** (`arc.md`/`fmn.md`/`dev.md`/`aud.md`/dst. ke `~/.claude/commands/` dsb.), deploy hook `protect-sigma.js`.
- `update` ([setup.ts:325-393](../src/commands/setup.ts#L325-L393)): backup `~/.sigma/` lama, copy templates/rules/governance/bridge (sama seperti install), update `cli_version`. **Secara eksplisit TIDAK redeploy file skill maupun hook** (tertulis di pesan output: "skill files in AI tool directories were NOT redeployed").
- Akibatnya: kalau bundle package berisi perbaikan file skill, `update` saja tidak mempropagasikannya ke `~/.claude/commands/` dsb. — Director harus jalankan `install` juga (yang memicu prompt "Reinstall?"). Karena project ini aktif dikembangkan, kebiasaan menjalankan keduanya bersamaan rasional, bukan sia-sia — hanya pembagian tugas command yang tidak match kebutuhan nyata.

**Keputusan (2 syarat Director terpenuhi):**
1. Kedua command **tetap dipertahankan terpisah**, masing-masing untuk kondisi berbeda: `install` = first-time setup (belum ada Sigma terpasang), `update` = sudah terpasang dan butuh refresh.
2. `update` **diperluas** agar juga melakukan deploy file skill + hook (yang saat ini eksklusif hanya dilakukan `install`) — sehingga menjalankan `update` **saja** sudah cukup lengkap untuk kondisi "sudah install, mau update", tanpa perlu lagi menjalankan `install` setelahnya.

**Implikasi teknis untuk fase implementasi (belum dieksekusi, dicatat sebagai follow-up):**
- Refactor logika deteksi tool + deploy skill (Step B-D di [setup.ts:144-224](../src/commands/setup.ts#L144-L224)) dan deploy hook (`deployHook()`, [setup.ts:263-321](../src/commands/setup.ts#L263-L321)) dari `runInstall()` jadi fungsi bersama yang bisa dipanggil juga dari `runUpdate()`.
- Tentukan perilaku `update` untuk pemilihan tool: auto-redeploy ke seluruh tool yang terdeteksi/sebelumnya terkonfigurasi (tanpa prompt checkbox interaktif seperti `install`), karena `update` tidak perlu gate konfirmasi "Reinstall?" — hanya refresh konten.
- Hapus catatan "skill files... NOT redeployed" di pesan sukses `runUpdate()`, sesuaikan dengan perilaku baru.
- Update README.md/SIGMA_PROTOCOL.md yang menjelaskan `sigma setup update`.

**Status topik: Seluruh antrian Reconsider yang diajukan Director (project reset, roadmap family, sync family, config, setup) sudah tuntas diinvestigasi dan diputuskan.** Sisa item terbuka: `override`+`sigma doctor` (keputusan akhir sengaja ditunda ke fase Plan Implementation). Kategorisasi command lain di luar yang sudah dibahas menunggu arahan Director lebih lanjut jika ada.

---

### Topik 5 — Pembersihan Total Legacy MCP (Model Context Protocol)

**Latar belakang:** Director berencana membersihkan sisa kode MCP lama, dengan asumsi awal "semua MCP kecuali sequential-thinking sudah dihapus di versi sekarang."

**Temuan teknis (mengoreksi asumsi Director):** Dukungan multi-tool MCP **belum dihapus** — masih lengkap ada dan aktif:
- `writeReasonixMcpConfig()` dan `writeGeminiMcpConfig()` ([mcp.ts:56-237](../src/utils/mcp.ts#L56-L237)) — konfigurasi MCP khusus Reasonix (termasuk wrapper script `mcp-run-sigma-memory.js`, format shell-allowed `SIGMA_SHELL_ALLOWED`) dan Antigravity (format protobuf `$typeName`). Dipanggil aktif dari `setup install` (Step E/E2, saat platform terdeteksi) dan `setup memory --reasonix`/`--gemini`.
- Ditemukan bonus: `SIGMA_SHELL_ALLOWED` ([mcp.ts:133-156](../src/utils/mcp.ts#L133-L156)) berisi entri `'sigma sync'`, `'sigma override'` (sudah/akan dihapus di topik lain), dan **`'sigma refresh'`** — command yang disebut di `CLAUDE.md` project ini (untuk regenerate `SIGMA-REGISTRY.json`/`SIGMA-OPERATION-REGISTRY.json`) tapi **tidak ada implementasinya sama sekali** di 19 file command yang sudah dipetakan di Topik 4 — dangling reference murni.
- `sequential-thinking` (satu-satunya MCP yang disangka "current"): dicek langsung ke penulis kode (Claude, dalam sesi ini) — dikonfirmasi **tidak terpakai sama sekali** sepanjang sesi evaluasi ini meski tugasnya persis kategori "multi-step planning, architecture review, complex analysis" yang menurut `CLAUDE.md` seharusnya memicu pemakaiannya. Alasan: reasoning multi-langkah sudah native pada model, MCP ini cuma membungkus kemampuan yang sudah ada tanpa menambah kapasitas, jadi tidak pernah benar-benar dibutuhkan.

**Keputusan: hapus MCP total — tidak ada MCP bawaan tersisa sama sekali.** Mencakup:
1. Seluruh dukungan Reasonix MCP (`writeReasonixMcpConfig`, wrapper script `mcp-run-sigma-memory.js`, `SIGMA_SHELL_ALLOWED`).
2. Seluruh dukungan Antigravity/Gemini MCP (`writeGeminiMcpConfig`).
3. `sequential-thinking` — dihapus total, termasuk dari `.mcp.json`/`.vscode/mcp.json` bawaan project baru.
4. Tujuan: setup versi baru jadi jauh lebih sederhana — tidak ada dependency `npx`/MCP apapun yang perlu terpasang otomatis saat `project start`/`setup install`/`setup memory`.

**Implikasi teknis untuk fase implementasi (belum dieksekusi, dicatat sebagai follow-up):**
- Hapus total `src/utils/mcp.ts` (atau kosongkan — perlu ditentukan saat implementasi apakah file dihapus penuh atau disisakan kerangka kosong untuk kompatibilitas import).
- Hapus pemanggilan `writeMcpJson`/`writeVscodeMcpJson` di `src/commands/project.ts:257-265` (penulisan `.mcp.json` saat `project start`).
- Hapus Step E ("Reasonix MCP config") dan Step E2 ("Antigravity MCP config") di `runInstall()` ([setup.ts:226-248](../src/commands/setup.ts#L226-L248)).
- Hapus/sederhanakan `runMemorySetup()`/`sigma setup memory` di `setup.ts:406-478` — opsi `--reasonix`, `--gemini`, `--vscode`, `--print` terkait MCP kemungkinan besar tidak relevan lagi; perlu ditentukan apakah `sigma setup memory` masih diperlukan sama sekali atau ikut dihapus/direduksi drastis.
- Hapus section "MCP Tooling" (Sequential thinking) di `CLAUDE.md` project ini.
- Hapus wrapper script `~/.sigma/mcp-run-sigma-memory.js` dari proses deploy (kalau ada mekanisme cleanup untuk install lama — dicatat sebagai pertimbangan, bukan keharusan).
- `'sigma refresh'` di `SIGMA_SHELL_ALLOWED` otomatis terhapus bersama seluruh array ini — dangling reference tuntas terselesaikan sebagai efek samping.
- Update README.md/SIGMA_PROTOCOL.md yang menyebut MCP/sequential-thinking/Reasonix/Antigravity MCP config.
- Perlu ditinjau ulang apakah `detectTools()`/`targetPaths()` di `src/utils/detect.ts` masih relevan dipertahankan untuk keperluan lain (deploy skill file per platform) meski bagian MCP-nya dihapus — skill deployment (arc.md/fmn.md/dst.) tetap perlu deteksi tool, terpisah dari urusan MCP.

**Status topik: SELESAI.**

---

### Topik 6 — Evaluasi Workflow `sigma setup` Secara Menyeluruh (Final Pass)

**Sifat topik:** Meta-topik, sengaja **dieksekusi di akhir** (setelah seluruh topik evaluasi lain tuntas), karena `sigma setup install`/`update` menyentuh hampir seluruh keputusan yang sudah dibuat sepanjang sesi ini (CSO, MCP, roadmap, config bahasa, sync, dll.) — mengevaluasinya lebih awal berisiko tidak lengkap.

**Tujuan:** Evaluasi ulang seluruh workflow pemasangan (`sigma setup install`/`update`), hilangkan legacy code yang tidak relevan lagi, dan sesuaikan sistem setup dengan kondisi Sigma versi terbaru hasil seluruh keputusan sesi ini.

**Cakupan yang sudah teridentifikasi (dari diskusi awal, perlu direkonfirmasi saat pass final):**
- `ROLE_FILES` map ([setup.ts:38-44](../src/commands/setup.ts#L38-L44)) — entri `checkpoint`/`cso` untuk tiap platform perlu dihapus (konsekuensi Topik 3/4, CSO dihapus total).
- Step E & E2 Reasonix/Antigravity MCP config ([setup.ts:226-248](../src/commands/setup.ts#L226-L248)) — dihapus (konsekuensi Topik 5, MCP dihapus total).
- Refactor skill+hook deployment jadi shared function `install`↔`update` (konsekuensi keputusan `install` vs `update` sebelumnya).
- **Belum diputuskan**: apakah Reasonix/Antigravity tetap dipertahankan sebagai **platform tujuan deploy skill file** (urusan terpisah dari MCP) — ditunda ke pass final ini.
- `sigma.config.json` global (`~/.sigma/`, di-seed `install`) dikonfirmasi **tidak terdampak** perubahan field bahasa (itu di `Sigma/project.config.json`, file berbeda) — jadi tidak perlu diubah.

**Keputusan:** Ditunda sebagai agenda tersendiri, dieksekusi paling akhir setelah seluruh topik evaluasi lain (termasuk topik-topik yang belum dibahas di sesi ini) selesai — supaya `setup` yang diperbarui benar-benar mencerminkan state akhir sistem, bukan state parsial.

**Status topik: DITUNDA (sengaja) — dieksekusi di akhir seluruh evaluasi.**

---

### Topik 7 — Evaluasi Tujuan "Sigma Global" (`~/.sigma/`), Isolasi Project, dan Mekanisme Uninstall

**Latar belakang:** Director menanyakan kegunaan `~/.sigma/` (global). Ditemukan 7 fungsi berbeda dalam satu folder: (1) sumber template/rule live untuk semua project, (2) sumber `project sync`, (3) registry lintas-project (`projects.json`), (4) metadata instalasi CLI, (5) memory ekosistem (`memory_sigma.jsonl`), (6) bridge stubs (template `CLAUDE.md`/`GEMINI.md`/dst.), (7) hook `protect-sigma.js`.

**Keputusan per bagian:**

1. **Registry lintas-project (`~/.sigma/projects.json`, `sigma project register`) — dihapus.** Director menilai tidak penting.

2. **Memory ekosistem (`~/.sigma/memory_sigma.jsonl`) — koreksi temuan:** Director mengira ini sudah dihapus di versi sekarang; dikonfirmasi **belum** — masih aktif di-seed lewat `sigma setup memory` ([setup.ts:397-404](../src/commands/setup.ts#L397-L404)) dan disebut di template bridge `CLAUDE.md` (section "Memory Isolation"). Karena satu-satunya mekanisme akses (MCP `server-memory` via adapter Reasonix/Antigravity) sudah dihapus di Topik 5, field ini otomatis jadi orphan — **ikut dibereskan sebagai bagian perbaikan bridge template** (lihat poin 3).

3. **Bridge stubs — diperbaiki total, bukan dihapus.** Template `setup/targets/bridge/{CLAUDE,GEMINI,AGENTS,DEEPSEEK,REASONIX}.md` adalah master template untuk file instruksi AI per-project (isinya nyaris identik dengan `CLAUDE.md` project ini). Ditemukan usang di beberapa bagian (section "MCP Tooling"/"Memory Isolation" menyebut MCP+CSO yang sudah dihapus, tabel "CLI-Managed Files" menyebut `sigma refresh` yang dangling, kalimat "`sigma memory --<role>` after CLI support lands" padahal command itu sudah ada). **Ditemukan juga bug terpisah**: `sigma project start` ([project.ts:243-250](../src/commands/project.ts#L243-L250)) ternyata **tidak memakai template bridge ini sama sekali** — hanya menulis placeholder kosong `<!-- Sigma bridge stub — Phase 6 will write real content -->`, sehingga template lengkap ini **terputus (orphaned)** dari alur pembuatan project. Keputusan: perbaiki isi template (sinkronkan dengan seluruh keputusan sesi ini) **dan** sambungkan ke `project start` supaya benar-benar terpakai.

4. **Kekhawatiran kontaminasi ke setup AI tool global** (Director khawatir Sigma meng-override `CLAUDE.md`/`GEMINI.md` global pengguna, bukan cuma project-local): Diinvestigasi lewat grep menyeluruh ke seluruh referensi `~/.claude/` di source code.
   - **Aman, tidak ada kontaminasi**: penulisan `CLAUDE.md`/`GEMINI.md`/`AGENTS.md` project selalu ke path project-local, tidak pernah menyentuh `~/.claude/CLAUDE.md` global. Pola "project CLAUDE.md override global" itu sendiri adalah desain bawaan Claude Code + instruksi Director sendiri di global `CLAUDE.md`, bukan buatan Sigma. Deploy skill file ke `~/.claude/commands/` bersifat menambah file baru, tidak menimpa file yang sudah ada.
   - **Titik nyata ditemukan**: `deployHook()` ([setup.ts:263-321](../src/commands/setup.ts#L263-L321)) mem-patch `~/.claude/settings.json` (file global) untuk menambahkan hook `protect-sigma.js` yang berjalan di **semua** sesi Claude Code di mesin, bukan cuma project ber-Sigma. Logika hook itu sendiri sudah aman/ter-scope oleh path-matching (`Sigma[\/\\]progress\.json$` — otomatis hanya relevan untuk project yang benar-benar punya Sigma, no-op untuk lainnya) — jadi **tidak perlu diperketat lagi**, kondisinya sudah tepat secara fungsional. Masalah sebenarnya bukan di scoping hook, tapi di **tidak ada mekanisme uninstall** untuk membersihkan patch ini kalau Director berhenti pakai Sigma.

5. **Mekanisme uninstall — baru disadari belum ada, disepakati untuk ditambahkan.** `sigma setup uninstall` (nama command final ditentukan saat implementasi):
   - Membersihkan seluruh jejak instalasi global: folder `~/.sigma/` (templates/rules/governance/bridge/sigma.config.json), file skill yang di-deploy ke tiap AI tool (`~/.claude/commands/*`, `~/.codex/skills/*`, dst.), dan entry hook `protect-sigma.js` di `~/.claude/settings.json` (dihapus secara surgical — hanya entry milik Sigma, bukan seluruh file settings.json, mengingat user mungkin punya hook lain).
   - **Tidak boleh menyentuh** folder `Sigma/` di project manapun — project lokal tetap utuh 100% di disk. Satu-satunya konsekuensi uninstall: command `sigma` berhenti berfungsi dengan benar (operasi CLI-nya saja yang berhenti, bukan datanya).

**Implikasi teknis untuk fase implementasi (belum dieksekusi, dicatat sebagai follow-up):**
- Hapus `GLOBAL_PROJECTS_FILE`/`registerRoadmapDraft`-related registry code dan `sigma project register` command (lihat juga Topik 4 project.ts).
- Hapus referensi `memory_sigma.jsonl`/seed logic (`seedMemoryFile`, `GLOBAL_MEMORY_FILE`, opsi `--reeed` dsb.) di `setup.ts` — konsisten dengan penghapusan MCP di Topik 5/6.
- Tulis ulang isi `setup/targets/bridge/{CLAUDE,GEMINI,AGENTS,DEEPSEEK,REASONIX}.md`: hapus section MCP Tooling, Memory Isolation (atau sesuaikan tanpa CSO/MCP), perbaiki tabel CLI-Managed Files (hapus `sigma refresh`), perbaiki kalimat `sigma memory` yang sudah tidak "akan datang".
- Ubah `sigma project start` ([project.ts:243-250](../src/commands/project.ts#L243-L250)) agar copy dari `~/.sigma/bridge/{file}` (dengan bundle fallback, pola sama seperti `resolveTemplate()`) alih-alih menulis placeholder kosong hardcode.
- Tambahkan command baru `sigma setup uninstall`: hapus `~/.sigma/`, hapus skill file per tool yang terdeteksi/tercatat pernah di-deploy, hapus entry hook di `~/.claude/settings.json` secara surgical (idempotent removal, mirror dari logic idempotent addition yang sudah ada di `deployHook()`).
- Update README.md/SIGMA_PROTOCOL.md yang menjelaskan struktur `~/.sigma/` dan tambahkan dokumentasi `sigma setup uninstall`.

**Status topik: SELESAI** (menyatu dengan Topik 6 sebagai bagian final pass `setup`, karena keduanya saling terkait langsung).

---

## Isu Terbuka / Belum Disepakati

- **`override` + `sigma doctor`**: keputusan akhir (perbaiki vs hapus) sengaja ditunda ke fase Plan Implementation — dicatat sebagai agenda wajib, bukan isu yang hilang.
- Kategorisasi command lain di luar `gitignore generate`, `cso`, `override`, `sigma doctor` — menunggu arahan Director lebih lanjut (mana yang masuk Reconsider / Evaluate, sisanya default keep).
- **Topik 6 (`sigma setup` final pass)**: sengaja ditunda, dieksekusi paling akhir setelah seluruh topik evaluasi lain (termasuk yang belum dibahas) tuntas — termasuk keputusan terbuka soal Reasonix/Antigravity sebagai platform deploy skill, dan seluruh implikasi teknis Topik 7 (bridge template, uninstall mechanism, pembersihan registry/memory ekosistem) yang menyatu ke pass final ini.

---

## Next Steps

- **Sesi diskusi ditutup oleh Director (14 Juli 2026).** Director melanjutkan ke sesi/chat baru untuk merumuskan fase Plan Implementation.
- Sesi implementasi berikutnya perlu membaca dokumen ini secara penuh sebagai dasar penyusunan Plan (FMN-PLAN atau setara) — 7 topik sudah disepakati (lihat "Kesepakatan" di atas), dengan 2 catatan penting:
  1. **`override` + `sigma doctor`** — keputusan akhir (perbaiki agar doctor override-aware, atau hapus override) **belum diputuskan**, wajib diselesaikan sebagai bagian awal Plan Implementation, bukan diasumsikan.
  2. **Topik 6 (`sigma setup` final pass, menyatu dengan Topik 7)** — sengaja dieksekusi **paling akhir** dalam urutan implementasi, setelah seluruh perubahan lain (CSO, MCP, roadmap, config, sync, dll.) selesai diimplementasikan, supaya `setup` yang diperbarui mencerminkan state akhir sistem yang sebenarnya, bukan state parsial. Termasuk keputusan terbuka soal Reasonix/Antigravity sebagai platform deploy skill.
- Tidak ada command/topik lain yang tersisa untuk dikategorikan — Director menyatakan cukup untuk sesi ini.
