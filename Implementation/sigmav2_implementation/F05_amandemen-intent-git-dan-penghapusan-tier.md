# F05 - Amandemen INTENT melalui Git dan penghapusan tier

Tanggal: 8 Oktober 2026
Status: O-1 sampai O-13 DISETUJUI Director 8 Oktober 2026 sesuai kolom rekomendasi ("semua disetujui mengikuti rekomendasi"); eksekusi berjalan sesuai bagian 10. Hasil eksekusi dicatat di bagian 11.
Baseline: branch `main`; `git status` awal sesi bersih dengan HEAD `b8050f8`. Pemeriksaan Git langsung (status, log, konfigurasi `core.autocrlf`) tidak dapat diulang pada sesi ini karena pemeriksa izin shell gagal; bagian yang bergantung pada perilaku Git ditandai belum diuji.
Sifat dokumen: catatan pengembangan master Sigma, bukan artefak governance proyek terdaftar. Otorisasi penyusunan: instruksi Director 8 Oktober 2026 ("kita lanjutkan ke f05").

Label isi: **TERKUNCI** (keputusan Director), **TERVERIFIKASI** (diperiksa pada kode/dokumen saat ini), **REKOMENDASI** (asisten, belum keputusan), **TERBUKA** (menunggu keputusan), **BELUM DIUJI** (klaim dari dokumentasi/pengetahuan, perlu uji fixture).

## 1. Tujuan dan batas fokus

Mengganti alur `sigma intent amendment` yang sekarang (edit di tempat, render tabel ke dokumen, sertifikasi hash) dengan alur amandemen tanpa tier yang memakai Git lokal sebagai sumber riwayat isi: baseline sah, diff yang ditinjau, commit hasil, dan tag lokal. Sigma menyimpan metadata dan hash, bukan salinan dokumen. Menyelesaikan sisa penghapusan tier yang menjadi tanggung jawab F05. Menutup T-10 dan T-11.

Dalam cakupan:
- Preflight baseline Git (INTENT dilacak, bersih, cocok dengan acuan tersertifikasi).
- Urutan persetujuan, pencatatan, sertifikasi, commit, tag, dan penanganan kegagalan parsial (T-10).
- Pembentukan baseline untuk chain yang sudah RATIFIED, termasuk chain dengan `UNCERTIFIED_EDIT` (K5).
- Pemindahan riwayat amandemen keluar dari dokumen INTENT.
- Paritas CLI dan MCP untuk jalur yang diubah; registry terbatas.
- Distribusi tag pada alur push manual Director (T-11).
- ARC-RULE batch B (butir review 6 dan 8), FMN-PLAN template dan FMN-RULE bila perlu, daftar sisa tier.

Di luar fokus: push, pull, stage, atau commit otomatis oleh Sigma; perubahan Constitution (F15); perubahan Protocol (hanya daftar butir, Protocol dikerjakan terakhir); `SCHEMA_VERSION` dan versi paket; sinkronisasi ke `~/.sigma`, skill terpasang, dan proyek (F09); migrasi proyek nyata; `sigma intent recertify` (lihat O-12); penilaian semantik atas isi amandemen.

## 2. Keputusan Director yang sudah terkunci

Sumber: [diskusi evaluasi](../../Discussion/Evaluation-06102026/diskusi_rencana_perubahan_sigma_v2.md) bagian "Arah amandemen INTENT dan riwayat melalui Git" (baris 476-519) dan Strategy Action 8 (baris 695); [F00](F00_indeks-dan-register.md) bagian 7 (butir review ARC-RULE 1-9, INTENT template 1-5).

1. Tier Sovereign/Operationalization dihapus total; seluruh substansi INTENT boleh diamandemen. INTENT lama dan tag historisnya tetap ada dan boleh diabaikan.
2. Hanya ARC yang mengaktifkan amandemen, atas instruksi eksplisit Director secara langsung. Pesan atau permintaan role AI lain bukan pemicu maupun otorisasi, termasuk bila pesan menyatakan Director telah memberi otoritas. ARC wajib meminta konfirmasi ulang otoritas kepada Director.
3. Alur otoritas: instruksi langsung Director mengotorisasi penyusunan; ARC menampilkan perubahan konkret sebelum-sesudah dan dampaknya pada pekerjaan; konfirmasi akhir Director mengotorisasi penerapan isi yang sudah ditinjau. Review menyatakan apakah tujuan atau hasil inti berubah; keterangan itu informatif, bukan tier atau gate.
4. Amandemen mewajibkan peninjauan pasangan PLAN yang masih APPROVED dan tidak mengubah pasangan LOCKED secara retroaktif (D-10c; F04 TERKUNCI butir 6). PLAN menunjuk revisi INTENT yang dipakai.
5. Git lokal adalah prasyarat alur amandemen; proyek tanpa Git lokal tetap sah untuk penggunaan Sigma lain tetapi tidak dapat menjalankan amandemen (F00 bagian 7, ARC-RULE butir 5). Tidak ada backup dokumen terpisah.
6. Baseline ratifikasi dan setiap hasil amandemen yang disahkan tersedia sebagai commit dengan tag lokal. Contoh nama: `sigma/intent-v2-amd-003`. Tag dibuat terhadap commit eksplisit yang memuat isi final yang sudah ditinjau dan disahkan; Sigma tidak memindahkan atau menimpa tag yang sudah tercatat.
7. Metadata Sigma mengikat chain, ID amandemen, baseline sebelum perubahan, commit/tag hasil, dan SHA-256 isi tersertifikasi.
8. Push dilakukan Director sendiri; Sigma tidak push. Commit lokal atas arahan Director dengan pelaksanaan dibantu AI; pemilihan berkas dan waktu pencatatan tetap di Director. Sigma memverifikasi dan membuat tag, tanpa stage/commit otomatis.
9. Jika commit belum dibuat atau isinya tidak cocok, Sigma melaporkan langkah yang belum selesai dan tidak menerima HEAD secara sembarang. Pemeriksaan terarah pada INTENT; perubahan berkas lain tidak otomatis menghalangi amandemen.
10. ARC-RULE (butir review 6, 8): sebelum amandemen dan sebelum Petition, intent versi terbaru sudah di-commit dan INTENT lokal sama dengan yang ada di Git; setelah amandemen, ARC meminta konfirmasi persetujuan dan pengecekan perubahan. Batch B mengikuti penutupan T-10/T-11.
11. Baris "Amandemen terakhir" pada header INTENT dan nasib `AMENDMENT_HISTORY` pada schema 5 ditunda ke F05 (E01 E-3, E-5).
12. Kosakata status "Work Outside Intent" pada PLAN (`NOTED`, `AMENDMENT_REQUESTED`, `AMENDMENT_RATIFIED`) dirancang bersama F05 (E02 A-5).

## 3. Peta dampak kode dan dokumen (TERVERIFIKASI pada HEAD b8050f8)

Nomor baris bukan kontrak permanen; verifikasi ulang saat implementasi.

