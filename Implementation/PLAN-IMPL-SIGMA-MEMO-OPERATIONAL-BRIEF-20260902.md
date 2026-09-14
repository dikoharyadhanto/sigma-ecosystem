# PLAN-IMPL — Sigma Memo (Operational Brief)

**Sumber**: Diskusi sesi ini (2026-09-02) antara Director dan Claude (Professional Mode). Bermula dari rencana menghidupkan kembali "checkpoint" yang dulu dihapus, lalu berkembang jadi mekanisme baru bernama **memo** dengan pendekatan berbeda.
**Tanggal**: 2026-09-02 · **Revisi 3** (implementasi Fase 1–7 selesai 2026-09-12)
**Status**: **IMPLEMENTED — dieksekusi jalur Professional Mode langsung** (Director 2026-09-12: "eksekusi jalur professional... sigma master folder project tidak terikat ke sigma governance itu sendiri"). Fase 1–7 selesai, 440/440 test lulus. Belum di-commit — menunggu instruksi Director. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.
**Hubungan dengan riwayat**: Fitur `CHECKPOINT` + `CSO` dihapus total via commit `208a560` (2026-07-14, "Remove CHECKPOINT and CSO functionalities from Sigma framework"; governance artifact `PLAN-EVAL-05-CSO-REMOVAL`). Memo **bukan** kebangkitan CSO — beda storage, beda perintah, beda tujuan, beda template. Detail pembedaan di §7.
**Branch**: diusulkan branch baru `feat/sigma-memo-operational-brief` dari `main`. `main` tidak disentuh, tidak ada merge tanpa izin eksplisit Director.

---

## 1. Masalah yang diselesaikan

Sistem messaging Sigma (`sigma send` / `sigma inbox`) hanya melayani **handoff antar-role** (ARC↔FMN↔DEV↔AUD). Tidak ada kanal untuk sebuah role meninggalkan catatan operasional **untuk dirinya sendiri di sesi berikutnya**.

Konsekuensi sekarang:

1. **Transfer konteks antar-sesi tidak punya wadah.** Ketika sesi DEV berakhir di tengah pekerjaan (batas konteks, jeda, handoff), tidak ada tempat menaruh "lanjutkan dari mana, baca apa dulu" selain menuliskannya ke artifact Sigma — yang sering belum layak diformalkan atau bahkan belum ada (kerja pra-lock).
2. **`sigma send --from dev --to dev` secara mekanis bisa, tapi jadi jebakan.** Tidak ada guard `from === to`, jadi perintah itu berhasil — tetapi pesan masuk ke inbox DEV sebagai UNREAD, dan send gate (`src/commands/send.ts:99-110`) langsung memblokir DEV mengirim apa pun sampai pesan itu dibaca. Bukan fitur, kecelakaan.
3. **CSO lama over-engineered.** Template 140 baris, role mode tersendiri, jadi beban. Itu alasan dihapus. Kebutuhan aslinya — catatan resume ringkas — tidak pernah tergantikan.

Memo mengisi celah ini dengan biaya seminimal mungkin: satu tipe pesan baru di atas infrastruktur mailbox yang sudah ada, tanpa storage baru, tanpa role baru.

---

## 2. Prinsip kunci (dikunci Director)

> **Memo adalah brief operasional — singkat, padat, to the point. Bukan pelengkap, bukan pengganti artifact Sigma apa pun.**

Turunannya:

- Memo berisi **instruksi operasional dan pointer**, bukan salinan isi artifact. Contoh isi yang benar: "pelajari exec-evidence 1.2", "baca plan kontrak 1.3 §Test Contract", "cek inbox msg `<id>` dari FMN sebelum lanjut". Contoh isi yang **salah**: menyalin ulang keputusan yang sudah tertulis di DEV-EXEC.
- Memo **tidak lapuk** karena isinya pointer, bukan snapshot. "Baca bagian X" selalu menunjuk versi terbaru artifact.
- Memo **tidak boleh jadi shadow-artifact**. Kesimpulan substantif yang belum persist boleh ditulis di memo **hanya** sebagai penanda TODO berpasangan instruksi formalisasi: `Kesimpulan: <X>. → formalkan ke exec-evidence 1.2 sebelum lanjut.` Sebuah keputusan tidak boleh hidup di memo lintas lebih dari satu lompatan sesi.

---

## 3. Keputusan desain (dari diskusi)

