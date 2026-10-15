# PLAN IMPLEMENTASI — Isolasi Artefak Legacy dari Operasi Sigma v2

**Tanggal:** 2026-10-15
**Status:** DIIMPLEMENTASI 2026-10-15 (belum di-commit); suite 90 file / 1454 test lulus. Disetujui Director (2026-10-15): D-1 s.d. D-4 diterima, prinsip diperketat (1.1), dan **note dikecualikan dari lingkup** (D-5/D-7: dibiarkan apa adanya sampai muncul masalah pada penggunaan nyata). Implementasi menyasar mailbox dan memo saja.
**Jenis:** Work order dan test contract
**Batas kewenangan:** Dokumen ini tidak mengaktifkan role Sigma dan tidak meregistrasikan repository sebagai proyek Sigma. Implementasi, commit, push, instalasi global, serta perubahan pada proyek nyata (KLHK, CanopySense, swm_standalone_v2) tidak termasuk dalam rencana ini.

## 1. Tujuan dan prinsip

Prinsip dari Director (2026-10-15):

> Kompatibilitas bertujuan **mempertahankan** berkas yang dibuat sebelum Sigma v2. Operasi Sigma v2 **tidak boleh terkotori** oleh kehadiran berkas lama yang sudah diisolasi. Deteksi dan operasi v2 tidak lagi mendukung keterbacaan berkas yang sengaja diisolasi; berkas itu dibaca manual. Yang tetap ditoleransi dibaca adalah jalur governance Sigma v1 (intent, plan, exec, closure).

Dirumuskan sebagai kontrak yang dapat diuji:

1. **Produsen tunggal.** Hanya operasi migrasi (`doctor --migrate-mailbox`) yang membuat artefak terisolasi. Tidak ada operasi v2 lain yang menulis ke area itu.
2. **Tidak ada konsumen v2.** Tidak ada operasi v2 (listing, check, diagnosis, bootstrap, send, clear, sweep, archive, MCP) yang membaca atau memutasi artefak terisolasi, dan keberadaan, ketiadaan, atau kerusakannya tidak mengubah keluaran maupun status operasi v2.
3. **Tidak terdeteksi, tidak dilaporkan.** Operasi v2 tidak peduli ada, tidak ada, kosong, hilang, atau cacatnya artefak legacy. Tidak ada peringatan, hitungan, atau pengungkapan apa pun tentangnya.
4. **Governance v1 dikecualikan dari isolasi.** Jalur baca governance lama tetap berfungsi sebagaimana adanya.

### 1.1 Penegasan Director (2026-10-15) yang mengubah rencana awal

> Legacy tidak menjadi penghalang apa pun atas cacatnya folder legacy. Apa pun yang terjadi, biarkan tidak terdeteksi dan tidak dilaporkan Sigma, meski berkas legacy hilang. Sigma v2 tidak peduli ada tidaknya legacy. Sigma v2 hanya mengakomodasi proses isolasi berkas v1 ke v2, sebatas itu. Jalur satu-satunya membaca riwayat pesan dan memo lama adalah membaca langsung.

Akibat pada rencana: (a) butir "pengungkapan sebagai hitungan" dan field `legacy_excluded` **dibatalkan**, dan yang sudah diimplementasikan dicabut; (b) baca, arsip, dan reply terhadap ID legacy tidak lagi ditolak dengan pesan path, melainkan diperlakukan seperti ID yang tidak dikenal v2; (c) satu-satunya kode yang boleh menyebut LEGACY adalah proses isolasi (migrasi).

## 2. Baseline terverifikasi

### 2.1 Koreksi terhadap ingatan: note tidak punya folder legacy

- `Implementation/sigmav2_implementation/F06_sigma-notes.md`, keputusan T-17 (6 Oktober, TERKUNCI): "`LEGACY` hanya untuk mailbox."
- Tidak ada referensi `legacy` di `src/services/notesService.ts` maupun `src/commands/notes.ts`.
- Tidak ada folder legacy di `Sigma/notes/` pada KLHK maupun CanopySense. Folder `LEGACY/` hanya ada di `Sigma/messages/<ROLE>/` dan `Sigma/memo/<ROLE>/`.