| Lokasi | Perilaku sekarang | Dampak F05 |
|---|---|---|
| `src/services/intentAmendmentService.ts:56-89` | Urutan: `recordIntentAmendment` (mutasi in-memory) → `renderAmendmentHistory` (menulis dokumen) → `certifyIntentDoc` (hash dokumen yang sudah dirender) → `writeChain` → append JSONL ke `Sigma/logs/intent_amendment.log`. Tidak ada Git, tidak ada transaksi journal, tidak ada lease | Diganti: verifikasi Git, tidak menulis dokumen, tag sebelum tulis chain, transaksi journal dan lease seperti F04 |
| `src/engine/chain.ts:210-220` | `AmendmentEntry`: `id`, `created_at`, `change`, `director_approved_at` (selalu sama dengan `created_at`) | Field baru opsional (bagian 4.4); entri lama tetap valid |
| `src/engine/chain.ts:222-247` | `SingleIntentState` memuat `amendments`, `effective_amendment`, `certified_doc_sha256`, `revision`, `certified_at` | Tambah blok baseline Git (opsional, tanpa `SCHEMA_VERSION`) |
| `src/engine/chain.ts:1268-1276` | `certifyIntentDoc`: hash byte mentah file, `revision += 1`, tandai semua PLAN APPROVED `needs_intent_review = true`, hitung ulang Gate 2. Dipakai ratify dan amandemen | Dipertahankan; dipanggil sekali pada titik efektif. Perilaku F04 tidak berubah |
| `src/engine/chain.ts:1283-1289`, `1302-1327` | `isIntentDocUncertified` membandingkan hash byte; `recordIntentAmendment` menolak non-RATIFIED, `--change` kosong, tanda pipa atau newline (karena tabel Markdown) | Larangan tanda pipa/newline hanya relevan bila tabel di dokumen masih dirender; ditinjau di O-5 |
| `src/utils/amendmentHistory.ts:13-67` | Menyuntikkan skeleton `## 14. Amendment History` ke dokumen lama dan menulis ulang blok render | Dihentikan untuk amandemen baru (O-5); tabel lama pada dokumen lama dibiarkan sebagai catatan historis |
| `src/commands/intent.ts:170-186` | CLI `amendment --change` tanpa `--director-confirm`; mencetak "Section 14 ... re-rendered" | Subperintah baru, `--commit`, `--director-confirm`, teks keluaran diganti |
| `src/commands/intent.ts:281-299`, `322` | `check` dan `status` menampilkan `UNCERTIFIED_EDIT` dengan petunjuk `intent amendment --change` | Petunjuk diarahkan ke `amendment preview`; tampilkan status baseline Git |
| `src/mcp/control/tools/prepareIntentAmendment.ts:63-129` | Ticket mengikat hash dokumen saat prepare (`target.sha256`), hash argumen `change`; `effects` menyebut "after Section 14 re-render" | Ticket mengikat juga baseline commit, hash diff, `purpose_changed`; teks `effects` diganti |
| `src/mcp/control/tools/commitIntentAmendment.ts:79-163` | Validasi tiket/approval/state revision/hash dokumen, lalu `recordIntentAmendmentUseCase`; tanpa Git | Tambah argumen `commit`; verifikasi Git sebelum mutasi |
| `src/mcp/policy.ts:58` | `intent_amendment: 'W2'` | Tetap W2; operasi baseline Git tidak admissible via MCP (O-8) |
| `src/commands/project.ts:95-148` | `prepareLocalGit` memakai `git rev-parse --show-toplevel` (akar repo dapat berada di atas akar proyek); init Git hanya opsional | Preflight wajib menghitung path INTENT relatif terhadap akar repo, bukan akar proyek |
| `src/commands/git.ts:2-6` | Satu-satunya pemakaian Git di CLI: `execSync` dengan string perintah (read-only) | Tidak dipakai ulang. Modul baru memakai `execFileSync('git', [args])` tanpa shell, pathspec setelah `--` |
| `src/engine/revisions.ts:109-122` | `currentIntent` menolak INTENT non-RATIFIED, tanpa hash tersertifikasi, atau berbeda dari hash tersertifikasi (`UNCERTIFIED_EDIT`); mengembalikan `revision` dan `hash` | Konsumen F04 tidak berubah. Jendela antara commit dan finalisasi otomatis terblokir oleh pemeriksaan ini (bagian 4.3) |
| `src/utils/docCheck.ts:142-144`, `250-255` | `AMENDMENT_HISTORY` opsional di schema 5 "sampai F05" dan di spesifikasi lama | Tetap opsional (dokumen lama); komentar diperbarui; keputusan template di O-5 |
| `Sigma/SIGMA-OPERATION-REGISTRY.json:316-373` | Entri `intent_amendment`: deskripsi memuat "Operationalization only, never Sovereign"; efek menyebut `AmendmentEntry {id, created_at, change, director_approved_at}`; pasca-kondisi "DIR-INTENT re-certified" | Perbarui entri ini dan tambah entri operasi baru (registry terbatas, O-8) |
| `Sigma/rules/ARC-RULE.md:477-531`, `640-642` | Bagian Amendment Request (batch A sudah: persetujuan langsung, daftar perubahan, peringatan divergensi) dan CLI Operation Policy | Batch B: preflight baseline, tinjau diff, alur tag, Petition pada intent versi terbaru (bagian 6) |
| `Sigma/templates/DIR-INTENT-TEMPLATE.md:235-241` | Section `Amendment History` ditulis otomatis, dengan penanda render | O-5 |
| `Sigma/templates/FMN-PLAN-TEMPLATE.md:114`; `Sigma/rules/FMN-RULE.md:354-355` | Kosakata `NOTED`/`AMENDMENT_REQUESTED`/`AMENDMENT_RATIFIED`, merujuk `AMD-NNN` | O-9 |