| Aspek | Keputusan |
| :--- | :--- |
| **Nama** | `memo`. Bukan `checkpoint`/`CSO` — istilah lama sudah di-scrub dari framework, dan metode ini berbeda. |
| **Storage** | Tidak ada storage baru. Memo = entri di `Sigma/messages/index.json` yang sama, `type: MEMO`, `from === to`, file markdown di `Sigma/messages/<ROLE>/`. |
| **CLI** | Command group baru `sigma memo` dengan subcommand `write` / `list` / `read`. Reuse primitif `src/engine/mailbox.ts`. |
| **`--to`** | Ditolak sepenuhnya di `sigma memo write`. Memo untuk role lain = itu `sigma send`, tujuan berbeda. |
| **Send gate** | MEMO dikecualikan dari hitungan unread yang memblokir `sigma send`. DEV dengan N memo belum dibaca tetap bisa `sigma send --from dev --to arc`. |
| **Kuota** | Maks **N unread MEMO per role** (default 5), configurable via `sigma config set memo-limit <n>`. `0` = fitur memo mati. Kuota penuh → `sigma memo write` ditolak dan menampilkan daftar memo unread. |
| **Isolasi kuota** | Per role. 5 untuk DEV, 5 untuk ARC, dst. Tidak ada pool gabungan. |
| **`sigma inbox`** | Daftar pesan mengecualikan MEMO. Kalau role punya UNREAD memo, cetak **satu baris penunjuk**: `N memo belum dibaca — sigma memo list --role dev`. |
| **Field wajib** | `action = FYI` (dilewati, otomatis). `related_artifact` **tidak** dilewati untuk memo — wajib salah satu `INTENT-vN` / `PLAN-vN` / `EXEC-vN` / `GENERAL` via flag `--ref` (diputuskan Director 2026-09-12; membalik keputusan Revisi 1 yang memaksa `N/A`). Tanpa seksi "Action Required" di markdown. |
| **Sigma Artifact Reference** | Flag wajib `--ref <INTENT-vN\|PLAN-vN\|EXEC-vN\|GENERAL>`, divalidasi regex, disimpan ke field `related_artifact` yang sudah ada di skema `MessageEntry` — tidak ada field baru. `GENERAL` untuk memo yang tidak terikat artifact governance tertentu (mis. diskusi Professional Mode pra-INTENT). Ditambahkan Director 2026-09-12. |
| **Topik** | Flag wajib `--topic <satu kalimat>`, non-empty. Dirender sebagai baris metadata di body memo (bukan ditulis caller). Kalau `--subject` tidak diberikan, `--subject` auto-terisi dari `--topic` (bukan lagi `(memo)` generik). Ditambahkan Director 2026-09-12. |
| **Skill** | Dua skill terpisah: `/write-memo` dan `/read-memo`. Alasan pemisahan di §6. |
| **Template** | 4 seksi naratif + header. Baris "Chain / Phase / Version" diisi otomatis oleh CLI dari `progress.json`. Label ini dan "Topic" ditulis dalam Bahasa Inggris (keputusan review checkpoint §6.4, 2026-09-12), menyamakan dengan skill `/write-memo` yang isinya Inggris. Template di §5.4. |
| **Auto-sweep** | READ memo ikut aging ke OUTDATED lewat mekanisme `mailbox.auto_outdate_read_keep` yang sudah ada. UNREAD memo tidak pernah tersentuh sweep. |
| **Housekeeping** | Non-destruktif — file memo tidak pernah dihapus/dipindah/rename, konsisten dengan kebijakan mailbox (`src/commands/inbox.ts` tidak punya operasi delete). |
| **Opsi konten** | Opsi B (longgar) — memo boleh membawa kesimpulan satu baris **dengan** guardrail formalisasi di §2. |

---

## 4. Cakupan Teknis

### 4.1 Yang berubah