Jadi area yang benar-benar memiliki folder isolasi adalah **message dan memo** (satu mesin mailbox yang sama). **Note** punya masalah serupa tetapi dengan mekanisme berbeda, lihat 2.3.

### 2.2 Mailbox (message dan memo)

Sebagian sudah dikerjakan pada sesi ini (belum di-commit): `checkMailboxIntegrity` melewati entri dan folder `LEGACY` pada mailbox format 2. Irisan yang sama juga menambahkan field `legacy_excluded` dan baris `LEGACY not checked`; **keduanya bertentangan dengan 1.1 dan harus dicabut** (WP-LEG-04). Jalur yang **masih** menyentuh LEGACY:

| # | Jalur | Lokasi | Perilaku sekarang |
|---|---|---|---|
| L-1 | Validasi membership saat bootstrap/orientasi | `src/session/mailboxView.ts` | `validateEntryMembership` dijalankan untuk **semua** entri termasuk LEGACY pada setiap `session bootstrap`; satu entri rusak membuat `mailbox_status: invalid` |
| L-2 | Pemilihan scope | `src/engine/mailboxContext.ts` (`mailboxScope`, `matchesMailboxScope`) | `--context LEGACY` dan `--all-intents` menampilkan LEGACY |
| L-3 | Baca per ID | `src/services/mailboxService.ts` (`readMailboxEntry`) | `inbox read <id>` / `memo read <id>` membaca berkas LEGACY dan dapat memicu auto-sweep |
| L-4 | Clear / auto-sweep | `mailboxService.ts` (`clearMailbox`), `retentionScope` | LEGACY punya grup retensi sendiri; entri READ dapat diubah menjadi OUTDATED |
| L-5 | Archive per ID | `src/services/inboxArchiveService.ts` | "Archive by ID (all contexts)" dapat memutasi entri LEGACY |
| L-6 | Validasi index saat baca | `src/engine/mailbox.ts` (`validateMailboxIndexData`, `readIndex`) | Seluruh entri, termasuk LEGACY, divalidasi pada setiap baca. Satu entri LEGACY dengan ID atau path ganda, field kosong, status tak valid, atau konteks tak valid membuat `readIndex` **melempar error** sehingga seluruh operasi mailbox v2 berhenti (diverifikasi dengan membaca kode; belum direproduksi) |
| L-7 | Index tunggal bersama | `Sigma/messages/index.json` | KLHK: 374 dari 384 entri adalah LEGACY; setiap `send`/`inbox` mem-parse dan menulis ulang seluruhnya |
| L-8 | Direktori awal proyek baru | `src/commands/project.ts` (sekitar baris 393) | `project start` membuat folder `LEGACY/` kosong untuk setiap role dan jenis, padahal proyek baru tidak punya apa pun untuk diisolasi |
| L-9 | Default konteks | `entryContext` (`mailboxContext.ts`) | Entri tanpa metadata dianggap `LEGACY`; pada format 1 ini berarti **semua** entri |

Catatan L-9: pengecualian LEGACY **tidak boleh** berlaku pada mailbox format 1, karena preflight migrasi bergantung pada pemeriksaan berkas yang hilang. Ini sudah dikunci oleh test pada perbaikan awal.

L-7 juga merupakan akar insiden KLHK 2026-10-15: merge git atas satu `index.json` yang ditulis ulang total oleh migrasi menghilangkan 5 entri.

### 2.3 Note