**Sisa model tier (TERVERIFIKASI; "belum ditemukan" selain yang tercantum, bukan "tidak ada").** Pencarian `Sovereign|Operationalization|Challengeable` pada `Sigma/`, `src/`, `setup/`, `README.md`:
- `Sigma/SIGMA_PROTOCOL.md` baris 136, 138, 207, 217-231, 486-498, 588: Intent Core sovereign, tier per item, mekanisme amandemen bertier, tabel batas audit. Ditahan sampai Protocol (daftar tindak lanjut di bagian 8).
- `Sigma/SIGMA-OPERATION-REGISTRY.json:321`: deskripsi `intent amendment`.
- `src/engine/chain.ts:197`: komentar "does not freeze its operationalization". `src/commands/intent.ts:181` dan `src/utils/amendmentHistory.ts`: rujukan "Section 14".
- `Sigma/templates/DIR-INTENT-TEMPLATE.md:122` dan `Sigma/rules/ARC-RULE.md:235`: kosakata "Binding Level: ... Challengeable" pada constraint. Ini bukan tier Intent Core tetapi memakai kata yang sama; lihat O-10.
- Kemunculan lain bukan tier INTENT dan tidak diubah: `SIGMA_CONSTITUTION.md` ("agent sovereignty", "higher-tier authority" untuk hierarki dokumen), `SIGMA-REGISTRY.json` (tier otoritas dokumen), "source tier" Research Mode (ARC-RULE, AUD-RULE, role memory AUD; dipertahankan keputusan Director butir 1), `AUD-RULE.md:848,1047,1326` dan memory AUD ("sovereign Director intent" sebagai tujuan Director, bukan tier; konsisten dengan prinsip tujuan milik Director dan metode dapat diaudit), `DIR-CLOSE-TEMPLATE.md:92` (kata "operationalization" dalam arti biasa; rujukan nomor section usang adalah temuan terpisah dari handoff), fixture dan helper uji untuk INTENT schema 4 (sengaja dipertahankan agar INTENT lama tetap valid).
- Model tier pada AUD-RULE, FMN-RULE, dan ARC-RULE: tidak ditemukan pada pencarian ini (sudah dibersihkan E01, E02, E04). Hasil negatif ini sementara sampai dikonfirmasi pada tahap verifikasi implementasi.

## 4. Spesifikasi perilaku (REKOMENDASI; menunggu keputusan)

### 4.1 Prasyarat dan preflight baseline

Operasi baca-saja `sigma intent baseline check` dan `sigma intent amendment preview` menjalankan pemeriksaan berikut dan melaporkan hasil per butir (tidak berhenti pada kegagalan pertama):

1. Git tersedia di PATH dan `git rev-parse --show-toplevel` dari akar proyek berhasil; kegagalan `safe.directory` atau akses dilaporkan apa adanya.
2. Berkas INTENT dari chain aktif (atau `--v`) terdaftar pada chain, berada di jalur sah (`artifactFile`-style bounded path, sudah ada di F04), memuat penanda identitas F02 yang cocok, dan **dilacak Git** (`git ls-files --error-unmatch -- <path>`), bukan diabaikan oleh `.gitignore`.
3. Baseline tercatat pada chain (bagian 4.4) dan commit baseline ada di repo. Commit yang hilang atau tidak terjangkau dilaporkan; tag baseline yang menunjuk objek berbeda dari catatan dilaporkan sebagai drift, tidak diperbaiki otomatis.
4. Isi INTENT pada commit baseline sama dengan `certified_doc_sha256` (perbandingan dengan normalisasi akhir baris, bagian 7 risiko R-1).
5. Keadaan kerja: tidak ada perubahan staged atau unstaged pada INTENT sebelum ARC mulai menyunting (`git status --porcelain -- <path>`). Perubahan tak tercatat dilaporkan lebih dulu supaya tidak ikut terbawa (keputusan 9 dan 10). Perubahan berkas lain hanya dilaporkan, tidak memblokir.
6. Commit yang menyentuh INTENT sesudah commit baseline tetapi tidak tercatat pada chain dilaporkan sebagai "perubahan di luar alur" (`git log <baseline>..HEAD -- <path>`). Penyelesaiannya adalah amandemen (4.3) atau keputusan Director; Sigma tidak menyimpulkan.

Preflight dipakai ARC untuk dua hal: sebelum mulai menyunting amandemen, dan sebelum Petition (butir review 8).

### 4.2 Peninjauan sebelum persetujuan (`amendment preview`)

Setelah ARC menyunting INTENT di working tree, `preview` menampilkan:
- hasil preflight 4.1 (butir 5 dikecualikan karena perubahan memang diharapkan);
- `git diff <baseline-commit> -- <path>` dan `--stat`, ditambah SHA-256 isi sekarang (hash yang akan disahkan);
- dampak: PLAN APPROVED yang akan ditandai `needs_intent_review`, pasangan LOCKED yang tidak berubah (non-retroaktif), PLAN/EXEC DRAFT yang tercantum sebagai informasi, nomor revisi INTENT saat ini dan yang akan menjadi berikutnya;
- pernyataan `purpose_changed` bila sudah diberikan.

Tidak ada keluaran yang dianggap penilaian semantik. Daftar perubahan dan section terdampak yang wajib disetujui Director (ARC-RULE batch A butir 7) tetap disusun ARC; `preview` menyediakan bukti mekanis, bukan penggantinya.

### 4.3 Urutan efektif (T-10) - dua opsi, rekomendasi B

**Opsi A - catat dulu, commit kemudian.** Persetujuan Director → Sigma mencatat dan mensertifikasi (amandemen efektif) → commit → `complete` membuat tag. Ada jendela "efektif tetapi belum punya acuan Git" yang harus dimodelkan sebagai state tersendiri (`AWAITING_GIT`). Jika isi disunting lagi atau tidak pernah di-commit, isi yang sudah disahkan hanya ada di working tree dan dapat hilang.

**Opsi B - persetujuan isi, commit, lalu satu titik efektif (REKOMENDASI).**
1. ARC menyunting INTENT dan menjalankan `preview`.
2. Director menyetujui isi (hash tertentu) dan daftar perubahan.
3. Isi yang disetujui di-commit (oleh Director atau AI atas arahannya).
4. Perintah amandemen dijalankan dengan `--commit <ref>`. Di dalam satu transaksi dengan lease proyek, Sigma memverifikasi (4.5), membuat tag, lalu menulis chain (entri amandemen, blok baseline baru, `certifyIntentDoc`, log) dan mengonsumsi persetujuan. Amandemen efektif **hanya** di titik ini, dan pada titik ini acuan Git sudah ada.

Alasan B: tidak ada state "efektif tanpa acuan"; setiap kegagalan sebelum langkah 4 meninggalkan keadaan tersertifikasi lama utuh, yang sudah dipahami dan dilindungi oleh `UNCERTIFIED_EDIT` serta `currentIntent` F04. Selama jendela antara commit dan langkah 4, INTENT berbeda dari hash tersertifikasi sehingga persetujuan PLAN/EXEC dan revisi PLAN pada chain itu otomatis ditolak (`revisions.ts:116-117`); itu perilaku yang diinginkan.

Jalur CLI: `sigma intent amendment --change "..." --purpose-changed yes|no --commit <ref> --doc-sha256 <hash dari preview> --director-confirm`. Hash dari `preview` mengikat persetujuan ke isi yang ditinjau. Tanpa `--commit`, perintah berhenti dengan laporan langkah yang belum selesai; tidak ada bentuk lama tanpa Git dan tidak ada flag bypass.

Jalur MCP: `sigma_prepare_intent_amendment` membekukan tiket (hash dokumen, baseline commit, hash diff, `change`, `purpose_changed`); Director menyetujui lewat `sigma control approve` (tidak berubah); `sigma_commit_intent_amendment` menerima argumen `commit`, memverifikasi, membuat tag, lalu menulis. Masa berlaku tiket 30 menit tetap; bila kedaluwarsa karena commit terlambat, prepare diulang (biaya rendah).