| Berkas | Perubahan |
| :--- | :--- |
| `src/config.ts:86` | `VALID_MESSAGE_TYPES` — tambah `'MEMO'`. Menambah `MEMO` ke sini juga otomatis membuat `sigma inbox check` (`src/commands/inbox.ts:260`) menerima tipe ini sebagai valid. |
| `src/engine/mailbox.ts` | `getUnreadForRole` — tambah parameter opsional `excludeMemo` (default `false`). `selectInboxMessages` — kecualikan `type === 'MEMO'` dari semua view (`unread`/`all`/`outdated`). Tambah helper baru: `getUnreadMemosForRole(index, role)` dan `countUnreadMemos(index, role)`. Filename generator: special-case `MEMO` agar menghasilkan `MEMO-<ROLE>-<ts>-<suffix>.md` (bukan `MEMO-DEV-DEV-...` yang redundan). |
| `src/engine/projectConfig.ts` | `MailboxConfig` — tambah field `memo_unread_limit: number`. `DEFAULT_MAILBOX` — `memo_unread_limit: 5`. Tambah `resolveMemoLimit(config)` meniru pola `resolveAutoOutdateKeep` (angka non-numerik/negatif → default; `0` dihormati = fitur mati). |
| `src/commands/send.ts:100` | Panggilan `getUnreadForRole(existingIndex, fromRole)` → `getUnreadForRole(existingIndex, fromRole, { excludeMemo: true })`. Ini satu-satunya titik di mana memo dikecualikan dari gate. |
| `src/commands/inbox.ts` | `runList` — setelah mencetak daftar pesan, kalau `countUnreadMemos(index, role) > 0`, cetak baris penunjuk ke `sigma memo list`. |
| `src/commands/session.ts:~239` | Setelah blok "Role Inbox", tambah baris ringkas per role: `<ROLE>: N memo belum dibaca — sigma memo list --role <role>`. Sumber angka: `countUnreadMemos`. (Lapisan surfacing pasif — lihat §5.5.) |
| `src/commands/config.ts` | Tambah subcommand `sigma config set memo-limit <n>` (menulis `mailbox.memo_unread_limit`). Tambah barisnya di output `sigma config show` (**koreksi Revisi 2** — Revisi 1 salah menyebut `sigma config get`, command itu tidak ada; command aktual adalah `show`, lihat `src/commands/config.ts:91`). |
| `src/commands/memo.ts` | **Berkas baru.** Command group `sigma memo` — detail di §5, termasuk validasi `--ref`/`--topic`. |
| `src/cli.ts` | Import `memoCommand`, `program.addCommand(memoCommand())` (setelah `inboxCommand()` di baris ~42). |
| `Sigma/templates/MEMO-TEMPLATE.md` | **Berkas baru.** Template di §5.4. (Catatan: `CSO-TEMPLATE.md` yang lama sudah dihapus commit `208a560` — ini template baru yang berbeda.) |
| `Sigma/SIGMA-OPERATION-REGISTRY.json` | Tambah operasi `memo` (domain `memo`, action `memo`) + subcommand `write`/`list`/`read` ke array `operations` dan daftar `operation_ids` di header. Registri disinkron manual (`scripts/refresh-registries.js` masih stub — lihat memori proyek). |
| `Sigma/SIGMA-REGISTRY.json` | Tambah entri skill `write-memo` dan `read-memo` kalau registri ini melacak skill. |
| `src/commands/setup.ts:43-48` | `ROLE_FILES` — tambah entri `writeMemo` dan `readMemo` untuk tiap platform (`claudeCode`, `codex`, `reasonix`, `antigravity`). Antigravity juga butuh entri di `manifest.json` (logika sudah ada di `runInstall`). |
| `setup/targets/*` | Berkas skill baru per target — lihat §6.3. |
| `README.md` | Command Reference (sekitar baris 581-590) — tambah baris `memo`. Bagian "Handoff between sessions" (baris ~294) — sebut memo untuk handoff sesi-ke-sesi role yang sama. |
| `Sigma/SIGMA_PROTOCOL.md` | Tambah paragraf singkat tentang memo di bagian messaging/handoff. |

### 4.2 Yang TIDAK berubah

- **Skema `MessageEntry`** — tidak ada field baru. `type: MEMO` + `from === to` sudah cukup mengidentifikasi memo. Tidak ada migrasi skema, tidak ada perubahan `index.json` untuk proyek lama.
- **`sigma send`** — logika inti tidak disentuh selain satu argumen `excludeMemo` di pemanggilan gate. Memo **tidak** ditulis lewat `sigma send`; ia punya perintah sendiri.
- **`sigma inbox read` / `archive` / `clear` / `check`** — tidak berubah. `inbox read <id>` tetap bisa membaca memo berdasarkan id (tidak berbahaya); `sigma memo read` adalah jalur berkategori yang memvalidasi `type === MEMO`.
- **Auto-sweep OUTDATED** — mekanisme `selectSurplusRead` + `resolveAutoOutdateKeep` dipakai apa adanya. Sweep hanya menyentuh `status === 'READ'`, jadi UNREAD memo aman tanpa kode tambahan.
- **DIRECTOR** — tetap di luar messaging dan di luar memo. Director berkomunikasi langsung.

### 4.3 Test yang perlu ditambah

Berkas baru `test/memo.test.ts`:

1. `sigma memo write --role dev` membuat entri `type: MEMO`, `from === to === DEV`, `action: FYI`, `related_artifact: N/A`, `status: UNREAD`.
2. `--to` pada `sigma memo write` → error, tidak menulis apa pun.
3. Kuota: memo ke-(N+1) ditolak dengan pesan berisi daftar N memo unread; memo 1..N berhasil.
4. Kuota penuh **tidak** memblokir `sigma send --from dev --to arc` (regresi send gate).
5. Kuota penuh **tidak** memblokir `sigma memo write` untuk role lain (`--role arc`) — isolasi per role.
6. `sigma memo read <id>` mencetak isi, menandai READ, membebaskan satu slot kuota.
7. `sigma memo read <id>` menolak id yang bukan `type: MEMO`.
8. `sigma inbox --role dev` tidak menampilkan memo di daftar pesan, tetapi mencetak baris penunjuk saat ada UNREAD memo.
9. Auto-sweep: setelah `memo_unread_limit` READ memo terlampaui `auto_outdate_read_keep`, READ memo tertua → OUTDATED; UNREAD memo tidak pernah kena.
10. `sigma inbox check` melewati entri MEMO tanpa `INVALID type`.
11. `sigma config set memo-limit 0` → `sigma memo write` menolak dengan pesan "memo disabled".
12. Baris "Chain / Phase / Version" terisi benar dari chain aktif; degradasi anggun ke `(unresolved)` saat tidak ada chain.
13. `--ref` invalid (bukan `INTENT-vN`/`PLAN-vN`/`EXEC-vN`/`GENERAL`) → `sigma memo write` ditolak, tidak menulis apa pun.
14. `--ref GENERAL` diterima tanpa chain aktif (regresi §5.1 langkah 5).
15. `--topic` kosong/tidak diberikan → `sigma memo write` ditolak.
16. `--subject` tidak diberikan → subject entri terisi otomatis dari `--topic`.