- Struktur v2: `Sigma/notes/note-list/` (terdaftar), `unregistered-notes/` (karantina), `note-list.md` (katalog turunan), `Sigma/notes-registry.json`.
- F06 §5: tidak ada migrasi otomatis untuk proyek lama; `project sync` tidak menyentuh `Sigma/notes/`.
- Akibat nyata (`sigma notes list`, read-only, diverifikasi 2026-10-15):
  - KLHK: "No notes registered" disusul `[WARNING] 16 non-Markdown file(s) ... update will refuse` dan `[WARNING] 79 Markdown file(s) ... are not registered notes`. Registry dan `note-list.md` belum ada.
  - CanopySense: `[WARNING] 4 Markdown file(s) ... are not registered notes`.
- Peringatan ini permanen dan tidak ada tindakan yang sah dari sisi pengguna, karena `notes update` menolak berjalan selama ada berkas non-Markdown, dan memindahkan berkas non-Markdown secara manual dilarang.
- Ini analog persis dengan masalah mailbox: berkas pra-v2 mengotori keluaran operasi v2.

### 2.4 Governance v1 (yang ditoleransi)

Permukaan kompatibilitas yang ada, **tidak diubah** oleh rencana ini:

- model lifecycle `legacy_lock` (`src/engine/lifecycle.ts`) dan opt-in `doctor --migrate-lifecycle`;
- skema versi `legacy_offset` (`src/engine/numbering.ts`);
- normalisasi state lama `LOCKED`/`INACTIVE` menjadi `RATIFIED` (`src/engine/chain.ts`);
- penanda `historical_legacy` dan `legacy_provenance` (`lifecycleMigration.ts`, `chain.ts`);
- `scripts/migrate-legacy-progress.js` untuk `progress.json` tunggal.

## 3. Keputusan desain yang direkomendasikan

### 3.1 Mailbox: isolasi perilaku (rekomendasi) vs isolasi struktural

| Opsi | Isi | Konsekuensi |
|---|---|---|
| **M2 — isolasi perilaku (direkomendasikan)** | Semua operasi v2 memperlakukan entri/folder `LEGACY` (format 2) sebagai inert: tidak dibaca, divalidasi, dihitung, diubah, atau dilaporkan; hanya diungkapkan sebagai hitungan. Tidak ada perubahan format di disk. | Tidak perlu migrasi data; berlaku langsung untuk 3 proyek nyata. `index.json` tetap memuat entri legacy. Penyebab insiden merge (L-7) tidak hilang. |
| **M3 — isolasi struktural** | Pisahkan entri LEGACY dari `index.json` ke manifest terisolasi (mis. `Sigma/messages/migrations/v2/legacy-index.json`, tak dimodifikasi setelah ditulis, dengan hash). `index.json` hanya memuat entri v2. | "Tidak dibaca" menjadi struktural, bukan filter. Menghilangkan L-6 dan L-7 serta penyebab merge. Tetapi mengubah format on-disk (bump `mailbox_format`), memerlukan migrasi atas 3 proyek, dan rawan tepat pada kegagalan multi-mesin yang baru terjadi. |

**Rekomendasi:** kerjakan M2 sekarang. Tawarkan M3 sebagai fase terpisah hanya bila Director ingin jaminan struktural; M3 memerlukan keputusan dan jendela sinkronisasi multi-mesin sendiri.

### 3.2 Mailbox: perilaku pada M2