**Kegagalan parsial pada langkah 4** (urutan: verifikasi → tag → tulis chain):
| Titik gagal | Keadaan | Pemulihan |
|---|---|---|
| Verifikasi gagal | Tidak ada tulis | Laporan butir yang gagal; ulangi setelah diperbaiki |
| Pembuatan tag gagal | Tidak ada tulis | Laporan; ulangi |
| Tag ada, tulis chain gagal atau crash | Tag ada, chain lama | Jalankan ulang: tag yang sudah ada pada commit yang sama dan lolos verifikasi diadopsi; tag pada commit lain ditolak (tidak pernah dipindahkan atau ditimpa). Journal F04 memulihkan transaksi chain |
| Chain ditulis, tiket/approval belum ditandai konsumsi | Efektif | Idempotensi sama dengan jalur F04 (marker commit) |
Tag yang tidak pernah diikuti entri chain (dibuat lalu operasi dibatalkan) dilaporkan oleh `baseline check` sebagai tag yatim; Sigma tidak menghapusnya.

### 4.4 Metadata (opsional, tanpa `SCHEMA_VERSION`)

Blok baru pada `chain.intent`, mis. `git_baseline`: `commit`, `tag`, `doc_sha256`, `revision`, `provenance` (`ratified_commit` | `amendment` | `imported_current`), `recorded_at`. Entri `AmendmentEntry` bertambah (opsional): `purpose_changed`, `baseline_commit`, `result_commit`, `result_tag`, `doc_sha256`, `diff_stat`. Entri lama tanpa field baru ditampilkan sebagai "tanpa acuan Git (sebelum F05)". Log `intent_amendment.log` memuat field yang sama. ID `AMD-NNN` dipertahankan.

Dokumen INTENT **tidak ditulis** oleh Sigma pada alur amandemen: isi yang ditinjau, di-commit, dan di-hash adalah byte yang sama. Konsekuensi: larangan `|`/newline pada `--change` tidak lagi diperlukan untuk tabel dokumen, tetapi tetap berlaku bila ringkasan ditampilkan pada tabel status/ROADMAP; ditetapkan saat implementasi.

### 4.5 Verifikasi commit hasil

Hanya acuan eksplisit yang diterima (SHA atau ref yang di-resolve ke SHA dan dicetak). Syarat: (a) commit ada dan merupakan keturunan commit baseline; (b) isi INTENT pada commit itu sama dengan isi working tree dan dengan `--doc-sha256`/hash tiket (normalisasi akhir baris pada perbandingan blob); (c) `git status --porcelain -- <path>` bersih; (d) path relatif terhadap akar repo sama dengan path terdaftar. Commit boleh memuat berkas lain. Sigma tidak menjalankan `git add`, `commit`, `checkout`, `reset`, `push`, atau `fetch`; satu-satunya tulis Git adalah `git tag`.

### 4.6 Baseline untuk chain yang sudah RATIFIED

Ratify tidak berubah dan tidak bergantung pada Git (proyek tanpa Git tetap dapat meratifikasi). Baseline dibentuk eksplisit dengan `sigma intent baseline adopt --commit <ref> --director-confirm` (hanya CLI):
- Jalur normal: isi INTENT pada commit itu sama dengan `certified_doc_sha256` dan dengan working tree; Sigma membuat tag `sigma/intent-<chain>-base` dan mencatat `provenance: ratified_commit`.
- Chain dengan `UNCERTIFIED_EDIT` tanpa commit yang cocok dengan hash tersertifikasi (kasus K5): tidak ada baseline yang dapat dipulihkan. Jalur: impor isi saat ini yang sudah ditinjau Director sebagai baseline (`provenance: imported_current`), tanpa menulis delta atau amandemen fiktif, sejalan dengan F04 O-9 (`imported_baseline` untuk PLAN). Tidak berlaku retroaktif.
- Amandemen pertama pada chain tanpa baseline ditolak dengan petunjuk menjalankan `baseline adopt`.

### 4.7 Doctor dan reconstruct

`sigma doctor` melaporkan (baca-saja) drift referensi Git: tag hilang atau menunjuk objek berbeda, commit tidak terjangkau, tag yatim. Tidak ada perbaikan otomatis, tidak ada penyertifikasian ulang. `--reconstruct` tidak menyimpulkan referensi Git dari tag; chain yang direkonstruksi tanpa blok baseline diperlakukan sebagai tanpa baseline.

### 4.8 Distribusi tag (T-11)

Sigma tidak menghubungi remote dan tidak mengetahui apakah tag sudah di-push. Setelah amandemen/baseline berhasil, keluaran mencetak nama tag dan pengingat bahwa push cabang biasa tidak mengirim tag. Rekomendasi tag **annotated** (O-3): `git push --follow-tags` hanya mengirim tag annotated yang menunjuk commit yang ikut terkirim (BELUM DIUJI pada fixture dengan remote bare lokal; berasal dari dokumentasi Git Push yang dirujuk diskusi). Tag lightweight memerlukan `git push origin <tag>` eksplisit. Panduan ini masuk ARC-RULE/CLI Operation Policy batch B sebagai teks, bukan kewajiban perintah.

## 5. Kompatibilitas dan migrasi

- Entri amandemen lama dan tabel `Amendment History` pada dokumen lama tidak diubah. Tabel itu tidak lagi diperbarui; ia menjadi catatan historis yang dapat tertinggal dari chain. Dilaporkan saat `intent status` bila jumlah baris tidak sama dengan `amendments.length`.
- INTENT schema 4 dan 5 tetap divalidasi sesuai spesifikasi masing-masing; validator tidak mewajibkan section riwayat.
- Chain lama tanpa baseline tetap berjalan untuk semua operasi selain amandemen/petition-preflight.
- `UNCERTIFIED_EDIT` tetap tidak disembuhkan otomatis oleh doctor.
- MCP: tool `sigma_prepare_intent_amendment`/`sigma_commit_intent_amendment` tetap bernama sama; skema masukan commit bertambah satu argumen wajib. Tiket lama tanpa field baru ditolak tanpa konsumsi pada commit (pola tombstone F04).
- Tidak ada migrasi proyek nyata. Chain nyata (mis. KLHK) tidak disentuh pada F05.

## 6. Perubahan rules, template, skill, dan Protocol

Batch B ARC-RULE (setelah keputusan ditutup): bagian Amendment Request (preflight, `preview`, hash yang disetujui, commit, `--commit`, tag, push manual, bahwa pesan role lain bukan otorisasi tetap dari batch A); CLI Operation Policy (`baseline adopt`, `amendment preview`); Petition pada intent versi terbaru dengan `baseline check`. Teks mengikuti Writing Style Rules F11 dan larangan rujukan nomor section/prefix role. Skill dan memory ARC hanya diubah bila terdapat pernyataan yang bertentangan; temuan dilaporkan, tidak diubah tanpa persetujuan.

FMN: rujukan `AMD-NNN` tetap; perubahan hanya bila O-9 memutuskan lain.

