# PLAN-IMPL — Sigma Memo (Operational Brief)

**Sumber**: Diskusi sesi ini (2026-09-02) antara Director dan Claude (Professional Mode). Bermula dari rencana menghidupkan kembali "checkpoint" yang dulu dihapus, lalu berkembang jadi mekanisme baru bernama **memo** dengan pendekatan berbeda.
**Tanggal**: 2026-09-02 · **Revisi 1**
**Status**: **DRAFT — belum disetujui.** Belum ada baris kode ditulis.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma. Kalau Director memutuskan ini digarap lewat jalur governance, plan ini jadi bahan masuk untuk DIR-INTENT baru (lihat §8).
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
| **Field wajib** | Dilewati untuk memo: `action = FYI`, `related_artifact = N/A`, tanpa seksi "Action Required" di markdown. |
| **Skill** | Dua skill terpisah: `/write-memo` dan `/read-memo`. Alasan pemisahan di §6. |
| **Template** | 4 seksi naratif + header. Baris "Chain / fase / versi" diisi otomatis oleh CLI dari `progress.json`. Template di §5.4. |
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
| `src/commands/config.ts` | Tambah subcommand `sigma config set memo-limit <n>` (menulis `mailbox.memo_unread_limit`). Tambah barisnya di output `sigma config get`. |
| `src/commands/memo.ts` | **Berkas baru.** Command group `sigma memo` — detail di §5. |
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
12. Baris "Chain / fase / versi" terisi benar dari chain aktif; degradasi anggun ke `(unresolved)` saat tidak ada chain.

Sweep berkas test lain yang meng-assert jumlah `VALID_MESSAGE_TYPES` atau mengiterasi tipe pesan.

---

## 5. Desain detail

### 5.1 `sigma memo write`

```
sigma memo write --role <role> (--message <body> | --message-file <path>) [--subject <s>]
```

- `--role` wajib. Salah satu dari `arc|fmn|dev|aud` (pakai `MESSAGING_ROLES`). Konsisten dengan `sigma inbox --role`, bukan `sigma send --from`, karena secara mental ini "memo milik role tersebut".
- `--to` **ditolak** dengan error eksplisit: *"sigma memo does not take --to — a memo is always to your own role. Use sigma send for cross-role messages."*
- Body via `--message` (satu baris) atau `--message-file` (multi-baris, preserve newline) — sama seperti `sigma send`.
- `--subject` opsional, default `(memo)`.
- **Langkah eksekusi:**
  1. `findProjectRoot()`, `readIndex()`.
  2. `countUnreadMemos(index, role)` ≥ `resolveMemoLimit(config)` (dan limit > 0) → **tolak**, cetak daftar memo unread + `sigma memo read <id>`.
  3. `resolveMemoLimit(config) === 0` → tolak: *"Memo is disabled (mailbox.memo_unread_limit = 0). Enable with: sigma config set memo-limit 5"*.
  4. Resolve baris chain otomatis: `readActiveChain(projectRoot)` → `chainVersion`, `lifecycle_state`, `intent.version/state`, `plan.active_version/active_state`, `exec.active_version/active_state`. Susun jadi satu baris. Kalau `readActiveChain` melempar (tidak ada chain) → `(unresolved — no active chain)`.
  5. Bangun markdown: header metadata + baris chain + body caller (apa adanya, caller/skill yang menyusun 4 seksi).
  6. `generateMessageId(role, role, ts, suffix)` (signatur `(from, to, ts, suffix)`), filename via `generateFilename('MEMO', role, role, ts, suffix)` dengan special-case agar keluar `MEMO-<ROLE>-<ts>-<suffix>.md` (tanpa role ganda).
  7. Tulis file ke `Sigma/messages/<ROLE>/`, push entri ke index, `writeIndex()`.
  8. Cetak konfirmasi + `slot terpakai: <n+1>/<limit>`.

### 5.2 `sigma memo list`

```
sigma memo list --role <role> [--all]
```

- Default: hanya UNREAD memo untuk role, terurut `created_at` (terbaru dulu atau terlama dulu — **keputusan terbuka §9**).
- `--all`: sertakan READ + OUTDATED.
- Header output menampilkan status kuota: `Memo — DEV — 2/5 slot terpakai`.
- Tiap entri: id, subject, created_at, cuplikan baris pertama body.
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

Header + baris chain digenerate CLI. Empat seksi naratif diisi oleh caller (`/write-memo`):