0. **Identifikasi legacy:** entri dianggap legacy bila mailbox format 2 dan (konteks `LEGACY` **atau** berkas berada di bawah `.../LEGACY/`). Dengan aturan kedua, entri LEGACY yang cacat sampai kehilangan field konteks pun tetap terisolasi, bukan dianggap kerusakan v2.
1. **Listing:** `--context LEGACY` diperlakukan sebagai konteks yang tidak dikenal v2 (galat validasi bawaan, tanpa penyebutan "legacy"); `--all-intents` tidak mencakup LEGACY (label menjadi "all contexts").
2. **Baca/arsip per ID terhadap entri LEGACY:** diperlakukan sama dengan ID yang tidak dikenal ("Message not found"). Tidak ada penyebutan path, tidak ada mutasi status, tidak ada auto-sweep.
3. **Clear/sweep/retensi dan kuota memo:** LEGACY tidak membentuk grup dan tidak dihitung.
4. **Validasi index (`readIndex`) dan membership (bootstrap):** entri LEGACY dilewati; kerusakannya tidak menggagalkan operasi v2. Integritas struktural LEGACY bukan tanggung jawab operasi v2.
5. **Proyek baru:** `project start` tidak membuat folder `LEGACY/`. Hanya migrasi yang membuatnya.
6. **Reply ke induk LEGACY:** saat ini ditolak dengan "Reply context mismatch" (`send.ts`); diubah menjadi "Reply parent not found", konsisten dengan butir 2.
7. **Format 1 tidak dikecualikan** (lihat L-9). Pengecualian berlaku hanya setelah migrasi selesai.

Cara baca: buka berkas langsung di `Sigma/messages/<ROLE>/LEGACY/` dan `Sigma/memo/<ROLE>/LEGACY/`. Ini satu-satunya jalur; Sigma v2 tidak menyediakan atau menganjurkannya.

### 3.3 Note

| Opsi | Isi | Catatan |
|---|---|---|
| N1 | Tidak ada perubahan | Peringatan permanen tetap ada. |
| **N2 — hanya tampilan (direkomendasikan)** | `sigma notes list` melaporkan berkas belum terdaftar/non-Markdown sebagai satu baris informatif berhitungan (bukan `[WARNING]`); `Sigma/notes/` pra-v2 diperlakukan sebagai area manual. Tidak ada berkas dipindah, tidak ada aturan `update` diubah. | Konsisten dengan F06 §5 dan T-17. |
| N3 | Folder isolasi baru untuk note pra-v2 | **Membuka kembali keputusan TERKUNCI T-17** ("LEGACY hanya untuk mailbox"); hanya atas keputusan Director. Tidak direkomendasikan sekarang. |

`notes update` tetap menolak berkas non-Markdown (aturan terkunci). Itu perilaku mutasi yang disengaja, bukan pelaporan.

### 3.4 Governance v1

Tidak diubah. Tambahkan hanya penjaga regresi agar permukaan kompatibilitas ini tidak membesar diam-diam (lihat WP-LEG-05).

## 4. Ruang lingkup implementasi

### WP-LEG-01 — Kontrak isolasi mailbox

1. Definisikan satu predikat bersama (mis. `isIsolatedLegacy(index, entry)`) yang benar hanya bila `mailbox_format === 2` dan konteks `LEGACY`. Semua jalur L-1 s.d. L-6 memakainya; tidak ada pemeriksaan ad hoc.
2. Terapkan ke L-1 (bootstrap/orientasi), L-6 (validasi index), `checkMailboxIntegrity` (sudah), diagnosis migrasi, tool MCP terkait.
3. Pertahankan semantik format 1.

### WP-LEG-02 — Penutupan konsumen

1. L-2: `--context LEGACY` dianggap konteks tidak dikenal; `--all-intents` tanpa LEGACY.
2. L-3/L-5 dan reply `send`: baca, arsip, dan reply per ID legacy diperlakukan sebagai ID tidak dikenal, tanpa menyebut legacy atau path.
3. L-4: keluarkan LEGACY dari grup clear, auto-sweep, dan kuota memo.
4. L-8: `project start` tidak membuat folder `LEGACY/`.

### WP-LEG-03 — Note (DIBATALKAN)

Dikecualikan atas keputusan Director 2026-10-15. `sigma notes` tidak diubah; peringatan `notes list` pada berkas tak terdaftar dibiarkan sampai masalah nyata muncul saat penggunaan.

### WP-LEG-04 — Pencabutan pengungkapan

1. Cabut field `legacy_excluded` dari hasil `checkMailboxIntegrity` dan payload `sigma_check_mailbox_integrity`, serta baris `LEGACY not checked` pada `inbox check`.
2. Cabut kalimat terkait LEGACY dari deskripsi `inbox_check` di registry dan dari deskripsi tool MCP.
3. Tidak ada pengganti: tidak ada hitungan, peringatan, atau status baru tentang legacy.