**Butir untuk Protocol (dikerjakan terakhir; tidak diubah di F05):** hapus model dua tier pada bagian state machine INTENT, bagian "Sovereign Intent vs. Operationalization", catatan CLI `intent amendment`, doktrin AUD ("Intent Core is sovereign", "Challengeable sublayers"), dan tabel Key Auditable vs Sovereign Boundaries; tulis ulang prinsip "tujuan milik Director, metode dapat diaudit" tanpa kerangka tier; tambahkan alur amandemen Git dan riwayat tag. Daftar dari E04 bagian 7 tetap berlaku.

## 7. Risiko dan dependensi

- **R-1 Akhir baris (belum diuji).** `certified_doc_sha256` dihitung dari byte mentah file kerja. Pada Windows dengan `core.autocrlf=true` atau `.gitattributes`, blob di commit dapat memakai LF sementara file kerja CRLF; hash byte tidak akan cocok. Mitigasi: bandingkan dengan normalisasi CRLF→LF seperti `normalizeDocument` di F04, dan jangan mengubah definisi hash tersertifikasi yang sudah ada. Uji fixture dengan `autocrlf` true/false/input.
- **R-2 Akar repo ≠ akar proyek.** Proyek dapat berada di subfolder repo yang lebih besar atau repo monorepo; beberapa proyek Sigma dapat berbagi satu repo. Tag `sigma/intent-<chain>-amd-NNN` dapat bertabrakan antar proyek. Mitigasi: path relatif ke akar repo pada preflight; benturan nama tag ditolak tanpa menimpa (keputusan 6); format tag tidak memuat proyek sesuai contoh Director (O-3).
- **R-3 Riwayat ditulis ulang.** Rebase/amend setelah tag membuat commit baseline tidak terjangkau dari cabang; tag menjaga objek selama referensinya ada, tetapi dapat dihapus manual. Preflight melaporkan, tidak memperbaiki.
- **R-4 Lingkungan Git.** Git tidak ada di PATH host MCP, `safe.directory`, `index.lock`, HEAD terlepas, worktree tambahan, repo dangkal. Semua dilaporkan sebagai butir preflight; tidak ada fallback diam-diam.
- **R-5 Persetujuan terikat ke hash.** Perubahan satu byte setelah persetujuan membatalkan persetujuan; jendela commit mengandalkan kedisiplinan operator. Mitigasi: hash di `preview`, di tiket, dan di perintah.
- **R-6 Windows dan pembuatan tag annotated.** Memerlukan identitas Git; commit hasil juga memerlukannya, sehingga tidak menambah prasyarat baru (O-3).
- **R-7 Pelebaran cakupan amandemen.** Tier dihapus sehingga amandemen dapat mengubah tujuan. Justifikasi lama tanpa `--director-confirm` ("blast radius hanya satu entri append-only") tidak lagi memadai (O-7).
- **Dependensi:** F02 (identitas chain dan marker), F04 (hook `certifyIntentDoc`, `currentIntent`, journal/lease, `needs_intent_review`), F03 (pesan ke FMN tidak berubah). F01/F09: salinan ARC-RULE, memory, skill, dan registry di luar master mengikuti sinkronisasi. F07: template INTENT final. F15: tinjauan Constitution (prioritas 5 audit ChatGPT) dikerjakan bersama.

## 8. Strategi uji dan kriteria selesai (REKOMENDASI)

Uji memakai repo Git sementara dengan konfigurasi pengguna eksplisit; tidak menyentuh repo master atau proyek nyata.

| ID | Kontrak |
|---|---|
| U-01 | Preflight: tanpa Git, INTENT tidak dilacak/diabaikan, baseline tidak ada, commit baseline hilang, hash baseline tidak cocok, perubahan unstaged/staged, commit tak tercatat, tag bergeser; setiap butir dilaporkan terpisah |
| U-02 | `preview`: diff terhadap baseline, hash, dampak PLAN APPROVED/LOCKED/DRAFT, tanpa menulis dokumen atau chain |
| U-03 | Amandemen CLI B: sukses menulis entri, blok baseline, tag annotated, log, revision +1, PLAN APPROVED `needs_intent_review`, LOCKED tidak berubah |
| U-04 | Tolak: tanpa `--commit`, tanpa `--director-confirm`, hash tidak cocok, commit bukan keturunan baseline, isi commit ≠ working tree, `purpose_changed` kosong |
| U-05 | Kegagalan parsial: crash setelah tag sebelum chain (jalankan ulang mengadopsi tag), tag pada commit lain ditolak, crash sebelum marker commit memulihkan, tiket/approval tidak terkonsumsi bila gagal |
| U-06 | Baseline `adopt`: jalur normal, jalur `imported_current`, penolakan bila isi commit ≠ hash tersertifikasi dan bukan impor, idempotensi |
| U-07 | MCP parity: prepare/commit dengan argumen `commit`; tiket lama tanpa field baru ditolak tanpa konsumsi; state revision dan hash tetap diperiksa |
| U-08 | Akhir baris: `autocrlf` true/false/input dan `.gitattributes` dengan INTENT CRLF/LF |
| U-09 | Akar repo di atas akar proyek; dua proyek dalam satu repo; benturan nama tag |
| U-10 | Regresi: INTENT schema 4 dan 5 valid; entri amandemen lama tampil; `UNCERTIFIED_EDIT` tidak disembuhkan doctor; Gate/PLAN F04 tidak berubah; suite lengkap hijau |
| U-11 | `doctor`: lapor tag hilang/bergeser/yatim tanpa menulis |
| U-12 | Teks: tidak ada rujukan "Section 14"/tier pada kode, registry (entri terbatas), ARC-RULE, template dalam cakupan; rules/skill/memory konsisten |

Kriteria selesai: TypeScript `--noEmit` dan build lulus, U-01 sampai U-12 lulus, suite lengkap hijau, pemeriksaan batas scope (tidak ada perubahan Constitution, Protocol, `SCHEMA_VERSION`, versi paket, sinkronisasi, atau migrasi nyata), laporan hasil di bagian 11 dokumen ini, status F00 diperbarui. Commit dan push menunggu instruksi terpisah.

## 9. Keputusan terbuka

Setiap butir memuat opsi, rekomendasi, dan kolom jawaban Director. Butir yang tidak dijawab tidak dianggap disetujui.