Sweep berkas test lain yang meng-assert jumlah `VALID_MESSAGE_TYPES` atau mengiterasi tipe pesan.

---

## 5. Desain detail

### 5.1 `sigma memo write`

```
sigma memo write --role <role> --ref <INTENT-vN|PLAN-vN|EXEC-vN|GENERAL> --topic <satu kalimat> (--message <body> | --message-file <path>) [--subject <s>]
```

- `--role` wajib. Salah satu dari `arc|fmn|dev|aud` (pakai `MESSAGING_ROLES`). Konsisten dengan `sigma inbox --role`, bukan `sigma send --from`, karena secara mental ini "memo milik role tersebut".
- `--to` **ditolak** dengan error eksplisit: *"sigma memo does not take --to — a memo is always to your own role. Use sigma send for cross-role messages."*
- `--ref` wajib, divalidasi regex `^(INTENT|PLAN|EXEC)-v\d+$` atau literal `GENERAL`. Nilai lain/kosong → error eksplisit dengan daftar nilai valid. Disimpan ke `related_artifact` pada entri index. Diputuskan Director 2026-09-12 (§9 poin 7).
- `--topic` wajib, satu kalimat, non-empty. Kalau `--subject` tidak diberikan, `--subject` auto-terisi dari `--topic`. Diputuskan Director 2026-09-12 (§9 poin 8).
- Body via `--message` (satu baris) atau `--message-file` (multi-baris, preserve newline) — sama seperti `sigma send`.
- `--subject` opsional; default kalau `--topic` juga tidak ada jalan turunannya (tidak seharusnya terjadi karena `--topic` wajib) tetap `(memo)`.
- **Langkah eksekusi:**
  1. `findProjectRoot()`, `readIndex()`.
  2. Validasi `--ref` (regex/literal) dan `--topic` (non-empty) — gagal di sini sebelum menyentuh index kalau tidak valid.
  3. `countUnreadMemos(index, role)` ≥ `resolveMemoLimit(config)` (dan limit > 0) → **tolak**, cetak daftar memo unread + `sigma memo read <id>`.
  4. `resolveMemoLimit(config) === 0` → tolak: *"Memo is disabled (mailbox.memo_unread_limit = 0). Enable with: sigma config set memo-limit 5"*.
  5. Resolve baris chain otomatis: `readActiveChain(projectRoot)` → `chainVersion`, `lifecycle_state`, `intent.version/state`, `plan.active_version/active_state`, `exec.active_version/active_state`. Susun jadi satu baris. Kalau `readActiveChain` melempar (tidak ada chain) → `(unresolved — no active chain)`. (`--ref GENERAL` dipakai justru untuk kasus ini.)
  6. Bangun markdown: header metadata + baris chain + baris `Sigma Artifact Reference` (dari `--ref`) + baris `Topic` (dari `--topic`) + body caller (apa adanya, caller/skill yang menyusun 4 seksi §5.4).
  7. `generateMessageId(role, role, ts, suffix)` (signatur `(from, to, ts, suffix)`), filename via `generateFilename('MEMO', role, role, ts, suffix)` dengan special-case agar keluar `MEMO-<ROLE>-<ts>-<suffix>.md` (tanpa role ganda).
  8. Tulis file ke `Sigma/messages/<ROLE>/`, push entri ke index dengan `related_artifact` = nilai `--ref`, `writeIndex()`.
  9. Cetak konfirmasi + `slot terpakai: <n+1>/<limit>`.

### 5.2 `sigma memo list`

```
sigma memo list --role <role> [--all]
```

- Default: hanya UNREAD memo untuk role, terurut `created_at` **terlama dulu** (diputuskan Director 2026-09-12 — konsisten dengan `selectSurplusRead` yang membuang surplus tertua lebih dulu; memo lama paling mendesak dibersihkan).
- `--all`: sertakan READ + OUTDATED.
- Header output menampilkan status kuota: `Memo — DEV — 2/5 slot terpakai`.
- Tiap entri: status, `related_artifact` (Ref), `subject` (auto-terisi dari Topic saat `--subject` tidak diberikan), id, created_at.
- Footer: `sigma memo read <id>`.

### 5.3 `sigma memo read`

```
sigma memo read <memo-id>
```