### WP-LEG-05 — Penjaga regresi

1. Tes diferensial: fixture identik dengan dan tanpa LEGACY (kosong, berisi, rusak, berkas hilang); keluaran dan state seluruh operasi v2 harus identik.
2. Tes batas statis: referensi konteks `'LEGACY'` di `src/` hanya diperbolehkan pada allowlist modul (migrasi, predikat bersama, pesan penolakan). Pola yang sama dengan penjaga TC-MSG-04.
3. Tes allowlist permukaan governance v1 (2.4) agar tidak bertambah tanpa keputusan.

### WP-LEG-06 — Dokumentasi

1. Panduan operasi: LEGACY dibaca manual; urutan sinkronisasi multi-mesin sebelum `doctor --migrate-mailbox` (pelajaran insiden KLHK).
2. Catat bahwa note tidak punya folder legacy dan alasannya.

## 5. Area kode yang diperkirakan berubah

- `src/engine/mailbox.ts`, `src/engine/mailboxContext.ts`, `src/engine/mailboxMigration.ts` (diagnosis saja)
- `src/session/mailboxView.ts`
- `src/services/mailboxService.ts`, `src/services/inboxArchiveService.ts`
- `src/commands/mailboxShared.ts`, `src/commands/project.ts`, `src/commands/notes.ts`, `src/services/notesService.ts`
- `src/mcp/tools/checkMailboxIntegrity.ts` dan tool orientasi/doctor
- `Sigma/SIGMA-OPERATION-REGISTRY.json` (deskripsi)
- test mailbox, notes, dan penjaga baru

## 6. Kriteria penerimaan

| ID | Kriteria |
|---|---|
| AC-LEG-01 | Keluaran dan state setiap operasi v2 identik dengan atau tanpa artefak LEGACY (kosong, berisi, rusak, berkas hilang, folder tidak ada). |
| AC-LEG-02 | Tidak ada operasi v2 yang membaca isi berkas LEGACY atau mengubah statusnya. |
| AC-LEG-03 | Pada mailbox format 1, tidak ada yang dikecualikan; preflight migrasi tetap mendeteksi berkas hilang. |
| AC-LEG-04 | Baca, arsip, reply per ID dan `--context LEGACY` terhadap legacy diperlakukan sebagai tidak dikenal v2; tidak ada pesan yang menyebut legacy atau path-nya. |
| AC-LEG-05 | Tidak ada keluaran, field, atau peringatan pada operasi v2 yang menyebut keberadaan, ketiadaan, jumlah, atau kerusakan artefak legacy. |
| AC-LEG-06 | `project start` tidak membuat folder LEGACY; migrasi tetap membuatnya. |
| AC-LEG-07 | ~~Perubahan `notes list`~~ Dibatalkan (note di luar lingkup). `sigma notes` tidak berubah. |
| AC-LEG-08 | Permukaan governance v1 (2.4) tidak berubah dan seluruh test governance lama lulus. |
| AC-LEG-09 | Semua test lama dan baru lulus; worktree hanya memuat perubahan yang disetujui. |

## 7. Test contract