```
## Memo — <ROLE> — <YYYY-MM-DD HH:MM>

**Chain / fase / versi:** <chain-vN> | <DESIGN|PLAN|EXEC|CLOSE> | INTENT <vN> (<STATE>) · PLAN <vN> (<STATE>) · EXEC <vN> (<STATE>)

**Konteks (hanya yang belum ada di artifact):**
<2-3 kalimat — arah diskusi sesi ini, alasan berhenti. Bukan ringkasan isi artifact.>

**Orientasi ulang — baca:**
- <ref artifact + section, mis. exec-evidence 1.2>
- <ref inbox msg, mis. inbox msg abc123 dari FMN>

**Aksi berikutnya:**
- <instruksi operasional konkret>
- hindari: <jalur yang sudah dicoba dan gagal, plus alasan singkat>

**Blocked — jangan lanjut sampai:**
- <keputusan Director soal X, atau balasan role Y atas msg Z>
```

Seksi "Konteks" dan "Blocked" boleh kosong (tulis `—`). "Orientasi ulang" dan "Aksi berikutnya" wajib ada isi — itu inti memo.

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

## 9. Pertanyaan terbuka

Tidak ada yang mem-block penyusunan; semua butuh keputusan Director sebelum implementasi mulai.

1. **Nama config key**: `memo-limit` (CLI) → `mailbox.memo_unread_limit` (JSON). Setuju? Atau `memo-max` / `mailbox.memo_max_unread`?
2. **Urutan `sigma memo list`**: terbaru dulu (konsisten dengan naluri "yang paling relevan di atas") atau terlama dulu (konsisten dengan `selectSurplusRead` yang sort ascending)? Rekomendasi: terlama dulu — memo lama justru yang paling mendesak dibersihkan.
3. **`sigma memo write` saat tidak ada chain aktif**: tetap izinkan (baris chain = `(unresolved)`) atau tolak? Rekomendasi: izinkan — kerja pra-INTENT juga butuh memo.
4. **Banner pasif (surfacing lapis 2 versi kuat)**: garap terpisah nanti, atau masukkan versi "cek semua role" ke plan ini? Rekomendasi: terpisah — jangan gandakan scope.
5. **`/read-memo` di role rules**: tambahkan instruksi "cek memo di awal sesi" ke `Sigma/rules/{ARC,FMN,DEV,AUD}-RULE.md`, atau biarkan murni Director-triggered? Rekomendasi: tambahkan sebagai anjuran (bukan gate) di role rules.
6. **Subject default**: `(memo)` cukup, atau minta caller selalu isi `--subject`?

---

## 10. Fase implementasi (usulan)

| Fase | Isi | Bergantung pada |
| :--- | :--- | :--- |
| **1 — Tipe & storage primitives** | `VALID_MESSAGE_TYPES += MEMO`; helper `getUnreadMemosForRole`/`countUnreadMemos`; `selectInboxMessages` kecualikan MEMO; `getUnreadForRole` param `excludeMemo`; filename special-case. Test unit primitif. | — |
| **2 — Config kuota** | `MailboxConfig.memo_unread_limit`, `DEFAULT_MAILBOX`, `resolveMemoLimit`; `sigma config set memo-limit` + tampil di `config get`. Test. | Fase 1 |
| **3 — `sigma memo` command group** | `src/commands/memo.ts` (`write`/`list`/`read`), registrasi di `cli.ts`, baris chain otomatis via `readActiveChain`. Test `test/memo.test.ts` poin 1-7, 11-12. | Fase 1-2 |
| **4 — Send gate + inbox + bootstrap surfacing** | `send.ts` pakai `excludeMemo: true`; `inbox.ts` baris penunjuk; `session.ts` baris memo per role. Test poin 4, 8. | Fase 1, 3 |
| **5 — Auto-sweep regresi** | Test eksplisit poin 9 (READ memo aging, UNREAD aman). Tidak ada kode baru diharapkan — konfirmasi perilaku warisan benar. | Fase 3 |
| **6 — Template & skill** | `Sigma/templates/MEMO-TEMPLATE.md`; skill `/write-memo` + `/read-memo` di `setup/targets/*`; `ROLE_FILES` di `setup.ts`; manifest antigravity. | Fase 3 |
| **7 — Registry & dokumentasi** | `SIGMA-OPERATION-REGISTRY.json`, `SIGMA-REGISTRY.json`, `README.md` Command Reference + handoff, `SIGMA_PROTOCOL.md`, role rules (bila §9 poin 5 disetujui). | Fase 3-6 |

Fase 5 mendahului tidak ada — ia hanya memverifikasi perilaku warisan sebelum fitur dianggap selesai. Urutan 1→2→3 keras; 4/5/6 bisa paralel setelah 3; 7 terakhir.