- Validasi `entry.type === 'MEMO'` — kalau bukan: *"<id> is not a memo. Use: sigma inbox read <id>"*.
- Cetak isi file.
- Kalau `status === 'UNREAD'` → set `READ`, bebaskan slot kuota.
- Jalankan auto-sweep OUTDATED yang sama persis dengan `sigma inbox read` (`resolveAutoOutdateKeep`, `selectSurplusRead` untuk `entry.to`, kecualikan memo yang baru dibaca).
- `writeIndex()` kalau ada perubahan.

### 5.4 Template memo (`Sigma/templates/MEMO-TEMPLATE.md`)

Header + baris chain digenerate CLI. Empat seksi naratif diisi oleh caller (`/write-memo`). Sesuai keputusan review checkpoint §6.4 (2026-09-12), seluruh isi memo — termasuk label dan placeholder di bawah ini — ditulis dalam Bahasa Inggris, persis salinan `Sigma/templates/MEMO-TEMPLATE.md`:

```
## Memo — <ROLE> — <YYYY-MM-DD HH:MM>

**Chain / Phase / Version:** <chain-vN> | <DESIGN|BUILD|CLOSE|CLOSED> | INTENT <vN> (<STATE>) · PLAN <vN> (<STATE>) · EXEC <vN> (<STATE>)

**Sigma Artifact Reference:** <INTENT-vN|PLAN-vN|EXEC-vN|GENERAL>

**Topic:** <one sentence>

**Context (only what isn't already in the artifact):**
<2-3 sentences — direction of this session's discussion, why it stopped here. Not a summary of artifact content.>

**Reorientation — Read:**
- <artifact ref + section, e.g. exec-evidence §1.2>
- <inbox msg ref, e.g. inbox msg abc123 from FMN>

**Next Actions:**
- <concrete operational instruction>
- avoid: <a path already tried and failed, with a short reason>

**Blocked — Do Not Proceed Until:**
- <a Director decision on X, or role Y's reply to msg Z>
```

Seksi "Context" dan "Blocked" boleh kosong (tulis `—`). "Reorientation — Read" dan "Next Actions" wajib ada isi — itu inti memo. Baris "Chain / Phase / Version", "Sigma Artifact Reference", dan "Topic" dihasilkan otomatis oleh CLI dari `readActiveChain()` dan flag `--ref`/`--topic`, bukan ditulis caller di badan markdown. Kalau sebuah informasi butuh penjelasan detail, caller tidak menuliskannya di memo — buat file `.md` baru di `Sigma/notes/` (tanpa perlu approval Director) dan arahkan dari "Reorientation — Read" (lihat skill `/write-memo` §"Keeping Memos Brief").

### 5.5 Surfacing — bagaimana memo sampai terbaca

Trigger pembacaan **tidak bisa dijamin lewat kode** (perilaku AI, bukan mekanisme). Pendekatan berlapis, reliabilitas menurun:

| Lapis | Mekanisme | Dijamin kode? | Masuk plan ini? |
| :--- | :--- | :--- | :--- |
| 1 | Kuota penuh → `sigma memo write` diblokir + daftar unread | Ya | Ya (§5.1) |
| 2 | `sigma inbox` (dijalankan role terus-menerus) cetak baris penunjuk memo | Ya | Ya (§4.1) |
| 3 | `sigma session bootstrap` cetak jumlah memo unread per role | Ya (bila bootstrap dijalankan) | Ya (§4.1) |
| 4 | Instruksi di skill `/read-memo` + role rules: cek memo di awal sesi | Tidak (bergantung kepatuhan) | Ya (§6) |
| 5 | Director memanggil `/read-memo` manual | Tidak | Ya (skill ada) |

**Banner pasif di semua perintah `sigma` write-class** (dibahas di diskusi sebagai lapis kuat) **sengaja tidak masuk plan ini** — kebanyakan perintah write Sigma (`plan lock`, `exec new`, dst.) tidak membawa `--role`, jadi banner tidak tahu memo siapa yang harus dicek. Opsi "cek semua role" berisik. Ditunda sebagai kerja terpisah (§9 poin 4).

---

## 6. Skill `/write-memo` dan `/read-memo`

### 6.1 Kenapa dua skill, bukan satu

- **Skill dipilih model dari deskripsi satu baris.** `write` (akhir blok kerja, deliberate) dan `read` (awal sesi, sering, aman) adalah dua momen lifecycle berbeda. Digabung → deskripsi harus memuat keduanya, sinyal match masing-masing melemah.
- **Profil keamanan berbeda.** `write` membuat state + konsumsi kuota + bisa diblokir. `read` non-destruktif. Role rules perlu bisa menyebut "di awal sesi pertimbangkan `/read-memo`" tanpa menyeret semantik write.
- **Overload argumen itu jebakan.** `/memo` = baca, `/memo <teks>` = tulis → ambigu.
- **Cocok pola Sigma.** Sudah ada pemisahan sisi produksi/konsumsi: `sigma send` vs `sigma inbox`. `/write-memo` + `/read-memo` mencerminkan itu.

Pemisahan ada di level **skill** (orkestrasi AI), bukan **perintah**. CLI tetap satu `sigma memo` dengan subcommand — mekanisme bodoh, orkestrasi pintar.