| Test | Menutup AC | Metode | Hasil yang diwajibkan |
|---|---|---|---|
| TC-LEG-01 Differential isolation | 01, 02 | Jalankan seluruh operasi v2 read dan mutating pada fixture format 2 dengan varian LEGACY; bandingkan stdout, exit code, hash pohon file. | Identik antar varian. |
| TC-LEG-02 Corrupt legacy | 01 | Entri LEGACY dengan role/tipe/path tidak valid dan berkas hilang. | Operasi v2 tetap berhasil; tidak ada `mailbox_status: invalid`. |
| TC-LEG-03 Format 1 guard | 03 | Mailbox format 1 dengan berkas hilang. | Preflight migrasi gagal seperti sekarang. |
| TC-LEG-04 Unknown to v2 | 04 | `--context LEGACY`, `inbox read <id legacy>`, `inbox archive <id legacy>`, `send --reply-to <id legacy>`. | Hasil sama dengan ID/konteks yang tidak ada; tidak ada mutasi; keluaran tidak menyebut legacy. |
| TC-LEG-05 Sweep/quota | 02 | Banyak entri LEGACY berstatus READ, jalankan `read`/`clear`. | Tidak ada entri LEGACY berubah menjadi OUTDATED; kuota memo tak terpengaruh. |
| TC-LEG-06 Project start | 06 | `project start` pada direktori kosong. | Tidak ada folder `LEGACY/`; migrasi membuatnya. |
| TC-LEG-07 Notes unchanged | 07 | Test notes yang ada. | Lulus tanpa modifikasi. |
| TC-LEG-08 Static boundary | 02, 08 | Pindai `src/` untuk konteks `'LEGACY'` dan identifier governance v1. | Hanya pada allowlist. |
| TC-LEG-09 Regression | 09 | Suite penuh dan audit worktree. | Semua lulus. |

## 8. Urutan eksekusi yang direkomendasikan

1. Tulis TC-LEG-01/02/03 (termasuk varian "folder LEGACY dihapus seluruhnya") dan tunjukkan bahwa sebagian gagal pada kode sekarang (membuktikan jalur L-1 s.d. L-6).
2. Predikat bersama dan penutupan L-1, L-6.
3. Penutupan konsumen (L-2 s.d. L-5), lalu L-8.
4. Note (N2).
5. Pengungkapan, registry, dan MCP.
6. Penjaga statis, dokumentasi, suite penuh, audit worktree.

## 9. Risiko dan stop condition

| Risiko | Mitigasi/stop condition |
|---|---|
| Pengecualian menyembunyikan kerusakan v2 yang nyata. | Hanya format 2 dan hanya entri/berkas yang terbukti legacy (3.2 butir 0); format 1 tidak pernah dikecualikan. Menyembunyikan kerusakan legacy adalah tujuan, bukan risiko. |
| `--context LEGACY` dan baca per ID tidak lagi berfungsi bagi pengguna yang memakainya. | Disengaja (D-1, D-2). Dicatat di panduan operasi sebagai perubahan perilaku. |
| Pengguna kehilangan jalur mencari pesan lama. | Diterima: berkas dibaca langsung. Tidak ada alat bantu cari. |
| Perubahan menyentuh proyek nyata. | Dilarang; semua verifikasi memakai fixture atau salinan sementara. |
| M3 dikerjakan terburu-buru. | Di luar lingkup tanpa keputusan terpisah dan jendela sinkronisasi multi-mesin. |
| Tumpang tindih dengan plan MCP dan plan diagnostic. | Lihat bagian 10. |

## 10. Hubungan dengan plan lain

- **PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY:** payload `sigma_check_mailbox_integrity` sempat memuat `legacy_excluded`; plan ini mencabutnya (WP-LEG-04). Manifest MCP tidak boleh mengandalkan field tersebut.
- **PLAN-IMPL-SIGMA-REPORT-DIAGNOSTIC-MESSAGE-GIT-BOUNDARY:** TC-MSG-04 (guard tool mailbox) tidak terpengaruh. Check A6/C pada `sigma-test` memakai `inbox check`; perilaku barunya sesuai.
- Perbaikan awal `checkMailboxIntegrity` (sesi 2026-10-15) adalah irisan pertama dari WP-LEG-01 dan sudah memiliki test.
- Keputusan Director: commit, push, dan instalasi global menunggu implementasi plan yang berjalan. Dengan plan ini, itu kini mencakup **tiga** plan; pemisahan commit diserahkan kepada Director.

## 11. Di luar ruang lingkup