| ID | Pertanyaan | Opsi | Rekomendasi dan alasan | Jawaban Director |
|---|---|---|---|---|
| O-1 | Urutan efektif amandemen (T-10): kapan amandemen dianggap efektif terhadap persetujuan, sertifikasi, commit, dan tag? | (A) catat dulu lalu commit lalu tag, dengan state `AWAITING_GIT`; (B) persetujuan isi, commit, lalu satu titik efektif yang memverifikasi, membuat tag, dan menulis chain | **B.** Tidak ada state efektif tanpa acuan; kegagalan sebelum titik efektif meninggalkan keadaan lama utuh dan sudah dilindungi `UNCERTIFIED_EDIT`; isi yang disahkan tidak dapat hilang karena sudah ada di commit. Bentuk lama tanpa `--commit` dihapus, tanpa bypass |  |
| O-2 | Bagaimana baseline dibentuk untuk chain RATIFIED yang ada dan untuk chain `UNCERTIFIED_EDIT` tanpa commit yang cocok? | (a) `ratify` otomatis memerlukan commit; (b) perintah terpisah `baseline adopt --commit` (Director-confirm, CLI saja); (c) amandemen pertama sekaligus membentuk baseline | **(b)** dengan jalur impor isi saat ini yang ditinjau Director bila baseline tidak dapat dipulihkan (`imported_current`, tanpa delta fiktif; sejajar F04 O-9). `ratify` tetap tidak bergantung Git agar proyek tanpa Git tetap dapat meratifikasi; (c) mencampur dua persetujuan dalam satu langkah |  |
| O-3 | Format dan jenis tag, serta penanganan benturan. | Jenis: annotated atau lightweight. Nama: `sigma/intent-<chain>-amd-NNN` dan `sigma/intent-<chain>-base` (contoh Director) atau memuat id proyek. Benturan: tolak atau adopsi bila commit sama | **Annotated**, nama sesuai contoh Director tanpa id proyek, benturan pada commit lain ditolak dan pada commit sama diadopsi (idempotensi). Annotated memuat metadata (chain, ID, hash) dan dikirim oleh `--follow-tags`; identitas Git sudah dibutuhkan commit hasil. Risiko monorepo dicatat R-2, bukan dipecahkan dengan nama yang berbeda dari contoh Director |  |
| O-4 | Persyaratan commit hasil (4.5): seberapa ketat? | (a) harus keturunan baseline, isi INTENT sama, bersih; commit boleh memuat berkas lain; (b) commit hanya boleh memuat INTENT; (c) HEAD diterima otomatis | **(a).** Keputusan 8 dan 9: pemilihan berkas milik Director dan pemeriksaan terarah pada INTENT; (b) melanggar kendali Director; (c) bertentangan dengan keputusan 9 |  |
| O-5 | Isi metadata dan perlakuan riwayat di dokumen (4.4, T-10, E01 E-3/E-5, D-10d): dokumen tidak lagi ditulis Sigma; section `Amendment History` dan baris header "Amandemen terakhir" tidak ditambahkan. | (a) hapus section dari template schema 5, tidak ada baris header, validator tetap menoleransi section lama; (b) pertahankan section dan render seperti sekarang; (c) tambah baris header yang diisi ARC sebelum persetujuan | **(a).** Render pasca-persetujuan mengubah byte sehingga isi yang ditinjau berbeda dari yang di-commit; riwayat sudah ada di chain, log, dan Git. Catatan: ini menyimpang dari D-10d (28 September) "satu baris di header"; status dan orientasi menampilkan amandemen terakhir sebagai gantinya. Schema 5 belum didistribusikan (T-19), sehingga perubahan template tidak memengaruhi proyek mana pun |  |
| O-6 | Deklarasi "tujuan atau hasil inti berubah" (keputusan 3). | (a) wajib `--purpose-changed` bernilai yes atau no, dicatat dan ditampilkan, tanpa gate; (b) opsional; (c) tidak dicatat | **(a).** Menjadikan pernyataan itu eksplisit dan terbaca kemudian tanpa menjadi tier atau gate; `unsure` tidak disediakan karena Director dapat menolak jika pernyataan tidak meyakinkan |  |
| O-7 | Konfirmasi Director pada langkah efektif CLI. | (a) tambah `--director-confirm` (seperti `intent supersede`, `--migrate-lifecycle`); (b) tetap tanpa flag | **(a).** Alasan lama tanpa flag ("hanya satu entri append-only") tidak berlaku bila amandemen boleh mengubah tujuan dan memicu peninjauan pasangan APPROVED. Jalur MCP sudah memerlukan persetujuan tiket Director |  |
| O-8 | Cakupan MCP dan registry. | (a) adaptasi dua tool amandemen yang ada; `baseline adopt` CLI saja (tidak admissible via MCP); baca-saja melalui kolom tambahan pada `sigma_get_intent_status`/orientasi; registry terbatas pada entri `intent_amendment` dan satu entri baru; (b) tool MCP baru untuk baseline/preview | **(a).** Paritas untuk operasi yang sudah ada tanpa menambah permukaan; baseline adalah keputusan Director yang cukup lewat CLI, sama seperti migrasi lifecycle. Refresh registry luas tetap F09 |  |
| O-9 | Kosakata status Work Outside Intent pada PLAN (E02 A-5). | (a) pertahankan `NOTED`/`AMENDMENT_REQUESTED`/`AMENDMENT_RATIFIED` dan rujukan `AMD-NNN`, tanpa rujukan nomor section; (b) kosakata baru | **(a).** ID `AMD-NNN` dipertahankan dan semantik tiga status tetap sah (dicatat, diajukan, sudah diratifikasi). Perubahan hanya membersihkan rujukan "Section 14" jika masih ada |  |
| O-10 | Kata "Challengeable" pada Binding Level constraint (template INTENT baris 122; ARC-RULE baris 235). | (a) pertahankan: vocabulary tingkat ikatan per constraint, bukan tier Intent Core; (b) ganti dengan istilah lain | **(a).** Review ARC-RULE butir 1 menghapus tier Sovereign/Challengeable pada Operationalization, sedangkan Binding Level mengatur seberapa kuat satu constraint mengikat FMN/AUD. Penggantian mengubah template yang sudah disetujui E01 tanpa kebutuhan fungsional; kemiripan kata dicatat |  |
| O-11 | Distribusi tag (T-11) dan titik build/uji. | (a) hanya teks pengingat setelah sukses (`--follow-tags` untuk annotated atau `git push origin <tag>`), tanpa pemeriksaan remote; (b) Sigma memeriksa remote | **(a).** Sigma tidak menghubungi jaringan dan push milik Director. Build `dist/` terlacak dan memengaruhi runtime global lewat symlink: build hanya pada akhir implementasi setelah `tsc --noEmit` dan uji khusus lulus, dilaporkan lebih dulu (sama dengan F04 O-14) |  |
| O-12 | K5: apakah ditambahkan perintah `sigma intent recertify`? | (a) tidak; amandemen `preview` menampilkan diff terhadap baseline dan menjadi jalur pemulihan `UNCERTIFIED_EDIT`; (b) tambah perintah terpisah | **(a).** Edit di luar alur adalah draf amandemen yang belum disetujui; alur yang sama menutupnya tanpa dua mekanisme paralel dan tanpa penyertifikasian diam-diam. Doctor tetap tidak menyembuhkan |  |
| O-13 | Cakupan penghapusan tier pada F05 dan urutan eksekusi. | (a) F05 mengubah kode (komentar/teks), entri registry terkait, ARC-RULE batch B, template yang dibahas; Protocol hanya daftar butir; (b) menunggu seluruh rules/Protocol bersama | **(a).** Sisa tier di kode dan registry kecil dan terpisah dari Protocol; syarat urutan T-19 terpenuhi karena rules AUD/FMN/ARC sudah bebas tier. Protocol tetap terakhir |  |