### 6.2 Isi tiap skill (ringkas — bukan CSO 140 baris)

**`/write-memo`:**
- Aktivasi: "Buat memo" / "Tulis memo" / `/write-memo`. Tidak self-activate.
- Tugas: kumpulkan state sesi → susun 4 seksi template (§5.4) → tulis ke file → `sigma memo write --role <role-aktif> --message-file <file>`.
- Panduan pengisian tiap seksi (1-2 kalimat per seksi, bukan tabel).
- Guardrail Opsi B (§2): kesimpulan substantif selalu berpasangan instruksi formalisasi.
- Tidak lock, tidak approve, tidak mutasi governance.

**`/read-memo`:**
- Aktivasi: "Baca memo" / "Cek memo" / `/read-memo`. Boleh dijalankan AI di awal sesi (tidak dijamin).
- Tugas: `sigma memo list --role <role-aktif>` → untuk tiap memo yang relevan, `sigma memo read <id>` → jalankan instruksi orientasi → tandai selesai.
- Setelah semua diproses: konfirmasi ke Director apa yang ditemukan dan langkah berikutnya.

### 6.3 Distribusi ke setup targets

Tambah berkas skill per target (pola sama dengan skill `humanize` yang sudah ada):

| Target | Path | Berkas |
| :--- | :--- | :--- |
| `claude_code` | `setup/targets/claude_code/` | `write-memo.md`, `read-memo.md` |
| `codex` | `setup/targets/codex/` | `write-memo/SKILL.md` (+ `agents/openai.yaml`), `read-memo/SKILL.md` (+ `agents/openai.yaml`) |
| `reasonix` | `setup/targets/reasonix/` | `write-memo.md`, `read-memo.md` |
| `antigravity` | `setup/targets/antigravity/` | `sigma-write-memo/SKILL.md` (+ `plugin.json`), `sigma-read-memo/SKILL.md` (+ `plugin.json`) |

`src/commands/setup.ts` `ROLE_FILES` (baris 43-48) — tambah key `writeMemo` + `readMemo` per platform dengan nama berkas di atas. `cursor` tidak dapat skill (hanya `SIGMA.mdc` tunggal).

### 6.4 Checkpoint review — draft skill (diputuskan Director 2026-09-12)

Implementasi skill **berhenti di satu titik wajib**, sebelum direplikasi lintas target dan sebelum Fase 7 dimulai:

1. Tulis draft acuan `write-memo.md` dan `read-memo.md` **hanya untuk target `claude_code`** (`setup/targets/claude_code/`) — format paling sederhana, tanpa manifest/plugin.json tambahan, representatif untuk direview isinya.
2. **Pause.** Sajikan isi kedua file ke Director untuk review — tidak lanjut ke langkah 3 tanpa itu.
3. Terima feedback/revisi Director, perbaiki draft `claude_code` sampai disetujui.
4. Setelah disetujui: replikasi ke `codex`, `reasonix`, `antigravity` (§6.3), lanjut `ROLE_FILES` di `setup.ts` + manifest antigravity, baru mulai Fase 7 (§10).

Fase 7 (registry, `README.md`, `SIGMA_PROTOCOL.md`, role rules) **menunggu checkpoint ini disetujui** — isinya (nama skill, kalimat aktivasi, deskripsi satu baris untuk pemilihan skill) bisa berubah dari feedback Director, jadi tidak digarap paralel dengan draft skill.

---

## 7. Memo vs CSO/CHECKPOINT lama — pembedaan eksplisit

| Dimensi | CSO/CHECKPOINT (dihapus `208a560`) | Memo (plan ini) |
| :--- | :--- | :--- |
| Storage | Berkas `CSO-{ROLE}-{ts}.md` di `Sigma/logs/` | Entri di `Sigma/messages/index.json`, tipe `MEMO` |
| Perintah | `sigma cso new` (perintah tersendiri) | `sigma memo write/list/read` (di atas mailbox) |
| Role mode | `CHECKPOINT` sebagai mode transient + `CSO Handler` sebagai role | Tidak ada role/mode baru |
| Template | 140 baris, tabel metadata, "Authority Level" | ~15 baris, 4 seksi pointer |
| Tujuan | Snapshot state kognitif + handoff formal | Brief operasional — pointer, bukan snapshot |
| Kuota / batas | Tidak ada | 5 unread per role, forcing function |
| Otoritas | "Context Only" tapi dilacak di registry | Informasional murni, non-governance |

Karena ini plan Professional Mode, tidak ada supersede governance formal terhadap `PLAN-EVAL-05`. **Kalau** Director menjalankan ini lewat DIR-INTENT (§8), intent itu harus menyebut `PLAN-EVAL-05` dan menegaskan memo bukan pembatalan keputusan penghapusan CSO — melainkan mekanisme berbeda untuk kebutuhan yang tersisa.

---

## 8. Jalur governance (kalau Director memilih itu)