- M3 (manifest legacy terpisah dari `index.json`) tanpa keputusan terpisah.
- Memindahkan, mengarsipkan, atau menghapus berkas LEGACY yang ada di proyek nyata (termasuk 374 berkas di KLHK).
- Mengubah aturan `notes update` yang terkunci (T-17) atau memperkenalkan folder legacy untuk note (N3).
- Desain rinci message/memo (tetap deferred, lihat plan diagnostic WP-MSG-02).
- Perubahan pada jalur governance v1.
- Commit, push, instalasi global, dan registrasi repository ini sebagai proyek Sigma.

## 12. Keputusan Director yang diperlukan sebelum implementasi

| ID | Keputusan | Rekomendasi |
|---|---|---|
| D-1 | Apakah `--context LEGACY` dan `--all-intents` yang mencakup LEGACY dihapus (operasi v2 tidak lagi membaca LEGACY sama sekali)? | **DITERIMA.** Berkas dibaca langsung. |
| D-2 | Perlakuan `inbox read <id>`/`memo read <id>` terhadap entri LEGACY. | **DITERIMA, lalu diperketat oleh 1.1:** diperlakukan sebagai ID tidak dikenal, tanpa pesan path (menggantikan usulan "ditolak dengan pesan path"). |
| D-3 | Apakah isolasi mailbox dikerjakan sebagai M2 (perilaku) sekarang, dengan M3 ditunda? | **DITERIMA: M2.** M3 hanya bila Director meminta jaminan struktural. |
| D-4 | Apakah `project start` berhenti membuat folder `LEGACY/` kosong? | **DITERIMA.** |
| D-5 | Untuk note: N2 (hanya tampilan), N1, atau N3 (membuka T-17)? | **DIUBAH Director: N1.** Note dikecualikan sepenuhnya; tidak ada perubahan. |
| D-6 | Apakah ingatan bahwa note punya folder legacy dikoreksi sesuai 2.1 (tidak ada, T-17)? | Informasi, bukan keputusan; tidak ada tanggapan Director sehingga dianggap tidak ada sumber lain. |
| D-7 | Berkas note tak terdaftar: pertahankan satu baris informatif atau tidak dilaporkan? | **DITUTUP Director: note tidak disentuh sama sekali.** |

## 13. Hasil implementasi (2026-10-15)

- Predikat tunggal `isIsolatedLegacy` / `isLegacyPath` di `src/engine/mailboxContext.ts`; satu-satunya modul lain yang boleh menyebut `LEGACY` adalah `mailboxMigration.ts` dan teks bantuan `doctor` (dijaga TC-LEG-08).
- Jalur yang ditutup: validasi index (`readIndex`/`writeIndex`), **`assertMailboxMutable`** (jalur kesembilan yang tidak ada pada daftar awal §2.2: gerbang semua operasi mailbox yang menulis dan memvalidasi tiap entri), `checkMailboxIntegrity`, bootstrap/orientasi, pemilihan scope (`matchesMailboxScope`), baca/arsip/reply per ID, clear/sweep, opsi `--context LEGACY`.
- `project start` hanya membuat folder `GENERAL`.
- Dicabut: field `legacy_excluded`, baris `LEGACY not checked`, notice `[LEGACY]` pada `inbox read`.
- Dokumentasi: README dan lima berkas `read-memo` (selector `--context GENERAL|LEGACY|vN.minor` dan kalimat tentang `LEGACY READ`). Kalimat "never target LEGACY for a new write" pada ~33 berkas rule/skill lain tetap benar dan **tidak diubah**.
- Note tidak disentuh (D-5/D-7).
- Terverifikasi pada salinan data KLHK dengan folder LEGACY dihapus dan 40 entri LEGACY dirusak ditambah ID ganda: `inbox check` 0 warning/0 failure, listing normal, bootstrap tidak menyebut legacy mailbox.
- Salinan terpasang (global) dan salinan proyek belum diperbarui; menunggu tahap instalasi.