**Jawaban Director (8 Oktober 2026): O-1 sampai O-13 seluruhnya disetujui sesuai rekomendasi.** Kolom jawaban pada tabel di atas dibiarkan kosong; baris asli tidak diubah.

Catatan batas persetujuan: persetujuan O-1 sampai O-13 mengotorisasi implementasi sesuai bagian 10, bukan commit, push, sinkronisasi, atau migrasi proyek nyata.

## 10. Urutan langkah implementasi (REKOMENDASI; difinalkan setelah keputusan ditutup)

1. W0: baseline `tsc --noEmit` dan suite uji; catat hasil. Verifikasi ulang HEAD, status worktree, dan nomor baris peta dampak. Jalankan uji pendahuluan Git (R-1, `--follow-tags`, tag annotated tanpa remote) pada repo sementara.
2. W1: modul Git (`execFileSync`, tanpa shell, pathspec setelah `--`): resolusi akar repo, status berkas, baca blob, ancestry, buat tag, baca tag.
3. W2: preflight + `baseline check` + `amendment preview` (baca-saja) dengan U-01, U-02.
4. W3: metadata chain (opsional) dan layanan amandemen baru (transaksi journal + lease F04, tag sebelum tulis chain, adopsi tag idempoten); hentikan render dokumen; CLI.
5. W4: `baseline adopt` (termasuk `imported_current`); `doctor` baca-saja drift Git.
6. W5: MCP prepare/commit, orientasi/status, registry terbatas dan policy.
7. W6: rules ARC batch B, template (O-5), FMN-PLAN/FMN-RULE bila O-9 memerlukan, komentar dan teks kode.
8. W7: build, suite lengkap, pemeriksaan batas scope; tulis bagian 11; perbarui F00.

## 11. Hasil eksekusi - 8 Oktober 2026

Eksekusi diotorisasi oleh persetujuan Director atas O-1 sampai O-13 ("semua disetujui mengikuti rekomendasi"). Baseline: `main`, HEAD `b8050f8`, worktree bersih sebelum F05; `core.autocrlf=true` pada mesin ini (R-1 nyata, bukan hipotetis).

### Perilaku yang diterapkan

- **Modul Git** (`src/engine/gitRepo.ts`): `spawnSync` dengan vektor argumen tanpa shell, lingkungan dibersihkan dari `GIT_DIR` dan sejenisnya, pathspec setelah `--`, referensi commit divalidasi. Satu-satunya tulis Git adalah `git tag -a`. Tidak ada stage, commit, checkout, reset, fetch, atau push.
- **Verifikasi** (`src/engine/intentGit.ts`): preflight 4.1 per butir (`git_available`, `git_repository`, `intent_ratified`, `intent_file`, `intent_tracked`, `baseline_recorded`, `baseline_commit`, `baseline_content`, `baseline_reachable`, `commits_after_baseline` informasional, `baseline_tag`, lalu `certified_matches_file`/`worktree_clean`/`file_matches_baseline` pada mode `clean` atau `changed_since_baseline` pada mode `edited`). Perbandingan isi memakai hash dengan CRLF dilipat ke LF; hash tersertifikasi tetap hash byte mentah. Tag hilang adalah peringatan; tag yang menunjuk commit lain memblokir. Verifikasi commit hasil 4.5 (keturunan baseline, terjangkau dari HEAD, isi sama dengan file kerja, path bersih, hash yang ditinjau cocok).
- **CLI**: `sigma intent baseline check`, `baseline adopt --commit [--import-current] --director-confirm`, `amendment preview`, dan `amendment --change --purpose-changed --commit --doc-sha256 --director-confirm` (opsi diperiksa manual karena Commander memeriksa opsi wajib induk saat subperintah berjalan). Bentuk lama tanpa Git dan tanpa `--commit` dihapus tanpa bypass. Keluaran mencetak pengingat distribusi tag. `intent status` menampilkan baseline Git dan amandemen terakhir; pesan `UNCERTIFIED_EDIT` mengarah ke `amendment preview`.
- **Urutan efektif (O-1, opsi B)**: verifikasi → tag annotated → penulisan chain (entri amandemen dengan referensi Git, `certifyIntentDoc`, `git_baseline` baru, log JSONL bertanda `event`). Dokumen INTENT tidak ditulis Sigma; `src/utils/amendmentHistory.ts` dihapus. Tag yang tersisa dari percobaan terputus pada commit yang sama diadopsi; tag pada commit lain ditolak.
- **Baseline (O-2)**: `adopt` membentuk tag `sigma/intent-<chain>-base`; jalur `--import-current` mensertifikasi isi saat ini yang ditinjau (revision +1, `revision_provenance: imported_current_certification`) tanpa amandemen fiktif; chain tanpa hash tersertifikasi juga memerlukan flag itu. Baseline yang sudah ada tidak diganti; perintah ulang pada commit yang sama idempoten.
- **MCP (O-8)**: `sigma_prepare_intent_amendment` menerima `purpose_changed`, menolak bila preflight Git gagal, dan membekukan paket tinjauan (commit baseline, hash diff, hash dokumen, dampak) pada tiket. `sigma_commit_intent_amendment` menerima `purpose_changed` dan `commit`, memeriksa ulang diff dan dokumen terhadap tiket, memverifikasi commit, membuat tag, lalu menulis. Tiket lama tanpa paket Git ditolak tanpa konsumsi. `sigma_intent_status` menambah `git_baseline` dan `last_amendment` (tanpa menjalankan Git). `baseline adopt` hanya CLI; policy `intent_baseline: W3`.
- **Doctor (4.7)**: melaporkan baca-saja tag hilang/bergeser, commit tidak tersedia, dan tag yatim; tidak memperbaiki dan tidak menghapus tag.
- **Registry**: entri `intent_amendment` ditulis ulang (tanpa istilah tier dan Section 14), entri baru `intent_baseline`; total 65. Tidak ada refresh luas.
- **Rules/template/dokumen**: ARC-RULE batch B (Latest INTENT first, Review of the change, Commit and record, Tag distribution, Latest INTENT before a Petition, dua baris read-only dan satu baris Approval pada CLI Operation Policy). Template INTENT schema 5 kehilangan section riwayat (O-5); validator tetap menoleransinya untuk dokumen lama. FMN-RULE: dua rujukan "Amendment History" diganti rujukan ke catatan Sigma; kosakata `NOTED`/`AMENDMENT_REQUESTED`/`AMENDMENT_RATIFIED` dan template PLAN tidak berubah (O-9). README memuat perintah baru. Komentar kode dan pesan galat yang menyebut tier atau Section 14 dibersihkan.