Fitur ini menyentuh framework Sigma: perintah CLI baru, tipe pesan baru, dua skill baru, perubahan bootstrap, perubahan operation registry. Kalau digarap lewat governance, bukan Professional Mode langsung:

1. Director aktifkan ARC di sesi terpisah.
2. ARC susun DIR-INTENT: objective (kanal memo antar-sesi role-sendiri), scope (§4.1–4.2), constraint (§2 prinsip kunci), acknowledgement `PLAN-EVAL-05`.
3. Ratify → FMN-PLAN (work order + test contract, bahan dari §4.3 dan §5) → lock.
4. DEV-EXEC implementasi per fase §... eh, per fase governance.

Plan ini (`PLAN-IMPL-*`) tetap jadi dokumen referensi teknis apa pun jalurnya.

---

## 9. Keputusan Director (2026-09-12)

Semua pertanyaan yang sebelumnya terbuka di Revisi 1 sudah diputuskan Director pada 2026-09-12. Sudah tercermin di §3 dan §5; dicatat di sini untuk jejak audit, bukan lagi "terbuka".

1. **Nama config key**: `memo-limit` (CLI) / `mailbox.memo_unread_limit` (JSON). **Terkunci.**
2. **Urutan `sigma memo list`**: terlama dulu — konsisten dengan `selectSurplusRead` (sort ascending, buang surplus tertua lebih dulu); memo lama paling mendesak dibersihkan. **Terkunci.**
3. **`sigma memo write` tanpa chain aktif**: diizinkan; baris chain = `(unresolved — no active chain)`, dan `--ref GENERAL` dipakai eksplisit untuk kasus ini. **Terkunci.**
4. **Banner pasif lintas semua command write-class** (surfacing lapis 2 versi kuat): ditunda, digarap terpisah — tidak masuk plan ini. **Terkunci.**
5. **Instruksi "cek memo di awal sesi" di role rules**: ditambahkan sebagai anjuran (bukan gate) di `Sigma/rules/{ARC,FMN,DEV,AUD}-RULE.md`, dieksekusi di Fase 7 (§10). **Terkunci.**
6. **Subject default**: `(memo)` tetap opsional sebagai fallback; kalau `--subject` tidak diberikan, auto-terisi dari `--topic` (poin 8). **Terkunci.**
7. **Sigma Artifact Reference** (tambahan Director, di luar 6 poin Revisi 1): flag wajib `--ref <INTENT-vN|PLAN-vN|EXEC-vN|GENERAL>`, disimpan ke field `related_artifact` yang sudah ada di skema `MessageEntry` — tidak ada field baru. **Terkunci.** Detail: §3, §5.1, §5.4.
8. **Topik** (tambahan Director): flag wajib `--topic <satu kalimat>`, non-empty, auto-isi `--subject` bila kosong. **Terkunci.** Detail: §3, §5.1, §5.4.
9. **Checkpoint review draft skill** (tambahan Director): `/write-memo` + `/read-memo` ditulis dulu hanya untuk target `claude_code`, lalu implementasi **pause** menunggu feedback Director — replikasi ke target lain dan Fase 7 tidak dimulai sebelum draft ini disetujui. **Terkunci.** Detail: §6.4, §10.
10. **Bahasa isi memo** (hasil review checkpoint, 2026-09-12): seluruh isi memo — label CLI-generated (`Chain / Phase / Version`, `Topic`) maupun 4 seksi naratif yang ditulis skill (`Context`/`Reorientation — Read`/`Next Actions`/`Blocked — Do Not Proceed Until`) — ditulis dalam Bahasa Inggris, mengikuti kebiasaan "Sigma docs must be English". Frasa aktivasi yang diucapkan Director ke skill `/write-memo`/`/read-memo` tetap boleh menyesuaikan bahasa interaksi sesi yang sedang aktif (Indonesia atau Inggris). **Terkunci.** Detail: §5.4, `write-memo.md`, `MEMO-TEMPLATE.md`.
11. **Memo menandakan sesi akan diakhiri** (hasil review checkpoint, 2026-09-12): menulis memo selalu diasumsikan Director ingin segera mengakhiri sesi berjalan dan beralih ke sesi baru, agar role AI yang sama di sesi baru dapat melanjutkan diskusi/pekerjaan tertunda — biasanya untuk menghindari percakapan yang terlalu panjang atau batas konteks AI. Setelah memo ditulis, sesi berjalan **disarankan tidak dilanjutkan**. **Terkunci.** Detail: `write-memo.md` §"Assumption: Writing A Memo Signals The Session Is Ending".
12. **Memo tetap ringkas, detail pindah ke `Sigma/notes/`** (hasil review checkpoint, 2026-09-12): kalau sebuah informasi butuh penjelasan detail, AI role tidak menuliskannya di badan memo — cek dulu apakah sudah ada file yang bisa dirujuk (DEV-EXEC, artifact lain, atau file `Sigma/notes/` yang sudah ada); kalau belum ada, buat file `.md` baru di `Sigma/notes/` **tanpa perlu approval Director** (bukan artifact governance, sama seperti penulisan memo itu sendiri), lalu arahkan dari "Reorientation — Read". **Terkunci.** Detail: `write-memo.md` §"Keeping Memos Brief".

13. **Anjuran "cek memo di awal sesi" (§9 poin 5) — pengecualian AUD** (diputuskan Director 2026-09-12 saat eksekusi Fase 7): anjuran ditambahkan ke `Sigma/rules/{ARC,FMN,DEV}-RULE.md` sebagai klausa yang mengecualikan `sigma memo list` dari pembatasan baca-default masing-masing role (memo = catatan kontinuitas milik role sendiri, bukan governance state/historical artifact). **AUD sengaja tidak disentuh** — `AUD Exception` di `CLAUDE.md` root project melarang AUD memanggil CLI/MCP apa pun tanpa otorisasi eksplisit Director, dan itu aturan project-wide yang tidak diubah lewat plan ini. **Terkunci.**

Tidak ada pertanyaan terbuka lagi di dokumen ini. Eksekusi Fase 1–7 selesai — lihat §10.

---

## 10. Fase implementasi (usulan)

| Fase | Isi | Bergantung pada |
| :--- | :--- | :--- |
| **1 — Tipe & storage primitives** ✅ | `VALID_MESSAGE_TYPES += MEMO`; helper `getUnreadMemosForRole`/`countUnreadMemos`; `selectInboxMessages` kecualikan MEMO; `getUnreadForRole` param `excludeMemo`; filename special-case. Test unit primitif. | — |
| **2 — Config kuota** ✅ | `MailboxConfig.memo_unread_limit`, `DEFAULT_MAILBOX`, `resolveMemoLimit`; `sigma config set memo-limit` + tampil di `config show`. Test. | Fase 1 |
| **3 — `sigma memo` command group** ✅ | `src/commands/memo.ts` (`write`/`list`/`read`), registrasi di `cli.ts`, baris chain otomatis via `readActiveChain`. Test `test/memo.test.ts` poin 1-16. | Fase 1-2 |
| **4 — Send gate + inbox + bootstrap surfacing** ✅ | `send.ts` pakai `excludeMemo: true`; `inbox.ts` baris penunjuk (Bahasa Inggris); `session.ts` baris memo per role (excludeMemo di kedua tampilan Role Inbox); MCP `sigma_get_orientation` juga diperbaiki — field `inbox_unread` kecualikan MEMO, field baru `memo_unread` ditambahkan. Test poin 4, 8 + `test/mcp-tools.test.ts`. | Fase 1, 3 |
| **5 — Auto-sweep regresi** ✅ | Test eksplisit poin 9 (READ memo aging, UNREAD aman). Tidak ada kode baru — perilaku warisan terkonfirmasi benar. | Fase 3 |
| **6 — Template & skill** ✅ | `Sigma/templates/MEMO-TEMPLATE.md`. Skill `/write-memo` + `/read-memo`: draft `claude_code` → checkpoint pause (§6.4) → Director review (isi Bahasa Inggris, aturan brevity+overflow ke `Sigma/notes/`, asumsi session-ending, aktivasi eksplisit-saja untuk read-memo, read-only vs write-class) → disetujui → direplikasi ke `codex` (SKILL.md + agents/openai.yaml, `#write-memo`/`#read-memo`), `reasonix` (copy identik), `antigravity` (`sigma-write-memo`/`sigma-read-memo` + plugin.json); `ROLE_FILES` di `setup.ts` (4 platform); manifest antigravity diverifikasi lewat `sigma setup install --yes` smoke test (9 skills per platform). | Fase 3 |
| **7 — Registry & dokumentasi** ✅ | `SIGMA-OPERATION-REGISTRY.json` (+3 operasi: `memo_write`/`memo_list`/`memo_read`, domain `memo` ditambah ke daftar domain, `total_operations` 56→59). `SIGMA-REGISTRY.json` — entri skill tidak berlaku (registri ini tidak melacak skill sama sekali, cuma "documents"); deskripsi `artifact_templates` diperbarui (11→12 file, sebut MEMO-TEMPLATE.md). `README.md` — baris Command Reference (`memo write/list/read`, `config set memo-limit`) + kalimat "Handoff between sessions". `SIGMA_PROTOCOL.md` §16F baru (Self-Addressed Memo Doctrine). Role rules — anjuran cek memo di `ARC`/`FMN`/`DEV`-RULE.md (§9 poin 13); AUD sengaja dikecualikan. | Fase 3-6, checkpoint §6.4 disetujui |

Fase 5 mendahului tidak ada — ia hanya memverifikasi perilaku warisan sebelum fitur dianggap selesai. Urutan 1→2→3 keras; 4/5/6 bisa paralel setelah 3; 6 berhenti di tengah untuk checkpoint review skill (§6.4); 7 baru mulai setelah checkpoint itu disetujui, dan berjalan terakhir.