### Penyimpangan dari rencana dan temuan saat eksekusi

1. **Anggaran mutasi MCP 250 ms.** `respondControlWrite` membatalkan `mutate()` yang melebihi `CONTROL_MUTATION_MAX_MS`; subproses Git tidak muat di dalamnya. Layanan dipecah dua fase: `verifyAndTagAmendment` (seluruh Git, termasuk pembuatan tag) dan `applyVerifiedAmendment` (tulis chain dan log tanpa subproses). Jalur MCP menjalankan fase pertama di `checkPreconditions` (masih di bawah kunci proyek), jalur CLI menjalankan keduanya. Akibatnya pada MCP tag dibuat sebelum jurnal transaksi dimulai; urutan tag sebelum chain terjaga dan adopsi tag menutup kegagalan sesudahnya.
2. **Bug pathspec ditemukan uji.** Perintah Git ber-pathspec dijalankan dari akar proyek, padahal pathspec relatif terhadap `cwd`; kasus repo di atas akar proyek gagal (`intent_tracked`). Diperbaiki dengan menjalankan perintah itu dari akar repo (U-09).
3. **Hash tiket MCP** memakai awalan `sha256:` (`readCanonicalArtifactFile`); dibuang sebelum dibandingkan dengan hash byte mentah.
4. **Larangan tanda pipa/newline pada `--change` dipertahankan** (ringkasan satu baris untuk log JSONL dan pesan tag), walau tabel dokumen tidak lagi dirender.
5. **`doc_sha256_lf`** ditambahkan pada baseline dan entri amandemen (tidak tercantum eksplisit di 4.4) supaya perbandingan isi stabil terhadap `core.autocrlf`.
6. `commits_after_baseline` informasional pada kedua mode, bukan pemblokir: setiap perubahan setelah baseline sudah tampak sebagai diff atau sebagai `UNCERTIFIED_EDIT`.
7. Helper uji `runCli` menerima `SIGMA_TEST_DIST` agar uji CLI dapat dijalankan terhadap build sementara sebelum `dist/` dibangun; build sementara dihapus.
8. `preview` tidak menerima `--purpose-changed`; deklarasi itu hanya diberikan pada perintah pencatatan dan tiket MCP.

### Hasil validasi aktual

`tsc --noEmit` dan build (`tsc`) lulus, exit 0. Suite lengkap pada build final: 72 berkas / 1.072 tes lulus, tanpa kegagalan (baseline sebelum F05: 71 / 1.036). Uji baru: `test/f05-intent-git-amendment.test.ts` (37 tes) dan 10 tes MCP Git pada `test/control-w2-batch.test.ts`; `test/intent-amendment.test.ts` disesuaikan (guard dan `UNCERTIFIED_EDIT`); jumlah operasi registry pada tiga tes menjadi 65. Semua uji memakai repo Git sementara; tidak ada tag atau commit pada repo master. `git diff --check` bersih selain peringatan CRLF yang sudah ada. Constitution, Protocol, `SCHEMA_VERSION`, versi paket, `setup/`, dan skill tidak diubah.

### Keterlacakan kontrak uji

| Kontrak | Bukti uji utama |
|---|---|
| U-01 | f05: `baseline check` (tanpa baseline, tanpa Git, perubahan belum commit, tidak dilacak, isi baseline berubah, tag hilang/bergeser) |
| U-02 | f05: `amendment preview` (diff, hash, dampak, tidak menulis dokumen/chain; diblokir tanpa perubahan) |
| U-03/U-04 | f05: pencatatan AMD-001/002, opsi hilang, `--director-confirm`, `--purpose-changed`, hash salah, commit baseline, commit belum final, ref tidak valid, tidak terjangkau dari HEAD, tag di commit lain, adopsi tag, PLAN APPROVED ditandai dan LOCKED tidak berubah |
| U-05 | f05: adopsi tag setelah percobaan terputus; chain tidak ditulis bila verifikasi atau tag gagal. Crash proses nyata pada titik jurnal tidak diuji ulang secara khusus (infrastruktur jurnal F04 tidak diubah) |
| U-06 | f05: `baseline adopt` (normal, tanpa konfirmasi, idempoten, isi berbeda, `--import-current`, chain tanpa sertifikasi) |
| U-07 | control-w2-batch: prepare/commit end-to-end, role, tanpa baseline, tiket lama, hash `change`/`purpose_changed`, dokumen basi, tiket terkonsumsi |
| U-08 | f05: alur penuh untuk `autocrlf` true/false/input dengan INTENT CRLF dan LF |
| U-09 | f05: repo di atas akar proyek |
| U-10 | suite lengkap hijau; INTENT schema 4/5, entri lama, `UNCERTIFIED_EDIT` tanpa penyembuhan doctor, tes F04 tidak berubah |
| U-11 | f05: doctor melaporkan tag hilang dan yatim, tidak mengubah chain, tidak menghapus tag |
| U-12 | pencarian teks pada kode, registry (entri terkait), ARC-RULE, FMN-RULE, template dalam cakupan: tidak ada sisa tier atau Section 14 selain yang tercantum di bawah |

### Batas hasil dan tindak lanjut

1. Chain nyata (mis. KLHK) tidak disentuh dan belum memiliki baseline; amandemen pertamanya memerlukan `baseline adopt` dengan Director-confirm. Tidak ada migrasi proyek nyata.
2. Perilaku `--follow-tags` diuji pada repo sementara dengan remote bare lokal sebelum implementasi (tag annotated terkirim, lightweight tidak); tidak diuji terhadap remote sungguhan.
3. `doctor --reconstruct` tidak diubah dan tidak menyimpulkan referensi Git; chain yang direkonstruksi tidak memiliki `git_baseline` (diperlakukan sebagai tanpa baseline). Tidak diuji khusus.
4. Sisa tier yang dibiarkan sesuai keputusan: `SIGMA_PROTOCOL.md` (ditahan; daftar butir di bagian 6), "Challengeable" pada Binding Level (O-10), "source tier" Research Mode, prinsip tujuan milik Director pada AUD-RULE/memory AUD, fixture INTENT schema 4, kata "operationalization" pada template CLOSE.
5. Tabel `Amendment History` pada dokumen INTENT lama tidak diperbarui lagi dan dapat tertinggal dari chain; `intent status` menampilkan amandemen terakhir dari chain. Pelaporan ketidaksesuaian jumlah baris tabel (bagian 5) tidak diimplementasikan.
6. Salinan ARC-RULE, FMN-RULE, template INTENT, registry di `~/.sigma`, skill terpasang, dan proyek belum menerima perubahan sampai F09. Build `dist/` sudah memperbarui runtime global lewat symlink (O-11). Commit dan push menunggu instruksi terpisah.
7. File Discussion `2026-10-08_evaluasi-integrasi-opencode.md` muncul sebagai berkas tak terlacak di worktree selama sesi ini; bukan bagian F05.
